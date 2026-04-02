"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DIMENSION_COLORS } from "@/lib/config/risk-config";
import type { MatchEvidenceRow } from "@/types/database";

/**
 * PROBATIO — Synchronized Dual Playback Hook
 *
 * Links two WaveSurfer instances for synchronized play/pause/seek.
 * Adds colored regions per evidence point. Supports linked proportional
 * seeking and evidence-pair segment playback.
 */

type Dimension = "melody" | "harmony" | "rhythm" | "timbre" | "lyrics";

interface SynchronizedPlaybackOptions {
  audioUrlA: string | null;
  audioUrlB: string | null;
  containerRefA: React.RefObject<HTMLDivElement | null>;
  containerRefB: React.RefObject<HTMLDivElement | null>;
  evidence: MatchEvidenceRow[];
  activeDimension: Dimension | "all";
  onTimeUpdate?: (timeA: number, timeB: number) => void;
  onRegionClick?: (evidenceId: string) => void;
}

interface SynchronizedPlaybackReturn {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekA: (seconds: number) => void;
  seekB: (seconds: number) => void;
  playEvidencePair: (evidence: MatchEvidenceRow) => void;
  setPlaybackRate: (rate: number) => void;
  setVolumeA: (vol: number) => void;
  setVolumeB: (vol: number) => void;
  isPlaying: boolean;
  isReady: boolean;
  currentTimeA: number;
  currentTimeB: number;
  durationA: number;
  durationB: number;
  isLinked: boolean;
  toggleLink: () => void;
  playbackRate: number;
  volumeA: number;
  volumeB: number;
  playingEvidence: string | null;
}

