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
import { useRegionMissionMark } from "@/hooks/useRegionMissionMark";
import { normalizeWord } from "@/lib/lingo/normalizeWord";

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };

type RoundStatus = "idle" | "success" | "fail";

const FALLBACK_STAGE: GameModeAssociationClearNodePayload = {
  previewWords: ["한강", "야경", "치킨", "유람선"],
  // 정답 4 + 방해 4 = 8개. 4×2 grid 정확히 채우도록 정렬 우선 설계.
  words: [
    { word: "야경", isAnswer: true },
    { word: "치킨", isAnswer: true },
    { word: "자전거", isAnswer: true },
    { word: "유람선", isAnswer: true },
    { word: "비행기", isAnswer: false },
    { word: "사과", isAnswer: false },
    { word: "기차", isAnswer: false },
    { word: "지하철", isAnswer: false },
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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
  // 신규 권역/도시/미션 진행률 마킹 — KoreaMapMenu 에서 진입한 경우만 동작.
  const regionMission = useRegionMissionMark();
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

  // 게임화 상태 — 콤보 / floating 점수 효과.
  //   - comboStreak: 연속 정답 카운트. 정답 시 +1, 오답 시 0. UI/멀티플라이어용 state.
  //   - comboStreakRef: setState 비동기 우회용. onRecognizedWord 안에서 즉시 사용.
  //   - floatingScores: 정답 시 화면에 떠오르는 +점수 알림. 1.2초 후 자동 제거.
  //   - shuffleSeed: 카드 순서 셔플 트리거. 마운트 시 + restart 시 ++ 해서 새 순서.
  const [comboStreak, setComboStreak] = useState(0);
  const [floatingScores, setFloatingScores] = useState<
    { id: number; value: number; mult: number }[]
  >([]);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const comboStreakRef = useRef(0);
  const floatingIdRef = useRef(0);

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
  // 게임화 시각 — 막판 10초 위험 신호 (시간바 빨강, 메인 카드 가장자리 펄스).
  const isTimeDanger = gameStarted && timeLeftMs > 0 && timeLeftMs <= 10_000;
  // 게임화 2차 안전 모드 — 카드 회전/위치 흩뿌림은 정렬 가독성 저해 + absolute layout 이슈로
  // 폐기. grid + 카드별 부유 + 정답 시 spark/별 폭발만 사용한다.

  // 카드 표시 순서 셔플 — 정답이 항상 첫 자리에 모이지 않도록 무작위.
  //   words 배열 자체는 정답 매칭에 그대로 사용 (remainingWords 등). shuffledWords 는
  //   디스플레이 전용. shuffleSeed 가 변경될 때만 새 셔플 — restart 시 setShuffleSeed 호출.
  //   "use client" 컴포넌트라 SSR 영향 X.
  const shuffledWords = useMemo(() => {
    const arr = [...words];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, shuffleSeed]);
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
      // abort() 가 stop() 보다 강력 — 즉시 mic stream release.
      // stop() 은 마지막 결과 처리를 시도하느라 release 가 지연될 수 있어,
      // 라우트 이탈 시 마이크/녹화 LED 가 잠시 켜진 채 남는 문제 발생.
      if (typeof recognitionRef.current.abort === "function") {
        recognitionRef.current.abort();
      } else {
        recognitionRef.current.stop();
      }
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
      // 신규 권역/도시/미션 진입 경로 — 멱등 마킹.
      if (cleared) {
        regionMission.markCleared();
      }
    },
    [regionMission, roadmapNodeId, roadmapStageId, stopRecognition],
  );

  const onRecognizedWord = useCallback(
    (transcript: string) => {
      if (!gameStarted || Date.now() < penaltyUntilRef.current) return;

      setHeardText(transcript);
      const matchedAnyWord = findMatchedWord(transcript, words);
      const matchedWord = findMatchedWord(transcript, remainingWords);

      // 이미 정리한 단어 — 콤보 유지 (사용자 의도가 모호한 케이스).
      if (matchedAnyWord && !matchedWord) {
        setStatus("fail");
        setMessage("이미 정리한 단어입니다. 다른 연상 단어를 말해 주세요.");
        penaltyUntilRef.current = Date.now() + 500;
        window.setTimeout(() => setStatus("idle"), 320);
        return;
      }

      // 정답 목록에 없는 단어 — 콤보 끊김.
      if (!matchedWord) {
        setStatus("fail");
        setWrongCount((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 10));
        comboStreakRef.current = 0;
        setComboStreak(0);
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

      // 방해 단어 — 콤보 끊김.
      if (!matchedWord.isAnswer) {
        setStatus("fail");
        setWrongCount((prev) => prev + 1);
        setScore((prev) => Math.max(0, prev - 10));
        comboStreakRef.current = 0;
        setComboStreak(0);
        setMessage(`"${matchedWord.word}"은 방해 단어입니다.`);
        penaltyUntilRef.current = Date.now() + 700;
        window.setTimeout(() => setStatus("idle"), 420);
        return;
      }

      // 정답 — 콤보 +1, 멀티플라이어 ×1/×2/×3, floating 점수 효과.
      const newStreak = comboStreakRef.current + 1;
      comboStreakRef.current = newStreak;
      const mult = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1;
      const points = 25 * mult;

      setRemovedWords((prev) => [...prev, matchedWord.word]);
      setStatus("success");
      setScore((prev) => prev + points);
      setComboStreak(newStreak);

      const fid = ++floatingIdRef.current;
      setFloatingScores((prev) => [...prev, { id: fid, value: points, mult }]);
      window.setTimeout(() => {
        setFloatingScores((prev) => prev.filter((f) => f.id !== fid));
      }, 1200);

      setMessage(
        mult > 1
          ? `🔥 "${matchedWord.word}" 정답! ×${mult} 콤보!`
          : `"${matchedWord.word}" 정리 성공`,
      );
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
    // 게임화 상태 리셋.
    comboStreakRef.current = 0;
    setComboStreak(0);
    setFloatingScores([]);
    // 카드 순서 새로 셔플 (재도전 시 같은 배치 재학습 방지).
    setShuffleSeed((s) => s + 1);
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

  // 안전망 — 라우트 이탈 시 마이크/녹화 LED 즉시 꺼지도록 보장.
  // 기존 useEffect 의 cleanup 이 deps 변경 timing 으로 누락되거나, recognition.stop()
  // 호출이 늦게 stream 을 release 하는 케이스를 방어. deps=[] 라 mount/unmount 1회만.
  // ref 를 직접 잡으므로 stopRecognition 클로저 의존 X — 가장 신뢰성 높은 cleanup.
  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          if (typeof recognition.abort === "function") {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch {
          // no-op
        }
        recognitionRef.current = null;
      }
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* 게임화 keyframe — KoreaMapMenu 와 같이 컴포넌트 내부 <style> 패턴.
          외부 globals.css 오염 없이 격리. */}
      <style>{`
        /* 활성 단어 카드 — 미세하게 위아래로 부유. 인덱스별 delay 로 자연스러운 군집 호흡. */
        @keyframes acg-card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .acg-card-float {
          animation: acg-card-float 3s ease-in-out infinite;
        }
        /* 정답 적중 시 카드가 한 번 부풀었다가 작게 수축 + 발광 잔상. */
        @keyframes acg-card-clear {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(16,185,129,0); }
          40% { transform: scale(1.08); box-shadow: 0 0 26px rgba(16,185,129,0.7); }
          100% { transform: scale(0.92); box-shadow: 0 0 8px rgba(16,185,129,0.3); }
        }
        .acg-card-cleared {
          animation: acg-card-clear 0.6s ease-out forwards;
        }
        /* +점수 floating — 화면 중앙에서 위로 떠오르며 사라짐. */
        @keyframes acg-float-up {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
          18% { transform: translate(-50%, -10px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -130px) scale(1); opacity: 0; }
        }
        .acg-float-score {
          animation: acg-float-up 1.2s ease-out forwards;
        }
        /* 콤보 배지 등장/갱신 — 매 콤보마다 살짝 튀어오름 (key 변경으로 재실행). */
        @keyframes acg-combo-pop {
          0% { transform: scale(0.7); opacity: 0; }
          40% { transform: scale(1.16); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .acg-combo-pop {
          animation: acg-combo-pop 0.4s ease-out;
        }
        /* 막판 10초 — 시간바 호흡 펄스. */
        @keyframes acg-time-pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(244,63,94,0); }
          50% { box-shadow: 0 0 14px rgba(244,63,94,0.55); }
        }
        .acg-time-danger {
          animation: acg-time-pulse 0.9s ease-in-out infinite;
        }
        /* 막판 10초 — 메인 카드 가장자리 부드러운 빨강 펄스. */
        @keyframes acg-edge-flash {
          0%, 100% { box-shadow: 0 0 40px rgba(139,92,246,0.10), inset 0 0 0 rgba(244,63,94,0); }
          50% { box-shadow: 0 0 40px rgba(139,92,246,0.10), inset 0 0 50px rgba(244,63,94,0.15); }
        }
        .acg-edge-flash {
          animation: acg-edge-flash 0.9s ease-in-out infinite;
        }
        /* 게임화 2차 — 정답 폭발 파티클.
           CSS variable --tx/--ty 로 8방향 각도 inline 주입. */
        @keyframes acg-spark-fly {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0;
          }
          12% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          100% {
            transform:
              translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, 0px)))
              scale(0.2);
            opacity: 0;
          }
        }
        .acg-spark {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #6ee7b7 40%, transparent 70%);
          box-shadow: 0 0 8px rgba(110,231,183,0.9);
          animation: acg-spark-fly 0.9s ease-out forwards;
          pointer-events: none;
        }
        /* 별 모양 spark (회전하면서 멀어짐) — 콤보 시 더 화려한 4개 추가. */
        @keyframes acg-star-spin {
          0% {
            transform: translate(-50%, -50%) scale(0.4) rotate(0deg);
            opacity: 0;
          }
          15% {
            transform: translate(-50%, -50%) scale(1.4) rotate(60deg);
            opacity: 1;
          }
          100% {
            transform:
              translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, 0px)))
              scale(0.3) rotate(360deg);
            opacity: 0;
          }
        }
        .acg-star {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 14px;
          height: 14px;
          color: #fde68a;
          font-size: 14px;
          line-height: 14px;
          text-shadow: 0 0 10px rgba(253,224,71,0.9);
          animation: acg-star-spin 1.0s ease-out forwards;
          pointer-events: none;
        }
      `}</style>
      <div className="relative mx-auto max-w-[1200px]">
        <div
          className={`rounded-[40px] border-[3px] bg-[#0c0820]/95 p-6 shadow-[0_0_40px_rgba(139,92,246,0.10)] transition-colors duration-300 sm:p-8 ${
            isTimeDanger
              ? "acg-edge-flash border-rose-500/45"
              : "border-violet-500/25"
          }`}
        >
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
              <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em]">
                <span
                  className={
                    isTimeDanger ? "text-rose-300" : "text-violet-300/60"
                  }
                >
                  남은 시간
                </span>
                <span
                  className={
                    isTimeDanger ? "text-rose-200" : "text-violet-300/60"
                  }
                >
                  {Math.ceil(timeLeftMs / 1000)}s
                </span>
              </div>
              <div
                className={`h-3 overflow-hidden rounded-full bg-[#1a1435] ${
                  isTimeDanger ? "acg-time-danger" : ""
                }`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    isTimeDanger
                      ? "bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400"
                      : "bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (timeLeftMs / totalTimeMs) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* 콤보 배지 — 자리는 항상 고정 (밀림 방지). streak < 2 일 땐 opacity 0 으로
              숨기고, streak ≥ 2 일 땐 pop 애니메이션 + glow. key 를 streak 에 묶어
              콤보가 갱신될 때마다 pop 애니메이션 다시 재생. */}
          <div className="mb-4 flex h-[34px] items-center justify-center">
            <div
              key={`combo-${comboStreak}`}
              aria-hidden={comboStreak < 2}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-black transition-opacity duration-300 ${
                comboStreak >= 2
                  ? "acg-combo-pop border-amber-400/55 bg-amber-500/15 text-amber-100 opacity-100 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                  : "border-transparent bg-transparent text-transparent opacity-0"
              }`}
            >
              <span aria-hidden="true">🔥</span>
              <span>COMBO ×{comboStreak >= 5 ? 3 : 2}</span>
              <span className="text-amber-200/70 text-xs">
                ({comboStreak} 연속)
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* flex flex-col → 자식이 flex-1 로 사이드바 높이만큼 fill 가능. */}
            <section className="relative flex flex-col rounded-[28px] border border-violet-500/20 bg-[#0a0818]/80 p-5">
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

              {/* +점수 floating 오버레이 — 메인 단어 영역 중앙 상단에서 위로 떠오름. */}
              <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2">
                {floatingScores.map((f) => (
                  <div
                    key={f.id}
                    className="acg-float-score absolute left-0 top-0 whitespace-nowrap text-center"
                  >
                    <div className="text-4xl font-black text-emerald-300 [text-shadow:0_0_18px_rgba(52,211,153,0.7)]">
                      +{f.value}
                    </div>
                    {f.mult > 1 ? (
                      <div className="mt-1 text-sm font-black text-amber-300 [text-shadow:0_0_10px_rgba(251,191,36,0.6)]">
                        ×{f.mult} COMBO!
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* 게임화 2차 (정렬 우선 모드) — grid + 카드별 부유 + 정답 시 spark/별 폭발.
                  회전(rotation) 은 가독성 저해 + 카드 정렬 들쭉날쭉으로 폐기.
                  단어 8개 기준 4×2 정렬 — 모바일 2×4, sm 이상 4×2.
                  flex-1 + [grid-auto-rows:1fr] 로 section(flex-col)의 남은 공간을
                  카드 행이 균등 분산해서 박스를 꽉 채운다. */}
              <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 [grid-auto-rows:1fr]">
                {shuffledWords.map((entry, idx) => {
                  const isRemoved = removedWords.some(
                    (removed) =>
                      normalizeWord(removed) === normalizeWord(entry.word),
                  );

                  // 파티클 — 8방향 spark + 4개 노란 별 (정답 시 항상 표시).
                  const sparkCount = 8;
                  const starCount = 4;

                  return (
                    <div
                      key={entry.word}
                      className={`relative flex items-center justify-center rounded-[20px] border px-4 py-4 text-center text-lg font-black transition-all duration-500 ${
                        isRemoved
                          ? "acg-card-cleared border-emerald-400/60 bg-emerald-500/18 text-emerald-50"
                          : "acg-card-float border-violet-500/25 bg-violet-500/10 text-white shadow-[0_4px_18px_rgba(139,92,246,0.18)]"
                      }`}
                      style={
                        !isRemoved
                          ? { animationDelay: `${(idx % 7) * 0.18}s` }
                          : undefined
                      }
                    >
                      {/* 텍스트 + 클리어 ✓ — 한 줄 inline 으로 묶어 카드 가운데 정렬.
                          ✓ 를 absolute 우상단으로 두면 좁은 카드 안쪽 글자와 겹쳐 가림 발생. */}
                      <span className="inline-flex items-baseline gap-1.5">
                        <span>{entry.word}</span>
                        {isRemoved ? (
                          <span
                            className="text-base text-emerald-300 [text-shadow:0_0_8px_rgba(52,211,153,0.6)]"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        ) : null}
                      </span>

                      {/* 정답 폭발 — 카드 중심 기준 8방향 spark + 4개 별. */}
                      {isRemoved ? (
                        <span
                          className="pointer-events-none absolute left-1/2 top-1/2 z-20 block h-0 w-0"
                          aria-hidden="true"
                        >
                          {Array.from({ length: sparkCount }).map((_, i) => {
                            const angle = (i / sparkCount) * Math.PI * 2;
                            const distance = 42 + (i % 3) * 6;
                            return (
                              <span
                                key={`sp-${i}`}
                                className="acg-spark"
                                style={
                                  {
                                    "--tx": `${Math.cos(angle) * distance}px`,
                                    "--ty": `${Math.sin(angle) * distance}px`,
                                    animationDelay: `${i * 0.02}s`,
                                  } as React.CSSProperties
                                }
                              />
                            );
                          })}
                          {Array.from({ length: starCount }).map((_, i) => {
                            const angle =
                              (i / starCount) * Math.PI * 2 + Math.PI / 4;
                            const distance = 56;
                            return (
                              <span
                                key={`st-${i}`}
                                className="acg-star"
                                style={
                                  {
                                    "--tx": `${Math.cos(angle) * distance}px`,
                                    "--ty": `${Math.sin(angle) * distance}px`,
                                    animationDelay: `${0.04 + i * 0.05}s`,
                                  } as React.CSSProperties
                                }
                              >
                                ★
                              </span>
                            );
                          })}
                        </span>
                      ) : null}
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

              {/* "인식된 말" 박스 — 사용자에게 자기 발화가 STT로 어떻게 잡혔는지만 노출.
                  이전에 같이 있던 "테스트 입력" 정답/오답 단어 버튼은 의료기기 SW 로서
                  환자에게 정답을 미리 보여주는 치명 버그라 제거. dev 용 패스 버튼은 헤더의
                  "정답 테스트 / 오답 테스트" 버튼으로 충분. */}
              <div className="rounded-[28px] border border-violet-500/20 bg-[#131022]/80 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                  인식된 말
                </div>
                <div className="mt-3 min-h-[2.4em] text-lg font-black text-white">
                  {heardText || (
                    <span className="text-slate-500">아직 입력 없음</span>
                  )}
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
