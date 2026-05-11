# Audio AI API Comparison, Integration & Utilization Guide

> A systematic guide covering the features, pricing, and integration methods of major audio AI APIs — Google Cloud Speech, Amazon Polly, Azure Speech Services, OpenAI Whisper, and more — to help you select and implement the optimal service.

---

## What You Will Learn in This Chapter

1. **Compare the features, pricing, and accuracy of major audio AI APIs** and select the optimal service for each use case
2. **Understand integration patterns across REST/gRPC/WebSocket protocols** and implement speech recognition and synthesis
3. **Master design techniques required for production operation** such as fallback, caching, and rate limiting


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Overview of Audio AI APIs

### 1.1 Major Service Categories

```
+----------------------------------------------------------+
|                Audio AI API Ecosystem                     |
+----------------------------------------------------------+
|                                                          |
|  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  |
|  │  Speech       │  │  Speech      │  │  Audio        │  |
|  │  Recognition  │  │  Synthesis   │  │  Analysis     │  |
|  │  (STT)       │  │  (TTS)       │  │  (Analysis)   │  |
|  ├──────────────┤  ├──────────────┤  ├───────────────┤  |
|  │ Google STT   │  │ Amazon Polly │  │ Speaker ID     │  |
|  │ Azure Speech │  │ Azure TTS    │  │ Sentiment      │  |
|  │ AWS Transcr. │  │ Google TTS   │  │ Keyword Det.   │  |
|  │ Whisper API  │  │ ElevenLabs   │  │ Language Det.  │  |
|  │ Deepgram     │  │ OpenAI TTS   │  │ Topic Classif. │  |
|  └──────────────┘  └──────────────┘  └───────────────┘  |
+----------------------------------------------------------+
```

### 1.2 API Communication Patterns

```
+-------------------+     +-------------------+
|  Client           |     |  Audio AI API     |
+-------------------+     +-------------------+
|                   |     |                   |
| [REST/HTTP]       |────>| Batch Processing  |
|  Send audio file  |<────| Return JSON result|
|                   |     |                   |
| [WebSocket]       |<===>| Real-time Process |
|  Streaming        |<===>| Incremental result|
|                   |     |                   |
| [gRPC]            |<===>| High-speed bidir. |
|  Binary optimized |<===>| Protocol Buffers  |
+-------------------+     +-------------------+
```

### 1.3 API Selection Flowchart

```
Audio AI API Selection Guide
==================================================

Q1: Do you need real-time processing?
    │
    ├── Yes → Q2: What is the latency requirement?
    │         ├── <100ms → Deepgram (WebSocket)
    │         ├── <300ms → Azure Speech / Google STT
    │         └── <500ms → AWS Transcribe Streaming
    │
    └── No → Q3: What matters most?
              ├── Accuracy first → Whisper API / Google STT
              ├── Cost first → Deepgram / Whisper OSS
              ├── Customization → Azure Custom Speech
              └── Offline → Whisper / faster-whisper

Q4: Do you also need TTS (speech synthesis)?
    ├── Japanese quality focus → Azure Speech TTS
    ├── Voice cloning → ElevenLabs
    ├── SSML control → Amazon Polly / Azure
    └── Simple API → OpenAI TTS
==================================================
```

---

## 2. Major STT (Speech Recognition) API Comparison

### 2.1 Comparison Table: Speech Recognition APIs

| Item | Google Cloud STT | Azure Speech | AWS Transcribe | OpenAI Whisper | Deepgram |
|------|-----------------|--------------|----------------|---------------|----------|
| Supported Languages | 125+ | 100+ | 100+ | 97 | 36 |
| Real-time | Supported | Supported | Supported | Not supported (API ver.) | Supported |
| Speaker Diarization | Supported | Supported | Supported | Not supported | Supported |
| Custom Vocabulary | Supported | Supported | Supported | Not supported | Supported |
| Japanese Accuracy | High | High | Medium-High | High | Medium |
| Price/min | $0.006~ | $0.0053~ | $0.024 | $0.006 | $0.0043~ |
| Self-hosted | No | Container available | No | OSS available | No |
| Max Audio Length | 480 min | Unlimited (stream) | 14,400 min | 25MB | Unlimited |
| Sentiment Analysis | Not supported | Not supported | Not supported | Not supported | Supported |
| Summary Generation | Not supported | Not supported | Not supported | Not supported | Supported |

### 2.2 Google Cloud Speech-to-Text Implementation

