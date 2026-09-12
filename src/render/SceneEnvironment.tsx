// SceneEnvironment.tsx
// Purpose: Renders a scene's assigned 3D environment model (room/set) inside
//          the previs Stage, in place of the placeholder box room. Scales
//          the model so its floor footprint lands in a plausible real-world
//          room size (uploaded scene models arrive at whatever scale their
//          source app used, same problem character uploads have), then
//          centers that footprint on the world origin. Reports the scaled
//          footprint back to the caller (onMeasured) so character placement
//          can be sized to the actual room instead of a fixed guess — true
//          spatial reasoning (matching real furniture, marking usable floor
//          area) is a later pass; this is a best-effort alignment, not that.
//          Falls back to the placeholder room on any load failure — the
//          Stage must never go blank because one uploaded file is bad.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { useFBX, useGLTF } from "@react-three/drei";
import { Box3, Group, Vector3, type Object3D } from "three";

export interface RoomFootprint {
  width: number; // X extent, metres
  depth: number; // Z extent, metres
}

interface SceneEnvironmentProps {
  url: string;
  format: string;
  fallback: ReactNode;
  onMeasured?: (footprint: RoomFootprint) => void;
}

// Most uploaded/library room models aren't authored in real-world metres —
// rescale so the larger of the two floor dimensions lands here. 8 m is a
// generous but ordinary single room (plan.md's own room presets clamp width/
// depth to [3, 12]); this just picks a plausible point in that range instead
// of trusting whatever raw units the source file used.
const TARGET_MAX_FOOTPRINT = 8;

function Centered({ object, onMeasured }: { object: Object3D; onMeasured?: (footprint: RoomFootprint) => void }) {
  const [group] = useState(() => new Group());

  useEffect(() => {
    group.add(object);
    object.position.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    object.updateWorldMatrix(true, true);

    const rawSize = new Box3().setFromObject(object).getSize(new Vector3());
    const rawMaxFootprint = Math.max(rawSize.x, rawSize.z) || 1;
    const scale = TARGET_MAX_FOOTPRINT / rawMaxFootprint;
    object.scale.setScalar(scale);
    object.updateWorldMatrix(true, true);

    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;

    onMeasured?.({ width: size.x, depth: size.z });

    return () => {
      group.remove(object);
    };
    // onMeasured is a fresh closure each render in every current caller —
    // only react to the object/group actually changing, not to that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, group]);

  return <primitive object={group} />;
}

function GltfEnvironment({ url, onMeasured }: { url: string; onMeasured?: (footprint: RoomFootprint) => void }) {
  const { scene } = useGLTF(url);
  return <Centered object={scene} onMeasured={onMeasured} />;
}

function FbxEnvironment({ url, onMeasured }: { url: string; onMeasured?: (footprint: RoomFootprint) => void }) {
  const fbx = useFBX(url);
  return <Centered object={fbx} onMeasured={onMeasured} />;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

class EnvironmentErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Stage: scene model failed to load, falling back to the placeholder room", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function SceneEnvironment({ url, format, fallback, onMeasured }: SceneEnvironmentProps) {
  return (
    <EnvironmentErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        {format === "fbx" ? (
          <FbxEnvironment url={url} onMeasured={onMeasured} />
        ) : (
          <GltfEnvironment url={url} onMeasured={onMeasured} />
        )}
      </Suspense>
    </EnvironmentErrorBoundary>
  );
}
