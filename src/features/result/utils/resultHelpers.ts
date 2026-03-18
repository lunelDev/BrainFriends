import { PlaceType } from "@/constants/trainingData";
import { FLUENCY_SCENARIOS } from "@/constants/fluencyData";
import { scoreContentDelivery, scoreFluency } from "@/lib/kwab/KWABScoring";
import { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { FacialReport, StepDetail } from "@/features/result/types";

export function getResultSummarySizeClass(text: string): string {
  const normalizedLength = (text || "").replace(/\s+/g, "").length;
  if (normalizedLength >= 56) return "text-sm md:text-base";
  if (normalizedLength >= 36) return "text-base md:text-lg";
  return "text-lg md:text-xl";
}

export function deriveSpontaneousSpeechFromStep4(items: any[], place: PlaceType) {
  if (!items.length) {
    return { contentScore: 8, fluencyScore: 8 };
  }

  const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, "");
  const scenarios = FLUENCY_SCENARIOS[place] || [];

  const itemAnalyses = items.map((item: any) => {
    const transcript = String(item?.transcript || item?.text || item?.targetText || "");
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
    const keywordCoverage = keywords.length ? uniqueHits / keywords.length : 0;

    const sentenceParts = transcript
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const utteranceCount = Math.max(1, sentenceParts.length);
    const hangulChars = (transcript.match(/[가-힣]/g) || []).length;
    const syllablesPerUtterance = hangulChars / utteranceCount;
    const hasCompleteSentences =
      sentenceParts.some((s) => s.length >= 12) || /[다요니다]\s*$/.test(transcript);
    const hasWordFindingDifficulty = /(음|어|저기|그게|그거|...|…)/.test(transcript);
    const speechDurationSec = Number(item?.speechDuration || 0);
    const charsPerSec = speechDurationSec > 0 ? transcript.length / speechDurationSec : 0;
    const speechRate = charsPerSec >= 3 ? "normal" : charsPerSec >= 1.5 ? "slow" : "very_slow";
    const fluencyRaw = Number(
      item?.fluencyComponentScore ?? item?.fluencyScore ?? item?.kwabScore,
    );
    const fluencyKwab = Number.isFinite(fluencyRaw)
      ? fluencyRaw > 10
        ? fluencyRaw / 10
        : fluencyRaw
      : null;

    return {
      uniqueHits,
      keywordCoverage,
      fluencyKwab:
        fluencyKwab ||
        scoreFluency({
          syllablesPerUtterance,
          hasCompleteSentences,
          hasWordFindingDifficulty,
          speechRate,
        }),
    };
  });

  const goodCoverageCount = itemAnalyses.filter((a) => a.keywordCoverage >= 0.2).length;
  const correctAnswers = Math.min(
    6,
    Math.round((goodCoverageCount / Math.max(1, items.length)) * 6),
  );
  const pictureDescriptionItems = itemAnalyses.reduce((sum, a) => sum + a.uniqueHits, 0);
  const contentScore = scoreContentDelivery({
    correctAnswers,
    pictureDescriptionItems,
  });

  const fluencyScore =
    itemAnalyses.reduce((sum, a) => sum + a.fluencyKwab, 0) / Math.max(1, itemAnalyses.length);

  return {
    contentScore: Math.max(0, Math.min(10, Number(contentScore || 0))),
    fluencyScore: Math.max(0, Math.min(10, Number(fluencyScore || 0))),
  };
}

