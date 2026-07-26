"use client";

import { FC, ReactNode } from 'react';
import { ThemeProvider } from './theme-provider';
import { AuthProvider } from '@/lib/auth';
import { SpotifyPlayerProvider } from '@/lib/spotify';
import { LyricsProvider } from '@/lib/lrclib';
import { FullscreenProvider } from '@/lib/fullscreen';
import { AppGate } from '@/components/app-gate';
import { ContextMenuBlocker } from '@/components/context-menu-blocker';
import { TooltipProvider } from '../ui/tooltip';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme='dark'>
      <ContextMenuBlocker />
      <AuthProvider>
        <FullscreenProvider>
          <SpotifyPlayerProvider>
            <LyricsProvider>
              <TooltipProvider>
                <AppGate>
                  {children}
                </AppGate>
              </TooltipProvider>
            </LyricsProvider>
          </SpotifyPlayerProvider>
        </FullscreenProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}