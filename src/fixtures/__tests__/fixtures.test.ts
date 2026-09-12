// fixtures.test.ts
// Purpose: Both fixtures must validate against PrevisSpecZ, and the office
//          fixture's three deliberate flaws (§3.12) must be geometrically
//          real, not just labelled — verified here with the same formulas
//          §9.2 documents for the analyzer, which does not exist yet
//          (M4). This is a sanity check on the fixtures themselves, not a
//          test of the analyzer.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { PrevisSpecZ, vFov, type PrevisSpec } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";
import officeRaw from "@/fixtures/office_threehander.json";

type Vec3 = [number, number, number];
const HEAD_Y = { standing: 1.68, seated: 1.22 } as const;

function sideOfAxis(a: Vec3, b: Vec3, p: Vec3): number {
  const ax = b[0] - a[0];
  const az = b[2] - a[2];
  const px = p[0] - a[0];
  const pz = p[2] - a[2];
  return ax * pz - az * px;
}

function headPos(spec: PrevisSpec, charId: string): Vec3 {
  const c = spec.cast.find((ch) => ch.id === charId);
  if (!c) throw new Error(`no such character ${charId}`);
  const [x, , z] = c.position;
  return [x, HEAD_Y[c.posture], z];
}

function distance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function framedHeight(spec: PrevisSpec, cameraId: string, subjectId: string): number {
  const cam = spec.cameras.find((c) => c.id === cameraId);
  if (!cam) throw new Error(`no such camera ${cameraId}`);
  const d = distance(cam.position, headPos(spec, subjectId));
  return 2 * d * Math.tan(vFov(cam.lens_mm) / 2);
}

function sizeOf(framedHeightM: number): string {
  if (framedHeightM < 0.35) return "ECU";
  if (framedHeightM < 0.6) return "CU";
  if (framedHeightM < 1.0) return "MCU";
  if (framedHeightM < 1.6) return "MS";
  if (framedHeightM < 2.4) return "MWS";
  return "WS";
}

describe("fixtures validate against PrevisSpecZ", () => {
  it("kitchen_twohander.json parses", () => {
    expect(() => PrevisSpecZ.parse(kitchenRaw)).not.toThrow();
  });

  it("office_threehander.json parses", () => {
    expect(() => PrevisSpecZ.parse(officeRaw)).not.toThrow();
  });
});

describe("office_threehander.json has the three deliberate, geometrically real flaws", () => {
  const office = PrevisSpecZ.parse(officeRaw);
  const beat = (id: string) => office.beats.find((b) => b.id === id)!;

  it("LINE_CROSS: beats b_007 -> b_008 cross the alex/jordan axis", () => {
    const b7 = beat("b_007");
    const b8 = beat("b_008");
    const cam7 = office.cameras.find((c) => c.id === b7.shot.cameraId)!;
    const cam8 = office.cameras.find((c) => c.id === b8.shot.cameraId)!;
    const alex = office.cast.find((c) => c.id === "ch_alex")!.position as Vec3;
    const jordan = office.cast.find((c) => c.id === "ch_jordan")!.position as Vec3;

    const s1 = sideOfAxis(alex, jordan, cam7.position);
    const s2 = sideOfAxis(alex, jordan, cam8.position);

    expect(Math.sign(s1)).not.toBe(Math.sign(s2));
    expect(Math.abs(s1)).toBeGreaterThan(0.15);
    expect(Math.abs(s2)).toBeGreaterThan(0.15);
  });

  it("SIZE_MONOTONY: beats b_003-b_006 compute to an identical size, and neither neighbour matches", () => {
    const run = ["b_003", "b_004", "b_005", "b_006"].map((id) => {
      const b = beat(id);
      return sizeOf(framedHeight(office, b.shot.cameraId, b.shot.subjectId));
    });
    expect(new Set(run).size).toBe(1);

    const before = beat("b_002");
    const after = beat("b_007");
    const beforeSize = sizeOf(framedHeight(office, before.shot.cameraId, before.shot.subjectId));
    const afterSize = sizeOf(framedHeight(office, after.shot.cameraId, after.shot.subjectId));
    expect(beforeSize).not.toBe(run[0]);
    expect(afterSize).not.toBe(run[0]);
  });

  it("COVERAGE_GAP: SAM has >= 2 lines and is never a shot subject", () => {
    const samLines = office.beats.filter((b) => b.line?.characterId === "ch_sam").length;
    const samAsSubject = office.beats.filter((b) => b.shot.subjectId === "ch_sam").length;
    expect(samLines).toBeGreaterThanOrEqual(2);
    expect(samAsSubject).toBe(0);
  });
});

describe("kitchen_twohander.json does not trip the same two geometric flaws", () => {
  const kitchen = PrevisSpecZ.parse(kitchenRaw);

  it("has no run of >= 4 consecutive beats with an identical computed size", () => {
    const sizes = kitchen.beats.map((b) =>
      sizeOf(framedHeight(kitchen, b.shot.cameraId, b.shot.subjectId))
    );
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < sizes.length; i++) {
      run = sizes[i] === sizes[i - 1] ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThan(4);
  });
});