export function buildStepDetails(sessionData: any, queryScores: Record<number, number>): StepDetail[] {
  const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const fmt1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const SPEED_BONUS_THRESHOLD_MS = 6000;
  const toMs = (v: any) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return null;
    if (num <= 0) return null;
    return num < 100 ? num * 1000 : num;
  };
  const calcComposite = (items: any[]) => {
    const total = Math.max(1, items.length);
    const correctCount = items.filter((i: any) => Boolean(i?.isCorrect)).length;
    const fastCorrectCount = items.filter((i: any) => {
      if (!Boolean(i?.isCorrect)) return false;
      const ms = toMs(i?.responseTime ?? i?.totalTime ?? i?.speechDuration);
      return ms !== null && ms <= SPEED_BONUS_THRESHOLD_MS;
    }).length;
    const accuracyScore = (correctCount / total) * 100;
    const speedBonus = (fastCorrectCount / total) * 100;
    return Number((accuracyScore * 0.8 + speedBonus * 0.2).toFixed(1));
  };

  const s1 = sessionData?.step1?.items || [];
  const s2 = sessionData?.step2?.items || [];
  const s3 = sessionData?.step3?.items || [];
  const s4 = sessionData?.step4?.items || [];
  const s5 = sessionData?.step5?.items || [];
  const s6 = sessionData?.step6?.items || [];

  const s1Correct = s1.filter((i: any) => i?.isCorrect).length;
  const s1Total = s1.length || 20;
  const s1Percent = s1.length ? clamp(calcComposite(s1)) : clamp((queryScores[1] / 20) * 100);

  const s2Score = s2.length
    ? clamp(avg(s2.map((i: any) => Number(i?.finalScore ?? i?.speechScore ?? 0))))
    : clamp(queryScores[2]);

  const s3Correct = s3.filter((i: any) => i?.isCorrect).length;
  const s3Total = s3.length || 10;
  const s3Percent = s3.length ? clamp(calcComposite(s3)) : clamp(queryScores[3]);

  const s4Score = s4.length
    ? Math.min(10, Math.max(0, avg(s4.map((i: any) => {
      const finalScore = Number(i?.finalScore);
      if (Number.isFinite(finalScore)) return finalScore / 10;
      const fluencyRaw = Number(i?.fluencyComponentScore ?? i?.fluencyScore ?? i?.kwabScore);
      if (!Number.isFinite(fluencyRaw)) return 0;
      return fluencyRaw > 10 ? fluencyRaw / 10 : fluencyRaw;
    }))))
    : Math.min(10, Math.max(0, Number(queryScores[4] || 0)));
  const s4Percent = clamp(s4Score * 10);

  const s5Percent = s5.length
    ? clamp(
        avg(
          s5.map((i: any) =>
            Number.isFinite(Number(i?.readingScore)) ? Number(i?.readingScore) : i?.isCorrect ? 100 : 0,
          ),
        ),
      )
    : clamp(queryScores[5]);

  const s6Score = s6.length
    ? clamp(
        avg(
          s6.map((i: any) =>
            Number.isFinite(Number(i?.writingScore)) ? Number(i?.writingScore) : i?.isCorrect ? 100 : 0,
          ),
        ),
      )
    : clamp(queryScores[6]);

  return [
    {
      id: 1,
      title: "청각 이해",
      display: `${Math.round(s1Percent)}점`,
      percent: s1Percent,
      metric: `${Math.round(s1Percent)}점`,
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
      display: `${Math.round(s3Percent)}점`,
      percent: s3Percent,
      metric: `${Math.round(s3Percent)}점`,
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
}

export function buildFacialReport(
  sessionData: any,
  latestAndPreviousHistory: {
    current: TrainingHistoryEntry | null;
    previous: TrainingHistoryEntry | null;
  },
): FacialReport | null {
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
    avg(items.map((it: any) => toNum(it?.[key])).filter((v: number) => v > 0));

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

  const overallConsonant = avg([step2Consonant, step4Consonant, step5Consonant].filter((v) => v > 0));
  const overallVowel = avg([step2Vowel, step4Vowel, step5Vowel].filter((v) => v > 0));
  const asymmetryRisk = toNum(current?.facialAnalysisSnapshot?.asymmetryRisk);
  const prevAsymmetryRisk = toNum(previous?.facialAnalysisSnapshot?.asymmetryRisk);
  const asymmetryDelta =
    prevAsymmetryRisk > 0 ? Number((asymmetryRisk - prevAsymmetryRisk).toFixed(1)) : null;
  const oralCommissureAsymmetry = toNum(
    current?.facialAnalysisSnapshot?.sessionAverage?.oralCommissureAsymmetry,
  );
  const lipClosureAsymmetry = toNum(
    current?.facialAnalysisSnapshot?.sessionAverage?.lipClosureAsymmetry,
  );
  const vowelArticulationVariance = toNum(
    current?.facialAnalysisSnapshot?.sessionAverage?.vowelArticulationVariance,
  );
  const oralCommissureDelta =
    toNum(current?.facialAnalysisSnapshot?.longitudinalDelta?.oralCommissureAsymmetry) ??
    toNum(current?.facialAnalysisSnapshot?.delta?.oralCommissureAsymmetry);
  const lipClosureDelta =
    toNum(current?.facialAnalysisSnapshot?.longitudinalDelta?.lipClosureAsymmetry) ??
    toNum(current?.facialAnalysisSnapshot?.delta?.lipClosureAsymmetry);
  const vowelArticulationDelta =
    toNum(current?.facialAnalysisSnapshot?.longitudinalDelta?.vowelArticulationVariance) ??
    toNum(current?.facialAnalysisSnapshot?.delta?.vowelArticulationVariance);
  const trackingQuality = toNum(current?.facialAnalysisSnapshot?.trackingQuality);
  const articulationGap =
    toNum(current?.facialAnalysisSnapshot?.articulationGap) ||
    Number(Math.abs(overallConsonant - overallVowel).toFixed(1));

  const riskLabel = asymmetryRisk >= 45 ? "고위험" : asymmetryRisk >= 30 ? "주의" : "저위험";

  const hasCameraData =
    [step2Consonant, step2Vowel, step4Consonant, step4Vowel, step5Consonant, step5Vowel].some(
      (v) => v > 0,
    ) || asymmetryRisk > 0;
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
    trackingQuality,
    oralCommissureAsymmetry,
    oralCommissureDelta,
    lipClosureAsymmetry,
    lipClosureDelta,
    vowelArticulationVariance,
    vowelArticulationDelta,
    summary:
      current?.facialAnalysisSnapshot?.articulationFaceMatchSummary ||
      "음성-안면 매칭 추적 데이터가 아직 충분하지 않습니다.",
  };
}

