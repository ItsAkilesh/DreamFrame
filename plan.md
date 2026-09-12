# 9-Hour Build Plan — Filmmaking Optimization Tool

## 1. Ruthlessly Prioritized Feature List

**Must-have (the demo spine — build these or the demo doesn't exist):**
- Script/scene/character data entry (minimal, not polished — textarea + character cards is fine)
- **Simulation engine**: LLM generates a scene's dialogue continuation per branch, structured output
- **Branch Impact Simulator** (2–3 branches on one decision point) — flagship feature
- **Dashboard metrics**: Arc Coherence, Emotional Tension Curve, Character Consistency, Chemistry Strength, Fragility/Risk Flag, Delta-from-previous — all computed by one "judge" LLM call
- **3D Blocking/Camera Explorer** (R3F, desktop orbit + shot presets — NOT device WebXR, see risks)
- **ElevenLabs voice playback** of the winning branch's key lines, per-character voice
- **Decision Log** (auto-generated list of runs + one-line LLM rationale)

**Should-have (only after the above works end-to-end):**
- Character Motivation Stress Tester (reuses the engine with a persona override — cheap once engine exists)
- Chemistry Simulator as explicit pairwise score (bonus field on the judge call)
- Tone Lock / Tone Drift indicator (target tone band vs. actual — another judge field)
- Version Comparison Engine (side-by-side of two SimulationRuns — you already need the Delta metric)
- Liveblocks **presence only** (who's viewing, live cursors) — not collaborative editing

**Cut entirely (say so out loud to the team so no one quietly builds these):**
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
| **A — Backend/AI** | Mongo schemas, API routes, simulation engine (LLM prompt + structured output), judge/scoring call, Zod validation | `POST /api/simulate` returns a validated `SimulationRun` |
| **B — Frontend/App** | Next.js shell, script/scene/character editor, dashboard charts (Recharts), branch comparison UI, decision log UI | The main app screen, wired to A's API |
| **C — 3D/R3F** | Blocking scene, camera presets (wide/close/OTS), orbit controls, positions driven by Scene data | `<BlockingCanvas scene={scene}/>` component |
| **D — Voice/Realtime/Infra** | ElevenLabs integration + audio caching, Liveblocks presence, Vercel deploy, MongoDB Atlas setup, integration glue | Voice plays in sync with transcript; app is deployed and demoable from hour ~4 onward |

All four sync in the first 30 minutes to lock the Mongo schema and API contract, then work in parallel against fixtures/mocks until real integration in hours 4–6.

---

## 3. Technical Architecture

```
Next.js 15 (App Router, Vercel)
├── /app (UI) — server components for data fetch, client components for R3F/charts/audio
├── /app/api/simulate      → Engineer A: calls LLM (transcript gen + judge), writes SimulationRun
├── /app/api/tts           → Engineer D: server-side ElevenLabs call (keep API key off client), returns audio URL/stream
├── /lib/db.ts             → Mongoose connection to MongoDB Atlas (cached across invocations)
├── /lib/ai.ts             → LLM client, Zod schemas, prompt builders
├── /components/BlockingCanvas.tsx → R3F canvas, reads Scene.blocking, exposes camera presets
├── /components/Dashboard.tsx      → Recharts: tension curve, score gauges, delta bar
└── Liveblocks provider (presence only) wrapping the editor page
```

- LLM calls happen **server-side only** (API routes / Server Actions) — never expose provider keys to the client.
- One structured-output call generates the full multi-character transcript for a branch (not one call per character) — fewer round trips, more consistent tone, faster demo.
- A second structured call (or a second part of the same response) does judging/scoring against the fixed rubric.
- 3D scene reads plain `{x,y,z}` positions from Mongo — no physics engine, no real 3D authoring tool, just placed meshes.
- WebXR: add the `VRButton`/`XRButton` from `@react-three/xr` as a progressive-enhancement toggle on top of the same R3F scene — if it works in rehearsal, great, but the desktop orbit view is the real demo path.

---

## 4. Core Data Models (MongoDB)

```ts
// Character
{
  _id, projectId,
  name: string,
  persona: { motivation: string, backstory: string, traits: string[], baselineEmotion: string },
  voiceId: string,       // ElevenLabs voice id
  color: string          // for 3D marker + chart legend
}

// Scene
{
  _id, projectId,
  order: number,
  text: string,                       // base scene/script text
  toneTarget: string,                 // e.g. "tense, restrained"
  blocking: [{ characterId, position: {x,y,z}, rotation: number }],
  cameraPresets: [{ name: string, position: {x,y,z}, lookAt: {x,y,z} }]
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

- **Character state = persona doc**, not an evolving memory graph. This is "character memory persistence" in the lightweight, honest sense: personas persist in Mongo across runs, so re-running a scene days later would still be consistent. Don't attempt true long-horizon memory — no time for it and it won't be visible in a 90-second demo anyway.
- **Per-run context** = persona + scene text + toneTarget + (optional) motivation override + last few lines of transcript so far (for in-scene coherence, not cross-session).
- **Single structured-output call per branch** generates the whole transcript as JSON (`[{characterId, line, emotion}]`) — avoids N round trips and keeps characters consistent with each other since they're generated together, not independently.
- **Judge call**: fixed rubric prompt, few-shot anchored (give 1–2 example transcripts with known "good"/"bad" scores in the prompt so the 0–100 scale doesn't drift between calls), strict JSON schema, validated with Zod, retry once on schema failure.
- **Rationale generation**: same judge call, one extra `rationale` string field — free, no extra round trip.

---

## 6. Implementation Plan (Hour-by-Hour)

**Hour 0–0.5 — Lockdown (all 4 together)**
Agree on schemas above, create repo, deploy empty Next.js skeleton to Vercel, create MongoDB Atlas cluster + open network access, get LLM + ElevenLabs API keys into env vars on Vercel and locally.

**Hour 0.5–2 — Parallel scaffolding**
- A: Mongo models + seed script (one strong 2–3 character scene, hand-written for demo quality) + CRUD routes; start drafting simulation prompt
- B: App shell + routes, script/character/scene UI against a hardcoded JSON fixture matching the schema
- C: R3F canvas, placeholder meshes at hardcoded positions, orbit controls, camera-preset switching logic
- D: ElevenLabs spike (hardcoded line → audio playback working), Liveblocks presence spike, confirm Vercel env/deploy pipeline end-to-end

**Hour 2–4 — Core engine**
- A: finish transcript-generation call + judge/scoring call, Zod validation, persist `SimulationRun`
- B: wire branch UI to real `/api/simulate`, build tension-curve chart + score gauges + branch comparison view
- C: wire real `blocking` positions into the canvas, refine camera preset transitions
- D: wire ElevenLabs to real generated lines per `voiceId`, cache audio, continue presence wiring

**Hour 4–6 — Integration + should-haves**
- All: connect the full flow — scene → simulate → dashboard → 3D → voice — in one screen
- A: add motivation override + explicit chemistry field
- B: decision log, delta-vs-previous display, tone-drift indicator
- C: 3D polish (lighting, camera easing); WebXR toggle only if ahead of schedule
- D: sync voice playback with transcript highlight; deploy checks

**Hour 6–7.5 — Hardening**
Bug bash on the integrated flow. Add timeouts/retries around every LLM and ElevenLabs call. Pre-generate and cache the audio + a known-good simulation run for the exact scene you'll demo, as a fallback if live calls flake.

**Hour 7.5–8.5 — Demo prep**
Write and rehearse the 60–90s script twice. Fix whatever breaks in rehearsal — nothing else.

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

---

## 8. Demo Flow (60–90 seconds)

1. **(5s)** Open a pre-loaded, well-written 2-character scene — script + character cards visible.
2. **(15–20s)** Click "Simulate Branch Impact" → two branches generate side-by-side, dashboard metrics populate live (tension curve animating in).
3. **(10–15s)** Switch to the 3D blocking view, orbit the camera, flip between shot presets (wide → close-up) to show framing changes the branch implies.
4. **(10–15s)** Play ElevenLabs voice on the winning branch's key line — each character in their own voice. This is the emotional peak of the demo.
5. **(10s)** Show the dashboard: Arc Coherence, Chemistry Strength, Fragility flag, Delta-from-previous bar.
6. **(5–10s)** Show the Decision Log entry that was auto-created with its one-line rationale.
7. **(5s)** Close line: *"Directors used to guess. Now they simulate."*
