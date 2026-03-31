"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MEMORY_CARD_WORDS,
  MEMORY_CATEGORIES,
  MEMORY_DIFFICULTIES,
  type MemoryDifficultyId,
} from "@/data/memoryGameData";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";
import {
  createPreferredCameraStream,
} from "@/lib/media/cameraPreferences";

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function parseCategory(text: string) {
  const normalized = text.replace(/\s+/g, "");
  if (normalized.includes("과일")) return "fruit";
  if (normalized.includes("동물")) return "animal";
  if (
    normalized.includes("탈것") ||
    normalized.includes("탈거") ||
    normalized.includes("차")
  )
    return "vehicle";
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

export default function MemoryFlipGame({ onBack }: { onBack?: () => void }) {
  const {
    volume,
    error: micError,
    start: startAudioMonitor,
    stop: stopAudioMonitor,
  } = useAudioAnalyzer();

  const [difficulty, setDifficulty] = useState<MemoryDifficultyId>("normal");
  const [cards, setCards] = useState(() => buildDeck("normal"));
  const [targetIndex, setTargetIndex] = useState(0);
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

  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const handledTargetRef = useRef<string | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attachCameraPreview = useCallback(async () => {
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    try {
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
    return remaining[targetIndex] ?? remaining[0] ?? null;
  }, [cards, targetIndex]);

  useEffect(() => {
    if (!currentCard) {
      setMessage("모든 카드를 분류했어요.");
      setSessionFinishedAt((value) => value ?? Date.now());
    }
  }, [currentCard]);

  useEffect(() => {
    handledTargetRef.current = currentCard?.word ?? null;
  }, [currentCard?.word]);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
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

  function chooseNextTarget(nextCards: typeof cards, currentWord?: string) {
    const remaining = nextCards.filter((card) => !card.solved);
    if (remaining.length === 0) {
      setTargetIndex(0);
      return;
    }

    const nextPool =
      currentWord && remaining.length > 1
        ? remaining.filter((card) => card.word !== currentWord)
        : remaining;
    const nextTarget =
      nextPool[Math.floor(Math.random() * nextPool.length)] ?? remaining[0];
    const nextIndex = remaining.findIndex(
      (card) => card.word === nextTarget.word,
    );
    setTargetIndex(Math.max(0, nextIndex));
  }

  function revealCategory(targetCategory: string, correct: boolean) {
    setCards((current) => {
      const next = current.map((card) => {
        if (card.word === currentCard?.word) {
          return correct ? { ...card, revealed: true, solved: true } : card;
        }

        return card;
      });

      if (correct) {
        chooseNextTarget(next, currentCard?.word);
      }
      return next;
    });
  }

  function triggerFeedback(nextState: "success" | "fail") {
    setFeedbackState(nextState);
    window.setTimeout(() => {
      setFeedbackState("idle");
    }, 520);
  }

  function handleSpeechResult(transcript: string) {
    if (!currentCard || handledTargetRef.current === `done-${currentCard.word}`)
      return;

    handledTargetRef.current = `done-${currentCard.word}`;
    setHeardText(transcript);

    const parsedCategory = parseCategory(transcript);
    setAttemptCount((value) => value + 1);

    if (!parsedCategory) {
      handledTargetRef.current = currentCard.word;
      triggerFeedback("fail");
      setMessage("잘 분류해 보세요.");
      setScore((value) => Math.max(0, value - 1));
      setWrongCount((value) => value + 1);
      setWrongByCategory((value) => ({
        ...value,
        [currentCard.category]: (value[currentCard.category] ?? 0) + 1,
      }));
      return;
    }

    if (parsedCategory === currentCard.category) {
      revealCategory(parsedCategory, true);
      triggerFeedback("success");
      setScore((value) => value + 15);
      setSolvedCount((value) => value + 1);
      setMessage(`정답이에요. ${currentCard.word} 카드가 열렸습니다.`);
      return;
    }

    revealCategory(parsedCategory, false);
    handledTargetRef.current = currentCard.word;
    triggerFeedback("fail");
    setScore((value) => Math.max(0, value - 2));
    setWrongCount((value) => value + 1);
    setWrongByCategory((value) => ({
      ...value,
      [currentCard.category]: (value[currentCard.category] ?? 0) + 1,
    }));
    setMessage("잘 분류해 보세요.");
  }

  function runSpeechTestInput(transcript: string) {
    if (!currentCard || showDifficultyModal) return;
    handleSpeechResult(transcript);
  }

  const beginContinuousListening = useCallback(() => {
    if (!supported || recognitionRef.current || !currentCard) return;

    const Recognition = buildRecognition();
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setMicEnabled(true);
      setMessage("듣는 중이에요. 그림을 보고 정답 분류를 말해 보세요.");
    };

    recognition.onresult = (event: any) => {
      const result = event.results?.[event.resultIndex];
      if (!result?.isFinal) return;
      const transcript = result[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      handleSpeechResult(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (keepListeningRef.current && currentCard) {
        window.setTimeout(() => beginContinuousListening(), 150);
      }
    };

    recognition.onerror = () => {
      setMessage("음성 인식이 잠시 끊겼어요. 다시 듣는 중입니다.");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [currentCard, supported]);

  async function startListening() {
    if (micEnabled || !currentCard) return;
    keepListeningRef.current = true;
    await startAudioMonitor();
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
    setTargetIndex(0);
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
  }

  async function startGameForDifficulty() {
    const nextCards = buildDeck(difficulty);
    setCards(nextCards);
    setTargetIndex(0);
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
    setShowDifficultyModal(false);
    keepListeningRef.current = true;
    await startAudioMonitor();
    await startCamera();
    beginContinuousListening();
  }

  useEffect(() => () => stopListening(), [stopListening]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setAudioBars((prev) =>
        prev.map((_, index) => {
          const wave = 0.55 + Math.sin(Date.now() / 180 + index * 0.6) * 0.22;
          const variance = 0.75 + (index % 5) * 0.08;
          const next = micEnabled ? volume * wave * variance : 8 + index * 1.8;
          return Math.max(8, Math.min(100, Math.round(next)));
        }),
      );

      if (!micEnabled) {
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
  }, [cameraReady, micEnabled, volume]);

  const solvedRatio = Math.round((solvedCount / cards.length) * 100);
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

  return (
    <main className="app-shell vt-shell">
      <section className="game-card vt-card">
        <div className="game-header vt-header">
          <div>
            <p className="eyebrow">LingoFriends</p>
            <h1>말로 열기</h1>
            <p className="vt-header-copy">
              그림을 보고 과일, 동물, 탈것 중 맞는 답을 말하면 아래 물음표
              카드에 단어가 공개되는 음성 훈련입니다.
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="ui-button" onClick={restart}>
              단계 선택
            </button>
            {onBack ? (
              <button
                type="button"
                className="ui-button secondary-button"
                onClick={onBack}
                aria-label="홈으로"
                title="홈으로"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V20a1 1 0 0 0 1 1h4.5v-6h3v6H18a1 1 0 0 0 1-1V9.5" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        <div className="vt-layout vt-layout-playing">
          <aside className="vt-left">
            <div className="vt-glass vt-monitor-card">
              <div className="vt-panel-title">
                <span className="vt-panel-icon">📹</span>
                <strong>멀티모달 모니터링</strong>
              </div>

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
                    <p>
                      {cameraError ||
                        "마이크를 켜면 카메라 프리뷰를 연결합니다."}
                    </p>
                  </div>
                ) : null}
                <div className="vt-face-guide" />
                <div className="vt-camera-status">
                  <div className="vt-camera-row">
                    <span>카메라 상태</span>
                    <strong>{cameraReady ? "연결됨" : "대기 중"}</strong>
                  </div>
                  <div className="vt-face-track">
                    <div
                      className="vt-face-fill"
                      style={{ width: `${cameraReady ? 100 : 28}%` }}
                    />
                  </div>
                </div>
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

              <div className="vt-glass vt-test-card">
                <div className="vt-panel-title">
                  <span className="vt-panel-icon">🧪</span>
                  <strong>STT 테스트</strong>
                </div>
                <div className="vt-test-grid">
                  {[
                    { label: "과일", transcript: "과일" },
                    { label: "동물", transcript: "동물" },
                    { label: "탈것", transcript: "탈것" },
                    { label: "오인식", transcript: "모르겠어요" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="vt-test-btn"
                      disabled={!currentCard || showDifficultyModal}
                      onClick={() => runSpeechTestInput(item.transcript)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="vt-center">
            <div className="vt-board-shell memory-board-shell">
              <div className="vt-canvas-wrap memory-dashboard-stage">
                {currentCard ? (
                  <div className="memory-category-panel">
                    <div className="memory-category-stage memory-category-stage-inside">
                      {[
                        {
                          id: "fruit",
                          label: "과일",
                          emoji: "🍎",
                          color: "#f59e0b",
                        },
                        {
                          id: "animal",
                          label: "동물",
                          emoji: "🐶",
                          color: "#34d399",
                        },
                        {
                          id: "vehicle",
                          label: "탈것",
                          emoji: "🚗",
                          color: "#60a5fa",
                        },
                      ].map((category) => (
                        <div
                          key={category.id}
                          className="memory-category-tile"
                          style={
                            {
                              "--memory-color": category.color,
                            } as React.CSSProperties
                          }
                        >
                          <span
                            className="memory-category-emoji"
                            aria-hidden="true"
                          >
                            {category.emoji}
                          </span>
                          <div className="memory-category-text">
                            <span className="memory-category-label">
                              {category.label}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="memory-center-stack memory-question-panel">
                  {currentCard ? (
                    <div
                      className={`vt-word-card memory-focus-card ${
                        feedbackState === "fail" ? "memory-focus-card-fail" : ""
                      } ${feedbackState === "success" ? "memory-focus-card-success" : ""}`}
                    >
                      <div className="vt-word-header">
                        <span className="vt-word-label">
                          이미지 보고 말하기
                        </span>
                        <span className="vt-word-timer">
                          {micEnabled ? "듣는 중" : "대기 중"}
                        </span>
                      </div>
                      <div
                        className="memory-visual-prompt"
                        aria-label={`${currentCard.word} 이미지 문제`}
                      >
                        <span
                          className="memory-visual-emoji"
                          aria-hidden="true"
                        >
                          {currentCard.visual}
                        </span>
                      </div>
                      <h2 className="vt-word-text memory-prompt-title">
                        이 그림은 무엇일까요?
                      </h2>
                      <p className="memory-focus-copy">
                        그림을 보고 정답 단어의 분류를 말해 보세요.
                      </p>
                      <div className="vt-timer-track">
                        <div
                          className="vt-timer-fill"
                          style={{ width: `${solvedRatio}%` }}
                        />
                      </div>
                      <div
                        className={`memory-feedback-badge is-${feedbackState}`}
                      >
                        {feedbackState === "success"
                          ? "정답"
                          : feedbackState === "fail"
                            ? "다시 시도"
                            : micEnabled
                              ? "듣는 중"
                              : "준비"}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="memory-problem-panel">
                  <div
                    className="memory-grid speech-memory-grid memory-dashboard-grid"
                    style={
                      {
                        "--memory-columns": cardGridLayout.columns,
                        "--memory-rows": cardGridLayout.rows,
                      } as React.CSSProperties
                    }
                  >
                    {cards.map((card) => {
                      const categoryColor =
                        MEMORY_CATEGORIES.find(
                          (category) => category.id === card.category,
                        )?.color ?? "#94a3b8";
                      return (
                        <div
                          key={`${card.word}-${card.category}`}
                          className={`speech-memory-card ${card.revealed || card.solved ? "speech-memory-card-open" : ""}`}
                          style={
                            {
                              "--memory-color": categoryColor,
                            } as React.CSSProperties
                          }
                        >
                          <span>
                            {card.revealed || card.solved ? card.word : "?"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!currentCard ? (
                  <div className="vt-pause-screen">
                    <span className="vt-pause-icon">🪄</span>
                    <h3>말로 열기 완료</h3>
                    <p>
                      모든 카드를 분류했습니다. 다시 시작하면 새 카드 묶음으로
                      이어집니다.
                    </p>
                  </div>
                ) : null}
                {showReport ? (
                  <div className="vt-report-modal">
                    <div className="vt-report-modal-card vt-glass vt-report-card">
                      <div className="vt-panel-title">
                        <span className="vt-panel-icon">🩺</span>
                        <strong>분석 결과 리포트</strong>
                      </div>

                      <div className="vt-score-hero">
                        <div>
                          <span>현재 점수</span>
                          <strong>
                            {score}
                            <em>점</em>
                          </strong>
                        </div>
                        <b
                          className={`vt-score-badge ${micEnabled ? "is-success" : "is-wait"}`}
                        >
                          {micEnabled ? "LISTEN" : "READY"}
                        </b>
                      </div>

                      <div className="vt-mini-grid">
                        <div className="vt-mini-stat">
                          <span>정확도</span>
                          <strong>{accuracy}%</strong>
                        </div>
                        <div className="vt-mini-stat">
                          <span>총 시도 수</span>
                          <strong>{attemptCount}회</strong>
                        </div>
                        <div className="vt-mini-stat">
                          <span>오답 수</span>
                          <strong>{wrongCount}회</strong>
                        </div>
                      </div>

                      <div className="vt-glass-sub">
                        <div className="vt-sub-row">
                          <span>완료 시간</span>
                          <strong>{elapsedTime}</strong>
                        </div>
                        <div className="vt-sub-row">
                          <span>가장 헷갈린 분류</span>
                          <strong>{mostConfusedLabel}</strong>
                        </div>
                        <div className="vt-sub-row">
                          <span>입력 방식</span>
                          <strong>음성 + 카메라</strong>
                        </div>
                        <div className="vt-sub-row">
                          <span>카메라 연결</span>
                          <strong>{cameraReady ? "성공" : "미연결"}</strong>
                        </div>
                      </div>

                      <p className="vt-report-summary">
                        {wrongCount === 0
                          ? "모든 문제를 한 번에 정확히 열었습니다."
                          : `${wrongCount}번 다시 시도해서 모든 카드를 열었습니다.`}
                      </p>
                    </div>
                  </div>
                ) : null}
                {showDifficultyModal ? (
                  <div className="vt-level-modal">
                    <div className="vt-level-modal-card">
                      <h3>단계를 선택해 주세요</h3>
                      <p>
                        단계에 따라 카드 수가 달라집니다.
                        <br />
                        처음에는 작은 카드로 시작해서 점점 늘려 보세요.
                      </p>
                      <div className="vt-level-modal-grid">
                        {MEMORY_DIFFICULTIES.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`vt-level-btn ${difficulty === item.id ? "vt-level-btn-active" : ""}`}
                            onClick={() => changeDifficulty(item.id)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="ui-button vt-start-btn"
                        onClick={() => void startGameForDifficulty()}
                      >
                        {
                          MEMORY_DIFFICULTIES.find(
                            (item) => item.id === difficulty,
                          )?.label
                        }{" "}
                        단계로 시작
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
