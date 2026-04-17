-- BrainFriends 시험용 DB 초기화 스크립트
-- 생성일: 2026-04-17
-- 용도: 공인성적서 시험기관 제출용 시험 환경 초기화
-- 주의: 이 파일은 시험 환경 전용입니다. 운영 DB에 적용하지 마십시오.

-- ================================================================
-- 1. 스키마 생성 (brainfriends_dev.sql 기준)
-- ================================================================
-- 아래 경로의 스키마를 먼저 적용한 후 이 파일을 실행하십시오.
-- psql -U postgres -d brainfriends_test -f docs/database/brainfriends_dev.sql
-- psql -U postgres -d brainfriends_test -f docs/database/brainfriends_test_init.sql

BEGIN;

-- ================================================================
-- 2. 기존 시험 데이터 초기화 (재실행 가능하도록)
-- ================================================================
DELETE FROM auth_sessions;
DELETE FROM training_usage_events;
DELETE FROM training_client_drafts;
DELETE FROM language_training_results;
DELETE FROM sing_results;
DELETE FROM clinical_media_objects;
DELETE FROM clinical_sessions;
DELETE FROM ai_evaluation_samples WHERE true;
DELETE FROM app_users;
DELETE FROM patient_pseudonym_map;
DELETE FROM patient_intake_profiles;
DELETE FROM patient_pii;

-- ================================================================
-- 3. 시험 계정 생성
-- ================================================================
-- 계정 정보 요약:
--   관리자:  ID=test-admin      / PW=Test1234!
--   치료사:  ID=test-therapist  / PW=Test1234!
--   환자 1:  ID=test-patient-01 / PW=Test1234!  (자가진단 시험용)
--   환자 2:  ID=test-patient-02 / PW=Test1234!  (언어재활 시험용)

-- [ADMIN] test-admin
INSERT INTO patient_pii (patient_id, patient_code, full_name, birth_date, sex, phone, language)
VALUES (
  '212d3a9c-7b76-45ca-a188-e7d343d0971c',
  'TEST-ADM-2053',
  '시험관리자',
  '1980-01-01',
  'M',
  '000-0000-0001',
  'ko'
);

INSERT INTO patient_intake_profiles (patient_id, education_years, hemiplegia, hemianopsia, hand)
VALUES ('212d3a9c-7b76-45ca-a188-e7d343d0971c', 16, 'N', 'NONE', 'R');

INSERT INTO patient_pseudonym_map (patient_pseudonym_id, patient_id, mapping_version)
VALUES ('cfb795efb24188f61f4f700e40f33a1b42e7eb4f', '212d3a9c-7b76-45ca-a188-e7d343d0971c', 'pseudonym-map-v1');

INSERT INTO app_users (user_id, patient_id, user_role, login_id, login_key_hash, password_hash)
VALUES (
  '035cdf20-fab7-41be-a626-4539ab8f91e5',
  '212d3a9c-7b76-45ca-a188-e7d343d0971c',
  'admin',
  'test-admin',
  'f2822da544d571cc41d4889c459da1981b830b6128b071dcdd494d002ff747f9',
  'ae5cf726633475a336d240ea4b0547fe:a22245b2447fbac6cc120295d4f05009abc274610bf550640d7b1c0eb8e22d62e28466ae0288661186bce84022788eb2c7fcd97cae71f206a529614c585d263d'
);

-- [THERAPIST] test-therapist
INSERT INTO patient_pii (patient_id, patient_code, full_name, birth_date, sex, phone, language)
VALUES (
  'fec6611f-a7e4-4713-8e44-1983f78e267e',
  'TEST-THE-8641',
  '시험치료사',
  '1985-03-15',
  'F',
  '000-0000-0002',
  'ko'
);

INSERT INTO patient_intake_profiles (patient_id, education_years, hemiplegia, hemianopsia, hand)
VALUES ('fec6611f-a7e4-4713-8e44-1983f78e267e', 16, 'N', 'NONE', 'R');

INSERT INTO patient_pseudonym_map (patient_pseudonym_id, patient_id, mapping_version)
VALUES ('17f691e049c466bd2b126bb9f8656f8884cf7862', 'fec6611f-a7e4-4713-8e44-1983f78e267e', 'pseudonym-map-v1');

