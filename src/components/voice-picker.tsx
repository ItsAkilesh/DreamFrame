// voice-picker.tsx
// Purpose: Assigns an ElevenLabs voice to a character from the real voices on
//          the user's account (src/lib/voice/voices-client.ts), with a
//          per-row preview so you can hear a voice before assigning it.
//          Self-contained like character-model-upload.tsx's CharacterModelUpload
//          — persists its own change (PATCH via patchScript) and refreshes.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Loader2, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { patchScript } from "@/lib/scripts/patch-client";
import { fetchTurnAudioUrl } from "@/lib/voice/tts-client";
import { fetchVoiceList, type VoiceOption } from "@/lib/voice/voices-client";
import { resolveVoiceId } from "@/lib/voice/voices";
import type { Character } from "@/lib/types";

// Synthesized only for voices ElevenLabs didn't give us a preview_url for —
// most premade/library voices already have one, so this is the exception.
const PREVIEW_TEXT = "Hi, this is a quick preview of my voice.";

interface VoicePickerProps {
  scriptId: string;
  character: Character;
}

export function VoicePicker({ scriptId, character }: VoicePickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const assignedVoiceId = character.voiceId;
  const effectiveVoiceId = resolveVoiceId(character);
  const selected = voices?.find((voice) => voice.id === effectiveVoiceId) ?? null;

  const filtered = useMemo(() => {
    if (!voices) return [];
    const q = query.toLowerCase();
    return voices.filter((voice) => voice.name.toLowerCase().includes(q));
  }, [voices, query]);

  function loadVoicesIfNeeded() {
    if (voices || loadError) return;
    fetchVoiceList()
      .then(setVoices)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load voices"));
  }

  async function choose(voiceId: string | null) {
    setOpen(false);
    setQuery("");
    if (voiceId === assignedVoiceId) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await patchScript(scriptId, { type: "character", id: character.id, voiceId });
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save voice");
    } finally {
      setIsSaving(false);
    }
  }

  function preview(event: React.MouseEvent, voice: VoiceOption) {
    event.stopPropagation(); // don't also trigger the row's own choose(...)
    setPreviewingId(voice.id);

    const play = (url: string) => {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => setPreviewingId(null);
      audio.onerror = () => setPreviewingId(null);
      void audio.play().catch(() => setPreviewingId(null));
    };

    if (voice.previewUrl) {
      play(voice.previewUrl);
    } else {
      fetchTurnAudioUrl(PREVIEW_TEXT, voice.id)
        .then(play)
        .catch(() => setPreviewingId(null));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) loadVoicesIfNeeded();
        }}
      >
        <PopoverTrigger
          render={<Button variant="outline" size="sm" />}
          disabled={isSaving}
          aria-label={`Voice for ${character.name}`}
          className="w-full justify-between gap-2"
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected?.name ?? (assignedVoiceId ? assignedVoiceId : "Auto-assigned")}
          </span>
          {isSaving ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0" />
          )}
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 gap-1 p-1">
          <Input
            aria-label="Search voices"
            placeholder="Search voices…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div aria-label="Voices" className="h-48 overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => void choose(null)}
              className="hover:bg-accent focus-visible:bg-accent flex h-8 w-full items-center rounded-md px-2 text-sm outline-none"
            >
              <span className="flex-1 text-left">Auto-assigned</span>
              {!assignedVoiceId && <Check className="size-4 shrink-0" />}
            </button>

            {loadError && <p className="text-destructive p-2 text-xs">{loadError}</p>}
            {!voices && !loadError && (
              <p className="text-muted-foreground flex items-center gap-2 p-2 text-xs">
                <Loader2 className="size-3.5 animate-spin" />
                Loading voices…
              </p>
            )}
            {voices && !filtered.length && (
              <p className="text-muted-foreground p-2 text-sm">No matching voices.</p>
            )}

            {filtered.map((voice) => (
              <div
                key={voice.id}
                role="button"
                tabIndex={0}
                onClick={() => void choose(voice.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") void choose(voice.id);
                }}
                aria-pressed={voice.id === assignedVoiceId}
                className="hover:bg-accent focus-visible:bg-accent flex h-8 w-full cursor-pointer items-center gap-1 rounded-md px-2 text-sm outline-none"
              >
                <button
                  type="button"
                  aria-label={`Preview ${voice.name}`}
                  onClick={(event) => preview(event, voice)}
                  className="hover:bg-accent-foreground/10 -ml-1 shrink-0 rounded p-1"
                >
                  {previewingId === voice.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </button>
                <span className="truncate text-left" title={voice.name}>
                  {voice.name}
                </span>
                {voice.id === assignedVoiceId && <Check className="ml-auto size-4 shrink-0" />}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {saveError && <p className="text-destructive text-xs">{saveError}</p>}
    </div>
  );
}
