# 통일 스키마 이중 쓰기 — 단계별 롤백 플레이북

작성일: 2026-04-21
대상 단계: Task #14 ~ #17 (기능 플래그 도입 → 신규 테이블 생성 → 리포지토리 작성 → 이중 쓰기)

이 문서는 **서버를 잘 모르는 사람이 혼자 원상복구할 수 있도록** 각 단계에서 "무엇이 변했고, 무엇을 되돌리면 되는지"를 명시한다. 전제는 한 가지다.

> **기본값은 항상 레거시 쪽.** 기능 플래그 `USE_NEW_USERS_SCHEMA`가 꺼져 있으면 운영 경로는 기존 동작과 동일하다. 모든 롤백의 1순위 조치는 **"플래그를 끄고 서버 재시작"**.

---

## 0. 사전 요구사항 — 매 단계 공통

어떤 단계든 작업 직전에 다음을 수행한다.

1. 로컬 DB 백업 (자동 포함되어 있지만 수동 확인 가능):

   ```powershell
   cd C:\Users\pc\Desktop\ProjectFiles\BrainFriends
   .\scripts\db-backup.ps1
   ```

   결과는 `data\db-backups\brainfriends_dev_YYYYMMDD_HHMMSS.sql` 에 저장된다.

2. 스모크 스냅샷 baseline 생성:

   ```powershell
   npx tsx scripts/smoke-snapshot.ts --baseline
   ```

   결과는 `data\smoke-snapshots\YYYYMMDD_HHMMSS.json`.

3. 작업 후 비교:

   ```powershell
   npx tsx scripts/smoke-snapshot.ts
   ```

   "변화 감지: …" 가 뜨면 내용을 읽고 의도된 변경인지 확인한다.

---

## Task #14. 기능 플래그 스캐폴드

### 무엇을 했는가

- `src/lib/server/featureFlags.ts` 추가 (환경 변수 읽기 전용 유틸).
- `.env.example` 에 `USE_NEW_USERS_SCHEMA` / `USE_NEW_USERS_SCHEMA_STRICT` 추가.
- **아직 아무도 이 플래그를 import 하지 않는다.** 동작 변경 0.

### 롤백 방법

- 되돌릴 것 없음. 플래그만 있고 사용하는 곳이 없다.
- 완전 제거가 필요하면 `src/lib/server/featureFlags.ts` 파일 삭제 + `.env.example` 에서 두 줄 제거.

---

## Task #15. 신규 테이블을 로컬 DB 에 생성

### 무엇을 하는가

```powershell
.\scripts\db-apply-unified-schema.ps1
```

스크립트는 자동으로 다음을 수행한다.

1. `.env.local` 에서 `DATABASE_URL` 읽기 + localhost 확인 (아니면 거부).
2. `db-backup.ps1` 로 자동 백업.
3. `docs\database\account-onboarding-redesign.sql` 적용.

적용되는 것:

- 신규 테이블: `users`, `user_pii_profile`, `therapist_profiles`, `institutions`, `institution_members`, `user_therapist_mappings`, `clinical_patient_profiles`.
- 기존 테이블에 **추가되는 컬럼**만: `patient_pseudonym_map.user_id` (UNIQUE, NULL 허용).
- 인덱스 몇 개.

**기존 레거시 테이블의 어떤 컬럼도 삭제하거나 변경하지 않는다.** (app_users, patient_pii, patient_intake_profiles, organizations, therapist_patient_assignments 전부 그대로 유지.)

### 자가 점검 체크리스트

- [ ] `psql -h localhost -U postgres -d brainfriends_dev -c "\dt"` 에서 신규 테이블 7개가 보이는가?
- [ ] `SELECT count(*) FROM app_users;` 가 여전히 예전 숫자와 같은가?
- [ ] `SELECT count(*) FROM users;` = 0 인가? (아직 아무도 안 썼으므로 0 이 정상)
- [ ] `npm run build` 가 여전히 성공하는가?

### 롤백 방법

**상황 1 — 스크립트가 중간에 실패했다:**

