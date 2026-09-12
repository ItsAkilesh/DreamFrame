import { describe, expect, it } from "vitest";

import { checkOcclusion } from "@/analyze/checks/occlusion";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkOcclusion", () => {
  it("office: zero notes", () => {
    expect(checkOcclusion(PrevisSpecZ.parse(officeRaw))).toHaveLength(0);
  });

  it("kitchen: zero notes", () => {
    expect(checkOcclusion(PrevisSpecZ.parse(kitchenRaw))).toHaveLength(0);
  });
});
