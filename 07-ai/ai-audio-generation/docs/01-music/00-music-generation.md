# Music Generation — Suno, Udio, MusicGen

> An explanation of how AI music generation technology works, a comparison of major services, and prompt engineering techniques

## What You Will Learn in This Chapter

1. Technical architectures for AI music generation (codec language models, diffusion models)
2. Features and use cases of major services (Suno, Udio, MusicGen)
3. Effective prompt writing and music generation workflows


## Prerequisites

Understanding the following topics will help you get more out of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Technical Foundations of AI Music Generation

### 1.1 Architecture Classification of Music Generation Models

```
Major Architectures for AI Music Generation
==================================================

1. Codec Language Model Type (MusicGen, MusicLM)
   Text → LM → Audio Codec → Waveform
   ┌──────┐   ┌──────────┐   ┌─────────┐   ┌──────┐
   │Prompt│──→│Language  │──→│Codec    │──→│Audio │
   │      │   │Model     │   │Decoder  │   │Wave  │
   └──────┘   │(Transformer)│ │(Encodec)│   └──────┘
              └──────────┘   └─────────┘

2. Diffusion Model Type (Stable Audio, Riffusion)
   Text → Diffusion in Latent Space → Decode → Waveform
   ┌──────┐   ┌──────────┐   ┌─────────┐   ┌──────┐
   │Prompt│──→│Diffusion │──→│VAE      │──→│Audio │
   │      │   │(UNet)    │   │Decoder  │   │Wave  │
   └──────┘   └──────────┘   └─────────┘   └──────┘

3. Hybrid Type (Suno, Udio)
   Text + Lyrics → Composite Model → Music (Vocal + Accompaniment)
   ┌──────────┐   ┌───────────────┐   ┌──────┐
   │Prompt    │──→│Multi-stage    │──→│Full  │
   │+ Lyrics  │   │Generation     │   │Song  │
   └──────────┘   │(Proprietary)  │   └──────┘
                  └───────────────┘
==================================================
```

### 1.2 Audio Tokenization with Encodec

```python
# Encodec concept: Converting audio into token sequences

class EncodecConcept:
    """
    Encodec (Meta): Neural audio codec
    - Audio waveform → Discrete token sequence → Audio waveform
    - Multiple codebooks (residual quantization)
    - Quality control based on bandwidth
    """

    def __init__(self):
        self.n_codebooks = 8        # Number of codebooks
        self.codebook_size = 1024   # Vocabulary size per codebook
        self.frame_rate = 75        # 75 Hz (1 second = 75 frames)

    def encode(self, audio_waveform):
        """Audio → Token sequence"""
        # Step 1: Feature extraction with encoder (CNN)
        features = self.encoder(audio_waveform)
        # Step 2: Discretization via residual vector quantization (RVQ)
        # 1st codebook: Coarse representation
        # 2nd and beyond: Correct quantization error from previous
        codes = self.quantizer(features)  # shape: (n_codebooks, n_frames)
        return codes  # e.g.: (8, 75) for 1 second of audio

    def decode(self, codes):
        """Token sequence → Audio"""
        features = self.dequantizer(codes)
        audio = self.decoder(features)
        return audio

# Usage in MusicGen
# Text → Transformer LM → Encodec codes → Encodec decoder → Audio
```

### 1.3 How Text-Music Alignment Works

```python
# CLAP (Contrastive Language-Audio Pretraining):
# Semantic alignment between text and music

class CLAPConcept:
    """
    CLAP: Maps text and audio into a shared embedding space
    - Architecture similar to CLIP for images
    - Text encoder + Audio encoder
    - Contrastive learning brings matching pairs closer
    """

    def __init__(self):
        self.text_encoder = None  # BERT/RoBERTa-based
        self.audio_encoder = None  # HTS-AT / HTSAT-based
        self.embedding_dim = 512

    def compute_similarity(self, text: str, audio_path: str) -> float:
        """Compute similarity between text and audio"""
        text_embedding = self.text_encoder(text)  # (512,)
        audio_embedding = self.audio_encoder(audio_path)  # (512,)

        # Cosine similarity
        similarity = np.dot(text_embedding, audio_embedding) / (
            np.linalg.norm(text_embedding) * np.linalg.norm(audio_embedding)
        )
        return similarity

    def rank_generations(self, prompt: str, audio_paths: list) -> list:
        """Rank multiple generated music pieces by prompt match"""
        scores = []
        for path in audio_paths:
            score = self.compute_similarity(prompt, path)
            scores.append((score, path))
        return sorted(scores, reverse=True)

# Usage example: Ranking generation candidates
# clap = CLAPConcept()
# ranked = clap.rank_generations(
#     "upbeat electronic dance music",
#     ["gen_1.wav", "gen_2.wav", "gen_3.wav"]
# )
```

### 1.4 Detailed Mechanisms of Conditional Generation

```
Mechanisms of Conditional Music Generation
==================================================

1. Classifier-Free Guidance (CFG)
   ┌────────────────────────────────────────┐
   │ output = (1 + w) * cond_output         │
   │          - w * uncond_output            │
   │                                        │
   │ w = CFG scale (higher = more faithful  │
   │     to prompt)                         │
   │ cond_output = Prompt-conditioned output│
   │ uncond_output = Unconditional output   │
   └────────────────────────────────────────┘

   Effect of CFG scale:
   - w = 1.0: Weak conditioning (high diversity)
   - w = 3.0: Standard (balanced)
   - w = 5.0+: Strong conditioning (faithful to prompt but low diversity)

2. Melody-Conditioned Generation
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │Reference │──→│Chromagram│──→│Cross-    │──→ Output
   │Melody    │   │Extraction│   │Attention │
   └──────────┘   └──────────┘   │with LM   │
                                 └──────────┘
   * Chromagram: Energy distribution across 12 semitones
   * Generates new music while preserving the melodic contour

3. Audio-Conditioned Generation (AudioGen-style approach)
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │Reference │──→│Audio     │──→│Concat    │──→ Output
   │Audio     │   │Encoder   │   │Prompting │
   └──────────┘   └──────────┘   └──────────┘
   * Generates while inheriting the style of the reference audio
==================================================
```

