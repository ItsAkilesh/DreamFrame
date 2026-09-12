# DreamFrame — Complete Build Plan

**Pitch:** Paste a page of a script. Thirty seconds later you are standing inside the scene in 3D, moving the camera, and the tool is telling you your reverse shot crossed the line.

**The line that sells it:** *"A day on a set costs five figures. This is the scene, blocked and critiqued, before anyone books a location."*

**Assumptions this plan is written against** (change them and the milestones shift): ~36 hours, 3–4 people, one Quest-class headset available for WebXR testing, Claude API key with headroom. If any of those is false, read §13 first.

---

## §0 How to use this document

This is the whole build in one file: the contract, the pipelines, the checks, the milestones, the demo, and the prompts to paste into Claude Code. It replaces a scattered `docs/` folder — there is one document, and section numbers are the addresses.

**Read order on hour zero:** §1 (demo) → §2 (scope) → §3 (contract) → §10 (hard rules) → §11 (milestones). Then your workstream's section: renderer → §6, AI → §7, analyzer → §9, voice → §8.

**Withhold sections deliberately when prompting Claude Code.** §9 and §7 will pull an M0 agent's scope toward the analyzer and the AI pipeline and cause it to over-build. §16 has the prompts with the right sections named.

| You are touching | Read |
|---|---|
| Any data shape | §3 — and update both fixtures in the same change |
| `src/render/`, assets | §6 |
| `src/analyze/` | §9 |
| `src/ai/` | §7 |
| `src/voice/` | §8 |
| Starting a milestone | §11 |
| Unsure whether something matters | §1 and §15 — if it doesn't serve the demo, don't build it |

---

## §1 The demo you are building toward

Write the demo before you write the code. Everything that does not serve these 180 seconds is cut.

1. Judge sees a text box. Paste ~1 page of dialogue (2–3 characters, one location).
2. Click **Block Scene**. Loading ~15 s.
3. 3D set appears: room, furniture, characters standing in position. Timeline at the bottom with a beat per line.
4. Hit play. Characters walk, sit, gesture, turn to each other. Captions show the line. Camera cuts between shots automatically.
5. Open the **Notes** panel: *"Shots 4→5 cross the line of action — the audience will think MAYA changed sides. Move Cam B to the other side of the axis."* and *"RAVI speaks 46% of the lines but is the dominant subject in 12% of shots."*
6. Click the fix. Camera moves. Re-play. Note clears.
7. Put the headset on (or hit **VR**). Walk the set at 1:1 scale, stand where the camera stands.
8. Export shot list — a contact sheet of every shot with lens, size, and position.

### The run sheet (rehearse against this, not against a vibe)

| t | Action | What you say |
|---|---|---|
| 0:00 | Title slide, one image of a film set | "A shoot day costs five figures. Directors still block scenes with sticky notes and a hand-drawn storyboard." |
| 0:20 | App open, empty input | "This is DreamFrame. Paste a page of script." |
| 0:25 | Paste the demo scene, hit **Block Scene** | "It's reading the scene, placing the cast, and setting the cameras." |
| 0:45 | Scene appears, hit **Play** | Say nothing. Let them watch for eight seconds. |
| 0:55 | Let it play through with auto-cuts | "That's the scene blocked — marks, moves, coverage, cut together." |
| 1:15 | Open **Notes** | "Now the part that isn't an LLM." |
| 1:25 | Read the `LINE_CROSS` note out loud | "It found that shots seven and eight cross the line of action. On the cut, Maya jumps to the other side of frame. That's geometry — it computed the axis between the two characters and checked which side each camera is on." |
| 1:45 | Click **Apply fix**, replay the two beats | "Fixed." |
| 1:55 | Click the coverage note | "And Sam speaks nine lines and is never the subject of a shot. There's nothing to cut to." |
| 2:05 | *(T1)* Hit **Voice** on the peak beat | "Each character in their own voice, the animation reacting to the line's emotion." |
| 2:15 | **VR** (or walkthrough) | "And because it's WebXR, you can stand in it before anyone books a location." |
| 2:30 | Shot list export | "Out the other end: a shot list the camera department can actually use." |
| 2:40 | Close | "Script to blocked, critiqued scene, in the browser, in thirty seconds." |

**Practise the silence at 0:45.** The instinct is to narrate over the reveal. Don't — the reveal is the product.

---

## §2 Scope — in, out, and why

### T0 — must exist or there is no demo
- Script text → structured scene spec (one Claude call)
- 3D renderer: set, cast, blocking playback, timeline scrub
- Character library with baked Mixamo clips
- Deterministic cinematography checks + LLM-written rationale
- Camera presets, manual camera control, shot list

### T1 — build only if T0 lands by hour 20
- WebXR walkthrough
- One-click "apply fix" per note
- Dialogue density analytics panel
- Shot list export (PNG contact sheet)
- **Script auto-structuring**: upload a full script, segment it into scenes, pick one to block (§7.3)
- **ElevenLabs voice playback** of key lines, per-character voice, synced to the playhead (§8)

### T2 — only if everything above is done and rehearsed
- **Branch Impact Simulator**: re-block one scene under an alternative dramatic choice, compare side by side (§7.4)
- LLM judge scores (arc coherence, tension curve, chemistry, fragility) — *see the warning in §7.4 before building this*
- Multiple scenes held in state at once / project persistence
- Lighting presets beyond three-point

### Explicitly cut — say this out loud to the team now

| Cut | Why |
|---|---|
| **Actor face → 3D model** | Photogrammetry/face-fitting is a multi-day problem, and putting a real performer's likeness in a demo invites a rights question you cannot answer on stage. Replaced by **casting mode**: the user types an actor name and it only conditions the LLM's performance direction ("plays it still and clipped"). Zero mesh work, keeps the creative intent. |
| **Video generation via any model API** | The realtime scene *is* the deliverable. Generation is slower, costs more, and looks worse than what is already on screen. If you want a file, capture the canvas (§14). |
| **The entire Mixamo library** | Hundreds of characters, thousands of clips. Bulk-downloading, converting, and licence-checking all of it would eat the whole build for no demo-visible benefit — you can only show two or three characters in 180 seconds. Curate 6 characters and 14 clips (§6) and treat the library as a roadmap item. |
| **Auth / accounts** | Zero judge value. `localStorage` for the single session. |
| **Any backend or database** | This is a static SPA. No Mongo, no Next.js API routes, no Vercel functions, no ORM. The cost is a client-side API key, which you disclose honestly (§7.5). The benefit is that nothing can be down on stage. |
| **Lipsync (visemes/phonemes)** | Talk-cycle animation + caption bubble reads as speech at previs fidelity. Viseme rigging is a day of work for something previs artists do not even do. |
| **Procedural set generation** | Exactly 3 preset rooms (§6). The LLM picks one and places props in it. It does not design architecture. |
| **Live multiplayer co-editing / presence** | No backend, and it is invisible in a solo stage demo. |
| **Undo/redo history** | |
| Casting Fit Predictor, Improvisation Boundary Tester, Audience Proxy Testing | Each needs an ingestion or modelling pipeline you do not have hours for. |
| Scene Dependency Mapper, Reshoot Risk Predictor, Continuity Guardian, Creative Debt Tracker | All need many scenes and many versions of history you will not have by hour 34. |
| Dedicated Dialogue Density / Theme Consistency screens | Fold into §9's density panel and the note list. No separate screens. |

If a request implies one of these, flag it and propose the in-scope alternative instead of building it.

---

## §3 The contract — `PrevisSpec`

This is the only thing the workstreams share. The LLM emits it. The renderer draws it. The analyzer reads it. Nothing imports anything else.

Freeze it in the first two hours, hand-write two fixtures, and the whole team can work in parallel against fixtures while the LLM pipeline is still broken.

**If you change this section you must, in the same commit, change `src/schema/previsSpec.ts` and both fixtures.**

### 3.1 Coordinate conventions

| | |
|---|---|
| Units | metres |
| Up axis | +Y |
| Handedness | right-handed (Three.js native) |
| Rotation | `rotationY` in **radians**, 0 = facing +Z, increasing counter-clockwise viewed from above |
| Room origin | floor centre of the room, `[0, 0, 0]` |
| Back wall | at **−Z** in every preset — so a camera at +Z looking at the origin is the natural master |
| Character position | floor point under the character's feet, not their centre of mass |
| Eye height | 1.60 m standing, 1.15 m seated (constants, not stored in the spec) |
| Head height | 1.68 m standing, 1.22 m seated (used for framing checks) |

### 3.2 Top-level shape

```ts
PrevisSpec = {
  version: "0.1"
  scene:   SceneMeta
  set:     SetSpec
  cast:    Character[]        // 1–5
  cameras: Camera[]           // 1–6
  beats:   Beat[]             // 1–40
}
```

### 3.3 SceneMeta

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | `"sc_01"` | |
| `slugline` | string | `""` | e.g. `INT. KITCHEN - NIGHT` |
| `room` | `RoomPreset` | `"kitchen"` | closed enum, see §6 |
| `timeOfDay` | `"day" \| "night" \| "dusk" \| "dawn"` | `"day"` | drives the lighting preset |
| `mood` | string | `"neutral"` | free text, used only for the lighting nudge and LLM context |
| `toneTarget` | string | `""` | *(T1)* director-editable target tone, e.g. `"tense, restrained"`; set by the structuring pass, fed back into re-blocks |

