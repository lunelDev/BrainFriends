export type WeeklyReportTrainingSession = {
  kind: "language" | "sing";
  completedAt: string;
  score: number | null;
  stepScores?: Record<string, number | null | undefined> | null;
};

export type WeeklyReportSummary = {
  periodStart: string;
  periodEnd: string;
  totalSessions: number;
  languageSessionCount: number;
  singSessionCount: number;
  latestAq: number | null;
  aqChange: number | null;
  averageScore: number | null;
  stepCompletion: Record<string, number>;
  adverseEventCount: number;
  adverseEventStatus: "none_reported" | "reported";
  latestCompletedAt: string | null;
};

const STEP_KEYS = ["step1", "step2", "step3", "step4", "step5", "step6"];

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function numericOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildWeeklyReportSummary(input: {
  periodStart: string;
  periodEnd: string;
  sessions: WeeklyReportTrainingSession[];
  adverseEventCount?: number;
}): WeeklyReportSummary {
  const sessions = [...input.sessions].sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt),
  );
  const languageSessions = sessions.filter((session) => session.kind === "language");
  const singSessions = sessions.filter((session) => session.kind === "sing");
  const scoredSessions = sessions
    .map((session) => numericOrNull(session.score))
    .filter((score): score is number => score !== null);

  const firstAq = numericOrNull(languageSessions[0]?.score);
  const latestAq = numericOrNull(languageSessions[languageSessions.length - 1]?.score);
  const aqChange =
    firstAq === null || latestAq === null ? null : round(latestAq - firstAq, 1);

  const stepCompletion: Record<string, number> = {};
  for (const stepKey of STEP_KEYS) {
    if (!languageSessions.length) {
      stepCompletion[stepKey] = 0;
      continue;
    }
    const completed = languageSessions.filter((session) => {
      const score = numericOrNull(session.stepScores?.[stepKey]);
      return score !== null && score > 0;
    }).length;
    stepCompletion[stepKey] = round(completed / languageSessions.length, 2);
  }

  const adverseEventCount = Math.max(0, Math.floor(input.adverseEventCount ?? 0));

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalSessions: sessions.length,
    languageSessionCount: languageSessions.length,
    singSessionCount: singSessions.length,
    latestAq,
    aqChange,
    averageScore: scoredSessions.length
      ? round(
          scoredSessions.reduce((sum, score) => sum + score, 0) /
            scoredSessions.length,
          1,
        )
      : null,
    stepCompletion,
    adverseEventCount,
    adverseEventStatus: adverseEventCount > 0 ? "reported" : "none_reported",
    latestCompletedAt: sessions[sessions.length - 1]?.completedAt ?? null,
  };
}

export function maskGuardianPatientName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "환자";
  if (trimmed.length === 1) return `${trimmed}*`;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(Math.max(1, trimmed.length - 2))}${
    trimmed[trimmed.length - 1]
  }`;
}
