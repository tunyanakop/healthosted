import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_MIME = Object.keys(MIME_EXT);

export function isAllowedMime(mime: string): boolean {
  return mime in MIME_EXT;
}

/** Имя только для отображения и заголовка скачивания; на диск не попадает. */
export function displayName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()а-яА-ЯёЁ]/g, "_").trim();
  return (base || "file").slice(0, 160);
}

function uploadsRoot(): string {
  return path.join(env.dataDir, "uploads");
}

export type StoredFile = {
  storedPath: string;
  sha256: string;
  size: number;
  mime: string;
};

export async function saveUpload(
  buffer: Buffer,
  mime: string,
  userId: string,
): Promise<StoredFile> {
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error("unsupported mime");

  const rel = path.posix.join(userId, `${randomUUID()}.${ext}`);
  const abs = path.join(uploadsRoot(), rel);

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer, { mode: 0o600 });

  return {
    storedPath: rel,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    size: buffer.length,
    mime,
  };
}

export function absolutePath(storedPath: string): string {
  // storedPath формируется только нами: "<userId>/<uuid>.<ext>"
  const abs = path.resolve(uploadsRoot(), storedPath);
  if (!abs.startsWith(path.resolve(uploadsRoot()) + path.sep)) {
    throw new Error("invalid storage path");
  }
  return abs;
}

export async function deleteUpload(storedPath: string): Promise<void> {
  try {
    await unlink(absolutePath(storedPath));
  } catch {
    // файла нет — не ошибка
  }
}
