// app.js - Main entry point

const config = require('./config');
const express = require('express');
const cors = require('cors');
const path = require('path');

const { db } = require('./db');
const middlewares = require('./middlewares');
const dataRoutes = require('./routes/dataRoutes');
const aiRoutes = require('./routes/aiRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Apply rate limiter to API routes
app.use('/api', middlewares.checkRateLimit);

// Improved CORS: Allow specific origins in production, all in development
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Serve static files (for HTML)
app.use(express.static(path.join(__dirname, '..')));

// Apply audit logging to all API routes
app.use('/api', middlewares.auditLog);
app.use('/api/auth', middlewares.checkAuthRateLimit);

// Health check (no DB probe to keep fast; add /api/health/db if needed)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'virtum-api',
    version: config.APP_VERSION,
    time: new Date().toISOString(),
    ai: config.USE_OPENROUTER ? 'ready' : 'not_configured',
    env: config.NODE_ENV
  });
});

// Mount routes
app.use('/api/data', dataRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/auth', authRoutes);

// Provider API routes (for healthcare providers) - optional feature
try {
  const providerRoutes = require('./provider-api');
  app.use('/', providerRoutes);
  console.log('✅ Provider API routes loaded');
} catch (e) {
  console.log('⚠️  Provider API routes not available (optional feature)');
}

// Global error handler (must be last)
app.use(middlewares.errorHandler);

const PORT = config.PORT;
const HOST = '0.0.0.0';

const getLocalIP = () => {
  const { networkInterfaces } = require('os');
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const localIP = getLocalIP();

app.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log('✅ Backend on SQLite started successfully!');
  console.log(`🌐 Server running on: http://localhost:${PORT}/virtum.html`);
  console.log(`📱 Mobile access: http://${localIP}:${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  if (config.USE_OPENROUTER) {
    console.log(`🤖 Cloud AI: ✅ ACTIVE (${config.OPENROUTER_MODEL})`);
    console.log(`   Provider endpoint: ${config.OPENROUTER_API_URL}`);
  } else {
    console.log('🤖 Cloud AI: ⚠️  not configured');
    console.log('   To activate, set OPENROUTER_API_KEY in backend .env');
  }
  try {
    const { getMailMode } = require('./mailer');
    const mode = getMailMode();
    console.log(
      mode === 'none'
        ? '📧 Email: ⚠️  not configured (set RESEND_API_KEY or SMTP_* in backend/.env)'
        : `📧 Email: ${mode} (codes & login mail)`
    );
  } catch (e) {
    console.log('📧 Email: ⚠️  could not read mail config');
  }
  console.log('========================================');
  console.log('\n✅ PRODUCTION FEATURES:');
  console.log('  ✓ Input validation on all endpoints');
  console.log('  ✓ Rate limiting (100 req/min per IP)');
  console.log('  ✓ Error handling with proper HTTP codes');
  console.log('  ✓ Database error handling');
  console.log('  ✓ CORS security');
  console.log('  ✓ Audit logging (sensitive fields redacted)');
  console.log('\n📋 Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/data/history');
  console.log('  POST /api/data/store (simulate random data)');
  console.log('  POST /api/data/custom (save user input data)');
  console.log('  POST /api/data/water (save water intake)');
  console.log('  GET  /api/ai/recommend');
  console.log('  POST /api/ai/chat (Jeffrey / OpenRouter)');
  console.log('  GET  /api/summary/daily|weekly|monthly|yearly');
  console.log('  POST /api/auth/login');
  console.log('\n⚠️  Do not close this window!');
  console.log('========================================\n');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: Port ${PORT} is already in use!`);
    console.error('\nSolutions:');
    console.error(`  1. Close another application on port ${PORT}`);
    console.error('  2. Or set PORT=5002 in backend .env');
    console.error('  3. Update API_URL in assets/js/virtum.js if you change the port');
    console.error('\nCheck occupied ports:');
    console.error(`  Windows: netstat -ano | findstr ":${PORT}"`);
  } else {
    console.error('❌ ERROR starting server:', err.message);
  }
  process.exit(1);
});

module.exports = {
  app,
  db,
  secret: config.JWT_SECRET,
  OPENROUTER_API_KEY: config.OPENROUTER_API_KEY,
  OPENROUTER_API_URL: config.OPENROUTER_API_URL,
  OPENROUTER_MODEL: config.OPENROUTER_MODEL,
  USE_OPENROUTER: config.USE_OPENROUTER
};
