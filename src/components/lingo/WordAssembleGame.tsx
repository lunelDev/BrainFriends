"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import {
  getGameModeNodePayload,
  type GameModeWordAssembleNodePayload,
} from "@/constants/gameModeStagePayloads";
import { markGameModeStageCleared } from "@/lib/gameModeProgress";
import { normalizeWord } from "@/lib/lingo/normalizeWord";

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };

type RoundStatus = "idle" | "success" | "fail";

const FALLBACK_STAGE: GameModeWordAssembleNodePayload = {
  previewWords: ["광안리", "바다", "다리"],
  syllables: ["광", "안", "리", "바", "다", "다", "리"],
  answers: ["광안리", "바다", "다리"],
  clearCondition: "제시된 음절을 조합해 광안리와 관련된 단어를 모두 찾기",
};

function canFormWord(word: string, syllables: string[]) {
  const pool = [...syllables];

  for (const char of Array.from(word)) {
    const index = pool.indexOf(char);
    if (index === -1) return false;
    pool.splice(index, 1);
  }

  return true;
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

function matchesAnswer(transcript: string, answers: string[]) {
  const normalizedTranscript = normalizeWord(transcript);
  if (!normalizedTranscript) return null;

  return (
    answers.find((answer) => {
      const normalizedAnswer = normalizeWord(answer);
      if (!normalizedAnswer) return false;

      return (
        normalizedTranscript === normalizedAnswer ||
        normalizedTranscript.includes(normalizedAnswer) ||
        normalizedAnswer.includes(normalizedTranscript) ||
        (Math.abs(normalizedTranscript.length - normalizedAnswer.length) <= 1 &&
          levenshtein(normalizedTranscript, normalizedAnswer) <= 1)
      );
    }) ?? null
  );
}

function ResultModal({
  foundCount,
  answerCount,
  wrongCount,
  elapsedLabel,
  onHome,
}: {
  foundCount: number;
  answerCount: number;
  wrongCount: number;
  elapsedLabel: string;
  onHome: () => void;
}) {
  const successRate = answerCount > 0 ? Math.round((foundCount / answerCount) * 100) : 0;

  return (
    <LingoResultModalShell
      icon="🔡"
      badgeText="Word Assemble"
      title="단어 조합 완료"
      subtitle="제시된 음절로 만들 수 있는 단어를 모두 찾았습니다."
      headerToneClass="bg-transparent"
      iconToneClass="bg-gradient-to-br from-[#34d399] to-[#06b6d4]"
      badgeToneClass="text-emerald-200"
      primaryButtonClass="bg-gradient-to-r from-[#06334f] to-[#10b981]"
      primaryLabel="단계 선택으로"
      onPrimary={onHome}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-[24px] border border-emerald-500/22 bg-[#07131c]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-emerald-200/60">정답률</span>
          <strong className="text-3xl font-black text-emerald-300">{successRate}%</strong>
        </div>
        <div className="rounded-[24px] border border-emerald-500/22 bg-[#07131c]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-emerald-200/60">오답</span>
          <strong className="text-3xl font-black text-white">{wrongCount}</strong>
        </div>
        <div className="rounded-[24px] border border-emerald-500/22 bg-[#07131c]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-emerald-200/60">걸린 시간</span>
          <strong className="text-3xl font-black text-white">{elapsedLabel}</strong>
        </div>
      </div>
    </LingoResultModalShell>
  );
}

export default function WordAssembleGame({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roadmapStageId = Number(searchParams.get("roadmapStage") || "0");
  const roadmapNodeId =
    searchParams.get("roadmapNode") || searchParams.get("roadmapSection") || "";
  const nodePayload = getGameModeNodePayload(roadmapStageId, roadmapNodeId);
  const assemblePayload =
    nodePayload?.gameType === "word_assemble"
      ? (nodePayload.payload as GameModeWordAssembleNodePayload)
      : FALLBACK_STAGE;

  const title = nodePayload?.title ?? "광안리";
  const syllables = useMemo(() => assemblePayload.syllables, [assemblePayload.syllables]);
  const answers = useMemo(() => assemblePayload.answers, [assemblePayload.answers]);
  const totalTimeMs = 45000;
  const stageMapHref =
    roadmapStageId >= 1 ? `/select-page/game-mode/stage/${roadmapStageId}` : "/select-page/game-mode";
  const stageMapReturnHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}?opened=1&focusNode=${encodeURIComponent(roadmapNodeId)}`
      : "/select-page/game-mode";

  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [heardText, setHeardText] = useState("");
  const [message, setMessage] = useState("제시된 음절을 조합해 만들 수 있는 단어를 말해 보세요.");
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
      answers.filter(
        (answer) =>
          !foundWords.some((found) => normalizeWord(found) === normalizeWord(answer)),
      ),
    [answers, foundWords],
  );
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
        markGameModeStageCleared(roadmapStageId, roadmapNodeId, "word_assemble");
        roadmapClearMarkedRef.current = true;
      }
    },
    [roadmapNodeId, roadmapStageId, stopRecognition],
  );

  const onRecognizedWord = useCallback(
    (transcript: string) => {
      if (!gameStarted || Date.now() < penaltyUntilRef.current) return;

      setHeardText(transcript);
      const matchedAnswer = matchesAnswer(transcript, answers);

      if (!matchedAnswer) {
        setStatus("fail");
        setWrongCount((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 10));
        setMessage("제시된 음절로 만들 수 있는 정답 단어가 아닙니다.");
        penaltyUntilRef.current = Date.now() + 700;
        window.setTimeout(() => setStatus("idle"), 400);
        return;
      }

      if (!canFormWord(matchedAnswer, syllables)) {
        setStatus("fail");
        setWrongCount((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 10));
        setMessage(`"${matchedAnswer}"은 현재 음절 조합으로 만들 수 없습니다.`);
        penaltyUntilRef.current = Date.now() + 700;
        window.setTimeout(() => setStatus("idle"), 400);
        return;
      }

      const alreadyFound = foundWords.some(
        (found) => normalizeWord(found) === normalizeWord(matchedAnswer),
      );
      if (alreadyFound) {
        setStatus("fail");
        setMessage("이미 찾은 단어입니다. 다른 조합을 말해 보세요.");
        penaltyUntilRef.current = Date.now() + 500;
        window.setTimeout(() => setStatus("idle"), 300);
        return;
      }

      setFoundWords((prev) => [...prev, matchedAnswer]);
      setStatus("success");
      setScore((prev) => prev + Math.max(15, matchedAnswer.length * 10));
      setMessage(`"${matchedAnswer}" 조합 성공`);
      window.setTimeout(() => setStatus("idle"), 300);
    },
    [answers, foundWords, gameStarted, syllables],
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
    setFoundWords([]);
    setHeardText("");
    setMessage("제시된 음절을 조합해 만들 수 있는 단어를 말해 보세요.");
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

  const progressRatio = answers.length
    ? Math.round((foundWords.length / answers.length) * 100)
    : 0;

  return (
    <LingoGameShell
      badge="Game Mode • Word Assemble"
      title="단어 조합"
      onRestart={restart}
      onBack={onBack ?? (() => router.push(stageMapHref))}
      statusLabel={status === "fail" ? "오답" : status === "success" ? "정답" : "대기"}
      progressLabel={`${foundWords.length} / ${answers.length}`}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${trainingButtonStyles.slateSoft}`}
            onClick={() => {
              const nextAnswer = remainingAnswers[0];
              if (nextAnswer) onRecognizedWord(nextAnswer);
            }}
            disabled={!remainingAnswers.length}
          >
            정답 테스트
          </button>
        </div>
      }
      variant="gameMode"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="rounded-[40px] border-[3px] border-emerald-500/25 bg-[#081319]/95 p-6 shadow-[0_0_40px_rgba(16,185,129,0.10)] sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="min-w-[220px] flex-1">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-200/60">
                명소
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
              <p className="mt-2 text-sm font-bold text-slate-300">
                {assemblePayload.clearCondition}
              </p>
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
                <span>남은 시간</span>
                <span>{Math.ceil(timeLeftMs / 1000)}s</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#14232a]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (timeLeftMs / totalTimeMs) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-[28px] border border-emerald-500/20 bg-[#0b161d]/80 p-5">
              <div
                className={`mb-5 rounded-[24px] border px-5 py-4 text-sm font-bold transition-all ${
                  status === "success"
                    ? "border-emerald-400/60 bg-emerald-500/18 text-emerald-100"
                    : status === "fail"
                      ? "border-rose-400/70 bg-rose-500/18 text-rose-100"
                      : "border-emerald-500/20 bg-emerald-500/10 text-slate-200"
                }`}
              >
                {message}
              </div>

              <div className="rounded-[24px] border border-emerald-500/20 bg-[#07131c]/85 p-5">
                <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
                  음절 조각
                </div>
                <div className="flex flex-wrap gap-3">
                  {syllables.map((syllable, index) => (
                    <div
                      key={`${syllable}-${index}`}
                      className="min-w-[64px] rounded-[18px] border border-emerald-400/25 bg-emerald-500/10 px-4 py-4 text-center text-2xl font-black text-white"
                    >
                      {syllable}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[28px] border border-emerald-500/20 bg-[#0b161d]/80 p-5">
                <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
                  <span>조합 진행도</span>
                  <span>{progressRatio}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#14232a]">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressRatio}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-[20px] border border-emerald-500/20 bg-[#07131c]/85 px-3 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
                      점수
                    </div>
                    <strong className="mt-2 block text-2xl font-black text-white">{score}</strong>
                  </div>
                  <div className="rounded-[20px] border border-emerald-500/20 bg-[#07131c]/85 px-3 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
                      오답
                    </div>
                    <strong className="mt-2 block text-2xl font-black text-white">{wrongCount}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-500/20 bg-[#0b161d]/80 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
                  찾은 단어
                </div>
                <div className="mt-3 min-h-[120px] space-y-2">
                  {foundWords.length ? (
                    foundWords.map((word) => (
                      <div
                        key={word}
                        className="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-4 py-3 text-sm font-black text-white"
                      >
                        {word}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-emerald-500/20 px-4 py-6 text-sm font-bold text-emerald-100/40">
                      아직 찾은 단어가 없습니다.
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-[20px] border border-emerald-500/20 bg-[#07131c]/85 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/60">
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
            foundCount={foundWords.length}
            answerCount={answers.length}
            wrongCount={wrongCount}
            elapsedLabel={elapsedLabel}
            onHome={() => router.push(stageMapReturnHref)}
          />
        ) : null}
      </div>
    </LingoGameShell>
  );
}
