const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const {
  JWT_SECRET,
  FIREBASE_ENABLED,
  FIREBASE_WEB_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_APP_ID
} = require('../config');
const { hashPassword } = require('../authUtils');
const { verifyFirebaseIdToken } = require('../firebaseAdmin');

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

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCb(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function pickUniqueUsername(seed) {
  const normalizedSeed = String(seed || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'user';

  let candidate = USERNAME_REGEX.test(normalizedSeed) ? normalizedSeed : `user_${Math.floor(Math.random() * 999999)}`;
  for (let i = 0; i < 30; i++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await dbGet('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (!exists) return candidate;
    const suffix = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    candidate = `${normalizedSeed.slice(0, 15)}_${suffix}`.slice(0, 20);
  }
  return `user_${Date.now().toString().slice(-8)}`;
}

router.get('/firebase-config', (req, res) => {
  return res.json({
    enabled: FIREBASE_ENABLED,
    apiKey: FIREBASE_ENABLED ? FIREBASE_WEB_API_KEY : '',
    authDomain: FIREBASE_ENABLED ? FIREBASE_AUTH_DOMAIN : '',
    appId: FIREBASE_ENABLED ? FIREBASE_APP_ID : ''
  });
});

router.post('/firebase-resolve-identifier', async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || '').trim().toLowerCase();
    if (!identifier) return res.status(400).json({ error: 'Identifier is required' });
    if (EMAIL_REGEX.test(identifier)) return res.json({ success: true, email: identifier });

    const user = await dbGet('SELECT email FROM users WHERE lower(username)=lower(?) LIMIT 1', [identifier]);
    if (!user || !user.email) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, email: String(user.email).toLowerCase() });
  } catch {
    return res.status(500).json({ error: 'Resolve identifier failed' });
  }
});

router.post('/firebase-register-profile', async (req, res) => {
  try {
    if (!FIREBASE_ENABLED) return res.status(503).json({ error: 'Firebase is not configured on server' });

    const idToken = String(req.body?.idToken || '').trim();
    const username = String(req.body?.username || '').trim();
    if (!idToken) return res.status(400).json({ error: 'Missing Firebase ID token' });
    if (!USERNAME_REGEX.test(username)) return res.status(400).json({ error: 'Invalid username format' });

    const claims = await verifyFirebaseIdToken(idToken);
    const email = String(claims.email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Firebase token does not contain a valid email' });
    }

    const byUsername = await dbGet('SELECT id, email FROM users WHERE lower(username)=lower(?) LIMIT 1', [username]);
    if (byUsername && String(byUsername.email || '').toLowerCase() !== email) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const byEmail = await dbGet('SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1', [email]);
    if (byEmail) {
      await dbRun(
        'UPDATE users SET username = ?, email_verified = ? WHERE id = ?',
        [username, claims.email_verified ? 1 : 0, byEmail.id]
      );
      return res.json({ success: true });
    }

    const userId = crypto.randomUUID();
    const { salt, hash } = hashPassword(crypto.randomUUID());
    await dbRun(
      'INSERT INTO users (id, username, email, password_hash, password_salt, newsletter_opt_in, email_verified) VALUES (?, ?, ?, ?, ?, 0, ?)',
      [userId, username, email, hash, salt, claims.email_verified ? 1 : 0]
    );
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to save Firebase profile' });
  }
});

router.post('/login-firebase', async (req, res) => {
  try {
    if (!FIREBASE_ENABLED) return res.status(503).json({ error: 'Firebase is not configured on server' });

    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'Missing Firebase ID token' });

    const claims = await verifyFirebaseIdToken(idToken);
    const email = String(claims.email || '').trim().toLowerCase();
    const emailVerified = Boolean(claims.email_verified);
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Firebase token does not contain a valid email' });
    }
    if (!emailVerified) {
      return res.status(401).json({ error: 'Please verify your email in Firebase first' });
    }

    let user = await dbGet('SELECT id, username, email FROM users WHERE lower(email)=lower(?) LIMIT 1', [email]);
    if (!user) {
      const username = await pickUniqueUsername(claims.name || email.split('@')[0] || 'user');
      const userId = crypto.randomUUID();
      const { salt, hash } = hashPassword(crypto.randomUUID());
      await dbRun(
        'INSERT INTO users (id, username, email, password_hash, password_salt, newsletter_opt_in, email_verified) VALUES (?, ?, ?, ?, ?, 0, 1)',
        [userId, username, email, hash, salt]
      );
      user = { id: userId, username, email };
    }

    const token = issueToken(user);
    return res.json({ success: true, token, user });
  } catch {
    return res.status(401).json({ error: 'Firebase login failed' });
  }
});

router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ id: decoded.id, email: decoded.email, username: decoded.username, role: decoded.role });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (req, res) => res.json({ success: true, message: 'Logged out' }));

module.exports = router;