### 3.4 SetSpec

| Field | Type | Default | Notes |
|---|---|---|---|
| `dimensions` | `{w,d,h}` | `{w:6,d:5,h:3}` | clamp: w,d ∈ [3,12], h ∈ [2.4,4] |
| `props` | `Prop[]` | `[]` | max 14 |
| `lights` | `Light[]` | three-point preset | if empty, renderer injects the preset for `timeOfDay` |

**Prop**

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | required | unique within the spec |
| `type` | `PropType` | required | **closed enum** from `manifest.ts` |
| `position` | `[x,y,z]` | required | `y` is always `0`; props sit on the floor |
| `rotationY` | number | `0` | radians |
| `scale` | number | `1` | clamp [0.5, 2] |

**Light**

| Field | Type | Default |
|---|---|---|
| `id` | string | required |
| `type` | `"ambient" \| "point" \| "spot" \| "directional"` | required |
| `position` | `[x,y,z]` | `[0,2.5,0]` |
| `target` | `[x,y,z]` | `[0,1.4,0]` (spot/directional only) |
| `intensity` | number | `1` |
| `color` | hex string | `"#ffffff"` |

Only **one** light may cast shadows. The renderer picks the highest-intensity spot/directional and ignores `castShadow` elsewhere. This is a performance rule, not a style rule.

### 3.5 Character

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | required | convention `ch_<lowercase_name>` |
| `name` | string | required | as written in the script, uppercase |
| `modelId` | `ModelId` | required | **closed enum** from `manifest.ts` |
| `position` | `[x,y,z]` | required | starting mark, `y = 0` |
| `rotationY` | number | `0` | starting facing |
| `posture` | `"standing" \| "seated"` | `"standing"` | |
| `direction` | string | `""` | performance note (casting mode output), display-only |
| `voiceId` | string | `""` | *(T1)* ElevenLabs voice id, assigned round-robin (§8) |
| `color` | hex string | derived | UI accent + capsule placeholder colour |

**Invariants the validator enforces:** no two characters within 0.45 m of each other at start; every character inside the room bounds minus 0.3 m margin; `modelId` unique across cast where possible.

### 3.6 Camera

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | required | convention `cam_a`, `cam_b`, … |
| `label` | string | `""` | e.g. `"OTS Maya"` |
| `position` | `[x,y,z]` | required | lens node position |
| `lookAt` | `[x,y,z]` | required | aim point; for a character, use their head height |
| `lens_mm` | number | `35` | clamp [14, 135] |

`lens_mm` → Three.js vertical FOV, full-frame 24 mm sensor height:

```ts
const vFovDeg = 2 * Math.atan(24 / (2 * lens_mm)) * (180 / Math.PI);
```

Every spec must include at least a wide master. Recommended default rig: `cam_a` wide 28 mm, `cam_b` OTS on character 1 at 50 mm, `cam_c` OTS on character 2 at 50 mm, `cam_d` clean CU at 85 mm.

### 3.7 Beat

One beat = one line of dialogue, or one wordless action. This is also the cut unit.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | string | required | `b_001`, ordered |
| `startTime` | number (s) | required | monotonically increasing, no gaps > 2 s |
| `duration` | number (s) | required | estimate at 150 wpm, min 1.2 s |
| `line` | `Line \| null` | `null` | null for action-only beats |
| `blocking` | `BlockingCue[]` | `[]` | what bodies do during this beat |
| `shot` | `Shot` | required | which camera is on, and of whom |

**Line**

| Field | Type | Notes |
|---|---|---|
| `characterId` | string | must exist in `cast` |
| `text` | string | the spoken line, verbatim from the script |
| `emotion` | string | free text; drives clip selection (§6.5), the caption tint, and voice delivery (§8) |

**BlockingCue**

| Field | Type | Default | Notes |
|---|---|---|---|
| `characterId` | string | required | |
| `action` | `Action` | required | `"walk" \| "turn" \| "sit" \| "stand" \| "gesture" \| "idle"` |
| `to` | `[x,y,z]` \| null | `null` | required for `walk`; `y = 0` |
| `facing` | number \| null | `null` | radians; required for `turn` |
| `clip` | `ClipId` | derived | **closed enum**; if omitted the renderer picks from `action` + `posture` + `emotion` via §6.5 |

**Shot**

| Field | Type | Default | Notes |
|---|---|---|---|
| `cameraId` | string | required | must exist in `cameras` |
| `subjectId` | string | required | the character this shot is *about* |
| `move` | `"static" \| "push" \| "pull" \| "pan" \| "dolly"` | `"static"` | |
| `shotSize` | `ShotSize` | derived | **never trust this field** — the analyzer recomputes it from lens + distance (§9.2). It exists only as the LLM's stated intent, useful for diffing intent vs result. |

### 3.8 Worked example

```jsonc
{
  "version": "0.1",
  "scene": {
    "id": "sc_01",
    "slugline": "INT. APARTMENT KITCHEN - NIGHT",
    "room": "kitchen",
    "timeOfDay": "night",
    "mood": "tense"
  },
  "set": {
    "dimensions": { "w": 6, "d": 5, "h": 3 },
    "props": [
      { "id": "table_1", "type": "dining_table", "position": [0,0,0], "rotationY": 0, "scale": 1 },
      { "id": "chair_1", "type": "chair", "position": [-1.1,0,0], "rotationY": 1.57, "scale": 1 }
    ],
    "lights": [
      { "id": "key",  "type": "spot",    "position": [2,2.6,2],   "target": [0,1.4,0], "intensity": 3.0,  "color": "#ffe8c4" },
      { "id": "fill", "type": "point",   "position": [-2,2,1.5],  "intensity": 0.8,    "color": "#9fb8ff" },
      { "id": "amb",  "type": "ambient", "intensity": 0.25,       "color": "#ffffff" }
    ]
  },
  "cast": [
    { "id": "ch_maya", "name": "MAYA", "modelId": "f_casual",
      "position": [-1.1,0,0], "rotationY": 1.57, "posture": "seated",
      "direction": "holds still, does not look up when she lies" },
    { "id": "ch_ravi", "name": "RAVI", "modelId": "m_casual",
      "position": [1.4,0,0.6], "rotationY": -1.4, "posture": "standing" }
  ],
  "cameras": [
    { "id": "cam_a", "label": "Wide",     "position": [0,1.6,4.2],    "lookAt": [0,1.4,0],     "lens_mm": 28 },
    { "id": "cam_b", "label": "OTS Maya", "position": [-2.1,1.6,1.8], "lookAt": [1.4,1.5,0.6], "lens_mm": 50 }
  ],
  "beats": [
    { "id": "b_001", "startTime": 0.0, "duration": 3.2,
      "line": { "characterId": "ch_ravi", "text": "You were going to tell me tomorrow.", "emotion": "controlled anger" },
      "blocking": [
        { "characterId": "ch_ravi", "action": "walk", "to": [0.6,0,0.9], "clip": "walk_slow" },
        { "characterId": "ch_maya", "action": "gesture", "clip": "idle_tense" }
      ],
      "shot": { "cameraId": "cam_b", "move": "static", "shotSize": "MS", "subjectId": "ch_ravi" } }
  ]
}
```

### 3.9 Notes (analyzer output — not part of the spec, but shares the file)

```ts
type Note = {
  id: string
  code: NoteCode          // "LINE_CROSS" | "SIZE_MONOTONY" | "HEADROOM" | "NOSE_ROOM"
                          // | "OCCLUSION" | "EYELINE" | "COVERAGE_GAP" | "TALK_SCREEN_SKEW"
                          // | "CAMERA_IN_GEOMETRY"
  severity: "error" | "warning" | "info"
  beatIds: string[]
  characterIds: string[]
  message: string         // deterministic default, overwritten by the LLM rationale pass
  suggestedFix?: {
    cameraId: string
    position?: [number, number, number]
    lookAt?: [number, number, number]
    lens_mm?: number
  }
}
```

### 3.10 Zod skeleton

```ts
import { z } from "zod";
import { MODEL_IDS, CLIP_IDS, PROP_TYPES, ROOM_PRESETS } from "@/assets/manifest";

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const ShotSize = z.enum(["ECU","CU","MCU","MS","MWS","WS"]);
export const Action   = z.enum(["walk","turn","sit","stand","gesture","idle"]);

export const CharacterZ = z.object({
  id: z.string(),
  name: z.string(),
  modelId: z.enum(MODEL_IDS),
  position: Vec3,
  rotationY: z.number().default(0),
  posture: z.enum(["standing","seated"]).default("standing"),
  direction: z.string().default(""),
});

// … Prop, Light, Camera, Beat follow the same pattern …

export const PrevisSpecZ = z.object({
  version: z.literal("0.1"),
  scene: SceneMetaZ,
  set: SetSpecZ,
  cast: z.array(CharacterZ).min(1).max(5),
  cameras: z.array(CameraZ).min(1).max(6),
  beats: z.array(BeatZ).min(1).max(40),
});

export type PrevisSpec = z.infer<typeof PrevisSpecZ>;
```

### 3.11 Repair, don't reject

