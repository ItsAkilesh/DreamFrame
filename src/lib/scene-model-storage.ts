// scene-model-storage.ts
// Purpose: Shared lookup/cleanup helpers for a scene's environment model
//          asset, used by both the direct-upload and library-pick API
//          routes. Mirrors character-model-storage.ts — kept as a separate
//          file rather than a shared generic helper since the two entities
//          (script.characters vs script.scenes subdocuments) differ enough
//          that a forced abstraction would cost more than the ~20 lines of
//          duplication it would save.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Types } from "mongoose";

import { jsonError, type ScriptDoc } from "@/lib/character-model-storage";
import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";

// Per-scene uploads live under here and are safe to delete once superseded.
// Library assets (public/assets/library/...) are shared across scenes and
// must never be deleted just because one scene moved on.
export const PER_SCENE_UPLOAD_URL_PREFIX = "/uploads/scenes/";

export async function loadScene(scriptId: string, sceneId: string) {
  if (!Types.ObjectId.isValid(scriptId) || !Types.ObjectId.isValid(sceneId)) {
    return { error: jsonError("Invalid id", 400) } as const;
  }

  await connectToDatabase();
  const script = (await ScriptModel.findById(scriptId)) as ScriptDoc | null;
  if (!script) {
    return { error: jsonError("Script not found", 404) } as const;
  }

  const scene = script.scenes.id(sceneId);
  if (!scene) {
    return { error: jsonError("Scene not found", 404) } as const;
  }

  return { script, scene } as const;
}

// Best-effort — a missing or already-deleted file must never fail the request.
export async function deletePerSceneUploadIfOwned(url: string | undefined) {
  if (!url || !url.startsWith(PER_SCENE_UPLOAD_URL_PREFIX)) return;
  try {
    await unlink(join(process.cwd(), "public", url));
  } catch {
    // ignore
  }
}
