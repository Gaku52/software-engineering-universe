# GPT — OpenAI Large Language Models

> A practical guide to GPT-4o, the o1/o3 reasoning models, API usage, and an overview of the entire OpenAI ecosystem.

## What You Will Learn

1. The evolution of the **GPT family** and the characteristics of each model (GPT-4o, o1, o3)
2. Practical usage of the **OpenAI API** (Chat Completions, Assistants)
3. How **reasoning models (o1/o3)** work and when to use them versus standard models


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Claude — Anthropic's AI Assistant](./00-claude.md)

---

## 1. Overview of the GPT Family

### ASCII Diagram 1: Evolution of GPT Models

```
GPT Family Evolution
──────────────────────────────────────────────────→ Time

2020  GPT-3 (175B)
      │  First large-scale API offering
      ▼
2022  ChatGPT (GPT-3.5-turbo)
      │  Democratization of conversational AI
      ▼
2023  GPT-4 (estimated MoE 1.8T)
      │  Multimodal support
      ├── GPT-4 Turbo (128K context)
      │
      ▼
2024  GPT-4o ("omni")
      │  Fast, low-cost, integrated multimodal
      ├── GPT-4o mini (compact, high-speed)
      │
      ├── o1-preview / o1-mini
      │   Reasoning-specialized models (built-in Chain-of-Thought)
      ▼
2025  o3 / o3-mini
      │  Advanced reasoning capabilities
      ├── GPT-4.5 (research preview)
      └── GPT-5 (planned)
```

### Code Example 1: OpenAI API Basics

```python
from openai import OpenAI

client = OpenAI()  # OPENAI_API_KEY 環境変数を使用

# Chat Completions API
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "簡潔に日本語で回答してください。"},
        {"role": "user", "content": "量子コンピュータの原理を説明してください。"}
    ],
    temperature=0.7,
    max_tokens=500,
)

print(response.choices[0].message.content)
print(f"トークン使用量: {response.usage}")
```

### Code Example 2: Using o1/o3 Reasoning Models

```python
from openai import OpenAI

client = OpenAI()

# o1 / o3 は推論に時間をかける (Chain-of-Thought が内蔵)
response = client.chat.completions.create(
    model="o3-mini",
    messages=[{
        "role": "user",
        "content": """
        次の数学の問題を解いてください:

        100人が参加するトーナメント形式の試合で、
        1人の優勝者が決まるまでに必要な試合数は？
        その理由も説明してください。
        """
    }],
    # o1/o3 では temperature, top_p は設定不可
    # max_completion_tokens を使用 (max_tokens ではなく)
    max_completion_tokens=5000,
    reasoning_effort="medium",  # "low", "medium", "high"
)

print(response.choices[0].message.content)
# 推論トークン数も確認
print(f"推論トークン: {response.usage.completion_tokens_details.reasoning_tokens}")
```

### ASCII Diagram 2: GPT-4o vs o1/o3 Processing Flow

```
GPT-4o (Fast Response):
User → [Prompt] → Immediate response generation → Response
                  ~1-3 seconds
                  Single-pass answer

o1/o3 (Deep Reasoning):
User → [Prompt] → Internal reasoning chain → Response
                  │                       │
                  │ Step 1: Analyze problem│
                  │ Step 2: Hypothesize    │
                  │ Step 3: Verify         │
                  │ Step 4: Reconsider     │
                  │ ...                    │
                  └───────────────────────┘
                  ~10-60 seconds
                  Multi-step reasoning
```

### Code Example 3: Structured Outputs

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class TechArticle(BaseModel):
    title: str
    summary: str
    tags: list[str]
    difficulty: str  # "beginner", "intermediate", "advanced"
    estimated_reading_minutes: int

response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "技術記事を分析してJSON形式で出力。"},
        {"role": "user", "content": """
        以下の記事を分析してください:

        「Rustのライフタイムは、メモリ安全性を保証する仕組みです。
        コンパイラが参照の有効期間を追跡し、ダングリングポインタを
        防止します。'a のような記法で明示的に指定することもできます。」
        """}
    ],
    response_format=TechArticle,
)

article = response.choices[0].message.parsed
print(f"タイトル: {article.title}")
print(f"難易度: {article.difficulty}")
print(f"タグ: {article.tags}")
```

### Code Example 4: Assistants API (Persistent Threads)

```python
from openai import OpenAI

client = OpenAI()

# アシスタント作成
assistant = client.beta.assistants.create(
    name="データ分析アシスタント",
    instructions="あなたはデータ分析の専門家です。Pythonコードを使って分析を行います。",
    tools=[{"type": "code_interpreter"}],
    model="gpt-4o",
)

# スレッド作成
thread = client.beta.threads.create()

# メッセージ追加
client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="1から100までの素数をリストアップし、その分布をグラフにしてください。"
)

