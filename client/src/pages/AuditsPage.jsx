import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  AlertCircle,
  Clock,
  ShieldAlert,
  RotateCw,
  FileDown,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';

export default function AuditsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ gaps: 0, due: 0, esc: 0 });

  const fetchAudits = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const data = await apiRequest('/api/site-data/');
      const auditItems = data.audit_items || [];
      setItems(auditItems);
      setStats({
        gaps: Math.max(0, (data.totals?.rules || 0) - 1),
        due: auditItems.length,
        esc: data.totals?.violations || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const handleExportEvidence = () => {
    const exportData = {
      title: 'Sentinel Core Compliance Audit Evidence Package',
      generated_at: new Date().toISOString(),
      stats,
      audit_items: items,
      engine: 'Sentinel Core MERN v1.0',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-audit-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Compliance Audits & Evidence
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit readiness timelines, evidence collection packages, and gap remediation tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RotateCw}
            loading={refreshing}
            onClick={() => fetchAudits(true)}
          >
            Refresh Audits
          </Button>
          <Button
            size="sm"
            icon={FileDown}
            onClick={handleExportEvidence}
          >
            Export Evidence Pack
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Evidence Gaps"
          value={stats.gaps}
          subtitle="Unassigned policy requirement clauses"
          icon={AlertCircle}
          accentColor="amber"
        />
        <StatCard
          title="Active Audit Tracks"
          value={stats.due}
          subtitle="Regulatory standards undergoing review"
          icon={Clock}
          accentColor="blue"
        />
        <StatCard
          title="Escalations"
          value={stats.esc}
          subtitle="Unresolved compliance incident breaches"
          icon={ShieldAlert}
          accentColor="red"
        />
      </div>

      {/* Main Audit Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Readiness Tracks</CardTitle>
          <CardDescription>
            Live status of regulatory framework evaluations and evidence milestones
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <TableRowSkeleton count={3} />
          ) : items && items.length > 0 ? (
            <div className="space-y-4">
              {items.map((item, idx) => {
                const isReady = item.progress >= 70;
                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-headline text-base font-bold text-slate-900">
                          {item.title}
                        </h4>
                        <Badge variant={isReady ? 'success' : 'high'}>
                          {item.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Target: End of Current Quarter
                        </span>
                        <span>•</span>
                        <span>Scope: Production Data & Employee Handbooks</span>
                      </div>

                      {/* Progress bar */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-600">Verification Progress</span>
                          <span className="text-blue-600 font-bold">{item.progress}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-[width] duration-500 ${
                              isReady ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 shrink-0 pt-2 md:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => alert(`Reviewing evidence package for ${item.title}`)}
                      >
                        Inspect Evidence
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="No Audit Tracks"
              description="Ingest policies to populate audit tracks."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
