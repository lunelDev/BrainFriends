"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadPatientProfile } from "@/lib/patientStorage";
import { PlaceType } from "@/constants/trainingData";
import { FLUENCY_SCENARIOS } from "@/constants/fluencyData";
import {
  calculateKWABScores,
  getAQNormalComparison,
  scoreContentDelivery,
  scoreFluency,
} from "@/lib/kwab/KWABScoring";
import {
  SessionManager,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";
import { addSentenceLineBreaks } from "@/lib/text/displayText";
import {
  Trophy,
  Activity,
  FileText,
  ScanFace,
  Database,
  Printer,
  CheckCircle2,
  Sparkles,
  HeartHandshake,
  Headphones,
  MessageSquare,
  Image,
  Zap,
  BookOpen,
  PenTool,
} from "lucide-react";

function getResultSummarySizeClass(text: string): string {
  const normalizedLength = (text || "").replace(/\s+/g, "").length;
  if (normalizedLength >= 56) return "text-sm md:text-base";
  if (normalizedLength >= 36) return "text-base md:text-lg";
  return "text-lg md:text-xl";
}

// --- 데이터 타입 및 유틸리티 로직 (보존) ---
type ExportFile = { name: string; data: Uint8Array };
type DerivedKwab = {
  evidence: Array<any>;
  spontaneousSpeech: {
    contentScore: number;
    fluencyScore: number;
    total: number;
  };
  auditoryComprehension: {
    yesNoScore: number;
    wordRecognitionScore: number;
    commandScore: number;
    total: number;
  };
  repetition: { totalScore: number };
  naming: {
    objectNamingScore: number;
    wordFluencyScore: number;
    sentenceCompletionScore: number;
    sentenceResponseScore: number;
    total: number;
  };
  contentScore: number;
  fluencyScore: number;
  spontaneousTotal: number;
  aq: number;
  lq: number;
  cq: number;
  aphasiaType: string | null;
  classificationBasis: {
    fluency: number;
    comprehension: number;
    repetition: number;
    naming: number;
  };
  classificationReason: string;
  severity: string;
  percentile: number;
};

// ZIP 생성 관련 유틸리티 (보존)
function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
}
const CRC32_TABLE = makeCrc32Table();
function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    crc = (CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}
function concatUint8Arrays(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
function dataUrlToBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match)
    return { bytes: new Uint8Array(), mime: "application/octet-stream" };
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}
function createZipBlob(files: ExportFile[]) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    localChunks.push(localHeader, file.data);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralChunks.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }
  const centralSize = centralChunks.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob(
    [concatUint8Arrays([...localChunks, ...centralChunks, end])],
    { type: "application/zip" },
  );
}

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<number | null>(1);
  const [openAllAccordions, setOpenAllAccordions] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [selectedHistory, setSelectedHistory] =
    useState<TrainingHistoryEntry | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const place = useMemo(
    () => (searchParams.get("place") as PlaceType) || "home",
    [searchParams],
  );
  const isRehabResult = searchParams.get("trainMode") === "rehab";
  const currentTrainingMode = isRehabResult ? "rehab" : "self";
  const rehabTargetStep = Number(searchParams.get("targetStep") || "0");
  const patientProfile = useMemo(() => loadPatientProfile(), []);
  const patientForHistory = useMemo(() => {
    if (!patientProfile) return null;
    return {
      age: Number((patientProfile as any).age ?? 0),
      educationYears: Number((patientProfile as any).educationYears ?? 0),
      ...(patientProfile as any),
    } as any;
  }, [patientProfile]);

  // --- 기존 연산 로직 (보존) ---
  const queryScores = useMemo(
    () => ({
      1: Number(searchParams.get("step1") || 0),
      2: Number(searchParams.get("step2") || 0),
      3: Number(searchParams.get("step3") || 0),
      4: Number(searchParams.get("step4") || 0),
      5: Number(searchParams.get("step5") || 0),
      6: Number(searchParams.get("step6") || 0),
    }),
    [searchParams],
  );

  const deriveSpontaneousSpeechFromStep4 = (items: any[]) => {
    if (!items.length) {
      return { contentScore: 8, fluencyScore: 8 };
    }

    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, "");
    const scenarios = FLUENCY_SCENARIOS[place] || [];

    const itemAnalyses = items.map((item: any) => {
      const transcript = String(
        item?.transcript || item?.text || item?.targetText || "",
      );
      const normalizedTranscript = normalize(transcript);

      const matchedScenario =
        scenarios.find(
          (s) =>
            s.prompt === item?.prompt ||
            s.situation === item?.situation ||
            s.situation === item?.text,
        ) || null;
      const keywords = matchedScenario?.answerKeywords || [];

      const uniqueHits = keywords.filter((kw, idx) => {
        if (!kw) return false;
        if (keywords.indexOf(kw) !== idx) return false;
        return normalizedTranscript.includes(normalize(kw));
      }).length;
      const keywordCoverage = keywords.length
        ? uniqueHits / keywords.length
        : 0;

      const sentenceParts = transcript
        .split(/[.!?\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const utteranceCount = Math.max(1, sentenceParts.length);
      const hangulChars = (transcript.match(/[가-힣]/g) || []).length;
      const syllablesPerUtterance = hangulChars / utteranceCount;
      const hasCompleteSentences =
        sentenceParts.some((s) => s.length >= 12) ||
        /[다요니다]\s*$/.test(transcript);
      const hasWordFindingDifficulty = /(음|어|저기|그게|그거|...|…)/.test(
        transcript,
      );
      const speechDurationSec = Number(item?.speechDuration || 0);
      const charsPerSec =
        speechDurationSec > 0 ? transcript.length / speechDurationSec : 0;
      const speechRate =
        charsPerSec >= 3 ? "normal" : charsPerSec >= 1.5 ? "slow" : "very_slow";

      return {
        uniqueHits,
        keywordCoverage,
        fluencyKwab:
          Number(item?.fluencyScore ?? item?.kwabScore) ||
          scoreFluency({
            syllablesPerUtterance,
            hasCompleteSentences,
            hasWordFindingDifficulty,
            speechRate,
          }),
      };
    });

    // K-WAB 내용전달 점수(0~10): 질문 정반응(0~6) + 그림설명 요소수 기반 근사
    const goodCoverageCount = itemAnalyses.filter(
      (a) => a.keywordCoverage >= 0.2,
    ).length;
    const correctAnswers = Math.min(
      6,
      Math.round((goodCoverageCount / Math.max(1, items.length)) * 6),
    );
    const pictureDescriptionItems = itemAnalyses.reduce(
      (sum, a) => sum + a.uniqueHits,
      0,
    );
    const contentScore = scoreContentDelivery({
      correctAnswers,
      pictureDescriptionItems,
    });

    // K-WAB 유창성 점수(0~10): 대화/과제 수행 유창성 평균 근사
    const fluencyScore =
      itemAnalyses.reduce((sum, a) => sum + a.fluencyKwab, 0) /
      Math.max(1, itemAnalyses.length);

    return {
      contentScore: Math.max(0, Math.min(10, Number(contentScore || 0))),
      fluencyScore: Math.max(0, Math.min(10, Number(fluencyScore || 0))),
    };
  };

  const derivedKwab = useMemo<DerivedKwab | null>(() => {
    if (!sessionData) return null;
    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const s1 = sessionData?.step1?.items || [];
    const s2 = sessionData?.step2?.items || [];
    const s3 = sessionData?.step3?.items || [];
    const s4 = sessionData?.step4?.items || [];
    const step1Accuracy = s1.length
      ? s1.filter((i: any) => i.isCorrect).length / s1.length
      : queryScores[1] / 20;
    const step3Accuracy = s3.length
      ? s3.filter((i: any) => i?.isCorrect).length / s3.length
      : Math.max(0, Math.min(1, Number(queryScores[3] || 0) / 100));
    const spontaneousSpeech = deriveSpontaneousSpeechFromStep4(s4);

    const scorePack = calculateKWABScores(
      {
        age: Number(loadPatientProfile()?.age ?? 65),
        educationYears: Number(loadPatientProfile()?.educationYears ?? 6),
      },
      {
        spontaneousSpeech,
        auditoryComprehension: {
          yesNoScore: Math.round(step1Accuracy * 60),
          // Step3(단어 명명) 정확도를 낱말 인지 점수에 반영
          wordRecognitionScore: Math.round(step3Accuracy * 60),
          commandScore: Math.round(step1Accuracy * 80),
        },
        repetition: {
          totalScore: Math.max(
            0,
            Math.min(
              100,
              Math.round(
                avg(
                  s2.map((i: any) =>
                    Number(i?.finalScore ?? i?.speechScore ?? 0),
                  ),
                ) || queryScores[2],
              ),
            ),
          ),
        },
        naming: {
          objectNamingScore: 60,
          wordFluencyScore: 20,
          sentenceCompletionScore: 10,
          sentenceResponseScore: 10,
        },
        reading: { totalScore: 0 },
        writing: { totalScore: 0 },
      },
    );
    return { ...scorePack, aq: Number(scorePack.aq.toFixed(1)) } as any;
  }, [place, queryScores, sessionData]);

  const stepDetails = useMemo(() => {
    const clamp = (v: number, min = 0, max = 100) =>
      Math.min(max, Math.max(min, v));
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const fmt1 = (v: number) =>
      Number.isInteger(v) ? String(v) : v.toFixed(1);

    const s1 = sessionData?.step1?.items || [];
    const s2 = sessionData?.step2?.items || [];
    const s3 = sessionData?.step3?.items || [];
    const s4 = sessionData?.step4?.items || [];
    const s5 = sessionData?.step5?.items || [];
    const s6 = sessionData?.step6?.items || [];

    const s1Correct = s1.filter((i: any) => i?.isCorrect).length;
    const s1Total = s1.length || 20;
    const s1Percent = s1.length
      ? clamp((s1Correct / s1.length) * 100)
      : clamp((queryScores[1] / 20) * 100);

    const s2Score = s2.length
      ? clamp(
          avg(s2.map((i: any) => Number(i?.finalScore ?? i?.speechScore ?? 0))),
        )
      : clamp(queryScores[2]);

    const s3Correct = s3.filter((i: any) => i?.isCorrect).length;
    const s3Total = s3.length || 10;
    const s3Percent = s3.length
      ? clamp((s3Correct / s3.length) * 100)
      : clamp(queryScores[3]);

    const s4Score = s4.length
      ? Math.min(
          10,
          Math.max(
            0,
            avg(
              s4.map((i: any) => Number(i?.fluencyScore ?? i?.kwabScore ?? 0)),
            ),
          ),
        )
      : Math.min(10, Math.max(0, Number(queryScores[4] || 0)));
    const s4Percent = clamp(s4Score * 10);

    const s5Percent = s5.length
      ? clamp(
          avg(
            s5.map((i: any) =>
              Number.isFinite(Number(i?.readingScore))
                ? Number(i?.readingScore)
                : i?.isCorrect
                  ? 100
                  : 0,
            ),
          ),
        )
      : clamp(queryScores[5]);

    const s6Score = s6.length
      ? clamp(
          avg(
            s6.map((i: any) =>
              Number.isFinite(Number(i?.writingScore))
                ? Number(i?.writingScore)
                : i?.isCorrect
                  ? 100
                  : 0,
            ),
          ),
        )
      : clamp(queryScores[6]);

    return [
      {
        id: 1,
        title: "청각 이해",
        display: `${s1Correct}/${s1Total}`,
        percent: s1Percent,
        metric: `${s1Correct}/${s1Total}`,
      },
      {
        id: 2,
        title: "따라말하기",
        display: `${Math.round(s2Score)}점`,
        percent: s2Score,
        metric: `${Math.round(s2Score)}%`,
      },
      {
        id: 3,
        title: "단어 명명",
        display: `${s3Correct}/${s3Total}`,
        percent: s3Percent,
        metric: `${s3Correct}/${s3Total}`,
      },
      {
        id: 4,
        title: "유창성",
        display: `${fmt1(s4Score)}/10`,
        percent: s4Percent,
        metric: `${fmt1(s4Score)}/10`,
      },
      {
        id: 5,
        title: "읽기",
        display: `${Math.round(s5Percent)}점`,
        percent: s5Percent,
        metric: `${Math.round(s5Percent)}%`,
      },
      {
        id: 6,
        title: "쓰기",
        display: `${Math.round(s6Score)}점`,
        percent: s6Score,
        metric: `${Math.round(s6Score)}점`,
      },
    ];
  }, [queryScores, sessionData]);

  const profileNodes = useMemo(() => {
    const center = 180;
    const baseRadius = 90;
    const badgeRadius = 138;
    return stepDetails.map((d, i) => {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const valueRadius = (Math.min(d.percent, 100) / 100) * baseRadius;
      const x = center + valueRadius * Math.cos(angle);
      const y = center + valueRadius * Math.sin(angle);
      const perNodeBadgeRadius = i === 0 || i === 3 ? 124 : badgeRadius;
      const badgeX = center + perNodeBadgeRadius * Math.cos(angle);
      const badgeY = center + perNodeBadgeRadius * Math.sin(angle);
      return {
        ...d,
        x,
        y,
        badgeX,
        badgeY,
        short: d.title,
      };
    });
  }, [stepDetails]);

  const clinicalImpression = useMemo(() => {
    if (!derivedKwab) return null;
    const stepMap = Object.fromEntries(
      stepDetails.map((d) => [d.id, d]),
    ) as Record<number, (typeof stepDetails)[number]>;

    const comprehension = stepMap[1];
    const repetition = stepMap[2];
    const matching = stepMap[3];
    const fluency = stepMap[4];
    const reading = stepMap[5];
    const writing = stepMap[6];

    const domains = [
      {
        name: "청각 이해",
        percent: comprehension.percent,
        metric: comprehension.metric,
      },
      {
        name: "따라말하기",
        percent: repetition.percent,
        metric: repetition.metric,
      },
      { name: "단어 명명", percent: matching.percent, metric: matching.metric },
      { name: "유창성", percent: fluency.percent, metric: fluency.metric },
      { name: "읽기", percent: reading.percent, metric: reading.metric },
      { name: "쓰기", percent: writing.percent, metric: writing.metric },
    ];
    const strongest = domains.reduce((a, b) =>
      a.percent >= b.percent ? a : b,
    );
    const weakest = domains.reduce((a, b) => (a.percent <= b.percent ? a : b));

    return {
      summary: `일상 대화의 바탕이 잘 유지되고 있으며, 전반적으로 의사소통을 이어갈 수 있는 힘이 확인됩니다. 특히 ${strongest.name}은 안정적으로 나타났고, ${weakest.name}은 생활 속 반복 연습을 통해 더 편안해질 수 있습니다.`,
      strength: `${strongest.name}(${strongest.metric})이 특히 안정적으로 확인되었습니다. 이 부분은 아주 건강하시네요!`,
      need: `${weakest.name}(${weakest.metric})은 조금 더 연습이 필요한 부분입니다. 이 부분이 좋아지면 가족과 대화할 때 떠오른 생각을 더 또렷하게 전하고, 외출이나 전화 상황에서도 원하는 말을 더 편안하게 표현하는 데 도움이 됩니다.`,
      recommendation:
        "오늘은 집에서 15분만 가볍게 연습해 보세요. 사진이나 생활 물건을 보며 이름 말하기 5분, 짧은 문장 따라 말하기 5분, 소리 내어 읽기 5분을 주 5회 꾸준히 이어가면 일상 대화가 한층 자연스러워집니다. 지금처럼 차분하게 이어가시면 분명 더 좋아질 수 있습니다.",
      strongestText: `${strongest.name} ${strongest.metric}`,
      weakestText: `${weakest.name} ${weakest.metric}`,
      encourageText: "하루 15분 · 주 5회 생활 연습",
    };
  }, [derivedKwab, stepDetails]);

  const formattedClinicalImpression = useMemo(() => {
    if (!clinicalImpression) return null;
    return {
      ...clinicalImpression,
      summary: clinicalImpression.summary,
      strength: clinicalImpression.strength,
      need: clinicalImpression.need,
      recommendation: clinicalImpression.recommendation,
    };
  }, [clinicalImpression]);

  const normalComparison = useMemo(() => {
    if (!derivedKwab) return null;
    const age = Number((patientProfile as any)?.age ?? 65);
    const educationYears = Number((patientProfile as any)?.educationYears ?? 6);
    return getAQNormalComparison(derivedKwab.aq, age, educationYears);
  }, [derivedKwab, patientProfile]);

  const latestAndPreviousHistory = useMemo(() => {
    if (!patientForHistory) return { current: null, previous: null };
    const all = SessionManager.getHistoryFor(patientForHistory)
      .filter((row) => !String(row.historyId || "").startsWith("mock_"))
      .filter((row) =>
        currentTrainingMode === "rehab"
          ? row.trainingMode === "rehab"
          : row.trainingMode !== "rehab",
      )
      .sort((a, b) => b.completedAt - a.completedAt);
    return {
      current: all[0] ?? null,
      previous: all[1] ?? null,
    };
  }, [currentTrainingMode, historyRefreshKey, patientForHistory]);

  const facialReport = useMemo(() => {
    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const toNum = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const s2 = sessionData?.step2?.items || [];
    const s4 = sessionData?.step4?.items || [];
    const s5 = sessionData?.step5?.items || [];
    const scoreFromItems = (items: any[], key: string) =>
      avg(
        items.map((it: any) => toNum(it?.[key])).filter((v: number) => v > 0),
      );

    const current = latestAndPreviousHistory.current;
    const previous = latestAndPreviousHistory.previous;

    const step2Consonant =
      toNum(current?.articulationScores?.step2?.averageConsonantAccuracy) ||
      scoreFromItems(s2, "consonantAccuracy");
    const step2Vowel =
      toNum(current?.articulationScores?.step2?.averageVowelAccuracy) ||
      scoreFromItems(s2, "vowelAccuracy");
    const step4Consonant =
      toNum(current?.articulationScores?.step4?.averageConsonantAccuracy) ||
      scoreFromItems(s4, "consonantAccuracy");
    const step4Vowel =
      toNum(current?.articulationScores?.step4?.averageVowelAccuracy) ||
      scoreFromItems(s4, "vowelAccuracy");
    const step5Consonant =
      toNum(current?.articulationScores?.step5?.averageConsonantAccuracy) ||
      scoreFromItems(s5, "consonantAccuracy");
    const step5Vowel =
      toNum(current?.articulationScores?.step5?.averageVowelAccuracy) ||
      scoreFromItems(s5, "vowelAccuracy");

    const overallConsonant = avg(
      [step2Consonant, step4Consonant, step5Consonant].filter((v) => v > 0),
    );
    const overallVowel = avg(
      [step2Vowel, step4Vowel, step5Vowel].filter((v) => v > 0),
    );
    const asymmetryRisk = toNum(current?.facialAnalysisSnapshot?.asymmetryRisk);
    const prevAsymmetryRisk = toNum(
      previous?.facialAnalysisSnapshot?.asymmetryRisk,
    );
    const asymmetryDelta =
      prevAsymmetryRisk > 0
        ? Number((asymmetryRisk - prevAsymmetryRisk).toFixed(1))
        : null;
    const articulationGap =
      toNum(current?.facialAnalysisSnapshot?.articulationGap) ||
      Number(Math.abs(overallConsonant - overallVowel).toFixed(1));

    const riskLabel =
      asymmetryRisk >= 45 ? "고위험" : asymmetryRisk >= 30 ? "주의" : "저위험";

    const hasCameraData =
      [
        step2Consonant,
        step2Vowel,
        step4Consonant,
        step4Vowel,
        step5Consonant,
        step5Vowel,
      ].some((v) => v > 0) || asymmetryRisk > 0;
    if (!hasCameraData) return null;

    return {
      overallConsonant,
      overallVowel,
      step2Consonant,
      step2Vowel,
      step4Consonant,
      step4Vowel,
      step5Consonant,
      step5Vowel,
      asymmetryRisk,
      asymmetryDelta,
      articulationGap,
      riskLabel,
      summary:
        current?.facialAnalysisSnapshot?.articulationFaceMatchSummary ||
        "음성-안면 매칭 추적 데이터가 아직 충분하지 않습니다.",
    };
  }, [latestAndPreviousHistory, sessionData]);


  const previousHistory = useMemo(() => {
    if (!patientForHistory) return [];
    const all = SessionManager.getHistoryFor(patientForHistory)
      .filter((row) => !String(row.historyId || "").startsWith("mock_"))
      .filter((row) =>
        currentTrainingMode === "rehab"
          ? row.trainingMode === "rehab"
          : row.trainingMode !== "rehab",
      )
      .sort((a, b) => b.completedAt - a.completedAt);

    return all.length > 1 ? all.slice(1) : [];
  }, [currentTrainingMode, historyRefreshKey, patientForHistory]);

  const rehabComparison = useMemo(() => {
    if (!isRehabResult || rehabTargetStep < 1 || rehabTargetStep > 6)
      return null;
    const current = stepDetails.find((s) => s.id === rehabTargetStep);
    if (!current) return null;
    const latestPrevious = previousHistory[0];
    const key =
      `step${rehabTargetStep}` as keyof TrainingHistoryEntry["stepScores"];
    const prevScore = latestPrevious
      ? Number(latestPrevious.stepScores?.[key] ?? 0)
      : null;
    const currScore = Number(current.percent ?? 0);
    const delta =
      prevScore === null ? null : Number((currScore - prevScore).toFixed(1));
    return { current, prevScore, currScore, delta };
  }, [isRehabResult, rehabTargetStep, stepDetails, previousHistory]);

  const aqSeverityLabel = (aq: number) => {
    if (aq >= 93.8) return "정상 범위";
    if (aq >= 76) return "경도";
    if (aq >= 51) return "중등도";
    if (aq >= 26) return "중증";
    return "최중증";
  };
  const HISTORY_PAGE_SIZE = 4;
  const historyTotalPages = Math.max(
    1,
    Math.ceil(previousHistory.length / HISTORY_PAGE_SIZE),
  );
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return previousHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyPage, previousHistory]);

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    if (
      selectedHistory &&
      !previousHistory.some(
        (row) => row.historyId === selectedHistory.historyId,
      )
    ) {
      setSelectedHistory(null);
    }
  }, [previousHistory, selectedHistory]);

  const parseStoredArray = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // --- 데이터 불러오기 및 내보내기 로직 (보존) ---
  useEffect(() => {
    setIsMounted(true);
    const backups = {
      step1: parseStoredArray("step1_data"),
      step2: parseStoredArray("step2_recorded_audios"),
      step3: parseStoredArray("step3_data"),
      step4: parseStoredArray("step4_recorded_audios"),
      step5: parseStoredArray("step5_recorded_data"),
      step6: parseStoredArray("step6_recorded_data"),
    };
    setSessionData({
      step1: { items: backups.step1 },
      step2: { items: backups.step2 },
      step3: { items: backups.step3 },
      step4: { items: backups.step4 },
      step5: { items: backups.step5 },
      step6: { items: backups.step6 },
    });
    console.debug("[Result] backups loaded", {
      step1: backups.step1.length,
      step2: backups.step2.length,
      step3: backups.step3.length,
      step4: backups.step4.length,
      step5: backups.step5.length,
      step6: backups.step6.length,
    });
  }, []);

  useEffect(() => {
    if (!patientProfile) return;
    try {
      const sm = new SessionManager(patientProfile as any, place);
      sm.finalizeSessionAndSaveHistory(currentTrainingMode);
      setHistoryRefreshKey((v) => v + 1);
    } catch (e) {
      console.error("Result finalize/save history failed:", e);
    }
  }, [currentTrainingMode, patientProfile, place]);

  const handleExportData = () => {
    if (!sessionData) return;
    const patient = loadPatientProfile();
    const historyForPatient = patient
      ? SessionManager.getHistoryFor(patient as any).sort(
          (a, b) => b.completedAt - a.completedAt,
        )
      : [];
    const latestExamAt = historyForPatient[0]?.completedAt || Date.now();

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const formatExamDateTime = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    };
    const normalizeBirthDate = (raw: any) => {
      const text = String(raw || "").trim();
      const digits = text.replace(/[^\d]/g, "");
      if (digits.length >= 8) return digits.slice(0, 8);
      return "생년월일미입력";
    };
    const sanitizeName = (raw: any) => {
      const text = String(raw || "").trim() || "이름미입력";
      return text.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    };

    const rawStorageSnapshot = {
      step1_data: parseStoredArray("step1_data"),
      step2_recorded_audios: parseStoredArray("step2_recorded_audios"),
      step3_data: parseStoredArray("step3_data"),
      step4_recorded_audios: parseStoredArray("step4_recorded_audios"),
      step5_recorded_data: parseStoredArray("step5_recorded_data"),
      step6_recorded_data: parseStoredArray("step6_recorded_data"),
    };

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      patient,
      place,
      trainingMode: currentTrainingMode,
      queryScores,
      derivedKwab,
      summaryScores: stepDetails,
      details: sessionData,
      counts: {
        step1: sessionData?.step1?.items?.length || 0,
        step2: sessionData?.step2?.items?.length || 0,
        step3: sessionData?.step3?.items?.length || 0,
        step4: sessionData?.step4?.items?.length || 0,
        step5: sessionData?.step5?.items?.length || 0,
        step6: sessionData?.step6?.items?.length || 0,
      },
    };
    const files: ExportFile[] = [
      {
        name: "result.json",
        data: new TextEncoder().encode(JSON.stringify(exportPayload, null, 2)),
      },
      {
        name: "history.json",
        data: new TextEncoder().encode(
          JSON.stringify(historyForPatient, null, 2),
        ),
      },
      {
        name: "storage-snapshot.json",
        data: new TextEncoder().encode(
          JSON.stringify(rawStorageSnapshot, null, 2),
        ),
      },
    ];

    // 오디오/이미지 백업 로직 포함
    const zipBlob = createZipBlob(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    const birthDatePart = normalizeBirthDate((patient as any)?.birthDate);
    const namePart = sanitizeName((patient as any)?.name);
    const examDatePart = formatExamDateTime(latestExamAt);
    a.download = `${birthDatePart}-${namePart}-${examDatePart}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stopPlayback = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const playAudio = (url: string, id: string) => {
    if (playingIndex === id) {
      stopPlayback();
      setPlayingIndex(null);
      return;
    }
    stopPlayback();
    audioRef.current = new Audio(url);
    audioRef.current.play();
    setPlayingIndex(id);
    audioRef.current.onended = () => setPlayingIndex(null);
  };

  const playSpeechFallback = (text: string, id: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    if (playingIndex === id) {
      stopPlayback();
      setPlayingIndex(null);
      return;
    }
    stopPlayback();
    const utterance = new SpeechSynthesisUtterance(
      text || "음성 데이터가 없습니다.",
    );
    utterance.lang = "ko-KR";
    utterance.rate = 0.92;
    utterance.onend = () => setPlayingIndex(null);
    utterance.onerror = () => setPlayingIndex(null);
    setPlayingIndex(id);
    window.speechSynthesis.speak(utterance);
  };

  const shouldShowPlayButton = (stepId: number, item: any) =>
    [2, 4, 5].includes(stepId) &&
    Boolean(
      item?.audioUrl ||
      item?.text ||
      item?.transcript ||
      item?.targetText ||
      item?.prompt,
    );

  const getPlayableText = (item: any) =>
    String(
      item?.text ||
        item?.transcript ||
        item?.targetText ||
        item?.targetWord ||
        item?.prompt ||
        "음성 데이터가 없습니다.",
    );

  const getSelfItemFeedback = (stepId: number, item: any) => {
    const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);

    if (stepId === 2) {
      const score = toNum(item?.finalScore ?? item?.speechScore);
      if (score !== null) {
        return {
          good:
            score >= 80
              ? "발화 정확도가 안정적으로 유지되었습니다."
              : "문장을 끝까지 따라 말한 점이 좋았습니다.",
          improve:
            score >= 80
              ? "호흡 길이를 일정하게 유지하면 더 자연스러워집니다."
              : "핵심 단어를 천천히 또렷하게 발음해 보세요.",
        };
      }
    }

    if (stepId === 4) {
      const score = toNum(item?.fluencyScore ?? item?.kwabScore);
      if (score !== null) {
        return {
          good:
            score >= 7
              ? "상황 문장을 연결해 말하는 흐름이 좋습니다."
              : "핵심 단어를 포함해 말하려는 시도가 좋습니다.",
          improve:
            score >= 7
              ? "문장 간 짧은 멈춤을 줄이면 전달력이 더 좋아집니다."
              : "주어-서술어를 붙여 짧은 완성 문장으로 말해 보세요.",
        };
      }
    }

    if (stepId === 5) {
      const score = toNum(item?.readingScore);
      if (score !== null) {
        return {
          good:
            score >= 80
              ? "문장 읽기 속도와 정확도가 안정적입니다."
              : "끝까지 읽고 다시 확인한 점이 좋았습니다.",
          improve:
            score >= 80
              ? "어절 사이 멈춤을 일정하게 유지해 보세요."
              : "문장 부호에서 잠깐 쉬고 또박또박 읽어보세요.",
        };
      }
    }

    if (stepId === 6) {
      const score = toNum(item?.writingScore);
      if (score !== null) {
        return {
          good:
            score >= 80
              ? "획수 흐름이 안정적입니다."
              : "단어 형태를 끝까지 맞추려는 점이 좋았습니다.",
          improve:
            score >= 80
              ? "획 간 간격을 일정하게 맞춰보세요."
              : "자획 간격을 조금 더 일정하게 맞춰보세요.",
        };
      }
    }

    return {
      good: item?.isCorrect
        ? "과제를 차분하게 수행했습니다."
        : "끝까지 시도한 점이 좋았습니다.",
      improve: "핵심 단어를 천천히 반복 연습해 보세요.",
    };
  };

  if (!isMounted || !sessionData) return null;

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 50px;
        }
        @media print {
          body {
            background: white !important;
            font-size: 8.5pt !important;
            line-height: 1.2 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-container {
            width: auto;
            max-width: none;
            padding: 0;
            margin: 0 auto;
            box-shadow: none !important;
            gap: 1.5mm !important;
          }
          section {
            page-break-inside: avoid;
            border: 1px solid #eee !important;
            border-radius: 10px !important;
            margin-bottom: 1.5mm !important;
            padding: 7px !important;
          }
          header {
            border-bottom: 1px solid #cbd5e1 !important;
            padding: 7px !important;
            margin-bottom: 1.5mm !important;
          }
          .print-header h2 {
            font-size: 13px !important;
          }
          .print-top-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5mm !important;
          }
          .profile-chart {
            width: 95px !important;
            height: 95px !important;
          }
          .profile-body {
            display: grid !important;
            grid-template-columns: 110px 1fr !important;
            gap: 8px !important;
            align-items: center !important;
          }
          .profile-chart-wrap {
            margin: 0 !important;
            justify-content: center !important;
          }
          .profile-metrics {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 4px 8px !important;
          }
          .profile-metric-item {
            background: transparent !important;
            border: none !important;
            border-left: 2px solid #fed7aa !important;
            border-radius: 0 !important;
            padding: 2px 0 2px 6px !important;
            align-items: flex-start !important;
            text-align: left !important;
          }
          .profile-metric-item .metric-title {
            font-size: 9px !important;
            margin-bottom: 1px !important;
          }
          .profile-metric-item .metric-value {
            font-size: 10.5px !important;
          }
          .patient-meta-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) 140px !important;
            gap: 3px !important;
          }
          .aq-card {
            grid-column: 4 !important;
            grid-row: 1 / span 2 !important;
            min-width: 140px !important;
            padding: 6px 8px !important;
          }
          .normal-compare-card {
            grid-column: 1 / span 3 !important;
            grid-row: 2 !important;
          }
          .aq-card .aq-value {
            font-size: 20px !important;
          }
          .impression-content {
            gap: 4px !important;
          }
          .impression-content p {
            margin: 0 !important;
          }
          .print-history-list .history-row {
            padding: 4px 6px !important;
          }
          .print-history-list .history-row p {
            font-size: 9px !important;
            line-height: 1.15 !important;
          }
        }
        .print-only {
          display: none;
        }
        .custom-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>

      <div className="h-full min-h-screen overflow-y-auto bg-[#FFF7ED] text-[#0f172a] pb-12">
        {/* 상단바 */}
        <header className="no-print h-16 px-4 sm:px-6 lg:px-[200px] border-b border-orange-100 flex items-center justify-between bg-white sticky top-0 z-40">
          <div className="w-full flex items-center justify-between min-w-0">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo/logo.png"
                alt="GOLDEN logo"
                className="w-10 h-10 rounded-xl object-cover"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-500">
                  Report
                </p>
                <h1 className="text-base sm:text-lg md:text-xl font-black flex items-center gap-1.5">
                  자가 진단 평가 결과
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportData}
                className="px-3 sm:px-4 py-2 bg-white text-slate-900 border border-orange-200 rounded-xl text-[11px] sm:text-xs font-bold shadow-sm hover:bg-orange-50 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5 text-orange-500" />
                데이터 백업
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-sm hover:bg-orange-600 active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                진단서 출력
              </button>
              <button
                type="button"
                onClick={() => router.push("/select")}
                aria-label="홈으로 이동"
                title="홈"
                className="w-9 h-9 rounded-xl border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 transition-colors flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10.5 12 3l9 7.5"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.5 9.5V21h13V9.5"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 21v-5h4v5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="w-full px-4 sm:px-6 lg:px-[200px] py-5 sm:py-8 pb-10 sm:pb-8 space-y-4 sm:space-y-5 print-container">
          {/* [HEADER] 환자 프로필 */}
          {!isRehabResult && (
            <>
              <section className="no-print rounded-3xl border border-orange-300 bg-gradient-to-r from-orange-600 to-orange-500 p-5 sm:p-6 md:p-7 text-white shadow-sm">
                <p className="text-[11px] md:text-xs font-black uppercase tracking-[0.25em] text-orange-100">
                  Self Assessment Report
                </p>
                <h3 className="mt-2 text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
                  자가진단 종합 점수 {derivedKwab?.aq || "0.0"}점
                </h3>
                <p className="mt-2 text-sm sm:text-base md:text-lg font-bold text-orange-50 leading-relaxed">
                  자가진단 평가 결과를 기준으로 강점 영역과 집중 중재 영역을
                  확인하세요.
                </p>
              </section>

              <section className="no-print grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-3 bg-white p-3 md:p-4 rounded-3xl shadow-sm border border-orange-100">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-400 text-white font-black text-base sm:text-lg md:text-xl flex items-center justify-center shrink-0">
                    {(patientProfile?.name || "환").trim().charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg md:text-xl font-black text-slate-900 leading-snug truncate">
                      {patientProfile?.name || "미입력"} 님
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-slate-600 leading-relaxed">
                      <span className="font-semibold">
                        연령{" "}
                        <b className="font-black text-slate-900">
                          {patientProfile?.age || "-"}세
                        </b>
                      </span>
                      <span className="font-semibold">
                        교육 기간{" "}
                        <b className="font-black text-slate-900">
                          {patientProfile?.educationYears || "-"}년
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px] shadow-sm">
                  <p className="text-sm font-black text-slate-500">현재 점수</p>
                  <p className="text-lg sm:text-xl font-black text-orange-600 mt-1 leading-snug">
                    {derivedKwab?.aq || "0.0"}점
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px] shadow-sm">
                  <p className="text-sm font-black text-slate-500">평가 분류</p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 leading-snug">
                    {aqSeverityLabel(Number(derivedKwab?.aq || 0))}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px] shadow-sm">
                  <p className="text-sm font-black text-slate-500">
                    정상군 대비
                  </p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 leading-snug">
                    {normalComparison
                      ? `${normalComparison.diff >= 0 ? "+" : ""}${normalComparison.diff.toFixed(1)}`
                      : "-"}
                  </p>
                </div>
              </section>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 items-stretch print-top-grid">
            {rehabComparison && (
              <section className="no-print md:col-span-2 bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 border-l-4 border-orange-500 pl-3 mb-3">
                  반복훈련 변화 비교 (Step 0{rehabTargetStep})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-black text-slate-500">
                      이번 점수
                    </p>
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      {rehabComparison.currScore.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-black text-slate-500">
                      이전 점수
                    </p>
                    <p className="text-base sm:text-lg font-black text-slate-900">
                      {rehabComparison.prevScore === null
                        ? "기록 없음"
                        : `${rehabComparison.prevScore.toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-black text-slate-500">변화량</p>
                    <p
                      className={`text-base sm:text-lg font-black ${
                        rehabComparison.delta === null
                          ? "text-slate-700"
                          : rehabComparison.delta >= 0
                            ? "text-emerald-600"
                            : "text-orange-600"
                      }`}
                    >
                      {rehabComparison.delta === null
                        ? "-"
                        : `${rehabComparison.delta > 0 ? "+" : ""}${rehabComparison.delta.toFixed(1)}%p`}
                    </p>
                  </div>
                </div>
              </section>
            )}
            {/* [01] 언어 기능 프로파일 */}
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
                          points={profileNodes
                            .map((n) => `${n.x},${n.y}`)
                            .join(" ")}
                          fill="rgba(249,115,22,0.18)"
                          stroke="#F97316"
                          strokeWidth="4"
                          strokeLinejoin="round"
                        />
                        {profileNodes.map((n) => (
                          <g key={`node-${n.id}`}>
                            <circle cx={n.x} cy={n.y} r="4" fill="#F97316" />
                            <g
                              transform={`translate(${n.badgeX}, ${n.badgeY})`}
                            >
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
                              <text
                                x="0"
                                y="-1"
                                textAnchor="middle"
                                fontSize="8.5"
                                fill="#475569"
                                fontWeight="700"
                              >
                                {n.short}
                              </text>
                              <text
                                x="0"
                                y="10"
                                textAnchor="middle"
                                fontSize="9.5"
                                fill="#0F172A"
                                fontWeight="800"
                              >
                                {n.display}
                              </text>
                            </g>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full md:h-[280px] profile-metrics">
                    {stepDetails.map((d, idx) => {
                      const Icon =
                        [
                          Headphones,
                          MessageSquare,
                          Image,
                          Zap,
                          BookOpen,
                          PenTool,
                        ][idx] || Activity;
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

            {/* [02] 소견서 */}
            <section className="bg-white rounded-2xl p-4 md:p-6 border border-orange-200 shadow-sm h-full">
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2 leading-relaxed">
                <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-orange-500" />
                </span>
                {isRehabResult ? "반복훈련 요약" : "전문가 임상 소견"}
              </h3>

              <div className="bg-orange-50/40 border border-orange-200 rounded-2xl p-4 md:p-5 space-y-4 impression-content">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                    <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">
                      잘하고 있는 점
                    </p>
                    <p className="mt-1 text-sm md:text-base font-bold text-slate-900 leading-loose">
                      {clinicalImpression?.strongestText}
                    </p>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                    <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">
                      노력이 필요한 점
                    </p>
                    <p className="mt-1 text-sm md:text-base font-bold text-orange-600 leading-loose">
                      {clinicalImpression?.weakestText}
                    </p>
                  </div>
                  <div className="rounded-xl border border-orange-200 bg-white p-3 md:p-4 min-h-[48px]">
                    <p className="text-xs md:text-sm font-black text-slate-500 tracking-wide">
                      오늘의 응원 권고
                    </p>
                    <p className="mt-1 text-sm md:text-base font-bold text-slate-900 leading-loose">
                      {clinicalImpression?.encourageText}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                    <p className="min-w-0 text-sm md:text-base font-semibold text-slate-800 leading-loose whitespace-pre-line break-words">
                      {addSentenceLineBreaks(
                        formattedClinicalImpression?.summary || "",
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                    <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                      {addSentenceLineBreaks(
                        `잘하고 있는 점: ${formattedClinicalImpression?.strength || ""}`,
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                    <Activity className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                    <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                      {addSentenceLineBreaks(
                        `노력이 필요한 점: ${formattedClinicalImpression?.need || ""}`,
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white border border-orange-200 p-3 md:p-4 flex items-start gap-2.5">
                    <HeartHandshake className="w-4 h-4 text-orange-500 mt-1 shrink-0" />
                    <p className="min-w-0 text-sm md:text-base font-semibold text-slate-700 leading-loose whitespace-pre-line break-words">
                      {addSentenceLineBreaks(
                        `오늘의 응원 권고: ${formattedClinicalImpression?.recommendation || ""}`,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="no-print bg-white rounded-2xl p-5 border border-orange-200 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-orange-500" />
                  </span>
                  수행 기록 상세
                </h3>
                <p className="text-sm font-bold text-slate-600">
                  단계별 항목을 펼쳐 상세 기록을 확인하세요.
                </p>
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
                        <span className="text-xs font-black text-slate-800">
                          {step.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-600">
                          {items.length} Activities
                        </span>
                        <span className="text-slate-600 text-xs font-black">
                          {isOpen ? "▲" : "▼"}
                        </span>
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
                                  />
                                </div>
                              )}

                              <p className="text-xs font-bold text-slate-600 leading-snug mb-2">
                                "
                                {it.text ||
                                  it.targetText ||
                                  it.targetWord ||
                                  "..."}
                                "
                              </p>

                              {(feedback.good || feedback.improve) && (
                                <div className="mt-1 pt-2 border-t border-slate-100 space-y-1 mb-2">
                                  {feedback.good && (
                                    <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                                      <span className="text-orange-600">
                                        좋았던 점:
                                      </span>{" "}
                                      {feedback.good}
                                    </p>
                                  )}
                                  {feedback.improve && (
                                    <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                                      <span className="text-slate-700">
                                        개선점:
                                      </span>{" "}
                                      {feedback.improve}
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
                                      playSpeechFallback(
                                        getPlayableText(it),
                                        id,
                                      );
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

          {facialReport && (
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
                    <p className="text-sm md:text-base font-black text-slate-800">
                      안면 기반 자-모음 정확도
                    </p>
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
                      <p className="text-xs text-slate-500 font-bold">
                        전체 자음
                      </p>
                      <p className="mt-1 text-2xl md:text-3xl font-black text-amber-600 leading-none">
                        {Math.round(facialReport.overallConsonant)}%
                      </p>
                    </div>
                    <div className="col-span-12 sm:col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-3 md:p-4">
                      <p className="text-xs text-slate-500 font-bold">
                        전체 모음
                      </p>
                      <p className="mt-1 text-2xl md:text-3xl font-black text-indigo-600 leading-none">
                        {Math.round(facialReport.overallVowel)}%
                      </p>
                    </div>
                    <div className="col-span-6 md:col-span-4 rounded-xl border border-slate-100 p-3">
                      <p className="text-[11px] text-slate-500 font-bold">
                        STEP 2
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-black text-slate-900">
                        자 {Math.round(facialReport.step2Consonant)}% · 모{" "}
                        {Math.round(facialReport.step2Vowel)}%
                      </p>
                    </div>
                    <div className="col-span-6 md:col-span-4 rounded-xl border border-slate-100 p-3">
                      <p className="text-[11px] text-slate-500 font-bold">
                        STEP 4
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-black text-slate-900">
                        자 {Math.round(facialReport.step4Consonant)}% · 모{" "}
                        {Math.round(facialReport.step4Vowel)}%
                      </p>
                    </div>
                    <div className="col-span-12 md:col-span-4 rounded-xl border border-slate-100 p-3">
                      <p className="text-[11px] text-slate-500 font-bold">
                        STEP 5
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-black text-slate-900">
                        자 {Math.round(facialReport.step5Consonant)}% · 모{" "}
                        {Math.round(facialReport.step5Vowel)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 rounded-2xl border border-slate-100 bg-white p-4 md:p-5 min-h-[250px]">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm md:text-base font-black text-slate-800">
                      안면 비대칭 위험도
                    </p>
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
                      <p className="text-[11px] font-bold text-slate-500">
                        비대칭
                      </p>
                      <p className="text-sm font-black text-slate-900">
                        {Math.round(facialReport.asymmetryRisk)}
                      </p>
                    </div>
                    <div className="col-span-6 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                      <p className="text-[11px] font-bold text-slate-500">
                        불균형
                      </p>
                      <p className="text-sm font-black text-slate-900">
                        {facialReport.articulationGap.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs sm:text-sm font-bold text-slate-600 leading-relaxed whitespace-pre-line break-words">
                    {facialReport.summary}
                  </p>
                  <p className="mt-3 text-[11px] sm:text-xs font-bold text-slate-500">
                    변화:{" "}
                    {facialReport.asymmetryDelta === null
                      ? "이전 데이터 없음"
                      : `${facialReport.asymmetryDelta > 0 ? "+" : ""}${facialReport.asymmetryDelta.toFixed(1)}%p`}
                  </p>
                </div>

              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div>LOADING...</div>}>
      <ResultContent />
    </Suspense>
  );
}
