// act-accordion-item.tsx
// Purpose: One Act's row in the sidebar tree — expandable scene list, with a
//          rename control for the AI-generated act title.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { patchScript } from "@/lib/scripts/patch-client";
import type { Act, Scene } from "@/lib/types";

interface ActAccordionItemProps {
  scriptId: string;
  act: Act;
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}

export function ActAccordionItem({
  scriptId,
  act,
  scenes,
  selectedSceneId,
  onSelectScene,
}: ActAccordionItemProps) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(act.title);
  const [isSaving, setIsSaving] = useState(false);

  function cancelRename() {
    setTitle(act.title);
    setIsRenaming(false);
  }

  async function saveRename() {
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed === act.title) {
      setIsRenaming(false);
      return;
    }
    setIsSaving(true);
    try {
      await patchScript(scriptId, { type: "act", id: act.id, title: trimmed });
      router.refresh();
      setIsRenaming(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AccordionItem value={act.id}>
      <div className="flex items-center gap-1">
        {isRenaming ? (
          <div className="flex flex-1 items-center gap-1 py-1">
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isSaving}
              className="h-7 text-sm"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveRename();
                }
                if (event.key === "Escape") cancelRename();
              }}
            />
            <Button size="icon-xs" variant="ghost" disabled={isSaving} onClick={() => void saveRename()}>
              <Check />
            </Button>
            <Button size="icon-xs" variant="ghost" disabled={isSaving} onClick={cancelRename}>
              <X />
            </Button>
          </div>
        ) : (
          <>
            <AccordionTrigger className="text-sm font-medium">{act.title}</AccordionTrigger>
            <Button
              size="icon-xs"
              variant="ghost"
              className="shrink-0"
              aria-label="Rename act"
              onClick={() => setIsRenaming(true)}
            >
              <Pencil />
            </Button>
          </>
        )}
      </div>
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
}
