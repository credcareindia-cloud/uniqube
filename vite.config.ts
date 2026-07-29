import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Keep a single three instance; dxf-viewer is compatible with modern three for rendering
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['dxf-viewer', 'three'],
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/qr': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    }
  },
  build: {
    // Skip type checking during build for faster builds
    // Use 'npm run build:check' if you want to check types
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress certain warnings
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        warn(warning)
      },
    },
  },
})
