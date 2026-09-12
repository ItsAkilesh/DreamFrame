// app-sidebar.tsx
// Purpose: Left navigation — script title, Act/Scene tree, and character roster.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Film, Users } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScriptUploadDialog } from "@/components/script-upload-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
                  multiple
                  defaultValue={script.acts.map((act) => act.id)}
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
                        <AccordionItem key={act.id} value={act.id}>
                          <AccordionTrigger className="text-sm font-medium">
                            {act.title}
                          </AccordionTrigger>
                          <AccordionContent>
                            <SidebarMenu>
                              {scenes.map((scene) => (
                                <SidebarMenuItem key={scene.id}>
                                  <SidebarMenuButton
                                    isActive={scene.id === selectedSceneId}
                                    onClick={() => onSelectScene(scene.id)}
                                  >
                                    <span className="truncate">
                                      {scene.order}. {scene.title}
                                    </span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          </AccordionContent>
                        </AccordionItem>
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
                  <div
                    key={character.id}
                    className="flex items-center gap-2 rounded-md px-1 py-1 text-sm"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: character.color }}
                    />
                    <span className="truncate">{character.name}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {character.baselineEmotion}
                    </Badge>
                  </div>
                ))}
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
