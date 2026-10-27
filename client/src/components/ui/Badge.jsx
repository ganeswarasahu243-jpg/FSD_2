import React from 'react';

export default function Badge({
  children,
  variant, // critical | high | medium | low | success | warning | info | neutral
  severity, // shorthand helper: Critical | High | Medium | Low | Healthy
  status, // Open | Investigating | Queued | Observed | Still Pending | Active
  className = '',
}) {
  let resolvedVariant = variant || 'neutral';

  const val = (severity || status || '').toLowerCase();
  if (val.includes('critical') || val.includes('risk') || val.includes('at risk')) {
    resolvedVariant = 'critical';
  } else if (val.includes('high') || val.includes('warning')) {
    resolvedVariant = 'high';
  } else if (val.includes('medium') || val.includes('investigating')) {
    resolvedVariant = 'medium';
  } else if (val.includes('success') || val.includes('healthy') || val.includes('ready') || val.includes('active') || val.includes('solved')) {
    resolvedVariant = 'success';
  } else if (val.includes('pending') || val.includes('still pending') || val.includes('queued')) {
    resolvedVariant = 'warning';
  } else if (val.includes('low') || val.includes('observed') || val.includes('monitoring')) {
    resolvedVariant = 'low';
  }

  const variantStyles = {
    critical: 'bg-red-50 text-red-800 border-red-200',
    high: 'bg-amber-50 text-amber-800 border-amber-200',
    medium: 'bg-blue-50 text-blue-800 border-blue-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-300',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }[resolvedVariant] || 'bg-slate-100 text-slate-700 border-slate-200';

  const dotColors = {
    critical: 'bg-red-600',
    high: 'bg-amber-600',
    medium: 'bg-blue-600',
    low: 'bg-slate-500',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    info: 'bg-sky-600',
    neutral: 'bg-slate-500',
  }[resolvedVariant] || 'bg-slate-500';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${variantStyles} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors}`} />
      <span>{children || severity || status}</span>
    </span>
  );
}
