import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export default function Alert({
  variant = 'info', // success | error | warning | info
  title = null,
  children,
  onClose = null,
  className = '',
}) {
  const configs = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      iconColor: 'text-emerald-600',
      icon: CheckCircle2,
    },
    error: {
      bg: 'bg-red-50 border-red-200 text-red-900',
      iconColor: 'text-red-600',
      icon: AlertCircle,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      iconColor: 'text-amber-600',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      iconColor: 'text-blue-600',
      icon: Info,
    },
  }[variant] || {
    bg: 'bg-blue-50 border-blue-200 text-blue-900',
    iconColor: 'text-blue-600',
    icon: Info,
  };

  const Icon = configs.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm animate-fade-in ${configs.bg} ${className}`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${configs.iconColor}`} />
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold text-sm mb-1">{title}</h5>}
        <div className="text-sm leading-relaxed opacity-90">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-black/5 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
