import { getBrowserApiBase } from '@/config/browserApi'

export class ApiError extends Error {}

/**
 * Studio tool paths are `/api/...`. Uniqube serves them under `/api/studio/...`.
 * On production hosts, call api.uniqube3d.co directly so large PDF uploads are not
 * truncated by the Vercel rewrite (which surfaces in the browser as "Failed to fetch").
 */
export function apiUrl(path: string) {
  const base = getBrowserApiBase().replace(/\/$/, '')
  const studioPath = path.replace(/^\/api(?=\/|$)/, '/studio')
  return `${base}${studioPath.startsWith('/') ? studioPath : `/${studioPath}`}`
}

export function studioAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function networkErrorMessage(error: unknown, path: string) {
  const raw = error instanceof Error ? error.message : 'Request failed'
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return `Could not reach the estimate API (${path}). Check that the server is running and OPENAI_API_KEY is set.`
  }
  return raw
}

export async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  for (const [key, value] of Object.entries(studioAuthHeaders())) {
    if (!headers.has(key)) headers.set(key, value)
  }
  try {
    return await fetch(apiUrl(path), { ...init, headers })
  } catch (error) {
    throw new ApiError(networkErrorMessage(error, path))
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json')
  for (const [key, value] of Object.entries(studioAuthHeaders())) {
    if (!headers.has(key)) headers.set(key, value)
  }
  let res: Response
  try {
    res = await fetch(apiUrl(path), { ...init, headers })
  } catch (error) {
    throw new ApiError(networkErrorMessage(error, path))
  }
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      /* non-json error page */
    }
    throw new ApiError(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
