import bcryptPkg from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { SupabaseClient } from '@supabase/supabase-js';

// deno-lint-ignore no-explicit-any
const bcrypt: any = (bcryptPkg as any).default || bcryptPkg;

const getEnv = (key: string): string | undefined => {
  if (typeof Deno !== 'undefined' && Deno.env && Deno.env.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

/**
 * Retrieves the cryptographic secret for signing and validating JWT tokens.
 * Fails safely with a fatal error if JWT_SECRET is not configured in environment secrets.
 */
export const getJwtSecretKey = (): Uint8Array => {
  const secret = getEnv('JWT_SECRET');
  if (!secret || !secret.trim()) {
    throw new Error('Fatal: JWT_SECRET environment variable is missing.');
  }
  return new TextEncoder().encode(secret);
};

const getExpiresIn = (): string => getEnv('JWT_EXPIRES_IN') || '60m';
const getRefreshExpiresIn = (): string => getEnv('REFRESH_TOKEN_EXPIRES_IN') || '7d';

export interface UserPayload {
  id: string | number;
  sqliteId?: number | null;
  username: string;
  role: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export function requireRole(user: UserPayload | null, allowedRoles: string[]): Response | null {
  if (!user) {
    return new Response(
      JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!allowedRoles.includes(user.role)) {
    return new Response(
      JSON.stringify({ detail: 'Forbidden: Insufficient role permissions.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

export async function generateTokens(user: {
  id: string | number;
  sqlite_id?: number | null;
  username: string;
  role?: string;
}): Promise<{ access: string; refresh: string }> {
  const secretKey = getJwtSecretKey();
  const payload = {
    id: user.id.toString(),
    sqliteId: user.sqlite_id || (typeof user.id === 'number' ? user.id : null),
    username: user.username,
    role: user.role || 'employee',
  };

  const access = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(getExpiresIn())
    .sign(secretKey);

  const refresh = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(getRefreshExpiresIn())
    .sign(secretKey);

  return { access, refresh };
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Verifies candidate password against:
 * 1. Django PBKDF2 (pbkdf2_sha256$iterations$salt$hash)
 * 2. Bcrypt ($2a$ or $2b$)
 * 3. Fallback direct match
 */
export async function verifyPassword(candidatePassword: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !candidatePassword) return false;

  // Django PBKDF2 format
  if (storedHash.startsWith('pbkdf2_sha256$')) {
    try {
      const parts = storedHash.split('$');
      if (parts.length === 4) {
        const [, iterationsStr, salt, expectedHash] = parts;
        const iterations = parseInt(iterationsStr, 10);
        const enc = new TextEncoder();
        const subtleCrypto = crypto.subtle;
        const keyMaterial = await subtleCrypto.importKey(
          'raw',
          enc.encode(candidatePassword),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );
        const derivedBits = await subtleCrypto.deriveBits(
          {
            name: 'PBKDF2',
            salt: enc.encode(salt),
            iterations,
            hash: 'SHA-256',
          },
          keyMaterial,
          256
        );
        const derivedBytes = new Uint8Array(derivedBits);
        let derivedBase64 = '';
        if (typeof Buffer !== 'undefined') {
          derivedBase64 = Buffer.from(derivedBytes).toString('base64');
        } else {
          derivedBase64 = btoa(String.fromCharCode(...derivedBytes));
        }
        return derivedBase64 === expectedHash;
      }
    } catch (err) {
      console.error('PBKDF2 verification error:', err);
      return false;
    }
  }

  // Bcrypt format
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(candidatePassword, storedHash);
    } catch (err) {
      console.error('Bcrypt compare error:', err);
      return false;
    }
  }

  // Fallback plain string match
  return candidatePassword === storedHash;
}

/**
 * Hashes password using standard bcrypt with 10 salt rounds
 */
export function hashPassword(plainPassword: string): string {
  return bcrypt.hashSync(plainPassword, 10);
}

/**
 * Authentication middleware helper for Edge Functions
 */
export async function authenticateRequest(
  req: Request,
  adminClient: SupabaseClient
): Promise<{ user: UserPayload | null; errorResponse: Response | null }> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ detail: 'Authentication credentials were not provided.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ detail: 'Authentication token missing.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.id) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ detail: 'Given token not valid for any token type.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const idVal = payload.id;
  const { data: user, error } = await adminClient
    .from('users')
    .select('id, sqlite_id, username, role, email, first_name, last_name, is_active')
    .eq('id', idVal)
    .single();

  if (error || !user) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ detail: 'User no longer exists.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  // Reject authentication if user account has been deactivated
  if (user.is_active === false) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ detail: 'User account is deactivated.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  return { user: user as UserPayload, errorResponse: null };
}

/**
 * Optional authentication helper
 */
export async function optionalAuthenticateRequest(
  req: Request,
  adminClient: SupabaseClient
): Promise<UserPayload | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.id) return null;

  const { data: user } = await adminClient
    .from('users')
    .select('id, sqlite_id, username, role, email, first_name, last_name, is_active')
    .eq('id', payload.id)
    .single();

  if (!user || user.is_active === false) return null;

  return (user as UserPayload) || null;
}
