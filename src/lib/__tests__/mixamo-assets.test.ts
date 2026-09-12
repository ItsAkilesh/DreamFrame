import { existsSync, readFileSync } from "node:fs";
import { AnimationMixer, Texture, TextureLoader } from "three";
import { FBXLoader } from "three-stdlib";
import { describe, it, expect, vi } from "vitest";
import { prepareMixamoClipForCharacter } from "../animation-retarget";

function load(path: string) {
  const bytes = readFileSync(path);
  return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
}

// These read real Mixamo exports from public/assets/library/, which
// .gitignore excludes as "dropped in locally, not source". Without them the
// suite was red for every teammate and every CI run, which trains people to
// ignore a failing test. Skip instead, and say why.
const CHARACTER_IDS = [
  "0510032b674ce33343c2e058ef52e8c5",
  "06caf212ded22a78500c06ebf372c9bb",
  "08f7e724f32af241e56a9244c2f37b43",
];
const ANIMATION_ID = "00041fd3325430d72c5a947e1171de3b";
const LIBRARY_PRESENT =
  CHARACTER_IDS.every((id) => existsSync(`public/assets/library/characters/${id}.fbx`)) &&
  existsSync(`public/assets/library/animations/${ANIMATION_ID}.fbx`);

if (!LIBRARY_PRESENT) {
  console.warn(
    "mixamo-assets: skipping — public/assets/library/ is gitignored and not present locally."
  );
}

describe.skipIf(!LIBRARY_PRESENT)("real Mixamo FBX playback", () => {
  it.each([
    "0510032b674ce33343c2e058ef52e8c5",
    "06caf212ded22a78500c06ebf372c9bb",
    "08f7e724f32af241e56a9244c2f37b43",
  ])("animates standard and numbered/duplicate rigs: %s", (id) => {
    vi.stubGlobal("window", {URL});
    const textures = vi.spyOn(TextureLoader.prototype, "load").mockReturnValue(new Texture());
    try {
      const target = load(`public/assets/library/characters/${id}.fbx`);
      const source = load("public/assets/library/animations/00041fd3325430d72c5a947e1171de3b.fbx");
      const clip = prepareMixamoClipForCharacter(target, source.animations[0]);
      expect(clip.tracks.length).toBeGreaterThan(40);
      const before = new Map<string, number[]>();
      target.traverse((bone) => before.set(bone.uuid, bone.quaternion.toArray()));
      const mixer = new AnimationMixer(target);
      mixer.clipAction(clip).play();
      mixer.update(0.4);
      let changed = 0;
      target.traverse((bone) => {
        expect(bone.position.toArray().every(Number.isFinite)).toBe(true);
        if (bone.quaternion.toArray().some((value, i) => Math.abs(value - before.get(bone.uuid)![i]) > 0.001)) changed++;
      });
      expect(changed).toBeGreaterThan(10);
      mixer.stopAllAction();
      mixer.uncacheRoot(target);
    } finally { textures.mockRestore(); vi.unstubAllGlobals(); }
  });
});
