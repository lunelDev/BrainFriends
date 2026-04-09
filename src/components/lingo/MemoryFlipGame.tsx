"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import LingoGameShell from "@/components/lingo/LingoGameShell";
import { getGameModeNodePayload } from "@/constants/gameModeStagePayloads";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";
import {
  registerMediaStream,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";
import { createPreferredCameraStream } from "@/lib/media/cameraPreferences";
import MonitoringPanelShell from "@/components/training/MonitoringPanelShell";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { markGameModeStageCleared } from "@/lib/gameModeProgress";

const COSTUME_TIERS = [
  { minStreak: 0, id: "none" },
  { minStreak: 1, id: "earrings" },
  { minStreak: 2, id: "necklace" },
  { minStreak: 3, id: "crown" },
  { minStreak: 4, id: "sparkle" },
] as const;

type Landmark = { x: number; y: number; z: number };
type CostumeImages = Record<string, HTMLImageElement>;
type FaceMeshWindow = Window &
  typeof globalThis & {
    FaceMesh?: new (options: { locateFile: (file: string) => string }) => {
      setOptions: (options: Record<string, unknown>) => void;
      onResults: (callback: (results: { multiFaceLandmarks?: Landmark[][] }) => void) => void;
      send: (input: { image: HTMLVideoElement }) => Promise<void>;
      close: () => void;
      initialize?: () => Promise<void>;
    };
  };

const COSTUME_ASSETS = {
  star: "/ai-costumes/star.png",
  crown: "/ai-costumes/hats/crown.png",
  tear: "/ai-costumes/stickers/tear.svg",
  earring: "/ai-costumes/earrings/star-drop.svg",
  necklace: "/ai-costumes/necklace.png",
} as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

function ensureGlobalScriptLoaded(
  src: string,
  globalName: string,
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window를 사용할 수 없어요."));
  }

  if (typeof (window as unknown as Record<string, unknown>)[globalName] === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-global-script="${globalName}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`${globalName} 스크립트를 불러오지 못했어요.`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.globalScript = globalName;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`${globalName} 스크립트를 불러오지 못했어요.`));
    document.head.appendChild(script);
  });
}

function drawImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  if (!img?.complete || img.naturalWidth === 0) return;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}

