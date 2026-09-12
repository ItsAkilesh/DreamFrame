// route.ts
// Purpose: Run a turn-by-turn multi-agent conversation simulation for one
//          scene, streaming each line back as it's generated (newline-
//          delimited JSON), then persisting the completed transcript as a
//          new SimulationRun on the script. The scene's original AI-
//          structured text is never modified — this is a separate, saved
//          run alongside it.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { judgeSimulation } from "@/lib/ai/judgeSimulation";
import { simulateConversation } from "@/lib/ai/simulateConversation";
import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";
import type { Character } from "@/lib/types";

interface CharacterSubdoc {
  _id: Types.ObjectId;
  name: string;
  motivation: string;
  traits: string[];
  baselineEmotion: string;
  color: string;
  modelAsset: {
    fileName: string;
    format: string;
    url: string;
    uploadedAt: Date;
    previewUrl: string | null;
  } | null;
}

export const maxDuration = 120;

const SimulateRequestSchema = z.object({
  sceneId: z.string(),
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
  const parsedRequest = SimulateRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return jsonError(parsedRequest.error.issues[0]?.message ?? "Invalid request", 400);
  }
  const { sceneId } = parsedRequest.data;

  await connectToDatabase();
  const script = await ScriptModel.findById(id);
  if (!script) {
    return jsonError("Script not found", 404);
  }

  const scene = script.scenes.id(sceneId);
  if (!scene) {
    return jsonError("Scene not found", 404);
  }

  const characterIds = scene.characterIds as Types.ObjectId[];
  const characters: Character[] = characterIds
    .map((cid): CharacterSubdoc | null => script.characters.id(cid) as CharacterSubdoc | null)
    .filter((c): c is CharacterSubdoc => c !== null)
    .map((c) => ({
      id: c._id.toString(),
      name: c.name,
      motivation: c.motivation,
      traits: c.traits,
      baselineEmotion: c.baselineEmotion,
      color: c.color,
      modelAsset: c.modelAsset
        ? { ...c.modelAsset, uploadedAt: c.modelAsset.uploadedAt.toISOString() }
        : null,
    }));

  if (characters.length === 0) {
    return jsonError("This scene has no characters assigned", 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const transcript: {
        characterId: string;
        text: string;
        turnIndex: number;
        action: string;
        animationAssetId: string | null;
      }[] = [];
      try {
        let turnIndex = 0;
        for await (const turn of simulateConversation({
          scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
          characters,
        })) {
          const withIndex = { ...turn, turnIndex };
          transcript.push(withIndex);
          controller.enqueue(encoder.encode(JSON.stringify(withIndex) + "\n"));
          turnIndex++;
        }

        script.simulationRuns.push({ sceneId: scene._id, transcript });

        try {
          scene.metrics = await judgeSimulation({
            scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
            characters,
            transcript,
          });
        } catch (judgeError) {
          // The transcript is still worth keeping even if scoring fails —
          // leave whatever metrics (if any) the scene already had.
          console.error("Simulation judge failed:", judgeError);
        }

        await script.save();

        const savedRun = script.simulationRuns[script.simulationRuns.length - 1];
        controller.enqueue(
          encoder.encode(JSON.stringify({ done: true, runId: savedRun._id.toString() }) + "\n")
        );
      } catch (error) {
        console.error("Simulation failed:", error);
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: "Simulation failed" }) + "\n")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
