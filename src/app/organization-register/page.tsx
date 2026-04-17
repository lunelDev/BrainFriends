"use client";

import Link from "next/link";
import { useState } from "react";

type FormState = {
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationPhone: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

function formatBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}

export default function OrganizationRegisterPage() {
  const [form, setForm] = useState<FormState>({
    organizationName: "",
    businessNumber: "",
    representativeName: "",
    organizationPhone: "",
    address: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError("");
    setSuccess("");

    if (!form.organizationName.trim() || !form.address.trim() || !form.contactName.trim()) {
      setError("기관명, 기관 주소, 담당자명은 필수입니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/organization-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError("기관 등록 요청에 실패했습니다.");
        return;
      }

      setSuccess("기관 등록 요청이 접수되었습니다. 관리자 확인 후 회원가입 목록에 반영됩니다.");
      setForm({
        organizationName: "",
        businessNumber: "",
        representativeName: "",
        organizationPhone: "",
        address: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto max-w-4xl rounded-[36px] border border-orange-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">
              Organization Request
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              기관 등록 요청
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              병원 또는 기관이 회원가입 목록에 없다면 이 화면에서 등록 요청을 제출해
              주세요. 승인 후 사용자와 치료사가 해당 기관을 선택해 가입할 수 있습니다.
            </p>
          </div>
          <Link
            href="/signup"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            회원가입으로
          </Link>
        </div>

        <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-base font-black text-slate-900">기관 정보 입력</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              기관 자체 회원가입이 아니라 등록 요청 단계입니다. 승인 전까지는 가입 목록에
              노출되지 않습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
            <Field label="기관명 *">
              <input
                className="input-style"
                value={form.organizationName}
                onChange={(event) => updateField("organizationName", event.target.value)}
                placeholder="기관명 또는 병원명"
              />
            </Field>
            <Field label="사업자등록번호">
              <input
                className="input-style"
                value={form.businessNumber}
                onChange={(event) =>
                  updateField("businessNumber", formatBusinessNumber(event.target.value))
                }
                placeholder="123-45-67890"
              />
            </Field>
            <Field label="대표자명">
              <input
                className="input-style"
                value={form.representativeName}
                onChange={(event) => updateField("representativeName", event.target.value)}
                placeholder="대표자명"
              />
            </Field>
            <Field label="기관 연락처">
              <input
                className="input-style"
                value={form.organizationPhone}
                onChange={(event) => updateField("organizationPhone", event.target.value)}
                placeholder="기관 대표 연락처"
              />
            </Field>
            <Field label="기관 주소 *">
              <input
                className="input-style"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                placeholder="기관 주소"
              />
            </Field>
            <div />
            <Field label="담당자명 *">
              <input
                className="input-style"
                value={form.contactName}
                onChange={(event) => updateField("contactName", event.target.value)}
                placeholder="담당자명"
              />
            </Field>
            <Field label="담당자 연락처">
              <input
                className="input-style"
                value={form.contactPhone}
                onChange={(event) => updateField("contactPhone", event.target.value)}
                placeholder="담당자 연락처"
              />
            </Field>
            <Field label="담당자 이메일">
              <input
                className="input-style"
                value={form.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                placeholder="example@hospital.kr"
              />
            </Field>
          </div>

          {error ? <p className="mt-4 text-sm font-bold text-red-500">{error}</p> : null}
          {success ? <p className="mt-4 text-sm font-bold text-emerald-600">{success}</p> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="inline-flex h-13 min-w-[200px] items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "요청 접수 중..." : "기관 등록 요청하기"}
            </button>
            <Link
              href="/signup"
              className="inline-flex h-13 min-w-[140px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-base font-black text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </Link>
          </div>
        </section>

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
