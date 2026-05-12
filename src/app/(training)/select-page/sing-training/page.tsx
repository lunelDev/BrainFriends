"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Music } from "lucide-react";
import SelectionHeroBanner from "@/components/training/SelectionHeroBanner";
import SelectionImageCard from "@/components/training/SelectionImageCard";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SONG_KEYS, SONGS } from "@/features/sing-training/data/songs";
import { buildAdaptiveTrainingOrder } from "@/lib/adaptive/adaptiveTraining";
import { SING_ADAPTIVE_BANK } from "@/lib/adaptive/itemBank";

const SING_RESULT_SESSION_KEY = "bf_sing_result_transient";

type SingAdaptiveHistory = {
  song: string;
  score: number;
} | null;

export default function SelectSingPage() {
  const router = useRouter();
  const { patient, ageGroup } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [adaptiveHistory, setAdaptiveHistory] = useState<SingAdaptiveHistory>(null);

  useEffect(() => {
    setIsMounted(true);
    try {
      const raw = window.sessionStorage.getItem(SING_RESULT_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.song !== "string") return;
      const score = Number(parsed?.score);
      if (!Number.isFinite(score)) return;
      setAdaptiveHistory({ song: parsed.song, score });
    } catch {
      setAdaptiveHistory(null);
    }
  }, []);

  const adaptiveSongOrder = useMemo(
    () =>
      buildAdaptiveTrainingOrder({
        step: "sing",
        items: SONG_KEYS,
        responses:
          adaptiveHistory && SONG_KEYS.includes(adaptiveHistory.song as any)
            ? [
                {
                  itemKey: adaptiveHistory.song,
                  correct: adaptiveHistory.score >= 70,
                },
              ]
            : [],
        getItemKey: (songKey) => songKey,
        getItemText: (songKey) =>
          `${songKey} ${SONGS[songKey].level} ${SONGS[songKey].subtitle}`,
        calibratedBank: SING_ADAPTIVE_BANK,
      }),
    [adaptiveHistory],
  );
  const orderedSongKeys = adaptiveSongOrder.orderedItems;

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
            {/* "리포트 보기" 버튼 제거: /mypage 를 단일 이력 진입점으로 일원화. */}
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
          badge="Sing Training"
          title="좋아하는 곡으로 리듬과 발화 반응을 기록해 보세요."
          description="곡별 난이도에 맞춰 30초 노래 활동을 진행합니다. 음성과 얼굴 반응을 함께 기록해 전문가가 확인할 수 있는 참고 지표로 정리합니다."
          accentClassName="border-emerald-100 from-emerald-600 via-teal-500 to-slate-900"
          icon={<Music className="w-3.5 h-3.5" />}
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {orderedSongKeys.map((songKey) => {
            const song = SONGS[songKey];
            const adaptiveMeta = adaptiveSongOrder.itemMetaByKey[songKey];

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
                ctaLabel="활동 시작하기"
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
                    {adaptiveMeta?.selectionMethod === "irt_mfi" &&
                    adaptiveSongOrder.nextItemKey === songKey ? (
                      <span className="rounded-full bg-white/55 px-1.5 py-0.5 text-[9px] text-slate-900">
                        추천
                      </span>
                    ) : null}
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
