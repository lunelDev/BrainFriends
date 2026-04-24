import { REHAB_STEP_LABELS } from "@/lib/results/rehab/constants";
import { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { getPlaceLabel, getRehabItemLabel, getRehabRowScore } from "@/features/report/utils/reportHelpers";

type Props = {
  isRehabContext: boolean;
  isSingContext: boolean;
  patientName: string;
  modeFilter: "self" | "rehab" | "sing";
  sortOrder: "latest" | "oldest";
  rehabStepFilter: "all" | 1 | 2 | 3 | 4 | 5 | 6;
  isFilterOpen: boolean;
  isSelectionMode: boolean;
  showDeleteConfirm: boolean;
  selectedHistoryIds: Set<string>;
  filteredHistory: TrainingHistoryEntry[];
  allRehabSelected: boolean;
  selectionCheckedClass: string;
  selectedHistoryId: string | null;
  onManageIconClick: () => void;
  onSetModeFilter: (mode: "self" | "rehab" | "sing") => void;
  onToggleFilterOpen: () => void;
  onSetSortOrder: (order: "latest" | "oldest") => void;
  onSetRehabStepFilter: (step: "all" | 1 | 2 | 3 | 4 | 5 | 6) => void;
  onDismissDeleteConfirm: () => void;
  onConfirmDeleteSelected: () => void;
  onToggleSelectAll: () => void;
  onToggleHistorySelection: (historyId: string) => void;
  onSelectHistory: (row: TrainingHistoryEntry) => void;
};

export function HistorySidebar({
  isRehabContext,
  isSingContext,
  patientName,
  modeFilter,
  sortOrder,
  rehabStepFilter,
  isFilterOpen,
  isSelectionMode,
  showDeleteConfirm,
  selectedHistoryIds,
  filteredHistory,
  allRehabSelected,
  selectionCheckedClass,
  selectedHistoryId,
  onManageIconClick,
  onSetModeFilter,
  onToggleFilterOpen,
  onSetSortOrder,
  onSetRehabStepFilter,
  onDismissDeleteConfirm,
  onConfirmDeleteSelected,
  onToggleSelectAll,
  onToggleHistorySelection,
  onSelectHistory,
}: Props) {
  return (
    <section
      className={`bg-white rounded-2xl p-4 border ${
        isSingContext ? "border-emerald-100" : isRehabContext ? "border-sky-100" : "border-orange-100"
      } relative`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="pr-12">
          <p
            className={`text-[10px] font-black uppercase tracking-widest ${
              isSingContext ? "text-emerald-500" : isRehabContext ? "text-sky-500" : "text-orange-500"
            }`}
          >
            Patient
          </p>
          <p className="text-sm font-bold text-slate-700">{patientName || "사용자 정보 없음"}</p>
        </div>
        <div className="absolute right-4 top-4 flex items-start gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={onToggleFilterOpen}
              title="필터"
              aria-label="필터"
              className={`h-9 w-9 rounded-lg border transition-colors inline-flex items-center justify-center ${
                modeFilter === "rehab"
                  ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                  : modeFilter === "sing"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    : "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 18h4" />
              </svg>
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 top-11 z-20 w-[220px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Filter
                </p>
                {modeFilter === "rehab" ? (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Sort
                      </p>
                      <button
                        type="button"
                        onClick={() => onSetSortOrder("latest")}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${
                          sortOrder === "latest"
                            ? "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        최신순
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetSortOrder("oldest")}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${
                          sortOrder === "oldest"
                            ? "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        오래된순
                      </button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Step
                      </p>
                    <button
                      type="button"
                      onClick={() => onSetRehabStepFilter("all")}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${
                        rehabStepFilter === "all"
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      전체 훈련
                    </button>
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                      <button
                        key={`filter-step-${step}`}
                        type="button"
                        onClick={() => onSetRehabStepFilter(step as 1 | 2 | 3 | 4 | 5 | 6)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${
                          rehabStepFilter === step
                            ? "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Step {step} · {REHAB_STEP_LABELS[step]}
                      </button>
                    ))}
                  </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => onSetSortOrder("latest")}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${
                        sortOrder === "latest"
                          ? modeFilter === "sing"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      최신순
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetSortOrder("oldest")}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-black ${
                        sortOrder === "oldest"
                          ? modeFilter === "sing"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      오래된순
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onManageIconClick}
            title={!isSelectionMode ? "수정" : "삭제"}
            aria-label={!isSelectionMode ? "수정" : "삭제"}
            className={`h-9 w-9 rounded-lg border transition-colors inline-flex items-center justify-center ${
              isSelectionMode
                ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                : modeFilter === "rehab"
                  ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                  : modeFilter === "sing"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              {isSelectionMode ? (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                </>
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m13.5 7 3.5 3.5" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 좁은 임베드 환경(/mypage 사이드 260px 기준) 에서도 한 줄로 들어가도록
          text-xs + whitespace-nowrap 로 고정. "브레인 노래방" 은 6자 + 공백이라
          가장 먼저 깨졌음. */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onSetModeFilter("self")}
          className={`h-9 whitespace-nowrap rounded-lg border px-1 text-xs font-black transition-colors ${
            modeFilter === "self"
              ? "bg-orange-50 border-orange-300 text-orange-700 shadow-sm ring-1 ring-orange-100"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          자가진단
        </button>
        <button
          type="button"
          onClick={() => onSetModeFilter("rehab")}
          className={`h-9 whitespace-nowrap rounded-lg border px-1 text-xs font-black transition-colors ${
            modeFilter === "rehab"
              ? "bg-sky-50 border-sky-300 text-sky-700 shadow-sm ring-1 ring-sky-100"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          언어재활
        </button>
        <button
          type="button"
          onClick={() => onSetModeFilter("sing")}
          className={`h-9 whitespace-nowrap rounded-lg border px-1 text-xs font-black transition-colors ${
            modeFilter === "sing"
              ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm ring-1 ring-emerald-100"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          노래방
        </button>
      </div>

      {isSelectionMode && showDeleteConfirm && (
        <div className="absolute inset-0 z-30 rounded-2xl bg-slate-900/25 backdrop-blur-[2px] flex items-start justify-center p-4 pt-20">
          <div className="w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                </svg>
              </span>
              <p className="text-sm font-black text-slate-900">기록 삭제 확인</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-black text-slate-800">
                선택한 <span className="text-red-600">{selectedHistoryIds.size}개</span> 기록을 삭제할까요?
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">삭제 후에는 복구할 수 없습니다.</p>
            </div>
            <div className="px-4 pb-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onDismissDeleteConfirm}
                className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteSelected}
                className="h-8 px-3 rounded-lg border border-red-300 bg-red-600 text-xs font-black text-white hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-bold text-slate-500">
          {modeFilter === "rehab"
            ? "저장된 언어재활 리포트가 없습니다."
            : modeFilter === "sing"
              ? "저장된 브레인 노래방 리포트가 없습니다."
              : "저장된 자가진단 리포트가 없습니다."}
        </div>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
          {isSelectionMode && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 flex items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  className={`w-5 h-5 rounded border transition-colors inline-flex items-center justify-center ${
                    allRehabSelected ? selectionCheckedClass : "bg-white border-slate-300 text-transparent"
                  }`}
                  aria-label={allRehabSelected ? "전체 선택 해제" : "전체 선택"}
                  title={allRehabSelected ? "전체 선택 해제" : "전체 선택"}
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                </button>
                <p className="text-xs font-black text-slate-700">{selectedHistoryIds.size}개 선택됨</p>
              </div>
            </div>
          )}

          {filteredHistory.map((row) => (
            <button
              key={row.historyId}
              type="button"
              onClick={() => {
                if (isSelectionMode) {
                  onToggleHistorySelection(row.historyId);
                  return;
                }
                onSelectHistory(row);
              }}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selectedHistoryIds.has(row.historyId)
                  ? "border-red-300 bg-red-50"
                  : selectedHistoryId === row.historyId
                    ? row.trainingMode === "rehab"
                      ? "border-sky-300 bg-sky-50"
                      : row.trainingMode === "sing"
                        ? "border-emerald-300 bg-emerald-50"
                      : "border-orange-300 bg-orange-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-2">
                {isSelectionMode && (
                  <span
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                      selectedHistoryIds.has(row.historyId)
                        ? selectionCheckedClass
                        : "border-slate-300 bg-white text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                    </svg>
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800">
                    {new Date(row.completedAt).toLocaleString("ko-KR")}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        row.trainingMode === "rehab"
                          ? "bg-sky-100 text-sky-700"
                          : row.trainingMode === "sing"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {row.trainingMode === "rehab"
                        ? "언어재활"
                        : row.trainingMode === "sing"
                          ? "브레인 노래방"
                          : "자가진단"}
                    </span>
                    <p className="text-[11px] font-bold text-slate-600">
                      {row.trainingMode === "rehab"
                        ? `장소: ${getPlaceLabel(row.place)} · 훈련: ${getRehabItemLabel(row)} · 점수: ${getRehabRowScore(row).toFixed(1)}점`
                        : row.trainingMode === "sing"
                          ? `곡: ${row.singResult?.song ?? "-"} · 뇌 활력 점수: ${Number(row.singResult?.score ?? row.aq ?? 0).toFixed(1)}점`
                        : `장소: ${getPlaceLabel(row.place)} · 평가점수: ${Number(row.aq || 0).toFixed(1)}점`}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
