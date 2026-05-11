# Voice Assistants — Custom Wake Words, Conversational AI

> Explains techniques for building custom voice assistants, including wake word detection, dialog management, and voice interface design

## What You Will Learn

1. Overall architecture and pipeline design for voice assistants
2. Implementation of wake word detection, dialog management, and multi-turn conversations
3. Building intelligent voice dialog systems with LLM integration


## Prerequisites

Understanding the following will help you get the most out of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Voice Cloning — RVC, So-VITS, Ethical Considerations](./00-voice-cloning.md)

---

## 1. Voice Assistant Architecture

### 1.1 Overall Pipeline

```
Voice Assistant Pipeline
==================================================

          Always Listening
               |
               v
+----------------------+
|  Wake Word Detection  |  "Hey, Assistant"
|                       |  Porcupine / OpenWakeWord
+-----------+----------+
            | Detected!
            v
+----------------------+
|  VAD + Recording      |  Detect and record speech segments
|  (Voice Activity Det.)|  webrtcvad / Silero VAD
+-----------+----------+
            | End of utterance
            v
+----------------------+
|  STT (Speech-to-Text) |  Whisper / Google STT
|                       |  "What's the weather tomorrow?"
+-----------+----------+
            | Text
            v
+----------------------+
|  NLU / LLM            |  Intent understanding + response generation
|  (Natural Language     |  GPT-4o / Claude
|   Understanding)       |
+-----------+----------+
            | Response text
            v
+----------------------+
|  TTS (Text-to-Speech) |  OpenAI TTS / VITS
|                       |  "Tomorrow will be sunny"
+-----------+----------+
            | Audio
            v
       Speaker Output
==================================================
```

### 1.2 Wake Word Detection

```python
# Wake word detection using Porcupine (Picovoice)

import pvporcupine
import pyaudio
import struct

class WakeWordDetector:
    """Wake word detector"""

    def __init__(self, access_key: str, keyword: str = "computer"):
        """
        keyword options:
        - Built-in: "alexa", "computer", "jarvis", "hey google", etc.
        - Custom: .ppn files created with Picovoice Console
        """
        self.porcupine = pvporcupine.create(
            access_key=access_key,
            keywords=[keyword],
            sensitivities=[0.7],  # Sensitivity (0-1, higher = more false positives)
        )

        self.audio = pyaudio.PyAudio()
        self.stream = self.audio.open(
            rate=self.porcupine.sample_rate,
            channels=1,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=self.porcupine.frame_length,
        )

    def listen(self, callback):
        """Wait for wake word"""
        print("Waiting for wake word...")
        try:
            while True:
                pcm = self.stream.read(self.porcupine.frame_length)
                pcm = struct.unpack_from(
                    "h" * self.porcupine.frame_length, pcm
                )

                keyword_index = self.porcupine.process(pcm)
                if keyword_index >= 0:
                    print("Wake word detected!")
                    callback()

        except KeyboardInterrupt:
            self.cleanup()

    def cleanup(self):
        self.stream.stop_stream()
        self.stream.close()
        self.audio.terminate()
        self.porcupine.delete()
```

### 1.3 OpenWakeWord (OSS Version)

```python
# OpenWakeWord: Open-source wake word detection

from openwakeword import Model
import pyaudio
import numpy as np

class OpenWakeWordDetector:
    """OSS wake word detection (OpenWakeWord)"""

    def __init__(self, model_path: str = None):
        self.model = Model(
            wakeword_models=[model_path] if model_path else None,
            inference_framework="onnx",  # onnx or tflite
        )

        self.audio = pyaudio.PyAudio()
        self.chunk_size = 1280  # 80ms @ 16kHz

    def listen_continuous(self, on_wake):
        """Continuous listening"""
        stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=16000,
            input=True,
            frames_per_buffer=self.chunk_size,
        )

        print("Listening started...")
        while True:
            audio_data = stream.read(self.chunk_size)
            audio_array = np.frombuffer(audio_data, dtype=np.int16)

            # Inference
            prediction = self.model.predict(audio_array)

            for mdl_name, score in prediction.items():
                if score > 0.5:  # Threshold
                    print(f"Detected: {mdl_name} (score: {score:.3f})")
                    on_wake()
```

### 1.4 VAD (Voice Activity Detection) Detailed Implementation

