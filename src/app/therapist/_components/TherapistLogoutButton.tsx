"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
