"use client";

import { useState } from "react";
import Link from "next/link";

type ResetForm = {
  name: string;
  birthDate: string;
  phoneLast4: string;
  newPassword: string;
  confirmPassword: string;
};

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export default function ResetPasswordPage() {
  const [form, setForm] = useState<ResetForm>({
    name: "",
    birthDate: "",
    phoneLast4: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateField = (key: keyof ResetForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError("");
    setNotice("");
    if (
      !form.name.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) ||
      !/^\d{4}$/.test(form.phoneLast4)
    ) {
      setError("이름, 생년월일, 전화번호 뒤 4자리를 입력해 주세요.");
      return;
    }
    if (form.newPassword.length < 6 || form.newPassword !== form.confirmPassword) {
      setError("새 비밀번호를 확인해 주세요. 6자 이상이어야 하며 두 값이 일치해야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          payload?.error === "account_not_found"
            ? "일치하는 회원을 찾지 못했습니다."
            : "비밀번호 재설정에 실패했습니다.",
        );
        return;
      }
      setNotice("비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.");
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
              Reset Password
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              비밀번호 재설정
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              가입 시 입력한 사용자 정보로 비밀번호를 새로 설정합니다.
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
          <Field label="새 비밀번호">
            <div className="relative">
              <input
                className="input-style pr-20"
                type={showPassword ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => updateField("newPassword", e.target.value)}
                placeholder="6자 이상"
              />
              <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                {showPassword ? "숨기기" : "보기"}
              </button>
            </div>
          </Field>
          <Field label="새 비밀번호 확인">
            <div className="relative">
              <input
                className="input-style pr-20"
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
              />
              <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">
                {showConfirmPassword ? "숨기기" : "보기"}
              </button>
            </div>
          </Field>
        </div>

        {notice ? <p className="mt-5 text-sm font-bold text-emerald-600">{notice}</p> : null}
        {error ? <p className="mt-5 text-sm font-bold text-red-500">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "재설정 중..." : "비밀번호 재설정"}
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
