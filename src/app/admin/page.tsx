import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  listAdminPatientReportSummaries,
  listAdminReportValidationSample,
} from "@/lib/server/adminReportsDb";
import { listAvailableOrganizations } from "@/lib/server/organizationCatalogDb";
import { listTherapistColleagueSummaries } from "@/lib/server/therapistReportsDb";
import { listOrganizationRegistrationRequests } from "@/lib/server/organizationRegistrationRequests";
import { AdminConsoleClient } from "./_components/AdminConsoleClient";

const ALLOWED_SECTIONS = new Set([
  "samd",
  "dashboard",
  "members",
  "organizations",
  "therapists",
] as const);

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const context = token
    ? await getAuthenticatedSessionContext(token).catch(() => null)
    : null;

  if (!context) {
    redirect("/");
  }

  if (context.userRole === "therapist") {
    redirect("/therapist");
  }

  if (context.userRole !== "admin") {
    redirect("/select-page/mode");
  }

  const [
    patients,
    organizations,
    therapists,
    validationSampleEntries,
    organizationRequests,
  ] = await Promise.all([
    listAdminPatientReportSummaries(token!),
    listAvailableOrganizations(),
    listTherapistColleagueSummaries(token!),
    listAdminReportValidationSample(token!),
    listOrganizationRegistrationRequests(),
  ]);

  const visibleOrganizationRequests = organizationRequests.filter(
    (item) => item.status !== "approved",
  );
  const initialSection =
    resolvedSearchParams?.section && ALLOWED_SECTIONS.has(resolvedSearchParams.section as never)
      ? (resolvedSearchParams.section as "samd" | "dashboard" | "members" | "organizations" | "therapists")
      : "members";

  return (
    <AdminConsoleClient
      adminName={context.patient.name || "관리자"}
      initialSection={initialSection}
      organizations={organizations}
      organizationRequests={visibleOrganizationRequests}
      patients={patients}
      therapists={therapists}
      validationSampleEntries={validationSampleEntries}
    />
  );
}
