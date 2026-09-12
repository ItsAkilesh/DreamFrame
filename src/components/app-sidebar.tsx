// app-sidebar.tsx
// Purpose: Left navigation — script title, Act/Scene tree, and character roster.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useMemo } from "react";
import { Film, Users } from "lucide-react";

import { ActAccordionItem } from "@/components/act-accordion-item";
import { CharacterEditDialog } from "@/components/character-edit-dialog";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScriptUploadDialog } from "@/components/script-upload-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import type { ScriptData } from "@/lib/types";

interface AppSidebarProps {
  script: ScriptData | null;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}

export function AppSidebar({
  script,
  selectedSceneId,
  onSelectScene,
}: AppSidebarProps) {
  // Stable array reference across re-renders of the same script — Base UI's
  // Accordion warns if an uncontrolled defaultValue's *reference* changes
  // after mount, and `.map()` would otherwise allocate a new array on every
  // render (e.g. every time a different scene is selected).
  const actIds = useMemo(
    () => script?.acts.map((act) => act.id) ?? [],
    [script]
  );

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <Film className="size-5 shrink-0" />
          <span className="font-semibold tracking-tight">DreamFrame</span>
        </div>
        <ScriptUploadDialog />
      </SidebarHeader>

      <SidebarContent>
        {!script ? (
          <p className="text-muted-foreground px-4 py-2 text-sm">
            No script uploaded yet.
          </p>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>{script.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <Accordion
                  key={script.id}
                  multiple
                  defaultValue={actIds}
                  className="px-1"
                >
                  {script.acts
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((act) => {
                      const scenes = script.scenes
                        .filter((scene) => scene.actId === act.id)
                        .sort((a, b) => a.order - b.order);

                      return (
                        <ActAccordionItem
                          key={act.id}
                          scriptId={script.id}
                          act={act}
                          scenes={scenes}
                          selectedSceneId={selectedSceneId}
                          onSelectScene={onSelectScene}
                        />
                      );
                    })}
                </Accordion>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                Characters
              </SidebarGroupLabel>
              <SidebarGroupContent className="flex flex-col gap-1.5 px-2">
                {script.characters.map((character) => (
                  <CharacterEditDialog
                    key={character.id}
                    scriptId={script.id}
                    character={character}
                    trigger={
                      <button
                        type="button"
                        title={character.motivation}
                        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-sidebar-accent"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: character.color }}
                        />
                        <span className="truncate">{character.name}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {character.baselineEmotion}
                        </Badge>
                      </button>
                    }
                  />
                ))}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
