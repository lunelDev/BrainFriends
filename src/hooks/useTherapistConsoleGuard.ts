// src/hooks/useTherapistConsoleGuard.ts
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";

/**
 * 치료사 콘솔에서 본인 담당 환자 데이터를 보는 화면(`/therapist/patients/[id]` 등) 에서 사용한다.
 * `admin` 또는 `therapist` 역할이면 통과시키고, 그 외에는 종합 대시보드로 돌려보낸다.
 *
 * 환자 단위 데이터 접근 권한은 백엔드(getTherapistPatientReportDetail /
 * listTherapistPatientReportSummaries) 에서 assignment 기준으로 스코핑하므로,
 * 여기서는 "치료사 콘솔에 들어올 자격이 있는 사용자인지" 만 확인한다.
 *
 * (과거의 `/therapist/patients` 목록 화면은 종합 대시보드로 통합되어 별도 가드가 더 이상 필요하지 않다.)
 *
 * admin 전용 운영/품질 화면(`/therapist/results`, `/therapist/system` 등) 에서는
 * 기존 `useTherapistAdminGuard` 를 그대로 사용한다.
 */
export function useTherapistConsoleGuard(): {
  isReady: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
} {
  const router = useRouter();
  const { patient, isLoading } = useTrainingSession();

  const role = patient?.userRole;
  const isAuthorized = role === "admin" || role === "therapist";
  // admin/therapist 양쪽 모두 들어올 수 있는 화면에서 admin 전용 진입점(예: /therapist/results)을
  // 조건부로 노출하기 위해 함께 반환한다. 일반 치료사가 admin 전용 페이지를 누르면
  // useTherapistAdminGuard 가 곧장 /therapist 로 돌려보내 "잠깐 갔다가 돌아오는" 현상이 생기므로
  // 이 플래그로 진입점 자체를 감춘다.
  const isAdmin = role === "admin";

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthorized) {
      router.replace("/therapist");
    }
  }, [isLoading, isAuthorized, router]);

  return { isReady: !isLoading, isAuthorized, isAdmin };
}
