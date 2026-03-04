"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrainingSession } from "@/hooks/useTrainingSession";
import { SessionManager, TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

const STEP_META = [
  { key: "step1", label: "1단계 이해" },
  { key: "step2", label: "2단계 따라 말하기" },
  { key: "step3", label: "3단계 매칭" },
  { key: "step4", label: "4단계 유창성" },
  { key: "step5", label: "5단계 읽기" },
  { key: "step6", label: "6단계 쓰기" },
] as const;

type StepKey = (typeof STEP_META)[number]["key"];

function getStepItems(row: TrainingHistoryEntry, key: StepKey): any[] {
  const raw = row.stepDetails?.[key as keyof typeof row.stepDetails];
  return Array.isArray(raw) ? raw : [];
}

function getStepScore(row: TrainingHistoryEntry, key: StepKey): number {
  const raw = row.stepScores?.[key as keyof typeof row.stepScores];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ReportContent() {
  const router = useRouter();
  const { patient } = useTrainingSession();
  const [history, setHistory] = useState<TrainingHistoryEntry[]>([]);
  const [selected, setSelected] = useState<TrainingHistoryEntry | null>(null);
  const [modeFilter, setModeFilter] = useState<"self" | "rehab">("self");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!patient) {
      setHistory([]);
      setSelected(null);
      return;
    }
    const rows = SessionManager.getHistoryFor(patient as any).sort(
      (a, b) => b.completedAt - a.completedAt,
    );
    setHistory(rows);
    const selfRows = rows.filter((r) => r.trainingMode !== "rehab");
    setSelected(selfRows[0] || rows[0] || null);
  }, [patient]);

  const filteredHistory = useMemo(
    () =>
      history.filter((row) =>
        modeFilter === "rehab"
          ? row.trainingMode === "rehab"
          : row.trainingMode !== "rehab",
      ),
    [history, modeFilter],
  );

  useEffect(() => {
    if (!filteredHistory.length) {
      setSelected(null);
      return;
    }
    if (!selected) {
      setSelected(filteredHistory[0]);
      return;
    }
    const exists = filteredHistory.some((row) => row.historyId === selected.historyId);
    if (!exists) {
      setSelected(filteredHistory[0]);
    }
  }, [filteredHistory, selected]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const playAudio = (url: string, id: string) => {
    try {
      stopPlayback();
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(id);
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      void audio.play();
    } catch {
      setPlayingId(null);
    }
  };

  const playSpeechFallback = (text: string, id: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      stopPlayback();
      const utterance = new SpeechSynthesisUtterance(text || "음성 데이터가 없습니다.");
      utterance.lang = "ko-KR";
      utterance.rate = 0.9;
      utterance.onend = () => setPlayingId(null);
      utterance.onerror = () => setPlayingId(null);
      setPlayingId(id);
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlayingId(null);
    }
  };

  const availableSteps = selected
    ? STEP_META.map((s) => ({
        ...s,
        items: getStepItems(selected, s.key),
      })).filter((s) => s.items.length > 0)
    : [];

  const isRehabContext = modeFilter === "rehab";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="h-16 px-6 border-b border-orange-100 flex items-center justify-between bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img
            src="/images/logo/logo.png"
            alt="GOLDEN logo"
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">
              Report
            </p>
            <h1 className="text-lg font-black">재활 활동 기록</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/select")}
          aria-label="홈으로 이동"
          title="홈"
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5V21h13V9.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 21v-5h4v5" />
          </svg>
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 lg:gap-6">
        <section
          className={`bg-white rounded-2xl p-4 border ${
            isRehabContext ? "border-sky-100" : "border-orange-100"
          }`}
        >
          <div className="mb-3">
            <p
              className={`text-[10px] font-black uppercase tracking-widest ${
                isRehabContext ? "text-sky-500" : "text-orange-500"
              }`}
            >
              Patient
            </p>
            <p className="text-sm font-bold text-slate-700">
              {patient?.name || "환자 정보 없음"}
            </p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModeFilter("self")}
              className={`h-9 rounded-lg border text-sm font-black transition-colors ${
                modeFilter === "self"
                  ? "bg-orange-50 border-orange-300 text-orange-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              자가진단
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("rehab")}
              className={`h-9 rounded-lg border text-sm font-black transition-colors ${
                modeFilter === "rehab"
                  ? "bg-sky-50 border-sky-300 text-sky-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              언어재활
            </button>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500">
              {modeFilter === "rehab"
                ? "저장된 언어재활 리포트가 없습니다."
                : "저장된 자가진단 리포트가 없습니다."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {filteredHistory.map((row) => (
                <button
                  key={row.historyId}
                  type="button"
                  onClick={() => setSelected(row)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selected?.historyId === row.historyId
                      ? row.trainingMode === "rehab"
                        ? "border-sky-300 bg-sky-50"
                        : "border-orange-300 bg-orange-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-black text-slate-800">
                    {new Date(row.completedAt).toLocaleString("ko-KR")}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        row.trainingMode === "rehab"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {row.trainingMode === "rehab" ? "언어재활" : "자가진단"}
                    </span>
                    <p className="text-[11px] font-bold text-slate-600">
                      장소: {row.place} · AQ {row.aq}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          className={`bg-white rounded-2xl p-4 md:p-5 border ${
            selected?.trainingMode === "rehab"
              ? "border-sky-100"
              : "border-orange-100"
          }`}
        >
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-500">
              선택된 리포트가 없습니다.
            </div>
          ) : availableSteps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-500">
              데이터가 없습니다.
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-24">
              <div
                className={`rounded-xl border p-4 ${
                  selected.trainingMode === "rehab"
                    ? "bg-sky-50 border-sky-200"
                    : "bg-orange-50 border-orange-200"
                }`}
              >
                <p className="text-xs font-black text-slate-700">
                  {new Date(selected.completedAt).toLocaleString("ko-KR")}
                </p>
                <p className="text-sm font-bold text-slate-600 mt-1">
                  {selected.trainingMode === "rehab" ? "언어재활" : "자가진단"} · 환자:{" "}
                  {selected.patientName} · 장소: {selected.place} · AQ {selected.aq}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableSteps.map((s) => (
                  <div
                    key={s.key}
                    className={`rounded-xl border p-3 ${
                      selected.trainingMode === "rehab"
                        ? "border-sky-200 bg-sky-50/40"
                        : "border-orange-200 bg-orange-50/30"
                    }`}
                  >
                    <p className="text-[10px] font-black text-slate-500">{s.label}</p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                      {getStepScore(selected, s.key)}%
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {availableSteps.map((s) => (
                  <div
                    key={`detail-${s.key}`}
                    className="rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                      <p className="text-xs font-black text-slate-700">
                        {s.label} 상세 ({s.items.length})
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 p-2">
                      {s.items.map((it: any, idx: number) => {
                        const pid = `${s.key}-${idx}`;
                        return (
                          <div
                            key={pid}
                            className="rounded-lg border border-slate-200 bg-white p-3"
                          >
                            <p className="text-[10px] font-black text-slate-400 mb-1">
                              #{idx + 1}
                            </p>
                            <p className="text-xs font-bold text-slate-700 break-keep">
                              {String(
                                it?.text ||
                                  it?.word ||
                                  it?.prompt ||
                                  it?.targetText ||
                                  "데이터 없음",
                              )}
                            </p>

                            {it?.userImage && (
                              <div className="mt-2 h-24 bg-slate-50 border border-slate-200 rounded-md overflow-hidden flex items-center justify-center">
                                <img
                                  src={it.userImage}
                                  alt="쓰기 결과"
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            )}

                            {(it?.audioUrl || s.key === "step5") && (
                              <button
                                type="button"
                                onClick={() =>
                                  it?.audioUrl
                                    ? playAudio(it.audioUrl, pid)
                                    : playSpeechFallback(
                                        String(
                                          it?.text ||
                                            it?.word ||
                                            it?.prompt ||
                                            it?.targetText ||
                                            "음성 데이터가 없습니다.",
                                        ),
                                        pid,
                                      )
                                }
                                className="mt-2 w-full py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-black text-slate-700 transition-colors"
                              >
                                {playingId === pid ? "재생 중..." : "음성 재생"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-6">리포트 불러오는 중...</div>}>
      <ReportContent />
    </Suspense>
  );
}
