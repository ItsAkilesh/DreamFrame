// NotesPanel.tsx
// Purpose: Lists analyzer notes (plan.md §9.3) — sorted and capped by
//          runAnalyzer already. Clicking a note jumps the playhead to its
//          first beat and highlights the characters involved.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { AlertTriangle, Info, OctagonAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Note } from "@/schema/previsSpec";

interface NotesPanelProps {
  notes: Note[];
  totalCount: number;
  onNoteClick: (note: Note) => void;
}

const SEVERITY_ICON = {
  error: OctagonAlert,
  warning: AlertTriangle,
  info: Info,
} as const;

const SEVERITY_VARIANT = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
} as const;

export function NotesPanel({ notes, totalCount, onNoteClick }: NotesPanelProps) {
  if (notes.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        No notes — nothing to fix on this scene.
      </div>
    );
  }

  return (
    <div className="themed-scrollbar flex flex-col gap-2 overflow-y-auto p-3">
      {notes.map((note) => {
        const Icon = SEVERITY_ICON[note.severity];
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => onNoteClick(note)}
            className="hover:bg-muted flex items-start gap-2 rounded-md border p-2 text-left text-sm"
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <Badge variant={SEVERITY_VARIANT[note.severity]} className="w-fit text-[10px] uppercase">
                {note.code}
              </Badge>
              <span>{note.message}</span>
            </div>
          </button>
        );
      })}
      {totalCount > notes.length && (
        <p className="text-muted-foreground px-2 text-xs">
          and {totalCount - notes.length} more
        </p>
      )}
    </div>
  );
}
