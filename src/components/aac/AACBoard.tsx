// src/components/aac/AACBoard.tsx
//
// AAC (보완대체 의사소통) 입력 보드. 발화가 어려운 환자가 심볼 시퀀스로
// 의사를 표현할 수 있도록 한다. 제품제안서 p.7 5채널 중 5번 보조 채널.
//
// UX 결정:
//   - 화면 최상단: "필수 표현" 퀵 스트립 (긴급 / 감정 / 통증 / 인사).
//                  장소 탭과 무관하게 항상 노출. 응급 호소가 즉시 가능해야 하므로
//                  탭 전환 1단계로 응급 카테고리 진입을 보장한다.
//   - 그 아래: place 탭 6개 (TRAINING_PLACES 와 동일 모델). place 변경 시 진행 중인 시퀀스는 유지.
//   - 화면 중단: kind 별 그룹 (주어 / 의도 / 사물). 각 심볼은 emoji + label.
//   - 화면 하단: 선택 시퀀스 preview + buildAacIntentSentence() 결과 + "이 문장으로 말하기" 버튼.
//   - "이 문장으로 말하기" 클릭 시 onCommit 콜백 호출. 컴포넌트는 라우팅을 모른다.
//   - 심볼 클릭 시: 브라우저 내장 SpeechSynthesis (ko-KR) 로 라벨 즉시 재생.
//                  외부 API 호출 0 → 비용 0. 음소거 토글로 끄기 가능.
//
// 운영 메모:
//   - 본 컴포넌트는 standalone 화면 (`/programs/aac`, `/select-page/aac`) 에서 사용.
//   - 추후 step-2 / step-4 의 "말 대신 심볼" 토글 형태로 통합 시 동일 컴포넌트 재사용 가능.

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AAC_QUICK_GROUPS,
  AAC_QUICK_SYMBOLS_BY_CATEGORY,
  AacQuickCategory,
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

const QUICK_TONE_CLASS: Record<
  AacQuickCategory,
  { active: string; idle: string; tile: string }
> = {
  emergency: {
    active: "border-rose-500 bg-rose-500 text-white shadow",
    idle: "border-rose-200 bg-white text-rose-700 hover:border-rose-400",
    tile: "border-rose-200 bg-rose-50 hover:border-rose-400 hover:bg-rose-100",
  },
  feeling: {
    active: "border-sky-500 bg-sky-500 text-white shadow",
    idle: "border-sky-200 bg-white text-sky-700 hover:border-sky-400",
    tile: "border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100",
  },
  body_pain: {
    active: "border-amber-500 bg-amber-500 text-white shadow",
    idle: "border-amber-200 bg-white text-amber-700 hover:border-amber-400",
    tile: "border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100",
  },
  greeting: {
    active: "border-emerald-500 bg-emerald-500 text-white shadow",
    idle: "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400",
    tile:
      "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100",
  },
};

/**
 * 한국어 TTS 발화 텍스트 정규화.
 * - 3자리 이상 연속 숫자는 한 자릿수 한글로 풀어 읽도록 치환한다.
 *   응급/콜센터 번호(119, 112, 1339, 1577 등) 가 "백십구"·"백십이" 같이
 *   수사로 읽히지 않도록 보정. 임상 AAC 에서 3자리 이상 연속 숫자는
 *   대부분 전화/식별 번호라 휴리스틱이 안전하다.
 * - UI 라벨은 그대로 두고 TTS 입력만 변환 → 시각적 가독성과 발화 명료성 둘 다 유지.
 */
const TTS_DIGIT_KO: Record<string, string> = {
  "0": "공",
  "1": "일",
  "2": "이",
  "3": "삼",
  "4": "사",
  "5": "오",
  "6": "육",
  "7": "칠",
  "8": "팔",
  "9": "구",
};

function normalizeForKoreanTts(text: string): string {
  return text.replace(/\d{3,}/g, (run) =>
    run
      .split("")
      .map((d) => TTS_DIGIT_KO[d] ?? d)
      .join(""),
  );
}

/**
 * 한국어 TTS 재생.
 * - 브라우저 내장 SpeechSynthesis 만 사용 (외부 API 호출 0, 비용 0).
 * - SSR / 미지원 브라우저 / 음소거 상태에서는 조용히 무시.
 * - 직전 발화는 cancel 하여 빠른 연타에도 끊김 자연스럽게.
 */
