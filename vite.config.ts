import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config.
 *
 * ``base`` follows ``VITE_BASE`` when it is set, so the GitHub Pages workflow
 * can build the bundle for a project-page path (``/tool-assembly/``) while
 * local dev keeps the ordinary root ``/``.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: false,
  },
});
