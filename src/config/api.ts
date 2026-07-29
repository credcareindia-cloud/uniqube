/**
 * API Configuration
 * Centralized configuration for all API endpoints
 * Uses environment variables with fallbacks for development
 */

function resolveApiBase(path: '/api' | '' = '/api') {
  // Prefer same-origin relative URLs so Vite can proxy (localhost, LAN, Cloudflare tunnel)
  if (typeof window !== 'undefined') {
    return path === '/api' ? '/api' : '';
  }
  if (path === '/api' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }
  if (path === '' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  return `http://localhost:4000${path}`;
}

// Backend API URL
export const API_BASE_URL = resolveApiBase('/api');

export const API_URL = resolveApiBase('');

// 3D Viewer URL (separate service)
export const VIEWER_URL = 
  import.meta.env?.VITE_VIEWER_URL || 
  'http://localhost:3001';

// Helper function to build full API URL
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Always use API_BASE_URL which already includes /api
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Helper function to build viewer URL
export const getViewerUrl = (modelId: string, embed: boolean = false): string => {
  const params = new URLSearchParams({ model: modelId });
  if (embed) params.append('embed', 'true');
  return `${VIEWER_URL}/?${params.toString()}`;
};

// Export for debugging
if (typeof window !== 'undefined') {
  console.log('🔧 API Configuration:', {
    API_BASE_URL,
    API_URL,
    VIEWER_URL,
  });
}
