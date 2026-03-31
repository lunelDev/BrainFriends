"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
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
  SELF_LABEL_BY_KEY,
  shouldShowPlayButton,
  STEP_ID_BY_KEY,
  STEP_META,
  StepKey,
} from "@/features/report/utils/reportHelpers";
import {
  buildEstimatedValidationMetrics,
  getEstimatedKpiSummary,
} from "@/features/report/utils/validationEstimates";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  FileText,
  HeartHandshake,
  MessageSquare,
  Music,
  ScanFace,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  cancelSpeechPlayback,
  speakKoreanText,
} from "@/lib/client/speechSynthesis";

function isMeasuredSingReportEntry(entry: TrainingHistoryEntry | null) {
  if (!entry?.singResult) return false;
  return (
    entry.singResult.finalConsonant !== "-" ||
    entry.singResult.finalVowel !== "-" ||
    entry.singResult.lyricAccuracy !== "-" ||
    entry.singResult.finalSi !== "-"
  );
}

function shouldShowServerExcludedBadge(entry: TrainingHistoryEntry | null) {
  return false;
}

function isDemoSkipEntry(entry: TrainingHistoryEntry | null) {
  if (!entry) return false;
  if (entry.trainingMode === "sing") {
    const reason = String(entry.singResult?.measurementReason || "");
    const comment = String(entry.singResult?.comment || "");
    return reason.includes("관리자 skip") || comment.includes("관리자 skip");
  }
  return entry.measurementQuality?.overall === "demo";
}

function getSingBaselineMetrics(entry: TrainingHistoryEntry | null) {
  const metadata = entry?.singResult?.versionSnapshot?.measurement_metadata;
  const metadataBaselineFacialSymmetry =
    typeof metadata?.baseline_facial_symmetry === "number"
      ? metadata.baseline_facial_symmetry
      : typeof metadata?.baseline_facial_symmetry === "string"
        ? Number(metadata.baseline_facial_symmetry)
        : null;
  const fallbackFinalSi =
    entry?.singResult?.finalSi && entry.singResult.finalSi !== "-"
      ? Number(entry.singResult.finalSi)
      : null;
  const baselineTrackingQuality =
    typeof metadata?.baseline_tracking_quality === "number"
      ? metadata.baseline_tracking_quality
      : typeof metadata?.baseline_tracking_quality === "string"
        ? Number(metadata.baseline_tracking_quality)
        : null;

  return {
    facialSymmetry: Number.isFinite(metadataBaselineFacialSymmetry)
      ? metadataBaselineFacialSymmetry
      : Number.isFinite(fallbackFinalSi)
        ? fallbackFinalSi
      : null,
    trackingQuality: Number.isFinite(baselineTrackingQuality)
      ? baselineTrackingQuality
      : null,
  };
}

function findPreviousSingBaselineEntry(
  history: TrainingHistoryEntry[],
  selected: TrainingHistoryEntry | null,
) {
  if (!selected || selected.trainingMode !== "sing") return null;
  const currentSong = String(selected.singResult?.song || "");
  const previousRows = history
    .filter((row) => row.trainingMode === "sing" && row.historyId !== selected.historyId)
    .filter((row) => row.completedAt < selected.completedAt)
    .sort((a, b) => b.completedAt - a.completedAt);

  return (
    previousRows.find((row) => String(row.singResult?.song || "") === currentSong) ??
    previousRows[0] ??
    null
  );
}

function ServerExcludedBadge() {
  return (
    <div className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700 sm:text-xs">
      서버 저장 제외됨(실측 아님)
    </div>
  );
}

