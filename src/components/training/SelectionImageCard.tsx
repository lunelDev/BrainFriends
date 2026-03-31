"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type SelectionImageCardProps = {
  title: string;
  description: string;
  badge: string;
  ctaLabel: string;
  imagePath: string;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  topLeft?: ReactNode;
  footerMeta?: string;
  imagePosition?: string;
  imageFilter?: string;
  onClick?: () => void;
  href?: string;
};

function SelectionImageCardInner({
  title,
  description,
  badge,
  ctaLabel,
  imagePath,
  overlayClassName,
  overlayStyle,
  topLeft,
  footerMeta,
  imagePosition,
  imageFilter,
}: Omit<SelectionImageCardProps, "onClick" | "href">) {
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{
          backgroundImage: `url(${imagePath})`,
          backgroundPosition: imagePosition,
          filter: imageFilter,
        }}
      />
      <div
        className={`absolute inset-0 opacity-55 group-hover:opacity-65 transition-opacity duration-500 ${overlayClassName ?? ""}`}
        style={overlayStyle}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

      {topLeft ? <div className="absolute left-4 top-4 sm:left-5 sm:top-5 z-10">{topLeft}</div> : null}

      <div className="relative h-full p-4 sm:p-5 flex flex-col justify-end items-start text-left z-10">
        <span className="px-2.5 py-1 bg-white/15 backdrop-blur-md rounded-full text-[9px] font-black text-white uppercase tracking-widest mb-1.5 border border-white/20">
          {badge}
        </span>
        <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white mb-1.5 drop-shadow-md leading-none tracking-tight">
          {title}
        </h3>
        <p className="text-white/90 font-medium text-[11px] sm:text-xs lg:text-sm leading-relaxed mb-3 drop-shadow-sm max-w-[24rem]">
          {description}
        </p>
        <div className="w-full flex items-center justify-between gap-2 bg-white/95 px-3.5 py-2 rounded-xl shadow-md group-hover:bg-slate-50 transition-colors">
          <span className="text-xs font-black text-slate-900 truncate">
            {ctaLabel}
          </span>
          <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
            <ChevronRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>

      {footerMeta ? (
        <div className="absolute right-4 sm:right-5 bottom-[60px] sm:bottom-[66px] z-10 text-[10px] sm:text-[11px] font-bold text-white/80">
          {footerMeta}
        </div>
      ) : null}

      <div className="absolute inset-0 border-[3px] border-white/0 group-hover:border-white/35 rounded-[28px] transition-all duration-500 pointer-events-none" />
    </>
  );
}

export default function SelectionImageCard(props: SelectionImageCardProps) {
  const sharedClassName =
    "group relative w-full min-h-[180px] sm:min-h-[210px] lg:min-h-[220px] aspect-[2/1] rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-slate-300/40";

  if (props.href) {
    return (
      <Link href={props.href} className={sharedClassName}>
        <SelectionImageCardInner {...props} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={sharedClassName}>
      <SelectionImageCardInner {...props} />
    </button>
  );
}
