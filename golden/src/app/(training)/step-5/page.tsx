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
import { useTraining } from "../TrainingContext";
import { AnalysisSidebar } from "@/components/training/AnalysisSidebar";
import { HomeExitModal } from "@/components/training/HomeExitModal";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { loadPatientProfile } from "@/lib/patientStorage";
import { saveTrainingExitProgress } from "@/lib/trainingExitProgress";
import {
  analyzeArticulation,
  calculateArticulationWritingConsistency,
  createInitialArticulationAnalyzerState,
} from "@/lib/analysis/articulationAnalyzer";
import { estimateLipSymmetryFromLandmarks } from "@/lib/analysis/lipMetrics";
import { addSentenceLineBreaks } from "@/lib/text/displayText";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";

export const dynamic = "force-dynamic";

interface ReadingMetrics {
  place: string;
  text: string;
  transcript?: string;
  isCorrect?: boolean;
  audioUrl: string;
  totalTime: number;
  wordsPerMinute: number;
  pauseCount: number;
  readingScore: number;
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

function getStep5TextSizeClass(text: string): string {
  const normalizedLength = (text || "").replace(/\s+/g, "").length;
  if (normalizedLength >= 110) return "text-xs md:text-sm lg:text-base";
  if (normalizedLength >= 85) return "text-sm md:text-base lg:text-lg";
  if (normalizedLength >= 60) return "text-base md:text-lg lg:text-xl";
  if (normalizedLength >= 40) return "text-lg md:text-xl lg:text-2xl";
  return "text-xl md:text-2xl lg:text-3xl";
}

function blendArticulationAccuracy(
  visualAccuracy: number,
  speechAccuracy?: number,
): number {
  if (!Number.isFinite(speechAccuracy) || Number(speechAccuracy) <= 0) {
    return Math.min(100, Math.max(0, visualAccuracy));
  }
  return Math.min(
    100,
    Math.max(0, visualAccuracy * 0.2 + Number(speechAccuracy) * 0.8),
  );
}

function Step5Content() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { sidebarMetrics, updateSidebar, updateRuntimeStatus, resetRuntimeStatus } =
    useTraining();

