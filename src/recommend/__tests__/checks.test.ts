// checks.test.ts
// Purpose: Unit tests for the deterministic script-improvement checks and the
//          panel runner — threshold edges, the never-simulated path, and the
//          priority ordering/cap.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { runRecommendationChecks, latestRunForScene } from "@/recommend";
import {
  checkCastSize,
  checkDialogueImbalance,
  checkFlatTension,
  checkMissingToneTarget,
  checkMonologueRun,
  checkNotSimulated,
  checkSilentCastMember,
  checkThinMotivation,
  checkThinScene,
  checkToneDrift,
  type RecommendationInput,
} from "@/recommend/checks";
import type { Character, DashboardMetrics, SimulationRun, SimulationTurn } from "@/lib/types";

function character(id: string, name: string, motivation = "wants to be believed"): Character {
  return {
    id,
    name,
    motivation,
    traits: [],
    baselineEmotion: "guarded",
    color: "#ef4444",
    modelAsset: null,
  };
}

const maya = character("ch_maya", "MAYA");
const ravi = character("ch_ravi", "RAVI");

function turn(characterId: string, text: string): SimulationTurn {
  return { characterId, text, turnIndex: 0, action: "", animationAssetId: null };
}

const healthyMetrics: DashboardMetrics = {
  arcCoherence: 70,
  characterConsistency: 70,
  chemistryStrength: 70,
  fragilityRisk: 20,
  engagement: 70,
  toneDrift: 15,
  tensionCurve: [10, 25, 45, 70, 80, 55, 30, 20],
};

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    scene: {
      id: "sc_1",
      title: "The kitchen",
      text:
        "Maya has packed a bag and left it by the door. Ravi finds it before she can explain, and the conversation they have been avoiding for a month happens standing up, in coats.",
      toneTarget: "tense, restrained",
      characterIds: ["ch_maya", "ch_ravi"],
      ...overrides.scene,
    },
    characters: overrides.characters ?? [maya, ravi],
    transcript: overrides.transcript ?? [],
    metrics: overrides.metrics ?? null,
  };
}

describe("checkThinScene", () => {
  it("flags a scene summary under the word floor", () => {
    const notes = checkThinScene(input({ scene: { ...input().scene, text: "They argue." } }));
    expect(notes).toHaveLength(1);
    expect(notes[0].code).toBe("THIN_SCENE");
    expect(notes[0].title).toContain("2 words");
  });

  it("passes a scene with a real summary", () => {
    expect(checkThinScene(input())).toEqual([]);
  });
});

describe("checkCastSize", () => {
  it("flags an empty cast as high priority", () => {
    const notes = checkCastSize(input({ scene: { ...input().scene, characterIds: [] } }));
    expect(notes).toHaveLength(1);
    expect(notes[0].code).toBe("EMPTY_CAST");
    expect(notes[0].priority).toBe("high");
  });

  it("flags four or more speaking parts, naming them", () => {
    const cast = [maya, ravi, character("ch_3", "DEV"), character("ch_4", "NOOR")];
    const notes = checkCastSize(
      input({
        characters: cast,
        scene: { ...input().scene, characterIds: cast.map((c) => c.id) },
      })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].code).toBe("CROWDED_CAST");
    expect(notes[0].detail).toContain("NOOR");
    expect(notes[0].characterIds).toHaveLength(4);
  });

  it("leaves a three-hander alone", () => {
    const cast = [maya, ravi, character("ch_3", "DEV")];
    expect(
      checkCastSize(
        input({ characters: cast, scene: { ...input().scene, characterIds: cast.map((c) => c.id) } })
      )
    ).toEqual([]);
  });

  // A stale id left on the scene must not be counted as a cast member.
  it("ignores character ids that are no longer on the script", () => {
    const notes = checkCastSize(
      input({ scene: { ...input().scene, characterIds: ["ch_gone_1", "ch_gone_2"] } })
    );
    expect(notes[0].code).toBe("EMPTY_CAST");
  });
});

describe("checkMissingToneTarget", () => {
  it("flags a blank tone target", () => {
    const notes = checkMissingToneTarget(input({ scene: { ...input().scene, toneTarget: "   " } }));
    expect(notes).toHaveLength(1);
    expect(notes[0].category).toBe("tone");
  });

  it("accepts a set tone target", () => {
    expect(checkMissingToneTarget(input())).toEqual([]);
  });
});

describe("checkThinMotivation", () => {
  it("flags one note per cast member with no real motivation", () => {
    const notes = checkThinMotivation(
      input({ characters: [character("ch_maya", "MAYA", "wants out"), ravi] })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].characterIds).toEqual(["ch_maya"]);
    expect(notes[0].title).toContain("MAYA");
  });
});

