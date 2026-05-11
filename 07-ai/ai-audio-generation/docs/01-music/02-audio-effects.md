# Audio Effects — AI EQ, Noise Removal, Mastering

> An explanation of AI-powered audio effect processing (EQ, noise removal, mastering) techniques and implementation

## What You Will Learn in This Chapter

1. Differences between traditional and AI audio effects, and the main processing categories
2. Technical mechanisms and implementation of AI noise removal, automatic EQ, and automatic mastering
3. Building practical effect chains and quality improvement patterns


## Prerequisites

Having the following knowledge will deepen your understanding of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding the content of [Stem Separation — Demucs, LALAL.AI](./01-stem-separation.md)

---

## 1. Audio Effects Fundamentals

### 1.1 Effect Chain Structure

```
Standard Audio Effect Chain
==================================================

Input Audio
  |
  v
+-----------------+
| 1. Denoise      |  Background noise, hum removal
|   (Denoise)     |  <- AI is most effective here
+--------+--------+
         v
+-----------------+
| 2. EQ           |  Frequency balance adjustment
|  (Equalizer)    |  <- AI auto-optimization
+--------+--------+
         v
+-----------------+
| 3. Comp         |  Dynamic range compression
| (Compressor)    |  Leveling volume differences
+--------+--------+
         v
+-----------------+
| 4. Reverb       |  Adding spatial depth
|  (Reverb)       |
+--------+--------+
         v
+-----------------+
| 5. Limiter      |  Peak control
|  (Limiter)      |  Clipping prevention
+--------+--------+
         v
+-----------------+
| 6. Mastering    |  Final adjustment
|  (Mastering)    |  <- Can be automated with AI
+--------+--------+
         v
  Output Audio
==================================================
```

### 1.2 Traditional vs AI Effects Comparison

```python
# Comparison of traditional noise removal vs AI noise removal

import numpy as np

# Traditional method: Spectral subtraction
def spectral_subtraction(noisy_signal, noise_profile, sr=16000):
    """
    Spectral Subtraction Method
    - Pre-estimate noise profile (from silent segments)
    - Subtract noise spectrum from clean audio
    - Limitation: Only effective for stationary noise, produces musical noise
    """
    n_fft = 2048
    hop = 512

    # STFT
    noisy_stft = np.fft.rfft(noisy_signal)
    noise_stft = np.fft.rfft(noise_profile)

    # Spectral subtraction
    noise_power = np.abs(noise_stft) ** 2
    noisy_power = np.abs(noisy_stft) ** 2
    clean_power = np.maximum(noisy_power - noise_power, 0)

    # Preserve original phase
    phase = np.angle(noisy_stft)
    clean_stft = np.sqrt(clean_power) * np.exp(1j * phase)

    return np.fft.irfft(clean_stft)

# AI method: Neural network
def ai_denoise(noisy_signal, model):
    """
    AI Noise Removal
    - Handles non-stationary noise
    - No noise profile required
    - Less prone to musical noise artifacts
    """
    # Preprocessing
    mel_spec = compute_mel_spectrogram(noisy_signal)
    # Mask estimation (U-Net model)
    clean_mask = model.predict(mel_spec)
    # Apply mask
    clean_spec = mel_spec * clean_mask
    # Inverse transform
    return inverse_mel_spectrogram(clean_spec)
```

### 1.3 Signal Processing Classification of Audio Effects

Audio effects can be broadly classified from a signal processing perspective into the following categories. It is important to understand how AI improves upon traditional methods in each category.

```
Signal Processing Classification of Audio Effects
==================================================

1. Time-Domain Effects
   +-- Delay
   +-- Reverb (Reverberation)
   +-- Chorus (Modulation)
   +-- Flanger / Phaser

2. Frequency-Domain Effects
   +-- EQ (Frequency balance adjustment)
   +-- Low-pass / High-pass filter
   +-- Notch filter (Specific frequency removal)
   +-- Wah (Frequency sweep)

3. Dynamics Effects
   +-- Compressor (Volume difference compression)
   +-- Limiter (Peak control)
   +-- Noise Gate (Noise removal during silence)
   +-- Expander (Makes quiet parts even quieter)

4. Noise Processing
   +-- Noise Removal (Stationary / Non-stationary)
   +-- De-reverb (Reverberation removal)
   +-- De-esser (Sibilance removal)
   +-- Hum Removal (Power line noise removal)

5. Spatial Effects
   +-- Panning (Left-right placement)
   +-- Stereo Imaging
   +-- Binaural Processing (3D audio)
   +-- HRTF (Head-Related Transfer Function)

AI Strengths:
  ★★★ Noise Processing — Overwhelming advantage with non-stationary noise
  ★★☆ Frequency Domain — Automatic target profile adjustment
  ★★☆ Dynamics — Context-aware automatic parameters
  ★☆☆ Spatial — Room estimation and automatic reverb
  ★☆☆ Time Domain — Humans excel at creative effects
==================================================
```

### 1.4 Detailed Fundamental Concepts in Audio Processing

```python
import numpy as np
from scipy import signal

class AudioEffectsFoundation:
    """A class demonstrating the fundamental concepts of audio effects"""

    @staticmethod
    def compute_stft(audio: np.ndarray, n_fft: int = 2048,
                     hop_length: int = 512) -> np.ndarray:
        """
        Short-Time Fourier Transform (STFT)
        - Converts audio to time-frequency representation
        - The foundational transform for effect processing
        - n_fft: FFT window size (affects frequency resolution)
        - hop_length: Window interval (affects time resolution)
        """
        window = np.hanning(n_fft)
        n_frames = (len(audio) - n_fft) // hop_length + 1
        stft = np.zeros((n_fft // 2 + 1, n_frames), dtype=complex)

        for i in range(n_frames):
            start = i * hop_length
            frame = audio[start:start + n_fft] * window
            stft[:, i] = np.fft.rfft(frame)

        return stft

    @staticmethod
    def compute_magnitude_phase(stft: np.ndarray):
        """Decompose spectrogram into magnitude and phase"""
        magnitude = np.abs(stft)
        phase = np.angle(stft)
        return magnitude, phase

    @staticmethod
    def reconstruct_from_stft(magnitude: np.ndarray, phase: np.ndarray,
                               hop_length: int = 512) -> np.ndarray:
        """Reconstruct STFT from magnitude and phase, and convert back to audio via inverse transform"""
        stft = magnitude * np.exp(1j * phase)
        n_fft = (stft.shape[0] - 1) * 2
        n_frames = stft.shape[1]
        output_length = n_fft + (n_frames - 1) * hop_length
        output = np.zeros(output_length)
        window = np.hanning(n_fft)

        for i in range(n_frames):
            start = i * hop_length
            frame = np.fft.irfft(stft[:, i])
            output[start:start + n_fft] += frame * window

        return output

    @staticmethod
    def db_to_linear(db: float) -> float:
        """Convert decibels to linear value"""
        return 10 ** (db / 20)

    @staticmethod
    def linear_to_db(linear: float) -> float:
        """Convert linear value to decibels"""
        return 20 * np.log10(max(linear, 1e-10))

    @staticmethod
    def compute_rms(audio: np.ndarray) -> float:
        """Calculate RMS (Root Mean Square) level"""
        return np.sqrt(np.mean(audio ** 2))

    @staticmethod
    def compute_peak(audio: np.ndarray) -> float:
        """Calculate peak level"""
        return np.max(np.abs(audio))

    @staticmethod
    def compute_crest_factor(audio: np.ndarray) -> float:
        """Calculate crest factor (peak/RMS ratio)"""
        rms = np.sqrt(np.mean(audio ** 2))
        peak = np.max(np.abs(audio))
        if rms > 0:
            return 20 * np.log10(peak / rms)
        return float('inf')
```

---

## 2. AI Noise Removal

### 2.1 Major AI Noise Removal Models