```python
import numpy as np
import pyaudio
from typing import Optional, Callable

class SileroVADDetector:
    """
    High-accuracy voice activity detection using Silero VAD

    Silero VAD is a lightweight PyTorch-based VAD model that provides
    higher accuracy than webrtcvad with language-independent speech detection.
    """

    def __init__(self, threshold: float = 0.5, sr: int = 16000):
        import torch
        self.model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
        )
        self.get_speech_timestamps = utils[0]
        self.threshold = threshold
        self.sr = sr
        self.window_size = 512  # 32ms @ 16kHz

    def detect_speech_regions(self, audio: np.ndarray) -> list:
        """Detect speech regions"""
        import torch
        audio_tensor = torch.tensor(audio, dtype=torch.float32)
        speech_timestamps = self.get_speech_timestamps(
            audio_tensor,
            self.model,
            threshold=self.threshold,
            sampling_rate=self.sr,
        )
        return speech_timestamps

    def is_speech(self, frame: np.ndarray) -> bool:
        """Frame-level speech detection"""
        import torch
        frame_tensor = torch.tensor(frame, dtype=torch.float32)
        confidence = self.model(frame_tensor, self.sr).item()
        return confidence > self.threshold


class AdaptiveVAD:
    """
    Environment-adaptive VAD

    Dynamically adapts to background noise levels to achieve
    stable speech detection across various environments.
    """

    def __init__(self, sr: int = 16000, frame_ms: int = 30):
        self.sr = sr
        self.frame_size = int(sr * frame_ms / 1000)
        self.noise_floor = 0.0
        self.noise_alpha = 0.95  # Noise floor tracking coefficient
        self.speech_threshold_db = 15  # Threshold above noise floor
        self.hangover_frames = 10  # Frames to hold after end of speech
        self.hangover_counter = 0
        self.is_speaking = False

    def update_noise_floor(self, frame: np.ndarray):
        """Dynamically update noise floor"""
        rms = np.sqrt(np.mean(frame ** 2))
        rms_db = 20 * np.log10(rms + 1e-10)

        if not self.is_speaking:
            # Update noise floor only during non-speech segments
            self.noise_floor = (
                self.noise_alpha * self.noise_floor +
                (1 - self.noise_alpha) * rms_db
            )

    def process_frame(self, frame: np.ndarray) -> bool:
        """Process a frame and determine speech presence"""
        rms = np.sqrt(np.mean(frame ** 2))
        rms_db = 20 * np.log10(rms + 1e-10)

        self.update_noise_floor(frame)

        # Dynamic threshold
        threshold = self.noise_floor + self.speech_threshold_db

        if rms_db > threshold:
            self.is_speaking = True
            self.hangover_counter = self.hangover_frames
        elif self.hangover_counter > 0:
            self.hangover_counter -= 1
        else:
            self.is_speaking = False

        return self.is_speaking


class SmartRecorder:
    """
    VAD-integrated smart recorder

    After wake word detection, automatically detects and records
    the user's speech using VAD for segment detection.
    """

    def __init__(self, sr: int = 16000, max_duration: float = 15.0,
                 silence_timeout: float = 1.5, min_duration: float = 0.5):
        """
        Parameters:
            sr: Sample rate
            max_duration: Maximum recording duration (seconds)
            silence_timeout: Stop recording after this duration of silence (seconds)
            min_duration: Minimum recording duration (seconds)
        """
        self.sr = sr
        self.max_duration = max_duration
        self.silence_timeout = silence_timeout
        self.min_duration = min_duration
        self.vad = AdaptiveVAD(sr=sr)

    def record(self) -> Optional[np.ndarray]:
        """Execute VAD-enabled recording"""
        pa = pyaudio.PyAudio()
        frame_size = self.vad.frame_size

        stream = pa.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=self.sr,
            input=True,
            frames_per_buffer=frame_size,
        )

        frames = []
        silent_frames = 0
        max_silent = int(self.silence_timeout * self.sr / frame_size)
        max_frames = int(self.max_duration * self.sr / frame_size)
        min_frames = int(self.min_duration * self.sr / frame_size)
        speech_started = False

        print("Recording... (please speak)")

        for _ in range(max_frames):
            data = stream.read(frame_size, exception_on_overflow=False)
            frame = np.frombuffer(data, dtype=np.float32)
            frames.append(frame)

            is_speech = self.vad.process_frame(frame)

            if is_speech:
                speech_started = True
                silent_frames = 0
            elif speech_started:
                silent_frames += 1

            # End after sufficient speech followed by sustained silence
            if speech_started and silent_frames > max_silent and len(frames) > min_frames:
                break

        stream.stop_stream()
        stream.close()
        pa.terminate()

        if not speech_started or len(frames) < min_frames:
            print("No speech detected")
            return None

        audio = np.concatenate(frames)
        print(f"Recording complete: {len(audio) / self.sr:.1f} seconds")
        return audio
```

---

## 2. Dialog Management

### 2.1 LLM-Integrated Dialog Engine

```python
from openai import OpenAI
import json

class VoiceAssistantEngine:
    """LLM-integrated voice assistant engine"""

    def __init__(self):
        self.client = OpenAI()
        self.conversation_history = []
        self.system_prompt = """You are a voice assistant.
Follow these rules:
- Keep answers concise (they will be spoken aloud, so not too long)
- Answer in 1-3 sentences
- Avoid technical jargon
- Use a friendly tone"""

        # Tool definitions (Function Calling)
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the weather for a specified location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string", "description": "Location name"},
                            "date": {"type": "string", "description": "Date (YYYY-MM-DD)"},
                        },
                        "required": ["location"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "set_timer",
                    "description": "Set a timer",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "minutes": {"type": "integer", "description": "Number of minutes"},
                            "label": {"type": "string", "description": "Timer label"},
                        },
                        "required": ["minutes"],
                    },
                },
            },
        ]

    def process_input(self, user_text: str) -> str:
        """Process user input and generate a response"""
        self.conversation_history.append({
            "role": "user",
            "content": user_text,
        })

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": self.system_prompt},
                *self.conversation_history[-10:],  # Last 10 turns
            ],
            tools=self.tools,
            max_tokens=200,  # Short for voice output
        )

        message = response.choices[0].message

        # Handle Function Calls
        if message.tool_calls:
            return self._handle_tool_calls(message)

        assistant_text = message.content
        self.conversation_history.append({
            "role": "assistant",
            "content": assistant_text,
        })

        return assistant_text

    def _handle_tool_calls(self, message):
        """Handle tool calls"""
        self.conversation_history.append(message)

        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)

            result = self._execute_function(func_name, args)

            self.conversation_history.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

        # Generate response based on tool results
        followup = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": self.system_prompt},
                *self.conversation_history[-10:],
            ],
        )

        return followup.choices[0].message.content

    def _execute_function(self, name, args):
        """Execute a function"""
        if name == "get_weather":
            return {"weather": "sunny", "temperature": 22, "location": args["location"]}
        elif name == "set_timer":
            return {"status": "set", "minutes": args["minutes"]}
        return {"error": "unknown function"}
```

### 2.2 Fully Integrated Pipeline

