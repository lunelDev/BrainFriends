"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, UserRound } from "lucide-react";
import type { OrganizationCatalogEntry } from "@/lib/organizations/catalog";
import OrganizationBasicFields, {
  validateOrganizationBasicFields,
} from "@/components/organization/OrganizationBasicFields";

type Gender = "M" | "F" | "U";
type Hemiplegia = "Y" | "N";
type Hemianopsia = "NONE" | "RIGHT" | "LEFT";
type SignupRole = "patient" | "therapist";
type TherapistProfession = "speech" | "occupational" | "physical" | "cognitive" | "other";
type TherapistEmploymentStatus = "employed" | "contract" | "freelance";
type TherapistAccessRole = "manager" | "therapist" | "observer";
type TherapistTwoFactorMethod = "otp" | "sms";
type TherapistIrbParticipation = "none" | "planned" | "approved";
type TherapistInstitutionMode = "existing" | "solo";
type TherapistOption = {
  therapistUserId: string;
  therapistName: string;
  loginId: string | null;
  profession: TherapistProfession | null;
};

type SignupForm = {
  userRole: SignupRole;
  organizationQuery: string;
  organizationId: string;
  therapistUserId: string;
  loginId: string;
  name: string;
  birthDate: string;
  phoneLast4: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  educationYears: string;
  gender: Gender;
  onsetDate: string;
  hemiplegia: Hemiplegia;
  hemianopsia: Hemianopsia;
  profession: TherapistProfession;
  institutionMode: TherapistInstitutionMode;
  licenseNumber: string;
  licenseFileName: string;
  licenseFileDataUrl: string;
  licenseIssuedBy: string;
  licenseIssuedDate: string;
  employmentStatus: TherapistEmploymentStatus;
  department: string;
  twoFactorMethod: TherapistTwoFactorMethod;
  accessRole: TherapistAccessRole;
  canViewPatients: boolean;
  canEditPatientData: boolean;
  canEnterEvaluation: boolean;
  experienceYears: string;
  specialties: string;
  servicePurpose: string;
  targetPatientTypes: string;
  dataConsentScope: string;
  irbParticipation: TherapistIrbParticipation;
  privacyAgreed: boolean;
  patientDataAccessAgreed: boolean;
  securityPolicyAgreed: boolean;
  confidentialityAgreed: boolean;
  soloOrganizationName: string;
  soloBusinessNumber: string;
  soloRepresentativeName: string;
  soloOrganizationType: string;
  soloCareInstitutionNumber: string;
  soloOrganizationPhone: string;
  soloPostalCode: string;
  soloRoadAddress: string;
  soloAddressDetail: string;
  soloBusinessLicenseFileName: string;
  soloBusinessLicenseFileDataUrl: string;
};

function getTodayLocalDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function isValidDateInput(value: string, maxDate?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  const isCalendarDate =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;

  if (!isCalendarDate) return false;
  if (maxDate && value > maxDate) return false;
  return true;
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function getProfessionLabel(value: TherapistProfession | null | undefined) {
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
      return "치료사";
  }
}