```python
# 1. Meta Denoiser (Demucs-based)
import torchaudio

def demucs_denoise(audio_path: str) -> torch.Tensor:
    """Demucs-based noise removal"""
    from denoiser import pretrained
    from denoiser.dsp import convert_audio

    model = pretrained.dns64()
    model.eval()

    wav, sr = torchaudio.load(audio_path)
    wav = convert_audio(wav, sr, model.sample_rate, model.chin)

    with torch.no_grad():
        denoised = model(wav.unsqueeze(0))[0]

    return denoised

# 2. noisereduce library
import noisereduce as nr
import soundfile as sf

def noisereduce_simple(audio_path: str) -> np.ndarray:
    """Simple noise removal with noisereduce"""
    audio, sr = sf.read(audio_path)

    # Automatic noise profile estimation
    reduced = nr.reduce_noise(
        y=audio,
        sr=sr,
        stationary=False,     # Non-stationary noise support
        prop_decrease=0.8,    # Noise reduction amount (0-1)
        freq_mask_smooth_hz=500,
        time_mask_smooth_ms=50,
    )

    return reduced

# 3. RNNoise (Mozilla)
def rnnoise_denoise(audio_path: str):
    """
    RNNoise: Ultra-lightweight real-time noise removal
    - GRU-based recurrent model
    - Runs in real-time on CPU
    - 48kHz / 16bit mono input
    """
    import rnnoise
    denoiser = rnnoise.RNNoise()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    # Process in frame units (10ms = 480 samples @ 48kHz)
    frame_size = 480
    denoised_frames = []
    for i in range(0, len(audio_data), frame_size * 2):
        frame = audio_data[i:i + frame_size * 2]
        denoised = denoiser.process_frame(frame)
        denoised_frames.append(denoised)

    return b"".join(denoised_frames)
```

### 2.2 Noise Removal Pipeline

```
AI Noise Removal Processing Flow
==================================================

   Input Audio (with noise)
       |
       v
+--------------------+
| VAD (Voice Activity|  Voice/non-voice segment
|     Detection)     |  identification
+---------+----------+
          v
+--------------------+
| Noise Classification|  Automatic noise type
| - Stationary noise  |  detection
|   (AC, fan, etc.)   |  (AC, fan, etc.)
| - Non-stationary    |  (keyboard, door, etc.)
|   noise             |
| - Reverberation     |  (echo, reverb)
+---------+----------+
          v
+--------------------+
| Model Selection    |  Select optimal removal
|                    |  algorithm for noise type
+---------+----------+
          v
+--------------------+
| Noise Removal      |  DNN-based removal
|   Execution        |  processing
+---------+----------+
          v
+--------------------+
| Post-processing    |  Artifact suppression
| - Smoothing        |  Mitigate abrupt changes
| - Gating           |  Remove residual noise
+---------+----------+
          v
   Output Audio (clean)
==================================================
```

### 2.3 Advanced Noise Removal: Multi-Stage Pipeline

In practice, noise removal achieves the highest quality not with a single model but by combining multiple stages. Each stage handles a specific noise type and processes sequentially.

```python
import numpy as np
import soundfile as sf
from dataclasses import dataclass
from typing import Optional, List, Tuple

@dataclass
class NoiseAnalysisResult:
    """Noise analysis result"""
    has_hum: bool           # Power hum (50Hz/60Hz)
    has_broadband: bool     # Broadband noise (white noise type)
    has_impulse: bool       # Impulse noise (clicks, pops)
    has_reverb: bool        # Excessive reverberation
    has_sibilance: bool     # Excessive sibilance
    snr_estimate: float     # Estimated SNR (dB)
    dominant_noise_freq: Optional[float]  # Dominant noise frequency

class MultiStageDenoiser:
    """Multi-stage noise removal pipeline"""

    def __init__(self, sr: int = 16000):
        self.sr = sr

    def analyze_noise(self, audio: np.ndarray) -> NoiseAnalysisResult:
        """Analyze the type and characteristics of noise"""
        # Spectral analysis
        fft = np.fft.rfft(audio)
        freqs = np.fft.rfftfreq(len(audio), 1 / self.sr)
        magnitude = np.abs(fft)

        # Power hum detection (peaks near 50Hz/60Hz)
        hum_50 = self._check_peak(freqs, magnitude, 50, bandwidth=5)
        hum_60 = self._check_peak(freqs, magnitude, 60, bandwidth=5)
        has_hum = hum_50 or hum_60

        # Broadband noise detection (floor level in high-frequency band)
        high_freq_mask = freqs > 4000
        noise_floor = np.median(magnitude[high_freq_mask])
        signal_level = np.max(magnitude)
        has_broadband = noise_floor > signal_level * 0.01

        # SNR estimation
        snr_estimate = 20 * np.log10(signal_level / (noise_floor + 1e-10))

        # Impulse noise detection (sudden amplitude changes)
        diff = np.abs(np.diff(audio))
        impulse_threshold = np.mean(diff) + 5 * np.std(diff)
        has_impulse = np.any(diff > impulse_threshold)

        # Reverberation estimation (energy decay characteristics)
        has_reverb = self._estimate_reverb(audio)

        # Sibilance detection (energy concentration in 4-10kHz band)
        sibilance_mask = (freqs > 4000) & (freqs < 10000)
        mid_mask = (freqs > 500) & (freqs < 4000)
        sibilance_ratio = np.mean(magnitude[sibilance_mask]) / (
            np.mean(magnitude[mid_mask]) + 1e-10
        )
        has_sibilance = sibilance_ratio > 1.5

        return NoiseAnalysisResult(
            has_hum=has_hum,
            has_broadband=has_broadband,
            has_impulse=has_impulse,
            has_reverb=has_reverb,
            has_sibilance=has_sibilance,
            snr_estimate=snr_estimate,
            dominant_noise_freq=50.0 if hum_50 else (60.0 if hum_60 else None),
        )

    def process(self, audio: np.ndarray) -> np.ndarray:
        """Execute multi-stage noise removal"""
        analysis = self.analyze_noise(audio)
        processed = audio.copy()

        # Stage 1: Hum removal (only if detected)
        if analysis.has_hum:
            processed = self._remove_hum(
                processed, analysis.dominant_noise_freq
            )
            print(f"Stage 1: Hum removal ({analysis.dominant_noise_freq}Hz)")

        # Stage 2: Impulse noise removal
        if analysis.has_impulse:
            processed = self._remove_impulse(processed)
            print("Stage 2: Impulse noise removal")

        # Stage 3: Broadband noise removal (AI)
        if analysis.has_broadband:
            strength = self._determine_strength(analysis.snr_estimate)
            processed = self._ai_denoise(processed, strength)
            print(f"Stage 3: Broadband noise removal (strength: {strength})")

        # Stage 4: De-reverb (reverberation removal)
        if analysis.has_reverb:
            processed = self._dereverberate(processed)
            print("Stage 4: De-reverb")

        # Stage 5: De-esser (sibilance suppression)
        if analysis.has_sibilance:
            processed = self._deess(processed)
            print("Stage 5: De-esser")

        return processed

    def _check_peak(self, freqs, magnitude, target_freq, bandwidth=5):
        """Detect whether a peak exists at a specific frequency"""
        mask = (freqs > target_freq - bandwidth) & (
            freqs < target_freq + bandwidth
        )
        if not mask.any():
            return False
        peak_level = np.max(magnitude[mask])
        surrounding_mask = (
            (freqs > target_freq - 50) & (freqs < target_freq + 50)
        )
        surrounding_mean = np.mean(magnitude[surrounding_mask])
        return peak_level > surrounding_mean * 3

    def _estimate_reverb(self, audio: np.ndarray) -> bool:
        """Estimate the presence of reverberation"""
        # Compute autocorrelation to estimate reverb characteristics
        autocorr = np.correlate(audio[:4096], audio[:4096], mode='full')
        autocorr = autocorr[len(autocorr) // 2:]
        autocorr = autocorr / autocorr[0]
        # If reverb is present, autocorrelation decay is slow
        decay_point = np.argmax(autocorr < 0.1)
        decay_time_ms = decay_point / self.sr * 1000
        return decay_time_ms > 100  # Reverb longer than 100ms

    def _determine_strength(self, snr: float) -> str:
        """Determine noise removal strength based on SNR"""
        if snr > 30:
            return "light"
        elif snr > 15:
            return "medium"
        else:
            return "heavy"

    def _remove_hum(self, audio, freq):
        """Hum removal using notch filter"""
        from scipy.signal import iirnotch, filtfilt
        # Remove fundamental frequency and harmonics (2nd, 3rd)
        for harmonic in [1, 2, 3]:
            b, a = iirnotch(freq * harmonic, Q=30, fs=self.sr)
            audio = filtfilt(b, a, audio)
        return audio

    def _remove_impulse(self, audio):
        """Impulse noise removal using median filter"""
        from scipy.signal import medfilt
        diff = np.abs(np.diff(audio))
        threshold = np.mean(diff) + 4 * np.std(diff)
        impulse_mask = np.concatenate([[False], diff > threshold])
        filtered = medfilt(audio, kernel_size=5)
        result = audio.copy()
        result[impulse_mask] = filtered[impulse_mask]
        return result

    def _ai_denoise(self, audio, strength="medium"):
        """AI-based broadband noise removal"""
        import noisereduce as nr
        prop_map = {"light": 0.5, "medium": 0.7, "heavy": 0.85}
        return nr.reduce_noise(
            y=audio, sr=self.sr,
            stationary=False,
            prop_decrease=prop_map[strength],
            freq_mask_smooth_hz=500,
            time_mask_smooth_ms=50,
        )

    def _dereverberate(self, audio):
        """WPE (Weighted Prediction Error)-based reverberation removal"""
        # Simplified de-reverb (spectral subtraction adaptation)
        stft = np.fft.rfft(audio)
        magnitude = np.abs(stft)
        phase = np.angle(stft)
        # Estimate and remove reverb tail
        reverb_estimate = np.convolve(magnitude, np.ones(10) / 10, mode='same')
        clean_magnitude = np.maximum(magnitude - 0.3 * reverb_estimate, 0)
        clean_stft = clean_magnitude * np.exp(1j * phase)
        return np.fft.irfft(clean_stft, n=len(audio))

    def _deess(self, audio):
        """Frequency band-based de-esser"""
        from scipy.signal import butter, filtfilt
        # Detect and suppress energy in the 4-10kHz band
        b, a = butter(4, [4000, 10000], btype='band', fs=self.sr)
        sibilance_band = filtfilt(b, a, audio)
        envelope = np.abs(sibilance_band)
        # Smoothing
        from scipy.ndimage import uniform_filter1d
        envelope = uniform_filter1d(envelope, size=int(self.sr * 0.01))
        # Suppress sibilance above threshold
        threshold = np.percentile(envelope, 90)
        gain = np.where(envelope > threshold, threshold / (envelope + 1e-10), 1.0)
        gain = np.clip(gain, 0.3, 1.0)
        audio_deessed = audio - sibilance_band + sibilance_band * gain
        return audio_deessed
```

