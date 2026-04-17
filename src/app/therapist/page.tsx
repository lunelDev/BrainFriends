import Link from "next/link";
import { cookies } from "next/headers";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  Microscope,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { AUTH_COOKIE_NAME } from "@/lib/server/accountAuth";
import {
  getAdminPatientReportDetail,
  listAdminPatientReportSummaries,
  listAdminReportValidationSample,
} from "@/lib/server/adminReportsDb";

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

const QUICK_LINKS = [
  {
    title: "사용자 기록 보기",
    body: "사용자별 세션 이력과 최근 활동을 바로 확인합니다.",
    href: "/therapist/patients",
    cta: "사용자 목록 열기",
  },
  {
    title: "결과 분석 보기",
    body: "최근 저장 결과, 측정 품질, V&V 연결 상태를 검토합니다.",
    href: "/therapist/results",
    cta: "결과 분석 열기",
  },
  {
    title: "시스템 점검",
    body: "운영 상태, 계정 생성, 후속 조치 화면으로 이동합니다.",
    href: "/therapist/system",
    cta: "시스템 화면 열기",
  },
];

const RESULT_FILTER_LINKS = [
  { label: "저장 실패 보기", href: "/therapist/results" },
  { label: "measured 결과 보기", href: "/therapist/results" },
  { label: "보안·검증 현황", href: "/therapist/system" },
];

const OPERATION_EXPORT_LINKS = [
  { label: "V&V 증적 내보내기", href: "/api/therapist/system/vnv-export" },
  { label: "AI 평가 내보내기", href: "/api/therapist/system/ai-evaluation-export" },
  { label: "치료사 화면 열기", href: "/therapist/system" },
];

