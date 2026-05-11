# STT Technologies — Whisper, Google Speech, Azure Speech

> An explanation of the mechanisms behind STT (Speech-to-Text) technology that converts speech to text, a comparison of major services, and implementation patterns

## What You Will Learn in This Chapter

1. Modern STT architectures (CTC, Attention, Transducer) and how they work
2. How OpenAI Whisper works, how to use it, and how to fine-tune it
3. Implementing and choosing between cloud STT APIs (Google, Azure, AWS)


## Prerequisites

Understanding the following will help you get the most out of this guide:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [TTS Technologies — VITS, Bark, ElevenLabs](./02-tts-technologies.md)

---

## 1. STT Technology Architecture

### 1.1 Major STT Architectures

```
Three STT Architectures
==================================================

1. CTC (Connectionist Temporal Classification)
┌────────┐    ┌──────────┐    ┌─────┐
│Mel     │───→│Encoder   │───→│CTC  │───→ Text
│Spectro │    │(Conformer)│   │Loss │
│gram    │    └──────────┘    └─────┘
  * No decoder needed, fast inference
  * Conditional independence assumption (limits accuracy)

2. Attention-based Encoder-Decoder
┌────────┐    ┌──────────┐    ┌──────────┐
│Mel     │───→│Encoder   │───→│Decoder   │───→ Text
│Spectro │    │(Transformer)│  │(Autoregr)│
│gram    │    └──────────┘    └──────────┘
                    ↕ Attention
  * High accuracy (considers context)
  * Slow due to autoregressive decoding

3. Transducer (RNN-T / Conformer-T)
┌────────┐    ┌──────────┐
│Mel     │───→│Encoder   │──┐
│Spectro │    └──────────┘  │ Joint
│gram    │                  ├──────→ Text
              ┌──────────┐  │
              │Prediction│──┘
              │Network   │
              └──────────┘
  * Supports streaming
  * Best of both CTC and Attention
==================================================
```

### 1.2 CTC Architecture in Detail

CTC (Connectionist Temporal Classification) is an approach that maximizes the total probability across all possible alignments without explicitly determining the alignment between input and output.

```python
# Conceptual implementation of a CTC-based STT model
import torch
import torch.nn as nn
import torchaudio

class CTCModel(nn.Module):
    """Speech recognition model using CTC loss"""

    def __init__(
        self,
        input_dim: int = 80,      # Number of mel spectrogram bins
        hidden_dim: int = 512,
        num_layers: int = 6,
        vocab_size: int = 5000,    # Subword vocabulary size
        dropout: float = 0.1,
    ):
        super().__init__()

        # Feature preprocessing: Conv2D subsampling
        self.conv_subsample = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, 32, kernel_size=3, stride=2, padding=1),
            nn.ReLU(),
        )

        # Conformer encoder
        conv_out_dim = 32 * (input_dim // 4)
        self.linear_in = nn.Linear(conv_out_dim, hidden_dim)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden_dim,
            nhead=8,
            dim_feedforward=hidden_dim * 4,
            dropout=dropout,
            batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers)

        # Output layer (including blank token)
        self.output_proj = nn.Linear(hidden_dim, vocab_size + 1)  # +1 for blank

    def forward(self, x, x_lengths):
        """
        x: (batch, time, mel_bins) mel spectrogram
        x_lengths: (batch,) length of each input
        """
        # (B, T, F) -> (B, 1, T, F) -> Conv2D
        x = x.unsqueeze(1)
        x = self.conv_subsample(x)

        # (B, C, T/4, F/4) -> (B, T/4, C*F/4)
        b, c, t, f = x.shape
        x = x.permute(0, 2, 1, 3).reshape(b, t, c * f)

        x = self.linear_in(x)
        x = self.encoder(x)
        logits = self.output_proj(x)

        # log_softmax for CTC
        log_probs = torch.log_softmax(logits, dim=-1)
        return log_probs

    def decode_greedy(self, log_probs):
        """Greedy decoding: select the most probable token"""
        predictions = torch.argmax(log_probs, dim=-1)

        # Remove blanks and collapse consecutive duplicates
        decoded = []
        prev = -1
        for token in predictions[0]:
            token = token.item()
            if token != 0 and token != prev:  # 0 = blank
                decoded.append(token)
            prev = token

        return decoded
```

Key characteristics of CTC:

- **Advantages**: Fast inference since no decoder is needed, good compatibility with streaming processing
- **Limitations**: Cannot model dependencies between output tokens due to the conditional independence assumption
- **Improvements**: Combining with external language models, CTC+Attention hybrid

### 1.3 Transducer Architecture in Detail

The Transducer (especially RNN-T / Conformer-T) is the mainstream architecture for streaming speech recognition.

```python
# Conceptual structure of RNN-Transducer
class RNNTransducer(nn.Module):
    """Simplified implementation of an RNN-T model"""

    def __init__(
        self,
        input_dim: int = 80,
        encoder_dim: int = 512,
        decoder_dim: int = 256,
        joint_dim: int = 512,
        vocab_size: int = 5000,
    ):
        super().__init__()

        # Encoder: processes acoustic features (Conformer-based)
        self.encoder = nn.LSTM(
            input_size=input_dim,
            hidden_size=encoder_dim,
            num_layers=6,
            batch_first=True,
            bidirectional=False,  # Unidirectional for streaming
        )

        # Prediction Network: processes past output tokens
        self.prediction = nn.LSTM(
            input_size=vocab_size,
            hidden_size=decoder_dim,
            num_layers=2,
            batch_first=True,
        )

        # Joint Network: combines Encoder and Prediction outputs
        self.joint_enc = nn.Linear(encoder_dim, joint_dim)
        self.joint_pred = nn.Linear(decoder_dim, joint_dim)
        self.joint_out = nn.Linear(joint_dim, vocab_size + 1)  # +blank

    def forward(self, audio_features, prev_tokens):
        """
        audio_features: (B, T, input_dim)
        prev_tokens: (B, U, vocab_size) one-hot
        """
        enc_out, _ = self.encoder(audio_features)         # (B, T, enc_dim)
        pred_out, _ = self.prediction(prev_tokens)        # (B, U, dec_dim)

        # Joint: (B, T, 1, joint_dim) + (B, 1, U, joint_dim)
        enc_proj = self.joint_enc(enc_out).unsqueeze(2)   # (B, T, 1, J)
        pred_proj = self.joint_pred(pred_out).unsqueeze(1) # (B, 1, U, J)

        joint = torch.tanh(enc_proj + pred_proj)          # (B, T, U, J)
        logits = self.joint_out(joint)                    # (B, T, U, V+1)

        return logits
```

Key design considerations for Transducers:

| Component | Description | Design Consideration |
|-----------|-------------|---------------------|
| Encoder | Processes acoustic features | Streaming support with unidirectional LSTM/Conformer |
| Prediction Network | Acts as a language model | A small LSTM is sufficient (lightweight) |
| Joint Network | Combines and decides | Blank vs. output decision is the bottleneck |
| Beam Search | Decoding | Beam width of 4-10 balances accuracy and speed |

### 1.4 Whisper Architecture

