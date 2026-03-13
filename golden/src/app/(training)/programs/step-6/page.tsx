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
import { WRITING_WORDS } from "@/constants/writingData";
import { HomeExitModal } from "@/components/training/HomeExitModal";
import { loadPatientProfile } from "@/lib/patientStorage";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { saveTrainingExitProgress } from "@/lib/trainingExitProgress";
import {
  dataUrlToBlob,
  uploadClinicalMedia,
} from "@/lib/client/clinicalMediaUpload";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { calculateHangulStrokeCount } from "@/lib/text/hangulStroke";
import { calculateArticulationWritingConsistency } from "@/lib/analysis/articulationAnalyzer";
import { buildVersionSnapshot } from "@/lib/analysis/versioning";
import {
  calculateShapeSimilarityPct,
  getTracingGuideFontSize,
  getResultWordSizeClass,
  isQuotaExceededError,
  toCompressedDataUrl,
} from "@/features/steps/step6/utils";
import { Step6WordImage } from "@/features/steps/step6/components/Step6WordImage";
import {
  buildStepSignature,
  isResumeMetaMatched,
  saveResumeMeta,
} from "@/lib/trainingResume";

export const dynamic = "force-dynamic";
const STEP6_STORAGE_KEY = "step6_recorded_data";
const STEP6_QUESTIONS_KEY_PREFIX = "step6_questions";

const RESULT_PRAISES = [
  "좋아요, 정답입니다!",
  "정확해요! 잘하셨어요.",
  "아주 좋아요!",
  "훌륭해요, 정답입니다.",
  "좋습니다. 정확하게 작성했어요.",
] as const;

