/**
 * 식약처 마비말장애 DTx 안전성·성능·임상 가이드라인 (가이드라인 D) — 임상 평가지표·일정·통계 메타.
 *
 * 가이드라인 원문: 뇌졸중 후 마비말장애 개선 디지털치료기기 안전성·성능 평가 및 임상시험계획서 작성 가이드라인
 * 해석 문서: docs/regulatory/guidelines-2026-05/04-dysarthria-dtx-clinical.md
 * 체크리스트: submission/guidelines-2026-05/dysarthria-clinical-plan-checklist.md
 *
 * 본 모듈은 메타만 export 한다. 임상 트랙용 화면(가을문단 녹음, PHQ-9/QoL-Dys 자가보고)은
 * 본 작업 범위 외다. SessionManager / evaluationSamplesDb / step1~6 화면은 변경하지 않는다.
 */

/** 임상시험 디자인 (가이드라인 D p.37 표준) */
export interface ClinicalDesign {
  type: string;
  studyArm: string;
  controlArm: string;
  allocationRatio: string;
  randomization: string;
  blinding: string;
  totalDurationWeeks: number;
}

/** 선정/제외 기준 (가이드라인 D p.50~51 예시) */
export interface EligibilityCriteria {
  inclusion: readonly string[];
  exclusion: readonly string[];
}

/** 평가지표 — 일차 / 이차 */
export interface ClinicalEndpoint {
  /** 지표명 (예: 말 명료도) */
  name: string;
  /** 약어 (예: MPT) */
  abbr?: string;
  /** 평가 도구·방법 */
  measurement: string;
  /** 측정 시점 (주) */
  visitWeeks: readonly number[];
  /** 본 제품에서 측정 가능 여부 (본 작업 시점) */
  inAppMeasurable: "yes" | "partial" | "no";
  /** 측정 가능하지 않은 경우의 보완 계획 */
  fallbackPlan?: string;
}

/** 임상시험 방문 일정 */
export interface VisitSchedule {
  visit: string;
  weekOffset: number;
  windowDays?: number; // ±N일
  collect: readonly string[];
}

/** 통계 분석 계획 */
export interface StatisticalPlan {
  analysisSets: readonly string[];
  primaryAnalysis: string;
  nonInferiorityRule: string;
  secondaryAnalysis: string;
  missingDataHandling: string;
  software: readonly string[];
  /** 가이드라인 예시 — 152명 (군당 76명). 실제 산출은 검정력 분석으로 결정. */
  exampleSampleSize: string;
}

/** 이상사례 카테고리 (예측 부작용) */
export interface AdverseEventCategory {
  category: "psychological" | "physical" | "cognitive-adherence";
  examples: readonly string[];
  trackingMethod: string;
}

/**
 * 브레인프렌즈 임상시험계획 메타 — 가이드라인 D 기반.
 * 코드/화면 변경 없음. 임상시험계획서 작성 시 입력 자료로 사용.
 */
