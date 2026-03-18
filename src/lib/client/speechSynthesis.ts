"use client";

function getSpeechSynthesisSafe() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  return window.speechSynthesis;
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  const name = String(voice.name || "").toLowerCase();
  const lang = String(voice.lang || "").toLowerCase();

  let score = 0;
  if (lang.startsWith("ko")) score += 10;
  if (voice.default) score += 6;
  if (voice.localService) score += 4;

  if (name.includes("google")) score += 8;
  if (name.includes("microsoft")) score += 7;
  if (name.includes("sunhi")) score += 10;
  if (name.includes("heami")) score += 8;
  if (name.includes("yuna")) score += 7;
  if (name.includes("female")) score += 1;

  return score;
}

export function pickPreferredKoreanVoice(
  synth: SpeechSynthesis,
): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  const koreanVoices = voices.filter((voice) =>
    String(voice.lang || "").toLowerCase().startsWith("ko"),
  );
  if (!koreanVoices.length) return null;

  return [...koreanVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

export async function speakKoreanText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  },
) {
  const synth = getSpeechSynthesisSafe();
  if (!synth) return;

  const normalized = String(text || "").trim();
  if (!normalized) return;

  const rate = options?.rate ?? 0.95;
  const pitch = options?.pitch ?? 1;
  const volume = options?.volume ?? 1;

  const speak = () =>
    new Promise<void>((resolve) => {
      synth.cancel();
      synth.resume();

      const utterance = new SpeechSynthesisUtterance(normalized);
      utterance.lang = "ko-KR";
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      const preferred = pickPreferredKoreanVoice(synth);
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
    });

  if (synth.getVoices().length > 0) {
    await speak();
    return;
  }

  await new Promise<void>((resolve) => {
    const handleVoicesChanged = () => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve();
    };
    synth.addEventListener("voiceschanged", handleVoicesChanged);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve();
    }, 700);
  });

  await speak();
}

export function cancelSpeechPlayback() {
  const synth = getSpeechSynthesisSafe();
  if (!synth) return;
  synth.cancel();
}
