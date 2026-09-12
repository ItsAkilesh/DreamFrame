// scene-workspace.tsx
// Purpose: Center panel — selected scene's text, character roster, and the
//          simulation actions available on it. Scene title, tone, text, and
//          cast are editable, correcting the AI structuring pass. All three
//          simulation actions are real: Simulate Branch Impact reveals the
//          live turn-by-turn ScenePlayer, Motivation Stress Test and
//          Chemistry Simulator each run a focused one-shot AI probe in
//          their own dialog.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, GitBranch } from "lucide-react";

import { AudiencePersonasDialog } from "@/components/audience-personas-dialog";
import { CharacterEditDialog } from "@/components/character-edit-dialog";
import { ChemistrySimulatorDialog } from "@/components/chemistry-simulator-dialog";
import { EditableField } from "@/components/editable-field";
import { MotivationStressTestDialog } from "@/components/motivation-stress-test-dialog";
import { SceneCharactersDialog } from "@/components/scene-characters-dialog";
import { SceneModelUpload } from "@/components/scene-model-upload";
import { ScenePlayer } from "@/components/scene-player";
import { SimulationRunList } from "@/components/simulation-run-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { patchScript } from "@/lib/scripts/patch-client";
import type { AudiencePersona, Character, Scene, SimulationRun } from "@/lib/types";

interface SceneWorkspaceProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
  simulationRuns: SimulationRun[];
  audiencePersonas: AudiencePersona[];
}

export function SceneWorkspace({
  scriptId,
  scene,
  characters,
  simulationRuns,
  audiencePersonas,
}: SceneWorkspaceProps) {
  const router = useRouter();
  const [showScene, setShowScene] = useState(false);
  // Bumped to ask the (already-revealed) ScenePlayer to start a run — see
  // its own prop doc for why a counter rather than a boolean.
  const [runSignal, setRunSignal] = useState(0);
  const sceneCharacters = characters.filter((character) =>
    scene.characterIds.includes(character.id)
  );
  const sceneRuns = simulationRuns.filter((run) => run.sceneId === scene.id);

  function handleSimulateBranchImpact() {
    setShowScene(true);
    setRunSignal((n) => n + 1);
  }

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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      {showScene && (
        <ScenePlayer
          scriptId={scriptId}
          scene={scene}
          characters={sceneCharacters}
          runSignal={runSignal}
        />
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant={showScene ? "secondary" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setShowScene((v) => !v)}
        >
          <Clapperboard className="size-4" />
          Show Scene
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={sceneCharacters.length === 0}
          onClick={handleSimulateBranchImpact}
        >
          <GitBranch className="size-4" />
          Simulate Branch Impact
        </Button>
        <MotivationStressTestDialog scriptId={scriptId} scene={scene} characters={sceneCharacters} />
        <ChemistrySimulatorDialog scriptId={scriptId} scene={scene} characters={sceneCharacters} />
        <AudiencePersonasDialog scriptId={scriptId} customPersonas={audiencePersonas} />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
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

          <Separator />

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Set model
            </p>
            <div className="max-w-xs">
              <SceneModelUpload scriptId={scriptId} scene={scene} />
            </div>
          </div>

          {sceneRuns.length > 0 && (
            <>
              <Separator />
              <SimulationRunList scene={scene} runs={sceneRuns} characters={sceneCharacters} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
