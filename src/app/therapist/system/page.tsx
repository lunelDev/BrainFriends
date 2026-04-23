import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck, ClipboardCheck, Database, AlertTriangle } from "lucide-react";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { buildVnvEvidenceSummary } from "@/lib/server/vnvEvidenceDb";
import { getEvaluationSamplesSummary } from "@/lib/server/evaluationSamplesDb";
import { listRecentSecurityAuditEvents } from "@/lib/server/securityAuditDb";

const SYSTEM_LINKS = [
  {
    title: "이벤트 사용량 관리",
    href: "/tools/training-usage-admin",
    body: "전체 사용자 이벤트와 저장 흐름을 검색하고 CSV로 확인합니다.",
  },
  {
    title: "사용자 타임라인",
    href: "/tools/training-usage-timeline",
    body: "단일 사용자 기준 실패/스킵 이벤트 이력을 추적합니다.",
  },
  {
    title: "치료사 계정 생성",
    href: "/therapist/system/provision",
    body: "공개 회원가입 흐름과 분리된 치료사 계정 생성 경로입니다.",
  },
  {
    title: "기관 관리",
    href: "/therapist/system/organizations",
    body: "기관 등록과 목록 관리를 관리자 화면에서 분리해 운영합니다.",
  },
  {
    title: "AI 평가셋 모니터링",
    href: "/therapist/system/evaluation",
    body: "dataset / model / analysis version 비교와 샘플 품질 분포를 확인합니다.",
  },
];

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

