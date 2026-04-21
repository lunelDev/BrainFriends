# 통일된 목표 스키마 및 이행 매핑

작성일: 2026-04-21
선행 문서: `2026-04-21-phase1-users-migration-and-parselmouth-fit.md`
목적: "DB 구조를 먼저 고정한다"의 실체를 정의. 코드 작업 전 단일 참조 스키마와 이행 매핑을 확정한다.

---

## 0. 설계 제약 (변경 불가)

`docs/10-operations/pii-phi-separation.md` 기준:

- **PII**(이름, 생년월일, 전화번호 등 직접 식별자)는 신원 계층에만 저장
- **PHI**(임상 데이터: 세션, 점수, 발화, 영상)는 `patient_pseudonym_id`로만 저장
- 임상 테이블(`clinical_sessions`, `language_training_results`, `sing_results`, `clinical_media_objects`)의 FK는 **절대 직접 사용자/환자 PK를 가리키지 않는다**
- 따라서 신규 `users.id`로의 전환은 **신원 계층과 매핑 계층까지만**, 임상 계층은 손대지 않는다

---

## 1. 현재 스키마 인벤토리 (브린프렌즈_dev.sql 기준)

### 신원/식별 계층 (PII)
| 테이블 | PK | 핵심 컬럼 | 외부 참조 |
|---|---|---|---|
| `organizations` | organization_id (UUID) | name, code, is_active | — |
| `patient_pii` | patient_id (UUID) | patient_code, full_name, birth_date, sex, phone, language, **organization_id** | organizations |
| `patient_intake_profiles` | patient_id (FK PK) | education_years, onset_date, hemiplegia, hemianopsia, hand | patient_pii |
| `app_users` | user_id (UUID) | patient_id(UNIQUE), user_role, login_id, login_key_hash, password_hash, **organization_id**, **approval_state** | patient_pii, organizations |
| `auth_sessions` | session_id | user_id, session_token_hash, expires_at | app_users |
| `therapist_patient_assignments` | assignment_id | organization_id, therapist_user_id, patient_id, assigned_by, is_active | app_users, patient_pii, organizations |

### 매핑 계층
| 테이블 | PK | 컬럼 | 외부 참조 |
|---|---|---|---|
| `patient_pseudonym_map` | patient_pseudonym_id (VARCHAR64) | patient_id(UNIQUE), mapping_version | patient_pii |

### 임상 계층 (PHI — 신규 스키마에서도 유지)
| 테이블 | FK 컬럼 | 가리키는 곳 |
|---|---|---|
| `clinical_sessions` | patient_pseudonym_id | patient_pseudonym_map |
| `language_training_results` | session_id, patient_pseudonym_id | clinical_sessions, pseudonym |
| `sing_results` | session_id, patient_pseudonym_id | clinical_sessions, pseudonym |
| `clinical_media_objects` | clinical_session_id, patient_pseudonym_id | clinical_sessions, pseudonym |

### 운영/이벤트 계층
| 테이블 | FK | 가리키는 곳 |
|---|---|---|
| `training_client_drafts` | user_id | app_users |
| `training_usage_events` | user_id, patient_id, patient_pseudonym_id | app_users, patient_pii, pseudonym |

---

## 2. 신규 설계(`account-onboarding-redesign.sql`) 인벤토리

| 테이블 | PK | 핵심 컬럼 | 외부 참조 |
|---|---|---|---|
| `users` | id (UUID) | name, email(UQ), phone(UQ), login_id(UQ), password_hash, account_type(USER/THERAPIST/ADMIN), status(PENDING/ACTIVE/SUSPENDED) | — |
| `therapist_profiles` | id | user_id, job_type, license_number, license_file_url, issued_by, issued_date, specialty, introduction, is_public, verification_status | users |
| `institutions` | id | name, business_number(UQ), representative_name, institution_type, medical_org_number, phone, zip_code, address1, address2, business_license_file_url, opening_license_file_url, status, created_by_user_id | users |
| `institution_members` | id | institution_id, user_id, role(OWNER/MANAGER/THERAPIST), status(PENDING/APPROVED/REJECTED), is_owner, joined_at | institutions, users |
| `user_therapist_mappings` | id | user_id, therapist_user_id, institution_id, status(PENDING/APPROVED/REJECTED/ENDED), assigned_at, ended_at | users, institutions |

