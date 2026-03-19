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
  song: string;
  userName: string;
  score: number;
  finalJitter: string;
  finalSi: string;
  facialResponseDelta?: string;
  rtLatency: string;
  finalConsonant?: string;
  finalVowel?: string;
  lyricAccuracy?: string;
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
  governance: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot: VersionSnapshot;
};

const SING_RESULT_SESSION_KEY = "bf_sing_result_transient";
const SING_LAST_SONG_SESSION_KEY = "bf_sing_song_transient";

const LYRIC_LEAD_OFFSET_SEC = 0.28;
const AUDIO_LEVEL_ONSET_THRESHOLD = 0.02;
const MIN_VOICED_RMS = 0.015;
const MIN_MEASURED_PITCH_SAMPLES = 8;
const MIN_MEASURED_FACE_SAMPLES = 3;
const MIN_SING_TRANSCRIPT_CHARS = 2;
const MAX_SING_KEY_FRAMES = 3;
const KEY_FRAME_CAPTURE_INTERVAL_MS = 5000;
const CALIBRATION_MIN_TRACKING_QUALITY = 30;
const CALIBRATION_MIN_FACE_WIDTH = 0.1;
const CALIBRATION_MAX_CENTER_OFFSET = 0.18;
const CALIBRATION_STABLE_MS = 400;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeRms(samples: ArrayLike<number>) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
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
  consonantAccuracy: number;
  vowelAccuracy: number;
  lyricAccuracy: number;
}) {
  const latencyText =
    params.latencyMs == null ? "반응속도는 측정되지 않았습니다" : `반응 시작 시간은 ${params.latencyMs}ms`;
  const faceText =
    params.facialResponseChange == null
      ? "기준 얼굴 대비 안면 반응 변화는 측정되지 않았습니다"
      : `기준 얼굴 대비 안면 반응 변화는 ${params.facialResponseChange.toFixed(1)}점`;
  const supportText =
    params.facialSymmetry == null
      ? "안면 반응 보조 기준값은 확보되지 않았습니다"
      : `안면 반응 보조 기준값은 ${params.facialSymmetry.toFixed(1)}점이었습니다`;
  return `가창 분석 결과 자음 정확도는 ${params.consonantAccuracy.toFixed(1)}점, 모음 정확도는 ${params.vowelAccuracy.toFixed(1)}점, 가사 일치도는 ${params.lyricAccuracy.toFixed(1)}점으로 분석되었습니다. ${faceText}이며 ${supportText}. 발성 흔들림은 ${params.jitterPct.toFixed(2)}% 수준입니다. ${latencyText}.`;
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
    return "녹음 오디오가 생성되지 않아 발음 분석을 수행하지 못했습니다.";
  }

  if (params.pronunciationErrorReason === "insufficient_transcript") {
    return "전사된 가사 길이가 너무 짧아 자음·모음 분석을 확정하지 못했습니다.";
  }

  if (
    params.pronunciationErrorReason &&
    params.pronunciationErrorReason !== "stt_unknown_error"
  ) {
    return `발음 분석 중 오류가 발생했습니다: ${params.pronunciationErrorReason}`;
  }

  if (params.pronunciationErrorReason === "stt_unknown_error") {
    return "STT 응답을 해석하지 못해 발음 분석을 확정하지 못했습니다.";
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
    const { text } = await transcriber.transcribe(params.audioBlob);
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
  consonantAccuracy: number | null;
  vowelAccuracy: number | null;
  lyricAccuracy: number | null;
  facialSymmetryAbsolute: number | null;
  facialResponseChange: number | null;
  latencyMs: number | null;
}) {
  const weightedParts: Array<{ value: number | null; weight: number }> = [
    { value: metrics.consonantAccuracy, weight: 0.35 },
    { value: metrics.vowelAccuracy, weight: 0.35 },
    { value: metrics.lyricAccuracy, weight: 0.15 },
    { value: metrics.facialSymmetryAbsolute, weight: 0.03 },
    { value: metrics.facialResponseChange, weight: 0.07 },
    {
      value:
        metrics.latencyMs == null
          ? null
          : clamp(100 - Math.max(0, metrics.latencyMs - 180) / 6, 0, 100),
      weight: 0.05,
    },
  ];

  const available = weightedParts.filter((part) => part.value != null);
  if (!available.length) return 0;
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  const totalScore = available.reduce(
    (sum, part) => sum + Number(part.value) * (part.weight / totalWeight),
    0,
  );
  return Math.round(clamp(totalScore, 0, 100));
}

