const config = require('./config');

async function sendViaTextbelt(phone, message) {
  const response = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      message,
      key: config.textbeltKey,
    }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'TextBelt SMS delivery failed');
  }
  return result;
}

async function sendViaTwilio(phone, message) {
  const { accountSid, authToken, fromNumber } = config.twilio;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials are not configured');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: fromNumber, Body: message });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || 'Twilio SMS delivery failed');
  }
  return result;
}

async function sendSms(phone, message) {
  switch (config.smsProvider) {
    case 'textbelt':
      return sendViaTextbelt(phone, message);
    case 'twilio':
      return sendViaTwilio(phone, message);
    case 'console':
    default:
      console.log(`[SMS → ${phone}] ${message}`);
      return { success: true, provider: 'console' };
  }
}

module.exports = { sendSms };
