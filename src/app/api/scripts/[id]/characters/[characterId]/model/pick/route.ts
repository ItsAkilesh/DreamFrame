// route.ts
// Purpose: Assign a character's model from the shared asset library, as an
//          alternative to uploading a file directly (see the sibling model
//          route). The client sends only the library asset's id (its
//          filename) — the server re-derives url/format from disk so it
//          never trusts a client-supplied path.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextRequest, NextResponse } from "next/server";

import { findLibraryAsset } from "@/lib/asset-library";
import {
  deletePerCharacterUploadIfOwned,
  jsonError,
  loadCharacter,
} from "@/lib/character-model-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const { id, characterId } = await params;
  const loaded = await loadCharacter(id, characterId);
  if ("error" in loaded) return loaded.error;
  const { script, character } = loaded;

  const body = await request.json().catch(() => null);
  const assetId = body?.assetId;
  if (typeof assetId !== "string" || assetId.length === 0) {
    return jsonError("assetId is required", 400);
  }

  const asset = await findLibraryAsset("character", assetId);
  if (!asset) {
    return jsonError("Library asset not found", 404);
  }

  const previousUrl = character.modelAsset?.url;

  character.modelAsset = {
    fileName: asset.id,
    format: asset.format,
    url: asset.url,
    uploadedAt: new Date(),
    // The library asset may already have a cached thumbnail — reuse it
    // rather than re-generating an identical one for this character.
    previewUrl: asset.previewUrl,
  };
  await script.save();

  await deletePerCharacterUploadIfOwned(previousUrl);

  return NextResponse.json({ status: "ok", modelAsset: character.modelAsset });
}
