import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type SeedPayload = {
  words: string[];
  hash: string;
};

type FlowContextValue = {
  seedPayload: SeedPayload | null;
  setSeedPayload: (payload: SeedPayload | null) => void;
};

const FlowContext = createContext<FlowContextValue | undefined>(undefined);

type Props = {
  children: React.ReactNode;
};

export const FlowProvider = ({ children }: Props) => {
  const [seedPayload, setSeedPayloadState] = useState<SeedPayload | null>(null);

  // Add debugging for seedPayload changes
  useEffect(() => {
    console.log('FlowContext: seedPayload changed to:', seedPayload ? {
      wordsCount: seedPayload.words.length,
      hash: seedPayload.hash.substring(0, 10) + '...'
    } : null);
  }, [seedPayload]);

  const setSeedPayload = useCallback((payload: SeedPayload | null) => {
    console.log('FlowContext: setSeedPayload called with:', payload ? {
      wordsCount: payload.words.length,
      hash: payload.hash.substring(0, 10) + '...'
    } : null);
    setSeedPayloadState(payload);
  }, []);

  const value = useMemo(() => ({ seedPayload, setSeedPayload }), [seedPayload, setSeedPayload]);

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};

export const useFlow = () => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error('useFlow must be used within FlowProvider');
  }
  return context;
};
