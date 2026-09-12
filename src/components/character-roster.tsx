// character-roster.tsx
// Purpose: Full-width character management view — a card per character with
//          their AI-inferred profile (editable) and their custom 3D model
//          upload. Opened from the sidebar's "Characters" section. Animation
//          upload and emote configuration per character are the next layer
//          on top of this, once a model exists to attach them to.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Pencil } from "lucide-react";

import { CharacterEditDialog } from "@/components/character-edit-dialog";
import { CharacterModelUpload } from "@/components/character-model-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Character } from "@/lib/types";

interface CharacterRosterProps {
  scriptId: string;
  characters: Character[];
}

export function CharacterRoster({ scriptId, characters }: CharacterRosterProps) {
  if (characters.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
        <p className="font-medium">No characters yet</p>
        <p className="text-muted-foreground text-sm">
          Characters appear here once a script has been structured.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {characters.map((character) => (
          <Card key={character.id} size="sm" className="gap-2">
            <CardHeader className="flex flex-row items-start justify-between gap-1.5">
              <CharacterEditDialog
                scriptId={scriptId}
                character={character}
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${character.name}`}>
                    <Pencil />
                  </Button>
                }
              />
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: character.color }}
                />
                <span className="truncate text-sm leading-none font-medium">
                  {character.name}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {character.baselineEmotion}
                </Badge>
                {character.traits.map((trait) => (
                  <Badge key={trait} variant="outline" className="text-[10px]">
                    {trait}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground line-clamp-3 text-xs">{character.motivation}</p>

              <Separator />

              <div>
                <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
                  3D model
                </p>
                <CharacterModelUpload scriptId={scriptId} character={character} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
