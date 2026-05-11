# Stem Separation — Demucs, LALAL.AI

> An explanation of the principles and practice of stem separation technology that splits music tracks into vocals, drums, bass, and other components

## What You Will Learn

1. Technical principles of stem separation (spectrogram masking, neural network separation)
2. Features and use cases of major tools (Demucs, LALAL.AI, Spleeter)
3. Implementation patterns and quality improvement techniques for stem separation


## Prerequisites

Before reading this guide, familiarity with the following topics will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of the content in [Music Generation — Suno, Udio, MusicGen](./00-music-generation.md)

---

## 1. Technical Foundations of Stem Separation

### 1.1 Concept of Stem Separation

```
Basic Concept of Stem Separation
==================================================

Input: Mixed track (2ch stereo)
  ┌─────────────────────────────────┐
  │  Vocals + Drums + Bass          │
  │  + Guitar + Piano + ...         │
  │  = Single waveform              │
  └──────────────┬──────────────────┘
                 │
        Stem Separation Model
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Vocals │ │ Drums  │ │ Bass   │
│        │ │        │ │        │
└────────┘ └────────┘ └────────┘
                 │
                 ▼
           ┌────────┐
           │ Other  │
           │        │
           │Guitar  │
           │  etc.  │
           └────────┘

Ideal: mix = vocal + drums + bass + other
Reality: mix ≈ vocal + drums + bass + other + artifacts
==================================================
```

### 1.2 Evolution of Technical Approaches

```
Evolution of Stem Separation Technology
==================================================

Generation 1: Spectrogram Masking
  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
  │ STFT │───→│ Mask │───→│Apply │───→│ ISTFT│
  └──────┘    │Estim.│    │      │    └──────┘
              └──────┘    └──────┘
  * Simple but limited quality

Generation 2: U-Net Based (Spleeter, Open-Unmix)
  ┌──────┐    ┌──────────┐    ┌──────┐
  │Spec- │───→│U-Net     │───→│ Mask │
  │tro-  │    │(Encoder- │    │Apply │
  │gram  │    │ Decoder) │    │      │
  └──────┘    └──────────┘    └──────┘
  * Processing in the spectrogram domain

Generation 3: Hybrid (Demucs v4 / HTDemucs)
  ┌──────┐    ┌────────────────┐    ┌──────┐
  │Wave- │───→│Temporal Branch │───→│      │
  │form  │    │(Time-domain CNN)│   │Merge │
  └──────┘    └────────────────┘    │      │
  ┌──────┐    ┌────────────────┐    │      │
  │Spec- │───→│Spectral Branch │───→│      │
  │tro-  │    │(Transformer)   │    │      │
  │gram  │    └────────────────┘    └──────┘
  * Hybrid of time-domain + frequency-domain
  * Global context understanding via Transformer
==================================================
```

### 1.3 Details of Masking Techniques

The core technology of stem separation is masking. A mask corresponding to each source is estimated from the input spectrogram, and each source is separated by applying the mask.

```python
import numpy as np
import torch

class MaskingMethods:
    """Masking techniques for stem separation"""

    @staticmethod
    def ideal_binary_mask(source_stft, mix_stft):
        """
        Ideal Binary Mask (IBM)
        - Determines the dominant source at each time-frequency bin
        - Mask values are 0 or 1
        - Simplest approach but prone to artifacts
        """
        source_mag = np.abs(source_stft)
        mix_mag = np.abs(mix_stft)
        # Set bins where the source accounts for more than 50% of the mix to 1
        mask = (source_mag > 0.5 * mix_mag).astype(float)
        return mask

    @staticmethod
    def ideal_ratio_mask(source_stft, mix_stft):
        """
        Ideal Ratio Mask (IRM)
        - Uses the ratio of the source at each bin as the mask value
        - Soft mask with more natural sound quality than IBM
        - Continuous values between 0 and 1
        """
        source_mag = np.abs(source_stft)
        mix_mag = np.abs(mix_stft) + 1e-10
        mask = source_mag / mix_mag
        return np.clip(mask, 0, 1)

    @staticmethod
    def wiener_filter_mask(sources_stfts, mix_stft):
        """
        Wiener Filter Mask
        - Computes masks based on the ratio of power spectra across all sources
        - The most theoretically justified masking technique
        - Also used in Demucs post-processing
        """
        powers = [np.abs(s) ** 2 for s in sources_stfts]
        total_power = sum(powers) + 1e-10
        masks = [p / total_power for p in powers]
        return masks

    @staticmethod
    def complex_ideal_ratio_mask(source_stft, mix_stft):
        """
        Complex Ideal Ratio Mask (cIRM)
        - Mask that includes phase information
        - Real and imaginary parts are estimated separately
        - Improves phase reconstruction quality
        """
        mix_mag = np.abs(mix_stft) + 1e-10
        # Complex mask = source / mix
        mask_real = np.real(source_stft) / np.real(mix_stft + 1e-10)
        mask_imag = np.imag(source_stft) / np.imag(mix_stft + 1e-10)
        return mask_real, mask_imag


class SpectrogramProcessor:
    """Base class for spectrogram processing"""

    def __init__(self, n_fft: int = 4096, hop_length: int = 1024,
                 sr: int = 44100):
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.sr = sr

    def compute_stft(self, audio: np.ndarray) -> np.ndarray:
        """Compute STFT"""
        window = np.hanning(self.n_fft)
        n_frames = (len(audio) - self.n_fft) // self.hop_length + 1
        stft = np.zeros((self.n_fft // 2 + 1, n_frames), dtype=complex)

        for i in range(n_frames):
            start = i * self.hop_length
            frame = audio[start:start + self.n_fft] * window
            stft[:, i] = np.fft.rfft(frame)

        return stft

    def inverse_stft(self, stft: np.ndarray) -> np.ndarray:
        """Inverse STFT computation (Griffin-Lim based)"""
        n_frames = stft.shape[1]
        output_length = self.n_fft + (n_frames - 1) * self.hop_length
        output = np.zeros(output_length)
        window_sum = np.zeros(output_length)
        window = np.hanning(self.n_fft)

        for i in range(n_frames):
            start = i * self.hop_length
            frame = np.fft.irfft(stft[:, i])
            output[start:start + self.n_fft] += frame * window
            window_sum[start:start + self.n_fft] += window ** 2

        # Window normalization
        mask = window_sum > 1e-8
        output[mask] /= window_sum[mask]
        return output

    def apply_mask(self, mix_stft: np.ndarray,
                   mask: np.ndarray) -> np.ndarray:
        """Apply mask"""
        return mix_stft * mask

    def separate_with_masks(self, mix_audio: np.ndarray,
                            masks: list) -> list:
        """Perform source separation using masks"""
        mix_stft = self.compute_stft(mix_audio)
        separated = []
        for mask in masks:
            source_stft = self.apply_mask(mix_stft, mask)
            source_audio = self.inverse_stft(source_stft)
            separated.append(source_audio)
        return separated
```

