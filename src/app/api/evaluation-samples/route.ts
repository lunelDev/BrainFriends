import { NextResponse } from "next/server";
import type { SpeechFaceMeasurement } from "@/lib/ai/measurementTypes";
import type { ModelGovernanceRecord } from "@/lib/ai/modelGovernance";
import {
  appendEvaluationSamplesToFile,
  saveEvaluationSamplesToDatabase,
} from "@/lib/server/evaluationSamplesDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  historyId?: string;
  sessionId?: string;
  samples?: SpeechFaceMeasurement[];
  governance?: ModelGovernanceRecord | null;
};

function isValidSample(sample: SpeechFaceMeasurement) {
  return Boolean(
    sample.historyId &&
      sample.sessionId &&
      sample.patientId &&
      sample.quality === "measured" &&
      sample.transcript.trim().length > 0,
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const samples = Array.isArray(body.samples)
    ? body.samples.filter(isValidSample)
    : [];

  if (!body.historyId || !body.sessionId || samples.length === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_evaluation_sample_payload" },
      { status: 400 },
    );
  }

  try {
    const saved = await saveEvaluationSamplesToDatabase({
      historyId: body.historyId,
      sessionId: body.sessionId,
      samples,
      governance: body.governance ?? null,
    });

    return NextResponse.json({
      ok: true,
      accepted: saved.accepted,
      storageTarget: saved.storageTarget,
    });
  } catch (dbError) {
    console.warn("[evaluation-samples] database save failed; falling back to file", dbError);

    const saved = await appendEvaluationSamplesToFile({
      historyId: body.historyId,
      sessionId: body.sessionId,
      samples,
      governance: body.governance ?? null,
    });

    return NextResponse.json({
      ok: true,
      accepted: saved.accepted,
      storageTarget: saved.storageTarget,
    });
  }
}
