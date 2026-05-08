"use client";

// /(training)/select-page/xr/page.tsx
//
// XR 컨텐츠 라이브러리 (R&D Preview) — 다시 디자인.
//
// 흐름:
//   - Hero: three.js 미니 파노라마 sphere 가 4 시나리오 톤을 자동 순환하며
//     "음성 진행 VR 투어" 를 메인으로 광고.
//   - 시나리오 4종(마트/카페/병원/공원) 큰 카드 — 각 카드 클릭 시
//     /select-page/xr/vr-tour?scenario=<key> 로 deep link.
//   - 추가 데모: 3D 모델 뷰어 / 어휘 헌트(Pokemon-Go 스타일).
//   - 기술 기둥(시선/AAC/발화) 요약.
//   - R&D Preview 면책.
//
// 정책:
//   - SaMD 정식 스코프 외 사전 탐색 환경. 임상 데이터 미수집.
//   - WebXR(HMD/VR 헤드셋) 의존성 없음 — 카메라 + 음성 기반.
//   - 보호 라우트 — /select-page 하위라 src/proxy.ts 가 세션 체크.

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Sparkles,
  Eye,
  Glasses,
  Cuboid,
  Headphones,
  Wand2,
  ShieldAlert,
  Volume2,
  Mic,
  ShoppingCart,
  Coffee,
  Stethoscope,
  Trees,
  ArrowRight,
} from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE?: any;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 시나리오 카드 데이터 — vr-tour 의 SCENARIOS 와 키 일치.
// ─────────────────────────────────────────────────────────────────────

type ScenarioKey = "mart" | "cafe" | "hospital" | "park";

const SCENARIO_CARDS: {
  key: ScenarioKey;
  title: string;
  desc: string;
  duration: string;
  steps: number;
  icon: React.ReactNode;
  /** Tailwind gradient — 카드 배경 */
  accent: string;
  /** three.js sphere 외피 톤 — palette[0]:상단, [1]:중간, [2]:하단 */
  palette: [string, string, string];
  sample: string[];
}[] = [
  {
    key: "mart",
    title: "대형 마트 계산대",
    desc: "점원에게 원하는 상품을 음성으로 주문하는 일상 시뮬레이션.",
    duration: "3~5분",
    steps: 2,
    icon: <ShoppingCart className="h-5 w-5" />,
    accent: "from-sky-500/40 via-indigo-600/30 to-slate-900/70",
    palette: ["#1d2e5a", "#3a4a82", "#0a0f24"],
    sample: ["생수 주세요", "우유 주세요", "카드로 할게요"],
  },
  {
    key: "cafe",
    title: "카페 주문",
    desc: "메뉴를 말해 주문을 완성하는 카운터 대화.",
    duration: "2~4분",
    steps: 2,
    icon: <Coffee className="h-5 w-5" />,
    accent: "from-amber-500/40 via-orange-600/30 to-slate-900/70",
    palette: ["#3d2218", "#7a4a2e", "#120a08"],
    sample: ["아메리카노 주세요", "라떼 주세요", "스몰로 주세요"],
  },
  {
    key: "hospital",
    title: "병원 접수",
    desc: "증상·이름을 말해 진료 접수를 완료하는 시나리오.",
    duration: "3~4분",
    steps: 2,
    icon: <Stethoscope className="h-5 w-5" />,
    accent: "from-cyan-500/40 via-teal-600/30 to-slate-900/70",
    palette: ["#173644", "#2c5a6e", "#06121a"],
    sample: ["머리가 아파요", "어지러워요", "이름 말하기"],
  },
  {
    key: "park",
    title: "공원 산책",
    desc: "주변에 보이는 사물을 호명하는 자유 발화 훈련.",
    duration: "2~3분",
    steps: 1,
    icon: <Trees className="h-5 w-5" />,
    accent: "from-emerald-500/40 via-green-600/30 to-slate-900/70",
    palette: ["#1d3a25", "#3a6b48", "#06120a"],
    sample: ["나무", "벤치", "강아지", "꽃"],
  },
];

