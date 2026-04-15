import { mkdir, appendFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { SpeechFaceMeasurement } from "@/lib/ai/measurementTypes";
import type { ModelGovernanceRecord } from "@/lib/ai/modelGovernance";

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

  const evaluationDir = path.join(process.cwd(), "data", "evaluation");
  const evaluationPath = path.join(evaluationDir, "evaluation-samples.ndjson");
  await mkdir(evaluationDir, { recursive: true });

  const records = samples.map((sample) =>
    JSON.stringify({
      historyId: body.historyId,
      sessionId: body.sessionId,
      governance: body.governance ?? null,
      sample,
      recordedAt: new Date().toISOString(),
    }),
  );

  await appendFile(evaluationPath, `${records.join("\n")}\n`, "utf8");

  return NextResponse.json({
    ok: true,
    accepted: samples.length,
  });
}
