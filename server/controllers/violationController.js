const Violation = require('../models/Violation');
const { serializeViolation } = require('./monitoringController');

/**
 * List all violations
 * GET /api/violations/
 */
const getViolations = async (req, res, next) => {
  try {
    const violations = await Violation.find().sort({ created_at: -1 }).populate('log');
    return res.status(200).json(violations.map((v) => serializeViolation(v, v.log)));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getViolations,
};
