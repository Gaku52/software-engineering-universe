# Inference — Parameters and Techniques for Controlling LLM Output

> A practical guide to inference-time parameter tuning and optimization techniques including temperature, Top-p, streaming, and batch processing.

## What You Will Learn

1. Controlling output diversity with **temperature and Top-p/Top-k**
2. Implementing **streaming** and optimizing user experience
3. Reducing cost and latency through **batch processing and inference optimization**


## Prerequisites

The following knowledge will help you get more out of this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Tokenization — Converting Text into Units the Model Understands](./01-tokenization.md)

---

## 1. Inference Parameters

### ASCII Diagram 1: How Temperature Changes the Probability Distribution

```
Probability
│
│  ██                          temperature = 0.0
│  ██                          (Deterministic: only the highest-probability token)
│  ██
│  ██ ░░
│  ██ ░░ ░░
│  ██ ░░ ░░ ░░
├──┬──┬──┬──┬──→ Token
│  A  B  C  D

│  ██
│  ██ ██                       temperature = 0.7
│  ██ ██ ██                    (Balanced: some diversity)
│  ██ ██ ██ ░░
│  ██ ██ ██ ░░
├──┬──┬──┬──┬──→ Token
│  A  B  C  D

│  ██ ██ ██ ██                 temperature = 1.5
│  ██ ██ ██ ██                 (High diversity: close to random)
│  ██ ██ ██ ██
│  ██ ██ ██ ██
├──┬──┬──┬──┬──→ Token
│  A  B  C  D
```

### Code Example 1: Observing the Effect of Temperature

```python
import anthropic

client = anthropic.Anthropic()

prompt = "AIの未来について一言で述べてください。"

for temp in [0.0, 0.5, 1.0]:
    responses = []
    for _ in range(3):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=50,
            temperature=temp,
            messages=[{"role": "user", "content": prompt}]
        )
        responses.append(response.content[0].text.strip())

    print(f"\n温度 {temp}:")
    for i, r in enumerate(responses, 1):
        print(f"  {i}. {r}")
```

### Code Example 2: Controlling Top-p (Nucleus Sampling)

```python
from openai import OpenAI

client = OpenAI()

prompt = "プログラミング言語のトップ3を挙げてください。"

# Top-p: only tokens whose cumulative probability is <= p are selected
for top_p in [0.1, 0.5, 0.9]:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=1.0,
        top_p=top_p,
        max_tokens=100,
    )
    print(f"top_p={top_p}: {response.choices[0].message.content[:80]}")

# Note: best practice is not to change both temperature and top_p at the same time.
# Fix one and adjust only the other.
```

### ASCII Diagram 2: How Top-p Filtering Works

```
Probability (sorted)
│
│ 0.40  ██ ─┐
│ 0.25  ██  │ cumulative 0.65
│ 0.15  ██  │ cumulative 0.80 ← selected up to here if top_p=0.8
│ 0.10  ░░ ─┘ cumulative 0.90
│ 0.05  ░░   (excluded)
│ 0.03  ░░   (excluded)
│ 0.02  ░░   (excluded)
├──┬──┬──┬──┬──┬──┬──→ Token candidates
│  A  B  C  D  E  F  G

██ = candidate   ░░ = excluded
top_p = 0.8 → probabilistic selection from A, B, C
```

### 1.1 Top-k Sampling in Detail

Top-k is a filtering technique that retains only the top-k tokens by probability as candidates. While Top-p cuts by cumulative probability, Top-k cuts by the number of candidates.

```python
import numpy as np

def top_k_sampling(logits: np.ndarray, k: int = 50) -> int:
    """Top-k サンプリングの実装"""
    # 上位 k 個のインデックスを取得
    top_k_indices = np.argsort(logits)[-k:]

    # 上位 k 個以外のロジットを -inf に設定
    filtered_logits = np.full_like(logits, -np.inf)
    filtered_logits[top_k_indices] = logits[top_k_indices]

    # ソフトマックスで確率に変換
    exp_logits = np.exp(filtered_logits - np.max(filtered_logits))
    probs = exp_logits / np.sum(exp_logits)

    # 確率に基づいてサンプリング
    return np.random.choice(len(probs), p=probs)


def top_p_sampling(logits: np.ndarray, p: float = 0.9) -> int:
    """Top-p (Nucleus) サンプリングの実装"""
    # ソフトマックスで確率に変換
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)

    # 確率の降順にソート
    sorted_indices = np.argsort(probs)[::-1]
    sorted_probs = probs[sorted_indices]

    # 累積確率が p を超えるまでのトークンを残す
    cumulative_probs = np.cumsum(sorted_probs)
    cutoff_idx = np.searchsorted(cumulative_probs, p) + 1

    # 選択されたトークンのみ残す
    selected_indices = sorted_indices[:cutoff_idx]
    selected_probs = probs[selected_indices]
    selected_probs /= selected_probs.sum()  # 再正規化

    return np.random.choice(selected_indices, p=selected_probs)


def combined_sampling(
    logits: np.ndarray,
    temperature: float = 0.7,
    top_k: int = 50,
    top_p: float = 0.9,
) -> int:
    """温度 + Top-k + Top-p の組み合わせサンプリング"""
    # 1. 温度スケーリング
    scaled_logits = logits / max(temperature, 1e-8)

    # 2. Top-k フィルタリング
    if top_k > 0:
        top_k_indices = np.argsort(scaled_logits)[-top_k:]
        mask = np.full_like(scaled_logits, -np.inf)
        mask[top_k_indices] = scaled_logits[top_k_indices]
        scaled_logits = mask

    # 3. ソフトマックス
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits))
    probs = exp_logits / np.sum(exp_logits)

    # 4. Top-p フィルタリング
    sorted_indices = np.argsort(probs)[::-1]
    sorted_probs = probs[sorted_indices]
    cumulative = np.cumsum(sorted_probs)
    cutoff = np.searchsorted(cumulative, top_p) + 1

    selected = sorted_indices[:cutoff]
    selected_probs = probs[selected]
    selected_probs /= selected_probs.sum()

    return np.random.choice(selected, p=selected_probs)


# 実験: 各サンプリング方式の出力分布を比較
np.random.seed(42)
vocab_size = 100
logits = np.random.randn(vocab_size)
logits[0] = 3.0   # トークン 0 を高確率に
logits[1] = 2.5
logits[2] = 2.0

n_samples = 10000
results = {"top_k": [], "top_p": [], "combined": []}

for _ in range(n_samples):
    results["top_k"].append(top_k_sampling(logits, k=10))
    results["top_p"].append(top_p_sampling(logits, p=0.9))
    results["combined"].append(combined_sampling(logits, temperature=0.7, top_k=50, top_p=0.9))

for method, samples in results.items():
    unique = len(set(samples))
    top3_ratio = sum(1 for s in samples if s in [0, 1, 2]) / n_samples
    print(f"{method:10s}: ユニークトークン数={unique:3d}, Top3占有率={top3_ratio:.2%}")
```

