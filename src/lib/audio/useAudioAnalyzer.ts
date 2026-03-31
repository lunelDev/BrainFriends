'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function useAudioAnalyzer() {
  const [volume, setVolume] = useState(0);
  const [isMicReady, setIsMicReady] = useState(false);
  const [error, setError] = useState('');

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    setIsMicReady(false);
    setVolume(0);
  }, []);

  const start = useCallback(async () => {
    try {
      stop();
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.fftSize);

      streamRef.current = stream;
      audioContextRef.current = context;
      analyserRef.current = analyser;
      dataArrayRef.current = buffer;
      setIsMicReady(true);

      const update = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i += 1) {
          const centered = (dataArrayRef.current[i] - 128) / 128;
          sum += centered * centered;
        }

        const rms = Math.sqrt(sum / dataArrayRef.current.length);
        const nextVolume = clamp(Math.round(rms * 220), 0, 100);
        setVolume(nextVolume);
        animationFrameRef.current = requestAnimationFrame(update);
      };

      animationFrameRef.current = requestAnimationFrame(update);
      return true;
    } catch (requestError) {
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
