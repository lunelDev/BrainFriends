"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { PlaceType } from "@/constants/trainingData";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { buildVersionSnapshot } from "@/lib/analysis/versioning";
import { saveTrainingExitProgress } from "@/lib/trainingExitProgress";
import { HomeExitModal } from "@/components/training/HomeExitModal";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { buildStep1TrainingData } from "@/features/steps/step1/utils";
import { logTrainingEvent } from "@/lib/client/trainingEventsApi";
import {
  cancelSpeechPlayback,
  speakKoreanText,
} from "@/lib/client/speechSynthesis";
import {
  buildStepSignature,
  isResumeMetaMatched,
  saveResumeMeta,
} from "@/lib/trainingResume";

let GLOBAL_SPEECH_LOCK: Record<number, boolean> = {};
const STEP_RESPONSE_BONUS_THRESHOLD_MS = 6000;
const STEP1_STORAGE_KEY = "step1_data";

function calculateCompositeScore(
  results: Array<{ isCorrect: boolean; responseTime: number }>,
  totalQuestions: number,
) {
  const total = Math.max(1, totalQuestions);
  const correctCount = results.filter((r) => r.isCorrect).length;
  const fastCorrectCount = results.filter(
    (r) => r.isCorrect && Number(r.responseTime) <= STEP_RESPONSE_BONUS_THRESHOLD_MS,
  ).length;
  const accuracyScore = (correctCount / total) * 100;
  const speedBonus = (fastCorrectCount / total) * 100;
  const compositeScore = Number((accuracyScore * 0.8 + speedBonus * 0.2).toFixed(1));
  return { correctCount, fastCorrectCount, accuracyScore, speedBonus, compositeScore };
}

