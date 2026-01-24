"use client";

import { FC, ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/auth';
import { SpotifyPlayerProvider } from '@/lib/spotify';
import { AppGate } from '@/components/app-gate';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme='dark' disableTransitionOnChange>
      <AuthProvider>
        <SpotifyPlayerProvider>
          <AppGate>
            {children}
          </AppGate>
        </SpotifyPlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}