```
Whisper Architecture Details
==================================================

Audio Input (padded to 30 seconds)
    │
    ▼
┌─────────────────────┐
│ Mel Spectrogram      │  80 channels, fixed 30 seconds
│ (80 x 3000 frames)  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Audio Encoder       │
│  ├─ Conv1D (2 layers)│  Positional encoding
│  └─ Transformer      │  tiny:4 layers, base:6 layers,
│     (Self-Attention)  │  small:12 layers, medium:24 layers,
└──────────┬──────────┘  large:32 layers
           │
           │ Cross-Attention
           ▼
┌─────────────────────┐
│  Text Decoder        │  Generates tokens autoregressively
│  ├─ Self-Attention   │
│  ├─ Cross-Attention  │  ← References Encoder output
│  └─ FFN              │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Special Tokens      │
│  <|startoftranscript|>│
│  <|ja|>              │  Language tag
│  <|transcribe|>      │  Task specification
│  <|notimestamps|>    │  Timestamp control
└──────────┬──────────┘
           ▼
      Text Output
==================================================
```

### 1.5 Whisper Training Data and Multilingual Support

Whisper was trained on 680,000 hours of internet audio data. This large-scale weakly supervised training is the source of its high generalization performance.

```
Whisper Training Data Composition
==================================================

Total: 680,000 hours of audio data

Language Distribution:
  English          : ████████████████████ 65%
  European langs   : ██████ 15%
  Asian langs      : ████ 10%
    - Japanese     : ~7,000 hours (estimated)
    - Chinese      : ~12,000 hours (estimated)
    - Korean       : ~3,000 hours (estimated)
  Other            : ███ 10%

Task Distribution:
  Transcription    : 75% (audio → same-language text)
  Translation      : 25% (audio → English text)

Data Sources:
  - Internet videos with subtitles
  - Podcasts + transcriptions
  - Audiobooks + text
  * Weakly supervised = trained without perfect alignment
==================================================
```

### 1.6 Architecture Selection Guide

```
STT Architecture Selection Flowchart
==================================================

               Streaming required?
              /                    \
          Yes                       No
           |                        |
     Real-time                 Need highest
     top priority?             accuracy?
    /        \               /            \
 Yes          No          Yes              No
  |            |     Attention-based    CTC + Language Model
Transducer  Transducer  Encoder-Decoder  (cost-focused)
(Conformer-T) (RNN-T)   (Whisper, etc.)
  |            |          |               |
Latency<100ms Latency<300ms Batch proc. Low-cost proc.
on-device   server      highest acc.  embedded devices

Representative implementations:
  Transducer : Google USM, Conformer-Transducer
  Attention  : Whisper, Canary (NVIDIA NeMo)
  CTC        : wav2vec 2.0, HuBERT
==================================================
```

---

## 2. Whisper Implementation

### 2.1 Basic Usage

```python
import whisper

# Load model
model = whisper.load_model("large-v3")  # tiny, base, small, medium, large-v3

# Basic transcription
result = model.transcribe(
    "audio.wav",
    language="ja",           # Language specification (auto-detection also available)
    task="transcribe",       # transcribe or translate
    fp16=True,               # FP16 for faster GPU inference
)

print(result["text"])

# Detailed results per segment
for segment in result["segments"]:
    print(f"[{segment['start']:.1f}s - {segment['end']:.1f}s] {segment['text']}")
    print(f"  Confidence: {segment['avg_logprob']:.3f}")
```

### 2.2 Whisper Advanced Options

```python
import whisper
import numpy as np

# Detailed parameter configuration
model = whisper.load_model("large-v3")

result = model.transcribe(
    "audio.wav",
    language="ja",
    task="transcribe",

    # Decoding options
    temperature=0.0,            # 0.0 = greedy, >0 = sampling
    best_of=5,                  # Select best from multiple candidates when temperature > 0
    beam_size=5,                # Number of beams for beam search
    patience=1.0,               # Beam search patience
    length_penalty=None,        # Length penalty (None to disable)

    # Preprocessing options
    fp16=True,                  # FP16 inference (GPU required)
    no_speech_threshold=0.6,    # Threshold for silent segments
    logprob_threshold=-1.0,     # Threshold for low-confidence segments
    compression_ratio_threshold=2.4,  # Threshold for repetition detection

    # Output control
    word_timestamps=True,       # Word-level timestamps
    prepend_punctuations="\"'"¿([{-",  # Prepend punctuation
    append_punctuations="\"'.。,，!！?？:：\"')]}、",  # Append punctuation

    # Initial prompt (provides context)
    initial_prompt="The following is meeting minutes. Participants are Tanaka, Sato, and Suzuki.",

    # Conditional text (forces specific format)
    condition_on_previous_text=True,  # Condition on previous segment text
)

# Word-level timestamps
for segment in result["segments"]:
    if "words" in segment:
        for word in segment["words"]:
            print(f"  [{word['start']:.2f}s - {word['end']:.2f}s] {word['word']}")
```

### 2.3 faster-whisper (Optimized Version)

```python
from faster_whisper import WhisperModel

# CTranslate2-optimized version (2-4x faster)
model = WhisperModel(
    "large-v3",
    device="cuda",
    compute_type="float16",  # float16, int8_float16, int8
)

# Batch processing
segments, info = model.transcribe(
    "audio.wav",
    language="ja",
    beam_size=5,
    best_of=5,
    vad_filter=True,         # Skip silent segments with VAD
    vad_parameters=dict(
        min_silence_duration_ms=500,  # Split on silence of 500ms or more
    ),
)

print(f"Detected language: {info.language} (probability: {info.language_probability:.2f})")

for segment in segments:
    print(f"[{segment.start:.1f}s - {segment.end:.1f}s] {segment.text}")
```

### 2.4 Advanced faster-whisper Configuration

```python
from faster_whisper import WhisperModel, BatchedInferencePipeline
import numpy as np

def advanced_faster_whisper_transcription(audio_path: str) -> dict:
    """
    Transcription using advanced faster-whisper settings
    - VAD filtering
    - Batched inference
    - Detailed parameter tuning
    """
    model = WhisperModel(
        "large-v3",
        device="cuda",
        compute_type="float16",
        cpu_threads=4,           # Number of CPU threads
        num_workers=2,           # Number of data loader workers
    )

    # Advanced VAD settings
    vad_params = {
        "threshold": 0.5,                  # VAD probability threshold
        "min_speech_duration_ms": 250,     # Minimum speech duration
        "max_speech_duration_s": 30,       # Maximum speech duration (aligned with Whisper's limit)
        "min_silence_duration_ms": 500,    # Minimum silence duration
        "speech_pad_ms": 200,              # Padding before/after speech
    }

    segments, info = model.transcribe(
        audio_path,
        language="ja",
        beam_size=5,
        best_of=5,
        patience=1.5,
        length_penalty=1.0,
        repetition_penalty=1.2,    # Repetition suppression
        no_repeat_ngram_size=3,    # Forbid 3-gram repetitions
        temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],  # Gradual temperature
        compression_ratio_threshold=2.4,
        log_prob_threshold=-1.0,
        no_speech_threshold=0.6,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=vad_params,
        initial_prompt="The following is Japanese audio.",
    )

    results = {
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "segments": [],
    }

    for segment in segments:
        seg_data = {
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "avg_logprob": segment.avg_logprob,
            "no_speech_prob": segment.no_speech_prob,
            "compression_ratio": segment.compression_ratio,
        }

        if segment.words:
            seg_data["words"] = [
                {
                    "word": w.word,
                    "start": w.start,
                    "end": w.end,
                    "probability": w.probability,
                }
                for w in segment.words
            ]

        results["segments"].append(seg_data)

    return results
```

### 2.5 Fine-tuning Whisper

