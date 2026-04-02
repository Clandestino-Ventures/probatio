"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Hook for playing short audio segments via a WaveSurfer instance.
 * Seeks to startSec, plays for durationSec, then pauses.
 */
export function useSegmentPlayback(
  wavesurferRef: React.MutableRefObject<any>,
  duration: number,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingSegment, setPlayingSegment] = useState<{
    startSec: number;
    endSec: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const ws = wavesurferRef.current;
    if (ws) {
      try {
        ws.pause();
      } catch {
        // WaveSurfer may not be ready
      }
    }
    setIsPlaying(false);
    setPlayingSegment(null);
  }, [wavesurferRef]);

  const playSegment = useCallback(
    (startSec: number, durationSec: number = 4) => {
      const ws = wavesurferRef.current;
      if (!ws || duration <= 0) return;

      // Stop any current playback
      stopPlayback();

      const endSec = Math.min(startSec + durationSec, duration);
      const ratio = Math.max(0, Math.min(1, startSec / duration));

      setPlayingSegment({ startSec, endSec });
      setIsPlaying(true);

      ws.seekTo(ratio);
      ws.play();

      // Auto-stop after segment duration
      const playMs = (endSec - startSec) * 1000;
      timerRef.current = setTimeout(() => {
        stopPlayback();
      }, playMs);
    },
    [wavesurferRef, duration, stopPlayback],
  );

  return { playSegment, stopPlayback, isPlaying, playingSegment };
}
