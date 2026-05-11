# Real-Time Audio — WebRTC and Streaming STT/TTS

> Systematically learn the techniques for building interactive voice applications by combining low-latency audio communication with real-time speech recognition and synthesis.

---

## What You Will Learn in This Chapter

1. **WebRTC Fundamentals** — How real-time audio communication works between browsers and servers, and signaling design
2. **Streaming STT** — Architecture and implementation for converting speech to text in real time
3. **Streaming TTS** — Techniques for synthesizing text to speech in real time with low-latency delivery
4. **Media Server Design** — SFU/MCU patterns, scalability, and GPU resource management
5. **Failure Handling and Quality Monitoring** — Connection recovery, quality metrics, and production operation best practices


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in the [Audio Processing Pipeline Implementation Guide](./01-audio-processing.md)

---

## 1. Real-Time Audio Architecture

### 1.1 Overall Structure

```
+-------------------+                    +-------------------+
|  Client A         |                    |  Client B         |
|  +------+         |    WebRTC          |         +------+  |
|  |  Mic | --------+----- P2P ---------+-------- | Speaker| |
|  +------+         |                    |         +------+  |
|  | Speaker| <-----+----- P2P ---------+-------- |  Mic  | |
|  +------+         |                    |         +------+  |
+-------------------+                    +-------------------+
         |                                        |
         |  Audio Stream                          |
         v                                        v
+-----------------------------------------------------------+
|                    Media Server                             |
|  +------------+  +------------+  +------------+            |
|  | STT Engine |  | AI Process |  | TTS Engine |            |
|  | (Real-time)|  |(Translate/ |  | (Real-time)|            |
|  +------------+  | Summarize) |  +------------+            |
|                  +------------+                            |
+-----------------------------------------------------------+
```

### 1.2 Latency Requirements

```
+-------------------------------------------------------+
| Real-Time Audio Latency Budget                         |
+-------------------------------------------------------+
| Overall Target: < 300ms (natural for conversation)     |
|                                                         |
| Breakdown:                                              |
|  Audio Capture    : 10-20ms  [===]                      |
|  Encoding         : 5-10ms   [==]                       |
|  Network Transfer : 20-100ms [========]                  |
|  Decoding         : 5-10ms   [==]                       |
|  STT Processing   : 50-200ms [==============]            |
|  AI Processing    : 50-500ms [====================]      |
|  TTS Processing   : 50-200ms [==============]            |
|  Playback Buffer  : 10-20ms  [===]                      |
|                                                         |
|  Total: 200-1060ms (challenging with AI processing)     |
|  -> Parallelization via streaming is essential           |
+-------------------------------------------------------+
```

### 1.3 Latency Optimization Strategy

```
Latency Reduction Through Pipeline Parallelization:
==================================================

[Traditional — Sequential Processing]
  Audio Input -> Wait for STT -> Wait for AI -> Wait for TTS -> Playback
  Total Latency: 2000-3000ms

[Optimized — Pipeline Parallelization]
  Audio Input --> STT(chunk1) -> AI(chunk1) -> TTS(chunk1) -> Playback
                  STT(chunk2) -> AI(chunk2) -> TTS(chunk2) -> Playback
                  STT(chunk3) -> ...

  Each stage streams data to the next stage immediately
  Initial Response Latency: 300-500ms
  Perceived Latency: Natural because responses are heard sentence by sentence

[Further Optimization — Speculative Processing]
  Start AI inference ahead of time with STT intermediate results
  -> Recompute only the diff with the final result
  -> Can further reduce initial response by 100-200ms
==================================================
```

```python
# Code Example: Implementing Pipeline Parallelization
import asyncio
from typing import AsyncIterator

class StreamingPipeline:
    """Streaming pipeline for STT -> AI -> TTS"""

    def __init__(self, stt_engine, ai_engine, tts_engine):
        self.stt = stt_engine
        self.ai = ai_engine
        self.tts = tts_engine
        self.audio_queue = asyncio.Queue()
        self.text_queue = asyncio.Queue()
        self.response_queue = asyncio.Queue()

    async def run(self):
        """Run three pipeline stages in parallel"""
        await asyncio.gather(
            self._stt_stage(),
            self._ai_stage(),
            self._tts_stage(),
        )

    async def _stt_stage(self):
        """Receive audio chunks and convert to text"""
        while True:
            audio_chunk = await self.audio_queue.get()
            if audio_chunk is None:
                await self.text_queue.put(None)
                break

            result = await self.stt.process_chunk(audio_chunk)
            if result and result["type"] == "final":
                await self.text_queue.put(result["text"])

    async def _ai_stage(self):
        """Receive text and generate AI response"""
        while True:
            text = await self.text_queue.get()
            if text is None:
                await self.response_queue.put(None)
                break

            # Generate response via streaming
            buffer = ""
            async for token in self.ai.generate_stream(text):
                buffer += token
                # Split at punctuation and send to TTS
                if any(d in buffer for d in "。！？.!?\n"):
                    await self.response_queue.put(buffer)
                    buffer = ""
            if buffer:
                await self.response_queue.put(buffer)

    async def _tts_stage(self):
        """Receive text and convert to audio"""
        while True:
            text = await self.response_queue.get()
            if text is None:
                break

            async for audio_chunk in self.tts.synthesize_stream(text):
                yield audio_chunk
```

### 1.4 Architecture Pattern Comparison

```
+------------------------------------------------------------+
| Architecture Patterns for Real-Time Audio Applications      |
+------------------------------------------------------------+
|                                                              |
| 1. P2P Direct Communication                                 |
|    Client A <--WebRTC--> Client B                            |
|    Pros: Lowest latency, no server required                  |
|    Cons: No STT/TTS processing, NAT traversal issues         |
|    Use Case: 1-on-1 calls, no scaling needed                 |
|                                                              |
| 2. SFU (Selective Forwarding Unit)                           |
|    Client A --> SFU --> Client B                             |
|                   +--> Client C                              |
|                   +--> STT/TTS Processing                    |
|    Pros: Scalable, server-side processing possible           |
|    Cons: Server cost, slightly increased latency             |
|    Use Case: Group calls, AI voice assistants                |
|                                                              |
| 3. MCU (Multipoint Control Unit)                             |
|    Client A --> MCU (Mixing) --> Client B                    |
|    Client C -->               --> Client D                   |
|    Pros: Minimal client load, uniform delivery               |
|    Cons: High server load, high latency                      |
|    Use Case: Large-scale meetings, recording/streaming       |
|                                                              |
| 4. Hybrid (SFU + AI Processing)                              |
|    Client --> SFU --> AI Worker Pool --> SFU --> Client       |
|    Pros: Balances AI processing and real-time capability     |
|    Cons: Complex design                                      |
|    Use Case: Real-time translation, AI voice dialogue        |
+------------------------------------------------------------+
```

---

## 2. WebRTC Fundamentals

### 2.1 Signaling and Peer Connection

```python
# Code Example 1: WebRTC Server Using Python (aiortc)
import asyncio
import json
from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay

relay = MediaRelay()
pcs = set()

async def offer(request):
    """Receive a WebRTC Offer and return an Answer"""
    params = await request.json()
    offer = RTCSessionDescription(
        sdp=params["sdp"],
        type=params["type"]
    )

    pc = RTCPeerConnection()
    pcs.add(pc)

    @pc.on("track")
    def on_track(track):
        print(f"Track received: {track.kind}")
        if track.kind == "audio":
            # Send received audio to the STT processing pipeline
            processor = AudioProcessor(track)
            pc.addTrack(processor.output_track)

    @pc.on("connectionstatechange")
    async def on_state_change():
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.json_response({
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
    })

app = web.Application()
app.router.add_post("/offer", offer)
web.run_app(app, port=8080)
```

### 2.2 Client-Side Implementation

```javascript
// Code Example 2: Browser-Side WebRTC + Real-Time Transcription Display
class RealtimeAudioClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.pc = null;
    this.transcriptCallback = null;
  }

  async start() {
    // Get microphone input
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
      video: false,
    });

    // Create PeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Add audio tracks
    stream.getAudioTracks().forEach((track) => {
      this.pc.addTrack(track, stream);
    });

    // Receive audio tracks from the server
    this.pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
    };

    // Receive real-time transcription via DataChannel
    this.dc = this.pc.createDataChannel("transcription");
    this.dc.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (this.transcriptCallback) {
        this.transcriptCallback(data);
      }
    };

    // Offer/Answer exchange
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const response = await fetch(`${this.serverUrl}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type,
      }),
    });

    const answer = await response.json();
    await this.pc.setRemoteDescription(answer);
  }

  onTranscript(callback) {
    this.transcriptCallback = callback;
  }

  async stop() {
    if (this.pc) {
      this.pc.close();
    }
  }
}

