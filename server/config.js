require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
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
  maxSendsPerHour: parseInt(process.env.MAX_SENDS_PER_HOUR, 10) || 5,
};
