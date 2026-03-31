"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Blocks,
  Gamepad2,
  MessageSquareText,
  Sparkles,
  Wind,
} from "lucide-react";
import SelectionHeroBanner from "@/components/training/SelectionHeroBanner";
import SelectionImageCard from "@/components/training/SelectionImageCard";
import { useTrainingSession } from "@/hooks/useTrainingSession";

const GAME_CARDS = [
  {
    key: "tetris",
    title: "한글 테트리스",
    subtitle: "집중 놀이",
    desc: "정확한 발음에 반응하는 실시간 음성 조종 퍼즐",
    href: "/programs/lingo/tetris",
    icon: Blocks,
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-sky-600/45 to-cyan-900/65",
  },
  {
    key: "balloon",
    title: "풍선 키우기",
    subtitle: "발성 훈련",
    desc: "적정 음량을 유지해 풍선을 키우고, 너무 크게 말해 터뜨리지 않게 조절해요.",
    href: "/programs/lingo/balloon",
    icon: Wind,
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-emerald-600/45 to-teal-900/65",
  },
  {
    key: "memory",
    title: "말로 열기",
    subtitle: "분류 훈련",
    desc: "그림을 보고 과일, 동물, 탈것 중 맞는 답을 말해 물음표 카드를 열어요.",
    href: "/programs/lingo/memory",
    icon: Sparkles,
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-amber-500/45 to-yellow-900/65",
  },
  {
    key: "sentence",
    title: "문장 대결",
    subtitle: "문장 훈련",
    desc: "문장을 만들고 읽으며 정확도에 따라 내가 공격하거나 상대가 반격해요.",
    href: "/programs/lingo/sentence",
    icon: MessageSquareText,
    imageSrc: "/images/game/game-training.jpg",
    actionLabel: "게임 시작하기",
    accentClass: "from-rose-500/45 to-orange-900/65",
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
        <SelectionHeroBanner
          badge="LingoFriends Games"
          title="말하기 훈련을 게임처럼 시작해 보세요."
          description="각 게임은 발성, 단어 인식, 문장 읽기, 음량 조절 훈련을 자연스럽게 반복할 수 있도록 설계되어 있습니다. 지금 바로 원하는 게임을 선택해 시작할 수 있습니다."
          accentClassName="border-violet-100 from-violet-600 via-indigo-600 to-slate-900"
          icon={<Gamepad2 className="w-3.5 h-3.5" />}
        />

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
          {GAME_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <SelectionImageCard
                key={card.key}
                href={card.href}
                title={card.title}
                description={card.desc}
                badge={card.subtitle}
                ctaLabel={card.actionLabel}
                imagePath={card.imageSrc}
                overlayClassName={`bg-gradient-to-br ${card.accentClass}`}
                footerMeta="실시간 훈련"
                topLeft={
                  <div className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-[18px] border border-white/35 bg-white/85 text-slate-700 shadow-md backdrop-blur-md">
                    <Icon className="h-5 w-5" />
                  </div>
                }
              />
            );
          })}
        </section>
      </main>
    </div>
  );
}
