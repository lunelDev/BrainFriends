import type { ReactNode } from "react";
import Link from "next/link";
import { TherapistShellNav } from "./_components/TherapistShellNav";

export default function TherapistLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f7fb_0%,#eef4ff_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-sky-600">
                Therapist Console
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                User flow stays simple. Clinical review lives here.
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                This shell separates therapist work from the user journey.
                Use it for user lookup, result review, quality checks, and
                system-level follow-up.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/tools/admin-reports"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700"
              >
                Open Admin Reports
              </Link>
              <Link
                href="/tools/training-usage-admin"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Open Usage Admin
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
