// Visual review: boots a dev server (template roasts, in-memory DB), seeds a roast, and screenshots key pages
// at phone and desktop widths into .superpowers/screens/. Usage: pnpm exec tsx scripts/screens.mts [page…]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const PORT = 3300;
const BASE = `http://localhost:${PORT}`;
const OUT = ".superpowers/screens";
const only = process.argv.slice(2);

const server = spawn("pnpm", ["dev", "--port", String(PORT)], {
  shell: true,
  env: { ...process.env, DATABASE_URL: "pglite://memory", ROAST_GENERATOR: "template", NEXT_PUBLIC_SITE_URL: BASE },
  stdio: "ignore",
});
const stop = () => {
  // Kill the whole tree: on Windows a plain kill leaves next-server running.
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};

try {
  for (let i = 0; ; i++) {
    if (i > 120) throw new Error("dev server did not start");
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  mkdirSync(OUT, { recursive: true });

  const persona = readFileSync("spike/personas/self-help-addict.json", "utf8");
  const created = await fetch(`${BASE}/api/roast`, { method: "POST", headers: { "content-type": "application/json" }, body: persona });
  const { id } = (await created.json()) as { id: string };
  const owner = created.headers.get("set-cookie")!.split(";")[0];
  await fetch(`${BASE}/api/roast/${id}`, { method: "PATCH", headers: { cookie: owner, "content-type": "application/json" }, body: '{"visibility":"public"}' });

  const pages: [string, string, boolean][] = [
    ["landing", "/", false],
    ["roast", "/roast", false],
    ["reveal-owner", `/r/${id}`, true],
    ["reveal-public", `/r/${id}`, false],
    ["missing", "/r/doesnotexist", false],
    ["privacy", "/privacy", false],
  ];
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await ctx.addCookies([{ name: owner.split("=")[0], value: owner.split("=")[1], url: BASE }]);
    const anon = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    for (const [name, path, asOwner] of pages) {
      if (only.length && !only.includes(name)) continue;
      const page = await (asOwner ? ctx : anon).newPage();
      page.on("console", (m) => m.type() === "error" && console.log(`  [${name}@${w}] console: ${m.text().slice(0, 300)}`));
      page.on("pageerror", (e) => console.log(`  [${name}@${w}] pageerror: ${e.message.slice(0, 300)}`));
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: !process.env.TOP });
      await page.close();
      console.log(`${OUT}/${name}-${w}.png`);
    }
    await ctx.close();
    await anon.close();
  }
  await browser.close();
} finally {
  stop();
}
