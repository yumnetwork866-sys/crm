import type { Response } from 'express';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';
import { hasPermission, Permission } from '../auth/permissions';

const router = Router();

// Require authentication for all upload operations
router.use(authenticateToken);

// Ensure base upload directories exist
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');
const CHAT_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'chat');
const PRODUCTS_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'products');
const AI_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'ai');

[BASE_UPLOAD_DIR, CHAT_UPLOAD_DIR, PRODUCTS_UPLOAD_DIR, AI_UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

// Endpoint: POST /api/upload - Upload Base64 Image, Audio, or Document to Server Disk
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageBase64, audioBase64, fileBase64, folder = 'chat', customFilename } = req.body;
    if (folder === 'ai' && !hasPermission(req.user?.permissions || 0n, Permission.USERS_MANAGE)) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền cập nhật ảnh đại diện AI.' });
    }
    const rawData = imageBase64 || audioBase64 || fileBase64;

    if (!rawData || typeof rawData !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu tệp tin (imageBase64/fileBase64).' });
    }

    // Extract mime type and base64 data
    const matches = rawData.match(/^data:([-A-Za-z0-9+/;=.]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = rawData;

    if (matches && matches.length === 3) {
      mimeType = matches[1].split(';')[0].toLowerCase();
      base64Data = matches[2];
    }

    const ext = ALLOWED_MIME_TYPES[mimeType];
    if (!ext) {
      return res.status(400).json({
        success: false,
        error: `Định dạng tệp không được hỗ trợ (${mimeType}). Chỉ chấp nhận hình ảnh (JPG, PNG, WEBP, GIF), âm thanh (WEBM, OGG, MP4, MP3, WAV), hoặc tài liệu (PDF, Word, Excel, CSV, TXT).`
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_UPLOAD_SIZE) {
      return res.status(413).json({
        success: false,
        error: `Dung lượng tệp (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) vượt quá giới hạn cho phép (25MB).`
      });
    }

    // Choose target directory and sanitize folder name
    const cleanFolder = folder === 'products' ? 'products' : folder === 'ai' ? 'ai' : 'chat';
    const targetSubdir = cleanFolder === 'products'
      ? PRODUCTS_UPLOAD_DIR
      : cleanFolder === 'ai'
        ? AI_UPLOAD_DIR
        : CHAT_UPLOAD_DIR;

    // Generate unique safe filename without path traversal vulnerabilities
    const rand = Math.random().toString(36).substring(2, 8);
    const safeCustomName = typeof customFilename === 'string'
      ? path.basename(customFilename, path.extname(customFilename)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
      : '';

    const prefix = mimeType.startsWith('audio/')
      ? 'voice'
      : mimeType.startsWith('image/')
      ? cleanFolder
      : 'doc';
    const filename = safeCustomName
      ? `${safeCustomName}_${Date.now()}.${ext}`
      : `${prefix}_${Date.now()}_${rand}.${ext}`;

    const filePath = path.join(targetSubdir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${cleanFolder}/${filename}`;

    console.log(`[STORAGE] Uploaded image: ${publicUrl} (${buffer.length} bytes) by user: ${req.user?.email || 'unknown'}`);

    return res.json({
      success: true,
      url: publicUrl,
      filename,
      size: buffer.length,
      mimeType,
    });
  } catch (err: any) {
    console.error('[STORAGE ERROR] Failed to save image:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi khi lưu ảnh vào máy chủ.' });
  }
});

export default router;
