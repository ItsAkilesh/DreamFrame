// scene-characters-dialog.tsx
// Purpose: Dialog for reassigning which of the script's characters appear in
//          a scene — the AI structuring pass sometimes misses or over-adds
//          one, and there's no other way to fix that.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { patchScript } from "@/lib/scripts/patch-client";
import type { Character, Scene } from "@/lib/types";

interface SceneCharactersDialogProps {
  scriptId: string;
  scene: Scene;
  allCharacters: Character[];
}

export function SceneCharactersDialog({
  scriptId,
  scene,
  allCharacters,
}: SceneCharactersDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(scene.characterIds);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(characterId: string) {
    setSelectedIds((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId]
    );
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await patchScript(scriptId, {
        type: "scene",
        id: scene.id,
        characterIds: selectedIds,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelectedIds(scene.characterIds);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <UserPlus className="size-3.5" />
            Manage characters
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Characters in this scene</DialogTitle>
          <DialogDescription>
            Click a character to add or remove them from {scene.title}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {allCharacters.map((character) => {
            const isSelected = selectedIds.includes(character.id);
            return (
              <Badge
                key={character.id}
                variant={isSelected ? "default" : "outline"}
                render={
                  <button
                    type="button"
                    onClick={() => toggle(character.id)}
                    disabled={isSaving}
                  />
                }
                className="cursor-pointer gap-1.5 py-1"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: character.color }}
                />
                {character.name}
              </Badge>
            );
          })}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
