"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, UserRound } from "lucide-react";
import type { OrganizationCatalogEntry } from "@/lib/organizations/catalog";

type Gender = "M" | "F" | "U";
type Hemiplegia = "Y" | "N";
type Hemianopsia = "NONE" | "RIGHT" | "LEFT";
type SignupRole = "patient" | "therapist";
type TherapistOption = {
  therapistUserId: string;
  therapistName: string;
  loginId: string | null;
};

type SignupForm = {
  userRole: SignupRole;
  organizationQuery: string;
  organizationId: string;
  therapistUserId: string;
  loginId: string;
  name: string;
  birthDate: string;
  phoneLast4: string;
  password: string;
  confirmPassword: string;
  educationYears: string;
  gender: Gender;
  onsetDate: string;
  hemiplegia: Hemiplegia;
  hemianopsia: Hemianopsia;
};

function getTodayLocalDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLoginId, setIsCheckingLoginId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasChosenRole, setHasChosenRole] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationCatalogEntry[]>([]);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationCatalogEntry | null>(null);
  const [selectedTherapist, setSelectedTherapist] =
    useState<TherapistOption | null>(null);
  const [loginIdStatus, setLoginIdStatus] = useState<{
    state: "idle" | "valid" | "invalid" | "available" | "taken";
    message: string;
    checkedValue: string;
  }>({
    state: "idle",
    message: "",
    checkedValue: "",
  });
  const [form, setForm] = useState<SignupForm>({
    userRole: "patient",
    organizationQuery: "",
    organizationId: "",
    therapistUserId: "",
    loginId: "",
    name: "",
    birthDate: "",
    phoneLast4: "",
    password: "",
    confirmPassword: "",
    educationYears: "",
    gender: "U",
    onsetDate: "",
    hemiplegia: "N",
    hemianopsia: "NONE",
  });

  const todayLocalDate = getTodayLocalDate();
  const passwordMatchState =
    !form.password && !form.confirmPassword
      ? "idle"
      : form.password === form.confirmPassword
        ? "match"
        : "mismatch";

  useEffect(() => {
    void fetch("/api/organizations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.organizations)) {
          setOrganizations(payload.organizations);
        }
      });
  }, []);

  useEffect(() => {
    if (form.userRole !== "patient" || !form.organizationId) {
      setTherapists([]);
      setSelectedTherapist(null);
      setIsLoadingTherapists(false);
      return;
    }

    let cancelled = false;
    setIsLoadingTherapists(true);
    void fetch(
      `/api/organizations/${encodeURIComponent(form.organizationId)}/therapists`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .then((payload) => {
        if (cancelled) return;
        const nextTherapists =
          payload?.ok && Array.isArray(payload.therapists)
            ? (payload.therapists as TherapistOption[])
            : [];
        setTherapists(nextTherapists);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTherapists(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.organizationId, form.userRole]);

  const filteredOrganizations = useMemo(() => {
    const query = form.organizationQuery.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter((item) =>
      [item.name, item.code, item.address]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [form.organizationQuery, organizations]);

  const updateForm = (key: keyof SignupForm, value: string) => {
    if (key === "loginId") {
      setLoginIdStatus({
        state: "idle",
        message: "",
        checkedValue: "",
      });
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectRole = (role: SignupRole) => {
    setHasChosenRole(true);
    setError("");
    setSelectedOrganization(null);
    setSelectedTherapist(null);
    setTherapists([]);
    setForm((prev) => ({
      ...prev,
      userRole: role,
      organizationQuery: "",
      organizationId: "",
      therapistUserId: "",
      educationYears: role === "therapist" ? "" : prev.educationYears,
      gender: role === "therapist" ? "U" : prev.gender,
      onsetDate: role === "therapist" ? "" : prev.onsetDate,
      hemiplegia: role === "therapist" ? "N" : prev.hemiplegia,
      hemianopsia: role === "therapist" ? "NONE" : prev.hemianopsia,
    }));
  };

  const selectOrganization = (organization: OrganizationCatalogEntry) => {
    setSelectedOrganization(organization);
    setSelectedTherapist(null);
    setForm((prev) => ({
      ...prev,
      organizationId: organization.id,
      organizationQuery: organization.name,
      therapistUserId: "",
    }));
  };

  const selectTherapist = (therapist: TherapistOption) => {
    setSelectedTherapist(therapist);
    setForm((prev) => ({
      ...prev,
      therapistUserId: therapist.therapistUserId,
    }));
  };

  const checkLoginId = async () => {
    const normalized = form.loginId.trim().toLowerCase();
    if (!/^[a-z0-9_-]{4,20}$/.test(normalized)) {
      setLoginIdStatus({
        state: "invalid",
        message: "아이디는 영문 소문자, 숫자, `_`, `-`로 4~20자여야 합니다.",
        checkedValue: normalized,
      });
      return;
    }

    setIsCheckingLoginId(true);
    try {
      const response = await fetch(
        `/api/auth/check-login-id?loginId=${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setLoginIdStatus({
          state: "invalid",
          message: "아이디 확인에 실패했습니다.",
          checkedValue: normalized,
        });
        return;
      }

      if (payload.reason === "invalid_format") {
        setLoginIdStatus({
          state: "invalid",
          message: "아이디는 영문 소문자, 숫자, `_`, `-`로 4~20자여야 합니다.",
          checkedValue: normalized,
        });
        return;
      }

      setLoginIdStatus({
        state: payload.available ? "available" : "taken",
        message: payload.available
          ? "사용 가능한 아이디입니다."
          : "이미 사용 중인 아이디입니다.",
        checkedValue: normalized,
      });
    } finally {
      setIsCheckingLoginId(false);
    }
  };

  const submit = async () => {
    setError("");

    if (
      !form.name.trim() ||
      !form.loginId.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) ||
      !/^\d{4}$/.test(form.phoneLast4) ||
      form.password.length < 6 ||
      form.password !== form.confirmPassword ||
      (form.userRole === "patient" &&
        (!form.educationYears || form.gender === "U" || !form.onsetDate))
    ) {
      setError("입력값을 확인해 주세요. 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (form.userRole === "patient" && !form.organizationId) {
      setError("소속 병원을 선택해 주세요.");
      return;
    }

    if (form.userRole === "therapist" && !form.organizationId) {
      setError("소속 병원을 선택해 주세요.");
      return;
    }

    if (form.userRole === "patient" && !form.therapistUserId) {
      setError("담당 치료사를 선택해 주세요.");
      return;
    }

    const normalizedLoginId = form.loginId.trim().toLowerCase();
    if (
      loginIdStatus.state !== "available" ||
      loginIdStatus.checkedValue !== normalizedLoginId
    ) {
      setError("아이디 중복 확인을 완료해 주세요.");
      return;
    }

    if (form.birthDate > todayLocalDate) {
      setError("생년월일은 오늘 이후 날짜를 선택할 수 없습니다.");
      return;
    }

    if (form.userRole === "patient" && form.onsetDate > todayLocalDate) {
      setError("발병일은 오늘 이후 날짜를 선택할 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRole: form.userRole,
          organizationId: form.organizationId,
          therapistUserId:
            form.userRole === "patient" ? form.therapistUserId : undefined,
          loginId: form.loginId,
          name: form.name,
          birthDate: form.birthDate,
          phoneLast4: form.phoneLast4,
          password: form.password,
          educationYears:
            form.userRole === "patient" ? Number(form.educationYears) : undefined,
          onsetDate: form.userRole === "patient" ? form.onsetDate : undefined,
          hemiplegia: form.userRole === "patient" ? form.hemiplegia : undefined,
          hemianopsia:
            form.userRole === "patient" ? form.hemianopsia : undefined,
          gender: form.userRole === "patient" ? form.gender : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          payload?.error === "account_already_exists"
            ? "이미 등록된 회원입니다."
            : payload?.error === "invalid_organization"
              ? "선택한 병원 정보를 다시 확인해 주세요."
              : payload?.error === "invalid_therapist"
                ? "선택한 치료사 정보를 다시 확인해 주세요."
              : "회원가입에 실패했습니다.",
        );
        return;
      }

      router.replace(
        form.userRole === "therapist"
          ? "/?created=1&role=therapist"
          : "/?created=1",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-[36px] border border-orange-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              회원가입
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              기관 등록은 관리자 화면에서 별도로 진행하며, 개인 회원은 등록된 기관을 선택해 가입합니다.
            </p>
          </div>
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-slate-700">
            로그인으로
          </Link>
        </div>

        {!hasChosenRole ? (
          <section className="mt-10 space-y-8">
            <div className="text-center">
              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-1 text-xs font-black text-orange-700">
                개인 회원가입 전용
              </span>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                가입하실 회원 종류를 선택해 주세요.
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                이 화면은 등록된 병원(기관)에 소속될 사용자 또는 치료사 개인 계정을
                만드는 화면입니다.
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                기관 등록이 필요하다면 별도 기관 등록 요청 화면에서 먼저 접수해 주세요.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => selectRole("therapist")}
                className="group rounded-[28px] border-2 border-sky-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
              >
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full border border-sky-100 bg-slate-50 text-sky-700">
                  <Building2 className="h-10 w-10" />
                </div>
                <h3 className="mt-6 text-2xl font-black text-slate-900">
                  치료사 회원가입
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                  등록된 병원을 선택해 치료사 개인 계정으로 가입하고, 승인 후 치료사
                  콘솔을 사용합니다.
                </p>
                <span className="mt-8 inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-[#0b66c3] px-5 py-3 text-sm font-black text-white transition group-hover:bg-[#08539f]">
                  치료사 가입하기
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectRole("patient")}
                className="group rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-700">
                  <UserRound className="h-10 w-10" />
                </div>
                <h3 className="mt-6 text-2xl font-black text-slate-900">
                  사용자 회원가입
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                  등록된 병원을 선택해 개인 훈련과 결과 확인을 위한 사용자 계정을
                  생성합니다.
                </p>
                <span className="mt-8 inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-slate-500 px-5 py-3 text-sm font-black text-white transition group-hover:bg-slate-600">
                  사용자 가입하기
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <p className="text-base font-black text-[#0b66c3]">회원가입 안내</p>
              <ol className="mt-3 space-y-1 text-sm font-semibold leading-6 text-slate-700">
                <li>1. 가입할 회원 종류를 선택해 주세요.</li>
                <li>2. 병원(기관)을 검색해 선택해 주세요.</li>
                <li>3. 기관 등록은 회원가입 화면이 아니라 관리자 화면에서 별도로 진행합니다.</li>
                <li>4. 역할에 맞는 정보를 입력하면 가입을 진행할 수 있습니다.</li>
              </ol>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
                <p className="text-sm font-black text-slate-900">기관이 목록에 없나요?</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  기관 자체 회원가입은 받지 않으며, 원하는 기관이 목록에 없다면
                  별도 기관 등록 요청 화면에서 먼저 접수해 주세요.
                </p>
                <Link
                  href="/organization-register"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-black text-orange-700 transition hover:bg-orange-100"
                >
                  기관 등록 요청하기
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-8 flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  선택한 회원 종류
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {form.userRole === "therapist" ? "치료사 회원가입" : "사용자 회원가입"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHasChosenRole(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                회원 종류 다시 선택
              </button>
            </div>

            <div className="mt-6 space-y-8">
              <SectionCard
                title="아이디 정보"
                description="로그인에 사용할 아이디와 비밀번호를 입력해 주세요."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="아이디 *">
                    <div className="flex gap-2">
                      <input
                        className="input-style"
                        value={form.loginId}
                        onChange={(e) =>
                          updateForm("loginId", e.target.value.replace(/\s/g, ""))
                        }
                        placeholder="로그인 아이디"
                      />
                      <button
                        type="button"
                        onClick={checkLoginId}
                        disabled={isCheckingLoginId}
                        className="shrink-0 rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-black text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isCheckingLoginId ? "확인 중" : "중복 확인"}
                      </button>
                    </div>
                    {loginIdStatus.message ? (
                      <p
                        className={`mt-2 text-xs font-bold ${
                          loginIdStatus.state === "available"
                            ? "text-emerald-600"
                            : loginIdStatus.state === "taken" ||
                                loginIdStatus.state === "invalid"
                              ? "text-red-500"
                              : "text-slate-500"
                        }`}
                      >
                        {loginIdStatus.message}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        영문 소문자, 숫자, `_`, `-` 사용 가능 / 4~20자
                      </p>
                    )}
                  </Field>

                  <div />

                  <Field label="비밀번호 *">
                    <div className="relative">
                      <input
                        className="input-style pr-20"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => updateForm("password", e.target.value)}
                        placeholder="6자 이상"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500"
                      >
                        {showPassword ? "숨기기" : "보기"}
                      </button>
                    </div>
                  </Field>

                  <Field label="비밀번호 확인 *">
                    <div className="relative">
                      <input
                        className="input-style pr-20"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) => updateForm("confirmPassword", e.target.value)}
                        placeholder="비밀번호 확인"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500"
                      >
                        {showConfirmPassword ? "숨기기" : "보기"}
                      </button>
                    </div>
                    {passwordMatchState === "match" ? (
                      <p className="mt-2 text-xs font-bold text-emerald-600">
                        비밀번호가 일치합니다.
                      </p>
                    ) : null}
                    {passwordMatchState === "mismatch" ? (
                      <p className="mt-2 text-xs font-bold text-red-500">
                        비밀번호가 일치하지 않습니다.
                      </p>
                    ) : null}
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title={form.userRole === "therapist" ? "기관 정보" : "기본 정보"}
                description={
                  form.userRole === "therapist"
                    ? "치료사 계정은 등록된 기관을 선택한 뒤 가입합니다."
                    : "사용자 기본 정보와 소속 병원을 입력해 주세요."
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="병원 / 기관 검색 *">
                    <div className="space-y-3">
                      <input
                        className="input-style"
                        value={form.organizationQuery}
                        onChange={(e) => updateForm("organizationQuery", e.target.value)}
                        placeholder="병원명, 기관 코드, 주소 검색"
                      />
                      {selectedOrganization ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-sm font-black text-slate-900">
                            {selectedOrganization.name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {selectedOrganization.code} · {selectedOrganization.address}
                          </p>
                        </div>
                      ) : null}
                      <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        {filteredOrganizations.length ? (
                          filteredOrganizations.map((item) => {
                            const selected = form.organizationId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => selectOrganization(item)}
                                className={`mb-2 block w-full rounded-2xl border px-4 py-3 text-left transition last:mb-0 ${
                                  selected
                                    ? "border-orange-300 bg-orange-50"
                                    : "border-slate-200 bg-white hover:bg-slate-100"
                                }`}
                              >
                                <p className="text-sm font-black text-slate-900">{item.name}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {item.code} · {item.address}
                                </p>
                              </button>
                            );
                          })
                        ) : (
                          <p className="px-3 py-4 text-sm font-semibold text-slate-500">
                            검색 결과가 없습니다.
                          </p>
                        )}
                      </div>
                      {form.userRole === "therapist" ? (
                        <p className="text-xs font-semibold text-slate-500">
                          소속 기관이 없다면 관리자 화면에서 먼저 기관을 등록해 주세요.
                        </p>
                      ) : null}
                    </div>
                  </Field>

                  {form.userRole === "patient" ? (
                    <Field label="담당 치료사 선택 *">
                      <div className="space-y-3">
                        {!selectedOrganization ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
                            먼저 병원(기관)을 선택해 주세요.
                          </div>
                        ) : isLoadingTherapists ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
                            치료사 목록을 불러오는 중입니다.
                          </div>
                        ) : therapists.length ? (
                          <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                            {therapists.map((therapist) => {
                              const isSelected =
                                form.therapistUserId === therapist.therapistUserId;
                              return (
                                <button
                                  key={therapist.therapistUserId}
                                  type="button"
                                  onClick={() => selectTherapist(therapist)}
                                  className={`mb-2 block w-full rounded-2xl border px-4 py-3 text-left transition last:mb-0 ${
                                    isSelected
                                      ? "border-orange-300 bg-orange-50"
                                      : "border-slate-200 bg-white hover:bg-slate-100"
                                  }`}
                                >
                                  <p className="text-sm font-black text-slate-900">
                                    {therapist.therapistName}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">
                                    {therapist.loginId ?? "치료사 계정"}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
                            선택한 기관에 승인된 치료사 계정이 아직 없습니다.
                          </div>
                        )}
                        {selectedTherapist ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <p className="text-sm font-black text-slate-900">
                              선택한 치료사: {selectedTherapist.therapistName}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {selectedTherapist.loginId ?? "치료사 계정"}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </Field>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      <Field label="가입 안내">
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                          치료사 계정은 병원 소속과 역할 확인 후 운영자/치료사 화면에
                          연결합니다.
                        </div>
                      </Field>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <Field label="이름 *">
                      <input
                        className="input-style"
                        value={form.name}
                        onChange={(e) => updateForm("name", e.target.value)}
                        placeholder="이름"
                      />
                    </Field>

                    <Field label="생년월일 *">
                      <input
                        className="input-style"
                        value={form.birthDate}
                        onChange={(e) =>
                          updateForm("birthDate", formatDateInput(e.target.value))
                        }
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="1996-02-18"
                      />
                    </Field>

                    <Field label="전화번호 뒤 4자리 *">
                      <input
                        className="input-style"
                        inputMode="numeric"
                        maxLength={4}
                        value={form.phoneLast4}
                        onChange={(e) =>
                          updateForm(
                            "phoneLast4",
                            e.target.value.replace(/\D/g, "").slice(0, 4),
                          )
                        }
                        placeholder="1234"
                      />
                    </Field>

                  </div>
                </div>
              </SectionCard>

              {form.userRole === "patient" ? (
                <SectionCard
                  title="재활 정보"
                  description="훈련 이력과 결과 해석에 필요한 기초 정보를 입력해 주세요."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="성별 *">
                      <div className="flex rounded-2xl bg-slate-100 p-1">
                        {(["M", "F"] as const).map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            onClick={() => updateForm("gender", gender)}
                            className={`h-12 flex-1 rounded-xl text-sm font-black ${
                              form.gender === gender
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-400"
                            }`}
                          >
                            {gender === "M" ? "남성" : "여성"}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="교육년수 *">
                      <input
                        className="input-style"
                        inputMode="numeric"
                        value={form.educationYears}
                        onChange={(e) =>
                          updateForm(
                            "educationYears",
                            e.target.value.replace(/\D/g, ""),
                          )
                        }
                        placeholder="예: 12"
                      />
                    </Field>

                    <Field label="발병일 *">
                      <input
                        className="input-style"
                        type="date"
                        max={todayLocalDate}
                        value={form.onsetDate}
                        onChange={(e) => updateForm("onsetDate", e.target.value)}
                      />
                    </Field>

                    <Field label="편마비 유무 *">
                      <div className="flex gap-2">
                        {[
                          { key: "Y", label: "있음" },
                          { key: "N", label: "없음" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => updateForm("hemiplegia", item.key)}
                            className={`h-12 flex-1 rounded-2xl border text-sm font-black ${
                              form.hemiplegia === item.key
                                ? "border-orange-300 bg-orange-50 text-slate-900"
                                : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="반맹증(시야 결손) *">
                      <div className="flex gap-2">
                        {[
                          { key: "NONE", label: "없음" },
                          { key: "LEFT", label: "좌측" },
                          { key: "RIGHT", label: "우측" },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => updateForm("hemianopsia", item.key)}
                            className={`h-12 flex-1 rounded-2xl border text-xs font-black ${
                              form.hemianopsia === item.key
                                ? "border-orange-300 bg-orange-50 text-slate-900"
                                : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                </SectionCard>
              ) : null}
            </div>

            {error ? <p className="mt-5 text-sm font-bold text-red-500">{error}</p> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="inline-flex h-13 min-w-[180px] items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting
                  ? "가입 중..."
                  : form.userRole === "therapist"
                    ? "치료사 가입 신청"
                    : "회원가입 완료"}
              </button>
              <button
                type="button"
                onClick={() => setHasChosenRole(false)}
                className="inline-flex h-13 min-w-[140px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-base font-black text-slate-700 transition hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </>
        )}

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

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-base font-black text-slate-900">{title}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
          {description}
        </p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}
