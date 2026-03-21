const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../config');
const { hashPassword, verifyPassword } = require('../authUtils');

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: 'user' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function normalizeIdentifier(v) {
  return String(v || '').trim();
}

function findUserByIdentifier(identifier, cb) {
  const i = normalizeIdentifier(identifier);
  if (!i) return cb(null, null);
  db.get(
    `SELECT id, username, email, password_hash, password_salt, email_verified
     FROM users
     WHERE lower(email) = lower(?) OR lower(username) = lower(?)
     LIMIT 1`,
    [i, i],
    cb
  );
}

function isStrongPassword(pwd) {
  const p = String(pwd || '');
  return p.length >= 8 &&
    /[a-z]/.test(p) &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^a-zA-Z0-9]/.test(p);
}

router.post('/register-request', async (req, res) => {
  try {
    const { username, email, password, newsletterOptIn } = req.body || {};
    const u = String(username || '').trim();
    const e = String(email || '').trim().toLowerCase();
    const p = String(password || '');

    if (!USERNAME_REGEX.test(u)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    if (!EMAIL_REGEX.test(e)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!isStrongPassword(p)) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password must be 8+ chars and include uppercase, lowercase, number, and special character'
      });
    }
    db.get('SELECT id FROM users WHERE email = ? OR username = ?', [e, u], async (err, existing) => {
      if (err) return res.status(500).json({ error: 'Database error', message: err.message });
      if (existing) return res.status(409).json({ error: 'User with this email or username already exists' });
      const { salt, hash } = hashPassword(p);
      const newsletter = newsletterOptIn ? 1 : 0;
      const userId = crypto.randomUUID();

      db.run(
        'INSERT INTO users (id, username, email, password_hash, password_salt, newsletter_opt_in, email_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [userId, u, e, hash, salt, newsletter],
        function (insertErr) {
          if (insertErr) return res.status(500).json({ error: 'Failed to create account', message: insertErr.message });
          const user = { id: userId, username: u, email: e };
          const token = issueToken(user);
          return res.json({ success: true, token, user, message: 'Account created successfully' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration request failed', message: error.message });
  }
});

router.post('/register-resend', (req, res) => {
  return res.status(410).json({
    error: 'Email verification is temporarily disabled',
    message: 'Registration now creates account instantly.'
  });
});

router.post('/register-verify', (req, res) => {
  return res.status(410).json({
    error: 'Email verification is temporarily disabled',
    message: 'Registration now creates account instantly.'
  });
});

router.post('/login', (req, res) => {
  try {
    const { email, identifier, password } = req.body || {};
    const idf = normalizeIdentifier(identifier || email);
    const p = String(password || '');
    if (!idf) return res.status(400).json({ error: 'Email or username is required' });
    if (!p) return res.status(400).json({ error: 'Password is required' });

    findUserByIdentifier(idf, (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error', message: err.message });
      if (!user) return res.status(404).json({ error: 'Account not found' });
      if (!user.email_verified) return res.status(403).json({ error: 'Email not verified' });
      if (!verifyPassword(p, user.password_salt, user.password_hash)) {
        return res.status(401).json({ error: 'Incorrect password' });
      }

      const safeUser = { id: user.id, username: user.username, email: user.email };
      const token = issueToken(safeUser);
      return res.json({ success: true, token, user: safeUser });
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

router.post('/send-login-code', (req, res) => {
  return res.status(410).json({
    error: 'Login by email code is temporarily disabled',
    message: 'Use password login.'
  });
});

router.post('/login-with-code', (req, res) => {
  return res.status(410).json({
    error: 'Login by email code is temporarily disabled',
    message: 'Use password login.'
  });
});

router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;