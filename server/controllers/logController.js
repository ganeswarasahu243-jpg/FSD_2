const Log = require('../models/Log');
const { createViolationsForLog } = require('./monitoringController');

/**
 * List all activity logs
 * GET /api/logs/
 */
const getLogs = async (req, res, next) => {
  try {
    const logs = await Log.find().sort({ created_at: -1 });
    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new activity log
 * POST /api/logs/
 */
const createLog = async (req, res, next) => {
  try {
    const action = (req.body.action || '').trim();
    if (!action) {
      return res.status(400).json({ detail: 'Action is required.' });
    }

    const logData = {
      action,
      user: req.user ? req.user._id : null,
      username: req.user ? req.user.username : 'Unknown',
    };

    const log = await Log.create(logData);
    await createViolationsForLog(log);

    return res.status(201).json(log);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLogs,
  createLog,
};
