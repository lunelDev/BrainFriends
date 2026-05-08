"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mypage");
  }, [router]);
  return (
    <div className="p-6 text-sm font-medium text-slate-600">
      마이페이지로 이동 중...
    </div>
  );
}
