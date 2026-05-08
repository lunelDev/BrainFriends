# Regulatory Source Audit

작성일: 2026-05-07  
목적: 제공받은 식약처/NIDS 원문 자료가 브레인프렌즈 내부 문서와 개발 우선순위에 어떻게 반영됐는지 추적한다.

## 1. 현재 감사 원칙

- 원문을 확인하지 않은 요구사항은 "적용 완료"로 표시하지 않는다.
- 원문 기준이 내부 문서에 반영되었더라도, 실제 시험/임상/사용성평가를 수행하지 않은 항목은 "문서 반영"과 "증적 확보"를 분리한다.
- NIDS 상담노트는 내부 참고 자료이며 공식 제출 근거로 쓰지 않는다.
- 제품기획서보다 오늘 제공한 식약처/NIDS 자료를 우선 기준으로 삼는다.

## 2. 원문 자료 목록

| 원문 | 현재 처리 상태 | 내부 반영 문서 |
| --- | --- | --- |
| `NIDS_상담노트_브레인프렌즈.docx` | 요구사항 20개 추출 완료 | `source-nids-consultation-requirements.md`, `mfds-guideline-basis.md`, `gmp-qms-decision-matrix.md` |
| `디지털의료제품 분류 및 등급 지정 등에 관한 규정(식품의약품안전처고시 제2026-4호)` | 원문 추출 완료. 독립형 SW 기능, 인프라, 제품군, 등급 확정 시점, 사전검토 연결 | `source-digital-medical-product-notice-2026-requirements.md`, `class-2-samd-readiness-matrix.md` |
| `디지털의료제품법에 따른 기관 지정 등에 관한 규정(식품의약품안전처고시 제2026-5호)` | 원문 추출 완료. 성능검사/규제지원/인증업무 수탁기관 지정 절차 확인 | `source-digital-medical-product-notice-2026-requirements.md` |
| `디지털의료제품 허가·인증·신고·심사 및 평가 등에 관한 규정(식품의약품안전처고시 제2026-6호)` | 원문 추출 완료. 제24조/제25조/제26조를 필수 제출자료 기준으로 반영 | `source-digital-medical-product-notice-2026-requirements.md`, `regulatory-master-map.md`, `class-2-samd-readiness-matrix.md` |
| `디지털의료기기 분류 및 등급 지정 등에 관한 가이드라인.pdf` | 요구사항 18개 추출 완료 | `source-classification-grade-requirements.md`, `mfds-guideline-basis.md`, `digital-medical-product-gap-matrix.md` |
| `디지털의료기기 분류 및 등급 지정 등에 관한 가이드라인 개정안(최종).pdf` | 최신 분류 기준 우선 문서로 지정 | `mfds-guideline-basis.md` |
| `인공지능기술이 적용된 디지털의료기기의 허가·심사 가이드라인.pdf` | AI 허가·심사 6개 항목 별도 대응표 작성 | `mfds-ai-permit-review-response.md`, `permit-readiness-internal-standard.md` |
| `인공지능기술이 적용된 디지털의료기기의 임상시험계획서 작성 가이드라인 - 허혈성 뇌졸중.pdf` | 요구사항 35개 추출 완료 | `source-ai-clinical-stroke-requirements.md`, `test-and-certification-development-guide.md`, `digital-medical-product-gap-matrix.md` |
| `의료기기의 사이버보안 허가·심사 가이드라인.pdf` | 35개 요구사항 추출 완료 | `source-cybersecurity-requirements.md`, `cloud-and-data-transfer.md`, `risk-management-file.md`, `traceability-matrix.md` |
| `뇌졸중 후 마비말장애 개선 디지털치료기기 안전성·성능 평가 및 임상시험계획서 작성 가이드라인.pdf` | 요구사항 35개 추출 완료 | `source-poststroke-dysarthria-dtx-requirements.md`, `claim-lock.md`, `test-and-certification-development-guide.md` |
| `디지털의료기기 GMP 가이드라인.pdf` | 요구사항 30개 추출 완료 | `source-gmp-requirements.md`, `gmp-qms-decision-matrix.md`, `usability-evaluation-protocol.md` |

