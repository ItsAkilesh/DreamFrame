// character-model-storage.ts
// Purpose: Shared lookup/cleanup helpers for a character's model asset,
//          used by both the direct-upload and library-pick API routes.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { HydratedDocument, Types } from "mongoose";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { ScriptDocument, ScriptModel } from "@/lib/models/Script";

export type ScriptDoc = HydratedDocument<ScriptDocument>;

// Per-character uploads live under here and are safe to delete once
// superseded. Library assets (public/assets/library/...) are shared across
// characters and must never be deleted just because one character moved on.
export const PER_CHARACTER_UPLOAD_URL_PREFIX = "/uploads/characters/";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

export async function loadCharacter(scriptId: string, characterId: string) {
  if (!Types.ObjectId.isValid(scriptId) || !Types.ObjectId.isValid(characterId)) {
    return { error: jsonError("Invalid id", 400) } as const;
  }

  await connectToDatabase();
  const script = (await ScriptModel.findById(scriptId)) as ScriptDoc | null;
  if (!script) {
    return { error: jsonError("Script not found", 404) } as const;
  }

  const character = script.characters.id(characterId);
  if (!character) {
    return { error: jsonError("Character not found", 404) } as const;
  }

  return { script, character } as const;
}

// Best-effort — a missing or already-deleted file must never fail the request.
export async function deletePerCharacterUploadIfOwned(url: string | undefined) {
  if (!url || !url.startsWith(PER_CHARACTER_UPLOAD_URL_PREFIX)) return;
  try {
    await unlink(join(process.cwd(), "public", url));
  } catch {
    // ignore
  }
}
