import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to import uploads.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });

const KNOWN_FOLDERS = ['chat', 'products', 'ai'];

const EXT_TO_MIME: Record<string, string> = {
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

async function importFolder(folderDir: string, folder: string): Promise<void> {
  if (!fs.existsSync(folderDir)) return;
  const files = fs.readdirSync(folderDir);
  for (const filename of files) {
    const filePath = path.join(folderDir, filename);
    if (!fs.statSync(filePath).isFile()) continue;
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mimeType = EXT_TO_MIME[ext] || 'application/octet-stream';
    const data = await fs.promises.readFile(filePath);
    await prisma.uploadedFile.upsert({
      where: { folder_filename: { folder, filename } },
      create: { folder, filename, mimeType, size: data.length, data },
      update: {},
    });
    console.log(`[IMPORT] ${folder}/${filename} (${data.length} bytes, ${mimeType})`);
  }
}

async function main() {
  const baseDir = path.resolve(process.cwd(), 'public/uploads');
  if (!fs.existsSync(baseDir)) {
    console.log('[IMPORT] Không tìm thấy thư mục public/uploads - bỏ qua.');
    return;
  }
  await importFolder(baseDir, '');
  for (const folder of KNOWN_FOLDERS) {
    await importFolder(path.join(baseDir, folder), folder);
  }
  const total = await prisma.uploadedFile.count();
  console.log(`[IMPORT] Hoàn tất. Tổng số file trong database: ${total}`);
}

main()
  .catch((err) => {
    console.error('[IMPORT ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
