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
import { FLUENCY_SCENARIOS } from "@/constants/fluencyData";
import { SpeechAnalyzer } from "@/lib/speech/SpeechAnalyzer";
import { AnalysisSidebar } from "@/components/training/AnalysisSidebar";
import { RuntimeStatusBanner } from "@/components/training/RuntimeStatusBanner";
import { useTraining } from "../../TrainingContext";
import { HomeExitModal } from "@/components/training/HomeExitModal";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { saveTrainingExitProgress } from "@/lib/trainingExitProgress";
import {
  analyzeArticulation,
  calculateArticulationWritingConsistency,
  createInitialArticulationAnalyzerState,
} from "@/lib/analysis/articulationAnalyzer";
import { estimateLipSymmetryFromLandmarks } from "@/lib/analysis/lipMetrics";
import { buildVersionSnapshot } from "@/lib/analysis/versioning";
import {
  addSentenceLineBreaks,
  getResponsiveSentenceSizeClass,
} from "@/lib/text/displayText";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { logTrainingEvent } from "@/lib/client/trainingEventsApi";
import {
  cancelSpeechPlayback,
  speakKoreanText,
} from "@/lib/client/speechSynthesis";
import {
  maskPlaceLabels,
  scoreStep4Response,
  STEP4_IMAGE_BASE_URL,
  STEP4_IMAGE_RAW_BASE_URL,
  toDataUrl,
} from "@/features/steps/step4/utils";
import {
  buildStepSignature,
  isResumeMetaMatched,
  saveResumeMeta,
} from "@/lib/trainingResume";

export const dynamic = "force-dynamic";

type Phase = "ready" | "recording" | "analyzing" | "review";

type Step4EvalResult = {
  index?: number;
  situation: string;
  prompt: string;
  transcript: string;
  isCorrect?: boolean;
  matchedKeywords: string[];
  relevantSentenceCount: number;
  totalSentenceCount: number;
  relevanceScore: number;
  contentComponentScore: number;
  fluencyComponentScore: number;
  clarityComponentScore: number;
  responseStartComponentScore: number;
  responseStartMs: number | null;
  finalScore: number;
  speechDuration: number;
  silenceRatio: number;
  averageAmplitude: number;
  peakCount: number;
  kwabScore: number;
  rawScore: number;
  audioUrl: string;
  consonantAccuracy?: number;
  vowelAccuracy?: number;
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
};
const STEP4_STORAGE_KEY = "step4_recorded_audios";

