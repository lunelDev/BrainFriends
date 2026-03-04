"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { savePatientProfile, loadPatientProfile } from "@/lib/patientStorage";
import { SessionManager } from "@/lib/kwab/SessionManager";

type Gender = "M" | "F" | "U";
type Hemiplegia = "Y" | "N";
type Hemianopsia = "NONE" | "RIGHT" | "LEFT";

interface FormState {
  name: string;
  birthDate: string;
  age: string;
  educationYears: string;
  gender: Gender;
  onsetDate: string;
  hemiplegia: Hemiplegia;
  hemianopsia: Hemianopsia;
}

export default function HomePage() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [showFirstDiagnosisModal, setShowFirstDiagnosisModal] = useState(false);

  const [form, setForm] = useState<FormState>(() => {
    const prev = loadPatientProfile();
    return {
      name: prev?.name ?? "",
      birthDate: prev?.birthDate ?? "",
      age: prev?.age ? String(prev.age) : "",
      educationYears: prev?.educationYears ? String(prev.educationYears) : "",
      gender: (prev?.gender as Gender) ?? "U",
      onsetDate: prev?.onsetDate ?? "",
      hemiplegia: (prev?.hemiplegia as Hemiplegia) ?? "N",
      hemianopsia: (prev?.hemianopsia as Hemianopsia) ?? "NONE",
    };
  });

  const calcDaysSinceOnset = (onsetDate: string): number | null => {
    if (!onsetDate) return null;
    const onset = new Date(`${onsetDate}T00:00:00`);
    if (Number.isNaN(onset.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - onset.getTime();
    return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const getTodayLocalDate = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
  };

  const calcFullAge = (birthDate: string): string => {
    if (!birthDate) return "";
    const birth = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let age = today.getFullYear() - birth.getFullYear();
    const hasNotHadBirthdayThisYear =
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate());
    if (hasNotHadBirthdayThisYear) age -= 1;

    return age >= 0 ? String(age) : "";
  };

  const todayLocalDate = getTodayLocalDate();
  const daysSinceOnset = calcDaysSinceOnset(form.onsetDate);

  const updateForm = (key: keyof FormState, val: string) => {
    setForm((p) => {
      if (key === "birthDate") {
        return { ...p, birthDate: val, age: calcFullAge(val) };
      }
      return { ...p, [key]: val };
    });
  };

  const requestPermissions = async () => {
    setIsRequesting(true);
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      setIsDenied(false);
      setIsRequesting(false);
      return true;
    } catch (error: any) {
      setIsDenied(true);
      setIsRequesting(false);
      setErr("카메라 및 마이크 접근 권한이 필요합니다.");
      return false;
    }
  };

  const start = async () => {
    if (
      !form.name.trim() ||
      !form.birthDate ||
      !form.age ||
      form.gender === "U" ||
      !form.educationYears ||
      !form.onsetDate
    ) {
      return setErr("모든 필수 항목(*)을 입력해 주세요.");
    }
    if (form.onsetDate > todayLocalDate) {
      return setErr("발병일은 오늘 이후 날짜를 선택할 수 없습니다.");
    }
    if (form.birthDate > todayLocalDate) {
      return setErr("생년월일은 오늘 이후 날짜를 선택할 수 없습니다.");
    }
    const hasPermission = await requestPermissions();
    if (hasPermission) {
      const saved = savePatientProfile({
        ...form,
        age: Number(form.age),
        educationYears: Number(form.educationYears),
        daysSinceOnset: daysSinceOnset ?? undefined,
        hand: "U",
        language: "한국어",
      });

      const hasSelfDiagnosisHistory =
        SessionManager.getHistoryFor(saved as any).length > 0;
      if (hasSelfDiagnosisHistory) {
        router.push("/mode-select");
      } else {
        setShowFirstDiagnosisModal(true);
      }
    }
  };

  return (
    <main className="h-screen overflow-hidden bg-[#F0F2F5] p-2 md:p-3 text-black font-sans flex items-center justify-center">
      <div className="w-full max-w-5xl mx-auto flex flex-col">
        <header className="mb-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 md:px-6 py-3 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-orange-500/20" />
          <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="md:max-w-[44%]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
                System Brief
              </p>
              <h1 className="mt-1 text-lg md:text-xl font-black text-white leading-tight">
                시스템 핵심 요약
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                AI 기반 언어 재활 분석 시스템
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 md:w-[52%]">
              <p className="text-[11px] font-black text-orange-300 mb-1">
                핵심 기능
              </p>
              <p className="text-xs text-slate-200">
                교육년수·발병경과 기반 맞춤형 언어 과제 자동 구성
              </p>
              <p className="text-xs text-slate-200">
                카메라·음성 기반 실시간 수행 분석 및 안면 비대칭 가이드
              </p>
              <p className="text-xs text-slate-200">
                단계별 수행 기록 저장과 재활 리포트(PDF) 생성
              </p>
            </div>
          </div>
        </header>

        <div className="w-full bg-white rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-white/20">
          {/* Left Section: Registration Form */}
          <section className="p-5 md:p-6">
            <header className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                  B
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  GOLDEN
                </h1>
              </div>
              <p className="text-orange-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                Patient Clinical Data Setup
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {/* 1행: 성명 & 성별 */}
              <Field label="학습자 성명 *">
                <input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  className="input-style"
                  placeholder="성명을 입력하세요"
                />
              </Field>

              <Field label="생년월일 *">
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => updateForm("birthDate", e.target.value)}
                  className="input-style"
                  max={todayLocalDate}
                />
              </Field>

              <Field label="성별 *">
                <div className="flex p-1 bg-gray-100 rounded-xl h-[48px]">
                  {(["M", "F"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => updateForm("gender", g)}
                      className={`flex-1 rounded-lg text-sm font-bold transition-all ${form.gender === g ? "bg-white text-slate-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                    >
                      {g === "M" ? "남성" : "여성"}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 2행: 나이 & 교육년수 (가로 배치) */}
              <Field label="나이 / 교육년수 *">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    {form.age && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">
                        만
                      </span>
                    )}
                    <input
                      value={form.age}
                      readOnly
                      className="input-style w-full"
                      style={
                        form.age
                          ? { paddingLeft: "34px", paddingRight: "28px" }
                          : undefined
                      }
                      placeholder="만 나이 자동 계산"
                    />
                    {form.age && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">
                        세
                      </span>
                    )}
                  </div>
                  <div className="relative flex-1">
                    <input
                      value={form.educationYears}
                      onChange={(e) =>
                        updateForm(
                          "educationYears",
                          e.target.value.replace(/\D/g, ""),
                        )
                      }
                      className="input-style w-full pr-8"
                      placeholder="교육년수"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">
                      년
                    </span>
                  </div>
                </div>
              </Field>

              {/* 3행: 발병일 및 경과일 (가로 배치) */}
              <Field label="발병일 및 경과일 *">
                <div className="flex gap-3">
                  <input
                    type="date"
                    value={form.onsetDate}
                    onChange={(e) => updateForm("onsetDate", e.target.value)}
                    className="input-style flex-[1.4] w-full"
                    max={todayLocalDate}
                  />
                  <div
                    className={`flex-1 flex items-center justify-center rounded-xl font-black text-xs transition-all ${
                      daysSinceOnset !== null
                        ? "bg-orange-500 text-white"
                        : "bg-gray-50 text-gray-300 border-2 border-dashed border-gray-100"
                    }`}
                  >
                    {daysSinceOnset !== null ? `D+${daysSinceOnset}` : "경과일"}
                  </div>
                </div>
              </Field>

              {/* 4행: 편마비 & 반맹증 */}
              <Field label="편마비 유무 *">
                <div className="flex gap-2 h-[48px]">
                  {[
                    { k: "Y", l: "있음" },
                    { k: "N", l: "없음" },
                  ].map((item) => (
                    <button
                      key={item.k}
                      onClick={() =>
                        updateForm("hemiplegia", item.k as Hemiplegia)
                      }
                      className={`flex-1 rounded-xl text-sm font-bold border-2 transition-all ${form.hemiplegia === item.k ? "border-orange-400 bg-orange-50 text-slate-900" : "border-gray-50 bg-gray-50 text-gray-400"}`}
                    >
                      {item.l}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="반맹증(시야 결손) *">
                <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl h-[48px]">
                  {[
                    { k: "NONE", l: "없음" },
                    { k: "LEFT", l: "좌측" },
                    { k: "RIGHT", l: "우측" },
                  ].map((item) => (
                    <button
                      key={item.k}
                      onClick={() =>
                        updateForm("hemianopsia", item.k as Hemianopsia)
                      }
                      className={`flex-1 rounded-lg text-[11px] font-bold transition-all ${form.hemianopsia === item.k ? "bg-white text-slate-900 shadow-sm" : "text-gray-400"}`}
                    >
                      {item.l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div
              className={`mt-4 p-3 rounded-2xl border flex items-center gap-3 transition-all ${isDenied ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-sm ${isDenied ? "bg-white text-red-500" : "bg-white text-blue-500"}`}
              >
                {isDenied ? "!" : "i"}
              </div>
              <div className="flex-1">
                <p
                  className={`text-xs font-bold ${isDenied ? "text-red-700" : "text-blue-700"}`}
                >
                  {isDenied ? "권한 재설정 필요" : "시스템 하드웨어 체크"}
                </p>
                <p className="text-[10px] text-gray-500 opacity-80 leading-snug">
                  발화 분석을 위해 주소창 왼쪽 자물쇠 버튼을 눌러
                  카메라/마이크를 허용해 주세요.
                </p>
              </div>
            </div>

            {err && (
              <p className="mt-3 text-center text-red-500 font-bold text-xs">
                ⚠️ {err}
              </p>
            )}

            <button
              onClick={start}
              disabled={isRequesting}
              className={`mt-4 w-full sm:w-auto sm:min-w-[320px] sm:px-10 sm:block sm:mx-auto py-3.5 rounded-2xl text-lg font-black shadow-[0_10px_20px_rgba(249,115,22,0.2)] transition-all active:scale-95 ${isRequesting ? "bg-gray-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
            >
              {isRequesting ? "연결 확인 중..." : "학습 대시보드 진입"}
            </button>
          </section>
        </div>
      </div>

      {showFirstDiagnosisModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-orange-100 p-6 shadow-2xl">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.25em] mb-2">
              First Diagnosis
            </p>
            <h3 className="text-xl font-black text-slate-900 mb-2 break-keep">
              최초 1회는 자가 진단이 필요합니다
            </h3>
            <p className="text-sm text-slate-600 font-bold mb-6">
              자가진단하기를 누르면 우리집 문제를 체험하며 기본 평가를
              진행합니다.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("btt.trialMode", "1");
                  }
                  router.push("/step-1?place=home");
                }}
                className="w-full py-3.5 rounded-2xl bg-[#0B1A3A] text-white font-black hover:bg-[#09152f] transition-all"
              >
                자가진단하기
              </button>
              <button
                onClick={() => setShowFirstDiagnosisModal(false)}
                className="w-full py-2 text-xs text-slate-500 font-bold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .input-style {
          background: #f9fafb;
          border: 2px solid #f1f2f6;
          border-radius: 14px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .input-style:focus {
          border-color: #fb923c;
          background: white;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.15);
          outline: none;
        }
      `}</style>
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
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-extrabold text-slate-700 tracking-tight uppercase opacity-80">
        {label}
      </label>
      {children}
    </div>
  );
}
