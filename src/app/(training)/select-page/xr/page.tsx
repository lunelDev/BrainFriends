"use client";

// /(training)/select-page/xr/page.tsx
//
// XR 체험 컨셉/랜딩 페이지 (R&D Preview).
//
// 목적:
//   - SaMD 정식 스코프 외 사전 탐색용 환경. 클리니컬 데이터로는 사용하지 않는다.
//   - WebXR(HMD/VR 헤드셋) 의존성 없음. 카메라(getUserMedia) 기반 모바일 AR 스타일.
//   - 컨셉 시각화는 HTML/CSS 3D transform, 모델 뷰어는 sample/model-viewer 에서 three.js CDN 로드.
//
// 보호:
//   - /select-page 하위라 src/proxy.ts 가 자동으로 세션 체크를 한다.

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";

// 카메라 가용성만 체크한다. WebXR(HMD/VR 헤드셋) 의존 제거.
// 우리 컨셉은 모바일 AR(=카메라 패스스루) 이라 immersive-vr/ar 세션은 필요 없음.
type CameraSupportState =
  | { status: "checking" }
  | { status: "available"; deviceCount: number }
  | { status: "insecure-context"; reason: string }
  | { status: "no-mediadevices"; reason: string }
  | { status: "no-camera"; reason: string };

const SAMPLE_SCENES = [
  {
    key: "park-walk",
    title: "공원 산책 시나리오",
    desc: "벤치, 나무, 사람 등 사물 어휘를 360° 환경에서 호명 훈련.",
    accent: "from-emerald-400/80 to-emerald-700/70",
    icon: <Cuboid className="h-5 w-5" />,
    duration: "3~5분",
    target: "사물 인식 / 호명",
  },
  {
    key: "cafe-order",
    title: "카페 주문 시뮬레이션",
    desc: "메뉴 아이콘을 응시(gaze)로 선택하고 발화로 주문을 완성.",
    accent: "from-amber-400/80 to-orange-600/70",
    icon: <Headphones className="h-5 w-5" />,
    duration: "2~4분",
    target: "AAC + 발화",
  },
  {
    key: "aac-floating",
    title: "AAC 부유 보드",
    desc: "공간 속에 떠있는 픽토그램을 잡아 의도 문장을 조립한다.",
    accent: "from-violet-400/80 to-indigo-700/70",
    icon: <Wand2 className="h-5 w-5" />,
    duration: "2~3분",
    target: "의도 문장 조립",
  },
  {
    key: "gaze-mirror",
    title: "안면 미러 룸",
    desc: "거울 속 자신과 마주 보며 시선·표정 안정화 체크.",
    accent: "from-sky-400/80 to-indigo-600/70",
    icon: <Eye className="h-5 w-5" />,
    duration: "1~2분",
    target: "시선 / 표정",
  },
] as const;

