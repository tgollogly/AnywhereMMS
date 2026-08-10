/**
 * Cookie consent manager for AnywhereMMS.
 * Uses localStorage — no tracking cookies are set without consent.
 */

const COOKIE_KEY = 'anywheremms_cookie_consent';

function getConsent() {
  try {
    return localStorage.getItem(COOKIE_KEY);
  } catch {
    return null;
  }
}

function setConsent(value) {
  try {
    localStorage.setItem(COOKIE_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;

  if (getConsent()) {
    banner.remove();
    return;
  }

  banner.classList.add('show');

  document.getElementById('acceptCookies')?.addEventListener('click', () => {
    setConsent('accepted');
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 400);
  });

  document.getElementById('declineCookies')?.addEventListener('click', () => {
    setConsent('declined');
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 400);
  });
}

document.addEventListener('DOMContentLoaded', initCookieBanner);
