# TTS Technologies — VITS, Bark, ElevenLabs

> An explanation of how TTS (Text-to-Speech) technology generates natural speech from text, covering key models and implementation methods

## What You Will Learn

1. Modern TTS architecture and evolution (concatenative synthesis -> neural TTS -> End-to-End)
2. Major OSS models (VITS, Bark, Coqui TTS): how they work and when to use each
3. Cloud TTS API implementation patterns (ElevenLabs, OpenAI TTS, Google TTS)


## Prerequisites

The following knowledge will help you better understand this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Audio Basics — Sampling, Frequency, Fourier Transform](./01-audio-basics.md)

---

## 1. Evolution of TTS Technology

### 1.1 History of TTS Pipelines

```
Evolution of TTS Technology
==================================================

Generation 1: Concatenative Synthesis (1990s-2010s)
  Text -> Linguistic Processing -> Phoneme Sequence -> Waveform DB Search -> Concatenation -> Speech
  Examples: Formant synthesis, Unit selection synthesis

Generation 2: Statistical Parametric (2010s)
  Text -> Linguistic Features -> HMM/DNN -> Parameters -> Vocoder -> Speech
  Examples: HTS, Merlin

Generation 3: Neural TTS (2016-2020)
  Text -> Encoder -> Attention -> Decoder -> Vocoder -> Speech
  Examples: Tacotron 2 + WaveGlow/HiFi-GAN

Generation 4: End-to-End (2021-Present)
  Text ──────-> Single Model ──────-> Speech
  Examples: VITS, VALL-E, Bark
==================================================
```

### 1.2 Generation 3 Pipeline (Tacotron 2 Type)

```
Tacotron 2 + HiFi-GAN Pipeline
==================================================

Input Text
    |
    v
┌─────────────┐
│ Text         │  Numbers -> readings, abbreviation expansion, G2P
│ Preprocessing│
└──────┬──────┘
       v
┌─────────────┐
│  Encoder     │  Character/phoneme embedding + BiLSTM/Transformer
│ (Text)       │  -> Linguistic feature extraction
└──────┬──────┘
       |  Attention (which character to read at what time)
       v
┌─────────────┐
│  Decoder     │  Autoregressive mel spectrogram generation
│ (Acoustic)   │  Prediction per frame
└──────┬──────┘
       v
┌─────────────┐
│  Vocoder     │  Mel spectrogram -> Waveform
│ (HiFi-GAN)  │  GAN-based fast, high-quality conversion
└──────┬──────┘
       v
   Audio Waveform
==================================================
```

---

## 2. Detailed Overview of Major Models

### 2.1 VITS (Conditional Variational Autoencoder with Adversarial Learning)

```python
# Conceptual architecture of VITS

class VITSArchitecture:
    """
    VITS: End-to-End TTS
    - Text -> Speech in a single model
    - Combination of VAE + Flow + GAN
    - Fast inference (faster than real-time)
    """

    def __init__(self):
        # Text encoder: Text -> Linguistic features
        self.text_encoder = TransformerEncoder(
            hidden_dim=192,
            n_layers=6,
            n_heads=2,
        )

        # Posterior encoder: Speech -> Latent representation (training only)
        self.posterior_encoder = WaveNetEncoder(
            in_channels=513,  # Linear spectrogram
            hidden_dim=192,
        )

        # Flow model: Bridges text distribution <-> speech distribution
        self.flow = ResidualCouplingBlock(
            channels=192,
            n_flows=4,
        )

        # Decoder (HiFi-GAN based): Latent representation -> Waveform
        self.decoder = HiFiGANGenerator(
            initial_channels=192,
            upsample_rates=[8, 8, 2, 2],
        )

    def inference(self, text):
        """Inference (Text -> Speech)"""
        # 1. Text encoding
        text_hidden, text_mask = self.text_encoder(text)
        # 2. Monotonic Alignment Search (MAS)
        duration = monotonic_alignment_search(text_hidden)
        # 3. Generate latent representation via flow reverse transform
        z = self.flow.reverse(text_hidden, duration)
        # 4. Waveform decoding
        audio = self.decoder(z)
        return audio
```

### 2.2 Bark (Suno AI)

```python
# Bark usage example

from bark import SAMPLE_RATE, generate_audio, preload_models

# Preload models
preload_models()

# Basic text-to-speech synthesis
text_prompt = "Hello, I am an AI assistant. It's a beautiful day today."
audio_array = generate_audio(text_prompt)

# Bark's special tags (can also generate non-verbal sounds)
special_prompts = {
    "laughter":  "It was so fun today [laughs] It was truly the best",
    "singing":   "♪ La la la, what a wonderful day ♪",
    "sigh":      "Haah... [sighs] I'm exhausted",
    "music":     "[music] A beautiful melody is playing",
}

# Using speaker presets
audio = generate_audio(
    text_prompt,
    history_prompt="v2/ja_speaker_0",  # Japanese speaker preset
)

# Long text splitting
def generate_long_audio(long_text, max_length=200):
    """Split long text and synthesize speech"""
    import numpy as np

    sentences = split_into_sentences(long_text)
    audio_segments = []

    for sentence in sentences:
        if len(sentence) > max_length:
            # Split further
            chunks = split_by_punctuation(sentence, max_length)
            for chunk in chunks:
                audio_segments.append(generate_audio(chunk))
        else:
            audio_segments.append(generate_audio(sentence))

    # Concatenate audio (insert short silence)
    silence = np.zeros(int(SAMPLE_RATE * 0.3))  # 300ms
    result = np.concatenate(
        [np.concatenate([seg, silence]) for seg in audio_segments]
    )
    return result
```

### 2.3 ElevenLabs API

```python
import requests

class ElevenLabsTTS:
    """ElevenLabs TTS API wrapper"""

    BASE_URL = "https://api.elevenlabs.io/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        }

    def text_to_speech(
        self,
        text: str,
        voice_id: str = "21m00Tcm4TlvDq8ikWAM",  # Rachel
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
    ) -> bytes:
        """Convert text to speech"""
        url = f"{self.BASE_URL}/text-to-speech/{voice_id}"
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,         # Stability (low -> more expressive)
                "similarity_boost": similarity_boost,  # Voice consistency
            },
        }
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.content  # MP3 binary

    def list_voices(self) -> list:
        """Get list of available voices"""
        url = f"{self.BASE_URL}/voices"
        response = requests.get(url, headers=self.headers)
        return response.json()["voices"]

    def clone_voice(self, name: str, audio_files: list) -> str:
        """Voice cloning (Instant Voice Cloning)"""
        url = f"{self.BASE_URL}/voices/add"
        files = [("files", open(f, "rb")) for f in audio_files]
        data = {"name": name}
        headers = {"xi-api-key": self.api_key}
        response = requests.post(url, data=data, files=files, headers=headers)
        return response.json()["voice_id"]

# Usage example
tts = ElevenLabsTTS("your-api-key")
audio = tts.text_to_speech("Hello, world!")
with open("output.mp3", "wb") as f:
    f.write(audio)
```

### 2.4 OpenAI TTS API

