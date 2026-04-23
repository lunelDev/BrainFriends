"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

/**
 * 치료사 화면 헤더의 로그아웃 버튼.
 * 시각적 무게를 줄여 헤더 우측 상단에 아이콘 + 작은 라벨 형태로 배치한다.
 */
export function TherapistLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={logout}
      disabled={isLoggingOut}
      title="로그아웃"
      aria-label="로그아웃"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
    </button>
  );
}
