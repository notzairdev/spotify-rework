# Spotify Rework

A modern, redesigned Spotify desktop client built with **Tauri 2**, **Next.js 16**, and **TypeScript**. This project provides a custom UI experience while leveraging the official Spotify Web API and Web Playback SDK.

![Beta](https://img.shields.io/badge/status-beta-yellow)
![Tauri](https://img.shields.io/badge/Tauri-2.x-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

## Features

- **Custom UI**: Modern, clean interface inspired by Spotify but with unique design elements
- **Spotify OAuth**: Secure PKCE authentication flow with local HTTP callback server
- **HWID Encryption**: Session data encrypted using hardware-derived keys (AES-256-GCM)
- **Web Playback SDK**: Full playback control for Premium users
- **Session Persistence**: Auto-refresh tokens on app startup
- **Native Window Controls**: Custom titlebar with Tauri window management

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **Lucide React** - Icons

### Backend
- **Tauri 2** - Native desktop app framework
- **Rust** - Backend logic and security
- **AES-256-GCM** - Encryption for stored credentials

### APIs
- **Spotify Web API** - Data fetching
- **Spotify Web Playback SDK** - Audio playback (Premium required)

## Project Structure

```
spotify-rework/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Login page
│   ├── home/              # Main app after login
│   ├── callback/          # OAuth callback handler
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── auth/              # Auth-related components
│   ├── player/            # Playback components
│   └── tauri/             # Tauri-specific (titlebar, etc.)
├── hooks/                 # React hooks
│   ├── use-tauri-command.ts  # Tauri backend communication
│   └── use-window.ts      # Window controls
├── lib/
│   ├── auth/              # Authentication system
│   │   ├── provider.tsx   # AuthProvider context
│   │   └── types.ts       # Auth types
│   ├── spotify/           # Spotify integration
│   │   ├── client.ts      # API client
│   │   ├── config.ts      # Scopes and config
│   │   └── player-provider.tsx  # Playback SDK
│   ├── tauri/             # Tauri utilities
│   │   └── cache.ts       # Request caching
│   ├── env.ts             # Environment detection
│   └── utils.ts           # Helpers
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Tauri commands
│   │   └── auth/          # Auth module
│   │       ├── crypto.rs  # HWID encryption
│   │       ├── spotify.rs # OAuth flow
│   │       ├── storage.rs # Session persistence
│   │       └── types.rs   # Rust types
│   └── Cargo.toml         # Rust dependencies
└── public/                # Static assets
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)
- Spotify Developer Account

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/spotify-rework.git
cd spotify-rework
npm install
```

### 2. Configure Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add Redirect URI: `http://127.0.0.1:8888/callback`
4. Note your **Client ID** and **Client Secret**

### 3. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 4. Run Development

```bash
npm run tauri dev
```

## Authentication Flow

1. **App Start** → Check for stored session in `~/.local/share/spotify-rework/auth.enc`
2. **No Session** → Show login page
3. **Login Click** → Generate PKCE challenge, open Spotify OAuth in browser
4. **User Authorizes** → Spotify redirects to `http://127.0.0.1:8888/callback`
5. **Local Server** → Captures code, exchanges for tokens
6. **Session Stored** → Encrypted with HWID, saved to disk
7. **Redirect** → User sent to `/home`

On subsequent launches:
- Session loaded from encrypted file
- Tokens refreshed if expired
- Direct redirect to `/home`

## Tauri Commands

Available commands (invokable from frontend):

| Command | Description |
|---------|-------------|
| `get_auth_url` | Generate Spotify OAuth URL |
| `exchange_code` | Exchange auth code for tokens |
| `get_session` | Get current session |
| `refresh_session` | Refresh access token |
| `logout` | Clear stored session |
| `get_access_token` | Get current access token |

## Hooks

### `useTauriCommand`

```tsx
const { data, isLoading, error } = useTauriCommand<Track[]>("get_tracks", {
  args: { playlistId: "123" },
  cacheTTL: 60000, // Cache for 1 minute
});
```

### `useTauriMutation`

```tsx
const { mutate, isLoading } = useTauriMutation("save_track", {
  invalidates: ["get_tracks"], // Invalidate cache after mutation
});

// Usage
await mutate({ trackId: "abc" });
```

### `useAuth`

```tsx
const { 
  user, 
  isAuthenticated, 
  isPremium, 
  accessToken,
  login,
  logout 
} = useAuth();
```

### `useSpotifyPlayer`

```tsx
const { 
  isReady,
  state,
  play,
  pause,
  nextTrack,
  previousTrack 
} = useSpotifyPlayer();
```

## Development Notes

### Spotify Premium

Web Playback SDK requires Spotify Premium. Free users will see an error but can still browse the app.

### Development Mode Restriction

In Spotify's development mode, only registered users can authenticate. Add test users in Dashboard → Settings → User Management.

### HWID Encryption

Session data is encrypted using a key derived from:
- Machine ID (`/etc/machine-id` on Linux)
- CPU info
- OS details

This prevents session files from being copied between machines.

## Building for Production

```bash
npm run tauri build
```

Output binaries will be in `src-tauri/target/release/`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See [LICENSE](LICENSE) for details.

## Disclaimer

This is an unofficial project and is not affiliated with, endorsed by, or connected to Spotify AB. Use at your own risk.
