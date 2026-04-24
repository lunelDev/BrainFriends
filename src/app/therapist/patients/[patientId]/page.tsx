"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  ImageIcon,
  MessageSquare,
  Music,
  ScanFace,
  UserRound,
} from "lucide-react";
import type { PatientProfile } from "@/lib/patientStorage";
import type {
  AcousticSnapshot,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";
import { persistTrainingHistoryToDatabase } from "@/lib/client/clinicalResultsApi";
import { useTherapistConsoleGuard } from "@/hooks/useTherapistConsoleGuard";
import {
  fetchTherapistPatientDetail,
  fetchTherapistPatientNote,
  saveTherapistPatientNote,
  type TherapistPatientDetail,
} from "@/lib/client/therapistReportsApi";
import type {
  TherapistFollowUpState,
  TherapistPatientNote,
} from "@/lib/server/therapistNotes";

function formatDate(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatMode(entry: TrainingHistoryEntry) {
  if (entry.trainingMode === "rehab") {
    return `언어 재활${entry.rehabStep ? ` · Step ${entry.rehabStep}` : ""}`;
  }
  if (entry.trainingMode === "sing") return "브레인 노래방";
  return "자가 진단";
}

function getQualityLabel(quality: string) {
  if (quality === "measured") return "측정 완료";
  if (quality === "partial") return "부분 측정";
  if (quality === "demo") return "시연 데이터";
  return "확인 필요";
}

function getQualityTone(quality: string) {
  if (quality === "measured") return "emerald" as const;
  if (quality === "partial") return "amber" as const;
  if (quality === "demo") return "slate" as const;
  return "slate" as const;
}

function getFollowUpLabel(state: TherapistFollowUpState) {
  if (state === "monitor") return "관찰 필요";
  if (state === "follow_up") return "후속 점검";
  if (state === "priority") return "우선 검토";
  return "설정 안 함";
}

function getEntrySaveState(entry: TrainingHistoryEntry) {
  return (entry as TrainingHistoryEntry & { dbSaveState?: string }).dbSaveState ?? "unknown";
}

function getEntrySaveStateLabel(entry: TrainingHistoryEntry) {
  const state = getEntrySaveState(entry);
  if (state === "saved") return "저장 완료";
  if (state === "failed") return "저장 실패";
  if (state === "skipped") return "저장 제외";
  return "확인 필요";
}

/**
 * 치료사 환자 상세 화면용 acoustic 요약.
 * step-2/4/5 의 발화 카드별 Parselmouth 음향 측정값(REQ-ACOUSTIC-001~004)을 집계해
 * "측정 N건 · 일부 N건 · 실패 N건" 형태의 한눈 통계로 노출한다.
 * 점수 산정에는 영향이 없으며 참고 표시용이다.
 */
function summarizeEntryAcoustics(entry: TrainingHistoryEntry | null) {
  if (!entry) return null;
  const buckets = { measured: 0, degraded: 0, failed: 0, total: 0 };
  const collect = (items: any[] | undefined) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const acoustic = item?.acoustic as AcousticSnapshot | null | undefined;
      if (!acoustic || typeof acoustic !== "object") continue;
      buckets.total += 1;
      if (acoustic.measurement_quality === "measured") buckets.measured += 1;
      else if (acoustic.measurement_quality === "degraded") buckets.degraded += 1;
      else buckets.failed += 1;
    }
  };
  collect(entry.stepDetails?.step2);
  collect(entry.stepDetails?.step4);
  collect(entry.stepDetails?.step5);
  if (buckets.total === 0) return null;
  return buckets;
}

function calcAgeFromBirthDate(birthDate: string | null): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

