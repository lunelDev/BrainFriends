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
  facialResponseDelta?: string;
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

type BaselineFaceMetrics = {
  facialSymmetry: number | null;
  trackingQuality: number | null;
};

type PersistDatabaseResult = {
  ranking: RankingPayload | null;
  skipped: boolean;
  ok: boolean;
  error?: string | null;
  nextResult?: SingResult | null;
};

type HistorySingEntry = Awaited<
  ReturnType<typeof fetchMyHistoryEntries>
>["entries"][number];

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

function isMeasuredSingResult(result: SingResult | null) {
  return result?.metricSource === "measured";
}

function isDemoSkipSingResult(result: SingResult | null) {
  const reason = String(result?.measurementReason || "");
  const comment = String(result?.comment || "");
  return reason.includes("관리자 skip") || comment.includes("관리자 skip");
}

function getBaselineFaceMetrics(result: SingResult | null | undefined): BaselineFaceMetrics {
  const metadata = result?.versionSnapshot?.measurement_metadata;
  const metadataBaselineFacialSymmetry =
    typeof metadata?.baseline_facial_symmetry === "number"
      ? metadata.baseline_facial_symmetry
      : typeof metadata?.baseline_facial_symmetry === "string"
        ? Number(metadata.baseline_facial_symmetry)
        : null;
  const fallbackFinalSi =
    result?.finalSi && result.finalSi !== "--" ? Number(result.finalSi) : null;
  const baselineTrackingQuality =
    typeof metadata?.baseline_tracking_quality === "number"
      ? metadata.baseline_tracking_quality
      : typeof metadata?.baseline_tracking_quality === "string"
        ? Number(metadata.baseline_tracking_quality)
        : null;

  return {
    facialSymmetry: Number.isFinite(metadataBaselineFacialSymmetry)
      ? metadataBaselineFacialSymmetry
      : Number.isFinite(fallbackFinalSi)
        ? fallbackFinalSi
      : null,
    trackingQuality: Number.isFinite(baselineTrackingQuality)
      ? baselineTrackingQuality
      : null,
  };
}

function findPreviousSingBaseline(
  entries: HistorySingEntry[],
  current: SingResult | null,
): BaselineFaceMetrics {
  if (!current) {
    return { facialSymmetry: null, trackingQuality: null };
  }

  const currentCompletedAt = Number(current.completedAt || 0);
  const currentSong = String(current.song || "");
  const singEntries = entries
    .filter((entry) => entry.trainingMode === "sing" && entry.singResult)
    .filter((entry) => entry.completedAt < currentCompletedAt)
    .sort((a, b) => b.completedAt - a.completedAt);
  const previousEntry =
    singEntries.find((entry) => String(entry.singResult?.song || "") === currentSong) ??
    singEntries[0];

  return getBaselineFaceMetrics(previousEntry?.singResult as SingResult | undefined);
}

function ServerExcludedBadge() {
  return (
    <div className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-700 sm:text-xs">
      서버 저장 제외됨(실측 아님)
    </div>
  );
}