### ASCII Diagram: Sampling Method Selection Flowchart

```
┌──────────────────────────────────────────────────────────┐
│         Sampling Method Selection Flowchart              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Determine use case                                      │
│    │                                                     │
│    ├─ Accuracy-focused (code generation, data extraction)│
│    │   → temperature = 0.0 (Greedy Decoding)             │
│    │   → top_p = 1.0, top_k = 1                         │
│    │                                                     │
│    ├─ Balanced (general-purpose assistant)               │
│    │   → temperature = 0.7                               │
│    │   → top_p = 0.9 (adjust only one)                  │
│    │                                                     │
│    ├─ Creativity-focused (brainstorming, story writing)  │
│    │   → temperature = 1.0 - 1.2                        │
│    │   → top_p = 0.95, top_k = 100                      │
│    │                                                     │
│    └─ Diversity exploration (generating multiple options) │
│        → temperature = 1.0                               │
│        → top_k = 50, n = 5 (generate 5 candidates)      │
│                                                          │
│  Important: avoid setting both temperature and top_p     │
│  to extreme values simultaneously                        │
│  → can cause unpredictable behavior                      │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Repetition Penalty and Frequency Penalty

Repetition suppression parameters control the redundancy of generated text.

```python
from openai import OpenAI

client = OpenAI()

# Frequency Penalty: linearly reduces the probability of tokens that have already appeared
# Presence Penalty: reduces the probability by a fixed amount if the token has appeared at all
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "AIの応用分野を列挙してください"}],
    temperature=0.7,
    frequency_penalty=0.5,   # 0.0 ~ 2.0: suppresses repetition of the same token
    presence_penalty=0.3,    # 0.0 ~ 2.0: steers toward new topics
    max_tokens=500,
)

# Comparison experiment: without penalty vs. with penalty
for fp, pp in [(0.0, 0.0), (0.5, 0.3), (1.5, 1.0)]:
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "詩を書いてください"}],
        frequency_penalty=fp,
        presence_penalty=pp,
        max_tokens=200,
    )
    print(f"\nfreq={fp}, pres={pp}:")
    print(resp.choices[0].message.content[:150])
```

```
┌──────────────────────────────────────────────────────────┐
│       Effect of Penalty Parameters                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Frequency Penalty:                                      │
│  ─────────────────────────────────                       │
│  Subtracts (token occurrence count × penalty value)      │
│  from the logit                                          │
│                                                          │
│  Example: "cat" appears 3 times, penalty=0.5             │
│  → subtract 3 × 0.5 = 1.5 from "cat"'s logit           │
│  → probability decreases as occurrence count increases   │
│                                                          │
│  Presence Penalty:                                       │
│  ─────────────────────────────────                       │
│  Subtracts the penalty value if a token has appeared     │
│  at least once                                           │
│                                                          │
│  Example: "cat" has already appeared, penalty=0.5        │
│  → subtract 0.5 from "cat"'s logit (constant, count-    │
│    independent)                                          │
│  → effective for steering toward new words/topics        │
│                                                          │
│  Recommended settings:                                   │
│  ├── List generation → freq=0.5, pres=0.3               │
│  ├── Writing         → freq=0.3, pres=0.2               │
│  ├── Dialogue        → freq=0.1, pres=0.1               │
│  └── Code generation → freq=0.0, pres=0.0               │
│        (repeating variable names is normal)              │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Stop Sequences

```python
from openai import OpenAI

client = OpenAI()

# Stop Sequences: stop generation when a specific string is produced
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "1から10まで数えて"}],
    stop=["5"],     # stop when "5" is generated
    max_tokens=100,
)
print(response.choices[0].message.content)
# → "1, 2, 3, 4, "

# Practical use: prevent extra output when extracting JSON
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": "以下のテキストからキーワードをJSON配列で抽出: 'Python機械学習入門'"
    }],
    stop=["```", "\n\n"],  # stop at code block end or double newline
    max_tokens=200,
)

# Stop Sequences with Claude API
import anthropic

client_claude = anthropic.Anthropic()
response = client_claude.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=200,
    stop_sequences=["---", "END"],
    messages=[{"role": "user", "content": "レポートを書いてください"}],
)
print(f"停止理由: {response.stop_reason}")
# "stop_sequence" or "end_turn" or "max_tokens"
```

### 1.4 Reproducibility with the Seed Parameter

```python
from openai import OpenAI

client = OpenAI()

# Specify a seed to improve reproducibility
responses = []
for _ in range(3):
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "ランダムな6桁の数字を1つ生成して"}],
        seed=42,
        temperature=0.0,
    )
    responses.append(response.choices[0].message.content)
    # Verify the same backend via system_fingerprint
    print(f"fingerprint: {response.system_fingerprint}")

# Even with the same seed + temperature=0, 100% reproducibility is not guaranteed
# (GPU non-determinism, changes from model updates)
print(f"再現率: {len(set(responses))}/{len(responses)} ユニーク")

# Best practice when reproducibility matters:
# 1. Fix the seed
# 2. Set temperature = 0
# 3. Log the system_fingerprint
# 4. Pin the model version (e.g., gpt-4o-2024-08-06)
```

### 1.5 Using Logprobs (Log Probabilities)

```python
from openai import OpenAI
import math

