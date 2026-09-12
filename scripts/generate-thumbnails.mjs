// generate-thumbnails.mjs
// Purpose: Build-time generation of cached preview thumbnails for asset
//          library files that don't already have one. Runs as `postbuild`
//          (also invocable directly as `pnpm generate:thumbnails`): boots
//          the production server `next build` just produced, drives real
//          Chromium (Puppeteer) to the internal /thumbnail-render page for
//          each missing asset — reusing the app's own three.js/drei loading
//          and framing code, not a reimplementation of it — and writes the
//          resulting PNGs to public/assets/library-thumbnails/.
//
//          Idempotent by design: an asset with a cached thumbnail is
//          skipped, so nothing runs at all until a new file is dropped into
//          public/assets/library/. Never fails the build — thumbnails are a
//          cache; if generation can't run (no Chromium sandbox available,
//          the app isn't built yet, etc.) the app still works, just falling
//          back to the lazy client-side path this replaces for everyone else.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const LIBRARY_DIR = join(ROOT, "public", "assets", "library");
const THUMBNAIL_DIR = join(ROOT, "public", "assets", "library-thumbnails");
const CATEGORY_DIRS = { character: "characters", scene: "scenes" };
const PREVIEWABLE_FORMATS = new Set(["glb", "gltf", "fbx"]);

const PORT = process.env.THUMBNAIL_SERVER_PORT ?? "4173";
const SERVER_READY_TIMEOUT_MS = 30_000;
const PER_ASSET_TIMEOUT_MS = 25_000;

function baseName(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function formatOf(fileName) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

async function listMissingAssets(category) {
  const dir = join(LIBRARY_DIR, CATEGORY_DIRS[category]);
  if (!existsSync(dir)) return [];

  const thumbDir = join(THUMBNAIL_DIR, CATEGORY_DIRS[category]);
  const cached = existsSync(thumbDir)
    ? new Set((await readdir(thumbDir)).map(baseName))
    : new Set();

  const entries = await readdir(dir);
  return entries
    .map((fileName) => ({ fileName, format: formatOf(fileName) }))
    .filter(({ format }) => PREVIEWABLE_FORMATS.has(format))
    .filter(({ fileName }) => !cached.has(baseName(fileName)))
    .map(({ fileName, format }) => ({
      category,
      fileName,
      format,
      url: `/assets/library/${CATEGORY_DIRS[category]}/${fileName}`,
    }));
}

function waitForServerReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // not up yet — keep polling
      }
      if (Date.now() > deadline) {
        reject(new Error(`Server didn't respond at ${url} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

async function generateOne(page, asset) {
  const renderUrl =
    `http://localhost:${PORT}/thumbnail-render` +
    `?url=${encodeURIComponent(asset.url)}&format=${encodeURIComponent(asset.format)}`;

  await page.goto(renderUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('img[data-ready="true"], [data-error="true"]', {
    timeout: PER_ASSET_TIMEOUT_MS,
  });

  const errorText = await page.$eval("[data-error=\"true\"]", (el) => el.textContent).catch(() => null);
  if (errorText) {
    throw new Error(errorText);
  }

  const dataUrl = await page.$eval('img[data-ready="true"]', (el) => el.src);
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

  const outDir = join(THUMBNAIL_DIR, CATEGORY_DIRS[asset.category]);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${baseName(asset.fileName)}.png`), buffer);
}

async function run() {
  const missing = (
    await Promise.all(Object.keys(CATEGORY_DIRS).map((category) => listMissingAssets(category)))
  ).flat();

  if (missing.length === 0) {
    console.log("[thumbnails] every library asset already has a cached preview — nothing to do.");
    return;
  }

  if (!existsSync(join(ROOT, ".next"))) {
    console.warn("[thumbnails] no .next build output found — skipping (run `pnpm build` first).");
    return;
  }

  console.log(`[thumbnails] generating ${missing.length} missing preview(s)...`);

  const server = spawn("npx", ["next", "start", "-p", PORT], {
    cwd: ROOT,
    stdio: "ignore",
    shell: true,
  });

  try {
    await waitForServerReady(`http://localhost:${PORT}/thumbnail-render`, SERVER_READY_TIMEOUT_MS);

    const puppeteer = (await import("puppeteer")).default;
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      for (const asset of missing) {
        try {
          await generateOne(page, asset);
          console.log(`[thumbnails] saved ${asset.category}/${baseName(asset.fileName)}.png`);
        } catch (err) {
          console.error(`[thumbnails] failed for ${asset.fileName}:`, err instanceof Error ? err.message : err);
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.warn("[thumbnails] generation skipped due to an error (this never fails the build):", err);
});
