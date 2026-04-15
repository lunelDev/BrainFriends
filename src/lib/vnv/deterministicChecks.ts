import type {
  MeasurementQualityLevel,
  MeasurementQualitySnapshot,
  TrainingHistoryEntry,
  TrainingMode,
} from "@/lib/kwab/SessionManager";

export function deriveStepMeasurementQuality(
  stepDetails: TrainingHistoryEntry["stepDetails"],
  stepNo: 1 | 2 | 3 | 4 | 5 | 6,
): MeasurementQualityLevel {
  const rows = stepDetails[`step${stepNo}` as keyof typeof stepDetails] as any[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return "demo";
  }

  if (stepNo === 2 || stepNo === 5) {
    const measuredCount = rows.filter((row) => row?.dataSource === "measured").length;
    const demoCount = rows.filter((row) => row?.dataSource === "demo").length;
    if (measuredCount === rows.length) return "measured";
    if (demoCount === rows.length) return "demo";
    return measuredCount > 0 ? "partial" : "demo";
  }

  if (stepNo === 4) {
    const transcriptCount = rows.filter(
      (row) =>
        String(row?.transcript ?? "").trim().length > 0 &&
        String(row?.transcript ?? "").trim() !== "시연용 기본 응답입니다.",
    ).length;
    return transcriptCount > 0 ? "measured" : "demo";
  }

  if (stepNo === 6) {
    const imageCount = rows.filter(
      (row) => String(row?.userImage ?? "").trim().length > 0,
    ).length;
    return imageCount > 0 ? "measured" : "demo";
  }

  if (stepNo === 1) {
    const answeredCount = rows.filter(
      (row) => row?.userAnswer !== null && row?.userAnswer !== undefined,
    ).length;
    if (answeredCount === rows.length) return "measured";
    if (answeredCount > 0) return "partial";
    return "demo";
  }

  if (stepNo === 3) {
    const evaluatedCount = rows.filter((row) => row?.isCorrect !== undefined).length;
    if (evaluatedCount === rows.length) return "measured";
    if (evaluatedCount > 0) return "partial";
    return "demo";
  }

  return "demo";
}

export function buildMeasurementQualitySnapshot(params: {
  stepDetails: TrainingHistoryEntry["stepDetails"];
  mode?: TrainingMode;
  rehabStep?: number;
}): MeasurementQualitySnapshot {
  const { stepDetails, mode = "self", rehabStep } = params;
  const normalizedRehabStep =
    mode === "rehab" && Number.isFinite(Number(rehabStep))
      ? Math.max(1, Math.min(6, Number(rehabStep)))
      : undefined;

  const steps = {
    step1: deriveStepMeasurementQuality(stepDetails, 1),
    step2: deriveStepMeasurementQuality(stepDetails, 2),
    step3: deriveStepMeasurementQuality(stepDetails, 3),
    step4: deriveStepMeasurementQuality(stepDetails, 4),
    step5: deriveStepMeasurementQuality(stepDetails, 5),
    step6: deriveStepMeasurementQuality(stepDetails, 6),
  };

  const activeQualities =
    mode === "rehab" && normalizedRehabStep
      ? [steps[`step${normalizedRehabStep}` as keyof typeof steps]]
      : Object.values(steps);

  const overall: MeasurementQualityLevel = activeQualities.every(
    (level) => level === "measured",
  )
    ? "measured"
    : activeQualities.some((level) => level === "measured" || level === "partial")
      ? "partial"
      : "demo";

  return {
    steps,
    overall,
    notes: [
      `overall=${overall}`,
      ...Object.entries(steps).map(([key, value]) => `${key}=${value}`),
    ],
  };
}

export function mergeHistoryEntriesForStorage(
  existing: TrainingHistoryEntry[],
  entry: TrainingHistoryEntry,
) {
  return existing
    .filter((row) => row.sessionId !== entry.sessionId)
    .concat(entry)
    .sort((a, b) => a.completedAt - b.completedAt)
    .slice(-50);
}

export function compactHistoryEntryForStorage(row: TrainingHistoryEntry) {
  const compactItems = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      audioUrl: undefined,
      userImage: undefined,
      cameraFrameImage: undefined,
      cameraFrameFrames: undefined,
      imageData: undefined,
    }));

  return {
    ...row,
    stepDetails: row.stepDetails
      ? {
          ...row.stepDetails,
          step1: compactItems(row.stepDetails.step1),
          step2: compactItems(row.stepDetails.step2),
          step3: compactItems(row.stepDetails.step3),
          step4: compactItems(row.stepDetails.step4),
          step5: compactItems(row.stepDetails.step5),
          step6: compactItems(row.stepDetails.step6),
        }
      : row.stepDetails,
  };
}

