const express = require('express');
const router = express.Router();
const { getLogs, createLog } = require('../controllers/logController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/', getLogs);
router.post('/', optionalAuth, createLog);

module.exports = router;