client = OpenAI()

# Enable logprobs to retrieve probability information
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "日本の首都は"}],
    max_tokens=10,
    logprobs=True,
    top_logprobs=5,  # retrieve probabilities for the top 5 tokens
)

# Display the probability of each token
for token_info in response.choices[0].logprobs.content:
    prob = math.exp(token_info.logprob)
    print(f"\nSelected: '{token_info.token}' (probability: {prob:.2%})")

    # Alternative candidates
    if token_info.top_logprobs:
        for alt in token_info.top_logprobs:
            alt_prob = math.exp(alt.logprob)
            print(f"  Candidate: '{alt.token}' (probability: {alt_prob:.2%})")


# Practical use: computing a confidence score
def get_confidence_score(response) -> float:
    """生成テキストの信頼度を logprobs から算出"""
    if not response.choices[0].logprobs:
        return 0.0

    log_probs = [
        t.logprob
        for t in response.choices[0].logprobs.content
        if t.logprob is not None
    ]

    if not log_probs:
        return 0.0

    # 平均対数確率 → 確率に変換
    avg_logprob = sum(log_probs) / len(log_probs)
    return math.exp(avg_logprob)


# Branching logic based on confidence
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "この文を分類: '猫がかわいい'"}],
    max_tokens=20,
    logprobs=True,
)

confidence = get_confidence_score(response)
if confidence > 0.8:
    print("High confidence: can be processed automatically")
elif confidence > 0.5:
    print("Medium confidence: additional review recommended")
else:
    print("Low confidence: human review required")
```

---

## 2. Streaming

### Code Example 3: Streaming with the Claude API

```python
import anthropic

client = anthropic.Anthropic()

print("ストリーミング応答:")
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=500,
    messages=[{
        "role": "user",
        "content": "Pythonの主要なデザインパターンを3つ説明してください。"
    }]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
print()  # 改行

# Event-based processing
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=500,
    messages=[{"role": "user", "content": "Hello"}]
) as stream:
    for event in stream:
        if event.type == "content_block_delta":
            print(f"[delta] {event.delta.text}", end="")
        elif event.type == "message_stop":
            print("\n[Done]")
```

### Code Example 4: Streaming with the OpenAI API

```python
from openai import OpenAI

client = OpenAI()

stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": "機械学習の基本ステップを説明してください。"
    }],
    stream=True,
    stream_options={"include_usage": True},  # also retrieve usage data
)

full_response = ""
for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        content = chunk.choices[0].delta.content
        full_response += content
        print(content, end="", flush=True)
    # Retrieve token usage when the stream ends
    if chunk.usage:
        print(f"\n\n使用トークン: {chunk.usage.total_tokens}")
```

### ASCII Diagram 3: Streaming vs. Non-Streaming

```
Non-streaming:
User ──request──→ API ──────────────────→ full response
                   │   (generating...wait)│
                   │   TTFB: 3-10s        │
                   └──────────────────────┘
                   ←──── perceived latency: high ────→

Streaming:
User ──request──→ API ─→ chunk 1
                        ─→ chunk 2
                        ─→ chunk 3
                        ─→ ...
                        ─→ [DONE]
                   ←──→
                   TTFB: 0.3-1s
                   ←──── perceived latency: low ────→

TTFB = Time To First Byte
```

### 2.1 Server-Sent Events (SSE) in Detail

Streaming uses the HTTP Server-Sent Events (SSE) protocol.

```python
import httpx
import json

# Low-level implementation parsing SSE directly
async def stream_with_sse(prompt: str):
    """SSE プロトコルで直接ストリーミング"""
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
            },
        ) as response:
            buffer = ""
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break

                    chunk = json.loads(data)
                    if chunk["choices"][0]["delta"].get("content"):
                        token = chunk["choices"][0]["delta"]["content"]
                        buffer += token
                        yield token

# Streaming proxy implementation with FastAPI
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat/stream")
async def chat_stream(request: dict):
    async def generate():
        async for token in stream_with_sse(request["message"]):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
```

### 2.2 Displaying Streaming Output on the Frontend

```typescript
// TypeScript: receiving SSE on the frontend
async function streamChat(message: string): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE parsing
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

        const parsed = JSON.parse(data);
        appendToUI(parsed.token);  // append token to UI
      }
    }
  }
}

// React component example
function ChatMessage({ streamUrl }: { streamUrl: string }) {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);

  useEffect(() => {
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      if (event.data === "[DONE]") {
        setIsStreaming(false);
        eventSource.close();
        return;
      }

      const data = JSON.parse(event.data);
      setText((prev) => prev + data.token);
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [streamUrl]);

  return (
    <div className="message">
      {text}
      {isStreaming && <span className="cursor blink">|</span>}
    </div>
  );
}
```

### 2.3 Handling Streaming Cancellation and Timeouts

```python
import asyncio
from openai import AsyncOpenAI

async def stream_with_timeout(prompt: str, timeout_seconds: float = 30.0):
    """Streaming with timeout"""
    client = AsyncOpenAI()
    full_text = ""

    try:
        async with asyncio.timeout(timeout_seconds):
            stream = await client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                stream=True,
                max_tokens=2000,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_text += token
                    print(token, end="", flush=True)

    except asyncio.TimeoutError:
        print(f"\n[Timeout] {timeout_seconds}s elapsed")
        # return partial response
    except Exception as e:
        print(f"\n[Error] {e}")

    return full_text


# Supporting user cancellation
async def stream_with_cancel(prompt: str, cancel_event: asyncio.Event):
    """Cancellable streaming"""
    client = AsyncOpenAI()
    full_text = ""

    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )

    async for chunk in stream:
        if cancel_event.is_set():
            print("\n[Cancelled]")
            break

        if chunk.choices and chunk.choices[0].delta.content:
            token = chunk.choices[0].delta.content
            full_text += token
            yield token

    return full_text
```

---

## 3. Batch Processing and Optimization

### Code Example 5: Using Batch APIs

```python
import anthropic
import asyncio

