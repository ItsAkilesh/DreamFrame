// keyframes.test.ts
// Purpose: The keyframe track is what the 3D viewer plays back, so the
//          sampling (clamping, lerping, shortest-path turns) and the
//          timeline's edit operations are pinned here.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import { resolvePose, specDuration } from "@/render/blocking";
import {
  deleteKeyframe,
  formatTimecode,
  keyframesFor,
  moveKeyframe,
  sampleKeyframeTrack,
  snapTime,
  upsertKeyframe,
} from "@/render/keyframes";
import { PrevisSpecZ, type Keyframe, type PrevisSpec } from "@/schema/previsSpec";
import kitchenRaw from "@/fixtures/kitchen_twohander.json";

const kf = (id: string, time: number, x: number, rotationY = 0): Keyframe => ({
  id,
  characterId: "c1",
  time,
  position: [x, 0, 0],
  rotationY,
});

const kitchen = (): PrevisSpec => PrevisSpecZ.parse(kitchenRaw);

describe("sampleKeyframeTrack", () => {
  it("clamps before the first and after the last keyframe", () => {
    const track = [kf("a", 2, 1), kf("b", 4, 3)];
    expect(sampleKeyframeTrack(track, 0).position[0]).toBe(1);
    expect(sampleKeyframeTrack(track, 99).position[0]).toBe(3);
  });

  it("lerps position between two keyframes", () => {
    const track = [kf("a", 2, 1), kf("b", 4, 3)];
    expect(sampleKeyframeTrack(track, 3).position[0]).toBeCloseTo(2, 6);
  });

  it("turns the short way round across the ±π seam", () => {
    const track = [kf("a", 0, 0, Math.PI - 0.1), kf("b", 1, 0, -Math.PI + 0.1)];
    // The short path is +0.2rad through π, not -6.08rad back through zero.
    expect(sampleKeyframeTrack(track, 0.5).rotationY).toBeCloseTo(Math.PI, 6);
  });

  it("holds a single keyframe for the whole scene", () => {
    const track = [kf("a", 5, 2, 1)];
    expect(sampleKeyframeTrack(track, 0)).toEqual({ position: [2, 0, 0], rotationY: 1 });
    expect(sampleKeyframeTrack(track, 12)).toEqual({ position: [2, 0, 0], rotationY: 1 });
  });
});

describe("edits", () => {
  it("snaps new keyframes onto the playhead grid, sorted by time", () => {
    let spec = kitchen();
    const id = spec.cast[0].id;
    spec = upsertKeyframe(spec, id, 3.02, { position: [1, 0, 1], rotationY: 0 });
    spec = upsertKeyframe(spec, id, 1.0, { position: [0, 0, 0], rotationY: 0 });

    expect(spec.keyframes.map((k) => k.time)).toEqual([1, 3]);
  });

  it("overwrites rather than stacks a keyframe on the same instant", () => {
    let spec = kitchen();
    const id = spec.cast[0].id;
    spec = upsertKeyframe(spec, id, 2, { position: [1, 0, 1], rotationY: 0 });
    spec = upsertKeyframe(spec, id, 2.01, { position: [2, 0, 2], rotationY: 0 });

    expect(keyframesFor(spec, id)).toHaveLength(1);
    expect(keyframesFor(spec, id)[0].position).toEqual([2, 0, 2]);
  });

  it("keeps each character's track separate", () => {
    let spec = kitchen();
    const [a, b] = spec.cast;
    spec = upsertKeyframe(spec, a.id, 2, { position: [1, 0, 0], rotationY: 0 });
    spec = upsertKeyframe(spec, b.id, 2, { position: [-1, 0, 0], rotationY: 0 });

    expect(keyframesFor(spec, a.id)).toHaveLength(1);
    expect(keyframesFor(spec, b.id)).toHaveLength(1);
  });

  it("retimes a keyframe, replacing any sibling it lands on", () => {
    let spec = kitchen();
    const id = spec.cast[0].id;
    spec = upsertKeyframe(spec, id, 1, { position: [1, 0, 0], rotationY: 0 });
    spec = upsertKeyframe(spec, id, 4, { position: [4, 0, 0], rotationY: 0 });
    const moving = keyframesFor(spec, id)[1];

    spec = moveKeyframe(spec, moving.id, 1);

    expect(keyframesFor(spec, id)).toHaveLength(1);
    expect(keyframesFor(spec, id)[0].position).toEqual([4, 0, 0]);
  });

  it("deletes by id and leaves the rest alone", () => {
    let spec = kitchen();
    const id = spec.cast[0].id;
    spec = upsertKeyframe(spec, id, 1, { position: [1, 0, 0], rotationY: 0 });
    spec = upsertKeyframe(spec, id, 2, { position: [2, 0, 0], rotationY: 0 });

    spec = deleteKeyframe(spec, keyframesFor(spec, id)[0].id);

    expect(keyframesFor(spec, id).map((k) => k.time)).toEqual([2]);
  });
});

describe("playback integration", () => {
  it("a keyframed character is driven by its track, an unkeyframed one is not", () => {
    const base = kitchen();
    const [a, b] = base.cast;
    const spec = upsertKeyframe(
      upsertKeyframe(base, a.id, 0, { position: [0, 0, 0], rotationY: 0 }),
      a.id,
      2,
      { position: [2, 0, 0], rotationY: 0 }
    );

    expect(resolvePose(spec, a.id, 1).position[0]).toBeCloseTo(1, 6);
    expect(resolvePose(spec, b.id, 1)).toEqual(resolvePose(base, b.id, 1));
  });

  it("extends the scene duration when a keyframe sits past the last beat", () => {
    const base = kitchen();
    const past = specDuration(base) + 5;
    const spec = upsertKeyframe(base, base.cast[0].id, past, { position: [0, 0, 0], rotationY: 0 });

    expect(specDuration(spec)).toBeCloseTo(past, 6);
  });

  it("specs written before keyframes existed still parse, with an empty track", () => {
    expect(kitchen().keyframes).toEqual([]);
  });
});

describe("timecode", () => {
  it("formats as m:ss.cs", () => {
    expect(formatTimecode(0)).toBe("0:00.00");
    expect(formatTimecode(4.25)).toBe("0:04.25");
    expect(formatTimecode(65.5)).toBe("1:05.50");
  });

  it("snaps to the 50ms grid and never goes negative", () => {
    expect(snapTime(1.02)).toBeCloseTo(1, 6);
    expect(snapTime(1.04)).toBeCloseTo(1.05, 6);
    expect(snapTime(-3)).toBe(0);
  });
});
