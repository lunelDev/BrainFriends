# 회원가입 필드 인벤토리

## 목적

회원가입 시 수집하는 모든 필드를 한 표로 정리한다. 신규 필드를 추가할 때:

1. 이 표에 한 줄을 먼저 추가한다
2. 민감도 등급에 맞춰 저장/암호화/접근제어 정책이 결정된다
3. 동의 항목 매핑 컬럼이 비어 있으면 동의 화면도 같이 갱신해야 한다는 신호다
4. AI 입력 컬럼이 `Y` 면 AI 평가 데이터셋 정의서 분포에도 반영해야 한다

이 표는 시험기관 사전검토 시 "민감정보 분류표" 와 "사용자 동의 범위" 의 근거가 된다.

## 민감도 등급 정의

- **L0 시스템**: 시스템 동작용 식별자, 본인 정보 아님 (예: UUID)
- **L1 일반**: 공개되어도 큰 위험 없음 (예: 표시 이름)
- **L2 개인**: 개인식별정보 (PII) — 이름·생년월일·연락처·주소 조합
- **L3 민감**: 「개인정보 보호법」 23조의 민감정보 — 건강·장애·의료력
- **L4 인증비밀**: 단방향 해시만 저장, 평문 비저장 (예: 비밀번호)

## 환자(patient) 가입 필드

| 필드명 | 화면 위치 | DB 컬럼 | 민감도 | AI 입력 | 동의 매핑 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| loginId | signup step1 | `app_users.login_id` | L1 | N | 회원가입 동의 | unique |
| name | signup step1 | `patient_pii.full_name` | L2 | N | 회원가입 동의 | login_key_hash 입력 |
| birthDate | signup step1 | `patient_pii.birth_date` | L2 | N | 회원가입 동의 | login_key_hash 입력 |
| phoneLast4 | signup step1 | `patient_pii.phone` (last4) | L2 | N | 회원가입 동의 | identity_key_hash 입력 |
| password | signup step1 | `app_users.password_hash` | L4 | N | 회원가입 동의 | scrypt + salt |
| gender | signup step2 | `patient_pii.sex` | L2 | TBD | 건강정보 동의 | M/F/U |
| educationYears | signup step2 | `patient_intake_profiles.education_years` | L2 | TBD | 건강정보 동의 | 정수 |
| onsetDate | signup step2 | `patient_intake_profiles.onset_date` | L3 | TBD | 건강정보 동의 | 발병일 |
| hemiplegia | signup step2 | `patient_intake_profiles.hemiplegia` | L3 | Y | 건강정보 동의 | Y/N |
| hemianopsia | signup step2 | `patient_intake_profiles.hemianopsia` | L3 | Y | 건강정보 동의 | LEFT/RIGHT/NONE |
| organizationId | signup step1 | `app_users.organization_id` | L1 | N | 회원가입 동의 | 선택 |

## 치료사(therapist) 가입 필드

| 필드명 | DB 컬럼 / JSON | 민감도 | AI 입력 | 동의 매핑 | 비고 |
| --- | --- | --- | --- | --- | --- |
| name | `patient_pii.full_name` | L2 | N | 회원가입 동의 | |
| birthDate | `patient_pii.birth_date` | L2 | N | 회원가입 동의 | |
| phone (full) | `therapist_registration_profiles.phone` | L2 | N | 회원가입 동의 | 11자리 |
| email | `therapist_registration_profiles.email` | L2 | N | 회원가입 동의 | |
| password | `app_users.password_hash` | L4 | N | 회원가입 동의 | scrypt |
| profession | profile.profession | L1 | N | 회원가입 동의 | enum |
| licenseNumber | profile.license_number | L2 | N | 회원가입 동의 | 자격증번호 |
| licenseFileDataUrl | profile.license_file_data_url | L2 | N | 회원가입 동의 | base64 또는 object key |
| licenseIssuedBy / Date | profile.license_issued_by / date | L1 | N | 회원가입 동의 | |
| employmentStatus | profile.employment_status | L1 | N | 회원가입 동의 | |
| department | profile.department | L1 | N | 회원가입 동의 | |
| twoFactorMethod | profile.two_factor_method | L1 | N | 회원가입 동의 | otp/sms |
| accessRole | profile.access_role | L1 | N | 회원가입 동의 | |
| canViewPatients / canEditPatientData / canEnterEvaluation | profile.\* | L1 | N | 환자데이터 접근 동의 | bool |
| experienceYears | profile.experience_years | L1 | N | 회원가입 동의 | |
| specialties | profile.specialties | L1 | N | 회원가입 동의 | |
| servicePurpose | profile.service_purpose | L1 | N | 회원가입 동의 | |
| targetPatientTypes | profile.target_patient_types | L1 | N | 회원가입 동의 | |
| dataConsentScope | profile.data_consent_scope | L1 | N | 환자데이터 접근 동의 | |
| irbParticipation | profile.irb_participation | L1 | N | 회원가입 동의 | none/planned/approved |
| privacyAgreed | profile.privacy_agreed | L0 | N | 개인정보 동의 | bool 동의 증적 |
| patientDataAccessAgreed | profile.patient_data_access_agreed | L0 | N | 환자데이터 동의 | bool 동의 증적 |
| securityPolicyAgreed | profile.security_policy_agreed | L0 | N | 보안정책 동의 | bool 동의 증적 |
| confidentialityAgreed | profile.confidentiality_agreed | L0 | N | 비밀유지 동의 | bool 동의 증적 |

## 1인 기관(soloInstitution) 신청 필드

| 필드명 | 저장 위치 | 민감도 | 비고 |
| --- | --- | --- | --- |
| organizationName | `organization_registration_requests.organization_name` | L1 | 기관명 |
| businessNumber | request.business_number | L2 | 사업자번호 |
| representativeName | request.representative_name | L2 | 대표자명 |
| organizationType | request.organization_type | L1 | |
| careInstitutionNumber | request.care_institution_number | L2 | 요양기관번호 |
| organizationPhone | request.organization_phone | L2 | |
| postalCode / roadAddress / addressDetail | request.\* | L2 | 주소 |
| businessLicenseFileDataUrl | request.business_license_file_data_url | L2 | base64 |

## 신규 필드 추가 시 체크리스트

신규 필드 한 개를 추가하려면 다음을 모두 갱신해야 함:

1. 이 표에 한 줄 추가
2. DB 마이그레이션 SQL 작성 (`docs/database/brainfriends_dev.sql` 또는 별도 migration 파일)
3. `src/lib/server/accountAuth.ts` 의 `SignupAccountInput` 타입에 필드 추가
4. `src/app/api/auth/signup/route.ts` 에서 body → createAccount 매핑 추가
5. `src/app/signup/page.tsx` (또는 OrganizationBasicFields) 에 입력 UI 추가
6. 민감도 L3 이상이면 동의 항목 갱신 + 동의 증적(불리언) 필드도 같이 추가
7. AI 입력 사용이면 `docs/remediation/03-ai-evaluation/ai-evaluation-dataset-definition.md` 의 분포 표에 추가
8. 관리자 화면 (`AdminConsoleClient.tsx`) 노출 여부 결정 + 회원관리 표에 컬럼 추가 여부 판단
9. `docs/remediation/02-cybersecurity/sensitive-data-classification.md` 에 같은 줄 미러링

## 정리

이 표가 회원가입 관련 변경의 단일 진입점이다. 새 필드는 여기에 먼저 등장하고, 그다음에 코드/DB/UI 가 따라간다. 시험기관 제출 시 이 표 한 장이 "수집 정보 전체 목록 + 민감도 분류 + 동의 매핑" 의 증적이 된다.
