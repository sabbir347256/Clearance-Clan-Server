// src/middlewares/multer.middleware.ts
import multer from 'multer';

export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
