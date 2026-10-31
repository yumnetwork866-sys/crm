import type { Request, Response } from 'express';
import { Router } from 'express';
import { getUploadedFile } from '../services/fileStorage.service';

const router = Router();

function sendFromDatabase(folder: string, filename: string, res: Response): boolean {
  if (!filename || filename.includes('..') || filename.includes('/')) return false;
  const record = getUploadedFile(folder, filename);
  if (!record) return false;
  record
    .then((file) => {
      if (!file) {
        res.status(404).json({ error: 'Không tìm thấy file.' });
        return;
      }
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).send(file.buffer);
    })
    .catch(() => res.status(500).json({ error: 'Lỗi khi đọc file từ database.' }));
  return true;
}

// /uploads/<folder>/<filename>
router.get('/:folder/:filename', (req: Request, res: Response, next) => {
  const folder = String(req.params.folder);
  const filename = String(req.params.filename);
  if (['chat', 'products', 'ai'].includes(folder) && sendFromDatabase(folder, filename, res)) return;
  next();
});

// /uploads/<filename> (avatar ở thư mục gốc)
router.get('/:filename', (req: Request, res: Response, next) => {
  if (sendFromDatabase('', String(req.params.filename), res)) return;
  next();
});

export default router;
