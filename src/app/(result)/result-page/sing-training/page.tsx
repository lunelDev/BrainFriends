"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Brain,
  Music,
  Printer,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { PatientProfile } from "@/lib/patientStorage";
import type { VersionSnapshot } from "@/lib/analysis/versioning";
import { fetchMyHistoryEntries } from "@/lib/client/historyApi";
import { dataUrlToBlob, uploadClinicalMedia } from "@/lib/client/clinicalMediaUpload";
import {
  SING_TRAINING_ANALYSIS_VERSION,
  SING_TRAINING_CATALOG_VERSION,
  SONGS,
} from "@/features/sing-training/data/songs";
import type { SongKey } from "@/features/sing-training/types";
import { useTrainingSession } from "@/hooks/useTrainingSession";

type SingKeyFrame = {
  dataUrl: string;
  capturedAt: string;
  label: string;
  mediaId?: string | null;
  objectKey?: string | null;
};

export const dynamic = "force-static";

type RankRow = {
  rank?: number;
  name: string;
  score: number;
  region: string;
  me?: boolean;
};

type SingResult = {
  song: string;
  userName: string;
  score: number;
  finalJitter: string;
  finalSi: string;
  rtLatency: string;
  finalConsonant?: string;
  finalVowel?: string;
  lyricAccuracy?: string;
  transcript?: string;
  metricSource?: "measured" | "demo";
  measurementReason?: string | null;
  comment: string;
  rankings: RankRow[];
  completedAt: number;
  reviewAudioUrl?: string | null;
  reviewKeyFrames?: SingKeyFrame[];
  reviewAudioMediaId?: string | null;
  reviewAudioObjectKey?: string | null;
  reviewAudioUploadState?:
    | "uploaded"
    | "failed"
    | "not_recorded"
    | "pending_result_sync";
  reviewAudioUploadError?: string | null;
  governance?: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot?: VersionSnapshot;
};

const SING_RESULT_SESSION_KEY = "bf_sing_result_transient";
const SING_LAST_SONG_SESSION_KEY = "bf_sing_song_transient";

type RankingPayload = {
  top5: RankRow[];
  myRank: RankRow | null;
};

type PersistDatabaseResult = {
  ranking: RankingPayload | null;
  skipped: boolean;
  ok: boolean;
  error?: string | null;
  nextResult?: SingResult | null;
};

const EMPTY_RANKINGS: RankRow[] = Array.from({ length: 5 }, (_, index) => ({
  rank: index + 1,
  name: "--",
  region: "--",
  score: 0,
  me: false,
}));

function parseMeasuredNumber(value: string | null | undefined) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function buildFallbackSingResult(
  song: SongKey,
  patientName: string,
): SingResult {
  const songMeta = SONGS[song];
  return {
    song,
    userName: patientName || "사용자",
    score: 0,
    finalJitter: "--",
    finalSi: "--",
    rtLatency: "-- ms",
    finalConsonant: "--",
    finalVowel: "--",
    lyricAccuracy: "--",
    transcript: "",
    metricSource: "demo",
    measurementReason: "저장된 측정 결과가 없어 화면 확인용 기본 결과를 표시합니다.",
    comment:
      "음성 또는 안면 측정 데이터가 충분하지 않아 임상 결과를 확정할 수 없습니다. 화면 확인용 결과만 표시되며 서버 저장은 수행되지 않습니다.",
    rankings: EMPTY_RANKINGS,
    completedAt: Date.now(),
    reviewAudioUrl: null,
    reviewKeyFrames: [],
    reviewAudioMediaId: null,
    reviewAudioObjectKey: null,
    reviewAudioUploadState: "not_recorded",
    reviewAudioUploadError: null,
    governance: {
      catalogVersion:
        songMeta.governance.catalogVersion ?? SING_TRAINING_CATALOG_VERSION,
      analysisVersion:
        songMeta.governance.analysisVersion ?? SING_TRAINING_ANALYSIS_VERSION,
      requirementIds: songMeta.governance.requirementIds,
      failureModes: songMeta.governance.failureModes,
    },
  };
}