function Step6Content() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const place = (searchParams.get("place") as PlaceType) || "home";
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
    saveTrainingExitProgress(place, 6);
    router.push("/select-page/self-assessment");
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stepParams = useMemo(
    () => ({
      step1: searchParams.get("step1") || "0",
      step2: searchParams.get("step2") || "0",
      step3: searchParams.get("step3") || "0",
      step4: searchParams.get("step4") || "0",
      step5: searchParams.get("step5") || "0",
    }),
    [searchParams],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"writing" | "review">("writing");
  const [isMounted, setIsMounted] = useState(false);
  const [showHintText, setShowHintText] = useState(false);
  const [showTracingGuide, setShowTracingGuide] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [userStrokeCount, setUserStrokeCount] = useState(0);
  const [writingImages, setWritingImages] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [praiseMessage, setPraiseMessage] = useState<string>(RESULT_PRAISES[0]);
  const [isHomeExitModalOpen, setIsHomeExitModalOpen] = useState(false);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);
  const [inlineGuideText, setInlineGuideText] = useState(
    "한획한획 또박또박 쓰세요.",
  );
  const [isGuideSparkle, setIsGuideSparkle] = useState(false);
  const guideSparkleTimerRef = useRef<number | null>(null);

  const questions = useMemo(
    () => {
      const buildQuestions = () =>
        [...(WRITING_WORDS[place] || WRITING_WORDS.home)]
          .sort(() => Math.random() - 0.5)
          .slice(0, 5);
      if (typeof window === "undefined") return buildQuestions();

      const questionsStorageKey = `${STEP6_QUESTIONS_KEY_PREFIX}:${place}`;
      try {
        const raw = sessionStorage.getItem(questionsStorageKey);
        const parsed = raw ? JSON.parse(raw) : null;
        const isValid =
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every(
            (item) =>
              item &&
              typeof item.answer === "string" &&
              typeof item.hint === "string",
          );
        if (isValid) return parsed;
      } catch {
        // ignore and rebuild
      }

      const nextQuestions = buildQuestions();
      try {
        sessionStorage.setItem(questionsStorageKey, JSON.stringify(nextQuestions));
      } catch {
        // ignore
      }
      return nextQuestions;
    },
    [place],
  );
  const stepSignature = useMemo(
    () =>
      buildStepSignature(
        "step6",
        place,
        questions.map((item) => `${item.answer}|${item.hint}`),
      ),
    [place, questions],
  );
  const currentWord = questions[currentIndex];
  const getExpectedStrokeCount = useCallback(
    (word: { answer: string; strokes: number }) => {
      const calculated = calculateHangulStrokeCount(word.answer);
      return calculated > 0 ? calculated : word.strokes;
    },
    [],
  );
  const expectedStrokes = useMemo(
    () =>
      currentWord
        ? getExpectedStrokeCount({
            answer: currentWord.answer,
            strokes: currentWord.strokes,
          })
        : 0,
    [currentWord, getExpectedStrokeCount],
  );
  const articulationBaseline = useMemo(() => {
    if (typeof window === "undefined") {
      return { consonant: 0, vowel: 0 };
    }
    try {
      const rawSession = localStorage.getItem("kwab_training_session");
      const existingSession = rawSession ? JSON.parse(rawSession) : null;
      const patientData = existingSession?.patient ||
        loadPatientProfile() || { name: "user" };
      const sm = new SessionManager(patientData as any, place);
      const session = sm.getSession();
      const consonant =
        Number(session.step5?.averageConsonantAccuracy) ||
        Number(
          session.step4?.items?.length
            ? session.step4.items.reduce(
                (sum, row) =>
                  sum + Number((row as any)?.consonantAccuracy ?? 0),
                0,
              ) / session.step4.items.length
            : 0,
        ) ||
        0;
      const vowel =
        Number(session.step5?.averageVowelAccuracy) ||
        Number(
          session.step4?.items?.length
            ? session.step4.items.reduce(
                (sum, row) => sum + Number((row as any)?.vowelAccuracy ?? 0),
                0,
              ) / session.step4.items.length
            : 0,
        ) ||
        0;
      return {
        consonant: Math.max(0, Math.min(100, consonant)),
        vowel: Math.max(0, Math.min(100, vowel)),
      };
    } catch {
      return { consonant: 0, vowel: 0 };
    }
  }, [place]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || questions.length === 0) return;
    try {
      if (!isResumeMetaMatched(STEP6_STORAGE_KEY, stepSignature)) return;
      const raw = localStorage.getItem(STEP6_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const byIndex = new Map<number, any>();
      parsed.slice(-questions.length).forEach((row: any, fallbackIndex: number) => {
        const resolvedIndex = Number.isFinite(Number(row?.index))
          ? Number(row.index)
          : fallbackIndex;
        if (resolvedIndex < 0 || resolvedIndex >= questions.length) return;
        byIndex.set(resolvedIndex, row);
      });
      const restored = Array.from(byIndex.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]);
      if (restored.length >= questions.length) return;

      const questionWords = new Set(questions.map((q) => String(q?.answer || "")));
      const looksSameSession = restored.every((row: any) =>
        questionWords.has(String(row?.text || "")),
      );
      if (!looksSameSession) return;

      const imageMap = new Map<number, string>();
      restored.forEach((row: any, fallbackIndex: number) => {
        const resolvedIndex = Number.isFinite(Number(row?.index))
          ? Number(row.index)
          : fallbackIndex;
        if (
          Number.isFinite(resolvedIndex) &&
          resolvedIndex >= 0 &&
          typeof row?.userImage === "string"
        ) {
          imageMap.set(resolvedIndex, row.userImage);
        }
      });

      setWritingImages(questions.map((_, idx) => imageMap.get(idx) || ""));
      setCorrectCount(restored.filter((row: any) => Boolean(row?.isCorrect)).length);
      setCurrentIndex(Math.min(restored.length, questions.length - 1));
      setPhase("writing");
      console.log(`↩️ Step 6 이어하기 복원: ${restored.length}/${questions.length}`);
    } catch (error) {
      console.error("Step 6 이어하기 복원 실패:", error);
    }
  }, [questions, stepSignature]);

  useEffect(() => {
    return () => {
      if (guideSparkleTimerRef.current !== null) {
        window.clearTimeout(guideSparkleTimerRef.current);
      }
    };
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 18;
      ctx.strokeStyle = "#1E293B";

      if (showTracingGuide && currentWord) {
        const fontSize = getTracingGuideFontSize(
          currentWord.answer,
          canvas.width,
          canvas.height,
        );
        ctx.font = `900 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
        ctx.fillText(currentWord.answer, canvas.width / 2, canvas.height / 2);
      }
    }
    setUserStrokeCount(0);
  }, [showTracingGuide, currentWord]);

  useEffect(() => {
    if (phase === "writing" && isMounted) {
      const timer = setTimeout(initCanvas, 150);
      return () => clearTimeout(timer);
    }
  }, [phase, isMounted, initCanvas, showTracingGuide, currentIndex]);

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = canvasRef.current!.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = canvasRef.current!.getContext("2d");
    ctx?.lineTo(x, y);
    ctx?.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setUserStrokeCount((prev) => prev + 1);
      setIsDrawing(false);
    }
  };

  const checkAnswer = () => {
    if (!currentWord) return;
    const strokeError = Math.abs(userStrokeCount - expectedStrokes);
    const isStrokeCorrect = strokeError <= 5;
    const canvas = canvasRef.current;
    const shapeSimilarityPct = canvas
      ? calculateShapeSimilarityPct(canvas, currentWord.answer)
      : 0;
    const isShapeCorrect = shapeSimilarityPct >= 36;
    const isFinalCorrect =
      userStrokeCount > 0 && isStrokeCorrect && isShapeCorrect;

    if (isFinalCorrect) {
      setInlineGuideText("한획한획 또박또박 쓰세요.");
      setIsGuideSparkle(false);
      if (guideSparkleTimerRef.current !== null) {
        window.clearTimeout(guideSparkleTimerRef.current);
        guideSparkleTimerRef.current = null;
      }
      const imageData = canvas ? toCompressedDataUrl(canvas) : "";
      const strokeScore = Math.max(
        0,
        Math.min(100, 100 - (strokeError / Math.max(1, expectedStrokes)) * 100),
      );
      const writingScore = Number(
        (strokeScore * 0.65 + shapeSimilarityPct * 0.35).toFixed(1),
      );
      const articulationWritingConsistency =
        calculateArticulationWritingConsistency({
          targetText: currentWord.answer,
          consonantAccuracy: articulationBaseline.consonant,
          vowelAccuracy: articulationBaseline.vowel,
          writingScore,
        }).score;

      // 1) 누적 이미지 업데이트
      const updatedImages = [...writingImages, imageData];
      setWritingImages(updatedImages);

      // 2) Result 페이지 localStorage 저장
      const existingData = JSON.parse(
        localStorage.getItem(STEP6_STORAGE_KEY) || "[]",
      );

      const newEntry = {
        index: currentIndex,
        text: currentWord.answer,
        userImage: imageData,
        isCorrect: true,
        expectedStrokes,
        userStrokes: userStrokeCount,
        shapeSimilarityPct,
        writingScore,
        articulationWritingConsistency: Number(
          articulationWritingConsistency.toFixed(1),
        ),
        timestamp: new Date().toLocaleTimeString(),
      };

      const maxItems = Math.max(5, questions.length || 5);
      const byIndex = new Map<number, any>();
      if (Array.isArray(existingData)) {
        existingData.slice(-questions.length).forEach((row: any, fallbackIndex: number) => {
          const resolvedIndex = Number.isFinite(Number(row?.index))
            ? Number(row.index)
            : fallbackIndex;
          if (resolvedIndex < 0 || resolvedIndex >= questions.length) return;
          byIndex.set(resolvedIndex, row);
        });
      }
      byIndex.set(currentIndex, newEntry);
      let candidate = Array.from(byIndex.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1])
        .slice(0, maxItems);
      let saved = false;
      while (!saved) {
        try {
          localStorage.setItem(STEP6_STORAGE_KEY, JSON.stringify(candidate));
          saveResumeMeta(STEP6_STORAGE_KEY, stepSignature, candidate.length);
          saved = true;
        } catch (saveError) {
          if (!isQuotaExceededError(saveError)) throw saveError;
          if (candidate.length <= 1) {
            // 이미지 제거 후 마지막 메타데이터라도 저장
            candidate = [{ ...newEntry, userImage: "" }];
          } else {
            candidate = candidate.slice(1);
          }
        }
      }

      console.log("Step 6 데이터 저장", newEntry);
      const patient = loadPatientProfile();
      if (patient && imageData) {
        dataUrlToBlob(imageData)
          .then((imageBlob) =>
            uploadClinicalMedia({
              patient,
              sourceSessionKey: patient.sessionId,
              trainingType: clinicalTrainingType,
              stepNo: 6,
              mediaType: "image",
              captureRole: "step6-image",
              labelSegment: currentWord.answer,
              blob: imageBlob,
              fileExtension: "jpg",
            }),
          )
          .catch((uploadError) => {
            console.error("[Step6] failed to upload clinical image", uploadError);
          });
      }

      setCorrectCount((prev) => prev + 1);
      setPraiseMessage(
        RESULT_PRAISES[Math.floor(Math.random() * RESULT_PRAISES.length)],
      );
      setPhase("review");
    } else {
      setInlineGuideText(
        `한획한획 또박또박 쓰세요. (획수 ${userStrokeCount}/${expectedStrokes}, 형태 ${shapeSimilarityPct.toFixed(1)}%)`,
      );
      setIsGuideSparkle(false);
      window.requestAnimationFrame(() => setIsGuideSparkle(true));
      if (guideSparkleTimerRef.current !== null) {
        window.clearTimeout(guideSparkleTimerRef.current);
      }
      guideSparkleTimerRef.current = window.setTimeout(() => {
        setIsGuideSparkle(false);
      }, 2200);
      initCanvas();
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((c) => c + 1);
      setPhase("writing");
      setShowHintText(false);
      setShowTracingGuide(false);
    } else {
      let step6QualityScore = 0;
      // SessionManager 통합 저장
      try {
        const rawSession = localStorage.getItem("kwab_training_session");
        const existingSession = rawSession ? JSON.parse(rawSession) : null;
        const patientData = existingSession?.patient ||
          loadPatientProfile() || { name: "user" };
        const sm = new SessionManager(patientData as any, place);
        const recordedRows = JSON.parse(
          localStorage.getItem(STEP6_STORAGE_KEY) || "[]",
        );
        const consistencyByWord = new Map<string, number>();
        const userStrokesByWord = new Map<string, number>();
        const correctnessByWord = new Map<string, boolean>();
        const shapeSimilarityByWord = new Map<string, number>();
        const writingScoreByWord = new Map<string, number>();
        if (Array.isArray(recordedRows)) {
          recordedRows.forEach((row: any) => {
            if (!row?.text) return;
            consistencyByWord.set(
              String(row.text),
              Number(row?.articulationWritingConsistency ?? 0),
            );
            userStrokesByWord.set(String(row.text), Number(row?.userStrokes ?? 0));
            correctnessByWord.set(String(row.text), Boolean(row?.isCorrect));
            shapeSimilarityByWord.set(
              String(row.text),
              Number(row?.shapeSimilarityPct ?? 0),
            );
            writingScoreByWord.set(
              String(row.text),
              Number(row?.writingScore ?? 0),
            );
          });
        }

        const scoreRows = Array.isArray(recordedRows) ? recordedRows : [];
        const avgWritingScore = scoreRows.length
          ? scoreRows.reduce(
              (sum, row) => sum + Number(row?.writingScore ?? 0),
              0,
            ) / scoreRows.length
          : 0;
        const avgConsistency = scoreRows.length
          ? scoreRows.reduce(
              (sum, row) =>
                sum + Number(row?.articulationWritingConsistency ?? 0),
              0,
            ) / scoreRows.length
          : 0;
        step6QualityScore = Number(
          Math.max(
            0,
            Math.min(100, avgWritingScore * 0.8 + avgConsistency * 0.2),
          ).toFixed(1),
        );

        sm.saveStep6Result(
          {
          completedTasks: correctCount,
          totalTasks: questions.length,
          accuracy: step6QualityScore,
          timestamp: Date.now(),
          items: questions.map((word, idx) => ({
            word: word.answer,
            expectedStrokes: getExpectedStrokeCount({
              answer: word.answer,
              strokes: word.strokes,
            }),
            userStrokes: userStrokesByWord.get(word.answer) ?? 0,
            isCorrect: correctnessByWord.get(word.answer) ?? false,
            shapeSimilarityPct: shapeSimilarityByWord.get(word.answer) ?? 0,
            writingScore: writingScoreByWord.get(word.answer) ?? 0,
            userImage: writingImages[idx] || "",
            articulationWritingConsistency:
              consistencyByWord.get(word.answer) ?? 0,
          })),
          versionSnapshot: buildVersionSnapshot("step6"),
          },
          isRehabMode && rehabTargetStep === 6 ? "rehab" : "self",
        );

        console.log("Step 6 SessionManager 저장 완료");
      } catch (error) {
        console.error("SessionManager 저장 실패:", error);
        step6QualityScore = Number(
          ((correctCount / Math.max(1, questions.length)) * 100).toFixed(1),
        );
      }

      const params = new URLSearchParams({
        place,
        ...stepParams,
        step6: isRehabMode && rehabTargetStep === 6
          ? step6QualityScore.toString()
          : step6QualityScore.toString(),
      });
      const isRehabStep6 = isRehabMode && rehabTargetStep === 6;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${STEP6_QUESTIONS_KEY_PREFIX}:${place}`);
      }
      if (isRehabStep6) {
        params.set("trainMode", "rehab");
        params.set("targetStep", "6");
      }
      router.push(
        `${isRehabStep6 ? "/result-page/speech-rehab" : "/result-page/self-assessment"}?${params.toString()}`,
      );
    }
  };

  const handleSkipStep = useCallback(() => {
    try {
      const randomFloat = (min: number, max: number, digits = 1) =>
        Number((Math.random() * (max - min) + min).toFixed(digits));
      const demoItems = questions.map((word, index) => {
        const expectedStrokes = getExpectedStrokeCount({
          answer: word.answer,
          strokes: word.strokes,
        });
        const strokeOffset = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
        const userStrokes = Math.max(1, expectedStrokes + strokeOffset);
        const writingScore = randomFloat(60, 96, 0);
        return {
          index,
          text: word.answer,
          userImage: "",
          isCorrect: Math.random() < 0.72,
          expectedStrokes,
          userStrokes,
          shapeSimilarityPct: randomFloat(55, 95),
          writingScore,
          articulationWritingConsistency: Number(
            calculateArticulationWritingConsistency({
              targetText: word.answer,
              consonantAccuracy: articulationBaseline.consonant,
              vowelAccuracy: articulationBaseline.vowel,
              writingScore,
            }).score.toFixed(1),
          ),
          timestamp: new Date().toLocaleTimeString(),
        };
      });

      localStorage.setItem(STEP6_STORAGE_KEY, JSON.stringify(demoItems));
      saveResumeMeta(STEP6_STORAGE_KEY, stepSignature, demoItems.length);

      const rawSession = localStorage.getItem("kwab_training_session");
      const existingSession = rawSession ? JSON.parse(rawSession) : null;
      const patientData = existingSession?.patient ||
        loadPatientProfile() || { name: "user" };
      const sessionManager = new SessionManager(patientData as any, place);
      const step6Accuracy = Number(
        (
          demoItems.reduce((sum, item) => sum + Number(item.writingScore || 0), 0) /
          Math.max(1, demoItems.length)
        ).toFixed(1),
      );
      sessionManager.saveStep6Result(
        {
        completedTasks: demoItems.length,
        totalTasks: questions.length,
        accuracy: step6Accuracy,
        timestamp: Date.now(),
        items: demoItems.map((item) => ({
          word: item.text,
          expectedStrokes: Number(item.expectedStrokes || 0),
          userStrokes: Number(item.userStrokes || 0),
          isCorrect: Boolean(item.isCorrect),
          shapeSimilarityPct: Number(item.shapeSimilarityPct || 0),
          writingScore: Number(item.writingScore || 0),
          userImage: item.userImage || "",
          articulationWritingConsistency: Number(
            item.articulationWritingConsistency || 0,
          ),
        })),
        versionSnapshot: buildVersionSnapshot("step6"),
        },
        isRehabMode && rehabTargetStep === 6 ? "rehab" : "self",
      );

      const params = new URLSearchParams({
        place,
        ...stepParams,
        step6: String(step6Accuracy),
      });
      const isRehabStep6 = isRehabMode && rehabTargetStep === 6;
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`${STEP6_QUESTIONS_KEY_PREFIX}:${place}`);
      }
      if (isRehabStep6) {
        params.set("trainMode", "rehab");
        params.set("targetStep", "6");
      }
      router.push(
        `${isRehabStep6 ? "/result-page/speech-rehab" : "/result-page/self-assessment"}?${params.toString()}`,
      );
    } catch (error) {
      console.error("Step6 skip failed:", error);
    }
  }, [
    articulationBaseline.consonant,
    articulationBaseline.vowel,
    getExpectedStrokeCount,
    place,
    questions,
    router,
    stepParams,
    isRehabMode,
    rehabTargetStep,
    stepSignature,
  ]);

  if (!isMounted || !currentWord) return null;

  return (
    <div className={`flex flex-col min-h-screen bg-slate-50 overflow-y-auto lg:overflow-hidden text-slate-900 font-sans ${isRehabMode ? "rehab-accent-scope" : ""}`}>
      {/* 상단 진행 바 */}
      <div className="fixed top-0 left-0 w-full h-1 z-[60] bg-slate-100">
        <div
          className={`h-full ${isRehabMode ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]" : "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.45)]"}`}
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>
      <header className={`min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50 ${isRehabMode ? "border-sky-100" : "border-orange-100"}`}>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div>
            <span className={`font-black text-[10px] uppercase tracking-widest leading-none block ${isRehabMode ? "text-sky-500" : "text-orange-500"}`}>
              Step 06 · Writing
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              단어 쓰기 훈련
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
          <div className={`px-4 py-1.5 rounded-full font-black text-xs border ${isRehabMode ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
            {currentIndex + 1} / {questions.length}
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

      <div className="flex flex-1 flex-col min-h-0 overflow-y-auto lg:overflow-hidden">
        <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] lg:min-h-0 relative p-3 sm:p-6 order-1 pb-28 lg:pb-10">
          {phase === "writing" ? (
            <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6">
              <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 order-1">
                <div className="flex-1 bg-white rounded-[28px] p-6 flex flex-col items-center justify-center text-center shadow-sm border border-orange-100">
                  <div className="lg:hidden w-full flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Step6WordImage
                        place={place}
                        answer={currentWord.answer}
                        className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 inline-flex items-center justify-center shrink-0 overflow-hidden"
                        imgClassName="w-11 h-11 object-contain"
                        onClick={() => setIsImageZoomOpen(true)}
                        zoomLabel="물건 이미지 크게 보기"
                      />
                      <p className="text-xs sm:text-sm font-black text-slate-800 leading-snug break-keep">
                        {showHintText ? currentWord.hint : "이것은 무엇일까요?"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
                      <button
                        onClick={() => setShowHintText((prev) => !prev)}
                        className={`px-2.5 py-2 rounded-xl font-black text-[11px] ${showHintText ? accentSolid : accentOutline}`}
                      >
                        {showHintText ? "힌트 닫기" : "힌트 보기"}
                      </button>
                      <button
                        onClick={() => setShowTracingGuide((prev) => !prev)}
                        className={`px-2.5 py-2 rounded-xl font-black text-[11px] ${showTracingGuide ? trainingButtonStyles.navyPrimary : trainingButtonStyles.slateOutline}`}
                      >
                        {showTracingGuide ? "따라쓰기 닫기" : "따라쓰기"}
                      </button>
                      <button
                        onClick={initCanvas}
                        className={`px-2.5 py-2 rounded-xl font-black text-[11px] ${trainingButtonStyles.slateSoft}`}
                      >
                        다시 쓰기
                      </button>
                    </div>
                  </div>

                  <Step6WordImage
                    place={place}
                    answer={currentWord.answer}
                    className="hidden lg:flex w-36 h-36 rounded-3xl bg-slate-50 border border-orange-100 mb-4 items-center justify-center overflow-hidden"
                    imgClassName="w-28 h-28 object-contain"
                    onClick={() => setIsImageZoomOpen(true)}
                    zoomLabel="물건 이미지 크게 보기"
                  />
                  <p className="hidden lg:block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">
                    Target Object
                  </p>
                  <h3 className="hidden lg:block text-2xl font-black text-slate-800 break-keep">
                    {showHintText ? currentWord.hint : "이것은 무엇일까요?"}
                  </h3>
                </div>
                <div className="hidden lg:grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setShowHintText((prev) => !prev)}
                    className={`py-4 rounded-2xl font-black text-sm ${showHintText ? accentSolid : accentOutline}`}
                  >
                    {showHintText ? "힌트 닫기" : "힌트 보기"}
                  </button>
                  <button
                    onClick={() => setShowTracingGuide((prev) => !prev)}
                    className={`py-4 rounded-2xl font-black text-sm ${showTracingGuide ? trainingButtonStyles.navyPrimary : trainingButtonStyles.slateOutline}`}
                  >
                    {showTracingGuide ? "따라쓰기 닫기" : "따라쓰기"}
                  </button>
                  <button
                    onClick={initCanvas}
                    className={`py-4 rounded-2xl font-black text-sm ${trainingButtonStyles.slateSoft}`}
                  >
                    다시 쓰기
                  </button>
                  <button
                    onClick={checkAnswer}
                    className={`py-5 rounded-2xl font-black text-lg ${trainingButtonStyles.navyPrimary}`}
                  >
                    작성 완료
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-[300px] lg:min-h-0 relative bg-white border-2 border-orange-100 rounded-[28px] lg:rounded-[36px] shadow-inner overflow-hidden order-2">
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03]">
                  <div className="w-full h-px bg-slate-900 absolute top-1/2" />
                  <div className="h-full w-px bg-slate-900 absolute left-1/2" />
                </div>
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="absolute inset-0 w-full h-full touch-none z-10 cursor-crosshair"
                />
                {!isDrawing && userStrokeCount === 0 && (
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <p className="text-slate-100 font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-[0.18em] leading-none text-center px-2">
                      Write Here
                    </p>
                  </div>
                )}
                <div
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1.5rem)] sm:w-auto sm:min-w-[420px] px-4 sm:px-6 py-2 rounded-xl bg-orange-50/95 border border-orange-100 text-orange-700 text-[11px] sm:text-xs font-bold text-center shadow-sm ${
                    isGuideSparkle ? "animate-pulse ring-2 ring-orange-300" : ""
                  }`}
                >
                  {inlineGuideText}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300">
              <div className="w-full max-w-[92vw] sm:max-w-[760px] bg-white p-6 sm:p-8 lg:p-12 rounded-[32px] lg:rounded-[48px] text-center shadow-2xl border border-orange-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-orange-500" />
                <Step6WordImage
                  place={place}
                  answer={currentWord.answer}
                  className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 mx-auto mb-4 lg:mb-6 rounded-3xl bg-slate-50 border border-orange-100 flex items-center justify-center overflow-hidden"
                  imgClassName="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-contain"
                  onClick={() => setIsImageZoomOpen(true)}
                  zoomLabel="臾쇨굔 ?대?吏 ?ш쾶 蹂닿린"
                />
                <h4
                  className={`${getResultWordSizeClass(currentWord.answer)} font-black text-slate-800 tracking-tight mb-3 lg:mb-4 whitespace-nowrap overflow-hidden text-ellipsis`}
                >
                  {currentWord.answer}
                </h4>
                <p className="text-orange-500 font-black text-sm uppercase tracking-widest">
                  {praiseMessage}
                </p>
              </div>
              <button
                onClick={handleNext}
                className={`mt-8 lg:mt-10 px-10 lg:px-20 py-4 lg:py-6 rounded-3xl font-black text-xl lg:text-2xl hover:scale-[1.02] ${trainingButtonStyles.navyPrimary}`}
              >
                {currentIndex < questions.length - 1
                  ? "다음 문제"
                  : "결과 확인하기"}
              </button>
            </div>
          )}

          {phase === "writing" && (
            <div
              className="lg:hidden fixed left-4 right-4 z-40 space-y-2 pb-[max(env(safe-area-inset-bottom),0px)]"
              style={{ bottom: "9.25rem" }}
            >
              <button
                onClick={checkAnswer}
                className={`w-full py-4 rounded-2xl font-black text-base ${trainingButtonStyles.navyPrimary}`}
              >
                작성 완료
              </button>
            </div>
          )}
        </main>
      </div>
      {isImageZoomOpen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsImageZoomOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대 보기"
        >
          <button
            type="button"
            onClick={() => setIsImageZoomOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-slate-700 font-black"
            aria-label="확대 이미지 닫기"
          >
            X
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <Step6WordImage
              place={place}
              answer={currentWord.answer}
              className="w-[78vw] h-[78vw] max-w-[520px] max-h-[520px] rounded-[28px] bg-white border border-orange-100 shadow-2xl flex items-center justify-center overflow-hidden"
              imgClassName="w-[66vw] h-[66vw] max-w-[420px] max-h-[420px] object-contain"
            />
          </div>
        </div>
      )}
      <HomeExitModal
        open={isHomeExitModalOpen}
        onConfirm={confirmGoHome}
        onCancel={() => setIsHomeExitModalOpen(false)}
      />
    </div>
  );
}

export default function Step6Page() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center font-black text-slate-200 uppercase tracking-widest">
          Loading Step 06...
        </div>
      }
    >
      <Step6Content />
    </Suspense>
  );
}
