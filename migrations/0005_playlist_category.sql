-- Migration 0005: Add playlist_category column for auto-created playlists
-- Distinguishes different auto-playlist types:
--   'read_later'  — Bookmarks (나중에 볼 기사), created on first bookmark click
--   'submissions' — Auto-playlist for approved submissions (내 제출 기사, legacy)
--   NULL          — User-created playlists (community/editor)

ALTER TABLE user_playlists ADD COLUMN playlist_category TEXT;

-- Backfill: existing is_auto_created=1 playlists are 'submissions' type
UPDATE user_playlists SET playlist_category = 'submissions' WHERE is_auto_created = 1;

-- Enforce uniqueness: at most one playlist per (user_id, category) when category is set.
-- Partial unique index so multiple user-created playlists (NULL category) remain allowed.
-- Prevents race conditions during lazy creation of 'read_later' playlists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_playlist_category
  ON user_playlists(user_id, playlist_category)
  WHERE playlist_category IS NOT NULL;