```python
from openai import OpenAI

client = OpenAI()

# Basic TTS
response = client.audio.speech.create(
    model="tts-1",       # tts-1 (fast) or tts-1-hd (high quality)
    voice="alloy",       # alloy, echo, fable, onyx, nova, shimmer
    input="This is a speech synthesis test. OpenAI's TTS generates very natural speech.",
    response_format="mp3",  # mp3, opus, aac, flac, wav, pcm
    speed=1.0,           # 0.25 to 4.0
)

# Save to file
response.stream_to_file("output.mp3")

# Streaming TTS
response = client.audio.speech.create(
    model="tts-1",
    voice="nova",
    input="Generating speech via streaming.",
    response_format="pcm",  # PCM or Opus is optimal for streaming
)

# Process chunk by chunk
for chunk in response.iter_bytes(chunk_size=4096):
    audio_player.play(chunk)
```

---

## 3. Speech Quality Control

### 3.1 Parameter Tuning

```
TTS Quality Control Parameters
==================================================

┌──────────────────────────────────────────┐
│         Quality Control Axes              │
│                                          │
│   Naturalness <──────────> Stability     │
│   (expressiveness)    (stability)        │
│                                          │
│   Low stability:                         │
│   - Rich emotional expression            │
│   - Voice quality tends to fluctuate     │
│   - Quality varies in long texts         │
│                                          │
│   High stability:                        │
│   - Consistent voice quality             │
│   - Tends to be monotonous              │
│   - Suitable for narration              │
│                                          │
│   ────────────────────────               │
│                                          │
│   Speed 0.5x <──────────> 2.0x          │
│   Slow        Normal 1.0x     Fast       │
│                                          │
│   Temperature (sampling_temperature)     │
│   Low (0.1): Safe and predictable        │
│   High (1.0): Diverse and expressive     │
└──────────────────────────────────────────┘
==================================================
```

---

## 4. Comparison Tables

### 4.1 Major TTS Model/Service Comparison

| Item | VITS | Bark | ElevenLabs | OpenAI TTS | Google TTS |
|------|------|------|-----------|-----------|-----------|
| Type | OSS | OSS | API | API | API |
| Quality (MOS) | 4.0-4.3 | 3.8-4.2 | 4.5-4.8 | 4.3-4.6 | 4.0-4.4 |
| Japanese Support | Requires training | Supported | Supported | Supported | Supported |
| Real-time Performance | Fast | Slow | Moderate | Fast | Fast |
| Voice Cloning | Requires training | Presets | Supported | Not supported | Not supported |
| Emotional Expression | Limited | Non-verbal OK | High | Moderate | Moderate |
| Cost | Free | Free | Pay-per-use | Pay-per-use | Pay-per-use |
| GPU Requirements | Required | Required (large) | Not required | Not required | Not required |

### 4.2 Recommended TTS by Use Case

| Use Case | Recommendation | Reason |
|----------|---------------|--------|
| Prototype | OpenAI TTS | Easy setup, sufficient quality |
| Commercial Narration | ElevenLabs | Highest quality, voice cloning support |
| Game/App Embedded | VITS | Local execution, customizable |
| Multilingual Support | Google TTS / Bark | Broad language coverage |
| Low-cost Mass Production | Coqui TTS / Piper | OSS, free with GPU |
| Emotionally Rich Speech | Bark / ElevenLabs | Non-verbal sounds, emotion control |
| Real-time Dialogue | OpenAI TTS + PCM | Streaming support, low latency |
| Offline Operation | Piper / VITS | Local execution, no internet required |

---

## 5. Anti-patterns

### 5.1 Anti-pattern: Skipping Text Preprocessing

```python
# BAD: Pass text directly to TTS without preprocessing
def bad_tts(text):
    return tts_model.synthesize(text)
    # Problem: "100km" -> unintelligible pronunciation
    # Problem: "2026/2/11" -> unpredictable pronunciation
    # Problem: "API" -> mispronounced

# GOOD: Pass through a text normalization pipeline
import re

def normalize_text_for_tts(text: str) -> str:
    """Text normalization for TTS"""
    # Number reading conversion
    text = re.sub(r'(\d+)km', lambda m: f'{m.group(1)} kilometers', text)
    text = re.sub(r'(\d+)kg', lambda m: f'{m.group(1)} kilograms', text)

    # Date conversion
    text = re.sub(
        r'(\d{4})/(\d{1,2})/(\d{1,2})',
        lambda m: f'{m.group(2)}/{m.group(3)}/{m.group(1)}',
        text
    )

    # Abbreviation handling
    abbreviations = {"API": "A P I", "AI": "A I", "URL": "U R L"}
    for abbr, reading in abbreviations.items():
        text = text.replace(abbr, reading)

    return text

def good_tts(text):
    normalized = normalize_text_for_tts(text)
    return tts_model.synthesize(normalized)
```

### 5.2 Anti-pattern: Synthesizing Long Text All at Once

```python
# BAD: Synthesize long text all at once
def bad_long_tts(long_text):
    # Problem 1: Out of memory
    # Problem 2: Quality degradation (quality drops toward the end)
    # Problem 3: If an error occurs midway, everything must be redone
    return tts_model.synthesize(long_text)

# GOOD: Split by sentence, synthesize, and concatenate
def good_long_tts(long_text, max_chars=150):
    import numpy as np

    # Split by sentence (split at punctuation marks)
    sentences = re.split(r'(?<=[.!?\n])', long_text)
    sentences = [s.strip() for s in sentences if s.strip()]

    audio_parts = []
    for i, sentence in enumerate(sentences):
        try:
            audio = tts_model.synthesize(sentence)
            audio_parts.append(audio)

            # Insert pause between sentences (300ms)
            pause = np.zeros(int(sample_rate * 0.3))
            audio_parts.append(pause)

        except Exception as e:
            print(f"Failed to synthesize sentence {i}: {e}")
            # Skip the failed sentence and continue
            continue

    return np.concatenate(audio_parts)
```

---

## 6. FAQ

### Q1: Are there objective methods to evaluate TTS speech quality?

The most widely used evaluation metric is MOS (Mean Opinion Score, a 5-point subjective rating). For automated evaluation, there are PESQ (Perceptual Evaluation of Speech Quality), UTMOS (Neural MOS Predictor), and Speaker Similarity, among others. In practice, preparing a set of sentences close to the target use case and conducting blind A/B listening tests with multiple evaluators is effective.

### Q2: What causes unnatural intonation in Japanese TTS, and how can it be addressed?

The main causes are: (1) insufficient accent dictionary coverage (proper nouns, new words), (2) inadequate handling of context-dependent accent changes, and (3) training data bias. Countermeasures include adding accent information to the OpenJTalk user dictionary, explicitly controlling prosody with SSML (Speech Synthesis Markup Language), and fine-tuning with domain-specific data.

### Q3: What are the key considerations when implementing streaming TTS?

The following points are important for streaming TTS: (1) Buffering strategy: Send the first chunk as quickly as possible (minimizing First Token Latency), then ensure a buffer size that allows smooth playback. (2) Audio format: Use formats that can be split at chunk boundaries, such as PCM or Opus (be careful with MP3 frame boundaries). (3) Error handling: Design reconnection logic for network disconnections and handling of partial audio buffers.

---


## FAQ

