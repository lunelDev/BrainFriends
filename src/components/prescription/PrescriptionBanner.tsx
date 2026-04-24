// src/components/prescription/PrescriptionBanner.tsx
//
// 마이페이지 상단 배너.
// 내부 로직:
//   1) /api/prescriptions/me 조회
//   2) 처방 없음 → RedeemForm 노출
//   3) 처방 활성 → ActivePrescriptionCard 노출 (남은 일수 / 이번 주 완료율)
//   4) prescription=required / expired 쿼리 힌트가 있으면 해당 메시지 강조

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ApiPrescription = {
  id: string;
  code: string;
  programScope: string[];
  durationWeeks: number;
  sessionsPerWeek: number;
  sessionMinutes: number;
  startsAt: string;
  expiresAt: string;
  status: string;
};

type ApiAdherence = {
  weekIndex: number;
  completed: number;
  target: number;
  ratio: number;
};

type MeResponse = {
  ok: boolean;
  prescription: ApiPrescription | null;
  adherence: ApiAdherence | null;
  remainingDays?: number;
  error?: string;
};

function formatProgramList(scope: string[]): string {
  if (!scope.length) return "-";
  return scope.join(", ");
}

function RedeemForm({
  hint,
  onRedeemed,
}: {
  hint: "required" | "expired" | null;
  onRedeemed: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) {
        setError("처방 코드를 입력해 주세요.");
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/prescriptions/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok) {
          const msg = data?.error || `등록 실패 (HTTP ${res.status})`;
          if (msg === "prescription_not_found") {
            setError("해당 코드의 처방을 찾을 수 없습니다.");
          } else if (msg === "prescription_owner_mismatch") {
            setError("이 코드는 다른 환자에게 발급된 처방입니다.");
          } else if (msg.startsWith("prescription_")) {
            setError("이미 사용되었거나 만료된 처방입니다.");
          } else {
            setError(msg);
          }
          return;
        }
        setCode("");
        onRedeemed();
      } catch (err) {
        setError(err instanceof Error ? err.message : "redeem_failed");
      } finally {
        setBusy(false);
      }
    },
    [code, onRedeemed],
  );

  const headline =
    hint === "expired"
      ? "이전 처방이 만료되었습니다. 새 처방 코드를 입력해 주세요."
      : hint === "required"
        ? "학습을 시작하려면 의료진이 발급한 처방 코드가 필요합니다."
        : "의료진이 발급한 처방 코드가 있으신가요?";

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-4 md:px-6 md:py-5">
      <div className="text-sm md:text-base font-semibold text-indigo-900">
        {headline}
      </div>
      <p className="mt-1 text-xs md:text-sm text-indigo-800/80">
        8자리 영숫자 코드(예: <span className="font-mono">A7K9P3QR</span>)를 입력하면
        담당 의사가 처방한 프로그램이 활성화됩니다.
      </p>
      <form
        onSubmit={submit}
        className="mt-3 flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="처방 코드"
          maxLength={16}
          inputMode="text"
          autoCapitalize="characters"
          className="flex-1 rounded-md border border-indigo-300 bg-white px-3 py-2 font-mono text-sm tracking-wider uppercase focus:border-indigo-500 focus:outline-none"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-indigo-300"
        >
          {busy ? "확인 중..." : "처방 등록"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

function ActivePrescriptionCard({
  prescription,
  adherence,
  remainingDays,
}: {
  prescription: ApiPrescription;
  adherence: ApiAdherence | null;
  remainingDays: number | null;
}) {
  const pct = adherence
    ? Math.min(100, Math.round(adherence.ratio * 100))
    : 0;
  const dosingText = `주 ${prescription.sessionsPerWeek}회 · 회당 ${prescription.sessionMinutes}분 · ${prescription.durationWeeks}주`;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 md:px-6 md:py-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            처방 활성
          </div>
          <div className="mt-1 text-sm md:text-base font-semibold text-emerald-900">
            {formatProgramList(prescription.programScope)}
          </div>
          <div className="text-xs text-emerald-800/80 mt-0.5">{dosingText}</div>
        </div>
        {typeof remainingDays === "number" ? (
          <div className="text-right">
            <div className="text-xs text-emerald-700">남은 처방 기간</div>
            <div className="text-lg font-bold text-emerald-900">
              {remainingDays}일
            </div>
          </div>
        ) : null}
      </div>

      {adherence ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-emerald-800">
            <span>이번 주 진행률</span>
            <span className="font-semibold">
              {adherence.completed} / {adherence.target} 회
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PrescriptionBanner() {
  const [state, setState] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<"required" | "expired" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("prescription");
    if (flag === "required" || flag === "expired") {
      setHint(flag);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prescriptions/me", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as MeResponse | null;
      if (res.ok && data?.ok) {
        setState(data);
      } else {
        setState({ ok: false, prescription: null, adherence: null });
      }
    } catch {
      setState({ ok: false, prescription: null, adherence: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          처방 정보를 확인하는 중...
        </div>
      );
    }
    if (!state?.prescription) {
      return (
        <RedeemForm
          hint={hint}
          onRedeemed={() => {
            setHint(null);
            refresh();
          }}
        />
      );
    }
    return (
      <ActivePrescriptionCard
        prescription={state.prescription}
        adherence={state.adherence}
        remainingDays={state.remainingDays ?? null}
      />
    );
  }, [loading, state, hint, refresh]);

  return <div className="mb-4 md:mb-6">{content}</div>;
}
