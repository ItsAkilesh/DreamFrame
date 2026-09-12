import { describe, expect, it } from "vitest";
import { ELEVENLABS_VOICES, voiceIdForCharacter } from "@/lib/voice/voices";

describe("voiceIdForCharacter", () => {
  it("is deterministic for the same character id", () => {
    expect(voiceIdForCharacter("demo-ch-alex")).toBe(voiceIdForCharacter("demo-ch-alex"));
  });

  it("always returns one of the curated voice ids", () => {
    const validIds = new Set<string>(ELEVENLABS_VOICES.map((v) => v.id));
    for (const id of ["a", "b", "demo-ch-alex", "demo-ch-jordan", "", "🎭", "x".repeat(50)]) {
      expect(validIds.has(voiceIdForCharacter(id))).toBe(true);
    }
  });

  it("spreads different character ids across more than one voice", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `character-${i}`);
    const assigned = new Set(ids.map(voiceIdForCharacter));
    expect(assigned.size).toBeGreaterThan(1);
  });
});
