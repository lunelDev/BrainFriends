# 브레인프렌즈 문서 목적 인덱스

작성일: 2026-04-29  
목적: 레포 안 문서가 각각 무엇을 보기 위한 문서인지 한 줄로 파악하기 위한 안내서

## 먼저 볼 문서

| 문서 | 용도 |
| --- | --- |
| `docs/regulatory/digital-medical-product-gap-matrix.md` | 디지털의료제품 관점에서 지금 뭐가 부족한지 보는 PM 갭 로드맵 |
| `docs/regulatory/claim-lock.md` | 외부 자료에 써도 되는 말과 쓰면 안 되는 말을 잠그는 클레임 통제표 |
| `docs/regulatory/intended-use-and-contraindications.md` | 1차 허가 범위, 대상 환자, 제외 대상, 금기·주의사항을 고정하는 문서 |
| `docs/regulatory/risk-management-file.md` | ISO 14971 관점에서 위해요인, 위험통제, 잔여위험을 정리한 위험관리 초안 |
| `docs/regulatory/traceability-matrix.md` | RM/SR/구현 파일/V&V/제출 증적을 한 표로 연결하는 추적성 매트릭스 |
| `docs/regulatory/cloud-and-data-transfer.md` | 브라우저·서버·외부 STT 서비스로 어떤 데이터가 이동하는지 정리한 데이터 전송 명세 |
| `docs/regulatory/ai-role-boundary.md` | AI·알고리즘 결과가 진단/치료 결정이 아니라 의료진 보조 지표임을 모듈별로 고정한 문서 |
| `docs/remediation/00-summary/spec-gap-roadmap.md` | 제품제안서 클레임과 현재 코드 사이의 기능 갭과 개발 우선순위를 보는 문서 |
| `docs/remediation/00-summary/submission-readiness-summary.md` | 제출 준비 상태를 한 장으로 요약해서 보는 문서 |
| `docs/remediation/00-summary/submission-pack-index.md` | 제출 패키지에 어떤 문서가 들어가야 하는지 보는 목차 |
| `docs/remediation/README.md` | 공인성적서·SaMD 대응 문서 묶음의 시작점 |

## regulatory

디지털의료제품 허가·심사 방향을 잡기 위한 최신 PM 기준 문서다.

| 문서 | 용도 |
| --- | --- |
| `claim-lock.md` | 제안서, IRB, 허가자료, 소개자료에서 사용할 제품 클레임을 통제하는 문서 |
| `digital-medical-product-gap-matrix.md` | 디지털의료제품 관점에서 허가·심사 갭과 개발 우선순위를 보는 PM 로드맵 |
| `intended-use-and-contraindications.md` | 사용목적, 대상 환자, 사용 환경, 금기·주의사항을 허가 문구에 가깝게 정리한 문서 |
| `risk-management-file.md` | 주요 위험, 위해, 위험통제, 검증 근거를 ISO 14971 형식으로 정리한 문서 |
| `traceability-matrix.md` | 위험관리 ID, 소프트웨어 요구사항, 구현 파일, V&V 테스트, 제출 증적을 연결하는 문서 |
| `cloud-and-data-transfer.md` | 온디바이스 처리 범위, 서버 저장, 외부 STT 전송, version metadata를 정리한 문서 |
| `ai-role-boundary.md` | STT, 안면, 시선, AAC, K-WAB별 허용 사용과 금지 사용을 정리한 AI 역할 경계 문서 |

## remediation/00-summary

공인성적서, SaMD 제출, 제품 정의, 시험기관 대응을 위한 요약 문서 묶음이다.