---

## 2. Details of Major Services

### 2.1 MusicGen (Meta)

```python
from audiocraft.models import MusicGen
from audiocraft.data.audio import audio_write

# Load MusicGen model
model = MusicGen.get_pretrained("facebook/musicgen-large")
model.set_generation_params(
    duration=30,          # Generation duration (seconds)
    top_k=250,           # Top-K sampling
    top_p=0.0,           # Top-P sampling (0=disabled)
    temperature=1.0,     # Temperature parameter
    cfg_coef=3.0,        # Classifier-Free Guidance coefficient
)

# Music generation from text
descriptions = [
    "upbeat electronic dance music with heavy bass and synth leads, 128 BPM",
    "gentle acoustic guitar fingerpicking with soft piano, relaxing ambient",
    "epic orchestral soundtrack with dramatic strings and brass, cinematic",
]

wav = model.generate(descriptions)
# wav shape: (3, 1, sample_rate * duration)

# Save
for i, one_wav in enumerate(wav):
    audio_write(
        f"output_{i}",
        one_wav.cpu(),
        model.sample_rate,
        strategy="loudness",
        loudness_compressor=True,
    )

# Melody-conditioned generation
import torchaudio

melody_waveform, sr = torchaudio.load("melody_reference.wav")
wav = model.generate_with_chroma(
    descriptions=["jazz piano improvisation over the given melody"],
    melody_wavs=melody_waveform,
    melody_sample_rate=sr,
)
```

### 2.2 Advanced Usage of MusicGen

```python
import torch
from audiocraft.models import MusicGen, MultiBandDiffusion
from audiocraft.data.audio import audio_write

class MusicGenAdvanced:
    """Advanced usage patterns for MusicGen"""

    def __init__(self, model_size="large"):
        """
        model_size options:
        - "small": 300M params, low VRAM, fast
        - "medium": 1.5B params, balanced
        - "large": 3.3B params, highest quality
        - "melody": Supports melody conditioning
        - "stereo-*": Supports stereo output
        """
        self.model = MusicGen.get_pretrained(f"facebook/musicgen-{model_size}")
        self.mbd = None  # MultiBandDiffusion (high-quality decoder)

    def generate_with_continuation(
        self,
        prompt: str,
        audio_prefix: str,
        total_duration: float = 60.0,
        overlap: float = 5.0,
    ) -> torch.Tensor:
        """
        Generate continuation of audio (for long-form content)
        Generates tracks beyond MusicGen's 30-second limit
        """
        import torchaudio

        prefix_wav, sr = torchaudio.load(audio_prefix)
        if sr != self.model.sample_rate:
            prefix_wav = torchaudio.functional.resample(
                prefix_wav, sr, self.model.sample_rate
            )

        segments = [prefix_wav]
        generated_duration = prefix_wav.shape[-1] / self.model.sample_rate

        while generated_duration < total_duration:
            # Generate continuation using the overlap portion from the previous segment
            overlap_samples = int(overlap * self.model.sample_rate)
            context = segments[-1][:, -overlap_samples:]

            self.model.set_generation_params(
                duration=min(30, total_duration - generated_duration + overlap),
                cfg_coef=3.0,
            )

            continuation = self.model.generate_continuation(
                prompt=context.unsqueeze(0),
                prompt_sample_rate=self.model.sample_rate,
                descriptions=[prompt],
            )

            # Merge overlap portions with crossfade
            new_segment = continuation[0][:, overlap_samples:]
            segments.append(new_segment)
            generated_duration += new_segment.shape[-1] / self.model.sample_rate

        return torch.cat(segments, dim=-1)

    def generate_variations(
        self,
        prompt: str,
        n_variations: int = 5,
        temperature_range: tuple = (0.7, 1.3),
    ) -> list:
        """
        Generate different variations from the same prompt
        Control diversity by varying the temperature parameter
        """
        variations = []
        temps = torch.linspace(
            temperature_range[0], temperature_range[1], n_variations
        )

        for temp in temps:
            self.model.set_generation_params(
                duration=15,
                temperature=float(temp),
                top_k=250,
                cfg_coef=3.0,
            )
            wav = self.model.generate([prompt])
            variations.append({
                "audio": wav[0],
                "temperature": float(temp),
            })

        return variations

    def batch_generate_with_styles(
        self,
        base_theme: str,
        styles: list,
    ) -> dict:
        """
        Batch-generate the same theme in different styles
        e.g.: Generate "summer beach" in Jazz, Lo-fi, Rock, etc.
        """
        prompts = [f"{style} music about {base_theme}" for style in styles]

        self.model.set_generation_params(duration=30, cfg_coef=3.0)
        wavs = self.model.generate(prompts)

        results = {}
        for i, style in enumerate(styles):
            audio_write(
                f"{base_theme}_{style}",
                wavs[i].cpu(),
                self.model.sample_rate,
                strategy="loudness",
            )
            results[style] = wavs[i]

        return results

# Usage example
gen = MusicGenAdvanced("large")

# Long-form generation (60 seconds)
long_track = gen.generate_with_continuation(
    prompt="ambient electronic with evolving textures",
    audio_prefix="seed_audio.wav",
    total_duration=60.0,
)

# Generate 5 variations
variations = gen.generate_variations(
    prompt="upbeat J-Pop with catchy synth melody",
    n_variations=5,
)
```