신규 설계가 **다루지 않는** 영역
- 환자의 임상 배경 정보(`hemiplegia`, `onset_date`, `education_years` 등)
- PII와 PHI 분리(`patient_pseudonym_map`)
- 임상 데이터 테이블 일체

---

## 3. 통일된 목표 스키마

방침
- **신원 계층**은 신규 설계로 단일화: `users / therapist_profiles / institutions / institution_members / user_therapist_mappings`
- **PII 분리 보강 테이블**(`user_pii_profile`)을 신설해 환자/일반회원의 추가 식별자(생년월일·성별 등)를 분리
- **임상 배경**은 `clinical_patient_profiles`로 이관(현 `patient_intake_profiles`의 후신)하고 키를 `patient_pseudonym_id`로 전환 — PHI 분리 원칙에 맞춤
- **매핑 계층**(`patient_pseudonym_map`)은 유지하되 키를 `users.id`로 변경
- **임상 계층 4종**(`clinical_sessions`, `language_training_results`, `sing_results`, `clinical_media_objects`)은 **컬럼·FK 변경 없음** — 모두 `patient_pseudonym_id` 그대로
- **운영/이벤트 계층**은 `app_users.user_id` → `users.id`로만 FK 재연결

### 3-1. 최종 테이블 목록 (계층별)

신원 계층
- `users` — 모든 계정 (환자/치료사/관리자)
- `user_pii_profile` (신설) — 추가 PII (생년월일, 성별 등). users.id 1:1 옵셔널
- `therapist_profiles` — 자격증/심사
- `institutions` — 기관 (구 organizations 대체)
- `institution_members` — 소속/역할
- `user_therapist_mappings` — 환자-치료사 (구 therapist_patient_assignments 대체)

매핑 계층
- `patient_pseudonym_map` — `users.id` ↔ `patient_pseudonym_id`

PHI/임상 계층 (변경 없음)
- `clinical_sessions`
- `language_training_results`
- `sing_results`
- `clinical_media_objects`
- `clinical_patient_profiles` (신설, 구 patient_intake_profiles 후신, 키=pseudonym_id)

세션/감사 계층
- `auth_sessions` — `users.id`로 FK 재연결
- `training_client_drafts` — `users.id`로 FK 재연결
- `training_usage_events` — `users.id` + `patient_pseudonym_id` 유지(patient_id 컬럼 제거)

폐기 대상 (마이그레이션 완료 시점)
- `app_users`, `organizations`, `patient_pii`, `patient_intake_profiles`, `therapist_patient_assignments`

### 3-2. 텍스트 ERD

```
users ──────────┬── therapist_profiles
                ├── institutions (created_by_user_id)
                ├── institution_members ──── institutions
                ├── user_therapist_mappings ── institutions
                ├── user_pii_profile (1:1 옵셔널)
                └── patient_pseudonym_map ── (patient_pseudonym_id)
                                                   │
                                  ┌────────────────┼─────────────────┐
                       clinical_sessions  clinical_patient_profiles  (그대로)
                                  │
                ┌─────────────────┼─────────────────┬────────────────┐
   language_training_results   sing_results   clinical_media_objects
```

### 3-3. 신규 테이블 정의 보충

