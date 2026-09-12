// chemistry-simulator-dialog.tsx
// Purpose: Scene Workspace action — improvise a short two-hander between two
//          chosen characters and score their chemistry. One-shot, ephemeral
//          (not saved as a SimulationRun) — a probe you try repeatedly with
//          different pairs, not a scene-defining event.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useRef, useState } from "react";
import { Loader2, Square, Users } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TranscriptView, type TranscriptTurn } from "@/components/transcript-view";
import type { Character, Scene } from "@/lib/types";

interface ChemistryResult {
  exchange: TranscriptTurn[];
  chemistryScore: number;
  rationale: string;
}

interface ChemistrySimulatorDialogProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
}

export function ChemistrySimulatorDialog({
  scriptId,
  scene,
  characters,
}: ChemistrySimulatorDialogProps) {
  const [open, setOpen] = useState(false);
  const [characterAId, setCharacterAId] = useState<string | null>(characters[0]?.id ?? null);
  const [characterBId, setCharacterBId] = useState<string | null>(characters[1]?.id ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ChemistryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const canRun = Boolean(characterAId) && Boolean(characterBId) && characterAId !== characterBId;

  async function runTest() {
    if (!canRun) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/scripts/${scriptId}/chemistry-simulator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, characterAId, characterBId }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Chemistry simulator failed");
      setResult(body.result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Stopped on purpose — not a failure worth showing an error for.
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }

  function stopTest() {
    abortControllerRef.current?.abort();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          abortControllerRef.current?.abort();
          setResult(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2" disabled={characters.length < 2}>
            <Users className="size-4" />
            Chemistry Simulator
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chemistry simulator</DialogTitle>
          <DialogDescription>
            Improvise a short exchange between two characters and score their chemistry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chemistry-character-a">Character A</Label>
              <Select value={characterAId ?? undefined} onValueChange={(value) => setCharacterAId(value as string)}>
                <SelectTrigger id="chemistry-character-a" className="w-full">
                  <SelectValue placeholder="Choose">
                    {characters.find((character) => character.id === characterAId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="chemistry-character-b">Character B</Label>
              <Select value={characterBId ?? undefined} onValueChange={(value) => setCharacterBId(value as string)}>
                <SelectTrigger id="chemistry-character-b" className="w-full">
                  <SelectValue placeholder="Choose">
                    {characters.find((character) => character.id === characterBId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {characterAId && characterAId === characterBId && (
            <p className="text-destructive text-xs">Choose two different characters.</p>
          )}

          {isRunning && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs italic">
              <Loader2 className="size-3 animate-spin" />
              running…
            </p>
          )}

          {result && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Chemistry score
                </span>
                <span className="text-sm font-semibold tabular-nums">{result.chemistryScore}%</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <TranscriptView turns={result.exchange} characters={characters} />
              </div>
              <p className="text-muted-foreground text-xs">{result.rationale}</p>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {isRunning ? (
            <Button variant="destructive" onClick={stopTest} className="gap-2">
              <Square className="size-4" />
              Stop
            </Button>
          ) : (
            <Button onClick={() => void runTest()} disabled={!canRun} className="gap-2">
              {result ? "Run again" : "Run test"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
