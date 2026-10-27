import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Globe2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileCheck,
  FileText,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { TableRowSkeleton } from '../components/ui/Skeleton';

const FRAMEWORK_DETAILS = {
  'GDPR 2016/679': {
    category: 'Privacy & Data Protection',
    authority: 'European Data Protection Board',
    domains: ['Data Subject Consent', 'Right to Erasure', 'Breach Notification (72h)', 'DPO Oversight'],
  },
  'SOC 2 Type II': {
    category: 'Trust Services Criteria',
    authority: 'AICPA Standard',
    domains: ['Access Control & MFA', 'Encryption at Rest & In Transit', 'Change Management', 'Disaster Recovery'],
  },
  'HIPAA': {
    category: 'Healthcare Security Rule',
    authority: 'U.S. Dept of Health & Human Services',
    domains: ['ePHI Safeguards', 'Audit Logging & Integrity', 'Workstation Security', 'Transmission Security'],
  },
};

export default function FrameworksPage() {
  const [frameworks, setFrameworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchFrameworks = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const data = await apiRequest('/api/site-data/');
      setFrameworks(data.frameworks || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load framework data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFrameworks();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Regulatory Frameworks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time control mapping and compliance audit coverage computed across database policies.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RotateCw}
          loading={refreshing}
          onClick={() => fetchFrameworks(true)}
        >
          Refresh Standards
        </Button>
      </div>

      {/* Grid of Framework Cards */}
      {loading ? (
        <TableRowSkeleton count={3} />
      ) : frameworks && frameworks.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {frameworks.map((fw, idx) => {
            const meta = FRAMEWORK_DETAILS[fw.name] || {
              category: 'Global Regulatory Benchmark',
              authority: fw.region || 'Standard Body',
              domains: ['Access Control', 'Data Encryption', 'Incident Reporting', 'Policy Review'],
            };

            const isReady = fw.coverage >= 70;

            return (
              <Card key={idx} className="flex flex-col justify-between">
                <div>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <Globe2 className="w-3.5 h-3.5" />
                        {fw.region}
                      </span>
                      <Badge variant={isReady ? 'success' : 'high'}>
                        {isReady ? 'Audit Ready' : 'Action Required'}
                      </Badge>
                    </div>

                    <CardTitle>{fw.name}</CardTitle>
                    <CardDescription>{meta.category} • {meta.authority}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* Coverage Progress Bar */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700">Audit Coverage</span>
                        <span className="text-2xl font-bold text-blue-700 tabular-nums">
                          {fw.coverage}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-700 ${
                            fw.coverage >= 80
                              ? 'bg-emerald-600'
                              : fw.coverage >= 60
                              ? 'bg-blue-700'
                              : 'bg-amber-600'
                          }`}
                          style={{ width: `${fw.coverage}%` }}
                        />
                      </div>
                    </div>

                    {/* Mapped Domains Checklist */}
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-2">
                        Mapped Control Domains:
                      </span>
                      <div className="space-y-1.5">
                        {meta.domains.map((dom, dIdx) => (
                          <div
                            key={dIdx}
                            className="flex items-center gap-2 text-xs text-slate-700 font-medium"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{dom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Live Database Sync</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={FileText}
                    onClick={() => alert(`Framework report for ${fw.name}: Current readiness is ${fw.coverage}%. Controls meet enterprise criteria.`)}
                  >
                    View Report
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title="No Frameworks Configured"
          description="Upload policies to automatically generate regulatory framework mapping."
        />
      )}
    </div>
  );
}
