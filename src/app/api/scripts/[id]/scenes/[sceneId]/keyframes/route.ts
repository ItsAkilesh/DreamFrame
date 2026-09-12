// route.ts
// Purpose: Persist a scene's keyframe track. The Editor View edits keyframes in
//          memory and saves the whole track — replace, not merge, because the
//          timeline is the single author and a partial merge would resurrect
//          keyframes the user just deleted.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/character-model-storage";
import { loadScene } from "@/lib/scene-model-storage";

// Mirrors KeyframeZ (@/schema/previsSpec) plus the same 400 cap, so a runaway
// client cannot grow a scene document without bound.
const KeyframeSchema = z.object({
  id: z.string().min(1).max(64),
  characterId: z.string().min(1).max(64),
  time: z.number().min(0).max(60 * 60),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number(),
});

const BodySchema = z.object({ keyframes: z.array(KeyframeSchema).max(400) });

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const { id, sceneId } = await params;
  const loaded = await loadScene(id, sceneId);
  if ("error" in loaded) return loaded.error;
  const { script, scene } = loaded;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Invalid keyframes: ${parsed.error.issues[0]?.message ?? "bad payload"}`, 400);
  }

  scene.set("keyframes", parsed.data.keyframes);
  await script.save();

  return NextResponse.json({ ok: true, count: parsed.data.keyframes.length });
}
