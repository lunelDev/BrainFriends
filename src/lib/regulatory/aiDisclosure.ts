/**
 * 식약처 AI 적용 디지털의료기기 허가·심사 가이드라인 (가이드라인 B) — V&V 안 AI 성능평가 + 정보공개 메타.
 *
 * 가이드라인 원문: 인공지능 기술이 적용된 디지털의료기기의 허가·심사 가이드라인 (민원인 안내서)
 * 해석 문서: docs/regulatory/guidelines-2026-05/02-ai-approval-review.md
 * 체크리스트: submission/guidelines-2026-05/ai-vnv-checklist.md
 *
 * 핵심:
 *   - AI 적용 제품은 별도 "AI 성능평가 자료" 항목이 없다.
 *     모든 자료는 「소프트웨어 검증 및 유효성 확인 보고서(V&V)」 안에 포함.
 *   - 정보공개 4항목은 영업비밀 비공개 불가.
 *
 * 본 모듈은 메타만 export 한다. 실제 평가 데이터는 src/lib/ai/* 가 담당.
 * 학습/시험 데이터셋 분리 구현은 본 작업 범위 외.
 */

/** B-1 시험 개요 — 시험 데이터셋 메타 */
export interface TestDatasetMeta {
  /** 수집 기준 (선정/제외) */
  collectionCriteria: string;
  /** 수집 방법 (전향적/후향적, 디바이스, 환경) */
  collectionMethod: string;
  /** 수집 기관 (예: OO병원, 외래·입원) */
  collectionOrganization: string;
  /** 수집 기간 (YYYY-MM ~ YYYY-MM) */
  collectionPeriod: string;
  /** 시험 데이터셋 수 (양성/음성 또는 정상/비정상) */
  datasetSize: string;
  /** 한국인 데이터셋 사용 여부 (한국어 발화 특성상 필수) */
  koreanCohort: boolean;
}

/** B-2 참조표준 (골드스탠다드) */
export interface ReferenceStandard {
  /** 참조표준 정의 — 본 제품: SLP 청지각 평가 + '가을문단' 낭독 */
  definition: string;
  /** 구축 기준 */
  constructionMethod: string;
  /** 참고 문헌·논문 */
  references: string[];
}

/** B-3, B-4 시험항목·시험기준 */
export interface AcceptanceCriterion {
  /** 지표 (예: WER, 자음 정확도 MAE, 민감도, 특이도, AUC) */
  metric: string;
  /** 임계값 (예: WER < 0.30) */
  threshold: string;
  /** 임계값 근거 (선행 STT 연구, V&V 결과서 등) */
  rationale: string;
}

/** 정보공개 4항목 — 가이드라인 p.16~17 */
export interface PublicDisclosure {
  /** 1. 학습데이터의 정보 — 수집 시기·기관·규모, 양성/음성 건수 */
  trainingDataInfo: string;
  /** 2. 학습데이터 업데이트 예상 주기 — 예: "제조원에 의한 업데이트 1년" */
  updateCycle: string;
  /** 3. 클라우드 서비스 종류·구성 형태 (제3자 클라우드 사용 시) */
  cloudService: string;
  /** 4. 임상적 관점 성능 — 민감도 OO%, 특이도 OO% (임상 결과 확정 후 채움) */
  clinicalPerformance: string;
}

/** 학습/시험 데이터셋 분리 정책 — 가이드라인 p.18~19 */
export interface DatasetSeparationPolicy {
  /** 학습 ≠ 시험 (상호 독립) */
  trainingTestIndependence: string;
  /** 후향적 시험 데이터도 학습과 독립 */
  retrospectiveIndependence: string;
  /** 편향 방지 고려사항 (수집 방법·장소·양식·항목) */
  biasPrevention: string;
}

/** 변경관리 계획 — 가이드라인 p.22 */
export interface ChangeManagementPlan {
  /** 사전 변경관리 계획 적용 범위 — 계획 내 변경은 변경허가 제외 */
  scope: string;
  /** 핵심성능 변경 5범주 (변경허가 필수) */
  approvalRequiredScope: readonly string[];
  /** 기준 버전 (현 활성 모델/분석/평가셋 버전) — src/lib/ai/modelGovernance.ts 의 ACTIVE_MODEL_GOVERNANCE 와 정합 유지 */
  baselineVersionRef: string;
}

/**
 * 가이드라인 B 메타 — 본 제품 자체 선언.
 *
 * 빈 자리(미정 항목)는 정확한 값 확정 후 별도 작업으로 채운다.
 * 본 메타가 가르키는 코드 구현 위치(예: performanceMetrics.ts)는
 * 본 작업에서 변경하지 않는다.
 */
