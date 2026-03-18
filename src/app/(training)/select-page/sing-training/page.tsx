"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Music, ChevronRight } from "lucide-react";
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
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-5 mb-5 sm:mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
              브레인 노래방 곡 선택
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              난이도에 맞는 곡을 선택한 뒤 30초 음성/안면 기반 가창 훈련을
              시작합니다.
            </p>
          </div>
          <div className="self-start md:self-end inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] sm:text-xs font-black text-emerald-700">
            <Music className="w-3.5 h-3.5" />총 6곡 · 3단계 난이도
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {SONG_KEYS.map((songKey) => {
            const song = SONGS[songKey];

            return (
              <button
                key={songKey}
                type="button"
                onClick={() =>
                  router.push(
                    `/programs/sing-training?song=${encodeURIComponent(songKey)}`,
                  )
                }
                className="group relative w-full min-h-[220px] sm:min-h-0 aspect-[16/10] sm:aspect-[16/10] lg:aspect-[16/10] xl:aspect-[16/9] rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-slate-300/40"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${song.selection.imagePath})`,
                    backgroundPosition: song.selection.imagePosition,
                    filter: "brightness(1.1) saturate(1)",
                  }}
                />
                <div
                  className="absolute inset-0 opacity-55 group-hover:opacity-65 transition-opacity duration-500"
                  style={{ background: song.selection.overlayStyle }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                <div className="relative z-10 h-full p-4 sm:p-5 flex flex-col justify-end items-start text-left">
                  <div className="flex h-full flex-col">
                    <div>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/18 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md"
                        style={{ background: song.selection.badgeStyle }}
                      >
                        <Music className="h-3 w-3" />
                        {song.level}
                        <span className="text-slate-900/75">SONG</span>
                      </span>
                    </div>

                    <div className="mt-auto">
                      <h3 className="text-4xl font-black text-white mb-2 leading-none [text-shadow:0_10px_28px_rgba(0,0,0,0.95)]">
                        {songKey}
                      </h3>
                      <p className="text-white font-bold text-xs sm:text-sm leading-relaxed mb-4 max-w-[88%] [text-shadow:0_8px_20px_rgba(0,0,0,0.9)]">
                        {song.selection.description}
                      </p>

                      <div className="w-full flex items-center justify-end">
                        <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform">
                          <ChevronRight className="w-4 h-4 text-white" />
                        </div>
                      </div>
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
