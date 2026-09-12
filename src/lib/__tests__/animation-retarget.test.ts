import {
  AnimationClip,
  Bone,
  BoxGeometry,
  MeshBasicMaterial,
  Object3D,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
} from "three";
import { describe, expect, it } from "vitest";

import { prepareMixamoClipForCharacter, resetCharacterPose } from "@/lib/animation-retarget";

describe("resetCharacterPose", () => {
  it("restores the bind pose after an animation has changed a bone", () => {
    const root = new Object3D();
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial());
    const hip = new Bone();
    hip.name = "mixamorigHips";
    hip.position.set(0, 1, 0);
    mesh.add(hip);
    mesh.bind(new Skeleton([hip]));
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.skeleton.calculateInverses();

    hip.position.set(0, 12, 0);
    root.updateMatrixWorld(true);

    resetCharacterPose(root);

    expect(hip.position.x).toBeCloseTo(0);
    expect(hip.position.y).toBeCloseTo(1);
    expect(hip.position.z).toBeCloseTo(0);
  });

  it("rejects incomplete skeletons instead of offering broken playback", () => {
    const root = new Object3D();
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial());
    const hip = new Bone();
    hip.name = "mixamorig:Hips";
    mesh.add(hip);
    mesh.bind(new Skeleton([hip]));
    root.add(mesh);

    const source = new AnimationClip("idle", 1, [
      new QuaternionKeyframeTrack("mixamorigHips.quaternion", [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    ]);

    expect(() => prepareMixamoClipForCharacter(root, source)).toThrow("complete humanoid skeleton");
  });
});
