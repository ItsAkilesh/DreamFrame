// Stage.tsx
// Purpose: Previs stage — room, props, cast, three-point lighting,
//          OrbitControls. A scene's assigned environment model
//          (sceneModelAsset) renders in place of the placeholder box room
//          (see SceneEnvironment.tsx), and each cast member's own uploaded/
//          library model (characterModels) renders in place of their
//          placeholder capsule (see CharacterFigure.tsx) — both fall back to
//          their placeholder cleanly on any load failure. Props remain
//          placeholder boxes; that's still open. Must never throw on a
//          partial spec.
//
//          Also the keyframe authoring surface: click a character to select
//          it, drag its gizmo, and the Editor View writes the resulting pose
//          as a keyframe at the playhead's timestamp.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import { OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PCFShadowMap, type Group, type Object3D } from "three";

import { PROP_DIMENSIONS } from "@/assets/manifest";
import { isPreviewableCharacterModelFormat } from "@/lib/character-model-formats";
import { CharacterFigure, type StageCharacterModelAsset } from "@/render/CharacterFigure";
import { resolvePose } from "@/render/blocking";
import { SceneEnvironment } from "@/render/SceneEnvironment";
import type { Pose } from "@/render/keyframes";
import type { PrevisSpec } from "@/schema/previsSpec";

export type GizmoMode = "translate" | "rotate";

interface StageSceneModelAsset {
  url: string;
  format: string;
}

interface StageProps {
  spec: PrevisSpec;
  time: number;
  highlightedCharacterIds?: string[];
  sceneModelAsset?: StageSceneModelAsset | null;
  // Keyed by the same character id as spec.cast[].id — a dashboard concern
  // (each character's own uploaded/library model), not part of the PrevisSpec
  // contract, same reasoning as sceneModelAsset above.
  characterModels?: Record<string, StageCharacterModelAsset | null | undefined>;
  selectedCharacterId?: string | null;
  /** Omit to keep the stage read-only (no selection, no gizmo). */
  onSelectCharacter?: (characterId: string | null) => void;
  onPoseCommit?: (characterId: string, pose: Pose) => void;
  gizmoMode?: GizmoMode;
}

function Room({ dimensions }: { dimensions: { w: number; d: number; h: number } }) {
  const { w, d, h } = dimensions;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshLambertMaterial color="#3a3a3a" />
      </mesh>
      {/* back wall, at -Z per convention (§3.1) */}
      <mesh position={[0, h / 2, -d / 2]}>
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial color="#4a4a4a" side={2} />
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshLambertMaterial color="#454545" side={2} />
      </mesh>
      <mesh position={[w / 2, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[d, h]} />
        <meshLambertMaterial color="#454545" side={2} />
      </mesh>
      {/* front wall and ceiling are intentionally omitted so OrbitControls
          can see inside the room — a common previs-viewer simplification. */}
    </group>
  );
}

function Prop({ prop }: { prop: PrevisSpec["set"]["props"][number] }) {
  const dims = PROP_DIMENSIONS[prop.type] ?? [0.5, 0.5, 0.5];
  const [x, , z] = prop.position;
  return (
    <mesh
      position={[x, (dims[1] * prop.scale) / 2, z]}
      rotation={[0, prop.rotationY, 0]}
      scale={prop.scale}
      castShadow
    >
      <boxGeometry args={dims} />
      <meshLambertMaterial color="#8a7358" />
    </mesh>
  );
}

function StageCharacter({
  character,
  time,
  spec,
  modelAsset,
  highlighted,
  selected,
  onSelect,
  onTarget,
}: {
  character: PrevisSpec["cast"][number];
  time: number;
  spec: PrevisSpec;
  modelAsset?: StageCharacterModelAsset | null;
  highlighted: boolean;
  selected: boolean;
  onSelect?: (characterId: string) => void;
  onTarget?: (object: Object3D | null) => void;
}) {
  const groupRef = useRef<Group>(null);

  // Hand the selected character's group up to the Stage so the single
  // TransformControls can attach to it — the gizmo has to live outside the
  // group it moves, or it would drag itself.
  useEffect(() => {
    if (!selected) return;
    onTarget?.(groupRef.current);
    return () => onTarget?.(null);
  }, [selected, onTarget]);

  let pose;
  try {
    pose = resolvePose(spec, character.id, time);
  } catch (error) {
    console.warn(`Stage: failed to resolve pose for ${character.id}`, error);
    pose = { position: character.position, rotationY: character.rotationY };
  }

  return (
    <group
      ref={groupRef}
      position={[pose.position[0], 0, pose.position[2]]}
      rotation={[0, pose.rotationY, 0]}
      onClick={(event) => {
        if (!onSelect) return;
        event.stopPropagation();
        onSelect(character.id);
      }}
    >
      {/* The figure sits at the group's origin: the group carries the pose, so
          TransformControls has a single object to move. CharacterFigure draws
          its own highlight, so only the selection ring is added here. */}
      <CharacterFigure
        modelAsset={modelAsset}
        position={[0, 0, 0]}
        rotationY={0}
        color={character.color}
        highlighted={highlighted}
      />
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.33, 0.43, 32]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      )}
    </group>
  );
}

