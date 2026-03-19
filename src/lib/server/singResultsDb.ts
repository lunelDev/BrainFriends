import type { PatientProfile } from "@/lib/patientStorage";
import { getDbPool } from "@/lib/server/postgres";
import type { VersionSnapshot } from "@/lib/analysis/versioning";
import {
  deterministicUuid,
  buildPatientPseudonymId,
  upsertPatientIdentity,
} from "@/lib/server/patientIdentityDb";

export type PersistedSingResult = {
  song: string;
  userName: string;
  score: number;
  finalJitter: string;
  finalSi: string;
  facialResponseDelta?: string;
  rtLatency: string;
  finalConsonant?: string;
  finalVowel?: string;
  lyricAccuracy?: string;
  transcript?: string;
  metricSource?: "measured" | "demo";
  comment: string;
  rankings: Array<{
    name: string;
    score: number;
    region: string;
    me?: boolean;
  }>;
  completedAt: number;
  governance?: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot?: VersionSnapshot;
};

export type PersistedSingRankingRow = {
  rank: number;
  name: string;
  score: number;
  region: string;
  me?: boolean;
};

export type PersistedSingRanking = {
  top5: PersistedSingRankingRow[];
  myRank: PersistedSingRankingRow | null;
};

function parseLatencyMs(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseMetric(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.\-]/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return `${trimmed}*`;
  return `${trimmed[0]}*${trimmed[trimmed.length - 1]}`;
}

async function fetchSingRanking(params: {
  client: any;
  patientPseudonymId: string;
  songKey: string;
}) {
  const { client, patientPseudonymId, songKey } = params;
  const top5BaseCte = `
    WITH member_best AS (
      SELECT DISTINCT ON (pm.patient_pseudonym_id)
        pm.patient_pseudonym_id,
        pii.full_name,
        sr.score,
        cs.completed_at
      FROM sing_results sr
      JOIN clinical_sessions cs ON cs.session_id = sr.session_id
      JOIN patient_pseudonym_map pm ON pm.patient_pseudonym_id = sr.patient_pseudonym_id
      JOIN patient_pii pii ON pii.patient_id = pm.patient_id
      WHERE cs.training_type = 'sing-training'
        AND sr.song_key = $1
        AND pii.birth_date IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, pii.birth_date)) >= 65
      ORDER BY pm.patient_pseudonym_id, sr.score DESC, cs.completed_at ASC
    ),
    ranked AS (
      SELECT
        patient_pseudonym_id,
        full_name,
        score,
        completed_at,
        ROW_NUMBER() OVER (ORDER BY score DESC, completed_at ASC) AS rank
      FROM member_best
    )
  `;

  const myRankBaseCte = `
    WITH member_best AS (
      SELECT DISTINCT ON (pm.patient_pseudonym_id)
        pm.patient_pseudonym_id,
        pii.full_name,
        sr.score,
        cs.completed_at
      FROM sing_results sr
      JOIN clinical_sessions cs ON cs.session_id = sr.session_id
      JOIN patient_pseudonym_map pm ON pm.patient_pseudonym_id = sr.patient_pseudonym_id
      JOIN patient_pii pii ON pii.patient_id = pm.patient_id
      WHERE cs.training_type = 'sing-training'
        AND sr.song_key = $2
        AND pii.birth_date IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, pii.birth_date)) >= 65
      ORDER BY pm.patient_pseudonym_id, sr.score DESC, cs.completed_at ASC
    ),
    ranked AS (
      SELECT
        patient_pseudonym_id,
        full_name,
        score,
        completed_at,
        ROW_NUMBER() OVER (ORDER BY score DESC, completed_at ASC) AS rank
      FROM member_best
    )
  `;

  const [top5Result, myRankResult] = await Promise.all([
    client.query(
      `${top5BaseCte}
      SELECT patient_pseudonym_id, full_name, score, rank
      FROM ranked
      ORDER BY rank ASC
      LIMIT 5`,
      [songKey],
    ),
    client.query(
      `${myRankBaseCte}
      SELECT patient_pseudonym_id, full_name, score, rank
      FROM ranked
      WHERE patient_pseudonym_id = $1`,
      [patientPseudonymId, songKey],
    ),
  ]);

  return {
    top5: top5Result.rows.map((row: any) => ({
      rank: Number(row.rank),
      name: maskName(String(row.full_name)),
      score: Number(row.score),
      region: "전국",
      me: String(row.patient_pseudonym_id) === patientPseudonymId,
    })),
    myRank: myRankResult.rows[0]
      ? {
          rank: Number(myRankResult.rows[0].rank),
          name: maskName(String(myRankResult.rows[0].full_name)),
          score: Number(myRankResult.rows[0].score),
          region: "전국",
          me: true,
        }
      : null,
  } satisfies PersistedSingRanking;
}