1. PowerShell 출력의 마지막 백업 파일 경로를 확인.
2. 레거시 데이터가 멀쩡한지 확인:

   ```powershell
   psql -h localhost -U postgres -d brainfriends_dev -c "SELECT count(*) FROM app_users;"
   ```

3. 실패 메시지를 그대로 기록해둔다 (다음 시도 시 원인 파악용).
4. 이 SQL 은 idempotent — 동일 명령을 다시 실행해도 안전. 부분 적용된 상태 위에 나머지가 얹힌다.

**상황 2 — 신규 테이블을 완전히 없애고 싶다:**

방법 A (간편, 추천) — 백업으로 복원:

```powershell
psql -h localhost -U postgres -d brainfriends_dev -f "data\db-backups\<백업파일>.sql"
```

(백업은 `pg_dump --no-owner --no-privileges --format=plain` 로 떠 두었으므로 `psql -f` 로 그대로 복원된다. 먼저 DB 를 비우거나 DROP DATABASE → CREATE DATABASE → psql -f 순으로 가면 가장 깨끗하다.)

방법 B (외과적 제거) — SQL 로 필요한 것만 삭제:

```sql
-- 주의: 이 순서대로 실행. 외래키 때문에 순서가 중요.
ALTER TABLE patient_pseudonym_map DROP COLUMN IF EXISTS user_id;
DROP TABLE IF EXISTS clinical_patient_profiles;
DROP TABLE IF EXISTS user_therapist_mappings;
DROP TABLE IF EXISTS institution_members;
DROP TABLE IF EXISTS institutions;
DROP TABLE IF EXISTS therapist_profiles;
DROP TABLE IF EXISTS user_pii_profile;
DROP TABLE IF EXISTS users;
```

Task #17 까지 진행한 뒤 롤백한다면, 이중 쓰기로 들어간 데이터가 신규 테이블에 있을 수 있다. 그 경우 방법 A (백업 복원) 가 더 안전하다.

---

## Task #16. 빈 리포지토리 레이어 작성

### 무엇을 하는가

`src/lib/server/` 아래에 다음 파일들을 추가한다. 각 파일은 신규 테이블에 대한 INSERT/SELECT/UPDATE 함수만 포함한다.

- `usersDb.ts`
- `userPiiProfileDb.ts`
- `therapistProfilesDb.ts`
- `institutionsDb.ts`
- `institutionMembersDb.ts`
- `userTherapistMappingsDb.ts`
- `clinicalPatientProfilesDb.ts`

**이 단계에서도 누가 이 함수들을 호출하지 않는다.** import 가능한 상태만 만든다. 동작 변경 0.

### 자가 점검 체크리스트

- [ ] `npm run build` 성공?
- [ ] `npx tsx scripts/smoke-snapshot.ts` 변화 없음?

### 롤백 방법

- 해당 파일들을 삭제한다. 어떤 기존 코드도 이 파일들을 참조하지 않으므로 삭제만으로 원복.
- `git status` → 새로 추가된 `*.ts` 파일만 나올 것. `git clean -fd src/lib/server/` 는 위험하므로 수동 삭제 권장.

---

## Task #17. 4개 경로에 이중 쓰기 추가

### 무엇을 하는가

다음 네 경로에서 **레거시 쓰기 뒤에** 기능 플래그 가드 안에서 신규 테이블에도 미러링한다.

1. `src/app/api/auth/signup/route.ts` — 일반회원 / 치료사 / 기관 가입
2. 기관 대기열 승인 경로 (관리자 액션)
3. 치료사 승인 경로 (관리자 액션)
4. 치료사–환자 매칭 생성 경로

패턴:

```ts
import { featureFlags } from "@/lib/server/featureFlags";

// 레거시 쓰기 먼저 (기존 코드 그대로)
await createAccountLegacy(...);

// 이중 쓰기는 플래그가 켜져 있을 때만
if (featureFlags.useNewUsersSchema) {
  try {
    await mirrorAccountToNewSchema(...);
  } catch (err) {
    if (featureFlags.useNewUsersSchemaStrict) throw err;
    console.error("[dual-write] users mirror failed (non-fatal):", err);
  }
}
```

