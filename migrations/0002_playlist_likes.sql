-- Migration: 0002_playlist_likes
-- Adds like system for playlists (trending/popularity ranking)

CREATE TABLE IF NOT EXISTS playlist_likes (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, playlist_id)
);

-- Fast COUNT(*) aggregation per playlist (trending ranking query)
CREATE INDEX IF NOT EXISTS idx_playlist_likes_playlist_id ON playlist_likes(playlist_id);

-- Fast lookup of user's liked playlists
CREATE INDEX IF NOT EXISTS idx_playlist_likes_user_id ON playlist_likes(user_id);
