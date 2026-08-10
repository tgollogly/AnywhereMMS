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

const shareLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.maxSendsPerHour,
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function processAndStoreImage(buffer, originalSize) {
  const id = uuidv4();
  const filename = `${id}.jpg`;
  const filePath = path.join(config.uploadDir, filename);

  const compressed = await sharp(buffer)
    .rotate()
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  const compressedSize = compressed.length;
  await sharp(compressed).toFile(filePath);

  const expiresAt = new Date(Date.now() + config.imageTtlHours * 60 * 60 * 1000).toISOString();
  const viewUrl = `${config.baseUrl}/view/${id}`;
  const previewUrl = `${config.baseUrl}/api/image/${id}/file`;

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

  return {
    id,
    viewUrl,
    previewUrl,
    expiresAt,
    compression: {
      originalBytes: originalSize,
      compressedBytes: compressedSize,
      savedPercent: Math.round((1 - compressedSize / originalSize) * 100),
    },
  };
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
  throw new Error('Invalid phone number. Use E.164 format (e.g. +15551234567).');
}

/** Primary flow: upload photo → get a direct preview link (no SMS API needed). */
router.post('/share', shareLimiter, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo provided.' });
    }

    const result = await processAndStoreImage(req.file.buffer, req.file.size);

    res.json({
      success: true,
      ...result,
      shareText: `📸 Someone shared a photo with you!\n\nView it here: ${result.viewUrl}\n\nLink expires in ${config.imageTtlHours} hours.`,
    });
  } catch (err) {
    console.error('Share error:', err);
    res.status(500).json({ error: err.message || 'Failed to create share link.' });
  }
});

/** Optional: auto-send the preview link via SMS. */
router.post('/send', shareLimiter, upload.single('photo'), async (req, res) => {
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

    const result = await processAndStoreImage(req.file.buffer, req.file.size);

    const smsBody = [
      message?.trim() || 'Someone shared a photo with you on AnywhereMMS 📸',
      '',
      `View your image: ${result.viewUrl}`,
      '',
      `Link expires in ${config.imageTtlHours}h. No account needed.`,
    ].join('\n');

    await sendSms(normalizedPhone, smsBody);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send photo.' });
  }
});

function isValidImageId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getValidRecord(id, res) {
  if (!isValidImageId(id)) {
    res.status(400).json({ error: 'Invalid image ID.' });
    return null;
  }
  const record = store.getImage(id);
  if (!record) {
    res.status(404).json({ error: 'Image not found or expired.' });
    return null;
  }
  if (new Date(record.expiresAt) <= new Date()) {
    store.deleteImage(id);
    res.status(410).json({ error: 'This image has expired.' });
    return null;
  }
  if (record.views >= record.maxViews) {
    res.status(410).json({ error: 'This image has reached its view limit.' });
    return null;
  }
  return record;
}

function getValidRecordForFile(id, res) {
  if (!isValidImageId(id)) {
    res.status(400).send('Invalid image ID');
    return null;
  }
  const record = store.getImage(id);
  if (!record) {
    res.status(404).send('Image not found');
    return null;
  }
  if (new Date(record.expiresAt) <= new Date() || record.views >= record.maxViews) {
    store.deleteImage(id);
    res.status(410).send('Image expired');
    return null;
  }
  return record;
}

function serveImageFile(record, res, { countView = true } = {}) {
  if (countView) store.incrementViews(record.id);
  const filePath = path.join(config.uploadDir, record.filename);
  res.set('Cache-Control', 'private, max-age=3600');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.type('image/jpeg');
  res.sendFile(filePath);
}
router.get('/image/:id', (req, res) => {
  const record = getValidRecord(req.params.id, res);
  if (!record) return;

  res.json({
    id: record.id,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    views: record.views,
    maxViews: record.maxViews,
    viewUrl: `${config.baseUrl}/view/${record.id}`,
    imageUrl: `/api/image/${record.id}/file`,
    compression: {
      originalBytes: record.originalSize,
      compressedBytes: record.compressedSize,
    },
  });
});

/** Serves image for chat app link previews — does not count as a view. */
router.get('/image/:id/preview', (req, res) => {
  const record = getValidRecordForFile(req.params.id, res);
  if (!record) return;
  serveImageFile(record, res, { countView: false });
});

router.get('/image/:id/file', (req, res) => {
  const record = getValidRecordForFile(req.params.id, res);
  if (!record) return;
  serveImageFile(record, res, { countView: true });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AnywhereMMS', version: '1.0.0' });
});

module.exports = router;