// Usage example
const client = new RealtimeAudioClient("https://api.example.com");
client.onTranscript((data) => {
  document.getElementById("transcript").textContent += data.text;
});
await client.start();
```

### 2.3 TURN/STUN Server Design

```python
# Code Example: TURN/STUN Configuration and Fallback Strategy
class ICEConfig:
    """ICE (Interactive Connectivity Establishment) configuration manager"""

    def __init__(self):
        self.ice_servers = [
            # STUN servers (NAT traversal, free)
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun1.l.google.com:19302"},

            # TURN servers (relay, paid but reliable)
            {
                "urls": [
                    "turn:turn.example.com:3478?transport=udp",
                    "turn:turn.example.com:3478?transport=tcp",
                    "turns:turn.example.com:5349?transport=tcp",  # TLS
                ],
                "username": "user",
                "credential": "password",
            },
        ]

    def get_config(self, force_relay=False):
        """Return RTCConfiguration"""
        config = {
            "iceServers": self.ice_servers,
            "iceTransportPolicy": "relay" if force_relay else "all",
            "bundlePolicy": "max-bundle",
            "rtcpMuxPolicy": "require",
        }
        return config

    @staticmethod
    async def test_connectivity(pc):
        """Connectivity test — verify STUN/TURN reachability"""
        stats = await pc.getStats()
        candidate_pairs = []

        for report in stats.values():
            if report.type == "candidate-pair" and report.nominated:
                candidate_pairs.append({
                    "local_type": report.local_candidate_type,
                    "remote_type": report.remote_candidate_type,
                    "protocol": report.protocol,
                    "rtt": report.current_round_trip_time,
                })

        return candidate_pairs
```

```javascript
// Code Example: Browser-Side ICE Connection State Monitoring
class ICEMonitor {
  constructor(pc) {
    this.pc = pc;
    this.connectionLog = [];

    // Monitor ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`ICE state: ${state}`);
      this.connectionLog.push({
        state,
        timestamp: Date.now(),
      });

      switch (state) {
        case "checking":
          this._showStatus("Connecting...");
          break;
        case "connected":
          this._showStatus("Connected");
          this._logConnectionType();
          break;
        case "disconnected":
          this._showStatus("Disconnected — Reconnecting...");
          this._attemptReconnect();
          break;
        case "failed":
          this._showStatus("Connection failed");
          this._fallbackToTURN();
          break;
      }
    };

    // Monitor ICE candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`ICE candidate: ${event.candidate.type} ${event.candidate.protocol}`);
      }
    };
  }

  async _logConnectionType() {
    const stats = await this.pc.getStats();
    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.nominated) {
        console.log(`Connection type: ${report.localCandidateType} -> ${report.remoteCandidateType}`);
        console.log(`Protocol: ${report.protocol}`);
        console.log(`RTT: ${report.currentRoundTripTime}ms`);
      }
    });
  }

  async _attemptReconnect() {
    // Attempt ICE restart
    const offer = await this.pc.createOffer({ iceRestart: true });
    await this.pc.setLocalDescription(offer);
    // Renegotiate via signaling server
  }

  _fallbackToTURN() {
    // Fall back to TURN relay when P2P fails
    console.log("Falling back to TURN relay");
  }

  _showStatus(message) {
    console.log(`[ICE] ${message}`);
  }
}
```

### 2.4 Low-Latency Audio Processing with AudioWorklet

```javascript
// Code Example: Real-Time Audio Processing in Browser with AudioWorklet
// audio-processor.js (AudioWorklet Processor)
class RealtimeAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.bufferSize = 4096; // 256ms @ 16kHz
    this.isRecording = true;

    this.port.onmessage = (event) => {
      if (event.data.type === "stop") {
        this.isRecording = false;
      }
    };
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording) return false;

    const input = inputs[0];
    if (input.length === 0) return true;

    const channelData = input[0]; // Mono

    // Append to buffer
    const newBuffer = new Float32Array(this.buffer.length + channelData.length);
    newBuffer.set(this.buffer);
    newBuffer.set(channelData, this.buffer.length);
    this.buffer = newBuffer;

    // Send when buffer is sufficiently filled
    if (this.buffer.length >= this.bufferSize) {
      // Float32 -> Int16 conversion
      const int16Data = new Int16Array(this.buffer.length);
      for (let i = 0; i < this.buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, this.buffer[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(
        { type: "audio", data: int16Data.buffer },
        [int16Data.buffer]
      );
      this.buffer = new Float32Array(0);
    }

    return true;
  }
}

registerProcessor("realtime-audio-processor", RealtimeAudioProcessor);
```

```javascript
// Code Example: Client Integration Using AudioWorklet
class AudioWorkletClient {
  constructor() {
    this.audioContext = null;
    this.workletNode = null;
    this.websocket = null;
  }

  async start(wsUrl) {
    // Initialize AudioContext
    this.audioContext = new AudioContext({ sampleRate: 16000 });

    // Load AudioWorklet module
    await this.audioContext.audioWorklet.addModule("audio-processor.js");

    // Get microphone input
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Create AudioWorkletNode
    const source = this.audioContext.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      "realtime-audio-processor"
    );

    // Send audio data to server via WebSocket
    this.websocket = new WebSocket(wsUrl);
    this.websocket.binaryType = "arraybuffer";

    this.workletNode.port.onmessage = (event) => {
      if (
        event.data.type === "audio" &&
        this.websocket.readyState === WebSocket.OPEN
      ) {
        this.websocket.send(event.data.data);
      }
    };

    // Receive responses from server (transcription results)
    this.websocket.onmessage = (event) => {
      if (typeof event.data === "string") {
        const result = JSON.parse(event.data);
        this.onTranscript(result);
      } else {
        // Binary data = TTS audio
        this.playAudio(event.data);
      }
    };

    // Connect
    source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  onTranscript(result) {
    console.log(`[${result.type}] ${result.text}`);
  }

  async playAudio(arrayBuffer) {
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  stop() {
    this.workletNode?.port.postMessage({ type: "stop" });
    this.websocket?.close();
    this.audioContext?.close();
  }
}
```

---

## 3. Streaming STT

### 3.1 Streaming Speech Recognition Architecture

```
Audio Input (continuous)
  |
  v
+--------+    +--------+    +--------+    +--------+
| Audio  | -> | VAD    | -> | Chunk  | -> | STT    |
| Buffer |    | Check  |    | Split  |    | Engine |
+--------+    +--------+    +--------+    +--------+
                                               |
                                    +----------+----------+
                                    |                     |
                              +---------+           +---------+
                              | Interim |           |  Final  |
                              | Result  |           | Result  |
                              |(partial)|           | (final) |
                              +---------+           +---------+
                                    |                     |
                                    v                     v
                              Real-Time Display     Downstream Processing
                              (Typing Effect)       (Translation/Summary)
```

### 3.2 Google Cloud Speech-to-Text Streaming

```python
# Code Example 3: Google Cloud STT Streaming Recognition
from google.cloud import speech
import pyaudio
import queue
import threading

class StreamingSTT:
    def __init__(self, language="ja-JP", sample_rate=16000):
        self.client = speech.SpeechClient()
        self.config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=sample_rate,
            language_code=language,
            enable_automatic_punctuation=True,
            model="latest_long",  # Model for long-duration audio
        )
        self.streaming_config = speech.StreamingRecognitionConfig(
            config=self.config,
            interim_results=True,  # Enable interim results
        )
        self.audio_queue = queue.Queue()
        self.sample_rate = sample_rate

    def audio_generator(self):
        """Yield audio from the microphone"""
        while True:
            chunk = self.audio_queue.get()
            if chunk is None:
                return
            yield speech.StreamingRecognizeRequest(audio_content=chunk)

    def start_microphone(self):
        """Start microphone input"""
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=1600,  # 100ms chunks
            stream_callback=self._audio_callback,
        )
        return stream

    def _audio_callback(self, in_data, frame_count, time_info, status):
        self.audio_queue.put(in_data)
        return None, pyaudio.paContinue

    def recognize_stream(self, on_result):
        """Execute streaming recognition"""
        requests = self.audio_generator()
        responses = self.client.streaming_recognize(
            self.streaming_config, requests
        )

        for response in responses:
            for result in response.results:
                transcript = result.alternatives[0].transcript
                confidence = result.alternatives[0].confidence

                if result.is_final:
                    on_result({
                        "type": "final",
                        "text": transcript,
                        "confidence": confidence,
                    })
                else:
                    on_result({
                        "type": "partial",
                        "text": transcript,
                    })

