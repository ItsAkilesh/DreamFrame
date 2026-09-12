// character-edit-dialog.tsx
// Purpose: Dialog for correcting a character's AI-inferred name, motivation,
//          traits, and baseline emotion. Opened from a caller-supplied
//          trigger (the sidebar roster row, or a scene's character badge).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { patchScript } from "@/lib/scripts/patch-client";
import type { Character } from "@/lib/types";

interface CharacterEditDialogProps {
  scriptId: string;
  character: Character;
  // Matches DialogTrigger's own `render` prop type exactly, rather than the
  // looser `React.ReactElement`, which TS was widening to `ReactNode` here.
  trigger: React.ComponentProps<typeof DialogTrigger>["render"];
}

export function CharacterEditDialog({ scriptId, character, trigger }: CharacterEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(character.name);
  const [motivation, setMotivation] = useState(character.motivation);
  const [baselineEmotion, setBaselineEmotion] = useState(character.baselineEmotion);
  const [traitsText, setTraitsText] = useState(character.traits.join(", "));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetToCharacter() {
    setName(character.name);
    setMotivation(character.motivation);
    setBaselineEmotion(character.baselineEmotion);
    setTraitsText(character.traits.join(", "));
    setError(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await patchScript(scriptId, {
        type: "character",
        id: character.id,
        name: name.trim(),
        motivation: motivation.trim(),
        baselineEmotion: baselineEmotion.trim(),
        traits: traitsText
          .split(",")
          .map((trait) => trait.trim())
          .filter((trait) => trait.length > 0)
          .slice(0, 5),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save character");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetToCharacter();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit character</DialogTitle>
          <DialogDescription>
            Correct anything the AI structuring pass got wrong.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="character-name">Name</Label>
            <Input id="character-name" value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="character-motivation">Motivation</Label>
            <Textarea
              id="character-motivation"
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              disabled={isSaving}
              className="min-h-16 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="character-emotion">Baseline emotion</Label>
            <Input
              id="character-emotion"
              value={baselineEmotion}
              onChange={(event) => setBaselineEmotion(event.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="character-traits">Traits (comma-separated, up to 5)</Label>
            <Input
              id="character-traits"
              value={traitsText}
              onChange={(event) => setTraitsText(event.target.value)}
              disabled={isSaving}
              placeholder="guarded, sharp-tongued"
            />
          </div>
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
