/**
 * src/lib/regulatory — 식약처 디지털의료기기 가이드라인 (2026-05) 메타 모듈.
 *
 * 본 디렉터리는 가이드라인 4종(분류·등급 / AI 허가심사 / 사이버보안 / 마비말장애 DTx)에 대한
 * 자체 선언과 매핑 메타를 단방향 export 한다.
 *
 * 운영 로직(인증/세션/STT/미디어/결과 저장)은 손대지 않는다.
 * 기존 모듈(src/lib/vnv, src/lib/security, src/lib/ai)도 변경하지 않는다.
 *
 * 상세 해석은 docs/regulatory/guidelines-2026-05/ 문서를,
 * 제출 체크리스트는 submission/guidelines-2026-05/ 문서를 참조한다.
 */

export * from "./intendedUse";
export * from "./aiDisclosure";
export * from "./cybersecurity35";
export * from "./dysarthriaClinicalPlan";
