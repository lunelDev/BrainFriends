"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music } from "lucide-react";
import SelectionHeroBanner from "@/components/training/SelectionHeroBanner";
import SelectionImageCard from "@/components/training/SelectionImageCard";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SONG_KEYS, SONGS } from "@/features/sing-training/data/songs";

export default function SelectSingPage() {
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
      <header className="px-4 sm:px-6 py-3 border-b border-emerald-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
            />
            <div className="grid grid-cols-2 items-center gap-x-2 sm:gap-x-3 min-w-0">
              <p className="col-span-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">
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
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-500"
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
              className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-emerald-500 hover:from-emerald-700 hover:to-emerald-600 transition-all"
            >
              활동선택
            </button>
            <button
              type="button"
              onClick={() => router.push("/report?mode=sing")}
              className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-[#0B1A3A] text-white border-[#0B1A3A] hover:bg-[#09152f] transition-all"
            >
              리포트 보기
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

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-10 pb-10 sm:pb-12 lg:pb-14 flex flex-col justify-center">
        <SelectionHeroBanner
          badge="Brain Karaoke"
          title="좋아하는 곡으로 리듬과 발화 반응 훈련을 시작해 보세요."
          description="곡별 난이도에 맞춰 30초 가창 훈련을 진행합니다. 음성과 얼굴 반응을 함께 분석해 보다 몰입감 있게 노래 훈련을 이어갈 수 있습니다."
          accentClassName="border-emerald-100 from-emerald-600 via-teal-500 to-slate-900"
          icon={<Music className="w-3.5 h-3.5" />}
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {SONG_KEYS.map((songKey) => {
            const song = SONGS[songKey];

            return (
              <SelectionImageCard
                key={songKey}
                onClick={() =>
                  router.push(
                    `/programs/sing-training?song=${encodeURIComponent(songKey)}`,
                  )
                }
                title={songKey}
                description={song.selection.description}
                badge={`${song.level} Song`}
                ctaLabel="곡 시작하기"
                imagePath={song.selection.imagePath}
                imagePosition={song.selection.imagePosition}
                imageFilter="brightness(1.1) saturate(1)"
                overlayStyle={{ background: song.selection.overlayStyle }}
                topLeft={
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/18 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md"
                    style={{ background: song.selection.badgeStyle }}
                  >
                    <Music className="h-3 w-3" />
                    {song.level}
                    <span className="text-slate-900/75">SONG</span>
                  </span>
                }
              />
            );
          })}
        </section>
      </main>
    </div>
  );
}
