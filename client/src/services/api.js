const TOKEN_KEY = 'sentinel_access_token';
const REFRESH_KEY = 'sentinel_refresh_token';
const USER_KEY = 'sentinel_username';
const ROLE_KEY = 'sentinel_user_role';

/**
 * Validates whether a provided URL is non-empty, well-formed, and free of unconfigured placeholders.
 */
export const validateApiBaseUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      isValid: false,
      reason: 'empty',
      message: 'API base URL is not configured (empty or undefined).',
    };
  }
  const trimmed = rawUrl.trim();
  const placeholderPatterns = [
    /<[^>]+>/,
    /your[-_]project/i,
    /your[-_]supabase/i,
    /placeholder/i,
    /example\.com/i,
  ];
  for (const pattern of placeholderPatterns) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        reason: 'placeholder',
        message: 'API base URL contains an unconfigured placeholder.',
      };
    }
  }
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        isValid: false,
        reason: 'invalid_protocol',
        message: 'API base URL must start with https:// or http://.',
      };
    }
  } catch (_) {
    return {
      isValid: false,
      reason: 'malformed_url',
      message: 'API base URL is not a well-formed URL.',
    };
  }
  return { isValid: true };
};

/**
 * Validates whether a provided Supabase Anon Key is non-empty and free of unconfigured placeholders.
 */
export const validateAnonKey = (rawKey) => {
  if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
    return {
      isValid: false,
      reason: 'empty',
      message: 'VITE_SUPABASE_ANON_KEY is not configured in the build environment.',
    };
  }
  const trimmed = rawKey.trim();
  if (/<[^>]+>|your[-_]supabase|placeholder/i.test(trimmed)) {
    return {
      isValid: false,
      reason: 'placeholder',
      message: 'VITE_SUPABASE_ANON_KEY contains an unconfigured placeholder.',
    };
  }
  return { isValid: true };
};

/**
 * Resolves and normalizes the operational API Base URL from the build environment.
 * Fails cleanly (returns empty string) when VITE_API_URL is missing or contains a placeholder.
 */
export const resolveApiBaseUrl = (rawEnvUrl) => {
  const envUrl = rawEnvUrl !== undefined
    ? rawEnvUrl
    : ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '');

  const validation = validateApiBaseUrl(envUrl);
  if (!validation.isValid) {
    return '';
  }

  let clean = envUrl.trim().replace(/\/+$/, '');
  // Normalize bare project URL (e.g. https://xxx.supabase.co -> https://xxx.supabase.co/functions/v1/api)
  if (/^https:\/\/[a-z0-9_-]+\.supabase\.co$/i.test(clean)) {
    clean = `${clean}/functions/v1/api`;
  } else if (/^https:\/\/[a-z0-9_-]+\.supabase\.co\/functions\/v1$/i.test(clean)) {
    clean = `${clean}/api`;
  }
  return clean;
};

/**
 * Resolves the Supabase Anon Key strictly from the build environment.
 * Fails cleanly (returns empty string) if missing or a placeholder.
 */
export const resolveAnonKey = (rawEnvKey) => {
  const envKey = rawEnvKey !== undefined
    ? rawEnvKey
    : ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '');

  const validation = validateAnonKey(envKey);
  if (!validation.isValid) {
    return '';
  }
  return envKey.trim();
};

const API_BASE_URL = resolveApiBaseUrl();
const SUPABASE_ANON_KEY = resolveAnonKey();

export const getApiBaseUrl = () => API_BASE_URL;
export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const getStoredUsername = () => localStorage.getItem(USER_KEY);
export const getStoredRole = () => localStorage.getItem(ROLE_KEY) || 'employee';
export const isComplianceOrAdmin = () => ['compliance_officer', 'admin'].includes(getStoredRole());
export const isAdmin = () => getStoredRole() === 'admin';

export const setAuthSession = (access, refresh, username, role) => {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (username) localStorage.setItem(USER_KEY, username);
  if (role) localStorage.setItem(ROLE_KEY, role);
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
};

export const isAuthenticated = () => Boolean(getAccessToken());

/**
 * Diagnostics helper for environment configuration status.
 */
export const checkApiConfiguration = () => {
  const rawEnvUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';
  const rawEnvKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
  const urlValidation = validateApiBaseUrl(rawEnvUrl);
  const keyValidation = validateAnonKey(rawEnvKey);

  return {
    isConfigured: urlValidation.isValid && keyValidation.isValid,
    urlStatus: urlValidation,
    keyStatus: keyValidation,
    activeApiBaseUrl: API_BASE_URL,
  };
};

/**
 * Universal fetch wrapper for JSON and Multipart requests
 */
export const apiRequest = async (endpoint, options = {}) => {
  // Pre-flight check 1: Ensure active API base URL is configured and valid
  const urlValidation = validateApiBaseUrl(API_BASE_URL);
  if (!urlValidation.isValid) {
    throw new Error(`Configuration Error: ${urlValidation.message} Please configure VITE_API_URL in your build environment settings.`);
  }

  // Pre-flight check 2: Ensure Supabase Anon Key is configured through the environment
  const keyValidation = validateAnonKey(SUPABASE_ANON_KEY);
  if (!keyValidation.isValid) {
    throw new Error(`Configuration Error: ${keyValidation.message} Please configure VITE_SUPABASE_ANON_KEY in your build environment settings.`);
  }

  let cleanEndpoint = endpoint;
  if (API_BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }

  const targetUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE_URL}${cleanEndpoint.startsWith('/') ? '' : '/'}${cleanEndpoint}`;

  // Pre-flight check 3: Ensure the computed target URL cannot target placeholder domains
  const targetValidation = validateApiBaseUrl(targetUrl);
  if (!targetValidation.isValid) {
    throw new Error(`Configuration Error: Target URL is invalid (${targetValidation.message}). Refusing request.`);
  }

  const token = getAccessToken();
  const headers = { ...options.headers };

  if (SUPABASE_ANON_KEY && !headers.apikey) {
    headers.apikey = SUPABASE_ANON_KEY;
  }

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  // If body is plain object, JSON serialize
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers,
      body,
    });
  } catch (netErr) {
    const isNetworkError = netErr && netErr.message && /failed to fetch|networkerror/i.test(netErr.message);
    if (isNetworkError) {
      throw new Error(`Authentication Error: Failed to reach API gateway. Please verify network connectivity and ensure the Supabase service is online.`);
    }
    throw netErr;
  }

  // Handle 401 unauthorized (expired or invalid token)
  if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
    clearAuthSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(
      text.trim().startsWith('<')
        ? `Server returned HTML (${response.status}). Verify API gateway is operational.`
        : text.trim() || 'Invalid response from server.'
    );
  }

  if (!response.ok) {
    const errorDetail =
      data.detail ||
      data.message ||
      data.error ||
      (Array.isArray(Object.values(data)[0]) ? Object.values(data)[0][0] : null) ||
      'Request failed.';
    throw new Error(errorDetail);
  }

  return data;
};
