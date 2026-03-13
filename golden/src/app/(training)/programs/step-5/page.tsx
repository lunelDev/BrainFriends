"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  Suspense,
  useCallback,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PlaceType } from "@/constants/trainingData";
import { READING_TEXTS } from "@/constants/readingData";
import { SpeechAnalyzer } from "@/lib/speech/SpeechAnalyzer";
import { useTraining } from "../../TrainingContext";
import { AnalysisSidebar } from "@/components/training/AnalysisSidebar";
import { HomeExitModal } from "@/components/training/HomeExitModal";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { loadPatientProfile } from "@/lib/patientStorage";
import { saveTrainingExitProgress } from "@/lib/trainingExitProgress";
import { uploadClinicalMedia } from "@/lib/client/clinicalMediaUpload";
import {
  analyzeArticulation,
  calculateArticulationWritingConsistency,
  createInitialArticulationAnalyzerState,
} from "@/lib/analysis/articulationAnalyzer";
import { estimateLipSymmetryFromLandmarks } from "@/lib/analysis/lipMetrics";
import { buildVersionSnapshot } from "@/lib/analysis/versioning";
import { addSentenceLineBreaks } from "@/lib/text/displayText";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import {
  blendArticulationAccuracy,
  getStep5TextSizeClass,
} from "@/features/steps/step5/utils";
import {
  buildStepSignature,
  isResumeMetaMatched,
  saveResumeMeta,
} from "@/lib/trainingResume";

export const dynamic = "force-dynamic";
const STEP5_STORAGE_KEY = "step5_recorded_data";

interface ReadingMetrics {
  index?: number;
  place: string;
  text: string;
  transcript?: string;
  isCorrect?: boolean;
  audioUrl: string;
  totalTime: number;
  responseTime?: number;
  recognitionResponseMs?: number;
  wordsPerMinute: number;
  pauseCount: number;
  readingScore: number;
  readingAccuracyScore?: number;
  fluencyScore?: number;
  articulationClarityScore?: number;
  consonantAccuracy: number;
  vowelAccuracy: number;
  articulationWritingConsistency?: number;
  consonantDetail?: {
    closureRatePct: number;
    closureHoldMs: number;
    lipSymmetryPct: number;
    openingSpeedMs: number;
  };
  vowelDetail?: {
    mouthOpeningPct: number;
    mouthWidthPct: number;
    roundingPct: number;
    patternMatchPct: number;
  };
  dataSource?: "measured" | "demo";
}

