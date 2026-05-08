// src/app/(training)/select-page/aac/page.tsx
//
// AAC (보완대체 의사소통) 보조 채널 진입 페이지.
//
// 왜 select-page 하위에 두는가:
//   - /programs/aac 는 처방 게이트(programs/layout.tsx) 통과가 필요해서
//     처방을 받지 못한 환자/보호자가 보조 도구로 AAC 를 켤 수 없다.
//   - XR 프리뷰가 같은 이유로 /select-page/xr 별도 라우트를 가진 패턴을 따랐다.
//   - 보호 라우팅은 src/proxy.ts 의 /select-page 매칭으로 자동 적용된다.
//
// commit 흐름은 /programs/aac 와 동일하게 /api/aac/intent 로 보낸다.
// 본 페이지는 AACBoard 의 라우팅/저장 후처리만 담당한다.

"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import AACBoard from "@/components/aac/AACBoard";
import type { PlaceType } from "@/constants/trainingData";

type SubmitState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; sentence: string }
  | { kind: "error"; message: string };

export default function AacSelectPage() {
  const router = useRouter();
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const handleCommit = useCallback(
    async (payload: {
      place: PlaceType;
      symbolIds: string[];
      sentence: string;
    }) => {
      setSubmit({ kind: "saving" });
      try {
        const response = await fetch("/api/aac/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `HTTP ${response.status}`);
        }
        setSubmit({ kind: "saved", sentence: payload.sentence });
      } catch (err) {
        setSubmit({
          kind: "error",
          message: err instanceof Error ? err.message : "전송 실패",
        });
      }
    },
    [],
  );

  return (
    <div className="flex h-full min-h-screen flex-col overflow-y-auto bg-[linear-gradient(180deg,#fff7ed_0%,#fef3c7_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="뒤로가기"
              onClick={() => router.push("/select-page/mode")}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-white text-orange-600 transition hover:bg-orange-50"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 6l-6 6 6 6"
                />
              </svg>
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">
                AAC · Communication Aid
              </p>
              <h1 className="text-base font-black text-slate-900 sm:text-lg">
                AAC 의사 표현
              </h1>
            </div>
          </div>
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
            보조 채널
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:py-8 sm:pb-28">
        <section className="mb-4 rounded-2xl border border-orange-200 bg-white/80 p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-800">
            말로 표현하기 어려울 때, 심볼을 골라 의사를 전할 수 있는 보조 채널입니다.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            장소 탭을 바꾸면 그 상황에 맞는 어휘가 보입니다. 주어 → 의도 → 사물 순서로 골라 문장을 만들고
            “이 문장으로 말하기” 를 누르면 보호자/치료사에게 전달됩니다.
          </p>
        </section>

        <AACBoard onCommit={handleCommit} />

        <div
          className="mt-4 min-h-[2em] text-[13px]"
          role="status"
          aria-live="polite"
        >
          {submit.kind === "saving" && (
            <span className="text-slate-500">전송 중...</span>
          )}
          {submit.kind === "saved" && (
            <span className="font-bold text-emerald-600">
              전송 완료 — &ldquo;{submit.sentence}&rdquo;
            </span>
          )}
          {submit.kind === "error" && (
            <span className="font-bold text-rose-600">
              오류: {submit.message}
            </span>
          )}
        </div>

        <p className="mt-6 text-[11px] font-medium leading-relaxed text-slate-500">
          본 화면은 의학적 진단·처방을 대체하지 않는 <b>보조 의사소통 도구</b>입니다.
          정식 재활 훈련은 처방 후 ‘언어 재활’ 또는 ‘노래 훈련’ 모드에서 진행해 주세요.
        </p>
      </main>
    </div>
  );
}
