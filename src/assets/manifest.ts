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
