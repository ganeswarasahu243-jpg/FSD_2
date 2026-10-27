import { spawnSync } from 'node:child_process';

async function main() {
  const pagePath = process.argv[2] || '/dashboard';
  const outDir = process.argv[3] || '.taste-skill/after_dashboard';

  // 1. Login to get JWT
  const res = await fetch('http://localhost:5000/api/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'jayasurya', password: '123456' })
  });
  const data = await res.json();
  if (!data.access) {
    console.error('Failed to get token:', data);
    process.exit(1);
  }

  const inject = `localStorage.setItem('sentinel_access_token','${data.access}');localStorage.setItem('sentinel_username','jayasurya');`;

  // 2. Run inspect.mjs with inject
  const args = [
    '.agents/skills/design-taste-frontend/scripts/inspect.mjs',
    `http://localhost:5000${pagePath}`,
    '--app',
    '--out',
    outDir,
    '--inject',
    inject
  ];

  console.log('Running inspect on', pagePath, '...');
  const result = spawnSync('node', args, { stdio: 'inherit', shell: false });
  process.exit(result.status || 0);
}

main().catch(console.error);
