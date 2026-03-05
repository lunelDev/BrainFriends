"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SessionManager } from "@/lib/kwab/SessionManager";
import {
  Headphones,
  MessageSquare,
  Tag,
  Zap,
  BookOpen,
  PenTool,
  ChevronRight,
} from "lucide-react";

const PLACE_OPTIONS = [
  { key: "home", label: "우리 집" },
  { key: "hospital", label: "병원" },
  { key: "cafe", label: "카페" },
  { key: "bank", label: "은행" },
  { key: "park", label: "공원" },
  { key: "mart", label: "마트" },
] as const;

const STEP_CARDS = [
  {
    id: 1,
    title: "Step 1",
    subtitle: "청각 이해",
    desc: "들리는 소리를 집중해서 이해하기",
    route: "/step-1",
    icon: <Headphones className="w-6 h-6" />,
    imagePath: "/images/mode/step1.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 2,
    title: "Step 2",
    subtitle: "따라말하기",
    desc: "제시된 문장을 따라 말하기",
    route: "/step-2",
    icon: <MessageSquare className="w-6 h-6" />,
    imagePath: "/images/mode/step2.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 3,
    title: "Step 3",
    subtitle: "단어 명명",
    desc: "사물의 이름을 정확히 부르기",
    route: "/step-3",
    icon: <Tag className="w-6 h-6" />,
    imagePath: "/images/mode/step3.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 4,
    title: "Step 4",
    subtitle: "유창성",
    desc: "막힘없이 매끄럽게 말하기",
    route: "/step-4",
    icon: <Zap className="w-6 h-6" />,
    imagePath: "/images/mode/step4.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 5,
    title: "Step 5",
    subtitle: "읽기",
    desc: "글자를 눈으로 보고 소리내어 읽기",
    route: "/step-5",
    icon: <BookOpen className="w-6 h-6" />,
    imagePath: "/images/mode/step5.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 6,
    title: "Step 6",
    subtitle: "쓰기",
    desc: "정확한 획순으로 글자 써보기",
    route: "/step-6",
    icon: <PenTool className="w-6 h-6" />,
    imagePath: "/images/mode/step6.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
] as const;

export default function RehabPage() {
  const router = useRouter();
  const { patient, ageGroup } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [place, setPlace] =
    useState<(typeof PLACE_OPTIONS)[number]["key"]>("home");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const selectedPlace = useMemo(
    () => PLACE_OPTIONS.find((p) => p.key === place) || PLACE_OPTIONS[0],
    [place],
  );

  const moveStep = (route: string) => {
    if (patient) {
      SessionManager.clearSessionFor(patient as any, selectedPlace.key);
    }
    router.push(
      `${route}?place=${encodeURIComponent(selectedPlace.key)}&trainMode=rehab&targetStep=${route.replace("/step-", "")}`,
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-[#FDFCFB] min-h-screen">
      <div className="px-4 sm:px-6 py-3 border-b border-sky-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white/90 backdrop-blur-md shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover shrink-0"
          />
          <div className="grid grid-cols-2 items-center gap-x-2 sm:gap-x-3 min-w-0">
            <p className="col-span-2 text-[10px] font-black text-sky-500 uppercase tracking-widest leading-none">
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
                  ? "bg-gradient-to-r from-sky-600 to-sky-500 text-white border-sky-500"
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
            onClick={() => router.push("/select")}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-gradient-to-r from-sky-600 to-sky-500 text-white border-sky-500 hover:from-sky-700 hover:to-sky-600 transition-all"
          >
            자가진단
          </button>
          <button
            type="button"
            onClick={() => router.push("/report?mode=rehab&from=rehab")}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-[#0B1A3A] text-white border-[#0B1A3A] hover:bg-[#09152f] transition-all"
          >
            리포트 보기
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
          >
            로그아웃
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-10 pb-20 sm:pb-10">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
              언어 재활 반복훈련
            </h1>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              부족한 영역을 집중 훈련하세요.
            </p>
          </div>
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-sky-100 flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-500 px-2">
              장소
            </span>
            <select
              value={place}
              onChange={(e) => setPlace(e.target.value as typeof place)}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700"
            >
              {PLACE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {STEP_CARDS.map((step) => (
            <button
              key={step.id}
              onClick={() => moveStep(step.route)}
              className="group relative w-full aspect-[16/10] sm:aspect-[4/3] rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-slate-300/40"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                style={{ backgroundImage: `url(${step.imagePath})` }}
              />
              <div
                className={`absolute inset-0 bg-gradient-to-br ${step.accentColor} opacity-50 group-hover:opacity-60 transition-opacity duration-500`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

              <div className="relative h-full p-4 sm:p-5 flex flex-col justify-end items-start text-left">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-md text-white flex items-center justify-center mb-2 sm:mb-3">
                  {step.icon}
                </div>
                <span className="px-2.5 py-1 bg-white/15 backdrop-blur-md rounded-full text-[8px] sm:text-[9px] font-black text-white uppercase tracking-widest mb-2 border border-white/20">
                  {step.title}
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-white mb-1.5 sm:mb-2 drop-shadow-md">
                  {step.subtitle}
                </h2>
                <p className="text-white/90 font-medium text-[11px] sm:text-sm leading-relaxed mb-3 sm:mb-4 drop-shadow-sm">
                  {step.desc}
                </p>

                <div className="w-full flex items-center justify-between gap-2 bg-white/95 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-md group-hover:bg-slate-50 transition-colors">
                  <span className="text-[11px] sm:text-xs font-black text-slate-900 truncate">
                    {selectedPlace.label}에서 시작
                  </span>
                  <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
              </div>

              <div className="absolute inset-0 border-[3px] border-white/0 group-hover:border-white/35 rounded-[28px] transition-all duration-500 pointer-events-none" />
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
