import Link from "next/link";
import { cookies } from "next/headers";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Filter,
  LineChart,
  Microscope,
  NotebookPen,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { TherapistPatientListPanel } from "./_components/TherapistPatientListPanel";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  getTherapistPatientReportDetail,
  listTherapistColleagueSummaries,
  listTherapistPatientNotesScoped,
  listTherapistPatientReportSummaries,
  listTherapistReportValidationSample,
} from "@/lib/server/therapistReportsDb";
import type {
  TherapistFollowUpState,
  TherapistPatientNote,
} from "@/lib/server/therapistNotes";

function formatDateTime(value?: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSaveStateLabel(entry: any) {
  const state = entry?.dbSaveState;
  if (state === "saved") return "저장 완료";
  if (state === "skipped") return "저장 제외";
  if (state === "failed") return "저장 실패";
  return "확인 필요";
}

function getSaveStateClass(entry: any) {
  const state = entry?.dbSaveState;
  if (state === "saved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (state === "skipped") return "bg-amber-50 text-amber-700 border-amber-200";
  if (state === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getQualityLabel(quality?: string | null) {
  if (quality === "measured") return "측정 완료";
  if (quality === "partial") return "부분 측정";
  if (quality === "demo") return "시연 데이터";
  return "확인 필요";
}

function getModeLabel(mode?: string | null) {
  if (mode === "sing") return "노래";
  if (mode === "rehab") return "재활";
  return "자가진단";
}

function getModeAccent(mode?: string | null) {
  if (mode === "sing") return "from-emerald-500/85 to-emerald-700/75";
  if (mode === "rehab") return "from-sky-500/85 to-indigo-700/75";
  return "from-orange-500/85 to-orange-700/75";
}

// 환자 위험도 헬퍼.
// - 활동 없음(자가/재활/노래 합계 0) → critical
// - 활동 기록 자체가 없음(latestActivityAt 없음) → warning
// - 30일+ 미접속 → critical
// - 7일+ 미접속 → warning
// - 그 외 → normal
type PatientRiskLevel = "critical" | "warning" | "normal";
type PatientRisk = { level: PatientRiskLevel; label: string };

function getPatientRisk(patient: {
  selfAssessmentCount?: number;
  rehabCount?: number;
  singCount?: number;
  latestActivityAt?: string | null;
}): PatientRisk {
  const activity =
    (patient.selfAssessmentCount ?? 0) +
    (patient.rehabCount ?? 0) +
    (patient.singCount ?? 0);
  if (activity === 0) {
    return { level: "critical", label: "활동 없음" };
  }
  if (!patient.latestActivityAt) {
    return { level: "warning", label: "기록 없음" };
  }
  const ts = new Date(patient.latestActivityAt).getTime();
  if (Number.isNaN(ts)) {
    return { level: "warning", label: "기록 없음" };
  }
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days >= 30) return { level: "critical", label: `${days}일 미접속` };
  if (days >= 7) return { level: "warning", label: `${days}일 미접속` };
  return { level: "normal", label: "정상" };
}

// follow-up 상태 라벨/스타일 헬퍼.
// 환자 상세의 "치료사 메모 / follow-up" 카드와 톤을 맞춘다.
function getFollowUpLabel(state: TherapistFollowUpState | null | undefined) {
  if (state === "monitor") return "관찰";
  if (state === "follow_up") return "후속 점검";
  if (state === "priority") return "우선 검토";
  return "메모";
}

function getFollowUpClass(state: TherapistFollowUpState | null | undefined) {
  if (state === "priority") return "bg-rose-50 text-rose-700 border-rose-200";
  if (state === "follow_up") return "bg-amber-50 text-amber-700 border-amber-200";
  if (state === "monitor") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function summarizeMemo(memo: string, max = 60) {
  const trimmed = memo.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

// 환자 목록은 더 이상 별도 페이지가 아니라 본문 패널로 흡수됐다.
// Quick Links 카드는 admin 의 운영용 진입점만 남긴다 — 결과 분석/시스템 점검 두 개.
const ADMIN_QUICK_LINKS = [
  {
    title: "결과 분석 보기",
    body: "최근 저장 결과와 사용자별 추이를 빠르게 검토합니다.",
    href: "/therapist/results",
    cta: "결과 분석 열기",
    icon: LineChart,
    accent: "from-violet-500/85 to-indigo-800/75",
    eyebrow: "결과 해석",
  },
  {
    title: "시스템 점검",
    body: "운영 상태, 계정 생성, 후속 조치 화면으로 이동합니다.",
    href: "/therapist/system",
    cta: "시스템 화면 열기",
    icon: ClipboardList,
    accent: "from-slate-700/85 to-slate-900/75",
    eyebrow: "운영자 액션",
  },
];

// V&V 증적/AI 평가 내보내기는 /therapist/system 안 단일 허브에서만 노출.
// 대시보드에서 중복 노출하던 RESULT_FILTER_LINKS/OPERATION_EXPORT_LINKS 는 제거.

export default async function TherapistOverviewPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  let patients: Awaited<ReturnType<typeof listTherapistPatientReportSummaries>> = [];
  let validationSampleEntries: Awaited<ReturnType<typeof listTherapistReportValidationSample>> = [];
  let featuredPatientDetail: Awaited<ReturnType<typeof getTherapistPatientReportDetail>> | null = null;
  let therapistColleagues: Awaited<ReturnType<typeof listTherapistColleagueSummaries>> = [];
  let patientNotes: Record<string, TherapistPatientNote> = {};
  const context = token
    ? await getAuthenticatedSessionContext(token).catch(() => null)
    : null;
  const isAdminPreview = context?.userRole === "admin";

  if (token) {
    try {
      [patients, validationSampleEntries, therapistColleagues, patientNotes] =
        await Promise.all([
          listTherapistPatientReportSummaries(token),
          listTherapistReportValidationSample(token),
          listTherapistColleagueSummaries(token),
          listTherapistPatientNotesScoped(token),
        ]);
      if (patients[0]?.patientId) {
        featuredPatientDetail = await getTherapistPatientReportDetail(token, patients[0].patientId);
      }
    } catch {
      patients = [];
      validationSampleEntries = [];
      featuredPatientDetail = null;
      therapistColleagues = [];
      patientNotes = {};
    }
  }

  const measuredCount = validationSampleEntries.filter(
    (entry) => entry.measurementQuality?.overall === "measured",
  ).length;
  const savedCount = validationSampleEntries.filter(
    (entry: any) => entry.dbSaveState === "saved",
  ).length;
  const failedCount = validationSampleEntries.filter(
    (entry: any) => entry.dbSaveState === "failed",
  ).length;
  const measuredRate = validationSampleEntries.length
    ? Math.round((measuredCount / validationSampleEntries.length) * 1000) / 10
    : 0;
  const saveSuccessRate = validationSampleEntries.length
    ? Math.round((savedCount / validationSampleEntries.length) * 1000) / 10
    : 0;
  const latestUsers = patients.slice(0, 5);
  // 환자 리스트 자체는 TherapistPatientListPanel(client) 가 위험도 정렬·검색을 담당.
  // 여기서는 KPI 표시용 카운트만 derive 한다.
  const needsAttentionCount = patients.filter(
    (p) => getPatientRisk(p).level !== "normal",
  ).length;
  const latestResults = validationSampleEntries.slice(0, 5);
  const recentVnvLinked = validationSampleEntries.filter(
    (entry) => (entry.vnv?.summary?.requirementIds?.length ?? 0) > 0,
  ).length;
  // 최근 메모 — 치료사가 본인이 남긴 follow-up/메모를 한 화면에서 추적할 수 있게 한다.
  // listTherapistPatientNotesScoped 가 본인이 접근 가능한 환자만 필터링해 주므로
  // 여기서는 updatedAt 내림차순으로 상위 5건만 추린다.
  const patientNameById = new Map(
    patients.map((p) => [p.patientId, p.patientName] as const),
  );
  const patientCodeById = new Map(
    patients.map((p) => [p.patientId, p.patientCode] as const),
  );
  const recentMemos = Object.values(patientNotes)
    .filter((note) => note.memo && note.memo.trim().length > 0)
    .sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, 5);
  const featuredEntries = featuredPatientDetail?.entries.slice(0, 6) ?? [];
  const featuredLatest = featuredEntries[0];
  const featuredStepCards = featuredLatest
    ? [
        ["Step 1", featuredLatest.stepScores.step1],
        ["Step 2", featuredLatest.stepScores.step2],
        ["Step 3", featuredLatest.stepScores.step3],
        ["Step 4", featuredLatest.stepScores.step4],
        ["Step 5", featuredLatest.stepScores.step5],
        ["Step 6", featuredLatest.stepScores.step6],
      ]
    : [];
  const featuredAqTrend = featuredEntries
    .slice(0, 5)
    .reverse()
    .map((entry, index, rows) => ({
      x: rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100,
      y: 100 - Math.max(0, Math.min(100, Number(entry.aq ?? 0))),
      label: new Date(entry.completedAt).toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
      }),
      aq: Number(entry.aq ?? 0),
    }));

  // 치료사 화면용 합계 (개인 결정에 도움이 되는 지표).
  const totalSelf = patients.reduce((acc, p) => acc + (p.selfAssessmentCount ?? 0), 0);
  const totalRehab = patients.reduce((acc, p) => acc + (p.rehabCount ?? 0), 0);
  const totalSing = patients.reduce((acc, p) => acc + (p.singCount ?? 0), 0);

  const adminKpis = [
    {
      title: "등록 사용자",
      value: `${patients.length}명`,
      note: "최근 활동 기준 정렬",
      icon: Users,
      accent: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      title: "측정 완료 비율",
      value: `${measuredRate.toFixed(1)}%`,
      note: `${measuredCount}건 / ${validationSampleEntries.length}건`,
      icon: Microscope,
      accent: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "저장 성공률",
      value: `${saveSuccessRate.toFixed(1)}%`,
      note: `${savedCount}건 저장 완료`,
      icon: CheckCircle2,
      accent: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "저장 실패",
      value: `${failedCount}건`,
      note: "즉시 확인 필요",
      icon: AlertTriangle,
      accent: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  const therapistKpis = [
    {
      title: "등록 사용자",
      value: `${patients.length}명`,
      note: "최근 활동 기준 정렬",
      icon: Users,
      accent: "text-sky-600",
      bg: "bg-sky-50",
    },
    {
      title: "확인 필요",
      value: `${needsAttentionCount}명`,
      note:
        needsAttentionCount > 0
          ? "장기 미접속 또는 활동 기록 없음"
          : "현재 위험 신호 없음",
      icon: AlertTriangle,
      accent:
        needsAttentionCount > 0 ? "text-rose-600" : "text-emerald-600",
      bg: needsAttentionCount > 0 ? "bg-rose-50" : "bg-emerald-50",
    },
    {
      title: "최근 활동",
      value: latestUsers[0]?.latestActivityAt
        ? formatDateTime(latestUsers[0].latestActivityAt)
        : "기록 없음",
      note: latestUsers[0]?.patientName
        ? `${latestUsers[0].patientName} 사용자`
        : "최근 활동 사용자 없음",
      icon: Clock3,
      accent: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      title: "누적 훈련",
      value: `${totalSelf + totalRehab + totalSing}건`,
      note: `자가 ${totalSelf} · 재활 ${totalRehab} · 노래 ${totalSing}`,
      icon: Sparkles,
      accent: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  const kpis = isAdminPreview ? adminKpis : therapistKpis;
  const therapistName = context?.patient?.name ?? "치료사";
  const heroEyebrow = isAdminPreview ? "관리자 미리보기" : "치료사 콘솔";
  const heroTitle = isAdminPreview
    ? `${therapistName}님, 운영 지표와 사용자 결과를 한 화면에서 확인합니다.`
    : `${therapistName}님, 오늘 확인이 필요한 사용자를 먼저 살펴볼까요?`;
  const heroDescription = isAdminPreview
    ? "사용자 흐름은 단순하게 유지하고, 치료사 화면에서는 결과 해석과 운영 체크포인트를 함께 점검합니다."
    : "사용자 검색 → 최근 확인이 필요한 사용자 → 사용자 상세 흐름으로 결과 해석에 집중합니다.";

  return (
    <section className="space-y-6">
      {/*
        Hero — 다른 메인(select-page/mode)과 같은 톤의 그라디언트 카드.
        좌측 인사 + 우측 4개 KPI 미니 카드(반투명).
      */}
      <article className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-600 p-6 text-white shadow-sm sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white backdrop-blur">
              <Stethoscope className="h-3.5 w-3.5" />
              {heroEyebrow}
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
              {heroTitle}
            </h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/85">
              {heroDescription}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black">
              <Pill tone="dark">등록 사용자 {patients.length}명</Pill>
              <Pill tone="dark">확인 필요 {needsAttentionCount}명</Pill>
              <Pill tone="dark">자가진단 {totalSelf}건</Pill>
              <Pill tone="dark">재활 {totalRehab}건</Pill>
              <Pill tone="dark">노래 {totalSing}건</Pill>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:max-w-2xl">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-white/20 bg-white/15 px-4 py-4 backdrop-blur"
                >
                  <div className="flex items-center gap-2 text-white">
                    <Icon className="h-4 w-4" />
                    <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-medium text-white/85">
                    {item.note}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </article>

      {/*
        내 환자 목록 — 검색 + 위험도 정렬을 한 패널로 통합.
        과거에는 Quick Search 카드 + 전체 사용자 목록 페이지(/therapist/patients) + 상위 5명 패널이 분리돼 있었으나
        치료사 동선상 한 화면에 모으는 게 자연스러워 단일 패널로 흡수.
      */}
      <TherapistPatientListPanel patients={patients} patientNotes={patientNotes} />

      {/*
        최근 메모 — 치료사가 본인이 남긴 메모/follow-up 을 한 화면에서 확인.
        listTherapistPatientNotesScoped 가 admin/therapist 스코프에 맞춰 필터링한다.
        메모가 0건이면 "메모를 남기면 여기에 모입니다" 안내만 표시.
      */}
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600">
            치료사 메모
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            최근 메모 / follow-up
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            {isAdminPreview
              ? "전체 환자 메모 중 최근 5건을 모았습니다."
              : "내가 담당한 환자에게 남긴 메모 중 최근 5건을 모았습니다."}
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200">
          {recentMemos.length ? (
            <ul className="divide-y divide-slate-200">
              {recentMemos.map((note) => {
                const name =
                  patientNameById.get(note.patientId) || "사용자";
                const code = patientCodeById.get(note.patientId) || "—";
                return (
                  <li key={note.patientId}>
                    <Link
                      href={`/therapist/patients/${note.patientId}`}
                      className="group flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-amber-50/40"
                    >
                      <span
                        className="inline-flex flex-none items-center justify-center rounded-md bg-amber-100 px-2 py-1 font-mono text-[11px] font-black tracking-tight text-amber-800"
                        title={code}
                      >
                        {code}
                      </span>
                      <div className="min-w-0 flex-1 basis-56">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black text-slate-950">
                            {name}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${getFollowUpClass(note.followUpState)}`}
                          >
                            <NotebookPen className="h-3 w-3" />
                            {getFollowUpLabel(note.followUpState)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium leading-5 text-slate-700">
                          {note.memo
                            ? summarizeMemo(note.memo, 120)
                            : "메모 내용이 비어 있습니다."}
                        </p>
                      </div>
                      <div className="ml-auto inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                        {formatDateTime(note.updatedAt)}
                        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-amber-500" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
              아직 남긴 메모가 없습니다. 환자 상세 화면에서 메모를 남기면 이곳에 모입니다.
            </div>
          )}
        </div>
      </article>

      {/*
        최근 저장 결과 — 카드형 레이아웃, 모드별 컬러 칩.
        세션 중 치료사 동선엔 노이즈라서 admin-only.
      */}
      {isAdminPreview ? (
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
              결과 요약 패널
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              최근 저장 결과
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              최근 5건의 결과 요약입니다. 사용자별 상세 분석은 결과 화면에서 이어서 확인합니다.
            </p>
          </div>
          <Link
            href="/therapist/results"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
          >
            결과 화면 열기
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {latestResults.length ? (
            latestResults.map((entry) => {
              const modeLabel = getModeLabel(entry.trainingMode);
              const accent = getModeAccent(entry.trainingMode);
              return (
                <div
                  key={entry.historyId}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50"
                >
                  <div
                    className={`flex items-center justify-between gap-3 bg-gradient-to-r ${accent} px-4 py-3 text-white`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur">
                        {modeLabel}
                      </span>
                      <p className="text-sm font-black">{entry.patientName || "사용자"}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border bg-white px-2.5 py-0.5 text-[11px] font-black ${getSaveStateClass(entry)}`}
                    >
                      {getSaveStateLabel(entry)}
                    </span>
                  </div>
                  <div className="px-4 py-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                          AQ
                        </p>
                        <p className="mt-1 text-2xl font-black text-slate-950">
                          {Number(entry.aq ?? 0).toFixed(1)}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        {formatDateTime(new Date(entry.completedAt).toISOString())}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                      <Pill subtle>
                        측정 {getQualityLabel(entry.measurementQuality?.overall)}
                      </Pill>
                      <Pill subtle>
                        V&V {entry.vnv?.summary?.requirementIds?.length ?? 0}건
                      </Pill>
                      <Pill subtle>
                        시험 {entry.vnv?.summary?.testCaseIds?.length ?? 0}건
                      </Pill>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-sm font-semibold text-slate-500 lg:col-span-2">
              아직 표시할 저장 결과가 없습니다.
            </div>
          )}
        </div>
      </article>
      ) : null}

      {/*
        사용자 상세 핵심 패널 — 그라디언트 헤더 블록 + AQ 추이 + Step1~6.
        "임의 1번 환자"가 노출되어 진짜 보고 있는 환자와 헷갈릴 수 있어 admin-only.
      */}
      {isAdminPreview ? (
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-500">
                사용자 상세 핵심 패널
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                최근 사용자 상태를 메인 화면에서 바로 확인합니다.
              </h2>
            </div>
            {featuredPatientDetail?.patient.patientId ? (
              <Link
                href={`/therapist/patients/${featuredPatientDetail.patient.patientId}`}
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-700"
              >
                상세 보기
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          {featuredPatientDetail && featuredLatest ? (
            <>
              <div className="mt-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 p-6 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] backdrop-blur">
                    {featuredPatientDetail.patient.patientCode}
                  </span>
                  <p className="text-2xl font-black">
                    {featuredPatientDetail.patient.patientName}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
                      최근 AQ
                    </p>
                    <p className="mt-1 text-4xl font-black">
                      {Number(featuredLatest.aq ?? 0).toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
                      측정 품질
                    </p>
                    <p className="mt-1 text-base font-black">
                      {getQualityLabel(featuredLatest.measurementQuality?.overall)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">
                      V&V 연결
                    </p>
                    <p className="mt-1 text-base font-black">
                      요구사항 {featuredLatest.vnv?.summary?.requirementIds?.length ?? 0}건
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50/40 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      AQ 추이
                    </p>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-slate-700">
                      최근 {featuredAqTrend.length}건
                    </span>
                  </div>
                  <div className="mt-4 rounded-[20px] bg-white p-3 shadow-sm">
                    <svg viewBox="0 0 100 100" className="h-44 w-full">
                      <defs>
                        <linearGradient id="aqStroke" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#0ea5e9" />
                        </linearGradient>
                      </defs>
                      <polyline
                        fill="none"
                        stroke="url(#aqStroke)"
                        strokeWidth="3"
                        points={featuredAqTrend
                          .map((point) => `${point.x},${point.y}`)
                          .join(" ")}
                      />
                      {featuredAqTrend.map((point) => (
                        <g key={`${point.label}-${point.x}`}>
                          <circle cx={point.x} cy={point.y} r="2.6" fill="#0f172a" />
                          <text
                            x={point.x}
                            y={97}
                            textAnchor="middle"
                            className="fill-slate-500 text-[4px] font-bold"
                          >
                            {point.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-violet-50/40 p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Step1~6 결과 요약
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {featuredStepCards.map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-center shadow-sm"
                      >
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-950">
                          {Number(value ?? 0).toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center text-sm font-semibold text-slate-500">
              아직 메인 화면에 표시할 사용자 상세 데이터가 없습니다.
            </div>
          )}
        </article>

        {isAdminPreview ? (
          <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" />
              <h3 className="text-xl font-black text-slate-950">검색/필터 포인트</h3>
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-500">검색 기준</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                  사용자 이름, 사용자 코드, 로그인 ID로 바로 사용자 이력 화면에 진입합니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-500">주요 필터</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                  측정 품질, 저장 상태, 최근 AQ 범위, 재활 Step 기준으로 결과 분석 화면을 이어서 사용합니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-500">즉시 조치</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                  저장 실패 확인, 보안·검증 점검, 결과 내보내기 등 운영자 액션을 메인 화면과 결과 화면에서 바로 실행합니다.
                </p>
              </div>
            </div>
          </aside>
        ) : null}
      </section>
      ) : null}

      {/*
        치료사 리스트 + 협업 포인트는 기관/운영 단위 정보라 치료사 본인 의사결정에는 가치가 낮다.
        관리자 미리보기에서만 노출.
      */}
      {isAdminPreview ? (
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  치료사 리스트
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-950">
                  {isAdminPreview ? "등록된 치료사 계정" : "같은 기관 치료사 목록"}
                </h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700">
                {therapistColleagues.length}명
              </span>
            </div>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              {isAdminPreview
                ? "관리자 미리보기에서는 등록된 치료사 계정을 확인합니다."
                : "치료사 계정에서는 같은 기관에 소속된 치료사만 표시합니다."}
            </p>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
              <div className="grid grid-cols-[1fr_0.8fr_0.7fr_0.7fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                <span>치료사</span>
                <span>소속 / 로그인</span>
                <span>담당 사용자</span>
                <span>최근 로그인</span>
              </div>
              {therapistColleagues.length ? (
                therapistColleagues.map((therapist) => (
                  <div
                    key={therapist.therapistUserId}
                    className="grid grid-cols-[1fr_0.8fr_0.7fr_0.7fr] gap-3 border-t border-slate-200 px-4 py-4 text-sm"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-950">{therapist.therapistName}</p>
                        {context?.userId === therapist.therapistUserId ? (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700">
                            나
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {therapist.organizationId || "기관 정보 없음"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">
                        {therapist.organizationName ?? "기관 정보 없음"}
                      </p>
                      <div className="text-xs font-bold text-slate-500">
                        {therapist.loginId || "로그인 ID 없음"}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                        {therapist.approvalState === "pending"
                          ? "승인 대기"
                          : therapist.approvalState === "approved"
                            ? "승인 완료"
                            : "상태 확인"}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-700">
                      {therapist.assignedPatientCount}명
                    </div>
                    <div className="font-semibold text-slate-700">
                      {formatDateTime(therapist.lastLoginAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm font-semibold text-slate-500">
                  {isAdminPreview
                    ? "현재 표시할 치료사 계정이 없습니다."
                    : "같은 기관에서 표시할 치료사 목록이 없습니다."}
                </div>
              )}
            </div>
          </article>

          <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              <h3 className="text-xl font-black text-slate-950">치료사 협업 포인트</h3>
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-500">표시 범위</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                  치료사 콘솔에서는 같은 기관 소속 치료사 정보만 확인하고, 사용자 데이터는 담당 배정 기준으로만 조회합니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-500">확인 항목</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                  로그인 상태, 승인 상태, 담당 사용자 수를 함께 보면서 치료사 운영 현황을 확인합니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-500">다음 단계</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                  이후에는 기관 관리자 기준의 치료사 승인과 사용자 배정 관리까지 연결하는 것이 맞습니다.
                </p>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {/*
        Quick Links — 사용자 메인의 MODE_CARDS 패턴(이미지 자리에 그라디언트 + 아이콘).
        섹션별 CTA 버튼과 중복되어 치료사에겐 노이즈. admin-only로 게이팅.
      */}
      {isAdminPreview ? (
      <section className="grid gap-4 md:grid-cols-3">
        {ADMIN_QUICK_LINKS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`flex items-center justify-between bg-gradient-to-br ${card.accent} px-5 py-4 text-white`}
              >
                <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur">
                  {card.eyebrow}
                </span>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="px-5 py-5">
                <h3 className="text-lg font-black tracking-tight text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  {card.body}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition group-hover:bg-indigo-600">
                  {card.cta}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </section>
      ) : null}

      {/*
        과거의 "즉시 실행 액션" 섹션(V&V 증적/AI 평가 내보내기 등)은 /therapist/system 단일 허브로 일원화.
        대시보드에서는 ADMIN_QUICK_LINKS 의 "시스템 점검" 카드로 한 번만 노출한다.
      */}
    </section>
  );
}

function Pill({
  children,
  subtle = false,
  tone = "light",
}: {
  children: React.ReactNode;
  subtle?: boolean;
  tone?: "light" | "dark";
}) {
  // tone="dark" : hero 같은 그라디언트 배경 위 (반투명 화이트)
  // tone="light": 기본 (흰색/슬레이트 배경 위)
  if (tone === "dark") {
    return (
      <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-black text-white backdrop-blur">
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ${
        subtle
          ? "border border-slate-200 bg-white text-slate-600"
          : "bg-slate-900 text-white"
      }`}
    >
      {children}
    </span>
  );
}
