import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

export const KEY = {
  access: 'qk:access',
  refresh: 'qk:refresh',
  user: 'qk:user',
} as const;

export const http = axios.create({
  baseURL: '/api',
  timeout: 20_000,
});

http.interceptors.request.use((cfg) => {
  const at = localStorage.getItem(KEY.access);
  if (at && cfg.headers) cfg.headers.Authorization = `Bearer ${at}`;
  return cfg;
});

let refreshPromise: Promise<string> | null = null;

async function tryRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const rt = localStorage.getItem(KEY.refresh);
  if (!rt) throw new Error('no refresh token');
  refreshPromise = axios
    .post<{ access_token: string; expires_in: number }>('/api/auth/refresh', {
      refreshToken: rt,
    })
    .then((r) => {
      localStorage.setItem(KEY.access, r.data.access_token);
      return r.data.access_token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (err.response?.status === 401 && cfg && !cfg._retry && !cfg.url?.includes('/auth/')) {
      cfg._retry = true;
      try {
        const at = await tryRefresh();
        cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${at}` };
        return http.request(cfg);
      } catch {
        localStorage.removeItem(KEY.access);
        localStorage.removeItem(KEY.refresh);
        localStorage.removeItem(KEY.user);
        if (!location.pathname.startsWith('/welcome') && !location.pathname.startsWith('/login')) {
          location.href = '/welcome';
        }
      }
    }
    return Promise.reject(err);
  },
);

export function pickErrMsg(e: unknown, fallback = '请求失败'): string {
  if (e instanceof AxiosError) {
    const data = e.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) return Array.isArray(data.message) ? data.message[0] : data.message;
    return e.message || fallback;
  }
  return fallback;
}
