// route.ts
// Purpose: Upload or remove a scene's 3D environment model (FBX/GLB/glTF/
//          Blender file) — the room/set the scene plays out in. Stored under
//          public/uploads/scenes/, mirroring the per-character upload route.
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
import { jsonError } from "@/lib/character-model-storage";
import { deletePerSceneUploadIfOwned, loadScene } from "@/lib/scene-model-storage";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "scenes");
const PUBLIC_URL_PREFIX = "/uploads/scenes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const { id, sceneId } = await params;
  const loaded = await loadScene(id, sceneId);
  if ("error" in loaded) return loaded.error;
  const { script, scene } = loaded;

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
  const storedFileName = `${id}-${sceneId}-${Date.now()}.${format}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, storedFileName), buffer);

  const previousUrl = scene.modelAsset?.url;

  scene.modelAsset = {
    fileName: file.name.replace(/[/\\]/g, "_").slice(-120),
    format,
    url: `${PUBLIC_URL_PREFIX}/${storedFileName}`,
    uploadedAt: new Date(),
  };
  await script.save();

  await deletePerSceneUploadIfOwned(previousUrl);

  return NextResponse.json({ status: "ok", modelAsset: scene.modelAsset });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const { id, sceneId } = await params;
  const loaded = await loadScene(id, sceneId);
  if ("error" in loaded) return loaded.error;
  const { script, scene } = loaded;

  const previousUrl = scene.modelAsset?.url;
  scene.modelAsset = null;
  await script.save();

  await deletePerSceneUploadIfOwned(previousUrl);

  return NextResponse.json({ status: "ok" });
}
