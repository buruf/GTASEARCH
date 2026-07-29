import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/*" alias from tsconfig so tests import the same paths the
    // app does. Native in Vite 7 — no plugin needed.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Integration tests hit the real Supabase database over the network.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // The DB tests share one seeded dataset; running files in parallel against
    // it invites confusing interference.
    fileParallelism: false,
  },
});
