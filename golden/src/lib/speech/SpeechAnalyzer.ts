/**
 * 음성 인식 및 자모음 정밀 분석 시스템
 */

export interface SpeechAnalysisResult {
  transcript: string;
  confidence: number;
  pronunciationScore: number;
  duration: number;
  audioLevel: number;
  audioBlob?: Blob;
  errorReason?: string;
  // ✅ 상세 점수 추가
  details?: {
    consonantAccuracy: number;
    vowelAccuracy: number;
  };
}

export interface PronunciationMetrics {
  syllableAccuracy: number;
  tonalAccuracy: number;
  speedRatio: number;
  clarityScore: number;
  consonantAccuracy: number; // ✅ 추가
  vowelAccuracy: number; // ✅ 추가
}

// 1. 음성 녹음 관리 (AudioRecorder 클래스는 기존과 동일하여 유지)
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private animationId: number | null = null;
  private mimeType = "audio/webm";
  private usingExternalStream = false;

  async startRecording(
    onAudioLevel?: (level: number) => void,
    inputStream?: MediaStream,
  ): Promise<void> {
    try {
      if (inputStream && inputStream.getAudioTracks().length > 0) {
        this.stream = inputStream;
        this.usingExternalStream = true;
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000,
          },
        });
        this.usingExternalStream = false;
      }

      if (onAudioLevel) {
        this.audioContext = new AudioContext();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        source.connect(this.analyser);
        this.analyser.fftSize = 256;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const updateLevel = () => {
          if (this.analyser && this.dataArray) {
            this.analyser.getByteFrequencyData(this.dataArray);
            const sum = this.dataArray.reduce((a, b) => a + b, 0);
            const average = sum / this.dataArray.length;
            onAudioLevel(Math.min(100, average * 1.5));
          }
          this.animationId = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }

      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const selectedMimeType = preferredMimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      this.mimeType = selectedMimeType?.split(";")[0] || "audio/webm";

      this.mediaRecorder = selectedMimeType
        ? new MediaRecorder(this.stream, { mimeType: selectedMimeType })
        : new MediaRecorder(this.stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };
      this.mediaRecorder.start();
    } catch (error) {
      console.error("녹음 시작 실패:", error);
      throw error;
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder)
        return reject(new Error("MediaRecorder 미초기화"));
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mimeType });
        this.cleanup();
        resolve(audioBlob);
      };
      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.onstop = () => {
        this.cleanup();
      };
      this.mediaRecorder.stop();
      return;
    }
    this.cleanup();
  }

  getLastAudioBlob(): Blob | null {
    if (this.audioChunks.length === 0) return null;
    return new Blob(this.audioChunks, { type: this.mimeType });
  }

  private cleanup() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    if (this.audioContext) this.audioContext.close();
    if (this.stream && !this.usingExternalStream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.animationId = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// 2. Whisper API 연동
export class WhisperTranscriber {
  async transcribe(
    audioBlob: Blob,
  ): Promise<{ text: string; confidence: number }> {
    const mimeToExt: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
    };
    const extension = mimeToExt[audioBlob.type] || "webm";

    const formData = new FormData();
    formData.append("file", audioBlob, `audio.${extension}`);
    formData.append("model", "whisper-1");
    formData.append("language", "ko");
    formData.append("response_format", "verbose_json");

    const response = await fetch("/api/proxy/stt", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      const reason =
        typeof data?.reason === "string"
          ? data.reason
          : `http_${response.status}`;
      throw new Error(`stt_proxy_error:${reason}`);
    }
    if (data?.fallback) {
      const reason =
        typeof data?.reason === "string" ? data.reason : "unknown_fallback";
      throw new Error(`stt_fallback:${reason}`);
    }

    const confidence =
      data.segments?.reduce(
        (sum: number, seg: any) => sum + (seg.no_speech_prob || 0),
        0,
      ) / (data.segments?.length || 1);
    return { text: data.text || "", confidence: 1 - confidence };
  }
}