### Q1: What is the most important point in learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Direction of Evolution | Pipeline separation -> End-to-End integration |
| Major OSS | VITS (fast E2E), Bark (versatile), Piper (lightweight) |
| Major APIs | ElevenLabs (highest quality), OpenAI (easy), Google (multilingual) |
| Preprocessing | Text normalization (numbers, abbreviations, dates) directly impacts quality |
| Long Text Handling | Split by sentence -> synthesize -> concatenate is the standard pattern |
| Quality Control | Adjust via stability/similarity/speed/temperature |

## Recommended Next Reads

- [03-stt-technologies.md](./03-stt-technologies.md) — STT Technologies (Whisper, Google, Azure)
- [../02-voice/00-voice-cloning.md](../02-voice/00-voice-cloning.md) — Voice Cloning Technologies
- [../03-development/00-audio-apis.md](../03-development/00-audio-apis.md) — Audio API Implementation Guide

## References

1. Kim, J., et al. (2021). "Conditional Variational Autoencoder with Adversarial Learning for End-to-End Text-to-Speech" — VITS original paper. End-to-End TTS using VAE+Flow+GAN
2. Kong, J., et al. (2020). "HiFi-GAN: Generative Adversarial Networks for Efficient and High Fidelity Speech Synthesis" — HiFi-GAN vocoder paper
3. Wang, C., et al. (2023). "Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers" — VALL-E paper. Zero-shot TTS via speech codec tokenization
4. Shen, J., et al. (2018). "Natural TTS Synthesis by Conditioning WaveNet on Mel Spectrogram Predictions" — Tacotron 2 paper

---

## 7. Advanced TTS Implementation Patterns

### 7.1 Prosody Control with SSML

```python
# Fine-grained speech control using SSML (Speech Synthesis Markup Language)

class SSMLBuilder:
    """SSML construction helper"""
    
    def __init__(self):
        self.elements = []
    
    def add_text(self, text: str) -> 'SSMLBuilder':
        """Plain text"""
        self.elements.append(text)
        return self
    
    def add_break(self, time_ms: int = 500) -> 'SSMLBuilder':
        """Insert pause"""
        self.elements.append(f'<break time="{time_ms}ms"/>')
        return self
    
    def add_emphasis(self, text: str, level: str = "moderate") -> 'SSMLBuilder':
        """Emphasis (strong, moderate, reduced)"""
        self.elements.append(f'<emphasis level="{level}">{text}</emphasis>')
        return self
    
    def add_prosody(
        self, text: str, 
        rate: str = "medium", 
        pitch: str = "medium",
        volume: str = "medium"
    ) -> 'SSMLBuilder':
        """Speed, pitch, and volume control"""
        self.elements.append(
            f'<prosody rate="{rate}" pitch="{pitch}" volume="{volume}">{text}</prosody>'
        )
        return self
    
    def add_say_as(self, text: str, interpret_as: str) -> 'SSMLBuilder':
        """Specify reading style (date, time, telephone, cardinal, ordinal)"""
        self.elements.append(
            f'<say-as interpret-as="{interpret_as}">{text}</say-as>'
        )
        return self
    
    def add_phoneme(self, text: str, ph: str, alphabet: str = "ipa") -> 'SSMLBuilder':
        """Explicit phoneme specification"""
        self.elements.append(
            f'<phoneme alphabet="{alphabet}" ph="{ph}">{text}</phoneme>'
        )
        return self
    
    def build(self) -> str:
        """Generate SSML string"""
        content = "".join(self.elements)
        return f'<speak>{content}</speak>'


# Usage example: News reading
builder = SSMLBuilder()
ssml = (
    builder
    .add_prosody("Here is today's news.", rate="slow", pitch="low")
    .add_break(800)
    .add_emphasis("Breaking news.", level="strong")
    .add_break(500)
    .add_text("Today, ")
    .add_say_as("February 14, 2026", interpret_as="date")
    .add_text(", a large-scale tech conference was held in Tokyo.")
    .add_break(600)
    .add_prosody("The number of attendees exceeded ", rate="medium")
    .add_say_as("5000", interpret_as="cardinal")
    .add_text(", making it the largest ever.")
    .build()
)

print(ssml)
# Can be used with Google TTS or Azure TTS
```

### 7.2 Multi-Speaker TTS System

```python
import numpy as np
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class SpeakerGender(Enum):
    MALE = "male"
    FEMALE = "female"
    NEUTRAL = "neutral"

class EmotionType(Enum):
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISE = "surprise"
    WHISPER = "whisper"

@dataclass
class SpeakerProfile:
    """Speaker profile"""
    name: str
    gender: SpeakerGender
    voice_id: str
    language: str = "ja-JP"
    default_speed: float = 1.0
    default_pitch: float = 0.0  # semitones
    emotion: EmotionType = EmotionType.NEUTRAL
    style_weights: dict = field(default_factory=dict)

@dataclass
class DialogueLine:
    """A single line of dialogue"""
    speaker: str
    text: str
    emotion: Optional[EmotionType] = None
    pause_after_ms: int = 500

class MultiSpeakerTTS:
    """Multi-speaker TTS engine"""
    
    def __init__(self, tts_engine):
        self.tts_engine = tts_engine
        self.speakers: dict[str, SpeakerProfile] = {}
        self.sample_rate = 24000
    
    def register_speaker(self, profile: SpeakerProfile):
        """Register a speaker"""
        self.speakers[profile.name] = profile
    
    def synthesize_dialogue(
        self, 
        dialogue: list[DialogueLine],
        output_path: str,
        crossfade_ms: int = 50,
    ) -> np.ndarray:
        """Synthesize an entire dialogue"""
        audio_segments = []
        
        for line in dialogue:
            speaker = self.speakers[line.speaker]
            emotion = line.emotion or speaker.emotion
            
            # Synthesize with speaker-specific settings
            audio = self.tts_engine.synthesize(
                text=line.text,
                voice_id=speaker.voice_id,
                speed=speaker.default_speed,
                pitch=speaker.default_pitch,
                emotion=emotion.value,
            )
            
            audio_segments.append(audio)
            
            # Insert pause
            pause = np.zeros(int(self.sample_rate * line.pause_after_ms / 1000))
            audio_segments.append(pause)
        
        # Concatenate with crossfade
        result = self._crossfade_concat(audio_segments, crossfade_ms)
        
        # Save to file
        self._save_audio(result, output_path)
        return result
    
    def _crossfade_concat(self, segments: list[np.ndarray], fade_ms: int) -> np.ndarray:
        """Concatenation with crossfade"""
        fade_samples = int(self.sample_rate * fade_ms / 1000)
        
        if len(segments) == 0:
            return np.array([])
        
        result = segments[0]
        for seg in segments[1:]:
            if len(seg) == 0:
                continue
            if len(result) >= fade_samples and len(seg) >= fade_samples:
                # Fade out / Fade in
                fade_out = np.linspace(1.0, 0.0, fade_samples)
                fade_in = np.linspace(0.0, 1.0, fade_samples)
                
                result[-fade_samples:] *= fade_out
                seg_copy = seg.copy()
                seg_copy[:fade_samples] *= fade_in
                
                # Add overlapping sections
                result[-fade_samples:] += seg_copy[:fade_samples]
                result = np.concatenate([result, seg_copy[fade_samples:]])
            else:
                result = np.concatenate([result, seg])
        
        return result
    
    def _save_audio(self, audio: np.ndarray, path: str):
        """Save to audio file"""
        import soundfile as sf
        sf.write(path, audio, self.sample_rate)


# Usage example: Audio drama dialogue synthesis
multi_tts = MultiSpeakerTTS(tts_engine=None)  # Pass the actual engine

multi_tts.register_speaker(SpeakerProfile(
    name="Taro",
    gender=SpeakerGender.MALE,
    voice_id="ja_male_01",
    default_speed=1.0,
    default_pitch=-2.0,
))

multi_tts.register_speaker(SpeakerProfile(
    name="Hanako",
    gender=SpeakerGender.FEMALE,
    voice_id="ja_female_01",
    default_speed=1.05,
    default_pitch=2.0,
))

dialogue = [
    DialogueLine("Taro", "Good morning. Is the preparation for today's meeting ready?"),
    DialogueLine("Hanako", "Yes, all the materials are ready.", emotion=EmotionType.HAPPY),
    DialogueLine("Taro", "Excellent. Let's meet in the conference room at 10.", pause_after_ms=800),
    DialogueLine("Hanako", "Understood. I'll head there now."),
]

audio = multi_tts.synthesize_dialogue(dialogue, "dialogue_output.wav")
```