# Usage example
stt = StreamingSTT(language="ja-JP")
mic_stream = stt.start_microphone()

def handle_result(result):
    prefix = "[Final]" if result["type"] == "final" else "[Interim]"
    print(f'{prefix} {result["text"]}')

stt.recognize_stream(handle_result)
```

### 3.3 Whisper Streaming Recognition

```python
# Code Example: Real-Time Streaming STT with faster-whisper
import numpy as np
import asyncio
from faster_whisper import WhisperModel
from collections import deque

class WhisperStreamingSTT:
    """
    Wrapper for using Whisper in a streaming fashion.
    Whisper itself is a batch processing model,
    but pseudo-streaming is achieved via a sliding window approach.
    """

    def __init__(
        self,
        model_size: str = "large-v3",
        device: str = "cuda",
        compute_type: str = "float16",
        language: str = "ja",
        chunk_duration: float = 2.0,       # Processing chunk length (seconds)
        overlap_duration: float = 0.5,      # Overlap length (seconds)
        vad_threshold: float = 0.5,
    ):
        self.model = WhisperModel(
            model_size, device=device, compute_type=compute_type
        )
        self.language = language
        self.sample_rate = 16000
        self.chunk_samples = int(chunk_duration * self.sample_rate)
        self.overlap_samples = int(overlap_duration * self.sample_rate)
        self.vad_threshold = vad_threshold

        # Audio buffer
        self.audio_buffer = np.array([], dtype=np.float32)
        self.previous_text = ""
        self.confirmed_text = ""

    async def process_chunk(self, audio_chunk: np.ndarray) -> dict | None:
        """
        Receive an audio chunk and return the recognition result.

        Returns:
            dict with "type" ("partial" or "final") and "text"
        """
        # Append to buffer
        self.audio_buffer = np.concatenate([self.audio_buffer, audio_chunk])

        # Wait if buffer is smaller than chunk size
        if len(self.audio_buffer) < self.chunk_samples:
            return None

        # VAD check
        energy = np.sqrt(np.mean(self.audio_buffer[-self.chunk_samples:] ** 2))
        if energy < 0.01:  # Silence detection
            return None

        # Recognize with Whisper
        segments, info = self.model.transcribe(
            self.audio_buffer[-self.chunk_samples:],
            language=self.language,
            beam_size=5,
            best_of=5,
            vad_filter=True,
            vad_parameters={"threshold": self.vad_threshold},
        )

        current_text = ""
        for segment in segments:
            current_text += segment.text

        if not current_text:
            return None

        # Determine interim/final based on diff from previous result
        if current_text == self.previous_text:
            # Text unchanged = likely end of utterance
            self.confirmed_text += current_text
            self.audio_buffer = self.audio_buffer[-self.overlap_samples:]
            self.previous_text = ""
            return {"type": "final", "text": current_text}
        else:
            self.previous_text = current_text
            return {"type": "partial", "text": current_text}

    def reset(self):
        """Reset buffers"""
        self.audio_buffer = np.array([], dtype=np.float32)
        self.previous_text = ""
        self.confirmed_text = ""
```

### 3.4 Azure Speech Streaming

```python
# Code Example: Streaming STT with Azure Speech SDK (Detailed Version)
import azure.cognitiveservices.speech as speechsdk
import json
import time

class AzureStreamingSTT:
    """Streaming speech recognition using Azure Speech SDK"""

    def __init__(
        self,
        subscription_key: str,
        region: str = "japaneast",
        language: str = "ja-JP",
    ):
        self.speech_config = speechsdk.SpeechConfig(
            subscription=subscription_key,
            region=region,
        )
        self.speech_config.speech_recognition_language = language

        # Detailed recognition settings
        self.speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
            "5000"  # Initial silence timeout: 5 seconds
        )
        self.speech_config.set_property(
            speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
            "1000"  # End-of-speech detection: 1 second
        )
        self.speech_config.enable_dictation()  # Dictation mode

        # Phrase list (for improving recognition accuracy)
        self.phrase_list = None

        # Callbacks
        self.on_partial = None
        self.on_final = None
        self.on_error = None

        # Statistics
        self.stats = {
            "total_recognized": 0,
            "total_duration_ms": 0,
            "errors": 0,
        }

    def add_phrases(self, phrases: list[str]):
        """Add phrases to improve recognition accuracy"""
        self.phrase_list = phrases

    def start_continuous(self):
        """Start continuous speech recognition from microphone"""
        audio_config = speechsdk.audio.AudioConfig(
            use_default_microphone=True
        )
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        # Set phrase list
        if self.phrase_list:
            phrase_list_grammar = speechsdk.PhraseListGrammar.from_recognizer(
                recognizer
            )
            for phrase in self.phrase_list:
                phrase_list_grammar.addPhrase(phrase)

        # Register event handlers
        recognizer.recognizing.connect(self._on_recognizing)
        recognizer.recognized.connect(self._on_recognized)
        recognizer.canceled.connect(self._on_canceled)
        recognizer.session_started.connect(
            lambda evt: print(f"Session started: {evt.session_id}")
        )
        recognizer.session_stopped.connect(
            lambda evt: print(f"Session stopped: {evt.session_id}")
        )

        # Start continuous recognition
        recognizer.start_continuous_recognition()
        return recognizer

    def start_from_stream(self, format_info=None):
        """Speech recognition from push stream"""
        if format_info is None:
            format_info = speechsdk.audio.AudioStreamFormat(
                samples_per_second=16000,
                bits_per_sample=16,
                channels=1,
            )

        push_stream = speechsdk.audio.PushAudioInputStream(format_info)
        audio_config = speechsdk.audio.AudioConfig(stream=push_stream)

        recognizer = speechsdk.SpeechRecognizer(
            speech_config=self.speech_config,
            audio_config=audio_config,
        )

        # Register event handlers (same as above)
        recognizer.recognizing.connect(self._on_recognizing)
        recognizer.recognized.connect(self._on_recognized)
        recognizer.canceled.connect(self._on_canceled)

        recognizer.start_continuous_recognition()
        return recognizer, push_stream

    def _on_recognizing(self, evt):
        """Callback for interim results"""
        if self.on_partial:
            self.on_partial({
                "type": "partial",
                "text": evt.result.text,
                "offset": evt.result.offset,
                "duration": evt.result.duration,
            })

    def _on_recognized(self, evt):
        """Callback for final results"""
        if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            self.stats["total_recognized"] += 1
            self.stats["total_duration_ms"] += evt.result.duration / 10000

            if self.on_final:
                # Get detailed recognition result as JSON
                detail_json = evt.result.properties.get(
                    speechsdk.PropertyId.SpeechServiceResponse_JsonResult, ""
                )
                detail = json.loads(detail_json) if detail_json else {}

                self.on_final({
                    "type": "final",
                    "text": evt.result.text,
                    "confidence": detail.get("NBest", [{}])[0].get(
                        "Confidence", 0.0
                    ),
                    "offset_ms": evt.result.offset / 10000,
                    "duration_ms": evt.result.duration / 10000,
                    "words": detail.get("NBest", [{}])[0].get(
                        "Words", []
                    ),
                })

    def _on_canceled(self, evt):
        """Callback for cancellation/errors"""
        self.stats["errors"] += 1
        if self.on_error:
            self.on_error({
                "reason": str(evt.cancellation_details.reason),
                "error_details": evt.cancellation_details.error_details,
            })
```

### 3.5 gRPC Streaming STT Server

```python
# Code Example: gRPC-Based Streaming STT Server
import grpc
from concurrent import futures
import numpy as np
from faster_whisper import WhisperModel

# Proto definition (conceptual):
# service StreamingSTT {
#   rpc StreamRecognize(stream AudioChunk) returns (stream RecognitionResult);
# }
# message AudioChunk { bytes audio_data = 1; int32 sample_rate = 2; }
# message RecognitionResult { string text = 1; bool is_final = 2; float confidence = 3; }

