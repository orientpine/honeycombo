import type { Env } from './types';

export function isAdmin(env: Env, userId: string): boolean {
  const adminIds = (env.ADMIN_GITHUB_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  return adminIds.includes(userId);
}