### 7.3 Emotion-Controlled TTS Pipeline

```python
from dataclasses import dataclass
from typing import Optional
import re

@dataclass
class EmotionParameters:
    """Emotion parameters"""
    name: str
    stability: float        # 0.0-1.0: low=expressive, high=stable
    similarity_boost: float # 0.0-1.0: voice consistency
    style: float           # 0.0-1.0: style intensity
    speed: float           # Speed multiplier
    pitch_shift: float     # Pitch shift (semitones)

# Emotion presets
EMOTION_PRESETS = {
    "neutral": EmotionParameters("neutral", 0.5, 0.75, 0.0, 1.0, 0.0),
    "happy": EmotionParameters("happy", 0.3, 0.7, 0.6, 1.1, 1.5),
    "sad": EmotionParameters("sad", 0.6, 0.8, 0.5, 0.85, -1.5),
    "angry": EmotionParameters("angry", 0.2, 0.6, 0.8, 1.15, 0.5),
    "excited": EmotionParameters("excited", 0.2, 0.65, 0.7, 1.2, 2.0),
    "calm": EmotionParameters("calm", 0.8, 0.85, 0.3, 0.9, -0.5),
    "whisper": EmotionParameters("whisper", 0.7, 0.9, 0.4, 0.8, -1.0),
    "narration": EmotionParameters("narration", 0.6, 0.8, 0.2, 0.95, 0.0),
}


class EmotionAwareTTS:
    """Emotion-aware TTS pipeline"""
    
    def __init__(self, tts_client, sentiment_analyzer=None):
        self.tts_client = tts_client
        self.sentiment_analyzer = sentiment_analyzer
    
    def auto_detect_emotion(self, text: str) -> str:
        """Automatically infer emotion from text"""
        if self.sentiment_analyzer:
            return self.sentiment_analyzer.predict(text)
        
        # Simple rule-based estimation
        emotion_keywords = {
            "happy": ["happy", "fun", "wonderful", "amazing", "great", "thank you"],
            "sad": ["sad", "unfortunate", "painful", "lonely", "sorry"],
            "angry": ["angry", "unforgivable", "ridiculous", "enough"],
            "excited": ["incredible", "surprising", "unbelievable", "!!"],
            "calm": ["peaceful", "quiet", "slowly"],
        }
        
        for emotion, keywords in emotion_keywords.items():
            for keyword in keywords:
                if keyword in text.lower():
                    return emotion
        
        return "neutral"
    
    def synthesize_with_emotion(
        self,
        text: str,
        voice_id: str,
        emotion: Optional[str] = None,
    ) -> bytes:
        """Synthesize speech with emotion"""
        if emotion is None:
            emotion = self.auto_detect_emotion(text)
        
        params = EMOTION_PRESETS.get(emotion, EMOTION_PRESETS["neutral"])
        
        audio = self.tts_client.text_to_speech(
            text=text,
            voice_id=voice_id,
            stability=params.stability,
            similarity_boost=params.similarity_boost,
            style=params.style,
            speed=params.speed,
        )
        
        return audio
    
    def synthesize_narrative(
        self,
        text: str,
        voice_id: str,
    ) -> list[bytes]:
        """Synthesize long narration with emotion variation"""
        # Split by sentence
        sentences = re.split(r'(?<=[.!?\n])', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        audio_parts = []
        for sentence in sentences:
            emotion = self.auto_detect_emotion(sentence)
            audio = self.synthesize_with_emotion(sentence, voice_id, emotion)
            audio_parts.append(audio)
        
        return audio_parts
```

---

## 8. Detailed Text Preprocessing Implementation

### 8.1 Japanese Text Normalization Pipeline

