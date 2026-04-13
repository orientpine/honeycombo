-- Migration: 0003_must_read_items
-- Creates table for editor-managed must-read articles

CREATE TABLE IF NOT EXISTS must_read_items (
  id                    TEXT PRIMARY KEY,
  source_id             TEXT NOT NULL,
  item_type             TEXT NOT NULL CHECK(item_type IN ('curated', 'feed')),
  title_snapshot        TEXT NOT NULL,
  url_snapshot          TEXT NOT NULL,
  source_snapshot       TEXT,
  description_snapshot  TEXT,
  position              INTEGER NOT NULL,
  added_by              TEXT NOT NULL,
  added_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_must_read_position ON must_read_items(position);
CREATE UNIQUE INDEX IF NOT EXISTS uq_must_read_source ON must_read_items(source_id, item_type);
