import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { ProtonConnectionSummary } from '@/lib/proton-drive/proton-connect-types';

type ProtonConnectContextValue = {
  isSupported: boolean;
  session: ProtonConnectionSummary | null;
  isConnecting: boolean;
  connect: (options: {
    email: string;
    password: string;
    mailboxPassword?: string;
    totp?: string;
  }) => Promise<void>;
  disconnect: () => Promise<void>;
};

const ProtonConnectContext = createContext<ProtonConnectContextValue | undefined>(undefined);

export function ProtonConnectProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ProtonConnectionSummary | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const isSupported = Platform.OS === 'web';

  useEffect(() => {
    if (!isSupported || typeof window === 'undefined') {
      return;
    }
    void (async () => {
      try {
        const { loadPersistedTokens } = await import(
          /* @metro-ignore */ '../lib/proton-drive/session-store.web'
        );
        const tokens = await loadPersistedTokens();
        if (tokens) {
          setSession({ email: tokens.email });
        }
      } catch {
        setSession(null);
      }
    })();
  }, [isSupported]);

  const connect = useCallback(
    async (options: {
      email: string;
      password: string;
      mailboxPassword?: string;
      totp?: string;
    }) => {
      if (!isSupported) {
        throw new Error('Proton Drive is only available on web.');
      }
      setIsConnecting(true);
      try {
        const proton = await import(/* @metro-ignore */ '../lib/proton-drive/index.web');
        const active = await proton.connectProton(options);
        setSession({ email: active.email });
      } finally {
        setIsConnecting(false);
      }
    },
    [isSupported]
  );

  const disconnect = useCallback(async () => {
    if (!isSupported) {
      return;
    }
    const proton = await import(/* @metro-ignore */ '../lib/proton-drive/index.web');
    await proton.disconnectProton();
    setSession(null);
  }, [isSupported]);

  const value = useMemo(
    () => ({
      isSupported,
      session,
      isConnecting,
      connect,
      disconnect,
    }),
    [connect, disconnect, isConnecting, isSupported, session]
  );

  return (
    <ProtonConnectContext.Provider value={value}>{children}</ProtonConnectContext.Provider>
  );
}

export function useProtonConnect(): ProtonConnectContextValue {
  const context = useContext(ProtonConnectContext);
  if (!context) {
    throw new Error('useProtonConnect must be used within ProtonConnectProvider');
  }
  return context;
}
