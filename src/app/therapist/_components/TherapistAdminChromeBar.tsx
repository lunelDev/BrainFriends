"use client";

import Link from "next/link";

/**
 * admin 계정으로 로그인했을 때 상단에 얇게 고정되는 관리자 진입용 헤더.
 *
 * 정책: admin 도 /therapist / /select-page/mode 에서는 실제 치료사·환자와
 * 동일한 본문을 보고, 관리자 콘솔로 돌아가는 경로만 이 상단 바로 제공한다.
 * - 화면 맨 위에 sticky 로 붙는 단 한 줄
 * - admin 이 아니면 렌더 안 함
 * - 본문 레이아웃엔 영향 없음 (고정 높이 한 줄)
 */
export function TherapistAdminChromeBar({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-2 text-white sm:px-6">
      <div className="flex items-center gap-2 text-[11px] font-black sm:text-xs">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        관리자 계정으로 로그인됨
      </div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black text-white transition hover:bg-white/25 sm:text-xs"
      >
        관리자 화면으로 이동 →
      </Link>
    </div>
  );
}
