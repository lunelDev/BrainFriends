# 1단계 착수 전 현황 정리 및 의사결정 문서

작성일: 2026-04-21
범위: (1) app_users → 신규 users 스키마 스위치 준비, (2) Parselmouth가 본 프로젝트(step1~5, sing-training)에 맞는지 판단

---

## 0. 제안된 작업 순서 (전체 맵)

1. 관리자/기관/치료사/일반회원 **DB 구조 고정**
2. 관리자 화면(등록요청/승인/관리) 정리
3. 음성 분석 결과 **저장 모델** 정의
4. `SpeechAnalyzer.ts` **분석용 녹음 프로파일** 분리
5. `/api/voice-analysis` **Next 프록시** 추가
6. **FastAPI + Parselmouth** 서버
7. step-2/4/5 **연결**

이 문서는 1단계에 들어가기 전 "지금 무엇이 이미 있고 무엇이 없는지"를 확정하고, 1단계 착수 방식(점진적 병행 vs 완전 치환)의 근거를 만든다.

---

## 1. 현재 상태 — DB / 권한 구조

### 1-1. 레거시 스키마 (지금 실제로 돌아가는 것)

활성 테이블: `app_users`, `patient_pii`, `patient_intake_profiles`, `auth_sessions`, `therapist_patient_assignments`, `clinical_sessions`, `language_training_results`, `sing_results`, `clinical_media_objects`

`app_users` 컬럼
- `user_id` (UUID PK)
- `patient_id` (UUID FK → patient_pii)
- `user_role` (VARCHAR) — 'admin' / 'therapist' / 일반
- `login_id`, `login_key_hash`, `password_hash`
- `last_login_at`, `created_at`, `updated_at`
- 조건부: `organization_id`, `approval_state`

중요 포인트: `accountAuth.ts`가 `columnExists` / `tableExists`로 이 조건부 컬럼을 **런타임에 감지해서 동적으로 쿼리를 만든다**. 즉 스키마가 조용히 진화해 왔고 현재 코드는 두 변형(컬럼 있음/없음) 모두 통과한다.

### 1-2. `app_users` 실제 사용처 (현재 마이그레이션의 핵심 표면적)

| 파일 | 라인 | 용도 |
|---|---|---|
| `src/lib/server/accountAuth.ts` | 320 | 기본 admin 계정 seed (INSERT ON CONFLICT) |
| 〃 | 397 | 신규 가입 시 login_id 중복 확인 |
| 〃 | 448 | 치료사 유효성 (user_role, approval_state) |
| 〃 | 527 | 신규 사용자 계정 생성 |
| 〃 | 638 | 로그인 인증 본체 (patient_pii, patient_intake_profiles 조인) |
| 〃 | 681 | `last_login_at` 갱신 |
| 〃 | 908 | `isLoginIdAvailable` |
| 〃 | 936, 965 | 비밀번호 재설정 (login_key_hash 기준 SELECT/UPDATE) |
| `src/lib/server/organizationTherapistsDb.ts` | 69 | 기관별 승인된 치료사 목록 |
| `src/lib/server/therapistReportsDb.ts` | 113 | 치료사 요약 |

세션 흐름 요약
- 쿠키 `brainfriends_session` = base64url 세션 토큰
- `src/proxy.ts`는 **쿠키 존재 유무만** 확인 (실제 서명/만료 검증은 없음)
- 실제 검증은 `accountAuth.ts` 안에서 `auth_sessions.session_token_hash(sha256)`로 수행
- `PatientProfile`을 메모리 객체로 조립 (JWT는 사용하지 않음)

따라서 **"app_users를 users로 바꾼다"의 실질적 범위는 위 파일 2개 (`accountAuth.ts`, `organizationTherapistsDb.ts`, `therapistReportsDb.ts`) + 쿠키/세션 테이블 연동이다**. 표면적이 생각보다 좁다.

### 1-3. 신규 스키마 (docs/database/account-onboarding-redesign.sql)

