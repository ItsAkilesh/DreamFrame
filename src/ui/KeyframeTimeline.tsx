// KeyframeTimeline.tsx
// Purpose: Clipchamp-style timeline for the Editor View — a timecode ruler, a
//          beat track, one keyframe track per character, and a draggable
//          playhead, all sharing one pixels-per-second scale. Adding a
//          keyframe stamps the playhead's timestamp onto the selected
//          character's track; the Stage reads those keyframes back through
//          render/blocking.ts, so the diamonds here are what the 3D viewer
//          plays.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Diamond, Pause, Play, Plus, SkipBack, Trash2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { activeBeat } from "@/render/blocking";
import { formatTimecode, snapTime } from "@/render/keyframes";
import { cn } from "@/lib/utils";
import type { PrevisSpec } from "@/schema/previsSpec";

// Row heights, in px. The left gutter mirrors them exactly so labels line up
// with their track.
const RULER_H = 26;
const BEAT_H = 30;
const TRACK_H = 34;
const GUTTER_W = 168;

const MIN_PPS = 24;
const MAX_PPS = 400;
const DEFAULT_PPS = 90;

/** Candidate ruler intervals, in seconds; the first one wide enough wins. */
const TICK_INTERVALS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
const MIN_TICK_PX = 64;

/** Beat starts within this many px of a dragged time pull it into line. */
const SNAP_PX = 6;

interface KeyframeTimelineProps {
  spec: PrevisSpec;
  time: number;
  duration: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onTogglePlay: () => void;
  selectedCharacterId: string | null;
  onSelectCharacter: (characterId: string | null) => void;
  onAddKeyframe: (characterId: string, time: number) => void;
  onMoveKeyframe: (keyframeId: string, time: number) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
}

