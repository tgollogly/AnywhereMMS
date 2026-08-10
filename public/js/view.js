/**
 * AnywhereMMS — Recipient view page.
 */

async function loadImage() {
  const id = window.location.pathname.split('/view/')[1];
  if (!id) {
    showError('Invalid link.');
    return;
  }

  try {
    const res = await fetch(`/api/image/${id}`);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Image unavailable.');
      return;
    }

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('viewContent').classList.remove('hidden');

    const img = document.getElementById('viewImage');
    img.src = `/api/image/${id}/file`;
    img.alt = 'Shared photo';

    const expires = new Date(data.expiresAt);
    document.getElementById('expiresAt').textContent = expires.toLocaleString();

    if (data.compression) {
      const saved = Math.round((1 - data.compression.compressedBytes / data.compression.originalBytes) * 100);
      document.getElementById('compressionNote').textContent =
        `This image was compressed by ~${saved}% to save data.`;
    }
  } catch {
    showError('Unable to load image. Please check your connection.');
  }
}

function showError(msg) {
  document.getElementById('loading').classList.add('hidden');
  const err = document.getElementById('viewError');
  err.textContent = msg;
  err.classList.remove('hidden');
  err.classList.add('show');
}

document.addEventListener('DOMContentLoaded', loadImage);
