"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Sparkles, Trophy } from "lucide-react";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import {
  SessionManager,
  type MeasurementQualityLevel,
  type TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";
import { setFirstDiagnosisFlow } from "@/lib/firstDiagnosisFlow";

const MODE_CARDS = [
  {
    key: "diagnosis",
    title: "자가 진단",
    modeLabel: "Assessment",
    desc: "현재 상태를 빠르게 확인하고 다음 훈련 방향을 정합니다.",
    actionLabel: "자가 진단 시작",
    imagePath: "/images/mode/self-assessment.png",
    accentColor: "from-orange-500/80 to-orange-700/70",
    onSelect: "/select-page/self-assessment",
  },
  {
    key: "rehab",
    title: "언어 재활",
    modeLabel: "Rehab",
    desc: "부족한 영역을 집중적으로 반복 훈련하며 정확도를 높입니다.",
    actionLabel: "재활 훈련 시작",
    imagePath: "/images/mode/speech-rehab.png",
    accentColor: "from-sky-500/80 to-indigo-700/70",
    onSelect: "/select-page/speech-rehab",
  },
  {
    key: "brain-sing",
    title: "브레인 노래방",
    modeLabel: "Sing",
    desc: "노래를 따라 부르며 리듬감과 발화 반응을 함께 연습합니다.",
    actionLabel: "노래 훈련 시작",
    imagePath: "/images/mode/sing-training.png",
    accentColor: "from-emerald-500/80 to-emerald-800/70",
    onSelect: "/select-page/sing-training",
  },
  {
    key: "game-mode",
    title: "게임 모드",
    modeLabel: "Games",
    desc: "게임처럼 즐기면서 집중력과 반응 훈련을 이어갑니다.",
    actionLabel: "게임 모드 열기",
    imagePath: "/images/mode/game-training.png",
    accentColor: "from-violet-500/80 to-indigo-800/70",
    onSelect: "/select-page/game-mode",
  },
] as const;

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

