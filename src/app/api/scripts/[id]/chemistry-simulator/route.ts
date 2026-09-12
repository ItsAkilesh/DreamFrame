// route.ts
// Purpose: Run a one-shot Chemistry Simulator between two characters in a
//          scene. Deliberately not persisted — same reasoning as the sibling
//          motivation-stress-test route: a quick, repeatable probe rather
//          than a scene-defining event.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { runChemistrySimulator } from "@/lib/ai/chemistrySimulator";
import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";

const RequestSchema = z
  .object({
    sceneId: z.string(),
    characterAId: z.string(),
    characterBId: z.string(),
  })
  .refine((data) => data.characterAId !== data.characterBId, {
    message: "Choose two different characters",
  });

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return jsonError("Invalid script id", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const { sceneId, characterAId, characterBId } = parsed.data;

  await connectToDatabase();
  const script = await ScriptModel.findById(id);
  if (!script) return jsonError("Script not found", 404);

  const scene = script.scenes.id(sceneId);
  if (!scene) return jsonError("Scene not found", 404);

  const characterADoc = script.characters.id(characterAId);
  const characterBDoc = script.characters.id(characterBId);
  if (!characterADoc || !characterBDoc) return jsonError("Character not found", 404);

  const toCharacter = (doc: typeof characterADoc) => ({
    id: doc._id.toString(),
    name: doc.name,
    motivation: doc.motivation,
    traits: doc.traits,
    baselineEmotion: doc.baselineEmotion,
    color: doc.color,
    modelAsset: null,
  });

  try {
    const result = await runChemistrySimulator({
      scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
      characterA: toCharacter(characterADoc),
      characterB: toCharacter(characterBDoc),
      signal: request.signal,
    });
    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    // The client already knows it cancelled and isn't waiting on this
    // response — no need to log an aborted-on-purpose call as a failure.
    if (request.signal.aborted) return jsonError("Cancelled", 499);
    console.error("Chemistry simulator failed:", error);
    return jsonError("Chemistry simulator failed", 502);
  }
}
