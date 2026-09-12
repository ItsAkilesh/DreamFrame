// scene-player.tsx
// Purpose: Compact inline 3D player embedded in the Scene Workspace — same
//          Stage/Timeline as the full Editor View, just sized to sit above
//          the action buttons instead of taking over the page. Builds its
//          spec from the same placeholder fromScene adapter (see its header
//          for why this isn't real per-line blocking yet).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import { Timeline } from "@/ui/Timeline";
import { specDuration } from "@/render/blocking";
import { usePlayhead } from "@/render/usePlayhead";
import { fromScene } from "@/schema/fromScene";
import type { Character, Scene } from "@/lib/types";

const Stage = dynamic(() => import("@/render/Stage").then((m) => m.Stage), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      Loading stage…
    </div>
  ),
});

interface ScenePlayerProps {
  scene: Scene;
  characters: Character[];
}

export function ScenePlayer({ scene, characters }: ScenePlayerProps) {
  const spec = useMemo(() => {
    try {
      return fromScene(scene, characters);
    } catch {
      return null;
    }
  }, [scene, characters]);

  const duration = spec ? specDuration(spec) : 0;
  const { time, isPlaying, setTime, togglePlay } = usePlayhead(duration);

  if (!spec) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center rounded-lg border text-sm">
        This scene has no characters assigned yet, so there&apos;s nothing to block.
      </div>
    );
  }

  return (
    <div className="flex h-80 flex-col overflow-hidden rounded-lg border">
      <div className="flex-1">
        <Stage spec={spec} time={time} />
      </div>
      <Timeline
        spec={spec}
        time={time}
        onTimeChange={setTime}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
      />
    </div>
  );
}
