'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  registerMediaStream,
  unregisterMediaStream,
} from '@/lib/client/mediaStreamRegistry';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useBalloonAudioInput() {
  const [volume, setVolume] = useState(0);
  const [isMicReady, setIsMicReady] = useState(false);
  const [error, setError] = useState('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedVolumeRef = useRef(0);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      unregisterMediaStream(streamRef.current);
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    smoothedVolumeRef.current = 0;
    setIsMicReady(false);
    setVolume(0);
  }, []);

  const start = useCallback(async () => {
    try {
      stop();
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported');
      }

      const context = new AudioContextClass();
      if (context.state === 'suspended') {
        await context.resume();
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.18;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);

      streamRef.current = stream;
      registerMediaStream(stream);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      dataArrayRef.current = buffer;
      smoothedVolumeRef.current = 0;
      setIsMicReady(true);

      const update = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

        let sum = 0;
        let peak = 0;
        for (let i = 0; i < dataArrayRef.current.length; i += 1) {
          const centered = (dataArrayRef.current[i] - 128) / 128;
          const abs = Math.abs(centered);
          if (abs > peak) peak = abs;
          sum += centered * centered;
        }

        const rms = Math.sqrt(sum / dataArrayRef.current.length);
        // 풍선 게임은 지속 발성 체감이 중요해서 일반 발성이 40~60 구간까지
        // 좀 더 쉽게 올라오도록 스케일을 적극적으로 보정한다.
        const boosted = clamp(Math.round(rms * 520 + peak * 148), 0, 100);

        // 풍선 게임은 "말하는 중 바로 커지고, 멈추면 바로 유지/감쇠"가 중요하다.
        // 평균값을 길게 끌기보다 상승은 즉시, 감쇠는 짧게 주는 방식으로 바꾼다.
        if (boosted >= smoothedVolumeRef.current) {
          smoothedVolumeRef.current =
            smoothedVolumeRef.current * 0.18 + boosted * 0.82;
        } else {
          smoothedVolumeRef.current = Math.max(
            0,
            smoothedVolumeRef.current * 0.68 - 2.8,
          );
        }

        const nextVolume = clamp(Math.round(smoothedVolumeRef.current), 0, 100);
        setVolume(nextVolume);
        animationFrameRef.current = requestAnimationFrame(update);
      };

      animationFrameRef.current = requestAnimationFrame(update);
      return true;
    } catch {
      setError('마이크 권한이 필요합니다. 브라우저에서 마이크 허용 후 다시 시도해 주세요.');
      setIsMicReady(false);
      setVolume(0);
      return false;
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {
    volume,
    isMicReady,
    error,
    start,
    stop,
  };
}