`src/schema/repair.ts` exports `coerceSpec(raw: unknown): { spec: PrevisSpec; warnings: string[] }`:

1. Snap out-of-enum strings to the nearest legal value by Levenshtein distance (`"dining table"` → `dining_table`).
2. Clamp all numbers to their documented ranges.
3. Drop props/beats that reference missing ids, and record a warning.
4. If `cameras` is empty, inject the default 4-camera rig computed from cast positions.
5. If a beat has no `shot`, assign the wide master.

Only if `coerceSpec` throws do you fall back to the template spec.

**Rules for the contract, restated because they are the ones that get broken:** metres, Y-up, right-handed, radians. `modelId`, `clip`, and `props[].type` come from a closed enum the renderer publishes — the LLM will invent asset names, and you will spend an hour debugging a missing GLB. Every field has a default; a half-filled spec must still render.

### 3.12 Fixtures

Both live in `src/fixtures/` and must always validate.

- `kitchen_twohander.json` — 2 characters, 12 beats, clean. Used for renderer development.
- `office_threehander.json` — 3 characters, 18 beats, **deliberately flawed**: one line crossing between beats 7→8, four consecutive MS shots, and one character with 9 lines who is never a shot subject. This is the analyzer's test bed and the demo's reliable fallback.

Compute the camera positions so those flaws are **geometrically real**, not just labelled. A fixture with flaws in name only makes every analyzer test in §9 pass against nothing.

---

## §4 Stack — pinned, do not add to it

React 18 · TypeScript · Vite · `three` · `@react-three/fiber` · `@react-three/drei` · `@react-three/xr` · `zustand` · `zod` · `zod-to-json-schema` · `tailwindcss` · `vitest`

| Layer | Choice | Note |
|---|---|---|
| App | Vite + React + TypeScript | Fastest cold start, no SSR nonsense |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei` | Declarative scene from JSON is a 10× win over raw three |
| VR | `@react-three/xr` | WebXR session, controller rays, teleport |
| Characters | Mixamo GLB, pre-downloaded and committed | §6 — do **not** fetch at runtime |
| LLM | Claude via `POST /v1/messages`, tool use for structured output | §7 |
| Voice | ElevenLabs REST, pre-generated and cached | §8, T1 |
| Validation | Zod mirroring §3 | Repair, never crash |
| State | Zustand — one store, `src/store/useScene.ts` | Spec + playhead + notes |
| Styling | Tailwind | |
| Persistence | `localStorage` | |
| Backend | **none** | Static SPA. See §2 for why, §7.5 for the honest caveat. |

Anything else requires asking first. No UI component libraries, no state-machine libraries, no animation libraries, no ORM, no backend.

---

## §5 Repo layout

```
src/
  schema/
    previsSpec.ts             # Zod + TS types. Single source of truth (§3).
    repair.ts                 # coerceSpec (§3.11)
  fixtures/                   # kitchen_twohander.json, office_threehander.json
  assets/manifest.ts          # closed enums + GLB path helpers (§6.1)
  ai/
    blockScene.ts             # script -> PrevisSpec (tool-use call, §7.1)
    rationale.ts              # Note[] -> director notes (§7.2)
    structureScript.ts        # T1: full script -> scene list (§7.3)
    fallback.ts               # template spec of last resort
    prompts/
  render/
    Stage.tsx                 # <Canvas>, lights, set
    Character.tsx             # GLB + clip mixer, driven by playhead
    Prop.tsx
    CameraRig.tsx             # lens_mm -> fov, shot presets
    animationMap.ts           # emotion+action -> ClipId (§6.5)
    rooms/                    # kitchen.ts, office.ts, bar.ts
    XRSession.tsx
  analyze/
    geom.ts                   # shared helpers (§9.1)
    checks/                   # one file per check, pure fn, unit-tested
    density.ts                # dialogue density panel (§9.4)
    index.ts
  voice/
    tts.ts                    # T1: ElevenLabs fetch + cache (§8)
  ui/
    ScriptInput.tsx  Timeline.tsx  NotesPanel.tsx
    ShotList.tsx     CastPanel.tsx  SceneTree.tsx
  store/useScene.ts
