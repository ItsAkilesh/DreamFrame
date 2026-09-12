// motivationStressTest.ts
// Purpose: One structured-output call that puts a single character under an
//          author-supplied pressure scenario and judges whether their
//          in-character reaction stays true to their stated motivation —
//          deliberately a single call (not the streaming multi-turn engine
//          simulateConversation.ts uses) since this only ever needs one
//          character's reaction, not a back-and-forth scene.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { openai, SIMULATION_MODEL } from "@/lib/openai";
import type { Character } from "@/lib/types";

const StressTestResultSchema = z.object({
  reaction: z.string().describe("The character's in-character reaction, 1-3 sentences of dialogue/action."),
  stayedConsistent: z.boolean().describe("Whether the reaction stayed true to the character's stated motivation."),
  consistencyScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0 = completely broke character, 100 = fully consistent with their motivation."),
  rationale: z.string().describe("One or two sentences explaining the score."),
});
export type StressTestResult = z.infer<typeof StressTestResultSchema>;

export interface MotivationStressTestOptions {
  scene: { title: string; text: string; toneTarget: string };
  character: Character;
  pressureScenario: string;
  // Lets a cancelled request actually stop the upstream OpenAI call instead
  // of just abandoning the response on the client — passed straight through
  // to the SDK, which aborts the underlying fetch.
  signal?: AbortSignal;
}

export async function runMotivationStressTest({
  scene,
  character,
  pressureScenario,
  signal,
}: MotivationStressTestOptions): Promise<StressTestResult> {
  const response = await openai.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      {
        role: "system",
        content: `You are ${character.name}, a character being stress-tested for consistency.

Your motivation: ${character.motivation}
Your traits: ${character.traits.join(", ") || "none specified"}
Your baseline emotional state: ${character.baselineEmotion}

Stay completely in character while reacting, then step outside the character
to judge honestly whether that reaction actually held to your stated
motivation or quietly abandoned it under pressure. Do not be lenient — most
characters partially compromise under real pressure, and the score should
reflect that rather than defaulting to "stayed consistent".`,
      },
      {
        role: "user",
        content: `SCENE: ${scene.title}
CONTEXT: ${scene.text}
TONE: ${scene.toneTarget || "unspecified"}

PRESSURE SCENARIO: ${pressureScenario}

React in character. Then score how consistent that reaction was with your stated motivation.`,
      },
    ],
    text: { format: zodTextFormat(StressTestResultSchema, "stress_test_result") },
  }, { signal });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Motivation stress test returned no structured output");
  return parsed;
}