function ThreePointLights({ lights }: { lights: PrevisSpec["set"]["lights"] }) {
  if (lights.length === 0) {
    return (
      <>
        <spotLight position={[2, 2.6, 2]} intensity={3} color="#ffe8c4" castShadow />
        <pointLight position={[-2, 2, 1.5]} intensity={0.8} color="#9fb8ff" />
        <ambientLight intensity={0.25} />
      </>
    );
  }

  // Only the highest-intensity spot/directional light casts a shadow — a
  // performance rule (§6), not a style rule.
  const shadowCasterId = lights
    .filter((l) => l.type === "spot" || l.type === "directional")
    .sort((a, b) => b.intensity - a.intensity)[0]?.id;

  return (
    <>
      {lights.map((light) => {
        const castShadow = light.id === shadowCasterId;
        switch (light.type) {
          case "ambient":
            return <ambientLight key={light.id} intensity={light.intensity} color={light.color} />;
          case "point":
            return (
              <pointLight
                key={light.id}
                position={light.position}
                intensity={light.intensity}
                color={light.color}
                castShadow={castShadow}
              />
            );
          case "spot":
            return (
              <spotLight
                key={light.id}
                position={light.position}
                target-position={light.target}
                intensity={light.intensity}
                color={light.color}
                castShadow={castShadow}
              />
            );
          case "directional":
            return (
              <directionalLight
                key={light.id}
                position={light.position}
                target-position={light.target}
                intensity={light.intensity}
                color={light.color}
                castShadow={castShadow}
              />
            );
        }
      })}
    </>
  );
}

export function Stage({
  spec,
  time,
  highlightedCharacterIds = [],
  sceneModelAsset,
  characterModels,
  selectedCharacterId = null,
  onSelectCharacter,
  onPoseCommit,
  gizmoMode = "translate",
}: StageProps) {
  const { w, d } = spec.set.dimensions;
  const camDistance = Math.max(w, d) * 1.3;
  const [target, setTarget] = useState<Object3D | null>(null);

  // Read the pose straight off the dragged group: the gizmo mutates the
  // object directly, so this is the only place the new pose exists until it
  // becomes a keyframe.
  function commitPose() {
    if (!target || !selectedCharacterId || !onPoseCommit) return;
    onPoseCommit(selectedCharacterId, {
      position: [target.position.x, 0, target.position.z],
      rotationY: target.rotation.y,
    });
  }

  const canRenderSceneModel =
    sceneModelAsset != null && isPreviewableCharacterModelFormat(sceneModelAsset.format);

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={{ position: [0, camDistance * 0.5, camDistance], fov: 50 }}
      onPointerMissed={() => onSelectCharacter?.(null)}
    >
      <ThreePointLights lights={spec.set.lights} />
      {canRenderSceneModel ? (
        <SceneEnvironment
          url={sceneModelAsset.url}
          format={sceneModelAsset.format}
          fallback={<Room dimensions={spec.set.dimensions} />}
        />
      ) : (
        <Room dimensions={spec.set.dimensions} />
      )}
      {spec.set.props.map((prop) => (
        <Prop key={prop.id} prop={prop} />
      ))}
      {spec.cast.map((character) => (
        <StageCharacter
          key={character.id}
          character={character}
          time={time}
          spec={spec}
          modelAsset={characterModels?.[character.id]}
          highlighted={highlightedCharacterIds.includes(character.id)}
          selected={character.id === selectedCharacterId}
          onSelect={onSelectCharacter}
          onTarget={setTarget}
        />
      ))}
      {target && onPoseCommit && (
        <TransformControls
          object={target}
          mode={gizmoMode}
          // Characters stay on the floor, and only turn about Y — the axes
          // that would break that are hidden rather than merely discouraged.
          showX={gizmoMode === "translate"}
          showZ={gizmoMode === "translate"}
          showY={gizmoMode === "rotate"}
          translationSnap={0.05}
          rotationSnap={Math.PI / 36}
          size={0.7}
          onMouseUp={commitPose}
        />
      )}
      {/* makeDefault lets TransformControls suspend orbiting mid-drag. */}
      <OrbitControls makeDefault target={[0, 1.2, 0]} />
    </Canvas>
  );
}
