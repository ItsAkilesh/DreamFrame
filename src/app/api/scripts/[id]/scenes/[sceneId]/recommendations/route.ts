// route.ts
// Purpose: Generate and persist the AI-polished recommendation set for one
//          scene. The deterministic checks run here too — they're the input
//          the script-doctor pass is allowed to rewrite, and they're also the
//          fallback: if the LLM call fails, the detected findings are saved
//          as-is and the panel still says something useful.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { Types } from "mongoose";
import { NextResponse } from "next/server";

import { recommendScript } from "@/lib/ai/recommendScript";
import { loadScene } from "@/lib/scene-model-storage";
import type { Character, DashboardMetrics, Recommendation, SimulationTurn } from "@/lib/types";
import { runRecommendationChecks } from "@/recommend";

export const maxDuration = 60;

interface CharacterSubdoc {
  _id: Types.ObjectId;
  name: string;
  motivation: string;
  traits: string[];
  baselineEmotion: string;
  color: string;
}

interface RunSubdoc {
  _id: Types.ObjectId;
  sceneId: Types.ObjectId;
  transcript: {
    characterId: Types.ObjectId;
    text: string;
    turnIndex: number;
    action: string;
    animationAssetId: string | null;
  }[];
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const { id, sceneId } = await params;
  const loaded = await loadScene(id, sceneId);
  if ("error" in loaded) return loaded.error;
  const { script, scene } = loaded;

  // The whole cast, not just this scene's — the checks resolve the scene's own
  // members from characterIds, and a transcript turn from a character since
  // dropped from the cast list should still resolve to a name.
  const characters: Character[] = (script.characters as unknown as CharacterSubdoc[]).map(
    (character) => ({
      id: character._id.toString(),
      name: character.name,
      motivation: character.motivation,
      traits: character.traits,
      baselineEmotion: character.baselineEmotion,
      color: character.color,
      // Not read by any check; the 3D asset has no bearing on the writing.
      modelAsset: null,
    })
  );

  // Latest run for this scene — the same take the dashboard's composition card
  // describes, so the two panels never disagree.
  const runs = (script.simulationRuns as unknown as RunSubdoc[]).filter(
    (run) => run.sceneId.toString() === sceneId
  );
  const latestRun = runs.at(-1) ?? null;
  const transcript: SimulationTurn[] = (latestRun?.transcript ?? []).map((turn) => ({
    characterId: turn.characterId.toString(),
    text: turn.text,
    turnIndex: turn.turnIndex,
    action: turn.action,
    animationAssetId: turn.animationAssetId,
  }));

  const checkInput = {
    scene: {
      id: sceneId,
      title: scene.title,
      text: scene.text,
      toneTarget: scene.toneTarget,
      characterIds: (scene.characterIds as Types.ObjectId[]).map((cid) => cid.toString()),
    },
    characters,
    transcript,
    metrics: (scene.metrics as DashboardMetrics | null) ?? null,
  };

  const { items: detected } = runRecommendationChecks(checkInput);

  let items: Recommendation[] = detected;
  let polished = true;
  try {
    items = await recommendScript({
      scene: { title: scene.title, text: scene.text, toneTarget: scene.toneTarget },
      characters,
      transcript,
      metrics: checkInput.metrics,
      detected,
    });
  } catch (error) {
    // The detected findings stand on their own — they were computed, not
    // generated. Saving them unpolished beats failing the request.
    console.error("Script doctor pass failed:", error);
    polished = false;
  }

  const recommendations = {
    generatedAt: new Date(),
    basedOnRunId: latestRun?._id.toString() ?? null,
    items,
  };
  scene.set("recommendations", recommendations);
  await script.save();

  return NextResponse.json({
    status: "ok",
    polished,
    recommendations: {
      ...recommendations,
      generatedAt: recommendations.generatedAt.toISOString(),
    },
  });
}