### 2.3 Using the Suno API

```python
import requests
import time

class SunoClient:
    """Suno AI music generation client (unofficial API concept)"""

    BASE_URL = "https://api.suno.ai/v1"

    def __init__(self, api_key: str):
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def generate_song(
        self,
        prompt: str,
        lyrics: str = None,
        style: str = None,
        title: str = None,
        instrumental: bool = False,
    ) -> dict:
        """Generate a song"""
        payload = {
            "prompt": prompt,
            "make_instrumental": instrumental,
        }
        if lyrics:
            payload["lyrics"] = lyrics
        if style:
            payload["style"] = style
        if title:
            payload["title"] = title

        response = requests.post(
            f"{self.BASE_URL}/generate",
            json=payload,
            headers=self.headers,
        )
        return response.json()

    def wait_for_completion(self, task_id: str, timeout: int = 300) -> dict:
        """Wait for generation to complete"""
        start = time.time()
        while time.time() - start < timeout:
            status = self.check_status(task_id)
            if status["state"] == "completed":
                return status
            elif status["state"] == "failed":
                raise Exception(f"Generation failed: {status.get('error')}")
            time.sleep(5)
        raise TimeoutError("Generation timed out")

# Usage example
client = SunoClient("your-api-key")

# Song with vocals
result = client.generate_song(
    prompt="A bright pop song themed around a summer beach",
    lyrics="""
[Verse 1]
I can hear the sound of the waves
Under the blue sky
The wind is blowing gently
Summer is beginning

[Chorus]
Let's run to the sea
Under the shining sun
Today is the best day
An unforgettable summer
""",
    style="J-Pop, upbeat, summer vibes",
    title="Summer Beach",
)
```

### 2.4 Prompt Engineering

```python
# Components of a music generation prompt

music_prompt_template = {
    "genre": "electronic, jazz, classical, rock, J-Pop, lo-fi, ambient",
    "mood": "upbeat, melancholic, energetic, relaxing, dramatic, ethereal",
    "tempo": "slow (60-80 BPM), medium (90-120 BPM), fast (130-160 BPM)",
    "instruments": "piano, guitar, synth, strings, drums, bass, brass, flute",
    "structure": "intro, verse, chorus, bridge, outro, build-up, drop",
    "quality_modifiers": "professional, studio quality, high fidelity, warm tone",
    "reference": "in the style of ..., reminiscent of ..., inspired by ...",
}

# Effective prompt examples
effective_prompts = [
    # Genre + Mood + Instruments + Tempo + Quality
    "Lo-fi hip hop beat with jazzy piano chords, mellow saxophone, "
    "vinyl crackle, and soft drum loops. Relaxing study music at 85 BPM. "
    "Warm and nostalgic tone.",

    # Scene description style
    "Soundtrack for walking through a neon-lit Tokyo street at night. "
    "Synthwave with Japanese city pop influences. Electric guitar, "
    "retro synthesizers, and a groovy bassline. 110 BPM.",

    # Emotional expression style
    "A bittersweet farewell song. Gentle acoustic guitar fingerpicking "
    "with a delicate female vocal melody. Gradually building with soft "
    "strings joining midway. Emotional and cinematic.",
]
```

### 2.5 Systematic Prompt Optimization Methods

