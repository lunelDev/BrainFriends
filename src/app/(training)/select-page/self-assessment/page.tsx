"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SelectionHeroBanner from "@/components/training/SelectionHeroBanner";
import SelectionImageCard from "@/components/training/SelectionImageCard";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SessionManager } from "@/lib/kwab/SessionManager";
import { ChevronRight, MapPin } from "lucide-react";
import {
  clearTrainingExitProgress,
  getTrainingExitProgress,
} from "@/lib/trainingExitProgress";

const PLACES = [
  {
    key: "home",
    label: "우리 집",
    desc: "일상 사실 및 추론",
    bgClass: "bg-[linear-gradient(145deg,#fff7ed,#ffedd5)]",
    imagePath: "/images/places/home.png",
  },
  {
    key: "hospital",
    label: "병원",
    desc: "증상 표현 및 소통",
    bgClass: "bg-[linear-gradient(145deg,#f8fafc,#e2e8f0)]",
    imagePath: "/images/places/hospital.png",
  },
  {
    key: "cafe",
    label: "카페",
    desc: "주문 및 사회적 활동",
    bgClass: "bg-[linear-gradient(145deg,#fff7ed,#fde68a)]",
    imagePath: "/images/places/cafe.png",
  },
  {
    key: "bank",
    label: "은행",
    desc: "숫자 및 금융 인지",
    bgClass: "bg-[linear-gradient(145deg,#eff6ff,#dbeafe)]",
    imagePath: "/images/places/bank.png",
  },
  {
    key: "park",
    label: "공원",
    desc: "청각 및 사물 이름",
    bgClass: "bg-[linear-gradient(145deg,#f0fdf4,#dcfce7)]",
    imagePath: "/images/places/park.png",
  },
  {
    key: "mart",
    label: "마트",
    desc: "물건 사기 및 계산",
    bgClass: "bg-[linear-gradient(145deg,#fff1f2,#ffe4e6)]",
    imagePath: "/images/places/mart.png",
  },
] as const;

