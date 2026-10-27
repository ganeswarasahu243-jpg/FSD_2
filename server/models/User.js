const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  sqliteId: {
    type: Number,
    index: true,
  },
  username: {
    type: String,
    required: [true, 'Username is required.'],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: false,
    default: '',
  },
  role: {
    type: String,
    default: 'employee',
    trim: true,
  },
  email: {
    type: String,
    default: '',
    trim: true,
  },
  first_name: {
    type: String,
    default: '',
    trim: true,
  },
  last_name: {
    type: String,
    default: '',
    trim: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  date_joined: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret.sqliteId || ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Method to verify password against Django PBKDF2 or bcrypt hash
userSchema.methods.comparePassword = function (candidatePassword) {
  if (!this.password || !candidatePassword) return false;

  // Django PBKDF2 format: pbkdf2_sha256$iterations$salt$hash
  if (this.password.startsWith('pbkdf2_sha256$')) {
    try {
      const parts = this.password.split('$');
      if (parts.length === 4) {
        const [, iterationsStr, salt, hash] = parts;
        const iterations = parseInt(iterationsStr, 10);
        const derived = crypto
          .pbkdf2Sync(candidatePassword, salt, iterations, 32, 'sha256')
          .toString('base64');
        return derived === hash;
      }
    } catch (err) {
      console.error('PBKDF2 verification error:', err);
    }
  }

  // Bcrypt format
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return bcrypt.compareSync(candidatePassword, this.password);
  }

  // Direct string comparison as fallback
  return this.password === candidatePassword;
};

// Static method to hash password with bcrypt
userSchema.statics.hashPassword = function (plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
