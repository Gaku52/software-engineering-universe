# Audio Processing Pipeline Implementation Guide

> A systematic guide to designing and implementing audio processing pipelines that support the input and output of audio AI systems, including preprocessing, feature extraction, noise reduction, format conversion, and resampling.

---

## What You Will Learn in This Chapter

1. Understand **audio signal fundamentals** (sample rate, bit depth, channels) and design appropriate preprocessing
2. Master the principles and implementation of **feature extraction** (MFCC, mel spectrogram, F0, etc.) and optimize AI inputs
3. Learn implementation patterns for **noise reduction, normalization, and format conversion** and build production-quality pipelines


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [Audio AI API Comparison, Integration & Utilization Guide](./00-audio-apis.md)

---

## 1. Audio Signal Fundamentals

### 1.1 Structure of Digital Audio

```
Analog audio waveform → Sampling → Quantization → Digital audio

Time axis ──────────────────────────────────────>
          ┌─┐
      ┌─┐ │ │ ┌─┐
  ┌─┐ │ │ │ │ │ │ ┌─┐
──┤ ├─┤ ├─┤ ├─┤ ├─┤ ├──  ← Sample values (amplitude)
  └─┘ └─┘ └─┘ └─┘ └─┘
  t0  t1  t2  t3  t4       ← Sampling interval

Sample rate: Number of samples per second (Hz)
  - 8,000 Hz  : Telephone voice quality
  - 16,000 Hz : Speech recognition standard
  - 22,050 Hz : AM broadcast quality
  - 44,100 Hz : CD quality
  - 48,000 Hz : Professional/video standard
  - 96,000 Hz : Hi-res audio

Bit depth: Number of quantization bits per sample
  - 8 bit  : 256 levels (low quality)
  - 16 bit : 65,536 levels (CD quality)
  - 24 bit : 16,777,216 levels (professional quality)
  - 32 bit float : Machine learning standard

Nyquist frequency = Sample rate / 2
  - 16kHz → Can reproduce audio frequencies up to 8kHz
  - 44.1kHz → Up to 22.05kHz (covers the human audible range)
```

### 1.2 Audio Format Comparison Table

| Format | Extension | Compression | Use Case | Example Bitrate |
|--------|-----------|-------------|----------|-----------------|
| WAV | .wav | Uncompressed | Editing/processing | 1,411 kbps (16bit/44.1kHz) |
| FLAC | .flac | Lossless | Archiving | ~900 kbps |
| MP3 | .mp3 | Lossy | Distribution/playback | 128-320 kbps |
| AAC | .m4a | Lossy | Distribution/mobile | 96-256 kbps |
| OGG/Opus | .ogg | Lossy | WebRTC/low latency | 32-128 kbps |
| PCM | .raw | Uncompressed | API input | 256 kbps (16bit/16kHz) |
| AIFF | .aiff | Uncompressed | macOS/Logic Pro | 1,411 kbps (16bit/44.1kHz) |
| WebM | .webm | Lossy | Web distribution | 64-256 kbps |

### 1.3 Retrieving Audio File Metadata

```python
import soundfile as sf
import librosa
from pathlib import Path

def get_audio_info(file_path: str) -> dict:
    """Retrieve detailed information about an audio file"""
    path = Path(file_path)

    # Get basic info with soundfile
    info = sf.info(file_path)

    # Additional analysis with librosa
    y, sr = librosa.load(file_path, sr=None, mono=False)

    result = {
        "file_name": path.name,
        "file_size_mb": path.stat().st_size / (1024 * 1024),
        "format": info.format,
        "subtype": info.subtype,
        "sample_rate": info.samplerate,
        "channels": info.channels,
        "frames": info.frames,
        "duration_sec": info.duration,
        "bit_depth": info.subtype,
        # Signal analysis
        "peak_amplitude": float(abs(y).max()),
        "rms_level_db": float(20 * __import__("numpy").log10(
            __import__("numpy").sqrt(__import__("numpy").mean(y ** 2)) + 1e-10
        )),
        "is_mono": info.channels == 1,
        "is_stereo": info.channels == 2,
    }

    return result


def batch_audio_info(directory: str) -> list[dict]:
    """Retrieve information for all audio files in a directory at once"""
    audio_extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aiff"}
    results = []

    for path in Path(directory).iterdir():
        if path.suffix.lower() in audio_extensions:
            try:
                info = get_audio_info(str(path))
                results.append(info)
            except Exception as e:
                results.append({"file_name": path.name, "error": str(e)})

    return results
```

---

## 2. Overall Audio Processing Pipeline Design

### 2.1 Pipeline Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Audio Processing Pipeline                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Input audio ──> [Format conversion] ──> [Resampling]    │
│                                              │           │
│                                              v           │
│               [Channel conversion] <── [Normalization]   │
│                       │                                  │
│                       v                                  │
│  [VAD (Voice Activity Detection)] ──> [Noise reduction]  │
│                                    ──> [Trimming]        │
│                                              │           │
│                                              v           │
│              [Feature extraction] ──> [MFCC/Mel spectro] │
│                                          │               │
│                                          v               │
│                                   [AI model input]       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Basic Pipeline Implementation

