"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createOrganization } from "@/lib/client/adminOrganizationsApi";

type OrganizationRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  source?: "builtin" | "manual";
};

type FormState = {
  name: string;
  address: string;
  businessNumber: string;
  representativeName: string;
  organizationPhone: string;
};

function formatBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}

export default function TherapistOrganizationsPage() {
  const [items, setItems] = useState<OrganizationRow[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
    address: "",
    businessNumber: "",
    representativeName: "",
    organizationPhone: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrganizations = async () => {
    const response = await fetch("/api/organizations", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.ok && Array.isArray(payload.organizations)) {
      setItems(payload.organizations);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError("");
    setSuccessMessage("");
    if (!form.name.trim() || !form.address.trim()) {
      setError("기관명과 주소는 필수입니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrganization(form);
      setSuccessMessage("기관이 등록되었습니다.");
      setForm({
        name: "",
        address: "",
        businessNumber: "",
        representativeName: "",
        organizationPhone: "",
      });
      await loadOrganizations();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "기관 등록에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">
              Organizations
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              기관 등록 및 목록 관리
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              기관은 회원가입과 분리해 관리자 화면에서 등록합니다. 사용자와 치료사는 등록된 기관만 선택해 가입합니다.
            </p>
          </div>
          <Link
            href="/therapist/system"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            시스템으로 돌아가기
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-black text-slate-700">기관명</th>
                <th className="px-4 py-3 text-left font-black text-slate-700">기관 코드</th>
                <th className="px-4 py-3 text-left font-black text-slate-700">주소</th>
                <th className="px-4 py-3 text-left font-black text-slate-700">구분</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.code}</td>
                  <td className="px-4 py-3 text-slate-600">{item.address}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                      {item.source === "manual" ? "관리자 등록" : "기본 기관"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600">
          New Organization
        </p>
        <h3 className="mt-3 text-xl font-black text-slate-950">기관 등록</h3>
        <div className="mt-5 space-y-4">
          <Field label="기관명 *">
            <input
              className="input-style"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
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
        </div>

        {error ? <p className="mt-4 text-sm font-bold text-red-500">{error}</p> : null}
        {successMessage ? (
          <p className="mt-4 text-sm font-bold text-emerald-600">{successMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className="mt-6 rounded-full bg-amber-600 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "등록 중..." : "기관 등록"}
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
            border-color: #f59e0b;
            background: white;
            box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
          }
        `}</style>
      </aside>
    </section>
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
