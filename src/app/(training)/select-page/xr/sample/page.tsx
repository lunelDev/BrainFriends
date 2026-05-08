"use client";

// /(training)/select-page/xr/sample/page.tsx
//
// XR 샘플 환경 (R&D Preview, Pokemon-Go 스타일 어휘 캐치 게임).
//
// 컨셉:
//   - 라이브 카메라(=AR pass-through) 위에 어휘 "크리처" 가 실시간으로 등장한다.
//   - 사용자는 화면을 탭/클릭해 크리처를 잡고, 그게 곧 "사물 이름대기" 훈련 1회로
//     매핑된다 (이 페이지는 R&D 프리뷰라 임상 데이터로는 저장하지 않음).
//   - 시나리오(scene) 별로 어휘 풀이 달라지고, 다 잡으면 스테이지 완료.
//
// 정책:
//   - 측정값/캐치 결과는 DB 저장 안 함. 본 페이지는 정식 SaMD 스코프 외.
//   - 카메라 권한 거부 시에도 게임은 동작 (배경이 그라디언트로 fallback).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Glasses,
  Hand,
  RotateCcw,
  ShieldAlert,
  Target,
  Trophy,
  Video,
  VideoOff,
  Zap,
} from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import {
  createPreferredCameraStream,
  loadPreferredCameraId,
} from "@/lib/media/cameraPreferences";
import {
  registerMediaStream,
  unregisterMediaStream,
} from "@/lib/client/mediaStreamRegistry";

type SceneKey = "park-walk" | "cafe-order" | "aac-floating" | "gaze-mirror";

type CreatureDef = {
  id: string;
  label: string;
  emoji: string;
  /** 캡처 시 표시할 짧은 카피. 없으면 label 사용. */
  caption?: string;
};

type SceneConfig = {
  key: SceneKey;
  title: string;
  subtitle: string;
  ambient: string;
  spawnPool: CreatureDef[];
};

type SpawnedCreature = CreatureDef & {
  /** 화면 좌표(%) — 카메라 화면 기준. 0~100. */
  xPct: number;
  yPct: number;
  /** 0.7~1.2 범위로 약간씩 다르게 — 거리감. */
  scale: number;
  /** entry 애니 시작 시각 (perf.now). */
  bornAt: number;
  /** 잡혔는지 (잡힌 직후 burst → 제거). */
  caught: boolean;
};

type CameraState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "active"; stream: MediaStream }
  | { status: "denied"; reason: string }
  | { status: "error"; reason: string };

const SCENES: Record<SceneKey, SceneConfig> = {
  "park-walk": {
    key: "park-walk",
    title: "공원 사파리",
    subtitle: "공원에서 만나는 사물 어휘를 잡아보세요",
    ambient: "from-emerald-500/35 via-emerald-700/20 to-slate-900/65",
    spawnPool: [
      { id: "tree", label: "나무", emoji: "🌳" },
      { id: "bench", label: "벤치", emoji: "🪑" },
      { id: "dog", label: "강아지", emoji: "🐕" },
      { id: "bird", label: "새", emoji: "🐦" },
      { id: "flower", label: "꽃", emoji: "🌸" },
      { id: "kite", label: "연", emoji: "🪁" },
    ],
  },
  "cafe-order": {
    key: "cafe-order",
    title: "카페 주문 캐치",
    subtitle: "메뉴 아이템을 잡아 주문 문장을 완성",
    ambient: "from-amber-500/35 via-orange-600/20 to-slate-900/65",
    spawnPool: [
      { id: "americano", label: "아메리카노", emoji: "☕" },
      { id: "latte", label: "라떼", emoji: "🥛" },
      { id: "cake", label: "케이크", emoji: "🍰" },
      { id: "ice", label: "얼음", emoji: "🧊" },
      { id: "straw", label: "빨대", emoji: "🥤" },
      { id: "card", label: "카드", emoji: "💳" },
    ],
  },
  "aac-floating": {
    key: "aac-floating",
    title: "AAC 의도 헌트",
    subtitle: "공간에 떠있는 의도 어휘를 잡아 문장을 만드세요",
    ambient: "from-violet-500/35 via-indigo-700/25 to-slate-900/65",
    spawnPool: [
      { id: "i", label: "나는", emoji: "🙋" },
      { id: "want", label: "원해요", emoji: "✨" },
      { id: "water", label: "물", emoji: "💧" },
      { id: "rest", label: "쉬고싶어요", emoji: "😴" },
      { id: "yes", label: "네", emoji: "👍" },
      { id: "help", label: "도와주세요", emoji: "🆘" },
    ],
  },
  "gaze-mirror": {
    key: "gaze-mirror",
    title: "안면 미러 챌린지",
    subtitle: "좌우 표적을 시선으로 따라가며 잡아보세요",
    ambient: "from-sky-500/35 via-indigo-700/25 to-slate-900/65",
    spawnPool: [
      { id: "left", label: "좌측", emoji: "⬅️" },
      { id: "right", label: "우측", emoji: "➡️" },
      { id: "up", label: "위", emoji: "⬆️" },
      { id: "down", label: "아래", emoji: "⬇️" },
      { id: "center", label: "중앙", emoji: "🎯" },
    ],
  },
};