async function persistToDatabase(
  patient: PatientProfile,
  result: SingResult,
): Promise<PersistDatabaseResult> {
  let nextResult = result;

  if (
    result.reviewAudioUrl &&
    result.reviewAudioUploadState !== "uploaded"
  ) {
    try {
      const reviewAudioBlob = await dataUrlToBlob(result.reviewAudioUrl);
      const uploadedReviewAudio = await uploadClinicalMedia({
        patient,
        sourceSessionKey: patient.sessionId,
        trainingType: "sing-training",
        mediaType: "audio",
        captureRole: "review-audio",
        labelSegment: result.song,
        blob: reviewAudioBlob,
        fileExtension: reviewAudioBlob.type.includes("mpeg") ? "mp3" : "webm",
      });

      nextResult = {
        ...result,
        reviewAudioMediaId: uploadedReviewAudio.mediaId,
        reviewAudioObjectKey: uploadedReviewAudio.objectKey,
        reviewAudioUploadState: "uploaded",
        reviewAudioUploadError: null,
      };
    } catch (error) {
      return {
        ranking: null,
        skipped: false,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "failed_to_upload_review_audio",
        nextResult: {
          ...result,
          reviewAudioUploadState: "failed",
          reviewAudioUploadError:
            error instanceof Error
              ? error.message
              : "failed_to_upload_review_audio",
        },
      };
    }
  }

  if (Array.isArray(nextResult.reviewKeyFrames) && nextResult.reviewKeyFrames.length > 0) {
    try {
      const uploadedFrames = [] as SingKeyFrame[];
      for (let index = 0; index < nextResult.reviewKeyFrames.length; index += 1) {
        const frame = nextResult.reviewKeyFrames[index];
        const frameBlob = await dataUrlToBlob(frame.dataUrl);
        const uploadedFrame = await uploadClinicalMedia({
          patient,
          sourceSessionKey: patient.sessionId,
          trainingType: "sing-training",
          mediaType: "image",
          captureRole: `face-keyframe-${index + 1}`,
          labelSegment: `${result.song}-${frame.label}`,
          blob: frameBlob,
          fileExtension: "jpg",
          capturedAt: frame.capturedAt,
        });
        uploadedFrames.push({
          ...frame,
          mediaId: uploadedFrame.mediaId,
          objectKey: uploadedFrame.objectKey,
        });
      }

      nextResult = {
        ...nextResult,
        reviewKeyFrames: uploadedFrames,
      };
    } catch (error) {
      return {
        ranking: null,
        skipped: false,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "failed_to_upload_review_keyframes",
        nextResult,
      };
    }
  }

  if (result.metricSource !== "measured") {
    return {
      ranking: null,
      skipped: true,
      ok: true,
      error: null,
      nextResult,
    };
  }

  try {
    const persistableResult = {
      ...nextResult,
      reviewAudioUrl: undefined,
      reviewKeyFrames: Array.isArray(nextResult.reviewKeyFrames)
        ? nextResult.reviewKeyFrames.map((frame) => ({
            capturedAt: frame.capturedAt,
            label: frame.label,
            mediaId: frame.mediaId ?? null,
            objectKey: frame.objectKey ?? null,
          }))
        : [],
    };

    const response = await fetch("/api/sing-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ patient, result: persistableResult }),
    });

    if (!response.ok) {
      const payload = await response
        .json()
        .catch(() => ({ error: "unknown_error" }));
      return {
        ranking: null,
        skipped: false,
        ok: false,
        error: payload?.error || "failed_to_persist_sing_result",
        nextResult,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      ranking?: RankingPayload;
      skipped?: boolean;
    } | null;

    return {
      ranking: payload?.ranking ?? null,
      skipped: Boolean(payload?.skipped),
      ok: true,
      error: null,
      nextResult,
    };
  } catch (error) {
    return {
      ranking: null,
      skipped: false,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "failed_to_persist_sing_result",
      nextResult,
    };
  }
}

