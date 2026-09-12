import { describe, expect, it } from "vitest";

import { checkEyeline } from "@/analyze/checks/eyeline";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkEyeline", () => {
  it("office: zero notes", () => {
    expect(checkEyeline(PrevisSpecZ.parse(officeRaw))).toHaveLength(0);
  });

  it("kitchen: zero notes", () => {
    expect(checkEyeline(PrevisSpecZ.parse(kitchenRaw))).toHaveLength(0);
  });
});
