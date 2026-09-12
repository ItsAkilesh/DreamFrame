# DreamFrame

Paste or upload a script, and an AI agent structures it into Acts, Scenes, and
Characters. From there you can edit anything the AI got wrong, cast each
character with a 3D model (upload your own, pull from a shared Mixamo
library, or reuse the built-in previs renderer's own asset set), simulate a
scene as a live, turn-by-turn conversation between characters and get it
scored on arc coherence, chemistry, and risk — and separately, block a scene
out in a full 3D previs stage with camera coverage and automated
cinematography notes (line-of-action crossings, framing, coverage gaps).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · MongoDB Atlas (Mongoose) ·
`three` / `@react-three/fiber` / `@react-three/drei` · OpenAI · Tailwind v4 ·
Zod · Vitest

## Getting started

```bash
pnpm install     # lockfile is pnpm-lock.yaml — don't use npm/yarn
```

Create `.env.local` in the project root with:

```bash
MONGODB_URI=<your MongoDB Atlas connection string>
OPENAI_API_KEY=<your OpenAI API key>
```

Then:

```bash
pnpm dev         # http://localhost:3000
```

MongoDB is a cache for structured scripts, not a source of truth — the app
is meant to still open with it unreachable (see `/api/health`).

## What's here

- **Script structuring** — paste text or upload a PDF; one AI call segments
  it into Acts, Scenes, and Characters (`src/lib/ai/scriptParser.ts`).
- **Editing** — every AI-generated field (scene title/text/tone/cast, act
  titles, character name/motivation/traits/baseline emotion/cue color) is
  correctable inline, since the structuring pass is never guaranteed right.
- **Character roster** — a card per character with a live, pausable,
  zoomable 3D preview of their model, plus an upload/replace/remove flow and
  a picker into the shared asset library.
- **Simulation engine** ("Simulate Branch Impact") — characters improvise a
  scene turn by turn, each as its own structured-output call conditioned on
  its persona and the transcript so far, then a separate judge pass scores
  the finished transcript (arc coherence, character consistency, chemistry,
  fragility risk, engagement, tone drift, tension curve) into the scene's
  dashboard panel.
- **3D previs editor** (`/editor`) — the original from-scratch pipeline:
  script text → a validated scene spec (cast placement, cameras, beats) →
  a real-time Three.js stage with playback, plus a geometry-only analyzer
  that catches line-of-action crossings, framing problems, occlusion,
  eyeline mismatches, and coverage gaps — computed from the blocking, not
  guessed by an LLM.
- **Asset library** — shared Mixamo character/scene exports dropped into
  `public/assets/library/`, browseable and pickable from any character card.

## Model & asset thumbnails

Every 3D preview (character cards and the asset library) is a cached static
image, not a live render — mounting a live WebGL canvas per card blows past
the browser's concurrent-context limit the moment more than a handful are on
screen at once. One shared, on-demand canvas
(`src/components/thumbnail-generator-host.tsx`) generates each thumbnail
once and caches it; the live rotate/zoom viewer only mounts when you
explicitly open it.

Library thumbnails are additionally pre-generated at build time:
`pnpm build` runs `scripts/generate-thumbnails.mjs` afterward, which drives a
headless Chromium (Puppeteer) against an internal render page for any
library asset that doesn't already have a cached thumbnail, and writes the
result to `public/assets/library-thumbnails/`. It's incremental — an asset
with a cached thumbnail is skipped, so nothing runs at all until a new file
is dropped into `public/assets/library/` — and it never fails the build;
if it can't run, the app just falls back to generating that thumbnail
lazily in the browser instead. Run it by hand with
`pnpm generate:thumbnails`.

Uploaded character models and generated thumbnails are stored under
`public/uploads/` and `public/assets/library-thumbnails/` on local disk —
fine for a single-instance app, not durable across an ephemeral/serverless
deploy.

## Scripts

```bash
pnpm dev                  # next dev
pnpm build                # next build, then generates any missing library thumbnails
pnpm start                # next start (production)
pnpm typecheck            # tsc --noEmit
pnpm test                 # vitest run
pnpm lint                 # eslint
pnpm generate:thumbnails  # (re-)generate missing asset-library thumbnails on demand
```
