// src/lib/server/phiMasking.ts
//
// SR-PHI-013. PHI (Protected Health Information) 마스킹 결정성.
// 식약처 디지털의료기기 GMP [별표3] 2.4 / PDF #5 [별첨5] 보안지침 / 개인정보보호법 대응.
//
// 마스킹 대상:
//   - 한국 이름 (2~4자 한글)        → 첫 글자 + ✱✱
//   - 전화번호 (010-XXXX-XXXX 등)    → 010-✱✱✱✱-XXXX (마지막 4자리만 보존)
//   - 주민등록번호 (XXXXXX-XXXXXXX)   → XXXXXX-✱✱✱✱✱✱✱
//   - 이메일                       → 첫 2자 + ✱✱✱@domain
//   - 환자 식별자 (BF + 숫자)        → 앞 4자만 + ✱✱
//
// 마스킹은 **로그/리포트/V&V export 등 감사 산출물**에만 적용한다. DB 저장은 별도 정책.

const NAME_RE = /^[가-힣]{2,4}$/;
const PHONE_RE = /^(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})$/;
const RRN_RE = /^(\d{6})[-.\s]?(\d{7})$/;
const EMAIL_RE = /^([^@\s]{1,})@([^@\s]+\.[^@\s]+)$/;
const PATIENT_ID_RE = /^(BF[A-Z0-9]{2,})([A-Z0-9]+)$/i;

export type PhiKind = "name" | "phone" | "rrn" | "email" | "patient_id" | "unknown";

export interface PhiMaskResult {
  original: string;
  masked: string;
  kind: PhiKind;
  /** 원본이 PHI 패턴이 아니어서 전체 마스킹된 경우 true. */
  blanket: boolean;
}

/**
 * 단일 값 마스킹. 결정성: 동일 입력 → 동일 출력.
 */
export function maskPhi(value: unknown): PhiMaskResult {
  if (typeof value !== "string" || value.length === 0) {
    return { original: String(value ?? ""), masked: "", kind: "unknown", blanket: true };
  }
  const trimmed = value.trim();
  if (NAME_RE.test(trimmed)) {
    const first = trimmed.charAt(0);
    return {
      original: value,
      masked: `${first}${"✱".repeat(Math.max(1, trimmed.length - 1))}`,
      kind: "name",
      blanket: false,
    };
  }
  const phone = trimmed.match(PHONE_RE);
  if (phone) {
    const [, head, , tail] = phone;
    return {
      original: value,
      masked: `${head}-✱✱✱✱-${tail}`,
      kind: "phone",
      blanket: false,
    };
  }
  const rrn = trimmed.match(RRN_RE);
  if (rrn) {
    const [, front] = rrn;
    return {
      original: value,
      masked: `${front}-✱✱✱✱✱✱✱`,
      kind: "rrn",
      blanket: false,
    };
  }
  const email = trimmed.match(EMAIL_RE);
  if (email) {
    const [, local, domain] = email;
    const head = local.length >= 2 ? local.slice(0, 2) : local;
    return {
      original: value,
      masked: `${head}${"✱".repeat(3)}@${domain}`,
      kind: "email",
      blanket: false,
    };
  }
  const pid = trimmed.match(PATIENT_ID_RE);
  if (pid) {
    const [, prefix] = pid;
    return {
      original: value,
      masked: `${prefix}✱✱`,
      kind: "patient_id",
      blanket: false,
    };
  }
  // PHI 패턴 미일치 — 전체 마스킹 (안전 기본값).
  return {
    original: value,
    masked: "✱".repeat(Math.min(8, Math.max(3, trimmed.length))),
    kind: "unknown",
    blanket: true,
  };
}

/**
 * 객체 트리에서 PHI 후보 키를 자동 탐지해 마스킹.
 * 키 이름이 다음 패턴이면 PHI 후보:
 *   name, phone, mobile, email, rrn, ssn, patientName, patientPhone, guardianName, …
 *
 * 결정성: 동일 입력 → 동일 출력 (key 정렬 후 처리).
 */
const PHI_KEY_RE = /(name|phone|mobile|email|rrn|ssn|patient[_-]?id|guardian|address|birth)/i;

export function maskPhiObject<T extends Record<string, unknown>>(
  obj: T,
): { masked: T; touched: string[] } {
  const touched: string[] = [];
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    if (PHI_KEY_RE.test(key) && typeof value === "string") {
      const result = maskPhi(value);
      out[key] = result.masked;
      touched.push(key);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = maskPhiObject(value as Record<string, unknown>);
      out[key] = nested.masked;
      for (const k of nested.touched) touched.push(`${key}.${k}`);
    } else {
      out[key] = value;
    }
  }
  return { masked: out as T, touched };
}
