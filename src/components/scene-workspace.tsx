// scene-workspace.tsx
// Purpose: Center panel — selected scene's text, character roster, and the
//          simulation actions available on it. Scene title, tone, text, and
//          cast are editable, correcting the AI structuring pass. Motivation
//          Stress Test / Chemistry Simulator remain disabled placeholders;
//          Simulate Branch Impact runs the real turn-by-turn agent engine.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, LucideIcon, Sparkles, Users } from "lucide-react";

import { CharacterEditDialog } from "@/components/character-edit-dialog";
import { EditableField } from "@/components/editable-field";
import { SceneCharactersDialog } from "@/components/scene-characters-dialog";
import { ScenePlayer } from "@/components/scene-player";
import { SimulationDialog } from "@/components/simulation-dialog";
import { SimulationRunList } from "@/components/simulation-run-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { patchScript } from "@/lib/scripts/patch-client";
import type { Character, Scene, SimulationRun } from "@/lib/types";

interface SceneWorkspaceProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
  simulationRuns: SimulationRun[];
}

function DisabledAction({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="outline" size="sm" disabled className="gap-2">
            <Icon className="size-4" />
            {label}
          </Button>
        }
      />
      <TooltipContent>Not wired up yet — simulation engine is next.</TooltipContent>
    </Tooltip>
  );
}

export function SceneWorkspace({
  scriptId,
  scene,
  characters,
  simulationRuns,
}: SceneWorkspaceProps) {
  const router = useRouter();
  const [showScene, setShowScene] = useState(false);
  const sceneCharacters = characters.filter((character) =>
    scene.characterIds.includes(character.id)
  );
  const sceneRuns = simulationRuns.filter((run) => run.sceneId === scene.id);

  async function saveTitle(next: string) {
    await patchScript(scriptId, { type: "scene", id: scene.id, title: next });
    router.refresh();
  }

  async function saveToneTarget(next: string) {
    await patchScript(scriptId, { type: "scene", id: scene.id, toneTarget: next });
    router.refresh();
  }

  async function saveText(next: string) {
    await patchScript(scriptId, { type: "scene", id: scene.id, text: next });
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {showScene && <ScenePlayer scene={scene} characters={sceneCharacters} />}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={showScene ? "secondary" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setShowScene((v) => !v)}
        >
          <Clapperboard className="size-4" />
          Show Scene
        </Button>
        <SimulationDialog scriptId={scriptId} scene={scene} characters={sceneCharacters} />
        <DisabledAction icon={Sparkles} label="Motivation Stress Test" />
        <DisabledAction icon={Users} label="Chemistry Simulator" />
      </div>

      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <EditableField
                label="scene title"
                value={scene.title}
                onSave={saveTitle}
                className="font-heading text-base leading-none font-medium"
              />
              <p className="text-muted-foreground mt-1 text-sm">
                Scene {scene.order}
              </p>
            </div>
            <EditableField
              label="tone target"
              value={scene.toneTarget}
              onSave={saveToneTarget}
              displayClassName="shrink-0"
              className="rounded-4xl bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <EditableField
            label="scene text"
            value={scene.text}
            onSave={saveText}
            multiline
            className="typeset typeset-docs max-w-[42em]"
          />

          <Separator />

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Characters in scene
              </p>
              <SceneCharactersDialog scriptId={scriptId} scene={scene} allCharacters={characters} />
            </div>
            <div className="flex flex-wrap gap-2">
              {sceneCharacters.map((character) => (
                <CharacterEditDialog
                  key={character.id}
                  scriptId={scriptId}
                  character={character}
                  trigger={
                    <Badge
                      variant="outline"
                      className="cursor-pointer gap-1.5 py-1"
                      render={<button type="button" title={character.motivation} />}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: character.color }}
                      />
                      {character.name}
                    </Badge>
                  }
                />
              ))}
            </div>
          </div>

          {sceneRuns.length > 0 && (
            <>
              <Separator />
              <SimulationRunList runs={sceneRuns} characters={sceneCharacters} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
