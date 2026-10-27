import React from 'react';

export function Input({
  label,
  id,
  type = 'text',
  error,
  helperText,
  icon: Icon = null,
  className = '',
  required = false,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs md:text-sm font-medium text-slate-700"
        >
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      <div className="relative rounded-lg">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          required={required}
          className={`block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
            Icon ? 'pl-9' : ''
          } ${
            error
              ? 'border-red-400 focus:border-red-600 focus:ring-red-600'
              : 'border-slate-300 focus:border-blue-600'
          } ${className}`}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-600">{helperText}</p>
      ) : null}
    </div>
  );
}

export function Textarea({
  label,
  id,
  error,
  helperText,
  rows = 4,
  className = '',
  required = false,
  ...props
}) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs md:text-sm font-medium text-slate-700"
        >
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        rows={rows}
        required={required}
        className={`block w-full rounded-lg border bg-white p-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
          error
            ? 'border-red-400 focus:border-red-600 focus:ring-red-600'
            : 'border-slate-300 focus:border-blue-600'
        } ${className}`}
        {...props}
      />

      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-600">{helperText}</p>
      ) : null}
    </div>
  );
}

export default Input;
