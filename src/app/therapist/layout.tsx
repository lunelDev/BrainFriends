import { cookies } from "next/headers";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
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
        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-sky-600">
                치료사 콘솔
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                사용자 흐름은 단순하게 두고, 해석과 운영은 여기서 진행합니다.
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                치료사 화면은 사용자 화면과 분리된 운영 공간입니다. 사용자 조회, 결과 검토,
                측정 품질 확인, V&V 및 보안 점검 같은 후속 작업을 이 화면에서 처리합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                      현재 관리자
                    </span>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
                      치료사 화면 미리보기
                    </span>
                  </div>
                  <Link
                    href="/select-page/mode"
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700 transition hover:bg-indigo-100"
                  >
                    사용자 화면
                  </Link>
                  <Link
                    href="/therapist"
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    치료사 화면
                  </Link>
                </>
              ) : null}
              <Link
                href="/tools/admin-reports"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700"
              >
                관리자 리포트
              </Link>
              <Link
                href="/tools/training-usage-admin"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
              >
                사용량 관리
              </Link>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <TherapistShellNav />
          </div>
        </section>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
