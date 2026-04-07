"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import {
  registerMediaStream,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";
import {
  SENTENCE_EXAMPLE_QUESTIONS,
  SENTENCE_MAGIC_MODES,
  TONGUE_TWISTER_QUESTION_GROUPS,
  TONGUE_TWISTER_QUESTIONS,
  TONGUE_TWISTER_THRESHOLDS,
} from "@/data/sentenceGameData";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";

type SentenceQuestion = (typeof SENTENCE_EXAMPLE_QUESTIONS)[number];
type SentenceMode = (typeof SENTENCE_MAGIC_MODES)[number];
type SentenceModeId = SentenceMode["id"];
type ThresholdOption = (typeof TONGUE_TWISTER_THRESHOLDS)[number];
type ThresholdValue = ThresholdOption["threshold"];
type TongueTwisterQuestionGroups = typeof TONGUE_TWISTER_QUESTION_GROUPS;

type BattleModal = {
  type: "success" | "fail";
  title: string;
  subtitle: string;
  playerText: string;
  enemyText: string;
  accuracy: number;
  transcript: string;
  playerHp: number;
  enemyHp: number;
  isLast: boolean;
};

function shuffleWords(words: string[]) {
  return [...words].sort(() => Math.random() - 0.5);
}

function isRecordingSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function normalizeText(text: string) {
  return text
    .replace(/\s+/g, "")
    .replace(/[.!?,]/g, "")
    .trim();
}

