"use client";

import type { ReactNode } from "react";

type LingoResultModalShellProps = {
  icon: ReactNode;
  badgeText: string;
  title: string;
  subtitle: string;
  hideIcon?: boolean;
  headerToneClass?: string;
  iconToneClass?: string;
  badgeToneClass?: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryButtonClass?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryButtonClass?: string;
  footerNote?: string;
  maxWidthClass?: string;
};

export default function LingoResultModalShell({
  icon,
  badgeText,
  title,
  subtitle,
  hideIcon = false,
  headerToneClass = "bg-violet-50",
  iconToneClass = "bg-violet-600",
  badgeToneClass = "text-violet-600",
  children,
  primaryLabel,
  onPrimary,
  primaryButtonClass = "bg-violet-600 shadow-violet-100",
  secondaryLabel,
  onSecondary,
  secondaryButtonClass = "border-2 border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-slate-50 hover:text-slate-700",
  footerNote,
  maxWidthClass = "max-w-[520px]",
}: LingoResultModalShellProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-900/90 p-4 backdrop-blur-xl sm:items-center sm:p-6">
      <div
        className={`relative my-auto w-full ${maxWidthClass} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[40px] [@media(min-height:901px)]:rounded-[56px] border-[6px] border-violet-100 bg-white p-5 [@media(min-height:901px)]:p-8 shadow-2xl sm:max-h-[calc(100dvh-3rem)]`}
      >
        <div className={`text-center ${hideIcon ? "mb-5 [@media(min-height:901px)]:mb-8" : "mb-6 [@media(min-height:901px)]:mb-10"}`}>
          {!hideIcon ? (
            <div className={`mb-4 [@media(min-height:901px)]:mb-6 inline-block rounded-[28px] [@media(min-height:901px)]:rounded-[40px] p-4 [@media(min-height:901px)]:p-6 text-white shadow-2xl ${iconToneClass}`}>
              <span className="text-4xl [@media(min-height:901px)]:text-6xl">{icon}</span>
            </div>
          ) : null}
          <span className={`mb-2 block text-[12px] font-black uppercase tracking-[0.4em] ${badgeToneClass}`}>
            {badgeText}
          </span>
          <div className="px-2 py-1">
            <h2 className="text-2xl [@media(min-height:901px)]:text-4xl font-black tracking-tighter text-slate-900">{title}</h2>
            <p className="mt-2 font-bold text-slate-400">{subtitle}</p>
          </div>
        </div>

        {children}

        <div className="space-y-2 [@media(min-height:901px)]:space-y-3">
          <button
            onClick={onPrimary}
            className={`h-12 [@media(min-height:901px)]:h-16 w-full rounded-[20px] [@media(min-height:901px)]:rounded-[24px] text-base [@media(min-height:901px)]:text-lg font-black text-white shadow-xl transition-transform active:scale-95 ${primaryButtonClass}`}
          >
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              onClick={onSecondary}
              className={`flex h-12 [@media(min-height:901px)]:h-16 w-full items-center justify-center rounded-[20px] [@media(min-height:901px)]:rounded-[24px] text-sm font-black transition-all ${secondaryButtonClass}`}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>

        {footerNote ? (
          <div className="flex justify-center pt-4 [@media(min-height:901px)]:pt-6">
            <p className="w-fit text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              {footerNote}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
