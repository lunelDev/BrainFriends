export type ExportFile = { name: string; data: Uint8Array };

export type DerivedKwab = {
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

export type StepDetail = {
  id: number;
  title: string;
  display: string;
  percent: number;
  metric: string;
};

export type FacialReport = {
  overallConsonant: number;
  overallVowel: number;
  step2Consonant: number;
  step2Vowel: number;
  step4Consonant: number;
  step4Vowel: number;
  step5Consonant: number;
  step5Vowel: number;
  asymmetryRisk: number;
  asymmetryDelta: number | null;
  articulationGap: number;
  riskLabel: string;
  summary: string;
};