```python
# Audio processing pipeline foundation
import numpy as np
import librosa
import soundfile as sf
from dataclasses import dataclass, field
from typing import Optional, Callable
from pathlib import Path

@dataclass
class AudioData:
    """Unified representation of audio data"""
    samples: np.ndarray          # Waveform data (float32, -1.0 ~ 1.0)
    sample_rate: int             # Sample rate
    channels: int = 1            # Number of channels
    metadata: dict = field(default_factory=dict)

    @property
    def duration(self) -> float:
        """Duration in seconds"""
        return len(self.samples) / self.sample_rate

    @property
    def rms(self) -> float:
        """RMS (Root Mean Square) level"""
        return float(np.sqrt(np.mean(self.samples ** 2)))

    @property
    def peak(self) -> float:
        """Peak amplitude"""
        return float(np.max(np.abs(self.samples)))

    @property
    def rms_db(self) -> float:
        """RMS level (dB)"""
        rms = self.rms
        if rms == 0:
            return -float('inf')
        return float(20 * np.log10(rms))

    @property
    def crest_factor(self) -> float:
        """Crest factor (peak/RMS ratio)"""
        rms = self.rms
        if rms == 0:
            return float('inf')
        return self.peak / rms

    def get_channel(self, channel: int) -> 'AudioData':
        """Retrieve data for a specific channel"""
        if self.channels == 1:
            return self
        return AudioData(
            samples=self.samples[channel],
            sample_rate=self.sample_rate,
            channels=1,
            metadata={**self.metadata, "channel": channel},
        )

class AudioPipeline:
    """Extensible audio processing pipeline"""

    def __init__(self):
        self.steps: list[tuple[str, Callable]] = []
        self._logs: list[dict] = []

    def add_step(self, name: str, func: Callable[[AudioData], AudioData]):
        """Add a processing step"""
        self.steps.append((name, func))
        return self  # Support method chaining

    def remove_step(self, name: str):
        """Remove a processing step"""
        self.steps = [(n, f) for n, f in self.steps if n != name]
        return self

    def process(self, audio: AudioData, verbose: bool = True) -> AudioData:
        """Execute all steps sequentially"""
        self._logs = []

        for name, func in self.steps:
            try:
                prev_duration = audio.duration
                prev_rms = audio.rms
                audio = func(audio)
                log_entry = {
                    "step": name,
                    "status": "OK",
                    "duration": audio.duration,
                    "sample_rate": audio.sample_rate,
                    "rms": audio.rms,
                }
                self._logs.append(log_entry)

                if verbose:
                    print(f"  [OK] {name}: {audio.duration:.2f}s, "
                          f"SR={audio.sample_rate}, RMS={audio.rms:.4f}")
            except Exception as e:
                self._logs.append({
                    "step": name,
                    "status": "FAILED",
                    "error": str(e),
                })
                if verbose:
                    print(f"  [NG] {name}: {e}")
                raise
        return audio

    def get_logs(self) -> list[dict]:
        """Retrieve processing logs"""
        return self._logs

    @staticmethod
    def load(path: str, target_sr: Optional[int] = None) -> AudioData:
        """Load an audio file"""
        samples, sr = librosa.load(path, sr=target_sr, mono=False)
        if samples.ndim == 1:
            channels = 1
        else:
            channels = samples.shape[0]
            samples = samples.mean(axis=0)  # Convert to mono
        return AudioData(
            samples=samples.astype(np.float32),
            sample_rate=sr,
            channels=channels,
            metadata={"source": path},
        )

    @staticmethod
    def save(audio: AudioData, path: str, format: str = "wav"):
        """Save audio data"""
        sf.write(path, audio.samples, audio.sample_rate, format=format)

    @staticmethod
    def load_raw(path: str, sample_rate: int, dtype: str = "int16") -> AudioData:
        """Load a RAW PCM file"""
        dtype_map = {"int16": np.int16, "float32": np.float32}
        np_dtype = dtype_map.get(dtype, np.int16)

        raw_data = np.fromfile(path, dtype=np_dtype)

        if np_dtype == np.int16:
            samples = raw_data.astype(np.float32) / 32768.0
        else:
            samples = raw_data

        return AudioData(
            samples=samples,
            sample_rate=sample_rate,
            channels=1,
            metadata={"source": path, "raw_dtype": dtype},
        )
```

### 2.3 Streaming-Compatible Pipeline

```python
import numpy as np
from collections import deque
from typing import Iterator

class StreamingAudioPipeline:
    """Streaming-compatible audio processing pipeline"""

    def __init__(
        self,
        chunk_size: int = 4096,
        sample_rate: int = 16000,
        overlap: int = 0,
    ):
        self.chunk_size = chunk_size
        self.sample_rate = sample_rate
        self.overlap = overlap
        self.steps: list[tuple[str, Callable]] = []
        self._buffer = np.array([], dtype=np.float32)
        self._overlap_buffer = np.array([], dtype=np.float32)

    def add_step(self, name: str, func: Callable):
        self.steps.append((name, func))
        return self

    def process_chunk(self, chunk: np.ndarray) -> np.ndarray:
        """Process a single chunk"""
        # Overlap handling
        if len(self._overlap_buffer) > 0:
            chunk = np.concatenate([self._overlap_buffer, chunk])

        if self.overlap > 0:
            self._overlap_buffer = chunk[-self.overlap:]
        else:
            self._overlap_buffer = np.array([], dtype=np.float32)

        audio = AudioData(
            samples=chunk.astype(np.float32),
            sample_rate=self.sample_rate,
        )

        for name, func in self.steps:
            audio = func(audio)

        return audio.samples

    def process_stream(
        self, audio_stream: Iterator[np.ndarray]
    ) -> Iterator[np.ndarray]:
        """Process an audio stream"""
        for chunk in audio_stream:
            processed = self.process_chunk(chunk)
            yield processed

    def reset(self):
        """Reset internal state"""
        self._buffer = np.array([], dtype=np.float32)
        self._overlap_buffer = np.array([], dtype=np.float32)


def create_microphone_stream(
    sample_rate: int = 16000,
    chunk_size: int = 1600,  # 100ms
) -> Iterator[np.ndarray]:
    """Generate a stream from microphone input"""
    import pyaudio

    p = pyaudio.PyAudio()
    stream = p.open(
        format=pyaudio.paFloat32,
        channels=1,
        rate=sample_rate,
        input=True,
        frames_per_buffer=chunk_size,
    )

    try:
        while True:
            data = stream.read(chunk_size, exception_on_overflow=False)
            yield np.frombuffer(data, dtype=np.float32)
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()
```

---

## 3. Preprocessing Modules

### 3.1 Resampling

```python
# Resampling: Sample rate conversion
import librosa
import numpy as np

def resample(audio: AudioData, target_sr: int = 16000) -> AudioData:
    """Convert the sample rate"""
    if audio.sample_rate == target_sr:
        return audio

    resampled = librosa.resample(
        audio.samples,
        orig_sr=audio.sample_rate,
        target_sr=target_sr,
        res_type="kaiser_best",  # High-quality resampling
        # Other options:
        #   "kaiser_fast"  - Faster but slightly lower quality
        #   "scipy"        - scipy.signal.resample
        #   "polyphase"    - Polyphase filter
        #   "fft"          - FFT-based (for periodic signals)
        #   "soxr_hq"      - SoX resampler high quality
        #   "soxr_vhq"     - SoX resampler very high quality
    )

    return AudioData(
        samples=resampled.astype(np.float32),
        sample_rate=target_sr,
        channels=audio.channels,
        metadata={**audio.metadata, "resampled_from": audio.sample_rate},
    )


def resample_batch(
    audio_files: list[str],
    target_sr: int = 16000,
    output_dir: str = "./resampled",
) -> list[str]:
    """Batch resample multiple files"""
    from pathlib import Path

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    results = []

    for file_path in audio_files:
        audio = AudioPipeline.load(file_path)
        resampled = resample(audio, target_sr)

        out_file = output_path / Path(file_path).name
        AudioPipeline.save(resampled, str(out_file))
        results.append(str(out_file))

    return results
```

