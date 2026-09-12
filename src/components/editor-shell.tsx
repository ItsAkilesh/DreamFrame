// editor-shell.tsx
// Purpose: Top-level editor layout — sidebar navigation, scene workspace, and
//          the simulation dashboard panel, wired together by selected-scene state.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Clapperboard } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { AssetLibraryDialog } from "@/components/asset-library-dialog";
import { CharacterRoster } from "@/components/character-roster";
import { DashboardPanel } from "@/components/dashboard-panel";
import { ScriptUploadDialog } from "@/components/script-upload-dialog";
import { SceneWorkspace } from "@/components/scene-workspace";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ScriptSummary } from "@/lib/get-current-script";
import type { ScriptData } from "@/lib/types";

// The single shared WebGL context used to generate every model thumbnail
// (character roster + asset library) — mounted once here so it exists for
// as long as the app does. See its own header for why one shared, on-demand
// context beats one live <Canvas> per card. Client-only: three.js touches
// WebGL/window at effect time (plan.md §6.6).
const ThumbnailGeneratorHost = dynamic(
  () => import("@/components/thumbnail-generator-host").then((m) => m.ThumbnailGeneratorHost),
  { ssr: false }
);

interface EditorShellProps {
  script: ScriptData | null;
  allScripts: ScriptSummary[];
}

function NoScriptUploaded() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <p className="font-medium">No script uploaded yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a script and an AI agent will structure it into Acts, Scenes,
          and Characters.
        </p>
      </div>
      <ScriptUploadDialog />
    </div>
  );
}

export function EditorShell({ script, allScripts }: EditorShellProps) {
  const firstSceneId = script?.scenes[0]?.id ?? null;
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    firstSceneId
  );
  // AppSidebar's characters-view toggle — switches the main content to the
  // character roster, clearing back to the selected scene when one is picked.
  const [isCharactersActive, setIsCharactersActive] = useState(false);

  const activeSceneId = selectedSceneId ?? firstSceneId;
  const selectedScene =
    script?.scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const act = script?.acts.find((a) => a.id === selectedScene?.actId);

  return (
    <SidebarProvider>
      <ThumbnailGeneratorHost />
      <AppSidebar
        script={script}
        allScripts={allScripts}
        selectedSceneId={activeSceneId}
        onSelectScene={(id) => {
          setSelectedSceneId(id);
          setIsCharactersActive(false);
        }}
        isCharactersActive={isCharactersActive}
        onViewCharacters={() => setIsCharactersActive(true)}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {script && isCharactersActive ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <span>{script.title}</span>
              <span>/</span>
              <span className="text-foreground font-medium">Characters</span>
            </div>
          ) : script && selectedScene ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <span>{script.title}</span>
              <span>/</span>
              <span>{act?.title}</span>
              <span>/</span>
              <span className="text-foreground font-medium">
                {selectedScene.title}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">DreamFrame</span>
          )}

          {script && isCharactersActive && (
            <div className="ml-auto">
              <AssetLibraryDialog />
            </div>
          )}

          {script && selectedScene && !isCharactersActive && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-2"
              nativeButton={false}
              render={
                <Link
                  href={`/editor?scriptId=${script.id}&sceneId=${selectedScene.id}`}
                />
              }
            >
              <Clapperboard className="size-4" />
              Editor View
            </Button>
          )}
        </header>

        {!script ? (
          <NoScriptUploaded />
        ) : isCharactersActive ? (
          <CharacterRoster scriptId={script.id} characters={script.characters} />
        ) : selectedScene ? (
          <div className="flex flex-1 overflow-hidden">
            <SceneWorkspace
              scriptId={script.id}
              scene={selectedScene}
              characters={script.characters}
              simulationRuns={script.simulationRuns}
            />
            <aside className="bg-sidebar w-80 shrink-0 overflow-y-auto border-l">
              <DashboardPanel scene={selectedScene} />
            </aside>
          </div>
        ) : (
          <NoScriptUploaded />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
