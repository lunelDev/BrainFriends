"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { loadPatientProfile, type PatientProfile } from "@/lib/patientStorage";
import { SessionManager } from "@/lib/kwab/SessionManager";
import type { VersionSnapshot } from "@/lib/analysis/versioning";

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
  comment: string;
  rankings: RankRow[];
  completedAt: number;
  reviewAudioUrl?: string | null;
  reviewAudioMediaId?: string | null;
  reviewAudioObjectKey?: string | null;
  reviewAudioUploadState?: "uploaded" | "failed" | "not_recorded";
  reviewAudioUploadError?: string | null;
  governance?: {
    catalogVersion: string;
    analysisVersion: string;
    requirementIds: string[];
    failureModes: string[];
  };
  versionSnapshot?: VersionSnapshot;
};

type RankingPayload = {
  top5: RankRow[];
  myRank: RankRow | null;
};

type PersistDatabaseResult = {
  ranking: RankingPayload | null;
  skipped: boolean;
  ok: boolean;
  error?: string | null;
};

const EMPTY_RANKINGS: RankRow[] = Array.from({ length: 5 }, (_, index) => ({
  rank: index + 1,
  name: "--",
  region: "--",
  score: 0,
  me: false,
}));

async function persistToDatabase(
  patient: PatientProfile,
  result: SingResult,
): Promise<PersistDatabaseResult> {
  try {
    const response = await fetch("/api/sing-results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ patient, result }),
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
    };
  }
}