```python
# Google Cloud Speech-to-Text: Synchronous Recognition
from google.cloud import speech_v1

def transcribe_audio_sync(audio_path: str, language: str = "ja-JP") -> str:
    """Synchronously transcribe an audio file"""
    client = speech_v1.SpeechClient()

    with open(audio_path, "rb") as f:
        audio_content = f.read()

    audio = speech_v1.RecognitionAudio(content=audio_content)
    config = speech_v1.RecognitionConfig(
        encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code=language,
        # High accuracy options
        enable_automatic_punctuation=True,  # Auto punctuation
        enable_word_time_offsets=True,       # Word timestamps
        model="latest_long",                 # Model for long audio
        use_enhanced=True,                   # Use enhanced model
    )

    response = client.recognize(config=config, audio=audio)

    results = []
    for result in response.results:
        alt = result.alternatives[0]
        results.append({
            "transcript": alt.transcript,
            "confidence": alt.confidence,
            "words": [
                {
                    "word": w.word,
                    "start": w.start_time.total_seconds(),
                    "end": w.end_time.total_seconds(),
                }
                for w in alt.words
            ],
        })
    return results


# Google Cloud Speech-to-Text V2: Latest API
from google.cloud import speech_v2 as speech

def transcribe_v2(
    audio_path: str,
    project_id: str,
    language: str = "ja-JP",
) -> list[dict]:
    """Transcribe with V2 API (more features)"""
    client = speech.SpeechClient()

    with open(audio_path, "rb") as f:
        audio_content = f.read()

    config = speech.RecognitionConfig(
        auto_decoding_config=speech.AutoDetectDecodingConfig(),
        language_codes=[language],
        model="long",
        features=speech.RecognitionFeatures(
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,
            enable_word_confidence=True,
            multi_channel_mode=speech.RecognitionFeatures.MultiChannelMode.SEPARATE_RECOGNITION_PER_CHANNEL,
        ),
    )

    request = speech.RecognizeRequest(
        recognizer=f"projects/{project_id}/locations/global/recognizers/_",
        config=config,
        content=audio_content,
    )

    response = client.recognize(request=request)

    results = []
    for result in response.results:
        alt = result.alternatives[0]
        results.append({
            "transcript": alt.transcript,
            "confidence": alt.confidence,
        })

    return results


# Google Cloud STT: Asynchronous Processing (for long audio)
def transcribe_async(
    gcs_uri: str,
    language: str = "ja-JP",
) -> list[dict]:
    """Asynchronously transcribe long audio on GCS"""
    client = speech_v1.SpeechClient()

    audio = speech_v1.RecognitionAudio(uri=gcs_uri)
    config = speech_v1.RecognitionConfig(
        encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code=language,
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,
        model="latest_long",
        # Speaker diarization
        diarization_config=speech_v1.SpeakerDiarizationConfig(
            enable_speaker_diarization=True,
            min_speaker_count=2,
            max_speaker_count=6,
        ),
    )

    operation = client.long_running_recognize(config=config, audio=audio)
    print("Processing... (may take several minutes)")

    response = operation.result(timeout=3600)  # Wait up to 1 hour

    results = []
    for result in response.results:
        alt = result.alternatives[0]
        results.append({
            "transcript": alt.transcript,
            "confidence": alt.confidence,
        })

    return results
```

### 2.3 Azure Speech Services Implementation

```python
# Azure Speech Services: Real-time Streaming Recognition
import azure.cognitiveservices.speech as speechsdk
import asyncio
from typing import Callable

class AzureRealtimeTranscriber:
    """Real-time transcription using Azure Speech Services"""

    def __init__(self, subscription_key: str, region: str = "japaneast"):
        self.config = speechsdk.SpeechConfig(
            subscription=subscription_key,
            region=region,
        )
        self.config.speech_recognition_language = "ja-JP"
        # High accuracy settings
        self.config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
            "15000"
        )
        self.config.enable_dictation()

    def transcribe_from_microphone(
        self, on_recognized: Callable[[str], None]
    ):
        """Real-time transcription from microphone input"""
        audio_config = speechsdk.AudioConfig(
            use_default_microphone=True
        )
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.config,
            audio_config=audio_config,
        )

        # Register event handlers
        recognizer.recognized.connect(
            lambda evt: on_recognized(evt.result.text)
        )
        recognizer.session_stopped.connect(
            lambda evt: print("Session ended")
        )

        recognizer.start_continuous_recognition()
        return recognizer  # Stop with stop_continuous_recognition()

    def transcribe_from_file(self, file_path: str) -> list[dict]:
        """Transcribe from audio file (with speaker diarization)"""
        audio_config = speechsdk.AudioConfig(filename=file_path)
        # Conversation transcription (supports speaker diarization)
        conversation_transcriber = speechsdk.ConversationTranscriber(
            speech_config=self.config,
            audio_config=audio_config,
        )

        results = []
        done = asyncio.Event()

        def on_transcribed(evt):
            results.append({
                "speaker": evt.result.speaker_id,
                "text": evt.result.text,
                "offset": evt.result.offset,
            })

        conversation_transcriber.transcribed.connect(on_transcribed)
        conversation_transcriber.session_stopped.connect(
            lambda _: done.set()
        )

        conversation_transcriber.start_transcribing_async()
        done.wait()
        return results

    def transcribe_with_translation(
        self,
        file_path: str,
        source_lang: str = "ja-JP",
        target_langs: list[str] = ["en"],
    ) -> dict:
        """Speech translation (simultaneous STT + translation)"""
        translation_config = speechsdk.translation.SpeechTranslationConfig(
            subscription=self.config.subscription_key,
            region=self.config.region,
        )
        translation_config.speech_recognition_language = source_lang
        for lang in target_langs:
            translation_config.add_target_language(lang)

        audio_config = speechsdk.AudioConfig(filename=file_path)
        recognizer = speechsdk.translation.TranslationRecognizer(
            translation_config=translation_config,
            audio_config=audio_config,
        )

        result = recognizer.recognize_once_async().get()

        if result.reason == speechsdk.ResultReason.TranslatedSpeech:
            return {
                "source_text": result.text,
                "translations": {
                    lang: result.translations[lang]
                    for lang in target_langs
                },
            }
        return {"error": str(result.reason)}
```

