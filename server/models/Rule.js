const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  sqliteId: {
    type: Number,
    index: true,
  },
  policy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Policy',
    required: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  condition: {
    type: String,
    default: '',
    trim: true,
  },
  action: {
    type: String,
    default: '',
    trim: true,
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

const Rule = mongoose.model('Rule', ruleSchema);
module.exports = Rule;