function levenshtein(a: string, b: string) {
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

function getAccuracyScore(heard: string, answer: string) {
  if (!heard || !answer) return 0;
  const maxLength = Math.max(heard.length, answer.length);
  if (maxLength === 0) return 100;
  const distance = levenshtein(heard, answer);
  return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}

function getRoundGuide(isExampleMode: boolean, _threshold: number) {
  return isExampleMode
    ? `단어를 보고 문장을 만든 뒤 녹음을 정지해 보세요.`
    : `문장을 읽고 녹음을 정지해 보세요.`;
}

function isBattleFinished(playerHp: number, enemyHp: number) {
  return playerHp <= 0 || enemyHp <= 0;
}

function BattleStatusBar({
  playerHp,
  enemyHp,
  round,
  totalRounds,
  isRecording,
  isAnalyzing,
}: {
  playerHp: number;
  enemyHp: number;
  round: number;
  totalRounds: number;
  isRecording: boolean;
  isAnalyzing: boolean;
}) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-4xl items-center justify-between rounded-[24px] border border-white bg-white/80 px-4 py-3 shadow-xl backdrop-blur-md sm:mb-5 sm:rounded-[30px] sm:px-6 sm:py-4 lg:px-8">
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-violet-600 text-[1.55rem] shadow-[0_12px_24px_rgba(124,58,237,0.24)] transition-all duration-300 sm:h-16 sm:w-16 sm:rounded-[20px] sm:text-[1.85rem] ${
            isRecording ? "scale-105 ring-[5px] ring-violet-400/28 shadow-[0_0_0_5px_rgba(167,139,250,0.14),0_14px_30px_rgba(124,58,237,0.28)] sm:ring-[6px]" : ""
          }`}
        >
          🧙
          {isRecording ? (
            <>
              <div className="absolute -inset-1.5 rounded-[22px] border border-violet-300/70 animate-ping" />
              <div className="absolute inset-0 rounded-[20px] bg-violet-300/18 animate-pulse" />
            </>
          ) : null}
        </div>
        <div>
          <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-violet-500 sm:text-[10px] sm:tracking-widest">
            Player Vital
          </div>
          <div className="flex gap-1 sm:gap-1.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-all duration-500 sm:w-8 ${
                  i < playerHp
                    ? "bg-violet-500 shadow-[0_0_8px_#8b5cf6]"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 sm:text-[11px] sm:tracking-[0.2em]">
          Round
        </span>
        <strong className="text-base font-black text-slate-800 sm:text-lg lg:text-xl">ROUND {round}</strong>
        <div className="mt-2 h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 sm:mt-2.5 sm:w-20 lg:w-32">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300 ${
              isRecording ? "animate-pulse shadow-[0_0_16px_rgba(139,92,246,0.7)]" : ""
            }`}
            style={{ width: isRecording ? "100%" : `${(round / totalRounds) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 text-right sm:gap-4">
        <div>
          <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-rose-400 sm:text-[10px] sm:tracking-widest">
            Enemy Vital
          </div>
          <div className="flex justify-end gap-1 sm:gap-1.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-all duration-500 sm:w-8 ${
                  i < enemyHp
                    ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
        <div
          className={`relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-800 text-[1.55rem] shadow-lg transition-all duration-300 sm:h-16 sm:w-16 sm:rounded-[20px] sm:text-[1.85rem] ${
            enemyHp < 3 ? "grayscale-[0.35]" : ""
          }`}
        >
          👾
          {isAnalyzing ? (
            <>
              <div className="absolute -inset-1.5 rounded-[22px] border border-rose-300/80 animate-pulse" />
              <div className="absolute inset-0 rounded-[20px] bg-rose-500/24 animate-pulse" />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SentenceSetupModal({
  selectedModeId,
  selectedThreshold,
  onSelectMode,
  onSelectThreshold,
  onStart,
  onHome,
}: {
  selectedModeId: string;
  selectedThreshold: number;
  onSelectMode: (id: string) => void;
  onSelectThreshold: (threshold: number) => void;
  onStart: () => void;
  onHome?: () => void;
}) {
  const router = useRouter();
  const handleHome = onHome ?? (() => router.push("/select-page/game-mode"));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/80 p-6 backdrop-blur-md">
      <div className="relative my-auto w-full max-w-[560px] max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-[56px] border-[6px] border-white bg-white shadow-[0_32px_80px_rgba(0,0,0,0.4)] ring-1 ring-slate-200">
        <button
          type="button"
          onClick={handleHome}
          className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-violet-200 hover:text-violet-600"
          aria-label="홈으로 이동"
          title="홈"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V21h13V9.5" />
            <path d="M10 21v-5h4v5" />
          </svg>
        </button>

        <div className="border-b-2 border-slate-100 bg-slate-50/80 px-8 pb-8 pt-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[32px] bg-violet-600 text-white shadow-xl ring-4 ring-violet-50">
            <span className="text-4xl">✨</span>
          </div>
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.4em] text-violet-500">
            Sentence Magic Protocol
          </span>
          <h3 className="text-4xl font-black tracking-tighter text-slate-900">문장 마법</h3>
          <p className="mt-3 break-keep text-sm font-bold text-slate-400">
            모드와 도전 단계를 선택한 뒤 문장을 또렷하게 읽어 보세요.
          </p>
        </div>

        <div className="bg-white p-8">
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {SENTENCE_MAGIC_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-[32px] border-2 p-5 text-left transition-all ${
                  selectedModeId === item.id
                    ? "border-violet-600 bg-violet-600 text-white shadow-lg"
                    : "border-slate-300 bg-slate-50 text-slate-500 hover:border-violet-300 hover:bg-white"
                }`}
                onClick={() => onSelectMode(item.id)}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-3xl">{item.emoji}</span>
                  <strong className="text-xl font-black">{item.label}</strong>
                </div>
                <p className={`text-sm font-bold ${selectedModeId === item.id ? "text-violet-100" : "text-slate-400"}`}>
                  {item.desc}
                </p>
              </button>
            ))}
          </div>

          <div className="mb-8 rounded-[32px] border-2 border-violet-100 bg-violet-50/60 p-6">
            <span className="mb-4 block text-center text-[11px] font-black uppercase tracking-[0.28em] text-violet-500">
              도전 단계
            </span>
            <div className="grid grid-cols-3 gap-3">
              {TONGUE_TWISTER_THRESHOLDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-[22px] border-2 px-4 py-3 text-sm font-black transition-all ${
                    selectedThreshold === item.threshold
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-slate-200 bg-white text-slate-500 hover:border-violet-300"
                  }`}
                  onClick={() => onSelectThreshold(item.threshold)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="flex h-20 w-full items-center justify-center gap-3 rounded-[28px] bg-slate-900 text-xl font-black text-white shadow-2xl shadow-slate-200 transition-transform active:scale-95"
            onClick={onStart}
          >
            시작하기
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SentenceBattleResultModal({
  battleModal,
  battleDetailsOpen,
  setBattleDetailsOpen,
  recognitionText,
  onNext,
  onHome,
}: {
  battleModal: BattleModal;
  battleDetailsOpen: boolean;
  setBattleDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recognitionText: string;
  onNext: () => void;
  onHome?: () => void;
}) {
  const router = useRouter();
  const handleHome = onHome ?? (() => router.push("/select-page/game-mode"));

  return (
    <LingoResultModalShell
      icon={battleModal.type === "success" ? "🧙" : "👾"}
      hideIcon
      badgeText={battleModal.type === "success" ? "Battle Success" : "Battle Fail"}
      title={battleModal.title}
      subtitle={battleModal.subtitle}
      headerToneClass="bg-violet-50"
      iconToneClass={battleModal.type === "success" ? "bg-gradient-to-br from-violet-500 to-indigo-600" : "bg-gradient-to-br from-violet-600 to-fuchsia-600"}
      badgeToneClass="text-violet-600"
      primaryLabel={battleModal.isLast ? "단계 선택으로" : "다음으로"}
      onPrimary={onNext}
      secondaryLabel={battleModal.isLast ? "메인 화면으로 돌아가기" : undefined}
      onSecondary={battleModal.isLast ? handleHome : undefined}
      maxWidthClass="max-w-[560px]"
    >
      {battleModal.isLast ? (
        <div className="mb-8">
          <div className="sentence-magic-final-hero">
            <div
              className={`sentence-magic-final-showdown ${
                battleModal.type === "success" ? "player-wins" : "enemy-wins"
              }`}
            >
              <div className="sentence-magic-final-arena" aria-hidden="true" />
              <div className="sentence-magic-final-burst" aria-hidden="true" />
              <div className="sentence-magic-final-combatant player">
                <span className="sentence-magic-final-emoji">🧙</span>
                <b>나</b>
              </div>
              <div className="sentence-magic-final-combatant enemy">
                <span className="sentence-magic-final-emoji">👾</span>
                <b>상대</b>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="sentence-magic-modal-duo">
            <div
              className={`sentence-magic-modal-card ${
                battleModal.type === "success"
                  ? "is-win sentence-magic-modal-card-attack"
                  : "is-dim sentence-magic-modal-card-hit"
              }`}
            >
              <span className="sentence-magic-emoji" aria-hidden="true">🧙</span>
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
              <span className="sentence-magic-emoji" aria-hidden="true">👾</span>
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
              battleModal.type === "success" ? "from-player" : "from-enemy"
            }`}
            aria-hidden="true"
          />
          <div className="mt-5 rounded-[24px] border border-violet-100 bg-violet-50/70 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-violet-500">
                  Accuracy
                </span>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {recognitionText || battleModal.transcript || "인식된 문장이 여기에 표시됩니다."}
                </p>
              </div>
              <strong className="shrink-0 text-3xl font-black text-slate-800">
                {battleModal.accuracy}%
              </strong>
            </div>
          </div>
        </div>
      )}

      {battleModal.isLast ? (
        <>
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
              <span>정확도</span>
              <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#6f8aa4" }}>인식 문장 보기</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <strong>{battleModal.accuracy}%</strong>
              <span
                aria-hidden="true"
                style={{
                  fontSize: "1.2rem",
                  lineHeight: 1,
                  color: "#3f678f",
                  transform: battleDetailsOpen ? "rotate(180deg)" : "rotate(0deg)",
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
              marginBottom: "20px",
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
              <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#5f7c98", marginBottom: "6px" }}>
                인식된 문장
              </div>
              <div style={{ fontSize: "1rem", lineHeight: 1.5, color: "#1f405d", wordBreak: "keep-all" }}>
                {recognitionText || battleModal.transcript || "-"}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </LingoResultModalShell>
  );
}

export default function SentenceMagicGame({ onBack }: { onBack?: () => void }) {
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
  const [selectedModeId, setSelectedModeId] = useState<SentenceModeId>("example");
  const [selectedThreshold, setSelectedThreshold] = useState<ThresholdValue>(55);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [battleModal, setBattleModal] = useState<BattleModal | null>(null);
  const [battleDetailsOpen, setBattleDetailsOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [shuffledWords, setShuffledWords] = useState<string[]>(() =>
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

  const mode: SentenceMode =
    SENTENCE_MAGIC_MODES.find((item) => item.id === selectedModeId) ??
    SENTENCE_MAGIC_MODES[0];
  const isExampleMode = selectedModeId === "example";
  const questions = useMemo<SentenceQuestion[]>(() => {
    if (selectedModeId !== "tongue") {
      return SENTENCE_EXAMPLE_QUESTIONS;
    }

    return (
      TONGUE_TWISTER_QUESTION_GROUPS[selectedThreshold as keyof TongueTwisterQuestionGroups] ??
      TONGUE_TWISTER_QUESTIONS
    );
  }, [selectedModeId, selectedThreshold]);
  const question = questions[index] ?? questions[0];
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
        unregisterMediaStream(recordingStreamRef.current);
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
      unregisterMediaStream(recordingStreamRef.current);
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

  function buildSuccessModal(nextAccuracy: number): BattleModal {
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

  function buildFailModal(nextAccuracy: number): BattleModal {
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
      setEnemyHp(modal.enemyHp);
      setBattleModal(modal);
      setMessage(`정확도 ${nextAccuracy}%입니다.`);
      return;
    }

    const modal = buildFailModal(nextAccuracy);
    modal.transcript = cleanedTranscript;
    setPlayerHp(modal.playerHp);
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
      if (!response.ok) {
        throw new Error(result?.error || "STT server request failed.");
      }

      setIsAnalyzing(false);
      evaluateTranscript(String(result.text ?? "").trim());
    } catch (error) {
      setIsAnalyzing(false);
      const message =
        error instanceof Error ? error.message : "음성 분석 중 오류가 발생했어요.";
      setServerError(
        message.includes("마이크")
          ? "마이크를 확인한 뒤 다시 시도해 주세요."
          : "음성 인식 연결이 불안정합니다. 다시 시도해 주세요.",
      );
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
      registerMediaStream(stream);
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
          unregisterMediaStream(recordingStreamRef.current);
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
    if (!battleModal) {
      return;
    }

    const shouldAdvance =
      !battleModal.isLast && !isBattleFinished(battleModal.playerHp, battleModal.enemyHp);
    setBattleModal(null);
    if (shouldAdvance) {
      resetRound(index + 1);
      setMessage(getRoundGuide(isExampleMode, selectedThreshold));
      return;
    }

    if (battleModal.enemyHp <= 0) {
      openSetup();
      resetBattleState();
      resetRound(0);
      setMessage("클리어. 단계 선택에서 다시 시작해 보세요.");
      return;
    }

    if (battleModal.playerHp <= 0) {
      openSetup();
      resetBattleState();
      resetRound(0);
      setMessage("패배. 단계 선택에서 다시 도전해 보세요.");
    }
  }

  function runExampleBattle(success: boolean) {
    const mockTranscript = success ? targetSentence : "완전히 다른 예시 문장";
    const mockAccuracy = success
      ? Math.max(selectedThreshold + 10, 92)
      : Math.max(selectedThreshold - 20, 28);

    setRecognitionText(mockTranscript);
    setAccuracyScore(mockAccuracy);
    setIsAnalyzing(true);
    setBattleDetailsOpen(false);

    window.setTimeout(() => {
      setIsAnalyzing(false);
      if (success) {
        const modal = buildSuccessModal(mockAccuracy);
        modal.transcript = mockTranscript;
        setEnemyHp(modal.enemyHp);
        setBattleModal(modal);
        setMessage(`정확도 ${mockAccuracy}%입니다.`);
        return;
      }

      const modal = buildFailModal(mockAccuracy);
      modal.transcript = mockTranscript;
      setPlayerHp(modal.playerHp);
      setBattleModal(modal);
      setMessage(`정확도 ${mockAccuracy}%입니다.`);
    }, 1200);
  }

  const boostedVolume = Math.max(0, volume * 1.8 + (volume > 0 ? 6 : 0));
  const recordButtonScale = isRecording ? 1 + boostedVolume / 260 : 1;
  const waveHeights = Array.from({ length: 9 }, (_, waveIndex) => {
    const distanceFromCenter = Math.abs(waveIndex - 4);
    const heightBoost = Math.max(0, boostedVolume - distanceFromCenter * 8);
    return 10 + Math.round(heightBoost * 0.4);
  });
  const progressRatio = Math.round(((index + 1) / questions.length) * 100);
  const totalRounds = 3;
  const round = Math.min(totalRounds, Math.max(playerHp, enemyHp));
  const battleStateLabel = battleEnded
    ? enemyHp <= 0
      ? "승리"
      : "패배"
    : isAnalyzing
      ? "분석 중"
      : isRecording
        ? "녹음 중"
        : "대기";
  const isLocalDebug =
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) ||
    process.env.NEXT_PUBLIC_DEV_MODE === "true";

  return (
    <LingoGameShell
      badge="Game Training • Sentence"
      title="문장 마법"
      onRestart={restart}
      onBack={onBack}
      statusLabel={battleStateLabel}
      headerActions={
        isLocalDebug ? (
          <>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
              onClick={() => runExampleBattle(true)}
            >
              성공 예시
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
              onClick={() => runExampleBattle(false)}
            >
              실패 예시
            </button>
          </>
        ) : null
      }
    >
      <div className="vt-layout vt-layout-playing tetris-layout-no-left">
        <section className="vt-center flex flex-col items-center">
          <BattleStatusBar
            playerHp={playerHp}
            enemyHp={enemyHp}
            round={round}
            totalRounds={totalRounds}
            isRecording={isRecording}
            isAnalyzing={isAnalyzing}
          />

          <div
            className={`relative w-full max-w-4xl rounded-[28px] border-[3px] bg-white px-4 pb-6 pt-5 text-center shadow-2xl transition-all duration-500 sm:rounded-[36px] sm:border-[4px] sm:px-6 sm:pb-8 sm:pt-7 lg:rounded-[40px] lg:px-10 lg:pb-9 lg:pt-9 ${
              isRecording ? "border-violet-400 shadow-violet-100" : "border-white"
            }`}
          >
            <div className="mb-4 flex justify-center sm:mb-6">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 sm:px-4 sm:text-[10px] sm:tracking-widest">
                Selected Spell: {mode.label}
              </span>
            </div>

            <div className="mb-6 min-h-[96px] text-[2rem] font-black leading-tight tracking-tight text-slate-800 break-keep sm:mb-8 sm:min-h-[120px] sm:text-4xl lg:min-h-[132px] lg:text-5xl">
              {isExampleMode ? (
                <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
                  {shuffledWords.map((word, wordIndex) => (
                    <span
                      key={`${word}-${wordIndex}`}
                      className="rounded-2xl border-2 border-violet-100 bg-violet-50 px-4 py-2 text-violet-600 sm:px-5"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              ) : (
                targetSentence
              )}
            </div>

            <div className="flex flex-col items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isAnalyzing || battleEnded}
                aria-label={isRecording ? "녹음 정지" : "녹음 시작"}
                title={isRecording ? "녹음 정지" : "녹음 시작"}
                className={`group relative flex h-20 w-20 items-center justify-center rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-all active:scale-95 sm:h-24 sm:w-24 ${
                  isRecording
                    ? "bg-rose-500 shadow-rose-200"
                    : "bg-slate-900 shadow-slate-200 hover:bg-violet-600"
                }`}
                style={{ transform: `scale(${recordButtonScale})` }}
              >
                {isRecording ? (
                  <div className="h-7 w-7 rounded-sm bg-white sm:h-8 sm:w-8" />
                ) : (
                  <span className="text-[1.7rem] text-white sm:text-3xl">🎙️</span>
                )}
              </button>
              <div className="flex flex-col gap-1 text-center">
                <span
                  className={`text-[10px] font-black uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-widest ${
                    isRecording ? "text-rose-500" : "text-slate-400"
                  }`}
                >
                  {isRecording ? "Listening..." : "Tap to Spell"}
                </span>
                <p className="mx-auto max-w-xl text-sm font-bold text-slate-400 sm:text-[0.95rem]">{message}</p>
                <div className="mt-2 flex items-end justify-center gap-1" aria-hidden="true">
                  {waveHeights.map((height, waveIndex) => (
                    <span
                      key={waveIndex}
                      className={`w-1.5 rounded-full bg-violet-400 transition-all duration-150 ${
                        isRecording ? "opacity-100" : "opacity-50"
                      }`}
                      style={{ height: `${isRecording ? height : 10}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 w-full max-w-3xl rounded-[22px] border border-slate-100 bg-slate-50/80 px-4 py-4 text-left sm:mt-7 sm:rounded-[28px] sm:px-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-widest">
                  Real-time Recognition
                </span>
                {supported && accuracyScore > 0 ? (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-600">
                    {accuracyScore}%
                  </span>
                ) : null}
              </div>
              <p className="min-h-[2.8rem] text-sm font-bold leading-relaxed text-slate-600 sm:text-base lg:text-lg">
                {recognitionText ||
                  (isRecording
                    ? "목소리를 듣고 있습니다..."
                    : "마이크를 누르고 주문을 읽으세요.")}
              </p>
            </div>
          </div>

          {(micError || serverError) ? (
            <div className="mt-5 w-full max-w-4xl rounded-[22px] border-2 border-amber-100 bg-amber-50 px-4 py-4 shadow-sm sm:mt-6 sm:rounded-[28px] sm:px-5">
              <span className="mb-1 block text-sm font-black text-amber-700">음성 안내</span>
              <p className="text-sm font-medium leading-relaxed text-amber-800">
                {serverError || micError}
              </p>
            </div>
          ) : null}

            {showSetupModal ? (
              <SentenceSetupModal
                selectedModeId={selectedModeId}
                selectedThreshold={selectedThreshold}
                onSelectMode={setSelectedModeId}
                onSelectThreshold={setSelectedThreshold}
                onStart={startSelectedMode}
                onHome={onBack}
              />
            ) : null}

            {battleModal ? (
              <SentenceBattleResultModal
                battleModal={battleModal}
                battleDetailsOpen={battleDetailsOpen}
                setBattleDetailsOpen={setBattleDetailsOpen}
                recognitionText={recognitionText}
                onNext={closeBattleModal}
                onHome={onBack}
              />
            ) : null}

            {isAnalyzing ? (
              <div className="vt-report-modal">
                <div className="vt-report-modal-card sentence-magic-analyzing-modal">
                  <span className="sentence-magic-impact-icon" aria-hidden="true">
                    <span className="sentence-magic-analyzing-badge">✨</span>
                  </span>
                  <span className="sentence-magic-analyzing-kicker">Analyzing Spell</span>
                  <h3>문장을 분석하고 있어요</h3>
                  <p>
                    인식된 문장과 목표 문장을 비교해 <br />
                    결과를 계산하는 중입니다.
                  </p>
                  <div className="sentence-magic-analyzing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            ) : null}
        </section>
      </div>
    </LingoGameShell>
  );
}
