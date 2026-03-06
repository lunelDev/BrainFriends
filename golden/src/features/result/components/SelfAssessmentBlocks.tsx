import type React from "react";
import { Activity, CheckCircle2, HeartHandshake, Image, MessageSquare, Sparkles, Zap, BookOpen, PenTool, Headphones, FileText } from "lucide-react";
import { addSentenceLineBreaks } from "@/lib/text/displayText";
import { FacialReport, StepDetail } from "@/features/result/types";
import { StepRecordSection } from "@/features/result/components/StepRecordSection";
import { FacialReportSection } from "@/features/result/components/FacialReportSection";

type SelfClinicalImpression = {
  strongestText: string;
  weakestText: string;
  encourageText: string;
  summary: string;
  strength: string;
  need: string;
  recommendation: string;
};

type Props = {
  stepDetails: StepDetail[];
  sessionData: any;
  clinicalImpression: SelfClinicalImpression | null;
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
  facialReport: FacialReport | null;
};

export function SelfAssessmentBlocks({
  stepDetails,
  sessionData,
  clinicalImpression,
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
  facialReport,
}: Props) {
  const profileNodes = stepDetails.map((d, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const valueRadius = (Math.min(d.percent, 100) / 100) * 90;
    const x = 180 + valueRadius * Math.cos(angle);
    const y = 180 + valueRadius * Math.sin(angle);
    const perNodeBadgeRadius = i === 0 || i === 3 ? 124 : 138;
    const badgeX = 180 + perNodeBadgeRadius * Math.cos(angle);
    const badgeY = 180 + perNodeBadgeRadius * Math.sin(angle);
    return { ...d, x, y, badgeX, badgeY, short: d.title };
  });

  const detailIcons = [Headphones, MessageSquare, Image, Zap, BookOpen, PenTool];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 items-stretch print-top-grid">
        <section className="bg-white rounded-[32px] p-4 md:p-5 border border-orange-200 shadow-sm h-full profile-section">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
              <Activity className="w-4 h-4 text-orange-500" />
            </span>
            언어 기능 프로파일
          </h3>
          <div className="profile-body rounded-[24px] border border-orange-200 bg-orange-50/30 p-3 md:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="rounded-2xl border border-orange-100 bg-white p-3 md:p-4 h-full md:h-[280px]">
                <div className="flex items-center justify-center h-full">
                  <svg
                    viewBox="0 0 360 360"
                    className="w-[280px] h-[280px] sm:w-[300px] sm:h-[300px] md:w-[320px] md:h-[320px] profile-chart"
                  >
                    {[0.25, 0.5, 0.75, 1].map((st) => (
                      <polygon
                        key={st}
                        points={stepDetails
                          .map((_, i) => {
                            const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            return `${180 + 90 * st * Math.cos(a)},${180 + 90 * st * Math.sin(a)}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="2"
                      />
                    ))}
                    <polygon
                      points={profileNodes.map((n) => `${n.x},${n.y}`).join(" ")}
                      fill="rgba(249,115,22,0.18)"
                      stroke="#F97316"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    />
                    {profileNodes.map((n) => (
                      <g key={`node-${n.id}`}>
                        <circle cx={n.x} cy={n.y} r="4" fill="#F97316" />
                        <g transform={`translate(${n.badgeX}, ${n.badgeY})`}>
                          <rect
                            x="-46"
                            y="-14"
                            width="92"
                            height="28"
                            rx="14"
                            fill="white"
                            stroke="#FDBA74"
                            strokeWidth="1.5"
                          />
                          <text x="0" y="-1" textAnchor="middle" fontSize="8.5" fill="#475569" fontWeight="700">
                            {n.short}
                          </text>
                          <text x="0" y="10" textAnchor="middle" fontSize="9.5" fill="#0F172A" fontWeight="800">
                            {n.display}
                          </text>
                        </g>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-3 gap-2 h-full md:h-[280px] profile-metrics">
                {stepDetails.map((d, idx) => {
                  const Icon = detailIcons[idx] || Activity;
                  return (
                    <div
                      key={d.id}
                      className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm h-full min-h-[78px] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-orange-500" />
                        </span>
                        <p className="text-xs sm:text-sm font-black text-slate-500 tracking-wide truncate">
                          {d.title}
                        </p>
                      </div>
                      <p className="text-sm sm:text-base md:text-lg font-black text-slate-900 leading-none shrink-0">
                        {d.display}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 md:p-6 border border-orange-200 shadow-sm h-full">
          <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2 leading-relaxed">
            <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange-500" />
            </span>
            전문가 임상 소견
          </h3>

          <div className="bg-orange-50/40 border border-orange-200 rounded-2xl p-4 md:p-5 space-y-4 impression-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">잘하고 있는 점</p>
                <p className="mt-1 text-sm md:text-base font-bold text-slate-900 leading-loose">
                  {clinicalImpression?.strongestText}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">노력이 필요한 점</p>
                <p className="mt-1 text-sm md:text-base font-bold text-orange-600 leading-loose">
                  {clinicalImpression?.weakestText}
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">오늘의 응원 권고</p>
                <p className="mt-1 text-sm md:text-base font-bold text-slate-900 leading-loose">
                  {clinicalImpression?.encourageText}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                <p className="min-w-0 text-sm md:text-base font-semibold text-slate-800 leading-loose whitespace-pre-line break-words">
                  {addSentenceLineBreaks(clinicalImpression?.summary || "")}
                </p>
              </div>
              <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                  {addSentenceLineBreaks(`잘하고 있는 점: ${clinicalImpression?.strength || ""}`)}
                </p>
              </div>
              <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                <Activity className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                  {addSentenceLineBreaks(`노력이 필요한 점: ${clinicalImpression?.need || ""}`)}
                </p>
              </div>
              <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                <HeartHandshake className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                  {addSentenceLineBreaks(`오늘의 응원 권고: ${clinicalImpression?.recommendation || ""}`)}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <StepRecordSection
        stepDetails={stepDetails}
        sessionData={sessionData}
        openAllAccordions={openAllAccordions}
        openStepId={openStepId}
        setOpenAllAccordions={setOpenAllAccordions}
        setOpenStepId={setOpenStepId}
        getSelfItemFeedback={getSelfItemFeedback}
        shouldShowPlayButton={shouldShowPlayButton}
        getPlayableText={getPlayableText}
        playAudio={playAudio}
        playSpeechFallback={playSpeechFallback}
        playingIndex={playingIndex}
      />

      {facialReport && <FacialReportSection facialReport={facialReport} />}
    </>
  );
}