```python
# Fine-tuning with Hugging Face Transformers

from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
)
from datasets import load_dataset, Audio
import evaluate
import torch
from dataclasses import dataclass
from typing import Any, Dict, List, Union

# Load model and processor
model_name = "openai/whisper-small"
processor = WhisperProcessor.from_pretrained(model_name)
model = WhisperForConditionalGeneration.from_pretrained(model_name)

# Task settings for Japanese
model.config.forced_decoder_ids = processor.get_decoder_prompt_ids(
    language="ja", task="transcribe"
)

# Prepare dataset
dataset = load_dataset("mozilla-foundation/common_voice_16_1", "ja")
dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

def prepare_dataset(batch):
    """Preprocess audio data"""
    audio = batch["audio"]
    batch["input_features"] = processor.feature_extractor(
        audio["array"], sampling_rate=audio["sampling_rate"]
    ).input_features[0]
    batch["labels"] = processor.tokenizer(batch["sentence"]).input_ids
    return batch

# Apply dataset preprocessing
dataset = dataset.map(
    prepare_dataset,
    remove_columns=dataset.column_names["train"],
    num_proc=4,
)

# Custom data collator
@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any
    decoder_start_token_id: int

    def __call__(
        self, features: List[Dict[str, Union[List[int], torch.Tensor]]]
    ) -> Dict[str, torch.Tensor]:
        input_features = [
            {"input_features": f["input_features"]} for f in features
        ]
        batch = self.processor.feature_extractor.pad(
            input_features, return_tensors="pt"
        )

        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(
            label_features, return_tensors="pt"
        )

        labels = labels_batch["input_ids"].masked_fill(
            labels_batch.attention_mask.ne(1), -100
        )

        if (labels[:, 0] == self.decoder_start_token_id).all().cpu().item():
            labels = labels[:, 1:]

        batch["labels"] = labels
        return batch

data_collator = DataCollatorSpeechSeq2SeqWithPadding(
    processor=processor,
    decoder_start_token_id=model.config.decoder_start_token_id,
)

# Evaluation metrics
wer_metric = evaluate.load("wer")
cer_metric = evaluate.load("cer")

def compute_metrics(pred):
    pred_ids = pred.predictions
    label_ids = pred.label_ids
    label_ids[label_ids == -100] = processor.tokenizer.pad_token_id

    pred_str = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
    label_str = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)

    wer = wer_metric.compute(predictions=pred_str, references=label_str)
    cer = cer_metric.compute(predictions=pred_str, references=label_str)

    return {"wer": wer, "cer": cer}

# Training configuration
training_args = Seq2SeqTrainingArguments(
    output_dir="./whisper-ja-finetuned",
    per_device_train_batch_size=16,
    gradient_accumulation_steps=2,
    learning_rate=1e-5,
    warmup_steps=500,
    max_steps=5000,
    fp16=True,
    evaluation_strategy="steps",
    eval_steps=500,
    save_steps=1000,
    predict_with_generate=True,
    generation_max_length=225,
    logging_steps=25,
    report_to=["tensorboard"],
    load_best_model_at_end=True,
    metric_for_best_model="cer",
    greater_is_better=False,
    push_to_hub=False,
)

# Initialize trainer and start training
trainer = Seq2SeqTrainer(
    args=training_args,
    model=model,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    data_collator=data_collator,
    compute_metrics=compute_metrics,
    tokenizer=processor.feature_extractor,
)

trainer.train()
```

### 2.6 Japanese-Specific Fine-tuning Datasets

```python
# Japanese fine-tuning with ReazonSpeech

from datasets import load_dataset, Audio
from transformers import WhisperProcessor

def prepare_reazon_speech_dataset():
    """
    ReazonSpeech: A large-scale Japanese-specific speech dataset
    - Approximately 19,000 hours of Japanese audio
    - NHK news read-aloud audio
    - High-quality alignment
    """
    # Load ReazonSpeech dataset
    dataset = load_dataset(
        "reazon-research/reazonspeech",
        "all",
        trust_remote_code=True,
    )

    # Unify sampling rate
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

    processor = WhisperProcessor.from_pretrained("openai/whisper-small")

    def preprocess(batch):
        audio = batch["audio"]
        # Feature extraction for Whisper
        batch["input_features"] = processor.feature_extractor(
            audio["array"],
            sampling_rate=16000,
        ).input_features[0]
        # Tokenize text
        batch["labels"] = processor.tokenizer(
            batch["transcription"]
        ).input_ids
        return batch

    dataset = dataset.map(preprocess, num_proc=8)
    return dataset

def prepare_jsut_dataset():
    """
    JSUT (Japanese Speech corpus of Saruwatari-lab, University of Tokyo)
    - Approximately 10 hours of high-quality Japanese audio
    - Single female speaker
    - Ideal for small-scale fine-tuning experiments
    """
    dataset = load_dataset("esb/jsut", trust_remote_code=True)
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))
    return dataset

def prepare_common_voice_ja():
    """
    Common Voice Japanese
    - Multi-speaker Japanese dataset by Mozilla
    - Crowdsourced data from diverse speakers
    - Has a validated high-quality subset
    """
    dataset = load_dataset(
        "mozilla-foundation/common_voice_16_1",
        "ja",
        trust_remote_code=True,
    )
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

    # Filter to validated data only
    dataset = dataset.filter(lambda x: x["up_votes"] >= 2 and x["down_votes"] == 0)

    return dataset
```

### 2.7 Whisper Post-processing Pipeline

```python
import re
from typing import Optional

class WhisperPostProcessor:
    """Post-processing pipeline for Whisper output"""

    def __init__(self):
        self.custom_dict = {}  # Custom dictionary (for proper nouns, etc.)

    def add_custom_words(self, word_map: dict):
        """Add custom dictionary entries (for correcting misrecognitions)"""
        self.custom_dict.update(word_map)

    def process(self, text: str) -> str:
        """Execute all post-processing steps sequentially"""
        text = self._remove_hallucinations(text)
        text = self._fix_punctuation(text)
        text = self._apply_custom_dict(text)
        text = self._normalize_numbers(text)
        text = self._remove_filler_words(text)
        return text.strip()

    def _remove_hallucinations(self, text: str) -> str:
        """Remove Whisper hallucination patterns"""
        # Detect and remove repetitive patterns
        # Example: "thank you very muchthank you very muchthank you very much"
        for length in range(5, 50):
            pattern = r'(.{' + str(length) + r',})\1{2,}'
            text = re.sub(pattern, r'\1', text)

        # Typical hallucination phrases
        hallucination_patterns = [
            r'Thank you for watching\.?$',
            r'Please subscribe.*\.?$',
            r'Good job\.?$',
            r'(?:\.{3,})',  # Consecutive periods
            r'(?:。{2,})',  # Consecutive full stops
        ]
        for pattern in hallucination_patterns:
            text = re.sub(pattern, '', text)

        return text

    def _fix_punctuation(self, text: str) -> str:
        """Fix punctuation"""
        # Normalize half-width punctuation to full-width
        text = text.replace(',', '、')
        text = text.replace('.', '。')
        text = text.replace('!', '！')
        text = text.replace('?', '？')

        # Collapse consecutive punctuation marks into one
        text = re.sub(r'[、。]{2,}', '。', text)

        # Add a period at the end if missing
        if text and text[-1] not in '。！？':
            text += '。'

        return text

    def _apply_custom_dict(self, text: str) -> str:
        """Apply custom dictionary replacements"""
        for wrong, correct in self.custom_dict.items():
            text = text.replace(wrong, correct)
        return text

    def _normalize_numbers(self, text: str) -> str:
        """Normalize number representations"""
        # Convert full-width digits to half-width
        zen_to_han = str.maketrans('０１２３４５６７８９', '0123456789')
        text = text.translate(zen_to_han)
        return text

    def _remove_filler_words(self, text: str) -> str:
        """Remove filler words (um, uh, well)"""
        fillers = [
            r'えー[、と]?\s*',
            r'あのー?\s*',
            r'まあ[、]?\s*',
            r'その[、]?\s*(?=\S)',
            r'ええと[、]?\s*',
        ]
        for filler in fillers:
            text = re.sub(filler, '', text)
        return text


# Usage example
post_processor = WhisperPostProcessor()
post_processor.add_custom_words({
    "ファスターウィスパー": "faster-whisper",
    "パイトーチ": "PyTorch",
    "テンサーフロー": "TensorFlow",
    "ギットハブ": "GitHub",
})

raw_text = "えー、本日はファスターウィスパーについて、あの、説明します。。。"
cleaned = post_processor.process(raw_text)
print(cleaned)
# → "本日はfaster-whisperについて説明します。"
```