```python
import re
from typing import Callable

class JapaneseTextNormalizer:
    """Japanese text normalization pipeline for TTS"""
    
    def __init__(self):
        self.rules: list[tuple[str, Callable]] = []
        self._setup_default_rules()
    
    def _setup_default_rules(self):
        """Set up default normalization rules"""
        self.rules = [
            ("Full-width alphanumeric -> Half-width", self._zenkaku_to_hankaku),
            ("URL removal", self._remove_urls),
            ("Email address normalization", self._normalize_email),
            ("Number reading conversion", self._normalize_numbers),
            ("Date reading conversion", self._normalize_dates),
            ("Time reading conversion", self._normalize_times),
            ("Unit reading conversion", self._normalize_units),
            ("Abbreviation expansion", self._expand_abbreviations),
            ("Symbol reading conversion", self._normalize_symbols),
            ("Repetition mark handling", self._handle_repetition),
            ("Whitespace normalization", self._normalize_whitespace),
        ]
    
    def normalize(self, text: str) -> str:
        """Execute text normalization"""
        for rule_name, rule_func in self.rules:
            text = rule_func(text)
        return text
    
    def _zenkaku_to_hankaku(self, text: str) -> str:
        """Convert full-width alphanumeric characters to half-width"""
        result = []
        for char in text:
            code = ord(char)
            if 0xFF01 <= code <= 0xFF5E:
                result.append(chr(code - 0xFEE0))
            else:
                result.append(char)
        return "".join(result)
    
    def _remove_urls(self, text: str) -> str:
        """Remove URLs or replace with domain name only"""
        return re.sub(
            r'https?://[^\s]+',
            lambda m: self._url_to_readable(m.group(0)),
            text
        )
    
    def _url_to_readable(self, url: str) -> str:
        """Convert URL to a readable format"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.hostname or ""
        return f"link to {domain}"
    
    def _normalize_email(self, text: str) -> str:
        """Convert email addresses to a speakable format"""
        return re.sub(
            r'[\w.-]+@[\w.-]+\.\w+',
            lambda m: m.group(0).replace("@", " at ").replace(".", " dot "),
            text
        )
    
    def _normalize_numbers(self, text: str) -> str:
        """Number reading conversion"""
        # Decimal point
        text = re.sub(r'(\d+)\.(\d+)', r'\1 point \2', text)
        # Percentage
        text = re.sub(r'(\d+(?:\.\d+)?)%', r'\1 percent', text)
        # Comma-separated numbers
        text = re.sub(r'(\d{1,3}(?:,\d{3})+)', lambda m: m.group(0).replace(",", ""), text)
        return text
    
    def _normalize_dates(self, text: str) -> str:
        """Date reading conversion"""
        # YYYY/MM/DD or YYYY-MM-DD
        text = re.sub(
            r'(\d{4})/-/-',
            lambda m: f'{m.group(1)}/{m.group(2)}/{m.group(3)}',
            text
        )
        # MM/DD
        text = re.sub(
            r'(\d{1,2})/-(?!\d)',
            lambda m: f'{m.group(1)}/{m.group(2)}',
            text
        )
        return text
    
    def _normalize_times(self, text: str) -> str:
        """Time reading conversion"""
        text = re.sub(
            r'(\d{1,2}):(\d{2})(?::(\d{2}))?',
            lambda m: f'{m.group(1)} hours {m.group(2)} minutes' + (f' {m.group(3)} seconds' if m.group(3) else ''),
            text
        )
        return text
    
    def _normalize_units(self, text: str) -> str:
        """Unit reading conversion"""
        units = {
            "km": " kilometers", "cm": " centimeters", "mm": " millimeters",
            "m": " meters", "kg": " kilograms", "g": " grams", "mg": " milligrams",
            "km/h": " kilometers per hour", "m/s": " meters per second",
            "GB": " gigabytes", "MB": " megabytes", "KB": " kilobytes",
            "TB": " terabytes", "Hz": " hertz", "kHz": " kilohertz",
            "MHz": " megahertz", "GHz": " gigahertz",
        }
        for unit, reading in sorted(units.items(), key=lambda x: -len(x[0])):
            text = re.sub(
                rf'(\d+(?:\.\d+)?)\s*{re.escape(unit)}(?!\w)',
                rf'\1{reading}',
                text
            )
        return text
    
    def _expand_abbreviations(self, text: str) -> str:
        """Expand alphabetic abbreviations"""
        abbrevs = {
            "API": "A P I", "AI": "A I", "URL": "U R L",
            "HTML": "H T M L", "CSS": "C S S",
            "GPU": "G P U", "CPU": "C P U",
            "RAM": "RAM", "SSD": "S S D",
            "TTS": "T T S", "STT": "S T T",
            "IoT": "I o T", "SDK": "S D K",
            "PDF": "P D F", "FAQ": "F A Q",
            "OS": "O S", "DB": "D B",
        }
        for abbr, reading in sorted(abbrevs.items(), key=lambda x: -len(x[0])):
            text = re.sub(rf'\b{abbr}\b', reading, text)
        return text
    
    def _normalize_symbols(self, text: str) -> str:
        """Symbol reading conversion"""
        symbols = {
            "&": " and ", "#": " hash ",
        }
        for sym, reading in symbols.items():
            text = text.replace(sym, reading)
        return text
    
    def _handle_repetition(self, text: str) -> str:
        """Handle repetition marks (no processing needed for standard text)"""
        return text
    
    def _normalize_whitespace(self, text: str) -> str:
        """Whitespace normalization"""
        text = re.sub(r'\s+', ' ', text)
        return text.strip()


# Usage example
normalizer = JapaneseTextNormalizer()

test_texts = [
    "At the AI tech conference on 2026/2/14, there was a talk about a server loaded with 100kg of GPUs.",
    "The URL is https://example.com. Email us at info@example.com.",
    "The temperature was 36.5 degrees Celsius, and the speed was 120km/h.",
    "FAQ: The API response is within 200ms 99.9% of the time.",
]

for text in test_texts:
    normalized = normalizer.normalize(text)
    print(f"Original: {text}")
    print(f"Normalized: {normalized}")
    print()
```

### 8.2 Sentence Splitting Algorithm

```python
import re
from dataclasses import dataclass

@dataclass
class SentenceChunk:
    """A split sentence chunk"""
    text: str
    char_count: int
    is_continuation: bool = False

class TTSSentenceSplitter:
    """Sentence splitter for TTS"""
    
    def __init__(self, max_chars: int = 150, min_chars: int = 10):
        self.max_chars = max_chars
        self.min_chars = min_chars
    
    def split(self, text: str) -> list[SentenceChunk]:
        """Split text for TTS processing"""
        # Step 1: Split by sentence
        sentences = self._split_sentences(text)
        
        # Step 2: Further split sentences that are too long
        chunks = []
        for sentence in sentences:
            if len(sentence) <= self.max_chars:
                chunks.append(SentenceChunk(
                    text=sentence, 
                    char_count=len(sentence)
                ))
            else:
                sub_chunks = self._split_long_sentence(sentence)
                for i, sub in enumerate(sub_chunks):
                    chunks.append(SentenceChunk(
                        text=sub,
                        char_count=len(sub),
                        is_continuation=i > 0,
                    ))
        
        # Step 3: Merge chunks that are too short
        chunks = self._merge_short_chunks(chunks)
        
        return chunks
    
    def _split_sentences(self, text: str) -> list[str]:
        """Split by sentence"""
        # Split at punctuation, exclamation/question marks, and newlines
        parts = re.split(r'(?<=[.!?\n])\s*', text)
        return [p.strip() for p in parts if p.strip()]
    
    def _split_long_sentence(self, sentence: str) -> list[str]:
        """Split long sentences at commas or spaces"""
        # Attempt to split at commas
        parts = re.split(r'(?<=[,;])\s*', sentence)
        
        result = []
        current = ""
        for part in parts:
            if len(current) + len(part) <= self.max_chars:
                current += part
            else:
                if current:
                    result.append(current.strip())
                current = part
        if current:
            result.append(current.strip())
        
        return result
    
    def _merge_short_chunks(self, chunks: list[SentenceChunk]) -> list[SentenceChunk]:
        """Merge chunks that are too short"""
        if not chunks:
            return chunks
        
        merged = [chunks[0]]
        for chunk in chunks[1:]:
            if merged[-1].char_count < self.min_chars:
                # Merge with the previous chunk
                merged[-1] = SentenceChunk(
                    text=merged[-1].text + chunk.text,
                    char_count=merged[-1].char_count + chunk.char_count,
                )
            else:
                merged.append(chunk)
        
        return merged


# Usage example
splitter = TTSSentenceSplitter(max_chars=100)
text = """
The progress of artificial intelligence has been remarkable. In particular, the field of
text-to-speech synthesis has reached a quality level indistinguishable from human speech
since entering the 2020s. With the emergence of End-to-End models such as VITS and Bark,
it is now possible to generate high-quality speech directly from text.
Further multilingual support and improved emotional expression are expected in the future!
"""

chunks = splitter.split(text)
for i, chunk in enumerate(chunks):
    cont = " (continued)" if chunk.is_continuation else ""
    print(f"Chunk {i+1}{cont}: [{chunk.char_count} chars] {chunk.text}")
```

---

## 9. Speech Quality Evaluation System

### 9.1 Automatic MOS Prediction (UTMOS)

