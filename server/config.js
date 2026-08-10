require('dotenv').config();
const path = require('path');

function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: resolveBaseUrl(),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  imageTtlHours: parseInt(process.env.IMAGE_TTL_HOURS, 10) || 72,
  maxViews: parseInt(process.env.MAX_VIEWS, 10) || 10,
  smsProvider: process.env.SMS_PROVIDER || 'console',
  textbeltKey: process.env.TEXTBELT_KEY || 'textbelt',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  maxSendsPerHour: parseInt(process.env.MAX_SENDS_PER_HOUR, 10) || (isProduction ? 5 : 20),
  isProduction,
};
