"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReportDeveloperKpiPanel } from "@/components/training/ReportDeveloperKpiPanel";
import {
  buildAggregateEstimatedValidationMetrics,
  getEstimatedKpiSummary,
} from "@/features/report/utils/validationEstimates";
import {
  getRehabRowScore,
} from "@/features/report/utils/reportHelpers";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

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

type HistoryEntry = TrainingHistoryEntry;

export default function AdminReportsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [validationSampleEntries, setValidationSampleEntries] = useState<HistoryEntry[]>([]);
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
        const sampleRows = Array.isArray(payload.validationSampleEntries)
          ? payload.validationSampleEntries
          : [];
        setPatients(rows);
        setValidationSampleEntries(sampleRows);
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

  const estimatedKpiMetrics = useMemo(() => {
    return buildAggregateEstimatedValidationMetrics(validationSampleEntries as any);
  }, [validationSampleEntries]);

  const estimatedKpiSummary = useMemo(
    () => getEstimatedKpiSummary(estimatedKpiMetrics),
    [estimatedKpiMetrics],
  );

  const handleExportSelectedPatient = () => {
    if (!selectedPatient || !entries.length) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      patient: selectedPatient,
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `brainfriends-${selectedPatient.patientCode ?? selectedPatient.patientId}-data.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getEntryTitle = (entry: HistoryEntry) => {
    if (entry.trainingMode === "sing") {
      return `노래 훈련 · ${entry.singResult?.song ?? "-"}`;
    }
    if (entry.trainingMode === "rehab") {
      return `언어 재활 · step ${entry.rehabStep ?? "-"}`;
    }
    return "자가 진단";
  };

  const getEntryScorePill = (entry: HistoryEntry) => {
    if (entry.trainingMode === "sing") {
      return `노래 점수 ${entry.singResult?.score ?? entry.aq}`;
    }
    if (entry.trainingMode === "rehab") {
      return `재활 점수 ${getRehabRowScore(entry as any).toFixed(1)}`;
    }
    return `AQ ${Number(entry.aq ?? 0).toFixed(1)}`;
  };

  const getEntrySummaryLine = (entry: HistoryEntry) => {
    if (entry.trainingMode === "sing" && entry.singResult) {
      return `곡 ${entry.singResult.song ?? "-"} · 점수 ${entry.singResult.score ?? 0} · jitter ${entry.singResult.finalJitter} · symmetry ${entry.singResult.finalSi} · latency ${entry.singResult.rtLatency}`;
    }

    if (entry.trainingMode === "rehab") {
      const rehabStep = Number(entry.rehabStep || 0);
      const rehabStepKey =
        rehabStep >= 1 && rehabStep <= 6
          ? (`step${rehabStep}` as keyof typeof entry.stepScores)
          : null;
      const rehabStepScore =
        rehabStepKey != null ? entry.stepScores[rehabStepKey] ?? 0 : 0;
      return `대상 step ${entry.rehabStep ?? "-"} · 재활 점수 ${getRehabRowScore(entry as any).toFixed(1)} · 해당 step 점수 ${rehabStepScore}`;
    }

    return `종합 AQ ${Number(entry.aq ?? 0).toFixed(1)} · step1 ${entry.stepScores.step1 ?? 0} · step2 ${entry.stepScores.step2 ?? 0} · step3 ${entry.stepScores.step3 ?? 0} · step4 ${entry.stepScores.step4 ?? 0} · step5 ${entry.stepScores.step5 ?? 0} · step6 ${entry.stepScores.step6 ?? 0}`;
  };

  const getEntryMediaLinks = (entry: HistoryEntry) => {
    const tone =
      entry.trainingMode === "sing"
        ? "sing"
        : entry.trainingMode === "rehab"
          ? "rehab"
          : "self";
    const links: Array<{ label: string; href: string; tone: "self" | "rehab" | "sing" }> = [];

    if (entry.trainingMode === "sing" && entry.singResult) {
      if (entry.singResult.reviewAudioUrl) {
        links.push({ label: "오디오 듣기", href: entry.singResult.reviewAudioUrl, tone });
      }
      for (const [index, frame] of (entry.singResult.reviewKeyFrames ?? []).entries()) {
        if (frame?.dataUrl) {
          links.push({ label: `이미지 보기 ${index + 1}`, href: frame.dataUrl, tone });
        }
      }
      return links;
    }

    const stepDetails = entry.stepDetails;
    for (const stepNo of [2, 4, 5] as const) {
      const rows = Array.isArray(stepDetails?.[`step${stepNo}` as keyof typeof stepDetails])
        ? (stepDetails[`step${stepNo}` as keyof typeof stepDetails] as Array<any>)
        : [];
      rows.forEach((row, index) => {
        if (typeof row?.audioUrl === "string" && row.audioUrl.trim().length > 0) {
          links.push({
            label: `오디오 듣기 step${stepNo}-${index + 1}`,
            href: row.audioUrl,
            tone,
          });
        }
      });
    }

    const step6Rows = Array.isArray(stepDetails?.step6) ? stepDetails.step6 : [];
    step6Rows.forEach((row, index) => {
      if (typeof row?.userImage === "string" && row.userImage.trim().length > 0) {
        links.push({
          label: `이미지 보기 step6-${index + 1}`,
          href: row.userImage,
          tone,
        });
      }
    });

    return links;
  };

  const getMediaLinkClassName = (tone: "self" | "rehab" | "sing") => {
    switch (tone) {
      case "self":
        return "rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black text-orange-700 hover:bg-orange-100";
      case "rehab":
        return "rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700 hover:bg-sky-100";
      case "sing":
      default:
        return "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100";
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
            Admin Reports
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            사용자 리포트 관리
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            사용자별 self-assessment, rehab, sing 결과를 관리자 화면에서 조회합니다.
          </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/select-page/mode")}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              뒤로 가기
            </button>
          </div>
        </section>

        {isForbidden ? (
          <p className="mt-6 text-sm font-bold text-slate-500">관리자 계정만 접근할 수 있습니다.</p>
        ) : error ? (
          <p className="mt-6 text-sm font-bold text-red-500">{error}</p>
        ) : null}

        {!isForbidden ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
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
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
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

          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
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

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleExportSelectedPatient}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                  >
                    선택 사용자 데이터 내보내기
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-600">
                  검증 표본: 전체 사용자 {validationSampleEntries.length}건 기준
                </div>

                <div className="mt-6 overflow-hidden rounded-[22px] border border-slate-200">
                  {!entries.length ? (
                    <div className="bg-white px-4 py-6 text-sm font-bold text-slate-500">
                      저장된 리포트가 없습니다.
                    </div>
                  ) : (
                    entries.map((entry, index) => (
                      <article
                        key={entry.historyId}
                        className={`bg-white px-4 py-4 ${index !== entries.length - 1 ? "border-b border-slate-200" : ""}`}
                      >
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] xl:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {getEntryTitle(entry)}
                            </p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {new Intl.DateTimeFormat("ko-KR", {
                                dateStyle: "medium",
                                timeStyle: "medium",
                              }).format(new Date(entry.completedAt))}
                            </p>
                          </div>
                          <p className="min-w-0 text-sm font-semibold leading-relaxed text-slate-600">
                            {getEntrySummaryLine(entry)}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[11px] font-black xl:justify-end">
                            <Badge>{entry.trainingMode}</Badge>
                            <Badge>{getEntryScorePill(entry)}</Badge>
                          </div>
                        </div>
                        {getEntryMediaLinks(entry).length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {getEntryMediaLinks(entry).map((media) => (
                              <a
                                key={`${entry.historyId}-${media.label}-${media.href}`}
                                href={media.href}
                                target="_blank"
                                rel="noreferrer"
                                className={getMediaLinkClassName(media.tone)}
                              >
                                {media.label}
                              </a>
                            ))}
                          </div>
                        ) : null}
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
      <ReportDeveloperKpiPanel
        metrics={estimatedKpiMetrics}
        passCount={estimatedKpiSummary.passCount}
        failCount={estimatedKpiSummary.failCount}
        pendingCount={estimatedKpiSummary.pendingCount}
      />
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
