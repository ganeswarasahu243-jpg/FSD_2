import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateTokens,
  verifyPassword,
  hashPassword,
  authenticateRequest,
} from '../../_shared/auth.ts';
import { jsonResponse, errorResponse } from '../../_shared/cors.ts';

export async function handleRegister(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').trim();
    const password = body.password || '';
    // Enforce least-privilege: public registration always creates standard 'employee' role.
    const role = 'employee';
    const email = (body.email || '').trim();
    const firstName = (body.first_name || '').trim();
    const lastName = (body.last_name || '').trim();

    if (!username) {
      return errorResponse('Username is required.', 400);
    }
    if (!password || password.length < 6) {
      return errorResponse('Password must be at least 6 characters long.', 400);
    }

    // Check case-insensitive username collision
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, username')
      .ilike('username', username)
      .maybeSingle();

    if (existingUser) {
      return errorResponse('Username already exists.', 400);
    }

    const hashedPassword = hashPassword(password);
    const { data: user, error: insertError } = await adminClient
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        role,
        email,
        first_name: firstName,
        last_name: lastName,
      })
      .select('id, sqlite_id, username, role')
      .single();

    if (insertError || !user) {
      console.error('Insert user error:', insertError);
      return errorResponse(insertError?.message || 'Failed to register user.', 500);
    }

    const tokens = await generateTokens(user);

    return jsonResponse(
      {
        user: {
          id: user.sqlite_id || user.id,
          username: user.username,
          role: user.role,
        },
        access: tokens.access,
        refresh: tokens.refresh,
        message: 'Registration successful.',
      },
      201
    );
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleLogin(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!username || !password) {
      return errorResponse('Username and password are required.', 400);
    }

    const { data: user, error } = await adminClient
      .from('users')
      .select('id, sqlite_id, username, password, role, is_active')
      .ilike('username', username)
      .maybeSingle();

    if (error || !user) {
      return errorResponse('Invalid username or password.', 401);
    }

    const isMatch = await verifyPassword(password, user.password || '');
    if (!isMatch) {
      return errorResponse('Invalid username or password.', 401);
    }

    if (user.is_active === false) {
      return errorResponse('Account is deactivated. Contact an administrator.', 403);
    }

    const tokens = await generateTokens(user);

    return jsonResponse({
      user: {
        id: user.sqlite_id || user.id,
        username: user.username,
        role: user.role,
      },
      access: tokens.access,
      refresh: tokens.refresh,
      message: 'Login successful.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleGetMe(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    return jsonResponse({
      id: user.sqliteId || user.id,
      username: user.username,
      role: user.role,
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}

export async function handleUpdateProfile(req: Request, adminClient: SupabaseClient): Promise<Response> {
  try {
    const { user, errorResponse: authErr } = await authenticateRequest(req, adminClient);
    if (authErr || !user) return authErr!;

    const body = await req.json().catch(() => ({}));
    const updateData: Record<string, unknown> = {};

    if (body.username !== undefined) {
      const trimmed = (body.username || '').trim();
      if (!trimmed) {
        return errorResponse('Username is required.', 400);
      }
      const { data: existing } = await adminClient
        .from('users')
        .select('id')
        .neq('id', user.id)
        .ilike('username', trimmed)
        .maybeSingle();

      if (existing) {
        return errorResponse('Username already exists.', 400);
      }
      updateData.username = trimmed;
    }

    // Enforce RBAC: Only administrators may change roles. Non-admin users cannot elevate their role.
    if (body.role !== undefined && user.role === 'admin') {
      updateData.role = (body.role || '').trim();
    }
    if (body.first_name !== undefined) updateData.first_name = (body.first_name || '').trim();
    if (body.last_name !== undefined) updateData.last_name = (body.last_name || '').trim();
    if (body.email !== undefined) updateData.email = (body.email || '').trim();

    if (body.password && body.password.trim().length >= 6) {
      updateData.password = hashPassword(body.password.trim());
    }

    const { data: updatedUser, error: updateErr } = await adminClient
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select('id, sqlite_id, username, role, email, first_name, last_name')
      .single();

    if (updateErr || !updatedUser) {
      return errorResponse(updateErr?.message || 'Failed to update profile.', 500);
    }

    const tokens = await generateTokens(updatedUser);

    return jsonResponse({
      user: {
        id: updatedUser.sqlite_id || updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        email: updatedUser.email || '',
        first_name: updatedUser.first_name || '',
        last_name: updatedUser.last_name || '',
      },
      access: tokens.access,
      refresh: tokens.refresh,
      message: 'Profile updated successfully.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse(error.message || 'Internal server error.', 500);
  }
}
