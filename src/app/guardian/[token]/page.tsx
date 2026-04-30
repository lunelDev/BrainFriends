import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getGuardianWeeklyReportByToken } from "@/lib/server/guardianReportsDb";

type PageProps = {
  params: Promise<{ token: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function GuardianWeeklyReportPage({ params }: PageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost";
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const auditRequest = new Request(
    `${proto}://${host}/guardian/${encodeURIComponent(token)}`,
    { headers: headerStore },
  );
  const report = await getGuardianWeeklyReportByToken(token, { request: auditRequest });
  if (!report) notFound();

  const summary = report.summary;
  const stepLabels: Record<string, string> = {
    step1: "초기",
    step2: "따라말하기",
    step3: "이해",
    step4: "문장",
    step5: "읽기",
    step6: "쓰기",
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
            Weekly Guardian Report
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black">보호자 주간 리포트</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {report.patient.maskedName}님 · {formatDate(summary.periodStart)} -{" "}
                {formatDate(summary.periodEnd)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-bold text-slate-500">링크 만료</p>
              <p className="mt-1 text-sm font-black text-slate-800">
                {formatDate(report.expiresAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ["총 훈련", `${summary.totalSessions}회`],
            ["최신 AQ", summary.latestAq == null ? "-" : `${summary.latestAq}`],
            [
              "AQ 변화",
              summary.aqChange == null
                ? "-"
                : `${summary.aqChange > 0 ? "+" : ""}${summary.aqChange}`,
            ],
            [
              "이상반응",
              summary.adverseEventStatus === "none_reported"
                ? "보고 없음"
                : `${summary.adverseEventCount}건`,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black">단계별 완료율</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Object.entries(summary.stepCompletion).map(([step, ratio]) => (
              <div key={step} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">
                    {stepLabels[step] ?? step}
                  </span>
                  <span className="font-black text-slate-900">{percent(ratio)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-600"
                    style={{ width: percent(ratio) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black">최근 훈련</h2>
            <p className="text-xs font-semibold text-slate-500">
              생성 {formatDateTime(report.generatedAt)}
            </p>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {report.recentSessions.length ? (
              report.recentSessions.map((session, index) => (
                <div
                  key={`${session.completedAt}-${index}`}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <p className="text-sm font-black">
                      {session.kind === "language" ? "언어 훈련" : "노래 훈련"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatDateTime(session.completedAt)}
                    </p>
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    {session.score == null ? "-" : `${session.score}점`}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm font-semibold text-slate-500">
                이번 주 기록된 훈련이 없습니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
