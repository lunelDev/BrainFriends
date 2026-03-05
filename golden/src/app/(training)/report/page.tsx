"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SessionManager, TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { REHAB_STEP_LABELS } from "@/lib/results/rehab/constants";
import {
  buildDetailComparisons,
  buildStepResultCards,
  buildTrendChart,
  buildTrendRows,
  countImprovedMetrics,
} from "@/lib/results/rehab/adapters";

const STEP_META = [
  { key: "step1", label: "1단계 이해" },
  { key: "step2", label: "2단계 따라 말하기" },
  { key: "step3", label: "3단계 매칭" },
  { key: "step4", label: "4단계 유창성" },
  { key: "step5", label: "5단계 읽기" },
  { key: "step6", label: "6단계 쓰기" },
] as const;

type StepKey = (typeof STEP_META)[number]["key"];

const STEP_ID_BY_KEY: Record<StepKey, number> = {
  step1: 1,
  step2: 2,
  step3: 3,
  step4: 4,
  step5: 5,
  step6: 6,
};

function getStepItems(row: TrainingHistoryEntry, key: StepKey): any[] {
  const raw = row.stepDetails?.[key as keyof typeof row.stepDetails];
  return Array.isArray(raw) ? raw : [];
}

function getStepScore(row: TrainingHistoryEntry, key: StepKey): number {
  const raw = row.stepScores?.[key as keyof typeof row.stepScores];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { patient } = useTrainingSession();
  const [history, setHistory] = useState<TrainingHistoryEntry[]>([]);
  const [selected, setSelected] = useState<TrainingHistoryEntry | null>(null);
  const modeFromQuery = searchParams.get("mode");
  const initialMode: "self" | "rehab" = modeFromQuery === "rehab" ? "rehab" : "self";
  const [modeFilter, setModeFilter] = useState<"self" | "rehab">(initialMode);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setModeFilter(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!patient) {
      setHistory([]);
      setSelected(null);
      return;
    }
    const rows = SessionManager.getHistoryFor(patient as any).sort(
      (a, b) => b.completedAt - a.completedAt,
    );
    setHistory(rows);
    const preferredRows =
      initialMode === "rehab"
        ? rows.filter((r) => r.trainingMode === "rehab")
        : rows.filter((r) => r.trainingMode !== "rehab");
    setSelected(preferredRows[0] || rows[0] || null);
  }, [initialMode, patient]);

  const filteredHistory = useMemo(
    () =>
      history.filter((row) =>
        modeFilter === "rehab"
          ? row.trainingMode === "rehab"
          : row.trainingMode !== "rehab",
      ),
    [history, modeFilter],
  );

  useEffect(() => {
    if (!filteredHistory.length) {
      setSelected(null);
      return;
    }
    if (!selected) {
      setSelected(filteredHistory[0]);
      return;
    }
    const exists = filteredHistory.some((row) => row.historyId === selected.historyId);
    if (!exists) {
      setSelected(filteredHistory[0]);
    }
  }, [filteredHistory, selected]);

  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedHistoryIds(new Set());
    setShowDeleteConfirm(false);
  }, [modeFilter]);

  useEffect(() => {
    if (selectedHistoryIds.size === 0) {
      setShowDeleteConfirm(false);
    }
  }, [selectedHistoryIds]);

  useEffect(() => {
    if (!isSelectionMode) return;
    const allowed = new Set(filteredHistory.map((row) => row.historyId));
    setSelectedHistoryIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredHistory, isSelectionMode]);

  const reloadHistory = () => {
    if (!patient) return;
    const rows = SessionManager.getHistoryFor(patient as any).sort(
      (a, b) => b.completedAt - a.completedAt,
    );
    setHistory(rows);
  };

  const toggleHistorySelection = (historyId: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(historyId)) next.delete(historyId);
      else next.add(historyId);
      return next;
    });
  };

  const handleManageIconClick = () => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedHistoryIds(new Set());
      setShowDeleteConfirm(false);
      return;
    }
    if (selectedHistoryIds.size > 0) {
      setShowDeleteConfirm(true);
      return;
    }
    setSelectedHistoryIds(new Set());
    setShowDeleteConfirm(false);
    setIsSelectionMode(false);
  };

  const handleConfirmDeleteSelected = () => {
    if (!patient || selectedHistoryIds.size === 0) return;
    const removed = SessionManager.deleteHistoryEntries(
      patient as any,
      Array.from(selectedHistoryIds),
    );
    if (removed > 0) {
      reloadHistory();
    }
    setSelectedHistoryIds(new Set());
    setShowDeleteConfirm(false);
    setIsSelectionMode(false);
  };

  const allRehabSelected = useMemo(() => {
    if (!filteredHistory.length) return false;
    return filteredHistory.every((row) => selectedHistoryIds.has(row.historyId));
  }, [filteredHistory, selectedHistoryIds]);

  const handleToggleSelectAll = () => {
    if (!isSelectionMode) return;
    if (allRehabSelected) {
      setSelectedHistoryIds(new Set());
      return;
    }
    setSelectedHistoryIds(new Set(filteredHistory.map((row) => row.historyId)));
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const playAudio = (url: string, id: string) => {
    try {
      stopPlayback();
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      void audio.play();
    } catch {
      setPlayingId(null);
    }
  };

  const playSpeechFallback = (text: string, id: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      stopPlayback();
      const utterance = new SpeechSynthesisUtterance(text || "음성 데이터가 없습니다.");
      utterance.lang = "ko-KR";
      utterance.rate = 0.9;
      utterance.onend = () => setPlayingId(null);
      utterance.onerror = () => setPlayingId(null);
      setPlayingId(id);
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlayingId(null);
    }
  };

  const availableSteps = selected
    ? STEP_META.map((s) => ({
        ...s,
        items: getStepItems(selected, s.key),
      })).filter((s) => s.items.length > 0)
    : [];

  const isRehabContext = modeFilter === "rehab";
  const rehabPrimaryStep = useMemo(() => {
    if (!selected || selected.trainingMode !== "rehab") return null;
    if (
      Number.isFinite(Number(selected.rehabStep)) &&
      Number(selected.rehabStep) >= 1 &&
      Number(selected.rehabStep) <= 6
    ) {
      const stepId = Number(selected.rehabStep);
      const key = `step${stepId}` as StepKey;
      return {
        key,
        label: STEP_META.find((s) => s.key === key)?.label ?? `Step ${stepId}`,
        stepId,
        count: getStepItems(selected, key).length,
        score: getStepScore(selected, key),
      };
    }
    const candidates = STEP_META.map((s) => {
      const items = getStepItems(selected, s.key);
      return {
        key: s.key,
        label: s.label,
        stepId: STEP_ID_BY_KEY[s.key],
        count: items.length,
        score: getStepScore(selected, s.key),
      };
    }).filter((s) => s.count > 0);
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.count - a.count;
    });
    return candidates[0];
  }, [selected]);

  const rehabRowsByPrimaryStep = useMemo(() => {
    if (!rehabPrimaryStep) return [];
    return filteredHistory
      .filter((row) => row.trainingMode === "rehab")
      .filter((row) =>
        Number.isFinite(Number(row.rehabStep))
          ? Number(row.rehabStep) === rehabPrimaryStep.stepId
          : true,
      )
      .filter((row) => getStepItems(row, rehabPrimaryStep.key).length > 0);
  }, [filteredHistory, rehabPrimaryStep]);

  const previousRehabRow = useMemo(() => {
    if (!selected || !rehabRowsByPrimaryStep.length) return null;
    const idx = rehabRowsByPrimaryStep.findIndex(
      (row) => row.historyId === selected.historyId,
    );
    if (idx < 0) return null;
    return rehabRowsByPrimaryStep[idx + 1] || null;
  }, [rehabRowsByPrimaryStep, selected]);

  const rehabDetailComparisons = useMemo(() => {
    if (!rehabPrimaryStep || !selected) return [];
    return buildDetailComparisons(
      rehabPrimaryStep.stepId,
      selected,
      previousRehabRow,
    );
  }, [previousRehabRow, rehabPrimaryStep, selected]);

  const rehabImprovedCount = useMemo(
    () => countImprovedMetrics(rehabDetailComparisons),
    [rehabDetailComparisons],
  );

  const rehabStepCards = useMemo(() => {
    if (!rehabPrimaryStep || !selected) return [];
    return buildStepResultCards(rehabPrimaryStep.stepId, selected, rehabPrimaryStep.key);
  }, [rehabPrimaryStep, selected]);

  const rehabCurrentScore = useMemo(
    () => (rehabPrimaryStep && selected ? getStepScore(selected, rehabPrimaryStep.key) : 0),
    [rehabPrimaryStep, selected],
  );

  const rehabPreviousScore = useMemo(() => {
    if (!rehabPrimaryStep || !previousRehabRow) return null;
    return getStepScore(previousRehabRow, rehabPrimaryStep.key);
  }, [previousRehabRow, rehabPrimaryStep]);

  const rehabDelta = useMemo(() => {
    if (rehabPreviousScore === null) return null;
    return Number((rehabCurrentScore - rehabPreviousScore).toFixed(1));
  }, [rehabCurrentScore, rehabPreviousScore]);

  const rehabTrendRows = useMemo(() => {
    if (!rehabPrimaryStep) return [];
    return buildTrendRows(rehabRowsByPrimaryStep, rehabPrimaryStep.key);
  }, [rehabPrimaryStep, rehabRowsByPrimaryStep]);

  const rehabTrendChart = useMemo(
    () => buildTrendChart(rehabTrendRows),
    [rehabTrendRows],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="h-16 px-6 border-b border-orange-100 flex items-center justify-between bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
              Report
            </p>
            <h1 className="text-lg font-black">재활 활동 기록</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(modeFilter === "rehab" ? "/rehab" : "/select")}
          aria-label="홈으로 이동"
          title="홈"
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5V21h13V9.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 21v-5h4v5" />
          </svg>
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 lg:gap-6">
        <section
          className={`bg-white rounded-2xl p-4 border ${
            isRehabContext ? "border-sky-100" : "border-orange-100"
          } relative`}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="pr-12">
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isRehabContext ? "text-sky-500" : "text-orange-500"
                }`}
              >
                Patient
              </p>
              <p className="text-sm font-bold text-slate-700">
                {patient?.name || "환자 정보 없음"}
              </p>
            </div>
            <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={handleManageIconClick}
                  title={!isSelectionMode ? "수정" : "삭제"}
                  aria-label={!isSelectionMode ? "수정" : "삭제"}
                  className={`h-9 w-9 rounded-lg border transition-colors inline-flex items-center justify-center ${
                    isSelectionMode
                      ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                      : modeFilter === "rehab"
                        ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                        : "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    {isSelectionMode ? (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 6h18"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 6V4h8v2"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 6l1 14h10l1-14"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m13.5 7 3.5 3.5"
                        />
                      </>
                    )}
                  </svg>
                </button>
              </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModeFilter("self")}
              className={`h-9 rounded-lg border text-sm font-black transition-colors ${
                modeFilter === "self"
                  ? "bg-orange-50 border-orange-300 text-orange-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              자가진단
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("rehab")}
              className={`h-9 rounded-lg border text-sm font-black transition-colors ${
                modeFilter === "rehab"
                  ? "bg-sky-50 border-sky-300 text-sky-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              언어재활
            </button>
          </div>
          {isSelectionMode && showDeleteConfirm && (
            <div className="absolute inset-0 z-30 rounded-2xl bg-slate-900/25 backdrop-blur-[2px] flex items-start justify-center p-4 pt-20">
              <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                    </svg>
                  </span>
                  <p className="text-sm font-black text-slate-900">기록 삭제 확인</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-black text-slate-800">
                    선택한 <span className="text-red-600">{selectedHistoryIds.size}개</span> 기록을 삭제할까요?
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    삭제 후에는 복구할 수 없습니다.
                  </p>
                </div>
                <div className="px-4 pb-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteSelected}
                    className="h-8 px-3 rounded-lg border border-red-300 bg-red-600 text-xs font-black text-white hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500">
              {modeFilter === "rehab"
                ? "저장된 언어재활 리포트가 없습니다."
                : "저장된 자가진단 리포트가 없습니다."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {isSelectionMode && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 flex items-center">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-5 h-5 rounded border transition-colors inline-flex items-center justify-center ${
                        allRehabSelected
                          ? "bg-sky-500 border-sky-500 text-white"
                          : "bg-white border-slate-300 text-transparent"
                      }`}
                      aria-label={allRehabSelected ? "전체 선택 해제" : "전체 선택"}
                      title={allRehabSelected ? "전체 선택 해제" : "전체 선택"}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m5 13 4 4L19 7"
                        />
                      </svg>
                    </button>
                    <p className="text-xs font-black text-slate-700">
                      {selectedHistoryIds.size}개 선택됨
                    </p>
                  </div>
                </div>
              )}
              {filteredHistory.map((row) => (
                <button
                  key={row.historyId}
                  type="button"
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleHistorySelection(row.historyId);
                      return;
                    }
                    setSelected(row);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedHistoryIds.has(row.historyId)
                      ? "border-red-300 bg-red-50"
                      : selected?.historyId === row.historyId
                      ? row.trainingMode === "rehab"
                        ? "border-sky-300 bg-sky-50"
                        : "border-orange-300 bg-orange-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isSelectionMode && (
                      <span
                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          selectedHistoryIds.has(row.historyId)
                            ? "border-sky-500 bg-sky-500 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m5 13 4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-800">
                        {new Date(row.completedAt).toLocaleString("ko-KR")}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            row.trainingMode === "rehab"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {row.trainingMode === "rehab" ? "언어재활" : "자가진단"}
                        </span>
                        <p className="text-[11px] font-bold text-slate-600">
                          장소: {row.place} · AQ {row.aq}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          className={`bg-white rounded-2xl p-4 md:p-5 border ${
            selected?.trainingMode === "rehab"
              ? "border-sky-100"
              : "border-orange-100"
          }`}
        >
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-500">
              선택된 리포트가 없습니다.
            </div>
          ) : availableSteps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-500">
              데이터가 없습니다.
            </div>
          ) : selected.trainingMode === "rehab" && rehabPrimaryStep ? (
            <div className="space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-24">
              <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 text-white p-5 shadow-sm">
                <p className="text-xs sm:text-sm font-black opacity-90">
                  Step {rehabPrimaryStep.stepId} · {REHAB_STEP_LABELS[rehabPrimaryStep.stepId]}
                </p>
                <h2 className="text-3xl font-black mt-1">
                  이번 점수 {rehabCurrentScore.toFixed(1)}점
                </h2>
                <p className="text-xs sm:text-sm opacity-90 mt-2">
                  이전 동일 훈련 기록과 비교해 변화량을 확인하세요.
                </p>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-500">현재 점수</p>
                  <p className="text-4xl font-black text-slate-900 mt-1">
                    {rehabCurrentScore.toFixed(1)}점
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-500">이전 점수</p>
                  <p className="text-4xl font-black text-slate-900 mt-1">
                    {rehabPreviousScore === null ? "기록 없음" : `${rehabPreviousScore.toFixed(1)}점`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-black text-slate-500">변화량</p>
                  <p className="text-4xl font-black text-sky-600 mt-1">
                    {rehabDelta === null ? "-" : `${rehabDelta > 0 ? "+" : ""}${rehabDelta.toFixed(1)}점`}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-black text-slate-900">
                    {rehabPrimaryStep.stepId === 6 ? "이번 쓰기 결과 요약" : "이번 훈련 세부 항목 비교"}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">개선 항목 {rehabImprovedCount}개</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs leading-relaxed">
                    {rehabDetailComparisons.map((metric) => {
                      const hasPrevious = metric.previous !== null;
                      const diff =
                        hasPrevious && metric.current !== null
                          ? Number((metric.current - (metric.previous as number)).toFixed(1))
                          : null;
                      return (
                        <span
                          key={metric.key}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm"
                        >
                          <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          <span className="font-semibold">{metric.label}</span>
                          <b className="text-slate-900">
                            {metric.current === null ? "측정 없음" : `${metric.current.toFixed(1)}${metric.unit}`}
                          </b>
                          <span className="text-slate-400">/</span>
                          <span className="font-semibold text-slate-500">
                            {hasPrevious ? `이전 ${metric.previous?.toFixed(1)}${metric.unit}` : "이전 없음"}
                          </span>
                          <b className="text-sky-600">
                            {diff === null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${metric.unit}`}
                          </b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <h3 className="text-xl font-black text-slate-900">수행 기록 상세</h3>
                  <span className="text-xs font-bold text-slate-500">
                    Step {rehabPrimaryStep.stepId} · {rehabStepCards.length} Activities
                  </span>
                </div>
                <div className={`grid gap-2 ${rehabStepCards.length === 3 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}>
                  {rehabStepCards.map((item) => (
                    <div key={`rehab-card-${item.index}`} className="group bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-slate-300 uppercase">Index {item.index}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            item.isCorrect ? "bg-emerald-50 text-emerald-500" : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {item.isCorrect ? "CORRECT" : "REVIEW"}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-snug">"{item.text}"</p>
                      {rehabPrimaryStep.stepId === 6 && item.userImage && (
                        <div className="aspect-video bg-slate-50 rounded-md mt-2 overflow-hidden border border-slate-100 flex items-center justify-center">
                          <img
                            src={item.userImage}
                            className="max-h-full max-w-full object-contain p-2"
                            alt="rehab-writing-result"
                          />
                        </div>
                      )}
                      {(item.feedbackGood || item.feedbackImprove) && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                          {item.feedbackGood && (
                            <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                              <span className="text-sky-600">좋았던 점:</span> {item.feedbackGood}
                            </p>
                          )}
                          {item.feedbackImprove && (
                            <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                              <span className="text-slate-700">개선점:</span> {item.feedbackImprove}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-black text-slate-900">
                    Step {rehabPrimaryStep.stepId} 변화 추이
                  </h3>
                  <span className="text-xs font-bold text-slate-500">최근 {rehabTrendRows.length}회</span>
                </div>
                {rehabTrendRows.length === 0 ? (
                  <p className="text-sm text-slate-500 font-semibold py-4">이전 데이터가 없습니다.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 overflow-x-auto">
                    <svg viewBox={`0 0 ${rehabTrendChart?.width ?? 640} ${rehabTrendChart?.height ?? 200}`} className="min-w-[560px] w-full h-44 sm:h-48">
                      {[0, 25, 50, 75, 100].map((t) => {
                        const y =
                          (rehabTrendChart?.padTop ?? 16) +
                          ((100 - t) / 100) *
                            ((rehabTrendChart?.height ?? 200) -
                              (rehabTrendChart?.padTop ?? 16) -
                              (rehabTrendChart?.padBottom ?? 34));
                        return (
                          <g key={`grid-${t}`}>
                            <line
                              x1={rehabTrendChart?.padLeft ?? 24}
                              y1={y}
                              x2={(rehabTrendChart?.width ?? 640) - (rehabTrendChart?.padRight ?? 12)}
                              y2={y}
                              stroke="#E2E8F0"
                              strokeWidth="1"
                            />
                            <text x="2" y={y + 3} fontSize="9" fill="#64748B">{t}</text>
                          </g>
                        );
                      })}
                      {rehabTrendChart && rehabTrendChart.points.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#0284C7"
                          strokeWidth="3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={rehabTrendChart.polyline}
                        />
                      )}
                      {rehabTrendChart?.points.map((p) => (
                        <g key={`pt-${p.x}-${p.y}`}>
                          <circle cx={p.x} cy={p.y} r="4" fill="#0EA5E9" />
                          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#0F172A" className="hidden sm:block">
                            {p.score.toFixed(1)}점
                          </text>
                          <text x={p.x} y={(rehabTrendChart.height ?? 200) - 10} textAnchor="middle" fontSize="9" fill="#64748B">
                            {p.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-24">
              <div
                className={`rounded-xl border p-4 ${
                  selected.trainingMode === "rehab"
                    ? "bg-sky-50 border-sky-200"
                    : "bg-orange-50 border-orange-200"
                }`}
              >
                <p className="text-xs font-black text-slate-700">
                  {new Date(selected.completedAt).toLocaleString("ko-KR")}
                </p>
                <p className="text-sm font-bold text-slate-600 mt-1">
                  {selected.trainingMode === "rehab" ? "언어재활" : "자가진단"} · 환자:{" "}
                  {selected.patientName} · 장소: {selected.place} · AQ {selected.aq}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableSteps.map((s) => (
                  <div
                    key={s.key}
                    className={`rounded-xl border p-3 ${
                      selected.trainingMode === "rehab"
                        ? "border-sky-200 bg-sky-50/40"
                        : "border-orange-200 bg-orange-50/30"
                    }`}
                  >
                    <p className="text-[10px] font-black text-slate-500">{s.label}</p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                      {getStepScore(selected, s.key)}%
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {availableSteps.map((s) => (
                  <div
                    key={`detail-${s.key}`}
                    className="rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <p className="text-xs font-black text-slate-700">
                        {s.label} 상세 ({s.items.length})
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-2">
                      {s.items.map((it: any, idx: number) => {
                        const pid = `${s.key}-${idx}`;
                        return (
                          <div
                            key={pid}
                            className="rounded-lg border border-slate-200 bg-white p-3 h-full flex flex-col"
                          >
                            <p className="text-[10px] font-black text-slate-400 mb-1">
                              #{idx + 1}
                            </p>
                            <p className="text-xs font-bold text-slate-700 break-keep">
                              {String(
                                it?.text ||
                                  it?.word ||
                                  it?.prompt ||
                                  it?.targetText ||
                                  "데이터 없음",
                              )}
                            </p>

                            {it?.userImage && (
                              <div className="mt-2 h-24 bg-slate-50 border border-slate-200 rounded-md overflow-hidden flex items-center justify-center">
                                <img
                                  src={it.userImage}
                                  alt="쓰기 결과"
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            )}

                            {(it?.audioUrl || s.key === "step5") && (
                              <button
                                type="button"
                                onClick={() =>
                                  it?.audioUrl
                                    ? playAudio(it.audioUrl, pid)
                                    : playSpeechFallback(
                                        String(
                                          it?.text ||
                                            it?.word ||
                                            it?.prompt ||
                                            it?.targetText ||
                                            "음성 데이터가 없습니다.",
                                        ),
                                        pid,
                                      )
                                }
                                className="mt-auto w-full py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-black text-slate-700 transition-colors"
                              >
                                {playingId === pid ? "재생 중..." : "음성 재생"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-6">리포트 불러오는 중...</div>}>
      <ReportContent />
    </Suspense>
  );
}