# 実行
run = client.beta.threads.runs.create_and_poll(
    thread_id=thread.id,
    assistant_id=assistant.id,
)

# 結果取得
if run.status == "completed":
    messages = client.beta.threads.messages.list(thread_id=thread.id)
    for msg in messages.data:
        if msg.role == "assistant":
            for block in msg.content:
                if block.type == "text":
                    print(block.text.value)
```

### Code Example 5: Combining Image Generation (DALL-E 3) and Image Understanding

```python
from openai import OpenAI
import base64

client = OpenAI()

# 1. 画像生成
image_response = client.images.generate(
    model="dall-e-3",
    prompt="ミニマリストなスタイルのAIロボットが本を読んでいるイラスト",
    size="1024x1024",
    quality="hd",
    n=1,
)
image_url = image_response.data[0].url
print(f"画像URL: {image_url}")

# 2. GPT-4o で画像理解
analysis = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "この画像を分析してください。"},
            {"type": "image_url", "image_url": {"url": image_url}},
        ],
    }],
    max_tokens=500,
)
print(analysis.choices[0].message.content)
```

---

## 2. Overview of the OpenAI Ecosystem

### ASCII Diagram 3: OpenAI Ecosystem Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  OpenAI Ecosystem                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Foundation Models                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ GPT-4o     │  │ o3/o3-mini │  │ GPT-4o     │         │
│  │ (General)  │  │ (Reasoning)│  │ mini       │         │
│  └────────────┘  └────────────┘  └────────────┘         │
│                                                          │
│  API Services                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ Chat       │  │ Assistants │  │ Batch      │         │
│  │ Completions│  │ API        │  │ API        │         │
│  └────────────┘  └────────────┘  └────────────┘         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ Embeddings │  │ Audio      │  │ Images     │         │
│  │ API        │  │ (Whisper)  │  │ (DALL-E 3) │         │
│  └────────────┘  └────────────┘  └────────────┘         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ Fine-      │  │ Moderation │  │ Realtime   │         │
│  │ tuning     │  │ API        │  │ API        │         │
│  └────────────┘  └────────────┘  └────────────┘         │
│                                                          │
│  Products                                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ ChatGPT    │  │ Custom     │  │ ChatGPT    │         │
│  │ (Consumer) │  │ GPTs       │  │ Enterprise │         │
│  └────────────┘  └────────────┘  └────────────┘         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Advanced API Features

### 3.1 Detailed Implementation of Function Calling

```python
from openai import OpenAI
import json
from typing import Any

client = OpenAI()

# 複数のツール定義
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_price",
            "description": "指定された銘柄の現在の株価を取得します",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "株式のティッカーシンボル（例: AAPL, GOOGL, MSFT）"
                    },
                    "currency": {
                        "type": "string",
                        "enum": ["USD", "JPY", "EUR"],
                        "description": "表示通貨"
                    }
                },
                "required": ["symbol"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_portfolio_return",
            "description": "ポートフォリオの期待リターンを計算します",
            "parameters": {
                "type": "object",
                "properties": {
                    "holdings": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "symbol": {"type": "string"},
                                "weight": {"type": "number"},
                                "expected_return": {"type": "number"}
                            },
                            "required": ["symbol", "weight"]
                        },
                        "description": "保有銘柄のリスト"
                    },
                    "period": {
                        "type": "string",
                        "enum": ["1m", "3m", "6m", "1y", "5y"],
                        "description": "計算期間"
                    }
                },
                "required": ["holdings"]
            }
        }
    }
]

# Agent loop with parallel tool call support
def agent_loop(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]

    max_iterations = 10
    for _ in range(max_iterations):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            tool_choice="auto",
        )

        message = response.choices[0].message
        messages.append(message)

        if not message.tool_calls:
            return message.content

        # Process all parallel tool calls
        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)

            # Execute tool (in practice, makes actual API calls, etc.)
            result = dispatch_function(func_name, args)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

    return "処理が上限に達しました。"

def dispatch_function(name: str, args: dict) -> Any:
    """Execute tool based on function name"""
    functions = {
        "get_stock_price": lambda **a: {"price": 185.42, "currency": a.get("currency", "USD")},
        "calculate_portfolio_return": lambda **a: {"expected_return": 0.12, "risk": 0.08},
    }
    return functions.get(name, lambda **a: {"error": "Unknown function"})(**args)
```

### 3.2 Leveraging Prompt Caching

```python
from openai import OpenAI

client = OpenAI()

# Large system prompt (used repeatedly)
LARGE_SYSTEM_PROMPT = """
あなたは金融アナリストです。以下のルールに従ってください：
1. 市場分析は客観的データに基づく
2. リスク要因を必ず明記する
3. 法的助言ではないことを明示する
... (大量の指示テキスト)
"""

# OpenAI prompt caching is applied automatically
# Cache kicks in when the same prefix is 1024+ tokens
# Cache hit reduces input token cost by 50%

