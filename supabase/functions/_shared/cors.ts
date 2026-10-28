const getEnv = (key: string): string => {
  if (typeof Deno !== 'undefined' && Deno.env && Deno.env.get) {
    return Deno.env.get(key) || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  return '';
};

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

export function resolveCorsOrigin(req?: Request): string {
  const allowedEnv = getEnv('ALLOWED_ORIGINS') || getEnv('CLIENT_URL');
  const configured = allowedEnv
    ? allowedEnv.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
    : [];

  const trusted = [...DEFAULT_DEV_ORIGINS, ...configured];

  if (!req) {
    return configured.length > 0 ? configured[0] : '*';
  }

  const reqOrigin = (req.headers.get('origin') || req.headers.get('Origin') || '').trim().replace(/\/+$/, '');
  if (!reqOrigin) {
    return configured.length > 0 ? configured[0] : '*';
  }

  if (trusted.includes(reqOrigin)) {
    return reqOrigin;
  }

  // If in production with configured trusted origins, enforce strict restriction
  if (configured.length > 0) {
    return configured[0];
  }

  // Development fallback
  return reqOrigin;
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function getCorsHeaders(req?: Request): Record<string, string> {
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': resolveCorsOrigin(req),
    'Vary': 'Origin',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  customHeaders: Record<string, string> = {},
  req?: Request
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
      ...customHeaders,
    },
  });
}

export function errorResponse(detail: string, status = 400, req?: Request): Response {
  return jsonResponse({ detail }, status, {}, req);
}
