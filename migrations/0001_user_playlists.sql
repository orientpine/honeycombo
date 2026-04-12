-- Migration: 0001_user_playlists
-- Creates tables for user playlist sharing feature

-- Users (authenticated via GitHub OAuth)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (httpOnly cookie-based)
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- User playlists
CREATE TABLE IF NOT EXISTS user_playlists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  visibility  TEXT NOT NULL DEFAULT 'unlisted' CHECK(visibility IN ('unlisted', 'public')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending', 'approved', 'rejected')),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_playlists_user_id ON user_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_playlists_visibility_status ON user_playlists(visibility, status);

-- Playlist items
CREATE TABLE IF NOT EXISTS playlist_items (
  id                    TEXT PRIMARY KEY,
  playlist_id           TEXT NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
  item_type             TEXT NOT NULL CHECK(item_type IN ('curated', 'feed', 'external')),
  source_id             TEXT,
  external_url          TEXT,
  title_snapshot        TEXT NOT NULL,
  url_snapshot          TEXT NOT NULL,
  description_snapshot  TEXT,
  note                  TEXT,
  position              INTEGER NOT NULL,
  added_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_playlist_item UNIQUE(playlist_id, item_type, COALESCE(source_id, external_url)),
  CONSTRAINT chk_source CHECK(
    (item_type IN ('curated', 'feed') AND source_id IS NOT NULL) OR
    (item_type = 'external' AND external_url IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
