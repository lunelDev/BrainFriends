# PMS / CAPA 운영 절차서 v0.1

작성일: 2026-04-30
근거: ISO 13485:2016 §8.5 / 식약처 GMP [별표3] 5장
관련: `post-market-surveillance-plan.md`

## 1. 목적

이상반응 / 사용성 / AI 성능 / 보안 incident 의 수집부터 시정·예방조치 (CAPA) 종료까지의 표준 운영 절차.

## 2. CAPA 케이스 라이프사이클

```
오픈 → 원인분석 → 조치계획 → 조치실행 → 검증 → 종료
       (RCA)      (CAP)       (CA)        (V)     (Closed)
```

| 단계 | 산출물 | 책임 | 기한 |
| --- | --- | --- | --- |
| 오픈 | CAPA-ID 발급, 트리거 사유 기록 | PMS 책임자 | 즉시 (severe) / D+7 (기타) |
| RCA | 원인분석 보고서 (5 Why / Fishbone) | 개발/의료자문 | D+14 |
| CAP | 조치계획 + 일정 | 개발 책임자 | D+21 |
| CA | 코드/문서/프로세스 변경 | 담당자 | D+60 |
| V | V&V 회귀 + 효과 검증 | QM | D+75 |
| Closed | 종료 보고 + risk-management 갱신 | PMS 책임자 | D+90 |

## 3. CAPA 케이스 양식

```yaml
capa_id: CAPA-2026-001
opened_at: 2026-MM-DD
trigger:
  type: adverse_event | usability | ai_drift | security_incident
  source: <보고 출처>
  severity: minor | moderate | severe
description: <한국어 1~2 문장>
root_cause: <RCA 결과>
corrective_action:
  - <code/doc/process change>
preventive_action:
  - <재발 방지 조치>
verification: <V&V 결과>
closed_at: 2026-MM-DD
risk_management_impact:
  - RM-XXX P 값 변경
```

## 4. CAPA 보관

- 각 케이스: `docs/operations/capa/CAPA-YYYY-NNN.yaml`
- 분기 보고: `docs/operations/capa/quarterly-YYYY-Q{N}.md`

## 5. 갱신 이력

- 2026-04-30 v0.1: 초안. 라이프사이클 6단계 + 양식 + 보관 정책.
