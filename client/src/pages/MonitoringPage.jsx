import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Play,
  RotateCw,
  Search,
  ShieldAlert,
  Zap,
  ListFilter,
  FileText,
} from 'lucide-react';
import { apiRequest, isComplianceOrAdmin } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Input, Textarea } from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';

const DEMO_SCENARIOS = [
  {
    label: 'Confidential Payroll Export',
    severity: 'Critical',
    employee: 'alex.finance',
    action: 'Shared confidential payroll spreadsheet and bank account details to external cloud drive',
  },
  {
    label: 'Customer Data Download',
    severity: 'High',
    employee: 'sarah.engineer',
    action: 'Bulk export and download of 10,000 customer PII database records to local machine',
  },
  {
    label: 'Admin Privilege Modification',
    severity: 'High',
    employee: 'john.sysadmin',
    action: 'Modified admin permission group and disabled firewall logging rule without approval',
  },
  {
    label: 'Routine Document Access',
    severity: 'Low',
    employee: 'demo.employee',
    action: 'Accessed quarterly public roadmap document on intranet wiki',
  },
];

export default function MonitoringPage() {
  const [activeView, setActiveView] = useState('alerts'); // 'alerts' | 'logs'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [counters, setCounters] = useState({ open_alerts: 0, critical: 0, high: 0, needs_review: 0 });
  const [alertCache, setAlertCache] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [logsList, setLogsList] = useState([]);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for alerts
  const [alertsPage, setAlertsPage] = useState(1);
  const ALERTS_PER_PAGE = 5;

  // Pagination for logs
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 8;

  // Simulator state
  const [employeeName, setEmployeeName] = useState('demo.employee');
  const [employeeAction, setEmployeeAction] = useState('');
  const [submittingDemo, setSubmittingDemo] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }

  const loadMonitoring = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const data = await apiRequest('/api/site-data/');
      const summary = data.alert_summary || {};
      let alerts = (data.alert_items || []).filter((item) => item.severity !== 'Healthy');

      // Fetch comprehensive violation records if privileged
      if (isComplianceOrAdmin()) {
        try {
          const [fullViolations, rawLogs] = await Promise.all([
            apiRequest('/api/violations/'),
            apiRequest('/api/logs/'),
          ]);
          if (Array.isArray(fullViolations) && fullViolations.length > 0) {
            alerts = fullViolations.map((v) => ({
              id: v.id,
              title: v.message || 'Policy violation detected',
              severity: v.severity || 'Low',
              owner: v.owner || 'Policy Engine',
              status: v.status || 'Observed',
              employee: v.employee || 'Unknown',
              activity: v.activity || '',
            }));
          }
          if (Array.isArray(rawLogs)) {
            setLogsList(rawLogs);
          }
        } catch (_) {
          // Fall back to site-data telemetry
        }
      }

      setAlertCache(alerts);
      setFeedItems(data.monitoring_feed || []);
      setCounters(summary);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load monitoring data.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, []);

  const handleAlertAction = async (alertId, action) => {
    if (!alertId) {
      setFeedback({ type: 'warning', message: 'Alert missing database ID.' });
      return;
    }

    try {
      const endpoint =
        action === 'solve'
          ? `/api/alerts/${alertId}/resolve/`
          : `/api/alerts/${alertId}/pending/`;

      const result = await apiRequest(endpoint, { method: 'POST' });

      if (action === 'solve') {
        setAlertCache((prev) => prev.filter((item) => String(item.id) !== String(alertId)));
        setFeedback({
          type: 'success',
          message: result.detail || 'Alert resolved and removed from queue.',
        });
        await loadMonitoring();
      } else if (action === 'pending' && result.alert) {
        setAlertCache((prev) =>
          prev.map((item) =>
            String(item.id) === String(alertId)
              ? { ...item, status: result.alert.status || 'Still Pending' }
              : item
          )
        );
        setFeedback({
          type: 'info',
          message: result.detail || 'Alert marked as still pending.',
        });
        await loadMonitoring();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update alert state.' });
    }
  };

  const handleApplyScenario = (scenario) => {
    setEmployeeName(scenario.employee);
    setEmployeeAction(scenario.action);
  };

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    if (!employeeName.trim() || !employeeAction.trim()) {
      setFeedback({ type: 'warning', message: 'Employee username and activity are required.' });
      return;
    }

    setSubmittingDemo(true);
    setFeedback(null);

    try {
      const data = await apiRequest('/api/activity-demo/', {
        method: 'POST',
        body: {
          employee: employeeName.trim(),
          action: employeeAction.trim(),
        },
      });

      const count = (data.violations || []).length;
      setFeedback({
        type: count > 0 ? 'warning' : 'success',
        message: count > 0
          ? `Signal recorded! Engine identified ${count} policy violation alert(s).`
          : 'Activity logged successfully. No violations detected.',
      });
      setEmployeeAction('');
      await loadMonitoring();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record activity.' });
    } finally {
      setSubmittingDemo(false);
    }
  };

  const filteredAlerts = alertCache.filter((item) => {
    const sevOk = severityFilter === 'all' || item.severity === severityFilter;
    const statOk = statusFilter === 'all' || item.status === statusFilter;
    const searchTarget = `${item.title || ''} ${item.employee || ''} ${item.activity || ''}`.toLowerCase();
    const searchOk = !searchQuery || searchTarget.includes(searchQuery.toLowerCase());
    return sevOk && statOk && searchOk;
  });

  const totalAlertPages = Math.ceil(filteredAlerts.length / ALERTS_PER_PAGE) || 1;
  const paginatedAlerts = filteredAlerts.slice(
    (alertsPage - 1) * ALERTS_PER_PAGE,
    alertsPage * ALERTS_PER_PAGE
  );

  const filteredLogs = logsList.filter((log) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (log.username && log.username.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q))
    );
  });

  const totalLogPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = filteredLogs.slice(
    (logsPage - 1) * LOGS_PER_PAGE,
    logsPage * LOGS_PER_PAGE
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Real-Time Monitoring
            </h1>
            <Badge variant={counters.open_alerts > 0 ? 'critical' : 'success'}>
              {counters.open_alerts > 0 ? `${counters.open_alerts} Active Breaches` : 'Continuous Monitoring'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Automated compliance engine matching employee activity against policy clauses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveView('alerts')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeView === 'alerts'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Incident Alerts ({alertCache.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('logs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeView === 'logs'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activity Logs ({logsList.length})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={RotateCw}
            loading={refreshing}
            onClick={() => loadMonitoring(true)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <span className="text-xs font-medium text-slate-600">Open alerts</span>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{counters.open_alerts || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <span className="text-xs font-medium text-red-800">Critical</span>
          <p className="mt-1 text-2xl font-bold text-red-700 tabular-nums">{counters.critical || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <span className="text-xs font-medium text-amber-800">High priority</span>
          <p className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">{counters.high || 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <span className="text-xs font-medium text-blue-800">Needs review</span>
          <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">{counters.needs_review || 0}</p>
        </div>
      </div>

      {/* Main Grid: Queue on Left, Simulator & Signals on Right */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Live Queue / Activity Logs (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeView === 'alerts' ? (
            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Live Alert Queue</CardTitle>
                    <CardDescription>
                      Showing {filteredAlerts.length} of {alertCache.length} compliance incident(s)
                    </CardDescription>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="grid gap-3 sm:grid-cols-12 pt-2">
                  <div className="sm:col-span-6 relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by title, actor, or activity..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setAlertsPage(1);
                      }}
                      className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={severityFilter}
                      onChange={(e) => {
                        setSeverityFilter(e.target.value);
                        setAlertsPage(1);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="all">All Severities</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setAlertsPage(1);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="Investigating">Investigating</option>
                      <option value="Queued">Queued</option>
                      <option value="Still Pending">Still Pending</option>
                      <option value="Observed">Observed</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <TableRowSkeleton count={4} />
                ) : paginatedAlerts && paginatedAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {paginatedAlerts.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-start justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge severity={item.severity} />
                            <span className="text-xs font-medium text-slate-500">
                              Status: <strong className="text-slate-700">{item.status || 'Open'}</strong>
                            </span>
                          </div>

                          <h4 className="font-headline text-base font-bold text-slate-900 leading-snug break-words">
                            {item.title || item.message}
                          </h4>

                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                            <p>
                              <span className="font-semibold text-slate-700">Actor:</span>{' '}
                              {item.employee || 'Unknown'}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-700">Detector:</span>{' '}
                              {item.owner || 'Policy Engine'}
                            </p>
                          </div>

                          {item.activity && (
                            <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 break-words">
                              {item.activity}
                            </div>
                          )}
                        </div>

                        <div className="flex md:flex-col gap-2 shrink-0 pt-2 md:pt-0">
                          {isComplianceOrAdmin() ? (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                icon={CheckCircle2}
                                onClick={() => handleAlertAction(item.id, 'solve')}
                                className="flex-1 md:flex-none"
                              >
                                Mark Solved
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Clock}
                                onClick={() => handleAlertAction(item.id, 'pending')}
                                className="flex-1 md:flex-none"
                              >
                                Keep Pending
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic px-2 py-1">
                              Triage restricted to Compliance / Admin
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Pagination Controls */}
                    {totalAlertPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                        <span className="text-slate-500">
                          Page {alertsPage} of {totalAlertPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={alertsPage <= 1}
                            onClick={() => setAlertsPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={alertsPage >= totalAlertPages}
                            onClick={() => setAlertsPage((p) => Math.min(totalAlertPages, p + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={ShieldAlert}
                    title="No Alerts Match Filters"
                    description="Adjust your search query or severity filter to see other events."
                    actionLabel="Clear Filters"
                    onAction={() => {
                      setSeverityFilter('all');
                      setStatusFilter('all');
                      setSearchQuery('');
                      setAlertsPage(1);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            /* ACTIVITY LOGS VIEW */
            <Card>
              <CardHeader className="flex flex-col gap-3">
                <CardTitle>Internal Activity Signal Logs</CardTitle>
                <CardDescription>
                  Raw audit records captured from organizational actors and simulator signals
                </CardDescription>

                <div className="relative w-full pt-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search logs by username or action..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setLogsPage(1);
                    }}
                    className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </CardHeader>

              <CardContent>
                {paginatedLogs.length > 0 ? (
                  <div className="space-y-3">
                    {paginatedLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{log.username || 'Unknown'}</span>
                            <span className="text-[11px] text-slate-400">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed break-words">{log.action}</p>
                        </div>
                      </div>
                    ))}

                    {/* Pagination */}
                    {totalLogPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                        <span className="text-slate-500">
                          Page {logsPage} of {totalLogPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={logsPage <= 1}
                            onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={logsPage >= totalLogPages}
                            onClick={() => setLogsPage((p) => Math.min(totalLogPages, p + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No Activity Logs"
                    description="No internal activity records found matching filters."
                    actionLabel="Clear Filter"
                    onAction={() => setSearchQuery('')}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Simulator & Feed (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Activity Simulator */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <CardTitle>Activity Simulator</CardTitle>
              </div>
              <CardDescription>
                Simulate internal activity to trigger automated policy rules and evaluate risks.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Preset Scenario Quick-Clicks */}
              <div className="mb-4">
                <span className="text-xs font-medium text-slate-500 block mb-2">
                  Test scenarios
                </span>
                <div className="space-y-1.5">
                  {DEMO_SCENARIOS.map((sc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyScenario(sc)}
                      className="w-full text-left p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{sc.label}</span>
                      <Badge severity={sc.severity} />
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleDemoSubmit} className="space-y-4 pt-3 border-t border-slate-100">
                <Input
                  label="Employee Username"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="username"
                  required
                />

                <Textarea
                  label="Action Description"
                  rows={4}
                  value={employeeAction}
                  onChange={(e) => setEmployeeAction(e.target.value)}
                  placeholder="e.g. Exported confidential customer database to personal USB device"
                  required
                />

                <Button
                  type="submit"
                  loading={submittingDemo}
                  disabled={!isComplianceOrAdmin()}
                  icon={Play}
                  fullWidth
                >
                  {isComplianceOrAdmin() ? 'Trigger Simulation' : 'Simulation Restricted (Compliance/Admin)'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Policy Signals Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Policy Signals Feed</CardTitle>
              <CardDescription>Automated rules generated by interpreter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedItems && feedItems.length > 0 ? (
                feedItems.map((feed, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                    <span className="text-xs font-semibold text-blue-700 block">
                      {feed.source || 'Policy Engine'}
                    </span>
                    <p className="text-xs font-bold text-slate-900">{feed.title}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{feed.description}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No Signals Yet" description="Upload policies to populate detection rules." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
