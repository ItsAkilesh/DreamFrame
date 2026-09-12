import { describe, expect, it } from "vitest";

import { checkSizeMonotony } from "@/analyze/checks/sizeMonotony";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkSizeMonotony", () => {
  it("office: exactly 1 note, beats b_003-b_006", () => {
    const notes = checkSizeMonotony(PrevisSpecZ.parse(officeRaw));
    expect(notes).toHaveLength(1);
    expect(notes[0].beatIds).toEqual(["b_003", "b_004", "b_005", "b_006"]);
    expect(notes[0].severity).toBe("warning");
  });

  it("kitchen: zero notes", () => {
    const notes = checkSizeMonotony(PrevisSpecZ.parse(kitchenRaw));
    expect(notes).toHaveLength(0);
  });
});