client = anthropic.AsyncAnthropic()

async def process_batch(prompts: list[str]) -> list[str]:
    """Process multiple prompts in parallel"""
    async def single_request(prompt: str) -> str:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    tasks = [single_request(p) for p in prompts]
    results = await asyncio.gather(*tasks)
    return results

# Usage example
prompts = [
    "Pythonの利点を3つ",
    "Rustの利点を3つ",
    "Goの利点を3つ",
    "TypeScriptの利点を3つ",
]

results = asyncio.run(process_batch(prompts))
for prompt, result in zip(prompts, results):
    print(f"Q: {prompt}")
    print(f"A: {result[:100]}...")
    print()

# OpenAI Batch API (async batch, 50% discount)
from openai import OpenAI
client_oai = OpenAI()

batch_input = [
    {
        "custom_id": f"request-{i}",
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": p}],
            "max_tokens": 200,
        }
    }
    for i, p in enumerate(prompts)
]
# Write to JSONL file and submit as a batch
```

### 3.1 Complete Workflow for the OpenAI Batch API

```python
import json
import time
from openai import OpenAI

client = OpenAI()

def run_batch_job(prompts: list[str], model: str = "gpt-4o-mini") -> list[dict]:
    """Complete usage flow for the OpenAI Batch API"""

    # 1. Create JSONL file
    batch_requests = []
    for i, prompt in enumerate(prompts):
        batch_requests.append({
            "custom_id": f"req-{i:06d}",
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": {
                "model": model,
                "messages": [
                    {"role": "system", "content": "簡潔に回答してください。"},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 500,
                "temperature": 0.3,
            },
        })

    input_file = "batch_input.jsonl"
    with open(input_file, "w") as f:
        for req in batch_requests:
            f.write(json.dumps(req, ensure_ascii=False) + "\n")

    # 2. Upload the file
    uploaded = client.files.create(
        file=open(input_file, "rb"),
        purpose="batch",
    )
    print(f"Upload complete: {uploaded.id}")

    # 3. Create the batch job
    batch = client.batches.create(
        input_file_id=uploaded.id,
        endpoint="/v1/chat/completions",
        completion_window="24h",
        metadata={"description": "batch processing experiment"},
    )
    print(f"Batch job started: {batch.id}")

    # 4. Wait for completion (polling)
    while True:
        status = client.batches.retrieve(batch.id)
        print(f"Status: {status.status} "
              f"(completed: {status.request_counts.completed}/"
              f"{status.request_counts.total})")

        if status.status == "completed":
            break
        elif status.status in ["failed", "cancelled", "expired"]:
            raise RuntimeError(f"Batch failed: {status.status}")

        time.sleep(30)  # check every 30 seconds

    # 5. Download results
    output_file = client.files.content(status.output_file_id)
    results = []
    for line in output_file.text.strip().split("\n"):
        result = json.loads(line)
        results.append({
            "id": result["custom_id"],
            "status": result["response"]["status_code"],
            "content": result["response"]["body"]["choices"][0]["message"]["content"],
        })

    # 6. Handle error results
    if status.error_file_id:
        error_file = client.files.content(status.error_file_id)
        for line in error_file.text.strip().split("\n"):
            error = json.loads(line)
            print(f"Error: {error['custom_id']}: {error['response']['body']}")

    return results


# Usage example: classify 1000 documents
documents = [f"文書{i}の内容..." for i in range(1000)]
prompts = [f"以下の文書を「技術」「ビジネス」「その他」に分類: {doc}" for doc in documents]
results = run_batch_job(prompts)

# Cost comparison: Batch API is 50% cheaper than the regular API
# 1000 requests × 500 input tok × 100 output tok = 500k input + 100k output
# Regular: $0.075 + $0.060 = $0.135
# Batch:   $0.0375 + $0.030 = $0.0675 (50% OFF)
```

### 3.2 Anthropic Message Batches API

```python
import anthropic
import time

client = anthropic.Anthropic()

def run_anthropic_batch(prompts: list[str]) -> list[dict]:
    """Usage flow for the Anthropic Message Batches API"""

    # 1. Create batch requests
    requests = [
        {
            "custom_id": f"req-{i:06d}",
            "params": {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}],
            },
        }
        for i, prompt in enumerate(prompts)
    ]

    # 2. Submit the batch
    batch = client.messages.batches.create(requests=requests)
    print(f"Batch ID: {batch.id}")

    # 3. Wait for completion
    while True:
        status = client.messages.batches.retrieve(batch.id)
        counts = status.request_counts
        print(f"Processing: {counts.processing}, Succeeded: {counts.succeeded}, "
              f"Errored: {counts.errored}")

        if status.processing_status == "ended":
            break

        time.sleep(30)

    # 4. Retrieve results
    results = []
    for result in client.messages.batches.results(batch.id):
        if result.result.type == "succeeded":
            results.append({
                "id": result.custom_id,
                "content": result.result.message.content[0].text,
            })
        else:
            print(f"Error: {result.custom_id}: {result.result}")

    return results
```

### 3.3 Managing Rate Limits

```python
import asyncio
import time
from dataclasses import dataclass
from collections import deque

@dataclass
class RateLimiter:
    """Token-bucket-based rate limiter"""
    requests_per_minute: int
    tokens_per_minute: int
    _request_times: deque = None
    _token_counts: deque = None

    def __post_init__(self):
        self._request_times = deque()
        self._token_counts = deque()

    async def acquire(self, estimated_tokens: int = 1000):
        """Wait until a request can be made within the rate limit"""
        while True:
            now = time.time()
            window = now - 60  # 1-minute window

            # Remove stale entries
            while self._request_times and self._request_times[0] < window:
                self._request_times.popleft()
            while self._token_counts and self._token_counts[0][0] < window:
                self._token_counts.popleft()

            # Check current rate
            current_requests = len(self._request_times)
            current_tokens = sum(tc[1] for tc in self._token_counts)

            if (current_requests < self.requests_per_minute and
                current_tokens + estimated_tokens < self.tokens_per_minute):
                self._request_times.append(now)
                self._token_counts.append((now, estimated_tokens))
                return

            # Wait until the oldest entry expires
            if self._request_times:
                wait_time = self._request_times[0] - window + 0.1
                await asyncio.sleep(max(wait_time, 0.1))
            else:
                await asyncio.sleep(0.1)


