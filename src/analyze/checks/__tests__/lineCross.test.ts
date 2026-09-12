import { describe, expect, it } from "vitest";

import { checkLineCross } from "@/analyze/checks/lineCross";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkLineCross", () => {
  it("office: exactly 1 note, beats b_007 -> b_008", () => {
    const notes = checkLineCross(PrevisSpecZ.parse(officeRaw));
    expect(notes).toHaveLength(1);
    expect(notes[0].beatIds).toEqual(["b_007", "b_008"]);
    expect(notes[0].severity).toBe("error");
  });

  it("kitchen: zero notes", () => {
    const notes = checkLineCross(PrevisSpecZ.parse(kitchenRaw));
    expect(notes).toHaveLength(0);
  });
});
