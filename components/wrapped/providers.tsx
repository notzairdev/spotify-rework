"use client";

import { FC, ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/auth';
import { SpotifyPlayerProvider } from '@/lib/spotify';
import { LyricsProvider } from '@/lib/lrclib';
import { FullscreenProvider } from '@/lib/fullscreen';
import { AppGate } from '@/components/app-gate';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme='dark'>
      <AuthProvider>
        <FullscreenProvider>
          <SpotifyPlayerProvider>
            <LyricsProvider>
              <AppGate>
                {children}
              </AppGate>
            </LyricsProvider>
          </SpotifyPlayerProvider>
        </FullscreenProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}