# Usage example: parallel processing with rate limiting
async def process_with_rate_limit(
    prompts: list[str],
    rpm: int = 60,
    tpm: int = 100_000,
):
    """Parallel processing while respecting rate limits"""
    from openai import AsyncOpenAI

    client = AsyncOpenAI()
    limiter = RateLimiter(requests_per_minute=rpm, tokens_per_minute=tpm)

    async def process_one(prompt: str, idx: int) -> dict:
        estimated_tokens = len(prompt.split()) * 2 + 200  # rough estimate
        await limiter.acquire(estimated_tokens)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
        )

        return {
            "index": idx,
            "content": response.choices[0].message.content,
            "tokens": response.usage.total_tokens,
        }

    tasks = [process_one(p, i) for i, p in enumerate(prompts)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if isinstance(r, dict)]
    errors = [r for r in results if isinstance(r, Exception)]

    print(f"Succeeded: {len(successes)}, Errors: {len(errors)}")
    return successes
```

### 3.4 Retry Logic and Error Handling

```python
import asyncio
import random
from openai import AsyncOpenAI, RateLimitError, APIError, APITimeoutError

async def resilient_request(
    client: AsyncOpenAI,
    prompt: str,
    max_retries: int = 5,
    base_delay: float = 1.0,
) -> str:
    """Retry with exponential backoff"""

    for attempt in range(max_retries):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                timeout=30.0,
            )
            return response.choices[0].message.content

        except RateLimitError as e:
            # Rate limit: wait longer
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            # Use Retry-After header if available
            retry_after = getattr(e, "retry_after", None)
            if retry_after:
                delay = max(delay, float(retry_after))
            print(f"Rate limited (attempt {attempt+1}): waiting {delay:.1f}s")
            await asyncio.sleep(delay)

        except APITimeoutError:
            delay = base_delay * (2 ** attempt)
            print(f"Timeout (attempt {attempt+1}): retrying in {delay:.1f}s")
            await asyncio.sleep(delay)

        except APIError as e:
            if e.status_code and e.status_code >= 500:
                # Server error: retry
                delay = base_delay * (2 ** attempt)
                print(f"Server error {e.status_code} (attempt {attempt+1})")
                await asyncio.sleep(delay)
            else:
                # Client error: do not retry
                raise

    raise RuntimeError(f"Reached maximum retry count ({max_retries})")


# Concise retry using the Tenacity library
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type,
)

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=60),
    retry=retry_if_exception_type((RateLimitError, APITimeoutError)),
)
async def reliable_request(client: AsyncOpenAI, prompt: str) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
    )
    return response.choices[0].message.content
```

### Comparison Table 1: Recommended Parameter Settings by Use Case

| Use Case | temperature | top_p | max_tokens | Notes |
|----------|-------------|-------|------------|-------|
| Code generation | 0.0–0.2 | 1.0 | Sufficiently large | Deterministic output preferred |
| Writing | 0.7–0.9 | 0.95 | As needed | Balance diversity and quality |
| Data extraction | 0.0 | 1.0 | Minimum necessary | Accuracy-focused |
| Brainstorming | 1.0–1.2 | 0.95 | Large | Creativity-focused |
| Translation | 0.0–0.3 | 1.0 | ~1.5x source length | Accuracy-focused |
| Summarization | 0.0–0.3 | 1.0 | ~1/3 of source length | Accuracy-focused |

### Comparison Table 2: Inference Optimization Techniques

| Technique | Latency Improvement | Throughput Improvement | Cost Reduction | Implementation Complexity |
|-----------|--------------------|-----------------------|----------------|--------------------------|
| Streaming | TTFB greatly improved | No change | No change | Low |
| Batch processing | No change | Greatly improved | 50% (OpenAI) | Medium |
| Prompt caching | Improved | Improved | Up to 90% | Low |
| KV cache | Improved | Improved | Indirect | High (local only) |
| Quantization (local) | Greatly improved | Improved | Reduces GPU cost | Medium–High |
| Speculative Decoding | Improved | Improved | Indirect | High |

---

## 4. Prompt Caching

### 4.1 Anthropic Prompt Caching

```python
import anthropic

client = anthropic.Anthropic()

# Cache a long system prompt
long_system = """
あなたは金融分析の専門家です。以下のルールに従ってください:
1. 数値は必ず出典を明記する
2. 推測と事実を明確に区別する
3. リスクファクターを必ず言及する
... (数千トークンの詳細ルール)
"""

# Explicitly enable caching via cache_control
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1000,
    system=[
        {
            "type": "text",
            "text": long_system,
            "cache_control": {"type": "ephemeral"},  # enable caching
        }
    ],
    messages=[
        {"role": "user", "content": "今四半期の決算分析をお願いします"},
    ],
)

# Check cache usage
print(f"Input tokens: {response.usage.input_tokens}")
print(f"Cache creation: {response.usage.cache_creation_input_tokens}")
print(f"Cache read: {response.usage.cache_read_input_tokens}")

# From the second request onward, cache_read_input_tokens increases
# Input token cost is 90% cheaper on a cache hit
```

### 4.2 OpenAI Automatic Caching

```python
from openai import OpenAI

client = OpenAI()

# OpenAI automatically caches common prefixes (1024+ tokens)
long_context = "..." * 2000  # long context

# First request: create cache
response1 = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": long_context},
        {"role": "user", "content": "質問1"},
    ],
)
print(f"Cached tokens: {response1.usage.prompt_tokens_details.cached_tokens}")