| 문서 | 용도 |
| --- | --- |
| `account-onboarding-redesign.md` | 계정 생성과 온보딩 흐름을 제출·운영 관점에서 재설계한 문서 |
| `brainfriends-product-definition-one-pager.md` | 브레인프렌즈 제품 정의를 한 장으로 설명하는 문서 |
| `dtx-intended-use-statements.md` | 디지털치료기기 또는 SaMD 사용목적 문구 후보를 정리한 문서 |
| `mfds-guideline-gap-analysis.md` | 식약처 가이드라인 기준으로 현재 산출물 부족분을 보는 문서 |
| `organization-role-scope-design.md` | 병원, 치료사, 환자, 보호자, 관리자 역할과 권한 범위를 정리한 문서 |
| `samd-document-map.md` | SaMD 제출에 필요한 문서 종류와 현재 문서 위치를 매핑한 문서 |
| `samd-document-paths.md` | SaMD 관련 산출물 파일 경로를 찾기 쉽게 정리한 문서 |
| `samd-gap-checklist.md` | SaMD 제출 관점에서 해야 할 일을 체크리스트로 보는 문서 |
| `signup-field-inventory.md` | 회원가입과 사용자 등록 필드가 무엇인지 점검하는 문서 |
| `spec-gap-roadmap.md` | 제품제안서와 코드 구현 사이의 갭을 P0/P1/P2로 정리한 개발 로드맵 |
| `submission-pack-index.md` | 제출 패키지 전체 목차와 포함 문서를 보는 인덱스 |
| `submission-readiness-summary.md` | 제출 가능 상태인지 빠르게 판단하기 위한 준비도 요약 |
| `submission-test-environment.md` | 시험기관이나 심사 대응용 테스트 환경 조건을 정리한 문서 |
| `submission-version-guide.md` | 제출본의 버전, 빌드, 모델, 데이터셋 버전 관리를 위한 문서 |
| `test-lab-inquiry-one-pager.md` | 시험기관에 문의할 때 보낼 수 있는 한 장짜리 설명자료 |
| `test-lab-question-list.md` | 시험기관에 확인해야 할 질문 목록 |
| `test-lab-selection-criteria.md` | 시험기관을 고를 때 비교해야 할 기준 |
| `ui-design-gap-summary.md` | UI/UX가 제출·사용성평가 관점에서 부족한 부분을 보는 문서 |
| `ui-infographic-implementation-checklist.md` | UI 인포그래픽 구현 상태를 체크하는 문서 |
| `whisper-vs-parselmouth-boundary.md` | Whisper와 Parselmouth의 역할 경계를 정리한 음성분석 책임 분리 문서 |

## remediation/01-sw-vnv

소프트웨어 검증·검증(V&V) 제출 자료와 시험 운영 기준 문서다.

| 문서 | 용도 |
| --- | --- |
| `parselmouth-requirements.md` | Parselmouth 음향분석 서비스에 필요한 요구사항을 정리한 문서 |
| `sw-vnv-current-test-report.md` | 현재 자동/수동 V&V 결과를 요약한 시험 리포트 |
| `sw-vnv-defect-retest-log.md` | 결함 발견, 수정, 재시험 이력을 관리하는 문서 |
| `sw-vnv-execution-log-policy.md` | V&V 실행 로그를 어떻게 남기고 보관할지 정한 문서 |
| `sw-vnv-submission-outline.md` | 제출용 SW V&V 문서의 전체 구조를 잡은 문서 |
| `sw-vnv-test-plan.md` | 어떤 요구사항을 어떤 방법으로 검증할지 정한 시험계획서 |
| `sw-vnv-test-report-template.md` | 시험 후 결과를 작성하기 위한 리포트 템플릿 |

## remediation/02-cybersecurity

사이버보안, 데이터 저장, 민감정보 관리, 보안 제출 대응 문서다.

| 문서 | 용도 |
| --- | --- |
| `browser-server-storage-matrix.md` | 브라우저, 서버, 저장소 사이에서 어떤 데이터가 이동·저장되는지 보는 표 |
| `cybersecurity-final-readiness-report.md` | 사이버보안 제출 준비 상태를 최종 점검하는 리포트 |
| `cybersecurity-policy-decisions.md` | 보안 정책상 결정해야 하거나 결정한 사항을 모아둔 문서 |
| `cybersecurity-storage-inventory.md` | 어떤 데이터가 어디에 저장되는지 파악하기 위한 저장소 인벤토리 |
| `sensitive-data-classification.md` | 개인정보, 민감정보, 건강정보를 분류하고 처리 원칙을 정한 문서 |

