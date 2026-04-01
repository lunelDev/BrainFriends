"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { BALLOON_GROWTH_DIFFICULTIES } from "@/data/balloonGrowthData";
import { useBalloonAudioInput } from "@/lib/audio/useBalloonAudioInput";

type BalloonResult = {
  type: "success" | "fail";
  title: string;
  subtitle: string;
  voicedSeconds: string;
  averageVolume: number;
  stability: number;
};

type BalloonDifficulty = (typeof BALLOON_GROWTH_DIFFICULTIES)[number];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function BalloonSvg({
  scale,
  isDanger,
  isPopped,
  isOptimal,
}: {
  scale: number;
  isDanger: boolean;
  isPopped: boolean;
  isOptimal: boolean;
}) {
  return (
    <div
      className={`balloon-game-balloon ${isDanger ? "is-danger" : ""} ${isPopped ? "is-popped" : ""} ${isOptimal ? "is-optimal" : ""}`}
      style={{ "--balloon-scale": String(scale) } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 320" className="balloon-game-balloon-svg">
        <defs>
          <linearGradient id="balloonFill" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ff93c9" />
            <stop offset="55%" stopColor="#ff6aa8" />
            <stop offset="100%" stopColor="#ff4f83" />
          </linearGradient>
          <linearGradient id="balloonShine" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path
          d="M120 26c43 0 78 35 78 90 0 62-46 91-62 111-5 7-7 19-7 28h-18c0-9-2-21-7-28-16-20-62-49-62-111 0-55 35-90 78-90Z"
          fill="url(#balloonFill)"
        />
        <ellipse cx="92" cy="94" rx="28" ry="46" fill="url(#balloonShine)" />
        <path d="M112 252h16l-8 18-8-18Z" fill="#ef5c91" />
        <path
          d="M120 270c-2 12-12 20-12 34 0 10 6 16 12 16s12-6 12-16c0-14-10-22-12-34Z"
          fill="none"
          stroke="#8ab3ff"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <div className="balloon-game-balloon-shadow" />
    </div>
  );
}

function ResultModal({
  result,
  onRestart,
  onHome,
  currentProgress,
}: {
  result: BalloonResult;
  onRestart: () => void;
  onHome?: (() => void) | undefined;
  currentProgress?: number;
}) {
  const router = useRouter();
  const { type, title, subtitle } = result;
  const isSuccess = type === "success";
  const isBurst = title === "풍선이 터졌어요";
  const isTimeout = title === "시간 초과";
  const handleHome = onHome ?? (() => router.push("/select-page/game-mode"));
  const icon = isSuccess ? "✨" : isBurst ? "💥" : "⏳";
  const progressValue = Math.round(currentProgress ?? 0);
  const themeColor = isSuccess ? "bg-violet-600" : isBurst ? "bg-rose-500" : "bg-amber-500";
  const lightBg = isSuccess ? "bg-violet-50" : isBurst ? "bg-rose-50" : "bg-amber-50";
  const textColor = isSuccess ? "text-violet-600" : isBurst ? "text-rose-600" : "text-amber-600";
  const badgeText = isSuccess ? "Training Complete" : "Try Again";

  return (
    <LingoResultModalShell
      icon={icon}
      badgeText={badgeText}
      title={title}
      subtitle={subtitle}
      headerToneClass={lightBg}
      iconToneClass={themeColor}
      badgeToneClass={textColor}
      primaryLabel={isSuccess ? "다음 단계 도전하기" : "다시 시도하기"}
      onPrimary={onRestart}
      primaryButtonClass={`${themeColor} shadow-violet-100`}
      secondaryLabel="메인 화면으로 돌아가기"
      onSecondary={handleHome}
      footerNote={`Session Report Index: ${Date.now().toString().slice(-6)}`}
      maxWidthClass="max-w-[480px]"
    >
          {isTimeout ? (
            <div className="mb-8 rounded-[32px] border-2 border-amber-100 bg-amber-50/50 p-6 text-center">
              <div className="mb-2 flex justify-between text-xs font-black text-amber-600">
                <span>목표 도달률</span>
                <span>{progressValue}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-white shadow-inner">
                <div
                  className="h-full bg-amber-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] font-bold text-amber-400">
                조금만 더 길게 소리를 유지해 볼까요?
              </p>
            </div>
          ) : null}

          <div className="mb-10 grid grid-cols-3 gap-3">
            {[
              { label: "발성 시간", value: `${result.voicedSeconds}s`, sub: "Time" },
              { label: "평균 음량", value: result.averageVolume, sub: "Volume" },
              { label: "안정성", value: `${result.stability}%`, sub: "Stable" },
            ].map((stat) => (
              <div
                key={stat.sub}
                className="rounded-[28px] border-2 border-slate-50 bg-slate-50/50 p-4 text-center"
              >
                <span className="mb-1 block text-[9px] font-black uppercase tracking-tighter text-slate-400">
                  {stat.sub}
                </span>
                <strong className="block text-xl font-black text-slate-800">{stat.value}</strong>
              </div>
            ))}
          </div>
    </LingoResultModalShell>
  );
}

function SelectionModal({
  difficulties,
  onSelect,
  onBack,
}: {
  difficulties: readonly BalloonDifficulty[];
  onSelect: (difficulty: BalloonDifficulty) => void;
  onBack?: (() => void) | undefined;
}) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.push("/select-page/game-mode"));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md sm:p-6">
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[36px] border-4 border-white bg-white shadow-[0_24px_60px_rgba(0,0,0,0.32)] ring-1 ring-slate-300 transition-all sm:rounded-[56px] sm:border-[6px] sm:shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={handleBack}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-violet-200 hover:text-violet-600 sm:right-5 sm:top-5"
          aria-label="홈으로 이동"
          title="홈"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.5 9.5V21h13V9.5" />
            <path d="M10 21v-5h4v5" />
          </svg>
        </button>
        <div className="border-b-2 border-slate-200 bg-slate-50/80 px-5 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-12">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-violet-600 text-white shadow-[0_12px_30px_rgba(124,58,237,0.3)] ring-4 ring-violet-50 sm:mb-6 sm:h-20 sm:w-20 sm:rounded-[32px]">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2a7 7 0 0 0-7 7c0 5.1 7 13 7 13s7-7.9 7-13a7 7 0 0 0-7-7Z" />
              <circle cx="12" cy="9" r="3" />
            </svg>
          </div>
          <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.28em] text-violet-500 sm:text-[12px] sm:tracking-[0.4em]">
            Rehab Protocol
          </span>
          <h3 className="text-[1.9rem] font-black tracking-tighter text-slate-900 sm:text-4xl">
            훈련 단계 설정
          </h3>
        </div>

        <div className="space-y-3 bg-white p-4 sm:space-y-4 sm:p-8">
          {difficulties.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="group relative flex w-full items-center gap-3 rounded-[24px] border-2 border-slate-300 bg-slate-50/70 p-4 text-left transition-all hover:border-violet-500 hover:bg-white hover:shadow-[0_20px_40px_rgba(124,58,237,0.1)] active:scale-[0.97] sm:gap-6 sm:rounded-[32px] sm:p-6"
              onClick={() => onSelect(item)}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white text-base font-black text-slate-800 shadow-sm ring-1 ring-slate-300 transition-all group-hover:bg-violet-600 group-hover:text-white group-hover:ring-violet-600 sm:h-14 sm:w-14 sm:rounded-[22px] sm:text-lg">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-start justify-between gap-2 sm:items-center sm:gap-3">
                  <strong className="text-base font-black text-slate-900 transition-colors group-hover:text-violet-600 sm:text-xl">
                    {item.label}
                  </strong>
                  <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700 ring-1 ring-violet-200 sm:px-3 sm:text-[11px]">
                    {item.stage.durationSec}s
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-600 group-hover:text-slate-700 sm:text-sm">
                  {item.desc}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t-2 border-white pt-3 sm:mt-4 sm:gap-4 sm:pt-4">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-400 sm:text-[10px]">
                      Safe Range
                    </span>
                    <span className="text-[11px] font-black text-slate-800 sm:text-xs">
                      {item.stage.safeMin}~{item.stage.safeMax}dB
                    </span>
                  </div>
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-400 sm:text-[10px]">
                      Danger
                    </span>
                    <span className="text-[11px] font-black text-rose-500 sm:text-xs">
                      {item.stage.dangerMin}dB
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 sm:block">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-violet-500"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="pb-3 sm:pb-4" />
      </div>
    </div>
  );
}

