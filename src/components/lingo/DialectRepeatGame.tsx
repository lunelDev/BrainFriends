// src/components/lingo/DialectRepeatGame.tsx
//
// 신규 게임: 사투리 따라하기 (dialect_repeat)
//
// 흐름: 사투리 표현(큰 글자) + 표준어(작은 글자) + 지역 배지를 보여주고,
//        환자가 정확히 따라 발화. 한 미션 = 한 사투리에 대해 N번 성공하면 클리어.
//
// 데이터: regionMissionsData.ts 의 mission.dialectRepeat = { dialect, standard, region }
//   진입 쿼리 (?regionId&cityId&missionId) 가 없으면 폴백 (부산 사투리).
//
// STT / 매칭 / 점수 / 라이프사이클 — PlaceNameGame 과 동일 골격.
//   차이점: 단일 타깃을 N번 반복 성공해야 클리어 (place_name 은 N개 다른 타깃 1번씩).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { getMissionById } from "@/constants/regionMissionsData";
import { normalizeWord } from "@/lib/lingo/normalizeWord";
import { useRegionMissionMark } from "@/hooks/useRegionMissionMark";

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: new () => any;
    webkitSpeechRecognition?: new () => any;
  };

type RoundStatus = "idle" | "success" | "fail";

const FALLBACK_DIALECT = {
  dialect: "마이묵으래이",
  standard: "많이 먹으렴",
  region: "부산",
};
const SUCCESS_TARGET = 3; // 같은 사투리를 N번 성공해야 클리어
const TOTAL_TIME_MS = 60_000;
// 사투리는 표준어 매칭보다 발음이 까다롭다 → 매칭 임계치 살짝 완화 (Levenshtein ≤ 2).
const LEV_TOLERANCE = 2;

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

// 사투리 매칭 — 사투리 자체와 표준어(보조) 모두 시도. 둘 중 하나라도 매칭되면 인정.
//   이유: STT 엔진이 사투리를 표준어로 환원해 인식하는 경우가 많다.
function isDialectMatched(transcript: string, dialect: string, standard: string) {
  const t = normalizeWord(transcript);
  if (!t) return false;

  const candidates = [dialect, standard].filter(Boolean).map(normalizeWord);
  for (const c of candidates) {
    if (!c) continue;
    if (t === c) return true;
    if (t.includes(c) || c.includes(t)) return true;
    if (
      Math.abs(t.length - c.length) <= LEV_TOLERANCE &&
      levenshtein(t, c) <= LEV_TOLERANCE
    )
      return true;
  }
  return false;
}

