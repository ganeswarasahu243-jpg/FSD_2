import { Browser } from './.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';

async function main() {
  const b = await Browser.launch();
  const p = await b.newPage({ width: 1440, height: 900 });
  
  await p.send('Network.enable');
  
  const requests = new Map();
  b.on(p.sessionId, 'Network.requestWillBeSent', (e) => {
    requests.set(e.requestId, e.request.url);
    console.log('[Request]', e.request.method, e.request.url);
  });
  
  b.on(p.sessionId, 'Network.responseReceived', (e) => {
    console.log('[Response]', e.response.status, e.response.url, e.response.headers);
  });
  
  b.on(p.sessionId, 'Network.loadingFailed', (e) => {
    console.log('[Failed]', requests.get(e.requestId), e.errorText);
  });

  await p.goto('http://localhost:5000/', { settleMs: 3000 });
  await b.close();
}

main().catch(console.error);
