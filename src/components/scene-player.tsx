// scene-player.tsx
// Purpose: The Scene Workspace's inline "Show Scene" panel — the cast stands
//          in the scene's assigned environment (or the placeholder ground)
//          via the same SimulationStage view saved/live simulation playback
//          uses, with a running transcript alongside it. Simulation happens
//          *here*: "Simulate Branch Impact" streams a live turn-by-turn run
//          straight into this panel — the cast acts each line out in 3D on
//          the left as the script rolls in on the right — never in a popup.
//          On completion the run is already persisted server-side as a
//          SimulationRun (the scene's baseline text is untouched); the page
//          refresh picks it up in the past-runs list below.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2 } from "lucide-react";

import { SimulationStage } from "@/components/simulation-stage";
import { TranscriptView } from "@/components/transcript-view";
import { Button } from "@/components/ui/button";
import type { Character, Scene } from "@/lib/types";

interface LiveTurn {
  characterId: string;
  text: string;
  action: string;
  animationAssetId: string | null;
}

interface ScenePlayerProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
}

export function ScenePlayer({ scriptId, scene, characters }: ScenePlayerProps) {
  const router = useRouter();
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest line in view as it streams in, rather than the
  // transcript column growing and pushing the stage around.
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
            | { characterId: string; text: string; turnIndex: number; action: string; animationAssetId: string | null }
            | { done: true; runId: string }
            | { error: string };

          if ("error" in parsed) {
            setError(parsed.error);
          } else if ("done" in parsed) {
            router.refresh();
          } else {
            setTurns((prev) => [
              ...prev,
              {
                characterId: parsed.characterId,
                text: parsed.text,
                action: parsed.action,
                animationAssetId: parsed.animationAssetId,
              },
            ]);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsRunning(false);
    }
  }

  const latestTurn = turns[turns.length - 1] ?? null;

  if (characters.length === 0) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center rounded-lg border text-sm">
        This scene has no characters assigned yet, so there&apos;s nothing to act out.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {isRunning ? "Simulating…" : turns.length > 0 ? "Last simulation" : "Scene preview"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => void runSimulation()}
          disabled={isRunning}
        >
          {isRunning ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
          {turns.length > 0 || isRunning ? "Run again" : "Simulate Branch Impact"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SimulationStage
          scene={scene}
          characters={characters}
          speakingCharacterId={latestTurn?.characterId ?? null}
          animationAssetId={latestTurn?.animationAssetId}
          className="bg-muted/40 h-80 overflow-hidden rounded-md"
        />

        <div ref={scrollRef} className="themed-scrollbar h-80 overflow-y-auto rounded-md border pr-1 pl-1">
          {turns.length === 0 && !isRunning ? (
            <p className="text-muted-foreground p-3 text-sm">
              Click Simulate Branch Impact to have the cast improvise this scene, acting it out
              live as the script rolls in here.
            </p>
          ) : (
            <div className="p-2">
              <TranscriptView turns={turns} characters={characters} />
            </div>
          )}
          {isRunning && (
            <p className="text-muted-foreground flex items-center gap-2 p-3 text-xs italic">
              <Loader2 className="size-3 animate-spin" />
              generating...
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
