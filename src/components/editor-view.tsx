// editor-view.tsx
// Purpose: Client shell for the Editor View — owns the playhead, advances it
//          during playback, and composes the (SSR-disabled) 3D Stage with
//          the Timeline. Read plan.md §6.6 before touching this: `three`
//          must never render on the server.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Timeline } from "@/ui/Timeline";
import { specDuration } from "@/render/blocking";
import type { PrevisSpec } from "@/schema/previsSpec";

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
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const duration = specDuration(spec);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastTickRef.current = null;
      return;
    }

    let frame: number;
    const tick = (now: number) => {
      const last = lastTickRef.current ?? now;
      const delta = (now - last) / 1000;
      lastTickRef.current = now;

      setTime((prev) => {
        const next = prev + delta;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, duration]);

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

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1">
          <Stage spec={spec} time={time} />
        </div>
        <Timeline
          spec={spec}
          time={time}
          onTimeChange={(next) => {
            setTime(next);
            setIsPlaying(false);
          }}
          isPlaying={isPlaying}
          onTogglePlay={() => {
            if (!isPlaying && time >= duration) setTime(0);
            setIsPlaying((p) => !p);
          }}
        />
      </div>
    </div>
  );
}
