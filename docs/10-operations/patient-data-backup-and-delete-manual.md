# 환자 데이터 백업 및 삭제 매뉴얼

이 문서는 BrainFriends 운영 환경에서 기존 환자 데이터를 백업한 뒤 삭제하는 절차를 정리한다.

목표:
- 운영 DB 데이터 백업
- NCP Object Storage 미디어 백업
- 환자 데이터 삭제
- 관리자 계정 유지

주의:
- 삭제 전에 반드시 백업을 먼저 완료한다.
- 아래 절차는 운영 서버와 운영 Object Storage를 대상으로 한다.
- 현재 프로젝트 기준으로 버킷 이름은 `brianfriends` 이다.
- 삭제 후에는 복구가 어렵다.

## 1. 운영 DB 백업

### 1-1. 운영 서버 접속

```bash
ssh root@223.130.147.97
```

### 1-2. 프로젝트 폴더 이동 및 환경변수 로드

```bash
cd ~/BrainFriends
set -a
. ./.env
set +a
```

### 1-3. PostgreSQL dump 생성

```bash
pg_dump "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges --quote-all-identifiers > brainfriends-backup.sql
ls -lh brainfriends-backup.sql
```

정상 기준:
- `brainfriends-backup.sql` 파일이 생성됨
- 파일 크기가 0이 아님

### 1-4. 로컬 PC로 백업 파일 복사

로컬 터미널에서 실행:

```powershell
scp root@223.130.147.97:~/BrainFriends/brainfriends-backup.sql .
```

## 2. NCP Object Storage 백업

NCP Object Storage는 S3 호환 API이므로 `AWS CLI`로 전체 다운로드하는 것이 가장 빠르다.

### 2-1. AWS CLI 설치 확인

```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" --version
```

### 2-2. NCP Object Storage 키 설정

```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" configure set aws_access_key_id YOUR_NCP_ACCESS_KEY
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" configure set aws_secret_access_key YOUR_NCP_SECRET_KEY
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" configure set default.region kr-standard
```

### 2-3. Object Storage 목록 확인

```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" s3 ls s3://brianfriends/patients --recursive --endpoint-url https://kr.object.ncloudstorage.com
```

### 2-4. 전체 환자 미디어 다운로드

```powershell
mkdir C:\Users\pc\Desktop\ProjectFiles\BrainFriends\object-backup
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" s3 sync s3://brianfriends/patients C:\Users\pc\Desktop\ProjectFiles\BrainFriends\object-backup\patients --endpoint-url https://kr.object.ncloudstorage.com
```

### 2-5. 다운로드 확인

```powershell
Get-ChildItem C:\Users\pc\Desktop\ProjectFiles\BrainFriends\object-backup\patients -Recurse | Select-Object -First 20
```

정상 기준:
- `object-backup\patients` 아래에 실제 파일이 존재함
- 예: `.webm`, `.png`, `.jpg`

## 3. 운영 DB 접속

운영 서버에서 다시 아래 순서로 접속한다.

```bash
cd ~/BrainFriends
set -a
. ./.env
set +a
psql "$DATABASE_URL"
```

정상 기준:
- 프롬프트가 `brainfriends=>` 로 바뀜

주의:
- `brainfriends=>` 상태에서는 `psql "$DATABASE_URL"` 를 다시 입력하지 않는다.
- 이 상태에서는 SQL만 실행한다.

종료:

```sql
\q
```

## 4. 환자 목록 확인

현재 등록된 환자를 확인한다.

```sql
SELECT
  pii.patient_id,
  pii.full_name,
  pii.patient_code,
  ppm.patient_pseudonym_id
FROM patient_pii pii
JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
ORDER BY pii.created_at DESC;
```

예시 결과:
- 일반 환자 3명
- 관리자 1명

## 5. 환자 데이터 삭제 원칙

현재 운영 목적:
- 관리자 계정은 유지
- 환자 데이터는 삭제

삭제 대상:
- `clinical_media_objects`
- `language_training_results`
- `sing_results`
- `clinical_sessions`
- `training_usage_events`
- `auth_sessions`
- `training_client_drafts`
- `app_users` 중 `user_role = 'patient'`
- `patient_intake_profiles`
- `patient_pseudonym_map`
- `patient_pii`

## 6. 일반 환자 데이터 삭제

아래 SQL은 `user_role = 'patient'` 인 사용자 데이터만 삭제한다.

