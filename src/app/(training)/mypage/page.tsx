"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronRight, LineChart, Sparkles, Target, Trophy } from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SessionManager, type TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { ReportContent } from "@/app/(training)/report/page";

function formatAq(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(1);
}

function formatDate(value?: number | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildStreak(entries: TrainingHistoryEntry[]) {
  if (!entries.length) return 0;
  const uniqueDays = Array.from(
    new Set(
      entries
        .map((entry) => new Date(entry.completedAt).toISOString().slice(0, 10))
        .sort()
        .reverse(),
    ),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of uniqueDays) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1);
      const previousExpected = cursor.toISOString().slice(0, 10);
      if (day === previousExpected) {
        streak += 1;
      }
    }
    break;
  }

  return streak;
}

function getNextGoal(latestAq: number | null | undefined) {
  const aq = Number(latestAq);
  if (!Number.isFinite(aq)) return "첫 결과를 만들어 보세요";
  if (aq < 70) return "AQ 70점 이상 달성";
  if (aq < 85) return `AQ ${Math.max(85, Math.ceil(aq + 3))}점 목표`;
  return "측정 품질을 유지하며 꾸준히 훈련";
}

function getTrainingModeLabel(entry: TrainingHistoryEntry) {
  if (entry.trainingMode === "rehab") {
    return `언어 재활${entry.rehabStep ? ` · Step ${entry.rehabStep}` : ""}`;
  }
  if (entry.trainingMode === "sing") return "브레인 노래방";
  return "자가 진단";
}

