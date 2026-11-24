import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../middleware/auth.js';
import { Media } from '../models/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});
router.use(requireAuth);

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(503).json({ error: 'File uploads are not configured on this server.' });
    }
    const mime = req.file.mimetype;
    const isAllowed = mime.startsWith('image/') || mime.startsWith('video/') ||
      mime === 'application/pdf' || mime.startsWith('audio/');
    if (!isAllowed) return res.status(415).json({ error: 'Upload an image, video, audio file, or PDF.' });
    if (mime.startsWith('image/') && req.file.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'Images must be 10 MB or smaller.' });
    }
    const resourceType = mime.startsWith('video/') || mime.startsWith('audio/') ? 'video' : 'auto';
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder: 'chatbox' },
        (error, value) => error ? reject(error) : resolve(value),
      );
      stream.end(req.file.buffer);
    });
    const media = await Media.create({
      owner: req.user.id,
      secureURL: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format || '',
      bytes: result.bytes,
      originalName: req.file.originalname.slice(0, 200),
    });
    res.status(201).json({
      fileURL: result.secure_url,
      fileName: req.file.originalname.slice(0, 200),
      fileSize: req.file.size,
      resourceType: result.resource_type,
      mediaId: media.id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