# Verify caching effect
for query in ["銘柄Aの分析", "銘柄Bの分析", "銘柄Cの分析"]:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": LARGE_SYSTEM_PROMPT},
            {"role": "user", "content": query}
        ],
    )

    # usage contains cache information
    usage = response.usage
    cached = getattr(usage, 'prompt_tokens_details', None)
    if cached:
        print(f"キャッシュヒット: {cached.cached_tokens} tokens")
    print(f"合計入力: {usage.prompt_tokens} tokens")
```

### 3.3 Batch API (Asynchronous Bulk Processing)

```python
from openai import OpenAI
import json

client = OpenAI()

# 1. Prepare batch requests (JSONL format)
batch_requests = []
for i, query in enumerate(["分析1", "分析2", "分析3"]):
    batch_requests.append({
        "custom_id": f"request-{i}",
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "簡潔に回答してください。"},
                {"role": "user", "content": query}
            ],
            "max_tokens": 200,
        }
    })

# Write to JSONL file
with open("batch_input.jsonl", "w") as f:
    for req in batch_requests:
        f.write(json.dumps(req) + "\n")

# 2. Upload file
batch_file = client.files.create(
    file=open("batch_input.jsonl", "rb"),
    purpose="batch"
)

# 3. Create batch job
batch_job = client.batches.create(
    input_file_id=batch_file.id,
    endpoint="/v1/chat/completions",
    completion_window="24h",  # Complete within 24 hours
    metadata={"description": "大量分析バッチ"}
)

print(f"バッチID: {batch_job.id}")
print(f"ステータス: {batch_job.status}")

# 4. Check status
status = client.batches.retrieve(batch_job.id)
print(f"進捗: {status.request_counts}")

# 5. Retrieve results (after completion)
if status.status == "completed":
    result_file = client.files.content(status.output_file_id)
    for line in result_file.text.strip().split("\n"):
        result = json.loads(line)
        print(f"{result['custom_id']}: {result['response']['body']['choices'][0]['message']['content'][:80]}...")

# Cost: processed at 50% discount compared to standard pricing
```

---

## 4. Realtime API (Voice Interaction)

### 4.1 Overview of the Realtime API

```
┌──────────────────────────────────────────────────────────┐
│            GPT-4o Realtime API Architecture              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Client                        Server                    │
│  ┌──────────┐               ┌──────────┐               │
│  │ Mic Input │ ──WebSocket──▶│ GPT-4o   │               │
│  │ (PCM16)  │               │ Realtime │               │
│  └──────────┘               │          │               │
│  ┌──────────┐               │ · Speech recognition     │
│  │ Speaker  │ ◀──WebSocket──│ · Reasoning │             │
│  │ (PCM16)  │               │ · Speech synthesis       │
│  └──────────┘               └──────────┘               │
│                                                          │
│  Features:                                               │
│  - Unified processing: audio→text→reasoning→text→audio  │
│  - Skip intermediate text conversion (low latency)       │
│  - Conversation barge-in support                         │
│  - 6 voices (alloy, echo, fable, onyx, nova, shimmer)   │
│  - Input: $5.00/1M tokens, Output: $20.00/1M tokens     │
│                                                          │
│  Use Cases:                                              │
│  - Voice assistants                                      │
│  - Customer support voice response                       │
│  - Language learning apps                                │
│  - Accessibility tools                                   │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Realtime API Implementation Example

```python
import asyncio
import websockets
import json
import base64

async def realtime_voice_assistant():
    """Voice assistant using GPT-4o Realtime API"""

    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "OpenAI-Beta": "realtime=v1",
    }

    async with websockets.connect(url, extra_headers=headers) as ws:
        # Session configuration
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "instructions": """あなたは日本語の会話アシスタントです。
                                  自然な口語で回答してください。
                                  専門用語は分かりやすく説明してください。""",
                "voice": "nova",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1"
                },
                "turn_detection": {
                    "type": "server_vad",  # Server-side voice activity detection
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                },
                "tools": [
                    {
                        "type": "function",
                        "name": "get_current_time",
                        "description": "現在の日時を取得します",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "timezone": {
                                    "type": "string",
                                    "description": "タイムゾーン（例: Asia/Tokyo）"
                                }
                            }
                        }
                    }
                ],
            },
        }))

        # Message receive loop
        async for message in ws:
            event = json.loads(message)
            event_type = event.get("type", "")

            if event_type == "session.created":
                print("Session started")

            elif event_type == "response.audio.delta":
                # Receive audio chunk → send to speaker
                audio_data = base64.b64decode(event["delta"])
                # play_audio(audio_data)  # Actual playback processing

            elif event_type == "response.audio_transcript.delta":
                # Transcription result
                print(event["delta"], end="", flush=True)

            elif event_type == "input_audio_buffer.speech_started":
                print("\n[Speech detection started]")

            elif event_type == "response.function_call_arguments.done":
                # Handle tool call
                func_name = event.get("name")
                args = json.loads(event.get("arguments", "{}"))
                result = handle_function_call(func_name, args)

                await ws.send(json.dumps({
                    "type": "conversation.item.create",
                    "item": {
                        "type": "function_call_output",
                        "call_id": event["call_id"],
                        "output": json.dumps(result),
                    }
                }))
                await ws.send(json.dumps({"type": "response.create"}))
```

