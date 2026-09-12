// usePlayhead.ts
// Purpose: Playhead state + requestAnimationFrame advance shared by the full
//          Editor View and the inline scene player.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";

export interface Playhead {
  time: number;
  isPlaying: boolean;
  setTime: (time: number) => void;
  togglePlay: () => void;
}

export function usePlayhead(duration: number): Playhead {
  const [time, setTimeState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastTickRef.current = null;
      return;
    }

    let frame: number;
    const tick = (now: number) => {
      const last = lastTickRef.current ?? now;
      const delta = (now - last) / 1000;
      lastTickRef.current = now;

      setTimeState((prev) => {
        const next = prev + delta;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, duration]);

  return {
    time,
    isPlaying,
    setTime: (next) => {
      setTimeState(next);
      setIsPlaying(false);
    },
    togglePlay: () => {
      if (!isPlaying && time >= duration) setTimeState(0);
      setIsPlaying((p) => !p);
    },
  };
}
