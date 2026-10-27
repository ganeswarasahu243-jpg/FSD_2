require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const backupDir = path.resolve(__dirname, '..', '..', 'backups');
const backupFile = path.resolve(backupDir, 'mongo_backup_sentinel_compliance.json');
const mediaDir = path.resolve(backupDir, 'media_policies');
const seedSqlFile = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000001_seed_sentinel_data.sql');

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = typeof val === 'object' && val instanceof Date ? val.toISOString() : val.toString();
  return `'${str.replace(/'/g, "''")}'`;
}

async function migrate() {
  console.log('\n======================================================');
  console.log(' SUPABASE POSTGRESQL & STORAGE DATA MIGRATION');
  console.log('======================================================\n');

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Authoritative backup not found at ${backupFile}. Run 'node server/scripts/backupData.js' first.`);
  }

  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const { users = [], policies = [], rules = [], logs = [], violations = [] } = data;

  console.log(`[Migration] Source records loaded:`);
  console.log(`  Users:      ${users.length}`);
  console.log(`  Policies:   ${policies.length}`);
  console.log(`  Rules:      ${rules.length}`);
  console.log(`  Logs:       ${logs.length}`);
  console.log(`  Violations: ${violations.length}`);

  // 1. Generate version-controlled SQL seed migration
  console.log(`\n[Migration] Generating SQL seed migration: ${seedSqlFile}`);
  const sqlLines = [
    '-- ==============================================================================',
    '-- SVP Sentinel Core Seed Migration',
    '-- Migration: 20261027000001_seed_sentinel_data.sql',
    '-- Description: Idempotent data seed for users, policies, rules, logs, violations.',
    '-- ==============================================================================\n',
  ];

  // Users
  sqlLines.push('-- 1. Seed Users');
  const userMongoIdToSqlId = new Map();
  let userNextId = 1;

  for (const u of users) {
    const id = u.sqliteId || userNextId;
    userMongoIdToSqlId.set(u._id, id);
    userNextId = Math.max(userNextId, id + 1);

    const username = escapeSql(u.username);
    const password = escapeSql(u.password || '');
    const role = escapeSql(u.role || 'employee');
    const email = escapeSql(u.email || '');
    const firstName = escapeSql(u.first_name || '');
    const lastName = escapeSql(u.last_name || '');
    const isActive = u.is_active !== false ? 'TRUE' : 'FALSE';
    const dateJoined = escapeSql(u.date_joined || u.createdAt || new Date());
    const createdAt = escapeSql(u.createdAt || new Date());

    sqlLines.push(
      `INSERT INTO public.users (id, sqlite_id, username, password, role, email, first_name, last_name, is_active, date_joined, created_at) ` +
      `VALUES (${id}, ${id}, ${username}, ${password}, ${role}, ${email}, ${firstName}, ${lastName}, ${isActive}, ${dateJoined}, ${createdAt}) ` +
      `ON CONFLICT (username) DO UPDATE SET ` +
      `sqlite_id = EXCLUDED.sqlite_id, role = EXCLUDED.role, email = EXCLUDED.email, ` +
      `first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;`
    );
  }

  sqlLines.push(`SELECT setval(pg_get_serial_sequence('public.users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.users));\n`);

  // Policies
  sqlLines.push('-- 2. Seed Policies');
  const policyMongoIdToSqlId = new Map();
  let policyNextId = 1;

  for (const p of policies) {
    const id = p.sqliteId || policyNextId;
    policyMongoIdToSqlId.set(p._id, id);
    policyNextId = Math.max(policyNextId, id + 1);

    const title = escapeSql(p.title);
    const document = escapeSql(p.document || null);
    const sourceName = escapeSql(p.source_name || '');
    const contentText = escapeSql(p.content_text || '');
    const uploadedBy = p.uploaded_by ? userMongoIdToSqlId.get(p.uploaded_by) || 'NULL' : 'NULL';
    const uploadedByUsername = escapeSql(p.uploaded_by_username || 'Unknown');
    const createdAt = escapeSql(p.created_at || p.createdAt || new Date());

    sqlLines.push(
      `INSERT INTO public.policies (id, sqlite_id, title, document, source_name, content_text, uploaded_by, uploaded_by_username, created_at) ` +
      `VALUES (${id}, ${id}, ${title}, ${document}, ${sourceName}, ${contentText}, ${uploadedBy}, ${uploadedByUsername}, ${createdAt}) ` +
      `ON CONFLICT (id) DO UPDATE SET ` +
      `title = EXCLUDED.title, document = EXCLUDED.document, source_name = EXCLUDED.source_name, ` +
      `content_text = EXCLUDED.content_text, uploaded_by = EXCLUDED.uploaded_by;`
    );
  }

  sqlLines.push(`SELECT setval(pg_get_serial_sequence('public.policies', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.policies));\n`);

  // Rules
  sqlLines.push('-- 3. Seed Rules');
  let ruleNextId = 1;
  for (const r of rules) {
    const id = r.sqliteId || ruleNextId;
    ruleNextId = Math.max(ruleNextId, id + 1);

    const policyId = policyMongoIdToSqlId.get(r.policy) || 'NULL';
    if (policyId === 'NULL') continue;

    const description = escapeSql(r.description || '');
    const condition = escapeSql(r.condition || '');
    const action = escapeSql(r.action || '');
    const createdAt = escapeSql(r.createdAt || new Date());

    sqlLines.push(
      `INSERT INTO public.rules (id, sqlite_id, policy_id, description, condition, action, created_at) ` +
      `VALUES (${id}, ${id}, ${policyId}, ${description}, ${condition}, ${action}, ${createdAt}) ` +
      `ON CONFLICT (id) DO UPDATE SET ` +
      `description = EXCLUDED.description, condition = EXCLUDED.condition, action = EXCLUDED.action;`
    );
  }

  sqlLines.push(`SELECT setval(pg_get_serial_sequence('public.rules', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.rules));\n`);

  // Logs
  sqlLines.push('-- 4. Seed Logs');
  const logMongoIdToSqlId = new Map();
  let logNextId = 1;
  for (const l of logs) {
    const id = l.sqliteId || logNextId;
    logMongoIdToSqlId.set(l._id, id);
    logNextId = Math.max(logNextId, id + 1);

    const userId = l.user ? userMongoIdToSqlId.get(l.user) || 'NULL' : 'NULL';
    const username = escapeSql(l.username || 'Unknown');
    const action = escapeSql(l.action || '');
    const createdAt = escapeSql(l.created_at || l.createdAt || new Date());

    sqlLines.push(
      `INSERT INTO public.logs (id, sqlite_id, user_id, username, action, created_at) ` +
      `VALUES (${id}, ${id}, ${userId}, ${username}, ${action}, ${createdAt}) ` +
      `ON CONFLICT (id) DO UPDATE SET ` +
      `action = EXCLUDED.action, username = EXCLUDED.username;`
    );
  }

  sqlLines.push(`SELECT setval(pg_get_serial_sequence('public.logs', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.logs));\n`);

  // Violations
  sqlLines.push('-- 5. Seed Violations');
  let violationNextId = 1;
  for (const v of violations) {
    const id = v.sqliteId || violationNextId;
    violationNextId = Math.max(violationNextId, id + 1);

    const logId = logMongoIdToSqlId.get(v.log) || 'NULL';
    if (logId === 'NULL') continue;

    const message = escapeSql(v.message || '');
    const createdAt = escapeSql(v.created_at || v.createdAt || new Date());

    sqlLines.push(
      `INSERT INTO public.violations (id, sqlite_id, log_id, message, created_at) ` +
      `VALUES (${id}, ${id}, ${logId}, ${message}, ${createdAt}) ` +
      `ON CONFLICT (id) DO UPDATE SET ` +
      `message = EXCLUDED.message;`
    );
  }

  sqlLines.push(`SELECT setval(pg_get_serial_sequence('public.violations', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.violations));\n`);

  fs.writeFileSync(seedSqlFile, sqlLines.join('\n'), 'utf8');
  console.log(`[Migration] SQL seed file successfully written to ${seedSqlFile}`);

  // 2. Programmatic Supabase API Migration (if credentials provided)
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('placeholder') || supabaseUrl.includes('your-project')) {
    console.log('\n[Notice] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in .env.');
    console.log('[Notice] SQL migrations are ready in supabase/migrations/ and will apply automatically when connected.');
    return;
  }

  console.log(`\n[Migration] Connecting to Supabase project at ${supabaseUrl}...`);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Upload files to Supabase Storage
  if (fs.existsSync(mediaDir)) {
    console.log('[Migration] Uploading files to Supabase Storage bucket: policies');
    const files = fs.readdirSync(mediaDir);
    for (const f of files) {
      const fullPath = path.join(mediaDir, f);
      if (fs.statSync(fullPath).isFile()) {
        const fileBytes = fs.readFileSync(fullPath);
        const storagePath = `policies/${f}`;
        const { error } = await supabase.storage.from('policies').upload(storagePath, fileBytes, {
          upsert: true,
        });
        if (error) {
          console.warn(`[Storage] Notice on ${storagePath}: ${error.message}`);
        } else {
          console.log(`[Storage] Uploaded ${storagePath}`);
        }
      }
    }
  }

  console.log('\n[Migration] Completed successfully!');
}

migrate().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
