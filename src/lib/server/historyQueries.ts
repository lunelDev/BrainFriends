import { getDbPool } from "@/lib/server/postgres";
import { buildPatientProfile, getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import type {
  SingHistoryResult,
  TrainingMode,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";

export type AuthenticatedHistoryContext = {
  userId: string;
  patientId: string;
  patientPseudonymId: string;
};

export type TrainingHistorySummary = {
  kind: "language-training" | "sing-training";
  trainingType: string;
  trainingMode: string | null;
  rehabStep: number | null;
  sessionId: string;
  resultId: string;
  sourceHistoryId: string | null;
  aq: number | null;
  score: number | null;
  songKey: string | null;
  completedAt: string;
  createdAt: string;
  stepScores: Record<string, number> | null;
  versionSnapshot: Record<string, unknown> | null;
};

function isRenderableImageRef(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/api/media/access?") ||
    /^https?:\/\//i.test(trimmed)
  );
}

function isPlayableAudioRef(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("data:audio/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/api/media/access?") ||
    /^https?:\/\//i.test(trimmed)
  );
}

export async function getAuthenticatedHistoryContext(sessionToken: string) {
  return getAuthenticatedSessionContext(sessionToken);
}

export async function listHistoryForAuthenticatedUser(
  sessionToken: string,
): Promise<{
  patient: ReturnType<typeof buildPatientProfile>;
  history: TrainingHistorySummary[];
  entries: TrainingHistoryEntry[];
}> {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const [languageRows, singRows] = await Promise.all([
    pool.query(
      `
        SELECT
          'language-training' AS kind,
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          cs.source_session_key,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          NULL::numeric AS score,
          NULL::text AS song_key,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots,
          NULL::numeric AS jitter,
          NULL::numeric AS facial_symmetry,
          NULL::numeric AS latency_ms,
          NULL::text AS comment,
          cs.version_snapshot
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
      `,
      [context.patientPseudonymId],
    ),
    pool.query(
      `
        SELECT
          'sing-training' AS kind,
          cs.training_type,
          NULL::text AS training_mode,
          NULL::integer AS rehab_step,
          cs.session_id::text AS session_id,
          cs.source_session_key,
          sr.result_id::text AS result_id,
          NULL::text AS source_history_id,
          NULL::numeric AS aq,
          sr.score,
          sr.song_key,
          cs.completed_at,
          sr.created_at,
          NULL::jsonb AS step_scores,
          NULL::jsonb AS step_details,
          NULL::jsonb AS articulation_scores,
          NULL::jsonb AS facial_analysis_snapshot,
          NULL::jsonb AS step_version_snapshots,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
      `,
      [context.patientPseudonymId],
    ),
  ]);

  const history = [...languageRows.rows, ...singRows.rows]
    .map((row: any) => ({
      kind: row.kind as "language-training" | "sing-training",
      trainingType: String(row.training_type),
      trainingMode: row.training_mode ? String(row.training_mode) : null,
      rehabStep:
        row.rehab_step == null ? null : Number(row.rehab_step),
      sessionId: String(row.session_id),
      resultId: String(row.result_id),
      sourceHistoryId: row.source_history_id ? String(row.source_history_id) : null,
      aq: row.aq == null ? null : Number(row.aq),
      score: row.score == null ? null : Number(row.score),
      songKey: row.song_key ? String(row.song_key) : null,
      completedAt: new Date(row.completed_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      stepScores: row.step_scores ? (row.step_scores as Record<string, number>) : null,
      versionSnapshot: row.version_snapshot
        ? (row.version_snapshot as Record<string, unknown>)
        : null,
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const patient = context.patient;
  const languageSourceSessionKeys = Array.from(
    new Set(
      languageRows.rows
        .map((row: any) => String(row.source_session_key ?? "").trim())
        .filter((value: string) => value.length > 0),
    ),
  );
  const singSourceSessionKeys = Array.from(
    new Set(
      singRows.rows
        .map((row: any) => String(row.source_session_key ?? "").trim())
        .filter((value: string) => value.length > 0),
    ),
  );

  const step6ImageRows =
    languageSourceSessionKeys.length > 0
      ? await pool.query(
          `
            SELECT
              source_session_key,
              object_key,
              uploaded_at
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type IN ('self-assessment', 'speech-rehab')
              AND step_no = 6
              AND media_type = 'image'
              AND capture_role = 'step6-image'
              AND source_session_key = ANY($2::text[])
            ORDER BY source_session_key ASC, uploaded_at ASC
          `,
          [context.patientPseudonymId, languageSourceSessionKeys],
        )
      : { rows: [] as any[] };
  const languageAudioRows =
    languageSourceSessionKeys.length > 0
      ? await pool.query(
          `
            SELECT
              source_session_key,
              step_no,
              object_key,
              uploaded_at
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type IN ('self-assessment', 'speech-rehab')
              AND step_no IN (2, 4, 5)
              AND media_type = 'audio'
              AND capture_role IN ('step2-audio', 'step4-audio', 'step5-audio')
              AND source_session_key = ANY($2::text[])
            ORDER BY source_session_key ASC, step_no ASC, uploaded_at ASC
          `,
          [context.patientPseudonymId, languageSourceSessionKeys],
        )
      : { rows: [] as any[] };
  const singAudioRows =
    singSourceSessionKeys.length > 0
      ? await pool.query(
          `
            SELECT
              source_session_key,
              object_key,
              uploaded_at
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type = 'sing-training'
              AND media_type = 'audio'
              AND capture_role = 'review-audio'
              AND source_session_key = ANY($2::text[])
            ORDER BY source_session_key ASC, uploaded_at DESC
          `,
          [context.patientPseudonymId, singSourceSessionKeys],
        )
      : { rows: [] as any[] };

  const step6ImageMap = new Map<string, string[]>();
  for (const row of step6ImageRows.rows) {
    const sourceSessionKey = String(row.source_session_key ?? "").trim();
    const objectKey = String(row.object_key ?? "").trim();
    if (!sourceSessionKey || !objectKey) continue;
    const next = step6ImageMap.get(sourceSessionKey) ?? [];
    next.push(`/api/media/access?objectKey=${encodeURIComponent(objectKey)}`);
    step6ImageMap.set(sourceSessionKey, next);
  }
  const languageAudioMap = new Map<string, Record<number, string[]>>();
  for (const row of languageAudioRows.rows) {
    const sourceSessionKey = String(row.source_session_key ?? "").trim();
    const stepNo = Number(row.step_no ?? 0);
    const objectKey = String(row.object_key ?? "").trim();
    if (!sourceSessionKey || !stepNo || !objectKey) continue;
    const byStep = languageAudioMap.get(sourceSessionKey) ?? {};
    const next = byStep[stepNo] ?? [];
    next.push(`/api/media/access?objectKey=${encodeURIComponent(objectKey)}`);
    byStep[stepNo] = next;
    languageAudioMap.set(sourceSessionKey, byStep);
  }
  const singAudioMap = new Map<string, string>();
  for (const row of singAudioRows.rows) {
    const sourceSessionKey = String(row.source_session_key ?? "").trim();
    const objectKey = String(row.object_key ?? "").trim();
    if (!sourceSessionKey || !objectKey || singAudioMap.has(sourceSessionKey)) continue;
    singAudioMap.set(
      sourceSessionKey,
      `/api/media/access?objectKey=${encodeURIComponent(objectKey)}`,
    );
  }

  const entries: TrainingHistoryEntry[] = [
    ...languageRows.rows.map((row: any) => {
      const sourceSessionKey = String(row.source_session_key ?? "").trim();
      const imageUrls = step6ImageMap.get(sourceSessionKey) ?? [];
      const audioUrlsByStep = languageAudioMap.get(sourceSessionKey) ?? {};
      const baseStepDetails =
        (row.step_details as TrainingHistoryEntry["stepDetails"]) ?? {
          step1: [],
          step2: [],
          step3: [],
          step4: [],
          step5: [],
          step6: [],
        };

      const stepDetails: TrainingHistoryEntry["stepDetails"] = {
        ...baseStepDetails,
        step2: Array.isArray(baseStepDetails.step2)
          ? baseStepDetails.step2.map((item: any, index: number) => ({
              ...item,
              audioUrl:
                isPlayableAudioRef(item?.audioUrl)
                  ? item.audioUrl
                  : audioUrlsByStep[2]?.[index] ?? undefined,
            }))
          : [],
        step4: Array.isArray(baseStepDetails.step4)
          ? baseStepDetails.step4.map((item: any, index: number) => ({
              ...item,
              audioUrl:
                isPlayableAudioRef(item?.audioUrl)
                  ? item.audioUrl
                  : audioUrlsByStep[4]?.[index] ?? undefined,
            }))
          : [],
        step5: Array.isArray(baseStepDetails.step5)
          ? baseStepDetails.step5.map((item: any, index: number) => ({
              ...item,
              audioUrl:
                isPlayableAudioRef(item?.audioUrl)
                  ? item.audioUrl
                  : audioUrlsByStep[5]?.[index] ?? undefined,
            }))
          : [],
        step6: Array.isArray(baseStepDetails.step6)
          ? baseStepDetails.step6.map((item: any, index: number) => ({
              ...item,
              userImage:
                isRenderableImageRef(item?.userImage)
                  ? item.userImage
                  : imageUrls[index] ?? undefined,
            }))
          : [],
      };

      return {
        historyId: row.source_history_id
          ? String(row.source_history_id)
          : String(row.result_id),
        sessionId: String(row.session_id),
        patientKey: context.patientPseudonymId,
        patientName: patient.name,
        birthDate: patient.birthDate,
        age: Number(patient.age ?? 0),
        educationYears: Number(patient.educationYears ?? 0),
        place: "home",
        trainingMode: (
          row.training_mode === "rehab"
            ? "rehab"
            : "self"
        ) as TrainingMode,
        rehabStep:
          row.rehab_step == null ? undefined : Number(row.rehab_step),
        completedAt: new Date(row.completed_at).getTime(),
        aq: Number(row.aq ?? 0),
        stepScores: (row.step_scores as TrainingHistoryEntry["stepScores"]) ?? {
          step1: 0,
          step2: 0,
          step3: 0,
          step4: 0,
          step5: 0,
          step6: 0,
        },
        stepDetails,
        articulationScores:
          (row.articulation_scores as TrainingHistoryEntry["articulationScores"]) ??
          undefined,
        facialAnalysisSnapshot:
          (row.facial_analysis_snapshot as TrainingHistoryEntry["facialAnalysisSnapshot"]) ??
          undefined,
        measurementQuality:
          (row.measurement_quality as TrainingHistoryEntry["measurementQuality"]) ??
          undefined,
        stepVersionSnapshots:
          (row.step_version_snapshots as TrainingHistoryEntry["stepVersionSnapshots"]) ??
          undefined,
      };
    }),
    ...singRows.rows.map((row: any) => {
      const sourceSessionKey = String(row.source_session_key ?? "").trim();
      return {
      historyId: `history_sing_${new Date(row.completed_at).getTime()}`,
      sessionId: String(row.session_id),
      patientKey: context.patientPseudonymId,
      patientName: patient.name,
      birthDate: patient.birthDate,
      age: Number(patient.age ?? 0),
      educationYears: Number(patient.educationYears ?? 0),
      place: "brain-sing",
      trainingMode: "sing" as TrainingMode,
      completedAt: new Date(row.completed_at).getTime(),
      aq: Number(row.score ?? 0),
      singResult: {
        song: String(row.song_key),
        score: Number(row.score ?? 0),
        finalJitter: row.jitter == null ? "-" : String(row.jitter),
        finalSi: row.facial_symmetry == null ? "-" : String(row.facial_symmetry),
        facialResponseDelta:
          row.version_snapshot?.measurement_metadata?.facial_response_delta == null
            ? "-"
            : String(row.version_snapshot.measurement_metadata.facial_response_delta),
        rtLatency: row.latency_ms == null ? "-" : String(row.latency_ms),
        finalConsonant:
          row.consonant_accuracy == null ? "-" : String(row.consonant_accuracy),
        finalVowel:
          row.vowel_accuracy == null ? "-" : String(row.vowel_accuracy),
        lyricAccuracy:
          row.lyric_accuracy == null ? "-" : String(row.lyric_accuracy),
        transcript:
          row.recognized_lyrics == null ? "" : String(row.recognized_lyrics),
        reviewAudioUrl: singAudioMap.get(sourceSessionKey),
        comment: row.comment ? String(row.comment) : "",
        rankings: [],
        versionSnapshot: row.version_snapshot ?? undefined,
      } satisfies SingHistoryResult,
      stepScores: {
        step1: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        step5: 0,
        step6: 0,
      },
      stepDetails: {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [],
        step6: [],
      },
      };
    }),
  ].sort((a, b) => b.completedAt - a.completedAt);

  return {
    patient,
    history,
    entries,
  };
}

export async function getOnboardingStatusForAuthenticatedUser(sessionToken: string) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const selfAssessmentCount = await pool.query(
    `
      SELECT COUNT(*)::int AS row_count
      FROM language_training_results ltr
      JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
      WHERE ltr.patient_pseudonym_id = $1
        AND cs.training_type = 'self-assessment'
    `,
    [context.patientPseudonymId],
  );

  return {
    patient: context.patient,
    hasSelfAssessmentHistory: Number(selfAssessmentCount.rows[0]?.row_count ?? 0) > 0,
  };
}

export async function deleteHistoryEntriesForAuthenticatedUser(
  sessionToken: string,
  sessionIds: string[],
) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const normalizedSessionIds = Array.from(
    new Set(
      sessionIds
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (!normalizedSessionIds.length) {
    return { deletedCount: 0 };
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eligibleSessions = await client.query(
      `
        SELECT session_id::text AS session_id
        FROM clinical_sessions
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, normalizedSessionIds],
    );

    const ownedSessionIds = eligibleSessions.rows.map((row: any) =>
      String(row.session_id),
    );

    if (!ownedSessionIds.length) {
      await client.query("COMMIT");
      return { deletedCount: 0 };
    }

    await client.query(
      `
        DELETE FROM clinical_media_objects
        WHERE patient_pseudonym_id = $1
          AND clinical_session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query(
      `
        DELETE FROM language_training_results
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query(
      `
        DELETE FROM sing_results
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query(
      `
        DELETE FROM clinical_sessions
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query("COMMIT");
    return { deletedCount: ownedSessionIds.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ────────────────────────────────────────────────────────────────────
// 요약 / 상세 / 통계 분리 리팩터용 신규 API.
// 기존 listHistoryForAuthenticatedUser 는 /api/history/me 에서 계속
// 사용 중이므로 건드리지 않고, 아래 3개 함수는 신규 페이지네이션 기반
// 엔드포인트에서만 사용한다.
// ────────────────────────────────────────────────────────────────────

export type HistoryListMode = "self" | "rehab" | "sing" | "all";

export type HistoryListItem = {
  historyId: string;
  sessionId: string;
  trainingMode: "self" | "rehab" | "sing";
  rehabStep: number | null;
  aq: number | null; // sing 이면 score 가 여기 들어감
  songKey: string | null;
  completedAt: string; // ISO
  measurementQuality: "measured" | "partial" | "demo" | null;
  sourceSessionKey: string | null;
};

export type HistorySummaryResult = {
  items: HistoryListItem[];
  nextCursor: string | null;
};

export type HistoryStatsResult = {
  totalSelf: number;
  totalRehab: number;
  totalSing: number;
  latestAq: number | null;
  latestCompletedAt: string | null;
};

const DEFAULT_SUMMARY_LIMIT = 20;
const MAX_SUMMARY_LIMIT = 50;

function clampSummaryLimit(raw: number | undefined) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SUMMARY_LIMIT;
  return Math.min(Math.floor(n), MAX_SUMMARY_LIMIT);
}

function normalizeHistoryListMode(value: unknown): HistoryListMode {
  if (value === "rehab" || value === "sing" || value === "all" || value === "self") {
    return value;
  }
  return "all";
}

function normalizeQualityOverall(value: unknown): HistoryListItem["measurementQuality"] {
  if (value === "measured" || value === "partial" || value === "demo") return value;
  if (value && typeof value === "object") {
    const overall = (value as { overall?: unknown }).overall;
    if (overall === "measured" || overall === "partial" || overall === "demo") return overall;
  }
  return null;
}

export async function listSummaryForAuthenticatedUser(
  sessionToken: string,
  options: { mode?: HistoryListMode; limit?: number; cursor?: string } = {},
): Promise<HistorySummaryResult> {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const mode = normalizeHistoryListMode(options.mode ?? "all");
  const limit = clampSummaryLimit(options.limit);
  const fetchLimit = limit + 1;

  // cursor 는 ISO datetime. 파싱 실패 시 무시 (첫 페이지 취급).
  let cursorIso: string | null = null;
  if (options.cursor) {
    const parsed = new Date(options.cursor);
    if (!Number.isNaN(parsed.getTime())) {
      cursorIso = parsed.toISOString();
    }
  }

  // 언어(ltr) / 노래(sing) 용 subquery 를 UNION ALL 로 합친 뒤 일괄 정렬.
  // 실제로 가벼운 컬럼만 select 한다 — step_details / step_version_snapshots /
  // facial_analysis_snapshot 같은 대용량 JSONB 는 절대 안 뽑음.
  const params: unknown[] = [context.patientPseudonymId];
  let cursorParamIndex: number | null = null;
  if (cursorIso) {
    params.push(cursorIso);
    cursorParamIndex = params.length;
  }
  params.push(fetchLimit);
  const limitParamIndex = params.length;

  const languageSelect = `
    SELECT
      COALESCE(ltr.source_history_id, ltr.result_id::text) AS history_id,
      cs.session_id::text AS session_id,
      COALESCE(ltr.training_mode, 'self') AS training_mode,
      ltr.rehab_step,
      ltr.aq,
      NULL::text AS song_key,
      cs.completed_at,
      ltr.measurement_quality,
      cs.source_session_key
    FROM language_training_results ltr
    JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
    WHERE ltr.patient_pseudonym_id = $1
  `;
  const singSelect = `
    SELECT
      'history_sing_' || (EXTRACT(EPOCH FROM cs.completed_at) * 1000)::bigint::text AS history_id,
      cs.session_id::text AS session_id,
      'sing'::text AS training_mode,
      NULL::integer AS rehab_step,
      sr.score AS aq,
      sr.song_key,
      cs.completed_at,
      NULL::jsonb AS measurement_quality,
      cs.source_session_key
    FROM sing_results sr
    JOIN clinical_sessions cs ON cs.session_id = sr.session_id
    WHERE sr.patient_pseudonym_id = $1
  `;

  let inner = "";
  if (mode === "self") {
    inner = `${languageSelect} AND COALESCE(ltr.training_mode, 'self') = 'self'`;
  } else if (mode === "rehab") {
    inner = `${languageSelect} AND ltr.training_mode = 'rehab'`;
  } else if (mode === "sing") {
    inner = singSelect;
  } else {
    // "all" — self + rehab + sing 전체
    inner = `${languageSelect}\n    UNION ALL\n${singSelect}`;
  }

  const cursorClause = cursorParamIndex
    ? `WHERE completed_at < $${cursorParamIndex}`
    : "";

  const sql = `
    SELECT *
    FROM (
      ${inner}
    ) AS combined
    ${cursorClause}
    ORDER BY completed_at DESC
    LIMIT $${limitParamIndex}
  `;

  const result = await pool.query(sql, params);
  const rowsRaw = result.rows as Array<{
    history_id: string;
    session_id: string;
    training_mode: string;
    rehab_step: number | null;
    aq: number | string | null;
    song_key: string | null;
    completed_at: Date | string;
    measurement_quality: unknown;
    source_session_key: string | null;
  }>;

  const mapped: HistoryListItem[] = rowsRaw.map((row) => {
    const trainingMode =
      row.training_mode === "rehab"
        ? "rehab"
        : row.training_mode === "sing"
          ? "sing"
          : "self";
    return {
      historyId: String(row.history_id),
      sessionId: String(row.session_id),
      trainingMode,
      rehabStep: row.rehab_step == null ? null : Number(row.rehab_step),
      aq: row.aq == null ? null : Number(row.aq),
      songKey: row.song_key ? String(row.song_key) : null,
      completedAt: new Date(row.completed_at).toISOString(),
      measurementQuality: normalizeQualityOverall(row.measurement_quality),
      sourceSessionKey: row.source_session_key ? String(row.source_session_key) : null,
    };
  });

  let items = mapped;
  let nextCursor: string | null = null;
  if (mapped.length > limit) {
    items = mapped.slice(0, limit);
    const lastShown = items[items.length - 1];
    nextCursor = lastShown ? lastShown.completedAt : null;
  }

  return { items, nextCursor };
}

export async function getDetailByHistoryIdForAuthenticatedUser(
  sessionToken: string,
  historyId: string,
): Promise<TrainingHistoryEntry | null> {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const trimmedId = String(historyId || "").trim();
  if (!trimmedId) return null;

  const pool = getDbPool();
  const patient = context.patient;

  if (trimmedId.startsWith("history_sing_")) {
    // history_sing_<epochMs> 형식. 완료시각 타임스탬프로 역조회.
    const epochRaw = trimmedId.slice("history_sing_".length);
    const epochMs = Number(epochRaw);
    if (!Number.isFinite(epochMs)) return null;

    const res = await pool.query(
      `
        SELECT
          cs.session_id::text AS session_id,
          cs.source_session_key,
          sr.song_key,
          sr.score,
          cs.completed_at,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
          AND (EXTRACT(EPOCH FROM cs.completed_at) * 1000)::bigint = $2::bigint
        ORDER BY sr.created_at DESC
        LIMIT 1
      `,
      [context.patientPseudonymId, Math.trunc(epochMs)],
    );
    const row = res.rows[0];
    if (!row) return null;

    const sourceSessionKey = String(row.source_session_key ?? "").trim();
    let reviewAudioUrl: string | undefined;
    if (sourceSessionKey) {
      const audioRes = await pool.query(
        `
          SELECT object_key
          FROM clinical_media_objects
          WHERE patient_pseudonym_id = $1
            AND training_type = 'sing-training'
            AND media_type = 'audio'
            AND capture_role = 'review-audio'
            AND source_session_key = $2
          ORDER BY uploaded_at DESC
          LIMIT 1
        `,
        [context.patientPseudonymId, sourceSessionKey],
      );
      const objectKey = audioRes.rows[0]?.object_key
        ? String(audioRes.rows[0].object_key).trim()
        : "";
      if (objectKey) {
        reviewAudioUrl = `/api/media/access?objectKey=${encodeURIComponent(objectKey)}`;
      }
    }

    const entry: TrainingHistoryEntry = {
      historyId: trimmedId,
      sessionId: String(row.session_id),
      patientKey: context.patientPseudonymId,
      patientName: patient.name,
      birthDate: patient.birthDate,
      age: Number(patient.age ?? 0),
      educationYears: Number(patient.educationYears ?? 0),
      place: "brain-sing",
      trainingMode: "sing" as TrainingMode,
      completedAt: new Date(row.completed_at).getTime(),
      aq: Number(row.score ?? 0),
      singResult: {
        song: String(row.song_key),
        score: Number(row.score ?? 0),
        finalJitter: row.jitter == null ? "-" : String(row.jitter),
        finalSi: row.facial_symmetry == null ? "-" : String(row.facial_symmetry),
        facialResponseDelta:
          row.version_snapshot?.measurement_metadata?.facial_response_delta == null
            ? "-"
            : String(row.version_snapshot.measurement_metadata.facial_response_delta),
        rtLatency: row.latency_ms == null ? "-" : String(row.latency_ms),
        finalConsonant:
          row.consonant_accuracy == null ? "-" : String(row.consonant_accuracy),
        finalVowel: row.vowel_accuracy == null ? "-" : String(row.vowel_accuracy),
        lyricAccuracy:
          row.lyric_accuracy == null ? "-" : String(row.lyric_accuracy),
        transcript:
          row.recognized_lyrics == null ? "" : String(row.recognized_lyrics),
        reviewAudioUrl,
        comment: row.comment ? String(row.comment) : "",
        rankings: [],
        versionSnapshot: row.version_snapshot ?? undefined,
      } satisfies SingHistoryResult,
      stepScores: {
        step1: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        step5: 0,
        step6: 0,
      },
      stepDetails: {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [],
        step6: [],
      },
    };
    return entry;
  }

  // 언어(ltr) 상세 — source_history_id 우선, 실패 시 result_id fallback.
  const res = await pool.query(
    `
      SELECT
        cs.training_type,
        ltr.training_mode,
        ltr.rehab_step,
        cs.session_id::text AS session_id,
        cs.source_session_key,
        ltr.result_id::text AS result_id,
        ltr.source_history_id,
        ltr.aq,
        cs.completed_at,
        ltr.step_scores,
        ltr.step_details,
        ltr.articulation_scores,
        ltr.facial_analysis_snapshot,
        ltr.measurement_quality,
        ltr.step_version_snapshots
      FROM language_training_results ltr
      JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
      WHERE ltr.patient_pseudonym_id = $1
        AND (
          ltr.source_history_id = $2
          OR ltr.result_id::text = $2
        )
      ORDER BY cs.completed_at DESC
      LIMIT 1
    `,
    [context.patientPseudonymId, trimmedId],
  );
  const row = res.rows[0];
  if (!row) return null;

  const sourceSessionKey = String(row.source_session_key ?? "").trim();

  // step6 이미지 + step2/4/5 오디오를 해당 session 기준으로만 뽑는다.
  const [step6ImagesRes, languageAudioRes] = await Promise.all([
    sourceSessionKey
      ? pool.query(
          `
            SELECT object_key
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type IN ('self-assessment', 'speech-rehab')
              AND step_no = 6
              AND media_type = 'image'
              AND capture_role = 'step6-image'
              AND source_session_key = $2
            ORDER BY uploaded_at ASC
          `,
          [context.patientPseudonymId, sourceSessionKey],
        )
      : Promise.resolve({ rows: [] as Array<{ object_key: string }> }),
    sourceSessionKey
      ? pool.query(
          `
            SELECT step_no, object_key
            FROM clinical_media_objects
            WHERE patient_pseudonym_id = $1
              AND training_type IN ('self-assessment', 'speech-rehab')
              AND step_no IN (2, 4, 5)
              AND media_type = 'audio'
              AND capture_role IN ('step2-audio', 'step4-audio', 'step5-audio')
              AND source_session_key = $2
            ORDER BY step_no ASC, uploaded_at ASC
          `,
          [context.patientPseudonymId, sourceSessionKey],
        )
      : Promise.resolve({
          rows: [] as Array<{ step_no: number; object_key: string }>,
        }),
  ]);

  const imageUrls: string[] = [];
  for (const r of step6ImagesRes.rows) {
    const objectKey = String(r.object_key ?? "").trim();
    if (!objectKey) continue;
    imageUrls.push(`/api/media/access?objectKey=${encodeURIComponent(objectKey)}`);
  }
  const audioUrlsByStep: Record<number, string[]> = {};
  for (const r of languageAudioRes.rows) {
    const stepNo = Number(r.step_no ?? 0);
    const objectKey = String(r.object_key ?? "").trim();
    if (!stepNo || !objectKey) continue;
    const next = audioUrlsByStep[stepNo] ?? [];
    next.push(`/api/media/access?objectKey=${encodeURIComponent(objectKey)}`);
    audioUrlsByStep[stepNo] = next;
  }

  const baseStepDetails =
    (row.step_details as TrainingHistoryEntry["stepDetails"]) ?? {
      step1: [],
      step2: [],
      step3: [],
      step4: [],
      step5: [],
      step6: [],
    };

  const stepDetails: TrainingHistoryEntry["stepDetails"] = {
    ...baseStepDetails,
    step2: Array.isArray(baseStepDetails.step2)
      ? baseStepDetails.step2.map((item: any, index: number) => ({
          ...item,
          audioUrl: isPlayableAudioRef(item?.audioUrl)
            ? item.audioUrl
            : audioUrlsByStep[2]?.[index] ?? undefined,
        }))
      : [],
    step4: Array.isArray(baseStepDetails.step4)
      ? baseStepDetails.step4.map((item: any, index: number) => ({
          ...item,
          audioUrl: isPlayableAudioRef(item?.audioUrl)
            ? item.audioUrl
            : audioUrlsByStep[4]?.[index] ?? undefined,
        }))
      : [],
    step5: Array.isArray(baseStepDetails.step5)
      ? baseStepDetails.step5.map((item: any, index: number) => ({
          ...item,
          audioUrl: isPlayableAudioRef(item?.audioUrl)
            ? item.audioUrl
            : audioUrlsByStep[5]?.[index] ?? undefined,
        }))
      : [],
    step6: Array.isArray(baseStepDetails.step6)
      ? baseStepDetails.step6.map((item: any, index: number) => ({
          ...item,
          userImage: isRenderableImageRef(item?.userImage)
            ? item.userImage
            : imageUrls[index] ?? undefined,
        }))
      : [],
  };

  const entry: TrainingHistoryEntry = {
    historyId: row.source_history_id
      ? String(row.source_history_id)
      : String(row.result_id),
    sessionId: String(row.session_id),
    patientKey: context.patientPseudonymId,
    patientName: patient.name,
    birthDate: patient.birthDate,
    age: Number(patient.age ?? 0),
    educationYears: Number(patient.educationYears ?? 0),
    place: "home",
    trainingMode: (row.training_mode === "rehab" ? "rehab" : "self") as TrainingMode,
    rehabStep: row.rehab_step == null ? undefined : Number(row.rehab_step),
    completedAt: new Date(row.completed_at).getTime(),
    aq: Number(row.aq ?? 0),
    stepScores: (row.step_scores as TrainingHistoryEntry["stepScores"]) ?? {
      step1: 0,
      step2: 0,
      step3: 0,
      step4: 0,
      step5: 0,
      step6: 0,
    },
    stepDetails,
    articulationScores:
      (row.articulation_scores as TrainingHistoryEntry["articulationScores"]) ??
      undefined,
    facialAnalysisSnapshot:
      (row.facial_analysis_snapshot as TrainingHistoryEntry["facialAnalysisSnapshot"]) ??
      undefined,
    measurementQuality:
      (row.measurement_quality as TrainingHistoryEntry["measurementQuality"]) ??
      undefined,
    stepVersionSnapshots:
      (row.step_version_snapshots as TrainingHistoryEntry["stepVersionSnapshots"]) ??
      undefined,
  };
  return entry;
}

export async function getStatsForAuthenticatedUser(
  sessionToken: string,
): Promise<HistoryStatsResult> {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  // CTE 로 카운트 + latest AQ + latest completed_at 을 한 번에 계산.
  // sing 은 language_training_results 와 별도 테이블이므로 UNION 으로 묶는다.
  const res = await pool.query(
    `
      WITH ltr AS (
        SELECT
          cs.completed_at,
          ltr.training_mode,
          ltr.aq
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
      ),
      sing AS (
        SELECT cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
      )
      SELECT
        (SELECT COUNT(*) FROM ltr WHERE COALESCE(training_mode, 'self') = 'self')::int AS total_self,
        (SELECT COUNT(*) FROM ltr WHERE training_mode = 'rehab')::int AS total_rehab,
        (SELECT COUNT(*) FROM sing)::int AS total_sing,
        (
          SELECT aq
          FROM ltr
          WHERE COALESCE(training_mode, 'self') = 'self'
          ORDER BY completed_at DESC
          LIMIT 1
        ) AS latest_aq,
        (
          SELECT MAX(completed_at) FROM (
            SELECT completed_at FROM ltr
            UNION ALL
            SELECT completed_at FROM sing
          ) AS combined
        ) AS latest_completed_at
    `,
    [context.patientPseudonymId],
  );
  const row = res.rows[0] ?? {};
  return {
    totalSelf: Number(row.total_self ?? 0),
    totalRehab: Number(row.total_rehab ?? 0),
    totalSing: Number(row.total_sing ?? 0),
    latestAq: row.latest_aq == null ? null : Number(row.latest_aq),
    latestCompletedAt: row.latest_completed_at
      ? new Date(row.latest_completed_at).toISOString()
      : null,
  };
}