export const CLINICAL_PLAN = {
  design: {
    type: "다기관, 전향적, 무작위, 평가자 눈가림(단일맹검), 비교, 비열등성 검증, 확증임상시험",
    studyArm: "브레인프렌즈 (디지털치료기기)",
    controlArm: "통상적 언어치료",
    allocationRatio: "1:1",
    randomization: "IWRS, 층화순열화블록 (층: 성별, 나이)",
    blinding: "평가자 눈가림 (단일맹검)",
    totalDurationWeeks: 8,
  } satisfies ClinicalDesign,

  eligibility: {
    inclusion: [
      "만 19세 이상",
      "[I69.3] 뇌경색증의 후유증 + [R47.1] 구음장애 및 무조음증 진단 (신경학적 안정)",
      "한국어 읽기·쓰기 가능",
      "검사 절차 수행에 충분한 시·청력·언어·운동 능력",
      "스마트폰/태블릿 사용 가능",
      "서면 동의",
    ],
    exclusion: [
      "구강구조·경부구조 기질적 문제",
      "중대한 의학적 질환",
      "최근 3개월 이내 다른 언어치료 시작·진행 중",
      "다른 임상시험 참여",
      "심각한 인지·언어 장애",
      "시험자 부적절 판단",
    ],
  } satisfies EligibilityCriteria,

  endpoints: {
    primary: [
      {
        name: "말 명료도 (Speech Intelligibility)",
        measurement:
          "'가을문단' 낭독(Kim, H., 2012) → SLP 청지각 평가 0~100% 척도",
        visitWeeks: [0, 4, 8],
        inAppMeasurable: "no",
        fallbackPlan:
          "임상 트랙용 별도 녹음 화면 신규 작업 필요. 본 작업 범위 외.",
      },
    ] as readonly ClinicalEndpoint[],
    secondary: [
      {
        name: "Maximum Phonation Time",
        abbr: "MPT",
        measurement: "/아/, /이/, /우/ 모음 지속 발성 시간 (두 차례 중 더 긴 값)",
        visitWeeks: [0, 4, 8],
        inAppMeasurable: "partial",
        fallbackPlan:
          "step2 음성 길이 측정 활용 가능. 표준 프로토콜(2회 중 최댓값)에 맞춘 별도 화면 권장.",
      },
      {
        name: "Diadochokinetic rate",
        abbr: "DDK",
        measurement: "/파/, /터/, /커/ 5초 동안 빠르고 정확하게 반복, 초당 음절 수",
        visitWeeks: [0, 4, 8],
        inAppMeasurable: "partial",
        fallbackPlan: "STT 음절 카운트 활용 가능. 별도 화면 권장.",
      },
      {
        name: "Percentage of Consonants Correct",
        abbr: "PCC",
        measurement:
          "30개 목표 단어 제시 → 환자 발음 → 정확 자음 수 ÷ 전체 자음 수 × 100",
        visitWeeks: [0, 4, 8],
        inAppMeasurable: "partial",
        fallbackPlan:
          "consonantAccuracy 필드 활용 가능. 30개 목표 단어 셋업 정의 필요.",
      },
      {
        name: "Patient Health Questionnaire-9",
        abbr: "PHQ-9",
        measurement: "우울 9문항, 0~3점, 총점 0~27 (자가보고)",
        visitWeeks: [0, 4, 8],
        inAppMeasurable: "no",
        fallbackPlan: "자가보고 화면 신규 작업 필요. 본 작업 범위 외.",
      },
      {
        name: "Quality of Life in Dysarthria",
        abbr: "QoL-Dys",
        measurement:
          "한국어판 40문항, 4범주(말산출/심리·정서/사회적 관계/기능적 제한)×10문항, 5점 Likert",
        visitWeeks: [0, 4, 8],
        inAppMeasurable: "no",
        fallbackPlan: "자가보고 화면 신규 작업 필요. 본 작업 범위 외.",
      },
    ] as readonly ClinicalEndpoint[],
  },

  visitSchedule: [
    {
      visit: "방문1 (스크리닝 + 베이스라인)",
      weekOffset: 0,
      windowDays: -28, // 스크리닝 D-28 이내
      collect: [
        "동의서",
        "선정/제외 기준",
        "인구학적 정보",
        "과거병력",
        "무작위 배정",
        "베이스라인 평가지표 (말 명료도, MPT, DDK, PCC, PHQ-9, QoL-Dys)",
      ],
    },
    {
      visit: "방문2",
      weekOffset: 4,
      windowDays: 7, // ±7일
      collect: [
        "4주 평가지표",
        "이상반응",
        "병용 약물",
        "병용 요법 변화",
        "순응도 (앱 사용 시간, 콘텐츠 활용도)",
      ],
    },
    {
      visit: "방문3",
      weekOffset: 8,
      collect: [
        "8주 평가지표",
        "이상반응",
        "병용 약물",
        "병용 요법 변화",
        "순응도",
      ],
    },
  ] as readonly VisitSchedule[],

  statisticalPlan: {
    analysisSets: ["FAS (ITT 원칙, 주분석)", "PPS (보조분석)"],
    primaryAnalysis: "ANCOVA (공분산분석), 기저치를 공변량으로",
    nonInferiorityRule:
      "양측 95% CI 하한이 비열등성 마진(예: -4.55) 미포함 시 비열등 판정",
    secondaryAnalysis: "탐색적 변수, 가설검정 미실시",
    missingDataHandling: "LOCF (Last Observation Carried Forward)",
    software: ["SAS 9.4", "R 4.4.2"],
    exampleSampleSize:
      "152명 (군당 76명) — 가이드라인 예시. 실제 산출은 선행연구 기반 검정력 분석으로 결정.",
  } satisfies StatisticalPlan,

  adverseEventCategories: [
    {
      category: "psychological",
      examples: ["피로", "좌절감"],
      trackingMethod: "자가보고 + 면담",
    },
    {
      category: "physical",
      examples: [
        "목 근긴장",
        "안구 피로",
        "두통",
        "어깨·턱 근육 피로",
      ],
      trackingMethod: "자가보고 + 면담",
    },
    {
      category: "cognitive-adherence",
      examples: ["집중력 저하", "순응도 감소"],
      trackingMethod: "앱 사용 로그 + 면담",
    },
  ] as readonly AdverseEventCategory[],
} as const;

/**
 * 본 제품 코드 흐름과의 매핑 — 어떤 평가지표가 어디서 나오는지(또는 미구현인지) 표기.
 * 어디까지나 메타이며, 실제 데이터 추출은 별도 작업.
 */
export const ENDPOINT_CODE_MAPPING = [
  {
    endpointAbbr: "MPT",
    sourceModule: "src/lib/kwab/SessionManager.ts (step2 음성 길이)",
    note: "표준 프로토콜(2회 중 최댓값)에 맞춘 별도 화면 신규 권장.",
  },
  {
    endpointAbbr: "DDK",
    sourceModule: "STT (src/app/api/proxy/stt/route.ts) + 음절 카운트",
    note: "비용 영향 — NEXT_PUBLIC_DEV_MODE=true 우선 검토.",
  },
  {
    endpointAbbr: "PCC",
    sourceModule:
      "src/lib/speech/SpeechAnalyzer.ts 의 consonantAccuracy + step2/step3 결과",
    note: "30개 목표 단어 셋업 별도 정의 필요.",
  },
  {
    endpointAbbr: "PHQ-9",
    sourceModule: "(미구현) — 자가보고 설문 화면 신규 필요",
    note: "본 작업 범위 외.",
  },
  {
    endpointAbbr: "QoL-Dys",
    sourceModule: "(미구현) — 자가보고 설문 화면 신규 필요",
    note: "본 작업 범위 외.",
  },
] as const;
