# 브레인프렌즈 DTx IRB 호환 데이터 수집 프로토콜 v0.1

- 제품: 브레인프렌즈 DTx (실어증·디스아트리아 환자용 언어재활 디지털치료기기)
- 제조자: (주)골든브레인케어
- 문서 버전: v0.1 (초안 / draft)
- 작성일: 2026-04-24
- 담당: 임상·데이터 관리 TF
- 상태: **초안 — 임상시험 PI, 병원 IRB 사무국, 개인정보보호책임자(CPO) 검토 필수**

> 본 문서는 DTx 직행 전략 하에서 향후 탐색적 임상시험(Pilot) 및 확증 임상시험(RCT, Task #81 참고)에 그대로 재활용 가능한 수준의 데이터 수집 프로토콜을 제공하는 것을 목표로 한다.

---

## 1. 목적

1.1 브레인프렌즈 DTx 임상시험 중 수집되는 사용자 음성·영상·수행 데이터·임상 상태 데이터의 **수집·저장·분석·폐기** 절차를 임상시험 호환 수준으로 정립한다.

1.2 본 프로토콜은 다음을 충족하도록 설계되었다.
- 식품의약품안전처(MFDS)「디지털치료기기 허가·심사 가이드라인」
- 「개인정보보호법」및 「생명윤리 및 안전에 관한 법률」(이하 생명윤리법)
- ICH E6(R2) Good Clinical Practice (GCP)
- HIPAA 개념 (국내법은 HIPAA 직접 적용 대상은 아니나 de-identification 기준을 차용)

1.3 본 문서의 범위
- 포함: 임상시험 참여자 등록, 훈련 세션 중 데이터 수집, 저장, 접근, 라벨링, 품질관리, 폐기
- 제외: 상용 출시 후 일반 사용자에 대한 데이터 처리(별도 개인정보처리방침으로 정의)

---

## 2. 관련 규정 및 표준

| 구분 | 규정/표준 | 본 프로토콜 반영 조항 |
|---|---|---|
| 국내법 | 개인정보보호법 제15조·제22조·제23조(민감정보) | §3, §4, §6 |
| 국내법 | 생명윤리법 제16조(서면동의)·제18조(기록보존) | §4, §6, §9 |
| 국내 가이드 | MFDS DTx 가이드라인 (2020-12) | §3, §5, §7 |
| 국제 표준 | ICH E6(R2) GCP §5 | §5, §6, §8 |
| 국제 표준 | ISO 14155:2020 (의료기기 임상시험) | §5, §8 |
| 참고 개념 | HIPAA Safe Harbor (18 identifiers) | §3, §4 |
| 병원 IRB | 서울대·연세대·세브란스 IRB 제출 양식 | §4, 부록 A |

2.1 **IRB 승인 필수 요건 (체크리스트)**
- [ ] 프로토콜 원문 (본 문서 + Task #81 RCT 프로토콜)
- [ ] 참여자 동의서(ICF) — 성인용 / 가족동의용 분리
- [ ] 연구자 이력 (PI, Co-I, CRC, 데이터 매니저)
- [ ] 이해상충(COI) 선언서
- [ ] 위험 평가 및 안전 모니터링 계획
- [ ] 개인정보 파기 계획
- [ ] 보험 가입 증빙 (피험자 보상)
- [ ] 사용자 매뉴얼 및 소프트웨어 버전 문서 (REQ-001~021 spec 참조)

---

## 3. 데이터 범위 및 분류

브레인프렌즈 DTx 에서 수집되는 데이터를 **식별 위험** 기준 4개 계층으로 분류한다.

### 3.1 Tier 1 — 식별정보 (Identifiable / PII)
| 항목 | 수집 시점 | 저장 위치 (현재 구조) | IRB 상태 |
|---|---|---|---|
| 이름 | 등록 시 | `patient_pii` 테이블 (암호화 예정) | **추가 필요** — 현재 평문, AES-256 column-level 암호화 필요 |
| 생년월일 | 등록 시 | `patient_pii` | **추가 필요** — 암호화 |
| 연락처 (전화·이메일) | 등록 시 | `patient_pii` | **추가 필요** — 암호화 |
| 주소 | 등록 시 (선택) | `patient_pii` | **추가 필요** — 암호화 |
| 보호자 정보 | 등록 시 (가족동의 케이스) | `patient_pii` | **추가 필요** — 암호화 |

> ⚠️ **현재 갭**: `patient_pii` 테이블은 존재하나 컬럼 레벨 암호화 미적용. IRB 제출 전 AES-256 + KMS 키 관리 체계 필수.

### 3.2 Tier 2 — 가식별정보 (Pseudonymized, Indirect Identifiers)
| 항목 | 설명 | 저장 위치 | IRB 상태 |
|---|---|---|---|
| 음성 원본 (wav/webm) | 환자 발화 | 오브젝트 스토리지 (S3/MinIO) | **현재 충족** — 파일명은 pseudonym ID 기반 |
| 얼굴 영상 (선택) | 조음 분석용 (facial_analysis_snapshot) | 오브젝트 스토리지 | **부분 충족** — 얼굴 블러링 옵션 미구현 |
| pseudonym ID | 환자-가명 매핑 | `patient_pseudonym_map` | **현재 충족** — 매핑 테이블 존재 |

> ✅ **현재 충족**: `patient_pseudonym_map` 테이블로 PII 와 clinical data 분리. Clinical 데이터 테이블(`clinical_sessions`, `clinical_results` 등)은 `patient_pseudonym_id` 만 참조.

### 3.3 Tier 3 — 수행 데이터 (Performance / Derived)
| 항목 | 출처 | 저장 위치 | IRB 상태 |
|---|---|---|---|
| K-WAB AQ 점수 | 평가 결과 | `clinical_results.aq` | 현재 충족 |
| Step 1~6 점수 | 훈련 결과 | `clinical_results.step_scores` | 현재 충족 |
| 자음·모음 정확도 | Parselmouth 분석 (REQ-001~012) | `clinical_results.articulation_scores` | 현재 충족 |
| 음향 지표 (F0, jitter, shimmer) | Parselmouth (REQ-020/021) | `clinical_results.articulation_scores.acoustic` | **부분 충족** — 구현 중 |
| 응답 시간, 시도 횟수 | 앱 이벤트 로그 | `transientStepStorage` → `clinical_sessions` | 현재 충족 |
| 측정 품질 등급 | 자동 판정 (measured/partial/demo) | `clinical_results.measurement_quality` | 현재 충족 |

### 3.4 Tier 4 — 임상 상태 데이터 (Clinical Metadata)
| 항목 | 출처 | 저장 위치 | IRB 상태 |
|---|---|---|---|
| 진단명 (aphasia type) | 의사 입력 | `patient_clinical_profile` (신설 필요) | **추가 필요** |
| 중증도 (K-WAB AQ 기반) | 초기 평가 | 동상 | **추가 필요** |
| 발병일 / 발병 후 경과 개월 | 의무기록 전사 | 동상 | **추가 필요** |
| 뇌 병변 위치 (MRI 소견) | 의무기록 (선택) | 동상 | **추가 필요** |
| 병용 치료 (기존 언어치료·약물) | CRC 입력 | 동상 | **추가 필요** |
| MMSE, K-MMSE 점수 | 선별 검사 | 동상 | **추가 필요** |

> ⚠️ **현재 갭**: 임상 상태 메타데이터 스키마 부재. `patient_clinical_profile` 테이블 신설 + CRC(Clinical Research Coordinator) 입력 UI 개발 필요.

### 3.5 수집 금지 항목
- 주민등록번호 (대체: pseudonym ID)
- 건강보험 번호 (대체: 내부 등록번호)
- 얼굴 고해상도 정면 사진 (조음 분석 외 목적)
- GPS / IP 주소 (접속 로그는 `auditLog` 에 저장되지만 분석용 데이터셋에 포함하지 않음)

---

## 4. 동의서 (IRB 제출용) 요소

동의서(ICF: Informed Consent Form)는 별도 문서로 작성하며, 다음 요소를 반드시 포함한다. (서울대병원 IRB 표준 양식, 연세의료원 IRB 가이드 v2023 반영)

### 4.1 필수 포함 요소
1. **연구 제목 및 목적**
   - 한국어·평이한 표현 (중학교 졸업 수준)
   - 실어증 환자 가독성 고려 — 큰 글씨, 단문 구성, 픽토그램 병행
2. **연구 절차 및 기간**
   - 방문 스케줄 (T0~T4), 소요 시간
   - 앱 사용 주 5회 × 30분 × 12주
3. **수집 항목 및 보관 기간**
   - 음성·영상·수행 데이터 목록 (§3 참조)
   - 보관 기간: **임상시험 종료 후 5년** (생명윤리법 제18조 · 의약품임상시험관리기준 최소 3년 + 안전 마진)
4. **가명화 및 재식별 위험 고지**
   - pseudonym ID 로 직접 식별정보 분리 저장
   - 그러나 음성 자체가 biometric identifier 가 될 수 있음을 명시
   - 외부 공개 시 추가 de-identification 절차 고지
5. **철회 권리**
   - 언제든 사유 없이 철회 가능
   - 철회 시 이미 수집된 데이터 처리 옵션 2가지 제시:
     - (a) 즉시 파기
     - (b) 익명화 후 연구 목적으로만 계속 사용 (통계 분석 무결성 유지)
6. **예상 이익과 위험**
   - 이익: 언어재활 기회 제공, 진전도 피드백
   - 위험: 심리적 부담(실패 경험), 음성 데이터 유출 가능성(통제 중)
   - 보상: 교통비 실비(회당 2만원 추정), 주차권
7. **비밀보장 및 개인정보 처리**
   - 데이터 접근 권한자 목록 (PI, Co-I, CRC, 데이터매니저, 모니터, IRB 감사자, 식약처 실사자)
   - 국외 이전 여부 (현재 설계는 **국내 전용** — 재확인 필요)
8. **연구자 연락처**
   - PI (성명·소속·전화·이메일)
   - IRB 사무국
   - 개인정보보호책임자(CPO)
   - 24시간 응급 연락처

### 4.2 동의 유형
- **성인 본인 동의**: AQ ≥ 50 및 K-MMSE ≥ 24 인 경우 본인 서명
- **가족 대리 동의 + 환자 동의(assent)**: AQ < 50 이거나 K-MMSE < 24 인 경우, 법정대리인 서명 + 환자 이해 가능 수준의 구두 동의 기록

### 4.3 동의 과정 기록
- 동의 설명 시간·장소·설명자·질의응답 내용을 CRC 가 기록
- 동의서는 원본 1부 참여자, 1부 연구팀 보관

---

## 5. 수집 절차

### 5.1 Screening / 등록 시 확인 사항 (T0)
| 단계 | 확인 항목 | 도구 | 담당 |
|---|---|---|---|
| S1 | 선정/제외 기준 검토 | 체크리스트 | PI |
| S2 | K-WAB AQ 측정 | 종이 검사지 → 전산 입력 | 언어재활사 |
| S3 | K-MMSE (인지 선별) | 종이 검사지 | 언어재활사 |
| S4 | 동의서 설명·서명 | ICF | CRC |
| S5 | Pseudonym ID 발급 | 시스템 자동 생성 | 시스템 (`patient_pseudonym_map` INSERT) |
| S6 | Demographic / Clinical metadata 입력 | CRC 포털 (신설 필요) | CRC |

### 5.2 훈련 세션 중 자동 수집되는 항목 (T1~T3)
앱 클라이언트(Next.js) 와 음향 분석 서비스(FastAPI + Parselmouth) 에서 자동 수집:

| 데이터 | 수집 주체 | 즉시 저장 위치 | 영구 저장 위치 |
|---|---|---|---|
| 음성 파일 (wav) | Next.js 클라이언트 | 오브젝트 스토리지 (temp bucket) | 세션 완료 시 `clinical_audio_files` |
| Step 별 시도 기록 | Next.js | `transientStepStorage` (sessionStorage) | 세션 완료 시 `clinical_sessions.step_details` 로 flush |
| Parselmouth 분석 결과 | FastAPI | 메모리 → API 응답 | `clinical_results.articulation_scores` |
| 타이밍 이벤트 | Next.js | `transientStepStorage` | `clinical_sessions` |
| 접속·접근 로그 | Next.js middleware | `auditLog` | 즉시 영구 |

> ✅ **현재 충족**: `transientStepStorage` → 세션 완료 시 영구 저장 로직은 기존 step-1 ~ step-6 페이지에 구현되어 있음.
> ⚠️ **추가 필요**: 세션 중단 시(브라우저 종료·네트워크 단절) transient 데이터 복구 또는 명시적 파기 로직 필요.

### 5.3 수동 입력 항목 (치료사·연구자 기록)
- 세션 관찰 노트 (CRC/언어재활사)
- 부작용·이상반응 보고 (AE / SAE)
- 기기 사용 문제점 (usability issue)
- 프로토콜 편차 (protocol deviation)

이 항목들은 별도 **CRC 포털** 에서 입력하며, `clinical_notes`, `adverse_events` 테이블(신설 필요)에 저장된다.

### 5.4 평가 시점 별 데이터 (Task #81 §7 참조)
- T0 (Screening): §5.1
- T1 (Baseline): K-WAB AQ, K-MMSE, QoL, 기준 음성 녹음
- T2 (Interim, 6주): K-WAB AQ 축약형, 앱 사용 로그
- T3 (Primary endpoint, 12주): K-WAB AQ 전체, 모든 2차 지표
- T4 (Follow-up, 24주): K-WAB AQ 전체, 효과 유지 확인

---

## 6. 저장·관리 기준

### 6.1 암호화
| 구간 | 기준 | 현재 상태 |
|---|---|---|
| At-rest (DB) | AES-256 column-level (Tier 1 데이터) | **추가 필요** |
| At-rest (파일) | S3 SSE-KMS / MinIO server-side encryption | **부분 충족** — SSE 적용, KMS 키 회전 정책 수립 필요 |
| In-transit (Client ↔ Server) | TLS 1.3 | **현재 충족** |
| In-transit (Server ↔ Parselmouth) | 내부망 mTLS | **추가 필요** — 현재 내부 HTTP |
| Backup | 암호화 백업 (주 1회, 별도 리전) | **추가 필요** |

### 6.2 접근 권한 (Role-Based Access Control)
| 역할 | Tier 1 (PII) | Tier 2 (음성/영상) | Tier 3 (수행) | Tier 4 (임상) | 감사 로그 |
|---|---|---|---|---|---|
| PI | ○ (필요 시) | ○ | ○ | ○ | 조회 |
| Co-I | △ (마스킹) | ○ | ○ | ○ | 조회 |
| CRC | ○ (자신 담당) | △ (메타만) | ○ | ○ | 본인 로그 |
| 언어재활사 | △ | ○ (세션 중) | ○ | △ | 본인 로그 |
| 데이터 매니저 | × | △ (pseudonym만) | ○ | ○ | 조회 |
| 통계 분석가 | × | × | ○ (pseudonym) | ○ (pseudonym) | × |
| IRB 모니터 / 감사 | ○ (요청 시) | ○ | ○ | ○ | ○ |
| 식약처 실사자 | ○ (요청 시) | ○ | ○ | ○ | ○ |

> ⚠️ **추가 필요**: 현재 시스템은 admin/therapist/patient 3-role 구조. 위 임상 역할 매핑 테이블 및 RBAC 구현 필요.

### 6.3 감사 추적 (Audit Trail)
- 모든 Tier 1/2 데이터 접근(SELECT, UPDATE, DELETE)은 `auditLog` 테이블에 기록
- 기록 항목: 시각, 사용자 ID, 액션, 대상 리소스, IP, 결과
- 보존 기간: 데이터 폐기 후 **추가 5년** (총 10년 수준)
- **Append-only**: `auditLog` 테이블은 UPDATE/DELETE 권한 미부여

> ✅ **현재 충족**: `auditLog` 테이블 및 `SessionManager.ts` 에 기본 로깅 로직 존재.
> ⚠️ **추가 필요**: (a) 모든 API 엔드포인트 커버리지 확인 (b) append-only 제약 DB 레벨 강제 (c) 로그 무결성 체크섬(hash chain) 도입 검토.

### 6.4 가명화 키 관리
- `patient_pseudonym_map` 은 **별도 DB 스키마** 또는 **별도 DB 인스턴스** 에 분리 보관 (권장)
- 접근 권한: PI + CPO + 시스템 2인 (4-eyes principle)
- 매핑 테이블 백업은 독립된 암호화 저장소
- 재식별 요청 프로세스: IRB 승인 → CPO 검토 → 2인 동시 접근 → 로그 기록

> ⚠️ **추가 필요**: 현재 `patient_pseudonym_map` 은 동일 DB `patient_pii` 옆 테이블. 물리적 분리 또는 최소한 별도 schema + 별도 DB 사용자 권한 분리 필요.

---

## 7. 라벨링 표준

### 7.1 음성 Transcript 정답 라벨
- **기준**: 언어재활사 2인 독립 전사 + 불일치 시 3인 중재 컨센서스
- **도구**: Praat textgrid 형식 (TextGrid 1.0)
- **단위**: 단어 수준 + 음소 수준 (IPA)
- **라벨러 자격**: 한국언어재활사협회 1급 자격 3년 이상
- **IAA (Inter-Annotator Agreement)**: Cohen's kappa ≥ 0.8 목표

### 7.2 자음·모음 정확도 수기 라벨
- **표준**: Urimal Test of Articulation and Phonology (U-TAP) 채점 기준 또는 아동용 조음음운평가(APAC) 성인 확장판
- **카테고리**: 정조음 / 대치 / 왜곡 / 생략 / 첨가
- **참고**: 실어증(후천성) 대상이므로 발달성 조음장애 도구 적용 시 해석 주의 — PI 재검토 필수

### 7.3 측정 품질 등급 (measurement_quality)
앱 자동 판정 규칙 (`measurement_quality` JSONB 컬럼):

| 등급 | 조건 | 분석 사용 |
|---|---|---|
| **measured** | 음향 SNR ≥ 20 dB · 발화 시간 ≥ 1 s · Parselmouth 전 지표 산출 성공 | 1차·2차 분석 포함 |
| **partial** | SNR 10~20 dB 또는 일부 지표 실패 | 2차 분석만, 민감도 분석 포함 |
| **demo** | SNR < 10 dB 또는 시연용 더미 데이터 | 분석 제외 (시스템 테스트용 표시) |

> ✅ **현재 충족**: `measurement_quality` JSONB 컬럼 존재, 분류 로직 일부 구현.
> ⚠️ **추가 필요**: 위 임계값의 공식화 및 `parselmouth-requirements.md` 와 상호 참조.

### 7.4 Ground Truth 관리
- 라벨된 데이터는 `clinical_labels` 테이블 (신설 필요) 에 버전 관리
- 알고리즘 업데이트 시 기존 라벨 호환성 검증 필수 (regression test)

---

## 8. 품질관리 (QC)

### 8.1 수집 일관성
- **기기 통제**: 동일 모델 태블릿·동일 브랜드 헤드셋 마이크 (예: Shure SM58 또는 동등) 제공
- **환경 통제**: 각 기관 지정 조용한 방(배경 소음 ≤ 40 dBA), 측정 전 마이크 레벨 캘리브레이션
- **소프트웨어 버전 고정**: 임상시험 기간 중 `release_version`, `algorithm_version`, `catalog_version` 잠금. 수정 시 프로토콜 amendment.
  - 현재 `clinical_sessions` 테이블에 3종 버전 컬럼 존재 — **현재 충족**

### 8.2 결측·이상치 처리
- **결측치**: 세션 미완료 시 이유 코드 기록 (illness, technical, withdrawal, other)
- **이상치 탐지**: 1차 분석 전 통계가가 사전 정의한 기준으로 flag (예: AQ 변화량 > 평균 ± 3SD)
- **처리 원칙**: 분석 프로토콜(SAP)에 사전 정의, post-hoc 제거 금지

### 8.3 정기 감사
- 내부 감사: 월 1회 데이터 매니저가 샘플 10% 검증
- 외부 모니터링: 분기 1회 (CRO 위탁 또는 후원자 지정)
- IRB 정기 보고: 연 1회 지속심의

---

## 9. 종료 및 폐기

### 9.1 연구 종료 후 데이터 처리
- **보존 단계** (종료 후 0~5년): 원본 보존, 재분석·재심사 대비
- **익명화 단계** (5년 경과): `patient_pseudonym_map` 매핑 테이블 암호학적 파기 → pseudonym 과 PII 연결 불가 → 완전 익명화
- **2차 연구 활용**: 익명화된 데이터는 IRB 재승인 후 2차 연구 활용 가능 (동의서에 명시)
- **공개 데이터셋 기여**: 별도 동의 항목으로 옵트인 — 고도 익명화(speaker anonymization) 후 학술 공유

### 9.2 개별 철회 시 처리
- 철회 접수: 서면 또는 CRC 전화 (24시간 내 시스템 차단)
- 옵션 (a) 즉시 파기: Tier 1~4 모두 삭제 (hard delete) + `auditLog` 에만 '철회' 기록
- 옵션 (b) 익명화 지속: Tier 1 삭제, Tier 2~4 는 pseudonym 유지하되 매핑 끊음
- 처리 기한: 요청일로부터 **30일 이내** 완료 + 참여자에게 서면 확인

### 9.3 폐기 절차
- DB: secure DELETE + DB vacuum / tombstone purge
- 파일: DoD 5220.22-M 3-pass overwrite 또는 KMS 키 삭제(crypto-shredding)
- 백업: 다음 백업 사이클 이후 tombstone 반영
- 파기 확인서 발급 (IRB 보고용)

---

## 10. 부록

### 부록 A. 동의서 샘플 템플릿 (발췌)

```
[브레인프렌즈 언어재활 디지털치료기기 임상시험 참여 동의서]

저는 OOO 연구자로부터 본 연구에 대해 다음과 같은 설명을 들었습니다.

1. 연구 제목: 실어증 환자를 대상으로 한 브레인프렌즈 DTx 의 유효성·안전성 평가
2. 연구 목적: 앱 사용이 언어 능력(K-WAB AQ)을 얼마나 개선하는지 확인
3. 참여 기간: 총 약 6개월 (매주 5회, 회당 30분 앱 사용 12주 + 추적 12주)
4. 수집 정보:
   - 이름, 생년월일, 연락처 (암호화 보관)
   - 훈련 중 녹음된 음성 (가명으로 저장)
   - 얼굴 영상 (조음 분석 목적, 선택)
   - 언어 평가 점수
5. 보관 기간: 연구 종료 후 5년
6. 권리:
   - 언제든 사유 없이 철회 가능
   - 철회 시 내 데이터 처리 방식을 선택할 수 있음 (즉시 파기 / 익명 보관)
   - 연구 결과를 본인이 원할 경우 통지받을 수 있음
7. 연락처:
   - 연구책임자: OOO 교수 (OOO 병원 재활의학과)  02-XXXX-XXXX
   - IRB 사무국: 02-XXXX-XXXX
   - 개인정보보호책임자: privacy@goldenbraincare.co.kr

위 설명을 충분히 이해하였으며, 자발적으로 본 연구에 참여할 것에 동의합니다.

참여자 성명: ____________ (서명 또는 인) 날짜: ____/___/____
법정대리인 (해당 시): ____________ (서명 또는 인) 날짜: ____/___/____
설명한 연구자: ____________ (서명) 날짜: ____/___/____
```

### 부록 B. 데이터 흐름도

```
[등록 / Screening]
   └─ PII 입력 ──→ patient_pii (AES-256) ──┐
                                            ├─→ patient_pseudonym_map
   └─ Pseudonym 발급 ────────────────────┘        │
                                                  ▼
[훈련 세션]                              patient_pseudonym_id (연구 식별자)
   └─ Next.js 앱 ──→ transientStepStorage            │
                         │                            │
                         ▼ (세션 완료 트리거)           ▼
                    clinical_sessions ◄─── 버전 고정
                    clinical_results  ◄─── step_scores, articulation_scores
                    clinical_audio_files (S3/MinIO, SSE-KMS)
                         │
                         ▼
[분석]                                         auditLog (모든 접근 기록)
   └─ 통계가: pseudonym 기반 dataset 만 export
   └─ Parselmouth (REQ-001~021) 재분석 가능
                         │
                         ▼
[종료 / 5년 후]
   └─ 철회 시: patient_pii 삭제 또는 매핑 끊음
   └─ 5년 후: patient_pseudonym_map 암호학적 파기 → 완전 익명화
```

### 부록 C. 책임자 역할표

| 역할 | 주요 책임 | 본 프로토콜 관련 조항 |
|---|---|---|
| Principal Investigator (PI) | 전체 시험 책임, 프로토콜 승인, 안전성 평가 | §2, §5, §9 |
| Co-Investigator (Co-I) | 분담 기관 책임, 환자 진료, 부작용 판정 | §5, §8 |
| Clinical Research Coordinator (CRC) | 등록·동의·스케줄·수동 입력 | §4, §5 |
| Data Manager | DB 설계, 데이터 정합성, 쿼리 해결 | §3, §6, §8 |
| Statistician | SAP 작성, 분석 수행 | §8, §9 |
| Chief Privacy Officer (CPO) | 개인정보 처리 방침, 재식별 요청 승인 | §6.4, §9 |
| IT Security Lead | 암호화, RBAC, 감사 시스템 운영 | §6 |
| IRB 모니터 | 프로토콜 준수 확인 | §8 |
| Medical Monitor | 의학적 안전성 검토, SAE 판정 | §5, §8 |
| DSMB Chair (Task #81 §10) | 독립 안전성 검토 | §8 |

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성 |
|---|---|---|---|
| v0.1 | 2026-04-24 | 초안 작성 (Task #76) | 임상·데이터 TF |

## 12. 검토 요청 사항 (v0.2 를 위해)

아래 항목은 v0.2 개정 전 **반드시** 외부 전문가 검토가 필요하다.
- [ ] 해당 임상시험 기관 IRB 사무국 사전 미팅 (서울대·연세대 등)
- [ ] 개인정보보호위원회 유권해석 (음성 biometric 처리)
- [ ] 식약처 DTx 사전상담 결과 반영 (PDF #7 가이드라인)
- [ ] 법무·보험 자문 (피험자 보상 및 배상책임)
- [ ] K-WAB 저작권자 (대한신경심리학회) 사용 허가
- [ ] CPO 및 PI 서명 승인

> ⚠️ **본 v0.1 은 내부 설계용 초안이며, IRB 제출본이 아니다.** 실제 제출을 위해서는 위 검토가 선행되어야 한다.
