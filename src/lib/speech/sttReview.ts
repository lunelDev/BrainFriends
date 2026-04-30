export type SttReviewStatus =
  | "ok"
  | "empty_transcript"
  | "stt_failed"
  | "server_stt_blocked"
  | "review_required";

export type SttReviewOutcome = {
  status: SttReviewStatus;
  reviewRequired: boolean;
  reason: string | null;
};

export function resolveSttReviewOutcome(input: {
  text?: string | null;
  fallback?: boolean | null;
  reason?: string | null;
  responseOk?: boolean;
}): SttReviewOutcome {
  const reason = String(input.reason ?? "").trim() || null;

  if (reason?.startsWith("server_stt_blocked")) {
    return {
      status: "server_stt_blocked",
      reviewRequired: true,
      reason,
    };
  }

  if (input.responseOk === false || input.fallback) {
    return {
      status: "stt_failed",
      reviewRequired: true,
      reason: reason ?? "stt_failed",
    };
  }

  if (!String(input.text ?? "").trim()) {
    return {
      status: "empty_transcript",
      reviewRequired: true,
      reason: reason ?? "empty_transcript",
    };
  }

  return {
    status: "ok",
    reviewRequired: false,
    reason: null,
  };
}

export function toReviewRequiredStatus(status: SttReviewStatus): SttReviewStatus {
  return status === "ok" ? "ok" : "review_required";
}
