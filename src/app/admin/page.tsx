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

export default async function AdminPage() {
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

  const [patients, organizations, therapists, validationSampleEntries, organizationRequests] = await Promise.all([
    listAdminPatientReportSummaries(token!),
    listAvailableOrganizations(),
    listTherapistColleagueSummaries(token!),
    listAdminReportValidationSample(token!),
    listOrganizationRegistrationRequests(),
  ]);

  return (
    <AdminConsoleClient
      adminName={context.patient.name || "관리자"}
      organizations={organizations}
      organizationRequests={organizationRequests}
      patients={patients}
      therapists={therapists}
      validationSampleEntries={validationSampleEntries}
    />
  );
}
