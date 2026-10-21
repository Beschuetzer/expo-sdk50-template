import { createContext, useContext, type ReactNode } from 'react';

import { useOAuth2AuthState } from './hooks/useOAuth2Auth';

export type OAuth2AuthContextValue = ReturnType<typeof useOAuth2AuthState>;

const OAuth2AuthContext = createContext<OAuth2AuthContextValue | null>(null);

export function OAuth2AuthProvider({ children }: { children: ReactNode }) {
  const value = useOAuth2AuthState();

  return (
    <OAuth2AuthContext.Provider value={value}>
      {children}
    </OAuth2AuthContext.Provider>
  );
}

export function useOAuth2Auth() {
  const context = useContext(OAuth2AuthContext);
  if (!context) {
    throw new Error('useOAuth2Auth must be used inside OAuth2AuthProvider.');
  }
  return context;
}