function DemoResultBadge() {
  return (
    <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 sm:text-xs">
      시연용 결과
    </div>
  );
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isHydrated, setIsHydrated] = useState(false);
  const [history, setHistory] = useState<TrainingHistoryEntry[]>([]);
  const [selected, setSelected] = useState<TrainingHistoryEntry | null>(null);
  const [serverPatientName, setServerPatientName] = useState("");
  const modeFromQuery = searchParams.get("mode");
  const initialMode: "self" | "rehab" | "sing" =
    modeFromQuery === "rehab"
      ? "rehab"
      : modeFromQuery === "sing"
        ? "sing"
        : "self";
  const [modeFilter, setModeFilter] = useState<"self" | "rehab" | "sing">(initialMode);
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [rehabStepFilter, setRehabStepFilter] = useState<"all" | 1 | 2 | 3 | 4 | 5 | 6>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<number | null>(1);
  const [openAllAccordions, setOpenAllAccordions] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setModeFilter(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;

    const applyRows = (rows: TrainingHistoryEntry[], patientName?: string) => {
      if (cancelled) return;
      setHistory(rows);
      setServerPatientName(String(patientName || rows[0]?.patientName || ""));
      const preferredRows =
        initialMode === "rehab"
          ? rows.filter((r) => r.trainingMode === "rehab")
          : initialMode === "sing"
            ? rows.filter((r) => r.trainingMode === "sing")
            : rows.filter((r) => r.trainingMode === "self" || !r.trainingMode);
      setSelected(preferredRows[0] || rows[0] || null);
    };

    void fetch("/api/history/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed_to_load_server_history");
        return response.json();
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.entries)
          ? (payload.entries as TrainingHistoryEntry[])
          : [];
        applyRows(rows, payload?.patient?.name);
      })
      .catch(() => {
        applyRows([]);
      });

    return () => {
      cancelled = true;
    };
  }, [initialMode]);

  const filteredHistory = useMemo(
    () => {
      const rows = history.filter((row) =>
        modeFilter === "rehab"
          ? row.trainingMode === "rehab" &&
            (rehabStepFilter === "all" || Number(row.rehabStep) === rehabStepFilter)
          : modeFilter === "sing"
            ? row.trainingMode === "sing"
            : row.trainingMode === "self" || !row.trainingMode,
      );
      return [...rows].sort((a, b) =>
        sortOrder === "latest" ? b.completedAt - a.completedAt : a.completedAt - b.completedAt,
      );
    },
    [history, modeFilter, rehabStepFilter, sortOrder],
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
    setIsFilterOpen(false);
    setSortOrder("latest");
    setRehabStepFilter("all");
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
    void fetch("/api/history/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed_to_load_server_history");
        return response.json();
      })
      .then((payload) => {
        const rows = Array.isArray(payload?.entries)
          ? (payload.entries as TrainingHistoryEntry[])
          : [];
        setHistory(rows);
        setServerPatientName(String(payload?.patient?.name || rows[0]?.patientName || ""));
      })
      .catch(() => {
        setHistory([]);
        setServerPatientName("");
      });
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
    if (selectedHistoryIds.size === 0 || isDeletingHistory) return;
    const selectedRows = filteredHistory.filter((row) =>
      selectedHistoryIds.has(row.historyId),
    );
    const sessionIds = Array.from(
      new Set(selectedRows.map((row) => String(row.sessionId || "")).filter(Boolean)),
    );
    if (!sessionIds.length) {
      setSelectedHistoryIds(new Set());
      setShowDeleteConfirm(false);
      setIsSelectionMode(false);
      return;
    }

    setIsDeletingHistory(true);
    void fetch("/api/history/me", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionIds }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("failed_to_delete_history");
        }
        reloadHistory();
        setSelectedHistoryIds(new Set());
        setShowDeleteConfirm(false);
        setIsSelectionMode(false);
      })
      .catch((error) => {
        console.error("[report] failed to delete history", error);
      })
      .finally(() => {
        setIsDeletingHistory(false);
      });
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
    cancelSpeechPlayback();
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
      stopPlayback();
      setPlayingId(id);
      void speakKoreanText(text || "음성 데이터가 없습니다.", { rate: 0.96 }).finally(
        () => setPlayingId(null),
      );
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
    if (!selected || selected.trainingMode === "rehab" || selected.trainingMode === "sing") return [];
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
    if (!selected || selected.trainingMode === "rehab" || selected.trainingMode === "sing") return null;
    const selfRows = history
      .filter((row) => row.trainingMode === "self" || !row.trainingMode)
      .sort((a, b) => b.completedAt - a.completedAt);
    const idx = selfRows.findIndex(
      (row) => row.historyId === selected.historyId,
    );
    if (idx < 0) return null;
    return selfRows[idx + 1] || null;
  }, [history, selected]);

  const selfFacialReport = useMemo(() => {
    if (!selected || selected.trainingMode === "rehab" || selected.trainingMode === "sing") return null;
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
    if (!selected || selected.trainingMode === "rehab" || selected.trainingMode === "sing") return null;
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
      overallConsonant: selfFacialReport.overallConsonant,
      overallVowel: selfFacialReport.overallVowel,
      step2Consonant: selfFacialReport.step2Consonant,
      step2Vowel: selfFacialReport.step2Vowel,
      step4Consonant: selfFacialReport.step4Consonant,
      step4Vowel: selfFacialReport.step4Vowel,
      step5Consonant: selfFacialReport.step5Consonant,
      step5Vowel: selfFacialReport.step5Vowel,
      asymmetryRisk: selfFacialReport.asymmetryRisk,
      asymmetryDelta: selfFacialReport.asymmetryDelta,
      articulationGap: selfFacialReport.articulationGap,
      riskLabel: selfFacialReport.riskLabel,
      summary: selfFacialReport.summary,
      trackingQuality: selfFacialReport.trackingQuality,
      oralCommissureAsymmetry: selfFacialReport.oralCommissureAsymmetry,
      oralCommissureDelta: selfFacialReport.oralCommissureDelta,
      lipClosureAsymmetry: selfFacialReport.lipClosureAsymmetry,
      lipClosureDelta: selfFacialReport.lipClosureDelta,
      vowelArticulationVariance: selfFacialReport.vowelArticulationVariance,
      vowelArticulationDelta: selfFacialReport.vowelArticulationDelta,
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

  const selfAllItems = useMemo(() => {
    if (!selected || selected.trainingMode === "rehab" || selected.trainingMode === "sing") return [];
    return STEP_META.flatMap((meta) => getStepItems(selected, meta.key));
  }, [selected]);

  const isRehabContext = modeFilter === "rehab";
  const isSingContext = modeFilter === "sing";
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

  const previousSingBaselineEntry = useMemo(
    () => findPreviousSingBaselineEntry(history, selected),
    [history, selected],
  );

  const singCurrentBaselineMetrics = useMemo(
    () => getSingBaselineMetrics(selected),
    [selected],
  );

  const singPreviousBaselineMetrics = useMemo(
    () => getSingBaselineMetrics(previousSingBaselineEntry),
    [previousSingBaselineEntry],
  );

  const singBaselineComparisonDelta = useMemo(() => {
    if (
      singCurrentBaselineMetrics.facialSymmetry == null ||
      singPreviousBaselineMetrics.facialSymmetry == null
    ) {
      return null;
    }
    return Number(
      Math.abs(
        singCurrentBaselineMetrics.facialSymmetry -
          singPreviousBaselineMetrics.facialSymmetry,
      ).toFixed(1),
    );
  }, [singCurrentBaselineMetrics, singPreviousBaselineMetrics]);

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

  const estimatedKpiMetrics = useMemo(() => {
    if (!selected) return [];
    if (selected.trainingMode === "rehab" && rehabPrimaryStep) {
      return buildEstimatedValidationMetrics({
        selected,
        peerRows: rehabRowsByPrimaryStep,
        mode: "rehab",
        stepKey: rehabPrimaryStep.key,
        selectedItems: getStepItems(selected, rehabPrimaryStep.key),
      });
    }
    if (selected.trainingMode === "sing") {
      return [];
    }
    const selfRows = filteredHistory.filter(
      (row) => row.trainingMode === "self" || !row.trainingMode,
    );
    return buildEstimatedValidationMetrics({
      selected,
      peerRows: selfRows,
      mode: "self",
      stepKey: null,
      selectedItems: selfAllItems,
    });
  }, [
    filteredHistory,
    rehabPrimaryStep,
    rehabRowsByPrimaryStep,
    selected,
    selfAllItems,
  ]);

  const estimatedKpiSummary = useMemo(
    () => getEstimatedKpiSummary(estimatedKpiMetrics),
    [estimatedKpiMetrics],
  );

  const selectionCheckedClass =
    modeFilter === "rehab"
      ? "bg-sky-500 border-sky-500 text-white"
      : modeFilter === "sing"
        ? "bg-emerald-500 border-emerald-500 text-white"
        : "bg-orange-500 border-orange-500 text-white";

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">
            리포트 불러오는 중...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="h-14 sm:h-16 px-4 sm:px-6 border-b border-orange-100 flex items-center justify-between bg-white sticky top-0 z-40">
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
            router.push(
              modeFilter === "rehab"
                ? "/select-page/speech-rehab"
                : modeFilter === "sing"
                  ? "/select-page/sing-training"
                  : "/select-page/self-assessment",
            )
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
          isSingContext={isSingContext}
          patientName={serverPatientName}
          modeFilter={modeFilter}
          sortOrder={sortOrder}
          rehabStepFilter={rehabStepFilter}
          isFilterOpen={isFilterOpen}
          isSelectionMode={isSelectionMode}
          showDeleteConfirm={showDeleteConfirm}
          selectedHistoryIds={selectedHistoryIds}
          filteredHistory={filteredHistory}
          allRehabSelected={allRehabSelected}
          selectionCheckedClass={selectionCheckedClass}
          selectedHistoryId={selected?.historyId ?? null}
          onManageIconClick={handleManageIconClick}
          onSetModeFilter={setModeFilter}
          onToggleFilterOpen={() => setIsFilterOpen((prev) => !prev)}
          onSetSortOrder={(order) => {
            setSortOrder(order);
            setIsFilterOpen(false);
          }}
          onSetRehabStepFilter={(step) => {
            setRehabStepFilter(step);
            setIsFilterOpen(false);
          }}
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
                : selected?.trainingMode === "sing"
                  ? "border-emerald-100"
                : "border-orange-100"
            }`}
          >
          {selected && shouldShowServerExcludedBadge(selected) ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {isDemoSkipEntry(selected) ? <DemoResultBadge /> : null}
              <ServerExcludedBadge />
            </div>
          ) : null}
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-500">
              선택된 리포트가 없습니다.
            </div>
          ) : selected.trainingMode === "sing" ? (
            <div className="space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-24">
              <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-5 shadow-sm h-[140px] flex flex-col justify-center">
                <p className="text-xs font-black opacity-90">
                  {selected.patientName || "사용자"} 님의 브레인 노래방 리포트
                </p>
                <h2 className="text-2xl sm:text-3xl font-black mt-1">
                  뇌 활력 점수 {Number(selected.singResult?.score ?? selected.aq ?? 0).toFixed(1)}점
                </h2>
                <p className="text-xs sm:text-sm opacity-90 mt-2">
                  검사일시: {new Date(selected.completedAt).toLocaleString("ko-KR")}
                </p>
              </section>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">이번 결과</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">
                    {Number(selected.singResult?.score ?? selected.aq ?? 0).toFixed(1)}점
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">자음 정확도</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {selected.singResult?.finalConsonant && selected.singResult.finalConsonant !== "--"
                      ? `${selected.singResult.finalConsonant}점`
                      : "미측정"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">모음 정확도</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {selected.singResult?.finalVowel && selected.singResult.finalVowel !== "--"
                      ? `${selected.singResult.finalVowel}점`
                      : "미측정"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">가사 일치도</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {selected.singResult?.lyricAccuracy && selected.singResult.lyricAccuracy !== "--"
                      ? `${selected.singResult.lyricAccuracy}점`
                      : "미측정"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">반응 지연 시간</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {selected.singResult?.rtLatency && selected.singResult.rtLatency !== "-- ms"
                      ? selected.singResult.rtLatency
                      : "미측정"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">발성 안정도</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">
                    {selected.singResult?.finalJitter ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-black text-slate-500">곡명</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">
                    {selected.singResult?.song ?? "-"}
                  </p>
                </div>
              </div>

              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </span>
                  <h3 className="text-lg font-black text-slate-900">전문 AI 분석</h3>
                </div>
                <p className="mt-4 text-base font-bold text-slate-900">
                  {isDemoSkipEntry(selected)
                    ? "관리자 skip으로 생성된 시연용 결과입니다. 결과 화면 시연만 가능하며 서버 원장 반영 대상은 아닙니다."
                    : selected.singResult?.comment || "노래 리듬과 발화 흐름을 기반으로 분석한 결과입니다."}
                </p>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
                  성대 안정도와 반응 지연 시간을 중심으로 보고, 안면 변화값은 직전 세션 baseline 대비 참고 지표로만 해석합니다.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-slate-700" />
                  </span>
                  <h3 className="text-lg font-black text-slate-900">측정 신호 요약</h3>
                </div>
                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    Speech Metrics
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-700">
                    자음 {selected.singResult?.finalConsonant && selected.singResult.finalConsonant !== "--" ? `${selected.singResult.finalConsonant}점` : "미측정"} ·
                    {" "}모음 {selected.singResult?.finalVowel && selected.singResult.finalVowel !== "--" ? `${selected.singResult.finalVowel}점` : "미측정"} ·
                    {" "}가사 일치도 {selected.singResult?.lyricAccuracy && selected.singResult.lyricAccuracy !== "--" ? `${selected.singResult.lyricAccuracy}점` : "미측정"} ·
                    {" "}반응속도 {selected.singResult?.rtLatency && selected.singResult.rtLatency !== "-- ms" ? selected.singResult.rtLatency : "미측정"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {selected.singResult?.finalConsonant &&
                    selected.singResult.finalConsonant !== "--" &&
                    selected.singResult?.finalVowel &&
                    selected.singResult.finalVowel !== "--" &&
                    selected.singResult?.lyricAccuracy &&
                    selected.singResult.lyricAccuracy !== "--" &&
                    selected.singResult?.transcript?.trim()
                      ? `인식 가사: "${selected.singResult.transcript}"`
                      : "..."}
                  </p>
                </div>
                <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="text-sm font-black">노래방의 핵심 평가는 발화 점수입니다.</p>
                  <p className="mt-2 text-base font-medium text-emerald-800">
                    안면 변화값은 직전 세션 baseline 대비 참고 지표로만 해석합니다.
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Music className="w-4 h-4 text-slate-700" />
                  </span>
                  <h3 className="text-lg font-black text-slate-900">재생 및 프레임 확인</h3>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const id = `sing-audio-${selected.historyId}`;
                        if (playingId === id) {
                          stopPlayback();
                          return;
                        }
                        if (selected.singResult?.reviewAudioUrl) {
                          playAudio(selected.singResult.reviewAudioUrl, id);
                          return;
                        }
                        playSpeechFallback(
                          selected.singResult?.transcript || "녹음된 노래가 없습니다.",
                          id,
                        );
                      }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 font-black text-emerald-700"
                    >
                      <Music className="h-4 w-4" />
                      {playingId === `sing-audio-${selected.historyId}` ? "재생 중..." : "내가 부른 노래 듣기"}
                    </button>
                  </div>
                  {selected.singResult?.reviewKeyFrames?.length ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                        Face Key Frames
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        노래 중 수집한 안면 반응 대표 프레임입니다.
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {selected.singResult.reviewKeyFrames.map((frame, index) => (
                          <div
                            key={`${frame.label}-${frame.capturedAt}-${index}`}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          >
                            <img
                              src={frame.dataUrl}
                              alt={`노래방 key frame ${index + 1}`}
                              className="h-32 w-full object-cover"
                            />
                            <div className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                              {frame.label} · {new Date(frame.capturedAt).toLocaleTimeString("ko-KR")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              {singBaselineComparisonDelta != null ? (
                <section className="rounded-2xl border border-emerald-100 bg-[#fbfefc] p-5">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-emerald-700" />
                    </span>
                    <h3 className="text-lg font-black text-slate-900">직전 세션 기준 대비 안면 변화량</h3>
                  </div>
                  <div className="mt-4">
                    <div className="rounded-[24px] border border-emerald-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-slate-900">직전 세션 baseline 대비 안면 변화량</p>
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            {singBaselineComparisonDelta.toFixed(1)}점 변화
                          </p>
                        </div>
                        <p className="text-xl font-black text-emerald-600">
                          {singBaselineComparisonDelta.toFixed(1)}점
                        </p>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, Math.max(6, singBaselineComparisonDelta * 12))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[24px] bg-emerald-50 p-4 text-emerald-900">
                    <p className="text-sm font-black">
                      이번 세션 시작 baseline과 직전 세션 baseline을 비교한 보조 변화값입니다.
                    </p>
                    <p className="mt-2 text-base font-medium text-emerald-800">
                      현재는 입, 눈, 표정 협응을 각각 독립 계측하지 않고 baseline 얼굴 metric 1개만 비교합니다.
                    </p>
                  </div>
                </section>
              ) : null}
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
                        입꼬리 차이{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.oralCommissureAsymmetry.toFixed(1)}%
                        </b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        폐쇄 차이{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.lipClosureAsymmetry.toFixed(1)}%
                        </b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        발화 편차{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.vowelArticulationVariance.toFixed(1)}
                        </b>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                        <i className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        추적 품질{" "}
                        <b className="text-slate-900">
                          {rehabFacialReport.trackingQuality.toFixed(1)}%
                        </b>
                      </span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-600 px-1 leading-relaxed">
                    {rehabFacialReport.summary}
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-bold text-slate-500 px-1">
                    <span>
                      입꼬리 변화{" "}
                      {rehabFacialReport.oralCommissureDelta === null
                        ? "N/A"
                        : `${rehabFacialReport.oralCommissureDelta > 0 ? "+" : ""}${rehabFacialReport.oralCommissureDelta.toFixed(1)}%p`}
                    </span>
                    <span>
                      폐쇄 변화{" "}
                      {rehabFacialReport.lipClosureDelta === null
                        ? "N/A"
                        : `${rehabFacialReport.lipClosureDelta > 0 ? "+" : ""}${rehabFacialReport.lipClosureDelta.toFixed(1)}%p`}
                    </span>
                    <span>
                      위험도{" "}
                      {rehabFacialReport.riskDelta === null
                        ? `${rehabFacialReport.riskLabel}`
                        : `${rehabFacialReport.riskLabel} (${rehabFacialReport.riskDelta > 0 ? "+" : ""}${rehabFacialReport.riskDelta.toFixed(1)}%p)`}
                    </span>
                  </div>
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
                  {selected.patientName || "사용자"} 님의 자가진단 리포트
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
