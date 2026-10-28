/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseClient.ts';

import {
  handleRegister,
  handleLogin,
  handleGetMe,
  handleUpdateProfile,
  handleGetUsers,
  handleUpdateUser,
} from './domains/auth.ts';
import {
  handleInterpretPolicy,
  handleSavePolicy,
  handleGetPolicies,
  handleGetPolicyById,
  handleDownloadPolicyDocument,
  handleUpdatePolicy,
  handleDeletePolicy,
} from './domains/policies.ts';
import {
  handleGetDashboard,
  handleGetSiteData,
  handleRecordActivityDemo,
  handleResolveAlert,
  handleKeepAlertPending,
} from './domains/monitoring.ts';
import { handleGetLogs, handleCreateLog } from './domains/logs.ts';
import { handleGetViolations } from './domains/violations.ts';

export async function handleRequest(req: Request): Promise<Response> {
  // 1. Handle CORS preflight
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const url = new URL(req.url);
  let pathname = url.pathname;

  // Normalize path: strip function prefix if present (e.g. /functions/v1/api or /api)
  if (pathname.startsWith('/functions/v1/api')) {
    pathname = pathname.slice('/functions/v1/api'.length);
  } else if (pathname.startsWith('/api')) {
    pathname = pathname.slice('/api'.length);
  }

  // Ensure leading slash
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  // Normalize trailing slash (remove trailing slash except for root '/')
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  const method = req.method.toUpperCase();

  try {
    // Health endpoint (served directly without requiring database connection)
    if (normalizedPath === '/health' || normalizedPath === '') {
      if (method !== 'GET') {
        return errorResponse(`Method ${method} not allowed for ${normalizedPath || '/'}.`, 405);
      }
      return jsonResponse({
        status: 'ok',
        service: 'sentinel-core',
        runtime: 'supabase-edge-functions',
        timestamp: new Date().toISOString(),
      });
    }

    // Helper to get admin client lazily only for db-backed endpoints
    const getAdmin = () => getSupabaseAdmin();

    if (normalizedPath === '/health/ready') {
      if (method !== 'GET') {
        return errorResponse(`Method ${method} not allowed for /health/ready.`, 405);
      }
      const { error } = await getAdmin().from('users').select('id', { head: true, count: 'exact' }).limit(1);
      if (error) {
        return jsonResponse({ status: 'not_ready', database: 'disconnected', error: error.message }, 503);
      }
      return jsonResponse({ status: 'ready', database: 'connected' }, 200);
    }

    // Auth domain
    if (normalizedPath === '/auth/register' && method === 'POST') {
      return await handleRegister(req, getAdmin());
    }
    if (normalizedPath === '/auth/login' && method === 'POST') {
      return await handleLogin(req, getAdmin());
    }
    if (normalizedPath === '/auth/me' && method === 'GET') {
      return await handleGetMe(req, getAdmin());
    }
    if (normalizedPath === '/auth/profile' && method === 'PUT') {
      return await handleUpdateProfile(req, getAdmin());
    }

    // User management domain (Admin only)
    if ((normalizedPath === '/users' || normalizedPath === '/auth/users') && method === 'GET') {
      return await handleGetUsers(req, getAdmin());
    }

    const userMatch = normalizedPath.match(/^\/(?:auth\/)?users\/([^/]+)$/);
    if (userMatch && (method === 'PUT' || method === 'PATCH')) {
      return await handleUpdateUser(req, userMatch[1], getAdmin());
    }

    // Policies domain
    if (normalizedPath === '/policy-interpreter' && method === 'POST') {
      return await handleInterpretPolicy(req, getAdmin());
    }
    if (normalizedPath === '/policies/save' && method === 'POST') {
      return await handleSavePolicy(req, getAdmin());
    }
    if (normalizedPath === '/policies' && method === 'GET') {
      return await handleGetPolicies(req, getAdmin());
    }

    const downloadMatch = normalizedPath.match(/^\/policies\/([^/]+)\/download$/);
    if (downloadMatch && method === 'GET') {
      return await handleDownloadPolicyDocument(req, downloadMatch[1], getAdmin());
    }

    const policyMatch = normalizedPath.match(/^\/policies\/([^/]+)$/);
    if (policyMatch) {
      if (method === 'GET') {
        return await handleGetPolicyById(req, policyMatch[1], getAdmin());
      }
      if (method === 'PUT') {
        return await handleUpdatePolicy(req, policyMatch[1], getAdmin());
      }
      if (method === 'DELETE') {
        return await handleDeletePolicy(req, policyMatch[1], getAdmin());
      }
    }

    // Monitoring domain
    if (normalizedPath === '/dashboard' && method === 'GET') {
      return await handleGetDashboard(req, getAdmin());
    }
    if (normalizedPath === '/site-data' && method === 'GET') {
      return await handleGetSiteData(req, getAdmin());
    }
    if (normalizedPath === '/activity-demo' && method === 'POST') {
      return await handleRecordActivityDemo(req, getAdmin());
    }

    const resolveMatch = normalizedPath.match(/^\/alerts\/([^/]+)\/resolve$/);
    if (resolveMatch && method === 'POST') {
      return await handleResolveAlert(req, resolveMatch[1], getAdmin());
    }

    const pendingMatch = normalizedPath.match(/^\/alerts\/([^/]+)\/(pending|keep-pending)$/);
    if (pendingMatch && method === 'POST') {
      return await handleKeepAlertPending(req, pendingMatch[1], getAdmin());
    }

    // Logs domain
    if (normalizedPath === '/logs' && method === 'GET') {
      return await handleGetLogs(req, getAdmin());
    }
    if (normalizedPath === '/logs' && method === 'POST') {
      return await handleCreateLog(req, getAdmin());
    }

    // Violations domain
    if (normalizedPath === '/violations' && method === 'GET') {
      return await handleGetViolations(req, getAdmin());
    }

    // 404 Route Not Found
    return errorResponse(`Route ${url.pathname} not found.`, 404);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Unhandled Edge Function exception:', error);
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve(handleRequest);
}