function Step1Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeParam = (searchParams.get("place") as PlaceType) || "home";
  const { patient: sessionPatient, sessionId } = useTrainingSession();
  const isRehabMode =
    searchParams.get("trainMode") === "rehab" ||
    (typeof window !== "undefined" &&
      sessionStorage.getItem("btt.trainingMode") === "rehab");
  const rehabTargetStep = Number(searchParams.get("targetStep") || "0");
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

  useEffect(() => {
    void logTrainingEvent({
      eventType: "training_step_viewed",
      trainingType: isRehabMode ? "speech-rehab" : "self-assessment",
      stepNo: 1,
      pagePath: "/programs/step-1",
      sessionId,
      payload: {
        place: placeParam,
        isRehabMode,
        rehabTargetStep: rehabTargetStep || null,
      },
    });
  }, [isRehabMode, placeParam, rehabTargetStep]);

  const [isMounted, setIsMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [canAnswer, setCanAnswer] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [questionResults, setQuestionResults] = useState<any[]>([]);
  const [isHomeExitModalOpen, setIsHomeExitModalOpen] = useState(false);

  const pushRehabResult = useCallback(
    (step1Score: number) => {
      const params = new URLSearchParams({
        place: placeParam,
        trainMode: "rehab",
        targetStep: String(rehabTargetStep || 1),
        step1: String(step1Score),
        step2: "0",
        step3: "0",
        step4: "0",
        step5: "0",
        step6: "0",
      });
      router.push(`/result-page/speech-rehab?${params.toString()}`);
    },
    [placeParam, rehabTargetStep, router],
  );

  useEffect(() => {
    setIsMounted(true);
    GLOBAL_SPEECH_LOCK = {};

    console.group("🎯 Step 1 초기화");
    console.log("장소:", placeParam);
    console.log("초기 점수:", 0);
    console.log("총 문제 수:", 10);
    console.groupEnd();

    return () => {
      cancelSpeechPlayback();
    };
  }, [placeParam]);

  const trainingData = useMemo(() => {
    return buildStep1TrainingData(placeParam);
  }, [placeParam]);
  const stepSignature = useMemo(
    () =>
      buildStepSignature(
        "step1",
        placeParam,
        trainingData.map((item) => `${item.question}|${item.answer ? "1" : "0"}`),
      ),
    [placeParam, trainingData],
  );

  const currentItem = trainingData[currentIndex];

  useEffect(() => {
    if (typeof window === "undefined" || trainingData.length === 0) return;
    try {
      if (!isResumeMetaMatched(STEP1_STORAGE_KEY, stepSignature)) return;
      const raw = localStorage.getItem(STEP1_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      if (parsed.length >= trainingData.length) return;

      const normalized = parsed
        .map((row: any, idx: number) => {
          const fallback = trainingData[idx];
          const questionText =
            typeof row?.question === "string"
              ? row.question
              : typeof row?.text === "string"
                ? row.text
                : fallback?.question || "";
          const correctAnswer =
            typeof row?.correctAnswer === "boolean"
              ? row.correctAnswer
              : typeof fallback?.answer === "boolean"
                ? fallback.answer
                : false;
          return {
            question: questionText,
            text: questionText,
            userAnswer:
              typeof row?.userAnswer === "boolean" || row?.userAnswer === null
                ? row.userAnswer
                : null,
            isCorrect: Boolean(row?.isCorrect),
            responseTime: Number(row?.responseTime || 0),
            correctAnswer,
          };
        })
        .filter((row: any) => row.question);

      if (normalized.length === 0 || normalized.length >= trainingData.length) return;

      const resumedScore = normalized.filter((row: any) => row.isCorrect).length;
      setQuestionResults(normalized);
      setScore(resumedScore);
      setCurrentIndex(Math.min(normalized.length, trainingData.length - 1));
      console.log(`↩️ Step 1 이어하기 복원: ${normalized.length}/${trainingData.length}`);
    } catch (error) {
      console.error("Step 1 이어하기 복원 실패:", error);
    }
  }, [stepSignature, trainingData]);

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
    saveTrainingExitProgress(placeParam, 1);
    router.push("/select-page/self-assessment");
  };

  const speakWord = useCallback(
    async (text: string) => {
      console.log(`🔊 음성 출력: "${text}"`);
      setIsSpeaking(true);
      setCanAnswer(false);
      await speakKoreanText(text, { rate: 0.96 });
      setIsSpeaking(false);
      setCanAnswer(true);
      setQuestionStartTime(Date.now());
      console.log("✅ 음성 출력 완료, 답변 가능");
    },
    [currentItem],
  );

  const saveStep1Results = useCallback(
    (results: any[], finalScore: number) => {
      try {
        const sessionManager = new SessionManager(patientProfile as any, placeParam);

        // 1. ✅ Result 페이지용 백업 (text 필드 사용)
        const formattedForResult = results.map((r) => ({
          text: r.question,
          userAnswer: r.userAnswer,
          isCorrect: r.isCorrect,
          responseTime: r.responseTime,
          timestamp: new Date().toLocaleTimeString(),
        }));

        localStorage.setItem("step1_data", JSON.stringify(formattedForResult));
        saveResumeMeta(STEP1_STORAGE_KEY, stepSignature, formattedForResult.length);
        console.log("✅ Step 1 Result 페이지용 백업 저장:", formattedForResult);

        // 2. ✅ SessionManager용 데이터 (question 필드 사용)
        const formattedForSession = results.map((r) => ({
          question: r.question,
          userAnswer: r.userAnswer,
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          responseTime: r.responseTime,
        }));

        const scoring = calculateCompositeScore(results, results.length);
        const step1Data = {
          correctAnswers: scoring.correctCount,
          totalQuestions: results.length,
          averageResponseTime:
            results.reduce((a, b) => a + b.responseTime, 0) / results.length,
          score: scoring.compositeScore,
          accuracyScore: scoring.accuracyScore,
          speedBonusScore: scoring.speedBonus,
          fastCorrectCount: scoring.fastCorrectCount,
          timestamp: Date.now(),
          items: formattedForSession,
          versionSnapshot: buildVersionSnapshot("step1"),
        };

        sessionManager.saveStep1Result(step1Data);
        console.log("✅ Step 1 SessionManager 저장 완료:", step1Data);

        const verification = localStorage.getItem("kwab_training_session");
        const verifiedData = JSON.parse(verification || "{}");
        console.log("✅ 저장 검증 - step1 데이터:", verifiedData.step1);
      } catch (error) {
        console.error("❌ Step 1 저장 실패:", error);
      }
    },
    [patientProfile, placeParam, stepSignature],
  );

  const handleSkipStep = useCallback(() => {
    try {
      const randomInt = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min;
      const demoResults = trainingData.map((item) => {
        const isCorrect = Math.random() < 0.7;
        return {
          question: item.question,
          correctAnswer: item.answer,
          userAnswer: isCorrect ? item.answer : !item.answer,
          isCorrect,
          responseTime: randomInt(900, 3200),
        };
      });

      const finalScore = demoResults.filter((result) => result.isCorrect).length;
      const scoring = calculateCompositeScore(demoResults, demoResults.length);
      saveStep1Results(demoResults, finalScore);

      const sessionManager = new SessionManager(patientProfile as any, placeParam);
      sessionManager.saveStep1Result({
        correctAnswers: scoring.correctCount,
        totalQuestions: demoResults.length,
        averageResponseTime:
          demoResults.reduce((acc, curr) => acc + curr.responseTime, 0) /
          Math.max(1, demoResults.length),
        score: scoring.compositeScore,
        accuracyScore: scoring.accuracyScore,
        speedBonusScore: scoring.speedBonus,
        fastCorrectCount: scoring.fastCorrectCount,
        timestamp: Date.now(),
        items: demoResults,
        versionSnapshot: buildVersionSnapshot("step1"),
      });

      if (isRehabMode && rehabTargetStep === 1) {
        pushRehabResult(scoring.compositeScore);
      } else {
        router.push(`/programs/step-2?step1=${finalScore}&place=${placeParam}`);
      }
    } catch (error) {
      console.error("Step1 skip failed:", error);
    }
  }, [patientProfile, placeParam, router, saveStep1Results, trainingData]);

  const handleAnswer = useCallback(
    (userAnswer: boolean | null) => {
      if (isAnswered || !currentItem) return;
      setIsAnswered(true);
      setCanAnswer(false);

      const isCorrect =
        userAnswer === null ? false : currentItem.answer === userAnswer;
      const responseTime =
        userAnswer === null
          ? (currentItem.duration || 10) * 1000
          : Date.now() - questionStartTime;

      const updatedResults = [
        ...questionResults,
        {
          question: currentItem.question,
          userAnswer,
          isCorrect,
          responseTime,
          correctAnswer: currentItem.answer,
        },
      ];

      console.group(`📝 ${currentIndex + 1}번 문제 완료`);
      console.log("질문:", currentItem.question);
      console.log("정답:", currentItem.answer ? "O" : "X");
      console.log(
        "사용자 답변:",
        userAnswer === null ? "시간초과" : userAnswer ? "O" : "X",
      );
      console.log("정답 여부:", isCorrect ? "✅ 정답" : "❌ 오답");
      console.log("응답 시간:", `${(responseTime / 1000).toFixed(1)}초`);
      console.log("현재 누적 점수:", isCorrect ? score + 1 : score);
      console.groupEnd();

      setQuestionResults(updatedResults);
      if (isCorrect) setScore((s) => s + 1);
      try {
        const progressForStorage = updatedResults.map((r) => ({
          question: r.question,
          text: r.question,
          userAnswer: r.userAnswer,
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          responseTime: r.responseTime,
          timestamp: new Date().toLocaleTimeString(),
        }));
        localStorage.setItem(STEP1_STORAGE_KEY, JSON.stringify(progressForStorage));
        saveResumeMeta(STEP1_STORAGE_KEY, stepSignature, progressForStorage.length);
      } catch (error) {
        console.error("Step 1 진행 저장 실패:", error);
      }

      setTimeout(() => {
        if (currentIndex < trainingData.length - 1) {
          console.log(
            `➡️ 다음 문제 (${currentIndex + 2}/${trainingData.length})로 이동`,
          );
          setCurrentIndex((prev) => prev + 1);
          setIsAnswered(false);
          setReplayCount(0);
        } else {
          const finalScore = isCorrect ? score + 1 : score;

          console.group("🏁 Step 1 최종 완료");
          console.log("최종 점수:", finalScore);
          console.log(
            "정답률:",
            `${((finalScore / trainingData.length) * 100).toFixed(1)}%`,
          );
          console.groupEnd();

          saveStep1Results(updatedResults, finalScore);

          console.log(
            `🚀 Step 2로 이동 (step1=${finalScore}, place=${placeParam})`,
          );
          if (isRehabMode && rehabTargetStep === 1) {
            const scoring = calculateCompositeScore(
              updatedResults,
              trainingData.length,
            );
            pushRehabResult(scoring.compositeScore);
          } else {
            router.push(`/programs/step-2?step1=${finalScore}&place=${placeParam}`);
          }
        }
      }, 800);
    },
    [
      currentIndex,
      currentItem,
      score,
      trainingData.length,
      router,
      placeParam,
      isAnswered,
      questionStartTime,
      questionResults,
      saveStep1Results,
      isRehabMode,
      rehabTargetStep,
      pushRehabResult,
    ],
  );

  useEffect(() => {
    if (!isMounted || !currentItem || GLOBAL_SPEECH_LOCK[currentIndex]) return;
    GLOBAL_SPEECH_LOCK[currentIndex] = true;
    console.log(`🎬 ${currentIndex + 1}번 문제 시작`);
    setReplayCount(0);
    const timer = setTimeout(() => {
      void speakWord(currentItem.question);
    }, 800);
    return () => clearTimeout(timer);
  }, [currentIndex, isMounted, currentItem, speakWord]);

  const handleReplay = () => {
    if (replayCount < 1 && !isSpeaking && !isAnswered && canAnswer) {
      void speakWord(currentItem.question);
      setReplayCount((prev) => prev + 1);
    }
  };

  const replayEnabled =
    replayCount < 1 && !isSpeaking && !isAnswered && canAnswer;

  if (!isMounted || !currentItem) return null;

  return (
    <div
      className={`flex flex-col min-h-screen bg-[#ffffff] overflow-y-auto lg:overflow-hidden text-slate-900 font-sans ${isRehabMode ? "rehab-accent-scope" : ""}`}
    >
      {/* 상단 진행 프로그레스 바 */}
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className={`h-full ${isRehabMode ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"}`}
          style={{
            width: `${((currentIndex + 1) / trainingData.length) * 100}%`,
          }}
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
              Step 01 • Auditory Comprehension
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              청각 이해 판단 훈련
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={handleSkipStep}
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
          >
            SKIP
          </button>
          <div
            className={`px-3 py-1.5 rounded-full font-black text-[11px] transition-all border ${
              isSpeaking
                ? "bg-slate-50 border-slate-200 text-slate-400"
                : isRehabMode
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : "bg-orange-50 border-orange-200 text-orange-700"
            }`}
          >
            {isSpeaking
              ? "LISTENING..."
              : "ANSWER READY"}
          </div>
          <div
            className={`px-4 py-1.5 rounded-full font-black text-xs border ${isRehabMode ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
          >
            {currentIndex + 1} / 10
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

      <main className="flex-1 flex flex-col items-center justify-center py-6 sm:py-10 px-4 sm:px-6 overflow-y-auto">
        <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-6 sm:gap-8 lg:gap-12">
          <div className="text-center space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 break-keep leading-tight">
                {isSpeaking ? "질문을 잘 들어보세요" : "사실이 맞나요?"}
              </h1>
              <div
                className={`h-1.5 w-12 rounded-full mx-auto ${isRehabMode ? "bg-sky-500/20" : "bg-orange-500/20"}`}
              />
            </div>

            <button
              onClick={handleReplay}
              disabled={!replayEnabled}
              className={`group flex items-center gap-2 mx-auto px-5 py-2.5 rounded-2xl shadow-sm disabled:opacity-30 active:scale-95 ${
                isRehabMode
                  ? "bg-white text-sky-600 border border-sky-200 hover:bg-sky-50 transition-all"
                  : trainingButtonStyles.orangeOutline
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isRehabMode
                    ? "bg-sky-100 group-hover:bg-sky-500"
                    : "bg-orange-100 group-hover:bg-orange-500"
                }`}
              >
                <svg
                  className={`w-4 h-4 group-hover:text-white ${
                    isRehabMode ? "text-sky-600" : "text-orange-600"
                  }`}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span
                className={`text-sm font-black text-slate-600 ${
                  isRehabMode
                    ? "group-hover:text-sky-600"
                    : "group-hover:text-orange-600"
                }`}
              >
                다시 듣기
              </span>
            </button>
          </div>

          <div className="flex gap-4 sm:gap-8 lg:gap-12 w-full max-w-md shrink-0 mb-2 sm:mb-4">
            <button
              disabled={isSpeaking || isAnswered || !canAnswer}
              onClick={() => handleAnswer(true)}
              className="flex-1 aspect-square max-h-[140px] sm:max-h-[180px] bg-white rounded-[28px] sm:rounded-[40px] text-6xl sm:text-8xl shadow-[0_12px_24px_rgba(0,0,0,0.04)] border-2 border-slate-50 flex items-center justify-center transition-all hover:border-emerald-100 hover:text-emerald-500 active:scale-95 disabled:opacity-20 text-slate-300 font-black"
            >
              O
            </button>
            <button
              disabled={isSpeaking || isAnswered || !canAnswer}
              onClick={() => handleAnswer(false)}
              className={`flex-1 aspect-square max-h-[140px] sm:max-h-[180px] bg-white rounded-[28px] sm:rounded-[40px] text-6xl sm:text-8xl shadow-[0_12px_24px_rgba(0,0,0,0.04)] border-2 border-slate-50 flex items-center justify-center transition-all active:scale-95 disabled:opacity-20 text-slate-300 font-black ${
                isRehabMode
                  ? "hover:border-sky-100 hover:text-sky-500"
                  : "hover:border-orange-100 hover:text-orange-500"
              }`}
            >
              X
            </button>
          </div>
        </div>
      </main>
      <HomeExitModal
        open={isHomeExitModalOpen}
        onConfirm={confirmGoHome}
        onCancel={() => setIsHomeExitModalOpen(false)}
      />
      <div className="h-4 shrink-0" />
    </div>
  );
}

export default function Step1Page() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-orange-500 font-black">
          LOADING...
        </div>
      }
    >
      <Step1Content />
    </Suspense>
  );
}
