"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { BALLOON_GROWTH_DIFFICULTIES } from "@/data/balloonGrowthData";
import { useBalloonAudioInput } from "@/lib/audio/useBalloonAudioInput";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import { markGameModeStageCleared } from "@/lib/gameModeProgress";

type BalloonResult = {
  type: "success" | "fail";
  title: string;
  subtitle: string;
  voicedSeconds: string;
  averageVolume: number;
  stability: number;
};

type BalloonDifficulty = (typeof BALLOON_GROWTH_DIFFICULTIES)[number];
type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type BalloonSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BalloonSpeechRecognitionConstructor =
  new () => BalloonSpeechRecognitionInstance;

type BalloonSpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BalloonSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BalloonSpeechRecognitionConstructor;
  };

const VOWEL_GUIDES = [
  { vowel: "아", label: "입을 크게 열고 또렷하게" },
  { vowel: "어", label: "자연스럽게 소리를 길게 유지" },
  { vowel: "오", label: "입술을 둥글게 모아 발성" },
] as const;

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
      headerToneClass="bg-transparent"
      iconToneClass={themeColor}
      badgeToneClass="text-violet-300"
      primaryLabel="단계 선택으로"
      onPrimary={handleHome}
      primaryButtonClass={`${themeColor} shadow-black/30`}
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#05050c]/90 p-4 backdrop-blur-xl sm:p-6">
      <div className="relative my-auto w-full max-w-[520px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[36px] border border-[#2a2a5a] bg-[#111120] text-white shadow-[0_32px_80px_rgba(0,0,0,0.55)] transition-all sm:rounded-[56px]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(42,42,90,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(42,42,90,0.18)_1px,transparent_1px)] bg-[size:28px_28px] opacity-60" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#74b9ff] via-[#a29bfe] to-[#55efc4]" />
        <button
          type="button"
          onClick={handleBack}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-slate-200 shadow-sm transition-colors hover:bg-white/10 sm:right-5 sm:top-5"
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
        <div className="relative border-b border-[#2a2a5a] bg-white/[0.03] px-5 pb-5 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-12 [@media(max-height:900px)]:px-5 [@media(max-height:900px)]:pb-5 [@media(max-height:900px)]:pt-7">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-gradient-to-br from-[#a29bfe] to-[#ff6b6b] text-white shadow-[0_12px_30px_rgba(124,58,237,0.3)] sm:mb-5 sm:h-16 sm:w-16 sm:rounded-[24px] [@media(min-height:901px)]:mb-5 [@media(min-height:901px)]:h-16 [@media(min-height:901px)]:w-16 [@media(min-height:901px)]:rounded-[24px]">
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
          <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.28em] text-violet-300 sm:text-[12px] sm:tracking-[0.4em]">
            Roadmap Voice Protocol
          </span>
          <h3 className="text-xl font-black tracking-tighter text-white sm:text-[1.9rem] [@media(min-height:901px)]:text-[1.9rem]">
            훈련 단계 설정
          </h3>
        </div>

        <div className="relative space-y-2 p-3 sm:space-y-3 sm:p-5 [@media(min-height:901px)]:space-y-4 [@media(min-height:901px)]:p-6">
          {difficulties.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="group relative flex w-full items-center gap-3 rounded-[18px] border-2 border-white/10 bg-white/5 p-3 text-left transition-all hover:border-violet-400 hover:bg-white/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] active:scale-[0.97] sm:gap-4 sm:rounded-[24px] sm:p-4 [@media(min-height:901px)]:gap-6 [@media(min-height:901px)]:rounded-[28px] [@media(min-height:901px)]:p-5"
              onClick={() => onSelect(item)}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-[#090914] text-base font-black text-white shadow-sm transition-all group-hover:bg-violet-600 group-hover:text-white group-hover:ring-violet-600 sm:h-14 sm:w-14 sm:rounded-[22px] sm:text-lg">
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-start justify-between gap-2 sm:items-center sm:gap-3">
                  <strong className="text-base font-black text-white transition-colors group-hover:text-violet-200 sm:text-xl">
                    {item.label}
                  </strong>
                  <span className="shrink-0 rounded-full bg-violet-500/14 px-2.5 py-1 text-[10px] font-black text-violet-100 ring-1 ring-violet-400/25 sm:px-3 sm:text-[11px]">
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { volume, isMicReady, error, start, stop } = useBalloonAudioInput();
  const [isAdminAccount, setIsAdminAccount] = useState(false);
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
  const [waveDisplayLevel, setWaveDisplayLevel] = useState(0);
  const roadmapStageId = Number(searchParams.get("roadmapStage") || "0");
  const roadmapNodeId =
    searchParams.get("roadmapNode") || searchParams.get("roadmapSection") || "";
  const stageMapHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}`
      : "/select-page/game-mode";
  const stageMapReturnHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}?opened=1&focusNode=${encodeURIComponent(roadmapNodeId)}`
      : "/select-page/game-mode";
  const handleStageReturn = onBack ?? (() => router.push(stageMapReturnHref));

  const balloonSizeRef = useRef(18);
  const timeLeftRef = useRef(0);
  const voicedMsRef = useRef(0);
  const safeMsRef = useRef(0);
  const totalVolumeRef = useRef(0);
  const sampleCountRef = useRef(0);
  const dangerMsRef = useRef(0);
  const silenceMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const previousVolumeRef = useRef(0);
  const toneHoldMsRef = useRef(0);
  const recentVoiceMsRef = useRef(0);
  const effectiveVolumeRef = useRef(0);
  const rawVolumeRef = useRef(0);
  const guideRecognitionRef = useRef<BalloonSpeechRecognitionInstance | null>(null);
  const guideRecognitionShouldResumeRef = useRef(false);
  const guideBoostUntilRef = useRef(0);
  const autoStartedRef = useRef(false);

  const difficulty = selectedDifficulty ?? BALLOON_GROWTH_DIFFICULTIES[0];
  const stage = difficulty.stage;
  const growthFloor = 12;
  const voicedFloor = 7;
  const effectiveDangerMin = stage.dangerMin;
  const visualDangerMin = stage.dangerMin;
  const effectiveDangerHoldMs = Math.round(stage.dangerHoldMs * 2.1);
  const mappedVolume =
    volume <= 18 ? 0 : clamp(Math.round((volume - 18) * 2.8), 0, 100);
  const effectiveVolume = testVoiceBoost
    ? Math.max(volume, Math.round((stage.safeMin + stage.safeMax) / 2))
    : mappedVolume;
  const growthSpan = Math.max(1, stage.targetSize - stage.startSize);
  const relativeSize = clamp((balloonSize - stage.startSize) / growthSpan, 0, 1);
  const targetProgress = clamp(relativeSize * 100, 0, 100);
  const vowelGuide =
    VOWEL_GUIDES[
      Math.max(0, BALLOON_GROWTH_DIFFICULTIES.findIndex((item) => item.id === difficulty.id)) %
        VOWEL_GUIDES.length
    ];
  const safeWidth = stage.safeMax - stage.safeMin;
  const dangerLeft = `${visualDangerMin}%`;
  const safeLeft = `${stage.safeMin}%`;
  const liveWidth = `${effectiveVolume}%`;
  const isDanger = phase === "playing" && effectiveVolume >= visualDangerMin;
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
  const hasVoice = phase === "playing" && effectiveVolume >= voicedFloor;
  const hasGrowthVoice = phase === "playing" && effectiveVolume >= growthFloor;
  const balloonScale = 0.44 + relativeSize * 0.72;
  const progressHeadline =
    phase !== "playing"
      ? "목표 크기까지 풍선을 키워 보세요"
      : isDanger
        ? "소리를 조금만 줄여 주세요"
        : "목표까지 진행 중";
  const progressDescription =
    phase !== "playing"
      ? "안정적인 발성으로 목표 크기까지 풍선을 키워 보세요."
      : isDanger
        ? "지금보다 살짝만 낮추면 안전하게 계속 커질 수 있어요."
        : targetProgress >= 85
          ? "조금만 더 힘내면 풍선을 완성할 수 있어요."
        : targetProgress >= 60
          ? "지금처럼 같은 크기의 소리를 유지해 보세요."
        : targetProgress >= 30
          ? "숨을 끊지 말고 꾸준히 이어서 소리를 내보세요."
          : "입을 열고 편하게 소리를 내면 풍선이 커지기 시작해요.";
  const wavePattern = [0.62, 0.74, 0.86, 0.98, 1, 0.92, 0.84, 0.92, 1, 0.98, 0.86, 0.74, 0.62];
  const voiceWaveBars = wavePattern.map((multiplier) => {
    const normalized = clamp(waveDisplayLevel / 100, 0, 1);
    const height = 12 + normalized * 22 * multiplier;
    return clamp(Math.round(height), 10, 36);
  });
  const balloonTone =
    phase !== "playing"
      ? "준비"
      : isDanger
        ? "위험"
        : isOptimal
          ? "최적"
          : hasGrowthVoice
            ? "성장 중"
            : "대기";

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .then((payload) => {
        if (cancelled) return;
        const patient = payload?.patient;
        setIsAdminAccount(
          Boolean(patient && (patient.userRole === "admin" || patient.name === "관리자")),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdminAccount(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (phase !== "playing") {
      guideRecognitionShouldResumeRef.current = false;
      guideBoostUntilRef.current = 0;
      if (guideRecognitionRef.current) {
        guideRecognitionRef.current.onend = null;
        guideRecognitionRef.current.stop();
        guideRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognitionCtor =
      (window as BalloonSpeechWindow).SpeechRecognition ??
      (window as BalloonSpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    guideRecognitionRef.current = recognition;
    guideRecognitionShouldResumeRef.current = true;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += `${event.results[i][0]?.transcript ?? ""} `;
      }

      const normalized = transcript.replace(/\s+/g, "");
      if (normalized.includes(vowelGuide.vowel)) {
        guideBoostUntilRef.current = Date.now() + 1800;
      }
    };
    recognition.onerror = () => {
      // Ignore guide recognition errors; base growth still follows volume input.
    };
    recognition.onend = () => {
      if (!guideRecognitionShouldResumeRef.current) {
        return;
      }
      try {
        recognition.start();
      } catch {
        // Ignore duplicate start errors during continuous guide listening.
      }
    };

    try {
      recognition.start();
    } catch {
      // Ignore initial start errors; the game still works with volume-only growth.
    }

    return () => {
      guideRecognitionShouldResumeRef.current = false;
      guideBoostUntilRef.current = 0;
      recognition.onend = null;
      recognition.stop();
      if (guideRecognitionRef.current === recognition) {
        guideRecognitionRef.current = null;
      }
    };
  }, [phase, vowelGuide.vowel]);

  useEffect(() => {
    balloonSizeRef.current = balloonSize;
  }, [balloonSize]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    effectiveVolumeRef.current = effectiveVolume;
  }, [effectiveVolume]);

  useEffect(() => {
    rawVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    setWaveDisplayLevel((prev) => {
      if (effectiveVolume <= 0) {
        return prev * 0.72;
      }
      const blended = prev * 0.78 + effectiveVolume * 0.22;
      return Math.abs(blended - effectiveVolume) < 1.2 ? effectiveVolume : blended;
    });
  }, [effectiveVolume]);

  useEffect(() => {
    if (phase !== "playing") {
      lastTickRef.current = null;
      endTimeRef.current = null;
      previousVolumeRef.current = 0;
      toneHoldMsRef.current = 0;
      recentVoiceMsRef.current = 0;
      return;
    }

    const timer = window.setInterval(() => {
      const now = performance.now();
      const deltaRaw = lastTickRef.current ? now - lastTickRef.current : 100;
      lastTickRef.current = now;
      const delta = Math.min(deltaRaw, 120);
      const deltaSec = delta / 1000;

      if (!endTimeRef.current) {
        endTimeRef.current = now + timeLeftRef.current * 1000;
      }
      const nextTimeLeft = Math.max(0, (endTimeRef.current - now) / 1000);
      timeLeftRef.current = nextTimeLeft;
      let nextBalloonSize = balloonSizeRef.current;
      const currentVolume = effectiveVolumeRef.current;
      const currentRawVolume = rawVolumeRef.current;

      const inSafeRange =
        currentVolume >= stage.safeMin && currentVolume <= stage.safeMax;
      const inDangerRange = currentVolume >= effectiveDangerMin;
      const showDangerState = currentVolume >= visualDangerMin;
      const hasVoice = currentRawVolume >= 18 && currentVolume >= voicedFloor;
      const hasGrowthVoice = currentRawVolume >= 20 && currentVolume >= growthFloor;
      const isSilent = !hasVoice;

      if (inDangerRange) {
        voicedMsRef.current += delta;
        totalVolumeRef.current += currentVolume;
        sampleCountRef.current += 1;
        silenceMsRef.current = 0;
        dangerMsRef.current += delta;
        recentVoiceMsRef.current = 1000;
        setDangerRatio(
          clamp((dangerMsRef.current / effectiveDangerHoldMs) * 100, 0, 100),
        );
        setMessage(
          showDangerState
            ? "위험해요. 소리를 조금만 줄여 보세요."
            : "조금 높아요. 살짝만 줄이면 더 안전하게 유지할 수 있어요.",
        );
      } else if (hasGrowthVoice) {
        const guideBoostActive = Date.now() < guideBoostUntilRef.current;
        const growth =
          stage.growthPerSecond *
          (inSafeRange ? 1.32 : 1.12) *
          (guideBoostActive ? 1.35 : 1);

        voicedMsRef.current += delta;
        totalVolumeRef.current += currentVolume;
        sampleCountRef.current += 1;
        if (inSafeRange) {
          safeMsRef.current += delta;
        }
        dangerMsRef.current = 0;
        silenceMsRef.current = 0;
        recentVoiceMsRef.current = 1800;
        setDangerRatio(0);
        nextBalloonSize = clamp(
          balloonSizeRef.current + growth * deltaSec,
          stage.startSize,
          stage.targetSize,
        );
        setMessage(
          inSafeRange
            ? "좋아요. 지금처럼 소리를 유지하면 풍선이 잘 커져요."
            : "좋아요. 소리가 들어오는 동안 풍선이 계속 커져요.",
        );
      } else if (hasVoice) {
        dangerMsRef.current = 0;
        setDangerRatio(0);
        silenceMsRef.current = 0;
        recentVoiceMsRef.current = Math.max(recentVoiceMsRef.current, 900);
        setMessage("조금만 더 크게 소리를 내면 풍선이 커져요.");
      } else if (isSilent) {
        dangerMsRef.current = 0;
        setDangerRatio(0);
        silenceMsRef.current += delta;
        recentVoiceMsRef.current = Math.max(0, recentVoiceMsRef.current - delta);
        setMessage("잠깐 쉬어도 괜찮아요. 다시 소리를 이어 보세요.");
      }

      previousVolumeRef.current = currentVolume;
      setTimeLeft(nextTimeLeft);
      if (nextBalloonSize !== balloonSizeRef.current) {
        balloonSizeRef.current = nextBalloonSize;
      }
      setBalloonSize(nextBalloonSize);

      if (dangerMsRef.current >= effectiveDangerHoldMs) {
        finishGame("burst");
        return;
      }

      if (nextBalloonSize >= stage.targetSize) {
        balloonSizeRef.current = stage.targetSize;
        setBalloonSize(stage.targetSize);
        finishGame("success");
        return;
      }

      if (nextTimeLeft <= 0) {
        finishGame("timeout");
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [
    isOptimal,
    phase,
    effectiveDangerHoldMs,
    effectiveDangerMin,
    safeCenter,
    safeHalf,
    stage,
  ]);

  function resetSessionState(nextDifficulty: BalloonDifficulty) {
    const nextStage = nextDifficulty.stage;
    setSelectedDifficulty(nextDifficulty);
    setBalloonSize(nextStage.startSize);
    setTimeLeft(nextStage.durationSec);
    balloonSizeRef.current = nextStage.startSize;
    timeLeftRef.current = nextStage.durationSec;
    endTimeRef.current = null;
    setDangerRatio(0);
    setResult(null);
    voicedMsRef.current = 0;
    safeMsRef.current = 0;
    totalVolumeRef.current = 0;
    sampleCountRef.current = 0;
    dangerMsRef.current = 0;
    silenceMsRef.current = 0;
    lastTickRef.current = null;
    endTimeRef.current = null;
    previousVolumeRef.current = 0;
    toneHoldMsRef.current = 0;
    guideBoostUntilRef.current = 0;
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

  function resolveDifficultyFromParams() {
    const difficultyParam = String(searchParams.get("difficulty") || "Easy");
    const difficultyId =
      difficultyParam === "Hard" || difficultyParam === "Expert"
        ? "advanced"
        : difficultyParam === "Normal"
          ? "intermediate"
          : "beginner";

    return (
      BALLOON_GROWTH_DIFFICULTIES.find((item) => item.id === difficultyId) ??
      BALLOON_GROWTH_DIFFICULTIES[0]
    );
  }

  useEffect(() => {
    if (autoStartedRef.current) return;

    autoStartedRef.current = true;
    void handleStart(resolveDifficultyFromParams());
  }, [searchParams]);

  useEffect(() => {
    if (phase !== "success") return;
    if (roadmapStageId < 1 || !roadmapNodeId) return;
    markGameModeStageCleared(roadmapStageId, roadmapNodeId, "balloon");
  }, [phase, roadmapNodeId, roadmapStageId]);

  function handleRestart() {
    stop();
    autoStartedRef.current = false;
    void handleStart(selectedDifficulty ?? resolveDifficultyFromParams());
  }

  return (
    <LingoGameShell
      badge="Game Training • Voice Control"
      title="풍선 키우기"
      onRestart={handleRestart}
      onBack={onBack}
      variant={roadmapStageId >= 1 ? "gameMode" : "default"}
      headerActions={
        isAdminAccount ? (
          <button
            type="button"
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${
              testVoiceBoost ? trainingButtonStyles.orangeSoft : trainingButtonStyles.slateSoft
            }`}
            onMouseDown={() => setTestVoiceBoost(true)}
            onMouseUp={() => setTestVoiceBoost(false)}
            onMouseLeave={() => setTestVoiceBoost(false)}
            onTouchStart={() => setTestVoiceBoost(true)}
            onTouchEnd={() => setTestVoiceBoost(false)}
          >
            {testVoiceBoost ? "테스트 발성 중" : "테스트 발성"}
          </button>
        ) : null
      }
    >
      <div className="vt-layout vt-layout-playing tetris-layout-no-left">
        <section className="balloon-game-container relative flex h-full w-full flex-1 flex-col gap-3 px-0 py-4 sm:gap-5 sm:px-0 sm:py-5">
          <div className="grid grid-cols-3 items-center gap-2 sm:grid-cols-[104px_minmax(0,1fr)_104px] sm:gap-3 lg:grid-cols-[120px_minmax(0,1fr)_120px] lg:gap-4 xl:grid-cols-[140px_minmax(0,1fr)_140px]">
            <div className="min-w-0 rounded-[20px] border border-violet-500/20 bg-[#0c0820]/88 px-2 py-2 text-center backdrop-blur-md sm:rounded-[24px] sm:px-3 sm:py-2.5 lg:rounded-[28px] lg:px-4 lg:py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/60">
                Time
              </span>
              <strong className="text-lg font-black text-white sm:text-xl lg:text-2xl xl:text-3xl">
                {Math.ceil(timeLeft)}s
              </strong>
            </div>
            <div className="min-w-0 rounded-[20px] border border-violet-500/20 bg-[#0c0820]/88 px-3 py-2.5 backdrop-blur-md sm:rounded-[24px] sm:px-4 sm:py-3 lg:rounded-[28px] lg:px-5 lg:py-4">
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/60">
                <span>Progress</span>
                <span>{Math.round(targetProgress)}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-violet-900/30 sm:mt-2.5 sm:h-3 lg:mt-3 lg:h-3.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-sky-400 transition-all duration-300"
                  style={{ width: `${targetProgress}%` }}
                />
              </div>
            </div>
            <div className="min-w-0 rounded-[20px] border border-violet-500/20 bg-[#0c0820]/88 px-2 py-2 text-center backdrop-blur-md sm:rounded-[24px] sm:px-3 sm:py-2.5 lg:rounded-[28px] lg:px-4 lg:py-3">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/60">
                Level
              </span>
              <strong className="text-lg font-black text-white sm:text-xl lg:text-2xl xl:text-3xl">
                {difficulty.label}
              </strong>
            </div>
          </div>

          <div
            className={`relative grid min-h-[500px] flex-1 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border sm:min-h-[520px] sm:rounded-[36px] lg:min-h-[620px] lg:rounded-[44px] xl:min-h-[760px] ${
              isDanger
                ? "border-rose-500/25 bg-gradient-to-b from-[#1a0810] to-[#090914] shadow-[0_0_60px_rgba(244,63,94,0.08)]"
                : isOptimal
                  ? "border-violet-500/25 bg-gradient-to-b from-[#0f0a1e] to-[#090914] shadow-[0_0_60px_rgba(139,92,246,0.10)]"
                  : "border-violet-500/20 bg-gradient-to-b from-[#0d0a1c] to-[#090914] shadow-[0_0_40px_rgba(139,92,246,0.06)]"
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
                    : "bg-violet-500 text-white"
                }`}
              >
                {progressHeadline}
              </span>
              <p
                className={`mx-auto mt-2 min-h-[48px] max-w-[260px] text-sm font-semibold leading-6 sm:mt-3 sm:min-h-[54px] sm:max-w-xl sm:text-[15px] lg:mt-4 lg:min-h-[60px] lg:max-w-3xl lg:text-base xl:text-lg ${
                  isDanger ? "text-rose-400" : "text-slate-400"
                }`}
              >
                {progressDescription}
              </p>
            </div>

            <div className="grid min-h-0 flex-1 items-center gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:gap-8 lg:px-8">
              <div className="flex min-h-0 flex-col items-center justify-center gap-4 sm:gap-5 lg:gap-6">
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
                <div className="relative flex min-h-[60px] items-center justify-center rounded-[999px] border border-violet-500/25 bg-[#0c0820]/80 px-4 py-3 backdrop-blur-md sm:min-h-[64px] sm:px-5 lg:min-h-[70px] lg:px-6">
                  <span className="pointer-events-none absolute inset-x-4 inset-y-2 rounded-[999px] bg-gradient-to-r from-violet-900/30 via-transparent to-sky-900/20 opacity-80" />
                  <div className="relative flex items-center justify-center gap-3 sm:gap-4">
                    <div className="flex items-end justify-center gap-1.5 sm:gap-2">
                      {voiceWaveBars.map((barHeight, index) => (
                        <span
                          key={index}
                          className={`relative w-1.5 rounded-full transition-all duration-100 sm:w-2 ${
                            phase === "playing" && waveDisplayLevel >= 8
                              ? isDanger
                                ? "bg-gradient-to-t from-rose-500 via-rose-400 to-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                                : "bg-gradient-to-t from-violet-600 via-violet-400 to-sky-300 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                              : "bg-violet-900/40"
                          }`}
                          style={{ height: `${barHeight}px` }}
                          aria-hidden="true"
                        >
                          <span className="absolute inset-x-0 top-0 h-[35%] rounded-full bg-white/20" />
                        </span>
                      ))}
                    </div>
                    <div className="flex min-w-[48px] flex-col items-end text-right">
                      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                        input
                      </span>
                      <span className={`text-sm font-black ${isDanger ? "text-rose-400" : "text-violet-200"}`}>
                        {Math.round(effectiveVolume)}
                        <span className="ml-1 text-[10px] font-semibold text-violet-300/50">dB</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex h-full min-h-[280px] items-center justify-center">
                <div className="flex w-full max-w-[320px] flex-col items-center justify-center rounded-[32px] border border-violet-500/25 bg-[#0c0820]/90 px-6 py-8 text-center backdrop-blur-xl sm:rounded-[36px] sm:px-8 sm:py-10 [box-shadow:0_0_40px_rgba(139,92,246,0.10)]">
                  <span className="rounded-full bg-violet-900/40 px-4 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300 ring-1 ring-violet-500/30">
                    단모음 가이드
                  </span>
                  <div className="mt-6 rounded-[28px] bg-gradient-to-br from-violet-600 to-indigo-700 px-10 py-8 text-white shadow-lg shadow-violet-900/50 sm:px-12 sm:py-10 [box-shadow:0_0_30px_rgba(139,92,246,0.35)]">
                    <span className="text-7xl font-black sm:text-8xl">{vowelGuide.vowel}</span>
                  </div>
                  <p className="mt-5 text-base font-black text-white sm:text-lg">
                    {vowelGuide.vowel} 발성 느낌으로 유지해 보세요
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-violet-300/70 sm:text-[15px]">
                    {vowelGuide.label}
                  </p>
                </div>
              </div>
            </div>

          </div>
          {error ? (
            <p className="rounded-[20px] border border-rose-500/30 bg-rose-900/20 px-4 py-3 text-sm font-semibold text-rose-400 sm:rounded-[24px]">
              {error}
            </p>
          ) : null}

          {(phase === "success" || phase === "fail") && result ? (
            <ResultModal
              result={result}
              onRestart={handleRestart}
              onHome={handleStageReturn}
              currentProgress={targetProgress}
            />
          ) : null}
        </section>
      </div>
    </LingoGameShell>
  );
}