---

## 5. Fine-tuning in Practice

### 5.1 Fine-tuning GPT-4o mini

```python
from openai import OpenAI
import json

client = OpenAI()

# 1. Prepare training data
training_data = [
    {
        "messages": [
            {"role": "system", "content": "あなたは技術ドキュメントの要約専門家です。"},
            {"role": "user", "content": "以下のドキュメントを200字以内で要約してください:\n\n[ドキュメントテキスト1]"},
            {"role": "assistant", "content": "[理想的な要約1]"}
        ]
    },
    {
        "messages": [
            {"role": "system", "content": "あなたは技術ドキュメントの要約専門家です。"},
            {"role": "user", "content": "以下のドキュメントを200字以内で要約してください:\n\n[ドキュメントテキスト2]"},
            {"role": "assistant", "content": "[理想的な要約2]"}
        ]
    },
    # Minimum 50 examples, recommended 200-500 examples
]

# 2. Validation data (optional but recommended)
validation_data = training_data[:10]  # Use 10% for validation

# Create JSONL files
for filename, data in [("train.jsonl", training_data), ("val.jsonl", validation_data)]:
    with open(filename, "w") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

# 3. Upload files
train_file = client.files.create(file=open("train.jsonl", "rb"), purpose="fine-tune")
val_file = client.files.create(file=open("val.jsonl", "rb"), purpose="fine-tune")

# 4. Create fine-tuning job
job = client.fine_tuning.jobs.create(
    training_file=train_file.id,
    validation_file=val_file.id,
    model="gpt-4o-mini-2024-07-18",
    hyperparameters={
        "n_epochs": 3,
        "learning_rate_multiplier": "auto",
        "batch_size": "auto",
    },
    suffix="tech-summarizer",  # Suffix for the model name
)

print(f"ジョブID: {job.id}")
print(f"ステータス: {job.status}")

# 5. Monitor status
import time
while True:
    job = client.fine_tuning.jobs.retrieve(job.id)
    print(f"ステータス: {job.status}")

    if job.status in ["succeeded", "failed", "cancelled"]:
        break
    time.sleep(60)

# 6. Use the fine-tuned model
if job.status == "succeeded":
    ft_model = job.fine_tuned_model
    print(f"ファインチューニング済みモデル: {ft_model}")

    response = client.chat.completions.create(
        model=ft_model,
        messages=[
            {"role": "system", "content": "あなたは技術ドキュメントの要約専門家です。"},
            {"role": "user", "content": "以下のドキュメントを200字以内で要約してください:\n\n[新しいドキュメント]"}
        ]
    )
    print(response.choices[0].message.content)
```

### 5.2 Evaluating and Optimizing Fine-tuned Models

```python
from openai import OpenAI
import json

client = OpenAI()

def evaluate_fine_tuned_model(model_id: str, test_data: list) -> dict:
    """Evaluate the quality of a fine-tuned model"""
    results = {
        "total": len(test_data),
        "correct": 0,
        "scores": [],
        "errors": [],
    }

    for item in test_data:
        # Inference with fine-tuned model
        response = client.chat.completions.create(
            model=model_id,
            messages=item["messages"][:-1],  # Exclude assistant response
            temperature=0,
        )
        prediction = response.choices[0].message.content
        expected = item["messages"][-1]["content"]

        # Quality evaluation using LLM-as-a-Judge
        judge_response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""2つのテキストを比較し、1-5のスコアで類似度を評価してください。

期待される出力: {expected}
実際の出力: {prediction}

JSON形式で回答: {{"score": <int>, "reason": "<string>"}}"""
            }],
            response_format={"type": "json_object"},
            temperature=0,
        )

        score_data = json.loads(judge_response.choices[0].message.content)
        results["scores"].append(score_data["score"])

        if score_data["score"] >= 4:
            results["correct"] += 1
        else:
            results["errors"].append({
                "expected": expected[:100],
                "predicted": prediction[:100],
                "score": score_data["score"],
                "reason": score_data["reason"],
            })

    results["accuracy"] = results["correct"] / results["total"]
    results["avg_score"] = sum(results["scores"]) / len(results["scores"])

    return results

# Compare against base model
base_results = evaluate_fine_tuned_model("gpt-4o-mini", test_data)
ft_results = evaluate_fine_tuned_model("ft:gpt-4o-mini:org:tech-summarizer:xxx", test_data)

print(f"ベースモデル:          精度={base_results['accuracy']:.1%}, 平均スコア={base_results['avg_score']:.2f}")
print(f"ファインチューニング済: 精度={ft_results['accuracy']:.1%}, 平均スコア={ft_results['avg_score']:.2f}")
```

