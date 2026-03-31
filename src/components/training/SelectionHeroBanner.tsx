"use client";

import type { ReactNode } from "react";

type SelectionHeroBannerProps = {
  badge: string;
  title: string;
  description: string;
  accentClassName: string;
  icon?: ReactNode;
  footerAction?: ReactNode;
};

export default function SelectionHeroBanner({
  badge,
  title,
  description,
  accentClassName,
  icon,
  footerAction,
}: SelectionHeroBannerProps) {
  return (
    <section
      className={`rounded-[28px] border p-6 sm:p-8 lg:p-10 text-white shadow-xl mb-6 sm:mb-8 bg-gradient-to-br ${accentClassName}`}
    >
      <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]">
        {icon}
        {badge}
      </p>
      <h2 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight leading-none">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-3xl text-sm sm:text-base text-white/85 leading-relaxed">
          {description}
        </p>
        {footerAction ? (
          <div className="shrink-0 sm:self-end">{footerAction}</div>
        ) : null}
      </div>
    </section>
  );
}
