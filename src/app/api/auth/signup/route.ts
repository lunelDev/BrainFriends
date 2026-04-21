import { NextResponse } from "next/server";
import { createAccount } from "@/lib/server/accountAuth";
import { upsertTherapistRegistrationProfile } from "@/lib/server/therapistRegistrationProfiles";
import { createOrganizationRegistrationRequest } from "@/lib/server/organizationRegistrationRequests";

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
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
