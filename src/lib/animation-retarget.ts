// animation-retarget.ts
// Purpose: Retarget the shared Universal Animation Library clips (rigged to
//          Epic/UE's "Mannequin" skeleton — bone names like "pelvis",
//          "upperarm_l") onto an uploaded character's Mixamo-rigged skeleton
//          (bone names like "mixamorigLeftArm"), via three.js's own
//          SkeletonUtils.retargetClip. The two rigs use different bone
//          names AND a different hierarchy depth in a few spots (Mixamo has
//          no separate hand/foot "leaf" end bones for most digits), so this
//          is a real bone-name mapping, not a format conversion.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { AnimationClip } from "three";
import type { Object3D, SkinnedMesh } from "three";

// SkeletonUtils.retargetClip keys `names` by the TARGET's bone name and maps
// to the SOURCE's bone name for each — confirmed by reading retarget()'s
// implementation, not just its (ambiguous) doc comment. `options.hip` is
// likewise the SOURCE's hip/pelvis bone name, used to decide which bone's
// translation (root motion) survives retargeting.
export const MIXAMO_TO_UAL_BONE_MAP: Record<string, string> = {
  "mixamorigHips": "pelvis",
  "mixamorigSpine": "spine_01",
  "mixamorigSpine1": "spine_02",
  "mixamorigSpine2": "spine_03",
  "mixamorigNeck": "neck_01",
  "mixamorigHead": "Head",
  "mixamorigLeftShoulder": "clavicle_l",
  "mixamorigLeftArm": "upperarm_l",
  "mixamorigLeftForeArm": "lowerarm_l",
  "mixamorigLeftHand": "hand_l",
  "mixamorigLeftHandThumb1": "thumb_01_l",
  "mixamorigLeftHandThumb2": "thumb_02_l",
  "mixamorigLeftHandThumb3": "thumb_03_l",
  "mixamorigLeftHandThumb4": "thumb_04_leaf_l",
  "mixamorigLeftHandIndex1": "index_01_l",
  "mixamorigLeftHandIndex2": "index_02_l",
  "mixamorigLeftHandIndex3": "index_03_l",
  "mixamorigLeftHandIndex4": "index_04_leaf_l",
  "mixamorigLeftHandMiddle1": "middle_01_l",
  "mixamorigLeftHandMiddle2": "middle_02_l",
  "mixamorigLeftHandMiddle3": "middle_03_l",
  "mixamorigLeftHandMiddle4": "middle_04_leaf_l",
  "mixamorigLeftHandRing1": "ring_01_l",
  "mixamorigLeftHandRing2": "ring_02_l",
  "mixamorigLeftHandRing3": "ring_03_l",
  "mixamorigLeftHandRing4": "ring_04_leaf_l",
  "mixamorigLeftHandPinky1": "pinky_01_l",
  "mixamorigLeftHandPinky2": "pinky_02_l",
  "mixamorigLeftHandPinky3": "pinky_03_l",
  "mixamorigLeftHandPinky4": "pinky_04_leaf_l",
  "mixamorigRightShoulder": "clavicle_r",
  "mixamorigRightArm": "upperarm_r",
  "mixamorigRightForeArm": "lowerarm_r",
  "mixamorigRightHand": "hand_r",
  "mixamorigRightHandThumb1": "thumb_01_r",
  "mixamorigRightHandThumb2": "thumb_02_r",
  "mixamorigRightHandThumb3": "thumb_03_r",
  "mixamorigRightHandThumb4": "thumb_04_leaf_r",
  "mixamorigRightHandIndex1": "index_01_r",
  "mixamorigRightHandIndex2": "index_02_r",
  "mixamorigRightHandIndex3": "index_03_r",
  "mixamorigRightHandIndex4": "index_04_leaf_r",
  "mixamorigRightHandMiddle1": "middle_01_r",
  "mixamorigRightHandMiddle2": "middle_02_r",
  "mixamorigRightHandMiddle3": "middle_03_r",
  "mixamorigRightHandMiddle4": "middle_04_leaf_r",
  "mixamorigRightHandRing1": "ring_01_r",
  "mixamorigRightHandRing2": "ring_02_r",
  "mixamorigRightHandRing3": "ring_03_r",
  "mixamorigRightHandRing4": "ring_04_leaf_r",
  "mixamorigRightHandPinky1": "pinky_01_r",
  "mixamorigRightHandPinky2": "pinky_02_r",
  "mixamorigRightHandPinky3": "pinky_03_r",
  "mixamorigRightHandPinky4": "pinky_04_leaf_r",
  "mixamorigLeftUpLeg": "thigh_l",
  "mixamorigLeftLeg": "calf_l",
  "mixamorigLeftFoot": "foot_l",
  "mixamorigLeftToeBase": "ball_l",
  "mixamorigRightUpLeg": "thigh_r",
  "mixamorigRightLeg": "calf_r",
  "mixamorigRightFoot": "foot_r",
  "mixamorigRightToeBase": "ball_r",
  // mixamorigHeadTop_End, *_End, *_leaf bones (plus any facial-rig extras
  // like mixamorigLeftEye/RightEye some exports include) have no UAL
  // counterpart to read a pose from and are cosmetic — left unmapped, which
  // SkeletonUtils treats as "leave this bone's local transform alone".
};