```python
class MusicPromptOptimizer:
    """Systematic optimization of music generation prompts"""

    # Prompt component templates
    PROMPT_COMPONENTS = {
        "genre": {
            "weight": "High",
            "examples": [
                "electronic", "jazz", "classical", "rock", "hip hop",
                "ambient", "folk", "R&B", "metal", "country",
                "J-Pop", "K-Pop", "bossa nova", "reggae", "funk",
            ],
            "tip": "Combine multiple genres to create uniqueness",
        },
        "mood": {
            "weight": "High",
            "examples": [
                "upbeat", "melancholic", "energetic", "peaceful",
                "dark", "ethereal", "nostalgic", "triumphant",
                "mysterious", "playful", "tense", "dreamy",
            ],
            "tip": "Emotional transitions (e.g., 'starting calm, building to triumphant') are effective",
        },
        "instruments": {
            "weight": "Medium",
            "examples": [
                "acoustic guitar", "electric piano", "synthesizer pads",
                "orchestral strings", "808 bass", "jazz drums",
                "flute", "saxophone", "choir", "harp",
            ],
            "tip": "The more specific the instrument names, the more accurate the output",
        },
        "tempo": {
            "weight": "Medium",
            "examples": [
                "slow (60-80 BPM)", "moderate (90-110 BPM)",
                "upbeat (120-140 BPM)", "fast (150-170 BPM)",
            ],
            "tip": "Explicitly specifying BPM values improves stability",
        },
        "production": {
            "weight": "Low",
            "examples": [
                "studio quality", "lo-fi aesthetic", "vinyl warmth",
                "crisp modern production", "raw and organic",
                "heavily reverbed", "dry and intimate",
            ],
            "tip": "Use production style to control the atmosphere",
        },
    }

    def build_prompt(
        self,
        genre: str,
        mood: str,
        instruments: list = None,
        tempo: str = None,
        production: str = None,
        scene: str = None,
        negative: str = None,
    ) -> str:
        """Build a structured prompt"""
        parts = [genre]

        if mood:
            parts.append(f"{mood} atmosphere")
        if instruments:
            parts.append(f"featuring {', '.join(instruments)}")
        if tempo:
            parts.append(f"at {tempo}")
        if production:
            parts.append(f"with {production} production")
        if scene:
            parts.append(f"evoking {scene}")

        prompt = ", ".join(parts) + "."

        if negative:
            prompt += f" Avoid: {negative}."

        return prompt

    def generate_variations(self, base_prompt: str, n: int = 5) -> list:
        """Generate prompt variations"""
        variations = []
        modifiers = [
            "with more emphasis on rhythm",
            "with a darker, moodier tone",
            "with brighter, more uplifting energy",
            "with minimal arrangement",
            "with rich, layered arrangement",
            "with retro vintage feel",
            "with modern futuristic production",
        ]
        import random
        for _ in range(n):
            modifier = random.choice(modifiers)
            variations.append(f"{base_prompt} {modifier}")
        return variations

    def evaluate_prompt_quality(self, prompt: str) -> dict:
        """Evaluate prompt quality"""
        issues = []
        suggestions = []

        # Length check
        word_count = len(prompt.split())
        if word_count < 5:
            issues.append("Prompt is too short (less than 5 words)")
            suggestions.append("Add genre, mood, instruments, and tempo")
        elif word_count > 50:
            issues.append("Prompt may be too long (over 50 words)")
            suggestions.append("Focus on the most important elements")

        # Required element check
        has_genre = any(g in prompt.lower() for g in ["rock", "jazz", "pop",
                        "electronic", "classical", "ambient", "hip hop"])
        has_mood = any(m in prompt.lower() for m in ["upbeat", "calm", "dark",
                       "energetic", "relaxing", "dramatic"])
        has_instrument = any(i in prompt.lower() for i in ["guitar", "piano",
                            "drums", "synth", "bass", "strings"])

        if not has_genre:
            suggestions.append("Explicitly add a genre")
        if not has_mood:
            suggestions.append("Add a mood/atmosphere")
        if not has_instrument:
            suggestions.append("Specify primary instruments")

        score = 10
        score -= len(issues) * 2
        score -= (3 - sum([has_genre, has_mood, has_instrument])) * 1.5

        return {
            "score": max(0, min(10, score)),
            "issues": issues,
            "suggestions": suggestions,
            "has_genre": has_genre,
            "has_mood": has_mood,
            "has_instrument": has_instrument,
            "word_count": word_count,
        }

# Usage example
optimizer = MusicPromptOptimizer()

prompt = optimizer.build_prompt(
    genre="Lo-fi hip hop",
    mood="nostalgic and cozy",
    instruments=["jazzy piano", "vinyl crackle", "soft drums"],
    tempo="85 BPM",
    production="warm lo-fi",
    scene="studying in a rainy cafe",
)
print(prompt)
# "Lo-fi hip hop, nostalgic and cozy atmosphere, featuring jazzy piano,
#  vinyl crackle, soft drums, at 85 BPM, with warm lo-fi production,
#  evoking studying in a rainy cafe."

quality = optimizer.evaluate_prompt_quality(prompt)
print(f"Quality score: {quality['score']}/10")
```

### 2.6 Lyrics Structure Guidelines

```python
# Lyrics format guide for Suno / Udio

class LyricsFormatter:
    """Lyrics formatter for AI music generation"""

    # Lyrics structure tags
    STRUCTURE_TAGS = {
        "[Intro]": "Instrument-only intro",
        "[Verse]": "Verse (narrative development section)",
        "[Verse 1]": "Verse 1",
        "[Verse 2]": "Verse 2",
        "[Pre-Chorus]": "Pre-chorus (build-up to the chorus)",
        "[Chorus]": "Chorus (the most memorable section)",
        "[Bridge]": "Bridge (modulation/development section)",
        "[Outro]": "Outro",
        "[Instrumental]": "Instrumental interlude",
        "[Hook]": "Hook (catchy repeated phrase)",
        "[Breakdown]": "Breakdown (reduced intensity section)",
        "[Drop]": "Drop (EDM climax)",
        "[Rap]": "Rap section",
        "[Spoken]": "Spoken word/dialogue section",
    }

    @staticmethod
    def create_song_structure(style: str = "pop") -> str:
        """Recommended structure templates by genre"""
        structures = {
            "pop": "[Intro]\n[Verse 1]\n[Pre-Chorus]\n[Chorus]\n"
                   "[Verse 2]\n[Pre-Chorus]\n[Chorus]\n[Bridge]\n[Chorus]\n[Outro]",
            "rock": "[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n"
                    "[Chorus]\n[Instrumental]\n[Chorus]\n[Outro]",
            "edm": "[Intro]\n[Breakdown]\n[Drop]\n[Breakdown]\n"
                   "[Drop]\n[Outro]",
            "ballad": "[Intro]\n[Verse 1]\n[Verse 2]\n[Chorus]\n"
                      "[Verse 3]\n[Chorus]\n[Bridge]\n[Chorus]\n[Outro]",
            "rap": "[Intro]\n[Verse 1]\n[Hook]\n[Verse 2]\n"
                   "[Hook]\n[Bridge]\n[Verse 3]\n[Hook]\n[Outro]",
        }
        return structures.get(style, structures["pop"])

    @staticmethod
    def format_lyrics(raw_lyrics: str, style: str = "pop") -> str:
        """Convert raw text lyrics into structured format"""
        lines = [l.strip() for l in raw_lyrics.strip().split("\n") if l.strip()]

        if len(lines) < 4:
            return f"[Verse]\n{raw_lyrics}"

        formatted = []
        chunk_size = 4  # Group 4 lines per section
        sections = ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"]

        for i, section in enumerate(sections):
            start = i * chunk_size
            end = start + chunk_size
            if start >= len(lines):
                break
            section_lines = lines[start:end]
            formatted.append(f"[{section}]")
            formatted.extend(section_lines)
            formatted.append("")

        return "\n".join(formatted)

# Usage example
formatter = LyricsFormatter()
structure = formatter.create_song_structure("pop")
print(structure)
```