### 2.4 Objective Evaluation of Noise Removal Quality

```python
import numpy as np
from typing import Dict

class DenoiseQualityMetrics:
    """A collection of metrics for objectively evaluating noise removal quality"""

    @staticmethod
    def compute_snr(clean: np.ndarray, noisy: np.ndarray) -> float:
        """
        SNR (Signal-to-Noise Ratio)
        - Ratio of clean signal to noise
        - Higher means less noise
        """
        noise = noisy - clean
        signal_power = np.mean(clean ** 2)
        noise_power = np.mean(noise ** 2)
        return 10 * np.log10(signal_power / (noise_power + 1e-10))

    @staticmethod
    def compute_pesq(clean: np.ndarray, denoised: np.ndarray,
                     sr: int = 16000) -> float:
        """
        PESQ (Perceptual Evaluation of Speech Quality)
        - ITU-T P.862 standard
        - Perceptual evaluation of speech quality (-0.5 to 4.5)
        - Higher is better
        """
        from pesq import pesq
        return pesq(sr, clean, denoised, 'wb')  # wb=wideband

    @staticmethod
    def compute_stoi(clean: np.ndarray, denoised: np.ndarray,
                     sr: int = 16000) -> float:
        """
        STOI (Short-Time Objective Intelligibility)
        - Evaluates speech intelligibility (0 to 1)
        - Higher is more intelligible
        """
        from pystoi import stoi
        return stoi(clean, denoised, sr, extended=True)

    @staticmethod
    def compute_sdr(reference: np.ndarray, estimated: np.ndarray) -> float:
        """
        SDR (Signal-to-Distortion Ratio)
        - Standard evaluation metric for source separation
        - Higher means less distortion
        """
        noise = estimated - reference
        sdr = 10 * np.log10(
            np.sum(reference ** 2) / (np.sum(noise ** 2) + 1e-10)
        )
        return sdr

    @staticmethod
    def compute_sisdr(reference: np.ndarray, estimated: np.ndarray) -> float:
        """
        SI-SDR (Scale-Invariant SDR)
        - Scale-invariant SDR (unaffected by volume differences)
        """
        alpha = np.dot(estimated, reference) / (np.dot(reference, reference) + 1e-10)
        target = alpha * reference
        noise = estimated - target
        return 10 * np.log10(
            np.sum(target ** 2) / (np.sum(noise ** 2) + 1e-10)
        )

    def full_evaluation(self, clean: np.ndarray, noisy: np.ndarray,
                        denoised: np.ndarray, sr: int = 16000) -> Dict:
        """Comprehensive evaluation report"""
        return {
            "Input SNR (dB)": round(self.compute_snr(clean, noisy), 2),
            "Output SNR (dB)": round(self.compute_snr(clean, denoised), 2),
            "SNR Improvement (dB)": round(
                self.compute_snr(clean, denoised) - self.compute_snr(clean, noisy), 2
            ),
            "PESQ": round(self.compute_pesq(clean, denoised, sr), 3),
            "STOI": round(self.compute_stoi(clean, denoised, sr), 4),
            "SDR (dB)": round(self.compute_sdr(clean, denoised), 2),
            "SI-SDR (dB)": round(self.compute_sisdr(clean, denoised), 2),
        }

# Usage example
"""
metrics = DenoiseQualityMetrics()
report = metrics.full_evaluation(clean_audio, noisy_audio, denoised_audio, sr=16000)
for metric, value in report.items():
    print(f"{metric}: {value}")

# Example output:
# Input SNR (dB): 5.23
# Output SNR (dB): 22.17
# SNR Improvement (dB): 16.94
# PESQ: 3.456
# STOI: 0.9234
# SDR (dB): 18.92
# SI-SDR (dB): 17.85
"""
```

### 2.5 Real-Time Noise Removal Implementation

```python
import numpy as np
import threading
import queue
from typing import Callable

class RealtimeDenoiser:
    """Real-time noise removal engine"""

    def __init__(self, model_type: str = "rnnoise", sr: int = 48000,
                 frame_ms: int = 10):
        self.sr = sr
        self.frame_ms = frame_ms
        self.frame_size = int(sr * frame_ms / 1000)
        self.model_type = model_type
        self.input_queue = queue.Queue()
        self.output_queue = queue.Queue()
        self.running = False

        # For latency measurement
        self.total_frames = 0
        self.processing_time_sum = 0

    def start(self):
        """Start the processing thread"""
        self.running = True
        self.thread = threading.Thread(target=self._process_loop)
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        """Stop the processing thread"""
        self.running = False
        self.thread.join()

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """Process a single frame (synchronous version)"""
        import time
        start = time.perf_counter()

        if self.model_type == "rnnoise":
            denoised = self._rnnoise_frame(frame)
        elif self.model_type == "demucs":
            denoised = self._demucs_frame(frame)
        else:
            denoised = frame

        elapsed = time.perf_counter() - start
        self.total_frames += 1
        self.processing_time_sum += elapsed

        return denoised

    def _process_loop(self):
        """Background processing loop"""
        while self.running:
            try:
                frame = self.input_queue.get(timeout=0.1)
                denoised = self.process_frame(frame)
                self.output_queue.put(denoised)
            except queue.Empty:
                continue

    def _rnnoise_frame(self, frame: np.ndarray) -> np.ndarray:
        """Frame processing with RNNoise"""
        # RNNoise processes in 480-sample units (10ms @ 48kHz)
        # In practice, uses rnnoise C library bindings
        return frame  # Placeholder

    def _demucs_frame(self, frame: np.ndarray) -> np.ndarray:
        """Frame processing with Demucs Denoiser"""
        # Real-time inference using GPU
        return frame  # Placeholder

    def get_latency_stats(self) -> dict:
        """Get latency statistics"""
        if self.total_frames == 0:
            return {"avg_ms": 0, "frame_ms": self.frame_ms}
        avg_ms = (self.processing_time_sum / self.total_frames) * 1000
        return {
            "avg_processing_ms": round(avg_ms, 2),
            "frame_duration_ms": self.frame_ms,
            "realtime_ratio": round(avg_ms / self.frame_ms, 3),
            "total_frames": self.total_frames,
            "is_realtime": avg_ms < self.frame_ms,
        }


class StreamingDenoisePipeline:
    """Streaming noise removal using PyAudio"""

    def __init__(self, model_type="rnnoise"):
        import pyaudio
        self.pa = pyaudio.PyAudio()
        self.denoiser = RealtimeDenoiser(model_type=model_type)

    def run(self, input_device=None, output_device=None):
        """Run real-time noise removal"""
        import pyaudio

        sr = self.denoiser.sr
        frame_size = self.denoiser.frame_size

        def callback(in_data, frame_count, time_info, status):
            audio = np.frombuffer(in_data, dtype=np.int16).astype(np.float32)
            audio = audio / 32768.0  # Normalize

            denoised = self.denoiser.process_frame(audio)

            out_data = (denoised * 32768.0).astype(np.int16).tobytes()
            return (out_data, pyaudio.paContinue)

        stream = self.pa.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=sr,
            input=True,
            output=True,
            input_device_index=input_device,
            output_device_index=output_device,
            frames_per_buffer=frame_size,
            stream_callback=callback,
        )

        stream.start_stream()
        print("Real-time noise removal started")
        print("Press Ctrl+C to stop")

        try:
            while stream.is_active():
                import time
                time.sleep(0.1)
        except KeyboardInterrupt:
            pass
        finally:
            stream.stop_stream()
            stream.close()
            stats = self.denoiser.get_latency_stats()
            print(f"Latency statistics: {stats}")
```

