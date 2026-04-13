-- Migration: 0002_playlist_type
-- Adds playlist_type and tags columns to user_playlists
-- playlist_type: 'community' (default, user-created) or 'editor' (admin-curated)
-- tags: JSON array stored as TEXT (e.g. '["AI","LLM"]')

ALTER TABLE user_playlists ADD COLUMN playlist_type TEXT NOT NULL DEFAULT 'community' CHECK(playlist_type IN ('community', 'editor'));
ALTER TABLE user_playlists ADD COLUMN tags TEXT;

CREATE INDEX IF NOT EXISTS idx_user_playlists_playlist_type ON user_playlists(playlist_type);