```python
import threading
import queue

class VoiceAssistant:
    """Fully integrated voice assistant"""

    def __init__(self):
        self.wake_detector = WakeWordDetector(access_key="...", keyword="computer")
        self.stt = WhisperSTT(model="base")
        self.engine = VoiceAssistantEngine()
        self.tts = OpenAITTS(voice="nova")
        self.is_listening = False
        self.audio_queue = queue.Queue()

    def run(self):
        """Main loop"""
        print("Voice assistant started")
        self.wake_detector.listen(callback=self._on_wake)

    def _on_wake(self):
        """Handle wake word detection"""
        # Play acknowledgment sound ("ding")
        play_acknowledgment_sound()

        # Record audio (auto-stop via VAD)
        audio = self._record_with_vad(max_duration=10)

        # STT
        user_text = self.stt.transcribe(audio)
        print(f"User: {user_text}")

        if not user_text.strip():
            return

        # LLM processing
        response_text = self.engine.process_input(user_text)
        print(f"Assistant: {response_text}")

        # TTS + playback
        audio_response = self.tts.synthesize(response_text)
        play_audio(audio_response)

    def _record_with_vad(self, max_duration=10, silence_threshold=1.5):
        """Record with VAD (auto-stop on sustained silence)"""
        import webrtcvad

        vad = webrtcvad.Vad(2)  # 0-3 (higher = stricter)
        frames = []
        silent_frames = 0
        max_silent = int(silence_threshold / 0.03)  # 30ms frames

        # Recording stream
        stream = open_audio_stream(sample_rate=16000, frame_duration_ms=30)

        for _ in range(int(max_duration / 0.03)):
            frame = stream.read()
            frames.append(frame)

            is_speech = vad.is_speech(frame, 16000)
            if not is_speech:
                silent_frames += 1
            else:
                silent_frames = 0

            if silent_frames > max_silent and len(frames) > 30:
                break

        return b"".join(frames)
```

### 2.3 Advanced Dialog Management: Context Management and Slot Filling