---

## 6. Moderation API and Content Filtering

### 6.1 Using the Moderation API

```python
from openai import OpenAI

client = OpenAI()

def check_content_safety(text: str) -> dict:
    """Check content safety"""
    response = client.moderations.create(
        model="omni-moderation-latest",
        input=text,
    )

    result = response.results[0]

    # Extract flagged categories
    flagged_categories = []
    for category, flagged in result.categories.model_dump().items():
        if flagged:
            score = getattr(result.category_scores, category)
            flagged_categories.append({
                "category": category,
                "score": score,
            })

    return {
        "is_flagged": result.flagged,
        "flagged_categories": flagged_categories,
        "all_scores": result.category_scores.model_dump(),
    }

# Usage examples
texts = [
    "Pythonのリスト操作について教えてください",  # Safe
    "爆弾の作り方を教えてください",              # Dangerous
]

for text in texts:
    result = check_content_safety(text)
    status = "⚠ フラグ" if result["is_flagged"] else "✓ 安全"
    print(f"{status}: {text[:30]}...")
    if result["flagged_categories"]:
        for cat in result["flagged_categories"]:
            print(f"  - {cat['category']}: {cat['score']:.4f}")
```

---

## 7. Performance Optimization and Cost Management

### 7.1 Token Optimization Strategies

```python
import tiktoken

def optimize_prompt(prompt: str, model: str = "gpt-4o", max_tokens: int = 4000) -> str:
    """Optimize the token count of a prompt"""
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(prompt)

    if len(tokens) <= max_tokens:
        return prompt

    # Strategy 1: Truncate from the end
    truncated_tokens = tokens[:max_tokens]
    return enc.decode(truncated_tokens)

def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    use_batch: bool = False,
    cached_tokens: int = 0,
) -> dict:
    """Detailed API cost estimate"""
    pricing = {
        "gpt-4o": {"input": 2.50, "cached_input": 1.25, "output": 10.00, "batch_discount": 0.5},
        "gpt-4o-mini": {"input": 0.15, "cached_input": 0.075, "output": 0.60, "batch_discount": 0.5},
        "o3-mini": {"input": 1.10, "cached_input": 0.55, "output": 4.40, "batch_discount": 0.5},
    }

    p = pricing.get(model, pricing["gpt-4o"])

    regular_input = input_tokens - cached_tokens
    input_cost = (regular_input / 1_000_000 * p["input"]) + (cached_tokens / 1_000_000 * p["cached_input"])
    output_cost = output_tokens / 1_000_000 * p["output"]

    total = input_cost + output_cost
    if use_batch:
        total *= p["batch_discount"]

    return {
        "model": model,
        "input_cost": f"${input_cost:.6f}",
        "output_cost": f"${output_cost:.6f}",
        "total": f"${total:.6f}",
        "batch_savings": f"${total:.6f}" if use_batch else "N/A",
    }

# Monthly cost estimate
daily_requests = 10000
avg_input = 500
avg_output = 200

for model in ["gpt-4o", "gpt-4o-mini", "o3-mini"]:
    monthly = estimate_cost(model, avg_input * daily_requests * 30, avg_output * daily_requests * 30)
    print(f"{model:15s}: {monthly['total']}/month")
```

### 7.2 Handling Rate Limits

```python
import asyncio
from openai import AsyncOpenAI, RateLimitError
import time

class RateLimitedClient:
    """OpenAI client with rate limit awareness"""

    def __init__(self, rpm_limit: int = 500, tpm_limit: int = 150000):
        self.client = AsyncOpenAI()
        self.rpm_semaphore = asyncio.Semaphore(rpm_limit)
        self.request_times = []
        self.rpm_limit = rpm_limit
        self.tpm_limit = tpm_limit

    async def create_completion(self, **kwargs):
        """Request with automatic rate limit management"""
        async with self.rpm_semaphore:
            # Check RPM limit
            now = time.time()
            self.request_times = [t for t in self.request_times if now - t < 60]

            if len(self.request_times) >= self.rpm_limit:
                wait = 60 - (now - self.request_times[0])
                await asyncio.sleep(wait)

            self.request_times.append(time.time())

            # Exponential backoff retry
            for attempt in range(5):
                try:
                    return await self.client.chat.completions.create(**kwargs)
                except RateLimitError:
                    wait = 2 ** attempt
                    print(f"Rate limited, waiting {wait} seconds...")
                    await asyncio.sleep(wait)

            raise Exception("Retry limit exceeded")

# Parallel processing for large request volumes
async def process_batch(queries: list[str], model: str = "gpt-4o-mini"):
    rate_client = RateLimitedClient(rpm_limit=500)

    async def process_one(query: str):
        response = await rate_client.create_completion(
            model=model,
            messages=[{"role": "user", "content": query}],
            max_tokens=200,
        )
        return response.choices[0].message.content

    tasks = [process_one(q) for q in queries]
    return await asyncio.gather(*tasks)
```

