import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearPin, getAttemptsRemaining, hasPin as hasStoredPin, savePin, verifyPin } from '@storage/pinStorage';

const MAX_ATTEMPTS = 4;

type PinContextValue = {
  ready: boolean;
  hasPin: boolean;
  attemptsRemaining: number;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<{ valid: boolean; attemptsRemaining: number }>;
  resetPin: () => Promise<void>;
};

const PinContext = createContext<PinContextValue | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

export const PinProvider = ({ children }: Props) => {
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);

  useEffect(() => {
    (async () => {
      const [storedHasPin, attempts] = await Promise.all([hasStoredPin(), getAttemptsRemaining()]);
      setHasPin(storedHasPin);
      setAttemptsRemaining(attempts);
      setReady(true);
    })();
  }, []);

  const setPinInternal = useCallback(async (pin: string) => {
    await savePin(pin);
    setHasPin(true);
    setAttemptsRemaining(MAX_ATTEMPTS);
  }, []);

  const verifyPinInternal = useCallback(async (pin: string) => {
    const result = await verifyPin(pin);
    setAttemptsRemaining(result.attemptsRemaining);
    if (result.valid) {
      setHasPin(true);
    } else if (result.attemptsRemaining <= 0) {
      await clearPin();
      setHasPin(false);
    }
    return result;
  }, []);

  const resetPin = useCallback(async () => {
    await clearPin();
    setHasPin(false);
    setAttemptsRemaining(MAX_ATTEMPTS);
  }, []);

  const value = useMemo(
    () => ({ ready, hasPin, attemptsRemaining, setPin: setPinInternal, verifyPin: verifyPinInternal, resetPin }),
    [ready, hasPin, attemptsRemaining, setPinInternal, verifyPinInternal, resetPin],
  );

  return <PinContext.Provider value={value}>{children}</PinContext.Provider>;
};

export const usePin = () => {
  const context = useContext(PinContext);
  if (!context) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
};
