import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticateRequest } from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';
import { serializeViolation } from '../../_shared/ruleEngine.ts';

export async function handleGetViolations(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    // Restrict violation and breach telemetry to compliance officers and administrators
    if (!['compliance_officer', 'admin'].includes(user.role)) {
      return errorResponse('Forbidden: Compliance officer or administrator role required to view violation logs.', 403);
    }

    const { data: violations, error } = await adminClient
      .from('violations')
      .select(`
        id,
        sqlite_id,
        message,
        created_at,
        log_id,
        logs:log_id (
          id,
          sqlite_id,
          action,
          username
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    const formatted = (violations || []).map((v: Record<string, unknown>) => {
      const log = (v.logs as Record<string, unknown>) || null;
      return serializeViolation(
        {
          id: (v.sqlite_id as number) || (v.id as number | string),
          sqlite_id: v.sqlite_id as number | null,
          message: v.message as string,
          created_at: v.created_at as string,
        },
        log
          ? {
              action: log.action as string,
              username: log.username as string,
            }
          : null
      );
    });

    return jsonResponse(formatted, 200);
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