---

## 3. Music Generation Workflow

### 3.1 Production Workflow

```
AI Music Production Workflow
==================================================

Phase 1: Concept & Prompt Design
    │
    ├── Determine genre, mood, and tempo
    ├── Select reference tracks
    └── Create prompts (multiple variations)
    │
    ▼
Phase 2: Generation & Selection
    │
    ├── Generate multiple variations (5-10 candidates)
    ├── Select the best candidate
    └── Adjust prompts and regenerate as needed
    │
    ▼
Phase 3: Post-Processing & Editing
    │
    ├── Stem separation (vocals/accompaniment)
    ├── EQ & compression adjustments
    ├── Cut unwanted sections & rearrange structure
    └── Mastering
    │
    ▼
Phase 4: Integration & Finalization
    │
    ├── Integrate with other audio sources
    ├── Final mix
    └── Export in various formats
==================================================
```

### 3.2 Automated Workflow Implementation

```python
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

@dataclass
class MusicGenerationConfig:
    """Music generation configuration"""
    prompt: str
    duration: float = 30.0
    n_candidates: int = 5
    temperature: float = 1.0
    cfg_coef: float = 3.0
    output_dir: str = "./output"
    target_lufs: float = -14.0

class AutoMusicPipeline:
    """Automated music production pipeline"""

    def __init__(self, model_name: str = "facebook/musicgen-large"):
        from audiocraft.models import MusicGen
        self.model = MusicGen.get_pretrained(model_name)

    def run(self, config: MusicGenerationConfig) -> dict:
        """Execute the fully automated pipeline"""
        output_dir = Path(config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Phase 1: Generate multiple candidates
        candidates = self._generate_candidates(config)

        # Phase 2: Quality scoring
        scored = self._score_candidates(candidates, config.prompt)

        # Phase 3: Post-process the best candidate
        best = scored[0]
        processed = self._post_process(best["audio"], config)

        # Phase 4: Export
        output_path = output_dir / "final_output.wav"
        self._export(processed, output_path)

        return {
            "output_path": str(output_path),
            "n_candidates": len(candidates),
            "best_score": best["score"],
            "all_scores": [s["score"] for s in scored],
        }

    def _generate_candidates(self, config):
        """Generate multiple candidates"""
        self.model.set_generation_params(
            duration=config.duration,
            temperature=config.temperature,
            cfg_coef=config.cfg_coef,
        )

        candidates = []
        for i in range(config.n_candidates):
            wav = self.model.generate([config.prompt])
            candidates.append(wav[0])

        return candidates

    def _score_candidates(self, candidates, prompt):
        """Quality scoring"""
        import numpy as np

        scored = []
        for i, audio in enumerate(candidates):
            # Simple scoring: RMS, dynamic range, silence ratio
            samples = audio.cpu().numpy().flatten()
            rms = np.sqrt(np.mean(samples ** 2))
            dynamic_range = np.max(np.abs(samples)) / (rms + 1e-10)
            silence_ratio = np.mean(np.abs(samples) < 0.01)

            score = (
                0.4 * min(rms * 10, 1.0) +          # Adequate volume
                0.3 * min(dynamic_range / 10, 1.0) +  # Dynamic range
                0.3 * (1.0 - silence_ratio)           # Minimal silence
            )

            scored.append({"audio": audio, "score": score, "index": i})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored

    def _post_process(self, audio, config):
        """Post-processing (normalization, EQ, etc.)"""
        import numpy as np

        samples = audio.cpu().numpy()

        # Peak normalization
        peak = np.max(np.abs(samples))
        if peak > 0:
            samples = samples * (0.95 / peak)

        # DC offset removal
        samples = samples - np.mean(samples)

        return samples

    def _export(self, audio, output_path):
        """File export"""
        import soundfile as sf
        import numpy as np

        if audio.ndim > 1:
            audio = audio.squeeze()
        sf.write(str(output_path), audio, 32000)

# Usage example
pipeline = AutoMusicPipeline()
result = pipeline.run(MusicGenerationConfig(
    prompt="Cinematic orchestral music with emotional strings, "
           "building from soft piano to full orchestra, 90 BPM",
    duration=30.0,
    n_candidates=5,
))
print(f"Output: {result['output_path']}")
print(f"Best score: {result['best_score']:.3f}")
```

---

## 4. Use Case Implementations

### 4.1 Automatic Video BGM Generation

