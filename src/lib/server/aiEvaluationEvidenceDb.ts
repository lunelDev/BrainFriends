import { getEvaluationSamplesSummary } from "@/lib/server/evaluationSamplesDb";

export async function buildAiEvaluationEvidenceSummary() {
  const summary = await getEvaluationSamplesSummary();

  const submissionEnvelope = {
    documentControl: {
      documentType: "AI Evaluation Evidence Package",
      generatedAt: new Date().toISOString(),
      productName: "BrainFriends",
      exportFileName: "brainfriends-ai-evaluation-report.json",
    },
    executionSummary: {
      totalSamples: summary.totalCount,
      measuredSamples: summary.measuredCount,
      latestCapturedAt: summary.latestCapturedAt,
      versionCombinationCount: summary.versions.length,
    },
    storagePolicy: {
      primaryStorage: "PostgreSQL ai_evaluation_samples",
      fallbackStorage: "data/evaluation/evaluation-samples.ndjson",
      inclusionRule: "quality=measured and transcript/version fields present",
    },
    operatingView: {
      systemPage: "/therapist/system",
      evaluationPage: "/therapist/system/evaluation",
    },
  };

  const submissionTables = {
    versionComparisonTable: summary.versions.map((item) => ({
      evaluationDatasetVersion: item.evaluationDatasetVersion,
      modelVersion: item.modelVersion,
      analysisVersion: item.analysisVersion,
      sampleCount: item.sampleCount,
      latestCapturedAt: item.latestCapturedAt,
      avgPronunciationScore: Number(item.avgPronunciationScore.toFixed(2)),
      avgConsonantAccuracy: Number(item.avgConsonantAccuracy.toFixed(2)),
      avgVowelAccuracy: Number(item.avgVowelAccuracy.toFixed(2)),
      avgTrackingQuality: Number(item.avgTrackingQuality.toFixed(3)),
    })),
    latestVersionDeltaTable: summary.latestVersionComparison
      ? {
          currentVersion: {
            evaluationDatasetVersion:
              summary.latestVersionComparison.current.evaluationDatasetVersion,
            modelVersion: summary.latestVersionComparison.current.modelVersion,
            analysisVersion: summary.latestVersionComparison.current.analysisVersion,
          },
          previousVersion: {
            evaluationDatasetVersion:
              summary.latestVersionComparison.previous.evaluationDatasetVersion,
            modelVersion: summary.latestVersionComparison.previous.modelVersion,
            analysisVersion: summary.latestVersionComparison.previous.analysisVersion,
          },
          sampleDelta: summary.latestVersionComparison.sampleDelta,
          pronunciationDelta: Number(
            summary.latestVersionComparison.pronunciationDelta.toFixed(2),
          ),
          consonantDelta: Number(
            summary.latestVersionComparison.consonantDelta.toFixed(2),
          ),
          vowelDelta: Number(summary.latestVersionComparison.vowelDelta.toFixed(2)),
          trackingDelta: Number(
            summary.latestVersionComparison.trackingDelta.toFixed(3),
          ),
        }
      : null,
    modeBreakdownTable: summary.modeBreakdown.map((item) => ({
      trainingMode: item.trainingMode,
      sampleCount: item.sampleCount,
    })),
    qualityBreakdownTable: summary.qualityBreakdown.map((item) => ({
      quality: item.quality,
      sampleCount: item.sampleCount,
    })),
  };

  return {
    exportType: "brainfriends-ai-evaluation-report",
    generatedAt: new Date().toISOString(),
    submissionEnvelope,
    summary,
    submissionTables,
  };
}