```python
import numpy as np
from dataclasses import dataclass

@dataclass
class QualityScore:
    """Speech quality score"""
    mos: float              # Mean Opinion Score (1.0-5.0)
    naturalness: float      # Naturalness (0.0-1.0)
    intelligibility: float  # Intelligibility (0.0-1.0)
    speaker_similarity: float  # Speaker similarity (0.0-1.0)
    prosody_score: float    # Prosody (0.0-1.0)

class TTSQualityEvaluator:
    """Automatic TTS quality evaluator"""
    
    def __init__(self):
        self.utmos_model = None  # UTMOS model
        self.pesq_available = False
    
    def evaluate(self, generated_audio: np.ndarray, 
                 reference_audio: np.ndarray = None,
                 sample_rate: int = 24000) -> QualityScore:
        """Comprehensive speech quality evaluation"""
        
        # 1. MOS prediction (UTMOS)
        mos = self._predict_mos(generated_audio, sample_rate)
        
        # 2. Naturalness score
        naturalness = self._evaluate_naturalness(generated_audio, sample_rate)
        
        # 3. Intelligibility (reverse-convert with STT and calculate match rate)
        intelligibility = self._evaluate_intelligibility(generated_audio, sample_rate)
        
        # 4. Speaker similarity (when reference audio is available)
        similarity = 0.0
        if reference_audio is not None:
            similarity = self._evaluate_speaker_similarity(
                generated_audio, reference_audio, sample_rate
            )
        
        # 5. Prosody score
        prosody = self._evaluate_prosody(generated_audio, sample_rate)
        
        return QualityScore(
            mos=mos,
            naturalness=naturalness,
            intelligibility=intelligibility,
            speaker_similarity=similarity,
            prosody_score=prosody,
        )
    
    def _predict_mos(self, audio: np.ndarray, sr: int) -> float:
        """UTMOS: Automatic MOS prediction"""
        # In practice, a UTMOS model would be used
        # Here we use simplified feature-based estimation
        
        # SNR estimation
        signal_power = np.mean(audio ** 2)
        if signal_power == 0:
            return 1.0
        
        # Spectral flatness (natural speech tends to have low values)
        spectrum = np.abs(np.fft.rfft(audio))
        spectral_flatness = np.exp(np.mean(np.log(spectrum + 1e-10))) / (np.mean(spectrum) + 1e-10)
        
        # Simplified MOS estimation (a neural network would be used in practice)
        mos = 3.5 - 2.0 * spectral_flatness + 0.5 * np.log10(signal_power + 1e-10)
        return np.clip(mos, 1.0, 5.0)
    
    def _evaluate_naturalness(self, audio: np.ndarray, sr: int) -> float:
        """Evaluate naturalness"""
        # Analyze pitch variation patterns
        # Natural speech has moderate pitch variation
        frame_size = int(sr * 0.025)
        hop_size = int(sr * 0.010)
        
        pitches = []
        for start in range(0, len(audio) - frame_size, hop_size):
            frame = audio[start:start + frame_size]
            pitch = self._estimate_pitch(frame, sr)
            if pitch > 0:
                pitches.append(pitch)
        
        if len(pitches) < 2:
            return 0.5
        
        # Calculate coefficient of variation (CV) of pitch
        pitch_cv = np.std(pitches) / (np.mean(pitches) + 1e-10)
        
        # CV range for natural speech (0.1-0.3)
        if 0.1 <= pitch_cv <= 0.3:
            naturalness = 1.0
        elif pitch_cv < 0.1:
            naturalness = pitch_cv / 0.1
        else:
            naturalness = max(0.0, 1.0 - (pitch_cv - 0.3) / 0.5)
        
        return naturalness
    
    def _estimate_pitch(self, frame: np.ndarray, sr: int) -> float:
        """Pitch estimation using autocorrelation method"""
        if np.max(np.abs(frame)) < 0.01:
            return 0.0
        
        corr = np.correlate(frame, frame, mode='full')
        corr = corr[len(corr) // 2:]
        
        # Search for the first peak (50Hz-500Hz range)
        min_lag = sr // 500
        max_lag = sr // 50
        
        if max_lag >= len(corr):
            return 0.0
        
        search = corr[min_lag:max_lag]
        if len(search) == 0:
            return 0.0
        
        peak_idx = np.argmax(search) + min_lag
        return sr / peak_idx if peak_idx > 0 else 0.0
    
    def _evaluate_intelligibility(self, audio: np.ndarray, sr: int) -> float:
        """Evaluate intelligibility (STOI approximation)"""
        # Analyze short-time energy variation
        frame_size = int(sr * 0.025)
        hop_size = int(sr * 0.010)
        
        energies = []
        for start in range(0, len(audio) - frame_size, hop_size):
            frame = audio[start:start + frame_size]
            energies.append(np.sum(frame ** 2))
        
        if len(energies) < 2:
            return 0.5
        
        energies = np.array(energies)
        # Dynamic range of energy
        dynamic_range = 10 * np.log10(
            (np.max(energies) + 1e-10) / (np.mean(energies) + 1e-10)
        )
        
        # Moderate dynamic range as an intelligibility indicator
        return np.clip(dynamic_range / 30.0, 0.0, 1.0)
    
    def _evaluate_speaker_similarity(
        self, gen_audio: np.ndarray, ref_audio: np.ndarray, sr: int
    ) -> float:
        """Evaluate speaker similarity"""
        # Simplified comparison using MFCC
        gen_mfcc = self._extract_mfcc(gen_audio, sr)
        ref_mfcc = self._extract_mfcc(ref_audio, sr)
        
        # Cosine similarity
        gen_mean = np.mean(gen_mfcc, axis=0)
        ref_mean = np.mean(ref_mfcc, axis=0)
        
        similarity = np.dot(gen_mean, ref_mean) / (
            np.linalg.norm(gen_mean) * np.linalg.norm(ref_mean) + 1e-10
        )
        
        return max(0.0, similarity)
    
    def _extract_mfcc(self, audio: np.ndarray, sr: int, n_mfcc: int = 13) -> np.ndarray:
        """MFCC extraction (simplified version)"""
        # In practice, librosa would be used
        frame_size = int(sr * 0.025)
        hop_size = int(sr * 0.010)
        
        mfccs = []
        for start in range(0, len(audio) - frame_size, hop_size):
            frame = audio[start:start + frame_size]
            spectrum = np.abs(np.fft.rfft(frame))
            log_spectrum = np.log(spectrum + 1e-10)
            cepstrum = np.fft.irfft(log_spectrum)
            mfccs.append(cepstrum[:n_mfcc])
        
        return np.array(mfccs) if mfccs else np.zeros((1, n_mfcc))
    
    def _evaluate_prosody(self, audio: np.ndarray, sr: int) -> float:
        """Evaluate prosody"""
        # Evaluate temporal change patterns of energy and pitch
        frame_size = int(sr * 0.025)
        hop_size = int(sr * 0.010)
        
        energies = []
        for start in range(0, len(audio) - frame_size, hop_size):
            frame = audio[start:start + frame_size]
            energies.append(np.sqrt(np.mean(frame ** 2)))
        
        if len(energies) < 10:
            return 0.5
        
        energies = np.array(energies)
        
        # Smoothness of energy variation (fewer abrupt changes = better)
        diff = np.abs(np.diff(energies))
        smoothness = 1.0 - np.clip(np.mean(diff) / (np.mean(energies) + 1e-10), 0, 1)
        
        return smoothness


# Usage example
evaluator = TTSQualityEvaluator()

# Evaluate with dummy audio
sample_rate = 24000
duration = 3.0
t = np.linspace(0, duration, int(sample_rate * duration))
test_audio = 0.5 * np.sin(2 * np.pi * 440 * t)  # 440Hz test tone

score = evaluator.evaluate(test_audio, sample_rate=sample_rate)
print(f"MOS: {score.mos:.2f}")
print(f"Naturalness: {score.naturalness:.2f}")
print(f"Intelligibility: {score.intelligibility:.2f}")
print(f"Prosody: {score.prosody_score:.2f}")
```