export default function MyPage() {
  const { patient, isLoading } = useTrainingSession();
  const [historyEntries, setHistoryEntries] = useState<TrainingHistoryEntry[]>([]);
  // 좌측 리스트에서 클릭한 진단을 우측 상세 카드로 보여주는 master-detail 상태.
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) {
      setHistoryEntries([]);
      return;
    }

    let cancelled = false;
    const localRows = SessionManager.getHistoryFor(patient).sort(
      (a, b) => b.completedAt - a.completedAt,
    );

    setHistoryEntries(localRows);

    void fetch("/api/history/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed_to_load_server_history");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const serverRows = Array.isArray(payload?.entries)
          ? (payload.entries as TrainingHistoryEntry[])
          : [];
        if (serverRows.length > 0) {
          setHistoryEntries(
            [...serverRows].sort((a, b) => b.completedAt - a.completedAt),
          );
        }
      })
      .catch(() => {
        // 로컬 기록을 이미 먼저 반영했으므로 조용히 유지
      });

    return () => {
      cancelled = true;
    };
  }, [patient]);

  const latest = historyEntries[0] ?? null;
  const aqTrend = useMemo(
    () => (patient ? SessionManager.getAQTrendFor(patient) : null),
    [patient],
  );
  const streakDays = useMemo(() => buildStreak(historyEntries), [historyEntries]);
  const nextGoal = useMemo(
    () => getNextGoal(aqTrend?.latest?.aq ?? latest?.aq ?? null),
    [aqTrend?.latest?.aq, latest?.aq],
  );

  // 최근 5건 기준, 선택된 항목을 유효하게 유지 (없으면 첫 번째로 폴백)
  const recentEntries = useMemo(
    () => historyEntries.slice(0, 5),
    [historyEntries],
  );
  useEffect(() => {
    if (recentEntries.length === 0) {
      if (selectedHistoryId !== null) setSelectedHistoryId(null);
      return;
    }
    const exists = recentEntries.some((e) => e.historyId === selectedHistoryId);
    if (!exists) setSelectedHistoryId(recentEntries[0].historyId);
  }, [recentEntries, selectedHistoryId]);
  const selectedEntry =
    recentEntries.find((e) => e.historyId === selectedHistoryId) ??
    recentEntries[0] ??
    null;
  const selectedIdx = selectedEntry
    ? recentEntries.findIndex((e) => e.historyId === selectedEntry.historyId)
    : -1;
  const selectedPrev =
    selectedIdx >= 0 ? recentEntries[selectedIdx + 1] ?? null : null;
  const selectedAqDelta =
    selectedEntry && selectedPrev
      ? Number((selectedEntry.aq - selectedPrev.aq).toFixed(1))
      : null;

  if (isLoading) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center overflow-y-auto bg-[#f5f7fb] px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-indigo-500">
            내 재활 관리
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            사용자 정보를 불러오는 중입니다.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f6f8fc_0%,#eef5ff_100%)] px-4 py-6 pb-12 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[24px] sm:rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl lg:text-3xl">
                {patient?.name ?? "사용자"}님의 현재 기록
              </h1>
              <p className="mt-2 text-xs font-medium leading-5 text-slate-600 sm:text-sm sm:leading-6">
                최근 결과와 훈련 흐름을 한 번에 확인하고, 다음 훈련으로 바로 이어갈 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* 상단 "결과 리포트 보기" 토글은 제거: 각 기록 카드에 있는
                  "결과 보기 →" 가 해당 항목을 지정해 리포트 뷰로 넘어가고,
                  report 뷰 안의 "기록 목록으로" 로 다시 되돌아오므로 중복임. */}
              <Link
                href="/select-page/mode"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                홈으로
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            label="최근 AQ"
            value={formatAq(aqTrend?.latest?.aq ?? latest?.aq ?? null)}
            hint={
              aqTrend?.delta == null
                ? "비교 기록 없음"
                : `${aqTrend.delta >= 0 ? "+" : ""}${aqTrend.delta.toFixed(1)}`
            }
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
            label="총 훈련 기록"
            value={`${historyEntries.length}건`}
            hint="누적 저장 기준"
          />
          <StatCard
            icon={<LineChart className="h-5 w-5 text-rose-500" />}
            label="연속 훈련"
            value={`${streakDays}일`}
            hint="꾸준히 이어가고 있어요"
          />
          <StatCard
            icon={<Target className="h-5 w-5 text-sky-500" />}
            label="다음 목표"
            value={nextGoal}
            hint="지금 필요한 다음 단계"
            compact
          />
        </section>

        {/* 전체 리포트 페이지와 동일한 master-detail (좌: HistorySidebar, 우: 선택 진단 상세)
            레이아웃을 카드 컨테이너 안에 그대로 임베드. embedded 모드는
            /report/page 의 ReportContent 내부 헤더/배경을 끄고, /mypage 의
            rounded-[32px] 카드 디자인에 맞게 표시한다. */}
        <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <Suspense
            fallback={
              <div className="p-6 text-sm font-medium text-slate-600">
                리포트를 불러오는 중입니다…
              </div>
            }
          >
            <ReportContent embedded />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50">
        {icon}
      </div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 font-black tracking-tight text-slate-950 ${
          compact ? "text-lg" : "text-3xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{hint}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[20px] border border-sky-100 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-slate-500" />
    </Link>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-sky-100 bg-white px-4 py-3">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

// 각 훈련 이력 1건을 카드 한 장으로 표현한다.
// /report 페이지의 스텝 점수·측정 품질·AQ 추이 요약을 같은 카드 디자인 언어
// (rounded-[24px], slate-200 border, slate-50 bg) 에 담아 /mypage 의 전체
// 룩앤필과 통일시킨다. "전체 리포트 열기 →" 로 /report 로 이동 가능.
function ReportSummaryCard({
  entry,
  aqDelta,
  reportHref,
}: {
  entry: TrainingHistoryEntry;
  aqDelta: number | null;
  reportHref: string;
}) {
  const quality = entry.measurementQuality?.overall ?? "demo";
  const qualityTone =
    quality === "measured"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : quality === "partial"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  const deltaTone =
    aqDelta == null
      ? "bg-slate-100 text-slate-500"
      : aqDelta > 0
        ? "bg-emerald-50 text-emerald-700"
        : aqDelta < 0
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-600";
  const deltaLabel =
    aqDelta == null
      ? "이전 비교 없음"
      : `${aqDelta > 0 ? "+" : aqDelta === 0 ? "±" : ""}${aqDelta.toFixed(1)} vs 이전`;
  const modeLabel = getTrainingModeLabel(entry);

  // 언어 재활은 진행한 rehabStep 1개만 점수가 찍히므로 그 하나만 노출.
  // 자가진단은 step 1~6 전체가 측정되므로 전부 노출.
  // 노래방(sing)은 stepScores 를 쓰지 않으므로 카드에서 숨김.
  const allStepKeys: Array<keyof TrainingHistoryEntry["stepScores"]> = [
    "step1",
    "step2",
    "step3",
    "step4",
    "step5",
    "step6",
  ];
  const stepKeys: Array<keyof TrainingHistoryEntry["stepScores"]> =
    entry.trainingMode === "rehab"
      ? entry.rehabStep
        ? [`step${entry.rehabStep}` as keyof TrainingHistoryEntry["stepScores"]]
        : []
      : entry.trainingMode === "sing"
        ? []
        : allStepKeys;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-black text-slate-900">{modeLabel}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${qualityTone}`}
            >
              {quality}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {formatDate(entry.completedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-3xl font-black tracking-tight text-slate-950">
            AQ {formatAq(entry.aq)}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${deltaTone}`}
          >
            {deltaLabel}
          </span>
        </div>
      </div>

      {stepKeys.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            Step 점수
          </p>
          <div
            className={`grid gap-2 ${
              stepKeys.length === 1
                ? "grid-cols-1"
                : "grid-cols-3 sm:grid-cols-6"
            }`}
          >
            {stepKeys.map((key) => {
              const stepNumber = Number(String(key).replace("step", "")) || 0;
              const score = Number(entry.stepScores?.[key] ?? 0);
              const safe = Number.isFinite(score)
                ? Math.max(0, Math.min(100, score))
                : 0;
              const tone =
                safe >= 80
                  ? "bg-emerald-500"
                  : safe >= 60
                    ? "bg-sky-500"
                    : safe >= 40
                      ? "bg-amber-500"
                      : "bg-rose-400";
              return (
                <div
                  key={key}
                  className="rounded-[16px] border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Step {stepNumber}
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {safe.toFixed(0)}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${tone}`}
                      style={{ width: `${safe}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {entry.facialAnalysisSnapshot ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            얼굴 분석 · 조음 요약
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <FacialMetric
              label="비대칭 위험"
              value={formatFacialPercent(entry.facialAnalysisSnapshot.asymmetryRisk)}
              tone="rose"
            />
            <FacialMetric
              label="조음 격차"
              value={formatFacialPercent(entry.facialAnalysisSnapshot.articulationGap)}
              tone="amber"
            />
            <FacialMetric
              label="자음 정확도"
              value={formatFacialScore(entry.facialAnalysisSnapshot.overallConsonant)}
              tone="sky"
            />
            <FacialMetric
              label="모음 정확도"
              value={formatFacialScore(entry.facialAnalysisSnapshot.overallVowel)}
              tone="emerald"
            />
          </div>
          {entry.facialAnalysisSnapshot.articulationFaceMatchSummary ? (
            <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
              {entry.facialAnalysisSnapshot.articulationFaceMatchSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end">
        <Link
          href={reportHref}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
        >
          전체 리포트 열기
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function formatFacialPercent(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  // 0~1 범위면 퍼센트로, 0~100 범위면 그대로
  const pct = n <= 1 ? n * 100 : n;
  return `${pct.toFixed(1)}%`;
}

function formatFacialScore(value: number | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const scaled = n <= 1 ? n * 100 : n;
  return scaled.toFixed(0);
}

function FacialMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "rose" | "amber" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "sky"
          ? "text-sky-700"
          : "text-emerald-700";
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
