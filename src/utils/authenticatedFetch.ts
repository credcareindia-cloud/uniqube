import { API_BASE_URL } from '@/config/api'

/**
 * Build a request URL without double-prefixing `/api`.
 * - Absolute http(s) URLs are left alone
 * - Paths already under `/api` (e.g. from getApiUrl) are left alone
 * - Bare paths like `projects/1` or `/projects/1` get API_BASE_URL prepended
 */
export function resolveAuthenticatedUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  const base = (API_BASE_URL || '/api').replace(/\/$/, '')
  const path = url.startsWith('/') ? url : `/${url}`

  if (path === '/api' || path.startsWith('/api/')) return path
  if (path === base || path.startsWith(`${base}/`)) return path

  return `${base}${path}`
}

/**
 * Helper function to make authenticated fetch requests
 * Automatically includes JWT token from localStorage in Authorization header
 */
export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token')
  const fullUrl = resolveAuthenticatedUrl(url)

  // Start with existing headers or empty object
  const headers: Record<string, string> = {}

  // Merge existing headers first
  if (options.headers) {
    const existingHeaders = new Headers(options.headers)
    existingHeaders.forEach((value, key) => {
      headers[key] = value
    })
  }

  // Set Content-Type if not already set
  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json'
  }

  // Add authentication token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(fullUrl, {
    ...options,
    headers,
  })
}
