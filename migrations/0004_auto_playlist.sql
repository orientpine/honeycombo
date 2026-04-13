-- Migration: 0004_auto_playlist
-- Adds auto-playlist support and submissions tracking for playlist auto-add feature

-- Mark auto-created playlists
ALTER TABLE user_playlists ADD COLUMN is_auto_created INTEGER DEFAULT 0;

-- Track submissions for catch-up sync (non-registered users)
CREATE TABLE IF NOT EXISTS submissions (
  article_id      TEXT PRIMARY KEY,
  submitted_by_id TEXT NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  synced_to_playlist INTEGER DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_submissions_pending
  ON submissions(submitted_by_id, synced_to_playlist);
