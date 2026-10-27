const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  sqliteId: {
    type: Number,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  username: {
    type: String,
    default: 'Unknown',
  },
  action: {
    type: String,
    required: [true, 'Action text is required.'],
    trim: true,
  },
  created_at: {
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

const Log = mongoose.model('Log', logSchema);
module.exports = Log;