### 1.4 Demucs v4 (HTDemucs) Architecture Details

```
HTDemucs (Hybrid Transformer Demucs) Internal Structure
==================================================

Input: Stereo waveform (2, T)
      │
      ├─────────────────────────────────────┐
      │                                     │
      ▼                                     ▼
┌─────────────┐                    ┌─────────────┐
│ Temporal     │                    │ Spectral    │
│ Encoder      │                    │ Encoder     │
│ (1D Conv)    │                    │ (2D Conv)   │
│              │                    │             │
│ x5 layers    │                    │ x5 layers   │
│ ch: 48→384   │                    │ STFT →      │
│ stride: 4    │                    │ Spectrogram │
│              │                    │ processing  │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       ▼                                   ▼
┌─────────────────────────────────────────────┐
│              Cross-Domain                    │
│              Transformer                     │
│                                             │
│  ┌──────────────┐    ┌──────────────┐       │
│  │ Self-Attention│    │ Cross-Attention│     │
│  │ (Temporal)   │←──→│ (Spectral)   │       │
│  └──────────────┘    └──────────────┘       │
│                                             │
│  * Cross-referencing between time and       │
│    frequency domains                        │
│  * Global context understanding             │
│  * 5 Transformer blocks                     │
└───────────┬─────────────────┬───────────────┘
            │                 │
            ▼                 ▼
┌──────────────┐    ┌──────────────┐
│ Temporal     │    │ Spectral    │
│ Decoder      │    │ Decoder     │
│ (1D DeConv)  │    │ (2D DeConv) │
│              │    │             │
│ x5 layers    │    │ x5 layers   │
│ Skip Connect │    │ Skip Connect│
└──────┬───────┘    └──────┬──────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────┐
│ Output Merge                  │
│ temporal_out + spectral_out  │
│ → 4 sources x (2, T)         │
│ [drums, bass, other, vocals] │
└──────────────────────────────┘

Model Parameters:
- Parameter count: ~83M (htdemucs) / ~83M (htdemucs_ft)
- Input: 44.1kHz stereo
- Processing: 7.8-second segments (default)
- Overlap: 25%
==================================================
```

---

## 2. Demucs Implementation

### 2.1 Basic Usage

```python
import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model

# Load Demucs v4 (HTDemucs) model
model = get_model("htdemucs_ft")  # Fine-tuned version
model.eval()

# Use GPU (if available)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

# Load audio file
waveform, sr = torchaudio.load("song.wav")

# Resample (Demucs expects 44.1kHz)
if sr != model.samplerate:
    resampler = torchaudio.transforms.Resample(sr, model.samplerate)
    waveform = resampler(waveform)

# Perform stem separation
with torch.no_grad():
    waveform = waveform.unsqueeze(0).to(device)  # Add batch dimension
    sources = apply_model(
        model,
        waveform,
        shifts=1,       # Number of random shifts (improves quality, reduces speed)
        overlap=0.25,   # Overlap ratio
    )

# Retrieve results
# sources shape: (batch, n_sources, channels, samples)
source_names = model.sources  # ['drums', 'bass', 'other', 'vocals']

for i, name in enumerate(source_names):
    source_audio = sources[0, i]  # (channels, samples)
    torchaudio.save(f"{name}.wav", source_audio.cpu(), model.samplerate)
    print(f"Saved: {name}.wav")
```

### 2.2 CLI Usage

```python
# Command-line usage (conceptual code)

"""
# Basic separation
demucs song.wav

# Specify model
demucs --model htdemucs_ft song.wav

# 2-stem separation (vocals/accompaniment only)
demucs --two-stems vocals song.wav

# Specify output directory
demucs -o ./output song.wav

# Quality improvement options
demucs --shifts 5 --overlap 0.5 song.wav

# MP3 output
demucs --mp3 --mp3-bitrate 320 song.wav

# Batch processing
demucs song1.wav song2.wav song3.wav
"""

# Batch processing with a Python script
import subprocess
from pathlib import Path

def batch_separate(input_dir: str, output_dir: str, model: str = "htdemucs_ft"):
    """Stem-separate all audio files in a directory"""
    input_path = Path(input_dir)
    audio_files = list(input_path.glob("*.wav")) + list(input_path.glob("*.mp3"))

    for audio_file in audio_files:
        print(f"Processing: {audio_file.name}")
        cmd = [
            "demucs",
            "--model", model,
            "--out", output_dir,
            "--shifts", "3",
            str(audio_file),
        ]
        subprocess.run(cmd, check=True)
        print(f"Done: {audio_file.name}")

batch_separate("./songs", "./separated")
```

### 2.3 Custom Pipeline

