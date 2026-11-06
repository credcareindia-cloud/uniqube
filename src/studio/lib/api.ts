export class ApiError extends Error {}

const STUDIO_API = '/api/studio'

/** Studio calls use `/api/...` in the tool. Uniqube serves them under `/api/studio`. */
export function apiUrl(path: string) {
  return path.replace(/^\/api(?=\/|$)/, STUDIO_API)
}

export function studioAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  for (const [key, value] of Object.entries(studioAuthHeaders())) {
    if (!headers.has(key)) headers.set(key, value)
  }
  return fetch(apiUrl(path), { ...init, headers })
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('content-type')) headers.set('content-type', 'application/json')
  for (const [key, value] of Object.entries(studioAuthHeaders())) {
    if (!headers.has(key)) headers.set(key, value)
  }
  const res = await fetch(apiUrl(path), { ...init, headers })
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
