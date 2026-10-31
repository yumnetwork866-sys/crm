import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const KNOWN_FOLDERS = ['chat', 'products', 'ai'];

export const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  aac: 'audio/aac',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

export function mimeFromExtension(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}

export function extensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  const direct = Object.entries(EXT_TO_MIME).find(([, mime]) => mime === lower);
  if (direct) return direct[0];
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('mpeg')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('aac')) return 'aac';
  return 'jpg';
}

export function publicFileUrl(folder: string, filename: string): string {
  return folder ? `/uploads/${folder}/${filename}` : `/uploads/${filename}`;
}

export function parseUploadsUrl(url: string): { folder: string; filename: string } | null {
  const match = url.match(/^\/uploads\/(?:([^/]+)\/)?([^/]+)$/);
  if (!match) return null;
  if (match[1]) {
    if (!KNOWN_FOLDERS.includes(match[1])) return null;
    return { folder: match[1], filename: match[2] };
  }
  return { folder: '', filename: match[2] };
}

export async function resolveUploadsFile(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  const parsed = parseUploadsUrl(url);
  if (!parsed) return null;

  const fromDb = await getUploadedFile(parsed.folder, parsed.filename);
  if (fromDb) {
    return { buffer: fromDb.buffer, mimeType: fromDb.mimeType, filename: parsed.filename };
  }

  // Fallback cho file cũ chưa được import vào database
  const diskPath = path.resolve(process.cwd(), 'public', url.replace(/^\//, ''));
  try {
    if (fs.existsSync(diskPath)) {
      const buffer = await fs.promises.readFile(diskPath);
      const ext = path.extname(diskPath).toLowerCase().replace('.', '');
      return { buffer, mimeType: mimeFromExtension(ext), filename: parsed.filename };
    }
  } catch {
    // Ignore disk read errors
  }
  return null;
}

export async function saveUploadedFile(
  folder: string,
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<void> {
  try {
    await prisma.uploadedFile.upsert({
      where: { folder_filename: { folder, filename } },
      create: { folder, filename, mimeType, size: buffer.length, data: buffer },
      update: { mimeType, size: buffer.length, data: buffer },
    });
  } catch (err) {
    console.error(`[FILE STORAGE] Không thể lưu file vào database (${folder}/${filename}):`, err);
    throw err;
  }
}

export async function getUploadedFile(
  folder: string,
  filename: string,
): Promise<{ buffer: Buffer; mimeType: string; size: number; createdAt: Date } | null> {
  try {
    const record = await prisma.uploadedFile.findUnique({
      where: { folder_filename: { folder, filename } },
      select: { data: true, mimeType: true, size: true, createdAt: true },
    });
    if (!record) return null;
    return { buffer: Buffer.from(record.data), mimeType: record.mimeType, size: record.size, createdAt: record.createdAt };
  } catch (err) {
    console.error(`[FILE STORAGE] Lỗi đọc file từ database (${folder}/${filename}):`, err);
    return null;
  }
}

export async function uploadedFileExists(folder: string, filename: string): Promise<boolean> {
  try {
    const count = await prisma.uploadedFile.count({
      where: { folder, filename },
    });
    return count > 0;
  } catch {
    return false;
  }
}
