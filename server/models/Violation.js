const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  sqliteId: {
    type: Number,
    index: true,
  },
  log: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Log',
    required: true,
  },
  message: {
    type: String,
    required: [true, 'Violation message is required.'],
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

const Violation = mongoose.model('Violation', violationSchema);
module.exports = Violation;
