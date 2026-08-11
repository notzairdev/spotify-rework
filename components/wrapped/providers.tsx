"use client";

import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { SpotifyPlayerProvider } from '@/lib/spotify';
import { LyricsProvider } from '@/lib/lrclib';
import { FullscreenProvider } from '@/lib/fullscreen';
import { AppGate } from '@/components/app-gate';
import { ContextMenuBlocker } from '@/components/context-menu-blocker';
import { TooltipProvider } from '../ui/tooltip';
import { UpdateProvider } from '@/lib/tauri/updater';
import { AppSettingsProvider } from '@/lib/settings';
import { Toaster } from '@/components/ui/sonner';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  const pathname = usePathname();

  if (pathname === "/island") {
    return <>{children}</>;
  }

  return (
    <AppSettingsProvider>
      <ContextMenuBlocker />
      <UpdateProvider>
        <AuthProvider>
          <FullscreenProvider>
            <SpotifyPlayerProvider>
              <LyricsProvider>
                <TooltipProvider>
                  <AppGate>
                    {children}
                  </AppGate>
                  <Toaster position="bottom-right" />
                </TooltipProvider>
              </LyricsProvider>
            </SpotifyPlayerProvider>
          </FullscreenProvider>
        </AuthProvider>
      </UpdateProvider>
    </AppSettingsProvider>
  );
}
