// simulateConversation.ts
// Purpose: Turn-by-turn multi-agent scene simulation. Each character is a
//          separate structured-output LLM call, conditioned on its own
//          persona and the transcript so far, taking turns round-robin.
//          Pure text — no 3D/blocking involved (that's a separate, later
//          integration).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { openai, SIMULATION_MODEL } from "@/lib/openai";
import type { Character } from "@/lib/types";

const MIN_TURNS_PER_CHARACTER = 2;
const MAX_TURNS = 16;

export interface SimulationTurnResult {
  characterId: string;
  text: string;
}

interface SimulateConversationOptions {
  scene: { title: string; text: string; toneTarget: string };
  characters: Character[];
}

const TurnResponseSchema = z.object({
  text: z.string(),
  continueScene: z.boolean(),
});

function buildSystemPrompt(character: Character, others: Character[]): string {
  const otherLines = others
    .map((o) => `- ${o.name}: ${o.motivation}`)
    .join("\n");

  return `You are playing ${character.name} in a live-improvised scene. Stay completely in character.

Your motivation: ${character.motivation}
Your traits: ${character.traits.join(", ") || "none specified"}
Your baseline emotional state: ${character.baselineEmotion}

Other characters in the scene:
${otherLines || "(none)"}

Respond with exactly one short line of dialogue (or a brief wordless action described in plain text, if that's truer to the moment) reacting naturally to what has just been said. Never narrate outside your own character's perspective, never speak for another character, and never break character to comment on the scene itself.

Also decide: does the scene feel like it has reached a natural conclusion after your line? Set continueScene to false only if it genuinely feels finished — most turns it should be true.`;
}

function buildUserPrompt(
  scene: SimulateConversationOptions["scene"],
  transcript: SimulationTurnResult[],
  characters: Character[]
): string {
  const charByName = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  const transcriptText =
    transcript.length === 0
      ? "(the scene has not started yet — you speak first)"
      : transcript.map((t) => `${charByName(t.characterId)}: ${t.text}`).join("\n");

  return `SCENE: ${scene.title}
CONTEXT: ${scene.text}
TONE: ${scene.toneTarget || "unspecified"}

TRANSCRIPT SO FAR:
${transcriptText}

Now deliver your line.`;
}

async function generateTurn(
  character: Character,
  others: Character[],
  scene: SimulateConversationOptions["scene"],
  transcript: SimulationTurnResult[]
): Promise<{ text: string; continueScene: boolean }> {
  const response = await openai.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      { role: "system", content: buildSystemPrompt(character, others) },
      { role: "user", content: buildUserPrompt(scene, transcript, [character, ...others]) },
    ],
    text: { format: zodTextFormat(TurnResponseSchema, "turn") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`Simulation turn for ${character.name} returned no structured output`);
  }
  return parsed;
}

export async function* simulateConversation(
  options: SimulateConversationOptions
): AsyncGenerator<SimulationTurnResult> {
  const { scene, characters } = options;
  if (characters.length === 0) {
    throw new Error("simulateConversation: no characters to simulate");
  }

  const transcript: SimulationTurnResult[] = [];
  const minTurns = characters.length * MIN_TURNS_PER_CHARACTER;

  for (let turnIndex = 0; turnIndex < MAX_TURNS; turnIndex++) {
    const character = characters[turnIndex % characters.length];
    const others = characters.filter((c) => c.id !== character.id);

    const { text, continueScene } = await generateTurn(character, others, scene, transcript);

    const turn: SimulationTurnResult = { characterId: character.id, text };
    transcript.push(turn);
    yield turn;

    const minTurnsMet = turnIndex + 1 >= minTurns;
    if (!continueScene && minTurnsMet) break;
  }
}
