// src/app/api/aac/intent/route.ts
//
// POST /api/aac/intent
//   AAC 보드에서 환자가 commit 한 심볼 시퀀스 + 자동 생성 문장을 저장한다.
//
// 보안 고려:
//   - 환자 세션 필수 (다른 사람의 발화 의도 임의 저장 금지).
//   - access audit log 작성 (existing safeAppendAccess 패턴 재사용).
//   - body 크기 제한 (심볼 시퀀스 200개 cap).
//
// 데이터 모델:
//   - aac_intent_logs (user_id, place, symbol_ids[], generated_sentence, created_at)
//   - 첫 호출 시 IF NOT EXISTS 로 자동 생성 (다른 라우트의 패턴과 동일).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { getDbPool } from "@/lib/server/postgres";
import { safeAppendAccess } from "@/lib/server/auditLog";
import { buildAacIntentSentence } from "@/lib/aac/intentTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SEQUENCE = 200;
const ALLOWED_PLACES = new Set([
  "home",
  "hospital",
  "cafe",
  "bank",
  "park",
  "mart",
]);

async function ensureTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aac_intent_logs (
      log_id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL,
      place TEXT NOT NULL,
      symbol_ids TEXT[] NOT NULL,
      generated_sentence TEXT NOT NULL,
      client_sentence TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS aac_intent_logs_user_idx
      ON aac_intent_logs (user_id, created_at DESC)
  `);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const place = String((body as any)?.place ?? "").trim();
  const symbolIdsRaw = (body as any)?.symbolIds;
  const clientSentence = String((body as any)?.sentence ?? "").trim();

  if (!ALLOWED_PLACES.has(place)) {
    return NextResponse.json({ ok: false, error: "invalid_place" }, { status: 400 });
  }
  if (!Array.isArray(symbolIdsRaw) || symbolIdsRaw.length === 0) {
    return NextResponse.json({ ok: false, error: "empty_sequence" }, { status: 400 });
  }
  if (symbolIdsRaw.length > MAX_SEQUENCE) {
    return NextResponse.json(
      { ok: false, error: "sequence_too_long" },
      { status: 400 },
    );
  }
  const symbolIds: string[] = symbolIdsRaw.map((id: unknown) => String(id || "").trim()).filter(
    Boolean,
  );
  if (symbolIds.length === 0) {
    return NextResponse.json({ ok: false, error: "empty_sequence" }, { status: 400 });
  }

  // 서버 측에서 다시 한 번 결정성 있게 문장을 생성. 클라이언트가 보낸 문장과 비교해
  // 불일치는 audit 로그에 남기되 거부하지는 않는다 (V&V 추적성).
  const recomputed = buildAacIntentSentence({ symbolIds });
  if (!recomputed.sentence) {
    return NextResponse.json(
      { ok: false, error: "no_resolvable_intent" },
      { status: 400 },
    );
  }

  try {
    await ensureTable();
    const pool = getDbPool();
    await pool.query(
      `
        INSERT INTO aac_intent_logs (user_id, place, symbol_ids, generated_sentence, client_sentence)
        VALUES ($1::uuid, $2, $3::text[], $4, $5)
      `,
      [ctx.userId, place, symbolIds, recomputed.sentence, clientSentence || null],
    );

    await safeAppendAccess({
      request: req,
      action: "create",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      subjectUserId: ctx.userId,
      subjectPseudonymId: ctx.patientPseudonymId,
      resourceType: "aac_intent_log",
      httpStatus: 201,
    });

    return NextResponse.json(
      { ok: true, sentence: recomputed.sentence },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "save_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