public/assets/characters/  public/assets/props/
```

`analyze/checks/*` are pure functions over JSON — they are the only thing worth unit-testing, testing them takes ten minutes, and they are what saves you on stage.

---

## §6 Asset pipeline

**Owner: workstream A. Do this in hour one. It blocks everyone.**

The classic hackathon failure is the 3D person waiting on assets at hour 20. Assets get converted, committed, and enumerated before any rendering code is written.

### 6.1 The manifest is law

`src/assets/manifest.ts` publishes the closed enums. The LLM prompt embeds this list. Zod validates against it. Nothing anywhere may reference an asset not in this file.

```ts
export const MODEL_IDS = [
  "f_business", "f_casual", "f_athletic",
  "m_business", "m_casual", "m_athletic",
] as const;

export const CLIP_IDS = [
  "idle", "idle_tense", "idle_seated",
  "talk_a", "talk_b", "listen",
  "walk_slow", "walk_fast",
  "sit_down", "stand_up",
  "turn_left", "turn_right",
  "gesture_point", "gesture_shrug",
] as const;

export const PROP_TYPES = [
  "dining_table", "desk", "chair", "stool", "sofa", "armchair",
  "bed", "counter", "shelf", "lamp", "tv", "plant", "door", "window",
] as const;

export const ROOM_PRESETS = ["kitchen", "office", "bar"] as const;

export const MODEL_PATH = (id: ModelId) => `/assets/characters/${id}.glb`;
export const PROP_PATH  = (t: PropType) => `/assets/props/${t}.glb`;
```

Six characters. Fourteen clips. Fourteen props. Three rooms. That is the entire asset universe. Resist expanding it — every addition costs conversion time and widens the LLM's failure surface.

### 6.2 Character pipeline (Mixamo → GLB)

1. On mixamo.com pick 6 characters matching the `MODEL_IDS` archetypes. Download each as **FBX for Unity (.fbx), T-pose, with skin**.
2. For each of the 14 animations: search Mixamo, apply to the *same* character, download **FBX, Without Skin, 30 fps, no keyframe reduction**.
3. In Blender: import the skinned character, then import each animation FBX, push each action down onto the NLA / rename the action to the exact `CLIP_ID` string. Delete the imported armature duplicates, keep the actions. **Merge all clips into a single GLB per character.**
4. Export glTF 2.0 with: `+Y Up`, `Include → Animations` on, `Sampling Rate 30`, `Always Sample Animations` **off**, `Optimize Animation Size` on.
5. Optimize:
   ```bash
   npx @gltf-transform/cli optimize in.glb out.glb \
     --compress draco --texture-size 1024 --simplify false
   ```
6. Budget: **≤ 3 MB per character.** If you're over, drop texture size to 512. Previs does not need skin pores.

**Naming rules that will bite you if ignored**
- Action names must be **exactly** the `CLIP_ID` string. Case-sensitive. The mixer looks them up by name.
- Character must face **+Z** in the bind pose.
- Origin at the **floor between the feet**, not the hips. Mixamo usually gets this right; verify in Blender before exporting all six.

### 6.3 Prop pipeline

Source CC0 models (Poly Pizza, Kenney, Quaternius). Per prop, in Blender:

1. Apply all transforms (`Ctrl+A → All Transforms`).
2. Set origin to **floor centre**: bottom of the bounding box, centred in X and Z.
3. Rotate so the "front" (the side a person sits at or faces) points **+Z**.
4. Scale to real-world metres. A dining table is 0.75 m tall. A chair seat is 0.45 m. A door is 2.0 m. Get these right — every blocking and framing calculation depends on it.
5. Export GLB, ≤ 300 KB each, single material where possible.

**Non-negotiable: pivot at floor centre, facing +Z.** If half your props are pivoted at the origin of the original file, every placement is wrong and you will not know why.

**Verify with a sanity scene:** place all 14 props in a row next to a 1.75 m capsule. If anything looks like doll furniture or giant furniture, fix it now, not at hour 25.

### 6.4 Room presets

Rooms are code, not models — a floor plane, four wall planes, and a ceiling, built from `set.dimensions`. This keeps them free and lets the LLM resize them.

Each preset in `src/render/rooms/` supplies wall/floor material colours, a default prop layout (used when the LLM emits an empty `props` array), and a lighting preset per `timeOfDay`.

| Preset | Default props | Feel |
|---|---|---|
| `kitchen` | counter, dining_table, 4× chair, shelf, window, lamp | warm, practical |
| `office` | desk ×2, chair ×3, shelf, tv, plant, window | cool, flat |
| `bar` | counter, 4× stool, table, 2× chair, lamp, tv | low key, saturated |

The **back wall is at −Z** in every preset, so a camera at +Z looking at the origin is the natural master shot. The LLM prompt states this; keep it true.

### 6.5 Emotion → clip mapping

`src/render/animationMap.ts`. **Deterministic lookup, not an LLM call** — free, instant, no extra latency or failure surface. It resolves a `BlockingCue` with no explicit `clip` into a legal `ClipId` from `action` + `posture` + the beat line's `emotion`:

```ts
// action wins; emotion only picks between variants of the same action
const EMOTION_TINT: Record<string, ClipId> = {
  angry: "idle_tense", tense: "idle_tense", afraid: "idle_tense",
  sad: "idle", neutral: "idle", warm: "idle", happy: "idle",
};

export function resolveClip(cue: BlockingCue, posture: Posture, emotion: string): ClipId {
  switch (cue.action) {
    case "walk":    return /urgen|angry|panic/.test(emotion) ? "walk_fast" : "walk_slow";
    case "turn":    return (cue.facing ?? 0) > 0 ? "turn_left" : "turn_right";
    case "sit":     return "sit_down";
    case "stand":   return "stand_up";
    case "gesture": return /point|accus|demand/.test(emotion) ? "gesture_point" : "gesture_shrug";
    case "idle":    return posture === "seated" ? "idle_seated"
                         : EMOTION_TINT[emotion.split(/[ ,]/)[0]] ?? "idle";
  }
}
```

The speaking character on a beat with a line plays `talk_a`/`talk_b` (alternating) over the top; everyone else plays `listen`. Unknown emotion strings fall through to `idle` — never throw, never return a clip that isn't in `CLIP_IDS`.

### 6.6 Loading rules

- `useGLTF.preload()` every character and prop at app boot. A 20 MB preload on venue wifi during the demo is a lost demo — preload happens while the judge is still reading the input box.
- Clone via `SkeletonUtils.clone()` for repeated characters, never a shallow clone, or two characters will share one skeleton and animate identically.
- One `AnimationMixer` per character instance, stored in a ref, updated in `useFrame`. Crossfade clips over 0.25 s.
- Missing asset → render a 1.75 m capsule in the character's colour and `console.warn`. Never throw.

### 6.7 Performance budget

Test this at M1, not at M7.

| | Target |
|---|---|
| Draw calls | < 120 |
| Triangles | < 400 k |
| Shadow maps | exactly 1, 1024×1024 |
| Post-processing | none |
| Desktop frame rate | 60 fps |
| VR frame rate | 72 fps — if you can't hit it, VR is cut |

If you're short: drop shadows to a blob decal under each character, and use `meshLambertMaterial` instead of `meshStandardMaterial` for walls and props.

---

## §7 The Claude calls

**Two calls on the critical path. A third exists only as a T1 pre-pass (§7.3), and a fourth only at T2 (§7.4). Do not add a fifth.**

| Call | Tier | Input | Output | Failure mode |
|---|---|---|---|---|
| `blockScene` | T0 | script text + room preset + manifest enums | `PrevisSpec` via tool use | invalid spec → repair pass → `coerceSpec` → template fallback |
| `rationale` | T0 | `Note[]` + minimal scene context | rewritten `message` strings | any failure → keep deterministic messages |
| `structureScript` | T1 | full script text | scene list with sluglines + tone | any failure → user pastes one scene by hand, as in T0 |
| `judgeBranch` | T2 | two transcripts | comparison scores | any failure → hide the panel |

**Model:** `claude-opus-5`. `max_tokens: 8000` for `blockScene`, `1000` for `rationale`. Leave `thinking` unset — it runs adaptive by default on Opus 5 — and do not pass `budget_tokens` (removed; it returns a 400). If you need to trade quality for latency during prompt iteration, add `output_config: { effort: "medium" }` rather than switching model; if you need to trade quality for cost, `claude-sonnet-5` is the drop-in.

### 7.1 Call 1 — `blockScene`

**Why tool use, not JSON-in-prose.** Force the shape with a tool schema generated from the Zod schema. Prose JSON gets markdown fences, preamble, and trailing commentary you then have to strip. Tool use gives you a typed object.

```ts
tools: [{
  name: "emit_previs_spec",
  description: "Emit the blocked scene as a PrevisSpec document.",
  input_schema: zodToJsonSchema(PrevisSpecZ),
  strict: true,
}],
tool_choice: { type: "tool", name: "emit_previs_spec" }
```

**System prompt**

> You are a first assistant director and a director of photography, blocking a scene for previsualization. You convert a page of screenplay into a precise 3D scene specification.
>
> **Coordinate system.** Metres, Y-up, right-handed. The room's floor centre is [0,0,0]. The back wall is at −Z. A camera at +Z looking toward the origin is the natural master shot. `rotationY` is in radians; 0 means facing +Z; increasing values rotate counter-clockwise seen from above. Character positions are the floor point under their feet, y is always 0.
>
> **Closed vocabularies.** You may only use these exact strings. Never invent a value.
> - modelId: {MODEL_IDS}
> - clip: {CLIP_IDS}
> - prop type: {PROP_TYPES}
> - room: {ROOM_PRESETS}
>
> **Blocking rules.**
> 1. Place characters 1.2–2.5 m apart. Never closer than 0.45 m. Never inside a prop or within 0.3 m of a wall.
> 2. Characters in conversation face each other: set each one's `rotationY` so their facing vector points at the other's position.
> 3. Seated characters must be at a chair or stool that exists in `set.props`, positioned at the chair's position, `posture: "seated"`.
> 4. Give the scene physical life. If a character is nervous, `walk` them. If someone is confronted, `turn` them. A scene where nobody moves for 12 beats is a failed blocking.
> 5. Keep the prop list under 14 and use only what the scene needs.
>
> **Camera rules.**
> 6. Always emit a wide master (24–35 mm) plus at least one coverage angle per speaking character.
> 7. **All cameras must sit on the same side of the line between the two principal characters.** Compute the axis between them and keep every camera on one side. This is the 180-degree rule and it is not optional.
> 8. Camera height 1.5–1.7 m unless the scene calls for a low or high angle, in which case say so in the camera label.
> 9. `lookAt` a character's head: their position plus 1.68 m in Y standing, 1.22 m seated.
> 10. Vary shot size. Open wide, tighten as the scene escalates, and never use the same size for more than two consecutive beats. Reserve the tightest shot for the emotional peak.
>
> **Beats.**
> 11. One beat per line of dialogue. Add action-only beats (line: null) where the script has stage direction or where a silence should land.
> 12. `duration` = word count / 150 words-per-minute × 60, minimum 1.2 s. `startTime` is cumulative with no gaps larger than 2 s.
> 13. `subjectId` is who the shot is *about*, which is often the listener, not the speaker. Use this deliberately.
> 14. `direction` on a character is one short performance note for the actor, in a director's voice. If the user names a reference actor, write the note in the register that actor is known for. Do not describe their face or appearance.
>
> Emit the spec with `emit_previs_spec`. Do not write anything else.

**User message**

```
ROOM: {room preset the user picked, or "choose the best fit"}
REFERENCE CASTING (optional, performance direction only): {actor names}
TARGET TONE (optional): {toneTarget}

SCRIPT:
{raw pasted text}
```

**Handling the response**

```ts
const block = data.content.find(b => b.type === "tool_use" && b.name === "emit_previs_spec");
const parsed = PrevisSpecZ.safeParse(block.input);
if (!parsed.success) {
  // ONE repair pass, then stop
  const repaired = await repairCall(block.input, parsed.error.issues);
  ...
}
```

Always `JSON.parse` tool inputs rather than string-matching the serialized form — escaping varies between models.

**Repair pass.** Send the previous assistant turn back plus:

> The spec failed validation with these errors: {zod issues, one per line}. Emit a corrected spec with `emit_previs_spec`. Change only what the errors require.

One pass. If it fails again, run `coerceSpec` (§3.11) and ship whatever survives. If *that* throws, use `src/ai/fallback.ts`: characters in a circle facing the centre, default 4-camera rig, one beat per detected line via a regex on `^[A-Z ]{2,}$` speaker headers.

**Latency.** Expect 12–25 s. This is fine — but stream nothing and show a real progress narrative: *"Reading the scene → Placing the cast → Setting the cameras → Checking the grammar."* Fake progress that matches the real stages is honest enough and turns dead time into anticipation. Cache by `hash(script + room)` in `localStorage` so a re-run during the demo is instant.

### 7.2 Call 2 — `rationale`

Runs after the analyzer. Keeps the notes credible-sounding without letting the model invent problems.

**System prompt**

> You are a seasoned director of photography giving notes to a colleague. You will receive a list of technical issues already detected in a blocked scene, with the geometry that produced them. Rewrite each one as a single sentence a director would actually say out loud: plain, specific, about what the audience will experience, never about maths. Do not add issues. Do not remove issues. Do not soften an error into a suggestion. Return only a JSON array of `{id, message}` with one entry per input note, no markdown fences and no other text.

**User message**

```json
{
  "cast": [{"id":"ch_maya","name":"MAYA"}],
  "notes": [
    {"id":"n1","code":"LINE_CROSS","beats":["b_007","b_008"],
     "characters":["ch_maya","ch_ravi"],
     "detail":"cam_b is at side +1.8 of the MAYA→RAVI axis; cam_c is at side -2.1"}
  ]
}
```

**Guardrails**

- Parse with Zod: `z.array(z.object({ id: z.string(), message: z.string().max(220) }))`.
- Any id not in the input list is dropped. Any input id missing from the output keeps its deterministic message.
- **The model can never create, delete, or reclassify a note.** Severity, codes, beat ids, and suggested fixes come from geometry only. This is the guarantee that makes the feature defensible when a judge asks "how do you know it's not hallucinating?"

### 7.3 Call 3 (T1) — `structureScript`

The entry point widens from "paste a page" to "upload a script". This is a **pre-pass that selects work for `blockScene`** — it does not replace it, and the spec stays single-scene (§2 keeps multi-scene state cut).

- **Input:** raw uploaded script text. If long, pre-split before sending: regex on screenplay sluglines (`^(INT|EXT)\.`) if present, otherwise a blank-line paragraph heuristic. One call per chunk keeps each call small and the structure reliable.
- **Output**, one structured-output call per chunk, Zod-validated:
  ```ts
  z.object({ scenes: z.array(z.object({
    slugline: z.string(),
    room: z.enum(ROOM_PRESETS),
    toneTarget: z.string(),
    characterNames: z.array(z.string()),
    text: z.string(),          // the verbatim scene text, handed to blockScene later
  })) })
  ```
- **Character carry-over:** dedupe names across chunks, and let the same call draft a one-line `direction` per character from that character's actual lines. Surface these as **editable defaults** before blocking — do not trust them blindly and do not block the demo on them being perfect.
- **UI:** `SceneTree.tsx` lists the scenes; clicking one calls `blockScene` on its `text`. Nothing else about the pipeline changes.
- **Failure:** any parse failure falls back to the T0 path — the paste box, one scene, by hand. Never let a bad structuring pass corrupt a good block.

Keep this prompt and schema **completely independent** of `blockScene`'s. They fail differently and you want to debug them separately.

### 7.4 Call 4 (T2) — `judgeBranch`

Only after §11's M7 is done and rehearsed. Re-run `blockScene` on the same scene text with one dramatic premise overridden ("she forgives him"), then show the two blocked scenes side by side with the analyzer run on both — *the comparison that matters is the geometry diff: coverage, sizes, line crossings.* A second call can add scores (arc coherence, tension curve, chemistry, fragility, engagement) as a JSON object.

**Warning, and this is the reason it is T2 and not T1.** Your entire defence against "isn't this just an LLM wrapper?" is that every note comes from geometry (§15). An LLM scoring panel is exactly the plausible mush that defence is aimed at. If you build it: label it visibly as an AI read, keep it in a separate panel from `NotesPanel`, and never let a judge score change a `Note`. Geometry and opinion do not share a surface.

### 7.5 Client-side API notes

- Call `https://api.anthropic.com/v1/messages` directly. There is no backend.
- The key lives in `import.meta.env.VITE_ANTHROPIC_API_KEY` and `.env.local` is gitignored. It is exposed in the client — acceptable for a hackathon demo, and **say so plainly in the README** rather than hoping nobody notices. Rotate it after the event.
- Set `anthropic-dangerous-direct-browser-access: true` in the headers.
- Wrap every call in a 45-second timeout. On timeout, take the fallback path — never leave a spinner running while a judge watches.
- Log every request/response pair to `localStorage` under `dreamframe:log:*`. When the demo misbehaves you will want the last successful spec, and you will not have time to reproduce it.

### 7.6 Prompt iteration budget

**Three hours, hard cap** (hours 6–9 of the build). Prompt work is infinitely absorbing and has sharply diminishing returns. When the cap hits, whatever the success rate is, you ship `coerceSpec` to cover the gap and move on. Measure it honestly: run 10 varied script pages, count how many produce a spec that renders with zero manual edits. **7/10 is a pass.** Stop there.

---

## §8 Voice (T1)

Adds the one thing the 3D view can't do on its own: the scene *sounds* like a scene. It is T1 because the demo lands without it and a rate limit mid-pitch is a silent failure with a judge watching.

- **Per-character voice.** `Character.voiceId` is assigned round-robin from a small hand-picked list of ElevenLabs voice ids at block time. No voice cloning, no likeness of a real performer.
- **`src/voice/tts.ts`**: `speak(beat)` → checks an IndexedDB/`localStorage` cache keyed by `hash(voiceId + text)`, and only calls the API on a miss. Audio is stored as a blob URL.
- **Delivery from `line.emotion`** — pass it through as style/stability parameters. Same field that drives §6.5, so voice and body language agree without extra bookkeeping.
- **Sync to the playhead, not to the audio.** The timeline is the clock. `startTime` fires playback; if the audio is longer than `duration`, let it run over the cut — that reads as natural overlap. Never let audio drive the playhead, or one slow fetch desyncs the whole scene.
- **Pre-generate the demo scene's audio the night before** and never clear that cache. On stage you are playing files, not making requests. Live generation is a stretch flourish on a short second scene, after the main demo has landed.
- **The API key is client-side**, same caveat as §7.5. Timeout 10 s; on failure the beat plays silently with its caption — the demo continues.

---

## §9 The analyzer

This is the differentiator. Anyone can ask an LLM "is this scene good?" and get plausible mush. These checks are **geometry**, computed from the spec, correct by construction, and would work with the LLM switched off.

Two stages:
- **Stage 1 (this section):** pure functions produce `Note[]` with a deterministic `message`.
- **Stage 2 (§7.2):** one Claude call rewrites `message` in director's language. If that call fails, the deterministic message ships as-is and nothing breaks.

### 9.1 Shared helpers (`src/analyze/geom.ts`)

```ts
const HEAD_Y   = { standing: 1.68, seated: 1.22 };
const SENSOR_H = 24; // mm, full frame

export const vFov = (lens_mm: number) => 2 * Math.atan(SENSOR_H / (2 * lens_mm)); // radians

/** Signed side of the A→B axis that point P falls on, in the XZ plane. */
export function sideOfAxis(a: Vec3, b: Vec3, p: Vec3): number {
  const ax = b[0] - a[0], az = b[2] - a[2];
  const px = p[0] - a[0], pz = p[2] - a[2];
  return ax * pz - az * px;   // sign = side, magnitude ∝ distance from axis
}

