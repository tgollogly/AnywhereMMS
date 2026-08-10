const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const store = require('../store');
const { sendSms } = require('../sms');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.maxSendsPerHour,
  message: { error: 'Too many sends. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
  throw new Error('Invalid phone number. Use E.164 format (e.g. +15551234567).');
}

router.post('/send', sendLimiter, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo provided.' });
    }

    const { phone, message } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Recipient phone number is required.' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const id = uuidv4();
    const filename = `${id}.jpg`;
    const filePath = path.join(config.uploadDir, filename);

    const compressed = await sharp(req.file.buffer)
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    const originalSize = req.file.size;
    const compressedSize = compressed.length;

    await sharp(compressed).toFile(filePath);

    const expiresAt = new Date(Date.now() + config.imageTtlHours * 60 * 60 * 1000).toISOString();
    const viewUrl = `${config.baseUrl}/view/${id}`;

    store.saveImage(id, {
      id,
      filename,
      createdAt: new Date().toISOString(),
      expiresAt,
      views: 0,
      maxViews: config.maxViews,
      mimeType: 'image/jpeg',
      originalSize,
      compressedSize,
    });

    const smsBody = [
      message?.trim() || 'Someone shared a photo with you on AnywhereMMS 📸',
      '',
      `View your image: ${viewUrl}`,
      '',
      `Link expires in ${config.imageTtlHours}h. No account needed.`,
    ].join('\n');

    await sendSms(normalizedPhone, smsBody);

    res.json({
      success: true,
      id,
      viewUrl,
      expiresAt,
      compression: {
        originalBytes: originalSize,
        compressedBytes: compressedSize,
        savedPercent: Math.round((1 - compressedSize / originalSize) * 100),
      },
    });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send photo.' });
  }
});

router.get('/image/:id', (req, res) => {
  const record = store.getImage(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Image not found or expired.' });
  }

  if (new Date(record.expiresAt) <= new Date()) {
    store.deleteImage(req.params.id);
    return res.status(410).json({ error: 'This image has expired.' });
  }

  if (record.views >= record.maxViews) {
    return res.status(410).json({ error: 'This image has reached its view limit.' });
  }

  res.json({
    id: record.id,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    views: record.views,
    maxViews: record.maxViews,
    imageUrl: `/uploads/${record.filename}`,
    compression: {
      originalBytes: record.originalSize,
      compressedBytes: record.compressedSize,
    },
  });
});

router.get('/image/:id/file', (req, res) => {
  const record = store.getImage(req.params.id);
  if (!record) {
    return res.status(404).send('Image not found');
  }

  if (new Date(record.expiresAt) <= new Date() || record.views >= record.maxViews) {
    store.deleteImage(req.params.id);
    return res.status(410).send('Image expired');
  }

  store.incrementViews(req.params.id);
  const filePath = path.join(config.uploadDir, record.filename);
  res.set('Cache-Control', 'private, max-age=3600');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(filePath);
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AnywhereMMS', version: '1.0.0' });
});

module.exports = router;
