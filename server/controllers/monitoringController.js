const Policy = require('../models/Policy');
const Rule = require('../models/Rule');
const Log = require('../models/Log');
const Violation = require('../models/Violation');
const User = require('../models/User');
const {
  shortenText,
  severityFromText,
  statusFromSeverity,
  buildViolationMessage,
  ruleMatchesAction,
} = require('../services/ruleEngine');

const serializeViolation = (violation, log = null) => {
  const actionText = log ? log.action : (violation.log && violation.log.action) || '';
  const employeeUsername = log ? (log.username || 'Unknown') : (violation.log && violation.log.username) || 'Unknown';
  const severity = severityFromText(violation.message, actionText);
  const status = statusFromSeverity(severity);
  const titleSource = violation.message || actionText || 'Policy violation detected';

  return {
    id: violation.sqliteId || violation._id.toString(),
    message: violation.message,
    title: shortenText(titleSource, 88),
    severity,
    status,
    owner: 'Policy engine',
    employee: employeeUsername,
    activity: actionText,
  };
};

const createViolationsForLog = async (log) => {
  const created = [];
  const rules = await Rule.find();

  for (const rule of rules) {
    if (ruleMatchesAction(rule, log.action)) {
      const v = await Violation.create({
        log: log._id,
        message: buildViolationMessage(rule, log.action),
      });
      created.push(v);
    }
  }

  if (created.length === 0) {
    const genericSeverity = severityFromText(log.action);
    if (['Critical', 'High'].includes(genericSeverity)) {
      const v = await Violation.create({
        log: log._id,
        message: `${genericSeverity} risk activity detected: ${log.action}`,
      });
      created.push(v);
    }
  }

  return created;
};

/**
 * Dashboard stats summary
 * GET /api/dashboard/
 */