---

## 8. GPT Model Selection Guide

### Comparison Table 1: Detailed GPT Model Comparison

| Model | Input Price | Output Price | Context | Speed | Best Use Case |
|-------|------------|-------------|---------|-------|---------------|
| GPT-4o | $2.50/1M | $10.00/1M | 128K | Fast | General purpose, multimodal |
| GPT-4o mini | $0.15/1M | $0.60/1M | 128K | Very fast | Lightweight tasks, classification |
| o3-mini | $1.10/1M | $4.40/1M | 200K | Moderate | Reasoning, math, code |
| o1 | $15.00/1M | $60.00/1M | 200K | Slow | Advanced reasoning |
| GPT-4 Turbo | $10.00/1M | $30.00/1M | 128K | Moderate | Legacy |

### Comparison Table 2: When to Use GPT-4o vs o3

| Criterion | GPT-4o | o3 / o3-mini |
|-----------|--------|-------------|
| Response speed | Fast (1-3 sec) | Slow (10-60 sec) |
| Simple Q&A | Optimal | Overkill (not recommended) |
| Math / logic puzzles | Good | Excellent |
| Code generation | Excellent | Excellent (especially complex) |
| Creative writing | Excellent | Not suitable |
| temperature control | Supported | Not supported |
| Streaming | Supported | Supported |
| Cost efficiency | High | Low (large reasoning token overhead) |

### Comparison Table 3: Detailed API Feature Matrix

| Feature | GPT-4o | GPT-4o mini | o3-mini | o1 |
|---------|--------|-------------|---------|-----|
| Chat Completions | ✅ | ✅ | ✅ | ✅ |
| Structured Outputs | ✅ | ✅ | ✅ | ✅ |
| Function Calling | ✅ | ✅ | ✅ | ✅ |
| Vision (image input) | ✅ | ✅ | ❌ | ✅ |
| Audio (Realtime) | ✅ | ❌ | ❌ | ❌ |
| Streaming | ✅ | ✅ | ✅ | ✅ |
| Batch API | ✅ | ✅ | ✅ | ✅ |
| Fine-tuning | ✅ | ✅ | ❌ | ❌ |
| temperature control | ✅ | ✅ | ❌ | ❌ |
| reasoning_effort | ❌ | ❌ | ✅ | ❌ |
| JSON Mode | ✅ | ✅ | ✅ | ✅ |
| Prompt Caching | ✅ | ✅ | ✅ | ✅ |

---

## 9. Troubleshooting

### 9.1 Common Issues and Solutions

```
┌──────────────────────────────────────────────────────────┐
│          GPT API Troubleshooting Guide                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Problem: 429 Too Many Requests                          │
│  Cause: RPM/TPM rate limit reached                       │
│  Solutions:                                              │
│    1. Implement exponential backoff retry                │
│    2. Switch to Batch API                                │
│    3. Request a tier upgrade                             │
│    4. Round-robin across multiple API keys               │
│                                                          │
│  Problem: Output gets cut off midway                     │
│  Cause: Insufficient max_tokens setting                  │
│  Solutions:                                              │
│    1. Increase max_tokens                                │
│    2. Check finish_reason ("stop" vs "length")           │
│    3. Split into multiple requests for long output       │
│                                                          │
│  Problem: Invalid JSON output                            │
│  Cause: Model not adhering to JSON format                │
│  Solutions:                                              │
│    1. Use response_format={"type": "json_object"}        │
│    2. Use Structured Outputs (Pydantic)                  │
│    3. Stabilize with temperature=0                       │
│                                                          │
│  Problem: o3 responses are slow                          │
│  Cause: Time needed to generate reasoning tokens         │
│  Solutions:                                              │
│    1. Prioritize speed with reasoning_effort="low"       │
│    2. Route simple tasks to GPT-4o                       │
│    3. Improve perceived speed with streaming             │
│                                                          │
│  Problem: Costs are higher than expected                 │
│  Cause: Underestimated token consumption                 │
│  Solutions:                                              │
│    1. Monitor real-time consumption via Usage API        │
│    2. Set daily budget alerts                            │
│    3. Consider switching to GPT-4o mini                  │
│    4. Leverage Prompt Caching                            │
│    5. Use Batch API (50% discount)                       │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Debugging Best Practices

```python
from openai import OpenAI
import logging

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openai_debug")

