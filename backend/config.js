/**
 * Central config — load first to avoid circular deps (app ↔ utils).
 */
try {
  require('dotenv').config();
} catch (e) {
  // optional
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL =
  process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-7b-instruct';
const USE_OPENROUTER = OPENROUTER_API_KEY.length > 0;

const JWT_SECRET = process.env.JWT_SECRET || 'virtum_secret_2026_dev_only';
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '5001', 10);
const APP_VERSION = process.env.APP_VERSION || '1.2.0';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';
const AUTH0_ENABLED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || '';
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || '';
const FIREBASE_ENABLED = Boolean(
  FIREBASE_PROJECT_ID &&
  FIREBASE_CLIENT_EMAIL &&
  FIREBASE_PRIVATE_KEY &&
  FIREBASE_WEB_API_KEY &&
  FIREBASE_AUTH_DOMAIN &&
  FIREBASE_APP_ID
);

module.exports = {
  OPENROUTER_API_KEY,
  OPENROUTER_API_URL,
  OPENROUTER_MODEL,
  USE_OPENROUTER,
  JWT_SECRET,
  NODE_ENV,
  PORT,
  APP_VERSION,
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_AUDIENCE,
  AUTH0_ENABLED,
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_WEB_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_APP_ID,
  FIREBASE_ENABLED
};
