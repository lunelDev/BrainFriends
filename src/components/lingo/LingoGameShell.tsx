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
  headerActions?: ReactNode;
  variant?: "default" | "gameMode";
};

export default function LingoGameShell({
  badge,
  title,
  children,
  onRestart,
  onBack,
  restartLabel = "다시 시작",
  statusLabel,
  progressLabel,
  headerActions,
  variant = "default",
}: LingoGameShellProps) {
  const router = useRouter();
  const handleHome = onBack ?? (() => router.push("/select-page/game-mode"));

  return (
    <main className="lingo-game-shell relative flex min-h-screen flex-col overflow-hidden bg-[#090914] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(26,26,54,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,54,0.55)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <header className="relative z-10 min-h-16 shrink-0 sticky top-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a36] bg-[#090914]/90 px-3 py-2 backdrop-blur-md sm:flex-nowrap sm:px-6 sm:py-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0">
            <span className="block font-black text-[10px] uppercase tracking-[0.28em] leading-none text-violet-300/80">
              {badge}
            </span>
            <h2 className="truncate text-base font-black tracking-tight text-white sm:text-lg">
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
          {headerActions}
          {statusLabel ? (
            <div className="rounded-full border border-violet-400/35 bg-violet-500/14 px-3 py-1.5 text-[11px] font-black text-violet-100 transition-all">
              {statusLabel}
            </div>
          ) : null}
          {progressLabel ? (
            <div className="rounded-full border border-sky-400/35 bg-sky-500/12 px-4 py-1.5 text-xs font-black text-sky-100">
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

      <section className="relative z-10 flex-1 overflow-y-auto bg-transparent">
        <div className="mx-auto w-full max-w-[1920px] px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </section>
    </main>
  );
}