def debug_api_call(prompt: str, model: str = "gpt-4o") -> dict:
    """API call with debug information"""
    client = OpenAI()

    import time
    start = time.time()

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
    )

    elapsed = time.time() - start

    debug_info = {
        "model": response.model,
        "latency_seconds": round(elapsed, 3),
        "input_tokens": response.usage.prompt_tokens,
        "output_tokens": response.usage.completion_tokens,
        "total_tokens": response.usage.total_tokens,
        "finish_reason": response.choices[0].finish_reason,
        "response_preview": response.choices[0].message.content[:200],
    }

    # For reasoning models
    if hasattr(response.usage, 'completion_tokens_details') and response.usage.completion_tokens_details:
        details = response.usage.completion_tokens_details
        if hasattr(details, 'reasoning_tokens') and details.reasoning_tokens:
            debug_info["reasoning_tokens"] = details.reasoning_tokens

    # Cache information
    if hasattr(response.usage, 'prompt_tokens_details') and response.usage.prompt_tokens_details:
        details = response.usage.prompt_tokens_details
        if hasattr(details, 'cached_tokens') and details.cached_tokens:
            debug_info["cached_tokens"] = details.cached_tokens

    logger.info(f"API Call Debug: {debug_info}")
    return debug_info
```

---

## 10. Design Patterns and Best Practices

### 10.1 Model Routing Pattern

```python
class GPTModelRouter:
    """Automatically selects a model based on task complexity"""

    def __init__(self):
        self.client = OpenAI()

    def route(self, task: str, complexity: str = "auto") -> str:
        """Select the optimal model for a task"""
        if complexity == "auto":
            complexity = self._estimate_complexity(task)

        routing_table = {
            "simple": "gpt-4o-mini",      # Classification, extraction, simple Q&A
            "moderate": "gpt-4o",          # Writing, code generation, analysis
            "complex": "o3-mini",          # Math, logical reasoning, complex code
            "expert": "o1",               # Research-level reasoning
        }

        return routing_table.get(complexity, "gpt-4o")

    def _estimate_complexity(self, task: str) -> str:
        """Estimate task complexity (evaluated using a lightweight model)"""
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"""以下のタスクの複雑さを判定してください。
タスク: {task}
回答は "simple", "moderate", "complex", "expert" のいずれか1つだけ:"""
            }],
            max_tokens=10,
            temperature=0,
        )
        return response.choices[0].message.content.strip().lower()

    async def execute(self, task: str) -> str:
        """Routing + execution"""
        model = self.route(task)

        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": task}],
        }

        # Use max_completion_tokens for reasoning models
        if model.startswith("o"):
            kwargs["max_completion_tokens"] = 5000
        else:
            kwargs["max_tokens"] = 2000
            kwargs["temperature"] = 0.7

        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
```

### 10.2 Fallback Chain

```python
async def call_with_fallback(messages: list, **kwargs) -> str:
    """GPT model fallback chain"""

    fallback_chain = [
        {"model": "gpt-4o", "timeout": 30},
        {"model": "gpt-4o-mini", "timeout": 15},
    ]

    errors = []
    for config in fallback_chain:
        try:
            response = await async_client.chat.completions.create(
                model=config["model"],
                messages=messages,
                timeout=config["timeout"],
                **kwargs,
            )
            return response.choices[0].message.content
        except Exception as e:
            errors.append(f"{config['model']}: {str(e)}")
            continue

    raise Exception(f"全モデルが失敗: {'; '.join(errors)}")
```

### Checklist: Pre-Production GPT API Checklist

```
┌──────────────────────────────────────────────────────────┐
│          GPT API Pre-Production Checklist                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  □ API keys managed via environment variables/secret manager │
│  □ Retry logic (exponential backoff + jitter) implemented │
│  □ Fallback chain (multiple models) configured           │
│  □ Rate limit handling (token bucket, etc.) implemented  │
│  □ Timeouts configured appropriately                     │
│  □ Input validation (max length, dangerous string check) │
│  □ Output validation (JSON parsing, sanitization)        │
│  □ Cost caps (daily/monthly budget) configured           │
│  □ Usage monitoring dashboard built                      │
│  □ Content filtering via Moderation API implemented      │
│  □ Error log collection and visualization                │
│  □ Streaming (SSE) implemented and tested                │
│  □ Prompt version management in place                    │
│  □ A/B testing infrastructure prepared                   │
│  □ Load testing (operation at max expected RPM) done     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Anti-patterns

### Anti-pattern 1: Inappropriate Use of Reasoning Models

```
Wrong: Using o1/o3 for all tasks
  → Unnecessary reasoning cost for simple questions

Right: Select model based on task complexity
  - Simple classification/extraction → GPT-4o mini
  - General tasks → GPT-4o
  - Complex reasoning/math → o3-mini (reasoning_effort="medium")
  - Highest-accuracy reasoning → o1 (reasoning_effort="high")
```

### Anti-pattern 2: Overuse of the Assistants API