```python
import torch
import torchaudio
import numpy as np

class StemSeparationPipeline:
    """Stem separation + post-processing pipeline"""

    def __init__(self, model_name="htdemucs_ft"):
        from demucs.pretrained import get_model
        self.model = get_model(model_name)
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

    def separate(self, audio_path: str) -> dict:
        """Separation + quality improvement"""
        from demucs.apply import apply_model

        waveform, sr = torchaudio.load(audio_path)
        if sr != self.model.samplerate:
            resampler = torchaudio.transforms.Resample(sr, self.model.samplerate)
            waveform = resampler(waveform)

        with torch.no_grad():
            sources = apply_model(
                self.model,
                waveform.unsqueeze(0).to(self.device),
                shifts=3,
                overlap=0.25,
            )

        results = {}
        for i, name in enumerate(self.model.sources):
            stem = sources[0, i].cpu()
            # Post-processing: noise gate + normalization
            stem = self._noise_gate(stem, threshold_db=-60)
            stem = self._normalize(stem, target_db=-3)
            results[name] = stem

        return results

    def _noise_gate(self, audio, threshold_db=-60):
        """Noise gate: silence audio below the threshold"""
        threshold = 10 ** (threshold_db / 20)
        mask = torch.abs(audio) > threshold
        return audio * mask.float()

    def _normalize(self, audio, target_db=-3):
        """Peak normalization"""
        peak = torch.abs(audio).max()
        if peak > 0:
            target_level = 10 ** (target_db / 20)
            audio = audio * (target_level / peak)
        return audio

    def karaoke_mix(self, audio_path: str) -> torch.Tensor:
        """Generate a karaoke version (vocal removal)"""
        stems = self.separate(audio_path)
        # Mix everything except vocals
        karaoke = stems["drums"] + stems["bass"] + stems["other"]
        return karaoke
```

### 2.4 Advanced Separation Pipeline

```python
import torch
import torchaudio
import numpy as np
from pathlib import Path
from typing import Dict, Optional, Tuple

class AdvancedStemSeparation:
    """Advanced stem separation pipeline (maximum quality)"""

    def __init__(self, model_name: str = "htdemucs_ft",
                 device: str = "auto"):
        from demucs.pretrained import get_model
        self.model = get_model(model_name)
        self.model.eval()

        if device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        self.model.to(self.device)

    def separate_high_quality(self, audio_path: str,
                               shifts: int = 5,
                               overlap: float = 0.5) -> Dict[str, torch.Tensor]:
        """
        High-quality separation mode

        Parameters:
            shifts: Number of random shifts (higher = better quality but slower)
                    - 1: Fast (standard quality)
                    - 3: Balanced (recommended)
                    - 5-10: Best quality (slow)
            overlap: Overlap ratio between segments
                    - 0.25: Standard
                    - 0.5: High quality
                    - 0.75: Best quality (very slow)
        """
        from demucs.apply import apply_model

        waveform, sr = torchaudio.load(audio_path)

        # Mono → stereo conversion
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)

        if sr != self.model.samplerate:
            resampler = torchaudio.transforms.Resample(sr, self.model.samplerate)
            waveform = resampler(waveform)

        with torch.no_grad():
            sources = apply_model(
                self.model,
                waveform.unsqueeze(0).to(self.device),
                shifts=shifts,
                overlap=overlap,
                progress=True,
            )

        results = {}
        for i, name in enumerate(self.model.sources):
            results[name] = sources[0, i].cpu()

        return results

    def separate_with_wiener(self, audio_path: str) -> Dict[str, torch.Tensor]:
        """
        Separation with Wiener filter post-processing

        Applies a Wiener filter to Demucs output to reduce
        bleed (leakage between stems)
        """
        # Standard separation
        stems = self.separate_high_quality(audio_path, shifts=3)

        # Wiener filter post-processing
        mix, sr = torchaudio.load(audio_path)
        if sr != self.model.samplerate:
            resampler = torchaudio.transforms.Resample(sr, self.model.samplerate)
            mix = resampler(mix)

        refined = self._apply_wiener_filter(mix, stems)
        return refined

    def _apply_wiener_filter(self, mix: torch.Tensor,
                              stems: Dict[str, torch.Tensor],
                              n_fft: int = 4096) -> Dict[str, torch.Tensor]:
        """Improve separation quality with Wiener filtering"""
        # STFT of the mix
        mix_stft = torch.stft(
            mix, n_fft=n_fft, return_complex=True
        )

        # STFT of each stem
        stem_stfts = {}
        for name, stem in stems.items():
            stem_stfts[name] = torch.stft(
                stem, n_fft=n_fft, return_complex=True
            )

        # Compute Wiener filter masks
        powers = {name: torch.abs(stft) ** 2
                  for name, stft in stem_stfts.items()}
        total_power = sum(powers.values()) + 1e-10

        refined = {}
        for name in stems:
            mask = powers[name] / total_power
            refined_stft = mix_stft * mask

            # Inverse STFT
            refined_audio = torch.istft(
                refined_stft, n_fft=n_fft
            )
            refined[name] = refined_audio

        return refined

    def ensemble_separate(self, audio_path: str,
                           models: list = None) -> Dict[str, torch.Tensor]:
        """
        Ensemble separation (combining results from multiple models)

        Separates with multiple models and averages the results
        to reduce artifacts from individual models
        """
        if models is None:
            models = ["htdemucs", "htdemucs_ft"]

        all_stems = []
        for model_name in models:
            from demucs.pretrained import get_model
            model = get_model(model_name)
            model.eval().to(self.device)

            waveform, sr = torchaudio.load(audio_path)
            if sr != model.samplerate:
                resampler = torchaudio.transforms.Resample(sr, model.samplerate)
                waveform = resampler(waveform)

            from demucs.apply import apply_model
            with torch.no_grad():
                sources = apply_model(
                    model,
                    waveform.unsqueeze(0).to(self.device),
                    shifts=3,
                    overlap=0.25,
                )
            all_stems.append(sources)

        # Ensemble (averaging)
        ensemble = sum(all_stems) / len(all_stems)

        results = {}
        source_names = self.model.sources
        for i, name in enumerate(source_names):
            results[name] = ensemble[0, i].cpu()

        return results


class StemQualityAnalyzer:
    """Analysis tool for separation quality"""

    @staticmethod
    def compute_sdr(reference: np.ndarray, estimated: np.ndarray) -> float:
        """Compute SDR (Signal-to-Distortion Ratio)"""
        # Align lengths
        min_len = min(len(reference), len(estimated))
        reference = reference[:min_len]
        estimated = estimated[:min_len]

        noise = estimated - reference
        sdr = 10 * np.log10(
            np.sum(reference ** 2) / (np.sum(noise ** 2) + 1e-10)
        )
        return sdr

    @staticmethod
    def compute_sir(reference: np.ndarray, estimated: np.ndarray,
                    interference: np.ndarray) -> float:
        """Compute SIR (Source-to-Interference Ratio)"""
        min_len = min(len(reference), len(estimated), len(interference))
        reference = reference[:min_len]
        estimated = estimated[:min_len]
        interference = interference[:min_len]

        sir = 10 * np.log10(
            np.sum(reference ** 2) / (np.sum(interference ** 2) + 1e-10)
        )
        return sir

    @staticmethod
    def compute_sar(reference: np.ndarray, estimated: np.ndarray) -> float:
        """Compute SAR (Source-to-Artifact Ratio)"""
        min_len = min(len(reference), len(estimated))
        reference = reference[:min_len]
        estimated = estimated[:min_len]

        # Artifact = estimated - reference - interference
        artifact = estimated - reference
        sar = 10 * np.log10(
            np.sum(reference ** 2) / (np.sum(artifact ** 2) + 1e-10)
        )
        return sar

    def full_evaluation(self, reference_stems: dict,
                        estimated_stems: dict) -> dict:
        """Quality evaluation for all stems"""
        results = {}
        for name in reference_stems:
            if name in estimated_stems:
                ref = reference_stems[name]
                est = estimated_stems[name]
                if isinstance(ref, torch.Tensor):
                    ref = ref.numpy()
                if isinstance(est, torch.Tensor):
                    est = est.numpy()
                # Convert to mono
                if ref.ndim == 2:
                    ref = ref.mean(axis=0)
                if est.ndim == 2:
                    est = est.mean(axis=0)

                results[name] = {
                    "SDR (dB)": round(self.compute_sdr(ref, est), 2),
                    "SAR (dB)": round(self.compute_sar(ref, est), 2),
                }
        return results
```