/** Head world position of a character at a given beat. */
export function headPos(spec, charId, beatIdx): Vec3

/** Project a world point to normalized device coords for a given camera. */
export function toNDC(cam: Camera, world: Vec3): { x: number; y: number; z: number }

/** Facing unit vector from rotationY. */
export const facing = (rotY: number): Vec3 => [Math.sin(rotY), 0, Math.cos(rotY)];
```

`toNDC` builds a `THREE.PerspectiveCamera` with `vFov(lens_mm)` and aspect **16/9**, positions it, `lookAt`s, `updateMatrixWorld()`, then `world.project(cam)`. Aspect is fixed at 16:9 regardless of the viewport — framing notes must not change when someone resizes the window.

### 9.2 The checks

Each is `src/analyze/checks/<name>.ts` exporting `(spec: PrevisSpec) => Note[]`.

**1. `LINE_CROSS` — crossing the axis · severity `error`**

The 180-degree rule. The single most recognisable mistake in film grammar and the note that will land hardest with judges.

```
for each consecutive beat pair (i, i+1):
  A = subject of beat i, B = the other character nearest A's gaze (or the other speaker)
  if the pair {A,B} is the same across both beats:
    s1 = sideOfAxis(A.pos, B.pos, cam[i].position)
    s2 = sideOfAxis(A.pos, B.pos, cam[i+1].position)
    if sign(s1) !== sign(s2) and |s1| > 0.15 and |s2| > 0.15:
      → note
```

Message: `Shots {i}→{i+1} cross the line of action between {A} and {B}. On the cut, {A} appears to jump to the other side of frame.`

`suggestedFix`: mirror the offending camera across the axis. Reflect `position` in the line A→B, keep `lookAt` and `lens_mm`.

The epsilon (0.15) exists because a camera almost *on* the axis isn't a crossing, it's a neutral shot.

**2. `SIZE_MONOTONY` — no escalation · severity `warning`**

Recompute the true shot size — never trust `shot.shotSize`:

```ts
const d = distance(cam.position, headPos(subject));
const framedHeight = 2 * d * Math.tan(vFov(cam.lens_mm) / 2);
```

| framedHeight (m) | size |
|---|---|
| < 0.35 | ECU |
| 0.35 – 0.60 | CU |
| 0.60 – 1.00 | MCU |
| 1.00 – 1.60 | MS |
| 1.60 – 2.40 | MWS |
| > 2.40 | WS |

Flag any run of ≥ 3 consecutive beats with identical computed size.

Message: `Beats {a}–{b} are all {SIZE}. The scene flattens — the audience gets no sense that anything is escalating.`
`suggestedFix`: tighten the middle shot of the run by one size (move the camera in, keeping the same angle).

Also emit `info` when the LLM's stated `shot.shotSize` disagrees with the computed size by two or more steps — that's a generator bug worth seeing during development.

**3. `HEADROOM` · severity `warning`**

```
ndc = toNDC(cam, headPos(subject))
topMargin = (1 - ndc.y) / 2        // fraction of frame height above the head
flag if topMargin < 0.04  → "cramped"
flag if topMargin > 0.12  → "dead space above the head"
flag if |ndc.x| > 1 or |ndc.y| > 1 → subject is out of frame entirely (severity: error)
```

**4. `NOSE_ROOM` · severity `warning`**

```
f      = facing(subject.rotationY)
ahead  = headPos + f * 1.0
dx     = toNDC(cam, ahead).x - toNDC(cam, headPos).x
lead   = dx > 0 ? (1 - ndc.x) / 2 : (1 + ndc.x) / 2
flag if lead < 0.50
```

Message: `{NAME} is looking frame-{left|right} but is framed {centred|against that edge}. Give them room to look into.`
`suggestedFix`: shift camera `position` laterally so the subject sits at ndc.x ≈ ∓0.3.

**5. `OCCLUSION` · severity `error`**

Raycast `cam.position → headPos(subject)` against prop AABBs (each prop's bounding box from the loaded GLB, cached at boot). Exclude the subject. Any hit → note.

Message: `The {prop} blocks {NAME}'s face on beat {i}.`
`suggestedFix`: raise camera to 1.75 m, or offset 0.5 m perpendicular to the sightline — whichever clears the box.

