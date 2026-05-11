# Audio Fundamentals — Sampling, Frequency, and Fourier Transform

> Understand the physical and mathematical foundations of digital audio and build a solid base in signal processing for audio AI

## What You Will Learn in This Chapter

1. Physical properties of sound and principles of digitization (sampling theorem, quantization)
2. Fundamentals of frequency analysis (Fourier transform, spectrogram, mel scale)
3. Audio feature extraction techniques (MFCC, mel spectrogram) and implementation


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Audio AI Overview — History and Current State of Speech Synthesis/Recognition](./00-audio-ai-overview.md)

---

## 1. Physical Properties of Sound

### 1.1 Basic Parameters of Sound Waves

```
Basic Elements of Sound Waves
==================================================

  Amplitude
  ^
  |    ,--,        ,--,
  |   /    \      /    \
  |  /      \    /      \       -> Time (t)
--+-/--------\--/--------\------
  |          \/            \/
  |
  |  |<-- 1 Period (T) -->|
  |
  |  Frequency f = 1/T [Hz]
  |  Amplitude A: Loudness (volume)
  |  Phase phi: Starting position of the waveform
==================================================
```

### 1.2 Three Elements of Sound

```python
import numpy as np

# Representing the three elements of sound as signals

def generate_tone(frequency, amplitude, duration, sample_rate=44100):
    """
    Three elements of sound:
    - Frequency: Pitch [Hz]
    - Amplitude: Loudness [0.0 - 1.0]
    - Waveform: Determines timbre
    """
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

    # Pure tone (sine wave)
    sine_wave = amplitude * np.sin(2 * np.pi * frequency * t)

    # Tone with harmonics (changes the timbre)
    harmonics = (
        amplitude * np.sin(2 * np.pi * frequency * t) +          # Fundamental frequency
        amplitude * 0.5 * np.sin(2 * np.pi * 2 * frequency * t) + # 2nd harmonic
        amplitude * 0.25 * np.sin(2 * np.pi * 3 * frequency * t)  # 3rd harmonic
    )

    return sine_wave, harmonics

# Generate a tone at A4 = 440Hz
pure_tone, rich_tone = generate_tone(440, 0.8, 1.0)
print(f"Pure tone sample count: {len(pure_tone)}")
print(f"Harmonic-rich sample count: {len(rich_tone)}")
```

---

## 2. Digital Audio Fundamentals

### 2.1 Sampling

```
Analog-to-Digital Conversion (ADC)
==================================================

Analog waveform:
  ^
  |   ,--,    ,--,
  |  /   \  /   \
  | /     \/     \
--+-------------------> t

Sampling (discretization):
  ^
  |   *        *
  |  *  *    *  *
  | *    *  *    *
--+--*----*--*----*---> t
  | ^    ^
  | Sampling interval = 1/fs

Quantization (precision determined by bit depth):
  ^ 16bit = 65,536 levels
  | #        #
  | #  #    #  #
  | #    #  #    #
--+--#----#--#----#---> t
==================================================

Nyquist theorem: fs >= 2 x fmax
  Human audible range ~20kHz -> fs >= 40kHz
  CD quality: 44.1kHz / 16bit
```

### 2.2 Common Sample Rates and Their Uses

```python
# Common sample rates and their uses

sample_rates = {
    8000:  "Telephone audio (G.711) / Minimum requirement for speech recognition",
    16000: "Standard for speech recognition (Whisper recommended) / VoIP",
    22050: "Low-quality speech synthesis / AM broadcast equivalent",
    44100: "CD quality / Standard for music distribution",
    48000: "DVD / Video audio / Professional audio standard",
    96000: "Hi-res audio / Studio recording",
}

# Bit depth and dynamic range
bit_depths = {
    8:  {"levels": 256,    "dynamic_range_dB": 48,  "use": "Low-quality audio"},
    16: {"levels": 65536,  "dynamic_range_dB": 96,  "use": "CD / Standard audio"},
    24: {"levels": 16777216, "dynamic_range_dB": 144, "use": "Professional audio"},
    32: {"levels": "float32", "dynamic_range_dB": 192, "use": "Internal processing"},
}

# Data size calculation
def calc_audio_size(sample_rate, bit_depth, channels, duration_sec):
    """Calculate the data size of uncompressed audio"""
    bytes_per_sample = bit_depth // 8
    total_bytes = sample_rate * bytes_per_sample * channels * duration_sec
    return total_bytes / (1024 * 1024)  # MB

# Size of 1 minute of stereo audio
cd_quality = calc_audio_size(44100, 16, 2, 60)
print(f"CD quality, 1 minute: {cd_quality:.1f} MB")  # Approximately 10.1 MB
```

---

## 3. Fourier Transform

### 3.1 Time Domain and Frequency Domain

```
Concept of the Fourier Transform
==================================================

Time Domain                Frequency Domain
(Waveform)                (Spectrum)
                  FFT
  ^ ,,  ,,   ---------->    ^
  |/  \/  \                 | |
  |        /\               | |  |
--+-----------> t   --------+-|--|--|---> f
                            |440 880 1320
                    IFFT       Hz  Hz  Hz
                <----------
                            Fundamental + harmonic components

Key relationships:
- Complex waveform in time domain = sum of simple components in frequency domain
- Short sound -> wide frequency bandwidth (uncertainty principle)
- Periodic sound -> discrete spectral lines
==================================================
```

### 3.2 FFT Implementation

