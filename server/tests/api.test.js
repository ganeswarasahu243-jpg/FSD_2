const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const fs = require('fs');
const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/db');

let server;
let port = 5099;
let baseUrl;

const request = (method, endpoint, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
    };

    let postData = null;
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      postData = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    } else if (body) {
      postData = body;
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

const runTests = async () => {
  console.log('\n=========================================');
  console.log(' STARTING BACKEND API TEST SUITE');
  console.log('=========================================\n');

  if (process.env.MONGODB_URI && (process.env.MONGODB_URI.includes('<URL_ENCODED_PASSWORD>') || process.env.MONGODB_URI.includes('<db_password>'))) {
    console.warn('[Test Suite] MONGODB_URI in .env contains unconfigured password placeholder. Falling back to local MongoDB for integration testing.');
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/sentinel_compliance';
  }

  await connectDB();
  server = app.listen(port);
  baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  };

  let testUserToken = null;
  let createdAlertId = null;

  // 1. Health check
  await test('GET /health returns 200 ok', async () => {
    const res = await request('GET', '/health');
    if (res.status !== 200 || res.data.status !== 'ok') {
      throw new Error(`Expected 200 ok, got ${res.status}`);
    }
  });

  // 2. Site Data
  await test('GET /api/site-data/ returns aggregated data', async () => {
    const res = await request('GET', '/api/site-data/');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.totals || typeof res.data.totals.policies !== 'number') {
      throw new Error('Missing totals');
    }
    if (!Array.isArray(res.data.frameworks) || res.data.frameworks.length === 0) {
      throw new Error('Missing frameworks');
    }
  });

  // 3. Dashboard
  await test('GET /api/dashboard/ returns summary counters', async () => {
    const res = await request('GET', '/api/dashboard/');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (typeof res.data.total_policies !== 'number') throw new Error('Missing total_policies');
  });

  // 4. Register new user
  const uniqueUser = `testuser_${Date.now()}`;
  await test(`POST /api/auth/register/ registers ${uniqueUser}`, async () => {
    const res = await request('POST', '/api/auth/register/', {
      username: uniqueUser,
      password: 'password123',
      role: 'compliance_officer',
      email: `${uniqueUser}@example.com`,
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.access) throw new Error('Missing access token');
    testUserToken = res.data.access;
  });

  // 5. Login
  await test(`POST /api/auth/login/ logs in ${uniqueUser}`, async () => {
    const res = await request('POST', '/api/auth/login/', {
      username: uniqueUser,
      password: 'password123',
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.access) throw new Error('Missing access token in login');
    testUserToken = res.data.access;
  });

  // 6. Get Me
  await test('GET /api/auth/me/ returns authenticated user details', async () => {
    const res = await request('GET', '/api/auth/me/', null, {
      Authorization: `Bearer ${testUserToken}`,
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.data.username !== uniqueUser) throw new Error(`Expected ${uniqueUser}, got ${res.data.username}`);
  });

  // 7. Update profile
  await test('PUT /api/auth/profile/ updates user profile', async () => {
    const res = await request('PUT', '/api/auth/profile/', {
      first_name: 'Test',
      last_name: 'Officer',
    }, {
      Authorization: `Bearer ${testUserToken}`,
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.data.user.first_name !== 'Test') throw new Error('Profile not updated');
  });

  // 8. Policy Interpreter
  await test('POST /api/policy-interpreter/ analyzes policy text', async () => {
    const sampleText = 'All employees must encrypt sensitive customer data before transmission over public networks. Access keys must be rotated every 90 days. Violations will result in immediate suspension.';
    const res = await request('POST', '/api/policy-interpreter/', {
      title: 'Encryption Policy',
      policy_text: sampleText,
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.actions || res.data.actions.length === 0) throw new Error('No actions extracted');
  });

  // 9. Save Policy
  await test('POST /api/policies/save/ saves policy and creates rules', async () => {
    const sampleText = 'Customer financial records must be stored in encrypted repositories. Backups must occur daily.';
    const res = await request('POST', '/api/policies/save/', {
      title: 'Financial Record Storage Policy',
      policy_text: sampleText,
    }, {
      Authorization: `Bearer ${testUserToken}`,
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.rules_created <= 0) throw new Error('No rules created for policy');
  });

  // 10. Record Demo Activity
  await test('POST /api/activity-demo/ triggers violation detection', async () => {
    const res = await request('POST', '/api/activity-demo/', {
      employee: 'demo.employee',
      action: 'Shared confidential payroll and customer data to external USB drive',
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    if (!res.data.violations || res.data.violations.length === 0) {
      throw new Error('Expected violations to be detected for confidential external activity');
    }
    createdAlertId = res.data.violations[0].id;
  });

  // 11. Keep pending alert
  await test(`POST /api/alerts/:id/pending/ updates alert status`, async () => {
    if (!createdAlertId) throw new Error('No alert ID available');
    const res = await request('POST', `/api/alerts/${createdAlertId}/pending/`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.data.alert.status !== 'Still Pending') {
      throw new Error(`Expected Still Pending, got ${res.data.alert.status}`);
    }
  });

  // 12. Resolve alert
  await test(`POST /api/alerts/:id/resolve/ resolves and deletes alert`, async () => {
    if (!createdAlertId) throw new Error('No alert ID available');
    const res = await request('POST', `/api/alerts/${createdAlertId}/resolve/`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  console.log('\n=========================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================\n');

  server.close();
  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests().catch((err) => {
  console.error('Test suite runner error:', err);
  process.exit(1);
});
