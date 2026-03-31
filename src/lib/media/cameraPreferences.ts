const CAMERA_STORAGE_KEY = "lingofriends.preferredCameraId";

export function loadPreferredCameraId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CAMERA_STORAGE_KEY) ?? "";
}

export function savePreferredCameraId(deviceId: string) {
  if (typeof window === "undefined") return;
  if (!deviceId) {
    window.localStorage.removeItem(CAMERA_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(CAMERA_STORAGE_KEY, deviceId);
}

export async function listVideoInputDevices() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

export async function createPreferredCameraStream(preferredCameraId?: string) {
  const baseVideo = {
    width: { ideal: 640 },
    height: { ideal: 480 },
  };

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("camera_not_supported");
  }

  if (preferredCameraId) {
    return navigator.mediaDevices.getUserMedia({
      video: {
        ...baseVideo,
        deviceId: { exact: preferredCameraId },
      },
    });
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      ...baseVideo,
      facingMode: "user",
    },
  });
}
