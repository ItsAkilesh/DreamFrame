// Timeline.tsx
// Purpose: Scrub bar with a marker per beat, a play/pause control, and a
//          caption showing the active beat's line (or a description for
//          action-only beats).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { activeBeat, specDuration } from "@/render/blocking";
import type { PrevisSpec } from "@/schema/previsSpec";

interface TimelineProps {
  spec: PrevisSpec;
  time: number;
  onTimeChange: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function Timeline({ spec, time, onTimeChange, isPlaying, onTogglePlay }: TimelineProps) {
  const duration = Math.max(specDuration(spec), 0.1);
  const beat = activeBeat(spec, time);
  const character = beat?.line ? spec.cast.find((c) => c.id === beat.line?.characterId) : null;

  return (
    <div className="flex flex-col gap-2 border-t bg-background px-4 py-3">
      <p className="min-h-5 text-sm">
        {beat?.line ? (
          <>
            <span className="font-medium">{character?.name ?? beat.line.characterId}: </span>
            <span>{beat.line.text}</span>
          </>
        ) : (
          <span className="text-muted-foreground italic">(action, no dialogue)</span>
        )}
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-[2px]">
            {spec.beats.map((b) => (
              <div
                key={b.id}
                className="absolute h-2 w-px bg-border"
                style={{ left: `${(b.startTime / duration) * 100}%` }}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={Math.min(time, duration)}
            onChange={(event) => onTimeChange(Number(event.target.value))}
            className="w-full"
            aria-label="Playhead"
          />
        </div>

        <span className="text-muted-foreground w-16 shrink-0 text-right text-xs tabular-nums">
          {time.toFixed(1)}s / {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