### 2.4 OpenAI Whisper API Implementation

```python
# OpenAI Whisper API: Simple and High-Accuracy Transcription
from openai import OpenAI
from pathlib import Path

def transcribe_with_whisper(
    audio_path: str,
    language: str = "ja",
    response_format: str = "verbose_json",
) -> dict:
    """Transcribe with Whisper API"""
    client = OpenAI()

    with open(audio_path, "rb") as audio_file:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            response_format=response_format,
            # Timestamp granularity: segment or word
            timestamp_granularities=["word", "segment"],
        )

    return {
        "text": result.text,
        "language": result.language,
        "duration": result.duration,
        "segments": [
            {
                "start": s.start,
                "end": s.end,
                "text": s.text,
            }
            for s in result.segments
        ],
        "words": [
            {
                "word": w.word,
                "start": w.start,
                "end": w.end,
            }
            for w in result.words
        ],
    }


def translate_with_whisper(audio_path: str) -> dict:
    """Translate audio to English with Whisper API"""
    client = OpenAI()

    with open(audio_path, "rb") as audio_file:
        result = client.audio.translations.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
        )

    return {
        "text": result.text,
        "source_language": result.language,
        "duration": result.duration,
    }


def transcribe_large_file(
    audio_path: str,
    chunk_duration_ms: int = 600000,  # 10 minutes
    language: str = "ja",
) -> list[dict]:
    """
    Chunked transcription for large files
    Used when the file exceeds Whisper API's size limit (25MB)
    """
    from pydub import AudioSegment

    audio = AudioSegment.from_file(audio_path)
    chunks = []

    for i in range(0, len(audio), chunk_duration_ms):
        chunk = audio[i:i + chunk_duration_ms]
        chunk_path = f"/tmp/whisper_chunk_{i}.mp3"
        chunk.export(chunk_path, format="mp3", bitrate="64k")

        result = transcribe_with_whisper(chunk_path, language=language)
        result["chunk_start_ms"] = i
        result["chunk_end_ms"] = min(i + chunk_duration_ms, len(audio))
        chunks.append(result)

        Path(chunk_path).unlink()  # Delete temporary file

    return chunks
```

### 2.5 Deepgram Implementation

```python
from deepgram import DeepgramClient, PrerecordedOptions, LiveOptions
import asyncio
import json

class DeepgramSTT:
    """Feature-rich transcription with Deepgram"""

    def __init__(self, api_key: str):
        self.client = DeepgramClient(api_key)

    def transcribe_file(
        self,
        audio_path: str,
        model: str = "nova-2",
        language: str = "ja",
    ) -> dict:
        """Transcribe a file (utilizing all features)"""
        with open(audio_path, "rb") as f:
            buffer_data = f.read()

        payload = {"buffer": buffer_data}

        options = PrerecordedOptions(
            model=model,
            language=language,
            smart_format=True,
            punctuate=True,
            diarize=True,
            utterances=True,
            detect_language=True,
            paragraphs=True,
            summarize="v2",
            topics=True,
            intents=True,
            sentiment=True,
        )

        response = self.client.listen.prerecorded.v("1").transcribe_file(
            payload, options
        )

        result = response.to_dict()
        channel = result["results"]["channels"][0]["alternatives"][0]

        return {
            "transcript": channel["transcript"],
            "confidence": channel["confidence"],
            "words": channel.get("words", []),
            "paragraphs": channel.get("paragraphs"),
            "summaries": result["results"].get("summary"),
            "topics": result["results"].get("topics"),
            "sentiments": result["results"].get("sentiments"),
        }

    async def transcribe_stream(
        self,
        audio_stream,
        on_result,
        model: str = "nova-2",
        language: str = "ja",
    ):
        """Streaming transcription"""
        options = LiveOptions(
            model=model,
            language=language,
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

    def transcribe_url(self, audio_url: str) -> dict:
        """Transcribe from URL (no file upload required)"""
        payload = {"url": audio_url}

        options = PrerecordedOptions(
            model="nova-2",
            language="ja",
            smart_format=True,
            diarize=True,
        )

        response = self.client.listen.prerecorded.v("1").transcribe_url(
            payload, options
        )

        return response.to_dict()
```

