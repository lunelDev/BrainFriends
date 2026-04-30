// src/components/aac/AACBoard.tsx
//
// AAC (보완대체 의사소통) 입력 보드. 발화가 어려운 환자가 심볼 시퀀스로
// 의사를 표현할 수 있도록 한다. 제품제안서 p.7 5채널 중 5번 보조 채널.
//
// UX 결정:
//   - 화면 상단: place 탭 6개 (TRAINING_PLACES 와 동일 모델). place 변경 시 진행 중인 시퀀스는 유지.
//   - 화면 중단: kind 별 그룹 (주어 / 의도 / 사물). 각 심볼은 emoji + label.
//   - 화면 하단: 선택 시퀀스 preview + buildAacIntentSentence() 결과 + "이 문장으로 말하기" 버튼.
//   - "이 문장으로 말하기" 클릭 시 onCommit 콜백 호출. 컴포넌트는 라우팅을 모른다.
//
// 운영 메모:
//   - 본 컴포넌트는 standalone 화면 (`/programs/aac`) 에서 1차 사용.
//   - 추후 step-2 / step-4 의 "말 대신 심볼" 토글 형태로 통합 시 동일 컴포넌트 재사용 가능.

"use client";

import React, { useMemo, useState } from "react";
import {
  AacSymbol,
  getAacSymbolsForPlace,
} from "@/constants/aacData";
import {
  TRAINING_PLACES,
  type PlaceType,
} from "@/constants/trainingData";
import { buildAacIntentSentence } from "@/lib/aac/intentTemplate";

export interface AACBoardProps {
  initialPlace?: PlaceType;
  /** 환자가 "이 문장으로 말하기" 를 누르면 호출. 부모가 후처리(저장/다음 화면)를 담당. */
  onCommit?: (payload: {
    place: PlaceType;
    symbolIds: string[];
    sentence: string;
  }) => void;
}

const KIND_GROUPS: Array<{
  key: AacSymbol["kind"];
  title: string;
  emptyHint: string;
}> = [
  { key: "subject", title: "주어 (누가)", emptyHint: "주어가 없습니다" },
  { key: "intent", title: "의도 (무엇을 / 어떻게)", emptyHint: "의도 표현이 없습니다" },
  { key: "noun", title: "사물 / 대상", emptyHint: "사물이 없습니다" },
];

export default function AACBoard({
  initialPlace = "home",
  onCommit,
}: AACBoardProps) {
  const [place, setPlace] = useState<PlaceType>(initialPlace);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const symbols = useMemo(() => getAacSymbolsForPlace(place), [place]);

  const grouped = useMemo(() => {
    return KIND_GROUPS.map((group) => ({
      ...group,
      items: symbols.filter((s) => s.kind === group.key),
    }));
  }, [symbols]);

  const buildResult = useMemo(
    () => buildAacIntentSentence({ symbolIds: selectedIds }),
    [selectedIds],
  );

  const handlePick = (sym: AacSymbol) => {
    setSelectedIds((prev) => [...prev, sym.id]);
  };

  const handleUndo = () => {
    setSelectedIds((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setSelectedIds([]);
  };

  const handleCommit = () => {
    if (!buildResult.sentence) return;
    onCommit?.({
      place,
      symbolIds: [...selectedIds],
      sentence: buildResult.sentence,
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
      <div className="flex flex-wrap gap-2">
        {TRAINING_PLACES.map((p) => {
          const active = p.id === place;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlace(p.id as PlaceType)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-bold transition ${
                active
                  ? "border-orange-500 bg-orange-500 text-white shadow"
                  : "border-slate-200 bg-white text-slate-600 hover:border-orange-300"
              }`}
            >
              <span className="mr-1">{p.icon}</span>
              {p.title}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.key}>
            <p className="mb-2 text-[12px] font-black uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
            {group.items.length === 0 ? (
              <p className="text-[13px] text-slate-400">{group.emptyHint}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {group.items.map((sym) => (
                  <button
                    key={sym.id}
                    type="button"
                    onClick={() => handlePick(sym)}
                    className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 transition hover:border-orange-300 hover:bg-orange-50"
                    aria-label={sym.label}
                  >
                    <span className="text-2xl leading-none" aria-hidden>
                      {sym.emoji}
                    </span>
                    <span className="text-[12px] font-bold text-slate-700">
                      {sym.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">
          만들어진 문장
        </p>
        <p className="mt-1 min-h-[1.5em] text-[16px] font-extrabold text-slate-800">
          {buildResult.sentence || "심볼을 선택해 주세요"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          선택: {selectedIds.length === 0 ? "없음" : selectedIds.length + "개"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={selectedIds.length === 0}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 disabled:opacity-40"
          >
            ⌫ 마지막 취소
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={selectedIds.length === 0}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 disabled:opacity-40"
          >
            전체 지우기
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={!buildResult.sentence}
            className="rounded-full bg-orange-500 px-4 py-1.5 text-[13px] font-black text-white shadow disabled:opacity-40"
          >
            이 문장으로 말하기
          </button>
        </div>
      </div>
    </div>
  );
}
