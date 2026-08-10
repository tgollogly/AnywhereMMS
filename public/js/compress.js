/**
 * AnywhereMMS — Client-side image compression before upload.
 * Reduces mobile data usage and speeds up transfers.
 */

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.75,
};

/**
 * Compress an image blob using canvas (no external deps).
 * @param {Blob} blob
 * @returns {Promise<{ blob: Blob, originalSize: number, compressedSize: number }>}
 */
async function compressImage(blob) {
  const originalSize = blob.size;

  const bitmap = await createImageBitmap(blob);
  const { width, height } = fitDimensions(bitmap.width, bitmap.height, 1280);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const compressedBlob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.75);
  });

  return {
    blob: compressedBlob,
    originalSize,
    compressedSize: compressedBlob.size,
  };
}

function fitDimensions(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function savedPercent(original, compressed) {
  if (original === 0) return 0;
  return Math.round((1 - compressed / original) * 100);
}

window.AnywhereMMS = { compressImage, formatBytes, savedPercent, COMPRESSION_OPTIONS };
