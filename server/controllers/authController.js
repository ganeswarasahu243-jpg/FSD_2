const User = require('../models/User');
const { generateTokens } = require('../middleware/authMiddleware');

/**
 * Register a new user
 * POST /api/auth/register/
 */
const register = async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const role = (req.body.role || 'employee').trim();
    const email = (req.body.email || '').trim();
    const firstName = (req.body.first_name || '').trim();
    const lastName = (req.body.last_name || '').trim();

    if (!username) {
      return res.status(400).json({ detail: 'Username is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ detail: 'Password must be at least 6 characters long.' });
    }

    // Check case-insensitive username collision
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') },
    });
    if (existingUser) {
      return res.status(400).json({ detail: 'Username already exists.' });
    }

    const hashedPassword = User.hashPassword(password);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      email,
      first_name: firstName,
      last_name: lastName,
    });

    const tokens = generateTokens(user);

    return res.status(201).json({
      user: {
        id: user.sqliteId || user._id,
        username: user.username,
        role: user.role,
      },
      access: tokens.access,
      refresh: tokens.refresh,
      message: 'Registration successful.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in an existing user
 * POST /api/auth/login/
 */
const login = async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required.' });
    }

    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') },
    });

    if (!user || !user.comparePassword(password)) {
      return res.status(401).json({ detail: 'Invalid username or password.' });
    }

    const tokens = generateTokens(user);

    return res.status(200).json({
      user: {
        id: user.sqliteId || user._id,
        username: user.username,
        role: user.role,
      },
      access: tokens.access,
      refresh: tokens.refresh,
      message: 'Login successful.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 * GET /api/auth/me/
 */
const getMe = async (req, res) => {
  const user = req.user;
  return res.status(200).json({
    id: user.sqliteId || user._id,
    username: user.username,
    role: user.role,
    email: user.email || '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
  });
};

/**
 * Update authenticated user profile
 * PUT /api/auth/profile/
 */
const updateProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const { username, role, first_name, last_name, email, password } = req.body;

    if (username !== undefined) {
      const trimmedUsername = (username || '').trim();
      if (!trimmedUsername) {
        return res.status(400).json({ detail: 'Username is required.' });
      }
      const existing = await User.findOne({
        _id: { $ne: user._id },
        username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') },
      });
      if (existing) {
        return res.status(400).json({ detail: 'Username already exists.' });
      }
      user.username = trimmedUsername;
    }

    if (role !== undefined) user.role = role.trim();
    if (first_name !== undefined) user.first_name = first_name.trim();
    if (last_name !== undefined) user.last_name = last_name.trim();
    if (email !== undefined) user.email = email.trim();

    if (password && password.trim().length >= 6) {
      user.password = User.hashPassword(password.trim());
    }

    await user.save();
    const tokens = generateTokens(user);

    return res.status(200).json({
      user: {
        id: user.sqliteId || user._id,
        username: user.username,
        role: user.role,
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
      },
      access: tokens.access,
      refresh: tokens.refresh,
      message: 'Profile updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
};
