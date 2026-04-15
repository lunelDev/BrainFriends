type CreateTherapistInput = {
  loginId: string;
  name: string;
  birthDate: string;
  phoneLast4: string;
  password: string;
};

export async function createTherapistAccount(input: CreateTherapistInput) {
  const response = await fetch("/api/admin/therapists", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; userId?: string; patientId?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "failed_to_create_therapist");
  }

  return payload;
}
