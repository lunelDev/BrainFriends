// src/app/admin/prescriptions/page.tsx
//
// 관리자용 임시 처방 생성 페이지.
// DTx 정식 "의사 포털(/prescriber/*)" 은 Phase 2 로 분리할 예정이고,
// 그 전까지 로컬 QA 용으로 이 페이지에서 직접 처방을 발급한다.
//
// Server component 에서 세션/역할만 검증하고, 실제 입력 UI 는 client.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { PrescriptionCreateForm } from "./PrescriptionCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminPrescriptionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) redirect("/");
  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx || (ctx.userRole !== "admin" && ctx.userRole !== "prescriber")) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              DTx 처방 · 임시 발급
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              처방 생성
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              환자의 user ID 와 pseudonym ID 를 입력하면 처방 코드(8자리)를 발급합니다.
              환자는 마이페이지에서 코드 입력으로 활성화합니다.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            ← 관리자 홈
          </Link>
        </header>

        <PrescriptionCreateForm />
      </div>
    </main>
  );
}