```sql
BEGIN;

WITH patient_targets AS (
  SELECT
    au.user_id,
    au.patient_id,
    ppm.patient_pseudonym_id
  FROM app_users au
  JOIN patient_pseudonym_map ppm ON ppm.patient_id = au.patient_id
  WHERE au.user_role = 'patient'
)
DELETE FROM clinical_media_objects
WHERE patient_pseudonym_id IN (
  SELECT patient_pseudonym_id FROM patient_targets
);

WITH patient_targets AS (
  SELECT
    au.user_id,
    au.patient_id,
    ppm.patient_pseudonym_id
  FROM app_users au
  JOIN patient_pseudonym_map ppm ON ppm.patient_id = au.patient_id
  WHERE au.user_role = 'patient'
)
DELETE FROM language_training_results
WHERE patient_pseudonym_id IN (
  SELECT patient_pseudonym_id FROM patient_targets
);

WITH patient_targets AS (
  SELECT
    au.user_id,
    au.patient_id,
    ppm.patient_pseudonym_id
  FROM app_users au
  JOIN patient_pseudonym_map ppm ON ppm.patient_id = au.patient_id
  WHERE au.user_role = 'patient'
)
DELETE FROM sing_results
WHERE patient_pseudonym_id IN (
  SELECT patient_pseudonym_id FROM patient_targets
);

WITH patient_targets AS (
  SELECT
    au.user_id,
    au.patient_id,
    ppm.patient_pseudonym_id
  FROM app_users au
  JOIN patient_pseudonym_map ppm ON ppm.patient_id = au.patient_id
  WHERE au.user_role = 'patient'
)
DELETE FROM clinical_sessions
WHERE patient_pseudonym_id IN (
  SELECT patient_pseudonym_id FROM patient_targets
);

WITH patient_targets AS (
  SELECT
    au.user_id,
    au.patient_id,
    ppm.patient_pseudonym_id
  FROM app_users au
  JOIN patient_pseudonym_map ppm ON ppm.patient_id = au.patient_id
  WHERE au.user_role = 'patient'
)
DELETE FROM training_usage_events
WHERE patient_pseudonym_id IN (
  SELECT patient_pseudonym_id FROM patient_targets
);

WITH patient_targets AS (
  SELECT user_id
  FROM app_users
  WHERE user_role = 'patient'
)
DELETE FROM auth_sessions
WHERE user_id IN (
  SELECT user_id FROM patient_targets
);

WITH patient_targets AS (
  SELECT user_id
  FROM app_users
  WHERE user_role = 'patient'
)
DELETE FROM training_client_drafts
WHERE user_id IN (
  SELECT user_id FROM patient_targets
);

DELETE FROM app_users
WHERE user_role = 'patient';

DELETE FROM patient_intake_profiles
WHERE patient_id IN (
  SELECT patient_id
  FROM patient_pii
  WHERE patient_id NOT IN (
    SELECT patient_id FROM app_users
  )
);

DELETE FROM patient_pseudonym_map
WHERE patient_id IN (
  SELECT patient_id
  FROM patient_pii
  WHERE patient_id NOT IN (
    SELECT patient_id FROM app_users
  )
);

DELETE FROM patient_pii
WHERE patient_id NOT IN (
  SELECT patient_id FROM app_users
);

COMMIT;
```

## 7. 관리자 계정에 연결된 훈련 데이터 삭제

관리자 계정은 유지하되, 관리자가 생성한 세션/결과/미디어도 비우려면 아래 SQL을 실행한다.

현재 예시 기준 관리자의 `patient_pseudonym_id`:

```text
psn_05121fac6e7b98b64b51a284
```

실행 SQL:

```sql
BEGIN;

DELETE FROM clinical_media_objects
WHERE patient_pseudonym_id = 'psn_05121fac6e7b98b64b51a284';

DELETE FROM language_training_results
WHERE patient_pseudonym_id = 'psn_05121fac6e7b98b64b51a284';

DELETE FROM sing_results
WHERE patient_pseudonym_id = 'psn_05121fac6e7b98b64b51a284';

DELETE FROM clinical_sessions
WHERE patient_pseudonym_id = 'psn_05121fac6e7b98b64b51a284';

DELETE FROM training_usage_events
WHERE patient_pseudonym_id = 'psn_05121fac6e7b98b64b51a284';

DELETE FROM training_client_drafts
WHERE user_id IN (
  SELECT user_id
  FROM app_users
  WHERE user_role = 'admin'
);

DELETE FROM auth_sessions
WHERE user_id IN (
  SELECT user_id
  FROM app_users
  WHERE user_role = 'admin'
);

COMMIT;
```

## 8. DB 삭제 결과 확인

아래 SQL을 실행해 최종 상태를 확인한다.

```sql
SELECT user_role, COUNT(*) FROM app_users GROUP BY user_role;
SELECT COUNT(*) FROM patient_pii;
SELECT COUNT(*) FROM clinical_sessions;
SELECT COUNT(*) FROM language_training_results;
SELECT COUNT(*) FROM sing_results;
SELECT COUNT(*) FROM clinical_media_objects;
```

정상 완료 기준:
- `app_users`: `admin 1`
- `patient_pii`: `1`
- `clinical_sessions`: `0`
- `language_training_results`: `0`
- `sing_results`: `0`
- `clinical_media_objects`: `0`

## 9. NCP Object Storage 실제 삭제

백업이 끝났다면 환자 미디어를 삭제한다.

### 9-1. 삭제 전 목록 확인

```powershell
"C:\Program Files\Amazon\AWSCLIV2\aws.exe" s3 ls s3://brianfriends/patients --recursive --endpoint-url https://kr.object.ncloudstorage.com
```

### 9-2. 환자 미디어 전체 삭제

```powershell
"C:\Program Files\Amazon\AWSCLIV2\aws.exe" s3 rm s3://brianfriends/patients --recursive --endpoint-url https://kr.object.ncloudstorage.com
```

주의:
- 이 명령은 NCP Object Storage에서 실제 파일을 삭제한다.
- 로컬 백업 폴더를 지우는 명령이 아니다.

### 9-3. 삭제 후 확인

```powershell
"C:\Program Files\Amazon\AWSCLIV2\aws.exe" s3 ls s3://brianfriends/patients --recursive --endpoint-url https://kr.object.ncloudstorage.com
```

정상 완료 기준:
- 아무 출력도 나오지 않음

## 10. 최종 완료 상태

최종적으로 아래 상태면 작업 완료다.

- 운영 DB에는 관리자 계정만 남아 있음
- 환자/세션/결과/미디어 메타데이터가 모두 삭제됨
- NCP Object Storage `patients/` 아래 파일이 비어 있음
- 로컬 PC에 `brainfriends-backup.sql` 과 `object-backup/patients/...` 백업본이 남아 있음
