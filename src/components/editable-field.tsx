// editable-field.tsx
// Purpose: Click-to-edit text (single line or multiline) with save/cancel,
//          used everywhere a script's AI-generated fields need manual
//          correction — scene title/tone/text, act titles, character fields.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EditableFieldProps {
  value: string;
  onSave: (next: string) => Promise<void>;
  multiline?: boolean;
  label: string;
  className?: string;
  displayClassName?: string;
}

export function EditableField({
  value,
  onSave,
  multiline = false,
  label,
  className,
  displayClassName,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Edit ${label}`}
        className={cn(
          "group/editable inline-flex max-w-full items-start gap-1.5 rounded text-left",
          displayClassName
        )}
      >
        <span className={className}>{value}</span>
        <Pencil className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/editable:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {multiline ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={isSaving}
          aria-label={label}
          className="min-h-24 text-sm"
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsEditing(false);
          }}
        />
      ) : (
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={isSaving}
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsEditing(false);
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => void save()} disabled={isSaving}>
          <Check /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
          <X /> Cancel
        </Button>
      </div>
    </div>
  );
}
