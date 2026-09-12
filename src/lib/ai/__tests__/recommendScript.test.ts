// recommendScript.test.ts
// Purpose: Covers the guarantee that makes the script-doctor pass defensible —
//          the model may rewrite a detected finding's wording, but can never
//          create, delete, or reclassify one. Pure merge logic only; no LLM
//          call is made.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { mergeRecommendations, type RecommendScriptOptions } from "@/lib/ai/recommendScript";
import type { Character, Recommendation } from "@/lib/types";

const maya: Character = {
  id: "ch_maya",
  name: "MAYA",
  motivation: "wants to leave without a scene",
  traits: [],
  baselineEmotion: "guarded",
  color: "#ef4444",
  modelAsset: null,
};

const detected: Recommendation[] = [
  {
    id: "sc_1_flat_tension",
    code: "FLAT_TENSION",
    priority: "high",
    category: "pacing",
    source: "detected",
    title: "The scene has no dramatic shape",
    detail: "deterministic detail",
    fix: "deterministic fix",
    characterIds: [],
    quote: null,
  },
  {
    id: "sc_1_thin_scene",
    code: "THIN_SCENE",
    priority: "high",
    category: "structure",
    source: "detected",
    title: "Scene text is only 3 words",
    detail: "another deterministic detail",
    fix: "another deterministic fix",
    characterIds: [],
    quote: null,
  },
];

const options: RecommendScriptOptions = {
  scene: { title: "The kitchen", text: "They talk.", toneTarget: "tense" },
  characters: [maya],
  transcript: [],
  metrics: null,
  detected,
};

describe("mergeRecommendations", () => {
  it("replaces the wording of a matched finding but keeps its identity", () => {
    const merged = mergeRecommendations(options, {
      rewritten: [
        {
          id: "sc_1_flat_tension",
          detail: "Nothing in this scene gets harder for anyone.",
          fix: "Let Maya's bag be found before she chooses to mention it.",
        },
      ],
      additional: [],
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "sc_1_flat_tension",
      code: "FLAT_TENSION",
      priority: "high",
      category: "pacing",
      source: "detected",
      title: "The scene has no dramatic shape",
      detail: "Nothing in this scene gets harder for anyone.",
      fix: "Let Maya's bag be found before she chooses to mention it.",
    });
  });

  it("keeps the deterministic wording for a finding the model skipped", () => {
    const merged = mergeRecommendations(options, { rewritten: [], additional: [] });
    expect(merged.map((item) => item.detail)).toEqual([
      "deterministic detail",
      "another deterministic detail",
    ]);
  });

  it("drops rewrites for ids that were never detected", () => {
    const merged = mergeRecommendations(options, {
      rewritten: [{ id: "sc_1_invented", detail: "invented", fix: "invented" }],
      additional: [],
    });
    expect(merged).toHaveLength(2);
    expect(merged.some((item) => item.detail === "invented")).toBe(false);
  });

  it("never lets a rewrite blank out a finding's text", () => {
    const merged = mergeRecommendations(options, {
      rewritten: [{ id: "sc_1_thin_scene", detail: "   ", fix: "" }],
      additional: [],
    });
    expect(merged[1].detail).toBe("another deterministic detail");
    expect(merged[1].fix).toBe("another deterministic fix");
  });

  it("adds craft notes as a separate, AI-labelled source with ids resolved by name", () => {
    const merged = mergeRecommendations(options, {
      rewritten: [],
      additional: [
        {
          category: "dialogue",
          priority: "medium",
          title: "Maya states what the scene should imply",
          detail: "She explains her own motive out loud.",
          fix: "Cut the line and let the packed bag say it.",
          quote: "I just need some space",
          characterNames: ["maya", "GHOST"],
        },
      ],
    });

    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({
      code: "AI_NOTE",
      source: "ai",
      category: "dialogue",
      priority: "medium",
      quote: "I just need some space",
      // "GHOST" matches no character and is dropped rather than invented.
      characterIds: ["ch_maya"],
    });
  });

  it("treats an empty quote as no quote and discards notes with no fix", () => {
    const merged = mergeRecommendations(options, {
      rewritten: [],
      additional: [
        {
          category: "tone",
          priority: "low",
          title: "Scene-wide note",
          detail: "detail",
          fix: "a fix",
          quote: "",
          characterNames: [],
        },
        {
          category: "tone",
          priority: "low",
          title: "Note with no actionable change",
          detail: "detail",
          fix: "   ",
          quote: "",
          characterNames: [],
        },
      ],
    });

    expect(merged).toHaveLength(3);
    expect(merged[2].quote).toBeNull();
  });
});
