"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import {
  SessionManager,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";
import { REHAB_STEP_LABELS } from "@/lib/results/rehab/constants";
import {
  buildDetailComparisons,
  buildFacialReport,
  buildStepResultCards,
  buildTrendChart,
  buildTrendRows,
  countImprovedMetrics,
} from "@/lib/results/rehab/adapters";
import { HistorySidebar } from "@/features/report/components/HistorySidebar";
import { RehabDetailBlocks } from "@/features/rehab-report/components/RehabDetailBlocks";
import { SelfAssessmentBlocks } from "@/features/result/components/SelfAssessmentBlocks";
import {
  formatSelfMetricDisplay,
  getPlayableText,
  getSelfItemFeedback,
  getStepItems,
  getStepScore,
  isSyntheticHistoryRow,
  SELF_LABEL_BY_KEY,
  shouldShowPlayButton,
  STEP_ID_BY_KEY,
  STEP_META,
  StepKey,
} from "@/features/report/utils/reportHelpers";
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
    setPlayingId(null);
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

  const selfStepDetails = useMemo(() => {
    if (!selfProfileRows.length) return [];
    return selfProfileRows
      .map((row) => ({
        id: STEP_ID_BY_KEY[row.key],
        title: row.label,
        display: formatSelfMetricDisplay(row.key, row.score),
        percent: Number(row.score || 0),
        metric: formatSelfMetricDisplay(row.key, row.score),
      }))
      .sort((a, b) => a.id - b.id);
  }, [selfProfileRows]);

  const selfSessionData = useMemo(() => {
    if (!selected || selected.trainingMode === "rehab") return null;
    return {
      step1: { items: getStepItems(selected, "step1") },
      step2: { items: getStepItems(selected, "step2") },
      step3: { items: getStepItems(selected, "step3") },
      step4: { items: getStepItems(selected, "step4") },
      step5: { items: getStepItems(selected, "step5") },
      step6: { items: getStepItems(selected, "step6") },
    };
  }, [selected]);

  const selfFacialForBlocks = useMemo(() => {
    if (!selfFacialReport) return null;
    return {
      overallConsonant: selfFacialReport.consonant,
      overallVowel: selfFacialReport.vowel,
      step2Consonant: selfFacialReport.consonant,
      step2Vowel: selfFacialReport.vowel,
      step4Consonant: selfFacialReport.consonant,
      step4Vowel: selfFacialReport.vowel,
      step5Consonant: selfFacialReport.consonant,
      step5Vowel: selfFacialReport.vowel,
      asymmetryRisk: selfFacialReport.asymmetryRisk,
      asymmetryDelta: selfFacialReport.riskDelta,
      articulationGap: Number(
        Math.abs(selfFacialReport.consonant - selfFacialReport.vowel).toFixed(1),
      ),
      riskLabel: selfFacialReport.riskLabel,
      summary: selfFacialReport.summary,
    };
  }, [selfFacialReport]);

  const selfCurrentScore = useMemo(() => Number(selected?.aq || 0), [selected]);

  const selfPreviousScore = useMemo(
    () => (selfPreviousRow ? Number(selfPreviousRow.aq || 0) : null),
    [selfPreviousRow],
  );

  const selfScoreDelta = useMemo(() => {
    if (selfPreviousScore === null) return null;
    return Number((selfCurrentScore - selfPreviousScore).toFixed(1));
  }, [selfCurrentScore, selfPreviousScore]);

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

  const rehabImpression = useMemo(() => {
    if (!rehabPrimaryStep) return null;
    const metricMap = new Map(rehabDetailComparisons.map((m) => [m.key, m]));
    if (rehabPrimaryStep.stepId === 1) {
      const accuracy = metricMap.get("comprehensionAccuracy")?.current ?? null;
      const speedMs = metricMap.get("decisionSpeed")?.current ?? null;
      const instantRatio = metricMap.get("instantResponseRatio")?.current ?? null;
      const accuracyText =
        accuracy === null ? "측정 없음" : `${Number(accuracy.toFixed(1))}점`;
      const speedSecText =
        speedMs === null ? "측정 없음" : `${Number((speedMs / 1000).toFixed(1))}초`;
      const instantText =
        instantRatio === null ? "측정 없음" : `${Number(instantRatio.toFixed(1))}점`;
      const speedComment =
        speedMs === null
          ? "응답 속도 데이터가 충분하지 않습니다."
          : speedMs >= 2500
            ? "즉각적인 의사소통에는 약간의 망설임이 관찰됩니다."
            : speedMs >= 1800
              ? "응답은 가능하나 일부 문항에서 짧은 망설임이 관찰됩니다."
              : "즉각적인 의사소통이 안정적으로 유지됩니다.";
      return {
        summary: `단순 질문(예/아니오)에 대한 이해 점수(${accuracyText})와 판단 속도(${speedSecText})를 기준으로 분석했습니다.`,
        strength: `이해 점수 ${accuracyText}, 즉각 반응 점수 ${instantText}`,
        need: speedComment,
      };
    }
    if (rehabPrimaryStep.stepId === 2) {
      const consonant = metricMap.get("consonant")?.current ?? null;
      const vowel = metricMap.get("vowel")?.current ?? null;
      const reaction = metricMap.get("reaction")?.current ?? null;
      const consonantText =
        consonant === null ? "측정 없음" : `${Number(consonant.toFixed(1))}점`;
      const vowelText =
        vowel === null ? "측정 없음" : `${Number(vowel.toFixed(1))}점`;
      const reactionText =
        reaction === null
          ? "측정 없음"
          : `${Number((reaction / 1000).toFixed(1))}초`;
      const speedComment =
        reaction === null
          ? "발화 시작 속도 데이터가 부족해 추가 관찰이 필요합니다."
          : reaction >= 2500
            ? "발화 시작 전 준비 시간이 길어 문장 시작에서 망설임이 관찰됩니다."
            : reaction >= 1800
              ? "문장 시작 속도는 보통 수준이며 일부 문항에서 지연이 관찰됩니다."
              : "문장 시작 속도가 안정적이며 즉시 산출이 가능합니다.";
      return {
        summary: `문장 복창에서 자음 점수(${consonantText})와 모음 점수(${vowelText}), 발화 시작 속도(${reactionText})를 기준으로 분석했습니다.`,
        strength: `자음/모음 산출 점수는 현재 수준을 유지하고 있습니다.`,
        need: speedComment,
      };
    }

    const trendText =
      rehabDelta === null
        ? "이전 기록이 없어 추세 비교는 제한적입니다."
        : `직전 대비 ${rehabDelta > 0 ? "+" : ""}${rehabDelta.toFixed(1)}점 변화를 보였습니다.`;
    const topMetric =
      rehabDetailComparisons.find((m) => m.current !== null) || null;
    const topMetricText =
      topMetric && topMetric.current !== null
        ? `${topMetric.label} ${topMetric.current.toFixed(1)}${topMetric.unit}`
        : "세부 지표 데이터가 충분하지 않습니다.";
    return {
      summary: `${REHAB_STEP_LABELS[rehabPrimaryStep.stepId]} 수행 결과를 이전 동일 훈련과 비교해 분석했습니다.`,
      strength: `개선 항목 ${rehabImprovedCount}개 · 대표 지표 ${topMetricText}`,
      need: trendText,
    };
  }, [rehabDelta, rehabDetailComparisons, rehabImprovedCount, rehabPrimaryStep]);

  const rehabTrendRows = useMemo(() => {
    if (!rehabPrimaryStep) return [];
    return buildTrendRows(rehabRowsByPrimaryStep, rehabPrimaryStep.key);
  }, [rehabPrimaryStep, rehabRowsByPrimaryStep]);

  const rehabFacialReport = useMemo(() => {
    if (!selected || selected.trainingMode !== "rehab") return null;
    return buildFacialReport(selected, previousRehabRow);
  }, [previousRehabRow, selected]);

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

      <main className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1076px)] gap-4 lg:gap-6 lg:justify-center py-4 md:py-6 lg:py-8">
          <HistorySidebar
          isRehabContext={isRehabContext}
          patientName={patient?.name || ""}
          modeFilter={modeFilter}
          isSelectionMode={isSelectionMode}
          showDeleteConfirm={showDeleteConfirm}
          selectedHistoryIds={selectedHistoryIds}
          filteredHistory={filteredHistory}
          allRehabSelected={allRehabSelected}
          selectionCheckedClass={selectionCheckedClass}
          selectedHistoryId={selected?.historyId ?? null}
          onManageIconClick={handleManageIconClick}
          onSetModeFilter={setModeFilter}
          onDismissDeleteConfirm={() => setShowDeleteConfirm(false)}
          onConfirmDeleteSelected={handleConfirmDeleteSelected}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleHistorySelection={toggleHistorySelection}
          onSelectHistory={setSelected}
        />

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

              <RehabDetailBlocks
                safeStep={rehabPrimaryStep.stepId}
                detailComparisons={rehabDetailComparisons}
                improvedCount={rehabImprovedCount}
                impression={rehabImpression}
                stepResultCards={rehabStepCards}
                playingIndex={playingId}
                enableAudioPlayback
                onToggleAudioPlayback={(item) => {
                  const id = `step${rehabPrimaryStep.stepId}-${item.index}`;
                  if (playingId === id) {
                    stopPlayback();
                    setPlayingId(null);
                    return;
                  }
                  if (item.audioUrl) {
                    playAudio(item.audioUrl, id);
                    return;
                  }
                  playSpeechFallback(item.text, id);
                }}
              />

              {[2, 4, 5].includes(rehabPrimaryStep.stepId) && rehabFacialReport && (
                <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                        <ScanFace className="w-4 h-4 text-sky-600" />
                      </span>
                      안면인식 기반 리포트
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500">
                      스크리닝 참고
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2.5 py-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        자음{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.consonant.toFixed(1)}%
                        </b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        모음{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.vowel.toFixed(1)}%
                        </b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        비대칭{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.asymmetryRisk.toFixed(1)}%
                        </b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        위험도{" "}
                        <b className="text-slate-900">{rehabFacialReport.riskLabel}</b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        추이{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.riskDelta === null
                            ? "N/A"
                            : `${rehabFacialReport.riskDelta > 0 ? "+" : ""}${rehabFacialReport.riskDelta.toFixed(1)}%p`}
                        </b>
                      </span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-600 px-1 leading-relaxed">
                    {rehabFacialReport.summary}
                  </p>
                </section>
              )}

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

              <SelfAssessmentBlocks
                stepDetails={selfStepDetails}
                sessionData={selfSessionData}
                clinicalImpression={selfClinicalImpression}
                openAllAccordions={openAllAccordions}
                openStepId={openStepId}
                setOpenAllAccordions={setOpenAllAccordions}
                setOpenStepId={setOpenStepId}
                getSelfItemFeedback={getSelfItemFeedback}
                shouldShowPlayButton={shouldShowPlayButton}
                getPlayableText={getPlayableText}
                playAudio={playAudio}
                playSpeechFallback={playSpeechFallback}
                playingIndex={playingId}
                facialReport={selfFacialForBlocks}
              />
            </div>
          )}
          </section>
        </div>
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