# Second request: cache hit if the same prefix is used (50% OFF)
response2 = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": long_context},  # same
        {"role": "user", "content": "質問2"},           # different
    ],
)
print(f"Cached tokens: {response2.usage.prompt_tokens_details.cached_tokens}")
```

---

## 5. Advanced Inference Optimization

### 5.1 Speculative Decoding

```
┌──────────────────────────────────────────────────────────┐
│         How Speculative Decoding Works                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Standard decoding (Auto-Regressive):                    │
│  Large model: [t1] → [t2] → [t3] → [t4] → [t5]        │
│  Each step requires full computation by the large model  │
│  Latency: 5 × T_large                                   │
│                                                          │
│  Speculative Decoding:                                   │
│  Small model: [t1, t2, t3, t4, t5] ← fast draft        │
│  Large model: [t1, t2, t3, ?, ?]   ← batch verify      │
│               t1 ✓  t2 ✓  t3 ✓  t4 ✗ (rejected)       │
│  Large model: [t4'] → [t5']        ← regenerate         │
│                                    from rejection point  │
│                                                          │
│  Benefits:                                               │
│  - Output quality is identical to the large model        │
│    (guaranteed)                                          │
│  - 2–3x speedup when draft tokens are accepted           │
│  - Additional GPU memory is only for the small model     │
│                                                          │
│  Drawbacks:                                              │
│  - Low draft accuracy reduces the benefit                │
│  - Implementation complexity                             │
│  - Limited benefit in batch inference                    │
└──────────────────────────────────────────────────────────┘
```

### 5.2 KV Cache Optimization

```python
# KV cache configuration with vLLM
"""
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --dtype bfloat16 \
    --gpu-memory-utilization 0.9 \
    --max-model-len 8192 \
    --enable-prefix-caching \        # enable prefix caching
    --max-num-batched-tokens 32768   # maximum batched tokens
"""

# Effect of prefix caching:
# When consecutive requests share the same system prompt,
# reusing the KV cache greatly reduces TTFT.

# KV cache configuration with llama.cpp
"""
./llama-server \
    -m model.gguf \
    -c 8192 \          # context length
    --cache-type-k q8_0 \  # quantize K cache to 8-bit
    --cache-type-v q8_0 \  # quantize V cache to 8-bit
    -ngl 99                 # all layers on GPU
"""

# KV cache memory calculation
def estimate_kv_cache_memory(
    num_layers: int = 32,
    num_heads: int = 32,
    head_dim: int = 128,
    seq_len: int = 8192,
    batch_size: int = 1,
    dtype_bytes: int = 2,  # FP16 = 2 bytes
) -> float:
    """Estimate KV cache memory usage (GB)"""
    # Both K and V
    kv_cache_bytes = (
        2 *  # K + V
        num_layers *
        num_heads *
        head_dim *
        seq_len *
        batch_size *
        dtype_bytes
    )
    return kv_cache_bytes / (1024 ** 3)

# For Llama 3.1 8B
memory_gb = estimate_kv_cache_memory(
    num_layers=32, num_heads=32, head_dim=128,
    seq_len=8192, batch_size=1, dtype_bytes=2,
)
print(f"KV cache: {memory_gb:.2f} GB")  # ~2GB
```

### 5.3 Structured Output

```python
from openai import OpenAI
from pydantic import BaseModel
from typing import Optional

client = OpenAI()

# Define the output schema with a Pydantic model
class MovieReview(BaseModel):
    title: str
    rating: float
    sentiment: str  # positive / negative / neutral
    key_points: list[str]
    recommendation: bool

# Structured Outputs API (guarantees 100% schema compliance)
response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "映画レビューを分析してください"},
        {"role": "user", "content": "「この映画は最高！演技が素晴らしく、脚本も完璧。必見です。」"},
    ],
    response_format=MovieReview,
)

review = response.choices[0].message.parsed
print(f"Title: {review.title}")
print(f"Rating: {review.rating}")
print(f"Sentiment: {review.sentiment}")
print(f"Recommendation: {review.recommendation}")


# JSON output with Claude
import anthropic
import json

client_claude = anthropic.Anthropic()

response = client_claude.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1000,
    messages=[{
        "role": "user",
        "content": """以下のテキストから情報を抽出してJSON形式で出力してください。

テキスト: 「田中太郎（35歳）は東京都在住のエンジニアです。年収800万円。」

出力形式:
{"name": "", "age": 0, "location": "", "occupation": "", "income": 0}"""
    }],
)

# Claude has no JSON Mode, so handle parse errors explicitly
try:
    data = json.loads(response.content[0].text)
except json.JSONDecodeError:
    # Extract the JSON portion from the text
    import re
    json_match = re.search(r'\{.*\}', response.content[0].text, re.DOTALL)
    if json_match:
        data = json.loads(json_match.group())
```

---

## 6. Performance Measurement and Monitoring

### 6.1 Measuring Inference Metrics

```python
import time
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class InferenceMetrics:
    """Inference performance metrics"""
    ttfb: float = 0.0          # Time To First Byte (seconds)
    total_time: float = 0.0     # Total response time (seconds)
    input_tokens: int = 0       # Number of input tokens
    output_tokens: int = 0      # Number of output tokens
    tokens_per_second: float = 0.0  # Output speed (tok/s)
    cost: float = 0.0           # Cost ($)
    model: str = ""
    cached_tokens: int = 0

    def __str__(self):
        return (
            f"Model: {self.model}\n"
            f"TTFB: {self.ttfb:.3f}s\n"
            f"Total: {self.total_time:.3f}s\n"
            f"Input: {self.input_tokens} tokens\n"
            f"Output: {self.output_tokens} tokens\n"
            f"Speed: {self.tokens_per_second:.1f} tok/s\n"
            f"Cache: {self.cached_tokens} tokens\n"
            f"Cost: ${self.cost:.6f}"
        )