function isValidEmailInput(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLoginId, setIsCheckingLoginId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReadingTherapistLicense, setIsReadingTherapistLicense] = useState(false);
  const [hasChosenRole, setHasChosenRole] = useState(false);
  const [isOrganizationDropdownOpen, setIsOrganizationDropdownOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationCatalogEntry[]>([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationCatalogEntry | null>(null);
  const [therapistOptions, setTherapistOptions] = useState<TherapistOption[]>([]);
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(false);
  const [loginIdStatus, setLoginIdStatus] = useState<{
    state: "idle" | "valid" | "invalid" | "available" | "taken";
    message: string;
    checkedValue: string;
  }>({
    state: "idle",
    message: "",
    checkedValue: "",
  });
  const [form, setForm] = useState<SignupForm>({
    userRole: "patient",
    organizationQuery: "",
    organizationId: "",
    therapistUserId: "",
    loginId: "",
    name: "",
    birthDate: "",
    phoneLast4: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    educationYears: "",
    gender: "U",
    onsetDate: "",
    hemiplegia: "N",
    hemianopsia: "NONE",
    profession: "speech",
    institutionMode: "existing",
    licenseNumber: "",
    licenseFileName: "",
    licenseFileDataUrl: "",
    licenseIssuedBy: "",
    licenseIssuedDate: "",
    employmentStatus: "employed",
    department: "",
    twoFactorMethod: "otp",
    accessRole: "therapist",
    canViewPatients: true,
    canEditPatientData: false,
    canEnterEvaluation: true,
    experienceYears: "",
    specialties: "",
    servicePurpose: "",
    targetPatientTypes: "",
    dataConsentScope: "",
    irbParticipation: "none",
    privacyAgreed: false,
    patientDataAccessAgreed: false,
    securityPolicyAgreed: false,
    confidentialityAgreed: false,
    soloOrganizationName: "",
    soloBusinessNumber: "",
    soloRepresentativeName: "",
    soloOrganizationType: "",
    soloCareInstitutionNumber: "",
    soloOrganizationPhone: "",
    soloPostalCode: "",
    soloRoadAddress: "",
    soloAddressDetail: "",
    soloBusinessLicenseFileName: "",
    soloBusinessLicenseFileDataUrl: "",
  });

  const todayLocalDate = getTodayLocalDate();
  const passwordMatchState =
    !form.password && !form.confirmPassword
      ? "idle"
      : form.password === form.confirmPassword
        ? "match"
        : "mismatch";

  useEffect(() => {
    void fetch("/api/organizations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.organizations)) {
          setOrganizations(payload.organizations);
        }
      });
  }, []);

  useEffect(() => {
    if (form.userRole !== "patient" || !form.organizationId) {
      setTherapistOptions([]);
      setIsLoadingTherapists(false);
      return;
    }

    setIsLoadingTherapists(true);
    void fetch(
      `/api/organizations/${encodeURIComponent(form.organizationId)}/therapists`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      })
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.therapists)) {
          setTherapistOptions(payload.therapists);
          setIsLoadingTherapists(false);
          return;
        }
        setTherapistOptions([]);
        setIsLoadingTherapists(false);
      })
      .catch(() => {
        setTherapistOptions([]);
        setIsLoadingTherapists(false);
      });
  }, [form.organizationId, form.userRole]);

  const filteredOrganizations = useMemo(() => {
    const query = form.organizationQuery.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter((item) =>
      [item.name, item.code, item.address]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [form.organizationQuery, organizations]);

  const therapistNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of therapistOptions) {
      const name = String(item.therapistName ?? "").trim();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [therapistOptions]);

  const isTherapistSignup = form.userRole === "therapist";

  const updateForm = (key: keyof SignupForm, value: string) => {
    if (key === "loginId") {
      setLoginIdStatus({
        state: "idle",
        message: "",
        checkedValue: "",
      });
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateBooleanField = (
    key:
      | "canViewPatients"
      | "canEditPatientData"
      | "canEnterEvaluation"
      | "privacyAgreed"
      | "patientDataAccessAgreed"
      | "securityPolicyAgreed"
      | "confidentialityAgreed",
    value: boolean,
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTherapistLicenseUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({
        ...prev,
        licenseFileName: "",
        licenseFileDataUrl: "",
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("면허증/자격증 파일은 5MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setError("");
    setIsReadingTherapistLicense(true);
    try {
      const dataUrl = await toDataUrl(file);
      setForm((prev) => ({
        ...prev,
        licenseFileName: file.name,
        licenseFileDataUrl: dataUrl,
      }));
    } catch {
      setError("면허증/자격증 파일을 읽지 못했습니다.");
      event.target.value = "";
    } finally {
      setIsReadingTherapistLicense(false);
    }
  };

  const selectRole = (role: SignupRole) => {
    setHasChosenRole(true);
    setError("");
    setSelectedOrganization(null);
    setTherapistOptions([]);
    setIsLoadingTherapists(false);
    setIsOrganizationDropdownOpen(false);
    setForm((prev) => ({
      ...prev,
      userRole: role,
      organizationQuery: "",
      organizationId: "",
      therapistUserId: "",
      phone: role === "therapist" ? prev.phone : "",
      email: role === "therapist" ? prev.email : "",
      educationYears: role === "therapist" ? "" : prev.educationYears,
      gender: role === "therapist" ? "U" : prev.gender,
      onsetDate: role === "therapist" ? "" : prev.onsetDate,
      hemiplegia: role === "therapist" ? "N" : prev.hemiplegia,
      hemianopsia: role === "therapist" ? "NONE" : prev.hemianopsia,
      profession: role === "therapist" ? prev.profession : "speech",
      institutionMode: role === "therapist" ? prev.institutionMode : "existing",
      licenseNumber: role === "therapist" ? prev.licenseNumber : "",
      licenseFileName: role === "therapist" ? prev.licenseFileName : "",
      licenseFileDataUrl: role === "therapist" ? prev.licenseFileDataUrl : "",
      licenseIssuedBy: role === "therapist" ? prev.licenseIssuedBy : "",
      licenseIssuedDate: role === "therapist" ? prev.licenseIssuedDate : "",
      employmentStatus: role === "therapist" ? prev.employmentStatus : "employed",
      department: role === "therapist" ? prev.department : "",
      twoFactorMethod: role === "therapist" ? prev.twoFactorMethod : "otp",
      accessRole: role === "therapist" ? prev.accessRole : "therapist",
      canViewPatients: role === "therapist" ? prev.canViewPatients : true,
      canEditPatientData: role === "therapist" ? prev.canEditPatientData : false,
      canEnterEvaluation: role === "therapist" ? prev.canEnterEvaluation : true,
      experienceYears: role === "therapist" ? prev.experienceYears : "",
      specialties: role === "therapist" ? prev.specialties : "",
      servicePurpose: role === "therapist" ? prev.servicePurpose : "",
      targetPatientTypes: role === "therapist" ? prev.targetPatientTypes : "",
      dataConsentScope: role === "therapist" ? prev.dataConsentScope : "",
      irbParticipation: role === "therapist" ? prev.irbParticipation : "none",
      privacyAgreed: role === "therapist" ? prev.privacyAgreed : false,
      patientDataAccessAgreed: role === "therapist" ? prev.patientDataAccessAgreed : false,
      securityPolicyAgreed: role === "therapist" ? prev.securityPolicyAgreed : false,
      confidentialityAgreed: role === "therapist" ? prev.confidentialityAgreed : false,
      soloOrganizationName: role === "therapist" ? prev.soloOrganizationName : "",
      soloBusinessNumber: role === "therapist" ? prev.soloBusinessNumber : "",
      soloRepresentativeName: role === "therapist" ? prev.soloRepresentativeName : "",
      soloOrganizationType: role === "therapist" ? prev.soloOrganizationType : "",
      soloCareInstitutionNumber: role === "therapist" ? prev.soloCareInstitutionNumber : "",
      soloOrganizationPhone: role === "therapist" ? prev.soloOrganizationPhone : "",
      soloPostalCode: role === "therapist" ? prev.soloPostalCode : "",
      soloRoadAddress: role === "therapist" ? prev.soloRoadAddress : "",
      soloAddressDetail: role === "therapist" ? prev.soloAddressDetail : "",
      soloBusinessLicenseFileName: role === "therapist" ? prev.soloBusinessLicenseFileName : "",
      soloBusinessLicenseFileDataUrl: role === "therapist" ? prev.soloBusinessLicenseFileDataUrl : "",
    }));
  };

  const selectOrganization = (organization: OrganizationCatalogEntry) => {
    setSelectedOrganization(organization);
    setIsOrganizationDropdownOpen(false);
    setForm((prev) => ({
      ...prev,
      organizationId: organization.id,
      organizationQuery: organization.name,
      therapistUserId: "",
    }));
  };

  const clearOrganizationSelection = () => {
    setSelectedOrganization(null);
    setTherapistOptions([]);
    setIsLoadingTherapists(false);
    setIsOrganizationDropdownOpen(true);
    setForm((prev) => ({
      ...prev,
      organizationQuery: "",
      organizationId: "",
      therapistUserId: "",
    }));
  };

  const handleSoloBusinessLicenseUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((prev) => ({
        ...prev,
        soloBusinessLicenseFileName: "",
        soloBusinessLicenseFileDataUrl: "",
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("사업자등록증 파일은 5MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setError("");
    setIsReadingTherapistLicense(true);
    try {
      const dataUrl = await toDataUrl(file);
      setForm((prev) => ({
        ...prev,
        soloBusinessLicenseFileName: file.name,
        soloBusinessLicenseFileDataUrl: dataUrl,
      }));
    } catch {
      setError("사업자등록증 파일을 읽지 못했습니다.");
      event.target.value = "";
    } finally {
      setIsReadingTherapistLicense(false);
    }
  };

  const checkLoginId = async () => {
    const normalized = form.loginId.trim().toLowerCase();
    if (!/^[a-z0-9_-]{4,20}$/.test(normalized)) {
      setLoginIdStatus({
        state: "invalid",
        message: "아이디는 영문 소문자, 숫자, `_`, `-`로 4~20자여야 합니다.",
        checkedValue: normalized,
      });
      return;
    }

    setIsCheckingLoginId(true);
    try {
      const response = await fetch(
        `/api/auth/check-login-id?loginId=${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setLoginIdStatus({
          state: "invalid",
          message: "아이디 확인에 실패했습니다.",
          checkedValue: normalized,
        });
        return;
      }

      if (payload.reason === "invalid_format") {
        setLoginIdStatus({
          state: "invalid",
          message: "아이디는 영문 소문자, 숫자, `_`, `-`로 4~20자여야 합니다.",
          checkedValue: normalized,
        });
        return;
      }

      setLoginIdStatus({
        state: payload.available ? "available" : "taken",
        message: payload.available
          ? "사용 가능한 아이디입니다."
          : "이미 사용 중인 아이디입니다.",
        checkedValue: normalized,
      });
    } finally {
      setIsCheckingLoginId(false);
    }
  };

  const submit = async () => {
    setError("");

    if (!form.name.trim() || !form.loginId.trim()) {
      setError("이름과 아이디를 확인해 주세요.");
      return;
    }

    if (!isValidDateInput(form.birthDate, todayLocalDate)) {
      setError("생년월일을 `YYYY-MM-DD` 형식으로 정확히 입력해 주세요.");
      return;
    }

    if (form.password.length < 6 || form.password !== form.confirmPassword) {
      setError("비밀번호는 6자 이상이어야 하며, 확인 비밀번호와 일치해야 합니다.");
      return;
    }

    if (
      form.userRole === "therapist" &&
      form.institutionMode === "existing" &&
      !form.organizationId
    ) {
      setError("소속 병원을 선택해 주세요.");
      return;
    }

    const normalizedLoginId = form.loginId.trim().toLowerCase();
    if (
      loginIdStatus.state !== "available" ||
      loginIdStatus.checkedValue !== normalizedLoginId
    ) {
      setError("아이디 중복 확인을 완료해 주세요.");
      return;
    }

    if (form.birthDate > todayLocalDate) {
      setError("생년월일은 오늘 이후 날짜를 선택할 수 없습니다.");
      return;
    }

    if (isTherapistSignup) {
      if (!isValidPhoneInput(form.phone)) {
        setError("휴대폰 번호를 정확히 입력해 주세요.");
        return;
      }

      if (!isValidEmailInput(form.email)) {
        setError("이메일 주소를 정확히 입력해 주세요.");
        return;
      }

      if (form.institutionMode === "existing" && !form.organizationId) {
        setError("소속 기관을 선택해 주세요.");
        return;
      }

      if (form.institutionMode === "solo") {
        const soloError = validateOrganizationBasicFields({
          organizationName: form.soloOrganizationName,
          businessNumber: form.soloBusinessNumber,
          representativeName: form.soloRepresentativeName,
          organizationType: form.soloOrganizationType,
          careInstitutionNumber: form.soloCareInstitutionNumber,
          businessLicenseFileName: form.soloBusinessLicenseFileName,
          businessLicenseFileDataUrl: form.soloBusinessLicenseFileDataUrl,
          organizationPhone: form.soloOrganizationPhone,
          postalCode: form.soloPostalCode,
          roadAddress: form.soloRoadAddress,
          addressDetail: form.soloAddressDetail,
        });
        if (soloError) {
          setError(soloError);
          return;
        }
      }

      if (
        !form.profession ||
        !form.licenseNumber.trim() ||
        !form.licenseFileName.trim() ||
        !form.licenseIssuedBy.trim() ||
        !form.licenseIssuedDate ||
        !isValidDateInput(form.licenseIssuedDate, todayLocalDate)
      ) {
        setError("치료사 자격 정보를 모두 입력해 주세요.");
        return;
      }

      if (
        !form.privacyAgreed ||
        !form.patientDataAccessAgreed ||
        !form.securityPolicyAgreed ||
        !form.confidentialityAgreed
      ) {
        setError("치료사 가입에 필요한 필수 동의 항목을 모두 체크해 주세요.");
        return;
      }
    } else {
      if (!form.organizationId) {
        setError("기관을 선택해 주세요.");
        return;
      }

      if (!form.therapistUserId) {
        setError("담당 치료사를 선택해 주세요.");
        return;
      }

      if (!/^\d{4}$/.test(form.phoneLast4)) {
        setError("전화번호 뒤 4자리를 확인해 주세요.");
        return;
      }

      if (!form.educationYears.trim()) {
        setError("교육년수를 입력해 주세요.");
        return;
      }

      if (form.gender === "U") {
        setError("성별을 선택해 주세요.");
        return;
      }

      if (!form.onsetDate || !isValidDateInput(form.onsetDate, todayLocalDate)) {
        setError("발병일을 정확히 입력해 주세요.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const therapistPhoneDigits = form.phone.replace(/\D/g, "");
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRole: form.userRole,
          organizationId:
            form.userRole === "patient"
              ? form.organizationId
              : form.userRole === "therapist" && form.institutionMode === "existing"
              ? form.organizationId
              : undefined,
          therapistUserId: form.userRole === "patient" ? form.therapistUserId : undefined,
          institutionMode:
            form.userRole === "therapist" ? form.institutionMode : undefined,
          loginId: form.loginId,
          name: form.name,
          birthDate: form.birthDate,
          phoneLast4: form.userRole === "patient" ? form.phoneLast4 : therapistPhoneDigits.slice(-4),
          phone: form.userRole === "therapist" ? form.phone : undefined,
          email: form.userRole === "therapist" ? form.email : undefined,
          password: form.password,
          educationYears:
            form.userRole === "patient" && form.educationYears.trim()
              ? Number(form.educationYears)
              : undefined,
          onsetDate: form.userRole === "patient" ? form.onsetDate : undefined,
          hemiplegia: form.userRole === "patient" ? form.hemiplegia : undefined,
          hemianopsia:
            form.userRole === "patient" ? form.hemianopsia : undefined,
          gender: form.gender !== "U" ? form.gender : undefined,
          profession: form.userRole === "therapist" ? form.profession : undefined,
          licenseNumber:
            form.userRole === "therapist" ? form.licenseNumber : undefined,
          licenseFileName:
            form.userRole === "therapist" ? form.licenseFileName : undefined,
          licenseFileDataUrl:
            form.userRole === "therapist" ? form.licenseFileDataUrl : undefined,
          licenseIssuedBy:
            form.userRole === "therapist" ? form.licenseIssuedBy : undefined,
          licenseIssuedDate:
            form.userRole === "therapist" ? form.licenseIssuedDate : undefined,
          employmentStatus:
            form.userRole === "therapist" ? form.employmentStatus : undefined,
          department: form.userRole === "therapist" ? form.department : undefined,
          twoFactorMethod:
            form.userRole === "therapist" ? form.twoFactorMethod : undefined,
          accessRole: form.userRole === "therapist" ? form.accessRole : undefined,
          canViewPatients:
            form.userRole === "therapist" ? form.canViewPatients : undefined,
          canEditPatientData:
            form.userRole === "therapist" ? form.canEditPatientData : undefined,
          canEnterEvaluation:
            form.userRole === "therapist" ? form.canEnterEvaluation : undefined,
          experienceYears:
            form.userRole === "therapist" && form.experienceYears
              ? Number(form.experienceYears)
              : undefined,
          specialties: form.userRole === "therapist" ? form.specialties : undefined,
          servicePurpose:
            form.userRole === "therapist" ? form.servicePurpose : undefined,
          targetPatientTypes:
            form.userRole === "therapist" ? form.targetPatientTypes : undefined,
          dataConsentScope:
            form.userRole === "therapist" ? form.dataConsentScope : undefined,
          irbParticipation:
            form.userRole === "therapist" ? form.irbParticipation : undefined,
          privacyAgreed:
            form.userRole === "therapist" ? form.privacyAgreed : undefined,
          patientDataAccessAgreed:
            form.userRole === "therapist" ? form.patientDataAccessAgreed : undefined,
          securityPolicyAgreed:
            form.userRole === "therapist" ? form.securityPolicyAgreed : undefined,
          confidentialityAgreed:
            form.userRole === "therapist" ? form.confidentialityAgreed : undefined,
          soloInstitution:
            form.userRole === "therapist" && form.institutionMode === "solo"
              ? {
                  organizationName: form.soloOrganizationName,
                  businessNumber: form.soloBusinessNumber,
                  representativeName: form.soloRepresentativeName,
                  organizationType: form.soloOrganizationType,
                  careInstitutionNumber: form.soloCareInstitutionNumber,
                  organizationPhone: form.soloOrganizationPhone,
                  postalCode: form.soloPostalCode,
                  roadAddress: form.soloRoadAddress,
                  addressDetail: form.soloAddressDetail,
                  businessLicenseFileName: form.soloBusinessLicenseFileName,
                  businessLicenseFileDataUrl: form.soloBusinessLicenseFileDataUrl,
                }
              : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("[signup] failed", payload);
        setError(
          payload?.error === "account_already_exists"
            ? "이미 등록된 회원입니다."
            : payload?.error === "duplicate_identity"
              ? "이름과 휴대폰 뒷자리가 동일한 계정이 이미 존재합니다. 본인 계정 여부를 확인해 주세요."
              : payload?.error === "organization_already_exists"
                ? "같은 이름·사업자번호·요양기관번호의 기관이 이미 등록 또는 신청 중입니다."
                : payload?.error === "invalid_organization"
                  ? "선택한 병원 정보를 다시 확인해 주세요."
                  : payload?.error === "invalid_therapist"
                    ? "선택한 치료사 정보를 다시 확인해 주세요."
                    : payload?.error === "invalid_signup_payload"
                      ? "입력한 가입 정보가 올바른지 다시 확인해 주세요."
                      : payload?.error === "invalid_request_payload"
                        ? "기관 등록 정보가 누락되었거나 잘못되었습니다."
                        : payload?.error === "failed_to_create_account"
                          ? "기관 소속 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
                          : `회원가입에 실패했습니다. (${String(payload?.error ?? "server_error")})`,
        );
        return;
      }

      const nextUrl =
        form.userRole === "therapist"
          ? "/?created=1&role=therapist"
          : "/?created=1&role=patient";

      if (typeof window !== "undefined") {
        window.location.assign(nextUrl);
        return;
      }

      router.replace(nextUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff8f1_0%,#f4f7fb_100%)] px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-[36px] border border-orange-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              회원가입
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              기관 등록은 관리자 화면에서 진행하며, 개인 회원은 등록된 기관을 선택해 가입합니다.
            </p>
          </div>
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-slate-700">
            로그인으로
          </Link>
        </div>

        {!hasChosenRole ? (
          <section className="mt-10 space-y-8">
            <div className="text-center">
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900">
                가입하실 회원 종류를 선택해 주세요.
              </h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                등록된 병원(기관)에 소속될 일반 회원 또는 치료사 개인 계정을 만드는
                화면입니다.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => selectRole("patient")}
                className="group rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-700">
                  <UserRound className="h-10 w-10" />
                </div>
                 <h3 className="mt-6 text-2xl font-black text-slate-900">
                   일반 회원가입
                 </h3>
                 <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                  기관과 담당 치료사를 선택한 뒤 기본 정보를 입력해 가입합니다.
                 </p>
                <span className="mt-8 inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-slate-500 px-6 text-sm font-black text-white transition group-hover:bg-slate-600">
                  일반 가입하기
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectRole("therapist")}
                className="group rounded-[28px] border-2 border-sky-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
              >
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full border border-sky-100 bg-slate-50 text-sky-700">
                  <Building2 className="h-10 w-10" />
                </div>
                 <h3 className="mt-6 text-2xl font-black text-slate-900">
                   치료사 회원가입
                 </h3>
                 <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                  기본 정보와 자격 서류를 등록하고 승인 대기 상태로 가입합니다.
                 </p>
                <span className="mt-8 inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-[#0b66c3] px-6 text-sm font-black text-white transition group-hover:bg-[#08539f]">
                  치료사 가입하기
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </div>

            <div className="rounded-[28px] border border-orange-200 bg-orange-50 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">기업 / 기관 가입</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    기관은 일반 회원이나 치료사처럼 바로 가입하지 않고, 먼저 기관 등록 요청을
                    접수한 뒤 관리자 승인 후 검색/선택할 수 있습니다.
                  </p>
                </div>
                <Link
                  href="/organization-register"
                  className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-2xl border border-orange-300 bg-white px-6 text-sm font-black text-orange-700 transition hover:bg-orange-100"
                >
                  기업 / 기관 가입하기
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-8 flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  선택한 회원 종류
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {form.userRole === "therapist" ? "치료사 회원가입" : "일반 회원가입"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHasChosenRole(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                회원 종류 다시 선택
              </button>
            </div>

            <div className="mt-6 space-y-8">
              <SectionCard
                title="아이디 정보"
                description="로그인에 사용할 아이디와 비밀번호를 입력해 주세요."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="아이디 *">
                    <div className="flex gap-2">
                      <input
                        className="input-style"
                        value={form.loginId}
                        onChange={(e) =>
                          updateForm("loginId", e.target.value.replace(/\s/g, ""))
                        }
                        placeholder="로그인 아이디"
                      />
                      <button
                        type="button"
                        onClick={checkLoginId}
                        disabled={isCheckingLoginId}
                        className="shrink-0 rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-black text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {isCheckingLoginId ? "확인 중" : "중복 확인"}
                      </button>
                    </div>
                    {loginIdStatus.message ? (
                      <p
                        className={`mt-2 text-xs font-bold ${
                          loginIdStatus.state === "available"
                            ? "text-emerald-600"
                            : loginIdStatus.state === "taken" ||
                                loginIdStatus.state === "invalid"
                              ? "text-red-500"
                              : "text-slate-500"
                        }`}
                      >
                        {loginIdStatus.message}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-slate-400">
                        영문 소문자, 숫자, `_`, `-` 사용 가능 / 4~20자
                      </p>
                    )}
                  </Field>

                  <div />

                  <Field label="비밀번호 *">
                    <div className="relative">
                      <input
                        className="input-style pr-20"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => updateForm("password", e.target.value)}
                        placeholder="6자 이상"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500"
                      >
                        {showPassword ? "숨기기" : "보기"}
                      </button>
                    </div>
                  </Field>

                  <Field label="비밀번호 확인 *">
                    <div className="relative">
                      <input
                        className="input-style pr-20"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) => updateForm("confirmPassword", e.target.value)}
                        placeholder="비밀번호 확인"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500"
                      >
                        {showConfirmPassword ? "숨기기" : "보기"}
                      </button>
                    </div>
                    {passwordMatchState === "match" ? (
                      <p className="mt-2 text-xs font-bold text-emerald-600">
                        비밀번호가 일치합니다.
                      </p>
                    ) : null}
                    {passwordMatchState === "mismatch" ? (
                      <p className="mt-2 text-xs font-bold text-red-500">
                        비밀번호가 일치하지 않습니다.
                      </p>
                    ) : null}
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title={form.userRole === "therapist" ? "기관 정보" : "기본 정보"}
                description={
                  form.userRole === "therapist"
                    ? "치료사 계정은 승인된 기관을 선택한 뒤 기본 신원 정보를 함께 입력합니다."
                    : "일반 회원은 기관과 담당 치료사를 선택한 뒤 기본 정보를 함께 입력합니다."
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div
                    className={`grid grid-cols-1 gap-4 ${
                      isTherapistSignup ? "sm:col-span-2" : "sm:grid-cols-3 sm:col-span-2"
                    }`}
                  >
                    <Field label="이름 *">
                      <input
                        className="input-style"
                        autoComplete="off"
                        value={form.name}
                        onChange={(e) => updateForm("name", e.target.value)}
                        placeholder="이름"
                      />
                    </Field>

                    <Field label="생년월일 *">
                      <input
                        className="input-style"
                        value={form.birthDate}
                        onChange={(e) =>
                          updateForm("birthDate", formatDateInput(e.target.value))
                        }
                        autoComplete="off"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="예: 1990-01-15"
                      />
                    </Field>

                    {isTherapistSignup ? (
                      <Field label="휴대폰 번호 *">
                        <input
                          className="input-style"
                          autoComplete="off"
                          inputMode="numeric"
                          value={form.phone}
                          onChange={(e) => updateForm("phone", formatPhoneInput(e.target.value))}
                          placeholder="예: 010-1234-5678"
                        />
                      </Field>
                    ) : (
                      <Field label="전화번호 뒤 4자리 *">
                        <input
                          className="input-style"
                          autoComplete="off"
                          inputMode="numeric"
                          maxLength={4}
                          value={form.phoneLast4}
                          onChange={(e) =>
                            updateForm(
                              "phoneLast4",
                              e.target.value.replace(/\D/g, "").slice(0, 4),
                            )
                          }
                          placeholder="1234"
                        />
                      </Field>
                    )}
                  </div>

                  {form.userRole === "therapist" ? (
                    <div className="space-y-4 sm:col-span-2">
                      <Field label="기관 소속 방식 *">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {([
                            { key: "existing", label: "기존 기관 선택", desc: "승인된 기관을 선택해 가입합니다." },
                            { key: "solo", label: "1인 기관으로 등록", desc: "기관 대표이자 치료사로 함께 등록합니다." },
                          ] as const).map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => updateForm("institutionMode", option.key)}
                              className={`rounded-2xl border px-4 py-4 text-left transition ${
                                form.institutionMode === option.key
                                  ? "border-orange-300 bg-orange-50"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <p className="text-sm font-black text-slate-900">{option.label}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{option.desc}</p>
                            </button>
                          ))}
                        </div>
                      </Field>

                      {form.institutionMode === "existing" ? (
                        <Field label="병원 / 기관 검색 *">
                          <OrganizationPicker
                            query={form.organizationQuery}
                            onQueryChange={(value) => updateForm("organizationQuery", value)}
                            organizations={filteredOrganizations}
                            selectedOrganization={selectedOrganization}
                            onSelect={selectOrganization}
                            onClear={clearOrganizationSelection}
                            isOpen={isOrganizationDropdownOpen}
                            onOpenChange={setIsOrganizationDropdownOpen}
                            placeholder="병원명, 기관 코드, 주소 검색"
                            emptyText="검색 결과가 없습니다."
                            helperText="소속 기관이 없다면 아래 `1인 기관으로 등록`을 선택해 주세요."
                          />
                        </Field>
                      ) : (
                        <OrganizationBasicFields
                          value={{
                            organizationName: form.soloOrganizationName,
                            businessNumber: form.soloBusinessNumber,
                            representativeName: form.soloRepresentativeName,
                            organizationType: form.soloOrganizationType,
                            careInstitutionNumber: form.soloCareInstitutionNumber,
                            businessLicenseFileName: form.soloBusinessLicenseFileName,
                            businessLicenseFileDataUrl: form.soloBusinessLicenseFileDataUrl,
                            organizationPhone: form.soloOrganizationPhone,
                            postalCode: form.soloPostalCode,
                            roadAddress: form.soloRoadAddress,
                            addressDetail: form.soloAddressDetail,
                          }}
                          onChange={(patch) =>
                            setForm((prev) => ({
                              ...prev,
                              soloOrganizationName:
                                patch.organizationName ?? prev.soloOrganizationName,
                              soloBusinessNumber:
                                patch.businessNumber ?? prev.soloBusinessNumber,
                              soloRepresentativeName:
                                patch.representativeName ?? prev.soloRepresentativeName,
                              soloOrganizationType:
                                patch.organizationType ?? prev.soloOrganizationType,
                              soloCareInstitutionNumber:
                                patch.careInstitutionNumber ?? prev.soloCareInstitutionNumber,
                              soloBusinessLicenseFileName:
                                patch.businessLicenseFileName ??
                                prev.soloBusinessLicenseFileName,
                              soloBusinessLicenseFileDataUrl:
                                patch.businessLicenseFileDataUrl ??
                                prev.soloBusinessLicenseFileDataUrl,
                              soloOrganizationPhone:
                                patch.organizationPhone ?? prev.soloOrganizationPhone,
                              soloPostalCode: patch.postalCode ?? prev.soloPostalCode,
                              soloRoadAddress: patch.roadAddress ?? prev.soloRoadAddress,
                              soloAddressDetail:
                                patch.addressDetail ?? prev.soloAddressDetail,
                            }))
                          }
                          onLicenseFileChange={handleSoloBusinessLicenseUpload}
                          isReadingLicense={isReadingTherapistLicense}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4 sm:col-span-2">
                      <Field label="병원 / 기관 검색 *">
                        <OrganizationPicker
                          query={form.organizationQuery}
                          onQueryChange={(value) => updateForm("organizationQuery", value)}
                          organizations={filteredOrganizations}
                          selectedOrganization={selectedOrganization}
                          onSelect={selectOrganization}
                          onClear={clearOrganizationSelection}
                          isOpen={isOrganizationDropdownOpen}
                          onOpenChange={setIsOrganizationDropdownOpen}
                          placeholder="병원명, 기관 코드, 주소 검색"
                          emptyText="검색 결과가 없습니다."
                        />
                      </Field>

                      <Field label="담당 치료사 선택 *">
                        <div className="space-y-3">
                          {!form.organizationId ? (
                            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                              먼저 기관을 선택해 주세요.
                            </p>
                          ) : isLoadingTherapists ? (
                            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                              승인된 치료사 목록을 불러오는 중입니다.
                            </p>
                          ) : therapistOptions.length ? (
                            <>
                                <select
                                  className="input-style"
                                  value={form.therapistUserId}
                                  onChange={(e) => updateForm("therapistUserId", e.target.value)}
                                >
                                  <option value="">담당 치료사를 선택해 주세요</option>
                                  {therapistOptions.map((item) => (
                                    <option key={item.therapistUserId} value={item.therapistUserId}>
                                      {therapistNameCounts.get(item.therapistName) &&
                                      therapistNameCounts.get(item.therapistName)! > 1
                                        ? [
                                            item.therapistName,
                                            item.loginId ? `ID ${item.loginId}` : null,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")
                                        : item.therapistName}
                                    </option>
                                  ))}
                                </select>
                              <p className="text-xs font-semibold text-slate-500">
                                승인된 치료사 {therapistOptions.length}명
                              </p>
                            </>
                          ) : (
                            <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-600">
                              선택한 기관에 승인된 치료사가 아직 없습니다. 기관 또는 치료사
                              승인을 먼저 완료해 주세요.
                            </p>
                          )}
                        </div>
                      </Field>
                    </div>
                  )}
                  {isTherapistSignup ? (
                    <div className="grid grid-cols-1 gap-4 sm:col-span-2">
                      <Field label="이메일 *">
                        <input
                          className="input-style"
                          autoComplete="off"
                          value={form.email}
                          onChange={(e) => updateForm("email", e.target.value)}
                          placeholder="example@hospital.co.kr"
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              {!isTherapistSignup ? (
                <SectionCard
                  title="재활 정보"
                  description="훈련 시작 전 필요한 기본 재활 정보를 입력해 주세요."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="교육년수 *">
                      <input
                        className="input-style"
                        inputMode="numeric"
                        value={form.educationYears}
                        onChange={(e) =>
                          updateForm(
                            "educationYears",
                            e.target.value.replace(/\D/g, "").slice(0, 2),
                          )
                        }
                        placeholder="예: 12"
                      />
                    </Field>

                    <Field label="발병일 *">
                      <input
                        className="input-style"
                        type="date"
                        max={todayLocalDate}
                        value={form.onsetDate}
                        onChange={(e) => updateForm("onsetDate", e.target.value)}
                      />
                    </Field>

                    <Field label="성별 *">
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: "M", label: "남성" },
                          { key: "F", label: "여성" },
                          { key: "U", label: "선택 안함" },
                        ] as const).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => updateForm("gender", option.key)}
                            className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                              form.gender === option.key
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="편마비 유무 *">
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: "Y", label: "있음" },
                          { key: "N", label: "없음" },
                        ] as const).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => updateForm("hemiplegia", option.key)}
                            className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                              form.hemiplegia === option.key
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="반맹증 (시야 결손) *">
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: "NONE", label: "없음" },
                          { key: "LEFT", label: "좌측" },
                          { key: "RIGHT", label: "우측" },
                        ] as const).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => updateForm("hemianopsia", option.key)}
                            className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                              form.hemianopsia === option.key
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                </SectionCard>
              ) : null}

              {isTherapistSignup ? (
                <>
                  <SectionCard
                    title="자격 정보"
                    description="직군, 자격번호, 자격증 파일을 입력해 주세요."
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="직군 *">
                        <select
                          className="input-style"
                          value={form.profession}
                          onChange={(e) =>
                            updateForm("profession", e.target.value as TherapistProfession)
                          }
                        >
                          <option value="speech">언어치료사</option>
                          <option value="occupational">작업치료사</option>
                          <option value="physical">물리치료사</option>
                          <option value="cognitive">인지재활</option>
                          <option value="other">기타</option>
                        </select>
                      </Field>

                      <Field label="면허번호 / 자격증 번호 *">
                        <input
                          className="input-style"
                          value={form.licenseNumber}
                          onChange={(e) => updateForm("licenseNumber", e.target.value)}
                          placeholder="면허번호 또는 자격증 번호"
                        />
                      </Field>

                      <Field label="발급기관 *">
                        <input
                          className="input-style"
                          value={form.licenseIssuedBy}
                          onChange={(e) => updateForm("licenseIssuedBy", e.target.value)}
                          placeholder="예: 대한언어재활사협회"
                        />
                      </Field>

                      <Field label="발급일 *">
                        <input
                          className="input-style"
                          type="date"
                          max={todayLocalDate}
                          value={form.licenseIssuedDate}
                          onChange={(e) => updateForm("licenseIssuedDate", e.target.value)}
                        />
                      </Field>

                      <Field label="면허증 / 자격증 파일 업로드 *">
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.pdf"
                            onChange={handleTherapistLicenseUpload}
                            className="block w-full text-sm font-semibold text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-slate-700"
                          />
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            {isReadingTherapistLicense
                              ? "면허증/자격증 파일을 읽는 중입니다."
                              : form.licenseFileName
                                ? `첨부됨: ${form.licenseFileName}`
                                : "PNG, JPG, PDF 파일을 1개 업로드해 주세요."}
                          </p>
                        </div>
                      </Field>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="필수 동의"
                    description="치료사 승인 검토에 필요한 최소 동의 항목만 확인합니다."
                  >
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <CheckField
                        label="개인정보 처리방침에 동의합니다. *"
                        checked={form.privacyAgreed}
                        onChange={(checked) =>
                          updateBooleanField("privacyAgreed", checked)
                        }
                      />
                      <CheckField
                        label="환자 데이터 접근 및 처리 정책에 동의합니다. *"
                        checked={form.patientDataAccessAgreed}
                        onChange={(checked) =>
                          updateBooleanField("patientDataAccessAgreed", checked)
                        }
                      />
                      <CheckField
                        label="보안 정책에 동의합니다. *"
                        checked={form.securityPolicyAgreed}
                        onChange={(checked) =>
                          updateBooleanField("securityPolicyAgreed", checked)
                        }
                      />
                      <CheckField
                        label="의료정보 비밀유지 서약에 동의합니다. *"
                        checked={form.confidentialityAgreed}
                        onChange={(checked) =>
                          updateBooleanField("confidentialityAgreed", checked)
                        }
                      />
                    </div>
                  </SectionCard>
                </>
              ) : null}

            </div>

            {error ? <p className="mt-5 text-sm font-bold text-red-500">{error}</p> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="inline-flex h-13 min-w-[180px] items-center justify-center rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting
                  ? "가입 중..."
                  : form.userRole === "therapist"
                    ? "치료사 가입 신청"
                    : "회원가입 완료"}
              </button>
              <button
                type="button"
                onClick={() => setHasChosenRole(false)}
                className="inline-flex h-13 min-w-[140px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-base font-black text-slate-700 transition hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </>
        )}

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
            border-color: #f97316;
            background: white;
            box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.12);
          }
        `}</style>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-base font-black text-slate-900">{title}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
          {description}
        </p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function OrganizationPicker({
  query,
  onQueryChange,
  organizations,
  selectedOrganization,
  onSelect,
  onClear,
  isOpen,
  onOpenChange,
  placeholder,
  emptyText,
  helperText,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  organizations: OrganizationCatalogEntry[];
  selectedOrganization: OrganizationCatalogEntry | null;
  onSelect: (organization: OrganizationCatalogEntry) => void;
  onClear: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  emptyText: string;
  helperText?: string;
}) {
  const shouldShowList = !selectedOrganization && isOpen;

  return (
    <div className="space-y-2">
      <input
        className="input-style"
        value={query}
        onFocus={() => onOpenChange(true)}
        onChange={(e) => {
          onQueryChange(e.target.value);
          onOpenChange(true);
        }}
        placeholder={placeholder}
      />

      {selectedOrganization ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">{selectedOrganization.name}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              {selectedOrganization.code} · {selectedOrganization.address}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            취소
          </button>
        </div>
      ) : null}

      {shouldShowList ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
            {organizations.length ? (
              organizations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="block w-full px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <p className="text-sm font-black text-slate-900">{item.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {item.code} · {item.address}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-4 py-4 text-sm font-semibold text-slate-500">{emptyText}</p>
            )}
          </div>
        </div>
      ) : null}

      {helperText ? (
        <p className="text-xs font-semibold text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
      />
      <span className="text-sm font-semibold leading-6 text-slate-700">{label}</span>
    </label>
  );
}
