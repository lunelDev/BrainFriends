"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Blocks,
  Gamepad2,
  MessageSquareText,
  Sparkles,
  TimerReset,
  Wind,
} from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";

const GAME_CARDS = [
  {
    key: "tetris",
    title: "한글 테트리스",
    subtitle: "집중 놀이",
    desc: "정확한 발음에 반응하는 실시간 음성 조종 퍼즐",
    href: "/programs/lingo/tetris",
    icon: Blocks,
    badgeClass:
      "bg-gradient-to-r from-sky-100 to-cyan-100 text-sky-700 border-sky-200",
    accentClass:
      "bg-gradient-to-br from-sky-50 via-white to-cyan-50 border-sky-100",
  },
  {
    key: "balloon",
    title: "풍선 키우기",
    subtitle: "발성 훈련",
    desc: "적정 음량을 유지해 풍선을 키우고, 너무 크게 말해 터뜨리지 않게 조절해요.",
    href: "/programs/lingo/balloon",
    icon: Wind,
    badgeClass:
      "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border-emerald-200",
    accentClass:
      "bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-100",
  },
  {
    key: "memory",
    title: "말로 열기",
    subtitle: "분류 훈련",
    desc: "그림을 보고 과일, 동물, 탈것 중 맞는 답을 말해 물음표 카드를 열어요.",
    href: "/programs/lingo/memory",
    icon: Sparkles,
    badgeClass:
      "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border-amber-200",
    accentClass:
      "bg-gradient-to-br from-amber-50 via-white to-yellow-50 border-amber-100",
  },
  {
    key: "sentence",
    title: "문장 대결",
    subtitle: "문장 훈련",
    desc: "문장을 만들고 읽으며 정확도에 따라 내가 공격하거나 상대가 반격해요.",
    href: "/programs/lingo/sentence",
    icon: MessageSquareText,
    badgeClass:
      "bg-gradient-to-r from-rose-100 to-orange-100 text-rose-700 border-rose-200",
    accentClass:
      "bg-gradient-to-br from-rose-50 via-white to-orange-50 border-rose-100",
  },
] as const;

export default function SelectGameModePage() {
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
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-[#F8FAFC] min-h-screen">
      <header className="px-4 sm:px-6 py-3 border-b border-violet-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
            />
            <div className="grid grid-cols-2 items-center gap-x-2 sm:gap-x-3 min-w-0">
              <p className="col-span-2 text-[10px] font-black text-violet-600 uppercase tracking-widest leading-none">
                Active Patient Profile
              </p>
              <h2 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight leading-none truncate">
                {isMounted ? (patient?.name ?? "정보 없음") : "정보 없음"}
                <span className="text-xs sm:text-sm font-bold text-slate-500 ml-1.5 sm:ml-2">
                  {isMounted ? (patient?.age ?? "-") : "-"}세
                </span>
              </h2>
              <span
                className={`mt-1 justify-self-start inline-flex px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black shadow-sm border whitespace-nowrap ${
                  ageGroup === "Senior"
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => router.push("/select-page/mode")}
              className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 hover:from-violet-700 hover:to-indigo-700 transition-all"
            >
              활동선택
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
            >
              {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-10 pb-10 sm:pb-12 lg:pb-14">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-5 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
              게임 모드
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              말하기, 발음, 분류, 조절 훈련을 게임처럼 이어서 진행할 수 있습니다.
            </p>
          </div>
          <div className="self-start lg:self-end inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[11px] sm:text-xs font-black text-violet-700">
            <Gamepad2 className="w-3.5 h-3.5" />
            LingoFriends 연동
          </div>
        </section>

        <section className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 p-6 sm:p-8 lg:p-10 text-white shadow-xl mb-6 sm:mb-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">
            <Gamepad2 className="w-3.5 h-3.5" />
            LingoFriends Games
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight leading-none">
            말하기 훈련을 게임처럼 시작해 보세요.
          </h2>
          <p className="mt-4 max-w-3xl text-sm sm:text-base text-white/85 leading-relaxed">
            각 게임은 발성, 단어 인식, 문장 읽기, 음량 조절 훈련을 자연스럽게 반복할 수
            있도록 설계되어 있습니다. 지금 바로 원하는 게임을 선택해 시작할 수 있습니다.
          </p>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
          {GAME_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.key}
                href={card.href}
                className={`group rounded-[28px] border p-6 sm:p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${card.accentClass}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.18em] uppercase ${card.badgeClass}`}
                    >
                      지금 시작
                    </span>
                    <p className="mt-4 text-xs sm:text-sm font-black text-slate-500 tracking-wide">
                      {card.subtitle}
                    </p>
                    <h3 className="mt-1 text-3xl sm:text-[34px] font-black tracking-tight text-slate-900">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 max-w-xl">
                      {card.desc}
                    </p>
                  </div>

                  <div className="shrink-0 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white text-slate-700 shadow-sm transition-transform duration-200 group-hover:scale-105">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-200/80 pt-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-xs sm:text-sm font-black text-slate-700 shadow-sm">
                    게임 시작하기
                    <span className="transition-transform duration-200 group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                    실시간 훈련
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
