"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WORDS_BY_LEVEL } from "@/data/tetrisWords";
import { useAudioAnalyzer } from "@/lib/audio/useAudioAnalyzer";
import { createPreferredCameraStream } from "@/lib/media/cameraPreferences";
import MonitoringPanelShell from "@/components/training/MonitoringPanelShell";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";
import LingoResultModalShell from "@/components/lingo/LingoResultModalShell";

// ─── 블록 상수 ─────────────────────────────────────────────────────────────────
const BLOCK_COLORS = [
  null,
  "#4a90d9",
  "#f2bf5a",
  "#8f88e6",
  "#ef8a86",
  "#63b97a",
  "#ef9a5a",
  "#63bfb5",
  "#94a3b8",
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
const MATCH_COOLDOWN_MS = 900;
const STT_CHUNK_MS = 700;
const STT_RESTART_DELAY_MS = 30;

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
  ctx.fillStyle = color;
  ctx.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

  ctx.fillStyle = tintColor(color, 22);
  ctx.fillRect(x, y, BLOCK_SIZE - 1, 4);

  ctx.fillStyle = tintColor(color, -18);
  ctx.fillRect(x, y + BLOCK_SIZE - 6, BLOCK_SIZE - 1, 5);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.strokeRect(x + 0.5, y + 0.5, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
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
      best = Math.max(best, score);
    });
  });

  return best;
}

