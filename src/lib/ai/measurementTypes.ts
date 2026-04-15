export type MeasurementQuality = "measured" | "partial" | "demo";

export interface SpeechFaceMeasurement {
  utteranceId: string;
  historyId: string;
  sessionId: string;
  patientId: string;
  trainingMode: "self" | "rehab";
  rehabStep: number | null;
  prompt: string;
  transcript: string;
  consonantAccuracy: number;
  vowelAccuracy: number;
  pronunciationScore: number;
  symmetryScore: number;
  trackingQuality: number;
  processingMs: number;
  fps: number;
  quality: MeasurementQuality;
  modelVersion: string;
  analysisVersion: string;
  evaluationDatasetVersion: string;
  capturedAt: string;
}
