// src/components/adverse-events/AdverseEventReportButton.tsx
//
// 환자 마이페이지에서 "불편/이상반응 신고" 1-클릭 버튼 + 모달.
// IRB·시판 후 안전관리 데이터 수집의 환자 측 진입점.

"use client";

import { useCallback, useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "headache", label: "두통" },
  { value: "fatigue", label: "전신 피로" },
  { value: "dizziness", label: "어지러움" },
  { value: "voice_fatigue", label: "음성 피로" },
  { value: "eye_fatigue", label: "눈 피로" },
  { value: "anxiety", label: "불안·긴장" },
  { value: "other", label: "기타" },
];

const SEVERITY_OPTIONS: {
  value: 1 | 2 | 3;
  label: string;
  caption: string;
  tone: string;
}[] = [
  { value: 1, label: "경미", caption: "불편하지만 사용 계속 가능", tone: "emerald" },
  { value: 2, label: "중간", caption: "사용 중단·휴식 필요", tone: "amber" },
  { value: 3, label: "심각", caption: "즉시 의료진 상담 필요", tone: "rose" },
];

export function AdverseEventReportButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [severity, setSeverity] = useState<1 | 2 | 3 | null>(null);
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const reset = useCallback(() => {
    setCategory("");
    setSeverity(null);
    setFreeText("");
    setError(null);
    setSuccess(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setTimeout(reset, 200);
  }, [reset]);

  const submit = useCallback(async () => {
    if (!category) {
      setError("증상 종류를 선택해 주세요.");
      return;
    }
    if (!severity) {
      setError("심각도를 선택해 주세요.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/adverse-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          severity,
          freeText: freeText.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || `신고 실패 (HTTP ${res.status})`);
        return;
      }
      setSuccess(true);
      setTimeout(close, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "report_failed");
    } finally {
      setBusy(false);
    }
  }, [category, severity, freeText, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
      >
        ⚠ 불편 / 이상반응 신고
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  이상반응 신고
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  학습 중·후 발생한 신체적·정서적 불편을 알려 주세요. 담당
                  의료진이 검토합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-center">
                <div className="text-sm font-semibold text-emerald-800">
                  신고가 접수되었습니다.
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  담당 의료진에게 자동 전달됩니다.
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-700">
                    증상 종류
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((opt) => {
                      const active = category === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setCategory(opt.value)}
                          disabled={busy}
                          className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                            active
                              ? "border-rose-500 bg-rose-50 text-rose-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-700">
                    심각도
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {SEVERITY_OPTIONS.map((opt) => {
                      const active = severity === opt.value;
                      const colorMap: Record<string, string> = {
                        emerald:
                          "border-emerald-500 bg-emerald-50 text-emerald-800",
                        amber: "border-amber-500 bg-amber-50 text-amber-800",
                        rose: "border-rose-500 bg-rose-50 text-rose-800",
                      };
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setSeverity(opt.value)}
                          disabled={busy}
                          className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                            active
                              ? colorMap[opt.tone]
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className="opacity-80">{opt.caption}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-700">
                    상세 내용 (선택)
                  </label>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={3}
                    placeholder="언제, 어떤 활동 중에 발생했는지 자유롭게 작성"
                    maxLength={500}
                    className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                    disabled={busy}
                  />
                </div>

                {error ? (
                  <p className="mt-2 text-xs text-rose-600">{error}</p>
                ) : null}

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !category || !severity}
                    className="rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-rose-300"
                  >
                    {busy ? "신고 중..." : "신고"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