```python
class VideoBackgroundMusicGenerator:
    """Automatic BGM generation for video content"""

    # Prompt templates by scene type
    SCENE_PROMPTS = {
        "intro": "corporate intro music, professional, confident, "
                 "modern electronic with clean synths, 110 BPM, 10 seconds",
        "presentation": "soft background music for presentation, "
                        "minimal piano and ambient pads, non-intrusive, "
                        "professional corporate, 90 BPM",
        "action": "high energy action music, driving drums, "
                  "electric guitar riffs, intense and exciting, 140 BPM",
        "emotional": "emotional cinematic music, gentle piano with "
                     "warm strings, touching and heartfelt, 70 BPM",
        "celebration": "upbeat celebration music, happy and bright, "
                       "acoustic guitar with claps and tambourine, 120 BPM",
        "tutorial": "light and friendly tutorial background music, "
                    "ukulele with soft percussion, positive and engaging, "
                    "100 BPM",
        "outro": "gentle outro music, fading out, calm and conclusive, "
                 "soft piano with ambient textures, 80 BPM",
    }

    def generate_for_scenes(self, scenes: list) -> dict:
        """Batch-generate BGM based on a scene list"""
        results = {}
        for scene in scenes:
            prompt = self.SCENE_PROMPTS.get(
                scene["type"],
                self.SCENE_PROMPTS["presentation"]
            )
            # Add duration specification
            if "duration" in scene:
                prompt += f", {scene['duration']} seconds"

            results[scene["name"]] = {
                "prompt": prompt,
                "type": scene["type"],
            }
        return results

    def generate_loopable(self, prompt: str, duration: float = 30.0) -> str:
        """Generate loopable BGM"""
        loop_prompt = prompt + ". Seamless loop, consistent energy level."
        # In practice, the model would be called here
        return loop_prompt

# Usage example
bgm_gen = VideoBackgroundMusicGenerator()
scenes = [
    {"name": "intro", "type": "intro", "duration": 10},
    {"name": "main_content", "type": "tutorial", "duration": 120},
    {"name": "ending", "type": "outro", "duration": 15},
]
bgm_plan = bgm_gen.generate_for_scenes(scenes)
```

### 4.2 Dynamic Game Music Generation

```python
class GameMusicEngine:
    """Dynamic music generation engine for games"""

    # Music parameters mapped to game states
    GAME_STATES = {
        "exploration": {
            "prompt": "peaceful exploration music, fantasy RPG, "
                      "gentle flute and harp, ambient nature sounds",
            "energy": 0.3,
            "tempo": "70 BPM",
        },
        "combat": {
            "prompt": "intense battle music, epic orchestral, "
                      "pounding drums, aggressive brass, urgent strings",
            "energy": 0.9,
            "tempo": "150 BPM",
        },
        "boss_fight": {
            "prompt": "epic boss battle music, heavy metal meets orchestra, "
                      "choir chanting, double bass drums, distorted guitars",
            "energy": 1.0,
            "tempo": "170 BPM",
        },
        "town": {
            "prompt": "medieval town music, cheerful and bustling, "
                      "acoustic guitar, fiddle, accordion, tavern atmosphere",
            "energy": 0.5,
            "tempo": "110 BPM",
        },
        "dungeon": {
            "prompt": "dark dungeon ambient music, eerie and mysterious, "
                      "deep drones, distant echoes, subtle percussion",
            "energy": 0.4,
            "tempo": "60 BPM",
        },
        "victory": {
            "prompt": "triumphant victory fanfare, heroic brass, "
                      "celebratory orchestral, rising melody",
            "energy": 0.8,
            "tempo": "120 BPM",
        },
    }

    def get_music_for_state(self, game_state: str,
                             intensity: float = 1.0) -> dict:
        """Get music parameters for a given game state"""
        state_config = self.GAME_STATES.get(
            game_state, self.GAME_STATES["exploration"]
        )

        # Adjust prompt based on intensity
        prompt = state_config["prompt"]
        if intensity > 0.7:
            prompt += " More intense and dramatic."
        elif intensity < 0.3:
            prompt += " More subdued and calm."

        return {
            "prompt": prompt,
            "energy": state_config["energy"] * intensity,
            "tempo": state_config["tempo"],
        }

    def create_transition(self, from_state: str, to_state: str,
                           duration_seconds: float = 5.0) -> str:
        """Create transition music prompt for state changes"""
        from_config = self.GAME_STATES.get(from_state, {})
        to_config = self.GAME_STATES.get(to_state, {})

        return (
            f"Musical transition from {from_config.get('prompt', '')} "
            f"to {to_config.get('prompt', '')}, "
            f"smooth crossfade, {duration_seconds} seconds"
        )
```

---

## 5. Comparison Tables

### 5.1 Major Music Generation Service Comparison

| Item | Suno | Udio | MusicGen | Stable Audio |
|------|------|------|----------|-------------|
| Type | SaaS | SaaS | OSS | SaaS/OSS |
| Vocal Generation | Supported | Supported | Not Supported | Not Supported |
| Lyrics Input | Supported | Supported | Not Supported | Not Supported |
| Max Length | ~4 min | ~2 min | 30 sec (standard) | 190 sec |
| Quality | High | High | Medium-High | Medium-High |
| Customization | Prompt | Prompt | Code Control | Prompt |
| Commercial Use | Paid Plan | Paid Plan | MIT License | Conditional |
| Local Execution | No | No | Yes | Open version available |
| GPU Requirements | None | None | 16GB+ VRAM | 8GB+ VRAM |
| API | Available | Available | Python | Available |

### 5.2 Recommended Services by Use Case

| Use Case | Recommended | Reason |
|----------|-------------|--------|
| Songs with Vocals | Suno / Udio | Supports vocal generation |
| BGM / Instrumental | MusicGen / Stable Audio | High instrument audio quality |
| Prototyping | Suno | Easy to use, high quality |
| R&D | MusicGen | OSS, customizable |
| Game Music | Stable Audio | Supports loop music |
| Video BGM | Suno / Stable Audio | Easy length and mood control |
| Commercial Use (Low Cost) | MusicGen | MIT License, free |
| Brand Sound | MusicGen + Fine-tuning | Can learn custom styles |