### 3.2 Normalization

```python
# Audio normalization: Peak normalization and loudness normalization
import numpy as np

def peak_normalize(audio: AudioData, target_peak: float = 0.95) -> AudioData:
    """Peak normalization: Adjust maximum amplitude to a specified value"""
    current_peak = np.max(np.abs(audio.samples))
    if current_peak == 0:
        return audio

    gain = target_peak / current_peak
    normalized = audio.samples * gain

    return AudioData(
        samples=normalized.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={**audio.metadata, "peak_normalized": True, "gain": gain},
    )

def rms_normalize(
    audio: AudioData, target_db: float = -20.0
) -> AudioData:
    """RMS normalization: Adjust average volume to a specified dB level"""
    current_rms = np.sqrt(np.mean(audio.samples ** 2))
    if current_rms == 0:
        return audio

    target_rms = 10 ** (target_db / 20)
    gain = target_rms / current_rms

    normalized = audio.samples * gain
    # Prevent clipping
    normalized = np.clip(normalized, -1.0, 1.0)

    return AudioData(
        samples=normalized.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={**audio.metadata, "rms_normalized": True},
    )

def lufs_normalize(
    audio: AudioData, target_lufs: float = -14.0
) -> AudioData:
    """
    LUFS normalization: Loudness normalization compliant with ITU-R BS.1770
    For streaming distribution (Spotify: -14 LUFS, YouTube: -14 LUFS)
    """
    import pyloudnorm as pyln

    meter = pyln.Meter(audio.sample_rate)

    # Measure current loudness
    current_lufs = meter.integrated_loudness(audio.samples)

    if current_lufs == -float('inf'):
        return audio

    # Calculate gain
    gain_db = target_lufs - current_lufs
    gain_linear = 10 ** (gain_db / 20)

    normalized = audio.samples * gain_linear
    # Peak limiting (ensure True Peak does not exceed -1 dBTP)
    peak = np.max(np.abs(normalized))
    if peak > 0.891:  # -1 dBTP ≈ 0.891
        normalized = normalized * (0.891 / peak)

    return AudioData(
        samples=normalized.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={
            **audio.metadata,
            "lufs_normalized": True,
            "original_lufs": current_lufs,
            "target_lufs": target_lufs,
        },
    )
```

### 3.3 Channel Conversion

```python
import numpy as np

def to_mono(audio: AudioData, method: str = "mean") -> AudioData:
    """Convert stereo to mono"""
    if audio.channels == 1:
        return audio

    if audio.samples.ndim == 1:
        return audio

    if method == "mean":
        # Average (standard method)
        mono = np.mean(audio.samples, axis=0)
    elif method == "left":
        mono = audio.samples[0]
    elif method == "right":
        mono = audio.samples[1]
    elif method == "side":
        # Side signal (L-R): Useful for extracting reverb components
        mono = audio.samples[0] - audio.samples[1]
    elif method == "mid":
        # Mid signal (L+R): Useful for vocal extraction
        mono = audio.samples[0] + audio.samples[1]
    else:
        raise ValueError(f"Unsupported conversion method: {method}")

    return AudioData(
        samples=mono.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=1,
        metadata={**audio.metadata, "mono_method": method},
    )

def to_stereo(audio: AudioData) -> AudioData:
    """Convert mono to stereo"""
    if audio.channels == 2:
        return audio

    stereo = np.stack([audio.samples, audio.samples], axis=0)

    return AudioData(
        samples=stereo.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=2,
        metadata={**audio.metadata, "converted_to_stereo": True},
    )
```

### 3.4 Trimming and Padding

```python
import numpy as np
import librosa

def trim_silence(
    audio: AudioData,
    top_db: float = 30,
    frame_length: int = 2048,
    hop_length: int = 512,
) -> AudioData:
    """Trim silent sections"""
    trimmed, index = librosa.effects.trim(
        audio.samples,
        top_db=top_db,
        frame_length=frame_length,
        hop_length=hop_length,
    )

    trim_start = index[0] / audio.sample_rate
    trim_end = index[1] / audio.sample_rate

    return AudioData(
        samples=trimmed.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={
            **audio.metadata,
            "trimmed": True,
            "trim_start_sec": trim_start,
            "trim_end_sec": trim_end,
            "original_duration": len(audio.samples) / audio.sample_rate,
        },
    )

def pad_to_duration(
    audio: AudioData,
    target_duration: float,
    pad_mode: str = "constant",
) -> AudioData:
    """Pad to a specified duration"""
    target_samples = int(target_duration * audio.sample_rate)
    current_samples = len(audio.samples)

    if current_samples >= target_samples:
        # Truncate if longer
        return AudioData(
            samples=audio.samples[:target_samples],
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={**audio.metadata, "padded": False, "truncated": True},
        )

    pad_length = target_samples - current_samples

    if pad_mode == "constant":
        padded = np.pad(audio.samples, (0, pad_length), mode="constant")
    elif pad_mode == "wrap":
        # Loop (repeat) padding
        padded = np.pad(audio.samples, (0, pad_length), mode="wrap")
    elif pad_mode == "reflect":
        # Reflect padding (natural fade-out effect)
        padded = np.pad(audio.samples, (0, pad_length), mode="reflect")
    else:
        padded = np.pad(audio.samples, (0, pad_length), mode="constant")

    return AudioData(
        samples=padded.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={
            **audio.metadata,
            "padded": True,
            "pad_mode": pad_mode,
            "pad_duration": pad_length / audio.sample_rate,
        },
    )

def split_audio(
    audio: AudioData,
    chunk_duration: float = 30.0,
    overlap: float = 0.0,
) -> list[AudioData]:
    """Split audio into chunks of a specified duration"""
    chunk_samples = int(chunk_duration * audio.sample_rate)
    overlap_samples = int(overlap * audio.sample_rate)
    step = chunk_samples - overlap_samples

    chunks = []
    start = 0

    while start < len(audio.samples):
        end = min(start + chunk_samples, len(audio.samples))
        chunk = audio.samples[start:end]

        # Pad if the last chunk is too short
        if len(chunk) < chunk_samples:
            chunk = np.pad(chunk, (0, chunk_samples - len(chunk)), mode="constant")

        chunks.append(AudioData(
            samples=chunk.astype(np.float32),
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={
                **audio.metadata,
                "chunk_index": len(chunks),
                "chunk_start_sec": start / audio.sample_rate,
                "chunk_end_sec": end / audio.sample_rate,
            },
        ))

        start += step

    return chunks
```

