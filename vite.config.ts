import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config.
 *
 * ``base`` follows ``VITE_BASE`` when it is set, so the GitHub Pages workflow
 * can build the bundle for a project-page path (``/tool-assembly/``) while
 * local dev keeps the ordinary root ``/``.
 *
 * IMPORTANT — do not change ``server.port``. Saved assemblies persist in the
 * browser's ``localStorage``, which is scoped per origin (scheme + host +
 * PORT). If the dev server moves to a different port between sessions, the
 * previously saved assemblies become unreachable — they are still stored, just
 * under the old port's origin. Pinning the port with ``strictPort: true`` keeps
 * every session on the same origin so saved work always reloads. If the port is
 * already in use, prefer reusing that running server over starting a new one on
 * a different port. Both ``npm run dev`` and a bare ``npx vite`` honour this.
 */
const DEV_PORT = 5182;

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: DEV_PORT,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: DEV_PORT,
    strictPort: true,
  },
});