function normalizeTrackingQuality(value: number) {
  const safe = Number(value || 0);
  return safe <= 1 ? safe * 100 : safe;
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
}): SingResultEnvelope {
  return {
    song: params.song,
    userName: params.userName || "사용자",
    score: 0,
    finalJitter: "--",
    finalSi: "--",
    facialResponseDelta: "--",
    rtLatency: "-- ms",
    finalConsonant: "--",
    finalVowel: "--",
    lyricAccuracy: "--",
    transcript: "",
    metricSource: "demo",
    measurementReason: "관리자 skip으로 인해 실측을 수행하지 않았습니다.",
    comment:
      "관리자 skip으로 생성된 화면 확인용 결과입니다. 실측 데이터가 아니므로 서버 저장과 랭킹 반영은 수행되지 않습니다.",
    rankings: [],
    completedAt: Date.now(),
    reviewAudioUrl: null,
    reviewKeyFrames: [],
    reviewAudioMediaId: null,
    reviewAudioObjectKey: null,
    reviewAudioUploadState: "not_recorded",
    reviewAudioUploadError: null,
    governance: params.governance,
    versionSnapshot: buildVersionSnapshot("sing", {
      algorithm_version: params.governance.analysisVersion,
      model_version: params.governance.analysisVersion,
      requirements: params.governance.requirementIds,
      config_version: params.governance.catalogVersion,
      measurement_metadata: {
        facial_response_delta: null,
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
  const keyFramesRef = useRef<SingKeyFrame[]>([]);
  const lastKeyFrameCapturedAtRef = useRef<number>(0);
  const measuredPitchHistoryRef = useRef<number[]>([]);
  const measuredSymmetryHistoryRef = useRef<number[]>([]);
  const voiceOnsetLatencyMsRef = useRef<number | null>(null);

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
      calibrationBaselineSymmetryRef.current = sidebarMetrics.faceDetected
        ? clamp((sidebarMetrics.facialSymmetry || 0) * 100, 0, 100)
        : null;
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

  const startVoiceRecording = () => {
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

      const recorder = new MediaRecorder(new MediaStream(audioTracks));
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
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
            startSinging();
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
    const hasMeasuredPronunciation =
      pronunciation.consonantAccuracy != null &&
      pronunciation.vowelAccuracy != null &&
      pronunciation.lyricAccuracy != null;
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
    const metricSource =
      hasMeasuredPronunciation || hasMeasuredFace ? "measured" : "demo";
    const effectiveJitter = avgJ ?? 0;
    const score = calculateCompositeSingScore({
      consonantAccuracy: pronunciation.consonantAccuracy,
      vowelAccuracy: pronunciation.vowelAccuracy,
      lyricAccuracy: pronunciation.lyricAccuracy,
      facialSymmetryAbsolute: hasMeasuredFace ? effectiveSymmetry : null,
      facialResponseChange: hasMeasuredFace
        ? clamp(effectiveFacialResponseDelta * 12, 0, 100)
        : null,
      latencyMs,
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

    const finalComment =
      metricSource === "measured"
        ? buildMeasuredComment({
            jitterPct: effectiveJitter,
            facialSymmetry: hasMeasuredFace ? effectiveSymmetry : null,
            facialResponseChange: hasMeasuredFace ? effectiveFacialResponseDelta : null,
            latencyMs,
            consonantAccuracy: pronunciation.consonantAccuracy ?? 0,
            vowelAccuracy: pronunciation.vowelAccuracy ?? 0,
            lyricAccuracy: pronunciation.lyricAccuracy ?? 0,
          })
        : `${measurementReason ?? "자음·모음 또는 안면 측정 데이터가 충분하지 않아 노래방 점수는 로컬 참고용으로만 표시됩니다."} 화면 확인용 결과만 표시됩니다.`;

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
      window.sessionStorage.setItem(
        SING_RESULT_SESSION_KEY,
        JSON.stringify({
          song,
          userName,
          score,
        finalJitter: finalJitterText,
        finalSi: finalSiText,
        facialResponseDelta: facialResponseDeltaText,
        rtLatency: finalLatencyText,
        finalConsonant: finalConsonantText,
        finalVowel: finalVowelText,
        lyricAccuracy: lyricAccuracyText,
        transcript: pronunciation.transcript,
        metricSource,
        measurementReason,
        comment: finalComment,
        rankings: rows,
        completedAt: Date.now(),
        reviewAudioUrl: reviewAudio.dataUrl,
        reviewKeyFrames: keyFramesRef.current,
        reviewAudioMediaId: null,
        reviewAudioObjectKey: null,
        reviewAudioUploadState,
        reviewAudioUploadError,
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
            facial_response_delta:
              hasMeasuredFace && effectiveFacialResponseDelta != null
                ? Number(effectiveFacialResponseDelta.toFixed(1))
                : null,
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

  const startSinging = () => {
    const startedAt = performance.now();
    const jitterData: number[] = [];
    const siData: number[] = [];
    const responseDeltaData: number[] = [];
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
    startVoiceRecording();

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
      void finishSinging(jitterData, siData, responseDeltaData);
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
      if (analyser && measurementData && audioContext) {
        (analyser as any).getFloatTimeDomainData(measurementData);
        const rms = computeRms(measurementData);
        if (voiceOnsetLatencyMsRef.current == null && rms >= AUDIO_LEVEL_ONSET_THRESHOLD) {
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
    }, 100);
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7faf8] text-slate-900">
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

      <main className="flex-1 min-h-0 overflow-hidden px-4 sm:px-6 py-4">
        <div className="flex h-full min-h-0 items-center justify-center">
          <section className="relative h-full w-full overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_10px_30px_rgba(16,185,129,0.05)]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-contain scale-x-[-1] bg-black"
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
                <div className="absolute inset-0 z-[2] opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:52px_52px]" />
                <div className="brain-sing-scanline absolute inset-x-0 top-0 z-[4] h-[22%]" />
                <div className="absolute inset-x-0 top-0 z-[4] h-px bg-emerald-300/45 shadow-[0_0_24px_rgba(52,211,153,0.6)]" />
                <div className="absolute right-6 top-20 z-10 font-mono text-[56px] font-black tracking-tight text-white drop-shadow-[0_0_16px_rgba(0,0,0,0.7)] sm:text-[64px]">
                  {remaining}
                </div>
                <div className="absolute bottom-8 left-1/2 z-10 w-[min(96%,980px)] -translate-x-1/2 overflow-hidden rounded-[26px] border border-emerald-200/18 bg-black/22 px-8 py-5 text-center backdrop-blur-md sm:bottom-10 lg:w-[min(88%,1120px)] lg:px-10 lg:py-6">
                  <p className="relative flex flex-wrap items-center justify-center gap-x-[0.03em] text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-5xl">
                    {renderProgressLyric(
                      lyricBase,
                      lyricFillPct,
                      currentLyricCues,
                      lyricElapsedSec,
                    )}
                  </p>
                  <p className="mt-3 line-clamp-1 text-xl font-black tracking-[-0.03em] text-white/40 sm:text-2xl lg:text-3xl">
                    {nextLyricBase}
                  </p>
                </div>
              </>
            )}

            {phase === "ready" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-md">
                <div className="flex w-full max-w-[760px] flex-col items-center gap-10 rounded-[36px] border border-white/25 bg-white/88 px-10 pt-18 pb-16 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-md sm:gap-12 sm:px-16 sm:pt-22 sm:pb-18">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-black uppercase tracking-[0.24em] text-white shadow-[0_14px_28px_rgba(16,185,129,0.35)] sm:px-6 sm:py-3 sm:text-base">
                      <Music className="h-5 w-5" />
                      <span>Level 1</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-5">
                    <Mic className="h-11 w-11 text-emerald-500 sm:h-12 sm:w-12" />
                    <h2 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
                      {song}
                    </h2>
                  </div>
                  <p className="max-w-[620px] text-2xl font-medium leading-relaxed text-slate-500 sm:text-[28px]">
                    시작하기를 누르면 카운트다운 후
                    <br />
                    카메라와 가창 분석이 시작됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCalibration()}
                    className="inline-flex h-[72px] items-center justify-center gap-3 rounded-full bg-emerald-500 px-12 text-2xl font-black text-white shadow-[0_18px_38px_rgba(16,185,129,0.38)] transition-transform duration-200 hover:scale-105 hover:bg-emerald-400 sm:h-[84px] sm:px-14 sm:text-3xl"
                  >
                    <Camera className="h-7 w-7" />
                    얼굴 맞추기
                  </button>
                </div>
              </div>
            )}

            {phase === "calibrating" && (
              <div className="absolute inset-0 z-20 bg-[rgba(15,23,42,0.12)] backdrop-blur-[0.5px]">
                <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-8">
                  <div className="pointer-events-auto relative flex w-full max-w-[760px] flex-col items-center rounded-[34px] border border-white/55 bg-[rgba(255,255,255,0.18)] px-6 py-7 text-center shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-md sm:px-8 sm:py-8">
                    <div className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.34em] text-emerald-300">
                        Face Calibration
                      </p>
                      <h2 className="text-3xl font-black tracking-[-0.04em] text-white drop-shadow-[0_2px_10px_rgba(15,23,42,0.28)] sm:text-4xl">
                        얼굴을 가이드에 맞춰 주세요
                      </h2>
                      <p className="text-sm font-semibold text-white/85 sm:text-base">
                        시작 전에 정면 얼굴을 먼저 안정적으로 인식합니다.
                      </p>
                    </div>

                    <div className="relative mt-5 flex h-[250px] w-[210px] items-center justify-center sm:mt-6 sm:h-[300px] sm:w-[248px]">
                      <div className="absolute inset-0 rounded-[48%] border-[3px] border-dashed border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.20)]" />
                      <div className="absolute inset-[10px] rounded-[48%] border border-emerald-300/40" />
                      <div className="absolute left-1/2 top-[16%] h-[68%] w-[2px] -translate-x-1/2 bg-emerald-400/85" />
                      <div className="absolute left-1/2 top-1/2 h-[2px] w-[68%] -translate-x-1/2 bg-emerald-400/75" />
                      <div className="absolute left-1/2 top-[36%] h-3.5 w-3.5 -translate-x-1/2 rounded-full border border-emerald-100 bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.35)]" />
                    </div>

                    <div className="mt-5 w-full rounded-[22px] border border-white/35 bg-[rgba(15,23,42,0.22)] px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-bold text-white/95">{calibrationMessage}</p>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                            calibrationReady
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-white/15 text-white/85"
                          }`}
                        >
                          추적 품질 {normalizeTrackingQuality(sidebarMetrics.trackingQuality).toFixed(0)}%
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => void startCalibration()}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-white/35 bg-white px-5 text-sm font-black text-slate-700"
                        >
                          다시 인식
                        </button>
                        <button
                          type="button"
                          onClick={startCountdown}
                          disabled={!calibrationReady}
                          className={`inline-flex h-12 items-center justify-center gap-3 rounded-full px-7 text-base font-black transition ${
                            calibrationReady
                              ? "bg-emerald-500 text-white shadow-[0_16px_34px_rgba(16,185,129,0.38)] hover:bg-emerald-400"
                              : "cursor-not-allowed bg-white/20 text-white/45"
                          }`}
                        >
                          <ChevronRight className="h-5 w-5" />
                          노래 시작
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
