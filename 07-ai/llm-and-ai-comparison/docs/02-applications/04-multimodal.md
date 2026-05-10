# Multimodal — Image, Audio, and Video Input with Vision APIs

> Multimodal AI is a technology that integrates multiple information modalities such as text, images, audio, and video, and represents the latest evolution of LLMs capable of understanding and generating diverse real-world inputs.

## What You Will Learn

1. **How Multimodal LLMs Work and Their Capabilities** — Processing architectures for Vision, Audio, and Video
2. **Practical Image Input Applications** — OCR, chart analysis, UI understanding, image classification
3. **Audio and Video Processing** — Speech transcription, video summarization, real-time processing
4. **Multimodal RAG and Embeddings** — CLIP, image search, cross-modal applications
5. **Production Patterns and Cost Optimization** — Image preprocessing, batch processing, quality assurance


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Embeddings — Vector Representations, Similarity Search, and Clustering](./03-embeddings.md)

---

## 1. Overview of Multimodal LLMs

```
┌──────────────────────────────────────────────────────────┐
│          Multimodal LLM Architecture                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Input Modalities    Encoders          Language Model    │
│                                                          │
│  ┌──────┐          ┌──────────┐                         │
│  │Image │ ──────▶ │ Vision   │                         │
│  └──────┘          │ Encoder  │──┐                      │
│                    │ (ViT)    │  │                      │
│  ┌──────┐          └──────────┘  │  ┌──────────────┐   │
│  │Audio │ ──────▶ ┌──────────┐  ├─▶│  Transformer  │   │
│  └──────┘          │ Audio    │  │  │  Decoder     │   │
│                    │ Encoder  │──┤  │  (LLM Core)  │   │
│  ┌──────┐          │(Whisper) │  │  └──────┬───────┘   │
│  │Video │ ──────▶ └──────────┘  │         │           │
│  └──────┘          ┌──────────┐  │         ▼           │
│  (Frame Extraction)│ Video    │──┘  Text Output        │
│                    │ Encoder  │      Image Generation   │
│  ┌──────┐          └──────────┘      Audio Generation   │
│  │Text  │ ──────────────────────┘                     │
│  └──────┘                                              │
│                                                          │
│  Fusion Methods:                                         │
│  A) Early Fusion: Integration at input stage (Gemini)    │
│  B) Late Fusion: Integration after each encoder (GPT-4V) │
│  C) Cross-Attention: Fusion at LLM layer (Flamingo)      │
└──────────────────────────────────────────────────────────┘
```

### 1.1 Multimodal Support by Provider

| Modality | GPT-4o | Claude 3.5/4 | Gemini 2.0 | Qwen-VL | Llama 3.2 |
|-----------|--------|-------------|-----------|---------|----------|
| Image Input | S | S | S | S | S (11B+) |
| Image Generation | S | N/A | S | N/A | N/A |
| Audio Input | S | N/A | S | S (Audio) | N/A |
| Audio Output | S | N/A | S | N/A | N/A |
| Video Input | N/A | N/A | S | N/A | N/A |
| PDF Input | Via image | Native | Native | N/A | N/A |

*S=Supported, N/A=Not Supported*

### 1.2 Token Consumption by Modality

```
┌─────────────────────────────────────────────────────────────────┐
│              Estimated Token Consumption by Modality            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Text                                                           │
│  └── English: approximately 1 word = 1-3 tokens                 │
│                                                                 │
│  Image (GPT-4o)                                                 │
│  ├── low detail: 85 tokens (fixed)                              │
│  ├── high detail: 85 + 170 * number of tiles                    │
│  │   └── 512x512 = 255 tokens                                   │
│  │   └── 1024x1024 = 765 tokens                                 │
│  │   └── 2048x2048 = 1,105 tokens                               │
│  └── auto: model selects automatically                          │
│                                                                 │
│  Image (Claude)                                                 │
│  ├── ~1,600 tokens/image (nearly fixed regardless of size)      │
│  └── Maximum resolution: 1,568 x 1,568 px                       │
│                                                                 │
│  Image (Gemini)                                                 │
│  ├── 258 tokens/image (nearly fixed)                            │
│  └── Up to 3,600 images per request                             │
│                                                                 │
│  Audio (Whisper)                                                │
│  └── Input: billed per minute ($0.006/min)                      │
│                                                                 │
│  Video (Gemini)                                                 │
│  └── Approximately 1,000 tokens per second                      │
│  └── 1 minute of video ≈ 60,000 tokens                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Image Input in Practice

### 2.1 OpenAI Vision API

```python
from openai import OpenAI
import base64

client = OpenAI()

# Method 1: URL specification
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Please describe the contents of this image in detail."},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "https://example.com/image.jpg",
                        "detail": "high",  # low / auto / high
                    },
                },
            ],
        }
    ],
    max_tokens=1024,
)
print(response.choices[0].message.content)

