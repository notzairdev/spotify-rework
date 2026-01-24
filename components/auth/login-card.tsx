"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ENV } from "@/lib/env";

export function LoginCard() {
  const router = useRouter();
  const { login, isLoading, error, isAuthenticated, user } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      await login();
      // Login successful - redirect to home
      router.push("/home");
    } catch (err) {
      setIsLoggingIn(false);
      setLoginError(err instanceof Error ? err.message : "Login failed. Please try again.");
    }
  };

  const handleRetry = () => {
    setLoginError(null);
    setIsLoggingIn(false);
  };

  // Fullscreen spinner while logging in (auth window is open)
  if (isLoggingIn && !loginError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
        <Spinner className="h-12 w-12 text-[#1DB954]" />
        <p className="text-lg text-muted-foreground">Connecting to Spotify...</p>
        <p className="text-sm text-muted-foreground/60">Complete authentication in your browser</p>
      </div>
    );
  }

  // Fullscreen error with retry
  if (loginError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
          <XIcon className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Connection Failed</h2>
          <p className="mt-2 text-muted-foreground">{loginError}</p>
        </div>
        <Button onClick={handleRetry} variant="outline" size="lg">
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Spinner className="h-8 w-8" />
            <p className="text-muted-foreground">Loading session...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAuthenticated && user) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back!</CardTitle>
          <CardDescription>
            Logged in as {user.display_name || user.email || user.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {user.images[0] && (
            <img
              src={user.images[0].url}
              alt="Profile"
              className="h-20 w-20 rounded-full"
            />
          )}
          <p className="text-sm text-muted-foreground">
            {user.product === "premium" ? "Premium Account" : "Free Account"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Connect to Spotify</CardTitle>
        <CardDescription>
          Sign in with your Spotify account to start listening
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error.message}
          </div>
        )}

        <Button
          size="lg"
          className="w-full gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-white"
          onClick={handleLogin}
          disabled={isLoading || isLoggingIn}
        >
          <SpotifyIcon className="h-5 w-5" />
          Login with Spotify
        </Button>

        {!ENV.isTauri && (
          <p className="text-center text-xs text-muted-foreground">
            Login is only available in the desktop app
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