function buildRetryPatientProfile(patient: TherapistPatientDetail): PatientProfile {
  const handRaw =
    typeof patient.hand === "string" ? patient.hand.trim().toUpperCase() : "";
  const hand: "R" | "L" | "U" =
    handRaw === "R" || handRaw === "L" || handRaw === "U"
      ? (handRaw as "R" | "L" | "U")
      : "U";

  return {
    sessionId: patient.patientId,
    userRole: "therapist",
    name: patient.patientName,
    birthDate: patient.birthDate ?? undefined,
    gender: patient.sex ?? "U",
    age: calcAgeFromBirthDate(patient.birthDate),
    educationYears: patient.educationYears ?? 0,
    onsetDate: patient.onsetDate ?? undefined,
    daysSinceOnset: patient.daysSinceOnset ?? undefined,
    hemiplegia: patient.hemiplegia ?? undefined,
    hemianopsia: patient.hemianopsia ?? undefined,
    phone: patient.phone ?? undefined,
    hand,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function formatSex(value: TherapistPatientDetail["sex"]): string {
  if (value === "M") return "남";
  if (value === "F") return "여";
  if (value === "U") return "미상";
  return "-";
}

function formatHemiplegia(value: TherapistPatientDetail["hemiplegia"]): string {
  if (value === "Y") return "있음";
  if (value === "N") return "없음";
  return "-";
}

function formatHemianopsia(
  value: TherapistPatientDetail["hemianopsia"],
): string {
  if (value === "LEFT") return "좌측";
  if (value === "RIGHT") return "우측";
  if (value === "NONE") return "없음";
  return "-";
}

function formatHand(value: TherapistPatientDetail["hand"]): string {
  if (!value) return "-";
  const upper = value.trim().toUpperCase();
  if (upper === "R") return "오른손";
  if (upper === "L") return "왼손";
  if (upper === "U") return "미상";
  return value;
}

function formatBirthDateWithAge(birthDate: string | null): string {
  if (!birthDate) return "-";
  const age = calcAgeFromBirthDate(birthDate);
  return age > 0 ? `${birthDate} (만 ${age}세)` : birthDate;
}

function formatOnsetWithDays(
  onsetDate: string | null,
  days: number | null,
): string {
  if (!onsetDate && days == null) return "-";
  if (onsetDate && days != null) return `${onsetDate} (발병 후 ${days}일)`;
  if (onsetDate) return onsetDate;
  return `발병 후 ${days}일`;
}

function formatEducationYears(value: number | null): string {
  if (value == null) return "-";
  return `${value}년`;
}

function collectEntryMedia(entry: TrainingHistoryEntry) {
  const items: Array<{ label: string; href: string; type: "audio" | "image" }> = [];
  const pushUnique = (
    label: string,
    href: unknown,
    type: "audio" | "image",
  ) => {
    if (typeof href !== "string" || !href.trim()) return;
    if (items.some((item) => item.href === href)) return;
    items.push({ label, href, type });
  };

  entry.stepDetails.step2.forEach((item, index) =>
    pushUnique(`Step2 음성 ${index + 1}`, item?.audioUrl, "audio"),
  );
  entry.stepDetails.step4.forEach((item, index) =>
    pushUnique(`Step4 음성 ${index + 1}`, item?.audioUrl, "audio"),
  );
  entry.stepDetails.step5.forEach((item, index) =>
    pushUnique(`Step5 음성 ${index + 1}`, item?.audioUrl, "audio"),
  );
  entry.stepDetails.step6.forEach((item, index) =>
    pushUnique(`Step6 이미지 ${index + 1}`, item?.userImage, "image"),
  );
  pushUnique("노래 복습 음원", entry.singResult?.reviewAudioUrl, "audio");
  entry.singResult?.reviewKeyFrames?.forEach((item, index) =>
    pushUnique(
      item?.label ? `키 프레임 ${item.label}` : `키 프레임 ${index + 1}`,
      item?.dataUrl,
      "image",
    ),
  );

  return items;
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
      <p className="mt-2 break-all text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function StatusCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] bg-slate-50 px-5 py-5">
      <p className="text-sm font-black text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "violet" | "emerald" | "amber";
}) {
  const palette =
    tone === "violet"
      ? "border-violet-200 text-violet-700"
      : tone === "emerald"
        ? "border-emerald-200 text-emerald-700"
        : tone === "amber"
          ? "border-amber-200 text-amber-700"
          : "border-slate-200 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border bg-white px-3 py-1 text-[11px] font-black ${palette}`}
    >
      {children}
    </span>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-center shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

export default function TherapistPatientDetailPage() {
  const { isReady, isAuthorized, isAdmin } = useTherapistConsoleGuard();
  const params = useParams<{ patientId: string }>();
  const patientId = String(params?.patientId ?? "");
  const [patient, setPatient] = useState<TherapistPatientDetail | null>(null);
  const [entries, setEntries] = useState<TrainingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState<TherapistPatientNote | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [followUpState, setFollowUpState] =
    useState<TherapistFollowUpState>("none");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteNotice, setNoteNotice] = useState("");
  const [retryNotice, setRetryNotice] = useState("");
  const [retryError, setRetryError] = useState("");
  const [retryingHistoryId, setRetryingHistoryId] = useState<string | null>(null);

  useEffect(() => {
    // admin/therapist 가 아니면 가드 훅이 redirect 하므로 fetch 자체를 보류.
    if (!isReady || !isAuthorized) return;
    if (!patientId) {
      setError("사용자 ID가 없습니다.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    void fetchTherapistPatientDetail(patientId)
      .then((payload) => {
        if (cancelled) return;
        setPatient(payload.patient ?? null);
        setEntries(payload.entries as TrainingHistoryEntry[]);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        if (fetchError instanceof Error && fetchError.message === "forbidden") {
          setIsForbidden(true);
          return;
        }
        if (fetchError instanceof Error && fetchError.message === "not_found") {
          setError("사용자 기록을 찾지 못했습니다.");
          return;
        }
        setError("치료사 사용자 상세 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, isReady, isAuthorized]);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    void fetchTherapistPatientNote(patientId)
      .then((payload) => {
        if (cancelled) return;
        setNote(payload);
        setMemoDraft(payload?.memo ?? "");
        setFollowUpState(payload?.followUpState ?? "none");
      })
      .catch(() => {
        if (!cancelled) setNote(null);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const summary = useMemo(() => {
    const measuredCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "measured",
    ).length;
    const partialCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "partial",
    ).length;
    const demoCount = entries.filter(
      (entry) => entry.measurementQuality?.overall === "demo",
    ).length;
    const vnvCount = entries.filter((entry) => entry.vnv?.summary).length;
    const latest = entries[0] ?? null;
    return { measuredCount, partialCount, demoCount, vnvCount, latest };
  }, [entries]);

  const comparison = useMemo(() => {
    if (entries.length < 2) return null;
    return {
      aqDelta: Number(entries[0].aq ?? 0) - Number(entries[1].aq ?? 0),
      step4Delta:
        Number(entries[0].stepScores.step4 ?? 0) -
        Number(entries[1].stepScores.step4 ?? 0),
    };
  }, [entries]);

  const aqTrendPoints = useMemo(() => {
    const rows = entries.slice(0, 6).reverse();
    if (!rows.length) return [];
    return rows.map((entry, index) => ({
      x: rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100,
      y: 100 - Math.max(0, Math.min(100, Number(entry.aq ?? 0))),
      label: formatShortDate(entry.completedAt),
      aq: Number(entry.aq ?? 0),
    }));
  }, [entries]);

  const latestAcousticSummary = useMemo(
    () => summarizeEntryAcoustics(summary.latest),
    [summary.latest],
  );

  const latestStepCards = useMemo(() => {
    const latest = summary.latest;
    if (!latest) return [];
    return [
      ["Step 1", latest.stepScores.step1],
      ["Step 2", latest.stepScores.step2],
      ["Step 3", latest.stepScores.step3],
      ["Step 4", latest.stepScores.step4],
      ["Step 5", latest.stepScores.step5],
      ["Step 6", latest.stepScores.step6],
    ] as const;
  }, [summary.latest]);

  const mediaItems = useMemo(
    () =>
      entries.slice(0, 3).flatMap((entry) =>
        collectEntryMedia(entry).map((item) => ({
          ...item,
          sessionLabel: formatDate(entry.completedAt),
          historyId: entry.historyId,
        })),
      ),
    [entries],
  );

  const exportPatientDetail = () => {
    if (!patient) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      patient,
      note,
      summary: {
        totalSessions: entries.length,
        measuredCount: summary.measuredCount,
        vnvCount: summary.vnvCount,
      },
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `therapist-user-${patient.patientCode || patient.patientId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadEntryJson = (entry: TrainingHistoryEntry) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      patient,
      entry,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `therapist-entry-${entry.historyId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const retryEntrySave = async (entry: TrainingHistoryEntry) => {
    if (!patient) return;
    setRetryNotice("");
    setRetryError("");
    setRetryingHistoryId(entry.historyId);
    try {
      const result = await persistTrainingHistoryToDatabase(
        buildRetryPatientProfile(patient),
        entry,
      );
      if (result.skipped) {
        setRetryNotice("이 결과는 저장 대상에서 제외되어 재시도하지 않았습니다.");
      } else {
        setRetryNotice("결과를 다시 저장하도록 요청했습니다.");
      }
    } catch (error) {
      setRetryError(
        error instanceof Error
          ? error.message
          : "결과 재저장을 요청하지 못했습니다.",
      );
    } finally {
      setRetryingHistoryId(null);
    }
  };

  const saveNote = async () => {
    if (!patientId) return;
    setIsSavingNote(true);
    setNoteError("");
    setNoteNotice("");
    try {
      const saved = await saveTherapistPatientNote({
        patientId,
        memo: memoDraft,
        followUpState,
      });
      setNote(saved);
      setNoteNotice("치료사 메모를 저장했습니다.");
    } catch (saveError) {
      setNoteError(
        saveError instanceof Error
          ? saveError.message
          : "치료사 메모를 저장하지 못했습니다.",
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  if (isForbidden || isLoading || error || !patient) {
    const text = isForbidden
      ? "치료사 콘솔 권한이 필요한 화면입니다."
      : isLoading
        ? "사용자 기록을 불러오는 중입니다."
        : error || "표시할 사용자 정보가 없습니다.";
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 shadow-sm">
        {text}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/*
        뒤로가기 — hero 안의 흰색 outline 버튼은 시야 끝(우측)에 묻혀 잘 안 보인다는 피드백을 받아서
        페이지 최상단에 명시적인 좌측 정렬 back 링크를 분리해 둔다.
        layout 의 admin 헤더(있을 때) 와 hero 사이에 위치하므로 어느 권한이든 같은 자리에서 보인다.
      */}
      <div>
        <Link
          href="/therapist"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
        >
          <ArrowLeft className="h-4 w-4" />
          사용자 목록으로 돌아가기
        </Link>
      </div>

      <article className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-sky-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-100">
              User Detail
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              사용자 세션 추이와 품질 상태를 한 화면에서 확인합니다.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-sky-50/90">
              AQ 변화, Step 결과, 측정 품질, follow-up 메모를 연결해 다음 조치를 빠르게 판단할 수 있게 구성합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* "사용자 목록" 버튼은 상단의 "← 사용자 목록으로 돌아가기" 와 중복이라 제거. */}
            <button
              type="button"
              onClick={exportPatientDetail}
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-sky-700 transition hover:bg-sky-50"
            >
              결과 내보내기
            </button>
          </div>
        </div>
      </article>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-sky-600" />
            <h3 className="text-xl font-black text-slate-950">사용자 요약</h3>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="이름" value={patient.patientName} />
            <SummaryCard label="사용자 코드" value={patient.patientCode} />
            <SummaryCard label="로그인 ID" value={patient.loginId ?? "-"} />
            <SummaryCard label="생년월일" value={patient.birthDate ?? "-"} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatusCard
              title="최근 AQ"
              value={`${Number(summary.latest?.aq ?? 0).toFixed(1)}점`}
              note={summary.latest ? formatDate(summary.latest.completedAt) : "기록 없음"}
            />
            <StatusCard
              title="측정 품질"
              value={getQualityLabel(summary.latest?.measurementQuality?.overall ?? "unknown")}
              note={`measured ${summary.measuredCount} · partial ${summary.partialCount} · demo ${summary.demoCount}`}
            />
            <StatusCard
              title="follow-up"
              value={getFollowUpLabel(followUpState)}
              note={note?.updatedAt ? formatDate(new Date(note.updatedAt).getTime()) : "저장된 메모 없음"}
            />
          </div>
        </article>

        <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-xl font-black text-slate-950">AQ 추이</h3>
          </div>
          {aqTrendPoints.length ? (
            <>
              <div className="mt-5 rounded-[24px] bg-slate-50 p-4">
                <svg viewBox="0 0 100 100" className="h-44 w-full">
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    points={aqTrendPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  />
                  {aqTrendPoints.map((point) => (
                    <g key={`${point.label}-${point.x}`}>
                      <circle cx={point.x} cy={point.y} r="2.8" fill="#0f172a" />
                      <text x={point.x} y={96} textAnchor="middle" className="fill-slate-500 text-[4px] font-bold">
                        {point.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MiniMetric label="총 세션" value={`${entries.length}회`} />
                <MiniMetric
                  label="AQ 변화"
                  value={comparison ? `${comparison.aqDelta >= 0 ? "+" : ""}${comparison.aqDelta.toFixed(1)}` : "비교 없음"}
                />
                <MiniMetric
                  label="Step4 변화"
                  value={comparison ? `${comparison.step4Delta >= 0 ? "+" : ""}${comparison.step4Delta.toFixed(1)}` : "비교 없음"}
                />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
              추이를 그릴 사용자 세션 데이터가 아직 없습니다.
            </p>
          )}
        </aside>
      </section>

      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <h3 className="text-xl font-black text-slate-950">환자 프로필</h3>
        </div>
        <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
          접수 시 등록된 인적·임상 정보입니다. 비어 있는 항목은 환자 등록 단계에서 입력되지 않은 값입니다.
        </p>

        <div className="mt-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            인적 정보
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="이름" value={patient.patientName} />
            <SummaryCard
              label="생년월일"
              value={formatBirthDateWithAge(patient.birthDate)}
            />
            <SummaryCard label="성별" value={formatSex(patient.sex)} />
            <SummaryCard label="연락처" value={patient.phone ?? "-"} />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            임상 정보
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="발병일"
              value={formatOnsetWithDays(patient.onsetDate, patient.daysSinceOnset)}
            />
            <SummaryCard
              label="마비"
              value={formatHemiplegia(patient.hemiplegia)}
            />
            <SummaryCard
              label="시야 결손"
              value={formatHemianopsia(patient.hemianopsia)}
            />
            <SummaryCard label="우세손" value={formatHand(patient.hand)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="교육 연수"
              value={formatEducationYears(patient.educationYears)}
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            담당 / 식별
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="담당 치료사"
              value={patient.therapistName ?? "-"}
            />
            <SummaryCard
              label="소속 기관"
              value={patient.therapistOrganizationName ?? "-"}
            />
            <SummaryCard label="사용자 코드" value={patient.patientCode} />
            <SummaryCard label="로그인 ID" value={patient.loginId ?? "-"} />
          </div>
        </div>
      </article>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-sky-600" />
              <h3 className="text-xl font-black text-slate-950">최근 세션 해석</h3>
            </div>
            {/*
              "전체 결과 보기" → /therapist/results 는 admin 전용 화면(useTherapistAdminGuard)이라
              일반 치료사가 누르면 곧장 /therapist 로 돌려보내져 "잠깐 갔다가 돌아오는" 버그처럼 보인다.
              따라서 진입점 자체를 admin 일 때만 노출한다.
            */}
            {isAdmin ? (
              <Link
                href="/therapist/results"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                전체 결과 보기
              </Link>
            ) : null}
          </div>

          {summary.latest ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-black text-slate-950">{formatMode(summary.latest)}</h4>
                    <Badge tone={getQualityTone(summary.latest.measurementQuality?.overall ?? "unknown")}>
                      {getQualityLabel(summary.latest.measurementQuality?.overall ?? "unknown")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    {formatDate(summary.latest.completedAt)}
                  </p>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-700">
                    요구사항 {summary.latest.vnv?.summary.requirementIds.length ?? 0}건 · 시험 항목 {summary.latest.vnv?.summary.testCaseIds.length ?? 0}건이 연결되어 있습니다.
                  </p>
                </div>
                <div className="rounded-[24px] bg-sky-50 px-6 py-5 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">AQ</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">
                    {Number(summary.latest.aq ?? 0).toFixed(1)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                {latestStepCards.map(([label, value]) => (
                  <div key={label} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{Number(value ?? 0).toFixed(0)}</p>
                  </div>
                ))}
              </div>

              {latestAcousticSummary ? (
                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      음향 측정 (참고)
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      Step 2/4/5 발화 합계 {latestAcousticSummary.total}건
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        실측
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-800">
                        {latestAcousticSummary.measured}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                        일부
                      </p>
                      <p className="mt-1 text-lg font-black text-amber-800">
                        {latestAcousticSummary.degraded}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-2 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        실패
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-700">
                        {latestAcousticSummary.failed}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-500 leading-relaxed">
                    Parselmouth 기반 발화 음향 분석 결과 분포(REQ-ACOUSTIC-001~004). 점수
                    산정에는 반영되지 않으며 참고용입니다.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="mt-6 space-y-3">
            {entries.slice(0, 6).map((entry) => (
              <div key={entry.historyId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black text-slate-950">{formatMode(entry)}</p>
                      <Badge tone={getQualityTone(entry.measurementQuality?.overall ?? "unknown")}>
                        {getQualityLabel(entry.measurementQuality?.overall ?? "unknown")}
                      </Badge>
                      <Badge tone={getEntrySaveState(entry) === "failed" ? "amber" : "slate"}>
                        {getEntrySaveStateLabel(entry)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">{formatDate(entry.completedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                      AQ {Number(entry.aq ?? 0).toFixed(1)}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                      V&V {entry.vnv?.summary.requirementIds.length ?? 0}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                      Step4 {Number(entry.stepScores.step4 ?? 0).toFixed(0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadEntryJson(entry)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:bg-slate-100"
                    >
                      결과 다운로드
                    </button>
                    {getEntrySaveState(entry) === "failed" ? (
                      <button
                        type="button"
                        onClick={() => retryEntrySave(entry)}
                        disabled={retryingHistoryId === entry.historyId}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {retryingHistoryId === entry.historyId ? "재시도 중..." : "저장 재시도"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="space-y-6">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-600" />
              <h3 className="text-xl font-black text-slate-950">치료사 메모 / follow-up</h3>
            </div>
            <select
              value={followUpState}
              onChange={(event) =>
                setFollowUpState(event.target.value as TherapistFollowUpState)
              }
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
            >
              <option value="none">후속 조치 없음</option>
              <option value="monitor">관찰 필요</option>
              <option value="follow_up">후속 점검 필요</option>
              <option value="priority">우선 검토</option>
            </select>
            <textarea
              value={memoDraft}
              onChange={(event) => setMemoDraft(event.target.value)}
              placeholder="사용자 발화 경향과 다음 세션 체크 포인트를 기록해 주세요."
              className="mt-3 min-h-[152px] w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
            />
            {noteNotice ? <p className="mt-3 text-xs font-bold text-emerald-600">{noteNotice}</p> : null}
            {noteError ? <p className="mt-3 text-xs font-bold text-rose-600">{noteError}</p> : null}
            {retryNotice ? <p className="mt-3 text-xs font-bold text-emerald-600">{retryNotice}</p> : null}
            {retryError ? <p className="mt-3 text-xs font-bold text-rose-600">{retryError}</p> : null}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-500">
                {note?.updatedAt
                  ? `${formatDate(new Date(note.updatedAt).getTime())} 업데이트`
                  : "저장된 메모 없음"}
              </div>
              <button
                type="button"
                onClick={saveNote}
                disabled={isSavingNote}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingNote ? "저장 중..." : "메모 저장"}
              </button>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-emerald-600" />
              <h3 className="text-xl font-black text-slate-950">연결 미디어</h3>
            </div>
            {!mediaItems.length ? (
              <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
                최근 세션에 연결된 미디어가 없습니다.
              </p>
            ) : (
              <div className="mt-5 space-y-2">
                {mediaItems.map((item, index) => (
                  <a
                    key={`${item.historyId}-${item.href}-${index}`}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-2">
                      {item.type === "audio" ? (
                        <Music className="h-4 w-4 text-sky-600" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-violet-600" />
                      )}
                      {item.label}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {item.sessionLabel}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </section>
  );
}
