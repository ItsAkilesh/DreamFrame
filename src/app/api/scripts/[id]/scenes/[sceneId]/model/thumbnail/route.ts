// route.ts
// Purpose: Persist a client-rendered PNG thumbnail for a scene's environment
//          model, generated once by the shared thumbnail queue (see
//          thumbnail-generator-host.tsx) and cached here so every later view
//          shows a static <img> instead of mounting a live WebGL preview.
//          Mirrors the character model thumbnail route.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/character-model-storage";
import { loadScene } from "@/lib/scene-model-storage";

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2MB — a small square PNG
const THUMBNAIL_DIR = join(process.cwd(), "public", "uploads", "scenes-thumbnails");

const BodySchema = z.object({
  dataUrl: z.string().regex(/^data:image\/png;base64,/, "dataUrl must be a base64 PNG data URL"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const { id, sceneId } = await params;
  const loaded = await loadScene(id, sceneId);
  if ("error" in loaded) return loaded.error;
  const { script, scene } = loaded;

  if (!scene.modelAsset) {
    return jsonError("This scene has no model to thumbnail", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  const buffer = Buffer.from(parsed.data.dataUrl.slice(parsed.data.dataUrl.indexOf(",") + 1), "base64");
  if (buffer.byteLength > MAX_THUMBNAIL_BYTES) {
    return jsonError("Thumbnail is too large", 400);
  }

  await mkdir(THUMBNAIL_DIR, { recursive: true });
  // Stable, non-unique filename: a replaced model's new thumbnail just
  // overwrites the old file at the same path, so nothing is ever orphaned.
  const fileName = `${id}-${sceneId}.png`;
  await writeFile(join(THUMBNAIL_DIR, fileName), buffer);

  scene.modelAsset.previewUrl = `/uploads/scenes-thumbnails/${fileName}`;
  await script.save();

  return NextResponse.json({ status: "ok", previewUrl: scene.modelAsset.previewUrl });
}
