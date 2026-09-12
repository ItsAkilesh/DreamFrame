// use-turn-playback.ts
// Purpose: Shared pacing clock for a sequence of simulation turns, driven by
//          each turn's spoken audio rather than a fixed timer. Used by both
//          the saved-run step-through (simulation-player.tsx, a fixed
//          `turns` array with manual scrub controls) and the live stream
//          (scene-player.tsx, a `turns` array that grows as the server
//          generates lines, with no manual controls). `isLive` is what tells
//          the hook whether reaching the end of `turns` means "finished" or
//          "wait — more may still arrive."
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchTurnAudioUrl } from "@/lib/voice/tts-client";
import { resolveVoiceId } from "@/lib/voice/voices";
import type { Character } from "@/lib/types";

export interface PlayableTurn {
  characterId: string;
  text: string;
  action: string;
  voiceDirection?: string | null;
  animationAssetId: string | null;
}

// A one-sample silent WAV — playing (then immediately pausing) it inside a
// user gesture handler is the standard trick for satisfying browser autoplay
// policy: it "activates" this <audio> element for the session so the later
// programmatic .play() calls inside the fetch-then-play effect below (which
// happen asynchronously, well outside any click event) aren't blocked.
const SILENT_AUDIO_DATA_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const MIN_TURN_SECONDS = 2;
const MAX_TURN_SECONDS = 8;

// Fallback pacing for when a turn's audio can't be fetched/played — reading
// speed estimated from word count, so a voice outage never stalls playback
// (plan.md §8: "plays silently with its caption and the demo continues").
export function turnDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, (words / 150) * 60 + 1));
}

interface UseTurnPlaybackParams {
  turns: PlayableTurn[];
  characters: Character[];
  isLive: boolean;
  autoPlay: boolean;
  sceneContext?: string;
}

interface UseTurnPlaybackResult {
  currentIndex: number;
  currentTurn: PlayableTurn | null;
  /** True only once audio (or the silent fallback) has actually started. */
  hasStartedCurrentTurn: boolean;
  /** Highest turn whose caption may be revealed in the live transcript. */
  revealedIndex: number;
  isPlaying: boolean;
  isWaitingForMore: boolean;
  isMuted: boolean;
  setIsPlaying: (value: boolean) => void;
  goTo: (index: number) => void;
  toggleMute: () => void;
  // Call synchronously from the click handler that starts/resumes playback
  // (a Play button, "Simulate Branch Impact") — see SILENT_AUDIO_DATA_URI.
  primeAudio: () => void;
}