```python
import numpy as np

def compute_fft(signal, sample_rate):
    """
    Frequency analysis using Fast Fourier Transform (FFT)

    Parameters:
        signal: Input signal (1D array)
        sample_rate: Sample rate [Hz]

    Returns:
        freqs: Frequency axis [Hz]
        magnitude: Amplitude at each frequency
    """
    n = len(signal)
    # Compute FFT
    fft_result = np.fft.rfft(signal)
    # Amplitude spectrum (normalized)
    magnitude = np.abs(fft_result) / n * 2
    # Frequency axis
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)

    return freqs, magnitude

# Composite wave of 440Hz + 880Hz
sr = 44100
t = np.linspace(0, 1.0, sr, endpoint=False)
signal = 0.7 * np.sin(2 * np.pi * 440 * t) + 0.3 * np.sin(2 * np.pi * 880 * t)

freqs, magnitude = compute_fft(signal, sr)

# Peak detection
peak_indices = np.where(magnitude > 0.1)[0]
for idx in peak_indices:
    print(f"Frequency: {freqs[idx]:.0f} Hz, Amplitude: {magnitude[idx]:.2f}")
# Output: Frequency: 440 Hz, Amplitude: 0.70
#         Frequency: 880 Hz, Amplitude: 0.30
```

### 3.3 STFT (Short-Time Fourier Transform) and Spectrogram

```python
import numpy as np

def compute_stft(signal, sample_rate, window_size=2048, hop_size=512):
    """
    Short-Time Fourier Transform (STFT)
    - Divides the signal into small windows (frames) and applies FFT
    - Generates a 2D time-frequency representation (spectrogram)

    Parameters:
        signal: Input signal
        sample_rate: Sample rate
        window_size: Window size (number of FFT points)
        hop_size: Window shift amount
    """
    # Hanning window
    window = np.hanning(window_size)

    # Number of frames
    n_frames = (len(signal) - window_size) // hop_size + 1

    # Initialize STFT matrix
    stft_matrix = np.zeros((window_size // 2 + 1, n_frames), dtype=complex)

    for i in range(n_frames):
        start = i * hop_size
        frame = signal[start:start + window_size] * window
        stft_matrix[:, i] = np.fft.rfft(frame)

    # Power spectrogram (dB scale)
    power_spec = np.abs(stft_matrix) ** 2
    log_spec = 10 * np.log10(power_spec + 1e-10)

    return log_spec

# Meaning of parameters
stft_params = {
    "window_size": "Determines frequency resolution (larger -> higher freq resolution, lower time resolution)",
    "hop_size": "Determines time resolution (smaller -> higher time resolution, higher computation cost)",
    "window_type": "Controls spectral leakage (Hanning, Hamming, Blackman, etc.)",
}
```

---

## 4. Mel Scale and MFCC

### 4.1 Mel Scale Conversion

```python
import numpy as np

def hz_to_mel(hz):
    """Hz -> Mel scale conversion"""
    return 2595 * np.log10(1 + hz / 700)

def mel_to_hz(mel):
    """Mel scale -> Hz conversion"""
    return 700 * (10 ** (mel / 2595) - 1)

# The mel scale reflects human auditory perception
# It is nearly linear at low frequencies and logarithmically compressed at high frequencies
frequencies = [100, 200, 500, 1000, 2000, 4000, 8000, 16000]
for f in frequencies:
    m = hz_to_mel(f)
    print(f"{f:6d} Hz -> {m:7.1f} mel")

# Example output:
#    100 Hz ->   150.5 mel
#    200 Hz ->   283.2 mel
#    500 Hz ->   607.5 mel
#   1000 Hz ->  1000.0 mel  <- 1000Hz is the reference
#   2000 Hz ->  1500.0 mel
#   4000 Hz ->  2146.1 mel
#   8000 Hz ->  2840.0 mel
#  16000 Hz ->  3564.5 mel

def compute_mel_filterbank(n_filters, n_fft, sample_rate, fmin=0, fmax=None):
    """Generate a mel filterbank"""
    if fmax is None:
        fmax = sample_rate / 2

    # Place filter center frequencies at equal intervals on the mel scale
    mel_min = hz_to_mel(fmin)
    mel_max = hz_to_mel(fmax)
    mel_points = np.linspace(mel_min, mel_max, n_filters + 2)
    hz_points = mel_to_hz(mel_points)

    # Convert to FFT bins
    bins = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)

    # Triangular filterbank
    filterbank = np.zeros((n_filters, n_fft // 2 + 1))
    for i in range(n_filters):
        for j in range(bins[i], bins[i + 1]):
            filterbank[i, j] = (j - bins[i]) / (bins[i + 1] - bins[i])
        for j in range(bins[i + 1], bins[i + 2]):
            filterbank[i, j] = (bins[i + 2] - j) / (bins[i + 2] - bins[i + 1])

    return filterbank
```

### 4.2 MFCC (Mel-Frequency Cepstral Coefficients)

