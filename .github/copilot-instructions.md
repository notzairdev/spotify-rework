# Copilot Instructions for Spotify Rework

This document provides context for AI coding assistants working on this project.

## Project Overview

**Spotify Rework** is a custom Spotify desktop client built with:
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Backend**: Tauri 2 + Rust
- **UI Components**: shadcn/ui (Radix primitives)
- **APIs**: Spotify Web API + Web Playback SDK

## Architecture

### Frontend (Next.js)

```
app/                    # Pages using App Router
├── page.tsx           # Login screen (unauthenticated)
├── home/page.tsx      # Main app (authenticated)
├── callback/page.tsx  # OAuth callback handler
└── layout.tsx         # Root layout with providers

components/
├── ui/                # shadcn/ui components (don't modify directly)
├── auth/              # Login UI components
├── player/            # Playback controls
└── tauri/             # Tauri-specific components (titlebar)

hooks/
├── index.ts           # Export barrel
├── use-tauri-command.ts  # Query hook for Tauri commands
└── use-window.ts      # Window control hooks

lib/
├── auth/              # Authentication context and types
├── spotify/           # Spotify client and player provider
├── tauri/             # Tauri utilities and cache
├── env.ts             # Environment detection helpers
└── utils.ts           # General utilities (cn, etc.)
```

### Backend (Rust/Tauri)

```
src-tauri/src/
├── main.rs            # Tauri entry point
├── lib.rs             # Command registration
└── auth/
    ├── mod.rs         # Module exports
    ├── types.rs       # Rust types (SpotifyTokens, SpotifyUser, Session)
    ├── crypto.rs      # HWID-based encryption (AES-256-GCM)
    ├── storage.rs     # Encrypted file storage
    └── spotify.rs     # OAuth flow, token refresh, Tauri commands
```

## Key Patterns

### Tauri Communication

Always use the custom hooks for Tauri commands:

```tsx
// For queries (GET-like operations)
const { data, isLoading, error } = useTauriCommand<ResponseType>("command_name", {
  args: { key: "value" },
  cacheTTL: 60000, // Optional caching
});

// For mutations (POST/PUT/DELETE-like operations)
const { mutate, isLoading } = useTauriMutation("command_name", {
  invalidates: ["other_command"], // Invalidate cache after mutation
});
```

### Authentication

Use the `useAuth` hook for authentication state:

```tsx
const { user, isAuthenticated, isPremium, accessToken, login, logout } = useAuth();
```

### Environment Detection

```tsx
import { isTauriContext, isDev, devLog, devError } from "@/lib/env";

if (isTauriContext()) {
  // Can use Tauri APIs
}

devLog("Only logs in development"); // Silent in production
```

### Playback

```tsx
const { 
  isReady, 
  state, 
  play, 
  pause, 
  togglePlay, 
  nextTrack, 
  previousTrack,
  error,
  retry 
} = useSpotifyPlayer();
```

## Important Conventions

### File Naming
- React components: `kebab-case.tsx` (e.g., `login-card.tsx`)
- Hooks: `use-*.ts` (e.g., `use-tauri-command.ts`)
- Types: In component file or `types.ts`
- Utilities: `camelCase` functions

### Component Structure
```tsx
"use client"; // If using hooks/browser APIs

import { ... } from "react";
import { ... } from "@/components/ui/...";
import { ... } from "@/lib/...";

interface ComponentProps {
  // Props interface
}

export function Component({ ... }: ComponentProps) {
  // Hooks at top
  // Handlers
  // Return JSX
}
```

### Styling
- Use Tailwind CSS classes
- Use `cn()` from `@/lib/utils` for conditional classes
- Follow shadcn/ui patterns for component styling

### Error Handling
- Rust: Use `Result<T, String>` for Tauri commands
- TypeScript: Try/catch with proper error typing
- Always show user-friendly error messages

## Available Tauri Commands

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `get_auth_url` | None | `{ url, state }` | Generate OAuth URL |
| `exchange_code` | `{ code, state }` | `Session` | Exchange code for tokens |
| `get_session` | None | `Session \| null` | Get current session |
| `refresh_session` | None | `Session` | Refresh tokens |
| `logout` | None | `void` | Clear session |
| `get_access_token` | None | `string` | Get current access token |

## OAuth Flow

1. Frontend calls `get_auth_url` → Opens browser with Spotify OAuth
2. User authorizes → Redirected to `http://127.0.0.1:8888/callback`
3. Local Rust HTTP server captures code
4. Frontend polls or listens for completion
5. `exchange_code` exchanges code for tokens
6. Session encrypted with HWID and saved to disk

## Spotify SDK Notes

- **Web Playback SDK requires Premium** - Check `isPremium` before showing player
- **Development Mode** - Only registered users can authenticate (add in Spotify Dashboard)
- **Redirect URI** - Must be `http://127.0.0.1:8888/callback` (port 8888, not 3000)

## Adding New Features

### New Page
1. Create in `app/[route]/page.tsx`
2. Use `"use client"` if interactive
3. Wrap with auth check if needed

### New Component
1. Create in appropriate `components/` subfolder
2. Export from index if creating barrel files
3. Use shadcn/ui primitives when possible

### New Tauri Command
1. Add function in `src-tauri/src/auth/spotify.rs` (or new module)
2. Add `#[tauri::command]` attribute
3. Register in `src-tauri/src/lib.rs` invoke handler
4. Add TypeScript types in `lib/auth/types.ts`
5. Use via `useTauriCommand` or `useTauriMutation`

## Testing

Currently no test framework configured. When adding:
- Frontend: Vitest + React Testing Library
- Backend: Rust built-in tests

## Common Issues

### "Login only available in Tauri context"
- Running in browser instead of Tauri app
- Use `npm run tauri dev`, not `npm run dev`

### "Failed to initialize player"
- User doesn't have Premium
- Token expired (should auto-refresh)
- Check browser console for SDK errors

### "INVALID_REDIRECT_URL"
- Redirect URI in Spotify Dashboard doesn't match
- Must be exactly `http://127.0.0.1:8888/callback`

### CORS errors
- Next.js dev server runs on port 3000
- Tauri WebView runs on tauri://localhost
- Backend HTTP server runs on port 8888
- Check `next.config.ts` for `allowedDevOrigins`

## Resources

- [Tauri 2 Docs](https://v2.tauri.app/)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [shadcn/ui](https://ui.shadcn.com/)
