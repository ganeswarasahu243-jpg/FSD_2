const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  interpretPolicy,
  savePolicy,
  getPolicies,
  getPolicyById,
} = require('../controllers/policyController');

router.post('/policy-interpreter', upload.single('policy_file'), interpretPolicy);
router.post('/policy-interpreter/', upload.single('policy_file'), interpretPolicy);

router.post('/policies/save', requireAuth, upload.single('policy_file'), savePolicy);
router.post('/policies/save/', requireAuth, upload.single('policy_file'), savePolicy);

router.get('/policies', getPolicies);
router.get('/policies/', getPolicies);

router.get('/policies/:id', getPolicyById);
router.get('/policies/:id/', getPolicyById);

module.exports = router;
