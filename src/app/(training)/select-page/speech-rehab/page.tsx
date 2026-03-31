"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SelectionHeroBanner from "@/components/training/SelectionHeroBanner";
import SelectionImageCard from "@/components/training/SelectionImageCard";
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
  ChevronDown,
  Check,
  MapPin,
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
    route: "/programs/step-1",
    icon: <Headphones className="w-6 h-6" />,
    imagePath: "/images/mode/step1.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 2,
    title: "Step 2",
    subtitle: "따라말하기",
    desc: "제시된 문장을 따라 말하기",
    route: "/programs/step-2",
    icon: <MessageSquare className="w-6 h-6" />,
    imagePath: "/images/mode/step2.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 3,
    title: "Step 3",
    subtitle: "단어 명명",
    desc: "사물의 이름을 정확히 부르기",
    route: "/programs/step-3",
    icon: <Tag className="w-6 h-6" />,
    imagePath: "/images/mode/step3.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 4,
    title: "Step 4",
    subtitle: "유창성",
    desc: "막힘없이 매끄럽게 말하기",
    route: "/programs/step-4",
    icon: <Zap className="w-6 h-6" />,
    imagePath: "/images/mode/step4.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 5,
    title: "Step 5",
    subtitle: "읽기",
    desc: "글자를 눈으로 보고 소리내어 읽기",
    route: "/programs/step-5",
    icon: <BookOpen className="w-6 h-6" />,
    imagePath: "/images/mode/step5.png",
    accentColor: "from-slate-500/55 to-slate-800/70",
  },
  {
    id: 6,
    title: "Step 6",
    subtitle: "쓰기",
    desc: "정확한 획순으로 글자 써보기",
    route: "/programs/step-6",
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
  const [isPlaceOpen, setIsPlaceOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const placeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!placeDropdownRef.current) return;
      if (!placeDropdownRef.current.contains(event.target as Node)) {
        setIsPlaceOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const selectedPlace = useMemo(
    () => PLACE_OPTIONS.find((p) => p.key === place) || PLACE_OPTIONS[0],
    [place],
  );

  const moveStep = (route: string) => {
    if (patient) {
      SessionManager.clearSessionFor(patient as any, selectedPlace.key);
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("btt.trainingMode", "rehab");
    }
    router.push(
      `${route}?place=${encodeURIComponent(selectedPlace.key)}&trainMode=rehab&targetStep=${route.replace("/programs/step-", "")}`,
    );
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
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-[#ffffff] min-h-screen">
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
            onClick={() => router.push("/select-page/mode")}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-gradient-to-r from-sky-600 to-sky-500 text-white border-sky-500 hover:from-sky-700 hover:to-sky-600 transition-all"
          >
            활동선택
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
            onClick={logout}
            className="h-8 sm:h-9 min-w-[90px] sm:min-w-[98px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-black shadow-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-all"
          >
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-10 pb-10 sm:pb-12 lg:pb-14 flex flex-col justify-center">
        <SelectionHeroBanner
          badge="Speech Rehab Program"
          title="부족한 언어 영역을 단계별로 집중 훈련하세요."
          description="청각 이해, 따라말하기, 명명, 유창성, 읽기, 쓰기를 현재 장소에 맞춰 반복 훈련할 수 있습니다. 원하는 Step을 선택하면 바로 해당 훈련으로 이동합니다."
          accentClassName="border-sky-100 from-sky-600 via-cyan-600 to-slate-900"
          icon={<BookOpen className="w-3.5 h-3.5" />}
          footerAction={
            <div ref={placeDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsPlaceOpen((prev) => !prev)}
                className="h-10 px-3.5 rounded-full bg-white/12 text-white hover:bg-white/18 border border-white/20 backdrop-blur-md transition-colors inline-flex items-center gap-2 text-sm font-bold"
                aria-expanded={isPlaceOpen}
                aria-haspopup="listbox"
              >
                <MapPin className="w-4 h-4 text-white/80" />
                <span>{selectedPlace.label}</span>
                <ChevronDown
                  className={`w-4 h-4 text-white/80 transition-transform ${isPlaceOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isPlaceOpen && (
                <div className="absolute right-0 top-11 w-40 rounded-xl bg-white shadow-lg p-1.5 z-20">
                  {PLACE_OPTIONS.map((opt) => {
                    const active = opt.key === place;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setPlace(opt.key);
                          setIsPlaceOpen(false);
                        }}
                        className={`w-full h-9 px-2.5 rounded-lg text-left text-sm font-bold inline-flex items-center justify-between transition-colors ${
                          active
                            ? "bg-sky-50 text-sky-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        role="option"
                        aria-selected={active}
                      >
                        <span>{opt.label}</span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          }
        />

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {STEP_CARDS.map((step) => (
            <SelectionImageCard
              key={step.id}
              onClick={() => moveStep(step.route)}
              title={step.subtitle}
              description={step.desc}
              badge={step.title}
              ctaLabel={`${selectedPlace.label}에서 시작`}
              imagePath={step.imagePath}
              overlayClassName={`bg-gradient-to-br ${step.accentColor}`}
              topLeft={
                <div className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-[18px] border border-white/25 bg-white/15 text-white shadow-md backdrop-blur-md">
                  {step.icon}
                </div>
              }
            />
          ))}
        </section>
      </main>
    </div>
  );
}
