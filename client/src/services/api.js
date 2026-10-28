const TOKEN_KEY = 'sentinel_access_token';
const REFRESH_KEY = 'sentinel_refresh_token';
const USER_KEY = 'sentinel_username';
const ROLE_KEY = 'sentinel_user_role';

const RAW_API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

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
 * Universal fetch wrapper for JSON and Multipart requests
 */
export const apiRequest = async (endpoint, options = {}) => {
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

  let cleanEndpoint = endpoint;
  if (API_BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  }

  const targetUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE_URL}${cleanEndpoint.startsWith('/') ? '' : '/'}${cleanEndpoint}`;

  const response = await fetch(targetUrl, {
    ...options,
    headers,
    body,
  });

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
        ? `Server returned HTML (${response.status}). Verify API server is running.`
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