function DemoResultBadge() {
  return (
    <div className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 sm:text-xs">
      시연용 결과
    </div>
  );
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
    facialResponseDelta: "--",
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

function buildSkippedDemoSingResult(
  song: SongKey,
  patientName: string,
): SingResult {
  const songMeta = SONGS[song];
  const demoTranscript = songMeta.lyrics
    .slice(0, 2)
    .map((line) => line.txt)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    song,
    userName: patientName || "관리자",
    score: 72,
    finalJitter: "6.4%",
    finalSi: "96.2",
    facialResponseDelta: "3.8",
    rtLatency: "1240 ms",
    finalConsonant: "74.8",
    finalVowel: "77.6",
    lyricAccuracy: "69.4",
    transcript: demoTranscript,
    metricSource: "demo",
    measurementReason: "관리자 skip으로 인해 실측을 수행하지 않았습니다.",
    comment:
      "관리자 skip으로 생성된 화면 확인용 시연 결과입니다. 실측 데이터가 아니므로 서버 저장과 랭킹 반영은 수행되지 않습니다.",
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

function buildResultFromHistoryEntry(entry: HistorySingEntry): SingResult {
  const hasMeasuredFromHistory =
    entry.singResult?.finalConsonant !== "-" ||
    entry.singResult?.finalVowel !== "-" ||
    entry.singResult?.lyricAccuracy !== "-" ||
    entry.singResult?.finalSi !== "-";

  return {
    song: entry.singResult?.song || "아리랑",
    userName: entry.patientName,
    score: entry.singResult?.score || 0,
    finalJitter: entry.singResult?.finalJitter || "--",
    finalSi: entry.singResult?.finalSi || "--",
    facialResponseDelta:
      entry.singResult?.facialResponseDelta ??
      (entry.singResult?.versionSnapshot?.measurement_metadata?.facial_response_delta == null
        ? "--"
        : String(entry.singResult.versionSnapshot.measurement_metadata.facial_response_delta)),
    rtLatency: entry.singResult?.rtLatency || "-- ms",
    finalConsonant: entry.singResult?.finalConsonant,
    finalVowel: entry.singResult?.finalVowel,
    lyricAccuracy: entry.singResult?.lyricAccuracy,
    transcript: entry.singResult?.transcript,
    metricSource: hasMeasuredFromHistory ? "measured" : "demo",
    comment: entry.singResult?.comment || "",
    measurementReason: entry.singResult?.measurementReason,
    reviewAudioUrl: entry.singResult?.reviewAudioUrl ?? null,
    reviewKeyFrames: entry.singResult?.reviewKeyFrames ?? [],
    rankings: entry.singResult?.rankings ?? [],
    completedAt: entry.completedAt,
    reviewAudioUploadState: entry.singResult?.reviewAudioUrl
      ? "uploaded"
      : "not_recorded",
    governance: entry.singResult?.governance,
    versionSnapshot: entry.singResult?.versionSnapshot,
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
  const [fallbackSong, setFallbackSong] = useState<SongKey | null>(null);
  const [dbSaveState, setDbSaveState] = useState<
    "idle" | "saving" | "saved" | "failed" | "local_only"
  >("idle");
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [myRank, setMyRank] = useState<RankRow | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistorySingEntry[]>([]);
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
    const isSkipDemo = searchParams.get("demo") === "skip";
    if (!raw) {
      const lastSong =
        window.sessionStorage.getItem(SING_LAST_SONG_SESSION_KEY) ??
        searchParams.get("song");
      if (lastSong && lastSong in SONGS) {
        setFallbackSong(lastSong as SongKey);
        if (isSkipDemo) {
          setResult(
            buildSkippedDemoSingResult(
              lastSong as SongKey,
              patient?.name || "관리자",
            ),
          );
          setMyRank(null);
          setHasLoadedResult(true);
          return;
        }
      } else {
        setFallbackSong(null);
      }
      if (!patient) {
        setHasLoadedResult(true);
      }
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SingResult;
      window.sessionStorage.removeItem(SING_RESULT_SESSION_KEY);
      window.sessionStorage.removeItem(SING_LAST_SONG_SESSION_KEY);
      setFallbackSong(null);
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
    if (!patient) return;
    const isSkipDemo = searchParams.get("demo") === "skip";
    if (isSkipDemo) {
      setDbSaveState("local_only");
      setHasLoadedResult(true);
      return;
    }

    const needsStoredResultSync =
      !result || result.metricSource !== "measured" || dbSaveState === "local_only";

    if (!needsStoredResultSync) {
      return;
    }

    let cancelled = false;
    void fetchMyHistoryEntries()
      .then(({ entries }) => {
        if (cancelled) return;
        setHistoryEntries(entries);
        const latestSing = entries.find((row) => row.trainingMode === "sing");
        if (!latestSing?.singResult) {
          if (!result && fallbackSong) {
            const isSkipDemo = searchParams.get("demo") === "skip";
            setResult(
              isSkipDemo
                ? buildSkippedDemoSingResult(
                    fallbackSong,
                    patient.name || "관리자",
                  )
                : buildFallbackSingResult(fallbackSong, patient.name || "사용자"),
            );
            setMyRank(null);
          }
          setHasLoadedResult(true);
          return;
        }

        const nextStoredResult = buildResultFromHistoryEntry(latestSing);
        setResult((prev) => {
          if (!prev) return nextStoredResult;
          if (prev.metricSource !== "measured") return nextStoredResult;
          return latestSing.completedAt >= prev.completedAt ? nextStoredResult : prev;
        });
        setMyRank(
          latestSing.singResult.rankings?.find((item) => item.me) ?? null,
        );
        setDbSaveState("saved");
        setHasLoadedResult(true);
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryEntries([]);
          if (!result && fallbackSong) {
            const isSkipDemo = searchParams.get("demo") === "skip";
            setResult(
              isSkipDemo
                ? buildSkippedDemoSingResult(
                    fallbackSong,
                    patient.name || "관리자",
                  )
                : buildFallbackSingResult(fallbackSong, patient.name || "사용자"),
            );
            setMyRank(null);
          }
          setHasLoadedResult(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dbSaveState, fallbackSong, patient, result, searchParams]);

  useEffect(() => {
    if (result || patient || !fallbackSong) return;
    const isSkipDemo = searchParams.get("demo") === "skip";
    setResult(
      isSkipDemo
        ? buildSkippedDemoSingResult(fallbackSong, "관리자")
        : buildFallbackSingResult(fallbackSong, "사용자"),
    );
    setMyRank(null);
    setHasLoadedResult(true);
  }, [fallbackSong, patient, result, searchParams]);

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

  const isMeasuredResult = isMeasuredSingResult(result);
  const isDemoSkipResult = isDemoSkipSingResult(result);
  const isServerExcluded = dbSaveState === "local_only" || !isMeasuredResult;
  const currentBaselineMetrics = getBaselineFaceMetrics(result);
  const previousBaselineMetrics = findPreviousSingBaseline(historyEntries, result);
  const baselineComparisonDelta =
    currentBaselineMetrics.facialSymmetry == null ||
    previousBaselineMetrics.facialSymmetry == null
      ? null
      : Math.abs(
          currentBaselineMetrics.facialSymmetry -
            previousBaselineMetrics.facialSymmetry,
        );
  const jitterScore = parseMeasuredNumber(result.finalJitter);
  const consonantScore = parseMeasuredNumber(result.finalConsonant);
  const vowelScore = parseMeasuredNumber(result.finalVowel);
  const lyricAccuracyScore = parseMeasuredNumber(result.lyricAccuracy);
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
  const jitterLabel =
    jitterScore == null ? "미측정" : `${jitterScore.toFixed(2)}%`;
  const lyricAccuracyLabel =
    lyricAccuracyScore == null ? "미측정" : `${lyricAccuracyScore.toFixed(1)}점`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf8_0%,#eef8f3_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[34px] border border-emerald-100 bg-white p-6 shadow-[0_24px_70px_rgba(16,185,129,0.08)] sm:p-8">
          <div className="flex flex-col gap-5 border-b border-emerald-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
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
              {isServerExcluded ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {isDemoSkipResult ? <DemoResultBadge /> : null}
                  <ServerExcludedBadge />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
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

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="이번 결과" value={scoreLabel} accent="primary" />
            <SummaryCard title="자음 정확도" value={consonantLabel} />
            <SummaryCard title="모음 정확도" value={vowelLabel} />
            <SummaryCard title="가사 일치도" value={lyricAccuracyLabel} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard title="반응 지연 시간" value={result.rtLatency === "-- ms" ? "미측정" : result.rtLatency} />
            <SummaryCard title="발성 안정도" value={jitterLabel} />
            <SummaryCard
              title="내 최고 기록"
              value={myRank && hasDbRanking ? `${myRank.score}점` : "--"}
              helper={myRank && hasDbRanking ? `현재 순위 ${myRank.rank}위` : "랭킹 집계 전"}
            />
          </div>

          <div className="mt-5 space-y-5">
            <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(180deg,#f7fcfa_0%,#eefbf4_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
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
                    ? "자음과 모음 산출 점수를 기반으로 보면 발화 명료도가 안정적이었고, 가사 흐름을 따라가는 수행도도 양호했습니다. 안면 변화값은 직전 세션 baseline 대비 참고 지표로만 확인했습니다."
                    : isDemoSkipResult
                      ? "관리자 skip으로 생성된 시연용 결과입니다. 곡 재생과 결과 UI 확인만 가능하며 서버 저장과 리포트 원장 반영은 수행하지 않습니다."
                      : `${result.measurementReason || "마이크 입력 또는 안면 추적 데이터가 부족하면 임상 결과를 확정할 수 없습니다."} 곡 재생과 결과 UI는 확인할 수 있지만, 서버 저장과 레포트 반영은 수행되지 않습니다.`}
                </p>
                <p>{result.comment}</p>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Speech Signal
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    측정 신호 요약
                  </h2>
                </div>
              </div>
              <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
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
              <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <p className="text-sm font-black">발화 산출과 가사 추종이 전반적으로 안정적인 흐름을 보였습니다.</p>
                <p className="mt-2 text-base font-medium text-emerald-800">
                  노래방의 핵심 평가는 발화 점수이며, 안면 변화값은 직전 세션 baseline 대비 참고 지표로만 해석합니다.
                </p>
              </div>
            </section>
          </div>

          <div className="mt-5 space-y-5">
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                  <Music className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Review
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    재생 및 프레임 확인
                  </h2>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {result.reviewAudioUrl ? (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                    <button
                      type="button"
                      onClick={playReviewAudio}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-5 font-black text-emerald-700"
                    >
                      <Music className="h-4 w-4" />
                      {isPlayingReview ? "재생 중..." : "내 노래 듣기"}
                    </button>
                    <p className="mt-3 text-sm font-semibold text-slate-500">
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
              </div>
            </section>

            {baselineComparisonDelta != null ? (
              <section className="rounded-[30px] border border-emerald-100 bg-[#fbfefc] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Activity className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">
                      Facial Support Metric
                    </p>
                    <h2 className="mt-1 text-2xl font-black text-slate-900">
                      직전 세션 기준 대비 안면 변화량
                    </h2>
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  <SymmetryRow
                    label="직전 세션 baseline 대비 안면 변화량"
                    delta={baselineComparisonDelta}
                    feedback={`${baselineComparisonDelta.toFixed(1)}점 변화`}
                    tone="emerald"
                  />
                </div>

                <div className="mt-6 rounded-[24px] bg-emerald-50 p-4 text-emerald-900">
                  <p className="text-sm font-black">
                    이번 세션 시작 baseline과 직전 세션 baseline을 비교한 보조 변화값입니다.
                  </p>
                  <p className="mt-2 text-base font-medium text-emerald-800">
                    현재는 입, 눈, 표정 협응을 각각 독립 계측하지 않고 baseline 얼굴 metric 1개만 비교합니다.
                  </p>
                </div>
              </section>
            ) : null}

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Overall Ranking
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    전체 랭킹 Top 5 (곡별 최고 기록 기준)
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-base font-medium text-slate-500">
                {result.song} 곡에서 각 사용자의 최고 기록만 반영해 상위 5명을 표시합니다.
              </p>

              <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                    나의 순위
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
                      ? `나의 최고 기록 ${myRank.score}점 · 이번 결과 ${result.score}점`
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

function SummaryCard({
  title,
  value,
  helper,
  accent = "default",
}: {
  title: string;
  value: string;
  helper?: string;
  accent?: "default" | "primary";
}) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[0_14px_35px_rgba(15,23,42,0.04)] ${
        accent === "primary"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <p
        className={`mt-3 text-4xl font-black tracking-tight ${
          accent === "primary" ? "text-emerald-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-2 text-sm font-medium text-slate-500">{helper}</p>
      ) : null}
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
  delta,
  feedback,
  tone,
}: {
  label: string;
  delta: number | null;
  feedback: string;
  tone: "slate" | "emerald";
}) {
  const unavailable = delta == null;
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-black text-slate-900">{label}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{feedback}</p>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
          {unavailable ? "N/A" : "Change"}
        </p>
      </div>
      {unavailable ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
          안면 반응 변화 측정 데이터가 충분하지 않아 이 보조 지표는 계산하지 않았습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Bar label="기준 대비 변화량" value={delta} tone={tone} />
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
  const clampedValue = Math.max(0, Math.min(100, value));
  const width = `${Math.max(12, clampedValue)}%`;
  const fillClass =
    tone === "emerald"
      ? "bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)]"
      : "bg-[linear-gradient(90deg,#94a3b8_0%,#cbd5e1_100%)]";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-600">
        <span>{label}</span>
        <span>{clampedValue.toFixed(1)}점</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100">
        <div className={`h-3 rounded-full ${fillClass}`} style={{ width }} />
      </div>
    </div>
  );
}



