// editor-view.tsx
// Purpose: Client shell for the Editor View — owns the playhead and the
//          working spec (keyframes are edited here, in memory), advances
//          playback, runs the analyzer, and composes the (SSR-disabled) 3D
//          Stage with the keyframe Timeline and NotesPanel. Read plan.md §6.6
//          before touching this: `three` must never render on the server.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Move, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NotesPanel } from "@/ui/NotesPanel";
import { KeyframeTimeline } from "@/ui/KeyframeTimeline";
import { runAnalyzer } from "@/analyze/index";
import { resolvePose, specDuration } from "@/render/blocking";
import { deleteKeyframe, moveKeyframe, upsertKeyframe, type Pose } from "@/render/keyframes";
import { usePlayhead } from "@/render/usePlayhead";
import { cn } from "@/lib/utils";
import type { GizmoMode } from "@/render/Stage";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const Stage = dynamic(() => import("@/render/Stage").then((m) => m.Stage), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
      Loading stage…
    </div>
  ),
});

interface EditorViewProps {
  spec: PrevisSpec;
}

export function EditorView({ spec: initialSpec }: EditorViewProps) {
  // Keyframe edits live here, not in the database — this is a working copy of
  // the server-built spec, reset whenever a different scene is opened.
  const [spec, setSpec] = useState(initialSpec);
  useEffect(() => {
    setSpec(initialSpec);
    setSelectedCharacterId(initialSpec.cast[0]?.id ?? null);
  }, [initialSpec]);

  const duration = specDuration(spec);
  const { time, isPlaying, setTime, togglePlay } = usePlayhead(duration);
  const { notes, totalCount } = useMemo(() => runAnalyzer(spec), [spec]);
  const [highlighted, setHighlighted] = useState<string[]>([]);
  // Start with a track selected, so "+ Keyframe" and the delete button are not
  // dead on arrival with no visible reason why.
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    initialSpec.cast[0]?.id ?? null
  );
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");

  const selectedCharacter = spec.cast.find((c) => c.id === selectedCharacterId) ?? null;

  function handleNoteClick(note: Note) {
    const firstBeat = spec.beats.find((b) => b.id === note.beatIds[0]);
    if (firstBeat) setTime(firstBeat.startTime);
    setHighlighted(note.characterIds);
  }

  /** Toolbar / double-click add: key whatever pose the character holds now,
   *  so placing a keyframe never moves anyone. */
  const handleAddKeyframe = useCallback(
    (characterId: string, at: number) => {
      setSpec((current) => upsertKeyframe(current, characterId, at, resolvePose(current, characterId, at)));
    },
    []
  );

  /** Gizmo drag finished on stage: that pose becomes the keyframe. */
  const handlePoseCommit = useCallback(
    (characterId: string, pose: Pose) => {
      setSpec((current) => upsertKeyframe(current, characterId, time, pose));
    },
    [time]
  );

  const handleMoveKeyframe = useCallback((keyframeId: string, at: number) => {
    setSpec((current) => moveKeyframe(current, keyframeId, at));
  }, []);

  const handleDeleteKeyframe = useCallback((keyframeId: string) => {
    setSpec((current) => deleteKeyframe(current, keyframeId));
  }, []);

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Button>
        <span className="text-muted-foreground text-sm">{spec.scene.slugline}</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1">
            <Stage
              spec={spec}
              time={time}
              highlightedCharacterIds={highlighted}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={setSelectedCharacterId}
              onPoseCommit={handlePoseCommit}
              gizmoMode={gizmoMode}
            />

            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
              <div className="pointer-events-auto bg-background/80 flex items-center gap-1 rounded-lg border p-1 backdrop-blur">
                <Button
                  variant={gizmoMode === "translate" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setGizmoMode("translate")}
                  aria-label="Move tool"
                  title="Move (floor plane)"
                >
                  <Move className={cn("size-4")} />
                </Button>
                <Button
                  variant={gizmoMode === "rotate" ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setGizmoMode("rotate")}
                  aria-label="Rotate tool"
                  title="Rotate (facing)"
                >
                  <RotateCw className="size-4" />
                </Button>
              </div>

              <span className="bg-background/80 rounded-md border px-2 py-1 text-xs backdrop-blur">
                {selectedCharacter ? (
                  <>
                    <span
                      className="mr-1.5 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: selectedCharacter.color }}
                    />
                    <span className="font-medium">{selectedCharacter.name}</span>
                    <span className="text-muted-foreground"> — drag to keyframe at the playhead</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Click a character to keyframe it</span>
                )}
              </span>
            </div>
          </div>

          <KeyframeTimeline
            spec={spec}
            time={time}
            duration={duration}
            isPlaying={isPlaying}
            onTimeChange={setTime}
            onTogglePlay={togglePlay}
            selectedCharacterId={selectedCharacterId}
            onSelectCharacter={setSelectedCharacterId}
            onAddKeyframe={handleAddKeyframe}
            onMoveKeyframe={handleMoveKeyframe}
            onDeleteKeyframe={handleDeleteKeyframe}
          />
        </div>
        <aside className="bg-sidebar w-80 shrink-0 overflow-y-auto border-l">
          <NotesPanel notes={notes} totalCount={totalCount} onNoteClick={handleNoteClick} />
        </aside>
      </div>
    </div>
  );
}