```python
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
import json
from datetime import datetime

class DialogState(Enum):
    """Dialog state"""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    RESPONDING = "responding"
    CONFIRMING = "confirming"
    ERROR = "error"

@dataclass
class ConversationContext:
    """Conversation context management"""
    session_id: str
    started_at: datetime = field(default_factory=datetime.now)
    history: List[Dict] = field(default_factory=list)
    user_profile: Dict = field(default_factory=dict)
    current_intent: Optional[str] = None
    slots: Dict[str, Any] = field(default_factory=dict)
    state: DialogState = DialogState.IDLE
    turn_count: int = 0

    def add_turn(self, role: str, content: str):
        """Add a turn"""
        self.history.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        })
        if role == "user":
            self.turn_count += 1

    def get_recent_history(self, n: int = 10) -> List[Dict]:
        """Get the last N history entries"""
        return self.history[-n:]

    def summarize(self) -> str:
        """Summarize a long conversation"""
        if len(self.history) <= 10:
            return ""
        # Compress old history into a summary text
        old_turns = self.history[:-10]
        topics = set()
        for turn in old_turns:
            if turn["role"] == "user":
                topics.add(turn["content"][:50])
        return f"Topics discussed so far: {', '.join(list(topics)[:5])}"


class IntentSlotManager:
    """Intent and slot management"""

    INTENT_SCHEMAS = {
        "set_alarm": {
            "required_slots": ["time"],
            "optional_slots": ["label", "repeat"],
            "confirm_before_execute": True,
            "prompts": {
                "time": "What time should I set the alarm for?",
                "label": "Would you like to add a label to the alarm?",
            },
        },
        "play_music": {
            "required_slots": ["query"],
            "optional_slots": ["source", "shuffle"],
            "confirm_before_execute": False,
            "prompts": {
                "query": "What would you like to play?",
            },
        },
        "get_weather": {
            "required_slots": ["location"],
            "optional_slots": ["date", "detail_level"],
            "confirm_before_execute": False,
            "prompts": {
                "location": "Which location would you like the weather for?",
            },
        },
        "send_message": {
            "required_slots": ["recipient", "message"],
            "optional_slots": ["app"],
            "confirm_before_execute": True,
            "prompts": {
                "recipient": "Who would you like to send the message to?",
                "message": "What is the message content?",
            },
        },
        "control_device": {
            "required_slots": ["device", "action"],
            "optional_slots": ["value"],
            "confirm_before_execute": False,
            "prompts": {
                "device": "Which device would you like to control?",
                "action": "What would you like to do? (on/off/adjust)",
            },
        },
    }

    def check_slots(self, intent: str, filled_slots: dict) -> Optional[str]:
        """
        Check for unfilled slots and return the next question

        Returns:
            None: All slots are filled
            str: The next question to ask
        """
        schema = self.INTENT_SCHEMAS.get(intent)
        if not schema:
            return None

        for slot in schema["required_slots"]:
            if slot not in filled_slots or not filled_slots[slot]:
                return schema["prompts"].get(slot, f"Please provide the {slot}")

        return None

    def needs_confirmation(self, intent: str) -> bool:
        """Check if confirmation is needed before execution"""
        schema = self.INTENT_SCHEMAS.get(intent, {})
        return schema.get("confirm_before_execute", False)

    def generate_confirmation(self, intent: str, slots: dict) -> str:
        """Generate a confirmation message"""
        if intent == "set_alarm":
            time = slots.get("time", "unknown")
            label = slots.get("label", "")
            msg = f"I'll set an alarm for {time}"
            if label:
                msg += f" (label: {label})"
            return msg + ". Is that correct?"
        elif intent == "send_message":
            recipient = slots.get("recipient", "unknown")
            message = slots.get("message", "unknown")
            return f"I'll send \"{message}\" to {recipient}. Is that correct?"
        return "Shall I proceed?"


class AdvancedDialogManager:
    """Advanced dialog management system"""

    def __init__(self):
        self.client = OpenAI()
        self.slot_manager = IntentSlotManager()
        self.contexts: Dict[str, ConversationContext] = {}

    def get_or_create_context(self, session_id: str) -> ConversationContext:
        """Get or create a session context"""
        if session_id not in self.contexts:
            self.contexts[session_id] = ConversationContext(
                session_id=session_id
            )
        return self.contexts[session_id]

    def process(self, session_id: str, user_input: str) -> str:
        """Main dialog processing loop"""
        ctx = self.get_or_create_context(session_id)
        ctx.add_turn("user", user_input)
        ctx.state = DialogState.PROCESSING

        # Handle confirmation-pending state
        if ctx.state == DialogState.CONFIRMING:
            return self._handle_confirmation(ctx, user_input)

        # Extract intent and slots using LLM
        intent_result = self._extract_intent(ctx, user_input)

        if intent_result.get("intent"):
            ctx.current_intent = intent_result["intent"]
            ctx.slots.update(intent_result.get("slots", {}))

            # Check slot fulfillment
            next_question = self.slot_manager.check_slots(
                ctx.current_intent, ctx.slots
            )

            if next_question:
                ctx.add_turn("assistant", next_question)
                return next_question

            # If confirmation is required
            if self.slot_manager.needs_confirmation(ctx.current_intent):
                confirmation = self.slot_manager.generate_confirmation(
                    ctx.current_intent, ctx.slots
                )
                ctx.state = DialogState.CONFIRMING
                ctx.add_turn("assistant", confirmation)
                return confirmation

            # Execute
            result = self._execute_intent(ctx)
            ctx.add_turn("assistant", result)
            ctx.current_intent = None
            ctx.slots.clear()
            return result

        # Normal dialog response
        response = self._generate_response(ctx, user_input)
        ctx.add_turn("assistant", response)
        return response

    def _extract_intent(self, ctx: ConversationContext,
                        user_input: str) -> dict:
        """Extract intent and slots using LLM"""
        extraction_prompt = f"""
Extract the intent and slots from the user's input.
Available intents: {list(IntentSlotManager.INTENT_SCHEMAS.keys())}

User input: {user_input}

Respond in JSON format:
{{"intent": "intent_name or null", "slots": {{"slot_name": "value"}}}}
"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": extraction_prompt}],
            response_format={"type": "json_object"},
            max_tokens=200,
        )

        try:
            return json.loads(response.choices[0].message.content)
        except json.JSONDecodeError:
            return {"intent": None, "slots": {}}

    def _handle_confirmation(self, ctx: ConversationContext,
                             user_input: str) -> str:
        """Handle confirmation responses"""
        affirmative = any(w in user_input for w in ["yes", "yeah", "OK", "please", "sure"])
        negative = any(w in user_input for w in ["no", "nope", "cancel", "stop", "nevermind"])

        if affirmative:
            result = self._execute_intent(ctx)
            ctx.current_intent = None
            ctx.slots.clear()
            ctx.state = DialogState.IDLE
            return result
        elif negative:
            ctx.current_intent = None
            ctx.slots.clear()
            ctx.state = DialogState.IDLE
            return "Cancelled."
        else:
            return "Please answer yes or no."

    def _execute_intent(self, ctx: ConversationContext) -> str:
        """Execute the intent"""
        intent = ctx.current_intent
        slots = ctx.slots

        if intent == "set_alarm":
            return f"Alarm set for {slots.get('time', '')}."
        elif intent == "get_weather":
            return f"The weather in {slots.get('location', '')} is sunny, 22 degrees."
        elif intent == "play_music":
            return f"Playing \"{slots.get('query', '')}\"."
        elif intent == "send_message":
            return f"Message sent to {slots.get('recipient', '')}."
        elif intent == "control_device":
            return f"{slots.get('device', '')} has been {slots.get('action', '')}."

        return "Processing complete."

    def _generate_response(self, ctx: ConversationContext,
                           user_input: str) -> str:
        """Generate a normal dialog response"""
        messages = [
            {"role": "system", "content": "Answer concisely in 1-3 sentences."},
        ]

        # Add summary if available
        summary = ctx.summarize()
        if summary:
            messages.append({"role": "system", "content": summary})

        # Recent history
        for turn in ctx.get_recent_history(8):
            messages.append({
                "role": turn["role"],
                "content": turn["content"],
            })

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=200,
        )

        return response.choices[0].message.content
```

---

## 3. Multimodal Dialog

### 3.1 OpenAI Realtime API

```
OpenAI Realtime API Architecture
==================================================

Client                       Server
    |                           |
    |  WebSocket connection     |
    | ------------------------->|
    |                           |
    |  Send audio stream        |
    |  (PCM 24kHz 16bit)        |
    | ------------------------->|
    |                           |
    |         GPT-4o            |
    |     Audio -> Understand   |
    |         -> Generate       |
    |                           |
    |  Receive audio stream     |
    |<------------------------- |
    |  (PCM 24kHz 16bit)        |
    |                           |
    |  Function Call            |
    |<------------------------- |
    |  Send result              |
    | ------------------------->|
    |                           |
    |  Continued audio stream   |
    |<------------------------- |

Features:
- STT/LLM/TTS integrated in a single model
- Sub-300ms latency
- Interruption support
- Emotion and tone understanding
==================================================
```

### 3.2 Realtime API Implementation