export async function saveSingResultToDatabase(params: {
  patient: PatientProfile;
  result: PersistedSingResult;
}) {
  const { patient, result } = params;
  const pool = getDbPool();
  const client = await pool.connect();

  const patientPseudonymId = buildPatientPseudonymId(patient);
  const sessionId = deterministicUuid(
    `session:${patientPseudonymId}:sing:${result.completedAt}:${result.song}`,
  );
  const resultId = deterministicUuid(`sing-result:${sessionId}`);
  const completedAt = new Date(result.completedAt);
  const latencyMs = parseLatencyMs(result.rtLatency);
  const jitter = parseMetric(result.finalJitter);
  const facialSymmetry = parseMetric(result.finalSi);
  const consonantAccuracy = parseMetric(result.finalConsonant ?? "");
  const vowelAccuracy = parseMetric(result.finalVowel ?? "");
  const lyricAccuracy = parseMetric(result.lyricAccuracy ?? "");

  try {
    await client.query("BEGIN");

    const { patientId, patientCode } = await upsertPatientIdentity(client, patient);

    await client.query(
      `
        INSERT INTO clinical_sessions (
          session_id,
          patient_pseudonym_id,
          training_type,
          source_session_key,
          started_at,
          completed_at,
          algorithm_version,
          catalog_version,
          release_version,
          status,
          version_snapshot,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
        ON CONFLICT (session_id) DO UPDATE
        SET
          source_session_key = EXCLUDED.source_session_key,
          completed_at = EXCLUDED.completed_at,
          algorithm_version = EXCLUDED.algorithm_version,
          catalog_version = EXCLUDED.catalog_version,
          release_version = EXCLUDED.release_version,
          status = EXCLUDED.status,
          version_snapshot = EXCLUDED.version_snapshot
      `,
      [
        sessionId,
        patientPseudonymId,
        "sing-training",
        patient.sessionId,
        completedAt,
        completedAt,
        result.governance?.analysisVersion ?? "brain-sing-unknown",
        result.governance?.catalogVersion ?? null,
        result.versionSnapshot?.release_version ?? null,
        "completed",
        result.versionSnapshot ? JSON.stringify(result.versionSnapshot) : null,
      ],
    );

    await client.query(
      `
        INSERT INTO sing_results (
          result_id,
          session_id,
          patient_pseudonym_id,
          song_key,
          score,
          jitter,
          facial_symmetry,
          latency_ms,
          consonant_accuracy,
          vowel_accuracy,
          lyric_accuracy,
          recognized_lyrics,
          comment,
          version_snapshot,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW())
        ON CONFLICT (result_id) DO UPDATE
        SET
          song_key = EXCLUDED.song_key,
          score = EXCLUDED.score,
          jitter = EXCLUDED.jitter,
          facial_symmetry = EXCLUDED.facial_symmetry,
          latency_ms = EXCLUDED.latency_ms,
          consonant_accuracy = EXCLUDED.consonant_accuracy,
          vowel_accuracy = EXCLUDED.vowel_accuracy,
          lyric_accuracy = EXCLUDED.lyric_accuracy,
          recognized_lyrics = EXCLUDED.recognized_lyrics,
          comment = EXCLUDED.comment,
          version_snapshot = EXCLUDED.version_snapshot
      `,
      [
        resultId,
        sessionId,
        patientPseudonymId,
        result.song,
        result.score,
        jitter,
        facialSymmetry,
        latencyMs,
        consonantAccuracy,
        vowelAccuracy,
        lyricAccuracy,
        result.transcript ?? null,
        result.comment,
        result.versionSnapshot ? JSON.stringify(result.versionSnapshot) : null,
      ],
    );

    const ranking = await fetchSingRanking({
      client,
      patientPseudonymId,
      songKey: result.song,
    });

    await client.query("COMMIT");

    return {
      patientId,
      patientCode,
      patientPseudonymId,
      sessionId,
      resultId,
      ranking,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

