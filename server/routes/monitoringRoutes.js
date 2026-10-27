const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getSiteData,
  recordActivityDemo,
  resolveAlert,
  keepAlertPending,
} = require('../controllers/monitoringController');

router.get('/dashboard', getDashboard);
router.get('/dashboard/', getDashboard);

router.get('/site-data', getSiteData);
router.get('/site-data/', getSiteData);

router.post('/activity-demo', recordActivityDemo);
router.post('/activity-demo/', recordActivityDemo);

router.post('/alerts/:violation_id/resolve', resolveAlert);
router.post('/alerts/:violation_id/resolve/', resolveAlert);

router.post('/alerts/:violation_id/pending', keepAlertPending);
router.post('/alerts/:violation_id/pending/', keepAlertPending);

module.exports = router;