const calculateTextSimilarityPercent = (expected: string, actual: string) => {
  const exp = String(expected || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const act = String(actual || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!exp.length && !act.length) return 100;
  if (!exp.length || !act.length) return 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= exp.length; i++) matrix[i] = [i];
  for (let j = 0; j <= act.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= exp.length; i++) {
    for (let j = 1; j <= act.length; j++) {
      const cost = exp[i - 1] === act[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const distance = matrix[exp.length][act.length];
  const maxLength = Math.max(exp.length, act.length);
  return Math.max(0, Math.min(100, ((maxLength - distance) / maxLength) * 100));
};

const normalizeTextForLength = (text: string) =>
  String(text || "")
    .replace(/\s+/g, "")
    .replace(/[^\u3131-\u318E\uAC00-\uD7A3a-zA-Z0-9]/g, "");

const calculateReadingCompletenessScore = (
  expected: string,
  transcript: string,
) => {
  const expectedLen = normalizeTextForLength(expected).length;
  const actualLen = normalizeTextForLength(transcript).length;
  if (expectedLen <= 0) return 0;
  const ratio = Math.min(1, actualLen / expectedLen);
  return Number((ratio * 100).toFixed(1));
};

const calculateSpeedStabilityScore = (wpm: number) => {
  if (!Number.isFinite(wpm) || wpm <= 0) return 0;
  if (wpm < 40) return 35;
  if (wpm < 70) return 35 + ((wpm - 40) / 30) * 45; // 35~80
  if (wpm <= 110) return 100; // 권장 구간
  if (wpm <= 150) return 100 - ((wpm - 110) / 40) * 40; // 100~60
  return Math.max(25, 60 - ((wpm - 150) / 30) * 20); // 과속 패널티
};

function Step5Content() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    sidebarMetrics,
    updateSidebar,
    updateRuntimeStatus,
    resetRuntimeStatus,
  } = useTraining();

  const place = (searchParams.get("place") as PlaceType) || "home";
  const step4Score = searchParams.get("step4") || "0";
  const isRehabMode =
    searchParams.get("trainMode") === "rehab" ||
    (typeof window !== "undefined" &&
      sessionStorage.getItem("btt.trainingMode") === "rehab");
  const clinicalTrainingType = isRehabMode ? "speech-rehab" : "self-assessment";
  const accentOutline = isRehabMode
    ? "bg-white text-sky-600 border border-sky-200 hover:bg-sky-50 transition-all"
    : trainingButtonStyles.orangeOutline;
  const accentSolid = isRehabMode
    ? "bg-sky-500 text-white border border-sky-500 hover:bg-sky-600 transition-all"
    : trainingButtonStyles.orangeSolid;
  const rehabTargetStep = Number(searchParams.get("targetStep") || "0");
  const pushStep6OrRehabResult = useCallback(
    (step5Value: number) => {
      if (isRehabMode && rehabTargetStep === 5) {
        const params = new URLSearchParams({
          place,
          trainMode: "rehab",
          targetStep: "5",
          step1: searchParams.get("step1") || "0",
          step2: searchParams.get("step2") || "0",
          step3: searchParams.get("step3") || "0",
          step4: step4Score || "0",
          step5: String(step5Value),
          step6: "0",
        });
        router.push(`/result-page/speech-rehab?${params.toString()}`);
        return;
      }
      router.push(
        `/programs/step-6?place=${place}&step4=${step4Score}&step5=${step5Value}`,
      );
    },
    [isRehabMode, place, rehabTargetStep, router, searchParams, step4Score],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyzerRef = useRef<SpeechAnalyzer | null>(null);
  const readingStartAtRef = useRef<number | null>(null);
  const readingSecondsRef = useRef(0);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"ready" | "reading" | "review">("ready");
  const [readingTime, setReadingTime] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentResult, setCurrentResult] = useState<ReadingMetrics | null>(
    null,
  );
  const [results, setResults] = useState<ReadingMetrics[]>([]);
  const [showTracking, setShowTracking] = useState(true);
  const [isHomeExitModalOpen, setIsHomeExitModalOpen] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const articulationStateRef = useRef(createInitialArticulationAnalyzerState());
  const liveArticulationRef = useRef({
    consonant: 0,
    vowel: 0,
    consonantDetails: {
      closureRatePct: 0,
      closureHoldMs: 0,
      lipSymmetryPct: 0,
      openingSpeedMs: 0,
      closureHoldScore: 0,
      openingSpeedScore: 0,
      finalScore: 0,
    },
    vowelDetails: {
      mouthOpeningPct: 0,
      mouthWidthPct: 0,
      roundingPct: 0,
      patternMatchPct: 0,
      finalScore: 0,
    },
  });
  const articulationAggregateRef = useRef({
    consonantSum: 0,
    vowelSum: 0,
    closureRateSum: 0,
    closureHoldMsSum: 0,
    lipSymmetrySum: 0,
    openingSpeedMsSum: 0,
    mouthOpeningSum: 0,
    mouthWidthSum: 0,
    roundingSum: 0,
    patternMatchSum: 0,
    count: 0,
  });

  const handleGoHome = () => {
    setIsHomeExitModalOpen(true);
  };
  const confirmGoHome = () => {
    if (isRehabMode) {
      router.push("/select-page/speech-rehab");
      return;
    }
    const isTrialMode =
      typeof window !== "undefined" &&
      sessionStorage.getItem("btt.trialMode") === "1";
    if (isTrialMode) {
      router.push("/");
      return;
    }
    saveTrainingExitProgress(place, 5);
    router.push("/select-page/self-assessment");
  };

  const texts = useMemo(
    () => READING_TEXTS[place] || READING_TEXTS.home,
    [place],
  );
  const stepSignature = useMemo(
    () =>
      buildStepSignature(
        "step5",
        place,
        texts.map((item) => item.text),
      ),
    [place, texts],
  );
  const currentItem = texts[currentIndex];
  const formattedText = useMemo(
    () => addSentenceLineBreaks(currentItem?.text || ""),
    [currentItem],
  );
  const words = useMemo(
    () => formattedText.split(/\s+/).filter(Boolean),
    [formattedText],
  );
  const textLines = useMemo(
    () =>
      formattedText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [formattedText],
  );
  const readingTextSizeClass = useMemo(
    () => getStep5TextSizeClass(formattedText),
    [formattedText],
  );
  const hasWhitespace = useMemo(
    () => /\s/.test(formattedText),
    [formattedText],
  );

  useEffect(() => {
    articulationStateRef.current = createInitialArticulationAnalyzerState();
    articulationAggregateRef.current = {
      consonantSum: 0,
      vowelSum: 0,
      closureRateSum: 0,
      closureHoldMsSum: 0,
      lipSymmetrySum: 0,
      openingSpeedMsSum: 0,
      mouthOpeningSum: 0,
      mouthWidthSum: 0,
      roundingSum: 0,
      patternMatchSum: 0,
      count: 0,
    };
    liveArticulationRef.current = {
      consonant: 0,
      vowel: 0,
      consonantDetails: {
        closureRatePct: 0,
        closureHoldMs: 0,
        lipSymmetryPct: 0,
        openingSpeedMs: 0,
        closureHoldScore: 0,
        openingSpeedScore: 0,
        finalScore: 0,
      },
      vowelDetails: {
        mouthOpeningPct: 0,
        mouthWidthPct: 0,
        roundingPct: 0,
        patternMatchPct: 0,
        finalScore: 0,
      },
    };
    updateSidebar({
      consonantAccuracy: 0,
      vowelAccuracy: 0,
      consonantClosureRate: 0,
      consonantClosureHoldScore: 0,
      consonantLipSymmetry: 0,
      consonantOpeningSpeedScore: 0,
      consonantClosureHoldMs: 0,
      consonantOpeningSpeedMs: 0,
      vowelMouthOpening: 0,
      vowelMouthWidth: 0,
      vowelRounding: 0,
      vowelPatternMatch: 0,
    });
  }, [currentIndex, currentItem?.text, updateSidebar]);

  useEffect(() => {
    if (!currentItem?.text) return;

    const lipSymmetry = estimateLipSymmetryFromLandmarks(
      sidebarMetrics.landmarks,
    );
    const {
      consonantAccuracy,
      vowelAccuracy,
      consonantDetails,
      vowelDetails,
      nextState,
    } = analyzeArticulation({
      targetText: currentItem.text,
      mouthOpening: sidebarMetrics.mouthOpening || 0,
      mouthWidth: sidebarMetrics.mouthWidth || 0,
      lipSymmetry,
      timestampMs:
        typeof window !== "undefined" ? window.performance.now() : Date.now(),
      previousState: articulationStateRef.current,
    });

    articulationStateRef.current = nextState;
    liveArticulationRef.current = {
      consonant: consonantAccuracy,
      vowel: vowelAccuracy,
      consonantDetails,
      vowelDetails,
    };

    updateSidebar({
      consonantAccuracy: consonantAccuracy / 100,
      vowelAccuracy: vowelAccuracy / 100,
      consonantClosureRate: consonantDetails.closureRatePct / 100,
      consonantClosureHoldScore: consonantDetails.closureHoldScore / 100,
      consonantLipSymmetry: consonantDetails.lipSymmetryPct / 100,
      consonantOpeningSpeedScore: consonantDetails.openingSpeedScore / 100,
      consonantClosureHoldMs: consonantDetails.closureHoldMs,
      consonantOpeningSpeedMs: consonantDetails.openingSpeedMs,
      vowelMouthOpening:
        (vowelDetails.mouthOpeningScore ?? vowelDetails.mouthOpeningPct) / 100,
      vowelMouthWidth:
        (vowelDetails.mouthWidthScore ?? vowelDetails.mouthWidthPct) / 100,
      vowelRounding: vowelDetails.roundingPct / 100,
      vowelPatternMatch: vowelDetails.patternMatchPct / 100,
    });

    if (phase === "reading") {
      articulationAggregateRef.current.consonantSum += consonantAccuracy;
      articulationAggregateRef.current.vowelSum += vowelAccuracy;
      articulationAggregateRef.current.closureRateSum +=
        consonantDetails.closureRatePct;
      articulationAggregateRef.current.closureHoldMsSum +=
        consonantDetails.closureHoldMs;
      articulationAggregateRef.current.lipSymmetrySum +=
        consonantDetails.lipSymmetryPct;
      articulationAggregateRef.current.openingSpeedMsSum +=
        consonantDetails.openingSpeedMs;
      articulationAggregateRef.current.mouthOpeningSum +=
        vowelDetails.mouthOpeningPct;
      articulationAggregateRef.current.mouthWidthSum +=
        vowelDetails.mouthWidthPct;
      articulationAggregateRef.current.roundingSum += vowelDetails.roundingPct;
      articulationAggregateRef.current.patternMatchSum +=
        vowelDetails.patternMatchPct;
      articulationAggregateRef.current.count += 1;
    }
  }, [
    currentItem?.text,
    phase,
    sidebarMetrics.mouthOpening,
    sidebarMetrics.mouthWidth,
    updateSidebar,
  ]);

  useEffect(() => {
    setIsMounted(true);
    try {
      if (!isResumeMetaMatched(STEP5_STORAGE_KEY, stepSignature)) {
        throw new Error("step5-signature-mismatch");
      }
      const raw = localStorage.getItem(STEP5_STORAGE_KEY) || "[]";
      const parsed = JSON.parse(raw);
      const saved = Array.isArray(parsed) ? parsed : [];
      if (saved.length > 0) {
        const byIndex = new Map<number, ReadingMetrics>();
        saved
          .slice(-texts.length)
          .forEach((row: any, fallbackIndex: number) => {
            const resolvedIndex = Number.isFinite(Number(row?.index))
              ? Number(row.index)
              : fallbackIndex;
            if (resolvedIndex < 0 || resolvedIndex >= texts.length) return;
            byIndex.set(resolvedIndex, row as ReadingMetrics);
          });
        const restored = Array.from(byIndex.entries())
          .sort((a, b) => a[0] - b[0])
          .map((entry) => entry[1]);
        const safeCount = Math.min(restored.length, texts.length);
        if (safeCount < texts.length) {
          setResults(restored.slice(0, safeCount));
          setCurrentIndex(
            Math.min(Math.max(0, safeCount), Math.max(0, texts.length - 1)),
          );
        }
      }
    } catch {
      // ignore restore failure and start from first item
    }
    analyzerRef.current = new SpeechAnalyzer();
    resetRuntimeStatus();

    async function setupCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          videoStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(console.error);
            };
          }
        }
      } catch (err) {
        console.error("Step 5 Camera Error:", err);
      }
    }
    setupCamera();

    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      analyzerRef.current?.cancelAnalysis();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      resetRuntimeStatus();
    };
  }, [resetRuntimeStatus, texts.length, stepSignature]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    const videoStream = videoStreamRef.current;
    if (!videoEl || !videoStream) return;

    if (videoEl.srcObject !== videoStream) {
      videoEl.srcObject = videoStream;
    }
    videoEl.onloadedmetadata = () => {
      videoEl.play().catch(console.error);
    };
    if (videoEl.readyState >= 1) {
      videoEl.play().catch(console.error);
    }
  }, [currentIndex, phase, currentResult]);

  const getPhaseMessage = () => {
    switch (phase) {
      case "ready":
        return "준비가 되시면 마이크 버튼을 눌러주세요.";
      case "reading":
        return "강조되는 단어를 천천히 따라 읽어보세요.";
      case "review":
        return "읽은 목소리를 확인하고 다음으로 넘어가세요.";
      default:
        return "";
    }
  };

  const playStartBeep = useCallback(async () => {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1200;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 250);
    } catch {
      /* ignore beep errors */
    }
  }, []);

  const startReading = async () => {
    articulationAggregateRef.current = {
      consonantSum: 0,
      vowelSum: 0,
      closureRateSum: 0,
      closureHoldMsSum: 0,
      lipSymmetrySum: 0,
      openingSpeedMsSum: 0,
      mouthOpeningSum: 0,
      mouthWidthSum: 0,
      roundingSum: 0,
      patternMatchSum: 0,
      count: 0,
    };
    try {
      setReadingTime(0);
      readingSecondsRef.current = 0;
      setHighlightIndex(0);
      await playStartBeep();
      if (!analyzerRef.current) analyzerRef.current = new SpeechAnalyzer();
      await analyzerRef.current.startAnalysis();
      setPhase("reading");
      updateRuntimeStatus({
        recording: true,
        saving: false,
        pageError: false,
        needsRetry: false,
        message: "녹음 진행 중",
      });

      timerRef.current = setInterval(() => {
        readingSecondsRef.current += 1;
        setReadingTime(readingSecondsRef.current);
      }, 1000);

      highlightTimerRef.current = setInterval(() => {
        setHighlightIndex((p) =>
          p < words.length - 1
            ? p + 1
            : (clearInterval(highlightTimerRef.current!), p),
        );
      }, 900);
    } catch (err) {
      console.error(err);
      setPhase("ready");
      setHighlightIndex(-1);
      updateRuntimeStatus({
        recording: false,
        pageError: true,
        needsRetry: true,
        message: "녹음 시작 실패: 마이크 권한을 확인해 주세요.",
      });
    }
  };

  const stopReading = async () => {
    if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    updateRuntimeStatus({
      recording: false,
      message: "음성 분석 중",
    });
    try {
      if (!analyzerRef.current) analyzerRef.current = new SpeechAnalyzer();
      const analysis = await analyzerRef.current.stopAnalysis(currentItem.text);
      if (analysis.errorReason) {
        const runtimeMessage = analysis.errorReason.includes(
          "recorder_stop_failed",
        )
          ? "녹음 장치 초기화에 실패했습니다. 마이크 권한/연결 상태를 확인 후 다시 시도해 주세요."
          : `음성 인식 실패(${analysis.errorReason})`;
        updateRuntimeStatus({
          pageError: true,
          needsRetry: true,
          message: runtimeMessage,
        });
        setPhase("ready");
        setHighlightIndex(-1);
        return;
      }
      const audioBlob = analysis.audioBlob;
      const finalReadingTime = Math.max(1, readingSecondsRef.current);
      const wpm = Math.round((currentItem.wordCount / finalReadingTime) * 60);
      const aggregate = articulationAggregateRef.current;
      const visualConsonantAccuracy =
        aggregate.count > 0
          ? aggregate.consonantSum / aggregate.count
          : liveArticulationRef.current.consonant;
      const visualVowelAccuracy =
        aggregate.count > 0
          ? aggregate.vowelSum / aggregate.count
          : liveArticulationRef.current.vowel;
      const consonantDetail =
        aggregate.count > 0
          ? {
              closureRatePct: aggregate.closureRateSum / aggregate.count,
              closureHoldMs: aggregate.closureHoldMsSum / aggregate.count,
              lipSymmetryPct: aggregate.lipSymmetrySum / aggregate.count,
              openingSpeedMs: aggregate.openingSpeedMsSum / aggregate.count,
            }
          : {
              closureRatePct:
                liveArticulationRef.current.consonantDetails.closureRatePct,
              closureHoldMs:
                liveArticulationRef.current.consonantDetails.closureHoldMs,
              lipSymmetryPct:
                liveArticulationRef.current.consonantDetails.lipSymmetryPct,
              openingSpeedMs:
                liveArticulationRef.current.consonantDetails.openingSpeedMs,
            };
      const vowelDetail =
        aggregate.count > 0
          ? {
              mouthOpeningPct: aggregate.mouthOpeningSum / aggregate.count,
              mouthWidthPct: aggregate.mouthWidthSum / aggregate.count,
              roundingPct: aggregate.roundingSum / aggregate.count,
              patternMatchPct: aggregate.patternMatchSum / aggregate.count,
            }
          : {
              mouthOpeningPct:
                liveArticulationRef.current.vowelDetails.mouthOpeningPct,
              mouthWidthPct:
                liveArticulationRef.current.vowelDetails.mouthWidthPct,
              roundingPct: liveArticulationRef.current.vowelDetails.roundingPct,
              patternMatchPct:
                liveArticulationRef.current.vowelDetails.patternMatchPct,
            };
      const consonantAccuracy = blendArticulationAccuracy(
        visualConsonantAccuracy,
        analysis.details?.consonantAccuracy,
      );
      const vowelAccuracy = blendArticulationAccuracy(
        visualVowelAccuracy,
        analysis.details?.vowelAccuracy,
      );
      const articulationWritingConsistency =
        calculateArticulationWritingConsistency({
          targetText: currentItem.text,
          consonantAccuracy,
          vowelAccuracy,
        }).score;
      const transcript = String(analysis.transcript || "").trim();
      const spokenChars = (transcript.match(/[가-힣a-zA-Z0-9]/g) || []).length;
      if (spokenChars < 2) {
        updateRuntimeStatus({
          pageError: true,
          needsRetry: true,
          message: "음성이 충분히 인식되지 않았습니다. 다시 읽어주세요.",
        });
        setCurrentResult(null);
        setPhase("ready");
        setHighlightIndex(-1);
        return;
      }
      const readingAccuracyScore = calculateTextSimilarityPercent(
        currentItem.text,
        transcript,
      );
      const completenessScore = calculateReadingCompletenessScore(
        currentItem.text,
        transcript,
      );
      const speedStabilityScore = calculateSpeedStabilityScore(wpm);
      const gatedFluencyScore = Number(
        (
          speedStabilityScore *
          Math.min(1, completenessScore / 90) *
          Math.min(1, readingAccuracyScore / 85)
        ).toFixed(1),
      );
      const articulationClarityScore = Number(
        ((consonantAccuracy + vowelAccuracy) / 2).toFixed(1),
      );
      const readingScore = Number(
        (
          readingAccuracyScore * 0.45 +
          completenessScore * 0.25 +
          articulationClarityScore * 0.2 +
          gatedFluencyScore * 0.1
        ).toFixed(1),
      );
      const recognitionResponseMs = Math.max(
        0,
        Math.round(finalReadingTime * 1000),
      );

      updateSidebar({
        consonantAccuracy: consonantAccuracy / 100,
        vowelAccuracy: vowelAccuracy / 100,
      });

      const res: ReadingMetrics = {
        index: currentIndex,
        place,
        text: currentItem.text,
        transcript,
        isCorrect: readingScore >= 70,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : "",
        totalTime: finalReadingTime,
        responseTime: recognitionResponseMs,
        recognitionResponseMs,
        wordsPerMinute: wpm,
        pauseCount: 0,
        readingScore,
        readingAccuracyScore: Number(readingAccuracyScore.toFixed(1)),
        fluencyScore: gatedFluencyScore,
        articulationClarityScore,
        consonantAccuracy: Number(consonantAccuracy.toFixed(1)),
        vowelAccuracy: Number(vowelAccuracy.toFixed(1)),
        articulationWritingConsistency: Number(
          articulationWritingConsistency.toFixed(1),
        ),
        consonantDetail: {
          closureRatePct: Number(consonantDetail.closureRatePct.toFixed(1)),
          closureHoldMs: Number(consonantDetail.closureHoldMs.toFixed(1)),
          lipSymmetryPct: Number(consonantDetail.lipSymmetryPct.toFixed(1)),
          openingSpeedMs: Number(consonantDetail.openingSpeedMs.toFixed(1)),
        },
        vowelDetail: {
          mouthOpeningPct: Number(vowelDetail.mouthOpeningPct.toFixed(1)),
          mouthWidthPct: Number(vowelDetail.mouthWidthPct.toFixed(1)),
          roundingPct: Number(vowelDetail.roundingPct.toFixed(1)),
          patternMatchPct: Number(vowelDetail.patternMatchPct.toFixed(1)),
        },
        dataSource: "measured",
      };

      articulationAggregateRef.current = {
        consonantSum: 0,
        vowelSum: 0,
        closureRateSum: 0,
        closureHoldMsSum: 0,
        lipSymmetrySum: 0,
        openingSpeedMsSum: 0,
        mouthOpeningSum: 0,
        mouthWidthSum: 0,
        roundingSum: 0,
        patternMatchSum: 0,
        count: 0,
      };

      let saveSucceeded = true;
      if (audioBlob) {
        updateRuntimeStatus({
          saving: true,
          message: "결과 저장 중",
        });
        saveSucceeded = await new Promise<boolean>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const existing = JSON.parse(
                localStorage.getItem(STEP5_STORAGE_KEY) || "[]",
              );
              const nextEntry = {
                ...res,
                index: currentIndex,
                audioUrl: reader.result as string,
                timestamp: new Date().toLocaleTimeString(),
              };
              const byIndex = new Map<number, any>();
              if (Array.isArray(existing)) {
                existing
                  .slice(-texts.length)
                  .forEach((row: any, fallbackIndex: number) => {
                    const resolvedIndex = Number.isFinite(Number(row?.index))
                      ? Number(row.index)
                      : fallbackIndex;
                    if (resolvedIndex < 0 || resolvedIndex >= texts.length)
                      return;
                    byIndex.set(resolvedIndex, row);
                  });
              }
              byIndex.set(currentIndex, nextEntry);
              const next = Array.from(byIndex.entries())
                .sort((a, b) => a[0] - b[0])
                .map((entry) => entry[1])
                .slice(0, texts.length);
              localStorage.setItem(STEP5_STORAGE_KEY, JSON.stringify(next));
              saveResumeMeta(STEP5_STORAGE_KEY, stepSignature, next.length);
              const patient = loadPatientProfile();
              if (patient) {
                uploadClinicalMedia({
                  patient,
                  sourceSessionKey: patient.sessionId,
                  trainingType: clinicalTrainingType,
                  stepNo: 5,
                  mediaType: "audio",
                  captureRole: "step5-audio",
                  labelSegment: currentItem.text,
                  blob: audioBlob,
                  fileExtension: audioBlob.type.includes("mpeg") ? "mp3" : "webm",
                  durationMs: recognitionResponseMs,
                }).catch((uploadError) => {
                  console.error("[Step5] failed to upload clinical audio", uploadError);
                });
              }
              updateRuntimeStatus({
                pageError: false,
                needsRetry: false,
                message: "저장 완료",
              });
              resolve(true);
            } catch (saveError) {
              console.error(saveError);
              updateRuntimeStatus({
                pageError: true,
                needsRetry: true,
                message:
                  "저장 실패(용량/저장소 이슈 가능): 브라우저 저장소를 확인하고 해당 문항을 다시 녹음해 주세요.",
              });
              resolve(false);
            } finally {
              updateRuntimeStatus({
                saving: false,
              });
            }
          };
          reader.onerror = () => {
            updateRuntimeStatus({
              saving: false,
              pageError: true,
              needsRetry: true,
              message:
                "오디오 파일 처리 오류가 발생했습니다. 해당 문항을 다시 녹음해 주세요.",
            });
            resolve(false);
          };
          reader.readAsDataURL(audioBlob);
        });
      } else {
        updateRuntimeStatus({
          pageError: true,
          needsRetry: true,
          message:
            "오디오 데이터가 생성되지 않았습니다. 해당 문항을 다시 녹음해 주세요.",
        });
        saveSucceeded = false;
      }

      if (!saveSucceeded) {
        setCurrentResult(null);
        setPhase("ready");
        setHighlightIndex(-1);
        return;
      }
      setCurrentResult(res);
      setPhase("review");
    } catch (error) {
      console.error(error);
      updateRuntimeStatus({
        recording: false,
        saving: false,
        pageError: true,
        needsRetry: true,
        message: "분석 중 오류가 발생했습니다. 해당 문항을 다시 녹음해 주세요.",
      });
      setCurrentResult(null);
      setPhase("ready");
      setHighlightIndex(-1);
    }
  };

  const playRecordedAudio = () => {
    if (!currentResult?.audioUrl) return;
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }
    const audio = new Audio(currentResult.audioUrl);
    audioPlayerRef.current = audio;
    setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.play().catch(() => setIsPlayingAudio(false));
  };

  const handleNext = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }
    if (!currentResult) return;
    const byIndex = new Map<number, ReadingMetrics>();
    results.forEach((row, fallbackIndex) => {
      const resolvedIndex = Number.isFinite(Number(row?.index))
        ? Number(row.index)
        : fallbackIndex;
      if (resolvedIndex < 0 || resolvedIndex >= texts.length) return;
      byIndex.set(resolvedIndex, row);
    });
    const currentResultIndex = Number.isFinite(Number(currentResult?.index))
      ? Number(currentResult.index)
      : currentIndex;
    byIndex.set(currentResultIndex, {
      ...currentResult,
      index: currentResultIndex,
    });
    const updatedResults = Array.from(byIndex.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1]);
    setResults(updatedResults);

    if (currentIndex < texts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setPhase("ready");
      setCurrentResult(null);
      setHighlightIndex(-1);
    } else {
      try {
        const patient = loadPatientProfile();
        const sm = new SessionManager(
          (patient || { age: 70, educationYears: 12 }) as any,
          place,
        );
        const averageConsonantAccuracy =
          updatedResults.reduce((s, r) => s + (r.consonantAccuracy || 0), 0) /
          Math.max(1, updatedResults.length);
        const averageVowelAccuracy =
          updatedResults.reduce((s, r) => s + (r.vowelAccuracy || 0), 0) /
          Math.max(1, updatedResults.length);
        const averageArticulationWritingConsistency =
          updatedResults.reduce(
            (sum, row) => sum + Number(row.articulationWritingConsistency || 0),
            0,
          ) / Math.max(1, updatedResults.length);
        const correctAnswers = updatedResults.filter(
          (row) => row.isCorrect,
        ).length;
        sm.saveStep5Result({
          correctAnswers,
          totalQuestions: texts.length,
          timestamp: Date.now(),
          averageConsonantAccuracy,
          averageVowelAccuracy,
          averageArticulationWritingConsistency,
          items: updatedResults as any,
          versionSnapshot: buildVersionSnapshot("step5"),
        });
      } catch (error) {
        console.error(error);
      }
      const avg = Math.round(
        updatedResults.reduce((s, r) => s + r.readingScore, 0) /
          updatedResults.length,
      );
      pushStep6OrRehabResult(avg);
    }
  };

  const handleSkipStep = useCallback(() => {
    try {
      const randomFloat = (min: number, max: number, digits = 1) =>
        Number((Math.random() * (max - min) + min).toFixed(digits));
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      analyzerRef.current?.cancelAnalysis();
      resetRuntimeStatus();

      const demoResults: ReadingMetrics[] = texts.map((item, index) => {
        const totalTime = randomFloat(7, 16, 0);
        const wordsPerMinute = randomFloat(45, 130, 0);
        const readingAccuracyScore = randomFloat(62, 98, 1);
        const completenessScore = randomFloat(70, 100, 1);
        const articulationClarityScore = randomFloat(58, 96, 1);
        const speedStabilityScore =
          calculateSpeedStabilityScore(wordsPerMinute);
        const fluencyScore = Number(
          (
            speedStabilityScore *
            Math.min(1, completenessScore / 90) *
            Math.min(1, readingAccuracyScore / 85)
          ).toFixed(1),
        );
        const readingScore = Number(
          (
            readingAccuracyScore * 0.45 +
            completenessScore * 0.25 +
            articulationClarityScore * 0.2 +
            fluencyScore * 0.1
          ).toFixed(1),
        );

        return {
          index,
          place,
          text: item.text,
          transcript: item.text,
          isCorrect: readingScore >= 70,
          audioUrl: "",
          totalTime,
          responseTime: Math.round(totalTime * 1000),
          recognitionResponseMs: Math.round(totalTime * 1000),
          wordsPerMinute,
          pauseCount: randomFloat(0, 4, 0),
          readingScore,
          readingAccuracyScore,
          fluencyScore,
          articulationClarityScore,
          consonantAccuracy: randomFloat(58, 96),
          vowelAccuracy: randomFloat(58, 96),
          articulationWritingConsistency: randomFloat(60, 95),
          dataSource: "demo",
        };
      });

      const recordedPayload = demoResults.map((res) => ({
        ...res,
        timestamp: new Date().toLocaleTimeString(),
      }));
      localStorage.setItem(STEP5_STORAGE_KEY, JSON.stringify(recordedPayload));
      saveResumeMeta(STEP5_STORAGE_KEY, stepSignature, recordedPayload.length);

      const patient = loadPatientProfile();
      const sm = new SessionManager(
        (patient || { age: 70, educationYears: 12 }) as any,
        place,
      );
      sm.saveStep5Result({
        correctAnswers: demoResults.filter((row) => row.isCorrect).length,
        totalQuestions: texts.length,
        timestamp: Date.now(),
        averageConsonantAccuracy:
          demoResults.reduce((sum, row) => sum + row.consonantAccuracy, 0) /
          Math.max(1, demoResults.length),
        averageVowelAccuracy:
          demoResults.reduce((sum, row) => sum + row.vowelAccuracy, 0) /
          Math.max(1, demoResults.length),
        averageArticulationWritingConsistency:
          demoResults.reduce(
            (sum, row) => sum + Number(row.articulationWritingConsistency || 0),
            0,
          ) / Math.max(1, demoResults.length),
        items: demoResults as any,
        versionSnapshot: buildVersionSnapshot("step5"),
      });

      const avg = Math.round(
        demoResults.reduce((sum, row) => sum + row.readingScore, 0) /
          Math.max(1, demoResults.length),
      );
      pushStep6OrRehabResult(avg);
    } catch (error) {
      console.error("Step5 skip failed:", error);
      pushStep6OrRehabResult(80);
    }
  }, [pushStep6OrRehabResult, resetRuntimeStatus, texts, stepSignature]);

  if (!isMounted || !currentItem) return null;

  return (
    <div
      className={`flex flex-col min-h-screen bg-slate-50 overflow-y-auto lg:overflow-hidden text-slate-900 font-sans ${isRehabMode ? "rehab-accent-scope" : ""}`}
    >
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className={`h-full ${isRehabMode ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.45)]"}`}
          style={{ width: `${((currentIndex + 1) / texts.length) * 100}%` }}
        />
      </div>
      <header
        className={`min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50 ${isRehabMode ? "border-sky-100" : "border-orange-100"}`}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <span
              className={`font-black text-[10px] uppercase tracking-widest leading-none block ${isRehabMode ? "text-sky-500" : "text-orange-500"}`}
            >
              Step 05 • Reading Fluency Training
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              텍스트 읽기 학습
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={handleSkipStep}
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
          >
            SKIP
          </button>
          <div
            className={`px-4 py-1.5 rounded-full font-black text-xs border ${isRehabMode ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
          >
            {currentIndex + 1} / {texts.length}
          </div>
          <button
            type="button"
            onClick={handleGoHome}
            className={`w-9 h-9 ${trainingButtonStyles.homeIcon}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10.5 12 3l9 7.5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.5 9.5V21h13V9.5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 21v-5h4v5"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-0 relative p-3 sm:p-4 lg:p-10 pb-8 lg:pb-10 order-1 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto flex flex-col h-full gap-4 lg:gap-8 justify-center">
            <div className="w-full bg-white border border-orange-100 rounded-2xl px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.18em] mb-1">
                진행 가이드
              </p>
              <p
                className={`text-sm font-bold break-keep leading-relaxed ${phase === "reading" ? "text-orange-700" : "text-slate-600"}`}
              >
                {getPhaseMessage()}
              </p>
            </div>

            <div
              className={`relative bg-white border rounded-[24px] sm:rounded-[28px] p-5 sm:p-8 lg:p-12 shadow-sm transition-all duration-500 ${phase === "reading" ? "border-orange-500 shadow-orange-100/70 scale-[1.01]" : "border-orange-100"}`}
            >
              {phase === "reading" && (
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-[11px] font-black font-mono">
                  REC {readingTime}s
                </div>
              )}
              <div
                className={`${readingTextSizeClass} font-black text-slate-800 leading-snug text-center ${hasWhitespace ? "break-keep" : "break-all"} max-h-[2.8em] md:max-h-[2.8em] overflow-hidden`}
              >
                {(() => {
                  let wordCursor = -1;
                  return textLines.map((line, lineIndex) => (
                    <div
                      key={`line-${lineIndex}`}
                      className="flex flex-wrap justify-center gap-y-1 leading-snug"
                    >
                      {line
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((word, wordIndex) => {
                          wordCursor += 1;
                          return (
                            <React.Fragment key={`w-${lineIndex}-${wordIndex}`}>
                              <span
                                className={`transition-all duration-300 rounded-lg px-1 inline-block whitespace-normal ${hasWhitespace ? "break-keep" : "break-all"} ${wordCursor <= highlightIndex ? "text-orange-700 bg-orange-100" : phase === "ready" ? "text-slate-700" : "text-slate-500"}`}
                              >
                                {word}
                              </span>
                              <span className="w-1" />
                            </React.Fragment>
                          );
                        })}
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="flex flex-col items-center gap-6">
              {phase === "ready" && (
                <button
                  onClick={startReading}
                  className="group w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-[#0B1A3A] shadow-2xl flex items-center justify-center hover:scale-105 transition-all border-4 border-white"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-6 h-6 lg:w-7 lg:h-7 text-[#0B1A3A] group-hover:text-orange-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <rect x="9" y="3.5" width="6" height="11" rx="3" />
                      <path
                        strokeLinecap="round"
                        d="M6.5 11.5a5.5 5.5 0 0 0 11 0"
                      />
                      <path strokeLinecap="round" d="M12 17v3.5" />
                      <path strokeLinecap="round" d="M9 20.5h6" />
                    </svg>
                  </div>
                </button>
              )}
              {phase === "reading" && (
                <div className="relative">
                  <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-35" />
                  <button
                    onClick={stopReading}
                    className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-[#0B1A3A] shadow-2xl flex items-center justify-center"
                  >
                    <div className="w-7 h-7 lg:w-9 lg:h-9 bg-white rounded-2xl flex items-center justify-center">
                      <div className="w-3.5 h-3.5 lg:w-4.5 lg:h-4.5 bg-slate-900 rounded-sm" />
                    </div>
                  </button>
                </div>
              )}
              {phase === "review" && currentResult && (
                <div className="w-full max-w-xl animate-in zoom-in">
                  <div className="w-full bg-white rounded-[28px] p-6 shadow-xl border border-orange-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-500" />
                    <div className="flex items-center gap-6 relative z-[1]">
                      <div className="border-r border-orange-100 pr-6 text-center shrink-0">
                        <span className="text-[9px] font-black text-orange-300 uppercase block mb-1">
                          읽기
                        </span>
                        <span className="text-3xl lg:text-4xl font-black text-orange-500 tracking-tight">
                          {currentResult.readingScore.toFixed(1)}점
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                          지표
                        </p>
                        <p className="text-sm lg:text-base font-bold text-slate-700">
                          읽기 시간 {currentResult.totalTime}s / 속도{" "}
                          {currentResult.wordsPerMinute} WPM
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 relative z-[1]">
                      <button
                        onClick={playRecordedAudio}
                        className={`w-full py-4 rounded-2xl font-black text-sm ${isPlayingAudio ? accentSolid : accentOutline}`}
                      >
                        {isPlayingAudio
                          ? "목소리 재생 중..."
                          : "내 목소리 듣기"}
                      </button>
                      <button
                        onClick={handleNext}
                        className={`w-full py-4 rounded-2xl font-black text-base ${trainingButtonStyles.navyPrimary}`}
                      >
                        다음 문항으로
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
        <aside className="w-full lg:w-[380px] h-auto lg:h-full border-t lg:border-t-0 lg:border-l border-slate-50 bg-white shrink-0 flex flex-col p-3 sm:p-4 lg:p-4 overflow-visible lg:overflow-hidden order-2">
          <AnalysisSidebar
            videoRef={videoRef}
            canvasRef={canvasRef}
            isFaceReady={sidebarMetrics.faceDetected}
            metrics={{
              symmetryScore: (sidebarMetrics.facialSymmetry || 0) * 100,
              openingRatio: (sidebarMetrics.mouthOpening || 0) * 100,
              consonantAcc: (sidebarMetrics.consonantAccuracy || 0) * 100,
              vowelAcc: (sidebarMetrics.vowelAccuracy || 0) * 100,
              consonantClosureRate:
                (sidebarMetrics.consonantClosureRate || 0) * 100,
              consonantClosureHold:
                (sidebarMetrics.consonantClosureHoldScore || 0) * 100,
              consonantLipSymmetry:
                (sidebarMetrics.consonantLipSymmetry || 0) * 100,
              consonantOpeningSpeed:
                (sidebarMetrics.consonantOpeningSpeedScore || 0) * 100,
              consonantClosureHoldMs:
                sidebarMetrics.consonantClosureHoldMs || 0,
              consonantOpeningSpeedMs:
                sidebarMetrics.consonantOpeningSpeedMs || 0,
              vowelMouthOpening: (sidebarMetrics.vowelMouthOpening || 0) * 100,
              vowelMouthWidth: (sidebarMetrics.vowelMouthWidth || 0) * 100,
              vowelRounding: (sidebarMetrics.vowelRounding || 0) * 100,
              vowelPatternMatch: (sidebarMetrics.vowelPatternMatch || 0) * 100,
              audioLevel: phase === "reading" ? 40 : 0,
            }}
            showTracking={showTracking}
            onToggleTracking={() => setShowTracking((prev) => !prev)}
            scoreLabel="현재 상태"
            scoreValue={
              currentResult ? `${currentResult.readingScore.toFixed(1)}점` : "-"
            }
            hidePreview={!isDesktopViewport}
            hideMetrics={!isDesktopViewport}
          />
        </aside>
      </div>
      <HomeExitModal
        open={isHomeExitModalOpen}
        onConfirm={confirmGoHome}
        onCancel={() => setIsHomeExitModalOpen(false)}
      />
    </div>
  );
}

export default function Step5Page() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center font-black text-slate-200 uppercase tracking-tighter">
          준비 중입니다...
        </div>
      }
    >
      <Step5Content />
    </Suspense>
  );
}
