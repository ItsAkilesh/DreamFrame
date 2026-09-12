import { describe, expect, it } from "vitest";

import { checkHeadroom } from "@/analyze/checks/headroom";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkHeadroom", () => {
  it("office: zero notes", () => {
    expect(checkHeadroom(PrevisSpecZ.parse(officeRaw))).toHaveLength(0);
  });

  it("kitchen: zero notes", () => {
    expect(checkHeadroom(PrevisSpecZ.parse(kitchenRaw))).toHaveLength(0);
  });
});
