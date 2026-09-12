import { describe, it, expect } from "vitest";

import { activeBeat, animationForCharacterAt, pickAnimationFor } from "../animationMap";
import type { PrevisSpec } from "@/schema/previsSpec";

const LIBRARY = [
  { id: "a1", name: "Angry Gesture" },
  { id: "a2", name: "Crossing Arms" },
  { id: "a3", name: "Talking" },
  { id: "a4", name: "Sad Idle" },
  { id: "a5", name: "Unnamed motion · 0fa1" },
];

describe("pickAnimationFor", () => {
  it("maps an emotion to a matching clip label", () => {
    expect(pickAnimationFor("controlled anger", LIBRARY)?.id).toBe("a1");
    expect(pickAnimationFor("guarded", LIBRARY)?.id).toBe("a2");
    expect(pickAnimationFor("quietly hurt", LIBRARY)?.id).toBe("a4");
  });

  it("falls back to a talking cycle for an unrecognised emotion", () => {
    expect(pickAnimationFor("wistful", LIBRARY)?.id).toBe("a3");
  });

  it("returns null rather than guessing when the library is empty", () => {
    expect(pickAnimationFor("furious", [])).toBeNull();
  });

  it("is deterministic — the same emotion always picks the same clip", () => {
    const runs = Array.from({ length: 5 }, () => pickAnimationFor("rage", LIBRARY)?.id);
    expect(new Set(runs).size).toBe(1);
  });
});

const spec = {
  beats: [
    { id: "b1", startTime: 0, duration: 2, line: { characterId: "ch_a", text: "x", emotion: "furious" } },
    { id: "b2", startTime: 2, duration: 2, line: { characterId: "ch_b", text: "y", emotion: "guarded" } },
    { id: "b3", startTime: 4, duration: 2, line: null },
  ],
} as unknown as PrevisSpec;

describe("activeBeat", () => {
  it("finds the beat covering a time, and holds the last one past the end", () => {
    expect(activeBeat(spec, 0)?.id).toBe("b1");
    expect(activeBeat(spec, 2.5)?.id).toBe("b2");
    expect(activeBeat(spec, 99)?.id).toBe("b3");
  });
});

describe("animationForCharacterAt", () => {
  it("animates only the character who is speaking", () => {
    expect(animationForCharacterAt(spec, "ch_a", 1, LIBRARY)?.id).toBe("a1");
    expect(animationForCharacterAt(spec, "ch_b", 1, LIBRARY)).toBeNull();
    expect(animationForCharacterAt(spec, "ch_b", 3, LIBRARY)?.id).toBe("a2");
  });

  it("returns null on an action-only beat, so everyone idles", () => {
    expect(animationForCharacterAt(spec, "ch_a", 5, LIBRARY)).toBeNull();
  });
});
