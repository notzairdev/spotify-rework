/**
 * Auth types for frontend
 */

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email: string | null;
  images: SpotifyImage[];
  product: string | null;
  country: string | null;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface AuthSession {
  user: SpotifyUser;
  access_token: string;
  expires_at: string;
  is_premium: boolean;
}

export interface AuthContextValue {
  /** Current auth session */
  session: AuthSession | null;
  /** Whether auth state is being loaded */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user has Spotify Premium */
  isPremium: boolean;
  /** Current user */
  user: SpotifyUser | null;
  /** Access token for Playback SDK */
  accessToken: string | null;
  /** Error if auth failed */
  error: Error | null;
  /** Start login flow */
  login: () => Promise<void>;
  /** Logout and clear credentials */
  logout: () => Promise<void>;
  /** Manually refresh the token */
  refreshToken: () => Promise<void>;
}
