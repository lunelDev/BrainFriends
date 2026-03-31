"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import { BALLOON_GROWTH_DIFFICULTIES } from "@/data/balloonGrowthData";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";

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
}: {
  result: BalloonResult;
  onRestart: () => void;
  onHome?: (() => void) | undefined;
}) {
  const confetti = Array.from({ length: 14 }, (_, index) => index);

  return (
    <div className="vt-report-modal">
      <div
        className={`vt-report-modal-card balloon-game-result-card ${result.type === "success" ? "is-success" : "is-fail"}`}
      >
        {result.type === "success" ? (
          <div className="balloon-game-confetti" aria-hidden="true">
            {confetti.map((item) => (
              <span
                key={item}
                style={{ "--confetti-index": item } as CSSProperties}
              />
            ))}
          </div>
        ) : null}
        {result.type === "fail" && result.title === "풍선이 터졌어요" ? (
          <div className="balloon-game-burst" aria-hidden="true">
            <strong>POP!</strong>
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                style={{ "--burst-index": index } as CSSProperties}
              />
            ))}
          </div>
        ) : null}
        <span
          className={`balloon-game-result-badge ${result.type === "success" ? "is-success" : "is-fail"}`}
        >
          {result.type === "success" ? "SUCCESS" : "FAIL"}
        </span>
        <h3>{result.title}</h3>
        <p>{result.subtitle}</p>
        <div className="balloon-game-result-grid">
          <div className="balloon-game-result-box">
            <span>발성 시간</span>
            <strong>{result.voicedSeconds}초</strong>
          </div>
          <div className="balloon-game-result-box">
            <span>평균 음량</span>
            <strong>{result.averageVolume}</strong>
          </div>
          <div className="balloon-game-result-box">
            <span>안정성</span>
            <strong>{result.stability}%</strong>
          </div>
        </div>
        <button type="button" className="ui-button vt-start-btn" onClick={onRestart}>
          단계 선택
        </button>
        {onHome ? (
          <button
            type="button"
            className="ui-button secondary-button balloon-game-home-btn"
            onClick={onHome}
          >
            홈으로
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function BalloonGrowthGame({ onBack }: { onBack?: () => void }) {
  const { volume, isMicReady, error, start, stop } = useAudioAnalyzer();
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
  const optimalRatio = clamp(1 - Math.abs(effectiveVolume - safeCenter) / safeHalf, 0, 1);
  const isOptimal = isSafe && optimalRatio >= 0.72;
  const balloonScale = 0.48 + (balloonSize / stage.targetSize) * 0.46;
  const waveBars = Array.from({ length: 16 }, (_, index) => {
    const centerWeight = 1 - Math.abs(7.5 - index) / 8;
    const base = 14 + centerWeight * 16;
    const activeBoost = phase === "playing" ? effectiveVolume * (0.2 + centerWeight * 0.45) : 0;
    return clamp(Math.round(base + activeBoost), 12, 92);
  });
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
      const isSilent = effectiveVolume <= stage.silenceThreshold;

      if (inSafeRange) {
        const closeness = 1 - Math.abs(effectiveVolume - safeCenter) / safeHalf;
        const growth = stage.growthPerSecond * clamp(0.55 + closeness * 0.45, 0.55, 1);

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
      } else if (inDangerRange) {
        voicedMsRef.current += delta;
        totalVolumeRef.current += effectiveVolume;
        sampleCountRef.current += 1;
        dangerMsRef.current += delta;
        silenceMsRef.current = 0;
        setDangerRatio(clamp((dangerMsRef.current / stage.dangerHoldMs) * 100, 0, 100));
        setMessage("위험해요. 소리를 조금만 줄여 보세요.");
      } else if (isSilent) {
        dangerMsRef.current = 0;
        setDangerRatio(0);
        silenceMsRef.current += delta;
        if (silenceMsRef.current >= stage.silenceDelayMs) {
          setBalloonSize((prev) =>
            Math.max(stage.startSize, prev - stage.shrinkPerSecond * deltaSec),
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
  }

  return (
    <LingoGameShell
      badge="Game Training • Voice Control"
      title="풍선 키우기"
      onRestart={handleRestart}
      onBack={onBack}
      statusLabel={phase === "playing" ? balloonTone.toUpperCase() : "READY"}
      progressLabel={`${Math.round(targetProgress)}%`}
    >
      <div className="lingo-game-layout">
        <aside className="vt-left lingo-side-stack">
          <div className="vt-glass lingo-panel-card">
            <div className="vt-panel-title">
              <span className="vt-panel-icon">🎈</span>
              <strong>훈련 기준</strong>
            </div>
            <div className="lingo-status-strip">
              <span className="lingo-status-pill">{difficulty.label}</span>
              <span className="lingo-status-pill">안전 {stage.safeMin}~{stage.safeMax}</span>
            </div>
            <div className="lingo-kpi-grid">
              <div className="lingo-kpi-card">
                <span>남은 시간</span>
                <strong>{Math.ceil(timeLeft)}초</strong>
              </div>
              <div className="lingo-kpi-card">
                <span>목표 크기</span>
                <strong>{stage.targetSize}</strong>
              </div>
              <div className="lingo-kpi-card">
                <span>위험 기준</span>
                <strong>{stage.dangerMin}+</strong>
              </div>
              <div className="lingo-kpi-card">
                <span>음성 상태</span>
                <strong>{phase === "playing" ? "입력 중" : "대기"}</strong>
              </div>
            </div>
          </div>

          {error ? (
            <div className="vt-glass lingo-panel-card">
              <div className="vt-panel-title">
                <span className="vt-panel-icon">⚠️</span>
                <strong>마이크 상태</strong>
              </div>
              <div className="lingo-transcript-card">
                <span>오류</span>
                <p>{error}</p>
              </div>
            </div>
          ) : null}
        </aside>

        <section className="vt-center balloon-game-center">
            <div className="vt-board-shell balloon-game-board-shell">
              <div className="vt-canvas-wrap balloon-game-stage">
                <div className="balloon-game-topbar">
                  <div className="balloon-game-top-pill">
                    <span>단계</span>
                    <strong>{difficulty.label}</strong>
                  </div>
                  <div className="balloon-game-top-pill">
                    <span>남은 시간</span>
                    <strong>{Math.ceil(timeLeft)}초</strong>
                  </div>
                  <div className="balloon-game-top-pill">
                    <span>목표 진행률</span>
                    <strong>{Math.round(targetProgress)}%</strong>
                  </div>
                </div>

                <div
                  className={`balloon-game-sky ${isDanger ? "is-danger" : ""} ${isOptimal ? "is-optimal" : ""}`}
                >
                  <span className="balloon-cloud balloon-cloud-a" />
                  <span className="balloon-cloud balloon-cloud-b" />
                  <span className="balloon-cloud balloon-cloud-c" />
                  <div className="balloon-game-target-ring" />
                  <div className="balloon-game-sky-copy">
                    <span
                      className={`balloon-game-status-badge ${isDanger ? "is-danger" : isOptimal ? "is-optimal" : isSafe ? "is-safe" : ""}`}
                    >
                      {balloonTone}
                    </span>
                    <strong>풍선을 적정 크기로 키워 보세요</strong>
                    <p>안전 구간에서는 빨리 커지고, 위험 구간에서는 터질 수 있어요.</p>
                  </div>
                  <div className="balloon-game-balloon-stage">
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

                <div className="balloon-game-meter-area">
                  <div className="balloon-game-meter-card">
                    <div className="balloon-game-meter-head">
                      <strong>실시간 음량</strong>
                      <span>{effectiveVolume}</span>
                    </div>
                    <div className="balloon-game-meter">
                      <div
                        className="balloon-game-safe-zone"
                        style={{ left: safeLeft, width: `${safeWidth}%` }}
                      />
                      <div
                        className="balloon-game-danger-zone"
                        style={{ left: dangerLeft, width: `${100 - stage.dangerMin}%` }}
                      />
                      <div
                        className={`balloon-game-live-fill ${isDanger ? "is-danger" : ""}`}
                        style={{ width: liveWidth }}
                      />
                    </div>
                  </div>

                  <div className="balloon-game-meter-card">
                    <div className="balloon-game-meter-head">
                      <strong>위험 누적</strong>
                      <span>{Math.round(dangerRatio)}%</span>
                    </div>
                    <div className="balloon-game-meter balloon-game-danger-meter">
                      <div
                        className="balloon-game-danger-fill"
                        style={{ width: `${dangerRatio}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="balloon-game-wave-card">
                  <div className="balloon-game-meter-head">
                    <strong>목소리 파동</strong>
                    <span>{balloonTone}</span>
                  </div>
                  <div className="balloon-game-wave">
                    {waveBars.map((bar, index) => (
                      <span
                        key={index}
                        className={`balloon-game-wave-bar ${isDanger ? "is-danger" : isOptimal ? "is-optimal" : ""}`}
                        style={{ height: `${bar}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="balloon-game-feedback">{message}</div>

                <div className="vbg-prep-actions">
                  <button
                    type="button"
                    className={`ui-button secondary-button vbg-big-button${testVoiceBoost ? " is-active" : ""}`}
                    onMouseDown={() => setTestVoiceBoost(true)}
                    onMouseUp={() => setTestVoiceBoost(false)}
                    onMouseLeave={() => setTestVoiceBoost(false)}
                    onTouchStart={() => setTestVoiceBoost(true)}
                    onTouchEnd={() => setTestVoiceBoost(false)}
                  >
                    테스트 발성 올리기
                  </button>
                </div>

                {error ? <p className="voice-error">{error}</p> : null}

                {phase === "select" ? (
                  <div className="vt-level-modal">
                    <div className="vt-level-modal-card balloon-game-start-card">
                      <p className="eyebrow">LingoFriends</p>
                      <h3>단계를 선택해 주세요</h3>
                      <p>적정 음량으로 풍선을 키워 목표 크기까지 도달해 보세요.</p>
                      <div className="balloon-game-difficulty-grid">
                        {BALLOON_GROWTH_DIFFICULTIES.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="balloon-game-difficulty-btn"
                            onClick={() => void handleStart(item)}
                          >
                            <span className="balloon-game-difficulty-emoji">{item.emoji}</span>
                            <strong>{item.label}</strong>
                            <span>{item.desc}</span>
                            <small>
                              {item.stage.durationSec}초 · 안전 {item.stage.safeMin}~{item.stage.safeMax}
                            </small>
                          </button>
                        ))}
                      </div>
                      {error ? <p className="voice-error">{error}</p> : null}
                    </div>
                  </div>
                ) : null}

                {(phase === "success" || phase === "fail") && result ? (
                  <ResultModal result={result} onRestart={handleRestart} onHome={onBack} />
                ) : null}
              </div>
            </div>
        </section>

        <aside className="vt-right lingo-side-stack">
          <div className="vt-glass vt-report-card">
            <div className="vt-panel-title">
              <span className="vt-panel-icon">📊</span>
              <strong>실시간 상태</strong>
            </div>

            <div className="vt-score-hero">
              <div>
                <span>현재 음량</span>
                <strong>
                  {effectiveVolume}
                  <em>dB</em>
                </strong>
              </div>
            </div>

            <div className="lingo-kpi-grid">
              <div className="lingo-kpi-card">
                <span>위험 누적</span>
                <strong>{Math.round(dangerRatio)}%</strong>
              </div>
              <div className="lingo-kpi-card">
                <span>안전 상태</span>
                <strong>{isSafe ? "유지 중" : "이탈"}</strong>
              </div>
              <div className="lingo-kpi-card">
                <span>테스트 부스트</span>
                <strong>{testVoiceBoost ? "ON" : "OFF"}</strong>
              </div>
              <div className="lingo-kpi-card">
                <span>마이크 상태</span>
                <strong>{isMicReady ? "준비" : "대기"}</strong>
              </div>
            </div>

            <div className="vt-glass-sub">
              <div className="vt-sub-row">
                <span>현재 단계</span>
                <strong>{difficulty.label}</strong>
              </div>
              <div className="vt-sub-row">
                <span>안전 구간</span>
                <strong>
                  {stage.safeMin} ~ {stage.safeMax}
                </strong>
              </div>
              <div className="vt-sub-row">
                <span>위험 기준</span>
                <strong>{stage.dangerMin} 이상</strong>
              </div>
            </div>

            {result ? (
              <div className="lingo-transcript-card">
                <span>최근 결과</span>
                <p>
                  {result.title} · 평균 음량 {result.averageVolume} · 안정성 {result.stability}%
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </LingoGameShell>
  );
}
