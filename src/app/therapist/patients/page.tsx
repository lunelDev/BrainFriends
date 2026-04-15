"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { fetchTherapistReportsOverview } from "@/lib/client/therapistReportsApi";

type PatientSummary = {
  patientId: string;
  patientPseudonymId: string;
  patientName: string;
  patientCode: string;
  loginId: string | null;
  birthDate: string | null;
  latestActivityAt: string | null;
  selfAssessmentCount: number;
  rehabCount: number;
  singCount: number;
};

function formatDate(value: string | null) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function TherapistPatientsPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    void fetchTherapistReportsOverview()
      .then((payload) => {
        if (!cancelled) {
          setPatients(payload.patients as PatientSummary[]);
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
        setError("Failed to load therapist patient list.");
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

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [
        patient.patientName,
        patient.patientCode,
        patient.loginId,
        patient.patientPseudonymId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [patients, search]);

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
              Users
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              Search users before moving into report review.
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              This is the therapist-side user entry screen. It reuses the
              existing admin report source so therapist work can start from a
              user list instead of a user-facing screen.
            </p>
          </div>
          <label className="block lg:min-w-[320px]">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, user code, login ID, pseudonym"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Users" value={String(patients.length)} />
          <SummaryCard label="Visible" value={String(filteredPatients.length)} />
          <SummaryCard label="Entry point" value="Admin Reports API" mono />
        </div>

        <div className="mt-6 space-y-4">
          {isForbidden ? (
            <p className="text-sm font-bold text-slate-500">
              Admin access is currently required for this view.
            </p>
          ) : isLoading ? (
            <p className="text-sm font-bold text-slate-500">
              Loading therapist user list.
            </p>
          ) : error ? (
            <p className="text-sm font-bold text-red-500">{error}</p>
          ) : !filteredPatients.length ? (
            <p className="text-sm font-bold text-slate-500">
              No users matched the current search.
            </p>
          ) : (
            filteredPatients.map((patient) => (
              <div
                key={patient.patientId}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900">
                        {patient.patientName}
                      </h3>
                      <Badge>{patient.patientCode}</Badge>
                      <Badge mono>{patient.patientPseudonymId}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      login {patient.loginId ?? "-"} · last activity{" "}
                      {formatDate(patient.latestActivityAt)}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      self {patient.selfAssessmentCount} · rehab {patient.rehabCount} · sing{" "}
                      {patient.singCount}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/therapist/patients/${patient.patientId}`}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                    >
                      Open detail
                    </Link>
                    <Link
                      href="/tools/admin-reports"
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
                    >
                      Open reports
                    </Link>
                    <Link
                      href="/therapist/results"
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                    >
                      Review results
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
          Next UI
        </p>
        <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
          <li>Bind user selection to a dedicated therapist detail route</li>
          <li>Show measured or partial quality badges per recent session</li>
          <li>Link directly to self, rehab, and sing result detail</li>
          <li>Add therapist memo and follow-up task slots</li>
        </ul>
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
          mono ? "font-mono text-sm" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
  mono = false,
}: {
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-black text-emerald-700 ${
        mono ? "font-mono" : ""
      }`}
    >
      {children}
    </span>
  );
}
