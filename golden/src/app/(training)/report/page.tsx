"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import {
  SessionManager,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";
import { REHAB_STEP_LABELS } from "@/lib/results/rehab/constants";
import { TRAINING_PLACES } from "@/constants/trainingData";
import {
  buildDetailComparisons,
  buildFacialReport,
  buildStepResultCards,
  buildTrendChart,
  buildTrendRows,
  countImprovedMetrics,
} from "@/lib/results/rehab/adapters";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  FileText,
  HeartHandshake,
  MessageSquare,
  ScanFace,
  Sparkles,
  TrendingUp,
} from "lucide-react";

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

const SELF_LABEL_BY_KEY: Record<StepKey, string> = {
  step1: "청각 이해",
  step2: "따라말하기",
  step3: "단어 명명",
  step4: "유창성",
  step5: "읽기",
  step6: "쓰기",
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

function getPlaceLabel(place: string): string {
  const key = String(place || "").toLowerCase();
  const found = TRAINING_PLACES.find((p) => p.id === key);
  return found?.title || place || "-";
}

function getRehabItemLabel(row: TrainingHistoryEntry): string {
  const step = Number(row.rehabStep);
  if (Number.isFinite(step) && step >= 1 && step <= 6) {
    return REHAB_STEP_LABELS[step as 1 | 2 | 3 | 4 | 5 | 6];
  }
  return "반복훈련";
}

function getRehabRowScore(row: TrainingHistoryEntry): number {
  const step = Number(row.rehabStep);
  if (Number.isFinite(step) && step >= 1 && step <= 6) {
    const key = `step${step}` as StepKey;
    return getStepScore(row, key);
  }
  const scores = Object.values(row.stepScores || {}).map((v) => Number(v) || 0);
  return scores.length ? Math.max(...scores) : 0;
}

function formatSelfMetricDisplay(key: StepKey, score: number): string {
  const safe = Number(score || 0);
  if (key === "step1" || key === "step3" || key === "step4") {
    return `${(safe / 10).toFixed(1)}/10`;
  }
  return `${safe.toFixed(1)}점`;
}

function isSyntheticHistoryRow(row: TrainingHistoryEntry): boolean {
  const historyId = String(row.historyId || "");
  const sessionId = String(row.sessionId || "");
  if (historyId.startsWith("mock_") || sessionId.startsWith("mock_session_")) {
    return true;
  }

  const allItems = Object.values(row.stepDetails || {})
    .flatMap((v) => (Array.isArray(v) ? v : []))
    .filter(Boolean) as Array<Record<string, any>>;

  if (!allItems.length) return false;

  const isSyntheticItem = (item: Record<string, any>) => {
    const text = String(item?.text || item?.transcript || "").trim();
    if (text.includes("시연용 더미")) return true;
    if (text.startsWith("예시 ")) return true;
    return false;
  };

  return allItems.every((item) => isSyntheticItem(item));
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { patient } = useTrainingSession();
  const [history, setHistory] = useState<TrainingHistoryEntry[]>([]);
  const [selected, setSelected] = useState<TrainingHistoryEntry | null>(null);
  const modeFromQuery = searchParams.get("mode");
  const initialMode: "self" | "rehab" =
    modeFromQuery === "rehab" ? "rehab" : "self";
  const [modeFilter, setModeFilter] = useState<"self" | "rehab">(initialMode);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<number | null>(1);
  const [openAllAccordions, setOpenAllAccordions] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(
    new Set(),
  );
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
    const rows = SessionManager.getHistoryFor(patient as any)
      .filter((row) => !isSyntheticHistoryRow(row))
      .sort((a, b) => b.completedAt - a.completedAt);
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
    const exists = filteredHistory.some(
      (row) => row.historyId === selected.historyId,
    );
    if (!exists) {
      setSelected(filteredHistory[0]);
    }
  }, [filteredHistory, selected]);

  useEffect(() => {
    setOpenAllAccordions(false);
    setOpenStepId(1);
  }, [selected?.historyId]);

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
    const rows = SessionManager.getHistoryFor(patient as any)
      .filter((row) => !isSyntheticHistoryRow(row))
      .sort((a, b) => b.completedAt - a.completedAt);
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
    return filteredHistory.every((row) =>
      selectedHistoryIds.has(row.historyId),
    );
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
      const utterance = new SpeechSynthesisUtterance(
        text || "음성 데이터가 없습니다.",
      );
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

  const selfProfileRows = useMemo(() => {
    if (!selected || selected.trainingMode === "rehab") return [];
    return (Object.keys(SELF_LABEL_BY_KEY) as StepKey[]).map((key) => ({
      key,
      label: SELF_LABEL_BY_KEY[key],
      score: getStepScore(selected, key),
      items: getStepItems(selected, key),
    }));
  }, [selected]);

  const selfRadarNodes = useMemo(() => {
    const center = 170;
    const radius = 102;
    const rows = selfProfileRows.length ? selfProfileRows : [];
    if (!rows.length)
      return [] as Array<{
        x: number;
        y: number;
        label: string;
        score: number;
      }>;
    return rows.map((row, idx) => {
      const angle = (Math.PI * 2 * idx) / rows.length - Math.PI / 2;
      const normalized =
        Math.max(0, Math.min(100, Number(row.score || 0))) / 100;
      return {
        label: row.label,
        score: Number(row.score || 0),
        x: center + radius * normalized * Math.cos(angle),
        y: center + radius * normalized * Math.sin(angle),
      };
    });
  }, [selfProfileRows]);

  const selfClinicalImpression = useMemo(() => {
    if (!selfProfileRows.length) return null;
    const strongest = selfProfileRows.reduce((a, b) =>
      a.score >= b.score ? a : b,
    );
    const weakest = selfProfileRows.reduce((a, b) =>
      a.score <= b.score ? a : b,
    );
    return {
      strongestText: `${strongest.label} ${formatSelfMetricDisplay(strongest.key, strongest.score)}`,
      weakestText: `${weakest.label} ${formatSelfMetricDisplay(weakest.key, weakest.score)}`,
      encourageText: "하루 15분 · 주 5회 생활 연습",
      summary: `일상 대화의 바탕이 잘 유지되고 있으며, 전반적으로 의사소통을 이어갈 수 있는 힘이 확인됩니다. 특히 ${strongest.label}은 안정적으로 나타났고, ${weakest.label}은 생활 속 반복 연습을 통해 더 편안해질 수 있습니다.`,
      strength: `${strongest.label}(${formatSelfMetricDisplay(strongest.key, strongest.score)})이 특히 안정적으로 확인되었습니다. 이 부분은 아주 건강하시네요!`,
      need: `${weakest.label}(${formatSelfMetricDisplay(weakest.key, weakest.score)})은 조금 더 연습이 필요한 부분입니다. 이 부분이 좋아지면 가족과 대화할 때 떠오른 생각을 더 또렷하게 전하고, 외출이나 전화 상황에서도 원하는 말을 더 편안하게 표현하는 데 도움이 됩니다.`,
      recommendation:
        "오늘은 집에서 15분만 가볍게 연습해 보세요. 사진이나 생활 물건을 보며 이름 말하기 5분, 짧은 문장 따라 말하기 5분, 소리 내어 읽기 5분을 주 5회 꾸준히 이어가면 일상 대화가 한층 자연스러워집니다.",
    };
  }, [selfProfileRows]);

  const selfPreviousRow = useMemo(() => {
    if (!selected || selected.trainingMode === "rehab") return null;
    const selfRows = history
      .filter((row) => row.trainingMode !== "rehab")
      .sort((a, b) => b.completedAt - a.completedAt);
    const idx = selfRows.findIndex(
      (row) => row.historyId === selected.historyId,
    );
    if (idx < 0) return null;
    return selfRows[idx + 1] || null;
  }, [history, selected]);

  const selfFacialReport = useMemo(() => {
    if (!selected || selected.trainingMode === "rehab") return null;
    return buildFacialReport(selected, selfPreviousRow);
  }, [selected, selfPreviousRow]);

  const selfCurrentScore = useMemo(() => Number(selected?.aq || 0), [selected]);

  const selfPreviousScore = useMemo(
    () => (selfPreviousRow ? Number(selfPreviousRow.aq || 0) : null),
    [selfPreviousRow],
  );

  const selfScoreDelta = useMemo(() => {
    if (selfPreviousScore === null) return null;
    return Number((selfCurrentScore - selfPreviousScore).toFixed(1));
  }, [selfCurrentScore, selfPreviousScore]);

  const getSelfItemFeedback = (stepId: number, item: any) => {
    const score = Number(
      item?.writingScore ??
        item?.readingScore ??
        item?.kwabScore ??
        item?.fluencyScore ??
        item?.finalScore ??
        item?.speechScore ??
        (item?.isCorrect ? 90 : 50),
    );
    const good =
      score >= 80
        ? "좋았던 점: 수행 흐름이 안정적입니다."
        : "좋았던 점: 끝까지 과제를 시도했습니다.";
    const improve =
      stepId === 6
        ? "개선점: 획 간격과 시작 위치를 일정하게 맞춰보세요."
        : "개선점: 핵심 단어를 천천히 또렷하게 반복해보세요.";
    return { good, improve };
  };

  const shouldShowPlayButton = (stepId: number, item: any) =>
    [2, 4, 5].includes(stepId) &&
    Boolean(
      item?.audioUrl ||
      item?.text ||
      item?.transcript ||
      item?.targetText ||
      item?.prompt,
    );

  const getPlayableText = (item: any) =>
    String(
      item?.text ||
        item?.transcript ||
        item?.targetText ||
        item?.targetWord ||
        item?.prompt ||
        "음성 데이터가 없습니다.",
    );

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
    return buildStepResultCards(
      rehabPrimaryStep.stepId,
      selected,
      rehabPrimaryStep.key,
    );
  }, [rehabPrimaryStep, selected]);

  const rehabCurrentScore = useMemo(
    () =>
      rehabPrimaryStep && selected
        ? getStepScore(selected, rehabPrimaryStep.key)
        : 0,
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
  const selectionCheckedClass =
    modeFilter === "rehab"
      ? "bg-sky-500 border-sky-500 text-white"
      : "bg-orange-500 border-orange-500 text-white";

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
          onClick={() =>
            router.push(modeFilter === "rehab" ? "/rehab" : "/select")
          }
          aria-label="홈으로 이동"
          title="홈"
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
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
                    </svg>
                  </span>
                  <p className="text-sm font-black text-slate-900">
                    기록 삭제 확인
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-black text-slate-800">
                    선택한{" "}
                    <span className="text-red-600">
                      {selectedHistoryIds.size}개
                    </span>{" "}
                    기록을 삭제할까요?
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
                          ? selectionCheckedClass
                          : "bg-white border-slate-300 text-transparent"
                      }`}
                      aria-label={
                        allRehabSelected ? "전체 선택 해제" : "전체 선택"
                      }
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
                            ? selectionCheckedClass
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
                          {row.trainingMode === "rehab"
                            ? "언어재활"
                            : "자가진단"}
                        </span>
                        <p className="text-[11px] font-bold text-slate-600">
                          {row.trainingMode === "rehab"
                            ? `장소: ${getPlaceLabel(row.place)} · 훈련: ${getRehabItemLabel(row)} · 점수: ${getRehabRowScore(row).toFixed(1)}점`
                            : `장소: ${getPlaceLabel(row.place)} · 평가점수: ${Number(row.aq || 0).toFixed(1)}점`}
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
              <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 text-white p-5 shadow-sm h-[140px] flex flex-col justify-center">
                <p className="text-xs font-black opacity-90">
                  Step {rehabPrimaryStep.stepId} ·{" "}
                  {REHAB_STEP_LABELS[rehabPrimaryStep.stepId]}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black mt-1">
                  재활 점수 {rehabCurrentScore.toFixed(1)}점
                </h2>
                <p className="text-xs sm:text-sm opacity-90 mt-2">
                  검사일시:{" "}
                  {new Date(selected.completedAt).toLocaleString("ko-KR")}
                </p>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-sky-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">현재 점수</p>
                  <p className="text-2xl font-black text-sky-600 mt-1">
                    {rehabCurrentScore.toFixed(1)}점
                  </p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">이전 점수</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {rehabPreviousScore === null
                      ? "기록 없음"
                      : `${rehabPreviousScore.toFixed(1)}점`}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">변화량</p>
                  <p className="text-2xl font-black text-sky-600 mt-1">
                    {rehabDelta === null
                      ? "-"
                      : `${rehabDelta > 0 ? "+" : ""}${rehabDelta.toFixed(1)}점`}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-sky-600" />
                    </span>
                    {rehabPrimaryStep.stepId === 6
                      ? "이번 쓰기 결과 요약"
                      : "이번 훈련 세부 항목 비교"}
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    개선 항목 {rehabImprovedCount}개
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs leading-relaxed">
                    {rehabDetailComparisons.map((metric) => {
                      const hasPrevious = metric.previous !== null;
                      const diff =
                        hasPrevious && metric.current !== null
                          ? Number(
                              (
                                metric.current - (metric.previous as number)
                              ).toFixed(1),
                            )
                          : null;
                      return (
                        <span
                          key={metric.key}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm"
                        >
                          <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          <span className="font-semibold">{metric.label}</span>
                          <b className="text-slate-900">
                            {metric.current === null
                              ? "측정 없음"
                              : `${metric.current.toFixed(1)}${metric.unit}`}
                          </b>
                          <span className="text-slate-400">/</span>
                          <span className="font-semibold text-slate-500">
                            {hasPrevious
                              ? `이전 ${metric.previous?.toFixed(1)}${metric.unit}`
                              : "이전 없음"}
                          </span>
                          <b className="text-sky-600">
                            {diff === null
                              ? "-"
                              : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${metric.unit}`}
                          </b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-sky-600" />
                    </span>
                    수행 기록 상세
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Step {rehabPrimaryStep.stepId} · {rehabStepCards.length}{" "}
                    Activities
                  </span>
                </div>
                <div
                  className={`grid gap-2 ${rehabStepCards.length === 3 ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"}`}
                >
                  {rehabStepCards.map((item) => (
                    <div
                      key={`rehab-card-${item.index}`}
                      className="group bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-slate-300 uppercase">
                          Index {item.index}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                            item.isCorrect
                              ? "bg-emerald-50 text-emerald-500"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {item.isCorrect ? "CORRECT" : "REVIEW"}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-snug">
                        "{item.text}"
                      </p>
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
                              <span className="text-sky-600">좋았던 점:</span>{" "}
                              {item.feedbackGood}
                            </p>
                          )}
                          {item.feedbackImprove && (
                            <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                              <span className="text-slate-700">개선점:</span>{" "}
                              {item.feedbackImprove}
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
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-sky-600" />
                    </span>
                    <span className="text-sky-600">
                      {REHAB_STEP_LABELS[rehabPrimaryStep.stepId]}
                    </span>{" "}
                    변화 추이
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    최근 {rehabTrendRows.length}회
                  </span>
                </div>
                {rehabTrendRows.length === 0 ? (
                  <p className="text-sm text-slate-500 font-semibold py-4">
                    이전 데이터가 없습니다.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${rehabTrendChart?.width ?? 640} ${rehabTrendChart?.height ?? 200}`}
                      className="min-w-[560px] w-full h-44 sm:h-48"
                    >
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
                              x2={
                                (rehabTrendChart?.width ?? 640) -
                                (rehabTrendChart?.padRight ?? 12)
                              }
                              y2={y}
                              stroke="#E2E8F0"
                              strokeWidth="1"
                            />
                            <text x="2" y={y + 3} fontSize="9" fill="#64748B">
                              {t}
                            </text>
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
                          <text
                            x={p.x}
                            y={p.y - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#0F172A"
                            className="hidden sm:block"
                          >
                            {p.score.toFixed(1)}점
                          </text>
                          <text
                            x={p.x}
                            y={(rehabTrendChart.height ?? 200) - 10}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#64748B"
                          >
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
              <section className="rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 text-white p-5 shadow-sm h-[140px] flex flex-col justify-center">
                <p className="text-xs font-black opacity-90">
                  {selected.patientName || "환자"} 님의 자가진단 리포트
                </p>
                <h2 className="text-2xl sm:text-3xl font-black mt-1">
                  종합 점수 {Number(selected.aq || 0).toFixed(1)}점
                </h2>
                <p className="text-xs sm:text-sm opacity-90 mt-2">
                  검사일시:{" "}
                  {new Date(selected.completedAt).toLocaleString("ko-KR")}
                </p>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">현재 점수</p>
                  <p className="text-2xl font-black text-orange-600 mt-1">
                    {selfCurrentScore.toFixed(1)}점
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">이전 점수</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {selfPreviousScore === null
                      ? "기록 없음"
                      : `${selfPreviousScore.toFixed(1)}점`}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">변화량</p>
                  <p className="text-2xl font-black text-orange-600 mt-1">
                    {selfScoreDelta === null
                      ? "-"
                      : `${selfScoreDelta > 0 ? "+" : ""}${selfScoreDelta.toFixed(1)}점`}
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-[32px] p-4 md:p-5 border border-orange-200 shadow-sm">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-orange-500" />
                  </span>
                  언어 기능 프로파일
                </h3>
                <div className="rounded-[24px] border border-orange-200 bg-orange-50/30 p-3 md:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-orange-100 bg-white p-2 flex items-center justify-center md:h-[280px]">
                      <svg
                        viewBox="0 0 340 340"
                        className="w-[260px] h-[260px] sm:w-[280px] sm:h-[280px] md:w-[300px] md:h-[300px]"
                      >
                        {[0.25, 0.5, 0.75, 1].map((st) => (
                          <polygon
                            key={`grid-${st}`}
                            points={selfProfileRows
                              .map((_, i) => {
                                const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                                return `${170 + 102 * st * Math.cos(a)},${170 + 102 * st * Math.sin(a)}`;
                              })
                              .join(" ")}
                            fill="none"
                            stroke="#E2E8F0"
                            strokeWidth="2"
                          />
                        ))}
                        {selfRadarNodes.length > 2 && (
                          <polygon
                            points={selfRadarNodes
                              .map((n) => `${n.x},${n.y}`)
                              .join(" ")}
                            fill="rgba(249,115,22,0.15)"
                            stroke="#F97316"
                            strokeWidth="3"
                            strokeLinejoin="round"
                          />
                        )}
                        {selfRadarNodes.map((n, idx) => (
                          <g key={`node-${idx}`}>
                            <circle cx={n.x} cy={n.y} r="4" fill="#F97316" />
                          </g>
                        ))}
                      </svg>
                    </div>
                    <div className="grid grid-cols-2 grid-rows-3 gap-2 md:h-[280px]">
                      {selfProfileRows.map((row) => (
                        <div
                          key={`self-metric-${row.key}`}
                          className="rounded-xl border border-orange-100 bg-white p-3 flex items-center justify-between"
                        >
                          <p className="text-xs font-black text-slate-500">
                            {row.label}
                          </p>
                          <p className="text-xl font-black text-slate-900">
                            {formatSelfMetricDisplay(row.key, row.score)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl p-4 md:p-6 border border-orange-200 shadow-sm">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2 leading-relaxed">
                  <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-orange-500" />
                  </span>
                  전문가 임상 소견
                </h3>
                <div className="bg-orange-50/40 border border-orange-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                      <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">
                        잘하고 있는 점
                      </p>
                      <p className="mt-1 text-sm md:text-base font-bold text-slate-900 leading-loose">
                        {selfClinicalImpression?.strongestText}
                      </p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                      <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">
                        노력이 필요한 점
                      </p>
                      <p className="mt-1 text-sm md:text-base font-bold text-orange-600 leading-loose">
                        {selfClinicalImpression?.weakestText}
                      </p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                      <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">
                        오늘의 응원 권고
                      </p>
                      <p className="mt-1 text-sm md:text-base font-bold text-slate-900 leading-loose">
                        {selfClinicalImpression?.encourageText}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                      <p className="min-w-0 text-sm md:text-base font-semibold text-slate-800 leading-loose whitespace-pre-line break-words">
                        {selfClinicalImpression?.summary}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                      <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                        잘하고 있는 점: {selfClinicalImpression?.strength}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                      <Activity className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                      <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                        노력이 필요한 점: {selfClinicalImpression?.need}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                      <HeartHandshake className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                      <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                        오늘의 응원 권고:{" "}
                        {selfClinicalImpression?.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="no-print bg-white rounded-2xl p-5 border border-orange-200 shadow-sm">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-orange-500" />
                      </span>
                      수행 기록 상세
                    </h3>
                    <p className="text-sm font-bold text-slate-600">
                      단계별 항목을 펼쳐 상세 기록을 확인하세요.
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenAllAccordions((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {openAllAccordions ? "전체닫기" : "전체보기"}
                  </button>
                </div>

                <div className="space-y-3">
                  {availableSteps.map((s) => {
                    const stepId = STEP_ID_BY_KEY[s.key];
                    const isOpen = openAllAccordions || openStepId === stepId;
                    return (
                      <div
                        key={`detail-${s.key}`}
                        className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            if (openAllAccordions) {
                              setOpenAllAccordions(false);
                              setOpenStepId(stepId);
                              return;
                            }
                            setOpenStepId(isOpen ? null : stepId);
                          }}
                          className="w-full px-4 py-3 bg-white flex items-center justify-between text-left border-b border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                              Step 0{stepId}
                            </span>
                            <span className="text-xs font-black text-slate-800">
                              {SELF_LABEL_BY_KEY[s.key]}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-600">
                              {s.items.length} Activities
                            </span>
                            <span className="text-slate-600 text-xs font-black">
                              {isOpen ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div
                            className={`grid gap-2 p-3 ${
                              s.items.length === 3
                                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-5"
                            }`}
                          >
                            {s.items.length === 0 ? (
                              <div className="col-span-full h-20 flex items-center justify-center italic text-xs text-slate-300 font-bold border border-dashed border-slate-200 rounded-xl">
                                No Data Recorded
                              </div>
                            ) : (
                              s.items.map((it: any, i: number) => {
                                const pid = `s${stepId}-${i}`;
                                const feedback = getSelfItemFeedback(
                                  stepId,
                                  it,
                                );
                                return (
                                  <div
                                    key={pid}
                                    className="group h-full bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm hover:border-orange-200 transition-all flex flex-col"
                                  >
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs font-black text-slate-300 uppercase">
                                        Index {i + 1}
                                      </span>
                                      <div
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black ${it.isCorrect ? "bg-emerald-50 text-emerald-500" : "bg-orange-50 text-orange-700"}`}
                                      >
                                        {it.isCorrect ? "CORRECT" : "REVIEW"}
                                      </div>
                                    </div>

                                    {stepId === 6 && it.userImage && (
                                      <div className="aspect-video bg-slate-50 rounded-md mb-2 overflow-hidden border border-slate-100 flex items-center justify-center">
                                        <img
                                          src={it.userImage}
                                          className="max-h-full max-w-full object-contain p-2"
                                          alt="training-result"
                                        />
                                      </div>
                                    )}

                                    <p className="text-xs font-bold text-slate-600 leading-snug mb-2">
                                      "
                                      {it.text ||
                                        it.targetText ||
                                        it.targetWord ||
                                        "..."}
                                      "
                                    </p>

                                    <div className="mt-1 pt-2 border-t border-slate-100 space-y-1 mb-2">
                                      <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                                        <span className="text-orange-600">
                                          좋았던 점:
                                        </span>{" "}
                                        {feedback.good}
                                      </p>
                                      <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                                        <span className="text-slate-700">
                                          개선점:
                                        </span>{" "}
                                        {feedback.improve}
                                      </p>
                                    </div>

                                    {shouldShowPlayButton(stepId, it) && (
                                      <button
                                        onClick={() => {
                                          if (it.audioUrl) {
                                            playAudio(it.audioUrl, pid);
                                          } else {
                                            playSpeechFallback(
                                              getPlayableText(it),
                                              pid,
                                            );
                                          }
                                        }}
                                        className={`mt-auto w-full py-1.5 rounded-md text-xs font-black flex items-center justify-center gap-2 transition-all ${
                                          playingId === pid
                                            ? "bg-orange-600 text-white shadow-sm"
                                            : "bg-slate-50 text-slate-600 group-hover:bg-orange-50 group-hover:text-slate-900"
                                        }`}
                                      >
                                        {playingId === pid ? (
                                          <>
                                            <span>■</span> STOP SOUND
                                          </>
                                        ) : (
                                          <>
                                            <span>▶</span> PLAY SOUND
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {selfFacialReport && (
                <section className="no-print bg-white rounded-[32px] p-5 md:p-6 border border-slate-100 shadow-sm">
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-5 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-50 border border-slate-100 flex items-center justify-center">
                      <ScanFace className="w-4 h-4 text-orange-500" />
                    </span>
                    AI 정밀 분석
                  </h3>
                  <div className="grid grid-cols-12 gap-4 md:gap-5">
                    <div className="col-span-12 md:col-span-6 rounded-2xl border border-slate-100 bg-white p-4 md:p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm md:text-base font-black text-slate-800">
                          안면 기반 자-모음 정확도
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">
                            <MessageSquare className="w-3.5 h-3.5" />
                            자음
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                            <BookOpen className="w-3.5 h-3.5" />
                            모음
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-12 gap-3 md:gap-4">
                        <div className="col-span-12 sm:col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:p-4">
                          <p className="text-xs text-slate-500 font-bold">
                            전체 자음
                          </p>
                          <p className="mt-1 text-2xl md:text-3xl font-black text-amber-600 leading-none">
                            {Math.round(selfFacialReport.consonant)}%
                          </p>
                        </div>
                        <div className="col-span-12 sm:col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:p-4">
                          <p className="text-xs text-slate-500 font-bold">
                            전체 모음
                          </p>
                          <p className="mt-1 text-2xl md:text-3xl font-black text-indigo-600 leading-none">
                            {Math.round(selfFacialReport.vowel)}%
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-6 rounded-2xl border border-slate-100 bg-white p-4 md:p-5 min-h-[250px]">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm md:text-base font-black text-slate-800">
                          안면 비대칭 위험도
                        </p>
                        <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          <ScanFace className="w-4 h-4 text-slate-700" />
                        </span>
                      </div>
                      <div className="mt-4">
                        <p
                          className={`text-2xl md:text-3xl font-black leading-none ${
                            selfFacialReport.asymmetryRisk >= 70
                              ? "text-red-600"
                              : selfFacialReport.asymmetryRisk >= 40
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {selfFacialReport.riskLabel}
                        </p>
                        <p className="mt-1 text-base font-black text-slate-900">
                          {Math.round(selfFacialReport.asymmetryRisk)} / 100
                        </p>
                      </div>
                      <div className="mt-4 grid grid-cols-12 gap-2.5">
                        <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                          <p className="text-[11px] font-bold text-slate-500">
                            비대칭
                          </p>
                          <p className="text-sm font-black text-slate-900">
                            {Math.round(selfFacialReport.asymmetryRisk)}
                          </p>
                        </div>
                        <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                          <p className="text-[11px] font-bold text-slate-500">
                            불균형
                          </p>
                          <p className="text-sm font-black text-slate-900">
                            {selfFacialReport.riskDelta === null
                              ? "-"
                              : selfFacialReport.riskDelta.toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs sm:text-sm font-bold text-slate-600 leading-relaxed whitespace-pre-line break-words">
                        {selfFacialReport.summary}
                      </p>
                    </div>
                  </div>
                </section>
              )}
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
