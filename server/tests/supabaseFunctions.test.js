const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('\n======================================================');
  console.log(' SUPABASE EDGE FUNCTIONS & POSTGRESQL VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // --- 1. Schema & Migrations Tests ---
  await test('PostgreSQL Schema Migration exists with all tables & RLS', async () => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000000_create_sentinel_schema.sql');
    if (!fs.existsSync(schemaPath)) throw new Error('Schema migration missing');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    const requiredTables = ['public.users', 'public.policies', 'public.rules', 'public.logs', 'public.violations'];
    for (const tbl of requiredTables) {
      if (!sql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`)) {
        throw new Error(`Missing table definition for ${tbl}`);
      }
    }

    if (!sql.includes('ENABLE ROW LEVEL SECURITY')) throw new Error('Missing RLS enabling');
    if (!sql.includes("'policies', 'policies'")) throw new Error('Missing storage bucket setup for policies');
  });

  await test('PostgreSQL Data Seed Migration exists with all authoritative records', async () => {
    const seedPath = path.resolve(__dirname, '..', '..', 'supabase', 'migrations', '20261027000001_seed_sentinel_data.sql');
    if (!fs.existsSync(seedPath)) throw new Error('Seed migration missing');
    const sql = fs.readFileSync(seedPath, 'utf8');

    if (!sql.includes('INSERT INTO public.users')) throw new Error('Missing users seed');
    if (!sql.includes('INSERT INTO public.policies')) throw new Error('Missing policies seed');
    if (!sql.includes('INSERT INTO public.rules')) throw new Error('Missing rules seed');
    if (!sql.includes('INSERT INTO public.logs')) throw new Error('Missing logs seed');
    if (!sql.includes('INSERT INTO public.violations')) throw new Error('Missing violations seed');
  });

  // --- 2. Auth & Cryptographic Parity Tests ---
  const authModule = await import('../../supabase/functions/_shared/auth.ts');

  await test('Bcrypt password hashing and verification', async () => {
    const plain = 'SentinelPass2026!';
    const hash = authModule.hashPassword(plain);
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
      throw new Error(`Unexpected hash format: ${hash}`);
    }
    const match = await authModule.verifyPassword(plain, hash);
    if (!match) throw new Error('Bcrypt password should match');
    const wrongMatch = await authModule.verifyPassword('wrongPassword', hash);
    if (wrongMatch) throw new Error('Bcrypt wrong password should not match');
  });

  await test('Django PBKDF2 SHA-256 password hash verification', async () => {
    const testHash = 'pbkdf2_sha256$1000000$9AcOXEsW9QyvgY78rkYL6t$AvXx3tUvU3sBSEaYo6O7E2XkEWoYs5+wZM2J8Zchjhg=';
    const wrongMatch = await authModule.verifyPassword('invalid_pass_xyz', testHash);
    if (wrongMatch) throw new Error('Wrong password matched PBKDF2');

    // Test synthesized PBKDF2 parity with known password
    const crypto = require('crypto');
    const salt = 'customSalt123';
    const iter = 10000;
    const pwd = 'TestUserSecret!';
    const derived = crypto.pbkdf2Sync(pwd, salt, iter, 32, 'sha256').toString('base64');
    const synthHash = `pbkdf2_sha256$${iter}$${salt}$${derived}`;

    const match = await authModule.verifyPassword(pwd, synthHash);
    if (!match) throw new Error('Synthesized PBKDF2 did not verify correctly');
  });

  await test('JWT Token Generation and Verification', async () => {
    const user = { id: 42, sqlite_id: 42, username: 'compliance_lead', role: 'admin' };
    const { access, refresh } = await authModule.generateTokens(user);
    if (!access || !refresh) throw new Error('Tokens were not generated');

    const decoded = await authModule.verifyToken(access);
    if (!decoded || decoded.username !== 'compliance_lead' || decoded.role !== 'admin') {
      throw new Error('Decoded token payload does not match');
    }

    const invalid = await authModule.verifyToken('invalid.jwt.token');
    if (invalid !== null) throw new Error('Invalid token should return null');
  });

  // --- 3. Rule Engine Tests ---
  const ruleModule = await import('../../supabase/functions/_shared/ruleEngine.ts');

  await test('Rule Engine keyword severity classification', async () => {
    if (ruleModule.severityFromText('Employee leaked confidential customer data') !== 'Critical') {
      throw new Error('Confidential customer data should be Critical');
    }
    if (ruleModule.severityFromText('Exported logs to usb device') !== 'High') {
      throw new Error('Exported logs to usb should be High');
    }
    if (ruleModule.severityFromText('Late report retry warning') !== 'Medium') {
      throw new Error('Late retry should be Medium');
    }
    if (ruleModule.severityFromText('Normal routine check') !== 'Low') {
      throw new Error('Normal activity should be Low');
    }
  });

  await test('Rule Engine severity to status mapping', async () => {
    if (ruleModule.statusFromSeverity('Critical') !== 'Open') throw new Error('Critical status');
    if (ruleModule.statusFromSeverity('High') !== 'Investigating') throw new Error('High status');
    if (ruleModule.statusFromSeverity('Medium') !== 'Queued') throw new Error('Medium status');
    if (ruleModule.statusFromSeverity('Low') !== 'Observed') throw new Error('Low status');
  });

  await test('Rule Engine rule matching heuristic', async () => {
    const rule = {
      description: 'Customer financial records must be stored securely',
      condition: 'financial records',
      action: 'Ensure encrypted transmission',
    };
    if (!ruleModule.ruleMatchesAction(rule, 'Accessed financial records without 2FA')) {
      throw new Error('Condition match failed');
    }
    if (!ruleModule.ruleMatchesAction(rule, 'Customer record access')) {
      throw new Error('Keyword match failed');
    }
  });

  await test('Rule Engine heuristic rule extraction and interpreter response', async () => {
    const policyText = 'All employees must report security incidents immediately. Personal USB drives are strictly forbidden.';
    const rules = await ruleModule.aiRules(policyText);
    if (rules.length === 0) throw new Error('Expected extracted rules');

    const response = ruleModule.buildInterpreterResponse('Security Policy', 'manual', policyText, rules);
    if (!response.title || response.actions.length === 0) {
      throw new Error('Invalid interpreter response');
    }
    if (response.complexity_label !== 'Low') {
      throw new Error(`Expected complexity Low, got ${response.complexity_label}`);
    }
  });

  // --- 4. Document Parser Tests ---
  const docModule = await import('../../supabase/functions/_shared/documentParser.ts');

  await test('Document Parser extracts plain text correctly', async () => {
    const bytes = new TextEncoder().encode('Hello compliance world');
    const text = await docModule.extractTextFromBytes(bytes, 'sample.txt');
    if (text !== 'Hello compliance world') throw new Error(`Got: ${text}`);
  });

  await test('Document Parser extracts text from PDF document', async () => {
    const pdfPath = path.resolve(__dirname, '..', '..', 'backups', 'media_policies', 'google_privacy_policy_en.pdf');
    if (fs.existsSync(pdfPath)) {
      const bytes = fs.readFileSync(pdfPath);
      const text = await docModule.extractTextFromBytes(new Uint8Array(bytes), 'google_privacy_policy_en.pdf');
      if (!text.toLowerCase().includes('privacy policy') && !text.toLowerCase().includes('google')) {
        throw new Error('PDF extraction did not contain expected text');
      }
    }
  });

  // --- 5. CORS & Edge Response Tests ---
  const corsModule = await import('../../supabase/functions/_shared/cors.ts');
  const apiModule = await import('../../supabase/functions/api/index.ts');

  await test('Edge Function Router handles GET /health endpoint', async () => {
    const req = new Request('http://localhost/health', { method: 'GET' });
    const res = await apiModule.handleRequest(req);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const body = await res.json();
    if (body.status !== 'ok' || body.service !== 'sentinel-core') {
      throw new Error(`Invalid health body: ${JSON.stringify(body)}`);
    }
  });

  await test('Edge Function Router handles OPTIONS preflight', async () => {
    const req = new Request('http://localhost/api/auth/login', { method: 'OPTIONS' });
    const res = await apiModule.handleRequest(req);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Edge Function Router returns 404 for unknown endpoint', async () => {
    const req = new Request('http://localhost/api/nonexistent-route-xyz', { method: 'GET' });
    const res = await apiModule.handleRequest(req);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    const body = await res.json();
    if (!body.detail || !body.detail.includes('not found')) {
      throw new Error('Expected 404 detail message');
    }
  });

  await test('CORS handler responds to OPTIONS preflight', async () => {
    const req = new Request('http://localhost/api/test', { method: 'OPTIONS' });
    const res = corsModule.handleCors(req);
    if (!res || res.status !== 200) throw new Error('OPTIONS should return 200');
    if (!res.headers.get('Access-Control-Allow-Origin')) throw new Error('Missing CORS header');
  });

  await test('jsonResponse and errorResponse output standard format', async () => {
    const okRes = corsModule.jsonResponse({ foo: 'bar' }, 201);
    if (okRes.status !== 201) throw new Error('Expected status 201');
    const okJson = await okRes.json();
    if (okJson.foo !== 'bar') throw new Error('Expected foo: bar');

    const errRes = corsModule.errorResponse('Unauthorized access', 401);
    if (errRes.status !== 401) throw new Error('Expected status 401');
    const errJson = await errRes.json();
    if (errJson.detail !== 'Unauthorized access') throw new Error('Expected detail: Unauthorized access');
  });

  console.log('\n======================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[Runner Error]', err);
  process.exit(1);
});
