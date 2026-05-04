// src/lib/server/auditChain.ts
//
// UC-07 (부인 방지) + TRE-01 (감사로그 무결성).
// 식약처 디지털의료기기 사이버보안 가이드라인 UC-07 / TRE-01 대응.
// SR-SEC-UC07, SR-SEC-TRE01.
//
// 정책:
//   - 모든 감사 이벤트는 prevHash + entryHash 를 함께 저장한다.
//   - entryHash = HMAC-SHA256(secret, prevHash + JSON.stringify(canonical(entry)))
//   - 첫 entry 의 prevHash 는 GENESIS_HASH 고정.
//   - 검증 단계에서 시간 단조성 + hash 체인을 모두 확인한다.
//
// 본 모듈은 결정성 함수만 제공한다. 실제 감사로그 append (DB / NDJSON) 는 호출부 (auditLog.ts) 가 담당.

import { createHmac } from "crypto";

export const AUDIT_GENESIS_HASH = "0".repeat(64);

export interface AuditChainEntry {
  /** 단조 증가 시각 (epoch ms). */
  ts: number;
  /** 이벤트 카테고리 (예: "login", "permission_denied", "aac_intent"). */
  category: string;
  /** 결정성 직렬화 가능한 payload. 키 알파벳 정렬 후 JSON.stringify. */
  payload: Record<string, unknown>;
}

export interface AuditChainRecord extends AuditChainEntry {
  prevHash: string;
  entryHash: string;
}

export interface AuditChainComputeInput {
  entry: AuditChainEntry;
  prevHash: string;
  secret: string;
}

export interface AuditChainVerifyInput {
  entries: AuditChainRecord[];
  secret: string;
}

export type AuditChainVerifyResult =
  | { valid: true; count: number }
  | {
      valid: false;
      reason: "hash_mismatch" | "time_regression" | "broken_link";
      breakAt: number; // 0-based index of first invalid entry
      detail: string;
    };

function canonicalize(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = payload[key];
  }
  return JSON.stringify(sorted);
}

export function computeEntryHash(input: AuditChainComputeInput): string {
  const { entry, prevHash, secret } = input;
  const material = `${prevHash}|${entry.ts}|${entry.category}|${canonicalize(entry.payload)}`;
  return createHmac("sha256", secret).update(material).digest("hex");
}

export function appendAuditEntry(input: AuditChainComputeInput): AuditChainRecord {
  return {
    ...input.entry,
    prevHash: input.prevHash,
    entryHash: computeEntryHash(input),
  };
}

export function verifyAuditChain(input: AuditChainVerifyInput): AuditChainVerifyResult {
  const { entries, secret } = input;
  if (entries.length === 0) return { valid: true, count: 0 };

  let prevHash = AUDIT_GENESIS_HASH;
  let prevTs = -Infinity;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];

    // TRE-01: 시간 단조성.
    if (entry.ts < prevTs) {
      return {
        valid: false,
        reason: "time_regression",
        breakAt: i,
        detail: `entry[${i}].ts=${entry.ts} < prev=${prevTs}`,
      };
    }

    // UC-07: 체인 prevHash 일치.
    if (entry.prevHash !== prevHash) {
      return {
        valid: false,
        reason: "broken_link",
        breakAt: i,
        detail: `entry[${i}].prevHash=${entry.prevHash} !== expected=${prevHash}`,
      };
    }

    // UC-07: HMAC 무결성.
    const expectedHash = computeEntryHash({
      entry: { ts: entry.ts, category: entry.category, payload: entry.payload },
      prevHash: entry.prevHash,
      secret,
    });
    if (entry.entryHash !== expectedHash) {
      return {
        valid: false,
        reason: "hash_mismatch",
        breakAt: i,
        detail: `entry[${i}].entryHash mismatch`,
      };
    }

    prevHash = entry.entryHash;
    prevTs = entry.ts;
  }

  return { valid: true, count: entries.length };
}
