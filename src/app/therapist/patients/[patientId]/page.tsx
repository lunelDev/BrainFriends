"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileDown,
  ImageIcon,
  MessageSquare,
  Music,
  ScanFace,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
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

  useEffect(() => {
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
  }, [patientId]);

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
            <Link
              href="/therapist/patients"
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
            >
              사용자 목록
            </Link>
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
              <div className="mt-4 grid grid-cols-3 gap-3">
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-sky-600" />
              <h3 className="text-xl font-black text-slate-950">최근 세션 해석</h3>
            </div>
            <Link
              href="/therapist/results"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              전체 결과 보기
            </Link>
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
