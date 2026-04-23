/**
 * BrainFriends: cus01 (수우) 회원 임시 훈련 이력 시드 스크립트
 *
 * 용도
 *   로컬 개발에서 치료사 화면(/therapist)에 "수우" 환자의
 *   자가진단·언어재활 카운트 및 최근 세션이 바로 노출되도록
 *   실 DB 포맷에 맞춘 임시 데이터를 넣어준다.
 *
 * 사용법
 *   # 드라이런(기본) — 무엇을 넣을지 출력만 함
 *   node scripts/seed-cus01-training-history.mjs
 *
 *   # 실제 INSERT/UPSERT
 *   node scripts/seed-cus01-training-history.mjs --yes
 *
 *   # 기존 시드 row 만 삭제(언제든 원상복구)
 *   node scripts/seed-cus01-training-history.mjs --clear --yes
 *
 * 안전장치 (4중)
 *   1) DATABASE_URL host 가 localhost/127.0.0.1 이 아니면 즉시 종료
 *   2) DB 이름이 dev 화이트리스트(brainfriends_dev 등)가 아니면 거부
 *      → 어쩔 수 없이 돌려야 하면 ALLOW_NON_DEV_DB=1 을 명시
 *   3) NODE_ENV=production 이면 거부
 *   4) UPSERT 기반 → 여러 번 돌려도 중복 안 쌓이고, source_history_id 에
 *      `seed-cus01-*` prefix 를 붙여 언제든 `--clear` 로 원상복구 가능
 *
 * 설계 메모
 *   - 치료사 대시보드의 self/rehab 카운트는
 *     language_training_results.training_mode (= 'self' / 'rehab') 로 집계됨
 *   - pseudonymId 는 앱의 buildPatientPseudonymId 와 동일한 방식으로 계산
 *     → 이후 cus01 이 실제 훈련을 돌려도 같은 pseudonym 으로 수렴
 */

import { Client } from "pg";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// ───────── env 로드 ─────────
function loadEnvLocal() {
  const envPath = join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 가 .env.local 에 없습니다.");
  process.exit(1);
}

