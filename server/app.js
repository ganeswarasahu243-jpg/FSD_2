const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const policyRoutes = require('./routes/policyRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const logRoutes = require('./routes/logRoutes');
const violationRoutes = require('./routes/violationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configurable CORS Policy
const clientUrlOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((o) => o.trim())
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, mobile, and wildcard
    if (!origin || clientUrlOrigins.includes('*')) {
      return callback(null, true);
    }
    // Always allow local development and loopback origins
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return callback(null, true);
      }
    } catch (_) {}
    if (clientUrlOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded media files
const customUploadsDir = process.env.MEDIA_UPLOAD_DIR
  ? path.resolve(process.env.MEDIA_UPLOAD_DIR)
  : path.resolve(__dirname, 'uploads');
const legacyMediaDir = path.resolve(__dirname, '..', 'svp', 'uday', 'media');

if (fs.existsSync(customUploadsDir)) {
  app.use('/media', express.static(customUploadsDir));
}
if (fs.existsSync(legacyMediaDir)) {
  app.use('/media', express.static(legacyMediaDir));
}

// Health check endpoints (Liveness & Readiness)
app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health/ready', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).json({ status: 'ready', database: 'connected' });
  }
  return res.status(503).json({ status: 'not_ready', database: 'connecting_or_disconnected' });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api', policyRoutes);
app.use('/api', monitoringRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/violations', violationRoutes);

// Fallback 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ detail: `Route ${req.originalUrl} not found.` });
});

// Serve client build if available (Unified monorepo deployment)
const clientDistDir = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/media') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
} else {
  // Backend-only fallback
  app.get('/', (req, res) => {
    res.status(200).json({
      service: 'Policy Pilot / Sentinel Core API',
      status: 'online',
      health: '/health',
      docs: '/api/site-data/',
    });
  });
}

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