`user_pii_profile`
```sql
CREATE TABLE IF NOT EXISTS user_pii_profile (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date DATE,
  sex VARCHAR(20),
  language VARCHAR(20),
  legacy_patient_code VARCHAR(50) UNIQUE, -- 마이그레이션 추적용
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`clinical_patient_profiles`
```sql
CREATE TABLE IF NOT EXISTS clinical_patient_profiles (
  patient_pseudonym_id VARCHAR(64) PRIMARY KEY
    REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  education_years INTEGER NOT NULL DEFAULT 0,
  onset_date DATE,
  days_since_onset INTEGER,
  hemiplegia VARCHAR(10) NOT NULL DEFAULT 'N',
  hemianopsia VARCHAR(20) NOT NULL DEFAULT 'NONE',
  hand VARCHAR(10) NOT NULL DEFAULT 'U',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`patient_pseudonym_map` 변경
```sql
ALTER TABLE patient_pseudonym_map
  ADD COLUMN user_id UUID UNIQUE REFERENCES users(id);
-- 마이그레이션 완료 후
ALTER TABLE patient_pseudonym_map DROP COLUMN patient_id;
```

---

## 4. 컬럼별 이행 매핑표

### 4-1. `app_users` → 신규
| 현재 컬럼 | 이동 위치 | 비고 |
|---|---|---|
| user_id | users.id | 동일 UUID 유지 |
| patient_id | (삭제) | patient_pseudonym_map.user_id로 매핑 변환 |
| user_role = 'admin' | users.account_type='ADMIN' | |
| user_role = 'therapist' | users.account_type='THERAPIST' | + therapist_profiles 행 생성 |
| user_role = 'patient' (기본값) | users.account_type='USER' | |
| login_id | users.login_id | 동일 |
| login_key_hash | (폐기) | 신규 설계에 없음. 마이그 시 보존할지 결정 필요 |
| password_hash | users.password_hash | 동일 |
| last_login_at | (폐기) 또는 별도 user_login_log | 신규 설계에 없음 |
| organization_id (조건부) | institution_members(institution_id, user_id, role) | 1행 생성 |
| approval_state | users.status (PENDING/ACTIVE) + (치료사면) therapist_profiles.verification_status | 매핑 규칙: approved→ACTIVE/APPROVED, pending→PENDING, rejected→SUSPENDED/REJECTED |
| created_at, updated_at | users.created_at/updated_at | 동일 |

### 4-2. `patient_pii` → 신규
| 현재 컬럼 | 이동 위치 | 비고 |
|---|---|---|
| patient_id | (사라짐) | patient_pseudonym_map.user_id로 대체 |
| patient_code | user_pii_profile.legacy_patient_code | 추적용 보존 |
| full_name | users.name | 환자 사용자의 표시 이름 |
| birth_date | user_pii_profile.birth_date | |
| sex | user_pii_profile.sex | |
| phone | users.phone | 신규 users.phone 은 NOT NULL UNIQUE — 누락 환자는 더미 채움 필요 |
| language | user_pii_profile.language | |
| organization_id | institution_members(institution_id, user_id) | role='THERAPIST' 또는 일반회원이라면 새로운 역할('PATIENT') 추가 검토 |
| created_at, updated_at | users.created_at/updated_at | app_users 값과 충돌 시 더 빠른 쪽 유지 |

### 4-3. `patient_intake_profiles` → `clinical_patient_profiles`
| 현재 | 신규 |
|---|---|
| patient_id (FK patient_pii) | patient_pseudonym_id (FK pseudonym_map) |
| education_years/onset_date/days_since_onset/hemiplegia/hemianopsia/hand | 동일 컬럼 유지 |

### 4-4. `organizations` → `institutions`
| 현재 | 신규 | 비고 |
|---|---|---|
| organization_id | institutions.id | 동일 UUID |
| organization_name | institutions.name | |
| organization_code | (폐기) 또는 institutions.legacy_code 신설 | business_number가 대체. 추적용 컬럼 추가 권장 |
| is_active | institutions.status | active=APPROVED, !active=REJECTED |
| (없음) | business_number, representative_name, institution_type, address1, business_license_file_url 등 | **레거시 데이터에 값이 없으므로 마이그 시점에는 placeholder 입력 후 운영자 보강 필요** |

### 4-5. `therapist_patient_assignments` → `user_therapist_mappings`
| 현재 | 신규 |
|---|---|
| organization_id | institution_id |
| therapist_user_id | therapist_user_id (users.id) |
| patient_id (patient_pii) | user_id (users.id, 환자 사용자) |
| assigned_by | (폐기) 또는 별도 audit |
| assigned_at | assigned_at |
| is_active=false | status='ENDED' + ended_at 설정 |
| is_active=true | status='APPROVED' |

### 4-6. `auth_sessions` FK 재연결
- `auth_sessions.user_id`가 가리키는 PK가 app_users.user_id에서 users.id로 바뀜. user_id 값은 같은 UUID로 유지하므로 **컬럼 데이터 변경 불필요**, FK 제약만 재정의.

### 4-7. `training_client_drafts`, `training_usage_events`
- `user_id` FK를 app_users에서 users로 재정의. 값 변경 없음.
- `training_usage_events.patient_id` 컬럼은 제거 권장 (PHI 분리 — patient_pseudonym_id로 충분).

### 4-8. 임상 4종 (변경 없음)
- `clinical_sessions`, `language_training_results`, `sing_results`, `clinical_media_objects` 모두 손대지 않음. 마이그레이션의 핵심 안전망.

---

## 5. 마이그레이션 단계 (실행 시점에만, 이번 문서 단계는 아님)

1. **신규 테이블 생성** — users, therapist_profiles, institutions, institution_members, user_therapist_mappings, user_pii_profile, clinical_patient_profiles
2. **백필 스크립트** — 위 매핑표대로 데이터 이관 (원본 유지, 새 테이블에 복사)
3. **`patient_pseudonym_map.user_id` 컬럼 추가 + 백필**
4. **읽기 경로 전환** — `accountAuth.ts`의 SELECT를 신규 users 기준으로 한 함수씩 교체
5. **쓰기 경로 전환** — INSERT/UPDATE를 신규 테이블에 일원화 (이중 쓰기 단계 후 단일화)
6. **세션 테이블 FK 재정의**
7. **레거시 테이블 폐기** — DROP은 1주 이상 안정 운영 후

---

## 6. 결정이 필요한 항목

이 문서가 단일 참조 스키마가 되려면 아래 5건이 확정돼야 합니다.

1. **users.phone NOT NULL UNIQUE 제약** 유지할지
   - 환자 데이터에 전화번호 없는 경우가 있음. 더미 값 정책 vs 제약 완화

2. **환자(USER)의 기관 소속을 institution_members로 표현할지**
   - 현재 `institution_members.role`은 OWNER/MANAGER/THERAPIST. 환자도 'PATIENT' 역할로 추가할지, 아니면 별도 `patient_institution_links` 테이블을 만들지

3. **login_key_hash, last_login_at** 폐기 vs 보존
   - 신규 설계에 없음. 비밀번호 재설정 흐름이 login_key_hash에 의존하므로 흐름 자체를 재설계할지 결정

4. **`patient_intake_profiles` → `clinical_patient_profiles` 이관 시점**
   - 신원 단계와 동시에 할지, 별도 단계로 미룰지

5. **organizations(레거시) 데이터의 누락 컬럼 처리**
   - business_number/representative_name/business_license_file_url 등은 레거시에 없는데 신규는 NOT NULL. 마이그 시 placeholder 후 관리자가 보강하는 정책으로 갈지

---

## 7. 다음 작업

위 5개 결정 후
- 본 문서를 단일 참조본으로 확정
- 이후 redesign.sql을 위 통일안에 맞춰 개정 (user_pii_profile, clinical_patient_profiles 추가, 매핑 변경)
- 그 시점에 비로소 마이그레이션 코드 작성 착수

---

## 8. 비즈니스 스펙 바인딩 (2026-04-21 확정)

프로젝트의 실제 목표 스펙: 일반 회원 / 기관 / 치료사 3주체. 이 절은 각 주체의 생성·승인·로그인 흐름을 **구체 테이블 연산**으로 번역한다.

### 8-1. 일반 회원 (환자)

역할: 훈련을 수행하는 사용자 계정. 관리자 승인 없음.

가입 플로우 (1트랜잭션)
```
1. users INSERT
   - account_type = 'USER'
   - status = 'ACTIVE'    ← 승인 불필요하므로 바로 ACTIVE
   - name, email, phone, login_id, password_hash 모두 필수

2. user_pii_profile INSERT
   - birth_date, sex, language (있으면)

3. institution_members INSERT
   - institution_id = 선택한 (status='APPROVED') 기관
   - role = 'PATIENT'     ← 역할 enum에 PATIENT 추가 (§9-2 참조)
   - status = 'APPROVED'  ← 일반 회원은 가입 즉시 확정
   - is_owner = false

4. user_therapist_mappings INSERT
   - user_id = 가입자
   - therapist_user_id = 선택한 치료사 (승인된 치료사만)
   - institution_id = 위 3번과 동일
   - status = 'APPROVED'  ← 승인 불필요
   - assigned_at = NOW()

5. patient_pseudonym_map INSERT
   - user_id = 가입자
   - patient_pseudonym_id = 신규 발급

6. clinical_patient_profiles INSERT
   - patient_pseudonym_id = 위 발급 값
   - hemiplegia, hemianopsia, hand, education_years, onset_date 등
```

로그인 조건
- `users.status = 'ACTIVE'`
- `institution_members` 중 role='PATIENT' AND status='APPROVED' 행이 **반드시 1건 이상**
- `user_therapist_mappings` status='APPROVED' 행이 **반드시 1건 이상**
- `patient_pseudonym_map`에 매핑 존재
- 위 중 하나라도 깨지면 로그인은 허용하되 진입 전 "연결 누락" 화면으로 유도

가입 화면의 셀렉트 조회
- 기관: `SELECT id, name FROM institutions WHERE status = 'APPROVED'`
- 치료사 (기관 선택 후): `SELECT u.id, u.name FROM users u JOIN therapist_profiles tp ON tp.user_id=u.id JOIN institution_members im ON im.user_id=u.id WHERE im.institution_id = $1 AND im.role='THERAPIST' AND im.status='APPROVED' AND tp.verification_status='APPROVED' AND u.status='ACTIVE'`

### 8-2. 기관

역할: 조직 데이터. 계정 아님. 로그인 없음.

생성 경로
- 경로 A — 치료사 가입 중 "1인 기관으로 등록": 치료사 가입 트랜잭션이 `institutions` 행(status='PENDING')을 같이 생성. created_by_user_id = 가입 중인 치료사 users.id.
- 경로 B — 별도 "기관 등록 요청": 치료사가 아닌 경우 기관 등록 요청 플로우. 동일하게 status='PENDING', created_by_user_id는 요청자 또는 NULL.

승인 플로우
- 관리자 콘솔에서 `institutions.status`를 APPROVED/REJECTED로 갱신.
- 경로 A의 경우 "치료사 승인"과 "기관 승인"이 **동일 관리자 액션에서 함께** 이루어지는 것이 자연스러움 → 아래 8-3 참고.

검색/노출 조건
- 가입/선택 화면은 **항상** `status = 'APPROVED'`만 노출

### 8-3. 치료사

역할: 기관 소속 전문가 계정.

가입 플로우 — 경로 A (기존 기관 선택)
```
1. users INSERT
   - account_type = 'THERAPIST'
   - status = 'PENDING'

2. therapist_profiles INSERT
   - user_id = 위 users.id
   - job_type, license_number, license_file_url, issued_by, issued_date, specialty, introduction
   - is_public = false
   - verification_status = 'PENDING'

3. institution_members INSERT
   - institution_id = 선택한 (status='APPROVED') 기관
   - user_id = 위 users.id
   - role = 'THERAPIST'
   - status = 'PENDING'   ← 관리자 승인 대기
   - is_owner = false
```

가입 플로우 — 경로 B (1인 기관 신규 등록)
```
1. users INSERT (동일, status='PENDING')

2. therapist_profiles INSERT (동일, verification_status='PENDING')

3. institutions INSERT
   - status = 'PENDING'
   - created_by_user_id = 위 users.id
   - 나머지 컬럼은 치료사가 입력한 값

4. institution_members INSERT
   - institution_id = 위 institutions.id
   - user_id = 위 users.id
   - role = 'OWNER'
   - is_owner = true
   - status = 'PENDING'
```

관리자 승인 액션 (경로 무관)
```
원자적 업데이트 (한 트랜잭션):
  users.status                          = 'ACTIVE'
  therapist_profiles.verification_status = 'APPROVED'
  institution_members.status             = 'APPROVED'
  (경로 B만)
  institutions.status                    = 'APPROVED'
```

반려
```
users.status                          = 'SUSPENDED'
therapist_profiles.verification_status = 'REJECTED'
institution_members.status             = 'REJECTED'
(경로 B만) institutions.status         = 'REJECTED'
```

로그인 조건
- `users.status = 'ACTIVE'` AND `therapist_profiles.verification_status = 'APPROVED'`

일반 회원의 치료사 선택 노출 조건
- §8-1의 쿼리 그대로 (users.status='ACTIVE', tp.verification_status='APPROVED', im.status='APPROVED', is_public 은 별도 정책)

### 8-4. 상태값 통일 원칙

| 주체 | PENDING | APPROVED/ACTIVE | REJECTED/SUSPENDED |
|---|---|---|---|
| 일반회원 users.status | 사용 안 함 (바로 ACTIVE) | ACTIVE | SUSPENDED(제재 시) |
| 치료사 users.status | 가입 직후 | 관리자 승인 후 | 관리자 반려 |
| 치료사 therapist_profiles.verification_status | 가입 직후 | 관리자 승인 | 관리자 반려 |
| 기관 institutions.status | 등록 요청 직후 | 관리자 승인 | 관리자 반려 |
| institution_members.status | 치료사 가입 직후 | 관리자 승인 또는 일반회원 가입 | 관리자 반려 |
| user_therapist_mappings.status | (미사용 — 가입 즉시 APPROVED) | 일반회원 가입 시 | 연결 해제 시 ENDED |

---

## 9. §6 결정 재검토 — 스펙으로 해소된 항목

### 9-1. users.phone NOT NULL UNIQUE → **유지**
근거: 스펙의 "기본 정보 입력"에 전화번호가 포함됨. 신규 가입은 100% phone 보유.
레거시 마이그에서 phone 누락 환자는 `legacy:{patient_code}` 더미로 채운 뒤 관리자 보강 대상으로 표시. 운영상 허용 가능.

### 9-2. 환자의 기관 소속 표현 → **institution_members.role 에 'PATIENT' 추가**
근거: 스펙이 "일반 회원은 기관을 선택" + "어느 기관 소속인지 기준"으로 명시. 별도 테이블 추가는 중복.
신규 role enum: `OWNER / MANAGER / THERAPIST / PATIENT`.

### 9-3. login_key_hash, last_login_at → **users에 보존 컬럼 추가**
근거: 현 비밀번호 재설정 흐름이 login_key_hash에 의존 (accountAuth.ts:936,965). 스펙에 재설정 재설계 명시 없음 → 기존 흐름 유지.
`users`에 `login_key_hash VARCHAR(128) UNIQUE`, `last_login_at TIMESTAMPTZ` 두 컬럼 추가.

### 9-4. patient_intake_profiles 이관 시점 → **신원 마이그와 동시**
근거: 스펙의 가입 플로우에 "재활 정보 입력"이 포함. 신규 users 가입 트랜잭션에서 clinical_patient_profiles 생성이 필수. 분리 불가.

### 9-5. organizations 레거시 → institutions 누락 컬럼 → **NULL 허용 + 승인 조건에 완전성 체크**
근거: 레거시 organizations는 최소 정보만 보유. 신규 institutions의 NOT NULL 제약(business_number, representative_name, institution_type, address1, business_license_file_url)을 마이그 시점에는 지킬 수 없음.
결정: 이 5개 컬럼을 `NULLABLE`로 완화. 단 `institutions.status='APPROVED'`로 전환하려면 이 5개가 모두 채워져 있어야 한다는 **애플리케이션 레벨 조건**을 둔다 (DB CHECK로도 표현 가능하지만 운영 복잡도 고려해 앱 레벨 권장).
스펙과 정합: "승인 전에는 검색 안 됨"은 그대로 유지되면서, 레거시 데이터를 무결성 에러 없이 가져올 수 있음.

### 9-6. 신규 결정 (스펙에서 새로 드러남)
- 치료사 1인 기관 경로: 기관과 치료사 승인은 **원자적 단일 관리자 액션**. API 설계 시 `PATCH /api/admin/therapists/:id { action: 'approve' }` 하나에서 관련 테이블 3~4개를 트랜잭션으로 갱신.
- 일반회원 로그인 시 "기관/치료사 연결 누락" 상태 가능성: 마이그레이션 후 누락 계정이 있을 수 있으므로, 로그인 자체는 허용하되 진입 전 **연결 보강 화면**으로 유도. `users.status='ACTIVE'`만으로 로그인 허용, 진입 로직은 프론트/미들웨어에서 분기.

---

## 10. 확정된 최종 결정 · 열린 결정

확정
- §3 통일 스키마 (users / user_pii_profile / therapist_profiles / institutions / institution_members / user_therapist_mappings / patient_pseudonym_map / clinical_patient_profiles + 임상 4종 유지)
- §8 비즈니스 스펙 바인딩
- §9-1 ~ §9-6 결정

아직 열린 것
- 관리자 계정(`account_type='ADMIN'`) 생성 경로: 현재는 `accountAuth.ts:320`의 seed 로직이 관리함. 이 흐름을 신규 users에 1:1 이관하고 seed 스크립트만 업데이트하면 됨 — 별도 의사결정 없음.
- `user_therapist_mappings`의 ENDED 상태 전이 규칙 (환자 탈퇴, 치료사 탈퇴, 기관 탈퇴 각각) — 운영 단계에서 재확정, 마이그에는 영향 없음.

---

## 11. 다음 작업 (갱신)

1. 이 문서를 **단일 참조본**으로 확정 (사용자 승인)
2. `docs/database/account-onboarding-redesign.sql`을 이 문서에 맞춰 개정
   - `institution_members.role`에 'PATIENT' 추가
   - `users`에 `login_key_hash`, `last_login_at` 추가
   - `institutions`의 5개 컬럼 NULLABLE 완화
   - `user_pii_profile`, `clinical_patient_profiles` 추가
   - `patient_pseudonym_map.user_id` 컬럼 추가, `patient_id` 제거 대비
3. 신규 리포지토리 레이어 스캐폴드 (`src/lib/server/usersDb.ts`, `institutionsDb.ts`, `therapistProfilesDb.ts`) — 아직 import해 쓰지는 않음
4. 신규 회원가입/치료사가입/기관등록 API 경로의 **신규 테이블 쓰기**부터 추가 (기존 app_users 쓰기 경로는 유지, 이중 쓰기 기간)
5. 관리자 승인 액션을 §8-3 원자적 트랜잭션으로 리팩터
6. 가입 화면의 셀렉트 쿼리를 §8-1 기준으로 전환
7. 로그인 경로 전환은 **마지막**
8. 기존 데이터 백필 및 레거시 테이블 폐기

