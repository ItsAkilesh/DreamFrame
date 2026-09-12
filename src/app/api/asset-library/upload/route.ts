// route.ts
// Purpose: Add a new file directly to the shared asset library (character or
//          scene) from the browser — the upload-driven alternative to
//          manually dropping a file into public/assets/library/.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextRequest, NextResponse } from "next/server";

import {
  ASSET_LIBRARY_CATEGORIES,
  saveLibraryUpload,
  type AssetLibraryCategory,
} from "@/lib/asset-library";
import { MAX_CHARACTER_MODEL_BYTES } from "@/lib/character-model-formats";

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

function isAssetLibraryCategory(value: unknown): value is AssetLibraryCategory {
  return typeof value === "string" && (ASSET_LIBRARY_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const category = formData?.get("category");

  if (!(file instanceof File)) {
    return jsonError("No file provided", 400);
  }
  if (!isAssetLibraryCategory(category)) {
    return jsonError(`category must be one of: ${ASSET_LIBRARY_CATEGORIES.join(", ")}`, 400);
  }
  if (file.size > MAX_CHARACTER_MODEL_BYTES) {
    return jsonError(`File is too large (max ${MAX_CHARACTER_MODEL_BYTES / (1024 * 1024)}MB)`, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const asset = await saveLibraryUpload(category, file.name, buffer);
    return NextResponse.json({ status: "ok", asset });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed", 400);
  }
}