### 5.3 Performance Comparison by Model Size (MusicGen)

| Model | Parameters | VRAM | Generation Speed (30s) | Quality | Recommended Use |
|-------|-----------|------|----------------------|---------|----------------|
| small | 300M | ~4GB | ~5 sec | Medium | Prototyping, testing |
| medium | 1.5B | ~8GB | ~15 sec | Medium-High | Balanced |
| large | 3.3B | ~16GB | ~30 sec | High | Production quality |
| melody | 1.5B | ~8GB | ~15 sec | High (melody) | Melody conditioning |
| stereo-small | 300M | ~4GB | ~8 sec | Medium | Stereo output |
| stereo-large | 3.3B | ~16GB | ~40 sec | High | High-quality stereo |

---

## 6. Troubleshooting

### 6.1 Common Problems and Solutions

```
Problem: Generated music contains noise or artifacts
==================================================
Cause:
- Temperature parameter is too high
- CFG coefficient is inappropriate
- Model size is too small

Solution:
1. Set temperature to 0.8-1.0 range
2. Adjust cfg_coef in the 3.0-5.0 range
3. Use the large model
4. Improve quality with MultiBandDiffusion (MBD) decoder:
   mbd = MultiBandDiffusion.get_mbd_musicgen()
   wav = mbd.tokens_to_wav(tokens)
==================================================

Problem: Generated music does not match the prompt
==================================================
Cause:
- Prompt is ambiguous
- CFG coefficient is too low
- Instructions are outside the model's understanding

Solution:
1. Make the prompt more specific (genre + instruments + tempo + mood)
2. Increase cfg_coef to 4.0-6.0
3. Use English prompts (majority of training data is in English)
4. Add conditions incrementally and verify results at each step
==================================================

Problem: GPU out-of-memory (OOM) error with MusicGen
==================================================
Cause:
- Model size is too large
- Generation duration is too long
- Batch size is too large

Solution:
1. Switch to a smaller model: musicgen-small (300M)
2. Reduce duration (under 15 seconds)
3. Set batch size to 1
4. Run in float16: model.to(torch.float16)
5. CPU processing (slow but stable): model.to("cpu")
==================================================
```

---

## 7. Anti-Patterns

### 7.1 Anti-Pattern: Vague Prompts

```python
# BAD: Prompts that are too vague
bad_prompts = [
    "make me a nice song",              # What "nice" means is unclear
    "music",                            # Zero information
    "cool rock",                        # Lacks specificity
]

# GOOD: Specific, structured prompts
good_prompts = [
    # Genre + Tempo + Instruments + Mood + Quality
    "Energetic J-Rock with distorted electric guitars, driving drums at 150 BPM, "
    "powerful bass riffs, and anthemic chorus melodies. "
    "Stadium rock energy with modern production quality.",

    # Scene + Details + Technical specifications
    "Ambient electronic music for a sci-fi movie scene. "
    "Deep sub-bass drones, ethereal pad synths, glitchy percussion elements, "
    "and distant vocal textures. Dark and mysterious atmosphere. "
    "Slow tempo around 70 BPM with evolving textures.",
]
```

### 7.2 Anti-Pattern: Using Raw Generated Output

```python
# BAD: Using AI-generated music as-is
def bad_workflow(prompt):
    audio = music_gen.generate(prompt)
    publish(audio)  # Quality variance, copyright risks

# GOOD: Run through a post-processing pipeline
def good_workflow(prompt, n_candidates=5):
    # 1. Generate multiple candidates
    candidates = [music_gen.generate(prompt) for _ in range(n_candidates)]

    # 2. Quality scoring (automatic + manual)
    scored = []
    for i, audio in enumerate(candidates):
        score = auto_quality_score(audio)  # CLAP Score, etc.
        scored.append((score, i, audio))
    scored.sort(reverse=True)

    # 3. Select the best candidate
    best_audio = scored[0][2]

    # 4. Post-processing
    processed = apply_effects(best_audio, [
        ("normalize", {"target_db": -14}),
        ("eq", {"low_cut": 30, "high_cut": 18000}),
        ("compress", {"threshold": -20, "ratio": 3}),
    ])

    # 5. Final review
    return processed
```

### 7.3 Anti-Pattern: Neglecting Copyright Verification

```python
# BAD: Commercial use without verifying copyright status
def bad_commercial_use(service, prompt):
    audio = service.generate(prompt)
    sell(audio)  # No license verification

# GOOD: Verify license for each service
def good_commercial_use(service, prompt):
    # Per-service license check
    license_check = {
        "suno_free": {"commercial": False, "credit_required": True},
        "suno_pro": {"commercial": True, "credit_required": False},
        "musicgen": {"commercial": True, "license": "MIT"},
        "stable_audio_free": {"commercial": False},
        "stable_audio_pro": {"commercial": True, "terms": "check website"},
    }

    plan = license_check.get(service.plan)
    if not plan or not plan.get("commercial"):
        raise ValueError(
            f"Commercial use not permitted: {service.plan}. "
            f"Please upgrade to a paid plan."
        )

    audio = service.generate(prompt)

    # Record that the output is AI-generated in metadata
    metadata = {
        "generator": service.name,
        "prompt": prompt,
        "license": plan.get("license", "proprietary"),
        "ai_generated": True,
        "generation_date": datetime.now().isoformat(),
    }

    return audio, metadata
```

---

## 8. Best Practices

### 8.1 Best Practices for Music Generation

