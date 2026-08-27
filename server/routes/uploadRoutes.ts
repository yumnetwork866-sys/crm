import type { Request, Response } from 'express';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure base upload directories exist
const BASE_UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');
const CHAT_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'chat');
const PRODUCTS_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, 'products');

[BASE_UPLOAD_DIR, CHAT_UPLOAD_DIR, PRODUCTS_UPLOAD_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Endpoint: POST /api/upload - Upload Base64 / File to Server Disk (Stage 2 Storage)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { imageBase64, folder = 'chat', customFilename } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu hình ảnh (imageBase64)' });
    }

    // Extract mime type and base64 data
    const matches = imageBase64.match(/^data:([-A-Za-z+/]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;
    let ext = 'jpg';

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('gif')) ext = 'gif';
      else if (mimeType.includes('svg')) ext = 'svg';
    }

    const buffer = Buffer.from(base64Data, 'base64');
    
    // Choose target directory
    const targetSubdir = folder === 'products' ? PRODUCTS_UPLOAD_DIR : CHAT_UPLOAD_DIR;
    const cleanSubdirName = folder === 'products' ? 'products' : 'chat';
    
    // Generate unique safe filename
    const rand = Math.random().toString(36).substring(2, 8);
    const filename = customFilename
      ? `${customFilename.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`
      : `${cleanSubdirName}_${Date.now()}_${rand}.${ext}`;

    const filePath = path.join(targetSubdir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${cleanSubdirName}/${filename}`;

    console.log(`[STORAGE STAGE 2] Saved image to disk: ${filePath} (${buffer.length} bytes) -> URL: ${publicUrl}`);

    return res.json({
      success: true,
      url: publicUrl,
      filename,
      size: buffer.length,
      mimeType
    });
  } catch (err: any) {
    console.error('[STORAGE STAGE 2 ERROR] Failed to save image to disk:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi khi lưu ảnh vào máy chủ' });
  }
});

export default router;
