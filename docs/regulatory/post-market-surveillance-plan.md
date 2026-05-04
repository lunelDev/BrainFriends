# 시판 후 감시 (PMS) 계획 v0.1

작성일: 2026-04-30
근거: 식약처 디지털의료기기 GMP [별표3] 5장 시판 후 안전관리 / ISO 13485:2016 §8.2 / 의료기기법 §31 시판 후 안전관리
관련: `risk-management-file.md` v1.0, `adverseEventReview.ts`, `adverse_events.sql`

## 1. 목적

본 계획은 1차 SaMD 시판 후 (시판 후 4주 ~ 4년) 안전성·유효성·사용성 데이터를 수집·분석·보고하는 활동을 정의한다.

## 2. PMS 활동 범위

| 항목 | 수집 방법 | 보고 주기 |
| --- | --- | --- |
| 이상반응 보고 | adverse-events API + 사용자 신고 + 치료사 신고 | 즉시 (severe) / 분기 (전체) |
| 사용성 이슈 | 사용자 인터뷰 + helpdesk 티켓 | 분기 |
| AI 성능 drift | npm run ai-eval:wer 정기 재실행 (분기 30건 신규) | 분기 |
| 보안 incident | audit log 모니터링 + WAF | 즉시 (해당 시) |
| 의료기기 사고 | KAERS 보고 (해당 시) | 즉시 |

## 3. CAPA (시정·예방조치) 트리거

| 트리거 | 대응 |
| --- | --- |
| 동일 카테고리 이상반응 ≥ 3건 / 분기 | CAPA 케이스 오픈 + 위험관리 파일 §5 P 값 재산정 |
| AI 성능 (meanWer) 분기 대비 +10%p 악화 | 모델 재calibration 또는 회귀 |
| 보안 incident 발생 | 즉시 cve-exemptions §3 행 추가 + reachability 평가 |
| 사용성평가 critical task 통과율 < 100% (재평가 시) | UI 변경 + summative 재실시 |

## 4. 보고 의무

- **식약처 정기 보고**: 시판 후 1년 + 매 4년 (의료기기법 §31)
- **시정 조치 보고**: KAERS 즉시 보고 (severe AE)
- **변경허가 신청**: STT 모델 / scoring / UI 변경 시 (`analyzeChangeImpact` 자동 판정)

## 5. 운영 인력

| 역할 | 책임 |
| --- | --- |
| PMS 책임자 | 분기 보고서 작성, KAERS 보고, CAPA 운영 |
| 의료자문 | 이상반응 의학적 판단 |
| 보안 책임자 | audit log 모니터링, 보안 incident 대응 |
| 개발 책임자 | 모델 drift 감지, 회귀 V&V |

## 6. 데이터 보존

- 이상반응 데이터: 시판 종료 + 7년
- AI 성능 보고서: 시판 종료 + 7년 (변경관리 증적)
- 사용성 이슈: 시판 종료 + 5년
- 보안 audit log: 시판 종료 + 5년

## 7. 갱신 이력

- 2026-04-30 v0.1: 초안. 5 활동 + CAPA 트리거 4종 + 보고 의무 + 운영 인력 + 데이터 보존.
