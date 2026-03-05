"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadPatientProfile } from "@/lib/patientStorage";
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

function ResultRehabPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [historyRows, setHistoryRows] = useState<TrainingHistoryEntry[]>([]);
  const [playingIndex, setPlayingIndex] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

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
      sm.finalizeSessionAndSaveHistory("rehab", safeStep);
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

  const latestSessionRow = historyRows.length ? historyRows[0] : null;
  const previousSessionRow = historyRows.length > 1 ? historyRows[1] : null;

  const facialReport = useMemo(
    () => buildFacialReport(latestSessionRow, previousSessionRow),
    [latestSessionRow, previousSessionRow],
  );

  const detailComparisons = useMemo(
    () => buildDetailComparisons(safeStep, latestStepRow, previousStepRow),
    [latestStepRow, previousStepRow, safeStep],
  );

  const improvedCount = useMemo(
    () => countImprovedMetrics(detailComparisons),
    [detailComparisons],
  );

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
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayingIndex(null);
  };

  const playSpeechFallback = (text: string, id: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    stopPlayback();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.95;
    utterance.onend = () => setPlayingIndex(null);
    utterance.onerror = () => setPlayingIndex(null);
    setPlayingIndex(id);
    window.speechSynthesis.speak(utterance);
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
            Step {safeStep} · {REHAB_STEP_LABELS[safeStep]}
          </p>
          <h2 className="text-xl sm:text-2xl font-black mt-1">
            이번 점수 {currentScore.toFixed(1)}점
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

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              {safeStep === 6 ? "이번 쓰기 결과 요약" : "이번 훈련 세부 항목 비교"}
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
                  className="group h-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col"
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
                  {safeStep === 6 && item.userImage && (
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
                  {safeStep === 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = `step2-${item.index}`;
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
                      className={`mt-auto w-full py-1.5 rounded-md text-xs font-black flex items-center justify-center gap-2 transition-all ${
                        playingIndex === `step2-${item.index}`
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-600 group-hover:bg-sky-50 group-hover:text-slate-900"
                      }`}
                    >
                      {playingIndex === `step2-${item.index}` ? (
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
