import { NextResponse } from "next/server";
import { createAccount } from "@/lib/server/accountAuth";
import { upsertTherapistRegistrationProfile } from "@/lib/server/therapistRegistrationProfiles";
import { createOrganizationRegistrationRequest } from "@/lib/server/organizationRegistrationRequests";
import { findOrganizationDuplicate } from "@/lib/server/organizationCatalogDb";
import {
  mirrorAccountSignup,
  runMirrorGuarded,
  type MirrorAccountSignupInput,
} from "@/lib/server/newSchemaMirror";
import { getPseudonymIdByLegacyPatientId } from "@/lib/server/newSchema/pseudonymLinkDb";
import { getDbPool } from "@/lib/server/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_signup_payload" },
      { status: 400 },
    );
  }

  try {
    const userRole =
      body.userRole === "therapist" || body.userRole === "admin"
        ? body.userRole
        : "patient";

    const therapistPhone = String(body.phone ?? "").trim();
    const therapistPhoneDigits = therapistPhone.replace(/\D/g, "");
    const therapistEmail = String(body.email ?? "").trim().toLowerCase();
    const institutionMode = body.institutionMode === "solo" ? "solo" : "existing";
    const soloInstitution = body.soloInstitution && typeof body.soloInstitution === "object"
      ? body.soloInstitution
      : null;

    if (
      userRole === "therapist" &&
      ((institutionMode === "existing" && !body.organizationId) ||
        (institutionMode === "solo" &&
          (!soloInstitution ||
            !String(soloInstitution.organizationName ?? "").trim() ||
            !String(soloInstitution.businessNumber ?? "").trim() ||
            !String(soloInstitution.representativeName ?? "").trim() ||
            !String(soloInstitution.organizationType ?? "").trim() ||
            !String(soloInstitution.careInstitutionNumber ?? "").trim() ||
            !String(soloInstitution.businessLicenseFileName ?? "").trim())) ||
        therapistPhoneDigits.length < 10 ||
        !therapistEmail ||
        !String(body.profession ?? "").trim() ||
        !String(body.licenseNumber ?? "").trim() ||
        !String(body.licenseFileName ?? "").trim() ||
        !String(body.licenseIssuedBy ?? "").trim() ||
        !String(body.licenseIssuedDate ?? "").trim() ||
        !body.privacyAgreed ||
        !body.patientDataAccessAgreed ||
        !body.securityPolicyAgreed ||
        !body.confidentialityAgreed)
    ) {
      throw new Error("invalid_signup_payload");
    }

    // 솔로 기관 모드 — createAccount 전에 기관명/사업자/요양기관 번호 중복을 먼저 차단한다.
    // (이전에는 createAccount 후 createOrganizationRegistrationRequest에서만 검사해서,
    //  중복이어도 계정만 만들어지는 고아 계정 문제가 있었음.)
    if (userRole === "therapist" && institutionMode === "solo" && soloInstitution) {
      const duplicate = await findOrganizationDuplicate({
        name: String(soloInstitution.organizationName ?? ""),
        businessNumber: String(soloInstitution.businessNumber ?? ""),
        careInstitutionNumber: String(soloInstitution.careInstitutionNumber ?? ""),
      });
      if (duplicate) {
        throw new Error("organization_already_exists");
      }
    }

    const created = await createAccount({
      userRole,
      organizationId:
        userRole === "patient" && body.organizationId
          ? String(body.organizationId)
          : userRole === "therapist" &&
              institutionMode === "existing" &&
              body.organizationId
          ? String(body.organizationId)
          : undefined,
      therapistUserId: body.therapistUserId
        ? String(body.therapistUserId)
        : undefined,
      approvalState: userRole === "therapist" ? "pending" : "approved",
      loginId: String(body.loginId ?? ""),
      name: String(body.name ?? ""),
      birthDate: String(body.birthDate ?? ""),
      phoneLast4:
        userRole === "therapist"
          ? therapistPhoneDigits.slice(-4)
          : String(body.phoneLast4 ?? ""),
      password: String(body.password ?? ""),
      gender: body.gender === "M" || body.gender === "F" ? body.gender : undefined,
      educationYears:
        body.educationYears == null || body.educationYears === ""
          ? undefined
          : Number(body.educationYears),
      onsetDate: body.onsetDate ? String(body.onsetDate) : undefined,
      hemiplegia: body.hemiplegia === "Y" ? "Y" : undefined,
      hemianopsia:
        body.hemianopsia === "LEFT" || body.hemianopsia === "RIGHT"
          ? body.hemianopsia
          : undefined,
    });

    if (userRole === "therapist") {
      await upsertTherapistRegistrationProfile({
        userId: created.userId,
        organizationId:
          institutionMode === "existing" && body.organizationId
            ? String(body.organizationId)
            : undefined,
        requestedOrganizationName:
          institutionMode === "solo"
            ? String(soloInstitution?.organizationName ?? "")
            : undefined,
        therapistName: String(body.name ?? ""),
        birthDate: String(body.birthDate ?? ""),
        gender: body.gender === "M" || body.gender === "F" ? body.gender : "U",
        phone: therapistPhone,
        email: therapistEmail,
        profession: String(body.profession ?? "") as
          | "speech"
          | "occupational"
          | "physical"
          | "cognitive"
          | "other",
        licenseNumber: String(body.licenseNumber ?? ""),
        licenseFileName: String(body.licenseFileName ?? ""),
        licenseFileDataUrl: String(body.licenseFileDataUrl ?? ""),
        licenseIssuedBy: String(body.licenseIssuedBy ?? ""),
        licenseIssuedDate: String(body.licenseIssuedDate ?? ""),
        employmentStatus: String(body.employmentStatus ?? "") as
          | "employed"
          | "contract"
          | "freelance",
        department: String(body.department ?? ""),
        twoFactorMethod: body.twoFactorMethod === "sms" ? "sms" : "otp",
        accessRole: String(body.accessRole ?? "") as "manager" | "therapist" | "observer",
        canViewPatients: Boolean(body.canViewPatients),
        canEditPatientData: Boolean(body.canEditPatientData),
        canEnterEvaluation: Boolean(body.canEnterEvaluation),
        experienceYears:
          body.experienceYears == null || body.experienceYears === ""
            ? undefined
            : Number(body.experienceYears),
        specialties: String(body.specialties ?? ""),
        servicePurpose: String(body.servicePurpose ?? ""),
        targetPatientTypes: String(body.targetPatientTypes ?? ""),
        dataConsentScope: String(body.dataConsentScope ?? ""),
        irbParticipation:
          body.irbParticipation === "planned" || body.irbParticipation === "approved"
            ? body.irbParticipation
            : "none",
        privacyAgreed: Boolean(body.privacyAgreed),
        patientDataAccessAgreed: Boolean(body.patientDataAccessAgreed),
        securityPolicyAgreed: Boolean(body.securityPolicyAgreed),
        confidentialityAgreed: Boolean(body.confidentialityAgreed),
      });

      // 1인 기관 신청 — 레거시 organization_registration_requests 에 저장
      // (이 코드는 기존 그대로)
      if (institutionMode === "solo" && soloInstitution) {
        await createOrganizationRegistrationRequest({
          organizationName: String(soloInstitution.organizationName ?? ""),
          businessNumber: String(soloInstitution.businessNumber ?? ""),
          representativeName: String(soloInstitution.representativeName ?? ""),
          organizationType: String(soloInstitution.organizationType ?? ""),
          businessLicenseFileName: String(soloInstitution.businessLicenseFileName ?? ""),
          businessLicenseFileDataUrl: String(soloInstitution.businessLicenseFileDataUrl ?? ""),
          careInstitutionNumber: String(soloInstitution.careInstitutionNumber ?? ""),
          organizationPhone: String(soloInstitution.organizationPhone ?? ""),
          postalCode: String(soloInstitution.postalCode ?? ""),
          roadAddress: String(soloInstitution.roadAddress ?? ""),
          addressDetail: String(soloInstitution.addressDetail ?? ""),
          contactName: String(body.name ?? ""),
          contactTitle: "대표 치료사",
          contactPhone: therapistPhone,
          contactEmail: therapistEmail,
          adminLoginEmail: therapistEmail,
          adminPassword: String(body.password ?? ""),
          twoFactorMethod: body.twoFactorMethod === "sms" ? "sms" : "otp",
          medicalDepartments: String(body.specialties ?? "") || String(body.profession ?? ""),
          servicePurpose: String(body.servicePurpose ?? ""),
          targetPatients: String(body.targetPatientTypes ?? ""),
          doctorName: String(body.name ?? ""),
          doctorLicenseNumber: String(body.licenseNumber ?? ""),
          irbStatus:
            body.irbParticipation === "planned" || body.irbParticipation === "approved"
              ? body.irbParticipation
              : "not_applicable",
          termsAgreed: true,
          privacyAgreed: Boolean(body.privacyAgreed),
          medicalDataAgreed: Boolean(body.patientDataAccessAgreed),
          contractAgreed: Boolean(body.confidentialityAgreed),
          patientDataAgreed: Boolean(body.patientDataAccessAgreed),
        });
      }
    }

    // ── 이중 쓰기 (기능 플래그 ON 일 때만 동작) ──
    // 레거시 쓰기가 모두 성공한 뒤 신규 스키마로 미러링.
    // 실패해도 레거시 결과는 보호됨 (runMirrorGuarded 가 기본적으로 로그만 남김).
    await runMirrorGuarded("signup", async () => {
      const pool = getDbPool();

      // 레거시 저장된 정보를 읽어 미러 입력 구성
      const userRow = await pool.query(
        `SELECT login_key_hash, password_hash FROM app_users WHERE user_id = $1::uuid LIMIT 1`,
        [created.userId],
      );
      const loginKeyHash = userRow.rows[0]?.login_key_hash
        ? String(userRow.rows[0].login_key_hash)
        : null;
      const passwordHash = userRow.rows[0]?.password_hash
        ? String(userRow.rows[0].password_hash)
        : "";

      const pseudonymId = await getPseudonymIdByLegacyPatientId(created.patientId);

      const mirrorInput: MirrorAccountSignupInput = {
        userId: created.userId,
        legacyPatientId: created.patientId,
        patientPseudonymId: pseudonymId,
        name: String(body.name ?? "").trim(),
        email:
          userRole === "therapist"
            ? therapistEmail
            : `local+${created.userId}@brainfriends.local`,
        phone:
          userRole === "therapist"
            ? therapistPhone
            : String(body.phoneLast4 ?? "").trim() || "0000",
        loginId: String(body.loginId ?? "").trim(),
        passwordHash,
        loginKeyHash,
        accountType:
          userRole === "therapist"
            ? "THERAPIST"
            : userRole === "admin"
              ? "ADMIN"
              : "USER",
        status: userRole === "therapist" ? "PENDING" : "ACTIVE",
        legacyUserRole: userRole,
        birthDate: String(body.birthDate ?? "").trim() || null,
        sex:
          body.gender === "M" || body.gender === "F" ? String(body.gender) : "U",
        language: "ko",
        legacyPatientCode: null,
        therapist:
          userRole === "therapist"
            ? {
                jobType: String(body.profession ?? "other"),
                licenseNumber: String(body.licenseNumber ?? ""),
                licenseFileUrl: String(body.licenseFileName ?? "") || "pending",
                issuedBy: String(body.licenseIssuedBy ?? "") || null,
                issuedDate: String(body.licenseIssuedDate ?? "") || null,
                specialty: String(body.specialties ?? "") || null,
                introduction: null,
              }
            : undefined,
        existingLegacyOrganizationId:
          (userRole === "patient" || userRole === "therapist") &&
          institutionMode === "existing" &&
          body.organizationId
            ? String(body.organizationId)
            : null,
        soloInstitution:
          userRole === "therapist" && institutionMode === "solo" && soloInstitution
            ? {
                name: String(soloInstitution.organizationName ?? ""),
                businessNumber: String(soloInstitution.businessNumber ?? "") || null,
                representativeName:
                  String(soloInstitution.representativeName ?? "") || null,
                institutionType:
                  String(soloInstitution.organizationType ?? "") || null,
                phone: String(soloInstitution.organizationPhone ?? "") || null,
                zipCode: String(soloInstitution.postalCode ?? "") || null,
                address1: String(soloInstitution.roadAddress ?? "") || null,
                address2: String(soloInstitution.addressDetail ?? "") || null,
                businessLicenseFileUrl:
                  String(soloInstitution.businessLicenseFileName ?? "") || null,
              }
            : null,
      };

      await mirrorAccountSignup(mirrorInput);
    });

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_create_account";
    const status =
      message === "invalid_signup_payload"
        ? 400
        : message === "invalid_organization"
          ? 400
        : message === "invalid_therapist"
          ? 400
        : message === "account_already_exists"
          ? 409
        : message === "duplicate_identity"
          ? 409
        : message === "organization_already_exists"
          ? 409
        : message === "invalid_request_payload"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
