// app-sidebar.tsx
// Purpose: Left navigation — script title, Act/Scene tree, and character roster.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, ChevronsUpDown, Clapperboard, Film, Users } from "lucide-react";

import { ActAccordionItem } from "@/components/act-accordion-item";
import { CharacterEditDialog } from "@/components/character-edit-dialog";
import { Accordion } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScriptUploadDialog } from "@/components/script-upload-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { DEMO_SCENE_FIXTURE } from "@/fixtures/demoScript";
import type { ScriptSummary } from "@/lib/get-current-script";
import type { ScriptData } from "@/lib/types";

interface AppSidebarProps {
  script: ScriptData | null;
  allScripts: ScriptSummary[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  isCharactersActive: boolean;
  onViewCharacters: () => void;
}

export function AppSidebar({
  script,
  allScripts,
  selectedSceneId,
  onSelectScene,
  isCharactersActive,
  onViewCharacters,
}: AppSidebarProps) {
  const router = useRouter();

  // Stable array reference across re-renders of the same script — Base UI's
  // Accordion warns if an uncontrolled defaultValue's *reference* changes
  // after mount, and `.map()` would otherwise allocate a new array on every
  // render (e.g. every time a different scene is selected).
  const actIds = useMemo(
    () => script?.acts.map((act) => act.id) ?? [],
    [script]
  );

  // The scene editor opens the selected scene when there is one, otherwise the
  // bundled demo scene, so it is never a dead end.
  const hasScene = Boolean(script && selectedSceneId);
  // The offline demo script has no database rows behind it, so its scenes open
  // their bundled PrevisSpec fixture instead of a ?scriptId lookup that would
  // 404.
  const demoFixture = selectedSceneId ? DEMO_SCENE_FIXTURE[selectedSceneId] : undefined;
  const sceneHref = demoFixture
    ? `/editor?fixture=${demoFixture}`
    : hasScene
      ? `/editor?scriptId=${script!.id}&sceneId=${selectedSceneId}`
      : "/editor?fixture=office";
  const sceneLabel = hasScene ? "Scene editor — this scene" : "Scene editor — demo scene";

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
              {allScripts.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarGroupLabel
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full cursor-pointer items-center justify-between gap-1.5"
                        render={<button type="button" />}
                      />
                    }
                  >
                    <span className="truncate">{script.title}</span>
                    <ChevronsUpDown className="size-3.5 shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {allScripts.map((s) => (
                      <DropdownMenuItem
                        key={s.id}
                        onClick={() => router.push(`/?scriptId=${s.id}`)}
                        data-active={s.id === script.id || undefined}
                        className="data-active:bg-accent data-active:text-accent-foreground"
                      >
                        <span className="truncate">{s.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarGroupLabel>{script.title}</SidebarGroupLabel>
              )}
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
              <SidebarGroupLabel
                className={
                  "flex items-center gap-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" +
                  (isCharactersActive ? " bg-sidebar-accent text-sidebar-accent-foreground" : "")
                }
                render={<button type="button" onClick={onViewCharacters} />}
              >
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

        {/* Always present, including when the database is unreachable and the
            rest of the sidebar is empty — the 3D view must be reachable from
            the dashboard without first uploading a script (plan.md §13). */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            <Clapperboard className="size-3.5" />
            3D
          </SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-1.5 px-2">
            <Link
              href="/model"
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium hover:bg-sidebar-accent"
            >
              <Box className="size-3.5 shrink-0" />
              <span className="truncate">3D Viewer</span>
            </Link>
            <Link
              href={sceneHref}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-sidebar-accent"
            >
              <Clapperboard className="size-3.5 shrink-0" />
              <span className="truncate">{sceneLabel}</span>
            </Link>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
