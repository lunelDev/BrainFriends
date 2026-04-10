"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import {
  getGameModeNodePayload,
  type AssociationWord,
  type GameModeAssociationClearNodePayload,
} from "@/constants/gameModeStagePayloads";
import { markGameModeStageCleared } from "@/lib/gameModeProgress";
import { normalizeWord } from "@/lib/lingo/normalizeWord";

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };

type RoundStatus = "idle" | "success" | "fail";

const FALLBACK_STAGE: GameModeAssociationClearNodePayload = {
  previewWords: ["한강", "야경", "치킨", "유람선"],
  words: [
    { word: "야경", isAnswer: true },
    { word: "치킨", isAnswer: true },
    { word: "자전거", isAnswer: true },
    { word: "유람선", isAnswer: true },
    { word: "비행기", isAnswer: false },
    { word: "사과", isAnswer: false },
    { word: "기차", isAnswer: false },
  ],
  clearCondition: "명소를 보면 떠오르는 연상 단어만 모두 정리하기",
};

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

function findMatchedWord(transcript: string, words: AssociationWord[]) {
  const normalizedTranscript = normalizeWord(transcript);
  if (!normalizedTranscript) return null;

  return (
    words.find((candidate) => {
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
  clearedCount,
  answerCount,
  wrongCount,
  elapsedLabel,
  onHome,
}: {
  clearedCount: number;
  answerCount: number;
  wrongCount: number;
  elapsedLabel: string;
  onHome: () => void;
}) {
  const successRate = answerCount > 0 ? Math.round((clearedCount / answerCount) * 100) : 0;

  return (
    <LingoResultModalShell
      icon="🧹"
      badgeText="Association Match"
      title="연상 매칭 완료"
      subtitle="명소와 관련된 단어만 골라 정리했습니다."
      headerToneClass="bg-transparent"
      iconToneClass="bg-gradient-to-br from-[#74b9ff] to-[#6c5ce7]"
      badgeToneClass="text-violet-300"
      primaryButtonClass="bg-gradient-to-r from-[#111d42] to-[#6c5ce7]"
      primaryLabel="단계 선택으로"
      onPrimary={onHome}
    >
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-[24px] border border-violet-500/22 bg-[#0c0820]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">정리율</span>
          <strong className="text-3xl font-black text-violet-300">{successRate}%</strong>
        </div>
        <div className="rounded-[24px] border border-violet-500/22 bg-[#0c0820]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">오답</span>
          <strong className="text-3xl font-black text-white">{wrongCount}</strong>
        </div>
        <div className="rounded-[24px] border border-violet-500/22 bg-[#0c0820]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">걸린 시간</span>
          <strong className="text-3xl font-black text-white">{elapsedLabel}</strong>
        </div>
      </div>
    </LingoResultModalShell>
  );
}

export default function AssociationClearGame({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roadmapStageId = Number(searchParams.get("roadmapStage") || "0");
  const roadmapNodeId =
    searchParams.get("roadmapNode") || searchParams.get("roadmapSection") || "";
  const nodePayload = getGameModeNodePayload(roadmapStageId, roadmapNodeId);
  const associationPayload =
    nodePayload?.gameType === "association_clear"
      ? (nodePayload.payload as GameModeAssociationClearNodePayload)
      : FALLBACK_STAGE;

  const title = nodePayload?.title ?? "한강";
  const words = useMemo(() => associationPayload.words, [associationPayload.words]);
  const answerWords = useMemo(
    () => words.filter((word) => word.isAnswer),
    [words],
  );
  const distractorWords = useMemo(
    () => words.filter((word) => !word.isAnswer),
    [words],
  );
  const totalTimeMs = 45000;
  const stageMapHref =
    roadmapStageId >= 1 ? `/select-page/game-mode/stage/${roadmapStageId}` : "/select-page/game-mode";
  const stageMapReturnHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}?opened=1&focusNode=${encodeURIComponent(roadmapNodeId)}`
      : "/select-page/game-mode";

  const [removedWords, setRemovedWords] = useState<string[]>([]);
  const [heardText, setHeardText] = useState("");
  const [message, setMessage] = useState("명소와 관련된 단어를 말해 화면에서 정리하세요.");
  const [status, setStatus] = useState<RoundStatus>("idle");
  const [wrongCount, setWrongCount] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(totalTimeMs);
  const [gameStarted, setGameStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionFinishedAt, setSessionFinishedAt] = useState<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const autoStartedRef = useRef(false);
  const keepListeningRef = useRef(false);
  const penaltyUntilRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const roadmapClearMarkedRef = useRef(false);

  const remainingAnswers = useMemo(
    () =>
      answerWords.filter(
        (entry) => !removedWords.some((removed) => normalizeWord(removed) === normalizeWord(entry.word)),
      ),
    [answerWords, removedWords],
  );
  const remainingWords = useMemo(
    () =>
      words.filter(
        (entry) => !removedWords.some((removed) => normalizeWord(removed) === normalizeWord(entry.word)),
      ),
    [removedWords, words],
  );
  const clearedCount = answerWords.length - remainingAnswers.length;
  const progressRatio = answerWords.length
    ? Math.round((clearedCount / answerWords.length) * 100)
    : 0;
  const elapsedLabel = useMemo(() => {
    const startedAt = sessionStartedAt ?? Date.now();
    const finishedAt = sessionFinishedAt ?? Date.now();
    const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }, [sessionFinishedAt, sessionStartedAt]);

  const stopRecognition = useCallback(() => {
    keepListeningRef.current = false;
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    } catch {
      // no-op
    }
    recognitionRef.current = null;
  }, []);

  const finishGame = useCallback(
    (cleared: boolean) => {
      keepListeningRef.current = false;
      setGameStarted(false);
      stopRecognition();
      setSessionFinishedAt(Date.now());
      setShowResult(true);

      if (
        cleared &&
        roadmapStageId >= 1 &&
        roadmapNodeId &&
        !roadmapClearMarkedRef.current
      ) {
        markGameModeStageCleared(roadmapStageId, roadmapNodeId, "association_clear");
        roadmapClearMarkedRef.current = true;
      }
    },
    [roadmapNodeId, roadmapStageId, stopRecognition],
  );

  const onRecognizedWord = useCallback(
    (transcript: string) => {
      if (!gameStarted || Date.now() < penaltyUntilRef.current) return;

      setHeardText(transcript);
      const matchedAnyWord = findMatchedWord(transcript, words);
      const matchedWord = findMatchedWord(transcript, remainingWords);

      if (matchedAnyWord && !matchedWord) {
        setStatus("fail");
        setMessage("이미 정리한 단어입니다. 다른 연상 단어를 말해 주세요.");
        penaltyUntilRef.current = Date.now() + 500;
        window.setTimeout(() => setStatus("idle"), 320);
        return;
      }

      if (!matchedWord) {
        setStatus("fail");
        setWrongCount((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 10));
        setMessage("정답 목록에 없는 단어입니다. 관련 단어만 다시 말해 주세요.");
        penaltyUntilRef.current = Date.now() + 700;
        window.setTimeout(() => setStatus("idle"), 420);
        return;
      }

      const alreadyRemoved = removedWords.some(
        (removed) => normalizeWord(removed) === normalizeWord(matchedWord.word),
      );
      if (alreadyRemoved) {
        setStatus("fail");
        setMessage("이미 정리한 단어입니다. 다른 연상 단어를 말해 주세요.");
        penaltyUntilRef.current = Date.now() + 500;
        window.setTimeout(() => setStatus("idle"), 320);
        return;
      }

      if (!matchedWord.isAnswer) {
        setStatus("fail");
        setWrongCount((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 10));
        setMessage(`"${matchedWord.word}"은 방해 단어입니다.`);
        penaltyUntilRef.current = Date.now() + 700;
        window.setTimeout(() => setStatus("idle"), 420);
        return;
      }

      setRemovedWords((prev) => [...prev, matchedWord.word]);
      setStatus("success");
      setScore((prev) => prev + 25);
      setMessage(`"${matchedWord.word}" 정리 성공`);
      window.setTimeout(() => setStatus("idle"), 320);
    },
    [gameStarted, remainingWords, words],
  );

  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!Recognition) {
      setMessage("브라우저 음성 인식이 없어 아래 테스트 버튼으로 확인할 수 있습니다.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results?.[i]?.[0]?.transcript?.trim?.() ?? "";
        if (!transcript) continue;
        if (event.results?.[i]?.isFinal) {
          onRecognizedWord(transcript);
          return;
        }
      }
    };
    recognition.onerror = () => {
      setMessage("음성 인식 중 오류가 발생했습니다. 테스트 버튼으로도 확인할 수 있습니다.");
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
      setMessage("음성 인식을 시작하지 못했습니다. 테스트 버튼으로 진행할 수 있습니다.");
    }
  }, [gameStarted, onRecognizedWord]);

  const restart = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    roadmapClearMarkedRef.current = false;
    stopRecognition();
    setRemovedWords([]);
    setHeardText("");
    setMessage("명소와 관련된 단어를 말해 화면에서 정리하세요.");
    setStatus("idle");
    setWrongCount(0);
    setScore(0);
    setTimeLeftMs(totalTimeMs);
    setGameStarted(true);
    setShowResult(false);
    setSessionStartedAt(Date.now());
    setSessionFinishedAt(null);
    keepListeningRef.current = true;
    startRecognition();
  }, [startRecognition, stopRecognition]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    restart();
    return () => {
      stopRecognition();
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [restart, stopRecognition]);

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
    if (remainingAnswers.length === 0) {
      finishGame(true);
    }
  }, [finishGame, gameStarted, remainingAnswers.length]);

  return (
    <LingoGameShell
      badge="Game Mode • Association Match"
      title="연상 매칭"
      onRestart={restart}
      onBack={onBack ?? (() => router.push(stageMapHref))}
      statusLabel={status === "fail" ? "오답" : status === "success" ? "정답" : "대기"}
      progressLabel={`${clearedCount} / ${answerWords.length}`}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${trainingButtonStyles.slateSoft}`}
            onClick={() => {
              const nextAnswer = remainingAnswers[0];
              if (nextAnswer) onRecognizedWord(nextAnswer.word);
            }}
            disabled={!remainingAnswers.length}
          >
            정답 테스트
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${trainingButtonStyles.slateSoft}`}
            onClick={() => {
              const nextDistractor = distractorWords[0];
              if (nextDistractor) onRecognizedWord(nextDistractor.word);
            }}
            disabled={!distractorWords.length}
          >
            오답 테스트
          </button>
        </div>
      }
      variant="gameMode"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="rounded-[40px] border-[3px] border-violet-500/25 bg-[#0c0820]/95 p-6 shadow-[0_0_40px_rgba(139,92,246,0.10)] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="min-w-[220px] flex-1">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-300/60">
                명소
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
              <p className="mt-2 text-sm font-bold text-slate-300">
                {associationPayload.clearCondition}
              </p>
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                <span>남은 시간</span>
                <span>{Math.ceil(timeLeftMs / 1000)}s</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#1a1435]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (timeLeftMs / totalTimeMs) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-[28px] border border-violet-500/20 bg-[#0a0818]/80 p-5">
              <div
                className={`mb-5 rounded-[24px] border px-5 py-4 text-sm font-bold transition-all ${
                  status === "success"
                    ? "border-emerald-400/60 bg-emerald-500/18 text-emerald-100"
                    : status === "fail"
                      ? "border-rose-400/70 bg-rose-500/18 text-rose-100"
                      : "border-violet-500/20 bg-violet-500/10 text-slate-200"
                }`}
              >
                {message}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {words.map((entry) => {
                  const isRemoved = removedWords.some(
                    (removed) => normalizeWord(removed) === normalizeWord(entry.word),
                  );

                  return (
                    <div
                      key={entry.word}
                      className={`rounded-[20px] border px-4 py-4 text-center text-lg font-black transition-all ${
                        isRemoved
                          ? "border-slate-800 bg-slate-950/60 text-slate-600 line-through"
                          : "border-violet-500/25 bg-violet-500/10 text-white"
                      }`}
                    >
                      {entry.word}
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[28px] border border-violet-500/20 bg-[#131022]/80 p-5">
                <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                  <span>진행도</span>
                  <span>{progressRatio}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#1a1435]">
                  <div
                    className="h-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${progressRatio}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-[20px] border border-violet-500/20 bg-[#0c0820]/85 px-3 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                      점수
                    </div>
                    <strong className="mt-2 block text-2xl font-black text-white">{score}</strong>
                  </div>
                  <div className="rounded-[20px] border border-violet-500/20 bg-[#0c0820]/85 px-3 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                      오답
                    </div>
                    <strong className="mt-2 block text-2xl font-black text-white">{wrongCount}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-violet-500/20 bg-[#131022]/80 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                  테스트 입력
                </div>
                <p className="mt-2 text-sm font-bold text-slate-300">
                  실제 STT가 없어도 버튼으로 정답과 오답 판정을 확인할 수 있습니다.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {remainingAnswers.slice(0, 4).map((word) => (
                    <button
                      key={word.word}
                      type="button"
                      onClick={() => onRecognizedWord(word.word)}
                      className="rounded-full border border-emerald-400/35 bg-emerald-500/12 px-3 py-2 text-sm font-black text-emerald-200"
                    >
                      {word.word}
                    </button>
                  ))}
                  {distractorWords.slice(0, 2).map((word) => (
                    <button
                      key={word.word}
                      type="button"
                      onClick={() => onRecognizedWord(word.word)}
                      className="rounded-full border border-rose-400/35 bg-rose-500/12 px-3 py-2 text-sm font-black text-rose-200"
                    >
                      {word.word}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-[20px] border border-violet-500/20 bg-[#0c0820]/85 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                    인식된 말
                  </div>
                  <div className="mt-2 text-lg font-black text-white">
                    {heardText || "아직 입력 없음"}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {showResult ? (
          <ResultModal
            clearedCount={clearedCount}
            answerCount={answerWords.length}
            wrongCount={wrongCount}
            elapsedLabel={elapsedLabel}
            onHome={() => router.push(stageMapReturnHref)}
          />
        ) : null}
      </div>
    </LingoGameShell>
  );
}
