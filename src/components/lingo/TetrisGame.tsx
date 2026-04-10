"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WORDS_BY_LEVEL } from "@/data/tetrisWords";
import {
  getGameModeNodePayload,
  type GameModeTetrisNodePayload,
} from "@/constants/gameModeStagePayloads";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";
import {
  registerMediaStream,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";
import { createPreferredCameraStream } from "@/lib/media/cameraPreferences";
import {
  listAudioInputDevices,
  loadPreferredAudioInputId,
  savePreferredAudioInputId,
} from "@/lib/media/audioPreferences";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";
import { markGameModeStageCleared } from "@/lib/gameModeProgress";
import { playLingoSuccessSound } from "@/lib/audio/playLingoSuccessSound";

// ─── 블록 상수 ─────────────────────────────────────────────────────────────────
const BLOCK_COLORS = [
  null,
  "#22d3ee", // 네온 시안
  "#fbbf24", // 비비드 앰버
  "#a78bfa", // 바이올렛
  "#f472b6", // 핫핑크
  "#4ade80", // 네온 그린
  "#fb923c", // 비비드 오렌지
  "#38bdf8", // 스카이 블루
  "#64748b", // 가비지(슬레이트)
];

const GARBAGE_BLOCK_COLOR = BLOCK_COLORS.length - 1;
const PLAYABLE_BLOCK_COLOR_COUNT = BLOCK_COLORS.length - 2;
const INITIAL_DEBRIS_ROWS = 2;

// 한글 자음 실루엣에 맞춘 최종 6개 세트
const HANGUL_SHAPES = [
  // ㄱ
  [
    [1, 1],
    [1, 0],
  ],
  // ㄴ
  [
    [1, 0],
    [1, 1],
  ],
  // ㄷ
  [
    [1, 1],
    [1, 0],
    [1, 1],
  ],
  // ㄹ
  [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 0],
  ],
  // ㅁ
  [
    [1, 1],
    [1, 1],
  ],
  // ㅂ
  [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
  ],
];

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 24;
const MATCH_COOLDOWN_MS = 450;
const WORD_DROP_CARD_HEIGHT = 44;
const WORD_DROP_CARD_GAP = 6;
const WORD_DROP_MAX_ACTIVE = 4;
const WORD_DROP_STACK_LIMIT = 6;
const WORD_DROP_SPAWN_INTERVAL_MS = 2400;

// ─── 코스튬 티어 ───────────────────────────────────────────────────────────────
const COSTUME_TIERS = [
  {
    minStreak: 0,
    id: "none",
    hatIcon: null,
    label: null,
  },
  {
    minStreak: 2,
    id: "earrings",
    hatIcon: "✨",
    label: "별 귀걸이",
  },
  {
    minStreak: 4,
    id: "necklace",
    hatIcon: "📿",
    label: "목걸이",
  },
  {
    minStreak: 6,
    id: "crown",
    hatIcon: "👑",
    label: "왕관",
  },
  {
    minStreak: 8,
    id: "sparkle",
    hatIcon: "✨",
    label: "반짝이",
  },
] as const;

// ─── 코스튬 SVG 에셋 ───────────────────────────────────────────────────────────
type Landmark = { x: number; y: number; z: number };
type CostumeImages = Record<string, HTMLImageElement>;
type BoardCell = number;
type BoardRow = BoardCell[];
type Board = BoardRow[];
type PieceMatrix = number[][];
type Piece = {
  pos: { x: number; y: number };
  matrix: PieceMatrix;
  color: number;
};
type PieceLike = {
  pos: { x: number; y: number };
  matrix: PieceMatrix;
};
type WordChipState = "pending" | "success" | "fail";
type WordFlowEntry = {
  word: string;
  status: WordChipState;
};
type FallingWord = {
  id: number;
  text: string;
  y: number;
  speed: number;
};
type WordBurstParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
};
type ActionFeedback = {
  id: number;
  type: "success" | "fail";
  label: string;
};
type GameResult = {
  clearedWords: number;
  level: number;
  averageScore: number;
  successCount: number;
  failCount: number;
  survived: boolean;
  durationSeconds: number;
};
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
type BrowserSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor =
  new () => BrowserSpeechRecognitionInstance;