---

## 3. Major TTS (Speech Synthesis) API Comparison

### 3.1 Comparison Table: Speech Synthesis APIs

| Item | Amazon Polly | Azure TTS | Google TTS | OpenAI TTS | ElevenLabs |
|------|-------------|-----------|------------|------------|------------|
| Number of Voices | 60+ | 400+ | 220+ | 6 | Unlimited custom |
| SSML Support | Supported | Supported | Supported | Not supported | Partial |
| Neural Voices | Supported | Supported | Supported | Standard | Standard |
| Voice Cloning | Not supported | Custom available | Custom available | Not supported | Supported |
| Japanese Voices | 4 | 20+ | 10+ | 6 (multilingual) | Custom |
| Price/1M chars | $4 (standard) | $4~$16 | $4~$16 | $15 | $3~$99 |
| Real-time | Supported | Supported | Supported | Supported | Supported |
| Emotion Expression | Limited | Rich | Limited | Automatic | Rich |

### 3.2 Amazon Polly Implementation

```python
# Amazon Polly: Speech Synthesis with SSML Support
import boto3
from contextlib import closing

class PollyTTSEngine:
    """Amazon Polly speech synthesis engine"""

    def __init__(self, region: str = "ap-northeast-1"):
        self.client = boto3.client("polly", region_name=region)

    def synthesize(
        self,
        text: str,
        voice_id: str = "Mizuki",  # Japanese female
        engine: str = "neural",
        output_format: str = "mp3",
    ) -> bytes:
        """Synthesize speech from text"""
        response = self.client.synthesize_speech(
            Text=text,
            VoiceId=voice_id,
            Engine=engine,
            OutputFormat=output_format,
            LanguageCode="ja-JP",
        )

        with closing(response["AudioStream"]) as stream:
            return stream.read()

    def synthesize_ssml(self, ssml: str, voice_id: str = "Mizuki") -> bytes:
        """Synthesize speech with fine-grained control using SSML notation"""
        ssml_text = f"""
        <speak>
            <prosody rate="90%" pitch="+5%">
                {ssml}
            </prosody>
            <break time="500ms"/>
            <emphasis level="strong">Important point</emphasis>
        </speak>
        """
        response = self.client.synthesize_speech(
            Text=ssml_text,
            TextType="ssml",
            VoiceId=voice_id,
            Engine="neural",
            OutputFormat="mp3",
        )
        with closing(response["AudioStream"]) as stream:
            return stream.read()

    def synthesize_long_text(
        self,
        text: str,
        voice_id: str = "Mizuki",
        s3_bucket: str = "my-audio-bucket",
        s3_key_prefix: str = "tts-output/",
    ) -> str:
        """Asynchronous synthesis of long text (S3 output)"""
        response = self.client.start_speech_synthesis_task(
            Text=text,
            VoiceId=voice_id,
            Engine="neural",
            OutputFormat="mp3",
            OutputS3BucketName=s3_bucket,
            OutputS3KeyPrefix=s3_key_prefix,
            LanguageCode="ja-JP",
        )
        task_id = response["SynthesisTask"]["TaskId"]
        return task_id

    def list_japanese_voices(self) -> list[dict]:
        """Retrieve list of available Japanese voices"""
        response = self.client.describe_voices(LanguageCode="ja-JP")
        return [
            {
                "id": v["Id"],
                "name": v["Name"],
                "gender": v["Gender"],
                "engines": v["SupportedEngines"],
            }
            for v in response["Voices"]
        ]
```

### 3.3 OpenAI TTS Implementation

