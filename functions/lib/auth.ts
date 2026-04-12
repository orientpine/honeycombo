import { generateId } from './id';
import type { UserRow } from './types';

type UpsertUserInput = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function upsertUser(db: D1Database, user: UpsertUserInput): Promise<UserRow> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, username, display_name, avatar_url)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url
       RETURNING id, username, display_name, avatar_url, created_at`,
    )
    .bind(user.id, user.username, user.display_name, user.avatar_url)
    .first<UserRow>();

  if (!row) {
    throw new Error('Failed to upsert user');
  }

  return row;
}

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionId, userId, expiresAt.toISOString())
    .run();

  return { sessionId, expiresAt };
}

export async function getSession(db: D1Database, sessionId: string): Promise<UserRow | null> {
  return db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.created_at
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = ?
         AND s.expires_at > CURRENT_TIMESTAMP`,
    )
    .bind(sessionId)
    .first<UserRow>();
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function cleanExpiredSessions(db: D1Database): Promise<number> {
  const result = await db.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();

  return result.meta.changes;
}
