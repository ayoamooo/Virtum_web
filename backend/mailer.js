try {
  require('dotenv').config();
} catch {
  /* optional */
}
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

/** Optional explicit "from" for API providers */
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const RESEND_FROM = process.env.RESEND_FROM || '';
const SENDGRID_FROM = process.env.SENDGRID_FROM || '';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';

/** auto | resend | sendgrid | smtp */
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

/** Timeouts (ms) — SMTP only */
const CONNECTION_TIMEOUT_MS = parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || '20000', 10);
const GREETING_TIMEOUT_MS = parseInt(process.env.SMTP_GREETING_TIMEOUT_MS || '15000', 10);
const SOCKET_TIMEOUT_MS = parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || '20000', 10);

/** Default Resend test sender (works without domain verification) */
const RESEND_DEFAULT_FROM = 'Virtum <onboarding@resend.dev>';

function parseFromHeader(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (m) {
    return {
      name: m[1].replace(/^["']|["']$/g, '').trim() || 'Virtum',
      email: m[2].trim()
    };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return { name: 'Virtum', email: s };
  }
  return { name: 'Virtum', email: 'onboarding@resend.dev' };
}

function getFromStringForResend() {
  if (RESEND_FROM) return RESEND_FROM;
  if (EMAIL_FROM) return EMAIL_FROM;
  return RESEND_DEFAULT_FROM;
}

function smtpCredentialsPresent() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS && (SMTP_FROM || SMTP_USER));
}

/**
 * Which transport to use: resend | sendgrid | smtp | none
 */
function getMailMode() {
  if (EMAIL_PROVIDER === 'resend') return RESEND_API_KEY ? 'resend' : 'none';
  if (EMAIL_PROVIDER === 'sendgrid') return SENDGRID_API_KEY ? 'sendgrid' : 'none';
  if (EMAIL_PROVIDER === 'smtp') return smtpCredentialsPresent() ? 'smtp' : 'none';

  if (RESEND_API_KEY) return 'resend';
  if (SENDGRID_API_KEY) return 'sendgrid';
  if (smtpCredentialsPresent()) return 'smtp';
  return 'none';
}

function getProviderOrder() {
  if (EMAIL_PROVIDER === 'resend') return RESEND_API_KEY ? ['resend'] : [];
  if (EMAIL_PROVIDER === 'sendgrid') return SENDGRID_API_KEY ? ['sendgrid'] : [];
  if (EMAIL_PROVIDER === 'smtp') return smtpCredentialsPresent() ? ['smtp'] : [];

  // auto mode: resilient fallback chain
  const order = [];
  if (RESEND_API_KEY) order.push('resend');
  if (SENDGRID_API_KEY) order.push('sendgrid');
  if (smtpCredentialsPresent()) order.push('smtp');
  return order;
}

function isEmailConfigured() {
  return getMailMode() !== 'none';
}

async function sendViaResend({ to, subject, text, html }) {
  const from = getFromStringForResend();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html
    })
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.message || `Resend API error (${res.status})`);
    err.provider = 'resend';
    err.raw = data;
    err.statusCode = res.status;
    throw err;
  }
}

async function sendViaSendGrid({ to, subject, text, html }) {
  const fromRaw = SENDGRID_FROM || EMAIL_FROM || SMTP_FROM || SMTP_USER;
  const { name, email } = parseFromHeader(fromRaw);
  if (!email) {
    const err = new Error('SendGrid requires a valid from email (EMAIL_FROM or SMTP_FROM).');
    err.provider = 'sendgrid';
    throw err;
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email, name: name || 'Virtum' },
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    })
  });

  if (!res.ok) {
    const bodyText = await res.text();
    const err = new Error(`SendGrid API error (${res.status}): ${bodyText.slice(0, 300)}`);
    err.provider = 'sendgrid';
    err.statusCode = res.status;
    throw err;
  }
}

async function sendViaSmtp({ to, subject, text, html }) {
  const transport = createTransport();
  await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject,
    text,
    html
  });
}

function createTransport() {
  const useStartTls = !SMTP_SECURE && SMTP_PORT === 587;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    requireTLS: useStartTls,
    tls: {
      minVersion: 'TLSv1.2'
    }
  });
}