export default async function TherapistSystemPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  // 보안·검증 현황은 운영 정보라 관리자만 접근. 치료사는 종합 대시보드로 돌려보낸다.
  const context = token
    ? await getAuthenticatedSessionContext(token).catch(() => null)
    : null;
  if (!context || context.userRole !== "admin") {
    redirect("/therapist");
  }

  let vnvSummary: Awaited<ReturnType<typeof buildVnvEvidenceSummary>> | null = null;
  let evaluationSummary: Awaited<ReturnType<typeof getEvaluationSamplesSummary>> | null = null;
  let securityEvents: Awaited<ReturnType<typeof listRecentSecurityAuditEvents>> = [];

  if (token) {
    try {
      [vnvSummary, evaluationSummary, securityEvents] = await Promise.all([
        buildVnvEvidenceSummary(token),
        getEvaluationSamplesSummary(),
        listRecentSecurityAuditEvents(6),
      ]);
    } catch {
      vnvSummary = null;
      evaluationSummary = null;
      securityEvents = [];
    }
  }

  const vnvEvidence = vnvSummary?.coverage;

  return (
    <section className="space-y-6">
      <article className="rounded-[32px] border border-slate-200 bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-100">
          Remediation System
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
          SW V&amp;V, 사이버보안, AI 성능평가 운영 지표를 한 화면에서 확인합니다.
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-amber-50/90">
          구조 문서에 있던 remediation 항목을 실제 런타임 기준으로 확인할 수 있게 정리했습니다.
          증적 export, 보안 이벤트, measured-only 평가셋 상태를 여기서 점검합니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href="/api/therapist/system/vnv-export"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-amber-700 transition hover:bg-amber-50"
          >
            V&amp;V 증적 내보내기
          </a>
          <a
            href="/api/therapist/system/ai-evaluation-export"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-violet-700 transition hover:bg-violet-50"
          >
            AI 평가 내보내기
          </a>
          <Link
            href="/tools/training-usage-admin"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
          >
            운영 이벤트 보기
          </Link>
        </div>
      </article>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-sky-600" />
            <h3 className="text-xl font-black text-slate-950">SW V&amp;V</h3>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard
              label="요구사항 수"
              value={String(vnvSummary?.requirements.length ?? 0)}
              note="SRS 기준 정의된 요구사항"
            />
            <MetricCard
              label="추적성 매핑"
              value={String(vnvSummary?.traceability.length ?? 0)}
              note="요구사항-코드-시험 연결"
            />
            <MetricCard
              label="실행 시험 케이스"
              value={String(vnvSummary?.executedTestCases.length ?? 0)}
              note="deterministic + core suite"
            />
            <MetricCard
              label="V&V 연결 결과"
              value={String(vnvEvidence?.vnvLinkedResults ?? 0)}
              note={`전체 결과 ${vnvEvidence?.totalResults ?? 0}건 중`}
            />
            <MetricCard
              label="런타임 체크"
              value={String(vnvEvidence?.runtimeCheckCount ?? 0)}
              note="세션 실행 중 기록된 검증 수"
            />
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-xl font-black text-slate-950">사이버보안</h3>
          </div>
          <div className="mt-5 grid gap-3">
            <MetricCard
              label="최근 보안 이벤트"
              value={String(securityEvents.length)}
              note="차단된 storage 쓰기 포함"
            />
            <MetricCard
              label="최근 이벤트 시각"
              value={formatDateTime(securityEvents[0]?.createdAt)}
              note={securityEvents[0]?.eventType ?? "기록 없음"}
            />
          </div>
          <div className="mt-5 space-y-2">
            {securityEvents.length ? (
              securityEvents.map((event, index) => (
                <div
                  key={`${event.createdAt}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    {event.eventType}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{event.detail}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium leading-6 text-slate-600">
                아직 표시할 보안 이벤트가 없습니다.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-violet-600" />
            <h3 className="text-xl font-black text-slate-950">AI 성능평가</h3>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricCard
              label="평가셋 샘플"
              value={String(evaluationSummary?.totalCount ?? 0)}
              note="ai_evaluation_samples 기준"
            />
            <MetricCard
              label="measured 샘플"
              value={String(evaluationSummary?.measuredCount ?? 0)}
              note="공식 평가 진입 가능 샘플"
            />
            <MetricCard
              label="최근 적재 시각"
              value={formatDateTime(evaluationSummary?.latestCapturedAt)}
              note="가장 최근 captured_at"
            />
            <MetricCard
              label="버전 조합"
              value={String(evaluationSummary?.versions.length ?? 0)}
              note="dataset / model / analysis 조합"
            />
          </div>
          {evaluationSummary?.latestVersionComparison ? (
            <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
                최근 버전 비교
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {evaluationSummary.latestVersionComparison.current.evaluationDatasetVersion}
                {" · "}
                model {evaluationSummary.latestVersionComparison.current.modelVersion}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                샘플 Δ {evaluationSummary.latestVersionComparison.sampleDelta} · 발음 Δ{" "}
                {evaluationSummary.latestVersionComparison.pronunciationDelta.toFixed(1)} ·
                추적 Δ {evaluationSummary.latestVersionComparison.trackingDelta.toFixed(2)}
              </p>
            </div>
          ) : null}
          <div className="mt-5 space-y-2">
            {evaluationSummary?.versions?.length ? (
              evaluationSummary.versions.map((version) => (
                <div
                  key={`${version.evaluationDatasetVersion}-${version.modelVersion}-${version.analysisVersion}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-black text-slate-900">
                    {version.evaluationDatasetVersion}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    model {version.modelVersion} · analysis {version.analysisVersion}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    샘플 {version.sampleCount}건 · {formatDateTime(version.latestCapturedAt)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    발음 {version.avgPronunciationScore.toFixed(1)} · 자음{" "}
                    {version.avgConsonantAccuracy.toFixed(1)} · 모음{" "}
                    {version.avgVowelAccuracy.toFixed(1)} · 추적{" "}
                    {version.avgTrackingQuality.toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm font-medium leading-6 text-slate-600">
                아직 적재된 평가셋 버전 정보가 없습니다.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {SYSTEM_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[24px] border border-slate-200 bg-white p-5 transition hover:bg-slate-50 hover:shadow-sm"
          >
            <h3 className="text-lg font-black text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {item.body}
            </p>
            <span className="mt-5 inline-flex text-sm font-black text-amber-700">
              열기
            </span>
          </Link>
        ))}
      </section>

      <aside className="rounded-[32px] border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
          <h3 className="text-xl font-black text-slate-950">남은 체크 포인트</h3>
        </div>
        <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-700">
          <li>compact session 및 구버전 fallback 경로를 추가 점검</li>
          <li>V&amp;V 증적 export를 운영 문서 포맷으로 추가 정리</li>
          <li>평가셋 버전별 비교 화면과 모니터링 패널 확대</li>
        </ul>
      </aside>
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{note}</p>
    </div>
  );
}
