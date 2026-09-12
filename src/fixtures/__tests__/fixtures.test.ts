// fixtures.test.ts
// Purpose: Both fixtures must validate against PrevisSpecZ. The geometric
//          verification of the office fixture's three deliberate flaws
//          (§3.12) now lives with the real analyzer checks in
//          src/analyze/checks/__tests__/ — this file no longer duplicates
//          that math against a hand-rolled copy of the formulas.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

describe("fixtures validate against PrevisSpecZ", () => {
  it("kitchen_twohander.json parses", () => {
    expect(() => PrevisSpecZ.parse(kitchenRaw)).not.toThrow();
  });

  it("office_threehander.json parses", () => {
    expect(() => PrevisSpecZ.parse(officeRaw)).not.toThrow();
  });
});