class StreamingSTTServicer:
    """gRPC Streaming STT Service"""

    def __init__(self):
        self.model = WhisperModel("large-v3", device="cuda", compute_type="float16")
        self.active_sessions = {}

    async def StreamRecognize(self, request_iterator, context):
        """Bidirectional streaming RPC"""
        session_id = context.peer()
        audio_buffer = np.array([], dtype=np.float32)
        chunk_size = 16000 * 2  # 2 seconds worth

        async for request in request_iterator:
            # bytes -> numpy conversion
            audio_chunk = np.frombuffer(request.audio_data, dtype=np.int16)
            audio_float = audio_chunk.astype(np.float32) / 32768.0
            audio_buffer = np.concatenate([audio_buffer, audio_float])

            # Run recognition when chunk size is reached
            if len(audio_buffer) >= chunk_size:
                segments, info = self.model.transcribe(
                    audio_buffer,
                    language="ja",
                    beam_size=5,
                    vad_filter=True,
                )

                text = "".join(seg.text for seg in segments)
                if text:
                    # Return interim result
                    yield RecognitionResult(
                        text=text,
                        is_final=False,
                        confidence=0.0,
                    )

                # Clear buffer keeping overlap
                overlap = 16000  # 1 second
                audio_buffer = audio_buffer[-overlap:]

        # Final result
        if len(audio_buffer) > 0:
            segments, info = self.model.transcribe(audio_buffer, language="ja")
            text = "".join(seg.text for seg in segments)
            if text:
                yield RecognitionResult(
                    text=text,
                    is_final=True,
                    confidence=info.language_probability,
                )
```

---

## 4. Streaming TTS

### 4.1 Low-Latency TTS Pipeline

```python
# Code Example 4: Chunk-Based Streaming TTS
import asyncio
import edge_tts

async def streaming_tts(text: str, voice: str = "ja-JP-NanamiNeural"):
    """
    Receive text and return audio chunks via streaming.
    Minimize the time to first byte (TTFB).
    """
    communicate = edge_tts.Communicate(text, voice)
    audio_chunks = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]
        elif chunk["type"] == "WordBoundary":
            # Word boundary information (can be used for lip sync, etc.)
            print(f"  Word: {chunk['text']} at {chunk['offset']}ms")

async def realtime_conversation_tts(text_stream):
    """
    Convert text stream from an LLM to audio in real time.
    Buffer by sentence, splitting at punctuation marks to send to TTS.
    """
    buffer = ""
    sentence_delimiters = {"。", "！", "？", ".", "!", "?", "\n"}

    async for text_chunk in text_stream:
        buffer += text_chunk

        # Detect sentence boundaries
        for delimiter in sentence_delimiters:
            if delimiter in buffer:
                sentences = buffer.split(delimiter)
                for sentence in sentences[:-1]:
                    sentence = sentence.strip()
                    if sentence:
                        # Send to TTS per sentence (start processing next sentence in parallel)
                        async for audio_chunk in streaming_tts(
                            sentence + delimiter
                        ):
                            yield audio_chunk
                buffer = sentences[-1]

    # Process remaining buffer
    if buffer.strip():
        async for audio_chunk in streaming_tts(buffer):
            yield audio_chunk
```

### 4.2 Bidirectional Streaming via WebSocket

```python
# Code Example 5: Real-Time STT + TTS with FastAPI WebSocket
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import numpy as np

app = FastAPI()

@app.websocket("/ws/audio")
async def audio_websocket(websocket: WebSocket):
    await websocket.accept()

    stt_engine = StreamingSTTEngine()
    tts_engine = StreamingTTSEngine()

    async def process_audio():
        """Process audio from the client with STT"""
        try:
            while True:
                audio_bytes = await websocket.receive_bytes()
                audio_array = np.frombuffer(audio_bytes, dtype=np.int16)

                # Convert to text with STT
                result = await stt_engine.process_chunk(audio_array)

                if result and result["type"] == "final":
                    # Send finalized text
                    await websocket.send_json({
                        "type": "transcript",
                        "text": result["text"],
                    })

                    # Generate AI response + TTS
                    ai_response = await generate_ai_response(result["text"])
                    async for audio_chunk in tts_engine.synthesize_stream(
                        ai_response
                    ):
                        await websocket.send_bytes(audio_chunk)

                elif result and result["type"] == "partial":
                    await websocket.send_json({
                        "type": "partial_transcript",
                        "text": result["text"],
                    })

        except WebSocketDisconnect:
            print("Client disconnected")

    await process_audio()
```

### 4.3 ElevenLabs Streaming TTS

```python
# Code Example: ElevenLabs WebSocket Streaming TTS
import websockets
import json
import asyncio

class ElevenLabsStreamingTTS:
    """Streaming TTS using ElevenLabs WebSocket API"""

    def __init__(self, api_key: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM"):
        self.api_key = api_key
        self.voice_id = voice_id
        self.model_id = "eleven_multilingual_v2"
        self.ws_url = (
            f"wss://api.elevenlabs.io/v1/text-to-speech/"
            f"{voice_id}/stream-input?model_id={self.model_id}"
        )

    async def stream_text_to_speech(
        self,
        text_iterator,
        output_format: str = "pcm_16000",
    ):
        """
        Generate audio chunks via streaming from a text iterator.
        Can directly receive LLM streaming output.
        """
        async with websockets.connect(self.ws_url) as ws:
            # Initial configuration message
            await ws.send(json.dumps({
                "text": " ",  # Initial buffer
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.0,
                    "use_speaker_boost": True,
                },
                "xi_api_key": self.api_key,
                "output_format": output_format,
                "flush": False,
            }))

            # Task to send text
            async def send_text():
                async for text_chunk in text_iterator:
                    await ws.send(json.dumps({
                        "text": text_chunk,
                        "flush": False,
                    }))

                # End signal
                await ws.send(json.dumps({
                    "text": "",
                    "flush": True,
                }))

            # Task to receive audio
            async def receive_audio():
                while True:
                    try:
                        response = await ws.recv()
                        data = json.loads(response)

                        if "audio" in data and data["audio"]:
                            import base64
                            audio_bytes = base64.b64decode(data["audio"])
                            yield audio_bytes

                        if data.get("isFinal"):
                            break

                    except websockets.exceptions.ConnectionClosed:
                        break

            # Run send and receive in parallel
            send_task = asyncio.create_task(send_text())
            async for audio_chunk in receive_audio():
                yield audio_chunk

            await send_task


# Usage example: LLM + ElevenLabs Streaming
async def llm_to_speech():
    """Convert LLM output to speech in real time"""
    import openai

    client = openai.AsyncOpenAI()
    tts = ElevenLabsStreamingTTS(api_key="your-api-key")

    # LLM streaming
    async def llm_stream():
        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Tell me about the four seasons in Japan"}],
            stream=True,
        )
        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # LLM -> TTS streaming pipeline
    async for audio_chunk in tts.stream_text_to_speech(llm_stream()):
        # Play audio chunk or send to client
        await play_audio(audio_chunk)
```

### 4.4 TTS Prefetch and Buffering

```python
# Code Example: TTS Audio Prefetch and Buffering Strategy
import asyncio
from collections import deque
import time

class TTSAudioBuffer:
    """
    Buffering and playback control for TTS audio chunks.
    Achieves smooth uninterrupted playback.
    """

    def __init__(
        self,
        min_buffer_ms: int = 200,      # Minimum buffer (playback start threshold)
        max_buffer_ms: int = 2000,     # Maximum buffer
        sample_rate: int = 16000,
        bytes_per_sample: int = 2,     # 16-bit PCM
    ):
        self.min_buffer_ms = min_buffer_ms
        self.max_buffer_ms = max_buffer_ms
        self.sample_rate = sample_rate
        self.bytes_per_sample = bytes_per_sample
        self.bytes_per_ms = sample_rate * bytes_per_sample / 1000

        self.buffer = deque()
        self.total_buffered_bytes = 0
        self.is_playing = False
        self.playback_started = False

        # Metrics
        self.metrics = {
            "underruns": 0,          # Number of buffer underruns
            "ttfb_ms": 0,            # Latency to first audio chunk
            "total_chunks": 0,
            "start_time": None,
        }

    async def add_chunk(self, audio_bytes: bytes):
        """Add an audio chunk to the buffer"""
        if self.metrics["start_time"] is None:
            self.metrics["start_time"] = time.monotonic()

        self.buffer.append(audio_bytes)
        self.total_buffered_bytes += len(audio_bytes)
        self.metrics["total_chunks"] += 1

        # Record TTFB
        if not self.playback_started and self.metrics["ttfb_ms"] == 0:
            self.metrics["ttfb_ms"] = (
                time.monotonic() - self.metrics["start_time"]
            ) * 1000

        # Start playback when minimum buffer is reached
        buffered_ms = self.total_buffered_bytes / self.bytes_per_ms
        if not self.playback_started and buffered_ms >= self.min_buffer_ms:
            self.playback_started = True

    async def get_chunk(self) -> bytes | None:
        """Get an audio chunk for playback"""
        if not self.playback_started:
            return None

        if len(self.buffer) == 0:
            self.metrics["underruns"] += 1
            return None

        chunk = self.buffer.popleft()
        self.total_buffered_bytes -= len(chunk)
        return chunk

    @property
    def buffered_ms(self) -> float:
        """Current buffer amount (milliseconds)"""
        return self.total_buffered_bytes / self.bytes_per_ms

    def get_metrics(self) -> dict:
        """Return buffer metrics"""
        return {
            **self.metrics,
            "buffered_ms": self.buffered_ms,
            "buffer_chunks": len(self.buffer),
        }
