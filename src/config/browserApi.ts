/** Browser API base for Uniqube frontend. */
const LIVE_API_BASE = 'https://api.uniqube3d.co/api';

/**
 * Resolve API base URL for fetch calls in the browser.
 * Production uniqube3d.co must hit api.uniqube3d.co directly (Vercel /api rewrite
 * currently falls through to the SPA). Local uses /api (Vite proxy) by default.
 */
export function getBrowserApiBase(): string {
  if (typeof window === 'undefined') {
    return (import.meta as any).env?.VITE_API_BASE_URL || '/api';
  }
  const host = window.location.hostname;
  if (host === 'uniqube3d.co' || host === 'www.uniqube3d.co') {
    return LIVE_API_BASE;
  }
  const env = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api';
  if (/^https?:\/\//i.test(env) && /(sslip\.io|elb\.amazonaws\.com)/i.test(env)) {
    return host === 'localhost' || host === '127.0.0.1' ? '/api' : LIVE_API_BASE;
  }
  return env;
}
