# API Integration — SDKs, Streaming, and Retry Strategies

> LLM API integration is the engineering discipline of embedding model capabilities into applications, requiring systematic design of SDK selection, streaming implementation, error handling, rate limiting, and cost management.

## What You Will Learn

1. **Major Provider SDKs and Common Abstraction Layers** — Unified access via OpenAI, Anthropic, Google, and LiteLLM
2. **Streaming Implementation Patterns** — SSE, WebSocket, and backpressure control
3. **Production-Quality Error Handling** — Retries, fallbacks, and circuit breakers
4. **Rate Limiting and Cost Management** — Token buckets, budget management, and usage monitoring
5. **Prompt Caching and Batch APIs** — Advanced API usage for cost reduction
6. **Security and Observability** — API key management, logging, and metrics


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. SDK Overview

```
┌──────────────────────────────────────────────────────────┐
│            LLM API Integration Layer Structure            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Application                                             │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────────────────────────────┐               │
│  │  Abstraction Layer (LiteLLM / OpenRouter)  │  ← Recommended      │
│  │  - Multi-provider support             │               │
│  │  - Unified API interface              │               │
│  │  - Automatic fallback                 │               │
│  └───────────┬──────────────────────────┘               │
│              │                                           │
│    ┌─────────┼────────────┬────────────┐                │
│    ▼         ▼            ▼            ▼                │
│  OpenAI   Anthropic    Google AI    Ollama              │
│  SDK      SDK          SDK          (Local)             │
│    │         │            │            │                │
│    ▼         ▼            ▼            ▼                │
│  GPT-4o   Claude 3.5   Gemini 1.5   Llama 3.1         │
│  o1/o3    Haiku         Flash/Pro    Qwen 2.5          │
└──────────────────────────────────────────────────────────┘
```

### 1.1 OpenAI SDK

```python
from openai import OpenAI, AsyncOpenAI

# Synchronous client
client = OpenAI(
    api_key="sk-...",          # Falls back to OPENAI_API_KEY environment variable if omitted
    timeout=30.0,              # Timeout
    max_retries=3,             # Automatic retry count
    base_url="https://api.openai.com/v1",  # Supports custom endpoints
)

# Basic chat completion
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "あなたは有能なアシスタントです。"},
        {"role": "user", "content": "Pythonのデコレータを解説してください"},
    ],
    temperature=0.7,
    max_tokens=1024,
    top_p=1.0,
    frequency_penalty=0.0,
    presence_penalty=0.0,
)
print(response.choices[0].message.content)
print(f"トークン使用量: {response.usage.total_tokens}")
print(f"入力: {response.usage.prompt_tokens}, 出力: {response.usage.completion_tokens}")

# Asynchronous client
async_client = AsyncOpenAI()
response = await async_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)

# Structured Output (JSON mode)
from pydantic import BaseModel

class ExtractedData(BaseModel):
    name: str
    age: int
    occupation: str

response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "テキストから情報を抽出してJSON形式で返してください"},
        {"role": "user", "content": "田中太郎さんは35歳のエンジニアです"},
    ],
    response_format=ExtractedData,
)
data = response.choices[0].message.parsed
print(f"名前: {data.name}, 年齢: {data.age}, 職業: {data.occupation}")

# Batch API
batch_input = client.files.create(
    file=open("batch_requests.jsonl", "rb"),
    purpose="batch",
)
batch_job = client.batches.create(
    input_file_id=batch_input.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
)
print(f"バッチジョブID: {batch_job.id}, 状態: {batch_job.status}")
```

### 1.2 Anthropic SDK

```python
from anthropic import Anthropic, AsyncAnthropic

client = Anthropic()

# Basic message creation
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    system="あなたは有能なアシスタントです。",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.content[0].text)
print(f"入力: {response.usage.input_tokens}, 出力: {response.usage.output_tokens}")
print(f"停止理由: {response.stop_reason}")

# Multimodal input (image)
import base64
with open("image.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{
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
                "text": "この画像の内容を説明してください",
            },
        ],
    }],
)

# Prompt caching
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "あなたは法律の専門家です。以下の法律文書を参照して回答してください...(長い文書)",
            "cache_control": {"type": "ephemeral"},  # Enable caching
        },
    ],
    messages=[{"role": "user", "content": "第3条について要約してください"}],
)
# You can check cache usage via cache_creation_input_tokens and cache_read_input_tokens
print(f"キャッシュ作成: {response.usage.cache_creation_input_tokens}")
print(f"キャッシュ読み: {response.usage.cache_read_input_tokens}")

# Extended Thinking
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=16384,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000,  # Maximum tokens available for reasoning
    },
    messages=[{"role": "user", "content": "この数学問題を解いてください: ..."}],
)
# Returns both a thinking block and a text block
for block in response.content:
    if block.type == "thinking":
        print(f"[思考過程] {block.thinking[:200]}...")
    elif block.type == "text":
        print(f"[回答] {block.text}")

# Batch API
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": f"req-{i}",
            "params": {
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": f"質問 {i}"}],
            },
        }
        for i in range(100)
    ],
)
print(f"バッチID: {batch.id}")
```

### 1.3 Google Generative AI SDK

```python
import google.generativeai as genai

genai.configure(api_key="AIza...")

# Using Gemini models
model = genai.GenerativeModel("gemini-1.5-pro")

response = model.generate_content("日本の歴史を要約してください")
print(response.text)

# Multimodal (image input)
import PIL.Image
img = PIL.Image.open("chart.png")
response = model.generate_content(["このグラフを分析してください", img])

# Multimodal (video input) — Gemini-exclusive feature
video_file = genai.upload_file("presentation.mp4")
response = model.generate_content(
    ["この動画の要点をまとめてください", video_file],
    request_options={"timeout": 600},
)

# Long-context support (up to 2 million tokens)
long_document = open("large_document.txt").read()
response = model.generate_content(
    f"以下の文書を分析して要点を抽出してください:\n\n{long_document}",
    generation_config=genai.types.GenerationConfig(
        temperature=0.3,
        max_output_tokens=8192,
    ),
)

# Streaming
response = model.generate_content("詳しく説明してください", stream=True)
for chunk in response:
    print(chunk.text, end="", flush=True)

# Safety settings
from google.generativeai.types import HarmCategory, HarmBlockThreshold

response = model.generate_content(
    "...",
    safety_settings={
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
)
```