---

## 3. Cloud STT APIs

### 3.1 Google Speech-to-Text

```python
from google.cloud import speech_v2 as speech

def google_stt(audio_file: str, language: str = "ja-JP") -> str:
    """Google Cloud Speech-to-Text V2"""
    client = speech.SpeechClient()

    with open(audio_file, "rb") as f:
        audio_content = f.read()

    config = speech.RecognitionConfig(
        auto_decoding_config=speech.AutoDetectDecodingConfig(),
        language_codes=[language],
        model="long",  # long, short, telephony, medical_dictation
        features=speech.RecognitionFeatures(
            enable_automatic_punctuation=True,  # Auto punctuation
            enable_word_time_offsets=True,       # Word timestamps
            enable_word_confidence=True,         # Word confidence
        ),
    )

    request = speech.RecognizeRequest(
        recognizer="projects/my-project/locations/global/recognizers/_",
        config=config,
        content=audio_content,
    )

    response = client.recognize(request=request)

    for result in response.results:
        alt = result.alternatives[0]
        print(f"Text: {alt.transcript}")
        print(f"Confidence: {alt.confidence:.3f}")
        for word in alt.words:
            print(f"  {word.word} ({word.start_offset} - {word.end_offset})")

    return response.results[0].alternatives[0].transcript
```

### 3.2 Google Speech-to-Text Streaming Recognition

```python
from google.cloud import speech_v1
import pyaudio
import queue
import threading

class GoogleStreamingSTT:
    """Streaming recognition implementation for Google Cloud STT"""

    def __init__(
        self,
        language: str = "ja-JP",
        sample_rate: int = 16000,
        model: str = "latest_long",
    ):
        self.client = speech_v1.SpeechClient()
        self.config = speech_v1.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=sample_rate,
            language_code=language,
            model=model,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,
            # Enable speaker diarization
            diarization_config=speech_v1.SpeakerDiarizationConfig(
                enable_speaker_diarization=True,
                min_speaker_count=2,
                max_speaker_count=4,
            ),
            # Custom vocabulary boosting
            speech_contexts=[
                speech_v1.SpeechContext(
                    phrases=["Whisper", "STT", "TTS", "API"],
                    boost=15.0,
                ),
            ],
        )
        self.streaming_config = speech_v1.StreamingRecognitionConfig(
            config=self.config,
            interim_results=True,
            single_utterance=False,  # Continuous recognition for multiple utterances
        )
        self.audio_queue = queue.Queue()
        self.sample_rate = sample_rate

    def start_microphone_stream(self, on_result, duration_seconds=60):
        """Streaming recognition from microphone input"""
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=1600,  # 100ms chunks
            stream_callback=lambda in_data, *args: (
                self.audio_queue.put(in_data),
                (None, pyaudio.paContinue),
            )[-1],
        )

        def request_generator():
            yield speech_v1.StreamingRecognizeRequest(
                streaming_config=self.streaming_config
            )
            while True:
                chunk = self.audio_queue.get()
                if chunk is None:
                    return
                yield speech_v1.StreamingRecognizeRequest(audio_content=chunk)

        responses = self.client.streaming_recognize(requests=request_generator())

        for response in responses:
            for result in response.results:
                alt = result.alternatives[0]
                on_result({
                    "is_final": result.is_final,
                    "transcript": alt.transcript,
                    "confidence": alt.confidence if result.is_final else None,
                    "stability": result.stability,
                })

        stream.stop_stream()
        stream.close()
        p.terminate()
```

### 3.3 Azure Speech Services

```python
import azure.cognitiveservices.speech as speechsdk

def azure_stt(audio_file: str) -> str:
    """Azure Speech-to-Text"""
    speech_config = speechsdk.SpeechConfig(
        subscription="your-key",
        region="japaneast"
    )
    speech_config.speech_recognition_language = "ja-JP"

    # Detailed settings
    speech_config.set_property(
        speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        "5000"
    )
    speech_config.set_property(
        speechsdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        "1000"
    )

    audio_config = speechsdk.audio.AudioConfig(filename=audio_file)
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config
    )

    # Continuous recognition (for long audio)
    results = []

    def on_recognized(evt):
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            results.append(evt.result.text)
            print(f"Recognized: {evt.result.text}")

    def on_canceled(evt):
        print(f"Canceled: {evt.cancellation_details.reason}")

    recognizer.recognized.connect(on_recognized)
    recognizer.canceled.connect(on_canceled)

    recognizer.start_continuous_recognition()

    import time
    time.sleep(30)  # Wait for recognition to complete (use event-based control in practice)
    recognizer.stop_continuous_recognition()

    return " ".join(results)
```

### 3.4 Azure Speech Services Advanced Features

```python
import azure.cognitiveservices.speech as speechsdk
import json

class AzureAdvancedSTT:
    """STT leveraging advanced features of Azure Speech Services"""

    def __init__(self, subscription_key: str, region: str = "japaneast"):
        self.speech_config = speechsdk.SpeechConfig(
            subscription=subscription_key,
            region=region,
        )
        self.speech_config.speech_recognition_language = "ja-JP"

    def transcribe_with_diarization(self, audio_file: str) -> list[dict]:
        """Transcription with speaker diarization"""
        audio_config = speechsdk.audio.AudioConfig(filename=audio_file)

        conversation_transcriber = speechsdk.ConversationTranscriber(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        results = []
        done = False

        def on_transcribed(evt):
            if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                results.append({
                    "speaker_id": evt.result.speaker_id,
                    "text": evt.result.text,
                    "offset_ms": evt.result.offset / 10000,  # Convert from 100ns
                    "duration_ms": evt.result.duration / 10000,
                })

        def on_stopped(evt):
            nonlocal done
            done = True

        conversation_transcriber.transcribed.connect(on_transcribed)
        conversation_transcriber.session_stopped.connect(on_stopped)
        conversation_transcriber.canceled.connect(on_stopped)

        conversation_transcriber.start_transcribing_async().get()

        import time
        while not done:
            time.sleep(0.5)

        conversation_transcriber.stop_transcribing_async().get()
        return results

    def transcribe_with_pronunciation_assessment(
        self, audio_file: str, reference_text: str
    ) -> dict:
        """Transcription with pronunciation assessment (for language learning)"""
        pronunciation_config = speechsdk.PronunciationAssessmentConfig(
            reference_text=reference_text,
            grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
            granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
            enable_miscue=True,
        )

        audio_config = speechsdk.audio.AudioConfig(filename=audio_file)
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        pronunciation_config.apply_to(recognizer)

        result = recognizer.recognize_once_async().get()

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            assessment = speechsdk.PronunciationAssessmentResult(result)
            return {
                "text": result.text,
                "accuracy_score": assessment.accuracy_score,
                "pronunciation_score": assessment.pronunciation_score,
                "completeness_score": assessment.completeness_score,
                "fluency_score": assessment.fluency_score,
                "words": [
                    {
                        "word": w.word,
                        "accuracy_score": w.accuracy_score,
                        "error_type": w.error_type,
                    }
                    for w in assessment.words
                ],
            }
        return {"error": str(result.reason)}

    def transcribe_with_keyword_spotting(
        self, audio_file: str, keywords: list[str]
    ) -> dict:
        """Transcription with keyword spotting"""
        self.speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
            "10000"
        )

        audio_config = speechsdk.audio.AudioConfig(filename=audio_file)

        # Create custom keyword model (simplified version)
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        # Add phrase list
        phrase_list = speechsdk.PhraseListGrammar.from_recognizer(recognizer)
        for keyword in keywords:
            phrase_list.addPhrase(keyword)

        result = recognizer.recognize_once_async().get()

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            # Check for keyword occurrences
            found_keywords = [
                kw for kw in keywords if kw in result.text
            ]
            return {
                "text": result.text,
                "found_keywords": found_keywords,
                "confidence": result.properties.get(
                    speechsdk.PropertyId.SpeechServiceResponse_JsonResult
                ),
            }
        return {"error": str(result.reason)}
```

