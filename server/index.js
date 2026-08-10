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

app.get('/view/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/view.html'));
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