**6. `EYELINE` · severity `warning`**

For a shot/reverse pair (beat i subject A, beat i+1 subject B, both cameras looking at the other):

```
αA = angleXZ(A→B, A→camA.position)
αB = angleXZ(B→A, B→camB.position)
flag if |αA - αB| > 25°
```

Message: `The reverse on {B} doesn't match {A}'s eyeline — cut together, they won't look like they're looking at each other.`

**7. `COVERAGE_GAP` · severity `error`**

Any character with ≥ 2 lines who is never `shot.subjectId` in any beat.

Message: `{NAME} speaks {n} lines and is never the subject of a shot. There's no coverage to cut to.`
`suggestedFix`: add a CU camera on them at their longest line.

**8. `TALK_SCREEN_SKEW` — the dialogue-density note · severity `info`**

```
talkShare   = words spoken by C / total words
screenShare = beats where subjectId == C / total beats
flag if |talkShare - screenShare| > 0.25
```

Message: `{NAME} carries {talkShare}% of the dialogue but only {screenShare}% of the shots.`

**9. `CAMERA_IN_GEOMETRY` · severity `error`**

Camera position outside room bounds, or inside a prop AABB inflated by 0.2 m, or below y = 0.3, or above `set.dimensions.h - 0.2`.

Message: `{cam.label} is {inside the {prop} | outside the room | below floor level}.`

### 9.3 Ordering and display

Sort notes by `severity` (error → warning → info), then by first `beatId`. Cap the panel at 8 notes — a wall of 30 notes reads as noise and makes the tool look unreliable. If there are more, show "and N more" collapsed.

**Clicking a note** must: jump the playhead to `beatIds[0]`, switch the viewport to `shot.cameraId`, and highlight the involved characters. That interaction is half the demo.

### 9.4 Dialogue density panel

`src/analyze/density.ts` — display-only analytics, no notes:

- words per character, as a bar
- turn-taking: longest run of consecutive lines by one character
- estimated runtime at 150 wpm vs sum of beat durations
- longest single uninterrupted block in seconds — **flag > 25 s** with "needs a cutaway or a move"
- silence ratio: action-only beats / total beats

### 9.5 Testing

`src/analyze/checks/__tests__/` — one vitest per check, run against `office_threehander.json`:

| Check | Expected on the office fixture |
|---|---|
| `LINE_CROSS` | exactly 1 note, beats `b_007`→`b_008` |
| `SIZE_MONOTONY` | exactly 1 note, beats `b_003`–`b_006` |
| `COVERAGE_GAP` | exactly 1 note, character `ch_sam` |
| all others | 0 notes |

And against `kitchen_twohander.json`: **zero notes of any kind**. A clean scene producing notes is worse than a broken scene producing none — false positives destroy trust in the feature instantly, on stage, in front of someone who knows film grammar.

---

## §10 Hard rules

1. **The schema is the contract.** `src/schema/previsSpec.ts` is the single source of truth. Changing it requires updating §3 and **both** fixtures in the same change. Never change it as a side effect of fixing something else.
2. **Never invent an asset id.** `modelId`, `clip`, `props[].type` are closed enums imported from `src/assets/manifest.ts`. If you need one that doesn't exist, say so — do not add it silently.
3. **Units: metres, Y-up, right-handed. Rotations in radians.** Matches Three.js. No degrees anywhere except in UI display strings.
4. **The renderer must never crash on a partial spec.** Every optional field has a default. Missing prop → skip it and warn to console. Missing character model → capsule placeholder. A blank screen during the demo is the worst possible outcome.
5. **Every LLM response goes through Zod.** parse → on failure send errors back for exactly one repair pass → on second failure `coerceSpec` → then the template fallback in `src/ai/fallback.ts`. Never surface a raw parse error to the user.
6. **Checks in `src/analyze/checks/` are pure functions** of `(spec) => Note[]`. No React, no three.js imports at module scope, no async. Build a throwaway `PerspectiveCamera` only inside `toNDC`. Each check ships with a vitest case using a deliberately broken fixture.
7. **The LLM may never create, delete, or reclassify a note.** It rewrites wording only (§7.2). This is the product's central claim — treat it as an invariant, not a preference.
8. **One milestone at a time.** Do not scaffold ahead. Do not build M4 files while on M2. Stop at the milestone boundary and report.
9. **Stay inside the milestone's owned paths** (§11). Four people are working in this repo simultaneously; touching another workstream's files causes merge conflicts that cost more than the feature.
10. **No abstraction until the third occurrence.** A hackathon repo with a plugin architecture is a failed hackathon repo. This code lives 36 hours.

### Conventions

- Functional components, named exports, no default exports except route-level.
- `.tsx` only where JSX exists.
- State lives in `src/store/useScene.ts`. Component-local state only for UI-ephemeral things (open/closed, hover).
- No `any`. Use `unknown` plus a Zod parse at boundaries.
- Comments explain *why*, never *what*. Zero docstring blocks on obvious functions.

### Commands

```bash
npm run dev        # Vite dev server
npm run typecheck  # tsc --noEmit  — must pass before any milestone is "done"
npm run test       # vitest run    — analyzer checks only
npm run build      # production build — run once at M7, not before
```

### Definition of done for any task

- `npm run typecheck` clean
- The relevant fixture still renders
- No new console errors
- You have stated in one sentence what a reviewer should click to verify it

### After hour 30

Feature freeze. Bugfix, console cleanup, and demo reliability only. If asked for a new feature after freeze, say no and explain the risk.

---

## §11 Milestones

36-hour clock. One milestone at a time. Stop at each boundary and verify the acceptance test before moving on.

| # | Window | Owner | Owned paths |
|---|---|---|---|
| M0 | h0–2 | all | `src/schema/`, `src/assets/`, `src/fixtures/` |
| M1 | h2–8 | A | `src/render/`, `public/assets/` |
| M2 | h6–12 | B | `src/ai/` |
| M3 | h10–16 | A | `src/render/CameraRig.tsx`, `src/ui/Timeline.tsx` |
| M4 | h14–20 | C | `src/analyze/` |
| M5 | h20–26 | C + B | `src/ui/` |
| M6 | h26–30 | A + D | `src/render/XRSession.tsx`, `src/voice/`, `src/ai/structureScript.ts` |
| M7 | h30–34 | D | everything, bugfix only |

**Do not touch paths you don't own.** Four people, one repo, no time for merge archaeology.

### M0 — Contract and scaffold · h0–2

Build: Vite scaffold, `previsSpec.ts` (Zod + types), `manifest.ts`, `repair.ts` stub, both fixtures hand-written, `<Stage>` rendering the kitchen fixture with placeholder primitives (room box from `set.dimensions`, boxes for props, 1.75 m capsules for characters on their marks facing their `rotationY`, three-point lighting, OrbitControls). No GLB loading.

**Acceptance:** `npm run dev` shows a lit room with box props and capsule characters standing on their marks. `npm run typecheck` clean. Both fixtures parse.

**Gate:** if this isn't done by hour 2, cut M6 now rather than at hour 20.

### M1 — Renderer · h2–8

Build: real GLB loading for the 6 characters and 14 props, `AnimationMixer` per character, playhead-driven blocking (walk lerps position, turn slerps rotation, clips crossfade over 0.25 s), `animationMap.ts`, room presets, lighting presets, OrbitControls.

**Acceptance:** scrub the kitchen fixture timeline end to end — characters walk to their marks, sit, gesture, and the room reads as a room. 60 fps.

**Prompt:**
> M1 only. Read §6. Implement `src/render/Character.tsx` and `src/render/Prop.tsx` to load real GLBs from the manifest, plus a blocking driver that takes `(spec, timeSeconds)` and produces each character's position, rotation, and active clip. Walk is a linear lerp across the beat's duration; turn is a shortest-path slerp; clips crossfade 0.25 s and are resolved through `animationMap.ts`. Missing assets render a capsule and warn. Do not touch `src/ai/` or `src/analyze/`.

### M2 — Script → spec · h6–12

Build: `blockScene()`, tool-use call, Zod validation, one repair pass, `coerceSpec`, template fallback, `localStorage` cache, `ScriptInput` UI with the staged progress narrative.

**Acceptance:** paste 5 script pages you've never tested. At least 4 produce a spec that renders with zero manual edits. Cached re-runs are instant.

**Prompt:**
> M2 only. Read §7 and §3. Implement `src/ai/blockScene.ts`: build the tool schema from `PrevisSpecZ` with zod-to-json-schema, call the Anthropic messages API from the browser with model `claude-opus-5`, validate, run exactly one repair pass on failure, then `coerceSpec`, then the template fallback. Cache by hash of script+room in localStorage. 45 s timeout. Do not touch `src/render/` or `src/analyze/`.

