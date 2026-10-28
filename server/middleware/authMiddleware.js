const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('Fatal: JWT_SECRET environment variable is missing.');
  }
  return secret;
};

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '60m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Generate Access and Refresh JWT Tokens
 */
const generateTokens = (user) => {
  const secret = getJwtSecret();
  const payload = {
    id: user._id.toString(),
    sqliteId: user.sqliteId,
    username: user.username,
    role: user.role,
  };

  const access = jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
  const refresh = jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });

  return { access, refresh };
};

/**
 * Protect routes - requires valid JWT Bearer token
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ detail: 'Authentication token missing.' });
    }

    let secret;
    try {
      secret = getJwtSecret();
    } catch (secretErr) {
      console.error(secretErr.message);
      return res.status(500).json({ detail: 'Internal server error: Authentication secret missing.' });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ detail: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ detail: 'Token has expired.' });
    }
    return res.status(401).json({ detail: 'Given token not valid for any token type.' });
  }
};

/**
 * Optional Auth - attaches user if valid token present, but does not block
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.id);
        if (user) {
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Ignore error in optional auth
  }
  next();
};

module.exports = {
  getJwtSecret,
  generateTokens,
  requireAuth,
  optionalAuth,
};