async def measure_inference(
    client,
    model: str,
    prompt: str,
    pricing: tuple = (0.15, 0.60),  # (input $/1M, output $/1M)
) -> tuple[str, InferenceMetrics]:
    """Measure inference performance"""
    metrics = InferenceMetrics(model=model)
    start = time.time()
    first_token_time = None
    full_text = ""

    stream = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
        stream_options={"include_usage": True},
        max_tokens=1000,
    )

    async for chunk in stream:
        if first_token_time is None and chunk.choices and chunk.choices[0].delta.content:
            first_token_time = time.time()
            metrics.ttfb = first_token_time - start

        if chunk.choices and chunk.choices[0].delta.content:
            full_text += chunk.choices[0].delta.content

        if chunk.usage:
            metrics.input_tokens = chunk.usage.prompt_tokens
            metrics.output_tokens = chunk.usage.completion_tokens
            if hasattr(chunk.usage, "prompt_tokens_details") and chunk.usage.prompt_tokens_details:
                metrics.cached_tokens = chunk.usage.prompt_tokens_details.cached_tokens or 0

    metrics.total_time = time.time() - start
    if metrics.output_tokens > 0 and metrics.total_time > 0:
        metrics.tokens_per_second = metrics.output_tokens / metrics.total_time

    # Cost calculation
    in_price, out_price = pricing
    metrics.cost = (
        (metrics.input_tokens / 1_000_000) * in_price +
        (metrics.output_tokens / 1_000_000) * out_price
    )

    return full_text, metrics
```

### 6.2 Aggregation for Dashboards

```python
from collections import defaultdict
import statistics

class InferenceMonitor:
    """Continuous inference performance monitoring"""

    def __init__(self):
        self.metrics_history: list[InferenceMetrics] = []

    def record(self, metrics: InferenceMetrics):
        self.metrics_history.append(metrics)

    def summary(self, last_n: int = 100) -> dict:
        """Aggregated summary for the most recent N requests"""
        recent = self.metrics_history[-last_n:]

        if not recent:
            return {}

        return {
            "total_requests": len(recent),
            "avg_ttfb": statistics.mean(m.ttfb for m in recent),
            "p50_ttfb": statistics.median(m.ttfb for m in recent),
            "p95_ttfb": sorted(m.ttfb for m in recent)[int(len(recent) * 0.95)],
            "avg_total_time": statistics.mean(m.total_time for m in recent),
            "avg_tokens_per_second": statistics.mean(m.tokens_per_second for m in recent),
            "total_input_tokens": sum(m.input_tokens for m in recent),
            "total_output_tokens": sum(m.output_tokens for m in recent),
            "total_cost": sum(m.cost for m in recent),
            "avg_cost_per_request": statistics.mean(m.cost for m in recent),
            "cache_hit_rate": (
                sum(m.cached_tokens for m in recent) /
                max(sum(m.input_tokens for m in recent), 1)
            ),
        }

    def print_report(self):
        """Print report"""
        s = self.summary()
        if not s:
            print("No data")
            return

        print("=== Inference Performance Report ===")
        print(f"Requests: {s['total_requests']}")
        print(f"TTFB (avg/p50/p95): {s['avg_ttfb']:.3f}s / "
              f"{s['p50_ttfb']:.3f}s / {s['p95_ttfb']:.3f}s")
        print(f"Total time (avg): {s['avg_total_time']:.3f}s")
        print(f"Output speed (avg): {s['avg_tokens_per_second']:.1f} tok/s")
        print(f"Total tokens: IN={s['total_input_tokens']:,} / OUT={s['total_output_tokens']:,}")
        print(f"Total cost: ${s['total_cost']:.4f}")
        print(f"Cost per request: ${s['avg_cost_per_request']:.6f}")
        print(f"Cache hit rate: {s['cache_hit_rate']:.1%}")
```

---

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

```
┌──────────────────────────────────────────────────────────┐
│         Inference Troubleshooting Guide                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue 1: Output is cut off mid-way                      │
│  Cause: max_tokens is too small                          │
│  Solution:                                               │
│  - Check finish_reason ("length" means it was cut off)   │
│  - Increase max_tokens                                   │
│  - Consider splitting into multiple requests for long    │
│    outputs                                               │
│                                                          │
│  Issue 2: Slow response                                  │
│  Cause: model size, input length, server load            │
│  Solution:                                               │
│  - Switch to a Flash/mini model                          │
│  - Shorten the input prompt                              │
│  - Use streaming to improve TTFB                         │
│  - Enable prompt caching                                 │
│                                                          │
│  Issue 3: 429 Too Many Requests                          │
│  Cause: rate limit reached                               │
│  Solution:                                               │
│  - Retry with exponential backoff                        │
│  - Respect the Retry-After header                        │
│  - Reduce parallelism                                    │
│  - Switch to Batch API                                   │
│  - Request a quota increase                              │
│                                                          │
│  Issue 4: Output varies each time (lack of              │
│  reproducibility)                                        │
│  Cause: randomness of sampling                           │
│  Solution:                                               │
│  - Set temperature=0                                     │
│  - Specify the seed parameter                            │
│  - Log the system_fingerprint                            │
│  - Pin the model version                                 │
│                                                          │
│  Issue 5: JSON output is malformed                       │
│  Cause: instability of unstructured output               │
│  Solution:                                               │
│  - Specify response_format: json_object (OpenAI)         │
│  - Use the Structured Outputs API                        │
│  - Add error handling when parsing output                │
│  - Retry + validate                                      │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Debugging Code

```python
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("inference")

def debug_response(response, model: str = "unknown"):
    """Output detailed debug information for a response"""

    choice = response.choices[0]

    logger.info(f"=== {model} Response Debug ===")
    logger.info(f"finish_reason: {choice.finish_reason}")
    logger.info(f"input_tokens: {response.usage.prompt_tokens}")
    logger.info(f"output_tokens: {response.usage.completion_tokens}")
    logger.info(f"total_tokens: {response.usage.total_tokens}")

    if hasattr(response.usage, "prompt_tokens_details") and response.usage.prompt_tokens_details:
        details = response.usage.prompt_tokens_details
        logger.info(f"cached_tokens: {details.cached_tokens}")

    if hasattr(response, "system_fingerprint"):
        logger.info(f"system_fingerprint: {response.system_fingerprint}")

    # Show the beginning and end of the output
    content = choice.message.content
    if content:
        logger.info(f"output_length: {len(content)} chars")
        logger.info(f"first_100: {content[:100]}")
        logger.info(f"last_100: {content[-100:]}")

    # Diagnose finish_reason
    if choice.finish_reason == "length":
        logger.warning("Output was cut off by max_tokens. Increase the value.")
    elif choice.finish_reason == "content_filter":
        logger.warning("Output was blocked by the content filter.")

    return {
        "finish_reason": choice.finish_reason,
        "tokens": response.usage.total_tokens,
        "content_length": len(content) if content else 0,
    }
```

