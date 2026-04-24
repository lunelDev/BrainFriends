/**
 * src/lib/server/prescriptionSessionsDb.ts
 *
 * 처방 내 개별 학습 세션 실행 기록 (adherence 집계 소스).
 * 기존 학습 결과 저장 경로에서 얇게 호출된다 — 실패해도 학습 저장은 망가뜨리지 않는다.
 *
 * 주요 함수:
 *   recordSession     — 학습 완료 시 1 row 생성 (started_at/completed_at 포함)
 *   getWeeklyAdherence — 처방의 주차별 권장 대비 완료율
 */

import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/server/postgres";

export type PrescriptionSessionRow = {
  id: string;
  prescriptionId: string;
  trainingResultId: string | null;
  programCode: string;
  startedAt: Date;
  completedAt: Date | null;
  durationSec: number | null;
  completed: boolean;
  weekIndex: number;
  createdAt: Date;
};

export type WeeklyAdherence = {
  weekIndex: number;
  completed: number;
  target: number;
  ratio: number; // 0~1+, 초과 사용도 가능
};

function rowToSession(row: Record<string, unknown>): PrescriptionSessionRow {
  return {
    id: String(row.id),
    prescriptionId: String(row.prescription_id),
    trainingResultId: row.training_result_id
      ? String(row.training_result_id)
      : null,
    programCode: String(row.program_code),
    startedAt: new Date(String(row.started_at)),
    completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
    durationSec:
      row.duration_sec === null || row.duration_sec === undefined
        ? null
        : Number(row.duration_sec),
    completed: Boolean(row.completed),
    weekIndex: Number(row.week_index),
    createdAt: new Date(String(row.created_at)),
  };
}

function computeWeekIndex(startsAt: Date, now: Date): number {
  const diffMs = now.getTime() - startsAt.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export async function recordSession(input: {
  prescriptionId: string;
  programCode: string;
  prescriptionStartsAt: Date;
  trainingResultId?: string | null;
  startedAt?: Date;
  completedAt?: Date | null;
  durationSec?: number | null;
  completed?: boolean;
}): Promise<PrescriptionSessionRow> {
  const pool = getDbPool();
  const startedAt = input.startedAt ?? new Date();
  const completedAt =
    input.completedAt === undefined ? new Date() : input.completedAt;
  const completed =
    typeof input.completed === "boolean" ? input.completed : Boolean(completedAt);
  const weekIndex = computeWeekIndex(
    input.prescriptionStartsAt,
    completedAt ?? startedAt,
  );

  const result = await pool.query(
    `
      INSERT INTO prescription_sessions (
        id, prescription_id, training_result_id, program_code,
        started_at, completed_at, duration_sec, completed, week_index,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `,
    [
      randomUUID(),
      input.prescriptionId,
      input.trainingResultId ?? null,
      input.programCode,
      startedAt.toISOString(),
      completedAt ? completedAt.toISOString() : null,
      input.durationSec ?? null,
      completed,
      weekIndex,
    ],
  );
  return rowToSession(result.rows[0]);
}

/**
 * 처방의 주차별 완료 집계. target = sessions_per_week.
 * 학습을 아직 안 한 주차도 0 으로 포함해 0..durationWeeks-1 전부 리턴.
 */
export async function getWeeklyAdherence(input: {
  prescriptionId: string;
  sessionsPerWeek: number;
  durationWeeks: number;
}): Promise<WeeklyAdherence[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT week_index, COUNT(*)::int AS completed_count
        FROM prescription_sessions
       WHERE prescription_id = $1
         AND completed = TRUE
       GROUP BY week_index
    `,
    [input.prescriptionId],
  );

  const counts = new Map<number, number>();
  for (const row of result.rows) {
    counts.set(Number(row.week_index), Number(row.completed_count));
  }

  const target = Math.max(1, input.sessionsPerWeek);
  const out: WeeklyAdherence[] = [];
  for (let week = 0; week < input.durationWeeks; week += 1) {
    const completed = counts.get(week) ?? 0;
    out.push({
      weekIndex: week,
      completed,
      target,
      ratio: completed / target,
    });
  }
  return out;
}

/** 현재 주차의 완료 수 / target — 마이페이지 카드 용 */
export async function getCurrentWeekAdherence(input: {
  prescriptionId: string;
  sessionsPerWeek: number;
  prescriptionStartsAt: Date;
}): Promise<WeeklyAdherence> {
  const weekIndex = computeWeekIndex(input.prescriptionStartsAt, new Date());
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS completed_count
        FROM prescription_sessions
       WHERE prescription_id = $1
         AND week_index = $2
         AND completed = TRUE
    `,
    [input.prescriptionId, weekIndex],
  );
  const completed = Number(result.rows[0]?.completed_count ?? 0);
  const target = Math.max(1, input.sessionsPerWeek);
  return {
    weekIndex,
    completed,
    target,
    ratio: completed / target,
  };
}

export async function listSessionsForPrescription(
  prescriptionId: string,
  opts?: { limit?: number },
): Promise<PrescriptionSessionRow[]> {
  const pool = getDbPool();
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 1000);
  const result = await pool.query(
    `
      SELECT * FROM prescription_sessions
       WHERE prescription_id = $1
       ORDER BY started_at DESC
       LIMIT $2
    `,
    [prescriptionId, limit],
  );
  return result.rows.map(rowToSession);
}
