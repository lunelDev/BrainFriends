"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import type { AdminPatientReportSummary } from "@/lib/server/adminReportsDb";
import type { TherapistColleagueSummary } from "@/lib/server/therapistReportsDb";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import {
  reviewOrganizationRequest,
  type OrganizationRegistrationRequestRow,
} from "@/lib/client/adminOrganizationsApi";
import { TherapistLogoutButton } from "@/app/therapist/_components/TherapistLogoutButton";
import { ADMIN_DOCUMENT_GROUPS } from "@/app/admin/_lib/document-groups";

type OrganizationRow = {
  id: string;
  code: string;
  name: string;
  address: string;
  source?: "builtin" | "manual";
};

type Props = {
  adminName: string;
  organizations: OrganizationRow[];
  organizationRequests: OrganizationRegistrationRequestRow[];
  patients: AdminPatientReportSummary[];
  therapists: TherapistColleagueSummary[];
  validationSampleEntries: TrainingHistoryEntry[];
};

type AdminPatientDetailPayload = {
  patient: {
    patientId: string;
    patientName: string;
    patientCode: string;
    loginId: string | null;
    birthDate: string | null;
    phone: string | null;
  };
  entries: TrainingHistoryEntry[];
};

type InternalSection =
  | "samd"
  | "members"
  | "organizations"
  | "therapists"
  | "operations"
  | "usage"
  | "security";

const SIDEBAR_ITEMS = [
  { label: "공인성적서·SaMD", key: "samd", icon: FileText },
  { label: "회원 관리", key: "members", icon: Users },
  { label: "기관 관리", key: "organizations", icon: Building2 },
  { label: "치료사 콘솔", key: "therapists", icon: Stethoscope },
  { label: "운영 시스템", key: "operations", icon: Activity },
  { label: "사용량 관리", key: "usage", icon: BarChart3 },
  { label: "보안·검증 현황", key: "security", icon: ShieldCheck },
] as const;

