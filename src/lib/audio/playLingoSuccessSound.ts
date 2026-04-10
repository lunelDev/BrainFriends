export function playLingoSuccessSound() {
  if (typeof window === "undefined") return;

  const AudioCtor =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtor) return;

  try {
    const audioContext = new AudioCtor();
    const now = audioContext.currentTime;

    const firstOsc = audioContext.createOscillator();
    const firstGain = audioContext.createGain();
    firstOsc.type = "triangle";
    firstOsc.frequency.setValueAtTime(880, now);
    firstOsc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    firstGain.gain.setValueAtTime(0.0001, now);
    firstGain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    firstGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    firstOsc.connect(firstGain);
    firstGain.connect(audioContext.destination);

    const secondOsc = audioContext.createOscillator();
    const secondGain = audioContext.createGain();
    secondOsc.type = "triangle";
    secondOsc.frequency.setValueAtTime(1320, now + 0.1);
    secondOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.22);
    secondGain.gain.setValueAtTime(0.0001, now + 0.09);
    secondGain.gain.exponentialRampToValueAtTime(0.09, now + 0.11);
    secondGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    secondOsc.connect(secondGain);
    secondGain.connect(audioContext.destination);

    firstOsc.start(now);
    firstOsc.stop(now + 0.14);
    secondOsc.start(now + 0.1);
    secondOsc.stop(now + 0.26);

    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined);
    }, 400);
  } catch {
    // no-op
  }
}