describe("transcript-derived checks", () => {
  it("say nothing at all when the scene has never been simulated", () => {
    const empty = input();
    expect(checkDialogueImbalance(empty)).toEqual([]);
    expect(checkSilentCastMember(empty)).toEqual([]);
    expect(checkMonologueRun(empty)).toEqual([]);
    expect(checkNotSimulated(empty)).toHaveLength(1);
  });

  it("flags a character who holds most of the words", () => {
    const notes = checkDialogueImbalance(
      input({
        transcript: [
          turn("ch_ravi", "You packed a bag and you were going to tell me tomorrow"),
          turn("ch_ravi", "I heard you on the phone with your sister last night"),
          turn("ch_maya", "Yes"),
        ],
      })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].code).toBe("DIALOGUE_IMBALANCE");
    expect(notes[0].title).toContain("RAVI");
    expect(notes[0].priority).toBe("high");
  });

  it("leaves a balanced exchange alone", () => {
    expect(
      checkDialogueImbalance(
        input({
          transcript: [
            turn("ch_ravi", "You packed a bag"),
            turn("ch_maya", "I packed a bag"),
          ],
        })
      )
    ).toEqual([]);
  });

  it("flags a cast member who never speaks in the take", () => {
    const notes = checkSilentCastMember(
      input({ transcript: [turn("ch_ravi", "Say something"), turn("ch_ravi", "Anything")] })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].characterIds).toEqual(["ch_maya"]);
  });

  it("flags three consecutive lines from one character", () => {
    const notes = checkMonologueRun(
      input({
        transcript: [
          turn("ch_maya", "One"),
          turn("ch_ravi", "Two"),
          turn("ch_ravi", "Three"),
          turn("ch_ravi", "Four"),
        ],
      })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toContain("3 lines in a row");
  });

  it("does not flag an alternating exchange", () => {
    expect(
      checkMonologueRun(
        input({
          transcript: [
            turn("ch_maya", "One"),
            turn("ch_ravi", "Two"),
            turn("ch_maya", "Three"),
          ],
        })
      )
    ).toEqual([]);
  });
});

describe("metric-derived checks", () => {
  it("flags a tension curve that barely moves", () => {
    const notes = checkFlatTension(
      input({ metrics: { ...healthyMetrics, tensionCurve: [40, 42, 45, 44, 43, 41, 40, 42] } })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].code).toBe("FLAT_TENSION");
  });

  it("flags a curve that climbs but never breaks", () => {
    const notes = checkFlatTension(
      input({ metrics: { ...healthyMetrics, tensionCurve: [10, 20, 30, 40, 50, 60, 70, 80] } })
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].detail).toContain("climbs but never breaks");
  });

  it("accepts a curve with a real rise and fall", () => {
    expect(checkFlatTension(input({ metrics: healthyMetrics }))).toEqual([]);
  });

  it("stays silent when the scene has not been scored", () => {
    expect(checkFlatTension(input())).toEqual([]);
    expect(checkToneDrift(input())).toEqual([]);
  });

  it("quotes the tone target when drift is high", () => {
    const notes = checkToneDrift(input({ metrics: { ...healthyMetrics, toneDrift: 65 } }));
    expect(notes).toHaveLength(1);
    expect(notes[0].detail).toContain("tense, restrained");
    expect(notes[0].title).toContain("65%");
  });
});

describe("runRecommendationChecks", () => {
  it("sorts high priority first and caps the panel", () => {
    const cast = [
      character("ch_maya", "MAYA", "x"),
      character("ch_ravi", "RAVI", "y"),
      character("ch_3", "DEV", "z"),
      character("ch_4", "NOOR", "w"),
    ];
    const result = runRecommendationChecks(
      input({
        characters: cast,
        scene: {
          id: "sc_1",
          title: "Everything wrong",
          text: "They talk.",
          toneTarget: "",
          characterIds: cast.map((c) => c.id),
        },
        transcript: [turn("ch_maya", "One"), turn("ch_maya", "Two"), turn("ch_maya", "Three")],
        metrics: {
          arcCoherence: 20,
          characterConsistency: 30,
          chemistryStrength: 30,
          fragilityRisk: 80,
          engagement: 25,
          toneDrift: 70,
          tensionCurve: [50, 50, 50, 50, 50, 50, 50, 50],
        },
      })
    );

    expect(result.totalCount).toBeGreaterThan(result.items.length);
    expect(result.items).toHaveLength(8);
    expect(result.items[0].priority).toBe("high");
    // Never out of priority order.
    const order = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < result.items.length; i++) {
      expect(order[result.items[i].priority]).toBeGreaterThanOrEqual(
        order[result.items[i - 1].priority]
      );
    }
  });

  it("returns only the never-simulated note for a clean, unsimulated scene", () => {
    const result = runRecommendationChecks(input());
    expect(result.items.map((item) => item.code)).toEqual(["NOT_SIMULATED"]);
  });

  it("produces stable ids across runs so the panel does not reshuffle", () => {
    const first = runRecommendationChecks(input({ metrics: healthyMetrics }));
    const second = runRecommendationChecks(input({ metrics: healthyMetrics }));
    expect(first.items.map((i) => i.id)).toEqual(second.items.map((i) => i.id));
  });
});

describe("latestRunForScene", () => {
  const run = (id: string, sceneId: string, createdAt: string): SimulationRun => ({
    id,
    sceneId,
    transcript: [],
    createdAt,
  });

  it("picks the most recent run for the scene, ignoring other scenes", () => {
    const runs = [
      run("r1", "sc_1", "2026-09-12T10:00:00.000Z"),
      run("r2", "sc_2", "2026-09-12T11:00:00.000Z"),
      run("r3", "sc_1", "2026-09-12T12:00:00.000Z"),
    ];
    expect(latestRunForScene(runs, "sc_1")?.id).toBe("r3");
  });

  it("returns null when the scene has no runs", () => {
    expect(latestRunForScene([], "sc_1")).toBeNull();
  });
});
