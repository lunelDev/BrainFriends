// SR-ONBOARDING-EXCLUSION. RM-007 (부적절한 대상자 사용) 결정성 통제 함수.
//
// 식약처 디지털의료기기 허가·심사 가이드라인 PDF #1 §III.4 사용목적 + 제외 기준.
// 1차 허가 범위 (실어증·마비말장애 재활 보조) 외 사용자가 가입 시도 시 차단 또는
// 의료진 confirmation 필수 분기로 라우팅한다.

export type OnboardingExclusionReason =
  | "age_below_minimum"
  | "age_above_clinical_guidance"
  | "no_diagnosis_provided"
  | "diagnosis_out_of_scope"
  | "acute_phase"
  | "mci_or_dementia_only";

export interface OnboardingProfile {
  ageYears: number;
  /** 진단 코드 또는 한국어 진단명. 없으면 빈 문자열. */
  diagnosis: string;
  /** 발병 후 경과 (주). null = 모름. */
  weeksSinceOnset: number | null;
  /** 의료진 사전 승인 여부 (기관 추천 등). */
  medicalProfessionalApproval: boolean;
}

export interface OnboardingExclusionResult {
  /** 통과 여부. */
  allowed: boolean;
  /** 차단 사유 (정렬됨). */
  reasons: OnboardingExclusionReason[];
  /** 의료진 추가 확인 필요 여부 (allowed=true 여도 true 가능). */
  requiresMedicalConfirmation: boolean;
}

/** 1차 허가 범위 진단 키워드 — 정확 매칭 아닌 substring. */
const SCOPE_KEYWORDS = [
  "실어증",
  "마비말장애",
  "구음장애",
  "디스아트리아",
  "aphasia",
  "dysarthria",
] as const;

/** 1차 범위 외 진단 (명시 제외). */
const OUT_OF_SCOPE_KEYWORDS = [
  "MCI",
  "경도인지장애",
  "치매",
  "알츠하이머",
  "dementia",
  "alzheimer",
] as const;

const MIN_AGE_YEARS = 18 as const;
const ACUTE_PHASE_WEEKS = 6 as const;

export function evaluateOnboardingExclusion(
  profile: OnboardingProfile,
): OnboardingExclusionResult {
  const reasons: OnboardingExclusionReason[] = [];
  let requiresMedicalConfirmation = false;

  // 1. 연령
  if (!Number.isFinite(profile.ageYears) || profile.ageYears < MIN_AGE_YEARS) {
    reasons.push("age_below_minimum");
  }
  // 80대 이상은 임상가 확인 권고 (수용은 허용)
  if (profile.ageYears >= 85) {
    requiresMedicalConfirmation = true;
  }

  // 2. 진단
  const dx = (profile.diagnosis ?? "").trim().toLowerCase();
  if (dx.length === 0) {
    reasons.push("no_diagnosis_provided");
  } else {
    const inScope = SCOPE_KEYWORDS.some((k) => dx.includes(k.toLowerCase()));
    const outOfScope = OUT_OF_SCOPE_KEYWORDS.some((k) =>
      dx.includes(k.toLowerCase()),
    );
    // MCI/치매만 단독 → 차단
    if (outOfScope && !inScope) {
      reasons.push("mci_or_dementia_only");
    }
    // 1차 범위 진단 미존재 → 의료진 확인 필요
    if (!inScope && !outOfScope) {
      reasons.push("diagnosis_out_of_scope");
    }
  }

  // 3. 급성기 제외
  if (
    profile.weeksSinceOnset !== null &&
    Number.isFinite(profile.weeksSinceOnset) &&
    profile.weeksSinceOnset < ACUTE_PHASE_WEEKS
  ) {
    reasons.push("acute_phase");
  }

  // 4. 의료진 승인 부재 + 1차 범위 진단 키워드 있음 → 확인 필요
  if (!profile.medicalProfessionalApproval && reasons.length === 0) {
    requiresMedicalConfirmation = true;
  }

  reasons.sort((a, b) => a.localeCompare(b));

  return {
    allowed: reasons.length === 0,
    reasons,
    requiresMedicalConfirmation,
  };
}