```python
from openai import OpenAI
from pathlib import Path

class OpenAITTSEngine:
    """OpenAI TTS speech synthesis engine"""

    VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

    def __init__(self):
        self.client = OpenAI()

    def synthesize(
        self,
        text: str,
        voice: str = "nova",
        model: str = "tts-1",  # tts-1 or tts-1-hd
        speed: float = 1.0,
        output_path: str = "output.mp3",
    ) -> str:
        """Synthesize speech from text"""
        response = self.client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            speed=speed,
            response_format="mp3",  # mp3, opus, aac, flac, wav, pcm
        )

        response.stream_to_file(output_path)
        return output_path

    def synthesize_streaming(
        self,
        text: str,
        voice: str = "nova",
        model: str = "tts-1",
    ):
        """Streaming speech synthesis (low latency)"""
        response = self.client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            response_format="opus",
        )

        # Stream in chunks
        for chunk in response.iter_bytes(chunk_size=4096):
            yield chunk

    def synthesize_batch(
        self,
        texts: list[str],
        voice: str = "nova",
        output_dir: str = "./tts_output",
    ) -> list[str]:
        """Batch synthesis of multiple texts"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        results = []
        for i, text in enumerate(texts):
            file_path = str(output_path / f"speech_{i:04d}.mp3")
            self.synthesize(text, voice=voice, output_path=file_path)
            results.append(file_path)

        return results
```

### 3.4 ElevenLabs Implementation

```python
from elevenlabs import ElevenLabs, VoiceSettings

class ElevenLabsTTS:
    """ElevenLabs speech synthesis (voice cloning supported)"""

    def __init__(self, api_key: str):
        self.client = ElevenLabs(api_key=api_key)

    def synthesize(
        self,
        text: str,
        voice_id: str = "pNInz6obpgDQGcFmaJgB",  # Adam
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.5,
    ) -> bytes:
        """Synthesize speech from text"""
        audio = self.client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            voice_settings=VoiceSettings(
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                use_speaker_boost=True,
            ),
        )
        return b"".join(audio)

    def clone_voice(
        self,
        name: str,
        description: str,
        audio_files: list[str],
    ) -> str:
        """Create a voice clone"""
        files = []
        for path in audio_files:
            with open(path, "rb") as f:
                files.append(f.read())

        voice = self.client.voices.add(
            name=name,
            description=description,
            files=files,
        )
        return voice.voice_id

    def list_voices(self) -> list[dict]:
        """List available voices"""
        voices = self.client.voices.get_all()
        return [
            {
                "voice_id": v.voice_id,
                "name": v.name,
                "category": v.category,
                "labels": v.labels,
            }
            for v in voices.voices
        ]
```

---

## 4. Multi-Provider Integration Architecture

### 4.1 Integrated Client with Fallback

```
┌────────────────────────────────────────────────┐
│         Integrated Audio AI Client              │
├────────────────────────────────────────────────┤
│                                                │
│  Request ──> [Router] ──> Primary Provider     │
│                  │              │               │
│                  │         (on failure)         │
│                  │              v               │
│                  └───> Fallback Provider        │
│                              │                 │
│                         (on failure)           │
│                              v                 │
│                       Local Fallback           │
│                       (Whisper OSS, etc.)      │
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Cache    │  │Rate Limit│  │ Metrics  │    │
│  └──────────┘  └──────────┘  └──────────┘    │
└────────────────────────────────────────────────┘
```

```python
# Multi-provider integrated client
from abc import ABC, abstractmethod
from typing import Optional
import time
import hashlib
import json

class STTProvider(ABC):
    """Abstract base class for speech recognition providers"""

    @abstractmethod
    def transcribe(self, audio: bytes, language: str) -> dict:
        pass

    @abstractmethod
    def is_available(self) -> bool:
        pass

class TTSProvider(ABC):
    """Abstract base class for speech synthesis providers"""

    @abstractmethod
    def synthesize(self, text: str, voice: str) -> bytes:
        pass

    @abstractmethod
    def is_available(self) -> bool:
        pass

class MultiProviderSTT:
    """Multi-provider STT client with fallback"""

    def __init__(self):
        self.providers: list[tuple[str, STTProvider]] = []
        self.cache: dict[str, dict] = {}
        self.metrics: dict[str, dict] = {}
        self.rate_limits: dict[str, dict] = {}

    def add_provider(
        self,
        name: str,
        provider: STTProvider,
        max_requests_per_min: int = 60,
        priority: int = 0,
    ):
        """Add a provider in priority order"""
        self.providers.append((name, provider))
        self.providers.sort(key=lambda x: priority)
        self.metrics[name] = {
            "success": 0, "failure": 0, "total_latency": 0.0,
        }
        self.rate_limits[name] = {
            "max": max_requests_per_min,
            "requests": [],
        }

    def _check_rate_limit(self, name: str) -> bool:
        """Check rate limit"""
        limit = self.rate_limits[name]
        now = time.time()
        # Keep only requests within the last minute
        limit["requests"] = [
            t for t in limit["requests"] if now - t < 60
        ]
        return len(limit["requests"]) < limit["max"]

    def _get_cache_key(self, audio: bytes, language: str) -> str:
        """Generate cache key"""
        audio_hash = hashlib.sha256(audio).hexdigest()
        return f"{audio_hash}:{language}"

    def transcribe(
        self,
        audio: bytes,
        language: str = "ja-JP",
        use_cache: bool = True,
    ) -> dict:
        """Transcribe with fallback"""
        # Check cache
        cache_key = self._get_cache_key(audio, language)
        if use_cache and cache_key in self.cache:
            return self.cache[cache_key]

        last_error = None
        for name, provider in self.providers:
            if not provider.is_available():
                continue
            if not self._check_rate_limit(name):
                continue

            try:
                start = time.time()
                result = provider.transcribe(audio, language)
                latency = time.time() - start

                # Update metrics
                self.metrics[name]["success"] += 1
                self.metrics[name]["total_latency"] += latency
                self.rate_limits[name]["requests"].append(time.time())

                # Save to cache
                result["provider"] = name
                result["latency"] = latency
                if use_cache:
                    self.cache[cache_key] = result

                return result

            except Exception as e:
                self.metrics[name]["failure"] += 1
                last_error = e
                continue

        raise RuntimeError(
            f"Transcription failed on all providers: {last_error}"
        )

    def get_metrics(self) -> dict:
        """Retrieve metrics"""
        result = {}
        for name, m in self.metrics.items():
            total = m["success"] + m["failure"]
            result[name] = {
                "total": total,
                "success_rate": m["success"] / total if total > 0 else 0,
                "avg_latency": (
                    m["total_latency"] / m["success"]
                    if m["success"] > 0 else 0
                ),
            }
        return result
```

