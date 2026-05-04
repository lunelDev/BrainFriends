// src/lib/server/inputSchemas.ts
//
// SI-05: 입력값 검증 통합 스키마.
// 식약처 디지털의료기기 사이버보안 가이드라인 SI-05 대응. SR-SEC-SI05.
//
// 정책:
//   - 모든 API route 의 body / query 스키마는 본 파일에 정의한다.
//   - 검증 실패 → SI-07 errorCodes 의 "invalid_payload" 로 통일 응답.
//   - 디버그 정보 (필드 path, expected type) 는 audit 로그에만 남기고 사용자 응답에서는 제거 (IA-06).
//   - 결정성 검증은 V&V (TC-SEC-SI05-001) 가 보장.
//
// 기존 라우트의 수동 String/trim/Array.isArray 검증 패턴을 점진 대체한다.

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// 공통 primitive
// ─────────────────────────────────────────────────────────────────

export const PlaceTypeSchema = z.enum([
  "home",
  "hospital",
  "cafe",
  "bank",
  "park",
  "mart",
]);

export const UserRoleSchema = z.enum([
  "admin",
  "therapist",
  "patient",
  "prescriber",
]);

const SafeIdString = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_./-]+$/, "id_unsafe_chars");

const SafeShortText = z.string().min(1).max(500);
const SafeLongText = z.string().max(5000);

// ─────────────────────────────────────────────────────────────────
// 인증 / 계정
// ─────────────────────────────────────────────────────────────────

export const LoginInputSchema = z.object({
  loginId: z.string().min(2).max(64),
  password: z.string().min(1).max(256), // 강도 검증은 validatePasswordStrength 가 별도 수행
});

export const SignupInputSchema = z.object({
  loginId: z.string().min(2).max(64),
  password: z.string().min(8).max(256),
  name: z.string().min(1).max(50),
  phone: z.string().min(8).max(20),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date_format"),
  email: z.string().email().max(254).optional(),
});

export const ResetPasswordInputSchema = z.object({
  name: z.string().min(1).max(50),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date_format"),
  phoneLast4: z.string().regex(/^\d{4}$/, "phone_last4_invalid"),
  newPassword: z.string().min(8).max(256),
});

export const FindLoginIdInputSchema = z.object({
  name: z.string().min(1).max(50),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date_format"),
  phoneLast4: z.string().regex(/^\d{4}$/, "phone_last4_invalid"),
});

// ─────────────────────────────────────────────────────────────────
// AAC
// ─────────────────────────────────────────────────────────────────

export const AacIntentInputSchema = z.object({
  place: PlaceTypeSchema,
  symbolIds: z
    .array(SafeIdString)
    .min(1, "empty_sequence")
    .max(200, "sequence_too_long"),
  sentence: SafeShortText.optional(),
});

// ─────────────────────────────────────────────────────────────────
// 이상반응 (Adverse Event)
// ─────────────────────────────────────────────────────────────────

export const AdverseEventInputSchema = z.object({
  // AE_CATEGORIES (lib/server/adverseEventsDb.ts) 와 동일.
  category: z.enum([
    "headache",
    "fatigue",
    "dizziness",
    "voice_fatigue",
    "eye_fatigue",
    "anxiety",
    "other",
  ]),
  // severity 1=mild / 2=moderate / 3=severe — DB schema 와 일치.
  severity: z.number().int().min(1).max(3),
  freeText: z.string().trim().max(500).optional(),
  // prescriber/admin 이 환자 대신 신고할 때만 필요.
  patientUserId: z.string().uuid().optional(),
  patientPseudonymId: z.string().min(1).max(64).optional(),
  prescriptionId: z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────
// 보호자 / 처방
// ─────────────────────────────────────────────────────────────────

export const PatientLinkCareInputSchema = z.object({
  organizationId: z.string().uuid(),
  therapistUserId: z.string().uuid(),
});

export const GuardianContactInputSchema = z.object({
  patientId: z.string().uuid(),
  guardianName: z.string().min(1).max(50),
  relationship: z.string().min(1).max(50),
  contactType: z.enum(["email", "phone"]),
  contactValue: z.string().min(4).max(254),
  consentGranted: z.boolean(),
});

export const GuardianContactRevokeInputSchema = z.object({
  patientId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const PrescriptionRedeemInputSchema = z.object({
  code: z.string().min(4).max(64).regex(/^[A-Za-z0-9-]+$/, "code_unsafe_chars"),
});

// ─────────────────────────────────────────────────────────────────
// 검증 헬퍼
// ─────────────────────────────────────────────────────────────────

export interface ValidateResult<T> {
  ok: boolean;
  data?: T;
  /** 사용자 응답으로 노출 가능한 코드. 디버그 정보 미포함. */
  publicError?: "invalid_payload";
  /** audit 로그용 상세. 외부 노출 금지. */
  auditDetail?: string;
}

/**
 * 입력값을 스키마로 검증. 결과는 결정성. 실패 시 invalid_payload + audit 상세.
 * 호출부는 publicError 만 응답에 사용하고 auditDetail 은 안전한 audit log 에만 기록한다.
 */
export function validateInput<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
): ValidateResult<z.infer<S>> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.slice(0, 5).map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`,
  );
  return {
    ok: false,
    publicError: "invalid_payload",
    auditDetail: issues.join("; "),
  };
}

/** 결정성 unit-test 에서 expose 하는 스키마 collection (V&V 용). */
export const INPUT_SCHEMAS = {
  Login: LoginInputSchema,
  Signup: SignupInputSchema,
  ResetPassword: ResetPasswordInputSchema,
  FindLoginId: FindLoginIdInputSchema,
  AacIntent: AacIntentInputSchema,
  AdverseEvent: AdverseEventInputSchema,
  PatientLinkCare: PatientLinkCareInputSchema,
  GuardianContact: GuardianContactInputSchema,
  GuardianContactRevoke: GuardianContactRevokeInputSchema,
  PrescriptionRedeem: PrescriptionRedeemInputSchema,
} as const;

export type InputSchemaName = keyof typeof INPUT_SCHEMAS;
