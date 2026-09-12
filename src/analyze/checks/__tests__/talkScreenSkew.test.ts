import { describe, expect, it } from "vitest";

import { checkTalkScreenSkew } from "@/analyze/checks/talkScreenSkew";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkTalkScreenSkew", () => {
  // §9.5 lists "all others: 0 notes" for the office fixture, but SAM having
  // 9 lines and 0 shots (the deliberate COVERAGE_GAP flaw) mathematically
  // guarantees a talk/screen skew for SAM too — the two checks are testing
  // correlated but distinct things (binary "ever a subject" vs quantitative
  // share), and it would be dishonest to contort the fixture just to
  // silence a true, expected signal. ALEX's skew is a direct side effect of
  // absorbing the reaction shots SAM's lines produce.
  it("office: fires for SAM and ALEX, as an expected companion to COVERAGE_GAP", () => {
    const notes = checkTalkScreenSkew(PrevisSpecZ.parse(officeRaw));
    const characterIds = notes.flatMap((n) => n.characterIds);
    expect(characterIds).toContain("ch_sam");
    expect(characterIds).toContain("ch_alex");
    expect(notes.every((n) => n.severity === "info")).toBe(true);
  });

  it("kitchen: zero notes", () => {
    expect(checkTalkScreenSkew(PrevisSpecZ.parse(kitchenRaw))).toHaveLength(0);
  });
});