```
Wrong: Using Assistants API for one-off Q&A
  → Thread management overhead, increased cost

Right: Choose API based on use case
  - One-off questions → Chat Completions API
  - File analysis / code execution → Assistants API
  - Large-scale batch processing → Batch API
```

### Anti-pattern 3: Not Leveraging Prompt Caching

```
Wrong: Sending the same system prompt in full every time
  → High token consumption, increased cost

Right: Design prompts with caching in mind
  - Place system prompt at the top (the unchanging part)
  - Maintain a common prefix of 1024+ tokens
  - Place user input at the end
  → Cache hits reduce input cost by 50%
```

### Anti-pattern 4: Starting Fine-tuning Too Early

```
Wrong: Trying to solve tasks with fine-tuning from the start
  → High cost, data preparation effort, increased model management complexity

Right: Staged approach
  1. First try to solve with prompt engineering
  2. Add few-shot examples
  3. Control output with Structured Outputs
  4. Consider fine-tuning only if quality is still insufficient
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Perform input data validation
- Implement proper error handling
- Also create test code

```python
# 演習1: 基本実装のテンプレート
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# 演習2: 応用パターン
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# 演習3: パフォーマンス最適化
import time
from functools import lru_cache

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: What is the difference between GPT-4o and GPT-4 Turbo?

**A:** GPT-4o is the successor to GPT-4 Turbo, offering greater speed, lower cost, and more integrated multimodal capabilities. Its ability to handle text, images, and audio in a unified way is a key differentiator. GPT-4o is recommended for new projects.

### Q2: What is the difference between o1 and o3?

**A:** o3 is an improved version of o1 with enhanced reasoning capabilities. o3-mini allows control over reasoning depth via the `reasoning_effort` parameter, making it more cost-efficient. o1 is gradually being deprecated, and migration to o3-mini is recommended.

### Q3: How can I increase my OpenAI API usage limits?

**A:** Tiers are raised automatically based on usage history. It starts at Tier 1 ($5 spent) and goes up to Tier 5 ($200+ spent). If you need a faster increase, you can contact the OpenAI sales team to request a limit increase.

### Q4: How large is the quality difference between GPT-4o mini and GPT-4o?

**A:** In benchmarks, GPT-4o mini delivers approximately 90-95% of GPT-4o's performance. For classification, summarization, and simple Q&A the gap is minimal, but differences emerge with complex reasoning, long-form logical structure, and understanding subtle nuances. Given a roughly 17x cost difference, the recommended approach is to start with mini and upgrade to 4o if quality is insufficient.

### Q5: What is the difference between Structured Outputs and JSON Mode?

**A:** JSON Mode (`response_format={"type": "json_object"}`) guarantees the output is JSON, but does not guarantee schema compliance. Structured Outputs (specifying a Pydantic model like `response_format=TechArticle`) generates JSON that is 100% compliant with the schema. Structured Outputs are recommended for reliable data extraction.

### Q6: When should I use the Batch API?

**A:** It is ideal for large-scale processing where real-time responses are not required. Examples include classifying thousands of emails, generating summaries for large numbers of documents, and labeling datasets. Costs are discounted 50% compared to standard pricing and results are returned within 24 hours. It should be actively used for workflows with daily batch processing needs.

---

## Summary

| Item | Key Points |
|------|------------|
| GPT-4o | Fast, low-cost, multimodal general-purpose model |
| GPT-4o mini | Ultra-low-cost lightweight model, ideal for classification and extraction |
| o1/o3 | Deep reasoning via built-in CoT, strong at math and code |
| Structured Outputs | Reliably obtain structured JSON using a Pydantic schema |
| Assistants API | File analysis, code execution, persistent threads |
| Batch API | Asynchronous bulk processing at 50% discount |
| Realtime API | Low-latency voice interaction via WebSocket |
| Prompt Caching | Reduce input cost by 50% with identical prefixes |
| Fine-tuning | Efficient domain specialization with GPT-4o mini |
| Moderation | Automatic safety check for content |

---

## Recommended Next Guides

- [02-gemini.md](./02-gemini.md) — Features of Google Gemini
- [04-model-comparison.md](./04-model-comparison.md) — Cross-model comparison
- [../02-applications/02-function-calling.md](../02-applications/02-function-calling.md) — Function Calling in depth

---

## References

1. OpenAI. (2024). "GPT-4o System Card." https://openai.com/index/gpt-4o-system-card/
2. OpenAI. (2024). "Learning to Reason with LLMs (o1)." https://openai.com/index/learning-to-reason-with-llms/
3. OpenAI. "API Reference." https://platform.openai.com/docs/api-reference
4. OpenAI. (2024). "Structured Outputs." https://platform.openai.com/docs/guides/structured-outputs
5. OpenAI. (2024). "Batch API." https://platform.openai.com/docs/guides/batch
6. OpenAI. (2024). "Realtime API." https://platform.openai.com/docs/guides/realtime