```
Prompt Design:
==================================================
1. Write prompts in English (majority of training data is in English)
2. Structure as: Genre → Mood → Instruments → Tempo
3. Specify exact BPM values
4. Use negative prompts (elements to avoid)
5. Describe the reference track's style specifically

Quality Control:
==================================================
1. Always generate multiple candidates (5-10) and select the best
2. Combine automatic quality scoring with human listening evaluation
3. Quantitatively evaluate prompt match using CLAP Score
4. Apply loudness normalization (-14 LUFS) to final output
5. Apply minimal EQ processing (low cut at 80Hz, high cut at 18kHz)

Workflow:
==================================================
1. Iterate on prompts (rough specification → fine-tuning → final version)
2. Follow the flow: Generate → Stem separation → Individual editing → Recombine
3. Use AI-guided suggestions with human final judgment
4. Record generation logs (prompts, parameters, scores)
5. Template successful prompt patterns for reuse
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code

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
        """Main processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
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
        """Remove by key"""
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

# Test
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

    print(f"Inefficient version: {slow_time:.4f} sec")
    print(f"Efficient version:   {fast_time:.6f} sec")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 9. FAQ

### Q1: What about copyright for AI-generated music?

The law is still evolving, but as of 2025-2026, the general consensus is as follows. (1) Copyright of AI-generated works: In many jurisdictions, works autonomously generated by AI are not considered copyrightable. (2) Rights of prompt creators: If there is sufficient creative contribution, partial rights may be recognized. (3) Terms of service for each service: Suno's paid plans permit commercial use and grant usage rights to users. MusicGen is MIT-licensed, but discussions about training data are ongoing. Always review the terms of service before commercial use.

### Q2: Is fine-tuning MusicGen possible?

Yes. Meta's official audiocraft repository includes scripts for fine-tuning. The procedure involves (1) preparing training data (audio file + text description pairs), (2) configuring audiocraft_trainer, and (3) resuming training from existing checkpoints. However, fine-tuning the large model requires 32GB+ VRAM. For small-scale datasets, starting with the small model is recommended.

### Q3: Are there ways to automatically evaluate generated music quality?

Key evaluation metrics include: (1) FAD (Frechet Audio Distance): Distribution distance between generated and reference music, (2) CLAP Score: Semantic match between text and audio, (3) KL Divergence: Distribution difference in genre/instrument classification. However, music quality has significant subjective elements, and automated metrics alone are insufficient. In practice, combining automated scoring for rough filtering with human listening evaluation is the most effective approach.

### Q4: What should I be aware of when using generated music in commercial content (YouTube videos, ads, etc.)?

(1) Verify the commercial use license for the service you are using (e.g., Suno Pro plan). (2) Keep generation proof (prompt, generation date, service name) in case of false Content ID system detections. (3) Listen and verify that the output does not closely resemble other tracks. (4) Comply with any disclosure requirements about AI-generated content. (5) Regularly check for updates to the service's terms of use.

### Q5: How can I generate long tracks (3+ minutes)?

MusicGen's standard is 30 seconds, but longer tracks are possible through the following methods. (1) Continuation feature: A chaining method where the last few seconds of generated audio are used as input to generate the continuation. (2) Suno/Udio: Can generate tracks up to 4 minutes at once. (3) Section joining: Generate Intro, Verse, and Chorus separately, then join with crossfades. (4) Loop generation: Generate 30-second loop material and assemble the structure in a DAW. In terms of quality, Suno/Udio achieve the most stable long-form output.

### Q6: How can I optimize the computational cost of AI music generation?

(1) Start with a small model: musicgen-small often provides sufficient quality. (2) Batch generation: Process multiple prompts at once to improve GPU efficiency. (3) Caching: Cache results for the same prompt to avoid regeneration. (4) INT8 quantization: Quantize the model to reduce VRAM usage. (5) Spot instances: Reduce costs with cloud GPU (AWS, GCP) spot instances. The generation cost per track can be calculated as GPU usage ($0.5-2/hr) x generation time.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Technical Foundation | Two major approaches: codec language model type and diffusion model type |
| Suno/Udio | Supports vocals + lyrics. Paid commercial plans available |
| MusicGen | Meta OSS. Code-controllable, supports fine-tuning |
| Prompts | Be specific with genre + mood + tempo + instruments + quality modifiers |
| Workflow | 4 stages: Generate multiple → Select → Post-process → Finalize |
| Copyright | Check service terms of use. Legal frameworks are still developing |
| Quality Control | Combine CLAP Score + human listening evaluation |
| Long-form Generation | Use continuation feature or direct generation via Suno/Udio |

## Recommended Next Guides

- [01-stem-separation.md](./01-stem-separation.md) — Stem Separation (Demucs, LALAL.AI)
- [02-audio-effects.md](./02-audio-effects.md) — AI Audio Effects
- [03-midi-ai.md](./03-midi-ai.md) — MIDI x AI (Auto-composition, Chord Progression Generation)

## References

1. Copet, J., et al. (2023). "Simple and Controllable Music Generation" — MusicGen paper. Baseline for text-conditioned music generation
2. Agostinelli, A., et al. (2023). "MusicLM: Generating Music From Text" — Google MusicLM. High-quality music generation from text
3. Evans, Z., et al. (2024). "Stable Audio: Fast Timing-Conditioned Latent Audio Diffusion" — Stable Audio. Latent diffusion model-based audio generation
4. Defossez, A., et al. (2023). "High Fidelity Neural Audio Compression" — Encodec paper. Neural audio codec that forms the foundation of music generation
5. Wu, Y., et al. (2023). "Large-Scale Contrastive Language-Audio Pretraining with Feature Fusion and Keyword-to-Caption Augmentation" — CLAP paper. Contrastive learning between text and audio
