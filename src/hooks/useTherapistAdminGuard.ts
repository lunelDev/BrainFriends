// src/hooks/useTherapistAdminGuard.ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";

/**
 * 치료사 콘솔 안의 운영/품질 관리 화면(`/therapist/patients`,
 * `/therapist/results`, `/therapist/system` 등) 에서 사용한다.
 * 세션 로딩이 끝났을 때 `userRole !== "admin"` 이면 종합 대시보드로 돌려보낸다.
 *
 * 서버 측 라우트(/therapist/system 등) 에서는 redirect() 를 직접 사용하면 되고,
 * 클라이언트 컴포넌트 페이지에서는 이 훅을 호출하면 된다.
 */
export function useTherapistAdminGuard(): {
  isReady: boolean;
  isAdmin: boolean;
} {
  const router = useRouter();
  const { patient, isLoading } = useTrainingSession();

  const role = patient?.userRole;
  const isAdmin = role === "admin";

  useEffect(() => {
    if (isLoading) return;
    // 세션 로딩이 끝났는데 admin 이 아니면 종합 대시보드로 돌려보낸다.
    if (!isAdmin) {
      router.replace("/therapist");
    }
  }, [isLoading, isAdmin, router]);

  return { isReady: !isLoading, isAdmin };
}
