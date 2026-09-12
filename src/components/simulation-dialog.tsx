// simulation-dialog.tsx
// Purpose: Triggers a turn-by-turn multi-agent conversation simulation for a
//          scene and shows it streaming in live, one line at a time. On
//          completion the run is already persisted server-side (a separate
//          SimulationRun — the scene's baseline text is never touched), and
//          the page is refreshed so it shows up in the past-runs list.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TranscriptView, type TranscriptTurn } from "@/components/transcript-view";
import type { Character, Scene } from "@/lib/types";

interface SimulationDialogProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
}

export function SimulationDialog({ scriptId, scene, characters }: SimulationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest line in view as it streams in. A fixed-height scroll
  // container (below) plus this — rather than the container growing with
  // each new line — is what keeps the dialog from visibly resizing/
  // re-centering on every turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  async function runSimulation() {
    setTurns([]);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch(`/api/scripts/${scriptId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Simulation failed to start");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as
            | { characterId: string; text: string; turnIndex: number }
            | { done: true; runId: string }
            | { error: string };

          if ("error" in parsed) {
            setError(parsed.error);
          } else if ("done" in parsed) {
            router.refresh();
          } else {
            setTurns((prev) => [...prev, { characterId: parsed.characterId, text: parsed.text }]);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && turns.length === 0 && !isRunning) {
          void runSimulation();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <GitBranch className="size-4" />
            Simulate Branch Impact
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Live simulation — {scene.title}</DialogTitle>
          <DialogDescription>
            Characters improvise the scene in character, one line at a time.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="themed-scrollbar h-96 overflow-y-auto pr-1">
          <TranscriptView turns={turns} characters={characters} />
          {isRunning && (
            <p className="text-muted-foreground mt-3 flex items-center gap-2 text-xs italic">
              <Loader2 className="size-3 animate-spin" />
              generating...
            </p>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => void runSimulation()} disabled={isRunning} className="gap-2">
            {isRunning && <Loader2 className="size-4 animate-spin" />}
            Run again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
