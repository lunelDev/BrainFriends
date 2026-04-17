"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LineChart, Sparkles, Target, Trophy } from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SessionManager, type TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

function formatAq(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(1);
}

function formatDate(value?: number | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildStreak(entries: TrainingHistoryEntry[]) {
  if (!entries.length) return 0;
  const uniqueDays = Array.from(
    new Set(
      entries
        .map((entry) => new Date(entry.completedAt).toISOString().slice(0, 10))
        .sort()
        .reverse(),
    ),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of uniqueDays) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1);
      const previousExpected = cursor.toISOString().slice(0, 10);
      if (day === previousExpected) {
        streak += 1;
      }
    }
    break;
  }

  return streak;
}

function getNextGoal(latestAq: number | null | undefined) {
  const aq = Number(latestAq);
  if (!Number.isFinite(aq)) return "첫 결과를 만들어 보세요";
  if (aq < 70) return "AQ 70점 이상 달성";
  if (aq < 85) return `AQ ${Math.max(85, Math.ceil(aq + 3))}점 목표`;
  return "측정 품질을 유지하며 꾸준히 훈련";
}

function getTrainingModeLabel(entry: TrainingHistoryEntry) {
  if (entry.trainingMode === "rehab") {
    return `언어 재활${entry.rehabStep ? ` · Step ${entry.rehabStep}` : ""}`;
  }
  if (entry.trainingMode === "sing") return "브레인 노래방";
  return "자가 진단";
}

