"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadPatientProfile } from "@/lib/patientStorage";
import { PlaceType } from "@/constants/trainingData";
import { calculateKWABScores, getAQNormalComparison } from "@/lib/kwab/KWABScoring";
import {
  SessionManager,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";
import { DerivedKwab, ExportFile } from "@/features/result/types";
import { createZipBlob } from "@/features/result/utils/zipExport";
import {
  aqSeverityLabel,
  buildFacialReport,
  buildStepDetails,
  deriveSpontaneousSpeechFromStep4,
  getPlayableText,
  getResultSummarySizeClass,
  getSelfItemFeedback,
  parseStoredArray,
  shouldShowPlayButton,
} from "@/features/result/utils/resultHelpers";
import { SelfAssessmentBlocks } from "@/features/result/components/SelfAssessmentBlocks";
import { persistTrainingHistoryToDatabase } from "@/lib/client/clinicalResultsApi";
import {
  Trophy,
  Database,
  Printer,
} from "lucide-react";

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<number | null>(1);
  const [openAllAccordions, setOpenAllAccordions] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [selectedHistory, setSelectedHistory] =
    useState<TrainingHistoryEntry | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [dbSaveState, setDbSaveState] = useState<
    "idle" | "saving" | "saved" | "failed" | "local_only"
  >("idle");
  const persistedHistoryIdRef = useRef<string | null>(null);

  const place = useMemo(
    () => (searchParams.get("place") as PlaceType) || "home",
    [searchParams],
  );
  const isRehabResult = searchParams.get("trainMode") === "rehab";
  const currentTrainingMode = isRehabResult ? "rehab" : "self";
  const rehabTargetStep = Number(searchParams.get("targetStep") || "0");
  const patientProfile = useMemo(() => loadPatientProfile(), []);
  const patientForHistory = useMemo(() => {
    if (!patientProfile) return null;
    return {
      age: Number((patientProfile as any).age ?? 0),
      educationYears: Number((patientProfile as any).educationYears ?? 0),
      ...(patientProfile as any),
    } as any;
  }, [patientProfile]);

  // --- 기존 연산 로직 (보존) ---
  const queryScores = useMemo(
    () => ({
      1: Number(searchParams.get("step1") || 0),
      2: Number(searchParams.get("step2") || 0),
      3: Number(searchParams.get("step3") || 0),
      4: Number(searchParams.get("step4") || 0),
      5: Number(searchParams.get("step5") || 0),
      6: Number(searchParams.get("step6") || 0),
    }),
    [searchParams],
  );

  const derivedKwab = useMemo<DerivedKwab | null>(() => {
    if (!sessionData) return null;
    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const s1 = sessionData?.step1?.items || [];
    const s2 = sessionData?.step2?.items || [];
    const s3 = sessionData?.step3?.items || [];
    const s4 = sessionData?.step4?.items || [];
    const step1Accuracy = s1.length
      ? s1.filter((i: any) => i.isCorrect).length / s1.length
      : queryScores[1] / 20;
    const step3Accuracy = s3.length
      ? s3.filter((i: any) => i?.isCorrect).length / s3.length
      : Math.max(0, Math.min(1, Number(queryScores[3] || 0) / 100));
    const spontaneousSpeech = deriveSpontaneousSpeechFromStep4(s4, place);

    const scorePack = calculateKWABScores(
      {
        age: Number(loadPatientProfile()?.age ?? 65),
        educationYears: Number(loadPatientProfile()?.educationYears ?? 6),
      },
      {
        spontaneousSpeech,
        auditoryComprehension: {
          yesNoScore: Math.round(step1Accuracy * 60),
          // Step3(단어 명명) 정확도를 낱말 인지 점수에 반영
          wordRecognitionScore: Math.round(step3Accuracy * 60),
          commandScore: Math.round(step1Accuracy * 80),
        },
        repetition: {
          totalScore: Math.max(
            0,
            Math.min(
              100,
              Math.round(
                avg(
                  s2.map((i: any) =>
                    Number(i?.finalScore ?? i?.speechScore ?? 0),
                  ),
                ) || queryScores[2],
              ),
            ),
          ),
        },
        naming: {
          objectNamingScore: 60,
          wordFluencyScore: 20,
          sentenceCompletionScore: 10,
          sentenceResponseScore: 10,
        },
        reading: { totalScore: 0 },
        writing: { totalScore: 0 },
      },
    );
    return { ...scorePack, aq: Number(scorePack.aq.toFixed(1)) } as any;
  }, [place, queryScores, sessionData]);

  const stepDetails = useMemo(() => {
    return buildStepDetails(sessionData, queryScores);
  }, [queryScores, sessionData]);

  const clinicalImpression = useMemo(() => {
    if (!derivedKwab) return null;
    const stepMap = Object.fromEntries(
      stepDetails.map((d) => [d.id, d]),
    ) as Record<number, (typeof stepDetails)[number]>;

    const comprehension = stepMap[1];
    const repetition = stepMap[2];
    const matching = stepMap[3];
    const fluency = stepMap[4];
    const reading = stepMap[5];
    const writing = stepMap[6];

    const domains = [
      {
        name: "청각 이해",
        percent: comprehension.percent,
        metric: comprehension.metric,
      },
      {
        name: "따라말하기",
        percent: repetition.percent,
        metric: repetition.metric,
      },
      { name: "단어 명명", percent: matching.percent, metric: matching.metric },
      { name: "유창성", percent: fluency.percent, metric: fluency.metric },
      { name: "읽기", percent: reading.percent, metric: reading.metric },
      { name: "쓰기", percent: writing.percent, metric: writing.metric },
    ];
    const strongest = domains.reduce((a, b) =>
      a.percent >= b.percent ? a : b,
    );
    const weakest = domains.reduce((a, b) => (a.percent <= b.percent ? a : b));

    return {
      summary: `일상 대화의 바탕이 잘 유지되고 있으며, 전반적으로 의사소통을 이어갈 수 있는 힘이 확인됩니다. 특히 ${strongest.name}은 안정적으로 나타났고, ${weakest.name}은 생활 속 반복 연습을 통해 더 편안해질 수 있습니다.`,
      strength: `${strongest.name}(${strongest.metric})이 특히 안정적으로 확인되었습니다. 이 부분은 아주 건강하시네요!`,
      need: `${weakest.name}(${weakest.metric})은 조금 더 연습이 필요한 부분입니다. 이 부분이 좋아지면 가족과 대화할 때 떠오른 생각을 더 또렷하게 전하고, 외출이나 전화 상황에서도 원하는 말을 더 편안하게 표현하는 데 도움이 됩니다.`,
      recommendation:
        "오늘은 집에서 15분만 가볍게 연습해 보세요. 사진이나 생활 물건을 보며 이름 말하기 5분, 짧은 문장 따라 말하기 5분, 소리 내어 읽기 5분을 주 5회 꾸준히 이어가면 일상 대화가 한층 자연스러워집니다. 지금처럼 차분하게 이어가시면 분명 더 좋아질 수 있습니다.",
      strongestText: `${strongest.name} ${strongest.metric}`,
      weakestText: `${weakest.name} ${weakest.metric}`,
      encourageText: "하루 15분 · 주 5회 생활 연습",
    };
  }, [derivedKwab, stepDetails]);

  const normalComparison = useMemo(() => {
    if (!derivedKwab) return null;
    const age = Number((patientProfile as any)?.age ?? 65);
    const educationYears = Number((patientProfile as any)?.educationYears ?? 6);
    return getAQNormalComparison(derivedKwab.aq, age, educationYears);
  }, [derivedKwab, patientProfile]);

  const latestAndPreviousHistory = useMemo(() => {
    if (!patientForHistory) return { current: null, previous: null };
    const all = SessionManager.getHistoryFor(patientForHistory)
      .filter((row) => !String(row.historyId || "").startsWith("mock_"))
      .filter((row) =>
        currentTrainingMode === "rehab"
          ? row.trainingMode === "rehab"
          : row.trainingMode === "self" || !row.trainingMode,
      )
      .sort((a, b) => b.completedAt - a.completedAt);
    return {
      current: all[0] ?? null,
      previous: all[1] ?? null,
    };
  }, [currentTrainingMode, historyRefreshKey, patientForHistory]);

  const facialReport = useMemo(() => {
    return buildFacialReport(sessionData, latestAndPreviousHistory);
  }, [latestAndPreviousHistory, sessionData]);


  const currentHistoryEntry = latestAndPreviousHistory.current;

  const previousHistory = useMemo(() => {
    if (!patientForHistory) return [];
    const all = SessionManager.getHistoryFor(patientForHistory)
      .filter((row) => !String(row.historyId || "").startsWith("mock_"))
      .filter((row) =>
        currentTrainingMode === "rehab"
          ? row.trainingMode === "rehab"
          : row.trainingMode === "self" || !row.trainingMode,
      )
      .sort((a, b) => b.completedAt - a.completedAt);

    return all.length > 1 ? all.slice(1) : [];
  }, [currentTrainingMode, historyRefreshKey, patientForHistory]);

  const rehabComparison = useMemo(() => {
    if (!isRehabResult || rehabTargetStep < 1 || rehabTargetStep > 6)
      return null;
    const current = stepDetails.find((s) => s.id === rehabTargetStep);
    if (!current) return null;
    const latestPrevious = previousHistory[0];
    const key =
      `step${rehabTargetStep}` as keyof TrainingHistoryEntry["stepScores"];
    const prevScore = latestPrevious
      ? Number(latestPrevious.stepScores?.[key] ?? 0)
      : null;
    const currScore = Number(current.percent ?? 0);
    const delta =
      prevScore === null ? null : Number((currScore - prevScore).toFixed(1));
    return { current, prevScore, currScore, delta };
  }, [isRehabResult, rehabTargetStep, stepDetails, previousHistory]);

  const HISTORY_PAGE_SIZE = 4;
  const historyTotalPages = Math.max(
    1,
    Math.ceil(previousHistory.length / HISTORY_PAGE_SIZE),
  );
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return previousHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyPage, previousHistory]);

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    if (
      selectedHistory &&
      !previousHistory.some(
        (row) => row.historyId === selectedHistory.historyId,
      )
    ) {
      setSelectedHistory(null);
    }
  }, [previousHistory, selectedHistory]);

  // --- 데이터 불러오기 및 내보내기 로직 (보존) ---
  useEffect(() => {
    setIsMounted(true);
    const backups = {
      step1: parseStoredArray("step1_data"),
      step2: parseStoredArray("step2_recorded_audios"),
      step3: parseStoredArray("step3_data"),
      step4: parseStoredArray("step4_recorded_audios"),
      step5: parseStoredArray("step5_recorded_data"),
      step6: parseStoredArray("step6_recorded_data"),
    };
    setSessionData({
      step1: { items: backups.step1 },
      step2: { items: backups.step2 },
      step3: { items: backups.step3 },
      step4: { items: backups.step4 },
      step5: { items: backups.step5 },
      step6: { items: backups.step6 },
    });
    console.debug("[Result] backups loaded", {
      step1: backups.step1.length,
      step2: backups.step2.length,
      step3: backups.step3.length,
      step4: backups.step4.length,
      step5: backups.step5.length,
      step6: backups.step6.length,
    });
  }, []);

  useEffect(() => {
    if (!patientProfile) return;
    try {
      const sm = new SessionManager(patientProfile as any, place);
      sm.finalizeSessionAndSaveHistory(currentTrainingMode);
      setHistoryRefreshKey((v) => v + 1);
    } catch (e) {
      console.error("Result finalize/save history failed:", e);
    }
  }, [currentTrainingMode, patientProfile, place]);


  useEffect(() => {
    if (!patientProfile || !currentHistoryEntry) return;
    if (persistedHistoryIdRef.current === currentHistoryEntry.historyId) return;

    persistedHistoryIdRef.current = currentHistoryEntry.historyId;
    setDbSaveState("saving");

    void persistTrainingHistoryToDatabase(patientProfile, currentHistoryEntry)
      .then((response) => {
        setDbSaveState(response.skipped ? "local_only" : "saved");
      })
      .catch((error) => {
        console.error("[result-self] failed to persist clinical result", error);
        setDbSaveState("failed");
        persistedHistoryIdRef.current = null;
      });
  }, [currentHistoryEntry, patientProfile]);

  const handleExportData = () => {
    if (!sessionData) return;
    const patient = loadPatientProfile();
    const historyForPatient = patient
      ? SessionManager.getHistoryFor(patient as any).sort(
          (a, b) => b.completedAt - a.completedAt,
        )
      : [];
    const latestExamAt = historyForPatient[0]?.completedAt || Date.now();

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const formatExamDateTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    };
    const normalizeBirthDate = (raw: any) => {
      const text = String(raw || "").trim();
      const digits = text.replace(/[^\d]/g, "");
      if (digits.length >= 8) return digits.slice(0, 8);
      return "생년월일미입력";
    };
    const sanitizeName = (raw: any) => {
      const text = String(raw || "").trim() || "이름미입력";
      return text.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    };

    const rawStorageSnapshot = {
      step1_data: parseStoredArray("step1_data"),
      step2_recorded_audios: parseStoredArray("step2_recorded_audios"),
      step3_data: parseStoredArray("step3_data"),
      step4_recorded_audios: parseStoredArray("step4_recorded_audios"),
      step5_recorded_data: parseStoredArray("step5_recorded_data"),
      step6_recorded_data: parseStoredArray("step6_recorded_data"),
    };

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      patient,
      place,
      trainingMode: currentTrainingMode,
      queryScores,
      derivedKwab,
      summaryScores: stepDetails,
      details: sessionData,
      counts: {
        step1: sessionData?.step1?.items?.length || 0,
        step2: sessionData?.step2?.items?.length || 0,
        step3: sessionData?.step3?.items?.length || 0,
        step4: sessionData?.step4?.items?.length || 0,
        step5: sessionData?.step5?.items?.length || 0,
        step6: sessionData?.step6?.items?.length || 0,
      },
    };
    const files: ExportFile[] = [
      {
        name: "result.json",
        data: new TextEncoder().encode(JSON.stringify(exportPayload, null, 2)),
      },
      {
        name: "history.json",
        data: new TextEncoder().encode(
          JSON.stringify(historyForPatient, null, 2),
        ),
      },
      {
        name: "storage-snapshot.json",
        data: new TextEncoder().encode(
          JSON.stringify(rawStorageSnapshot, null, 2),
        ),
      },
    ];

    // 오디오/이미지 백업 로직 포함
    const zipBlob = createZipBlob(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    const birthDatePart = normalizeBirthDate((patient as any)?.birthDate);
    const namePart = sanitizeName((patient as any)?.name);
    const examDatePart = formatExamDateTime(latestExamAt);
    a.download = `${birthDatePart}-${namePart}-${examDatePart}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stopPlayback = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const playAudio = (url: string, id: string) => {
    if (playingIndex === id) {
      stopPlayback();
      setPlayingIndex(null);
      return;
    }
    stopPlayback();
    audioRef.current = new Audio(url);
    audioRef.current.play();
    setPlayingIndex(id);
    audioRef.current.onended = () => setPlayingIndex(null);
  };

  const playSpeechFallback = (text: string, id: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    if (playingIndex === id) {
      stopPlayback();
      setPlayingIndex(null);
      return;
    }
    stopPlayback();
    const utterance = new SpeechSynthesisUtterance(
      text || "음성 데이터가 없습니다.",
    );
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    utterance.onend = () => setPlayingIndex(null);
    utterance.onerror = () => setPlayingIndex(null);
    setPlayingIndex(id);
    window.speechSynthesis.speak(utterance);
  };

  if (!isMounted || !sessionData) return null;

  return (
    <>
      <style jsx global>{`
        @page {
          margin: 12mm;
        }
        @media print {
          html,
          body {
            height: auto !important;
            overflow: visible !important;
          }
          body {
            background: #fff !important;
          }
          .print-container {
            width: auto !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            height: auto !important;
            overflow: visible !important;
          }
          .h-full,
          .min-h-screen,
          .overflow-y-auto {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .sticky,
          .fixed {
            position: static !important;
          }
          section {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .profile-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        .print-only {
          display: none;
        }
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>

      <div className="h-full min-h-screen overflow-y-auto bg-[#FFF7ED] text-[#0f172a] pb-12">
        {/* 상단바 */}
        <header className="no-print h-16 px-4 sm:px-6 lg:px-[200px] border-b border-orange-100 flex items-center justify-between bg-white sticky top-0 z-40">
          <div className="w-full flex items-center justify-between min-w-0">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo/logo.png"
                alt="GOLDEN logo"
                className="w-10 h-10 rounded-xl object-cover"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-500">
                  Report
                </p>
                <h1 className="text-base sm:text-lg md:text-xl font-black flex items-center gap-1.5">
                  자가 진단 평가 결과
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="px-3 py-2 rounded-xl border border-orange-200 bg-orange-50 text-[11px] sm:text-xs font-bold text-orange-700">
                {dbSaveState === "saving" && "DB Sync In Progress"}
                {dbSaveState === "saved" && "DB Sync Complete"}
                {dbSaveState === "local_only" && "DB Not Configured - Local backup kept"}
                {dbSaveState === "failed" && "DB Sync Failed - Local backup kept"}
                {dbSaveState === "idle" && "DB Sync Pending"}
              </div>
              <button
                onClick={handleExportData}
                className="px-3 sm:px-4 py-2 bg-white text-slate-900 border border-orange-200 rounded-xl text-[11px] sm:text-xs font-bold shadow-sm hover:bg-orange-50 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5 text-orange-500" />
                데이터 백업
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-sm hover:bg-orange-600 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                진단서 출력
              </button>
              <button
                type="button"
                onClick={() => router.push("/select-page/self-assessment")}
                aria-label="홈으로 이동"
                title="홈"
                className="w-9 h-9 rounded-xl border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 transition-colors flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10.5 12 3l9 7.5"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.5 9.5V21h13V9.5"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 21v-5h4v5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="w-full max-w-[1076px] mx-auto px-4 sm:px-6 lg:px-0 py-5 sm:py-8 pb-10 sm:pb-8 space-y-4 sm:space-y-5 print-container">
          {/* [HEADER] 환자 프로필 */}
          {!isRehabResult && (
            <>
              <section className="no-print rounded-3xl border border-orange-300 bg-gradient-to-r from-orange-600 to-orange-500 p-5 sm:p-6 md:p-7 text-white shadow-sm">
                <p className="text-[11px] md:text-xs font-black uppercase tracking-[0.25em] text-orange-100">
                  Self Assessment Report
                </p>
                <h3 className="mt-2 text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
                  자가진단 종합 점수 {derivedKwab?.aq || "0.0"}점
                </h3>
                <p className="mt-2 text-sm sm:text-base md:text-lg font-bold text-orange-50 leading-relaxed">
                  자가진단 평가 결과를 기준으로 강점 영역과 집중 중재 영역을
                  확인하세요.
                </p>
              </section>

              <section className="no-print grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-3 bg-white p-3 md:p-4 rounded-3xl shadow-sm border border-orange-100">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-400 text-white font-black text-base sm:text-lg md:text-xl flex items-center justify-center shrink-0">
                    {(patientProfile?.name || "환").trim().charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg md:text-xl font-black text-slate-900 leading-snug truncate">
                      {patientProfile?.name || "미입력"} 님
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-slate-600 leading-relaxed">
                      <span className="font-semibold">
                        연령{" "}
                        <b className="font-black text-slate-900">
                          {patientProfile?.age || "-"}세
                        </b>
                      </span>
                      <span className="font-semibold">
                        교육 기간{" "}
                        <b className="font-black text-slate-900">
                          {patientProfile?.educationYears || "-"}년
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px] shadow-sm">
                  <p className="text-sm font-black text-slate-500">현재 점수</p>
                  <p className="text-lg sm:text-xl font-black text-orange-600 mt-1 leading-snug">
                    {derivedKwab?.aq || "0.0"}점
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px] shadow-sm">
                  <p className="text-sm font-black text-slate-500">평가 분류</p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 leading-snug">
                    {aqSeverityLabel(Number(derivedKwab?.aq || 0))}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px] shadow-sm">
                  <p className="text-sm font-black text-slate-500">
                    정상군 대비
                  </p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 leading-snug">
                    {normalComparison
                      ? `${normalComparison.diff >= 0 ? "+" : ""}${normalComparison.diff.toFixed(1)}`
                      : "-"}
                  </p>
                </div>
              </section>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 items-stretch print-top-grid">
            {rehabComparison && (
              <section className="no-print md:col-span-2 bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
                  반복훈련 변화 비교 (Step 0{rehabTargetStep})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-black text-slate-500">이번 점수</p>
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      {rehabComparison.currScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-black text-slate-500">이전 점수</p>
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      {rehabComparison.prevScore === null ? "기록 없음" : `${rehabComparison.prevScore.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-black text-slate-500">변화량</p>
                    <p
                      className={`text-base sm:text-lg font-black ${
                        rehabComparison.delta === null
                          ? "text-slate-700"
                          : rehabComparison.delta >= 0
                            ? "text-emerald-600"
                            : "text-orange-600"
                      }`}
                    >
                      {rehabComparison.delta === null
                        ? "-"
                        : `${rehabComparison.delta > 0 ? "+" : ""}${rehabComparison.delta.toFixed(1)}%p`}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>

          <SelfAssessmentBlocks
            stepDetails={stepDetails}
            sessionData={sessionData}
            clinicalImpression={clinicalImpression}
            openAllAccordions={openAllAccordions}
            openStepId={openStepId}
            setOpenAllAccordions={setOpenAllAccordions}
            setOpenStepId={setOpenStepId}
            getSelfItemFeedback={getSelfItemFeedback}
            shouldShowPlayButton={shouldShowPlayButton}
            getPlayableText={getPlayableText}
            playAudio={playAudio}
            playSpeechFallback={playSpeechFallback}
            playingIndex={playingIndex}
            facialReport={facialReport}
          />
        </main>
      </div>
    </>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div>LOADING...</div>}>
      <ResultContent />
    </Suspense>
  );
}