---

## 3. AI EQ and Automatic Mastering

### 3.1 AI EQ Implementation Concept

```python
import numpy as np

class AIEqualizer:
    """AI-based automatic EQ"""

    # Standard EQ bands
    BANDS = {
        "Sub Bass":    (20, 60),
        "Bass":        (60, 250),
        "Low Mid":     (250, 500),
        "Mid":         (500, 2000),
        "Upper Mid":   (2000, 4000),
        "Presence":    (4000, 6000),
        "Brilliance":  (6000, 20000),
    }

    # Target profiles (by genre)
    TARGET_PROFILES = {
        "podcast": {
            "Sub Bass": -6, "Bass": -2, "Low Mid": 0,
            "Mid": +2, "Upper Mid": +3, "Presence": +1, "Brilliance": -2,
        },
        "pop_vocal": {
            "Sub Bass": -3, "Bass": 0, "Low Mid": -1,
            "Mid": +1, "Upper Mid": +2, "Presence": +3, "Brilliance": +1,
        },
        "broadcast": {
            "Sub Bass": -12, "Bass": -3, "Low Mid": 0,
            "Mid": +2, "Upper Mid": +1, "Presence": +2, "Brilliance": 0,
        },
    }

    def analyze_spectrum(self, audio: np.ndarray, sr: int) -> dict:
        """Spectrum analysis"""
        fft = np.fft.rfft(audio)
        freqs = np.fft.rfftfreq(len(audio), 1/sr)
        magnitude = np.abs(fft)

        band_levels = {}
        for name, (low, high) in self.BANDS.items():
            mask = (freqs >= low) & (freqs < high)
            if mask.any():
                level = 20 * np.log10(np.mean(magnitude[mask]) + 1e-10)
                band_levels[name] = level
        return band_levels

    def compute_eq_curve(self, audio: np.ndarray, sr: int,
                         target: str = "podcast") -> dict:
        """AI EQ: Compute EQ curve from the difference between current spectrum and target"""
        current = self.analyze_spectrum(audio, sr)
        target_profile = self.TARGET_PROFILES[target]

        eq_adjustments = {}
        for band in self.BANDS:
            diff = target_profile[band] - (current[band] - np.mean(list(current.values())))
            # Limit excessive correction (max +-12dB)
            eq_adjustments[band] = np.clip(diff, -12, 12)

        return eq_adjustments
```

### 3.2 Parametric EQ Implementation

```python
import numpy as np
from scipy.signal import sosfilt, sosfiltfilt
from scipy.signal import iirpeak, iirnotch

class ParametricEQ:
    """Parametric EQ implementation"""

    def __init__(self, sr: int = 44100):
        self.sr = sr
        self.bands = []

    def add_band(self, freq: float, gain_db: float, q: float = 1.0,
                 band_type: str = "peak"):
        """
        Add an EQ band

        Parameters:
            freq: Center frequency (Hz)
            gain_db: Gain (dB)
            q: Q factor (inverse of bandwidth; higher means narrower)
            band_type: "peak", "low_shelf", "high_shelf", "notch"
        """
        self.bands.append({
            "freq": freq,
            "gain_db": gain_db,
            "q": q,
            "type": band_type,
        })

    def _design_peak_filter(self, freq, gain_db, q):
        """Design a peaking EQ filter (RBJ Cookbook)"""
        A = 10 ** (gain_db / 40)
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * q)

        b0 = 1 + alpha * A
        b1 = -2 * np.cos(w0)
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * np.cos(w0)
        a2 = 1 - alpha / A

        return np.array([b0/a0, b1/a0, b2/a0, 1.0, a1/a0, a2/a0])

    def _design_low_shelf(self, freq, gain_db, q=0.707):
        """Design a low shelf filter"""
        A = 10 ** (gain_db / 40)
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * q)

        b0 = A * ((A + 1) - (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha)
        b1 = 2 * A * ((A - 1) - (A + 1) * np.cos(w0))
        b2 = A * ((A + 1) - (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha)
        a0 = (A + 1) + (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha
        a1 = -2 * ((A - 1) + (A + 1) * np.cos(w0))
        a2 = (A + 1) + (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha

        return np.array([b0/a0, b1/a0, b2/a0, 1.0, a1/a0, a2/a0])

    def _design_high_shelf(self, freq, gain_db, q=0.707):
        """Design a high shelf filter"""
        A = 10 ** (gain_db / 40)
        w0 = 2 * np.pi * freq / self.sr
        alpha = np.sin(w0) / (2 * q)

        b0 = A * ((A + 1) + (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * np.cos(w0))
        b2 = A * ((A + 1) + (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha)
        a0 = (A + 1) - (A - 1) * np.cos(w0) + 2 * np.sqrt(A) * alpha
        a1 = 2 * ((A - 1) - (A + 1) * np.cos(w0))
        a2 = (A + 1) - (A - 1) * np.cos(w0) - 2 * np.sqrt(A) * alpha

        return np.array([b0/a0, b1/a0, b2/a0, 1.0, a1/a0, a2/a0])

    def apply(self, audio: np.ndarray) -> np.ndarray:
        """Apply EQ across all bands"""
        result = audio.copy()
        for band in self.bands:
            if band["type"] == "peak":
                sos = self._design_peak_filter(
                    band["freq"], band["gain_db"], band["q"]
                )
            elif band["type"] == "low_shelf":
                sos = self._design_low_shelf(band["freq"], band["gain_db"])
            elif band["type"] == "high_shelf":
                sos = self._design_high_shelf(band["freq"], band["gain_db"])
            else:
                continue
            # Convert to SOS format and apply
            sos_2d = sos.reshape(1, 6)
            result = sosfiltfilt(sos_2d, result)
        return result


# Usage example: AI EQ preset for podcasts
def apply_podcast_eq(audio: np.ndarray, sr: int = 44100) -> np.ndarray:
    """Automatic EQ for podcasts"""
    eq = ParametricEQ(sr=sr)

    # Low cut (remove mic vibration and AC noise)
    eq.add_band(80, -18, q=0.707, band_type="high_shelf")  # Actually HPF

    # Proximity effect correction (suppress vocal low-end boost)
    eq.add_band(200, -3, q=1.0, band_type="peak")

    # Clarity enhancement (presence band)
    eq.add_band(3000, +3, q=1.5, band_type="peak")

    # Breath and sibilance suppression
    eq.add_band(6000, -2, q=2.0, band_type="peak")

    # Air (high-frequency airiness)
    eq.add_band(12000, +1, q=0.707, band_type="high_shelf")

    return eq.apply(audio)
```

### 3.3 Automatic Mastering