### 2.5 Memory-Efficient Processing of Long Tracks

```python
import torch
import torchaudio
import numpy as np
from typing import Optional

class LongTrackSeparator:
    """Memory-efficient stem separation for long tracks"""

    def __init__(self, model_name: str = "htdemucs_ft",
                 max_memory_gb: float = 4.0):
        from demucs.pretrained import get_model
        self.model = get_model(model_name)
        self.model.eval()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.max_memory_gb = max_memory_gb

    def _estimate_chunk_size(self, channels: int, sr: int) -> int:
        """Estimate optimal chunk size based on available memory"""
        # Estimation based on GPU VRAM (approximate)
        if self.device.type == "cuda":
            total_mem = torch.cuda.get_device_properties(0).total_memory
            available = min(total_mem * 0.7, self.max_memory_gb * 1e9)
        else:
            available = self.max_memory_gb * 1e9

        # Memory usage per sample (approximate: ~4x model overhead)
        bytes_per_sample = channels * 4 * 4  # float32 * 4x overhead
        max_samples = int(available / bytes_per_sample)

        # Clamp to between 5 and 30 seconds
        max_seconds = 30
        min_seconds = 5
        chunk_seconds = np.clip(max_samples / sr, min_seconds, max_seconds)

        return int(chunk_seconds * sr)

    def separate_long_track(self, audio_path: str,
                             output_dir: str,
                             overlap_seconds: float = 2.0) -> dict:
        """
        Separate long tracks by splitting into chunks

        Parameters:
            audio_path: Input audio path
            output_dir: Output directory
            overlap_seconds: Overlap between chunks (seconds)
        """
        from demucs.apply import apply_model
        from pathlib import Path

        waveform, sr = torchaudio.load(audio_path)
        if sr != self.model.samplerate:
            resampler = torchaudio.transforms.Resample(sr, self.model.samplerate)
            waveform = resampler(waveform)
            sr = self.model.samplerate

        total_samples = waveform.shape[-1]
        total_seconds = total_samples / sr
        print(f"Track length: {total_seconds:.1f} seconds")

        chunk_size = self._estimate_chunk_size(waveform.shape[0], sr)
        overlap = int(overlap_seconds * sr)
        print(f"Chunk size: {chunk_size / sr:.1f}s, "
              f"Overlap: {overlap / sr:.1f}s")

        # Output buffers
        n_sources = len(self.model.sources)
        output = torch.zeros(n_sources, waveform.shape[0], total_samples)
        weight = torch.zeros(total_samples)

        # Chunk processing
        pos = 0
        chunk_idx = 0
        while pos < total_samples:
            end = min(pos + chunk_size, total_samples)
            chunk = waveform[:, pos:end]

            print(f"Chunk {chunk_idx}: {pos/sr:.1f}s - {end/sr:.1f}s")

            with torch.no_grad():
                sources = apply_model(
                    self.model,
                    chunk.unsqueeze(0).to(self.device),
                    shifts=1,
                    overlap=0.25,
                )

            # Crossfade window
            chunk_len = end - pos
            fade = self._make_crossfade_window(chunk_len, overlap)

            for i in range(n_sources):
                output[i, :, pos:end] += sources[0, i].cpu() * fade
            weight[pos:end] += fade

            # Free memory
            del sources
            if self.device.type == "cuda":
                torch.cuda.empty_cache()

            pos += chunk_size - overlap
            chunk_idx += 1

        # Weight normalization
        weight = torch.clamp(weight, min=1e-8)
        for i in range(n_sources):
            output[i] /= weight

        # Save
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        results = {}
        for i, name in enumerate(self.model.sources):
            path = output_path / f"{name}.wav"
            torchaudio.save(str(path), output[i], sr)
            results[name] = str(path)
            print(f"Saved: {path}")

        return results

    def _make_crossfade_window(self, length: int, overlap: int) -> torch.Tensor:
        """Generate a crossfade window"""
        window = torch.ones(length)
        if overlap > 0 and overlap < length:
            # Fade in
            fade_in = torch.linspace(0, 1, overlap)
            window[:overlap] = fade_in
            # Fade out
            fade_out = torch.linspace(1, 0, overlap)
            window[-overlap:] = fade_out
        return window
```

---

## 3. Using Cloud Services

### 3.1 LALAL.AI API