```python
import numpy as np

def compute_mfcc(signal, sample_rate, n_mfcc=13, n_filters=40, n_fft=2048):
    """
    Complete MFCC computation pipeline

    Step 1: Pre-emphasis (boost high-frequency components)
    Step 2: Frame segmentation + window function
    Step 3: FFT -> Power spectrum
    Step 4: Apply mel filterbank
    Step 5: Logarithmic compression
    Step 6: DCT (Discrete Cosine Transform)
    """
    # Step 1: Pre-emphasis
    emphasized = np.append(signal[0], signal[1:] - 0.97 * signal[:-1])

    # Step 2: Frame segmentation
    frame_size = n_fft
    hop_size = frame_size // 4
    n_frames = (len(emphasized) - frame_size) // hop_size + 1

    frames = np.zeros((n_frames, frame_size))
    for i in range(n_frames):
        start = i * hop_size
        frames[i] = emphasized[start:start + frame_size] * np.hanning(frame_size)

    # Step 3: Power spectrum
    power_spectrum = np.abs(np.fft.rfft(frames, n=n_fft)) ** 2 / n_fft

    # Step 4: Apply mel filterbank
    mel_filters = compute_mel_filterbank(n_filters, n_fft, sample_rate)
    mel_spectrum = np.dot(power_spectrum, mel_filters.T)

    # Step 5: Logarithmic compression
    log_mel = np.log(mel_spectrum + 1e-10)

    # Step 6: DCT -> MFCC
    from scipy.fft import dct
    mfcc = dct(log_mel, type=2, axis=1, norm='ortho')[:, :n_mfcc]

    return mfcc

# Usage example (conceptual)
# mfcc = compute_mfcc(audio_signal, 16000)
# print(f"MFCC shape: {mfcc.shape}")  # (number of frames, 13)
```

---

## 5. Comparison Tables

### 5.1 Audio Feature Comparison

| Feature | Dimensions | Use Case | Reflects Human Hearing | Computation Cost |
|---------|-----------|----------|----------------------|-----------------|
| Raw waveform | Number of samples | WaveNet input | No | Minimal |
| FFT spectrum | N/2+1 | Frequency analysis | No | Low |
| Mel spectrogram | 80-128 | TTS input | High | Medium |
| MFCC | 13-40 | STT input | High | Medium |
| Chromagram | 12 | Music analysis | Moderate | Medium |
| Pitch | 1 | Prosody analysis | High | Low |

### 5.2 Audio Format Comparison

| Format | Compression | Bitrate (reference) | Quality | Primary Use |
|--------|------------|-------------------|---------|------------|
| WAV | Uncompressed | ~1411 kbps (CD) | Highest | Editing/Processing |
| FLAC | Lossless | ~800-1000 kbps | Highest | Archival |
| MP3 | Lossy | 128-320 kbps | High | Music distribution |
| AAC | Lossy | 128-256 kbps | High | Streaming |
| OGG Vorbis | Lossy | 128-320 kbps | High | Games/Web |
| Opus | Lossy | 6-510 kbps | Highest (low bandwidth) | WebRTC/VoIP |
| PCM (raw) | Uncompressed | Variable | Highest | Internal processing |

---

## 6. Anti-Patterns

### 6.1 Anti-Pattern: Ignoring Sample Rate Mismatch

```python
# BAD: Feeding audio to a model without checking the sample rate
def bad_process(audio_file):
    import soundfile as sf
    audio, sr = sf.read(audio_file)
    # Whisper expects 16kHz, but the audio is still at 44.1kHz
    result = whisper_model.transcribe(audio)  # Accuracy degradation or error
    return result

# GOOD: Explicitly resample
def good_process(audio_file, target_sr=16000):
    import soundfile as sf
    import librosa

    audio, sr = sf.read(audio_file)
    print(f"Original sample rate: {sr} Hz")

    if sr != target_sr:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
        print(f"Resampled: {sr} -> {target_sr} Hz")

    result = whisper_model.transcribe(audio)
    return result
```

### 6.2 Anti-Pattern: Inappropriate Window Size Selection

