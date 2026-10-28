/**
 * Sentinel Core — Demo Account Provisioning Script
 * 
 * Safely provisions or updates the two distinct demo accounts:
 *   1. demo.employee (Role: employee)
 *   2. demo.admin (Role: admin)
 * 
 * Execution:
 *   node server/scripts/provisionDemoAccounts.js
 * 
 * Requires:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configured in server/.env
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[Error] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMPLOYEE_PASS = process.env.DEMO_EMPLOYEE_PASSWORD || 'demo1234';
const DEMO_ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || 'adminDemo2026!';

async function provisionDemoAccounts() {
  console.log('\n=============================================');
  console.log(' PROVISIONING SENTINEL CORE DEMO ACCOUNTS');
  console.log('=============================================\n');

  const empHash = bcrypt.hashSync(DEMO_EMPLOYEE_PASS, 10);
  const adminHash = bcrypt.hashSync(DEMO_ADMIN_PASS, 10);

  const accounts = [
    {
      sqlite_id: 2,
      username: 'demo.employee',
      password: empHash,
      role: 'employee',
      email: 'demo.employee@sentinel.internal',
      first_name: 'Demo',
      last_name: 'Employee',
      is_active: true,
      date_joined: '2026-04-03T13:21:43.610Z',
    },
    {
      sqlite_id: 12,
      username: 'demo.admin',
      password: adminHash,
      role: 'admin',
      email: 'demo.admin@sentinel.internal',
      first_name: 'Demo',
      last_name: 'Administrator',
      is_active: true,
      date_joined: new Date().toISOString(),
    },
  ];

  for (const acc of accounts) {
    const { error } = await supabase
      .from('users')
      .upsert(acc, { onConflict: 'username' });

    if (error) {
      console.error(`[Error] Failed to upsert ${acc.username}:`, error.message);
    } else {
      console.log(`[Success] Provisioned ${acc.username} (role: '${acc.role}', is_active: ${acc.is_active})`);
    }
  }

  console.log('\nDemo accounts provisioning complete.');
}

if (require.main === module) {
  provisionDemoAccounts().catch((err) => {
    console.error('[Fatal Error]', err);
    process.exit(1);
  });
}

module.exports = { provisionDemoAccounts };
