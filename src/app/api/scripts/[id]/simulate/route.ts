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

import { DEFAULT_AUDIENCE_PERSONAS, runAudiencePanel } from "@/lib/ai/audienceReview";
import { judgeSimulation } from "@/lib/ai/judgeSimulation";
import { simulateConversation } from "@/lib/ai/simulateConversation";
import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";
import type { Character } from "@/lib/types";

interface AudiencePersonaSubdoc {
  _id: Types.ObjectId;
  name: string;
  description: string;
}

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
  voiceId?: string | null;
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
      voiceId: c.voiceId ?? null,
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
        voiceDirection: string;
        animationAssetId: string | null;
      }[] = [];
      // request.signal reflects the client disconnecting (its own
      // AbortController firing, or the tab/dialog closing) — checked
      // between turns so "Stop" actually stops paying for more of them,
      // not just hides the UI while generation keeps running unattended.
      let wasStopped = false;

      try {
        let turnIndex = 0;
        for await (const turn of simulateConversation({
          scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
          characters,
        })) {
          const withIndex = { ...turn, turnIndex };
          transcript.push(withIndex);
          if (!request.signal.aborted) {
            controller.enqueue(encoder.encode(JSON.stringify(withIndex) + "\n"));
          }
          turnIndex++;
          if (request.signal.aborted) {
            wasStopped = true;
            break;
          }
        }

        // Nothing generated before the stop — nothing worth a SimulationRun.
        if (transcript.length > 0) {
          script.simulationRuns.push({ sceneId: scene._id, transcript });
          const savedRun = script.simulationRuns[script.simulationRuns.length - 1];

          // Skip the judge + audience panel entirely once stopped — those
          // are several more LLM calls the user explicitly asked to avoid,
          // on top of the transcript they're still keeping.
          if (!wasStopped) {
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

            // The audience panel is several more sequential/parallel LLM
            // calls on top of everything above — tell the client why "done"
            // is taking longer, rather than let it look stalled the way an
            // un-flagged slow request always does.
            if (!request.signal.aborted) {
              controller.enqueue(encoder.encode(JSON.stringify({ status: "reviewing" }) + "\n"));
            }

            try {
              const personas = [
                ...DEFAULT_AUDIENCE_PERSONAS,
                ...script.audiencePersonas.map((p: AudiencePersonaSubdoc) => ({
                  id: p._id.toString(),
                  name: p.name,
                  description: p.description,
                })),
              ];
              savedRun.audienceReview = await runAudiencePanel({
                scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
                characters,
                transcript,
                personas,
              });
            } catch (reviewError) {
              // Same reasoning as the judge above: the transcript and any
              // metrics it already has are still worth keeping.
              console.error("Audience review failed:", reviewError);
            }
          }

          await script.save();

          if (!request.signal.aborted) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ done: true, runId: savedRun._id.toString() }) + "\n")
            );
          }
        }
      } catch (error) {
        console.error("Simulation failed:", error);
        if (!request.signal.aborted) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: "Simulation failed" }) + "\n")
          );
        }
      } finally {
        // Closing a controller whose consumer already disconnected throws
        // "already closed" — harmless, but not worth letting it surface as
        // an unhandled error after a deliberate stop.
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
