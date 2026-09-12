// route.ts
// Purpose: Run a one-shot Motivation Stress Test for a single character in a
//          scene against an author-supplied pressure scenario. Deliberately
//          not persisted (no SimulationRun, no scene.metrics write) — this is
//          a quick probe a director tries repeatedly with different
//          scenarios, not a scene-defining event worth keeping a history of.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { runMotivationStressTest } from "@/lib/ai/motivationStressTest";
import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";

const MAX_PRESSURE_SCENARIO_LENGTH = 500;

const RequestSchema = z.object({
  sceneId: z.string(),
  characterId: z.string(),
  pressureScenario: z.string().min(1).max(MAX_PRESSURE_SCENARIO_LENGTH),
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
  const { sceneId, characterId, pressureScenario } = parsed.data;

  await connectToDatabase();
  const script = await ScriptModel.findById(id);
  if (!script) return jsonError("Script not found", 404);

  const scene = script.scenes.id(sceneId);
  if (!scene) return jsonError("Scene not found", 404);

  const characterDoc = script.characters.id(characterId);
  if (!characterDoc) return jsonError("Character not found", 404);

  try {
    const result = await runMotivationStressTest({
      scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
      character: {
        id: characterDoc._id.toString(),
        name: characterDoc.name,
        motivation: characterDoc.motivation,
        traits: characterDoc.traits,
        baselineEmotion: characterDoc.baselineEmotion,
        color: characterDoc.color,
        modelAsset: null,
        voiceId: characterDoc.voiceId ?? null,
      },
      pressureScenario,
      signal: request.signal,
    });
    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    // The client already knows it cancelled and isn't waiting on this
    // response — no need to log an aborted-on-purpose call as a failure.
    if (request.signal.aborted) return jsonError("Cancelled", 499);
    console.error("Motivation stress test failed:", error);
    return jsonError("Motivation stress test failed", 502);
  }
}
