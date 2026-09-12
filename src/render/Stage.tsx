// Stage.tsx
// Purpose: M0 placeholder previs stage — room, box props, capsule
//          characters, three-point lighting, OrbitControls. All primitives;
//          no GLB loading (that's M1). Must never throw on a partial spec.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { PCFShadowMap } from "three";

import { PROP_DIMENSIONS } from "@/assets/manifest";
import { resolvePose } from "@/render/blocking";
import type { PrevisSpec } from "@/schema/previsSpec";

interface StageProps {
  spec: PrevisSpec;
  time: number;
  highlightedCharacterIds?: string[];
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

function CharacterCapsule({
  character,
  time,
  spec,
  highlighted,
}: {
  character: PrevisSpec["cast"][number];
  time: number;
  spec: PrevisSpec;
  highlighted: boolean;
}) {
  const radius = 0.25;
  const totalHeight = 1.75;
  const cylinderLength = totalHeight - radius * 2;

  let pose;
  try {
    pose = resolvePose(spec, character.id, time);
  } catch (error) {
    console.warn(`Stage: failed to resolve pose for ${character.id}`, error);
    pose = { position: character.position, rotationY: character.rotationY };
  }

  const [x, , z] = pose.position;

  return (
    <group>
      <mesh position={[x, totalHeight / 2, z]} rotation={[0, pose.rotationY, 0]} castShadow>
        <capsuleGeometry args={[radius, cylinderLength, 4, 12]} />
        <meshLambertMaterial color={character.color} />
      </mesh>
      {highlighted && (
        <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.08, radius + 0.18, 32]} />
          <meshBasicMaterial color="#ffd23f" />
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

export function Stage({ spec, time, highlightedCharacterIds = [] }: StageProps) {
  const { w, d } = spec.set.dimensions;
  const camDistance = Math.max(w, d) * 1.3;

  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={{ position: [0, camDistance * 0.5, camDistance], fov: 50 }}
    >
      <ThreePointLights lights={spec.set.lights} />
      <Room dimensions={spec.set.dimensions} />
      {spec.set.props.map((prop) => (
        <Prop key={prop.id} prop={prop} />
      ))}
      {spec.cast.map((character) => (
        <CharacterCapsule
          key={character.id}
          character={character}
          time={time}
          spec={spec}
          highlighted={highlightedCharacterIds.includes(character.id)}
        />
      ))}
      <OrbitControls target={[0, 1.2, 0]} />
    </Canvas>
  );
}
