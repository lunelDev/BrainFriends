// src/constants/config.ts

export const SAMD_CONFIG = {
  /** 단일 분석 신뢰도 임계값 (85%) */
  TRUST_THRESHOLD: 0.85,
  /** 하이브리드 분석 시 음성 데이터 가중치 (60%) */
  VOICE_WEIGHT: 0.6,
  /** 하이브리드 분석 시 안면 데이터 가중치 (40%) */
  FACE_WEIGHT: 0.4,
} as const;

/**
 * @deprecated claim-lock §5 — 임상 검증되지 않은 정량 임계값(95.2%, ICC 0.82, r 0.98 등)을
 * 화면에 "Target/임계값"으로 노출하지 않는다. ClinicalFooter / MonitoringDashboard 가
 * 더 이상 사용하지 않는다. 새 코드에서 import 하지 말 것. 임상 검증 결과가 확보되면
 * 별도 검증 페이지에서 출처와 함께 표기한다.
 */
export const METRIC_TARGETS = {
  latency: 50,
  face: 0.5,
  speech: 0,
  rValue: 0,
  icc: 0,
  stability: 0,
} as const;
