// simulation-player.tsx
// Purpose: Steps through a saved simulation run's turns with playback
//          controls, driving the shared SimulationStage 3D view — see its
//          header for what that renders and why it's shared with the live
//          simulation-dialog.tsx.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SimulationStage } from "@/components/simulation-stage";
import type { Character, Scene, SimulationRun } from "@/lib/types";

const MIN_TURN_SECONDS = 2;
const MAX_TURN_SECONDS = 8;

function turnDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, (words / 150) * 60 + 1));
}

interface SimulationPlayerProps {
  scene: Scene;
  characters: Character[];
  run: SimulationRun;
}

export function SimulationPlayer({ scene, characters, run }: SimulationPlayerProps) {
  const [turnIndex, setTurnIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const turns = run.transcript;
  const currentTurn = turns[turnIndex];

  useEffect(() => {
    if (!isPlaying || !currentTurn) return;
    advanceTimer.current = setTimeout(() => {
      setTurnIndex((i) => {
        if (i + 1 >= turns.length) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, turnDurationSeconds(currentTurn.text) * 1000);

    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [isPlaying, turnIndex, currentTurn, turns.length]);

  if (turns.length === 0) {
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
            disabled={turnIndex === 0}
            onClick={() => setTurnIndex((i) => Math.max(0, i - 1))}
          >
            <SkipBack />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => setIsPlaying((v) => !v)}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Next turn"
            disabled={turnIndex + 1 >= turns.length}
            onClick={() => setTurnIndex((i) => Math.min(turns.length - 1, i + 1))}
          >
            <SkipForward />
          </Button>
          <span className="text-muted-foreground ml-2 text-xs">
            Turn {turnIndex + 1} / {turns.length}
          </span>
        </div>
      </div>
    </div>
  );
}