---

## 4. Noise Reduction

### 4.1 Comparison of Noise Reduction Methods

```
┌──────────────────────────────────────────────────┐
│         Classification of Noise Reduction        │
│                    Methods                        │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────┐    ┌────────────────────┐   │
│  │  Statistical    │    │  Spectral          │   │
│  │  Methods        │    │  Methods           │   │
│  ├────────────────┤    ├────────────────────┤   │
│  │ Wiener filter   │    │ Spectral gating    │   │
│  │ Kalman filter   │    │ Spectral           │   │
│  │                 │    │   subtraction      │   │
│  └────────────────┘    └────────────────────┘   │
│                                                  │
│  ┌────────────────┐    ┌────────────────────┐   │
│  │  Deep Learning  │    │  Adaptive          │   │
│  │  Methods        │    │  Filters           │   │
│  ├────────────────┤    ├────────────────────┤   │
│  │ RNNoise        │    │  LMS adaptive      │   │
│  │ DTLN           │    │  NLMS adaptive     │   │
│  │ DeepFilterNet  │    │  RLS adaptive      │   │
│  └────────────────┘    └────────────────────┘   │
└──────────────────────────────────────────────────┘
```

| Method | Computational Cost | Quality | Real-time | Use Case |
|--------|-------------------|---------|-----------|----------|
| Spectral gating | Low | Medium | Possible | Stationary noise |
| Spectral subtraction | Low | Medium | Possible | Background noise |
| Wiener filter | Medium | Medium-High | Possible | General purpose |
| RNNoise | Medium | High | Possible | General purpose |
| DTLN | Medium | High | Possible | Real-time |
| DeepFilterNet | High | Very high | Possible (GPU) | High quality requirements |

### 4.2 Noise Reduction Using Spectral Gating

```python
# Noise reduction using spectral gating
import numpy as np
import librosa

def spectral_gate_denoise(
    audio: AudioData,
    noise_sample_duration: float = 0.5,
    threshold_factor: float = 1.5,
    n_fft: int = 2048,
    hop_length: int = 512,
) -> AudioData:
    """
    Noise reduction via spectral gating.
    Estimates the noise profile from an initial noise sample and suppresses
    content below the threshold.
    """
    samples = audio.samples
    sr = audio.sample_rate

    # STFT (Short-Time Fourier Transform)
    stft = librosa.stft(samples, n_fft=n_fft, hop_length=hop_length)
    magnitude = np.abs(stft)
    phase = np.angle(stft)

    # Noise profile estimation (from silent section at the beginning)
    noise_frames = int(noise_sample_duration * sr / hop_length)
    noise_profile = np.mean(magnitude[:, :noise_frames], axis=1, keepdims=True)

    # Apply spectral gate
    threshold = noise_profile * threshold_factor
    mask = magnitude > threshold
    # Soft mask (smooth transition)
    soft_mask = np.clip(
        (magnitude - threshold) / (threshold + 1e-10), 0.0, 1.0
    )

    cleaned_magnitude = magnitude * soft_mask

    # Inverse STFT
    cleaned_stft = cleaned_magnitude * np.exp(1j * phase)
    cleaned_samples = librosa.istft(
        cleaned_stft, hop_length=hop_length, length=len(samples)
    )

    return AudioData(
        samples=cleaned_samples.astype(np.float32),
        sample_rate=sr,
        channels=audio.channels,
        metadata={**audio.metadata, "denoised": "spectral_gate"},
    )
```

### 4.3 Noise Reduction Using the noisereduce Library

```python
import noisereduce as nr
import numpy as np

def noisereduce_denoise(
    audio: AudioData,
    stationary: bool = True,
    prop_decrease: float = 0.75,
    n_fft: int = 2048,
    noise_clip: Optional[np.ndarray] = None,
) -> AudioData:
    """
    Noise reduction using the noisereduce library

    Parameters:
        stationary: True=assumes stationary noise, False=handles non-stationary noise
        prop_decrease: Noise reduction ratio (0.0-1.0)
        noise_clip: Noise sample (auto-estimated if None)
    """
    reduced = nr.reduce_noise(
        y=audio.samples,
        sr=audio.sample_rate,
        y_noise=noise_clip,
        stationary=stationary,
        prop_decrease=prop_decrease,
        n_fft=n_fft,
        freq_mask_smooth_hz=500,
        time_mask_smooth_ms=50,
    )

    return AudioData(
        samples=reduced.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={
            **audio.metadata,
            "denoised": "noisereduce",
            "stationary": stationary,
            "prop_decrease": prop_decrease,
        },
    )
```

### 4.4 High-Quality Noise Reduction with DeepFilterNet

```python
def deepfilternet_denoise(audio: AudioData) -> AudioData:
    """
    High-quality noise reduction with DeepFilterNet (GPU recommended)
    - DNN-based, handles non-stationary noise
    - Minimal degradation of speech quality
    """
    from df.enhance import enhance, init_df, load_audio, save_audio
    import torch

    model, df_state, _ = init_df()

    # Convert audio to model input format
    audio_tensor = torch.tensor(
        audio.samples, dtype=torch.float32
    ).unsqueeze(0)

    # Execute noise reduction
    enhanced = enhance(model, df_state, audio_tensor)

    return AudioData(
        samples=enhanced.squeeze().numpy().astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={**audio.metadata, "denoised": "deepfilternet"},
    )
```

### 4.5 Echo Cancellation

```python
import numpy as np
from scipy import signal

def echo_cancellation(
    audio: AudioData,
    reference: AudioData,
    filter_length: int = 1024,
    step_size: float = 0.01,
) -> AudioData:
    """
    Echo cancellation using the NLMS algorithm

    Parameters:
        audio: Microphone input containing echo
        reference: Speaker output (reference signal)
        filter_length: Length of the adaptive filter
        step_size: Adaptive step size (mu)
    """
    x = reference.samples  # Reference signal
    d = audio.samples      # Echo-contaminated signal
    n = len(d)

    # Initialize filter coefficients
    w = np.zeros(filter_length)
    y = np.zeros(n)  # Echo estimate
    e = np.zeros(n)  # Error (after echo removal)

    for i in range(filter_length, n):
        # Reference signal window
        x_window = x[i - filter_length:i][::-1]

        # Echo estimate
        y[i] = np.dot(w, x_window)

        # Error calculation
        e[i] = d[i] - y[i]

        # NLMS update
        norm = np.dot(x_window, x_window) + 1e-10
        w += step_size * e[i] * x_window / norm

    return AudioData(
        samples=e.astype(np.float32),
        sample_rate=audio.sample_rate,
        channels=audio.channels,
        metadata={**audio.metadata, "echo_cancelled": True},
    )
```

