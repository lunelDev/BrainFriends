// src/app/api/proxy/stt/route.ts

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  parseBooleanFlag,
  parseSttUseCase,
} from "@/lib/speech/sttPolicy";
import { resolveSttRuntime } from "@/lib/speech/sttRuntime";
import { resolveSttReviewOutcome, toReviewRequiredStatus } from "@/lib/speech/sttReview";
import { resolveSttLanguageCode } from "@/lib/speech/sttLanguage";

type SttFallback = {
  text: string;
  segments: Array<{ no_speech_prob: number }>;
  fallback: true;
  reason: string;
  sttStatus: string;
  reviewRequired: true;
};

const makeFallback = (reason: string): SttFallback => {
  const outcome = resolveSttReviewOutcome({
    fallback: true,
    reason,
    responseOk: false,
  });
  return {
    text: "",
    segments: [{ no_speech_prob: 0.8 }],
    fallback: true,
    reason,
    sttStatus: toReviewRequiredStatus(outcome.status),
    reviewRequired: true,
  };
};

export async function POST(req: Request) {
  try {
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

    if (isDevMode) {
      return NextResponse.json({
        text: "테스트 모드 응답입니다.",
        segments: [{ no_speech_prob: 0.01 }],
        sttStatus: "ok",
        reviewRequired: false,
      });
    }

    const incoming = await req.formData();
    const sttUseCase = parseSttUseCase(incoming.get("sttUseCase"));
    const runtime = resolveSttRuntime({
      useCase: sttUseCase,
      devMode: isDevMode,
      allowTrainingServerFallback: parseBooleanFlag(
        process.env.STT_TRAINING_SERVER_FALLBACK ??
          process.env.NEXT_PUBLIC_STT_TRAINING_SERVER_FALLBACK,
        false,
      ),
    });

    if (runtime.engine !== "server_whisper") {
      return NextResponse.json(
        makeFallback(`server_stt_blocked:${runtime.reason}`),
        { status: 403 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("[STT Proxy] OPENAI_API_KEY 누락 -> fallback");
      return NextResponse.json(makeFallback("missing_api_key"), {
        status: 500,
      });
    }

    const file = incoming.get("audio") ?? incoming.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(makeFallback("missing_audio_file"), {
        status: 400,
      });
    }

    const outgoing = new FormData();
    outgoing.append("file", file, file.name || "recording.webm");
    outgoing.append("model", "whisper-1");

    outgoing.append("language", resolveSttLanguageCode());

    const prompt = String(incoming.get("targetText") || "").trim();
    if (prompt) {
      outgoing.append("prompt", prompt);
    }

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: outgoing,
      },
    );

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { text: "", segments: [{ no_speech_prob: 0.8 }] };
    }

    if (!response.ok) {
      const upstreamCode =
        String(data?.error?.code || data?.error?.type || "").trim() ||
        "unknown";
      console.error("[STT Proxy] upstream error", {
        status: response.status,
        body: data,
      });
      return NextResponse.json(
        makeFallback(`upstream_${response.status}_${upstreamCode}`),
        {
          status: 502,
        },
      );
    }

    const outcome = resolveSttReviewOutcome({
      text: data?.text,
      fallback: Boolean(data?.fallback),
      reason: typeof data?.reason === "string" ? data.reason : null,
      responseOk: true,
    });

    return NextResponse.json({
      ...(data ?? { text: "", segments: [] }),
      sttStatus: toReviewRequiredStatus(outcome.status),
      sttDetailStatus: outcome.status,
      reviewRequired: outcome.reviewRequired,
      reviewReason: outcome.reason,
    });
  } catch (error: any) {
    console.error("[STT Proxy] unexpected error", error);
    return NextResponse.json(makeFallback("internal_error"), { status: 500 });
  }
}
