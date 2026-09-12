// chemistrySimulator.ts
// Purpose: One structured-output call that improvises a short two-hander
//          exchange between exactly two characters and scores their
//          chemistry — deliberately a single call producing the whole
//          exchange at once (not simulateConversation.ts's streaming,
//          one-call-per-turn engine), since this is a focused pairwise
//          probe, not a full scene simulation.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { openai, SIMULATION_MODEL } from "@/lib/openai";
import type { Character } from "@/lib/types";

const MIN_LINES = 4;
const MAX_LINES = 8;

const ChemistryResultSchema = z.object({
  exchange: z
    .array(
      z.object({
        characterId: z.string().describe("Must be exactly one of the two supplied character ids."),
        text: z.string(),
      })
    )
    .min(MIN_LINES)
    .max(MAX_LINES),
  chemistryScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0 = no spark, talk past each other; 100 = electric rapport/tension."),
  rationale: z.string().describe("One or two sentences on what drives (or kills) their chemistry."),
});
export type ChemistryResult = z.infer<typeof ChemistryResultSchema>;

export interface ChemistrySimulatorOptions {
  scene: { title: string; text: string; toneTarget: string };
  characterA: Character;
  characterB: Character;
  // Lets a cancelled request actually stop the upstream OpenAI call instead
  // of just abandoning the response on the client — passed straight through
  // to the SDK, which aborts the underlying fetch.
  signal?: AbortSignal;
}

export async function runChemistrySimulator({
  scene,
  characterA,
  characterB,
  signal,
}: ChemistrySimulatorOptions): Promise<ChemistryResult> {
  const response = await openai.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      {
        role: "system",
        content: `You improvise a short two-character exchange to test their chemistry, then score it honestly.

Character A — id "${characterA.id}", name ${characterA.name}:
  motivation: ${characterA.motivation}
  traits: ${characterA.traits.join(", ") || "none specified"}
  baseline emotion: ${characterA.baselineEmotion}

Character B — id "${characterB.id}", name ${characterB.name}:
  motivation: ${characterB.motivation}
  traits: ${characterB.traits.join(", ") || "none specified"}
  baseline emotion: ${characterB.baselineEmotion}

Write ${MIN_LINES}-${MAX_LINES} lines alternating naturally between just these two (not
strictly turn-by-turn if one would realistically interrupt or go quiet), reacting to
each other in the scene's context. Use each character's exact id string for
"characterId" on their lines. Then score their chemistry honestly — most pairs
are middling, not electric; reserve the extremes for exchanges that clearly earn them.`,
      },
      {
        role: "user",
        content: `SCENE: ${scene.title}
CONTEXT: ${scene.text}
TONE: ${scene.toneTarget || "unspecified"}

Improvise the exchange between ${characterA.name} and ${characterB.name}, then score their chemistry.`,
      },
    ],
    text: { format: zodTextFormat(ChemistryResultSchema, "chemistry_result") },
  }, { signal });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Chemistry simulator returned no structured output");
  return parsed;
}
