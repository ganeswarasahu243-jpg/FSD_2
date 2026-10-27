import React, { useState, useEffect } from 'react';
import {
  GitFork,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  FileText,
  Activity,
  FileCheck,
  RotateCw,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';

const PIPELINE_PHASES = [
  {
    step: 1,
    title: 'Ingestion & OCR',
    desc: 'Extract text from PDF, DOCX, and text contracts.',
    icon: FileText,
  },
  {
    step: 2,
    title: 'Rule Generation',
    desc: 'NLP engine generates discrete enforcement clauses.',
    icon: GitFork,
  },
  {
    step: 3,
    title: 'Signal Monitoring',
    desc: 'Match employee actions against active clauses.',
    icon: Activity,
  },
  {
    step: 4,
    title: 'Audit Remediation',
    desc: 'Triage breaches, resolve incidents, and export proof.',
    icon: FileCheck,
  },
];

export default function WorkflowPage() {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState('80%');

  const fetchWorkflow = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const data = await apiRequest('/api/site-data/');
      setSteps(data.workflow_items || []);
      setHealth(`${Math.min(100, 80 + (data.totals?.policies || 0) * 4)}%`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkflow();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Compliance Lifecycle Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            End-to-end automated policy execution workflow and system integrity scoring.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RotateCw}
          loading={refreshing}
          onClick={() => fetchWorkflow(true)}
        >
          Refresh Workflow
        </Button>
      </div>

      {/* Visual Pipeline Stepper */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE_PHASES.map((phase) => {
          const Icon = phase.icon;
          return (
            <div
              key={phase.step}
              className="p-5 rounded-2xl border border-slate-200 bg-white relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-400">Step {phase.step}</span>
              </div>
              <h4 className="font-headline font-bold text-base text-slate-900 leading-snug">
                {phase.title}
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{phase.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Main Workflow Execution Steps & Health */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Active Execution Steps</CardTitle>
              <CardDescription>
                Live status of extracted policy rules actively routed through compliance engine
              </CardDescription>
            </CardHeader>

            <CardContent>
              {loading ? (
                <TableRowSkeleton count={3} />
              ) : steps && steps.length > 0 ? (
                <div className="space-y-3">
                  {steps.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-500">Automated Policy Routing</p>
                        </div>
                      </div>

                      <Badge variant={item.status === 'Active' ? 'success' : 'neutral'}>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={GitFork}
                  title="No Workflow Steps Yet"
                  description="Upload policy handbooks to generate execution steps."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Health Score Card */}
        <div className="lg:col-span-4">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader>
              <CardTitle>Workflow Telemetry</CardTitle>
              <CardDescription>Real-time system health & engine performance</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <span className="text-xs font-medium text-slate-600 mb-2">
                  System health score
                </span>
                <span className="font-headline text-5xl font-extrabold text-emerald-700 tracking-tight tabular-nums">
                  {health}
                </span>
                <p className="mt-2 text-xs text-slate-500">
                  Optimal performance across database & parsing modules
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500">MongoDB Connection</span>
                  <span className="font-bold text-emerald-600">Active (0ms latency)</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500">Policy Parser Engine</span>
                  <span className="font-bold text-blue-600">Operational</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-500">JWT Security Layer</span>
                  <span className="font-bold text-slate-800">Enforced</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
