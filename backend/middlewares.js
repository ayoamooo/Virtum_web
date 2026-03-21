// middlewares.js - All middleware functions

function redactForAudit(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (typeof value !== 'object') return value;
  const SENSITIVE = new Set(['password', 'token', 'authorization', 'secret', 'apikey', 'api_key', 'creditcard', 'accesstoken', 'refreshtoken']);
  const out = Array.isArray(value) ? [...value] : { ...value };
  for (const key of Object.keys(out)) {
    const low = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (SENSITIVE.has(low)) {
      out[key] = '[REDACTED]';
    } else if (typeof out[key] === 'object' && out[key] !== null) {
      out[key] = redactForAudit(out[key]);
    }
  }
  if (typeof out.message === 'string' && out.message.length > 400) {
    out.message = out.message.slice(0, 400) + '…[truncated]';
  }
  return out;
}

// Simple in-memory rate limiter (for development)
const rateLimiter = {};
const MAX_REQUESTS_PER_MINUTE = 100;

const checkRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  if (!rateLimiter[ip]) {
    rateLimiter[ip] = [];
  }
  
  // Clean old requests
  rateLimiter[ip] = rateLimiter[ip].filter(timestamp => timestamp > oneMinuteAgo);
  
  // Check limit
  if (rateLimiter[ip].length >= MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  rateLimiter[ip].push(now);
  next();
};

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const data = req.body;
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is optional and not provided
      if (!rules.required && (value === undefined || value === null || value === '')) {
        continue;
      }
      
      // Check type
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }
      
      // Check min/max for numbers
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${field} must be >= ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${field} must be <= ${rules.max}`);
        }
      }
      
      // Check length for strings
      if (rules.type === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }
      }
      
      // Check pattern for regex
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    
    next();
  };
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);
  
  if (err.name === 'SyntaxError' && err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
};

// Audit logging middleware
const auditLog = (req, res, next) => {
  const { db } = require('./db');
  const action = `${req.method} ${req.path}`;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.body?.userId || req.query?.userId || 'unknown';
  
  // Log to database asynchronously (don't block request)
  const safeDetails = redactForAudit({
    body: req.body,
    query: req.query
  });
  db.run(
    'INSERT INTO audit_logs (userId, action, endpoint, ip_address, details) VALUES (?, ?, ?, ?, ?)',
    [userId, action, req.path, ip, JSON.stringify(safeDetails)],
    (err) => {
      if (err) console.error('Audit log error:', err);
    }
  );
  
  next();
};

module.exports = { checkRateLimit, validateInput, errorHandler, auditLog };