const SECTION_LABELS: Record<InternalSection, string> = {
  samd: "SaMD",
  members: "회원",
  organizations: "기관",
  therapists: "치료사",
  operations: "운영",
  usage: "사용량",
  security: "보안",
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminConsoleClient({
  adminName,
  organizations: initialOrganizations,
  organizationRequests: initialOrganizationRequests,
  patients,
  therapists,
  validationSampleEntries,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<InternalSection>("members");
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [organizationRequests, setOrganizationRequests] = useState(initialOrganizationRequests);
  const [organizationError, setOrganizationError] = useState("");
  const [organizationSuccess, setOrganizationSuccess] = useState("");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientDetail, setSelectedPatientDetail] =
    useState<AdminPatientDetailPayload | null>(null);
  const [isLoadingPatientDetail, setIsLoadingPatientDetail] = useState(false);
  const [patientDetailError, setPatientDetailError] = useState("");

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((item) =>
      [item.patientName, item.patientCode, item.loginId, item.patientPseudonymId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [patients, search]);

  const latestActiveCount = filteredPatients.filter((item) => item.latestActivityAt).length;
  const usageSummary = useMemo(() => {
    const selfCount = patients.reduce((sum, item) => sum + item.selfAssessmentCount, 0);
    const rehabCount = patients.reduce((sum, item) => sum + item.rehabCount, 0);
    const singCount = patients.reduce((sum, item) => sum + item.singCount, 0);
    const measuredCount = validationSampleEntries.filter(
      (entry) => entry.measurementQuality?.overall === "measured",
    ).length;
    const failedCount = validationSampleEntries.filter(
      (entry) => (entry as TrainingHistoryEntry & { dbSaveState?: string }).dbSaveState === "failed",
    ).length;
    const vnvLinkedCount = validationSampleEntries.filter((entry) => entry.vnv?.summary).length;

    return {
      selfCount,
      rehabCount,
      singCount,
      measuredCount,
      failedCount,
      vnvLinkedCount,
    };
  }, [patients, validationSampleEntries]);

  const reviewRequest = async (
    requestId: string,
    status: "approved" | "rejected",
  ) => {
    setOrganizationError("");
    setOrganizationSuccess("");
    setReviewingRequestId(requestId);
    try {
      const result = await reviewOrganizationRequest({ requestId, status });
      setOrganizationRequests((prev) =>
        prev.map((item) =>
          item.id === requestId ? { ...item, ...result.reviewed } : item,
        ),
      );
      if (result.organization) {
        const nextOrganization: OrganizationRow = {
          id: result.organization.id,
          code: result.organization.code,
          name: result.organization.name,
          address: result.organization.address,
          source: "manual",
        };
        setOrganizations((prev) => [nextOrganization, ...prev]);
      }
      setOrganizationSuccess(
        status === "approved" ? "기관 등록 요청을 승인했습니다." : "기관 등록 요청을 반려했습니다.",
      );
    } catch (error) {
      setOrganizationError(
        error instanceof Error ? error.message : "기관 등록 요청 처리에 실패했습니다.",
      );
    } finally {
      setReviewingRequestId(null);
    }
  };

  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatientDetail(null);
      setPatientDetailError("");
      setIsLoadingPatientDetail(false);
      return;
    }

    let cancelled = false;
    setIsLoadingPatientDetail(true);
    setPatientDetailError("");

    void fetch(`/api/admin/reports?patientId=${encodeURIComponent(selectedPatientId)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error("사용자 상세 정보를 불러오지 못했습니다.");
        }
        if (!cancelled) {
          setSelectedPatientDetail({
            patient: payload.patient,
            entries: payload.entries ?? [],
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedPatientDetail(null);
          setPatientDetailError(
            error instanceof Error ? error.message : "사용자 상세 정보를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPatientDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  return (
    <main className="min-h-screen bg-[#f4f6fb]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-slate-800 bg-[#171a2b] text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-sm font-black tracking-tight">브레인프렌즈</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">관리자 콘솔</p>
            </div>
          </div>

          <div className="px-4 py-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                Admin
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-200">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">{adminName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    관리자 운영 계정
                  </p>
                </div>
              </div>
            </div>
          </div>

          <nav className="space-y-1 px-3 pb-6">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    isActive
                      ? "bg-[#2467ff] text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">관리자 화면</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  사용자, 기관, 운영 지표를 관리자 기준으로 확인합니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/select-page/mode"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  사용자 화면
                </Link>
                <Link
                  href="/therapist"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                >
                  치료사 화면
                </Link>
                <TherapistLogoutButton />
              </div>
            </div>
          </header>

          <div className="space-y-6 p-6">
            {activeSection === "samd" ? (
              <section className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-sky-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">
                        공인성적서·SaMD 준비 현황
                      </h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        관리자 화면 안에서 SW V&amp;V, 사이버보안, AI 성능평가, 부족 항목과 다음 단계를 한 번에 확인합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="SW V&V"
                      value="정리 완료"
                      note="12개 deterministic check, 실행 로그, 결과서 보유"
                    />
                    <MetricCard
                      label="사이버보안"
                      value="정책 고정"
                      note="브라우저 저장 최소화, 저장 항목표/분류표 정리"
                    />
                    <MetricCard
                      label="AI 성능평가"
                      value="운영 가능"
                      note="measured-only 수집, DB 저장, 버전 비교 가능"
                    />
                    <MetricCard
                      label="다음 단계"
                      value="외부 대응"
                      note="시험기관 문의, 품목·등급, GMP/사용적합성 확인"
                    />
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">
                      SW V&V
                    </p>
                    <ul className="mt-4 space-y-2 text-sm font-medium leading-6 text-slate-700">
                      <li>요구사항-시험-결과 추적성 구조 반영</li>
                      <li>`npm run test:vnv`, `test:vnv:record` 실행 가능</li>
                      <li>날짜별 JSON 실행 로그 누적</li>
                      <li>결과서, 재시험 기록서, 제출 개요 문서 정리</li>
                    </ul>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <a
                        href="/api/therapist/system/vnv-export"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        V&amp;V 내보내기
                      </a>
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-600">
                      사이버보안
                    </p>
                    <ul className="mt-4 space-y-2 text-sm font-medium leading-6 text-slate-700">
                      <li>고위험 step 원시 데이터의 장기 local 저장 제거</li>
                      <li>transient/session 기준 저장 구조 정리</li>
                      <li>저장 항목표, 정책 결정서, 민감정보 분류표 정리</li>
                      <li>최종 readiness 보고서 기준으로 정책 고정</li>
                    </ul>
                    <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-black text-slate-900">남은 확인</p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        품질관리기준(GMP) 제출 묶음과 외부 보안 절차 문서 정리 필요
                      </p>
                    </div>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600">
                      AI 성능평가
                    </p>
                    <ul className="mt-4 space-y-2 text-sm font-medium leading-6 text-slate-700">
                      <li>measured-only 평가셋 분리 및 DB 저장</li>
                      <li>dataset / model / analysis 버전 비교</li>
                      <li>현재 운영본 보고서 및 오류 사례 문서 정리</li>
                      <li>치료사 시스템 기준 AI export 가능</li>
                    </ul>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <a
                        href="/api/therapist/system/ai-evaluation-export"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        AI 평가 내보내기
                      </a>
                    </div>
                  </article>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-slate-700" />
                      <h3 className="text-xl font-black text-slate-950">아직 부족한 항목</h3>
                    </div>
                    <ul className="mt-5 space-y-3 text-sm font-medium leading-6 text-slate-700">
                      <li>품목 / 등급 확정</li>
                      <li>시험기관 요구 형식에 맞춘 문서 재편</li>
                      <li>품질관리기준(GMP) 제출 문서 묶음</li>
                      <li>사용적합성 자료</li>
                      <li>AI 라벨/프로토콜의 외부 심사 수준 정리</li>
                      <li>실제 시험기관 시험 수행 및 성적서 확보</li>
                    </ul>
                  </article>

                  <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-600" />
                      <h3 className="text-xl font-black text-slate-950">다음 해야 할 일</h3>
                    </div>
                    <ol className="mt-5 space-y-3 text-sm font-medium leading-6 text-slate-700">
                      <li>1. 시험기관 사전 문의</li>
                      <li>2. 품목 / 등급 확인</li>
                      <li>3. 필요한 성적서 종류 확정</li>
                      <li>4. 시험기관 양식에 맞춘 문서 정리</li>
                      <li>5. 실제 시험 진행 및 성적서 수령</li>
                    </ol>
                  </article>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-sky-600" />
                    <h3 className="text-xl font-black text-slate-950">문서 위치 요약</h3>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {ADMIN_DOCUMENT_GROUPS.map((group) => (
                      <DocPathCard
                        key={group.slug}
                        href={`/admin/docs/${group.slug}`}
                        label={group.label}
                        path={group.path}
                        items={group.items}
                      />
                    ))}
                  </div>
                </section>
              </section>
            ) : activeSection === "members" ? (
              selectedPatientId ? (
                <section className="space-y-6">
                  <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5 text-sky-600" />
                          <h2 className="text-xl font-black text-slate-950">사용자 회원 상세</h2>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          회원 관리 메인 콘텐츠 안에서 선택한 사용자 정보를 한 화면처럼 확인합니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPatientId(null)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        회원 목록으로
                      </button>
                    </div>

                    {isLoadingPatientDetail ? (
                      <div className="px-6 py-10 text-sm font-semibold text-slate-500">
                        사용자 상세 정보를 불러오는 중입니다.
                      </div>
                    ) : patientDetailError ? (
                      <div className="px-6 py-10">
                        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-8 text-sm font-semibold text-rose-600">
                          {patientDetailError}
                        </div>
                      </div>
                    ) : selectedPatientDetail ? (
                      <div className="space-y-6 px-6 py-6">
                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <MetricCard
                            label="사용자명"
                            value={selectedPatientDetail.patient.patientName}
                            note={selectedPatientDetail.patient.patientCode}
                          />
                          <MetricCard
                            label="로그인 ID"
                            value={selectedPatientDetail.patient.loginId ?? "-"}
                            note="등록된 계정 정보"
                          />
                          <MetricCard
                            label="최근 결과"
                            value={`${selectedPatientDetail.entries.length}건`}
                            note="누적 저장 결과 수"
                          />
                          <MetricCard
                            label="최근 AQ"
                            value={
                              selectedPatientDetail.entries.length
                                ? Number(selectedPatientDetail.entries[0]?.aq ?? 0).toFixed(1)
                                : "-"
                            }
                            note="가장 최근 저장 결과 기준"
                          />
                        </section>

                        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                              기본 정보
                            </p>
                            <div className="mt-4 space-y-3 text-sm">
                              <div>
                                <p className="font-black text-slate-950">
                                  {selectedPatientDetail.patient.patientName}
                                </p>
                                <p className="mt-1 font-medium text-slate-500">
                                  {selectedPatientDetail.patient.patientCode}
                                </p>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <DetailBlock
                                  label="로그인 ID"
                                  value={selectedPatientDetail.patient.loginId ?? "-"}
                                />
                                <DetailBlock
                                  label="생년월일"
                                  value={selectedPatientDetail.patient.birthDate ?? "-"}
                                />
                                <DetailBlock
                                  label="연락처"
                                  value={selectedPatientDetail.patient.phone ?? "-"}
                                />
                                <DetailBlock
                                  label="결과 수"
                                  value={`${selectedPatientDetail.entries.length}건`}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                              최근 결과 요약
                            </p>
                            <div className="mt-4 space-y-3">
                              {selectedPatientDetail.entries.slice(0, 5).map((entry) => (
                                <div
                                  key={entry.historyId}
                                  className="rounded-[18px] border border-slate-200 bg-white p-4"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700">
                                      {entry.trainingMode === "sing"
                                        ? "노래"
                                        : entry.trainingMode === "rehab"
                                          ? `재활${entry.rehabStep ? ` Step ${entry.rehabStep}` : ""}`
                                          : "자가진단"}
                                    </span>
                                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
                                      AQ {Number(entry.aq ?? 0).toFixed(1)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm font-semibold text-slate-600">
                                    완료 시각 {formatDateTime(new Date(entry.completedAt).toISOString())}
                                  </p>
                                  <p className="mt-1 text-xs font-bold text-slate-500">
                                    측정 품질 {entry.measurementQuality?.overall ?? "확인 필요"} ·
                                    검증 연결 {entry.vnv?.summary?.requirementIds?.length ?? 0}건
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-6 py-10">
                        <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm font-semibold text-slate-500">
                          불러온 사용자 상세 정보가 없습니다.
                        </div>
                      </div>
                    )}
                  </section>
                </section>
              ) : (
                <section className="space-y-6">
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="전체 사용자"
                      value={String(patients.length)}
                      note="관리자 기준 가입 사용자"
                    />
                    <MetricCard
                      label="활동 사용자"
                      value={String(latestActiveCount)}
                      note="기록이 1건 이상 있는 사용자"
                    />
                    <MetricCard
                      label="등록 기관"
                      value={String(organizations.length)}
                      note="가입 선택 가능한 기관 수"
                    />
                    <MetricCard
                      label="현재 영역"
                      value="회원"
                      note="회원 전체 관리 화면"
                    />
                  </section>

                  <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5 text-sky-600" />
                          <h2 className="text-xl font-black text-slate-950">사용자 회원 목록</h2>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          관리자 기준으로 전체 사용자 가입 상태와 최근 활동을 확인합니다.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="이름, 코드, 로그인 ID 검색"
                          className="h-11 min-w-[260px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                        <button
                          type="button"
                          onClick={() => setActiveSection("organizations")}
                          className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-sky-700"
                        >
                          기관관리
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto px-6 py-5">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-[#1c2133] text-left text-white">
                            <th className="px-4 py-3 font-black">번호</th>
                            <th className="px-4 py-3 font-black">사용자명</th>
                            <th className="px-4 py-3 font-black">사용자 코드</th>
                            <th className="px-4 py-3 font-black">로그인 ID</th>
                            <th className="px-4 py-3 font-black">자가진단</th>
                            <th className="px-4 py-3 font-black">재활</th>
                            <th className="px-4 py-3 font-black">노래</th>
                            <th className="px-4 py-3 font-black">최근 활동</th>
                            <th className="px-4 py-3 font-black">상세</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPatients.length ? (
                            filteredPatients.map((item, index) => (
                              <tr
                                key={item.patientId}
                                className="border-b border-slate-200 bg-white text-slate-700"
                              >
                                <td className="px-4 py-4 font-semibold">
                                  {filteredPatients.length - index}
                                </td>
                                <td className="px-4 py-4 font-black text-slate-950">
                                  {item.patientName}
                                </td>
                                <td className="px-4 py-4 font-semibold">{item.patientCode}</td>
                                <td className="px-4 py-4 font-semibold">{item.loginId ?? "-"}</td>
                                <td className="px-4 py-4 font-semibold">
                                  {item.selfAssessmentCount}
                                </td>
                                <td className="px-4 py-4 font-semibold">{item.rehabCount}</td>
                                <td className="px-4 py-4 font-semibold">{item.singCount}</td>
                                <td className="px-4 py-4 font-semibold">
                                  {formatDateTime(item.latestActivityAt)}
                                </td>
                                <td className="px-4 py-4">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPatientId(item.patientId)}
                                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 transition hover:bg-sky-100"
                                  >
                                    상세보기
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                              >
                                조건에 맞는 사용자가 없습니다.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </section>
              )
            ) : activeSection === "organizations" ? (
              <section className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-amber-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">기관 등록 요청</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        회원가입 화면에서 들어온 기관 등록 요청을 관리자 화면 안에서 승인 또는 반려합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-black text-slate-700">기관명</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">담당자</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">연락처</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">사업자번호</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">상태</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {organizationRequests.length ? (
                          organizationRequests.map((item) => {
                            const isPending = item.status === "pending";
                            const isReviewing = reviewingRequestId === item.id;
                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-4">
                                  <p className="font-black text-slate-900">{item.organizationName}</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">
                                    {item.address}
                                  </p>
                                </td>
                                <td className="px-4 py-4 font-semibold text-slate-700">
                                  {item.contactName || "-"}
                                </td>
                                <td className="px-4 py-4 font-semibold text-slate-700">
                                  {item.contactPhone || item.contactEmail || "-"}
                                </td>
                                <td className="px-4 py-4 font-semibold text-slate-700">
                                  {item.businessNumber || "-"}
                                </td>
                                <td className="px-4 py-4">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                    {item.status === "approved"
                                      ? "승인 완료"
                                      : item.status === "rejected"
                                        ? "반려"
                                        : "승인 대기"}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  {isPending ? (
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={isReviewing}
                                        onClick={() => reviewRequest(item.id, "approved")}
                                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                      >
                                        승인
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isReviewing}
                                        onClick={() => reviewRequest(item.id, "rejected")}
                                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                                      >
                                        반려
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-xs font-semibold text-slate-500">
                                      {item.reviewedAt ? `처리 ${formatDateTime(item.reviewedAt)}` : "처리 완료"}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                            >
                              대기 중인 기관 등록 요청이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-amber-600" />
                    <h2 className="text-xl font-black text-slate-950">기관 목록</h2>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    회원가입에서 선택 가능한 기관 목록을 관리자 화면에서 확인합니다.
                  </p>

                  {organizationError ? (
                    <p className="mt-4 text-sm font-bold text-red-500">{organizationError}</p>
                  ) : null}
                  {organizationSuccess ? (
                    <p className="mt-4 text-sm font-bold text-emerald-600">
                      {organizationSuccess}
                    </p>
                  ) : null}

                  <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-black text-slate-700">기관명</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">주소</th>
                          <th className="px-4 py-3 text-left font-black text-slate-700">구분</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {organizations.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                            <td className="px-4 py-3 text-slate-600">{item.address}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                {item.source === "manual" ? "승인 기관" : "기본 기관"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </section>
            ) : activeSection === "therapists" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-5">
                  <Stethoscope className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h2 className="text-xl font-black text-slate-950">치료사 콘솔</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      등록된 치료사 계정과 담당 사용자 수를 관리자 화면 내부에서 확인합니다.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto px-6 py-5">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#1c2133] text-left text-white">
                        <th className="px-4 py-3 font-black">번호</th>
                        <th className="px-4 py-3 font-black">치료사명</th>
                        <th className="px-4 py-3 font-black">소속 기관</th>
                        <th className="px-4 py-3 font-black">로그인 ID</th>
                        <th className="px-4 py-3 font-black">승인 상태</th>
                        <th className="px-4 py-3 font-black">담당 사용자</th>
                        <th className="px-4 py-3 font-black">최근 로그인</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapists.length ? (
                        therapists.map((item, index) => (
                          <tr
                            key={item.therapistUserId}
                            className="border-b border-slate-200 bg-white text-slate-700"
                          >
                            <td className="px-4 py-4 font-semibold">
                              {therapists.length - index}
                            </td>
                            <td className="px-4 py-4 font-black text-slate-950">
                              {item.therapistName}
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {item.organizationName ?? "기관 정보 없음"}
                            </td>
                            <td className="px-4 py-4 font-semibold">{item.loginId ?? "-"}</td>
                            <td className="px-4 py-4">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                {item.approvalState === "pending"
                                  ? "승인 대기"
                                  : item.approvalState === "approved"
                                    ? "승인 완료"
                                    : "상태 확인"}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {item.assignedPatientCount}명
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {formatDateTime(item.lastLoginAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                          >
                            표시할 치료사 계정이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : activeSection === "operations" ? (
              <section className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-sky-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">운영 시스템</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        관리자 콘솔 안에서 운영 도구와 검증 현황을 한 번에 열어보는 내부 운영 허브입니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="측정 완료" value={String(usageSummary.measuredCount)} note="measured 결과 수" />
                    <MetricCard label="저장 실패" value={String(usageSummary.failedCount)} note="즉시 확인 필요" />
                    <MetricCard label="검증 연결" value={String(usageSummary.vnvLinkedCount)} note="V&V 연결 결과 수" />
                    <MetricCard label="등록 기관" value={String(organizations.length)} note="현재 승인된 기관 수" />
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setActiveSection("usage")}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50"
                  >
                    <p className="text-lg font-black text-slate-900">사용량 관리</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      사용자별 자가진단, 재활, 노래 누적량과 최근 활동을 확인합니다.
                    </p>
                    <span className="mt-5 inline-flex text-sm font-black text-sky-700">열기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("organizations")}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50"
                  >
                    <p className="text-lg font-black text-slate-900">기관 관리</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      기관 등록 요청 승인과 승인된 기관 목록을 관리자 화면 안에서 확인합니다.
                    </p>
                    <span className="mt-5 inline-flex text-sm font-black text-sky-700">열기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("therapists")}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50"
                  >
                    <p className="text-lg font-black text-slate-900">치료사 콘솔</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      치료사 승인 상태, 소속 기관, 담당 사용자 수를 한 화면에서 점검합니다.
                    </p>
                    <span className="mt-5 inline-flex text-sm font-black text-sky-700">열기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("security")}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:bg-slate-50"
                  >
                    <p className="text-lg font-black text-slate-900">보안·검증 현황</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      저장 상태, 측정 품질, 검증 연결 수와 export 버튼을 확인합니다.
                    </p>
                    <span className="mt-5 inline-flex text-sm font-black text-sky-700">열기</span>
                  </button>
                </section>
              </section>
            ) : activeSection === "usage" ? (
              <section className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="자가진단" value={String(usageSummary.selfCount)} note="누적 자가진단 기록" />
                  <MetricCard label="재활" value={String(usageSummary.rehabCount)} note="누적 재활 기록" />
                  <MetricCard label="노래" value={String(usageSummary.singCount)} note="누적 노래 기록" />
                  <MetricCard label="활동 사용자" value={String(latestActiveCount)} note="최근 활동 사용자 수" />
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-sky-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">사용량 관리</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        사용자별 훈련 누적량과 최근 활동을 관리자 콘솔 안에서 확인합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1c2133] text-left text-white">
                          <th className="px-4 py-3 font-black">사용자명</th>
                          <th className="px-4 py-3 font-black">자가진단</th>
                          <th className="px-4 py-3 font-black">재활</th>
                          <th className="px-4 py-3 font-black">노래</th>
                          <th className="px-4 py-3 font-black">최근 활동</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((item) => (
                          <tr key={item.patientId} className="border-b border-slate-200 bg-white text-slate-700">
                            <td className="px-4 py-4 font-black text-slate-950">{item.patientName}</td>
                            <td className="px-4 py-4 font-semibold">{item.selfAssessmentCount}</td>
                            <td className="px-4 py-4 font-semibold">{item.rehabCount}</td>
                            <td className="px-4 py-4 font-semibold">{item.singCount}</td>
                            <td className="px-4 py-4 font-semibold">{formatDateTime(item.latestActivityAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </section>
            ) : (
              <section className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="측정 완료" value={String(usageSummary.measuredCount)} note="measured 결과 수" />
                  <MetricCard label="저장 실패" value={String(usageSummary.failedCount)} note="즉시 확인 필요" />
                  <MetricCard label="검증 연결" value={String(usageSummary.vnvLinkedCount)} note="V&V 연결 결과 수" />
                  <MetricCard label="전체 결과" value={String(validationSampleEntries.length)} note="최근 검토 가능한 결과 수" />
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">보안·검증 현황</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        저장 상태, 측정 품질, 검증 연결 수를 관리자 화면 안에서 확인합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-black text-slate-500">즉시 확인 필요</p>
                      <ul className="mt-3 space-y-2 text-sm font-medium text-slate-700">
                        <li>저장 실패 결과: {usageSummary.failedCount}건</li>
                        <li>측정 완료 결과: {usageSummary.measuredCount}건</li>
                        <li>검증 연결 결과: {usageSummary.vnvLinkedCount}건</li>
                      </ul>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-black text-slate-500">바로가기</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href="/api/therapist/system/vnv-export"
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          V&amp;V 내보내기
                        </Link>
                        <Link
                          href="/api/therapist/system/ai-evaluation-export"
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          AI 평가 내보내기
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        .input-style {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .input-style:focus {
          outline: none;
          border-color: #f59e0b;
          background: white;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.12);
        }
      `}</style>
    </main>
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
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{note}</p>
    </article>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function DocPathCard({
  href,
  label,
  path,
  items,
}: {
  href: string;
  label: string;
  path: string;
  items: string[];
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[20px] border border-slate-200 bg-slate-50 p-5 transition hover:border-sky-200 hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-900">{label}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{path}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-sky-600" />
      </div>
      <ul className="mt-4 space-y-2 text-sm font-medium text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-sm font-black text-sky-700">내용 보기</p>
    </Link>
  );
}
