// previsSpec.ts
// Purpose: Zod schema + inferred types for PrevisSpec (plan.md §3) — the one
//          contract shared by the renderer, the AI pipeline, and the
//          analyzer. Metres, Y-up, right-handed, rotations in radians.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";

import { CLIP_IDS, MODEL_IDS, PROP_TYPES, ROOM_PRESETS } from "@/assets/manifest";

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const ShotSize = z.enum(["ECU", "CU", "MCU", "MS", "MWS", "WS"]);
export const Action = z.enum(["walk", "turn", "sit", "stand", "gesture", "idle"]);
export const Posture = z.enum(["standing", "seated"]);
export const TimeOfDay = z.enum(["day", "night", "dusk", "dawn"]);
export const CameraMove = z.enum(["static", "push", "pull", "pan", "dolly"]);

// --- SceneMeta (§3.3) ---

export const SceneMetaZ = z.object({
  id: z.string().default("sc_01"),
  slugline: z.string().default(""),
  room: z.enum(ROOM_PRESETS).default("kitchen"),
  timeOfDay: TimeOfDay.default("day"),
  mood: z.string().default("neutral"),
  toneTarget: z.string().default(""),
});

// --- SetSpec (§3.4) ---

export const PropZ = z.object({
  id: z.string(),
  type: z.enum(PROP_TYPES),
  position: Vec3,
  rotationY: z.number().default(0),
  scale: z.number().min(0.5).max(2).default(1),
});

export const LightZ = z.object({
  id: z.string(),
  type: z.enum(["ambient", "point", "spot", "directional"]),
  position: Vec3.default([0, 2.5, 0]),
  target: Vec3.default([0, 1.4, 0]),
  intensity: z.number().default(1),
  color: z.string().default("#ffffff"),
});

export const SetSpecZ = z.object({
  dimensions: z
    .object({
      w: z.number().min(3).max(12),
      d: z.number().min(3).max(12),
      h: z.number().min(2.4).max(4),
    })
    .default({ w: 6, d: 5, h: 3 }),
  props: z.array(PropZ).max(14).default([]),
  lights: z.array(LightZ).default([]),
});

// --- Character (§3.5) ---

export const CharacterZ = z.object({
  id: z.string(),
  name: z.string(),
  modelId: z.enum(MODEL_IDS),
  position: Vec3,
  rotationY: z.number().default(0),
  posture: Posture.default("standing"),
  direction: z.string().default(""),
  voiceId: z.string().default(""),
  color: z.string().default("#888888"),
});

// --- Camera (§3.6) ---

export const CameraZ = z.object({
  id: z.string(),
  label: z.string().default(""),
  position: Vec3,
  lookAt: Vec3,
  lens_mm: z.number().min(14).max(135).default(35),
});

/** lens_mm -> vertical FOV in radians, full-frame 24mm sensor height (§3.6). */
export const vFov = (lensMm: number): number => 2 * Math.atan(24 / (2 * lensMm));

// --- Beat (§3.7) ---

export const LineZ = z.object({
  characterId: z.string(),
  text: z.string(),
  emotion: z.string(),
});

export const BlockingCueZ = z.object({
  characterId: z.string(),
  action: Action,
  to: Vec3.nullable().default(null),
  facing: z.number().nullable().default(null),
  clip: z.enum(CLIP_IDS).optional(),
});

export const ShotZ = z.object({
  cameraId: z.string(),
  subjectId: z.string(),
  move: CameraMove.default("static"),
  shotSize: ShotSize.optional(),
});

export const BeatZ = z.object({
  id: z.string(),
  startTime: z.number(),
  duration: z.number().min(1.2),
  line: LineZ.nullable().default(null),
  blocking: z.array(BlockingCueZ).default([]),
  shot: ShotZ,
});

// --- Top level (§3.2) ---

export const PrevisSpecZ = z.object({
  version: z.literal("0.1"),
  scene: SceneMetaZ,
  set: SetSpecZ,
  cast: z.array(CharacterZ).min(1).max(5),
  // §3.2 suggests 1-6 as guidance for what an LLM should emit; raised
  // modestly here since a hand-authored multi-beat scene with a deliberate
  // mid-scene line-cross (a "before" and mirrored "after" rig either side of
  // it) legitimately needs a couple more without being unbounded.
  cameras: z.array(CameraZ).min(1).max(8),
  beats: z.array(BeatZ).min(1).max(40),
});

export type PrevisSpec = z.infer<typeof PrevisSpecZ>;
export type SceneMeta = z.infer<typeof SceneMetaZ>;
export type SetSpec = z.infer<typeof SetSpecZ>;
export type Prop = z.infer<typeof PropZ>;
export type Light = z.infer<typeof LightZ>;
export type Character = z.infer<typeof CharacterZ>;
export type Camera = z.infer<typeof CameraZ>;
export type Beat = z.infer<typeof BeatZ>;
export type Line = z.infer<typeof LineZ>;
export type BlockingCue = z.infer<typeof BlockingCueZ>;
export type Shot = z.infer<typeof ShotZ>;

// --- Notes (§3.9, analyzer output — not part of the spec, shares the file) ---

export const NoteCode = z.enum([
  "LINE_CROSS",
  "SIZE_MONOTONY",
  "HEADROOM",
  "NOSE_ROOM",
  "OCCLUSION",
  "EYELINE",
  "COVERAGE_GAP",
  "TALK_SCREEN_SKEW",
  "CAMERA_IN_GEOMETRY",
]);

export const NoteZ = z.object({
  id: z.string(),
  code: NoteCode,
  severity: z.enum(["error", "warning", "info"]),
  beatIds: z.array(z.string()),
  characterIds: z.array(z.string()),
  message: z.string(),
  suggestedFix: z
    .object({
      cameraId: z.string(),
      position: Vec3.optional(),
      lookAt: Vec3.optional(),
      lens_mm: z.number().optional(),
    })
    .optional(),
});

export type Note = z.infer<typeof NoteZ>;
