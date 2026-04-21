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
  initialSection?: InternalSection;
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
  | "dashboard"
  | "members"
  | "organizations"
  | "therapists";

const SIDEBAR_ITEMS = [
  { label: "공인성적서·SaMD", key: "samd", icon: FileText },
  { label: "대시보드", key: "dashboard", icon: ClipboardList },
  { label: "회원 관리", key: "members", icon: Users },
  { label: "치료사 관리", key: "therapists", icon: Stethoscope },
  { label: "기관 관리", key: "organizations", icon: Building2 },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = lookup("year");
  const month = lookup("month");
  const day = lookup("day");
  const hour24 = Number(lookup("hour"));
  const minute = lookup("minute");

  if (!year || !month || !day || Number.isNaN(hour24) || !minute) return "-";

  const meridiem = hour24 >= 12 ? "오후" : "오전";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${year}. ${month}. ${day}. ${meridiem} ${String(hour12).padStart(2, "0")}:${minute}`;
}

function formatTherapistProfession(value?: string | null) {
  switch (value) {
    case "speech":
      return "언어치료사";
    case "occupational":
      return "작업치료사";
    case "physical":
      return "물리치료사";
    case "cognitive":
      return "인지재활";
    case "other":
      return "기타";
    default:
      return "미입력";
  }
}

function formatEmploymentStatus(value?: string | null) {
  switch (value) {
    case "employed":
      return "재직";
    case "contract":
      return "계약";
    case "freelance":
      return "프리랜서";
    default:
      return "미입력";
  }
}

function formatAccessRole(value?: string | null) {
  switch (value) {
    case "manager":
      return "관리자";
    case "observer":
      return "관찰자";
    case "therapist":
      return "치료사";
    default:
      return "미입력";
  }
}

function formatTwoFactorMethod(value?: string | null) {
  return value === "sms" ? "문자" : value === "otp" ? "OTP" : "미설정";
}

function formatIrbParticipation(value?: string | null) {
  switch (value) {
    case "planned":
      return "계획";
    case "approved":
      return "승인";
    case "none":
      return "해당 없음";
    default:
      return "미입력";
  }
}

function summarizeTherapistPermissions(item: TherapistColleagueSummary) {
  const labels = [
    item.canViewPatients ? "환자조회" : null,
    item.canEditPatientData ? "데이터수정" : null,
    item.canEnterEvaluation ? "평가입력" : null,
  ].filter(Boolean);

  return labels.length ? labels.join(" · ") : "권한 미설정";
}

function formatPatientSex(value?: string | null) {
  switch (value) {
    case "M":
      return "남";
    case "F":
      return "여";
    case "U":
      return "기타";
    default:
      return "미입력";
  }
}

function formatHemiplegia(value?: string | null) {
  switch (value) {
    case "Y":
      return "있음";
    case "N":
      return "없음";
    default:
      return "미입력";
  }
}

function formatHemianopsia(value?: string | null) {
  switch (value) {
    case "LEFT":
      return "좌측";
    case "RIGHT":
      return "우측";
    case "NONE":
      return "없음";
    default:
      return "미입력";
  }
}

function formatHand(value?: string | null) {
  switch (value) {
    case "R":
      return "오른손";
    case "L":
      return "왼손";
    case "A":
      return "양손";
    case "U":
      return "미확인";
    default:
      return "미입력";
  }
}

function formatPatientBirth(value?: string | null) {
  if (!value) return "미입력";
  const trimmed = value.trim();
  if (!trimmed) return "미입력";
  return trimmed.slice(0, 10);
}

function formatPatientAgeFromBirth(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function formatEducationYears(value?: number | null) {
  if (value == null) return "미입력";
  if (!Number.isFinite(value)) return "미입력";
  return `${value}년`;
}

function formatOnsetSummary(
  onsetDate?: string | null,
  daysSinceOnset?: number | null,
) {
  if (!onsetDate && daysSinceOnset == null) return "미입력";
  const parts: string[] = [];
  if (onsetDate) parts.push(onsetDate.slice(0, 10));
  if (daysSinceOnset != null && Number.isFinite(daysSinceOnset)) {
    parts.push(`발병 후 ${daysSinceOnset}일`);
  }
  return parts.length ? parts.join(" · ") : "미입력";
}

export function AdminConsoleClient({
  adminName,
  organizations: initialOrganizations,
  organizationRequests: initialOrganizationRequests,
  patients,
  therapists: initialTherapists,
  validationSampleEntries,
  initialSection = "members",
}: Props) {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<InternalSection>(initialSection);
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [organizationRequests, setOrganizationRequests] = useState(initialOrganizationRequests);
  const [therapists, setTherapists] = useState(initialTherapists);
  const [organizationError, setOrganizationError] = useState("");
  const [organizationSuccess, setOrganizationSuccess] = useState("");
  const [therapistError, setTherapistError] = useState("");
  const [therapistSuccess, setTherapistSuccess] = useState("");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [reviewingTherapistId, setReviewingTherapistId] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientDetail, setSelectedPatientDetail] =
    useState<AdminPatientDetailPayload | null>(null);
  const [isLoadingPatientDetail, setIsLoadingPatientDetail] = useState(false);
  const [patientDetailError, setPatientDetailError] = useState("");

  const visibleOrganizationRequests = useMemo(
    () => organizationRequests.filter((item) => item.status !== "approved"),
    [organizationRequests],
  );
  const pendingTherapistRequests = useMemo(
    () =>
      therapists.filter(
        (item) => item.approvalState !== "approved" && item.approvalState !== "rejected",
      ),
    [therapists],
  );
  const approvedTherapists = useMemo(
    () => therapists.filter((item) => item.approvalState === "approved"),
    [therapists],
  );

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((item) =>
      [
        item.patientName,
        item.patientCode,
        item.loginId,
        item.patientPseudonymId,
        item.therapistName,
        item.therapistLoginId,
      ]
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
        status === "approved"
          ? prev.filter((item) => item.id !== requestId)
          : prev.map((item) =>
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

  const reviewTherapist = async (
    therapistUserId: string,
    status: "approved" | "rejected",
  ) => {
    setTherapistError("");
    setTherapistSuccess("");
    setReviewingTherapistId(therapistUserId);

    try {
      const response = await fetch("/api/admin/therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistUserId, status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error === "therapist_not_found"
            ? "치료사 계정을 찾지 못했습니다."
            : "치료사 승인 상태 변경에 실패했습니다.",
        );
      }

      setTherapists((prev) =>
        prev.map((item) =>
          item.therapistUserId === therapistUserId
            ? { ...item, approvalState: payload.reviewed.approvalState }
            : item,
        ),
      );
      setTherapistSuccess(
        status === "approved"
          ? "치료사 가입 신청을 승인했습니다."
          : "치료사 가입 신청을 반려했습니다.",
      );
    } catch (error) {
      setTherapistError(
        error instanceof Error ? error.message : "치료사 승인 처리에 실패했습니다.",
      );
    } finally {
      setReviewingTherapistId(null);
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

  const registrationRequestsSection = (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-amber-600" />
        <div>
          <h2 className="text-xl font-black text-slate-950">등록 요청</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            기관 등록 요청과 치료사 가입 요청을 여기서 승인 또는 반려합니다.
          </p>
        </div>
      </div>

      {(organizationError || organizationSuccess) && (
        <div className="mt-4 space-y-3">
          {organizationError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {organizationError}
            </div>
          ) : null}
          {organizationSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {organizationSuccess}
            </div>
          ) : null}
        </div>
      )}

      {(therapistError || therapistSuccess) && (
        <div className="mt-4 space-y-3">
          {therapistError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {therapistError}
            </div>
          ) : null}
          {therapistSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {therapistSuccess}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-black text-slate-700">기관명</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">의료기관 정보</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">담당자 / 관리자</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">법적 / 동의</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">상태</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleOrganizationRequests.length ? (
              visibleOrganizationRequests.map((item) => {
                const isPending = item.status === "pending";
                const isReviewing = reviewingRequestId === item.id;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{item.organizationName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.organizationType || "기관 유형 미입력"} · {item.roadAddress} {item.addressDetail}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        목적 {item.servicePurpose} / 대상 {item.targetPatients}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-700">
                        요양기관번호 {item.careInstitutionNumber || "-"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        사업자번호 {item.businessNumber || "-"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        의료기관 코드 {item.medicalInstitutionCode || "-"} / 진료과목 {item.medicalDepartments || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-700">
                        {item.contactName || "-"} / {item.contactTitle || "-"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.contactPhone || "-"} · {item.contactEmail || "-"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        관리자 ID {item.adminLoginEmail || "-"} · 2FA {item.twoFactorMethod === "sms" ? "문자" : "OTP"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-700">
                        사업자등록증 {item.businessLicenseFileName || "-"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        약관 {item.termsAgreed ? "동의" : "미동의"} / 개인정보 {item.privacyAgreed ? "동의" : "미동의"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        의료데이터 {item.medicalDataAgreed ? "동의" : "미동의"} / 환자데이터 {item.patientDataAgreed ? "동의" : "미동의"}
                      </p>
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
                  대기 중인 등록 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-black text-slate-900">치료사 가입 요청</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            승인 대기 중인 치료사 계정을 여기서 바로 승인 또는 반려합니다.
          </p>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-black text-slate-700">치료사명</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">의료 자격</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">소속 / 권한</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">연락 / 동의</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">상태</th>
              <th className="px-4 py-3 text-left font-black text-slate-700">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pendingTherapistRequests.length ? (
              pendingTherapistRequests.map((item) => (
                <tr key={item.therapistUserId}>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-900">{item.therapistName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {item.loginId ?? "-"} · {item.email ?? "이메일 미입력"}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    <p>{formatTherapistProfession(item.profession)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      자격번호 {item.licenseNumber ?? "-"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {item.licenseIssuedBy ?? "발급기관 미입력"} ·{" "}
                      {item.licenseIssuedDate ?? "발급일 미입력"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      파일 {item.licenseFileName ?? "미첨부"}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    <p>{item.organizationName ?? item.requestedOrganizationName ?? "기관 정보 없음"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatEmploymentStatus(item.employmentStatus)}
                      {item.department ? ` · ${item.department}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      역할 {formatAccessRole(item.accessRole)} · {formatTwoFactorMethod(item.twoFactorMethod)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {summarizeTherapistPermissions(item)}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    <p>{item.phone ?? "연락처 미입력"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      경력 {item.experienceYears != null ? `${item.experienceYears}년` : "미입력"}
                      {item.specialties ? ` · ${item.specialties}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      동의 {item.privacyAgreed ? "개인정보" : "개인정보 미동의"} /{" "}
                      {item.patientDataAccessAgreed ? "환자데이터" : "환자데이터 미동의"} /{" "}
                      {item.securityPolicyAgreed ? "보안정책" : "보안정책 미동의"} /{" "}
                      {item.confidentialityAgreed ? "비밀유지" : "비밀유지 미동의"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      목적 {item.servicePurpose ?? "-"} / 대상 {item.targetPatientTypes ?? "-"} / IRB {formatIrbParticipation(item.irbParticipation)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                      승인 대기
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => reviewTherapist(item.therapistUserId, "approved")}
                        disabled={reviewingTherapistId === item.therapistUserId}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewTherapist(item.therapistUserId, "rejected")}
                        disabled={reviewingTherapistId === item.therapistUserId}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        반려
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                >
                  대기 중인 치료사 가입 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </section>
  );

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
            ) : activeSection === "dashboard" ? (
              <section className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-sky-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">대시보드</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        등록 요청, 운영 현황, 사용량, 보안·검증을 한 페이지에서 순서대로 확인합니다.
                      </p>
                    </div>
                  </div>
                </section>

                {registrationRequestsSection}

                <section id="dashboard-operations" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-sky-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">운영 현황</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        운영 도구와 검증 현황을 대시보드 안에서 바로 확인합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1c2133] text-left text-white">
                          <th className="px-4 py-3 font-black">영역</th>
                          <th className="px-4 py-3 font-black">현재 상태</th>
                          <th className="px-4 py-3 font-black">요약</th>
                          <th className="px-4 py-3 font-black">바로가기</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 bg-white text-slate-700">
                          <td className="px-4 py-4 font-black text-slate-950">기관 관리</td>
                          <td className="px-4 py-4 font-semibold">{organizations.length}개 승인 기관</td>
                          <td className="px-4 py-4 font-semibold">회원가입에서 선택 가능한 기관 목록 관리</td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => setActiveSection("organizations")}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              열기
                            </button>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 bg-white text-slate-700">
                          <td className="px-4 py-4 font-black text-slate-950">치료사 관리</td>
                          <td className="px-4 py-4 font-semibold">{approvedTherapists.length}명 승인 완료</td>
                          <td className="px-4 py-4 font-semibold">소속 기관, 담당 사용자 수, 최근 로그인 확인</td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => setActiveSection("therapists")}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              열기
                            </button>
                          </td>
                        </tr>
                        <tr className="bg-white text-slate-700">
                          <td className="px-4 py-4 font-black text-slate-950">보안·검증</td>
                          <td className="px-4 py-4 font-semibold">
                            저장 실패 {usageSummary.failedCount}건 / 검증 연결 {usageSummary.vnvLinkedCount}건
                          </td>
                          <td className="px-4 py-4 font-semibold">내보내기와 상태 점검 항목 확인</td>
                          <td className="px-4 py-4">
                            <a
                              href="#dashboard-security"
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              이동
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="dashboard-usage" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-sky-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">사용량</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        사용자별 훈련 누적량과 최근 활동을 대시보드 안에서 확인합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-700">
                          <th className="px-4 py-3 font-black">구분</th>
                          <th className="px-4 py-3 font-black">수치</th>
                          <th className="px-4 py-3 font-black">설명</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">자가진단</td>
                          <td className="px-4 py-4 font-semibold">{usageSummary.selfCount}</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">누적 자가진단 기록</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">재활</td>
                          <td className="px-4 py-4 font-semibold">{usageSummary.rehabCount}</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">누적 재활 기록</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">노래</td>
                          <td className="px-4 py-4 font-semibold">{usageSummary.singCount}</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">누적 노래 기록</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">활동 사용자</td>
                          <td className="px-4 py-4 font-semibold">{latestActiveCount}</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">최근 활동 사용자 수</td>
                        </tr>
                      </tbody>
                    </table>
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

                <section id="dashboard-security" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">보안·검증 현황</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        저장 상태, 측정 품질, 검증 연결 수를 대시보드 안에서 확인합니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-700">
                          <th className="px-4 py-3 font-black">항목</th>
                          <th className="px-4 py-3 font-black">수치</th>
                          <th className="px-4 py-3 font-black">설명</th>
                          <th className="px-4 py-3 font-black">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">저장 실패</td>
                          <td className="px-4 py-4 font-semibold">{usageSummary.failedCount}건</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">즉시 확인이 필요한 저장 실패 결과</td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-500">-</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">측정 완료</td>
                          <td className="px-4 py-4 font-semibold">{usageSummary.measuredCount}건</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">measured 기준으로 저장된 결과</td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-500">-</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">검증 연결</td>
                          <td className="px-4 py-4 font-semibold">{usageSummary.vnvLinkedCount}건</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">V&V 메타데이터와 연결된 결과</td>
                          <td className="px-4 py-4">
                            <Link
                              href="/api/therapist/system/vnv-export"
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              V&amp;V 내보내기
                            </Link>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 font-black text-slate-950">AI 평가</td>
                          <td className="px-4 py-4 font-semibold">{validationSampleEntries.length}건</td>
                          <td className="px-4 py-4 font-semibold text-slate-600">최근 검토 가능한 평가 결과 수</td>
                          <td className="px-4 py-4">
                            <Link
                              href="/api/therapist/system/ai-evaluation-export"
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              AI 평가 내보내기
                            </Link>
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
                        <div className="grid gap-5">
                          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                기본 정보
                              </p>
                            </div>
                            <div className="space-y-3 p-5">
                              <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-lg font-black text-slate-950">
                                  {selectedPatientDetail.patient.patientName}
                                </span>
                                <span className="text-sm font-semibold text-slate-500">
                                  {selectedPatientDetail.patient.patientCode}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <InlineInfo label="로그인 ID" value={selectedPatientDetail.patient.loginId ?? "-"} />
                                <InlineInfo label="생년월일" value={selectedPatientDetail.patient.birthDate ?? "-"} />
                                <InlineInfo label="연락처" value={selectedPatientDetail.patient.phone ?? "-"} />
                                <InlineInfo label="결과 수" value={`${selectedPatientDetail.entries.length}건`} />
                                <InlineInfo
                                  label="최근 AQ"
                                  value={
                                    selectedPatientDetail.entries.length
                                      ? Number(selectedPatientDetail.entries[0]?.aq ?? 0).toFixed(1)
                                      : "-"
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  최근 결과 요약
                                </p>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                  최근 {Math.min(selectedPatientDetail.entries.length, 5)}건
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2 p-5">
                              {selectedPatientDetail.entries.slice(0, 5).map((entry) => {
                                const saveState = (entry as TrainingHistoryEntry & { dbSaveState?: string })
                                  .dbSaveState;
                                const modeLabel =
                                  entry.trainingMode === "sing"
                                    ? "노래"
                                    : entry.trainingMode === "rehab"
                                      ? `재활${entry.rehabStep ? ` Step ${entry.rehabStep}` : ""}`
                                      : "자가진단";
                                const measurementLabel =
                                  entry.measurementQuality?.overall === "measured"
                                    ? "측정 완료"
                                    : entry.measurementQuality?.overall === "partial"
                                      ? "부분 측정"
                                      : entry.measurementQuality?.overall === "demo"
                                        ? "데모"
                                        : "확인 필요";
                                const saveStateLabel =
                                  saveState === "saved"
                                    ? "저장 완료"
                                    : saveState === "failed"
                                      ? "저장 실패"
                                      : saveState === "temporary"
                                        ? "임시 저장"
                                        : "저장 상태 확인";
                                const trackingQuality = entry.facialAnalysisSnapshot?.trackingQuality;
                                const trackingLabel =
                                  typeof trackingQuality === "number" && trackingQuality > 0
                                    ? `얼굴 추적 품질 ${trackingQuality.toFixed(1)}`
                                    : "얼굴 추적 데이터 없음";
                                const noteCount = entry.measurementQuality?.notes?.length ?? 0;
                                const noteLabel =
                                  noteCount > 0 ? `품질 메모 ${noteCount}건` : "품질 메모 없음";

                                return (
                                  <div
                                    key={entry.historyId}
                                    className="space-y-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700">
                                        {modeLabel}
                                      </span>
                                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
                                        AQ {Number(entry.aq ?? 0).toFixed(1)}
                                      </span>
                                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                                        {measurementLabel}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
                                        {saveStateLabel}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-slate-600">
                                      <span>완료 시각 {formatDateTime(new Date(entry.completedAt).toISOString())}</span>
                                      <span className="text-slate-500">{trackingLabel}</span>
                                      <span className="text-slate-500">{noteLabel}</span>
                                    </div>
                                  </div>
                                );
                              })}
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
                          placeholder="이름, 코드, 로그인 ID, 담당 치료사 검색"
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
                            <th className="px-4 py-3 font-black">기본 정보</th>
                            <th className="px-4 py-3 font-black">임상 정보</th>
                            <th className="px-4 py-3 font-black">담당 치료사</th>
                            <th className="px-4 py-3 font-black">훈련 횟수</th>
                            <th className="px-4 py-3 font-black">최근 활동</th>
                            <th className="px-4 py-3 font-black">가입일</th>
                            <th className="px-4 py-3 font-black">상세</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPatients.length ? (
                            filteredPatients.map((item, index) => {
                              const age = formatPatientAgeFromBirth(item.birthDate);
                              return (
                                <tr
                                  key={item.patientId}
                                  className="border-b border-slate-200 bg-white align-top text-slate-700"
                                >
                                  <td className="px-4 py-4 font-semibold">
                                    {filteredPatients.length - index}
                                  </td>
                                  <td className="px-4 py-4 font-black text-slate-950">
                                    <p>{item.patientName}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      코드 {item.patientCode}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      로그인 {item.loginId ?? "-"}
                                    </p>
                                  </td>
                                  <td className="px-4 py-4 font-semibold">
                                    <p>
                                      생년월일 {formatPatientBirth(item.birthDate)}
                                      {age != null ? ` (${age}세)` : ""}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      성별 {formatPatientSex(item.sex)} · 교육{" "}
                                      {formatEducationYears(item.educationYears)}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      연락처 {item.phone ?? "미입력"}
                                    </p>
                                  </td>
                                  <td className="px-4 py-4 font-semibold">
                                    <p>
                                      {formatOnsetSummary(item.onsetDate, item.daysSinceOnset)}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      편마비 {formatHemiplegia(item.hemiplegia)} · 반맹{" "}
                                      {formatHemianopsia(item.hemianopsia)}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      손잡이 {formatHand(item.hand)}
                                    </p>
                                  </td>
                                  <td className="px-4 py-4 font-semibold">
                                    {item.therapistName ? (
                                      <div className="flex flex-col">
                                        <span className="font-black text-slate-900">
                                          {item.therapistName}
                                        </span>
                                        {item.therapistLoginId ? (
                                          <span className="mt-1 text-xs font-semibold text-slate-500">
                                            {item.therapistLoginId}
                                          </span>
                                        ) : null}
                                        {item.therapistOrganizationName ? (
                                          <span className="mt-1 text-xs font-semibold text-slate-500">
                                            {item.therapistOrganizationName}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-semibold text-slate-400">
                                        미배정
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 font-semibold">
                                    <p>자가 {item.selfAssessmentCount}회</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      재활 {item.rehabCount}회
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      노래 {item.singCount}회
                                    </p>
                                  </td>
                                  <td className="px-4 py-4 font-semibold">
                                    {formatDateTime(item.latestActivityAt)}
                                  </td>
                                  <td className="px-4 py-4 font-semibold">
                                    {formatDateTime(item.createdAt)}
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
                              );
                            })
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
                    <h2 className="text-xl font-black text-slate-950">치료사 관리</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      등록된 치료사 계정과 담당 사용자 수를 관리자 화면 내부에서 확인합니다.
                    </p>
                  </div>
                </div>

                {(therapistError || therapistSuccess) && (
                  <div className="px-6 pt-5">
                    {therapistError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                        {therapistError}
                      </div>
                    ) : null}
                    {therapistSuccess ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                        {therapistSuccess}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="overflow-x-auto px-6 py-5">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#1c2133] text-left text-white">
                        <th className="px-4 py-3 font-black">번호</th>
                        <th className="px-4 py-3 font-black">치료사명</th>
                        <th className="px-4 py-3 font-black">의료 자격</th>
                        <th className="px-4 py-3 font-black">소속 / 권한</th>
                        <th className="px-4 py-3 font-black">연락 / 동의</th>
                        <th className="px-4 py-3 font-black">승인 상태</th>
                        <th className="px-4 py-3 font-black">담당 사용자</th>
                        <th className="px-4 py-3 font-black">최근 로그인</th>
                        <th className="px-4 py-3 font-black">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedTherapists.length ? (
                        approvedTherapists.map((item, index) => (
                          <tr
                            key={item.therapistUserId}
                            className="border-b border-slate-200 bg-white text-slate-700"
                          >
                            <td className="px-4 py-4 font-semibold">
                              {approvedTherapists.length - index}
                            </td>
                            <td className="px-4 py-4 font-black text-slate-950">
                              <p>{item.therapistName}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {item.loginId ?? "-"} · {item.email ?? "이메일 미입력"}
                              </p>
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              <p>{formatTherapistProfession(item.profession)}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                자격번호 {item.licenseNumber ?? "-"}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {item.licenseIssuedBy ?? "발급기관 미입력"} ·{" "}
                                {item.licenseIssuedDate ?? "발급일 미입력"}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-700">
                                {item.organizationName ?? item.requestedOrganizationName ?? "기관 정보 없음"}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {formatEmploymentStatus(item.employmentStatus)}
                                {item.department ? ` · ${item.department}` : ""}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                역할 {formatAccessRole(item.accessRole)} · {formatTwoFactorMethod(item.twoFactorMethod)}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {summarizeTherapistPermissions(item)}
                              </p>
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-700">
                              <p>{item.phone ?? "연락처 미입력"}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                경력 {item.experienceYears != null ? `${item.experienceYears}년` : "미입력"}
                                {item.specialties ? ` · ${item.specialties}` : ""}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                동의 {item.privacyAgreed ? "개인정보" : "개인정보 미동의"} /{" "}
                                {item.patientDataAccessAgreed ? "환자데이터" : "환자데이터 미동의"} /{" "}
                                {item.securityPolicyAgreed ? "보안정책" : "보안정책 미동의"} /{" "}
                                {item.confidentialityAgreed ? "비밀유지" : "비밀유지 미동의"}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                목적 {item.servicePurpose ?? "-"} / 대상 {item.targetPatientTypes ?? "-"} / IRB {formatIrbParticipation(item.irbParticipation)}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                승인 완료
                              </span>
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {item.assignedPatientCount}명
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {formatDateTime(item.lastLoginAt)}
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-xs font-semibold text-slate-400">
                                처리 완료
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                          >
                            승인된 치료사 계정이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-5">
                    <Stethoscope className="h-5 w-5 text-indigo-600" />
                    <div>
                      <h2 className="text-xl font-black text-slate-950">치료사 관리</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        등록된 치료사 계정과 담당 사용자 수를 관리자 화면 내부에서 확인합니다.
                      </p>
                    </div>
                  </div>

                  {(therapistError || therapistSuccess) && (
                    <div className="px-6 pt-5">
                      {therapistError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                          {therapistError}
                        </div>
                      ) : null}
                      {therapistSuccess ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                          {therapistSuccess}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="overflow-x-auto px-6 py-5">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-[#1c2133] text-left text-white">
                          <th className="px-4 py-3 font-black">번호</th>
                          <th className="px-4 py-3 font-black">치료사명</th>
                          <th className="px-4 py-3 font-black">의료 자격</th>
                          <th className="px-4 py-3 font-black">소속 / 권한</th>
                          <th className="px-4 py-3 font-black">연락 / 동의</th>
                          <th className="px-4 py-3 font-black">승인 상태</th>
                          <th className="px-4 py-3 font-black">담당 사용자</th>
                          <th className="px-4 py-3 font-black">최근 로그인</th>
                          <th className="px-4 py-3 font-black">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedTherapists.length ? (
                          approvedTherapists.map((item, index) => (
                            <tr
                              key={item.therapistUserId}
                              className="border-b border-slate-200 bg-white text-slate-700"
                            >
                              <td className="px-4 py-4 font-semibold">
                                {approvedTherapists.length - index}
                              </td>
                              <td className="px-4 py-4 font-black text-slate-950">
                                <p>{item.therapistName}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {item.loginId ?? "-"} · {item.email ?? "이메일 미입력"}
                                </p>
                              </td>
                              <td className="px-4 py-4 font-semibold">
                                <p>{formatTherapistProfession(item.profession)}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  자격번호 {item.licenseNumber ?? "-"}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {item.licenseIssuedBy ?? "발급기관 미입력"} ·{" "}
                                  {item.licenseIssuedDate ?? "발급일 미입력"}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-semibold text-slate-700">
                                  {item.organizationName ?? item.requestedOrganizationName ?? "기관 정보 없음"}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {formatEmploymentStatus(item.employmentStatus)}
                                  {item.department ? ` · ${item.department}` : ""}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  역할 {formatAccessRole(item.accessRole)} · {formatTwoFactorMethod(item.twoFactorMethod)}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {summarizeTherapistPermissions(item)}
                                </p>
                              </td>
                              <td className="px-4 py-4 font-semibold text-slate-700">
                                <p>{item.phone ?? "연락처 미입력"}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  경력 {item.experienceYears != null ? `${item.experienceYears}년` : "미입력"}
                                  {item.specialties ? ` · ${item.specialties}` : ""}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  동의 {item.privacyAgreed ? "개인정보" : "개인정보 미동의"} /{" "}
                                  {item.patientDataAccessAgreed ? "환자데이터" : "환자데이터 미동의"} /{" "}
                                  {item.securityPolicyAgreed ? "보안정책" : "보안정책 미동의"} /{" "}
                                  {item.confidentialityAgreed ? "비밀유지" : "비밀유지 미동의"}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  목적 {item.servicePurpose ?? "-"} / 대상 {item.targetPatientTypes ?? "-"} / IRB {formatIrbParticipation(item.irbParticipation)}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
                                  승인 완료
                                </span>
                              </td>
                              <td className="px-4 py-4 font-semibold">
                                {item.assignedPatientCount}명
                              </td>
                              <td className="px-4 py-4 font-semibold">
                                {formatDateTime(item.lastLoginAt)}
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-xs font-semibold text-slate-400">
                                  처리 완료
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                            >
                              승인된 치료사 계정이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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

function InlineInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
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