const getDashboard = async (req, res, next) => {
  try {
    const [totalPolicies, totalRules, totalLogs, totalViolations, latestPolicies] = await Promise.all([
      Policy.countDocuments(),
      Rule.countDocuments(),
      Log.countDocuments(),
      Violation.countDocuments(),
      Policy.find().sort({ created_at: -1 }).limit(3).select('title source_name created_at'),
    ]);

    return res.status(200).json({
      total_policies: totalPolicies,
      total_rules: totalRules,
      total_logs: totalLogs,
      total_violations: totalViolations,
      latest_policies: latestPolicies.map((p) => ({
        title: p.title,
        source_name: p.source_name,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Comprehensive Site Data aggregate
 * GET /api/site-data/
 */
const getSiteData = async (req, res, next) => {
  try {
    const [
      totalPolicies,
      totalRules,
      totalLogs,
      totalViolations,
      recentPolicies,
      recentRules,
      recentViolationsDocs,
    ] = await Promise.all([
      Policy.countDocuments(),
      Rule.countDocuments(),
      Log.countDocuments(),
      Violation.countDocuments(),
      Policy.find().sort({ created_at: -1 }).limit(5).select('title source_name created_at sqliteId'),
      Rule.find().sort({ _id: -1 }).limit(4).select('description condition action sqliteId'),
      Violation.find().sort({ _id: -1 }).limit(8).populate('log'),
    ]);

    const recentViolations = recentViolationsDocs.map((item) => serializeViolation(item, item.log));

    const frameworks = [
      {
        name: 'GDPR 2016/679',
        region: 'European Union',
        coverage: Math.min(100, 70 + totalPolicies * 3),
      },
      {
        name: 'SOC 2 Type II',
        region: 'United States',
        coverage: Math.min(100, 76 + totalRules * 2),
      },
      {
        name: 'HIPAA',
        region: 'Healthcare',
        coverage: Math.min(100, 55 + totalLogs * 4),
      },
    ];

    let monitoringFeed = recentRules.map((item) => ({
      source: 'Policy Engine',
      title: item.description || 'Generated rule',
      description: item.action || item.condition || 'No details provided.',
    }));

    if (monitoringFeed.length === 0) {
      monitoringFeed = [
        {
          source: 'System',
          title: 'Awaiting monitoring data',
          description: 'Create policies or logs to generate live feed items.',
        },
      ];
    }

    const auditItems = frameworks.map((framework) => ({
      title: framework.name,
      status: framework.coverage < 70 ? 'At Risk' : 'Ready',
      progress: framework.coverage,
    }));

    let workflowItems = recentRules.slice(0, 4).map((item, index) => ({
      title: item.description || `Workflow step ${index + 1}`,
      status: index === 0 ? 'Active' : 'Queued',
    }));

    if (workflowItems.length === 0) {
      workflowItems = [{ title: 'No workflow mappings yet', status: 'Pending' }];
    }

    const settings = {
      connected_modules: 3 + (totalRules > 0 ? 1 : 0) + (totalLogs > 0 ? 1 : 0) + (totalPolicies > 0 ? 1 : 0),
      sync_health: Math.min(100, 84 + totalPolicies + totalLogs),
      recommended_action: 'Review access roles and save new policy interpretations under authenticated users.',
    };

    let alertItems = recentViolations.slice(0, 6).map((violation) => ({
      id: violation.id,
      title: violation.message || 'Policy violation detected',
      severity: violation.severity || 'Low',
      owner: violation.owner || 'Policy engine',
      status: violation.status || 'Observed',
      employee: violation.employee || 'Unknown',
      activity: violation.activity || '',
    }));

    if (alertItems.length === 0) {
      alertItems = [
        {
          title: 'No active alerts',
          severity: 'Healthy',
          owner: 'System',
          status: 'Monitoring',
          employee: 'N/A',
          activity: '',
        },
      ];
    }

    const criticalCount = recentViolations.filter((item) => item.severity === 'Critical').length;
    const highCount = recentViolations.filter((item) => item.severity === 'High').length;

    const alertSummary = {
      open_alerts: totalViolations,
      critical: criticalCount,
      high: highCount,
      needs_review: Math.max(0, totalLogs - totalViolations),
    };

    return res.status(200).json({
      generated_at: new Date(),
      detail: '',
      totals: {
        policies: totalPolicies,
        rules: totalRules,
        logs: totalLogs,
        violations: totalViolations,
      },
      recent_policies: recentPolicies,
      recent_rules: recentRules,
      recent_violations: recentViolations,
      frameworks,
      monitoring_feed: monitoringFeed,
      audit_items: auditItems,
      workflow_items: workflowItems,
      settings,
      alert_summary: alertSummary,
      alert_items: alertItems,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record employee activity simulation
 * POST /api/activity-demo/
 */
const recordActivityDemo = async (req, res, next) => {
  try {
    const employee = (req.body.employee || 'demo.employee').trim();
    const action = (req.body.action || '').trim();

    if (!action) {
      return res.status(400).json({ detail: 'Activity text is required.' });
    }

    let user = await User.findOne({ username: { $regex: new RegExp(`^${employee}$`, 'i') } });
    if (!user) {
      user = await User.create({
        username: employee,
        role: 'employee',
        email: '',
      });
    }

    const log = await Log.create({
      user: user._id,
      username: user.username,
      action,
    });

    const violations = await createViolationsForLog(log);

    return res.status(201).json({
      log_id: log.sqliteId || log._id,
      employee: user.username,
      activity: log.action,
      violations: violations.map((v) => serializeViolation(v, log)),
      message: 'Activity recorded.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve an alert and clean up orphaned logs
 * POST /api/alerts/:violation_id/resolve/
 */
const resolveAlert = async (req, res, next) => {
  try {
    const violationId = req.params.violation_id;
    let violation = null;

    if (violationId.match(/^[0-9a-fA-F]{24}$/)) {
      violation = await Violation.findById(violationId);
    } else {
      violation = await Violation.findOne({ sqliteId: parseInt(violationId, 10) });
    }

    if (!violation) {
      return res.status(404).json({ detail: 'Alert not found.' });
    }

    const logId = violation.log;
    await Violation.findByIdAndDelete(violation._id);

    // If no more violations for this log, delete the log too
    if (logId) {
      const remainingViolations = await Violation.countDocuments({ log: logId });
      if (remainingViolations === 0) {
        await Log.findByIdAndDelete(logId);
      }
    }

    return res.status(200).json({
      detail: 'Alert marked as solved and removed from the database.',
      resolved_id: violationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Keep alert pending in queue
 * POST /api/alerts/:violation_id/pending/
 */
const keepAlertPending = async (req, res, next) => {
  try {
    const violationId = req.params.violation_id;
    let violation = null;

    if (violationId.match(/^[0-9a-fA-F]{24}$/)) {
      violation = await Violation.findById(violationId).populate('log');
    } else {
      violation = await Violation.findOne({ sqliteId: parseInt(violationId, 10) }).populate('log');
    }

    if (!violation) {
      return res.status(404).json({ detail: 'Alert not found.' });
    }

    const payload = serializeViolation(violation, violation.log);
    payload.status = 'Still Pending';

    return res.status(200).json({
      detail: 'Alert is still pending and remains in the monitoring queue.',
      alert: payload,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getSiteData,
  recordActivityDemo,
  resolveAlert,
  keepAlertPending,
  serializeViolation,
  createViolationsForLog,
};
