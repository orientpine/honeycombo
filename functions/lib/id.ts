import { nanoid } from 'nanoid';

export function generateId(len = 12): string {
  return nanoid(len);
}
