import type React from "react";
import { FileText } from "lucide-react";
import { StepDetail } from "@/features/result/types";
import { Step2AcousticBlock } from "@/features/result/components/Step2AcousticBlock";

type Props = {
  stepDetails: StepDetail[];
  sessionData: any;
  openAllAccordions: boolean;
  openStepId: number | null;
  setOpenAllAccordions: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenStepId: React.Dispatch<React.SetStateAction<number | null>>;
  getSelfItemFeedback: (stepId: number, item: any) => { good: string; improve: string };
  shouldShowPlayButton: (stepId: number, item: any) => boolean;
  getPlayableText: (item: any) => string;
  playAudio: (url: string, id: string) => void;
  playSpeechFallback: (text: string, id: string) => void;
  playingIndex: string | null;
};

export function StepRecordSection({
  stepDetails,
  sessionData,
  openAllAccordions,
  openStepId,
  setOpenAllAccordions,
  setOpenStepId,
  getSelfItemFeedback,
  shouldShowPlayButton,
  getPlayableText,
  playAudio,
  playSpeechFallback,
  playingIndex,
}: Props) {
  const getItemScore = (stepId: number, item: any): number | null => {
    let raw: any =
      stepId === 2
        ? item?.finalScore ?? item?.speechScore
        : stepId === 4
          ? item?.finalScore ??
            item?.fluencyComponentScore ??
            item?.fluencyScore ??
            item?.kwabScore
          : stepId === 5
            ? item?.readingScore ?? item?.finalScore
            : stepId === 6
              ? item?.writingScore ?? item?.finalScore
              : null;
    if (raw === null || raw === undefined) return null;
    let num = Number(raw);
    if (!Number.isFinite(num)) return null;
    if (stepId === 4 && num <= 10) num *= 10;
    return num;
  };

  return (
    <section className="no-print bg-white rounded-2xl p-5 border border-orange-200 shadow-sm">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange-500" />
            </span>
            수행 기록 상세
          </h3>
          <p className="text-sm font-bold text-slate-600">단계별 항목을 펼쳐 상세 기록을 확인하세요.</p>
        </div>
        <button
          onClick={() => setOpenAllAccordions((prev) => !prev)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {openAllAccordions ? "전체닫기" : "전체보기"}
        </button>
      </div>

      <div className="space-y-3">
        {stepDetails.map((step) => {
          const items = sessionData[`step${step.id}`]?.items || [];
          const isOpen = openAllAccordions || openStepId === step.id;
          return (
            <div
              key={step.id}
              className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden"
            >
              <button
                onClick={() => {
                  if (openAllAccordions) {
                    setOpenAllAccordions(false);
                    setOpenStepId(step.id);
                    return;
                  }
                  setOpenStepId(isOpen ? null : step.id);
                }}
                className="w-full px-4 py-3 bg-white flex items-center justify-between text-left border-b border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                    Step 0{step.id}
                  </span>
                  <span className="text-xs font-black text-slate-800">{step.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-600">{items.length} Activities</span>
                  <span className="text-slate-600 text-xs font-black">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (
                <div
                  className={`grid gap-2 p-3 ${
                    items.length === 3
                      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-5"
                  }`}
                >
                  {items.length === 0 ? (
                    <div className="col-span-full h-20 flex items-center justify-center italic text-xs text-slate-300 font-bold border border-dashed border-slate-200 rounded-xl">
                      No Data Recorded
                    </div>
                  ) : (
                    items.map((it: any, i: number) => {
                      const feedback = getSelfItemFeedback(step.id, it);
                      const itemScore = getItemScore(step.id, it);
                      return (
                        <div
                          key={i}
                          className="group h-full bg-white p-3 rounded-lg border border-slate-200/60 shadow-sm hover:border-orange-200 transition-all flex flex-col"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-slate-300 uppercase">
                              Index {i + 1}
                            </span>
                            <div
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black ${it.isCorrect ? "bg-emerald-50 text-emerald-500" : "bg-orange-50 text-orange-700"}`}
                            >
                              {it.isCorrect ? "CORRECT" : "REVIEW"}
                            </div>
                          </div>

                          {step.id === 6 && it.userImage && (
                            <div className="aspect-video bg-slate-50 rounded-md mb-2 overflow-hidden border border-slate-100 flex items-center justify-center">
                              <img
                                src={it.userImage}
                                className="max-h-full max-w-full object-contain p-2"
                                alt="training-result"
                                onError={(event) => {
                                  const target = event.currentTarget;
                                  const fallback = document.createElement("span");
                                  fallback.className = "text-xs font-bold text-slate-400";
                                  fallback.textContent = "이미지를 불러오지 못했습니다.";
                                  target.replaceWith(fallback);
                                }}
                              />
                            </div>
                          )}

                          <p className="text-xs font-bold text-slate-600 leading-snug mb-2">
                            "{it.text || it.targetText || it.targetWord || "..."}"
                          </p>
                          {itemScore !== null && (
                            <p className="text-[11px] font-black text-orange-700 mb-2">
                              점수 {itemScore.toFixed(1)}점
                            </p>
                          )}

                          {(step.id === 2 || step.id === 4 || step.id === 5) && it.acoustic && (
                            <Step2AcousticBlock acoustic={it.acoustic} />
                          )}

                          {(feedback.good || feedback.improve) && (
                            <div className="mt-1 pt-2 border-t border-slate-100 space-y-1 mb-2">
                              {feedback.good && (
                                <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                                  <span className="text-orange-600">좋았던 점:</span> {feedback.good}
                                </p>
                              )}
                              {feedback.improve && (
                                <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                                  <span className="text-slate-700">개선점:</span> {feedback.improve}
                                </p>
                              )}
                            </div>
                          )}

                          {shouldShowPlayButton(step.id, it) && (
                            <button
                              onClick={() => {
                                const id = `s${step.id}-${i}`;
                                if (it.audioUrl) {
                                  playAudio(it.audioUrl, id);
                                } else {
                                  playSpeechFallback(getPlayableText(it), id);
                                }
                              }}
                              className={`mt-auto w-full py-1.5 rounded-md text-xs font-black flex items-center justify-center gap-2 transition-all ${playingIndex === `s${step.id}-${i}` ? "bg-orange-600 text-white shadow-sm" : "bg-slate-50 text-slate-600 group-hover:bg-orange-50 group-hover:text-slate-900"}`}
                            >
                              {playingIndex === `s${step.id}-${i}` ? (
                                <>
                                  <span>■</span> STOP SOUND
                                </>
                              ) : (
                                <>
                                  <span>▶</span> PLAY SOUND
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