function getDisplayTranscript(transcript: string) {
  return transcript
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function getPassThreshold(targetWord: string) {
  const length = normalizeText(targetWord).length;
  if (length <= 2) return 88;
  if (length <= 4) return 82;
  if (length <= 7) return 76;
  return 72;
}

function getSpeechGradeLabel(score: number, threshold: number) {
  if (score < threshold) return "Fail";
  if (score >= 98) return "Perfect";
  if (score >= Math.max(threshold + 8, 90)) return "Excellent";
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-6 backdrop-blur-md">
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[56px] border-[6px] border-white bg-white shadow-[0_32px_80px_rgba(0,0,0,0.4)] ring-1 ring-slate-200">
        <button
          type="button"
          onClick={onHome}
          className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-violet-200 hover:text-violet-600"
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
        <div className="border-b-2 border-slate-100 bg-slate-50/80 px-8 pb-8 pt-12 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[32px] bg-violet-600 text-white shadow-xl ring-4 ring-violet-50">
            <span className="text-4xl">🎙️</span>
          </div>
          <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.4em] text-violet-500">
            Voice Puzzle Protocol
          </span>
          <h3 className="text-4xl font-black tracking-tighter text-slate-900">
            훈련 단계 선택
          </h3>
        </div>

        <div className="bg-white p-8">
          <div className="mb-10 grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((lv) => (
              <button
                key={lv}
                onClick={() => onSelect(lv)}
                className={`group relative flex h-24 flex-col items-center justify-center gap-1 rounded-[32px] border-2 transition-all ${
                  selectedLevel === lv
                    ? "scale-105 border-violet-600 bg-violet-600 text-white shadow-lg"
                    : "border-slate-300 bg-slate-50 text-slate-500 hover:border-violet-300 hover:bg-white"
                }`}
              >
                <span className="text-[10px] font-black uppercase opacity-60">
                  Level
                </span>
                <strong className="text-3xl font-black">{lv}</strong>
              </button>
            ))}
          </div>

          <div className="mb-8 rounded-[32px] border border-violet-100 bg-violet-50 p-6 text-center">
            <p className="text-sm font-bold leading-relaxed text-violet-600">
              <span className="mb-1 block text-[11px] font-black tracking-widest opacity-60">
                SELECTED LEVEL PREVIEW
              </span>
              "{previewWord}" 외 9개 단어 발화 훈련
            </p>
          </div>

          <button
            onClick={onStart}
            className="flex h-20 w-full items-center justify-center gap-3 rounded-[28px] bg-slate-900 text-xl font-black text-white shadow-2xl shadow-slate-200 transition-transform active:scale-95"
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
  onRestart,
  onHome,
}: {
  result: GameResult;
  onRestart: () => void;
  onHome: () => void;
}) {
  const successRate = Math.round((result.successCount / 10) * 100);

  return (
    <LingoResultModalShell
      icon="🏆"
      badgeText="Training Complete"
      title="훈련 완료 리포트"
      subtitle="안면 신경과 언어 기능을 성공적으로 자극했습니다!"
      headerToneClass="bg-violet-50"
      iconToneClass="bg-gradient-to-br from-violet-500 to-indigo-600"
      badgeToneClass="text-violet-600"
      primaryLabel="단계 다시 선택하기"
      onPrimary={onRestart}
      secondaryLabel="메인으로 돌아가기"
      onSecondary={onHome}
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
              Avg Accuracy
            </span>
            <strong className="text-4xl font-black text-slate-900">{result.averageScore}점</strong>
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
  const router = useRouter();
  const isLocalDebug =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const {
    volume,
    start: startAudioMonitor,
    stop: stopAudioMonitor,
  } = useAudioAnalyzer();

  // Canvas / game refs (불변 refs — 렌더링에 직접 사용하지 않음)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const boardRef = useRef<Board>(makeBoard());
  const pieceRef = useRef<Piece | null>(null);
  const runningRef = useRef(false);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const levelRef = useRef(1);
  const wordsClearedRef = useRef(0);
  const wordIdxRef = useRef(0);
  const currentWordRef = useRef("");
  const recognitionCooldownRef = useRef(0);
  const failCountRef = useRef(0);
  const failStreakRef = useRef(0);
  const prevCostumeTierRef = useRef(0);
  const successStreakRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const sttChunkStopTimerRef = useRef<number | null>(null);
  const sttUploadInFlightRef = useRef(false);
  const sttSessionActiveRef = useRef(false);

  // Face-tracking / costume canvas refs
  const costumeCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const faceLoopRef = useRef<number | null>(null);
  const latestLandmarksRef = useRef<Landmark[] | null>(null);
  const faceProcessingRef = useRef(false);
  const costumeImagesRef = useRef<CostumeImages>({});

  // UI state
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [showLevelModal, setShowLevelModal] = useState(true);
  const [wordsCleared, setWordsCleared] = useState(0);
  const [currentWord, setCurrentWord] = useState("");
  const [fallProgress, setFallProgress] = useState(0);
  const [totalAccuracy, setTotalAccuracy] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [failStreak, setFailStreak] = useState(0);
  const [successStreak, setSuccessStreak] = useState(0);
  const [wordChips, setWordChips] = useState<WordChipState[]>(Array(10).fill("pending"));
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [heardText, setHeardText] = useState("");
  const [passThreshold, setPassThreshold] = useState(
    getPassThreshold(getWord(1, 0)),
  );
  const [audioBars, setAudioBars] = useState(Array(16).fill(10));
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [faceTracked, setFaceTracked] = useState(false);
  const [faceGuideScore, setFaceGuideScore] = useState(0);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [costumeUnlockToast, setCostumeUnlockToast] = useState<{
    id: number;
    icon: string;
    label: string;
  } | null>(null);
  const [pendingCostumeTier, setPendingCostumeTier] = useState<number | null>(
    null,
  );
  const handleHome = onBack ?? (() => router.push("/select-page/game-mode"));

  const setActiveWord = useCallback((word: string) => {
    currentWordRef.current = word;
    setCurrentWord(word);
    setPassThreshold(getPassThreshold(word));
    setHeardText("");
    setTotalAccuracy(0);
    recognitionCooldownRef.current = Date.now() + 450;
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
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, []);

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
    sttSessionActiveRef.current = false;
    if (sttChunkStopTimerRef.current !== null) {
      window.clearTimeout(sttChunkStopTimerRef.current);
      sttChunkStopTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        /* no-op */
      }
    }
    mediaRecorderRef.current = null;
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    stopAudioMonitor();
    stopCamera();
  }, [stopAudioMonitor, stopCamera]);

  const goToNextWord = useCallback(() => {
    wordIdxRef.current = (wordIdxRef.current + 1) % 10;
    setActiveWord(getWord(levelRef.current, wordIdxRef.current));
  }, [setActiveWord]);

  const applyDangerPenalty = useCallback(() => {
    const failedIndex = wordIdxRef.current % 10;
    const nextProgress = wordsClearedRef.current + 1;
    wordsClearedRef.current = nextProgress;
    setWordsCleared(nextProgress);
    failCountRef.current += 1;
    setFailCount(failCountRef.current);
    failStreakRef.current += 1;
    setFailStreak(failStreakRef.current);
    successStreakRef.current = 0;
    setSuccessStreak(0);
    prevCostumeTierRef.current = 0;
    setPendingCostumeTier(null);

    setWordChips((prev) => {
      const updated = [...prev];
      updated[failedIndex] = "fail";
      return updated;
    });

    setActionFeedback({
      id: Date.now(),
      type: "fail",
      label: "Fail",
    });

    if (nextProgress >= 10) {
      runningRef.current = false;
      setGameStarted(false);
      stopSessionDevices();
      setGameResult({
        clearedWords: nextProgress,
        level: levelRef.current,
        averageScore: totalAccuracy,
        successCount: nextProgress - failCountRef.current,
        failCount: failCountRef.current,
      });
      return;
    }

    boardRef.current = raiseGarbageRow(boardRef.current);
    goToNextWord();
    pieceRef.current = createPiece(levelRef.current);
    setFallProgress(0);

    setTimeout(() => {
      setActionFeedback(null);
    }, 1600);
  }, [goToNextWord, stopSessionDevices, totalAccuracy]);

  // ─── Canvas 그리기 ────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    boardRef.current.forEach((row, y) => {
      row.forEach((val, x) => {
        if (!val) return;
        drawBlockCell(
          ctx,
          x * BLOCK_SIZE,
          y * BLOCK_SIZE,
          BLOCK_COLORS[val] ?? "#94a3b8",
        );
      });
    });

    const p = pieceRef.current;
    if (p) {
      p.matrix.forEach((row, y) => {
        row.forEach((val, x) => {
          if (!val) return;
          drawBlockCell(
            ctx,
            (x + p.pos.x) * BLOCK_SIZE,
            (y + p.pos.y) * BLOCK_SIZE,
            BLOCK_COLORS[p.color] ?? "#94a3b8",
          );
        });
      });
    }
  }, []);

  // ─── 블록 낙하 ────────────────────────────────────────────────────────────
  const playerDrop = useCallback(() => {
    if (!pieceRef.current) return;
    pieceRef.current.pos.y++;
    setFallProgress(
      Math.min(100, Math.round((pieceRef.current.pos.y / (ROWS - 1)) * 100)),
    );

    if (collide(boardRef.current, pieceRef.current)) {
      pieceRef.current.pos.y--;
      applyDangerPenalty();
    }
    dropCounterRef.current = 0;
  }, [applyDangerPenalty]);

  // ─── 게임 루프 ────────────────────────────────────────────────────────────
  const gameLoop = useCallback(
    (time = 0) => {
      if (!runningRef.current) return;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;
      dropCounterRef.current += delta;
      if (dropCounterRef.current > getDropInterval(levelRef.current))
        playerDrop();
      draw();
      animRef.current = requestAnimationFrame(gameLoop);
    },
    [draw, playerDrop],
  );

  // ─── PERFECT: AI 자동 최적 배치 ──────────────────────────────────────────
  const autoPlaceAndClear = useCallback(() => {
    if (!pieceRef.current) return;
    let bestScore = -Infinity;
    let bestX = pieceRef.current.pos.x;
    let bestMatrix = pieceRef.current.matrix;
    let cur = pieceRef.current.matrix;

    for (let r = 0; r < 4; r++) {
      for (let x = -2; x < COLS; x++) {
        const sim = { pos: { x, y: 0 }, matrix: cur };
        if (collide(boardRef.current, sim)) continue;
        while (!collide(boardRef.current, sim)) sim.pos.y++;
        sim.pos.y--;

        let score = sim.pos.y * 10;
        sim.matrix.forEach((row, ry) => {
          const by = sim.pos.y + ry;
          if (by >= 0 && by < ROWS) {
            let full = true;
            for (let bx = 0; bx < COLS; bx++) {
              let val = boardRef.current[by][bx];
              if (
                bx >= sim.pos.x &&
                bx < sim.pos.x + sim.matrix[0].length &&
                sim.matrix[ry][bx - sim.pos.x]
              )
                val = 1;
              if (!val) {
                full = false;
                break;
              }
            }
            if (full) score += 1000;
          }
        });

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestMatrix = JSON.parse(JSON.stringify(cur));
        }
      }
      cur = rotatePiece(cur);
    }

    const placed = {
      pos: { x: bestX, y: 0 },
      matrix: bestMatrix,
      color: pieceRef.current.color,
    };
    while (!collide(boardRef.current, placed)) placed.pos.y++;
    placed.pos.y--;

    boardRef.current = sweepLines(mergePiece(boardRef.current, placed));
    pieceRef.current = createPiece(levelRef.current);
    if (collide(boardRef.current, pieceRef.current)) {
      boardRef.current = fillDebris(levelRef.current);
      pieceRef.current = createPiece(levelRef.current);
    }
  }, []);

  const advanceAfterMatch = useCallback(() => {
    const successIndex = wordIdxRef.current % 10;
    const next = wordsClearedRef.current + 1;
    const nextStreak = successStreakRef.current + 1;
    wordsClearedRef.current = next;
    setWordsCleared(next);
    failStreakRef.current = 0;
    setFailStreak(0);
    successStreakRef.current = nextStreak;
    setSuccessStreak(nextStreak);
    setWordChips((prev) => {
      const updated = [...prev];
      updated[successIndex] = "success";
      return updated;
    });

    if (next >= 10) {
      runningRef.current = false;
      setGameStarted(false);
      stopSessionDevices();
      setGameResult({
        clearedWords: next,
        level: levelRef.current,
        averageScore: totalAccuracy,
        successCount: next - failCountRef.current,
        failCount: failCountRef.current,
      });
      return;
    }

    goToNextWord();
  }, [goToNextWord, stopSessionDevices, totalAccuracy]);

  // ─── 발화 결과 처리 ───────────────────────────────────────────────────────
  const processResult = useCallback(
    (transcript: string) => {
      if (!runningRef.current || !currentWordRef.current) return;
      if (Date.now() < recognitionCooldownRef.current) return;

      const total = getSpeechScore(transcript, currentWordRef.current);
      const threshold = getPassThreshold(currentWordRef.current);
      const visibleThreshold = Math.max(24, threshold - 36);
      const displayTranscript = getDisplayTranscript(transcript);

      if (displayTranscript && total >= visibleThreshold) {
        setHeardText(displayTranscript);
      } else if (displayTranscript && total >= 12) {
        setHeardText(displayTranscript);
      } else if (!displayTranscript) {
        setHeardText("");
      }

      setTotalAccuracy(total);

      if (total < threshold) return;

      recognitionCooldownRef.current = Date.now() + MATCH_COOLDOWN_MS;
      setActionFeedback({
        id: Date.now(),
        type: "success",
        label: getSpeechGradeLabel(total, threshold),
      });
      autoPlaceAndClear();
      setFallProgress(0);
      advanceAfterMatch();
      setTimeout(() => {
        setActionFeedback(null);
      }, 1800);
    },
    [advanceAfterMatch, autoPlaceAndClear],
  );

  const simulateMatch = useCallback(() => {
    if (!runningRef.current || !currentWordRef.current) return;
    processResult(currentWordRef.current);
  }, [processResult]);

  const simulateStack = useCallback(() => {
    if (!runningRef.current || !pieceRef.current) return;
    recognitionCooldownRef.current = Date.now() + MATCH_COOLDOWN_MS;
    applyDangerPenalty();
  }, [applyDangerPenalty]);

  const currentCameraTierId = COSTUME_TIERS.reduce<string>(
    (best, tier, i) =>
      successStreak >= tier.minStreak ? COSTUME_TIERS[i].id : best,
    COSTUME_TIERS[0].id,
  );

  // ─── 서버 STT ──────────────────────────────────────────────────────────────
  const uploadSpeechChunk = useCallback(
    async (blob: Blob) => {
      if (
        !blob.size ||
        sttUploadInFlightRef.current ||
        !sttSessionActiveRef.current ||
        !runningRef.current
      ) {
        return;
      }

      sttUploadInFlightRef.current = true;

      try {
        const formData = new FormData();
        const normalizedAudio = new File([blob], "tetris.webm", {
          type: "audio/webm",
        });
        formData.append("audio", normalizedAudio);
        formData.append("targetText", currentWordRef.current);
        formData.append(
          "threshold",
          String(getPassThreshold(currentWordRef.current)),
        );

        const response = await fetch("/api/proxy/stt", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();

        if (!response.ok) {
          const reason = String(result?.reason || result?.error || "").trim();
          throw new Error(
            reason
              ? `서버 STT 요청에 실패했어요. (${reason})`
              : "서버 STT 요청에 실패했어요.",
          );
        }

        const transcript = String(result.text ?? "").trim();
        if (!transcript) {
          setSpeechError("");
          return;
        }

        setSpeechError("");
        processResult(transcript);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "음성 인식 서버와 연결하지 못했어요.";
        setSpeechError(message);
      } finally {
        sttUploadInFlightRef.current = false;
      }
    },
    [processResult],
  );

  const scheduleRecorderStop = useCallback(() => {
    if (sttChunkStopTimerRef.current !== null) {
      window.clearTimeout(sttChunkStopTimerRef.current);
    }
    sttChunkStopTimerRef.current = window.setTimeout(() => {
      const recorder = mediaRecorderRef.current;
      if (
        recorder &&
        recorder.state === "recording" &&
        sttSessionActiveRef.current &&
        runningRef.current
      ) {
        try {
          recorder.stop();
        } catch {
          /* no-op */
        }
      }
    }, STT_CHUNK_MS);
  }, []);

  const beginServerRecorder = useCallback(
    (stream: MediaStream) => {
      if (!sttSessionActiveRef.current || !runningRef.current) return;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (!sttSessionActiveRef.current || !runningRef.current) return;
        if (event.data && event.data.size > 0) {
          void uploadSpeechChunk(event.data);
        }
      };

      recorder.onerror = () => {
        setSpeechError("테트리스 음성 녹음 중 오류가 발생했어요.");
      };

      recorder.onstop = () => {
        mediaRecorderRef.current = null;
        if (sttChunkStopTimerRef.current !== null) {
          window.clearTimeout(sttChunkStopTimerRef.current);
          sttChunkStopTimerRef.current = null;
        }

        if (!sttSessionActiveRef.current || !runningRef.current) {
          return;
        }

        window.setTimeout(() => {
          if (
            sttSessionActiveRef.current &&
            runningRef.current &&
            recordingStreamRef.current
          ) {
            beginServerRecorder(recordingStreamRef.current);
          }
        }, STT_RESTART_DELAY_MS);
      };

      recorder.start();
      scheduleRecorderStop();
    },
    [scheduleRecorderStop, uploadSpeechChunk],
  );

  const startServerStt = useCallback(async () => {
    if (!isRecordingSupported()) {
      setSpeechError("이 브라우저는 서버 STT 녹음을 지원하지 않습니다.");
      return false;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      recordingStreamRef.current = stream;
      sttSessionActiveRef.current = true;
      setSpeechError("");
      beginServerRecorder(stream);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "마이크를 시작하지 못했어요.";
      setSpeechError(message);
      return false;
    }
  }, [beginServerRecorder]);

  // ─── 레벨 설정 ────────────────────────────────────────────────────────────
  function handleLevelSelect(lv: number) {
    setSelectedLevel(lv);
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

      cameraStreamRef.current = stream;
      setCameraReady(true);
      return true;
    } catch (error) {
      setCameraReady(false);
      setCameraError("카메라 권한이 없어서 가이드 화면은 표시되지 않습니다.");
      return false;
    }
  }, [attachCameraPreview, stopCamera]);

  // ─── 훈련 시작 / 중지 ────────────────────────────────────────────────────
  async function startGameForLevel(startLevel = selectedLevel) {
    levelRef.current = startLevel;
    setLevel(startLevel);
    setShowLevelModal(false);

    const audioMonitorReady = await startAudioMonitor();
    if (!audioMonitorReady) {
      setSpeechError("마이크 입력을 확인해 주세요.");
    }
    startCamera();
    runningRef.current = true;
    setGameStarted(true);
    wordIdxRef.current = 0;
    wordsClearedRef.current = 0;
    setWordsCleared(0);
    setWordChips(Array(10).fill("pending"));
    failCountRef.current = 0;
    setFailCount(0);
    failStreakRef.current = 0;
    setFailStreak(0);
    successStreakRef.current = 0;
    setSuccessStreak(0);
    prevCostumeTierRef.current = 0;
    setPendingCostumeTier(null);
    setCostumeUnlockToast(null);
    setGameResult(null);
    setActionFeedback(null);
    boardRef.current = fillDebris(startLevel);
    pieceRef.current = createPiece(startLevel);
    lastTimeRef.current = 0;
    dropCounterRef.current = 0;
    setActiveWord(getWord(startLevel, 0));
    setFallProgress(0);
    await startServerStt();
    animRef.current = requestAnimationFrame(gameLoop);
  }

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
      setShowLevelModal(true);
      return;
    }

    setShowLevelModal(true);
  }

  // ─── cameraReady → video 요소에 스트림 연결 ─────────────────────────────
  // cameraReady → 비디오에 스트림 연결 + FaceMesh 초기화
  // (video는 항상 DOM에 있으므로 videoRef가 null이 아님)
  useEffect(() => {
    if (!cameraReady) return;
    void attachCameraPreview();
    void initFaceTracking();
  }, [attachCameraPreview, cameraReady, initFaceTracking]);

  // ─── 초기 그리기 + 카메라 자동 연결 ──────────────────────────────────────
  useEffect(() => {
    boardRef.current = fillDebris(1);
    pieceRef.current = createPiece(1);
    setActiveWord(getWord(1, 0));
    draw();
    startCamera();
  }, [draw, setActiveWord, startCamera]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setAudioBars((prev) =>
        prev.map((_, index) => {
          const wave = 0.55 + Math.sin(Date.now() / 180 + index * 0.6) * 0.22;
          const variance = 0.75 + (index % 5) * 0.08;
          const boosted = gameStarted
            ? volume * 2.8 * wave * variance + (volume > 0 ? 10 : 0)
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
  }, [actionFeedback?.type, cameraReady, gameStarted, volume]);

  useEffect(() => {
    if (error) {
      setSpeechError(error);
    }
  }, [error]);

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

  const showStatusPanel = gameStarted || showLevelModal || Boolean(gameResult);

  // ─── 코스튬 계산 ──────────────────────────────────────────────────────────
  const successCount = successStreak;
  const currentTierIdx = COSTUME_TIERS.reduce(
    (best, tier, i) => (successCount >= tier.minStreak ? i : best),
    0,
  );
  const currentTier = COSTUME_TIERS[currentTierIdx];
  const isChampion = currentTier.id === "sparkle";

  // ─── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white flex flex-col overflow-hidden">
      <header className="min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b border-violet-100 flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <span className="font-black text-[10px] uppercase tracking-widest leading-none block text-violet-500">
              Game Training • Tetris
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              한글 테트리스
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
              setShowLevelModal(true);
            }}
          >
            단계 선택
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
          <div className="px-3 py-1.5 rounded-full font-black text-[11px] transition-all border bg-violet-50 border-violet-200 text-violet-700">
            {gameStarted
              ? totalAccuracy >= passThreshold
                ? "MATCH"
                : "LISTENING..."
              : "READY"}
          </div>
          <div className="px-4 py-1.5 rounded-full font-black text-xs border bg-violet-50 text-violet-700 border-violet-200">
            {gameStarted ? wordsCleared : 0} / 10
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

      <section className="flex-1 overflow-y-auto bg-[#f8fafc]">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="vt-layout vt-layout-playing tetris-layout-no-left">

          <section className="vt-center">
            <div className="tetris-content-layout">
              <div className="vt-board-shell tetris-board-shell">
                <div className="vt-canvas-wrap">
                  <div
                    className={`tetris-board-card-layout ${showStatusPanel ? "has-status" : ""}`}
                  >
                    <div className="tetris-game-panel">
                      {gameStarted && currentWord ? (
                        <div className="vt-word-overlay">
                          <div
                            className={`vt-word-card ${
                              actionFeedback?.type === "success"
                                ? "tetris-word-card-success"
                                : actionFeedback?.type === "fail"
                                  ? "tetris-word-card-fail"
                                  : ""
                            }`}
                          >
                            <div className="vt-word-header">
                              <span className="vt-word-label">
                                  한글 음성 퍼즐 · Level {level}
                              </span>
                              <span className="vt-word-timer">
                                낙하 {fallProgress}%
                              </span>
                            </div>
                            <h2 className="vt-word-text">{currentWord}</h2>
                            <div className="vt-timer-track">
                              <div
                                className="vt-timer-fill"
                                style={{ width: `${fallProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="tetris-canvas-stage">
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

                      <div
                        style={{
                          marginTop: "0.9rem",
                          textAlign: "center",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          color: "#64748b",
                          minHeight: "1.5rem",
                        }}
                      >
                        {heardText ? (
                          <>
                            <span style={{ color: "#94a3b8", marginRight: "0.45rem" }}>
                              인식:
                            </span>
                            <span>{heardText}</span>
                          </>
                        ) : gameStarted ? (
                          "말한 단어가 여기 표시됩니다."
                        ) : null}
                      </div>
                    </div>

                    {showStatusPanel ? (
                      <aside className="tetris-status-panel">
                        <MonitoringPanelShell
                          title="실시간 상태판"
                          className="tetris-report-card-compact"
                          bodyClassName="tetris-status-columns"
                        >
                            <div className="vt-monitor-card tetris-monitor-inline">
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

                                <div className="vt-camera-status">
                                  <div className="vt-camera-row">
                                    <span>안면 상태</span>
                                    <strong>
                                      {cameraReady
                                        ? faceTracked
                                          ? "인식 중"
                                          : "준비"
                                        : "대기"}
                                    </strong>
                                  </div>
                                  <div className="vt-face-track">
                                    <div
                                      className="vt-face-fill"
                                      style={{
                                        width: `${cameraReady ? (faceTracked ? 100 : 54) : 28}%`,
                                      }}
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

                              <div className="tetris-status-card tetris-accuracy-card">
                                <span className="tetris-accuracy-label">음성 정확도</span>
                                <strong className="tetris-accuracy-value">
                                  {gameStarted ? totalAccuracy : 0}
                                  <em>점</em>
                                </strong>
                              </div>

                              {speechError ? (
                                <div className="tetris-status-card">
                                  <span className="tetris-accuracy-label">음성 상태</span>
                                  <strong
                                    className="tetris-accuracy-value"
                                    style={{
                                      fontSize: "0.95rem",
                                      lineHeight: 1.5,
                                      textAlign: "left",
                                    }}
                                  >
                                    {speechError}
                                  </strong>
                                </div>
                              ) : null}

                              <div className="vt-progress-block tetris-status-card">
                                <div className="vt-chips-label">문제 흐름</div>
                                <div className="vt-chips-row">
                                  {wordChips.map((cleared, i) => (
                                    <div
                                      key={i}
                                      className={`vt-chip ${cleared === "success" ? "vt-chip-done" : ""} ${cleared === "fail" ? "vt-chip-fail" : ""}`}
                                    >
                                      {cleared === "success"
                                        ? "✓"
                                        : cleared === "fail"
                                          ? "X"
                                          : i + 1}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                        </MonitoringPanelShell>
                      </aside>
                    ) : null}
                  </div>

                  {!gameStarted ? (
                    <div className="vt-pause-screen">
                      <span className="vt-pause-icon">🎙️</span>
                        <h3>한글 테트리스 훈련 화면</h3>
                      <p>
                        단계 선택 팝업에서 난이도를 고르고 훈련을 시작해 주세요.
                        <br />
                        정답을 말하면 자동 배치되고, 실패하면 X로 기록됩니다.
                      </p>
                    </div>
                  ) : null}
                  {showLevelModal && !gameStarted ? (
                    <LevelSelectionModal
                      selectedLevel={selectedLevel}
                      onSelect={handleLevelSelect}
                      onStart={() => void startGameForLevel()}
                      onHome={handleHome}
                    />
                  ) : null}
                  {gameResult && !gameStarted ? (
                    <GameResultModal
                      result={gameResult}
                      onRestart={() => {
                        setGameResult(null);
                        setShowLevelModal(true);
                      }}
                      onHome={handleHome}
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
