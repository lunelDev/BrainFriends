"""voice-analysis-service / analyzer.py

Parselmouth (Praat) 기반 음향 지표 산출 로직.

REQ-ACOUSTIC-001 (F0), 002 (Intensity), 003 (Voicing ratio),
004 (Duration), 010 (Jitter), 011 (Shimmer), 012 (HNR),
020 (Formant F1/F2), 021 (모음 mid-frame 선택),
030 (measurement_quality), 050 (version snapshot) 까지 본 모듈에서 처리한다.
"""

from __future__ import annotations

import io
import math
import os
import sys
import tempfile
from typing import Any, Dict, Optional

import numpy as np


# ── 응답 스켈레톤 ────────────────────────────────────────────────
# Next.js 프록시의 NULL_RESULT 와 같은 형태.
NULL_RESULT: Dict[str, Any] = {
    "duration_sec": None,
    "f0": {
        "mean_hz": None,
        "std_hz": None,
        "min_hz": None,
        "max_hz": None,
    },
    "intensity": {
        "mean_db": None,
        "max_db": None,
    },
    "voicing_ratio": None,
    # REQ-ACOUSTIC-010 / 011 / 012. 값 없으면 모두 None.
    # jitter_local / shimmer_local 단위: % (Praat 반환 fraction × 100 로 변환).
    # hnr_mean_db 단위: dB.
    "jitter_local_pct": None,
    "shimmer_local_pct": None,
    "hnr_mean_db": None,
    # REQ-ACOUSTIC-020 / 021. formant F1/F2 (Hz) + 모음 mid-frame 시각(초).
    "formants": {
        "f1_hz": None,
        "f2_hz": None,
        "mid_frame_time": None,
    },
    "measurement_quality": "failed",
}


# ── 예외 ─────────────────────────────────────────────────────────
class AudioDecodeError(Exception):
    """컨테이너/코덱 디코딩 실패 (ffmpeg 미설치 또는 손상 파일)."""


class AcousticAnalysisError(Exception):
    """parselmouth 호출 단계에서 발생한 예외."""