```

---

## 5. Protocol and Codec Comparison

### 5.1 Audio Codec Comparison

| Codec | Bitrate | Latency | Quality | WebRTC Support | Use Case |
|-------|---------|---------|---------|----------------|----------|
| Opus | 6-510 kbps | 5ms | Excellent | Yes | Voice calls (recommended) |
| G.711 | 64 kbps | 0.125ms | Fair | Yes | Telephony (legacy) |
| AAC | 8-320 kbps | 20ms | Excellent | Partial | Streaming |
| Lyra | 3-9 kbps | 10ms | Good | No | Low-bandwidth environments |
| Codec2 | 0.7-3.2 kbps | 40ms | Fair | No | IoT/Embedded |

### 5.2 Communication Protocol Comparison

| Protocol | Latency | Reliability | Bidirectional | Use Case |
|----------|---------|-------------|---------------|----------|
| WebRTC | Very Low | UDP (best effort) | Yes | P2P voice calls |
| WebSocket | Low | TCP (guaranteed) | Yes | Text/control channel |
| gRPC Streaming | Low | HTTP/2 | Yes | STT/TTS API |
| HTTP SSE | Medium | HTTP/1.1 | Unidirectional | TTS output delivery |

### 5.3 Opus Codec Detailed Configuration

```python
# Code Example: Opus Codec Configuration Optimization
import opuslib

class OpusConfig:
    """Optimal Opus codec settings for different use cases"""

    PRESETS = {
        "voip": {
            "application": opuslib.APPLICATION_VOIP,
            "bitrate": 24000,         # 24 kbps
            "frame_size_ms": 20,      # 20ms frame
            "bandwidth": "narrowband", # 8kHz
            "fec": True,              # Forward error correction
            "dtx": True,              # Discontinuous transmission (stop during silence)
            "packet_loss": 10,        # Assume 10% packet loss
            "description": "For voice calls. High quality at low bitrate",
        },
        "realtime_stt": {
            "application": opuslib.APPLICATION_VOIP,
            "bitrate": 32000,         # 32 kbps
            "frame_size_ms": 20,
            "bandwidth": "wideband",   # 16kHz (recommended for STT)
            "fec": False,
            "dtx": False,             # Silence is also important for STT
            "packet_loss": 0,
            "description": "For real-time STT. Audio quality priority",
        },
        "music_streaming": {
            "application": opuslib.APPLICATION_AUDIO,
            "bitrate": 128000,        # 128 kbps
            "frame_size_ms": 20,
            "bandwidth": "fullband",   # 48kHz
            "fec": True,
            "dtx": False,
            "packet_loss": 5,
            "description": "For music streaming. Full-band high quality",
        },
    }

    @classmethod
    def create_encoder(cls, preset: str = "voip", sample_rate: int = 16000):
        """Create an encoder from a preset"""
        config = cls.PRESETS[preset]
        channels = 1

        encoder = opuslib.Encoder(
            sample_rate,
            channels,
            config["application"],
        )
        encoder.bitrate = config["bitrate"]

        if config["fec"]:
            encoder.inband_fec = True
            encoder.packet_loss_perc = config["packet_loss"]

        if config["dtx"]:
            encoder.dtx = True

        return encoder, config

    @classmethod
    def create_decoder(cls, sample_rate: int = 16000):
        """Create a decoder"""
        return opuslib.Decoder(sample_rate, 1)
```

---

## 6. VAD (Voice Activity Detection) Integration

### 6.1 Silero VAD Real-Time Integration

```python
# Code Example: Integrating Silero VAD into a Real-Time Pipeline
import torch
import numpy as np
from collections import deque

class RealtimeVAD:
    """
    Real-time VAD (Voice Activity Detection).
    Detects silence intervals and generates speech start/end events.
    """

    def __init__(
        self,
        threshold: float = 0.5,
        min_speech_ms: int = 250,       # Minimum speech duration
        min_silence_ms: int = 500,      # Silence duration for end-of-speech detection
        speech_pad_ms: int = 100,       # Padding before and after speech
        sample_rate: int = 16000,
        window_size_ms: int = 32,       # VAD window size
    ):
        # Load Silero VAD model
        self.model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True,
        )
        self.model.eval()

        self.threshold = threshold
        self.sample_rate = sample_rate
        self.window_size = int(window_size_ms * sample_rate / 1000)
        self.min_speech_samples = int(min_speech_ms * sample_rate / 1000)
        self.min_silence_samples = int(min_silence_ms * sample_rate / 1000)
        self.speech_pad_samples = int(speech_pad_ms * sample_rate / 1000)

        # State management
        self.is_speaking = False
        self.speech_start = 0
        self.speech_end = 0
        self.silence_count = 0
        self.speech_count = 0
        self.current_sample = 0

        # Audio buffer (for pre-speech padding)
        self.pre_buffer = deque(
            maxlen=self.speech_pad_samples // self.window_size + 1
        )

    def process(self, audio_chunk: np.ndarray) -> list[dict]:
        """
        Process an audio chunk and return VAD events.

        Returns:
            list of events: [{"type": "speech_start"/"speech_end", "sample": int}]
        """
        events = []
        audio_tensor = torch.from_numpy(audio_chunk).float()

        # Process in window units
        for i in range(0, len(audio_tensor), self.window_size):
            window = audio_tensor[i:i + self.window_size]
            if len(window) < self.window_size:
                # Padding
                window = torch.nn.functional.pad(
                    window, (0, self.window_size - len(window))
                )

            # VAD inference
            speech_prob = self.model(window, self.sample_rate).item()

            if speech_prob >= self.threshold:
                self.speech_count += self.window_size
                self.silence_count = 0

                if not self.is_speaking:
                    if self.speech_count >= self.min_speech_samples:
                        self.is_speaking = True
                        self.speech_start = self.current_sample - self.speech_count
                        events.append({
                            "type": "speech_start",
                            "sample": self.speech_start,
                            "time_ms": self.speech_start / self.sample_rate * 1000,
                        })
            else:
                self.silence_count += self.window_size

                if self.is_speaking:
                    if self.silence_count >= self.min_silence_samples:
                        self.is_speaking = False
                        self.speech_end = self.current_sample
                        duration_ms = (
                            (self.speech_end - self.speech_start)
                            / self.sample_rate * 1000
                        )
                        events.append({
                            "type": "speech_end",
                            "sample": self.speech_end,
                            "time_ms": self.speech_end / self.sample_rate * 1000,
                            "duration_ms": duration_ms,
                        })
                        self.speech_count = 0

                if not self.is_speaking:
                    self.speech_count = 0

            self.current_sample += self.window_size

            # Save to pre-buffer
            self.pre_buffer.append(window.numpy())

        return events

    def reset(self):
        """Reset state"""
        self.model.reset_states()
        self.is_speaking = False
        self.speech_count = 0
        self.silence_count = 0
        self.current_sample = 0
        self.pre_buffer.clear()
```

### 6.2 VAD-Integrated Streaming Pipeline

```python
# Code Example: Integrated VAD + STT + TTS Pipeline
import asyncio
import numpy as np

