// editor-shell.tsx
// Purpose: Top-level editor layout — sidebar navigation, scene workspace, and
//          the simulation dashboard panel, wired together by selected-scene state.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Box, Clapperboard, Lightbulb, LineChart } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { AssetLibraryDialog } from "@/components/asset-library-dialog";
import { CharacterRoster } from "@/components/character-roster";
import { DashboardPanel } from "@/components/dashboard-panel";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { ScriptUploadDialog } from "@/components/script-upload-dialog";
import { DEMO_SCENE_FIXTURE } from "@/fixtures/demoScript";
import { SceneWorkspace } from "@/components/scene-workspace";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

      <div className="text-muted-foreground mt-2 text-sm">
        <span>or open the 3D viewer</span>
      </div>
      <div className="flex gap-2">
        <a
          href="/model"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
        >
          <Box className="size-4" />
          3D Viewer
        </a>
        <a
          href="/editor?fixture=office"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}
        >
          <Clapperboard className="size-4" />
          Scene editor — demo scene
        </a>
      </div>
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
            <a
              href={
                DEMO_SCENE_FIXTURE[selectedScene.id]
                  ? `/editor?fixture=${DEMO_SCENE_FIXTURE[selectedScene.id]}`
                  : `/editor?scriptId=${script.id}&sceneId=${selectedScene.id}`
              }
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "ml-auto gap-2"
              )}
            >
              <Clapperboard className="size-4" />
              Editor View
            </a>
          )}
        </header>

        {!script ? (
          <NoScriptUploaded />
        ) : isCharactersActive ? (
          <CharacterRoster scriptId={script.id} characters={script.characters} />
        ) : selectedScene ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <SceneWorkspace
              scriptId={script.id}
              scene={selectedScene}
              characters={script.characters}
              simulationRuns={script.simulationRuns}
              audiencePersonas={script.audiencePersonas}
            />
            <aside className="bg-sidebar flex w-80 shrink-0 flex-col overflow-hidden border-l xl:w-[22rem] 2xl:w-96">
              <Tabs defaultValue="metrics" className="flex min-h-0 flex-1 flex-col gap-0">
                <TabsList className="m-3 mb-0 w-auto shrink-0">
                  <TabsTrigger value="metrics" className="flex-1 gap-1.5">
                    <LineChart />
                    Metrics
                  </TabsTrigger>
                  <TabsTrigger value="recommendations" className="flex-1 gap-1.5">
                    <Lightbulb />
                    Improve
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="metrics" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <DashboardPanel
                    scene={selectedScene}
                    simulationRuns={script.simulationRuns}
                    characters={script.characters}
                  />
                </TabsContent>
                <TabsContent value="recommendations" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <RecommendationsPanel
                    scriptId={script.id}
                    scene={selectedScene}
                    characters={script.characters}
                    simulationRuns={script.simulationRuns}
                  />
                </TabsContent>
              </Tabs>
            </aside>
          </div>
        ) : (
          <NoScriptUploaded />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
