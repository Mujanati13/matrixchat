import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { nanoid } from 'nanoid/non-secure';

import type { MatrixRoomSummary, MatrixSession, MatrixTimelineEvent } from '@app-types/matrix';
import {
  createDirectRoom,
  deactivateAccount,
  deleteMessage,
  fetchRoomMessages,
  fetchUserProfile,
  joinRoom,
  leaveRoom,
  loginWithPassword,
  logout as matrixLogout,
  registerAccount,
  searchUsers,
  sendTextMessage,
  sendImageMessage as sendImageMessageApi,
  storeRecoveryKeyAccountData,
  syncRooms,
  updateAvatarUrl,
  updateDisplayName,
} from '@services/matrixApi';
import { isRecoveryEndpointMissing, storeRecoveryKey } from '@services/recoveryApi';
import { clearSession, loadSession, persistSession } from '@storage/session';
import {
  clearPendingRecoveryBackup,
  loadPendingRecoveryBackup,
} from '@storage/recoveryBackup';
import {
  clearAllRoomMessages,
  loadAllRoomMessages,
  removeRoomMessages,
  saveRoomMessages,
} from '@storage/messageStorage';

const MatrixContext = createContext<MatrixContextValue | undefined>(undefined);

const statusPriority: Record<'sent' | 'pending' | 'error', number> = {
  sent: 1,
  pending: 2,
  error: 3,
};

const resolveEventStatus = (
  existing?: MatrixTimelineEvent['status'],
  incoming?: MatrixTimelineEvent['status'],
): MatrixTimelineEvent['status'] => {
  if (!existing) {
    return incoming ?? undefined;
  }
  if (!incoming) {
    return existing;
  }

  const existingPriority = statusPriority[existing];
  const incomingPriority = statusPriority[incoming];

  if (incomingPriority >= existingPriority) {
    return incoming;
  }
  return existing;
};

const mergeTimelineEvents = (
  current: MatrixTimelineEvent,
  incoming: MatrixTimelineEvent,
): MatrixTimelineEvent => ({
  ...current,
  ...incoming,
  status: resolveEventStatus(current.status, incoming.status) ?? incoming.status ?? current.status,
});

const MAX_EVENTS_PER_ROOM = 200;

const normaliseEvents = (events: MatrixTimelineEvent[]) => {
  const byEventId = new Map<string, MatrixTimelineEvent>();
  const byTransactionId = new Map<string, string>();

  events.forEach((rawEvent) => {
    const event: MatrixTimelineEvent = {
      ...rawEvent,
      status: rawEvent.status ?? 'sent',
    };

    if (event.transactionId) {
      const existingEventIdForTxn = byTransactionId.get(event.transactionId);
      if (existingEventIdForTxn) {
        const existing = byEventId.get(existingEventIdForTxn);
        if (existing) {
          const merged = mergeTimelineEvents(existing, {
            ...event,
            eventId: event.eventId,
          });
          byEventId.delete(existingEventIdForTxn);
          byEventId.set(merged.eventId, merged);
          byTransactionId.set(event.transactionId, merged.eventId);
          return;
        }
      }
    }

    const existing = byEventId.get(event.eventId);
    if (existing) {
      const merged = mergeTimelineEvents(existing, event);
      byEventId.set(merged.eventId, merged);
      if (merged.transactionId) {
        byTransactionId.set(merged.transactionId, merged.eventId);
      }
      return;
    }

    byEventId.set(event.eventId, event);
    if (event.transactionId) {
      byTransactionId.set(event.transactionId, event.eventId);
    }
  });

  const sorted = Array.from(byEventId.values()).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  if (sorted.length > MAX_EVENTS_PER_ROOM) {
    return sorted.slice(sorted.length - MAX_EVENTS_PER_ROOM);
  }

  return sorted;
};