```python
import requests
import time

class LALALClient:
    """LALAL.AI stem separation client (conceptual)"""

    BASE_URL = "https://www.lalal.ai/api/v1"

    def __init__(self, api_key: str):
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def separate(self, audio_path: str, stem_type: str = "vocals") -> dict:
        """
        Perform stem separation

        stem_type options:
        - vocals: Vocals/accompaniment
        - drums: Drum separation
        - bass: Bass separation
        - electric_guitar: Electric guitar separation
        - piano: Piano separation
        - synthesizer: Synthesizer separation
        """
        # Step 1: Upload file
        with open(audio_path, "rb") as f:
            upload_resp = requests.post(
                f"{self.BASE_URL}/upload",
                files={"file": f},
                data={"stem": stem_type},
                headers=self.headers,
            )
        task_id = upload_resp.json()["task_id"]

        # Step 2: Wait for processing to complete
        while True:
            status = requests.get(
                f"{self.BASE_URL}/status/{task_id}",
                headers=self.headers,
            ).json()
            if status["state"] == "done":
                return status["result"]
            elif status["state"] == "error":
                raise Exception(f"Separation failed: {status['error']}")
            time.sleep(2)
```

### 3.2 Using Spleeter

```python
class SpleeterPipeline:
    """
    Stem separation with Spleeter (Deezer)

    Features:
    - TensorFlow-based
    - Very fast (faster than real-time even without GPU)
    - 2stems/4stems/5stems models
    - Quality is inferior to Demucs but excels in speed
    """

    def __init__(self, n_stems: int = 2):
        """
        n_stems: Number of stems to separate
        - 2: vocals/accompaniment
        - 4: vocals/drums/bass/other
        - 5: vocals/drums/bass/piano/other
        """
        from spleeter.separator import Separator
        self.separator = Separator(f'spleeter:{n_stems}stems')
        self.n_stems = n_stems

    def separate(self, audio_path: str, output_dir: str = "./output"):
        """Perform separation"""
        self.separator.separate_to_file(
            audio_path,
            output_dir,
            codec="wav",
            bitrate="320k",
        )

    def separate_to_dict(self, audio_path: str) -> dict:
        """Get separation results as NumPy arrays"""
        import numpy as np
        from spleeter.audio.adapter import AudioAdapter

        adapter = AudioAdapter.default()
        waveform, rate = adapter.load(audio_path, sample_rate=44100)

        prediction = self.separator.separate(waveform)
        return prediction  # {"vocals": np.ndarray, "accompaniment": np.ndarray, ...}

    def quick_vocal_extract(self, audio_path: str, output_path: str):
        """Quick vocal extraction"""
        import soundfile as sf
        results = self.separate_to_dict(audio_path)
        vocals = results["vocals"]
        sf.write(output_path, vocals, 44100)
```

### 3.3 Post-Processing Pipeline for Separation Results

```python
import numpy as np
import torch
import torchaudio

class StemPostProcessor:
    """Post-processing for separated stems"""

    def __init__(self, sr: int = 44100):
        self.sr = sr

    def remove_bleed(self, stem: np.ndarray, mix: np.ndarray,
                     other_stems: list, threshold_db: float = -40) -> np.ndarray:
        """
        Bleed removal (removal of leakage from other stems)

        Uses spectral gating to suppress energy in time-frequency bins
        dominated by other stems
        """
        n_fft = 4096
        hop = 1024

        # Compute STFT
        from scipy.signal import stft as scipy_stft, istft as scipy_istft

        _, _, stem_stft = scipy_stft(stem, fs=self.sr, nperseg=n_fft,
                                      noverlap=n_fft - hop)
        stem_power = np.abs(stem_stft) ** 2

        # Total power of other stems
        other_power = np.zeros_like(stem_power)
        for other in other_stems:
            _, _, other_stft = scipy_stft(other, fs=self.sr, nperseg=n_fft,
                                           noverlap=n_fft - hop)
            other_power += np.abs(other_stft) ** 2

        # Mask: only pass bins where the stem is dominant
        ratio = stem_power / (stem_power + other_power + 1e-10)
        threshold = 10 ** (threshold_db / 10)
        mask = np.where(ratio > 0.3, 1.0, ratio / 0.3)

        # Apply mask
        cleaned_stft = stem_stft * mask

        # Inverse STFT
        _, cleaned = scipy_istft(cleaned_stft, fs=self.sr, nperseg=n_fft,
                                  noverlap=n_fft - hop)

        return cleaned[:len(stem)]

    def smooth_transitions(self, stem: np.ndarray,
                           fade_ms: float = 5.0) -> np.ndarray:
        """
        Edge smoothing

        Mitigates artifacts from separation (abrupt onsets/offsets)
        with gentle fades
        """
        fade_samples = int(fade_ms * self.sr / 1000)
        if fade_samples < 2:
            return stem

        # Detect active audio regions
        threshold = np.max(np.abs(stem)) * 0.01
        is_active = np.abs(stem) > threshold

        # Detect onset/offset edges
        edges = np.diff(is_active.astype(int))
        onsets = np.where(edges == 1)[0]
        offsets = np.where(edges == -1)[0]

        result = stem.copy()

        # Apply fade-in
        for onset in onsets:
            start = max(0, onset - fade_samples // 2)
            end = min(len(stem), onset + fade_samples // 2)
            fade = np.linspace(0, 1, end - start)
            result[start:end] *= fade

        # Apply fade-out
        for offset in offsets:
            start = max(0, offset - fade_samples // 2)
            end = min(len(stem), offset + fade_samples // 2)
            fade = np.linspace(1, 0, end - start)
            result[start:end] *= fade

        return result

    def phase_align(self, stem: np.ndarray,
                    reference: np.ndarray) -> np.ndarray:
        """
        Phase alignment

        Compares the phase of a separated stem with the original mix
        and corrects phase shifts in the stem
        """
        min_len = min(len(stem), len(reference))
        stem = stem[:min_len]
        reference = reference[:min_len]

        # Estimate optimal delay via cross-correlation
        correlation = np.correlate(stem, reference, mode='full')
        delay = np.argmax(np.abs(correlation)) - len(stem) + 1

        # Delay correction
        if delay > 0:
            aligned = np.concatenate([np.zeros(delay), stem[:-delay]])
        elif delay < 0:
            aligned = np.concatenate([stem[-delay:], np.zeros(-delay)])
        else:
            aligned = stem

        # Polarity check (correct if inverted)
        corr_normal = np.sum(aligned * reference)
        corr_inverted = np.sum(-aligned * reference)
        if corr_inverted > corr_normal:
            aligned = -aligned

        return aligned
```

---

## 4. Comparison Tables

### 4.1 Major Stem Separation Tools Comparison

