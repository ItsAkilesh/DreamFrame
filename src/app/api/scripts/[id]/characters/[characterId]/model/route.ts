// route.ts
// Purpose: Upload or remove a character's custom 3D model (FBX/GLB/glTF/
//          Blender file). Stored under public/uploads/characters/ so Next's
//          static file server can serve it directly — fine for a local
//          single-instance app, not durable across an ephemeral/serverless
//          deploy (same tradeoff the app already accepts for Mongo-as-cache).
//          Picking a shared library asset instead is handled by the sibling
//          model/pick route.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

import {
  CHARACTER_MODEL_FORMATS,
  MAX_CHARACTER_MODEL_BYTES,
  characterModelFormatFromFileName,
} from "@/lib/character-model-formats";
import {
  deletePerCharacterUploadIfOwned,
  jsonError,
  loadCharacter,
} from "@/lib/character-model-storage";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "characters");
const PUBLIC_URL_PREFIX = "/uploads/characters";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const { id, characterId } = await params;
  const loaded = await loadCharacter(id, characterId);
  if ("error" in loaded) return loaded.error;
  const { script, character } = loaded;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return jsonError("No file provided", 400);
  }

  const format = characterModelFormatFromFileName(file.name);
  if (!format) {
    return jsonError(`Unsupported file type — use one of: ${CHARACTER_MODEL_FORMATS.join(", ")}`, 400);
  }
  if (file.size > MAX_CHARACTER_MODEL_BYTES) {
    return jsonError(`File is too large (max ${MAX_CHARACTER_MODEL_BYTES / (1024 * 1024)}MB)`, 400);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const storedFileName = `${id}-${characterId}-${Date.now()}.${format}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, storedFileName), buffer);

  const previousUrl = character.modelAsset?.url;

  character.modelAsset = {
    fileName: file.name.replace(/[/\\]/g, "_").slice(-120),
    format,
    url: `${PUBLIC_URL_PREFIX}/${storedFileName}`,
    uploadedAt: new Date(),
  };
  await script.save();

  await deletePerCharacterUploadIfOwned(previousUrl);

  return NextResponse.json({ status: "ok", modelAsset: character.modelAsset });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const { id, characterId } = await params;
  const loaded = await loadCharacter(id, characterId);
  if ("error" in loaded) return loaded.error;
  const { script, character } = loaded;

  const previousUrl = character.modelAsset?.url;
  character.modelAsset = null;
  await script.save();

  await deletePerCharacterUploadIfOwned(previousUrl);

  return NextResponse.json({ status: "ok" });
}
