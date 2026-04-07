"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { ChevronRight, Lock } from "lucide-react";

const BRAIN_SING_ACCENT = "from-emerald-600/40 to-emerald-900/60";
const GAME_MODE_ACCENT = "from-violet-600/40 to-indigo-900/60";

const MODE_CARDS = [
  {
    key: "diagnosis",
    title: "자가 진단",
    modeLabel: "Self-Assessment",
    desc: "장소를 선택해 단계별 진단을\n다시 진행합니다.",
    actionLabel: "자가 진단 시작",
    imagePath: "/images/mode/self-assessment.png",
    accentColor: "from-orange-600/40 to-orange-900/60",
    onSelect: "/select-page/self-assessment",
  },
  {
    key: "rehab",
    title: "언어 재활",
    modeLabel: "Speech Therapy",
    desc: "부족한 영역을 집중적으로\n반복 훈련하여 기능을 회복합니다.",
    actionLabel: "반복훈련 시작",
    imagePath: "/images/mode/speech-rehab.png",
    accentColor: "from-blue-600/40 to-blue-900/60",
    onSelect: "/select-page/speech-rehab",
  },
  {
    key: "brain-sing",
    title: "브레인 노래방",
    modeLabel: "Brain Karaoke",
    desc: "노래를 따라 부르며 즐겁게\n리듬과 발화 반응을 훈련합니다.",
    actionLabel: "브레인 노래방 시작",
    imagePath: "/images/mode/sing-training.png",
    accentColor: BRAIN_SING_ACCENT,
    onSelect: "/select-page/sing-training",
  },
  {
    key: "game-mode",
    title: "게임 모드",
    modeLabel: "Brain Games",
    desc: "게임처럼 즐기면서\n집중력과 반응 훈련을 시작합니다.",
    actionLabel: "게임 모드 열기",
    imagePath: "/images/mode/game-training.png",
    accentColor: GAME_MODE_ACCENT,
    onSelect: "/select-page/game-mode",
  },
] as const;

export default function ModeSelectPage() {
  const router = useRouter();
  const { patient, ageGroup, isLoading } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/");
        return;
      }
      router.replace("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] font-sans">
      {/* --- 상단 고정 헤더 --- */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <img
              src="/images/logo/logo.png"
              alt="Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
            />
            <div className="grid grid-cols-2 items-center gap-x-2 sm:gap-x-3 min-w-0">
              <span className="col-span-2 text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">
                Active Patient
              </span>
              <h2 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight leading-none truncate">
                {isMounted ? (patient?.name ?? "정보 없음") : "정보 없음"}
                <span className="text-xs sm:text-sm font-bold text-slate-500 ml-1.5 sm:ml-2">
                  {isMounted ? (patient?.age ?? "-") : "-"}세
                </span>
              </h2>
              <span className="mt-1 justify-self-start inline-flex px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black shadow-sm border whitespace-nowrap bg-slate-50 text-slate-700 border-slate-200">
                {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
            {patient?.userRole === "admin" ? (
              <button
                onClick={() => router.push("/tools/admin-reports")}
                className="h-8 sm:h-9 min-w-[132px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
              >
                전체 사용자 리포트
              </button>
            ) : null}
            <button
              onClick={logout}
              className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
            >
              {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      </header>

      {/* --- 메인 콘텐츠 (중앙 집중형) --- */}
      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-10 pb-10 sm:pb-12 lg:pb-14 flex flex-col justify-start xl:justify-center overflow-y-auto">
        <div className="mb-5 sm:mb-6 lg:mb-8 text-center">
          <h1 className="text-2xxl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
            어떤 활동을 시작할까요?
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">
            사용자님의 건강한 내일을 위해 최적화된 프로그램을 준비했습니다.
          </p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {MODE_CARDS.map((card) => {
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  router.push(card.onSelect);
                }}
                className="group relative w-full min-h-[220px] sm:min-h-[260px] aspect-[16/10] sm:aspect-[4/3] xl:aspect-square rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-slate-300/40"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${card.imagePath})` }}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.accentColor} transition-opacity duration-500 opacity-50 group-hover:opacity-60`}
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent"
                />

                <div className="relative h-full p-4 sm:p-5 flex flex-col justify-end items-start text-left z-10">
                  <span className="px-2.5 py-1 bg-white/15 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest mb-2 border border-white/20">
                    {card.modeLabel}
                  </span>

                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-md leading-none">
                    {card.title}
                  </h3>

                  <p className="text-white/90 font-medium text-xs sm:text-sm leading-relaxed mb-4 drop-shadow-sm whitespace-pre-line">
                    {card.desc}
                  </p>

                  <div
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl shadow-md transition-colors bg-white/95 group-hover:bg-slate-50"
                  >
                    <span className="text-xs font-black truncate text-slate-900">
                      {card.actionLabel}
                    </span>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-slate-900">
                      <ChevronRight className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 border-[3px] border-white/0 group-hover:border-white/35 rounded-[28px] transition-all duration-500 pointer-events-none" />
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