function getQualityUi(level?: MeasurementQualityLevel) {
  if (level === "measured") {
    return {
      label: "measured",
      description: "신뢰도 높음",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (level === "partial") {
    return {
      label: "partial",
      description: "일부 보완 필요",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "demo",
    description: "측정 데이터 부족",
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
  };
}

function getNextGoal(latestAq: number | null | undefined) {
  const aq = Number(latestAq);
  if (!Number.isFinite(aq)) return "첫 결과를 만들어 보세요";
  if (aq < 70) return "AQ 70점 이상 달성";
  if (aq < 85) return `AQ ${Math.max(85, Math.ceil(aq + 3))}점 목표`;
  return "측정 품질을 유지하며 꾸준히 훈련";
}

function countTodayTrainings(entries: TrainingHistoryEntry[]) {
  const today = new Date().toISOString().slice(0, 10);
  return entries.filter(
    (entry) => new Date(entry.completedAt).toISOString().slice(0, 10) === today,
  ).length;
}

function countByMode(
  entries: TrainingHistoryEntry[],
  mode: "self" | "rehab" | "sing",
) {
  return entries.filter((entry) => (entry.trainingMode ?? "self") === mode).length;
}

export default function ModeSelectPage() {
  const router = useRouter();
  const { patient, ageGroup, isLoading } = useTrainingSession();
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showFirstDiagnosisModal, setShowFirstDiagnosisModal] = useState(false);
  const [pendingModeTitle, setPendingModeTitle] = useState("자가 진단");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !patient) {
      router.replace("/");
    }
  }, [isLoading, patient, router]);

  // 환자 홈은 "DB 가 원천(source of truth), 로컬캐시는 오프라인 보조" 구조로 간다.
  //   1) 마운트 시 로컬캐시가 있으면 일단 그걸로 즉시 렌더 (deep offline 대응)
  //   2) 이어서 `/api/training-history/mine` 을 호출해서 본인 DB 이력으로 덮어씀
  //   → 다른 기기/브라우저에서 로그인해도 훈련 이력이 따라온다.
  const [historyEntries, setHistoryEntries] = useState<TrainingHistoryEntry[]>([]);

  useEffect(() => {
    if (!patient) {
      setHistoryEntries([]);
      return;
    }

    // 로컬캐시 선행 로드 (ENABLE_LOCAL_HISTORY_CACHE 가 꺼져있으면 빈 배열)
    const localRows = SessionManager.getHistoryFor(patient).sort(
      (a, b) => b.completedAt - a.completedAt,
    );
    if (localRows.length > 0) {
      setHistoryEntries(localRows);
    }

    let cancelled = false;
    // 기존에 있던 /api/history/me 를 재사용 (mypage 가 같은 엔드포인트를 씀)
    fetch("/api/history/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        const serverEntries = Array.isArray(body?.entries)
          ? (body.entries as TrainingHistoryEntry[])
          : null;
        if (serverEntries) {
          setHistoryEntries(
            [...serverEntries].sort((a, b) => b.completedAt - a.completedAt),
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [patient]);

  const dashboard = useMemo(() => {
    const latest = historyEntries[0] ?? null;
    // AQ 추이: historyEntries 가 최신순 정렬이라 마지막이 가장 오래된 기록.
    // 서버 이력을 기준으로 바로 계산해야 SessionManager 로컬캐시가 꺼져있어도 동작한다.
    const chronological = [...historyEntries].sort(
      (a, b) => a.completedAt - b.completedAt,
    );
    const trendLatest = chronological[chronological.length - 1] ?? null;
    const trendPrevious =
      chronological.length > 1 ? chronological[chronological.length - 2] : null;
    const aqDelta =
      trendLatest && trendPrevious
        ? Number((trendLatest.aq - trendPrevious.aq).toFixed(1))
        : null;
    const quality = getQualityUi(latest?.measurementQuality?.overall);
    return {
      todayTrainings: countTodayTrainings(historyEntries),
      latest,
      recentAq: trendLatest?.aq ?? latest?.aq ?? null,
      aqDelta,
      streakDays: buildStreak(historyEntries),
      nextGoal: getNextGoal(trendLatest?.aq ?? latest?.aq ?? null),
      quality,
      selfCount: countByMode(historyEntries, "self"),
      rehabCount: countByMode(historyEntries, "rehab"),
      singCount: countByMode(historyEntries, "sing"),
    };
  }, [historyEntries]);

  const isFirstTraining = historyEntries.length === 0;

  const moveToSelectedMode = (path: string, title: string) => {
    if (isFirstTraining) {
      setPendingModeTitle(title);
      setShowFirstDiagnosisModal(true);
      return;
    }

    router.push(path);
  };

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/");
        return;
      }
      router.replace("/");
    }
  };

  if (isLoading && !isMounted) {
    return (
      <main className="flex min-h-full items-center justify-center bg-[#f5f7fb] px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-indigo-500">
            사용자 홈
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            사용자 정보를 불러오는 중입니다.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-col overflow-x-hidden bg-[linear-gradient(180deg,#f6f8fc_0%,#eef5ff_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/images/logo/logo.png"
              alt="BrainFriends"
              className="h-11 w-11 rounded-2xl object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-indigo-500">
                사용자 홈
              </p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                {patient?.name ?? "사용자"}님, 오늘의 훈련을 시작해 볼까요?
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {patient?.age ?? "-"}세 · {ageGroup === "Senior" ? "시니어 모드" : "기본 모드"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {patient?.userRole === "admin" ? (
              <>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                  관리자 모드
                </span>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                  <button
                    onClick={() => router.push("/select-page/mode")}
                    className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-black text-white transition hover:bg-indigo-700"
                  >
                    사용자 화면
                  </button>
                  <button
                    onClick={() => router.push("/therapist")}
                    className="rounded-full px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-white"
                  >
                    치료사 화면
                  </button>
                </div>
              </>
            ) : patient?.userRole === "therapist" ? (
              <button
                onClick={() => router.push("/therapist")}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                치료사 콘솔
              </button>
            ) : null}
            {patient?.userRole === "admin" ? (
              <button
                onClick={() => router.push("/admin")}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                관리자 화면
              </button>
            ) : null}
            <button
              onClick={() => router.push("/mypage")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
            >
              내 재활 관리
            </button>
            <button
              onClick={logout}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
            >
              {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-4 flex flex-wrap gap-2">
          <Pill subtle>연속 훈련 {dashboard.streakDays}일</Pill>
          <Pill subtle>측정 품질 {dashboard.quality.label}</Pill>
          <Pill subtle>자가진단 {dashboard.selfCount}건</Pill>
          <Pill subtle>재활 {dashboard.rehabCount}건</Pill>
          <Pill subtle>노래 훈련 {dashboard.singCount}건</Pill>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Sparkles className="h-5 w-5 text-indigo-500" />}
            label="오늘의 훈련"
            value={`${dashboard.todayTrainings}`}
            hint="오늘 완료한 기록"
            actionLabel="훈련 시작하기"
            onClick={() => moveToSelectedMode("/select-page/self-assessment", "자가 진단")}
          />
          <MetricCard
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            label="최근 AQ"
            value={formatAq(dashboard.recentAq)}
            hint={
              dashboard.aqDelta == null
                ? "비교 기록 없음"
                : `${dashboard.aqDelta >= 0 ? "+" : ""}${dashboard.aqDelta.toFixed(1)}`
            }
          />
          <MetricCard
            icon={<ChevronRight className="h-5 w-5 text-sky-500" />}
            label="다음 목표"
            value={dashboard.nextGoal}
            hint="지금 가장 먼저 볼 목표"
            compact
          />
          <MetricCard
            icon={<Sparkles className="h-5 w-5 text-violet-500" />}
            label="최근 결과"
            value={
              dashboard.latest
                ? `${formatDate(dashboard.latest.completedAt)} · AQ ${formatAq(dashboard.latest.aq)}`
                : "최근 결과 없음"
            }
            hint={dashboard.latest ? "결과 확인하기" : "첫 훈련을 시작해 보세요"}
            compact
          />
        </section>

        <section className="mt-8 flex flex-1 flex-col gap-6">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">
                  훈련 리스트
                </p>
                <h2 className="mt-3 text-lg font-black tracking-tight text-slate-950 sm:text-xl lg:text-2xl">
                  나에게 맞는 훈련을 바로 시작하세요.
                </h2>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500 sm:text-sm sm:leading-6">
                  필요한 훈련을 빠르게 선택하고 최근 기록을 이어서 진행할 수 있습니다.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
                최근 기록 {historyEntries.length}건
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {isFirstTraining ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-800">
                  최초 이용 시에는 모든 훈련에 앞서 자가진단을 먼저 진행합니다.
                </div>
              ) : null}
              {MODE_CARDS.map((card) => {
                const modeCount =
                  card.key === "rehab"
                    ? dashboard.rehabCount
                    : card.key === "brain-sing"
                      ? dashboard.singCount
                      : card.key === "diagnosis"
                        ? dashboard.selfCount
                        : historyEntries.filter((entry) => entry.place === "game-mode").length;

                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => moveToSelectedMode(card.onSelect, card.title)}
                    className="group grid w-full gap-4 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm md:grid-cols-[180px_minmax(0,1fr)_auto]"
                  >
                    <div
                      className="min-h-[132px] rounded-[24px] bg-cover bg-center"
                      style={{ backgroundImage: `url(${card.imagePath})` }}
                    >
                      <div
                        className={`flex h-full items-start rounded-[24px] bg-gradient-to-br ${card.accentColor} p-4`}
                      >
                        <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                          {card.modeLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col justify-center">
                      <h3 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl lg:text-2xl">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-600 sm:text-sm sm:leading-6">
                        {card.desc}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill>{card.actionLabel}</Pill>
                        <Pill subtle>누적 기록 {modeCount}건</Pill>
                      </div>
                    </div>

                    <div className="flex items-center md:justify-end">
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition group-hover:bg-indigo-600">
                        시작
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>
        </section>
      </main>

      {showFirstDiagnosisModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[32px] border border-amber-100 bg-white p-6 shadow-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-500">
              First Diagnosis
            </p>
            <h2 className="mt-3 text-lg font-black tracking-tight text-slate-950 sm:text-xl lg:text-2xl">
              최초 1회는 자가진단이 필요합니다.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              {pendingModeTitle}을(를) 시작하기 전에 현재 상태를 확인하기 위한
              자가진단을 먼저 진행합니다.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowFirstDiagnosisModal(false);
                  // 최초 자가진단은 "우리집(home)" place 로 바로 step-1 진입.
                  // self-assessment select 페이지에서 set 되던 trainingMode 플래그를
                  // 건너뛰지 않도록 같이 set.
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("btt.trainingMode", "self");
                  }
                  // 최초 진단 흐름 표시 — step 페이지의 홈 버튼이 활동 선택(/select-page/mode)
                  // 으로 돌아가도록 분기되는 근거가 된다.
                  setFirstDiagnosisFlow();
                  router.push("/programs/step-1?place=home");
                }}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                자가진단 시작
              </button>
              <button
                type="button"
                onClick={() => setShowFirstDiagnosisModal(false)}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  onClick,
  actionLabel,
  badgeClass,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
  actionLabel?: string;
  badgeClass?: string;
  compact?: boolean;
}) {
  const content = (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50">
          {icon}
        </div>
        {badgeClass ? (
          <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${badgeClass}`}>
            {value}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      {!badgeClass ? (
        <p
          className={`mt-2 font-black tracking-tight text-slate-950 ${
            compact ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
          }`}
        >
          {value}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{hint}</p>
      {actionLabel ? (
        <span className="mt-4 inline-flex rounded-full bg-indigo-600 px-4 py-2 text-sm font-black text-white">
          {actionLabel}
        </span>
      ) : null}
    </div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="text-left">
      {content}
    </button>
  );
}

function Pill({
  children,
  subtle = false,
}: {
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
        subtle
          ? "border border-slate-200 bg-white text-slate-600"
          : "bg-slate-900 text-white"
      }`}
    >
      {children}
    </span>
  );
}

