const DEFAULT_PROD_BACKEND = 'https://realtimechat-kz1j.onrender.com';

function normalizeUrl(url) {
  return typeof url === 'string' ? url.trim().replace(/\/$/, '') : '';
}

function getBackendUrl() {
  const configured = normalizeUrl(
    import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || ''
  );

  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return configured || 'http://localhost:4000';
  }

  return DEFAULT_PROD_BACKEND;
}

export const BACKEND_URL = getBackendUrl();
