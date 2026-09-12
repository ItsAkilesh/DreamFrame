// label-animations.mjs
// Purpose: Give the animation library's ~2400 hash-named Mixamo FBX exports
//          real, searchable names. There is no descriptive name anywhere in
//          the data to recover — Mixamo always stamps every FBX's AnimStack
//          as the literal string "mixamo.com" regardless of the motion, and
//          the Title/Subject/Keywords/Comment metadata fields are empty, and
//          the filenames are content hashes from the bulk download. So this
//          asks a vision model to look at the motion instead: it applies
//          each clip to a reference character (reusing the app's own
//          retargeting code via the internal /animation-label-render page,
//          not a reimplementation of it), samples three frames across the
//          clip, and asks the model to name the action from those frames.
//          Results are cached into public/assets/library/animations/
//          names.json, which src/lib/asset-library.ts already reads — this
//          script only ever needs to run again for genuinely new files.
//
//          Expects an app server already running (pnpm dev or pnpm start) —
//          unlike generate-thumbnails.mjs, this is a deliberate, expensive,
//          run-by-hand batch job, not something to wire into every build.
//
// Usage:
//   pnpm label:animations                  # label everything not yet in names.json
//   LABEL_LIMIT=20 pnpm label:animations    # try a small batch first
//   LABEL_FORCE=1 pnpm label:animations     # re-label everything, ignoring the cache
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const ROOT = process.cwd();
const CHARACTERS_DIR = join(ROOT, "public", "assets", "library", "characters");
const ANIMATIONS_DIR = join(ROOT, "public", "assets", "library", "animations");
const NAMES_JSON_PATH = join(ANIMATIONS_DIR, "names.json");

const PORT = process.env.LABEL_SERVER_PORT ?? "3000";
const CONCURRENCY = Number(process.env.LABEL_CONCURRENCY ?? 4);
const LIMIT = process.env.LABEL_LIMIT ? Number(process.env.LABEL_LIMIT) : Infinity;
const FORCE = process.env.LABEL_FORCE === "1";
const PAGE_TIMEOUT_MS = 30_000;
const FLUSH_EVERY = 10;