## remediation/03-ai-evaluation

AI 성능평가, 데이터셋, gold label, 오류 분석을 위한 문서다.

| 문서 | 용도 |
| --- | --- |
| `ai-evaluation-current-report.md` | 현재 AI 성능평가 상태와 결과를 요약한 문서 |
| `ai-evaluation-dataset-definition.md` | AI 평가에 사용할 데이터셋 구성과 기준을 정의한 문서 |
| `ai-evaluation-error-case-log.md` | AI 오류 사례를 모아 원인과 조치 방향을 기록하는 문서 |
| `ai-evaluation-submission-outline.md` | AI 성능평가 제출 문서의 목차와 구조를 잡은 문서 |
| `ai-gold-label-definition.md` | AI 평가 기준 정답인 gold label을 어떻게 만들지 정의한 문서 |

## remediation/test-runs

자동 V&V 실행 결과가 날짜별 JSON으로 쌓이는 증적 폴더다.

| 파일 | 용도 |
| --- | --- |
| `2026-04-15/*-vnv-run.json` | 특정 시점의 V&V 실행 결과 원본 로그 |

## clinical

임상시험, IRB, 문헌근거, 연구자 섭외를 위한 문서다.

| 문서 | 용도 |
| --- | --- |
| `dtx-rct-protocol-skeleton-v0.1.md` | 디지털치료기기 RCT 임상시험계획서 골격 |
| `irb-data-collection-protocol-v0.1.md` | IRB 제출용 데이터 수집 연구계획서 초안 |
| `literature-survey-aphasia-digital-rehab-v0.1.md` | 실어증 디지털 재활 관련 문헌 근거를 정리한 문서 |
| `pi-candidate-list-and-outreach.md` | 임상 책임연구자 후보와 연락 전략을 정리한 문서 |

## submission

외부 제출, 전략 브리프, GMP 외주 문의용 문서다.

| 문서 | 용도 |
| --- | --- |
| `executive-brief-dtx-strategy.md` | 경영진·외부 파트너에게 설명할 DTx 전략 요약 |
| `gmp-outsourcing-rfp.md` | GMP/QMS 외주 업체에 보낼 RFP 초안 |

## business

사업화, 투자, 과제 지원을 위한 문서다.

| 문서 | 용도 |
| --- | --- |
| `investor-pitch-deck-outline.md` | 투자자 피치덱 구성을 잡기 위한 아웃라인 |
| `rd-grant-opportunities.md` | R&D 과제와 지원사업 기회를 정리한 문서 |

## 10-operations

운영, 개인정보, 백업, 감사로그, 음성분석 서비스를 다루는 문서다.

| 문서 | 용도 |
| --- | --- |
| `audit-log-schema.md` | 감사로그에 어떤 이벤트와 필드를 남길지 정의한 문서 |
| `patient-data-backup-and-delete-manual.md` | 환자 데이터 백업과 삭제 운영 절차를 정리한 문서 |
| `pii-phi-separation.md` | 식별정보와 건강정보를 분리 관리하기 위한 정책 문서 |
| `voice-analysis-service.md` | 별도 음성분석 서비스의 구조와 운영 방식을 설명한 문서 |

## 11-game-mode

게임형 훈련 모드의 큰 구조와 Next.js 구현 기준 문서다.

| 문서 | 용도 |
| --- | --- |
| `game-mode-current-status.md` | 게임 모드의 현재 구현 상태와 남은 일을 보는 문서 |
| `game-mode-nextjs-implementation-spec.md` | Next.js 안에서 게임 모드를 어떻게 구현할지 정한 명세 |
| `game-mode-overview.md` | 게임 모드 전체 컨셉과 흐름을 설명하는 문서 |
| `game-mode-stage-data.md` | 게임 단계별 데이터 구성을 정리한 문서 |
| `game-mode-stage-payload-reference.md` | 게임 stage payload 구조를 개발자가 참고하기 위한 문서 |