```python
# BAD: Using a fixed window size without considering the audio characteristics
def bad_stft(signal, sr):
    # Window size too large -> time resolution degrades
    # Transient sounds (plosives, etc.) cannot be detected
    return np.fft.rfft(signal[:16384])  # ~370ms @ 44.1kHz

# GOOD: Choose window size based on the use case
def good_stft(signal, sr, analysis_type="speech"):
    """
    Recommended window sizes:
    - Speech recognition: 25ms window / 10ms hop (400/160 @ 16kHz)
    - Music analysis: 46ms window / 12ms hop (2048/512 @ 44.1kHz)
    - Pitch detection: Longer (50-100ms) to ensure frequency resolution
    """
    params = {
        "speech": {"window_ms": 25, "hop_ms": 10},
        "music":  {"window_ms": 46, "hop_ms": 12},
        "pitch":  {"window_ms": 64, "hop_ms": 16},
    }

    p = params[analysis_type]
    window_size = int(sr * p["window_ms"] / 1000)
    hop_size = int(sr * p["hop_ms"] / 1000)

    # Round to the nearest power of 2 (for FFT efficiency)
    n_fft = 2 ** int(np.ceil(np.log2(window_size)))

    print(f"Window size: {window_size} ({p['window_ms']}ms), n_fft: {n_fft}")
    # Compute STFT...
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be mindful of algorithm computational complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|---------|
| Initialization error | Configuration file issues | Check the configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify the executing user's permissions, review settings |
| Data inconsistency | Concurrency conflicts | Introduce locking mechanisms, implement transaction management |

### Debugging Procedure

1. **Check the error message**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Verify step by step**: Use log output or a debugger to verify hypotheses
5. **Fix and regression test**: After fixing, also run tests on related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance problems:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Examine disk and network I/O conditions
4. **Check concurrent connections**: Review connection pool status

| Problem Type | Diagnostic Tool | Solution |
|-------------|----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

Below is a summary of decision criteria for technology selection.

| Criterion | When to prioritize | When compromise is acceptable |
|-----------|-------------------|------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed users |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
+--------------------------------------------------+
|          Architecture Selection Flow              |
+--------------------------------------------------+
|                                                   |
|  (1) Team size?                                   |
|    +-- Small (1-5 people) -> Monolith             |
|    +-- Large (10+ people) -> Go to (2)            |
|                                                   |
|  (2) Deployment frequency?                        |
|    +-- Once a week or less -> Monolith + modules  |
|    +-- Daily/multiple times -> Go to (3)          |
|                                                   |
|  (3) Team independence?                           |
|    +-- High -> Microservices                      |
|    +-- Moderate -> Modular monolith               |
|                                                   |
+--------------------------------------------------+
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze them from the following perspectives:

**1. Short-term vs. Long-term Cost**
- A quick approach in the short term may become technical debt in the long term
- Conversely, over-engineering has high short-term costs and can delay the project

**2. Consistency vs. Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables the right tool for the job but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Template for recording design decisions
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "+" if c['type'] == 'positive' else "!"
            md += f"- [{icon}] {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 7. FAQ

### Q1: Is a higher sample rate always better?

Not necessarily. According to the Nyquist theorem, the highest recordable frequency is half the sample rate. Since the human audible range is approximately 20kHz, 44.1kHz (CD quality) is sufficient. For speech recognition, 16kHz is the standard, and going higher does not improve accuracy. Increasing the sample rate increases data size and computation cost, so it is important to choose an appropriate value for your use case.

### Q2: Should I use mel spectrograms or MFCCs?

In recent deep learning-based models (Whisper, VITS, etc.), directly using mel spectrograms as input is the mainstream approach. MFCCs have fewer dimensions and better computational efficiency, making them useful for traditional STT systems or resource-constrained environments. In general, neural networks can extract richer information from mel spectrograms, so mel spectrograms are recommended when sufficient computational resources are available.

### Q3: How should I choose the type of window function?

The Hanning window (Hann window) is generally recommended. The Hanning window has small sidelobes and minimal spectral leakage, making it suitable for most audio processing tasks. The Hamming window is similar to the Hanning window but does not reach zero at the endpoints, making it commonly used in speech recognition. The Blackman window has even smaller sidelobes but widens the main lobe, reducing frequency resolution. Unless there is a specific reason, choose the Hanning window.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What common mistakes do beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Sound waves | Three elements: frequency (pitch), amplitude (loudness), waveform (timbre) |
| Sampling | Nyquist theorem: fs >= 2 * fmax. 16kHz is standard for speech recognition |
| Quantization | 16bit (CD) is sufficient. float32 recommended for internal processing |
| Fourier Transform | Converts time domain to frequency domain. Computed in O(NlogN) with FFT |
| STFT | FFT on short-time windows. Generates 2D time-frequency representation |
| Mel scale | Frequency scale reflecting human auditory characteristics |
| MFCC | Compact features obtained from mel spectrogram + DCT |

## Recommended Next Reads

- [02-tts-technologies.md](./02-tts-technologies.md) — Details on TTS technologies
- [03-stt-technologies.md](./03-stt-technologies.md) — Details on STT technologies
- [../03-development/01-audio-processing.md](../03-development/01-audio-processing.md) — Implementation with librosa/torchaudio

## References

1. Smith, S.W. "The Scientist and Engineer's Guide to Digital Signal Processing" — The definitive text on digital signal processing, covering FFT and filtering fundamentals
2. Muller, M. (2015). "Fundamentals of Music Processing" — Fundamentals of music information processing, with detailed coverage of STFT, chromagram, and MFCC
3. Rabiner, L.R. & Schafer, R.W. (2010). "Theory and Applications of Digital Speech Processing" — A classic on speech signal processing, from sampling to LPC analysis
4. Stevens, S.S. & Volkmann, J. (1940). "The Relation of Pitch to Frequency" — The original paper on the mel scale, research on frequency perception based on human auditory characteristics

---

## 8. Advanced Audio Analysis Techniques

### 8.1 Pitch Detection Algorithms

```python
import numpy as np

def autocorrelation_pitch(signal, sample_rate, fmin=80, fmax=400):
    """
    Pitch (fundamental frequency F0) detection using autocorrelation

    Parameters:
        signal: Input signal (one frame)
        sample_rate: Sample rate
        fmin: Minimum frequency [Hz] (default: 80Hz = low male voice)
        fmax: Maximum frequency [Hz] (default: 400Hz = high female voice)

    Returns:
        f0: Estimated fundamental frequency [Hz]. 0 if unvoiced
    """
    # Convert lag range to sample counts
    lag_min = int(sample_rate / fmax)
    lag_max = int(sample_rate / fmin)

    # Compute autocorrelation
    n = len(signal)
    autocorr = np.correlate(signal, signal, mode='full')
    autocorr = autocorr[n-1:]  # Positive lags only

    # Normalize
    autocorr = autocorr / autocorr[0]

    # Search for peak within the specified range
    search_range = autocorr[lag_min:lag_max]
    if len(search_range) == 0:
        return 0.0

    peak_idx = np.argmax(search_range) + lag_min
    peak_value = autocorr[peak_idx]

    # Voiced/unvoiced decision (threshold)
    if peak_value < 0.3:
        return 0.0  # Unvoiced

    f0 = sample_rate / peak_idx
    return f0


