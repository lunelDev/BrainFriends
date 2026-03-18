"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Gender = "M" | "F" | "U";
type Hemiplegia = "Y" | "N";
type Hemianopsia = "NONE" | "RIGHT" | "LEFT";

type SignupForm = {
  userRole: "patient" | "admin";
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
  const isAdminSignup = form.userRole === "admin";

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
      (!isAdminSignup &&
        (!form.educationYears || form.gender === "U" || !form.onsetDate))
    ) {
      setError("입력값을 확인해 주세요. 비밀번호는 6자 이상이어야 합니다.");
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

    if (!isAdminSignup && form.onsetDate > todayLocalDate) {
      setError("발병일은 오늘 이후 날짜를 선택할 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          educationYears: isAdminSignup ? undefined : Number(form.educationYears),
          onsetDate: isAdminSignup ? undefined : form.onsetDate,
          hemiplegia: isAdminSignup ? undefined : form.hemiplegia,
          hemianopsia: isAdminSignup ? undefined : form.hemianopsia,
          gender: isAdminSignup ? undefined : form.gender,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          payload?.error === "account_already_exists"
            ? "이미 등록된 회원입니다."
            : "회원가입에 실패했습니다.",
        );
        return;
      }

      router.replace("/?created=1");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto max-w-4xl rounded-[36px] border border-orange-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
              Signup
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              회원가입
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              역할을 선택한 뒤 기본정보와 로그인 정보를 등록합니다.
            </p>
          </div>
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-slate-700">
            로그인으로
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 rounded-[24px] bg-slate-50 p-2">
          <button
            type="button"
            onClick={() => updateForm("userRole", "patient")}
            className={`rounded-[18px] px-4 py-4 text-left transition ${
              form.userRole === "patient"
                ? "bg-white shadow-sm ring-1 ring-orange-200"
                : "bg-transparent hover:bg-white/70"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">
              Patient
            </p>
            <p className="mt-2 text-base font-black text-slate-900">사용자 회원가입</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              훈련과 결과 확인을 위한 기본 사용자 계정입니다.
            </p>
          </button>
          <button
            type="button"
            onClick={() => updateForm("userRole", "admin")}
            className={`rounded-[18px] px-4 py-4 text-left transition ${
              form.userRole === "admin"
                ? "bg-white shadow-sm ring-1 ring-orange-200"
                : "bg-transparent hover:bg-white/70"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">
              Admin
            </p>
            <p className="mt-2 text-base font-black text-slate-900">관리자 회원가입</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              사용자 리포트와 전체 로그를 확인하는 관리자 계정입니다.
            </p>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    : loginIdStatus.state === "taken" || loginIdStatus.state === "invalid"
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
              onChange={(e) => updateForm("birthDate", formatDateInput(e.target.value))}
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
          {!isAdminSignup ? (
            <Field label="교육년수 *">
              <input
                className="input-style"
                inputMode="numeric"
                value={form.educationYears}
                onChange={(e) =>
                  updateForm("educationYears", e.target.value.replace(/\D/g, ""))
                }
                placeholder="예: 12"
              />
            </Field>
          ) : null}
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
          {!isAdminSignup ? (
            <>
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
              <Field label="발병일 *">
                <input
                  className="input-style"
                  type="date"
                  max={todayLocalDate}
                  value={form.onsetDate}
                  onChange={(e) => updateForm("onsetDate", e.target.value)}
                />
              </Field>
            </>
          ) : null}
          {!isAdminSignup ? (
            <>
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
            </>
          ) : null}
        </div>

        {error ? <p className="mt-5 text-sm font-bold text-red-500">{error}</p> : null}

        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "가입 중..." : "회원가입 완료"}
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
