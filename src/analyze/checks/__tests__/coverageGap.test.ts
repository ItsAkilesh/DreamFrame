import { describe, expect, it } from "vitest";

import { checkCoverageGap } from "@/analyze/checks/coverageGap";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkCoverageGap", () => {
  it("office: exactly 1 note, character ch_sam", () => {
    const notes = checkCoverageGap(PrevisSpecZ.parse(officeRaw));
    expect(notes).toHaveLength(1);
    expect(notes[0].characterIds).toEqual(["ch_sam"]);
    expect(notes[0].severity).toBe("error");
  });

  it("kitchen: zero notes", () => {
    const notes = checkCoverageGap(PrevisSpecZ.parse(kitchenRaw));
    expect(notes).toHaveLength(0);
  });
});
