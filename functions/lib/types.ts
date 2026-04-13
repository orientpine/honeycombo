/**
 * Shared types for user playlist feature (incl. likes & trending)
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
  WEBHOOK_SECRET?: string;
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
  playlist_type: 'community' | 'editor';
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionRow {
  article_id: string;
  submitted_by_id: string;
  title: string;
  url: string;
  synced_to_playlist: number;
  created_at: string;
}

export type UserPlaylistWithCount = PlaylistRow & { item_count: number; contains_item?: boolean };

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

export interface PlaylistLikeRow {
  user_id: string;
  playlist_id: string;
  created_at: string;
}

export interface MustReadItemRow {
  id: string;
  source_id: string;
  item_type: 'curated' | 'feed';
  title_snapshot: string;
  url_snapshot: string;
  source_snapshot: string | null;
  description_snapshot: string | null;
  position: number;
  added_by: string;
  added_at: string;
}

// ---------------------------------------------------------------------------
// API input DTOs
// ---------------------------------------------------------------------------
export interface CreatePlaylistInput {
  title: string;
  description?: string;
  visibility?: 'unlisted' | 'public';
  playlist_type?: 'community' | 'editor';
  tags?: string[];
}

export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
  tags?: string[];
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
  playlist_type: 'community' | 'editor';
  tags: string[];
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

export interface LikeStatusResponse {
  liked: boolean;
  like_count: number;
}

export interface TrendingPlaylistItem {
  id: string;
  title: string;
  description: string | null;
  visibility: 'unlisted' | 'public';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  playlist_type: 'community' | 'editor';
  tags: string[];
  created_at: string;
  updated_at: string;
  user: Pick<UserRow, 'username' | 'display_name' | 'avatar_url'>;
  item_count: number;
  like_count: number;
  user_liked: boolean;
}

export interface TrendingPlaylistsResponse {
  playlists: TrendingPlaylistItem[];
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
