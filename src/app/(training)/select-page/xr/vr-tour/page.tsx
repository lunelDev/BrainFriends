"use client";

// /(training)/select-page/xr/vr-tour/page.tsx
//
// XR VR 투어 — 음성 진행형 가상 시나리오 (R&D Preview).
//
// 컨셉:
//   - 360° equirectangular 파노라마 + 중앙에 떠있는 3D 모델.
//   - NPC 가 말풍선으로 질문하면 사용자가 음성으로 응답해 시나리오를 진행.
//   - 음성 인식 안 될 때를 대비해 후보 발화 버튼(폴백) 제공.
//   - 우측 패널: 카메라 셀카 미리보기 + FaceLandmarker 안면 트래킹 + STT 기반
//     자음/모음 정확도 표시.
//
// 정책:
//   - 정식 SaMD 품목 범위 외 R&D 프리뷰 — 임상 데이터 채널과 분리.
//   - STT 는 브라우저 webkitSpeechRecognition 사용 — 외부 호출/비용 없음.
//   - 카메라/마이크 영상 음성은 브라우저 안에서만 사용, 외부 전송 안 함.
//
// 베이스 패턴:
//   - 파노라마 + 3D 모델: select-page/xr/model-viewer/page.tsx
//   - 카메라 + FaceTracker: src/components/diagnosis/FaceTracker.tsx
//   - SpeechRecognition: src/components/lingo/DialectRepeatGame.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Cuboid,
  ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Volume2,
  Eye,
  CheckCircle2,
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
import { pickBestMatch, computeJamoAccuracy } from "@/lib/xr/hangulJamo";

// FaceTracker 는 클라이언트 전용. 동적 import 로 SSR 비활성.
const FaceTracker = dynamic(
  () => import("@/components/diagnosis/FaceTracker"),
  { ssr: false },
);

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition?: any;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 시나리오 정의
// ─────────────────────────────────────────────────────────────────────

type ScenarioKey = "mart" | "cafe" | "hospital" | "park";

type ScenarioStep = {
  /** NPC 가 말하는 문장 (말풍선 표시) */
  prompt: string;
  /** 사용자가 말해야 하는 후보들. 가장 잘 매치되는 것 1개를 채택. */
  expected: { id: string; phrase: string; label?: string }[];
  /** 중앙에 떠있을 3D 모델의 현재 라벨/설명 (UI 표시용). */
  centerLabel: string;
  centerSub: string;
  /** 정답 매치 시 NPC 응답 (말풍선) */
  successReply: string;
  /** 빠른 발화 버튼 (음성 안 잡힐 때 폴백) — expected 와 동일/유사 */
  quickButtons?: string[];
};

type Scenario = {
  key: ScenarioKey;
  title: string;
  subtitle: string;
  npcName: string;
  /** 파노라마 카드 라벨 (현재 procedural fallback 만 — 추후 이미지 교체 가능) */
  panoramaLabel: string;
  steps: ScenarioStep[];
};

