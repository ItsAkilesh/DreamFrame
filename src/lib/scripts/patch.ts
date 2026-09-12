// patch.ts
// Purpose: Pure field-merge helpers that apply a validated patch onto a
//          plain Act/Scene/Character object. Kept free of Mongoose so the
//          merge logic is unit-testable without a database connection.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import type { Act, Character, Scene } from "@/lib/types";
import type {
  ActPatch,
  CharacterPatch,
  ScenePatch,
} from "@/lib/scripts/patch-schema";

function omitUndefined<T extends object>(fields: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(fields) as (keyof T)[]) {
    if (fields[key] !== undefined) {
      result[key] = fields[key];
    }
  }
  return result;
}

// The `*PatchFields` helpers return only the fields a patch actually sets,
// with no dependency on the target's type — the route applies these directly
// to a Mongoose subdocument, whose field types (ObjectId vs string id) don't
// match the app-level Scene/Act/Character types the `merge*Patch` functions
// below are written against.
export function scenePatchFields(patch: ScenePatch) {
  return omitUndefined({
    title: patch.title,
    text: patch.text,
    toneTarget: patch.toneTarget,
    characterIds: patch.characterIds,
  });
}

export function actPatchFields(patch: ActPatch) {
  return omitUndefined({ title: patch.title });
}

export function characterPatchFields(patch: CharacterPatch) {
  return omitUndefined({
    name: patch.name,
    motivation: patch.motivation,
    traits: patch.traits,
    baselineEmotion: patch.baselineEmotion,
    color: patch.color,
  });
}

export function mergeScenePatch(scene: Scene, patch: ScenePatch): Scene {
  return { ...scene, ...scenePatchFields(patch) };
}

export function mergeActPatch(act: Act, patch: ActPatch): Act {
  return { ...act, ...actPatchFields(patch) };
}

export function mergeCharacterPatch(
  character: Character,
  patch: CharacterPatch
): Character {
  return { ...character, ...characterPatchFields(patch) };
}
