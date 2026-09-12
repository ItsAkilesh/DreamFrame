// character-model-preview.tsx
// Purpose: Live-rotating 3D thumbnail for an uploaded character model (GLB/
//          glTF and FBX, via drei's useGLTF/useFBX — no new dependency).
//          Mounted only through next/dynamic({ssr:false}) by the caller —
//          three.js touches WebGL/window at effect time, and this repo's own
//          rule (plan.md §6.6) keeps that behind a client-only boundary, the
//          same as the previs Stage.
//
//          Also plays the shared Mixamo FBX animation library directly on
//          compatible Mixamo character skeletons. No cross-rig retargeting:
//          these source clips and characters share the same skeleton.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Minus, Pause, Play, Plus } from "lucide-react";
import { AnimationMixer, Box3, Vector3, type AnimationClip, type Object3D, type PerspectiveCamera } from "three";
import { useOwnedModel } from "@/lib/use-owned-model";
import { AnimationPicker } from "@/components/animation-picker";

import {
  prepareMixamoClipForCharacter,
  resetCharacterPose,
  RetargetError,
  supportsMixamoAnimations,
} from "@/lib/animation-retarget";

interface CharacterModelPreviewProps {
  url: string;
  format: string;
}

const FRAMING_MARGIN = 1.6; // headroom around the model so it's never clipped
const ZOOM_STEP_FACTOR = 0.82; // camera-distance multiplier per zoom-in step
const MIN_ZOOM_STEPS = -2; // zoomed out past the initial fit
const MAX_ZOOM_STEPS = 5; // zoomed in

interface Frame {
  center: Vector3;
  floorY: number;
  maxDimension: number;
  baseDistance: number;
}

interface FramedModelProps {
  object: Object3D;
  isRotating: boolean;
  zoomSteps: number;
  animationClip: AnimationClip | null;
}

interface AnimationAsset {
  id: string;
  name: string;
  url: string;
}

