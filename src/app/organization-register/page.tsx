"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import OrganizationBasicFields, {
  normalizeOrganizationPhone,
  validateOrganizationBasicFields,
} from "@/components/organization/OrganizationBasicFields";

type FormState = {
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationType: string;
  businessLicenseFileName: string;
  businessLicenseFileDataUrl: string;
  careInstitutionNumber: string;
  organizationPhone: string;
  postalCode: string;
  roadAddress: string;
  addressDetail: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  medicalDataAgreed: boolean;
};

const INITIAL_FORM: FormState = {
  organizationName: "",
  businessNumber: "",
  representativeName: "",
  organizationType: "",
  businessLicenseFileName: "",
  businessLicenseFileDataUrl: "",
  careInstitutionNumber: "",
  organizationPhone: "",
  postalCode: "",
  roadAddress: "",
  addressDetail: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  termsAgreed: false,
  privacyAgreed: false,
  medicalDataAgreed: false,
};

async function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

export default function OrganizationRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleBusinessLicenseUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      updateField("businessLicenseFileName", "");
      updateField("businessLicenseFileDataUrl", "");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("사업자등록증 파일은 5MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setError("");
    setIsReadingFile(true);
    try {
      const dataUrl = await toDataUrl(file);
      updateField("businessLicenseFileName", file.name);
      updateField("businessLicenseFileDataUrl", dataUrl);
    } catch {
      setError("사업자등록증 파일을 읽지 못했습니다.");
      event.target.value = "";
    } finally {
      setIsReadingFile(false);
    }
  };

  const validate = () => {
    const basicError = validateOrganizationBasicFields({
      organizationName: form.organizationName,
      businessNumber: form.businessNumber,
      representativeName: form.representativeName,
      organizationType: form.organizationType,
      careInstitutionNumber: form.careInstitutionNumber,
      businessLicenseFileName: form.businessLicenseFileName,
      businessLicenseFileDataUrl: form.businessLicenseFileDataUrl,
      organizationPhone: form.organizationPhone,
      postalCode: form.postalCode,
      roadAddress: form.roadAddress,
      addressDetail: form.addressDetail,
    });
    if (basicError) return basicError;

    const contactRequired = [
      form.contactName.trim(),
      form.contactPhone.trim(),
      form.contactEmail.trim(),
    ];
    if (contactRequired.some((item) => !item)) {
      return "담당자 정보를 모두 입력해 주세요.";
    }

    if (!form.termsAgreed || !form.privacyAgreed || !form.medicalDataAgreed) {
      return "필수 동의 항목을 모두 체크해 주세요.";
    }

    return "";
  };

  const submit = async () => {
    setError("");
    setSuccess("");

    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/organization-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName,
          businessNumber: form.businessNumber,
          representativeName: form.representativeName,
          organizationType: form.organizationType,
          businessLicenseFileName: form.businessLicenseFileName,
          businessLicenseFileDataUrl: form.businessLicenseFileDataUrl,
          careInstitutionNumber: form.careInstitutionNumber,
          organizationPhone: form.organizationPhone,
          postalCode: form.postalCode,
          roadAddress: form.roadAddress,
          addressDetail: form.addressDetail,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          termsAgreed: form.termsAgreed,
          privacyAgreed: form.privacyAgreed,
          medicalDataAgreed: form.medicalDataAgreed,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setError(
          payload?.error === "organization_already_exists"
            ? "같은 이름·사업자번호·요양기관번호의 기관이 이미 등록 또는 신청 중입니다."
            : payload?.error === "invalid_request_payload"
              ? "기관 등록 정보가 누락되었거나 잘못되었습니다."
              : "기관 등록 요청에 실패했습니다. 필수 항목을 확인해 주세요.",
        );
        return;
      }

      setSuccess("기관 등록 요청이 접수되었습니다.");
      setForm(INITIAL_FORM);

      if (typeof window !== "undefined") {
        window.location.assign("/?organizationRequested=1");
        return;
      }

      router.replace("/?organizationRequested=1");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-[36px] border border-orange-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">
              Institution Request
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              기관 등록 요청
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              기관은 회원가입 대상이 아니라 승인 대상입니다. 기본 식별 정보와 담당자
              정보만 먼저 접수하고, 승인 후 일반 회원과 치료사가 선택할 수 있게 합니다.
            </p>
          </div>
          <Link
            href="/signup"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            회원가입으로
          </Link>
        </div>

        <div className="mt-8 grid gap-6">
          <SectionCard
            title="기관 기본 정보"
            description="법적 식별과 기관 확인에 필요한 최소 정보와 연락처를 입력합니다."
          >
            <OrganizationBasicFields
              value={{
                organizationName: form.organizationName,
                businessNumber: form.businessNumber,
                representativeName: form.representativeName,
                organizationType: form.organizationType,
                careInstitutionNumber: form.careInstitutionNumber,
                businessLicenseFileName: form.businessLicenseFileName,
                businessLicenseFileDataUrl: form.businessLicenseFileDataUrl,
                organizationPhone: form.organizationPhone,
                postalCode: form.postalCode,
                roadAddress: form.roadAddress,
                addressDetail: form.addressDetail,
              }}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              onLicenseFileChange={handleBusinessLicenseUpload}
              isReadingLicense={isReadingFile}
            />
          </SectionCard>

          <SectionCard
            title="담당자 정보"
            description="승인 결과와 운영 공지를 받을 담당자 정보를 입력합니다."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="담당자명 *">
                <input
                  className="input-style"
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                  placeholder="담당자 이름"
                />
              </Field>
              <Field label="담당자 휴대폰 *">
                <input
                  className="input-style"
                  value={form.contactPhone}
                  onChange={(event) =>
                    updateField("contactPhone", normalizeOrganizationPhone(event.target.value))
                  }
                  placeholder="담당자 휴대폰"
                />
              </Field>
              <Field label="담당자 이메일 *">
                <input
                  className="input-style"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => updateField("contactEmail", event.target.value)}
                  placeholder="manager@hospital.kr"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="필수 동의"
            description="기관 심사와 데이터 처리 검토를 위한 최소 동의 항목입니다."
          >
            <div className="grid gap-3">
              <ConsentCheck
                checked={form.termsAgreed}
                onChange={(checked) => updateField("termsAgreed", checked)}
                label="기관 등록 요청 절차와 약관에 동의합니다. *"
              />
              <ConsentCheck
                checked={form.privacyAgreed}
                onChange={(checked) => updateField("privacyAgreed", checked)}
                label="담당자 개인정보 처리에 동의합니다. *"
              />
              <ConsentCheck
                checked={form.medicalDataAgreed}
                onChange={(checked) => updateField("medicalDataAgreed", checked)}
                label="의료데이터 처리 및 보안 정책에 동의합니다. *"
              />
            </div>
          </SectionCard>

          {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}
          {success ? <p className="text-sm font-bold text-emerald-600">{success}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting || isReadingFile}
              className="inline-flex h-13 min-w-[220px] items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
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
        </div>

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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-base font-black text-slate-900">{title}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{description}</p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

function ConsentCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
      />
      <span className="text-sm font-semibold leading-6 text-slate-700">{label}</span>
    </label>
  );
}
