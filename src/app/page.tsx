"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PatientProfile } from "@/lib/patientStorage";

type LoginForm = {
  loginId: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({
    loginId: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showFirstDiagnosisModal, setShowFirstDiagnosisModal] = useState(false);
  const [pendingPatient, setPendingPatient] = useState<PatientProfile | null>(
    null,
  );
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  const bootstrapPatient = (patient: PatientProfile) => {
    if (typeof window !== "undefined") {
      window.__BRAINFRIENDS_PATIENT__ = patient;
    }
  };

  const requestPermissions = async () => {
    setIsRequestingPermissions(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setError("카메라 및 마이크 접근 권한이 필요합니다.");
      return false;
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  const moveAfterPermission = async (patient: PatientProfile) => {
    bootstrapPatient(patient);
    if (patient.userRole === "admin") {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("btt.trialMode");
      }
      router.replace("/select-page/mode");
      return;
    }
    let hasSelfDiagnosisHistory = false;

    try {
      const response = await fetch("/api/onboarding/status", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        hasSelfDiagnosisHistory = Boolean(payload.hasSelfAssessmentHistory);
      }
    } catch {
      setError("사용자 이력을 확인하지 못했습니다. 다시 시도해 주세요.");
      return;
    }

    if (typeof window !== "undefined") {
      if (hasSelfDiagnosisHistory) {
        window.sessionStorage.removeItem("btt.trialMode");
        router.replace("/select-page/mode");
        return;
      }

      setPendingPatient(patient);
      setShowFirstDiagnosisModal(true);
      return;
    }

    router.replace(hasSelfDiagnosisHistory ? "/select-page/mode" : "/");
  };

  const routeAfterAuth = (patient: PatientProfile) => {
    bootstrapPatient(patient);
    if (patient.userRole === "admin") {
      router.replace("/select-page/mode");
      return;
    }
    setPendingPatient(patient);
    setShowPermissionModal(true);
  };

  const startFirstDiagnosis = (patient: PatientProfile) => {
    bootstrapPatient(patient);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("btt.trialMode", "1");
    }
    setPendingPatient(null);
    setShowFirstDiagnosisModal(false);
    router.replace("/programs/step-1?place=home");
  };

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("created") === "1"
    ) {
      setNotice("회원가입이 완료되었습니다. 로그인해 주세요.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .then((payload) => {
        if (cancelled || !payload?.patient) return;
        routeAfterAuth(payload.patient);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const updateField = (key: keyof LoginForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setError("");
    setNotice("");

    if (!form.loginId.trim() || !form.password) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.patient) {
        setError(
          payload?.error === "invalid_credentials"
            ? "로그인 정보가 일치하지 않습니다."
            : "로그인에 실패했습니다.",
        );
        return;
      }

      routeAfterAuth(payload.patient);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe7] px-6">
        <div className="rounded-3xl border border-stone-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-orange-500">
            Session Check
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            로그인 상태를 확인하고 있습니다.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6efe6_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[36px] border border-stone-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <section className="hidden w-[44%] bg-[linear-gradient(180deg,#0f172a_0%,#1e293b_50%,#ea580c_140%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-300">
              BrainFriends GOLDEN
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              언어 재활 훈련을
              <br />
              계정 기반으로 시작합니다.
            </h1>
            <p className="mt-5 text-sm font-medium leading-7 text-slate-200">
              회원가입 후 아이디와 비밀번호로 로그인합니다.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-200">
              Included
            </p>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-100">
              사용자 기본정보 저장, 계정 인증, 세션 유지, 기존 훈련 화면 연동을 포함합니다.
            </p>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
              Login
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              회원 로그인
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              등록한 사용자 계정으로 로그인해 주세요.
            </p>

            <div className="mt-8 space-y-4">
              <Field label="아이디">
                <input
                  className="input-style"
                  value={form.loginId}
                  onChange={(e) => updateField("loginId", e.target.value)}
                  placeholder="아이디"
                />
              </Field>
              <Field label="비밀번호">
                <div className="relative">
                  <input
                    className="input-style pr-20"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="비밀번호"
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
            </div>

            {notice ? <p className="mt-4 text-sm font-bold text-emerald-600">{notice}</p> : null}
            {error ? <p className="mt-4 text-sm font-bold text-red-500">{error}</p> : null}

            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="mt-6 inline-flex h-13 w-full items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </button>

            <div className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold text-slate-500">
              <Link href="/find-id" className="hover:text-slate-700">
                아이디 찾기
              </Link>
              <Link href="/reset-password" className="hover:text-slate-700">
                비밀번호 재설정
              </Link>
              <Link href="/signup" className="text-orange-600 hover:text-orange-700">
                회원가입
              </Link>
            </div>
          </div>
        </section>
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
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .input-style:focus {
          outline: none;
          border-color: #f97316;
          background: white;
          box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
        }
      `}</style>

      {showFirstDiagnosisModal && pendingPatient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-6 shadow-2xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-orange-500">
              First Diagnosis
            </p>
            <h3 className="mb-2 text-xl font-black text-slate-900">
              최초 1회는 자가 진단이 필요합니다
            </h3>
            <p className="mb-6 text-sm font-bold text-slate-600">
              카메라와 마이크 권한을 확인한 뒤 자가진단을 시작합니다.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => {
                  startFirstDiagnosis(pendingPatient);
                }}
                disabled={isRequestingPermissions}
                className="w-full rounded-2xl bg-[#0B1A3A] py-3.5 font-black text-white transition hover:bg-[#09152f] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                자가진단 시작
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFirstDiagnosisModal(false);
                  setPendingPatient(null);
                }}
                className="w-full py-2 text-xs font-bold text-slate-500"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPermissionModal && pendingPatient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-6 shadow-2xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.25em] text-orange-500">
              Device Permission
            </p>
            <h3 className="mb-2 text-xl font-black text-slate-900">
              카메라와 마이크 권한을 확인합니다
            </h3>
            <p className="mb-6 text-sm font-bold text-slate-600">
              다음 페이지로 이동하기 전에 장치 권한이 필요합니다.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={async () => {
                  setError("");
                  const granted = await requestPermissions();
                  if (!granted) return;
                  setShowPermissionModal(false);
                  if (pendingPatient.userRole === "admin") {
                    if (typeof window !== "undefined") {
                      window.sessionStorage.removeItem("btt.trialMode");
                    }
                    router.replace("/select-page/mode");
                    return;
                  }
                  let hasSelfDiagnosisHistory = false;
                  try {
                    const response = await fetch("/api/onboarding/status", {
                      cache: "no-store",
                    });
                    const payload = await response.json().catch(() => null);
                    if (response.ok && payload?.ok) {
                      hasSelfDiagnosisHistory = Boolean(
                        payload.hasSelfAssessmentHistory,
                      );
                    }
                  } catch {
                    setError("사용자 이력을 확인하지 못했습니다. 다시 시도해 주세요.");
                    return;
                  }
                  if (!hasSelfDiagnosisHistory) {
                    setShowFirstDiagnosisModal(true);
                    return;
                  }
                  void moveAfterPermission(pendingPatient);
                }}
                disabled={isRequestingPermissions}
                className="w-full rounded-2xl bg-orange-500 py-3.5 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isRequestingPermissions ? "권한 확인 중..." : "권한 확인 후 계속"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPermissionModal(false);
                  setPendingPatient(null);
                }}
                className="w-full py-2 text-xs font-bold text-slate-500"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