```python
import asyncio
import websockets
import json
import base64
import numpy as np

class RealtimeVoiceAssistant:
    """
    Real-time voice assistant using OpenAI Realtime API

    Unlike traditional pipelines (STT -> LLM -> TTS), this uses an
    integrated model that directly understands voice input and responds
    with voice output, significantly reducing latency.
    """

    def __init__(self, api_key: str, model: str = "gpt-4o-realtime-preview"):
        self.api_key = api_key
        self.model = model
        self.ws = None
        self.tools = []
        self.on_audio_callback = None

    async def connect(self):
        """Establish WebSocket connection"""
        url = f"wss://api.openai.com/v1/realtime?model={self.model}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1",
        }
        self.ws = await websockets.connect(url, extra_headers=headers)

        # Session configuration
        await self._send({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": "You are a voice assistant. Answer concisely.",
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1",
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                },
                "tools": self.tools,
            },
        })

    async def send_audio(self, audio_chunk: bytes):
        """Send an audio chunk"""
        encoded = base64.b64encode(audio_chunk).decode()
        await self._send({
            "type": "input_audio_buffer.append",
            "audio": encoded,
        })

    async def listen_responses(self):
        """Response listening loop"""
        async for message in self.ws:
            event = json.loads(message)
            event_type = event.get("type", "")

            if event_type == "response.audio.delta":
                # Received audio response chunk
                audio_data = base64.b64decode(event["delta"])
                if self.on_audio_callback:
                    self.on_audio_callback(audio_data)

            elif event_type == "response.audio_transcript.delta":
                # Text transcript
                print(event.get("delta", ""), end="", flush=True)

            elif event_type == "input_audio_buffer.speech_started":
                # User started speaking (interruption detected)
                print("\n[User speech started]")

            elif event_type == "input_audio_buffer.speech_stopped":
                print("\n[User speech ended]")

            elif event_type == "response.function_call_arguments.done":
                # Handle Function Call
                await self._handle_function_call(event)

            elif event_type == "error":
                print(f"Error: {event.get('error', {}).get('message', '')}")

    async def _send(self, data: dict):
        """Send a message"""
        await self.ws.send(json.dumps(data))

    async def _handle_function_call(self, event):
        """Handle a Function Call"""
        call_id = event.get("call_id", "")
        name = event.get("name", "")
        args = json.loads(event.get("arguments", "{}"))

        # Execute function
        result = self._execute_function(name, args)

        # Send result back
        await self._send({
            "type": "conversation.item.create",
            "item": {
                "type": "function_call_output",
                "call_id": call_id,
                "output": json.dumps(result, ensure_ascii=False),
            },
        })

        # Trigger response generation
        await self._send({"type": "response.create"})

    def _execute_function(self, name, args):
        """Execute function (placeholder)"""
        return {"status": "ok", "result": f"Executed {name}"}

    def add_tool(self, name: str, description: str, parameters: dict):
        """Add a tool (function)"""
        self.tools.append({
            "type": "function",
            "name": name,
            "description": description,
            "parameters": parameters,
        })


async def main():
    """Main process for Realtime API assistant"""
    assistant = RealtimeVoiceAssistant(api_key="sk-...")

    # Register tools
    assistant.add_tool(
        name="get_weather",
        description="Get the weather",
        parameters={
            "type": "object",
            "properties": {
                "location": {"type": "string"},
            },
            "required": ["location"],
        },
    )

    # Audio output callback
    def play_audio(data):
        # Play with PyAudio
        pass
    assistant.on_audio_callback = play_audio

    # Connect
    await assistant.connect()

    # Run microphone input and response listening tasks concurrently
    await asyncio.gather(
        capture_microphone(assistant),
        assistant.listen_responses(),
    )
```

### 3.3 Edge Device Voice Assistant

```python
class EdgeVoiceAssistant:
    """
    Voice assistant for edge devices (Raspberry Pi, etc.)

    Runs wake word detection and VAD locally, with STT/LLM/TTS
    selectable between cloud and local models.
    Privacy-focused design.
    """

    def __init__(self, config: dict = None):
        self.config = config or self._default_config()

        # Wake word (always local)
        self.wake_detector = OpenWakeWordDetector()

        # STT (local or cloud)
        if self.config["stt_local"]:
            self.stt = self._init_local_stt()
        else:
            self.stt = self._init_cloud_stt()

        # LLM
        if self.config["llm_local"]:
            self.llm = self._init_local_llm()
        else:
            self.llm = self._init_cloud_llm()

        # TTS
        if self.config["tts_local"]:
            self.tts = self._init_local_tts()
        else:
            self.tts = self._init_cloud_tts()

        self.recorder = SmartRecorder(sr=16000)

    def _default_config(self):
        return {
            "stt_local": True,      # Run faster-whisper locally
            "llm_local": False,     # Cloud recommended for LLM
            "tts_local": True,      # Run Piper TTS locally
            "stt_model": "base",    # Whisper model size
            "wake_word": "hey_jarvis",
            "language": "ja",
            "max_recording_sec": 10,
        }

    def _init_local_stt(self):
        """Local STT (faster-whisper)"""
        from faster_whisper import WhisperModel
        return WhisperModel(
            self.config["stt_model"],
            device="cpu",
            compute_type="int8",  # Lightweight inference
        )

    def _init_cloud_stt(self):
        """Cloud STT"""
        return None  # OpenAI Whisper API, etc.

    def _init_local_llm(self):
        """Local LLM (llama.cpp, etc.)"""
        return None  # Placeholder

    def _init_cloud_llm(self):
        """Cloud LLM"""
        from openai import OpenAI
        return OpenAI()

    def _init_local_tts(self):
        """Local TTS (Piper)"""
        return None  # Piper TTS

    def _init_cloud_tts(self):
        """Cloud TTS"""
        return None  # OpenAI TTS

    def run(self):
        """Main loop"""
        print(f"Edge voice assistant started")
        print(f"STT: {'local' if self.config['stt_local'] else 'cloud'}")
        print(f"LLM: {'local' if self.config['llm_local'] else 'cloud'}")
        print(f"TTS: {'local' if self.config['tts_local'] else 'cloud'}")

        self.wake_detector.listen_continuous(on_wake=self._on_wake)

    def _on_wake(self):
        """Handle wake word detection"""
        import time

        # Turn on LED (if GPIO available)
        self._set_status_led("listening")

        # Record
        audio = self.recorder.record()
        if audio is None:
            self._set_status_led("idle")
            return

        # STT
        self._set_status_led("processing")
        start = time.time()

        if self.config["stt_local"]:
            segments, info = self.stt.transcribe(
                audio, language="ja", beam_size=3
            )
            user_text = " ".join(s.text for s in segments)
        else:
            user_text = self._cloud_transcribe(audio)

        stt_time = time.time() - start
        print(f"STT ({stt_time:.2f}s): {user_text}")

        if not user_text.strip():
            self._set_status_led("idle")
            return

        # LLM
        start = time.time()
        response = self._generate_response(user_text)
        llm_time = time.time() - start
        print(f"LLM ({llm_time:.2f}s): {response}")

        # TTS
        self._set_status_led("speaking")
        start = time.time()
        self._speak(response)
        tts_time = time.time() - start
        print(f"TTS ({tts_time:.2f}s)")

        total = stt_time + llm_time + tts_time
        print(f"Total latency: {total:.2f}s")

        self._set_status_led("idle")

    def _generate_response(self, text: str) -> str:
        """Generate response"""
        if self.config["llm_local"]:
            return "Local LLM response"  # Placeholder
        else:
            response = self.llm.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Answer concisely in 1-2 sentences."},
                    {"role": "user", "content": text},
                ],
                max_tokens=100,
            )
            return response.choices[0].message.content

    def _speak(self, text: str):
        """Play text as speech"""
        pass  # TTS processing

    def _set_status_led(self, status: str):
        """Control status LED (Raspberry Pi GPIO)"""
        led_colors = {
            "idle": (0, 0, 0),       # Off
            "listening": (0, 0, 255),  # Blue
            "processing": (255, 255, 0), # Yellow
            "speaking": (0, 255, 0),   # Green
            "error": (255, 0, 0),      # Red
        }
        # GPIO control placeholder
        color = led_colors.get(status, (0, 0, 0))

    def _cloud_transcribe(self, audio: np.ndarray) -> str:
        """Cloud STT"""
        return ""  # Placeholder
```