```python
class AutoMastering:
    """AI automatic mastering processing"""

    def __init__(self, target_lufs=-14.0, target_true_peak=-1.0):
        self.target_lufs = target_lufs        # Streaming standard: -14 LUFS
        self.target_true_peak = target_true_peak

    def master(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Automatic mastering chain"""
        # Step 1: DC offset removal
        audio = audio - np.mean(audio)

        # Step 2: AI EQ (spectral balance correction)
        audio = self.apply_ai_eq(audio, sr)

        # Step 3: Multiband compression
        audio = self.multiband_compress(audio, sr)

        # Step 4: Stereo image adjustment
        if audio.ndim == 2 and audio.shape[0] == 2:
            audio = self.stereo_enhance(audio)

        # Step 5: Loudness normalization (LUFS-compliant)
        audio = self.loudness_normalize(audio, sr)

        # Step 6: True Peak limiting
        audio = self.true_peak_limit(audio, sr)

        return audio

    def loudness_normalize(self, audio, sr):
        """ITU-R BS.1770 compliant loudness normalization"""
        current_lufs = self.measure_lufs(audio, sr)
        gain_db = self.target_lufs - current_lufs
        gain_linear = 10 ** (gain_db / 20)
        return audio * gain_linear

    def multiband_compress(self, audio, sr):
        """Multiband compression"""
        bands = [
            (20, 200, {"threshold": -20, "ratio": 2.0}),   # Low
            (200, 2000, {"threshold": -18, "ratio": 2.5}),  # Mid
            (2000, 20000, {"threshold": -22, "ratio": 3.0}), # High
        ]
        result = np.zeros_like(audio)
        for low, high, params in bands:
            band = bandpass_filter(audio, low, high, sr)
            compressed = compress(band, **params)
            result += compressed
        return result

    def measure_lufs(self, audio, sr):
        """LUFS measurement (simplified version)"""
        # Apply K-weighting filter
        # Gate processing
        # RMS calculation
        rms = np.sqrt(np.mean(audio ** 2))
        return 20 * np.log10(rms + 1e-10)
```

### 3.4 High-Precision LUFS-Compliant Loudness Normalization

```python
import numpy as np
from scipy.signal import sosfilt

class LUFSMeter:
    """
    ITU-R BS.1770-5 compliant LUFS meter

    LUFS (Loudness Units Full Scale) is a loudness measurement unit that
    reflects human auditory characteristics, used as the reference value
    for each streaming platform.
    """

    def __init__(self, sr: int = 48000):
        self.sr = sr
        self.block_size = int(0.4 * sr)  # 400ms gating block
        self.overlap = int(0.1 * sr)     # 75% overlap (100ms step)

    def _k_weight_filter(self, audio: np.ndarray) -> np.ndarray:
        """
        K-weighting filter
        - Stage 1: Shelving filter (high-frequency boost)
        - Stage 2: High-pass filter (low-frequency cut)
        Reflects human auditory sensitivity
        """
        # Stage 1: High shelf filter (+4dB @ high frequencies)
        f0 = 1681.974450955533
        G = 3.999843853973347
        Q = 0.7071752369554196

        K = np.tan(np.pi * f0 / self.sr)
        Vh = 10 ** (G / 20)
        Vb = Vh ** 0.4996667741545416

        a0 = 1.0 + K / Q + K * K
        b0 = (Vh + Vb * K / Q + K * K) / a0
        b1 = 2.0 * (K * K - Vh) / a0
        b2 = (Vh - Vb * K / Q + K * K) / a0
        a1 = 2.0 * (K * K - 1.0) / a0
        a2 = (1.0 - K / Q + K * K) / a0


        # Stage 2: High-pass filter
        f0 = 38.13547087602444
        Q = 0.5003270373238773

        K = np.tan(np.pi * f0 / self.sr)
        a0 = 1.0 + K / Q + K * K
        b0 = 1.0 / a0
        b1 = -2.0 / a0
        b2 = 1.0 / a0
        a1 = 2.0 * (K * K - 1.0) / a0
        a2 = (1.0 - K / Q + K * K) / a0


        filtered = sosfilt(sos1, audio)
        filtered = sosfilt(sos2, filtered)
        return filtered

    def measure_integrated(self, audio: np.ndarray) -> float:
        """
        Integrated Loudness measurement

        BS.1770 algorithm:
        1. Apply K-weighting filter
        2. Calculate loudness per 400ms block
        3. Absolute gate (only blocks above -70 LUFS)
        4. Relative gate (only blocks above mean -10 LUFS)
        5. Mean of gated blocks = integrated loudness
        """
        if audio.ndim == 1:
            audio = audio.reshape(1, -1)  # (channels, samples)

        n_channels = audio.shape[0]

        # Channel weights (surround-compatible)
        channel_weights = {
            1: [1.0],
            2: [1.0, 1.0],
            6: [1.0, 1.0, 1.0, 0.0, 1.41, 1.41],  # 5.1ch
        }
        weights = channel_weights.get(n_channels, [1.0] * n_channels)

        # Apply K-weighting filter
        filtered = np.array([self._k_weight_filter(ch) for ch in audio])

        # Calculate loudness per block
        step = self.block_size - self.overlap
        n_blocks = max(1, (filtered.shape[1] - self.block_size) // step + 1)

        block_loudness = []
        for i in range(n_blocks):
            start = i * step
            end = start + self.block_size
            if end > filtered.shape[1]:
                break

            # Mean power per channel
            power_sum = 0
            for ch in range(n_channels):
                block = filtered[ch, start:end]
                power_sum += weights[ch] * np.mean(block ** 2)

            loudness = -0.691 + 10 * np.log10(power_sum + 1e-10)
            block_loudness.append(loudness)

        block_loudness = np.array(block_loudness)

        # Absolute gate (-70 LUFS)
        abs_gate_mask = block_loudness > -70
        if not abs_gate_mask.any():
            return -70.0

        # Relative gate
        abs_gated_mean = np.mean(
            10 ** (block_loudness[abs_gate_mask] / 10)
        )
        relative_threshold = 10 * np.log10(abs_gated_mean + 1e-10) - 10

        rel_gate_mask = block_loudness > relative_threshold
        if not rel_gate_mask.any():
            return -70.0

        # Final calculation
        final_mean = np.mean(
            10 ** (block_loudness[rel_gate_mask] / 10)
        )
        integrated_loudness = -0.691 + 10 * np.log10(final_mean + 1e-10)

        return round(integrated_loudness, 1)

    def measure_momentary(self, audio: np.ndarray) -> np.ndarray:
        """
        Momentary loudness (400ms window)
        For real-time meter display
        """
        if audio.ndim == 1:
            audio = audio.reshape(1, -1)

        filtered = np.array([self._k_weight_filter(ch) for ch in audio])
        step = int(0.1 * self.sr)  # 100ms step
        n_steps = (filtered.shape[1] - self.block_size) // step + 1

        momentary = []
        for i in range(n_steps):
            start = i * step
            end = start + self.block_size
            power = np.mean(np.sum(filtered[:, start:end] ** 2, axis=0))
            lufs = -0.691 + 10 * np.log10(power + 1e-10)
            momentary.append(lufs)

        return np.array(momentary)


# Platform-specific LUFS requirements
PLATFORM_LOUDNESS_SPECS = {
    "Spotify": {
        "target_lufs": -14.0,
        "true_peak_limit": -1.0,
        "normalization": "Per-track or per-album",
        "notes": "Automatically reduced when loudness is exceeded",
    },
    "Apple Music": {
        "target_lufs": -16.0,
        "true_peak_limit": -1.0,
        "normalization": "Only when Sound Check is enabled",
        "notes": "Not normalized when Sound Check is OFF",
    },
    "YouTube": {
        "target_lufs": -14.0,
        "true_peak_limit": -1.0,
        "normalization": "Always applied",
        "notes": "Above -14 LUFS is reduced, but below is not boosted",
    },
    "Amazon Music": {
        "target_lufs": -14.0,
        "true_peak_limit": -2.0,
        "normalization": "Automatic",
        "notes": "Slightly stricter True Peak limit",
    },
    "Podcast (General)": {
        "target_lufs": -16.0,
        "true_peak_limit": -1.0,
        "normalization": "Recommended (not enforced)",
        "notes": "Mono -19 LUFS may also be recommended",
    },
    "Broadcast (EBU R128)": {
        "target_lufs": -23.0,
        "true_peak_limit": -1.0,
        "normalization": "Strictly compliant",
        "notes": "European broadcasting standard. Tolerance +/-1 LU",
    },
    "Broadcast (ATSC A/85)": {
        "target_lufs": -24.0,
        "true_peak_limit": -2.0,
        "normalization": "Strictly compliant",
        "notes": "US broadcasting standard",
    },
}
```