### 3.5 AWS Transcribe Implementation

```python
import boto3
import json
import time
from urllib.request import urlopen

class AWSTranscribeSTT:
    """Transcription using AWS Transcribe"""

    def __init__(self, region: str = "ap-northeast-1"):
        self.client = boto3.client("transcribe", region_name=region)
        self.s3_client = boto3.client("s3", region_name=region)

    def transcribe_file(
        self,
        s3_uri: str,
        job_name: str,
        language: str = "ja-JP",
        speaker_count: int = 2,
    ) -> dict:
        """Transcribe an audio file on S3"""
        self.client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": s3_uri},
            MediaFormat="wav",
            LanguageCode=language,
            Settings={
                "ShowSpeakerLabels": True,
                "MaxSpeakerLabels": speaker_count,
                "ShowAlternatives": True,
                "MaxAlternatives": 3,
                "VocabularyName": "my-custom-vocab",  # Custom vocabulary
            },
        )

        # Wait for job completion
        while True:
            status = self.client.get_transcription_job(
                TranscriptionJobName=job_name
            )
            job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]

            if job_status in ["COMPLETED", "FAILED"]:
                break
            time.sleep(5)

        if job_status == "COMPLETED":
            result_url = status["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
            result = json.loads(urlopen(result_url).read())
            return self._parse_result(result)
        else:
            raise RuntimeError(f"Transcription job failed: {job_status}")

    def _parse_result(self, result: dict) -> dict:
        """Parse AWS Transcribe results"""
        items = result["results"]["items"]
        segments = []
        current_speaker = None

        for item in items:
            speaker = item.get("speaker_label", current_speaker)
            if speaker != current_speaker:
                segments.append({
                    "speaker": speaker,
                    "text": "",
                    "start": float(item.get("start_time", 0)),
                })
                current_speaker = speaker

            if item["type"] == "pronunciation":
                segments[-1]["text"] += item["alternatives"][0]["content"]
                segments[-1]["end"] = float(item.get("end_time", 0))
            elif item["type"] == "punctuation":
                segments[-1]["text"] += item["alternatives"][0]["content"]

        return {
            "full_text": result["results"]["transcripts"][0]["transcript"],
            "segments": segments,
        }

    def create_custom_vocabulary(
        self,
        vocab_name: str,
        phrases: list[dict],
        language: str = "ja-JP",
    ):
        """Create a custom vocabulary"""
        self.client.create_vocabulary(
            VocabularyName=vocab_name,
            LanguageCode=language,
            Phrases=[
                {
                    "Phrase": p["phrase"],
                    "IPA": p.get("ipa"),
                    "DisplayAs": p.get("display_as", p["phrase"]),
                }
                for p in phrases
            ],
        )
```

### 3.6 Deepgram Implementation

```python
from deepgram import DeepgramClient, PrerecordedOptions, LiveOptions
import asyncio

class DeepgramSTT:
    """High-speed transcription with Deepgram"""

    def __init__(self, api_key: str):
        self.client = DeepgramClient(api_key)

    def transcribe_file(self, audio_path: str) -> dict:
        """Transcribe a file"""
        with open(audio_path, "rb") as f:
            buffer_data = f.read()

        payload = {"buffer": buffer_data}

        options = PrerecordedOptions(
            model="nova-2",           # Latest model
            language="ja",
            smart_format=True,        # Auto formatting
            punctuate=True,           # Insert punctuation
            diarize=True,             # Speaker diarization
            utterances=True,          # Utterance-level segmentation
            detect_language=True,     # Auto language detection
            paragraphs=True,          # Paragraph segmentation
            summarize="v2",           # Summary generation
            topics=True,              # Topic extraction
            intents=True,             # Intent analysis
            sentiment=True,           # Sentiment analysis
        )

        response = self.client.listen.prerecorded.v("1").transcribe_file(
            payload, options
        )

        result = response.to_dict()

        return {
            "transcript": result["results"]["channels"][0]["alternatives"][0]["transcript"],
            "confidence": result["results"]["channels"][0]["alternatives"][0]["confidence"],
            "words": result["results"]["channels"][0]["alternatives"][0]["words"],
            "paragraphs": result["results"]["channels"][0]["alternatives"][0].get("paragraphs"),
            "summaries": result["results"].get("summary"),
            "topics": result["results"].get("topics"),
            "sentiments": result["results"].get("sentiments"),
        }

    async def transcribe_stream(self, audio_stream, on_result):
        """Streaming transcription"""
        options = LiveOptions(
            model="nova-2",
            language="ja",
            punctuate=True,
            interim_results=True,
            utterance_end_ms=1000,
            vad_events=True,
            smart_format=True,
        )

        connection = self.client.listen.live.v("1")

        async def on_message(self_conn, result, **kwargs):
            transcript = result.channel.alternatives[0].transcript
            if transcript:
                on_result({
                    "text": transcript,
                    "is_final": result.is_final,
                    "speech_final": result.speech_final,
                })

        connection.on("Results", on_message)

        await connection.start(options)

        async for chunk in audio_stream:
            connection.send(chunk)

        await connection.finish()
```

### 3.7 Unified Provider Wrapper

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import time
import hashlib

@dataclass
class TranscriptionResult:
    text: str
    language: str
    confidence: float
    segments: list
    provider: str
    latency_ms: float = 0.0
    word_count: int = 0
    metadata: dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        self.word_count = len(self.text.split())

class STTProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str, language: Optional[str]) -> TranscriptionResult:
        pass