### 4.2 Integrated TTS Client

```python
class MultiProviderTTS:
    """Multi-provider TTS client with fallback"""

    def __init__(self):
        self.providers: dict[str, TTSProvider] = {}
        self.fallback_order: list[str] = []
        self._cache: dict[str, bytes] = {}

    def register(self, name: str, provider: TTSProvider):
        self.providers[name] = provider
        self.fallback_order.append(name)

    def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        provider: Optional[str] = None,
        use_cache: bool = True,
    ) -> bytes:
        """Synthesize speech (with fallback)"""
        cache_key = hashlib.sha256(
            f"{text}:{voice}:{provider}".encode()
        ).hexdigest()

        if use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        providers_to_try = (
            [provider] if provider
            else self.fallback_order
        )

        last_error = None
        for name in providers_to_try:
            if name not in self.providers:
                continue
            try:
                p = self.providers[name]
                if not p.is_available():
                    continue
                audio = p.synthesize(text, voice or "default")
                if use_cache:
                    self._cache[cache_key] = audio
                return audio
            except Exception as e:
                last_error = e
                continue

        raise RuntimeError(f"All TTS providers failed: {last_error}")
```

---

## 5. Streaming Processing Patterns

### 5.1 Real-time Processing with WebSocket

```python
# WebSocket-based real-time speech recognition server
import asyncio
import websockets
import json
from google.cloud import speech_v1

async def audio_stream_handler(websocket, path):
    """Receive audio stream via WebSocket and return incremental transcription results"""
    client = speech_v1.SpeechClient()

    config = speech_v1.StreamingRecognitionConfig(
        config=speech_v1.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="ja-JP",
            enable_automatic_punctuation=True,
        ),
        interim_results=True,  # Also return interim results
    )

    async def request_generator():
        """Convert audio chunks to gRPC requests"""
        yield speech_v1.StreamingRecognizeRequest(
            streaming_config=config
        )
        async for message in websocket:
            if isinstance(message, bytes):
                yield speech_v1.StreamingRecognizeRequest(
                    audio_content=message
                )

    # Execute streaming recognition
    responses = client.streaming_recognize(
        requests=request_generator()
    )

    for response in responses:
        for result in response.results:
            msg = {
                "is_final": result.is_final,
                "transcript": result.alternatives[0].transcript,
                "confidence": (
                    result.alternatives[0].confidence
                    if result.is_final else None
                ),
            }
            await websocket.send(json.dumps(msg, ensure_ascii=False))

# Start server
async def main():
    async with websockets.serve(audio_stream_handler, "0.0.0.0", 8765):
        await asyncio.Future()  # Run indefinitely
```

### 5.2 Streaming API Server with FastAPI

