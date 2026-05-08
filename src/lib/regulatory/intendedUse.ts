/**
 * 식약처 디지털의료기기 분류·등급 가이드라인 (가이드라인 A) — 사용목적·등급 자체 선언 메타.
 *
 * 가이드라인 원문: 디지털의료기기 분류 및 등급 지정 등에 관한 가이드라인 (개정안 최종)
 * 해석 문서: docs/regulatory/guidelines-2026-05/01-classification-and-grade.md
 * 체크리스트: submission/guidelines-2026-05/intended-use-and-grade-checklist.md
 *
 * 본 모듈은 가이드라인 원문에 가까운 메타데이터만 단방향으로 export 한다.
 * 운영 로직(인증/세션/결과 저장/STT)에는 영향이 없으며, 기존 모듈은 변경하지 않는다.
 *
 * 사용목적 본문(외부 공표 문구)의 단일 소스(SSOT)는 다음 두 문서다.
 *   - docs/regulatory/intended-use-and-contraindications.md
 *   - docs/regulatory/claim-lock.md
 * 본 파일과 위 문서가 어긋날 경우 위 문서가 우선한다.
 */

/** 가이드라인 A — 환자 상태 (① 축) */
export type PatientCondition =
  | "critical" // 위독·치명적 (즉시·24h 내 사망)
  | "serious" // 심각 (중증의 질환)
  | "non-serious"; // 심각하지 않음 (그 밖의 질환)

/** 가이드라인 A — 의료에 미치는 영향 (② 축) */
export type MedicalImpact =
  | "treatment-or-rehab" // 치료·재활·검사·진단·의약품보조
  | "clinical-management-guidance" // 임상적 관리 유도 (예측·예방)
  | "information-management"; // 정보제공·관리 (모니터링) 및 기타

/** 가이드라인 A — 오작동 시 직·간접 피해 수준 (③ 축, IEC 62304 안전성 등급 기반) */
export type MalfunctionImpact =
  | "A" // 피해 없음 (-1 적용 가능, 단 2→1 하향 불가)
  | "B" // 경상~중상
  | "C"; // 사망 또는 심각 (+1)

/** 매트릭스 1차 등급 (조정 전) — 1~4 */
export type DeviceGradeRaw = 1 | 2 | 3 | 4;

/** 자체 선언 등급 결정의 3축 + 결과 */
export interface GradeDeclaration {
  patientCondition: PatientCondition;
  medicalImpact: MedicalImpact;
  malfunctionImpact: MalfunctionImpact;
  /** 매트릭스 1차 등급 */
  rawGrade: DeviceGradeRaw;
  /** 조정 후 최종 등급 (가이드라인 p.17~18: 2등급 ↔ 1등급 상호 조정 불가) */
  finalGrade: DeviceGradeRaw;
  /** 등급 산정 근거 요약 — 가이드라인 페이지 인용 */
  rationale: string;
}

/** 가이드라인 p.11~12 표준 사용목적 슬롯 */
export interface IntendedUseSlots {
  /** 사용자 (예: 환자, 보호자, 치료사, 의사) */
  user: string;
  /** 사용환경 (예: 가정, 외래, 의료기관) */
  environment: string;
  /** 의료적 상태 (예: 뇌졸중 후 마비말장애 / 실어증) */
  medicalCondition: string;
  /** 대상환자 (예: 만 19세 이상, 신경학적 안정) */
  targetPatient: string;
  /** 의도된 사용상의 목적 (예: 언어재활) */
  intendedPurpose: string;
  /** 입력정보 (예: 음성, 이미지, 텍스트, 자가보고 척도) */
  input: string;
  /** 정보처리 원리 (예: STT + 음향분석 + 점수 산출 + 진도 관리) */
  processingPrinciple: string;
  /** 출력정보 (예: 단계별 점수, 측정값, 리포트) */
  output: string;
  /** 금기사항 (예: 위급 환자, 중증 인지·언어 장애, 시·청력 부족 등) */
  contraindications: string;
}

/** 제품코드 자체 선언 (참고 — 사용목적 문구 확정 시 함께 결정) */
export interface ProductCodeDeclaration {
  /** 1·2번째 (대분류) — C-3 디지털치료기기 또는 E-2 기능보조 */
  category12: string;
  /** 3번째 — B 인공지능기술 또는 A 독립형 SW */
  category3: string;
  /** 6번째 — A 의료기기 */
  category6: string;
  /** 7번째 — 독립형 SW (SaMD) */
  category7: string;
}

/**
 * 브레인프렌즈 등급 자체 선언.
 * 가이드라인 p.19/p.25 명시: "위독·치명적 질환을 겪은 위급하지 않은 환자에게 적용되는
 * 의료적 처치(예: 뇌졸중 환자의 재활)"는 "심각하지 않음"으로 분류.
 */
export const GRADE_DECLARATION: GradeDeclaration = {
  patientCondition: "non-serious",
  medicalImpact: "treatment-or-rehab",
  malfunctionImpact: "B",
  rawGrade: 2,
  finalGrade: 2,
  rationale:
    "가이드라인 A p.19/p.25 — 뇌졸중 후 위급하지 않은 만성기 환자의 재활. " +
    "치료·재활 컬럼 × 심각하지 않음 행 = 2등급. " +
    "가이드라인 p.17~18에 따라 2→1 하향 조정 불가.",
};

/**
 * 사용목적 표준 형식 슬롯 — 자리만 채워둔 메타.
 * 외부 공표용 문구는 docs/regulatory/intended-use-and-contraindications.md 와
 * docs/regulatory/claim-lock.md 가 단일 소스다.
 *
 * 본 슬롯은 V&V/허가 자료 작성 시 기재 누락 방지를 위한 체크 용도.
 */
export const INTENDED_USE_SLOTS: IntendedUseSlots = {
  user: "환자(보조: 보호자), 치료사(언어재활사), 의사(처방)",
  environment: "가정 또는 외래/의료기관 (모바일·태블릿·웹)",
  medicalCondition:
    "뇌졸중 후 마비말장애 또는 실어증 (만성기, 위급하지 않음)",
  targetPatient: "만 19세 이상, 신경학적 안정",
  intendedPurpose: "언어재활 (보조·경감)",
  input:
    "음성, 이미지(얼굴), 텍스트(자가진단 응답), 자가보고 척도",
  processingPrinciple:
    "STT + 음향분석(자음/모음 정확도) + 얼굴/안면 분석 + 점수 산출 + 진도 관리",
  output: "단계별 점수, 측정값, 리포트, 치료사용 export",
  contraindications:
    "위급 환자, 중증 인지·언어 장애, 시·청력 부족, " +
    "구강·경부 구조 기질적 문제 (가이드라인 D 제외기준 정렬)",
};

/**
 * 제품코드 자체 선언 — 사용목적 문구 최종 확정 시 1·2번째 (C-3 vs E-2)는 재검토 대상.
 */
export const PRODUCT_CODE_DECLARATION: ProductCodeDeclaration = {
  category12: "C-3 디지털치료기기 (대안: E-2 기능보조)",
  category3: "B 인공지능기술 (STT/음향 분석에 ML 사용)",
  category6: "A 의료기기",
  category7: "독립형 SW (SaMD)",
};

/** 신청 트랙 자체 선언 */
export const SUBMISSION_TRACK = {
  classification: "인증 (2등급, NIDS 심사)",
  clinicalIncluded: true,
  workingDayLimit: 80, // 임상 포함 — 가이드라인 + NIDS 안내 기준
  workingDayLimitWithoutClinical: 65,
} as const;
