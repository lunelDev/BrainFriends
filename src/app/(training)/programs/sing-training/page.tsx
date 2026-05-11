"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  ChevronRight,
  Clock3,
  Mic,
  Music,
  Printer,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  SING_TRAINING_ANALYSIS_VERSION,
  SING_TRAINING_CATALOG_VERSION,
  SONG_KEYS,
  SONGS,
} from "@/features/sing-training/data/songs";
import { SongKey, SyllableCue } from "@/features/sing-training/types";
import { useTraining } from "../../TrainingContext";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { buildVersionSnapshot, type VersionSnapshot } from "@/lib/analysis/versioning";
import { logTrainingEvent } from "@/lib/client/trainingEventsApi";
import {
  registerMediaStream,
  stopRegisteredMediaStreams,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";
import {
  PronunciationAnalyzer,
  WhisperTranscriber,
} from "@/lib/speech/SpeechAnalyzer";
import { type AcousticSnapshot } from "@/lib/kwab/SessionManager";
import { callVoiceAnalysis } from "@/lib/audio/voiceAnalysisClient";
import { playRecordingStartBeep } from "@/lib/audio/playRecordingStartBeep";
import { SING_ADAPTIVE_BANK } from "@/lib/adaptive/itemBank";

type Phase = "select" | "ready" | "calibrating" | "countdown" | "singing" | "result";

type RankRow = {
  name: string;
  score: number;
  region: string;
  me?: boolean;
};

type SingKeyFrame = {
  dataUrl: string;
  capturedAt: string;
  label: string;
};

type SingResultEnvelope = {
  sourceSessionKey?: string;
  song: string;
  userName: string;
  score: number;
  scoringVersion?: string;
  scoreReason?: string;
  expectedLyrics?: string;
  finalJitter: string;
  finalSi: string;
  facialResponseDelta?: string;
  rtLatency: string;
  finalConsonant?: string;
  finalVowel?: string;
  lyricAccuracy?: string;
  vocalParticipation?: string;
  lyricTiming?: string;
  voiceFaceSync?: string;
  transcript?: string;
  metricSource?: "measured" | "demo";
  measurementReason?: string | null;
  comment: string;
  rankings: RankRow[];
  completedAt: number;
  reviewAudioUrl?: string | null;
  reviewKeyFrames?: SingKeyFrame[];
  reviewAudioMediaId?: string | null;
  reviewAudioObjectKey?: string | null;
  reviewAudioUploadState?:
    | "uploaded"
    | "failed"
    | "not_recorded"
    | "pending_result_sync";
  reviewAudioUploadError?: string | null;
  adaptiveItemKey?: string;
  adaptiveItemId?: string;
  adaptiveTheta?: number;
  adaptiveSd?: number;
  itemDifficulty?: number;
  itemDiscrimination?: number;
  adaptiveSelectionMethod?: "irt_mfi" | "sequential_fallback";
  // Parselmouth 음향 측정값 (REQ-ACOUSTIC-001~004). 결과 페이지 참고용.
  acoustic?: AcousticSnapshot | null;
  governance: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot: VersionSnapshot;
};

type BaselineFaceMetrics = {
  facialSymmetry: number | null;
  trackingQuality: number | null;
};

const SING_RESULT_SESSION_KEY = "bf_sing_result_transient";
const SING_LAST_SONG_SESSION_KEY = "bf_sing_song_transient";
const SING_SCORING_VERSION = "sing-score-v3-performance-weighted";

const LYRIC_LEAD_OFFSET_SEC = 0.28;
const AUDIO_LEVEL_ONSET_THRESHOLD = 0.006;
const MIN_VOICED_RMS = 0.006;
const SING_VOICE_CONFIDENCE_FLOOR = 0.0035;
const SING_VOICE_CONFIDENCE_CEIL = 0.018;
const MIN_MEASURED_PITCH_SAMPLES = 8;
const MIN_MEASURED_FACE_SAMPLES = 3;
const MIN_SING_TRANSCRIPT_CHARS = 2;
const MAX_SING_KEY_FRAMES = 3;
const KEY_FRAME_CAPTURE_INTERVAL_MS = 5000;
const SING_MEASUREMENT_INTERVAL_MS = 200;
const CALIBRATION_MIN_TRACKING_QUALITY = 30;
const CALIBRATION_MIN_FACE_WIDTH = 0.1;
const CALIBRATION_MAX_CENTER_OFFSET = 0.18;
const CALIBRATION_STABLE_MS = 400;

function getSingAdaptiveEvidence(song: SongKey) {
  const item = SING_ADAPTIVE_BANK.find(
    (candidate) => candidate.id === `sing-${song.replace(/\s+/g, "-")}`,
  );
  return {
    adaptiveItemKey: song,
    adaptiveItemId: item?.id ?? `sing-${song}`,
    adaptiveTheta: 0,
    adaptiveSd: 1,
    itemDifficulty: item?.b ?? 0,
    itemDiscrimination: item?.a ?? 1,
    adaptiveSelectionMethod: "irt_mfi" as const,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildSingSourceSessionKey(song: string, completedAt: number) {
  const normalizedSong = song
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `sing-${normalizedSong || "song"}-${completedAt}`;
}

function computeRms(samples: ArrayLike<number>) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

function computeVoiceConfidenceFromRms(rms: number) {
  return clamp(
    ((rms - SING_VOICE_CONFIDENCE_FLOOR) /
      Math.max(SING_VOICE_CONFIDENCE_CEIL - SING_VOICE_CONFIDENCE_FLOOR, 0.001)) *
      100,
    0,
    100,
  );
}

function estimatePitchHz(samples: ArrayLike<number>, sampleRate: number) {
  const size = samples.length;
  if (!size || sampleRate <= 0) return null;
  const rms = computeRms(samples);
  if (rms < MIN_VOICED_RMS) return null;

  let bestLag = -1;
  let bestCorr = 0;
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 80);

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    for (let i = 0; i < size - lag; i += 1) {
      corr += samples[i] * samples[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr <= 0) return null;
  return sampleRate / bestLag;
}

function buildMeasuredComment(params: {
  jitterPct: number;
  facialSymmetry: number | null;
  facialResponseChange: number | null;
  latencyMs: number | null;
  vocalParticipation: number;
  lyricTiming: number;
  voiceFaceSync: number | null;
  consonantAccuracy: number;
  vowelAccuracy: number;
  lyricAccuracy: number;
}) {
  const latencyText =
    params.latencyMs == null ? "반응속도는 측정되지 않았습니다" : `반응 시작 시간은 ${params.latencyMs}ms`;
  const faceText =
    params.facialResponseChange == null
      ? "안면 반응 변화 참고값은 확보되지 않았습니다"
      : `안면 반응 변화 참고값은 ${params.facialResponseChange.toFixed(1)}점`;
  const supportText =
    params.facialSymmetry == null
      ? "안면 반응 보조 기준값은 확보되지 않았습니다"
      : `안면 반응 보조 기준값은 ${params.facialSymmetry.toFixed(1)}점이었습니다`;
  const syncText =
    params.voiceFaceSync == null
      ? "안면-음성 동시성은 확보되지 않았습니다"
      : `안면-음성 동시성은 ${params.voiceFaceSync.toFixed(1)}점`;
  return `노래 과제 수행 기록에서 발화 참여율은 ${params.vocalParticipation.toFixed(1)}점, 가사 타이밍 맞춤률은 ${params.lyricTiming.toFixed(1)}점으로 산출되었습니다. ${syncText}이며 ${faceText}, ${supportText}. 발성 흔들림은 ${params.jitterPct.toFixed(2)}% 수준입니다. ${latencyText}. STT 기반 자음·모음·전사 결과는 자동 전사 참고값으로만 해석합니다.`;
}

function normalizeLyricsForAnalysis(text: string) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[~"'.,!?]/g, "")
    .trim();
}

function captureKeyFrame(videoEl: HTMLVideoElement | null, label: string): SingKeyFrame | null {
  if (!videoEl || videoEl.videoWidth <= 0 || videoEl.videoHeight <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    capturedAt: new Date().toISOString(),
    label,
  };
}

function describeSingMeasurementReason(params: {
  pronunciationErrorReason: string | null;
  hasMeasuredFace: boolean;
  faceSampleCount: number;
}) {
  if (params.pronunciationErrorReason === "dev_mode_mock") {
    return "개발 모드가 켜져 있어 실제 STT를 호출하지 않았습니다.";
  }

  if (params.pronunciationErrorReason === "missing_audio_blob") {
    return "녹음 오디오가 생성되지 않아 발화 보조 지표를 산출하지 못했습니다.";
  }

  if (params.pronunciationErrorReason === "insufficient_transcript") {
    return "전사된 가사 길이가 너무 짧아 자음·모음 보조 지표를 산출하지 못했습니다.";
  }

  if (
    params.pronunciationErrorReason &&
    params.pronunciationErrorReason !== "stt_unknown_error"
  ) {
    return `발화 보조 지표 산출 중 오류가 발생했습니다: ${params.pronunciationErrorReason}`;
  }

  if (params.pronunciationErrorReason === "stt_unknown_error") {
    return "STT 응답을 해석하지 못해 발화 보조 지표를 산출하지 못했습니다.";
  }

  if (!params.hasMeasuredFace) {
    return `안면 추적 샘플이 부족합니다. 현재 수집 프레임 ${params.faceSampleCount}개`;
  }

  return "발음 또는 안면 측정 데이터가 충분하지 않습니다.";
}

function buildExpectedSongLyrics(songKey: SongKey) {
  return normalizeLyricsForAnalysis(
    SONGS[songKey].lyrics.map((line) => line.txt).join(" "),
  );
}

async function analyzeSongPronunciation(params: {
  audioBlob: Blob | null;
  expectedLyrics: string;
}) {
  if (!params.audioBlob) {
    return {
      transcript: "",
      consonantAccuracy: null,
      vowelAccuracy: null,
      lyricAccuracy: null,
      errorReason: "missing_audio_blob",
    };
  }

  if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
    return {
      transcript: "",
      consonantAccuracy: null,
      vowelAccuracy: null,
      lyricAccuracy: null,
      errorReason: "dev_mode_mock",
    };
  }

  try {
    const transcriber = new WhisperTranscriber();
    const analyzer = new PronunciationAnalyzer();
    const { text } = await transcriber.transcribe(params.audioBlob, {
      // 목표 가사를 STT prompt 로 넣으면 배경음/힌트 영향으로 과대 전사가 생길 수 있다.
      targetText: undefined,
      useCase: "daily_training",
    });
    const transcript = normalizeLyricsForAnalysis(text);
    if ((transcript.match(/[가-힣a-zA-Z0-9]/g) || []).length < MIN_SING_TRANSCRIPT_CHARS) {
      return {
        transcript,
        consonantAccuracy: null,
        vowelAccuracy: null,
        lyricAccuracy: null,
        errorReason: "insufficient_transcript",
      };
    }

    const detail = analyzer.analyzeDetailed(params.expectedLyrics, transcript);
    return {
      transcript,
      consonantAccuracy: Number(detail.consonantAccuracy.toFixed(1)),
      vowelAccuracy: Number(detail.vowelAccuracy.toFixed(1)),
      lyricAccuracy: Number(detail.syllableAccuracy.toFixed(1)),
      errorReason: null,
    };
  } catch (error) {
    return {
      transcript: "",
      consonantAccuracy: null,
      vowelAccuracy: null,
      lyricAccuracy: null,
      errorReason: error instanceof Error ? error.message : "stt_unknown_error",
    };
  }
}

function calculateCompositeSingScore(metrics: {
  vocalParticipation: number | null;
  lyricTiming: number | null;
  voiceFaceSync: number | null;
  jitterPct: number | null;
  latencyMs: number | null;
}) {
  if (metrics.vocalParticipation == null || metrics.lyricTiming == null) {
    return 0;
  }

  const stabilityScore =
    metrics.jitterPct == null ? 50 : clamp(100 - metrics.jitterPct * 4, 0, 100);
  const latencyScore =
    metrics.latencyMs == null
      ? 50
      : clamp(100 - Math.max(0, metrics.latencyMs - 250) / 10, 0, 100);
  const syncScore = metrics.voiceFaceSync ?? 50;
  const rawScore =
    metrics.vocalParticipation * 0.35 +
    metrics.lyricTiming * 0.25 +
    stabilityScore * 0.2 +
    latencyScore * 0.1 +
    syncScore * 0.1;

  return Math.round(clamp(rawScore, 0, 100));
}

function buildSingScoreReason(params: {
  hasMeasuredPerformance: boolean;
  vocalParticipation: number | null;
  lyricTiming: number | null;
  voiceFaceSync: number | null;
  jitterPct: number | null;
  consonantAccuracy: number | null;
  vowelAccuracy: number | null;
  lyricAccuracy: number | null;
  latencyMs: number | null;
  transcript: string;
  errorReason: string | null;
}) {
  if (!params.hasMeasuredPerformance) {
    return `score_not_calculated:${params.errorReason || "missing_performance_metrics"}`;
  }

  const latencyText =
    params.latencyMs == null
      ? "latency=not_measured"
      : `latency=${Math.round(params.latencyMs)}ms`;
  return [
    SING_SCORING_VERSION,
    `participation=${params.vocalParticipation?.toFixed(1)}`,
    `timing=${params.lyricTiming?.toFixed(1)}`,
    `stability_jitter=${params.jitterPct?.toFixed(2) ?? "not_measured"}`,
    `voice_face_sync=${params.voiceFaceSync?.toFixed(1) ?? "not_measured"}`,
    latencyText,
    `stt_consonant_ref=${params.consonantAccuracy?.toFixed(1) ?? "not_measured"}`,
    `stt_vowel_ref=${params.vowelAccuracy?.toFixed(1) ?? "not_measured"}`,
    `stt_lyric_ref=${params.lyricAccuracy?.toFixed(1) ?? "not_measured"}`,
    `transcriptChars=${params.transcript.replace(/\s+/g, "").length}`,
  ].join("; ");
}

function normalizeTrackingQuality(value: number) {
  const safe = Number(value || 0);
  return safe <= 1 ? safe * 100 : safe;
}

type FaceLandmarkPoint = {
  x: number;
  y: number;
  z?: number;
};

const OUTER_LIP_GUIDE_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146, 61,
];
const INNER_LIP_GUIDE_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87,
  178, 88, 95, 78,
];
const LIP_GUIDE_KEYPOINT_INDICES = [61, 291, 13, 14];

