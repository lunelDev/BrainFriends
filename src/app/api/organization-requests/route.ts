import { NextResponse } from "next/server";
import { createOrganizationRegistrationRequest } from "@/lib/server/organizationRegistrationRequests";
import { findOrganizationDuplicate } from "@/lib/server/organizationCatalogDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        organizationName?: string;
        businessNumber?: string;
        representativeName?: string;
        organizationType?: string;
        openedDate?: string;
        businessLicenseFileName?: string;
        businessLicenseFileDataUrl?: string;
        careInstitutionNumber?: string;
        medicalInstitutionCode?: string;
        medicalDepartments?: string;
        bedCount?: number;
        organizationPhone?: string;
        postalCode?: string;
        roadAddress?: string;
        addressDetail?: string;
        contactName?: string;
        contactTitle?: string;
        contactPhone?: string;
        contactEmail?: string;
        adminLoginEmail?: string;
        adminPassword?: string;
        twoFactorMethod?: "otp" | "sms";
        billingEmail?: string;
        bankName?: string;
        bankAccountNumber?: string;
        bankAccountHolder?: string;
        servicePurpose?: string;
        targetPatients?: string;
        doctorName?: string;
        doctorLicenseNumber?: string;
        irbStatus?: "not_applicable" | "planned" | "approved";
        termsAgreed?: boolean;
        privacyAgreed?: boolean;
        medicalDataAgreed?: boolean;
        contractAgreed?: boolean;
        patientDataAgreed?: boolean;
      }
    | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    // 중복 가드: 같은 이름/사업자번호/요양기관번호의 기관이 이미 승인(manual) 또는
    // 대기(request pending) 상태라면 거부. 1인 기업 가입 경로(/api/auth/signup)와
    // 동일한 규칙을 적용해 저장소 일관성 유지.
    const duplicate = await findOrganizationDuplicate({
      name: String(body.organizationName ?? ""),
      businessNumber: String(body.businessNumber ?? ""),
      careInstitutionNumber: String(body.careInstitutionNumber ?? ""),
    });
    if (duplicate) {
      throw new Error("organization_already_exists");
    }

    const request = await createOrganizationRegistrationRequest({
      organizationName: body.organizationName ?? "",
      businessNumber: body.businessNumber ?? "",
      representativeName: body.representativeName ?? "",
      organizationType: body.organizationType ?? "",
      openedDate: body.openedDate ?? "",
      businessLicenseFileName: body.businessLicenseFileName ?? "",
      businessLicenseFileDataUrl: body.businessLicenseFileDataUrl ?? "",
      careInstitutionNumber: body.careInstitutionNumber ?? "",
      medicalInstitutionCode: body.medicalInstitutionCode ?? "",
      medicalDepartments: body.medicalDepartments ?? "",
      bedCount: body.bedCount,
      organizationPhone: body.organizationPhone ?? "",
      postalCode: body.postalCode ?? "",
      roadAddress: body.roadAddress ?? "",
      addressDetail: body.addressDetail ?? "",
      contactName: body.contactName ?? "",
      contactTitle: body.contactTitle ?? "",
      contactPhone: body.contactPhone ?? "",
      contactEmail: body.contactEmail ?? "",
      adminLoginEmail: body.adminLoginEmail ?? "",
      adminPassword: body.adminPassword ?? "",
      twoFactorMethod: body.twoFactorMethod === "sms" ? "sms" : "otp",
      billingEmail: body.billingEmail ?? "",
      bankName: body.bankName ?? "",
      bankAccountNumber: body.bankAccountNumber ?? "",
      bankAccountHolder: body.bankAccountHolder ?? "",
      servicePurpose: body.servicePurpose ?? "",
      targetPatients: body.targetPatients ?? "",
      doctorName: body.doctorName ?? "",
      doctorLicenseNumber: body.doctorLicenseNumber ?? "",
      irbStatus: body.irbStatus ?? "not_applicable",
      termsAgreed: Boolean(body.termsAgreed),
      privacyAgreed: Boolean(body.privacyAgreed),
      medicalDataAgreed: Boolean(body.medicalDataAgreed),
      contractAgreed: Boolean(body.contractAgreed),
      patientDataAgreed: Boolean(body.patientDataAgreed),
    });
    return NextResponse.json({ ok: true, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_create_request";
    const status =
      message === "invalid_request_payload"
        ? 400
        : message === "organization_already_exists"
          ? 409
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
