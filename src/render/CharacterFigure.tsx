// CharacterFigure.tsx
// Purpose: Renders one cast member in the previs Stage — the character's own
//          uploaded/library-picked 3D model if they have one, normalized to
//          a consistent real-world height and grounded/centered so upload
//          scale/origin quirks don't matter, or the placeholder capsule if
//          they don't (or the model fails to load). The capsule is not a
//          fallback bolted on after the fact: every figure is positioned and
//          rotated by the same wrapping group, so swapping model <-> capsule
//          never changes where a character actually stands.
//
//          Optionally plays one clip from the asset library's "animation"
//          category (animationAsset) — these are same-rig Mixamo exports, so
//          they're prepared via prepareMixamoClipForCharacter, not the
//          cross-skeleton retargetClipToCharacter used for the Universal
//          Animation Library. See src/lib/animation-retarget.ts.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX, useGLTF } from "@react-three/drei";
import { AnimationMixer, Box3, Group, Vector3, type AnimationClip, type Object3D } from "three";

import { isPreviewableCharacterModelFormat } from "@/lib/character-model-formats";
import { prepareMixamoClipForCharacter, resetCharacterPose } from "@/lib/animation-retarget";

// Matches the capsule's own height, so a character doesn't visibly change
// size when their model finishes loading in over the capsule, or fails and
// falls back to it.
const TARGET_HEIGHT = 1.75;

export interface StageCharacterModelAsset {
  url: string;
  format: string;
}

interface CharacterFigureProps {
  modelAsset?: StageCharacterModelAsset | null;
  // The asset library's "animation" category only ever contains FBX exports
  // (see scripts/label-animations.mjs) — a non-FBX value here is simply
  // never played, same as any other clip this character's skeleton turns out
  // not to support.
  animationAsset?: StageCharacterModelAsset | null;
  position: [number, number, number];
  rotationY: number;
  color: string;
  highlighted: boolean;
}

function NormalizedCharacterModel({ object, clip }: { object: Object3D; clip: AnimationClip | null }) {
  const [group] = useState(() => new Group());
  const mixerRef = useRef<AnimationMixer | null>(null);

  useEffect(() => {
    group.add(object);
    object.position.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    object.updateWorldMatrix(true, true);

    const rawSize = new Box3().setFromObject(object).getSize(new Vector3());
    const scale = rawSize.y > 0 ? TARGET_HEIGHT / rawSize.y : 1;
    object.scale.setScalar(scale);
    object.updateWorldMatrix(true, true);

    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;

    return () => {
      group.remove(object);
    };
  }, [object, group]);

  useEffect(() => {
    resetCharacterPose(object);
    if (!clip) return;

    try {
      const prepared = prepareMixamoClipForCharacter(object, clip);
      const mixer = new AnimationMixer(object);
      mixerRef.current = mixer;
      mixer.clipAction(prepared).play();
    } catch (error) {
      console.warn("Stage: could not play this animation on this character", error);
    }

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [object, clip]);

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta);
  });

  return <primitive object={group} />;
}

function FbxAnimationClip({
  url,
  children,
}: {
  url: string;
  children: (clip: AnimationClip | null) => ReactNode;
}) {
  const fbx = useFBX(url);
  return <>{children(fbx.animations[0] ?? null)}</>;
}

function GltfCharacter({
  url,
  animationAsset,
}: {
  url: string;
  animationAsset?: StageCharacterModelAsset | null;
}) {
  const { scene } = useGLTF(url);
  if (animationAsset?.format === "fbx") {
    return (
      <FbxAnimationClip url={animationAsset.url}>
        {(clip) => <NormalizedCharacterModel object={scene} clip={clip} />}
      </FbxAnimationClip>
    );
  }
  return <NormalizedCharacterModel object={scene} clip={null} />;
}

function FbxCharacter({
  url,
  animationAsset,
}: {
  url: string;
  animationAsset?: StageCharacterModelAsset | null;
}) {
  const fbx = useFBX(url);
  if (animationAsset?.format === "fbx") {
    return (
      <FbxAnimationClip url={animationAsset.url}>
        {(clip) => <NormalizedCharacterModel object={fbx} clip={clip} />}
      </FbxAnimationClip>
    );
  }
  return <NormalizedCharacterModel object={fbx} clip={null} />;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Stage: character model failed to load, falling back to the capsule placeholder", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function CapsuleBody({ color }: { color: string }) {
  const radius = 0.25;
  const cylinderLength = TARGET_HEIGHT - radius * 2;
  return (
    <mesh position={[0, TARGET_HEIGHT / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, cylinderLength, 4, 12]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export function CharacterFigure({
  modelAsset,
  animationAsset,
  position,
  rotationY,
  color,
  highlighted,
}: CharacterFigureProps) {
  const canRenderModel = modelAsset != null && isPreviewableCharacterModelFormat(modelAsset.format);
  const fallback = <CapsuleBody color={color} />;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {canRenderModel ? (
        <ModelErrorBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            {modelAsset.format === "fbx" ? (
              <FbxCharacter url={modelAsset.url} animationAsset={animationAsset} />
            ) : (
              <GltfCharacter url={modelAsset.url} animationAsset={animationAsset} />
            )}
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        fallback
      )}
      {highlighted && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.33, 0.43, 32]} />
          <meshBasicMaterial color="#ffd23f" />
        </mesh>
      )}
    </group>
  );
}