---

## 4. Comparison Tables

### 4.1 Voice Assistant Architecture Approaches

| Item | Pipeline | Realtime API | Edge |
|------|----------|-------------|------|
| Architecture | STT+LLM+TTS | Integrated model | On-device |
| Latency | 1-3s | 0.3-1s | 0.5-2s |
| Customization | Each component independent | Limited | Full control |
| Cost | Sum of each API | API usage-based | GPU upfront investment |
| Privacy | Sent to cloud | Sent to cloud | Fully local |
| Quality | Depends on combination | Highest | Moderate |
| Offline | No(*) | No | Yes |

### 4.2 Wake Word Detection Engine Comparison

| Item | Porcupine | OpenWakeWord | Snowboy | Mycroft Precise |
|------|-----------|-------------|---------|-----------------|
| License | Commercial (free tier) | Apache 2.0 | Discontinued | Apache 2.0 |
| Custom words | Supported | Supported | - | Supported |
| Accuracy | Very high | High | - | Moderate |
| False positive rate | Very low | Low | - | Moderate |
| CPU usage | Extremely low | Low | - | Moderate |
| Platforms | Many | Python | - | Python/Linux |
| Edge support | RPi supported | RPi supported | - | RPi supported |

### 4.3 STT Model Comparison (for Voice Assistants)

| Model | Latency | Japanese accuracy | Offline | Cost | Recommended use |
|-------|---------|-------------------|---------|------|-----------------|
| Whisper large-v3 | 3-10s | Highest | Yes (GPU) | Free | Batch processing |
| Whisper base | 1-3s | Good | Yes (CPU) | Free | Edge |
| faster-whisper | 0.5-2s | High | Yes | Free | Edge (recommended) |
| Google STT | 0.3-1s | Very high | No | Usage-based | Cloud (recommended) |
| Azure STT | 0.3-1s | Very high | No | Usage-based | Enterprise |
| Deepgram | 0.2-0.5s | High | No | Usage-based | Low latency |

### 4.4 TTS Options Comparison

| TTS | Naturalness | Japanese | Latency | Streaming | Cost |
|-----|------------|----------|---------|-----------|------|
| OpenAI TTS | Highest | Supported | 0.5-1s | Supported | $15/1M chars |
| ElevenLabs | Highest | Supported | 0.3-1s | Supported | From $5/mo |
| Google Cloud TTS | High | Supported | 0.3-0.5s | Supported | Usage-based |
| Azure TTS | High | Supported | 0.3-0.5s | Supported | Usage-based |
| VOICEVOX | High (anime style) | Japanese only | 0.5-2s | No | Free |
| Piper | Moderate | Limited | 0.1-0.3s | No | Free |

---

## 5. Anti-patterns

### 5.1 Anti-pattern: Blocking with Synchronous Processing

```python
# BAD: Execute everything synchronously (worst UI/UX)
def bad_assistant_loop():
    while True:
        wake_word_detected = listen_for_wake_word()  # Blocks
        if wake_word_detected:
            audio = record_audio()          # Blocks
            text = transcribe(audio)        # Blocks (1-3s)
            response = generate(text)       # Blocks (1-5s)
            speech = synthesize(response)   # Blocks (1-2s)
            play(speech)                    # Blocks
            # Total 3-10 seconds of unresponsiveness

# GOOD: Async + streaming processing
import asyncio

async def good_assistant_loop():
    while True:
        await listen_for_wake_word_async()

        # Play acknowledgment sound immediately (feedback)
        asyncio.create_task(play_acknowledgment())

        # Record and STT in parallel (streaming)
        audio_stream = record_audio_stream()

        # Streaming STT (display partial results in real-time)
        partial_text = ""
        async for chunk in audio_stream:
            partial = await stt_streaming(chunk)
            if partial:
                partial_text = partial
                display_partial(partial_text)

        # Streaming LLM
        response_stream = generate_streaming(partial_text)

        # Streaming TTS (incrementally convert LLM output to speech)
        async for text_chunk in response_stream:
            audio_chunk = await tts_streaming(text_chunk)
            await play_async(audio_chunk)
```

