"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { trainingButtonStyles } from "@/lib/ui/trainingButtonStyles";

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 9.5V21h13V9.5"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 21v-5h4v5"
      />
    </svg>
  );
}

type LingoGameShellProps = {
  badge: string;
  title: string;
  children: ReactNode;
  onRestart: () => void;
  onBack?: () => void;
  restartLabel?: string;
  statusLabel?: string;
  progressLabel?: string;
};

export default function LingoGameShell({
  badge,
  title,
  children,
  onRestart,
  onBack,
  restartLabel = "단계 선택",
  statusLabel,
  progressLabel,
}: LingoGameShellProps) {
  const router = useRouter();
  const handleHome = onBack ?? (() => router.push("/select-page/game-mode"));

  return (
    <main className="min-h-screen bg-white flex flex-col overflow-hidden">
      <header className="min-h-16 px-3 sm:px-6 py-2 sm:py-0 border-b border-violet-100 flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <span className="font-black text-[10px] uppercase tracking-widest leading-none block text-violet-500">
              {badge}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
              {title}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-auto flex-wrap justify-end">
          <button
            type="button"
            onClick={onRestart}
            className={`px-3 py-1.5 rounded-full font-black text-[11px] border ${trainingButtonStyles.slateSoft}`}
          >
            {restartLabel}
          </button>
          {statusLabel ? (
            <div className="px-3 py-1.5 rounded-full font-black text-[11px] transition-all border bg-violet-50 border-violet-200 text-violet-700">
              {statusLabel}
            </div>
          ) : null}
          {progressLabel ? (
            <div className="px-4 py-1.5 rounded-full font-black text-xs border bg-violet-50 text-violet-700 border-violet-200">
              {progressLabel}
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleHome}
            aria-label="홈으로 이동"
            title="홈"
            className={`w-9 h-9 ${trainingButtonStyles.homeIcon}`}
          >
            <HomeIcon />
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto bg-[#f8fafc]">
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
          {children}
        </div>
      </section>
    </main>
  );
}
