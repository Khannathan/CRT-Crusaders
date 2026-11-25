// Opens every screen of the built game in a phone-sized headless Chromium,
// once on a brand-new save and once on a mid-game save (tools/smoke/mid-save.json),
// and fails if any screen throws or leaves the game with nothing running.
//
//   npm run build && npm run smoke
//
// It serves dist/ with `vite preview`. CI runs it after the build.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4178;
const URL = `http://localhost:${PORT}/`;
/** Screens that need a fight or a pull handed to them; they are reached through the others. */
const SKIP = new Set(['Boot', 'Title', 'Battle', 'Reveal', 'Results', 'Story', 'Camp', 'Crypt', 'ArtReview']);
const SAVE_KEY = 'crt-crusaders.save.v1';
const saves = { fresh: null, "mid-game": readFileSync(new globalThis.URL("./mid-save.json", import.meta.url), "utf8") };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview did not start');
}

async function boot(browser, save) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([key, s]) => {
    if (sessionStorage.getItem('smoke-seeded')) return;
    sessionStorage.setItem('smoke-seeded', '1');
    localStorage.clear();
    if (s) localStorage.setItem(key, s);
  }, [SAVE_KEY, save]);
  await page.goto(URL);
  await page.waitForFunction(() => window.__crt?.scene.getScenes(true).length > 0, null, { timeout: 60000 });
  return { page, errors };
}

const active = (page) => page.evaluate(() => window.__crt.scene.scenes.filter((s) => s.sys.isActive()).map((s) => s.scene.key));

async function main() {
  await waitForServer();
  const browser = await chromium.launch();
  const failures = [];
  let opened = 0;
  for (const [label, save] of Object.entries(saves)) {
    let ctx = await boot(browser, save);
    const keys = (await ctx.page.evaluate(() => window.__crt.scene.scenes.map((s) => s.scene.key))).filter((k) => !SKIP.has(k));
    for (const key of keys) {
      const before = ctx.errors.length;
      let running = [];
      try {
        await ctx.page.evaluate((k) => {
          const m = window.__crt.scene;
          for (const s of m.getScenes(true)) m.stop(s.scene.key);
          m.start(k, {});
        }, key);
        await ctx.page.waitForTimeout(700);
        running = await active(ctx.page);
      } catch (e) {
        // The game itself fell over (it was left by the previous screen's crash).
        ctx.errors.push(`the game stopped answering (${e.message.split('\n')[0]})`);
      }
      const errs = ctx.errors.slice(before);
      opened++;
      if (errs.length || !running.length) {
        failures.push(`${label} save, ${key}: ${errs.join(' | ') || 'nothing left running'}`);
        // A thrown screen can stall the game: start again for the next one.
        await ctx.page.close();
        ctx = await boot(browser, save);
      }
    }
    await ctx.page.close();
  }
  await browser.close();
  stop();
  if (failures.length) {
    console.error(`${failures.length} screen(s) broke:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Opened ${opened} screens on a fresh and a mid-game save. None broke.`);
}

main().catch((e) => {
  console.error(e);
  stop();
  process.exit(1);
});
