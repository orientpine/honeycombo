import type { MustReadItemRow } from './types';

// ---------------------------------------------------------------------------
// Must-read items — D1 CRUD operations
// ---------------------------------------------------------------------------

export async function listMustReadItems(db: D1Database): Promise<MustReadItemRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM must_read_items ORDER BY position ASC')
    .all<MustReadItemRow>();
  return results;
}

export async function addMustReadItem(
  db: D1Database,
  item: Omit<MustReadItemRow, 'added_at'>,
): Promise<MustReadItemRow> {
  const row = await db
    .prepare(
      `INSERT INTO must_read_items (id, source_id, item_type, title_snapshot, url_snapshot, source_snapshot, description_snapshot, position, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .bind(
      item.id,
      item.source_id,
      item.item_type,
      item.title_snapshot,
      item.url_snapshot,
      item.source_snapshot,
      item.description_snapshot,
      item.position,
      item.added_by,
    )
    .first<MustReadItemRow>();

  if (!row) {
    throw new Error('Failed to insert must-read item');
  }
  return row;
}

export async function deleteMustReadItem(db: D1Database, id: string): Promise<boolean> {
  const info = await db.prepare('DELETE FROM must_read_items WHERE id = ?').bind(id).run();
  return (info.meta.changes ?? 0) > 0;
}

export async function getNextPosition(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM must_read_items')
    .first<{ next_pos: number }>();
  return row?.next_pos ?? 0;
}

export async function reorderMustReadItems(db: D1Database, ids: string[]): Promise<void> {
  const stmts = ids.map((id, idx) =>
    db.prepare('UPDATE must_read_items SET position = ? WHERE id = ?').bind(idx, id),
  );
  await db.batch(stmts);
}
