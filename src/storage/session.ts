import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MatrixSession } from '@app-types/matrix';

const STORAGE_KEY = 'matrixchat/session';

export const persistSession = async (session: MatrixSession) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const loadSession = async (): Promise<MatrixSession | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session: MatrixSession = JSON.parse(raw);
    return session;
  } catch (error) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearSession = async () => AsyncStorage.removeItem(STORAGE_KEY);
