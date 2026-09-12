// scene-model-preview.tsx
// Purpose: Live orbit preview for a scene's environment model (room/set GLB).
//          Deliberately simpler than character-model-preview.tsx — a scene
//          model is a static environment mesh, not a rigged, animatable
//          character, so there's no skeleton/mixer/clip-picker here at all.
//          Mounted only through next/dynamic({ssr:false}) by the caller —
//          three.js touches WebGL/window at effect time (plan.md §6.6).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, useFBX, useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Object3D, type PerspectiveCamera } from "three";

interface SceneModelPreviewProps {
  url: string;
  format: string;
}

const FRAMING_MARGIN = 1.5;

interface Frame {
  center: Vector3;
  floorY: number;
  maxDimension: number;
}

// Same fit-to-bounding-box approach as character-model-preview.tsx's
// FramedModel — see that file for why updateWorldMatrix has to run first.
function FramedEnvironment({ object }: { object: Object3D }) {
  const { camera } = useThree();
  const [frame, setFrame] = useState<Frame | null>(null);

  useEffect(() => {
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;

    const perspective = camera as PerspectiveCamera;
    const fovRadians = (perspective.fov * Math.PI) / 180;
    const distance = (maxDimension / 2 / Math.tan(fovRadians / 2)) * FRAMING_MARGIN;

    camera.position.set(center.x + distance * 0.6, center.y + distance * 0.5, center.z + distance);
    perspective.near = Math.max(distance / 200, 0.01);
    perspective.far = distance * 100;
    camera.lookAt(center);
    perspective.updateProjectionMatrix();

    setFrame({ center, floorY: box.min.y, maxDimension });
  }, [object, camera]);

  return (
    <>
      <primitive object={object} />
      {frame && (
        <>
          <Grid
            position={[frame.center.x, frame.floorY, frame.center.z]}
            args={[frame.maxDimension * 4, frame.maxDimension * 4]}
            cellSize={frame.maxDimension / 10}
            cellThickness={0.6}
            cellColor="#5b5b5b"
            sectionSize={frame.maxDimension / 2}
            sectionThickness={1}
            sectionColor="#8a8a8a"
            fadeDistance={frame.maxDimension * 5}
            fadeStrength={1.5}
            infiniteGrid
          />
          <OrbitControls makeDefault target={frame.center} enableDamping dampingFactor={0.1} />
        </>
      )}
    </>
  );
}

function GltfEnvironment({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <FramedEnvironment object={scene} />;
}

function FbxEnvironment({ url }: { url: string }) {
  const fbx = useFBX(url);
  return <FramedEnvironment object={fbx} />;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

// A malformed/unreadable upload must never take the whole scene workspace
// down with it.
class PreviewErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Scene model preview failed to load:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function PreviewFallback() {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
      Preview unavailable
    </div>
  );
}

export function SceneModelPreview({ url, format }: SceneModelPreviewProps) {
  return (
    <PreviewErrorBoundary fallback={<PreviewFallback />}>
      <Canvas camera={{ position: [4, 3, 4], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 3]} intensity={1.2} />
        <Suspense fallback={null}>
          {format === "fbx" ? <FbxEnvironment url={url} /> : <GltfEnvironment url={url} />}
        </Suspense>
      </Canvas>
    </PreviewErrorBoundary>
  );
}
