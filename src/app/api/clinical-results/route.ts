import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { PatientProfile } from "@/lib/patientStorage";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { saveTrainingHistoryToDatabase } from "@/lib/server/clinicalResultsDb";
import { AUTH_COOKIE_NAME } from "@/lib/server/accountAuth";
import {
  appendClinicalAuditLog,
  buildTrainingHistoryAuditLog,
} from "@/lib/server/auditLog";
import { recordTrainingUsageEvent } from "@/lib/server/trainingUsageEventsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  patient?: PatientProfile | null;
  historyEntry?: TrainingHistoryEntry | null;
};

function isValidPatient(
  patient: PatientProfile | null | undefined,
): patient is PatientProfile {
  return Boolean(patient?.name?.trim() && patient?.gender && patient?.age);
}

function isValidHistoryEntry(
  entry: TrainingHistoryEntry | null | undefined,
): entry is TrainingHistoryEntry {
  return Boolean(
    entry?.historyId &&
      entry?.sessionId &&
      Number.isFinite(Number(entry?.completedAt)) &&
      Number.isFinite(Number(entry?.aq)),
  );
}

function shouldPersistHistoryEntry(entry: TrainingHistoryEntry) {
  return entry.measurementQuality?.overall === "measured";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!isValidPatient(body.patient)) {
    await appendClinicalAuditLog(
      buildTrainingHistoryAuditLog({
        request: req,
        patient: body.patient ?? null,
        status: "rejected",
        historyEntry: body.historyEntry ?? null,
        failureReason: "invalid_patient_payload",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );

    return NextResponse.json(
      { ok: false, error: "invalid_patient_payload" },
      { status: 400 },
    );
  }

  if (!isValidHistoryEntry(body.historyEntry)) {
    await appendClinicalAuditLog(
      buildTrainingHistoryAuditLog({
        request: req,
        patient: body.patient,
        status: "rejected",
        historyEntry: null,
        failureReason: "invalid_history_entry_payload",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );

    return NextResponse.json(
      { ok: false, error: "invalid_history_entry_payload" },
      { status: 400 },
    );
  }

  if (!shouldPersistHistoryEntry(body.historyEntry)) {
    await appendClinicalAuditLog(
      buildTrainingHistoryAuditLog({
        request: req,
        patient: body.patient,
        sessionId: body.patient.sessionId,
        status: "skipped",
        historyEntry: body.historyEntry,
        failureReason: "non_measured_result_not_persisted",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );

    if (sessionToken) {
      await recordTrainingUsageEvent(sessionToken, {
        eventType: "clinical_result_skipped",
        eventStatus: "skipped",
        trainingType:
          body.historyEntry.trainingMode === "rehab"
            ? "speech-rehab"
            : "self-assessment",
        stepNo: body.historyEntry.rehabStep ?? null,
        pagePath:
          body.historyEntry.trainingMode === "rehab"
            ? "/result-page/speech-rehab"
            : "/result-page/self-assessment",
        sessionId: body.historyEntry.sessionId,
        payload: {
          historyId: body.historyEntry.historyId,
          measurementQuality: body.historyEntry.measurementQuality?.overall ?? null,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "non_measured_result_not_persisted",
      },
      { status: 200 },
    );
  }

  try {
    const saved = await saveTrainingHistoryToDatabase({
      patient: body.patient,
      historyEntry: body.historyEntry,
    });

    if (sessionToken) {
      await recordTrainingUsageEvent(sessionToken, {
        eventType: "clinical_result_persisted",
        trainingType:
          body.historyEntry.trainingMode === "rehab"
            ? "speech-rehab"
            : "self-assessment",
        stepNo: body.historyEntry.rehabStep ?? null,
        pagePath:
          body.historyEntry.trainingMode === "rehab"
            ? "/result-page/speech-rehab"
            : "/result-page/self-assessment",
        sessionId: saved.sessionId,
        payload: {
          historyId: body.historyEntry.historyId,
          resultId: saved.resultId,
          aq: body.historyEntry.aq,
        },
      }).catch(() => undefined);
    }

    await appendClinicalAuditLog(
      buildTrainingHistoryAuditLog({
        request: req,
        patient: body.patient,
        sessionId: saved.sessionId,
        status: "success",
        historyEntry: body.historyEntry,
        storageTargets: [
          "postgres:patient_pii",
          "postgres:patient_pseudonym_map",
          "postgres:clinical_sessions",
          "postgres:language_training_results",
          "data/audit/clinical-events.ndjson",
        ],
      }),
    );

    return NextResponse.json({ ok: true, saved });
  } catch (error: any) {
    console.error("[clinical-results] failed to persist", error);

    if (error?.message === "missing_database_url") {
      await appendClinicalAuditLog(
        buildTrainingHistoryAuditLog({
          request: req,
          patient: body.patient,
          sessionId: body.patient.sessionId,
          status: "skipped",
          historyEntry: body.historyEntry,
          failureReason: "missing_database_url",
          storageTargets: ["data/audit/clinical-events.ndjson"],
        }),
      );

      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: "missing_database_url",
        },
        { status: 200 },
      );
    }

    await appendClinicalAuditLog(
      buildTrainingHistoryAuditLog({
        request: req,
        patient: body.patient,
        sessionId: body.patient.sessionId,
        status: "failed",
        historyEntry: body.historyEntry,
        failureReason: error?.message || "failed_to_persist_clinical_result",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "failed_to_persist_clinical_result",
      },
      { status: 500 },
    );
  }
}
