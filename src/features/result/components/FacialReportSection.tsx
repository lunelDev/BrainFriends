import { BookOpen, MessageSquare, ScanFace } from "lucide-react";
import { FacialReport } from "@/features/result/types";

type Props = {
  facialReport: FacialReport;
};

export function FacialReportSection({ facialReport }: Props) {
  return (
    <section className="no-print bg-white rounded-[32px] p-5 md:p-6 border border-slate-100 shadow-sm">
      <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-5 uppercase tracking-wider flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-orange-50 border border-slate-100 flex items-center justify-center">
          <ScanFace className="w-4 h-4 text-orange-500" />
        </span>
        AI 정밀 분석
      </h3>
      <div className="grid grid-cols-12 gap-4 md:gap-5">
        <div className="col-span-12 md:col-span-6 rounded-2xl border border-slate-100 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm md:text-base font-black text-slate-800">안면 기반 자-모음 정확도</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">
                <MessageSquare className="w-3.5 h-3.5" />
                자음
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                <BookOpen className="w-3.5 h-3.5" />
                모음
              </span>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3 md:gap-4">
            <div className="col-span-12 sm:col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:p-4">
              <p className="text-xs text-slate-500 font-bold">전체 자음</p>
              <p className="mt-1 text-2xl md:text-3xl font-black text-amber-600 leading-none">
                {Math.round(facialReport.overallConsonant)}%
              </p>
            </div>
            <div className="col-span-12 sm:col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:p-4">
              <p className="text-xs text-slate-500 font-bold">전체 모음</p>
              <p className="mt-1 text-2xl md:text-3xl font-black text-indigo-600 leading-none">
                {Math.round(facialReport.overallVowel)}%
              </p>
            </div>
            <div className="col-span-6 md:col-span-4 rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] text-slate-500 font-bold">STEP 2</p>
              <p className="mt-1 text-xs sm:text-sm font-black text-slate-900">
                자 {Math.round(facialReport.step2Consonant)}% · 모 {Math.round(facialReport.step2Vowel)}%
              </p>
            </div>
            <div className="col-span-6 md:col-span-4 rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] text-slate-500 font-bold">STEP 4</p>
              <p className="mt-1 text-xs sm:text-sm font-black text-slate-900">
                자 {Math.round(facialReport.step4Consonant)}% · 모 {Math.round(facialReport.step4Vowel)}%
              </p>
            </div>
            <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] text-slate-500 font-bold">STEP 5</p>
              <p className="mt-1 text-xs sm:text-sm font-black text-slate-900">
                자 {Math.round(facialReport.step5Consonant)}% · 모 {Math.round(facialReport.step5Vowel)}%
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 rounded-2xl border border-slate-100 bg-white p-4 md:p-5 min-h-[250px]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm md:text-base font-black text-slate-800">안면 반응 변화 추적</p>
            <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <ScanFace className="w-4 h-4 text-slate-700" />
            </span>
          </div>
          <div className="mt-4">
            <p
              className={`text-2xl md:text-3xl font-black leading-none ${
                facialReport.asymmetryRisk >= 70
                  ? "text-red-600"
                  : facialReport.asymmetryRisk >= 40
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {facialReport.riskLabel}
            </p>
            <p className="mt-1 text-base font-black text-slate-900">
              {Math.round(facialReport.asymmetryRisk)} / 100
            </p>
          </div>
          <div className="mt-4 grid grid-cols-12 gap-2.5">
            <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <p className="text-[11px] font-bold text-slate-500">입꼬리 차이</p>
              <p className="text-sm font-black text-slate-900">
                {facialReport.oralCommissureAsymmetry.toFixed(1)}%
              </p>
            </div>
            <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <p className="text-[11px] font-bold text-slate-500">입술 폐쇄 차이</p>
              <p className="text-sm font-black text-slate-900">
                {facialReport.lipClosureAsymmetry.toFixed(1)}%
              </p>
            </div>
            <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <p className="text-[11px] font-bold text-slate-500">발화 편차</p>
              <p className="text-sm font-black text-slate-900">
                {facialReport.vowelArticulationVariance.toFixed(1)}
              </p>
            </div>
            <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              <p className="text-[11px] font-bold text-slate-500">추적 품질</p>
              <p className="text-sm font-black text-slate-900">
                {facialReport.trackingQuality.toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs sm:text-sm font-bold text-slate-600 leading-relaxed whitespace-pre-line break-words">
            {facialReport.summary}
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] sm:text-xs font-bold text-slate-500">
            <p>
              입꼬리 변화:{" "}
              {facialReport.oralCommissureDelta === null
                ? "이전 데이터 없음"
                : `${facialReport.oralCommissureDelta > 0 ? "+" : ""}${facialReport.oralCommissureDelta.toFixed(1)}%p`}
            </p>
            <p>
              폐쇄 변화:{" "}
              {facialReport.lipClosureDelta === null
                ? "이전 데이터 없음"
                : `${facialReport.lipClosureDelta > 0 ? "+" : ""}${facialReport.lipClosureDelta.toFixed(1)}%p`}
            </p>
            <p>
              발화 편차 변화:{" "}
              {facialReport.vowelArticulationDelta === null
                ? "이전 데이터 없음"
                : `${facialReport.vowelArticulationDelta > 0 ? "+" : ""}${facialReport.vowelArticulationDelta.toFixed(1)}`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