// 3. 발음 정확도 측정 로직 (핵심 수정 부분)
export class PronunciationAnalyzer {
  private calculateSimilarity(str1: string, str2: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= str1.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str2.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }
    const distance = matrix[str1.length][str2.length];
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 100 : ((maxLength - distance) / maxLength) * 100;
  }

  // ✅ 자음과 모음을 분리해서 반환하는 로직
  private getDetailedJamo(text: string) {
    const cho = [
      "ㄱ",
      "ㄲ",
      "ㄴ",
      "ㄷ",
      "ㄸ",
      "ㄹ",
      "ㅁ",
      "ㅂ",
      "ㅃ",
      "ㅅ",
      "ㅆ",
      "ㅇ",
      "ㅈ",
      "ㅉ",
      "ㅊ",
      "ㅋ",
      "ㅌ",
      "ㅍ",
      "ㅎ",
    ];
    const jung = [
      "ㅏ",
      "ㅐ",
      "ㅑ",
      "ㅒ",
      "ㅓ",
      "ㅔ",
      "ㅕ",
      "ㅖ",
      "ㅗ",
      "ㅘ",
      "ㅙ",
      "ㅚ",
      "ㅛ",
      "ㅜ",
      "ㅝ",
      "ㅞ",
      "ㅟ",
      "ㅠ",
      "ㅡ",
      "ㅢ",
      "ㅣ",
    ];
    const jong = [
      "",
      "ㄱ",
      "ㄲ",
      "ㄳ",
      "ㄴ",
      "ㄵ",
      "ㄶ",
      "ㄷ",
      "ㄹ",
      "ㄺ",
      "ㄻ",
      "ㄼ",
      "ㄽ",
      "ㄾ",
      "ㄿ",
      "ㅀ",
      "ㅁ",
      "ㅂ",
      "ㅄ",
      "ㅅ",
      "ㅆ",
      "ㅇ",
      "ㅈ",
      "ㅊ",
      "ㅋ",
      "ㅌ",
      "ㅍ",
      "ㅎ",
    ];

    let consonants = "";
    let vowels = "";

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i) - 0xac00;
      if (code >= 0 && code <= 11171) {
        consonants += cho[Math.floor(code / 588)]; // 초성
        vowels += jung[Math.floor((code % 588) / 28)]; // 중성
        const batchim = jong[code % 28]; // 종성
        if (batchim) consonants += batchim;
      } else if (text[i] !== " ") {
        consonants += text[i];
      }
    }
    return { consonants, vowels };
  }

  analyzeDetailed(expected: string, actual: string): PronunciationMetrics {
    const expClean = expected.replace(/\s+/g, "").toLowerCase();
    const actClean = actual.replace(/\s+/g, "").toLowerCase();

    // 자모 분리 데이터 확보
    const expJamo = this.getDetailedJamo(expClean);
    const actJamo = this.getDetailedJamo(actClean);

    // 자음/모음 각각의 정확도 계산
    const consonantAccuracy = this.calculateSimilarity(
      expJamo.consonants,
      actJamo.consonants,
    );
    const vowelAccuracy = this.calculateSimilarity(
      expJamo.vowels,
      actJamo.vowels,
    );
    const syllableAccuracy = this.calculateSimilarity(expClean, actClean);

    return {
      syllableAccuracy,
      tonalAccuracy: syllableAccuracy,
      speedRatio: actClean.length / (expClean.length || 1),
      clarityScore: (consonantAccuracy + vowelAccuracy) / 2,
      consonantAccuracy,
      vowelAccuracy,
    };
  }
}

// 4. 통합 분석기
export class SpeechAnalyzer {
  private recorder = new AudioRecorder();
  private transcriber: WhisperTranscriber;
  private pronunciationAnalyzer = new PronunciationAnalyzer();
  private startTime: number = 0;

  constructor() {
    this.transcriber = new WhisperTranscriber();
  }

  async startAnalysis(
    onAudioLevel?: (level: number) => void,
    inputStream?: MediaStream,
  ) {
    this.startTime = Date.now();
    await this.recorder.startRecording(onAudioLevel, inputStream);
  }

  async stopAnalysis(expectedText: string): Promise<SpeechAnalysisResult> {
    const audioBlob = await this.recorder.stopRecording();
    const duration = Date.now() - this.startTime;
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

    if (isDevMode) {
      return {
        transcript: expectedText,
        confidence: 0.99,
        pronunciationScore: 95,
        duration,
        audioLevel: 50,
        audioBlob,
        details: { consonantAccuracy: 96, vowelAccuracy: 94 },
      };
    }

    try {
      const { text, confidence } = await this.transcriber.transcribe(audioBlob);
      const metrics = this.pronunciationAnalyzer.analyzeDetailed(
        expectedText,
        text,
      );

      return {
        transcript: text,
        confidence,
        pronunciationScore: Math.round(metrics.clarityScore),
        duration,
        audioLevel: 0,
        audioBlob,
        details: {
          consonantAccuracy: metrics.consonantAccuracy,
          vowelAccuracy: metrics.vowelAccuracy,
        },
      };
    } catch (error) {
      console.error("STT 분석 실패, 로컬 오디오 저장만 진행:", error);
      return {
        transcript: "",
        confidence: 0,
        pronunciationScore: 0,
        duration,
        audioLevel: 0,
        audioBlob,
        errorReason:
          error instanceof Error ? error.message : "stt_unknown_error",
        details: {
          consonantAccuracy: 0,
          vowelAccuracy: 0,
        },
      };
    }
  }

  cancelAnalysis(): void {
    this.recorder.cancelRecording();
  }
}
