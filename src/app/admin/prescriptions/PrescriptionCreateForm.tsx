// src/app/admin/prescriptions/PrescriptionCreateForm.tsx
// 관리자/처방자용 임시 처방 발급 폼.

"use client";

import { useState } from "react";

const PROGRAM_OPTIONS = [
  { value: "step-1", label: "Step 1 (자가진단)" },
  { value: "step-2", label: "Step 2 (음성 분석)" },
  { value: "step-3", label: "Step 3" },
  { value: "step-4", label: "Step 4" },
  { value: "step-5", label: "Step 5" },
  { value: "step-6", label: "Step 6" },
  { value: "lingo", label: "Lingofriend" },
  { value: "sing-training", label: "노래방 훈련" },
];

const DEFAULT_SCOPE = ["step-2", "step-4", "step-5", "lingo"];

type ApiResult = {
  ok?: boolean;
  prescription?: {
    id: string;
    code: string;
    durationWeeks: number;
    sessionsPerWeek: number;
    sessionMinutes: number;
    programScope: string[];
    startsAt: string;
    expiresAt: string;
    status: string;
  };
  error?: string;
};

export function PrescriptionCreateForm() {
  const [patientUserId, setPatientUserId] = useState("");
  const [patientPseudonymId, setPatientPseudonymId] = useState("");
  const [scope, setScope] = useState<string[]>(DEFAULT_SCOPE);
  const [durationWeeks, setDurationWeeks] = useState("12");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("3");
  const [sessionMinutes, setSessionMinutes] = useState("20");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleScope(value: string) {
    setScope((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!patientUserId.trim() || !patientPseudonymId.trim()) {
      setError("환자 user ID 와 pseudonym ID 가 모두 필요합니다.");
      return;
    }
    if (!scope.length) {
      setError("최소 한 개 프로그램을 선택해 주세요.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientUserId: patientUserId.trim(),
          patientPseudonymId: patientPseudonymId.trim(),
          programScope: scope,
          durationWeeks: Number(durationWeeks),
          sessionsPerWeek: Number(sessionsPerWeek),
          sessionMinutes: Number(sessionMinutes),
        }),
      });
      const data = (await res.json().catch(() => null)) as ApiResult | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || `실패 (HTTP ${res.status})`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="font-semibold text-slate-700">환자 user ID (UUID)</span>
            <input
              type="text"
              value={patientUserId}
              onChange={(e) => setPatientUserId(e.target.value)}
              placeholder="app_users.user_id"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              disabled={busy}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="font-semibold text-slate-700">patient_pseudonym_id</span>
            <input
              type="text"
              value={patientPseudonymId}
              onChange={(e) => setPatientPseudonymId(e.target.value)}
              placeholder="patient_pseudonym_map.patient_pseudonym_id"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              disabled={busy}
            />
          </label>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-700">허용 프로그램</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROGRAM_OPTIONS.map((opt) => {
              const active = scope.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggleScope(opt.value)}
                  disabled={busy}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm space-y-1">
            <span className="font-semibold text-slate-700">처방 기간 (주)</span>
            <input
              type="number"
              value={durationWeeks}
              min={1}
              max={52}
              onChange={(e) => setDurationWeeks(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="font-semibold text-slate-700">주당 세션 수</span>
            <input
              type="number"
              value={sessionsPerWeek}
              min={1}
              max={14}
              onChange={(e) => setSessionsPerWeek(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="font-semibold text-slate-700">세션 시간 (분)</span>
            <input
              type="number"
              value={sessionMinutes}
              min={1}
              max={240}
              onChange={(e) => setSessionMinutes(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3">
          {error ? (
            <span className="text-xs text-rose-600">{error}</span>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-indigo-300"
          >
            {busy ? "발급 중..." : "처방 발급"}
          </button>
        </div>
      </form>

      {result?.prescription ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            발급 완료
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="font-mono text-2xl font-bold tracking-widest text-emerald-900">
              {result.prescription.code}
            </div>
            <button
              type="button"
              onClick={() => {
                if (result.prescription) {
                  navigator.clipboard
                    ?.writeText(result.prescription.code)
                    .catch(() => {});
                }
              }}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              코드 복사
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-900">
            <dt className="font-semibold">프로그램</dt>
            <dd>{result.prescription.programScope.join(", ")}</dd>
            <dt className="font-semibold">기간</dt>
            <dd>{result.prescription.durationWeeks}주</dd>
            <dt className="font-semibold">용법</dt>
            <dd>
              주 {result.prescription.sessionsPerWeek}회 · 회당{" "}
              {result.prescription.sessionMinutes}분
            </dd>
            <dt className="font-semibold">상태</dt>
            <dd>{result.prescription.status}</dd>
            <dt className="font-semibold">만료</dt>
            <dd>
              {new Date(result.prescription.expiresAt).toLocaleString("ko-KR")}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-emerald-800">
            환자가 마이페이지의 처방 코드 입력 폼에 위 코드를 입력하면 활성화됩니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
