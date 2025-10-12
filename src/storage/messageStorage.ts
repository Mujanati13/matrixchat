import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MatrixTimelineEvent } from '@app-types/matrix';

const STORAGE_PREFIX = '@matrixchat/messages';

const makeKey = (userId: string, roomId: string) =>
  `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(roomId)}`;

const parseRoomIdFromKey = (key: string, userId: string) => {
  const prefix = `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:`;
  const rawRoomId = key.slice(prefix.length);
  try {
    return decodeURIComponent(rawRoomId);
  } catch (error) {
    console.warn('Failed to decode room id from storage key', key, error);
    return rawRoomId;
  }
};

const serialiseEvents = (events: MatrixTimelineEvent[]) =>
  JSON.stringify({ events });

const deserialiseEvents = (payload: string | null): MatrixTimelineEvent[] => {
  if (!payload) {
    return [];
  }
  try {
    const parsed = JSON.parse(payload);
    if (!parsed?.events || !Array.isArray(parsed.events)) {
      return [];
    }
    return parsed.events.map((event: MatrixTimelineEvent) => ({
      ...event,
      timestamp: typeof event.timestamp === 'number' ? event.timestamp : Number(event.timestamp ?? Date.now()),
    }));
  } catch (error) {
    console.warn('Failed to parse stored room events', error);
    return [];
  }
};

export const loadAllRoomMessages = async (
  userId: string,
): Promise<Record<string, MatrixTimelineEvent[]>> => {
  try {
    const prefix = `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:`;
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter((key) => key.startsWith(prefix));
    if (userKeys.length === 0) {
      return {};
    }

    const entries = await AsyncStorage.multiGet(userKeys);
    const result: Record<string, MatrixTimelineEvent[]> = {};
    entries.forEach(([key, value]) => {
      if (!key) {
        return;
      }
      const roomId = parseRoomIdFromKey(key, userId);
      result[roomId] = deserialiseEvents(value);
    });
    return result;
  } catch (error) {
    console.warn('Failed to load room messages from storage', error);
    return {};
  }
};

export const saveRoomMessages = async (
  userId: string,
  roomId: string,
  events: MatrixTimelineEvent[],
) => {
  try {
    if (!events.length) {
      await AsyncStorage.removeItem(makeKey(userId, roomId));
      return;
    }
    await AsyncStorage.setItem(makeKey(userId, roomId), serialiseEvents(events));
  } catch (error) {
    console.warn('Failed to persist room messages', { roomId, error });
  }
};

export const removeRoomMessages = async (userId: string, roomId: string) => {
  try {
    await AsyncStorage.removeItem(makeKey(userId, roomId));
  } catch (error) {
    console.warn('Failed to remove stored room messages', { roomId, error });
  }
};

export const clearAllRoomMessages = async (userId: string) => {
  try {
    const prefix = `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:`;
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter((key) => key.startsWith(prefix));
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }
  } catch (error) {
    console.warn('Failed to clear stored room messages', error);
  }
};
