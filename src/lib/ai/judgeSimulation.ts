// judgeSimulation.ts
// Purpose: Scores a completed simulation transcript into DashboardMetrics
//          (arc coherence, chemistry, fragility risk, engagement, tone
//          drift, tension curve) via one structured-output LLM call — the
//          "judge" pass plan.md describes (§7.4), separate from the turn-by-
//          turn conversation generator in simulateConversation.ts.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { gemini, SIMULATION_MODEL } from "@/lib/gemini";
import type { Character, DashboardMetrics } from "@/lib/types";

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const TENSION_POINTS = 8;

const MetricsResponseSchema = z.object({
  arcCoherence: z.number().min(MIN_SCORE).max(MAX_SCORE),
  characterConsistency: z.number().min(MIN_SCORE).max(MAX_SCORE),
  chemistryStrength: z.number().min(MIN_SCORE).max(MAX_SCORE),
  fragilityRisk: z.number().min(MIN_SCORE).max(MAX_SCORE),
  engagement: z.number().min(MIN_SCORE).max(MAX_SCORE),
  toneDrift: z.number().min(MIN_SCORE).max(MAX_SCORE),
  tensionCurve: z.array(z.number().min(MIN_SCORE).max(MAX_SCORE)).length(TENSION_POINTS),
});

export interface JudgeSimulationOptions {
  scene: { title: string; text: string; toneTarget: string };
  characters: Character[];
  transcript: { characterId: string; text: string }[];
}

function buildPrompt({ scene, characters, transcript }: JudgeSimulationOptions): string {
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  const transcriptText = transcript
    .map((turn) => `${nameOf(turn.characterId)}: ${turn.text}`)
    .join("\n");

  return `SCENE: ${scene.title}
INTENDED TONE: ${scene.toneTarget || "unspecified"}
ORIGINAL SCENE TEXT: ${scene.text}

SIMULATED TRANSCRIPT:
${transcriptText}

Score this simulated performance of the scene, 0-100 on each axis:
- arcCoherence: does the transcript build and resolve like a real dramatic beat, not just chatter?
- characterConsistency: does each character stay true to their stated motivation/traits/baseline emotion throughout?
- chemistryStrength: do the characters play off each other, or talk past one another?
- fragilityRisk: how likely is this exact dialogue to fall apart or feel hollow on a re-run (higher = more fragile)?
- engagement: would an audience stay interested through this transcript?
- toneDrift: how far the actual tone drifted from "${scene.toneTarget || "the scene's intended tone"}" (higher = more drift).
- tensionCurve: exactly ${TENSION_POINTS} points tracing the scene's dramatic tension from start to end.`;
}

export async function judgeSimulation(options: JudgeSimulationOptions): Promise<DashboardMetrics> {
  const response = await gemini.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are a script analyst scoring a simulated scene performance. Be honest and specific — most real scenes score in the 40-75 range on any given axis; reserve the extremes for transcripts that clearly earn them.",
      },
      { role: "user", content: buildPrompt(options) },
    ],
    text: { format: zodTextFormat(MetricsResponseSchema, "scene_metrics") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("Simulation judge returned no structured output");
  }
  return parsed;
}
