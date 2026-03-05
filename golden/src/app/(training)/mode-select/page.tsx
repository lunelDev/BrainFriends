"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { ChevronRight } from "lucide-react";

const MODE_CARDS = [
  {
    key: "diagnosis",
    title: "자가 진단",
    modeLabel: "Self-Assessment",
    desc: "장소를 선택해 단계별 진단을\n다시 진행합니다.",
    actionLabel: "자가 진단 시작",
    // 실제 경로에 있는 이미지로 교체하세요
    imagePath: "/images/mode/select.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
    onSelect: "/select",
  },
  {
    key: "rehab",
    title: "언어 재활",
    modeLabel: "Speech Therapy",
    desc: "선택한 훈련을 반복훈련하여\n부족한 영역을 집중 훈련합니다.",
    actionLabel: "반복훈련 시작",
    imagePath: "/images/mode/rehab.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
    onSelect: "/rehab",
  },
] as const;

export default function ModeSelectPage() {
  const router = useRouter();
  const { patient, ageGroup } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <div className="px-4 sm:px-6 py-3 border-b border-orange-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="grid grid-cols-2 items-center gap-x-2 sm:gap-x-3 min-w-0">
            <p className="col-span-2 text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">
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
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* --- 메인 콘텐츠 --- */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-start px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-6">
        <div className="w-full max-w-4xl mt-3 sm:mt-6 text-center">
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 mb-1.5 sm:mb-2">
            진행할 활동을 선택하세요
          </h1>
          <p className="text-xs sm:text-base text-slate-500 font-medium">
            환자님의 상태에 맞는 최적의 훈련을 준비했습니다.
          </p>
        </div>

        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 w-full max-w-4xl">
            {MODE_CARDS.map((card) => (
              <button
                key={card.key}
                onClick={() => router.push(card.onSelect)}
                className="group relative w-full max-w-[340px] md:max-w-none mx-auto aspect-[16/10] md:aspect-square max-h-[36vh] md:max-h-[52vh] rounded-[20px] sm:rounded-[28px] md:rounded-[36px] overflow-hidden shadow-md transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2 hover:shadow-slate-300/30"
              >
                {/* 1. 배경 이미지 */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${card.imagePath})` }}
                />

                {/* 2. 가독성을 위한 다크 오버레이 그라데이션 */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.accentColor} opacity-50 group-hover:opacity-60 transition-opacity duration-500`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* 3. 텍스트 콘텐츠 레이어 */}
                <div className="relative h-full p-4 sm:p-6 md:p-8 flex flex-col justify-end items-start text-left">
                  {/* 모드 태그 */}
                  <span className="px-2.5 sm:px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest mb-3 sm:mb-4 border border-white/20">
                    {card.modeLabel}
                  </span>

                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2.5 sm:mb-3 drop-shadow-md">
                    {card.title}
                  </h3>

                  <p className="text-white/90 text-xs sm:text-sm md:text-base font-medium leading-relaxed mb-4 sm:mb-6 whitespace-pre-line drop-shadow-sm">
                    {card.desc}
                  </p>

                  {/* 하단 버튼 스타일 UI */}
                  <div className="flex items-center gap-2 sm:gap-3 bg-white/95 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-md group-hover:bg-slate-50 transition-colors">
                    <span className="text-slate-900 text-sm sm:text-base font-black">
                      {card.actionLabel}
                    </span>
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-900 flex items-center justify-center">
                      <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  </div>
                </div>

                {/* 4. 마우스 호버 시 나타나는 테두리 효과 */}
                <div className="absolute inset-0 border-[3px] border-white/0 group-hover:border-white/40 rounded-[40px] transition-all duration-500 pointer-events-none" />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
