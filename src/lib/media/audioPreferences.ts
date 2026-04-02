const AUDIO_STORAGE_KEY = "lingofriends.preferredAudioInputId";

export function loadPreferredAudioInputId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUDIO_STORAGE_KEY) ?? "";
}

export function savePreferredAudioInputId(deviceId: string) {
  if (typeof window === "undefined") return;
  if (!deviceId) {
    window.localStorage.removeItem(AUDIO_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUDIO_STORAGE_KEY, deviceId);
}

export async function listAudioInputDevices() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "audioinput");
}

export async function createPreferredAudioStream(preferredAudioInputId?: string) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("audio_not_supported");
  }

  const baseAudio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  if (preferredAudioInputId) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        ...baseAudio,
        deviceId: { exact: preferredAudioInputId },
      },
    });
  }

  return navigator.mediaDevices.getUserMedia({
    audio: baseAudio,
  });
}