---

## 5. Feature Extraction

### 5.1 MFCC (Mel-Frequency Cepstral Coefficients)

```python
# MFCC feature extraction
import librosa
import numpy as np

def extract_mfcc(
    audio: AudioData,
    n_mfcc: int = 13,
    n_fft: int = 2048,
    hop_length: int = 512,
    include_delta: bool = True,
) -> np.ndarray:
    """
    Extract MFCC features

    Parameters:
        n_mfcc: Number of MFCC coefficients (typically 13 or 40)
        include_delta: Whether to include delta/delta-delta

    Returns:
        numpy array with shape: (n_features, n_frames)
        - include_delta=False: n_features = n_mfcc
        - include_delta=True:  n_features = n_mfcc * 3
    """
    mfcc = librosa.feature.mfcc(
        y=audio.samples,
        sr=audio.sample_rate,
        n_mfcc=n_mfcc,
        n_fft=n_fft,
        hop_length=hop_length,
    )

    if not include_delta:
        return mfcc

    # Delta (1st derivative): Captures temporal changes
    delta = librosa.feature.delta(mfcc, order=1)
    # Delta-delta (2nd derivative): Captures acceleration
    delta2 = librosa.feature.delta(mfcc, order=2)

    # Concatenate: (n_mfcc*3, n_frames)
    features = np.concatenate([mfcc, delta, delta2], axis=0)
    return features
```

### 5.2 Mel Spectrogram

```python
def extract_mel_spectrogram(
    audio: AudioData,
    n_mels: int = 80,
    n_fft: int = 2048,
    hop_length: int = 512,
    to_db: bool = True,
) -> np.ndarray:
    """
    Extract a mel spectrogram.
    Models like Whisper use mel spectrograms directly as input.
    """
    mel = librosa.feature.melspectrogram(
        y=audio.samples,
        sr=audio.sample_rate,
        n_mels=n_mels,
        n_fft=n_fft,
        hop_length=hop_length,
    )

    if to_db:
        mel = librosa.power_to_db(mel, ref=np.max)

    return mel
```

### 5.3 Pitch (F0) Extraction

```python
import librosa
import numpy as np

def extract_pitch(
    audio: AudioData,
    fmin: float = 50.0,
    fmax: float = 500.0,
    method: str = "pyin",
) -> dict:
    """
    Extract pitch (fundamental frequency F0)

    Parameters:
        fmin: Minimum frequency (male voice: 50Hz, female voice: 100Hz)
        fmax: Maximum frequency (male voice: 300Hz, female voice: 500Hz)
        method: "pyin" or "crepe"
    """
    if method == "pyin":
        f0, voiced_flag, voiced_probs = librosa.pyin(
            audio.samples,
            sr=audio.sample_rate,
            fmin=fmin,
            fmax=fmax,
        )
    elif method == "yin":
        f0 = librosa.yin(
            audio.samples,
            sr=audio.sample_rate,
            fmin=fmin,
            fmax=fmax,
        )
        voiced_flag = f0 > 0
        voiced_probs = None
    else:
        raise ValueError(f"Unsupported method: {method}")

    # Replace NaN with 0
    f0_clean = np.nan_to_num(f0, nan=0.0)

    # Statistics
    voiced_f0 = f0_clean[f0_clean > 0]

    return {
        "f0": f0_clean,
        "voiced_flag": voiced_flag,
        "voiced_probs": voiced_probs,
        "statistics": {
            "mean_f0": float(np.mean(voiced_f0)) if len(voiced_f0) > 0 else 0,
            "std_f0": float(np.std(voiced_f0)) if len(voiced_f0) > 0 else 0,
            "min_f0": float(np.min(voiced_f0)) if len(voiced_f0) > 0 else 0,
            "max_f0": float(np.max(voiced_f0)) if len(voiced_f0) > 0 else 0,
            "voiced_ratio": float(np.sum(f0_clean > 0) / len(f0_clean)),
        },
    }
```

### 5.4 Spectral Features

```python
import librosa
import numpy as np

def extract_spectral_features(
    audio: AudioData,
    n_fft: int = 2048,
    hop_length: int = 512,
) -> dict:
    """
    Extract spectral features in batch.
    Useful for audio classification, emotion analysis, etc.
    """
    y = audio.samples
    sr = audio.sample_rate

    # Spectral centroid (perceived "brightness" of sound)
    spectral_centroid = librosa.feature.spectral_centroid(
        y=y, sr=sr, n_fft=n_fft, hop_length=hop_length
    )[0]

    # Spectral bandwidth (perceived "spread" of sound)
    spectral_bandwidth = librosa.feature.spectral_bandwidth(
        y=y, sr=sr, n_fft=n_fft, hop_length=hop_length
    )[0]

    # Spectral rolloff (frequency below which 85% of energy resides)
    spectral_rolloff = librosa.feature.spectral_rolloff(
        y=y, sr=sr, n_fft=n_fft, hop_length=hop_length
    )[0]

    # Spectral flatness (tonal vs. noise)
    spectral_flatness = librosa.feature.spectral_flatness(
        y=y, n_fft=n_fft, hop_length=hop_length
    )[0]

    # Zero-crossing rate
    zcr = librosa.feature.zero_crossing_rate(
        y, frame_length=n_fft, hop_length=hop_length
    )[0]

    # Chromagram (tonal information)
    chroma = librosa.feature.chroma_stft(
        y=y, sr=sr, n_fft=n_fft, hop_length=hop_length
    )

    return {
        "spectral_centroid": spectral_centroid,
        "spectral_bandwidth": spectral_bandwidth,
        "spectral_rolloff": spectral_rolloff,
        "spectral_flatness": spectral_flatness,
        "zero_crossing_rate": zcr,
        "chroma": chroma,
        "statistics": {
            "mean_centroid": float(np.mean(spectral_centroid)),
            "mean_bandwidth": float(np.mean(spectral_bandwidth)),
            "mean_rolloff": float(np.mean(spectral_rolloff)),
            "mean_flatness": float(np.mean(spectral_flatness)),
            "mean_zcr": float(np.mean(zcr)),
        },
    }
```