export function KeyframeTimeline({
  spec,
  time,
  duration,
  isPlaying,
  onTimeChange,
  onTogglePlay,
  selectedCharacterId,
  onSelectCharacter,
  onAddKeyframe,
  onMoveKeyframe,
  onDeleteKeyframe,
}: KeyframeTimelineProps) {
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PPS);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const span = Math.max(duration, 1);
  const contentWidth = span * pxPerSecond;
  const beat = activeBeat(spec, time);
  const speaker = beat?.line ? spec.cast.find((c) => c.id === beat.line?.characterId) : null;
  const selectedKeyframe = spec.keyframes.find((k) => k.id === selectedKeyframeId) ?? null;

  const tickInterval =
    TICK_INTERVALS.find((i) => i * pxPerSecond >= MIN_TICK_PX) ?? TICK_INTERVALS[TICK_INTERVALS.length - 1];
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= span + 1e-6; t += tickInterval) out.push(Number(t.toFixed(3)));
    return out;
  }, [span, tickInterval]);

  /** Client X -> playhead time, snapped to the grid and to nearby beat starts. */
  const timeAt = useCallback(
    (clientX: number): number => {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const raw = Math.min(Math.max((clientX - rect.left) / pxPerSecond, 0), span);
      const snapWindow = SNAP_PX / pxPerSecond;
      const nearBeat = spec.beats.find((b) => Math.abs(b.startTime - raw) <= snapWindow);
      return nearBeat ? nearBeat.startTime : snapTime(raw);
    },
    [pxPerSecond, span, spec.beats]
  );

  /** Press-and-drag anywhere on the ruler or a track background scrubs. */
  function scrubFrom(event: React.PointerEvent) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    onTimeChange(timeAt(event.clientX));
  }

  function scrubMove(event: React.PointerEvent) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onTimeChange(timeAt(event.clientX));
  }

  // Delete/Backspace clears the selected diamond, the way every NLE does it.
  useEffect(() => {
    if (!selectedKeyframeId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      onDeleteKeyframe(selectedKeyframeId!);
      setSelectedKeyframeId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedKeyframeId, onDeleteKeyframe]);

  // Keep the playhead on screen while it runs past the right edge.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = time * pxPerSecond;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 24) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.5);
    }
  }, [time, pxPerSecond]);

  const addAtPlayhead = (characterId: string) => {
    onSelectCharacter(characterId);
    onAddKeyframe(characterId, time);
  };

  return (
    <div className="bg-background flex shrink-0 flex-col border-t select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onTimeChange(0)}
          aria-label="Back to start"
        >
          <SkipBack className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <span className="w-28 shrink-0 text-xs tabular-nums">
          <span className="font-medium">{formatTimecode(time)}</span>
          <span className="text-muted-foreground"> / {formatTimecode(duration)}</span>
        </span>

        <p className="min-w-0 flex-1 truncate text-xs">
          {beat?.line ? (
            <>
              <span className="font-medium">{speaker?.name ?? beat.line.characterId}: </span>
              <span className="text-muted-foreground">{beat.line.text}</span>
            </>
          ) : (
            <span className="text-muted-foreground italic">(action, no dialogue)</span>
          )}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!selectedCharacterId}
          onClick={() => selectedCharacterId && addAtPlayhead(selectedCharacterId)}
          title={
            selectedCharacterId
              ? `Add a keyframe at ${formatTimecode(time)}`
              : "Select a character track first"
          }
        >
          <Plus className="size-3.5" />
          Keyframe
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!selectedKeyframe}
          onClick={() => {
            if (!selectedKeyframe) return;
            onDeleteKeyframe(selectedKeyframe.id);
            setSelectedKeyframeId(null);
          }}
          aria-label="Delete selected keyframe"
          title={
            selectedKeyframe
              ? `Delete the ${formatTimecode(selectedKeyframe.time)} keyframe (or press Delete)`
              : "Click a keyframe diamond to select it first"
          }
        >
          <Trash2 className="size-4" />
        </Button>

        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPxPerSecond((p) => Math.max(MIN_PPS, p / 1.5))}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPxPerSecond((p) => Math.min(MAX_PPS, p * 1.5))}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      {/* Gutter + tracks. Vertical overflow scrolls the gutter and the tracks
          together, so a label never drifts off its row. */}
      <div className="flex max-h-64 overflow-y-auto border-t">
        <div className="bg-muted/40 shrink-0 border-r" style={{ width: GUTTER_W }}>
          <div className="border-b" style={{ height: RULER_H }} />
          <div
            className="text-muted-foreground flex items-center px-3 text-[11px] font-medium tracking-wide uppercase"
            style={{ height: BEAT_H }}
          >
            Beats
          </div>
          {spec.cast.map((character) => {
            const count = spec.keyframes.filter((k) => k.characterId === character.id).length;
            const active = character.id === selectedCharacterId;
            return (
              <div
                key={character.id}
                onClick={() => onSelectCharacter(active ? null : character.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border-t px-2 text-xs",
                  active && "bg-accent"
                )}
                style={{ height: TRACK_H }}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: character.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{character.name}</span>
                <span className="text-muted-foreground tabular-nums">{count}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    addAtPlayhead(character.id);
                  }}
                  aria-label={`Add keyframe for ${character.name}`}
                  title={`Add a keyframe for ${character.name} at ${formatTimecode(time)}`}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
          <div ref={contentRef} className="relative" style={{ width: contentWidth }}>
            {/* Ruler */}
            <div
              className="bg-muted/40 relative border-b"
              style={{ height: RULER_H }}
              onPointerDown={scrubFrom}
              onPointerMove={scrubMove}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full" style={{ left: t * pxPerSecond }}>
                  <div className="bg-border absolute top-0 h-2 w-px" />
                  <span className="text-muted-foreground absolute top-2 left-1 text-[10px] tabular-nums">
                    {formatTimecode(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* Beat track */}
            <div
              className="relative"
              style={{ height: BEAT_H }}
              onPointerDown={scrubFrom}
              onPointerMove={scrubMove}
            >
              {spec.beats.map((b) => (
                <div
                  key={b.id}
                  className="bg-primary/15 border-primary/40 absolute top-1 bottom-1 overflow-hidden rounded border px-1.5 text-[10px] leading-5"
                  style={{
                    left: b.startTime * pxPerSecond,
                    width: Math.max(2, b.duration * pxPerSecond - 2),
                  }}
                  title={`${b.id} — ${formatTimecode(b.startTime)}`}
                >
                  <span className="truncate">{b.line?.text ?? b.id}</span>
                </div>
              ))}
            </div>

            {/* One keyframe track per character */}
            {spec.cast.map((character) => {
              const active = character.id === selectedCharacterId;
              const track = spec.keyframes.filter((k) => k.characterId === character.id);
              return (
                <div
                  key={character.id}
                  className={cn("relative border-t", active && "bg-accent/40")}
                  style={{ height: TRACK_H }}
                  onPointerDown={(event) => {
                    onSelectCharacter(character.id);
                    scrubFrom(event);
                  }}
                  onPointerMove={scrubMove}
                  onDoubleClick={(event) => onAddKeyframe(character.id, timeAt(event.clientX))}
                >
                  {/* Track line, so an empty track still reads as a track */}
                  <div className="bg-border/60 absolute inset-x-0 top-1/2 h-px" />

                  {track.map((keyframe) => {
                    const isSelected = keyframe.id === selectedKeyframeId;
                    return (
                      <div
                        key={keyframe.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${character.name} keyframe at ${formatTimecode(keyframe.time)}`}
                        title={`${character.name} · ${formatTimecode(keyframe.time)} — drag to retime, Delete to remove`}
                        className={cn(
                          "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border transition-[box-shadow,transform]",
                          isSelected
                            ? "border-foreground ring-foreground/30 scale-125 ring-2"
                            : "border-background/70"
                        )}
                        style={{
                          left: keyframe.time * pxPerSecond,
                          backgroundColor: character.color,
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (event.button !== 0) return;
                          // Select first: setPointerCapture throws on some
                          // synthetic and stylus events, and losing selection
                          // to that would make the keyframe undeletable.
                          setSelectedKeyframeId(keyframe.id);
                          setDraggingKeyframeId(keyframe.id);
                          try {
                            event.currentTarget.setPointerCapture(event.pointerId);
                          } catch {
                            /* dragging still works without capture */
                          }
                          onSelectCharacter(character.id);
                          onTimeChange(keyframe.time);
                        }}
                        onPointerMove={(event) => {
                          if (draggingKeyframeId !== keyframe.id) return;
                          const next = timeAt(event.clientX);
                          onMoveKeyframe(keyframe.id, next);
                          onTimeChange(next);
                        }}
                        onPointerUp={() => setDraggingKeyframeId(null)}
                        onPointerCancel={() => setDraggingKeyframeId(null)}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Playhead, spanning every row */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
              style={{ left: time * pxPerSecond }}
            >
              <div className="absolute -top-px -left-[5px] size-2.5 rotate-45 rounded-[2px] bg-red-500" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground border-t px-3 py-1.5 text-[11px]">
        <Diamond className="mr-1 inline size-3 -translate-y-px" />
        Pick a character, scrub to a timestamp, then drag them on stage — or move with{" "}
        <kbd className="bg-muted rounded px-1">W A S D</kbd> /{" "}
        <kbd className="bg-muted rounded px-1">↑ ↓ ← →</kbd> and turn with{" "}
        <kbd className="bg-muted rounded px-1">Q</kbd> <kbd className="bg-muted rounded px-1">E</kbd>{" "}
        (<kbd className="bg-muted rounded px-1">Shift</kbd> bigger,{" "}
        <kbd className="bg-muted rounded px-1">Alt</kbd> finer). Double-click a track to key the
        current pose; drag a diamond to retime it.
      </p>
    </div>
  );
}