function getContainDrawRect(params: {
  canvasWidth: number;
  canvasHeight: number;
  videoWidth: number;
  videoHeight: number;
}) {
  const videoRatio = params.videoWidth / Math.max(1, params.videoHeight);
  const canvasRatio = params.canvasWidth / Math.max(1, params.canvasHeight);
  const drawWidth =
    canvasRatio > videoRatio
      ? params.canvasHeight * videoRatio
      : params.canvasWidth;
  const drawHeight =
    canvasRatio > videoRatio
      ? params.canvasHeight
      : params.canvasWidth / Math.max(0.001, videoRatio);

  return {
    x: (params.canvasWidth - drawWidth) / 2,
    y: (params.canvasHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function drawLipPath(params: {
  ctx: CanvasRenderingContext2D;
  landmarks: FaceLandmarkPoint[];
  indices: number[];
  drawRect: { x: number; y: number; width: number; height: number };
  strokeStyle: string;
  lineWidth: number;
}) {
  const points = params.indices
    .map((index) => params.landmarks[index])
    .filter((point): point is FaceLandmarkPoint => Boolean(point));

  if (points.length < 3) return;

  params.ctx.beginPath();
  points.forEach((point, index) => {
    const x = params.drawRect.x + (1 - Number(point.x)) * params.drawRect.width;
    const y = params.drawRect.y + Number(point.y) * params.drawRect.height;
    if (index === 0) {
      params.ctx.moveTo(x, y);
    } else {
      params.ctx.lineTo(x, y);
    }
  });
  params.ctx.strokeStyle = params.strokeStyle;
  params.ctx.lineWidth = params.lineWidth;
  params.ctx.lineJoin = "round";
  params.ctx.lineCap = "round";
  params.ctx.stroke();
}

function drawLipTrackingOverlay(params: {
  canvas: HTMLCanvasElement;
  video: HTMLVideoElement | null;
  landmarks: FaceLandmarkPoint[];
  trackingQuality: number;
}) {
  const ctx = params.canvas.getContext("2d");
  if (!ctx) return;

  const width = params.canvas.width;
  const height = params.canvas.height;
  ctx.clearRect(0, 0, width, height);

  const topLip = params.landmarks[13];
  const bottomLip = params.landmarks[14];
  const leftMouth = params.landmarks[61];
  const rightMouth = params.landmarks[291];
  if (!topLip || !bottomLip || !leftMouth || !rightMouth) return;

  const drawRect = getContainDrawRect({
    canvasWidth: width,
    canvasHeight: height,
    videoWidth: params.video?.videoWidth || 640,
    videoHeight: params.video?.videoHeight || 480,
  });

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  drawLipPath({
    ctx,
    landmarks: params.landmarks,
    indices: OUTER_LIP_GUIDE_INDICES,
    drawRect,
    strokeStyle: "rgba(16, 185, 129, 0.98)",
    lineWidth: 4,
  });
  drawLipPath({
    ctx,
    landmarks: params.landmarks,
    indices: INNER_LIP_GUIDE_INDICES,
    drawRect,
    strokeStyle: "rgba(251, 146, 60, 0.98)",
    lineWidth: 3,
  });

  LIP_GUIDE_KEYPOINT_INDICES.forEach((index) => {
    const point = params.landmarks[index];
    if (!point) return;
    const x = drawRect.x + (1 - Number(point.x)) * drawRect.width;
    const y = drawRect.y + Number(point.y) * drawRect.height;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(16, 185, 129, 0.92)";
    ctx.stroke();
  });

  const labelX =
    drawRect.x +
    (1 - (Number(leftMouth.x) + Number(rightMouth.x)) / 2) * drawRect.width;
  const labelY =
    drawRect.y +
    ((Number(topLip.y) + Number(bottomLip.y)) / 2) * drawRect.height +
    42;
  const isTrackingUsable =
    params.trackingQuality >= CALIBRATION_MIN_TRACKING_QUALITY;
  const label = isTrackingUsable ? "입술 추적 중" : "입술 위치 보정 중";
  const labelWidth = isTrackingUsable ? 116 : 138;

  ctx.shadowBlur = 14;
  ctx.fillStyle = isTrackingUsable
    ? "rgba(5, 150, 105, 0.92)"
    : "rgba(217, 119, 6, 0.94)";
  ctx.beginPath();
  ctx.roundRect(labelX - labelWidth / 2, labelY - 17, labelWidth, 34, 17);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "700 15px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText(label, labelX, labelY);
  ctx.restore();
}

function evaluateFaceCalibration(metrics: {
  faceDetected?: boolean;
  trackingQuality?: number;
  landmarks?: any[];
}) {
  const trackingQuality = normalizeTrackingQuality(Number(metrics.trackingQuality || 0));
  const landmarks = Array.isArray(metrics.landmarks) ? metrics.landmarks : [];
  const nose = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const faceWidth =
    leftCheek && rightCheek ? Math.abs(Number(rightCheek.x) - Number(leftCheek.x)) : 0;
  const centerOffset = nose ? Math.abs(Number(nose.x) - 0.5) : 1;

  if (!metrics.faceDetected || !landmarks.length) {
    return {
      ready: false,
      trackingQuality,
      message: "얼굴을 화면 중앙 가이드 안에 맞춰 주세요.",
    };
  }

  if (faceWidth < CALIBRATION_MIN_FACE_WIDTH) {
    return {
      ready: false,
      trackingQuality,
      message: "카메라에 얼굴이 더 크게 보이도록 가까이 와 주세요.",
    };
  }

  if (centerOffset > CALIBRATION_MAX_CENTER_OFFSET) {
    return {
      ready: false,
      trackingQuality,
      message: "얼굴을 가운데에 맞추고 정면을 바라봐 주세요.",
    };
  }

  if (trackingQuality < CALIBRATION_MIN_TRACKING_QUALITY) {
    return {
      ready: false,
      trackingQuality,
      message: "얼굴이 인식되었지만 추적이 약합니다. 정면을 유지하거나 조금 더 밝은 곳에서 시도해 주세요.",
    };
  }

  return {
    ready: true,
    trackingQuality,
    message: "얼굴 인식이 안정되었습니다. 노래를 시작할 수 있습니다.",
  };
}

function renderProgressLyric(
  text: string,
  progressPct: number,
  cues?: SyllableCue[] | null,
  elapsedInLine?: number,
) {
  if (cues && cues.length > 0 && typeof elapsedInLine === "number") {
    return cues.map((cue, index) => {
      const isDone = elapsedInLine >= cue.end;
      const isActive = elapsedInLine >= cue.start && elapsedInLine < cue.end;
      const activeProgress = isActive
        ? Math.min(
            1,
            Math.max(0, (elapsedInLine - cue.start) / (cue.end - cue.start)),
          )
        : 0;
      const fillWidth = isDone ? "100%" : `${activeProgress * 100}%`;

      if (cue.syllable.trim().length === 0) {
        return (
          <span
            key={`${cue.syllable}-${index}`}
            className="inline-block w-[0.38em] text-transparent"
          >
            {"\u00A0"}
          </span>
        );
      }

      return (
        <span key={`${cue.syllable}-${index}`} className="relative inline-block">
          <span className="text-white/32">{cue.syllable}</span>
          <span
            className="absolute inset-y-0 left-0 overflow-hidden text-emerald-300 drop-shadow-[0_0_18px_rgba(110,231,183,0.5)]"
            style={{ width: fillWidth }}
          >
            {cue.syllable}
          </span>
        </span>
      );
    });
  }

  const chars = Array.from(text);
  const activeCount = Math.round((chars.length * progressPct) / 100);

  return chars.map((char, index) => (
    <span
      key={`${char}-${index}`}
      className={
        index < activeCount
          ? "text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.18)]"
          : "text-white/32"
      }
    >
      {char === " " ? "\u00A0" : char}
    </span>
  ));
}

function buildSkippedSingResult(params: {
  song: SongKey;
  userName: string;
  governance: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  reviewKeyFrames?: SingKeyFrame[];
}): SingResultEnvelope {
  const demoTranscript = normalizeLyricsForAnalysis(
    SONGS[params.song].lyrics
      .slice(0, 2)
      .map((line) => line.txt)
      .join(" "),
  );
  return {
    song: params.song,
    userName: params.userName || "사용자",
    score: 72,
    scoringVersion: SING_SCORING_VERSION,
    scoreReason: "demo_skip:not_measured",
    expectedLyrics: buildExpectedSongLyrics(params.song),
    finalJitter: "6.4%",
    finalSi: "96.2",
    facialResponseDelta: "3.8",
    rtLatency: "1240 ms",
    finalConsonant: "74.8",
    finalVowel: "77.6",
    lyricAccuracy: "69.4",
    vocalParticipation: "82.0",
    lyricTiming: "78.0",
    voiceFaceSync: "91.0",
    transcript: demoTranscript,
    metricSource: "demo",
    measurementReason: "관리자 skip으로 인해 실측을 수행하지 않았습니다.",
    comment:
      "관리자 skip으로 생성된 화면 확인용 시연 결과입니다. 실제 측정값이 아니므로 서버 저장과 랭킹 반영은 수행되지 않습니다.",
    rankings: [],
    completedAt: Date.now(),
    reviewAudioUrl: null,
    reviewKeyFrames: params.reviewKeyFrames ?? [],
    reviewAudioMediaId: null,
    reviewAudioObjectKey: null,
    reviewAudioUploadState:
      params.reviewKeyFrames && params.reviewKeyFrames.length > 0
        ? "pending_result_sync"
        : "not_recorded",
    reviewAudioUploadError: null,
    ...getSingAdaptiveEvidence(params.song),
    governance: params.governance,
    versionSnapshot: buildVersionSnapshot("sing", {
      algorithm_version: params.governance.analysisVersion,
      model_version: params.governance.analysisVersion,
      requirements: params.governance.requirementIds,
      config_version: params.governance.catalogVersion,
      measurement_metadata: {
        facial_response_delta: 3.8,
        baseline_facial_symmetry: 96.2,
        baseline_tracking_quality: 72,
      },
    }),
  };
}


function BrainSingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { patient, ageGroup } = useTrainingSession();
  const { sidebarMetrics } = useTraining();
  const isAdmin = patient?.userRole === "admin";

  useEffect(() => {
    void logTrainingEvent({
      eventType: "sing_training_viewed",
      trainingType: "sing-training",
      pagePath: "/programs/sing-training",
      sessionId: patient?.sessionId ?? null,
      payload: {
        song: searchParams.get("song") || null,
        ageGroup,
      },
    });
  }, [ageGroup, patient?.sessionId, searchParams]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sideVideoRef = useRef<HTMLVideoElement | null>(null);
  const mouthOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const measurementAudioContextRef = useRef<AudioContext | null>(null);
  const measurementAnalyserRef = useRef<AnalyserNode | null>(null);
  const measurementDataRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const measurementSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const clockTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const singingTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const finishGuardRef = useRef(false);
  const audioEndedRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);
  const calibrationStableSinceRef = useRef<number | null>(null);
  const calibrationCompletedRef = useRef(false);
  const calibrationBaselineSymmetryRef = useRef<number | null>(null);
  const calibrationBaselineMetricsRef = useRef<BaselineFaceMetrics>({
    facialSymmetry: null,
    trackingQuality: null,
  });
  const keyFramesRef = useRef<SingKeyFrame[]>([]);
  const lastKeyFrameCapturedAtRef = useRef<number>(0);
  const measuredPitchHistoryRef = useRef<number[]>([]);
  const measuredSymmetryHistoryRef = useRef<number[]>([]);
  const voiceOnsetLatencyMsRef = useRef<number | null>(null);
  const latestLipOverlayRef = useRef<{
    faceDetected: boolean;
    landmarks: FaceLandmarkPoint[];
    trackingQuality: number;
  }>({
    faceDetected: false,
    landmarks: [],
    trackingQuality: 0,
  });

  const requestedSong = useMemo(() => {
    const raw = searchParams.get("song");
    return SONG_KEYS.find((item) => item === raw) ?? null;
  }, [searchParams]);

  const [phase, setPhase] = useState<Phase>(requestedSong ? "ready" : "select");
  const [song, setSong] = useState<SongKey>(requestedSong ?? "나비야");
  const [clockText, setClockText] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [remaining, setRemaining] = useState("30.0");
  const [scanStatus, setScanStatus] = useState("READY");
  const [lyricBase, setLyricBase] = useState("시스템 준비 중...");
  const [nextLyricBase, setNextLyricBase] = useState("");
  const [lyricFillPct, setLyricFillPct] = useState(0);
  const [lyricElapsedSec, setLyricElapsedSec] = useState(0);
  const [currentLyricCues, setCurrentLyricCues] = useState<SyllableCue[] | null>(
    null,
  );
  const [rtJitter, setRtJitter] = useState("0.00%");
  const [rtSi, setRtSi] = useState("0.0");
  const [rtLatency, setRtLatency] = useState("-- ms");
  const [jitterHistory, setJitterHistory] = useState<number[]>([]);
  const [siHistory, setSiHistory] = useState<number[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [finalJitter, setFinalJitter] = useState("0.00");
  const [finalSi, setFinalSi] = useState("0.0");
  const [comment, setComment] = useState("");
  const [rankings, setRankings] = useState<RankRow[]>([]);
  const [isBgmMuted, setIsBgmMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [songDurationSec, setSongDurationSec] = useState(30);
  const [calibrationReady, setCalibrationReady] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState(
    "카메라를 켜고 얼굴을 화면 중앙 가이드에 맞춰 주세요.",
  );
  const [mediaAccessError, setMediaAccessError] = useState<string | null>(null);

  const currentSong = SONGS[song];
  const lyricLeadOffsetSec =
    currentSong.lyricLeadOffsetSec ?? LYRIC_LEAD_OFFSET_SEC;
  const userName = patient?.name || "사용자";
  const lyricTimelineEndSec = useMemo(() => {
    const lastLine = currentSong.lyrics[currentSong.lyrics.length - 1];
    return lastLine ? lastLine.t + lastLine.d : 30;
  }, [currentSong.lyrics]);
  const remainingSeconds = Number.parseFloat(remaining);
  const timerTotalSeconds = Math.max(1, songDurationSec || lyricTimelineEndSec || 30);
  const remainingPct = Number.isFinite(remainingSeconds)
    ? clamp((remainingSeconds / timerTotalSeconds) * 100, 0, 100)
    : 0;
  const liveTrackingQuality = normalizeTrackingQuality(sidebarMetrics.trackingQuality);
  const liveLipTrackingLabel =
    sidebarMetrics.faceDetected && liveTrackingQuality >= CALIBRATION_MIN_TRACKING_QUALITY
      ? "입술 추적 중"
      : "입술 위치 확인 중";

  useEffect(() => {
    const audio = new Audio(currentSong.audioSrc);
    audio.preload = "auto";
    audio.muted = isBgmMuted;
    setAudioReady(false);
    setSongDurationSec(currentSong.durationSec ?? 30);
    const handleReady = () => setAudioReady(true);
    const handleError = () => setAudioReady(false);
    const handleMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setSongDurationSec(audio.duration);
      }
    };

    audio.addEventListener("canplaythrough", handleReady);
    audio.addEventListener("loadeddata", handleReady);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadedmetadata", handleMetadata);
    audio.addEventListener("durationchange", handleMetadata);
    songAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("loadeddata", handleReady);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadedmetadata", handleMetadata);
      audio.removeEventListener("durationchange", handleMetadata);
      if (songAudioRef.current === audio) {
        songAudioRef.current = null;
      }
    };
  }, [currentSong.audioSrc]);

  const stopActiveSession = () => {
    if (clockTimerRef.current !== null) {
      window.clearInterval(clockTimerRef.current);
      clockTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (singingTimerRef.current !== null) {
      window.clearInterval(singingTimerRef.current);
      singingTimerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      unregisterMediaStream(streamRef.current);
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    if (measurementSourceRef.current) {
      measurementSourceRef.current.disconnect();
      measurementSourceRef.current = null;
    }
    if (measurementAnalyserRef.current) {
      measurementAnalyserRef.current.disconnect();
      measurementAnalyserRef.current = null;
    }
    if (measurementAudioContextRef.current) {
      void measurementAudioContextRef.current.close();
      measurementAudioContextRef.current = null;
    }
    measurementDataRef.current = null;
    measuredPitchHistoryRef.current = [];
    measuredSymmetryHistoryRef.current = [];
    voiceOnsetLatencyMsRef.current = null;
    calibrationCompletedRef.current = false;
    calibrationBaselineSymmetryRef.current = null;
    calibrationBaselineMetricsRef.current = {
      facialSymmetry: null,
      trackingQuality: null,
    };
    sessionStartRef.current = null;
    recordedChunksRef.current = [];
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (sideVideoRef.current) {
      sideVideoRef.current.srcObject = null;
    }
    stopRegisteredMediaStreams();
    if (songAudioRef.current) {
      songAudioRef.current.onended = null;
      songAudioRef.current.pause();
      songAudioRef.current.currentTime = 0;
      songAudioRef.current.muted = false;
    }
    audioEndedRef.current = false;
    keyFramesRef.current = [];
    lastKeyFrameCapturedAtRef.current = 0;
  };

  useEffect(() => {
    if (songAudioRef.current) {
      songAudioRef.current.muted = isBgmMuted;
    }
  }, [isBgmMuted]);

  useEffect(() => {
    latestLipOverlayRef.current = {
      faceDetected: Boolean(sidebarMetrics.faceDetected),
      landmarks: Array.isArray(sidebarMetrics.landmarks)
        ? (sidebarMetrics.landmarks as FaceLandmarkPoint[])
        : [],
      trackingQuality: normalizeTrackingQuality(sidebarMetrics.trackingQuality),
    };
  }, [
    sidebarMetrics.faceDetected,
    sidebarMetrics.landmarks,
    sidebarMetrics.trackingQuality,
  ]);

  useEffect(() => {
    const canvas = mouthOverlayCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let rafId: number | null = null;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      const overlayMetrics = latestLipOverlayRef.current;
      const shouldDraw = phase === "calibrating";

      if (
        shouldDraw &&
        overlayMetrics.faceDetected &&
        overlayMetrics.landmarks.length > 0
      ) {
        drawLipTrackingOverlay({
          canvas,
          video: videoRef.current,
          landmarks: overlayMetrics.landmarks,
          trackingQuality: overlayMetrics.trackingQuality,
        });
      } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "calibrating") {
      calibrationStableSinceRef.current = null;
      return;
    }

    if (mediaAccessError) {
      calibrationStableSinceRef.current = null;
      setCalibrationReady(false);
      setCalibrationMessage(mediaAccessError);
      return;
    }

    const assessment = evaluateFaceCalibration({
      faceDetected: sidebarMetrics.faceDetected,
      trackingQuality: sidebarMetrics.trackingQuality,
      landmarks: sidebarMetrics.landmarks,
    });
    setCalibrationMessage(assessment.message);

    if (!assessment.ready) {
      calibrationStableSinceRef.current = null;
      setCalibrationReady(false);
      return;
    }

    if (calibrationStableSinceRef.current == null) {
      calibrationStableSinceRef.current = performance.now();
      setCalibrationReady(false);
      return;
    }

    if (performance.now() - calibrationStableSinceRef.current >= CALIBRATION_STABLE_MS) {
      const baselineSymmetry = sidebarMetrics.faceDetected
        ? clamp((sidebarMetrics.facialSymmetry || 0) * 100, 0, 100)
        : null;
      calibrationBaselineSymmetryRef.current = baselineSymmetry;
      calibrationBaselineMetricsRef.current = {
        facialSymmetry: baselineSymmetry,
        trackingQuality: Number.isFinite(sidebarMetrics.trackingQuality)
          ? clamp(sidebarMetrics.trackingQuality || 0, 0, 100)
          : null,
      };
      calibrationCompletedRef.current = true;
      setCalibrationReady(true);
    }
  }, [
    mediaAccessError,
    phase,
    sidebarMetrics.faceDetected,
    sidebarMetrics.landmarks,
    sidebarMetrics.trackingQuality,
  ]);

  const stopAnalysisLoopKeepingCamera = () => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (singingTimerRef.current !== null) {
      window.clearInterval(singingTimerRef.current);
      singingTimerRef.current = null;
    }
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (songAudioRef.current) {
      songAudioRef.current.onended = null;
      songAudioRef.current.pause();
    }
  };

  const collectSingKeyFrame = (force = false) => {
    const now = Date.now();
    if (
      !force &&
      (keyFramesRef.current.length >= MAX_SING_KEY_FRAMES ||
        now - lastKeyFrameCapturedAtRef.current < KEY_FRAME_CAPTURE_INTERVAL_MS)
    ) {
      return;
    }

    const keyFrame =
      captureKeyFrame(videoRef.current, `frame-${keyFramesRef.current.length + 1}`) ??
      captureKeyFrame(sideVideoRef.current, `frame-${keyFramesRef.current.length + 1}`);

    if (!keyFrame) return;
    keyFramesRef.current = [...keyFramesRef.current, keyFrame].slice(0, MAX_SING_KEY_FRAMES);
    lastKeyFrameCapturedAtRef.current = now;
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("failed_to_read_recording"));
      };
      reader.onerror = () =>
        reject(reader.error ?? new Error("failed_to_read_recording"));
      reader.readAsDataURL(blob);
    });

  const primeSongAudio = async () => {
    if (!songAudioRef.current) return;
    try {
      const originalMuted = songAudioRef.current.muted;
      songAudioRef.current.muted = true;
      songAudioRef.current.currentTime = 0;
      await songAudioRef.current.play();
      songAudioRef.current.pause();
      songAudioRef.current.currentTime = 0;
      songAudioRef.current.muted = isBgmMuted || originalMuted;
    } catch {
      setAudioReady(false);
    }
  };

  const ensureMediaCapture = async () => {
    if (streamRef.current) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      registerMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (sideVideoRef.current) {
        sideVideoRef.current.srcObject = stream;
      }
      setMediaAccessError(null);
      return true;
    } catch {
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (sideVideoRef.current) {
        sideVideoRef.current.srcObject = null;
      }
      setMediaAccessError("카메라와 마이크 권한을 허용한 뒤 다시 시도해 주세요.");
      return false;
    }
  };

  const startVoiceRecording = async () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    recordedChunksRef.current = [];

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      measurementAudioContextRef.current = audioContext;
      measurementAnalyserRef.current = analyser;
      measurementSourceRef.current = source;
      measurementDataRef.current = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

      const audioMimeType =
        typeof MediaRecorder.isTypeSupported === "function" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder.isTypeSupported === "function" &&
              MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
      const recorder = new MediaRecorder(
        new MediaStream(audioTracks),
        audioMimeType ? { mimeType: audioMimeType } : undefined,
      );
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      void playRecordingStartBeep().catch(() => undefined);
    } catch (error) {
      if (measurementSourceRef.current) {
        measurementSourceRef.current.disconnect();
        measurementSourceRef.current = null;
      }
      if (measurementAnalyserRef.current) {
        measurementAnalyserRef.current.disconnect();
        measurementAnalyserRef.current = null;
      }
      if (measurementAudioContextRef.current) {
        void measurementAudioContextRef.current.close();
        measurementAudioContextRef.current = null;
      }
      measurementDataRef.current = null;
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
    }
  };

  const stopVoiceRecording = async (): Promise<{
    dataUrl: string | null;
    blob: Blob | null;
  }> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return { dataUrl: null, blob: null };

    if (recorder.state === "inactive") {
      mediaRecorderRef.current = null;
      if (!recordedChunksRef.current.length) return { dataUrl: null, blob: null };
      const blob = new Blob(recordedChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      recordedChunksRef.current = [];
      return {
        dataUrl: await blobToDataUrl(blob),
        blob,
      };
    }

    return new Promise<{ dataUrl: string | null; blob: Blob | null }>((resolve) => {
      recorder.onstop = async () => {
        try {
          if (!recordedChunksRef.current.length) {
            resolve({ dataUrl: null, blob: null });
            return;
          }
          const blob = new Blob(recordedChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const dataUrl = await blobToDataUrl(blob);
          resolve({ dataUrl, blob });
        } catch {
          resolve({ dataUrl: null, blob: null });
        } finally {
          recordedChunksRef.current = [];
          mediaRecorderRef.current = null;
        }
      };
      try {
        recorder.requestData();
      } catch {
        // Some browsers throw when requestData races with stop; onstop still handles chunks.
      }
      recorder.stop();
    });
  };

  useEffect(() => {
    const tick = () => setClockText(new Date().toLocaleTimeString());
    tick();
    clockTimerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (clockTimerRef.current !== null)
        window.clearInterval(clockTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopActiveSession();
    };
  }, []);

  useEffect(() => {
    if (!requestedSong) return;
    setSong(requestedSong);
    setPhase("ready");
    setCalibrationReady(false);
    setCalibrationMessage("카메라를 켜고 얼굴을 화면 중앙 가이드에 맞춰 주세요.");
    setMediaAccessError(null);
  }, [requestedSong]);

  const prepareSong = (selected: SongKey) => {
    setSong(selected);
    setPhase("ready");
    setRemaining("30.0");
    setLyricBase("시스템 준비 중...");
    setLyricFillPct(0);
    setLyricElapsedSec(0);
    setCurrentLyricCues(null);
    setRtJitter("0.00%");
    setRtSi("0.0");
    setRtLatency("-- ms");
    setScanStatus("READY");
    setCalibrationReady(false);
    setCalibrationMessage("카메라를 켜고 얼굴을 화면 중앙 가이드에 맞춰 주세요.");
    setMediaAccessError(null);
  };

  const startCalibration = async () => {
    stopAnalysisLoopKeepingCamera();
    calibrationStableSinceRef.current = null;
    calibrationCompletedRef.current = false;
    calibrationBaselineSymmetryRef.current = null;
    calibrationBaselineMetricsRef.current = {
      facialSymmetry: null,
      trackingQuality: null,
    };
    setCalibrationReady(false);
    setMediaAccessError(null);
    setCalibrationMessage("카메라를 켜고 얼굴을 화면 중앙 가이드에 맞춰 주세요.");
    setPhase("calibrating");
    setScanStatus("CALIBRATING");
    await primeSongAudio();
    await ensureMediaCapture();
  };

  const startCountdown = () => {
    if (!calibrationReady) return;
    setCountdown(3);
    setPhase("countdown");
    setScanStatus("CALIBRATING");

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current !== null) {
            window.clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          window.setTimeout(() => {
            void startSinging();
          }, 450);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishSinging = async (
    jitterData: number[],
    siData: number[],
    responseDeltaData: number[],
    performanceData: {
      totalSamples: number;
      voicedSamples: number;
      lyricSamples: number;
      voicedLyricSamples: number;
      faceSamples: number;
      voiceFaceSamples: number;
      voiceConfidenceSum: number;
      lyricVoiceConfidenceSum: number;
      voiceFaceConfidenceSum: number;
    },
  ) => {
    stopAnalysisLoopKeepingCamera();
    collectSingKeyFrame(true);
    const reviewAudio = await stopVoiceRecording();
    const reviewAudioUploadState: "uploaded" | "failed" | "not_recorded" | "pending_result_sync" =
      reviewAudio.dataUrl ? "pending_result_sync" : "not_recorded";
    const reviewAudioUploadError: string | null = null;
    const expectedLyrics = buildExpectedSongLyrics(song);

    const avgJ =
      jitterData.length > 0
        ? jitterData.reduce((sum, value) => sum + value, 0) / jitterData.length
        : null;
    const avgS =
      siData.length > 0
        ? siData.reduce((sum, value) => sum + value, 0) / siData.length
        : null;
    const avgFaceResponseDelta =
      responseDeltaData.length > 0
        ? responseDeltaData.reduce((sum, value) => sum + value, 0) / responseDeltaData.length
        : null;
    const latencyMs = voiceOnsetLatencyMsRef.current;
    const pronunciation = await analyzeSongPronunciation({
      audioBlob: reviewAudio.blob,
      expectedLyrics,
    });
    // Parselmouth 음향 측정값 (REQ-ACOUSTIC-001~004).
    // 점수에는 영향 없음(참고 측정값) — 항상 안전한 shape 으로 반환됨.
    const acousticSnapshot: AcousticSnapshot | null = reviewAudio.blob
      ? await callVoiceAnalysis(reviewAudio.blob)
      : null;
    const hasMeasuredPronunciation =
      pronunciation.consonantAccuracy != null &&
      pronunciation.vowelAccuracy != null &&
      pronunciation.lyricAccuracy != null;
    const vocalParticipation =
      performanceData.totalSamples > 0
        ? clamp(performanceData.voiceConfidenceSum / performanceData.totalSamples, 0, 100)
        : null;
    const lyricTiming =
      performanceData.lyricSamples > 0
        ? clamp(performanceData.lyricVoiceConfidenceSum / performanceData.lyricSamples, 0, 100)
        : null;
    const voiceFaceSync =
      performanceData.voicedSamples > 0
        ? clamp(performanceData.voiceFaceConfidenceSum / performanceData.voicedSamples, 0, 100)
        : null;
    const hasMeasuredPerformance =
      reviewAudio.blob != null &&
      performanceData.totalSamples >= 8 &&
      vocalParticipation != null &&
      lyricTiming != null;
    const liveSymmetrySnapshot = sidebarMetrics.faceDetected
      ? clamp((sidebarMetrics.facialSymmetry || 0) * 100, 0, 100)
      : null;
    const effectiveFaceSampleCount =
      avgS == null &&
      calibrationCompletedRef.current &&
      liveSymmetrySnapshot != null &&
      siData.length === 0
        ? 1
        : siData.length;
    const effectiveSymmetry =
      avgS != null
        ? avgS
        : calibrationCompletedRef.current && liveSymmetrySnapshot != null
          ? liveSymmetrySnapshot
          : 0;
    const liveBaselineDelta =
      calibrationBaselineSymmetryRef.current != null && liveSymmetrySnapshot != null
        ? Math.abs(liveSymmetrySnapshot - calibrationBaselineSymmetryRef.current)
        : null;
    const effectiveFacialResponseDelta =
      avgFaceResponseDelta != null
        ? avgFaceResponseDelta
        : calibrationCompletedRef.current && liveBaselineDelta != null
          ? liveBaselineDelta
          : null;
    const hasMeasuredFace =
      effectiveFacialResponseDelta != null &&
      calibrationCompletedRef.current &&
      effectiveFaceSampleCount >= 1;
    const metricSource = hasMeasuredPerformance ? "measured" : "demo";
    const effectiveJitter = avgJ ?? 0;
    const score = calculateCompositeSingScore({
      vocalParticipation,
      lyricTiming,
      voiceFaceSync,
      jitterPct: avgJ,
      latencyMs,
    });
    const scoreReason = buildSingScoreReason({
      hasMeasuredPerformance,
      vocalParticipation,
      lyricTiming,
      voiceFaceSync,
      jitterPct: avgJ,
      consonantAccuracy: pronunciation.consonantAccuracy,
      vowelAccuracy: pronunciation.vowelAccuracy,
      lyricAccuracy: pronunciation.lyricAccuracy,
      latencyMs,
      transcript: pronunciation.transcript,
      errorReason: pronunciation.errorReason,
    });

    const finalJitterText = effectiveJitter.toFixed(2);
    const finalSiText = hasMeasuredFace ? effectiveSymmetry.toFixed(1) : "--";
    const facialResponseDeltaText =
      hasMeasuredFace && effectiveFacialResponseDelta != null
        ? effectiveFacialResponseDelta.toFixed(1)
        : "--";
    const finalLatencyText = latencyMs == null ? "-- ms" : `${Math.round(latencyMs)} ms`;
    const finalConsonantText =
      pronunciation.consonantAccuracy == null
        ? "--"
        : pronunciation.consonantAccuracy.toFixed(1);
    const finalVowelText =
      pronunciation.vowelAccuracy == null
        ? "--"
        : pronunciation.vowelAccuracy.toFixed(1);
    const lyricAccuracyText =
      pronunciation.lyricAccuracy == null
        ? "--"
        : pronunciation.lyricAccuracy.toFixed(1);
    const measurementReason = hasMeasuredPronunciation
      ? null
      : describeSingMeasurementReason({
          pronunciationErrorReason: pronunciation.errorReason,
          hasMeasuredFace,
          faceSampleCount: effectiveFaceSampleCount,
        });
    const performanceMeasurementReason =
      hasMeasuredPerformance
        ? null
        : reviewAudio.blob == null
          ? "녹음 오디오가 생성되지 않아 노래 수행 지표를 산출하지 못했습니다."
          : performanceData.totalSamples < 8
            ? "음성 분석 샘플이 부족해 노래 수행 지표를 산출하지 못했습니다."
            : "발화 참여율 또는 타이밍 맞춤률을 산출하지 못했습니다.";

    const finalComment =
      metricSource === "measured"
        ? buildMeasuredComment({
            jitterPct: effectiveJitter,
            facialSymmetry: hasMeasuredFace ? effectiveSymmetry : null,
            facialResponseChange: hasMeasuredFace ? effectiveFacialResponseDelta : null,
            latencyMs,
            vocalParticipation: vocalParticipation ?? 0,
            lyricTiming: lyricTiming ?? 0,
            voiceFaceSync,
            consonantAccuracy: pronunciation.consonantAccuracy ?? 0,
            vowelAccuracy: pronunciation.vowelAccuracy ?? 0,
            lyricAccuracy: pronunciation.lyricAccuracy ?? 0,
          })
        : `${performanceMeasurementReason ?? measurementReason ?? "노래 수행 데이터가 충분하지 않아 노래 훈련 점수는 로컬 참고용으로만 표시됩니다."} 화면 확인용 결과만 표시됩니다.`;

    setFinalScore(score);
    setFinalJitter(finalJitterText);
    setFinalSi(finalSiText);
    setComment(finalComment);

    const masked =
      userName.length >= 2
        ? `${userName[0]}*${userName[userName.length - 1]}`
        : `${userName}*`;
    const rows: RankRow[] = [
      { name: "박*자", score: 98, region: "전남" },
      { name: "김*식", score: 95, region: "서울" },
      { name: masked, score, region: "본인", me: true },
      { name: "이*순", score: 89, region: "경기" },
      { name: "최*남", score: 87, region: "경남" },
    ].sort((a, b) => b.score - a.score);
    setRankings(rows);
    setScanStatus("COMPLETE");

    if (typeof window !== "undefined") {
      const completedAt = Date.now();
      window.sessionStorage.setItem(
        SING_RESULT_SESSION_KEY,
        JSON.stringify({
          song,
          userName,
          score,
        scoringVersion: SING_SCORING_VERSION,
        scoreReason,
        expectedLyrics,
        finalJitter: finalJitterText,
        finalSi: finalSiText,
        facialResponseDelta: facialResponseDeltaText,
        rtLatency: finalLatencyText,
        finalConsonant: finalConsonantText,
        finalVowel: finalVowelText,
        lyricAccuracy: lyricAccuracyText,
        vocalParticipation:
          vocalParticipation == null ? "--" : vocalParticipation.toFixed(1),
        lyricTiming: lyricTiming == null ? "--" : lyricTiming.toFixed(1),
        voiceFaceSync: voiceFaceSync == null ? "--" : voiceFaceSync.toFixed(1),
        transcript: pronunciation.transcript,
        metricSource,
        measurementReason: performanceMeasurementReason ?? measurementReason,
        comment: finalComment,
        rankings: rows,
        completedAt,
        sourceSessionKey: buildSingSourceSessionKey(song, completedAt),
        reviewAudioUrl: reviewAudio.dataUrl,
        reviewKeyFrames: keyFramesRef.current,
        reviewAudioMediaId: null,
        reviewAudioObjectKey: null,
        reviewAudioUploadState,
        reviewAudioUploadError,
        acoustic: acousticSnapshot,
        ...getSingAdaptiveEvidence(song),
        governance: {
          catalogVersion:
            currentSong.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
          analysisVersion:
            currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
          requirementIds: currentSong.governance.requirementIds,
          failureModes: currentSong.governance.failureModes,
        },
        versionSnapshot: buildVersionSnapshot("sing", {
          algorithm_version:
            currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
          model_version:
            currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
          requirements: currentSong.governance.requirementIds,
          config_version:
            currentSong.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
          measurement_metadata: {
            scoring_version: SING_SCORING_VERSION,
            score_reason: scoreReason,
            expected_lyrics: expectedLyrics,
            transcript: pronunciation.transcript,
            lyric_accuracy: pronunciation.lyricAccuracy,
            consonant_accuracy: pronunciation.consonantAccuracy,
            vowel_accuracy: pronunciation.vowelAccuracy,
            vocal_participation: vocalParticipation,
            lyric_timing: lyricTiming,
            voice_face_sync: voiceFaceSync,
            performance_total_samples: performanceData.totalSamples,
            performance_voiced_samples: performanceData.voicedSamples,
            performance_lyric_samples: performanceData.lyricSamples,
            performance_voiced_lyric_samples: performanceData.voicedLyricSamples,
            performance_face_samples: performanceData.faceSamples,
            performance_voice_face_samples: performanceData.voiceFaceSamples,
            performance_voice_confidence_sum: Number(performanceData.voiceConfidenceSum.toFixed(3)),
            performance_lyric_voice_confidence_sum: Number(performanceData.lyricVoiceConfidenceSum.toFixed(3)),
            performance_voice_face_confidence_sum: Number(performanceData.voiceFaceConfidenceSum.toFixed(3)),
            facial_response_delta:
              hasMeasuredFace && effectiveFacialResponseDelta != null
                ? Number(effectiveFacialResponseDelta.toFixed(1))
                : null,
            baseline_facial_symmetry:
              calibrationBaselineMetricsRef.current.facialSymmetry == null
                ? null
                : Number(calibrationBaselineMetricsRef.current.facialSymmetry.toFixed(1)),
            baseline_tracking_quality:
              calibrationBaselineMetricsRef.current.trackingQuality == null
                ? null
                : Number(calibrationBaselineMetricsRef.current.trackingQuality.toFixed(1)),
          },
        }),
        } satisfies SingResultEnvelope),
      );
      window.sessionStorage.setItem(SING_LAST_SONG_SESSION_KEY, song);
    }

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        stopActiveSession();
        window.location.replace(
          `/result-page/sing-training?song=${encodeURIComponent(song)}`,
        );
      }, 2000);
    }
  };

  const startSinging = async () => {
    const startedAt = performance.now();
    const jitterData: number[] = [];
    const siData: number[] = [];
    const responseDeltaData: number[] = [];
    const performanceData = {
      totalSamples: 0,
      voicedSamples: 0,
      lyricSamples: 0,
      voicedLyricSamples: 0,
      faceSamples: 0,
      voiceFaceSamples: 0,
      voiceConfidenceSum: 0,
      lyricVoiceConfidenceSum: 0,
      voiceFaceConfidenceSum: 0,
    };
    sessionStartRef.current = startedAt;
    measuredPitchHistoryRef.current = [];
    measuredSymmetryHistoryRef.current = [];
    voiceOnsetLatencyMsRef.current = null;
    finishGuardRef.current = false;
    audioEndedRef.current = false;

    setPhase("singing");
    setScanStatus("LIVE");
    setJitterHistory([]);
    setSiHistory([]);
    setLyricFillPct(0);
    await startVoiceRecording();

    const hasReliableAudioDuration = audioReady && songDurationSec > 0;
    const finishAtSec = hasReliableAudioDuration
      ? songDurationSec
      : Math.max(30, lyricTimelineEndSec - lyricLeadOffsetSec);
    const fallbackFinishAtSec = hasReliableAudioDuration
      ? Math.max(songDurationSec + 8, lyricTimelineEndSec - lyricLeadOffsetSec + 2)
      : finishAtSec;

    const finalizeIfNeeded = () => {
      if (finishGuardRef.current) {
        return;
      }
      finishGuardRef.current = true;
      if (singingTimerRef.current !== null) {
        window.clearInterval(singingTimerRef.current);
        singingTimerRef.current = null;
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      void finishSinging(jitterData, siData, responseDeltaData, performanceData);
    };

    finishTimerRef.current = window.setTimeout(
      finalizeIfNeeded,
      Math.max(0, fallbackFinishAtSec * 1000 + 120),
    );

    if (songAudioRef.current) {
      songAudioRef.current.muted = isBgmMuted;
      songAudioRef.current.currentTime = 0;
      songAudioRef.current.onended = () => {
        audioEndedRef.current = true;
      };
      songAudioRef.current.play().catch(() => undefined);
    }

    singingTimerRef.current = window.setInterval(() => {
      const audioElapsed = songAudioRef.current?.currentTime ?? 0;
      const fallbackElapsed = (performance.now() - startedAt) / 1000;
      const elapsed =
        audioReady && audioElapsed > 0.01 ? audioElapsed : fallbackElapsed;
      const lyricElapsed = Math.max(0, elapsed + lyricLeadOffsetSec);
      const effectiveDuration = finishAtSec;
      const remain = Math.max(0, effectiveDuration - elapsed).toFixed(1);
      setRemaining(remain);
      collectSingKeyFrame();

      const firstLine = currentSong.lyrics[0] ?? null;
      const lastStartedIndex = currentSong.lyrics.reduce((foundIndex, line, index) => {
        if (lyricElapsed >= line.t) {
          return index;
        }
        return foundIndex;
      }, -1);

      if (firstLine && lastStartedIndex < 0) {
        setLyricBase("전주 진행 중...");
        setNextLyricBase(firstLine.txt);
        setCurrentLyricCues(null);
        setLyricElapsedSec(0);
        setLyricFillPct(0);
      } else if (lastStartedIndex >= 0) {
        const activeLine = currentSong.lyrics[lastStartedIndex];
        const nextLine = currentSong.lyrics[lastStartedIndex + 1] ?? null;
        const elapsedInLine = Math.max(0, lyricElapsed - activeLine.t);

        setLyricBase(activeLine.txt);
        setNextLyricBase(nextLine?.txt ?? "");
        setCurrentLyricCues(activeLine.cues ?? null);
        setLyricElapsedSec(elapsedInLine);
        setLyricFillPct(
          Math.min(100, (elapsedInLine / activeLine.d) * 100),
        );
      } else {
        setLyricBase("시스템 준비 중...");
        setNextLyricBase("");
        setCurrentLyricCues(null);
        setLyricElapsedSec(0);
        setLyricFillPct(0);
      }

      const analyser = measurementAnalyserRef.current;
      const measurementData = measurementDataRef.current;
      const audioContext = measurementAudioContextRef.current;
      let currentRms = 0;
      let currentVoiced = false;
      let currentVoiceConfidence = 0;
      if (analyser && measurementData && audioContext) {
        (analyser as any).getFloatTimeDomainData(measurementData);
        const rms = computeRms(measurementData);
        currentRms = rms;
        currentVoiceConfidence = computeVoiceConfidenceFromRms(rms);
        currentVoiced = currentVoiceConfidence >= 15;
        performanceData.totalSamples += 1;
        performanceData.voiceConfidenceSum += currentVoiceConfidence;
        if (currentVoiced) {
          performanceData.voicedSamples += 1;
        }
        const activeLyricLine =
          lastStartedIndex >= 0 ? currentSong.lyrics[lastStartedIndex] : null;
        const inActiveLyricWindow =
          Boolean(activeLyricLine) &&
          lyricElapsed >= (activeLyricLine?.t ?? 0) &&
          lyricElapsed <= (activeLyricLine?.t ?? 0) + Math.max(0.1, activeLyricLine?.d ?? 0);
        if (inActiveLyricWindow) {
          performanceData.lyricSamples += 1;
          performanceData.lyricVoiceConfidenceSum += currentVoiceConfidence;
          if (currentVoiced) {
            performanceData.voicedLyricSamples += 1;
          }
        }
        if (voiceOnsetLatencyMsRef.current == null && currentVoiceConfidence >= 20) {
          voiceOnsetLatencyMsRef.current = Math.max(0, performance.now() - startedAt);
        }

        const pitchHz = estimatePitchHz(measurementData, audioContext.sampleRate);
        if (pitchHz && Number.isFinite(pitchHz)) {
          const pitchHistory = measuredPitchHistoryRef.current;
          pitchHistory.push(pitchHz);
          if (pitchHistory.length > 60) pitchHistory.shift();
          if (pitchHistory.length >= 2) {
            const prevPitch = pitchHistory[pitchHistory.length - 2];
            const jitterPct = clamp(
              Math.abs(pitchHz - prevPitch) / Math.max(prevPitch, 1) * 100,
              0,
              100,
            );
            jitterData.push(jitterPct);
            if (jitterData.length > 60) jitterData.shift();
            const jitterAvg =
              jitterData.reduce((sum, value) => sum + value, 0) / jitterData.length;
            setRtJitter(`${jitterAvg.toFixed(2)}%`);
            setJitterHistory([...jitterData]);
          }
        }
      }

      if (sidebarMetrics.faceDetected) {
        performanceData.faceSamples += 1;
        if (currentVoiced) {
          performanceData.voiceFaceSamples += 1;
          performanceData.voiceFaceConfidenceSum += currentVoiceConfidence;
        }
        const symmetryScore = clamp((sidebarMetrics.facialSymmetry || 0) * 100, 0, 100);
        measuredSymmetryHistoryRef.current.push(symmetryScore);
        if (measuredSymmetryHistoryRef.current.length > 60) {
          measuredSymmetryHistoryRef.current.shift();
        }
        siData.push(symmetryScore);
        if (siData.length > 60) siData.shift();
        const symmetryAvg = siData.reduce((sum, value) => sum + value, 0) / siData.length;
        setRtSi(symmetryAvg.toFixed(1));
        setSiHistory([...siData]);
        if (calibrationBaselineSymmetryRef.current != null) {
          const responseDelta = Math.abs(
            symmetryScore - calibrationBaselineSymmetryRef.current,
          );
          responseDeltaData.push(responseDelta);
          if (responseDeltaData.length > 60) responseDeltaData.shift();
        }
      }

      if (voiceOnsetLatencyMsRef.current != null) {
        setRtLatency(`${Math.round(voiceOnsetLatencyMsRef.current)} ms`);
      } else {
        setRtLatency("-- ms");
      }

      if (audioEndedRef.current) {
        finalizeIfNeeded();
        return;
      }

      if (!hasReliableAudioDuration && elapsed >= effectiveDuration) {
        finalizeIfNeeded();
      }
    }, SING_MEASUREMENT_INTERVAL_MS);
  };

  const resetAll = () => {
    stopActiveSession();
    setSong(requestedSong ?? "나비야");
    setPhase(requestedSong ? "ready" : "select");
    setCountdown(3);
    setRemaining("30.0");
    finishGuardRef.current = false;
    setScanStatus("READY");
    setLyricBase("시스템 준비 중...");
    setNextLyricBase("");
    setLyricFillPct(0);
    setLyricElapsedSec(0);
    setCurrentLyricCues(null);
    setRtJitter("0.00%");
    setRtSi("0.0");
    setRtLatency("-- ms");
    setJitterHistory([]);
    setSiHistory([]);
    setCalibrationReady(false);
    setCalibrationMessage("카메라를 켜고 얼굴을 화면 중앙 가이드에 맞춰 주세요.");
    setMediaAccessError(null);
  };

  const handleSkipSong = () => {
    if (!isAdmin || typeof window === "undefined") return;
    stopActiveSession();
    const demoKeyFrames = [
      captureKeyFrame(videoRef.current, "frame-1") ??
        captureKeyFrame(sideVideoRef.current, "frame-1"),
      captureKeyFrame(videoRef.current, "frame-2") ??
        captureKeyFrame(sideVideoRef.current, "frame-2"),
      captureKeyFrame(videoRef.current, "frame-3") ??
        captureKeyFrame(sideVideoRef.current, "frame-3"),
    ].filter((frame): frame is SingKeyFrame => frame != null);
    const skippedResult = buildSkippedSingResult({
      song,
      userName: patient?.name ?? "관리자",
      governance: {
        catalogVersion:
          currentSong.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
        analysisVersion:
          currentSong.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
        requirementIds: currentSong.governance.requirementIds,
        failureModes: currentSong.governance.failureModes,
      },
      reviewKeyFrames: demoKeyFrames,
    });
    window.sessionStorage.setItem(
      SING_RESULT_SESSION_KEY,
      JSON.stringify(skippedResult),
    );
    window.sessionStorage.setItem(SING_LAST_SONG_SESSION_KEY, song);
    void logTrainingEvent({
      eventType: "sing_training_skipped",
      eventStatus: "skipped",
      trainingType: "sing-training",
      pagePath: "/programs/sing-training",
      stepNo: 0,
      sessionId: patient?.sessionId ?? null,
      payload: {
        song,
        ageGroup,
      },
    });
    window.location.replace(
      `/result-page/sing-training?song=${encodeURIComponent(song)}&demo=skip`,
    );
  };

  return (
    <div className="flex min-h-screen lg:h-full lg:min-h-0 flex-col overflow-y-auto lg:overflow-hidden bg-[#f7faf8] text-slate-900">
      <header className="shrink-0 border-b border-emerald-100 bg-white/95 px-4 sm:px-6 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="h-10 w-10 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 leading-none">
                Active Patient Profile
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm sm:text-lg font-black text-slate-900">
                <span className="truncate">{patient?.name ?? "정보 없음"}</span>
                <span className="text-xs sm:text-sm font-bold text-slate-500">
                  {patient?.age ?? "-"}세
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600">
                  {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleSkipSong}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-black text-emerald-700 shadow-sm sm:text-xs"
              >
                SKIP
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                stopActiveSession();
                router.push("/select-page/sing-training");
              }}
              className="rounded-full border border-emerald-500 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-[11px] sm:text-xs font-black text-white shadow-sm"
            >
              곡선택
            </button>
            <button
              type="button"
              onClick={() => {
                stopActiveSession();
                router.push("/select-page/mode");
              }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] sm:text-xs font-black text-slate-700 shadow-sm"
            >
              활동선택
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto lg:min-h-0 lg:overflow-hidden px-4 sm:px-6 py-4">
        <div className="flex min-h-[calc(100svh-120px)] lg:h-full lg:min-h-0 items-center justify-center">
          <section
            className={`relative h-full w-full min-h-[calc(100svh-140px)] lg:min-h-0 overflow-hidden rounded-[28px] border shadow-[0_10px_30px_rgba(16,185,129,0.05)] ${
              phase === "singing" || phase === "countdown"
                ? "border-slate-900 bg-[#08111f]"
                : "border-emerald-100 bg-white"
            }`}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="hidden lg:block absolute inset-0 h-full w-full object-contain scale-x-[-1] bg-black"
            />
            <canvas
              ref={mouthOverlayCanvasRef}
              aria-hidden="true"
              className="pointer-events-none hidden lg:block absolute inset-0 z-[3] h-full w-full"
            />

            <div
              className={`absolute inset-0 ${
                phase === "ready"
                  ? "bg-white"
                  : "bg-gradient-to-t from-black/55 via-black/10 to-black/35"
              }`}
            />

            <div className="absolute left-6 top-6 z-10 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white backdrop-blur-md">
              {currentSong.level} · {song}
            </div>

            <button
              type="button"
              onClick={() => setIsBgmMuted((prev) => !prev)}
              className="absolute right-6 top-6 z-10 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 text-sm font-black text-white backdrop-blur-md"
            >
              {isBgmMuted ? (
                <>
                  <VolumeX className="h-4 w-4" />
                  BGM 끔
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  BGM 켬
                </>
              )}
            </button>

            {phase === "singing" && (
              <>
                {/* 상단 그라데이션 매트 — KPI 캡슐과 LEVEL 배지 시인성 보강 */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[26%] bg-gradient-to-b from-black/70 via-black/35 to-transparent" />
                {/* 하단 그라데이션 매트 — 자막 띠 가독성 보강 */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[44%] bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[4] h-px bg-emerald-300/40 shadow-[0_0_18px_rgba(52,211,153,0.5)]" />

                {/* 상단 가운데 KPI 캡슐 — 가로형 슬림 */}
                <div className="absolute left-1/2 top-6 z-10 -translate-x-1/2 w-[min(560px,calc(100%-48px))]">
                  <div className="flex items-center gap-4 rounded-full border border-white/20 bg-black/55 px-5 py-3 text-white shadow-[0_14px_36px_rgba(0,0,0,0.40)] backdrop-blur-md">
                    {/* 남은 시간 */}
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[28px] font-black leading-none tracking-[-0.04em]">
                        {remaining}
                      </span>
                      <span className="text-xs font-black text-white/55">초</span>
                    </div>

                    {/* 진척바 (가운데, flex-1로 확장) */}
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)] transition-[width] duration-200"
                        style={{ width: `${remainingPct}%` }}
                      />
                    </div>

                    {/* 추적 상태 도트 + 품질 % */}
                    <div className="flex items-center gap-2">
                      <span
                        aria-label={liveLipTrackingLabel}
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${
                          liveLipTrackingLabel === "입술 추적 중"
                            ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                            : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                        }`}
                      />
                      <span className="font-mono text-sm font-black tabular-nums">
                        {liveTrackingQuality.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 하단 자막 띠 — 카메라 영역 맨 아래 풀 너비, 검은 그라데이션 위 */}
                <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-8 pt-12 sm:pb-10 lg:pb-12 lg:pt-16">
                  <div className="mx-auto w-full max-w-[1180px] text-center">
                    {/* 다음 가사 (위에 작게) */}
                    {nextLyricBase ? (
                      <p className="line-clamp-1 text-base font-bold tracking-[-0.02em] text-white/45 sm:text-lg lg:text-xl">
                        <span className="mr-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                          NEXT
                        </span>
                        {nextLyricBase}
                      </p>
                    ) : null}

                    {/* 현재 가사 (메인, 큼직하게) */}
                    <p className="mt-2 relative flex flex-wrap items-center justify-center gap-x-[0.04em] text-4xl font-black leading-[1.15] tracking-[-0.03em] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)] sm:text-5xl lg:text-[64px]">
                      {renderProgressLyric(
                        lyricBase,
                        lyricFillPct,
                        currentLyricCues,
                        lyricElapsedSec,
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}

            {phase === "ready" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-md">
                <div className="flex w-full max-w-[760px] flex-col items-center gap-6 sm:gap-10 lg:gap-12 rounded-[28px] sm:rounded-[36px] border border-white/25 bg-white/88 px-6 py-8 sm:px-10 sm:pt-18 sm:pb-16 lg:px-16 lg:pt-22 lg:pb-18 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-md">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-black uppercase tracking-[0.24em] text-white shadow-[0_14px_28px_rgba(16,185,129,0.35)] sm:px-6 sm:py-3 sm:text-base">
                      <Music className="h-5 w-5" />
                      <span>Level 1</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 sm:gap-5">
                    <Mic className="h-8 w-8 sm:h-11 sm:w-11 lg:h-12 lg:w-12 text-emerald-500" />
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-slate-900">
                      {song}
                    </h2>
                  </div>
                  <p className="max-w-[620px] text-base sm:text-xl lg:text-2xl xl:text-[28px] font-medium leading-relaxed text-slate-500">
                    시작하기를 누르면 카운트다운 후
                    <br />
                    카메라와 가창 분석이 시작됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCalibration()}
                    className="inline-flex h-12 sm:h-[72px] lg:h-[84px] items-center justify-center gap-3 rounded-full bg-emerald-500 px-8 sm:px-12 lg:px-14 text-base sm:text-2xl lg:text-3xl font-black text-white shadow-[0_18px_38px_rgba(16,185,129,0.38)] transition-transform duration-200 hover:scale-105 hover:bg-emerald-400"
                  >
                    <Camera className="h-7 w-7" />
                    얼굴 맞추기
                  </button>
                </div>
              </div>
            )}

            {phase === "calibrating" && (() => {
              const trackingPct = normalizeTrackingQuality(
                sidebarMetrics.trackingQuality,
              );
              return (
                <div className="absolute inset-0 z-20 pointer-events-none bg-[rgba(15,23,42,0.10)]">
                  <div className="absolute left-5 top-20 w-[min(360px,calc(100%-40px))] rounded-[24px] border border-white/30 bg-[rgba(15,23,42,0.55)] p-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.30)] backdrop-blur-md sm:left-6">
                    {/* 헤더: 큰 진척률 + 상태 */}
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
                          측정 준비
                        </p>
                        <h2 className="mt-1 text-2xl font-black leading-none tracking-[-0.03em]">
                          입술선 보정 중
                        </h2>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[34px] font-black leading-none tracking-[-0.04em] text-white">
                          {trackingPct.toFixed(0)}
                          <span className="ml-0.5 text-base text-white/60">%</span>
                        </p>
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                          추적 품질
                        </p>
                      </div>
                    </div>

                    {/* 진척바 */}
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          calibrationReady
                            ? "bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)]"
                            : "bg-[linear-gradient(90deg,#f59e0b_0%,#fbbf24_100%)]"
                        }`}
                        style={{
                          width: `${Math.max(4, Math.min(100, trackingPct))}%`,
                        }}
                      />
                    </div>

                    {/* 가이드 */}
                    <p className="mt-4 text-sm font-semibold leading-relaxed text-white/85">
                      카메라를 정면으로 보고, 입술이 화면 가운데에 오도록 자세를
                      잡아 주세요.
                    </p>

                    {/* 표시선 범례 */}
                    <div className="mt-4 rounded-2xl border border-white/15 bg-white/8 px-3 py-2.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
                        화면 표시선
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                          초록 — 입술 외곽
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                          주황 — 구강 개방
                        </span>
                      </div>
                    </div>

                    {/* 상태 메시지 */}
                    <div
                      className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold leading-relaxed ${
                        calibrationReady
                          ? "bg-emerald-500/20 text-emerald-100"
                          : "bg-amber-500/15 text-amber-100"
                      }`}
                    >
                      <span aria-hidden className="mt-0.5">
                        {calibrationReady ? "✓" : "•"}
                      </span>
                      <span>{calibrationMessage}</span>
                    </div>
                  </div>

                  {/* 액션 영역 (우하단) */}
                  <div className="pointer-events-auto absolute bottom-6 right-6 flex w-[min(360px,calc(100%-48px))] gap-3 rounded-[24px] border border-white/50 bg-white/95 p-3 text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.20)] backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => void startCalibration()}
                      className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      다시 인식
                    </button>
                    <button
                      type="button"
                      onClick={startCountdown}
                      disabled={!calibrationReady}
                      className={`inline-flex h-12 flex-[1.4] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-black transition ${
                        calibrationReady
                          ? "bg-emerald-500 text-white shadow-[0_16px_34px_rgba(16,185,129,0.38)] hover:bg-emerald-400"
                          : "cursor-not-allowed bg-slate-200 text-slate-400"
                      }`}
                    >
                      노래 시작
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {phase === "countdown" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(15,23,42,0.16)]">
                <div className="flex flex-col items-center gap-6 text-center">
                  <p className="text-sm font-black uppercase tracking-[0.34em] text-white/80 sm:text-base">
                    Singing Starts In
                  </p>
                  <div className="text-[220px] font-black leading-none text-white drop-shadow-[0_10px_34px_rgba(16,185,129,0.42)] sm:text-[280px]">
                    {countdown === 0 ? "시작" : countdown}
                  </div>
                  <div className="flex items-center gap-3">
                    {[3, 2, 1].map((step) => (
                      <div
                        key={step}
                        className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-black transition-all sm:h-14 sm:w-14 sm:text-xl ${
                          countdown <= step && countdown !== 0
                            ? "border-emerald-300 bg-emerald-400 text-white shadow-[0_0_28px_rgba(52,211,153,0.45)]"
                            : "border-white/25 bg-white/10 text-white/55"
                        }`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function BrainSingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7faf8] text-sm font-black uppercase tracking-[0.2em] text-emerald-600">
          Initializing Singing Engine...
        </div>
      }
    >
      <BrainSingPageContent />
    </Suspense>
  );
}

function OverlayShell({
  children,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f7faf8]/92 p-6 text-center backdrop-blur-[3px]">
      <div className="w-full max-w-5xl rounded-[32px] border border-emerald-100 bg-white p-8 shadow-2xl sm:p-10">
        <h2 className="mb-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h2>
        <p className="mb-8 text-sm font-medium text-slate-500 sm:text-base">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}

function MetricCard({
  accent,
  title,
  value,
}: {
  accent: "blue" | "emerald" | "slate";
  title: string;
  value: string;
}) {
  const accentMap = {
    blue: "border-l-sky-500 bg-sky-50 text-sky-700",
    emerald: "border-l-emerald-500 bg-emerald-50 text-emerald-700",
    slate: "border-l-slate-400 bg-slate-50 text-slate-700",
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 border-l-[6px] p-4 ${accentMap[accent]}`}
    >
      <label className="block text-[10px] font-extrabold uppercase tracking-widest">
        {title}
      </label>
      <p className="mt-1 font-mono text-3xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ResultStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-extrabold text-slate-500">{title}</p>
      <p className="mt-1 font-mono text-2xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}