### 5.5 Voice Activity Detection (VAD)

```python
# Voice Activity Detection (VAD)
import numpy as np

def energy_based_vad(
    audio: AudioData,
    frame_length: int = 2048,
    hop_length: int = 512,
    energy_threshold_db: float = -40.0,
    min_speech_duration: float = 0.3,
    min_silence_duration: float = 0.2,
) -> list[tuple[float, float]]:
    """
    Energy-based VAD (Voice Activity Detection)

    Returns:
        [(start_sec, end_sec), ...] List of speech segments
    """
    samples = audio.samples
    sr = audio.sample_rate

    # Calculate energy per frame
    frames = librosa.util.frame(
        samples, frame_length=frame_length, hop_length=hop_length
    )
    energy = np.sum(frames ** 2, axis=0)
    energy_db = 10 * np.log10(energy + 1e-10)

    # Threshold decision
    is_speech = energy_db > energy_threshold_db

    # Minimum duration filtering
    min_speech_frames = int(min_speech_duration * sr / hop_length)
    min_silence_frames = int(min_silence_duration * sr / hop_length)

    segments = []
    in_speech = False
    start_frame = 0

    for i, speech in enumerate(is_speech):
        if speech and not in_speech:
            start_frame = i
            in_speech = True
        elif not speech and in_speech:
            duration_frames = i - start_frame
            if duration_frames >= min_speech_frames:
                start_sec = start_frame * hop_length / sr
                end_sec = i * hop_length / sr
                segments.append((start_sec, end_sec))
            in_speech = False

    # Handle trailing segment
    if in_speech:
        duration_frames = len(is_speech) - start_frame
        if duration_frames >= min_speech_frames:
            start_sec = start_frame * hop_length / sr
            end_sec = len(samples) / sr
            segments.append((start_sec, end_sec))

    # Merge adjacent segments
    merged = _merge_close_segments(segments, min_silence_duration)
    return merged

def _merge_close_segments(
    segments: list[tuple[float, float]],
    min_gap: float,
) -> list[tuple[float, float]]:
    """Merge closely spaced segments"""
    if not segments:
        return []

    merged = [segments[0]]
    for start, end in segments[1:]:
        prev_end = merged[-1][1]
        if start - prev_end < min_gap:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))
    return merged


def silero_vad(
    audio: AudioData,
    threshold: float = 0.5,
    min_speech_duration_ms: int = 250,
    min_silence_duration_ms: int = 100,
) -> list[tuple[float, float]]:
    """Silero VAD (high-accuracy neural network-based VAD)"""
    import torch

    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=False,
    )
    get_speech_timestamps = utils[0]

    audio_tensor = torch.tensor(audio.samples, dtype=torch.float32)

    speech_timestamps = get_speech_timestamps(
        audio_tensor,
        model,
        sampling_rate=audio.sample_rate,
        threshold=threshold,
        min_speech_duration_ms=min_speech_duration_ms,
        min_silence_duration_ms=min_silence_duration_ms,
    )

    segments = [
        (ts["start"] / audio.sample_rate, ts["end"] / audio.sample_rate)
        for ts in speech_timestamps
    ]

    return segments
```

---

## 6. Format Conversion

### 6.1 Robust Conversion Using ffmpeg

```python
# Robust format conversion based on ffmpeg
import subprocess
import tempfile
from pathlib import Path

class AudioConverter:
    """Audio format conversion using ffmpeg"""

    # Recommended settings for AI APIs
    API_PRESETS = {
        "whisper": {"format": "wav", "sr": 16000, "channels": 1, "bit_depth": 16},
        "google_stt": {"format": "flac", "sr": 16000, "channels": 1, "bit_depth": 16},
        "azure_stt": {"format": "wav", "sr": 16000, "channels": 1, "bit_depth": 16},
        "polly_output": {"format": "mp3", "sr": 22050, "channels": 1, "bitrate": "128k"},
        "elevenlabs": {"format": "mp3", "sr": 44100, "channels": 1, "bitrate": "192k"},
        "deepgram": {"format": "wav", "sr": 16000, "channels": 1, "bit_depth": 16},
    }

    @staticmethod
    def convert(
        input_path: str,
        output_path: str,
        sample_rate: int = 16000,
        channels: int = 1,
        bit_depth: int = 16,
        output_format: str = "wav",
    ) -> str:
        """General-purpose format conversion"""
        codec_map = {
            "wav": "pcm_s16le" if bit_depth == 16 else "pcm_s24le",
            "flac": "flac",
            "mp3": "libmp3lame",
            "ogg": "libopus",
            "aac": "aac",
        }

        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ar", str(sample_rate),
            "-ac", str(channels),
            "-acodec", codec_map.get(output_format, "pcm_s16le"),
            output_path,
        ]

        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr}")

        return output_path

    @classmethod
    def convert_for_api(
        cls, input_path: str, api: str, output_dir: str = "/tmp"
    ) -> str:
        """Convert using an API preset"""
        preset = cls.API_PRESETS.get(api)
        if not preset:
            raise ValueError(f"Unknown API preset: {api}")

        stem = Path(input_path).stem
        ext = preset["format"]
        output_path = f"{output_dir}/{stem}_{api}.{ext}"

        return cls.convert(
            input_path=input_path,
            output_path=output_path,
            sample_rate=preset["sr"],
            channels=preset["channels"],
            bit_depth=preset.get("bit_depth", 16),
            output_format=ext,
        )

    @staticmethod
    def get_audio_info_ffprobe(file_path: str) -> dict:
        """Retrieve audio file information using ffprobe"""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {result.stderr}")

        import json
        return json.loads(result.stdout)

    @staticmethod
    def extract_segment(
        input_path: str,
        output_path: str,
        start_sec: float,
        end_sec: float,
    ) -> str:
        """Extract a specified segment from an audio file"""
        duration = end_sec - start_sec
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ss", str(start_sec),
            "-t", str(duration),
            "-c", "copy",
            output_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg segment extraction failed: {result.stderr}")

        return output_path
```

---

## 7. Data Augmentation

### 7.1 Audio Data Augmentation Techniques

