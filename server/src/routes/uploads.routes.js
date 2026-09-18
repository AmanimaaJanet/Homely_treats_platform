import { Router } from 'express';
import multer from 'multer';
import { saveImage } from '../services/storage.js';
import { uploadLimiter } from '../middleware/security.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB raw is fine — storage.js compresses to ~150-400 KB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

// POST /api/uploads  (multipart form-data, field name "file")
router.post('/', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = await saveImage(req.file.buffer, req.file.originalname);
    res.status(201).json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
