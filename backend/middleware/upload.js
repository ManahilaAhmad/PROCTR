import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLOUDINARY CONFIG ────────────────────────────────────────────
let cloudinary = null;
let CloudinaryStorage = null;
let useCloudinary = false;

const hasCloudinaryEnv = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (hasCloudinaryEnv) {
  try {
    const cloudinaryModule = await import('cloudinary');
    cloudinary = cloudinaryModule.v2 || cloudinaryModule.default?.v2;
    const storageModule = await import('multer-storage-cloudinary');
    CloudinaryStorage = storageModule.CloudinaryStorage || storageModule.default?.CloudinaryStorage;

    if (cloudinary && CloudinaryStorage) {
      cloudinary.config({
        cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
        api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
        api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
      });
      useCloudinary = true;
      console.log('[Upload] ✅ Cloudinary storage active');
    }
  } catch (err) {
    console.warn('[Upload] ⚠️ Cloudinary module not loaded — falling back to local disk storage.');
  }
} else {
  console.warn('[Upload] ⚠️ Cloudinary env vars missing — falling back to local disk storage.');
}

// ─── LOCAL FALLBACK DIR ───────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─── STORAGE ENGINES ─────────────────────────────────────────────
let examPaperStorage;
let imageStorage;

if (useCloudinary && CloudinaryStorage && cloudinary) {
  examPaperStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const ext = path.extname(file.originalname).slice(1).toLowerCase() || 'pdf';
      return {
        folder: 'proctr/exam_papers',
        resource_type: 'raw',
        public_id: `exam_${Date.now()}.${ext}`,
      };
    },
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
  // Local disk storage fallback
  examPaperStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `paper_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`);
    },
  });

  imageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `avatar_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`);
    },
  });
}

// ─── FILE FILTERS ─────────────────────────────────────────────────
const pdfFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  if (allowedTypes.includes(file.mimetype) || ['.pdf', '.docx', '.doc'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word (.docx, .doc) files are allowed for exam papers.'), false);
  }
};

const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype) || ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, or GIF image files are allowed.'), false);
  }
};

// ─── MULTER MIDDLEWARE EXPORTS ────────────────────────────────────
export const uploadExamPaper = multer({
  storage: examPaperStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

export const uploadProfilePicture = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Aliases for backwards compatibility across existing routes
export const upload = uploadExamPaper;
export const uploadImage = uploadProfilePicture;

// ─── HELPER TO GET ACCESSIBLE URL ─────────────────────────────────
export const getFileUrl = (req, fileOrPath) => {
  if (!fileOrPath) return null;

  if (typeof fileOrPath === 'string') {
    if (fileOrPath.startsWith('http://') || fileOrPath.startsWith('https://')) {
      return fileOrPath;
    }
    const host = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000';
    const cleanPath = fileOrPath.startsWith('/') ? fileOrPath : `/${fileOrPath}`;
    return `${host}${cleanPath}`;
  }

  if (fileOrPath.path && (fileOrPath.path.startsWith('http://') || fileOrPath.path.startsWith('https://'))) {
    return fileOrPath.path;
  }
  if (fileOrPath.secure_url) return fileOrPath.secure_url;
  if (fileOrPath.url) return fileOrPath.url;

  const host = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5000';
  const filename = fileOrPath.filename || path.basename(fileOrPath.path);
  return `${host}/uploads/${filename}`;
};
