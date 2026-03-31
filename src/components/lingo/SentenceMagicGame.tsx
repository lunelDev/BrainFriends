"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SENTENCE_EXAMPLE_QUESTIONS,
  SENTENCE_MAGIC_MODES,
  TONGUE_TWISTER_QUESTION_GROUPS,
  TONGUE_TWISTER_QUESTIONS,
  TONGUE_TWISTER_THRESHOLDS,
} from "@/data/sentenceGameData";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";

function shuffleWords(words) {
  return [...words].sort(() => Math.random() - 0.5);
}

function isRecordingSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function normalizeText(text) {
  return text
    .replace(/\s+/g, "")
    .replace(/[.!?,]/g, "")
    .trim();
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
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

function getAccuracyScore(heard, answer) {
  if (!heard || !answer) return 0;
  const maxLength = Math.max(heard.length, answer.length);
  if (maxLength === 0) return 100;
  const distance = levenshtein(heard, answer);
  return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}

function HomeIcon() {
  return (
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
  );
}

function getRoundGuide(isExampleMode, threshold) {
  return isExampleMode
    ? `단어를 보고 문장을 만든 뒤 녹음을 정지해 보세요.`
    : `문장을 읽고 녹음을 정지해 보세요.`;
}

function isBattleFinished(playerHp, enemyHp) {
  return playerHp <= 0 || enemyHp <= 0;
}

export default function SentenceMagicGame({ onBack }) {
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState(
    "문장을 확인한 뒤 녹음을 시작해 보세요.",
  );
  const [recognitionText, setRecognitionText] = useState("");
  const [supported, setSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [accuracyScore, setAccuracyScore] = useState(0);
  const [playerHp, setPlayerHp] = useState(3);
  const [enemyHp, setEnemyHp] = useState(3);
  const [showSetupModal, setShowSetupModal] = useState(true);
  const [selectedModeId, setSelectedModeId] = useState("example");
  const [selectedThreshold, setSelectedThreshold] = useState(55);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [battleModal, setBattleModal] = useState(null);
  const [battleDetailsOpen, setBattleDetailsOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [shuffledWords, setShuffledWords] = useState(() =>
    shuffleWords(SENTENCE_EXAMPLE_QUESTIONS[0].answer),
  );
  const {
    volume,
    error: micError,
    start: startAudioMonitor,
    stop: stopAudioMonitor,
  } = useAudioAnalyzer();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const mode =
    SENTENCE_MAGIC_MODES.find((item) => item.id === selectedModeId) ??
    SENTENCE_MAGIC_MODES[0];
  const isExampleMode = selectedModeId === "example";
  const questions = useMemo(() => {
    if (selectedModeId !== "tongue") {
      return SENTENCE_EXAMPLE_QUESTIONS;
    }

    return (
      TONGUE_TWISTER_QUESTION_GROUPS[selectedThreshold] ??
      TONGUE_TWISTER_QUESTIONS
    );
  }, [selectedModeId, selectedThreshold]);
  const question = questions[index];
  const targetSentence = useMemo(
    () => question.answer.join(" "),
    [question.answer],
  );
  const battleEnded = isBattleFinished(playerHp, enemyHp);

  useEffect(() => {
    setSupported(isRecordingSupported());
  }, []);

  useEffect(() => {
    return () => {
      stopAudioMonitor();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
    };
  }, [stopAudioMonitor]);

  function resetRound(nextIndex = 0) {
    setIndex(nextIndex);
    setRecognitionText("");
    setAccuracyScore(0);
    setBattleDetailsOpen(false);
    setShuffledWords(shuffleWords(questions[nextIndex].answer));
    setServerError("");
  }

  function resetBattleState() {
    setPlayerHp(3);
    setEnemyHp(3);
  }

  function openSetup() {
    stopAudioMonitor();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    setIsRecording(false);
    setIsAnalyzing(false);
    setBattleModal(null);
    setBattleDetailsOpen(false);
    setServerError("");
    setShowSetupModal(true);
    setMessage("모드를 고른 뒤 시작해 보세요.");
  }

  function startSelectedMode() {
    setShowSetupModal(false);
    resetBattleState();
    resetRound(0);
    setMessage(getRoundGuide(isExampleMode, selectedThreshold));
  }

  function buildSuccessModal(nextAccuracy: number) {
    const isLast = index === questions.length - 1;
    const nextEnemyHp = Math.max(0, enemyHp - 1);
    const isClear = nextEnemyHp === 0;
    return {
      type: "success",
      title: isClear ? "VICTORY" : "공격 성공",
      subtitle: isClear
        ? "상대의 HP를 모두 깎아 전투에서 이겼어요."
        : isLast
          ? "마지막 주문까지 성공했어요."
          : "내 마법이 먼저 적중했어요.",
      playerText: "내 주문이 정확하게 맞았어요.",
      enemyText: "상대가 크게 흔들렸어요.",
      accuracy: nextAccuracy,
      transcript: recognitionText,
      playerHp,
      enemyHp: nextEnemyHp,
      isLast: isLast || isClear,
    };
  }

  function buildFailModal(nextAccuracy: number) {
    const nextPlayerHp = Math.max(0, playerHp - 1);
    const isDefeat = nextPlayerHp === 0;
    return {
      type: "fail",
      title: isDefeat ? "DEFEAT" : "반격 피격",
      subtitle: isDefeat
        ? "내 HP가 모두 떨어져 전투에서 졌어요."
        : "상대가 먼저 반격했어요.",
      playerText: "내 주문이 빗나갔어요.",
      enemyText: "상대가 반격에 성공했어요.",
      accuracy: nextAccuracy,
      transcript: recognitionText,
      playerHp: nextPlayerHp,
      enemyHp,
      isLast: isDefeat,
    };
  }

  function evaluateTranscript(transcript: string) {
    const normalizedHeard = normalizeText(transcript);
    const normalizedAnswer = normalizeText(targetSentence);
    const nextAccuracy = getAccuracyScore(normalizedHeard, normalizedAnswer);
    const cleanedTranscript = transcript || "-";

    setRecognitionText(cleanedTranscript);
    setAccuracyScore(nextAccuracy);
    setBattleDetailsOpen(false);

    if (normalizedHeard && nextAccuracy >= selectedThreshold) {
      const modal = buildSuccessModal(nextAccuracy);
      modal.transcript = cleanedTranscript;
      setBattleModal(modal);
      setMessage(`정확도 ${nextAccuracy}%입니다.`);
      return;
    }

    const modal = buildFailModal(nextAccuracy);
    modal.transcript = cleanedTranscript;
    setBattleModal(modal);
    setMessage(`정확도 ${nextAccuracy}%입니다.`);
  }

  async function analyzeRecording(audioBlob: Blob) {
    setIsAnalyzing(true);
    setServerError("");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "sentence-magic.webm");
      formData.append("targetText", targetSentence);
      formData.append("threshold", String(selectedThreshold));

      const response = await fetch("/api/proxy/stt", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "STT server request failed.");
      }

      setIsAnalyzing(false);
      evaluateTranscript(String(result.text ?? "").trim());
    } catch (error) {
      setIsAnalyzing(false);
      const message =
        error instanceof Error ? error.message : "음성 분석 중 오류가 발생했어요.";
      setServerError(message);
      setMessage("음성 분석에 실패했어요. 다시 시도해 보세요.");
    }
  }

  function stopRecording() {
    stopAudioMonitor();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function beginRecordingSession() {
    if (!isRecordingSupported()) {
      setSupported(false);
      setMessage("이 브라우저에서는 녹음을 사용할 수 없어요.");
      return;
    }

    const micStarted = await startAudioMonitor();
    if (!micStarted) {
      setMessage("마이크를 사용할 수 없어 녹음을 시작하지 못했어요.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        if (blob.size > 0) {
          void analyzeRecording(blob);
        } else {
          setMessage("녹음된 음성이 없어요. 다시 시도해 보세요.");
        }
      };

      recorder.start();
      setRecognitionText("");
      setAccuracyScore(0);
      setBattleDetailsOpen(false);
      setServerError("");
      setIsRecording(true);
      setMessage("녹음 중이에요. 문장을 읽은 뒤 정지해 보세요.");
    } catch (_) {
      stopAudioMonitor();
      setMessage("녹음을 시작하지 못했어요. 마이크 권한을 확인해 주세요.");
    }
  }

  function toggleRecording() {
    if (battleEnded || battleModal) {
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    void beginRecordingSession();
  }

  function restart() {
    openSetup();
    resetBattleState();
    resetRound(0);
  }

  function closeBattleModal() {
    const shouldAdvance =
      !battleModal?.isLast && !isBattleFinished(playerHp, enemyHp);
    setBattleModal(null);
    if (shouldAdvance) {
      resetRound(index + 1);
      setMessage(getRoundGuide(isExampleMode, selectedThreshold));
      return;
    }

    if (enemyHp <= 0) {
      openSetup();
      resetBattleState();
      resetRound(0);
      setMessage("클리어. 단계 선택에서 다시 시작해 보세요.");
      return;
    }

    if (playerHp <= 0) {
      openSetup();
      resetBattleState();
      resetRound(0);
      setMessage("패배. 단계 선택에서 다시 도전해 보세요.");
    }
  }

  function runExampleBattle(success) {
    const mockTranscript = success ? targetSentence : `${targetSentence} 예시`;
    const mockAccuracy = success
      ? Math.max(selectedThreshold + 10, 92)
      : Math.max(selectedThreshold - 12, 38);

    setRecognitionText(mockTranscript);
    setAccuracyScore(0);
    setIsAnalyzing(true);

    window.setTimeout(() => {
      setIsAnalyzing(false);
      evaluateTranscript(mockTranscript);
    }, 1200);
  }

  const recordButtonScale = isRecording ? 1 + volume / 260 : 1;
  const waveHeights = Array.from({ length: 9 }, (_, waveIndex) => {
    const distanceFromCenter = Math.abs(waveIndex - 4);
    const heightBoost = Math.max(0, volume - distanceFromCenter * 8);
    return 10 + Math.round(heightBoost * 0.4);
  });

  return (
    <main className="app-shell vt-shell">
      <section className="game-card vt-card">
        <div className="game-header vt-header">
          <div>
            <p className="eyebrow">LingoFriends</p>
            <h1>문장 마법</h1>
            <p className="vt-header-copy">
              따라 읽을 문장을 보고 녹음한 뒤, 정확도에 따라 내가 공격하거나
              상대가 반격하는 말하기 훈련입니다.
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
                <HomeIcon />
              </button>
            ) : null}
          </div>
        </div>

        <div className="sentence-magic-layout sentence-magic-layout-single">
          <section className="sentence-magic-board">
            <div className="sentence-magic-hero sentence-magic-hero-stage">
              <div className="sentence-magic-badge-row">
                <span className="sentence-magic-badge">{mode.label}</span>
                <span className="sentence-magic-state">
                  {isAnalyzing
                    ? "분석 중"
                    : isRecording
                      ? "녹음 중"
                      : "녹음 대기"}
                </span>
              </div>

              <div className="sentence-magic-top-line">
                {isExampleMode ? (
                  <div className="sentence-magic-top-chips">
                    {shuffledWords.map((word, wordIndex) => (
                      <span
                        key={`${word}-${wordIndex}`}
                        className="sentence-magic-chip sentence-magic-chip-answer"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="sentence-magic-full-line">
                    {question.answer.map((line, lineIndex) => (
                      <span
                        key={`${line}-${lineIndex}`}
                        className="sentence-magic-full-line-part"
                      >
                        {line}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              <div className="sentence-magic-record-stage">
                <div
                  className={`sentence-record-ripples ${isRecording ? "is-active" : ""}`}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
                <button
                  type="button"
                  className={`sentence-record-icon-button ${isRecording ? "is-recording" : ""}`}
                  onClick={toggleRecording}
                  disabled={isAnalyzing || battleEnded}
                  aria-label={isRecording ? "녹음 정지" : "녹음 시작"}
                  title={isRecording ? "녹음 정지" : "녹음 시작"}
                  style={{
                    transform: `scale(${recordButtonScale})`,
                  }}
                >
                  {isRecording ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="36"
                      height="36"
                      fill="currentColor"
                    >
                      <rect x="7" y="7" width="10" height="10" rx="2" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="36"
                      height="36"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <path d="M12 19v3" />
                    </svg>
                  )}
                </button>
                <strong>
                  {battleEnded
                    ? enemyHp <= 0
                      ? "전투 종료"
                      : "패배"
                    : isRecording
                      ? "녹음 정지"
                      : "녹음 시작"}
                </strong>
                <span>{isAnalyzing ? "문장을 분석하고 있어요." : message}</span>
                <div
                  className={`sentence-record-wave ${isRecording ? "is-active" : ""}`}
                  aria-hidden="true"
                >
                  {waveHeights.map((height, waveIndex) => (
                    <span
                      key={waveIndex}
                      style={
                        isRecording ? { height: `${height}px` } : undefined
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="sentence-magic-result">
                <div className="sentence-magic-result-head">
                  <span>인식된 문장</span>
                  <strong>
                    {supported
                      ? isRecording
                        ? "REC"
                        : isAnalyzing
                          ? "..."
                        : `${accuracyScore}%`
                      : "지원 안 됨"}
                  </strong>
                </div>
                <p>
                  {recognitionText ||
                    "녹음 시작을 누르고 문장을 읽은 뒤 정지하면 결과가 여기에 표시됩니다."}
                </p>
              </div>

              <div className="sentence-magic-demo-actions">
                <button
                  type="button"
                  className="ui-button secondary-button"
                  onClick={() => runExampleBattle(true)}
                >
                  성공 예시
                </button>
                <button
                  type="button"
                  className="ui-button secondary-button"
                  onClick={() => runExampleBattle(false)}
                >
                  실패 예시
                </button>
              </div>

              {micError ? (
                <p className="voice-error text-red-400 text-sm">{micError}</p>
              ) : null}
              {serverError ? (
                <p className="voice-error text-red-400 text-sm">{serverError}</p>
              ) : null}
            </div>

            {showSetupModal ? (
              <div className="vt-level-modal">
                <div className="vt-level-modal-card sentence-magic-setup-card">
                  <p className="eyebrow">LingoFriends</p>
                  <h3>모드를 선택해 주세요</h3>
                  <p>원하는 모드와 단계를 고른 뒤 시작해 보세요.</p>
                  <div className="sentence-magic-mode-grid">
                    {SENTENCE_MAGIC_MODES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`sentence-magic-mode-btn ${selectedModeId === item.id ? "is-active" : ""}`}
                        onClick={() => setSelectedModeId(item.id)}
                      >
                        <span className="sentence-magic-mode-emoji">
                          {item.emoji}
                        </span>
                        <strong>{item.label}</strong>
                        <span>{item.desc}</span>
                      </button>
                    ))}
                  </div>
                  <div className="sentence-magic-threshold-block">
                    <span>도전 단계</span>
                    <div className="vt-level-modal-grid sentence-magic-threshold-grid">
                      {TONGUE_TWISTER_THRESHOLDS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`vt-level-btn ${selectedThreshold === item.threshold ? "vt-level-btn-active" : ""}`}
                          onClick={() => setSelectedThreshold(item.threshold)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ui-button vt-start-btn"
                    onClick={startSelectedMode}
                  >
                    {mode.label} 시작
                  </button>
                </div>
              </div>
            ) : null}

            {battleModal ? (
              <div className="vt-report-modal">
                <div
                  className={`vt-report-modal-card sentence-magic-battle-modal ${
                    battleModal.isLast
                      ? "sentence-magic-battle-modal-final"
                      : ""
                  }`}
                >
                  <h3
                    className={
                      battleModal.isLast
                        ? battleModal.type === "success"
                          ? "sentence-magic-final-heading is-win"
                          : "sentence-magic-final-heading is-fail"
                        : undefined
                    }
                  >
                    {battleModal.title}
                  </h3>
                  <p>{battleModal.subtitle}</p>
                  {battleModal.isLast ? (
                    <div className="sentence-magic-final-hero">
                      <div
                        className={`sentence-magic-final-showdown ${
                          battleModal.type === "success"
                            ? "player-wins"
                            : "enemy-wins"
                        }`}
                      >
                        <div
                          className="sentence-magic-final-arena"
                          aria-hidden="true"
                        />
                        <div
                          className="sentence-magic-final-burst"
                          aria-hidden="true"
                        />
                        <div className="sentence-magic-final-combatant player">
                          <span className="sentence-magic-final-emoji">🧙</span>
                          <b>나</b>
                        </div>
                        <div className="sentence-magic-final-combatant enemy">
                          <span className="sentence-magic-final-emoji">👾</span>
                          <b>상대</b>
                        </div>
                      </div>
                      <strong className="sentence-magic-final-winner">
                        {battleModal.type === "success"
                          ? "내가 이겼어요"
                          : "상대가 이겼어요"}
                      </strong>
                      <div className="sentence-magic-final-info">
                        <div className="sentence-magic-final-hp-row">
                          <div className="sentence-magic-final-hp-card">
                            <span>나</span>
                            <div className="sentence-magic-hp sentence-magic-modal-hp">
                              {Array.from({ length: 3 }, (_, i) => (
                                <span
                                  key={i}
                                  className={`sentence-magic-hp-dot ${i < battleModal.playerHp ? "is-on" : ""}`}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="sentence-magic-final-hp-card">
                            <span>상대</span>
                            <div className="sentence-magic-hp sentence-magic-modal-hp">
                              {Array.from({ length: 3 }, (_, i) => (
                                <span
                                  key={i}
                                  className={`sentence-magic-hp-dot enemy ${i < battleModal.enemyHp ? "is-on" : ""}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="sentence-magic-modal-duo">
                        <div
                          className={`sentence-magic-modal-card ${
                            battleModal.type === "success"
                              ? "is-win sentence-magic-modal-card-attack"
                              : "is-dim sentence-magic-modal-card-hit"
                          }`}
                        >
                          <span
                            className="sentence-magic-emoji"
                            aria-hidden="true"
                          >
                            🧙
                          </span>
                          <strong>나</strong>
                          <div className="sentence-magic-hp sentence-magic-modal-hp">
                            {Array.from({ length: 3 }, (_, i) => (
                              <span
                                key={i}
                                className={`sentence-magic-hp-dot ${i < battleModal.playerHp ? "is-on" : ""}`}
                              />
                            ))}
                          </div>
                          <p>{battleModal.playerText}</p>
                          <span className="sentence-magic-damage-tag">
                            {battleModal.type === "success" ? "공격" : "피격"}
                          </span>
                        </div>
                        <div
                          className={`sentence-magic-modal-card ${
                            battleModal.type === "fail"
                              ? "is-win sentence-magic-modal-card-attack"
                              : "is-dim sentence-magic-modal-card-hit"
                          }`}
                        >
                          <span
                            className="sentence-magic-emoji"
                            aria-hidden="true"
                          >
                            👾
                          </span>
                          <strong>상대</strong>
                          <div className="sentence-magic-hp sentence-magic-modal-hp">
                            {Array.from({ length: 3 }, (_, i) => (
                              <span
                                key={i}
                                className={`sentence-magic-hp-dot enemy ${i < battleModal.enemyHp ? "is-on" : ""}`}
                              />
                            ))}
                          </div>
                          <p>{battleModal.enemyText}</p>
                          <span className="sentence-magic-damage-tag">
                            {battleModal.type === "fail" ? "공격" : "피격"}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`sentence-magic-modal-impact ${
                          battleModal.type === "success"
                            ? "from-player"
                            : "from-enemy"
                        }`}
                        aria-hidden="true"
                      />
                    </>
                  )}
                  <div
                    className={`sentence-magic-modal-score ${
                      battleModal.isLast ? "sentence-magic-final-info" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setBattleDetailsOpen((value) => !value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setBattleDetailsOpen((value) => !value);
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "4px",
                      }}
                    >
                      <span>정확도</span>
                      <span
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          color: "#6f8aa4",
                        }}
                      >
                        인식 문장 보기
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <strong>{battleModal.accuracy}%</strong>
                      <span
                        aria-hidden="true"
                        style={{
                          fontSize: "1.2rem",
                          lineHeight: 1,
                          color: "#3f678f",
                          transform: battleDetailsOpen
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 180ms ease",
                        }}
                      >
                        ▾
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      maxHeight: battleDetailsOpen ? "140px" : "0",
                      opacity: battleDetailsOpen ? 1 : 0,
                      overflow: "hidden",
                      transition: "max-height 220ms ease, opacity 180ms ease",
                      marginTop: battleDetailsOpen ? "12px" : "0",
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid rgba(180, 211, 236, 0.6)",
                        background: "rgba(255,255,255,0.72)",
                        borderRadius: "16px",
                        padding: "14px 16px",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 800,
                          color: "#5f7c98",
                          marginBottom: "6px",
                        }}
                      >
                        인식된 문장
                      </div>
                      <div
                        style={{
                          fontSize: "1rem",
                          lineHeight: 1.5,
                          color: "#1f405d",
                          wordBreak: "keep-all",
                        }}
                      >
                        {recognitionText || battleModal.transcript || "-"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ui-button vt-start-btn ${
                      battleModal.isLast ? "sentence-magic-final-info" : ""
                    }`}
                    onClick={closeBattleModal}
                  >
                    {battleModal.isLast ? "단계 선택으로" : "다음으로"}
                  </button>
                </div>
              </div>
            ) : null}

            {isAnalyzing ? (
              <div className="vt-report-modal">
                <div className="vt-report-modal-card sentence-magic-analyzing-modal">
                  <span
                    className="sentence-magic-impact-icon"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 120 120"
                      width="120"
                      height="120"
                      fill="none"
                    >
                      <g transform="rotate(-45 60 60)">
                        <rect
                          x="54"
                          y="12"
                          width="12"
                          height="62"
                          rx="4"
                          fill="#c7d2de"
                        />
                        <rect
                          x="49"
                          y="68"
                          width="22"
                          height="8"
                          rx="4"
                          fill="#d4a72c"
                        />
                        <rect
                          x="56"
                          y="76"
                          width="8"
                          height="22"
                          rx="4"
                          fill="#b42318"
                        />
                      </g>
                      <g transform="rotate(45 60 60)">
                        <rect
                          x="54"
                          y="12"
                          width="12"
                          height="62"
                          rx="4"
                          fill="#c7d2de"
                        />
                        <rect
                          x="49"
                          y="68"
                          width="22"
                          height="8"
                          rx="4"
                          fill="#d4a72c"
                        />
                        <rect
                          x="56"
                          y="76"
                          width="8"
                          height="22"
                          rx="4"
                          fill="#b42318"
                        />
                      </g>
                    </svg>
                  </span>
                  <h3>문장을 분석하고 있어요</h3>
                  <p>
                    인식된 문장과 목표 문장을 비교해 <br />
                    결과를 계산하는 중입니다.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
