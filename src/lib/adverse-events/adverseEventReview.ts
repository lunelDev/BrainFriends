export type ReviewableAdverseEvent = {
  id: string;
  patientPseudonymId: string;
  category: string;
  severity: number;
  occurredAt: string | Date;
  resolvedAt?: string | Date | null;
  prescriberAcknowledgedAt?: string | Date | null;
};

export type AdverseEventReviewSummary = {
  totalCount: number;
  unresolvedCount: number;
  severeUnacknowledgedCount: number;
  latestOccurredAt: string | null;
  highestSeverity: number;
  requiresPrescriberReview: boolean;
  guardianStatus: "none_reported" | "reported";
};

function time(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const t = date.getTime();
  return Number.isFinite(t) ? t : 0;
}

export function sortAdverseEventsForReview<T extends ReviewableAdverseEvent>(
  events: T[],
): T[] {
  return [...events].sort((left, right) => {
    const delta = time(right.occurredAt) - time(left.occurredAt);
    return delta !== 0 ? delta : String(right.id).localeCompare(String(left.id));
  });
}

export function buildAdverseEventReviewSummary(
  events: ReviewableAdverseEvent[],
): AdverseEventReviewSummary {
  const sorted = sortAdverseEventsForReview(events);
  const unresolved = sorted.filter((event) => !event.resolvedAt);
  const severeUnacknowledged = sorted.filter(
    (event) => Number(event.severity) >= 3 && !event.prescriberAcknowledgedAt,
  );
  const highestSeverity = sorted.reduce(
    (max, event) => Math.max(max, Math.min(3, Math.max(1, Math.floor(Number(event.severity) || 1)))),
    0,
  );

  return {
    totalCount: sorted.length,
    unresolvedCount: unresolved.length,
    severeUnacknowledgedCount: severeUnacknowledged.length,
    latestOccurredAt: sorted[0] ? new Date(sorted[0].occurredAt).toISOString() : null,
    highestSeverity,
    requiresPrescriberReview: severeUnacknowledged.length > 0,
    guardianStatus: sorted.length > 0 ? "reported" : "none_reported",
  };
}
