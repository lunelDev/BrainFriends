export interface SecurityAuditEvent {
  eventType:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILURE"
    | "PERMISSION_DENIED"
    | "CLIENT_STORAGE_BLOCKED";
  subjectId?: string;
  detail: string;
  createdAt: string;
}

export async function appendSecurityAuditLog(event: SecurityAuditEvent) {
  if (typeof fetch !== "function") return;

  await fetch("/api/security-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  });
}
