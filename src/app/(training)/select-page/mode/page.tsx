"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";

const BRAIN_SING_ACCENT = "from-emerald-600/40 to-emerald-900/60";
const GAME_MODE_ACCENT = "from-violet-600/40 to-indigo-900/60";

const MODE_CARDS = [
  {
    key: "diagnosis",
    title: "자가 진단",
    modeLabel: "Self-Assessment",
    desc: "기초 기능을 확인하는 단계별 진단을 진행합니다.",
    actionLabel: "자가 진단 시작",
    imagePath: "/images/mode/self-assessment.png",
    accentColor: "from-orange-600/40 to-orange-900/60",
    onSelect: "/select-page/self-assessment",
  },
  {
    key: "rehab",
    title: "언어 재활",
    modeLabel: "Speech Therapy",
    desc: "부족한 영역을 집중적으로 반복 훈련하여 기능 회복을 돕습니다.",
    actionLabel: "재활 훈련 시작",
    imagePath: "/images/mode/speech-rehab.png",
    accentColor: "from-blue-600/40 to-blue-900/60",
    onSelect: "/select-page/speech-rehab",
  },
  {
    key: "brain-sing",
    title: "브레인 노래방",
    modeLabel: "Brain Karaoke",
    desc: "노래를 따라 부르며 리듬감과 발화 반응을 훈련합니다.",
    actionLabel: "브레인 노래방 시작",
    imagePath: "/images/mode/sing-training.png",
    accentColor: BRAIN_SING_ACCENT,
    onSelect: "/select-page/sing-training",
  },
  {
    key: "game-mode",
    title: "게임 모드",
    modeLabel: "Brain Games",
    desc: "게임처럼 즐기면서 집중력과 반응 훈련을 시작합니다.",
    actionLabel: "게임 모드 열기",
    imagePath: "/images/mode/game-training.png",
    accentColor: GAME_MODE_ACCENT,
    onSelect: "/select-page/game-mode",
  },
] as const;

export default function ModeSelectPage() {
  const router = useRouter();
  const { patient, ageGroup } = useTrainingSession();
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
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-orange-100 bg-white/90 backdrop-blur-md">
        <div className="flex w-full flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <img
              src="/images/logo/logo.png"
              alt="Logo"
              className="h-9 w-9 shrink-0 rounded-xl object-cover sm:h-10 sm:w-10"
            />
            <div className="grid min-w-0 grid-cols-2 items-center gap-x-2 sm:gap-x-3">
              <span className="col-span-2 text-[10px] font-black uppercase leading-none tracking-widest text-orange-500">
                Active Patient
              </span>
              <h2 className="truncate text-sm font-black leading-none tracking-tight text-slate-900 sm:text-lg">
                {isMounted ? (patient?.name ?? "정보 없음") : "정보 없음"}
                <span className="ml-1.5 text-xs font-bold text-slate-500 sm:ml-2 sm:text-sm">
                  {isMounted ? (patient?.age ?? "-") : "-"}세
                </span>
              </h2>
              <span className="mt-1 inline-flex justify-self-start whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-700 shadow-sm sm:px-2.5 sm:text-[10px]">
                {ageGroup === "Senior" ? "시니어 기준 적용" : "일반 기준 적용"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {patient?.userRole === "therapist" ? (
              <button
                onClick={() => router.push("/therapist")}
                className="h-8 min-w-[132px] rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 shadow-sm transition-all hover:bg-slate-100 sm:h-9 sm:px-4 sm:text-xs"
              >
                치료사 콘솔
              </button>
            ) : null}
            {patient?.userRole === "admin" ? (
              <button
                onClick={() => router.push("/tools/admin-reports")}
                className="h-8 min-w-[132px] rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 shadow-sm transition-all hover:bg-slate-100 sm:h-9 sm:px-4 sm:text-xs"
              >
                전체 사용 리포트
              </button>
            ) : null}
            <button
              onClick={logout}
              className="h-8 min-w-[90px] rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 shadow-sm transition-all hover:bg-slate-100 sm:h-9 sm:min-w-[98px] sm:px-4 sm:text-xs"
            >
              {isLoggingOut ? "로그아웃 중.." : "로그아웃"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-start overflow-y-auto px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:justify-center lg:pb-14 lg:pt-10">
        <div className="mb-5 text-center sm:mb-6 lg:mb-8">
          <h1 className="mb-2 text-2xxl font-black tracking-tight text-slate-900 sm:text-3xl">
            어떤 활동을 시작할까요?
          </h1>
          <p className="text-sm font-medium text-slate-500 sm:text-base">
            사용자 상태에 맞는 훈련 프로그램을 선택해 주세요.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 lg:gap-6">
          {MODE_CARDS.map((card) => {
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  router.push(card.onSelect);
                }}
                className="group relative aspect-[16/10] min-h-[220px] w-full overflow-hidden rounded-[24px] shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-slate-300/40 sm:aspect-[4/3] sm:min-h-[260px] sm:rounded-[28px] xl:aspect-square"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${card.imagePath})` }}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.accentColor} opacity-50 transition-opacity duration-500 group-hover:opacity-60`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

                <div className="relative z-10 flex h-full flex-col items-start justify-end p-4 text-left sm:p-5">
                  <span className="mb-2 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white backdrop-blur-md">
                    {card.modeLabel}
                  </span>

                  <h3 className="mb-2 text-2xl font-black leading-none text-white drop-shadow-md sm:text-3xl md:text-4xl">
                    {card.title}
                  </h3>

                  <p className="mb-4 whitespace-pre-line text-xs font-medium leading-relaxed text-white/90 drop-shadow-sm sm:text-sm">
                    {card.desc}
                  </p>

                  <div className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/95 px-4 py-2.5 shadow-md transition-colors group-hover:bg-slate-50">
                    <span className="truncate text-xs font-black text-slate-900">
                      {card.actionLabel}
                    </span>
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900">
                      <ChevronRight className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-[28px] border-[3px] border-white/0 transition-all duration-500 group-hover:border-white/35" />
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
