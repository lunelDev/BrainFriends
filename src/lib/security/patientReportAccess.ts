export type PatientReportAccessRole = "admin" | "therapist" | "patient" | "prescriber" | string;

export type PatientReportAccessDecision = {
  allowed: boolean;
  reason:
    | "admin_all_patients"
    | "assigned_therapist"
    | "self_patient"
    | "unassigned_therapist"
    | "patient_mismatch"
    | "role_not_allowed";
};

export function resolvePatientReportAccess(input: {
  userRole: PatientReportAccessRole;
  targetPatientId: string;
  assignedPatientIds?: string[] | null;
  selfPatientId?: string | null;
  allowPatientSelfAccess?: boolean;
}): PatientReportAccessDecision {
  const targetPatientId = String(input.targetPatientId ?? "").trim();
  if (input.userRole === "admin") {
    return { allowed: true, reason: "admin_all_patients" };
  }

  if (input.userRole === "therapist") {
    const assigned = new Set(
      (input.assignedPatientIds ?? [])
        .map((patientId) => String(patientId).trim())
        .filter(Boolean),
    );
    return assigned.has(targetPatientId)
      ? { allowed: true, reason: "assigned_therapist" }
      : { allowed: false, reason: "unassigned_therapist" };
  }

  if (input.userRole === "patient" && input.allowPatientSelfAccess) {
    return String(input.selfPatientId ?? "").trim() === targetPatientId
      ? { allowed: true, reason: "self_patient" }
      : { allowed: false, reason: "patient_mismatch" };
  }

  return { allowed: false, reason: "role_not_allowed" };
}
