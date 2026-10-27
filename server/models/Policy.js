const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  sqliteId: {
    type: Number,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Policy title is required.'],
    trim: true,
  },
  document: {
    type: String,
    default: null,
  },
  source_name: {
    type: String,
    default: '',
    trim: true,
  },
  content_text: {
    type: String,
    default: '',
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  uploaded_by_username: {
    type: String,
    default: '',
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

const Policy = mongoose.model('Policy', policySchema);
module.exports = Policy;