### 3.5 Detailed Compressor Implementation

```python
import numpy as np

class DynamicCompressor:
    """
    Dynamic Range Compressor Implementation

    A compressor is an effect that compresses the dynamic range
    (difference between maximum and minimum volume) of an audio signal,
    leveling out volume differences.
    """

    def __init__(self, sr: int = 44100, threshold_db: float = -20,
                 ratio: float = 4.0, attack_ms: float = 5.0,
                 release_ms: float = 50.0, knee_db: float = 6.0,
                 makeup_gain_db: float = 0.0):
        """
        Parameters:
            threshold_db: Compression onset level (dB)
            ratio: Compression ratio (4:1 = 1dB output for every 4dB above threshold)
            attack_ms: Attack time (time until compression starts)
            release_ms: Release time (time until compression releases)
            knee_db: Knee width (soft knee range)
            makeup_gain_db: Makeup gain (volume compensation after compression)
        """
        self.sr = sr
        self.threshold_db = threshold_db
        self.ratio = ratio
        self.attack_coeff = np.exp(-1 / (attack_ms * sr / 1000))
        self.release_coeff = np.exp(-1 / (release_ms * sr / 1000))
        self.knee_db = knee_db
        self.makeup_gain = 10 ** (makeup_gain_db / 20)

    def _compute_gain(self, level_db: float) -> float:
        """Calculate gain reduction (with soft knee support)"""
        if self.knee_db <= 0:
            # Hard knee
            if level_db <= self.threshold_db:
                return 0.0
            else:
                return -(level_db - self.threshold_db) * (1 - 1 / self.ratio)
        else:
            # Soft knee
            half_knee = self.knee_db / 2
            if level_db < self.threshold_db - half_knee:
                return 0.0
            elif level_db > self.threshold_db + half_knee:
                return -(level_db - self.threshold_db) * (1 - 1 / self.ratio)
            else:
                # Smooth transition within the knee
                x = level_db - self.threshold_db + half_knee
                return -(x ** 2) / (2 * self.knee_db) * (1 - 1 / self.ratio)

    def process(self, audio: np.ndarray) -> np.ndarray:
        """Compression processing"""
        output = np.zeros_like(audio)
        envelope = 0.0

        for i in range(len(audio)):
            # Envelope following
            level = np.abs(audio[i])
            if level > envelope:
                envelope = self.attack_coeff * envelope + (1 - self.attack_coeff) * level
            else:
                envelope = self.release_coeff * envelope + (1 - self.release_coeff) * level

            # Convert to dB
            level_db = 20 * np.log10(envelope + 1e-10)

            # Calculate gain reduction
            gain_reduction_db = self._compute_gain(level_db)
            gain = 10 ** (gain_reduction_db / 20)

            # Apply gain + makeup gain
            output[i] = audio[i] * gain * self.makeup_gain

        return output

    def auto_makeup_gain(self, audio: np.ndarray) -> float:
        """Automatic makeup gain calculation"""
        # Automatically calculate from RMS level difference before and after compression
        original_rms = np.sqrt(np.mean(audio ** 2))
        compressed = self.process(audio)
        compressed_rms = np.sqrt(np.mean(compressed ** 2))
        if compressed_rms > 0:
            gain_db = 20 * np.log10(original_rms / compressed_rms)
            return gain_db
        return 0.0


class MultibandCompressor:
    """Multiband Compressor"""

    def __init__(self, sr: int = 44100):
        self.sr = sr
        self.bands = [
            {"name": "Low", "range": (20, 250),
             "threshold": -20, "ratio": 2.0, "attack": 10, "release": 100},
            {"name": "Low-Mid", "range": (250, 1000),
             "threshold": -18, "ratio": 2.5, "attack": 8, "release": 80},
            {"name": "Mid", "range": (1000, 4000),
             "threshold": -22, "ratio": 3.0, "attack": 5, "release": 50},
            {"name": "High", "range": (4000, 20000),
             "threshold": -24, "ratio": 3.5, "attack": 3, "release": 40},
        ]

    def _bandpass(self, audio, low, high):
        """Bandpass filter"""
        from scipy.signal import butter, sosfiltfilt
        nyq = self.sr / 2
        low_norm = max(low / nyq, 0.001)
        high_norm = min(high / nyq, 0.999)
        sos = butter(4, [low_norm, high_norm], btype='band', output='sos')
        return sosfiltfilt(sos, audio)

    def process(self, audio: np.ndarray) -> np.ndarray:
        """Multiband compression"""
        result = np.zeros_like(audio)

        for band in self.bands:
            low, high = band["range"]
            band_audio = self._bandpass(audio, low, high)

            comp = DynamicCompressor(
                sr=self.sr,
                threshold_db=band["threshold"],
                ratio=band["ratio"],
                attack_ms=band["attack"],
                release_ms=band["release"],
                knee_db=6.0,
            )

            compressed = comp.process(band_audio)
            result += compressed

        return result
```

---

## 4. Comparison Tables

### 4.1 Noise Removal Tool Comparison

| Item | RNNoise | noisereduce | Demucs Denoiser | Adobe Podcast | Krisp |
|------|---------|-------------|-----------------|--------------|-------|
| Type | OSS | OSS | OSS | SaaS | SaaS |
| Real-time | Supported | Not supported | Not supported | Not supported | Supported |
| Quality | Good | Good | Very good | Best | Very good |
| Compute cost | Extremely low | Low | High (GPU) | Cloud | Low |
| Non-stationary noise | Supported | Supported | Supported | Supported | Supported |
| Audio degradation | Minimal | Moderate | Minimal | Least | Minimal |
| Supported input | 48kHz mono | Flexible | Flexible | Flexible | Flexible |

### 4.2 Mastering Service Comparison

| Item | LANDR | eMastered | iZotope Ozone | CloudBounce |
|------|-------|-----------|--------------|-------------|
| AI automation | Fully automatic | Fully automatic | Semi-automatic | Fully automatic |
| Customization | 3 presets | Sliders | Full control | Limited |
| Quality | High | High | Best | Medium to high |
| Price | $4.99/track~ | $3.99/track~ | $249 one-time | $2.99/track~ |
| LUFS-compliant | Supported | Supported | Supported | Supported |
| Professional use | Somewhat unsuitable | Somewhat unsuitable | Industry standard | Somewhat unsuitable |

### 4.3 AI Effects Plugin Comparison

| Item | iZotope RX | Waves Clarity | Sonnox | Accusonus ERA |
|------|-----------|--------------|--------|-------------|
| Noise removal | Best quality | Very good | Good | Good |
| Auto EQ | Neutron integration | Not supported | Not supported | Not supported |
| De-reverb | Best quality | Good | Good | Moderate |
| De-esser | High quality | Good | Best quality | Good |
| Batch processing | Supported | Not supported | Not supported | Supported |
| Real-time | Partially supported | Supported | Supported | Supported |
| DAW integration | VST/AU/AAX | VST/AU/AAX | VST/AU/AAX | VST/AU/AAX |
| Price range | $399-1199 | $149-249 | $299+ | $99-199 |
| AI depth | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ |

---

## 5. Anti-patterns

### 5.1 Anti-pattern: Ignoring Effect Order

```python
# BAD: Inappropriate effect order
def bad_effects_chain(audio, sr):
    audio = apply_reverb(audio)      # Hard to denoise after reverb
    audio = apply_compression(audio) # Unpredictable EQ after compression
    audio = denoise(audio)           # Reverb tails detected as noise
    audio = equalize(audio)          # EQ on already distorted spectrum
    return audio

# GOOD: Correct effect order
def good_effects_chain(audio, sr):
    # 1. Denoise first (ensure clean signal)
    audio = denoise(audio)
    # 2. EQ (frequency balance adjustment)
    audio = equalize(audio, target="podcast")
    # 3. Compression (dynamic range control)
    audio = compress(audio, threshold=-20, ratio=3)
    # 4. Spatial effects like reverb (apply to clean signal)
    audio = apply_reverb(audio, room_size=0.3)
    # 5. Limiter (final peak control)
    audio = limit(audio, ceiling=-1.0)
    return audio
```

### 5.2 Anti-pattern: Excessive Noise Removal

