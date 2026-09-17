import type { Response } from 'express';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Require authentication for all upload operations
router.use(authenticateToken);

// Ensure base upload directories exist
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');
const CHAT_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'chat');
const PRODUCTS_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'products');

[BASE_UPLOAD_DIR, CHAT_UPLOAD_DIR, PRODUCTS_UPLOAD_DIR].forEach((dir) => {
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
};

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

// Endpoint: POST /api/upload - Upload Base64 Image to Server Disk
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageBase64, folder = 'chat', customFilename } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu hình ảnh (imageBase64).' });
    }

    // Extract mime type and base64 data
    const matches = imageBase64.match(/^data:([-A-Za-z+/]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (matches && matches.length === 3) {
      mimeType = matches[1].toLowerCase();
      base64Data = matches[2];
    }

    const ext = ALLOWED_MIME_TYPES[mimeType];
    if (!ext) {
      return res.status(400).json({
        success: false,
        error: `Định dạng ảnh không được hỗ trợ (${mimeType}). Chỉ chấp nhận JPG, PNG, WEBP, GIF.`
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_UPLOAD_SIZE) {
      return res.status(413).json({
        success: false,
        error: `Dung lượng ảnh (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) vượt quá giới hạn cho phép (5MB).`
      });
    }

    // Choose target directory and sanitize folder name
    const cleanFolder = folder === 'products' ? 'products' : 'chat';
    const targetSubdir = cleanFolder === 'products' ? PRODUCTS_UPLOAD_DIR : CHAT_UPLOAD_DIR;

    // Generate unique safe filename without path traversal vulnerabilities
    const rand = Math.random().toString(36).substring(2, 8);
    const safeCustomName = typeof customFilename === 'string'
      ? path.basename(customFilename).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
      : '';

    const filename = safeCustomName
      ? `${safeCustomName}_${Date.now()}.${ext}`
      : `${cleanFolder}_${Date.now()}_${rand}.${ext}`;

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