### M3 — Cameras and playback · h10–16

Build: `lens_mm` → FOV camera rig, viewport switching per beat, auto-cut playback, manual orbit/fly override with a "back to shot camera" button, camera preset buttons (wide / OTS A / OTS B / CU) that write into the spec, timeline with beat markers and caption display.

**Acceptance:** press play on the office fixture and watch the whole scene cut itself, with captions, without touching anything.

### M4 — The analyzer · h14–20

Build: `geom.ts`, all 9 checks, the rationale call, `NotesPanel`, click-to-jump.

**Acceptance:** the office fixture produces exactly the 3 expected notes from §9.5; the kitchen fixture produces zero. Clicking a note jumps the playhead and switches camera. Vitest green.

**Prompt:**
> M4 only. Read §9 in full. Implement `src/analyze/geom.ts` and the nine checks as pure `(spec) => Note[]` functions, one file each, with a vitest per check asserting the expected counts against both fixtures. No React or three.js imports inside `checks/` — use plain math, and build a throwaway PerspectiveCamera only inside `toNDC`. Do not touch `src/render/` or `src/ai/`.

**This is the hour-20 gate.** If M4 isn't passing, cancel M6 and spend those hours here. Notes beat VR with judges — VR is a wow, notes are the product.

### M5 — Fix loop and panels · h20–26

Build: apply-fix buttons that mutate the camera and re-run the analyzer, dialogue density panel, shot list table with per-shot thumbnail (`gl.domElement.toDataURL()` after moving the camera), cast panel showing `direction` notes.

**Acceptance:** click a fix on the office fixture → camera moves → note clears on re-analyze. Shot list renders a thumbnail per beat.

### M6 — T1 features · h26–30 · ALL CUTTABLE

Three independent items, in priority order. Ship whichever fit; each is independently cuttable and none may touch T0 paths.

1. **Voice (D)** — `src/voice/tts.ts` per §8, wired to the playhead, demo audio pre-generated and cached. *Highest demo value per hour.*
2. **Script upload (D or B)** — `structureScript.ts` + `SceneTree.tsx` per §7.3. Falls back to the paste box on any failure.
3. **VR (A)** — `@react-three/xr` session, VR button, teleport locomotion, controller ray, "stand at camera" markers you can teleport onto.

**Acceptance (VR):** headset on, walk the set, stand at `cam_b`'s position and see roughly what it sees. 72 fps. **Tested on the venue's wifi, twice.**

**Fallback if VR is cut or the headset dies:** first-person WASD walkthrough at 1.6 m eye height. It reads the same in the pitch and costs 40 minutes.

### M7 — Freeze and rehearse · h30–34

- Seed the demo scene and pre-cache its spec **and its audio** so it loads offline.
- README with the honest note about the client-side API keys.
- Canvas capture export (30 min, skip if anything is broken).
- Remove every console.log that isn't a warning.
- **Rehearse the demo three times.** Two different people must be able to run it cold.
- Commit, tag, and stop.

**Hour 34: hands off the keyboard.** Every hackathon loses a project to a 3am "quick fix." Don't be that team.

---

## §12 Workstream split

- **A — Renderer.** M0 assets, M1, M3 camera rig, M6 XR. Owns `render/` and `public/assets/`.
- **B — AI pipeline.** M2 `blockScene`, prompt iteration, Zod repair loop, M4 rationale call. Owns `ai/`.
- **C — Analyzer + UI.** M4 checks, M5 panels, timeline, shot list. Owns `analyze/` and `ui/`.
- **D — Product, demo, voice.** Writes both fixtures in hour one (this unblocks A and C before B exists), picks the demo script, builds the pitch, times the run, handles the export, tests on venue wifi, owns `voice/` at M6.

All four sync in the first 30 minutes to lock §3 and the call signatures in §7, then work in parallel against fixtures until real integration at hours 10–14.

**If you are three people:** D's fixture job moves to hour zero for everyone, and D's role merges into C. Voice is cut.
**If you are two people:** cut M5 and M6 from the plan now and split A / B+C.

---

## §13 Risks and pre-decided fallbacks

| Risk | Probability | Fallback (decide now, not at 3am) |
|---|---|---|
| **LLM emits an invalid spec** | High | Zod parse → one repair pass → `coerceSpec` → template spec with characters on a circle. Never show a crash. |
| **Assets not ready by hour 8** | High | This is the classic killer. It is why §6 is hour one and why M0 ships capsule placeholders that never get removed from the code path. The whole app must stay demoable with zero GLBs loaded. |
| **Team burns hours on set layout** | Medium | 3 preset rooms, built in code. The LLM picks one and places props in it. It does not design architecture. |
| **Mixamo retarget breaks on a model** | Medium | Ship 6 characters, only 3 need to be perfect. Drop the broken one from the enum. |
| **WebXR fails on venue wifi / no headset** | Medium | "VR mode" becomes a first-person WASD walkthrough at eye height. Still reads as the feature in the pitch. And it is T1 — it was never load-bearing. |
| **Spec generation too slow (>30 s)** | Medium | Pre-generate the demo scene and cache it. Live-generate a *short* 6-line scene on stage as the second beat, after the main demo has landed. |
| **Perf tanks with 6 characters + shadows** | Medium | Shadow map 1024, single shadow-casting light, no post-processing. Test at M1, not hour 32. |
| **ElevenLabs latency or rate limit on stage** | Medium | Pre-generate the demo audio; on stage you are playing cached files. On any failure the beat plays silently with its caption. |
| **Script parsing mis-segments a real script** | Medium | Real scripts vary wildly in format. Keep the hand-seeded demo scene as the guaranteed path, and rehearse the upload moment with the **actual file** you will upload — not a different one. |
| **Four people blocking on each other** | Medium | Lock §3 and §7's signatures in hour 0; everyone builds against fixtures until hour 10. Own your paths (§11). |
| **API rate limit / quota during the demo** | Low–Medium | Cache every response to `localStorage` keyed by script hash. The demo scene must run fully offline. |
| **Scope creep into T2** | Medium | §2 is written down. Re-reading it is free; re-deciding it at hour 28 is not. |

---

## §14 Export

Thirty minutes of work, T1.

- **Shot list**: table of beat → shot size → lens → camera position → subject, plus a thumbnail rendered by moving the camera and calling `gl.domElement.toDataURL()`. Compose into a contact sheet canvas, download as PNG.
- **Video**: `canvas.captureStream(30)` + `MediaRecorder` → webm. This is the entirety of the "video generation" requirement, and it is honest — it is a previs animatic, which is what directors actually use.

---

## §15 Pitch, judge questions, and stage reliability

### The pitch, compressed

**Problem.** Previsualization is standard practice on big productions and inaccessible to everyone else — existing tools need a 3D artist and a week per scene. Meanwhile a wasted shoot day costs more than most short films.

**What we built.** Paste a script page, get a blocked 3D scene with camera coverage, in the browser, in thirty seconds — plus automated cinematography notes grounded in film grammar.

**Why it's not an LLM wrapper.** The model does one job: turning prose into a structured scene graph. Every note comes from geometry computed on that graph — the 180-degree rule, framing, eyelines, occlusion, coverage. Turn the model off and the analyzer still works.

**What's next.** Import real location scans, export to Shot Lister / StudioBinder format, and a director's version-comparison view.

**Three minutes, allocated:** 20 s problem · 20 s claim · 100 s demo (§1 exactly, do not improvise) · 20 s tech · 20 s next.

### Judge questions, pre-answered

**"Isn't this just an LLM wrapper?"**
The LLM does exactly one thing: script prose → structured scene graph. Everything a director actually gets — the line-crossing detection, the framing checks, the coverage gaps — is computed geometrically from that graph. We can demo the analyzer on a hand-written scene with the model switched off entirely.

**"How do you know the notes aren't hallucinated?"**
They can't be. The model is never allowed to create, delete, or reclassify a note. It only rewrites the wording of notes that geometry already produced.

**"Previs software already exists."**
It does — FrameForge, Cine Tracer, Blender pipelines. All of them need a trained operator and hours per scene, and none of them critique your coverage. Our claim is narrower and true: script text to blocked, critiqued scene, in a browser, in thirty seconds.

**"What about quality? This doesn't look like a film."**
Previs isn't supposed to. It's a spatial and grammatical tool — marks, lenses, eyelines, coverage. Professional previs looks like grey mannequins in grey rooms. Fidelity is the wrong axis.

**"Would a real director use this?"**
Today: for planning coverage and catching grammar errors before a shoot day, and for pitching a scene to a producer. Not for the final look. We'd validate that with three working ADs before building further.

**"How does it scale to a whole film?"**
Scene by scene — it's already the unit, and the upload path already segments a full script into scenes. The multi-scene view is the obvious next build, along with continuity checks across scenes, which use the same geometric machinery.

### Reliability rules

