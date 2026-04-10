"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";
import {
  registerMediaStream,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";
import { createPreferredCameraStream } from "@/lib/media/cameraPreferences";
import { markGameModeStageCleared } from "@/lib/gameModeProgress";
import {
  getGameModeNodePayload,
  getGameModeWordHunterStageMission,
  type GameModeMemoryNodePayload,
} from "@/constants/gameModeStagePayloads";

type SortCategoryKey = "scenery" | "food" | "activity" | "other";

type SortCategory = {
  key: SortCategoryKey;
  label: string;
  tone: string;
};

type CategoryWord = {
  word: string;
  category: SortCategoryKey;
};

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };

const SORT_CATEGORIES: SortCategory[] = [
  { key: "scenery", label: "풍경", tone: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200" },
  { key: "food", label: "먹거리", tone: "border-amber-400/35 bg-amber-500/10 text-amber-200" },
  { key: "activity", label: "활동", tone: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200" },
  { key: "other", label: "기타", tone: "border-violet-400/35 bg-violet-500/10 text-violet-200" },
];

const SCENERY_KEYWORDS = [
  "바다", "해변", "야경", "노을", "강", "강변", "호수", "호반", "다리", "산", "공원",
  "숲", "광장", "거리", "골목", "전망", "일출", "해돋이", "동굴", "바위", "섬", "천", "풍경",
];

const FOOD_KEYWORDS = [
  "치킨", "국밥", "빵", "갈비", "만두", "면", "국수", "비빔밥", "김치", "탕", "전",
  "장어", "커피", "떡", "어묵", "먹거리", "음식", "특산", "밥", "한라봉", "돼지", "오리",
];

const ACTIVITY_KEYWORDS = [
  "자전거", "산책", "피크닉", "데이트", "유람선", "축제", "공연", "체험", "케이블",
  "놀이", "시장", "쇼핑", "등산", "낚시", "걷기", "드라이브", "관람", "여행", "투어",
];

const GENERIC_EXCLUSIONS = new Set([
  "명소", "서울", "인천", "부산", "경주", "대구", "전주", "광주",
  "여수", "강릉", "춘천", "안동", "제주",
]);

function normalizeWord(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, "");
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function inferCategory(word: string): SortCategoryKey {
  if (SCENERY_KEYWORDS.some((keyword) => word.includes(keyword))) return "scenery";
  if (FOOD_KEYWORDS.some((keyword) => word.includes(keyword))) return "food";
  if (ACTIVITY_KEYWORDS.some((keyword) => word.includes(keyword))) return "activity";
  return "other";
}

function buildCategoryWords(
  title: string,
  payload: GameModeMemoryNodePayload | null,
  stageId: number,
) {
  const uniqueWords = new Map<string, CategoryWord>();
  const normalizedTitle = normalizeWord(title);

  const pushWord = (rawWord: string, forcedCategory?: SortCategoryKey) => {
    const word = rawWord.trim();
    if (!word) return;
    if (normalizeWord(word) === normalizedTitle) return;
    if (GENERIC_EXCLUSIONS.has(word)) return;
    if (normalizeWord(word).length < 2) return;
    if (uniqueWords.has(word)) return;

    uniqueWords.set(word, {
      word,
      category: forcedCategory ?? inferCategory(word),
    });
  };

  payload?.previewAnswers?.forEach((word) => pushWord(word));
  payload?.answerPool?.forEach((word) => pushWord(word));

  const mission = getGameModeWordHunterStageMission(stageId);
  if (uniqueWords.size < 8 && mission?.categories?.length) {
    for (const category of mission.categories) {
      const mappedCategory: SortCategoryKey =
        category.key === "food_specialty"
          ? "food"
          : category.key === "landmark"
            ? "scenery"
            : category.key === "festival_culture"
              ? "activity"
              : "other";

      for (const word of category.words) {
        pushWord(word, mappedCategory);
        if (uniqueWords.size >= 8) break;
      }

      if (uniqueWords.size >= 8) break;
    }
  }

  return Array.from(uniqueWords.values()).slice(0, 8);
}

function findMatchedWord(transcript: string, candidates: CategoryWord[]) {
  const normalizedTranscript = normalizeWord(transcript);
  if (!normalizedTranscript) return null;

  return (
    candidates.find((candidate) => {
      const normalizedCandidate = normalizeWord(candidate.word);
      if (!normalizedCandidate) return false;

      return (
        normalizedTranscript === normalizedCandidate ||
        normalizedTranscript.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedTranscript) ||
        (Math.abs(normalizedTranscript.length - normalizedCandidate.length) <= 1 &&
          levenshtein(normalizedTranscript, normalizedCandidate) <= 1)
      );
    }) ?? null
  );
}

function ResultModal({
  sortedCount,
  totalCount,
  durationLabel,
  onHome,
}: {
  sortedCount: number;
  totalCount: number;
  durationLabel: string;
  onHome: () => void;
}) {
  const successRate = totalCount > 0 ? Math.round((sortedCount / totalCount) * 100) : 0;

  return (
    <LingoResultModalShell
      icon="🗂️"
      badgeText="Word Placement"
      title="단어 배치 완료"
      subtitle="단어를 말해서 분류 슬롯을 채웠습니다."
      headerToneClass="bg-transparent"
      iconToneClass="bg-gradient-to-br from-[#00cec9] to-[#6c5ce7]"
      badgeToneClass="text-violet-300"
      primaryButtonClass="bg-gradient-to-r from-[#111d42] to-[#6c5ce7]"
      primaryLabel="단계 선택으로"
      onPrimary={onHome}
    >
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-[28px] border border-violet-500/22 bg-[#0c0820]/85 p-5 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">성공률</span>
          <strong className="text-4xl font-black text-violet-400">{successRate}%</strong>
        </div>
        <div className="rounded-[28px] border border-violet-500/22 bg-[#0c0820]/85 p-5 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">걸린 시간</span>
          <strong className="text-4xl font-black text-white">{durationLabel}</strong>
        </div>
      </div>

      <div className="flex h-12 w-full overflow-hidden rounded-2xl border border-violet-500/20">
        <div
          className="flex items-center justify-center bg-violet-600 text-xs font-black text-white"
          style={{ width: `${successRate}%` }}
        >
          분류 성공 {sortedCount}
        </div>
        <div
          className="flex items-center justify-center bg-[#1a1435] text-xs font-black text-violet-300/60"
          style={{ width: `${100 - successRate}%` }}
        >
          남음 {Math.max(totalCount - sortedCount, 0)}
        </div>
      </div>
    </LingoResultModalShell>
  );
}

export default function CategorySortGame({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roadmapStageId = Number(searchParams.get("roadmapStage") || "0");
  const roadmapNodeId =
    searchParams.get("roadmapNode") || searchParams.get("roadmapSection") || "";
  const nodePayload = getGameModeNodePayload(roadmapStageId, roadmapNodeId);
  const memoryPayload =
    nodePayload?.gameType === "memory" ? (nodePayload.payload as GameModeMemoryNodePayload) : null;
  const landmarkTitle = nodePayload?.title ?? "명소";
  const initialWords = useMemo(
    () => buildCategoryWords(landmarkTitle, memoryPayload, roadmapStageId),
    [landmarkTitle, memoryPayload, roadmapStageId],
  );
  const gameDurationMs = 45000;
  const { volume, isMicReady, error, start: startAudioMonitor, stop: stopAudioMonitor } =
    useAudioAnalyzer();

  const [remainingWords, setRemainingWords] = useState<CategoryWord[]>(initialWords);
  const [sortedByCategory, setSortedByCategory] = useState<Record<SortCategoryKey, string[]>>({
    scenery: [],
    food: [],
    activity: [],
    other: [],
  });
  const [heardText, setHeardText] = useState("");
  const [message, setMessage] = useState("단어를 말하면 해당 분류 슬롯으로 자동 정리됩니다.");
  const [feedbackTone, setFeedbackTone] = useState<"idle" | "success" | "fail">("idle");
  const [timeLeftMs, setTimeLeftMs] = useState(gameDurationMs);
  const [gameStarted, setGameStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionFinishedAt, setSessionFinishedAt] = useState<number | null>(null);
  const [audioBars, setAudioBars] = useState(Array(16).fill(10));

  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const lockUntilRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoStartedRef = useRef(false);
  const stageMapHref =
    roadmapStageId >= 1 ? `/select-page/game-mode/stage/${roadmapStageId}` : "/select-page/game-mode";
  const stageMapReturnHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}?opened=1&focusNode=${encodeURIComponent(roadmapNodeId)}`
      : "/select-page/game-mode";
  const roadmapClearMarkedRef = useRef(false);
  const elapsedLabel = useMemo(() => {
    const startedAt = sessionStartedAt ?? Date.now();
    const finishedAt = sessionFinishedAt ?? Date.now();
    const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }, [sessionFinishedAt, sessionStartedAt]);
  const currentWord = remainingWords[0] ?? null;
  const progressRatio = initialWords.length
    ? Math.round(((initialWords.length - remainingWords.length) / initialWords.length) * 100)
    : 0;
  const timeRatio = Math.max(0, Math.min(100, Math.round((timeLeftMs / gameDurationMs) * 100)));

  const attachCameraPreview = useCallback(async () => {
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    try {
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
      }
      await video.play();
    } catch {
      // no-op
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      unregisterMediaStream(cameraStreamRef.current);
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const stream = await createPreferredCameraStream();
      cameraStreamRef.current = stream;
      registerMediaStream(stream);
      setCameraReady(true);
      setCameraError("");
      window.requestAnimationFrame(() => {
        void attachCameraPreview();
      });
    } catch {
      setCameraReady(false);
      setCameraError("카메라를 사용할 수 없습니다.");
    }
  }, [attachCameraPreview, stopCamera]);

  const stopRecognition = useCallback(() => {
    keepListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // no-op
      }
      recognitionRef.current = null;
    }
  }, []);

  const finishGame = useCallback(
    (cleared: boolean) => {
      keepListeningRef.current = false;
      setGameStarted(false);
      stopRecognition();
      stopAudioMonitor();
      stopCamera();
      setSessionFinishedAt(Date.now());
      setShowResult(true);

      if (
        cleared &&
        roadmapStageId >= 1 &&
        roadmapNodeId &&
        !roadmapClearMarkedRef.current
      ) {
        markGameModeStageCleared(roadmapStageId, roadmapNodeId, "memory");
        roadmapClearMarkedRef.current = true;
      }
    },
    [roadmapNodeId, roadmapStageId, stopAudioMonitor, stopCamera, stopRecognition],
  );

  const applyRecognizedTranscript = useCallback(
    (transcript: string) => {
      if (!gameStarted || Date.now() < lockUntilRef.current) return;
      if (!remainingWords.length) return;

      setHeardText(transcript);
      const matchedWord = findMatchedWord(transcript, remainingWords);

      if (!matchedWord) {
        setFeedbackTone("fail");
        setMessage("남아 있는 분류 단어를 또박또박 말해 주세요.");
        lockUntilRef.current = Date.now() + 700;
        window.setTimeout(() => setFeedbackTone("idle"), 520);
        return;
      }

      setRemainingWords((prev) =>
        prev.filter((entry) => normalizeWord(entry.word) !== normalizeWord(matchedWord.word)),
      );
      setSortedByCategory((prev) => ({
        ...prev,
        [matchedWord.category]: [...prev[matchedWord.category], matchedWord.word],
      }));
      const categoryLabel =
        SORT_CATEGORIES.find((category) => category.key === matchedWord.category)?.label ?? "기타";
      setFeedbackTone("success");
      setMessage(`"${matchedWord.word}" 단어가 ${categoryLabel} 슬롯으로 들어갔습니다.`);
      lockUntilRef.current = Date.now() + 700;
      window.setTimeout(() => setFeedbackTone("idle"), 520);
    },
    [gameStarted, remainingWords],
  );

  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("브라우저 음성 인식을 지원하지 않아 테스트 버튼으로 확인할 수 있습니다.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results?.[i]?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (event.results?.[i]?.isFinal) {
          applyRecognizedTranscript(transcript);
          return;
        }
      }
    };
    recognition.onerror = () => {
      setMessage("음성 인식 중 오류가 발생했습니다. 다시 말해 주세요.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!keepListeningRef.current || !gameStarted) return;
      window.setTimeout(() => {
        if (keepListeningRef.current && gameStarted) {
          startRecognition();
        }
      }, 180);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setMessage("음성 인식을 시작하지 못했습니다.");
    }
  }, [applyRecognizedTranscript, gameStarted]);

  const restart = useCallback(async () => {
    stopRecognition();
    stopAudioMonitor();
    stopCamera();
    roadmapClearMarkedRef.current = false;
    setRemainingWords(initialWords);
    setSortedByCategory({ scenery: [], food: [], activity: [], other: [] });
    setHeardText("");
    setFeedbackTone("idle");
    setMessage("단어를 말하면 해당 분류 슬롯으로 자동 정리됩니다.");
    setTimeLeftMs(gameDurationMs);
    setShowResult(false);
    setSessionStartedAt(Date.now());
    setSessionFinishedAt(null);
    setGameStarted(true);
    keepListeningRef.current = true;
    await startAudioMonitor();
    await startCamera();
    startRecognition();
  }, [initialWords, startAudioMonitor, startCamera, startRecognition, stopAudioMonitor, stopCamera, stopRecognition]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void restart();
  }, [restart]);

  useEffect(() => {
    if (!gameStarted) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeftMs((prev) => {
        const next = Math.max(0, prev - 200);
        if (next === 0) {
          window.clearInterval(timerRef.current ?? undefined);
          finishGame(false);
        }
        return next;
      });
    }, 200);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [finishGame, gameStarted]);

  useEffect(() => {
    if (!gameStarted) return;
    if (remainingWords.length === 0) {
      finishGame(true);
    }
  }, [finishGame, gameStarted, remainingWords.length]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setAudioBars((prev) =>
        prev.map((_, index) => {
          const wave = 0.55 + Math.sin(Date.now() / 180 + index * 0.6) * 0.22;
          const variance = 0.75 + (index % 5) * 0.08;
          const boosted = gameStarted ? volume * 2.8 * wave * variance + (volume > 0 ? 10 : 0) : 8;
          return Math.max(8, Math.min(100, Math.round(boosted)));
        }),
      );
    }, 90);

    return () => window.clearInterval(tick);
  }, [gameStarted, volume]);

  useEffect(() => {
    if (error) setMessage(error);
  }, [error]);

  useEffect(() => {
    return () => {
      stopRecognition();
      stopAudioMonitor();
      stopCamera();
    };
  }, [stopAudioMonitor, stopCamera, stopRecognition]);

  return (
    <LingoGameShell
      badge="Game Mode • Word Placement"
      title="단어 배치"
      onRestart={restart}
      onBack={onBack ?? (() => router.push(stageMapHref))}
      statusLabel={isMicReady ? "듣는 중" : "준비"}
      progressLabel={`${initialWords.length - remainingWords.length} / ${initialWords.length}`}
      headerActions={
        process.env.NEXT_PUBLIC_DEV_MODE === "true" ? (
          <button
            type="button"
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
            onClick={() => {
              if (currentWord) applyRecognizedTranscript(currentWord.word);
            }}
            disabled={!currentWord}
          >
            현재 단어 처리
          </button>
        ) : null
      }
      variant="gameMode"
    >
      <div className="vt-layout vt-layout-playing tetris-layout-no-left">
        <section className="vt-center">
          <div className="tetris-content-layout">
            <div className="vt-board-shell tetris-board-shell">
              <div className="vt-canvas-wrap">
                <div className="tetris-board-card-layout">
                  <div className="tetris-game-panel memory-game-panel">
                    <div className="memory-main-card relative w-full max-w-none overflow-hidden rounded-[44px] border-[3px] border-violet-500/25 bg-[#0c0820]/95 p-6 backdrop-blur-sm shadow-[0_0_40px_rgba(139,92,246,0.10)] sm:rounded-[52px] sm:p-8">
                      <div className="mb-6 flex items-center justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="shrink-0 text-sm font-black text-violet-300/60">{landmarkTitle}</span>
                          <div className="min-w-0 flex-1">
                            <div className="h-2 overflow-hidden rounded-full bg-[#1a1435] ring-1 ring-violet-500/20">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-[width] duration-300"
                                style={{ width: `${timeRatio}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="rounded-full bg-[#1a1435] px-4 py-1.5 ring-1 ring-violet-500/25">
                          <span className="text-[10px] font-black uppercase tracking-tighter text-violet-300/60">
                            남은 시간
                          </span>
                          <strong className="ml-2 text-sm font-black text-violet-300">
                            {Math.ceil(timeLeftMs / 1000)}s
                          </strong>
                        </div>
                      </div>

                      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
                        <div className="flex min-w-0 flex-col gap-4">
                          <div className="rounded-[28px] border border-violet-500/20 bg-[#0a0818]/80 px-5 py-5 sm:px-6">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-300/60">
                                  단어 배치
                                </div>
                                <p className="mt-2 text-lg font-black text-white sm:text-xl">
                                  현재 단어를 말하면 정해진 분류 슬롯으로 자동 정리됩니다.
                                </p>
                              </div>
                              <div className="rounded-full border border-violet-400/35 bg-violet-500/12 px-4 py-2 text-[11px] font-black text-violet-200">
                                풍경 · 먹거리 · 활동
                              </div>
                            </div>

                            <div
                              className={`flex min-h-[172px] items-center justify-center rounded-[28px] border-2 px-6 py-6 text-center transition-all duration-300 ${
                                feedbackTone === "success"
                                  ? "border-emerald-400/70 bg-emerald-500/18 shadow-[0_0_28px_rgba(52,211,153,0.22)]"
                                  : feedbackTone === "fail"
                                    ? "border-rose-400/70 bg-rose-500/18 shadow-[0_0_28px_rgba(244,63,94,0.20)]"
                                    : "border-violet-400/50 bg-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.18)]"
                              }`}
                            >
                              <div>
                                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200/70">
                                  제시 단어
                                </div>
                                <div className="text-5xl font-black tracking-tight text-white sm:text-6xl">
                                  {currentWord?.word ?? "완료"}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              {SORT_CATEGORIES.map((category) => (
                                <div
                                  key={category.key}
                                  className="rounded-[22px] border border-violet-500/20 bg-[#131022]/80 px-4 py-4"
                                >
                                  <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${category.tone}`}>
                                    {category.label}
                                  </div>
                                  <div className="mt-3 min-h-[92px] space-y-2">
                                    {sortedByCategory[category.key].length > 0 ? (
                                      sortedByCategory[category.key].map((word) => (
                                        <div
                                          key={`${category.key}-${word}`}
                                          className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-sm font-black text-slate-100"
                                        >
                                          {word}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="rounded-full border border-dashed border-violet-500/20 px-3 py-2 text-sm font-bold text-violet-200/45">
                                        대기 중
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex h-full min-h-0 flex-col gap-4">
                          <div className="vt-camera-frame">
                            {cameraReady ? (
                              <video
                                ref={videoRef}
                                className="vt-camera-video"
                                autoPlay
                                muted
                                playsInline
                                style={{ display: "block" }}
                              />
                            ) : (
                              <div className="vt-camera-placeholder">
                                <span>{cameraError || "카메라 대기 중"}</span>
                              </div>
                            )}
                            <div className="tetris-camera-chip">
                              <span className="tetris-camera-chip-label">안면 상태</span>
                              <strong className="tetris-camera-chip-value">{cameraReady ? "준비" : "대기"}</strong>
                            </div>
                          </div>

                          <div
                            className={`rounded-[24px] px-5 py-4 text-left shadow-xl transition-all sm:rounded-[28px] sm:px-6 sm:py-5 ${
                              feedbackTone === "success"
                                ? "bg-emerald-950/80 ring-2 ring-emerald-400/35"
                                : feedbackTone === "fail"
                                  ? "bg-rose-950/75 ring-2 ring-rose-400/35"
                                  : isMicReady
                                    ? "bg-slate-900 ring-2 ring-violet-400/30"
                                    : "bg-slate-800"
                            }`}
                          >
                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-violet-400">
                              인식된 말
                            </div>
                            <p className="truncate text-lg font-black text-white sm:text-xl">
                              {heardText || (isMicReady ? "지금 단어를 말해 주세요..." : "마이크 대기 중")}
                            </p>
                            <p className="mt-3 text-xs font-bold text-slate-300">{message}</p>
                          </div>

                          <div className="vt-audio-card">
                            <span className="vt-audio-label">음성 활성도</span>
                            <div className="vt-audio-bars">
                              {audioBars.map((bar, index) => (
                                <span key={index} className="vt-audio-bar" style={{ height: `${bar}%` }} />
                              ))}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-violet-500/20 bg-[#131022]/80 px-5 py-4">
                            <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                              <span>분류 진행도</span>
                              <span>{progressRatio}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#1a1435]">
                              <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${progressRatio}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {showResult ? (
                  <ResultModal
                    sortedCount={initialWords.length - remainingWords.length}
                    totalCount={initialWords.length}
                    durationLabel={elapsedLabel}
                    onHome={() => router.push(stageMapReturnHref)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </LingoGameShell>
  );
}