# ── 유틸 ─────────────────────────────────────────────────────────
def _safe_float(x: Any) -> Optional[float]:
    """NaN / inf / None → None, 그 외엔 float 캐스팅. JSON serializable 보장."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def version_snapshot() -> Dict[str, str]:
    """REQ-ACOUSTIC-050 — version_snapshot 4종 채우기."""
    parselmouth_version = "unknown"
    praat_date = "unknown"
    numpy_version = np.__version__

    try:
        import parselmouth  # type: ignore

        parselmouth_version = getattr(parselmouth, "__version__", "unknown")
        praat_date = getattr(
            parselmouth,
            "PRAAT_VERSION_DATE",
            getattr(parselmouth, "PRAAT_VERSION", "unknown"),
        )
        # PRAAT_VERSION_DATE 이 datetime 객체일 수 있어 안전 변환.
        praat_date = str(praat_date)
    except Exception:
        pass

    return {
        "parselmouth": str(parselmouth_version),
        "praat_version_date": str(praat_date),
        "python": sys.version.replace("\n", " "),
        "numpy": str(numpy_version),
    }


# ── 디코딩 ───────────────────────────────────────────────────────
def _decode_to_wav_path(file_bytes: bytes, filename: str) -> str:
    """입력 오디오를 임시 wav 파일로 만들어 경로를 반환.

    1차: soundfile 로 직접 읽어보기 (wav/flac/ogg 등 지원).
    2차: pydub + ffmpeg 로 변환 (webm/mp4/m4a/mp3 처리).

    실패 시 AudioDecodeError 를 던진다.
    """

    suffix = os.path.splitext(filename)[1].lower() or ".bin"

    # 입력 원본을 일단 임시 파일로 떨어뜨려 둔다 (pydub 가 path 기반).
    src_fd, src_path = tempfile.mkstemp(suffix=suffix, prefix="va_in_")
    try:
        os.write(src_fd, file_bytes)
    finally:
        os.close(src_fd)

    # 출력 wav 임시 파일 경로.
    dst_fd, dst_path = tempfile.mkstemp(suffix=".wav", prefix="va_out_")
    os.close(dst_fd)

    # 1차 시도 — soundfile.
    try:
        import soundfile as sf  # type: ignore

        try:
            data, samplerate = sf.read(io.BytesIO(file_bytes), always_2d=False)
            # 모노로 다운믹스.
            if hasattr(data, "ndim") and data.ndim > 1:
                data = data.mean(axis=1)
            sf.write(dst_path, data, samplerate, subtype="PCM_16")
            _silently_unlink(src_path)
            return dst_path
        except Exception:
            # soundfile 이 못 읽는 포맷일 수 있음 → pydub 로 폴백.
            pass

        # 2차 시도 — pydub + ffmpeg.
        try:
            from pydub import AudioSegment  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise AudioDecodeError(f"pydub import failed: {exc}") from exc

        try:
            seg = AudioSegment.from_file(src_path)
            # 모노 16-bit PCM 으로 정규화.
            seg = seg.set_channels(1).set_sample_width(2)
            seg.export(dst_path, format="wav")
        except Exception as exc:
            raise AudioDecodeError(
                f"ffmpeg decoding failed for {filename}: {exc}"
            ) from exc
        finally:
            _silently_unlink(src_path)

        return dst_path

    except AudioDecodeError:
        _silently_unlink(src_path)
        _silently_unlink(dst_path)
        raise
    except Exception as exc:
        _silently_unlink(src_path)
        _silently_unlink(dst_path)
        raise AudioDecodeError(f"unexpected decode error: {exc}") from exc


def _silently_unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


# ── Jitter / Shimmer / HNR (REQ-ACOUSTIC-010 / 011 / 012) ─────
# Praat 권장 파라미터:
#   pitch floor = 75 Hz, ceiling = 600 Hz (F0 와 동일)
#   jitter/shimmer period window:
#     time_range = (0, 0)  전체
#     shortest_period = 0.0001 s
#     longest_period = 0.02 s
#     maximum_period_factor = 1.3
#     (shimmer 한정) maximum_amplitude_factor = 1.6
# 반환값은 fraction (0.005 = 0.5%). UI 에선 % 단위가 친숙해 ×100 해서 전달.


def _extract_jitter_shimmer_hnr(
    sound: Any,
    parselmouth_module: Any,
) -> Dict[str, Optional[float]]:
    """REQ-010/011/012 산출. 실패 시 각 항목 None."""

    jitter_pct: Optional[float] = None
    shimmer_pct: Optional[float] = None
    hnr_db: Optional[float] = None

    # ── PointProcess (jitter/shimmer 공통 입력) ─────────────────
    point_process = None
    try:
        point_process = parselmouth_module.praat.call(
            sound, "To PointProcess (periodic, cc)", 75.0, 600.0
        )
    except Exception:
        point_process = None

    # ── REQ-010 Jitter (local) ─────────────────────────────────
    if point_process is not None:
        try:
            jitter_frac = parselmouth_module.praat.call(
                point_process,
                "Get jitter (local)",
                0.0,  # time range start
                0.0,  # time range end (0,0 = entire)
                0.0001,  # shortest period
                0.02,  # longest period
                1.3,  # max period factor
            )
            jitter_safe = _safe_float(jitter_frac)
            if jitter_safe is not None:
                jitter_pct = jitter_safe * 100.0
        except Exception:
            pass

        # ── REQ-011 Shimmer (local) ────────────────────────────
        try:
            shimmer_frac = parselmouth_module.praat.call(
                [sound, point_process],
                "Get shimmer (local)",
                0.0,
                0.0,
                0.0001,
                0.02,
                1.3,
                1.6,  # max amplitude factor
            )
            shimmer_safe = _safe_float(shimmer_frac)
            if shimmer_safe is not None:
                shimmer_pct = shimmer_safe * 100.0
        except Exception:
            pass

    # ── REQ-012 HNR ──────────────────────────────────────────
    try:
        # Harmonicity (cc): Praat 기본.
        harmonicity = parselmouth_module.praat.call(
            sound,
            "To Harmonicity (cc)",
            0.01,  # time step (s)
            75.0,  # minimum pitch (Hz)
            0.1,  # silence threshold
            1.0,  # periods per window
        )
        hnr_value = parselmouth_module.praat.call(
            harmonicity, "Get mean", 0.0, 0.0
        )
        hnr_db = _safe_float(hnr_value)
    except Exception:
        pass

    return {
        "jitter_local_pct": jitter_pct,
        "shimmer_local_pct": shimmer_pct,
        "hnr_mean_db": hnr_db,
    }


# ── Formant F1/F2 + 모음 mid-frame (REQ-ACOUSTIC-020 / 021) ─────
# Praat Burg 방식 + 성인 기본 파라미터 (max formant = 5500 Hz).
# 모음 mid-frame 선택 전략:
#   1) Pitch 에서 voiced frame 목록을 뽑는다 (f0 > 0 인 구간).
#   2) 각 voiced frame 에서 Formant 객체를 시각으로 조회해 F1 을 샘플링한다.
#   3) 연속된 voiced 구간(run)들을 찾아낸다.
#   4) 각 run 에 대해 F1 의 분산(population std)을 구한다.
#   5) 분산이 가장 낮은 run 을 선택하고 (동률이면 먼저 등장한 run) 그
#      run 의 mid-frame index 에서 F1·F2 를 대표값으로 반환한다.
# 결정론 보장: parselmouth 호출 순서 + numpy 결정론적 연산만 사용. random 금지.
# 재녹음 견뢰성: run-단위 분산 최소 선택 → 잡음 spike 에 덜 민감.


def _extract_formants(
    sound: Any,
    parselmouth_module: Any,
) -> Dict[str, Optional[float]]:
    """REQ-020 (F1/F2) + REQ-021 (모음 mid-frame) 산출. 실패 시 각 항목 None.

    - time step      : 0.01 s
    - max formants   : 5
    - max formant    : 5500 Hz (성인 기본)
    - window length  : 0.025 s
    - preemphasis    : 50 Hz
    """

    f1_hz: Optional[float] = None
    f2_hz: Optional[float] = None
    mid_frame_time: Optional[float] = None

    try:
        formant = parselmouth_module.praat.call(
            sound,
            "To Formant (burg)",
            0.01,   # time step (s)
            5.0,    # max number of formants
            5500.0, # max formant (Hz), 성인 기본
            0.025,  # window length (s)
            50.0,   # preemphasis from (Hz)
        )
    except Exception:
        return {
            "f1_hz": None,
            "f2_hz": None,
            "mid_frame_time": None,
        }

    # Voiced frame 추출 — Pitch 결과의 시간축을 formant 샘플링에 재사용.
    try:
        pitch = sound.to_pitch(pitch_floor=75.0, pitch_ceiling=600.0)
    except Exception:
        return {
            "f1_hz": None,
            "f2_hz": None,
            "mid_frame_time": None,
        }

    try:
        freqs = np.asarray(pitch.selected_array["frequency"], dtype=float)
    except Exception:
        return {
            "f1_hz": None,
            "f2_hz": None,
            "mid_frame_time": None,
        }

    if freqs.size == 0:
        return {
            "f1_hz": None,
            "f2_hz": None,
            "mid_frame_time": None,
        }

    # Pitch frame 시각 산출 — parselmouth 인터페이스 차이를 흡수.
    times: list
    try:
        # Praat 표준 — t1 + step*i.
        t1 = float(parselmouth_module.praat.call(pitch, "Get time from frame number", 1))
        # Pitch 의 time step.
        try:
            dt = float(parselmouth_module.praat.call(pitch, "Get time step"))
        except Exception:
            # fallback: get time of 2nd frame.
            try:
                t2 = float(
                    parselmouth_module.praat.call(
                        pitch, "Get time from frame number", 2
                    )
                )
                dt = t2 - t1
            except Exception:
                dt = 0.01
        times = [t1 + dt * i for i in range(int(freqs.size))]
    except Exception:
        # 최후의 수단 — pitch.xs() (parselmouth 에서 자주 제공).
        try:
            xs = pitch.xs()
            times = [float(t) for t in xs]
            if len(times) != freqs.size:
                times = list(times[: freqs.size])
        except Exception:
            return {
                "f1_hz": None,
                "f2_hz": None,
                "mid_frame_time": None,
            }

    # 각 voiced frame 에 대해 F1 샘플링. (voiced = f0 > 0)
    # 나중에 F2 샘플링은 선택된 frame 에만 하면 되므로 여기선 F1 만.
    voiced_indices: list = []
    voiced_times: list = []
    voiced_f1: list = []

    for i in range(int(freqs.size)):
        f0 = freqs[i]
        if not (f0 > 0):
            continue
        try:
            t = float(times[i])
        except Exception:
            continue
        try:
            f1_val = parselmouth_module.praat.call(
                formant, "Get value at time", 1, t, "Hertz", "Linear"
            )
        except Exception:
            continue
        f1_safe = _safe_float(f1_val)
        if f1_safe is None:
            continue
        voiced_indices.append(i)
        voiced_times.append(t)
        voiced_f1.append(f1_safe)

    if not voiced_indices:
        return {
            "f1_hz": None,
            "f2_hz": None,
            "mid_frame_time": None,
        }

    # 연속된 voiced run 찾기 — frame index 가 연속(+1)인 구간.
    # (i, length) 목록을 만든 뒤 run 내부 F1 분산 최소 기준으로 고른다.
    runs: list = []  # list of (start_idx_in_voiced_arr, end_idx_inclusive)
    run_start = 0
    for k in range(1, len(voiced_indices)):
        if voiced_indices[k] != voiced_indices[k - 1] + 1:
            runs.append((run_start, k - 1))
            run_start = k
    runs.append((run_start, len(voiced_indices) - 1))

    # 너무 짧은 run (frame 1~2개) 은 분산 의미가 약하지만 그래도 사용.
    # 결정론 보장: 동률일 때 먼저 등장한 run 우선 (enumerate 순서 유지).
    best_run_idx = 0
    best_variance = math.inf
    for run_i, (a, b) in enumerate(runs):
        seg = voiced_f1[a : b + 1]
        if len(seg) == 0:
            continue
        arr = np.asarray(seg, dtype=float)
        # population std (ddof=0) — frame 1 개일 땐 0 으로 판정.
        try:
            var = float(np.std(arr, ddof=0))
        except Exception:
            continue
        if var < best_variance:
            best_variance = var
            best_run_idx = run_i

    a, b = runs[best_run_idx]
    # Mid-frame index (결정론: 정수 나눗셈 + 낮은 쪽 선택).
    mid_in_run = (a + b) // 2
    chosen_time = float(voiced_times[mid_in_run])
    chosen_f1 = _safe_float(voiced_f1[mid_in_run])

    # F2 는 선택된 mid-frame 에서만 샘플링.
    chosen_f2: Optional[float] = None
    try:
        f2_val = parselmouth_module.praat.call(
            formant, "Get value at time", 2, chosen_time, "Hertz", "Linear"
        )
        chosen_f2 = _safe_float(f2_val)
    except Exception:
        chosen_f2 = None

    f1_hz = chosen_f1
    f2_hz = chosen_f2
    mid_frame_time = chosen_time

    return {
        "f1_hz": f1_hz,
        "f2_hz": f2_hz,
        "mid_frame_time": mid_frame_time,
    }


# ── 측정 품질 게이트 ─────────────────────────────────────────────
def _grade_quality(
    duration_sec: Optional[float],
    voicing_ratio: Optional[float],
    max_intensity_db: Optional[float],
    f0_mean: Optional[float],
) -> str:
    """REQ-ACOUSTIC-030 — measurement_quality 판정.

    - 모든 핵심 지표가 None → 'failed'
    - 너무 짧음 / 유성음 부족 / 강도 너무 낮음 → 'degraded'
    - 그 외 → 'measured'
    """

    metrics = [duration_sec, voicing_ratio, max_intensity_db, f0_mean]
    if all(m is None for m in metrics):
        return "failed"

    # 길이 미달.
    if duration_sec is not None and duration_sec < 0.3:
        return "degraded"

    # 유성음 거의 없음 → 잡음/무음 가능성.
    if voicing_ratio is not None and voicing_ratio < 0.1:
        return "degraded"

    # 강도가 너무 낮음 → 마이크 off 또는 매우 먼 음원.
    if max_intensity_db is not None and max_intensity_db < 30.0:
        return "degraded"

    # F0 자체가 못 잡혔으면 degraded (silent 또는 noise-only 가까움).
    if f0_mean is None:
        return "degraded"

    return "measured"


# ── 메인 분석 ────────────────────────────────────────────────────
def analyze_audio(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """입력 오디오 → REQ-001~004 + 010~012 + 020/021 + 030 결과 dict.

    반환 형태는 NULL_RESULT 와 동일 키 구조이며 Next.js
    `AcousticResult` 타입과 일치한다. 모든 수치는 JSON serializable
    (None / int / float) 로 보장된다.
    """

    wav_path = _decode_to_wav_path(file_bytes, filename)

    try:
        # parselmouth 는 import 자체가 무거우므로 함수 내에서 lazy import.
        try:
            import parselmouth  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise AcousticAnalysisError(
                f"parselmouth import failed: {exc}"
            ) from exc

        try:
            sound = parselmouth.Sound(wav_path)
        except Exception as exc:
            raise AcousticAnalysisError(f"parselmouth.Sound load failed: {exc}") from exc

        # ── REQ-ACOUSTIC-004 — Duration ────────────────────────
        try:
            duration_sec = _safe_float(sound.get_total_duration())
        except Exception:
            duration_sec = None

        # ── REQ-ACOUSTIC-001 — F0 ──────────────────────────────
        f0_mean = f0_std = f0_min = f0_max = None
        voicing_ratio: Optional[float] = None
        try:
            pitch = sound.to_pitch(pitch_floor=75.0, pitch_ceiling=600.0)
            freqs = np.asarray(pitch.selected_array["frequency"], dtype=float)
            voiced = freqs[freqs > 0]
            if voiced.size > 0:
                f0_mean = _safe_float(np.mean(voiced))
                # std 는 표본이 1개면 NaN — _safe_float 에서 None 처리.
                f0_std = _safe_float(np.std(voiced, ddof=0))
                f0_min = _safe_float(np.min(voiced))
                f0_max = _safe_float(np.max(voiced))
            # ── REQ-ACOUSTIC-003 — Voicing Ratio ───────────────
            if freqs.size > 0:
                voicing_ratio = _safe_float(voiced.size / float(freqs.size))
        except Exception:
            # F0 추출이 실패해도 다른 지표는 계속 시도.
            pass

        # ── REQ-ACOUSTIC-002 — Intensity ───────────────────────
        intensity_mean = intensity_max = None
        try:
            intensity = sound.to_intensity()
            values = np.asarray(intensity.values, dtype=float).ravel()
            valid = values[np.isfinite(values)]
            if valid.size > 0:
                intensity_mean = _safe_float(np.mean(valid))
                intensity_max = _safe_float(np.max(valid))
        except Exception:
            pass

        # ── REQ-010/011/012 — Jitter / Shimmer / HNR ─────────
        try:
            jsh = _extract_jitter_shimmer_hnr(sound, parselmouth)
        except Exception:
            jsh = {
                "jitter_local_pct": None,
                "shimmer_local_pct": None,
                "hnr_mean_db": None,
            }

        # ── REQ-020/021 — Formant F1/F2 + 모음 mid-frame ─────
        try:
            formants = _extract_formants(sound, parselmouth)
        except Exception:
            formants = {
                "f1_hz": None,
                "f2_hz": None,
                "mid_frame_time": None,
            }

        quality = _grade_quality(
            duration_sec=duration_sec,
            voicing_ratio=voicing_ratio,
            max_intensity_db=intensity_max,
            f0_mean=f0_mean,
        )

        return {
            "duration_sec": duration_sec,
            "f0": {
                "mean_hz": f0_mean,
                "std_hz": f0_std,
                "min_hz": f0_min,
                "max_hz": f0_max,
            },
            "intensity": {
                "mean_db": intensity_mean,
                "max_db": intensity_max,
            },
            "voicing_ratio": voicing_ratio,
            "jitter_local_pct": jsh["jitter_local_pct"],
            "shimmer_local_pct": jsh["shimmer_local_pct"],
            "hnr_mean_db": jsh["hnr_mean_db"],
            "formants": {
                "f1_hz": formants["f1_hz"],
                "f2_hz": formants["f2_hz"],
                "mid_frame_time": formants["mid_frame_time"],
            },
            "measurement_quality": quality,
        }

    finally:
        _silently_unlink(wav_path)