// The UAL rig's own hip bone, used by SkeletonUtils to decide which bone's
// translation (root motion) survives retargeting onto the target. This app
// uses the plain (non "_RM") library variant deliberately: it keeps
// locomotion on a separate, unskinned "root" bone that isn't in the map
// above and so gets dropped, leaving only the pelvis's local bob/sway — a
// walk cycle that loops in place instead of carrying the character forward
// out of a fixed preview camera. The "_RM" variant (root motion baked into
// pelvis) is kept alongside it for a future timeline/scene use, where actual
// traversal across a room is exactly what's wanted.
export const UAL_HIP_BONE_NAME = "pelvis";

// Exported so callers that need to build an AnimationMixer can bind it to
// this exact object — SkeletonUtils' retargeted tracks use a `.bones[name]`
// path, which three.js's PropertyBinding resolves only against an object
// that itself has `.skeleton` (i.e. the SkinnedMesh), not an ancestor Group.
//
// A character model is commonly split into several skinned sub-meshes (body,
// shoes, hair, ...), each referencing only the bones it actually deforms
// against — e.g. shoes might skin to just 8 leg/foot bones out of the full
// ~65. They all share the same underlying Bone instances though, so driving
// the mixer via whichever mesh has the FULLEST bone list still moves every
// sub-mesh correctly; picking an arbitrary (e.g. the first-encountered)
// SkinnedMesh risks binding to a near-empty accessory skeleton instead.
export function findSkinnedMesh(object: Object3D): SkinnedMesh | null {
  let best: SkinnedMesh | null = null;
  object.traverse((child) => {
    const mesh = child as SkinnedMesh;
    if (mesh.isSkinnedMesh && (!best || mesh.skeleton.bones.length > best.skeleton.bones.length)) {
      best = mesh;
    }
  });
  return best;
}

// AnimationMixer.stopAllAction() stops time advancement but deliberately
// leaves every property at its last sampled value. For a skinned character
// that means selecting "Bind pose" after an animation would otherwise leave
// the mesh in the old (possibly very exaggerated) pose. Resetting the
// skeleton restores its bind transforms before a new clip starts or playback
// is cleared.
export function resetCharacterPose(object: Object3D): void {
  const mesh = findSkinnedMesh(object);
  if (!mesh) return;

  mesh.skeleton.pose();
  mesh.updateMatrixWorld(true);
}