// ───────── 다중 안전장치: 쓰레기 시드 데이터를 운영/공용 DB 에 절대 쓰지 않도록 ─────────
// 1) host 가 localhost 계열인가
const host = (dbUrl.match(/@([^:/]+)(:\d+)?\//) || [])[1] ?? "(unknown)";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(host);
// 2) DB 이름이 _dev 시드 전용 이름 목록에 들어있는가
const dbName = (dbUrl.match(/\/([^/?]+)(?:\?|$)/) || [])[1] ?? "(unknown)";
const ALLOWED_DB_NAMES = new Set(["brainfriends_dev", "brainfriends_local", "brainfriends_test"]);
const isDevDbName = ALLOWED_DB_NAMES.has(dbName);
// 3) NODE_ENV 가 production 이면 거부
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  console.error("[seed] NODE_ENV=production 환경에서는 실행 금지. 중단.");
  process.exit(1);
}
if (!isLocalHost) {
  console.error(
    `[seed] 로컬 DB 호스트가 아닙니다 (host=${host}). 쓰레기 시드 데이터는 공용 DB 에 들어가선 안 됨. 중단.`,
  );
  process.exit(1);
}
if (!isDevDbName) {
  // 정말로 강제하고 싶으면 ALLOW_NON_DEV_DB=1 환경변수를 명시적으로 줘야 통과
  if (process.env.ALLOW_NON_DEV_DB !== "1") {
    console.error(
      `[seed] DB 이름이 dev 전용 목록에 없습니다 (db=${dbName}, allowed=${[...ALLOWED_DB_NAMES].join(", ")}).`,
    );
    console.error(
      `[seed] 정말 이 DB 에 시드를 넣으려면 환경변수 ALLOW_NON_DEV_DB=1 을 줘서 다시 실행하세요. 중단.`,
    );
    process.exit(1);
  } else {
    console.warn(
      `[seed] 경고: ALLOW_NON_DEV_DB=1 이 설정되어 dev 이외 DB(${dbName}) 에 쓰기를 진행합니다.`,
    );
  }
}
console.log(`[seed] 대상 DB: host=${host}, db=${dbName}`);

const args = new Set(process.argv.slice(2));
const apply = args.has("--yes");
const clearOnly = args.has("--clear");

// ───────── deterministic UUID / pseudonym (앱 로직과 동일) ─────────
function sha256Hex(seed) {
  return createHash("sha256").update(seed).digest("hex");
}
function deterministicUuid(seed) {
  const hex = sha256Hex(seed).slice(0, 32);
  const chars = hex.split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const n = chars.join("");
  return `${n.slice(0, 8)}-${n.slice(8, 12)}-${n.slice(12, 16)}-${n.slice(16, 20)}-${n.slice(20, 32)}`;
}
function buildPatientPseudonymId({ name, birthDate, gender, phone, language }) {
  const seed = [name.trim(), birthDate ?? "", gender, phone ?? "", language ?? "ko"].join("|");
  return `psn_${sha256Hex(seed).slice(0, 24)}`;
}

// ───────── 시드 데이터 정의 ─────────
// 최근 4주에 걸쳐 자가진단 3회 + 언어재활 2회. AQ 점수를 조금씩 변동시킴.
const SEED_ENTRIES = [
  { kind: "self",  daysAgo: 1,  aq: 64.2, label: "최근 자가진단 #3" },
  { kind: "self",  daysAgo: 6,  aq: 58.7, label: "최근 자가진단 #2" },
  { kind: "self",  daysAgo: 14, aq: 55.1, label: "최근 자가진단 #1" },
  { kind: "rehab", daysAgo: 3,  aq: 62.4, rehabStep: 2, label: "언어재활 Step2" },
  { kind: "rehab", daysAgo: 9,  aq: 60.8, rehabStep: 4, label: "언어재활 Step4" },
];

function buildStepScores(aq) {
  // 단순: AQ 근방으로 각 step 에 약간의 분산
  const j = (d) => Math.max(0, Math.min(100, Math.round((aq + d) * 10) / 10));
  return {
    step1: j(+4),
    step2: j(+1),
    step3: j(-3),
    step4: j(+2),
    step5: j(-1),
    step6: j(+5),
  };
}

function buildMeasurementQualitySnapshot(kind, rehabStep) {
  // dev 우회 정책과 동일: 일부 step 이 partial 이어도 저장되도록 overall=partial 로 기록
  const mk = (q) => ({ quality: q, dataSource: q === "measured" ? "measured" : "demo" });
  const steps = {
    step1: mk("measured"),
    step2: mk("partial"),
    step3: mk("measured"),
    step4: mk("partial"),
    step5: mk("measured"),
    step6: mk("demo"),
  };
  return {
    overall: "partial",
    steps,
    generatedAt: new Date().toISOString(),
    note: `seed:${kind}${rehabStep ? `-step${rehabStep}` : ""}`,
  };
}

function buildStepDetails(aq) {
  const sample = (n, tag) =>
    Array.from({ length: n }, (_, i) => ({
      itemIndex: i,
      tag,
      isCorrect: (i + Math.floor(aq)) % 2 === 0,
      userAnswer: `seed-${tag}-${i}`,
      seed: true,
    }));
  return {
    step1: sample(3, "naming"),
    step2: sample(2, "articulation"),
    step3: sample(3, "reading"),
    step4: sample(2, "repetition"),
    step5: sample(2, "fluency"),
    step6: sample(2, "writing"),
    __meta: { seed: true, vnv: null },
  };
}

// ───────── main ─────────
async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1) cus01 → app_users / patient_pii 조회
    const userRes = await client.query(
      `
        SELECT
          au.user_id::text AS user_id,
          au.login_id,
          au.user_role,
          pii.patient_id::text AS patient_id,
          pii.patient_code,
          pii.full_name,
          pii.birth_date::text AS birth_date,
          pii.sex,
          pii.phone,
          pii.language
        FROM app_users au
        JOIN patient_pii pii ON pii.patient_id = au.patient_id
        WHERE au.login_id = $1
        LIMIT 1
      `,
      ["cus01"],
    );

    if (userRes.rowCount === 0) {
      console.error('[seed] login_id="cus01" 사용자를 찾지 못함. 먼저 해당 계정을 생성하세요.');
      process.exit(2);
    }

    const u = userRes.rows[0];
    console.log(
      `[seed] 대상 사용자: login_id=${u.login_id}, name=${u.full_name}, role=${u.user_role}, patient_id=${u.patient_id}`,
    );

    const sex =
      typeof u.sex === "string" && ["M", "F", "U"].includes(u.sex.toUpperCase())
        ? u.sex.toUpperCase()
        : "U";
    const patientIdentity = {
      name: String(u.full_name),
      birthDate: u.birth_date ? String(u.birth_date) : "",
      gender: sex,
      phone: u.phone ? String(u.phone) : "",
      language: u.language ? String(u.language) : "ko",
    };
    const pseudonymId = buildPatientPseudonymId(patientIdentity);
    console.log(`[seed] patient_pseudonym_id = ${pseudonymId}`);

    // 2) --clear: 시드 row 만 제거
    if (clearOnly) {
      const toDelete = await client.query(
        `SELECT COUNT(*)::int AS n FROM language_training_results WHERE source_history_id LIKE 'seed-cus01-%'`,
      );
      console.log(`[seed] --clear: 제거 대상 rows = ${toDelete.rows[0].n}`);

      if (!apply) {
        console.log("[seed] --yes 없음 → 드라이런 종료");
        return;
      }
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM language_training_results WHERE source_history_id LIKE 'seed-cus01-%'`,
      );
      await client.query(
        `
          DELETE FROM clinical_sessions
          WHERE source_session_key LIKE 'history-self-assessment-seed-cus01-%'
             OR source_session_key LIKE 'history-speech-rehab-seed-cus01-%'
        `,
      );
      await client.query("COMMIT");
      console.log("[seed] --clear 완료");
      return;
    }

    // 3) 드라이런 요약
    console.log(`[seed] 삽입 예정 rows = ${SEED_ENTRIES.length}`);
    for (const e of SEED_ENTRIES) {
      console.log(
        `   - ${e.label} | kind=${e.kind}${e.rehabStep ? ` step${e.rehabStep}` : ""} | AQ=${e.aq} | completedAt=${e.daysAgo}일 전`,
      );
    }
    if (!apply) {
      console.log("[seed] --yes 없음 → 드라이런 종료 (실제 쓰지 않음)");
      return;
    }

    await client.query("BEGIN");

    // 4) patient_pseudonym_map upsert (최초 시드 시에만 생성)
    await client.query(
      `
        INSERT INTO patient_pseudonym_map (patient_pseudonym_id, patient_id, mapping_version, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (patient_pseudonym_id) DO UPDATE
          SET patient_id = EXCLUDED.patient_id,
              mapping_version = EXCLUDED.mapping_version
      `,
      [pseudonymId, u.patient_id, "pseudonym-map-v1"],
    );

    // 5) 각 seed entry → clinical_sessions + language_training_results upsert
    for (const entry of SEED_ENTRIES) {
      const trainingType = entry.kind === "rehab" ? "speech-rehab" : "self-assessment";
      const historyId = `seed-cus01-${entry.kind}-${entry.daysAgo}d`;
      const sessionKey = `history-${trainingType}-${historyId}`;
      const sessionUuid = deterministicUuid(
        `clinical-session:${historyId}:${historyId}:${trainingType}`,
      );
      const resultId = deterministicUuid(`training-result:${historyId}:${trainingType}`);
      const completedAt = new Date(Date.now() - entry.daysAgo * 24 * 60 * 60 * 1000);

      const stepScores = buildStepScores(entry.aq);
      const measurementQuality = buildMeasurementQualitySnapshot(entry.kind, entry.rehabStep);
      const stepDetails = buildStepDetails(entry.aq);
      const versionSnapshot = {
        algorithm_version: `${trainingType}-seed-v1`,
        config_version: "seed-v1",
        release_version: "seed-v1",
        pipeline_stage: entry.kind === "rehab" ? "rehab" : "self-assessment",
        generated_at: completedAt.toISOString(),
        preprocessing_version: "seed-v1",
      };

      await client.query(
        `
          INSERT INTO clinical_sessions (
            session_id, patient_pseudonym_id, training_type, source_session_key,
            started_at, completed_at, algorithm_version, catalog_version, release_version,
            status, version_snapshot, created_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, NOW())
          ON CONFLICT (session_id) DO UPDATE
            SET training_type = EXCLUDED.training_type,
                source_session_key = EXCLUDED.source_session_key,
                completed_at = EXCLUDED.completed_at,
                algorithm_version = EXCLUDED.algorithm_version,
                catalog_version = EXCLUDED.catalog_version,
                release_version = EXCLUDED.release_version,
                status = EXCLUDED.status,
                version_snapshot = EXCLUDED.version_snapshot
        `,
        [
          sessionUuid,
          pseudonymId,
          trainingType,
          sessionKey,
          completedAt,
          completedAt,
          versionSnapshot.algorithm_version,
          versionSnapshot.config_version,
          versionSnapshot.release_version,
          "completed",
          JSON.stringify(versionSnapshot),
        ],
      );

      await client.query(
        `
          INSERT INTO language_training_results (
            result_id, session_id, patient_pseudonym_id, training_mode, rehab_step, aq,
            step_scores, step_details, articulation_scores, facial_analysis_snapshot,
            measurement_quality, step_version_snapshots, source_history_id, created_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
          ON CONFLICT (result_id) DO UPDATE
            SET training_mode = EXCLUDED.training_mode,
                rehab_step = EXCLUDED.rehab_step,
                aq = EXCLUDED.aq,
                step_scores = EXCLUDED.step_scores,
                step_details = EXCLUDED.step_details,
                articulation_scores = EXCLUDED.articulation_scores,
                facial_analysis_snapshot = EXCLUDED.facial_analysis_snapshot,
                measurement_quality = EXCLUDED.measurement_quality,
                step_version_snapshots = EXCLUDED.step_version_snapshots,
                source_history_id = EXCLUDED.source_history_id,
                created_at = EXCLUDED.created_at
        `,
        [
          resultId,
          sessionUuid,
          pseudonymId,
          entry.kind === "rehab" ? "rehab" : "self",
          entry.rehabStep ?? null,
          entry.aq,
          JSON.stringify(stepScores),
          JSON.stringify(stepDetails),
          JSON.stringify({
            step2: { averageConsonantAccuracy: 78, averageVowelAccuracy: 84 },
            step3: { averageConsonantAccuracy: 76, averageVowelAccuracy: 82 },
            step5: { averageConsonantAccuracy: 80, averageVowelAccuracy: 86 },
          }),
          JSON.stringify({
            asymmetryRisk: 0.22,
            articulationGap: 0.18,
            overallConsonant: 78,
            overallVowel: 84,
            articulationFaceMatchSummary: "seed: 경미한 비대칭 관찰",
            timelineCurrentAsymmetry: 0.19,
          }),
          JSON.stringify(measurementQuality),
          JSON.stringify({ [entry.kind === "rehab" ? `step${entry.rehabStep ?? 2}` : "step1"]: versionSnapshot }),
          historyId,
          completedAt,
        ],
      );

      console.log(`   [OK] ${entry.label} (${historyId})`);
    }

    await client.query("COMMIT");

    // 6) 검증 카운트
    const countRes = await client.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM language_training_results
           WHERE patient_pseudonym_id=$1 AND training_mode='self') AS self_cnt,
          (SELECT COUNT(*)::int FROM language_training_results
           WHERE patient_pseudonym_id=$1 AND training_mode='rehab') AS rehab_cnt
      `,
      [pseudonymId],
    );
    const { self_cnt, rehab_cnt } = countRes.rows[0];
    console.log(`[seed] 완료. self=${self_cnt}, rehab=${rehab_cnt}`);
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[seed] 실패:", e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
