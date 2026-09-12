// audience-personas-dialog.tsx
// Purpose: Dialog for viewing the default audience personas (read-only, they
//          live in code — see DEFAULT_AUDIENCE_PERSONAS) and adding/editing/
//          removing this script's own custom ones. Every persona here, plus
//          every default, judges every simulation run automatically — there
//          is no per-run selection.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AudiencePersona } from "@/lib/types";

// Mirrors DEFAULT_AUDIENCE_PERSONAS (src/lib/ai/audienceReview.ts) — kept as
// a display-only copy so this client component doesn't import server-side AI
// code just to show four names and descriptions.
const DEFAULT_PERSONAS: AudiencePersona[] = [
  {
    id: "general",
    name: "General Audience",
    description:
      "A mainstream viewer with no special film background. Reacts to clarity, entertainment value, and whether the emotion actually lands.",
  },
  {
    id: "genre-critic",
    name: "Genre Critic",
    description:
      "Judges the scene against the conventions of whatever genre it's working in.",
  },
  {
    id: "festival-critic",
    name: "Festival/Arthouse Critic",
    description:
      "Values subtlety and thematic depth. Skeptical of anything on-the-nose or emotionally manipulative.",
  },
  {
    id: "streaming-viewer",
    name: "Casual Streaming Viewer",
    description: "Low patience — judges pacing and hook above all else.",
  },
];

interface AudiencePersonasDialogProps {
  scriptId: string;
  customPersonas: AudiencePersona[];
}

export function AudiencePersonasDialog({ scriptId, customPersonas }: AudiencePersonasDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim() || !description.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/scripts/${scriptId}/audience-personas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to add persona");
      }
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(personaId: string) {
    setDeletingId(personaId);
    setError(null);
    try {
      const response = await fetch(`/api/scripts/${scriptId}/audience-personas/${personaId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to remove persona");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Users className="size-3.5" />
            Manage audience personas
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Audience personas</DialogTitle>
          <DialogDescription>
            Every persona below critiques every simulation run automatically. The four
            defaults are always active; add your own to judge from a lens they don&apos;t
            cover.
          </DialogDescription>
        </DialogHeader>

        <div className="themed-scrollbar flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Defaults
          </p>
          {DEFAULT_PERSONAS.map((persona) => (
            <div key={persona.id} className="rounded-md border p-2.5">
              <p className="text-sm font-medium">{persona.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{persona.description}</p>
            </div>
          ))}

          {customPersonas.length > 0 && (
            <>
              <p className="text-muted-foreground mt-2 text-xs font-medium tracking-wide uppercase">
                Custom
              </p>
              {customPersonas.map((persona) => (
                <div key={persona.id} className="flex items-start justify-between gap-2 rounded-md border p-2.5">
                  <div>
                    <p className="text-sm font-medium">{persona.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{persona.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => void handleDelete(persona.id)}
                    disabled={deletingId === persona.id}
                    aria-label={`Remove ${persona.name}`}
                  >
                    {deletingId === persona.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Add a custom persona
          </p>
          <Input
            placeholder="Name — e.g. Teen Horror Fan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
          />
          <Textarea
            placeholder="What lens do they judge from? e.g. Wants to be scared, bored by slow builds, loves a twist."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-20 resize-none text-sm"
            disabled={isSaving}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            size="sm"
            variant="outline"
            className="w-fit gap-1.5"
            onClick={() => void handleAdd()}
            disabled={isSaving || !name.trim() || !description.trim()}
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add persona
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
