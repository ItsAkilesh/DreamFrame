# DreamFrame

DreamFrame is a decision-support tool for writers and directors. Paste or
upload a script and a Gemini agent structures it into Acts, Scenes, and
Characters. From there you can correct anything the model got wrong, cast
each character with a 3D model, simulate the scene as a live turn-by-turn
conversation (spoken with ElevenLabs), and score it on arc, chemistry, and
risk — or block the same scene on a 3D previs stage with camera coverage and
geometry-based cinematography notes.

A shoot day costs five figures. This is the scene, blocked and critiqued,
before anyone books a location.

## What you can do

1. **Upload a script** — paste plain text or drop a PDF. Gemini (`gemini-2.5-flash`)
   segments it into Acts, Scenes, and Characters with motivations, traits, and
   a baseline emotion.
2. **Edit the structure** — every AI-generated field is correctable inline
   (scene title, text, tone, cast; act titles; character name, motivation,
   traits, color, voice).
3. **Cast in 3D** — assign a Mixamo library model or upload your own GLB/FBX.
   Each character card shows a cached thumbnail; open the live viewer to
   rotate and zoom.
4. **Simulate a branch** — "Simulate Branch Impact" has each character
   improvise the next line (`gemini-2.5-pro`), conditioned on their persona
   and the transcript so far. A judge pass then scores arc coherence,
   consistency, chemistry, fragility, engagement, tone drift, and a tension
   curve.
5. **Hear the scene** — each turn is spoken with ElevenLabs (`eleven_v3`).
   Characters get distinct voices (assigned in the roster, or a stable
   fallback from the Voice Library). Delivery is shaped by the line's
   emotion so it doesn't all sound like the same read.
6. **Stress-test characters** — Motivation Stress Test and Chemistry
   Simulator run focused Gemini probes without simulating the whole scene.
7. **Block in 3D** (`/editor`) — place the cast, keyframe blocking, play the
   timeline, and get notes from a geometry-only analyzer (line of action,
   framing, occlusion, eyelines, coverage). Those notes are computed from
   the blocking, not guessed by an LLM.
8. **Inspect models** (`/model`) — drop a GLB/GLTF onto the inspector to
   check scale and animation clips before they go into a scene.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind v4, Base UI / shadcn |
| Database | MongoDB Atlas (Mongoose) — cache for structured scripts, not a source of truth |
| LLM | **Google Gemini API** (`@google/generative-ai`) — script parse, simulation, judge, recommendations, audience panel |
| Voice | **ElevenLabs** (`eleven_v3`) — per-character TTS, never exposed to the browser |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` |
| Validation | Zod |
| Tests | Vitest |

Gemini lives in `src/lib/gemini.ts` and is used by `src/lib/ai/*`. ElevenLabs
lives in `src/lib/voice/elevenlabs.ts` and is only called from
`src/app/api/tts/` so the API key never reaches the client.

## Getting started

```bash
pnpm install     # lockfile is pnpm-lock.yaml — don't use npm/yarn
```

Create `.env.local` in the project root (see `.env.example`):

```bash
MONGODB_URI=<your MongoDB Atlas connection string>

# Google AI Studio — https://aistudio.google.com/apikey
GEMINI_API_KEY=<your Gemini API key>
GEMINI_SCRIPT_MODEL=gemini-2.5-flash
GEMINI_SIMULATION_MODEL=gemini-2.5-pro

# ElevenLabs — https://elevenlabs.io/app/settings/api-keys
# Used to speak simulation turns. Without it, playback still runs, silent.
ELEVENLABS_API_KEY=<your ElevenLabs API key>
```

Then:

```bash
pnpm dev         # http://localhost:3000
```

MongoDB is optional at runtime. If Atlas is unreachable the dashboard still
opens with a bundled demo script (`/api/health`). Gemini is required for
upload/simulate/recommend. ElevenLabs is required only for voiced playback
and the voice picker.

## Gemini API

All language-model work goes through Google Gemini:

| Pass | Model env | Default | Where |
|---|---|---|---|
| Script structuring | `GEMINI_SCRIPT_MODEL` | `gemini-2.5-flash` | `src/lib/ai/scriptParser.ts` |
| Turn-by-turn simulation | `GEMINI_SIMULATION_MODEL` | `gemini-2.5-pro` | `src/lib/ai/simulateConversation.ts` |
| Judge / metrics | same | `gemini-2.5-pro` | `src/lib/ai/judgeSimulation.ts` |
| Script doctor / Improve panel | same | `gemini-2.5-pro` | `src/lib/ai/recommendScript.ts` |
| Audience personas | same | `gemini-2.5-pro` | `src/lib/ai/audienceReview.ts` |
| Motivation stress test | same | `gemini-2.5-pro` | `src/lib/ai/motivationStressTest.ts` |
| Chemistry simulator | same | `gemini-2.5-pro` | `src/lib/ai/chemistrySimulator.ts` |

Flash is used for the one-shot structuring pass (cheap, long input). Pro is
used for dialogue, judging, and craft notes.

## ElevenLabs

Simulation playback synthesizes each turn server-side:

- Route: `POST /api/tts` (audio) and `GET /api/tts/voices` (account voices)
- Model: `eleven_v3` (`src/lib/voice/elevenlabs.ts`)
- Voice assignment: `src/components/voice-picker.tsx` on the character
  roster, stored on `Character.voiceId`
- Fallback: a small curated Voice Library list, hashed from character id so
  two characters don't accidentally share a voice
- Fail-soft: if a key is missing or a request 402/404s, the turn still
  plays with captions and no audio

## 3D previs and thumbnails

Every 3D preview (character cards and the asset library) is a cached static
image, not a live render — mounting a live WebGL canvas per card blows past
the browser's concurrent-context limit. One shared, on-demand canvas
(`src/components/thumbnail-generator-host.tsx`) generates each thumbnail
once and caches it; the live rotate/zoom viewer only mounts when you
explicitly open it.

Library thumbnails are additionally pre-generated at build time:
`pnpm build` runs `scripts/generate-thumbnails.mjs` afterward, which drives a
headless Chromium (Puppeteer) against an internal render page for any
library asset that doesn't already have a cached thumbnail, and writes the
result to `public/assets/library-thumbnails/`. It's incremental — an asset
with a cached thumbnail is skipped — and it never fails the build. Run it
by hand with `pnpm generate:thumbnails`.

Uploaded character models live under `public/uploads/`. The Mixamo library
is `public/assets/library/` (gitignored; drop files in locally).

## Scripts

```bash
pnpm dev                  # next dev
pnpm build                # next build, then generate missing library thumbnails
pnpm start                # next start (production)
pnpm typecheck            # tsc --noEmit
pnpm test                 # vitest run
pnpm lint                 # eslint
pnpm generate:thumbnails  # (re-)generate missing asset-library thumbnails
pnpm label:animations     # vision-label Mixamo clips (needs a running server)
```
