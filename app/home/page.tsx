"use client";

import { useAuth } from "@/lib/auth";
import { PlayerBar } from "@/components/player";

export default function HomePage() {
  const { user, isPremium } = useAuth();

  return (
    <div className="flex min-h-screen flex-col py-12">
      {/* Main Content - You can build this out */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Welcome back{user?.display_name ? `, ${user.display_name}` : ""}!</h1>
        <p className="text-muted-foreground">
          Your Spotify home will appear here. Start building your UI!
        </p>
      </main>

      {/* Player Bar */}
      <PlayerBar />
    </div>
  );
}