// Mirrors src/lib/openai.ts's own key-loading and model choice — duplicated
// rather than imported because that file is TypeScript and this is a plain
// Node script with no build step of its own.
function getOpenAIApiKey() {
  const envLocalPath = join(ROOT, ".env.local");
  if (existsSync(envLocalPath)) {
    const match = readFileSync(envLocalPath, "utf8").match(/^OPENAI_API_KEY=["']?(.+?)["']?$/m);
    if (match?.[1]) return match[1];
  }
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  throw new Error("OPENAI_API_KEY is not set (checked .env.local and the environment)");
}

const VISION_MODEL = "gpt-5.6-terra";
const LabelSchema = z.object({
  name: z
    .string()
    .describe("A short (2-5 word) title-case label for the action, e.g. 'Waving Hello' or 'Sitting Down'."),
});

function waitForServerReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) return reject(new Error(`No server responding at ${url}`));
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

async function pickReferenceCharacter() {
  const entries = (await readdir(CHARACTERS_DIR)).filter((f) => f.toLowerCase().endsWith(".fbx")).sort();
  if (entries.length === 0) throw new Error("No .fbx character found to use as the animation reference model.");
  return entries[0];
}

async function loadExistingNames() {
  try {
    return JSON.parse(await readFile(NAMES_JSON_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function labelFromFrames(openai, frames) {
  const response = await openai.responses.parse({
    model: VISION_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "These three images are frames from one 3D character animation clip, sampled across its " +
              "duration in order. Name the specific action/motion being performed, in 2-5 words, title " +
              "case (e.g. 'Waving Hello', 'Punching Left', 'Sitting Down', 'Idle Breathing'). If nothing " +
              "recognizable is happening, say 'Idle Pose'.",
          },
          ...frames.map((dataUrl) => ({ type: "input_image", image_url: dataUrl, detail: "low" })),
        ],
      },
    ],
    text: { format: zodTextFormat(LabelSchema, "label") },
  });
  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Vision model returned no structured output");
  return parsed.name;
}

async function labelOnce(page, openai, referenceFileName, fileName) {
  const renderUrl =
    `http://localhost:${PORT}/animation-label-render` +
    `?character=${encodeURIComponent(`/assets/library/characters/${referenceFileName}`)}` +
    `&animation=${encodeURIComponent(`/assets/library/animations/${fileName}`)}`;

  await page.goto(renderUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('pre[data-ready="true"], [data-error="true"]', { timeout: PAGE_TIMEOUT_MS });

  const errorText = await page.$eval('[data-error="true"]', (el) => el.textContent).catch(() => null);
  if (errorText) throw new Error(errorText);

  const framesJson = await page.$eval('pre[data-ready="true"]', (el) => el.textContent);
  const frames = JSON.parse(framesJson);
  return labelFromFrames(openai, frames);
}

function isConnectionDownError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ERR_CONNECTION_REFUSED") || message.includes("ERR_CONNECTION_RESET");
}

// A dev server shared with someone actively editing files can go down for a
// stretch (mid hot-reload, or crashed and restarting) rather than just being
// briefly slow — retrying immediately against a server that's still down
// wastes the retry instead of using it. Waiting here for the server to
// actually respond again means the retry in labelOne lands on a live
// server instead of an instantly-failing one.
async function waitForServerRecovery() {
  console.log("[label-animations] server connection refused — waiting for it to come back...");
  await waitForServerReady(`http://localhost:${PORT}/animation-label-render`, 120_000).catch(() => {});
}

// A shared dev server under load (HMR rebuilds from someone else's edits,
// N concurrent tabs all hitting it) times out some fraction of requests for
// reasons that have nothing to do with the file being labeled — a single
// retry recovers most of those instead of permanently giving up on a
// perfectly fine animation.
async function labelOne(page, openai, referenceFileName, fileName) {
  try {
    return await labelOnce(page, openai, referenceFileName, fileName);
  } catch (err) {
    if (isConnectionDownError(err)) await waitForServerRecovery();
    return labelOnce(page, openai, referenceFileName, fileName);
  }
}

async function main() {
  const allFiles = (await readdir(ANIMATIONS_DIR))
    .filter((f) => f.toLowerCase().endsWith(".fbx"))
    .sort();

  const names = FORCE ? {} : await loadExistingNames();
  const pending = allFiles.filter((f) => FORCE || typeof names[f] !== "string").slice(0, LIMIT);

  if (pending.length === 0) {
    console.log(`[label-animations] all ${allFiles.length} animations already have a name — nothing to do.`);
    return;
  }

  console.log(`[label-animations] ${pending.length} of ${allFiles.length} animations need a name.`);
  await waitForServerReady(`http://localhost:${PORT}/animation-label-render`, 15_000);

  const referenceFileName = await pickReferenceCharacter();
  console.log(`[label-animations] using ${referenceFileName} as the reference character.`);

  const openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });

  let completed = 0;
  let failed = 0;
  let sinceFlush = 0;

  const flush = () => writeFile(NAMES_JSON_PATH, JSON.stringify(names, null, 2));

  const queue = [...pending];
  async function worker() {
    const page = await browser.newPage();
    try {
      while (queue.length > 0) {
        const fileName = queue.shift();
        if (!fileName) break;
        try {
          const name = await labelOne(page, openai, referenceFileName, fileName);
          names[fileName] = name;
          completed += 1;
          console.log(`[label-animations] (${completed + failed}/${pending.length}) ${fileName} -> "${name}"`);
        } catch (err) {
          failed += 1;
          console.error(`[label-animations] failed ${fileName}:`, err instanceof Error ? err.message : err);
        }
        sinceFlush += 1;
        if (sinceFlush >= FLUSH_EVERY) {
          sinceFlush = 0;
          await flush();
        }
      }
    } finally {
      // A page whose target already died (dev-server restart, crashed
      // renderer) throws on close — that must never take the whole batch
      // down with it; the other workers still have progress to save.
      await page.close().catch(() => {});
    }
  }

  const stopEarly = () => {
    console.log("\n[label-animations] interrupted — saving progress before exit...");
    flush().finally(() => process.exit(0));
  };
  process.once("SIGINT", stopEarly);

  try {
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker())
    );
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[label-animations] a worker crashed:", result.reason);
      }
    }
  } finally {
    await flush();
    await browser.close().catch(() => {});
    process.removeListener("SIGINT", stopEarly);
  }

  console.log(`[label-animations] done. labeled ${completed}, failed ${failed}. Saved to ${NAMES_JSON_PATH}`);
}

main().catch((err) => {
  console.error("[label-animations] fatal:", err);
  process.exit(1);
});
