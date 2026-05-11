import type { RequirementId } from "./requirements";

export interface TraceabilityRecord {
  requirementId: RequirementId;
  moduleName: string;
  functionName: string;
  testCaseId: string;
}

export interface RuntimeValidationRecord {
  requirementIds: RequirementId[];
  checkpoint: string;
  status: "pass" | "warn";
  detail: string;
  recordedAt: string;
}

export interface RequirementTraceabilitySummary {
  requirementIds: RequirementId[];
  testCaseIds: string[];
  traceability: TraceabilityRecord[];
}

export const TRACEABILITY_MATRIX: TraceabilityRecord[] = [
  { requirementId: "SR-LOGIN-001", moduleName: "src/app/page.tsx", functionName: "submit / routeAfterAuth", testCaseId: "TC-LOGIN-001" },
  { requirementId: "SR-PERMISSION-002", moduleName: "src/app/page.tsx", functionName: "requestPermissions", testCaseId: "TC-PERM-001" },
  { requirementId: "SR-PERMISSION-002", moduleName: "src/app/page.tsx", functionName: "requestPermissions / cancel flow", testCaseId: "TC-PERM-CANCEL-001" },
  { requirementId: "SR-SESSION-003", moduleName: "src/lib/trainingResume.ts", functionName: "isResumeMetaMatched / saveResumeMeta", testCaseId: "TC-SESS-RESTORE-001" },
  { requirementId: "SR-HISTORY-005", moduleName: "src/lib/kwab/SessionManager.ts", functionName: "saveHistoryEntry / compactHistoryEntryForStorage", testCaseId: "TC-SAVE-FAIL-001" },
  { requirementId: "SR-HISTORY-005", moduleName: "src/lib/client/clinicalResultsApi.ts", functionName: "persist retry handling", testCaseId: "TC-SAVE-RETRY-001" },
  { requirementId: "SR-SESSION-003", moduleName: "src/features/result/utils/resultHelpers.ts", functionName: "server/transient/session fallback resolution", testCaseId: "TC-STEP-FALLBACK-001" },
  { requirementId: "SR-SESSION-003", moduleName: "src/lib/kwab/SessionManager.ts", functionName: "saveSession / loadSession / getResumePath", testCaseId: "TC-SESS-001" },
  { requirementId: "SR-SCORE-004", moduleName: "src/lib/kwab/SessionManager.ts", functionName: "updateKWABScores", testCaseId: "TC-SCORE-001" },
  { requirementId: "SR-HISTORY-005", moduleName: "src/lib/kwab/SessionManager.ts", functionName: "buildHistoryEntry / saveHistoryEntry", testCaseId: "TC-HIST-001" },
  { requirementId: "SR-HISTORY-005", moduleName: "src/app/(result)/result-page/*", functionName: "server-first result refetch reconciliation", testCaseId: "TC-RESULT-REFETCH-001" },
  { requirementId: "SR-MEASURE-006", moduleName: "src/lib/kwab/SessionManager.ts", functionName: "buildHistoryEntry / measurementQuality", testCaseId: "TC-MQ-001" },
  { requirementId: "SR-GAZE-007", moduleName: "src/utils/faceAnalysis.ts", functionName: "calculateGazeMetrics", testCaseId: "TC-GAZE-001" },
  { requirementId: "SR-GAZE-007", moduleName: "src/lib/training/gazeAccumulator.ts", functionName: "GazeAccumulator.record / report", testCaseId: "TC-GAZE-002" },
  { requirementId: "SR-AAC-008", moduleName: "src/lib/aac/intentTemplate.ts", functionName: "buildAacIntentSentence", testCaseId: "TC-AAC-001" },
  { requirementId: "SR-AAC-008", moduleName: "src/lib/aac/trainingIntegration.ts", functionName: "buildAacTrainingMetadata", testCaseId: "TC-AAC-002" },
  { requirementId: "SR-STT-009", moduleName: "src/lib/speech/sttPolicy.ts", functionName: "resolveSttPolicy", testCaseId: "TC-STT-001" },
  { requirementId: "SR-STT-009", moduleName: "src/lib/speech/sttClientPreflight.ts", functionName: "resolveClientSttPreflight", testCaseId: "TC-STT-002" },
  { requirementId: "SR-STT-009", moduleName: "src/lib/speech/sttRuntime.ts", functionName: "resolveSttRuntime", testCaseId: "TC-STT-003" },
  { requirementId: "SR-STT-009", moduleName: "src/lib/speech/wasmSttAdapter.ts", functionName: "isWasmSttAvailable / transcribeWithWasmStt / local fp32 model assets / WASM_STT_ENGINE_VERSION (transformers.js@4.2.0)", testCaseId: "TC-STT-WASM-001" },
  { requirementId: "SR-GUARDIAN-010", moduleName: "src/lib/guardian/weeklyReportSummary.ts", functionName: "buildWeeklyReportSummary", testCaseId: "TC-GUARDIAN-001" },
  { requirementId: "SR-AE-011", moduleName: "src/lib/adverse-events/adverseEventReview.ts", functionName: "buildAdverseEventReviewSummary", testCaseId: "TC-RISK-003" },
  { requirementId: "SR-RISK-012", moduleName: "src/lib/server/riskClassification.ts", functionName: "classifyHazard / scoreToRiskClass / summarizeHazards", testCaseId: "TC-RISK-012-001" },
  { requirementId: "SR-PHI-013", moduleName: "src/lib/server/phiMasking.ts", functionName: "maskPhi / maskPhiObject", testCaseId: "TC-PHI-013-001" },
  { requirementId: "SR-AI-EVAL-014", moduleName: "src/lib/ai/werCalculator.ts", functionName: "calculateWer / aggregateWer / levenshtein", testCaseId: "TC-AI-EVAL-014-001" },
  { requirementId: "SR-AI-EVAL-RUNNER", moduleName: "src/lib/ai/werRunner.ts", functionName: "parseWerCsv / evaluateWerRows / classifyAgeGroup / serializeWerReportJson / serializeWerReportMarkdown", testCaseId: "TC-AI-EVAL-RUNNER-001" },
  { requirementId: "SR-AI-EVAL-RUNNER", moduleName: "scripts/ai-eval-wer-runner.mjs", functionName: "CLI entry / npm run ai-eval:wer", testCaseId: "TC-AI-EVAL-RUNNER-001" },
  { requirementId: "SR-AI-RTF-RUNNER", moduleName: "src/lib/ai/sttBenchmark.ts", functionName: "parseRtfCsv / evaluateRtfRows / classifyRtfAgeGroup / percentile / aggregateLatency / serializeRtfReportJson / serializeRtfReportMarkdown", testCaseId: "TC-AI-RTF-RUNNER-001" },
  { requirementId: "SR-AI-RTF-RUNNER", moduleName: "scripts/ai-eval-rtf-runner.ts", functionName: "CLI entry / npm run ai-eval:rtf", testCaseId: "TC-AI-RTF-RUNNER-001" },
  { requirementId: "SR-WASM-STT-LOADING", moduleName: "src/lib/speech/wasmSttLoadingState.ts", functionName: "startLoading / reportProgress / markReady / markFailed / reset / isLegalTransition / elapsedLoadingMs", testCaseId: "TC-WASM-STT-LOADING-001" },
  { requirementId: "SR-IRT-018", moduleName: "src/lib/adaptive/irt.ts", functionName: "probabilityCorrect / fisherInformation / estimateAbilityEap / pickNextItem / simulateAdaptiveSession", testCaseId: "TC-IRT-001" },
  { requirementId: "SR-ONBOARDING-EXCLUSION", moduleName: "src/lib/onboarding/exclusionCheck.ts", functionName: "evaluateOnboardingExclusion", testCaseId: "TC-ONBOARDING-EXCLUSION-001" },
  { requirementId: "SR-SEC-AUDIT-EXPANSION", moduleName: "src/lib/server/auditExpansion.ts", functionName: "enrichAuditEntry / AUDIT_RETENTION_DAYS", testCaseId: "TC-AUDIT-EXPANSION-001" },
  { requirementId: "SR-GUARDIAN-SENDER", moduleName: "src/lib/server/weeklyReportSender.ts", functionName: "decideSend / executeSendBatch / createWeeklyReportDelivery / summarizeDeliveryRecords", testCaseId: "TC-GUARDIAN-SENDER-001" },
  { requirementId: "SR-GUARDIAN-SENDER", moduleName: "src/lib/server/guardianContactsDb.ts", functionName: "normalizeGuardianContactValue / maskGuardianContact / hashGuardianContact", testCaseId: "TC-GUARDIAN-CONTACT-001" },
  { requirementId: "SR-CONSENT-015", moduleName: "src/lib/server/guardianContactsDb.ts", functionName: "upsertGuardianContact / revokeGuardianContactConsent / getGrantedGuardianContactForPatient", testCaseId: "TC-GUARDIAN-CONTACT-001" },
  { requirementId: "SR-PHI-013", moduleName: "src/lib/server/guardianContactsDb.ts", functionName: "maskGuardianName / maskGuardianContact / hashGuardianContact", testCaseId: "TC-GUARDIAN-CONTACT-001" },
  { requirementId: "SR-IRT-ITEMBANK", moduleName: "src/lib/adaptive/itemBank.ts", functionName: "getItemBankForStep / STEP1/2/4_BANK", testCaseId: "TC-IRT-ITEMBANK-001" },
  { requirementId: "SR-CONSENT-015", moduleName: "src/lib/guardian/consentState.ts", functionName: "evaluateGuardianConsent / isLegalTransition", testCaseId: "TC-CONSENT-015-001" },
  { requirementId: "SR-CHANGE-016", moduleName: "src/lib/server/changeImpactAnalysis.ts", functionName: "diffManifestComponents / analyzeChangeImpact", testCaseId: "TC-CHANGE-016-001" },
  { requirementId: "SR-CHANGE-016", moduleName: "src/lib/server/releaseChangeDossier.ts", functionName: "buildReleaseChangeDossier / serialize JSON MD CSV", testCaseId: "TC-CHANGE-DOSSIER-001" },
  { requirementId: "SR-SEC-SI04-MANIFEST", moduleName: "src/lib/server/releaseChangeDossier.ts", functionName: "manifest delta anomaly retest impact export", testCaseId: "TC-CHANGE-DOSSIER-001" },
  { requirementId: "SR-IEC62304-EXPORT", moduleName: "src/lib/vnv/iec62304Export.ts", functionName: "buildIec62304TraceabilityMatrix / serialize MD / serialize CSV", testCaseId: "TC-IEC62304-001" },
  { requirementId: "SR-IEC62304-EXPORT", moduleName: "src/app/api/therapist/system/iec62304-traceability/route.ts", functionName: "GET (format=json|md|csv)", testCaseId: "TC-IEC62304-001" },
  { requirementId: "SR-USABILITY-017", moduleName: "src/lib/usability/useScenarioValidator.ts", functionName: "normalizeScenarios / buildTaskCompletionStats / bucketUseErrors / buildHazardCoverage / evaluateSummativeUsability", testCaseId: "TC-USABILITY-001" },
  { requirementId: "SR-SEC-IA05", moduleName: "src/lib/server/accountAuth.ts", functionName: "validatePasswordStrength", testCaseId: "TC-SEC-IA05-001" },
  { requirementId: "SR-SEC-IA07", moduleName: "src/lib/server/loginLockout.ts", functionName: "evaluateLoginAttempt", testCaseId: "TC-SEC-IA07-001" },
  { requirementId: "SR-SEC-UC03", moduleName: "src/lib/server/sessionLockout.ts", functionName: "evaluateSessionIdle", testCaseId: "TC-SEC-UC03-001" },
  { requirementId: "SR-SEC-RA01", moduleName: "src/lib/server/rateLimit.ts", functionName: "evaluateRateLimit", testCaseId: "TC-SEC-RA01-001" },
  { requirementId: "SR-SEC-UC07", moduleName: "src/lib/server/auditChain.ts", functionName: "appendAuditEntry / verifyAuditChain", testCaseId: "TC-SEC-UC07-001" },
  { requirementId: "SR-SEC-TRE01", moduleName: "src/lib/server/auditChain.ts", functionName: "verifyAuditChain time monotonicity", testCaseId: "TC-SEC-TRE01-001" },
  { requirementId: "SR-SEC-SI07", moduleName: "src/lib/server/errorCodes.ts", functionName: "resolveErrorResponse / listKnownErrorCodes", testCaseId: "TC-SEC-SI07-001" },
  { requirementId: "SR-SEC-SI05", moduleName: "src/lib/server/inputSchemas.ts", functionName: "validateInput / Schemas", testCaseId: "TC-SEC-SI05-001" },
  { requirementId: "SR-SEC-SI04-SOUP", moduleName: "src/lib/server/soupRegistry.ts", functionName: "buildSoupList / normalizeSoupEntry / summarizeSoupList", testCaseId: "TC-SEC-SI04-SOUP-001" },
  { requirementId: "SR-SEC-SI04-MANIFEST", moduleName: "src/lib/server/releaseManifest.ts", functionName: "buildManifest / verifyManifest / serializeManifest", testCaseId: "TC-SEC-SI04-MANIFEST-001" },
  { requirementId: "SR-SEC-SI04-MANIFEST", moduleName: "src/lib/server/releaseManifestStartup.ts", functionName: "evaluateStartupCheck", testCaseId: "TC-SEC-SI04-MANIFEST-001" },
];

export function getTraceabilityForRequirement(requirementId: RequirementId) {
  return TRACEABILITY_MATRIX.filter((row) => row.requirementId === requirementId);
}

export function buildRequirementTraceabilitySummary(requirementIds: RequirementId[]): RequirementTraceabilitySummary {
  const uniqueRequirementIds = Array.from(new Set(requirementIds));
  const traceability = uniqueRequirementIds.flatMap((requirementId) => getTraceabilityForRequirement(requirementId));
  const testCaseIds = Array.from(new Set(traceability.map((row) => row.testCaseId)));
  return {
    requirementIds: uniqueRequirementIds,
    testCaseIds,
    traceability,
  };
}
