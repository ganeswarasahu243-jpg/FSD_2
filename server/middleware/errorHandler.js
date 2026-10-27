const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);

  if (err.message && err.message.includes('Only PDF, TXT, and DOCX files are supported')) {
    return res.status(400).json({ detail: err.message });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ detail: messages.join(' ') });
  }

  if (err.code === 11000) {
    return res.status(400).json({ detail: 'Username already exists.' });
  }

  res.status(err.status || 500).json({
    detail: err.message || 'Internal server error.',
  });
};

module.exports = errorHandler;
