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
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-[#05050c]/90 p-4 backdrop-blur-xl sm:items-center sm:p-6">
      <div
        className={`relative my-auto w-full ${maxWidthClass} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[40px] border border-[#2a2a5a] bg-[#111120] p-5 text-white shadow-[0_32px_80px_rgba(0,0,0,0.55)] [@media(min-height:901px)]:rounded-[56px] [@media(min-height:901px)]:p-8 sm:max-h-[calc(100dvh-3rem)]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(42,42,90,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(42,42,90,0.18)_1px,transparent_1px)] bg-[size:28px_28px] opacity-60" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#74b9ff] via-[#a29bfe] to-[#55efc4]" />
        <div className={`text-center ${hideIcon ? "mb-5 [@media(min-height:901px)]:mb-8" : "mb-6 [@media(min-height:901px)]:mb-10"}`}>
          {!hideIcon ? (
            <div className={`relative mb-4 inline-block rounded-[28px] border border-white/10 p-4 text-white shadow-2xl [@media(min-height:901px)]:mb-6 [@media(min-height:901px)]:rounded-[40px] [@media(min-height:901px)]:p-6 ${iconToneClass}`}>
              <span className="text-4xl [@media(min-height:901px)]:text-6xl">{icon}</span>
            </div>
          ) : null}
          <span className={`mb-2 block text-[12px] font-black uppercase tracking-[0.4em] ${badgeToneClass}`}>
            {badgeText}
          </span>
          <div className="relative px-2 py-1">
            <h2 className="text-2xl font-black tracking-tighter text-white [@media(min-height:901px)]:text-4xl">{title}</h2>
            <p className="mt-2 font-bold text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="relative">{children}</div>

        <div className="relative space-y-2 [@media(min-height:901px)]:space-y-3">
          <button
            onClick={onPrimary}
            className={`h-12 w-full rounded-[20px] text-base font-black text-white shadow-xl transition-transform active:scale-95 [@media(min-height:901px)]:h-16 [@media(min-height:901px)]:rounded-[24px] [@media(min-height:901px)]:text-lg ${primaryButtonClass}`}
          >
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              onClick={onSecondary}
              className={`flex h-12 w-full items-center justify-center rounded-[20px] text-sm font-black transition-all [@media(min-height:901px)]:h-16 [@media(min-height:901px)]:rounded-[24px] ${secondaryButtonClass}`}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>

        {footerNote ? (
          <div className="relative flex justify-center pt-4 [@media(min-height:901px)]:pt-6">
            <p className="w-fit text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              {footerNote}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
