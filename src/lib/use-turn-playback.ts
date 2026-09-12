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

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchTurnAudioUrl } from "@/lib/voice/tts-client";
import { voiceIdForCharacter } from "@/lib/voice/voices";

export interface PlayableTurn {
  characterId: string;
  text: string;
  action: string;
  animationAssetId: string | null;
}

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
  isLive: boolean;
  autoPlay: boolean;
}

interface UseTurnPlaybackResult {
  currentIndex: number;
  currentTurn: PlayableTurn | null;
  isPlaying: boolean;
  isWaitingForMore: boolean;
  setIsPlaying: (value: boolean) => void;
  goTo: (index: number) => void;
}

export function useTurnPlayback({ turns, isLive, autoPlay }: UseTurnPlaybackParams): UseTurnPlaybackResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
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

  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
  }

  // Plays (or falls back to a timed wait for) whichever turn `currentIndex`
  // points at, and advances once it's done.
  useEffect(() => {
    const audio = audioRef.current;
    const turn = turnsRef.current[currentIndex] ?? null;
    if (!isPlaying || !turn || !audio) return;

    let cancelled = false;

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
      fallbackTimer.current = setTimeout(goNext, turnDurationSeconds(turn!.text) * 1000);
    }

    fetchTurnAudioUrl(turn.text, voiceIdForCharacter(turn.characterId))
      .then((url) => {
        if (cancelled) return;
        audio.src = url;
        audio.onended = goNext;
        audio.onerror = fallback;
        void audio.play().catch(fallback);
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
  }, [isPlaying, currentIndex]);

  // Resumes once a turn arrives after playback ran dry waiting for it live.
  useEffect(() => {
    if (awaitingMoreRef.current && isPlaying && currentIndex + 1 < turns.length) {
      awaitingMoreRef.current = false;
      setCurrentIndex((i) => i + 1);
    }
  }, [turns.length, isPlaying, currentIndex]);

  // A caller that reuses the same mounted component across runs (the live
  // view's "Run again") clears `turns` back to [] rather than remounting —
  // without this, currentIndex would still be pointing deep into the
  // previous run and wait for the new one to grow past it before resuming.
  const prevTurnsLengthRef = useRef(turns.length);
  useEffect(() => {
    if (turns.length === 0 && prevTurnsLengthRef.current > 0) {
      awaitingMoreRef.current = false;
      setCurrentIndex(0);
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
    currentTurn: turns[currentIndex] ?? null,
    isPlaying,
    isWaitingForMore: isLive && turns.length > 0 && currentIndex >= turns.length - 1,
    setIsPlaying,
    goTo,
  };
}
