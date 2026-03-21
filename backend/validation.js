/**
 * Shared validation helpers for API routes
 */
const USER_ID_REGEX = /^[a-zA-Z0-9_]{1,128}$/;
const MAX_CHAT_MESSAGE = 8000;

function isValidUserId(userId) {
  return typeof userId === 'string' && USER_ID_REGEX.test(userId);
}

function sanitizeUserId(userId, fallback = 'testUser') {
  if (typeof userId !== 'string') return fallback;
  const t = userId.trim();
  return isValidUserId(t) ? t : fallback;
}

module.exports = {
  USER_ID_REGEX,
  MAX_CHAT_MESSAGE,
  isValidUserId,
  sanitizeUserId
};