INSERT INTO app_users (user_id, patient_id, user_role, login_id, login_key_hash, password_hash)
VALUES (
  '63590d72-42d0-442c-9abf-caaf800a8699',
  'fec6611f-a7e4-4713-8e44-1983f78e267e',
  'therapist',
  'test-therapist',
  '672e6ff65d7bbafefaf8ca343f31beb2ff9d3faced25ef5a3a9f6c7a2ca75f0c',
  '1064066418775a5754128ad4bbaddb90:32c9e343f97611e2883c008b00b03f4eeaab23126d022d76a91d88158af29cd2e9b8d8ed81fdb10e93ecd43d34acb67b8cf5f014273c8474b04cc3f385cacba9'
);

-- [PATIENT] test-patient-01
INSERT INTO patient_pii (patient_id, patient_code, full_name, birth_date, sex, phone, language)
VALUES (
  '0ceadb6e-46e5-446a-8c04-13a1db57fa1d',
  'TEST-PAT-8884',
  '시험환자일',
  '1955-06-10',
  'M',
  '000-0000-0003',
  'ko'
);

INSERT INTO patient_intake_profiles (patient_id, education_years, hemiplegia, hemianopsia, hand)
VALUES ('0ceadb6e-46e5-446a-8c04-13a1db57fa1d', 9, 'N', 'NONE', 'R');

INSERT INTO patient_pseudonym_map (patient_pseudonym_id, patient_id, mapping_version)
VALUES ('0c17e9fe07cdd9097c46cc300639c686fc46bf7f', '0ceadb6e-46e5-446a-8c04-13a1db57fa1d', 'pseudonym-map-v1');

INSERT INTO app_users (user_id, patient_id, user_role, login_id, login_key_hash, password_hash)
VALUES (
  '625229ef-7e3f-4c3e-a3a0-a040922d2097',
  '0ceadb6e-46e5-446a-8c04-13a1db57fa1d',
  'patient',
  'test-patient-01',
  '06c2f997248c1f7747a62e53fed1dbd4beb1f858279226aa806d5795ac6c28d9',
  '91785e0e9f7af320e84e84dde4d3e9d7:75eb66efed905895904af952e96e3204a4383ab6feb11ef1247f02281f4ffd9c5ab2a3bab2eb1e5cfe0d63716fb1a585cd01342e85e7f6d64f5fd83e7b4dddf9'
);

-- [PATIENT] test-patient-02
INSERT INTO patient_pii (patient_id, patient_code, full_name, birth_date, sex, phone, language)
VALUES (
  '4a323e8c-43ff-4e84-b9c1-d9b1c74d844a',
  'TEST-PAT-1885',
  '시험환자이',
  '1962-11-20',
  'F',
  '000-0000-0004',
  'ko'
);

INSERT INTO patient_intake_profiles (patient_id, education_years, hemiplegia, hemianopsia, hand)
VALUES ('4a323e8c-43ff-4e84-b9c1-d9b1c74d844a', 6, 'N', 'NONE', 'R');

INSERT INTO patient_pseudonym_map (patient_pseudonym_id, patient_id, mapping_version)
VALUES ('caa715a1c6736a5c2661a03331672c208474ccec', '4a323e8c-43ff-4e84-b9c1-d9b1c74d844a', 'pseudonym-map-v1');

INSERT INTO app_users (user_id, patient_id, user_role, login_id, login_key_hash, password_hash)
VALUES (
  '748fdcdc-c2cd-4ab6-b2dc-d3078e40d724',
  '4a323e8c-43ff-4e84-b9c1-d9b1c74d844a',
  'patient',
  'test-patient-02',
  'af7fdb87c377ee13677924addeb3779532e832f42aa151dda5df44843bc20d0c',
  'c2d22da446724d7e472735a0b8b293bc:e55a26851c5949b6d0b42cc1417c81e3bfad28ac7d53f3f0041b79cf4f3a8d852bcf9d91b0d657c652264b747530481b0fd0cb11c1d6ce054e60dd5bf933ac2a'
);

COMMIT;

-- ================================================================
-- 4. 생성 확인 쿼리
-- ================================================================
SELECT u.login_id, u.user_role, p.full_name, p.birth_date
FROM app_users u
JOIN patient_pii p ON p.patient_id = u.patient_id
ORDER BY u.user_role, u.login_id;
