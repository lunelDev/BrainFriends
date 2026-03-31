"use client";

import React from "react";

interface MainLayoutShellProps {
  content: React.ReactNode;
  sidebar?: React.ReactNode;
  headerInfo?: {
    step: string;
    place: string;
    current: number;
    total: number;
    title: string;
  };
}

export default function MainLayoutShell({
  content,
  sidebar,
  headerInfo,
}: MainLayoutShellProps) {
  return (
    // 1. 최외곽: 화면 꽉 차게, 배경색 설정
    <div className="min-h-screen w-full bg-[#F8F9FA] flex items-start lg:items-center justify-center p-0 md:p-4">
      {/* 2. 메인 카드: 그림자 및 둥근 모서리, 내부 레이아웃 flex-col */}
      <div className="w-full max-w-[1400px] min-h-screen md:min-h-0 md:h-full md:max-h-[900px] bg-white md:rounded-[48px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* 3. 상단 헤더: 고정 높이 */}
        {headerInfo && (
          <header className="px-4 sm:px-6 lg:px-10 py-3 sm:py-4 lg:py-6 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
            <div className="text-left min-w-0">
              <span className="text-orange-500 font-black text-[11px] tracking-[0.2em] uppercase">
                Step {headerInfo.step} • {headerInfo.place}
              </span>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-[#0B1A3A] tracking-tighter truncate">
                {headerInfo.title}
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2">
              <div className="hidden sm:flex bg-emerald-50 px-3 sm:px-4 py-2 rounded-full items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-emerald-600 font-black text-xs uppercase tracking-widest">
                  추적중
                </span>
              </div>
              <div className="bg-gray-50 px-3 sm:px-5 py-2 rounded-full font-black text-xs sm:text-sm text-gray-400">
                <span className="text-orange-500">{headerInfo.current}</span> /{" "}
                {headerInfo.total}
              </div>
            </div>
          </header>
        )}

        {/* 4. 중앙 영역: 사이드바 + 메인 컨텐츠 (패딩 제거) */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {sidebar && (
            <aside className="hidden lg:block lg:w-[320px] xl:w-[380px] border-r border-gray-50 bg-[#FCFCFC] p-4 sm:p-6 lg:p-8 overflow-y-auto shrink-0">
              {sidebar}
            </aside>
          )}

          {/* 메인 컨텐츠 영역: p-12 제거, flex-1로 꽉 채움 */}
          <main className="flex-1 flex flex-col items-center justify-center bg-white relative overflow-y-auto">
            {content}
          </main>
        </div>

        {/* 5. 하단 정보 바: 중복 출력 방지를 위해 flex-col 밖이 아닌 최하단에 딱 한 번만 배치 */}
        <footer className="px-4 sm:px-6 lg:px-10 py-3 sm:py-4 border-t border-gray-50 flex justify-between items-center bg-white shrink-0">
          <div className="flex gap-3 sm:gap-6 text-[9px] font-black text-gray-300 uppercase tracking-widest">
            <span className="hidden sm:inline">SI: 87% | VOICE: 29.2 dB</span>
            <span className="text-orange-200 hidden sm:inline">
              Visual-Verbal Association Training
            </span>
          </div>
          <div className="text-[9px] font-black text-gray-200 uppercase tracking-widest">
            Frames: 1269 | Samples: 132
          </div>
        </footer>
      </div>
    </div>
  );
}
