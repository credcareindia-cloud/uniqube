/**
 * Helper function to make authenticated fetch requests
 * Automatically includes JWT token from localStorage in Authorization header
 */
export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token')
  
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
  
  console.log('🔧 authenticatedFetch - URL:', url);
  console.log('🔧 authenticatedFetch - Body:', options.body);
  console.log('🔧 authenticatedFetch - Headers:', headers);
  
  return fetch(url, {
    ...options,
    headers,
  })
}
