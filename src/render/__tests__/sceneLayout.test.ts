import { describe, expect, it } from "vitest";

import { constrainToLayout, rectangularLayout, sceneCalibrationFor } from "@/render/sceneLayout";

describe("scene layout", () => {
  it("uses the production set's metre calibration", () => {
    const calibration = sceneCalibrationFor("/assets/library/scenes/1789216497646-bc86c427.glb");
    expect(calibration?.rawScale).toBe(1);
    expect(calibration?.layout.footprint).toEqual({ width: 8.3, depth: 6.5 });
  });

  it("keeps the billiards cast around the pool table", () => {
    const calibration = sceneCalibrationFor("/assets/library/scenes/1789230326715-15ac820d.glb")!;
    expect(calibration.layout.spawnPoints).toHaveLength(6);
    for (const point of calibration.layout.spawnPoints!) {
      expect(constrainToLayout(calibration.layout, ...point)).toEqual(point);
    }
  });

  it("keeps an actor inside the walls", () => {
    expect(constrainToLayout(rectangularLayout({ width: 8, depth: 6 }), 20, -20)).toEqual([3.48, -2.48]);
  });

  it("projects an actor out of fixed furniture", () => {
    const layout = sceneCalibrationFor("1789216497646-bc86c427.glb")!.layout;
    const [x, z] = constrainToLayout(layout, 0, -1);
    expect(x === 0 && z === -1).toBe(false);
    const counter = layout.obstacles.find((obstacle) => obstacle.id === "counter")!;
    const insideCounter = x > counter.minX - 0.32 && x < counter.maxX + 0.32 &&
      z > counter.minZ - 0.32 && z < counter.maxZ + 0.32;
    expect(insideCounter).toBe(false);
    expect(x).toBeGreaterThanOrEqual(layout.bounds.minX + 0.32);
    expect(x).toBeLessThanOrEqual(layout.bounds.maxX - 0.32);
    expect(z).toBeGreaterThanOrEqual(layout.bounds.minZ + 0.32);
    expect(z).toBeLessThanOrEqual(layout.bounds.maxZ - 0.32);
  });
});
