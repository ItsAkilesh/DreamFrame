// simulation-stage.tsx
// Purpose: The pure 3D view shared by both simulation-viewing surfaces — a
//          saved run's step-through player (simulation-player.tsx) and the
//          live streaming view (simulation-dialog.tsx / scene-player.tsx).
//          Stands the scene's cast in a loose circle sized to the actual
//          room footprint (reported by SceneEnvironment once it measures the
//          model) rather than a fixed guess, inside the scene's assigned
//          environment model. The current speaker plays its matched
//          animation; everyone else plays a shared idle clip instead of
//          sitting in bind pose (a T-pose on these rigs) — real per-character
//          idle variety and actual collision-aware placement (not just a
//          same-size-as-the-room circle) are a later pass, not this one.
//          No playback controls here — callers decide which turn is
//          "current" and pass just that.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { characterModelFormatFromFileName } from "@/lib/character-model-formats";
import { cn } from "@/lib/utils";
import type { Character, Scene } from "@/lib/types";
import { circleRadiusFor, DEFAULT_FOOTPRINT, type RoomFootprint } from "@/render/roomFit";
import { useIdleAnimationAssetId } from "@/render/useIdleAnimationAsset";

const CharacterFigure = dynamic(
  () => import("@/render/CharacterFigure").then((m) => m.CharacterFigure),
  { ssr: false }
);
const SceneEnvironment = dynamic(
  () => import("@/render/SceneEnvironment").then((m) => m.SceneEnvironment),
  { ssr: false }
);

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[10, 10]} />
      <meshLambertMaterial color="#3a3a3a" />
    </mesh>
  );
}

interface SimulationStageProps {
  scene: Scene;
  characters: Character[];
  speakingCharacterId: string | null;
  animationAssetId?: string | null;
  className?: string;
}

export function SimulationStage({
  scene,
  characters,
  speakingCharacterId,
  animationAssetId,
  className,
}: SimulationStageProps) {
  const [footprint, setFootprint] = useState<RoomFootprint>(DEFAULT_FOOTPRINT);
  const idleAssetId = useIdleAnimationAssetId();
  const radius = circleRadiusFor(footprint);

  const cast = useMemo(() => {
    const n = characters.length;
    return characters.map((character, i) => {
      const angle = (i / n) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const rotationY = Math.atan2(-x, -z);
      return { character, position: [x, 0, z] as [number, number, number], rotationY };
    });
  }, [characters, radius]);

  return (
    <div className={cn("relative", className)}>
      <Canvas camera={{ position: [0, 3.2, radius + 4.5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
        {scene.modelAsset ? (
          <SceneEnvironment
            url={scene.modelAsset.url}
            format={scene.modelAsset.format}
            fallback={<Ground />}
            onMeasured={setFootprint}
          />
        ) : (
          <Ground />
        )}
        {cast.map(({ character, position, rotationY }) => {
          const isSpeaking = character.id === speakingCharacterId;
          const clipId = isSpeaking ? animationAssetId : idleAssetId;
          const animationAsset = clipId
            ? { url: `/assets/library/animations/${clipId}`, format: characterModelFormatFromFileName(clipId) ?? "fbx" }
            : null;

          return (
            <CharacterFigure
              key={character.id}
              modelAsset={character.modelAsset}
              animationAsset={animationAsset}
              position={position}
              rotationY={rotationY}
              color={character.color}
              highlighted={isSpeaking}
            />
          );
        })}
        <OrbitControls target={[0, 1.2, 0]} />
      </Canvas>
    </div>
  );
}
