// patch.test.ts
// Purpose: Unit tests for the pure patch-merge helpers — happy path, partial
//          patches, and patches that touch no fields.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { mergeActPatch, mergeCharacterPatch, mergeScenePatch } from "@/lib/scripts/patch";
import type { Act, Character, Scene } from "@/lib/types";

const baseScene: Scene = {
  id: "sc_1",
  actId: "act_1",
  order: 1,
  title: "Original title",
  text: "Original text",
  toneTarget: "tense",
  characterIds: ["ch_1"],
  metrics: null,
  keyframes: [],
  modelAsset: null,
  recommendations: null,
};

const baseAct: Act = { id: "act_1", title: "Act One", order: 1 };

const baseCharacter: Character = {
  id: "ch_1",
  name: "MAYA",
  motivation: "wants to leave",
  traits: ["guarded"],
  baselineEmotion: "controlled",
  color: "var(--chart-1)",
  modelAsset: null,
  voiceId: null,
};

describe("mergeScenePatch", () => {
  it("overwrites only the fields present in the patch", () => {
    const result = mergeScenePatch(baseScene, {
      type: "scene",
      id: "sc_1",
      title: "New title",
    });

    expect(result.title).toBe("New title");
    expect(result.text).toBe(baseScene.text);
    expect(result.characterIds).toBe(baseScene.characterIds);
  });

  it("replaces characterIds wholesale when provided", () => {
    const result = mergeScenePatch(baseScene, {
      type: "scene",
      id: "sc_1",
      characterIds: ["ch_2", "ch_3"],
    });

    expect(result.characterIds).toEqual(["ch_2", "ch_3"]);
  });

  it("returns an equivalent object for an empty patch", () => {
    const result = mergeScenePatch(baseScene, { type: "scene", id: "sc_1" });
    expect(result).toEqual(baseScene);
  });
});

describe("mergeActPatch", () => {
  it("updates the title", () => {
    const result = mergeActPatch(baseAct, { type: "act", id: "act_1", title: "Act Two" });
    expect(result.title).toBe("Act Two");
    expect(result.order).toBe(baseAct.order);
  });
});

describe("mergeCharacterPatch", () => {
  it("updates only the provided fields", () => {
    const result = mergeCharacterPatch(baseCharacter, {
      type: "character",
      id: "ch_1",
      baselineEmotion: "afraid",
      traits: ["guarded", "sharp-tongued"],
    });

    expect(result.baselineEmotion).toBe("afraid");
    expect(result.traits).toEqual(["guarded", "sharp-tongued"]);
    expect(result.name).toBe(baseCharacter.name);
    expect(result.motivation).toBe(baseCharacter.motivation);
  });

  it("updates the cue color", () => {
    const result = mergeCharacterPatch(baseCharacter, {
      type: "character",
      id: "ch_1",
      color: "#ff8800",
    });

    expect(result.color).toBe("#ff8800");
    expect(result.name).toBe(baseCharacter.name);
  });

  it("assigns a voice id", () => {
    const result = mergeCharacterPatch(baseCharacter, {
      type: "character",
      id: "ch_1",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    });

    expect(result.voiceId).toBe("21m00Tcm4TlvDq8ikWAM");
  });

  it("clears a voice id back to auto-assigned when the patch sends null", () => {
    const assigned: Character = { ...baseCharacter, voiceId: "21m00Tcm4TlvDq8ikWAM" };
    const result = mergeCharacterPatch(assigned, {
      type: "character",
      id: "ch_1",
      voiceId: null,
    });

    expect(result.voiceId).toBeNull();
  });

  it("leaves the voice id untouched when the patch omits it", () => {
    const assigned: Character = { ...baseCharacter, voiceId: "21m00Tcm4TlvDq8ikWAM" };
    const result = mergeCharacterPatch(assigned, {
      type: "character",
      id: "ch_1",
      name: "MAYA R.",
    });

    expect(result.voiceId).toBe("21m00Tcm4TlvDq8ikWAM");
  });
});
