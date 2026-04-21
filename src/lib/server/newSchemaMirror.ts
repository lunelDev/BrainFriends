/**
 * 신규 통일 스키마로의 이중 쓰기(미러링) 전용 모듈.
 *
 * 설계 원칙
 *   - 각 미러 함수는 "이미 레거시에 정상적으로 저장된 데이터" 를 인자로 받는다.
 *     레거시 쓰기가 선행되었다는 전제로 신규 테이블에만 쓰기 수행.
 *   - 모든 미러 호출은 호출측에서 try/catch 로 감싼 뒤, 기능 플래그
 *     `USE_NEW_USERS_SCHEMA` 가 켜져 있을 때만 실행된다.
 *   - 각 함수는 단일 트랜잭션으로 동작 → 부분 실패 시 해당 미러만 롤백.
 *   - 레거시 결과는 이 모듈의 실패로 롤백되지 않는다 (이미 커밋됨).
 *
 * 기능 플래그
 *   - `featureFlags.useNewUsersSchema` === true 일 때만 호출자가 이 모듈 사용
 *   - `useNewUsersSchemaStrict` === true 이면 실패 시 호출자가 rethrow
 */
import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/server/postgres";
import { featureFlags } from "@/lib/server/featureFlags";
import {
  upsertNewUser,
  type NewUserAccountType,
  type NewUserStatus,
} from "@/lib/server/newSchema/usersDb";
import { upsertUserPiiProfile } from "@/lib/server/newSchema/userPiiProfileDb";
import {
  upsertTherapistProfile,
  setTherapistVerificationStatus,
  getTherapistProfileByUserId,
  type TherapistVerificationStatus,
} from "@/lib/server/newSchema/therapistProfilesDb";
import {
  upsertInstitution,
  getInstitutionByLegacyId,
  type InstitutionStatus,
} from "@/lib/server/newSchema/institutionsDb";
import { upsertInstitutionMember } from "@/lib/server/newSchema/institutionMembersDb";
import { upsertUserTherapistMapping } from "@/lib/server/newSchema/userTherapistMappingsDb";
import { linkPseudonymToNewUser } from "@/lib/server/newSchema/pseudonymLinkDb";

// ──────────────────────────────────────────────────────────
// 1. 가입 미러 (signup 경로에서 호출)
// ──────────────────────────────────────────────────────────

export type MirrorAccountSignupInput = {
  /** 레거시 app_users.user_id — 신규 users.id 에 그대로 재사용 */
  userId: string;
  /** 레거시 patient_pii.patient_id — user_pii_profile.legacy_patient_id 추적용 */
  legacyPatientId: string;
  /** 레거시 pseudonym_id — patient_pseudonym_map.user_id 연결용 */
  patientPseudonymId?: string | null;

  /** users 테이블 필드 */
  name: string;
  email: string; // signup 본문에서 받은 이메일 (없으면 임시 문자열)
  phone: string; // 전체 전화번호 문자열
  loginId: string;
  passwordHash: string; // 레거시에서 이미 해시된 값
  loginKeyHash?: string | null;
  accountType: NewUserAccountType; // USER / THERAPIST / ADMIN
  status?: NewUserStatus; // 기본 PENDING, 이미 승인된 경우 ACTIVE
  legacyUserRole: string; // patient / therapist / admin

  /** user_pii_profile 필드 (주로 일반회원/치료사) */
  birthDate?: string | null;
  sex?: string | null;
  language?: string | null;
  legacyPatientCode?: string | null;

  /** 치료사 경우에만 채움 */
  therapist?: {
    jobType: string; // profession
    licenseNumber: string;
    licenseFileUrl: string;
    issuedBy?: string | null;
    issuedDate?: string | null;
    specialty?: string | null;
    introduction?: string | null;
  };

  /** 이미 승인된 기관에 합류하는 경우 (기존 organizationId) */
  existingLegacyOrganizationId?: string | null;

  /** 1인 기관 신청을 동반한 경우 */
  soloInstitution?: {
    name: string;
    businessNumber?: string | null;
    representativeName?: string | null;
    institutionType?: string | null;
    phone?: string | null;
    zipCode?: string | null;
    address1?: string | null;
    address2?: string | null;
    businessLicenseFileUrl?: string | null;
  } | null;
};

