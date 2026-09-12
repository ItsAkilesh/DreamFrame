// thumbnail-generator-host.tsx
// Purpose: The one and only WebGL context used to generate model thumbnails,
//          mounted once near the app root (see editor-shell.tsx) and shared
//          by both the character roster and the asset library. It processes
//          thumbnail-queue.ts's queue one job at a time: mount a fresh
//          <Canvas> for the next job, load + frame + capture a single
//          frame, then unmount before the next job's Canvas mounts — so at
//          most one extra WebGL context ever exists for thumbnailing,
//          however many characters or library assets there are. Renders
//          nothing (a fixed, off-screen 1x1-ish box) when the queue is idle.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Box3, Vector3, type Object3D, type PerspectiveCamera } from "three";
import { useOwnedModel } from "@/lib/use-owned-model";

import {
  completeThumbnailJob,
  failThumbnailJob,
  subscribeThumbnailQueue,
  type ThumbnailJob,
} from "@/lib/thumbnail-queue";

const FRAMING_MARGIN = 1.6;

function CaptureOnce({ object, jobKey }: { object: Object3D; jobKey: string }) {
  const { camera, gl, invalidate } = useThree();

  useEffect(() => {
    // See character-model-preview.tsx's FramedModel for why this world-matrix
    // update has to happen before measuring the box — Box3.setFromObject
    // only refreshes the object's own matrix, not its ancestors'.
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;

    const perspective = camera as PerspectiveCamera;
    const fovRadians = (perspective.fov * Math.PI) / 180;
    const distance = (maxDimension / 2 / Math.tan(fovRadians / 2)) * FRAMING_MARGIN;

    camera.position.set(center.x, center.y, center.z + distance);
    perspective.near = Math.max(distance / 200, 0.01);
    perspective.far = distance * 100;
    camera.lookAt(center);
    perspective.updateProjectionMatrix();
    invalidate();

    // frameloop="demand" only schedules a render for the *next* animation
    // frame — a rAF nested inside the one invalidate() triggers is what
    // actually waits until that frame has been drawn.
    let outerFrame = 0;
    let innerFrame = 0;
    outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        try {
          completeThumbnailJob(jobKey, gl.domElement.toDataURL("image/png"));
        } catch (err) {
          failThumbnailJob(jobKey, err);
        }
      });
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
    // Runs once per mounted job — `object`/`camera`/`gl` are all stable for
    // this Canvas's lifetime, and the Canvas itself remounts (new `key`) for
    // every new job, so there's nothing else this should re-run on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object]);

  return <primitive object={object} />;
}

function GltfJob({ url, jobKey }: { url: string; jobKey: string }) {
  return <OwnedJob url={url} jobKey={jobKey} format="gltf" />;
}

function FbxJob({ url, jobKey }: { url: string; jobKey: string }) {
  return <OwnedJob url={url} jobKey={jobKey} format="fbx" />;
}

function OwnedJob({url, jobKey, format}: {url: string; jobKey: string; format: string}) {
  const {object, error} = useOwnedModel(url, format);
  useEffect(() => { if (error) failThumbnailJob(jobKey, new Error(error)); }, [error, jobKey]);
  return object ? <CaptureOnce object={object} jobKey={jobKey} /> : null;
}

interface BoundaryProps {
  jobKey: string;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

// A malformed/unreadable file must fail its job (freeing the queue to move
// on) rather than leave the queue stuck waiting on a job that will never
// resolve.
class JobErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    failThumbnailJob(this.props.jobKey, error);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export function ThumbnailGeneratorHost() {
  const [job, setJob] = useState<ThumbnailJob | null>(null);

  useEffect(() => subscribeThumbnailQueue(setJob), []);

  return (
    <div
      aria-hidden
      style={{ position: "fixed", top: -10000, left: -10000, width: 256, height: 256, pointerEvents: "none" }}
    >
        <Canvas
          frameloop="demand"
          camera={{ position: [0, 1.2, 3], fov: 40 }}
          dpr={[1, 1]}
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} />
          {job && <JobErrorBoundary key={job.key} jobKey={job.key}><Suspense fallback={null}>
            {job.format === "fbx" ? (
              <FbxJob url={job.url} jobKey={job.key} />
            ) : (
              <GltfJob url={job.url} jobKey={job.key} />
            )}
          </Suspense></JobErrorBoundary>}
        </Canvas>
    </div>
  );
}
