"use client";

import React, { useState } from "react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    // 1. 최외곽: 화면 꽉 차게, 배경색 설정
    <div className="min-h-screen w-full bg-[#F8F9FA] flex items-start lg:items-center justify-center p-0 md:p-4">
      {/* 2. 메인 카드: 그림자 및 둥근 모서리, 내부 레이아웃 flex-col */}
      <div className="w-full max-w-[1400px] min-h-screen md:min-h-0 md:h-full md:max-h-[900px] bg-white md:rounded-[48px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
        {/* 3. 상단 헤더: 고정 높이 */}
        {headerInfo && (
          <header className="px-4 sm:px-6 lg:px-10 py-3 sm:py-4 lg:py-6 border-b border-gray-50 flex justify-between items-center bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* 햄버거 버튼: 사이드바가 있을 때 모바일/태블릿에서만 표시 */}
              {sidebar && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="lg:hidden flex flex-col justify-center items-center w-9 h-9 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="사이드바 열기"
                >
                  <span
                    className={`block w-4 h-0.5 bg-gray-600 transition-all duration-200 ${sidebarOpen ? "rotate-45 translate-y-[5px]" : ""}`}
                  />
                  <span
                    className={`block w-4 h-0.5 bg-gray-600 mt-1 transition-all duration-200 ${sidebarOpen ? "opacity-0" : ""}`}
                  />
                  <span
                    className={`block w-4 h-0.5 bg-gray-600 mt-1 transition-all duration-200 ${sidebarOpen ? "-rotate-45 -translate-y-[5px]" : ""}`}
                  />
                </button>
              )}
              <div className="text-left min-w-0">
                <span className="text-orange-500 font-black text-[11px] tracking-[0.2em] uppercase">
                  Step {headerInfo.step} • {headerInfo.place}
                </span>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-[#0B1A3A] tracking-tighter truncate">
                  {headerInfo.title}
                </h2>
              </div>
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

        {/* 4. 중앙 영역: 사이드바 + 메인 컨텐츠 */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
          {/* 모바일 사이드바 오버레이 배경 */}
          {sidebar && sidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/30 backdrop-blur-[2px] lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* 사이드바: 모바일에서는 슬라이드 drawer, 데스크탑에서는 고정 */}
          {sidebar && (
            <aside
              className={`
                fixed top-0 left-0 z-30 h-full w-[300px] bg-[#FCFCFC] border-r border-gray-50 p-6 overflow-y-auto transition-transform duration-300 ease-in-out shrink-0
                lg:static lg:z-auto lg:w-[320px] xl:w-[380px] lg:translate-x-0 lg:h-auto lg:block lg:p-8
                ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
              `}
            >
              {/* 모바일에서 닫기 버튼 */}
              <div className="flex justify-end mb-4 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                  aria-label="사이드바 닫기"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {sidebar}
            </aside>
          )}

          {/* 메인 컨텐츠 영역 */}
          <main className="flex-1 flex flex-col items-center justify-center bg-white relative overflow-y-auto">
            {content}
          </main>
        </div>

        {/* 5. 하단 정보 바 */}
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
