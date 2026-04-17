"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { fetchTherapistReportsOverview } from "@/lib/client/therapistReportsApi";

function formatDate(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMode(entry: TrainingHistoryEntry) {
  if (entry.trainingMode === "rehab") {
    return `재활${entry.rehabStep ? ` Step ${entry.rehabStep}` : ""}`;
  }
  if (entry.trainingMode === "sing") {
    return "노래";
  }
  return "자가진단";
}

function getEntrySaveState(entry: TrainingHistoryEntry) {
  const value = (entry as TrainingHistoryEntry & { dbSaveState?: string }).dbSaveState;
  return value ?? "unknown";
}

export default function TherapistResultsPage() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<TrainingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("query") ?? "");
  const [qualityFilter, setQualityFilter] = useState(
    searchParams.get("quality") ?? "all",
  );
  const [modeFilter, setModeFilter] = useState(searchParams.get("mode") ?? "all");
  const [saveStateFilter, setSaveStateFilter] = useState(
    searchParams.get("saveState") ?? "all",
  );

  useEffect(() => {
    let cancelled = false;

    void fetchTherapistReportsOverview()
      .then((payload) => {
        if (!cancelled) {
          setEntries(payload.validationSampleEntries as TrainingHistoryEntry[]);
        }
      })
      .catch((fetchError) => {
        if (cancelled) return;
        if (
          fetchError instanceof Error &&
          fetchError.message === "forbidden"
        ) {
          setIsForbidden(true);
          return;
        }
        setError("치료사 결과 요약을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSearch(searchParams.get("query") ?? "");
    setQualityFilter(searchParams.get("quality") ?? "all");
    setModeFilter(searchParams.get("mode") ?? "all");
    setSaveStateFilter(searchParams.get("saveState") ?? "all");
  }, [searchParams]);

  const summary = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const quality = entry.measurementQuality?.overall ?? "unknown";
      const saveState = getEntrySaveState(entry);
      const matchesQuery =
        !query ||
        [
          entry.patientName,
          entry.historyId,
          formatMode(entry),
          entry.trainingMode,
          entry.rehabStep != null ? `step ${entry.rehabStep}` : "",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesQuality =
        qualityFilter === "all" || quality === qualityFilter;
      const matchesMode =
        modeFilter === "all" ||
        (modeFilter === "self" && entry.trainingMode === "self") ||
        (modeFilter === "rehab" && entry.trainingMode === "rehab") ||
        (modeFilter === "sing" && entry.trainingMode === "sing");
      const matchesSaveState =
        saveStateFilter === "all" || saveState === saveStateFilter;

      return matchesQuery && matchesQuality && matchesMode && matchesSaveState;
    });

    const recent = filtered.slice(0, 12);
    const measuredCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "measured",
    ).length;
    const partialCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "partial",
    ).length;
    const demoCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "demo",
    ).length;
    const vnvLinkedCount = entries.filter((entry) => entry.vnv?.summary).length;
    const failedCount = entries.filter(
      (entry) => getEntrySaveState(entry) === "failed",
    ).length;
    const savedCount = entries.filter(
      (entry) => getEntrySaveState(entry) === "saved",
    ).length;

    return {
      filtered,
      recent,
      measuredCount,
      partialCount,
      demoCount,
      vnvLinkedCount,
      failedCount,
      savedCount,
    };
  }, [entries, modeFilter, qualityFilter, saveStateFilter, search]);

  const activeFilters = useMemo(() => {
    const items: string[] = [];
    if (search.trim()) items.push(`검색: ${search.trim()}`);
    if (qualityFilter !== "all") {
      items.push(
        `측정 품질: ${
          qualityFilter === "measured"
            ? "측정 완료"
            : qualityFilter === "partial"
              ? "부분 측정"
              : "시연"
        }`,
      );
    }
    if (modeFilter !== "all") {
      items.push(
        `훈련 모드: ${
          modeFilter === "self"
            ? "자가진단"
            : modeFilter === "rehab"
              ? "재활"
              : "노래"
        }`,
      );
    }
    if (saveStateFilter !== "all") {
      items.push(
        `저장 상태: ${
          saveStateFilter === "saved"
            ? "저장 완료"
            : saveStateFilter === "failed"
              ? "저장 실패"
              : "저장 제외"
        }`,
      );
    }
    return items;
  }, [modeFilter, qualityFilter, saveStateFilter, search]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-600">
          측정·안면 분석
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
          최근 결과, 측정 품질, 추적성을 한 번에 검토합니다.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          이 화면에서는 최근 저장 결과 중 어떤 항목이 measured인지, 어떤 결과에 V&amp;V
          메타데이터가 연결됐는지, 어디서부터 후속 검토를 시작해야 하는지를 먼저
          파악합니다.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <SummaryCard label="전체 결과" value={String(entries.length)} />
          <SummaryCard label="현재 표시" value={String(summary.filtered.length)} />
          <SummaryCard label="측정 완료" value={String(summary.measuredCount)} />
          <SummaryCard label="저장 실패" value={String(summary.failedCount)} />
        </div>

        <div className="mt-6 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              검색
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="사용자 이름, 모드, 히스토리 ID"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              측정 품질
            </span>
            <select
              value={qualityFilter}
              onChange={(event) => setQualityFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <option value="all">전체</option>
              <option value="measured">측정 완료</option>
              <option value="partial">부분 측정</option>
              <option value="demo">시연</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              훈련 모드
            </span>
            <select
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <option value="all">전체</option>
              <option value="self">자가진단</option>
              <option value="rehab">재활</option>
              <option value="sing">노래</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              저장 상태
            </span>
            <select
              value={saveStateFilter}
              onChange={(event) => setSaveStateFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <option value="all">전체</option>
              <option value="saved">저장 완료</option>
              <option value="failed">저장 실패</option>
              <option value="skipped">저장 제외</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              현재 필터 상태
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeFilters.length ? (
                activeFilters.map((item) => (
                  <span
                    key={item}
                    className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-sm font-medium text-slate-500">
                  현재 모든 결과를 표시 중입니다.
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setQualityFilter("all");
              setModeFilter("all");
              setSaveStateFilter("all");
            }}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            필터 초기화
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {isForbidden ? (
            <p className="text-sm font-bold text-slate-500">
              현재 이 화면은 치료사 또는 관리자 권한이 필요합니다.
            </p>
          ) : isLoading ? (
            <p className="text-sm font-bold text-slate-500">
              결과 요약을 불러오는 중입니다.
            </p>
          ) : error ? (
            <p className="text-sm font-bold text-red-500">{error}</p>
          ) : !summary.recent.length ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6">
              <p className="text-base font-black text-slate-900">
                현재 필터 조건에 맞는 저장 결과가 없습니다.
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                필터를 초기화하거나, 저장 실패/측정 완료 조건만 따로 확인해 보세요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setQualityFilter("all");
                    setModeFilter("all");
                    setSaveStateFilter("all");
                  }}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                >
                  전체 보기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setQualityFilter("measured");
                    setModeFilter("all");
                    setSaveStateFilter("all");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                >
                  측정 완료 보기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setQualityFilter("all");
                    setModeFilter("all");
                    setSaveStateFilter("failed");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                >
                  저장 실패 보기
                </button>
              </div>
            </div>
          ) : (
            summary.recent.map((entry) => {
              const quality = entry.measurementQuality?.overall ?? "unknown";
              const requirementCount =
                entry.vnv?.summary.requirementIds.length ?? 0;
              const testCaseCount =
                entry.vnv?.summary.testCaseIds.length ?? 0;

              return (
                <div
                  key={entry.historyId}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900">
                          {entry.patientName}
                        </h3>
                        <Badge>{formatMode(entry)}</Badge>
                        <Badge tone="violet">
                          AQ {Number(entry.aq ?? 0).toFixed(1)}
                        </Badge>
                        <Badge
                          tone={
                            quality === "measured"
                              ? "emerald"
                              : quality === "partial"
                                ? "amber"
                                : "slate"
                          }
                        >
                          {quality}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        완료 시각 {formatDate(entry.completedAt)}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        요구사항 {requirementCount}건 · 시험 케이스 {testCaseCount}건
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/tools/admin-reports"
                        className="rounded-full bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800"
                      >
                        관리자 리포트
                      </Link>
                      <Link
                        href="/therapist/system"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        시스템 점검
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-violet-50 p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-700">
          검토 포인트
        </p>
        <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
          <li>임상 해석이나 보고에는 측정 완료 결과를 우선 사용합니다.</li>
          <li>내보내기 전에는 V&amp;V가 연결된 결과인지 먼저 확인합니다.</li>
          <li>관리자 리포트는 전체 사용자 정보와 미디어 검토가 필요할 때 사용합니다.</li>
          <li>저장 실패나 이벤트 조사에는 시스템 점검 화면을 사용합니다.</li>
        </ul>

        <div className="mt-6 rounded-[24px] border border-violet-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">품질 분포</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
            측정 완료 {summary.measuredCount} · 부분 측정 {summary.partialCount} · 시연{" "}
            {summary.demoCount}
          </p>
        </div>
        <div className="mt-4 rounded-[24px] border border-violet-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">저장 상태 요약</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
            저장 완료 {summary.savedCount} · 저장 실패 {summary.failedCount} · 검증 연결{" "}
            {summary.vnvLinkedCount}
          </p>
        </div>
        <div className="mt-4 rounded-[24px] border border-violet-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">빠른 액션</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/therapist/results?saveState=failed"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              저장 실패만 보기
            </Link>
            <Link
              href="/therapist/results?quality=measured"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              측정 완료만 보기
            </Link>
            <a
              href="/api/therapist/system/vnv-export"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              V&amp;V 내보내기
            </a>
            <a
              href="/api/therapist/system/ai-evaluation-export"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              AI 평가 내보내기
            </a>
          </div>
        </div>
      </aside>
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "amber" | "violet";
}) {
  const palette =
    tone === "emerald"
      ? "border-emerald-200 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 text-amber-700"
        : tone === "violet"
          ? "border-violet-200 text-violet-700"
          : "border-slate-200 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border bg-white px-3 py-1 text-[11px] font-black ${palette}`}
    >
      {children}
    </span>
  );
}