### 롤백 방법 — 3단 트리

**1순위 (즉시) — 환경 변수로 끄기:**

`.env.local` 에서

```
USE_NEW_USERS_SCHEMA=false
```

로 바꾸고 서버 재시작. 이 한 줄이 전체 이중 쓰기를 즉시 차단한다. 코드 롤백 불필요.

**2순위 — 신규 테이블에 들어간 데이터 삭제:**

이중 쓰기가 불안정해서 신규 테이블 데이터가 깨졌다고 판단되면:

```sql
-- 순서 중요 (외래키)
DELETE FROM user_therapist_mappings;
DELETE FROM institution_members;
DELETE FROM institutions WHERE legacy_organization_id IS NOT NULL; -- 마이그 생성분만
DELETE FROM clinical_patient_profiles;
DELETE FROM user_pii_profile;
DELETE FROM therapist_profiles;
UPDATE patient_pseudonym_map SET user_id = NULL WHERE user_id IS NOT NULL;
DELETE FROM users WHERE legacy_user_role IS NOT NULL; -- 마이그 생성분만
```

레거시 테이블은 영향 받지 않음 → 앱은 정상 동작 지속.

**3순위 — 코드 자체를 원복:**

`git log -- src/app/api/auth/signup/route.ts` 에서 이중 쓰기 커밋 직전 해시를 찾고,

```bash
git checkout <prev-hash> -- src/app/api/auth/signup/route.ts <다른 수정 파일들>
```

후 재빌드.

### 점검 체크리스트

- [ ] 플래그 OFF 상태에서: 기존 가입 / 승인 / 매칭 플로우가 기존과 동일하게 동작?
- [ ] 플래그 OFF 상태에서: 스모크 스냅샷에서 `users.count` 등이 0 그대로?
- [ ] 플래그 ON 상태에서: 새 가입 1건 테스트 → `app_users` 1증가 **그리고** `users` 1증가?
- [ ] 플래그 ON 상태에서: 중복 이메일/전화로 가입 시도 → 레거시 에러 메시지가 기존과 동일?

---

## 긴급 전체 롤백 (완전 되돌리기)

"뭐가 어디서 어떻게 깨졌는지 모르겠다 — 그냥 어제 상태로 돌리고 싶다":

1. 서버 중단 (`Ctrl+C`).
2. `.env.local` 에서 `USE_NEW_USERS_SCHEMA=false` (또는 삭제).
3. 가장 최근 정상 백업으로 DB 복원:

   ```powershell
   psql -h localhost -U postgres -d brainfriends_dev -f "data\db-backups\<가장 최근 정상 백업>.sql"
   ```

   (주의: 기본적으로 이 복원은 기존 데이터에 덮어쓰기이지 drop-and-recreate 가 아니다. 완전 깨끗한 복원이 필요하면 `DROP DATABASE brainfriends_dev; CREATE DATABASE brainfriends_dev;` 후 `psql -f` 를 실행.)

4. 코드는 마지막 안정 커밋으로:

   ```bash
   git log --oneline -n 20
   git checkout <안정 해시> -- .
   ```

5. `npm run build` → 성공 확인 → `npm run dev` 재시작.
6. `npx tsx scripts/smoke-snapshot.ts --baseline` 다시 찍어 두기.

---

## 부록 — "뭐가 변했는지 확인하기"

작업 중간에 상태가 의심스러울 때:

```powershell
# 1) 컴파일이 깨지지 않았는지
npm run build

# 2) DB 상태가 변했는지
npx tsx scripts/smoke-snapshot.ts

# 3) 현재 플래그 상태
Write-Host "USE_NEW_USERS_SCHEMA = $env:USE_NEW_USERS_SCHEMA"
Select-String -Path .env.local -Pattern "USE_NEW_USERS_SCHEMA"

# 4) Git 으로 추적되는 파일 변경
git status
git diff --stat
```

이 네 가지 체크포인트만 돌려도 "현재 상태가 레거시 그대로인가, 뭔가 바뀌었는가" 를 판별할 수 있다.
