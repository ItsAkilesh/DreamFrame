# DreamFrame — 9-Hour Build Plan

## 1. Ruthlessly Prioritized Feature List

**Must-have (the demo spine — build these or the demo doesn't exist):**
- **Script Upload & Auto-Structuring**: upload a full script (paste or file); an AI agent parses it into Acts → Scenes → Characters → Blocking → Shot list, persisted to Mongo. This replaces manual scene entry as the primary entry point.
- **Simulation engine**: LLM generates a scene's dialogue continuation per branch, structured output. Simulation runs **scene by scene** against the auto-generated structure, not the whole script at once.
- **Branch Impact Simulator** (2–3 branches on one decision point) — flagship feature
- **Dashboard metrics**: Arc Coherence, Emotional Tension Curve, Character Consistency, Chemistry Strength, Fragility/Risk Flag, Delta-from-previous — all computed by one "judge" LLM call
- **3D Blocking/Camera Explorer** (R3F, desktop orbit + shot presets — NOT device WebXR, see risks), using a **curated subset of Mixamo characters + animation clips** (not the literal entire library — see Risk #8) to perform each scene's blocking, driven by each line's `emotion` field
- **ElevenLabs voice playback** of the winning branch's key lines, per-character voice, synced with character animation
- **Decision Log** (auto-generated list of runs + one-line LLM rationale)

**Should-have (only after the above works end-to-end):**
- Character Motivation Stress Tester (reuses the engine with a persona override — cheap once engine exists)
- Chemistry Simulator as explicit pairwise score (bonus field on the judge call)
- Tone Lock / Tone Drift indicator (target tone band vs. actual — another judge field)
- Version Comparison Engine (side-by-side of two SimulationRuns — you already need the Delta metric)
- Liveblocks **presence only** (who's viewing, live cursors) — not collaborative editing
- Auto-generated shot list refinement (let the director nudge/re-roll the AI's suggested shots per scene)

**Cut entirely (say so out loud to the team so no one quietly builds these):**
- The **entire** Mixamo library (hundreds of characters, thousands of clips) — infeasible to download/convert/license-check in 9 hours; see Risk #8 for the curated alternative
- True WebXR headset flow — see risk #1
- Casting Fit Predictor (needs real actor reference ingestion pipeline)
- Improvisation Boundary Tester
- Audience Proxy Testing (needs demographic modeling)
- Scene Dependency Mapper, Reshoot Risk Predictor, Continuity Guardian, Creative Debt Tracker (all need many scenes/versions of history you won't have)
- Blind Feedback Sessions
- Full live multiplayer co-editing
- Dialogue Density/Subtext Analyzer, Theme Consistency Engine as dedicated UI (fold into judge scoring as extra fields if there's time, don't build separate screens)

**Extra metrics worth adding to the judge output** (cheap — same call, more JSON fields):
- **Engagement / predicted retention** (0–100, "would an audience stay locked in")
- **Subtext Density** (inverse of on-the-nose-ness, feeds the cut Dialogue Analyzer without a UI)
- **Improvisation Safety Margin** (how far the scene could drift before breaking character/plot — cheap proxy for the cut Improv Tester)

---

## 2. Team Division of Labor

| Engineer | Owns | Key deliverable |
|---|---|---|
| **A — Backend/AI** | Mongo schemas, API routes, **script-structuring agent** (script → Acts/Scenes/Characters/Blocking/Shots), simulation engine, judge/scoring call, Zod validation | `POST /api/parse-script` and `POST /api/simulate` both return validated, schema-checked JSON |
| **B — Frontend/App** | Next.js shell, script upload UI + generated Act/Scene tree browser, dashboard charts (Recharts), branch comparison UI, decision log UI | The main app screen, wired to A's APIs |
| **C — 3D/R3F** | **Mixamo asset pipeline** (curate + convert FBX→GLB for a small character/animation set), blocking scene, camera presets, emotion→animation mapping | `<BlockingCanvas scene={scene}/>` component with real animated characters |
| **D — Voice/Realtime/Infra** | ElevenLabs integration + audio caching, Liveblocks presence, Vercel deploy, MongoDB Atlas setup, integration glue | Voice plays in sync with transcript and character animation |

All four sync in the first 30 minutes to lock the Mongo schema and API contract, then work in parallel against fixtures/mocks until real integration in hours 4–6.

---

## 3. Technical Architecture

```
Next.js 15 (App Router, Vercel)
├── /app (UI) — server components for data fetch, client components for R3F/charts/audio
├── /app/api/parse-script  → Engineer A: script upload, LLM structures into Act/Scene/Character/Blocking/Shot JSON
├── /app/api/simulate      → Engineer A: calls LLM (transcript gen + judge), writes SimulationRun, scene by scene
├── /app/api/tts           → Engineer D: server-side ElevenLabs call (keep API key off client), returns audio URL/stream
├── /lib/db.ts             → Mongoose connection to MongoDB Atlas (cached across invocations)
├── /lib/ai.ts             → LLM client, Zod schemas, prompt builders (script parser + simulation + judge)
├── /lib/animationMap.ts   → maps judge-output `emotion` labels to curated Mixamo clip names
├── /public/mixamo (or blob storage) → pre-converted GLB characters + animation clips (curated subset only)
├── /components/BlockingCanvas.tsx → R3F canvas, loads Mixamo GLB models at Scene.blocking positions, plays mapped animations
├── /components/Dashboard.tsx      → Recharts: tension curve, score gauges, delta bar
└── Liveblocks provider (presence only) wrapping the editor page
```

- LLM calls happen **server-side only** (API routes / Server Actions) — never expose provider keys to the client.
- Script parsing is a **separate, one-time structured-output call per script** (chunked by detected scene breaks if the script is long), distinct from the per-scene simulation call — keep these two prompts and schemas independent so a bad parse doesn't corrupt simulation quality.
- One structured-output call generates the full multi-character transcript for a branch (not one call per character) — fewer round trips, more consistent tone, faster demo.
- A second structured call (or a second part of the same response) does judging/scoring against the fixed rubric.
- 3D scene reads plain `{x,y,z}` positions from Mongo and maps each `characterId` to a pre-assigned `mixamoCharacterId` — no physics engine, no real 3D authoring tool, just placed, animated GLB models.
- WebXR: add the `VRButton`/`XRButton` from `@react-three/xr` as a progressive-enhancement toggle on top of the same R3F scene — if it works in rehearsal, great, but the desktop orbit view is the real demo path.

---

## 4. Core Data Models (MongoDB)

```ts
// Script
{ _id, projectId, title: string, rawText: string, acts: [ObjectId] }

// Act
{ _id, scriptId, order: number, title: string, scenes: [ObjectId] }

// Character
{
  _id, projectId,
  name: string,
  persona: { motivation: string, backstory: string, traits: string[], baselineEmotion: string },
  voiceId: string,             // ElevenLabs voice id
  mixamoCharacterId: string,   // which curated Mixamo model this character is rendered as
  animationSet: string[],      // subset of clip names available to this character (idle, talk-mild, angry, sad, ...)
  color: string                // for chart legend / UI accent
}

// Scene
{
  _id, projectId, actId,
  order: number,
  text: string,                       // base scene/script text (as parsed from the script)
  toneTarget: string,                 // e.g. "tense, restrained" — AI-suggested, director-editable
  blocking: [{ characterId, position: {x,y,z}, rotation: number }],   // AI-suggested, director-editable
  cameraPresets: [{ name: string, position: {x,y,z}, lookAt: {x,y,z} }],
  shotList: [{ shotType: string, description: string, cameraPresetName: string }]  // AI-suggested
}

// SimulationRun
{
  _id, sceneId,
  branchLabel: string,                // "she forgives him"
  paramsOverride: { characterId, motivationOverride }?,
  transcript: [{ characterId, line: string, emotion: string, tensionAtLine: number }],
  scores: {
    arcCoherence: number, characterConsistency: number,
    chemistryStrength: number, toneDrift: number,
    fragilityRisk: number, engagement: number,
    tensionCurve: number[]            // per-beat, feeds the chart
  },
  rationale: string,                  // one paragraph, LLM-generated
  parentRunId: ObjectId?,             // for delta/version comparison
  createdAt: Date
}
```

Keep `Project` minimal (just a name + owner) — don't build multi-tenant auth for this demo.

---

## 5. AI Agent Design

**Script Structuring Agent (new):**
- Input: raw uploaded script text. If long, pre-split by detected scene breaks (regex on screenplay sluglines like `INT.`/`EXT.` if present, otherwise a heuristic paragraph/blank-line split) before sending to the LLM — keeps each call small and the structure reliable.
- One structured-output call per chunk returns `{ acts: [{ title, scenes: [{ text, toneTarget, characterNames, suggestedBlocking, suggestedShotList }] }] }`, validated with Zod.
- **Character auto-extraction**: dedupe character names seen across the script, then a follow-up (or same-call) inference builds a starter persona (motivation/traits/baselineEmotion) from that character's actual lines. Surface this to the director as **editable defaults** before simulating — don't trust it blindly, and don't block the demo on it being perfect.
- Each character is auto-assigned one of the curated `mixamoCharacterId`s + its `animationSet` (round-robin or simple heuristic — no need for anything smarter today).

**Simulation & Judge Agents (as before):**
- **Character state = persona doc**, not an evolving memory graph. Personas persist in Mongo across runs — "character memory persistence" in the lightweight, honest sense. No long-horizon memory graph; not visible in a 90-second demo anyway.
- **Per-run context** = persona + scene text + toneTarget + (optional) motivation override + transcript-so-far (for in-scene coherence).
- **Single structured-output call per branch** generates the whole transcript as JSON (`[{characterId, line, emotion}]`) — keeps characters consistent with each other since they're generated together.
- **Judge call**: fixed rubric prompt, few-shot anchored, strict JSON schema, validated with Zod, retry once on schema failure.
- **Rationale generation**: same judge call, one extra `rationale` string field — free, no extra round trip.

**Animation Mapping (new, deterministic, not an LLM call):**
- Each transcript line's `emotion` field maps to a Mixamo clip name via a fixed lookup table (`/lib/animationMap.ts`) — e.g. `angry → "angry-gesture"`, `sad → "sad-slump"`, `neutral → "idle-talk"`. Cheap, instant, no extra latency or reliability risk.

---

## 6. Implementation Plan (Hour-by-Hour)

**Hour 0–0.5 — Lockdown (all 4 together)**
Agree on schemas above, create repo, deploy empty Next.js skeleton to Vercel, create MongoDB Atlas cluster + open network access, get LLM + ElevenLabs API keys into env vars. **Start curating the Mixamo subset immediately** (pick ~2–4 characters and ~10–15 animation clips covering the emotion labels above) — this is the highest lead-time item, kick it off before anything else blocks on it.

**Hour 0.5–2 — Parallel scaffolding**
- A: Mongo models + seed script fixture (one hand-written scene as guaranteed fallback) + CRUD routes; start drafting the script-structuring prompt
- B: App shell, script upload UI (paste/file), Act/Scene tree browser against a hardcoded JSON fixture
- C: R3F canvas with placeholder meshes at hardcoded positions, orbit controls, camera-preset switching; in parallel, start Mixamo FBX→GLB conversion for the curated subset
- D: ElevenLabs spike (hardcoded line → audio playback), Liveblocks presence spike, confirm Vercel env/deploy pipeline

**Hour 2–4 — Core engines**
- A: finish script-structuring endpoint (script → Acts/Scenes/Characters/Blocking/Shots) and the simulation transcript + judge calls, Zod-validated, persisted
- B: wire script upload → generated scene tree → drill into a scene → branch UI; build tension-curve chart + score gauges + branch comparison view
- C: swap placeholder meshes for converted Mixamo GLB models at real `blocking` positions; wire `animationSet` playback per character
- D: wire ElevenLabs to real generated lines per `voiceId`, cache audio, continue presence wiring

**Hour 4–6 — Integration + should-haves**
- All: connect the full flow — upload script → AI structures it → pick a scene → simulate branches → dashboard → 3D playback → voice — in one screen
- A: add motivation override + explicit chemistry field
- B: decision log, delta-vs-previous display, tone-drift indicator
- C: wire emotion→animation mapping so playback drives character animation in sync with voice; polish lighting/camera easing; WebXR toggle only if ahead of schedule
- D: sync voice playback with transcript + animation timing; deploy checks

**Hour 6–7.5 — Hardening**
Bug bash on the integrated flow. Add timeouts/retries around every LLM/ElevenLabs call. Pre-generate and cache the audio + a known-good `SimulationRun` for the exact script/scene you'll demo, as a fallback if live calls flake or the live script parse misfires.

**Hour 7.5–8.5 — Demo prep**
Write and rehearse the 60–90s script twice, **using the actual script file you'll upload live**. Fix whatever breaks in rehearsal — nothing else.

**Hour 8.5–9 — Freeze**
Final deploy freeze. Record a backup screen-capture of a full successful run in case live demo/network fails.

---

## 7. Biggest Risks in This Stack (9 Hours)

1. **WebXR** — no reliable headset, HTTPS/permissions overhead, and most judges can't try it anyway. *Mitigate*: build the desktop R3F orbit view as the real deliverable; WebXR is a bonus button, never load-bearing for the demo.
2. **ElevenLabs latency/rate limits during live demo** — API hiccups are common under demo-day load. *Mitigate*: pre-generate and cache audio for the exact lines you'll play; live-generate only as a stretch flourish.
3. **LLM structured-output drift** (schema violations, inconsistent scoring scale). *Mitigate*: strict JSON schema + Zod + one retry; few-shot anchor examples in the judge prompt to stabilize the 0–100 scale.
4. **MongoDB Atlas setup friction** (network allowlist, connection string issues) eating time late. *Mitigate*: set this up in the first 30 minutes, not "when we need it."
5. **4 engineers blocking on each other** — classic integration risk. *Mitigate*: lock the schema/API contract in hour 0, everyone builds against fixtures until real integration in hour 4.
6. **Vercel serverless function timeouts** on LLM calls. *Mitigate*: keep prompts lean, watch function duration limits on your plan, use streaming if the transcript generation call runs long.
7. **Scope creep on realtime/collab** — Liveblocks tempts people into building real collaborative editing. *Mitigate*: presence only, say this explicitly out loud in the kickoff so no one quietly scope-creeps.
8. **"Entire Mixamo library" is not a 9-hour task** — Mixamo has hundreds of characters and thousands of animation clips; bulk-downloading, converting FBX→GLB, and clearing licensing for all of it would eat the entire build on its own, for no demo-visible benefit (you can only show a couple of characters in 90 seconds anyway). *Mitigate*: curate ~2–4 characters and ~10–15 clips that cover your emotion labels (idle, walk, talk-mild, talk-strong, angry, sad, happy, surprised, defensive, embrace) and treat the full library as a post-hackathon roadmap item.
9. **Script-parsing reliability** — real-world scripts vary wildly in formatting; a single LLM pass can mis-segment acts/scenes or hallucinate blocking/shots, especially on messy or non-standard input. *Mitigate*: keep the hand-seeded demo scene as a guaranteed fallback path; rehearse the live script-upload moment with the **actual file** you'll upload during the demo, not a different one.

---

## 8. Demo Flow (60–90 seconds)

1. **(5–10s)** Upload a real script file — watch the AI auto-generate Acts/Scenes/Characters/Shot list live, then drill into one scene.
2. **(15–20s)** Click "Simulate Branch Impact" → two branches generate side-by-side, dashboard metrics populate live (tension curve animating in).
3. **(10–15s)** Switch to the 3D blocking view — real Mixamo characters performing the blocking, orbit the camera, flip between shot presets (wide → close-up) to show framing changes the branch implies.
4. **(10–15s)** Play ElevenLabs voice on the winning branch's key line — each character in their own voice, animation reacting in sync (emotion-driven gesture). This is the emotional peak of the demo.
5. **(10s)** Show the dashboard: Arc Coherence, Chemistry Strength, Fragility flag, Delta-from-previous bar.
6. **(5–10s)** Show the Decision Log entry that was auto-created with its one-line rationale.
7. **(5s)** Close line: *"Directors used to guess. Now they simulate."*
