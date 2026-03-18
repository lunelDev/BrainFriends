"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PlaceType } from "@/constants/trainingData";
import {
  VISUAL_MATCHING_PROTOCOLS,
  VISUAL_MATCHING_RECOMMENDED_COUNT,
} from "@/constants/visualTrainingData";
import { useTraining } from "../../TrainingContext";
import { HomeExitModal } from "@/components/training/HomeExitModal";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { loadPatientProfile } from "@/lib/patientStorage";
import { saveTrainingExitProgress } from "@/lib/trainingExitProgress";
import {
  analyzeArticulation,
  createInitialArticulationAnalyzerState,
} from "@/lib/analysis/articulationAnalyzer";
import { estimateLipSymmetryFromLandmarks } from "@/lib/analysis/lipMetrics";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { buildVersionSnapshot } from "@/lib/analysis/versioning";
import { logTrainingEvent } from "@/lib/client/trainingEventsApi";
import {
  cancelSpeechPlayback,
  speakKoreanText,
} from "@/lib/client/speechSynthesis";
import {
  buildImageCandidates,
  shuffleArray,
  type Step3VisualOption as VisualOption,
} from "@/features/steps/step3/utils";
import {
  buildStepSignature,
  isResumeMetaMatched,
  saveResumeMeta,
} from "@/lib/trainingResume";

export const dynamic = "force-dynamic";
const STEP3_TOTAL_QUESTIONS = 10;
const STEP_RESPONSE_BONUS_THRESHOLD_MS = 6000;
const STEP3_STORAGE_KEY = "step3_data";
const STEP3_PROTOCOL_KEY_PREFIX = "step3_protocol";
type Step3ProtocolItem = {
  targetWord: string;
  answerId: string;
  options: VisualOption[];
  [key: string]: unknown;
};

function calculateCompositeScore(
  results: Array<{ isCorrect: boolean; responseTime?: number }>,
  totalQuestions: number,
) {
  const total = Math.max(1, totalQuestions);
  const correctCount = results.filter((r) => r.isCorrect).length;
  const fastCorrectCount = results.filter(
    (r) =>
      r.isCorrect &&
      Number.isFinite(Number(r.responseTime)) &&
      Number(r.responseTime) <= STEP_RESPONSE_BONUS_THRESHOLD_MS,
  ).length;
  const accuracyScore = (correctCount / total) * 100;
  const speedBonus = (fastCorrectCount / total) * 100;
  const compositeScore = Number(
    (accuracyScore * 0.8 + speedBonus * 0.2).toFixed(1),
  );
  return {
    correctCount,
    fastCorrectCount,
    accuracyScore,
    speedBonus,
    compositeScore,
  };
}

let GLOBAL_SPEECH_LOCK: Record<number, boolean> = {};