```python
# BAD: Noise removal set to maximum
def bad_denoise(audio, sr):
    return nr.reduce_noise(
        y=audio, sr=sr,
        prop_decrease=1.0,  # 100% removal -> audio also degrades
        n_fft=4096,
    )

# GOOD: Appropriate settings with gradual processing
def good_denoise(audio, sr, strength="medium"):
    """Gradual noise removal"""
    settings = {
        "light":  {"prop_decrease": 0.5, "note": "For light noise"},
        "medium": {"prop_decrease": 0.7, "note": "For standard noise"},
        "heavy":  {"prop_decrease": 0.85, "note": "For heavy noise (watch for audio degradation)"},
    }
    s = settings[strength]

    result = nr.reduce_noise(
        y=audio, sr=sr,
        stationary=False,
        prop_decrease=s["prop_decrease"],
        freq_mask_smooth_hz=500,    # Smoothing to reduce artifacts
        time_mask_smooth_ms=50,
    )

    # Audio quality check
    snr = compute_snr(audio, result)
    if snr < 5:
        print("Warning: Audio quality is significantly degraded. Please reduce the strength.")

    return result
```

### 5.3 Anti-pattern: Loudness Adjustment Without LUFS Compliance

```python
# BAD: Adjusting loudness with only peak normalization
def bad_loudness(audio):
    peak = np.max(np.abs(audio))
    return audio / peak * 0.9  # Peak -0.9dBFS
    # Problem: LUFS depends on the audio content (dynamics)
    #          Same peak yields vastly different LUFS for podcasts vs music

# GOOD: LUFS measurement -> normalization -> True Peak limiting
def good_loudness(audio, sr, target_lufs=-14.0, true_peak=-1.0):
    """LUFS-compliant loudness normalization"""
    meter = LUFSMeter(sr=sr)

    # Measure current LUFS
    current_lufs = meter.measure_integrated(audio)
    print(f"Current LUFS: {current_lufs}")

    # Calculate required gain from LUFS difference
    gain_db = target_lufs - current_lufs
    gain_linear = 10 ** (gain_db / 20)
    audio = audio * gain_linear

    # True Peak limiting
    true_peak_linear = 10 ** (true_peak / 20)
    oversampled = np.interp(
        np.linspace(0, len(audio) - 1, len(audio) * 4),
        np.arange(len(audio)),
        audio,
    )
    peak = np.max(np.abs(oversampled))
    if peak > true_peak_linear:
        audio = audio * (true_peak_linear / peak)

    final_lufs = meter.measure_integrated(audio)
    print(f"LUFS after normalization: {final_lufs}")

    return audio
```

### 5.4 Anti-pattern: Sample Rate Mismatch

```python
# BAD: Applying effects without considering sample rate
def bad_sample_rate(audio_path):
    audio, sr = sf.read(audio_path)  # sr might be 48000
    # RNNoise assumes 48kHz
    denoised = rnnoise(audio)
    # noisereduce uses sr internally
    eq_applied = apply_eq(denoised)  # EQ frequencies will be off
    return eq_applied

# GOOD: Unified sample rate management
def good_sample_rate(audio_path, target_sr=44100):
    """Unify sample rate before applying effects"""
    import librosa

    audio, sr = sf.read(audio_path)
    print(f"Original sample rate: {sr}Hz")

    # Unify to the effect chain's required sample rate
    if sr != target_sr:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
        print(f"Resampling: {sr}Hz -> {target_sr}Hz")

    # Use the same sr for all effects
    audio = denoise(audio, sr=target_sr)
    audio = equalize(audio, sr=target_sr)
    audio = compress(audio, sr=target_sr)
    audio = normalize_lufs(audio, sr=target_sr)

    return audio, target_sr
```

---

## 6. Practical Use Cases

### 6.1 Complete Podcast Processing Pipeline

```python
import numpy as np
import soundfile as sf
from pathlib import Path

class PodcastProcessor:
    """Complete processing pipeline for podcast audio"""

    def __init__(self, sr: int = 44100):
        self.sr = sr

    def process_episode(self, input_path: str, output_path: str,
                        speakers: int = 2):
        """Complete processing of a podcast episode"""
        audio, sr = sf.read(input_path)

        # Unify sample rate
        if sr != self.sr:
            import librosa
            audio = librosa.resample(audio, orig_sr=sr, target_sr=self.sr)

        # Step 1: Noise analysis and removal
        print("Step 1: Noise removal")
        audio = self._denoise(audio)

        # Step 2: High-pass filter (cut below 80Hz)
        print("Step 2: High-pass filter")
        audio = self._highpass(audio, cutoff=80)

        # Step 3: EQ
        print("Step 3: EQ correction")
        audio = self._podcast_eq(audio)

        # Step 4: Compression
        print("Step 4: Compression")
        comp = DynamicCompressor(
            sr=self.sr, threshold_db=-18, ratio=3.0,
            attack_ms=5, release_ms=50, knee_db=6.0,
        )
        audio = comp.process(audio)

        # Step 5: Loudness normalization (-16 LUFS)
        print("Step 5: Loudness normalization")
        meter = LUFSMeter(sr=self.sr)
        current_lufs = meter.measure_integrated(audio)
        gain_db = -16.0 - current_lufs
        audio = audio * (10 ** (gain_db / 20))

        # Step 6: True Peak limiting
        print("Step 6: Limiting")
        audio = self._true_peak_limit(audio, ceiling_db=-1.0)

        # Save
        sf.write(output_path, audio, self.sr, subtype='PCM_24')
        print(f"Complete: {output_path}")

        # Quality report
        final_lufs = meter.measure_integrated(audio)
        peak_db = 20 * np.log10(np.max(np.abs(audio)) + 1e-10)
        print(f"Final LUFS: {final_lufs:.1f}")
        print(f"Peak level: {peak_db:.1f} dBFS")

    def _denoise(self, audio):
        """Noise removal for podcasts"""
        import noisereduce as nr
        return nr.reduce_noise(
            y=audio, sr=self.sr,
            stationary=False,
            prop_decrease=0.65,
            freq_mask_smooth_hz=500,
            time_mask_smooth_ms=50,
        )

    def _highpass(self, audio, cutoff=80):
        """High-pass filter"""
        from scipy.signal import butter, sosfiltfilt
        nyq = self.sr / 2
        sos = butter(4, cutoff / nyq, btype='high', output='sos')
        return sosfiltfilt(sos, audio)

    def _podcast_eq(self, audio):
        """Podcast EQ"""
        eq = ParametricEQ(sr=self.sr)
        eq.add_band(200, -2, q=1.0, band_type="peak")    # Proximity effect correction
        eq.add_band(3000, +3, q=1.5, band_type="peak")   # Presence boost
        eq.add_band(6000, -1.5, q=2.0, band_type="peak") # Sibilance suppression
        return eq.apply(audio)

    def _true_peak_limit(self, audio, ceiling_db=-1.0):
        """True Peak limiting"""
        ceiling = 10 ** (ceiling_db / 20)
        peak = np.max(np.abs(audio))
        if peak > ceiling:
            audio = audio * (ceiling / peak)
        return audio
```

### 6.2 Music Mastering Automation