### 5.2 Anti-pattern: Lack of Error Handling

```python
# BAD: Complete failure on any error
def bad_process(audio):
    text = stt(audio)
    response = llm(text)
    speech = tts(response)
    return speech  # Any exception -> total failure

# GOOD: Graceful degradation
async def good_process(audio):
    """Staged fallback"""
    # STT with fallback
    try:
        text = await stt_primary(audio)
    except Exception:
        try:
            text = await stt_fallback(audio)
        except Exception:
            await speak("Sorry, I couldn't hear you. Please try again.")
            return

    # LLM with timeout
    try:
        response = await asyncio.wait_for(llm(text), timeout=5.0)
    except asyncio.TimeoutError:
        response = "Sorry, processing is taking longer than expected."
    except Exception:
        response = "An error occurred. Please try again."

    # TTS with fallback
    try:
        await speak_with_tts(response)
    except Exception:
        # Fall back to text display on TTS failure
        display_text(response)
```

### 5.3 Anti-pattern: Misconfigured Wake Word Sensitivity

```python
# BAD: Sensitivity set too high -> frequent false positives
def bad_wake_word():
    detector = WakeWordDetector(
        sensitivity=0.99,  # Reacts to TV audio as well
    )

# BAD: Sensitivity set too low -> no response
def bad_wake_word_low():
    detector = WakeWordDetector(
        sensitivity=0.1,  # Doesn't respond even when shouting
    )

# GOOD: Environment-adapted sensitivity + two-stage verification
def good_wake_word():
    """Two-stage verification to reduce false positives"""
    detector = WakeWordDetector(
        sensitivity=0.6,  # Set slightly high
    )

    def on_first_detection():
        """Verification after initial detection"""
        # Analyze audio immediately after detection for speaker verification
        audio = record_short(duration_ms=500)

        # Speaker verification (check if registered speaker)
        if verify_speaker(audio):
            # Genuine wake word -> start assistant
            start_assistant()
        else:
            # False positive from TV, etc. -> ignore
            pass

    detector.listen(callback=on_first_detection)
```

### 5.4 Anti-pattern: Unmanaged Conversation Context

```python
# BAD: Each turn processed independently
def bad_conversation(text):
    # Doesn't remember previous turns
    response = llm(text)  # Can't resolve "that" or "it"
    return response

# GOOD: With context management
class GoodConversation:
    def __init__(self):
        self.history = []
        self.max_history = 20
        self.entity_memory = {}  # Remember mentioned entities

    def process(self, text):
        self.history.append({"role": "user", "content": text})

        # Extract and remember entities
        entities = extract_entities(text)
        self.entity_memory.update(entities)

        # Call LLM with context
        response = llm(
            messages=self.history[-self.max_history:],
            context=self.entity_memory,
        )

        self.history.append({"role": "assistant", "content": response})

        # Summarize when history gets too long
        if len(self.history) > self.max_history:
            summary = summarize(self.history[:self.max_history // 2])
            self.history = [
                {"role": "system", "content": f"Summary so far: {summary}"},
                *self.history[self.max_history // 2:],
            ]

        return response
```

---

## 6. Practical Use Cases

### 6.1 Smart Home Voice Controller

```python
class SmartHomeVoiceController:
    """Smart home voice controller"""

    def __init__(self):
        self.devices = {
            "living room light": {"type": "light", "id": "living_light"},
            "bedroom light": {"type": "light", "id": "bedroom_light"},
            "air conditioner": {"type": "ac", "id": "main_ac"},
            "TV": {"type": "tv", "id": "living_tv"},
            "humidifier": {"type": "humidifier", "id": "bedroom_hum"},
        }

        self.engine = VoiceAssistantEngine()
        self.engine.tools.extend([
            {
                "type": "function",
                "function": {
                    "name": "control_light",
                    "description": "Control lighting (on/off/dim/change color)",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "device_id": {"type": "string"},
                            "action": {
                                "type": "string",
                                "enum": ["on", "off", "dim", "brighten"],
                            },
                            "brightness": {
                                "type": "integer",
                                "minimum": 0, "maximum": 100,
                            },
                            "color": {"type": "string"},
                        },
                        "required": ["device_id", "action"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "control_ac",
                    "description": "Control the air conditioner",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["on", "off", "set_temp"],
                            },
                            "temperature": {"type": "integer"},
                            "mode": {
                                "type": "string",
                                "enum": ["cool", "heat", "auto", "dry"],
                            },
                        },
                        "required": ["action"],
                    },
                },
            },
        ])

    def process_command(self, voice_text: str) -> str:
        """Process a voice command"""
        return self.engine.process_input(voice_text)
```

### 6.2 Meeting Assistant

```python
class MeetingAssistant:
    """Voice assistant that operates during meetings"""

    def __init__(self):
        self.client = OpenAI()
        self.transcript = []
        self.action_items = []
        self.participants = set()

    def process_segment(self, speaker: str, text: str):
        """Process a speech segment"""
        self.transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat(),
        })
        self.participants.add(speaker)

        # Automatic action item detection
        if self._is_action_item(text):
            self.action_items.append({
                "speaker": speaker,
                "text": text,
                "detected_at": datetime.now().isoformat(),
            })

    def _is_action_item(self, text: str) -> bool:
        """Determine if the text is an action item"""
        indicators = [
            "I'll take care of", "I'll check", "I'll handle",
            "I'm responsible for", "I'll look into", "I'll report",
            "by next meeting", "by next week", "by tomorrow",
        ]
        return any(ind in text for ind in indicators)

    def generate_summary(self) -> str:
        """Generate a meeting summary"""
        transcript_text = "\n".join(
            f"{t['speaker']}: {t['text']}" for t in self.transcript
        )

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": """
Extract the following from the meeting transcript:
1. Agenda summary (3-5 lines)
2. Decisions made
3. Action items (with assignees and deadlines)
4. Suggested topics for the next meeting
"""},
                {"role": "user", "content": transcript_text},
            ],
        )

        return response.choices[0].message.content

    def answer_question(self, question: str) -> str:
        """Answer a question about the meeting content"""
        transcript_text = "\n".join(
            f"{t['speaker']}: {t['text']}" for t in self.transcript[-50:]
        )

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"Answer the question based on the following meeting content:\n{transcript_text}"},
                {"role": "user", "content": question},
            ],
            max_tokens=200,
        )

        return response.choices[0].message.content
```

