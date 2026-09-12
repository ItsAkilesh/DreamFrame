import { describe, expect, it } from "vitest";

import { runAnalyzer } from "@/analyze/index";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("runAnalyzer", () => {
  it("office: sorts errors before warnings before info", () => {
    const { notes } = runAnalyzer(PrevisSpecZ.parse(officeRaw));
    const severityRank = { error: 0, warning: 1, info: 2 };
    for (let i = 1; i < notes.length; i++) {
      expect(severityRank[notes[i].severity]).toBeGreaterThanOrEqual(severityRank[notes[i - 1].severity]);
    }
  });

  it("kitchen: a clean scene produces zero notes", () => {
    const { notes, totalCount } = runAnalyzer(PrevisSpecZ.parse(kitchenRaw));
    expect(notes).toHaveLength(0);
    expect(totalCount).toBe(0);
  });
});
