"use client";

import { useEffect, useMemo, useState } from "react";

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

type HistoryEntry = {
  historyId: string;
  sessionId: string;
  patientName: string;
  trainingMode: "self" | "rehab" | "sing";
  rehabStep?: number;
  completedAt: number;
  aq: number;
  stepScores: Record<string, number>;
  singResult?: {
    song: string;
    score: number;
    finalJitter: string;
    finalSi: string;
    rtLatency: string;
    comment: string;
  };
};

export default function AdminReportsPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [isForbidden, setIsForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/reports", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          if (response.status === 403) {
            throw new Error("forbidden");
          }
          throw new Error("failed_to_load_patients");
        }
        if (cancelled) return;
        const rows = Array.isArray(payload.patients) ? payload.patients : [];
        setPatients(rows);
        setSelectedPatientId(rows[0]?.patientId ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          if (error instanceof Error && error.message === "forbidden") {
            setIsForbidden(true);
          } else {
            setError("사용자 리포트 목록을 불러오지 못했습니다.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPatients(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setEntries([]);
      setSelectedPatient(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    void fetch(`/api/admin/reports?patientId=${encodeURIComponent(selectedPatientId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error("failed_to_load_patient_report");
        }
        if (cancelled) return;
        setSelectedPatient(payload.patient ?? null);
        setEntries(Array.isArray(payload.entries) ? payload.entries : []);
      })
      .catch(() => {
        if (!cancelled) setError("선택한 사용자의 리포트를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [patient.patientName, patient.patientCode, patient.loginId, patient.patientPseudonymId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [patients, search]);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
            Admin Reports
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            사용자 리포트 관리
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            사용자별 self-assessment, rehab, sing 결과를 관리자 화면에서 조회합니다.
          </p>
        </section>

        {isForbidden ? (
          <p className="mt-6 text-sm font-bold text-slate-500">관리자 계정만 접근할 수 있습니다.</p>
        ) : error ? (
          <p className="mt-6 text-sm font-bold text-red-500">{error}</p>
        ) : null}

        {!isForbidden ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Patient Search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="사용자명, 아이디, patient_code"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
              />
            </label>

            <div className="mt-4 space-y-3">
              {isLoadingPatients ? (
                <p className="text-sm font-bold text-slate-500">사용자 목록을 불러오는 중입니다.</p>
              ) : !filteredPatients.length ? (
                <p className="text-sm font-bold text-slate-500">조건에 맞는 사용자가 없습니다.</p>
              ) : (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.patientId}
                    type="button"
                    onClick={() => setSelectedPatientId(patient.patientId)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedPatientId === patient.patientId
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <p className="text-sm font-black text-slate-900">{patient.patientName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {patient.loginId ?? "아이디 없음"} · {patient.patientCode}
                    </p>
                    <p className="mt-2 text-[11px] font-black text-slate-600">
                      self {patient.selfAssessmentCount} · rehab {patient.rehabCount} · sing {patient.singCount}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            {!selectedPatientId ? (
              <p className="text-sm font-bold text-slate-500">선택된 사용자가 없습니다.</p>
            ) : isLoadingDetail ? (
              <p className="text-sm font-bold text-slate-500">사용자 리포트를 불러오는 중입니다.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <SummaryCard label="사용자명" value={selectedPatient?.patientName ?? "-"} />
                  <SummaryCard label="아이디" value={selectedPatient?.loginId ?? "-"} />
                  <SummaryCard label="사용자코드" value={selectedPatient?.patientCode ?? "-"} />
                  <SummaryCard label="가명 ID" value={selectedPatient?.patientPseudonymId ?? "-"} mono />
                </div>

                <div className="mt-6 space-y-4">
                  {!entries.length ? (
                    <p className="text-sm font-bold text-slate-500">저장된 리포트가 없습니다.</p>
                  ) : (
                    entries.map((entry) => (
                      <article
                        key={entry.historyId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {entry.trainingMode === "sing"
                                ? `노래 훈련 · ${entry.singResult?.song ?? "-"}`
                                : entry.trainingMode === "rehab"
                                  ? `언어 재활 · step ${entry.rehabStep ?? "-"}`
                                  : "자가 진단"}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {new Intl.DateTimeFormat("ko-KR", {
                                dateStyle: "medium",
                                timeStyle: "medium",
                              }).format(new Date(entry.completedAt))}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-black">
                            <Badge>{entry.trainingMode}</Badge>
                            <Badge>{entry.trainingMode === "sing" ? `score ${entry.singResult?.score ?? entry.aq}` : `AQ ${entry.aq}`}</Badge>
                          </div>
                        </div>

                        {entry.trainingMode === "sing" && entry.singResult ? (
                          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2">
                            <p>jitter: {entry.singResult.finalJitter}</p>
                            <p>symmetry: {entry.singResult.finalSi}</p>
                            <p>latency: {entry.singResult.rtLatency}</p>
                            <p className="sm:col-span-2">comment: {entry.singResult.comment || "-"}</p>
                          </div>
                        ) : (
                          <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
                            <p>step1: {entry.stepScores.step1 ?? 0}</p>
                            <p>step2: {entry.stepScores.step2 ?? 0}</p>
                            <p>step3: {entry.stepScores.step3 ?? 0}</p>
                            <p>step4: {entry.stepScores.step4 ?? 0}</p>
                            <p>step5: {entry.stepScores.step5 ?? 0}</p>
                            <p>step6: {entry.stepScores.step6 ?? 0}</p>
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </section>
        ) : null}
      </div>
    </main>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-sm font-black text-slate-900 ${mono ? "break-all font-mono text-[12px]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
      {children}
    </span>
  );
}
