// simulation-run-list.tsx
// Purpose: Lists past simulation runs for a scene; each opens a read-only
//          transcript view. The baseline scene text is separate and always
//          visible in the workspace — these are the saved simulated takes.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { Box, History, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SimulationPlayer } from "@/components/simulation-player";
import { TranscriptView } from "@/components/transcript-view";
import type { Character, Scene, SimulationRun } from "@/lib/types";

interface SimulationRunListProps {
  scene: Scene;
  runs: SimulationRun[];
  characters: Character[];
}

export function SimulationRunList({ scene, runs, characters }: SimulationRunListProps) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [view, setView] = useState<"transcript" | "3d">("transcript");
  const openRun = runs.find((r) => r.id === openRunId) ?? null;

  if (runs.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        <History className="size-3.5" />
        Past simulation runs
      </p>
      <div className="flex flex-col gap-1">
        {[...runs].reverse().map((run) => (
          <Dialog
            key={run.id}
            open={openRunId === run.id}
            onOpenChange={(next) => setOpenRunId(next ? run.id : null)}
          >
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground w-fit text-left text-sm underline-offset-4 hover:underline"
                />
              }
            >
              {new Date(run.createdAt).toLocaleString()} · {run.transcript.length} lines
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{new Date(run.createdAt).toLocaleString()}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={view === "transcript" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setView("transcript")}
                >
                  <MessageSquare className="size-4" />
                  Transcript
                </Button>
                <Button
                  size="sm"
                  variant={view === "3d" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setView("3d")}
                >
                  <Box className="size-4" />
                  Watch in 3D
                </Button>
              </div>
              {openRun?.id === run.id && view === "transcript" && (
                <div className="themed-scrollbar max-h-96 overflow-y-auto pr-1">
                  <TranscriptView turns={run.transcript} characters={characters} />
                </div>
              )}
              {openRun?.id === run.id && view === "3d" && (
                <SimulationPlayer scene={scene} characters={characters} run={openRun} />
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}
