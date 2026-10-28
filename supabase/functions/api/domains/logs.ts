import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';
import { createViolationsForLog } from './monitoring.ts';

export async function handleGetLogs(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    let query = adminClient
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false });

    // Enforce record ownership: employees only see their own activity records
    if (user.role === 'employee') {
      query = query.or(`user_id.eq.${user.id},username.eq.${user.username}`);
    }

    const { data: logs, error } = await query;

    if (error) {
      return errorResponse(error.message, 500);
    }

    const formatted = (logs || []).map((l) => ({
      ...l,
      id: l.sqlite_id || l.id,
    }));

    return jsonResponse(formatted, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleCreateLog(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    const body = await req.json().catch(() => ({}));
    const action = (body.action || '').trim();

    if (!action) {
      return errorResponse('Action is required.', 400);
    }

    // Enforce record ownership: strictly bind log to authenticated user identity
    const { data: log, error: logErr } = await adminClient
      .from('logs')
      .insert({
        action,
        user_id: user.id,
        username: user.username,
      })
      .select('id, sqlite_id, user_id, username, action, created_at')
      .single();

    if (logErr || !log) {
      return errorResponse(logErr?.message || 'Failed to create log.', 500);
    }

    await createViolationsForLog(log, adminClient);

    return jsonResponse(
      {
        ...log,
        id: log.sqlite_id || log.id,
      },
      201
    );
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