| Item | Demucs v4 | Spleeter | LALAL.AI | iZotope RX |
|------|----------|----------|---------|------------|
| Type | OSS | OSS | SaaS | Commercial |
| Quality (SDR) | 9.0+ dB | 5.9 dB | 8.5+ dB | 8.0+ dB |
| Stems | 4/6 | 2/4/5 | Up to 8 | Flexible |
| Speed | Medium | Fast | Medium | Medium |
| GPU Required | Recommended | No | No | No |
| Offline | Yes | Yes | No | Yes |
| Cost | Free | Free | Pay-per-use | $399+ |
| API Access | Python | Python | REST | Plugin |

### 4.2 Recommended Tools by Use Case

| Use Case | Recommended | Reason |
|----------|-------------|--------|
| Acapella extraction for DJs | Demucs v4 | Best quality, free |
| Karaoke creation | Demucs / LALAL.AI | Vocal removal quality |
| Remix materials | Demucs v4 (6stems) | Fine-grained instrument separation |
| Podcast audio separation | Spleeter | Fast, 2stems is sufficient |
| Professional mastering | iZotope RX | Maximum flexibility |
| Batch processing | Demucs CLI | Easy to script |
| Non-engineers | LALAL.AI | Simple Web UI |

### 4.3 Demucs Model Variations

| Model Name | Parameters | Stems | SDR (Vocals) | Features |
|-----------|-----------|-------|-------------|----------|
| htdemucs | 83M | 4 | 8.5 dB | Standard model |
| htdemucs_ft | 83M | 4 | 9.0 dB | Fine-tuned version |
| htdemucs_6s | 83M | 6 | 7.8 dB | Adds guitar & piano |
| mdx_extra | - | 4 | 8.3 dB | MDX model (lightweight) |
| mdx_extra_q | - | 4 | 8.0 dB | MDX quantized (lightest) |

### 4.4 Processing Speed Comparison (5-minute stereo track)

| Model | GPU (RTX 3060) | GPU (RTX 4090) | CPU (i7-13700) | Apple M2 |
|-------|----------------|----------------|---------------|----------|
| htdemucs_ft | 25s | 12s | 3 min | 1.5 min |
| htdemucs_6s | 30s | 15s | 4 min | 2 min |
| Spleeter 2stems | 5s | 3s | 15s | 10s |
| Spleeter 5stems | 12s | 6s | 40s | 25s |

---

## 5. Anti-Patterns

### 5.1 Anti-Pattern: Over-Trusting Separation Quality

```python
# BAD: Using separation results as-is
def bad_remix(song_path):
    stems = separate(song_path)
    # Problem: Vocal stem has accompaniment bleed
    # Problem: Drum stem contains ghost sounds
    return mix(stems["vocals"] * 1.5, stems["drums"], stems["bass"])

# GOOD: Include artifact mitigation
def good_remix(song_path):
    stems = separate(song_path)

    # 1. Remove bleed from vocals
    vocals = apply_spectral_gate(stems["vocals"], threshold=-40)

    # 2. Reduce artifacts with crossfade processing
    vocals = smooth_edges(vocals, fade_ms=10)

    # 3. Phase alignment (correct phase shift from separation)
    drums = phase_align(stems["drums"], reference=original_mix)

    return mix(vocals * 1.5, drums, stems["bass"], stems["other"])
```

### 5.2 Anti-Pattern: Poor Memory Management

```python
# BAD: Loading an entire long track into memory
def bad_separate_long(audio_path):
    audio, sr = torchaudio.load(audio_path)  # 10 min = ~100MB
    # Crashes due to insufficient GPU VRAM
    sources = model(audio.unsqueeze(0).cuda())

# GOOD: Chunk processing for memory control
def good_separate_long(audio_path, chunk_seconds=30, overlap_seconds=5):
    """Process long tracks by splitting into chunks"""
    audio, sr = torchaudio.load(audio_path)
    chunk_size = chunk_seconds * sr
    overlap = overlap_seconds * sr

    all_sources = []
    pos = 0
    while pos < audio.shape[-1]:
        end = min(pos + chunk_size, audio.shape[-1])
        chunk = audio[:, pos:end]

        with torch.no_grad():
            sources = apply_model(model, chunk.unsqueeze(0).cuda())
            all_sources.append(sources.cpu())

        # Free memory
        torch.cuda.empty_cache()
        pos += chunk_size - overlap

    # Merge with crossfading at overlap regions
    return crossfade_merge(all_sources, overlap)
```

### 5.3 Anti-Pattern: Wrong Model Selection

```python
# BAD: Using a model unsuited for the purpose
def bad_model_selection():
    # Using Spleeter for voice conversion preprocessing → insufficient quality
    spleeter_result = spleeter_2stems("song.wav")
    rvc_convert(spleeter_result["vocals"])  # Input quality is too low

    # Using htdemucs_ft + shifts=10 for large batch processing → too slow
    for song in glob("*.wav"):
        demucs_separate(song, model="htdemucs_ft", shifts=10)

# GOOD: Select model and settings based on use case
def good_model_selection(use_case: str, audio_path: str):
    """Automatically select the optimal model and settings for the use case"""
    configs = {
        "voice_conversion": {
            "model": "htdemucs_ft",
            "shifts": 3,
            "two_stems": "vocals",
            "reason": "Vocal quality is top priority, 2-stem for efficiency",
        },
        "batch_karaoke": {
            "model": "htdemucs",
            "shifts": 1,
            "two_stems": "vocals",
            "reason": "Speed-focused, quality is sufficient",
        },
        "remix_production": {
            "model": "htdemucs_6s",
            "shifts": 5,
            "two_stems": None,
            "reason": "Per-instrument separation, best quality",
        },
        "quick_preview": {
            "model": "mdx_extra_q",
            "shifts": 1,
            "two_stems": "vocals",
            "reason": "Fastest preview",
        },
    }

    config = configs.get(use_case, configs["batch_karaoke"])
    print(f"Selected: {config['model']} ({config['reason']})")
    return config
```

### 5.4 Anti-Pattern: Inconsistent Stem Reconstruction

