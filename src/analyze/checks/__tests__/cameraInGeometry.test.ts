import { describe, expect, it } from "vitest";

import { checkCameraInGeometry } from "@/analyze/checks/cameraInGeometry";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("checkCameraInGeometry", () => {
  it("office: zero notes", () => {
    expect(checkCameraInGeometry(PrevisSpecZ.parse(officeRaw))).toHaveLength(0);
  });

  it("kitchen: zero notes", () => {
    expect(checkCameraInGeometry(PrevisSpecZ.parse(kitchenRaw))).toHaveLength(0);
  });
});
