"use client";

import React, { useState } from "react";

export default function MonitoringDock({
  camera,
  dashboard,
}: {
  camera: React.ReactNode;
  dashboard: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ✅ 항상 보이는 작은 도킹 바 (우하단) */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        <button
          className="rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg bg-[#0B1A3A] hover:bg-[#09152f] transition-colors"
          onClick={() => setOpen(true)}
        >
          모니터링 보기
        </button>
      </div>

      {/* ✅ 오버레이 + 패널 */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* panel */}
          <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-[900px] rounded-t-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-bold">모니터링 & 성능 지표</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  학습 진행 확인용(보조) — 센서 연동 전까지 Mock 데이터
                </p>
              </div>
              <button
                className="rounded-xl px-3 py-2 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                onClick={() => setOpen(false)}
              >
                닫기
              </button>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                {camera}
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                {dashboard}
              </div>
            </div>

            <div className="px-4 pb-5 text-[11px] text-neutral-500">
              * 본 화면의 결과는 자동 판정이 아닌 판단 보조용이며, 의료진/전문가의
              임상 판단을 대체하지 않습니다.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
