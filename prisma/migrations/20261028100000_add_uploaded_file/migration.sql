-- Lưu trữ file upload (chat media, product images, avatar...) trực tiếp trong PostgreSQL
CREATE TABLE IF NOT EXISTS "UploadedFile" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "folder" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadedFile_folder_filename_key" ON "UploadedFile"("folder", "filename");
