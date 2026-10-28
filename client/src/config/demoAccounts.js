/**
 * Sentinel Core Demo Accounts Configuration
 * 
 * Provides metadata, role summaries, and permission scopes for the demo accounts
 * featured on the login screen.
 * 
 * In accordance with enterprise security standards, passwords are NOT hardcoded in source.
 * They are resolved dynamically from environment configuration:
 *   - VITE_DEMO_EMPLOYEE_PASSWORD
 *   - VITE_DEMO_ADMIN_PASSWORD
 */

export const DEMO_ACCOUNTS = {
  employee: {
    id: 'demo.employee',
    title: 'Employee Demo',
    roleLabel: 'Employee',
    badge: 'Standard Access',
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    accentBorder: 'border-emerald-500/30 hover:border-emerald-400',
    accentText: 'text-emerald-400',
    username: import.meta.env.VITE_DEMO_EMPLOYEE_USERNAME || 'demo.employee',
    password: import.meta.env.VITE_DEMO_EMPLOYEE_PASSWORD || '',
    summary: 'Standard employee workspace. Access published organizational policies and submit personal compliance activity logs.',
    capabilities: [
      'Browse published organizational policies',
      'Submit daily workflow activity logs',
      'View personal compliance telemetry',
    ],
    restrictions: [
      'Restricted from AI policy ingestion & parsing',
      'Restricted from alert triage & resolution',
      'Restricted from activity breach simulation',
      'Restricted from user & role administration',
    ],
  },
  admin: {
    id: 'demo.admin',
    title: 'Administrator Demo',
    roleLabel: 'Administrator',
    badge: 'Full Access',
    badgeStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    accentBorder: 'border-blue-500/30 hover:border-blue-400',
    accentText: 'text-blue-400',
    username: import.meta.env.VITE_DEMO_ADMIN_USERNAME || 'demo.admin',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || '',
    summary: 'Comprehensive compliance and admin control. Ingest policies, execute AI interpretations, simulate breaches, and triage alerts.',
    capabilities: [
      'Upload & ingest raw policy PDFs and documents',
      'Run AI policy interpretation & rule generation',
      'Execute compliance activity simulation demo',
      'Triage, resolve, or escalate policy violations',
      'Manage organizational users and role permissions',
    ],
    restrictions: [],
  },
};
