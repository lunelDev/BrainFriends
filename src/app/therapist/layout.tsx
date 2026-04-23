import { cookies } from "next/headers";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { TherapistLogoutButton } from "./_components/TherapistLogoutButton";
import { TherapistShellNav } from "./_components/TherapistShellNav";

export default async function TherapistLayout({
  children,
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

        {/*
          관리자일 때만 운영 토글/관리자 진입/사용량 관리 버튼과 nav 카드가 노출된다.
          치료사는 본문(종합 대시보드)으로 바로 진입하므로 헤더 카드 자체를 생략.
        */}
        {isAdmin ? (
          <section className="rounded-[32px] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur sm:p-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                관리자 모드
              </span>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                <Link
                  href="/select-page/mode"
                  className="rounded-full px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-white"
                >
                  사용자 화면
                </Link>
                <Link
                  href="/therapist"
                  className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-indigo-700"
                >
                  치료사 화면
                </Link>
              </div>
              <Link
                href="/admin"
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 transition hover:bg-sky-100"
              >
                관리자 화면
              </Link>
              <Link
                href="/tools/training-usage-admin"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-100"
              >
                사용량 관리
              </Link>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <TherapistShellNav isAdmin={isAdmin} />
            </div>
          </section>
        ) : null}

        <div className={isAdmin ? "mt-6" : ""}>{children}</div>
      </div>
    </main>
  );
}