class UnifiedSTT:
    """Unified interface for multiple STT providers"""

    def __init__(self):
        self.providers: dict[str, STTProvider] = {}
        self.fallback_order = ["whisper", "google", "azure"]
        self._cache: dict[str, TranscriptionResult] = {}
        self._metrics: dict[str, dict] = {}

    def register(self, name: str, provider: STTProvider):
        self.providers[name] = provider
        self._metrics[name] = {
            "success": 0,
            "failure": 0,
            "total_latency_ms": 0.0,
        }

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = "ja",
        provider: Optional[str] = None,
        use_cache: bool = True,
    ) -> TranscriptionResult:
        """Transcribe with fallback support"""
        # Cache check
        cache_key = self._make_cache_key(audio_path, language)
        if use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        if provider:
            result = self._transcribe_single(provider, audio_path, language)
            if use_cache:
                self._cache[cache_key] = result
            return result

        last_error = None
        for name in self.fallback_order:
            if name not in self.providers:
                continue
            try:
                result = self._transcribe_single(name, audio_path, language)
                if result.confidence > 0.5:  # Confidence threshold
                    if use_cache:
                        self._cache[cache_key] = result
                    return result
            except Exception as e:
                last_error = e
                print(f"{name} failed: {e}")
                continue

        raise RuntimeError(f"All providers failed: {last_error}")

    def _transcribe_single(
        self, name: str, audio_path: str, language: Optional[str]
    ) -> TranscriptionResult:
        """Transcribe with a single provider (with metrics tracking)"""
        start = time.time()
        try:
            result = self.providers[name].transcribe(audio_path, language)
            latency = (time.time() - start) * 1000
            result.latency_ms = latency
            self._metrics[name]["success"] += 1
            self._metrics[name]["total_latency_ms"] += latency
            return result
        except Exception as e:
            self._metrics[name]["failure"] += 1
            raise

    def _make_cache_key(self, audio_path: str, language: Optional[str]) -> str:
        """Generate cache key"""
        with open(audio_path, "rb") as f:
            file_hash = hashlib.sha256(f.read()).hexdigest()[:16]
        return f"{file_hash}:{language}"

    def get_metrics(self) -> dict:
        """Get metrics for each provider"""
        metrics = {}
        for name, m in self._metrics.items():
            total = m["success"] + m["failure"]
            metrics[name] = {
                "total_requests": total,
                "success_rate": m["success"] / total if total > 0 else 0,
                "avg_latency_ms": (
                    m["total_latency_ms"] / m["success"]
                    if m["success"] > 0 else 0
                ),
            }
        return metrics
```

---

## 4. Speaker Diarization

### 4.1 Speaker Diarization with pyannote-audio

```python
from pyannote.audio import Pipeline
import torch

class SpeakerDiarizer:
    """Speaker diarization using pyannote-audio"""

    def __init__(self, auth_token: str):
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=auth_token,
        )
        # Use GPU
        if torch.cuda.is_available():
            self.pipeline.to(torch.device("cuda"))

    def diarize(
        self,
        audio_path: str,
        min_speakers: int = 2,
        max_speakers: int = 5,
    ) -> list[dict]:
        """Perform speaker diarization"""
        diarization = self.pipeline(
            audio_path,
            min_speakers=min_speakers,
            max_speakers=max_speakers,
        )

        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker,
                "duration": turn.end - turn.start,
            })

        return segments

    def diarize_and_transcribe(
        self,
        audio_path: str,
        whisper_model,
        min_speakers: int = 2,
        max_speakers: int = 5,
    ) -> list[dict]:
        """Integrated speaker diarization + Whisper transcription"""
        import librosa
        import numpy as np

        # Step 1: Speaker diarization
        diarization_result = self.diarize(
            audio_path, min_speakers, max_speakers
        )

        # Step 2: Load audio
        audio, sr = librosa.load(audio_path, sr=16000)

        # Step 3: Transcribe each speaker segment with Whisper
        results = []
        for segment in diarization_result:
            start_sample = int(segment["start"] * sr)
            end_sample = int(segment["end"] * sr)
            segment_audio = audio[start_sample:end_sample]

            # Skip segments that are too short
            if len(segment_audio) / sr < 0.5:
                continue

            # Write to temporary file and transcribe
            import soundfile as sf
            import tempfile

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                sf.write(f.name, segment_audio, sr)
                result = whisper_model.transcribe(
                    f.name,
                    language="ja",
                    fp16=torch.cuda.is_available(),
                )

            results.append({
                "speaker": segment["speaker"],
                "start": segment["start"],
                "end": segment["end"],
                "text": result["text"].strip(),
            })

        return results
```

### 4.2 Formatted Output of Diarization Results

```python
def format_diarized_transcript(
    segments: list[dict],
    format_type: str = "text",
) -> str:
    """Format and output diarization results"""

    if format_type == "text":
        lines = []
        current_speaker = None
        for seg in segments:
            if seg["speaker"] != current_speaker:
                current_speaker = seg["speaker"]
                lines.append(f"\n[{current_speaker}]")
            timestamp = f"({seg['start']:.1f}s - {seg['end']:.1f}s)"
            lines.append(f"  {timestamp} {seg['text']}")
        return "\n".join(lines)

    elif format_type == "srt":
        srt_lines = []
        for i, seg in enumerate(segments, 1):
            start = _format_srt_time(seg["start"])
            end = _format_srt_time(seg["end"])
            srt_lines.append(f"{i}")
            srt_lines.append(f"{start} --> {end}")
            srt_lines.append(f"[{seg['speaker']}] {seg['text']}")
            srt_lines.append("")
        return "\n".join(srt_lines)

    elif format_type == "json":
        import json
        return json.dumps(segments, ensure_ascii=False, indent=2)

    elif format_type == "vtt":
        vtt_lines = ["WEBVTT", ""]
        for seg in segments:
            start = _format_vtt_time(seg["start"])
            end = _format_vtt_time(seg["end"])
            vtt_lines.append(f"{start} --> {end}")
            vtt_lines.append(f"<v {seg['speaker']}>{seg['text']}</v>")
            vtt_lines.append("")
        return "\n".join(vtt_lines)

    raise ValueError(f"Unsupported format: {format_type}")


def _format_srt_time(seconds: float) -> str:
    """Convert to SRT timestamp format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _format_vtt_time(seconds: float) -> str:
    """Convert to VTT timestamp format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
```

---

## 5. Accuracy Evaluation and Improvement

### 5.1 WER/CER Calculation

```python
import evaluate

class STTEvaluator:
    """STT accuracy evaluation tool"""

    def __init__(self):
        self.wer_metric = evaluate.load("wer")
        self.cer_metric = evaluate.load("cer")

    def evaluate(
        self,
        predictions: list[str],
        references: list[str],
    ) -> dict:
        """Calculate WER and CER"""
        wer = self.wer_metric.compute(
            predictions=predictions,
            references=references,
        )
        cer = self.cer_metric.compute(
            predictions=predictions,
            references=references,
        )

        # Detailed analysis
        analysis = self._analyze_errors(predictions, references)

        return {
            "wer": wer,
            "cer": cer,
            "num_samples": len(predictions),
            "error_analysis": analysis,
        }

    def _analyze_errors(
        self,
        predictions: list[str],
        references: list[str],
    ) -> dict:
        """Analyze error patterns"""
        substitutions = 0
        insertions = 0
        deletions = 0

        for pred, ref in zip(predictions, references):
            pred_chars = list(pred)
            ref_chars = list(ref)

            # Classify error types from edit distance backtrace
            n, m = len(ref_chars), len(pred_chars)
            dp = [[0] * (m + 1) for _ in range(n + 1)]

            for i in range(n + 1):
                dp[i][0] = i
            for j in range(m + 1):
                dp[0][j] = j

            for i in range(1, n + 1):
                for j in range(1, m + 1):
                    if ref_chars[i-1] == pred_chars[j-1]:
                        dp[i][j] = dp[i-1][j-1]
                    else:
                        dp[i][j] = 1 + min(
                            dp[i-1][j],    # Deletion
                            dp[i][j-1],    # Insertion
                            dp[i-1][j-1],  # Substitution
                        )

            # Backtrace
            i, j = n, m
            while i > 0 or j > 0:
                if i > 0 and j > 0 and ref_chars[i-1] == pred_chars[j-1]:
                    i -= 1
                    j -= 1
                elif i > 0 and j > 0 and dp[i][j] == dp[i-1][j-1] + 1:
                    substitutions += 1
                    i -= 1
                    j -= 1
                elif j > 0 and dp[i][j] == dp[i][j-1] + 1:
                    insertions += 1
                    j -= 1
                elif i > 0 and dp[i][j] == dp[i-1][j] + 1:
                    deletions += 1
                    i -= 1

        total_errors = substitutions + insertions + deletions
        return {
            "substitutions": substitutions,
            "insertions": insertions,
            "deletions": deletions,
            "total_errors": total_errors,
            "error_distribution": {
                "substitution_rate": substitutions / total_errors if total_errors > 0 else 0,
                "insertion_rate": insertions / total_errors if total_errors > 0 else 0,
                "deletion_rate": deletions / total_errors if total_errors > 0 else 0,
            },
        }

