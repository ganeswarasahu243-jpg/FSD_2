import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RotateCw,
  PlusCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { apiRequest, isComplianceOrAdmin } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import EmptyState from '../components/ui/EmptyState';
import { StatCardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    totals: { policies: 0, rules: 0, logs: 0, violations: 0 },
    recent_policies: [],
    recent_violations: [],
    frameworks: [],
    alert_summary: { open_alerts: 0, critical: 0, high: 0, needs_review: 0 },
    alert_items: [],
  });
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  const loadDashboard = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiRequest('/api/site-data/');
      setData(res);
      setFeedback(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load dashboard data.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleAlertAction = async (alertId, action) => {
    if (!alertId) {
      setFeedback({
        type: 'warning',
        message: 'This alert record has no database ID. Refresh the page after creating a new alert.',
      });
      return;
    }

    try {
      const endpoint =
        action === 'solve'
          ? `/api/alerts/${alertId}/resolve/`
          : `/api/alerts/${alertId}/pending/`;

      const result = await apiRequest(endpoint, { method: 'POST' });

      if (action === 'solve') {
        setData((prev) => ({
          ...prev,
          alert_items: prev.alert_items.filter((item) => String(item.id) !== String(alertId)),
          totals: {
            ...prev.totals,
            violations: Math.max(0, (prev.totals.violations || 1) - 1),
          },
          alert_summary: {
            ...prev.alert_summary,
            open_alerts: Math.max(0, (prev.alert_summary.open_alerts || 1) - 1),
          },
        }));
        setFeedback({
          type: 'success',
          message: result.detail || 'Alert resolved and removed from queue.',
        });
      } else if (action === 'pending' && result.alert) {
        setData((prev) => ({
          ...prev,
          alert_items: prev.alert_items.map((item) =>
            String(item.id) === String(alertId)
              ? { ...item, status: result.alert.status || 'Still Pending' }
              : item
          ),
        }));
        setFeedback({
          type: 'info',
          message: result.detail || 'Alert marked as still pending.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update alert state.',
      });
    }
  };

  const { totals, recent_policies, recent_violations, frameworks, alert_summary, alert_items } = data;
  const filteredAlerts = (alert_items || []).filter((item) => item.severity !== 'Healthy');

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Compliance Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time policy ingestion metrics, audit readiness, and incident alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RotateCw}
            loading={refreshing}
            onClick={() => loadDashboard(true)}
          >
            Refresh Data
          </Button>
          <Link to="/policies">
            <Button size="sm" icon={isComplianceOrAdmin() ? PlusCircle : FileText}>
              {isComplianceOrAdmin() ? 'Ingest Policy' : 'View Policies'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <Alert
          variant={feedback.type}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Primary KPI Metrics */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Policies"
            value={totals.policies || 0}
            subtitle="Ingested policy documents"
            icon={FileText}
            accentColor="blue"
          />
          <StatCard
            title="Extracted Rules"
            value={totals.rules || 0}
            subtitle="Active regulatory clauses"
            icon={ShieldCheck}
            accentColor="indigo"
          />
          <StatCard
            title="Activity Logs"
            value={totals.logs || 0}
            subtitle="Tracked employee signals"
            icon={Activity}
            accentColor="amber"
          />
          <StatCard
            title="Policy Violations"
            value={totals.violations || 0}
            subtitle="Actionable compliance alerts"
            icon={AlertTriangle}
            accentColor="red"
          />
        </div>
      )}

      {/* Incident Watch & Alert Triage Queue */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Incident Watch & Alert Queue</CardTitle>
              <Badge
                variant={alert_summary.open_alerts > 0 ? 'critical' : 'success'}
              >
                {alert_summary.open_alerts > 0
                  ? `${alert_summary.open_alerts} Open Issues`
                  : 'All Systems Compliant'}
              </Badge>
            </div>
            <CardDescription>
              Review active policy breaches, triage audit risks, and mark confirmed resolutions.
            </CardDescription>
          </div>

          <Link to="/monitoring">
            <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right">
              View Monitoring Center
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {/* Severity Breakdown Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-medium text-slate-600">Open alerts</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{alert_summary.open_alerts || 0}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
              <span className="text-xs font-medium text-red-800">Critical risks</span>
              <p className="mt-1 text-2xl font-bold text-red-700 tabular-nums">{alert_summary.critical || 0}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <span className="text-xs font-medium text-amber-800">High priority</span>
              <p className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">{alert_summary.high || 0}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <span className="text-xs font-medium text-blue-800">Needs review</span>
              <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">{alert_summary.needs_review || 0}</p>
            </div>
          </div>

          {/* Alert Cards Grid */}
          {loading ? (
            <TableRowSkeleton count={3} />
          ) : filteredAlerts && filteredAlerts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAlerts.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-white card-hover"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <Badge severity={item.severity} />
                      <span className="text-xs font-medium text-slate-500">{item.status || 'Open'}</span>
                    </div>

                    <h4 className="font-headline text-base font-bold text-slate-900 leading-snug line-clamp-2">
                      {item.title || item.message}
                    </h4>

                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>
                        <span className="font-semibold text-slate-700">Actor:</span>{' '}
                        {item.employee || 'Unknown'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Detection:</span>{' '}
                        {item.owner || 'Policy Engine'}
                      </p>
                    </div>

                    {item.activity && (
                      <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 line-clamp-2">
                        {item.activity}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                    {isComplianceOrAdmin() ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          icon={CheckCircle2}
                          onClick={() => handleAlertAction(item.id, 'solve')}
                        >
                          Solved
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Clock}
                          onClick={() => handleAlertAction(item.id, 'pending')}
                        >
                          Pending
                        </Button>
                      </>
                    ) : (
                      <span className="col-span-2 text-[11px] text-slate-400 italic py-1 text-center">
                        Triage restricted to Compliance / Admin
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              title="No Active Alerts"
              description="No compliance breaches or policy violations have been detected in your activity stream."
              actionLabel="Simulate Activity"
              onAction={() => (window.location.href = '/monitoring')}
            />
          )}
        </CardContent>
      </Card>

      {/* Policies & Violations History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Policies */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Policies</CardTitle>
              <CardDescription>Latest parsed compliance handbooks</CardDescription>
            </div>
            <Link to="/policies" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition">
              View All &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent_policies && recent_policies.length > 0 ? (
              recent_policies.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500">{p.source_name || 'Direct Text Input'}</p>
                    </div>
                  </div>
                  <Link
                    to="/policies"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              ))
            ) : (
              <EmptyState title="No policies yet" description="Upload a policy document to generate rules." />
            )}
          </CardContent>
        </Card>

        {/* Framework Coverage */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Framework Alignment</CardTitle>
              <CardDescription>Regulatory compliance audit status</CardDescription>
            </div>
            <Link to="/frameworks" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition">
              Details &rarr;
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {frameworks && frameworks.length > 0 ? (
              frameworks.map((fw, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-white">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-xs font-medium text-slate-500">{fw.region}</span>
                      <p className="text-sm font-semibold text-slate-900">{fw.name}</p>
                    </div>
                    <span className="text-base font-bold text-blue-700 tabular-nums">{fw.coverage}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ${
                        fw.coverage >= 80 ? 'bg-emerald-600' : fw.coverage >= 60 ? 'bg-blue-700' : 'bg-amber-600'
                      }`}
                      style={{ width: `${fw.coverage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No framework data" description="Ingest policies to establish audit coverage." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