---

## Anti-Patterns

### Anti-Pattern 1: Changing Both temperature and top_p Simultaneously

```
Wrong: setting both to extreme values
  temperature=0.2, top_p=0.3
  → unpredictable behavior, overly constrained output

Correct: fix one and adjust only the other
  temperature=0.7, top_p=1.0  # adjust temperature only
  temperature=1.0, top_p=0.8  # adjust top_p only
```

### Anti-Pattern 2: Always Setting max_tokens to the Maximum Value

```
Wrong: setting max_tokens=4096 for every request
  → unnecessary long-form generation, higher costs, increased latency

Correct: set appropriate limits based on the task
  - Classification:   max_tokens=10
  - Summarization:    max_tokens=500
  - Code generation:  max_tokens=2000
  - Long-form writing: max_tokens=4000
```

### Anti-Pattern 3: API Calls Without Error Handling

```python
# Bad: no error handling
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": prompt}],
)
result = response.choices[0].message.content

# Good: comprehensive error handling
try:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        timeout=30.0,
    )

    if response.choices[0].finish_reason == "length":
        logger.warning("Output was cut off")
    elif response.choices[0].finish_reason == "content_filter":
        logger.warning("Content filter triggered")

    result = response.choices[0].message.content

except RateLimitError:
    # retry logic
    pass
except APITimeoutError:
    # timeout handling
    pass
except APIError as e:
    logger.error(f"API error: {e.status_code} - {e.message}")
```

### Anti-Pattern 4: Not Handling Streaming Interruptions Properly

```python
# Bad: potential resource leak during streaming
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": prompt}],
    stream=True,
)
for chunk in stream:
    if some_condition:
        break  # stream may not be properly closed

# Good: guaranteed cleanup with a context manager
with client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": prompt}],
    stream=True,
) as stream:
    for chunk in stream:
        if some_condition:
            break  # __exit__ ensures cleanup
```

---

## FAQ

### Q1: Can the same prompt produce different results even with temperature=0?

**A:** Yes, it can. Due to non-determinism in GPU floating-point arithmetic and the effects of batching, identical results are not guaranteed even with temperature=0. OpenAI's `seed` parameter can improve reproducibility, but does not provide a 100% guarantee.

### Q2: Does using streaming change the cost?

**A:** No, the token consumption (and therefore cost) is the same. Streaming only changes how the response is delivered; the number of tokens generated does not change. However, because streaming keeps the connection open longer, the server resource consumption pattern differs.

### Q3: When should I use batch processing?

**A:** It is ideal for high-volume workloads (hundreds to tens of thousands of requests) where real-time responses are not required — for example, bulk document classification, dataset labeling, or content generation. The OpenAI Batch API offers a 50% discount, and Anthropic's Batch API offers a similar discount, with results returned within 24 hours.

### Q4: How effective is prompt caching?

**A:** With Anthropic's prompt caching, input token costs are reduced by 90% on a cache hit. OpenAI offers a 50% reduction. The benefit is especially significant when repeatedly using long system prompts or RAG contexts, and can reduce monthly costs by 40–70% in some cases. Cache expiry is 5 minutes for Anthropic; OpenAI manages it automatically.

### Q5: What can Logprobs be used for?

**A:** The main use cases are: (1) computing confidence scores — estimating overall generation confidence from per-token probabilities; (2) automatic fallback — switching to a different model when confidence is low; (3) estimating probabilities for classification tasks — retrieving Yes/No probabilities directly; and (4) hallucination detection — identifying regions with many low-probability tokens. Note that the Claude API does not provide logprobs.

### Q6: What is the difference between Structured Outputs and JSON Mode?

**A:** JSON Mode (`response_format: json_object`) only guarantees that the output is valid JSON; it does not guarantee schema compliance. Structured Outputs guarantees 100% compliance with a schema defined using Pydantic models or similar tools. The recommended approach is to use Structured Outputs for critical data extraction and JSON Mode for flexible JSON output.

---

## Summary

| Topic | Key Point |
|-------|-----------|
| temperature | Controls output randomness from 0.0 (deterministic) to 1.5 (high diversity) |
| top_p | Filters candidate tokens by cumulative probability |
| Streaming | Greatly reduces TTFB; essential for UX improvement |
| Batch processing | Reduces cost via parallel/async processing of large request volumes |
| max_tokens | Optimize cost by setting appropriate limits per task |
| Prompt caching | Up to 90% cost reduction by reusing repeated prefixes |
| Logprobs | Useful for confidence estimation and fallback decisions |
| Structured Outputs | Guarantees schema-compliant structured output |
| Inference optimization | Combining caching, quantization, and batching is most effective |
| Error handling | Exponential backoff, timeouts, and retries are essential |

---

## Recommended Next Reads

- [03-fine-tuning.md](./03-fine-tuning.md) — Customizing models through fine-tuning
- [../02-applications/00-prompt-engineering.md](../02-applications/00-prompt-engineering.md) — Prompt design techniques
- [../03-infrastructure/00-api-integration.md](../03-infrastructure/00-api-integration.md) — Practical API integration

---

## References

1. Holtzman, A. et al. (2020). "The Curious Case of Neural Text Degeneration." *ICLR 2020*. https://arxiv.org/abs/1904.09751
2. Anthropic. "Messages API Reference." https://docs.anthropic.com/en/api/messages
3. OpenAI. "Chat Completions API." https://platform.openai.com/docs/api-reference/chat
4. Leviathan, Y. et al. (2023). "Fast Inference from Transformers via Speculative Decoding." *ICML 2023*. https://arxiv.org/abs/2211.17192
5. OpenAI. "Structured Outputs Guide." https://platform.openai.com/docs/guides/structured-outputs
6. Anthropic. "Prompt Caching." https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
