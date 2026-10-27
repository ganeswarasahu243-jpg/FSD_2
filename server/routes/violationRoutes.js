const express = require('express');
const router = express.Router();
const { getViolations } = require('../controllers/violationController');

router.get('/', getViolations);

module.exports = router;