type FaceMeshWindow = Window &
  typeof globalThis & {
    FaceMesh?: new (options: { locateFile: (file: string) => string }) => {
      setOptions: (options: Record<string, unknown>) => void;
      onResults: (callback: (results: { multiFaceLandmarks?: Landmark[][] }) => void) => void;
      send: (input: { image: HTMLVideoElement }) => Promise<void>;
      close: () => void;
      initialize?: () => Promise<void>;
    };
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
type CostumeAssetMap = Record<
  "star" | "crown" | "trophy" | "tear" | "earring" | "necklace",
  string
>;

const COSTUME_ASSETS: CostumeAssetMap = {
  star: "/ai-costumes/star.png",
  crown: "/ai-costumes/hats/crown.png",
  trophy: "/ai-costumes/hats/trophy.svg",
  tear: "/ai-costumes/stickers/tear.svg",
  earring: "/ai-costumes/earrings/star-drop.svg",
  necklace: "/ai-costumes/necklace.png",
};

// 외부 SVG/PNG → HTMLImageElement 로드
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

function tintColor(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawBlockCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  // 블록 바디
  ctx.fillStyle = color;
  ctx.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

  // 상단 하이라이트 (밝게)
  ctx.fillStyle = tintColor(color, 38);
  ctx.fillRect(x, y, BLOCK_SIZE - 1, 4);

  // 하단 셰도우 (어둡게)
  ctx.fillStyle = tintColor(color, -32);
  ctx.fillRect(x, y + BLOCK_SIZE - 6, BLOCK_SIZE - 1, 5);

  // 네온 테두리 글로우 (흰색 반투명)
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.strokeRect(x + 0.5, y + 0.5, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

  // 내부 광택 선
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(x + 2.5, y + 2.5, BLOCK_SIZE - 6, BLOCK_SIZE - 6);
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

// 캔버스에 이미지를 중앙 기준으로 그리기
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

function drawImgCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (!img?.complete || img.naturalWidth === 0) return;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

// 둥근 사각형 (roundRect 폴리필)
function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function getCameraFilter(tierId: string, failCnt: number) {
  if (failCnt >= 4) {
    return "grayscale(0.18) brightness(0.92) saturate(0.72) contrast(1.08)";
  }
  if (failCnt >= 3) {
    return "brightness(0.95) saturate(0.8) contrast(1.06)";
  }
  if (failCnt >= 2) {
    return "brightness(0.97) saturate(0.88) contrast(1.04)";
  }
  if (failCnt >= 1) {
    return "brightness(0.99) saturate(0.95) contrast(1.03)";
  }
  if (tierId === "sparkle") {
    return "brightness(1.08) saturate(1.16) contrast(1.04)";
  }
  if (tierId === "crown" || tierId === "necklace") {
    return "brightness(1.04) saturate(1.08)";
  }
  return "brightness(1.02) saturate(1.04)";
}

function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  tierId: string,
  failCnt: number,
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

  if (failCnt >= 2) {
    ctx.fillStyle = "rgba(99,102,241,0.09)";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (failCnt >= 3) {
    ctx.fillStyle = "rgba(15,23,42,0.08)";
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
  totalFailCnt: number,
  images: CostumeImages,
) {
  // object-fit: cover 변환 (landmark 정규화 좌표 → 캔버스 픽셀)
  const scale = Math.max(canvasW / videoW, canvasH / videoH);
  const offsetX = (videoW * scale - canvasW) / 2;
  const offsetY = (videoH * scale - canvasH) / 2;

  const lx = (i: number) => landmarks[i].x * videoW * scale - offsetX;
  const ly = (i: number) => landmarks[i].y * videoH * scale - offsetY;

  // 주요 랜드마크
  const leftEyeX = lx(33);
  const leftEyeY = ly(33);
  const rightEyeX = lx(263);
  const rightEyeY = ly(263);
  const foreheadX = lx(10);
  const foreheadY = ly(10);
  const leftCheekX = lx(116);
  const leftCheekY = ly(116);
  const rightCheekX = lx(345);
  const rightCheekY = ly(345);
  const chinX = lx(152);
  const chinY = ly(152);
  const leftTempleX = lx(234);
  const leftTempleY = ly(234);
  const rightTempleX = lx(454);
  const rightTempleY = ly(454);
  const leftJawX = lx(172);
  const leftJawY = ly(172);
  const rightJawX = lx(397);
  const rightJawY = ly(397);
  const leftShoulderX = lx(93);
  const leftShoulderY = ly(93);
  const rightShoulderX = lx(323);
  const rightShoulderY = ly(323);

  const eyeDist = Math.hypot(rightEyeX - leftEyeX, rightEyeY - leftEyeY);
  const hatSize = eyeDist * 1.9;
  const badgeSz = eyeDist * 0.72;
  const hatY = foreheadY - hatSize * 0.5;
  const eyeMidX = (leftEyeX + rightEyeX) / 2;
  const eyeMidY = (leftEyeY + rightEyeY) / 2;

  // ── 머리 아이템 ──────────────────────────────────────────────
  if (tierId === "crown" && images.crown) {
    // viewBox 100×62 → 가로 중심 배치
    drawImg(ctx, images.crown, foreheadX, hatY, hatSize, hatSize * 0.62);
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
      { x: eyeMidX, y: foreheadY - eyeDist * 1.02, s: 0.74 },
      { x: leftCheekX - eyeDist * 0.78, y: leftCheekY + eyeDist * 0.1, s: 0.6 },
      { x: rightCheekX + eyeDist * 0.78, y: rightCheekY + eyeDist * 0.08, s: 0.6 },
    ];
    ctx.save();
    ctx.globalAlpha = 0.95;
    sparkles.forEach(({ x, y, s }, idx) => {
      const size = badgeSz * s * (1 + Math.sin(Date.now() / 240 + idx) * 0.08);
      drawImg(ctx, images.star, x, y, size, size);
    });
    ctx.restore();
  }

  // ── 실패 연속 연출 ─────────────────────────────────────────────
  if (failCnt >= 1 && images.tear) {
    const sway = Math.sin(Date.now() / 320) * 4;
    drawImg(
      ctx,
      images.tear,
      rightTempleX + eyeDist * 0.08,
      foreheadY + eyeDist * 0.08 + sway,
      badgeSz * 0.5,
      badgeSz * 0.72,
    );
  }

  if (failCnt >= 2) {
    ctx.save();
    ctx.strokeStyle = "rgba(120, 175, 255, 0.65)";
    ctx.lineWidth = Math.max(2, eyeDist * 0.05);
    ctx.lineCap = "round";
    const rainCols = [
      leftTempleX - eyeDist * 0.32,
      leftTempleX + eyeDist * 0.02,
      eyeMidX,
      rightTempleX - eyeDist * 0.02,
      rightTempleX + eyeDist * 0.32,
    ];
    rainCols.forEach((x, idx) => {
      const drift = Math.sin(Date.now() / 260 + idx) * eyeDist * 0.04;
      const y1 = foreheadY - eyeDist * 0.1 + idx * 6;
      const y2 = y1 + eyeDist * 0.42;
      ctx.beginPath();
      ctx.moveTo(x + drift, y1);
      ctx.lineTo(x - eyeDist * 0.06 + drift, y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  if (failCnt >= 3) {
    ctx.save();
    ctx.fillStyle = "rgba(55, 65, 81, 0.3)";
    ctx.beginPath();
    ctx.ellipse(
      leftEyeX,
      leftEyeY + eyeDist * 0.34,
      eyeDist * 0.28,
      eyeDist * 0.1,
      -0.08,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(
      rightEyeX,
      rightEyeY + eyeDist * 0.34,
      eyeDist * 0.28,
      eyeDist * 0.1,
      0.08,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  if (failCnt >= 4) {
    ctx.save();
    ctx.fillStyle = "rgba(94, 63, 48, 0.86)";
    ctx.beginPath();
    ctx.moveTo(chinX - eyeDist * 0.7, chinY + eyeDist * 0.18);
    ctx.quadraticCurveTo(
      chinX - eyeDist * 0.62,
      chinY + eyeDist * 0.78,
      chinX - eyeDist * 0.24,
      chinY + eyeDist * 0.98,
    );
    ctx.quadraticCurveTo(
      chinX,
      chinY + eyeDist * 1.12,
      chinX + eyeDist * 0.24,
      chinY + eyeDist * 0.98,
    );
    ctx.quadraticCurveTo(
      chinX + eyeDist * 0.62,
      chinY + eyeDist * 0.78,
      chinX + eyeDist * 0.7,
      chinY + eyeDist * 0.18,
    );
    ctx.quadraticCurveTo(chinX, chinY + eyeDist * 0.38, chinX - eyeDist * 0.7, chinY + eyeDist * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (totalFailCnt >= 5) {
    ctx.save();
    const fs = Math.max(12, eyeDist * 0.34);
    const text = "파이팅!";
    ctx.font = `bold ${fs}px sans-serif`;
    const tw = ctx.measureText(text).width;
    const px = 12;
    const py = 6;
    const bx = chinX - tw / 2 - px;
    const by = chinY + eyeDist * 1.44 - py;
    ctx.fillStyle = "rgba(59,130,246,0.88)";
    rrect(ctx, bx, by, tw + px * 2, fs + py * 2, (fs + py * 2) / 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(text, chinX, chinY + eyeDist * 1.44);
    ctx.restore();
  }
}

// ─── 순수 함수들 ───────────────────────────────────────────────────────────────
function getDropInterval(level: number) {
  return 1000;
}

function getLevelSurvivalDuration(level: number) {
  if (level <= 3) return 25;
  if (level <= 6) return 32;
  if (level <= 8) return 40;
  return 48;
}

function createPiece(level: number): Piece {
  const shape = HANGUL_SHAPES[Math.floor(Math.random() * HANGUL_SHAPES.length)];
  const width = shape[0]?.length ?? 1;
  return {
    pos: { x: Math.floor((COLS - width) / 2), y: 0 },
    matrix: JSON.parse(JSON.stringify(shape)) as PieceMatrix,
    color: Math.floor(Math.random() * PLAYABLE_BLOCK_COLOR_COUNT) + 1,
  };
}

function makeBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as BoardRow);
}

function fillDebris(level: number): Board {
  const board = makeBoard();
  const rowCount = INITIAL_DEBRIS_ROWS;
  for (let y = ROWS - 1; y >= ROWS - rowCount; y--) {
    for (let x = 0; x < COLS; x++) {
      board[y][x] = Math.floor(Math.random() * PLAYABLE_BLOCK_COLOR_COUNT) + 1;
    }
    const holes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < holes; i++) {
      board[y][Math.floor(Math.random() * COLS)] = 0;
    }
  }
  return board;
}

function collide(board: Board, piece: PieceLike) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;
      const by = y + piece.pos.y;
      const bx = x + piece.pos.x;
      if (
        by >= ROWS ||
        bx < 0 ||
        bx >= COLS ||
        (board[by] && board[by][bx]) !== 0
      )
        return true;
    }
  }
  return false;
}

function getDropStepsUntilCollision(board: Board, piece: PieceLike) {
  let steps = 0;
  const probe: PieceLike = {
    pos: { x: piece.pos.x, y: piece.pos.y },
    matrix: piece.matrix.map((row) => [...row]),
  };

  while (true) {
    probe.pos.y += 1;
    if (collide(board, probe)) {
      return steps;
    }
    steps += 1;
  }
}

function rotatePiece(matrix: PieceMatrix): PieceMatrix {
  return matrix[0].map((_: number, i: number) => matrix.map((row: number[]) => row[i]).reverse());
}

function mergePiece(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]);
  piece.matrix.forEach((row: number[], y: number) => {
    row.forEach((val: number, x: number) => {
      if (val) next[y + piece.pos.y][x + piece.pos.x] = piece.color;
    });
  });
  return next;
}

function sweepLines(board: Board): Board {
  const next = [...board];
  for (let y = ROWS - 1; y > 0; y--) {
    if (next[y].every((v: number) => v !== 0)) {
      next.splice(y, 1);
      next.unshift(new Array(COLS).fill(0));
      y++;
    }
  }
  return next;
}

function raiseGarbageRow(board: Board): Board {
  const next = board.slice(1).map((row: BoardRow) => [...row]);
  const garbage = new Array(COLS).fill(0);
  const holeCount = 1 + Math.floor(Math.random() * 2);
  const holes = new Set();

  while (holes.size < holeCount) {
    holes.add(Math.floor(Math.random() * COLS));
  }

  for (let x = 0; x < COLS; x += 1) {
    if (holes.has(x)) continue;
    garbage[x] = GARBAGE_BLOCK_COLOR;
  }

  next.push(garbage);
  return next;
}

function getWord(level: number, idx: number) {
  if (level === 9) {
    const randomLevel = 1 + Math.floor(Math.random() * 8);
    const randomWords =
      WORDS_BY_LEVEL[randomLevel as keyof typeof WORDS_BY_LEVEL] ?? [];
    return randomWords[idx % 10] ?? "";
  }
  const levelWords =
    WORDS_BY_LEVEL[Math.min(level, 8) as keyof typeof WORDS_BY_LEVEL] ?? [];
  return levelWords[idx % 10] ?? "";
}

function splitTargetIntoSegments(targetWord: string) {
  const parts = targetWord
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [targetWord.trim()];
  if (parts.length <= 3) return parts;

  const chunkCount = Math.min(4, Math.ceil(parts.length / 2));
  const chunkSize = Math.ceil(parts.length / chunkCount);
  const segments: string[] = [];

  for (let i = 0; i < parts.length; i += chunkSize) {
    const segment = parts.slice(i, i + chunkSize).join(" ").trim();
    if (segment) segments.push(segment);
  }

  return segments.length > 0 ? segments : [targetWord.trim()];
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?]/g, "")
    .replace(
      /(은|는|이|가|을|를|와|과|도|요|야|아|의|께|한테|에서|으로|로|랑)$/g,
      "",
    );
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: b.length + 1 }, () =>
    new Array(a.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
}

function getLooseSpeechMatchScore(candidate: string, target: string) {
  const candidateChars = [...candidate];
  const targetChars = [...target];

  if (!candidateChars.length || !targetChars.length) return 0;

  const samePositionCount = targetChars.reduce(
    (count, char, index) => count + (candidateChars[index] === char ? 1 : 0),
    0,
  );
  const sharedCharCount = targetChars.filter((char) =>
    candidateChars.includes(char),
  ).length;
  const startsWithSameChar = candidateChars[0] === targetChars[0];
  const endsWithSameChar =
    candidateChars[candidateChars.length - 1] ===
    targetChars[targetChars.length - 1];
  const lengthGap = Math.abs(candidateChars.length - targetChars.length);

  if (targetChars.length <= 2) {
    if (sharedCharCount >= 2 && lengthGap <= 1) return 92;
    if (startsWithSameChar && endsWithSameChar) return 88;
    if (startsWithSameChar && lengthGap <= 1) return 82;
    if (sharedCharCount >= 1) return 68;
  }

  if (targetChars.length <= 4) {
    if (sharedCharCount >= targetChars.length - 1 && startsWithSameChar) {
      return 88;
    }
    if (samePositionCount >= targetChars.length - 1) return 84;
    if (startsWithSameChar && endsWithSameChar) return 80;
    if (sharedCharCount >= Math.max(2, targetChars.length - 1)) return 74;
  }

  return 0;
}

function getSpeechScore(transcript: string, targetWord: string) {
  const normalizedTarget = normalizeText(targetWord);
  const normalizedTranscript = normalizeText(transcript);

  if (!normalizedTarget || !normalizedTranscript) return 0;
  if (normalizedTranscript.includes(normalizedTarget)) return 100;

  const pronunciationVariants = new Set([
    normalizedTarget,
    normalizedTarget.replace(/ㅐ/g, "ㅔ"),
    normalizedTarget.replace(/ㅔ/g, "ㅐ"),
    normalizedTarget.replace(/ㄲ/g, "ㄱ"),
    normalizedTarget.replace(/ㅆ/g, "ㅅ"),
    normalizedTarget.replace(/ㅉ/g, "ㅈ"),
    normalizedTarget.replace(/ㅃ/g, "ㅂ"),
    normalizedTarget.replace(/ㄸ/g, "ㄷ"),
  ]);

  const candidates = transcript
    .split(/\s+/)
    .map((item: string) => normalizeText(item))
    .filter(Boolean);

  candidates.push(normalizedTranscript);

  let best = 0;
  candidates.forEach((candidate: string) => {
    pronunciationVariants.forEach((variant) => {
      if (candidate.includes(variant)) {
        best = Math.max(best, 98);
        return;
      }

      const distance = levenshteinDistance(candidate, variant);
      const maxLength = Math.max(candidate.length, variant.length) || 1;
      const score = Math.round((1 - distance / maxLength) * 100);
      const looseScore = getLooseSpeechMatchScore(candidate, variant);
      best = Math.max(best, score, looseScore);
    });
  });

  return best;
}

function findDirectSpeechMatch(transcript: string, fallingWords: FallingWord[]) {
  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedTranscript) return null;

  const directMatches = fallingWords
    .map((entry) => {
      const normalizedWord = normalizeText(entry.text);
      if (!normalizedWord) return null;

      const isExact =
        normalizedTranscript === normalizedWord ||
        normalizedTranscript.includes(normalizedWord);
      const isContained =
        normalizedWord.length >= 2 && normalizedWord.includes(normalizedTranscript);

      if (!isExact && !isContained) return null;

      return {
        entry,
        threshold: getPassThreshold(entry.text),
        normalizedLength: normalizedWord.length,
      };
    })
    .filter(Boolean) as Array<{
    entry: FallingWord;
    threshold: number;
    normalizedLength: number;
  }>;

  if (!directMatches.length) return null;

  directMatches.sort(
    (a, b) => b.entry.y - a.entry.y || b.normalizedLength - a.normalizedLength,
  );

  return {
    entry: directMatches[0].entry,
    score: 100,
    threshold: directMatches[0].threshold,
  };
}

function removeMatchedFallingWords(fallingWords: FallingWord[], matchedWord: string) {
  const normalizedMatchedWord = normalizeText(matchedWord);
  if (!normalizedMatchedWord) return fallingWords;

  return fallingWords.filter(
    (entry) => normalizeText(entry.text) !== normalizedMatchedWord,
  );
}

function getDisplayTranscript(transcript: string) {
  return transcript
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function shouldHideTranscriptDisplay(transcript: string) {
  const value = transcript.trim();
  if (!value) return true;
  if (/^\d+$/.test(value)) return true;
  if (value.length === 1 && !/[가-힣]/.test(value)) return true;
  return false;
}

function getPassThreshold(targetWord: string) {
  const length = normalizeText(targetWord).length;
  if (length <= 2) return 70;
  if (length <= 4) return 72;
  if (length <= 7) return 70;
  return 68;
}

function getSpeechGradeLabel(score: number, threshold: number) {
  if (score < threshold) return "Fail";
  if (score >= 95) return "Perfect";
  if (score >= Math.max(threshold + 6, 84)) return "Excellent";
  return "Good";
}

function isRecordingSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function LevelSelectionModal({
  selectedLevel,
  onSelect,
  onStart,
  onHome,
}: {
  selectedLevel: number;
  onSelect: (level: number) => void;
  onStart: () => void;
  onHome: () => void;
}) {
  const levelWords =
    WORDS_BY_LEVEL[Math.min(selectedLevel, 8) as keyof typeof WORDS_BY_LEVEL] ?? [];
  const previewWord = levelWords[0] ?? "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#05050c]/90 p-4 [@media(min-height:901px)]:p-6 backdrop-blur-xl">
      <div className="relative my-auto flex w-full max-w-[560px] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[40px] border border-[#2a2a5a] bg-[#111120] text-white shadow-[0_32px_80px_rgba(0,0,0,0.55)] [@media(min-height:901px)]:rounded-[56px]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(42,42,90,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(42,42,90,0.18)_1px,transparent_1px)] bg-[size:28px_28px] opacity-60" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#74b9ff] via-[#a29bfe] to-[#55efc4]" />
        <button
          type="button"
          onClick={onHome}
          className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-slate-200 shadow-sm transition-colors hover:bg-white/10"
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
        <div className="relative border-b border-[#2a2a5a] bg-white/[0.03] px-5 pb-5 pt-7 text-center [@media(min-height:901px)]:px-8 [@media(min-height:901px)]:pb-8 [@media(min-height:901px)]:pt-12">
          <div className="mx-auto mb-3 [@media(min-height:901px)]:mb-6 flex h-14 w-14 [@media(min-height:901px)]:h-20 [@media(min-height:901px)]:w-20 items-center justify-center rounded-[24px] [@media(min-height:901px)]:rounded-[32px] border border-white/10 bg-gradient-to-br from-[#74b9ff] to-[#4ecdc4] text-white shadow-xl">
            <span className="text-2xl [@media(min-height:901px)]:text-4xl">🎙️</span>
          </div>
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.4em] text-violet-300">
            Puzzle Roadmap Protocol
          </span>
          <h3 className="text-2xl [@media(min-height:901px)]:text-4xl font-black tracking-tighter text-white">
            훈련 단계 선택
          </h3>
        </div>

        <div className="relative overflow-y-auto p-5 [@media(min-height:901px)]:p-8">
          <div className="mb-5 [@media(min-height:901px)]:mb-10 grid grid-cols-3 gap-3 [@media(min-height:901px)]:gap-4">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((lv) => (
              <button
                key={lv}
                onClick={() => onSelect(lv)}
                className={`group relative flex h-16 [@media(min-height:901px)]:h-24 flex-col items-center justify-center gap-1 rounded-[20px] [@media(min-height:901px)]:rounded-[32px] border-2 transition-all ${
                  selectedLevel === lv
                    ? "scale-105 border-violet-400 bg-violet-500/18 text-white shadow-lg"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-violet-300 hover:bg-white/10"
                }`}
              >
                <span className="text-[10px] font-black uppercase opacity-60">
                  Level
                </span>
                <strong className="text-2xl [@media(min-height:901px)]:text-3xl font-black">{lv}</strong>
              </button>
            ))}
          </div>

          <div className="mb-4 [@media(min-height:901px)]:mb-8 rounded-[24px] [@media(min-height:901px)]:rounded-[32px] border border-violet-100 bg-violet-50 p-4 [@media(min-height:901px)]:p-6 text-center">
            <p className="text-sm font-bold leading-relaxed text-violet-600">
              <span className="mb-1 block text-[11px] font-black tracking-widest opacity-60">
                SELECTED LEVEL PREVIEW
              </span>
              "{previewWord}" 외 9개 단어 발화 훈련
            </p>
          </div>

          <button
            onClick={onStart}
            className="flex h-14 [@media(min-height:901px)]:h-20 w-full items-center justify-center gap-3 rounded-[24px] [@media(min-height:901px)]:rounded-[28px] bg-slate-900 text-base [@media(min-height:901px)]:text-xl font-black text-white shadow-2xl shadow-slate-200 transition-transform active:scale-95"
          >
            {selectedLevel}단계 훈련 시작하기
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

function GameResultModal({
  result,
  onHome,
}: {
  result: GameResult;
  onHome: () => void;
}) {
  const totalAttempts = Math.max(1, result.successCount + result.failCount);
  const successRate = Math.round((result.successCount / totalAttempts) * 100);

  return (
    <LingoResultModalShell
      icon="🏆"
      badgeText={result.survived ? "Training Complete" : "Training Result"}
      title={result.survived ? "생존 성공 리포트" : "훈련 결과 리포트"}
      subtitle={
        result.survived
          ? "제한 시간 동안 단어를 버텨내며 스테이지를 클리어했습니다."
          : "쌓인 단어가 한계에 도달해 훈련이 종료되었습니다."
      }
      headerToneClass="bg-transparent"
      iconToneClass="bg-gradient-to-br from-[#74b9ff] to-[#4ecdc4]"
      badgeToneClass="text-violet-300"
      primaryLabel="단계 선택으로"
      onPrimary={onHome}
      primaryButtonClass="bg-gradient-to-r from-[#111d42] to-[#74b9ff]"
    >
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-[32px] border border-slate-100 bg-slate-50 p-6 text-center">
            <span className="mb-2 block text-[11px] font-black uppercase text-slate-400">
              Success Rate
            </span>
            <strong className="text-4xl font-black text-violet-600">{successRate}%</strong>
          </div>
          <div className="rounded-[32px] border border-slate-100 bg-slate-50 p-6 text-center">
            <span className="mb-2 block text-[11px] font-black uppercase text-slate-400">
              Survival Time
            </span>
            <strong className="text-4xl font-black text-slate-900">{result.durationSeconds}s</strong>
          </div>
        </div>

        <div className="mb-10 flex h-14 w-full overflow-hidden rounded-2xl border-4 border-slate-50">
          <div
            className="flex items-center justify-center bg-violet-500 text-xs font-black text-white"
            style={{ width: `${successRate}%` }}
          >
            성공 {result.successCount}
          </div>
          <div
            className="flex items-center justify-center bg-slate-200 text-xs font-black text-slate-500"
            style={{ width: `${100 - successRate}%` }}
          >
            실패 {result.failCount}
          </div>
        </div>
    </LingoResultModalShell>
  );
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function TetrisGame({ onBack }: { onBack?: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roadmapStageId = Number(searchParams.get("roadmapStage") || "0");
  const roadmapNodeId =
    searchParams.get("roadmapNode") || searchParams.get("roadmapSection") || "";
  const roadmapNodePayload = getGameModeNodePayload(roadmapStageId, roadmapNodeId);
  const customTetrisWordPool =
    roadmapNodePayload?.gameType === "tetris"
      ? (roadmapNodePayload.payload as GameModeTetrisNodePayload).wordPool
      : null;
  const isLocalDebug =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const {
    volume,
    isMicReady,
    error,
    start: startAudioMonitor,
    stop: stopAudioMonitor,
  } = useAudioAnalyzer();

  // Canvas / game refs (불변 refs — 렌더링에 직접 사용하지 않음)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const boardRef = useRef<Board>(makeBoard());
  const pieceRef = useRef<Piece | null>(null);
  const fallingWordsRef = useRef<FallingWord[]>([]);
  const stackedWordsRef = useRef<string[]>([]);
  const burstParticlesRef = useRef<WordBurstParticle[]>([]);
  const runningRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const spawnCounterRef = useRef(0);
  const nextFallingWordIdRef = useRef(1);
  const nextBurstParticleIdRef = useRef(1);
  const survivalTimeLeftRef = useRef(0);
  const spawnWordIdxRef = useRef(0);
  const levelRef = useRef(1);
  const wordsClearedRef = useRef(0);
  const wordIdxRef = useRef(0);
  const currentWordRef = useRef("");
  const currentSegmentRef = useRef("");
  const targetSegmentsRef = useRef<string[]>([]);
  const segmentIdxRef = useRef(0);
  const recognitionCooldownRef = useRef(0);
  const failCountRef = useRef(0);
  const failStreakRef = useRef(0);
  const prevCostumeTierRef = useRef(0);
  const successStreakRef = useRef(0);
  const sttSessionActiveRef = useRef(false);
  const preferredAudioInputIdRef = useRef("");
  const browserRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(
    null,
  );
  const browserRecognitionRestartRef = useRef<number | null>(null);
  const speechModeRef = useRef<"none" | "browser">("none");

  // Face-tracking / costume canvas refs
  const costumeCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const faceLoopRef = useRef<number | null>(null);
  const latestLandmarksRef = useRef<Landmark[] | null>(null);
  const faceProcessingRef = useRef(false);
  const costumeImagesRef = useRef<CostumeImages>({});
  const volumeRef = useRef(0);

  // UI state
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [wordsCleared, setWordsCleared] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [currentSegment, setCurrentSegment] = useState("");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentCount, setSegmentCount] = useState(1);
  const [fallProgress, setFallProgress] = useState(0);
  const [dropTimeLeftMs, setDropTimeLeftMs] = useState(0);
  const [dropTimeTotalMs, setDropTimeTotalMs] = useState(0);
  const [activeWords, setActiveWords] = useState<string[]>([]);
  const [survivalTimeLeftMs, setSurvivalTimeLeftMs] = useState(0);
  const [totalAccuracy, setTotalAccuracy] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [failStreak, setFailStreak] = useState(0);
  const [successStreak, setSuccessStreak] = useState(0);
  const [wordFlowEntries, setWordFlowEntries] = useState<Array<WordFlowEntry | null>>(
    Array(10).fill(null),
  );
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const autoStartedRef = useRef(false);
  const [heardText, setHeardText] = useState("");
  const [passThreshold, setPassThreshold] = useState(
    getPassThreshold(customTetrisWordPool?.[0] ?? getWord(1, 0)),
  );
  const [audioBars, setAudioBars] = useState(Array(16).fill(10));
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [faceTracked, setFaceTracked] = useState(false);
  const [faceGuideScore, setFaceGuideScore] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [preferredAudioInputId, setPreferredAudioInputId] = useState("");
  const [speechMode, setSpeechMode] = useState<"none" | "browser">(
    "none",
  );
  const [costumeUnlockToast, setCostumeUnlockToast] = useState<{
    id: number;
    icon: string;
    label: string;
  } | null>(null);
  const [pendingCostumeTier, setPendingCostumeTier] = useState<number | null>(
    null,
  );
  const stageMapHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}`
      : "/select-page/game-mode";
  const stageMapReturnHref =
    roadmapStageId >= 1
      ? `/select-page/game-mode/stage/${roadmapStageId}?opened=1&focusNode=${encodeURIComponent(roadmapNodeId)}`
      : "/select-page/game-mode";
  const roadmapClearMarkedRef = useRef(false);
  const getRoadmapAwareWord = useCallback(
    (levelValue: number, idx: number) => {
      if (customTetrisWordPool?.length) {
        return customTetrisWordPool[idx % customTetrisWordPool.length] ?? "";
      }
      return getWord(levelValue, idx);
    },
    [customTetrisWordPool],
  );
  const handleHome = onBack ?? (() => router.push(stageMapHref));
  const handleStageReturn = () => router.push(stageMapReturnHref);
  const hasRecognizedSpeech =
    Boolean(heardText && heardText !== "...") && totalAccuracy > 0;
  const currentSpeechGrade =
    gameStarted && hasRecognizedSpeech
      ? getSpeechGradeLabel(totalAccuracy, passThreshold)
      : null;

  useEffect(() => {
    if (!gameResult || roadmapClearMarkedRef.current) return;
    if (roadmapStageId < 1 || !roadmapNodeId) return;
    if (!gameResult.survived) return;

    markGameModeStageCleared(roadmapStageId, roadmapNodeId, "tetris");
    roadmapClearMarkedRef.current = true;
  }, [gameResult, roadmapNodeId, roadmapStageId]);

  const refreshAudioInputDevices = useCallback(async () => {
    try {
      const devices = await listAudioInputDevices();
      setAudioInputDevices(devices);
    } catch (deviceError) {
      console.warn("[Tetris Audio] failed to enumerate microphones", deviceError);
    }
  }, []);

  const syncVisibleWords = useCallback((words: string[]) => {
    const visible = words.slice(0, WORD_DROP_MAX_ACTIVE);
    setActiveWords(visible);
    const lead = visible[0] ?? "";
    currentWordRef.current = lead;
    setCurrentWord(lead);
    targetSegmentsRef.current = lead ? [lead] : [];
    segmentIdxRef.current = 0;
    setSegmentIndex(0);
    setSegmentCount(lead ? 1 : 0);
    currentSegmentRef.current = lead;
    setCurrentSegment(lead);
    setPassThreshold(getPassThreshold(lead));
  }, []);

  const syncDropTiming = useCallback(() => {
    const fallingWords = fallingWordsRef.current;
    if (!fallingWords.length) {
      setFallProgress(0);
      setDropTimeLeftMs(0);
      setDropTimeTotalMs(0);
      return;
    }

    const canvasHeight = ROWS * BLOCK_SIZE;
    const stackHeight =
      stackedWordsRef.current.length * (WORD_DROP_CARD_HEIGHT + WORD_DROP_CARD_GAP);
    const dangerY =
      canvasHeight -
      stackHeight -
      WORD_DROP_CARD_HEIGHT -
      16;
    const nearestWord = [...fallingWords].sort((a, b) => b.y - a.y)[0];
    const remainingPx = Math.max(0, dangerY - nearestWord.y);
    const totalPx = Math.max(1, dangerY + WORD_DROP_CARD_HEIGHT);
    const remainingMs = Math.round((remainingPx / Math.max(1, nearestWord.speed)) * 1000);
    const totalMs = Math.round((totalPx / Math.max(1, nearestWord.speed)) * 1000);

    setDropTimeTotalMs(totalMs);
    setDropTimeLeftMs(remainingMs);
    setFallProgress(
      totalMs > 0
        ? Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)))
        : 0,
    );
  }, []);

  const spawnFallingWord = useCallback(() => {
    const nextWord = getRoadmapAwareWord(levelRef.current, spawnWordIdxRef.current);
    if (!nextWord) return;

    spawnWordIdxRef.current += 1;
    const nextEntry: FallingWord = {
      id: nextFallingWordIdRef.current++,
      text: nextWord,
      y: -WORD_DROP_CARD_HEIGHT,
      speed: 30 + levelRef.current * 2,
    };

    fallingWordsRef.current = [...fallingWordsRef.current, nextEntry];
    syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
    syncDropTiming();
  }, [getRoadmapAwareWord, syncDropTiming, syncVisibleWords]);

  const spawnWordBurst = useCallback((word: FallingWord) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.width / 2;
    const centerY = word.y + WORD_DROP_CARD_HEIGHT / 2;
    const colors = ["#a78bfa", "#f472b6", "#22d3ee", "#fbbf24"];
    const particles: WordBurstParticle[] = Array.from({ length: 14 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 14;
      const speed = 40 + Math.random() * 55;
      return {
        id: nextBurstParticleIdRef.current++,
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        life: 0.38 + Math.random() * 0.18,
        maxLife: 0.38 + Math.random() * 0.18,
        color: colors[index % colors.length],
      };
    });
    burstParticlesRef.current = [...burstParticlesRef.current, ...particles];
    playLingoSuccessSound();
  }, []);

  const buildRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const ctor =
      (window as FaceMeshWindow).SpeechRecognition ??
      (window as FaceMeshWindow).webkitSpeechRecognition;
    if (!ctor) return null;
    return new ctor();
  }, []);

  const stopCamera = useCallback(() => {
    // Face-tracking 루프 정리
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

  const stopSpeechCapture = useCallback(() => {
    sttSessionActiveRef.current = false;
    speechModeRef.current = "none";
    setSpeechMode("none");
    if (browserRecognitionRestartRef.current !== null) {
      window.clearTimeout(browserRecognitionRestartRef.current);
      browserRecognitionRestartRef.current = null;
    }
    if (browserRecognitionRef.current) {
      try {
        browserRecognitionRef.current.onresult = null;
        browserRecognitionRef.current.onerror = null;
        browserRecognitionRef.current.onend = null;
        browserRecognitionRef.current.stop();
      } catch {
        /* no-op */
      }
      browserRecognitionRef.current = null;
    }
  }, []);

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
      // 자동 재생 타이밍 이슈는 이후 effect에서 다시 맞춥니다.
    }
  }, []);

  // ─── MediaPipe Face Mesh 초기화 + 코스튬 렌더 루프 ───────────────────────
  const initFaceTracking = useCallback(async () => {
    if (typeof window === "undefined") return;

    // ① RAF 렌더 루프를 즉시 시작 → 카메라 화면 바로 표시
    //    FaceMesh가 아직 없어도 비디오만 먼저 그림
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

            // object-fit: cover 동작 재현
            const scale = Math.max(cw / vw, ch / vh);
            const successCnt = successStreakRef.current;
            const failStreakCnt = failStreakRef.current;
            const isSparkleState = successCnt >= 8;
            const isCelebrationState = successCnt >= 6;
            const tierId = COSTUME_TIERS.reduce<string>(
              (best, tier, i) =>
                successCnt >= tier.minStreak ? COSTUME_TIERS[i].id : best,
              COSTUME_TIERS[0].id,
            );

            ctx.clearRect(0, 0, cw, ch);

            if (isCelebrationState) {
              const glow = ctx.createRadialGradient(
                cw / 2,
                ch * 0.38,
                18,
                cw / 2,
                ch * 0.42,
                Math.max(cw, ch) * 0.52,
              );
              glow.addColorStop(
                0,
                isSparkleState
                  ? "rgba(255, 226, 120, 0.13)"
                  : "rgba(111, 221, 255, 0.11)",
              );
              glow.addColorStop(1, "rgba(255,255,255,0)");
              ctx.save();
              ctx.fillStyle = glow;
              ctx.fillRect(0, 0, cw, ch);
              ctx.restore();
            }
            drawCameraOverlay(
              ctx,
              cw,
              ch,
              tierId,
              failStreakCnt,
            );

            // 코스튬 합성 (FaceMesh 준비된 경우에만)
            if (
              latestLandmarksRef.current &&
              Object.keys(costumeImagesRef.current).length > 0
            ) {
              const tierIdx = COSTUME_TIERS.reduce<number>(
                (best, tier, i) => (successCnt >= tier.minStreak ? i : best),
                0,
              );
              drawFaceCostume(
                ctx,
                latestLandmarksRef.current,
                cw,
                ch,
                vw,
                vh,
                COSTUME_TIERS[tierIdx].id,
                failStreakCnt,
                failCountRef.current,
                costumeImagesRef.current,
              );
            }

            // FaceMesh에 프레임 전송 (준비된 경우에만)
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

    // ② FaceMesh가 이미 로딩됐으면 재초기화 불필요
    if (faceMeshRef.current) return;

    // ③ FaceMesh + SVG 이미지를 백그라운드에서 로딩 (비디오는 이미 보임)
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
      fm.onResults((results: any) => {
        const nextLandmarks =
          (results.multiFaceLandmarks?.[0] as Landmark[]) ?? null;
        latestLandmarksRef.current = nextLandmarks;
        setFaceTracked(Boolean(nextLandmarks));
      });
      await fm.initialize?.();
      faceMeshRef.current = fm;

      // SVG 코스튬 이미지 로딩
      const [star, crown, trophy, tear, earring, necklace] = await Promise.all([
        loadImage(COSTUME_ASSETS.star),
        loadImage(COSTUME_ASSETS.crown),
        loadImage(COSTUME_ASSETS.trophy),
        loadImage(COSTUME_ASSETS.tear),
        loadImage(COSTUME_ASSETS.earring),
        loadImage(COSTUME_ASSETS.necklace),
      ]);
      costumeImagesRef.current = {
        star,
        crown,
        trophy,
        tear,
        earring,
        necklace,
      };
      setCameraError("");
    } catch (err) {
      console.warn("FaceMesh 초기화 실패:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "알 수 없는 오류";
      setCameraError(`AI 합성 실패: ${message}`);
    }
  }, [setCameraError]);

  const stopSessionDevices = useCallback(() => {
    stopSpeechCapture();
    stopAudioMonitor();
    stopCamera();
  }, [stopAudioMonitor, stopCamera, stopSpeechCapture]);

  const finishGame = useCallback(
    (survived: boolean) => {
      runningRef.current = false;
      setGameStarted(false);
      stopSessionDevices();

      const fullDuration = getLevelSurvivalDuration(levelRef.current);
      const remainingSeconds = Math.max(
        0,
        Math.ceil(survivalTimeLeftRef.current / 1000),
      );
      const durationSeconds = survived
        ? fullDuration
        : Math.max(0, fullDuration - remainingSeconds);

      setGameResult({
        clearedWords: wordsClearedRef.current,
        level: levelRef.current,
        averageScore: totalAccuracy,
        successCount: wordsClearedRef.current,
        failCount: failCountRef.current,
        survived,
        durationSeconds,
      });
    },
    [stopSessionDevices, totalAccuracy],
  );

  const goToNextWord = useCallback(() => {
    if (fallingWordsRef.current.length < Math.max(2, WORD_DROP_MAX_ACTIVE - 1)) {
      spawnFallingWord();
    } else {
      syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
      syncDropTiming();
    }
  }, [spawnFallingWord, syncDropTiming, syncVisibleWords]);

  const applyDangerPenalty = useCallback(() => {
    const target = [...fallingWordsRef.current].sort((a, b) => b.y - a.y)[0];
    if (!target) return;

    fallingWordsRef.current = fallingWordsRef.current.filter((entry) => entry.id !== target.id);
    stackedWordsRef.current = [...stackedWordsRef.current, target.text];

    const failedIndex = Math.min(9, wordsClearedRef.current + failCountRef.current);
    failCountRef.current += 1;
    setFailCount(failCountRef.current);
    failStreakRef.current += 1;
    setFailStreak(failStreakRef.current);
    successStreakRef.current = 0;
    setSuccessStreak(0);
    prevCostumeTierRef.current = 0;
    setPendingCostumeTier(null);

    setWordFlowEntries((prev) => {
      const updated = [...prev];
      updated[failedIndex] = {
        word: target.text || `단어 ${failedIndex + 1}`,
        status: "fail",
      };
      return updated;
    });

    setActionFeedback({
      id: Date.now(),
      type: "fail",
      label: "Fail",
    });

    syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
    syncDropTiming();

    if (stackedWordsRef.current.length >= WORD_DROP_STACK_LIMIT) {
      finishGame(false);
      return;
    }

    goToNextWord();

    setTimeout(() => {
      setActionFeedback(null);
    }, 1200);
  }, [finishGame, goToNextWord, syncDropTiming]);

  // ─── Canvas 그리기 ────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawWordCard = (
      word: string,
      x: number,
      y: number,
      width: number,
      height: number,
      mode: "active" | "stacked",
    ) => {
      ctx.save();
      ctx.shadowBlur = mode === "active" ? 18 : 0;
      ctx.shadowColor = mode === "active" ? "rgba(139, 92, 246, 0.35)" : "transparent";
      ctx.fillStyle = mode === "active" ? "#2a1650" : "#3b1734";
      ctx.strokeStyle = mode === "active" ? "rgba(167, 139, 250, 0.7)" : "rgba(244, 114, 182, 0.45)";
      ctx.lineWidth = 2;
      rrect(ctx, x, y, width, height, 18);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${mode === "active" ? 18 : 15}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(word, x + width / 2, y + height / 2);
      ctx.restore();
    };

    const cardWidth = canvas.width - 28;
    const cardX = 14;
    const stackedWords = stackedWordsRef.current;
    stackedWords.forEach((word, index) => {
      const y =
        canvas.height -
        14 -
        WORD_DROP_CARD_HEIGHT -
        index * (WORD_DROP_CARD_HEIGHT + WORD_DROP_CARD_GAP);
      drawWordCard(word, cardX, y, cardWidth, WORD_DROP_CARD_HEIGHT, "stacked");
    });

    const fallingWords = [...fallingWordsRef.current].sort((a, b) => a.y - b.y);
    fallingWords.forEach((entry) => {
      drawWordCard(entry.text, cardX, entry.y, cardWidth, WORD_DROP_CARD_HEIGHT, "active");
    });

    burstParticlesRef.current.forEach((particle) => {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, []);

  // ─── 게임 루프 ────────────────────────────────────────────────────────────
  const gameLoop = useCallback(
    (time = 0) => {
      if (!runningRef.current) return;
      const delta =
        lastTimeRef.current === 0 ? 0 : Math.max(0, time - lastTimeRef.current);
      lastTimeRef.current = time;

      survivalTimeLeftRef.current = Math.max(
        0,
        survivalTimeLeftRef.current - delta,
      );
      setSurvivalTimeLeftMs(survivalTimeLeftRef.current);
      if (survivalTimeLeftRef.current <= 0) {
        finishGame(true);
        syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
        draw();
        return;
      }

      fallingWordsRef.current = fallingWordsRef.current.map((entry) => ({
        ...entry,
        y: entry.y + entry.speed * (delta / 1000),
      }));
      burstParticlesRef.current = burstParticlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * (delta / 1000),
          y: particle.y + particle.vy * (delta / 1000),
          vy: particle.vy + 120 * (delta / 1000),
          life: particle.life - delta / 1000,
        }))
        .filter((particle) => particle.life > 0);

      const dangerY =
        ROWS * BLOCK_SIZE -
        stackedWordsRef.current.length * (WORD_DROP_CARD_HEIGHT + WORD_DROP_CARD_GAP) -
        WORD_DROP_CARD_HEIGHT -
        16;
      const overflowWord = [...fallingWordsRef.current].sort((a, b) => b.y - a.y)[0];
      if (overflowWord && overflowWord.y >= dangerY) {
        applyDangerPenalty();
      }

      spawnCounterRef.current += delta;
      if (
        runningRef.current &&
        spawnCounterRef.current >= WORD_DROP_SPAWN_INTERVAL_MS &&
        fallingWordsRef.current.length < WORD_DROP_MAX_ACTIVE
      ) {
        spawnCounterRef.current = 0;
        spawnFallingWord();
      }

      syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
      syncDropTiming();
      draw();
      animRef.current = requestAnimationFrame(gameLoop);
    },
    [
      applyDangerPenalty,
      draw,
      finishGame,
      spawnFallingWord,
      syncDropTiming,
      syncVisibleWords,
    ],
  );

  const advanceAfterMatch = useCallback(() => {
    const successIndex = Math.min(9, wordsClearedRef.current + failCountRef.current);
    const next = wordsClearedRef.current + 1;
    const nextStreak = successStreakRef.current + 1;
    wordsClearedRef.current = next;
    setWordsCleared(next);
    failStreakRef.current = 0;
    setFailStreak(0);
    successStreakRef.current = nextStreak;
    setSuccessStreak(nextStreak);
    setWordFlowEntries((prev) => {
      const updated = [...prev];
      updated[successIndex] = {
        word: currentWordRef.current || `단어 ${successIndex + 1}`,
        status: "success",
      };
      return updated;
    });

    window.setTimeout(() => {
      if (!runningRef.current) return;
      goToNextWord();
    }, 220);
  }, [goToNextWord]);

  // ─── 발화 결과 처리 ───────────────────────────────────────────────────────
  const processResult = useCallback(
    (transcript: string) => {
      if (!runningRef.current || !fallingWordsRef.current.length) return;
      if (Date.now() < recognitionCooldownRef.current) return;

      const displayTranscript = getDisplayTranscript(transcript);

      if (displayTranscript && !shouldHideTranscriptDisplay(displayTranscript)) {
        setHeardText(displayTranscript);
      } else {
        setHeardText("...");
      }

      const directMatch = findDirectSpeechMatch(transcript, fallingWordsRef.current);
      if (directMatch?.entry) {
        recognitionCooldownRef.current = Date.now() + MATCH_COOLDOWN_MS;
        setTotalAccuracy(directMatch.score);
        setPassThreshold(directMatch.threshold);
        spawnWordBurst(directMatch.entry);
        fallingWordsRef.current = removeMatchedFallingWords(
          fallingWordsRef.current,
          directMatch.entry.text,
        );
        syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
        syncDropTiming();
        draw();
        setActionFeedback({
          id: Date.now(),
          type: "success",
          label: "Perfect",
        });
        currentWordRef.current = directMatch.entry.text;
        advanceAfterMatch();
        setTimeout(() => {
          setActionFeedback(null);
        }, 800);
        return;
      }

      const scoredMatches = fallingWordsRef.current.map((entry) => {
        const score = getSpeechScore(transcript, entry.text);
        const threshold = getPassThreshold(entry.text);
        return { entry, score, threshold };
      });
      const strongestMatch = scoredMatches.reduce<{
        entry: FallingWord | null;
        score: number;
        threshold: number;
      }>(
        (best, candidate) => {
          if (candidate.score > best.score) {
            return candidate;
          }
          return best;
        },
        { entry: null, score: 0, threshold: 100 },
      );

      setTotalAccuracy(strongestMatch.score);
      setPassThreshold(strongestMatch.threshold);

      const removableMatches = scoredMatches
        .filter((candidate) => candidate.entry && candidate.score >= candidate.threshold)
        .sort((a, b) => b.entry.y - a.entry.y || b.score - a.score);

      const matchedTarget = removableMatches[0];
      if (!matchedTarget?.entry) return;

      recognitionCooldownRef.current = Date.now() + MATCH_COOLDOWN_MS;
      spawnWordBurst(matchedTarget.entry);
      fallingWordsRef.current = removeMatchedFallingWords(
        fallingWordsRef.current,
        matchedTarget.entry.text,
      );
      syncVisibleWords(fallingWordsRef.current.map((entry) => entry.text));
      syncDropTiming();
      draw();

      setActionFeedback({
        id: Date.now(),
        type: "success",
        label: getSpeechGradeLabel(matchedTarget.score, matchedTarget.threshold),
      });
      currentWordRef.current = matchedTarget.entry.text;
      advanceAfterMatch();
      setTimeout(() => {
        setActionFeedback(null);
      }, 800);
    },
    [advanceAfterMatch, draw, spawnWordBurst, syncDropTiming, syncVisibleWords],
  );

  const simulateMatch = useCallback(() => {
    if (!runningRef.current || !currentWordRef.current) return;
    processResult(currentWordRef.current);
  }, [processResult]);

  const simulateStack = useCallback(() => {
    if (!runningRef.current || !fallingWordsRef.current.length) return;
    recognitionCooldownRef.current = Date.now() + MATCH_COOLDOWN_MS;
    applyDangerPenalty();
  }, [applyDangerPenalty]);

  const currentCameraTierId = COSTUME_TIERS.reduce<string>(
    (best, tier, i) =>
      successStreak >= tier.minStreak ? COSTUME_TIERS[i].id : best,
    COSTUME_TIERS[0].id,
  );

  const startBrowserSpeechRecognition = useCallback(async () => {
    const recognition = buildRecognition();
    if (!recognition) {
      setSpeechError("이 브라우저는 실시간 음성 인식을 지원하지 않습니다.");
      return false;
    }

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";
    recognition.onresult = (event) => {
      let latestTranscript = "";
      for (let i = event.results.length - 1; i >= 0; i -= 1) {
        const candidate = String(event.results[i]?.[0]?.transcript ?? "").trim();
        if (candidate) {
          latestTranscript = candidate;
          break;
        }
      }
      if (!latestTranscript) return;
      setSpeechError("");
      processResult(latestTranscript);
    };
    recognition.onerror = (event) => {
      const reason = String(event?.error ?? "").trim();
      if (reason === "aborted" || reason === "no-speech") return;
      console.error("[Tetris Browser STT] error", reason);
      setSpeechError(
        reason
          ? `브라우저 음성 인식이 실패했어요. (${reason})`
          : "브라우저 음성 인식이 실패했어요.",
      );
    };
    recognition.onend = () => {
      browserRecognitionRef.current = null;
      if (!sttSessionActiveRef.current || !runningRef.current) {
        return;
      }
      browserRecognitionRestartRef.current = window.setTimeout(() => {
        if (!sttSessionActiveRef.current || !runningRef.current) return;
        void startBrowserSpeechRecognition();
      }, 140);
    };

    try {
      recognition.start();
      browserRecognitionRef.current = recognition;
      sttSessionActiveRef.current = true;
      speechModeRef.current = "browser";
      setSpeechMode("browser");
      setSpeechError("");
      return true;
    } catch (error) {
      console.error("[Tetris Browser STT] failed to start", error);
      const message =
        error instanceof Error
          ? error.message
          : "브라우저 음성 인식을 시작하지 못했어요.";
      setSpeechError(message);
      return false;
    }
  }, [buildRecognition, processResult]);

  const syncSpeechCaptureForWord = useCallback(
    async (targetWord: string) => {
      if (!runningRef.current || !targetWord) return;
      stopSpeechCapture();
      await startBrowserSpeechRecognition();
    },
    [startBrowserSpeechRecognition, stopSpeechCapture],
  );

  // ─── 레벨 설정 ────────────────────────────────────────────────────────────
  function handleLevelSelect(lv: number) {
    setSelectedLevel(lv);
  }

  function resolveLevelFromParams() {
    const roadmapStage = Number(searchParams.get("roadmapStage") || "1");
    const safeStage = Math.max(1, Math.min(9, roadmapStage || 1));
    const difficultyParam = String(searchParams.get("difficulty") || "Easy");

    if (difficultyParam === "Hard" || difficultyParam === "Expert") {
      return Math.max(7, safeStage);
    }
    if (difficultyParam === "Normal") {
      return Math.max(4, safeStage);
    }
    return Math.min(3, safeStage);
  }

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
      const nextTrack = stream.getVideoTracks()[0];

      cameraStreamRef.current = stream;
      registerMediaStream(stream);
      setCameraReady(true);
      window.requestAnimationFrame(() => {
        void attachCameraPreview();
      });
      return true;
    } catch (error) {
      setCameraReady(false);
      setCameraError("카메라 권한이 없어서 가이드 화면은 표시되지 않습니다.");
      console.error("[Tetris Camera] failed to start", error);
      return false;
    }
  }, [attachCameraPreview, stopCamera]);

  // ─── 훈련 시작 / 중지 ────────────────────────────────────────────────────
  async function startGameForLevel(startLevel = selectedLevel) {
    levelRef.current = startLevel;
    setLevel(startLevel);
    const durationMs = getLevelSurvivalDuration(startLevel) * 1000;
    setGameResult(null);
    roadmapClearMarkedRef.current = false;
    setActionFeedback(null);

    const audioMonitorReady = await startAudioMonitor(preferredAudioInputIdRef.current);
    if (!audioMonitorReady) {
      setSpeechError("마이크 입력을 확인해 주세요.");
    }
    await startCamera();
    runningRef.current = true;
    setGameStarted(true);
    wordIdxRef.current = 0;
    wordsClearedRef.current = 0;
    setWordsCleared(0);
    setWordFlowEntries(Array(10).fill(null));
    failCountRef.current = 0;
    setFailCount(0);
    failStreakRef.current = 0;
    setFailStreak(0);
    successStreakRef.current = 0;
    setSuccessStreak(0);
    prevCostumeTierRef.current = 0;
    setPendingCostumeTier(null);
    setCostumeUnlockToast(null);
    survivalTimeLeftRef.current = durationMs;
    setSurvivalTimeLeftMs(durationMs);
    boardRef.current = makeBoard();
    pieceRef.current = null;
    fallingWordsRef.current = [];
    stackedWordsRef.current = [];
    burstParticlesRef.current = [];
    lastTimeRef.current = performance.now();
    dropCounterRef.current = 0;
    spawnCounterRef.current = 0;
    spawnWordIdxRef.current = 0;
    nextFallingWordIdRef.current = 1;
    syncVisibleWords([]);
    syncDropTiming();
    setShowLevelModal(false);
    spawnFallingWord();
    spawnFallingWord();
    window.requestAnimationFrame(() => {
      void attachCameraPreview();
      void initFaceTracking();
    });
    animRef.current = requestAnimationFrame(gameLoop);
  }

  useEffect(() => {
    if (autoStartedRef.current) return;

    const mappedLevel = resolveLevelFromParams();
    autoStartedRef.current = true;
    setSelectedLevel(mappedLevel);
    void startGameForLevel(mappedLevel);
  }, [searchParams]);

  async function handleStartStop() {
    if (gameStarted) {
      // 중지
      runningRef.current = false;
      setGameStarted(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopSessionDevices();
      failCountRef.current = 0;
      setFailCount(0);
      failStreakRef.current = 0;
      setFailStreak(0);
      successStreakRef.current = 0;
      setSuccessStreak(0);
      prevCostumeTierRef.current = 0;
      setPendingCostumeTier(null);
      setCostumeUnlockToast(null);
      setFallProgress(0);
      setDropTimeLeftMs(0);
      setDropTimeTotalMs(0);
      survivalTimeLeftRef.current = 0;
      setSurvivalTimeLeftMs(0);
      autoStartedRef.current = false;
      void startGameForLevel(levelRef.current);
      return;
    }

    autoStartedRef.current = false;
    void startGameForLevel(levelRef.current);
  }

  const handleAudioInputChange = useCallback(
    async (deviceId: string) => {
      savePreferredAudioInputId(deviceId);
      preferredAudioInputIdRef.current = deviceId;
      setPreferredAudioInputId(deviceId);

      if (!gameStarted) {
        return;
      }

      stopSpeechCapture();
      stopAudioMonitor();
      const audioMonitorReady = await startAudioMonitor(deviceId);
      if (!audioMonitorReady) {
        setSpeechError("마이크 입력을 확인해 주세요.");
        return;
      }
      await syncSpeechCaptureForWord(currentWordRef.current);
    },
    [gameStarted, startAudioMonitor, stopAudioMonitor, stopSpeechCapture, syncSpeechCaptureForWord],
  );

  // ─── cameraReady → video 요소에 스트림 연결 ─────────────────────────────
  // cameraReady → 비디오에 스트림 연결 + FaceMesh 초기화
  // (video는 항상 DOM에 있으므로 videoRef가 null이 아님)
  useEffect(() => {
    if (!cameraReady) return;
    void attachCameraPreview();
    void initFaceTracking();
  }, [attachCameraPreview, cameraReady, initFaceTracking]);

  useEffect(() => {
    if (!cameraReady) return;
    window.requestAnimationFrame(() => {
      void attachCameraPreview();
    });
  }, [attachCameraPreview, cameraReady]);

  // ─── 초기 그리기 + 카메라 자동 연결 ──────────────────────────────────────
  useEffect(() => {
    boardRef.current = makeBoard();
    pieceRef.current = null;
    burstParticlesRef.current = [];
    syncVisibleWords([]);
    draw();
    const savedAudioInputId = loadPreferredAudioInputId();
    preferredAudioInputIdRef.current = savedAudioInputId;
    setPreferredAudioInputId(savedAudioInputId);
    void refreshAudioInputDevices();
    startCamera();
  }, [draw, refreshAudioInputDevices, startCamera, syncVisibleWords]);

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
          const boosted = gameStarted
            ? v * 2.8 * wave * variance + (v > 0 ? 10 : 0)
            : 8 + index * 1.8;
          return Math.max(8, Math.min(100, Math.round(boosted)));
        }),
      );

      if (!gameStarted) {
        setFaceGuideScore(0);
        return;
      }

      setFaceGuideScore((prev) => {
        const base = cameraReady ? 72 : 30;
        const bonus = actionFeedback?.type === "success" ? 14 : 0;
        const drift = Math.sin(Date.now() / 700) * 6;
        const target = Math.round(
          Math.max(0, Math.min(100, base + bonus + drift)),
        );
        return Math.round(prev * 0.65 + target * 0.35);
      });
    }, 90);

    return () => window.clearInterval(tick);
  }, [actionFeedback?.type, cameraReady, gameStarted]);

  useEffect(() => {
    if (error) {
      setSpeechError(error);
    }
  }, [error]);

  useEffect(() => {
    if (!gameStarted || !currentWord) return;
    void syncSpeechCaptureForWord(currentWord);
  }, [currentWord, gameStarted, syncSpeechCaptureForWord]);

  // ─── 코스튬 티어 감지 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameStarted) return;
    const streakCount = successStreak;
    const tierIdx = COSTUME_TIERS.reduce(
      (best, tier, i) => (streakCount >= tier.minStreak ? i : best),
      0,
    );
    if (tierIdx > 0 && tierIdx !== prevCostumeTierRef.current) {
      setPendingCostumeTier(tierIdx);
    }
  }, [successStreak, gameStarted]);

  useEffect(() => {
    if (!gameStarted || !faceTracked || pendingCostumeTier === null) return;
    if (pendingCostumeTier <= prevCostumeTierRef.current) {
      setPendingCostumeTier(null);
      return;
    }
    const tier = COSTUME_TIERS[pendingCostumeTier];
    prevCostumeTierRef.current = pendingCostumeTier;
    setPendingCostumeTier(null);
    if (!tier.label || !tier.hatIcon) return;
    setCostumeUnlockToast({
      id: Date.now(),
      icon: tier.hatIcon,
      label: tier.label,
    });
    const t = setTimeout(() => setCostumeUnlockToast(null), 2600);
    return () => clearTimeout(t);
  }, [faceTracked, gameStarted, pendingCostumeTier]);

  // ─── 클린업 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopSessionDevices();
    };
  }, [stopSessionDevices]);

  // ─── 코스튬 계산 ──────────────────────────────────────────────────────────
  const successCount = successStreak;
  const currentTierIdx = COSTUME_TIERS.reduce(
    (best, tier, i) => (successCount >= tier.minStreak ? i : best),
    0,
  );
  const currentTier = COSTUME_TIERS[currentTierIdx];
  const isChampion = currentTier.id === "sparkle";
  const micSignalDetected = isMicReady && volume > 4;
  const roundSeconds = Math.max(0, Math.ceil(survivalTimeLeftMs / 1000));
  const fullRoundSeconds = Math.max(1, getLevelSurvivalDuration(level));
  const timeProgressPercent = Math.max(
    0,
    Math.min(100, Math.round((survivalTimeLeftMs / (fullRoundSeconds * 1000)) * 100)),
  );
  const recognitionCooldownMs = Math.max(0, recognitionCooldownRef.current - Date.now());
  const speechPhase = !gameStarted
    ? "idle"
    : !isMicReady
      ? "waitingMic"
      : actionFeedback
        ? "judging"
        : recognitionCooldownMs > 0
          ? "prepare"
          : "speak";
  const speechPhaseLabel =
    speechPhase === "speak"
      ? "지금 말하세요"
      : speechPhase === "judging"
        ? "판정 중"
        : speechPhase === "prepare"
          ? "곧 말하세요"
          : speechPhase === "waitingMic"
            ? "마이크 준비 중"
            : "대기";
  const speechPhaseDescription =
    speechPhase === "speak"
      ? "떨어지는 단어 중 하나를 말하면 해당 단어가 바로 사라집니다."
      : speechPhase === "judging"
        ? "방금 말한 단어를 확인하고 있습니다."
        : speechPhase === "prepare"
          ? "새 단어가 내려오고 있습니다. 잠시 후 말하면 더 안정적으로 인식됩니다."
          : speechPhase === "waitingMic"
            ? "마이크 연결이 되면 자동으로 듣기를 시작합니다."
            : "게임을 시작하면 자동으로 듣기를 시작합니다.";
  const speechPhaseTone =
    speechPhase === "speak"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
      : speechPhase === "judging"
        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
        : speechPhase === "prepare"
          ? "border-violet-400/40 bg-violet-500/10 text-violet-200"
          : "border-slate-500/30 bg-slate-500/10 text-slate-300";
  const roadmapClearText =
    roadmapNodePayload?.gameType === "tetris"
      ? "단어를 말하면 즉시 제거되고, 못 맞춘 단어는 아래에 쌓입니다."
      : "정답을 말하면 단어가 제거되고, 쌓이면 GAME OVER가 됩니다.";

  // ─── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <main className="lingo-game-shell relative flex min-h-screen flex-col overflow-hidden bg-[#090914] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(26,26,54,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,54,0.55)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <header className="relative z-10 px-3 py-2 sm:px-6 sm:py-2 border-b border-[#1a1a36] flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 bg-[#090914]/90 backdrop-blur-md shrink-0 sticky top-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <span className="font-black text-[10px] uppercase tracking-[0.28em] leading-none block text-violet-300/80">
              Game Training • Word Clear
            </span>
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
              단어 폭탄
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap justify-end">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
            onClick={() => {
              runningRef.current = false;
              setGameStarted(false);
              stopSessionDevices();
              autoStartedRef.current = false;
              void startGameForLevel(levelRef.current);
            }}
          >
            다시 시작
          </button>
          {isLocalDebug ? (
            <>
              <button
                type="button"
                className="px-3 py-1.5 rounded-full font-black text-[11px] border bg-violet-600 text-white border-violet-500"
                onClick={simulateMatch}
                disabled={!gameStarted}
              >
                정답 처리
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
                onClick={simulateStack}
                disabled={!gameStarted}
              >
                실패 처리
              </button>
            </>
          ) : null}
          <div className="px-3 py-1.5 rounded-full font-black text-[11px] transition-all border border-violet-400/35 bg-violet-500/14 text-violet-100">
            {gameStarted
              ? totalAccuracy >= passThreshold
                ? "MATCH"
                : "LISTENING..."
              : "READY"}
          </div>
          <div className="px-4 py-1.5 rounded-full font-black text-xs border border-sky-400/35 bg-sky-500/12 text-sky-100">
            성공 {gameStarted ? wordsCleared : 0}
          </div>
          <button
            type="button"
            onClick={handleHome}
            aria-label="홈으로 이동"
            title="홈"
            className={`w-9 h-9 ${trainingButtonStyles.homeIcon}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10.5 12 3l9 7.5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.5 9.5V21h13V9.5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 21v-5h4v5"
              />
            </svg>
          </button>
        </div>
      </header>

        <section className="relative z-10 flex-1 overflow-y-auto bg-transparent">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="vt-layout vt-layout-playing tetris-layout-no-left">

          <section className="vt-center">
            <div className="tetris-content-layout">
              <div className="vt-board-shell tetris-board-shell">
                <div className="vt-canvas-wrap">
                  <div className="tetris-board-card-layout">
                    <div className="tetris-game-panel memory-game-panel">
                      <div className="memory-main-card relative w-full max-w-none overflow-hidden rounded-[44px] border-[3px] border-violet-500/25 bg-[#0c0820]/95 p-6 backdrop-blur-sm shadow-[0_0_40px_rgba(139,92,246,0.10)] sm:rounded-[52px] sm:p-8">
                        <div className="mb-6 flex items-center justify-between gap-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span className="shrink-0 text-sm font-black text-violet-300/60">
                              레벨 {level}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="h-2 overflow-hidden rounded-full bg-[#1a1435] ring-1 ring-violet-500/20">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-[width] duration-300"
                                  style={{ width: `${timeProgressPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-[#1a1435] px-4 py-1.5 ring-1 ring-violet-500/25">
                              <span className="text-[10px] font-black uppercase tracking-tighter text-violet-300/60">
                                남은 시간
                              </span>
                              <strong className="ml-2 text-sm font-black text-violet-300">
                                {roundSeconds}s
                              </strong>
                            </div>
                            <div className="flex items-center gap-2 rounded-full bg-[#1a1435] px-4 py-1.5 ring-1 ring-violet-500/25">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  isMicReady
                                    ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                                    : "bg-violet-900/60"
                                }`}
                              />
                              <span className="text-[10px] font-black uppercase tracking-tighter text-violet-300/60">
                                {isMicReady ? "듣기 활성" : "대기"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid items-stretch gap-6">
                          <div className="flex min-w-0 flex-col">
                            <div className="mx-auto grid w-full max-w-[780px] flex-1 items-center justify-center gap-6 lg:grid-cols-[320px_420px] lg:gap-10">
                              <div className="rounded-[28px] border border-violet-500/20 bg-[#0a0818]/80 px-5 py-5 sm:px-6 sm:py-6">
                                <div className="text-left">
                                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black tracking-[0.18em] ${speechPhaseTone}`}>
                                    {speechPhaseLabel}
                                  </div>
                                  <p className="mt-2 text-sm font-bold text-slate-500">
                                    {roadmapClearText}
                                  </p>
                                </div>
                                <div className="mt-5">
                                  <div
                                    className={`vt-camera-frame${isChampion && gameStarted ? " is-champion" : ""}`}
                                  >
                                    {cameraReady ? (
                                      <>
                                        <video
                                          ref={videoRef}
                                          className="vt-camera-video"
                                          autoPlay
                                          muted
                                          playsInline
                                          style={{
                                            filter: getCameraFilter(currentCameraTierId, failStreak),
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

                                    {costumeUnlockToast && (
                                      <div
                                        key={costumeUnlockToast.id}
                                        className="vt-costume-unlock-toast"
                                      >
                                        <span>{costumeUnlockToast.icon}</span>
                                        <strong>{costumeUnlockToast.label} 획득!</strong>
                                      </div>
                                    )}

                                    <div className="tetris-camera-chip">
                                      <span className="tetris-camera-chip-label">안면 상태</span>
                                      <strong className="tetris-camera-chip-value">
                                        {cameraReady
                                          ? faceTracked
                                            ? "인식 중"
                                            : "준비"
                                          : "대기"}
                                      </strong>
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className={`mt-5 rounded-[24px] px-5 py-4 text-left shadow-xl transition-all sm:px-6 sm:py-5 ${
                                    isMicReady
                                      ? "bg-slate-900 ring-2 ring-violet-400/30"
                                      : "bg-slate-800"
                                  }`}
                                >
                                  <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-violet-400">
                                    인식된 말
                                  </div>
                                  <p className="truncate text-lg font-black text-white sm:text-xl">
                                    {heardText ||
                                      (isMicReady ? "지금 단어를 말해 주세요..." : "마이크 대기 중")}
                                  </p>
                                  <p className="mt-2 text-xs font-bold text-slate-300">
                                    {isMicReady
                                      ? "캔버스에 떨어지는 카드 단어를 그대로 말하면 바로 깨집니다."
                                      : "세션이 시작되면 자동으로 음성을 듣습니다."}
                                  </p>
                                  {hasRecognizedSpeech ? (
                                    <div className="mt-3 flex items-center gap-2">
                                      <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-black text-violet-100">
                                        점수 {totalAccuracy}점
                                      </span>
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                                          currentSpeechGrade === "Perfect"
                                            ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                                            : currentSpeechGrade === "Excellent"
                                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                              : currentSpeechGrade === "Good"
                                                ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                                                : "border-rose-400/40 bg-rose-500/10 text-rose-200"
                                        }`}
                                      >
                                        {currentSpeechGrade}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="vt-audio-card mt-5">
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
                                  <div
                                    style={{
                                      marginTop: "0.55rem",
                                      fontSize: "0.78rem",
                                      fontWeight: 800,
                                      color: micSignalDetected ? "#7c3aed" : "#94a3b8",
                                    }}
                                  >
                                    {isMicReady
                                      ? micSignalDetected
                                        ? "마이크 입력 감지됨"
                                        : "마이크 입력 대기 중"
                                      : "마이크 입력 없음"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-center justify-self-center">
                                <div className="tetris-canvas-stage scale-[1.04] origin-center lg:scale-[1.08]">
                                  <canvas
                                    ref={canvasRef}
                                    width={COLS * BLOCK_SIZE}
                                    height={ROWS * BLOCK_SIZE}
                                    className="vt-canvas"
                                  />
                                  {actionFeedback ? (
                                    <div
                                      key={actionFeedback.id}
                                      className={`vt-action-overlay vt-action-overlay-${actionFeedback.type}`}
                                    >
                                      <strong>{actionFeedback.label}</strong>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>

                  </div>

                  {!gameStarted ? (
                    <div className="vt-pause-screen">
                      <span className="vt-pause-icon">🎙️</span>
                        <h3>단어 폭탄 훈련 화면</h3>
                      <p>
                        단계 선택 팝업에서 난이도를 고르고 훈련을 시작해 주세요.
                        <br />
                        정답을 말하면 자동 배치되고, 실패하면 X로 기록됩니다.
                      </p>
                    </div>
                  ) : null}
                  {gameResult && !gameStarted ? (
                    <GameResultModal
                      result={gameResult}
                      onHome={handleStageReturn}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
        </div>
      </section>
    </main>
  );
}