export function useTurnPlayback({
  turns,
  characters,
  isLive,
  autoPlay,
  sceneContext,
}: UseTurnPlaybackParams): UseTurnPlaybackResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read inside effects without making the effect re-run on every new turn
  // arriving — only isPlaying/currentIndex should (re)start playback; a
  // fresh line streaming in mid-playback must not interrupt what's already
  // speaking.
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const isLiveRef = useRef(isLive);
  isLiveRef.current = isLive;
  // Set when playback has run out of turns while still live — the resume
  // effect below watches for `turns` growing past this point to continue,
  // instead of jumping ahead the instant a new line arrives mid-playback.
  const awaitingMoreRef = useRef(false);

  const voiceIdByCharacter = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of characters) map.set(character.id, resolveVoiceId(character));
    return map;
  }, [characters]);
  const voiceIdByCharacterRef = useRef(voiceIdByCharacter);
  voiceIdByCharacterRef.current = voiceIdByCharacter;

  const currentTurn = turns[currentIndex] ?? null;

  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.muted = isMuted;
  }

  const primeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = SILENT_AUDIO_DATA_URI;
    void audio.play().catch(() => {});
    audio.pause();
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((wasMuted) => {
      const next = !wasMuted;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // Start synthesizing newly streamed turns immediately. The active-turn
  // effect below reads the same cached promise, so when the preceding line
  // finishes the next voice is usually ready with no dead air.
  useEffect(() => {
    for (let index = currentIndex; index < turns.length; index += 1) {
      const turn = turns[index];
      const voiceId = voiceIdByCharacter.get(turn.characterId);
      if (voiceId) {
        void fetchTurnAudioUrl(turn.text, voiceId, {
          action: turn.action,
          voiceDirection: turn.voiceDirection ?? undefined,
          sceneContext,
        }).catch(() => {});
      }
    }
  }, [turns, currentIndex, voiceIdByCharacter, sceneContext]);

  // Plays (or falls back to a timed wait for) whichever turn `currentIndex`
  // points at, and advances once it's done.
  useEffect(() => {
    const audio = audioRef.current;
    const turn = currentTurn;
    if (!isPlaying || !turn || !audio) return;

    let cancelled = false;
    let fallbackStarted = false;

    function revealTurn() {
      if (!cancelled) setRevealedIndex((index) => Math.max(index, currentIndex));
    }

    function goNext() {
      if (cancelled) return;
      setCurrentIndex((i) => {
        if (i + 1 >= turnsRef.current.length) {
          if (isLiveRef.current) {
            awaitingMoreRef.current = true;
          } else {
            setIsPlaying(false);
          }
          return i;
        }
        awaitingMoreRef.current = false;
        return i + 1;
      });
    }

    function fallback() {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;
      // No voice is available, but the caption still appears immediately and
      // remains for a human reading-time interval before playback advances.
      revealTurn();
      fallbackTimer.current = setTimeout(goNext, turnDurationSeconds(turn!.text) * 1000);
    }

    const voiceId = voiceIdByCharacterRef.current.get(turn.characterId) ?? null;
    if (!voiceId) {
      fallback();
      return () => {
        cancelled = true;
        if (fallbackTimer.current) {
          clearTimeout(fallbackTimer.current);
          fallbackTimer.current = null;
        }
      };
    }

    fetchTurnAudioUrl(turn.text, voiceId, {
      action: turn.action,
      voiceDirection: turn.voiceDirection ?? undefined,
      sceneContext,
    })
      .then((url) => {
        if (cancelled) return;
        audio.src = url;
        audio.onended = goNext;
        audio.onerror = fallback;
        void audio.play().then(revealTurn).catch(fallback);
      })
      .catch(fallback);

    return () => {
      cancelled = true;
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    };
  }, [isPlaying, currentIndex, currentTurn, sceneContext]);

  // Resumes once a turn arrives after playback ran dry waiting for it live.
  useEffect(() => {
    if (awaitingMoreRef.current && isPlaying && currentIndex + 1 < turns.length) {
      awaitingMoreRef.current = false;
      setCurrentIndex((i) => i + 1);
    }
  }, [turns.length, isPlaying, currentIndex]);

  // If generation/reviewing finishes while playback is waiting beyond the
  // last received turn, the transcript is complete rather than stalled.
  useEffect(() => {
    if (!isLive && awaitingMoreRef.current && currentIndex + 1 >= turns.length) {
      awaitingMoreRef.current = false;
      setIsPlaying(false);
    }
  }, [isLive, currentIndex, turns.length]);

  // A caller that reuses the same mounted component across runs (the live
  // view's "Run again") clears `turns` back to [] rather than remounting —
  // without this, currentIndex would still be pointing deep into the
  // previous run and wait for the new one to grow past it before resuming.
  const prevTurnsLengthRef = useRef(turns.length);
  useEffect(() => {
    if (turns.length === 0 && prevTurnsLengthRef.current > 0) {
      awaitingMoreRef.current = false;
      setCurrentIndex(0);
      setRevealedIndex(-1);
      // A run that finished naturally leaves isPlaying false (see goNext
      // above) — a fresh run restarting from an empty transcript should
      // resume autoplay for callers that want it, same as the first run did.
      setIsPlaying(autoPlay);
    }
    prevTurnsLengthRef.current = turns.length;
  }, [turns.length, autoPlay]);

  const goTo = useCallback((index: number) => {
    awaitingMoreRef.current = false;
    setCurrentIndex(Math.max(0, Math.min(index, turnsRef.current.length - 1)));
  }, []);

  return {
    currentIndex,
    currentTurn,
    hasStartedCurrentTurn: currentTurn !== null && revealedIndex >= currentIndex,
    revealedIndex,
    isPlaying,
    isWaitingForMore: isLive && turns.length > 0 && currentIndex >= turns.length - 1,
    isMuted,
    setIsPlaying,
    goTo,
    toggleMute,
    primeAudio,
  };
}
