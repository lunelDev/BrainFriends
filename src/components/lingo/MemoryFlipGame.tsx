"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import {
  MEMORY_CARD_WORDS,
  MEMORY_CATEGORIES,
  MEMORY_DIFFICULTIES,
  type MemoryDifficultyId,
} from "@/data/memoryGameData";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";
import {
  registerMediaStream,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";
import { createPreferredCameraStream } from "@/lib/media/cameraPreferences";
import MonitoringPanelShell from "@/components/training/MonitoringPanelShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
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

const CATEGORY_VARIANTS = {
  fruit: [
    "과일",
    "과일이",
    "과일을",
    "과일로",
    "과일은",
    "과일이요",
    "과일이에요",
    "과일입니다",
    "과일이야",
    "과일요",
    "과이",
    "과릴",
  ],
  animal: [
    "동물",
    "동물이",
    "동물을",
    "동물로",
    "동물은",
    "동물이요",
    "동물이에요",
    "동물입니다",
    "동물이야",
    "동물요",
    "동무",
    "동믈",
  ],
  vehicle: [
    "탈것",
    "탈것이",
    "탈것을",
    "탈것은",
    "탈것이요",
    "탈것이에요",
    "탈것입니다",
    "탈것이야",
    "탈것요",
    "탈거",
    "탈거요",
    "탈거에요",
    "탈껏",
    "탈것중",
    "탈 것",
  ],
} as const;

function normalizeCategoryText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCategory(text: string) {
  const normalized = normalizeCategoryText(text);
  const compact = normalized.replace(/\s+/g, "");
  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .flatMap((token) => {
      const compactToken = token.replace(/\s+/g, "");
      return [compactToken, compactToken.slice(0, 2), compactToken.slice(0, 3)];
    })
    .filter(Boolean);

  const entries = Object.entries(CATEGORY_VARIANTS) as Array<
    [keyof typeof CATEGORY_VARIANTS, readonly string[]]
  >;

  for (const [category, variants] of entries) {
    if (
      variants.some((variant) => {
        const normalizedVariant = normalizeCategoryText(variant).replace(
          /\s+/g,
          "",
        );
        return compact === normalizedVariant || compact.includes(normalizedVariant);
      })
    ) {
      return category;
    }
  }

  for (const [category, variants] of entries) {
    if (
      tokens.some((token) =>
        variants.some((variant) => {
          const normalizedVariant = normalizeCategoryText(variant).replace(
            /\s+/g,
            "",
          );
          return (
            token.length > 0 &&
            Math.abs(token.length - normalizedVariant.length) <= 1 &&
            levenshtein(token, normalizedVariant) <= 1
          );
        }),
      )
    ) {
      return category;
    }
  }

  return null;
}

function buildRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function buildDeck(difficulty: MemoryDifficultyId) {
  const config =
    MEMORY_DIFFICULTIES.find((item) => item.id === difficulty) ??
    MEMORY_DIFFICULTIES[1];
  const nextCards = MEMORY_CATEGORIES.flatMap((category) =>
    shuffle(
      MEMORY_CARD_WORDS.filter((card) => card.category === category.id),
    ).slice(0, config.cardsPerCategory),
  );

  return shuffle(nextCards).map((card) => ({
    ...card,
    revealed: false,
    solved: false,
  }));
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getRoundTimeLimit(difficulty: MemoryDifficultyId) {
  switch (difficulty) {
    case "easy":
      return 10;
    case "normal":
      return 7;
    case "hard":
      return 5;
    default:
      return 7;
  }
}

function SelectionModal({
  difficulty,
  onSelect,
  onStart,
}: {
  difficulty: MemoryDifficultyId;
  onSelect: (id: MemoryDifficultyId) => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/80 p-6 backdrop-blur-md">
      <div className="relative my-auto w-full max-w-[540px] max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-[56px] border-[6px] border-white bg-white shadow-[0_32px_80px_rgba(0,0,0,0.4)] ring-1 ring-slate-200">
        <div className="border-b-2 border-slate-100 bg-slate-50/80 px-8 pb-8 pt-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[32px] bg-violet-600 text-white shadow-xl ring-4 ring-violet-50">
            <span className="text-4xl">🧠</span>
          </div>
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.4em] text-violet-500">
            Cognitive Logic Protocol
          </span>
          <h3 className="text-4xl font-black tracking-tighter text-slate-900">
            말로 분류하기
          </h3>
          <p className="mt-3 break-keep text-sm font-bold text-slate-400">
            제시된 그림을 보고 알맞은 분류(과일, 동물, 탈것)를 말해 보세요.
          </p>
        </div>

        <div className="bg-white p-8">
          <div className="mb-10 grid grid-cols-3 gap-4">
            {MEMORY_DIFFICULTIES.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`group relative flex h-28 flex-col items-center justify-center gap-1 rounded-[32px] border-2 transition-all ${
                  difficulty === item.id
                    ? "scale-105 border-violet-600 bg-violet-600 text-white shadow-lg"
                    : "border-slate-300 bg-slate-50 text-slate-500 hover:border-violet-300 hover:bg-white"
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                  Level
                </span>
                <strong className="text-2xl font-black">{item.label}</strong>
                <span className="text-[11px] font-bold opacity-70">
                  {item.cardsPerCategory * 3}장
                </span>
                <span className="text-[10px] font-black opacity-70">
                  {getRoundTimeLimit(item.id)}초
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={onStart}
            className="flex h-20 w-full items-center justify-center gap-3 rounded-[28px] bg-slate-900 text-xl font-black text-white shadow-2xl shadow-slate-200 transition-transform active:scale-95"
          >
            훈련 시작하기
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultModal({
  elapsedTime,
  accuracy,
  solvedCount,
  totalCount,
  onRestart,
  onHome,
}: {
  elapsedTime: string;
  accuracy: number;
  solvedCount: number;
  totalCount: number;
  onRestart: () => void;
  onHome?: () => void;
}) {
  const router = useRouter();
  const successRate =
    totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;
  const handleHome = onHome ?? (() => router.push("/select-page/game-mode"));

  return (
    <LingoResultModalShell
      icon="🏆"
      badgeText="훈련 완료"
      title="훈련 완료 리포트"
      subtitle="분류 훈련을 성공적으로 마쳤습니다."
      headerToneClass="bg-violet-50"
      iconToneClass="bg-gradient-to-br from-violet-500 to-indigo-600"
      badgeToneClass="text-violet-600"
      primaryLabel="단계 다시 선택하기"
      onPrimary={onRestart}
      secondaryLabel="메인 화면으로 돌아가기"
      onSecondary={handleHome}
    >
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 text-center">
          <span className="mb-2 block text-[11px] font-black text-slate-400">
            성공률
          </span>
          <strong className="text-4xl font-black text-violet-600">
            {successRate}%
          </strong>
        </div>
        <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5 text-center">
          <span className="mb-2 block text-[11px] font-black text-slate-400">
            정확도
          </span>
          <strong className="text-4xl font-black text-slate-900">
            {accuracy}%
          </strong>
        </div>
      </div>

      <div className="mb-6 rounded-[28px] border border-slate-100 bg-slate-50 p-5 text-center">
        <span className="mb-2 block text-[11px] font-black text-slate-400">
          걸린 시간
        </span>
        <strong className="text-3xl font-black text-slate-900">
          {elapsedTime}
        </strong>
      </div>

      <div className="mb-6 flex h-12 w-full overflow-hidden rounded-2xl border-4 border-slate-50">
        <div
          className="flex items-center justify-center bg-violet-500 text-xs font-black text-white"
          style={{ width: `${successRate}%` }}
        >
          성공 {solvedCount}
        </div>
        <div
          className="flex items-center justify-center bg-slate-200 text-xs font-black text-slate-500"
          style={{ width: `${100 - successRate}%` }}
        >
          남음 {Math.max(totalCount - solvedCount, 0)}
        </div>
      </div>
    </LingoResultModalShell>
  );
}

export default function MemoryFlipGame({ onBack }: { onBack?: () => void }) {
  const {
    volume,
    isMicReady,
    error: micError,
    start: startAudioMonitor,
    stop: stopAudioMonitor,
  } = useAudioAnalyzer();

  const [difficulty, setDifficulty] = useState<MemoryDifficultyId>("normal");
  const [cards, setCards] = useState(() => buildDeck("normal"));
  const [targetWord, setTargetWord] = useState<string | null>(null);
  const [heardText, setHeardText] = useState("");
  const [message, setMessage] = useState(
    "한 번 마이크를 켜면 계속 듣습니다. 그림을 보고 정답 분류를 말해 보세요.",
  );
  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionFinishedAt, setSessionFinishedAt] = useState<number | null>(
    null,
  );
  const [wrongByCategory, setWrongByCategory] = useState<
    Record<string, number>
  >({
    fruit: 0,
    animal: 0,
    vehicle: 0,
  });
  const [isListening, setIsListening] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [audioBars, setAudioBars] = useState(Array(16).fill(10));
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [faceGuideScore, setFaceGuideScore] = useState(0);
  const [showDifficultyModal, setShowDifficultyModal] = useState(true);
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "success" | "fail"
  >("idle");
  const [timeLeft, setTimeLeft] = useState(getRoundTimeLimit("normal"));

  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const handledTargetRef = useRef<string | null>(null);
  const transitionLockRef = useRef(false);
  const ignoreSpeechUntilRef = useRef(0);
  const currentCardRef = useRef<typeof currentCard>(null);
  const cardsRef = useRef(cards);
  const timeLeftRef = useRef(0);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const volumeRef = useRef(0);

  const attachCameraPreview = useCallback(async () => {
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    try {
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
      }
      await video.play();
    } catch {
      // autoplay 정책이나 브라우저 타이밍 이슈가 있어도 재시도 effect가 다시 붙습니다.
    }
  }, []);

  useEffect(() => {
    const Recognition = buildRecognition();
    setSupported(Boolean(Recognition));
  }, []);

  const currentCard = useMemo(() => {
    const remaining = cards.filter((card) => !card.solved);
    if (remaining.length === 0) return null;
    if (!targetWord) return remaining[0];
    return (
      remaining.find((card) => card.word === targetWord) ?? remaining[0] ?? null
    );
  }, [cards, targetWord]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    if (showDifficultyModal) return;
    if (currentCard) return;
    setTargetWord(null);
  }, [currentCard, showDifficultyModal]);

  useEffect(() => {
    if (showDifficultyModal) return;
    if (targetWord) return;
    const firstRemaining = cards.find((card) => !card.solved);
    if (firstRemaining) {
      setTargetWord(firstRemaining.word);
    }
  }, [cards, showDifficultyModal, targetWord]);

  useEffect(() => {
    if (!currentCard) {
      setMessage("모든 카드를 분류했어요.");
      setSessionFinishedAt((value) => value ?? Date.now());
    }
  }, [currentCard]);

  useEffect(() => {
    handledTargetRef.current = currentCard?.word ?? null;
  }, [currentCard?.word]);

  useEffect(() => {
    currentCardRef.current = currentCard;
  }, [currentCard]);

  useEffect(() => {
    if (showDifficultyModal || !currentCard) return;
    setTimeLeft(getRoundTimeLimit(difficulty));
  }, [currentCard, difficulty, showDifficultyModal]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (showDifficultyModal || !currentCard) return;
    setHeardText("");
    setMessage("지금 과일, 동물, 탈것 중 하나를 말하세요.");
    ignoreSpeechUntilRef.current = Date.now() + 1200;
    const unlockTimer = window.setTimeout(() => {
      transitionLockRef.current = false;
    }, 220);
    return () => window.clearTimeout(unlockTimer);
  }, [currentCard?.word, showDifficultyModal]);

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
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError("이 브라우저는 카메라 미리보기를 지원하지 않습니다.");
      return false;
    }

    try {
      const activeStream = cameraStreamRef.current;
      const activeTrack = activeStream?.getVideoTracks?.()[0];
      if (activeStream && activeTrack?.readyState === "live") {
        setCameraError("");
        setCameraReady(true);
        await attachCameraPreview();
        return true;
      }

      stopCamera();
      setCameraError("");
      const stream = await createPreferredCameraStream();

      cameraStreamRef.current = stream;
      registerMediaStream(stream);
      setCameraReady(true);
      return true;
    } catch {
      setCameraReady(false);
      setCameraError("카메라 권한이 없어서 가이드 화면은 표시되지 않습니다.");
      return false;
    }
  }, [attachCameraPreview, stopCamera]);

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (!cameraReady) return;
    void attachCameraPreview();
  }, [attachCameraPreview, cameraReady]);

  function getNextTargetWord(nextCards: typeof cards, currentWord?: string) {
    const remaining = nextCards.filter((card) => !card.solved);
    if (remaining.length === 0) {
      return null;
    }
    const currentIndex = currentWord
      ? nextCards.findIndex((card) => card.word === currentWord)
      : -1;
    return (
      nextCards.find(
        (card, index) => index > currentIndex && !card.solved,
      ) ?? remaining[0]
    ).word;
  }

  function chooseNextTarget(nextCards: typeof cards, currentWord?: string) {
    setTargetWord(getNextTargetWord(nextCards, currentWord));
  }

  function revealCategory(targetWord: string, correct: boolean) {
    const nextCards = cardsRef.current.map((card) => {
      if (card.word === targetWord) {
        return correct ? { ...card, revealed: true, solved: true } : card;
      }
      return card;
    });

    cardsRef.current = nextCards;
    setCards(nextCards);

    if (correct) {
      chooseNextTarget(nextCards, targetWord);
    }
  }

  function triggerFeedback(nextState: "success" | "fail") {
    setFeedbackState(nextState);
    window.setTimeout(() => {
      setFeedbackState("idle");
    }, 520);
  }

  const handleRoundTimeout = useCallback(() => {
    const activeCard = currentCardRef.current;
    if (!activeCard) return;
    if (handledTargetRef.current === `done-${activeCard.word}`) return;

    transitionLockRef.current = true;
    ignoreSpeechUntilRef.current = Date.now() + 900;
    handledTargetRef.current = `done-${activeCard.word}`;
    setAttemptCount((value) => value + 1);
    setWrongCount((value) => value + 1);
    setScore((value) => Math.max(0, value - 2));
    setWrongByCategory((value) => ({
      ...value,
      [activeCard.category]: (value[activeCard.category] ?? 0) + 1,
    }));
    setHeardText("");
    setMessage("시간 초과예요. 다음 그림으로 넘어갑니다.");
    triggerFeedback("fail");
    setTargetWord(getNextTargetWord(cardsRef.current, activeCard.word));
  }, []);

  function handleSpeechResult(transcript: string) {
    const activeCard = currentCardRef.current;
    if (
      !activeCard ||
      transitionLockRef.current ||
      Date.now() < ignoreSpeechUntilRef.current ||
      handledTargetRef.current === `done-${activeCard.word}`
    )
      return;
    setHeardText(transcript);

    const parsedCategory = parseCategory(transcript);
    console.info("[Memory] speech result", {
      transcript,
      parsedCategory,
      currentWord: activeCard.word,
      currentCategory: activeCard.category,
    });

    if (!parsedCategory) {
      setMessage("과일, 동물, 탈것 중 하나를 말해 주세요.");
      return;
    }

    setAttemptCount((value) => value + 1);

    if (parsedCategory === activeCard.category) {
      transitionLockRef.current = true;
      ignoreSpeechUntilRef.current = Date.now() + 900;
      handledTargetRef.current = `done-${activeCard.word}`;
      setHeardText("");
      revealCategory(activeCard.word, true);
      triggerFeedback("success");
      setScore((value) => value + 15);
      setSolvedCount((value) => value + 1);
      setMessage(`정답이에요. ${activeCard.word} 카드가 열렸습니다.`);
      return;
    }

    triggerFeedback("fail");
    setScore((value) => Math.max(0, value - 2));
    setWrongCount((value) => value + 1);
    setWrongByCategory((value) => ({
      ...value,
      [activeCard.category]: (value[activeCard.category] ?? 0) + 1,
    }));
    setMessage(`아직 아니에요. ${Math.max(timeLeftRef.current, 0)}초 안에 다시 말해 보세요.`);
  }

  function runSpeechTestInput(transcript: string) {
    if (!currentCard || showDifficultyModal) return;
    handleSpeechResult(transcript);
  }

  useEffect(() => {
    if (showDifficultyModal || !currentCard) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.setTimeout(() => {
            handleRoundTimeout();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentCard, handleRoundTimeout, showDifficultyModal]);

  const beginContinuousListening = useCallback(() => {
    if (!supported || recognitionRef.current || !currentCardRef.current) return;

    const Recognition = buildRecognition();
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setMicEnabled(true);
      setMessage("듣는 중이에요. 그림을 보고 정답 분류를 말해 보세요.");
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results?.[i];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (Date.now() < ignoreSpeechUntilRef.current) continue;

        setHeardText(transcript);

        if (parseCategory(transcript)) {
          handleSpeechResult(transcript);
          return;
        }

        if (result?.isFinal) {
          setMessage("과일, 동물, 탈것 중 하나를 또박또박 말해 주세요.");
        }
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (
        keepListeningRef.current &&
        currentCardRef.current &&
        !transitionLockRef.current
      ) {
        window.setTimeout(() => beginContinuousListening(), 150);
        return;
      }
      setIsListening(false);
      setMicEnabled(false);
    };

    recognition.onerror = () => {
      setMessage("음성 인식이 잠시 끊겼어요. 다시 듣는 중입니다.");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported]);

  useEffect(() => {
    if (showDifficultyModal || !currentCard || !keepListeningRef.current) return;

    const restartTimer = window.setTimeout(() => {
      if (recognitionRef.current) {
        const recognition = recognitionRef.current;
        recognition.onend = () => {
          recognitionRef.current = null;
          if (keepListeningRef.current && currentCardRef.current) {
            window.setTimeout(() => beginContinuousListening(), 120);
            return;
          }
          setIsListening(false);
          setMicEnabled(false);
        };

        try {
          recognition.stop();
          return;
        } catch {
          recognitionRef.current = null;
        }
      }

      beginContinuousListening();
    }, 180);

    return () => window.clearTimeout(restartTimer);
  }, [beginContinuousListening, currentCard?.word, currentCard, showDifficultyModal]);

  async function startListening() {
    if (micEnabled || !currentCard) return;
    keepListeningRef.current = true;
    const micStarted = await startAudioMonitor();
    if (!micStarted) {
      keepListeningRef.current = false;
      setMessage("마이크를 사용할 수 없어요. 권한을 확인해 주세요.");
      return;
    }
    await startCamera();
    beginContinuousListening();
  }

  const stopListening = useCallback(() => {
    keepListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    stopAudioMonitor();
    stopCamera();
    setIsListening(false);
    setMicEnabled(false);
  }, [stopAudioMonitor, stopCamera]);

  function restart() {
    stopListening();
    setShowDifficultyModal(true);
  }

  function changeDifficulty(nextDifficulty: MemoryDifficultyId) {
    stopListening();
    setDifficulty(nextDifficulty);
    setCards(buildDeck(nextDifficulty));
    setTargetWord(null);
    setHeardText("");
    setMessage("난이도를 바꿨어요. 그림을 보고 정답 분류를 말해 보세요.");
    setScore(0);
    setSolvedCount(0);
    setAttemptCount(0);
    setWrongCount(0);
    setSessionStartedAt(null);
    setSessionFinishedAt(null);
    setWrongByCategory({ fruit: 0, animal: 0, vehicle: 0 });
    setFeedbackState("idle");
    setTimeLeft(getRoundTimeLimit(nextDifficulty));
  }

  async function startGameForDifficulty() {
    const nextCards = buildDeck(difficulty);
    setCards(nextCards);
    setTargetWord(nextCards.find((card) => !card.solved)?.word ?? null);
    setHeardText("");
    setMessage(
      "한 번 마이크를 켜면 계속 듣습니다. 그림을 보고 정답 분류를 말해 보세요.",
    );
    setScore(0);
    setSolvedCount(0);
    setAttemptCount(0);
    setWrongCount(0);
    setSessionStartedAt(Date.now());
    setSessionFinishedAt(null);
    setWrongByCategory({ fruit: 0, animal: 0, vehicle: 0 });
    setFeedbackState("idle");
    setTimeLeft(getRoundTimeLimit(difficulty));
    setShowDifficultyModal(false);
    keepListeningRef.current = true;
    const micStarted = await startAudioMonitor();
    if (!micStarted) {
      keepListeningRef.current = false;
      setMessage("마이크를 사용할 수 없어요. 권한을 확인해 주세요.");
      return;
    }
    await startCamera();
    beginContinuousListening();
  }

  useEffect(() => () => stopListening(), [stopListening]);

  // volume을 ref로 동기화 — 빠르게 바뀌는 volume이 setInterval deps에 있으면
  // interval이 매 RAF마다 재생성되어 wave가 거의 업데이트되지 않음
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const v = volumeRef.current;
      setAudioBars((prev) =>
        prev.map((_, index) => {
          const wave = 0.55 + Math.sin(Date.now() / 180 + index * 0.6) * 0.22;
          const variance = 0.75 + (index % 5) * 0.08;
          // micEnabled 조건 제거 — 마이크가 켜져 있으면(isMicReady) 바로 반응
          const boosted =
            isMicReady
              ? v * 2.4 * wave * variance + (v > 0 ? 10 : 0)
              : 8 + index * 1.8;
          return Math.max(8, Math.min(100, Math.round(boosted)));
        }),
      );

      if (!isMicReady) {
        setFaceGuideScore(0);
        return;
      }

      setFaceGuideScore((prev) => {
        const base = cameraReady ? 72 : 30;
        const drift = Math.sin(Date.now() / 700) * 6;
        const target = Math.round(Math.max(0, Math.min(100, base + drift)));
        return Math.round(prev * 0.65 + target * 0.35);
      });
    }, 90);

    return () => window.clearInterval(tick);
  }, [cameraReady, isMicReady]);

  const solvedRatio = Math.round((solvedCount / cards.length) * 100);
  const roundTimeLimit = getRoundTimeLimit(difficulty);
  const timeRatio = Math.max(
    0,
    Math.min(100, Math.round((timeLeft / roundTimeLimit) * 100)),
  );
  const accuracy =
    attemptCount > 0 ? Math.round((solvedCount / attemptCount) * 100) : 0;
  const showReport = !showDifficultyModal && !currentCard;
  const elapsedTime =
    sessionStartedAt && sessionFinishedAt
      ? formatDuration(sessionFinishedAt - sessionStartedAt)
      : "0:00";
  const mostConfusedCategory = Object.entries(wrongByCategory).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const mostConfusedLabel =
    mostConfusedCategory && mostConfusedCategory[1] > 0
      ? (MEMORY_CATEGORIES.find((item) => item.id === mostConfusedCategory[0])
          ?.label ?? "-")
      : "없음";
  const cardGridLayout = (() => {
    if (cards.length === 6) return { rows: 2, columns: 3 };
    if (cards.length === 9) return { rows: 3, columns: 3 };
    if (cards.length === 12) return { rows: 3, columns: 4 };
    return { rows: 2, columns: Math.ceil(cards.length / 2) };
  })();
  const isLocalDebug =
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")) ||
    process.env.NEXT_PUBLIC_DEV_MODE === "true";

  return (
    <LingoGameShell
      badge="Game Training • Memory"
      title="말로 열기"
      onRestart={restart}
      onBack={onBack}
      statusLabel={isMicReady && micEnabled ? "LISTENING..." : "READY"}
      progressLabel={`${solvedCount} / ${cards.length}`}
      headerActions={
        isLocalDebug ? (
          <>
            {[
              { label: "과일", transcript: "과일" },
              { label: "동물", transcript: "동물" },
              { label: "탈것", transcript: "탈것" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
                disabled={!currentCard || showDifficultyModal}
                onClick={() => runSpeechTestInput(item.transcript)}
              >
                {item.label}
              </button>
            ))}
          </>
        ) : null
      }
    >
      <div className="vt-layout vt-layout-playing tetris-layout-no-left">
        <section className="vt-center">
          <div className="tetris-content-layout">
            <div className="vt-board-shell tetris-board-shell">
              <div className="vt-canvas-wrap">
                <div className="tetris-board-card-layout has-status">
                  <div className="tetris-game-panel memory-game-panel">
                    <div className="tetris-canvas-stage memory-canvas-stage">
                      {currentCard ? (
                        <div
                          className={`memory-main-card relative w-full max-w-none overflow-hidden rounded-[44px] border-[6px] bg-white p-6 shadow-2xl transition-all duration-500 sm:rounded-[52px] sm:p-8 ${
                            feedbackState === "success"
                              ? "scale-[1.03] border-emerald-400 shadow-emerald-100"
                              : feedbackState === "fail"
                                ? "border-rose-400 shadow-rose-100"
                                : "border-white"
                          }`}
                        >
                          <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-violet-600 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-violet-100">
                                Visual Cognitive
                              </span>
                              <span className="text-sm font-black text-slate-400">
                                Level {difficulty.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-slate-50 px-4 py-1.5 ring-1 ring-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
                                  제한 시간
                                </span>
                                <strong className="ml-2 text-sm font-black text-violet-600">
                                  {timeLeft}s
                                </strong>
                              </div>
                              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-1.5 ring-1 ring-slate-100">
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                  isMicReady && micEnabled
                                    ? "animate-pulse bg-emerald-500 shadow-[0_0_8px_#10b981]"
                                    : "bg-slate-300"
                                }`}
                              />
                              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
                                {isMicReady && micEnabled ? "Mic Active" : "Mic Standby"}
                              </span>
                              </div>
                            </div>
                          </div>

                          <div className="mb-6 rounded-full bg-slate-100 p-1 shadow-inner">
                            <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              <span>Round Timer</span>
                              <span className={timeLeft <= 2 ? "text-rose-500" : "text-violet-600"}>
                                {timeLeft}s
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white">
                              <div
                                className={`h-full transition-all duration-1000 ${
                                  timeLeft <= 2 ? "bg-rose-500" : "bg-violet-500"
                                }`}
                                style={{ width: `${timeRatio}%` }}
                              />
                            </div>
                          </div>

                          {feedbackState !== "idle" ? (
                            <div
                              className={`pointer-events-none absolute right-6 top-28 rounded-full px-4 py-2 text-sm font-black shadow-lg sm:right-8 ${
                                feedbackState === "success"
                                  ? "bg-emerald-500 text-white shadow-emerald-100"
                                  : "bg-rose-500 text-white shadow-rose-100"
                              }`}
                            >
                              {feedbackState === "success"
                                ? "정답! 다음 카드로 이동"
                                : "오답 또는 시간 초과"}
                            </div>
                          ) : null}

                          <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_280px] lg:gap-8">
                            <div className="flex min-w-0 flex-col items-center justify-center text-center">
                              <div className="mb-5 w-full rounded-[28px] border border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6 sm:py-5">
                                <div className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-slate-500 sm:text-[15px]">
                                  Speak One Category
                                </div>
                                <div className="flex items-center justify-center gap-2 sm:gap-3">
                                  {[
                                    {
                                      label: "과일",
                                      emoji: "🍎",
                                      color:
                                        "bg-amber-100 text-amber-600 border-amber-200",
                                    },
                                    {
                                      label: "동물",
                                      emoji: "🐶",
                                      color:
                                        "bg-emerald-100 text-emerald-600 border-emerald-200",
                                    },
                                    {
                                      label: "탈것",
                                      emoji: "🚗",
                                      color:
                                        "bg-blue-100 text-blue-600 border-blue-200",
                                    },
                                  ].map((cat) => (
                                    <div
                                      key={cat.label}
                                      className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-black shadow-sm sm:px-6 sm:py-3 sm:text-base ${cat.color}`}
                                    >
                                      <span>{cat.emoji}</span>
                                      {cat.label}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div
                                className={`mb-5 flex w-full items-center gap-3 rounded-[24px] border px-5 py-4 text-left shadow-sm transition-all ${
                                  micEnabled
                                    ? "border-violet-200 bg-violet-50/80 shadow-violet-100"
                                    : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <span
                                  className={`h-3 w-3 shrink-0 rounded-full ${
                                    micEnabled
                                      ? "animate-pulse bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.45)]"
                                      : "bg-slate-300"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <div
                                    className={`text-xs font-black uppercase tracking-[0.18em] ${
                                      micEnabled
                                        ? "text-violet-600"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {micEnabled ? "자동 듣기 활성화" : "듣기 대기"}
                                  </div>
                                  <p
                                    className={`mt-1 text-sm font-bold ${
                                      micEnabled
                                        ? "text-slate-700"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {micEnabled
                                      ? "지금 과일, 동물, 탈것 중 하나를 말하세요."
                                      : "마이크 연결 후 자동으로 듣기를 시작합니다."}
                                  </p>
                                </div>
                              </div>

                              <div className="group relative mb-6 flex aspect-square w-56 items-center justify-center rounded-[40px] border-2 border-slate-50 bg-slate-50 shadow-inner sm:w-64 sm:rounded-[48px]">
                                <div className="absolute inset-0 rounded-[48px] bg-gradient-to-b from-white/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                <span className="relative z-10 select-none text-[150px] drop-shadow-2xl">
                                  {currentCard.visual}
                                </span>
                              </div>
                              <h2 className="mb-2 text-3xl font-black tracking-tighter text-slate-900 sm:text-4xl">
                                알맞은 분류를 말해보세요
                              </h2>
                              <p className="text-base font-bold text-slate-400 sm:text-lg">
                                그림을 보고 과일, 동물, 탈것 중 하나를 고르세요.
                              </p>
                              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                  isMicReady && micEnabled
                                    ? "animate-pulse bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.45)]"
                                    : "bg-slate-300"
                                  }`}
                                />
                                <span
                                  className={`text-xs font-black uppercase tracking-[0.18em] ${
                                    isMicReady && micEnabled ? "text-rose-500" : "text-slate-400"
                                  }`}
                                >
                                  {isMicReady && micEnabled ? "녹음 중" : "녹음 대기"}
                                </span>
                              </div>
                            </div>

                            <div className="flex h-full min-h-0 flex-col gap-4">
                              <div
                                className={`rounded-[24px] px-5 py-4 text-left shadow-xl transition-all sm:rounded-[28px] sm:px-6 sm:py-5 ${
                                  isMicReady && micEnabled
                                    ? "bg-slate-900 ring-2 ring-violet-400/30"
                                    : "bg-slate-800"
                                }`}
                              >
                                <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-violet-400">
                                  Listening Stream
                                </div>
                                <p className="truncate text-lg font-black text-white sm:text-xl">
                                  {heardText ||
                                    (isMicReady && micEnabled
                                      ? "지금 분류를 말해 주세요..."
                                      : "마이크 대기 중")}
                                </p>
                                <p className="mt-2 text-xs font-bold text-slate-300">
                                  {isMicReady && micEnabled
                                    ? "정답을 말하면 바로 다음 카드로 넘어갑니다."
                                    : "세션이 시작되면 자동으로 음성을 듣습니다."}
                                </p>
                              </div>

                              <div className="flex flex-1 flex-col rounded-[32px] border-2 border-slate-100 bg-slate-50/50 p-5 shadow-inner sm:rounded-[40px] sm:p-6">
                                <div className="mb-4 flex items-center justify-between px-1 sm:px-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Session Progress
                                  </span>
                                  <strong className="text-sm font-black text-violet-600">
                                    {solvedRatio}%
                                  </strong>
                                </div>
                                <div
                                  className="grid gap-2.5 sm:gap-3"
                                  style={
                                    {
                                      gridTemplateColumns: `repeat(${cardGridLayout.columns}, 1fr)`,
                                      gridTemplateRows: `repeat(${cardGridLayout.rows}, 1fr)`,
                                    } as CSSProperties
                                  }
                                >
                                  {cards.map((card, i) => {
                                    const isCorrect =
                                      card.revealed || card.solved;
                                    return (
                                      <div
                                        key={i}
                                        className={`flex aspect-square items-center justify-center rounded-2xl border-2 p-2 text-center transition-all duration-700 ${
                                          isCorrect
                                            ? "border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-100"
                                            : "border-white bg-white text-slate-200"
                                        }`}
                                      >
                                        {isCorrect ? (
                                          <span className="line-clamp-2 break-keep text-[11px] font-black leading-tight sm:text-xs">
                                            {card.word}
                                          </span>
                                        ) : (
                                          <span className="text-lg font-black opacity-20">
                                            ?
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-auto space-y-2 border-t border-slate-200 pt-4">
                                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                                    <span>Target Word</span>
                                    <span className="text-slate-800">
                                      {solvedCount} / {cards.length}
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className="h-full bg-violet-500 transition-all duration-1000"
                                      style={{ width: `${solvedRatio}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : null}
                    </div>
                  </div>

                  <aside className="tetris-status-panel">
                    <MonitoringPanelShell
                      title="안면 모니터링"
                      icon="📹"
                      className="tetris-report-card-compact memory-monitor-shell"
                      bodyClassName="tetris-status-columns"
                    >
                      <div className="vt-monitor-card tetris-monitor-inline">
                        <div className="vt-camera-frame">
                          <video
                            ref={videoRef}
                            className="vt-camera-video"
                            autoPlay
                            muted
                            playsInline
                            style={{ display: cameraReady ? "block" : "none" }}
                          />
                          {!cameraReady ? (
                            <div className="vt-camera-placeholder">
                              <span>카메라 대기 중</span>
                              <p>카메라를 확인한 뒤 다시 시도해 주세요.</p>
                            </div>
                          ) : null}
                          <div className="vt-face-guide" />
                        </div>

                        <div className="vt-audio-card">
                          <span className="vt-audio-label">음성 활성도</span>
                          <div className="vt-audio-bars">
                            {audioBars.map((bar, index) => (
                              <span
                                key={index}
                                className="vt-audio-bar"
                                style={{ height: `${bar}%` }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                          <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black uppercase text-slate-400">
                              Accuracy
                            </span>
                            <strong className="text-lg font-black text-violet-600">
                              {accuracy}%
                            </strong>
                          </div>
                          <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black uppercase text-slate-400">
                              Score
                            </span>
                            <strong className="text-lg font-black text-slate-800">
                              {score}pt
                            </strong>
                          </div>
                        </div>
                      </div>
                    </MonitoringPanelShell>
                  </aside>
                </div>
              </div>
            </div>

            {showDifficultyModal ? (
              <SelectionModal
                difficulty={difficulty}
                onSelect={changeDifficulty}
                onStart={() => void startGameForDifficulty()}
              />
            ) : null}
            {showReport ? (
              <ResultModal
                elapsedTime={elapsedTime}
                accuracy={accuracy}
                solvedCount={solvedCount}
                totalCount={cards.length}
                onRestart={restart}
                onHome={onBack}
              />
            ) : null}
          </div>
        </section>
      </div>
    </LingoGameShell>
  );
}
