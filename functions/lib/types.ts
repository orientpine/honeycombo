/**
 * Shared types for user playlist feature
 * Used across Pages Functions (API + SSR)
 */

// ---------------------------------------------------------------------------
// Cloudflare env bindings
// ---------------------------------------------------------------------------
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Existing Decap CMS OAuth (unchanged)
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  // User-auth OAuth (optional — falls back to Decap CMS credentials above)
  USER_GITHUB_CLIENT_ID?: string;
  USER_GITHUB_CLIENT_SECRET?: string;
  USER_GITHUB_REDIRECT_URI?: string;
  // Admin
  ADMIN_GITHUB_IDS: string; // comma-separated GitHub user IDs
  ALLOWED_ORIGIN?: string;
}

// ---------------------------------------------------------------------------
// D1 row types (match migration schema exactly)
// ---------------------------------------------------------------------------
export interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface PlaylistRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  visibility: 'unlisted' | 'public';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export type UserPlaylistWithCount = PlaylistRow & { item_count: number };

export interface PlaylistItemRow {
  id: string;
  playlist_id: string;
  item_type: 'curated' | 'feed' | 'external';
  source_id: string | null;
  external_url: string | null;
  title_snapshot: string;
  url_snapshot: string;
  description_snapshot: string | null;
  note: string | null;
  position: number;
  added_at: string;
}

// ---------------------------------------------------------------------------
// API input DTOs
// ---------------------------------------------------------------------------
export interface CreatePlaylistInput {
  title: string;
  description?: string;
  visibility?: 'unlisted' | 'public';
}

export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
}

export interface AddItemInput {
  item_type: 'curated' | 'feed' | 'external';
  source_id?: string;
  external_url?: string;
  title_snapshot: string;
  url_snapshot: string;
  description_snapshot?: string;
  note?: string;
}

export interface UpdateItemInput {
  note?: string;
  position?: number;
}

// ---------------------------------------------------------------------------
// API response DTOs
// ---------------------------------------------------------------------------
export interface PlaylistDetail {
  id: string;
  title: string;
  description: string | null;
  visibility: 'unlisted' | 'public';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  items: PlaylistItemRow[];
}

export interface PlaylistListResponse {
  playlists: (PlaylistRow & {
    user: Pick<UserRow, 'username' | 'display_name' | 'avatar_url'>;
    item_count: number;
  })[];
  total: number;
  page: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Pages Function context data (set by middleware)
// ---------------------------------------------------------------------------
export interface ContextData {
  user: UserRow | null;
}

// Re-export PagesFunction with our Env
export type AppPagesFunction = PagesFunction<Env, string, ContextData>;
