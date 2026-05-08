# Article 24 Dossier Index

작성일: 2026-05-08  
기준: `디지털의료제품 허가·인증·신고·심사 및 평가 등에 관한 규정` 제24조, 제25조, 제26조  
제품 포지션: 2등급 가능성 기준 독립형 디지털의료기기소프트웨어

## 1. 제출자료 묶음별 상태

| 제24조 자료 | 현재 내부 산출물 | 코드/기능 증적 | 상태 | 남은 작업 |
| --- | --- | --- | --- | --- |
| 1. 사용목적 및 작용원리 | `intended-use-and-contraindications.md`, `ai-role-boundary.md`, `claim-lock.md` | STT, 안면, 시선, AAC, K-WAB, 노래훈련 기능 | 일부 완료 | 기능별 사용자/환경/대상환자/입력/처리/출력/금기 표를 하나로 정리 |
| 2. 국내외 현황 및 개발경위 | `source-poststroke-dysarthria-dtx-requirements.md`, `claim-lock.md` | 개발 이력 일부 | 부족 | 유사제품, 언어재활/MIT 근거, 개발경위 5W1H 작성 |
| 3. SW 검증 및 유효성 | `srs.md`, `sds.md`, `traceability-matrix.md`, V&V export | `npm run test:vnv`, 결과 ZIP 일부 | 일부 완료 | anomaly list, 재시험 결과, 영향평가, 수동 UI 점검기록 추가 |
| 4. 임상시험 등 평가 | `source-ai-clinical-stroke-requirements.md`, `source-poststroke-dysarthria-dtx-requirements.md`, `ai-evaluation-data-collection-guide.md` | WER/CER/RTF runner, 결과 저장 일부 | 부족 | 제25조 갈음 전략 확정, locked test set, gold label, 분석성능 결과표 |
| 5. 전자적 침해 보호조치 | `source-cybersecurity-requirements.md`, `cloud-and-data-transfer.md`, `pii-phi-separation-strengthening-plan.md` | 세션, rate limit, HMAC 감사로그, 일부 보안 테스트 | 일부 완료 | 백업/복구, 권한표, 감사로그 접근통제, 외부 침투시험 계획 |
| 6. 사용적합성 | `usability-evaluation-protocol.md`, `usability-evaluation-irb-package.md`, `usability-evaluation-report-v1.0.md` | 사용자 화면/치료사 화면 구현 | 계획 완료 | formative/summative 실제 수행 결과 |
| 7. 전문가용 SW 자료 | `ai-role-boundary.md`, `claim-lock.md` | 치료사 화면 일부 | 일부 완료 | 전문가용 IFU, 치료사 검토 완료 로그, reviewRequired workflow |
| 8. 변경관리 계획서 | `change-approval-sop.md`, `pms-capa-procedure.md` | release/export 일부 | 부족 | AI/STT/채점모델 변경관리 계획, 모델 버전, 변경 검증 기준 |

## 2. 제25조 갈음 전략

현재 BrainFriends는 `임상적 치료효과 입증`을 전면 주장하지 않고, `치료사 검토용 보조지표`로 경계를 잠그는 전략이 가장 안전하다.

| 전략 | 가능성 | 전제 조건 |
| --- | --- | --- |
| 임상시험 자료 전체 제출 | 가장 보수적 | DTx/치료효과 주장, 확증 임상, IRB, 통계계획 필요 |
| 2등급 SW 분석성능 검증으로 일부 갈음 | 현실적 후보 | locked test set, 실제 원음, gold label, WER/CER/RTF/PCC, 임상 사용환경 고려 |
| 정보제공·관리 목적 일부 갈음 | 가능하지만 문구 제한 큼 | “치료효과”보다 “경과 모니터링/보조지표” 중심으로 사용목적 제한 |
| 우수 관리체계 인증에 따른 자료 면제 | 장기 후보 | 우수 관리체계 인증서 확보 전에는 적용 완료로 표시 금지 |

## 3. 개발 우선순위

| 순서 | 작업 | 이유 |
| --- | --- | --- |
| 1 | 결과 ZIP에 원음, target, transcript, scoreReason, reviewRequired, model/app/doc version 고정 | 제25조 분석성능 갈음과 제26조 V&V/임상자료의 원자료 |
| 2 | release manifest에 anomaly/retest/impact 추가 | 제26조 SW 변경 후 재시험·영향평가 대응 |
| 3 | 치료사 검토 화면에 원음 재생과 정오답 검토 저장 | AI 보조지표 경계와 전문가용 SW 자료 대응 |
| 4 | locked test set + SLP gold label 구조 고정 | 임상 사용환경 고려 분석성능 검증 핵심 |
| 5 | 보안 권한표/백업복구/감사로그 접근통제 추가 | 제24조 보호조치와 제26조 사이버보안 자료 대응 |

## 4. 제출 전 금지 판단

- 이 인덱스는 내부 준비표이며 식약처 제출자료 자체가 아니다.
- 제25조 갈음 가능성은 아직 확정이 아니다.
- 실제 시험기관 성적서, 사전검토 결과통지서, GMP 적합 자료, 사용적합성 결과가 확보되기 전에는 `증적 확보 완료`로 표시하지 않는다.
