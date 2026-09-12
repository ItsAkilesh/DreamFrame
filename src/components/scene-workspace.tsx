// scene-workspace.tsx
// Purpose: Center panel — selected scene's text, character roster, and the
//          simulation actions available on it. Actions are disabled placeholders
//          until the simulation engine API is wired up.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { GitBranch, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Character, Scene } from "@/lib/types";

interface SceneWorkspaceProps {
  scene: Scene;
  characters: Character[];
}

function DisabledAction({
  icon: Icon,
  label,
}: {
  icon: typeof GitBranch;
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

export function SceneWorkspace({ scene, characters }: SceneWorkspaceProps) {
  const sceneCharacters = characters.filter((character) =>
    scene.characterIds.includes(character.id)
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <DisabledAction icon={GitBranch} label="Simulate Branch Impact" />
        <DisabledAction icon={Sparkles} label="Motivation Stress Test" />
        <DisabledAction icon={Users} label="Chemistry Simulator" />
      </div>

      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{scene.title}</CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">
                Scene {scene.order}
              </p>
            </div>
            <Badge variant="secondary">{scene.toneTarget}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed">{scene.text}</p>

          <Separator />

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Characters in scene
            </p>
            <div className="flex flex-wrap gap-2">
              {sceneCharacters.map((character) => (
                <Tooltip key={character.id}>
                  <TooltipTrigger
                    render={
                      <Badge variant="outline" className="gap-1.5 py-1">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: character.color }}
                        />
                        {character.name}
                      </Badge>
                    }
                  />
                  <TooltipContent>{character.motivation}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
