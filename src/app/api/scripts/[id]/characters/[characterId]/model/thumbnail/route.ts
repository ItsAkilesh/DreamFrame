// route.ts
// Purpose: Persist a client-rendered PNG thumbnail for a character's model,
//          generated once by the shared thumbnail queue (see
//          thumbnail-generator-host.tsx) and cached here so every later view
//          of this character shows a static <img> instead of mounting a live
//          WebGL preview. Mirrors the asset-library thumbnail route.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, loadCharacter } from "@/lib/character-model-storage";

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2MB — a small square PNG
const THUMBNAIL_DIR = join(process.cwd(), "public", "uploads", "characters-thumbnails");

const BodySchema = z.object({
  dataUrl: z.string().regex(/^data:image\/png;base64,/, "dataUrl must be a base64 PNG data URL"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const { id, characterId } = await params;
  const loaded = await loadCharacter(id, characterId);
  if ("error" in loaded) return loaded.error;
  const { script, character } = loaded;

  if (!character.modelAsset) {
    return jsonError("This character has no model to thumbnail", 400);
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
  const fileName = `${id}-${characterId}.png`;
  await writeFile(join(THUMBNAIL_DIR, fileName), buffer);

  character.modelAsset.previewUrl = `/uploads/characters-thumbnails/${fileName}`;
  await script.save();

  return NextResponse.json({ status: "ok", previewUrl: character.modelAsset.previewUrl });
}