  const place = (searchParams.get("place") as PlaceType) || "home";
  const step4Score = searchParams.get("step4") || "0";
  const isRehabMode = searchParams.get("trainMode") === "rehab";
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
        router.push(`/result-rehab?${params.toString()}`);
        return;
      }
      router.push(`/step-6?place=${place}&step4=${step4Score}&step5=${step5Value}`);
    },
    [isRehabMode, place, rehabTargetStep, router, searchParams, step4Score],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const isTrialMode =
      typeof window !== "undefined" &&
      sessionStorage.getItem("btt.trialMode") === "1";
    if (isTrialMode) {
      router.push("/");
      return;
    }
    saveTrainingExitProgress(place, 5);
    router.push("/select");
  };

  const texts = useMemo(
    () => READING_TEXTS[place] || READING_TEXTS.home,
    [place],
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

    const lipSymmetry = estimateLipSymmetryFromLandmarks(sidebarMetrics.landmarks);
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
    localStorage.removeItem("step5_recorded_data");
    analyzerRef.current = new SpeechAnalyzer();
    resetRuntimeStatus();

    async function setupCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          if (videoRef.current) videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Step 5 Camera Error:", err);
      }
    }
    setupCamera();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      analyzerRef.current?.cancelAnalysis();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      resetRuntimeStatus();
    };
  }, [resetRuntimeStatus]);

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
      setPhase("reading");
      setReadingTime(0);
      readingSecondsRef.current = 0;
      setHighlightIndex(0);
      await playStartBeep();
      if (!analyzerRef.current) analyzerRef.current = new SpeechAnalyzer();
      await analyzerRef.current.startAnalysis();
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
        updateRuntimeStatus({
          pageError: true,
          needsRetry: true,
          message: `음성 인식 실패(${analysis.errorReason})`,
        });
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
              mouthWidthPct: liveArticulationRef.current.vowelDetails.mouthWidthPct,
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
      const articulationWritingConsistency = calculateArticulationWritingConsistency({
        targetText: currentItem.text,
        consonantAccuracy,
        vowelAccuracy,
      }).score;
      const readingScore = Math.min(100, Math.round((wpm / 100) * 100));

      updateSidebar({
        consonantAccuracy: consonantAccuracy / 100,
        vowelAccuracy: vowelAccuracy / 100,
      });

      const res: ReadingMetrics = {
        place,
        text: currentItem.text,
        transcript: String(analysis.transcript || "").trim(),
        isCorrect: readingScore >= 60,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : "",
        totalTime: finalReadingTime,
        wordsPerMinute: wpm,
        pauseCount: 0,
        readingScore,
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

      setCurrentResult(res);
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

      if (audioBlob) {
        updateRuntimeStatus({
          saving: true,
          message: "결과 저장 중",
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const existing = JSON.parse(
              localStorage.getItem("step5_recorded_data") || "[]",
            );
            const next = [
              ...existing,
              {
                ...res,
                audioUrl: reader.result as string,
                timestamp: new Date().toLocaleTimeString(),
              },
            ];
            localStorage.setItem("step5_recorded_data", JSON.stringify(next));
            updateRuntimeStatus({
              pageError: false,
              needsRetry: false,
              message: "저장 완료",
            });
          } catch (saveError) {
            console.error(saveError);
            updateRuntimeStatus({
              pageError: true,
              needsRetry: true,
              message: "저장 실패: 브라우저 저장소 상태를 확인해 주세요.",
            });
          } finally {
            updateRuntimeStatus({
              saving: false,
            });
          }
        };
        reader.readAsDataURL(audioBlob);
      }
    } catch (error) {
      console.error(error);
      updateRuntimeStatus({
        recording: false,
        saving: false,
        pageError: true,
        needsRetry: true,
        message: "분석 중 오류가 발생했습니다.",
      });
    } finally {
      setPhase("review");
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
    const updatedResults = [...results, currentResult];
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
        sm.saveStep5Result({
          correctAnswers: updatedResults.length,
          totalQuestions: texts.length,
          timestamp: Date.now(),
          averageConsonantAccuracy,
          averageVowelAccuracy,
          averageArticulationWritingConsistency,
          items: updatedResults as any,
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
      if (highlightTimerRef.current) clearInterval(highlightTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      analyzerRef.current?.cancelAnalysis();
      resetRuntimeStatus();

      const demoResults: ReadingMetrics[] = texts.map((item, idx) => {
        const totalTime = Math.max(8, Math.round(item.wordCount / 2));
        const wordsPerMinute = Math.max(
          40,
          Math.round((item.wordCount / totalTime) * 60),
        );
        const readingScore = Math.min(100, 74 + ((idx % 4) * 6));

        return {
          place,
          text: item.text,
          transcript: item.text,
          isCorrect: readingScore >= 60,
          audioUrl: "",
          totalTime,
          wordsPerMinute,
          pauseCount: 0,
          readingScore,
          consonantAccuracy: 75 + ((idx + 1) % 4) * 5,
          vowelAccuracy: 73 + (idx % 4) * 5,
          articulationWritingConsistency: 74 + ((idx + 2) % 3) * 6,
          dataSource: "demo",
        };
      });

      const recordedPayload = demoResults.map((res) => ({
        ...res,
        timestamp: new Date().toLocaleTimeString(),
      }));
      localStorage.setItem("step5_recorded_data", JSON.stringify(recordedPayload));

      const patient = loadPatientProfile();
      const sm = new SessionManager(
        (patient || { age: 70, educationYears: 12 }) as any,
        place,
      );
      sm.saveStep5Result({
        correctAnswers: demoResults.length,
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
  }, [pushStep6OrRehabResult, resetRuntimeStatus, texts]);

  if (!isMounted || !currentItem) return null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto lg:overflow-hidden text-slate-900 font-sans">
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.45)]"
          style={{ width: `${((currentIndex + 1) / texts.length) * 100}%` }}
        />
      </div>
      <header className="h-16 px-6 border-b border-orange-100 flex justify-between items-center bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div>
            <span className="text-orange-500 font-black text-[10px] uppercase tracking-widest leading-none block">
              Step 05 • Reading Fluency Training
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              텍스트 읽기 학습
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSkipStep}
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
          >
            SKIP
          </button>
          <div className="bg-orange-50 px-4 py-1.5 rounded-full font-black text-xs text-orange-700 border border-orange-200">
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
        <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-0 relative p-4 lg:p-10 pb-8 lg:pb-10 order-1 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto flex flex-col h-full gap-4 lg:gap-8 justify-start lg:justify-center">
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
              className={`relative bg-white border rounded-[28px] p-8 lg:p-12 shadow-sm transition-all duration-500 ${phase === "reading" ? "border-orange-500 shadow-orange-100/70 scale-[1.01]" : "border-orange-100"}`}
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
                  className="group w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-[#0B1A3A] shadow-2xl flex items-center justify-center hover:scale-105 transition-all border-4 border-white"
                >
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
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
                    className="relative z-10 w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-[#0B1A3A] shadow-2xl flex items-center justify-center"
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
                          {currentResult.readingScore}%
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
                        className={`w-full py-4 rounded-2xl font-black text-sm ${isPlayingAudio ? trainingButtonStyles.orangeSolid : trainingButtonStyles.orangeOutline}`}
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
        <aside className="w-full lg:w-[380px] h-full border-l border-slate-50 bg-white p-4 shrink-0 overflow-hidden order-2">
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
              consonantClosureHoldMs: sidebarMetrics.consonantClosureHoldMs || 0,
              consonantOpeningSpeedMs: sidebarMetrics.consonantOpeningSpeedMs || 0,
              vowelMouthOpening: (sidebarMetrics.vowelMouthOpening || 0) * 100,
              vowelMouthWidth: (sidebarMetrics.vowelMouthWidth || 0) * 100,
              vowelRounding: (sidebarMetrics.vowelRounding || 0) * 100,
              vowelPatternMatch: (sidebarMetrics.vowelPatternMatch || 0) * 100,
              audioLevel: phase === "reading" ? 40 : 0,
            }}
            showTracking={showTracking}
            onToggleTracking={() => setShowTracking((prev) => !prev)}
            scoreLabel="현재 상태"
            scoreValue={currentResult ? `${currentResult.readingScore}%` : "-"}
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