async function sendTransactionalEmail({ to, subject, text, html }) {
  const providers = getProviderOrder();
  if (providers.length === 0) {
    throw new Error('Email is not configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_* in backend/.env');
  }

  const errors = [];
  for (const mode of providers) {
    try {
      if (mode === 'resend') {
        await sendViaResend({ to, subject, text, html });
        return;
      }
      if (mode === 'sendgrid') {
        await sendViaSendGrid({ to, subject, text, html });
        return;
      }
      await sendViaSmtp({ to, subject, text, html });
      return;
    } catch (err) {
      errors.push({ mode, err });
      // In forced mode (not auto), fail immediately with original provider error.
      if (EMAIL_PROVIDER !== 'auto') throw err;
      // If API provider rejected request (auth/domain/sender), show that exact error;
      // don't mask it with later SMTP timeout fallback.
      if ((mode === 'resend' || mode === 'sendgrid') && err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        throw err;
      }
    }
  }

  // Auto mode exhausted all providers.
  const last = errors[errors.length - 1];
  if (last && last.err) throw last.err;
  throw new Error('Failed to send email via all configured providers.');
}

async function sendVerificationEmail(email, username, code) {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }
  const subject = 'Virtum verification code';
  const text = `Hello ${username},\n\nYour Virtum verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  const htmlBody = `<p>Hello <strong>${username}</strong>,</p><p>Your Virtum verification code is:</p><h2 style="letter-spacing:2px">${code}</h2><p>This code expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`;
  await sendTransactionalEmail({ to: email, subject, text, html: htmlBody });
}

async function sendLoginCodeEmail(email, username, code) {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }
  const subject = 'Virtum login code';
  const text = `Hello ${username},\n\nYour login code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  const htmlBody = `<p>Hello <strong>${username}</strong>,</p><p>Your login code is:</p><h2 style="letter-spacing:2px">${code}</h2><p>This code expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`;
  await sendTransactionalEmail({ to: email, subject, text, html: htmlBody });
}

async function sendPasswordResetEmail(email, username, code) {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }
  const subject = 'Virtum password reset code';
  const text = `Hello ${username},\n\nYour password reset code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  const htmlBody = `<p>Hello <strong>${username}</strong>,</p><p>Your password reset code is:</p><h2 style="letter-spacing:2px">${code}</h2><p>This code expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`;
  await sendTransactionalEmail({ to: email, subject, text, html: htmlBody });
}

/**
 * Maps transport errors to a short message for API clients.
 */
function smtpErrorToUserMessage(err) {
  if (!err) return 'Email could not be sent.';
  const code = err.code || '';
  const msg = String(err.message || err);

  if (err.provider === 'resend' || /resend/i.test(msg)) {
    if (/domain|verify|not allowed|from/i.test(msg)) {
      return 'Resend sender is not allowed. Verify your domain in Resend dashboard, or use onboarding@resend.dev as RESEND_FROM for testing.';
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
      return 'Resend API key invalid or forbidden. Check RESEND_API_KEY in backend/.env.';
    }
    return msg.length < 220 ? msg : 'Resend could not send the email. Check RESEND_API_KEY and sender settings in .env.';
  }

  if (err.provider === 'sendgrid' || /sendgrid/i.test(msg)) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return 'SendGrid API key invalid. Check SENDGRID_API_KEY in backend/.env.';
    }
    return msg.length < 220 ? msg : 'SendGrid could not send the email. Verify your API key and sender authentication.';
  }

  if (code === 'ETIMEDOUT' || /ETIMEDOUT/i.test(msg)) {
    return (
      'Cannot reach the mail server (SMTP timed out). Your network may block SMTP. ' +
      'Add RESEND_API_KEY (recommended) or SENDGRID_API_KEY to backend/.env to send via HTTPS instead of SMTP.'
    );
  }
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
    return `Connection refused to ${SMTP_HOST}:${SMTP_PORT}. Check SMTP_HOST/SMTP_PORT in .env.`;
  }
  if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(msg)) {
    return `Mail server host not found: ${SMTP_HOST}. Check SMTP_HOST in .env.`;
  }
  if (/Invalid login|535|authentication failed|535-5\.7\.8/i.test(msg)) {
    return 'SMTP login failed. For Gmail use an App Password (not your normal password) and enable 2‑Step Verification.';
  }
  if (/certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT/i.test(msg)) {
    return 'TLS/certificate error talking to the mail server. Check SMTP settings or corporate SSL inspection.';
  }

  return 'Failed to send email. Check server logs and email settings (Resend, SendGrid, or SMTP).';
}

module.exports = {
  isEmailConfigured,
  sendVerificationEmail,
  sendLoginCodeEmail,
  sendPasswordResetEmail,
  smtpErrorToUserMessage,
  getMailMode
};