const SCENARIOS: Scenario[] = [
  {
    key: "mart",
    title: "대형 마트 계산대",
    subtitle: "점원에게 원하는 상품을 말해보세요",
    npcName: "마트 점원",
    panoramaLabel: "대형 마트 계산대",
    steps: [
      {
        prompt: "안녕하세요! 무엇을 도와드릴까요?",
        expected: [
          { id: "water", phrase: "생수 주세요" },
          { id: "milk", phrase: "우유 주세요" },
          { id: "bread", phrase: "식빵 주세요" },
          { id: "egg", phrase: "계란 주세요" },
        ],
        centerLabel: "원하는 상품을 말해보세요",
        centerSub: "생수 / 우유 / 식빵 / 계란",
        successReply: "네, 준비해드릴게요!",
        quickButtons: ["생수 주세요", "우유 주세요", "식빵 주세요", "계란 주세요"],
      },
      {
        prompt: "결제는 카드로 하시겠어요?",
        expected: [
          { id: "card", phrase: "카드로 할게요" },
          { id: "cash", phrase: "현금으로 할게요" },
        ],
        centerLabel: "결제 수단을 말해보세요",
        centerSub: "카드 / 현금",
        successReply: "네, 도와드릴게요. 감사합니다!",
        quickButtons: ["카드로 할게요", "현금으로 할게요"],
      },
    ],
  },
  {
    key: "cafe",
    title: "카페 주문",
    subtitle: "메뉴를 말해 주문을 완성하세요",
    npcName: "카페 직원",
    panoramaLabel: "카페 카운터",
    steps: [
      {
        prompt: "어서오세요! 어떤 음료 드릴까요?",
        expected: [
          { id: "ame", phrase: "아메리카노 주세요" },
          { id: "latte", phrase: "라떼 주세요" },
          { id: "cake", phrase: "케이크 주세요" },
        ],
        centerLabel: "메뉴를 말해보세요",
        centerSub: "아메리카노 / 라떼 / 케이크",
        successReply: "네, 준비해드릴게요!",
        quickButtons: ["아메리카노 주세요", "라떼 주세요", "케이크 주세요"],
      },
      {
        prompt: "사이즈는 어떻게 해드릴까요?",
        expected: [
          { id: "small", phrase: "스몰로 주세요" },
          { id: "regular", phrase: "레귤러로 주세요" },
          { id: "large", phrase: "라지로 주세요" },
        ],
        centerLabel: "사이즈를 말해보세요",
        centerSub: "스몰 / 레귤러 / 라지",
        successReply: "감사합니다, 잠시만요!",
        quickButtons: ["스몰로 주세요", "레귤러로 주세요", "라지로 주세요"],
      },
    ],
  },
  {
    key: "hospital",
    title: "병원 접수",
    subtitle: "접수 직원에게 정보를 말해보세요",
    npcName: "접수 직원",
    panoramaLabel: "병원 접수 데스크",
    steps: [
      {
        prompt: "안녕하세요. 어떻게 오셨어요?",
        expected: [
          { id: "headache", phrase: "머리가 아파요" },
          { id: "dizzy", phrase: "어지러워요" },
          { id: "cough", phrase: "기침이 나요" },
        ],
        centerLabel: "증상을 말해보세요",
        centerSub: "머리 아픔 / 어지러움 / 기침",
        successReply: "네, 진료실로 안내해드릴게요.",
        quickButtons: ["머리가 아파요", "어지러워요", "기침이 나요"],
      },
      {
        prompt: "성함이 어떻게 되세요?",
        // 이름은 후보가 다양하므로 expected 가 비어있으면 길이만 체크.
        // 여기서는 시연용 후보 한 개로 처리.
        expected: [
          { id: "name-self", phrase: "제 이름은 입니다" },
        ],
        centerLabel: "본인 이름을 말해보세요",
        centerSub: "예: 제 이름은 홍길동입니다",
        successReply: "확인했습니다, 잠시만 기다려주세요.",
        quickButtons: ["제 이름은 홍길동입니다"],
      },
    ],
  },
  {
    key: "park",
    title: "공원 산책",
    subtitle: "주변에 보이는 사물을 호명해보세요",
    npcName: "친구",
    panoramaLabel: "공원 산책로",
    steps: [
      {
        prompt: "주변에 뭐가 보여요?",
        expected: [
          { id: "tree", phrase: "나무" },
          { id: "bench", phrase: "벤치" },
          { id: "dog", phrase: "강아지" },
          { id: "bird", phrase: "새" },
          { id: "flower", phrase: "꽃" },
        ],
        centerLabel: "보이는 사물을 말해보세요",
        centerSub: "나무 / 벤치 / 강아지 / 새 / 꽃",
        successReply: "맞아요, 잘 보고 계시네요!",
        quickButtons: ["나무", "벤치", "강아지", "새", "꽃"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// three.js / 파노라마 상수
// ─────────────────────────────────────────────────────────────────────

const THREE_VERSION = "0.128.0";
const THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const OBJLOADER_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/js/loaders/OBJLoader.js`;
const OBJ_PATH = "/models/bugatti.obj";

type PanoramaSource = "loading" | "image" | "procedural";
type ModelState =
  | { status: "loading-libs" }
  | { status: "loading-model" }
  | { status: "ready" }
  | { status: "error"; reason: string };

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("document undefined"));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-xr-cdn="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`load fail ${src}`)),
        { once: true },
      );
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
    s.addEventListener("error", () => reject(new Error(`load fail ${src}`)));
    document.head.appendChild(s);
  });
}

// 시나리오별로 살짝 다른 procedural 파노라마.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProceduralPanorama(THREE: any, scenarioKey: ScenarioKey) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 시나리오별 톤
  const palettes: Record<ScenarioKey, [string, string, string, string]> = {
    mart: ["#0f1530", "#1d2e5a", "#3a4a82", "#0a0f24"],
    cafe: ["#241410", "#3d2218", "#7a4a2e", "#120a08"],
    hospital: ["#0e1e26", "#173644", "#2c5a6e", "#06121a"],
    park: ["#0d1f12", "#1d3a25", "#3a6b48", "#06120a"],
  };
  const [c0, c1, c2, c3] = palettes[scenarioKey];

  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, c0);
  grad.addColorStop(0.4, c1);
  grad.addColorStop(0.55, c2);
  grad.addColorStop(0.6, c1);
  grad.addColorStop(1, c3);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 1024);

  // 별/포인트 라이트
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  for (let i = 0; i < 90; i += 1) {
    const x = Math.random() * 2048;
    const y = Math.random() * 480;
    const r = Math.random() * 1.4 + 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 경도 그리드 — 방향감
  ctx.strokeStyle = "rgba(167, 139, 250, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i += 1) {
    ctx.beginPath();
    ctx.moveTo((i / 24) * 2048, 0);
    ctx.lineTo((i / 24) * 2048, 1024);
    ctx.stroke();
  }

  // 지평선 강조
  ctx.strokeStyle = "rgba(96, 165, 250, 0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.lineTo(2048, 560);
  ctx.stroke();

  // 글로우
  const glow = ctx.createRadialGradient(1024, 220, 0, 1024, 220, 380);
  glow.addColorStop(0, "rgba(167, 139, 250, 0.5)");
  glow.addColorStop(1, "rgba(167, 139, 250, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 2048, 1024);

  return new THREE.CanvasTexture(canvas);
}

// ─────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────

type CameraState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "active"; stream: MediaStream }
  | { status: "denied"; reason: string }
  | { status: "error"; reason: string };

type RecognitionState =
  | { status: "idle" }
  | { status: "unsupported" }
  | { status: "listening" }
  | { status: "stopped" }
  | { status: "error"; reason: string };

export default function VrTourPage() {
  const router = useRouter();
  const { patient, isLoading } = useTrainingSession();

  // 시나리오 선택
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("mart");
  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0],
    [scenarioKey],
  );

  // 단계 진행
  const [stepIdx, setStepIdx] = useState(0);
  const step = scenario.steps[Math.min(stepIdx, scenario.steps.length - 1)];
  const sceneCleared = stepIdx >= scenario.steps.length;

  // 음성 인식 상태
  const [recognition, setRecognition] = useState<RecognitionState>({
    status: "idle",
  });
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [lastMatchedId, setLastMatchedId] = useState<string | null>(null);
  const [npcReply, setNpcReply] = useState<string | null>(null);

  // 자모 정확도
  const [consonantAcc, setConsonantAcc] = useState(0);
  const [vowelAcc, setVowelAcc] = useState(0);

  // 카메라
  const [camera, setCamera] = useState<CameraState>({ status: "idle" });
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);

  // FaceTracker 메트릭
  const [faceMetrics, setFaceMetrics] = useState<{
    detected: boolean;
    fps: number;
    centeredScore: number;
    attentionScore: number;
  }>({ detected: false, fps: 0, centeredScore: 0, attentionScore: 0 });

  // 3D 캔버스
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<ModelState>({ status: "loading-libs" });
  const [panoramaSrc, setPanoramaSrc] = useState<PanoramaSource>("loading");
  const [autoRotate, setAutoRotate] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const autoRotateRef = useRef(autoRotate);
  const zoomRef = useRef(zoomLevel);
  const rebuildPanoramaRef = useRef<((key: ScenarioKey) => void) | null>(null);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  // 보호 라우트 — 세션 없으면 홈으로.
  useEffect(() => {
    if (!isLoading && !patient) router.replace("/");
  }, [isLoading, patient, router]);

  // ─────────────────────────────────────────────
  // 카메라 권한 요청 (FaceTracker 가 사용)
  // ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let acquired: MediaStream | null = null;

    const start = async () => {
      setCamera({ status: "requesting" });
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices) {
          throw new Error("브라우저가 카메라를 지원하지 않습니다.");
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
              "카메라 권한이 거부되어 안면 트래킹을 사용할 수 없습니다. 음성 진행은 그대로 가능합니다.",
          });
        } else {
          setCamera({
            status: "error",
            reason: e.message || "카메라를 시작하지 못했습니다.",
          });
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (acquired) {
        acquired.getTracks().forEach((t) => t.stop());
        unregisterMediaStream(acquired);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  // ─────────────────────────────────────────────
  // 음성 인식 + 매칭 → 단계 진행
  // ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const stepRef = useRef(step);
  const stepIdxRef = useRef(stepIdx);
  const sceneClearedRef = useRef(sceneCleared);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    stepIdxRef.current = stepIdx;
  }, [stepIdx]);
  useEffect(() => {
    sceneClearedRef.current = sceneCleared;
  }, [sceneCleared]);

  const evaluateUtterance = useCallback(
    (utterance: string) => {
      const currentStep = stepRef.current;
      if (!currentStep) return;
      const trimmed = utterance.trim();
      if (!trimmed) return;
      const { matched, result } = pickBestMatch(trimmed, currentStep.expected);
      // 자모 정확도 표시는 매칭 후보 중 최고값으로 갱신.
      setConsonantAcc(result.consonantAccuracy);
      setVowelAcc(result.vowelAccuracy);

      // 매칭 임계값 — overall 0.55 이상이면 통과로 간주 (한국어 STT 가
      // 구어체에서 종결어미 일부를 빼먹는 경우가 있어 너무 엄격하면 안 됨).
      // 단계가 이름 등 자유 발화형이면 길이만 체크.
      const isOpenEnded = currentStep.expected.length === 1 &&
        currentStep.expected[0].phrase.includes("입니다");
      const passed = isOpenEnded
        ? trimmed.length >= 4
        : matched !== null && result.overall >= 0.55;

      if (passed) {
        setLastMatchedId(matched?.id ?? "open");
        setNpcReply(currentStep.successReply);
        setFinalText(trimmed);
        // 다음 단계로 전환 — 1.4초 NPC 반응 후.
        window.setTimeout(() => {
          setStepIdx((i) => i + 1);
          setNpcReply(null);
          setLastMatchedId(null);
          setInterimText("");
        }, 1400);
      } else {
        setFinalText(trimmed);
      }
    },
    [],
  );

  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setRecognition({ status: "unsupported" });
      return;
    }
    if (recognitionRef.current) {
      // 이미 동작 중 — 중복 시작 방지.
      return;
    }
    try {
      const rec = new Recognition();
      rec.lang = "ko-KR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event: {
        resultIndex: number;
        results: ArrayLike<{
          0: { transcript?: string };
          isFinal?: boolean;
          length: number;
        }>;
      }) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const r = event.results[i];
          const txt = (r?.[0]?.transcript ?? "").trim();
          if (!txt) continue;
          if (r.isFinal) {
            evaluateUtterance(txt);
            interim = "";
          } else {
            interim = txt;
          }
        }
        if (interim) setInterimText(interim);
      };
      rec.onerror = (e: { error?: string }) => {
        // 'no-speech' 는 흔하므로 silent 처리.
        if (e?.error === "no-speech") return;
        setRecognition({
          status: "error",
          reason: `음성 인식 오류: ${e?.error ?? "unknown"}`,
        });
      };
      rec.onend = () => {
        recognitionRef.current = null;
        if (keepListeningRef.current && !sceneClearedRef.current) {
          window.setTimeout(() => {
            if (keepListeningRef.current && !sceneClearedRef.current) {
              startRecognition();
            }
          }, 200);
        } else {
          setRecognition({ status: "stopped" });
        }
      };
      rec.start();
      recognitionRef.current = rec;
      keepListeningRef.current = true;
      setRecognition({ status: "listening" });
    } catch (err) {
      setRecognition({
        status: "error",
        reason: (err as Error).message || "음성 인식을 시작하지 못했습니다.",
      });
    }
  }, [evaluateUtterance]);

  const stopRecognition = useCallback(() => {
    keepListeningRef.current = false;
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        if (typeof rec.abort === "function") rec.abort();
        else rec.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    setRecognition({ status: "stopped" });
  }, []);

  // 카메라가 active 가 되거나 시나리오 진입 시 자동 시작.
  useEffect(() => {
    if (camera.status === "active") {
      startRecognition();
    }
    return () => {
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.status, scenarioKey]);

  // 빠른 발화 버튼 — 텍스트 직접 평가.
  const handleQuickPhrase = (phrase: string) => {
    setInterimText(phrase);
    evaluateUtterance(phrase);
  };

  // 시나리오 변경 — 단계 리셋.
  const switchScenario = (key: ScenarioKey) => {
    setScenarioKey(key);
    setStepIdx(0);
    setInterimText("");
    setFinalText("");
    setLastMatchedId(null);
    setNpcReply(null);
    setConsonantAcc(0);
    setVowelAcc(0);
    rebuildPanoramaRef.current?.(key);
  };

  const restartScenario = () => switchScenario(scenario.key);

  // ─────────────────────────────────────────────
  // three.js — 파노라마 + bugatti.obj + 마우스 orbit
  // (model-viewer 패턴 기반)
  // ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    let cleanupListeners: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let panoMatRef: any = null;

    const init = async () => {
      try {
        setModel({ status: "loading-libs" });
        await loadScriptOnce(THREE_CDN);
        await loadScriptOnce(OBJLOADER_CDN);
        if (cancelled) return;

        const THREE = window.THREE;
        if (!THREE) throw new Error("THREE 글로벌 초기화 실패");
        if (!THREE.OBJLoader) throw new Error("OBJLoader 초기화 실패");

        const container = canvasContainerRef.current;
        if (!container) throw new Error("렌더 컨테이너 마운트 실패");
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene3 = new THREE.Scene();
        const camera3d = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // 파노라마 sphere — 내부에서 보이게 normals 뒤집기.
        const panoGeo = new THREE.SphereGeometry(500, 60, 40);
        panoGeo.scale(-1, 1, 1);
        const panoMat = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
        panoMatRef = panoMat;
        const panoMesh = new THREE.Mesh(panoGeo, panoMat);
        scene3.add(panoMesh);

        const applyProcedural = (key: ScenarioKey) => {
          const tex = createProceduralPanorama(THREE, key);
          if (!tex) return;
          tex.encoding = THREE.sRGBEncoding ?? tex.encoding;
          panoMat.map = tex;
          panoMat.needsUpdate = true;
          setPanoramaSrc("procedural");
        };

        // 외부에서 시나리오 변경 시 호출할 수 있도록 ref 에 저장.
        rebuildPanoramaRef.current = applyProcedural;

        // 시나리오별 이미지가 있으면 우선 로드, 없으면 procedural fallback.
        // (현재는 이미지 없음 — 향후 public/panoramas/<key>.jpg 추가 시 자동 적용)
        const texLoader = new THREE.TextureLoader();
        const tryImage = (key: ScenarioKey) => {
          const url = `/panoramas/${key}.jpg`;
          texLoader.load(
            url,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (tex: any) => {
              if (cancelled) return;
              tex.encoding = THREE.sRGBEncoding ?? tex.encoding;
              panoMat.map = tex;
              panoMat.needsUpdate = true;
              setPanoramaSrc("image");
            },
            undefined,
            () => {
              if (cancelled) return;
              applyProcedural(key);
            },
          );
        };
        tryImage(scenarioKey);

        // 조명
        scene3.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.0);
        key.position.set(5, 8, 5);
        scene3.add(key);
        const rimViolet = new THREE.DirectionalLight(0xa78bfa, 0.6);
        rimViolet.position.set(-6, 3, -4);
        scene3.add(rimViolet);
        const rimSky = new THREE.DirectionalLight(0x60a5fa, 0.4);
        rimSky.position.set(4, -2, -6);
        scene3.add(rimSky);

        // OBJ — 중앙 모델
        setModel({ status: "loading-model" });
        const loader = new THREE.OBJLoader();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let modelGroup: any = null;
        loader.load(
          OBJ_PATH,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (obj: any) => {
            if (cancelled) return;
            const box = new THREE.Box3().setFromObject(obj);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetSize = 3.5;
            const s = targetSize / maxDim;
            obj.scale.setScalar(s);
            obj.position.set(-center.x * s, -center.y * s, -center.z * s);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            obj.traverse((child: any) => {
              if (child.isMesh) {
                const hasMat =
                  child.material &&
                  !(Array.isArray(child.material) && child.material.length === 0);
                if (!hasMat || child.material?.isMeshBasicMaterial) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0x9aa6d6,
                    metalness: 0.6,
                    roughness: 0.34,
                  });
                }
              }
            });
            scene3.add(obj);
            modelGroup = obj;
            setModel({ status: "ready" });
          },
          undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any) => {
            if (cancelled) return;
            setModel({
              status: "error",
              reason: `OBJ 로드 실패: ${(err as Error)?.message ?? "네트워크/경로 확인"}`,
            });
          },
        );

        // orbit 컨트롤
        let cameraTheta = Math.PI / 4;
        let cameraPhi = Math.PI / 2 - 0.15;
        const updateCameraPos = () => {
          const r = 6 / Math.max(0.5, zoomRef.current);
          camera3d.position.x = r * Math.sin(cameraPhi) * Math.cos(cameraTheta);
          camera3d.position.y = r * Math.cos(cameraPhi);
          camera3d.position.z = r * Math.sin(cameraPhi) * Math.sin(cameraTheta);
          camera3d.lookAt(0, 0, 0);
        };
        updateCameraPos();

        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        const onPointerDown = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
        };
        const onPointerMove = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          if (autoRotateRef.current) {
            autoRotateRef.current = false;
            setAutoRotate(false);
          }
          cameraTheta -= dx * 0.005;
          cameraPhi = Math.max(0.15, Math.min(Math.PI - 0.15, cameraPhi - dy * 0.005));
          updateCameraPos();
        };
        const onPointerUp = (e: PointerEvent) => {
          dragging = false;
          (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const delta = e.deltaY * 0.0015;
          const next = Math.max(0.5, Math.min(2.5, zoomRef.current - delta));
          zoomRef.current = next;
          setZoomLevel(Number(next.toFixed(2)));
          updateCameraPos();
        };
        const dom = renderer.domElement as HTMLCanvasElement;
        dom.style.cursor = "grab";
        dom.style.touchAction = "none";
        dom.addEventListener("pointerdown", onPointerDown);
        dom.addEventListener("pointermove", onPointerMove);
        dom.addEventListener("pointerup", onPointerUp);
        dom.addEventListener("pointercancel", onPointerUp);
        dom.addEventListener("pointerleave", onPointerUp);
        dom.addEventListener("wheel", onWheel, { passive: false });

        const animate = () => {
          if (cancelled) return;
          if (autoRotateRef.current) {
            cameraTheta += 0.0025;
            updateCameraPos();
          }
          if (modelGroup) {
            modelGroup.position.y = Math.sin(performance.now() * 0.001) * 0.08;
            modelGroup.rotation.y += 0.002;
          }
          renderer.render(scene3, camera3d);
          raf = requestAnimationFrame(animate);
        };
        animate();

        const onResize = () => {
          const newW = container.clientWidth;
          const newH = container.clientHeight;
          if (newW <= 0 || newH <= 0) return;
          camera3d.aspect = newW / newH;
          camera3d.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        };
        window.addEventListener("resize", onResize);

        cleanupListeners = () => {
          window.removeEventListener("resize", onResize);
          dom.removeEventListener("pointerdown", onPointerDown);
          dom.removeEventListener("pointermove", onPointerMove);
          dom.removeEventListener("pointerup", onPointerUp);
          dom.removeEventListener("pointercancel", onPointerUp);
          dom.removeEventListener("pointerleave", onPointerUp);
          dom.removeEventListener("wheel", onWheel);
        };
      } catch (err) {
        if (cancelled) return;
        setModel({
          status: "error",
          reason: (err as Error).message ?? "초기화 실패",
        });
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      cleanupListeners?.();
      rebuildPanoramaRef.current = null;
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
      panoMatRef = null;
    };
  }, []);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
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
                XR VR Tour
              </p>
              <h1 className="mt-1 truncate text-lg font-black tracking-tight sm:text-xl">
                360° 가상 전시 공간
              </h1>
              <p className="text-xs font-medium text-violet-200/75">
                {patient?.name ?? "사용자"}님 · 마우스 드래그로 둘러보기
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRotate((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
                autoRotate
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {autoRotate ? "자동 회전 ON" : "자동 회전 OFF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        {/* 시나리오 탭 */}
        <section className="flex flex-wrap items-center gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => switchScenario(s.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-black tracking-tight transition ${
                s.key === scenarioKey
                  ? "border-violet-300/50 bg-violet-500/20 text-violet-50"
                  : "border-white/15 bg-white/5 text-violet-200/85 hover:bg-white/10"
              }`}
            >
              {s.title}
            </button>
          ))}
          <button
            onClick={restartScenario}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black text-white hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 시나리오 다시
          </button>
        </section>

        {/* 상태 줄 */}
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-violet-100/90">
          <PanoramaStatusBadge state={panoramaSrc} />
          <ModelStatusBadge state={model} />
          <RecognitionBadge state={recognition} />
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200">
            <Cuboid className="h-3.5 w-3.5" /> ZOOM {zoomLevel.toFixed(2)}x
          </span>
          <button
            onClick={() => setZoomLevel((v) => Math.max(0.5, +(v - 0.1).toFixed(2)))}
            className="rounded-full border border-white/15 bg-white/5 p-1.5 text-white hover:bg-white/10"
            aria-label="줌 아웃"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((v) => Math.min(2.5, +(v + 0.1).toFixed(2)))}
            className="rounded-full border border-white/15 bg-white/5 p-1.5 text-white hover:bg-white/10"
            aria-label="줌 인"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black text-white hover:bg-white/10"
          >
            리셋
          </button>
        </section>

        {/* 메인 — 좌: 3D 스테이지, 우: 실시간 상태판 */}
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* 3D 스테이지 */}
          <div
            className="relative overflow-hidden rounded-[36px] border border-white/10 shadow-[0_30px_80px_-30px_rgba(124,58,237,0.55)]"
            style={{ height: "min(70vh, 720px)", minHeight: "560px" }}
          >
            <div ref={canvasContainerRef} className="absolute inset-0" />

            {/* 모델 로딩/에러 오버레이 */}
            {model.status !== "ready" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="rounded-3xl border border-white/15 bg-black/55 px-6 py-5 text-center backdrop-blur">
                  {model.status === "error" ? (
                    <>
                      <ShieldAlert className="mx-auto h-6 w-6 text-rose-300" />
                      <p className="mt-3 text-sm font-black text-rose-200">
                        모델 로드 실패
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-rose-100/85">
                        {model.reason}
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-300" />
                      <p className="mt-3 text-sm font-black text-violet-100">
                        {model.status === "loading-libs"
                          ? "three.js 라이브러리 로드 중..."
                          : "3D 모델 로드 중..."}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {/* NPC 말풍선 — 좌상단 */}
            {!sceneCleared ? (
              <div className="absolute left-4 top-4 max-w-[60%] rounded-3xl border border-white/15 bg-black/60 p-4 backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
                  {scenario.npcName}
                </p>
                <p className="mt-1.5 text-sm font-medium leading-6 text-white sm:text-base">
                  {npcReply ?? step.prompt}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-black text-violet-200/80">
                  <Volume2 className="h-3.5 w-3.5" />
                  단계 {Math.min(stepIdx + 1, scenario.steps.length)} /{" "}
                  {scenario.steps.length}
                </div>
              </div>
            ) : null}

            {/* 중앙 라벨 — 모델 아래 */}
            {!sceneCleared ? (
              <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-2xl border border-white/15 bg-black/55 px-4 py-2 text-center backdrop-blur">
                <p className="text-sm font-black text-white">{step.centerLabel}</p>
                <p className="text-[11px] font-medium text-violet-200/85">
                  {step.centerSub}
                </p>
              </div>
            ) : null}

            {/* 시나리오 클리어 오버레이 */}
            {sceneCleared ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="rounded-3xl border border-emerald-300/40 bg-emerald-500/10 px-8 py-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                  <h3 className="mt-3 text-2xl font-black tracking-tight text-emerald-100">
                    시나리오 완료!
                  </h3>
                  <p className="mt-1 text-sm font-medium text-emerald-200/85">
                    {scenario.title} 의 모든 단계를 완료했어요.
                  </p>
                  <button
                    onClick={restartScenario}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-black text-slate-900 transition hover:bg-emerald-400"
                  >
                    <RotateCcw className="h-4 w-4" /> 다시 도전
                  </button>
                </div>
              </div>
            ) : null}

            {/* 빠른 발화 버튼 — 좌하단 */}
            {!sceneCleared && step.quickButtons?.length ? (
              <div className="absolute bottom-4 left-4 flex max-w-[55%] flex-col gap-2">
                {step.quickButtons.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQuickPhrase(q)}
                    className="rounded-2xl border border-white/15 bg-black/50 px-3 py-1.5 text-left text-xs font-black text-violet-100 backdrop-blur transition hover:border-violet-300/50 hover:bg-violet-500/20"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            {/* 진행/매칭 로그 — 우하단 */}
            <div className="pointer-events-none absolute bottom-4 right-4 max-w-[55%] rounded-2xl bg-black/45 px-4 py-2 text-right text-xs font-medium text-violet-100/90 backdrop-blur">
              {interimText ? (
                <p className="truncate">
                  <Mic className="mr-1 inline h-3 w-3" />
                  <span className="opacity-70">인식 중:</span> {interimText}
                </p>
              ) : finalText ? (
                <p className="truncate">
                  <span className="opacity-70">최근 발화:</span> {finalText}
                </p>
              ) : (
                <p className="opacity-70">마이크에 대고 말해보세요</p>
              )}
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-violet-300">
                드래그로 둘러보기 · 휠로 줌 · 자동 회전은 헤더에서 토글
              </p>
            </div>
          </div>

          {/* 우측 실시간 상태판 */}
          <aside className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-violet-300" />
              <p className="text-sm font-black tracking-tight">실시간 상태판</p>
            </div>

            {/* 카메라 미리보기 + Face landmarks */}
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas
                ref={faceCanvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ transform: "scaleX(-1)" }}
              />
              {camera.status === "active" ? (
                <FaceTracker
                  videoRef={videoRef}
                  canvasRef={faceCanvasRef}
                  maxFps={20}
                  onMetricsUpdate={(m) =>
                    setFaceMetrics({
                      detected: m.faceDetected,
                      fps: m.fps,
                      centeredScore: m.gaze?.centeredScore ?? 0,
                      attentionScore: m.gaze?.attentionScore ?? 0,
                    })
                  }
                />
              ) : null}
              {camera.status !== "active" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 px-3 text-center">
                  <p className="text-xs font-black text-violet-100">
                    {camera.status === "requesting"
                      ? "카메라 권한 요청 중"
                      : camera.status === "denied"
                        ? "카메라 권한 거부"
                        : camera.status === "error"
                          ? "카메라 오류"
                          : "카메라 대기"}
                  </p>
                  {camera.status === "denied" || camera.status === "error" ? (
                    <p className="text-[10px] font-medium text-violet-200/80">
                      음성 진행은 그대로 가능합니다
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">
                안면
              </div>
            </div>

            {/* 메트릭 막대 */}
            <MetricBar
              label="안면 반응 참고"
              value={faceMetrics.attentionScore}
              accent="emerald"
            />
            <MetricBar
              label="추적 품질"
              value={
                faceMetrics.detected
                  ? Math.min(1, faceMetrics.fps / 24)
                  : 0
              }
              accent="emerald"
              dim
            />
            <MetricBar
              label="자음 정확도"
              value={consonantAcc}
              accent="sky"
            />
            <MetricBar
              label="모음 정확도"
              value={vowelAcc}
              accent="violet"
            />

            <p className="mt-1 text-[10px] leading-5 text-violet-200/70">
              ※ 본 화면의 수치는 사용자 피드백 표시용 R&amp;D 프리뷰이며,
              임상 데이터로 저장되지 않습니다.
            </p>
          </aside>
        </section>

        {/* 하단 — 면책 */}
        <section className="rounded-3xl border border-amber-300/30 bg-amber-400/5 p-5 text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
            <div className="text-sm leading-6">
              <p className="font-black text-amber-200">XR Preview 안내</p>
              <p className="mt-1">
                정식 SaMD 품목 범위 외 R&amp;D 프리뷰입니다. 음성·영상은 브라우저
                안에서만 사용되며 외부로 전송되지 않습니다. 어지러움이 느껴지면
                즉시 중단하시고, 1회 5분 이상 연속 사용을 권장하지 않습니다.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 보조 컴포넌트
// ─────────────────────────────────────────────────────────────────────

function MetricBar({
  label,
  value,
  accent,
  dim,
}: {
  label: string;
  value: number; // 0~1
  accent: "emerald" | "sky" | "violet";
  dim?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const colors: Record<typeof accent, string> = {
    emerald: "bg-emerald-400",
    sky: "bg-sky-400",
    violet: "bg-violet-400",
  };
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-black tracking-tight text-violet-100/85">
        <span>{label}</span>
        <span className={dim ? "text-violet-200/60" : ""}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full ${colors[accent]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PanoramaStatusBadge({ state }: { state: PanoramaSource }) {
  if (state === "image") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
        <ImageIcon className="h-3.5 w-3.5" /> 파노라마 IMAGE
      </span>
    );
  }
  if (state === "procedural") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <ImageIcon className="h-3.5 w-3.5" /> 파노라마 PROCEDURAL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> 파노라마 로드 중
    </span>
  );
}

function ModelStatusBadge({ state }: { state: ModelState }) {
  if (state.status === "ready") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
        <Cuboid className="h-3.5 w-3.5" /> 모델 LOADED
      </span>
    );
  }
  if (state.status === "loading-libs") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> three.js 로드 중
      </span>
    );
  }
  if (state.status === "loading-model") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> OBJ 로드 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200">
      <ShieldAlert className="h-3.5 w-3.5" /> 모델 오류
    </span>
  );
}

function RecognitionBadge({ state }: { state: RecognitionState }) {
  if (state.status === "listening") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
        <Mic className="h-3.5 w-3.5" /> 음성 인식 ON
      </span>
    );
  }
  if (state.status === "unsupported") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
        <MicOff className="h-3.5 w-3.5" /> 브라우저 미지원 (Chrome 권장)
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200">
        <MicOff className="h-3.5 w-3.5" /> {state.reason}
      </span>
    );
  }
  if (state.status === "stopped") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
        <MicOff className="h-3.5 w-3.5" /> 음성 인식 OFF
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/40 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
      <Sparkles className="h-3.5 w-3.5 animate-pulse" /> 대기
    </span>
  );
}

// 미사용 export 방지용 — computeJamoAccuracy 는 expression-only 임포트라
// 트리쉐이킹 과정에서 빠지지 않도록 노출.
void computeJamoAccuracy;
