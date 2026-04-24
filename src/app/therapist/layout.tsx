import { cookies } from "next/headers";
import type { ReactNode } from "react";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { TherapistLogoutButton } from "./_components/TherapistLogoutButton";
import { TherapistAdminChromeBar } from "./_components/TherapistAdminChromeBar";

export default async function TherapistLayout({
  children,
  // Next.js App Router 는 layout 에 searchParams 를 전달하지 않는다.
  // 그래서 layout 자체에서 ?as=therapist 를 직접 읽을 수는 없고,
  // 대신 children 쪽(page.tsx) 이 preview 상태를 띠로 그리고,
  // layout 의 admin chrome 은 cookie 기반 isAdmin 으로만 판정한다.
  // 여기서는 admin chrome 안의 토글 링크에 ?as=* 쿼리를 달아주기만 해서
  // admin 이 토글 누를 때 즉시 preview 모드로 들어가게 만든다.
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const context = token
    ? await getAuthenticatedSessionContext(token).catch(() => null)
    : null;
  const isAdmin = context?.userRole === "admin";

  return (
    <>
      {/* admin 전용 sticky 상단 바 — 본문 바깥(전역 width) 에서 sticky top-0 로 고정.
          admin 이 아니면 렌더되지 않아 치료사 UI 에 영향 없음. */}
      <TherapistAdminChromeBar isAdmin={isAdmin} />

      <main className="min-h-screen bg-[linear-gradient(180deg,#f5f7fb_0%,#eef4ff_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {/*
            페이지 최상단의 글로벌 액션 바.
            - 헤더 카드 위(페이지 가장 윗줄)에 로그아웃 버튼만 우측 정렬로 노출한다.
            - 헤더 카드 안에 끼워넣지 않아 시각 노이즈가 줄고, 항상 같은 위치에서 접근 가능.
          */}
          <div className="mb-3 flex justify-end">
            <TherapistLogoutButton />
          </div>

          <div>{children}</div>
        </div>
      </main>
    </>
  );
}