```python
class MusicMasteringPipeline:
    """Automated music mastering pipeline"""

    def __init__(self, sr: int = 44100, target_platform: str = "Spotify"):
        self.sr = sr
        self.target_platform = target_platform
        self.specs = PLATFORM_LOUDNESS_SPECS.get(target_platform, {})

    def master(self, input_path: str, output_path: str,
               genre: str = "pop") -> dict:
        """Mastering processing"""
        audio, sr = sf.read(input_path, always_2d=True)
        audio = audio.T  # (channels, samples)

        if sr != self.sr:
            import librosa
            audio = np.array([
                librosa.resample(ch, orig_sr=sr, target_sr=self.sr)
                for ch in audio
            ])

        # Analysis report
        pre_analysis = self._analyze(audio)
        print(f"Analysis result: {pre_analysis}")

        # DC removal
        audio = audio - np.mean(audio, axis=1, keepdims=True)

        # Genre-specific EQ
        genre_eq = self._get_genre_eq(genre)
        for ch in range(audio.shape[0]):
            audio[ch] = genre_eq.apply(audio[ch])

        # Multiband compression
        mb_comp = MultibandCompressor(sr=self.sr)
        for ch in range(audio.shape[0]):
            audio[ch] = mb_comp.process(audio[ch])

        # Stereo imaging (for stereo sources)
        if audio.shape[0] == 2:
            audio = self._stereo_enhance(audio)

        # Loudness normalization
        target_lufs = self.specs.get("target_lufs", -14.0)
        meter = LUFSMeter(sr=self.sr)
        current = meter.measure_integrated(audio)
        gain = 10 ** ((target_lufs - current) / 20)
        audio = audio * gain

        # True Peak limiting
        tp_limit = self.specs.get("true_peak_limit", -1.0)
        audio = self._true_peak_limit_stereo(audio, tp_limit)

        # Save
        sf.write(output_path, audio.T, self.sr, subtype='PCM_24')

        # Final analysis
        post_analysis = self._analyze(audio)
        return {
            "before": pre_analysis,
            "after": post_analysis,
            "target_platform": self.target_platform,
            "output": output_path,
        }

    def _analyze(self, audio):
        """Audio analysis"""
        meter = LUFSMeter(sr=self.sr)
        return {
            "lufs": meter.measure_integrated(audio),
            "peak_db": round(20 * np.log10(np.max(np.abs(audio)) + 1e-10), 1),
            "dynamic_range_db": round(
                20 * np.log10(np.max(np.abs(audio)) + 1e-10) -
                20 * np.log10(np.sqrt(np.mean(audio ** 2)) + 1e-10), 1
            ),
        }

    def _get_genre_eq(self, genre):
        """Genre-specific EQ presets"""
        eq = ParametricEQ(sr=self.sr)
        if genre == "pop":
            eq.add_band(60, +2, q=1.0, band_type="peak")
            eq.add_band(3000, +2, q=1.5, band_type="peak")
            eq.add_band(10000, +1, q=0.707, band_type="high_shelf")
        elif genre == "rock":
            eq.add_band(100, +3, q=0.8, band_type="peak")
            eq.add_band(2500, +2, q=1.2, band_type="peak")
            eq.add_band(8000, +1.5, q=0.707, band_type="high_shelf")
        elif genre == "classical":
            eq.add_band(250, -1, q=1.0, band_type="peak")
            eq.add_band(5000, +1, q=0.707, band_type="high_shelf")
        elif genre == "hiphop":
            eq.add_band(50, +4, q=1.0, band_type="peak")
            eq.add_band(150, +2, q=1.0, band_type="peak")
            eq.add_band(4000, +2, q=1.5, band_type="peak")
        return eq

    def _stereo_enhance(self, audio):
        """Stereo image enhancement"""
        mid = (audio[0] + audio[1]) / 2
        side = (audio[0] - audio[1]) / 2
        # Slightly boost side component (enhance stereo feel)
        side = side * 1.2
        audio[0] = mid + side
        audio[1] = mid - side
        return audio

    def _true_peak_limit_stereo(self, audio, ceiling_db):
        """Stereo True Peak limiting"""
        ceiling = 10 ** (ceiling_db / 20)
        for ch in range(audio.shape[0]):
            peak = np.max(np.abs(audio[ch]))
            if peak > ceiling:
                audio[ch] = audio[ch] * (ceiling / peak)
        return audio
```

---

## 7. FAQ

### Q1: What are the recommended settings for noise removal in podcast recordings?

For podcasts, (1) first remove environmental noise with noisereduce at light to moderate levels (prop_decrease=0.6-0.7), (2) cut below 80Hz with a high-pass filter (AC noise, vibration), (3) control sibilance with a de-esser. The key is not to over-remove. A small amount of remaining noise sounds better than artifact-laden "clean" audio. Adobe Podcast's "Enhance Speech" feature is the simplest and highest-quality option.

### Q2: What is LUFS (Loudness Units) and why is it important?

LUFS is a loudness measurement unit defined by ITU-R BS.1770 that takes human auditory characteristics into account. Each streaming platform requires different LUFS values: Spotify: -14 LUFS, YouTube: -14 LUFS, Apple Music: -16 LUFS, Podcasts: -16 to -14 LUFS. If you don't match these values, the platform will automatically adjust the loudness, resulting in unintended audio quality changes.

### Q3: Can AI mastering replace professional mastering engineers?

As of 2025, it has not achieved "complete replacement." AI mastering has advantages in (1) technical accuracy (LUFS compliance, True Peak limiting), (2) consistent quality, and (3) low cost and fast turnaround. On the other hand, (1) understanding the artistic intent of a track, (2) maintaining consistency across album mastering, and (3) identifying problems and finding creative solutions are still areas where human engineers excel. AI mastering is sufficient for demos/podcasts/YouTube content, while professional engineers are recommended for commercial releases.

### Q4: What are the hardware requirements for real-time AI effect processing?

Hardware requirements for real-time processing vary significantly depending on the model used. RNNoise runs on CPU only and can process on a Raspberry Pi (latency ~5ms). Demucs Denoiser recommends a GPU (NVIDIA RTX 3060 or higher) with latency around 20-50ms. The key consideration is the "buffer size vs. latency tradeoff" -- smaller buffers reduce latency but increase processing load. Generally, latency below 40ms is comfortable for voice calls, and below 10ms for music performance.

### Q5: What are the rules of thumb for EQ and compressor parameter settings?

For vocal recording, with EQ: first apply a high-pass filter below 80Hz to remove rumble noise, cut 2-3dB in the 200-300Hz "muddiness" range, and boost 2-3dB in the 2-4kHz "presence" range. For the compressor: threshold -18 to -24dB, ratio 3:1 to 4:1, attack 5-10ms, release 40-80ms as a starting point. However, these are merely rules of thumb, and adjusting by ear according to the actual material and environment is most important.

### Q6: What is dithering and when is it needed?

Dithering is a process that intentionally adds minute noise to reduce quantization distortion that occurs when reducing bit depth (e.g., 24-bit to 16-bit). It is needed at the final stage of mastering when converting to CD-quality 16-bit WAV or MP3. Reducing bit depth without dithering causes quantization noise that becomes perceptible distortion at low signal levels. TPDF (Triangular Probability Density Function) dither is the most common type and is built into limiter plugins like iZotope Ozone and FabFilter Pro-L.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

The knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------|
| Effect order | Denoise -> EQ -> Compressor -> Spatial -> Limiter |
| AI noise removal | Handles non-stationary noise, no profile needed |
| AI EQ | Automatic adjustment based on difference from target profile |
| Auto mastering | LUFS normalization is core. Comply with target platform requirements |
| Avoid excessive processing | 70-80% noise removal is the guideline. 100% degrades audio |
| Professional vs AI | AI is sufficient for streaming content. Professional recommended for commercial releases |
| Quality evaluation | Objective evaluation with SNR/PESQ/STOI/SDR. Listening evaluation is also important |
| Real-time | RNNoise works on CPU. GPU-based models have 20-50ms latency |

## Recommended Next Guides

- [03-midi-ai.md](./03-midi-ai.md) — MIDI x AI (Automatic Composition, Chord Progression Generation)
- [01-stem-separation.md](./01-stem-separation.md) — Combining with Stem Separation
- [../03-development/01-audio-processing.md](../03-development/01-audio-processing.md) — librosa/torchaudio Implementation

## References

1. Defossez, A., et al. (2020). "Real Time Speech Enhancement in the Waveform Domain" — Meta Denoiser paper. Real-time noise removal in the waveform domain
2. Valin, J.M., et al. (2018). "A Hybrid DSP/Deep Learning Approach to Real-Time Full-Band Speech Enhancement" — RNNoise paper. Ultra-lightweight real-time noise removal
3. ITU-R BS.1770-5 (2023). "Algorithms to measure audio programme loudness and true-peak audio level" — International standard for loudness measurement
4. EBU R128 (2020). "Loudness normalisation and permitted maximum level of audio signals" — European Broadcasting Union loudness standard
5. Rix, A.W., et al. (2001). "Perceptual Evaluation of Speech Quality (PESQ)" — ITU-T P.862 speech quality evaluation standard
6. Taal, C.H., et al. (2011). "An Algorithm for Intelligibility Prediction of Time-Frequency Weighted Noisy Speech" — STOI speech intelligibility evaluation
7. Smith, J.O. (2007). "Introduction to Digital Filters with Audio Applications" — Textbook on digital filter design
8. Zolzer, U. (2011). "DAFX: Digital Audio Effects" — Comprehensive textbook on digital audio effects