### 1.4 LiteLLM (Multi-Provider Unification)

```python
from litellm import completion, acompletion
import litellm

# Call different providers using the same interface
response = completion(
    model="gpt-4o",  # OpenAI
    messages=[{"role": "user", "content": "Hello"}],
)

response = completion(
    model="claude-3-5-sonnet-20241022",  # Anthropic
    messages=[{"role": "user", "content": "Hello"}],
)

response = completion(
    model="gemini/gemini-1.5-pro",  # Google
    messages=[{"role": "user", "content": "Hello"}],
)

response = completion(
    model="ollama/llama3.1",  # Local Ollama
    messages=[{"role": "user", "content": "Hello"}],
    api_base="http://localhost:11434",
)

# LiteLLM Router: load balancing + fallback
from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "primary",
            "litellm_params": {
                "model": "gpt-4o",
                "api_key": "sk-...",
            },
        },
        {
            "model_name": "primary",  # Multiple models under the same name
            "litellm_params": {
                "model": "claude-3-5-sonnet-20241022",
                "api_key": "sk-ant-...",
            },
        },
    ],
    routing_strategy="least-busy",  # latency-based-routing, simple-shuffle, etc.
    num_retries=3,
    fallbacks=[
        {"primary": ["gpt-4o-mini"]},  # Fall back to mini if all primary models fail
    ],
)

response = await router.acompletion(
    model="primary",
    messages=[{"role": "user", "content": "Hello"}],
)

# Cost tracking
litellm.success_callback = ["langfuse"]  # Track cost and quality with Langfuse
litellm.set_verbose = True

# Custom callback
def log_callback(kwargs, completion_response, start_time, end_time):
    print(f"モデル: {kwargs['model']}")
    print(f"レイテンシ: {end_time - start_time}")
    print(f"トークン: {completion_response.usage}")

litellm.success_callback = [log_callback]
```

---

## 2. Streaming Implementation

### 2.1 Basic Streaming

```python
from openai import OpenAI

client = OpenAI()

# Streaming (synchronous)
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "日本の歴史を要約してください"}],
    stream=True,
    stream_options={"include_usage": True},  # Include usage information
)

full_response = ""
usage = None
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        token = chunk.choices[0].delta.content
        print(token, end="", flush=True)
        full_response += token
    if chunk.usage:
        usage = chunk.usage

print(f"\n\n入力: {usage.prompt_tokens}, 出力: {usage.completion_tokens}")
```

### 2.2 Anthropic Streaming

```python
from anthropic import Anthropic

client = Anthropic()

# Streaming (event-based)
with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Pythonの非同期処理を解説してください"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

# Detailed event version
with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
) as stream:
    for event in stream:
        if event.type == "message_start":
            print(f"[Start] Model: {event.message.model}")
        elif event.type == "content_block_start":
            print(f"[Block start] Type: {event.content_block.type}")
        elif event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                print(event.delta.text, end="", flush=True)
        elif event.type == "message_delta":
            print(f"\n[Done] Stop reason: {event.delta.stop_reason}")
            print(f"出力トークン: {event.usage.output_tokens}")
```

### 2.3 FastAPI + Server-Sent Events (SSE)

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI
import json
import asyncio
import time

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncOpenAI()