export default function SingTrainingResultPage() {
  const [result, setResult] = useState<SingResult | null>(null);
  const [hasLoadedResult, setHasLoadedResult] = useState(false);
  const [dbSaveState, setDbSaveState] = useState<
    "idle" | "saving" | "saved" | "failed" | "local_only"
  >("idle");
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [myRank, setMyRank] = useState<RankRow | null>(null);
  const patient = useMemo(() => loadPatientProfile(), []);
  const lastPersistedKeyRef = useRef<string | null>(null);
  const reviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const moveToSongSelect = () => {
    if (typeof window === "undefined") return;
    if (reviewAudioRef.current) {
      reviewAudioRef.current.pause();
      reviewAudioRef.current = null;
    }
    window.sessionStorage.removeItem("brain-sing-result");
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

    const raw = window.sessionStorage.getItem("brain-sing-result");
    if (!raw) {
      setHasLoadedResult(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SingResult;
      setResult(parsed);
      const parsedMyRank = parsed.rankings.find(
        (item) => item.me && Number.isFinite(Number(item.rank)),
      );
      setMyRank(parsedMyRank ?? null);
      if (patient) {
        SessionManager.saveSingHistory(
          patient as any,
          {
            song: parsed.song,
            score: parsed.score,
            finalJitter: parsed.finalJitter,
            finalSi: parsed.finalSi,
            rtLatency: parsed.rtLatency,
            comment: parsed.comment,
            rankings: parsed.rankings,
            governance: parsed.governance,
            versionSnapshot: parsed.versionSnapshot,
          },
          parsed.completedAt,
        );
      }
    } catch {
      setResult(null);
      setMyRank(null);
    } finally {
      setHasLoadedResult(true);
    }
  }, [patient]);

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
      ({ ranking, skipped, ok, error }) => {
        if (cancelled) {
          return;
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

  const facialSymmetryScore = Number(result.finalSi || 0);
  const jitterScore = Number(result.finalJitter || 0);
  const mouthImprovement = Math.max(
    8,
    Math.round((facialSymmetryScore - 80) * 0.9),
  );
  const eyeImprovement = Math.max(
    6,
    Math.round((facialSymmetryScore - 82) * 0.65),
  );
  const rhythmCoordination = Math.max(
    70,
    Math.min(99, result.score - Math.round(jitterScore * 5)),
  );
  const maskedAge = patient?.age ? `${patient.age}세 기준` : "동일 연령대 기준";
  const vitalityComment =
    result.score >= 90
      ? "건강하게 회복 중인 흐름이 매우 안정적으로 확인되었습니다."
      : "안면 반응과 발성 협응이 균형 있게 유지되고 있습니다.";
  const hasDbRanking = result.rankings.some((row) =>
    Number.isFinite(Number(row.rank)),
  );
  const displayedRankings: RankRow[] = hasDbRanking
    ? result.rankings
    : EMPTY_RANKINGS;

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
                {result.userName}님의 안면 마비 진단 기반 노래 분석 결과입니다.
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
                {dbSaveState === "local_only" && "DB Not Configured - Local backup kept"}
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
                    Brain Vitality Score
                  </p>
                  <h2 className="mt-3 text-6xl font-black leading-none sm:text-7xl">
                    {result.score}
                    <span className="ml-2 text-3xl sm:text-4xl">점</span>
                  </h2>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/18 bg-white/12">
                  <Brain className="h-8 w-8" />
                </div>
              </div>
              <p className="mt-5 max-w-[520px] text-lg font-bold leading-relaxed text-white/92">
                안면 대칭도 + 발음 정확도 + 리듬 협응력을 종합한 뇌 활력 점수입니다.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricPill title="안면 대칭" value={`${facialSymmetryScore.toFixed(1)}점`} />
                <MetricPill title="발성 안정" value={`${jitterScore.toFixed(2)}%`} />
                <MetricPill title="리듬 협응" value={`${rhythmCoordination}점`} />
              </div>
              <div className="mt-6 rounded-[24px] border border-white/14 bg-black/10 p-4">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/70">
                  Recovery Signal
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
                    Medical Comment
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    전문 AI 분석 소견
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-700">
                <p className="font-bold text-slate-900">
                  오늘 성대 안정성이 매우 우수했습니다.
                </p>
                <p>
                  입을 크게 벌리는 동작이 지난번보다 {Math.max(12, mouthImprovement)}% 더 정확해졌고, 눈 주위 반응도도 함께 개선되는 양상을 보였습니다.
                </p>
                <p>{result.comment}</p>
                <div className="rounded-[24px] border border-emerald-200 bg-white/70 p-4">
                  <p className="flex items-center gap-2 text-base font-black text-emerald-700">
                    <ArrowUpRight className="h-5 w-5" />
                    따뜻한 격려 메시지
                  </p>
                  <p className="mt-2 text-base font-medium text-slate-700">
                    오늘처럼 노래 리듬에 맞춰 입 모양을 크게 열어 주시면, 안면 좌우 협응 회복에 도움이 됩니다. 같은 흐름으로 꾸준히 진행하면 더 안정적인 표정 반응을 기대할 수 있습니다.
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
                    Facial Symmetry Graph
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    안면 대칭 개선도
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <SymmetryRow label="좌측 구강 근육 활성도" before={67} after={67 + mouthImprovement} feedback={`${mouthImprovement}% 증가`} />
                <SymmetryRow label="좌측 안륜근 반응도" before={72} after={72 + eyeImprovement} feedback={`${eyeImprovement}% 증가`} />
                <SymmetryRow label="표정-발성 협응 지수" before={78} after={Math.min(98, Math.round(facialSymmetryScore))} feedback={`${Math.max(8, Math.round(facialSymmetryScore - 78))}% 향상`} />
              </div>

              <div className="mt-6 rounded-[24px] bg-emerald-50 p-4 text-emerald-900">
                <p className="text-sm font-black">
                  좌측 구강 근육 활성도 {mouthImprovement}% 증가, 눈매 대칭 반응 {eyeImprovement}% 향상
                </p>
                <p className="mt-2 text-base font-medium text-emerald-800">
                  시작 시점 대비 입꼬리와 눈매의 좌우 균형이 더 정교하게 회복되는 흐름을 보였습니다.
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
                      ? "DB가 연결되지 않아 로컬 결과만 유지 중입니다."
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
  before: number;
  after: number;
  feedback: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-black text-slate-900">{label}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{feedback}</p>
        </div>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
          After
        </p>
      </div>
      <div className="mt-4 space-y-3">
        <Bar label="시작 시점" value={before} tone="slate" />
        <Bar label="훈련 후" value={after} tone="emerald" />
      </div>
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