export default async function TherapistOverviewPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  let patients: Awaited<ReturnType<typeof listAdminPatientReportSummaries>> = [];
  let validationSampleEntries: Awaited<ReturnType<typeof listAdminReportValidationSample>> = [];
  let featuredPatientDetail: Awaited<ReturnType<typeof getAdminPatientReportDetail>> | null = null;

  if (token) {
    try {
      [patients, validationSampleEntries] = await Promise.all([
        listAdminPatientReportSummaries(token),
        listAdminReportValidationSample(token),
      ]);
      if (patients[0]?.patientId) {
        featuredPatientDetail = await getAdminPatientReportDetail(token, patients[0].patientId);
      }
    } catch {
      patients = [];
      validationSampleEntries = [];
      featuredPatientDetail = null;
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
  const latestResults = validationSampleEntries.slice(0, 5);
  const recentVnvLinked = validationSampleEntries.filter(
    (entry) => (entry.vnv?.summary?.requirementIds?.length ?? 0) > 0,
  ).length;
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

  const kpis = [
    {
      title: "등록 사용자",
      value: `${patients.length}명`,
      note: "최근 활동 기준 정렬",
      icon: Users,
      accent: "text-sky-600",
    },
    {
      title: "측정 완료 비율",
      value: `${measuredRate.toFixed(1)}%`,
      note: `${measuredCount}건 / ${validationSampleEntries.length}건`,
      icon: Microscope,
      accent: "text-emerald-600",
    },
    {
      title: "저장 성공률",
      value: `${saveSuccessRate.toFixed(1)}%`,
      note: `${savedCount}건 저장 완료`,
      icon: CheckCircle2,
      accent: "text-indigo-600",
    },
    {
      title: "저장 실패",
      value: `${failedCount}건`,
      note: "즉시 확인 필요",
      icon: AlertTriangle,
      accent: "text-rose-600",
    },
  ];

  return (
    <section className="space-y-6">
      <article className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-sky-600 to-indigo-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-100">
                오늘의 핵심 KPI
              </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              치료사가 바로 확인해야 하는 핵심 지표를 한 화면에 모았습니다.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-sky-50/90">
              사용자 흐름은 단순하게 유지하고, 치료사 화면에서는 결과 해석, 저장 상태,
              측정 품질, V&V 연결 상태를 빠르게 확인할 수 있게 구성합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[24px] bg-white/15 px-4 py-4 backdrop-blur"
                >
                  <div className="flex items-center gap-2 text-sky-50">
                    <Icon className="h-4 w-4" />
                    <p className="text-xs font-black">{item.title}</p>
                  </div>
                  <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs font-medium text-sky-100/90">{item.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      </article>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-sky-600" />
                <h3 className="text-xl font-black text-slate-950">
                  사용자·세션 빠른 검색
                </h3>
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                사용자 이름, 코드, 로그인 ID로 바로 기록 화면에 진입합니다. 세부
                필터와 저장 상태 검토는 사용자/훈련 이력 및 결과 분석 화면에서 이어서
                확인합니다.
              </p>
              <form action="/therapist/patients" className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="flex-1">
                  <span className="sr-only">사용자 또는 세션 검색</span>
                  <input
                    name="query"
                    placeholder="사용자 이름, 사용자 코드, 로그인 ID 검색"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-700"
                >
                  <Search className="h-4 w-4" />
                  검색
                </button>
              </form>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-600" />
                <p className="text-sm font-black text-slate-950">운영자 액션</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {RESULT_FILTER_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
                저장 실패, measured 비율, 보안·검증 현황 같은 운영 체크포인트를 바로
                열 수 있게 묶었습니다.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sky-600" />
            <h3 className="text-xl font-black text-slate-950">오늘의 핵심 KPI</h3>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-500">{item.title}</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 shadow-sm">
                      <Icon className={`h-5 w-5 ${item.accent}`} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                    {item.note}
                  </p>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h3 className="text-xl font-black text-slate-950">운영 체크</h3>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-black text-slate-500">최근 V&V 연결 결과</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{recentVnvLinked}건</p>
              <p className="mt-1 text-sm font-medium text-slate-600">
                requirement/test case 메타데이터가 포함된 최근 결과 수입니다.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-black text-slate-500">최근 저장 실패</p>
              <p className="mt-2 text-2xl font-black text-rose-600">{failedCount}건</p>
              <p className="mt-1 text-sm font-medium text-slate-600">
                저장 실패 항목은 결과 분석 화면에서 바로 재확인할 수 있습니다.
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-black text-slate-500">최근 활동 시간</p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatDateTime(latestUsers[0]?.latestActivityAt)}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-600">
                최근 사용자 활동 기준으로 대시보드를 갱신합니다.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                사용자/훈련 리스트
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">최근 확인이 필요한 사용자</h3>
            </div>
            <Link
              href="/therapist/patients"
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700"
            >
              전체 보기
            </Link>
          </div>
          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="grid grid-cols-[1.1fr_0.7fr_0.8fr_0.9fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              <span>사용자</span>
              <span>최근 활동</span>
              <span>AQ / 훈련</span>
              <span>바로가기</span>
            </div>
            {latestUsers.length ? (
              latestUsers.map((user) => (
                <div
                  key={user.patientId}
                  className="grid grid-cols-[1.1fr_0.7fr_0.8fr_0.9fr] gap-3 border-t border-slate-200 px-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-black text-slate-950">{user.patientName}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {user.patientCode} · {user.loginId || "로그인 ID 없음"}
                    </p>
                  </div>
                  <div className="font-semibold text-slate-700">
                    {formatDateTime(user.latestActivityAt)}
                  </div>
                  <div className="font-semibold text-slate-700">
                    self {user.selfAssessmentCount} · rehab {user.rehabCount} · sing {user.singCount}
                  </div>
                  <div>
                    <Link
                      href={`/therapist/patients/${user.patientId}`}
                      className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                    >
                      사용자 기록 보기
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm font-semibold text-slate-500">
                아직 표시할 사용자 활동 데이터가 없습니다.
              </div>
            )}
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                결과 요약 패널
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">최근 저장 결과</h3>
            </div>
            <Link
              href="/therapist/results"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
            >
              결과 화면 열기
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {latestResults.length ? (
              latestResults.map((entry) => (
                <div
                  key={entry.historyId}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {entry.patientName || "사용자"} · {entry.trainingMode === "sing" ? "노래" : entry.trainingMode === "rehab" ? "재활" : "자가진단"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        AQ {Number(entry.aq ?? 0).toFixed(1)} · {formatDateTime(
                          new Date(entry.completedAt).toISOString(),
                        )}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${getSaveStateClass(entry)}`}
                    >
                      {getSaveStateLabel(entry)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                      측정 품질 {entry.measurementQuality?.overall || "확인 필요"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                      V&V {entry.vnv?.summary?.requirementIds?.length ?? 0}건
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                      시험 {entry.vnv?.summary?.testCaseIds?.length ?? 0}건
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-sm font-semibold text-slate-500">
                아직 표시할 저장 결과가 없습니다.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                사용자 상세 핵심 패널
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                최근 사용자 상태를 메인 화면에서 바로 확인합니다.
              </h3>
            </div>
            {featuredPatientDetail?.patient.patientId ? (
              <Link
                href={`/therapist/patients/${featuredPatientDetail.patient.patientId}`}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700"
              >
                상세 보기
              </Link>
            ) : null}
          </div>

          {featuredPatientDetail && featuredLatest ? (
            <>
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-black text-slate-950">
                    {featuredPatientDetail.patient.patientName}
                  </p>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700">
                    {featuredPatientDetail.patient.patientCode}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  최근 AQ {Number(featuredLatest.aq ?? 0).toFixed(1)} · 측정 품질{" "}
                  {getQualityLabel(featuredLatest.measurementQuality?.overall)}
                </p>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-500">AQ 추이</p>
                  <div className="mt-4 rounded-[20px] bg-white p-3 shadow-sm">
                    <svg viewBox="0 0 100 100" className="h-40 w-full">
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        points={featuredAqTrend.map((point) => `${point.x},${point.y}`).join(" ")}
                      />
                      {featuredAqTrend.map((point) => (
                        <g key={`${point.label}-${point.x}`}>
                          <circle cx={point.x} cy={point.y} r="2.8" fill="#0f172a" />
                          <text
                            x={point.x}
                            y={96}
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

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-500">Step1~6 결과 요약</p>
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
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                        측정 품질
                      </p>
                      <p className="mt-2 text-base font-black text-slate-950">
                        {getQualityLabel(featuredLatest.measurementQuality?.overall)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                        검증 연결
                      </p>
                      <p className="mt-2 text-base font-black text-slate-950">
                        요구사항 {featuredLatest.vnv?.summary?.requirementIds?.length ?? 0}건
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-sm font-semibold text-slate-500">
              아직 메인 화면에 표시할 사용자 상세 데이터가 없습니다.
            </div>
          )}
        </article>

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
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {QUICK_LINKS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-sky-600" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                운영자 액션
              </p>
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-950">{card.title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {card.body}
            </p>
            <span className="mt-5 inline-flex text-sm font-black text-sky-700">
              {card.cta}
            </span>
          </Link>
        ))}
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-sky-600" />
          <h3 className="text-xl font-black text-slate-950">즉시 실행 액션</h3>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {OPERATION_EXPORT_LINKS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/therapist/results?saveState=failed"
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100"
          >
            저장 실패 결과 바로 보기
          </Link>
        </div>
      </section>
    </section>
  );
}
