# 변경허가 신청 SOP v0.1

작성일: 2026-04-30
근거: 의료기기법 §13 변경허가 / 식약처 디지털의료기기 GMP [별표3] 1.1.7 형상관리 / AI 적용 가이드라인 PDF #2 §III.5
관련: `lib/server/changeImpactAnalysis.ts` (`SR-CHANGE-016`), release manifest

## 1. 목적

브레인프렌즈 SaMD 의 STT 모델 / scoring 로직 / UI / 통신 / 사용목적 변경 발생 시 변경허가 신청 또는 사후 신고 여부를 판정하고 절차를 따른다.

## 2. 변경 분류 (식약처 기준)

| 변경 유형 | 분류 | 신고 의무 |
| --- | --- | --- |
| 사용목적 변경 | major | 변경허가 신청 (사전) |
| 작용원리 변경 | major | 변경허가 신청 (사전) |
| AI 모델 교체 (Whisper-tiny → KoWhisper) | major | 변경허가 신청 (사전) |
| Scoring 로직 변경 (KWABScoring 가중치) | major | 변경허가 신청 (사전) |
| UI 통신 방식 변경 (REST → WebSocket 등) | major | 변경허가 신청 (사전) |
| Library 업그레이드 (next 16.1 → 16.2) | minor | 사후 신고 (분기) |
| Bug fix (사용자 경험 영향 없음) | patch | 내부 기록만 |

## 3. 자동 판정

`analyzeChangeImpact(prev, next)` 가 release manifest delta → 자동 분류:

```ts
// 모델 자산 변경 → major + requiresRegulatoryFiling=true
// ≥ 3 component 동시 변경 → major + requiresRegulatoryFiling=true
// package-lock 또는 SBOM 변경 → minor
// git-sha 만 → patch
```

`requiresRegulatoryFiling=true` 시 본 SOP §4 절차 의무 발동.

## 4. 변경허가 신청 절차

| 단계 | 산출물 | 기한 |
| --- | --- | --- |
| 1. 영향평가 | `analyzeChangeImpact` 결과 + RM-* 영향 표 | D+0 |
| 2. V&V 회귀 | `npm run test:vnv` 49+ TC PASS | D+3 |
| 3. AI 성능 재평가 | npm run ai-eval:wer / rtf 결과 | D+14 (모델 변경 시) |
| 4. 사용성평가 영향 | use scenario 12종 영향 검토 | D+7 |
| 5. 위험관리 갱신 | `risk-management-file.md` v 갱신 | D+10 |
| 6. 변경허가 신청서 작성 | 식약처 양식 + §1~5 산출물 첨부 | D+21 |
| 7. 식약처 제출 | 신청서 + 수수료 | D+25 |
| 8. 회신 수령 | 변경허가증 또는 보완 요청 | D+90 ~ D+180 |

## 5. 사후 신고 (minor)

분기 1회 일괄 보고:
- 영향평가 결과 (`analyzeChangeImpact`)
- V&V 회귀 PASS 증적
- CVE 면제 등록부 갱신 사항
- 시판 후 감시 데이터 (해당 시)

## 6. 갱신 이력

- 2026-04-30 v0.1: 초안. 변경 분류 7종 + 자동 판정 + 신청 절차 8단계 + 사후 신고.
