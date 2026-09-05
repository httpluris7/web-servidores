import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests unitarios de la lógica pura (parseo de planes, periodos de renovación…).
 * `server-only` se sustituye por un módulo vacío: fuera de React lanzaría.
 */
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
});