function speakKorean(text: string, muted: boolean) {
  if (muted) return;
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const normalized = normalizeForKoreanTts(trimmed);

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(normalized);
    utterance.lang = "ko-KR";
    utterance.rate = 1;
    utterance.pitch = 1;

    // ko-KR 보이스가 있으면 우선 선택. 없으면 기본 보이스로 폴백.
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const koVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("ko"));
    if (koVoice) utterance.voice = koVoice;

    window.speechSynthesis.speak(utterance);
  } catch {
    // SpeechSynthesis 가 throw 해도 컴포넌트 동작은 막지 않는다.
  }
}

export default function AACBoard({
  initialPlace = "home",
  onCommit,
}: AACBoardProps) {
  const [place, setPlace] = useState<PlaceType>(initialPlace);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickCategory, setQuickCategory] = useState<AacQuickCategory>(
    "emergency",
  );
  const [muted, setMuted] = useState<boolean>(false);
  // SpeechSynthesis 가 voiceschanged 이벤트로 리스트를 비동기 채움.
  // 첫 렌더 시점에 빈 배열일 수 있어, 이벤트로 한 번 워밍업해 둔다.
  const voicesWarmedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    if (voicesWarmedRef.current) return;
    voicesWarmedRef.current = true;
    const handler = () => {
      // no-op: 호출 자체로 voices 캐시 워밍업.
      window.speechSynthesis.getVoices?.();
    };
    window.speechSynthesis.getVoices?.();
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
    };
  }, []);

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

  const quickItems = AAC_QUICK_SYMBOLS_BY_CATEGORY[quickCategory];
  const activeQuickGroup = AAC_QUICK_GROUPS.find(
    (g) => g.key === quickCategory,
  )!;

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
    speakKorean(buildResult.sentence, muted);
    onCommit?.({
      place,
      symbolIds: [...selectedIds],
      sentence: buildResult.sentence,
    });
  };

  const handleSpeakCurrent = () => {
    if (!buildResult.sentence) return;
    speakKorean(buildResult.sentence, muted);
  };

  const sentencePreview = (
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
          onClick={handleSpeakCurrent}
          disabled={!buildResult.sentence}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[12px] font-bold text-emerald-700 disabled:opacity-40"
        >
          <span aria-hidden>🔊</span>
          문장 듣기
        </button>
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
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
      <div className="sticky top-0 z-40 -mx-4 -mt-4 border-b border-orange-100 bg-white/95 px-4 pb-3 pt-3 shadow-[0_8px_22px_rgba(15,23,42,0.08)] backdrop-blur">
        {sentencePreview}
      </div>

      {/* 1) 필수 표현 퀵 스트립 — 장소 탭과 무관하게 항상 위쪽에 배치 */}
      <section
        aria-label="필수 표현 빠른 호소"
        className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            필수 표현 · Quick
          </p>
          <button
            type="button"
            onClick={() => {
              setMuted((prev) => {
                const next = !prev;
                if (next && typeof window !== "undefined") {
                  window.speechSynthesis?.cancel?.();
                }
                return next;
              });
            }}
            aria-pressed={muted}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition ${
              muted
                ? "border-slate-300 bg-slate-100 text-slate-500"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
            }`}
          >
            <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
            {muted ? "음소거" : "소리 켜짐"}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {AAC_QUICK_GROUPS.map((group) => {
            const active = group.key === quickCategory;
            const tone = QUICK_TONE_CLASS[group.key];
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setQuickCategory(group.key)}
                className={`rounded-full border px-3 py-1 text-[12px] font-black transition ${
                  active ? tone.active : tone.idle
                }`}
              >
                {group.shortTitle}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[12px] font-bold text-slate-700">
          {activeQuickGroup.title}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {quickItems.map((sym) => {
            const tone = QUICK_TONE_CLASS[quickCategory];
            return (
              <button
                key={sym.id}
                type="button"
                onClick={() => handlePick(sym)}
                aria-label={sym.label}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${tone.tile}`}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {sym.emoji}
                </span>
                <span className="text-[13px] font-extrabold leading-tight text-slate-800">
                  {sym.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2) 장소 탭 */}
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

      {/* 3) 주어/의도/사물 그룹 */}
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

    </div>
  );
}
