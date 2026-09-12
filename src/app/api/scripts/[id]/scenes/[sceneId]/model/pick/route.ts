// route.ts
// Purpose: Assign a scene's environment model from the shared asset library
//          ("scene" category), as an alternative to uploading a file
//          directly (see the sibling model route). The client sends only the
//          library asset's id (its filename) — the server re-derives
//          url/format from disk so it never trusts a client-supplied path.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextRequest, NextResponse } from "next/server";

import { findLibraryAsset } from "@/lib/asset-library";
import { jsonError } from "@/lib/character-model-storage";
import { deletePerSceneUploadIfOwned, loadScene } from "@/lib/scene-model-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const { id, sceneId } = await params;
  const loaded = await loadScene(id, sceneId);
  if ("error" in loaded) return loaded.error;
  const { script, scene } = loaded;

  const body = await request.json().catch(() => null);
  const assetId = body?.assetId;
  if (typeof assetId !== "string" || assetId.length === 0) {
    return jsonError("assetId is required", 400);
  }

  const asset = await findLibraryAsset("scene", assetId);
  if (!asset) {
    return jsonError("Library asset not found", 404);
  }

  const previousUrl = scene.modelAsset?.url;

  scene.modelAsset = {
    fileName: asset.id,
    format: asset.format,
    url: asset.url,
    uploadedAt: new Date(),
    previewUrl: asset.previewUrl,
  };
  await script.save();

  await deletePerSceneUploadIfOwned(previousUrl);

  return NextResponse.json({ status: "ok", modelAsset: scene.modelAsset });
}
