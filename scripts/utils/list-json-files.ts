import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { extname, join } from 'path';

export async function listJsonFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }

  try {
    const files: string[] = [];
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.json') {
        continue;
      }

      const parentPath = 'parentPath' in entry ? entry.parentPath : undefined;
      const basePath = typeof parentPath === 'string' ? parentPath : dir;
      files.push(join(basePath, entry.name));
    }

    return files;
  } catch {
    return [];
  }
}