## 12-game-specs

각 게임별 상세 기획·구현 명세다.

| 문서 | 용도 |
| --- | --- |
| `balloon-growth-game-spec.md` | 풍선 성장 게임의 규칙, 입력, 피드백, 데이터 저장 기준을 정리한 문서 |
| `memory-game-spec.md` | 메모리 게임의 규칙, 단계, 점수 기준을 정리한 문서 |
| `sentence-magic-game-spec.md` | 문장 조합 게임의 규칙과 발화·문장 처리 방식을 정리한 문서 |
| `tetris-game-spec.md` | 테트리스형 훈련 게임의 규칙과 데이터 구조를 정리한 문서 |

## 13-reference

조음·발음 관련 이미지 참고자료다.

| 파일 | 용도 |
| --- | --- |
| `모음발달순서.png` | 모음 발달 순서를 참고하기 위한 이미지 |
| `발음방법 및 위치.png` | 자음의 발음 방법과 위치를 참고하기 위한 이미지 |
| `자음발달순서.png` | 자음 발달 순서를 참고하기 위한 이미지 |

## database

DB 스키마, 개발 초기화 SQL, 기능별 테이블 정의다.

| 문서 | 용도 |
| --- | --- |
| `account-onboarding-redesign.sql` | 계정·온보딩 재설계에 필요한 DB 변경 SQL |
| `adverse_events.sql` | 이상반응 보고 기능에 필요한 테이블 정의 |
| `brainfriends_dev.sql` | 개발 환경용 전체 또는 주요 DB 스키마 |
| `brainfriends_test_init.sql` | 테스트 환경 초기화를 위한 SQL |
| `prescriptions.sql` | 처방 기반 운영 기능에 필요한 테이블 정의 |
| `user_2fa.sql` | 사용자 2단계 인증 기능에 필요한 테이블 정의 |

## decisions

이미 내린 주요 기술·제품 의사결정 기록이다.

| 문서 | 용도 |
| --- | --- |
| `2026-04-21-phase1-users-migration-and-parselmouth-fit.md` | Phase 1 사용자 마이그레이션과 Parselmouth 적용 판단 기록 |
| `2026-04-21-rollback-playbook.md` | 문제 발생 시 되돌리는 절차를 정리한 롤백 플레이북 |
| `2026-04-21-unified-target-schema.md` | 통합 target schema에 대한 의사결정 기록 |

## security

보안 문서의 별도 진입점이다.

| 문서 | 용도 |
| --- | --- |
| `README.md` | 보안 관련 문서와 원칙을 보기 위한 시작점 |

## 최종 권장 사용법

| 상황 | 보면 되는 문서 |
| --- | --- |
| 지금 뭘 먼저 해야 하는지 보고 싶다 | `regulatory/digital-medical-product-gap-matrix.md`, `remediation/00-summary/spec-gap-roadmap.md` |
| 제안서 문구를 검토하고 싶다 | `regulatory/claim-lock.md` |
| 허가 범위와 대상 환자를 정해야 한다 | `regulatory/intended-use-and-contraindications.md` |
| 위험관리와 V&V 우선순위를 정해야 한다 | `regulatory/risk-management-file.md` |
| 시험기관에 보낼 준비를 한다 | `remediation/00-summary/test-lab-inquiry-one-pager.md`, `test-lab-question-list.md`, `test-lab-selection-criteria.md` |
| SW V&V를 준비한다 | `remediation/01-sw-vnv/sw-vnv-test-plan.md`, `sw-vnv-current-test-report.md` |
| 사이버보안 대응을 한다 | `remediation/02-cybersecurity/cybersecurity-final-readiness-report.md` |
| AI 성능평가를 준비한다 | `remediation/03-ai-evaluation/ai-evaluation-dataset-definition.md`, `ai-evaluation-current-report.md` |
| 임상/IRB를 준비한다 | `clinical/irb-data-collection-protocol-v0.1.md`, `clinical/dtx-rct-protocol-skeleton-v0.1.md` |