// Uploaded models arrive at whatever real-world scale their source app used
// (a Mixamo FBX in centimetres vs. a hand-modelled GLB in metres, say), so a
// fixed camera distance would clip one and leave the other a speck. This
// measures the loaded object's own bounding box once, backs the camera off
// to fit it, and hands OrbitControls a fixed orbit target from then on.
//
// Deliberately not drei's <Bounds>: its animated fit and a live autoRotating
// OrbitControls both drive `camera.position` every frame, and fight each
// other for it continuously — not just during the initial settle — which is
// what made the model appear to drift/recede while rotating. Computing the
// frame once, synchronously, and only then mounting a plain OrbitControls
// with a fixed target avoids that fight entirely.
function FramedModel({ object, isRotating, zoomSteps, animationClip }: FramedModelProps) {
  const { camera, invalidate } = useThree();
  const [frame, setFrame] = useState<Frame | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);

  useEffect(() => {
    // Box3.setFromObject only refreshes the object's OWN matrix, not its
    // ancestors' (three.js assumes a render pass already ran and left
    // matrixWorld up to date scene-wide). This effect can fire before R3F's
    // first post-mount frame, so without this the box gets computed against
    // a still-identity parent chain — right size, wrong place, which is
    // exactly what "correct from top, wrong from the front" looks like: a
    // vertical offset that a top-down view mostly hides and a front view
    // doesn't.
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;

    const perspective = camera as PerspectiveCamera;
    const fovRadians = (perspective.fov * Math.PI) / 180;
    const baseDistance = (maxDimension / 2 / Math.tan(fovRadians / 2)) * FRAMING_MARGIN;

    camera.position.set(center.x, center.y, center.z + baseDistance);
    perspective.near = Math.max(baseDistance / 200, 0.01);
    perspective.far = baseDistance * 100;
    camera.lookAt(center);
    perspective.updateProjectionMatrix();

    setFrame({ center, floorY: box.min.y, maxDimension, baseDistance });
  }, [object, camera]);

  // Reactive: re-derive the camera's distance from target whenever the zoom
  // level changes, preserving whatever direction autoRotate/dragging has
  // since turned to — zooming shouldn't reset the current view angle.
  useEffect(() => {
    if (!frame) return;
    const distance = frame.baseDistance * ZOOM_STEP_FACTOR ** zoomSteps;
    const offset = camera.position.clone().sub(frame.center);
    const currentDistance = offset.length() || 1;
    offset.multiplyScalar(distance / currentDistance);
    camera.position.copy(frame.center).add(offset);
    invalidate();
  }, [zoomSteps, frame, camera, invalidate]);

  // One mixer for the model's lifetime; source Mixamo clips are rewritten to
  // `.bones[...]` paths, which bind to this exact SkinnedMesh.
  useEffect(() => {
    // Retargeted clips use SkeletonUtils' `.bones[name]` track path, which
    // three.js's PropertyBinding only resolves against an object that has
    // `.skeleton` directly on it — the SkinnedMesh itself, not the loaded
    // scene's top-level Group. Binding the mixer to `object` instead would
    // fail silently (no error, just a permanently frozen pose).
    const mixer = new AnimationMixer(object);
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(object);
      mixerRef.current = null;
    };
  }, [object]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixer.stopAllAction();

    // Stopping a mixer does not restore the skeleton. Always start a new
    // selection from the character's bind transforms; most importantly, this
    // makes the "Bind pose" option actually return the model to its rest pose.
    resetCharacterPose(object);

    if (animationClip) {
      mixer.clipAction(animationClip).reset().play();
    }
    return () => {
      mixer.stopAllAction();
      if (animationClip) mixer.uncacheClip(animationClip);
    };
  }, [animationClip, object]);

  useFrame((_state, delta) => {
    mixerRef.current?.update(delta);
  });

  return (
    <>
      <primitive object={object} />
      {frame && (
        <>
          {/*
            A floor reference — without it the model reads as floating in a
            void. No `rotation` prop: drei's Grid shader already remaps its
            plane geometry to lie flat (it swaps local Y/Z internally), so a
            manual -90°-on-X rotation here doesn't lay it down — it tips the
            already-flattened grid up into a vertical wall facing the camera.
          */}
          <Grid
            position={[frame.center.x, frame.floorY, frame.center.z]}
            args={[frame.maxDimension * 6, frame.maxDimension * 6]}
            cellSize={frame.maxDimension / 8}
            cellThickness={0.6}
            cellColor="#5b5b5b"
            sectionSize={frame.maxDimension / 2}
            sectionThickness={1}
            sectionColor="#8a8a8a"
            fadeDistance={frame.maxDimension * 6}
            fadeStrength={1.5}
            infiniteGrid
          />
          <OrbitControls
            makeDefault
            target={frame.center}
            autoRotate={isRotating}
            autoRotateSpeed={2.5}
            enablePan={false}
            enableZoom={false}
          />
        </>
      )}
    </>
  );
}

interface AnimatedModelProps {
  object: Object3D;
  isRotating: boolean;
  zoomSteps: number;
  animation: AnimationAsset;
  onRetargetError: (message: string | null) => void;
}

// Each downloaded Mixamo FBX contains one motion clip. useFBX caches files,
// so returning to a previous selection does not fetch it a second time.
function AnimatedModel({
  object,
  isRotating,
  zoomSteps,
  animation,
  onRetargetError,
}: AnimatedModelProps) {
  const {object: animationSource, error: loadError} = useOwnedModel(animation.url, "fbx");

  const { preparedClip, error } = useMemo(() => {
    if (!animationSource) return {preparedClip: null, error: loadError};
    const sourceClip = animationSource.animations[0];
    if (!sourceClip) return { preparedClip: null, error: "This animation file contains no playable clip." };
    try {
      return { preparedClip: prepareMixamoClipForCharacter(object, sourceClip), error: null };
    } catch (err) {
      const message = err instanceof RetargetError ? err.message : "Failed to prepare this Mixamo animation.";
      return { preparedClip: null, error: message };
    }
  }, [object, animationSource, loadError]);

  useEffect(() => {
    onRetargetError(error);
  }, [error, onRetargetError]);

  return (
    <FramedModel object={object} isRotating={isRotating} zoomSteps={zoomSteps} animationClip={preparedClip} />
  );
}

interface LoadedModelProps {
  url: string;
  isRotating: boolean;
  zoomSteps: number;
  selectedAnimation: AnimationAsset | null;
  onRetargetError: (message: string | null) => void;
  onCompatible: (compatible: boolean) => void;
}

function GltfModel({ url, ...rest }: LoadedModelProps) {
  return <OwnedCharacter url={url} format="gltf" {...rest} />;
}

function FbxModel({ url, ...rest }: LoadedModelProps) {
  return <OwnedCharacter url={url} format="fbx" {...rest} />;
}

