import { describe, expect, it } from "vitest";

import { checkNoseRoom } from "@/analyze/checks/noseRoom";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkNoseRoom", () => {
  it("office: zero notes", () => {
    expect(checkNoseRoom(PrevisSpecZ.parse(officeRaw))).toHaveLength(0);
  });

  it("kitchen: zero notes", () => {
    expect(checkNoseRoom(PrevisSpecZ.parse(kitchenRaw))).toHaveLength(0);
  });
});
