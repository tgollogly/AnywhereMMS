/**
 * AnywhereMMS — Camera capture, compress, share via direct link or optional SMS.
 */

let stream = null;
let capturedBlob = null;
let lastShareText = '';

const els = {};

function $(id) {
  return document.getElementById(id);
}

function showStatus(message, type = 'info') {
  els.status.textContent = message;
  els.status.className = `status show status-${type}`;
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
  } catch {
    showStatus('Camera unavailable — tap Choose from Gallery instead.', 'error');
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
  showStatus('Compressing to save your mobile data…', 'info');

  const result = await AnywhereMMS.compressImage(capturedBlob);
  capturedBlob = result.blob;

  els.capturedPreview.src = URL.createObjectURL(capturedBlob);
  els.capturedPreview.style.display = 'block';

  updateCompressionUI(result);
  els.sendSection.classList.remove('hidden');
  els.linkMode.classList.remove('hidden');
  els.linkResult.classList.add('hidden');
  els.retakeBtn.classList.remove('hidden');
  setMode('link');
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

function resetShareUI() {
  els.linkResult.classList.add('hidden');
  els.shareUrl.value = '';
  lastShareText = '';
}

function retake() {
  capturedBlob = null;
  els.capturedPreview.style.display = 'none';
  els.capturedPreview.src = '';
  els.sendSection.classList.add('hidden');
  els.linkMode.classList.remove('hidden');
  els.retakeBtn.classList.add('hidden');
  els.compressionBar.classList.add('hidden');
  els.fileInput.value = '';
  resetShareUI();
  setMode('link');
  hideStatus();
  startCamera();
}

function setMode(mode) {
  els.modeTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  els.linkMode.classList.toggle('hidden', mode !== 'link');
  els.smsMode.classList.toggle('hidden', mode !== 'sms');
}

async function uploadPhoto(endpoint) {
  const formData = new FormData();
  formData.append('photo', capturedBlob, 'photo.jpg');
  if (endpoint === '/api/send') {
    formData.append('phone', els.phone.value.trim());
    formData.append('message', els.message.value.trim());
  }
  const res = await fetch(endpoint, { method: 'POST', body: formData });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server error. Please try again in a moment.');
  }
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

async function createShareLink() {
  if (!capturedBlob) {
    showStatus('Please capture or upload a photo first.', 'error');
    return;
  }

  els.shareLinkBtn.disabled = true;
  els.shareLinkBtn.textContent = 'Creating link…';
  showStatus('Uploading compressed photo…', 'info');

  try {
    const data = await uploadPhoto('/api/share');
    lastShareText = data.shareText;
    els.shareUrl.value = data.viewUrl;
    els.linkResult.classList.remove('hidden');
    els.linkMode.classList.add('hidden');

    const saved = data.compression?.savedPercent ?? 0;
    showStatus(`Link ready! Saved ~${saved}% data. Copy and paste it anywhere.`, 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    els.shareLinkBtn.disabled = false;
    els.shareLinkBtn.textContent = 'Create Share Link';
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(els.shareUrl.value);
    showStatus('Link copied! Paste it in WhatsApp, iMessage, or SMS.', 'success');
  } catch {
    els.shareUrl.select();
    document.execCommand('copy');
    showStatus('Link copied!', 'success');
  }
}

async function nativeShare() {
  if (!navigator.share) {
    await copyLink();
    return;
  }
  try {
    await navigator.share({
      title: 'Photo for you',
      text: lastShareText || 'Someone shared a photo with you!',
      url: els.shareUrl.value,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    showStatus('Could not share. Try Copy instead.', 'error');
  }
}

async function sendSms(e) {
  e.preventDefault();

  if (!capturedBlob) {
    showStatus('Please capture or upload a photo first.', 'error');
    return;
  }

  const phone = els.phone.value.trim();
  if (!phone) {
    showStatus('Enter a phone number, or use Get Link instead.', 'error');
    return;
  }

  els.sendBtn.disabled = true;
  els.sendBtn.textContent = 'Sending…';
  showStatus('Uploading and texting the link…', 'info');

  try {
    const data = await uploadPhoto('/api/send');
    els.shareUrl.value = data.viewUrl;
    els.linkResult.classList.remove('hidden');
    showStatus(`SMS sent! Link also copied below: ${data.viewUrl}`, 'success');
    els.sendForm.reset();
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    els.sendBtn.disabled = false;
    els.sendBtn.textContent = 'Send Link via SMS';
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
  els.linkMode = $('linkMode');
  els.smsMode = $('smsMode');
  els.linkResult = $('linkResult');
  els.shareUrl = $('shareUrl');
  els.shareLinkBtn = $('shareLinkBtn');
  els.modeTabs = document.querySelectorAll('.mode-tab');

  els.startCameraBtn.addEventListener('click', startCamera);
  els.captureBtn.addEventListener('click', capturePhoto);
  els.retakeBtn.addEventListener('click', retake);
  els.fileInput.addEventListener('change', handleFileSelect);
  els.sendForm.addEventListener('submit', sendSms);
  els.shareLinkBtn.addEventListener('click', createShareLink);
  $('copyLinkBtn')?.addEventListener('click', copyLink);
  $('nativeShareBtn')?.addEventListener('click', nativeShare);
  $('newPhotoBtn')?.addEventListener('click', retake);
  $('uploadBtn')?.addEventListener('click', () => els.fileInput.click());

  els.modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });
}

document.addEventListener('DOMContentLoaded', init);
