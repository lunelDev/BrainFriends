export type CreateOrganizationInput = {
  name: string;
  address: string;
  businessNumber?: string;
  representativeName?: string;
  organizationPhone?: string;
};

export type OrganizationRegistrationRequestRow = {
  id: string;
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationPhone: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export async function reviewOrganizationRequest(input: {
  requestId: string;
  status: "approved" | "rejected";
}) {
  const response = await fetch("/api/admin/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "review",
      requestId: input.requestId,
      status: input.status,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error === "request_already_reviewed"
        ? "이미 처리된 요청입니다."
        : payload?.error === "organization_already_exists"
          ? "이미 등록된 기관입니다."
          : "요청 처리에 실패했습니다.",
    );
  }
  return payload as {
    reviewed: OrganizationRegistrationRequestRow;
    organization?: {
      id: string;
      code: string;
      name: string;
      address: string;
    } | null;
  };
}

export async function createOrganization(input: CreateOrganizationInput) {
  const response = await fetch("/api/admin/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error === "organization_already_exists"
        ? "이미 등록된 기관입니다."
        : "기관 등록에 실패했습니다.",
    );
  }
  return payload.organization as {
    id: string;
    code: string;
    name: string;
    address: string;
  };
}