export function resolveRouteAfterAuth(params: {
  userRole?: "patient" | "admin" | "therapist";
}) {
  return params.userRole === "therapist" ? "/therapist" : "permission_required";
}

export function resolvePostPermissionRoute(params: {
  userRole?: "patient" | "admin" | "therapist";
  hasSelfDiagnosisHistory: boolean;
}) {
  const { userRole, hasSelfDiagnosisHistory } = params;
  if (userRole === "therapist") return "/therapist";
  if (userRole === "admin") return "/select-page/mode";
  return hasSelfDiagnosisHistory
    ? "/select-page/mode"
    : "/programs/step-1?place=home";
}

export function resolvePermissionDeniedOutcome(params: {
  userRole?: "patient" | "admin" | "therapist";
}) {
  return {
    allowed: false,
    nextRoute: "permission_required",
    userRole: params.userRole ?? "patient",
    reason: "camera_or_microphone_denied",
  } as const;
}

export function resolvePermissionCancelledOutcome(params: {
  userRole?: "patient" | "admin" | "therapist";
  completedScopes?: Array<"camera" | "microphone">;
}) {
  return {
    allowed: false,
    nextRoute: "permission_required",
    userRole: params.userRole ?? "patient",
    completedScopes: params.completedScopes ?? [],
    reason: "permission_flow_cancelled",
  } as const;
}

export function buildHistorySaveFailureOutcome(params: {
  quotaExceeded?: boolean;
  storageWritable?: boolean;
}) {
  const quotaExceeded = Boolean(params.quotaExceeded);
  const storageWritable = params.storageWritable !== false;

  if (quotaExceeded && storageWritable) {
    return {
      retryable: true,
      fallbackStorage: "compact_history",
      needsRetry: true,
      severity: "warn",
      message: "quota exceeded, compact history fallback requested",
    } as const;
  }

  if (!storageWritable) {
    return {
      retryable: true,
      fallbackStorage: "server_only",
      needsRetry: true,
      severity: "error",
      message: "browser storage unavailable, persist on server only",
    } as const;
  }

  return {
    retryable: false,
    fallbackStorage: "none",
    needsRetry: false,
    severity: "info",
    message: "save completed without fallback",
  } as const;
}

export function buildServerSaveRetryOutcome(params: {
  serverSaved: boolean;
  retryCount: number;
  maxRetries?: number;
}) {
  const maxRetries = Math.max(1, Number(params.maxRetries ?? 3));
  const retryCount = Math.max(0, Number(params.retryCount ?? 0));

  if (params.serverSaved) {
    return {
      retryScheduled: false,
      finalState: "saved",
      retryCount,
      nextAction: "none",
    } as const;
  }

  const canRetry = retryCount < maxRetries;
  return {
    retryScheduled: canRetry,
    finalState: canRetry ? "retry_pending" : "failed",
    retryCount,
    nextAction: canRetry ? "server_retry" : "manual_review",
  } as const;
}

export function resolveSessionRestoreState(params: {
  signatureMatched: boolean;
  savedCount: number;
  totalQuestions: number;
}) {
  const totalQuestions = Math.max(1, Number(params.totalQuestions || 0));
  const savedCount = Math.max(0, Math.min(totalQuestions, Number(params.savedCount || 0)));

  if (!params.signatureMatched) {
    return {
      restored: false,
      source: "none",
      resumeIndex: 0,
      restoredCount: 0,
    } as const;
  }

  return {
    restored: savedCount > 0,
    source: "transient",
    resumeIndex: Math.min(savedCount, totalQuestions - 1),
    restoredCount: savedCount,
  } as const;
}

export function resolveStepFallbackSource(params: {
  serverResultAvailable: boolean;
  transientResultAvailable: boolean;
  sessionSummaryAvailable: boolean;
  legacyLocalAvailable: boolean;
}) {
  if (params.serverResultAvailable) return "server";
  if (params.transientResultAvailable) return "transient";
  if (params.sessionSummaryAvailable) return "session_summary";
  if (params.legacyLocalAvailable) return "legacy_local";
  return "none";
}

export function resolveResultRefetchMismatchOutcome(params: {
  serverHistoryId: string;
  localHistoryId: string | null;
  serverAq: number;
  localAq: number | null;
}) {
  const mismatchDetected =
    params.localHistoryId !== null &&
    (params.serverHistoryId !== params.localHistoryId ||
      params.localAq !== params.serverAq);

  return {
    mismatchDetected,
    canonicalSource: "server" as const,
    selectedHistoryId: params.serverHistoryId,
    selectedAq: params.serverAq,
    reviewRequired: mismatchDetected,
  };
}