export default function SelectPage() {
  const router = useRouter();
  const { patient, ageGroup } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [resumeModal, setResumeModal] = useState<{
    open: boolean;
    place: string;
    resumePath: string;
  }>({ open: false, place: "", resumePath: "" });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("btt.trainingMode", "self");
    }
  }, []);

  const getStartPath = (place: string) =>
    `/programs/step-1?place=${encodeURIComponent(place)}`;

  const getResumeLabel = (path: string) => {
    if (path.includes("/result-page/self-assessment")) return "결과 보기";
    if (path.includes("/programs/step-6")) return "Step 6 이어하기";
    if (path.includes("/programs/step-5")) return "Step 5 이어하기";
    if (path.includes("/programs/step-4")) return "Step 4 이어하기";
    if (path.includes("/programs/step-3")) return "Step 3 이어하기";
    if (path.includes("/programs/step-2")) return "Step 2 이어하기";
    if (path.includes("/programs/step-1")) return "Step 1 이어하기";
    return "처음부터 시작";
  };

  const go = (place: string) => {
    if (!patient) {
      router.push(getStartPath(place));
      return;
    }

    const startPath = getStartPath(place);
    const checkpoint = getTrainingExitProgress(place);

    // 홈 이탈 체크포인트가 있으면 이어하기를 우선 제공
    if (
      checkpoint?.currentStep &&
      checkpoint.currentStep >= 1 &&
      checkpoint.currentStep <= 6
    ) {
      const checkpointResumePath = `/programs/step-${checkpoint.currentStep}?place=${encodeURIComponent(place)}`;
      setResumeModal({ open: true, place, resumePath: checkpointResumePath });
      return;
    }

    const resumePath = SessionManager.getResumePath(patient as any, place);

    // report(=result)까지 완료된 세션은 이어하기를 띄우지 않고 처음부터 시작
    if (resumePath.includes("/result-page/self-assessment")) {
      // 완료된 세션을 그대로 재사용하면 같은 sessionId가 덮어써져 이전 기록이 누적되지 않음
      SessionManager.clearSessionFor(patient as any, place);
      router.push(startPath);
      return;
    }

    if (resumePath !== startPath) {
      setResumeModal({ open: true, place, resumePath });
      return;
    }

    router.push(startPath);
  };

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/");
        return;
      }
      router.replace("/");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-white">
      {/* 상단 프로필 섹션: Step 페이지 헤더와 높이감을 맞춤 */}
      <div className="px-4 sm:px-6 py-3 border-b border-orange-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="grid grid-cols-2 items-center gap-x-2 sm:gap-x-3 min-w-0">
            <p className="col-span-2 text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">
              Active Patient Profile
            </p>
            <h2 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight leading-none truncate">
              {isMounted ? (patient?.name ?? "정보 없음") : "정보 없음"}
              <span className="text-xs sm:text-sm font-bold text-slate-500 ml-1.5 sm:ml-2">
                {isMounted ? (patient?.age ?? "-") : "-"}세
              </span>
            </h2>
            <span
              className={`mt-1 justify-self-start inline-flex px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black shadow-sm border whitespace-nowrap ${
                ageGroup === "Senior"
                  ? "bg-orange-50 text-orange-700 border-orange-200"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              {ageGroup === "Senior" ? "실버 규준 적용" : "일반 규준 적용"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.push("/select-page/mode")}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-gradient-to-r from-orange-600 to-orange-500 text-white border-orange-500 hover:from-orange-700 hover:to-orange-600 transition-all"
          >
            활동선택
          </button>
          {/* "리포트 보기" 버튼 제거: 이력 조회는 /mypage → 각 훈련 카드의
              "결과 보기 →" 로 /report 로 이동하도록 단일 동선으로 정리. */}
          <button
            type="button"
            onClick={logout}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
          >
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-10 pb-10 sm:pb-12 lg:pb-14 flex flex-col justify-center">
        <SelectionHeroBanner
          badge="Self Assessment"
          title="생활 공간을 기준으로 정기 자가진단을 시작해 보세요."
          description="집, 병원, 카페, 은행, 공원, 마트처럼 익숙한 환경을 기준으로 언어 이해와 표현 능력을 점검할 수 있습니다. 이전 진행 기록이 있으면 이어서 진단도 가능합니다."
          accentClassName="border-orange-100 from-orange-500 via-amber-500 to-slate-900"
          icon={<MapPin className="w-3.5 h-3.5" />}
        />

        <section className="mt-1 sm:mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {PLACES.map((p) => (
            <SelectionImageCard
              key={p.key}
              onClick={() => go(p.key)}
              title={p.label}
              description={p.desc}
              badge="Place"
              ctaLabel="이 장소로 시작"
              imagePath={p.imagePath}
              overlayClassName="bg-gradient-to-br from-slate-500/55 to-slate-800/70"
            />
          ))}
        </section>
      </main>

      {resumeModal.open && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center overflow-y-auto p-4">
          <div className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-3xl border border-orange-100 p-4 [@media(min-height:901px)]:p-6 shadow-2xl">
            <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.25em] mb-2">
              Saved Progress
            </p>
            <h3 className="text-xl font-black text-slate-900 mb-2 break-keep">
              이전 진행 기록이 있습니다
            </h3>
            <p className="text-sm text-slate-600 font-bold mb-6">
              {getResumeLabel(resumeModal.resumePath)} 또는 처음부터 다시 시작할
              수 있습니다.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  router.push(resumeModal.resumePath);
                  clearTrainingExitProgress(resumeModal.place);
                  setResumeModal({ open: false, place: "", resumePath: "" });
                }}
                className="w-full py-3.5 rounded-2xl bg-[#0B1A3A] text-white font-black hover:bg-[#09152f] transition-all"
              >
                이어서 하기
              </button>
              <button
                onClick={() => {
                  if (patient) {
                    SessionManager.clearSessionFor(
                      patient as any,
                      resumeModal.place,
                    );
                  }
                  clearTrainingExitProgress(resumeModal.place);
                  router.push(getStartPath(resumeModal.place));
                  setResumeModal({ open: false, place: "", resumePath: "" });
                }}
                className="w-full py-3.5 rounded-2xl bg-white text-gray-600 border border-gray-200 font-black hover:bg-gray-50 transition-all"
              >
                처음부터 하기
              </button>
              <button
                onClick={() =>
                  setResumeModal({ open: false, place: "", resumePath: "" })
                }
                className="w-full py-2 text-xs text-slate-500 font-bold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