class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o"
    max_tokens: int = 1024
    temperature: float = 0.7
    stream: bool = True

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Returns a streaming response via SSE"""

    async def generate():
        try:
            start_time = time.time()
            ttft = None

            stream = await client.chat.completions.create(
                model=request.model,
                messages=[{"role": "user", "content": request.message}],
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                stream=True,
                stream_options={"include_usage": True},
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    if ttft is None:
                        ttft = time.time() - start_time

                    data = json.dumps({
                        "token": token,
                        "done": False,
                        "ttft": ttft,
                    })
                    yield f"data: {data}\n\n"

                if chunk.usage:
                    usage_data = json.dumps({
                        "token": "",
                        "done": True,
                        "usage": {
                            "input_tokens": chunk.usage.prompt_tokens,
                            "output_tokens": chunk.usage.completion_tokens,
                        },
                        "latency": time.time() - start_time,
                        "ttft": ttft,
                    })
                    yield f"data: {usage_data}\n\n"

        except Exception as e:
            error_data = json.dumps({
                "error": str(e),
                "done": True,
            })
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# Non-streaming version (for comparison)
@app.post("/chat")
async def chat(request: ChatRequest):
    """Returns a standard JSON response"""
    response = await client.chat.completions.create(
        model=request.model,
        messages=[{"role": "user", "content": request.message}],
        max_tokens=request.max_tokens,
        temperature=request.temperature,
    )
    return {
        "content": response.choices[0].message.content,
        "usage": {
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
        },
    }
```

### 2.4 Frontend SSE Client

```typescript
// TypeScript: SSE client
class LLMStreamClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async streamChat(
    message: string,
    onToken: (token: string) => void,
    onComplete: (usage: any) => void,
    onError: (error: string) => void,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stream: true }),
    });

    if (!response.ok) {
      onError(`HTTP error: ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No reader available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Retain the last incomplete segment

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.error) {
            onError(data.error);
            return;
          }

          if (data.done) {
            onComplete(data.usage);
          } else {
            onToken(data.token);
          }
        }
      }
    }
  }
}

// Example usage in a React Hook
function useLLMStream() {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const client = new LLMStreamClient('/api');

  const sendMessage = async (message: string) => {
    setResponse('');
    setIsStreaming(true);

    await client.streamChat(
      message,
      (token) => setResponse((prev) => prev + token),
      (usage) => {
        setIsStreaming(false);
        console.log('使用量:', usage);
      },
      (error) => {
        setIsStreaming(false);
        console.error('エラー:', error);
      },
    );
  };

  return { response, isStreaming, sendMessage };
}
```

### 2.5 Async Streaming and Backpressure

```python
import asyncio
from openai import AsyncOpenAI
from collections import deque

class StreamBuffer:
    """Stream buffer with backpressure support"""

    def __init__(self, max_size: int = 100):
        self.buffer: deque = deque(maxlen=max_size)
        self.event = asyncio.Event()
        self.done = False

    async def put(self, item: str):
        """Add an item to the buffer"""
        while len(self.buffer) >= self.buffer.maxlen:
            # Buffer is full: wait until consumed
            await asyncio.sleep(0.01)
        self.buffer.append(item)
        self.event.set()

    async def get(self) -> str | None:
        """Retrieve an item from the buffer"""
        while not self.buffer and not self.done:
            self.event.clear()
            await self.event.wait()
        if self.buffer:
            return self.buffer.popleft()
        return None

    def mark_done(self):
        self.done = True
        self.event.set()


async def producer(buffer: StreamBuffer, prompt: str):
    """Write the LLM stream to the buffer"""
    client = AsyncOpenAI()
    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices[0].delta.content:
            await buffer.put(chunk.choices[0].delta.content)
    buffer.mark_done()


async def consumer(buffer: StreamBuffer):
    """Consume tokens from the buffer and display them"""
    while True:
        token = await buffer.get()
        if token is None:
            break
        # Display or process the token here
        print(token, end="", flush=True)
        # Simulate a slow consumer
        await asyncio.sleep(0.01)


async def main():
    buffer = StreamBuffer(max_size=50)
    await asyncio.gather(
        producer(buffer, "Pythonの非同期処理を解説してください"),
        consumer(buffer),
    )
```

---

## 3. Error Handling and Retries

```
┌──────────────────────────────────────────────────────────┐
│           Error Handling Strategies                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  HTTP Status    Cause              Action                 │
│  ──────────    ─────             ─────                   │
│  400           Bad request        Validate and fix input │
│  401           Auth error         Check API key          │
│  403           Insufficient perms Check plan             │
│  404           Model not found    Check model name       │
│  413           Input too large    Reduce token count     │
│  429           Rate limit         Exponential backoff retry │
│  500           Server error       Retry + fallback       │
│  503           Overloaded         Wait + retry           │
│  529           Overloaded (Anthropic)  Wait + retry      │
│  Timeout       Slow response      Extend timeout / retry │
│                                                          │
│  Retryable:     429, 500, 503, 529, Timeout              │
│  Non-retryable: 400, 401, 403, 404, 413                  │
└──────────────────────────────────────────────────────────┘
```

### 3.1 Exponential Backoff Retry (Production-Grade)

```python
import time
import random
import logging
from dataclasses import dataclass, field
from typing import Optional, Callable
from openai import OpenAI, RateLimitError, APIError, APITimeoutError, APIConnectionError

logger = logging.getLogger(__name__)

@dataclass
class RetryConfig:
    """Retry configuration"""
    max_retries: int = 5
    base_delay: float = 1.0
    max_delay: float = 60.0
    jitter_factor: float = 0.5
    retryable_status_codes: set = field(default_factory=lambda: {429, 500, 503, 529})

class RetryableAPIClient:
    """API client with retry support"""

    def __init__(
        self,
        client: OpenAI,
        config: RetryConfig = None,
        on_retry: Optional[Callable] = None,
    ):
        self.client = client
        self.config = config or RetryConfig()
        self.on_retry = on_retry
        self.retry_count = 0
        self.total_wait_time = 0

    def call(self, **kwargs):
        """Retry with exponential backoff + jitter"""
        retryable_errors = (RateLimitError, APIError, APITimeoutError, APIConnectionError)

        for attempt in range(self.config.max_retries + 1):
            try:
                response = self.client.chat.completions.create(**kwargs)
                if attempt > 0:
                    logger.info(f"Retry succeeded (attempt {attempt + 1})")
                return response

            except retryable_errors as e:
                if attempt == self.config.max_retries:
                    logger.error(f"Max retries reached: {e}")
                    raise

                # Respect the Retry-After header for rate limit errors
                retry_after = None
                if hasattr(e, 'response') and e.response:
                    retry_after = e.response.headers.get('retry-after')

                if retry_after:
                    wait_time = float(retry_after)
                else:
                    # Exponential backoff + jitter
                    delay = min(
                        self.config.base_delay * (2 ** attempt),
                        self.config.max_delay,
                    )
                    jitter = random.uniform(0, delay * self.config.jitter_factor)
                    wait_time = delay + jitter

                self.retry_count += 1
                self.total_wait_time += wait_time

                logger.warning(
                    f"Retry {attempt + 1}/{self.config.max_retries}: "
                    f"{type(e).__name__}, waiting {wait_time:.1f}s"
                )

                if self.on_retry:
                    self.on_retry(attempt, e, wait_time)

                time.sleep(wait_time)

            except Exception as e:
                # Non-retryable errors (400, 401, 403, etc.)
                logger.error(f"Non-retryable error: {type(e).__name__}: {e}")
                raise

    def get_stats(self) -> dict:
        return {
            "total_retries": self.retry_count,
            "total_wait_time": self.total_wait_time,
        }


# Usage example
client = OpenAI(max_retries=0)  # Disable SDK-level retries
retryable = RetryableAPIClient(
    client,
    config=RetryConfig(max_retries=5, base_delay=1.0),
    on_retry=lambda attempt, err, wait: print(f"  → Waiting... ({wait:.1f}s)"),
)

response = retryable.call(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
print(f"リトライ統計: {retryable.get_stats()}")
```

### 3.2 Fallback Strategy

```python
import asyncio
import time
import logging
from dataclasses import dataclass, field
from litellm import acompletion
from litellm.exceptions import (
    RateLimitError, ServiceUnavailableError, Timeout, APIError
)

logger = logging.getLogger(__name__)

@dataclass
class FallbackConfig:
    model: str
    provider: str
    priority: int = 0  # Lower value = higher priority
    max_retries: int = 2
    timeout: float = 30.0

class FallbackChain:
    """Try multiple providers in sequence via a fallback chain"""

    def __init__(self, configs: list[FallbackConfig]):
        self.configs = sorted(configs, key=lambda x: x.priority)
        self.call_history: list[dict] = []

    async def call(self, messages: list, **kwargs) -> dict:
        """Call the API using the fallback chain"""
        errors = []

        for config in self.configs:
            try:
                start = time.time()
                response = await acompletion(
                    model=config.model,
                    messages=messages,
                    timeout=config.timeout,
                    num_retries=config.max_retries,
                    **kwargs,
                )
                latency = time.time() - start

                result = {
                    "content": response.choices[0].message.content,
                    "model": config.model,
                    "provider": config.provider,
                    "latency": latency,
                    "usage": {
                        "input": response.usage.prompt_tokens,
                        "output": response.usage.completion_tokens,
                    },
                    "fallback_depth": len(errors),
                }
                self.call_history.append(result)

                if errors:
                    logger.info(
                        f"Fallback succeeded: {config.provider} "
                        f"(depth: {len(errors)})"
                    )
                return result

            except (RateLimitError, ServiceUnavailableError, Timeout, APIError) as e:
                error_info = {
                    "provider": config.provider,
                    "model": config.model,
                    "error": str(e),
                    "error_type": type(e).__name__,
                }
                errors.append(error_info)
                logger.warning(f"Fallback: {config.provider} failed - {e}")
                continue

        raise Exception(
            f"All providers failed:\n" +
            "\n".join(f"  - {e['provider']}: {e['error']}" for e in errors)
        )

    def get_stats(self) -> dict:
        """Fallback statistics"""
        if not self.call_history:
            return {"total_calls": 0}

        fallback_calls = sum(1 for c in self.call_history if c["fallback_depth"] > 0)
        return {
            "total_calls": len(self.call_history),
            "fallback_calls": fallback_calls,
            "fallback_rate": fallback_calls / len(self.call_history),
            "provider_distribution": {
                p: sum(1 for c in self.call_history if c["provider"] == p)
                for p in set(c["provider"] for c in self.call_history)
            },
        }


# Usage example
chain = FallbackChain([
    FallbackConfig("gpt-4o", "openai", priority=0),
    FallbackConfig("claude-3-5-sonnet-20241022", "anthropic", priority=1),
    FallbackConfig("gemini/gemini-1.5-pro", "google", priority=2),
])

result = await chain.call([{"role": "user", "content": "Hello"}])
print(f"回答: {result['content'][:100]}...")
print(f"プロバイダ: {result['provider']}, レイテンシ: {result['latency']:.2f}s")
```

### 3.3 Circuit Breaker

```python
import time
from enum import Enum
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

class CircuitState(Enum):
    CLOSED = "CLOSED"      # Operating normally
    OPEN = "OPEN"          # Tripped (all requests rejected)
    HALF_OPEN = "HALF_OPEN"  # Probing (only one request allowed)

@dataclass
class CircuitBreaker:
    """Circuit breaker pattern"""
    name: str
    failure_threshold: int = 5       # Consecutive failure threshold
    recovery_timeout: float = 60.0   # Recovery wait time (seconds)
    success_threshold: int = 3       # Consecutive successes needed to go HALF_OPEN → CLOSED

    def __post_init__(self):
        self.failure_count: int = 0
        self.success_count: int = 0
        self.last_failure_time: float = 0
        self.state: CircuitState = CircuitState.CLOSED
        self.total_trips: int = 0  # Number of times the circuit has opened

    def can_proceed(self) -> bool:
        """Whether to allow the request"""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            elapsed = time.time() - self.last_failure_time
            if elapsed > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                logger.info(f"[{self.name}] OPEN → HALF_OPEN (starting recovery probe)")
                return True
            return False

        # HALF_OPEN: allow only one request
        return True

    def record_success(self):
        """Record a success"""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                logger.info(f"[{self.name}] HALF_OPEN → CLOSED (recovery complete)")
        else:
            self.failure_count = 0

    def record_failure(self):
        """Record a failure"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        self.success_count = 0

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            self.total_trips += 1
            logger.warning(f"[{self.name}] HALF_OPEN → OPEN (recovery failed)")
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.total_trips += 1
            logger.warning(
                f"[{self.name}] CLOSED → OPEN "
                f"(consecutive failures: {self.failure_count})"
            )

    def get_status(self) -> dict:
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "total_trips": self.total_trips,
            "time_since_last_failure": (
                time.time() - self.last_failure_time
                if self.last_failure_time > 0 else None
            ),
        }


