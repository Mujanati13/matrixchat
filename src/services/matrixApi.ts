import axios, { AxiosInstance } from 'axios';
import { nanoid } from 'nanoid/non-secure';

import type { MatrixRoomSummary, MatrixSession, MatrixTimelineEvent } from '@app-types/matrix';
import { extractDisplayName } from '@utils/matrixId';

const HOMESERVER = 'http://195.15.212.132';

const resolveServerName = () => {
  const match = HOMESERVER.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/:?#]+)/);
  if (match?.[1]) {
    return match[1];
  }

  const stripped = HOMESERVER.replace(/^[a-zA-Z][^:]*:\/\//, '');
  const host = stripped.split(/[/?#]/)[0];
  if (host) {
    return host;
  }

  return 'matrixchat';
};

export const homeserverName = resolveServerName();

const createMatrixClient = (accessToken?: string): AxiosInstance => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return axios.create({
    baseURL: `${HOMESERVER}/_matrix/client/v3`,
    timeout: 15000,
    headers,
  });
};

const normaliseUsername = (usernameOrMatrixId: string) => {
  const normalised = usernameOrMatrixId.trim();
  if (normalised.startsWith('@')) {
    if (normalised.includes(':')) {
      return normalised;
    }
    return `${normalised}:${homeserverName}`;
  }
  if (normalised.includes(':')) {
    return normalised.startsWith('@') ? normalised : `@${normalised}`;
  }
  return `@${normalised}:${homeserverName}`;
};

const mapTimelineEvent = (roomId: string, event: any): MatrixTimelineEvent | null => {
  if (event.type !== 'm.room.message' && event.type !== 'm.room.encrypted') {
    return null;
  }

  const isEncrypted = event.type === 'm.room.encrypted';
  const body = isEncrypted ? undefined : event.content?.body;

  return {
    eventId: event.event_id,
    roomId,
    senderId: event.sender,
    senderName: event.content?.displayname,
    type: event.type,
    timestamp: event.origin_server_ts ?? Date.now(),
    body,
    isEncrypted,
    decryptedBody: isEncrypted ? undefined : event.content?.body,
    content: event.content,
    status: 'sent',
    transactionId: event.unsigned?.transaction_id,
  };
};

export const loginWithPassword = async (
  usernameOrMatrixId: string,
  password: string,
): Promise<MatrixSession> => {
  const identifier = normaliseUsername(usernameOrMatrixId);
  const client = createMatrixClient();

  const { data } = await client.post('/login', {
    type: 'm.login.password',
    identifier: {
      type: 'm.id.user',
      user: identifier,
    },
    password,
    device_id: `rn_${Date.now()}`,
  });

  return {
    accessToken: data.access_token,
    userId: data.user_id,
    deviceId: data.device_id,
    homeserver: HOMESERVER,
    nextSyncToken: null,
  };
};

export const registerAccount = async (
  username: string,
  password: string,
): Promise<MatrixSession> => {
  const client = createMatrixClient();

  try {
    const { data } = await client.post('/register?kind=user', {
      username,
      password,
      auth: {
        type: 'm.login.dummy',
      },
    });

    return {
      accessToken: data.access_token,
      userId: data.user_id,
      deviceId: data.device_id,
      homeserver: HOMESERVER,
      nextSyncToken: null,
    };
  } catch (error: any) {
    // Retry with auth session if required
    if (axios.isAxiosError(error) && error.response?.data?.session) {
      const sessionId = error.response.data.session;
      const { data } = await client.post('/register?kind=user', {
        username,
        password,
        auth: {
          type: 'm.login.dummy',
          session: sessionId,
        },
      });

      return {
        accessToken: data.access_token,
        userId: data.user_id,
        deviceId: data.device_id,
        homeserver: HOMESERVER,
        nextSyncToken: null,
      };
    }

    throw error;
  }
};

export const syncRooms = async (
  session: MatrixSession,
  since?: string | null,
): Promise<{ rooms: MatrixRoomSummary[]; nextBatch: string; leftRoomIds?: string[] } | undefined> => {
  const client = createMatrixClient(session.accessToken);

  const params: Record<string, string> = {
    timeout: '0',
    set_presence: 'offline',
  };

  if (since) {
    params.since = since;
  }

  const { data } = await client.get('/sync', { params });

  // Get global m.direct account data for direct room detection
  let globalDirectRooms: Record<string, string[]> = {};
  const globalAccountData = data.account_data?.events ?? [];
  const globalDirectEvent = globalAccountData.find((event: any) => event.type === 'm.direct');
  if (globalDirectEvent?.content) {
    globalDirectRooms = globalDirectEvent.content as Record<string, string[]>;
  }

  const buildRoomSummary = (
    roomId: string,
    roomData: any,
    membership: 'join' | 'invite',
  ): MatrixRoomSummary => {
    const stateEvents =
      membership === 'join' ? roomData.state?.events ?? [] : roomData.invite_state?.events ?? [];
    const timelineEvents = membership === 'join' ? roomData.timeline?.events ?? [] : [];
    const summary = membership === 'join' ? roomData.summary ?? {} : {};

    const nameEvent = stateEvents.find((event: any) => event.type === 'm.room.name');
    const canonicalAliasEvent = stateEvents.find(
      (event: any) => event.type === 'm.room.canonical_alias',
    );
    const topicEvent = stateEvents.find((event: any) => event.type === 'm.room.topic');
    const memberEvents = stateEvents.filter((event: any) => event.type === 'm.room.member');

    const timelineMatrixEvents = (timelineEvents as any[])
      .map((event) => mapTimelineEvent(roomId, event))
      .filter((event): event is MatrixTimelineEvent => Boolean(event))
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    const lastTimelineEvent = timelineMatrixEvents[timelineMatrixEvents.length - 1];

    const notificationCount = membership === 'join' ? summary.notification_count ?? 0 : 0;
    const highlightCount = membership === 'join' ? summary.highlight_count ?? 0 : 0;

    const myMembershipEvent = memberEvents.find(
      (event: any) => event.state_key === session.userId,
    );

    // Check if this room is direct using multiple sources
    const isDirectFromGlobal = Object.values(globalDirectRooms).some(roomList => 
      roomList.includes(roomId)
    );
    const isDirectFromSummary = membership === 'join' ? Boolean(roomData.summary?.is_direct) : false;
    const isDirectFromMembership = Boolean(
      myMembershipEvent?.content?.is_direct ??
      myMembershipEvent?.content?.['org.matrix.msc3375.is_direct']
    );
    
    const isDirect = isDirectFromGlobal || isDirectFromSummary || isDirectFromMembership;

    const resolveName = () => {
      // For direct rooms, ALWAYS prioritize showing the other person's name
      if (isDirect || membership === 'invite') {
        // Check global m.direct account data first
        const directPartner = Object.keys(globalDirectRooms).find(userId => 
          globalDirectRooms[userId]?.includes(roomId)
        );
        if (directPartner) {
          return extractDisplayName(directPartner);
        }

        // Check room-level account data
        if (membership === 'join' && roomData.account_data?.events) {
          const directEvent = roomData.account_data.events.find(
            (event: any) => event.type === 'm.direct',
          );
          if (directEvent) {
            const directContent = directEvent.content as Record<string, any>;
            const entry = Object.entries(directContent).find(([, value]) =>
              Array.isArray(value) ? value.includes(roomId) : false,
            );
            if (entry) {
              return extractDisplayName(entry[0]);
            }
          }
        }

        // Find the other member (anyone who isn't me)
        const otherMember = memberEvents.find(
          (event: any) => event.state_key && event.state_key !== session.userId,
        );
        
        if (otherMember?.state_key) {
          // Use their display name if they set one
          const displayName = String(otherMember.content?.displayname ?? '').trim();
          if (displayName) {
            return displayName;
          }
          // Otherwise use their username (extracted from Matrix ID)
          return extractDisplayName(otherMember.state_key as string);
        }
      }

      // For group rooms, use explicit room name if set
      if (nameEvent?.content?.name) {
        return nameEvent.content.name as string;
      }
      
      // Use room alias if available (strip server part)
      if (canonicalAliasEvent?.content?.alias) {
        const alias = canonicalAliasEvent.content.alias as string;
        return extractDisplayName(alias);
      }

      // For regular joined rooms with 2 members, treat as 1:1 chat
      if (membership === 'join') {
        const joinedMembers = memberEvents.filter(
          (event: any) => event.content?.membership === 'join',
        );
        
        // If only 2 people (me + 1 other), show the other person's name
        if (joinedMembers.length === 2) {
          const otherMember = joinedMembers.find(
            (event: any) => event.state_key && event.state_key !== session.userId,
          );
          if (otherMember?.state_key) {
            const displayName = String(otherMember.content?.displayname ?? '').trim();
            if (displayName) {
              return displayName;
            }
            return extractDisplayName(otherMember.state_key as string);
          }
        }

        // For group rooms, try to show member count
        if (joinedMembers.length > 2) {
          return `Group (${joinedMembers.length} members)`;
        }
      }
      
      // Last resort: show room ID
      return extractDisplayName(roomId);
    };

    // For direct chats, try to get the other person's avatar from member events
    let resolvedAvatarUrl = stateEvents.find((event: any) => event.type === 'm.room.avatar')?.content?.url;
    
    if (!resolvedAvatarUrl && isDirect) {
      // Find the other member's avatar
      const otherMember = memberEvents.find(
        (event: any) => event.state_key && event.state_key !== session.userId,
      );
      if (otherMember?.content?.avatar_url) {
        resolvedAvatarUrl = otherMember.content.avatar_url;
      }
    }

    return {
      roomId,
      membership,
      name: resolveName(),
      topic: topicEvent?.content?.topic,
      avatarUrl: resolvedAvatarUrl,
      isDirect,
      notificationCount,
      highlightCount,
      lastEvent:
        membership === 'join' && lastTimelineEvent
          ? {
              eventId: lastTimelineEvent.eventId,
              senderId: lastTimelineEvent.senderId,
              senderName: lastTimelineEvent.senderName,
              type: lastTimelineEvent.type,
              body: lastTimelineEvent.decryptedBody ?? lastTimelineEvent.body,
              timestamp: lastTimelineEvent.timestamp,
            }
          : undefined,
      timeline: membership === 'join' ? timelineMatrixEvents : [],
      inviterId: membership === 'invite' ? myMembershipEvent?.sender : undefined,
    };
  };

  const rooms: MatrixRoomSummary[] = [];

  const joinRooms = data.rooms?.join ?? {};
  console.log('Joined rooms in sync:', Object.keys(joinRooms).length);
  Object.keys(joinRooms).forEach((roomId: string) => {
    rooms.push(buildRoomSummary(roomId, joinRooms[roomId], 'join'));
  });

  const inviteRooms = data.rooms?.invite ?? {};
  console.log('Invited rooms in sync:', Object.keys(inviteRooms).length, Object.keys(inviteRooms));
  Object.keys(inviteRooms).forEach((roomId: string) => {
    rooms.push(buildRoomSummary(roomId, inviteRooms[roomId], 'invite'));
  });

  // Track left rooms so we can remove them from state
  const leaveRooms = data.rooms?.leave ?? {};
  const leftRoomIds = Object.keys(leaveRooms);
  console.log('Left rooms in sync:', leftRoomIds.length, leftRoomIds);

  return {
    rooms,
    nextBatch: data.next_batch,
    leftRoomIds,
  };
};

export const fetchRoomMessages = async (
  session: MatrixSession,
  roomId: string,
  limit = 30,
): Promise<MatrixTimelineEvent[]> => {
  const client = createMatrixClient(session.accessToken);

  const { data } = await client.get(`/rooms/${encodeURIComponent(roomId)}/messages`, {
    params: {
      dir: 'b',
      limit: String(limit),
    },
  });

  const events = data.chunk ?? [];

  return (events as any[])
    .map((event) => mapTimelineEvent(roomId, event))
    .filter((event): event is MatrixTimelineEvent => Boolean(event));
};

export const sendTextMessage = async (
  session: MatrixSession,
  roomId: string,
  body: string,
  txnIdParam?: string,
): Promise<{ eventId: string; txnId: string }> => {
  const client = createMatrixClient(session.accessToken);
  const txnId = txnIdParam ?? nanoid(16);
  const { data } = await client.put(
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    {
      msgtype: 'm.text',
      body,
    },
  );

  return {
    eventId: data?.event_id ?? txnId,
    txnId,
  };
};

export const sendImageMessage = async (
  session: MatrixSession,
  roomId: string,
  imageUri: string,
  mimeType: string,
  fileName: string,
  txnIdParam?: string,
): Promise<{ eventId: string; txnId: string }> => {
  // First, upload the image to Matrix media server
  const contentUri = await uploadAvatar(session, imageUri, mimeType, fileName);
  
  // Get image dimensions
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const size = blob.size;

  // Send the image message
  const client = createMatrixClient(session.accessToken);
  const txnId = txnIdParam ?? nanoid(16);
  const { data } = await client.put(
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    {
      msgtype: 'm.image',
      body: fileName,
      url: contentUri,
      info: {
        size,
        mimetype: mimeType,
      },
    },
  );

  return {
    eventId: data?.event_id ?? txnId,
    txnId,
  };
};

export const deleteMessage = async (
  session: MatrixSession,
  roomId: string,
  eventId: string,
  reason?: string,
): Promise<{ eventId: string }> => {
  const client = createMatrixClient(session.accessToken);
  const txnId = nanoid(16);
  
  const { data } = await client.put(
    `/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(eventId)}/${txnId}`,
    {
      reason: reason || 'Message deleted by user',
    },
  );

  return {
    eventId: data?.event_id ?? txnId,
  };
};

export const createDirectRoom = async (
  session: MatrixSession,
  partnerMatrixId: string,
): Promise<string> => {
  const client = createMatrixClient(session.accessToken);
  const partner = normaliseUsername(partnerMatrixId);
  
  console.log('Creating direct room with partner:', partner);
  
  const { data } = await client.post('/createRoom', {
    is_direct: true,
    invite: [partner],
    preset: 'private_chat',
    direct_user: partner,
  });
  
  const roomId = data.room_id;
  console.log('Created room:', roomId);
  
  // Update m.direct account data to mark this room as direct
  try {
    // Get current m.direct account data
    let currentDirectData: Record<string, string[]> = {};
    try {
      const { data: directData } = await client.get(
        `/user/${encodeURIComponent(session.userId)}/account_data/m.direct`
      );
      currentDirectData = directData ?? {};
    } catch (error) {
      // If no m.direct data exists yet, start with empty object
      if (!axios.isAxiosError(error) || error.response?.status !== 404) {
        console.warn('Failed to fetch current m.direct data:', error);
      }
    }
    
    // Add this room to the partner's direct rooms list
    if (!currentDirectData[partner]) {
      currentDirectData[partner] = [];
    }
    if (!currentDirectData[partner].includes(roomId)) {
      currentDirectData[partner].push(roomId);
    }
    
    // Update the account data
    await client.put(
      `/user/${encodeURIComponent(session.userId)}/account_data/m.direct`,
      currentDirectData
    );
  } catch (error) {
    console.warn('Failed to update m.direct account data:', error);
    // Don't fail the room creation if this fails
  }
  
  return roomId;
};

export const joinRoom = async (session: MatrixSession, roomIdOrAlias: string): Promise<string> => {
  const client = createMatrixClient(session.accessToken);
  const { data } = await client.post(`/join/${encodeURIComponent(roomIdOrAlias)}`);
  return data.room_id ?? roomIdOrAlias;
};

export const leaveRoom = async (session: MatrixSession, roomId: string) => {
  const client = createMatrixClient(session.accessToken);
  await client.post(`/rooms/${encodeURIComponent(roomId)}/leave`);
};

export const resolveMxcToHttp = (
  session: MatrixSession,
  mxcUrl?: string,
  width = 256,
  height = 256,
): string | undefined => {
  if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
    return mxcUrl;
  }
  const [, path] = mxcUrl.split('mxc://');
  return `${HOMESERVER}/_matrix/media/v3/thumbnail/${path}?width=${width}&height=${height}&method=scale&access_token=${session.accessToken}`;
};

export const updateDisplayName = async (
  session: MatrixSession,
  displayName: string,
) => {
  const client = createMatrixClient(session.accessToken);
  await client.put(`/profile/${encodeURIComponent(session.userId)}/displayname`, {
    displayname: displayName,
  });
};

export const updateAvatarUrl = async (session: MatrixSession, mxcUrl: string) => {
  const client = createMatrixClient(session.accessToken);
  await client.put(`/profile/${encodeURIComponent(session.userId)}/avatar_url`, {
    avatar_url: mxcUrl,
  });
};

export const fetchUserProfile = async (
  session: MatrixSession,
  userId: string = session.userId,
): Promise<{ displayName?: string; avatarUrl?: string }> => {
  const client = createMatrixClient(session.accessToken);
  const { data } = await client.get(`/profile/${encodeURIComponent(userId)}`);
  return {
    displayName: data?.displayname ?? undefined,
    avatarUrl: data?.avatar_url ?? undefined,
  };
};

export const uploadAvatar = async (
  session: MatrixSession,
  uri: string,
  mimeType: string,
  fileName: string,
): Promise<string> => {
  try {
    // Matrix media upload expects raw binary data
    // Use fetch to get the blob directly
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload the blob directly (Matrix standard approach)
    const uploadResponse = await axios({
      method: 'POST',
      url: `${HOMESERVER}/_matrix/media/v3/upload`,
      data: blob,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': mimeType,
      },
      params: {
        filename: fileName,
      },
      timeout: 30000,
    });

    return uploadResponse.data.content_uri;
  } catch (error: any) {
    console.error('Upload avatar v3 error:', error);
    
    // Try r0 endpoint as fallback
    if (error.response?.status === 404) {
      try {
        console.log('Trying r0 endpoint...');
        const response = await fetch(uri);
        const blob = await response.blob();

        const uploadResponse = await axios({
          method: 'POST',
          url: `${HOMESERVER}/_matrix/media/r0/upload`,
          data: blob,
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': mimeType,
          },
          params: {
            filename: fileName,
          },
          timeout: 30000,
        });
        
        return uploadResponse.data.content_uri;
      } catch (fallbackError) {
        console.error('r0 upload also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    // If it's a 415 error, try without filename parameter
    if (error.response?.status === 415) {
      try {
        console.log('Trying without filename parameter...');
        const response = await fetch(uri);
        const blob = await response.blob();

        const uploadResponse = await axios({
          method: 'POST',
          url: `${HOMESERVER}/_matrix/media/v3/upload`,
          data: blob,
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': mimeType,
          },
          timeout: 30000,
        });

        return uploadResponse.data.content_uri;
      } catch (noParamError) {
        console.error('Upload without filename also failed:', noParamError);
        throw noParamError;
      }
    }
    
    throw error;
  }
};

export const searchUsers = async (
  session: MatrixSession,
  searchTerm: string,
  limit = 20,
): Promise<Array<{ userId: string; displayName?: string }>> => {
  const client = createMatrixClient(session.accessToken);

  const { data } = await client.post('/user_directory/search', {
    search_term: searchTerm,
    limit,
  });

  return (data.results ?? []).map((result: any) => ({
    userId: result.user_id,
    displayName: result.display_name,
  }));
};

export const logout = async (session: MatrixSession) => {
  const client = createMatrixClient(session.accessToken);
  try {
    await client.post('/logout');
  } catch (error) {
    // Ignore network errors during logout to avoid trapping the user
  }
};

export const homeserverUrl = HOMESERVER;

export const deactivateAccount = async (session: MatrixSession, password: string) => {
  const client = createMatrixClient(session.accessToken);
  await client.post('/account/deactivate', {
    auth: {
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: session.userId,
      },
      user: session.userId,
      password,
    },
    erase: true,
  });
};

const RECOVERY_ACCOUNT_DATA_TYPE = 'com.matrixchat.recovery';

export const storeRecoveryKeyAccountData = async (
  session: MatrixSession,
  recoveryKeyHash: string,
) => {
  const client = createMatrixClient(session.accessToken);
  await client.put(
    `/user/${encodeURIComponent(session.userId)}/account_data/${encodeURIComponent(
      RECOVERY_ACCOUNT_DATA_TYPE,
    )}`,
    {
      recovery_key_hash: recoveryKeyHash,
      updated_at: Date.now(),
    },
  );
};

export const loadRecoveryKeyAccountData = async (
  session: MatrixSession,
): Promise<{ recovery_key_hash?: string } | null> => {
  const client = createMatrixClient(session.accessToken);
  try {
    const { data } = await client.get(
      `/user/${encodeURIComponent(session.userId)}/account_data/${encodeURIComponent(
        RECOVERY_ACCOUNT_DATA_TYPE,
      )}`,
    );
    return data ?? null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};