---

## 10. TTS Production Deployment

### 10.1 Caching Strategy and Performance Optimization

```python
import hashlib
import json
import os
import time
from typing import Optional
from dataclasses import dataclass

@dataclass
class CacheEntry:
    """Cache entry"""
    audio_path: str
    text_hash: str
    voice_id: str
    params_hash: str
    created_at: float
    file_size: int
    access_count: int = 0
    last_accessed: float = 0.0

class TTSCacheManager:
    """TTS audio cache manager"""
    
    def __init__(self, cache_dir: str, max_size_mb: int = 1000):
        self.cache_dir = cache_dir
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.index_path = os.path.join(cache_dir, "cache_index.json")
        self.index: dict[str, CacheEntry] = {}
        os.makedirs(cache_dir, exist_ok=True)
        self._load_index()
    
    def _make_key(self, text: str, voice_id: str, params: dict) -> str:
        """Generate cache key"""
        content = json.dumps({
            "text": text,
            "voice_id": voice_id,
            "params": params,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def get(self, text: str, voice_id: str, params: dict) -> Optional[bytes]:
        """Retrieve from cache"""
        key = self._make_key(text, voice_id, params)
        
        if key not in self.index:
            return None
        
        entry = self.index[key]
        if not os.path.exists(entry.audio_path):
            del self.index[key]
            return None
        
        # Update access record
        entry.access_count += 1
        entry.last_accessed = time.time()
        
        with open(entry.audio_path, "rb") as f:
            return f.read()
    
    def put(self, text: str, voice_id: str, params: dict, audio: bytes):
        """Save to cache"""
        key = self._make_key(text, voice_id, params)
        
        # Capacity check
        self._ensure_capacity(len(audio))
        
        audio_path = os.path.join(self.cache_dir, f"{key}.mp3")
        with open(audio_path, "wb") as f:
            f.write(audio)
        
        self.index[key] = CacheEntry(
            audio_path=audio_path,
            text_hash=hashlib.md5(text.encode()).hexdigest(),
            voice_id=voice_id,
            params_hash=hashlib.md5(json.dumps(params).encode()).hexdigest(),
            created_at=time.time(),
            file_size=len(audio),
            last_accessed=time.time(),
        )
        
        self._save_index()
    
    def _ensure_capacity(self, needed_bytes: int):
        """Ensure capacity (evict old entries via LRU)"""
        current_size = sum(e.file_size for e in self.index.values())
        
        while current_size + needed_bytes > self.max_size_bytes and self.index:
            # Remove the least recently accessed entry
            oldest_key = min(
                self.index.keys(),
                key=lambda k: self.index[k].last_accessed
            )
            entry = self.index.pop(oldest_key)
            if os.path.exists(entry.audio_path):
                os.remove(entry.audio_path)
            current_size -= entry.file_size
    
    def _load_index(self):
        """Load index"""
        if os.path.exists(self.index_path):
            with open(self.index_path) as f:
                data = json.load(f)
            for key, entry_data in data.items():
                self.index[key] = CacheEntry(**entry_data)
    
    def _save_index(self):
        """Save index"""
        data = {}
        for key, entry in self.index.items():
            data[key] = {
                "audio_path": entry.audio_path,
                "text_hash": entry.text_hash,
                "voice_id": entry.voice_id,
                "params_hash": entry.params_hash,
                "created_at": entry.created_at,
                "file_size": entry.file_size,
                "access_count": entry.access_count,
                "last_accessed": entry.last_accessed,
            }
        with open(self.index_path, "w") as f:
            json.dump(data, f, indent=2)
    
    def stats(self) -> dict:
        """Cache statistics"""
        total_size = sum(e.file_size for e in self.index.values())
        total_accesses = sum(e.access_count for e in self.index.values())
        return {
            "entries": len(self.index),
            "total_size_mb": total_size / (1024 * 1024),
            "max_size_mb": self.max_size_bytes / (1024 * 1024),
            "usage_percent": total_size / self.max_size_bytes * 100,
            "total_accesses": total_accesses,
            "hit_rate_estimate": "N/A",
        }
```

### 10.2 Batch TTS Processor

```python
import asyncio
import time
from dataclasses import dataclass
from typing import Callable, Optional
from concurrent.futures import ThreadPoolExecutor

@dataclass
class TTSJob:
    """TTS processing job"""
    job_id: str
    text: str
    voice_id: str
    params: dict
    priority: int = 0
    callback: Optional[Callable] = None
    status: str = "pending"
    result: Optional[bytes] = None
    error: Optional[str] = None
    created_at: float = 0.0
    completed_at: float = 0.0

class BatchTTSProcessor:
    """Batch TTS processing engine"""
    
    def __init__(
        self, 
        tts_client,
        cache_manager: TTSCacheManager,
        max_concurrent: int = 5,
        rate_limit_per_second: float = 10.0,
    ):
        self.tts_client = tts_client
        self.cache = cache_manager
        self.max_concurrent = max_concurrent
        self.rate_limit = rate_limit_per_second
        self.jobs: dict[str, TTSJob] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent)
        self._last_request_time = 0.0
    
    async def submit_batch(self, jobs: list[TTSJob]) -> list[TTSJob]:
        """Submit batch jobs"""
        for job in jobs:
            job.created_at = time.time()
            self.jobs[job.job_id] = job
        
        # Sort by priority
        sorted_jobs = sorted(jobs, key=lambda j: -j.priority)
        
        # Cache check
        uncached_jobs = []
        for job in sorted_jobs:
            cached = self.cache.get(job.text, job.voice_id, job.params)
            if cached:
                job.result = cached
                job.status = "completed"
                job.completed_at = time.time()
            else:
                uncached_jobs.append(job)
        
        # Process uncached jobs concurrently
        if uncached_jobs:
            semaphore = asyncio.Semaphore(self.max_concurrent)
            tasks = [
                self._process_with_semaphore(semaphore, job)
                for job in uncached_jobs
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
        
        return jobs
    
    async def _process_with_semaphore(self, semaphore, job: TTSJob):
        """Process job with semaphore"""
        async with semaphore:
            await self._process_job(job)
    
    async def _process_job(self, job: TTSJob):
        """Process individual job"""
        try:
            # Rate limiting
            await self._rate_limit_wait()
            
            job.status = "processing"
            
            # Execute TTS (run sync function in thread pool)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self.tts_client.text_to_speech,
                job.text,
                job.voice_id,
                job.params,
            )
            
            job.result = result
            job.status = "completed"
            job.completed_at = time.time()
            
            # Save to cache
            self.cache.put(job.text, job.voice_id, job.params, result)
            
            # Callback
            if job.callback:
                job.callback(job)
                
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            job.completed_at = time.time()
    
    async def _rate_limit_wait(self):
        """Rate limit control"""
        now = time.time()
        min_interval = 1.0 / self.rate_limit
        elapsed = now - self._last_request_time
        
        if elapsed < min_interval:
            await asyncio.sleep(min_interval - elapsed)
        
        self._last_request_time = time.time()
    
    def get_progress(self) -> dict:
        """Progress status"""
        total = len(self.jobs)
        completed = sum(1 for j in self.jobs.values() if j.status == "completed")
        failed = sum(1 for j in self.jobs.values() if j.status == "failed")
        processing = sum(1 for j in self.jobs.values() if j.status == "processing")
        pending = sum(1 for j in self.jobs.values() if j.status == "pending")
        
        return {
            "total": total,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "pending": pending,
            "progress_percent": completed / total * 100 if total > 0 else 0,
        }
```

