// Session video files (server only). Stored outside the web root so they are
// only reachable through the access-checked /api/sessions/[id]/video route.
// Default: ./storage/session-videos (git-ignored); set VIDEO_STORAGE_DIR for a
// mounted volume in production.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const VIDEO_MAX_CHUNK_BYTES = 20 * 1024 * 1024;
export const VIDEO_MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export const VIDEO_MIME_TYPES: Record<string, string> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

export function storageDir(): string {
  // Runtime data directory: excluded from build tracing (see next.config.ts)
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.VIDEO_STORAGE_DIR || 'storage/session-videos');
}

/** Absolute path for a storage key; rejects anything that could escape the directory */
export function videoPath(storageKey: string): string {
  if (!/^[a-z0-9]+\.(webm|mp4)$/i.test(storageKey)) throw new Error('Invalid storage key');
  return path.join(/* turbopackIgnore: true */ storageDir(), storageKey);
}

/** "video/webm;codecs=vp9" → "video/webm" when supported */
export function baseMimeType(contentType: string | null): string | null {
  const base = contentType?.split(';')[0].trim().toLowerCase() ?? '';
  return base in VIDEO_MIME_TYPES ? base : null;
}

export async function appendChunk(storageKey: string, data: Uint8Array, truncate: boolean): Promise<void> {
  await fs.mkdir(storageDir(), { recursive: true });
  const file = videoPath(storageKey);
  if (truncate) await fs.writeFile(file, data);
  else await fs.appendFile(file, data);
}
