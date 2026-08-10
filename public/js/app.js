/**
 * AnywhereMMS — Main send flow: camera capture, compress, upload, SMS.
 */

let stream = null;
let capturedBlob = null;
let compressionStats = null;

const els = {};

function $(id) {
  return document.getElementById(id);
}

function showStatus(message, type = 'info') {
  const status = els.status;
  status.textContent = message;
  status.className = `status show status-${type}`;
}

function hideStatus() {
  els.status.className = 'status';
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });

    els.cameraPreview.srcObject = stream;
    els.cameraPreview.style.display = 'block';
    els.capturedPreview.style.display = 'none';
    els.placeholder.style.display = 'none';
    els.captureBtn.disabled = false;
    els.startCameraBtn.textContent = 'Restart Camera';
  } catch (err) {
    showStatus('Camera access denied or unavailable. You can upload a photo instead.', 'error');
    els.fileInput.click();
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

async function capturePhoto() {
  const video = els.cameraPreview;
  if (!video.videoWidth) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  capturedBlob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  await processCapturedImage();
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  capturedBlob = file;
  stopCamera();
  els.cameraPreview.style.display = 'none';
  els.placeholder.style.display = 'none';
  await processCapturedImage();
}

async function processCapturedImage() {
  showStatus('Compressing image to save data…', 'info');

  const result = await AnywhereMMS.compressImage(capturedBlob);
  capturedBlob = result.blob;
  compressionStats = result;

  const url = URL.createObjectURL(capturedBlob);
  els.capturedPreview.src = url;
  els.capturedPreview.style.display = 'block';

  updateCompressionUI(result);
  els.sendSection.classList.remove('hidden');
  els.retakeBtn.classList.remove('hidden');
  hideStatus();
}

function updateCompressionUI({ originalSize, compressedSize }) {
  const saved = AnywhereMMS.savedPercent(originalSize, compressedSize);
  els.originalSize.textContent = AnywhereMMS.formatBytes(originalSize);
  els.compressedSize.textContent = AnywhereMMS.formatBytes(compressedSize);
  els.savedPercent.textContent = `${saved}%`;
  els.progressFill.style.width = `${Math.max(saved, 5)}%`;
  els.compressionBar.classList.remove('hidden');
}

function retake() {
  capturedBlob = null;
  compressionStats = null;
  els.capturedPreview.style.display = 'none';
  els.capturedPreview.src = '';
  els.sendSection.classList.add('hidden');
  els.retakeBtn.classList.add('hidden');
  els.compressionBar.classList.add('hidden');
  els.fileInput.value = '';
  startCamera();
}

async function sendPhoto(e) {
  e.preventDefault();

  if (!capturedBlob) {
    showStatus('Please capture or upload a photo first.', 'error');
    return;
  }

  const phone = els.phone.value.trim();
  if (!phone) {
    showStatus('Please enter a recipient phone number.', 'error');
    return;
  }

  els.sendBtn.disabled = true;
  els.sendBtn.textContent = 'Sending…';
  showStatus('Uploading and sending SMS…', 'info');

  const formData = new FormData();
  formData.append('photo', capturedBlob, 'photo.jpg');
  formData.append('phone', phone);
  formData.append('message', els.message.value.trim());

  try {
    const res = await fetch('/api/send', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Send failed');

    const serverSaved = data.compression?.savedPercent ?? 0;
    showStatus(
      `Photo sent! Link: ${data.viewUrl} — Total data saved: ~${serverSaved}% after server compression.`,
      'success'
    );

    els.sendForm.reset();
    setTimeout(retake, 3000);
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    els.sendBtn.disabled = false;
    els.sendBtn.textContent = 'Send Photo via SMS';
  }
}

function init() {
  els.cameraPreview = $('cameraPreview');
  els.capturedPreview = $('capturedPreview');
  els.placeholder = $('cameraPlaceholder');
  els.captureBtn = $('captureBtn');
  els.startCameraBtn = $('startCameraBtn');
  els.retakeBtn = $('retakeBtn');
  els.fileInput = $('fileInput');
  els.sendSection = $('sendSection');
  els.sendForm = $('sendForm');
  els.sendBtn = $('sendBtn');
  els.phone = $('phone');
  els.message = $('message');
  els.status = $('status');
  els.compressionBar = $('compressionBar');
  els.originalSize = $('originalSize');
  els.compressedSize = $('compressedSize');
  els.savedPercent = $('savedPercent');
  els.progressFill = $('progressFill');

  els.startCameraBtn.addEventListener('click', startCamera);
  els.captureBtn.addEventListener('click', capturePhoto);
  els.retakeBtn.addEventListener('click', retake);
  els.fileInput.addEventListener('change', handleFileSelect);
  els.sendForm.addEventListener('submit', sendPhoto);

  $('uploadBtn')?.addEventListener('click', () => els.fileInput.click());
}

document.addEventListener('DOMContentLoaded', init);
