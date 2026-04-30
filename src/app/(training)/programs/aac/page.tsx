// src/app/(training)/programs/aac/page.tsx
//
// AAC 훈련 라우트. /programs/aac.
// 처방 게이트는 부모 레이아웃 (programs/layout.tsx) 이 담당.
// 본 페이지는 AACBoard 를 렌더하고 commit 시 /api/aac/intent 로 전송한다.

"use client";

import React, { useCallback, useState } from "react";
import AACBoard from "@/components/aac/AACBoard";
import type { PlaceType } from "@/constants/trainingData";

type SubmitState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; sentence: string }
  | { kind: "error"; message: string };

export default function AacProgramPage() {
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const handleCommit = useCallback(
    async (payload: { place: PlaceType; symbolIds: string[]; sentence: string }) => {
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4">
        <h1 className="text-xl font-black text-[#0B1A3A]">AAC 의사 표현</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          말하기 어려운 경우 심볼을 골라 의사를 표현해 보세요. 장소 탭을 바꾸면 그
          상황에 맞는 어휘가 보입니다.
        </p>
      </div>

      <AACBoard onCommit={handleCommit} />

      <div className="mt-4 min-h-[2em] text-[13px]" role="status" aria-live="polite">
        {submit.kind === "saving" && (
          <span className="text-slate-500">전송 중...</span>
        )}
        {submit.kind === "saved" && (
          <span className="font-bold text-emerald-600">
            전송 완료 — &ldquo;{submit.sentence}&rdquo;
          </span>
        )}
        {submit.kind === "error" && (
          <span className="font-bold text-rose-600">오류: {submit.message}</span>
        )}
      </div>
    </div>
  );
}
