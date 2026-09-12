// manifest.ts
// Purpose: The closed enums for every asset the previs renderer and LLM may
//          reference (plan.md §6.1). Nothing anywhere may name an asset not
//          listed here — the LLM prompt embeds this list, Zod validates
//          against it, and the renderer's manifest is the only source of
//          truth for what exists.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

export const MODEL_IDS = [
  "f_business",
  "f_casual",
  "f_athletic",
  "m_business",
  "m_casual",
  "m_athletic",
] as const;

export type ModelId = (typeof MODEL_IDS)[number];

export const CLIP_IDS = [
  "idle",
  "idle_tense",
  "idle_seated",
  "talk_a",
  "talk_b",
  "listen",
  "walk_slow",
  "walk_fast",
  "sit_down",
  "stand_up",
  "turn_left",
  "turn_right",
  "gesture_point",
  "gesture_shrug",
] as const;

export type ClipId = (typeof CLIP_IDS)[number];

export const PROP_TYPES = [
  "dining_table",
  "desk",
  "chair",
  "stool",
  "sofa",
  "armchair",
  "bed",
  "counter",
  "shelf",
  "lamp",
  "tv",
  "plant",
  "door",
  "window",
] as const;

export type PropType = (typeof PROP_TYPES)[number];

export const ROOM_PRESETS = ["kitchen", "office", "bar"] as const;

export type RoomPreset = (typeof ROOM_PRESETS)[number];

export const MODEL_PATH = (id: ModelId): string => `/assets/characters/${id}.glb`;
export const PROP_PATH = (type: PropType): string => `/assets/props/${type}.glb`;

// Approximate real-world footprint per prop type, metres: [width, height, depth].
// Placeholder-geometry box size for the renderer, and the AABB the OCCLUSION
// check raycasts against — one source of truth so they can't drift apart.
export const PROP_DIMENSIONS: Record<PropType, [number, number, number]> = {
  dining_table: [1.5, 0.75, 0.9],
  desk: [1.4, 0.75, 0.7],
  chair: [0.45, 0.9, 0.45],
  stool: [0.35, 0.6, 0.35],
  sofa: [1.8, 0.8, 0.85],
  armchair: [0.8, 0.9, 0.85],
  bed: [1.6, 0.5, 2.0],
  counter: [2.0, 0.9, 0.6],
  shelf: [0.9, 1.8, 0.3],
  lamp: [0.3, 1.5, 0.3],
  tv: [1.1, 0.65, 0.08],
  plant: [0.4, 1.1, 0.4],
  door: [0.9, 2.0, 0.05],
  window: [1.2, 1.4, 0.05],
};
