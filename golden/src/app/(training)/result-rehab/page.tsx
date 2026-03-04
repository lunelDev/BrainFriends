"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadPatientProfile } from "@/lib/patientStorage";
import {
  SessionManager,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";

const STEP_LABELS: Record<number, string> = {
  1: "청각 이해",
  2: "따라말하기",
  3: "단어 명명",
  4: "유창성",
  5: "읽기",
  6: "쓰기",
};

type RehabTrendRow = {
  historyId: string;
  completedAt: number;
  score: number;
};

type DetailCompareMetric = {
  key: string;
  label: string;
  unit: "%" | "ms" | "dB";
  higherBetter: boolean;
  current: number | null;
  previous: number | null;
};

type StepResultCard = {
  index: number;
  text: string;
  isCorrect: boolean;
};

const toNumberOrNull = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const average = (values: Array<number | null>): number | null => {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const ratioToPercent = (value: number | null): number | null => {
  if (value === null) return null;
  return value <= 1 ? value * 100 : value;
};

function extractDetailMetrics(
  step: number,
  row: TrainingHistoryEntry | null,
): DetailCompareMetric[] {
  if (!row) return [];
  const stepDetails = row.stepDetails?.[
    `step${step}` as keyof TrainingHistoryEntry["stepDetails"]
  ] as any[] | undefined;
  const details = Array.isArray(stepDetails) ? stepDetails : [];

  if (step === 1) {
    return [
      {
        key: "accuracy",
        label: "정답률",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(row.stepScores?.step1),
        previous: null,
      },
      {
        key: "reaction",
        label: "평균 반응시간",
        unit: "ms",
        higherBetter: false,
        current: average(details.map((d) => toNumberOrNull(d?.responseTime))),
        previous: null,
      },
    ];
  }

  if (step === 2) {
    return [
      {
        key: "consonant",
        label: "자음 정확도",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(
          row.articulationScores?.step2?.averageConsonantAccuracy,
        ),
        previous: null,
      },
      {
        key: "vowel",
        label: "모음 정확도",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(
          row.articulationScores?.step2?.averageVowelAccuracy,
        ),
        previous: null,
      },
      {
        key: "symmetry",
        label: "안면 대칭",
        unit: "%",
        higherBetter: true,
        current: average(details.map((d) => toNumberOrNull(d?.symmetryScore))),
        previous: null,
      },
      {
        key: "audio",
        label: "평균 음성 레벨",
        unit: "dB",
        higherBetter: true,
        current: average(details.map((d) => toNumberOrNull(d?.audioLevel))),
        previous: null,
      },
    ];
  }

  if (step === 3) {
    return [
      {
        key: "accuracy",
        label: "정답률",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(row.stepScores?.step3),
        previous: null,
      },
      {
        key: "consonant",
        label: "자음 정확도",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(
          row.articulationScores?.step3?.averageConsonantAccuracy,
        ),
        previous: null,
      },
      {
        key: "vowel",
        label: "모음 정확도",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(
          row.articulationScores?.step3?.averageVowelAccuracy,
        ),
        previous: null,
      },
    ];
  }

  if (step === 4) {
    return [
      {
        key: "score",
        label: "유창성 점수",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(row.stepScores?.step4),
        previous: null,
      },
      {
        key: "silence",
        label: "침묵 비율",
        unit: "%",
        higherBetter: false,
        current: average(
          details.map((d) => ratioToPercent(toNumberOrNull(d?.silenceRatio))),
        ),
        previous: null,
      },
      {
        key: "duration",
        label: "평균 발화시간",
        unit: "ms",
        higherBetter: false,
        current: average(details.map((d) => toNumberOrNull(d?.speechDuration))),
        previous: null,
      },
    ];
  }

  if (step === 5) {
    return [
      {
        key: "score",
        label: "읽기 점수",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(row.stepScores?.step5),
        previous: null,
      },
      {
        key: "consonant",
        label: "자음 정확도",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(
          row.articulationScores?.step5?.averageConsonantAccuracy,
        ),
        previous: null,
      },
      {
        key: "vowel",
        label: "모음 정확도",
        unit: "%",
        higherBetter: true,
        current: toNumberOrNull(
          row.articulationScores?.step5?.averageVowelAccuracy,
        ),
        previous: null,
      },
      {
        key: "readingTime",
        label: "평균 읽기시간",
        unit: "ms",
        higherBetter: false,
        current: average(details.map((d) => toNumberOrNull(d?.totalTime))),
        previous: null,
      },
    ];
  }

  return [
    {
      key: "score",
      label: "쓰기 점수",
      unit: "%",
      higherBetter: true,
      current: toNumberOrNull(row.stepScores?.step6),
      previous: null,
    },
  ];
}

function ResultRehabPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [historyRows, setHistoryRows] = useState<TrainingHistoryEntry[]>([]);

  const place = (searchParams.get("place") || "home").toLowerCase();
  const targetStep = Number(searchParams.get("targetStep") || "1");
  const safeStep = targetStep >= 1 && targetStep <= 6 ? targetStep : 1;
  const stepKey = `step${safeStep}` as keyof TrainingHistoryEntry["stepScores"];
  const detailKey =
    `step${safeStep}` as keyof TrainingHistoryEntry["stepDetails"];
  const currentScore = Number(searchParams.get(stepKey) || "0");
  const patient = useMemo(() => loadPatientProfile(), []);

  useEffect(() => {
    if (!patient) return;
    try {
      const sm = new SessionManager(patient as any, place);
      sm.finalizeSessionAndSaveHistory("rehab");
    } catch (e) {
      console.error("[result-rehab] finalize failed:", e);
    }
    try {
      const rows = SessionManager.getHistoryFor(patient as any)
        .filter((row) => !String(row.historyId || "").startsWith("mock_"))
        .filter((row) => row.trainingMode === "rehab")
        .sort((a, b) => b.completedAt - a.completedAt);
      setHistoryRows(rows);
    } catch (e) {
      console.error("[result-rehab] load history failed:", e);
      setHistoryRows([]);
    }
  }, [patient, place]);

  const stepRows = useMemo(() => {
    return historyRows.filter((row) => {
      const details = row.stepDetails?.[detailKey];
      return Array.isArray(details) && details.length > 0;
    });
  }, [detailKey, historyRows]);

  const previousStepRow = stepRows.length > 1 ? stepRows[1] : null;
  const latestStepRow = stepRows.length ? stepRows[0] : null;
  const previousScore = previousStepRow
    ? Number(previousStepRow.stepScores?.[stepKey] ?? 0)
    : null;
  const delta =
    previousScore === null
      ? null
      : Number((currentScore - previousScore).toFixed(1));

  const trendRows = useMemo<RehabTrendRow[]>(() => {
    return [...stepRows]
      .reverse()
      .slice(-8)
      .map((row) => ({
        historyId: row.historyId,
        completedAt: row.completedAt,
        score: Number(row.stepScores?.[stepKey] ?? 0),
      }));
  }, [stepKey, stepRows]);

  const trendChart = useMemo(() => {
    if (!trendRows.length) return null;
    const width = 640;
    const height = 200;
    const padLeft = 24;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 34;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const xGap = trendRows.length > 1 ? plotW / (trendRows.length - 1) : 0;
    const toY = (score: number) => padTop + ((100 - score) / 100) * plotH;
    const points = trendRows.map((row, idx) => ({
      x: padLeft + idx * xGap,
      y: toY(Math.max(0, Math.min(100, row.score))),
      score: row.score,
      label: new Date(row.completedAt).toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
      }),
    }));
    const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
    return { width, height, padLeft, padRight, padTop, padBottom, points, polyline };
  }, [trendRows]);

  const latestSessionRow = historyRows.length ? historyRows[0] : null;
  const previousSessionRow = historyRows.length > 1 ? historyRows[1] : null;

  const facialReport = useMemo(() => {
    if (!latestSessionRow) return null;
    const snap = latestSessionRow.facialAnalysisSnapshot;
    const asymmetryRisk = Number(snap?.asymmetryRisk ?? 0);
    const consonant = Number(
      snap?.overallConsonant ??
        average([
          toNumberOrNull(
            latestSessionRow.articulationScores?.step2
              ?.averageConsonantAccuracy,
          ),
          toNumberOrNull(
            latestSessionRow.articulationScores?.step4
              ?.averageConsonantAccuracy,
          ),
          toNumberOrNull(
            latestSessionRow.articulationScores?.step5
              ?.averageConsonantAccuracy,
          ),
        ]) ??
        0,
    );
    const vowel = Number(
      snap?.overallVowel ??
        average([
          toNumberOrNull(
            latestSessionRow.articulationScores?.step2?.averageVowelAccuracy,
          ),
          toNumberOrNull(
            latestSessionRow.articulationScores?.step4?.averageVowelAccuracy,
          ),
          toNumberOrNull(
            latestSessionRow.articulationScores?.step5?.averageVowelAccuracy,
          ),
        ]) ??
        0,
    );
    const prevRisk = toNumberOrNull(
      previousSessionRow?.facialAnalysisSnapshot?.asymmetryRisk,
    );
    const riskDelta =
      prevRisk === null ? null : Number((asymmetryRisk - prevRisk).toFixed(1));
    const riskLabel =
      asymmetryRisk >= 45 ? "고위험" : asymmetryRisk >= 30 ? "주의" : "저위험";
    const hasCameraData = consonant > 0 || vowel > 0 || asymmetryRisk > 0;
    if (!hasCameraData) return null;
    return {
      asymmetryRisk,
      consonant,
      vowel,
      riskLabel,
      riskDelta,
      summary:
        snap?.articulationFaceMatchSummary ||
        "음성-안면 매칭 데이터가 충분하지 않습니다.",
    };
  }, [latestSessionRow, previousSessionRow]);

  const detailComparisons = useMemo(() => {
    const currentMetrics = extractDetailMetrics(safeStep, latestStepRow);
    const previousMetrics = extractDetailMetrics(safeStep, previousStepRow);
    const prevByKey = new Map(previousMetrics.map((m) => [m.key, m]));
    return currentMetrics
      .map((metric) => ({
        ...metric,
        previous: prevByKey.get(metric.key)?.current ?? null,
      }))
      .filter((metric) => metric.current !== null);
  }, [latestStepRow, previousStepRow, safeStep]);

  const improvedCount = useMemo(() => {
    return detailComparisons.filter((m) => {
      if (m.current === null || m.previous === null) return false;
      return m.higherBetter ? m.current > m.previous : m.current < m.previous;
    }).length;
  }, [detailComparisons]);

  const stepResultCards = useMemo<StepResultCard[]>(() => {
    if (!latestStepRow) return [];
    const raw = latestStepRow.stepDetails?.[detailKey];
    const items = Array.isArray(raw) ? raw : [];
    return items.map((it: any, idx: number) => {
      const recordedText = String(
        it?.transcript || it?.recognizedText || it?.sttText || "",
      ).trim();
      const targetText = String(
        it?.text ||
          it?.targetText ||
          it?.targetWord ||
          it?.word ||
          it?.prompt ||
          it?.answer ||
          "...",
      );
      const text =
        safeStep === 2 || safeStep === 4 || safeStep === 5
          ? recordedText || `${targetText} (인식 텍스트 없음)`
          : targetText;
      const fallbackCorrect =
        safeStep === 4
          ? Number(it?.kwabScore ?? 0) >= 5
          : safeStep === 5
            ? Number(it?.readingScore ?? 0) >= 60
            : false;
      const isCorrect =
        typeof it?.isCorrect === "boolean" ? it.isCorrect : fallbackCorrect;
      return {
        index: idx + 1,
        text,
        isCorrect,
      };
    });
  }, [detailKey, latestStepRow, safeStep]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 overflow-x-hidden">
      <header className="no-print h-16 px-4 sm:px-6 border-b border-sky-100 flex items-center justify-between bg-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between min-w-0">
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
              <h1 className="text-lg font-black">
                반복훈련 결과 리포트
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/rehab")}
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
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8 pb-10 sm:pb-8 space-y-4 sm:space-y-5">
        <section className="rounded-2xl bg-gradient-to-r from-sky-600 to-sky-500 text-white p-5 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-black opacity-90">
            Step {safeStep} · {STEP_LABELS[safeStep]}
          </p>
          <h2 className="text-xl sm:text-2xl font-black mt-1">
            이번 점수 {currentScore.toFixed(1)}%
          </h2>
          <p className="text-xs sm:text-sm opacity-90 mt-2">
            이전 동일 훈련 기록과 비교해 변화량을 확인하세요.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-slate-500">현재 점수</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {currentScore.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-slate-500">이전 점수</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {previousScore === null
                ? "기록 없음"
                : `${previousScore.toFixed(1)}%`}
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
                : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%p`}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              이번 훈련 세부 항목 비교
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              개선 항목 {improvedCount}개
            </span>
          </div>
          {detailComparisons.length === 0 ? (
            <p className="text-sm text-slate-500 font-semibold py-2">
              세부 비교 데이터가 없습니다.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs leading-relaxed">
              {detailComparisons.map((metric) => {
                const hasPrevious = metric.previous !== null;
                const diff =
                  hasPrevious && metric.current !== null
                    ? Number(
                        (metric.current - (metric.previous as number)).toFixed(
                          1,
                        ),
                      )
                    : null;
                const improved =
                  diff === null
                    ? false
                    : metric.higherBetter
                      ? diff > 0
                      : diff < 0;
                const isConsonant = metric.key.includes("consonant");
                const isVowel = metric.key.includes("vowel");
                const isSymmetry = metric.key.includes("symmetry");
                const isSpeed = metric.key.includes("reaction") || metric.key.includes("readingTime") || metric.key.includes("duration") || metric.key.includes("silence");
                const dotColor = isConsonant || isVowel || isSymmetry || isSpeed
                  ? "bg-sky-400"
                  : "bg-slate-400";
                const borderColor = isConsonant || isVowel || isSymmetry || isSpeed
                  ? "border-sky-200"
                  : "border-slate-200";
                return (
                  <span
                    key={metric.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border ${borderColor} text-slate-600 shadow-sm`}
                  >
                    <i className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span className="font-semibold">{metric.label}</span>
                    <b className="text-slate-900">
                      {metric.current?.toFixed(1)}
                      {metric.unit}
                    </b>
                    <span className="text-slate-400">/</span>
                    <span className="font-semibold text-slate-500">
                      {hasPrevious
                        ? `이전 ${metric.previous?.toFixed(1)}${metric.unit}`
                        : "이전 없음"}
                    </span>
                    <b
                      className={`${
                        diff === null
                          ? "text-slate-500"
                          : improved
                            ? "text-sky-600"
                            : "text-sky-600"
                      }`}
                    >
                      {diff === null
                        ? "-"
                        : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${metric.unit}`}
                    </b>
                  </span>
                );
              })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              수행 기록 상세
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              Step {safeStep} · {stepResultCards.length} Activities
            </span>
          </div>

          {stepResultCards.length === 0 ? (
            <p className="text-sm text-slate-500 font-semibold py-2">
              기록된 문항 데이터가 없습니다.
            </p>
          ) : (
            <div
              className={`grid gap-2 ${
                stepResultCards.length === 3
                  ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                  : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
              }`}
            >
              {stepResultCards.map((item) => (
                <div
                  key={`step-result-${item.index}`}
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
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {item.isCorrect ? "CORRECT" : "REVIEW"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-snug">
                    "{item.text}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {facialReport && (
          <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                안면인식 기반 리포트
              </h3>
              <span className="text-[11px] font-bold text-slate-500">
                스크리닝 참고
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  자음 <b className="text-slate-900">{facialReport.consonant.toFixed(1)}%</b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  모음 <b className="text-slate-900">{facialReport.vowel.toFixed(1)}%</b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  비대칭 <b className="text-slate-900">{facialReport.asymmetryRisk.toFixed(1)}%</b>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 shadow-sm">
                  <i className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  위험도 <b className="text-slate-900">{facialReport.riskLabel}</b>
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
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              Step {safeStep} 변화 추이
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
                        x2={(trendChart?.width ?? 640) - (trendChart?.padRight ?? 12)}
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
                      {p.score.toFixed(1)}
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

export default ResultRehabPage;
