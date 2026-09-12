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

import type { RoomFootprint } from "@/render/roomFit";
import {
  rectangularLayout,
  sceneCalibrationFor,
  type SceneLayout,
} from "@/render/sceneLayout";

export type { RoomFootprint } from "@/render/roomFit";

interface SceneEnvironmentProps {
  url: string;
  format: string;
  fallback: ReactNode;
  onMeasured?: (footprint: RoomFootprint) => void;
  onLayout?: (layout: SceneLayout) => void;
}

// Most uploaded/library room models aren't authored in real-world metres —
// rescale so the larger of the two floor dimensions lands here. 8 m is a
// generous but ordinary single room (plan.md's own room presets clamp width/
// depth to [3, 12]); this just picks a plausible point in that range instead
// of trusting whatever raw units the source file used.
const TARGET_MAX_FOOTPRINT = 8;

function Centered({ object, url, onMeasured, onLayout }: {
  object: Object3D;
  url: string;
  onMeasured?: (footprint: RoomFootprint) => void;
  onLayout?: (layout: SceneLayout) => void;
}) {
  const [group] = useState(() => new Group());

  useEffect(() => {
    group.add(object);
    object.position.set(0, 0, 0);
    object.scale.set(1, 1, 1);
    object.updateWorldMatrix(true, true);

    const rawBox = new Box3().setFromObject(object);
    const rawSize = rawBox.getSize(new Vector3());
    const rawCenter = rawBox.getCenter(new Vector3());
    const calibration = sceneCalibrationFor(url);
    const rawMaxFootprint = Math.max(rawSize.x, rawSize.z) || 1;
    const scale = calibration?.rawScale ?? TARGET_MAX_FOOTPRINT / rawMaxFootprint;
    object.scale.setScalar(scale);
    object.position.set(
      -rawCenter.x * scale,
      -(calibration?.rawFloorY ?? rawBox.min.y) * scale,
      -rawCenter.z * scale
    );
    object.updateWorldMatrix(true, true);

    const footprint = calibration?.layout.footprint ?? { width: rawSize.x * scale, depth: rawSize.z * scale };
    const layout = calibration?.layout ?? rectangularLayout(footprint);
    onMeasured?.(footprint);
    onLayout?.(layout);

    return () => {
      group.remove(object);
    };
    // onMeasured is a fresh closure each render in every current caller —
    // only react to the object/group actually changing, not to that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object, group, url]);

  return <primitive object={group} />;
}

function GltfEnvironment({ url, onMeasured, onLayout }: {
  url: string;
  onMeasured?: (footprint: RoomFootprint) => void;
  onLayout?: (layout: SceneLayout) => void;
}) {
  const { scene } = useGLTF(url);
  return <Centered object={scene} url={url} onMeasured={onMeasured} onLayout={onLayout} />;
}

function FbxEnvironment({ url, onMeasured, onLayout }: {
  url: string;
  onMeasured?: (footprint: RoomFootprint) => void;
  onLayout?: (layout: SceneLayout) => void;
}) {
  const fbx = useFBX(url);
  return <Centered object={fbx} url={url} onMeasured={onMeasured} onLayout={onLayout} />;
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

export function SceneEnvironment({ url, format, fallback, onMeasured, onLayout }: SceneEnvironmentProps) {
  return (
    <EnvironmentErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        {format === "fbx" ? (
          <FbxEnvironment url={url} onMeasured={onMeasured} onLayout={onLayout} />
        ) : (
          <GltfEnvironment url={url} onMeasured={onMeasured} onLayout={onLayout} />
        )}
      </Suspense>
    </EnvironmentErrorBoundary>
  );
}
