// route.ts
// Purpose: Persist a client-rendered PNG thumbnail for one library asset, so
//          later viewers get a static <img> instead of mounting a live WebGL
//          preview. The first browser to view an asset generates it for
//          everyone after — there's no separate build/admin step.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  ASSET_LIBRARY_CATEGORIES,
  findLibraryAsset,
  libraryThumbnailPath,
} from "@/lib/asset-library";

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2MB — a small square PNG

const BodySchema = z.object({
  category: z.enum(ASSET_LIBRARY_CATEGORIES),
  id: z.string(),
  dataUrl: z.string().regex(/^data:image\/png;base64,/, "dataUrl must be a base64 PNG data URL"),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const { category, id, dataUrl } = parsed.data;

  // Never trust the client's claim that this id is a real library asset —
  // re-derive it from disk, the same way picking a library asset does.
  const asset = await findLibraryAsset(category, id);
  if (!asset) {
    return jsonError("Unknown library asset", 404);
  }

  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  if (buffer.byteLength > MAX_THUMBNAIL_BYTES) {
    return jsonError("Thumbnail is too large", 400);
  }

  const filePath = libraryThumbnailPath(category, id);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);

  return NextResponse.json({ status: "ok" });
}