class VADIntegratedPipeline:
    """Intelligent streaming pipeline using VAD"""

    def __init__(self, vad, stt_engine, tts_engine, ai_engine):
        self.vad = vad
        self.stt = stt_engine
        self.tts = tts_engine
        self.ai = ai_engine

        # Speech segment buffer
        self.speech_buffer = np.array([], dtype=np.float32)
        self.is_collecting = False

    async def process_audio_stream(self, audio_stream):
        """
        Process an audio stream and return AI responses as audio.
        Use VAD to skip silence intervals for efficient processing.
        """
        async for audio_chunk in audio_stream:
            # Detect speech segments with VAD
            events = self.vad.process(audio_chunk)

            for event in events:
                if event["type"] == "speech_start":
                    self.is_collecting = True
                    self.speech_buffer = np.array([], dtype=np.float32)

                elif event["type"] == "speech_end":
                    self.is_collecting = False

                    if len(self.speech_buffer) > 0:
                        # Recognize speech segment with STT
                        result = await self.stt.transcribe(self.speech_buffer)

                        if result and result["text"]:
                            # Generate AI response
                            response_text = await self.ai.generate(result["text"])

                            # Streaming speech synthesis with TTS
                            async for tts_chunk in self.tts.synthesize_stream(
                                response_text
                            ):
                                yield {
                                    "type": "audio",
                                    "data": tts_chunk,
                                }

                            # Also send metadata
                            yield {
                                "type": "metadata",
                                "user_text": result["text"],
                                "ai_text": response_text,
                                "speech_duration_ms": event["duration_ms"],
                            }

            # Accumulate in buffer during speech
            if self.is_collecting:
                audio_float = audio_chunk.astype(np.float32) / 32768.0
                self.speech_buffer = np.concatenate(
                    [self.speech_buffer, audio_float]
                )
```

---

## 7. Media Server Design

### 7.1 mediasoup-Based SFU Server

```javascript
// Code Example: SFU Server Using mediasoup (Node.js)
const mediasoup = require("mediasoup");

class SFUServer {
  constructor() {
    this.workers = [];
    this.routers = new Map(); // roomId -> Router
    this.transports = new Map(); // peerId -> Transport
    this.producers = new Map(); // peerId -> Producer
    this.consumers = new Map(); // peerId -> [Consumer]
  }

