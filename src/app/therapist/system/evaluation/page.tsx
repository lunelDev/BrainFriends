import Link from "next/link";
import { getEvaluationSamplesSummary } from "@/lib/server/evaluationSamplesDb";

function formatDateTime(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSigned(value: number, digits = 1) {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

export default async function TherapistEvaluationSystemPage() {
  const summary = await getEvaluationSamplesSummary();

  return (
    <section className="space-y-6">
      <article className="rounded-[32px] border border-violet-200 bg-gradient-to-r from-violet-600 to-fuchsia-600 p-6 text-white shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-100">
          AI Evaluation Ops
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
          measured-only 평가셋 운영 상태와 버전 비교를 확인합니다.
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-violet-50/90">
          dataset version, model version, analysis version 조합별 샘플 수와 평균 지표를
          비교해 공인평가용 데이터셋 운영 상태를 점검합니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/therapist/system"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-violet-700 transition hover:bg-violet-50"
          >
            시스템 개요로 돌아가기
          </Link>
        </div>
      </article>

      <section className="grid gap-4 lg:grid-cols-4">
        <MetricCard
          label="전체 샘플"
          value={String(summary.totalCount)}
          note="ai_evaluation_samples 기준"
        />
        <MetricCard
          label="measured 샘플"
          value={String(summary.measuredCount)}
          note="공식 평가 진입 가능 샘플"
        />
        <MetricCard
          label="버전 조합"
          value={String(summary.versions.length)}
          note="dataset / model / analysis"
        />
        <MetricCard
          label="최근 적재"
          value={formatDateTime(summary.latestCapturedAt)}
          note="latest captured_at"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Version Comparison
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                버전 조합별 샘플/평균 지표
              </h3>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-3 py-2">Dataset</th>
                  <th className="px-3 py-2">Model / Analysis</th>
                  <th className="px-3 py-2">샘플</th>
                  <th className="px-3 py-2">발음</th>
                  <th className="px-3 py-2">자음</th>
                  <th className="px-3 py-2">모음</th>
                  <th className="px-3 py-2">추적</th>
                  <th className="px-3 py-2">최근 적재</th>
                </tr>
              </thead>
              <tbody>
                {summary.versions.length ? (
                  summary.versions.map((version) => (
                    <tr
                      key={`${version.evaluationDatasetVersion}-${version.modelVersion}-${version.analysisVersion}`}
                      className="rounded-2xl bg-slate-50 text-sm font-medium text-slate-700"
                    >
                      <td className="rounded-l-2xl px-3 py-3 font-black text-slate-900">
                        {version.evaluationDatasetVersion}
                      </td>
                      <td className="px-3 py-3">
                        model {version.modelVersion}
                        <br />
                        <span className="text-xs text-slate-500">
                          analysis {version.analysisVersion}
                        </span>
                      </td>
                      <td className="px-3 py-3">{version.sampleCount}</td>
                      <td className="px-3 py-3">{version.avgPronunciationScore.toFixed(1)}</td>
                      <td className="px-3 py-3">{version.avgConsonantAccuracy.toFixed(1)}</td>
                      <td className="px-3 py-3">{version.avgVowelAccuracy.toFixed(1)}</td>
                      <td className="px-3 py-3">{version.avgTrackingQuality.toFixed(2)}</td>
                      <td className="rounded-r-2xl px-3 py-3">
                        {formatDateTime(version.latestCapturedAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm font-medium text-slate-500">
                      아직 적재된 평가셋 버전 정보가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Latest Delta
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              최근 두 버전 비교
            </h3>
            {summary.latestVersionComparison ? (
              <div className="mt-5 space-y-3 text-sm font-medium text-slate-700">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                  <p className="font-black text-slate-900">
                    현재 {summary.latestVersionComparison.current.evaluationDatasetVersion}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    model {summary.latestVersionComparison.current.modelVersion} · analysis{" "}
                    {summary.latestVersionComparison.current.analysisVersion}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DeltaCard label="샘플 변화" value={formatSigned(summary.latestVersionComparison.sampleDelta, 0)} />
                  <DeltaCard
                    label="발음 변화"
                    value={formatSigned(summary.latestVersionComparison.pronunciationDelta)}
                  />
                  <DeltaCard
                    label="자음 변화"
                    value={formatSigned(summary.latestVersionComparison.consonantDelta)}
                  />
                  <DeltaCard
                    label="모음 변화"
                    value={formatSigned(summary.latestVersionComparison.vowelDelta)}
                  />
                  <DeltaCard
                    label="추적 변화"
                    value={formatSigned(summary.latestVersionComparison.trackingDelta, 2)}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
                비교할 두 개 이상의 버전 조합이 아직 없습니다.
              </p>
            )}
          </article>

          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Breakdown
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">모드/품질 분포</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Training Mode
                </p>
                <div className="mt-3 space-y-2">
                  {summary.modeBreakdown.map((item) => (
                    <div key={item.trainingMode} className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>{item.trainingMode}</span>
                      <span className="font-black text-slate-900">{item.sampleCount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Quality
                </p>
                <div className="mt-3 space-y-2">
                  {summary.qualityBreakdown.map((item) => (
                    <div key={item.quality} className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>{item.quality}</span>
                      <span className="font-black text-slate-900">{item.sampleCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function DeltaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
