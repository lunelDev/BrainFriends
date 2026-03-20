import { Activity, FileText } from "lucide-react";
import { DetailCompareMetric, StepResultCard } from "@/lib/results/rehab/adapters";

type RehabImpression = {
  summary: string;
  strength: string;
  need: string;
};

type Props = {
  safeStep: number;
  detailComparisons: DetailCompareMetric[];
  improvedCount: number;
  impression: RehabImpression | null;
  stepResultCards: StepResultCard[];
  playingIndex?: string | null;
  enableAudioPlayback?: boolean;
  onToggleAudioPlayback?: (item: StepResultCard) => void;
};

function getStep2DetailChips(metrics: DetailCompareMetric[]) {
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const pick = (key: string, label?: string) => {
    const metric = byKey.get(key);
    if (!metric) return null;
    return { ...metric, label: label || metric.label };
  };
  return [
    pick("consonant", "자음 점수"),
    pick("vowel", "모음 점수"),
    pick("reaction", "발화 시작 속도"),
  ].filter(Boolean) as DetailCompareMetric[];
}

export function RehabDetailBlocks({
  safeStep,
  detailComparisons,
  improvedCount,
  impression,
  stepResultCards,
  playingIndex,
  enableAudioPlayback = false,
  onToggleAudioPlayback,
}: Props) {
  const formatMetric = (value: number | null, unit: string) => {
    if (value === null) return "측정 없음";
    if (unit === "ms") return `${Math.round(value)}ms`;
    return `${value.toFixed(1)}${unit}`;
  };

  const displayMetrics =
    safeStep === 2
      ? getStep2DetailChips(detailComparisons)
      : detailComparisons;
  const useThreeGrid = safeStep === 1 || safeStep === 2 || safeStep === 3 || safeStep === 6;
  const useStep4Grid = safeStep === 4 || safeStep === 5;

  return (
    <>
      <section className="no-print rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
              <Activity className="w-4 h-4 text-sky-600" />
            </span>
            {safeStep === 6 ? "이번 쓰기 결과 요약" : "이번 훈련 세부 항목 비교"}
          </h3>
          <span className="text-xs font-bold text-slate-500">개선 항목 {improvedCount}개</span>
        </div>
        {displayMetrics.length === 0 ? (
          <p className="text-sm text-slate-500 font-semibold py-2">세부 비교 데이터가 없습니다.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-2.5 py-2.5">
            <div
              className={
                useThreeGrid
                  ? "grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs leading-relaxed"
                  : useStep4Grid
                    ? "grid grid-cols-1 md:grid-cols-2 gap-2 text-xs leading-relaxed"
                  : "flex flex-wrap items-center gap-2 text-xs leading-relaxed"
              }
            >
              {displayMetrics.map((metric) => {
                const hasPrevious = metric.previous !== null;
                const diff =
                  hasPrevious && metric.current !== null
                    ? Number((metric.current - (metric.previous as number)).toFixed(1))
                    : null;
                const improved =
                  diff === null ? false : metric.higherBetter ? diff > 0 : diff < 0;
                const isPrimaryStep1Metric = safeStep === 1 && metric.key === "comprehensionAccuracy";
                const isPrimaryStep3Metric = safeStep === 3 && metric.key === "productionAccuracy";
                const isConsonant = metric.key.includes("consonant");
                const isVowel = metric.key.includes("vowel");
                const isSpeed =
                  metric.key.includes("reaction") || metric.key.includes("selectionSpeed");
                const isInstant = metric.key.includes("instantResponseRatio");
                const isStep4Metric =
                  metric.key === "contentDelivery" ||
                  metric.key === "speechFluency" ||
                  metric.key === "pronunciationClarity" ||
                  metric.key === "speechReaction";
                const isStep5Metric =
                  metric.key === "readingAccuracy" ||
                  metric.key === "readingFluency" ||
                  metric.key === "articulationClarity" ||
                  metric.key === "recognitionSpeed";
                const dotTone =
                  isPrimaryStep1Metric || isPrimaryStep3Metric || isConsonant || isVowel || isSpeed || isInstant || isStep4Metric || isStep5Metric
                    ? "bg-sky-400"
                    : "bg-slate-400";
                const chipTone =
                  isPrimaryStep1Metric || isPrimaryStep3Metric || isConsonant || isVowel || isSpeed || isInstant || isStep4Metric || isStep5Metric
                    ? "bg-white border-sky-200 text-slate-600"
                    : "bg-white border-slate-200 text-slate-600";
                const deltaTone =
                  diff === null ? "text-slate-500" : improved ? "text-sky-600" : "text-sky-600";
                if (useStep4Grid) {
                  return (
                    <div
                      key={metric.key}
                      className={`w-full rounded-2xl border shadow-sm px-3 py-2.5 ${chipTone}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <i className={`w-1.5 h-1.5 rounded-full ${dotTone} shrink-0`} />
                        <span className="font-semibold text-slate-700 break-keep">{metric.label}</span>
                      </div>
                      <div className="mt-1.5 flex items-end justify-between gap-2">
                        <b className="text-slate-900 text-sm shrink-0">
                          {formatMetric(metric.current, metric.unit)}
                        </b>
                        <b className={`${deltaTone} text-xs shrink-0`}>
                          {diff === null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${metric.unit}`}
                        </b>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500 break-keep">
                        {hasPrevious
                          ? `이전 ${formatMetric(metric.previous ?? null, metric.unit)}`
                          : "이전 없음"}
                      </p>
                    </div>
                  );
                }
                if (useThreeGrid) {
                  return (
                    <div
                      key={metric.key}
                      className={`w-full rounded-2xl border shadow-sm px-3 py-2 ${chipTone}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <i className={`w-1.5 h-1.5 rounded-full ${dotTone} shrink-0`} />
                        <span className="font-semibold text-slate-700 truncate">{metric.label}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs min-w-0">
                        <b className="text-slate-900 shrink-0">
                          {formatMetric(metric.current, metric.unit)}
                        </b>
                        <span className="text-slate-400 shrink-0">/</span>
                        <span className="font-semibold text-slate-500 truncate">
                          {hasPrevious
                            ? `이전 ${formatMetric(metric.previous ?? null, metric.unit)}`
                            : "이전 없음"}
                        </span>
                        <b className={`${deltaTone} ml-auto shrink-0`}>
                          {diff === null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${metric.unit}`}
                        </b>
                      </div>
                    </div>
                  );
                }
                return (
                  <span
                    key={metric.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-sm ${chipTone}`}
                  >
                    <i className={`w-1.5 h-1.5 rounded-full ${dotTone}`} />
                    <span className="font-semibold">{metric.label}</span>
                    <b className="text-slate-900">
                      {formatMetric(metric.current, metric.unit)}
                    </b>
                    <span className="text-slate-400">/</span>
                    <span className="font-semibold text-slate-500">
                      {hasPrevious
                        ? `이전 ${formatMetric(metric.previous ?? null, metric.unit)}`
                        : "이전 없음"}
                    </span>
                    <b className={deltaTone}>
                      {diff === null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${metric.unit}`}
                    </b>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {impression && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
              <FileText className="w-4 h-4 text-sky-600" />
            </span>
            전문가 임상 소견
          </h3>
          <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-3 sm:p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">{impression.summary}</p>
            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
              <span className="text-sky-700">강점:</span> {impression.strength}
            </p>
            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
              <span className="text-slate-700">보완:</span> {impression.need}
            </p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
              <FileText className="w-4 h-4 text-sky-600" />
            </span>
            수행 기록 상세
          </h3>
          <span className="text-xs font-bold text-slate-500">
            Step {safeStep} · {stepResultCards.length} Activities
          </span>
        </div>
        {stepResultCards.length === 0 ? (
          <p className="text-sm text-slate-500 font-semibold py-2">기록된 문항 데이터가 없습니다.</p>
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
                key={`rehab-card-${item.index}`}
                className="group h-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-slate-300 uppercase">Index {item.index}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                      item.isCorrect ? "bg-emerald-50 text-emerald-500" : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {item.isCorrect ? "CORRECT" : "REVIEW"}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-snug">"{item.text}"</p>
                {item.score !== null && (
                  <p className="mt-1 text-[11px] font-black text-sky-700">점수 {item.score.toFixed(1)}점</p>
                )}
                {safeStep === 6 && item.userImage && (
                  <div className="aspect-video bg-slate-50 rounded-md mt-2 overflow-hidden border border-slate-100 flex items-center justify-center">
                    <img
                      src={item.userImage}
                      className="max-h-full max-w-full object-contain p-2"
                      alt="rehab-writing-result"
                      onError={(event) => {
                        const target = event.currentTarget;
                        const fallback = document.createElement("span");
                        fallback.className = "text-xs font-bold text-slate-400";
                        fallback.textContent = "이미지를 불러오지 못했습니다.";
                        target.replaceWith(fallback);
                      }}
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
                {[2, 4, 5].includes(safeStep) && enableAudioPlayback && onToggleAudioPlayback && (
                  <button
                    type="button"
                    onClick={() => onToggleAudioPlayback(item)}
                    className={`mt-auto w-full py-1.5 rounded-md text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      playingIndex === `step${safeStep}-${item.index}`
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-600 group-hover:bg-sky-50 group-hover:text-slate-900"
                    }`}
                  >
                    {playingIndex === `step${safeStep}-${item.index}` ? (
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
    </>
  );
}
