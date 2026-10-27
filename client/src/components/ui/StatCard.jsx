import React from 'react';
import Card from './Card';

export default function StatCard({
  title,
  value,
  subtitle = null,
  icon: Icon = null,
  trend = null, // { value: "+12%", positive: true }
  className = '',
}) {
  return (
    <Card className={`p-5 hover:border-slate-300 transition-colors duration-150 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs md:text-sm font-medium text-slate-600">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <h4 className="font-headline text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">
              {value}
            </h4>
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.positive ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {trend.value}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-600 line-clamp-1">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className="text-slate-500 shrink-0 mt-0.5">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