# Usage example
evaluator = STTEvaluator()
results = evaluator.evaluate(
    predictions=["こんにちわ世界"],
    references=["こんにちは世界"],
)
print(f"WER: {results['wer']:.4f}")
print(f"CER: {results['cer']:.4f}")
```

### 5.2 Accuracy Improvement Techniques

```python
# Accuracy improvement through audio preprocessing
import librosa
import numpy as np
import noisereduce as nr

class STTPreprocessor:
    """Preprocessing pipeline for improving STT accuracy"""

    def preprocess(self, audio_path: str) -> np.ndarray:
        """Execute comprehensive preprocessing"""
        # 1. Load audio (resample to 16kHz)
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)

        # 2. Trim silence
        audio = self._trim_silence(audio, sr)

        # 3. Noise reduction
        audio = self._denoise(audio, sr)

        # 4. Normalization
        audio = self._normalize(audio)

        # 5. Extract speech segments only
        audio = self._extract_speech(audio, sr)

        return audio

    def _trim_silence(
        self, audio: np.ndarray, sr: int, top_db: float = 30
    ) -> np.ndarray:
        """Trim leading and trailing silence"""
        trimmed, _ = librosa.effects.trim(audio, top_db=top_db)
        return trimmed

    def _denoise(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """Noise reduction via spectral subtraction"""
        # Using noisereduce library
        reduced = nr.reduce_noise(
            y=audio,
            sr=sr,
            stationary=True,   # Assume stationary noise
            prop_decrease=0.75, # Noise reduction ratio (0.5-1.0)
        )
        return reduced

    def _normalize(self, audio: np.ndarray) -> np.ndarray:
        """Peak normalization"""
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio / peak * 0.95
        return audio

    def _extract_speech(
        self, audio: np.ndarray, sr: int
    ) -> np.ndarray:
        """Extract speech segments only using Silero VAD"""
        import torch

        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            force_reload=False,
        )
        get_speech_timestamps = utils[0]

        # Convert audio to tensor
        audio_tensor = torch.tensor(audio, dtype=torch.float32)

        # Detect speech segments
        speech_timestamps = get_speech_timestamps(
            audio_tensor,
            model,
            sampling_rate=sr,
            threshold=0.5,
            min_speech_duration_ms=250,
            min_silence_duration_ms=100,
        )

        # Concatenate speech segments only
        if speech_timestamps:
            speech_segments = []
            for ts in speech_timestamps:
                speech_segments.append(audio[ts["start"]:ts["end"]])
            return np.concatenate(speech_segments)
        return audio
```

---

## 6. Comparison Tables

### 6.1 Major STT Service Comparison

| Item | Whisper (local) | Google Speech | Azure Speech | AWS Transcribe | Deepgram |
|------|----------------|---------------|-------------|---------------|----------|
| Japanese WER | 5-8% | 6-10% | 6-9% | 8-12% | 7-10% |
| Real-time | Not supported(*) | Supported | Supported | Supported | Supported |
| Streaming | Not supported(*) | Supported | Supported | Supported | Supported |
| Speaker diarization | Not supported | Supported | Supported | Supported | Supported |
| Cost | GPU cost only | $0.016/min | $0.016/min | $0.024/min | $0.0043/min |
| Offline | Yes | No | No | No | No |
| Custom vocabulary | Fine-tuning | Boost support | Custom dict | Custom vocab | Keywords |
| Auto punctuation | Limited | Supported | Supported | Supported | Supported |
| Sentiment analysis | Not supported | Not supported | Not supported | Not supported | Supported |
| Summary generation | Not supported | Not supported | Not supported | Not supported | Supported |
| Pronunciation assessment | Not supported | Not supported | Supported | Not supported | Not supported |

* Pseudo real-time is possible with faster-whisper + VAD

### 6.2 Whisper Model Size Comparison

| Model | Parameters | VRAM | Speed (relative) | Japanese Accuracy | Recommended Use |
|-------|-----------|------|-------------------|-------------------|-----------------|
| tiny | 39M | ~1GB | 32x | Low | Testing/prototyping |
| base | 74M | ~1GB | 16x | Somewhat low | Lightweight apps |
| small | 244M | ~2GB | 6x | Moderate | Balanced |
| medium | 769M | ~5GB | 2x | High | Quality-focused |
| large-v3 | 1550M | ~10GB | 1x | Highest | Maximum accuracy |
| large-v3-turbo | 809M | ~6GB | 4x | High | Balance of speed and accuracy |

### 6.3 Recommended Configurations by Use Case

| Use Case | Recommended Provider | Configuration | Reason |
|----------|---------------------|---------------|--------|
| Meeting minutes | Azure Speech | Streaming + diarization | High diarization accuracy |
| Podcast transcription | Whisper large-v3 | Batch processing + post-processing | Highest accuracy, cost efficient |
| Call center | Google STT | Streaming + custom vocabulary | Low latency, term boosting |
| Medical dictation | Azure Speech | Custom model + diarization | Medical terminology support |
| Real-time subtitles | Deepgram | WebSocket + nova-2 | Lowest latency |
| Multilingual support | Whisper API | Batch processing | 97 language support |
| Offline processing | faster-whisper | Local GPU | No network required |
| Language learning | Azure Speech | Pronunciation assessment | Pronunciation scoring |

---

## 7. Anti-patterns

### 7.1 Anti-pattern: Processing Long Audio Without VAD

```python
# BAD: Processing long audio as-is
def bad_transcribe_long(audio_path):
    # 2-hour audio → out of memory / timeout
    result = whisper_model.transcribe(audio_path)
    return result["text"]

# GOOD: Processing with VAD + chunk splitting
from faster_whisper import WhisperModel
import numpy as np

def good_transcribe_long(audio_path, chunk_duration=30):
    """Transcribe long audio with VAD"""
    model = WhisperModel("large-v3", device="cuda")

    # Process with VAD filter (automatically detects speech segments)
    segments, info = model.transcribe(
        audio_path,
        language="ja",
        vad_filter=True,
        vad_parameters={
            "min_silence_duration_ms": 500,
            "speech_pad_ms": 200,
        },
    )

    full_text = []
    for segment in segments:
        full_text.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
        })

    return full_text
```

### 7.2 Anti-pattern: Ignoring Confidence Scores

```python
# BAD: Blindly trusting recognition results
def bad_process(result):
    return result["text"]  # May contain hallucinations