# Method 2: Base64 encoding (local image)
def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

image_b64 = encode_image("screenshot.png")
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Please point out areas for improvement in this screenshot's UI."},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{image_b64}",
                    },
                },
            ],
        }
    ],
)
```

### 2.2 Claude Vision

```python
from anthropic import Anthropic
import base64

client = Anthropic()

with open("diagram.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_data,
                    },
                },
                {
                    "type": "text",
                    "text": "Please explain this architecture diagram and identify any bottlenecks.",
                },
            ],
        }
    ],
)
print(response.content[0].text)
```

### 2.3 Claude Direct PDF Input

```python
from anthropic import Anthropic
import base64

client = Anthropic()

# Claude can process PDFs directly
with open("report.pdf", "rb") as f:
    pdf_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_data,
                    },
                },
                {
                    "type": "text",
                    "text": """Analyze this PDF report and extract the following:
1. Executive summary
2. Key numerical data (in table format)
3. Conclusions and recommendations
4. Risk factors""",
                },
            ],
        }
    ],
)
```

### 2.4 Gemini Multimodal

```python
import google.generativeai as genai
from pathlib import Path

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-2.0-flash")

# Image + text
image = genai.upload_file(Path("chart.png"))
response = model.generate_content([
    image,
    "Analyze the trend in this graph and make a prediction for next month.",
])
print(response.text)

# Batch processing of multiple images (a Gemini strength)
images = [genai.upload_file(Path(f"slide_{i}.png")) for i in range(1, 21)]
response = model.generate_content([
    *images,
    "Summarize the content of these 20 slides. List the key points of each slide as bullet points.",
])
```

---

## 3. Practical Image Usage Patterns

### 3.1 OCR + Structured Extraction

```python
import json
from openai import OpenAI

client = OpenAI()

async def extract_receipt(image_path: str) -> dict:
    """Extract structured data from a receipt image"""
    image_b64 = encode_image(image_path)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                    {
                        "type": "text",
                        "text": """
Extract the following information from this receipt image in JSON format:
{
  "store_name": "store name",
  "date": "YYYY-MM-DD",
  "items": [{"name": "item name", "quantity": quantity, "price": price}],
  "subtotal": subtotal,
  "tax": tax,
  "total": total
}
""",
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


async def extract_business_card(image_path: str) -> dict:
    """Extract structured data from a business card image"""
    image_b64 = encode_image(image_path)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                    {
                        "type": "text",
                        "text": """Extract the following information from this business card in JSON format.
Set unreadable fields to null:
{
  "company_name": "company name",
  "department": "department",
  "title": "job title",
  "name": "full name",
  "name_reading": "phonetic reading",
  "email": "email address",
  "phone": "phone number",
  "mobile": "mobile number",
  "address": "address",
  "website": "URL"
}""",
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
```

### 3.2 Comparative Analysis of Multiple Images

```python
def compare_images(image_paths: list[str], comparison_prompt: str) -> str:
    """Comparative analysis of multiple images"""
    content = []

    for i, path in enumerate(image_paths):
        content.append({
            "type": "text",
            "text": f"Image {i+1}:",
        })
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{encode_image(path)}"},
        })

    content.append({"type": "text", "text": comparison_prompt})

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
    )
    return response.choices[0].message.content

# Usage example: before/after UI comparison
result = compare_images(
    ["design_v1.png", "design_v2.png"],
    "Compare the two UI designs and analyze the improvements in v2 and any remaining issues."
)
```

### 3.3 Chart and Graph Analysis

```python
async def analyze_chart(image_path: str) -> dict:
    """Detailed analysis of graphs and charts"""
    image_b64 = encode_image(image_path)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_b64}",
                            "detail": "high",  # high resolution recommended for graphs
                        },
                    },
                    {
                        "type": "text",
                        "text": """Analyze this graph/chart in detail.
Please return the following in JSON format:
{
  "chart_type": "type of chart (bar chart, line chart, etc.)",
  "title": "title",
  "x_axis": "X-axis label",
  "y_axis": "Y-axis label",
  "data_points": [{"label": "label", "value": numeric_value}],
  "trend": "description of overall trend",
  "key_findings": ["key finding 1", "key finding 2"],
  "anomalies": ["anomalies or noteworthy points"]
}""",
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
```

### 3.4 UI/UX Analysis

```python
async def analyze_ui(screenshot_path: str) -> dict:
    """Analysis of UI screenshots"""
    image_b64 = encode_image(screenshot_path)

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a UI/UX expert. Please analyze the UI from the perspective of heuristic evaluation.",
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"},
                    },
                    {
                        "type": "text",
                        "text": """Evaluate this UI on the following criteria (each out of 5 points):

1. Visibility of system status
2. Consistency and standards
3. Error prevention
4. Flexibility and efficiency
5. Aesthetic and minimalist design
6. Accessibility

Please return the score and improvement suggestions for each criterion in JSON format.""",
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)
```

### 3.5 Image Classification Pipeline

```python
from enum import Enum