function OwnedCharacter({url, format, ...rest}: LoadedModelProps & {format: string}) {
  const {object, error} = useOwnedModel(url, format);
  const {onCompatible, onRetargetError} = rest;
  useEffect(() => {
    onCompatible(Boolean(object && supportsMixamoAnimations(object)));
    onRetargetError(error);
  }, [object, error, onCompatible, onRetargetError]);
  return object ? <LoadedCharacter object={object} {...rest} /> : null;
}

function LoadedCharacter({ object, isRotating, zoomSteps, selectedAnimation, onRetargetError }: Omit<LoadedModelProps, "url"> & { object: Object3D }) {
  if (selectedAnimation) {
    return (
      <AnimatedModel
        object={object}
        isRotating={isRotating}
        zoomSteps={zoomSteps}
        animation={selectedAnimation}
        onRetargetError={onRetargetError}
      />
    );
  }

  return <FramedModel object={object} isRotating={isRotating} zoomSteps={zoomSteps} animationClip={null} />;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

// A malformed/unreadable upload must never take the whole roster page down
// with it — useGLTF/useFBX throw synchronously on a bad file, and only a
// class component can catch that as a render-time error in React.
class PreviewErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Character model preview failed to load:", error);
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

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function CharacterModelPreview({ url, format }: CharacterModelPreviewProps) {
  const [isRotating, setIsRotating] = useState(false);
  const [zoomSteps, setZoomSteps] = useState(0);
  const [animations, setAnimations] = useState<AnimationAsset[]>([]);
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(null);
  const [retargetError, setRetargetError] = useState<string | null>(null);
  const [compatible, setCompatible] = useState(false);
  const selectedAnimation = animations.find((animation) => animation.id === selectedAnimationId) ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/asset-library?category=animation")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load animations"))))
      .then((body) => {
        if (!cancelled) setAnimations(body.assets ?? []);
      })
      .catch(() => {
        if (!cancelled) setRetargetError("The Mixamo animation library could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <PreviewErrorBoundary fallback={<PreviewFallback />}>
        <Canvas
          frameloop={isRotating || selectedAnimation ? "always" : "demand"}
          camera={{ position: [0, 1.2, 3], fov: 40 }}
          dpr={1}
          gl={{ antialias: true, powerPreference: "low-power" }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 2]} intensity={1.4} />
          <Suspense fallback={null}>
            {format === "fbx" ? (
              <FbxModel
                url={url}
                isRotating={isRotating}
                zoomSteps={zoomSteps}
                selectedAnimation={selectedAnimation}
                onRetargetError={setRetargetError}
                onCompatible={setCompatible}
              />
            ) : (
              <GltfModel
                url={url}
                isRotating={isRotating}
                zoomSteps={zoomSteps}
                selectedAnimation={selectedAnimation}
                onRetargetError={setRetargetError}
                onCompatible={setCompatible}
              />
            )}
          </Suspense>
        </Canvas>
      </PreviewErrorBoundary>

      <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex flex-col items-center gap-1">
        {retargetError && (
          <p className="pointer-events-auto max-w-[90%] rounded bg-black/60 px-2 py-1 text-center text-[10px] text-red-300">
            {retargetError}
          </p>
        )}
        <div className="pointer-events-auto flex items-center gap-1 rounded-md bg-black/60 p-1 backdrop-blur-sm">
          <AnimationPicker
            animations={compatible ? animations : []}
            value={selectedAnimationId}
            onChange={(id) => { setRetargetError(null); setSelectedAnimationId(id); }}
            disabled={!compatible || animations.length === 0}
          />
          <ToolbarButton
            label={isRotating ? "Pause rotation" : "Resume rotation"}
            onClick={() => setIsRotating((value) => !value)}
          >
            {isRotating ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </ToolbarButton>
          <ToolbarButton
            label="Zoom out"
            disabled={zoomSteps <= MIN_ZOOM_STEPS}
            onClick={() => setZoomSteps((value) => Math.max(MIN_ZOOM_STEPS, value - 1))}
          >
            <Minus className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Zoom in"
            disabled={zoomSteps >= MAX_ZOOM_STEPS}
            onClick={() => setZoomSteps((value) => Math.min(MAX_ZOOM_STEPS, value + 1))}
          >
            <Plus className="size-3.5" />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
}
