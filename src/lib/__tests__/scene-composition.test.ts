// scene-composition.test.ts
// Purpose: Unit tests for the deterministic scene-composition stats — happy
//          path, ties/edges, and the tension-peak-counting heuristic.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { computeSceneComposition, countTensionPeaks } from "@/lib/scene-composition";
import type { Character, SimulationTurn } from "@/lib/types";

const maya: Character = {
  id: "ch_maya",
  name: "MAYA",
  motivation: "wants to leave",
  traits: [],
  baselineEmotion: "guarded",
  color: "#ef4444",
  modelAsset: null,
  voiceId: null,
};

const ravi: Character = {
  id: "ch_ravi",
  name: "RAVI",
  motivation: "wants answers",
  traits: [],
  baselineEmotion: "controlled anger",
  color: "#3b82f6",
  modelAsset: null,
  voiceId: null,
};

function turn(characterId: string, text: string): SimulationTurn {
  return { characterId, text, turnIndex: 0, action: "", animationAssetId: null };
}

describe("computeSceneComposition", () => {
  it("splits word share across characters and finds the longest monologue", () => {
    const transcript: SimulationTurn[] = [
      turn("ch_ravi", "You were going to tell me tomorrow weren't you"), // 9 words
      turn("ch_ravi", "I heard everything through the door"), // 6 words
      turn("ch_maya", "Yes"), // 1 word
    ];

    const result = computeSceneComposition(transcript, [maya, ravi]);

    expect(result.totalWordCount).toBe(16);
    expect(result.dialogueBalance[0]).toMatchObject({ characterId: "ch_ravi", wordCount: 15, percentage: 94 });
    expect(result.dialogueBalance[1]).toMatchObject({ characterId: "ch_maya", wordCount: 1, percentage: 6 });
    expect(result.longestMonologue).toMatchObject({ characterId: "ch_ravi", turns: 2 });
  });

  it("handles an empty transcript without dividing by zero", () => {
    const result = computeSceneComposition([], [maya, ravi]);
    expect(result.totalWordCount).toBe(0);
    expect(result.dialogueBalance).toEqual([]);
    expect(result.longestMonologue).toBeNull();
    expect(result.estimatedRuntimeSeconds).toBe(0);
  });

  it("falls back to the raw id if the character was removed from the cast", () => {
    const result = computeSceneComposition([turn("ch_unknown", "Hello")], [maya]);
    expect(result.dialogueBalance[0].name).toBe("ch_unknown");
  });
});

describe("countTensionPeaks", () => {
  it("counts a single rise-then-fall as one peak", () => {
    expect(countTensionPeaks([10, 30, 60, 40, 20])).toBe(1);
  });

  it("counts two separate escalations as two peaks", () => {
    expect(countTensionPeaks([10, 50, 20, 55, 15])).toBe(2);
  });

  it("does not count a monotonic climb with no fall", () => {
    expect(countTensionPeaks([10, 20, 30, 40])).toBe(0);
  });

  it("treats a flat plateau at the top as one peak, not zero", () => {
    expect(countTensionPeaks([10, 40, 40, 40, 15])).toBe(1);
  });
});
