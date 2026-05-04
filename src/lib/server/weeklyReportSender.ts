// SR-GUARDIAN-SENDER. 보호자 주간 리포트 자동 발송 — Phase 2.
//
// 본 모듈은 발송 어댑터 인터페이스 + 결정성 발송 결정 함수만 제공한다.
// 실제 SMTP/SES wiring 은 운영 환경 의존 (nodemailer / @aws-sdk/client-ses 미설치 시
// stub adapter 가 동작하여 발송 시도만 로그).

import { randomUUID } from "crypto";
import type { WeeklyReportSummary } from "@/lib/guardian/weeklyReportSummary";
import { getDbPool } from "@/lib/server/postgres";

export type SendChannel = "email" | "sms" | "kakao";
export type DeliveryMode = "dry_run" | "send";
export type DeliveryStatus = "pending" | "dry_run" | "sent" | "failed" | "skipped";
export type SendDecisionReason =
  | "no_consent"
  | "no_channel_configured"
  | "duplicate_within_window"
  | "ok";

export interface SendCandidate {
  patientPseudonymId: string;
  guardianContactHash: string;
  channel: SendChannel;
  /** 보호자 동의 상태 (consentState 의 결과). */
  consentGranted: boolean;
  /** 마지막 발송 시각 (ms). null = 발송 이력 없음. */
  lastSentAtMs: number | null;
  /** 현재 시각 (ms). 결정성을 위해 외부 주입. */
  nowMs: number;
}

export interface SendDecision {
  candidate: SendCandidate;
  shouldSend: boolean;
  reason: SendDecisionReason;
}

const MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export function decideSend(candidate: SendCandidate): SendDecision {
  if (!candidate.consentGranted) {
    return { candidate, shouldSend: false, reason: "no_consent" };
  }
  if (!candidate.guardianContactHash) {
    return { candidate, shouldSend: false, reason: "no_channel_configured" };
  }
  if (
    candidate.lastSentAtMs !== null &&
    candidate.nowMs - candidate.lastSentAtMs < MIN_INTERVAL_MS
  ) {
    return {
      candidate,
      shouldSend: false,
      reason: "duplicate_within_window",
    };
  }
  return { candidate, shouldSend: true, reason: "ok" };
}

/** 발송 결과 (결정성). */
export interface SendOutcome {
  candidate: SendCandidate;
  status: "sent" | "skipped" | "failed";
  reason: SendDecisionReason | "stub_no_adapter" | "delivery_error";
  sentAtMs: number | null;
}

