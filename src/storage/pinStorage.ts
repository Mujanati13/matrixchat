import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const PIN_RECORD_KEY = 'matrixchat/pin_record';
const PIN_ATTEMPTS_KEY = 'matrixchat/pin_attempts';
const MAX_ATTEMPTS = 4;

type PinRecord = {
  encryptedPin: string;
  key: string;
  iv: string;
};

export const getAttemptsRemaining = async (): Promise<number> => {
  const value = await AsyncStorage.getItem(PIN_ATTEMPTS_KEY);
  if (!value) {
    await AsyncStorage.setItem(PIN_ATTEMPTS_KEY, String(MAX_ATTEMPTS));
    return MAX_ATTEMPTS;
  }
  return Number(value);
};

export const hasPin = async (): Promise<boolean> => {
  const record = await AsyncStorage.getItem(PIN_RECORD_KEY);
  return Boolean(record);
};

const persistAttempts = (attempts: number) =>
  AsyncStorage.setItem(PIN_ATTEMPTS_KEY, String(Math.max(0, attempts)));

const encryptPin = (pin: string) => {
  const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);

  const encrypted = CryptoJS.AES.encrypt(pin, CryptoJS.enc.Hex.parse(key), {
    iv: CryptoJS.enc.Hex.parse(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    encryptedPin: encrypted.toString(),
    key,
    iv,
  } satisfies PinRecord;
};

const decryptPin = (record: PinRecord) => {
  const decrypted = CryptoJS.AES.decrypt(record.encryptedPin, CryptoJS.enc.Hex.parse(record.key), {
    iv: CryptoJS.enc.Hex.parse(record.iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
};

export const savePin = async (pin: string) => {
  const record = encryptPin(pin);
  await AsyncStorage.multiSet([
    [PIN_RECORD_KEY, JSON.stringify(record)],
    [PIN_ATTEMPTS_KEY, String(MAX_ATTEMPTS)],
  ]);
};

export const verifyPin = async (
  pin: string,
): Promise<{ valid: boolean; attemptsRemaining: number }> => {
  const stored = await AsyncStorage.getItem(PIN_RECORD_KEY);
  if (!stored) {
    return { valid: false, attemptsRemaining: MAX_ATTEMPTS };
  }

  const record: PinRecord = JSON.parse(stored);
  const attempts = await getAttemptsRemaining();

  if (attempts <= 0) {
    return { valid: false, attemptsRemaining: 0 };
  }

  const decrypted = decryptPin(record);
  if (decrypted === pin) {
    await persistAttempts(MAX_ATTEMPTS);
    return { valid: true, attemptsRemaining: MAX_ATTEMPTS };
  }

  const remaining = attempts - 1;
  await persistAttempts(remaining);
  return { valid: false, attemptsRemaining: remaining };
};

export const clearPin = async () => {
  await AsyncStorage.multiRemove([PIN_RECORD_KEY, PIN_ATTEMPTS_KEY]);
};
