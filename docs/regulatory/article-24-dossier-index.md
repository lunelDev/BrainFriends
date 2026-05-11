# Article 24 Dossier Index

작성일: 2026-05-08  
최종 갱신: 2026-05-11  
기준: `디지털의료제품 허가·인증·신고·심사 및 평가 등에 관한 규정` 제24조, 제25조, 제26조  
제품 포지션: 2등급 가능성 기준 독립형 디지털의료기기소프트웨어

## 1. 제출자료 묶음별 상태

| 제24조 자료 | 현재 내부 산출물 | 코드/기능 증적 | 상태 | 남은 작업 |
| --- | --- | --- | --- | --- |
| 1. 사용목적 및 작용원리 | `intended-use-and-contraindications.md`, `ai-role-boundary.md`, `claim-lock.md` | STT, 안면, 시선, AAC, K-WAB, 노래훈련 기능 | 일부 완료 | 기능별 사용자/환경/대상환자/입력/처리/출력/금기 표를 하나로 정리 |
| 2. 국내외 현황 및 개발경위 | `source-poststroke-dysarthria-dtx-requirements.md`, `claim-lock.md` | 개발 이력 일부 | 부족 | 유사제품, 언어재활/MIT 근거, 개발경위 5W1H 작성 |
| 3. SW 검증 및 유효성 | `srs.md`, `sds.md`, `traceability-matrix.md`, V&V export | `npm run test:vnv`, 결과 ZIP `dossier-index.json` | 일부 완료 | anomaly list, 재시험 결과, 영향평가, 수동 UI 점검기록 추가 |
| 4. 임상시험 등 평가 | `source-ai-clinical-stroke-requirements.md`, `source-poststroke-dysarthria-dtx-requirements.md`, `ai-evaluation-data-collection-guide.md` | WER/CER/RTF runner, 결과 저장 일부 | 부족 | 제25조 갈음 전략 확정, locked test set, gold label, 분석성능 결과표 |
| 5. 전자적 침해 보호조치 | `source-cybersecurity-requirements.md`, `cloud-and-data-transfer.md`, `pii-phi-separation-strengthening-plan.md` | 세션, rate limit, HMAC 감사로그, 일부 보안 테스트 | 일부 완료 | 백업/복구, 권한표, 감사로그 접근통제, 외부 침투시험 계획 |
| 6. 사용적합성 | `usability-evaluation-protocol.md`, `usability-evaluation-irb-package.md`, `usability-evaluation-report-v1.0.md` | 사용자 화면/치료사 화면 구현 | 계획 완료 | formative/summative 실제 수행 결과 |
| 7. 전문가용 SW 자료 | `ai-role-boundary.md`, `claim-lock.md` | 결과 ZIP `reviewRequired`, 치료사 화면 일부 | 일부 완료 | 전문가용 IFU, 치료사 검토 완료 로그, reviewRequired workflow |
| 8. 변경관리 계획서 | `change-approval-sop.md`, `pms-capa-procedure.md`, `docs/security/manifest/latest-change-dossier.*` | release manifest + anomaly/retest/impact export | 일부 완료 | 실제 release별 수동 anomaly 입력, 승인자, 변경 검증 기준 운영 |

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
| 1 | 결과 ZIP에 원음, transcript, scoreReason, reviewRequired, 측정품질, 심사 인덱스 고정 | 제25조 분석성능 갈음과 제26조 V&V/임상자료의 원자료. 2026-05-11 `dossier-index.json` / `README-regulatory.txt` / `bf-result-json-v1` 적용 완료 |
| 2 | release manifest에 anomaly/retest/impact 추가 | 제26조 SW 변경 후 재시험·영향평가 대응. 2026-05-11 `latest-change-dossier.json/md/csv` 적용 완료 |
| 3 | 치료사 검토 화면에 원음 재생과 정오답 검토 저장 | AI 보조지표 경계와 전문가용 SW 자료 대응 |
| 4 | locked test set + SLP gold label 구조 고정 | 임상 사용환경 고려 분석성능 검증 핵심 |
| 5 | 보안 권한표/백업복구/감사로그 접근통제 추가 | 제24조 보호조치와 제26조 사이버보안 자료 대응 |

