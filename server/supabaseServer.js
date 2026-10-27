const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function startSupabaseEdgeServer() {
  const { handleRequest } = await import('../supabase/functions/api/index.ts');
  const PORT = process.env.PORT || 5000;

  const server = http.createServer(async (req, res) => {
    try {
      const url = `http://${req.headers.host || 'localhost:' + PORT}${req.url}`;
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : Buffer.concat(chunks);

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v !== undefined) {
          if (Array.isArray(v)) {
            v.forEach((val) => headers.append(k, val));
          } else {
            headers.set(k, v);
          }
        }
      }

      const webReq = new Request(url, {
        method: req.method,
        headers,
        body,
        duplex: 'half',
      });

      const webRes = await handleRequest(webReq);

      res.statusCode = webRes.status;
      for (const [k, v] of webRes.headers.entries()) {
        res.setHeader(k, v);
      }
      const resBody = await webRes.arrayBuffer();
      res.end(Buffer.from(resBody));
    } catch (err) {
      console.error('[Supabase Server Error]', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ detail: err.message || 'Internal server error' }));
    }
  });

  server.listen(PORT, () => {
    console.log(`[Supabase Edge Server] Running locally at http://localhost:${PORT}`);
    console.log(`[Supabase Edge Server] Connected to remote database: ${process.env.SUPABASE_URL}`);
  });

  return server;
}

if (require.main === module) {
  startSupabaseEdgeServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = startSupabaseEdgeServer;
