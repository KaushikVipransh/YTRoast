import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: { TZ: "UTC" },
    // Each DB test file boots its own PGlite (WASM Postgres); give setup hooks room on a busy machine.
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/**/*.test.ts"], exclude: ["tests/perf/**"], sequence: { groupOrder: 0 } },
      },
      {
        // 100k-entry tests need hundreds of MB each; running them in parallel with everything else pages to disk.
        extends: true,
        test: { name: "perf", include: ["tests/perf/**/*.test.ts"], fileParallelism: false, sequence: { groupOrder: 1 } },
      },
    ],
  },
});
