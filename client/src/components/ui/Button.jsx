import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary', // primary | secondary | outline | ghost | danger | success
  size = 'md', // sm | md | lg
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-9',
    lg: 'text-base px-5 py-2.5 gap-2.5 h-11',
  }[size] || 'text-sm px-4 py-2 gap-2 h-9';

  const variantStyles = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white active:bg-blue-800',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-900 border border-slate-200',
    outline:
      'bg-white hover:bg-slate-50 text-slate-800 hover:text-slate-900 border border-slate-300 hover:border-slate-400',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900',
    danger:
      'bg-red-600 hover:bg-red-700 text-white active:bg-red-800',
    success:
      'bg-emerald-700 hover:bg-emerald-800 text-white active:bg-emerald-900',
  }[variant] || 'bg-blue-600 hover:bg-blue-700 text-white';

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
        </>
      )}
    </button>
  );
}