## 3.1 2026-05-11 로컬 결과 ZIP 표준화 반영

대상 화면: 자가점검, 언어재활, 노래훈련 결과 다운로드.

공통 적용:

- `result.json`에 `schemaVersion: bf-result-json-v1`, `review`, `measurementQuality`, `scoreReason` 추가
- ZIP 루트에 `dossier-index.json` 추가
- ZIP 루트에 `README-regulatory.txt` 추가
- `review.claimBoundary`는 `claim-lock.md` 기준으로 “치료사 검토용 보조 지표이며 의학적 진단·처방·치료 결정을 대체하지 않음”으로 고정
- `dossier-index.json`에는 제24조 대응 목적, 과제/step/곡 `taskContext`, 로컬 증적 파일 목록, 서버 필요 여부, 후속 서버 증적 항목을 포함

아직 서버가 필요한 후속 항목:

- 치료사 검토 완료 상태 저장
- 서버 감사로그와 결과 ZIP 다운로드 이력 연결
- 기관/치료사 권한 기반 원자료 접근통제
- DB 영구 저장 후 release manifest 및 변경관리 이력과 연결

## 3.2 2026-05-11 WASM-STT 제품 경로 격리

결정: 2등급 SaMD 허가 준비 기준에서 제품 STT는 서버 보안 프록시를 기본 경로로 고정한다. WASM-STT는 제품 기능·성능 클레임 근거로 사용하지 않고 개발 검증 후보로만 보존한다.

적용:

- `sttPolicy.ts` / `sttRuntime.ts`: 일반 훈련 runtime에서 `wasm_whisper` 선택 경로 제거
- `SpeechAnalyzer.ts`: WASM-STT adapter 동적 import 및 lifecycle callback 제거
- step-2, step-4, step-5, 노래훈련, 문장 게임: WASM-STT 로딩 UI 제거
- `/dev/wasm-stt-test`: 개발 검증 화면으로만 WASM-STT 직접 호출 유지
- V&V: 브라우저 WASM 사용 가능 여부와 관계없이 제품 runtime이 `server_whisper`로 고정되는지 검증

허가 문구 영향:

- “완전 온디바이스 STT”, “원본 음성 미전송”, “WASM-STT 적용”은 계속 금지
- “음성 인식은 제품 기본값으로 브레인프렌즈 서버의 보안 STT 프록시를 통해 처리”로 고정

## 3.3 2026-05-11 Release Change Dossier 반영

대상 산출물:

- `docs/security/manifest/latest-change-dossier.json`
- `docs/security/manifest/latest-change-dossier.md`
- `docs/security/manifest/latest-change-dossier.csv`

공통 적용:

- release manifest 이전/다음 hash 비교
- added / removed / changed component delta 산출
- `analyzeChangeImpact()` 기반 영향받는 SR-* 요구사항 및 변경허가 필요 여부 산출
- anomaly list 상태(open/fixed/deferred/accepted_risk/not_reproducible) 정규화
- retest record 상태(pass/fail/blocked/not_run) 정규화
- 변경 component별 재시험 coverage 산출
- release gate를 `ready_for_review`, `requires_manual_review`, `blocked` 중 하나로 산출

실행:

- `npm run security:change-dossier`
- `npm run security:all` 실행 시 SBOM/SOUP/audit/manifest 후 자동 실행

제26조 대응:

- anomaly list: SW 변경 후 발견된 문제 목록과 처분 상태
- retest result: 변경 영향 component 별 재시험 결과와 증거
- impact assessment: release manifest delta 기반 영향받는 요구사항과 변경허가 필요 여부

## 4. 제출 전 금지 판단

- 이 인덱스는 내부 준비표이며 식약처 제출자료 자체가 아니다.
- 제25조 갈음 가능성은 아직 확정이 아니다.
- 실제 시험기관 성적서, 사전검토 결과통지서, GMP 적합 자료, 사용적합성 결과가 확보되기 전에는 `증적 확보 완료`로 표시하지 않는다.