```python
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import io

app = FastAPI(title="Audio AI API Gateway")

@app.post("/api/v1/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    language: str = "ja",
    provider: str = "whisper",
):
    """Transcribe an audio file"""
    audio_bytes = await file.read()

    stt_client = MultiProviderSTT()
    # Provider registration omitted

    result = stt_client.transcribe(audio_bytes, language)
    return result

@app.post("/api/v1/tts")
async def text_to_speech(
    text: str,
    voice: str = "nova",
    provider: str = "openai",
):
    """Synthesize speech from text"""
    tts_client = MultiProviderTTS()
    audio_bytes = tts_client.synthesize(text, voice, provider)

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "attachment; filename=speech.mp3"},
    )

@app.websocket("/ws/stt")
async def websocket_stt(websocket: WebSocket):
    """Streaming transcription via WebSocket"""
    await websocket.accept()

    try:
        while True:
            audio_chunk = await websocket.receive_bytes()
            # STT processing (omitted)
            result = {"text": "...", "is_final": True}
            await websocket.send_json(result)
    except WebSocketDisconnect:
        pass

@app.get("/api/v1/metrics")
async def get_metrics():
    """Retrieve API metrics"""
    stt_client = MultiProviderSTT()
    return stt_client.get_metrics()
```

---

## 6. Cost Optimization

### 6.1 Cost Comparison Simulation

```python
class CostCalculator:
    """Calculate audio API usage costs"""

    # Pricing table (reference prices as of 2024)
    PRICING = {
        "google_stt": {
            "standard": 0.006,      # $/min
            "enhanced": 0.009,
            "data_logging_opt_in": 0.004,
        },
        "azure_stt": {
            "standard": 0.0053,     # $/min (Japan East region)
            "custom": 0.0106,
        },
        "aws_transcribe": {
            "standard": 0.024,      # $/min
            "medical": 0.075,
        },
        "whisper_api": {
            "standard": 0.006,      # $/min
        },
        "deepgram": {
            "nova_2": 0.0043,       # $/min
            "enhanced": 0.0145,
        },
        "openai_tts": {
            "tts_1": 15.0,          # $/1M characters
            "tts_1_hd": 30.0,
        },
        "amazon_polly": {
            "standard": 4.0,        # $/1M characters
            "neural": 16.0,
        },
    }

    def estimate_stt_cost(
        self,
        provider: str,
        tier: str,
        audio_minutes: float,
    ) -> float:
        """Estimate STT cost"""
        rate = self.PRICING.get(provider, {}).get(tier, 0)
        return rate * audio_minutes

    def estimate_tts_cost(
        self,
        provider: str,
        tier: str,
        character_count: int,
    ) -> float:
        """Estimate TTS cost"""
        rate = self.PRICING.get(provider, {}).get(tier, 0)
        return rate * (character_count / 1_000_000)

    def compare_providers(
        self,
        audio_minutes: float,
        monthly: bool = True,
    ) -> dict:
        """Compare costs across providers"""
        multiplier = 30 if monthly else 1
        total_minutes = audio_minutes * multiplier

        comparison = {}
        for provider, tiers in self.PRICING.items():
            if any(k in provider for k in ["stt", "transcribe", "whisper", "deepgram"]):
                for tier, rate in tiers.items():
                    key = f"{provider}_{tier}"
                    comparison[key] = {
                        "rate_per_min": rate,
                        "total_cost": rate * total_minutes,
                        "total_minutes": total_minutes,
                    }

        # Sort by cost
        return dict(sorted(
            comparison.items(),
            key=lambda x: x[1]["total_cost"]
        ))

# Usage example
calc = CostCalculator()
comparison = calc.compare_providers(
    audio_minutes=60,  # 60 minutes per day
    monthly=True,       # Monthly cost
)
for provider, cost in comparison.items():
    print(f"{provider}: ${cost['total_cost']:.2f}/month")
```

---

## 7. Anti-Patterns

### 7.1 Anti-Pattern: Relying Only on Synchronous Batch Processing

```python
# BAD: Loading entire long audio into memory for synchronous processing
def bad_transcribe(audio_path: str) -> str:
    with open(audio_path, "rb") as f:
        huge_audio = f.read()  # Loads multi-GB files entirely into memory
    # Risk of timeout, risk of out-of-memory
    result = client.recognize(audio=huge_audio)
    return result

# GOOD: Chunked splitting + asynchronous processing
async def good_transcribe(audio_path: str) -> list[str]:
    chunks = split_audio(audio_path, chunk_seconds=30)
    tasks = [transcribe_chunk(c) for c in chunks]
    return await asyncio.gather(*tasks)
```

**Problem**: Loading large audio files entirely into memory can cause OOM (out of memory) errors or timeouts. Process using streaming or chunked splitting instead.

### 7.2 Anti-Pattern: Hardcoding API Keys

```python
# BAD: Writing API keys directly in source code
client = SpeechClient(api_key="sk-1234567890abcdef")

# GOOD: Use environment variables or a secret manager
import os
from google.cloud import secretmanager

def get_api_key(secret_id: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/my-project/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("utf-8")
```

**Problem**: Including API keys in version control creates a security risk. Manage them securely using environment variables, Secret Manager, Vault, etc.