1. **Pre-cache the demo scene.** Run it the night before, let it write to `localStorage`, and never clear it. The "live" generation on stage is the *cached* one and returns in under a second. If you want to show live generation, do it with a short 6-line scene as a second beat.
2. **The demo script is the office three-hander**, chosen because it reliably trips `LINE_CROSS` and `COVERAGE_GAP`. A scene with no notes is a demo with no second act.
3. **Have `office_threehander.json` loadable from a URL param** (`?fixture=office`). If the LLM call dies on stage, you are one keystroke from a working demo and nobody knows anything went wrong.
4. **Venue wifi is hostile.** Test the full flow on it, twice, including the VR session. If it's bad, run entirely off the cache and say "I've pre-loaded this one for speed" — which is true.
5. **Laptop on mains, notifications off, second browser profile with no extensions.** Extensions inject into the page and break WebGL contexts more often than you'd think.

### What to have open before you walk up

- Tab 1: the app, demo scene pre-cached, already warm
- Tab 2: `?fixture=office` as the panic button
- Tab 3: the shot list export, pre-generated
- Headset: charged, paired, already in the browser, screen mirrored
- Slide 1 on a second display, not your laptop

### What you cannot fix on stage

Nothing. There is no debugging on stage. If it breaks, you switch to tab 2 and keep talking. Rehearse that transition once so it looks deliberate.

---

## §16 Kickoff prompts for Claude Code

### Setup, before any prompt

```bash
mkdir dreamframe && cd dreamframe && git init
# copy this file to the repo root as plan.md
claude
```

`/init` is **not** needed — this file is already better than a generated one. Enter plan mode (`Shift+Tab` twice) and paste the M0 prompt.

### The M0 prompt (plan mode)

> You are the lead engineer on DreamFrame, a browser previsualization tool for film directors. We have 36 hours and four people. Script text goes in, a blocked 3D scene comes out, and a geometric analyzer produces cinematography notes.
>
> **Read these sections of `plan.md` before proposing anything, in this order:** §0, §4, §10, §3, §6, §11. Skim §1 and §2 for context. **Do not read §7, §8, or §9 yet** — they belong to later milestones and will pull your scope.
>
> **Scope: M0 only.** Four deliverables, nothing else:
>
> 1. `src/assets/manifest.ts` — the closed enums and path helpers exactly as specified in §6.1, with `as const` arrays and derived union types.
> 2. `src/schema/previsSpec.ts` — Zod schemas and inferred TypeScript types matching §3 exactly. Every optional field carries its documented default. Enums reference the manifest, never string literals. Export `PrevisSpecZ`, `PrevisSpec`, and the individual sub-schemas.
> 3. `src/schema/repair.ts` — `coerceSpec(raw: unknown)` implementing the five repair steps in §3.11, returning `{ spec, warnings }`. Levenshtein snapping for out-of-enum strings, numeric clamping, orphan-reference dropping, default camera rig injection, missing-shot backfill.
> 4. `src/fixtures/kitchen_twohander.json` and `src/fixtures/office_threehander.json`, hand-authored, both validating against the schema. The office fixture must contain the three deliberate flaws listed in §3.12 — a line crossing between beats 7 and 8, four consecutive medium shots, and a character with 9 lines who is never a shot subject. Compute the camera positions so those flaws are geometrically real, not just labelled.
>
> Plus a Vite + React + TypeScript + Tailwind scaffold whose default route renders `src/render/Stage.tsx`: the kitchen fixture drawn with **placeholder primitives only** — a room box from `set.dimensions`, boxes for props, 1.75 m capsules for characters on their marks facing their `rotationY`, and the three-point lighting preset. OrbitControls. No GLB loading.
>
> **Constraints.**
> - Pinned stack from §4. No other dependencies without asking.
> - Metres, Y-up, right-handed, radians.
> - `Stage.tsx` must render a spec with only required fields present, and must never throw. Missing or unknown assets → placeholder plus `console.warn`.
> - Do not scaffold `src/ai/`, `src/analyze/`, `src/voice/`, `src/ui/` beyond a single root layout, or any milestone past M0.
> - No abstractions, no config layers, no plugin patterns. This code lives 36 hours.
>
> **Output.** Show me the file tree and a per-file summary of what each will contain, then stop. I will approve before you write anything. Flag any place where §3 is ambiguous or internally inconsistent rather than guessing — that section is the contract four people are about to build against, and an ambiguity found now costs minutes instead of hours.

### Why this prompt is shaped this way

- **Read-order is explicit, and three sections are withheld.** Given the whole file, Claude will design toward the analyzer and the AI pipeline and over-build M0. Withholding is the scope control.
- **"Scope: M0 only" plus an explicit do-not-scaffold list.** Positive scoping alone never holds; the negative list does.
- **Deliverables are numbered with file paths.** Ambiguity about *where* code goes is the main source of merge conflicts when three other people start an hour later.
- **"Compute the camera positions so those flaws are geometrically real."** Without this, the fixture gets flaws in name only and every analyzer test at M4 passes against nothing.
- **"Stop and show me the tree."** Plan mode's value is the cheap disagreement. Take it.
- **"Flag ambiguities rather than guessing."** §3 is the single point of failure. You want its contradictions surfaced at hour one, by the thing that has to implement it.

### Follow-up prompts

Run each in plan mode, approve, then build. The per-milestone prompts in §11 are the short forms; these are the framings around them.

**Starting any milestone:**
> Read §11 and the sections listed for {M#}. Scope is {M#} only, owned paths only. Show me the plan and the acceptance test you'll run, then stop.

**Finishing any milestone:**
> Run `npm run typecheck` and `npm run test`. Then state in one sentence what I should click to verify {M#} is done, and list anything you built that is outside {M#}'s scope so I can decide whether to revert it.

**When something breaks at 3am:**
> Do not refactor. Find the smallest change that makes {symptom} stop, apply it, and tell me what you traded away. We freeze in {n} hours.

**At hour 30:**
> Feature freeze. From now on: bugfixes, console cleanup, and demo reliability only. If I ask for a feature, remind me of this instruction before doing it.

### Optional: slash commands

Drop these in `.claude/commands/` if you want them. Marginal, but the gate one earns its keep.

`.claude/commands/gate.md`:
```markdown
Check the current state against §11 of plan.md. Tell me: which milestone we are actually on (not which one we think we're on), what its acceptance test is, whether it passes, and — given $ARGUMENTS hours remain — what to cut. Be blunt about it.
```

`.claude/commands/scope.md`:
```markdown
Review the last change. List anything in it that is outside the current milestone's owned paths or that builds toward a milestone we have not started. Recommend what to revert.
```

---

## §17 The first 90 minutes, in order

1. Everyone reads §0–§3 and §10. (15 min)
2. Argue the cut list in §2 and commit to it. Written down, no reopening. (10 min)
3. D writes fixture one by hand in a text editor while A starts the Mixamo downloads. (30 min)
4. B creates the repo, scaffolds Vite, writes the Zod schema from §3. (30 min)
5. Everyone pulls, fixture validates, empty room renders. (10 min)

If step 5 has not happened by hour two, you are behind — cut M6 immediately rather than at hour 20.

---

## Appendix — how this document was merged

This file consolidates ten source documents: nine from the PreVis doc set (`PLAN`, `CLAUDE`, `SCHEMA`, `ASSETS`, `AI_PROMPTS`, `CINEMATOGRAPHY`, `MILESTONES`, `DEMO`, `KICKOFF`) and the earlier DreamFrame 9-hour plan. **PreVis's architecture is the spine**; DreamFrame contributed features, not structure. Conflicts were resolved as follows.

| Conflict | Resolution |
|---|---|
| 36-hour vs 9-hour clock | 36 hours, M0–M7 (§11). |
| Static Vite SPA vs Next.js + MongoDB + Vercel | Static SPA, no backend, no database, `localStorage` only (§4). Cost: client-side API keys, disclosed in the README (§7.5). |
| Single scene vs Acts/Scenes/full script | Spec stays single-scene (§3). Full-script upload becomes a T1 **pre-pass** that segments and selects a scene (§7.3). Multi-scene state remains cut. |
| "Exactly two Claude calls" vs script parser + simulation + judge | Two on the critical path; `structureScript` is a gated T1 third, `judgeBranch` a T2 fourth (§7). |
| LLM judge metrics vs geometry-only notes | Judge scores demoted to T2 with an explicit warning (§7.4): they undercut the central claim in §15 and must never share a surface with `Note`. |
| Branch Impact Simulator as flagship | T2 (§2). The analyzer is the flagship. |
| ElevenLabs voice as must-have | T1, item 1 of M6 (§8) — highest demo value per hour among the cuttables, but not load-bearing. |
| Emotion→animation mapping | Kept, as deterministic `animationMap.ts` (§6.5), resolving the `clip` field §3 already had. |
| Curated Mixamo subset | Both plans agreed; PreVis's exact numbers (6 characters, 14 clips, 14 props, 3 rooms) are authoritative (§6.1). |
| Liveblocks presence | Cut — no backend, and invisible in a solo stage demo (§2). |
| Team roles | PreVis's A/B/C/D (renderer / AI / analyzer+UI / product), with voice added to D (§12). |
| `claude-sonnet-4-6` in the source prompts | Updated to `claude-opus-5`; `budget_tokens` removed (it 400s on current models); `claude-sonnet-5` noted as the cost step-down (§7). |
| `CLAUDE.md` as a separate file | Folded into §10. If you want the agent to read rules automatically, copy §10 into a `CLAUDE.md` at the repo root. |