export function useSynchronizedPlayback(
  options: SynchronizedPlaybackOptions,
): SynchronizedPlaybackReturn {
  const {
    audioUrlA,
    audioUrlB,
    containerRefA,
    containerRefB,
    evidence,
    activeDimension,
    onTimeUpdate,
    onRegionClick,
  } = options;

  const wsRefA = useRef<any>(null);
  const wsRefB = useRef<any>(null);
  const regionsRefA = useRef<any>(null);
  const regionsRefB = useRef<any>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [readyA, setReadyA] = useState(false);
  const [readyB, setReadyB] = useState(false);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);
  const [isLinked, setIsLinked] = useState(true);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volumeA, setVolumeAState] = useState(1);
  const [volumeB, setVolumeBState] = useState(1);
  const [playingEvidence, setPlayingEvidence] = useState<string | null>(null);

  // Track ready state
  useEffect(() => {
    setIsReady(readyA && readyB);
  }, [readyA, readyB]);

  // ── Initialize WaveSurfer instances ─────────────────────────────
  useEffect(() => {
    if (!containerRefA.current || !audioUrlA) return;
    let ws: any;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (
        await import("wavesurfer.js/dist/plugins/regions")
      ).default;

      const regions = RegionsPlugin.create();
      regionsRefA.current = regions;

      ws = WaveSurfer.create({
        container: containerRefA.current!,
        waveColor: "#3A3A3F",
        progressColor: "#C4992E",
        cursorColor: "#F5F0EB",
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 80,
        normalize: true,
        url: audioUrlA,
        backend: "WebAudio",
        plugins: [regions],
      });

      ws.on("ready", () => {
        setReadyA(true);
        setDurationA(ws.getDuration());
        wsRefA.current = ws;
      });
      ws.on("timeupdate", (t: number) => setCurrentTimeA(t));
      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => {
        wsRefB.current?.pause();
        setIsPlaying(false);
      });
    })().catch(console.error);

    return () => {
      ws?.destroy();
      wsRefA.current = null;
      regionsRefA.current = null;
      setReadyA(false);
    };
  }, [audioUrlA, containerRefA]);

  useEffect(() => {
    if (!containerRefB.current || !audioUrlB) return;
    let ws: any;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (
        await import("wavesurfer.js/dist/plugins/regions")
      ).default;

      const regions = RegionsPlugin.create();
      regionsRefB.current = regions;

      ws = WaveSurfer.create({
        container: containerRefB.current!,
        waveColor: "#3A3A3F",
        progressColor: "#2E6CE6",
        cursorColor: "#F5F0EB",
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 80,
        normalize: true,
        url: audioUrlB,
        backend: "WebAudio",
        plugins: [regions],
      });

      ws.on("ready", () => {
        setReadyB(true);
        setDurationB(ws.getDuration());
        wsRefB.current = ws;
      });
      ws.on("timeupdate", (t: number) => setCurrentTimeB(t));
      ws.on("finish", () => {
        wsRefA.current?.pause();
        setIsPlaying(false);
      });
    })().catch(console.error);

    return () => {
      ws?.destroy();
      wsRefB.current = null;
      regionsRefB.current = null;
      setReadyB(false);
    };
  }, [audioUrlB, containerRefB]);

  // ── Time update callback ────────────────────────────────────────
  useEffect(() => {
    if (onTimeUpdate) {
      onTimeUpdate(currentTimeA, currentTimeB);
    }
  }, [currentTimeA, currentTimeB, onTimeUpdate]);

  // ── Region management ───────────────────────────────────────────
  useEffect(() => {
    if (!isReady) return;
    const regA = regionsRefA.current;
    const regB = regionsRefB.current;
    if (!regA || !regB) return;

    // Clear existing regions
    regA.clearRegions();
    regB.clearRegions();

    // Filter by active dimension
    const filtered =
      activeDimension === "all"
        ? evidence
        : evidence.filter((e) => e.dimension === activeDimension);

    for (const ev of filtered) {
      const color = DIMENSION_COLORS[ev.dimension] ?? "#8A8A8E";
      const opacity = Math.round(
        (0.3 + ev.similarity_score * 0.5) * 255,
      )
        .toString(16)
        .padStart(2, "0");

      regA.addRegion({
        start: ev.source_start_sec,
        end: ev.source_end_sec,
        color: color + opacity,
        drag: false,
        resize: false,
        id: `ev-${ev.id}-a`,
      });

      regB.addRegion({
        start: ev.target_start_sec,
        end: ev.target_end_sec,
        color: color + opacity,
        drag: false,
        resize: false,
        id: `ev-${ev.id}-b`,
      });
    }

    // Region click handler
    const handleClickA = (region: any) => {
      const evId = region.id?.replace("ev-", "").replace("-a", "");
      if (evId) onRegionClick?.(evId);
    };
    const handleClickB = (region: any) => {
      const evId = region.id?.replace("ev-", "").replace("-b", "");
      if (evId) onRegionClick?.(evId);
    };

    regA.on("region-clicked", handleClickA);
    regB.on("region-clicked", handleClickB);

    return () => {
      regA.un("region-clicked", handleClickA);
      regB.un("region-clicked", handleClickB);
    };
  }, [isReady, evidence, activeDimension, onRegionClick]);

  // ── Transport controls ──────────────────────────────────────────
  const play = useCallback(() => {
    wsRefA.current?.play();
    wsRefB.current?.play();
  }, []);

  const pause = useCallback(() => {
    wsRefA.current?.pause();
    wsRefB.current?.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    wsRefA.current?.pause();
    wsRefB.current?.pause();
    wsRefA.current?.seekTo(0);
    wsRefB.current?.seekTo(0);
    setIsPlaying(false);
    setPlayingEvidence(null);
  }, []);

  const seekA = useCallback(
    (seconds: number) => {
      if (!wsRefA.current || durationA <= 0) return;
      const ratio = Math.max(0, Math.min(1, seconds / durationA));
      wsRefA.current.seekTo(ratio);

      if (isLinked && wsRefB.current && durationB > 0) {
        wsRefB.current.seekTo(ratio);
      }
    },
    [durationA, durationB, isLinked],
  );

  const seekB = useCallback(
    (seconds: number) => {
      if (!wsRefB.current || durationB <= 0) return;
      const ratio = Math.max(0, Math.min(1, seconds / durationB));
      wsRefB.current.seekTo(ratio);

      if (isLinked && wsRefA.current && durationA > 0) {
        wsRefA.current.seekTo(ratio);
      }
    },
    [durationA, durationB, isLinked],
  );

  // ── Evidence pair playback ──────────────────────────────────────
  const playEvidencePair = useCallback(
    (ev: MatchEvidenceRow) => {
      if (!wsRefA.current || !wsRefB.current) return;
      if (durationA <= 0 || durationB <= 0) return;

      // Stop any current playback
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
      }
      wsRefA.current.pause();
      wsRefB.current.pause();

      // Seek independently (not linked for evidence pairs)
      const ratioA = Math.max(
        0,
        Math.min(1, ev.source_start_sec / durationA),
      );
      const ratioB = Math.max(
        0,
        Math.min(1, ev.target_start_sec / durationB),
      );
      wsRefA.current.seekTo(ratioA);
      wsRefB.current.seekTo(ratioB);

      // Play both
      wsRefA.current.play();
      wsRefB.current.play();
      setIsPlaying(true);
      setPlayingEvidence(ev.id);

      // Auto-stop after segment duration
      const segDuration = ev.source_end_sec - ev.source_start_sec;
      const playMs = Math.max(segDuration, 2) * 1000;

      segmentTimerRef.current = setTimeout(() => {
        wsRefA.current?.pause();
        wsRefB.current?.pause();
        setIsPlaying(false);
        setPlayingEvidence(null);
      }, playMs);
    },
    [durationA, durationB],
  );

  // ── Playback rate ───────────────────────────────────────────────
  const setPlaybackRate = useCallback((rate: number) => {
    wsRefA.current?.setPlaybackRate(rate);
    wsRefB.current?.setPlaybackRate(rate);
    setPlaybackRateState(rate);
  }, []);

  // ── Volume ──────────────────────────────────────────────────────
  const setVolumeA = useCallback((vol: number) => {
    wsRefA.current?.setVolume(vol);
    setVolumeAState(vol);
  }, []);

  const setVolumeB = useCallback((vol: number) => {
    wsRefB.current?.setVolume(vol);
    setVolumeBState(vol);
  }, []);

  // ── Link toggle ─────────────────────────────────────────────────
  const toggleLink = useCallback(() => {
    setIsLinked((prev) => !prev);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (isPlaying) pause();
          else play();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekA(Math.max(0, currentTimeA - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          seekA(currentTimeA + 5);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, currentTimeA, play, pause, seekA]);

  // ── Cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (segmentTimerRef.current) {
        clearTimeout(segmentTimerRef.current);
      }
    };
  }, []);

  return {
    play,
    pause,
    stop,
    seekA,
    seekB,
    playEvidencePair,
    setPlaybackRate,
    setVolumeA,
    setVolumeB,
    isPlaying,
    isReady,
    currentTimeA,
    currentTimeB,
    durationA,
    durationB,
    isLinked,
    toggleLink,
    playbackRate,
    volumeA,
    volumeB,
    playingEvidence,
  };
}
