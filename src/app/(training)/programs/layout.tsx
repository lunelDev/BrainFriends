// src/app/(training)/programs/layout.tsx
//
// DTx 처방 게이트 (서버 레이아웃).
// /programs/* 하위로 진입하는 환자는 활성 처방이 있어야만 통과.
// 관리자/치료사/처방자 계정은 기존 테스트 흐름 보존을 위해 우회.
//
// 왜 여기에 넣었는가:
// - src/proxy.ts 는 edge runtime 이라 DB 조회 불가 → 세션 존재 여부만 체크.
// - 처방 유효성은 DB 가 필요하므로 Next.js 서버 레이아웃에서 처리.
// - 기존 (training)/layout.tsx 는 "use client" 라 수정 금지. 새 child layout
//   으로 추가해서 패턴을 보존한다.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { getActivePrescriptionForPatient } from "@/lib/server/prescriptionsDb";

export const dynamic = "force-dynamic";

export default async function ProgramsGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/");
  }

  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx) {
    redirect("/");
  }

  // 관리자/치료사/처방자 는 처방 없이도 통과 (QA/테스트/시연).
  // NODE_ENV=development 에서도 동일하게 통과시키지 않고 환자 흐름을 그대로 검증할 수
  // 있도록, 오직 role 로만 판정한다.
  if (
    ctx.userRole === "admin" ||
    ctx.userRole === "therapist" ||
    ctx.userRole === "prescriber"
  ) {
    return <>{children}</>;
  }

  // 환자: 활성 처방 필수
  let rx: Awaited<ReturnType<typeof getActivePrescriptionForPatient>> = null;
  try {
    rx = await getActivePrescriptionForPatient(ctx.userId);
  } catch (err) {
    // DB 장애 시에도 치료를 완전히 막지 않도록 개발 편의 bypass.
    // 운영에서는 DB 장애 = 처방 확인 불가 = 차단이 원칙이지만,
    // 테이블 미적용(로컬) 상황에서 전체가 막히면 개발이 불가능하므로
    // 테이블 부재 에러만 조용히 통과시킨다.
    const message = err instanceof Error ? err.message : "";
    if (/relation .+ does not exist/i.test(message)) {
      console.warn("[programs-gate] prescriptions table not yet applied — bypassing");
      return <>{children}</>;
    }
    throw err;
  }

  if (!rx) {
    redirect("/mypage?prescription=required");
  }
  if (rx.expiresAt.getTime() <= Date.now()) {
    redirect("/mypage?prescription=expired");
  }

  return <>{children}</>;
}