```python
# BAD: Summing separated stems does not match the original
def bad_reconstruct(stems):
    # Process each stem individually then combine
    vocals = normalize(stems["vocals"])      # Volume change
    drums = eq(stems["drums"])               # EQ change
    bass = compress(stems["bass"])           # Dynamics change
    other = stems["other"]

    remix = vocals + drums + bass + other
    # Problem: Sum differs significantly from the original
    return remix

# GOOD: Maintain consistency during separate → process → reconstruct
def good_reconstruct(stems, mix_original):
    """Maintain consistency with the original after separation and processing"""
    vocals = normalize(stems["vocals"])
    drums = eq(stems["drums"])
    bass = compress(stems["bass"])
    other = stems["other"]

    remix = vocals + drums + bass + other

    # Residual correction (compensate for separation error)
    residual = mix_original - sum(stems.values())
    remix += residual  # Add back the separation error

    # Match loudness to the original
    original_rms = np.sqrt(np.mean(mix_original ** 2))
    remix_rms = np.sqrt(np.mean(remix ** 2))
    if remix_rms > 0:
        remix = remix * (original_rms / remix_rms)

    return remix
```

---

## 6. Practical Use Cases

### 6.1 Automatic Karaoke Video Generation

```python
import torch
import torchaudio
import numpy as np
import soundfile as sf
from pathlib import Path

class KaraokeGenerator:
    """Automated karaoke version generation pipeline"""

    def __init__(self):
        self.pipeline = StemSeparationPipeline(model_name="htdemucs_ft")

    def create_karaoke(self, input_path: str, output_dir: str,
                       keep_backing_vocals: bool = False) -> dict:
        """
        Generate a karaoke version

        Parameters:
            keep_backing_vocals: If True, keep chorus/harmony vocals
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Stem separation
        stems = self.pipeline.separate(input_path)

        # Karaoke mix (without vocals)
        karaoke = stems["drums"] + stems["bass"] + stems["other"]

        if keep_backing_vocals:
            # Remove only main vocals (keep chorus)
            # Remove only center-panned vocals
            vocals = stems["vocals"]
            mid = (vocals[0] + vocals[1]) / 2  # Mono component = main vocals
            side = (vocals[0] - vocals[1]) / 2  # Stereo component = chorus/harmony
            # Add back the chorus component
            chorus = torch.stack([side, -side])
            karaoke += chorus * 0.7

        # Vocal guide version (vocals at reduced volume)
        guide = karaoke + stems["vocals"] * 0.15

        # Save
        sr = self.pipeline.model.samplerate
        results = {
            "karaoke": str(output_path / "karaoke.wav"),
            "guide": str(output_path / "guide.wav"),
            "vocals": str(output_path / "vocals.wav"),
            "instrumental": str(output_path / "instrumental.wav"),
        }

        torchaudio.save(results["karaoke"], karaoke, sr)
        torchaudio.save(results["guide"], guide, sr)
        torchaudio.save(results["vocals"], stems["vocals"], sr)
        torchaudio.save(results["instrumental"], karaoke, sr)

        return results


class DJToolkit:
    """DJ-oriented stem separation toolkit"""

    def __init__(self):
        self.pipeline = StemSeparationPipeline(model_name="htdemucs_ft")

    def extract_acapella(self, song_path: str, output_path: str,
                          quality: str = "high"):
        """Extract acapella"""
        stems = self.pipeline.separate(song_path)
        vocals = stems["vocals"]

        # Post-processing based on quality level
        if quality == "high":
            # Noise gate + spectral cleaning
            vocals = self._spectral_clean(vocals)

        torchaudio.save(output_path, vocals, self.pipeline.model.samplerate)

    def create_drum_break(self, song_path: str, output_path: str):
        """Extract drum break"""
        stems = self.pipeline.separate(song_path)
        drums = stems["drums"]

        # Enhance drum stem quality
        drums = self._enhance_drums(drums)

        torchaudio.save(output_path, drums, self.pipeline.model.samplerate)

    def create_loop_pack(self, song_path: str, output_dir: str,
                          bpm: float = None):
        """Generate a loop pack (split each stem in BPM-synced segments)"""
        stems = self.pipeline.separate(song_path)
        sr = self.pipeline.model.samplerate

        # BPM detection (if not specified)
        if bpm is None:
            import librosa
            mix_np = stems["drums"].numpy().mean(axis=0)
            tempo, _ = librosa.beat.beat_track(y=mix_np, sr=sr)
            bpm = float(tempo)

        # Samples per bar
        bar_samples = int(4 * 60 / bpm * sr)  # 4 beats = 1 bar

        output_path = Path(output_dir)
        for name, stem in stems.items():
            stem_dir = output_path / name
            stem_dir.mkdir(parents=True, exist_ok=True)

            n_bars = stem.shape[-1] // bar_samples
            for i in range(min(n_bars, 16)):  # Up to 16 bars
                start = i * bar_samples
                end = start + bar_samples
                loop = stem[:, start:end]

                loop_path = stem_dir / f"loop_{i+1:02d}.wav"
                torchaudio.save(str(loop_path), loop, sr)

        print(f"BPM: {bpm:.1f}, exported {n_bars} bars")

    def _spectral_clean(self, audio):
        """Spectral cleaning"""
        return audio  # Placeholder

    def _enhance_drums(self, drums):
        """Enhance drum stem quality"""
        return drums  # Placeholder
```

### 6.2 Music Education and Practice Support