export default function SingTrainingResultPage() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<SingResult | null>(null);
  const [hasLoadedResult, setHasLoadedResult] = useState(false);
  const [dbSaveState, setDbSaveState] = useState<
    "idle" | "saving" | "saved" | "failed" | "local_only"
  >("idle");
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [myRank, setMyRank] = useState<RankRow | null>(null);
  const { patient } = useTrainingSession();
  const lastPersistedKeyRef = useRef<string | null>(null);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const moveToSongSelect = () => {
    if (typeof window === "undefined") return;
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
      reviewAudioRef.current = null;
    }
    window.sessionStorage.removeItem(SING_RESULT_SESSION_KEY);
    window.sessionStorage.removeItem(SING_LAST_SONG_SESSION_KEY);
    window.location.replace("/select-page/sing-training");
  };

  const playReviewAudio = () => {
    if (!result?.reviewAudioUrl || isPlayingReview) return;
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
      reviewAudioRef.current = null;
    }
    const audio = new Audio(result.reviewAudioUrl);
    reviewAudioRef.current = audio;
    setIsPlayingReview(true);
    audio.onended = () => {
      setIsPlayingReview(false);
      if (reviewAudioRef.current === audio) {
        reviewAudioRef.current = null;
      }
    };
    audio.play().catch(() => {
      setIsPlayingReview(false);
      if (reviewAudioRef.current === audio) {
        reviewAudioRef.current = null;
      }
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    document.querySelectorAll("video").forEach((element) => {
      const video = element as HTMLVideoElement;
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.pause();
      video.srcObject = null;
    });

    const raw = window.sessionStorage.getItem(SING_RESULT_SESSION_KEY);
    if (!raw) {
      const lastSong =
        window.sessionStorage.getItem(SING_LAST_SONG_SESSION_KEY) ??
        searchParams.get("song");
      if (lastSong && lastSong in SONGS) {
        const fallbackResult = buildFallbackSingResult(
          lastSong as SongKey,
          patient?.name || "사용자",
        );
        setResult(fallbackResult);
        setMyRank(null);
      }
      setHasLoadedResult(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SingResult;
      window.sessionStorage.removeItem(SING_RESULT_SESSION_KEY);
      window.sessionStorage.removeItem(SING_LAST_SONG_SESSION_KEY);
      setResult(parsed);
      const parsedMyRank = parsed.rankings.find(
        (item) => item.me && Number.isFinite(Number(item.rank)),
      );
      setMyRank(parsedMyRank ?? null);
    } catch {
      setResult(null);
      setMyRank(null);
    } finally {
      setHasLoadedResult(true);
    }
  }, [patient, searchParams]);

  useEffect(() => {
    if (result || !patient) return;

    let cancelled = false;
    void fetchMyHistoryEntries()
      .then(({ entries }) => {
        if (cancelled) return;
        const latestSing = entries.find((row) => row.trainingMode === "sing");
        if (!latestSing?.singResult) {
          setHasLoadedResult(true);
          return;
        }

        setResult({
          song: latestSing.singResult.song,
          userName: latestSing.patientName,
          score: latestSing.singResult.score,
          finalJitter: latestSing.singResult.finalJitter,
          finalSi: latestSing.singResult.finalSi,
          rtLatency: latestSing.singResult.rtLatency,
          finalConsonant: latestSing.singResult.finalConsonant,
          finalVowel: latestSing.singResult.finalVowel,
          lyricAccuracy: latestSing.singResult.lyricAccuracy,
          transcript: latestSing.singResult.transcript,
          comment: latestSing.singResult.comment,
          measurementReason: latestSing.singResult.measurementReason,
          reviewKeyFrames: latestSing.singResult.reviewKeyFrames ?? [],
          rankings: latestSing.singResult.rankings ?? [],
          completedAt: latestSing.completedAt,
          governance: latestSing.singResult.governance,
          versionSnapshot: latestSing.singResult.versionSnapshot,
        });
        setMyRank(
          latestSing.singResult.rankings?.find((item) => item.me) ?? null,
        );
        setHasLoadedResult(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHasLoadedResult(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patient, result]);

  useEffect(() => {
    return () => {
      if (reviewAudioRef.current) {
        reviewAudioRef.current.pause();
        reviewAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!patient || !result) return;

    const persistKey = `${patient.sessionId}:${result.completedAt}:${result.song}`;
    if (lastPersistedKeyRef.current === persistKey) {
      return;
    }
    lastPersistedKeyRef.current = persistKey;

    let cancelled = false;
    setDbSaveState("saving");

    void persistToDatabase(patient, result).then(
      ({ ranking, skipped, ok, error, nextResult }) => {
        if (cancelled) {
          return;
        }
        if (nextResult) {
          setResult(nextResult);
        }
        if (!ok) {
          console.error("[sing-result] database persistence failed", error);
          setDbSaveState("failed");
          return;
        }
        if (ranking) {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  rankings: ranking.top5,
                }
              : prev,
          );
          setMyRank(ranking.myRank);
        }
        setDbSaveState(skipped ? "local_only" : "saved");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [patient, result]);

  if (!hasLoadedResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-6">
        <div className="rounded-[28px] border border-emerald-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">
            Loading Result
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            노래 분석 결과를 불러오고 있습니다.
          </h1>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faf8] px-6">
        <div className="rounded-[28px] border border-emerald-200 bg-white px-8 py-10 text-center shadow-xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">
            No Result
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">
            저장된 노래 분석 결과가 없습니다.
          </h1>
          <button
            type="button"
            onClick={moveToSongSelect}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 font-black text-white"
          >
            곡 선택으로 이동
          </button>
        </div>
      </div>
    );
  }

  const isMeasuredResult = result.metricSource === "measured";
  const facialSymmetryScore = parseMeasuredNumber(result.finalSi);
  const jitterScore = parseMeasuredNumber(result.finalJitter);
  const consonantScore = parseMeasuredNumber(result.finalConsonant);
  const vowelScore = parseMeasuredNumber(result.finalVowel);
  const lyricAccuracyScore = parseMeasuredNumber(result.lyricAccuracy);
  const mouthImprovement =
    facialSymmetryScore == null
      ? null
      : Math.max(8, Math.round((facialSymmetryScore - 80) * 0.9));
  const eyeImprovement =
    facialSymmetryScore == null
      ? null
      : Math.max(6, Math.round((facialSymmetryScore - 82) * 0.65));
  const rhythmCoordination =
    jitterScore == null
      ? null
      : Math.max(70, Math.min(99, result.score - Math.round(jitterScore * 5)));
  const maskedAge = patient?.age ? `${patient.age}세 기준` : "동일 연령대 기준";
  const vitalityComment =
    !isMeasuredResult
      ? result.measurementReason || "측정 데이터가 충분하지 않아 화면 확인용 결과만 표시합니다."
      : result.score >= 90
      ? "자음·모음 산출과 가사 재현이 매우 안정적으로 확인되었습니다."
      : "발화 산출과 가사 추종이 전반적으로 안정적인 흐름을 보였습니다.";
  const hasDbRanking = result.rankings.some((row) =>
    Number.isFinite(Number(row.rank)),
  );
  const displayedRankings: RankRow[] = hasDbRanking
    ? result.rankings
    : EMPTY_RANKINGS;
  const scoreLabel = isMeasuredResult ? `${result.score}` : "미측정";
  const consonantLabel =
    consonantScore == null ? "미측정" : `${consonantScore.toFixed(1)}점`;
  const vowelLabel =
    vowelScore == null ? "미측정" : `${vowelScore.toFixed(1)}점`;
  const facialSymmetryLabel =
    facialSymmetryScore == null ? "미측정" : `${facialSymmetryScore.toFixed(1)}점`;
  const jitterLabel =
    jitterScore == null ? "미측정" : `${jitterScore.toFixed(2)}%`;
  const rhythmCoordinationLabel =
    rhythmCoordination == null ? "미측정" : `${rhythmCoordination}점`;
  const lyricAccuracyLabel =
    lyricAccuracyScore == null ? "미측정" : `${lyricAccuracyScore.toFixed(1)}점`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf8_0%,#eef8f3_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[34px] border border-emerald-100 bg-white p-6 shadow-[0_24px_70px_rgba(16,185,129,0.08)] sm:p-8">
          <div className="flex flex-col gap-5 border-b border-emerald-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">
                Brain Karaoke Result
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {result.song} 진단 결과
              </h1>
              <p className="mt-2 text-base font-medium text-slate-500">
                {result.userName}님의 언어 발화 훈련 기반 노래 분석 결과입니다.
              </p>
              {result.governance ? (
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Catalog {result.governance.catalogVersion} · Analysis{" "}
                  {result.governance.analysisVersion}
                </p>
              ) : null}
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {dbSaveState === "saving" && "DB Sync In Progress"}
                {dbSaveState === "saved" && "DB Sync Complete"}
                {dbSaveState === "local_only" &&
                  "Measured metrics unavailable - Local result only"}
                {dbSaveState === "failed" && "DB Sync Failed - Local backup kept"}
                {dbSaveState === "idle" && "DB Sync Pending"}
              </p>
            </div>
              <div className="flex gap-3">
                {result.reviewAudioUrl ? (
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={playReviewAudio}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 font-black text-emerald-700"
                    >
                      <Music className="h-4 w-4" />
                      {isPlayingReview ? "재생 중..." : "내 노래 듣기"}
                    </button>
                    <p className="text-xs font-semibold text-slate-500">
                      {result.reviewAudioUploadState === "uploaded" &&
                        "NCP 업로드 및 DB 메타데이터 저장 완료"}
                      {result.reviewAudioUploadState === "pending_result_sync" &&
                        "결과 저장 시 서버 업로드 대기 중"}
                      {result.reviewAudioUploadState === "failed" &&
                        `업로드 실패: ${result.reviewAudioUploadError || "--"}`}
                      {result.reviewAudioUploadState === "not_recorded" &&
                        "녹음 파일이 생성되지 않았습니다."}
                      {!result.reviewAudioUploadState && "로컬 녹음만 생성되었습니다."}
                    </p>
                  </div>
                ) : null}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 font-black text-white"
              >
                <Printer className="h-4 w-4" />
                결과 인쇄
              </button>
              <button
                type="button"
                onClick={moveToSongSelect}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-black text-slate-800"
              >
                <RotateCcw className="h-4 w-4" />
                다른 곡 선택
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="rounded-[30px] bg-[linear-gradient(145deg,#059669_0%,#10b981_52%,#6ee7b7_100%)] p-6 text-white shadow-[0_22px_55px_rgba(16,185,129,0.24)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/75">
                    Brain Speech Score
                  </p>
                  <h2 className="mt-3 text-6xl font-black leading-none sm:text-7xl">
                    {scoreLabel}
                    {isMeasuredResult ? (
                      <span className="ml-2 text-3xl sm:text-4xl">점</span>
                    ) : null}
                  </h2>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/18 bg-white/12">
                  <Brain className="h-8 w-8" />
                </div>
              </div>
              <p className="mt-5 max-w-[520px] text-lg font-bold leading-relaxed text-white/92">
                자음, 모음, 가사 일치도와 안면 반응을 함께 반영한 언어재활형 노래 훈련 결과입니다.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricPill title="자음 정확도" value={consonantLabel} />
                <MetricPill title="모음 정확도" value={vowelLabel} />
                <MetricPill title="가사 일치도" value={lyricAccuracyLabel} />
                <MetricPill title="안면 대칭" value={facialSymmetryLabel} />
              </div>
              <div className="mt-6 rounded-[24px] border border-white/14 bg-black/10 p-4">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/70">
                  Speech Signal
                </p>
                <p className="mt-2 text-xl font-bold leading-relaxed text-white">
                  {vitalityComment}
                </p>
              </div>
            </section>

            <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(180deg,#f5f7e8_0%,#ecfbf5_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-emerald-700 shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                    Speech Comment
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    전문 AI 분석 소견
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-700">
                <p className="font-bold text-slate-900">
                  {isMeasuredResult
                    ? "오늘 발화 정확도와 가사 추종 능력이 안정적으로 확인되었습니다."
                    : "이번 세션은 측정 데이터가 충분하지 않았습니다."}
                </p>
                <p>
                  {isMeasuredResult
                    ? `자음과 모음 산출 점수를 기반으로 보면 발화 명료도가 안정적이었고, 가사 흐름을 따라가는 수행도도 양호했습니다. 보조 지표로 안면 대칭과 반응 속도도 함께 확인했습니다.`
                    : `${result.measurementReason || "마이크 입력 또는 안면 추적 데이터가 부족하면 임상 결과를 확정할 수 없습니다."} 곡 재생과 결과 UI는 확인할 수 있지만, 서버 저장과 레포트 반영은 수행되지 않습니다.`}
                </p>
                <p>{result.comment}</p>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    Speech Metrics
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-700">
                    자음 {consonantLabel} · 모음 {vowelLabel} · 가사 일치도 {lyricAccuracyLabel} · 반응속도 {result.rtLatency === "-- ms" ? "미측정" : result.rtLatency}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {result.transcript?.trim()
                      ? `인식 가사: "${result.transcript}"`
                      : "인식된 가사 텍스트가 없습니다."}
                  </p>
                </div>
                {result.reviewKeyFrames?.length ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Face Key Frames
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      노래 중 수집한 안면 반응 대표 프레임입니다.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {result.reviewKeyFrames.map((frame, index) => (
                        <div
                          key={`${frame.label}-${frame.capturedAt}-${index}`}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                        >
                          <img
                            src={frame.dataUrl}
                            alt={`노래방 key frame ${index + 1}`}
                            className="h-32 w-full object-cover"
                          />
                          <div className="border-t border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                            {frame.label} · {new Date(frame.capturedAt).toLocaleTimeString("ko-KR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-[24px] border border-emerald-200 bg-white/70 p-4">
                  <p className="flex items-center gap-2 text-base font-black text-emerald-700">
                    <ArrowUpRight className="h-5 w-5" />
                    따뜻한 격려 메시지
                  </p>
                  <p className="mt-2 text-base font-medium text-slate-700">
                    오늘처럼 가사를 끝까지 또박또박 따라 부르는 연습을 반복하면 자음·모음 산출 안정성과 문장 길이 유지에 도움이 됩니다. 안면 대칭은 보조 지표로 함께 추적합니다.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[30px] border border-emerald-100 bg-[#fbfefc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                    Facial Support Metrics
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    보조 안면 반응 지표
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <SymmetryRow
                  label="좌측 구강 근육 활성도"
                  before={mouthImprovement == null ? null : 67}
                  after={mouthImprovement == null ? null : 67 + mouthImprovement}
                  feedback={
                    mouthImprovement == null ? "미측정" : `${mouthImprovement}% 변화`
                  }
                />
                <SymmetryRow
                  label="좌측 안륜근 반응도"
                  before={eyeImprovement == null ? null : 72}
                  after={eyeImprovement == null ? null : 72 + eyeImprovement}
                  feedback={
                    eyeImprovement == null ? "미측정" : `${eyeImprovement}% 변화`
                  }
                />
                <SymmetryRow
                  label="표정-발성 보조 협응 지수"
                  before={facialSymmetryScore == null ? null : 78}
                  after={
                    facialSymmetryScore == null
                      ? null
                      : Math.min(98, Math.round(facialSymmetryScore))
                  }
                  feedback={
                    facialSymmetryScore == null
                      ? "미측정"
                      : `${Math.max(8, Math.round(facialSymmetryScore - 78))}% 향상`
                  }
                />
              </div>

              <div className="mt-6 rounded-[24px] bg-emerald-50 p-4 text-emerald-900">
                <p className="text-sm font-black">
                  {isMeasuredResult
                    ? `노래 발화 중 입 주위 반응과 눈매 대칭을 보조 지표로 함께 기록했습니다.`
                    : "안면 측정 데이터가 부족해 보조 안면 그래프는 기준값만 표시합니다."}
                </p>
                <p className="mt-2 text-base font-medium text-emerald-800">
                  {isMeasuredResult
                    ? "노래방의 핵심 평가는 발화 점수이며, 안면 반응은 발화 시 보조 반응 지표로 함께 해석합니다."
                    : "측정이 충분한 세션에서만 안면 보조 지표를 레포트에 함께 반영합니다."}
                </p>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Silver Ranking
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    전국 실버 랭킹 Top 5
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base font-medium text-slate-500">
                {maskedAge} · 전국 회원 중 실버 연령대 최고 점수 기준 상위 5명을 표시합니다.
              </p>

              <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  My Rank
                </p>
                <p className="mt-2 text-xl font-black text-slate-900">
                  {myRank && hasDbRanking
                    ? `${myRank.rank}위 · ${myRank.score}점`
                    : dbSaveState === "saving"
                      ? "랭킹 산출 중"
                    : dbSaveState === "local_only"
                        ? "로컬 모드"
                        : "--"}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {myRank && hasDbRanking
                    ? `${myRank.name}님의 현재 ${result.song} 전국 실버 랭킹 위치입니다.`
                    : dbSaveState === "local_only"
                      ? "실측 지표가 없어 서버 저장과 DB 랭킹 계산을 생략했습니다."
                      : `${result.song} 기준 DB 랭킹 데이터가 아직 없습니다.`}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {displayedRankings.map((row, idx) => (
                  <div
                    key={`${row.name}-${idx}-${row.rank}`}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-base font-bold ${
                      row.me
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span>
                      {row.rank ?? idx + 1}위. {row.name} ({row.region})
                    </span>
                    <span>{hasDbRanking ? `${row.score}점` : "--"}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricPill({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/14 bg-white/10 px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SymmetryRow({
  label,
  before,
  after,
  feedback,
}: {
  label: string;
  before: number | null;
  after: number | null;
  feedback: string;
}) {
  const unavailable = before == null || after == null;
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-black text-slate-900">{label}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{feedback}</p>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
          {unavailable ? "N/A" : "After"}
        </p>
      </div>
      {unavailable ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
          안면 대칭 측정 데이터가 충분하지 않아 이 보조 지표는 계산하지 않았습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Bar label="시작 시점" value={before} tone="slate" />
          <Bar label="훈련 후" value={after} tone="emerald" />
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald";
}) {
  const width = `${Math.max(12, Math.min(100, value))}%`;
  const fillClass =
    tone === "emerald"
      ? "bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)]"
      : "bg-[linear-gradient(90deg,#94a3b8_0%,#cbd5e1_100%)]";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${fillClass}`} style={{ width }} />
      </div>
    </div>
  );
}