def yin_pitch_detection(signal, sample_rate, fmin=80, fmax=500, threshold=0.1):
    """
    Pitch detection using the YIN algorithm
    - More accurate than the autocorrelation method
    - Proposed by Cheveigne & Kawahara in 2002

    Features:
    - Cumulative mean normalized difference function
    - Fewer octave errors
    """
    # Step 1: Difference function
    tau_min = int(sample_rate / fmax)
    tau_max = int(sample_rate / fmin)

    n = len(signal)
    diff = np.zeros(tau_max)

    for tau in range(1, tau_max):
        diff[tau] = np.sum((signal[:n-tau] - signal[tau:n]) ** 2)

    # Step 2: Cumulative Mean Normalized Difference Function (CMNDF)
    cmndf = np.ones(tau_max)
    running_sum = 0.0
    for tau in range(1, tau_max):
        running_sum += diff[tau]
        cmndf[tau] = diff[tau] / (running_sum / tau) if running_sum > 0 else 1.0

    # Step 3: Search for the first dip below the threshold
    for tau in range(tau_min, tau_max):
        if cmndf[tau] < threshold:
            # Parabolic interpolation for improved accuracy
            if tau > 0 and tau < tau_max - 1:
                alpha = cmndf[tau - 1]
                beta = cmndf[tau]
                gamma = cmndf[tau + 1]
                peak = tau + 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma)
            else:
                peak = tau
            return sample_rate / peak

    return 0.0  # Pitch detection failed


# Application example of pitch detection
def analyze_voice_characteristics(audio, sr):
    """Analyze voice characteristics (pitch, formants, energy)"""
    frame_size = int(0.025 * sr)  # 25ms
    hop_size = int(0.010 * sr)    # 10ms

    f0_values = []
    energy_values = []

    for i in range(0, len(audio) - frame_size, hop_size):
        frame = audio[i:i + frame_size]

        # Pitch detection
        f0 = yin_pitch_detection(frame, sr)
        f0_values.append(f0)

        # Energy
        energy = np.sqrt(np.mean(frame ** 2))
        energy_values.append(energy)

    # Compute F0 statistics for voiced frames only
    voiced_f0 = [f for f in f0_values if f > 0]

    return {
        "mean_f0": np.mean(voiced_f0) if voiced_f0 else 0,
        "std_f0": np.std(voiced_f0) if voiced_f0 else 0,
        "min_f0": np.min(voiced_f0) if voiced_f0 else 0,
        "max_f0": np.max(voiced_f0) if voiced_f0 else 0,
        "voicing_ratio": len(voiced_f0) / len(f0_values),
        "mean_energy": np.mean(energy_values),
    }
```

### 8.2 Formant Analysis

```python
import numpy as np
from scipy.signal import lfilter, lpc

def extract_formants(signal, sample_rate, n_formants=4, lpc_order=12):
    """
    Formant extraction using LPC (Linear Predictive Coding)

    Formants: Resonant frequencies of the vocal tract
    - F1: Related to jaw opening (degree of aperture) (~300-800Hz)
    - F2: Related to tongue front-back position (~800-2500Hz)
    - F3: Related to lip rounding (~2500-3500Hz)

    Parameters:
        signal: Speech signal (one frame)
        sample_rate: Sample rate
        n_formants: Number of formants to extract
        lpc_order: LPC order (typically 2 + sample_rate/1000)
    """
    # Pre-emphasis (high-frequency boost)
    emphasized = np.append(signal[0], signal[1:] - 0.97 * signal[:-1])

    # Apply Hamming window
    windowed = emphasized * np.hamming(len(emphasized))

    # Compute LPC coefficients
    a = lpc(windowed, lpc_order)

    # Find roots of the LPC polynomial
    roots = np.roots(a)

    # Select only roots with positive imaginary parts (one from each conjugate pair)
    roots = roots[np.imag(roots) >= 0]

    # Convert angles to frequencies
    angles = np.arctan2(np.imag(roots), np.real(roots))
    frequencies = angles * (sample_rate / (2 * np.pi))

    # Compute bandwidths
    bandwidths = -0.5 * sample_rate * np.log(np.abs(roots)) / np.pi

    # Filter valid formants
    valid = (frequencies > 90) & (frequencies < sample_rate / 2 - 50) & (bandwidths < 400)
    frequencies = frequencies[valid]
    bandwidths = bandwidths[valid]

    # Sort by frequency
    sorted_idx = np.argsort(frequencies)
    frequencies = frequencies[sorted_idx][:n_formants]
    bandwidths = bandwidths[sorted_idx][:n_formants]

    return frequencies, bandwidths

# Reference formant values for Japanese vowels
japanese_vowel_formants = {
    "a": {"F1": 800, "F2": 1200, "characteristic": "Largest degree of aperture"},
    "i": {"F1": 300, "F2": 2300, "characteristic": "High F2 (tongue forward)"},
    "u": {"F1": 350, "F2": 1100, "characteristic": "Rounded lips"},
    "e": {"F1": 500, "F2": 1900, "characteristic": "Moderate aperture"},
    "o": {"F1": 500, "F2": 800,  "characteristic": "Low F2 (tongue back)"},
}
```

### 8.3 Audio Quality Metrics

```python
# Various metrics for measuring audio quality

def compute_snr(clean_signal, noisy_signal):
    """
    Compute SNR (Signal-to-Noise Ratio)

    SNR = 10 * log10(signal_power / noise_power)

    Higher is better. General guidelines:
    - > 40dB: Very clean
    - 20-40dB: Good
    - 10-20dB: Noticeable noise
    - < 10dB: Low quality
    """
    noise = noisy_signal - clean_signal
    signal_power = np.mean(clean_signal ** 2)
    noise_power = np.mean(noise ** 2)

    if noise_power == 0:
        return float('inf')

    return 10 * np.log10(signal_power / noise_power)