class ContentCategory(Enum):
    DOCUMENT = "document"       # documents/text
    CHART = "chart"             # graphs/charts
    PHOTO = "photo"             # photographs
    SCREENSHOT = "screenshot"   # screenshots
    DIAGRAM = "diagram"         # diagrams/flowcharts
    HANDWRITING = "handwriting" # handwriting
    OTHER = "other"

async def classify_and_process(image_path: str) -> dict:
    """Classify an image and execute processing based on its type"""

    # Step 1: Classify the image type
    image_b64 = encode_image(image_path)
    classification = await client.chat.completions.create(
        model="gpt-4o-mini",  # a lightweight model is sufficient for classification
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "low"}},
                {"type": "text", "text": f"Choose one type that describes this image from the following: {[e.value for e in ContentCategory]}"},
            ],
        }],
    )

    category = classification.choices[0].message.content.strip().lower()

    # Step 2: Process based on category
    processors = {
        "document": extract_document_text,
        "chart": analyze_chart,
        "photo": describe_photo,
        "screenshot": analyze_ui,
        "diagram": analyze_diagram,
        "handwriting": extract_handwriting,
    }

    processor = processors.get(category, describe_photo)
    result = await processor(image_path)

    return {
        "category": category,
        "analysis": result,
    }
```

---

## 4. Audio Processing

### 4.1 Whisper (Audio to Text)

```python
from openai import OpenAI

client = OpenAI()

# Basic audio transcription
with open("meeting.mp3", "rb") as audio_file:
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="ja",
        response_format="verbose_json",  # with timestamps
    )

for segment in transcript.segments:
    start = segment["start"]
    end = segment["end"]
    text = segment["text"]
    print(f"[{start:.1f}s - {end:.1f}s] {text}")
```

### 4.2 Split Processing for Long Audio

```python
from pydub import AudioSegment
import tempfile
import os

async def transcribe_long_audio(
    audio_path: str,
    chunk_duration_ms: int = 10 * 60 * 1000,  # split every 10 minutes
    overlap_ms: int = 5000,  # 5-second overlap
) -> list[dict]:
    """Split transcription for long audio"""

    audio = AudioSegment.from_file(audio_path)
    total_duration = len(audio)
    chunks = []

    start = 0
    while start < total_duration:
        end = min(start + chunk_duration_ms, total_duration)
        chunk = audio[start:end]

        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            chunk.export(tmp.name, format="mp3")
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as f:
                result = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    language="ja",
                    response_format="verbose_json",
                )

            # Adjust timestamps with offset
            for segment in result.segments:
                segment["start"] += start / 1000
                segment["end"] += start / 1000

            chunks.append({
                "start_time": start / 1000,
                "end_time": end / 1000,
                "segments": result.segments,
                "text": result.text,
            })
        finally:
            os.unlink(tmp_path)

        start = end - overlap_ms  # move to next chunk with overlap

    return chunks


async def transcribe_with_speaker_diarization(audio_path: str) -> list[dict]:
    """Transcription with speaker diarization"""

    # Step 1: Transcribe with Whisper
    with open(audio_path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language="ja",
            response_format="verbose_json",
        )

    # Step 2: Speaker diarization with LLM (simple approach)
    full_text = transcript.text
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": f"""Please perform speaker diarization on the following conversation text.
Estimate where speakers change and return in the following format:

Speaker A: ...
Speaker B: ...
Speaker A: ...

Text:
{full_text}""",
        }],
    )

    return response.choices[0].message.content
```

### 4.3 GPT-4o Real-Time Audio

```python
# GPT-4o Realtime API (WebSocket)
import asyncio
import websockets
import json

async def realtime_voice_chat():
    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    async with websockets.connect(url, extra_headers=headers) as ws:
        # Session configuration
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": "You are a conversational assistant.",
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
            },
        }))

        # Loop for sending and receiving audio data
        # (microphone input and speaker output handling required in practice)
```

### 4.4 Text to Audio (TTS)

```python
from openai import OpenAI
from pathlib import Path

client = OpenAI()

# Basic audio generation
response = client.audio.speech.create(
    model="tts-1-hd",     # tts-1 (lower quality/cost) or tts-1-hd (high quality)
    voice="nova",          # alloy, echo, fable, onyx, nova, shimmer
    input="Hello. Let us begin today's presentation.",
    speed=1.0,             # 0.25 - 4.0
)

# Save to file
speech_file = Path("output.mp3")
response.stream_to_file(speech_file)

# Streaming playback
response = client.audio.speech.create(
    model="tts-1",
    voice="alloy",
    input="Generating audio via streaming.",
)

# Receive audio data in chunks
with open("stream_output.mp3", "wb") as f:
    for chunk in response.iter_bytes(chunk_size=1024):
        f.write(chunk)
```

### 4.5 Audio Application: Automatic Meeting Minutes Generation

```python
async def generate_meeting_minutes(audio_path: str) -> dict:
    """Automatically generate meeting minutes from audio"""

    # Step 1: Transcription
    with open(audio_path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language="ja",
            response_format="verbose_json",
        )

    # Step 2: Generate meeting minutes with LLM
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are an expert at creating meeting minutes. Please create structured meeting minutes from a meeting transcript.",
            },
            {
                "role": "user",
                "content": f"""Please create meeting minutes from the following meeting transcript.