function Step4Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    sidebarMetrics,
    updateSidebar,
    updateRuntimeStatus,
    resetRuntimeStatus,
  } = useTraining();
  const { patient: sessionPatient, sessionId } = useTrainingSession();
  const place = (searchParams.get("place") as PlaceType) || "home";
  const step3Score = searchParams.get("step3") || "0";
  const isRehabMode =
    searchParams.get("trainMode") === "rehab" ||
    (typeof window !== "undefined" &&
      sessionStorage.getItem("btt.trainingMode") === "rehab");
  const accentOutline = isRehabMode
    ? "bg-white text-sky-600 border border-sky-200 hover:bg-sky-50 transition-all"
    : trainingButtonStyles.orangeOutline;
  const accentSoft = isRehabMode
    ? "bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all"
    : trainingButtonStyles.orangeSoft;
  const clinicalTrainingType = isRehabMode ? "speech-rehab" : "self-assessment";
  const patientProfile = useMemo(
    () =>
      sessionPatient ??
      ({
        sessionId,
        name: "user",
        birthDate: "",
        gender: "U",
        age: 70,
        educationYears: 12,
        hand: "U",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as const),
    [sessionId, sessionPatient],
  );
  const isAdmin = sessionPatient?.userRole === "admin";

  useEffect(() => {
    void logTrainingEvent({
      eventType: "training_step_viewed",
      trainingType: clinicalTrainingType,
      stepNo: 4,
      pagePath: "/programs/step-4",
      sessionId,
      payload: {
        place,
        isRehabMode,
        rehabTargetStep: Number(searchParams.get("targetStep") || "0") || null,
      },
    });
  }, [clinicalTrainingType, isRehabMode, place, searchParams, sessionId]);

  const accentSolid = isRehabMode
    ? "bg-sky-500 text-white border border-sky-500 hover:bg-sky-600 transition-all"
    : trainingButtonStyles.orangeSolid;
  const rehabTargetStep = Number(searchParams.get("targetStep") || "0");
  const pushStep5OrRehabResult = useCallback(
    (step4Value: number) => {
      if (isRehabMode && rehabTargetStep === 4) {
        const rehabStep4Percent =
          step4Value <= 10
            ? Math.round(step4Value * 10)
            : Math.round(step4Value);
        const params = new URLSearchParams({
          place,
          trainMode: "rehab",
          targetStep: "4",
          step1: searchParams.get("step1") || "0",
          step2: searchParams.get("step2") || "0",
          step3: step3Score || "0",
          step4: String(rehabStep4Percent),
          step5: "0",
          step6: "0",
        });
        router.push(`/result-page/speech-rehab?${params.toString()}`);
        return;
      }
      router.push(
        `/programs/step-5?place=${place}&step3=${step3Score}&step4=${step4Value}`,
      );
    },
    [isRehabMode, place, rehabTargetStep, router, searchParams, step3Score],
  );
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
    saveTrainingExitProgress(place, 4);
    router.push("/select-page/self-assessment");
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyzerRef = useRef<SpeechAnalyzer | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const promptEndedAtRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const imageCacheRef = useRef<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPromptPlaying, setIsPromptPlaying] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState("");
  const [isSttExpanded, setIsSttExpanded] = useState(false);
  const [resolvedImageSrc, setResolvedImageSrc] = useState("");
  const [isImageResolving, setIsImageResolving] = useState(false);
  const [showHint, setShowHint] = useState(false);
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

  const [currentResult, setCurrentResult] = useState<Step4EvalResult | null>(
    null,
  );
  const [allResults, setAllResults] = useState<Step4EvalResult[]>([]);

  const scenarios = useMemo(
    () => FLUENCY_SCENARIOS[place] || FLUENCY_SCENARIOS.home,
    [place],
  );
  const stepSignature = useMemo(
    () =>
      buildStepSignature(
        "step4",
        place,
        scenarios.map(
          (item) =>
            `${item.id ?? ""}|${item.situation ?? ""}|${item.prompt ?? ""}`,
        ),
      ),
    [place, scenarios],
  );
  const currentScenario = scenarios[currentIndex];

  // UX 개선된 마스킹 대사
  const maskedPrompt = useMemo(
    () => maskPlaceLabels(currentScenario?.prompt || ""),
    [currentScenario],
  );
  const maskedHint = useMemo(
    () => maskPlaceLabels(currentScenario?.hint || ""),
    [currentScenario],
  );
  const formattedPrompt = useMemo(
    () => addSentenceLineBreaks(maskedPrompt),
    [maskedPrompt],
  );
  const formattedHint = useMemo(
    () => addSentenceLineBreaks(maskedHint),
    [maskedHint],
  );
  const headlineTextSizeClass = useMemo(
    () => getResponsiveSentenceSizeClass(formattedPrompt),
    [formattedPrompt],
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
  }, [currentIndex, currentScenario?.prompt, updateSidebar]);

  useEffect(() => {
    if (!currentScenario?.prompt) return;
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
      targetText: currentScenario.prompt,
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

    if (phase === "recording") {
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
    currentScenario?.prompt,
    phase,
    sidebarMetrics.landmarks,
    sidebarMetrics.mouthOpening,
    sidebarMetrics.mouthWidth,
    updateSidebar,
  ]);

  // 이미지 로드 로직
  useEffect(() => {
    if (!currentScenario) return;
    let active = true;
    const cacheKey = `${place}:${currentScenario.id}`;
    if (imageCacheRef.current[cacheKey]) {
      setResolvedImageSrc(imageCacheRef.current[cacheKey]);
      setIsImageResolving(false);
      return;
    }
    setIsImageResolving(true);
    const candidates = [
      `${STEP4_IMAGE_BASE_URL}/${place}/${currentScenario.id}.png`,
      `${STEP4_IMAGE_RAW_BASE_URL}/${place}/${currentScenario.id}.png`,
      `/images/places/${place}.png`,
    ];

    const tryLoadImage = (index: number) => {
      if (!active || index >= candidates.length) {
        if (active) {
          setResolvedImageSrc("");
          setIsImageResolving(false);
        }
        return;
      }

      const url = candidates[index];
      const img = new Image();
      img.onload = () => {
        if (!active) return;
        setResolvedImageSrc(url);
        imageCacheRef.current[cacheKey] = url;
        setIsImageResolving(false);
      };
      img.onerror = () => {
        tryLoadImage(index + 1);
      };
      img.src = url;
    };

    tryLoadImage(0);
    return () => {
      active = false;
    };
  }, [currentScenario, place]);

  useEffect(() => {
    setIsMounted(true);
    try {
      if (!isResumeMetaMatched(STEP4_STORAGE_KEY, stepSignature)) {
        throw new Error("step4-signature-mismatch");
      }
      const raw = localStorage.getItem(STEP4_STORAGE_KEY) || "[]";
      const parsed = JSON.parse(raw);
      const saved = Array.isArray(parsed) ? parsed : [];
      if (saved.length > 0) {
        const sourceRows = saved.slice(-scenarios.length);
        const byIndex = new Map<number, Step4EvalResult>();
        sourceRows.forEach((row: any, fallbackIndex: number) => {
          const resolvedIndex = Number.isFinite(Number(row?.index))
            ? Number(row.index)
            : fallbackIndex;
          if (resolvedIndex < 0 || resolvedIndex >= scenarios.length) return;
          byIndex.set(resolvedIndex, {
            index: resolvedIndex,
            situation: String(row?.situation || row?.text || ""),
            prompt: String(row?.prompt || ""),
            transcript: String(row?.transcript || ""),
            isCorrect: Boolean(row?.isCorrect),
            matchedKeywords: Array.isArray(row?.matchedKeywords)
              ? row.matchedKeywords
              : [],
            relevantSentenceCount: Number(row?.relevantSentenceCount ?? 1),
            totalSentenceCount: Number(row?.totalSentenceCount ?? 1),
            relevanceScore: Number(
              row?.relevanceScore ?? row?.contentComponentScore ?? 0,
            ),
            contentComponentScore: Number(row?.contentComponentScore ?? 0),
            fluencyComponentScore: Number(row?.fluencyComponentScore ?? 0),
            clarityComponentScore: Number(row?.clarityComponentScore ?? 0),
            responseStartComponentScore: Number(
              row?.responseStartComponentScore ?? 0,
            ),
            responseStartMs:
              row?.responseStartMs === null ||
              row?.responseStartMs === undefined
                ? null
                : Number(row.responseStartMs),
            finalScore: Number(row?.finalScore ?? 0),
            speechDuration: Number(row?.speechDuration ?? 0),
            silenceRatio: Number(row?.silenceRatio ?? 0),
            averageAmplitude: Number(row?.averageAmplitude ?? 0),
            peakCount: Number(row?.peakCount ?? 0),
            kwabScore: Number(row?.kwabScore ?? row?.fluencyScore ?? 0),
            rawScore: Number(row?.rawScore ?? 0),
            audioUrl: typeof row?.audioUrl === "string" ? row.audioUrl : "",
            consonantAccuracy:
              row?.consonantAccuracy === undefined
                ? undefined
                : Number(row.consonantAccuracy),
            vowelAccuracy:
              row?.vowelAccuracy === undefined
                ? undefined
                : Number(row.vowelAccuracy),
            articulationWritingConsistency:
              row?.articulationWritingConsistency === undefined
                ? undefined
                : Number(row.articulationWritingConsistency),
            consonantDetail: row?.consonantDetail,
            vowelDetail: row?.vowelDetail,
          });
        });
        const restored = Array.from(byIndex.entries())
          .sort((a, b) => a[0] - b[0])
          .map((entry) => entry[1]);
        const safeCount = Math.min(restored.length, scenarios.length);
        if (safeCount < scenarios.length) {
          const resumed = restored.slice(0, safeCount);
          setAllResults(resumed);
          setCurrentIndex(
            Math.min(Math.max(0, safeCount), Math.max(0, scenarios.length - 1)),
          );
        }
      }
    } catch {
      // ignore restore failure and start from first item
    }
    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
          return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
      videoRef.current?.play().catch(() => undefined);
          };
        }
      } catch (err) {
      }
    }
    setupCamera();
    resetRuntimeStatus();
    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      cancelSpeechPlayback();
      resetRuntimeStatus();
    };
  }, [resetRuntimeStatus, scenarios.length, stepSignature]);

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
      videoEl.play().catch(() => undefined);
    };
    if (videoEl.readyState >= 1) {
      videoEl.play().catch(() => undefined);
    }
  }, [currentIndex, phase, currentResult]);

  // 안내 음성 재생 (단순 버전)
  const playInstruction = useCallback(() => {
    if (!currentScenario || typeof window === "undefined") return;
    setIsPromptPlaying(true);
    setCanRecord(false);
    void speakKoreanText("이 사진 속 상황을 자유롭게 이야기해 주세요.", {
      rate: 0.96,
    }).finally(() => {
      setIsPromptPlaying(false);
      setCanRecord(true);
      promptEndedAtRef.current = Date.now();
    });
  }, [currentScenario]);

  useEffect(() => {
    if (!isMounted || !currentScenario) return;
    setPhase("ready");
    setCanRecord(false);
    setShowHint(false);
    setCurrentResult(null);
    setSaveStatusText("");
    promptEndedAtRef.current = null;
    recordingStartedAtRef.current = null;
    playInstruction();
  }, [currentIndex, isMounted, playInstruction, currentScenario]);

  const startRecording = async () => {
    if (!canRecord || phase !== "ready") return;
    try {
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
      if (!analyzerRef.current) analyzerRef.current = new SpeechAnalyzer();
      recordingStartedAtRef.current = Date.now();
      await analyzerRef.current.startAnalysis((level) => setAudioLevel(level));
      updateRuntimeStatus({
        recording: true,
        saving: false,
        pageError: false,
        needsRetry: false,
        message: "녹음 진행 중",
      });
      setPhase("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(
        () => setRecordingTime((prev) => prev + 1),
        1000,
      );
    } catch (err) {
      updateRuntimeStatus({
        recording: false,
        pageError: true,
        needsRetry: true,
        message: "녹음 시작 실패: 마이크 권한을 확인해 주세요.",
      });
    }
  };

  const stopRecording = async () => {
    if (phase !== "recording") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("analyzing");
    setShowHint(false);
    updateRuntimeStatus({
      recording: false,
      message: "음성 분석 중",
    });
    try {
      const analysis = await analyzerRef.current!.stopAnalysis(
        currentScenario.answerKeywords.join(" "),
      );
      if (analysis.errorReason) {
        updateRuntimeStatus({
          pageError: true,
          needsRetry: true,
          message: `음성 인식 실패(${analysis.errorReason})`,
        });
        setPhase("ready");
        return;
      }
      const transcript = (analysis.transcript || "").trim();

      // STT/발화 메트릭/자모음 분석치를 함께 사용한 종합 채점
      const matched = currentScenario.answerKeywords.filter((kw) =>
        transcript.includes(kw),
      );
      const responseStartMs =
        recordingStartedAtRef.current !== null &&
        promptEndedAtRef.current !== null
          ? Math.max(
              0,
              recordingStartedAtRef.current - promptEndedAtRef.current,
            )
          : null;
      const aggregate = articulationAggregateRef.current;
      const consonantAccuracy =
        aggregate.count > 0
          ? aggregate.consonantSum / aggregate.count
          : liveArticulationRef.current.consonant;
      const vowelAccuracy =
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
      const articulationWritingConsistency =
        calculateArticulationWritingConsistency({
          targetText: currentScenario.prompt || currentScenario.situation || "",
          consonantAccuracy,
          vowelAccuracy,
        }).score;
      const speechDurationSec =
        Number.isFinite(Number(analysis.duration)) &&
        Number(analysis.duration) > 0
          ? Number(analysis.duration) / 1000
          : recordingTime;
      const scored = scoreStep4Response({
        matchedKeywordCount: matched.length,
        totalKeywords: currentScenario.answerKeywords.length,
        transcript,
        speechDurationSec,
        consonantAccuracy,
        vowelAccuracy,
        responseStartMs,
      });

      const evalResult: Step4EvalResult = {
        index: currentIndex,
        situation: currentScenario.situation,
        prompt: currentScenario.prompt,
        transcript,
        isCorrect: scored.kwabScore >= 5,
        matchedKeywords: Array.from(new Set(matched)),
        relevantSentenceCount: 1,
        totalSentenceCount: 1,
        relevanceScore: scored.contentScore,
        contentComponentScore: scored.contentScore,
        fluencyComponentScore: scored.fluencyScore,
        clarityComponentScore: scored.clarityScore,
        responseStartComponentScore: scored.responseStartScore,
        responseStartMs,
        finalScore: scored.finalScore,
        speechDuration: speechDurationSec,
        silenceRatio: 0,
        averageAmplitude: audioLevel,
        peakCount: 0,
        kwabScore: scored.kwabScore,
        rawScore: analysis.pronunciationScore,
        audioUrl: analysis.audioBlob
          ? URL.createObjectURL(analysis.audioBlob)
          : "",
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
      };

      let saveSucceeded = false;
      if (analysis.audioBlob) {
        updateRuntimeStatus({
          saving: true,
          message: "결과 저장 중",
        });
        try {
          const base64Audio = await toDataUrl(analysis.audioBlob);
          const existing = JSON.parse(
            localStorage.getItem(STEP4_STORAGE_KEY) || "[]",
          );
          const nextEntry = {
            index: currentIndex,
            text: currentScenario.situation,
            prompt: currentScenario.prompt,
            transcript: transcript || "...",
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
            audioUrl: base64Audio,
            isCorrect: scored.kwabScore >= 5,
            contentComponentScore: scored.contentScore,
            fluencyComponentScore: scored.fluencyScore,
            clarityComponentScore: scored.clarityScore,
            responseStartComponentScore: scored.responseStartScore,
            responseStartMs,
            responseTime: responseStartMs,
            finalScore: scored.finalScore,
            fluencyScore: scored.kwabScore,
            kwabScore: scored.kwabScore,
            rawScore: analysis.pronunciationScore,
            speechDuration: speechDurationSec,
            silenceRatio: 0,
            timestamp: new Date().toLocaleTimeString(),
          };

          const byIndex = new Map<number, any>();
          if (Array.isArray(existing)) {
            const sourceRows = existing.slice(-scenarios.length);
            sourceRows.forEach((row: any, fallbackIndex: number) => {
              const resolvedIndex = Number.isFinite(Number(row?.index))
                ? Number(row.index)
                : fallbackIndex;
              if (resolvedIndex < 0 || resolvedIndex >= scenarios.length)
                return;
              byIndex.set(resolvedIndex, row);
            });
          }
          byIndex.set(currentIndex, nextEntry);
          const next = Array.from(byIndex.entries())
            .sort((a, b) => a[0] - b[0])
            .map((entry) => entry[1])
            .slice(0, scenarios.length);
          localStorage.setItem(STEP4_STORAGE_KEY, JSON.stringify(next));
          saveResumeMeta(STEP4_STORAGE_KEY, stepSignature, next.length);
          setSaveStatusText("녹음 저장 완료");
          updateRuntimeStatus({
            pageError: false,
            needsRetry: false,
            message: "저장 완료",
          });
          saveSucceeded = true;
        } catch (e) {
          setSaveStatusText("저장 실패");
          updateRuntimeStatus({
            pageError: true,
            needsRetry: true,
            message:
              "저장 실패(용량/저장소 이슈 가능): 브라우저 저장소를 확인하고 해당 문항을 다시 녹음해 주세요.",
          });
        } finally {
          updateRuntimeStatus({
            saving: false,
          });
        }
      } else {
        setSaveStatusText("오디오 없음");
        updateRuntimeStatus({
          pageError: true,
          needsRetry: true,
          message:
            "오디오 데이터가 생성되지 않았습니다. 해당 문항을 다시 녹음해 주세요.",
        });
      }
      if (!saveSucceeded) {
        setCurrentResult(null);
        setSaveStatusText("재녹음 필요");
        setPhase("ready");
        return;
      }
      setCurrentResult(evalResult);
      setAllResults((prev) => {
        const byIndex = new Map<number, Step4EvalResult>();
        prev.forEach((row, idx) => {
          const resolvedIndex = Number.isFinite(Number(row?.index))
            ? Number(row.index)
            : idx;
          if (resolvedIndex < 0 || resolvedIndex >= scenarios.length) return;
          byIndex.set(resolvedIndex, row);
        });
        byIndex.set(currentIndex, evalResult);
        return Array.from(byIndex.entries())
          .sort((a, b) => a[0] - b[0])
          .map((entry) => entry[1]);
      });
      setPhase("review");
    } catch (err) {
      updateRuntimeStatus({
        recording: false,
        saving: false,
        pageError: true,
        needsRetry: true,
        message: "분석 중 오류가 발생했습니다. 해당 문항을 다시 녹음해 주세요.",
      });
      setPhase("ready");
    }
  };

  const playRecordedAudio = useCallback(() => {
    if (!currentResult?.audioUrl) return;
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.onended = null;
    }
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }
    const audio = new Audio(currentResult.audioUrl);
    audioPlayerRef.current = audio;
    setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.play().catch((e) => {
      setIsPlayingAudio(false);
    });
  }, [currentResult, isPlayingAudio]);

  const handleNext = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.onended = null;
      setIsPlayingAudio(false);
    }

    if (currentIndex < scenarios.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      try {
        const sm = new SessionManager(patientProfile as any, place);
        const averageKwabScore =
          allResults.length > 0
            ? allResults.reduce((sum, r) => sum + r.kwabScore, 0) /
              allResults.length
            : 0;
        sm.saveStep4Result({
          items: allResults.map((r) => ({
            situation: r.situation,
            prompt: r.prompt,
            transcript: r.transcript,
            isCorrect: Boolean(r.isCorrect ?? r.kwabScore >= 5),
            speechDuration: r.speechDuration,
            responseStartMs: r.responseStartMs,
            responseTime: r.responseStartMs,
            silenceRatio: r.silenceRatio,
            averageAmplitude: r.averageAmplitude,
            peakCount: r.peakCount,
            contentComponentScore: r.contentComponentScore,
            fluencyComponentScore: r.fluencyComponentScore,
            clarityComponentScore: r.clarityComponentScore,
            responseStartComponentScore: r.responseStartComponentScore,
            finalScore: r.finalScore,
            fluencyScore: r.kwabScore,
            kwabScore: r.kwabScore,
            rawScore: r.rawScore,
            consonantAccuracy: r.consonantAccuracy,
            vowelAccuracy: r.vowelAccuracy,
            articulationWritingConsistency: r.articulationWritingConsistency,
            consonantDetail: r.consonantDetail,
            vowelDetail: r.vowelDetail,
          })),
          averageKwabScore: Number(averageKwabScore.toFixed(1)),
          totalScenarios: allResults.length,
          score: Math.round(averageKwabScore),
          correctCount: allResults.filter((r) => r.kwabScore >= 5).length,
          totalCount: allResults.length,
          averageArticulationWritingConsistency:
            allResults.length > 0
              ? allResults.reduce(
                  (sum, r) =>
                    sum + Number(r.articulationWritingConsistency || 0),
                  0,
                ) / allResults.length
              : 0,
          timestamp: Date.now(),
          versionSnapshot: buildVersionSnapshot("step4"),
        });
      } catch (e) {
      }

      const avgScore = Math.round(
        allResults.reduce((s, r) => s + r.kwabScore, 0) / allResults.length,
      );
      pushStep5OrRehabResult(avgScore);
    }
  };

  const handleSkipStep = useCallback(() => {
    if (!isAdmin) return;
    void logTrainingEvent({
      eventType: "training_step_skipped",
      eventStatus: "skipped",
      trainingType: clinicalTrainingType,
      stepNo: 4,
      pagePath: "/programs/step-4",
      sessionId,
      payload: {
        place,
        isRehabMode,
        rehabTargetStep: rehabTargetStep || null,
      },
    });
    try {
      const randomFloat = (min: number, max: number, digits = 1) =>
        Number((Math.random() * (max - min) + min).toFixed(digits));
      if (timerRef.current) clearInterval(timerRef.current);
      cancelSpeechPlayback();

      const demoItems = scenarios.slice(0, 3).map((scenario, index) => {
        const finalScore = randomFloat(58, 96);
        const kwabScore = Number((finalScore / 10).toFixed(1));
        return {
          index,
          situation: scenario.situation,
          prompt: scenario.prompt,
          transcript: "시연용 더미 응답입니다.",
          matchedKeywords: scenario.answerKeywords.slice(0, 2),
          relevantSentenceCount: 1,
          totalSentenceCount: 1,
          relevanceScore: randomFloat(55, 95),
          contentComponentScore: randomFloat(55, 95),
          fluencyComponentScore: randomFloat(50, 92),
          clarityComponentScore: randomFloat(62, 96),
          responseStartComponentScore: randomFloat(60, 100),
          responseStartMs: randomFloat(900, 7500, 0),
          finalScore,
          speechDuration: randomFloat(6, 14, 0),
          silenceRatio: randomFloat(0.05, 0.35, 2),
          averageAmplitude: randomFloat(25, 62, 0),
          peakCount: randomFloat(2, 7, 0),
          kwabScore,
          rawScore: randomFloat(60, 96),
          articulationWritingConsistency: randomFloat(60, 95),
          isCorrect: kwabScore >= 5,
          timestamp: new Date().toLocaleTimeString(),
        };
      });

      localStorage.setItem(STEP4_STORAGE_KEY, JSON.stringify(demoItems));
      saveResumeMeta(STEP4_STORAGE_KEY, stepSignature, demoItems.length);

      const sessionManager = new SessionManager(patientProfile as any, place);
      const averageKwabScore =
        demoItems.reduce((acc, curr) => acc + curr.kwabScore, 0) /
        Math.max(1, demoItems.length);
      const score = Math.round(averageKwabScore);

      sessionManager.saveStep4Result({
        items: demoItems.map((item) => ({
          situation: item.situation,
          prompt: item.prompt,
          transcript: item.transcript,
          isCorrect: Boolean(item.isCorrect),
          speechDuration: item.speechDuration,
          responseStartMs: item.responseStartMs,
          responseTime: item.responseStartMs,
          silenceRatio: item.silenceRatio,
          averageAmplitude: item.averageAmplitude,
          peakCount: item.peakCount,
          contentComponentScore: item.contentComponentScore,
          fluencyComponentScore: item.fluencyComponentScore,
          clarityComponentScore: item.clarityComponentScore,
          responseStartComponentScore: item.responseStartComponentScore,
          finalScore: item.finalScore,
          fluencyScore: item.kwabScore,
          kwabScore: item.kwabScore,
          rawScore: item.rawScore,
          articulationWritingConsistency: item.articulationWritingConsistency,
        })),
        averageKwabScore: Number(averageKwabScore.toFixed(1)),
        totalScenarios: demoItems.length,
        score,
        correctCount: demoItems.filter((item) => item.kwabScore >= 5).length,
        totalCount: demoItems.length,
        averageArticulationWritingConsistency:
          demoItems.reduce(
            (sum, item) =>
              sum + Number(item.articulationWritingConsistency || 0),
            0,
          ) / Math.max(1, demoItems.length),
        timestamp: Date.now(),
        versionSnapshot: buildVersionSnapshot("step4"),
      });

      pushStep5OrRehabResult(score);
    } catch (error) {
    }
  }, [
    clinicalTrainingType,
    isAdmin,
    isRehabMode,
    place,
    pushStep5OrRehabResult,
    rehabTargetStep,
    scenarios,
    sessionId,
    stepSignature,
  ]);

  if (!isMounted || !currentScenario) return null;

  return (
    <div
      className={`flex flex-col h-full bg-[#ffffff] overflow-hidden text-slate-900 font-sans ${isRehabMode ? "rehab-accent-scope" : ""}`}
    >
      {/* 상단 진행 프로그레스 바 */}
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className={`h-full ${isRehabMode ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.45)]"}`}
          style={{ width: `${((currentIndex + 1) / scenarios.length) * 100}%` }}
        />
      </div>
      <header
        className={`min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md sticky top-0 z-50 ${isRehabMode ? "border-sky-100" : "border-orange-100"}`}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
            상황 설명하기
          </h2>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          {isAdmin ? (
            <button
              type="button"
              onClick={handleSkipStep}
              className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
            >
              SKIP
            </button>
          ) : null}
          <div
            className={`px-4 py-1.5 rounded-full font-black text-xs ${isRehabMode ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-orange-50 text-orange-700"}`}
          >
            {currentIndex + 1} / {scenarios.length}
          </div>
          <button
            type="button"
            onClick={handleGoHome}
            aria-label="홈으로 이동"
            title="홈"
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

        <div className="flex flex-1 flex-col lg:flex-row min-h-0 overflow-hidden">
          <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-0 relative p-3 sm:p-4 lg:p-8 pb-24 sm:pb-10 lg:pb-8 order-1 overflow-y-auto lg:overflow-hidden">
            <RuntimeStatusBanner />
            <div
              className={`max-w-5xl w-full min-h-0 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 ${
                phase === "review" ? "items-start" : "h-full items-stretch"
              }`}
          >
            {/* 이미지 영역 */}
            <div className="bg-white p-3 sm:p-4 rounded-[28px] sm:rounded-[40px] shadow-xl border border-slate-100 min-h-0">
              <div className="aspect-square rounded-[24px] sm:rounded-[32px] overflow-hidden bg-slate-50 relative flex items-center justify-center">
                {isImageResolving ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent" />
                ) : (
                  <img
                    src={resolvedImageSrc}
                    alt="상황 이미지"
                    className="w-full h-full object-contain"
                  />
                )}
                {isPromptPlaying && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl">
                      <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
                      <span className="font-black text-orange-600 text-sm">
                        안내를 듣고 있습니다
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 대화 및 컨트롤 영역 */}
            <div className="flex flex-col gap-3 sm:gap-4 min-h-0">
              <div className="bg-white p-4 sm:p-6 lg:p-7 rounded-[28px] sm:rounded-[40px] shadow-sm border border-slate-100">
                <span className="text-[11px] font-black text-orange-500 tracking-[0.3em] uppercase block mb-4">
                  Spontaneous Speech
                </span>
                <h1
                  className={`${headlineTextSizeClass} font-black text-slate-800 leading-tight break-keep whitespace-pre-line`}
                >
                  {phase === "recording"
                    ? "듣고 있습니다. \n편하게 말씀해 주세요."
                    : "이 사진 속 상황을 자유롭게 이야기해 주세요."}
                </h1>

                <div className="mt-8">
                  {phase === "review" ? (
                    <div className="w-full space-y-3 pb-6 sm:pb-0">
                      <div className="bg-white p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border border-orange-100 shadow-lg grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-5 items-start">
                        <div className="min-w-0">
                          <span className="text-[10px] font-black text-slate-400 uppercase">
                            인식된 문장
                          </span>
                          <p className="mt-1 font-bold text-slate-700 italic break-words leading-relaxed max-h-24 overflow-y-auto pr-1">
                            {(currentResult?.transcript || "").trim()
                              ? `"${currentResult?.transcript}"`
                              : "인식 결과가 없습니다. 마이크 권한/주변 소음을 확인 후 다시 시도해 주세요."}
                          </p>
                          <p className="mt-1 text-[11px] font-black text-emerald-600">
                            {saveStatusText || "저장 상태 확인 중"}
                          </p>
                        </div>
                        <div className="text-center shrink-0 w-full sm:w-[110px]">
                          <span className="text-[10px] font-black text-orange-400 uppercase">
                            유창성 점수
                          </span>
                          <p className="text-2xl sm:text-3xl font-black text-orange-500 leading-none mt-1">
                            {currentResult?.kwabScore}/10
                          </p>
                          <button
                            onClick={playRecordedAudio}
                            className={`mt-2 w-full h-9 inline-flex items-center justify-center rounded-lg border text-[12px] font-black ${
                              isPlayingAudio ? accentSolid : accentSoft
                            }`}
                            aria-label="내 목소리 재생"
                          >
                            {isPlayingAudio ? "⏸" : "▶"}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={handleNext}
                        className={`mb-10 sm:mb-10 w-full min-h-[64px] py-4 sm:py-5 rounded-[24px] font-black text-base sm:text-lg ${trainingButtonStyles.navyPrimary}`}
                      >
                        {currentIndex < scenarios.length - 1
                          ? "다음 상황 보기"
                          : "결과 확인하기"}
                      </button>
                    </div>
                  ) : !showHint ? (
                    <div className="flex flex-wrap gap-2 items-start">
                      <button
                        onClick={() => setShowHint(true)}
                        className={`w-fit px-5 py-2.5 rounded-2xl text-xs font-black ${accentSoft}`}
                      >
                        💡 힌트 보기
                      </button>
                      <button
                        onClick={playInstruction}
                        disabled={
                          isPromptPlaying ||
                          phase === "recording" ||
                          phase === "analyzing"
                        }
                        className={`w-fit px-5 py-2.5 rounded-2xl text-xs font-black border ${
                          isPromptPlaying ||
                          phase === "recording" ||
                          phase === "analyzing"
                            ? trainingButtonStyles.slateMuted
                            : accentOutline
                        }`}
                      >
                        문제 다시듣기
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 rounded-[24px] bg-slate-50 border border-slate-100">
                      <p className="text-sm font-bold text-slate-600 leading-relaxed break-keep">
                        <span className="text-orange-500">상황: </span>
                        <span className="whitespace-pre-line">
                          {formattedPrompt}
                        </span>
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-600 leading-relaxed break-keep">
                        <span className="text-orange-500">도움말: </span>
                        <span className="whitespace-pre-line">
                          {formattedHint}
                        </span>
                      </p>
                      <div className="mt-3">
                        <button
                          onClick={playInstruction}
                          disabled={
                            isPromptPlaying ||
                            phase === "recording" ||
                            phase === "analyzing"
                          }
                          className={`w-fit px-4 py-2 rounded-xl text-xs font-black border ${
                            isPromptPlaying ||
                            phase === "recording" ||
                            phase === "analyzing"
                              ? trainingButtonStyles.slateMuted
                              : accentOutline
                          }`}
                        >
                          문제 다시듣기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 녹음 컨트롤 */}
              <div
                className={`w-full py-2 ${phase === "review" ? "min-h-0" : "lg:min-h-[280px]"}`}
              >
                {phase !== "review" && (
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {phase === "recording" && (
                        <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-40" />
                      )}
                      <button
                        onClick={
                          phase === "recording" ? stopRecording : startRecording
                        }
                        disabled={!canRecord || phase === "analyzing"}
                        className={`relative z-10 w-24 h-24 rounded-full shadow-2xl flex items-center justify-center transition-all ${
                          phase === "recording"
                            ? "bg-slate-900"
                            : "bg-white border-4 border-slate-50"
                        }`}
                      >
                        {phase === "recording" ? (
                          <div className="w-7 h-7 bg-white rounded-sm animate-pulse" />
                        ) : phase === "analyzing" ? (
                          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="text-4xl">🎙️</span>
                        )}
                      </button>
                    </div>
                    <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-slate-300">
                      {phase === "recording"
                        ? "Recording..."
                        : phase === "analyzing"
                          ? "Analyzing..."
                          : "Tap to Speak"}
                    </p>
                  </div>
                )}
              </div>
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
              audioLevel: phase === "recording" ? Math.max(20, audioLevel) : 0,
            }}
            showTracking={showTracking}
            onToggleTracking={() => setShowTracking(!showTracking)}
            scoreLabel="유창성"
            scoreValue={
              currentResult ? `${currentResult.kwabScore}/10` : undefined
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

export default function Step4Page() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center font-black text-slate-200 uppercase">
          Loading...
        </div>
      }
    >
      <Step4Content />
    </Suspense>
  );
}