# GOOD: Confidence-based filtering
def good_process(segments, confidence_threshold=-0.5):
    """Quality filtering based on confidence"""
    filtered = []
    low_confidence = []

    for seg in segments:
        if seg["avg_logprob"] > confidence_threshold:
            filtered.append(seg["text"])
        else:
            # Mark low-confidence segments for review
            low_confidence.append({
                "time": f"{seg['start']:.1f}-{seg['end']:.1f}s",
                "text": seg["text"],
                "confidence": seg["avg_logprob"],
            })

    if low_confidence:
        print(f"Warning: {len(low_confidence)} low-confidence segments found")
        for lc in low_confidence:
            print(f"  [{lc['time']}] {lc['text']} (logprob: {lc['confidence']:.3f})")

    return " ".join(filtered), low_confidence
```

### 7.3 Anti-pattern: Direct Recognition Without Preprocessing

```python
# BAD: Feeding raw audio directly to STT
def bad_raw_transcribe(audio_path):
    result = model.transcribe(audio_path)
    return result["text"]
    # → Accuracy degradation due to noise and inappropriate sampling rate

# GOOD: Proper preprocessing pipeline
def good_preprocessed_transcribe(audio_path):
    """Transcribe after passing through preprocessing pipeline"""
    preprocessor = STTPreprocessor()

    # 1. Preprocess
    processed_audio = preprocessor.preprocess(audio_path)

    # 2. Save to temporary file
    import soundfile as sf
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, processed_audio, 16000)
        temp_path = f.name

    # 3. Transcribe
    result = model.transcribe(temp_path, language="ja")

    # 4. Post-process
    post_processor = WhisperPostProcessor()
    cleaned_text = post_processor.process(result["text"])

    return cleaned_text
```

### 7.4 Anti-pattern: Dependency on a Single Provider

```python
# BAD: Complete dependency on a single API
def bad_single_provider(audio_path):
    try:
        return google_stt(audio_path)
    except Exception:
        raise  # All functionality stops when the service is down

# GOOD: Multi-provider with fallback
def good_multi_provider(audio_path):
    """Redundancy with multiple providers"""
    stt = UnifiedSTT()
    stt.register("whisper", WhisperProvider())
    stt.register("google", GoogleProvider())
    stt.register("azure", AzureProvider())

    result = stt.transcribe(
        audio_path,
        language="ja",
        use_cache=True,
    )
    return result
```

---

## 8. FAQ

### Q1: Can Whisper be used for real-time speech recognition?

Standard Whisper is a batch processing model that assumes 30-second fixed inputs, so it is not suitable for real-time recognition as-is. However, pseudo real-time processing using faster-whisper combined with VAD, or streaming support through the whisper-streaming project, is possible. If true real-time processing is needed, consider using the streaming recognition APIs of Google Speech-to-Text or Azure Speech, or models that have been tuned for streaming Whisper (e.g., Distil-Whisper).

### Q2: How can I improve Japanese STT accuracy?

There are five main improvement strategies: (1) Increase model size (large-v3 has the highest accuracy). (2) Improve audio preprocessing (noise reduction, normalization, resampling). (3) Remove silence and non-speech segments with VAD. (4) Fine-tune with Japanese-specific data (such as the ReazonSpeech dataset). (5) Add post-processing (punctuation insertion, proper noun correction, LLM-based proofreading). In particular, domain-specific fine-tuning significantly improves recognition accuracy for specialized terminology.

### Q3: How do I transcribe audio while distinguishing between multiple speakers?

Speaker diarization is required. Whisper alone does not have speaker diarization capability, but it can be achieved by combining it with pyannote-audio. The steps are: (1) Perform speaker diarization with pyannote-audio, (2) Transcribe each speaker segment with Whisper, (3) Match and merge timestamps. When using cloud APIs, Google Speech-to-Text and Azure Speech have built-in speaker diarization features that can be used simply by enabling the settings.

### Q4: How can I prevent Whisper hallucinations?

Whisper hallucinations tend to occur during silent or non-speech segments. The following countermeasures are effective: (1) Use VAD filters to remove silent segments beforehand. (2) Adjust the `no_speech_threshold` parameter (default 0.6; increase for stricter detection). (3) Detect repetitions with `compression_ratio_threshold` (default 2.4). (4) Remove typical hallucination patterns in post-processing (e.g., "Thank you for watching"). (5) Filter low-confidence segments using `logprob_threshold`.

### Q5: How can I minimize STT processing costs?

The main cost optimization strategies are: (1) Use VAD to process only speech segments and avoid billing for silent portions. (2) Use caching when frequently processing the same audio. (3) Use batch APIs when real-time processing is not needed (batch is generally cheaper). (4) Running Whisper locally eliminates API charges, costing only GPU expenses. (5) For short audio, Whisper API's pay-per-use pricing is suitable; for long audio, local faster-whisper processing is more economical. (6) Deepgram at $0.0043 per minute is the cheapest option and a strong choice when cost is the priority.

### Q6: How can I post-process STT results with an LLM?

```python
from openai import OpenAI

def llm_post_process(raw_transcript: str, context: str = "") -> str:
    """Post-process STT results with an LLM"""
    client = OpenAI()

    prompt = f"""The following is a speech recognition result. Please correct it according to these rules:
1. Fix parts that appear to be misrecognized based on context
2. Insert appropriate punctuation
3. Remove filler words (um, uh, well)
4. Standardize proper noun notation
5. Convert colloquial expressions to appropriate written language

{f"Context: {context}" if context else ""}

Speech recognition result:
{raw_transcript}

Corrected text:"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )

    return response.choices[0].message.content
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Architecture | CTC (fast), Attention (high accuracy), Transducer (streaming) |
| Whisper | Most versatile OSS model. large-v3 has the highest accuracy |
| faster-whisper | 2-4x faster with CTranslate2 optimization. Includes VAD filter |
| Cloud APIs | Google/Azure excel at real-time and streaming |
| Deepgram | Lowest latency and cheapest. Built-in sentiment analysis and summarization |
| Accuracy improvement | 4-stage approach: preprocessing + VAD + fine-tuning + post-processing |
| Speaker diarization | pyannote-audio + Whisper, or built-in cloud API features |
| Hallucination prevention | VAD filter + threshold tuning + post-processing pattern matching |
| Cost optimization | VAD filter + caching + local processing + Deepgram |

## Recommended Next Reads

- [../02-voice/01-voice-assistants.md](../02-voice/01-voice-assistants.md) — Voice Assistant Implementation
- [../02-voice/02-podcast-tools.md](../02-voice/02-podcast-tools.md) — Podcast Transcription
- [../03-development/02-real-time-audio.md](../03-development/02-real-time-audio.md) — Real-time Audio Processing

## References

1. Radford, A., et al. (2023). "Robust Speech Recognition via Large-Scale Weak Supervision" — Whisper paper. Large-scale speech recognition model trained on 680K hours of data
2. Gulati, A., et al. (2020). "Conformer: Convolution-augmented Transformer for Speech Recognition" — Conformer paper. A fusion architecture of CNN + Transformer
3. Graves, A., et al. (2012). "Sequence Transduction with Recurrent Neural Networks" — Original RNN-T paper. Foundational technology for streaming speech recognition
4. Bredin, H., et al. (2023). "pyannote.audio 2.1 speaker diarization pipeline" — pyannote-audio paper. A representative framework for speaker diarization
5. Peng, Y., et al. (2023). "Reproducing Whisper-Style Training Using an Open-Source Toolkit and Publicly Available Data" — Whisper reproduction study. Whisper-style training with OSS
6. Park, D.S., et al. (2019). "SpecAugment: A Simple Data Augmentation Method for Automatic Speech Recognition" — Data augmentation method that significantly improves speech recognition accuracy