정의된 테이블
- `users` — id, name, email(UNIQUE), phone(UNIQUE), login_id(UNIQUE), password_hash, account_type(USER/THERAPIST/ADMIN), status(PENDING/ACTIVE/SUSPENDED)
- `therapist_profiles` — user_id FK, job_type, license_number, license_file_url, issued_date, specialty, is_public, verification_status(PENDING/APPROVED/REJECTED)
- `institutions` — name, business_number(UNIQUE), representative_name, institution_type, address, business_license_file_url, status(PENDING/APPROVED/REJECTED), created_by_user_id
- `institution_members` — institution_id, user_id, role(OWNER/MANAGER/THERAPIST), status, is_owner, joined_at
- `user_therapist_mappings` — user_id, therapist_user_id, institution_id, status(PENDING/APPROVED/REJECTED/ENDED)

실제 DB 생성 여부: **✗ 전부 미생성**
참조 TS 코드: **✗ 0건**

결론: redesign.sql은 **설계 문서이며 마이그레이션은 한 줄도 시작되지 않았다**.

### 1-4. 그래서 1단계를 어떻게 시작할 것인가

두 가지 경로가 있고, 각 경로의 작업량/리스크는 다음과 같다.

**(A) 병행 운영 — 신규 users를 생성하되 점진 전환**
- 1. redesign.sql을 실행해 신규 테이블 생성 (트리거/유니크 제약 포함)
- 2. `app_users.user_id`와 `users.id`를 **같은 UUID로** 발급하도록 seed 로직 확장
- 3. 신규 기능(치료사 인증 문서, 기관 승인 등)만 `users`/`therapist_profiles`/`institutions`에 기록
- 4. 로그인/세션은 당분간 `app_users` 유지
- 5. 6~7단계 분석 결과는 `users.id`에 FK
- 이점: 기존 로그인 100% 안전, 언제든 롤백
- 비용: 이중 쓰기 코드 일시적 필요

**(B) 완전 치환 — 데이터 이관 + 코드 일괄 교체**
- 1. `app_users` → `users` 백필 스크립트
- 2. `auth_sessions.user_id`를 신규 `users.id`로 재연결
- 3. `accountAuth.ts` 대규모 교체
- 4. 한 번의 배포로 전환
- 이점: 코드 간결
- 비용: 실패 시 로그인 전면 중단, 롤백 난이도 높음

**권장: (A) 병행 운영.**
근거: `accountAuth.ts`가 이미 "컬럼/테이블 존재를 런타임에 감지하는 방어적 구조"라서 병행 전략과 친화적이다. `organization_id`/`approval_state`가 app_users에 조건부로 추가돼온 역사가 그 증거.

---

## 2. 관리자 화면 — 이미 있는 것 / 빠진 것

`/admin/*` 라우트와 `/api/admin/*` 일부 존재.

| 기능 | UI | API |
|---|---|---|
| 치료사 생성/승인/반려 | ✓ | ✓ (`/api/admin/therapists` POST/PATCH) |
| 기관 승인/반려 | ✓ | ✓ (`/api/admin/organizations` POST 심사) |
| 환자-치료사 연결 | ✓ | ✓ (`/api/admin/patient-links`) |
| 치료사 목록/수정/삭제 | △ 조회만 | ✗ 수정/삭제 없음 |
| 기관 목록/수정/삭제 | △ 조회만 | ✗ 수정/삭제 없음 |
| 가입화면의 "승인된 기관/치료사만" 필터 | ? 미확인 | `organizationCatalogDb.listAvailableOrganizations` 있음 |

2단계에서 추가해야 하는 것은 **치료사/기관 수정·삭제 엔드포인트**와 **가입 셀렉트의 승인 필터 확인**이다. 비교적 안전한 영역.

---

## 3. Parselmouth 적합도 — 훈련별

