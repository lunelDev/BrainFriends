import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { PatientProfile } from "@/lib/patientStorage";
import {
  saveSingResultToDatabase,
  type PersistedSingResult,
} from "@/lib/server/singResultsDb";
import { AUTH_COOKIE_NAME } from "@/lib/server/accountAuth";
import {
  appendClinicalAuditLog,
  buildSingTrainingAuditLog,
} from "@/lib/server/auditLog";
import { recordTrainingUsageEvent } from "@/lib/server/trainingUsageEventsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  patient?: PatientProfile | null;
  result?: PersistedSingResult | null;
};

function isValidPatient(
  patient: PatientProfile | null | undefined,
): patient is PatientProfile {
  return Boolean(patient?.name?.trim() && patient?.gender && patient?.age);
}

function isValidResult(
  result: PersistedSingResult | null | undefined,
): result is PersistedSingResult {
  return Boolean(
    result?.song && Number.isFinite(Number(result?.score)) && result?.completedAt,
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!isValidPatient(body.patient)) {
    await appendClinicalAuditLog(
      buildSingTrainingAuditLog({
        request: req,
        patient: body.patient ?? null,
        status: "rejected",
        result: body.result
          ? {
              song: body.result.song,
              score: Number(body.result.score),
              finalJitter: body.result.finalJitter,
              finalSi: body.result.finalSi,
              rtLatency: body.result.rtLatency,
              reviewAudioUrl: undefined,
              versionSnapshot: body.result.versionSnapshot,
            }
          : null,
        failureReason: "invalid_patient_payload",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );
    return NextResponse.json(
      { ok: false, error: "invalid_patient_payload" },
      { status: 400 },
    );
  }

  if (!isValidResult(body.result)) {
    await appendClinicalAuditLog(
      buildSingTrainingAuditLog({
        request: req,
        patient: body.patient,
        status: "rejected",
        result: null,
        failureReason: "invalid_result_payload",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );
    return NextResponse.json(
      { ok: false, error: "invalid_result_payload" },
      { status: 400 },
    );
  }

  if (body.result.metricSource !== "measured") {
    await appendClinicalAuditLog(
      buildSingTrainingAuditLog({
        request: req,
        patient: body.patient,
        status: "skipped",
        result: {
          song: body.result.song,
          score: body.result.score,
          finalJitter: body.result.finalJitter,
          finalSi: body.result.finalSi,
          rtLatency: body.result.rtLatency,
          reviewAudioUrl: undefined,
          versionSnapshot: body.result.versionSnapshot,
        },
        failureReason: "demo_metric_source_not_persisted",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "demo_metric_source_not_persisted",
      },
      { status: 200 },
    );
  }

  try {
    const saved = await saveSingResultToDatabase({
      patient: body.patient,
      result: body.result,
    });

    if (sessionToken) {
      await recordTrainingUsageEvent(sessionToken, {
        eventType: "sing_result_persisted",
        trainingType: "sing-training",
        pagePath: "/result-page/sing-training",
        sessionId: saved.sessionId,
        payload: {
          song: body.result.song,
          score: body.result.score,
          resultId: saved.resultId,
        },
      }).catch(() => undefined);
    }

    await appendClinicalAuditLog(
      buildSingTrainingAuditLog({
        request: req,
        patient: body.patient,
        sessionId: saved.sessionId,
        status: "success",
        result: {
          song: body.result.song,
          score: body.result.score,
          finalJitter: body.result.finalJitter,
          finalSi: body.result.finalSi,
          rtLatency: body.result.rtLatency,
          reviewAudioUrl: undefined,
          versionSnapshot: body.result.versionSnapshot,
        },
        storageTargets: [
          "postgres:patient_pii",
          "postgres:patient_pseudonym_map",
          "postgres:clinical_sessions",
          "postgres:sing_results",
          "data/audit/clinical-events.ndjson",
        ],
      }),
    );

    return NextResponse.json({ ok: true, saved, ranking: saved.ranking });
  } catch (error: any) {
    console.error("[sing-results] failed to persist", error);
    if (error?.message === "missing_database_url") {
      await appendClinicalAuditLog(
        buildSingTrainingAuditLog({
          request: req,
          patient: body.patient,
          sessionId: body.patient.sessionId,
          status: "skipped",
          result: {
            song: body.result.song,
            score: body.result.score,
            finalJitter: body.result.finalJitter,
            finalSi: body.result.finalSi,
            rtLatency: body.result.rtLatency,
            reviewAudioUrl: undefined,
            versionSnapshot: body.result.versionSnapshot,
          },
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
      buildSingTrainingAuditLog({
        request: req,
        patient: body.patient,
        sessionId: body.patient.sessionId,
        status: "failed",
        result: {
          song: body.result.song,
          score: body.result.score,
          finalJitter: body.result.finalJitter,
          finalSi: body.result.finalSi,
          rtLatency: body.result.rtLatency,
          reviewAudioUrl: undefined,
          versionSnapshot: body.result.versionSnapshot,
        },
        failureReason: error?.message || "failed_to_persist_sing_result",
        storageTargets: ["data/audit/clinical-events.ndjson"],
      }),
    );

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "failed_to_persist_sing_result",
      },
      { status: 500 },
    );
  }
}