  async init(numWorkers = 4) {
    // Start worker processes
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: "warn",
        rtcMinPort: 10000 + i * 1000,
        rtcMaxPort: 10999 + i * 1000,
      });

      worker.on("died", () => {
        console.error(`Worker ${i} died, restarting...`);
        this._restartWorker(i);
      });

      this.workers.push(worker);
    }
    console.log(`${numWorkers} mediasoup workers started`);
  }

  async createRoom(roomId) {
    // Select worker via round-robin
    const worker = this.workers[this.routers.size % this.workers.length];

    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
          parameters: {
            "sprop-stereo": 1,
            usedtx: 1,
          },
        },
      ],
    });

    this.routers.set(roomId, router);
    return router;
  }

  async createWebRtcTransport(roomId, peerId, direction) {
    const router = this.routers.get(roomId);

    const transport = await router.createWebRtcTransport({
      listenIps: [
        { ip: "0.0.0.0", announcedIp: process.env.PUBLIC_IP },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 128000,
    });

    transport.on("dtlsstatechange", (state) => {
      if (state === "closed") {
        transport.close();
      }
    });

    this.transports.set(`${peerId}-${direction}`, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async produce(peerId, transportId, kind, rtpParameters) {
    const transport = this.transports.get(`${peerId}-send`);
    const producer = await transport.produce({ kind, rtpParameters });

    this.producers.set(peerId, producer);

    // Notify other participants
    producer.on("transportclose", () => {
      producer.close();
      this.producers.delete(peerId);
    });

    return producer.id;
  }

  async consume(roomId, consumerPeerId, producerPeerId) {
    const router = this.routers.get(roomId);
    const producer = this.producers.get(producerPeerId);
    const transport = this.transports.get(`${consumerPeerId}-recv`);

    if (!router.canConsume({ producerId: producer.id, rtpCapabilities: {} })) {
      throw new Error("Cannot consume");
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    });

    return {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }
}
```

### 7.2 Scaling Design with Kubernetes

```yaml
# Code Example: Kubernetes Manifests — Autoscaling STT/TTS Workers

# STT Worker Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stt-worker
  labels:
    app: realtime-audio
    component: stt
spec:
  replicas: 2
  selector:
    matchLabels:
      app: stt-worker
  template:
    metadata:
      labels:
        app: stt-worker
    spec:
      containers:
        - name: stt-worker
          image: your-registry/stt-worker:latest
          resources:
            requests:
              cpu: "2"
              memory: "4Gi"
              nvidia.com/gpu: "1"    # GPU required
            limits:
              cpu: "4"
              memory: "8Gi"
              nvidia.com/gpu: "1"
          env:
            - name: WHISPER_MODEL
              value: "large-v3"
            - name: COMPUTE_TYPE
              value: "float16"
            - name: MAX_CONCURRENT_STREAMS
              value: "8"
          ports:
            - containerPort: 50051   # gRPC
          livenessProbe:
            grpc:
              port: 50051
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            grpc:
              port: 50051
            initialDelaySeconds: 15

---
# HPA (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: stt-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: stt-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: active_streams
        target:
          type: AverageValue
          averageValue: "6"    # Target 6 streams per pod

---
# TTS Worker Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tts-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: tts-worker
  template:
    spec:
      containers:
        - name: tts-worker
          image: your-registry/tts-worker:latest
          resources:
            requests:
              cpu: "1"
              memory: "2Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
          env:
            - name: TTS_ENGINE
              value: "edge-tts"
            - name: CACHE_SIZE_MB
              value: "512"
```

---

## 8. Quality Monitoring and Debugging

### 8.1 Audio Quality Metrics

```python
# Code Example: Real-Time Audio Quality Monitoring
import time
import numpy as np
from dataclasses import dataclass, field

@dataclass
class AudioQualityMetrics:
    """Real-time audio quality metrics"""

    # Latency-related
    e2e_latency_ms: list = field(default_factory=list)
    stt_latency_ms: list = field(default_factory=list)
    tts_ttfb_ms: list = field(default_factory=list)

    # Audio quality
    snr_db: list = field(default_factory=list)
    packet_loss_rate: list = field(default_factory=list)
    jitter_ms: list = field(default_factory=list)

    # STT quality
    stt_confidence: list = field(default_factory=list)
    partial_to_final_changes: int = 0

    # Buffer state
    buffer_underruns: int = 0
    buffer_overruns: int = 0

class QualityMonitor:
    """Real-time quality monitor"""

    def __init__(self, report_interval_sec: int = 10):
        self.metrics = AudioQualityMetrics()
        self.report_interval = report_interval_sec
        self.last_report_time = time.monotonic()
        self.alerts = []

    def record_latency(self, stage: str, latency_ms: float):
        """Record latency"""
        if stage == "e2e":
            self.metrics.e2e_latency_ms.append(latency_ms)
        elif stage == "stt":
            self.metrics.stt_latency_ms.append(latency_ms)
        elif stage == "tts_ttfb":
            self.metrics.tts_ttfb_ms.append(latency_ms)

        # Alert check
        if stage == "e2e" and latency_ms > 1000:
            self.alerts.append({
                "level": "warning",
                "message": f"E2E latency {latency_ms:.0f}ms exceeds 1000ms",
                "timestamp": time.time(),
            })

    def record_audio_quality(self, audio_chunk: np.ndarray, noise_estimate: float = 0):
        """Record audio quality"""
        # SNR calculation
        signal_power = np.mean(audio_chunk ** 2)
        if noise_estimate > 0:
            snr = 10 * np.log10(signal_power / noise_estimate)
            self.metrics.snr_db.append(snr)

    def record_packet_loss(self, expected: int, received: int):
        """Record packet loss rate"""
        loss_rate = 1 - (received / expected) if expected > 0 else 0
        self.metrics.packet_loss_rate.append(loss_rate)

        if loss_rate > 0.05:
            self.alerts.append({
                "level": "warning",
                "message": f"Packet loss {loss_rate:.1%} exceeds 5%",
                "timestamp": time.time(),
            })

    def get_report(self) -> dict:
        """Generate quality report"""
        def safe_stats(data):
            if not data:
                return {"avg": 0, "p50": 0, "p95": 0, "p99": 0, "max": 0}
            arr = np.array(data)
            return {
                "avg": float(np.mean(arr)),
                "p50": float(np.percentile(arr, 50)),
                "p95": float(np.percentile(arr, 95)),
                "p99": float(np.percentile(arr, 99)),
                "max": float(np.max(arr)),
            }

        return {
            "latency": {
                "e2e": safe_stats(self.metrics.e2e_latency_ms),
                "stt": safe_stats(self.metrics.stt_latency_ms),
                "tts_ttfb": safe_stats(self.metrics.tts_ttfb_ms),
            },
            "audio_quality": {
                "snr_db": safe_stats(self.metrics.snr_db),
                "packet_loss": safe_stats(self.metrics.packet_loss_rate),
            },
            "buffer": {
                "underruns": self.metrics.buffer_underruns,
                "overruns": self.metrics.buffer_overruns,
            },
            "alerts": self.alerts[-10:],  # Latest 10
        }
```

### 8.2 WebRTC Statistics Collection

```javascript
// Code Example: Detailed Statistics Collection via WebRTC getStats()
class WebRTCStatsCollector {
  constructor(pc, intervalMs = 5000) {
    this.pc = pc;
    this.intervalMs = intervalMs;
    this.history = [];
    this.previousStats = null;
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this.collect(), this.intervalMs);
  }

  stop() {
    clearInterval(this.timer);
  }

  async collect() {
    const stats = await this.pc.getStats();
    const report = {
      timestamp: Date.now(),
      inbound: {},
      outbound: {},
      connection: {},
    };

    stats.forEach((stat) => {
      // Inbound audio track
      if (stat.type === "inbound-rtp" && stat.kind === "audio") {
        report.inbound = {
          packetsReceived: stat.packetsReceived,
          packetsLost: stat.packetsLost,
          jitter: stat.jitter,
          bytesReceived: stat.bytesReceived,
          // Calculate bitrate from diff with previous
          bitrate: this._calcBitrate(stat, "inbound"),
          // Packet loss rate
          lossRate:
            stat.packetsLost /
            (stat.packetsReceived + stat.packetsLost || 1),
        };
      }

      // Outbound audio track
      if (stat.type === "outbound-rtp" && stat.kind === "audio") {
        report.outbound = {
          packetsSent: stat.packetsSent,
          bytesSent: stat.bytesSent,
          bitrate: this._calcBitrate(stat, "outbound"),
          retransmittedPacketsSent: stat.retransmittedPacketsSent || 0,
        };
      }

      // Connection info
      if (stat.type === "candidate-pair" && stat.nominated) {
        report.connection = {
          rtt: stat.currentRoundTripTime * 1000, // ms
          availableOutgoingBitrate: stat.availableOutgoingBitrate,
          localCandidateType: stat.localCandidateType,
          remoteCandidateType: stat.remoteCandidateType,
          protocol: stat.protocol,
        };
      }
    });

    this.history.push(report);

    // Alert check
    if (report.inbound.lossRate > 0.05) {
      console.warn(
        `High packet loss: ${(report.inbound.lossRate * 100).toFixed(1)}%`
      );
    }
    if (report.connection.rtt > 200) {
      console.warn(`High RTT: ${report.connection.rtt.toFixed(0)}ms`);
    }

    return report;
  }

  _calcBitrate(stat, direction) {
    if (!this.previousStats) {
      this.previousStats = {};
      return 0;
    }
    const key = `${direction}_bytes`;
    const prevBytes = this.previousStats[key] || 0;
    const currentBytes =
      direction === "inbound" ? stat.bytesReceived : stat.bytesSent;

    const bitrate =
      ((currentBytes - prevBytes) * 8) / (this.intervalMs / 1000);
    this.previousStats[key] = currentBytes;
    return bitrate;
  }

  getSummary() {
    if (this.history.length === 0) return null;

    const rtts = this.history
      .filter((r) => r.connection.rtt)
      .map((r) => r.connection.rtt);
    const lossRates = this.history
      .filter((r) => r.inbound.lossRate !== undefined)
      .map((r) => r.inbound.lossRate);

    return {
      avgRtt: rtts.reduce((a, b) => a + b, 0) / rtts.length || 0,
      maxRtt: Math.max(...rtts, 0),
      avgLossRate:
        lossRates.reduce((a, b) => a + b, 0) / lossRates.length || 0,
      totalSamples: this.history.length,
    };
  }
}
```

---

## 9. Connection Recovery and Fallback

### 9.1 Automatic Reconnection Logic

```python
# Code Example: Automatic Reconnection with Exponential Backoff
import asyncio
import random
import logging

logger = logging.getLogger(__name__)

class ReconnectManager:
    """Automatic reconnection manager for WebSocket / WebRTC"""

    def __init__(
        self,
        max_retries: int = 10,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        jitter: float = 0.5,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter
        self.retry_count = 0
        self.is_connected = False

    async def connect_with_retry(self, connect_fn, on_connected=None):
        """
        Attempt reconnection with exponential backoff + jitter.

        Args:
            connect_fn: Connection function (async callable)
            on_connected: Callback on successful connection
        """
        while self.retry_count < self.max_retries:
            try:
                connection = await connect_fn()
                self.is_connected = True
                self.retry_count = 0
                logger.info("Connected successfully")

                if on_connected:
                    await on_connected(connection)

                return connection

            except Exception as e:
                self.retry_count += 1
                delay = self._calc_delay()

                logger.warning(
                    f"Connection failed (attempt {self.retry_count}/"
                    f"{self.max_retries}): {e}. "
                    f"Retrying in {delay:.1f}s"
                )

                if self.retry_count >= self.max_retries:
                    logger.error("Max retries exceeded, giving up")
                    raise

                await asyncio.sleep(delay)

    def _calc_delay(self) -> float:
        """Exponential backoff + jitter"""
        delay = min(
            self.base_delay * (2 ** (self.retry_count - 1)),
            self.max_delay
        )
        # Add jitter (within +/- jitter range)
        jitter_range = delay * self.jitter
        delay += random.uniform(-jitter_range, jitter_range)
        return max(0.1, delay)

    def reset(self):
        """Reset retry counter"""
        self.retry_count = 0
        self.is_connected = False
```

### 9.2 Protocol Fallback

```python
# Code Example: Fallback from WebRTC -> WebSocket -> HTTP Polling
class ProtocolFallback:
    """
    Communication protocol fallback strategy.
    WebRTC (lowest latency) -> WebSocket (low latency) -> HTTP SSE (medium latency)
    """

    PROTOCOLS = [
        {
            "name": "webrtc",
            "latency": "lowest",
            "description": "Real-time audio via P2P/SFU",
        },
        {
            "name": "websocket",
            "latency": "low",
            "description": "Audio send/receive via WebSocket binary frames",
        },
        {
            "name": "http_sse",
            "latency": "medium",
            "description": "Send audio via HTTP POST, receive results via SSE",
        },
    ]

    def __init__(self):
        self.current_protocol = None
        self.available_protocols = list(self.PROTOCOLS)
        self.fallback_history = []

    async def connect(self, server_url: str):
        """Attempt connection with the optimal protocol"""
        for protocol in self.available_protocols:
            try:
                connection = await self._try_connect(
                    protocol["name"], server_url
                )
                self.current_protocol = protocol
                return connection
            except Exception as e:
                self.fallback_history.append({
                    "protocol": protocol["name"],
                    "error": str(e),
                    "timestamp": time.time(),
                })
                continue

        raise ConnectionError("All protocols failed")

    async def _try_connect(self, protocol: str, url: str):
        """Protocol-specific connection handling"""
        if protocol == "webrtc":
            return await self._connect_webrtc(url)
        elif protocol == "websocket":
            return await self._connect_websocket(url)
        elif protocol == "http_sse":
            return await self._connect_http_sse(url)

    async def _connect_webrtc(self, url):
        """WebRTC connection"""
        from aiortc import RTCPeerConnection, RTCSessionDescription
        import aiohttp

        pc = RTCPeerConnection()
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{url}/webrtc/offer",
                json={"sdp": offer.sdp, "type": offer.type},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                answer = await resp.json()

        await pc.setRemoteDescription(
            RTCSessionDescription(**answer)
        )
        return pc

    async def _connect_websocket(self, url):
        """WebSocket connection"""
        import websockets
        ws_url = url.replace("http", "ws") + "/ws/audio"
        ws = await websockets.connect(
            ws_url,
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        )
        return ws

    async def _connect_http_sse(self, url):
        """HTTP SSE connection"""
        import aiohttp
        session = aiohttp.ClientSession()
        # Connect to SSE endpoint
        sse_response = await session.get(
            f"{url}/sse/audio",
            timeout=aiohttp.ClientTimeout(total=None),
        )
        return {"session": session, "response": sse_response}
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: "Wait for Full Text Before TTS"

```
[Wrong] Start TTS only after the LLM output is fully complete

  LLM Generation (3s) ---------> TTS Processing (2s) ----> Playback
  User wait time: 5 seconds

[Correct] Start streaming TTS on a sentence-by-sentence basis

  LLM "Hello." -> TTS -> Playback starts (0.3s)
  LLM "The weather today..." -> TTS -> Playback (in parallel)
  Perceived user delay: 0.3 seconds

  Key points:
  - Split text at punctuation marks and send to TTS
  - Process TTS for the next sentence while the previous one is playing
  - Prevent interruptions with audio buffering
```

### Anti-Pattern 2: "Always Streaming Without VAD"

```
[Wrong] Constantly sending all audio including silence to the STT engine

Problems:
- Wasted API costs (silence intervals are also billed)
- STT engine misrecognizes noise from silence
- Wasted network bandwidth

[Correct] Process only speech segments using VAD (Voice Activity Detection)
  1. Run VAD on the client side (WebRTC built-in VAD or Silero VAD)
  2. Send only detected speech segments to the server
  3. Mark as "end of utterance" when silence persists for a certain duration
```

### Anti-Pattern 3: "No Reconnection Logic"

```
[Wrong] Implementation that does not account for WebSocket/WebRTC disconnections

  ws = new WebSocket(url);
  ws.onopen = () => { /* connected */ };
  // No handling in onclose/onerror -> permanently disconnected once dropped

Problems:
- Disconnections occur frequently on mobile networks
- Disconnection is guaranteed during network switching (WiFi -> 4G)
- User must manually reload

[Correct] Implement automatic reconnection with exponential backoff
  1. Start retry scheduler on onclose/onerror
  2. Reconnect with exponential backoff (1s, 2s, 4s, 8s...)
  3. Add jitter to distribute server load
  4. Set maximum retry count
  5. Restore session after reconnection (STT context, etc.)
```

### Anti-Pattern 4: "Improper AudioContext Management"

```javascript
// BAD: Creating AudioContext without user interaction
const ctx = new AudioContext(); // Gets suspended due to autoplay policy

// BAD: Creating a new AudioContext every time
function playAudio(data) {
  const ctx = new AudioContext(); // Resource leak
  // ...
}

// GOOD: Resume on user interaction, manage as singleton
class AudioManager {
  constructor() {
    this.ctx = null;
  }

  async init() {
    this.ctx = new AudioContext({ sampleRate: 16000 });
    if (this.ctx.state === "suspended") {
      // Resume on user interaction (button click, etc.)
      await this.ctx.resume();
    }
  }

  getContext() {
    return this.ctx;
  }
}
```

---

## 11. FAQ

### Q1: Should I use WebRTC or WebSocket?

**A:** Choose based on your use case.

- **WebRTC**: When low latency is the top priority for voice calls. Can achieve sub-100ms latency with P2P. However, server-side audio processing (STT, etc.) requires SFU/MCU patterns
- **WebSocket**: For sending and receiving text data, and as a control channel. Can also transmit audio binary, but latency is higher than WebRTC since it uses TCP rather than UDP
- **Hybrid**: A practical architecture that sends audio data via WebRTC and transcription results/metadata via WebSocket

### Q2: How can I improve real-time STT accuracy?

**A:** The following approaches are effective.

1. **Domain-specific vocabulary**: Boost specialized terms (e.g., Google Cloud STT's `speech_contexts`)
2. **Noise removal preprocessing**: Use RNNoise or WebRTC's built-in echo canceller and noise suppression
3. **Chunk size optimization**: Too short leads to insufficient context, too long increases latency. 100-300ms is typical
4. **Endpoint detection**: Adjust end-of-speech detection threshold (prevent premature finalization)

### Q3: What is the scaling strategy when concurrent connections increase?

**A:** Apply the following strategies progressively.

1. **SFU (Selective Forwarding Unit)**: Media server relays streams. Janus and mediasoup are representative implementations
2. **Horizontal scaling of STT/TTS**: Autoscale STT/TTS workers on Kubernetes
3. **Regional distribution**: Deploy media servers in regions close to users
4. **GPU resource management**: Pool and share GPU workers for TTS/STT for efficiency

### Q4: Can Whisper be used in real time?

**A:** Whisper is a batch processing model, so it is not suited for real-time use as-is. However, pseudo-real-time operation is possible with the following techniques.

1. **Sliding window approach**: Continuously process 2-3 second chunks with overlap. With faster-whisper, GPU processing is possible in under 0.5 seconds
2. **VAD preprocessing**: Skip silence intervals and send only speech segments to Whisper to reduce processing volume
3. **Speculative interim results**: Run recognition each time the buffer fills, and determine interim/final based on diff from the previous result
4. **whisper-streaming**: The OSS library `whisper_streaming` implements the above strategies

### Q5: What are the tips for implementing real-time audio in mobile apps?

**A:** Here is a summary of mobile-specific challenges and solutions.

1. **Battery consumption**: Minimize processing during silence with VAD. When backgrounded, maintain WebSocket connection but stop audio processing
2. **Network instability**: Exponential backoff reconnection, enable Opus FEC (Forward Error Correction), adjust buffering strategy
3. **Audio I/O**: On iOS, proper AVAudioSession category settings (`.playAndRecord`) are required. On Android, use AudioRecord + AudioTrack
4. **Echo cancellation**: Since the speaker and microphone are close together, AEC (Acoustic Echo Cancellation) is critical. Leverage WebRTC's echo canceller
5. **Power-saving mode**: Understand OS constraints regarding processing during background transitions and audio continuation when the screen is locked

### Q6: How can I achieve a voice chatbot response latency under 1 second?

**A:** Here is a specific configuration to achieve end-to-end latency under 1 second.

1. **STT**: Under 200ms with faster-whisper (GPU). Quick end-of-speech detection with VAD
2. **LLM**: Use fast models like GPT-4o-mini or Claude 3.5 Haiku with streaming. Time to first token: 100-200ms
3. **TTS**: Edge TTS or ElevenLabs Turbo v2 with TTFB of 100-200ms. Start playing the audio for the first sentence immediately
4. **Pipeline**: Connect each stage via streaming. STT finalized -> Start LLM -> Start TTS at first punctuation -> Play immediately
5. **Pre-warming**: Complete model loading, WebSocket connection, and TTS engine initialization in advance

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping straight to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 12. Summary

| Component | Technology | Recommended Tools | Latency Target |
|-----------|-----------|-------------------|----------------|
| Audio Communication | WebRTC | aiortc, mediasoup | < 100ms |
| Signaling | WebSocket | FastAPI, Socket.IO | < 50ms |
| Streaming STT | gRPC Streaming | Google STT, Whisper Streaming | < 200ms |
| Streaming TTS | Chunk Synthesis | Edge TTS, ElevenLabs | < 300ms |
| VAD | RNN/Rule-based | Silero VAD, WebRTC VAD | < 10ms |
| Codec | Opus | WebRTC built-in | 5ms |
| Media Server | SFU | mediasoup, Janus | < 50ms |
| Quality Monitoring | getStats / Custom | Prometheus + Grafana | Real-time |

---

## Recommended Next Reads

- [Podcast Tools](../02-voice/02-podcast-tools.md) — Transcription, summarization, and editing of recorded audio
- Fundamentals of Speech Synthesis — Choosing and using TTS engines
- WebRTC Fundamentals — Details of the WebRTC protocol

---

## References

1. Loreto, S. & Romano, S.P. (2014). "Real-Time Communication with WebRTC." *O'Reilly Media*. https://www.oreilly.com/library/view/real-time-communication-with/9781449371location/
2. Google Cloud. (2024). "Streaming Speech-to-Text." *Google Cloud Documentation*. https://cloud.google.com/speech-to-text/docs/streaming-recognize
3. Valin, J.-M. et al. (2012). "Definition of the Opus Audio Codec." *RFC 6716, IETF*. https://www.rfc-editor.org/rfc/rfc6716
4. mediasoup Documentation. (2024). "mediasoup — Cutting Edge WebRTC Video Conferencing." https://mediasoup.org/documentation/
5. Silero Team. (2021). "Silero VAD: pre-trained enterprise-grade Voice Activity Detector." https://github.com/snakers4/silero-vad
6. ElevenLabs. (2024). "WebSocket Streaming API Documentation." https://docs.elevenlabs.io/api-reference/websockets
7. Microsoft. (2024). "Azure Speech SDK Streaming Recognition." https://learn.microsoft.com/azure/cognitive-services/speech-service/how-to-recognize-speech
