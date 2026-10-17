// Cross-platform `E2E_PROD=1 playwright test` (Windows shells don't support inline env vars).
import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, E2E_PROD: "1" },
});
process.exit(result.status ?? 1);