Transcript:
{transcript.text}

Please output in the following JSON format:
{{
  "meeting_title": "meeting title (estimated)",
  "date": "date (estimated)",
  "participants": ["participants (estimated)"],
  "agenda": ["agenda item 1", "agenda item 2"],
  "discussion_points": [
    {{
      "topic": "topic",
      "key_points": ["key point 1", "key point 2"],
      "decisions": ["decisions made"],
      "action_items": [
        {{
          "task": "task description",
          "assignee": "responsible person (estimated)",
          "deadline": "deadline (estimated)"
        }}
      ]
    }}
  ],
  "next_steps": ["next steps"]
}}""",
            },
        ],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)
```

---

## 5. Video Processing

### 5.1 Gemini Video Input and Analysis

```python
import google.generativeai as genai
import time

genai.configure(api_key="YOUR_API_KEY")

# Upload video
video_file = genai.upload_file("presentation.mp4")

# Wait until upload is complete
while video_file.state.name == "PROCESSING":
    time.sleep(5)
    video_file = genai.get_file(video_file.name)

# Analyze video
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content([
    video_file,
    """
Analyze this video and report the following:
1. Video overview (summary within 30 seconds)
2. Main topics (with timestamps)
3. Summary of presenter's arguments
4. Improvement suggestions
""",
])
print(response.text)
```

### 5.2 Pseudo-Video Analysis via Frame Extraction

```python
import cv2
import base64
from openai import OpenAI

client = OpenAI()

def extract_frames(video_path: str, fps: float = 1.0) -> list[str]:
    """Extract frames from a video and Base64 encode them"""
    cap = cv2.VideoCapture(video_path)
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = int(video_fps / fps)

    frames = []
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            # Resize frame
            frame = cv2.resize(frame, (512, 512))
            _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            b64 = base64.b64encode(buffer).decode("utf-8")
            frames.append(b64)

        frame_count += 1

    cap.release()
    return frames


async def analyze_video_with_frames(
    video_path: str,
    prompt: str,
    fps: float = 0.5,  # 0.5fps = 1 frame every 2 seconds
    max_frames: int = 20,
) -> str:
    """Video analysis using frame extraction + Vision API"""

    frames = extract_frames(video_path, fps=fps)[:max_frames]

    content = [{"type": "text", "text": f"The following are frames extracted from the video at {fps}fps.\n\n{prompt}"}]

    for i, frame in enumerate(frames):
        timestamp = i / fps
        content.append({"type": "text", "text": f"[{timestamp:.1f}s]:"})
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{frame}", "detail": "low"},
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=2048,
    )

    return response.choices[0].message.content
```

```
┌──────────────────────────────────────────────────────────┐
│          Video Processing Architecture                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Video File                                              │
│    │                                                     │
│    ├──▶ Frame Extraction (1fps, etc.)                    │
│    │     └──▶ Vision Encoder ──┐                         │
│    │                           │                         │
│    ├──▶ Audio Track Separation │     ┌──────────────┐   │
│    │     └──▶ Audio Encoder ──┼──▶ │  LLM Integration│  │
│    │                           │     │  (Gemini)     │   │
│    └──▶ Subtitles/Metadata ───┘     └──────┬───────┘   │
│                                              │           │
│                                        Text Output       │
│                                                          │
│  Constraints:                                            │
│  - Gemini: up to 1 hour of video                         │
│  - Frame count and token count are proportional          │
│  - 1 minute of video ≈ thousands to tens of thousands    │
│    of tokens consumed                                    │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Multimodal Embeddings

### 6.1 CLIP-Based Image-Text Embeddings

```python
# CLIP-based multimodal embeddings
from sentence_transformers import SentenceTransformer
from PIL import Image

model = SentenceTransformer("clip-ViT-B-32")

# Embed text and images into the same vector space
text_embeddings = model.encode(["photo of a cat", "Tokyo Tower", "programming"])
image_embedding = model.encode(Image.open("cat.jpg"))

# Cross-modal search between text and images is possible
from sentence_transformers.util import cos_sim
similarities = cos_sim(image_embedding, text_embeddings)
print(similarities)  # "photo of a cat" should have the highest score
```

### 6.2 Multimodal RAG

```python
from dataclasses import dataclass

@dataclass
class MultimodalDocument:
    text: str
    image_path: str | None = None
    image_description: str | None = None
    source: str = ""

class MultimodalRAG:
    """RAG system integrating images and text"""

    def __init__(self, text_embedder, image_embedder, qdrant_client):
        self.text_embedder = text_embedder
        self.image_embedder = image_embedder
        self.qdrant = qdrant_client

    async def index_document(self, doc: MultimodalDocument):
        """Index a multimodal document"""

        # Text embedding
        text_vector = self.text_embedder.encode(doc.text)

        # If an image is present, also embed the image description
        if doc.image_path:
            # Generate a detailed description of the image with VLM
            description = await self._describe_image(doc.image_path)
            doc.image_description = description

            # Add image description to text and re-embed
            combined_text = f"{doc.text}\n\n[Image Description]: {description}"
            text_vector = self.text_embedder.encode(combined_text)

        # Save to vector DB
        self.qdrant.upsert(
            collection_name="multimodal_docs",
            points=[PointStruct(
                id=doc.source,
                vector=text_vector.tolist(),
                payload={
                    "text": doc.text,
                    "image_path": doc.image_path,
                    "image_description": doc.image_description,
                    "source": doc.source,
                },
            )],
        )

    async def query(self, query: str, image_path: str | None = None) -> dict:
        """Multimodal query"""

        # Embed the text query
        query_vector = self.text_embedder.encode(query)

        # Integrate if an image query is present
        if image_path:
            image_description = await self._describe_image(image_path)
            combined_query = f"{query}\n\n[Image Description]: {image_description}"
            query_vector = self.text_embedder.encode(combined_query)

        # Search
        results = self.qdrant.search(
            collection_name="multimodal_docs",
            query_vector=query_vector.tolist(),
            limit=5,
        )

        # Generate answer (including image context)
        context_parts = []
        for r in results:
            ctx = r.payload["text"]
            if r.payload.get("image_description"):
                ctx += f"\n[Related Image]: {r.payload['image_description']}"
            context_parts.append(ctx)

        context = "\n\n---\n\n".join(context_parts)

        answer = await self._generate_answer(query, context, image_path)
        return {"answer": answer, "sources": results}

    async def _describe_image(self, image_path: str) -> str:
        """Generate an image description with VLM"""
        image_b64 = encode_image(image_path)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "low"}},
                    {"type": "text", "text": "Please describe the contents of this image in detail. Include all text, numbers, and graph data."},
                ],
            }],
        )
        return response.choices[0].message.content
```

### 6.3 Image Search System

```python
import numpy as np
from PIL import Image

class ImageSearchEngine:
    """Search engine for text-to-image and image-to-image search"""

    def __init__(self):
        self.clip_model = SentenceTransformer("clip-ViT-L-14")
        self.image_vectors = []
        self.image_metadata = []

    def index_images(self, image_paths: list[str]):
        """Batch index images"""
        for path in image_paths:
            try:
                img = Image.open(path)
                vector = self.clip_model.encode(img)
                self.image_vectors.append(vector)
                self.image_metadata.append({
                    "path": path,
                    "size": img.size,
                    "format": img.format,
                })
            except Exception as e:
                print(f"Failed to index {path}: {e}")

    def search_by_text(self, query: str, top_k: int = 5) -> list[dict]:
        """Search for images by text"""
        query_vector = self.clip_model.encode(query)

        vectors = np.array(self.image_vectors)
        similarities = cos_sim(query_vector, vectors)[0]

        top_indices = np.argsort(-similarities)[:top_k]

        return [
            {**self.image_metadata[i], "score": float(similarities[i])}
            for i in top_indices
        ]

    def search_by_image(self, image_path: str, top_k: int = 5) -> list[dict]:
        """Search for similar images by image"""
        query_img = Image.open(image_path)
        query_vector = self.clip_model.encode(query_img)

        vectors = np.array(self.image_vectors)
        similarities = cos_sim(query_vector, vectors)[0]

        top_indices = np.argsort(-similarities)[:top_k]

        return [
            {**self.image_metadata[i], "score": float(similarities[i])}
            for i in top_indices
        ]

# Usage example
engine = ImageSearchEngine()
engine.index_images(glob.glob("products/*.jpg"))

# Search for images by text
results = engine.search_by_text("red sneakers")

# Search for similar images
results = engine.search_by_image("reference_shoe.jpg")
```

---

## 7. Image Preprocessing and Optimization

### 7.1 Image Preprocessing for Cost Optimization

```python
from PIL import Image, ImageEnhance, ImageFilter
import io
import base64

class ImageOptimizer:
    """Image optimization for multimodal APIs"""

    @staticmethod
    def optimize_for_api(
        image_path: str,
        max_size: int = 1024,
        quality: int = 85,
        target_format: str = "JPEG",
    ) -> str:
        """Optimize image for API submission and return as Base64"""

        img = Image.open(image_path)

        # 1. Convert RGBA to RGB (JPEG does not support transparency)
        if img.mode == "RGBA":
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background

        # 2. Resize (maintaining aspect ratio)
        img.thumbnail((max_size, max_size), Image.LANCZOS)

        # 3. Compress and Base64 encode
        buffer = io.BytesIO()
        img.save(buffer, format=target_format, quality=quality, optimize=True)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    @staticmethod
    def enhance_for_ocr(image_path: str) -> str:
        """Image enhancement to improve OCR accuracy"""

        img = Image.open(image_path)

        # 1. Convert to grayscale
        img = img.convert("L")

        # 2. Enhance contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)

        # 3. Enhance sharpness
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(2.0)

        # 4. Noise reduction
        img = img.filter(ImageFilter.MedianFilter(size=3))

        # 5. Binarization (threshold processing)
        import numpy as np
        arr = np.array(img)
        threshold = 128
        arr = ((arr > threshold) * 255).astype(np.uint8)
        img = Image.fromarray(arr)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    @staticmethod
    def estimate_cost(image_path: str, provider: str = "openai", detail: str = "auto") -> dict:
        """Estimate token cost for image processing"""
        img = Image.open(image_path)
        w, h = img.size

        if provider == "openai":
            if detail == "low":
                tokens = 85
            else:
                # high detail: calculate number of tiles
                max_dim = max(w, h)
                if max_dim > 2048:
                    scale = 2048 / max_dim
                    w, h = int(w * scale), int(h * scale)

                min_dim = min(w, h)
                if min_dim > 768:
                    scale = 768 / min_dim
                    w, h = int(w * scale), int(h * scale)

                tiles_w = (w + 511) // 512
                tiles_h = (h + 511) // 512
                tokens = 85 + 170 * tiles_w * tiles_h

        elif provider == "anthropic":
            tokens = 1600

        elif provider == "gemini":
            tokens = 258

        return {
            "provider": provider,
            "original_size": img.size,
            "estimated_tokens": tokens,
            "estimated_cost_usd": tokens * 0.005 / 1000,  # GPT-4o input rate
        }
```

### 7.2 Batch Image Processing

```python
import asyncio
from typing import Any

async def batch_process_images(
    image_paths: list[str],
    prompt: str,
    model: str = "gpt-4o-mini",
    max_concurrent: int = 5,
    detail: str = "low",
) -> list[dict]:
    """Batch processing of large numbers of images"""

    semaphore = asyncio.Semaphore(max_concurrent)
    results = [None] * len(image_paths)

    async def process_one(index: int, path: str):
        async with semaphore:
            try:
                image_b64 = ImageOptimizer.optimize_for_api(path, max_size=512)

                response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=model,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}",
                                "detail": detail,
                            }},
                            {"type": "text", "text": prompt},
                        ],
                    }],
                    max_tokens=512,
                )

                results[index] = {
                    "path": path,
                    "result": response.choices[0].message.content,
                    "status": "success",
                }
            except Exception as e:
                results[index] = {
                    "path": path,
                    "error": str(e),
                    "status": "error",
                }

    tasks = [process_one(i, path) for i, path in enumerate(image_paths)]
    await asyncio.gather(*tasks)

    return results

# Usage example: classify 1000 product images
import glob
image_files = glob.glob("products/**/*.jpg", recursive=True)
results = await batch_process_images(
    image_files,
    prompt="Please choose one category for this product: clothing, electronics, food, furniture, other",
    model="gpt-4o-mini",
    max_concurrent=10,
    detail="low",
)
```

---

## 8. Comparison Tables

### 8.1 Multimodal Model Performance Comparison

| Benchmark | GPT-4o | Claude 3.5 | Gemini 1.5 Pro | Qwen-VL-Max |
|-------------|--------|-----------|---------------|-------------|
| MMMU (Multimodal Understanding) | 69.1 | 68.3 | 62.2 | 51.4 |
| MathVista (Math + Vision) | 63.8 | 61.6 | 58.0 | 51.0 |
| ChartQA (Chart Understanding) | 85.7 | 90.8 | 81.3 | 79.8 |
| DocVQA (Document Understanding) | 92.8 | 95.2 | 93.1 | 93.8 |
| TextVQA (Text in Images) | 77.4 | - | 73.5 | 79.5 |

### 8.2 Image Processing Cost Comparison

| Model | Low Resolution | High Resolution | Max Images |
|--------|---------|---------|-----------|
| GPT-4o | 85 tokens | ~1,105 tokens | No limit |
| Claude 3.5 | ~1,600 tokens | ~1,600 tokens | 20 images |
| Gemini 1.5 | 258 tokens | 258 tokens | 3,600 images |

### 8.3 Recommended Models by Use Case

| Use Case | Recommended Model | Reason |
|-------------|-----------|------|
| OCR (Documents) | Claude 3.5 | Highest DocVQA score |
| Chart Analysis | Claude 3.5 | Highest ChartQA score |
| High-Volume Image Processing | Gemini | Low cost, handles large image counts |
| UI Analysis | GPT-4o | High versatility |
| Video Analysis | Gemini | Native video support |
| Real-Time Dialogue | GPT-4o | Realtime API support |
| PDF Analysis | Claude 3.5 | Direct PDF input support |
| Image Generation | GPT-4o / Gemini | Native image generation |

---

## 9. Real-World Use Cases

### 9.1 Manufacturing: Automated Quality Inspection

```python
class QualityInspector:
    """Quality inspection of product images"""

    def __init__(self, reference_images: list[str]):
        self.reference_images = reference_images
        self.defect_categories = [
            "scratch",
            "dent",
            "discoloration",
            "misalignment",
            "contamination",
            "none",         # no defect
        ]

    async def inspect(self, product_image: str) -> dict:
        """Quality inspection of a product image"""

        content = [
            {"type": "text", "text": "Reference images (normal products):"},
        ]

        # Attach reference images of normal products
        for ref_path in self.reference_images[:3]:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encode_image(ref_path)}", "detail": "high"},
            })

        content.append({"type": "text", "text": "\nInspection target image:"})
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encode_image(product_image)}", "detail": "high"},
        })

        content.append({
            "type": "text",
            "text": f"""Compare the reference images and the inspection target image and evaluate the quality.

