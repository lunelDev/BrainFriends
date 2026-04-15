"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { fetchTherapistPatientDetail, type TherapistPatientDetail } from "@/lib/client/therapistReportsApi";

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

function getQualityTone(quality: string) {
  if (quality === "measured") return "emerald" as const;
  if (quality === "partial") return "amber" as const;
  if (quality === "demo") return "slate" as const;
  return "slate" as const;
}

export default function TherapistPatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const patientId = String(params?.patientId ?? "");
  const [patient, setPatient] = useState<TherapistPatientDetail | null>(null);
  const [entries, setEntries] = useState<TrainingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patientId) {
      setError("Missing patient id.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void fetchTherapistPatientDetail(patientId)
      .then((payload) => {
        if (!cancelled) {
          setPatient(payload.patient ?? null);
          setEntries(payload.entries as TrainingHistoryEntry[]);
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
        if (
          fetchError instanceof Error &&
          fetchError.message === "not_found"
        ) {
          setError("Patient detail was not found.");
          return;
        }
        setError("Failed to load therapist patient detail.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const summary = useMemo(() => {
    const measuredCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "measured",
    ).length;
    const vnvCount = entries.filter((entry) => entry.vnv?.summary).length;
    const latest = entries[0] ?? null;

    return {
      measuredCount,
      vnvCount,
      latest,
    };
  }, [entries]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">
              Patient Detail
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              Therapist view for patient sessions, quality, and traceability.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/therapist/patients"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Back to patients
            </Link>
            <Link
              href="/tools/admin-reports"
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700"
            >
              Open admin reports
            </Link>
          </div>
        </div>

        {isForbidden ? (
          <p className="mt-6 text-sm font-bold text-slate-500">
            Therapist-console access is currently required for this view.
          </p>
        ) : isLoading ? (
          <p className="mt-6 text-sm font-bold text-slate-500">
            Loading patient detail.
          </p>
        ) : error ? (
          <p className="mt-6 text-sm font-bold text-red-500">{error}</p>
        ) : !patient ? (
          <p className="mt-6 text-sm font-bold text-slate-500">
            No patient detail available.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <SummaryCard label="Patient" value={patient.patientName} />
              <SummaryCard label="Login" value={patient.loginId ?? "-"} />
              <SummaryCard label="Code" value={patient.patientCode} />
              <SummaryCard
                label="Pseudonym"
                value={patient.patientPseudonymId}
                mono
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Sessions" value={String(entries.length)} />
              <SummaryCard
                label="Measured"
                value={String(summary.measuredCount)}
              />
              <SummaryCard label="V&V linked" value={String(summary.vnvCount)} />
            </div>

            <div className="mt-6 space-y-4">
              {!entries.length ? (
                <p className="text-sm font-bold text-slate-500">
                  No saved sessions were found for this patient.
                </p>
              ) : (
                entries.map((entry) => {
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
                              {formatMode(entry)}
                            </h3>
                            <Badge>{quality}</Badge>
                            <Badge tone="violet">
                              AQ {Number(entry.aq ?? 0).toFixed(1)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-600">
                            completed {formatDate(entry.completedAt)}
                          </p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            V&V requirements {requirementCount} · test cases {testCaseCount}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-600">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                              step1 {entry.stepScores.step1}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                              step2 {entry.stepScores.step2}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                              step4 {entry.stepScores.step4}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                              step5 {entry.stepScores.step5}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                              step6 {entry.stepScores.step6}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href="/therapist/results"
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                          >
                            Results overview
                          </Link>
                          <Link
                            href="/therapist/system"
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                          >
                            System checks
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-sky-50 p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">
          Latest session
        </p>
        {!summary.latest ? (
          <p className="mt-4 text-sm font-medium leading-6 text-slate-700">
            No recent session is available yet.
          </p>
        ) : (
          <>
            <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">
              {formatMode(summary.latest)}
            </h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
              completed {formatDate(summary.latest.completedAt)}
            </p>
            <div className="mt-4 space-y-2 text-sm font-medium text-slate-700">
              <p>
                quality: {summary.latest.measurementQuality?.overall ?? "unknown"}
              </p>
              <p>AQ: {Number(summary.latest.aq ?? 0).toFixed(1)}</p>
              <p>
                V&V-linked:{" "}
                {summary.latest.vnv?.summary.requirementIds.length ?? 0} requirements
              </p>
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-base font-black text-slate-900 ${
          mono ? "font-mono text-sm break-all" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "violet";
}) {
  const palette =
    tone === "violet"
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