def compute_pesq_wrapper(reference_path, degraded_path, sample_rate=16000):
    """
    Compute PESQ (Perceptual Evaluation of Speech Quality)
    Objective speech quality metric based on ITU-T P.862

    Score range: -0.5 to 4.5
    - 4.5: No degradation
    - 3.8+: Very good
    - 3.0-3.8: Good
    - 2.0-3.0: Fair
    - < 2.0: Poor
    """
    from pesq import pesq
    import soundfile as sf

    ref, sr_ref = sf.read(reference_path)
    deg, sr_deg = sf.read(degraded_path)

    # Resample if necessary
    if sr_ref != sample_rate:
        import librosa
        ref = librosa.resample(ref, orig_sr=sr_ref, target_sr=sample_rate)
    if sr_deg != sample_rate:
        deg = librosa.resample(deg, orig_sr=sr_deg, target_sr=sample_rate)

    # Match lengths
    min_len = min(len(ref), len(deg))
    ref = ref[:min_len]
    deg = deg[:min_len]

    score = pesq(sample_rate, ref, deg, 'wb')  # 'wb'=wideband, 'nb'=narrowband
    return score


def compute_stoi(clean, degraded, sr=16000):
    """
    STOI (Short-Time Objective Intelligibility)
    A metric for evaluating speech intelligibility

    Score range: 0 to 1
    - > 0.9: Very intelligible
    - 0.7-0.9: Intelligible
    - 0.5-0.7: Somewhat unintelligible
    - < 0.5: Unintelligible
    """
    from pystoi import stoi

    min_len = min(len(clean), len(degraded))
    return stoi(clean[:min_len], degraded[:min_len], sr, extended=True)


# Comprehensive audio quality assessment
def comprehensive_quality_assessment(reference_path, test_path, sr=16000):
    """Comprehensive audio quality evaluation"""
    import soundfile as sf

    ref, _ = sf.read(reference_path)
    test, _ = sf.read(test_path)

    min_len = min(len(ref), len(test))
    ref, test = ref[:min_len], test[:min_len]

    results = {
        "SNR (dB)": compute_snr(ref, test),
        "PESQ": "Requires pesq library",
        "STOI": "Requires pystoi library",
        "RMS difference": float(np.sqrt(np.mean((ref - test) ** 2))),
        "Peak difference": float(np.max(np.abs(ref)) - np.max(np.abs(test))),
        "Spectral distortion": "Requires computation",
    }

    return results
```

---

## 9. Practical Audio Processing Patterns

### 9.1 Real-Time Audio Input and Processing

```python
import numpy as np
import queue
import threading

class RealtimeAudioProcessor:
    """Basic pattern for real-time audio input processing"""

    def __init__(self, sample_rate=16000, chunk_duration_ms=100):
        self.sample_rate = sample_rate
        self.chunk_size = int(sample_rate * chunk_duration_ms / 1000)
        self.audio_queue = queue.Queue()
        self.is_running = False

    def start_recording(self):
        """Start audio input from the microphone"""
        import sounddevice as sd

        self.is_running = True

        def callback(indata, frames, time, status):
            if status:
                print(f"Audio callback status: {status}")
            self.audio_queue.put(indata.copy().flatten())

        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype='float32',
            blocksize=self.chunk_size,
            callback=callback,
        )
        self.stream.start()

    def stop_recording(self):
        """Stop recording"""
        self.is_running = False
        if hasattr(self, 'stream'):
            self.stream.stop()
            self.stream.close()

    def process_chunks(self, processor_func):
        """Apply a processor function to each chunk"""
        while self.is_running:
            try:
                chunk = self.audio_queue.get(timeout=1.0)
                result = processor_func(chunk)
                if result is not None:
                    yield result
            except queue.Empty:
                continue


class CircularAudioBuffer:
    """Audio data management using a ring buffer"""

    def __init__(self, duration_sec, sample_rate=16000):
        self.buffer_size = int(duration_sec * sample_rate)
        self.buffer = np.zeros(self.buffer_size, dtype=np.float32)
        self.write_pos = 0
        self.sample_rate = sample_rate

    def write(self, data):
        """Write data to the buffer"""
        n = len(data)
        if n >= self.buffer_size:
            self.buffer[:] = data[-self.buffer_size:]
            self.write_pos = 0
        else:
            end_pos = self.write_pos + n
            if end_pos <= self.buffer_size:
                self.buffer[self.write_pos:end_pos] = data
            else:
                first_part = self.buffer_size - self.write_pos
                self.buffer[self.write_pos:] = data[:first_part]
                self.buffer[:n - first_part] = data[first_part:]
            self.write_pos = end_pos % self.buffer_size

    def read_last(self, duration_sec):
        """Get the last N seconds of data"""
        n_samples = int(duration_sec * self.sample_rate)
        n_samples = min(n_samples, self.buffer_size)

        if self.write_pos >= n_samples:
            return self.buffer[self.write_pos - n_samples:self.write_pos].copy()
        else:
            first_part = self.buffer[-(n_samples - self.write_pos):]
            second_part = self.buffer[:self.write_pos]
            return np.concatenate([first_part, second_part])
```

### 9.2 Efficient Batch Processing of Audio Files

```python
import concurrent.futures
from pathlib import Path
from dataclasses import dataclass
from typing import Callable, Optional

@dataclass
class BatchProcessResult:
    """Batch processing result"""
    file_path: str
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None
    processing_time: float = 0.0

