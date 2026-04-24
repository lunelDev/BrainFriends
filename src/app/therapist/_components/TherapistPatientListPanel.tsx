"use client";

// 종합 대시보드의 "내 환자" 섹션.
// - 전에는 대시보드(상위 5명) + /therapist/patients(전체) 두 화면으로 분리되어 있었으나,
//   치료사 동선에서 굳이 두 화면일 이유가 없어 한 곳으로 통합한다.
// - 데이터(환자 요약 + 메모)는 RSC 에서 fetch 해 prop 으로 내려오고, 검색/필터만 클라이언트에서 한다.
// - 위험도(critical/warning/normal) 우선 정렬, follow-up 뱃지, 모드 카운트 칩, 누적 합계까지 한 줄에.

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  NotebookPen,
  Search,
} from "lucide-react";
import type {
  TherapistFollowUpState,
  TherapistPatientNote,
} from "@/lib/server/therapistNotes";

export type TherapistPatientRow = {
  patientId: string;
  patientPseudonymId: string;
  patientName: string;
  patientCode: string;
  loginId: string | null;
  latestActivityAt: string | null;
  selfAssessmentCount: number;
  rehabCount: number;
  singCount: number;
};

type Props = {
  patients: TherapistPatientRow[];
  patientNotes: Record<string, TherapistPatientNote>;
  initialQuery?: string;
};

type PatientRiskLevel = "critical" | "warning" | "normal";
type PatientRisk = { level: PatientRiskLevel; label: string };

function formatDateTime(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  // SSR(Node, ko-KR) 과 브라우저 locale 이 다를 때 "오후"/"PM" 이 뒤바뀌어
  // hydration mismatch 가 발생한다. 24h 고정 + 수동 포맷으로 양쪽 동일하게 찍는다.
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${mm}. ${dd}. ${hh}:${mi}`;
}

function getPatientRisk(patient: TherapistPatientRow): PatientRisk {
  const activity =
    (patient.selfAssessmentCount ?? 0) +
    (patient.rehabCount ?? 0) +
    (patient.singCount ?? 0);
  if (activity === 0) return { level: "critical", label: "활동 없음" };
  if (!patient.latestActivityAt) return { level: "warning", label: "기록 없음" };
  const ts = new Date(patient.latestActivityAt).getTime();
  if (Number.isNaN(ts)) return { level: "warning", label: "기록 없음" };
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days >= 30) return { level: "critical", label: `${days}일 미접속` };
  if (days >= 7) return { level: "warning", label: `${days}일 미접속` };
  return { level: "normal", label: "정상" };
}

const RISK_RANK: Record<PatientRiskLevel, number> = {
  critical: 0,
  warning: 1,
  normal: 2,
};

function getFollowUpLabel(state: TherapistFollowUpState | null | undefined) {
  if (state === "monitor") return "관찰";
  if (state === "follow_up") return "후속 점검";
  if (state === "priority") return "우선 검토";
  return "메모";
}

function getFollowUpClass(state: TherapistFollowUpState | null | undefined) {
  if (state === "priority") return "bg-rose-50 text-rose-700 border-rose-200";
  if (state === "follow_up") return "bg-amber-50 text-amber-700 border-amber-200";
  if (state === "monitor") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function summarizeMemo(memo: string, max = 80) {
  const trimmed = memo.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function TherapistPatientListPanel({
  patients,
  patientNotes,
  initialQuery = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);

  const sortedPatients = useMemo(() => {
    return [...patients]
      .map((p) => ({ patient: p, risk: getPatientRisk(p) }))
      .sort((a, b) => {
        const rankDiff = RISK_RANK[a.risk.level] - RISK_RANK[b.risk.level];
        if (rankDiff !== 0) return rankDiff;
        const ta = a.patient.latestActivityAt
          ? new Date(a.patient.latestActivityAt).getTime()
          : 0;
        const tb = b.patient.latestActivityAt
          ? new Date(b.patient.latestActivityAt).getTime()
          : 0;
        return tb - ta;
      });
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedPatients;
    return sortedPatients.filter(({ patient }) =>
      [
        patient.patientName,
        patient.patientCode,
        patient.loginId,
        patient.patientPseudonymId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [sortedPatients, query]);

  return (
    <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">
            내 환자 목록
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            환자 검색 · 위험도 정렬
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            장기 미접속·활동 없음 환자가 위로 정렬됩니다. 행을 누르면 환자 상세로 이동합니다.
          </p>
        </div>
        <label className="block w-full min-w-0 sm:w-auto sm:min-w-[280px]">
          <span className="sr-only">환자 검색</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="검색"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-xs font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none"
            />
          </div>
        </label>
      </div>

      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        전체 {patients.length}명 · 표시 {filteredPatients.length}명
      </p>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200">
        {filteredPatients.length ? (
          <ul className="divide-y divide-slate-200">
            {filteredPatients.map(({ patient: user, risk }, index) => {
              const codeAccent =
                index % 4 === 0
                  ? "bg-sky-100 text-sky-700"
                  : index % 4 === 1
                    ? "bg-emerald-100 text-emerald-700"
                    : index % 4 === 2
                      ? "bg-violet-100 text-violet-700"
                      : "bg-orange-100 text-orange-700";
              const totalCount =
                (user.selfAssessmentCount ?? 0) +
                (user.rehabCount ?? 0) +
                (user.singCount ?? 0);
              const riskClass =
                risk.level === "critical"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : risk.level === "warning"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "";
              const note = patientNotes[user.patientId];
              return (
                <li key={user.patientId}>
                  <Link
                    href={`/therapist/patients/${user.patientId}`}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 transition hover:bg-slate-50"
                  >
                    <span
                      className={`inline-flex flex-none items-center justify-center rounded-md px-2 py-1 font-mono text-[11px] font-black tracking-tight ${codeAccent}`}
                      title={user.patientCode || ""}
                    >
                      {user.patientCode || "—"}
                    </span>

                    <div className="min-w-0 flex-1 basis-44">
                      <p className="truncate text-sm font-black text-slate-950">
                        {user.patientName}
                        <span className="ml-2 truncate text-[11px] font-medium text-slate-500">
                          {user.loginId || "로그인 ID 없음"}
                        </span>
                      </p>
                    </div>

                    {risk.level !== "normal" ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${riskClass}`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {risk.label}
                      </span>
                    ) : null}

                    {note ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${getFollowUpClass(note.followUpState)}`}
                        title={note.memo ? summarizeMemo(note.memo, 80) : undefined}
                      >
                        <NotebookPen className="h-3 w-3" />
                        {getFollowUpLabel(note.followUpState)}
                      </span>
                    ) : null}

                    <div className="hidden items-center gap-1 text-xs font-bold text-slate-600 sm:inline-flex">
                      <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                      {formatDateTime(user.latestActivityAt)}
                    </div>

                    <div className="inline-flex items-center gap-1 text-[11px] font-black">
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-700">
                        자가 {user.selfAssessmentCount}
                      </span>
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
                        재활 {user.rehabCount}
                      </span>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                        노래 {user.singCount}
                      </span>
                    </div>

                    <div className="ml-auto inline-flex items-center gap-2">
                      <span className="text-sm font-black text-slate-950">
                        {totalCount}건
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
            {query.trim()
              ? "검색 조건에 맞는 환자가 없습니다."
              : "아직 표시할 환자가 없습니다."}
          </div>
        )}
      </div>
    </article>
  );
}