---

## 11. Troubleshooting Guide

### 11.1 Common Problems and Solutions

```
TTS Troubleshooting
==================================================

Problem 1: Noise in generated audio
─────────────────────────────
Causes:
  - Input text contains special or control characters
  - Model temperature setting is too high
  - Reduced computation precision due to GPU memory shortage

Solutions:
  1. Remove special characters via text preprocessing pipeline
  2. Lower temperature to 0.5-0.7
  3. Reduce batch size / switch to FP32

Problem 2: Unnatural Japanese intonation
─────────────────────────────
Causes:
  - Proper nouns not registered in accent dictionary
  - Inability to handle context-dependent accent changes
  - Regional bias in training data

Solutions:
  1. Add accent information to OpenJTalk user dictionary
  2. Explicitly control prosody with SSML
  3. Fine-tune with domain-specific data

Problem 3: Model stops midway through long text
─────────────────────────────
Causes:
  - Context length limit exceeded
  - Attention mechanism breakdown (attention becomes diffuse on long text)
  - Memory leak

Solutions:
  1. Split by sentence, synthesize, then concatenate
  2. Clear GPU cache after synthesizing each sentence
  3. Insert natural pauses at split points

Problem 4: Inconsistent speaker voice quality
─────────────────────────────
Causes:
  - Stability setting is too low
  - Synthesizing each sentence independently
  - Speaker embedding mismatch

Solutions:
  1. Raise stability to 0.6-0.8
  2. Use audio from the previous sentence as a reference prompt
  3. Share the same speaker embedding vector across all sentences

Problem 5: Hitting API rate limits
─────────────────────────────
Causes:
  - Sending too many requests in a short time
  - Caching not working
  - Retry logic in an infinite loop

Solutions:
  1. Implement caching with TTSCacheManager
  2. Retry with exponential backoff
  3. Reduce request count through batch processing
==================================================
```

### 11.2 Performance Optimization Checklist

```
TTS Performance Optimization Checklist
==================================================

[ ] Text Preprocessing
  [ ] Is the normalization pipeline applied?
  [ ] Is the maximum split length appropriate (100-200 characters recommended)?
  [ ] Are unnecessary symbols and whitespace removed?

[ ] Model Selection
  [ ] Is the model size appropriate for the use case?
  [ ] Have you considered FP16/INT8 quantization?
  [ ] Is optimization with ONNX Runtime / TensorRT possible?

[ ] Caching Strategy
  [ ] Is caching implemented for identical text + voice combinations?
  [ ] Is the cache TTL appropriate?
  [ ] Are memory/disk limits set for the cache?

[ ] Batch Processing
  [ ] Are multiple requests being batched?
  [ ] Is async processing being utilized?
  [ ] Is rate limiting being considered?

[ ] Streaming
  [ ] Is First Token Latency minimized?
  [ ] Is the buffer size appropriate?
  [ ] Are you using splittable formats like PCM/Opus?

[ ] GPU Optimization (Local Models)
  [ ] Is GPU memory being properly managed?
  [ ] Is torch.cuda.empty_cache() being called as needed?
  [ ] Is Mixed Precision (AMP) being used?

[ ] Monitoring
  [ ] Is audio quality being evaluated periodically?
  [ ] Is latency being monitored?
  [ ] Is the error rate being tracked?
==================================================
```

---

## 12. Additional FAQ

### Q4: How much data is needed for VITS fine-tuning?

At minimum, approximately 1 hour of high-quality audio data with transcriptions is needed. Ideally, having 5-10 hours of data will stabilize quality. Data requirements include: (1) Sample rate: 22050Hz or higher, (2) Format: WAV (uncompressed) recommended, (3) Environment: Recording environment with minimal reverb and noise, (4) Text: Accurate transcriptions (accent information is a plus). Training time is approximately 10-24 hours on a GPU (e.g., RTX 3090). To avoid overfitting, always prepare a validation set and perform periodic MOS evaluation.

### Q5: Should I choose OpenAI TTS or ElevenLabs?

It depends on the use case. **OpenAI TTS**: (1) Easy setup (can use existing OpenAI API key), (2) Excellent streaming support, (3) Relatively low cost, (4) Stable quality with 6 fixed voices. **ElevenLabs**: (1) Voice cloning support (can reproduce any voice), (2) Detailed emotion control (stability, similarity, style parameters), (3) Rich voice library, (4) Slightly stronger Japanese support. For prototypes or interactive applications, OpenAI TTS is recommended. For content production where narration quality is critical or custom voices are needed, ElevenLabs is recommended.

### Q6: How can TTS be run in the browser?

There are three main approaches: (1) **Web Speech API**: Built-in browser TTS, no additional libraries needed. Quality depends on the device. Simply use `speechSynthesis.speak(new SpeechSynthesisUtterance("test"))`. (2) **Cloud TTS API calls**: Call OpenAI TTS or ElevenLabs via a backend server and play the generated audio with Web Audio API. (3) **ONNX Runtime Web**: Convert models like VITS to ONNX format and run inference in the browser using WebGL or WebAssembly. Offline operation is possible, but model size and latency are limited. For most production apps, approach (2) with cloud API calls is optimal in terms of quality and development efficiency.

### Q7: How can effects (reverb, EQ, etc.) be applied to TTS audio?

TTS-generated audio is typically "dry," so post-processing is effective depending on the use case. In Python, the `pedalboard` library (by Spotify) is easy to use, allowing you to chain effects like `Reverb`, `Compressor`, `LowpassFilter`, and `HighpassFilter`. For web applications, Web Audio API's `ConvolverNode` (reverb), `BiquadFilterNode` (EQ), and `DynamicsCompressorNode` (compressor) are available. As a tip, low-cut EQ (removing below 80Hz) and high-shelf boost (8kHz+) often improve TTS intelligibility.

---

## 13. References (Additional)

5. Ren, Y., et al. (2021). "FastSpeech 2: Fast and High-Quality End-to-End Text to Speech" — A representative non-autoregressive TTS model
6. Tan, X., et al. (2024). "NaturalSpeech 3: Zero-Shot Speech Synthesis with a Factorized Codec and Diffusion Models" — NaturalSpeech 3 paper. Zero-shot TTS using factorized codec
7. Le, M., et al. (2024). "Voicebox: Text-Guided Multilingual Universal Speech Generation at Scale" — Meta Voicebox. Text-guided multilingual speech generation
8. Łajszczak, M., et al. (2024). "BASE TTS: Lessons from building a billion-parameter text-to-speech model on 100K hours of data" — Amazon BASE TTS. Insights from large-scale TTS training
