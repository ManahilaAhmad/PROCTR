import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLOUDINARY CONFIG ────────────────────────────────────────────
// Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env
const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Upload] ✅ Cloudinary storage active');
} else {
  console.warn('[Upload] ⚠️  Cloudinary env vars missing — falling back to local disk storage. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to .env');
}

// ─── LOCAL FALLBACK DIR ───────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─── STORAGE ENGINES ─────────────────────────────────────────────
let examPaperStorage;
let imageStorage;

if (useCloudinary) {
  // Dynamic import (ESM compatible)
  const { CloudinaryStorage } = await import('multer-storage-cloudinary').catch(() => ({ CloudinaryStorage: null }));

  if (CloudinaryStorage) {
    examPaperStorage = new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: 'proctr/exam_papers',
        resource_type: 'raw',              // PDFs must be 'raw'
        public_id: `exam_${Date.now()}`,
        format: path.extname(file.originalname).slice(1).toLowerCase(),
      }),
    });

    imageStorage = new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => ({
        folder: 'proctr/profile_pictures',
        resource_type: 'image',
        transformation: [{ width: 400, height: 400, crop: 'fill' }],
        public_id: `avatar_${Date.now()}`,
      }),
    });
  } else {
    // multer-storage-cloudinary not installed yet — fall back to disk
    examPaperStorage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
    });
    imageStorage = examPaperStorage;
  }
} else {
  // Local disk storage
  const localDisk = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });
  examPaperStorage = localDisk;
  imageStorage = localDisk;
}

// ─── MULTER INSTANCES ─────────────────────────────────────────────
const upload = multer({
  storage: examPaperStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF and DOCX files are allowed.'));
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) cb(null, true);
    else cb(new Error('Only PNG, JPG, JPEG, and WEBP image files are allowed.'));
  },
});

// ─── DIRECT CLOUDINARY UPLOAD HELPER (for base64 / buffer uploads) ──
// Usage: const result = await uploadToCloudinary(buffer, 'proctr/submissions', 'raw');
async function uploadToCloudinary(fileBuffer, folder = 'proctr/misc', resourceType = 'auto') {
  if (!useCloudinary) throw new Error('Cloudinary not configured');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
}

// ─── HELPER: Get public URL regardless of storage backend ─────────
function getFileUrl(req, filename) {
  if (useCloudinary) {
    // Cloudinary sets req.file.path to the secure_url
    return req.file?.path || null;
  }
  return `http://localhost:${process.env.PORT || 5000}/uploads/${filename}`;
}

export { upload, uploadImage, uploadDir, uploadToCloudinary, getFileUrl, useCloudinary };