export default function MyPage() {
  const { patient, isLoading } = useTrainingSession();
  const [activeView, setActiveView] = useState<"history" | "report">("history");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<TrainingHistoryEntry[]>([]);

  useEffect(() => {
    if (!patient) {
      setHistoryEntries([]);
      return;
    }

    let cancelled = false;
    const localRows = SessionManager.getHistoryFor(patient).sort(
      (a, b) => b.completedAt - a.completedAt,
    );

    setHistoryEntries(localRows);

    void fetch("/api/history/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed_to_load_server_history");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const serverRows = Array.isArray(payload?.entries)
          ? (payload.entries as TrainingHistoryEntry[])
          : [];
        if (serverRows.length > 0) {
          setHistoryEntries(
            [...serverRows].sort((a, b) => b.completedAt - a.completedAt),
          );
        }
      })
      .catch(() => {
        // 로컬 기록을 이미 먼저 반영했으므로 조용히 유지
      });

    return () => {
      cancelled = true;
    };
  }, [patient]);

  const latest = historyEntries[0] ?? null;
  const aqTrend = useMemo(
    () => (patient ? SessionManager.getAQTrendFor(patient) : null),
    [patient],
  );
  const streakDays = useMemo(() => buildStreak(historyEntries), [historyEntries]);
  const nextGoal = useMemo(
    () => getNextGoal(aqTrend?.latest?.aq ?? latest?.aq ?? null),
    [aqTrend?.latest?.aq, latest?.aq],
  );
  const selectedEntry = useMemo(() => {
    if (!historyEntries.length) return null;
    if (!selectedHistoryId) return historyEntries[0] ?? null;
    return (
      historyEntries.find((entry) => entry.historyId === selectedHistoryId) ??
      historyEntries[0] ??
      null
    );
  }, [historyEntries, selectedHistoryId]);

  useEffect(() => {
    if (!historyEntries.length) {
      setSelectedHistoryId(null);
      return;
    }
    if (!selectedHistoryId) {
      setSelectedHistoryId(historyEntries[0]?.historyId ?? null);
      return;
    }
    const exists = historyEntries.some((entry) => entry.historyId === selectedHistoryId);
    if (!exists) {
      setSelectedHistoryId(historyEntries[0]?.historyId ?? null);
    }
  }, [historyEntries, selectedHistoryId]);

  if (isLoading) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center overflow-y-auto bg-[#f5f7fb] px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-indigo-500">
            내 재활 관리
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            사용자 정보를 불러오는 중입니다.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f6f8fc_0%,#eef5ff_100%)] px-4 py-6 pb-12 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">
                {patient?.name ?? "사용자"}님의 현재 기록
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                최근 결과와 훈련 흐름을 한 번에 확인하고, 다음 훈련으로 바로 이어갈 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/select-page/mode"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                홈으로
              </Link>
              <button
                type="button"
                onClick={() => setActiveView("report")}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${
                  activeView === "report"
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                결과 리포트 보기
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            label="최근 AQ"
            value={formatAq(aqTrend?.latest?.aq ?? latest?.aq ?? null)}
            hint={
              aqTrend?.delta == null
                ? "비교 기록 없음"
                : `${aqTrend.delta >= 0 ? "+" : ""}${aqTrend.delta.toFixed(1)}`
            }
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
            label="총 훈련 기록"
            value={`${historyEntries.length}건`}
            hint="누적 저장 기준"
          />
          <StatCard
            icon={<LineChart className="h-5 w-5 text-rose-500" />}
            label="연속 훈련"
            value={`${streakDays}일`}
            hint="꾸준히 이어가고 있어요"
          />
          <StatCard
            icon={<Target className="h-5 w-5 text-sky-500" />}
            label="다음 목표"
            value={nextGoal}
            hint="지금 필요한 다음 단계"
            compact
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">
              {activeView === "report" ? "결과 리포트" : "최근 훈련 기록"}
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {activeView === "report"
                ? "마이페이지 안에서 최근 결과를 바로 확인하세요."
                : "최근 저장된 결과를 확인하세요."}
            </h2>
            {activeView === "report" ? (
              <div className="mt-6 space-y-4">
                {!selectedEntry ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6">
                    <p className="text-base font-black text-slate-900">
                      아직 확인할 결과 리포트가 없습니다.
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      먼저 훈련을 진행하고 결과를 저장해 보세요.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <ReportMetricCard
                        label="훈련 유형"
                        value={getTrainingModeLabel(selectedEntry)}
                      />
                      <ReportMetricCard
                        label="AQ"
                        value={formatAq(selectedEntry.aq)}
                      />
                      <ReportMetricCard
                        label="측정 품질"
                        value={
                          selectedEntry.measurementQuality?.overall ?? "demo"
                        }
                      />
                      <ReportMetricCard
                        label="완료일"
                        value={formatDate(selectedEntry.completedAt)}
                      />
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-black text-slate-900">
                        현재 결과 요약
                      </p>
                      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                        AQ {formatAq(selectedEntry.aq)}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                        {getTrainingModeLabel(selectedEntry)} 결과입니다. 측정 품질은{" "}
                        {selectedEntry.measurementQuality?.overall ?? "demo"}이며,
                        다음 목표는 {getNextGoal(selectedEntry.aq)}입니다.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-900">
                          다른 결과 보기
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveView("history")}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          기록 목록으로
                        </button>
                      </div>
                      {historyEntries.slice(0, 5).map((entry) => {
                        const isSelected = entry.historyId === selectedEntry.historyId;
                        return (
                          <button
                            key={entry.historyId}
                            type="button"
                            onClick={() => setSelectedHistoryId(entry.historyId)}
                            className={`flex w-full items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            <div>
                              <p className="text-sm font-black">
                                {getTrainingModeLabel(entry)}
                              </p>
                              <p
                                className={`mt-1 text-xs font-bold ${
                                  isSelected ? "text-slate-200" : "text-slate-500"
                                }`}
                              >
                                {formatDate(entry.completedAt)} · AQ {formatAq(entry.aq)}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {!historyEntries.length ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6">
                  <p className="text-base font-black text-slate-900">
                    아직 저장된 훈련 기록이 없습니다.
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                    자가진단이나 재활 훈련을 먼저 시작해 보세요.
                  </p>
                </div>
              ) : (
                historyEntries.slice(0, 5).map((entry) => (
                  <div
                    key={entry.historyId}
                    className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-lg font-black text-slate-900">
                        {entry.trainingMode === "rehab"
                          ? `언어 재활${entry.rehabStep ? ` · Step ${entry.rehabStep}` : ""}`
                          : entry.trainingMode === "sing"
                            ? "브레인 노래방"
                            : "자가 진단"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-600">
                        {formatDate(entry.completedAt)} · AQ {formatAq(entry.aq)}
                      </p>
                    </div>
                    <Link
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setSelectedHistoryId(entry.historyId);
                        setActiveView("report");
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                    >
                      결과 보기
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))
                )}
              </div>
            )}
          </article>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">
                빠른 이동
              </p>
              <div className="mt-4 grid gap-3">
                <QuickLink href="/select-page/self-assessment" label="자가진단 다시 하기" />
                <QuickLink href="/select-page/speech-rehab" label="언어 재활 시작" />
                <QuickLink href="/select-page/sing-training" label="브레인 노래방 시작" />
                <QuickLink href="/select-page/game-mode" label="게임 모드 열기" />
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,#f7fbff_0%,#eef6ff_100%)] p-6 shadow-sm sm:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">
                진행 메모
              </p>
              <div className="mt-4 grid gap-3">
                <SummaryRow label="최근 결과" value={latest ? `${formatDate(latest.completedAt)} · AQ ${formatAq(latest.aq)}` : "기록 없음"} />
                <SummaryRow label="다음 목표" value={nextGoal} />
                <SummaryRow label="연속 훈련" value={`${streakDays}일`} />
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50">
        {icon}
      </div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 font-black tracking-tight text-slate-950 ${
          compact ? "text-lg" : "text-3xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function ReportMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[20px] border border-sky-100 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-500" />
    </Link>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-sky-100 bg-white px-4 py-3">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}