/**
 * 회원가입 1건 전체를 신규 스키마에 미러링.
 * 단일 트랜잭션 — 이 함수 안에서 실패하면 이 미러만 전체 롤백.
 */
export async function mirrorAccountSignup(input: MirrorAccountSignupInput): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) users upsert
    await upsertNewUser(client, {
      id: input.userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      loginId: input.loginId,
      passwordHash: input.passwordHash,
      loginKeyHash: input.loginKeyHash ?? null,
      accountType: input.accountType,
      status: input.status ?? "PENDING",
      legacyUserRole: input.legacyUserRole,
    });

    // 2) user_pii_profile (일반회원/치료사 모두 기본 정보 저장)
    await upsertUserPiiProfile(client, {
      userId: input.userId,
      birthDate: input.birthDate ?? null,
      sex: input.sex ?? null,
      language: input.language ?? null,
      legacyPatientCode: input.legacyPatientCode ?? null,
      legacyPatientId: input.legacyPatientId || null,
    });

    // 3) pseudonym 매핑에 user_id 연결 (일반회원만 의미있음)
    if (input.patientPseudonymId) {
      try {
        await linkPseudonymToNewUser(client, input.patientPseudonymId, input.userId);
      } catch (err) {
        // pseudonym_map 행이 없으면 치명적이지 않음 — 로그만 남기고 계속
        if (err instanceof Error && err.message !== "pseudonym_map_not_found") {
          throw err;
        }
        console.warn(
          "[mirror] pseudonym_map row not found, skipping link:",
          input.patientPseudonymId,
        );
      }
    }

    // 4) 치료사 프로파일
    if (input.therapist) {
      await upsertTherapistProfile(client, {
        userId: input.userId,
        jobType: input.therapist.jobType,
        licenseNumber: input.therapist.licenseNumber,
        licenseFileUrl: input.therapist.licenseFileUrl || "pending",
        issuedBy: input.therapist.issuedBy ?? null,
        issuedDate: input.therapist.issuedDate ?? null,
        specialty: input.therapist.specialty ?? null,
        introduction: input.therapist.introduction ?? null,
        isPublic: false,
        verificationStatus: "PENDING",
      });
    }

    // 5) 기관 연결
    //    5-a) 기존 기관 합류: institution row 는 이미 있을 수도 없을 수도.
    //         legacy_organization_id 로 찾아서 있으면 그 institution 에 member 추가.
    //         없으면 placeholder institution row 를 PENDING 상태로 만든다.
    if (input.existingLegacyOrganizationId) {
      const legacyOrgId = input.existingLegacyOrganizationId;
      const existing = await getInstitutionByLegacyId(client, legacyOrgId);
      const institution =
        existing ??
        (await upsertInstitution(client, {
          name: `(legacy:${legacyOrgId.slice(0, 8)})`,
          status: "APPROVED",
          legacyOrganizationId: legacyOrgId,
          createdByUserId: input.userId,
        }));

      const memberRole =
        input.accountType === "THERAPIST"
          ? "THERAPIST"
          : input.accountType === "USER"
            ? "PATIENT"
            : "MANAGER";

      await upsertInstitutionMember(client, {
        institutionId: institution.id,
        userId: input.userId,
        role: memberRole,
        // 합류 자체는 승인 전이므로 PENDING 이 기본
        status: input.status === "ACTIVE" ? "APPROVED" : "PENDING",
        isOwner: false,
        joinedAt: input.status === "ACTIVE" ? new Date() : null,
      });
    }

    //    5-b) 1인 기관 신청: institutions 에 새 행을 PENDING 으로 추가하고,
    //         신청자 자신을 OWNER 로 등록.
    if (input.soloInstitution) {
      const institutionId = randomUUID();
      const institution = await upsertInstitution(client, {
        id: institutionId,
        name: input.soloInstitution.name,
        businessNumber: input.soloInstitution.businessNumber ?? null,
        representativeName: input.soloInstitution.representativeName ?? null,
        institutionType: input.soloInstitution.institutionType ?? null,
        phone: input.soloInstitution.phone ?? null,
        zipCode: input.soloInstitution.zipCode ?? null,
        address1: input.soloInstitution.address1 ?? null,
        address2: input.soloInstitution.address2 ?? null,
        businessLicenseFileUrl: input.soloInstitution.businessLicenseFileUrl ?? null,
        status: "PENDING",
        createdByUserId: input.userId,
      });

      await upsertInstitutionMember(client, {
        institutionId: institution.id,
        userId: input.userId,
        role: "OWNER",
        status: "PENDING",
        isOwner: true,
        joinedAt: null,
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────
// 2. 치료사 승인 미러 (관리자 PATCH /admin/therapists)
// ──────────────────────────────────────────────────────────

export type MirrorTherapistReviewInput = {
  therapistUserId: string;
  status: "approved" | "rejected";
};

/**
 * 치료사 승인/거절 상태를 신규 스키마에 반영.
 *   - users.status: approved → ACTIVE, rejected → SUSPENDED
 *   - therapist_profiles.verification_status: APPROVED / REJECTED
 */
export async function mirrorTherapistReview(input: MirrorTherapistReviewInput): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const newUserStatus: NewUserStatus = input.status === "approved" ? "ACTIVE" : "SUSPENDED";
    await client.query(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newUserStatus, input.therapistUserId],
    );

    const profile = await getTherapistProfileByUserId(client, input.therapistUserId);
    if (profile) {
      const verification: TherapistVerificationStatus =
        input.status === "approved" ? "APPROVED" : "REJECTED";
      await setTherapistVerificationStatus(client, profile.id, verification);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────
// 3. 기관 승인 미러 (관리자 POST /admin/organizations action=review)
// ──────────────────────────────────────────────────────────

export type MirrorOrganizationReviewInput = {
  /** 승인 시 레거시에서 새로 만든 organization.id — legacy_organization_id 로 보존 */
  legacyOrganizationId?: string | null;
  name: string;
  businessNumber?: string | null;
  representativeName?: string | null;
  institutionType?: string | null;
  phone?: string | null;
  zipCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  businessLicenseFileUrl?: string | null;
  status: InstitutionStatus; // 승인되면 APPROVED, 거절이면 REJECTED
};

/**
 * 기관 승인 리뷰 결과를 신규 스키마에 반영.
 *   - 승인: 레거시 ID 로 이미 만들어둔 institutions 행이 있으면 그 row 를 APPROVED 로 업데이트.
 *           없으면 새로 생성.
 *   - 거절: 동일한 방식으로 REJECTED 로 업데이트.
 */
export async function mirrorOrganizationReview(
  input: MirrorOrganizationReviewInput,
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let targetId: string | null = null;
    if (input.legacyOrganizationId) {
      const existing = await getInstitutionByLegacyId(client, input.legacyOrganizationId);
      targetId = existing?.id ?? null;
    }

    if (targetId) {
      // 기존 행을 업데이트
      await client.query(
        `
          UPDATE institutions
             SET name = $1,
                 business_number = COALESCE($2, business_number),
                 representative_name = COALESCE($3, representative_name),
                 institution_type = COALESCE($4, institution_type),
                 phone = COALESCE($5, phone),
                 zip_code = COALESCE($6, zip_code),
                 address1 = COALESCE($7, address1),
                 address2 = COALESCE($8, address2),
                 business_license_file_url = COALESCE($9, business_license_file_url),
                 status = $10,
                 updated_at = NOW()
           WHERE id = $11
        `,
        [
          input.name,
          input.businessNumber ?? null,
          input.representativeName ?? null,
          input.institutionType ?? null,
          input.phone ?? null,
          input.zipCode ?? null,
          input.address1 ?? null,
          input.address2 ?? null,
          input.businessLicenseFileUrl ?? null,
          input.status,
          targetId,
        ],
      );
    } else {
      await upsertInstitution(client, {
        name: input.name,
        businessNumber: input.businessNumber ?? null,
        representativeName: input.representativeName ?? null,
        institutionType: input.institutionType ?? null,
        phone: input.phone ?? null,
        zipCode: input.zipCode ?? null,
        address1: input.address1 ?? null,
        address2: input.address2 ?? null,
        businessLicenseFileUrl: input.businessLicenseFileUrl ?? null,
        status: input.status,
        legacyOrganizationId: input.legacyOrganizationId ?? null,
      });
    }

    // 신청자 owner 행이 pending 상태로 있었다면 상태 동기화
    if (input.legacyOrganizationId) {
      const institution = await getInstitutionByLegacyId(client, input.legacyOrganizationId);
      if (institution) {
        const memberStatus = input.status === "APPROVED" ? "APPROVED" : "REJECTED";
        await client.query(
          `
            UPDATE institution_members
               SET status = $1,
                   joined_at = CASE WHEN $1 = 'APPROVED' AND joined_at IS NULL THEN NOW() ELSE joined_at END
             WHERE institution_id = $2
               AND status = 'PENDING'
          `,
          [memberStatus, institution.id],
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────
// 4. 환자–치료사 매칭 미러 (관리자 PATCH /admin/patient-links)
// ──────────────────────────────────────────────────────────

export type MirrorPatientLinkApprovalInput = {
  patientUserId: string;
  therapistUserId: string;
  legacyOrganizationId: string;
  status: "approved" | "rejected";
};

/**
 * 환자–치료사 매칭 승인을 신규 스키마에 반영.
 *   - institutions 행이 legacy_organization_id 로 매핑돼있다는 전제
 *     (없으면 placeholder 로 만듦)
 *   - user_therapist_mappings upsert
 */
export async function mirrorPatientLinkApproval(
  input: MirrorPatientLinkApprovalInput,
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // institution 보장
    let institution = await getInstitutionByLegacyId(client, input.legacyOrganizationId);
    if (!institution) {
      institution = await upsertInstitution(client, {
        name: `(legacy:${input.legacyOrganizationId.slice(0, 8)})`,
        status: "APPROVED",
        legacyOrganizationId: input.legacyOrganizationId,
      });
    }

    // 두 사용자가 모두 신규 users 에 존재해야만 FK 가 걸림.
    // 없으면 이중 쓰기 적용 이전 가입자라는 뜻 → 이 케이스는 건너뜀.
    const usersCheck = await client.query(
      `SELECT id FROM users WHERE id IN ($1, $2)`,
      [input.patientUserId, input.therapistUserId],
    );
    if (usersCheck.rowCount !== 2) {
      console.warn(
        "[mirror] patient-link skip: users row missing (likely pre-dual-write account)",
      );
      await client.query("COMMIT");
      return;
    }

    await upsertUserTherapistMapping(client, {
      userId: input.patientUserId,
      therapistUserId: input.therapistUserId,
      institutionId: institution.id,
      status: input.status === "approved" ? "APPROVED" : "REJECTED",
      assignedAt: input.status === "approved" ? new Date() : null,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────
// 편의 — guarded 호출 헬퍼
// ──────────────────────────────────────────────────────────

/**
 * 미러 호출을 기능 플래그로 감싼 헬퍼.
 * 기본 동작:
 *   - 플래그 OFF 이면 아무것도 안 함
 *   - 플래그 ON + 미러 실패 → 로그만 남김 (레거시 결과 보호)
 *   - `USE_NEW_USERS_SCHEMA_STRICT=true` → 실패 시 rethrow
 */
export async function runMirrorGuarded(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  if (!featureFlags.useNewUsersSchema) return;
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dual-write][${label}] mirror failed:`, message);
    if (featureFlags.useNewUsersSchemaStrict) throw err;
  }
}
