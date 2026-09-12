// patch-schema.ts
// Purpose: Zod validation for PATCH /api/scripts/[id] requests — a partial
//          update to exactly one scene, act, or character, discriminated by
//          "type". Validated at the route boundary before anything touches
//          Mongo.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";

const MAX_TRAITS = 5;

export const ScenePatchSchema = z.object({
  type: z.literal("scene"),
  id: z.string(),
  title: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  toneTarget: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
});

export const ActPatchSchema = z.object({
  type: z.literal("act"),
  id: z.string(),
  title: z.string().min(1).optional(),
});

export const CharacterPatchSchema = z.object({
  type: z.literal("character"),
  id: z.string(),
  name: z.string().min(1).optional(),
  motivation: z.string().optional(),
  traits: z.array(z.string()).max(MAX_TRAITS).optional(),
  baselineEmotion: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be a 6-digit hex code").optional(),
  // Nullable (not just optional): "clear the assignment" is a real, distinct
  // patch from "leave whatever it was" — omitting the field vs. sending null.
  voiceId: z.string().nullable().optional(),
});

export const ScriptPatchRequestSchema = z.discriminatedUnion("type", [
  ScenePatchSchema,
  ActPatchSchema,
  CharacterPatchSchema,
]);

export type ScenePatch = z.infer<typeof ScenePatchSchema>;
export type ActPatch = z.infer<typeof ActPatchSchema>;
export type CharacterPatch = z.infer<typeof CharacterPatchSchema>;
export type ScriptPatchRequest = z.infer<typeof ScriptPatchRequestSchema>;
