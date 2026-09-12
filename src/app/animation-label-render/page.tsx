// page.tsx
// Purpose: Internal-only page that applies one animation library clip to a
//          reference character and samples a few frames across the clip's
//          duration, exposing them as a JSON array of JPEG data URLs for
//          scripts/label-animations.mjs to read and send to a vision model.
//          Reuses the app's own retargeting code (prepareMixamoClipForCharacter)
//          rather than reimplementing clip application for a build script —
//          same reasoning as /thumbnail-render.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useSearchParams } from "next/navigation";
import { AnimationMixer, Box3, Vector3, type PerspectiveCamera } from "three";

import { prepareMixamoClipForCharacter, RetargetError } from "@/lib/animation-retarget";
import { useOwnedModel } from "@/lib/use-owned-model";

const FRAMING_MARGIN = 1.6;
// Skip the very start/end, which are often a transitional T-pose blend
// rather than the actual motion — sampling through the middle of the clip
// gives a vision model a much better read on what the action actually is.
const SAMPLE_FRACTIONS = [0.15, 0.5, 0.85];

const ALLOWED_URL_PREFIXES = ["/assets/library/"];
function isAllowedAssetUrl(url: string): boolean {
  return ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

interface FrameSamplerProps {
  characterUrl: string;
  animationUrl: string;
  onFrames: (frames: string[]) => void;
  onError: (message: string) => void;
}

function FrameSampler({ characterUrl, animationUrl, onFrames, onError }: FrameSamplerProps) {
  const { object: character, error: characterError } = useOwnedModel(characterUrl, "fbx");
  const { object: animationSource, error: animationError } = useOwnedModel(animationUrl, "fbx");
  const { camera, gl, invalidate } = useThree();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (characterError) onError(characterError);
    else if (animationError) onError(animationError);
  }, [characterError, animationError, onError]);

  useEffect(() => {
    if (!character || !animationSource || hasStartedRef.current) return;
    hasStartedRef.current = true;

    try {
      const sourceClip = animationSource.animations[0];
      if (!sourceClip) throw new RetargetError("This animation file contains no playable clip.");
      const clip = prepareMixamoClipForCharacter(character, sourceClip);

      character.updateWorldMatrix(true, true);
      const box = new Box3().setFromObject(character);
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

      const mixer = new AnimationMixer(character);
      mixer.clipAction(clip).play();

      const collected: string[] = [];
      let index = 0;

      // Deterministic mixer.setTime() scrubbing, not a real-time useFrame
      // loop — a Puppeteer-driven headless capture needs the same three
      // instants every run, not "whatever played during however long the
      // page happened to stay open."
      const captureNext = () => {
        if (index >= SAMPLE_FRACTIONS.length) {
          onFrames(collected);
          return;
        }
        mixer.setTime(SAMPLE_FRACTIONS[index] * clip.duration);
        invalidate();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            collected.push(gl.domElement.toDataURL("image/jpeg", 0.82));
            index += 1;
            captureNext();
          });
        });
      };
      captureNext();
    } catch (err) {
      onError(
        err instanceof RetargetError || err instanceof Error
          ? err.message
          : "Failed to sample this animation."
      );
    }
  }, [character, animationSource, camera, gl, invalidate, onFrames, onError]);

  return character ? <primitive object={character} /> : null;
}

function RenderOne() {
  const searchParams = useSearchParams();
  const characterUrl = searchParams.get("character");
  const animationUrl = searchParams.get("animation");
  const [frames, setFrames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paramsError = !characterUrl || !animationUrl
    ? "Missing character/animation query params"
    : !isAllowedAssetUrl(characterUrl) || !isAllowedAssetUrl(animationUrl)
      ? "character/animation must be under /assets/library/"
      : null;

  return (
    <>
      {!paramsError && characterUrl && animationUrl && (
        <Canvas
          frameloop="demand"
          camera={{ position: [0, 1.2, 3], fov: 40 }}
          dpr={[1, 1]}
          gl={{ preserveDrawingBuffer: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 2]} intensity={1.3} />
          <FrameSampler
            characterUrl={characterUrl}
            animationUrl={animationUrl}
            onFrames={setFrames}
            onError={setError}
          />
        </Canvas>
      )}
      {(paramsError ?? error) && <p data-error="true">{paramsError ?? error}</p>}
      {frames && <pre data-ready="true">{JSON.stringify(frames)}</pre>}
    </>
  );
}

export default function AnimationLabelRenderPage() {
  return (
    <Suspense fallback={null}>
      <RenderOne />
    </Suspense>
  );
}
