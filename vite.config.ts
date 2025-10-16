import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    open: true,
  },
  build: {
    outDir: "dist",
    target: "esnext",
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