function Step3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { sidebarMetrics, updateSidebar } = useTraining();
  const place = (searchParams?.get("place") as PlaceType) || "home";
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
  const accentSolid = isRehabMode
    ? "bg-sky-500 text-white border border-sky-500 hover:bg-sky-600 transition-all"
    : trainingButtonStyles.orangeSolid;
  const rehabTargetStep = Number(searchParams.get("targetStep") || "0");
  const clinicalTrainingType = isRehabMode ? "speech-rehab" : "self-assessment";

  useEffect(() => {
    const patient = loadPatientProfile();
    void logTrainingEvent({
      eventType: "training_step_viewed",
      trainingType: clinicalTrainingType,
      stepNo: 3,
      pagePath: "/programs/step-3",
      sessionId: patient?.sessionId ?? null,
      payload: {
        place,
        isRehabMode,
        rehabTargetStep: rehabTargetStep || null,
      },
    });
  }, [clinicalTrainingType, isRehabMode, place, rehabTargetStep]);

  const pushStep4OrRehabResult = useCallback(
    (step3Score: number) => {
      const step1Score = searchParams.get("step1") || "0";
      const step2Score = searchParams.get("step2") || "0";
      if (isRehabMode && rehabTargetStep === 3) {
        const params = new URLSearchParams({
          place,
          trainMode: "rehab",
          targetStep: "3",
          step1: step1Score,
          step2: step2Score,
          step3: String(step3Score),
          step4: "0",
          step5: "0",
          step6: "0",
        });
        router.push(`/result-page/speech-rehab?${params.toString()}`);
        return;
      }
      router.push(
        `/programs/step-4?place=${place}&step1=${step1Score}&step2=${step2Score}&step3=${step3Score}`,
      );
    },
    [isRehabMode, place, rehabTargetStep, router, searchParams],
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
    saveTrainingExitProgress(place, 3);
    router.push("/select-page/self-assessment");
  };

  const [isMounted, setIsMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState<boolean | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [canAnswer, setCanAnswer] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [isPreloadingImages, setIsPreloadingImages] = useState(false);
  const [resolvedImageMap, setResolvedImageMap] = useState<
    Record<string, string>
  >({});
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
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

  const imageCacheRef = useRef<Record<string, string>>({});

  const protocol = useMemo<Step3ProtocolItem[]>(() => {
    const buildProtocol = (): Step3ProtocolItem[] => {
      const allQuestions = (
        VISUAL_MATCHING_PROTOCOLS[place] || VISUAL_MATCHING_PROTOCOLS.home
      ).slice(0, VISUAL_MATCHING_RECOMMENDED_COUNT);
      const sampledQuestions = shuffleArray(allQuestions).slice(
        0,
        STEP3_TOTAL_QUESTIONS,
      );
      return sampledQuestions.map((q) => {
        const shuffledOptions = shuffleArray(q.options);
        const shuffledAnswer = shuffledOptions.find(
          (opt) => opt.label === q.targetWord,
        );
        return {
          ...q,
          options: shuffledOptions,
          answerId: shuffledAnswer?.id ?? q.answerId,
        };
      });
    };

    if (typeof window === "undefined") {
      return buildProtocol();
    }

    const protocolStorageKey = `${STEP3_PROTOCOL_KEY_PREFIX}:${place}`;
    try {
      const raw = sessionStorage.getItem(protocolStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      const isValid =
        Array.isArray(parsed) &&
        parsed.length === STEP3_TOTAL_QUESTIONS &&
        parsed.every(
          (item) =>
            item &&
            typeof item.targetWord === "string" &&
            Array.isArray(item.options) &&
            typeof item.answerId === "string",
        );
      if (isValid) return parsed as Step3ProtocolItem[];
    } catch {
      // ignore and rebuild
    }

    const nextProtocol = buildProtocol();
    try {
      sessionStorage.setItem(protocolStorageKey, JSON.stringify(nextProtocol));
    } catch {
      // ignore
    }
    return nextProtocol;
  }, [place]);
  const stepSignature = useMemo(
    () =>
      buildStepSignature(
        "step3",
        place,
        protocol.map((item) => `${item.targetWord}|${item.answerId}`),
      ),
    [place, protocol],
  );

  const currentItem = protocol[currentIndex];

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
  }, [currentIndex, currentItem?.targetWord, updateSidebar]);

  useEffect(() => {
    if (!currentItem?.targetWord) return;

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
      targetText: currentItem.targetWord,
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
  }, [
    currentItem?.targetWord,
    sidebarMetrics.mouthOpening,
    sidebarMetrics.mouthWidth,
    updateSidebar,
  ]);

  useEffect(() => {
    setIsMounted(true);
    GLOBAL_SPEECH_LOCK = {};

    return () => {
      cancelSpeechPlayback();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || protocol.length === 0) return;
    try {
      if (!isResumeMetaMatched(STEP3_STORAGE_KEY, stepSignature)) return;
      const raw = localStorage.getItem(STEP3_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      if (parsed.length >= protocol.length) return;

      const protocolWords = new Set(
        protocol.map((item) => String(item?.targetWord || "")),
      );
      const looksSameSession = parsed.every((row: any) =>
        protocolWords.has(String(row?.text || "")),
      );
      if (!looksSameSession) return;

      setAnalysisResults(parsed);
      setCurrentIndex(Math.min(parsed.length, protocol.length - 1));
      console.log(
        `↩️ Step 3 이어하기 복원: ${parsed.length}/${protocol.length}`,
      );
    } catch (error) {
      console.error("Step 3 이어하기 복원 실패:", error);
    }
  }, [protocol, stepSignature]);

  const speakWord = useCallback((text: string) => {
    setIsSpeaking(true);
    setCanAnswer(false);
    void speakKoreanText(text, { rate: 0.96 }).finally(() => {
      setIsSpeaking(false);
      setCanAnswer(true);
      setQuestionStartTime(Date.now());
    });
  }, []);

  useEffect(() => {
    if (!isMounted || !currentItem || GLOBAL_SPEECH_LOCK[currentIndex]) return;
    GLOBAL_SPEECH_LOCK[currentIndex] = true;
    const timer = setTimeout(() => speakWord(currentItem.targetWord), 800);
    return () => clearTimeout(timer);
  }, [currentIndex, isMounted, currentItem, speakWord]);

  const findFirstLoadableImage = useCallback(async (candidates: string[]) => {
    for (const url of candidates) {
      const loaded = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
      if (loaded) return url;
    }
    return "";
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    let active = true;
    setIsPreloadingImages(true);
    setResolvedImageMap({});

    (async () => {
      const entries = await Promise.all(
        currentItem.options.map(async (option: VisualOption) => {
          const cacheKey = `${place}:${option.label}`;
          const cached = imageCacheRef.current[cacheKey];
          if (cached) return [option.id, cached] as const;

          const resolved = await findFirstLoadableImage(
            buildImageCandidates(place, option),
          );
          if (resolved) imageCacheRef.current[cacheKey] = resolved;
          return [option.id, resolved] as const;
        }),
      );

      if (!active) return;
      setResolvedImageMap(Object.fromEntries(entries));
      setIsPreloadingImages(false);
    })();

    return () => {
      active = false;
    };
  }, [currentItem, findFirstLoadableImage, place]);

  const handleReplay = () => {
    if (
      playCount < 1 &&
      !selectedId &&
      !isSpeaking &&
      !isAnswered &&
      canAnswer &&
      !isPreloadingImages
    ) {
      speakWord(currentItem.targetWord);
      setPlayCount((prev) => prev + 1);
    }
  };
  const replayEnabled =
    playCount < 1 &&
    !isSpeaking &&
    !isAnswered &&
    canAnswer &&
    !isPreloadingImages;

  const handleOptionClick = (id: string) => {
    if (!canAnswer || isPreloadingImages || selectedId || isAnswered) return;
    const isCorrect = id === currentItem.answerId;
    const responseTime =
      questionStartTime > 0 ? Math.max(0, Date.now() - questionStartTime) : 0;
    const selectedOption = currentItem.options.find((opt) => opt.id === id);
    const correctOption = currentItem.options.find(
      (opt) => opt.id === currentItem.answerId,
    );
    setSelectedId(id);
    setShowResult(isCorrect);
    setIsAnswered(true);
    setCanAnswer(false);

    // ✅ 현재 문제의 결과 생성 (Result 페이지 규격)
    const currentResult = {
      text: currentItem.targetWord, // 들려준 단어
      userAnswer: id,
      userAnswerLabel: selectedOption?.label || id,
      correctAnswerId: currentItem.answerId,
      correctAnswerLabel: correctOption?.label || currentItem.targetWord,
      isCorrect: isCorrect,
      responseTime,
      dataSource: "measured",
      consonantAccuracy: Number(
        (
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.consonantSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.consonant) || 0
        ).toFixed(1),
      ),
      vowelAccuracy: Number(
        (
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.vowelSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.vowel) || 0
        ).toFixed(1),
      ),
      consonantDetail: {
        closureRatePct: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.closureRateSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.consonantDetails.closureRatePct
          ).toFixed(1),
        ),
        closureHoldMs: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.closureHoldMsSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.consonantDetails.closureHoldMs
          ).toFixed(1),
        ),
        lipSymmetryPct: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.lipSymmetrySum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.consonantDetails.lipSymmetryPct
          ).toFixed(1),
        ),
        openingSpeedMs: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.openingSpeedMsSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.consonantDetails.openingSpeedMs
          ).toFixed(1),
        ),
      },
      vowelDetail: {
        mouthOpeningPct: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.mouthOpeningSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.vowelDetails.mouthOpeningPct
          ).toFixed(1),
        ),
        mouthWidthPct: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.mouthWidthSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.vowelDetails.mouthWidthPct
          ).toFixed(1),
        ),
        roundingPct: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.roundingSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.vowelDetails.roundingPct
          ).toFixed(1),
        ),
        patternMatchPct: Number(
          (articulationAggregateRef.current.count > 0
            ? articulationAggregateRef.current.patternMatchSum /
              articulationAggregateRef.current.count
            : liveArticulationRef.current.vowelDetails.patternMatchPct
          ).toFixed(1),
        ),
      },
      timestamp: new Date().toLocaleTimeString(),
    };

    // ✅ 누적 결과 업데이트 (Step3는 10문항 기준으로 저장/채점)
    const totalQuestions = STEP3_TOTAL_QUESTIONS;
    const updatedResults = [...analysisResults, currentResult].slice(
      0,
      totalQuestions,
    );
    setAnalysisResults(updatedResults);

    // ✅ Result 페이지용 백업 저장 (실시간, 최대 10개)
    localStorage.setItem(STEP3_STORAGE_KEY, JSON.stringify(updatedResults));
    saveResumeMeta(STEP3_STORAGE_KEY, stepSignature, updatedResults.length);
    console.log("✅ Step 3 데이터 저장(10문항 기준):", updatedResults);

    setTimeout(() => {
      if (currentIndex < protocol.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedId(null);
        setShowResult(null);
        setIsAnswered(false);
        setPlayCount(0);
      } else {
        // ✅ 최종 점수 계산 (10문항 고정 분모)
        const scoring = calculateCompositeScore(updatedResults, totalQuestions);
        const avgScore = scoring.compositeScore;

        // ✅ SessionManager 통합 저장
        try {
          const patient = loadPatientProfile();
          const sm = new SessionManager(
            (patient || { age: 70, educationYears: 12 }) as any,
            place,
          );

          sm.saveStep3Result({
            items: updatedResults,
            score: avgScore,
            correctCount: scoring.correctCount,
            totalCount: totalQuestions,
            accuracyScore: scoring.accuracyScore,
            speedBonusScore: scoring.speedBonus,
            fastCorrectCount: scoring.fastCorrectCount,
            averageConsonantAccuracy:
              updatedResults.reduce(
                (sum, row) => sum + Number(row?.consonantAccuracy || 0),
                0,
              ) / Math.max(1, updatedResults.length),
            averageVowelAccuracy:
              updatedResults.reduce(
                (sum, row) => sum + Number(row?.vowelAccuracy || 0),
                0,
              ) / Math.max(1, updatedResults.length),
            timestamp: Date.now(),
            versionSnapshot: buildVersionSnapshot("step3"),
          });

          console.log("✅ Step 3 SessionManager 저장 완료");
        } catch (e) {
          console.error("❌ Step 3 SessionManager 저장 실패:", e);
        }
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`${STEP3_PROTOCOL_KEY_PREFIX}:${place}`);
        }

        pushStep4OrRehabResult(avgScore);
      }
    }, 1500);
  };

  const handleSkipStep = useCallback(() => {
    try {
      const randomFloat = (min: number, max: number, digits = 1) =>
        Number((Math.random() * (max - min) + min).toFixed(digits));
      cancelSpeechPlayback();

      const demoResults = protocol.map((item) => {
        const isCorrect = Math.random() < 0.72;
        const responseTime = Number((Math.random() * 5000 + 500).toFixed(0));
        const wrongOption = item.options.find(
          (opt) => opt.id !== item.answerId,
        );
        return {
          text: item.targetWord,
          userAnswer: isCorrect ? item.answerId : "skip",
          userAnswerLabel: isCorrect
            ? item.targetWord
            : wrongOption?.label || "오답 선택",
          correctAnswerId: item.answerId,
          correctAnswerLabel: item.targetWord,
          isCorrect,
          responseTime,
          dataSource: "demo",
          consonantAccuracy: randomFloat(58, 96),
          vowelAccuracy: randomFloat(58, 96),
          timestamp: new Date().toLocaleTimeString(),
        };
      });

      localStorage.setItem(STEP3_STORAGE_KEY, JSON.stringify(demoResults));
      saveResumeMeta(STEP3_STORAGE_KEY, stepSignature, demoResults.length);

      const totalCount = Math.max(1, demoResults.length);
      const scoring = calculateCompositeScore(demoResults, totalCount);
      const score = scoring.compositeScore;

      const patient = loadPatientProfile();
      const sessionManager = new SessionManager(
        (patient || { age: 70, educationYears: 12 }) as any,
        place,
      );
      sessionManager.saveStep3Result({
        items: demoResults,
        score,
        correctCount: scoring.correctCount,
        totalCount,
        accuracyScore: scoring.accuracyScore,
        speedBonusScore: scoring.speedBonus,
        fastCorrectCount: scoring.fastCorrectCount,
        averageConsonantAccuracy:
          demoResults.reduce(
            (sum, row) => sum + Number(row?.consonantAccuracy || 0),
            0,
          ) / Math.max(1, demoResults.length),
        averageVowelAccuracy:
          demoResults.reduce(
            (sum, row) => sum + Number(row?.vowelAccuracy || 0),
            0,
          ) / Math.max(1, demoResults.length),
        timestamp: Date.now(),
        versionSnapshot: buildVersionSnapshot("step3"),
      });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${STEP3_PROTOCOL_KEY_PREFIX}:${place}`);
      }

      pushStep4OrRehabResult(score);
    } catch (error) {
      console.error("Step3 skip failed:", error);
    }
  }, [place, protocol, pushStep4OrRehabResult, stepSignature]);

  if (!isMounted || !currentItem) return null;

  return (
    <div
      className={`flex flex-col h-full bg-[#ffffff] overflow-hidden text-slate-900 font-sans ${isRehabMode ? "rehab-accent-scope" : ""}`}
    >
      {/* 상단 진행 프로그레스 바 */}
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className={`h-full ${isRehabMode ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"}`}
          style={{ width: `${((currentIndex + 1) / protocol.length) * 100}%` }}
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
              Step 03 • Visual-Auditory Association
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              단어 명명
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
            {currentIndex + 1} / {protocol.length}
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

      <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-0 bg-[#ffffff] pb-6 lg:pb-0 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col h-full min-h-0 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-slate-100 pb-3 shrink-0">
            <div className="space-y-1">
              <div
                className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md ${isRehabMode ? "bg-sky-50" : "bg-orange-50"}`}
              >
                <span
                  className={`w-1 h-1 rounded-full ${isRehabMode ? "bg-sky-500" : "bg-orange-500"}`}
                />
                <p
                  className={`font-bold text-[9px] uppercase tracking-wider ${isRehabMode ? "text-sky-600" : "text-orange-600"}`}
                >
                  Step 03
                </p>
              </div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-800 break-keep">
                {isSpeaking
                  ? "문제를 잘 들어보세요"
                  : "알맞은 그림을 선택하세요"}
              </h1>
            </div>

            <button
              onClick={handleReplay}
              disabled={!replayEnabled}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm active:scale-95 shrink-0 mb-1 pointer-events-auto ${
                replayEnabled
                  ? accentSoft
                  : `${trainingButtonStyles.slateOutline} opacity-60`
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  replayEnabled
                    ? isRehabMode
                      ? "bg-sky-500"
                      : "bg-orange-500"
                    : "bg-slate-300"
                }`}
              >
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                </svg>
              </div>
              <span
                className={`text-xs font-black ${
                  replayEnabled
                    ? isRehabMode
                      ? "text-sky-700"
                      : "text-orange-700"
                    : "text-slate-400"
                }`}
              >
                다시 듣기
              </span>
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-start justify-start lg:items-center lg:justify-center pb-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 w-full lg:h-full lg:max-h-[60vh]">
              {currentItem.options.map((option: VisualOption) => {
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionClick(option.id)}
                    disabled={
                      isSpeaking ||
                      isAnswered ||
                      !canAnswer ||
                      isPreloadingImages
                    }
                    className={`relative z-20 w-full aspect-[4/5] sm:aspect-square lg:h-full rounded-[24px] flex items-center justify-center transition-all border shadow-sm bg-white overflow-hidden pointer-events-auto
                    ${selectedId === option.id ? (showResult ? "border-emerald-500 ring-4 ring-emerald-50 scale-105" : "border-slate-800 opacity-60 scale-95") : isRehabMode ? "border-slate-100 hover:border-sky-100 hover:shadow-md" : "border-slate-100 hover:border-orange-100 hover:shadow-md"}`}
                  >
                    <div className="w-full h-full p-4 flex items-center justify-center pointer-events-none">
                      {isPreloadingImages ? (
                        <div className="w-20 h-20 lg:w-28 lg:h-28 rounded-2xl bg-slate-100 animate-pulse" />
                      ) : resolvedImageMap[option.id] ? (
                        <>
                          <img
                            src={resolvedImageMap[option.id]}
                            alt={option.label}
                            className="w-24 h-24 lg:w-32 lg:h-32 object-contain"
                            loading="eager"
                            decoding="async"
                          />
                        </>
                      ) : (
                        <span className="text-4xl lg:text-5xl">
                          {option.emoji || "🖼️"}
                        </span>
                      )}
                    </div>
                    {selectedId === option.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm animate-in fade-in zoom-in pointer-events-none">
                        <span
                          className={`text-6xl font-black ${showResult ? "text-emerald-500" : "text-slate-800"}`}
                        >
                          {showResult ? "O" : "X"}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <HomeExitModal
        open={isHomeExitModalOpen}
        onConfirm={confirmGoHome}
        onCancel={() => setIsHomeExitModalOpen(false)}
      />
    </div>
  );
}

export default function Step3Page() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-orange-500 font-black">
          LOADING...
        </div>
      }
    >
      <Step3Content />
    </Suspense>
  );
}