export default function XrShowcasePage() {
  const router = useRouter();
  const { patient, isLoading } = useTrainingSession();
  const [support, setSupport] = useState<CameraSupportState>({ status: "checking" });

  useEffect(() => {
    if (!isLoading && !patient) router.replace("/");
  }, [isLoading, patient, router]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (typeof window === "undefined") return;
      // getUserMedia 는 secure context (https / localhost) 필요.
      if (!window.isSecureContext) {
        setSupport({
          status: "insecure-context",
          reason: "카메라는 HTTPS 또는 localhost 에서만 사용할 수 있습니다.",
        });
        return;
      }
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.enumerateDevices
      ) {
        setSupport({
          status: "no-mediadevices",
          reason: "이 브라우저는 카메라 API 를 지원하지 않습니다.",
        });
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const cams = devices.filter((d) => d.kind === "videoinput");
        if (cams.length === 0) {
          setSupport({
            status: "no-camera",
            reason: "연결된 카메라가 없습니다. 권한을 한 번 허용하면 정확한 개수가 표시됩니다.",
          });
          return;
        }
        setSupport({ status: "available", deviceCount: cams.length });
      } catch (err) {
        setSupport({
          status: "no-camera",
          reason: `카메라 조회 실패: ${(err as Error).message}`,
        });
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[radial-gradient(circle_at_20%_-20%,#a78bfa20,transparent_55%),radial-gradient(circle_at_85%_15%,#60a5fa20,transparent_55%),linear-gradient(180deg,#0b1022_0%,#11163a_60%,#0b1022_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1022]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
              <Glasses className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-violet-300">
                XR Preview · R&amp;D
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                BrainFriends XR 체험 환경
              </h1>
              <p className="mt-1 text-sm font-medium text-violet-200/80">
                {patient?.name ?? "사용자"}님 · 사전 탐색 모드 (임상 데이터 미수집)
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
            <button
              onClick={() => router.push("/select-page/xr/model-viewer")}
              className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <Cuboid className="mr-1 inline h-4 w-4" /> 3D 모델 뷰어
            </button>
            <button
              onClick={() => router.push("/select-page/xr/vr-tour")}
              className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20"
            >
              <Volume2 className="mr-1 inline h-4 w-4" /> 음성 진행 VR 투어
            </button>
            <button
              onClick={() => router.push("/select-page/xr/sample")}
              className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-indigo-400"
            >
              어휘 헌트 시작
              <ChevronRight className="ml-1 inline h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
        {/* HERO with 3D parallax cube */}
        <section className="relative grid gap-8 rounded-[40px] border border-white/10 bg-[linear-gradient(135deg,#1a1f4a_0%,#0e1230_100%)] p-6 shadow-[0_30px_80px_-30px_rgba(124,58,237,0.5)] sm:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-center gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" /> Concept Preview
            </span>
            <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              실제 공간을 닮은 환경에서<br />
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
                언어를 다시 꺼내봅니다.
              </span>
            </h2>
            <p className="max-w-xl text-sm font-medium leading-7 text-violet-100/85 sm:text-base">
              스마트폰/PC 카메라로 주변 공간을 비추면 어휘 크리처가 그 위에 떠서
              호명·응시 훈련을 유도합니다 (포켓몬 GO 스타일). VR 헤드셋 없이도
              동작합니다. 초기 프리뷰 단계라 임상 결과로는 사용되지 않으며, 정식
              도입 전 사용성·안전성 검토를 위한 R&amp;D 환경입니다.
            </p>
            <SupportBadge support={support} />
          </div>

          {/* 순수 CSS 3D 큐브 — three.js 없이 컨셉 시각화 */}
          <div className="relative flex items-center justify-center">
            <div className="xr-stage">
              <div className="xr-cube">
                <span className="xr-face xr-front">공원</span>
                <span className="xr-face xr-back">병원</span>
                <span className="xr-face xr-right">카페</span>
                <span className="xr-face xr-left">은행</span>
                <span className="xr-face xr-top">마트</span>
                <span className="xr-face xr-bottom">우리집</span>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_center,transparent_55%,#0b1022_85%)]" />
          </div>
        </section>

        {/* Pillars */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <PillarCard
            icon={<Eye className="h-5 w-5" />}
            label="시선 응시"
            desc="MediaPipe 홍채 좌표 기반 응시 안정도를 그대로 가져와, 공간 속 객체 선택에 사용."
          />
          <PillarCard
            icon={<Wand2 className="h-5 w-5" />}
            label="AAC 픽토그램"
            desc="6 장소 × 의도 어휘 시드를 공간 패널로 띄워 손/응시로 의도 문장 조립."
          />
          <PillarCard
            icon={<Headphones className="h-5 w-5" />}
            label="발화 + 청각"
            desc="장면별 사운드 큐 + WASM Whisper-tiny 발화 인식이 같은 채널에서 동작."
          />
        </section>

        {/* Sample scenes */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-300">
                Sample Scenes
              </p>
              <h3 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
                샘플 시나리오 4종
              </h3>
              <p className="mt-1 text-sm font-medium text-violet-200/80">
                각 카드를 누르면 카메라 기반 캐치 데모가 열립니다.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SAMPLE_SCENES.map((scene) => (
              <button
                key={scene.key}
                type="button"
                onClick={() =>
                  router.push(`/select-page/xr/sample?scene=${scene.key}`)
                }
                className="group flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-[0_18px_40px_-18px_rgba(124,58,237,0.6)]"
              >
                <div
                  className={`flex h-32 items-end rounded-2xl bg-gradient-to-br ${scene.accent} p-4`}
                >
                  <span className="rounded-full bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    {scene.target}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-violet-100">
                  {scene.icon}
                  <h4 className="text-base font-black tracking-tight">
                    {scene.title}
                  </h4>
                </div>
                <p className="text-xs font-medium leading-5 text-violet-200/80">
                  {scene.desc}
                </p>
                <div className="mt-auto flex items-center justify-between text-[11px] font-black text-violet-300">
                  <span>예상 {scene.duration}</span>
                  <span className="inline-flex items-center gap-1 transition group-hover:translate-x-1">
                    데모 보기 <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mt-10 rounded-3xl border border-amber-300/30 bg-amber-400/5 p-5 text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
            <div className="text-sm leading-6">
              <p className="font-black text-amber-200">XR Preview 안내</p>
              <p className="mt-1">
                이 환경은 정식 SaMD 품목 범위 외 R&amp;D 프리뷰입니다. 측정값은
                기록되지 않으며, 임상 의사결정에 사용하지 마십시오. 어지러움을
                느끼면 즉시 중단하시고, 1회 5분 이상 연속 사용을 권장하지 않습니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* CSS for 3D cube */}
      <style jsx>{`
        .xr-stage {
          width: 240px;
          height: 240px;
          perspective: 900px;
        }
        .xr-cube {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: xr-spin 18s linear infinite;
        }
        .xr-face {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: #fff;
          background: linear-gradient(
            135deg,
            rgba(167, 139, 250, 0.55),
            rgba(96, 165, 250, 0.35)
          );
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 18px;
          backdrop-filter: blur(6px);
          box-shadow: 0 12px 30px -10px rgba(124, 58, 237, 0.55);
        }
        .xr-front {
          transform: translateZ(120px);
        }
        .xr-back {
          transform: rotateY(180deg) translateZ(120px);
        }
        .xr-right {
          transform: rotateY(90deg) translateZ(120px);
        }
        .xr-left {
          transform: rotateY(-90deg) translateZ(120px);
        }
        .xr-top {
          transform: rotateX(90deg) translateZ(120px);
        }
        .xr-bottom {
          transform: rotateX(-90deg) translateZ(120px);
        }
        @keyframes xr-spin {
          0% {
            transform: rotateX(-15deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(-15deg) rotateY(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .xr-cube {
            animation: none;
            transform: rotateX(-15deg) rotateY(25deg);
          }
        }
      `}</style>
    </div>
  );
}

function SupportBadge({ support }: { support: CameraSupportState }) {
  if (support.status === "checking") {
    return (
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-black text-violet-100">
        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" />
        카메라 확인 중...
      </span>
    );
  }
  if (support.status === "available") {
    return (
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
        카메라 사용 가능 · {support.deviceCount}개 감지됨
      </span>
    );
  }
  if (support.status === "insecure-context") {
    return (
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        {support.reason}
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-200">
      <span className="h-2 w-2 rounded-full bg-amber-300" />
      {support.reason}
    </span>
  );
}

function PillarCard({
  icon,
  label,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-indigo-500/40 text-violet-100">
        {icon}
      </div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-violet-100/85">
        {desc}
      </p>
    </div>
  );
}