export interface WeeklyReportDeliveryInput {
  patientId: string;
  patientPseudonymId: string;
  linkId: string;
  reportUrl: string;
  recipientLabel?: string | null;
  channel?: SendChannel | null;
  deliveryMode: DeliveryMode;
  status: DeliveryStatus;
  reason: string;
  requestedByUserId?: string | null;
  latestCompletedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WeeklyReportDeliveryRecord {
  id: string;
  patientId: string;
  patientPseudonymId: string;
  linkId: string;
  reportUrl: string;
  recipientLabel: string | null;
  channel: SendChannel | null;
  deliveryMode: DeliveryMode;
  status: DeliveryStatus;
  reason: string;
  requestedByUserId: string | null;
  latestCompletedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface WeeklyReportDeliverySummary {
  total: number;
  dryRun: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  latestCreatedAt: string | null;
}

/** 발송 어댑터 인터페이스. SMTP/SES/카카오 각각 구현. */
export interface SenderAdapter {
  send(params: {
    candidate: SendCandidate;
    summary: WeeklyReportSummary;
    reportLinkUrl: string;
  }): Promise<{ ok: boolean; reason?: string }>;
}

/** Stub adapter — 환경 변수 미구성 시 발송 시도만 로그. */
export const STUB_SENDER_ADAPTER: SenderAdapter = {
  async send(_params) {
    return { ok: false, reason: "stub_no_adapter" };
  },
};

export async function executeSendBatch(params: {
  candidates: SendCandidate[];
  summaryByPatient: Record<string, WeeklyReportSummary>;
  reportLinkBuilder: (patientPseudonymId: string) => string;
  adapter?: SenderAdapter;
}): Promise<SendOutcome[]> {
  const adapter = params.adapter ?? STUB_SENDER_ADAPTER;
  const outcomes: SendOutcome[] = [];

  // 결정성 — patientPseudonymId 알파벳 정렬 후 처리
  const sorted = [...params.candidates].sort((a, b) =>
    a.patientPseudonymId.localeCompare(b.patientPseudonymId),
  );

  for (const c of sorted) {
    const decision = decideSend(c);
    if (!decision.shouldSend) {
      outcomes.push({
        candidate: c,
        status: "skipped",
        reason: decision.reason,
        sentAtMs: null,
      });
      continue;
    }
    const summary = params.summaryByPatient[c.patientPseudonymId];
    if (!summary) {
      outcomes.push({
        candidate: c,
        status: "skipped",
        reason: "no_channel_configured",
        sentAtMs: null,
      });
      continue;
    }
    try {
      const result = await adapter.send({
        candidate: c,
        summary,
        reportLinkUrl: params.reportLinkBuilder(c.patientPseudonymId),
      });
      outcomes.push({
        candidate: c,
        status: result.ok ? "sent" : "failed",
        reason: result.ok ? "ok" : ("delivery_error" as const),
        sentAtMs: result.ok ? c.nowMs : null,
      });
    } catch {
      outcomes.push({
        candidate: c,
        status: "failed",
        reason: "delivery_error",
        sentAtMs: null,
      });
    }
  }

  return outcomes;
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatus {
  return value === "pending" ||
    value === "dry_run" ||
    value === "sent" ||
    value === "failed" ||
    value === "skipped"
    ? value
    : "failed";
}

function normalizeDeliveryMode(value: unknown): DeliveryMode {
  return value === "send" ? "send" : "dry_run";
}

function normalizeSendChannel(value: unknown): SendChannel | null {
  return value === "email" || value === "sms" || value === "kakao" ? value : null;
}

export function summarizeDeliveryRecords(
  records: Array<{ status: DeliveryStatus; createdAt?: string | null }>,
): WeeklyReportDeliverySummary {
  const summary: WeeklyReportDeliverySummary = {
    total: records.length,
    dryRun: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    latestCreatedAt: null,
  };

  for (const record of [...records].sort((a, b) =>
    String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")),
  )) {
    if (record.status === "dry_run") summary.dryRun += 1;
    if (record.status === "pending") summary.pending += 1;
    if (record.status === "sent") summary.sent += 1;
    if (record.status === "failed") summary.failed += 1;
    if (record.status === "skipped") summary.skipped += 1;
    if (record.createdAt) summary.latestCreatedAt = record.createdAt;
  }

  return summary;
}

async function ensureWeeklyReportDeliveryTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_report_deliveries (
      id UUID PRIMARY KEY,
      patient_id UUID NOT NULL,
      patient_pseudonym_id TEXT NOT NULL,
      link_id UUID NOT NULL,
      report_url TEXT NOT NULL,
      recipient_label TEXT NULL,
      channel TEXT NULL,
      delivery_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      requested_by_user_id UUID NULL,
      latest_completed_at TIMESTAMPTZ NULL,
      sent_at TIMESTAMPTZ NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_weekly_report_deliveries_patient
      ON weekly_report_deliveries(patient_id, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_weekly_report_deliveries_status
      ON weekly_report_deliveries(status, created_at DESC)
  `);
}

function mapDeliveryRow(row: any): WeeklyReportDeliveryRecord {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    linkId: String(row.link_id),
    reportUrl: String(row.report_url),
    recipientLabel: row.recipient_label ? String(row.recipient_label) : null,
    channel: normalizeSendChannel(row.channel),
    deliveryMode: normalizeDeliveryMode(row.delivery_mode),
    status: normalizeDeliveryStatus(row.status),
    reason: String(row.reason ?? ""),
    requestedByUserId: row.requested_by_user_id ? String(row.requested_by_user_id) : null,
    latestCompletedAt: row.latest_completed_at
      ? new Date(row.latest_completed_at).toISOString()
      : null,
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function createWeeklyReportDelivery(
  input: WeeklyReportDeliveryInput,
): Promise<WeeklyReportDeliveryRecord> {
  await ensureWeeklyReportDeliveryTable();
  const pool = getDbPool();
  const sentAt =
    input.status === "sent" ? new Date().toISOString() : null;
  const id = randomUUID();
  const result = await pool.query(
    `
      INSERT INTO weekly_report_deliveries (
        id, patient_id, patient_pseudonym_id, link_id, report_url,
        recipient_label, channel, delivery_mode, status, reason,
        requested_by_user_id, latest_completed_at, sent_at, metadata
      )
      VALUES (
        $1::uuid, $2::uuid, $3, $4::uuid, $5,
        $6, $7, $8, $9, $10,
        $11::uuid, $12::timestamptz, $13::timestamptz, $14::jsonb
      )
      RETURNING
        id::text, patient_id::text, patient_pseudonym_id, link_id::text,
        report_url, recipient_label, channel, delivery_mode, status, reason,
        requested_by_user_id::text, latest_completed_at::text, sent_at::text,
        created_at::text
    `,
    [
      id,
      input.patientId,
      input.patientPseudonymId,
      input.linkId,
      input.reportUrl,
      input.recipientLabel ?? null,
      input.channel ?? null,
      input.deliveryMode,
      input.status,
      input.reason,
      input.requestedByUserId ?? null,
      input.latestCompletedAt ?? null,
      sentAt,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return mapDeliveryRow(result.rows[0]);
}

export async function listRecentWeeklyReportDeliveries(limit = 20): Promise<{
  records: WeeklyReportDeliveryRecord[];
  summary: WeeklyReportDeliverySummary;
}> {
  await ensureWeeklyReportDeliveryTable();
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        id::text, patient_id::text, patient_pseudonym_id, link_id::text,
        report_url, recipient_label, channel, delivery_mode, status, reason,
        requested_by_user_id::text, latest_completed_at::text, sent_at::text,
        created_at::text
      FROM weekly_report_deliveries
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [Math.max(1, Math.min(100, Math.floor(limit)))],
  );
  const records = result.rows.map(mapDeliveryRow);
  return {
    records,
    summary: summarizeDeliveryRecords(records),
  };
}
