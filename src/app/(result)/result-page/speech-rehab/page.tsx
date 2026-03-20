"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MeasurementQualityLevel,
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
import { RehabDetailBlocks } from "@/features/rehab-report/components/RehabDetailBlocks";
import {
  persistTrainingHistoryToDatabase,
  syncTrainingMediaForHistory,
} from "@/lib/client/clinicalResultsApi";
import { fetchMyHistoryEntries } from "@/lib/client/historyApi";
import { Database, ScanFace, TrendingUp } from "lucide-react";
import {
  cancelSpeechPlayback,
  speakKoreanText,
} from "@/lib/client/speechSynthesis";
import { useTrainingSession } from "@/hooks/useTrainingSession";

function getMeasurementQualityUi(level?: MeasurementQualityLevel) {
  switch (level) {
    case "measured":
      return {
        label: "실측 완료",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "partial":
      return {
        label: "일부 측정",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    default:
      return {
        label: "참고용",
        className: "border-slate-200 bg-slate-50 text-slate-600",
      };
  }
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

function ResultRehabPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [historyRows, setHistoryRows] = useState<TrainingHistoryEntry[]>([]);
  const [serverHistoryRows, setServerHistoryRows] = useState<TrainingHistoryEntry[]>([]);
  const [playingIndex, setPlayingIndex] = useState<string | null>(null);
  const [dbSaveState, setDbSaveState] = useState<
    "idle" | "saving" | "saved" | "failed" | "local_only"
  >("idle");
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const persistedHistoryIdRef = useRef<string | null>(null);
  const finalizedResultRef = useRef<string | null>(null);
  const { patient } = useTrainingSession();

  const place = (searchParams.get("place") || "home").toLowerCase();
  const targetStep = Number(searchParams.get("targetStep") || "1");
  const safeStep = targetStep >= 1 && targetStep <= 6 ? targetStep : 1;
  const stepKey = `step${safeStep}` as keyof TrainingHistoryEntry["stepScores"];
  const detailKey =
    `step${safeStep}` as keyof TrainingHistoryEntry["stepDetails"];
  const currentScore = Number(searchParams.get(stepKey) || "0");

  const mergeHistoryRows = (
    serverEntries: TrainingHistoryEntry[],
    localEntries: TrainingHistoryEntry[],
  ) => {
    const byHistoryId = new Map<string, TrainingHistoryEntry>();
    [...localEntries, ...serverEntries].forEach((row) => {
      const historyId = String(row?.historyId ?? "").trim();
      if (!historyId) return;
      byHistoryId.set(historyId, row);
    });
    return Array.from(byHistoryId.values())
      .filter((row) => !String(row.historyId || "").startsWith("mock_"))
      .filter((row) => row.trainingMode === "rehab")
      .sort((a, b) => b.completedAt - a.completedAt);
  };

  useEffect(() => {
    if (!patient) return;
    const finalizeKey = `${patient.sessionId}:${place}:rehab:${safeStep}`;
    if (finalizedResultRef.current === finalizeKey) return;
    let cancelled = false;

    try {
      const sm = new SessionManager(patient as any, place);
      sm.finalizeSessionAndSaveHistory("rehab", safeStep);
      finalizedResultRef.current = finalizeKey;
      setHistoryRows(
        mergeHistoryRows([], SessionManager.getHistoryFor(patient as any)),
      );
    } catch (e) {
      console.error("[result-rehab] finalize failed:", e);
    }
    void fetchMyHistoryEntries()
      .then(({ entries }) => {
        setServerHistoryRows(entries);
        const rows = mergeHistoryRows(
          entries,
          SessionManager.getHistoryFor(patient as any),
        );
        if (!cancelled) {
          setHistoryRows(rows);
        }
      })
      .catch((e) => {
        console.error("[result-rehab] load server history failed:", e);
        setServerHistoryRows([]);
        if (!cancelled) {
          setHistoryRows(
            mergeHistoryRows([], SessionManager.getHistoryFor(patient as any)),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patient, place, safeStep]);

  const stepRows = useMemo(() => {
    return historyRows.filter((row) => {
      if (
        Number.isFinite(Number(row.rehabStep)) &&
        Number(row.rehabStep) !== safeStep
      ) {
        return false;
      }
      const details = row.stepDetails?.[detailKey];
      return Array.isArray(details) && details.length > 0;
    });
  }, [detailKey, historyRows, safeStep]);

  const previousStepRow = stepRows.length > 1 ? stepRows[1] : null;
  const latestStepRow = stepRows.length ? stepRows[0] : null;
  const qualityUi = getMeasurementQualityUi(
    latestStepRow?.measurementQuality?.overall,
  );
  const isServerExcluded = dbSaveState === "local_only";
  const isDemoResult = latestStepRow?.measurementQuality?.overall === "demo";

  useEffect(() => {
    if (!patient || !latestStepRow) return;
    if (persistedHistoryIdRef.current === latestStepRow.historyId) return;

    persistedHistoryIdRef.current = latestStepRow.historyId;
    setDbSaveState("saving");

    void syncTrainingMediaForHistory(patient, latestStepRow)
      .then(() => persistTrainingHistoryToDatabase(patient, latestStepRow))
      .then((response) => {
        setDbSaveState(response.skipped ? "local_only" : "saved");
      })
      .catch((error) => {
        console.error("[result-rehab] failed to persist clinical result", error);
        setDbSaveState("failed");
        persistedHistoryIdRef.current = null;
      });
  }, [latestStepRow, patient]);

  useEffect(() => {
    if (!latestStepRow) return;
    const existsOnServer = serverHistoryRows.some(
      (row) => row.historyId === latestStepRow.historyId,
    );
    if (existsOnServer) {
      persistedHistoryIdRef.current = latestStepRow.historyId;
      setDbSaveState("saved");
    }
  }, [latestStepRow, serverHistoryRows]);

  const previousScore = previousStepRow
    ? Number(previousStepRow.stepScores?.[stepKey] ?? 0)
    : null;
  const delta =
    previousScore === null
      ? null
      : Number((currentScore - previousScore).toFixed(1));

  const trendRows = useMemo(
    () => buildTrendRows(stepRows, stepKey),
    [stepKey, stepRows],
  );

  const trendChart = useMemo(() => buildTrendChart(trendRows), [trendRows]);

  const facialReport = useMemo(
    () => buildFacialReport(latestStepRow, previousStepRow),
    [latestStepRow, previousStepRow],
  );

  const detailComparisons = useMemo(
    () => buildDetailComparisons(safeStep, latestStepRow, previousStepRow),
    [latestStepRow, previousStepRow, safeStep],
  );

  const improvedCount = useMemo(
    () => countImprovedMetrics(detailComparisons),
    [detailComparisons],
  );

  const rehabImpression = useMemo(() => {
    const metricMap = new Map(detailComparisons.map((m) => [m.key, m]));

    if (safeStep === 1) {
      const accuracy = metricMap.get("comprehensionAccuracy")?.current ?? null;
      const speedMs = metricMap.get("decisionSpeed")?.current ?? null;
      const instantRatio =
        metricMap.get("instantResponseRatio")?.current ?? null;
      const accuracyText =
        accuracy === null ? "측정 없음" : `${Number(accuracy.toFixed(1))}점`;
      const speedSecText =
        speedMs === null
          ? "측정 없음"
          : `${Number((speedMs / 1000).toFixed(1))}초`;
      const instantText =
        instantRatio === null
          ? "측정 없음"
          : `${Number(instantRatio.toFixed(1))}점`;
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
    if (safeStep === 2) {
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
      delta === null
        ? "이전 기록이 없어 추세 비교는 제한적입니다."
        : `직전 대비 ${delta > 0 ? "+" : ""}${delta.toFixed(1)}점 변화를 보였습니다.`;
    const topMetric = detailComparisons.find((m) => m.current !== null) || null;
    const topMetricText =
      topMetric && topMetric.current !== null
        ? `${topMetric.label} ${topMetric.current.toFixed(1)}${topMetric.unit}`
        : "세부 지표 데이터가 충분하지 않습니다.";
    return {
      summary: `${REHAB_STEP_LABELS[safeStep]} 수행 결과를 이전 동일 훈련과 비교해 분석했습니다.`,
      strength: `개선 항목 ${improvedCount}개 · 대표 지표 ${topMetricText}`,
      need: trendText,
    };
  }, [delta, detailComparisons, improvedCount, safeStep]);

  const stepResultCards = useMemo(
    () => buildStepResultCards(safeStep, latestStepRow, detailKey),
    [detailKey, latestStepRow, safeStep],
  );

  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current = null;
    }
    cancelSpeechPlayback();
    setPlayingIndex(null);
  };

  const playSpeechFallback = (text: string, id: string) => {
    stopPlayback();
    setPlayingIndex(id);
    void speakKoreanText(text, { rate: 0.96 }).finally(() =>
      setPlayingIndex(null),
    );
  };

  const playAudio = (audioUrl: string, id: string) => {
    stopPlayback();
    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio;
    setPlayingIndex(id);
    audio.onended = () => setPlayingIndex(null);
    audio.onerror = () => setPlayingIndex(null);
    audio.play().catch(() => setPlayingIndex(null));
  };

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 overflow-x-hidden">
      <header className="no-print h-16 px-4 sm:px-6 border-b border-sky-100 flex items-center justify-between bg-white sticky top-0 z-40">
        <div className="max-w-[1076px] mx-auto w-full flex items-center justify-between min-w-0">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo/logo.png"
              alt="GOLDEN logo"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-sky-500">
                Report
              </p>
              <h1 className="text-lg font-black">반복훈련 결과 리포트</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-[11px] sm:text-xs font-bold text-sky-700 inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-500" />
              {dbSaveState === "saving" && "DB Sync In Progress"}
              {dbSaveState === "saved" && "DB Sync Complete"}
              {dbSaveState === "local_only" && "DB Not Configured - Local backup kept"}
              {dbSaveState === "failed" && "DB Sync Failed - Local backup kept"}
              {dbSaveState === "idle" && "DB Sync Pending"}
            </div>
            {isServerExcluded ? (
              <div className="flex flex-wrap gap-2">
                {isDemoResult ? <DemoResultBadge /> : null}
                <ServerExcludedBadge />
              </div>
            ) : null}
            <div className={`px-3 py-2 rounded-xl border text-[11px] sm:text-xs font-bold inline-flex items-center ${qualityUi.className}`}>
              측정 품질 · {qualityUi.label}
            </div>
            <button
              type="button"
              onClick={() => router.push("/select-page/speech-rehab")}
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
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1076px] mx-auto px-4 sm:px-6 lg:px-0 py-5 sm:py-8 pb-24 sm:pb-15 space-y-4 sm:space-y-5">
        <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 text-white p-5 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-black opacity-90">
            Step {safeStep} · {REHAB_STEP_LABELS[safeStep]}
          </p>
          <h2 className="text-xl sm:text-2xl font-black mt-1">
            재활 점수 {currentScore.toFixed(1)}점
          </h2>
          <p className="text-xs sm:text-sm opacity-90 mt-2">
            이전 동일 훈련 기록과 비교해 변화량을 확인하세요.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-slate-500">현재 점수</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {currentScore.toFixed(1)}점
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-slate-500">이전 점수</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {previousScore === null
                ? "기록 없음"
                : `${previousScore.toFixed(1)}점`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-slate-500">변화량</p>
            <p
              className={`text-2xl font-black mt-1 ${
                delta === null
                  ? "text-slate-700"
                  : delta >= 0
                    ? "text-sky-600"
                    : "text-sky-600"
              }`}
            >
              {delta === null
                ? "-"
                : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}점`}
            </p>
          </div>
        </section>
        <RehabDetailBlocks
          safeStep={safeStep}
          detailComparisons={detailComparisons}
          improvedCount={improvedCount}
          impression={rehabImpression}
          stepResultCards={stepResultCards}
          playingIndex={playingIndex}
          enableAudioPlayback
          onToggleAudioPlayback={(item) => {
            const id = `step${safeStep}-${item.index}`;
            if (playingIndex === id) {
              stopPlayback();
              return;
            }
            if (item.audioUrl) {
              playAudio(item.audioUrl, id);
              return;
            }
            playSpeechFallback(item.text, id);
          }}
        />

        {[2, 4, 5].includes(safeStep) && facialReport && (
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
                    {facialReport.consonant.toFixed(1)}%
                  </b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  모음{" "}
                  <b className="text-slate-900">
                    {facialReport.vowel.toFixed(1)}%
                  </b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  비대칭{" "}
                  <b className="text-slate-900">
                    {facialReport.asymmetryRisk.toFixed(1)}%
                  </b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  위험도{" "}
                  <b className="text-slate-900">{facialReport.riskLabel}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  추이{" "}
                  <b className="text-slate-900">
                    {facialReport.riskDelta === null
                      ? "N/A"
                      : `${facialReport.riskDelta > 0 ? "+" : ""}${facialReport.riskDelta.toFixed(1)}%p`}
                  </b>
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-xs text-slate-600 px-1 leading-relaxed">
              {facialReport.summary}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-sky-600" />
              </span>
              <span className="text-sky-600">
                {REHAB_STEP_LABELS[safeStep]}
              </span>{" "}
              변화 추이
            </h3>
            <span className="text-sm font-bold text-slate-500">
              최근 {trendRows.length}회
            </span>
          </div>
          {trendRows.length === 0 ? (
            <p className="text-sm text-slate-500 font-semibold py-4">
              이전 데이터가 없습니다.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3 overflow-x-auto">
              <svg
                viewBox={`0 0 ${trendChart?.width ?? 640} ${trendChart?.height ?? 200}`}
                className="min-w-[560px] w-full h-44 sm:h-48"
              >
                {[0, 25, 50, 75, 100].map((t) => {
                  const y =
                    (trendChart?.padTop ?? 16) +
                    ((100 - t) / 100) *
                      ((trendChart?.height ?? 200) -
                        (trendChart?.padTop ?? 16) -
                        (trendChart?.padBottom ?? 34));
                  return (
                    <g key={`grid-${t}`}>
                      <line
                        x1={trendChart?.padLeft ?? 24}
                        y1={y}
                        x2={
                          (trendChart?.width ?? 640) -
                          (trendChart?.padRight ?? 12)
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
                {trendChart && trendChart.points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={trendChart.polyline}
                  />
                )}
                {trendChart?.points.map((p) => (
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
                      y={(trendChart.height ?? 200) - 10}
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
      </main>
    </div>
  );
}

export default function ResultRehabPageWithSuspense() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 font-black">
          결과 데이터를 불러오는 중...
        </div>
      }
    >
      <ResultRehabPage />
    </Suspense>
  );
}