export const AI_DISCLOSURE = {
  testDatasetMeta: {
    collectionCriteria:
      "TODO — 마비말장애·실어증 환자 + 정상 대조 음성. 가이드라인 D의 임상 선정/제외기준과 정렬 권장.",
    collectionMethod:
      "TODO — 디바이스(브레인프렌즈 앱, 스마트폰/태블릿), 환경(가정 + 외래), 절차 명시.",
    collectionOrganization: "TODO — 협력 의료기관명·외래/입원 구분.",
    collectionPeriod: "TODO — YYYY-MM ~ YYYY-MM.",
    datasetSize: "TODO — 양성/음성 건수 또는 환자/정상 대조 건수.",
    koreanCohort: true,
  },
  referenceStandard: {
    definition:
      "언어재활사(SLP)의 청지각 평가 + '가을문단' 낭독 표준 평가를 골드스탠다드로 정의 (가이드라인 D 일차 평가지표와 일관).",
    constructionMethod:
      "복수 SLP의 0~100% 명료도 평가의 합의 또는 평균을 정답 라벨로 사용. 평가자간 일치도(ICC) 보고.",
    references: [
      "Kim, H. (2012) — 가을문단 낭독 평가 (가이드라인 D 본문 인용)",
      "TODO — STT 정확도/WER 선행 연구 출처 보강",
    ],
  },
  acceptanceCriteria: [
    {
      metric: "WER (Word Error Rate)",
      threshold: "TODO — 선행 연구 기반 임계값 확정",
      rationale: "TODO — V&V 결과서 + 선행 STT 연구 출처",
    },
    {
      metric: "자음 정확도 MAE (PCC 추정 정확도)",
      threshold: "TODO",
      rationale: "TODO — 가이드라인 D 의 PCC 정의와 정렬",
    },
    {
      metric: "민감도/특이도 (마비말장애 판별)",
      threshold: "TODO — 임상시험 결과 확정 후",
      rationale: "TODO",
    },
  ],
  publicDisclosure: {
    trainingDataInfo:
      "TODO — 수집 시기·기관·규모, 양성/음성 건수. 영업비밀 비공개 불가.",
    updateCycle: "제조원에 의한 업데이트 1년 (변경관리 계획서로 갈음 가능)",
    cloudService:
      "NCP 기반 — server / database / object storage. 정확한 서비스 구성 형태는 docs/regulatory/cloud-and-data-transfer.md 와 정합 유지.",
    clinicalPerformance:
      "TODO — 가이드라인 D 의 일차 평가지표(말 명료도) 결과 확정 후 채움. 민감도·특이도 OO%.",
  },
  datasetSeparationPolicy: {
    trainingTestIndependence:
      "학습 데이터셋과 시험 데이터셋은 상호 독립적이어야 한다 (가이드라인 p.18). 실제 분리 컬럼/태그는 별도 작업.",
    retrospectiveIndependence:
      "후향적 시험 데이터도 제품 개발의 학습 데이터와 독립 (가이드라인 p.19).",
    biasPrevention:
      "수집 방법·장소·양식·항목·디바이스 다양성 고려. 한국어 발화 특성 + 마비말장애 중증도 분포.",
  },
  changeManagementPlan: {
    scope:
      "사전 변경관리 계획 제출. 계획에 따른 모델 업데이트는 변경허가 대상에서 제외 (디지털의료제품법 제11조).",
    approvalRequiredScope: [
      "사용목적 또는 이와 관련된 핵심적 성능",
      "생체신호·의료영상 등 분석 대상 또는 분석기법(알고리즘) 자체 교체",
      "소프트웨어 개발 언어 또는 운영환경",
      "사이버보안에 영향을 미치는 통신기능",
      "사용 사양서 또는 UI 변경 중 총괄평가 수반 변경",
    ],
    baselineVersionRef:
      "src/lib/ai/modelGovernance.ts — ACTIVE_MODEL_GOVERNANCE (modelVersion / analysisVersion / evaluationDatasetVersion).",
  },
} as const satisfies {
  testDatasetMeta: TestDatasetMeta;
  referenceStandard: ReferenceStandard;
  acceptanceCriteria: readonly AcceptanceCriterion[];
  publicDisclosure: PublicDisclosure;
  datasetSeparationPolicy: DatasetSeparationPolicy;
  changeManagementPlan: ChangeManagementPlan;
};