export default function BalloonGrowthGame({ onBack }: { onBack?: () => void }) {
  const { volume, isMicReady, error, start, stop } = useBalloonAudioInput();
  const [phase, setPhase] = useState<"select" | "playing" | "success" | "fail">(
    "select",
  );
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<BalloonDifficulty | null>(null);
  const [balloonSize, setBalloonSize] = useState(18);
  const [timeLeft, setTimeLeft] = useState(0);
  const [dangerRatio, setDangerRatio] = useState(0);
  const [message, setMessage] = useState("단계를 고른 뒤 풍선을 키워 보세요.");
  const [result, setResult] = useState<BalloonResult | null>(null);
  const [testVoiceBoost, setTestVoiceBoost] = useState(false);

  const voicedMsRef = useRef(0);
  const safeMsRef = useRef(0);
  const totalVolumeRef = useRef(0);
  const sampleCountRef = useRef(0);
  const dangerMsRef = useRef(0);
  const silenceMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const previousVolumeRef = useRef(0);
  const toneHoldMsRef = useRef(0);

  const difficulty = selectedDifficulty ?? BALLOON_GROWTH_DIFFICULTIES[0];
  const stage = difficulty.stage;
  const effectiveVolume = testVoiceBoost
    ? Math.max(volume, Math.round((stage.safeMin + stage.safeMax) / 2))
    : volume;

  const targetProgress = clamp((balloonSize / stage.targetSize) * 100, 0, 100);
  const safeWidth = stage.safeMax - stage.safeMin;
  const dangerLeft = `${stage.dangerMin}%`;
  const safeLeft = `${stage.safeMin}%`;
  const liveWidth = `${effectiveVolume}%`;
  const isDanger = phase === "playing" && effectiveVolume >= stage.dangerMin;
  const isSafe =
    phase === "playing" &&
    effectiveVolume >= stage.safeMin &&
    effectiveVolume <= stage.safeMax;
  const safeCenter = (stage.safeMin + stage.safeMax) / 2;
  const safeHalf = Math.max(1, (stage.safeMax - stage.safeMin) / 2);
  const optimalRatio = clamp(
    1 - Math.abs(effectiveVolume - safeCenter) / safeHalf,
    0,
    1,
  );
  const isOptimal = isSafe && optimalRatio >= 0.72;
  const balloonScale = 0.48 + (balloonSize / stage.targetSize) * 0.46;
  const balloonTone =
    phase !== "playing"
      ? "준비"
      : isDanger
        ? "위험"
        : isOptimal
          ? "최적"
          : isSafe
            ? "성장 중"
            : "대기";

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (phase !== "playing") {
      lastTickRef.current = null;
      previousVolumeRef.current = 0;
      toneHoldMsRef.current = 0;
      return;
    }

    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = lastTickRef.current ? now - lastTickRef.current : 100;
      lastTickRef.current = now;
      const deltaSec = delta / 1000;

      setTimeLeft((prev) => Math.max(0, prev - deltaSec));

      const inSafeRange =
        effectiveVolume >= stage.safeMin && effectiveVolume <= stage.safeMax;
      const inDangerRange = effectiveVolume >= stage.dangerMin;
      const voicedFloor = Math.max(4, stage.silenceThreshold - 5);
      const isSilent = effectiveVolume <= voicedFloor;
      const sustainedVoiceRange =
        effectiveVolume > voicedFloor && effectiveVolume < stage.dangerMin;
      const nearSafeLowRange =
        effectiveVolume >= Math.max(voicedFloor + 1, stage.safeMin - 20) &&
        effectiveVolume < stage.safeMin;
      const volumeDelta = Math.abs(effectiveVolume - previousVolumeRef.current);
      const toneStable = sustainedVoiceRange && volumeDelta <= 10;

      if (toneStable) {
        toneHoldMsRef.current += delta;
      } else if (!inSafeRange) {
        toneHoldMsRef.current = Math.max(0, toneHoldMsRef.current - delta * 0.4);
      }

      if (inSafeRange) {
        const closeness = 1 - Math.abs(effectiveVolume - safeCenter) / safeHalf;
        const growth =
          stage.growthPerSecond * clamp(0.55 + closeness * 0.45, 0.55, 1);

        voicedMsRef.current += delta;
        safeMsRef.current += delta;
        totalVolumeRef.current += effectiveVolume;
        sampleCountRef.current += 1;
        dangerMsRef.current = 0;
        silenceMsRef.current = 0;
        setDangerRatio(0);
        setBalloonSize((prev) =>
          clamp(prev + growth * deltaSec, stage.startSize, stage.targetSize),
        );
        setMessage(
          isOptimal
            ? "완벽해요. 풍선이 가장 예쁘게 커지고 있어요."
            : "좋아요. 풍선이 안정적으로 커지고 있어요.",
        );
      } else if (toneHoldMsRef.current >= 180 && nearSafeLowRange) {
        const toneGrowth =
          stage.growthPerSecond *
          clamp(0.42 + (toneHoldMsRef.current / 1800) * 0.28, 0.42, 0.72);

        voicedMsRef.current += delta;
        totalVolumeRef.current += effectiveVolume;
        sampleCountRef.current += 1;
        dangerMsRef.current = 0;
        silenceMsRef.current = 0;
        setDangerRatio(0);
        setBalloonSize((prev) =>
          clamp(prev + toneGrowth * deltaSec, stage.startSize, stage.targetSize),
        );
        setMessage(
          "좋아요. 일정한 톤을 유지하고 있어서 풍선이 커지고 있어요.",
        );
      } else if (sustainedVoiceRange) {
        voicedMsRef.current += delta;
        totalVolumeRef.current += effectiveVolume;
        sampleCountRef.current += 1;
        dangerMsRef.current = 0;
        silenceMsRef.current = 0;
        setDangerRatio(0);

        if (toneHoldMsRef.current >= 120) {
          const sustainGrowth =
            stage.growthPerSecond *
            clamp(0.18 + (toneHoldMsRef.current / 2200) * 0.2, 0.18, 0.34);
          setBalloonSize((prev) =>
            clamp(prev + sustainGrowth * deltaSec, stage.startSize, stage.targetSize),
          );
          setMessage("아주 좋아요. 소리를 유지하면 풍선이 천천히 커져요.");
        } else {
          setMessage("좋아요. 계속 같은 소리로 유지해 보세요.");
        }
      } else if (inDangerRange) {
        voicedMsRef.current += delta;
        totalVolumeRef.current += effectiveVolume;
        sampleCountRef.current += 1;
        dangerMsRef.current += delta;
        silenceMsRef.current = 0;
        setDangerRatio(
          clamp((dangerMsRef.current / stage.dangerHoldMs) * 100, 0, 100),
        );
        setMessage("위험해요. 소리를 조금만 줄여 보세요.");
      } else if (isSilent) {
        dangerMsRef.current = 0;
        setDangerRatio(0);
        silenceMsRef.current += delta;
        if (silenceMsRef.current >= stage.silenceDelayMs * 1.8) {
          setBalloonSize((prev) =>
            Math.max(stage.startSize, prev - stage.shrinkPerSecond * 0.65 * deltaSec),
          );
          setMessage("소리가 멈췄어요. 풍선이 다시 작아지고 있어요.");
        } else {
          setMessage("잠깐 멈췄어요. 다시 소리를 내 보세요.");
        }
      } else if (effectiveVolume > 6) {
        voicedMsRef.current += delta;
        totalVolumeRef.current += effectiveVolume;
        sampleCountRef.current += 1;
        dangerMsRef.current = 0;
        silenceMsRef.current = 0;
        setDangerRatio(0);
        setMessage("조금 더 안정적인 크기로 소리를 내 보세요.");
      }

      previousVolumeRef.current = effectiveVolume;

      if (dangerMsRef.current >= stage.dangerHoldMs) {
        finishGame("burst");
        return;
      }

      if (balloonSize >= stage.targetSize) {
        finishGame("success");
        return;
      }

      if (timeLeft - deltaSec <= 0) {
        finishGame("timeout");
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [
    balloonSize,
    effectiveVolume,
    isOptimal,
    phase,
    safeCenter,
    safeHalf,
    stage,
    timeLeft,
  ]);

  function resetSessionState(nextDifficulty: BalloonDifficulty) {
    const nextStage = nextDifficulty.stage;
    setSelectedDifficulty(nextDifficulty);
    setBalloonSize(nextStage.startSize);
    setTimeLeft(nextStage.durationSec);
    setDangerRatio(0);
    setResult(null);
    voicedMsRef.current = 0;
    safeMsRef.current = 0;
    totalVolumeRef.current = 0;
    sampleCountRef.current = 0;
    dangerMsRef.current = 0;
    silenceMsRef.current = 0;
    lastTickRef.current = null;
    previousVolumeRef.current = 0;
    toneHoldMsRef.current = 0;
  }

  function buildResult(type: "success" | "burst" | "timeout"): BalloonResult {
    const averageVolume =
      sampleCountRef.current > 0
        ? Math.round(totalVolumeRef.current / sampleCountRef.current)
        : 0;
    const stability =
      voicedMsRef.current > 0
        ? Math.round((safeMsRef.current / voicedMsRef.current) * 100)
        : 0;

    if (type === "success") {
      return {
        type: "success",
        title: "풍선 완성!",
        subtitle: "안전한 소리를 잘 유지해서 목표 크기에 도달했어요.",
        voicedSeconds: (voicedMsRef.current / 1000).toFixed(1),
        averageVolume,
        stability,
      };
    }

    if (type === "burst") {
      return {
        type: "fail",
        title: "풍선이 터졌어요",
        subtitle: "소리가 너무 커서 풍선이 버티지 못했어요.",
        voicedSeconds: (voicedMsRef.current / 1000).toFixed(1),
        averageVolume,
        stability,
      };
    }

    return {
      type: "fail",
      title: "시간 초과",
      subtitle: "시간 안에 목표 크기에 도달하지 못했어요.",
      voicedSeconds: (voicedMsRef.current / 1000).toFixed(1),
      averageVolume,
      stability,
    };
  }

  function finishGame(type: "success" | "burst" | "timeout") {
    stop();
    setPhase(type === "success" ? "success" : "fail");
    setResult(buildResult(type));
  }

  async function handleStart(nextDifficulty: BalloonDifficulty) {
    resetSessionState(nextDifficulty);
    const micStarted = isMicReady || (await start());
    if (!micStarted) {
      setMessage("마이크를 연결하지 못했어요. 다시 시도해 보세요.");
      return;
    }
    setMessage("소리를 내서 풍선을 키워 보세요.");
    setPhase("playing");
  }

  function handleRestart() {
    stop();
    setPhase("select");
    setSelectedDifficulty(null);
    setBalloonSize(18);
    setTimeLeft(0);
    setDangerRatio(0);
    setResult(null);
    setMessage("단계를 고른 뒤 풍선을 키워 보세요.");
    previousVolumeRef.current = 0;
    toneHoldMsRef.current = 0;
  }

  return (
    <LingoGameShell
      badge="Game Training • Voice Control"
      title="풍선 키우기"
      onRestart={handleRestart}
      onBack={onBack}
      statusLabel={phase === "playing" ? balloonTone.toUpperCase() : "READY"}
    >
      <div className="vt-layout vt-layout-playing tetris-layout-no-left">
        <section className="balloon-game-container relative flex h-full w-full flex-1 flex-col gap-3 px-0 py-4 sm:gap-5 sm:px-0 sm:py-5">
          <div className="grid grid-cols-3 items-center gap-2 sm:grid-cols-[104px_minmax(0,1fr)_104px] sm:gap-3 lg:grid-cols-[120px_minmax(0,1fr)_120px] lg:gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px]">
            <div className="min-w-0 rounded-[20px] border border-slate-100 bg-white/92 px-2 py-2 text-center shadow-sm backdrop-blur sm:rounded-[24px] sm:px-3 sm:py-2.5 lg:rounded-[28px] lg:px-4 lg:py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Time
              </span>
              <strong className="text-lg font-black text-slate-700 sm:text-xl lg:text-2xl xl:text-3xl">
                {Math.ceil(timeLeft)}s
              </strong>
            </div>
            <div className="min-w-0 rounded-[20px] border border-slate-100 bg-white/92 px-3 py-2.5 shadow-sm backdrop-blur sm:rounded-[24px] sm:px-4 sm:py-3 lg:rounded-[28px] lg:px-5 lg:py-4">
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <span>Progress</span>
                <span>{Math.round(targetProgress)}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:mt-2.5 sm:h-3 lg:mt-3 lg:h-3.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-400 via-violet-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${targetProgress}%` }}
                />
              </div>
            </div>
            <div className="min-w-0 rounded-[20px] border border-slate-100 bg-white/92 px-2 py-2 text-center shadow-sm backdrop-blur sm:rounded-[24px] sm:px-3 sm:py-2.5 lg:rounded-[28px] lg:px-4 lg:py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Level
              </span>
              <strong className="text-lg font-black text-slate-700 sm:text-xl lg:text-2xl xl:text-3xl">
                {difficulty.label}
              </strong>
            </div>
          </div>

          <div
            className={`relative grid min-h-[500px] flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-b from-violet-50 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_60px_rgba(148,163,184,0.14)] sm:min-h-[520px] sm:rounded-[36px] lg:min-h-[620px] lg:rounded-[44px] xl:min-h-[760px] ${
              isDanger ? "from-rose-50 to-white" : isOptimal ? "from-violet-50 to-indigo-50" : ""
            }`}
          >
            <span className="balloon-cloud balloon-cloud-a" />
            <span className="balloon-cloud balloon-cloud-b" />
            <span className="balloon-cloud balloon-cloud-c" />

            <div className="relative z-10 w-full max-w-4xl justify-self-center px-5 pt-4 text-center sm:px-6 sm:pt-7 lg:px-8 lg:pt-10">
              <span
                className={`inline-flex min-h-[30px] items-center rounded-full px-3 text-[11px] font-black shadow-sm sm:min-h-[34px] sm:px-4 sm:text-xs lg:min-h-[38px] lg:px-5 lg:text-sm ${
                  isDanger
                    ? "bg-rose-500 text-white"
                    : isOptimal
                      ? "bg-violet-600 text-white"
                      : isSafe
                        ? "bg-violet-500 text-white"
                        : "bg-white text-slate-500"
                }`}
              >
                {balloonTone}
              </span>
              <p
                className={`mx-auto mt-2 max-w-[260px] text-sm font-semibold leading-6 sm:mt-3 sm:max-w-xl sm:text-[15px] lg:mt-4 lg:max-w-3xl lg:text-base xl:text-lg ${
                  isDanger ? "text-rose-600" : "text-slate-600"
                }`}
              >
                {message}
              </p>
            </div>

            <div className="flex min-h-0 items-center justify-center px-4 py-4 sm:px-6 lg:px-8">
              <div className="balloon-game-balloon-stage scale-[0.82] sm:scale-100 lg:scale-[1.18] xl:scale-[1.32]">
                <div
                  className={`balloon-game-ripples ${phase === "playing" ? "is-active" : ""} ${isDanger ? "is-danger" : ""}`}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
                <BalloonSvg
                  scale={balloonScale}
                  isDanger={isDanger}
                  isPopped={phase === "fail" && result?.title === "풍선이 터졌어요"}
                  isOptimal={isOptimal}
                />
                {isDanger ? <div className="balloon-game-warning">위험!</div> : null}
              </div>
            </div>

            <div className="grid gap-3 border-t border-violet-100/80 bg-white/76 p-3 backdrop-blur-xl sm:gap-4 sm:p-4 lg:grid-cols-2 lg:p-5">
              <div className="rounded-[24px] border border-slate-100 bg-white px-4 py-4 shadow-sm sm:rounded-[26px] sm:px-4 sm:py-4 lg:rounded-[30px] lg:px-5 lg:py-5">
                <div className="mb-2 flex items-end justify-between gap-3 sm:mb-3">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Live Volume
                  </span>
                  <span className="text-lg font-black text-slate-700 sm:text-xl lg:text-2xl">
                    {effectiveVolume}
                    <small className="ml-1 text-[10px] font-medium text-slate-400">dB</small>
                  </span>
                </div>
                <div className="relative h-4 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                  <div
                    className="absolute z-10 h-full border-x border-violet-400/35 bg-violet-300/20"
                    style={{ left: `${stage.safeMin}%`, width: `${safeWidth}%` }}
                  />
                  <div
                    className="absolute z-0 h-full bg-rose-300/18"
                    style={{ left: dangerLeft, width: `${100 - stage.dangerMin}%` }}
                  />
                  <div
                    className={`absolute z-20 h-full rounded-full transition-all duration-150 ${
                      isDanger
                        ? "bg-gradient-to-r from-rose-400 to-rose-600"
                        : "bg-gradient-to-r from-violet-400 to-indigo-600"
                    }`}
                    style={{ width: liveWidth }}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-100 bg-white px-4 py-4 shadow-sm sm:rounded-[26px] sm:px-4 sm:py-4 lg:rounded-[30px] lg:px-5 lg:py-5">
                <div className="mb-2 flex items-end justify-between gap-3 sm:mb-3">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Danger Accumulation
                  </span>
                  <span
                    className={`text-lg font-black sm:text-xl lg:text-2xl ${
                      dangerRatio > 70 ? "text-rose-500" : "text-slate-700"
                    }`}
                  >
                    {Math.round(dangerRatio)}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-150"
                    style={{ width: `${dangerRatio}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`w-full rounded-[22px] py-3.5 text-base font-black text-white shadow-lg shadow-slate-200 transition-transform active:scale-[0.98] sm:rounded-[24px] sm:py-4 sm:text-base lg:rounded-[26px] lg:py-5 lg:text-lg ${
              testVoiceBoost
                ? "bg-gradient-to-r from-violet-600 to-indigo-600"
                : "bg-slate-800"
            }`}
            onMouseDown={() => setTestVoiceBoost(true)}
            onMouseUp={() => setTestVoiceBoost(false)}
            onMouseLeave={() => setTestVoiceBoost(false)}
            onTouchStart={() => setTestVoiceBoost(true)}
            onTouchEnd={() => setTestVoiceBoost(false)}
          >
            테스트 발성 올리기
          </button>

          {error ? (
            <p className="rounded-[20px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 sm:rounded-[24px]">
              {error}
            </p>
          ) : null}

          {phase === "select" ? (
            <SelectionModal
              difficulties={BALLOON_GROWTH_DIFFICULTIES}
              onSelect={(item) => void handleStart(item)}
              onBack={onBack}
            />
          ) : null}

          {(phase === "success" || phase === "fail") && result ? (
            <ResultModal
              result={result}
              onRestart={handleRestart}
              onHome={onBack}
              currentProgress={targetProgress}
            />
          ) : null}
        </section>
      </div>
    </LingoGameShell>
  );
}
