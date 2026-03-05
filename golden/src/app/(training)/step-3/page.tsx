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
  VISUAL_MATCHING_IMAGE_FILENAME_MAP,
  VISUAL_MATCHING_PROTOCOLS,
  VISUAL_MATCHING_RECOMMENDED_COUNT,
} from "@/constants/visualTrainingData";
import { useTraining } from "../TrainingContext";
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

export const dynamic = "force-dynamic";
const STEP3_TOTAL_QUESTIONS = 10;

type VisualOption = {
  id: string;
  label: string;
  img?: string;
  emoji?: string;
};

let GLOBAL_SPEECH_LOCK: Record<number, boolean> = {};
const STEP3_IMAGE_BASE_URL = (
  process.env.NEXT_PUBLIC_STEP3_IMAGE_BASE_URL ||
  "https://cdn.jsdelivr.net/gh/BUGISU/braintalktalk-assets@main/step3"
).replace(/\/$/, "");

const toTwemojiSvgUrl = (emoji: string) => {
  const codePoints = Array.from(emoji).map((char) =>
    char.codePointAt(0)?.toString(16),
  );
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints.join("-")}.svg`;
};

const buildNameVariants = (baseName: string) => {
  const variants = new Set<string>();
  variants.add(baseName);
  variants.add(baseName.replace(/-/g, ""));
  variants.add(baseName.replace(/-/g, "_"));
  variants.add(baseName.split("-")[0]);
  return Array.from(variants).filter(Boolean);
};

const buildImageCandidates = (
  place: PlaceType,
  option: VisualOption,
): string[] => {
  const candidates: string[] = [];

  if (option.img) candidates.push(option.img);

  const mappedBaseName =
    VISUAL_MATCHING_IMAGE_FILENAME_MAP[place]?.[option.label];
  if (mappedBaseName) {
    for (const nameVariant of buildNameVariants(mappedBaseName)) {
      candidates.push(
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.png`,
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.jpg`,
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.jpeg`,
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.webp`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.png`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.jpg`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.jpeg`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.webp`,
      );
    }
  }

  candidates.push(
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.png`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.jpg`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.jpeg`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.webp`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.png`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.jpg`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.jpeg`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.webp`,
  );

  if (option.emoji) candidates.push(toTwemojiSvgUrl(option.emoji));

  return Array.from(new Set(candidates.filter(Boolean)));
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

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
        router.push(`/result-rehab?${params.toString()}`);
        return;
      }
      router.push(
        `/step-4?place=${place}&step1=${step1Score}&step2=${step2Score}&step3=${step3Score}`,
      );
    },
    [isRehabMode, place, rehabTargetStep, router, searchParams],
  );
  const handleGoHome = () => {
    setIsHomeExitModalOpen(true);
  };
  const confirmGoHome = () => {
    if (isRehabMode) {
      router.push("/rehab");
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
    router.push("/select");
  };

  const [isMounted, setIsMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState<boolean | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [canAnswer, setCanAnswer] = useState(false);
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

  const protocol = useMemo(() => {
    const allQuestions = (
      VISUAL_MATCHING_PROTOCOLS[place] || VISUAL_MATCHING_PROTOCOLS.home
    ).slice(0, VISUAL_MATCHING_RECOMMENDED_COUNT);
    const sampledQuestions = shuffleArray(allQuestions).slice(
      0,
      STEP3_TOTAL_QUESTIONS,
    );

    // 문항 순서 랜덤 + 문항 내부 보기 순서 랜덤(정답 위치 고정 방지)
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
  }, [place]);

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

    const lipSymmetry = estimateLipSymmetryFromLandmarks(sidebarMetrics.landmarks);
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
    articulationAggregateRef.current.mouthWidthSum += vowelDetails.mouthWidthPct;
    articulationAggregateRef.current.roundingSum += vowelDetails.roundingPct;
    articulationAggregateRef.current.patternMatchSum += vowelDetails.patternMatchPct;
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
    localStorage.removeItem("step3_data"); // ✅ 초기화

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis)
        window.speechSynthesis.cancel();
    };
  }, []);

  const speakWord = useCallback((text: string) => {
    if (typeof window === "undefined") return;
    setIsSpeaking(true);
    setCanAnswer(false);
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.85;
    const koVoice = synth
      .getVoices()
      .find((v) => v.lang?.toLowerCase().startsWith("ko"));
    if (koVoice) utterance.voice = koVoice;
    utterance.onend = () => {
      setIsSpeaking(false);
      setCanAnswer(true);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCanAnswer(true);
    };
    synth.speak(utterance);
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
    playCount < 1 && !isSpeaking && !isAnswered && canAnswer && !isPreloadingImages;

  const handleOptionClick = (id: string) => {
    if (!canAnswer || isPreloadingImages || selectedId || isAnswered) return;
    const isCorrect = id === currentItem.answerId;
    setSelectedId(id);
    setShowResult(isCorrect);
    setIsAnswered(true);
    setCanAnswer(false);

    // ✅ 현재 문제의 결과 생성 (Result 페이지 규격)
    const currentResult = {
      text: currentItem.targetWord, // 들려준 단어
      userAnswer: id,
      isCorrect: isCorrect,
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
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.closureRateSum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.consonantDetails.closureRatePct
          ).toFixed(1),
        ),
        closureHoldMs: Number(
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.closureHoldMsSum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.consonantDetails.closureHoldMs
          ).toFixed(1),
        ),
        lipSymmetryPct: Number(
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.lipSymmetrySum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.consonantDetails.lipSymmetryPct
          ).toFixed(1),
        ),
        openingSpeedMs: Number(
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.openingSpeedMsSum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.consonantDetails.openingSpeedMs
          ).toFixed(1),
        ),
      },
      vowelDetail: {
        mouthOpeningPct: Number(
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.mouthOpeningSum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.vowelDetails.mouthOpeningPct
          ).toFixed(1),
        ),
        mouthWidthPct: Number(
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.mouthWidthSum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.vowelDetails.mouthWidthPct
          ).toFixed(1),
        ),
        roundingPct: Number(
          (
            articulationAggregateRef.current.count > 0
              ? articulationAggregateRef.current.roundingSum /
                articulationAggregateRef.current.count
              : liveArticulationRef.current.vowelDetails.roundingPct
          ).toFixed(1),
        ),
        patternMatchPct: Number(
          (
            articulationAggregateRef.current.count > 0
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
    localStorage.setItem("step3_data", JSON.stringify(updatedResults));
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
        const correctCount = updatedResults.filter((r) => r.isCorrect).length;
        const avgScore = Math.round(
          (correctCount / Math.max(1, totalQuestions)) * 100,
        );

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
            correctCount,
            totalCount: totalQuestions,
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
          });

          console.log("✅ Step 3 SessionManager 저장 완료");
        } catch (e) {
          console.error("❌ Step 3 SessionManager 저장 실패:", e);
        }

        pushStep4OrRehabResult(avgScore);
      }
    }, 1500);
  };

  const handleSkipStep = useCallback(() => {
    try {
      const randomFloat = (min: number, max: number, digits = 1) =>
        Number((Math.random() * (max - min) + min).toFixed(digits));
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const demoResults = protocol.map((item) => {
        const isCorrect = Math.random() < 0.72;
        return {
          text: item.targetWord,
          userAnswer: isCorrect ? item.answerId : "skip",
          isCorrect,
          dataSource: "demo",
          consonantAccuracy: randomFloat(58, 96),
          vowelAccuracy: randomFloat(58, 96),
          timestamp: new Date().toLocaleTimeString(),
        };
      });

      localStorage.setItem("step3_data", JSON.stringify(demoResults));

      const correctCount = demoResults.filter((item) => item.isCorrect).length;
      const totalCount = Math.max(1, demoResults.length);
      const score = Math.round((correctCount / totalCount) * 100);

      const patient = loadPatientProfile();
      const sessionManager = new SessionManager(
        (patient || { age: 70, educationYears: 12 }) as any,
        place,
      );
      sessionManager.saveStep3Result({
        items: demoResults,
        score,
        correctCount,
        totalCount,
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
      });

      pushStep4OrRehabResult(score);
    } catch (error) {
      console.error("Step3 skip failed:", error);
    }
  }, [place, protocol, pushStep4OrRehabResult]);

  if (!isMounted || !currentItem) return null;

  return (
    <div className={`flex flex-col h-full bg-[#ffffff] overflow-hidden text-slate-900 font-sans ${isRehabMode ? "rehab-accent-scope" : ""}`}>
      {/* 상단 진행 프로그레스 바 */}
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className={`h-full ${isRehabMode ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"}`}
          style={{ width: `${((currentIndex + 1) / protocol.length) * 100}%` }}
        />
      </div>
      <header className={`h-16 px-6 border-b flex justify-between items-center bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50 ${isRehabMode ? "border-sky-100" : "border-orange-100"}`}>
        <div className="flex items-center gap-4">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div>
            <span className={`font-black text-[10px] uppercase tracking-widest leading-none block ${isRehabMode ? "text-sky-500" : "text-orange-500"}`}>
              Step 03 • Visual-Auditory Association
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              단어 명명
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
          <div className={`px-4 py-1.5 rounded-full font-black text-xs border ${isRehabMode ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
            {currentIndex + 1} / {protocol.length}
          </div>
          <button
            type="button"
            onClick={handleGoHome}
            aria-label="홈으로 이동"
            title="홈"
            className={`w-9 h-9 ${trainingButtonStyles.homeIcon}`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5V21h13V9.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 21v-5h4v5" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-0 bg-[#ffffff] pb-8 lg:pb-0 overflow-y-auto">
          <div className="w-full max-w-5xl mx-auto px-6 py-4 flex flex-col h-full min-h-0 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-slate-100 pb-3 shrink-0">
              <div className="space-y-1">
                <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md ${isRehabMode ? "bg-sky-50" : "bg-orange-50"}`}>
                  <span className={`w-1 h-1 rounded-full ${isRehabMode ? "bg-sky-500" : "bg-orange-500"}`} />
                  <p className={`font-bold text-[9px] uppercase tracking-wider ${isRehabMode ? "text-sky-600" : "text-orange-600"}`}>
                    Step 03
                  </p>
                </div>
                <h1 className="text-xl lg:text-2xl font-black text-slate-800 break-keep">
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
                    replayEnabled ? (isRehabMode ? "bg-sky-500" : "bg-orange-500") : "bg-slate-300"
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
                    replayEnabled ? (isRehabMode ? "text-sky-700" : "text-orange-700") : "text-slate-400"
                  }`}
                >
                  다시 듣기
                </span>
              </button>
            </div>

            <div className="flex-1 min-h-0 flex items-start justify-start lg:items-center lg:justify-center pb-6">
              <div className="grid grid-cols-3 gap-3 lg:gap-4 w-full lg:h-full lg:max-h-[60vh]">
                {currentItem.options.map((option: VisualOption) => {
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionClick(option.id)}
                      disabled={isSpeaking || isAnswered || !canAnswer || isPreloadingImages}
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

