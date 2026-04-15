export interface PatientBootstrap {
  patientId: string;
  role: "admin" | "patient" | "therapist";
  displayName: string;
}

type SourcePatient = {
  id?: string | number | null;
  name?: string | null;
  userRole?: string | null;
};

export function redactPatientForClient(
  patient: SourcePatient | null | undefined,
): PatientBootstrap {
  return {
    patientId: String(patient?.id ?? ""),
    role:
      patient?.userRole === "admin"
        ? "admin"
        : patient?.userRole === "therapist"
          ? "therapist"
          : "patient",
    displayName: String(patient?.name ?? "사용자"),
  };
}
