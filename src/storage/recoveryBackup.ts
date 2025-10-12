import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_RECOVERY_KEY = 'matrixchat/recovery_pending';

export type PendingRecoveryBackup = {
  userId: string;
  recoveryKeyHash: string;
};

export const savePendingRecoveryBackup = async (payload: PendingRecoveryBackup) => {
  await AsyncStorage.setItem(PENDING_RECOVERY_KEY, JSON.stringify(payload));
};

export const clearPendingRecoveryBackup = async () => {
  await AsyncStorage.removeItem(PENDING_RECOVERY_KEY);
};

export const loadPendingRecoveryBackup = async (): Promise<PendingRecoveryBackup | null> => {
  const raw = await AsyncStorage.getItem(PENDING_RECOVERY_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingRecoveryBackup;
    if (!parsed?.userId || !parsed?.recoveryKeyHash) {
      await AsyncStorage.removeItem(PENDING_RECOVERY_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    await AsyncStorage.removeItem(PENDING_RECOVERY_KEY);
    return null;
  }
};
