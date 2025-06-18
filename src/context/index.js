'use client';

import { appId, clientId, megaeth } from '@/config';

import React, { createContext, useContext, useState, useEffect } from 'react';

import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/wagmi-config';

if (!appId) throw new Error('App ID is not defined');

export function ContextProvider({ children }) {
  const [themeMode, setThemeMode] = useState('light');
  const queryClient = new QueryClient();

  return (
    <PrivyProvider
      appId={appId}
      config={
        {
          // Create embedded wallets for users who don't have a wallet
          defaultChain: megaeth, // Use the first network as default
          supportedChains: [megaeth],
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'all-users', // Create embedded wallets for all users
            }
          },
          
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>      
    </PrivyProvider>
  );
}
