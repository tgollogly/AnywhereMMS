const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const store = require('./store');
const apiRoutes = require('./routes/api');

store.ensureStore();

const app = express();

if (config.isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(config.uploadDir, {
  maxAge: '1h',
  setHeaders(res) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  },
}));

app.use('/api', apiRoutes);

/** Dynamic view page with Open Graph tags so WhatsApp/iMessage show image previews. */
app.get('/view/:id', (req, res) => {
  const record = store.getImage(req.params.id);
  const viewUrl = `${config.baseUrl}/view/${req.params.id}`;
  const previewImage = record
    ? `${config.baseUrl}/api/image/${req.params.id}/preview`
    : `${config.baseUrl}/assets/og-default.svg`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>View Photo — AnywhereMMS</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="Someone shared a photo with you">
  <meta property="og:description" content="Tap to view your private photo. Link expires automatically.">
  <meta property="og:url" content="${viewUrl}">
  <meta property="og:image" content="${previewImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${previewImage}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
</head>
<body class="view-page">
  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="logo"><span class="logo-icon">📸</span> AnywhereMMS</a>
    </div>
  </header>
  <div class="view-content">
    <div id="loading"><div class="spinner"></div><p style="color:var(--text-muted)">Loading your image…</p></div>
    <div id="viewError" class="status status-error hidden" style="max-width:480px"></div>
    <div id="viewContent" class="hidden">
      <h1 style="font-size:1.5rem;margin-bottom:0.5rem">📸 Your Photo</h1>
      <p style="color:var(--text-muted);font-size:0.9rem">Someone shared this image with you via AnywhereMMS.</p>
      <div class="view-image-wrapper"><img id="viewImage" alt="Shared photo"></div>
      <p class="view-meta">Expires: <span id="expiresAt">—</span></p>
      <p id="compressionNote" class="view-meta"></p>
      <div class="privacy-notice-inline">🔒 This link is private and expires automatically. <a href="/privacy.html">Privacy Policy</a></div>
    </div>
  </div>
  <footer class="site-footer"><div class="container"><p class="footer-copy">© 2026 tgollogly · <a href="/privacy.html">Privacy</a></p></div></footer>
  <script src="/js/cookies.js"></script>
  <script src="/js/view.js"></script>
</body>
</html>`;

  res.set('Cache-Control', 'no-store');
  res.type('html').send(html);
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

setInterval(() => {
  const removed = store.cleanupExpired();
  if (removed > 0) console.log(`Cleaned up ${removed} expired image(s)`);
}, 60 * 60 * 1000);

app.listen(config.port, () => {
  console.log(`AnywhereMMS running at ${config.baseUrl}`);
  console.log(`SMS provider: ${config.smsProvider}`);
});
