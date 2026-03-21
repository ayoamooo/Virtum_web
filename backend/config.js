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

module.exports = {
  OPENROUTER_API_KEY,
  OPENROUTER_API_URL,
  OPENROUTER_MODEL,
  USE_OPENROUTER,
  JWT_SECRET,
  NODE_ENV,
  PORT,
  APP_VERSION
};