| 훈련 | 과제 | 현재 분석 | Parselmouth가 주는 것 | 가치 |
|---|---|---|---|---|
| step-1 | 청각 O/X | TTS + 버튼, 음성 입력 없음 | — | 불필요 |
| step-2 | 짧은 단어 복창 (1~5초) | STT + 얼굴 대칭 + 자모음 | jitter, shimmer, HNR, F0 | **높음** — 병리음성 판별 |
| step-3 | 그림 선택 | TTS + 터치 | — | 불필요 |
| step-4 | 자발화 (6~15초) | STT + 키워드 + 반응시간 + 자모음 | F0 궤적, 음성 속도, intensity 변화 | **중간** — 파킨슨·뇌졸중 선별 |
| step-5 | 문장 읽기 (10~30초) | STT + 유사도 + WPM + 자모음 | F0, jitter, shimmer, HNR, 음성 피로 | **높음** — 피로 구간 검출 |
| step-6 | 필기 | 스트로크 인식 | — | 불필요 |
| sing-training | 노래 (30초~3분) | ACF 피치, jitter, SI, STT, 가사정확도 | F0 참조용 | **낮음** — CREPE가 더 정확 |
| lingo | 게임(터치/음성최소) | 게임별 | — | 대부분 불필요 |

**결론**
- Parselmouth를 붙이는 게 이득인 곳: **step-2, step-5** (명확), step-4 (선택적)
- sing-training에서 음정 정확도를 잡고 싶다면 Parselmouth보다 **CREPE/SPICE 같은 신경망 pitch tracker**가 임상 수준에서도 더 적합
- step-1/3/6 및 lingo 대부분은 과잉스펙

즉 "Parselmouth 전사용"보다 **"step-2/5 중심 + sing-training은 별도 피치 툴 검토"** 조합이 현실적.

---

## 4. 분석 결과 저장 — 지금 뭐가 있나

- `language_training_results.step_results` (JSONB) — step별 수치들이 전부 여기에 섞여 들어간다
- `sing_results` — 노래 훈련 전용 (jitter, si, lyricAccuracy 등 평면 컬럼)
- `clinical_media_objects` — 녹음 파일 메타
- acoustic 전용 테이블(`voice_analyses` 등): **없음**

3단계 저장 모델을 정할 때 선택지
1. 기존 `language_training_results.step_results` JSONB에 `acoustic` 키 추가 (최소 변경)
2. 별도 `voice_acoustic_results` 테이블 생성 (조회 편의, 집계 성능)
3. step과 노래방을 통합하는 `voice_analyses` 마스터 테이블 + 과제별 details JSONB

권장: **(1)로 시작해서 수치가 쌓인 후 (2)로 분리**. 초기부터 테이블 쪼개면 스키마를 또 바꿔야 한다.

---

## 5. 1단계 실행 계획 초안 (확정 전 — 사용자 검토 필요)

순서 (이 문서 승인 후 진행)
1. `docs/database/account-onboarding-redesign.sql`을 로컬 DB에 적용 (dry-run 후)
2. `src/lib/server/usersDb.ts` (신규) — users/therapist_profiles/institutions/institution_members/user_therapist_mappings 리포지토리 레이어
3. 신규 회원 가입 & 치료사·기관 등록만 신규 테이블에 동시 기록 (`accountAuth.ts` 일부 확장, 기존 app_users 경로는 그대로 유지)
4. 관리자 승인 API가 `verification_status` / `institutions.status`를 신규 테이블 기준으로도 업데이트하게 연동
5. 기존 로그인 경로는 이번 단계에서 **건드리지 않는다** (2단계 말미 또는 별도 세션에서)

이 계획의 핵심은 **로그인/세션을 이번 세션에는 절대 수정하지 않는 것**이다. `accountAuth.ts`의 `authenticateAccount`, 쿠키, `auth_sessions` 경로는 손대지 않는다.

---

## 6. 이번 세션에서 결정해야 하는 것

- [ ] 1단계 실행 방식: (A) 병행 운영 / (B) 완전 치환 중 선택
- [ ] redesign.sql을 이번에 실제 DB에 적용할지, 아니면 별도 작업으로 미룰지
- [ ] Parselmouth 범위: **step-2/5 중심** 또는 **전 단계** 중 선택
- [ ] sing-training 피치 툴: Parselmouth로 통일할지, CREPE/SPICE를 따로 검토할지

이 네 개가 확정되면 실제 코드 작업에 들어간다.
