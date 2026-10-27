const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[Error] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const backupFile = path.resolve(__dirname, '..', '..', 'backups', 'mongo_backup_sentinel_compliance.json');

async function seed() {
  console.log('\n=============================================');
  console.log(' SEEDING AUTHORITATIVE DATA TO SUPABASE');
  console.log('=============================================\n');

  const raw = fs.readFileSync(backupFile, 'utf8');
  const data = JSON.parse(raw);
  const { users = [], policies = [], rules = [], logs = [], violations = [] } = data;

  // 1. Seed Users
  console.log(`[Seed] Inserting ${users.length} users...`);
  const userMongoIdToSqlId = new Map();
  let userNextId = 1;

  for (const u of users) {
    const id = u.sqliteId || userNextId;
    userMongoIdToSqlId.set(u._id, id);
    userNextId = Math.max(userNextId, id + 1);

    const userPayload = {
      id,
      sqlite_id: id,
      username: u.username,
      password: u.password || '',
      role: u.role || 'employee',
      email: u.email || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      is_active: u.is_active !== false,
      date_joined: u.date_joined || u.createdAt || new Date().toISOString(),
      created_at: u.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('users').upsert(userPayload, { onConflict: 'username' });
    if (error) {
      console.warn(`[Seed User Warning] ${u.username}:`, error.message);
    } else {
      console.log(`[Seed User] Inserted/Verified: ${u.username} (ID: ${id})`);
    }
  }

  // 2. Seed Policies
  console.log(`\n[Seed] Inserting ${policies.length} policies...`);
  const policyMongoIdToSqlId = new Map();
  let policyNextId = 1;

  for (const p of policies) {
    const id = p.sqliteId || policyNextId;
    policyMongoIdToSqlId.set(p._id, id);
    policyNextId = Math.max(policyNextId, id + 1);

    const uploadedBy = p.uploaded_by ? userMongoIdToSqlId.get(p.uploaded_by) || null : null;
    const policyPayload = {
      id,
      sqlite_id: id,
      title: p.title,
      document: p.document || null,
      source_name: p.source_name || '',
      content_text: p.content_text || '',
      uploaded_by: uploadedBy,
      uploaded_by_username: p.uploaded_by_username || 'Unknown',
      created_at: p.created_at || p.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('policies').upsert(policyPayload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Seed Policy Warning] ${p.title}:`, error.message);
    } else {
      console.log(`[Seed Policy] Inserted/Verified: ${p.title} (ID: ${id})`);
    }
  }

  // 3. Seed Rules
  console.log(`\n[Seed] Inserting ${rules.length} rules...`);
  let ruleNextId = 1;

  for (const r of rules) {
    const id = r.sqliteId || ruleNextId;
    ruleNextId = Math.max(ruleNextId, id + 1);

    const policyId = policyMongoIdToSqlId.get(r.policy) || null;
    if (!policyId) continue;

    const rulePayload = {
      id,
      sqlite_id: id,
      policy_id: policyId,
      description: r.description || '',
      condition: r.condition || '',
      action: r.action || '',
      created_at: r.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('rules').upsert(rulePayload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Seed Rule Warning] Rule ${id}:`, error.message);
    } else {
      console.log(`[Seed Rule] Inserted: Rule ${id} for Policy ${policyId}`);
    }
  }

  // 4. Seed Logs
  console.log(`\n[Seed] Inserting ${logs.length} logs...`);
  const logMongoIdToSqlId = new Map();
  let logNextId = 1;

  for (const l of logs) {
    const id = l.sqliteId || logNextId;
    logMongoIdToSqlId.set(l._id, id);
    logNextId = Math.max(logNextId, id + 1);

    const userId = l.user ? userMongoIdToSqlId.get(l.user) || null : null;
    const logPayload = {
      id,
      sqlite_id: id,
      user_id: userId,
      username: l.username || 'Unknown',
      action: l.action || '',
      created_at: l.created_at || l.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('logs').upsert(logPayload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Seed Log Warning] Log ${id}:`, error.message);
    } else {
      console.log(`[Seed Log] Inserted: "${l.action}" (ID: ${id})`);
    }
  }

  // 5. Seed Violations
  console.log(`\n[Seed] Inserting ${violations.length} violations...`);
  let violationNextId = 1;

  for (const v of violations) {
    const id = v.sqliteId || violationNextId;
    violationNextId = Math.max(violationNextId, id + 1);

    const logId = logMongoIdToSqlId.get(v.log) || null;
    if (!logId) continue;

    const violationPayload = {
      id,
      sqlite_id: id,
      log_id: logId,
      message: v.message || '',
      created_at: v.created_at || v.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('violations').upsert(violationPayload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Seed Violation Warning] Violation ${id}:`, error.message);
    } else {
      console.log(`[Seed Violation] Inserted: Violation ${id} for Log ${logId}`);
    }
  }

  // Verification Counts
  const [
    { count: uCount },
    { count: pCount },
    { count: rCount },
    { count: lCount },
    { count: vCount },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('policies').select('*', { count: 'exact', head: true }),
    supabase.from('rules').select('*', { count: 'exact', head: true }),
    supabase.from('logs').select('*', { count: 'exact', head: true }),
    supabase.from('violations').select('*', { count: 'exact', head: true }),
  ]);

  console.log('\n=============================================');
  console.log(' SUPABASE SEED VERIFICATION COMPLETE');
  console.log('=============================================');
  console.log(`Users:      ${uCount}`);
  console.log(`Policies:   ${pCount}`);
  console.log(`Rules:      ${rCount}`);
  console.log(`Logs:       ${lCount}`);
  console.log(`Violations: ${vCount}`);
  console.log('=============================================\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
