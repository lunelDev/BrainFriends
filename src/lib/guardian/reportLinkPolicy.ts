export type GuardianReportLinkStatus = "active" | "expired" | "revoked";

export type GuardianReportLinkStatusInput = {
  expiresAt: string | Date;
  revokedAt?: string | Date | null;
  now?: string | Date;
};

function toTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : NaN;
}

export function resolveGuardianReportLinkStatus(
  input: GuardianReportLinkStatusInput,
): GuardianReportLinkStatus {
  if (input.revokedAt) return "revoked";

  const expiresAt = toTime(input.expiresAt);
  const now = toTime(input.now ?? new Date());
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) return "expired";

  return expiresAt > now ? "active" : "expired";
}

export function normalizeGuardianReportTtlDays(value: number | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 14;
  return Math.min(Math.floor(n), 60);
}
