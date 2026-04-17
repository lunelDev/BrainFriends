/**
 * BrainFriends 시험용 DB 초기 데이터 생성 스크립트
 *
 * 용도: 공인성적서 시험기관 제출용 시험 환경 DB 초기화
 * 실행: node scripts/generate-test-db.mjs > docs/database/brainfriends_test_init.sql
 *
 * 주의: 이 스크립트는 실제 앱의 accountAuth.ts와 동일한 해시 방식을 사용합니다.
 *       생성된 SQL 파일은 시험기관 전달용이며 운영 DB에 적용하지 마십시오.
 */

import { createHash, randomBytes, scryptSync } from "crypto";

// ─── accountAuth.ts 와 동일한 해시 함수 ─────────────────────────────────────

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function buildLoginKey({ name, birthDate, phoneLast4 }) {
  return [
    name.trim().replace(/\s+/g, " ").toLowerCase(),
    birthDate.trim(),
    phoneLast4.replace(/\D/g, "").slice(0, 4),
  ].join("|");
}

function loginKeyHash(name, birthDate, phoneLast4) {
  return sha256(buildLoginKey({ name, birthDate, phoneLast4 }));
}

function uuid() {
  // crypto.randomUUID() 대체 (Node 14 이하 호환)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── 시험 계정 정의 ───────────────────────────────────────────────────────────

const TEST_ACCOUNTS = [
  // 관리자 계정
  {
    role: "admin",
    loginId: "test-admin",
    password: "Test1234!",
    name: "시험관리자",
    birthDate: "1980-01-01",
    phoneLast4: "0001",
    sex: "M",
    educationYears: 16,
  },
  // 치료사 계정
  {
    role: "therapist",
    loginId: "test-therapist",
    password: "Test1234!",
    name: "시험치료사",
    birthDate: "1985-03-15",
    phoneLast4: "0002",
    sex: "F",
    educationYears: 16,
  },
  // 환자 계정 1 (자가진단용)
  {
    role: "patient",
    loginId: "test-patient-01",
    password: "Test1234!",
    name: "시험환자일",
    birthDate: "1955-06-10",
    phoneLast4: "0003",
    sex: "M",
    educationYears: 9,
  },
  // 환자 계정 2 (언어재활용)
  {
    role: "patient",
    loginId: "test-patient-02",
    password: "Test1234!",
    name: "시험환자이",
    birthDate: "1962-11-20",
    phoneLast4: "0004",
    sex: "F",
    educationYears: 6,
  },
];

// ─── SQL 생성 ─────────────────────────────────────────────────────────────────

const lines = [];

lines.push(`-- BrainFriends 시험용 DB 초기화 스크립트`);
lines.push(`-- 생성일: ${new Date().toISOString().slice(0, 10)}`);
lines.push(`-- 용도: 공인성적서 시험기관 제출용 시험 환경 초기화`);
lines.push(`-- 주의: 이 파일은 시험 환경 전용입니다. 운영 DB에 적용하지 마십시오.`);
lines.push(``);
lines.push(`-- ================================================================`);
lines.push(`-- 1. 스키마 생성 (brainfriends_dev.sql 기준)`);
lines.push(`-- ================================================================`);
lines.push(`-- 아래 경로의 스키마를 먼저 적용한 후 이 파일을 실행하십시오.`);
lines.push(`-- psql -U postgres -d brainfriends_test -f docs/database/brainfriends_dev.sql`);
lines.push(`-- psql -U postgres -d brainfriends_test -f docs/database/brainfriends_test_init.sql`);
lines.push(``);
lines.push(`BEGIN;`);
lines.push(``);
lines.push(`-- ================================================================`);
lines.push(`-- 2. 기존 시험 데이터 초기화 (재실행 가능하도록)`);
lines.push(`-- ================================================================`);
lines.push(`DELETE FROM auth_sessions;`);
lines.push(`DELETE FROM training_usage_events;`);
lines.push(`DELETE FROM training_client_drafts;`);
lines.push(`DELETE FROM language_training_results;`);
lines.push(`DELETE FROM sing_results;`);
lines.push(`DELETE FROM clinical_media_objects;`);
lines.push(`DELETE FROM clinical_sessions;`);
lines.push(`DELETE FROM ai_evaluation_samples WHERE true;`);
lines.push(`DELETE FROM app_users;`);
lines.push(`DELETE FROM patient_pseudonym_map;`);
lines.push(`DELETE FROM patient_intake_profiles;`);
lines.push(`DELETE FROM patient_pii;`);
lines.push(``);

lines.push(`-- ================================================================`);
lines.push(`-- 3. 시험 계정 생성`);
lines.push(`-- ================================================================`);
lines.push(`-- 계정 정보 요약:`);
lines.push(`--   관리자:  ID=test-admin      / PW=Test1234!`);
lines.push(`--   치료사:  ID=test-therapist  / PW=Test1234!`);
lines.push(`--   환자 1:  ID=test-patient-01 / PW=Test1234!  (자가진단 시험용)`);
lines.push(`--   환자 2:  ID=test-patient-02 / PW=Test1234!  (언어재활 시험용)`);
lines.push(``);

for (const acct of TEST_ACCOUNTS) {
  const patientId = uuid();
  const userId = uuid();
  const pseudonymId = sha256(`test-pseudonym|${acct.loginId}`).slice(0, 40);
  const pwHash = hashPassword(acct.password);
  const keyHash = loginKeyHash(acct.name, acct.birthDate, acct.phoneLast4);

  lines.push(`-- [${acct.role.toUpperCase()}] ${acct.loginId}`);

  // patient_pii
  lines.push(`INSERT INTO patient_pii (patient_id, patient_code, full_name, birth_date, sex, phone, language)`);
  lines.push(`VALUES (`);
  lines.push(`  '${patientId}',`);
  lines.push(`  'TEST-${acct.role.toUpperCase().slice(0, 3)}-${Math.floor(Math.random() * 9000) + 1000}',`);
  lines.push(`  '${acct.name}',`);
  lines.push(`  '${acct.birthDate}',`);
  lines.push(`  '${acct.sex}',`);
  lines.push(`  '000-0000-${acct.phoneLast4}',`);
  lines.push(`  'ko'`);
  lines.push(`);`);
  lines.push(``);

  // patient_intake_profiles
  lines.push(`INSERT INTO patient_intake_profiles (patient_id, education_years, hemiplegia, hemianopsia, hand)`);
  lines.push(`VALUES ('${patientId}', ${acct.educationYears}, 'N', 'NONE', 'R');`);
  lines.push(``);

  // patient_pseudonym_map
  lines.push(`INSERT INTO patient_pseudonym_map (patient_pseudonym_id, patient_id, mapping_version)`);
  lines.push(`VALUES ('${pseudonymId}', '${patientId}', 'pseudonym-map-v1');`);
  lines.push(``);

  // app_users
  lines.push(`INSERT INTO app_users (user_id, patient_id, user_role, login_id, login_key_hash, password_hash)`);
  lines.push(`VALUES (`);
  lines.push(`  '${userId}',`);
  lines.push(`  '${patientId}',`);
  lines.push(`  '${acct.role}',`);
  lines.push(`  '${acct.loginId}',`);
  lines.push(`  '${keyHash}',`);
  lines.push(`  '${pwHash}'`);
  lines.push(`);`);
  lines.push(``);
}

lines.push(`COMMIT;`);
lines.push(``);
lines.push(`-- ================================================================`);
lines.push(`-- 4. 생성 확인 쿼리`);
lines.push(`-- ================================================================`);
lines.push(`SELECT u.login_id, u.user_role, p.full_name, p.birth_date`);
lines.push(`FROM app_users u`);
lines.push(`JOIN patient_pii p ON p.patient_id = u.patient_id`);
lines.push(`ORDER BY u.user_role, u.login_id;`);

console.log(lines.join("\n"));
