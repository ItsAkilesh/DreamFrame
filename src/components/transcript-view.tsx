// transcript-view.tsx
// Purpose: Shared read-only rendering of a simulation transcript — used both
//          for the live-streaming view and for reopening a saved run.
//          Formatted as a standard screenplay dialogue block: centred,
//          uppercase character cue, with the line itself in a narrower
//          column below it, monospace throughout.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import type { Character } from "@/lib/types";

export interface TranscriptTurn {
  characterId: string;
  text: string;
}

interface TranscriptViewProps {
  turns: TranscriptTurn[];
  characters: Character[];
}

// The model is instructed not to prefix its own name, but occasionally does
// anyway (e.g. "Maya: I'm not afraid..."). The name is already rendered as
// its own cue, so strip a leading "Name:" if the line repeats it.
function stripSelfNamePrefix(text: string, name: string | undefined): string {
  if (!name) return text;
  const prefix = `${name}:`;
  return text.toLowerCase().startsWith(prefix.toLowerCase())
    ? text.slice(prefix.length).trimStart()
    : text;
}

export function TranscriptView({ turns, characters }: TranscriptViewProps) {
  const characterFor = (id: string) => characters.find((c) => c.id === id);

  if (turns.length === 0) {
    return <p className="text-muted-foreground text-sm">No lines yet.</p>;
  }

  return (
    <div className="font-mono flex flex-col gap-5">
      {turns.map((turn, i) => {
        const character = characterFor(turn.characterId);
        return (
          <div key={i} className="mx-auto w-full max-w-sm">
            <p
              className="text-center text-sm font-bold tracking-wider uppercase"
              style={{ color: character?.color ?? "inherit" }}
            >
              {character?.name ?? turn.characterId}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {stripSelfNamePrefix(turn.text, character?.name)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
