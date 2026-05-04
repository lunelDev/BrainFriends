# PII / PHI 분리 강화 계획 v0.1

작성일: 2026-04-30
근거: 식약처 GMP [별첨5] 보안지침 / 개인정보보호법 §23 / RM-017
관련: `docs/10-operations/pii-phi-separation.md`, `phiMasking.ts` (`SR-PHI-013`)

## 1. 목적

현재 PII (이름·전화·이메일·RRN) 와 PHI (음성·영상·점수·진단) 가 동일 DB schema 에 함께 저장되는 구조의 위험 (RM-017) 을 줄이기 위한 단계적 분리 계획.

## 2. 현재 상태

- **patients 테이블**: 이름·전화·생년월일 (PII) + diagnosis (PHI) 함께
- **training_history**: patientPseudonymId 기반 (✅ 비식별)
- **adverse_events**: patient_id 직접 참조 (PII 연결)
- **kwab_results**: patientPseudonymId (✅ 비식별)
- **PHI 마스킹**: 외부 산출물 export 시 `maskPhiObject` 자동 적용 (✅)

## 3. 목표 구조 (Phase 1)

```
patients_identity        (PII 만, 별도 schema, 접근 권한 분리)
  patient_id, name, phone, rrn_hashed, dob, ...

patients_clinical        (PHI 만, pseudonym 기반)
  patient_pseudonym_id, diagnosis, severity, onset_at, ...

patient_id_mapping       (lookup, 매우 제한된 접근)
  patient_id → patient_pseudonym_id

기타 (training_history, kwab_results, ...) — patient_pseudonym_id 만 참조
```

## 4. 마이그레이션 단계 (별도 세션)

### Phase 1 (D+0 ~ D+30) — 비파괴 추가

1. `patients_identity` schema 생성 (기존 patients 테이블 그대로 유지)
2. `patient_id_mapping` 테이블 생성 + 기존 데이터 backfill
3. 코드 측 dual-write — 신규 가입 시 양쪽 모두 작성
4. 신규 라우트는 patient_pseudonym_id 만 받도록

### Phase 2 (D+30 ~ D+60) — 읽기 분리

1. patients 테이블 read 경로를 `patient_id_mapping` 통해서만 허용
2. PII 직접 read 는 `lib/server/identityAccess.ts` (신규) 통해서만 + audit log 강제
3. RBAC 강화 — admin / 본인 / 담당 의료진 만 PII read

### Phase 3 (D+60 ~ D+90) — patients 컬럼 정리

1. patients 테이블에서 PII 컬럼 제거 (DROP COLUMN)
2. patients_clinical 으로 rename + 데이터 정리
3. 모든 테스트 회귀

### Phase 4 (D+90 ~) — 운영 검증

1. 30일 production 모니터링 — PII 직접 접근 시도 0 확인
2. audit log 분석 — 부적절한 접근 패턴 검색
3. 침투 시험 외주

## 5. 위험 + 완화

| 위험 | 완화 |
| --- | --- |
| 기존 query 호환성 깨짐 | dual-write Phase 1 로 비파괴 |
| Backfill 데이터 누락 | Phase 1 종료 전 일관성 검증 |
| Audit log volume 증가 | retention 5년 정책 + 압축 |
| 본 마이그레이션 중 보안 사고 | Phase 별 rollback 계획 |

## 6. 본 세션 한계

DB 마이그레이션은 운영 영향이 크므로 **별도 세션** 에서 (1) Phase 1 schema + dual-write 구현 + (2) 회귀 V&V 후 진행. 본 세션에서는 정책 문서 v0.1 만 산출.

## 7. 갱신 이력

- 2026-04-30 v0.1: 초안. 4 Phase + 위험 + 완화. 실제 마이그레이션은 별도 세션.