### 7.3 Anti-Pattern: Ignoring Rate Limits

```python
# BAD: Fast loop without considering rate limits
def bad_batch_transcribe(files):
    results = []
    for f in files:
        results.append(api.transcribe(f))  # Error due to rate limiting
    return results

# GOOD: Processing with rate limit awareness
import time
from functools import wraps

def rate_limited(max_per_second=1):
    min_interval = 1.0 / max_per_second
    last_time = [0.0]

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_time[0]
            if elapsed < min_interval:
                time.sleep(min_interval - elapsed)
            last_time[0] = time.time()
            return func(*args, **kwargs)
        return wrapper
    return decorator

@rate_limited(max_per_second=5)
def good_transcribe(audio_path):
    return api.transcribe(audio_path)
```


---

## Hands-on Exercises

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
        """Main logic for data processing"""
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

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 8. FAQ

### Q1: Which API has the highest accuracy for Japanese speech recognition?

**A**: For general conversational audio, OpenAI Whisper demonstrates high accuracy. However, when specialized terminology is frequent, accuracy can be improved by using Google Cloud STT or Azure Speech's custom vocabulary features. For specific domains such as medical, legal, or financial, Azure has the advantage as it supports custom model training.

### Q2: What is the latency for real-time speech recognition?

**A**: The real-time recognition latency for major APIs is as follows.

| API | Avg Latency | Min Latency | Notes |
|-----|---------|---------|------|
| Google STT | 200-400ms | 100ms | Using gRPC |
| Azure Speech | 150-300ms | 80ms | Japan East region |
| Deepgram | 100-250ms | 50ms | Using WebSocket |
| AWS Transcribe | 300-500ms | 200ms | Using WebSocket |

### Q3: Which produces the most natural Japanese speech synthesis?

**A**: Azure Speech Services offers the most diverse Japanese Neural voices (20+), with emotion expression and style switching capabilities. ElevenLabs excels in voice cloning quality and is superior for reproducing specific speakers. Amazon Polly's strengths are stability and low cost.

### Q4: How can I minimize API costs?

**A**: (1) Leverage caching to avoid reprocessing the same audio, (2) trim audio appropriately to avoid sending silent segments, (3) use batch processing instead of real-time APIs when possible, (4) for short audio, Whisper API's pay-per-use pricing is advantageous.

### Q5: What speech recognition options work offline?

**A**: The most practical approach is running the open-source version of OpenAI Whisper locally. Using faster-whisper, you can achieve 2-4x speedup through CTranslate2 optimization. With an NVIDIA GPU, you can further accelerate using `compute_type="float16"`. In CPU-only environments, quantization with `compute_type="int8"` provides practical speeds.

### Q6: How do you use SSML notation for speech synthesis?

**A**: SSML (Speech Synthesis Markup Language) is an XML-based standard for fine-grained control of speech synthesis. Key tags include: `<prosody>` for controlling speed, pitch, and volume; `<break>` for inserting pauses; `<emphasis>` for emphasis; and `<say-as>` for specifying pronunciation (dates, numbers, etc.). Amazon Polly and Azure Speech provide the most comprehensive SSML support.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing and running code.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes particularly important during code reviews and architecture design.

---

## 9. Summary

| Category | Key Points |
|---------|---------|
| STT Selection | Whisper for accuracy, Azure/Deepgram for real-time, Google for customization |
| TTS Selection | Azure for Japanese quality, Polly for low cost, ElevenLabs for cloning |
| Integration Design | Ensure availability with multi-provider + fallback |
| Real-time | Achieve low latency with WebSocket/gRPC streaming |
| Cost Optimization | Reduce costs with caching, chunked splitting, and appropriate API selection |
| Security | Manage API keys with Secret Manager, encrypt audio data in transit |
| Operational Monitoring | Continuously monitor latency, error rate, and cost metrics |

---

## Recommended Next Reads

- [01-audio-processing.md](./01-audio-processing.md) — Implementing Audio Processing Pipelines
- [02-real-time-audio.md](./02-real-time-audio.md) — Real-time Audio Processing
- [../00-fundamentals/03-stt-technologies.md](../00-fundamentals/03-stt-technologies.md) — STT Technologies in Detail

---

## References

1. Google Cloud Speech-to-Text Documentation — https://cloud.google.com/speech-to-text/docs
2. Azure AI Speech Services Documentation — https://learn.microsoft.com/azure/ai-services/speech-service/
3. OpenAI Whisper API Reference — https://platform.openai.com/docs/guides/speech-to-text
4. Amazon Polly Developer Guide — https://docs.aws.amazon.com/polly/latest/dg/
5. Deepgram API Documentation — https://developers.deepgram.com/docs
6. ElevenLabs API Documentation — https://docs.elevenlabs.io/