## 3. 중요 요구사항 반영 상태

| 요구사항 묶음 | 문서 반영 | 증적 확보 | 비고 |
| --- | --- | --- | --- |
| 제조업 허가 → GMP → 품목 인허가 순서 | 완료 | 미확보 | 실제 제조업/GMP 진행 필요 |
| 고시 제24조 첨부서류 8종 | 완료 | 일부 | 사용목적/개발경위/V&V/임상 또는 갈음/보안/사용성/전문가용/변경관리 인덱스 필요 |
| 고시 제25조 면제·갈음 전략 | 완료 | 미확보 | 2등급 보조지표 전략은 가능성. 분석성능 검증셋과 식약처 인정 필요 |
| 고시 제26조 첨부서류 요건 | 완료 | 일부 | 기능별 입출력/처리원리, anomaly/retest/impact, 전문가용 IFU, AI 변경관리 계획 보강 필요 |
| SaMD 기준, DTx는 후속 또는 동시 검토 | 완료 | 미확보 | 식약처 질의 회신 필요 |
| AI 허가·심사 6개 항목 | 완료 | 일부 | 학습데이터/클라우드 표는 실값 필요 |
| AI 후향적 임상시험계획 | 문서 반영 | 미확보 | 독립 시험셋, 참조표준, gold label, 통계계획 필요 |
| AI 역할 경계 | 완료 | 일부 | 치료사 검토 화면과 로그 증적 필요 |
| IEC 62366 형성/총괄 평가 | 계획 보강 완료 | 미확보 | 실제 formative/summative 평가 필요 |
| IEC 62304 SRS/SDS/traceability | 일부 완료 | 일부 | GMP 원문 기준으로 release manifest, SOUP, 문제보고, 변경관리까지 연결 필요 |
| GMP 형상관리/릴리스/문제보고 | 문서 반영 | 일부 | 출시기록, 잔여위험, 문제보고-CAPA export 구현 필요 |
| 사이버보안 35항목 | 일부 완료 | 일부 | 사업자/보존/위탁 처리 표 보강 필요 |
| 임상시험 필요성 | 문서 반영 | 미확보 | 치료효과 클레임은 임상 전 금지 |
| 마비말장애 DTx 성능/임상 지표 | 문서 반영 | 미확보 | 말 명료도, MPT, DDK, PCC, PHQ-9, QoL-Dys 실측 필요 |
| 분류·등급 → GMP → 개발 증빙 연결 | 완료 | 일부 | `regulatory-master-map.md`와 `source-classification-grade-requirements.md` §7에 통합 |
| 2등급 SaMD 준비 기준 | 완료 | 일부 | `class-2-samd-readiness-matrix.md`에 완료/미완료 개발 항목 정리 |

## 4. 현재 미확정 항목

- 최종 품목분류와 등급
- DTx 동시 신청 여부
- 임상시험 면제 가능 여부
- 제25조에 따른 임상자료 갈음 인정 가능 여부
- GMP 자체/외주/하이브리드 운영 방식
- 클라우드 사업자, 저장 위치, 보존 기간
- STT/AI 평가셋 샘플 수, 수집 기관, 라벨링 기준
- IEC 62366 실제 formative/summative 평가 결과
- 외부 시험기관 또는 위탁기관 선정 여부

## 5. 다음 감사 작업

1. 원문별 요구사항을 페이지/절 단위로 쪼개 `요구사항 ID`를 부여한다.
2. 각 요구사항을 `docs/regulatory/*`, 코드 모듈, V&V 테스트에 매핑한다.
3. `문서 반영`, `코드 반영`, `시험 증적`, `외부 확인 필요`를 분리해 상태를 표시한다.
4. 누락 항목은 `digital-medical-product-gap-matrix.md`의 개발 우선순위에 반영한다.

## 6. 주의

이 문서는 현재 "초기 감사표"이다. 원문 전체를 페이지 단위로 대조한 최종 감사 결과가 아니다. 최종 제출 전에는 원문별 요구사항 추출표와 내부 산출물 매핑표를 별도로 완성해야 한다.
