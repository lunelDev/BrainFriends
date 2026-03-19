"use client";

declare global {
  interface Window {
    __BRAINFRIENDS_ACTIVE_STREAMS__?: Set<MediaStream>;
  }
}

function getRegistry() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!window.__BRAINFRIENDS_ACTIVE_STREAMS__) {
    window.__BRAINFRIENDS_ACTIVE_STREAMS__ = new Set<MediaStream>();
  }

  return window.__BRAINFRIENDS_ACTIVE_STREAMS__;
}

export function registerMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  const registry = getRegistry();
  registry?.add(stream);
}

export function unregisterMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  const registry = getRegistry();
  registry?.delete(stream);
}

export function stopRegisteredMediaStreams() {
  const registry = getRegistry();
  if (!registry) return;

  for (const stream of registry) {
    stream.getTracks().forEach((track) => track.stop());
  }

  registry.clear();
}