class AudioBatchProcessor:
    """Batch processing engine for audio files"""

    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers

    def process_directory(
        self,
        input_dir: str,
        processor: Callable,
        file_patterns: list = ["*.wav", "*.mp3", "*.flac"],
        output_dir: Optional[str] = None,
    ) -> list[BatchProcessResult]:
        """Process audio files in a directory in parallel"""
        input_path = Path(input_dir)
        files = []
        for pattern in file_patterns:
            files.extend(input_path.glob(pattern))

        if not files:
            print(f"Warning: No audio files found in {input_dir}")
            return []

        print(f"Processing: {len(files)} files")

        results = []
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self.max_workers
        ) as executor:
            futures = {
                executor.submit(self._process_single, f, processor, output_dir): f
                for f in files
            }

            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                results.append(result)
                status = "OK" if result.success else "NG"
                print(f"  [{status}] {Path(result.file_path).name} "
                      f"({result.processing_time:.2f}s)")

        # Summary
        success = sum(1 for r in results if r.success)
        print(f"\nCompleted: {success}/{len(results)} succeeded")
        return results

    def _process_single(self, file_path, processor, output_dir):
        """Process a single file"""
        import time
        start = time.time()

        try:
            result = processor(str(file_path), output_dir)
            return BatchProcessResult(
                file_path=str(file_path),
                success=True,
                result=result,
                processing_time=time.time() - start,
            )
        except Exception as e:
            return BatchProcessResult(
                file_path=str(file_path),
                success=False,
                error=str(e),
                processing_time=time.time() - start,
            )
```

---

## 10. Audio Data Visualization

### 10.1 Waveform and Spectrogram Visualization

```python
import numpy as np

