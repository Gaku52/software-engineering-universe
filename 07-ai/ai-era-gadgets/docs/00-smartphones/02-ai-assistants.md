# AI Assistants — Siri / Google Assistant / Alexa and LLM Integration

> A systematic guide covering how voice AI assistants work, from speech recognition pipelines and LLM (Large Language Model) integration to developing custom voice applications.

---

## What You'll Learn in This Chapter

1. **Speech Recognition Pipeline Architecture** — Processing flow from voice input to intent understanding and response generation
2. **Technical Comparison of Major Assistants** — Design philosophies and strengths of Siri / Google Assistant / Alexa
3. **The Frontier of LLM Integration** — Assistant evolution through ChatGPT / Gemini and development techniques
4. **Voice App Implementation** — Practical techniques for developing custom skills and actions
5. **Local LLM Voice Assistants** — Building privacy-focused on-device voice AI


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [AI Cameras — Computational Photography, Night Mode, AI Editing](./01-ai-cameras.md)

---

## 1. Voice Assistant Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           Voice Assistant Processing Pipeline                │
│                                                               │
│  User Speech                                                  │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │ Wake Word│──▶│ ASR      │──▶│ NLU      │──▶│ Dialog   │   │
│  │ Detection│   │ (Speech  │   │ (Intent  │   │ Manager  │   │
│  │ "Hey     │   │  →Text)  │   │  Under-  │   │ (Dialog  │   │
│  │  Siri"   │   │ Whisper  │   │  standing)│   │  Mgmt)   │   │
│  └─────────┘   └──────────┘   └──────────┘   └──────────┘   │
│                                                    │          │
│                                                    ▼          │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │ Speaker  │◀──│ TTS      │◀──│ Response │◀──│ Action   │   │
│  │ Output   │   │ (Text    │   │ Generator│   │ Executor │   │
│  │          │   │  →Speech)│   │ (LLM)    │   │ (API Call)│   │
│  └─────────┘   └──────────┘   └──────────┘   └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Traditional vs LLM-Integrated

```
┌─────────────────────────────────────────────┐
│  [Traditional] Intent-Based                   │
│                                               │
│  "What's the weather tomorrow?"               │
│     ↓ NLU                                    │
│  Intent: weather_query                        │
│  Slot: date=tomorrow, location=current        │
│     ↓ Rule-Based                             │
│  Weather API → Fixed Response Template        │
│                                               │
│  [LLM-Integrated] Free-Form Conversation      │
│                                               │
│  "What's the weather tomorrow? Can I go       │
│   on a picnic?"                               │
│     ↓ LLM (Gemini / GPT-4)                  │
│  - Call weather API                           │
│  - Consider temperature & precipitation       │
│    probability                                │
│  - "It'll be sunny at 25°C, perfect for a    │
│    picnic! However, winds will pick up in     │
│    the afternoon, so morning is recommended." │
└─────────────────────────────────────────────┘
```

### 1.2 Technical Details of Wake Word Detection

Wake word detection is the most critical component of a voice assistant, as it must constantly monitor the microphone while operating with minimal power consumption.

```
┌─────────────────────────────────────────────────────┐
│       Wake Word Detection Architecture               │
│                                                       │
│  Microphone Input (always on)                         │
│      │                                                │
│      ▼                                                │
│  ┌──────────────────────────┐                         │
│  │ DSP (Digital Signal      │  ← Ultra-low power      │
│  │  Processor)              │     (~1mW)               │
│  │ - VAD (Voice Activity    │     Always listening     │
│  │   Detection)             │                         │
│  │ - Preprocessing (Noise   │                         │
│  │   Removal)               │                         │
│  └────────────┬─────────────┘                         │
│               │ Only when speech detected             │
│               ▼                                       │
│  ┌──────────────────────────┐                         │
│  │ NPU / Lightweight CNN    │  ← Low power (~10mW)    │
│  │ - "Hey Siri" detection   │     Small keyword model  │
│  │ - Speaker ID (whose      │     ~200KB model         │
│  │   voice)                 │                         │
│  └────────────┬─────────────┘                         │
│               │ When wake word detected               │
│               ▼                                       │
│  ┌──────────────────────────┐                         │
│  │ Main Processor Activated  │  ← Normal power         │
│  │ - Full ASR starts        │     consumption          │
│  │ - Cloud connection       │     Large models like    │
│  │                          │     Whisper              │
│  └──────────────────────────┘                         │
│                                                       │
│  Battery Impact:                                      │
│  DSP always listening: ~1-2% battery drain per day    │
│  (Further efficiency gains by transitioning to NPU)   │
└─────────────────────────────────────────────────────┘
```

### 1.3 Streaming Processing for Speech Recognition (ASR)

```
┌─────────────────────────────────────────────────────┐
│     Streaming ASR Processing Flow                     │
│                                                       │
│  User Speech:                                         │
│  "Tell  me  the  weather  for  tomorrow"              │
│   │     │    │     │       │     │                    │
│   ▼     ▼    ▼     ▼       ▼     ▼                    │
│  [Chunk 1]  [Chunk 2]  [Chunk 3]                      │
│   │                                                   │
│   ▼                                                   │
│  Streaming Decoder                                    │
│   │                                                   │
│   ├── Partial result: "tell"                          │
│   ├── Partial result: "tell me the weather"           │
│   ├── Partial result: "tell me the weather for"       │
│   └── Final result: "Tell me the weather for tomorrow"│
│                                                       │
│  Benefits:                                            │
│  - Processing starts before speech ends               │
│    → Significant reduction in perceived latency       │
│  - Intent estimation runs ahead on partial results    │
│    (speculative execution)                            │
│  - If confidence is high, API calls begin before      │
│    ASR completion                                     │
│                                                       │
│  Latency Comparison:                                  │
│  Batch ASR:     Speech end → Full recognition         │
│                 → Result (~1.5s)                       │
│  Streaming:     During speech → Incremental           │
│                 recognition → Result (~0.3s)           │
└─────────────────────────────────────────────────────┘
```

---

## 2. Code Examples

### Code Example 1: Custom Action with Google Actions SDK

```javascript
const { conversation } = require('@assistant/conversation');
const functions = require('firebase-functions');

const app = conversation();

// Handle main intent
app.handle('greeting', (conv) => {
  conv.add('Hello! Welcome to the AI Assistant Guide.');
  conv.add('How can I help you?');
});

// Handle weather query intent
app.handle('weather_query', async (conv) => {
  const location = conv.intent.params.location?.resolved;
  const date = conv.intent.params.date?.resolved;

  // External API call
  const weather = await fetchWeather(location, date);

  conv.add(`The weather in ${location} on ${date} will be ${weather.condition}, `
    + `with a temperature of ${weather.temp}°C.`);

  if (weather.rain_probability > 50) {
    conv.add('I recommend bringing an umbrella.');
  }
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
```

### Code Example 2: Alexa Skill (Python Lambda)

```python
from ask_sdk_core.skill_builder import SkillBuilder
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.utils import is_intent_name

sb = SkillBuilder()

class RecipeIntentHandler(AbstractRequestHandler):
    """Skill to suggest cooking recipes"""

    def can_handle(self, handler_input):
        return is_intent_name("RecipeIntent")(handler_input)

    def handle(self, handler_input):
        slots = handler_input.request_envelope.request.intent.slots
        ingredient = slots["ingredient"].value

        # Generate recipe with LLM (via Bedrock)
        import boto3
        bedrock = boto3.client('bedrock-runtime')
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-sonnet',
            body=json.dumps({
                "prompt": f"Suggest one simple recipe using {ingredient}.",
                "max_tokens": 200
            })
        )
        recipe = json.loads(response['body'].read())['completion']

        speech = f"Here's a recipe using {ingredient}. {recipe}"
        return handler_input.response_builder.speak(speech).response

sb.add_request_handler(RecipeIntentHandler())
lambda_handler = sb.lambda_handler()
```

### Code Example 3: Siri Shortcuts + Intents (Swift)

```swift
import Intents
import IntentsUI

// Custom Intent definition (Xcode Intent Definition File)
class OrderCoffeeIntentHandler: NSObject, OrderCoffeeIntentHandling {

    func handle(intent: OrderCoffeeIntent,
                completion: @escaping (OrderCoffeeIntentResponse) -> Void) {

        let coffeeType = intent.coffeeType ?? "latte"
        let size = intent.size ?? .medium

        // Order processing
        CoffeeAPI.placeOrder(type: coffeeType, size: size) { result in
            switch result {
            case .success(let order):
                let response = OrderCoffeeIntentResponse(code: .success,
                    userActivity: nil)
                response.orderNumber = order.id
                response.estimatedTime = "\(order.waitMinutes) min"
                completion(response)

            case .failure:
                completion(OrderCoffeeIntentResponse(code: .failure,
                    userActivity: nil))
            }
        }
    }

    // Suggestion to Siri
    func resolveCoffeeType(for intent: OrderCoffeeIntent,
        with completion: @escaping (INStringResolutionResult) -> Void) {
        if let type = intent.coffeeType {
            completion(.success(with: type))
        } else {
            completion(.needsValue())
        }
    }
}
```

### Code Example 4: Real-Time Voice Conversation with OpenAI Realtime API

```python
import asyncio
import websockets
import json
import base64
import pyaudio

async def realtime_voice_assistant():
    """Real-time voice assistant using OpenAI Realtime API"""

    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1"
    }

    async with websockets.connect(url, extra_headers=headers) as ws:
        # Session configuration
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": "You are a helpful assistant.",
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "turn_detection": {
                    "type": "server_vad",  # Server-side VAD
                    "threshold": 0.5
                }
            }
        }))

        # Send microphone input
        audio = pyaudio.PyAudio()
        stream = audio.open(format=pyaudio.paInt16,
                          channels=1, rate=24000,
                          input=True, frames_per_buffer=1024)

        async def send_audio():
            while True:
                data = stream.read(1024, exception_on_overflow=False)
                encoded = base64.b64encode(data).decode()
                await ws.send(json.dumps({
                    "type": "input_audio_buffer.append",
                    "audio": encoded
                }))
                await asyncio.sleep(0.04)

        async def receive_response():
            while True:
                msg = json.loads(await ws.recv())
                if msg["type"] == "response.audio.delta":
                    audio_data = base64.b64decode(msg["delta"])
                    # Output to speaker
                    play_audio(audio_data)

        await asyncio.gather(send_audio(), receive_response())

asyncio.run(realtime_voice_assistant())
```

### Code Example 5: Local LLM Voice Assistant (Whisper + Ollama)

```python
import whisper
import ollama
import pyttsx3
import sounddevice as sd
import numpy as np

class LocalVoiceAssistant:
    """Voice assistant that runs entirely locally"""

    def __init__(self):
        # Whisper (speech recognition)
        self.asr_model = whisper.load_model("base")
        # TTS engine
        self.tts = pyttsx3.init()
        self.tts.setProperty('rate', 180)

    def listen(self, duration=5, sample_rate=16000):
        """Record audio from microphone"""
        print("Listening...")
        audio = sd.rec(int(duration * sample_rate),
                      samplerate=sample_rate, channels=1,
                      dtype='float32')
        sd.wait()
        return audio.flatten()

    def transcribe(self, audio):
        """Convert speech to text (Whisper)"""
        result = self.asr_model.transcribe(
            audio, language="ja", fp16=False
        )
        return result["text"]

    def think(self, user_text, context=None):
        """Generate response with local LLM (Ollama)"""
        messages = [
            {"role": "system",
             "content": "Please respond concisely."},
        ]
        if context:
            messages.append({"role": "assistant", "content": context})
        messages.append({"role": "user", "content": user_text})

        response = ollama.chat(model="gemma2:9b", messages=messages)
        return response['message']['content']

    def speak(self, text):
        """Read text aloud"""
        print(f"Assistant: {text}")
        self.tts.say(text)
        self.tts.runAndWait()

    def run(self):
        """Main loop"""
        print("Local voice assistant started (Ctrl+C to exit)")
        context = None
        while True:
            audio = self.listen()
            text = self.transcribe(audio)
            print(f"User: {text}")

            if "quit" in text.lower() or "goodbye" in text.lower():
                self.speak("Goodbye.")
                break

            response = self.think(text, context)
            context = response
            self.speak(response)

assistant = LocalVoiceAssistant()
assistant.run()
```

### Code Example 6: Siri Integration with Apple App Intents (iOS 16+)

```swift
import AppIntents

/// Siri integration using the App Intents framework (iOS 16+)
/// More concise and type-safe than traditional SiriKit Intent Definitions
struct SearchRecipeIntent: AppIntent {
    static var title: LocalizedStringResource = "Search Recipes"
    static var description = IntentDescription("Search recipes by ingredient")

    // This parameter is automatically extracted when querying Siri with natural language
    @Parameter(title: "Ingredient")
    var ingredient: String

    @Parameter(title: "Cooking Time (minutes)", default: 30)
    var maxCookingTime: Int

    // Also automatically displayed in the Siri Shortcuts app
    static var parameterSummary: some ParameterSummary {
        Summary("Recipes using \(\.$ingredient) within \(\.$maxCookingTime) minutes")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        // Recipe search logic
        let recipes = try await RecipeService.search(
            ingredient: ingredient,
            maxTime: maxCookingTime
        )

        guard let topRecipe = recipes.first else {
            return .result(
                dialog: "No recipes found using \(ingredient)."
            )
        }

        // Siri response + rich UI snippet
        return .result(
            dialog: "How about \(topRecipe.name)? Cooking time is \(topRecipe.cookingTime) minutes.",
            view: RecipeSnippetView(recipe: topRecipe)
        )
    }
}

/// Shortcut provider displayed in the Shortcuts app
struct RecipeShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SearchRecipeIntent(),
            phrases: [
                "Search for \(\.$ingredient) recipes in \(.applicationName)",
                "Suggest a simple dish in \(.applicationName)",
            ],
            shortTitle: "Search Recipes",
            systemImageName: "fork.knife"
        )
    }
}
```

### Code Example 7: External API Integration Assistant with Function Calling

```python
import openai
import json
import requests

class FunctionCallingAssistant:
    """
    Advanced AI assistant using Function Calling.
    The LLM automatically selects and executes the appropriate API.

    Why Function Calling:
    - Handles complex queries that traditional intent classification cannot
    - The LLM automatically selects appropriate functions based on context
    - Enables chained execution of multiple functions sequentially
    """

    def __init__(self, api_key):
        self.client = openai.OpenAI(api_key=api_key)
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the weather forecast for a specified location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string", "description": "City name"},
                            "date": {"type": "string", "description": "Date (YYYY-MM-DD)"}
                        },
                        "required": ["location"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_restaurant",
                    "description": "Search for restaurants",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string"},
                            "cuisine": {"type": "string", "description": "Type of cuisine"},
                            "budget": {"type": "integer", "description": "Budget (JPY)"}
                        },
                        "required": ["location"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "set_reminder",
                    "description": "Set a reminder",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "datetime": {"type": "string"},
                            "priority": {"type": "string", "enum": ["low", "medium", "high"]}
                        },
                        "required": ["title", "datetime"]
                    }
                }
            }
        ]

    def chat(self, user_message, conversation_history=None):
        """Process user message and call APIs as needed"""
        if conversation_history is None:
            conversation_history = []

        messages = [
            {"role": "system", "content": "You are a helpful assistant. "
             "Use the appropriate tools based on the user's request."},
            *conversation_history,
            {"role": "user", "content": user_message}
        ]

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=self.tools,
            tool_choice="auto"
        )

        message = response.choices[0].message

        # If a Function Call is requested
        if message.tool_calls:
            results = []
            for tool_call in message.tool_calls:
                func_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                # Execute the function
                result = self._execute_function(func_name, args)
                results.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "content": json.dumps(result, ensure_ascii=False)
                })

            # Pass function results to LLM for final response generation
            messages.append(message)
            messages.extend(results)

            final_response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )
            return final_response.choices[0].message.content

        return message.content

    def _execute_function(self, name, args):
        """Execute a function and return the result"""
        if name == "get_weather":
            return {"condition": "sunny", "temp": 22, "rain_prob": 10}
        elif name == "search_restaurant":
            return {"name": "Sushi Kanesaka", "rating": 4.8, "price": "¥15,000"}
        elif name == "set_reminder":
            return {"status": "success", "id": "rem_123"}
        return {"error": "Unknown function"}

# Usage example
assistant = FunctionCallingAssistant(api_key="sk-...")
# Compound query: automatically checks weather + searches restaurants
response = assistant.chat(
    "Check tomorrow's weather in Tokyo, and if it's nice, find a lunch spot in Omotesando"
)
print(response)
```

### Code Example 8: Home Assistant Local Voice Pipeline (Wyoming Protocol)

```python
"""
Local voice pipeline using Home Assistant Wyoming Protocol

The Wyoming Protocol is a communication protocol between voice processing components:
  Microphone → Wake Word (openWakeWord) → ASR (Whisper) →
  Intent → TTS (Piper) → Speaker

Everything runs locally with no cloud required.
"""
import asyncio
import json
from wyoming.server import AsyncServer
from wyoming.asr import Transcribe, Transcript
from wyoming.wake import Detection
import whisper
import numpy as np

class LocalASRServer:
    """Whisper-based local ASR server"""

    def __init__(self, model_name="base"):
        self.model = whisper.load_model(model_name)
        print(f"Whisper {model_name} model loaded")

    async def handle_client(self, reader, writer):
        """Process ASR requests via Wyoming protocol"""
        # Receive audio data
        audio_data = await self._receive_audio(reader)

        # Recognize with Whisper
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        result = self.model.transcribe(audio_np, language="ja", fp16=False)

        transcript = result["text"].strip()
        print(f"Recognition result: {transcript}")

        # Return result via Wyoming protocol
        response = Transcript(text=transcript)
        await self._send_response(writer, response)

    async def _receive_audio(self, reader):
        """Receive audio data"""
        chunks = []
        while True:
            data = await reader.read(4096)
            if not data:
                break
            chunks.append(data)
        return b"".join(chunks)

    async def _send_response(self, writer, response):
        """Send response"""
        writer.write(json.dumps({"text": response.text}).encode())
        await writer.drain()
        writer.close()

async def main():
    server = LocalASRServer(model_name="small")
    srv = await asyncio.start_server(
        server.handle_client, "0.0.0.0", 10300  # Wyoming ASR port
    )
    print("Wyoming ASR server started: port 10300")
    async with srv:
        await srv.serve_forever()

# Start: python wyoming_asr.py
# Add Wyoming integration in Home Assistant to connect
```

---

## 3. Comparison Tables

### Comparison Table 1: Major AI Assistants

| Item | Siri (Apple) | Google Assistant | Alexa (Amazon) |
|------|-------------|-----------------|---------------|
| LLM Integration | Apple Intelligence + ChatGPT | Gemini | Alexa LLM + Bedrock |
| On-Device Processing | Neural Engine | Tensor TPU | Limited |
| Supported Languages | 21 languages | 40+ languages | 8 languages |
| Smart Home | HomeKit | Google Home | Alexa Smart Home |
| Third-Party Extensions | Shortcuts / App Intents | Actions on Google | Alexa Skills |
| Privacy | Device-first data processing | Google Account integration | Cloud-centric processing |
| Speech Recognition Accuracy | High (English) | Top-tier | High |
| Multimodal | Text+Voice+Image | Text+Voice+Image+Video | Text+Voice |

### Comparison Table 2: Speech Recognition Technologies

| Model | Developer | Parameters | Languages | WER (English) | Local Execution |
|--------|-------|----------|---------|-----------|------------|
| Whisper large-v3 | OpenAI | 1.5B | 100+ | 3.0% | Yes (GPU recommended) |
| Gemini ASR | Google | Undisclosed | 100+ | 2.8% | Partial |
| Azure Speech | Microsoft | Undisclosed | 100+ | 3.5% | No |
| Vosk | Alpha Cephei | ~50M | 20+ | 8.0% | Yes (CPU capable) |
| Whisper tiny | OpenAI | 39M | 100+ | 8.5% | Yes (CPU capable) |

### Comparison Table 3: TTS (Text-to-Speech) Technologies

| Engine | Developer | Japanese Quality | Latency | Local Execution | Cost |
|---------|-------|----------|----------|------------|--------|
| OpenAI TTS | OpenAI | Very High | ~500ms | No | API billing |
| Google Cloud TTS | Google | Very High | ~300ms | No | API billing |
| Amazon Polly | AWS | High | ~200ms | No | API billing |
| Piper | Rhasspy | Medium-High | ~50ms | Yes (CPU capable) | Free |
| VOICEVOX | VOICEVOX | High (character voices) | ~100ms | Yes | Free |
| Style-TTS 2 | Research | High | ~200ms | Yes (GPU recommended) | Free |

### Comparison Table 4: Voice Assistant Development Platforms

| Item | Alexa Skills Kit | Google Actions | Apple App Intents | Rasa + Wyoming |
|------|-----------------|---------------|-------------------|---------------|
| Dev Language | Python/Node.js | Node.js | Swift | Python |
| Hosting | AWS Lambda | Firebase | Built into App | Self-hosted |
| NLU | Alexa NLU | Dialogflow | Automatic | Rasa NLU |
| LLM Integration | Bedrock | Vertex AI | ChatGPT integration | Ollama etc. |
| Monetization | In-Skill Purchases | - | App Store | - |
| Privacy | Cloud required | Cloud required | On-device capable | Fully local capable |
| Japanese Support | Full support | Full support | Full support | Community |

---

## 4. Practical Use Cases

### Use Case 1: Multimodal Voice Assistant

```python
class MultimodalAssistant:
    """
    Multimodal assistant integrating text + voice + image.
    Example: Ask by voice "What's the calorie count of this dish?" + take a photo
    """
    def __init__(self):
        self.asr = whisper.load_model("base")
        self.vlm_client = openai.OpenAI()  # GPT-4V

    async def process_multimodal_query(self, audio_data, image_data=None):
        """Process a multimodal query with voice + image"""

        # 1. Speech recognition
        text = self.asr.transcribe(audio_data, language="ja")["text"]
        print(f"Recognized text: {text}")

        # 2. Process with multimodal LLM if image is available
        if image_data:
            import base64
            image_b64 = base64.b64encode(image_data).decode()

            response = self.vlm_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}"
                                }
                            }
                        ]
                    }
                ]
            )
            return response.choices[0].message.content

        # 3. Text-only case
        response = self.vlm_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": text}]
        )
        return response.choices[0].message.content
```

### Use Case 2: Proactive Assistant

```python
class ProactiveAssistant:
    """
    A proactive assistant that provides information ahead of time
    based on context, without explicit user instructions.

    Why proactive:
    - Traditional assistants are passive: "question → answer"
    - Proactive assistants monitor the situation and intervene at the right time
    - Apple Intelligence's "Personal Context" follows this direction
    """
    def __init__(self):
        self.context_store = {}
        self.rules = []

    def update_context(self, context_type, data):
        """Update context information"""
        self.context_store[context_type] = {
            "data": data,
            "timestamp": time.time()
        }
        self._evaluate_rules()

    def _evaluate_rules(self):
        """Evaluate rules and generate proactive suggestions"""
        suggestions = []

        # Rule 1: Provide traffic info when departure time is approaching
        if "calendar" in self.context_store and "location" in self.context_store:
            next_event = self.context_store["calendar"]["data"]
            if next_event.get("departure_in_minutes", float('inf')) < 30:
                weather = self._get_weather()
                traffic = self._get_traffic(next_event["location"])
                suggestions.append(
                    f"{next_event['departure_in_minutes']} minutes until {next_event['title']}. "
                    f"Current traffic: {traffic['duration']} minutes. "
                    f"{'Don\\'t forget your umbrella.' if weather['rain_prob'] > 50 else ''}"
                )

        # Rule 2: Detect abnormal health data
        if "health" in self.context_store:
            hr = self.context_store["health"]["data"].get("heart_rate", 0)
            if hr > 100 and self.context_store.get("activity", {}).get("data", {}).get("type") == "resting":
                suggestions.append(
                    f"Your resting heart rate is elevated at {hr} BPM. "
                    "This may indicate stress or dehydration. Please stay hydrated."
                )

        # Rule 3: Remind about recurring tasks
        if "habits" in self.context_store:
            habits = self.context_store["habits"]["data"]
            for habit in habits:
                if habit["due"] and not habit["completed"]:
                    suggestions.append(f"You haven't completed \"{habit['name']}\" yet.")

        for suggestion in suggestions:
            self._notify_user(suggestion)

    def _notify_user(self, message):
        """Notify the user"""
        print(f"[Proactive Suggestion] {message}")
```

---

## 5. Troubleshooting

### Problem 1: Low Speech Recognition Accuracy

```
Symptom: The assistant fails to correctly recognize spoken content

Solutions:
1. Environmental noise issues
   → Use in a quiet environment
   → Use a device with beamforming microphones
   → For Whisper, use --condition_on_previous_text=False to prevent
     cascading misrecognitions

2. Language/dialect issues
   → Verify the speech recognition language setting
   → Google Assistant: Explicitly set to Japanese (Japan)
   → Whisper: Explicitly specify language="ja"

3. Microphone issues
   → Check that microphone permissions are granted
   → Ensure no cover or case is blocking the microphone
   → Bluetooth microphones may have significant latency

4. Network latency
   → Check Wi-Fi connection (for cloud ASR)
   → Enable offline recognition (on supported devices)
```

### Problem 2: Slow Response

```
Symptom: Several seconds pass between voice command and response

Checkpoints:
1. ASR processing time
   → Enable streaming ASR (Google: use streaming recognition)
   → For local ASR, downgrade to Whisper tiny/base

2. LLM response time
   → Switch from GPT-4 to GPT-3.5-turbo (when speed is priority)
   → Local LLM: Use Gemma 2B / Phi-3 Mini
   → Enable streaming responses

3. TTS processing time
   → Piper (local): ~50ms, very fast
   → OpenAI TTS: Streaming support improves perceived speed
   → TTS the first sentence first → process the rest in parallel

4. Network latency
   → Use API in a region close to CDN
   → Use WebSocket for persistent connection (faster than HTTP per-request)
```

### Problem 3: False Wake Word Detection

```
Symptom: The assistant activates when not called

Solutions:
1. Adjust wake word model sensitivity
   → Alexa: Settings > Change wake word sensitivity to "Low"
   → Google: Retrain "OK Google"
   → Apple: Retrain "Hey Siri"

2. Ambient sound countermeasures
   → If responding to TV or radio audio
   → Move device away from speakers
   → Multi-mic devices use beamforming to limit speaker direction

3. Use speaker recognition
   → Enable setting to respond only to registered voices
   → Apple: Train "Hey Siri" to recognize your personal voice
   → Google: Register family voices with Voice Match

4. For openWakeWord (local)
   → Raise detection threshold from 0.5 to 0.7
   → Increase training data for custom wake words
```

### Problem 4: Smart Home Integration Not Working

```
Symptom: "Turn on the living room lights" doesn't work

Solutions:
1. Device name issues
   → Verify the device name registered with the assistant
   → Use the registered name "Living Room Light" instead of
     "living room lights"
   → Rename devices to short, clear names

2. Account linking issues
   → Reconfigure integration with smart home provider
   → Check for expired OAuth tokens
   → Home Assistant: Verify Nabu Casa cloud connection

3. Network issues
   → Verify IoT devices are connected to Wi-Fi
   → If using VLANs, check mDNS/UPnP forwarding settings
   → Thread/Zigbee: Verify Border Router is operational
```

---

## 6. Performance Optimization Tips

### Tip 1: Reducing End-to-End Latency

```
┌────────────────────────────────────────────────────┐
│     Voice Assistant Latency Optimization            │
├────────────────────────────────────────────────────┤
│                                                      │
│  Traditional Pipeline (total: 2-5s)                  │
│  ASR(1s) → NLU(0.3s) → API(0.5s) → TTS(0.5s)     │
│                                                      │
│  Optimized Pipeline (total: 0.5-1.5s)               │
│                                                      │
│  1. Streaming ASR: Start recognition during speech   │
│     → Recognition nearly complete by end of speech   │
│                                                      │
│  2. Speculative execution: Begin intent estimation   │
│     on partial ASR results                           │
│     → Pre-call Weather API at "tomorrow's weather"   │
│                                                      │
│  3. Streaming TTS: Start TTS on the LLM's first     │
│     token, run audio generation and playback in      │
│     parallel                                         │
│                                                      │
│  4. Caching: Cache results for frequent queries      │
│     → "What time is it?" responds locally instantly  │
│                                                      │
│  5. Pre-warming: On wake word detection,             │
│     pre-establish LLM connection and preload model   │
└────────────────────────────────────────────────────┘
```

### Tip 2: Whisper Model Selection Guide

```
Whisper Model Selection Flowchart:

What are your device specs?
    │
    ├── Smartphone / Raspberry Pi
    │   → Whisper tiny (39M, ~1GB RAM)
    │   → Accuracy: WER 8.5% (English)
    │   → Speed: ~6x real-time
    │
    ├── Laptop (CPU only)
    │   → Whisper base (74M, ~2GB RAM)
    │   → Accuracy: WER 5.0% (English)
    │   → Speed: ~4x real-time
    │
    ├── Desktop (with GPU)
    │   → Whisper small (244M, ~4GB RAM)
    │   → Accuracy: WER 3.4% (English)
    │   → Speed: ~15x real-time
    │
    └── Server (H100 etc.)
        → Whisper large-v3 (1.5B, ~10GB RAM)
        → Accuracy: WER 3.0% (English)
        → Speed: ~50x real-time

For Japanese:
  - large-v3 offers the highest accuracy
  - base provides practical accuracy (CER ~10%)
  - faster-whisper (CTranslate2) provides 2-4x speedup
  - distil-whisper provides 6x speedup while maintaining accuracy
```

### Tip 3: Cost Optimization

```
Voice assistant operational cost comparison (at 1,000 requests/day):

┌───────────────────────────────────────────────────┐
│  Configuration A: Full Cloud                       │
│  ASR: Google Cloud Speech ($0.006/15s)             │
│  LLM: GPT-4o ($0.01/1K tokens * 500 tokens avg)   │
│  TTS: Google Cloud TTS ($4/1M chars)               │
│  Monthly: ~$200-400                                │
├───────────────────────────────────────────────────┤
│  Configuration B: Hybrid                           │
│  ASR: Whisper (local, free)                        │
│  LLM: GPT-3.5-turbo ($0.002/1K tokens)            │
│  TTS: Piper (local, free)                          │
│  Monthly: ~$30-60                                  │
├───────────────────────────────────────────────────┤
│  Configuration C: Fully Local                      │
│  ASR: Whisper (local)                              │
│  LLM: Ollama + Gemma 9B (local)                   │
│  TTS: Piper / VOICEVOX (local)                     │
│  Monthly: $0 (electricity only)                    │
│  * Initial investment: PC ($1,000-2,000)           │
└───────────────────────────────────────────────────┘
```

---

## 7. Design Patterns

### Pattern 1: Hybrid Routing

```python
class HybridRouter:
    """
    Hybrid design that handles simple commands instantly via rules,
    and routes complex questions to LLM.

    Why hybrid:
    - "Timer 3 minutes" doesn't need an LLM (wastes latency & cost)
    - "Suggest an outfit considering tomorrow's weather" is suited for LLM
    """
    def __init__(self):
        self.simple_commands = {
            "timer": self._handle_timer,
            "alarm": self._handle_alarm,
            "volume": self._handle_volume,
            "call": self._handle_call,
        }
        self.llm = OllamaClient()

    def route(self, text):
        # 1. Simple command matching (regex-based)
        for keyword, handler in self.simple_commands.items():
            if keyword in text:
                return handler(text), "rule"

        # 2. Route to LLM
        return self.llm.chat(text), "llm"

    def _handle_timer(self, text):
        import re
        match = re.search(r'(\d+)\s*min', text)
        if match:
            minutes = int(match.group(1))
            return f"Timer set for {minutes} minutes."
        return "How many minutes for the timer?"
```

### Pattern 2: Context-Preserving Dialog Management

```python
class ContextualDialogManager:
    """
    Maintains dialog context for natural continuous conversation.

    Problem: "What's the weather in Tokyo?" → "What about tomorrow?"
    → Without context: "What do you mean?"

    Solution: Retain recent dialog history and resolve pronouns/omissions.
    """
    def __init__(self, max_history=10):
        self.history = []
        self.entities = {}  # Cache of extracted entities
        self.max_history = max_history

    def process(self, user_input):
        # Entity tracking
        new_entities = self._extract_entities(user_input)
        self.entities.update(new_entities)

        # Fill in omitted information
        enriched_input = self._resolve_references(user_input)

        # Add to dialog history
        self.history.append({"role": "user", "content": enriched_input})

        # Generate response with LLM (including history)
        response = self._generate_response()

        self.history.append({"role": "assistant", "content": response})

        # Manage history limit
        if len(self.history) > self.max_history * 2:
            self.history = self.history[-self.max_history * 2:]

        return response

    def _extract_entities(self, text):
        """Extract entities from text"""
        entities = {}
        # Location extraction
        locations = ["Tokyo", "Osaka", "Nagoya", "Fukuoka", "Sapporo"]
        for loc in locations:
            if loc.lower() in text.lower():
                entities["location"] = loc
        # Date extraction
        if "tomorrow" in text.lower():
            entities["date"] = "tomorrow"
        elif "today" in text.lower():
            entities["date"] = "today"
        return entities

    def _resolve_references(self, text):
        """Resolve pronouns and omissions"""
        # "What about tomorrow?" → "What about Tokyo's weather tomorrow?"
        if len(text) < 20 and "location" in self.entities:
            if "tomorrow" in text.lower() or "today" in text.lower():
                text = f"{self.entities['location']} weather {text}"
        return text
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Delegating Everything to the LLM

```
Bad example:
"Set a timer for 3 minutes" → Sent to LLM (GPT-4) and wait for response
→ 2-second delay, unnecessary API costs

Correct approach:
- Simple commands (timer, alarm, phone) → Execute immediately with rules
- Complex questions (research, summarization, creative tasks) → Route to LLM
- Hybrid design: An intent classifier handles the routing
```

### Anti-Pattern 2: Single-Turn Responses Without Context

```
Bad example:
User: "What's the weather in Tokyo?" → "It's sunny"
User: "What about tomorrow?" → "What are you referring to?" (context lost)

Correct approach:
- Include dialog history (last 5-10 turns) in the LLM context
- Entity resolution: Infer "What about tomorrow" → "Tokyo's weather tomorrow"
- Maintain context through session management
```

### Anti-Pattern 3: Voice Pipeline Without Error Handling

```
Bad example:
ASR failure → Crash
LLM timeout → Freezes with no response

Correct approach:
- ASR failure: "Sorry, I didn't catch that. Could you say that again?"
- LLM timeout: "Just a moment..." → After 5s: "This is taking longer than expected"
- Network error: Local fallback (offline response)
- TTS failure: Fall back to text display
```

### Anti-Pattern 4: Design Without Privacy Considerations

```
Bad example:
- Send all voice data to the cloud and store permanently
- Use conversation logs as training data without user consent
- Process children's voices without distinction

Correct approach:
- Never send audio captured before wake word detection off device
- Set automatic deletion policies for voice data (e.g., 30 days)
- Provide users with the ability to view and delete recorded data
- Apply COPPA-compliant restrictions for children's accounts
- Offer local processing options (Whisper + Ollama)
```

---

## 9. Edge Case Analysis

### Edge Case 1: Multilingual Mixed-Language Speech

Utterances mixing Japanese and English (code-switching) are challenging cases for ASR models.

```
Example: "Set up the ChatGPT API key in Slack"

Challenges:
- "ChatGPT", "API", "Slack" are English proper nouns
- Katakana loanwords may mix in
- Japanese-mode ASR tends to misrecognize English portions

Solutions:
1. Whisper large-v3 is multilingual and handles mixing well
2. Post-process with dictionary matching to correct proper nouns
3. Hot word feature (Whisper's initial_prompt parameter)
   → initial_prompt="ChatGPT, API, Slack, setup"
4. Provide domain-specific vocabulary lists to ASR
```

### Edge Case 2: Speech Recognition in Noisy Environments

```
Recognition accuracy degradation by environment noise:

| Environment | SNR (dB) | WER Increase | Solution |
|------|----------|----------|------|
| Quiet office | 30+ | +0% | No action needed |
| Cafe | 15-20 | +5-10% | Beamforming |
| In-car (driving) | 10-15 | +10-20% | Noise cancellation |
| Construction site | 0-5 | +30-50% | Close-talk mic required |
| Music playing | 5-10 | +20-30% | AEC (Acoustic Echo Cancellation) |

Technical solutions:
1. AEC (Acoustic Echo Cancellation)
   → Remove music/response audio playing from speakers
2. Beamforming
   → Enhance sound from speaker direction using multiple microphones
3. RNNoise / DeepFilterNet
   → AI-based real-time noise removal
4. VAD (Voice Activity Detection)
   → Send only segments with human voice to ASR
```

---

## 10. Developer Checklist

```
Voice Assistant Development Checklist:

□ Speech Recognition (ASR)
  □ Select Whisper / Google STT / Azure Speech
  □ Implement streaming recognition
  □ Configure language/dialect settings
  □ Test noise resilience

□ Natural Language Understanding (NLU)
  □ Design intent classification
  □ Define slots/entities
  □ LLM vs rule-based routing
  □ Implement context management

□ Response Generation
  □ Select LLM (cloud vs local)
  □ Design Function Calling
  □ Implement safety filters
  □ Set response length limits

□ Text-to-Speech (TTS)
  □ Select TTS engine
  □ Verify Japanese naturalness
  □ Implement streaming TTS

□ Performance
  □ End-to-end latency < 2 seconds
  □ Wake word false detection rate < 1%
  □ ASR accuracy testing
  □ Measure battery impact

□ Privacy
  □ Voice data retention policy
  □ Implement user consent flow
  □ Provide data deletion capability
```


---

## Hands-On Exercises

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
        """Get processing results"""
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

Extend the basic implementation to add the following features.

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
    """Efficient search using hash map"""
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
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## FAQ

### Q1: What changed about Siri with ChatGPT?

**A:** With Apple Intelligence, Siri can understand on-screen context and perform cross-app operations. For example, it can handle compound tasks like "Attach the photo my friend sent yesterday to an email." Complex questions are offloaded to ChatGPT, but user permission is requested each time, protecting privacy.

### Q2: How can I improve voice assistant response speed?

**A:** The three main improvement points are:
1. **On-device wake word detection** — Zero network latency for activation
2. **Streaming ASR** — Start recognition before speech completes
3. **Speculative execution** — When NLU detects a high-confidence intent, begin API calls before ASR finishes

### Q3: How do I build my own voice assistant?

**A:** The minimum configuration is as follows:
1. **Speech Recognition**: Whisper (local) or Google Speech-to-Text (cloud)
2. **Dialog Management**: Ollama + local LLM or OpenAI API
3. **Text-to-Speech**: pyttsx3 (local), VOICEVOX (high-quality Japanese), or OpenAI TTS
4. **Integration**: Build the pipeline in Python (see Code Example 5)

### Q4: Which is easier to get started with, Alexa Skills or Google Actions development?

**A:** Alexa Skills Kit is more suitable for beginners. Reasons: 1) Documentation is comprehensive, 2) Integration with AWS Lambda is straightforward, 3) The free tier is generous. On the other hand, Google Actions makes it easier to design complex dialogs through Dialogflow integration and has stronger multilingual support. Both are available in the Japanese market, but Alexa has a larger skill store ecosystem.

### Q5: How well is privacy protected with a local voice assistant?

**A:** With a fully local setup (Whisper + Ollama + Piper), no voice data is ever sent externally. It operates without an internet connection, so the risk of eavesdropping or data leakage is zero. However, local LLM quality is inferior to cloud LLMs (GPT-4, Gemini), so you need to consider the trade-off between accuracy and privacy. Q4-quantized versions of Gemma 9B and Llama 3.1 8B offer sufficiently practical quality for everyday conversation.

---

## Summary

| Item | Key Points |
|------|---------|
| Pipeline | Wake Word → ASR → NLU → Dialog → Action → TTS |
| LLM Integration | LLM handles complex questions and multi-step tasks |
| On-Device | Run Wake Word/ASR locally for privacy and low latency |
| Major Platforms | Siri (Apple Intelligence), Google (Gemini), Alexa (Bedrock) |
| Development Methods | App Intents / Actions SDK / Alexa Skills Kit |
| Function Calling | Design pattern where LLM automatically selects and executes appropriate APIs |
| Hybrid Routing | Simple commands via rules, complex questions via LLM |
| Future Outlook | Multimodal conversation, proactive assistants |

---

## Recommended Next Reads

- [Wearables — Apple Watch / Galaxy Watch](./03-wearables.md)
- Voice AI Overview — TTS/STT/Music Generation
- Voice Cloning — ElevenLabs, RVC

---

## References

1. **Apple** — "Introducing Apple Intelligence," apple.com, 2024
2. **Google** — "Gemini in Google Assistant," blog.google, 2024
3. **Amazon** — "Alexa LLM and Conversational AI," developer.amazon.com, 2024
4. **Radford, A. et al.** — "Robust Speech Recognition via Large-Scale Weak Supervision (Whisper)," arXiv:2212.04356, 2022
5. **Home Assistant** — "Wyoming Protocol for Voice," home-assistant.io, 2024
6. **OpenAI** — "Function Calling Guide," platform.openai.com, 2024
