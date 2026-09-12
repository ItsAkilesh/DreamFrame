// editor-view.tsx
// Purpose: Client shell for the Editor View — owns the playhead, advances it
//          during playback, runs the analyzer, and composes the (SSR-
//          disabled) 3D Stage with the Timeline and NotesPanel. Read
//          plan.md §6.6 before touching this: `three` must never render on
//          the server.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NotesPanel } from "@/ui/NotesPanel";
import { Timeline } from "@/ui/Timeline";
import { runAnalyzer } from "@/analyze/index";
import { specDuration } from "@/render/blocking";
import { usePlayhead } from "@/render/usePlayhead";
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

export function EditorView({ spec }: EditorViewProps) {
  const duration = specDuration(spec);
  const { time, isPlaying, setTime, togglePlay } = usePlayhead(duration);
  const { notes, totalCount } = useMemo(() => runAnalyzer(spec), [spec]);
  const [highlighted, setHighlighted] = useState<string[]>([]);

  function handleNoteClick(note: Note) {
    const firstBeat = spec.beats.find((b) => b.id === note.beatIds[0]);
    if (firstBeat) setTime(firstBeat.startTime);
    setHighlighted(note.characterIds);
  }

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
          <div className="flex-1">
            <Stage spec={spec} time={time} highlightedCharacterIds={highlighted} />
          </div>
          <Timeline
            spec={spec}
            time={time}
            onTimeChange={setTime}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
          />
        </div>
        <aside className="bg-sidebar w-80 shrink-0 overflow-y-auto border-l">
          <NotesPanel notes={notes} totalCount={totalCount} onNoteClick={handleNoteClick} />
        </aside>
      </div>
    </div>
  );
}