function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  tierId: string,
) {
  ctx.save();
  const glow = ctx.createRadialGradient(
    canvasW * 0.5,
    canvasH * 0.42,
    canvasW * 0.06,
    canvasW * 0.5,
    canvasH * 0.5,
    canvasW * 0.7,
  );
  glow.addColorStop(0, "rgba(255,255,255,0.08)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (tierId === "sparkle") {
    const aura = ctx.createRadialGradient(
      canvasW * 0.5,
      canvasH * 0.34,
      canvasW * 0.05,
      canvasW * 0.5,
      canvasH * 0.4,
      canvasW * 0.45,
    );
    aura.addColorStop(0, "rgba(255,241,165,0.18)");
    aura.addColorStop(0.45, "rgba(125,211,252,0.10)");
    aura.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  ctx.restore();
}

function drawFaceCostume(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
  tierId: string,
  failCnt: number,
  images: CostumeImages,
) {
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  const offsetX = (videoW * scale - canvasW) / 2;
  const offsetY = (videoH * scale - canvasH) / 2;

  const lx = (i: number) => landmarks[i].x * videoW * scale - offsetX;
  const ly = (i: number) => landmarks[i].y * videoH * scale - offsetY;

  const leftEyeX = lx(33);
  const leftEyeY = ly(33);
  const rightEyeX = lx(263);
  const rightEyeY = ly(263);
  const foreheadX = lx(10);
  const foreheadY = ly(10);
  const leftTempleX = lx(234);
  const leftTempleY = ly(234);
  const rightTempleX = lx(454);
  const rightTempleY = ly(454);
  const chinX = lx(152);
  const chinY = ly(152);
  const eyeDist = Math.hypot(rightEyeX - leftEyeX, rightEyeY - leftEyeY);
  const hatSize = eyeDist * 1.9;
  const badgeSz = eyeDist * 0.72;

  if (tierId === "crown" && images.crown) {
    drawImg(
      ctx,
      images.crown,
      foreheadX,
      foreheadY - hatSize * 0.5,
      hatSize,
      hatSize * 0.62,
    );
  }

  const showEarrings =
    tierId === "earrings" ||
    tierId === "necklace" ||
    tierId === "crown" ||
    tierId === "sparkle";
  const showNecklace =
    tierId === "necklace" || tierId === "crown" || tierId === "sparkle";

  if (showEarrings && images.earring) {
    const ew = badgeSz * 0.9;
    const eh = badgeSz * 1.55;
    drawImg(
      ctx,
      images.earring,
      leftTempleX - eyeDist * 0.18,
      leftTempleY + eyeDist * 0.92,
      ew,
      eh,
    );
    drawImg(
      ctx,
      images.earring,
      rightTempleX + eyeDist * 0.18,
      rightTempleY + eyeDist * 0.92,
      ew,
      eh,
    );
  }

  if (showNecklace && images.necklace) {
    drawImg(
      ctx,
      images.necklace,
      chinX,
      chinY + eyeDist * 1.03,
      eyeDist * 2.55,
      eyeDist * 1.6,
    );
  }

  if (tierId === "sparkle" && images.star) {
    const sparkles = [
      { x: foreheadX - eyeDist * 1.05, y: foreheadY - eyeDist * 0.48, s: 0.82 },
      { x: foreheadX + eyeDist * 1.05, y: foreheadY - eyeDist * 0.46, s: 0.82 },
      { x: (leftEyeX + rightEyeX) / 2, y: foreheadY - eyeDist * 1.02, s: 0.74 },
    ];
    ctx.save();
    ctx.globalAlpha = 0.95;
    sparkles.forEach(({ x, y, s }, idx) => {
      const size = badgeSz * s * (1 + Math.sin(Date.now() / 240 + idx) * 0.08);
      drawImg(ctx, images.star, x, y, size, size);
    });
    ctx.restore();
  }

  if (failCnt >= 1 && images.tear) {
    const sway = Math.sin(Date.now() / 320) * 3;
    drawImg(
      ctx,
      images.tear,
      rightTempleX + eyeDist * 0.08,
      foreheadY + eyeDist * 0.08 + sway,
      badgeSz * 0.48,
      badgeSz * 0.72,
    );
  }
}

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

type MemoryDifficultyId = "easy" | "normal" | "hard";
type MemoryCard = {
  word: string;
  category: string;
  visual: string;
  displayIndex: number;
  revealed: boolean;
  solved: boolean;
  completed: boolean;
  result: "pending" | "success" | "fail";
};

function normalizeCategoryText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesCardWord(text: string, word: string) {
  const normalizedText = normalizeCategoryText(text);
  const compactText = normalizedText.replace(/\s+/g, "");
  const normalizedWord = normalizeCategoryText(word);
  const compactWord = normalizedWord.replace(/\s+/g, "");

  if (!compactText || !compactWord) return false;

  if (
    compactText === compactWord ||
    compactText.includes(compactWord) ||
    compactWord.includes(compactText)
  ) {
    return true;
  }

  const tokens = normalizedText
    .split(" ")
    .filter(Boolean)
    .flatMap((token) => {
      const compactToken = token.replace(/\s+/g, "");
      return [compactToken, compactToken.slice(0, compactWord.length)];
    })
    .filter(Boolean);

  return tokens.some((token) => {
    if (token === compactWord || token.includes(compactWord)) return true;
    return (
      Math.abs(token.length - compactWord.length) <= 1 &&
      levenshtein(token, compactWord) <= 1
    );
  });
}

function buildRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const ROADMAP_MEMORY_CATEGORY = {
  id: "roadmap",
  label: "핵심어",
  color: "#a78bfa",
};

function buildRoadmapDeck(words: string[]): MemoryCard[] {
  const uniqueWords = [...new Set(words)].filter(Boolean).slice(0, 8);
  const randomizedDisplayOrder = shuffle(
    Array.from({ length: uniqueWords.length }, (_, index) => index),
  );

  return uniqueWords.map((word, index) => ({
    word,
    category: ROADMAP_MEMORY_CATEGORY.id,
    visual: "📍",
    displayIndex: randomizedDisplayOrder[index],
    revealed: false,
    solved: false,
    completed: false,
    result: "pending" as const,
  }));
}

function getMemoryCameraFilter(successStreak: number, failStreak: number) {
  if (failStreak >= 6) {
    return "grayscale(0.2) brightness(0.9) saturate(0.68) contrast(1.08)";
  }
  if (failStreak >= 5) {
    return "grayscale(0.16) brightness(0.92) saturate(0.74) contrast(1.07)";
  }
  if (failStreak >= 4) {
    return "grayscale(0.12) brightness(0.94) saturate(0.8) contrast(1.06)";
  }
  if (failStreak >= 3) {
    return "grayscale(0.1) brightness(0.95) saturate(0.84) contrast(1.05)";
  }
  if (failStreak >= 2) {
    return "grayscale(0.07) brightness(0.97) saturate(0.88) contrast(1.04)";
  }
  if (failStreak >= 1) {
    return "grayscale(0.04) brightness(0.99) saturate(0.93) contrast(1.03)";
  }
  if (successStreak >= 6) {
    return "brightness(1.18) saturate(1.32) contrast(1.1)";
  }
  if (successStreak >= 5) {
    return "brightness(1.16) saturate(1.28) contrast(1.09)";
  }
  if (successStreak >= 4) {
    return "brightness(1.14) saturate(1.24) contrast(1.08)";
  }
  if (successStreak >= 3) {
    return "brightness(1.11) saturate(1.18) contrast(1.06)";
  }
  if (successStreak >= 2) {
    return "brightness(1.08) saturate(1.14) contrast(1.05)";
  }
  if (successStreak >= 1) {
    return "brightness(1.06) saturate(1.1) contrast(1.04)";
  }
  return "brightness(1.02) saturate(1.04)";
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

function ResultModal({
  elapsedTime,
  accuracy,
  solvedCount,
  totalCount,
  onHome,
}: {
  elapsedTime: string;
  accuracy: number;
  solvedCount: number;
  totalCount: number;
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
      headerToneClass="bg-transparent"
      iconToneClass="bg-gradient-to-br from-[#00cec9] to-[#6c5ce7]"
      badgeToneClass="text-violet-300"
      primaryButtonClass="bg-gradient-to-r from-[#111d42] to-[#6c5ce7]"
      primaryLabel="단계 선택으로"
      onPrimary={handleHome}
    >
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-[28px] border border-violet-500/22 bg-[#0c0820]/85 p-5 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">
            성공률
          </span>
          <strong className="text-4xl font-black text-violet-400">
            {successRate}%
          </strong>
        </div>
        <div className="rounded-[28px] border border-violet-500/22 bg-[#0c0820]/85 p-5 text-center">
          <span className="mb-2 block text-[11px] font-black text-violet-300/60">
            정확도
          </span>
          <strong className="text-4xl font-black text-white">
            {accuracy}%
          </strong>
        </div>
      </div>

      <div className="mb-6 rounded-[28px] border border-violet-500/22 bg-[#0c0820]/85 p-5 text-center">
        <span className="mb-2 block text-[11px] font-black text-violet-300/60">
          걸린 시간
        </span>
        <strong className="text-3xl font-black text-white">
          {elapsedTime}
        </strong>
      </div>

      <div className="mb-6 flex h-12 w-full overflow-hidden rounded-2xl border border-violet-500/20">
        <div
          className="flex items-center justify-center bg-violet-600 text-xs font-black text-white"
          style={{ width: `${successRate}%` }}
        >
          성공 {solvedCount}
        </div>
        <div
          className="flex items-center justify-center bg-[#1a1435] text-xs font-black text-violet-300/60"
          style={{ width: `${100 - successRate}%` }}
        >
          남음 {Math.max(totalCount - solvedCount, 0)}
        </div>
      </div>
    </LingoResultModalShell>
  );
}

export default function MemoryFlipGame({ onBack }: { onBack?: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roadmapStageId = Number(searchParams.get("roadmapStage") || "0");
  const roadmapNodeId =
    searchParams.get("roadmapNode") || searchParams.get("roadmapSection") || "";
  const roadmapNodePayload = getGameModeNodePayload(roadmapStageId, roadmapNodeId);
  const roadmapMemoryPayload =
    roadmapNodePayload?.gameType === "memory" ? roadmapNodePayload.payload : null;
  const activeMemoryPayload = roadmapMemoryPayload ?? {
    previewAnswers: ["핵심어"],
    hintPool: ["로드맵 노드 데이터가 없습니다. 스테이지에서 다시 진입해 주세요."],
    answerPool: ["핵심어"],
  };
  const {
    volume,
    isMicReady,
    error: micError,
    start: startAudioMonitor,
    stop: stopAudioMonitor,
  } = useAudioAnalyzer();

  const [difficulty, setDifficulty] = useState<MemoryDifficultyId>("normal");
  const [cards, setCards] = useState<MemoryCard[]>(() =>
    buildRoadmapDeck(activeMemoryPayload.answerPool),
  );
  const [targetWord, setTargetWord] = useState<string | null>(null);
  const [heardText, setHeardText] = useState("");
  const [message, setMessage] = useState(
    "한 번 마이크를 켜면 계속 듣습니다. 카드에 맞는 핵심어를 또렷하게 말해 보세요.",
  );
  const [score, setScore] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [successStreak, setSuccessStreak] = useState(0);
  const [failStreak, setFailStreak] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionFinishedAt, setSessionFinishedAt] = useState<number | null>(
    null,
  );
  const [wrongByCategory, setWrongByCategory] = useState<
    Record<string, number>
  >({ [ROADMAP_MEMORY_CATEGORY.id]: 0 });
  const [isListening, setIsListening] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [audioBars, setAudioBars] = useState(Array(16).fill(10));
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [faceTracked, setFaceTracked] = useState(false);
  const [faceGuideScore, setFaceGuideScore] = useState(0);
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
  const costumeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<any>(null);
  const faceLoopRef = useRef<number | null>(null);
  const latestLandmarksRef = useRef<Landmark[] | null>(null);
  const faceProcessingRef = useRef(false);
  const costumeImagesRef = useRef<CostumeImages>({});
  const volumeRef = useRef(0);
  const successStreakRef = useRef(0);
  const failStreakRef = useRef(0);
  const autoStartedRef = useRef(false);
  const stageMapHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}`
      : "/select-page/game-mode";
  const stageMapReturnHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}?opened=1&focusNode=${encodeURIComponent(roadmapNodeId)}`
      : "/select-page/game-mode";
  const handleStageReturn = () => router.push(stageMapReturnHref);

  useEffect(() => {
    successStreakRef.current = successStreak;
  }, [successStreak]);

  useEffect(() => {
    failStreakRef.current = failStreak;
  }, [failStreak]);

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

  const initFaceTracking = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (faceLoopRef.current === null) {
      const loop = () => {
        const canvas = costumeCanvasRef.current;
        const video = videoRef.current;

        if (canvas && video && video.readyState >= 2) {
          const container = canvas.parentElement;
          if (container) {
            const cw = container.offsetWidth;
            const ch = container.offsetHeight;
            if (canvas.width !== cw || canvas.height !== ch) {
              canvas.width = cw;
              canvas.height = ch;
            }
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            const cw = canvas.width;
            const ch = canvas.height;
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            const currentSuccessStreak = successStreakRef.current;
            const currentFailStreak = failStreakRef.current;
            const currentTierId = COSTUME_TIERS.reduce<string>(
              (best, tier, i) =>
                currentSuccessStreak >= tier.minStreak ? COSTUME_TIERS[i].id : best,
              COSTUME_TIERS[0].id,
            );

            ctx.clearRect(0, 0, cw, ch);
            drawCameraOverlay(ctx, cw, ch, currentTierId);

            if (
              latestLandmarksRef.current &&
              Object.keys(costumeImagesRef.current).length > 0
            ) {
              drawFaceCostume(
                ctx,
                latestLandmarksRef.current,
                cw,
                ch,
                vw,
                vh,
                currentTierId,
                currentFailStreak,
                costumeImagesRef.current,
              );
            }

            if (!faceProcessingRef.current && faceMeshRef.current) {
              faceProcessingRef.current = true;
              faceMeshRef.current
                .send({ image: video })
                .catch(() => {})
                .finally(() => {
                  faceProcessingRef.current = false;
                });
            }
          }
        }

        faceLoopRef.current = requestAnimationFrame(loop);
      };

      faceLoopRef.current = requestAnimationFrame(loop);
    }

    if (faceMeshRef.current) return;

    try {
      await ensureGlobalScriptLoaded(
        "/mediapipe/face_mesh/face_mesh.js",
        "FaceMesh",
      );
      const FaceMeshCtor = (window as FaceMeshWindow).FaceMesh;
      if (typeof FaceMeshCtor !== "function") {
        throw new Error("window.FaceMesh를 찾지 못했어요.");
      }

      const fm = new FaceMeshCtor({
        locateFile: (file: string) => `/mediapipe/face_mesh/${file}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      fm.onResults((results: { multiFaceLandmarks?: Landmark[][] }) => {
        const nextLandmarks = results.multiFaceLandmarks?.[0] ?? null;
        latestLandmarksRef.current = nextLandmarks;
        setFaceTracked(Boolean(nextLandmarks));
      });
      await fm.initialize?.();
      faceMeshRef.current = fm;

      const [star, crown, tear, earring, necklace] = await Promise.all([
        loadImage(COSTUME_ASSETS.star),
        loadImage(COSTUME_ASSETS.crown),
        loadImage(COSTUME_ASSETS.tear),
        loadImage(COSTUME_ASSETS.earring),
        loadImage(COSTUME_ASSETS.necklace),
      ]);
      costumeImagesRef.current = { star, crown, tear, earring, necklace };
      setCameraError("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "알 수 없는 오류";
      setCameraError(`AI 합성 실패: ${message}`);
    }
  }, []);

  useEffect(() => {
    const Recognition = buildRecognition();
    setSupported(Boolean(Recognition));
  }, []);

  const currentCard = useMemo(() => {
    const remaining = cards.filter((card) => !card.completed);
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
    if (currentCard) return;
    setTargetWord(null);
  }, [currentCard]);

  useEffect(() => {
    if (targetWord) return;
    const firstRemaining = cards.find((card) => !card.completed);
    if (firstRemaining) {
      setTargetWord(firstRemaining.word);
    }
  }, [cards, targetWord]);

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
    if (!currentCard) return;
    setTimeLeft(getRoundTimeLimit(difficulty));
  }, [currentCard, difficulty]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (!currentCard) return;
    setHeardText("");
    setMessage("지금 카드와 맞는 핵심어를 말하세요.");
    ignoreSpeechUntilRef.current = Date.now() + 1200;
    const unlockTimer = window.setTimeout(() => {
      transitionLockRef.current = false;
    }, 220);
    return () => window.clearTimeout(unlockTimer);
  }, [currentCard?.word]);

  const stopCamera = useCallback(() => {
    if (faceLoopRef.current !== null) {
      cancelAnimationFrame(faceLoopRef.current);
      faceLoopRef.current = null;
    }
    if (faceMeshRef.current) {
      try {
        faceMeshRef.current.close();
      } catch {
        /* no-op */
      }
      faceMeshRef.current = null;
    }
    latestLandmarksRef.current = null;
    faceProcessingRef.current = false;
    setFaceTracked(false);
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

  useEffect(() => {
    if (!cameraReady) return;
    void initFaceTracking();
  }, [cameraReady, initFaceTracking]);

  function getNextTargetWord(nextCards: typeof cards, currentWord?: string) {
    const remaining = nextCards.filter((card) => !card.completed);
    if (remaining.length === 0) {
      return null;
    }
    const currentIndex = currentWord
      ? nextCards.findIndex((card) => card.word === currentWord)
      : -1;
    return (
      nextCards.find(
        (card, index) => index > currentIndex && !card.completed,
      ) ?? remaining[0]
    ).word;
  }

  function chooseNextTarget(nextCards: typeof cards, currentWord?: string) {
    setTargetWord(getNextTargetWord(nextCards, currentWord));
  }

  function revealCategory(targetWord: string, correct: boolean) {
    const nextCards = cardsRef.current.map((card) => {
      if (card.word === targetWord) {
        return {
          ...card,
          revealed: true,
          solved: correct,
          completed: true,
          result: correct ? "success" : "fail",
        };
      }
      return card;
    });

    cardsRef.current = nextCards;
    setCards(nextCards);

    chooseNextTarget(nextCards, targetWord);
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
    setSuccessStreak(0);
    setFailStreak((value) => Math.min(6, value + 1));
    setHeardText("");
    revealCategory(activeCard.word, false);
    setMessage("시간 초과예요. 오답으로 표시하고 다음 그림으로 넘어갑니다.");
    triggerFeedback("fail");
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

    const matchedByWord = matchesCardWord(transcript, activeCard.word);
    setAttemptCount((value) => value + 1);

    if (matchedByWord) {
      transitionLockRef.current = true;
      ignoreSpeechUntilRef.current = Date.now() + 900;
      handledTargetRef.current = `done-${activeCard.word}`;
      setHeardText("");
      revealCategory(activeCard.word, true);
      triggerFeedback("success");
      setScore((value) => value + 15);
      setSolvedCount((value) => value + 1);
      setSuccessStreak((value) => value + 1);
      setFailStreak(0);
      setMessage(`정답이에요. "${activeCard.word}" 인식 성공`);
      return;
    }

    setScore((value) => Math.max(0, value - 2));
    setWrongCount((value) => value + 1);
    setWrongByCategory((value) => ({
      ...value,
      [activeCard.category]: (value[activeCard.category] ?? 0) + 1,
    }));
    setSuccessStreak(0);
    setFailStreak((value) => Math.min(6, value + 1));
    transitionLockRef.current = true;
    ignoreSpeechUntilRef.current = Date.now() + 900;
    handledTargetRef.current = `done-${activeCard.word}`;
    setHeardText("");
    revealCategory(activeCard.word, false);
    setMessage(`오답이에요. "${activeCard.word}" 를 다시 떠올려 보세요.`);
    triggerFeedback("fail");
  }

  function runSpeechTestInput(transcript: string) {
    if (!currentCard) return;
    handleSpeechResult(transcript);
  }

  function runRoadmapJudge(result: "success" | "fail") {
      const activeCard = currentCardRef.current;
      if (
        !activeCard ||
        transitionLockRef.current ||
        handledTargetRef.current === `done-${activeCard.word}`
      ) {
      return;
    }

    transitionLockRef.current = true;
    ignoreSpeechUntilRef.current = Date.now() + 900;
    handledTargetRef.current = `done-${activeCard.word}`;
    setAttemptCount((value) => value + 1);
    setHeardText("");

    if (result === "success") {
      revealCategory(activeCard.word, true);
      triggerFeedback("success");
      setScore((value) => value + 15);
      setSolvedCount((value) => value + 1);
      setSuccessStreak((value) => value + 1);
      setFailStreak(0);
      setMessage(`정답이에요. "${activeCard.word}" 카드가 열렸습니다.`);
      return;
    }

    setScore((value) => Math.max(0, value - 2));
    setWrongCount((value) => value + 1);
    setWrongByCategory((value) => ({
      ...value,
      [ROADMAP_MEMORY_CATEGORY.id]:
        (value[ROADMAP_MEMORY_CATEGORY.id] ?? 0) + 1,
    }));
    setSuccessStreak(0);
    setFailStreak((value) => Math.min(6, value + 1));
    revealCategory(activeCard.word, false);
    triggerFeedback("fail");
    setMessage(`오답이에요. "${activeCard.word}" 를 다시 떠올려 보세요.`);
  }

  useEffect(() => {
    if (!currentCard) return;

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
  }, [currentCard, handleRoundTimeout]);

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
      setMessage("듣는 중이에요. 카드에 맞는 핵심어를 말해 보세요.");
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results?.[i];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (Date.now() < ignoreSpeechUntilRef.current) continue;

        setHeardText(transcript);

        if (
          currentCardRef.current &&
          matchesCardWord(transcript, currentCardRef.current.word)
        ) {
          handleSpeechResult(transcript);
          return;
        }

        if (result?.isFinal) {
          setMessage("카드의 핵심어를 또박또박 말해 주세요.");
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
    if (!currentCard || !keepListeningRef.current) return;

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
  }, [beginContinuousListening, currentCard?.word, currentCard]);

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
    autoStartedRef.current = false;
    void startGameForDifficulty(difficulty);
  }

  function resolveDifficultyFromParams() {
    const difficultyParam = String(searchParams.get("difficulty") || "Easy");
    if (difficultyParam === "Hard" || difficultyParam === "Expert") {
      return "hard" as MemoryDifficultyId;
    }
    if (difficultyParam === "Normal") {
      return "normal" as MemoryDifficultyId;
    }
    return "easy" as MemoryDifficultyId;
  }

  async function startGameForDifficulty(startDifficulty = difficulty) {
    roadmapClearMarkedRef.current = false;
    const nextCards = buildRoadmapDeck(activeMemoryPayload.answerPool);
    setCards(nextCards);
    setTargetWord(nextCards.find((card) => !card.completed)?.word ?? null);
    setHeardText("");
    setMessage("한 번 마이크를 켜면 계속 듣습니다. 카드에 맞는 핵심어를 말해 보세요.");
    setScore(0);
    setSolvedCount(0);
    setAttemptCount(0);
    setWrongCount(0);
    setSuccessStreak(0);
    setFailStreak(0);
    setSessionStartedAt(Date.now());
    setSessionFinishedAt(null);
    setWrongByCategory({ [ROADMAP_MEMORY_CATEGORY.id]: 0 });
    setFeedbackState("idle");
    setTimeLeft(getRoundTimeLimit(startDifficulty));
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

  useEffect(() => {
    if (autoStartedRef.current) return;

    const nextDifficulty = resolveDifficultyFromParams();
    autoStartedRef.current = true;
    setDifficulty(nextDifficulty);
    void startGameForDifficulty(nextDifficulty);
  }, [searchParams]);

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
  const displayCards = useMemo(
    () => [...cards].sort((a, b) => a.displayIndex - b.displayIndex),
    [cards],
  );
  const roundTimeLimit = getRoundTimeLimit(difficulty);
  const timeRatio = Math.max(
    0,
    Math.min(100, Math.round((timeLeft / roundTimeLimit) * 100)),
  );
  const accuracy =
    attemptCount > 0 ? Math.round((solvedCount / attemptCount) * 100) : 0;
  const showReport = !currentCard;
  const roadmapClearMarkedRef = useRef(false);
  const elapsedTime =
    sessionStartedAt && sessionFinishedAt
      ? formatDuration(sessionFinishedAt - sessionStartedAt)
      : "0:00";
  const mostConfusedCategory = Object.entries(wrongByCategory).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const mostConfusedLabel =
    mostConfusedCategory && mostConfusedCategory[1] > 0
      ? ROADMAP_MEMORY_CATEGORY.label
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

  useEffect(() => {
    if (!showReport || roadmapClearMarkedRef.current) return;
    if (roadmapStageId < 1 || !roadmapNodeId) return;

    const clearTarget = Math.max(3, Math.ceil(cards.length * 0.7));
    if (solvedCount < clearTarget) return;

    markGameModeStageCleared(roadmapStageId, roadmapNodeId, "memory");
    roadmapClearMarkedRef.current = true;
  }, [cards.length, roadmapNodeId, roadmapStageId, showReport, solvedCount]);

  return (
    <LingoGameShell
      badge="Game Mode • Memory"
      title="말로 열기"
      onRestart={restart}
      onBack={onBack ?? (() => router.push(stageMapHref))}
      variant="gameMode"
      statusLabel={isMicReady && micEnabled ? "듣는 중" : "준비"}
      progressLabel={`${solvedCount} / ${cards.length}`}
      headerActions={
        (
          <>
            <button
              type="button"
              className="px-3 py-1.5 rounded-full font-black text-[11px] border bg-violet-600 text-white border-violet-500"
                disabled={!currentCard}
              onClick={() => runRoadmapJudge("success")}
            >
              성공 처리
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
                disabled={!currentCard}
              onClick={() => runRoadmapJudge("fail")}
            >
              실패 처리
            </button>
          </>
        )
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
                          className={`memory-main-card relative w-full max-w-none overflow-hidden rounded-[44px] border-[3px] bg-[#0c0820]/95 p-6 backdrop-blur-sm transition-all duration-500 sm:rounded-[52px] sm:p-8 ${
                            feedbackState === "success"
                              ? "scale-[1.03] border-emerald-500/70 shadow-[0_0_40px_rgba(52,211,153,0.20)]"
                              : feedbackState === "fail"
                                ? "border-rose-500/70 shadow-[0_0_40px_rgba(248,113,113,0.20)]"
                                : "border-violet-500/25 shadow-[0_0_40px_rgba(139,92,246,0.10)]"
                          }`}
                        >
                          <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-violet-600 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-violet-900/50 [box-shadow:0_0_16px_rgba(139,92,246,0.4)]">
                                도시 핵심어
                              </span>
                              <span className="text-sm font-black text-violet-300/60">
                                {`레벨 ${roadmapStageId || 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="rounded-full bg-[#1a1435] px-4 py-1.5 ring-1 ring-violet-500/25">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-violet-300/60">
                                  제한 시간
                                </span>
                                <strong className="ml-2 text-sm font-black text-violet-300">
                                  {timeLeft}s
                                </strong>
                              </div>
                              <div className="flex items-center gap-2 rounded-full bg-[#1a1435] px-4 py-1.5 ring-1 ring-violet-500/25">
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                  isMicReady && micEnabled
                                    ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                                    : "bg-violet-900/60"
                                }`}
                              />
                              <span className="text-[10px] font-black uppercase tracking-tighter text-violet-300/60">
                                {isMicReady && micEnabled ? "듣기 활성" : "듣기 대기"}
                              </span>
                              </div>
                            </div>
                          </div>

                          <div className="mb-6 rounded-full bg-violet-900/20 p-1 ring-1 ring-violet-500/15">
                            <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300/60">
                              <span>남은 시간</span>
                              <span className={timeLeft <= 2 ? "text-rose-400" : "text-violet-300"}>
                                {timeLeft}s
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#0c0820]">
                              <div
                                className={`h-full transition-all duration-1000 ${
                                  timeLeft <= 2
                                    ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                                    : "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                                }`}
                                style={{ width: `${timeRatio}%` }}
                              />
                            </div>
                          </div>

                          {feedbackState !== "idle" ? (
                            <div
                              className={`pointer-events-none absolute right-6 top-28 rounded-full px-4 py-2 text-sm font-black shadow-lg sm:right-8 ${
                                feedbackState === "success"
                                  ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(52,211,153,0.5)]"
                                  : "bg-rose-500 text-white shadow-[0_0_20px_rgba(248,113,113,0.5)]"
                              }`}
                            >
                              {feedbackState === "success"
                                ? "정답! 다음 카드로 이동"
                                : "오답 또는 시간 초과"}
                            </div>
                          ) : null}

                          <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_280px] lg:gap-8">
                            <div className="flex min-w-0 flex-col items-center justify-center text-center">
                              <div className="mb-5 w-full rounded-[28px] border border-violet-500/20 bg-[#0a0818]/80 px-5 py-4 sm:px-6 sm:py-5">
                                <div className="mb-3 text-sm font-black uppercase tracking-[0.24em] text-violet-300/60 sm:text-[15px]">
                                  말해야 하는 단어
                                </div>
                                <div className="flex items-center justify-center">
                                  <div className="flex min-w-[240px] items-center justify-center rounded-full border-2 border-violet-400/50 bg-violet-500/20 px-6 py-3 text-2xl font-black tracking-tight text-white shadow-[0_0_20px_rgba(139,92,246,0.18)]">
                                    {currentCard?.word ?? "핵심어"}
                                  </div>
                                </div>
                              </div>

                              <div
                                className={`mb-5 flex w-full items-center gap-3 rounded-[24px] border px-5 py-4 text-left transition-all ${
                                  micEnabled
                                    ? "border-violet-500/40 bg-violet-900/20"
                                    : "border-violet-500/15 bg-[#0a0818]/60"
                                }`}
                              >
                                <span
                                  className={`h-3 w-3 shrink-0 rounded-full ${
                                    micEnabled
                                      ? "animate-pulse bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                                      : "bg-violet-900/60"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <div
                                    className={`text-xs font-black uppercase tracking-[0.18em] ${
                                      micEnabled
                                        ? "text-violet-300"
                                        : "text-violet-300/50"
                                    }`}
                                  >
                                    {micEnabled
                                      ? "핵심어 듣기 활성화"
                                      : "듣기 대기"}
                                  </div>
                                  <p
                                    className={`mt-1 text-sm font-bold ${
                                      micEnabled
                                        ? "text-slate-300"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {micEnabled
                                      ? "지금 카드에 맞는 핵심어를 말하세요."
                                      : "마이크 연결 후 자동으로 듣기를 시작합니다."}
                                  </p>
                                </div>
                              </div>

                              <div className="group relative mb-6 flex aspect-square w-56 items-center justify-center rounded-[40px] border-2 border-violet-500/25 bg-[#0c0820]/90 sm:w-64 sm:rounded-[48px]">
                                <div className="absolute inset-0 rounded-[48px] bg-gradient-to-b from-violet-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                                <span className="relative z-10 select-none text-[150px] drop-shadow-2xl">
                                  {currentCard.visual}
                                </span>
                              </div>
                              <h2 className="mb-2 text-3xl font-black tracking-tighter text-white sm:text-4xl">
                                알맞은 핵심어를 말해보세요
                              </h2>
                              <p className="text-base font-bold text-slate-300 sm:text-lg">
                                {activeMemoryPayload.hintPool?.[0] ?? "카드에 맞는 핵심어를 말해 보세요."}
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
                                인식된 말
                              </div>
                              <p className="truncate text-lg font-black text-white sm:text-xl">
                                {heardText ||
                                  (isMicReady && micEnabled
                                      ? "지금 핵심어를 말해 주세요..."
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
                                    카드 진행
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
                                  {displayCards.map((card, i) => {
                                    const isResolved = card.completed || card.revealed;
                                    const isSuccess = card.result === "success";
                                    const isFail = card.result === "fail";
                                    return (
                                      <div
                                        key={i}
                                        className={`flex aspect-square items-center justify-center rounded-2xl border-2 p-2 text-center transition-all duration-700 ${
                                          isSuccess
                                            ? "border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-100"
                                            : isFail
                                              ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-100"
                                              : "border-white bg-white text-slate-200"
                                        }`}
                                      >
                                        {isResolved ? (
                                          <div className="flex flex-col items-center gap-1">
                                            <span className="line-clamp-2 break-keep text-[11px] font-black leading-tight sm:text-xs">
                                              {card.word}
                                            </span>
                                          </div>
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
                                    <span>완료 진행도</span>
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
                          {cameraReady ? (
                            <>
                              <video
                                ref={videoRef}
                                className="vt-camera-video"
                                autoPlay
                                muted
                                playsInline
                                style={{
                                  display: "block",
                                  filter: getMemoryCameraFilter(successStreak, failStreak),
                                }}
                              />
                              <canvas
                                ref={costumeCanvasRef}
                                className="vt-camera-canvas"
                              />
                            </>
                          ) : (
                            <div className="vt-camera-placeholder">
                              <span>카메라 대기 중</span>
                              <p>카메라를 확인한 뒤 다시 시도해 주세요.</p>
                            </div>
                          )}
                          <div className="vt-face-guide" />
                          <div className="tetris-camera-chip">
                            <span className="tetris-camera-chip-label">안면 상태</span>
                            <strong className="tetris-camera-chip-value">
                              {cameraReady ? (faceTracked ? "인식 중" : "준비") : "대기"}
                            </strong>
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

                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                          <div className="flex items-center justify-between px-2">
                              <span className="text-[10px] font-black uppercase text-slate-400">
                               정답률
                              </span>
                              <strong className="text-lg font-black text-violet-600">
                               {accuracy}%
                              </strong>
                            </div>
                            <div className="flex items-center justify-between px-2">
                              <span className="text-[10px] font-black uppercase text-slate-400">
                               점수
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

            {showReport ? (
              <ResultModal
                elapsedTime={elapsedTime}
                accuracy={accuracy}
                solvedCount={solvedCount}
                totalCount={cards.length}
                onHome={handleStageReturn}
              />
            ) : null}
          </div>
        </section>
      </div>
    </LingoGameShell>
  );
}