export function aqSeverityLabel(aq: number) {
  if (aq >= 93.8) return "정상 범위";
  if (aq >= 76) return "경도";
  if (aq >= 51) return "중등도";
  if (aq >= 26) return "중증";
  return "최중증";
}

export function parseStoredArray(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function shouldShowPlayButton(stepId: number, item: any) {
  return (
    [2, 4, 5].includes(stepId) &&
    Boolean(item?.audioUrl || item?.text || item?.transcript || item?.targetText || item?.prompt)
  );
}

export function getPlayableText(item: any) {
  return String(
    item?.text ||
      item?.transcript ||
      item?.targetText ||
      item?.targetWord ||
      item?.prompt ||
      "음성 데이터가 없습니다.",
  );
}

export function getSelfItemFeedback(stepId: number, item: any) {
  const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const responseMsRaw = toNum(item?.responseTime ?? item?.totalTime);
  const speechDuration = toNum(item?.speechDuration);
  const responseMs =
    responseMsRaw !== null
      ? responseMsRaw
      : speechDuration !== null
        ? speechDuration < 100
          ? speechDuration * 1000
          : speechDuration
        : null;
  const isCorrect = item?.isCorrect === true;

  if (stepId === 1) {
    return {
      good: isCorrect
        ? "질문 의도를 정확히 파악해 이해 정확도가 안정적으로 유지되었습니다."
        : "질문을 끝까지 듣고 판단하려는 수행 태도가 좋았습니다.",
      improve:
        responseMs === null
          ? "판단 속도 데이터가 부족해 추가 관찰이 필요합니다."
          : responseMs >= 2500
            ? "응답 시작 전 망설임이 길어 2초 내 즉각 반응 연습이 필요합니다."
            : responseMs >= 1800
              ? "판단 속도는 보통 수준이며 즉각 반응 비율을 높이면 더 좋아집니다."
              : "판단 속도는 안정적이며 현재 이해 정확도를 유지하는 것이 중요합니다.",
    };
  }

  if (stepId === 2) {
    const score = toNum(item?.finalScore ?? item?.speechScore);
    if (score !== null) {
      return {
        good:
          score >= 85
            ? "자음·모음 산출 정확도가 안정적이며 정답 문장 복창이 우수합니다."
            : score >= 70
              ? "핵심 음절을 유지하며 문장을 끝까지 복창한 수행이 좋았습니다."
              : "정답 문장을 끝까지 산출하려는 시도가 좋았습니다.",
        improve:
          responseMs === null
            ? "발화 시작 속도 데이터가 부족해 추가 관찰이 필요합니다."
            : responseMs >= 2500
              ? "발화 시작 전 준비 시간이 길어, 시작 음절을 빠르게 여는 연습이 필요합니다."
              : score >= 85
                ? "현재 정확도를 유지하면서 발화 시작 타이밍의 일관성을 높여보세요."
                : "자음/모음 분절을 또렷하게 유지하며 시작 속도를 함께 개선해 보세요.",
      };
    }
  }

  if (stepId === 3) {
    return {
      good: isCorrect
        ? "목표 단어를 정확히 인출해 산출한 점이 안정적입니다."
        : "단어 인출을 끝까지 시도하며 과제를 유지한 점이 좋았습니다.",
      improve: isCorrect
        ? "정확도를 유지하면서 반응 속도를 조금 더 높여보세요."
        : "첫 음절 단서나 의미 단서를 활용해 단어 인출 정확도를 높여보세요.",
    };
  }

  if (stepId === 4) {
    const raw = toNum(
      item?.finalScore ??
        item?.fluencyComponentScore ??
        item?.fluencyScore ??
        item?.kwabScore,
    );
    const score = raw === null ? null : raw > 10 ? raw : raw * 10;
    if (score !== null) {
      return {
        good:
          score >= 70
            ? "상황 문장을 연결하는 유창성이 안정적으로 유지되었습니다."
            : "핵심 단어를 포함해 문장을 구성하려는 시도가 좋았습니다.",
        improve:
          score >= 70
            ? "문장 간 짧은 멈춤을 줄이면 전달력과 자연스러움이 더 좋아집니다."
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
            ? "획수와 형태 유지가 안정적이며 산출 일관성이 좋습니다."
            : "단어 형태를 끝까지 맞추려는 수행 태도가 좋았습니다.",
        improve:
          score >= 80
            ? "획 간 간격과 시작 위치를 일정하게 유지해 완성도를 높여보세요."
            : "자획 간격과 자소 위치를 조금 더 일정하게 맞추는 연습이 필요합니다.",
      };
    }
  }

  return {
    good: item?.isCorrect ? "과제를 차분하게 수행했습니다." : "끝까지 시도한 점이 좋았습니다.",
    improve: "핵심 단어를 천천히 반복 연습해 보세요.",
  };
}
