"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
    return `rehab${entry.rehabStep ? ` step ${entry.rehabStep}` : ""}`;
  }
  if (entry.trainingMode === "sing") {
    return "sing";
  }
  return "self";
}

export default function TherapistResultsPage() {
  const [entries, setEntries] = useState<TrainingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState("");

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
        setError("Failed to load therapist result summary.");
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

  const summary = useMemo(() => {
    const recent = entries.slice(0, 12);
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

    return {
      recent,
      measuredCount,
      partialCount,
      demoCount,
      vnvLinkedCount,
    };
  }, [entries]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-600">
          Results
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
          Review recent saved outputs, quality status, and traceability.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          This therapist view reuses the existing validation sample feed so you
          can see which results are measured, which ones already carry V&V
          metadata, and where to continue deeper review.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <SummaryCard label="Entries" value={String(entries.length)} />
          <SummaryCard label="Measured" value={String(summary.measuredCount)} />
          <SummaryCard label="Partial" value={String(summary.partialCount)} />
          <SummaryCard label="V&V linked" value={String(summary.vnvLinkedCount)} />
        </div>

        <div className="mt-6 space-y-4">
          {isForbidden ? (
            <p className="text-sm font-bold text-slate-500">
          Therapist-console access is currently required for this view.
            </p>
          ) : isLoading ? (
            <p className="text-sm font-bold text-slate-500">
              Loading therapist result summary.
            </p>
          ) : error ? (
            <p className="text-sm font-bold text-red-500">{error}</p>
          ) : !summary.recent.length ? (
            <p className="text-sm font-bold text-slate-500">
              No recent validation entries were found.
            </p>
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
                        completed {formatDate(entry.completedAt)}
                      </p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        V&V requirements {requirementCount} · test cases {testCaseCount}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/tools/admin-reports"
                        className="rounded-full bg-violet-700 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-800"
                      >
                        Open reports
                      </Link>
                      <Link
                        href="/therapist/system"
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        Check system
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
          Current focus
        </p>
        <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
          <li>Prefer measured data for clinical interpretation</li>
          <li>Check V&V-linked entries before export or audit follow-up</li>
          <li>Use Admin Reports for full patient detail and media review</li>
          <li>Use System view for failed-save and usage-event investigation</li>
        </ul>

        <div className="mt-6 rounded-[24px] border border-violet-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">Quality distribution</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
            measured {summary.measuredCount} · partial {summary.partialCount} · demo{" "}
            {summary.demoCount}
          </p>
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