const PILLARS = [
  {
    icon: <Mic className="h-5 w-5" />,
    label: "음성 인식",
    desc: "브라우저 webkitSpeechRecognition 한국어 모드. 외부 호출/비용 없음.",
  },
  {
    icon: <Eye className="h-5 w-5" />,
    label: "안면 트래킹",
    desc: "MediaPipe FaceLandmarker — 응시·주의집중 점수를 실시간 표시.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    label: "자모 정확도",
    desc: "한글 초성·중성·종성 기반 발화 정확도 산출 (Levenshtein).",
  },
];

// ─────────────────────────────────────────────────────────────────────
// Hero 미니 파노라마 sphere — 4 시나리오 톤 순환
// ─────────────────────────────────────────────────────────────────────

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePaletteTexture(THREE: any, palette: [string, string, string]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(0.55, palette[1]);
  grad.addColorStop(1, palette[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // 별
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < 60; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 220;
    const r = Math.random() * 1.2 + 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 지평선
  ctx.strokeStyle = "rgba(167, 139, 250, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 280);
  ctx.lineTo(1024, 280);
  ctx.stroke();
  // 글로우
  const glow = ctx.createRadialGradient(512, 110, 0, 512, 110, 220);
  glow.addColorStop(0, "rgba(167, 139, 250, 0.45)");
  glow.addColorStop(1, "rgba(167, 139, 250, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 512);

  return new THREE.CanvasTexture(canvas);
}

function HeroPanorama({
  activeIdx,
  onActiveIdxChange,
}: {
  activeIdx: number;
  onActiveIdxChange: (idx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(activeIdx);
  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let panoMat: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textures: any[] = [];
    let cycleTimer: number | null = null;
    let resizeListener: (() => void) | null = null;

    const init = async () => {
      try {
        await loadScriptOnce(
          "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
        );
        if (cancelled) return;
        const THREE = window.THREE;
        if (!THREE) return;
        const container = containerRef.current;
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
        camera.position.set(0, 0, 0.01);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // sphere — 안에서 보이도록 normals 뒤집기
        const geo = new THREE.SphereGeometry(80, 48, 32);
        geo.scale(-1, 1, 1);
        panoMat = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
        const mesh = new THREE.Mesh(geo, panoMat);
        scene.add(mesh);

        // 시나리오별 텍스처 미리 생성
        for (const card of SCENARIO_CARDS) {
          const t = makePaletteTexture(THREE, card.palette);
          if (t) {
            t.encoding = THREE.sRGBEncoding ?? t.encoding;
            textures.push(t);
          } else {
            textures.push(null);
          }
        }
        if (textures[activeIdxRef.current]) {
          panoMat.map = textures[activeIdxRef.current];
          panoMat.needsUpdate = true;
        }

        // 8초마다 다음 시나리오로 부드럽게 전환
        cycleTimer = window.setInterval(() => {
          if (cancelled) return;
          const next = (activeIdxRef.current + 1) % SCENARIO_CARDS.length;
          activeIdxRef.current = next;
          onActiveIdxChange(next);
          if (textures[next] && panoMat) {
            panoMat.map = textures[next];
            panoMat.needsUpdate = true;
          }
        }, 4500);

        let theta = 0;
        const animate = () => {
          if (cancelled) return;
          theta += 0.0015;
          camera.rotation.y = theta;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(animate);
        };
        animate();

        const onResize = () => {
          if (!container || !renderer) return;
          const newW = container.clientWidth;
          const newH = container.clientHeight;
          if (newW <= 0 || newH <= 0) return;
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        };
        resizeListener = onResize;
        window.addEventListener("resize", onResize);
      } catch {
        /* CDN 차단 등 — hero 가 없어도 페이지는 동작 */
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (cycleTimer !== null) window.clearInterval(cycleTimer);
      if (resizeListener) window.removeEventListener("resize", resizeListener);
      for (const t of textures) {
        try {
          t?.dispose?.();
        } catch {
          /* noop */
        }
      }
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
    // 마운트 1회만 — onActiveIdxChange 변경에 반응 안 해도 됨.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />
  );
}

// ─────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────

export default function XrLibraryPage() {
  const router = useRouter();
  const { patient, isLoading } = useTrainingSession();
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);

  useEffect(() => {
    if (!isLoading && !patient) router.replace("/");
  }, [isLoading, patient, router]);

  const heroCard = SCENARIO_CARDS[activeHeroIdx];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[radial-gradient(circle_at_15%_-10%,#a78bfa20,transparent_55%),radial-gradient(circle_at_90%_15%,#60a5fa20,transparent_55%),linear-gradient(180deg,#06091c_0%,#0c1130_55%,#06091c_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06091c]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
              <Glasses className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-violet-300">
                XR Content Library · R&amp;D
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                BrainFriends XR
              </h1>
              <p className="mt-1 text-sm font-medium text-violet-200/80">
                {patient?.name ?? "사용자"}님 · 사전 탐색 환경 (임상 데이터 미수집)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/select-page/mode")}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
            >
              사용자 홈으로
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
        {/* ───────────────────────────────────────── HERO ───────────────────────────────────────── */}
        <section className="relative grid gap-8 overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(135deg,#1a1f4a_0%,#0e1230_100%)] p-6 shadow-[0_30px_80px_-30px_rgba(124,58,237,0.5)] sm:p-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* 좌: 카피 */}
          <div className="relative z-10 flex flex-col justify-center gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" /> Featured · 음성 진행 VR 투어
            </span>
            <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              360° 가상 공간에서<br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
                목소리로 세상과 연결되다.
              </span>
            </h2>
            <p className="max-w-xl text-sm font-medium leading-7 text-violet-100/85 sm:text-base">
              마트·카페·병원·공원 — 일상 공간 속 NPC 와 음성으로 대화하며
              자연스럽게 발화 훈련을 합니다. 자음·모음 정확도와 안면 반응이
              실시간으로 표시되며, 카메라·음성은 브라우저 안에서만 사용됩니다.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/select-page/xr/vr-tour")}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400"
              >
                <Volume2 className="h-4 w-4" /> 음성 투어 시작
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => router.push("/select-page/xr/model-viewer")}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Cuboid className="h-4 w-4" /> 3D 모델 뷰어
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-violet-200/70">
              <span className="inline-flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Web Speech API
              </span>
              <span className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> MediaPipe Face
              </span>
              <span className="text-white/30">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Cuboid className="h-3.5 w-3.5" /> three.js Sphere
              </span>
            </div>
          </div>

          {/* 우: 미니 파노라마 + 현재 시나리오 라벨 */}
          <div className="relative h-[260px] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-inner sm:h-[320px]">
            <HeroPanorama
              activeIdx={activeHeroIdx}
              onActiveIdxChange={setActiveHeroIdx}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(6,9,28,0.85)_95%)]" />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-violet-200 backdrop-blur">
              360° Preview
            </div>
            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2">
              <span className="rounded-full bg-black/60 p-2 text-violet-100">
                {heroCard.icon}
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">
                  지금 보는 시나리오
                </p>
                <p className="text-sm font-black text-white">{heroCard.title}</p>
              </div>
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
              {SCENARIO_CARDS.map((c, i) => (
                <span
                  key={c.key}
                  className={`h-1.5 rounded-full transition-all ${
                    i === activeHeroIdx ? "w-5 bg-violet-300" : "w-1.5 bg-white/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 시나리오 4종 카드 */}
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-300">
                Scenarios
              </p>
              <h3 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
                일상 시나리오 4종
              </h3>
              <p className="mt-1 text-sm font-medium text-violet-200/80">
                음성 투어를 원하는 장면에서 바로 시작할 수 있어요.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SCENARIO_CARDS.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() =>
                  router.push(`/select-page/xr/vr-tour?scenario=${card.key}`)
                }
                className="group relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-[0_18px_40px_-18px_rgba(124,58,237,0.6)]"
              >
                <div
                  className={`relative flex h-32 items-end overflow-hidden rounded-2xl bg-gradient-to-br ${card.accent} p-4`}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-50">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <span
                        key={i}
                        className="absolute h-1 w-1 rounded-full bg-white/70"
                        style={{
                          left: `${(i * 137) % 100}%`,
                          top: `${(i * 61) % 60}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-black/35 text-white backdrop-blur">
                    {card.icon}
                  </div>
                  <div className="relative ml-auto flex items-center gap-2">
                    <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                      {card.steps}단계
                    </span>
                    <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                      {card.duration}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-black tracking-tight text-white">
                    {card.title}
                  </h4>
                  <p className="mt-1 text-xs font-medium leading-5 text-violet-200/85">
                    {card.desc}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {card.sample.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-violet-100/85"
                    >
                      <Mic className="h-2.5 w-2.5" />
                      {s}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[11px] font-black text-violet-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="h-3 w-3" /> 음성 진행
                  </span>
                  <span className="inline-flex items-center gap-1 transition group-hover:translate-x-1">
                    바로 시작 <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 추가 데모 */}
        <section>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-300">
              More Demos
            </p>
            <h3 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
              추가 XR 데모
            </h3>
            <p className="mt-1 text-sm font-medium text-violet-200/80">
              음성 투어 외에 시각/손 추적 기반 데모도 함께 살펴볼 수 있어요.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <button
              onClick={() => router.push("/select-page/xr/model-viewer")}
              className="group flex flex-col gap-3 overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-transparent p-5 text-left transition hover:-translate-y-0.5 hover:bg-cyan-500/15"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-200">
                  <Cuboid className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-base font-black tracking-tight text-white">
                    3D 모델 뷰어
                  </h4>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    360 panorama · OBJ
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium leading-6 text-violet-200/85">
                360° 파노라마 sphere 안에 떠있는 3D 모델을 마우스 드래그로
                자유롭게 둘러봅니다. 파노라마 이미지를 직접 넣어 가상 전시에
                활용할 수 있어요.
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-black text-cyan-200">
                열기 <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              onClick={() => router.push("/select-page/xr/sample")}
              className="group flex flex-col gap-3 overflow-hidden rounded-3xl border border-violet-300/20 bg-gradient-to-br from-violet-500/15 via-indigo-500/5 to-transparent p-5 text-left transition hover:-translate-y-0.5 hover:bg-violet-500/20"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/25 text-violet-200">
                  <Wand2 className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-base font-black tracking-tight text-white">
                    어휘 헌트 (Pokemon GO 스타일)
                  </h4>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300">
                    AR Camera · Hand Track
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium leading-6 text-violet-200/85">
                카메라 화면 위에 어휘 크리처가 등장하면 검지 손가락으로 짚어
                잡습니다 (MediaPipe 손 추적, 0.6초 hover-dwell). 사물 호명
                훈련용 캐치 게임.
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-black text-violet-200">
                열기 <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </section>

        {/* 기술 기둥 */}
        <section>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-300">
              Pillars
            </p>
            <h3 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
              기술 구성
            </h3>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.label}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-indigo-500/40 text-violet-100">
                  {p.icon}
                </div>
                <p className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
                  {p.label}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-violet-100/85">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 면책 */}
        <section className="rounded-3xl border border-amber-300/30 bg-amber-400/5 p-5 text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
            <div className="text-sm leading-6">
              <p className="font-black text-amber-200">XR Preview 안내</p>
              <p className="mt-1">
                정식 SaMD 품목 범위 외 R&amp;D 프리뷰 환경입니다. 측정값은
                임상 데이터로 저장되지 않으며, 임상 의사결정에 사용하지
                마십시오. 카메라·음성은 브라우저 안에서만 사용되며 외부로
                전송되지 않습니다. 어지러움이 느껴지면 즉시 중단하시고, 1회
                5분 이상 연속 사용을 권장하지 않습니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      <noscript>
        <p className="p-4 text-center text-sm font-bold text-violet-100">
          XR 라이브러리 사용을 위해 자바스크립트를 활성화해주세요.
        </p>
      </noscript>

      {/* 트리쉐이킹 방지 — Headphones 는 향후 사운드 기능에서 재사용 예정 */}
      <span className="hidden">
        <Headphones aria-hidden="true" />
      </span>
    </div>
  );
}
