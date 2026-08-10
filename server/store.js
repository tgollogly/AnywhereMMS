const fs = require('fs');
const path = require('path');
const config = require('./config');

const METADATA_FILE = path.join(config.uploadDir, 'metadata.json');

function ensureStore() {
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
  if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify({}), 'utf8');
  }
}

function readMetadata() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeMetadata(data) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function saveImage(id, record) {
  const data = readMetadata();
  data[id] = record;
  writeMetadata(data);
}

function getImage(id) {
  const data = readMetadata();
  return data[id] || null;
}

function incrementViews(id) {
  const data = readMetadata();
  if (!data[id]) return null;
  data[id].views = (data[id].views || 0) + 1;
  data[id].lastViewedAt = new Date().toISOString();
  writeMetadata(data);
  return data[id];
}

function deleteImage(id) {
  const data = readMetadata();
  const record = data[id];
  if (!record) return false;

  const filePath = path.join(config.uploadDir, record.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  delete data[id];
  writeMetadata(data);
  return true;
}

function cleanupExpired() {
  const data = readMetadata();
  const now = Date.now();
  let removed = 0;

  for (const [id, record] of Object.entries(data)) {
    const expired = new Date(record.expiresAt).getTime() <= now;
    const maxViewsReached = record.views >= record.maxViews;
    if (expired || maxViewsReached) {
      const filePath = path.join(config.uploadDir, record.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      delete data[id];
      removed++;
    }
  }

  if (removed > 0) writeMetadata(data);
  return removed;
}

module.exports = {
  ensureStore,
  saveImage,
  getImage,
  incrementViews,
  deleteImage,
  cleanupExpired,
};