// The Hugging Face clips are Mixamo FBXs, so their keyframes already use the
// same Mixamo skeleton as the library characters. Unlike UAL's Unreal-rigged
// clips, these must not be retargeted: retargeting is what distorted the mesh.
// We only rewrite the track paths to the target mesh's exact bone names, which
// accounts for FBXLoader removing `:` while GLTFLoader preserves it.
export function prepareMixamoClipForCharacter(targetRoot: Object3D, clip: AnimationClip): AnimationClip {
  const mesh = findSkinnedMesh(targetRoot);
  if (!mesh) {
    throw new RetargetError("This model has no skeleton to animate (not a rigged/skinned mesh).");
  }

  const targetBones = new Map<string, Object3D[]>();
  targetRoot.traverse((bone) => {
    if (!(bone as Object3D & { isBone?: boolean }).isBone) return;
    const name = canonicalBoneName(bone.name);
    targetBones.set(name, [...(targetBones.get(name) ?? []), bone]);
  });
  const sourceNames = new Set(clip.tracks.map((track) => canonicalBoneName(track.name.split(".")[0])));
  if (!CORE_BONES.every((name) => targetBones.has(name) && sourceNames.has(name))) {
    throw new RetargetError("This character and animation do not share a complete humanoid skeleton.");
  }
  const tracks = clip.tracks.flatMap((track) => {
    const match = /^([^.]+)\.(position|quaternion)$/.exec(track.name);
    const sourceBoneName = match?.[1];
    const property = match?.[2];
    const bones = sourceBoneName && targetBones.get(canonicalBoneName(sourceBoneName));
    if (!bones || property !== "quaternion") return [];
    // Keep each character's bone lengths and hip height. Absolute translations
    // from a different character collapse/stretch rigs or put their feet below ground.
    return bones.map((bone) => {
      const targetTrack = track.clone();
      targetTrack.name = `${bone.uuid}.quaternion`;
      return targetTrack;
    });
  });

  if (tracks.length === 0) {
    throw new RetargetError("This Mixamo animation has no bone tracks compatible with the selected character.");
  }

  return new AnimationClip(clip.name, clip.duration, tracks);
}

export function canonicalBoneName(name: string): string {
  return name.replace(/^mixamorig\d*:?/i, "").toLowerCase();
}

const CORE_BONES = ["hips", "spine", "head", "leftarm", "rightarm", "leftupleg", "rightupleg"];

export function supportsMixamoAnimations(root: Object3D): boolean {
  const names = new Set<string>();
  root.traverse((bone) => {
    if ((bone as Object3D & { isBone?: boolean }).isBone) names.add(canonicalBoneName(bone.name));
  });
  return CORE_BONES.every((name) => names.has(name));
}

export class RetargetError extends Error {}

// Retargets one Universal Animation Library clip (as loaded from
// UAL1_Standard_RM.glb) onto `targetRoot`'s own skeleton, returning a new
// AnimationClip whose track names match the target's bones — directly
// playable via `new AnimationMixer(targetRoot).clipAction(clip)`.
export function retargetClipToCharacter(
  targetRoot: Object3D,
  sourceRoot: Object3D,
  clip: AnimationClip
): AnimationClip {
  const targetMesh = findSkinnedMesh(targetRoot);
  const sourceMesh = findSkinnedMesh(sourceRoot);
  if (!targetMesh) {
    throw new RetargetError("This model has no skeleton to animate (not a rigged/skinned mesh).");
  }
  if (!sourceMesh) {
    throw new RetargetError("The animation library file has no skeleton to read poses from.");
  }

  const retargeted = SkeletonUtils.retargetClip(targetMesh, sourceMesh, clip, {
    // Not a plain `names` lookup: FBXLoader strips the colon out of
    // "mixamorig:Hips" (runtime bone name becomes "mixamorigHips"), but
    // GLTFLoader has no reason to and would leave it in for a Mixamo rig
    // exported as glTF instead. Normalizing here means the same map works
    // for either loader's output rather than silently matching nothing.
    getBoneName: (bone) => MIXAMO_TO_UAL_BONE_MAP[bone.name.replace(/^mixamorig:/, "mixamorig")],
    hip: UAL_HIP_BONE_NAME,
    useFirstFramePosition: true,
  });
  retargeted.name = clip.name;
  return retargeted;
}