# Manage circuit breakers per provider
class CircuitBreakerManager:
    """Centrally manage multiple circuit breakers"""

    def __init__(self):
        self.breakers: dict[str, CircuitBreaker] = {}

    def get_or_create(self, name: str, **kwargs) -> CircuitBreaker:
        if name not in self.breakers:
            self.breakers[name] = CircuitBreaker(name=name, **kwargs)
        return self.breakers[name]

    def get_available_providers(self) -> list[str]:
        """List of available providers"""
        return [
            name for name, breaker in self.breakers.items()
            if breaker.can_proceed()
        ]

    def get_all_status(self) -> list[dict]:
        return [b.get_status() for b in self.breakers.values()]


# Usage example
manager = CircuitBreakerManager()
for provider in ["openai", "anthropic", "google"]:
    manager.get_or_create(provider, failure_threshold=5, recovery_timeout=60)

# Check available providers
available = manager.get_available_providers()
print(f"Available: {available}")
```

---

## 4. Rate Limit Management

### 4.1 Token Bucket

```python
import asyncio
import time

class TokenBucket:
    """Rate limiting using a token bucket"""

    def __init__(self, rate: float, capacity: int):
        self.rate = rate          # Token refill rate per second
        self.capacity = capacity  # Bucket capacity
        self.tokens = capacity
        self.last_time = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, tokens: int = 1) -> float:
        """Acquire tokens (waiting if necessary). Returns wait time."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_time
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_time = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return 0.0

            # Insufficient tokens: calculate required wait time
            wait = (tokens - self.tokens) / self.rate
            await asyncio.sleep(wait)
            self.tokens = 0
            return wait

    def available(self) -> float:
        """Currently available token count"""
        now = time.monotonic()
        elapsed = now - self.last_time
        return min(self.capacity, self.tokens + elapsed * self.rate)


class RateLimitManager:
    """Rate limiter managing both RPM and TPM"""

    def __init__(self, rpm: int, tpm: int):
        self.rpm_limiter = TokenBucket(rate=rpm / 60, capacity=rpm)
        self.tpm_limiter = TokenBucket(rate=tpm / 60, capacity=tpm)
        self.total_wait_time = 0
        self.total_requests = 0

    async def acquire(self, estimated_tokens: int = 500):
        """Check rate limits before sending a request"""
        rpm_wait = await self.rpm_limiter.acquire(1)
        tpm_wait = await self.tpm_limiter.acquire(estimated_tokens)
        total_wait = rpm_wait + tpm_wait

        self.total_wait_time += total_wait
        self.total_requests += 1

        if total_wait > 0:
            logging.debug(f"Rate limit wait: {total_wait:.2f}s")

    def get_stats(self) -> dict:
        return {
            "total_requests": self.total_requests,
            "total_wait_time": f"{self.total_wait_time:.1f}s",
            "avg_wait_per_request": (
                f"{self.total_wait_time / self.total_requests:.3f}s"
                if self.total_requests > 0 else "N/A"
            ),
        }


# OpenAI rate limits by tier
OPENAI_RATE_LIMITS = {
    "tier1": {"rpm": 500, "tpm": 200_000},
    "tier2": {"rpm": 5_000, "tpm": 2_000_000},
    "tier3": {"rpm": 5_000, "tpm": 5_000_000},
    "tier4": {"rpm": 10_000, "tpm": 10_000_000},
    "tier5": {"rpm": 10_000, "tpm": 30_000_000},
}

# Usage example
limiter = RateLimitManager(rpm=500, tpm=200_000)  # Tier 1

async def rate_limited_call(messages: list) -> str:
    await limiter.acquire(estimated_tokens=700)  # Estimated input + output
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    return response.choices[0].message.content
```

### 4.2 Concurrency Control

```python
import asyncio
from openai import AsyncOpenAI

class ConcurrencyController:
    """Semaphore-based controller for limiting concurrent requests"""

    def __init__(
        self,
        max_concurrent: int = 10,
        rate_limiter: RateLimitManager = None,
    ):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.rate_limiter = rate_limiter
        self.active_requests = 0
        self.completed_requests = 0
        self.failed_requests = 0

    async def execute(self, coro):
        """Execute an async task with concurrency limits"""
        async with self.semaphore:
            self.active_requests += 1
            try:
                if self.rate_limiter:
                    await self.rate_limiter.acquire()
                result = await coro
                self.completed_requests += 1
                return result
            except Exception as e:
                self.failed_requests += 1
                raise
            finally:
                self.active_requests -= 1

    async def execute_batch(
        self,
        tasks: list,
        on_progress: callable = None,
    ) -> list:
        """Execute a batch of tasks with concurrency limits"""
        results = []

        async def task_wrapper(i, task):
            result = await self.execute(task)
            if on_progress:
                on_progress(i, len(tasks))
            return result

        results = await asyncio.gather(
            *[task_wrapper(i, task) for i, task in enumerate(tasks)],
            return_exceptions=True,
        )
        return results


# Usage example: process 100 requests with concurrency of 10
client = AsyncOpenAI()
controller = ConcurrencyController(
    max_concurrent=10,
    rate_limiter=RateLimitManager(rpm=500, tpm=200_000),
)

prompts = [f"質問 {i}: ..." for i in range(100)]

tasks = [
    client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": p}],
    )
    for p in prompts
]

results = await controller.execute_batch(
    tasks,
    on_progress=lambda i, total: print(f"\rProgress: {i+1}/{total}", end=""),
)
print(f"\nCompleted: {controller.completed_requests}, Failed: {controller.failed_requests}")
```

---

## 5. Cost Management

### 5.1 Usage Tracking

```python
from dataclasses import dataclass, field
from datetime import datetime, date
from collections import defaultdict
import json
import logging

logger = logging.getLogger(__name__)

@dataclass
class UsageRecord:
    timestamp: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    request_id: str = ""
    metadata: dict = field(default_factory=dict)

class BudgetExceededError(Exception):
    pass

class UsageTracker:
    """API usage and cost tracking"""

    PRICING = {
        "gpt-4o":              {"input": 2.50, "output": 10.00},
        "gpt-4o-mini":         {"input": 0.15, "output": 0.60},
        "o1":                  {"input": 15.00, "output": 60.00},
        "o3-mini":             {"input": 1.10, "output": 4.40},
        "claude-3-5-sonnet":   {"input": 3.00, "output": 15.00},
        "claude-3-5-haiku":    {"input": 0.80, "output": 4.00},
        "gemini-1.5-pro":      {"input": 1.25, "output": 5.00},
        "gemini-1.5-flash":    {"input": 0.075, "output": 0.30},
        "gemini-2.0-flash":    {"input": 0.10, "output": 0.40},
        "deepseek-v3":         {"input": 0.27, "output": 1.10},
    }

    def __init__(
        self,
        daily_budget: float = 100.0,
        monthly_budget: float = 3000.0,
        alert_threshold: float = 0.8,  # Alert at 80% of budget
    ):
        self.daily_budget = daily_budget
        self.monthly_budget = monthly_budget
        self.alert_threshold = alert_threshold
        self.records: list[UsageRecord] = []

    def record(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
        request_id: str = "",
        metadata: dict = None,
    ) -> float:
        """Record usage and return cost"""
        # Normalize model name
        model_key = self._normalize_model_name(model)
        prices = self.PRICING.get(model_key, {"input": 0, "output": 0})

        cost = (
            (input_tokens / 1_000_000) * prices["input"] +
            (output_tokens / 1_000_000) * prices["output"]
        )

        record = UsageRecord(
            timestamp=datetime.now().isoformat(),
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            request_id=request_id,
            metadata=metadata or {},
        )
        self.records.append(record)

        # Check budget
        self._check_budget()

        return cost

    def _normalize_model_name(self, model: str) -> str:
        """Normalize model name to pricing table key"""
        model = model.lower()
        for key in self.PRICING:
            if key in model.replace(".", "-"):
                return key
        return model

    def _check_budget(self):
        """Check for budget overruns"""
        today_cost = self.get_today_cost()
        month_cost = self.get_month_cost()

        # Daily budget check
        if today_cost > self.daily_budget:
            raise BudgetExceededError(
                f"Daily budget exceeded: ${today_cost:.2f} / ${self.daily_budget:.2f}"
            )

        # Monthly budget check
        if month_cost > self.monthly_budget:
            raise BudgetExceededError(
                f"Monthly budget exceeded: ${month_cost:.2f} / ${self.monthly_budget:.2f}"
            )

        # Warning
        if today_cost > self.daily_budget * self.alert_threshold:
            logger.warning(
                f"Daily budget warning: ${today_cost:.2f} / ${self.daily_budget:.2f} "
                f"({today_cost/self.daily_budget:.0%})"
            )

    def get_today_cost(self) -> float:
        today = date.today().isoformat()
        return sum(r.cost for r in self.records if r.timestamp.startswith(today))

    def get_month_cost(self) -> float:
        month = date.today().strftime("%Y-%m")
        return sum(r.cost for r in self.records if r.timestamp.startswith(month))

    def get_report(self) -> dict:
        """Generate a usage report"""
        today = date.today().isoformat()
        month = date.today().strftime("%Y-%m")

        # Aggregate by model
        model_costs = defaultdict(float)
        model_tokens = defaultdict(lambda: {"input": 0, "output": 0})
        for r in self.records:
            if r.timestamp.startswith(month):
                model_costs[r.model] += r.cost
                model_tokens[r.model]["input"] += r.input_tokens
                model_tokens[r.model]["output"] += r.output_tokens

        return {
            "today": {
                "cost": self.get_today_cost(),
                "budget": self.daily_budget,
                "utilization": f"{self.get_today_cost()/self.daily_budget:.0%}",
            },
            "month": {
                "cost": self.get_month_cost(),
                "budget": self.monthly_budget,
                "utilization": f"{self.get_month_cost()/self.monthly_budget:.0%}",
            },
            "by_model": {
                model: {
                    "cost": f"${cost:.2f}",
                    "input_tokens": model_tokens[model]["input"],
                    "output_tokens": model_tokens[model]["output"],
                }
                for model, cost in sorted(
                    model_costs.items(), key=lambda x: -x[1]
                )
            },
            "total_requests": len(self.records),
        }


# Usage example
tracker = UsageTracker(daily_budget=100.0, monthly_budget=3000.0)

# Track after each API call
cost = tracker.record("gpt-4o", input_tokens=500, output_tokens=200)
print(f"This request cost: ${cost:.6f}")

report = tracker.get_report()
print(json.dumps(report, indent=2, ensure_ascii=False))
```

### 5.2 Prompt Cache Strategy

```python
class PromptCacheStrategy:
    """Prompt cache optimization strategy"""

    def __init__(self):
        self.cache_hits = 0
        self.cache_misses = 0

    @staticmethod
    def design_cacheable_prompt(
        system_prompt: str,
        few_shot_examples: list[dict],
        user_query: str,
    ) -> list[dict]:
        """Design a prompt structure optimized for caching

        Caching guidelines:
        - Place system prompt and few-shot examples at the top (cache targets)
        - Place user query at the end (variable part)
        - Anthropic: explicitly enable caching with cache_control
        - OpenAI: automatic caching (applied when the first 1024+ tokens are identical)
        """

        # For Anthropic: explicit cache control
        system_with_cache = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            },
        ]

        # Include few-shot examples in the cache target
        messages = []
        for i, example in enumerate(few_shot_examples):
            messages.append({"role": "user", "content": example["input"]})
            assistant_content = example["output"]
            # Set a cache breakpoint at the last few-shot example
            if i == len(few_shot_examples) - 1:
                messages.append({
                    "role": "assistant",
                    "content": [
                        {
                            "type": "text",
                            "text": assistant_content,
                            "cache_control": {"type": "ephemeral"},
                        },
                    ],
                })
            else:
                messages.append({"role": "assistant", "content": assistant_content})

        # User query (variable part)
        messages.append({"role": "user", "content": user_query})

        return system_with_cache, messages

    @staticmethod
    def estimate_cache_savings(
        total_input_tokens: int,
        cacheable_tokens: int,
        requests_per_day: int,
        cache_hit_rate: float = 0.8,
        model: str = "claude-3-5-sonnet",
    ) -> dict:
        """Estimate cost savings from caching"""
        pricing = {
            "claude-3-5-sonnet": {"normal": 3.00, "cached": 0.30, "write": 3.75},
            "gpt-4o": {"normal": 2.50, "cached": 1.25, "write": 2.50},
        }
        p = pricing.get(model, pricing["claude-3-5-sonnet"])

        # Cost without cache
        daily_tokens = total_input_tokens * requests_per_day
        cost_without_cache = (daily_tokens / 1_000_000) * p["normal"]

        # Cost with cache
        cached_tokens = cacheable_tokens * requests_per_day * cache_hit_rate
        uncached_tokens = daily_tokens - cached_tokens
        cache_write_tokens = cacheable_tokens * requests_per_day * (1 - cache_hit_rate)

        cost_with_cache = (
            (uncached_tokens / 1_000_000) * p["normal"] +
            (cached_tokens / 1_000_000) * p["cached"] +
            (cache_write_tokens / 1_000_000) * p["write"]
        )

        daily_savings = cost_without_cache - cost_with_cache
        monthly_savings = daily_savings * 30

        return {
            "daily_cost_without_cache": f"${cost_without_cache:.2f}",
            "daily_cost_with_cache": f"${cost_with_cache:.2f}",
            "daily_savings": f"${daily_savings:.2f}",
            "monthly_savings": f"${monthly_savings:.2f}",
            "savings_rate": f"{daily_savings/cost_without_cache:.0%}",
        }

# Usage example
savings = PromptCacheStrategy.estimate_cache_savings(
    total_input_tokens=2000,
    cacheable_tokens=1500,     # system + few-shot
    requests_per_day=10_000,
    cache_hit_rate=0.85,
    model="claude-3-5-sonnet",
)
print(f"Monthly savings: {savings['monthly_savings']}")
print(f"Reduction rate: {savings['savings_rate']}")
```

---

## 6. Security and Observability

### 6.1 API Key Management

```python
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class SecureAPIKeyManager:
    """Secure API key management"""

    def __init__(self):
        self._keys: dict[str, str] = {}

    def get_key(self, provider: str) -> str:
        """Securely retrieve an API key"""

        # 1. Check in-memory cache
        if provider in self._keys:
            return self._keys[provider]

        # 2. Read from environment variable
        env_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "google": "GOOGLE_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
        }

        env_var = env_map.get(provider)
        if env_var:
            key = os.environ.get(env_var)
            if key:
                self._keys[provider] = key
                return key

        # 3. Read from AWS Secrets Manager (for production environments)
        key = self._get_from_secrets_manager(provider)
        if key:
            self._keys[provider] = key
            return key

        raise ValueError(f"API key not found: {provider}")

    def _get_from_secrets_manager(self, provider: str) -> Optional[str]:
        """Retrieve a key from AWS Secrets Manager"""
        try:
            import boto3
            client = boto3.client("secretsmanager")
            response = client.get_secret_value(
                SecretId=f"llm-api-keys/{provider}",
            )
            return response["SecretString"]
        except Exception:
            return None

    @staticmethod
    def validate_key_format(provider: str, key: str) -> bool:
        """Validate API key format"""
        patterns = {
            "openai": lambda k: k.startswith("sk-") and len(k) > 20,
            "anthropic": lambda k: k.startswith("sk-ant-") and len(k) > 20,
            "google": lambda k: k.startswith("AIza") and len(k) > 20,
        }
        validator = patterns.get(provider, lambda k: len(k) > 10)
        return validator(key)
```

### 6.2 Request/Response Logging

```python
import json
import hashlib
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime

@dataclass
class LLMRequestLog:
    """Log entry for LLM request/response"""
    request_id: str
    timestamp: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    ttft_ms: float = 0
    status: str = "success"
    error: str = ""
    cost: float = 0.0
    prompt_hash: str = ""  # Hash of prompt content (for PII protection)
    metadata: dict = field(default_factory=dict)

class LLMLogger:
    """Log manager for LLM API calls"""

    def __init__(self, log_prompts: bool = False):
        """
        Args:
            log_prompts: If True, prompt content is also recorded in logs
                        (recommended False if prompts contain PII)
        """
        self.log_prompts = log_prompts
        self.logs: list[LLMRequestLog] = []
        self.logger = logging.getLogger("llm_logger")

    def log_request(
        self,
        request_id: str,
        model: str,
        provider: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: float,
        ttft_ms: float = 0,
        status: str = "success",
        error: str = "",
        cost: float = 0.0,
        prompt: str = "",
        metadata: dict = None,
    ):
        """Record a request in the log"""
        # Hash the prompt (do not store the actual content)
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:16] if prompt else ""

        log = LLMRequestLog(
            request_id=request_id,
            timestamp=datetime.now().isoformat(),
            model=model,
            provider=provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            ttft_ms=ttft_ms,
            status=status,
            error=error,
            cost=cost,
            prompt_hash=prompt_hash,
            metadata=metadata or {},
        )

        self.logs.append(log)
        self.logger.info(json.dumps(asdict(log)))

    def get_metrics(self) -> dict:
        """Retrieve a metrics summary"""
        if not self.logs:
            return {"total_requests": 0}

        success_logs = [l for l in self.logs if l.status == "success"]
        error_logs = [l for l in self.logs if l.status != "success"]

        return {
            "total_requests": len(self.logs),
            "success_rate": len(success_logs) / len(self.logs),
            "error_rate": len(error_logs) / len(self.logs),
            "avg_latency_ms": (
                sum(l.latency_ms for l in success_logs) / len(success_logs)
                if success_logs else 0
            ),
            "p95_latency_ms": (
                sorted([l.latency_ms for l in success_logs])[int(len(success_logs) * 0.95)]
                if success_logs else 0
            ),
            "avg_ttft_ms": (
                sum(l.ttft_ms for l in success_logs) / len(success_logs)
                if success_logs else 0
            ),
            "total_cost": sum(l.cost for l in self.logs),
            "total_tokens": sum(l.input_tokens + l.output_tokens for l in self.logs),
            "errors_by_type": {
                error: sum(1 for l in error_logs if l.error == error)
                for error in set(l.error for l in error_logs)
            },
        }
```

---

## 7. Comparison Tables

### 7.1 SDK Feature Comparison

| Feature | OpenAI SDK | Anthropic SDK | Google SDK | LiteLLM |
|---------|-----------|--------------|-----------|---------|
| Sync/Async | Both | Both | Sync-focused | Both |
| Streaming | Supported | Supported | Supported | Supported |
| Auto Retry | Supported (configurable) | Supported | Limited | Supported |
| Type Safety | Pydantic | Pydantic | protobuf | Basic types |
| Multi-provider | N/A | N/A | N/A | 100+ supported |
| Cost Tracking | usage supported | usage supported | Limited | Integrated |
| Structured Output | Supported | N/A | Supported | Provider-dependent |
| Prompt Caching | Automatic | Explicit | N/A | Provider-dependent |
| Batch API | Supported | Supported | N/A | Provider-dependent |
| Extended Thinking | N/A | Supported | N/A | Supported |

### 7.2 Streaming Method Comparison

| Method | Latency | Implementation Complexity | Browser Support | Use Case |
|--------|---------|--------------------------|-----------------|----------|
| SSE | Low | Low | Native | Chat UI |
| WebSocket | Lowest | High | Native | Real-time bidirectional |
| Long Polling | Medium | Low | Native | Legacy support |
| gRPC Stream | Lowest | High | Indirect | Microservices |

---

## 8. Anti-patterns

### Anti-pattern 1: Production Code Without Retries

```python
# BAD: No retries — fails immediately on transient errors
response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
)
# → Crashes immediately on 429 (rate limit) or 500 (server error)

# GOOD: SDK built-in retries + custom retry + fallback
client = OpenAI(
    max_retries=3,     # SDK-level retries
    timeout=30.0,
)
# + Application-level fallback
response = await chain.call(messages)
```

### Anti-pattern 2: Hardcoded API Keys

```python
# BAD: Keys written directly in source code
client = OpenAI(api_key="sk-abc123...")  # Major security risk

# BAD: Committing .env files to Git
# .env not added to .gitignore

# GOOD: Manage via environment variables
import os
client = OpenAI()  # Automatically uses OPENAI_API_KEY environment variable

# GOOD: Secret manager (for production)
key_manager = SecureAPIKeyManager()
client = OpenAI(api_key=key_manager.get_key("openai"))
```

### Anti-pattern 3: Concurrent Requests Ignoring Rate Limits

```python
# BAD: Unlimited concurrent requests
tasks = [call_api(prompt) for prompt in prompts]  # 1000 simultaneous
results = await asyncio.gather(*tasks)
# → Massive 429 errors → all requests fail

# GOOD: Controlled with semaphore + rate limiter
controller = ConcurrencyController(
    max_concurrent=10,
    rate_limiter=RateLimitManager(rpm=500, tpm=200_000),
)
results = await controller.execute_batch(tasks)
```

### Anti-pattern 4: Long Responses Without Streaming

```python
# BAD: Waiting for a long response without streaming
response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    max_tokens=4096,
)
# → Users wait 10-30 seconds with nothing displayed → abandonment

# GOOD: Streaming for immediate feedback
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    max_tokens=4096,
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        yield chunk.choices[0].delta.content  # Display immediately
```

### Anti-pattern 5: Production Operations Without Cost Management

```python
# BAD: No budget management
# → Abnormal traffic or infinite loops can result in tens of thousands of dollars in charges

# GOOD: Multi-layered cost management
tracker = UsageTracker(
    daily_budget=100.0,
    monthly_budget=3000.0,
    alert_threshold=0.8,
)

# Track on every API call
cost = tracker.record(model, input_tokens, output_tokens)
# → Raises BudgetExceededError when budget is exceeded
```

---

## 9. FAQ

### Q1: Should I use synchronous or asynchronous?

Async is recommended for web applications (FastAPI, etc.) because it handles concurrent requests efficiently.
Sync is sufficient for batch processing and scripts.
The biggest advantage of async is the ability to parallelize multiple LLM calls with `asyncio.gather`.

**Decision criteria:**
- FastAPI/Starlette → Async required
- Django (ASGI) → Async recommended
- Django (WSGI) → Sync
- CLI tools → Sync is sufficient
- Batch processing (large number of requests) → Async + semaphore

### Q2: How can I improve streaming TTFT?

Shorten the prompt (reduce input token count).
Use fast Flash/mini-class models.
Connect directly to the API endpoint rather than through a CDN.
Make the system prompt cacheable (OpenAI and Anthropic Prompt Caching).
Configure the nearest region.

### Q3: What is the best practice for using multiple providers?

Abstract with LiteLLM or OpenRouter and make the model switchable via environment variables.
Set up circuit breakers per provider with automatic fallback on failure.
Route requests to models based on task difficulty for cost optimization.

### Q4: How effective is prompt caching for cost reduction?

For Anthropic, the input token price on a cache hit is 1/10 of normal (Claude 3.5 Sonnet: $3.00 → $0.30).
When system prompts and few-shot examples are fixed, you can reduce input costs by 50-80%.
OpenAI automatically caches common prefixes of 1024+ tokens (50% price discount).

### Q5: When should I use the Batch API?

Ideal for large-scale processing where real-time is not required:
- Bulk classification and tagging of data
- Summarizing large volumes of emails/documents
- Running tests and evaluations
- Batch content generation

Benefits: 50% cost reduction, high throughput
Drawbacks: Up to 24 hours to retrieve results, not suitable for real-time processing

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend fully understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Recommendation |
|------|---------------|
| SDK | LiteLLM (multi-provider) + individual SDKs |
| Streaming | SSE (Web) / WebSocket (real-time) |
| Retry | Exponential backoff + jitter (max 5 retries) |
| Fallback | 3-provider chain |
| Rate Limiting | Token bucket + semaphore |
| Cost Management | Daily/monthly budgets + usage tracking |
| API Key Management | Environment variables + secret manager |
| Caching | Actively leverage prompt caching |
| Monitoring | Request logging + metrics collection |

---

## Further Reading

- [01-vector-databases.md](./01-vector-databases.md) — Integration with vector databases
- [02-local-llm.md](./02-local-llm.md) — Local LLM deployment
- [../02-applications/02-function-calling.md](../02-applications/02-function-calling.md) — Function Calling integration

---

## References

1. OpenAI, "API Reference," https://platform.openai.com/docs/api-reference
2. Anthropic, "API Reference," https://docs.anthropic.com/claude/reference
3. Anthropic, "Prompt Caching," https://docs.anthropic.com/claude/docs/prompt-caching
4. LiteLLM, "Documentation," https://docs.litellm.ai/
5. Google, "Generative AI API," https://ai.google.dev/api
6. OpenAI, "Batch API," https://platform.openai.com/docs/guides/batch
7. Anthropic, "Message Batches," https://docs.anthropic.com/claude/docs/message-batches