```python
import numpy as np
import librosa

class AudioAugmentor:
    """Audio data augmentation tools (for training data enhancement)"""

    @staticmethod
    def add_noise(
        audio: AudioData,
        noise_level: float = 0.005,
        noise_type: str = "gaussian",
    ) -> AudioData:
        """Add noise"""
        if noise_type == "gaussian":
            noise = np.random.normal(0, noise_level, len(audio.samples))
        elif noise_type == "uniform":
            noise = np.random.uniform(-noise_level, noise_level, len(audio.samples))
        elif noise_type == "pink":
            # Pink noise (1/f noise)
            white = np.random.randn(len(audio.samples))
            fft = np.fft.rfft(white)
            freqs = np.fft.rfftfreq(len(white))
            freqs[0] = 1  # Avoid division by zero for DC component
            fft = fft / np.sqrt(freqs)
            noise = np.fft.irfft(fft, n=len(white)) * noise_level
        else:
            noise = np.random.normal(0, noise_level, len(audio.samples))

        augmented = audio.samples + noise.astype(np.float32)
        augmented = np.clip(augmented, -1.0, 1.0)

        return AudioData(
            samples=augmented,
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={**audio.metadata, "augmentation": f"noise_{noise_type}"},
        )

    @staticmethod
    def time_stretch(
        audio: AudioData,
        rate: float = 1.0,
    ) -> AudioData:
        """Time stretch (change speed while preserving pitch)"""
        stretched = librosa.effects.time_stretch(audio.samples, rate=rate)

        return AudioData(
            samples=stretched.astype(np.float32),
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={**audio.metadata, "augmentation": f"time_stretch_{rate}"},
        )

    @staticmethod
    def pitch_shift(
        audio: AudioData,
        n_steps: float = 0.0,
    ) -> AudioData:
        """Pitch shift (change pitch)"""
        shifted = librosa.effects.pitch_shift(
            audio.samples,
            sr=audio.sample_rate,
            n_steps=n_steps,
        )

        return AudioData(
            samples=shifted.astype(np.float32),
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={**audio.metadata, "augmentation": f"pitch_shift_{n_steps}"},
        )

    @staticmethod
    def add_reverb(
        audio: AudioData,
        decay: float = 0.3,
        delay_ms: float = 50.0,
    ) -> AudioData:
        """Add simple reverb"""
        delay_samples = int(delay_ms * audio.sample_rate / 1000)
        impulse = np.zeros(delay_samples + 1)
        impulse[0] = 1.0
        impulse[-1] = decay

        reverbed = np.convolve(audio.samples, impulse, mode="full")[:len(audio.samples)]

        return AudioData(
            samples=reverbed.astype(np.float32),
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={**audio.metadata, "augmentation": "reverb"},
        )

    @staticmethod
    def random_crop(
        audio: AudioData,
        crop_duration: float = 5.0,
    ) -> AudioData:
        """Random crop"""
        crop_samples = int(crop_duration * audio.sample_rate)
        if len(audio.samples) <= crop_samples:
            return audio

        start = np.random.randint(0, len(audio.samples) - crop_samples)
        cropped = audio.samples[start:start + crop_samples]

        return AudioData(
            samples=cropped.astype(np.float32),
            sample_rate=audio.sample_rate,
            channels=audio.channels,
            metadata={
                **audio.metadata,
                "augmentation": "random_crop",
                "crop_start_sec": start / audio.sample_rate,
            },
        )

    @staticmethod
    def spec_augment(
        spectrogram: np.ndarray,
        freq_mask_param: int = 10,
        time_mask_param: int = 20,
        num_freq_masks: int = 2,
        num_time_masks: int = 2,
    ) -> np.ndarray:
        """
        SpecAugment: Masking augmentation applied to spectrograms.
        A technique that significantly improves accuracy in speech recognition model training.
        """
        augmented = spectrogram.copy()
        n_freq, n_time = augmented.shape

        # Frequency masks
        for _ in range(num_freq_masks):
            f = np.random.randint(0, freq_mask_param)
            f0 = np.random.randint(0, n_freq - f)
            augmented[f0:f0 + f, :] = 0

        # Time masks
        for _ in range(num_time_masks):
            t = np.random.randint(0, time_mask_param)
            t0 = np.random.randint(0, n_time - t)
            augmented[:, t0:t0 + t] = 0

        return augmented
```

---

## 8. Pipeline Integration Examples

### 8.1 STT Pipeline

```python
# Complete pipeline configuration example
def build_stt_pipeline(target_sr: int = 16000) -> AudioPipeline:
    """Build a standard pipeline for speech recognition"""
    pipeline = AudioPipeline()
    pipeline.add_step("resample", lambda a: resample(a, target_sr))
    pipeline.add_step("normalize", lambda a: rms_normalize(a, target_db=-20))
    pipeline.add_step("denoise", lambda a: spectral_gate_denoise(a))
    pipeline.add_step("peak_norm", lambda a: peak_normalize(a, target_peak=0.95))
    return pipeline

# Usage example
audio = AudioPipeline.load("input.wav")
pipeline = build_stt_pipeline()
processed = pipeline.process(audio)
AudioPipeline.save(processed, "output_processed.wav")

features = extract_mfcc(processed, n_mfcc=40, include_delta=True)
print(f"Feature shape: {features.shape}")
```

### 8.2 TTS Post-Processing Pipeline

```python
def build_tts_postprocess_pipeline(
    target_sr: int = 22050,
    target_lufs: float = -14.0,
) -> AudioPipeline:
    """Build a post-processing pipeline for TTS output"""
    pipeline = AudioPipeline()
    pipeline.add_step("resample", lambda a: resample(a, target_sr))
    pipeline.add_step("denoise", lambda a: noisereduce_denoise(a, prop_decrease=0.5))
    pipeline.add_step("lufs_norm", lambda a: lufs_normalize(a, target_lufs))
    pipeline.add_step("trim", lambda a: trim_silence(a, top_db=40))
    return pipeline
```

### 8.3 Batch Processing Pipeline

```python
import concurrent.futures
from pathlib import Path

def batch_process_audio(
    input_dir: str,
    output_dir: str,
    pipeline: AudioPipeline,
    max_workers: int = 4,
    extensions: set = {".wav", ".mp3", ".flac"},
) -> dict:
    """Batch process all audio files in a directory"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    files = [
        f for f in Path(input_dir).iterdir()
        if f.suffix.lower() in extensions
    ]

    results = {"success": 0, "failed": 0, "errors": []}

    def process_file(file_path: Path) -> dict:
        try:
            audio = AudioPipeline.load(str(file_path))
            processed = pipeline.process(audio, verbose=False)
            out_file = output_path / file_path.name
            AudioPipeline.save(processed, str(out_file))
            return {"file": file_path.name, "status": "OK"}
        except Exception as e:
            return {"file": file_path.name, "status": "FAILED", "error": str(e)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_file, f): f for f in files}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result["status"] == "OK":
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(result)

    return results
```

