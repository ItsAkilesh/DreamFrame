// motivation-stress-test-dialog.tsx
// Purpose: Scene Workspace action — put one character under an author-chosen
//          pressure scenario and see whether their reaction actually holds
//          to their stated motivation. One-shot, ephemeral (not saved as a
//          SimulationRun): a probe you try repeatedly with different
//          scenarios, not a scene-defining event.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { Character, Scene } from "@/lib/types";

const DEFAULT_PRESSURE_SCENARIO =
  "Someone credible offers a way out that requires abandoning what they want most in this scene.";

interface StressTestResult {
  reaction: string;
  stayedConsistent: boolean;
  consistencyScore: number;
  rationale: string;
}

interface MotivationStressTestDialogProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
}

export function MotivationStressTestDialog({
  scriptId,
  scene,
  characters,
}: MotivationStressTestDialogProps) {
  const [open, setOpen] = useState(false);
  const [characterId, setCharacterId] = useState<string | null>(characters[0]?.id ?? null);
  const [pressureScenario, setPressureScenario] = useState(DEFAULT_PRESSURE_SCENARIO);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const character = characters.find((c) => c.id === characterId) ?? null;

  async function runTest() {
    if (!character) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/scripts/${scriptId}/motivation-stress-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id, characterId: character.id, pressureScenario }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Stress test failed");
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
          <Button variant="outline" size="sm" className="gap-2" disabled={characters.length === 0}>
            <Sparkles className="size-4" />
            Motivation Stress Test
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Motivation stress test</DialogTitle>
          <DialogDescription>
            Put a character under pressure and see whether their reaction holds to their stated motivation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stress-character">Character</Label>
            <Select value={characterId ?? undefined} onValueChange={(value) => setCharacterId(value as string)}>
              <SelectTrigger id="stress-character" className="w-full">
                <SelectValue placeholder="Choose a character">{character?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {characters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {character && (
              <p className="text-muted-foreground text-xs">Motivation: {character.motivation}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stress-scenario">Pressure scenario</Label>
            <Textarea
              id="stress-scenario"
              value={pressureScenario}
              onChange={(event) => setPressureScenario(event.target.value)}
              disabled={isRunning}
              className="min-h-20 text-sm"
            />
          </div>

          {isRunning && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs italic">
              <Loader2 className="size-3 animate-spin" />
              running…
            </p>
          )}

          {result && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant={result.stayedConsistent ? "secondary" : "destructive"}
                  className="gap-1"
                >
                  {result.stayedConsistent ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                  {result.stayedConsistent ? "Stayed consistent" : "Broke character"}
                </Badge>
                <span className="text-sm font-semibold tabular-nums">{result.consistencyScore}%</span>
              </div>
              <p className="text-sm italic">&ldquo;{result.reaction}&rdquo;</p>
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
            <Button onClick={() => void runTest()} disabled={!character} className="gap-2">
              {result ? "Run again" : "Run test"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