function formatElapsed(startedAt: number | null, finishedAt: number | null) {
  if (!startedAt || !finishedAt) return "-";
  const sec = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ResultModal({
  successCount,
  targetCount,
  wrongCount,
  elapsedLabel,
  onHome,
  onRestart,
}: {
  successCount: number;
  targetCount: number;
  wrongCount: number;
  elapsedLabel: string;
  onHome: () => void;
  onRestart: () => void;
}) {
  const successRate =
    targetCount > 0
      ? Math.round((Math.min(successCount, targetCount) / targetCount) * 100)
      : 0;

  return (
    <LingoResultModalShell
      icon="🗣️"
      badgeText="Dialect Repeat"
      title="사투리 따라하기 완료"
      subtitle="지역의 정겨운 말씨를 따라 말해 봤습니다."
      headerToneClass="bg-transparent"
      iconToneClass="bg-gradient-to-br from-[#fdcb6e] to-[#e17055]"
      badgeToneClass="text-amber-200"
      primaryButtonClass="bg-gradient-to-r from-[#3a2410] to-[#e17055]"
      primaryLabel="단계 선택으로"
      onPrimary={onHome}
      secondaryLabel="다시 시작"
      onSecondary={onRestart}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-[24px] border border-amber-500/22 bg-[#0c0820]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-amber-200/60">
            성공률
          </span>
          <strong className="text-3xl font-black text-amber-200">
            {successRate}%
          </strong>
        </div>
        <div className="rounded-[24px] border border-amber-500/22 bg-[#0c0820]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-amber-200/60">
            오답
          </span>
          <strong className="text-3xl font-black text-white">{wrongCount}</strong>
        </div>
        <div className="rounded-[24px] border border-amber-500/22 bg-[#0c0820]/85 p-4 text-center">
          <span className="mb-2 block text-[11px] font-black text-amber-200/60">
            걸린 시간
          </span>
          <strong className="text-3xl font-black text-white">{elapsedLabel}</strong>
        </div>
      </div>
    </LingoResultModalShell>
  );
}

export default function DialectRepeatGame({
  onBack,
}: {
  onBack?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const regionMission = useRegionMissionMark();
  const regionId = searchParams.get("regionId") ?? "";
  const cityId = searchParams.get("cityId") ?? "";
  const missionId = searchParams.get("missionId") ?? "";

  // 미션 데이터 로드 (옵셔널 — 직접 진입 시 폴백).
  const mission =
    regionId && cityId && missionId
      ? getMissionById(regionId, cityId, missionId)
      : null;
  const missionTitle = mission?.title ?? "사투리 따라하기";
  const dialectData = useMemo(() => {
    return mission?.dialectRepeat ?? FALLBACK_DIALECT;
  }, [mission?.dialectRepeat]);

  // 게임 상태.
  const [successCount, setSuccessCount] = useState(0);
  const [heardText, setHeardText] = useState("");
  const [message, setMessage] = useState(
    "위 사투리를 또렷하게 따라 말해 보세요.",
  );
  const [status, setStatus] = useState<RoundStatus>("idle");
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(TOTAL_TIME_MS);
  const [gameStarted, setGameStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionFinishedAt, setSessionFinishedAt] = useState<number | null>(
    null,
  );

  // 게임화 — 콤보 / floating 점수.
  const [comboStreak, setComboStreak] = useState(0);
  const [floatingScores, setFloatingScores] = useState<
    { id: number; value: number; mult: number }[]
  >([]);
  const comboStreakRef = useRef(0);
  const floatingIdRef = useRef(0);

  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const autoStartedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const penaltyUntilRef = useRef(0);

  // 게임화 — 막판 10초 위험 신호.
  const isTimeDanger = gameStarted && timeLeftMs > 0 && timeLeftMs <= 10_000;

  const stageMapHref = "/select-page/game-mode";
  const stageMapReturnHref = regionId
    ? `/select-page/game-mode?regionId=${encodeURIComponent(regionId)}${cityId ? `&cityId=${encodeURIComponent(cityId)}` : ""}`
    : "/select-page/game-mode";

  const stopRecognition = useCallback(() => {
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
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const finishGame = useCallback(
    (cleared: boolean) => {
      keepListeningRef.current = false;
      setGameStarted(false);
      stopRecognition();
      setSessionFinishedAt(Date.now());
      setShowResult(true);

      if (cleared) {
        regionMission.markCleared();
      }
    },
    [regionMission, stopRecognition],
  );

  const onRecognizedWord = useCallback(
    (transcript: string) => {
      if (!gameStarted || Date.now() < penaltyUntilRef.current) return;

      setHeardText(transcript);

      if (isDialectMatched(transcript, dialectData.dialect, dialectData.standard)) {
        // 정답 — 콤보 +1, 멀티플라이어 ×1/×2/×3, floating 점수.
        const newStreak = comboStreakRef.current + 1;
        comboStreakRef.current = newStreak;
        const mult = newStreak >= 5 ? 3 : newStreak >= 3 ? 2 : 1;
        const points = 25 * mult;

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
            ? `🔥 정확합니다! ×${mult} 콤보! (${successCount + 1}번째 성공)`
            : `정확합니다! "${dialectData.dialect}" — ${successCount + 1}번째 성공`,
        );
        penaltyUntilRef.current = Date.now() + 500;
        window.setTimeout(() => setStatus("idle"), 320);
        setSuccessCount((prev) => prev + 1);
        return;
      }

      // 오답 — 너무 짧은 발화는 무시 (잡음).
      const trimmed = normalizeWord(transcript);
      if (trimmed.length < 2) return;

      // 콤보 끊김.
      comboStreakRef.current = 0;
      setComboStreak(0);

      setStatus("fail");
      setWrongCount((prev) => prev + 1);
      setScore((prev) => Math.max(0, prev - 10));
      setMessage(
        `다시 한번 또렷하게: "${dialectData.dialect}"`,
      );
      penaltyUntilRef.current = Date.now() + 700;
      window.setTimeout(() => setStatus("idle"), 380);
    },
    [dialectData.dialect, dialectData.standard, gameStarted, successCount],
  );

  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!Recognition) {
      setMessage(
        "브라우저 음성 인식이 없어 아래 테스트 버튼으로 확인할 수 있습니다.",
      );
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
      setMessage(
        "음성 인식 중 오류가 발생했습니다. 테스트 버튼으로도 확인할 수 있습니다.",
      );
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
      setMessage(
        "음성 인식을 시작하지 못했습니다. 테스트 버튼으로 진행할 수 있습니다.",
      );
    }
  }, [gameStarted, onRecognizedWord]);

  const restart = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopRecognition();
    // 게임화 상태 리셋.
    comboStreakRef.current = 0;
    setComboStreak(0);
    setFloatingScores([]);
    setSuccessCount(0);
    setHeardText("");
    setMessage("위 사투리를 또렷하게 따라 말해 보세요.");
    setStatus("idle");
    setScore(0);
    setWrongCount(0);
    setTimeLeftMs(TOTAL_TIME_MS);
    setGameStarted(true);
    setShowResult(false);
    setSessionStartedAt(Date.now());
    setSessionFinishedAt(null);
    keepListeningRef.current = true;
    startRecognition();
  }, [startRecognition, stopRecognition]);

  // 자동 시작.
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

  // 타이머.
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

  // N번 성공 시 종료.
  useEffect(() => {
    if (!gameStarted) return;
    if (successCount >= SUCCESS_TARGET) {
      finishGame(true);
    }
  }, [finishGame, gameStarted, successCount]);

  const handleTestPass = useCallback(() => {
    onRecognizedWord(dialectData.dialect);
  }, [dialectData.dialect, onRecognizedWord]);

  const elapsedLabel = formatElapsed(sessionStartedAt, sessionFinishedAt);
  const timeLeftSec = Math.ceil(timeLeftMs / 1000);
  const timeLeftLabel = `${timeLeftSec}s`;
  const progressLabel = `${Math.min(successCount, SUCCESS_TARGET)} / ${SUCCESS_TARGET}`;
  const statusLabel =
    status === "fail" ? "오답" : status === "success" ? "정답" : "대기";

  return (
    <LingoGameShell
      badge="Game Mode • Dialect Repeat"
      title={missionTitle}
      onRestart={restart}
      onBack={onBack ?? (() => router.push(stageMapReturnHref))}
      statusLabel={statusLabel}
      progressLabel={progressLabel}
      headerActions={
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-amber-400/35 bg-amber-500/12 px-3 py-1.5 text-[11px] font-black text-amber-100">
            ⏱ {timeLeftLabel}
          </div>
          <div className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black text-emerald-100">
            +{score}
          </div>
        </div>
      }
      variant="gameMode"
    >
      {/* 게임화 keyframe — 접두사 dr- 로 namespace 격리. */}
      <style>{`
        @keyframes dr-float-up {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
          18% { transform: translate(-50%, -10px) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -130px) scale(1); opacity: 0; }
        }
        .dr-float-score { animation: dr-float-up 1.2s ease-out forwards; }
        @keyframes dr-combo-pop {
          0% { transform: scale(0.7); opacity: 0; }
          40% { transform: scale(1.16); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .dr-combo-pop { animation: dr-combo-pop 0.4s ease-out; }
        @keyframes dr-spark-fly {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          12% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, 0px))) scale(0.2);
            opacity: 0;
          }
        }
        .dr-spark {
          position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, #fdcb6e 40%, transparent 70%);
          box-shadow: 0 0 8px rgba(253,203,110,0.9);
          animation: dr-spark-fly 0.9s ease-out forwards;
          pointer-events: none;
        }
        @keyframes dr-star-spin {
          0% { transform: translate(-50%, -50%) scale(0.4) rotate(0deg); opacity: 0; }
          15% { transform: translate(-50%, -50%) scale(1.4) rotate(60deg); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--tx, 0px)), calc(-50% + var(--ty, 0px))) scale(0.3) rotate(360deg);
            opacity: 0;
          }
        }
        .dr-star {
          position: absolute; left: 50%; top: 50%;
          width: 14px; height: 14px;
          color: #fde68a; font-size: 14px; line-height: 14px;
          text-shadow: 0 0 10px rgba(253,224,71,0.9);
          animation: dr-star-spin 1.0s ease-out forwards;
          pointer-events: none;
        }
        @keyframes dr-edge-flash {
          0%, 100% { box-shadow: 0 24px 64px rgba(225,112,85,0.22), inset 0 0 0 rgba(244,63,94,0); }
          50% { box-shadow: 0 24px 64px rgba(225,112,85,0.22), inset 0 0 50px rgba(244,63,94,0.18); }
        }
        .dr-edge-flash { animation: dr-edge-flash 0.9s ease-in-out infinite; }
      `}</style>
      <div className="mx-auto flex max-w-[920px] flex-col gap-6">
        {/* 콤보 배지 — 자리 항상 차지, streak < 2 시 opacity 0. */}
        <div className="flex h-[34px] items-center justify-center">
          <div
            key={`combo-${comboStreak}`}
            aria-hidden={comboStreak < 2}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-black transition-opacity duration-300 ${
              comboStreak >= 2
                ? "dr-combo-pop border-amber-400/55 bg-amber-500/15 text-amber-100 opacity-100 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                : "border-transparent bg-transparent text-transparent opacity-0"
            }`}
          >
            <span aria-hidden="true">🔥</span>
            <span>COMBO ×{comboStreak >= 5 ? 3 : 2}</span>
            <span className="text-amber-200/70 text-xs">({comboStreak} 연속)</span>
          </div>
        </div>

        {/* 메인 카드 — 사투리 + 표준어 + 지역 배지 */}
        <div
          className={`relative overflow-hidden rounded-[36px] border bg-gradient-to-br from-[#1a1208] via-[#160e1f] to-[#0a0a1c] p-10 text-center shadow-[0_24px_64px_rgba(225,112,85,0.22)] transition-colors ${
            isTimeDanger
              ? "dr-edge-flash border-rose-500/50"
              : "border-amber-500/30"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(253,203,110,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(253,203,110,0.10)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />

          {/* 지역 배지 */}
          <div className="relative mb-4 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/12 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.32em] text-amber-200">
              <span aria-hidden="true">📍</span>
              {dialectData.region} 사투리
            </span>
          </div>

          {/* 사투리 메인 */}
          <h3 className="relative break-keep text-5xl font-black tracking-tight text-white sm:text-6xl">
            {dialectData.dialect}
          </h3>

          {/* +점수 floating + spark/별 폭발 — 메인 카드 중앙. */}
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 block h-0 w-0"
            aria-hidden="true"
          >
            {floatingScores.map((f) => (
              <div
                key={f.id}
                className="dr-float-score absolute left-0 top-0 -translate-x-1/2 whitespace-nowrap text-center"
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
            {status === "success"
              ? Array.from({ length: 8 }).map((_, i) => {
                  const angle = (i / 8) * Math.PI * 2;
                  const distance = 60 + (i % 3) * 8;
                  return (
                    <span
                      key={`sp-${successCount}-${i}`}
                      className="dr-spark"
                      style={
                        {
                          "--tx": `${Math.cos(angle) * distance}px`,
                          "--ty": `${Math.sin(angle) * distance}px`,
                          animationDelay: `${i * 0.02}s`,
                        } as React.CSSProperties
                      }
                    />
                  );
                })
              : null}
            {status === "success"
              ? Array.from({ length: 4 }).map((_, i) => {
                  const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                  const distance = 80;
                  return (
                    <span
                      key={`st-${successCount}-${i}`}
                      className="dr-star"
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
                })
              : null}
          </span>

          {/* 표준어 (보조) */}
          <p className="relative mt-4 text-base font-bold text-slate-300 sm:text-lg">
            <span className="text-slate-500">표준어 </span>
            <span className="text-slate-100">{dialectData.standard}</span>
          </p>

          <p className="relative mt-6 text-sm font-bold text-amber-200/80">
            사투리를 또렷하게 따라 말해 보세요 ({SUCCESS_TARGET}회 성공 시 클리어)
          </p>

          {/* 진행 점 */}
          <div className="relative mt-6 flex items-center justify-center gap-2">
            {Array.from({ length: SUCCESS_TARGET }).map((_, idx) => {
              const cleared = idx < successCount;
              const active = idx === successCount;
              return (
                <span
                  key={idx}
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full transition-all ${
                    cleared
                      ? "bg-emerald-400"
                      : active
                        ? "bg-amber-300 ring-2 ring-amber-400/40"
                        : "bg-slate-700"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* 인식 결과 + 안내 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-700/60 bg-[#0c0820]/70 p-5">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              들린 말
            </span>
            <p className="min-h-[2.4em] text-lg font-black text-white">
              {heardText || <span className="text-slate-500">…</span>}
            </p>
          </div>
          <div
            className={`rounded-[24px] border p-5 transition-colors ${
              status === "success"
                ? "border-emerald-400/50 bg-emerald-500/10"
                : status === "fail"
                  ? "border-rose-400/50 bg-rose-500/10"
                  : "border-amber-500/30 bg-amber-500/8"
            }`}
          >
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-amber-200/70">
              안내
            </span>
            <p className="text-sm font-bold text-slate-100">{message}</p>
          </div>
        </div>

        {/* 테스트 / 패스 / 종료 버튼 */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleTestPass}
            disabled={!gameStarted}
            className={`rounded-full px-5 py-2 text-xs font-black transition-all ${trainingButtonStyles.slateSoft} disabled:opacity-40`}
          >
            테스트 통과 (사투리 인식)
          </button>
          <button
            type="button"
            onClick={() => router.push(stageMapHref)}
            className={`rounded-full px-5 py-2 text-xs font-black transition-all ${trainingButtonStyles.slateSoft}`}
          >
            그만두기
          </button>
        </div>
      </div>

      {showResult ? (
        <ResultModal
          successCount={successCount}
          targetCount={SUCCESS_TARGET}
          wrongCount={wrongCount}
          elapsedLabel={elapsedLabel}
          onHome={() => router.push(stageMapReturnHref)}
          onRestart={restart}
        />
      ) : null}
    </LingoGameShell>
  );
}