```python
class MusicPracticeHelper:
    """Music education and practice support tool"""

    def __init__(self):
        self.pipeline = StemSeparationPipeline(model_name="htdemucs_ft")

    def create_practice_tracks(self, song_path: str,
                                instrument: str,
                                output_dir: str) -> dict:
        """
        Generate practice tracks

        - Solo track of the specified instrument only
        - Minus-one track with the specified instrument removed
        - Mix with adjustable volume for the specified instrument
        """
        stems = self.pipeline.separate(song_path)
        sr = self.pipeline.model.samplerate

        stem_map = {
            "vocal": "vocals",
            "guitar": "other",  # Included in "other" with the 4-stem model
            "bass": "bass",
            "drums": "drums",
        }

        target_stem = stem_map.get(instrument, "vocals")
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        results = {}

        # Solo track (specified instrument only)
        solo = stems[target_stem]
        solo_path = output_path / f"{instrument}_solo.wav"
        torchaudio.save(str(solo_path), solo, sr)
        results["solo"] = str(solo_path)

        # Minus-one (specified instrument removed)
        minus_one = sum(s for n, s in stems.items() if n != target_stem)
        minus_path = output_path / f"minus_{instrument}.wav"
        torchaudio.save(str(minus_path), minus_one, sr)
        results["minus_one"] = str(minus_path)

        # Volume-adjusted versions (instrument at 25%, 50%, 75%)
        for level in [0.25, 0.50, 0.75]:
            mixed = minus_one + solo * level
            level_path = output_path / f"{instrument}_{int(level*100)}pct.wav"
            torchaudio.save(str(level_path), mixed, sr)
            results[f"level_{int(level*100)}"] = str(level_path)

        return results

    def create_slow_practice(self, song_path: str,
                              tempo_factor: float = 0.75,
                              output_path: str = "slow_practice.wav"):
        """Generate a slowed-down practice version (pitch preserved)"""
        import librosa

        stems = self.pipeline.separate(song_path)
        sr = self.pipeline.model.samplerate

        # Change tempo for each stem (pitch preserved)
        slowed_stems = {}
        for name, stem in stems.items():
            stem_np = stem.numpy()
            slowed_channels = []
            for ch in range(stem_np.shape[0]):
                slowed = librosa.effects.time_stretch(
                    stem_np[ch], rate=tempo_factor
                )
                slowed_channels.append(slowed)
            slowed_stems[name] = torch.tensor(np.array(slowed_channels))

        # Remix
        slow_mix = sum(slowed_stems.values())
        torchaudio.save(output_path, slow_mix, sr)

        return output_path
```

---

## 6. FAQ

### Q1: What metrics are used to measure stem separation quality?

SDR (Signal-to-Distortion Ratio) is the most widely used metric, expressed in dB. Higher values indicate better separation quality, and Demucs v4 achieves approximately 9 dB or more. Other metrics include SIR (Source-to-Interference Ratio, measuring leakage from other sources) and SAR (Source-to-Artifact Ratio, measuring the amount of artifacts). However, numerical quality and perceptual quality do not always align, so listening evaluation is ultimately important as well.

### Q2: Can instruments other than vocals (guitar, piano, etc.) be separated individually?

The Demucs v4 6-stem model (htdemucs_6s) can separate into 6 tracks: drums, bass, vocals, guitar, piano, and other. LALAL.AI supports even finer separation, handling up to 8 types including electric guitar, acoustic guitar, piano, and synthesizer. However, the quality of individual stems tends to decrease as the number of separated stems increases.

### Q3: Is real-time stem separation possible?

As of 2025, high-quality real-time stem separation remains difficult. Demucs v4 requires 3-5x real-time processing even with GPU. However, near-real-time processing (1-2 second latency) is possible using lightweight models (Spleeter, Open-Unmix) or Demucs streaming mode. DJ software (djay, Traktor) includes built-in real-time stem separation, achieving practical use through a trade-off between quality and speed.

### Q4: How can I improve separation results when quality is poor?

Several techniques are available: (1) Increase the shifts parameter (3-10): improves quality through random shift averaging. (2) Increase overlap (0.25 to 0.5): reduces artifacts at segment boundaries. (3) Model ensemble: average results from htdemucs and htdemucs_ft. (4) Wiener filter post-processing: apply Wiener filtering to separation results to remove bleed. (5) Improve input quality: use high-bitrate sources and perform noise removal beforehand.

### Q5: How can stem separation be integrated into a music production workflow?

Integration methods with DAWs (Digital Audio Workstations) include: (1) VST/AU plugins: use plugins such as iZotope RX or Spectralayers. (2) Batch pre-processing: separate entire folders with Demucs CLI and import results into the DAW. (3) Python integration: automate the separation, post-processing, and export pipeline with Python scripts, outputting directly to DAW session folders. (4) Remote server: build an API on a GPU server and execute separation via HTTP requests from the DAW.

### Q6: To what extent can stem-separated audio be used from a copyright perspective?

Under copyright law, stem separation of existing music may constitute "reproduction." While personal practice and study purposes are often permitted as fair use, publishing, distributing, or commercially using separation results requires permission from the copyright holder. Licensing is mandatory when distributing results as samples or remixes. Use in DJ performances depends on the copyright laws of the country/region and the venue's licensing agreements.

---


## FAQ

### Q1: What is the most important point for learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying how things work.

### Q2: What common mistakes do beginners make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently utilized in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------------|
| Technology Evolution | Masking → U-Net → Hybrid (time + frequency) |
| Demucs v4 | Best quality OSS. Supports 4-stem/6-stem |
| Quality Metrics | SDR 9dB+ is the current state of the art |
| Key Limitations | Bleed (leakage), artifacts, phase shift |
| Post-Processing | Noise gate, spectral gate, phase alignment are important |
| Memory Management | Split long tracks into chunks + crossfade merging |
| Model Selection | Choose htdemucs_ft/htdemucs_6s/Spleeter based on use case |
| Wiener Filter | Can further improve separation quality in post-processing |

## Recommended Next Reads

- [02-audio-effects.md](./02-audio-effects.md) — AI Audio Effects (EQ, noise removal)
- [00-music-generation.md](./00-music-generation.md) — Combining with music generation
- [../03-development/01-audio-processing.md](../03-development/01-audio-processing.md) — Implementation with librosa/torchaudio

## References

1. Rouard, S., et al. (2023). "Hybrid Transformers for Music Source Separation" — HTDemucs paper. Music source separation with Hybrid Transformers
2. Defossez, A. (2021). "Hybrid Spectrogram and Waveform Source Separation" — Demucs v3 paper. Hybrid spectrogram + waveform approach
3. Hennequin, R., et al. (2020). "Spleeter: a fast and efficient music source separation tool" — Spleeter paper. Lightweight separation tool by Deezer
4. Stoter, F.R., et al. (2019). "Open-Unmix - A Reference Implementation for Music Source Separation" — Open-Unmix. Open-source reference implementation
5. Vincent, E., et al. (2006). "Performance measurement in blind audio source separation" — Paper defining SDR/SIR/SAR evaluation metrics
6. Uhlich, S., et al. (2017). "Improving music source separation based on deep neural networks through data augmentation and network blending" — Quality improvement through data augmentation and network blending
