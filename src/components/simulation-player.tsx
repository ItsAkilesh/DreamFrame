// simulation-player.tsx
// Purpose: Steps through a saved simulation run's turns with playback
//          controls, driving the shared SimulationStage 3D view — see its
//          header for what that renders and why it's shared with the live
//          simulation-dialog.tsx. Pacing and per-turn voice audio are owned
//          by useTurnPlayback (src/lib/use-turn-playback.ts), shared with
//          the live view in scene-player.tsx.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SimulationStage } from "@/components/simulation-stage";
import { useTurnPlayback } from "@/lib/use-turn-playback";
import type { Character, Scene, SimulationRun } from "@/lib/types";

interface SimulationPlayerProps {
  scene: Scene;
  characters: Character[];
  run: SimulationRun;
}

export function SimulationPlayer({ scene, characters, run }: SimulationPlayerProps) {
  const turns = run.transcript;
  const { currentIndex, currentTurn, isPlaying, setIsPlaying, goTo } = useTurnPlayback({
    turns,
    isLive: false,
    autoPlay: false,
  });

  if (turns.length === 0 || !currentTurn) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center rounded-lg border text-sm">
        This run has no turns to play back.
      </div>
    );
  }

  const speakingCharacter = characters.find((c) => c.id === currentTurn.characterId);

  return (
    <div className="flex h-96 flex-col overflow-hidden rounded-lg border">
      <SimulationStage
        scene={scene}
        characters={characters}
        speakingCharacterId={currentTurn.characterId}
        animationAssetId={currentTurn.animationAssetId}
        className="flex-1"
      />

      <div className="flex flex-col gap-2 border-t p-3">
        <div className="mx-auto w-full max-w-sm text-center">
          <p
            className="text-sm font-bold tracking-wider uppercase"
            style={{ color: speakingCharacter?.color ?? "inherit" }}
          >
            {speakingCharacter?.name ?? currentTurn.characterId}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{currentTurn.text}</p>
          {currentTurn.action && (
            <p className="text-muted-foreground mt-1 text-xs italic">({currentTurn.action})</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Previous turn"
            disabled={currentIndex === 0}
            onClick={() => goTo(currentIndex - 1)}
          >
            <SkipBack />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Next turn"
            disabled={currentIndex + 1 >= turns.length}
            onClick={() => goTo(currentIndex + 1)}
          >
            <SkipForward />
          </Button>
          <span className="text-muted-foreground ml-2 text-xs">
            Turn {currentIndex + 1} / {turns.length}
          </span>
        </div>
      </div>
    </div>
  );
}