def create_visualization_data(audio, sr):
    """
    Generate visualization data for audio
    (Output as numerical data, no matplotlib required)
    """
    # Waveform data (downsampled for display)
    display_sr = 1000  # Decimate to 1kHz
    factor = sr // display_sr
    waveform_display = audio[::factor]

    # Spectrogram
    n_fft = 2048
    hop_length = 512
    n_frames = (len(audio) - n_fft) // hop_length + 1

    spectrogram = np.zeros((n_fft // 2 + 1, n_frames))
    window = np.hanning(n_fft)

    for i in range(n_frames):
        start = i * hop_length
        frame = audio[start:start + n_fft] * window
        spectrogram[:, i] = np.abs(np.fft.rfft(frame))

    log_spec = 20 * np.log10(spectrogram + 1e-10)

    # Time axis
    time_axis = np.arange(n_frames) * hop_length / sr
    # Frequency axis
    freq_axis = np.fft.rfftfreq(n_fft, 1.0 / sr)

    return {
        "waveform": waveform_display,
        "waveform_time": np.arange(len(waveform_display)) / display_sr,
        "spectrogram": log_spec,
        "spec_time": time_axis,
        "spec_freq": freq_axis,
        "duration": len(audio) / sr,
        "sample_rate": sr,
    }

# Simple ASCII art spectrogram display
def ascii_spectrogram(audio, sr, n_rows=20, n_cols=80):
    """ASCII spectrogram displayable in a terminal"""
    n_fft = 2048
    hop_length = len(audio) // n_cols

    chars = " ░▒▓█"

    spec_data = np.zeros((n_fft // 2 + 1, n_cols))
    window = np.hanning(n_fft)

    for i in range(n_cols):
        start = i * hop_length
        if start + n_fft > len(audio):
            break
        frame = audio[start:start + n_fft] * window
        spec_data[:, i] = np.abs(np.fft.rfft(frame))

    log_spec = 20 * np.log10(spec_data + 1e-10)

    # Resize to n_rows (decimate the frequency axis)
    freq_indices = np.linspace(0, spec_data.shape[0] - 1, n_rows, dtype=int)
    display = log_spec[freq_indices]

    # Normalize
    vmin, vmax = np.percentile(display, [5, 95])
    display = np.clip((display - vmin) / (vmax - vmin + 1e-10), 0, 1)

    # Convert to ASCII characters
    lines = []
    for row in reversed(range(n_rows)):
        line = ""
        for col in range(min(n_cols, display.shape[1])):
            idx = int(display[row, col] * (len(chars) - 1))
            line += chars[idx]
        lines.append(line)

    return "\n".join(lines)
```

---

## 11. Digital Filter Fundamentals

### 11.1 FIR and IIR Filters

```python
import numpy as np
from scipy.signal import firwin, butter, sosfilt, lfilter

def apply_lowpass_fir(audio, sr, cutoff_hz, n_taps=101):
    """
    FIR low-pass filter
    - Linear phase (no phase distortion)
    - Stable (always stable)
    - High computation cost with many taps
    """
    nyquist = sr / 2
    normalized_cutoff = cutoff_hz / nyquist
    coeffs = firwin(n_taps, normalized_cutoff)
    return lfilter(coeffs, 1.0, audio)

def apply_highpass_iir(audio, sr, cutoff_hz, order=4):
    """
    IIR high-pass filter (Butterworth)
    - Sharp cutoff with few orders
    - Non-linear phase
    - May become unstable (at high orders)
    """
    nyquist = sr / 2
    normalized_cutoff = cutoff_hz / nyquist
    sos = butter(order, normalized_cutoff, btype='high', output='sos')
    return sosfilt(sos, audio)

def apply_bandpass(audio, sr, low_hz, high_hz, order=4):
    """Band-pass filter"""
    nyquist = sr / 2
    low = low_hz / nyquist
    high = high_hz / nyquist
    sos = butter(order, [low, high], btype='band', output='sos')
    return sosfilt(sos, audio)

# Filter preset examples by use case
filter_presets = {
    "Speech recognition preprocessing": {
        "type": "bandpass",
        "low": 80,     # Cut below 80Hz (hum noise, vibration)
        "high": 8000,  # Cut above 8kHz (high-frequency noise)
        "description": "Remove unnecessary bands from speech to improve STT accuracy",
    },
    "Podcast": {
        "type": "highpass",
        "cutoff": 80,
        "description": "Remove low-frequency rumble noise",
    },
    "Telephone audio (narrowband)": {
        "type": "bandpass",
        "low": 300,
        "high": 3400,
        "description": "Restrict to telephone bandwidth (G.711)",
    },
    "Sub-bass removal": {
        "type": "highpass",
        "cutoff": 30,
        "description": "Remove inaudible ultra-low frequencies (including DC component)",
    },
}
```

### 11.2 Frequency Response of Digital Filters

```python
def analyze_filter_response(b, a, sr, n_points=1024):
    """
    Compute the frequency response of a filter

    Parameters:
        b, a: Filter coefficients
        sr: Sample rate
        n_points: Number of computation points

    Returns:
        freqs: Frequency axis [Hz]
        magnitude_db: Magnitude response [dB]
        phase_deg: Phase response [degrees]
    """
    w = np.linspace(0, np.pi, n_points)

    # Compute frequency response H(e^jw)
    h = np.zeros(n_points, dtype=complex)
    for i, wi in enumerate(w):
        # Numerator
        num = sum(b[k] * np.exp(-1j * k * wi) for k in range(len(b)))
        # Denominator
        den = sum(a[k] * np.exp(-1j * k * wi) for k in range(len(a)))
        h[i] = num / den

    freqs = w * sr / (2 * np.pi)
    magnitude_db = 20 * np.log10(np.abs(h) + 1e-10)
    phase_deg = np.degrees(np.angle(h))

    return freqs, magnitude_db, phase_deg
```

---

## 12. Additional FAQ

### Q4: Should I use WAV or FLAC files?

WAV is uncompressed and offers the fastest read/write speed, but file sizes are large. FLAC uses lossless compression and can perfectly reconstruct the original signal, reducing file size to approximately 50-60%. Within an audio processing pipeline, WAV (or raw arrays in memory) is efficient, but FLAC is better suited for storage and transfer. WAV has the highest compatibility as input to AI APIs, but many APIs also accept FLAC and MP3.

### Q5: What is the most important step in audio data preprocessing?

The most important step is unifying the sample rate (resampling). Many STT models assume 16kHz, and mismatches significantly degrade accuracy. Next in importance is normalization (volume leveling), which prevents model performance variation due to differences in input levels. Third is noise removal, but this should be applied based on the audio quality. Applying noise removal to audio recorded in a clean environment can actually degrade quality.

### Q6: What are the differences between dBFS, dBSPL, and LUFS?

These are different scales for measuring "loudness." (1) dBFS (decibels Full Scale): Absolute loudness in digital audio. 0 dBFS is the maximum, and actual values are always negative (e.g., -20 dBFS). (2) dBSPL (decibels Sound Pressure Level): Physical sound pressure level. The loudness reaching the human ear, referenced to 20 uPa. (3) LUFS (Loudness Units Full Scale): Perceptual loudness based on ITU-R BS.1770. A value that accounts for human auditory characteristics (K-weight filter), used for loudness standards of distribution platforms (Spotify: -14 LUFS, etc.). In audio AI development, dBFS and LUFS are primarily used.

---

## Summary (Extended)

| Item | Key Points |
|------|-----------|
| Sound waves | Three elements: frequency (pitch), amplitude (loudness), waveform (timbre) |
| Sampling | Nyquist theorem: fs >= 2 * fmax. 16kHz is standard for speech recognition |
| Quantization | 16bit (CD) is sufficient. float32 recommended for internal processing |
| Fourier Transform | Converts time domain to frequency domain. Computed in O(NlogN) with FFT |
| STFT | FFT on short-time windows. Generates 2D time-frequency representation |
| Mel scale | Frequency scale reflecting human auditory characteristics |
| MFCC | Compact features obtained from mel spectrogram + DCT |
| Pitch detection | YIN algorithm is highly accurate. Autocorrelation method is fast |
| Formants | Estimate vocal tract resonance via LPC analysis. Important for vowel identification |
| Filters | FIR (stable, linear phase) vs IIR (low cost, non-linear phase) |
| Quality metrics | SNR, PESQ, STOI are the main metrics. Choose based on use case |

## Recommended Next Reads

- [02-tts-technologies.md](./02-tts-technologies.md) — Details on TTS technologies
- [03-stt-technologies.md](./03-stt-technologies.md) — Details on STT technologies
- [../03-development/01-audio-processing.md](../03-development/01-audio-processing.md) — Implementation with librosa/torchaudio

## References

1. Smith, S.W. "The Scientist and Engineer's Guide to Digital Signal Processing" — The definitive text on digital signal processing, covering FFT and filtering fundamentals
2. Muller, M. (2015). "Fundamentals of Music Processing" — Fundamentals of music information processing, with detailed coverage of STFT, chromagram, and MFCC
3. Rabiner, L.R. & Schafer, R.W. (2010). "Theory and Applications of Digital Speech Processing" — A classic on speech signal processing, from sampling to LPC analysis
4. Stevens, S.S. & Volkmann, J. (1940). "The Relation of Pitch to Frequency" — The original paper on the mel scale, research on frequency perception based on human auditory characteristics
5. de Cheveigne, A. & Kawahara, H. (2002). "YIN, a fundamental frequency estimator for speech and music" — The original paper on the YIN algorithm for high-accuracy pitch detection
6. Rix, A.W., et al. (2001). "Perceptual evaluation of speech quality (PESQ)" — The original paper on the PESQ speech quality metric
