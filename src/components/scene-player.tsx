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
import { GitBranch, Loader2, Square, Volume2, VolumeX } from "lucide-react";

import { SimulationStage } from "@/components/simulation-stage";
import { TranscriptView } from "@/components/transcript-view";
import { Button } from "@/components/ui/button";
import { type PlayableTurn, useTurnPlayback } from "@/lib/use-turn-playback";
import type { Character, Scene } from "@/lib/types";

type LiveTurn = PlayableTurn;

interface ScenePlayerProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
  // Bumped by the Scene Workspace's own "Simulate Branch Impact" toolbar
  // button so a run can be kicked off from outside this panel (e.g. the
  // moment it's first revealed) without duplicating runSimulation's logic
  // up there. The initial value never triggers a run on mount — only a
  // change away from it does.
  runSignal?: number;
}

export function ScenePlayer({ scriptId, scene, characters, runSignal }: ScenePlayerProps) {
  const router = useRouter();
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  // True for the window after the transcript finishes but before the run is
  // fully "done" — the server is still running the audience panel (several
  // more LLM calls) against the completed transcript. Distinct from
  // isRunning so the UI can say why it's still waiting instead of looking
  // stalled the way an unexplained slow request always does.
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Turns arrive from the server as fast as the LLM responds — this paces
  // them out at speech speed (voiced where possible) instead of revealing
  // each line the instant it's generated. isLive keeps it waiting for more
  // rather than stopping once it catches up to what's arrived so far.
  const {
    currentIndex,
    currentTurn,
    hasStartedCurrentTurn,
    revealedIndex,
    isWaitingForMore,
    isMuted,
    toggleMute,
    primeAudio,
  } = useTurnPlayback({
    turns,
    characters,
    isLive: isRunning,
    autoPlay: true,
    sceneContext: `${scene.title}. ${scene.toneTarget}`,
  });
  // Captions appear only once their audio actually begins. This keeps what
  // the user sees and hears locked to the same turn instead of showing text
  // while ElevenLabs is still synthesizing it.
  const revealedTurns = revealedIndex >= 0 ? turns.slice(0, revealedIndex + 1) : [];
  const activeTurn = hasStartedCurrentTurn ? currentTurn : null;

  // Keep the latest *revealed* (spoken) line in view, not the latest one to
  // have arrived from the server — those can race ahead of playback.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentIndex]);

  async function runSimulation() {
    // Called directly from a click handler — this must stay the first thing
    // that happens, synchronously, so the audio element gets "activated" by
    // that same click and later voiced turns aren't silently blocked by the
    // browser's autoplay policy (see primeAudio's own comment).
    primeAudio();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setTurns([]);
    setError(null);
    setIsRunning(true);
    setIsReviewing(false);

    try {
      const response = await fetch(`/api/scripts/${scriptId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id }),
        signal: controller.signal,
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
            | { characterId: string; text: string; turnIndex: number; action: string; voiceDirection?: string; animationAssetId: string | null }
            | { done: true; runId: string }
            | { status: "reviewing" }
            | { error: string };

          if ("error" in parsed) {
            setError(parsed.error);
          } else if ("done" in parsed) {
            setIsReviewing(false);
            router.refresh();
          } else if ("status" in parsed) {
            if (parsed.status === "reviewing") setIsReviewing(true);
          } else {
            setTurns((prev) => [
              ...prev,
              {
                characterId: parsed.characterId,
                text: parsed.text,
                action: parsed.action,
                voiceDirection: parsed.voiceDirection,
                animationAssetId: parsed.animationAssetId,
              },
            ]);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Stopped on purpose. The route saves whatever transcript had
        // already been generated before it noticed the disconnect, so a
        // refresh (after giving it a moment to finish that save) picks up
        // a partial run instead of losing it.
        setTimeout(() => router.refresh(), 500);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsRunning(false);
      setIsReviewing(false);
      abortControllerRef.current = null;
    }
  }

  function stopSimulation() {
    abortControllerRef.current?.abort();
  }

  // The Scene Workspace's own toolbar button bumps runSignal to ask for a
  // run from outside this panel. The ref (not a plain "did we run yet"
  // boolean) is what keeps the very first render — runSignal already at
  // its initial value — from triggering a run on mount.
  const lastRunSignalRef = useRef(runSignal);
  useEffect(() => {
    if (runSignal === undefined || runSignal === lastRunSignalRef.current) return;
    lastRunSignalRef.current = runSignal;
    void runSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runSimulation closes over state that changes every render; re-running this effect on those would defeat the "only on an explicit new signal" point of it.
  }, [runSignal]);

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
          {isReviewing
            ? "Gathering audience reactions…"
            : isRunning
              ? "Simulating…"
              : turns.length > 0
                ? "Last simulation"
                : "Scene preview"}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={isMuted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX /> : <Volume2 />}
          </Button>
          {isRunning ? (
            <Button size="sm" variant="destructive" className="gap-2" onClick={stopSimulation}>
              <Square className="size-4" />
              Stop
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void runSimulation()}>
              <GitBranch className="size-4" />
              {turns.length > 0 ? "Run again" : "Simulate Branch Impact"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SimulationStage
          scene={scene}
          characters={characters}
          speakingCharacterId={activeTurn?.characterId ?? null}
          animationAssetId={activeTurn?.animationAssetId}
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
              <TranscriptView turns={revealedTurns} characters={characters} />
            </div>
          )}
          {(isRunning || isWaitingForMore) && !isReviewing && (
            <p className="text-muted-foreground flex items-center gap-2 p-3 text-xs italic">
              <Loader2 className="size-3 animate-spin" />
              generating...
            </p>
          )}
          {isReviewing && (
            <p className="text-muted-foreground flex items-center gap-2 p-3 text-xs italic">
              <Loader2 className="size-3 animate-spin" />
              the scene finished — running it past a panel of audience reactions...
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
