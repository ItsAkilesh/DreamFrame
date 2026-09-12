// scene-composition.ts
// Purpose: Deterministic, transcript-derived scene stats — computed straight
//          from a SimulationRun's own turns, not judged by an LLM. These
//          complement the AI-scored DashboardMetrics tiles rather than
//          duplicate them: same reasoning as the previs analyzer elsewhere
//          in this app (src/analyze) — a number computed from the actual
//          data is worth more than another plausible-sounding score, and
//          costs nothing extra to produce.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import type { Character, SimulationTurn } from "@/lib/types";

const WORDS_PER_MINUTE = 150;

export interface CharacterDialogueShare {
  characterId: string;
  name: string;
  color: string;
  wordCount: number;
  percentage: number;
}

export interface LongestMonologue {
  characterId: string;
  name: string;
  turns: number;
}

export interface SceneComposition {
  dialogueBalance: CharacterDialogueShare[];
  longestMonologue: LongestMonologue | null;
  estimatedRuntimeSeconds: number;
  totalWordCount: number;
}

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

export function computeSceneComposition(
  transcript: SimulationTurn[],
  characters: Character[]
): SceneComposition {
  const wordsByCharacter = new Map<string, number>();
  let totalWordCount = 0;
  let currentRun: { characterId: string; turns: number } | null = null;
  let longestRun: { characterId: string; turns: number } | null = null;

  for (const turn of transcript) {
    const words = wordCount(turn.text);
    wordsByCharacter.set(turn.characterId, (wordsByCharacter.get(turn.characterId) ?? 0) + words);
    totalWordCount += words;

    currentRun =
      currentRun && currentRun.characterId === turn.characterId
        ? { characterId: turn.characterId, turns: currentRun.turns + 1 }
        : { characterId: turn.characterId, turns: 1 };

    if (!longestRun || currentRun.turns > longestRun.turns) {
      longestRun = currentRun;
    }
  }

  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  const colorOf = (id: string) => characters.find((c) => c.id === id)?.color ?? "var(--muted-foreground)";

  const dialogueBalance: CharacterDialogueShare[] = [...wordsByCharacter.entries()]
    .map(([characterId, words]) => ({
      characterId,
      name: nameOf(characterId),
      color: colorOf(characterId),
      wordCount: words,
      percentage: totalWordCount > 0 ? Math.round((words / totalWordCount) * 100) : 0,
    }))
    .sort((a, b) => b.wordCount - a.wordCount);

  return {
    dialogueBalance,
    longestMonologue: longestRun
      ? { characterId: longestRun.characterId, name: nameOf(longestRun.characterId), turns: longestRun.turns }
      : null,
    estimatedRuntimeSeconds: Math.round((totalWordCount / WORDS_PER_MINUTE) * 60),
    totalWordCount,
  };
}

// Counts direction reversals from rising to falling — a scene that climbs
// once to a single high point scores 1, one that spikes, cools, and spikes
// again scores 2, and so on. Flat runs (equal consecutive values) don't
// count as a direction change either way, so a plateau at a peak is still
// one peak, not zero.
export function countTensionPeaks(tensionCurve: number[]): number {
  let peaks = 0;
  let direction: "up" | "down" | "flat" = "flat";

  for (let i = 1; i < tensionCurve.length; i++) {
    const delta = tensionCurve[i] - tensionCurve[i - 1];
    const next: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    if (next === "down" && direction === "up") peaks += 1;
    if (next !== "flat") direction = next;
  }

  return peaks;
}
