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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/kibo-ui/color-picker";
import { patchScript } from "@/lib/scripts/patch-client";
import type { Character } from "@/lib/types";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// Older/AI-assigned characters carry a theme token (e.g. "var(--chart-1)"),
// which a native color input can't parse — fall back to a neutral hex so it
// doesn't silently render as black.
function normalizeToHex(color: string): string {
  return HEX_COLOR_PATTERN.test(color) ? color : "#a3a3a3";
}

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
  const [color, setColor] = useState(normalizeToHex(character.color));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetToCharacter() {
    setName(character.name);
    setMotivation(character.motivation);
    setBaselineEmotion(character.baselineEmotion);
    setTraitsText(character.traits.join(", "));
    setColor(normalizeToHex(character.color));
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
        color,
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
            <Label>Cue color</Label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    className="w-fit gap-2"
                  />
                }
              >
                <span
                  className="size-4 shrink-0 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: color }}
                />
                <span className="font-mono text-xs uppercase">{color}</span>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <ColorPicker
                  // Not `value`: the upstream component's controlled-value
                  // effect misparses a hex string through Color.rgb()
                  // (which expects an RGB array/object), corrupting the
                  // hue/saturation/lightness state. `defaultValue` seeds the
                  // picker correctly and is enough since the dialog remounts
                  // it fresh on every open.
                  defaultValue={color}
                  onChange={(value) => {
                    // ColorPickerProps types onChange loosely via Color.rgb's
                    // overloaded ColorLike param, but the component always
                    // invokes it with a concrete [r, g, b, a] tuple.
                    const [r, g, b] = value as [number, number, number, number];
                    setColor(
                      `#${[r, g, b]
                        .map((channel) =>
                          Math.round(channel).toString(16).padStart(2, "0")
                        )
                        .join("")}`
                    );
                  }}
                >
                  <ColorPickerSelection className="h-32" />
                  <div className="flex items-center gap-2">
                    <ColorPickerEyeDropper />
                    <div className="flex w-full flex-col gap-1.5">
                      <ColorPickerHue />
                      <ColorPickerAlpha />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ColorPickerOutput />
                    <ColorPickerFormat />
                  </div>
                </ColorPicker>
              </PopoverContent>
            </Popover>
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