Please return in JSON format:
{{
  "judgment": "pass" or "fail",
  "confidence": 0.0-1.0,
  "defects": [
    {{
      "category": "one of {self.defect_categories}",
      "severity": "minor" or "major" or "critical",
      "location": "description of the defect location",
      "description": "details of the defect"
    }}
  ],
  "overall_quality_score": 0-100
}}""",
        })

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": content}],
            response_format={"type": "json_object"},
        )

        return json.loads(response.choices[0].message.content)
```

### 9.2 Real Estate: Property Image Analysis

```python
async def analyze_property(images: list[str]) -> dict:
    """Image analysis of real estate properties"""

    content = []
    for i, path in enumerate(images):
        content.append({"type": "text", "text": f"Image {i+1}:"})
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encode_image(path)}", "detail": "high"},
        })

    content.append({
        "type": "text",
        "text": """Please analyze the following from these property images:

Please return in JSON format:
{
  "property_type": "apartment/house/office, etc.",
  "rooms": [
    {
      "type": "room type (living room, kitchen, bedroom, etc.)",
      "estimated_size": "estimated size (in tatami mats)",
      "condition": "condition (good/fair/needs repair)",
      "features": ["feature 1", "feature 2"]
    }
  ],
  "overall_condition": "overall condition of the property",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"],
  "estimated_age": "estimated age of the building",
  "renovation_suggestions": ["renovation suggestion 1", "renovation suggestion 2"]
}""",
    })

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)
```

---

## 10. Anti-Patterns and Best Practices

### Anti-Pattern 1: Sending unnecessarily high-resolution images

```python
# Bad: Send a 4K image as-is → high token consumption, increased cost
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {
                "url": f"data:image/png;base64,{huge_4k_image}",
                "detail": "high",
            }},
            {"type": "text", "text": "What is in this image?"},
        ],
    }],
)

# Good: Choose resolution appropriate for the task
optimized = ImageOptimizer.optimize_for_api("photo.jpg", max_size=1024)

# Low detail is sufficient for simple questions
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {
                "url": f"data:image/jpeg;base64,{optimized}",
                "detail": "low",  # fixed at 85 tokens
            }},
            {"type": "text", "text": "What is in this image?"},
        ],
    }],
)
```

### Anti-Pattern 2: Using image hallucinations without verification

```python
# Bad: Use OCR results without verification
receipt_data = extract_receipt(image)
process_payment(receipt_data["total"])  # the amount could be wrong

# Good: Add a verification step for important numbers
receipt_data = extract_receipt(image)
# Cross-check with a second extraction (Self-Consistency)
receipt_data_2 = extract_receipt(image)

if receipt_data["total"] != receipt_data_2["total"]:
    # If there is a discrepancy, flag for human review
    flag_for_human_review(receipt_data, receipt_data_2)
```

### Anti-Pattern 3: Inappropriate image format selection

```python
# Bad: Send screenshots as JPEG (text areas become blurry)
img.save("screenshot.jpg", quality=50)

# Good: Use PNG for images with text, JPEG for photos
def choose_format(image_path: str, content_type: str) -> str:
    """Choose format based on content type"""
    if content_type in ["screenshot", "document", "diagram", "chart"]:
        return "PNG"    # lossless for text/line art
    elif content_type in ["photo", "product"]:
        return "JPEG"   # photos can be compressed
    return "PNG"        # default to PNG
```

### Anti-Pattern 4: Sending too many images in a single request

```python
# Bad: Send 100 images in one request
# → context length exceeded, increased latency, cost explosion

# Good: Split into batches + parallel processing
async def process_in_batches(images: list[str], batch_size: int = 5):
    results = []
    for i in range(0, len(images), batch_size):
        batch = images[i:i + batch_size]
        batch_results = await asyncio.gather(
            *[process_single_image(img) for img in batch]
        )
        results.extend(batch_results)
    return results
```

---

## 11. FAQ

### Q1: How is the token cost of image input calculated?

GPT-4o: low detail = fixed at 85 tokens, high detail = depends on tile size (170 tokens per 512x512 tile + base 85 tokens).
Claude: approximately 1,600 tokens depending on image size.
Gemini: approximately 258 tokens/image (nearly fixed).
For cost optimization, start with low detail and upgrade to high detail if accuracy is insufficient.

### Q2: Is Gemini the only model that can analyze video?

As of 2025, only Gemini supports native video input.
GPT-4o / Claude can pseudo-support it by extracting frames (1-2fps) and inputting individual images.
However, simultaneous processing of the audio track is only possible with Gemini.

### Q3: How does the accuracy of multimodal AI compare to text-only models?

For text tasks, it is nearly equivalent to text-only models.
For combined image+text tasks, multimodal models have a decisive advantage.
However, reading fine text within images (small characters) and complex diagrams may be inferior to dedicated OCR tools.

### Q4: What are the key points when building multimodal RAG?

(1) It is more practical to convert images into descriptions with a VLM and then use text embeddings, rather than directly vectorizing images. (2) When directly vectorizing images with CLIP, a gap tends to occur with text queries, so it should be used in combination with text-based search. (3) Search accuracy improves when charts and graphs are converted to structured data before indexing.

### Q5: What is the latency for real-time voice conversation?

For the GPT-4o Realtime API, typical latency is 300-500ms (text input) to 500-1000ms (voice input). Because it uses a WebSocket connection, there is less overhead than HTTP requests. However, for long responses, streaming is used to reduce perceived latency.

### Q6: What are use cases for combining image generation and image input?

(1) Image editing: input the original image and give instructions like "change the background" or "add text." (2) Image style transfer: generate a new image in the style of a reference image. (3) Design iteration: input the current design and generate an improved version. GPT-4o and Gemini support this workflow.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals to jump to advanced applications. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Details |
|------|------|
| Recommended for Image Input | GPT-4o (general purpose), Claude 3.5 (documents/PDF), Gemini (high-volume images) |
| Audio Processing | Whisper (transcription), GPT-4o Realtime (conversation), TTS (audio generation) |
| Video Processing | Gemini (native support), GPT-4o (pseudo-support via frame extraction) |
| Cost Optimization | Reduce resolution, choose detail setting for the task, batch processing |
| Accuracy Optimization | Image preprocessing, Self-Consistency, combined use with dedicated OCR |
| Multimodal RAG | Convert to descriptions with VLM → text embedding is the practical approach |
| Future Outlook | Real-time video understanding, spatial recognition, improved generation quality |

---

## Guides to Read Next

- [03-embeddings.md](./03-embeddings.md) — Details on multimodal embeddings
- [../01-models/02-gemini.md](../01-models/02-gemini.md) — Gemini's multimodal capabilities
- [../03-infrastructure/00-api-integration.md](../03-infrastructure/00-api-integration.md) — Integrating multimodal APIs

---

## References

1. OpenAI, "Vision Guide," https://platform.openai.com/docs/guides/vision
2. Anthropic, "Vision Documentation," https://docs.anthropic.com/claude/docs/vision
3. Google, "Gemini Multimodal Guide," https://ai.google.dev/docs/multimodal_concepts
4. Radford et al., "Learning Transferable Visual Models From Natural Language Supervision (CLIP)," ICML 2021
5. Li et al., "BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models," ICML 2023
6. Liu et al., "LLaVA: Large Language and Vision Assistant," NeurIPS 2023