---

## 7. FAQ

### Q1: How do I create a custom wake word?

There are three main methods. (1) Picovoice Console: Enter the wake word on the web to generate a .ppn file (commercial use requires a paid license). (2) OpenWakeWord: Train a model with your own data (100-500 samples). You can also generate training data using TTS-synthesized speech. (3) Custom build: Train a small CNN or RNN model with MFCC features. Regardless of the method, always perform false accept rate testing (target: less than 1 false activation per 24 hours).

### Q2: How can I improve voice assistant latency?

Key strategies for latency improvement include: (1) Streaming STT: Use streaming recognition instead of batch processing (Google/Azure STT). (2) LLM streaming: Start TTS as soon as the first token is generated. (3) TTS streaming: Play back incrementally in PCM/Opus format. (4) Pre-caching: Pre-synthesize frequently used responses (greetings, confirmations, etc.). (5) Edge inference: Run STT locally (faster-whisper tiny/base). Combining these approaches can achieve a perceived response time of under 1 second.

### Q3: How do I build a privacy-focused voice assistant?

For privacy-focused design: (1) On-device processing: Always run wake word detection and VAD locally; never send audio to the cloud before wake word detection. (2) Local STT: Run faster-whisper on a local GPU. (3) Minimal recording: Stop recording immediately after VAD endpoint; delete audio data immediately after processing. (4) Encryption: Always use TLS for communication; encrypt stored data. (5) User control: Provide a mute button, history deletion, and data collection opt-in/opt-out options.

### Q4: How do I make a voice assistant multilingual?

Approaches for multilingual support: (1) Language detection: Identify the language of audio after wake word detection and select the appropriate STT model. Whisper supports automatic language detection. (2) LLM: Multilingual models like GPT-4o and Claude can handle multiple languages without special prompts. (3) TTS: Prepare TTS models or APIs for each supported language. (4) Wake word: Prepare language-specific wake words or use a language-independent wake word (e.g., a proper noun).

### Q5: How do I implement interruption handling in a voice assistant?

Approaches for interruption handling: (1) OpenAI Realtime API: Built-in automatic interruption detection via server_vad. (2) Pipeline approach: Monitor the microphone during TTS playback and interrupt TTS when VAD detects speech. (3) Technical challenge: AEC (Acoustic Echo Cancellation) is needed to remove the "echo" of speaker output picked up by the microphone. WebRTC's AEC module or speexdsp-py can be used. (4) UX: When interrupted, return a short response like "Yes?" and wait for the new utterance for a natural conversational flow.

### Q6: What is the recommended setup for running a voice assistant on Raspberry Pi?

Recommended configuration for Raspberry Pi 4 (4GB or more): (1) Microphone: ReSpeaker 2-Mic Hat or USB microphone (directional recommended). (2) Speaker: 3.5mm jack or Bluetooth. (3) Wake word: Porcupine (under 2% CPU usage) or OpenWakeWord. (4) STT: faster-whisper tiny model (under 3 seconds with CPU inference). (5) LLM: Cloud API recommended (GPT-4o-mini, etc.). For local, use small models like Gemma 2B. (6) TTS: Piper (sub-realtime with CPU inference). (7) OS: Raspberry Pi OS Lite (no GUI) for minimal footprint. Overall latency is approximately 2-4 seconds.

---


## FAQ

### Q1: What is the most important point to keep in mind when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Pipeline | 5 stages: Wake Word -> VAD -> STT -> LLM -> TTS |
| Wake word | Porcupine (commercial quality), OpenWakeWord (OSS) |
| Dialog management | Flexible dialog via LLM + Function Calling |
| Latency | Sub-1-second perceived response with streaming |
| Multimodal | Integrated voice dialog via OpenAI Realtime API |
| Privacy | Wake word detection must be local |
| Edge deployment | faster-whisper + Piper on RPi4 is practical |
| Dialog state management | Structured dialog via intent/slot management |

## Recommended Next Guides

- [02-podcast-tools.md](./02-podcast-tools.md) — Podcast Tools
- [../03-development/02-real-time-audio.md](../03-development/02-real-time-audio.md) — Real-time Audio Processing
- [../00-fundamentals/03-stt-technologies.md](../00-fundamentals/03-stt-technologies.md) — STT Technology Details

## References

1. Picovoice Documentation (2025). "Porcupine Wake Word Engine" — Documentation for a commercial-quality wake word engine
2. OpenAI (2024). "Realtime API Documentation" — Guide for the GPT-4o-based real-time voice dialog API
3. Rasa Open Source (2024). "Building Conversational AI" — Documentation for an open-source dialog management framework
4. Silero Team (2024). "Silero VAD" — Implementation and evaluation of a high-accuracy lightweight VAD model
5. Radford, A., et al. (2023). "Robust Speech Recognition via Large-Scale Weak Supervision" — The Whisper paper on STT via large-scale weak supervision
6. Hughes, T., et al. (2023). "OpenWakeWord: An Open-Source Wakeword Detection Library" — OSS wake word detection library
