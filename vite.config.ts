import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    open: true,
  },
  build: {
    outDir: "dist",
  },
  define: {
    __DEFINES__: JSON.stringify({}),
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
});