type MatrixContextValue = {
  session: MatrixSession | null;
  rooms: MatrixRoomSummary[];
  roomMessages: Record<string, MatrixTimelineEvent[]>;
  userProfile: { displayName?: string; avatarUrl?: string } | null;
  roomsLoading: boolean;
  isReady: boolean;
  login: (username: string, password: string) => Promise<MatrixSession>;
  register: (username: string, password: string) => Promise<MatrixSession>;
  logout: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  fetchMessages: (roomId: string) => Promise<MatrixTimelineEvent[]>;
  sendMessage: (
    roomId: string,
    body: string,
    transactionId?: string,
  ) => Promise<{ eventId: string; txnId: string }>;
  sendImageMessage: (
    roomId: string,
    imageUri: string,
    mimeType: string,
    fileName: string,
    transactionId?: string,
  ) => Promise<{ eventId: string; txnId: string }>;
  deleteMessage: (roomId: string, eventId: string, reason?: string) => Promise<void>;
  createDirectRoom: (matrixId: string) => Promise<string>;
  joinRoom: (roomIdOrAlias: string) => Promise<string | null>;
  leaveRoom: (roomId: string) => Promise<void>;
  searchUsers: (
    query: string,
  ) => Promise<Array<{ userId: string; displayName?: string }>>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateAvatarUrl: (mxcUrl: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

type Props = {
  children: React.ReactNode;
};

export const MatrixProvider = ({ children }: Props) => {
  const [session, setSession] = useState<MatrixSession | null>(null);
  const [rooms, setRooms] = useState<MatrixRoomSummary[]>([]);
  const [roomMessages, setRoomMessages] = useState<Record<string, MatrixTimelineEvent[]>>({});
  const [userProfile, setUserProfile] = useState<{ displayName?: string; avatarUrl?: string } | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [isReady, setReady] = useState(false);
  const [nextSyncToken, setNextSyncToken] = useState<string | null>(null);
  const initialSyncPerformedRef = useRef(false);
  const recoveryFlushAttemptedRef = useRef(false);
  const autoJoinInFlightRef = useRef<Set<string>>(new Set());

  const setRoomMessagesForRoom = useCallback(
    (
      roomId: string,
      updater: (events: MatrixTimelineEvent[]) => MatrixTimelineEvent[],
    ) => {
      let updatedEvents: MatrixTimelineEvent[] | null = null;

      setRoomMessages((current) => {
        const existing = current[roomId] ?? [];
        const updated = normaliseEvents(updater(existing));

        const isUnchanged =
          existing.length === updated.length &&
          existing.every((event, index) => {
            const nextEvent = updated[index];
            return (
              event.eventId === nextEvent.eventId &&
              event.timestamp === nextEvent.timestamp &&
              event.body === nextEvent.body &&
              event.decryptedBody === nextEvent.decryptedBody &&
              event.status === nextEvent.status
            );
          });

        if (isUnchanged) {
          return current;
        }

        updatedEvents = updated;

        return {
          ...current,
          [roomId]: updated,
        };
      });

      if (updatedEvents && session?.userId) {
        void saveRoomMessages(session.userId, roomId, updatedEvents);
      }
    },
    [session?.userId],
  );

  const mergeRoomMessages = useCallback(
    (roomId: string, events: MatrixTimelineEvent[]) => {
      if (!events || events.length === 0) {
        return;
      }
      setRoomMessagesForRoom(roomId, (existing) => [...existing, ...events]);
    },
    [setRoomMessagesForRoom],
  );

  useEffect(() => {
    (async () => {
      const storedSession = await loadSession();
      if (storedSession) {
        setSession(storedSession);
        setNextSyncToken(storedSession.nextSyncToken ?? null);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      if (!session?.userId) {
        setRoomMessages({});
        return;
      }

      const storedMessages = await loadAllRoomMessages(session.userId);
      if (!cancelled) {
        setRoomMessages(storedMessages);
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [session?.userId]);

  const updateSessionState = useCallback(async (newSession: MatrixSession | null) => {
    if (!newSession) {
      setSession(null);
      setNextSyncToken(null);
      initialSyncPerformedRef.current = false;
      recoveryFlushAttemptedRef.current = false;
      setRooms([]);
      setRoomMessages({});
      setUserProfile(null);
      await clearSession();
      return;
    }
    setSession(newSession);
    setNextSyncToken(newSession.nextSyncToken ?? null);
    initialSyncPerformedRef.current = false;
    recoveryFlushAttemptedRef.current = false;
    setRooms([]);
    setRoomMessages({});
    setUserProfile(null);
    await persistSession(newSession);
  }, []);

  const refreshRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      if (!session) {
        setRooms([]);
        initialSyncPerformedRef.current = false;
        return;
      }
      let sinceToken = initialSyncPerformedRef.current ? nextSyncToken ?? null : null;
      let result = await syncRooms(session, sinceToken);

      if (!initialSyncPerformedRef.current && sinceToken && (!result || result.rooms.length === 0)) {
        sinceToken = null;
        result = await syncRooms(session, null);
      }

      if (result) {
        setRooms((currentRooms) => {
          if (!sinceToken) {
            return result.rooms.map((room) => ({ ...room, timeline: undefined }));
          }
          if (result.rooms.length === 0 && (!result.leftRoomIds || result.leftRoomIds.length === 0)) {
            return currentRooms;
          }

          const roomMap = new Map(currentRooms.map((room) => [room.roomId, room] as const));
          
          // Update or add rooms
          result.rooms.forEach((room) => {
            const existingRoom = roomMap.get(room.roomId);
            // Preserve room name and other metadata from existing room if name is empty/generic
            const shouldPreserveName = existingRoom && 
              existingRoom.name && 
              (!room.name || room.name.startsWith('!'));
            
            roomMap.set(room.roomId, {
              ...room,
              timeline: undefined,
              name: shouldPreserveName ? existingRoom.name : room.name,
              isDirect: existingRoom?.isDirect ?? room.isDirect,
            });
          });
          
          // Remove left rooms
          if (result.leftRoomIds && result.leftRoomIds.length > 0) {
            result.leftRoomIds.forEach((roomId) => {
              roomMap.delete(roomId);
            });
          }
          
          return Array.from(roomMap.values());
        });

        result.rooms.forEach((room) => {
          if (room.membership === 'join' && room.timeline?.length) {
            mergeRoomMessages(room.roomId, room.timeline);
          }
        });

        // Clean up messages for left rooms
        if (result.leftRoomIds && result.leftRoomIds.length > 0) {
          const leftIds = [...result.leftRoomIds];
          setRoomMessages((currentMessages) => {
            const updatedMessages = { ...currentMessages };
            leftIds.forEach((roomId) => {
              delete updatedMessages[roomId];
            });
            return updatedMessages;
          });
          if (session?.userId) {
            leftIds.forEach((roomId) => {
              void removeRoomMessages(session.userId, roomId);
            });
          }
        }

        initialSyncPerformedRef.current = true;

        if (result.nextBatch !== nextSyncToken) {
          const updatedSession: MatrixSession = {
            ...session,
            nextSyncToken: result.nextBatch,
          };
          setSession(updatedSession);
          setNextSyncToken(result.nextBatch);
          await persistSession(updatedSession);
        } else {
          await persistSession(session);
        }
      }
    } finally {
      setRoomsLoading(false);
    }
  }, [session, nextSyncToken, mergeRoomMessages]);

  useEffect(() => {
    if (session) {
      refreshRooms();
    }
  }, [session, refreshRooms]);

  useEffect(() => {
    if (!session) {
      autoJoinInFlightRef.current.clear();
      return;
    }

    const inviteIds = new Set(
      rooms.filter((room) => room.membership === 'invite').map((room) => room.roomId),
    );

    for (const roomId of Array.from(autoJoinInFlightRef.current)) {
      if (!inviteIds.has(roomId)) {
        autoJoinInFlightRef.current.delete(roomId);
      }
    }

  const pendingInvites = rooms.filter(
    (room) => room.membership === 'invite' && !autoJoinInFlightRef.current.has(room.roomId),
  );

  console.log('Pending invites:', pendingInvites.length, pendingInvites.map(r => r.roomId));

  if (pendingInvites.length === 0) {
    return;
  }

  let cancelled = false;

  (async () => {
    let joinedAny = false;
    for (const invite of pendingInvites) {
      if (cancelled) {
        return;
      }

      console.log('Auto-joining room:', invite.roomId, 'from:', invite.inviterId);
      autoJoinInFlightRef.current.add(invite.roomId);

      try {
        await joinRoom(session, invite.roomId);
        console.log('Successfully auto-joined room:', invite.roomId);
        joinedAny = true;
      } catch (error) {
        console.warn('Failed to auto-join invited room', invite.roomId, error);
        autoJoinInFlightRef.current.delete(invite.roomId);
      }
    }      if (!cancelled && joinedAny) {
        await refreshRooms();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rooms, session, refreshRooms]);

  useEffect(() => {
    if (!session) {
      return;
    }

    // More frequent sync for better message delivery
    const interval = setInterval(() => {
      void refreshRooms();
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [session, refreshRooms]);

  useEffect(() => {
    if (!session || recoveryFlushAttemptedRef.current) {
      return;
    }

    recoveryFlushAttemptedRef.current = true;

    (async () => {
      const pending = await loadPendingRecoveryBackup();
      if (!pending || pending.userId !== session.userId) {
        return;
      }

      try {
        await storeRecoveryKey({ user_id: session.userId, recovery_key_hash: pending.recoveryKeyHash });
        await clearPendingRecoveryBackup();
      } catch (error) {
        if (isRecoveryEndpointMissing(error)) {
          try {
            await storeRecoveryKeyAccountData(session, pending.recoveryKeyHash);
            await clearPendingRecoveryBackup();
            return;
          } catch (fallbackError) {
            console.warn('Fallback recovery backup retry failed', fallbackError);
          }
        }
        console.warn('Automatic recovery backup retry failed', error);
        recoveryFlushAttemptedRef.current = false;
      }
    })();
  }, [session]);

  // Load user profile when session changes
  useEffect(() => {
    if (session?.accessToken && session?.userId && isReady) {
      fetchUserProfile(session)
        .then(profile => {
          setUserProfile(profile);
        })
        .catch(error => {
          console.error('Failed to load user profile:', error);
          setUserProfile(null);
        });
    } else {
      setUserProfile(null);
    }
  }, [session, isReady]);

  const login = useCallback(
    async (username: string, password: string) => {
      const newSession = await loginWithPassword(username, password);
      await updateSessionState(newSession);
      return newSession;
    },
    [updateSessionState],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const newSession = await registerAccount(username, password);
      await updateSessionState(newSession);
      return newSession;
    },
    [updateSessionState],
  );

  const logout = useCallback(async () => {
    if (session) {
      await matrixLogout(session);
      await clearAllRoomMessages(session.userId);
    }
    await updateSessionState(null);
    setRooms([]);
    try {
      await clearPendingRecoveryBackup();
    } catch (error) {
      console.warn('Failed to clear pending recovery backup on logout', error);
    }
  }, [session, updateSessionState]);

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!session) {
        throw new Error('No session');
      }

      await deactivateAccount(session, password);
      await clearAllRoomMessages(session.userId);
      await updateSessionState(null);
      setRooms([]);
      try {
        await clearPendingRecoveryBackup();
      } catch (error) {
        console.warn('Failed to clear pending recovery backup after account deletion', error);
      }
    },
    [session, updateSessionState],
  );

  const fetchMessagesForRoom = useCallback(
    async (roomId: string) => {
      if (!session) {
        return roomMessages[roomId] ?? [];
      }
      try {
        const timeline = await fetchRoomMessages(session, roomId);
        let merged: MatrixTimelineEvent[] = [];
        setRoomMessagesForRoom(roomId, (existing) => {
          merged = normaliseEvents([...existing, ...timeline]);
          return merged;
        });
        return merged;
      } catch (error) {
        console.warn('Falling back to cached messages', { roomId, error });
        return roomMessages[roomId] ?? [];
      }
    },
    [session, setRoomMessagesForRoom, roomMessages],
  );

  const sendMessage = useCallback(
    async (roomId: string, body: string, transactionId?: string) => {
      if (!session) {
        throw new Error('No session');
      }
      const trimmedBody = body.trim();
      if (!trimmedBody) {
        throw new Error('Message body required');
      }

      const txnId = transactionId ?? nanoid(16);
      const localEventId = `local-${txnId}`;
      const timestamp = Date.now();
      const optimisticEvent: MatrixTimelineEvent = {
        eventId: localEventId,
        roomId,
        senderId: session.userId,
        senderName: session.userId,
        type: 'm.room.message',
        timestamp,
        body: trimmedBody,
        isEncrypted: false,
        status: 'pending',
        transactionId: txnId,
      };

      setRoomMessagesForRoom(roomId, (existing) => {
        const existingIndex = existing.findIndex(
          (event) => event.transactionId === txnId || event.eventId === localEventId,
        );
        if (existingIndex >= 0) {
          const updated = [...existing];
          updated[existingIndex] = {
            ...updated[existingIndex],
            eventId: localEventId,
            body: trimmedBody,
            decryptedBody: trimmedBody,
            status: 'pending',
            timestamp,
            transactionId: txnId,
          };
          return updated;
        }
        return [...existing, optimisticEvent];
      });
      setRooms((currentRooms) =>
        currentRooms.map((room) =>
          room.roomId === roomId
            ? {
                ...room,
                lastEvent: {
                  eventId: optimisticEvent.eventId,
                  senderId: optimisticEvent.senderId,
                  senderName: optimisticEvent.senderName,
                  type: optimisticEvent.type,
                  body: optimisticEvent.body,
                  timestamp: optimisticEvent.timestamp,
                },
              }
            : room,
        ),
      );

      try {
        const { eventId } = await sendTextMessage(session, roomId, trimmedBody, txnId);
        setRoomMessagesForRoom(roomId, (events) =>
          events.map((event) =>
            event.eventId === localEventId
              ? {
                  ...event,
                  eventId,
                  transactionId: txnId,
                  status: 'sent',
                }
              : event,
          ),
        );
        setRooms((currentRooms) =>
          currentRooms.map((room) =>
            room.roomId === roomId
              ? {
                  ...room,
                  lastEvent: {
                    eventId,
                    senderId: session.userId,
                    senderName: session.userId,
                    type: 'm.room.message',
                    body: trimmedBody,
                    timestamp,
                  },
                }
              : room,
          ),
        );
        
        // Trigger immediate sync to ensure message delivery
        setTimeout(() => {
          void refreshRooms();
        }, 100);
        
        return { eventId, txnId };
      } catch (error) {
        setRoomMessagesForRoom(roomId, (events) =>
          events.map((event) =>
            event.eventId === localEventId
              ? {
                  ...event,
                  status: 'error',
                }
              : event,
          ),
        );
        throw error;
      }
    },
    [session, setRoomMessagesForRoom, refreshRooms],
  );

  const sendImageMessage = useCallback(
    async (roomId: string, imageUri: string, mimeType: string, fileName: string, transactionId?: string) => {
      if (!session) {
        throw new Error('No session');
      }

      const txnId = transactionId ?? nanoid(16);
      const localEventId = `local-${txnId}`;
      const timestamp = Date.now();
      
      // Create optimistic image message
      const optimisticEvent: MatrixTimelineEvent = {
        eventId: localEventId,
        roomId,
        senderId: session.userId,
        senderName: session.userId,
        type: 'm.room.message',
        timestamp,
        body: fileName,
        isEncrypted: false,
        status: 'pending',
        transactionId: txnId,
        content: {
          msgtype: 'm.image',
          url: imageUri, // Temporarily use local URI
        },
      };

      // Add optimistic message to UI
      setRoomMessagesForRoom(roomId, (existing) => {
        const existingIndex = existing.findIndex(
          (event) => event.transactionId === txnId || event.eventId === localEventId,
        );
        if (existingIndex >= 0) {
          const updated = [...existing];
          updated[existingIndex] = optimisticEvent;
          return updated;
        }
        return [...existing, optimisticEvent];
      });

      setRooms((currentRooms) =>
        currentRooms.map((room) =>
          room.roomId === roomId
            ? {
                ...room,
                lastEvent: {
                  eventId: optimisticEvent.eventId,
                  senderId: optimisticEvent.senderId,
                  senderName: optimisticEvent.senderName,
                  type: optimisticEvent.type,
                  body: '📷 Image',
                  timestamp: optimisticEvent.timestamp,
                },
              }
            : room,
        ),
      );

      try {
        // Upload and send the image
        const { eventId } = await sendImageMessageApi(session, roomId, imageUri, mimeType, fileName, txnId);
        
        setRoomMessagesForRoom(roomId, (events) =>
          events.map((event) =>
            event.eventId === localEventId
              ? {
                  ...event,
                  eventId,
                  transactionId: txnId,
                  status: 'sent',
                }
              : event,
          ),
        );

        setRooms((currentRooms) =>
          currentRooms.map((room) =>
            room.roomId === roomId
              ? {
                  ...room,
                  lastEvent: {
                    eventId,
                    senderId: session.userId,
                    senderName: session.userId,
                    type: 'm.room.message',
                    body: '📷 Image',
                    timestamp,
                  },
                }
              : room,
          ),
        );
        
        // Trigger immediate sync
        setTimeout(() => {
          void refreshRooms();
        }, 100);
        
        return { eventId, txnId };
      } catch (error) {
        setRoomMessagesForRoom(roomId, (events) =>
          events.map((event) =>
            event.eventId === localEventId
              ? {
                  ...event,
                  status: 'error',
                }
              : event,
          ),
        );
        throw error;
      }
    },
    [session, setRoomMessagesForRoom, refreshRooms],
  );

  const deleteMessageInRoom = useCallback(
    async (roomId: string, eventId: string, reason?: string) => {
      if (!session) {
        throw new Error('No session');
      }

      try {
        await deleteMessage(session, roomId, eventId, reason);
        
        // Remove the message from local cache
        setRoomMessagesForRoom(roomId, (events) =>
          events.filter((event) => event.eventId !== eventId)
        );
      } catch (error) {
        throw error;
      }
    },
    [session, setRoomMessagesForRoom],
  );

  const createDirectRoomWithUser = useCallback(
    async (matrixId: string) => {
      if (!session) {
        throw new Error('No session');
      }
      const roomId = await createDirectRoom(session, matrixId);
      
      // Force an immediate sync to ensure the room appears quickly
      await refreshRooms();
      
      return roomId;
    },
    [session, refreshRooms],
  );

  const joinRoomInternal = useCallback(
    async (roomIdOrAlias: string) => {
      if (!session) {
        return null;
      }
      const joinedRoomId = await joinRoom(session, roomIdOrAlias);
      await refreshRooms();
      return joinedRoomId;
    },
    [session, refreshRooms],
  );

  const leaveRoomInternal = useCallback(
    async (roomId: string) => {
      if (!session) {
        return;
      }
      await leaveRoom(session, roomId);
      await removeRoomMessages(session.userId, roomId);
      await refreshRooms();
    },
    [session, refreshRooms],
  );

  const searchUsersDirectory = useCallback(
    async (query: string) => {
      if (!session) {
        return [];
      }
      return searchUsers(session, query);
    },
    [session],
  );

  const updateDisplayNameInternal = useCallback(
    async (displayName: string) => {
      if (!session) {
        return;
      }
      await updateDisplayName(session, displayName);
    },
    [session],
  );

  const updateAvatarUrlInternal = useCallback(
    async (mxcUrl: string) => {
      if (!session) {
        return;
      }
      await updateAvatarUrl(session, mxcUrl);
    },
    [session],
  );

  const value = useMemo<MatrixContextValue>(
    () => ({
      session,
      rooms,
      roomMessages,
      userProfile,
      roomsLoading,
      isReady,
      login,
      register,
      logout,
      refreshRooms,
      fetchMessages: fetchMessagesForRoom,
      sendMessage,
      sendImageMessage,
      deleteMessage: deleteMessageInRoom,
      createDirectRoom: createDirectRoomWithUser,
      joinRoom: joinRoomInternal,
      leaveRoom: leaveRoomInternal,
      searchUsers: searchUsersDirectory,
      updateDisplayName: updateDisplayNameInternal,
      updateAvatarUrl: updateAvatarUrlInternal,
      deleteAccount,
    }),
    [
      session,
      rooms,
      roomMessages,
      userProfile,
      roomsLoading,
      isReady,
      login,
      register,
      logout,
      refreshRooms,
      fetchMessagesForRoom,
      sendMessage,
      sendImageMessage,
      deleteMessageInRoom,
      createDirectRoomWithUser,
      joinRoomInternal,
      leaveRoomInternal,
      searchUsersDirectory,
      updateDisplayNameInternal,
      updateAvatarUrlInternal,
      deleteAccount,
    ],
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
};

export const useMatrix = () => {
  const context = useContext(MatrixContext);
  if (!context) {
    throw new Error('useMatrix must be used within a MatrixProvider');
  }
  return context;
};