// MediaPipe 21-keypoint 손 토폴로지. (from, to) index pair.
// 손바닥 + 5개 손가락 마디를 잇는 표준 연결.
const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // 엄지
  [0, 1], [1, 2], [2, 3], [3, 4],
  // 검지
  [0, 5], [5, 6], [6, 7], [7, 8],
  // 중지
  [9, 10], [10, 11], [11, 12],
  // 약지
  [13, 14], [14, 15], [15, 16],
  // 새끼
  [0, 17], [17, 18], [18, 19], [19, 20],
  // 손바닥 가로 다리
  [5, 9], [9, 13], [13, 17],
];

// 스폰 동시 개수, 최대 대기 풀, 자동 리스폰 간격 등 게임 파라미터.
const MAX_ACTIVE_SPAWN = 3;
const RESPAWN_INTERVAL_MS = 2200;
const CREATURE_LIFETIME_MS = 9000; // 안 잡으면 도망 (페이드 아웃)

let creatureSeq = 0;

export default function XrSamplePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { patient, isLoading } = useTrainingSession();

  const sceneKey = (params.get("scene") as SceneKey) ?? "park-walk";
  const scene = useMemo<SceneConfig>(
    () => SCENES[sceneKey] ?? SCENES["park-walk"],
    [sceneKey],
  );

  // 카메라
  const [camera, setCamera] = useState<CameraState>({ status: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);

  // 게임 상태
  const [spawned, setSpawned] = useState<SpawnedCreature[]>([]);
  const [caughtIds, setCaughtIds] = useState<Set<string>>(new Set());
  const [lastCatch, setLastCatch] = useState<{
    label: string;
    emoji: string;
    at: number;
  } | null>(null);
  const [comboCount, setComboCount] = useState(0);
  const lastCatchAtRef = useRef(0);

  // 3D 모델 (bugatti.obj) — 스테이지 중앙에 회전하며 떠있는 AR 오브젝트.
  const modelContainerRef = useRef<HTMLDivElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  // 손 추적 (MediaPipe HandLandmarker).
  // - 검지손가락 끝(landmark 8) 위치를 normalized 0~1 로 받아 스테이지 좌표로 변환.
  // - 카메라가 셀카 미러(scaleX(-1)) 라 화면 좌표는 (1 - tip.x) 로 뒤집어야 한다.
  // - 어휘 크리처 60px 안에 600ms 머물면 자동 캐치(hover-dwell).
  const stageRef = useRef<HTMLElement | null>(null);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spawnedRef = useRef<SpawnedCreature[]>([]);
  const handPosRef = useRef<{ x: number; y: number } | null>(null);
  const [handDisplay, setHandDisplay] = useState<{ x: number; y: number } | null>(null);
  const [handStatus, setHandStatus] = useState<
    "idle" | "loading" | "tracking" | "no-hand" | "error"
  >("idle");
  const [handError, setHandError] = useState<string | null>(null);
  const [hoveredCreatureKey, setHoveredCreatureKey] = useState<string | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0); // 0~1
  const dwellRef = useRef<{ key: string; startedAt: number } | null>(null);

  // spawnedRef 동기화 — animation loop 안에서 항상 최신 spawned 를 읽도록.
  useEffect(() => {
    spawnedRef.current = spawned;
  }, [spawned]);

  // ※ WebXR(HMD/VR 헤드셋) 의존성 제거 — 본 페이지는 카메라 기반 AR 모드만 사용.

  useEffect(() => {
    if (!isLoading && !patient) router.replace("/");
  }, [isLoading, patient, router]);

  // 카메라 자동 권한 요청.
  useEffect(() => {
    let cancelled = false;
    let acquired: MediaStream | null = null;

    const requestCamera = async () => {
      setCamera({ status: "requesting" });
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices) {
          throw new Error("이 브라우저는 카메라를 지원하지 않습니다.");
        }
        const preferred = loadPreferredCameraId();
        const stream = await createPreferredCameraStream(preferred);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        acquired = stream;
        registerMediaStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play().catch(() => undefined);
        }
        setCamera({ status: "active", stream });
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException | Error;
        const name = (e as DOMException).name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCamera({
            status: "denied",
            reason:
              "카메라 권한이 거부되었습니다. 주소창의 카메라 아이콘에서 허용으로 변경 후 새로고침하세요.",
          });
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setCamera({
            status: "error",
            reason: "사용 가능한 카메라 장치를 찾을 수 없습니다.",
          });
        } else {
          setCamera({ status: "error", reason: e.message || "카메라 시작 실패" });
        }
      }
    };

    void requestCamera();

    return () => {
      cancelled = true;
      if (acquired) {
        acquired.getTracks().forEach((t) => t.stop());
        unregisterMediaStream(acquired);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const restartCamera = async () => {
    setCamera({ status: "requesting" });
    try {
      const preferred = loadPreferredCameraId();
      const stream = await createPreferredCameraStream(preferred);
      registerMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamera({ status: "active", stream });
    } catch (err) {
      const e = err as Error;
      setCamera({ status: "error", reason: e.message || "재시도 실패" });
    }
  };

  // ─────────────────────────────────────────────
  // 스폰 루프
  // ─────────────────────────────────────────────
  // 시나리오 풀에서 아직 안 잡힌 어휘를 골라 랜덤 좌표로 스폰.
  // active 가 MAX 미만이면 RESPAWN_INTERVAL_MS 마다 1마리 추가.
  const trySpawnOne = useCallback(() => {
    setSpawned((current) => {
      if (current.filter((c) => !c.caught).length >= MAX_ACTIVE_SPAWN) {
        return current;
      }
      const candidates = scene.spawnPool.filter(
        (def) =>
          !caughtIds.has(def.id) &&
          !current.some((c) => c.id === def.id && !c.caught),
      );
      if (!candidates.length) return current;
      const def = candidates[Math.floor(Math.random() * candidates.length)];
      const next: SpawnedCreature = {
        ...def,
        // 화면 가장자리 너무 붙으면 잡기 힘드니 12~88% 안에서 스폰.
        xPct: 14 + Math.random() * 72,
        yPct: 18 + Math.random() * 60,
        scale: 0.85 + Math.random() * 0.4,
        bornAt: performance.now(),
        caught: false,
      };
      // 동일 id 중복 방지를 위해 internal seq 를 key 로 추가 가능하지만,
      // 잡히면 즉시 제거되므로 id 충돌 위험은 낮다. seq 만 증가시켜 두자.
      creatureSeq += 1;
      return [...current, next];
    });
  }, [caughtIds, scene.spawnPool]);

  // 자동 리스폰
  useEffect(() => {
    const t = window.setInterval(trySpawnOne, RESPAWN_INTERVAL_MS);
    // 처음 한 마리는 빠르게.
    const initial = window.setTimeout(trySpawnOne, 400);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(initial);
    };
  }, [trySpawnOne]);

  // lifetime 만료 (안 잡으면 도망)
  useEffect(() => {
    const t = window.setInterval(() => {
      setSpawned((current) => {
        const now = performance.now();
        return current.filter(
          (c) => c.caught || now - c.bornAt < CREATURE_LIFETIME_MS,
        );
      });
    }, 600);
    return () => window.clearInterval(t);
  }, []);

  const onCatch = (creature: SpawnedCreature) => {
    if (creature.caught) return;
    const now = performance.now();
    // 콤보: 직전 캐치로부터 2.5초 안에 잡으면 카운트 증가.
    if (now - lastCatchAtRef.current < 2500) {
      setComboCount((c) => c + 1);
    } else {
      setComboCount(1);
    }
    lastCatchAtRef.current = now;
    setLastCatch({ label: creature.label, emoji: creature.emoji, at: now });
    setCaughtIds((set) => {
      const next = new Set(set);
      next.add(creature.id);
      return next;
    });
    // burst 애니 후 제거
    setSpawned((current) =>
      current.map((c) =>
        c === creature ? { ...c, caught: true } : c,
      ),
    );
    window.setTimeout(() => {
      setSpawned((current) => current.filter((c) => c !== creature));
    }, 600);
  };

  const resetStage = () => {
    setSpawned([]);
    setCaughtIds(new Set());
    setComboCount(0);
    setLastCatch(null);
    lastCatchAtRef.current = 0;
  };

  // onCatch 를 ref 로 mirror — animation loop 안에서 항상 최신 closure 호출.
  const onCatchRef = useRef(onCatch);
  useEffect(() => {
    onCatchRef.current = onCatch;
  });

  // ─────────────────────────────────────────────
  // 손 추적 (MediaPipe HandLandmarker)
  // ─────────────────────────────────────────────
  // 검지손가락 끝 좌표 → 어휘 크리처 hover → 600ms 머물면 캐치.
  // WASM 은 로컬(/mediapipe/wasm), 모델은 Google 공식 CDN 사용.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let lastDisplayUpdate = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let landmarker: any = null;

    const init = async () => {
      // 단계별 진단 — 어느 단계에서 실패했는지 화면에 노출.
      const stages = {
        IMPORT: "@mediapipe/tasks-vision import",
        WASM: "WASM (/mediapipe/wasm) 로드",
        MODEL: "HandLandmarker 모델 로드",
      };
      let stage: keyof typeof stages = "IMPORT";

      const MODEL_URLS = [
        // 로컬 첫 시도 — 있으면 CDN/네트워크 의존 없이 즉시 동작.
        "/mediapipe/models/hand_landmarker.task",
        // CDN fallback (3가지 경로 변형 — Google이 가끔 바꿈).
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
        "https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/hand_landmarker.task",
      ];

      try {
        setHandStatus("loading");
        setHandError(null);

        stage = "IMPORT";
        const mp = await import("@mediapipe/tasks-vision");
        if (cancelled) return;
        const { HandLandmarker, FilesetResolver } = mp;
        if (!HandLandmarker || !FilesetResolver) {
          throw new Error("@mediapipe/tasks-vision 에 HandLandmarker/FilesetResolver export 없음");
        }

        stage = "WASM";
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;

        stage = "MODEL";
        // GPU → CPU, 모델 URL 3개 순차 시도. 하나라도 성공하면 break.
        let lastErr: Error | null = null;
        outer: for (const delegate of ["GPU", "CPU"] as const) {
          for (const modelUrl of MODEL_URLS) {
            try {
              landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                  modelAssetPath: modelUrl,
                  delegate,
                },
                runningMode: "VIDEO",
                numHands: 1,
              });
              if (cancelled) {
                landmarker?.close?.();
                return;
              }
              // 성공
              console.info(
                `[XR] HandLandmarker 초기화 성공 — delegate=${delegate}, model=${modelUrl}`,
              );
              lastErr = null;
              break outer;
            } catch (err) {
              lastErr = err as Error;
              console.warn(
                `[XR] HandLandmarker 시도 실패 — delegate=${delegate}, model=${modelUrl}:`,
                err,
              );
            }
          }
        }
        if (!landmarker) {
          throw lastErr ?? new Error("모든 모델 URL/delegate 조합 실패");
        }
        if (cancelled) return;

        const DWELL_MS = 600;
        const HOVER_RADIUS_PX = 70;

        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          const stage = stageRef.current;
          const canvas = handCanvasRef.current;

          // 캔버스 사이즈 동기화 (스테이지 픽셀과 일치하도록).
          if (canvas && stage) {
            const rect = stage.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const targetW = Math.round(rect.width * dpr);
            const targetH = Math.round(rect.height * dpr);
            if (canvas.width !== targetW) canvas.width = targetW;
            if (canvas.height !== targetH) canvas.height = targetH;
          }
          const ctx = canvas?.getContext("2d");
          if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (
            v &&
            v.readyState >= 2 &&
            stage &&
            landmarker
          ) {
            try {
              const result = landmarker.detectForVideo(v, performance.now());
              const hand = result?.landmarks?.[0];

              // 손 스켈레톤 그리기 — 미러링 적용 (X 뒤집기).
              if (hand && ctx && canvas) {
                const W = canvas.width;
                const H = canvas.height;
                // 연결선
                ctx.strokeStyle = "rgba(96, 165, 250, 0.95)";
                ctx.lineWidth = Math.max(2, W / 320);
                ctx.lineCap = "round";
                ctx.shadowColor = "rgba(96, 165, 250, 0.7)";
                ctx.shadowBlur = 8;
                for (const [a, b] of HAND_CONNECTIONS) {
                  const pa = hand[a];
                  const pb = hand[b];
                  if (!pa || !pb) continue;
                  ctx.beginPath();
                  ctx.moveTo((1 - pa.x) * W, pa.y * H);
                  ctx.lineTo((1 - pb.x) * W, pb.y * H);
                  ctx.stroke();
                }
                // 랜드마크 점 21개
                ctx.shadowBlur = 6;
                for (let i = 0; i < hand.length; i++) {
                  const p = hand[i];
                  if (!p) continue;
                  // 손가락 끝(4,8,12,16,20) 은 강조, 그 외는 흰 점.
                  const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
                  ctx.fillStyle = isTip ? "#34d399" : "#ffffff";
                  ctx.beginPath();
                  const r = Math.max(3, W / (isTip ? 140 : 220));
                  ctx.arc((1 - p.x) * W, p.y * H, r, 0, Math.PI * 2);
                  ctx.fill();
                }
                ctx.shadowBlur = 0;
              }

              if (hand && hand[8]) {
                const tip = hand[8];
                // 카메라 미러링 보정: 화면 좌표에서 X 뒤집기.
                const nx = 1 - tip.x;
                const ny = tip.y;
                handPosRef.current = { x: nx, y: ny };
                setHandStatus("tracking");

                // 캐치 후보 검색 (스테이지 좌표 기준).
                const rect = stage.getBoundingClientRect();
                const handStageX = nx * rect.width;
                const handStageY = ny * rect.height;

                let hovered: SpawnedCreature | null = null;
                for (const c of spawnedRef.current) {
                  if (c.caught) continue;
                  const cx = (c.xPct / 100) * rect.width;
                  const cy = (c.yPct / 100) * rect.height;
                  const dx = handStageX - cx;
                  const dy = handStageY - cy;
                  if (Math.hypot(dx, dy) < HOVER_RADIUS_PX) {
                    hovered = c;
                    break;
                  }
                }

                const now = performance.now();
                if (hovered) {
                  const key = `${hovered.id}-${hovered.bornAt}`;
                  if (dwellRef.current?.key === key) {
                    const elapsed = now - dwellRef.current.startedAt;
                    const progress = Math.min(1, elapsed / DWELL_MS);
                    setDwellProgress(progress);
                    setHoveredCreatureKey(key);
                    if (elapsed >= DWELL_MS) {
                      // 캐치!
                      onCatchRef.current(hovered);
                      dwellRef.current = null;
                      setDwellProgress(0);
                      setHoveredCreatureKey(null);
                    }
                  } else {
                    dwellRef.current = { key, startedAt: now };
                    setHoveredCreatureKey(key);
                    setDwellProgress(0);
                  }
                } else {
                  if (dwellRef.current) {
                    dwellRef.current = null;
                    setHoveredCreatureKey(null);
                    setDwellProgress(0);
                  }
                }
              } else {
                handPosRef.current = null;
                setHandStatus("no-hand");
                if (dwellRef.current) {
                  dwellRef.current = null;
                  setHoveredCreatureKey(null);
                  setDwellProgress(0);
                }
              }
            } catch {
              /* 감지 실패 한 프레임 — 다음 프레임 시도 */
            }
          }

          // 디스플레이 업데이트 throttle (~30fps) — 매 프레임 setState 방지.
          const now = performance.now();
          if (now - lastDisplayUpdate > 33) {
            setHandDisplay(handPosRef.current);
            lastDisplayUpdate = now;
          }

          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        if (cancelled) return;
        const e = err as Error;
        const detail = `[${stage}] ${stages[stage]} 실패: ${e?.message ?? String(err)}`;
        console.warn("HandLandmarker init failed:", detail, err);
        setHandError(detail);
        setHandStatus("error");
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (landmarker) {
        try {
          landmarker.close();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  // ─────────────────────────────────────────────
  // bugatti.obj 3D 모델 — three.js + OBJLoader CDN 동적 로드.
  // 스테이지 중앙에 카메라 배경 위로 떠있는 회전 오브젝트.
  // ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onResize: (() => void) | null = null;

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (typeof document === "undefined") return reject(new Error("no document"));
        const existing = document.querySelector<HTMLScriptElement>(
          `script[data-xr-cdn="${src}"]`,
        );
        if (existing) {
          if (existing.dataset.loaded === "true") return resolve();
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("load fail")), {
            once: true,
          });
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.dataset.xrCdn = src;
        s.addEventListener("load", () => {
          s.dataset.loaded = "true";
          resolve();
        });
        s.addEventListener("error", () => reject(new Error("load fail")));
        document.head.appendChild(s);
      });

    const init = async () => {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js");
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const THREE = (window as any).THREE;
        if (!THREE || !THREE.OBJLoader) return;

        const container = modelContainerRef.current;
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene = new THREE.Scene();
        const camera3d = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
        camera3d.position.set(0, 1.0, 6);

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // 조명 — AR 분위기에 맞게 보라/파랑 림 라이트.
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.0);
        key.position.set(5, 8, 5);
        scene.add(key);
        const rimViolet = new THREE.DirectionalLight(0xa78bfa, 0.7);
        rimViolet.position.set(-6, 3, -4);
        scene.add(rimViolet);
        const rimSky = new THREE.DirectionalLight(0x60a5fa, 0.5);
        rimSky.position.set(4, -2, -6);
        scene.add(rimSky);

        const loader = new THREE.OBJLoader();
        loader.load(
          "/models/bugatti.obj",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj: any) => {
            if (cancelled) return;
            // 순서: scale → position. position.sub(center) 후 scale 하면 어긋남.
            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const s = 3 / maxDim;
            obj.scale.setScalar(s);
            obj.position.set(-center.x * s, -center.y * s, -center.z * s);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            obj.traverse((child: any) => {
              if (child.isMesh) {
                const hasMaterial =
                  child.material &&
                  !(Array.isArray(child.material) && child.material.length === 0);
                if (!hasMaterial || child.material?.isMeshBasicMaterial) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0x9aa6d6,
                    metalness: 0.65,
                    roughness: 0.32,
                  });
                }
              }
            });
            scene.add(obj);
            setModelLoaded(true);

            const animate = () => {
              if (cancelled) return;
              obj.rotation.y += 0.006;
              obj.position.y = Math.sin(performance.now() * 0.001) * 0.15;
              renderer.render(scene, camera3d);
              raf = requestAnimationFrame(animate);
            };
            animate();
          },
          undefined,
          () => {
            // 모델 로드 실패해도 게임은 그대로 동작.
          },
        );

        onResize = () => {
          if (!container || !renderer) return;
          const newW = container.clientWidth;
          const newH = container.clientHeight;
          if (newW <= 0 || newH <= 0) return;
          camera3d.aspect = newW / newH;
          camera3d.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        };
        window.addEventListener("resize", onResize);
      } catch {
        /* CDN 차단 등 — 게임은 그대로 동작 */
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener("resize", onResize);
      if (renderer) {
        try {
          renderer.dispose();
        } catch {
          /* noop */
        }
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  const cameraActive = camera.status === "active";
  const totalCount = scene.spawnPool.length;
  const caughtCount = caughtIds.size;
  const stageCleared = caughtCount >= totalCount;

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_30%_-10%,#7c3aed30,transparent_55%),linear-gradient(180deg,#06091c_0%,#0c1130_55%,#06091c_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06091c]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push("/select-page/xr")}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/5 transition hover:bg-white/10"
              aria-label="XR 컨셉으로 돌아가기"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">
                XR Hunt · {scene.key}
              </p>
              <h1 className="mt-1 truncate text-lg font-black tracking-tight sm:text-xl">
                {scene.title}
              </h1>
              <p className="text-xs font-medium text-violet-200/75">
                {scene.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetStage}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white transition hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 초기화
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        {/* HUD 상단 */}
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-violet-100/90">
          <CameraStatusBadge state={camera} onRetry={restartCamera} />
          <HandStatusBadge status={handStatus} error={handError} />
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
            <Trophy className="h-3.5 w-3.5" /> 잡은 어휘 {caughtCount} / {totalCount}
          </span>
          {comboCount > 1 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
              <Zap className="h-3.5 w-3.5" /> {comboCount} COMBO
            </span>
          ) : null}
        </section>

        {/* 게임 스테이지 — flex-col 안에서 shrink 안 되도록 min-h + shrink-0 */}
        <section
          ref={stageRef}
          className={`relative min-h-[600px] shrink-0 overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-b ${scene.ambient} shadow-[0_30px_80px_-30px_rgba(124,58,237,0.55)]`}
          style={{ height: "min(70vh, 720px)" }}
        >
          {/* 배경 비디오 (셀카 미러) */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              cameraActive ? "opacity-95" : "opacity-0"
            }`}
            style={{ transform: "scaleX(-1)" }}
          />
          {/* 카메라 비활성 안내 */}
          {!cameraActive ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-3xl border border-white/15 bg-black/40 px-6 py-5 text-center backdrop-blur">
                {camera.status === "requesting" ? (
                  <>
                    <Camera className="mx-auto h-6 w-6 animate-pulse text-violet-300" />
                    <p className="mt-3 text-sm font-black text-violet-100">
                      카메라 권한을 요청 중입니다...
                    </p>
                  </>
                ) : camera.status === "denied" ? (
                  <>
                    <VideoOff className="mx-auto h-6 w-6 text-rose-300" />
                    <p className="mt-3 text-sm font-black text-rose-200">
                      카메라 권한이 차단되었습니다.
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-rose-100/80">
                      {camera.reason}
                    </p>
                    <button
                      onClick={restartCamera}
                      className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-xs font-black text-white"
                    >
                      다시 시도
                    </button>
                  </>
                ) : camera.status === "error" ? (
                  <>
                    <VideoOff className="mx-auto h-6 w-6 text-amber-300" />
                    <p className="mt-3 text-sm font-black text-amber-200">
                      카메라를 시작하지 못했습니다.
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-amber-100/80">
                      {camera.reason}
                    </p>
                    <button
                      onClick={restartCamera}
                      className="mt-3 rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-slate-900"
                    >
                      다시 시도
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* AR 비네팅 */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(6,9,28,0.65)_88%)]" />

          {/* 3D 모델 (bugatti.obj) — 카메라 배경 위, 크리처/레티클 아래에 위치 */}
          <div
            ref={modelContainerRef}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
          {/* 모델 로딩 중 안내 (작게) */}
          {!modelLoaded ? (
            <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200 backdrop-blur">
              3D 모델 로드 중...
            </div>
          ) : (
            <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200 backdrop-blur">
              BUGATTI · OBJ
            </div>
          )}

          {/* 손 스켈레톤 캔버스 — 21 랜드마크 + 연결선 */}
          <canvas
            ref={handCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />

          {/* 중앙 레이더/타깃 레티클 */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 rounded-full border-2 border-white/40" />
              <div className="absolute inset-2 rounded-full border border-white/25" />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.9)]" />
            </div>
          </div>

          {/* 스폰된 크리처 — 클릭은 fallback, 기본 캐치는 손 hover-dwell */}
          {spawned.map((c, idx) => {
            const key = `${c.id}-${c.bornAt}`;
            const isHovered = hoveredCreatureKey === key;
            const ringProgress = isHovered ? dwellProgress : 0;
            return (
              <button
                key={`${key}-${idx}`}
                type="button"
                onClick={() => onCatch(c)}
                disabled={c.caught}
                className={`xr-creature pointer-events-auto absolute select-none ${
                  c.caught ? "xr-creature-caught" : ""
                } ${isHovered ? "xr-creature-hovered" : ""}`}
                style={{
                  left: `${c.xPct}%`,
                  top: `${c.yPct}%`,
                  transform: `translate(-50%, -50%) scale(${c.scale})`,
                }}
                aria-label={`${c.label} 잡기`}
              >
                <div className="xr-creature-glow" />
                <div className="xr-creature-card">
                  <span className="xr-creature-emoji">{c.emoji}</span>
                  <span className="xr-creature-label">{c.label}</span>
                </div>
                {/* 드웰 진행률 SVG 링 — 손이 머무는 동안 한 바퀴 채워짐 */}
                {isHovered && !c.caught ? (
                  <svg
                    className="xr-dwell-ring pointer-events-none absolute inset-0"
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 46}`}
                      strokeDashoffset={`${2 * Math.PI * 46 * (1 - ringProgress)}`}
                      transform="rotate(-90 50 50)"
                      style={{ transition: "stroke-dashoffset 0.05s linear" }}
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}

          {/* 손 커서 — 검지손가락 끝 위치에 십자형 인디케이터 */}
          {handDisplay ? (
            <div
              className="xr-hand-cursor pointer-events-none absolute"
              style={{
                left: `${handDisplay.x * 100}%`,
                top: `${handDisplay.y * 100}%`,
              }}
              aria-hidden="true"
            >
              <div className="xr-hand-ring" />
              <div className="xr-hand-dot" />
            </div>
          ) : null}

          {/* 캐치 토스트 */}
          {lastCatch && performance.now() - lastCatch.at < 1400 ? (
            <div
              key={lastCatch.at}
              className="xr-catch-toast pointer-events-none absolute left-1/2 top-12 -translate-x-1/2"
            >
              <span className="text-2xl">{lastCatch.emoji}</span>
              <span className="ml-2 text-base font-black tracking-tight">
                {lastCatch.label} 잡았다!
              </span>
            </div>
          ) : null}

          {/* 스테이지 클리어 오버레이 */}
          {stageCleared ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="rounded-3xl border border-emerald-300/40 bg-emerald-500/10 px-8 py-6 text-center">
                <Trophy className="mx-auto h-8 w-8 text-emerald-300" />
                <h3 className="mt-3 text-2xl font-black tracking-tight text-emerald-100">
                  스테이지 완료!
                </h3>
                <p className="mt-1 text-sm font-medium text-emerald-200/85">
                  {scene.title} 의 모든 어휘를 잡았어요. ({totalCount} 종)
                </p>
                <button
                  onClick={resetStage}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-black text-slate-900 transition hover:bg-emerald-400"
                >
                  <RotateCcw className="h-4 w-4" /> 다시 도전
                </button>
              </div>
            </div>
          ) : null}

          {/* 하단 HUD */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/45 px-4 py-3 text-xs font-medium text-violet-100/90 backdrop-blur">
            <span className="inline-flex items-center gap-2">
              <Hand className="h-3.5 w-3.5" />
              손을 카메라에 비추고 검지로 어휘 위에 0.6초 머무세요. 안 잡으면 9초 뒤 사라집니다.
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-violet-300">
              {cameraActive ? "AR HUNT" : "PREVIEW"}
            </span>
          </div>
        </section>

        {/* 어휘 풀 표시 */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
                Catch Pool
              </p>
              <h3 className="mt-2 text-base font-black tracking-tight">
                이 스테이지의 어휘 ({caughtCount}/{totalCount})
              </h3>
            </div>
            <div className="text-xs font-medium text-violet-200/80">
              <Glasses className="inline h-3.5 w-3.5" /> 시선·발화로 캐치 (정식 빌드)
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {scene.spawnPool.map((def) => {
              const got = caughtIds.has(def.id);
              return (
                <span
                  key={def.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black tracking-tight transition ${
                    got
                      ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                      : "border-white/15 bg-white/5 text-violet-200/85"
                  }`}
                >
                  <span>{def.emoji}</span>
                  <span>{def.label}</span>
                  {got ? <span className="ml-0.5 text-[10px]">✓</span> : null}
                </span>
              );
            })}
          </div>
        </section>

        {/* 면책 */}
        <section className="rounded-3xl border border-amber-300/30 bg-amber-400/5 p-5 text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
            <div className="text-sm leading-6">
              <p className="font-black text-amber-200">XR Preview 안내</p>
              <p className="mt-1">
                포켓몬 GO 스타일의 컨셉 데모입니다. 정식 SaMD 품목 범위 외
                R&amp;D 프리뷰이며, 캐치 결과는 환자 기록에 저장되지 않습니다.
                카메라 영상은 브라우저 안에서만 사용되며 외부로 전송되지 않습니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 게임 스타일 CSS */}
      <style jsx>{`
        .xr-creature {
          width: 88px;
          height: 110px;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
          animation: xr-bob 2.6s ease-in-out infinite,
            xr-spawn 0.45s ease-out;
        }
        .xr-creature:hover .xr-creature-card {
          transform: translateY(-2px) scale(1.04);
        }
        .xr-creature-glow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 140px;
          height: 140px;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle,
            rgba(167, 139, 250, 0.55) 0%,
            rgba(167, 139, 250, 0) 65%
          );
          animation: xr-pulse 1.6s ease-in-out infinite;
          pointer-events: none;
        }
        .xr-creature-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 100%;
          height: 100%;
          padding: 10px 6px;
          border-radius: 20px;
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.18),
            rgba(167, 139, 250, 0.22)
          );
          border: 2px solid rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(8px);
          box-shadow: 0 12px 28px -10px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transition: transform 0.2s ease;
        }
        .xr-creature-emoji {
          font-size: 42px;
          line-height: 1;
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
        }
        .xr-creature-label {
          font-size: 12px;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
          letter-spacing: 0.02em;
        }
        .xr-creature-caught .xr-creature-card {
          animation: xr-burst 0.55s ease-out forwards;
        }
        .xr-creature-caught .xr-creature-glow {
          animation: xr-glow-burst 0.55s ease-out forwards;
        }
        .xr-catch-toast {
          display: inline-flex;
          align-items: center;
          padding: 10px 18px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(16, 185, 129, 0.95),
            rgba(59, 130, 246, 0.95)
          );
          color: #fff;
          box-shadow: 0 12px 30px -10px rgba(16, 185, 129, 0.7);
          animation: xr-toast 1.4s ease-out forwards;
        }
        @keyframes xr-bob {
          0%,
          100% {
            margin-top: 0px;
          }
          50% {
            margin-top: -10px;
          }
        }
        @keyframes xr-pulse {
          0%,
          100% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.95;
            transform: translate(-50%, -50%) scale(1.15);
          }
        }
        @keyframes xr-spawn {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.4);
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes xr-burst {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.9;
            box-shadow: 0 0 60px rgba(16, 185, 129, 0.9);
          }
          100% {
            transform: scale(0.6);
            opacity: 0;
          }
        }
        @keyframes xr-glow-burst {
          0% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(2.2);
          }
        }
        @keyframes xr-toast {
          0% {
            opacity: 0;
            transform: translate(-50%, -10px) scale(0.85);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -16px) scale(0.95);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .xr-creature,
          .xr-creature-glow,
          .xr-catch-toast {
            animation: none;
          }
        }

        /* 손 캐치 시각화 */
        .xr-creature-hovered .xr-creature-card {
          border-color: rgba(52, 211, 153, 0.85);
          box-shadow: 0 12px 30px -8px rgba(52, 211, 153, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .xr-dwell-ring {
          width: 100%;
          height: 100%;
        }
        .xr-hand-cursor {
          width: 64px;
          height: 64px;
          transform: translate(-50%, -50%);
          z-index: 30;
        }
        .xr-hand-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid rgba(96, 165, 250, 0.85);
          box-shadow: 0 0 24px rgba(96, 165, 250, 0.6),
            inset 0 0 12px rgba(96, 165, 250, 0.4);
          animation: xr-hand-pulse 1.4s ease-in-out infinite;
        }
        .xr-hand-dot {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          margin: -4px 0 0 -4px;
          background: #60a5fa;
          border-radius: 9999px;
          box-shadow: 0 0 12px rgba(96, 165, 250, 0.95);
        }
        @keyframes xr-hand-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.12);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function HandStatusBadge({
  status,
  error,
}: {
  status: "idle" | "loading" | "tracking" | "no-hand" | "error";
  error?: string | null;
}) {
  if (status === "tracking") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/40 bg-sky-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-200">
        <Hand className="h-3.5 w-3.5" /> 손 추적 ON
      </span>
    );
  }
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <Hand className="h-3.5 w-3.5 animate-pulse" /> 모델 로드 중
      </span>
    );
  }
  if (status === "no-hand") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
        <Hand className="h-3.5 w-3.5" /> 손을 비춰주세요
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex max-w-[420px] items-center gap-2 truncate rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200"
        title={error ?? "손 추적 비활성"}
      >
        <Hand className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate normal-case tracking-normal">
          {error ?? "손 추적 비활성"}
        </span>
      </span>
    );
  }
  return null;
}

function CameraStatusBadge({
  state,
  onRetry,
}: {
  state: CameraState;
  onRetry: () => void;
}) {
  if (state.status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
        <Video className="h-3.5 w-3.5" /> 카메라 ON
      </span>
    );
  }
  if (state.status === "requesting") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <Camera className="h-3.5 w-3.5 animate-pulse" /> 권한 요청 중
      </span>
    );
  }
  if (state.status === "denied") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200 hover:bg-rose-400/20"
      >
        <VideoOff className="h-3.5 w-3.5" /> 카메라 차단됨 · 다시 시도
      </button>
    );
  }
  if (state.status === "error") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-400/20"
      >
        <VideoOff className="h-3.5 w-3.5" /> 오류 · 다시 시도
      </button>
    );
  }
  return null;
}
