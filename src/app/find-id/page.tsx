"use client";

import { useState } from "react";
import Link from "next/link";

type RecoveryForm = {
  name: string;
  birthDate: string;
  phoneLast4: string;
};

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export default function FindIdPage() {
  const [form, setForm] = useState<RecoveryForm>({
    name: "",
    birthDate: "",
    phoneLast4: "",
  });
  const [error, setError] = useState("");
  const [foundLoginId, setFoundLoginId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key: keyof RecoveryForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError("");
    setFoundLoginId("");
    if (
      !form.name.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) ||
      !/^\d{4}$/.test(form.phoneLast4)
    ) {
      setError("이름, 생년월일, 전화번호 뒤 4자리를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/find-login-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.loginId) {
        setError(
          payload?.error === "account_not_found"
            ? "일치하는 회원을 찾지 못했습니다."
            : "아이디 찾기에 실패했습니다.",
        );
        return;
      }
      setFoundLoginId(payload.loginId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto max-w-xl rounded-[32px] border border-orange-100 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
              Find ID
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              아이디 찾기
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              가입 시 입력한 사용자 정보로 아이디를 조회합니다.
            </p>
          </div>
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-slate-700">
            로그인으로
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          <Field label="이름">
            <input className="input-style" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
          </Field>
          <Field label="생년월일">
            <input
              className="input-style"
              value={form.birthDate}
              onChange={(e) => updateField("birthDate", formatDateInput(e.target.value))}
              inputMode="numeric"
              maxLength={10}
              placeholder="1996-02-18"
            />
          </Field>
          <Field label="전화번호 뒤 4자리">
            <input
              className="input-style"
              inputMode="numeric"
              maxLength={4}
              value={form.phoneLast4}
              onChange={(e) => updateField("phoneLast4", e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </Field>
        </div>

        {foundLoginId ? (
          <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            조회된 아이디: {foundLoginId}
          </p>
        ) : null}
        {error ? <p className="mt-5 text-sm font-bold text-red-500">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "조회 중..." : "아이디 찾기"}
        </button>

        <style jsx>{`
          .input-style {
            width: 100%;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            padding: 14px 16px;
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
          }
          .input-style:focus {
            outline: none;
            border-color: #f97316;
            background: white;
            box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
          }
        `}</style>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