---

## 9. Anti-Patterns

### 9.1 Anti-Pattern: Sending Audio to an API Without Resampling

```python
# BAD: Sending 44.1kHz audio directly to the API
audio_44k = load_audio("music_quality.wav")  # 44,100Hz
result = stt_api.transcribe(audio_44k)  # API expects 16kHz

# GOOD: Resample to match API specification
audio_44k = load_audio("music_quality.wav")
audio_16k = resample(audio_44k, target_sr=16000)
result = stt_api.transcribe(audio_16k)
```

**Problem**: Sending audio at a sample rate different from what the API expects significantly degrades recognition accuracy. Always check the API documentation and convert to the appropriate rate.

### 9.2 Anti-Pattern: Excessive Noise Reduction

```python
# BAD: Setting an extremely high threshold for noise reduction
cleaned = spectral_gate_denoise(
    audio, threshold_factor=5.0  # Threshold too high
)
# → Speech components are also removed, resulting in "robotic voice"

# GOOD: Applying noise reduction with a moderate threshold
cleaned = spectral_gate_denoise(
    audio, threshold_factor=1.5  # Moderate threshold
)
# Always listen and verify quality
```

**Problem**: Applying noise reduction too aggressively causes loss of naturalness in the audio (artifact generation). Set thresholds conservatively and always verify quality with human ears.

### 9.3 Anti-Pattern: Lack of Memory Management

```python
# BAD: Holding all audio files in memory at once
all_audios = [load_audio(f) for f in glob("*.wav")]  # Memory explosion

# GOOD: Stream processing with a generator
def process_files(file_list):
    for f in file_list:
        audio = load_audio(f)
        result = pipeline.process(audio)
        yield result
        del audio, result  # Explicit release
```

### 9.4 Anti-Pattern: Incorrect Normalization Order

```python
# BAD: Normalizing before noise reduction (noise gets amplified)
pipeline = AudioPipeline()
pipeline.add_step("normalize", peak_normalize)  # Amplifies noise along with signal
pipeline.add_step("denoise", spectral_gate_denoise)  # Amplified noise is harder to remove

# GOOD: Normalize after noise reduction
pipeline = AudioPipeline()
pipeline.add_step("denoise", spectral_gate_denoise)  # Remove noise first
pipeline.add_step("normalize", peak_normalize)  # Normalize the clean signal
```

**Problem**: If the order of normalization and noise reduction is wrong, noise gets amplified and becomes difficult to remove. The standard preprocessing order is "resampling -> noise reduction -> normalization."

---

## 10. FAQ

### Q1: When should I use librosa vs. soundfile?

**A**: `librosa` excels at analysis and feature extraction, with automatic resampling and mono conversion during loading. `soundfile` specializes in high-speed I/O and is suited for reading and writing large files. A common approach is to use `librosa` for preprocessing and analysis, and `soundfile` for saving final output.

### Q2: How should I determine buffer size for real-time processing?

**A**: Buffer size is a trade-off between latency and throughput. For speech recognition, `chunk_size = sample_rate * 0.1` (100ms) is common. WebRTC uses 20ms as the standard. If the buffer is too small, processing overhead increases; if too large, response latency grows.

### Q3: GPU vs. CPU -- which should I use for audio processing?

**A**: Preprocessing (resampling, FFT, noise reduction) is sufficiently fast on CPU. GPUs are advantageous for deep learning-based noise reduction (RNNoise, DeepFilterNet) and large-scale batch feature extraction. For real-time processing, CPU processing often provides more stable latency.

### Q4: How effective is audio data augmentation?

**A**: SpecAugment has been reported to improve speech recognition WER by a relative 10-20%. Adding noise significantly improves robustness in real-world environments. However, excessive augmentation can destabilize training, so it is common to limit augmentation to 2-5x the original data. A combination of time stretching (0.8-1.2x) and pitch shifting (-2 to +2 semitones) is effective.

### Q5: How should I determine the loudness normalization target value?

**A**: Recommended values vary by distribution platform. Spotify/YouTube: -14 LUFS, Apple Music: -16 LUFS, TV/Radio: -24 LUFS (EBU R128). Podcasts: -16 to -14 LUFS. Use `lufs_normalize` to match the target and limit True Peak to not exceed -1 dBTP.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping straight to applications. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently utilized in everyday development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Category | Key Points |
|----------|-----------|
| Basic Settings | 16kHz/16bit/mono is standard for speech recognition |
| Preprocessing | Follow the order: resampling -> noise reduction -> normalization |
| Feature Extraction | MFCC (13-40 dimensions) + delta is versatile; Whisper-based models use mel spectrograms |
| Noise Reduction | Spectral gating is the baseline; DNN-based methods for high-quality requirements |
| VAD | Energy-based is fast; Silero VAD is highly accurate |
| Format | Convert robustly with ffmpeg; unify with API presets |
| Data Augmentation | SpecAugment + noise addition + time stretching is effective |
| Streaming | Real-time support via overlapping chunk processing |
| Pipeline | Design steps to be separable and composable, ensuring testability |

---

## Recommended Next Guides

- [00-audio-apis.md](./00-audio-apis.md) -- Audio AI API Comparison & Integration
- [02-real-time-audio.md](./02-real-time-audio.md) -- Real-Time Audio Processing
- [../00-fundamentals/03-stt-technologies.md](../00-fundamentals/03-stt-technologies.md) -- STT Technology Details

---

## References

1. librosa Official Documentation -- https://librosa.org/doc/
2. Jurafsky & Martin, "Speech and Language Processing" -- https://web.stanford.edu/~jurafsky/slp3/
3. soundfile Documentation -- https://python-soundfile.readthedocs.io/
4. ffmpeg Official Documentation -- https://ffmpeg.org/documentation.html
5. RNNoise: Learning Noise Suppression -- https://jmvalin.ca/demo/rnnoise/
6. Park, D.S., et al. (2019). "SpecAugment: A Simple Data Augmentation Method for ASR" -- Data augmentation method by Google Brain
7. Schroeter, H., et al. (2022). "DeepFilterNet: A Low Complexity Speech Enhancement Framework" -- High-quality DNN-based noise reduction
