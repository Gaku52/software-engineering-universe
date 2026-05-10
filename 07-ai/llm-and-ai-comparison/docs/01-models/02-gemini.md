# Gemini — Google DeepMind's Unified Multimodal LLM

> Gemini is a multimodal-native LLM developed by Google DeepMind, using a next-generation architecture that processes text, images, audio, video, and code within a single model.

## What You Will Learn in This Chapter

1. **Gemini's Architecture and Features** — Mixture of Experts, multimodal-native design, and how the massive context window works
2. **Model Lineup and Selection** — Performance differences, costs, and use cases for Ultra / Pro / Flash / Nano
3. **Practical Use of the Gemini API** — Integration via Google AI Studio and Vertex AI, with best practices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of relevant foundational concepts
- Familiarity with [GPT — OpenAI's Large Language Model](./01-gpt.md)

---

## 1. Gemini's Architecture

### 1.1 Multimodal-Native Design

Unlike the traditional approach of "text model + bolted-on visual encoder," Gemini uses a natively multimodal architecture that learns from multiple modalities integrated together from the training stage.

```
┌─────────────────────────────────────────────────┐
│              Gemini Architecture Overview        │
├─────────────────────────────────────────────────┤
│                                                 │
│  Input Modalities      Unified Encoder          │
│  ┌──────────┐                                   │
│  │  Text    │──┐                                │
│  └──────────┘  │    ┌──────────────────┐        │
│  ┌──────────┐  ├──▶│  Unified Decoder  │──▶Output│
│  │  Image   │──┤    │  (Transformer)    │        │
│  └──────────┘  │    └──────────────────┘        │
│  ┌──────────┐  │                                │
│  │  Audio   │──┤    Features:                   │
│  └──────────┘  │    - Each modality mapped to   │
│  ┌──────────┐  │      the same latent space     │
│  │  Video   │──┤    - Cross-modal attention      │
│  └──────────┘  │    - Unified tokenization       │
│  ┌──────────┐  │                                │
│  │  Code    │──┘                                │
│  └──────────┘                                   │
└─────────────────────────────────────────────────┘
```

#### Difference Between Multimodal-Native and Bolted-On Approaches

```
┌────────────────────────────────────────────────────────────┐
│   Bolted-On Approach (early GPT-4V) vs Native (Gemini)     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Bolted-On Approach:                                       │
│  ┌────────┐   ┌─────────┐   ┌──────────┐                 │
│  │ Image  │→  │ Visual  │→  │  Text   │→ LLM → Output   │
│  │        │   │ Encoder │   │ Convert │                  │
│  └────────┘   └─────────┘   └──────────┘                 │
│  - Visual information is "translated" into the text space  │
│  - Subtle cross-modal relationships are easily lost        │
│  - Difficult to extend to audio and video                  │
│                                                            │
│  Native Approach (Gemini):                                 │
│  ┌────────┐                                                │
│  │ Image  │──┐                                             │
│  ├────────┤  │  ┌──────────────────┐                      │
│  │  Text  │──┼─▶│ Unified Transformer│→ Output            │
│  ├────────┤  │  │ (Shared Parameters)│                    │
│  │ Audio  │──┘  └──────────────────┘                      │
│  └────────┘                                                │
│  - All modalities trained in the same latent space         │
│  - Cross-modal reasoning occurs naturally                  │
│  - Adding new modalities is relatively easy                │
└────────────────────────────────────────────────────────────┘
```

### 1.2 Mixture of Experts (MoE)

From Gemini 1.5 onward, the MoE architecture is used, where only a subset of Experts is activated during inference, dramatically reducing computation costs relative to total parameter count.

```
┌───────────────────────────────────────────────┐
│           Mixture of Experts (MoE)            │
├───────────────────────────────────────────────┤
│                                               │
│  Input Token                                  │
│      │                                        │
│      ▼                                        │
│  ┌────────┐                                   │
│  │ Router │  ← Selects Expert per token       │
│  └────────┘                                   │
│    │    │    │                                 │
│    ▼    ▼    ▼                                 │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐   │
│  │E1│ │E2│ │E3│ │E4│ │E5│ │E6│ │E7│ │E8│   │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘   │
│   ★         ★                   ★            │
│  Active    Active              Active         │
│                                               │
│  ★ = Only selected Experts are computed      │
│  Total params >> Active params               │
│  → Large knowledge base + Low inference cost │
└───────────────────────────────────────────────┘
```

#### Technical Details of MoE

In the MoE architecture, the FFN (Feed-Forward Network) layer of each Transformer block is replaced by multiple Experts, and a Router network selects the optimal Expert for each token.

```python
# MoE の概念的な実装
import torch
import torch.nn as nn

class MoELayer(nn.Module):
    """Mixture of Experts レイヤーの概念実装"""

    def __init__(self, d_model: int, n_experts: int, top_k: int = 2):
        super().__init__()
        self.n_experts = n_experts
        self.top_k = top_k

        # 各 Expert は独立した FFN
        self.experts = nn.ModuleList([
            nn.Sequential(
                nn.Linear(d_model, d_model * 4),
                nn.GELU(),
                nn.Linear(d_model * 4, d_model),
            )
            for _ in range(n_experts)
        ])

        # Router: 各トークンをどの Expert に送るか決定
        self.router = nn.Linear(d_model, n_experts)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [batch, seq_len, d_model]
        batch, seq_len, d_model = x.shape

        # Router で Expert の確率分布を計算
        router_logits = self.router(x)  # [batch, seq_len, n_experts]
        router_probs = torch.softmax(router_logits, dim=-1)

        # Top-K Expert を選択
        top_k_probs, top_k_indices = torch.topk(router_probs, self.top_k, dim=-1)

        # 選択された Expert の出力を加重合算
        output = torch.zeros_like(x)
        for k in range(self.top_k):
            expert_idx = top_k_indices[:, :, k]  # [batch, seq_len]
            weight = top_k_probs[:, :, k]         # [batch, seq_len]

            for i in range(self.n_experts):
                mask = (expert_idx == i)
                if mask.any():
                    expert_input = x[mask]
                    expert_output = self.expertsi
                    output[mask] += weight[mask].unsqueeze(-1) * expert_output

        return output


# Gemini のスケール感
# 例: 16 Experts, Top-2 activation
# 総パラメータ: ~1T (推定)
# 活性パラメータ: ~1T / 8 ≈ 125B (推論時)
# → GPT-4o 級の性能を 1/8 の計算コストで実現
```

#### Router Load Balancing Mechanism

```
┌──────────────────────────────────────────────────────────┐
│         Router Load Balancing Problem and Solution        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Problem: Expert Collapse (bias toward certain Experts)  │
│                                                          │
│  Without load balancing:                                 │
│  E1 ████████████████  ← All tokens concentrated here    │
│  E2 ██                                                   │
│  E3 █                                                    │
│  E4 █                                                    │
│  E5 ░ (unused)                                           │
│  E6 ░ (unused)                                           │
│  E7 ░ (unused)                                           │
│  E8 ░ (unused)                                           │
│                                                          │
│  Solution: Auxiliary Loss                                │
│  L_total = L_task + α × L_balance                        │
│                                                          │
│  With load balancing:                                    │
│  E1 ████                                                 │
│  E2 ████                                                 │
│  E3 ███                                                  │
│  E4 ████                                                 │
│  E5 ███                                                  │
│  E6 ████                                                 │
│  E7 ███                                                  │
│  E8 ████                                                 │
│  → All Experts are utilized evenly                       │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Massive Context Window

Gemini 1.5 Pro provides a context window of up to 2 million tokens.

```python
# コンテキスト長の比較
context_windows = {
    "GPT-4o":          128_000,    # 128K
    "Claude 3.5":      200_000,    # 200K
    "Gemini 1.5 Pro":  2_000_000,  # 2M (!)
    "Gemini 1.5 Flash": 1_000_000, # 1M
}

for model, tokens in context_windows.items():
    pages = tokens // 500  # 1ページ ≈ 500 トークン
    print(f"{model}: {tokens:>10,} tokens ≈ {pages:>5,} pages")
```

#### Technologies Behind Long Context

```
┌──────────────────────────────────────────────────────────┐
│        Technology Stack for Long Context Support          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Ring Attention                                       │
│     ┌───┐ ┌───┐ ┌───┐ ┌───┐                            │
│     │GPU│→│GPU│→│GPU│→│GPU│→ ...                       │
│     │ 1 │ │ 2 │ │ 3 │ │ 4 │                            │
│     └─↑─┘ └───┘ └───┘ └─│─┘                            │
│       └──────────────────┘ (ring structure)              │
│     → Each GPU handles a portion of the context          │
│     → Attention is relayed between GPUs                  │
│                                                          │
│  2. Grouped-Query Attention (GQA)                        │
│     - Shares Key/Value heads to reduce KV cache          │
│     - Achieves equivalent performance at 1/8 memory      │
│                                                          │
│  3. Extended RoPE Positional Encoding                    │
│     - NTK-aware interpolation                            │
│     - YaRN (Yet another RoPE extensioN)                  │
│     → Extrapolates from short training context to longer  │
│       inference context                                  │
│                                                          │
│  4. KV Cache Efficiency                                  │
│     - Sliding Window Attention                           │
│     - KV Cache compression and quantization              │
│     → Practical memory usage even with 2M tokens        │
└──────────────────────────────────────────────────────────┘
```

#### "Lost in the Middle" Problem and Solutions

```python
# 長コンテキストでの精度劣化パターンと対策

# 問題: 200万トークンのうち中間部分の情報検索精度が低下する
# (先頭と末尾の情報は記憶しやすいが、中間は記憶しにくい)

# Solution 1: Place important information at the beginning and end
def arrange_context_optimally(documents: list[str], query: str) -> str:
    """Sort by importance, placing key documents at the start and end"""
    # Rank documents by relevance score
    ranked = rank_by_relevance(documents, query)

    # Alternating placement: 1st→start, 2nd→end, 3rd→near start, ...
    arranged = []
    for i, doc in enumerate(ranked):
        if i % 2 == 0:
            arranged.insert(len(arranged) // 2, doc)
        else:
            arranged.append(doc)

    return "\n\n".join(arranged)


# Solution 2: Hierarchical summarization (Map-Reduce pattern)
def hierarchical_analysis(documents: list[str], query: str) -> str:
    """Process large collections of documents hierarchically"""
    import google.generativeai as genai

    model = genai.GenerativeModel("gemini-1.5-flash")

    # Step 1: Summarize each document individually (Map)
    summaries = []
    for doc in documents:
        summary = model.generate_content(
            f"以下の文書を{query}の観点から要約してください:\n\n{doc}"
        )
        summaries.append(summary.text)

    # Step 2: Integrate summaries (Reduce)
    pro_model = genai.GenerativeModel("gemini-1.5-pro")
    final = pro_model.generate_content(
        f"以下の要約群を統合し、{query}に対する包括的な回答を作成してください:\n\n"
        + "\n---\n".join(summaries)
    )
    return final.text


# Solution 3: Chunking + selective insertion
def selective_context(
    all_docs: list[str],
    query: str,
    max_tokens: int = 500_000,
) -> list[str]:
    """Select only relevant documents and insert them into context"""
    # Filter relevant documents using embedding-based retrieval
    relevant = retrieve_relevant(query, all_docs, top_k=50)

    # Estimate token count and cut off
    selected = []
    total_tokens = 0
    for doc in relevant:
        doc_tokens = estimate_tokens(doc)
        if total_tokens + doc_tokens > max_tokens:
            break
        selected.append(doc)
        total_tokens += doc_tokens

    return selected
```

#### Use Cases by Context Length

```
┌──────────────────────────────────────────────────────────┐
│        Practical Use Cases by Context Length              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ~32K tokens (standard models)                           │
│  ├── Chatbot conversations                               │
│  ├── Short document summarization                        │
│  └── Code generation (single file)                       │
│                                                          │
│  ~128K tokens (GPT-4o, Llama 3.1)                        │
│  ├── Analysis of 1-3 research papers                     │
│  ├── Medium-scale codebase review                        │
│  └── Processing long meeting minutes                     │
│                                                          │
│  ~200K tokens (Claude 3.5)                               │
│  ├── Summarization and analysis of a single book         │
│  ├── Understanding large codebases                       │
│  └── Comprehensive legal document review                 │
│                                                          │
│  ~1M tokens (Gemini 1.5 Flash)                           │
│  ├── Cross-analysis of multiple books                    │
│  ├── Full transcript analysis of 30-minute videos        │
│  └── Direct input of large datasets                      │
│                                                          │
│  ~2M tokens (Gemini 1.5 Pro)                             │
│  ├── Batch processing of 3-5 books at once               │
│  ├── Analysis of 1-hour videos                           │
│  ├── Full understanding of large software repositories   │
│  └── Time-series analysis of 10 years of annual reports  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Model Lineup

### 2.1 Model Comparison Table

| Model | Parameter Scale | Context | Primary Use | Pricing (input/1M tokens) |
|-------|----------------|---------|-------------|--------------------------|
| Gemini Ultra | Largest | 128K | Highest-accuracy tasks | High price range |
| Gemini 1.5 Pro | Large MoE | 2M | General-purpose, long document analysis | $1.25 - $5.00 |
| Gemini 1.5 Flash | Medium MoE | 1M | Fast, low-cost | $0.075 - $0.30 |
| Gemini 2.0 Flash | Next-gen MoE | 1M | Latest, high-speed | $0.10 - $0.40 |
| Gemini Nano | Small | 32K | On-device | Free (on-device) |

### 2.2 Use Case Selection Guide

| Use Case | Recommended Model | Reason |
|----------|------------------|--------|
| Large codebase analysis | 1.5 Pro (2M) | Massive context required |
| Chatbot | 2.0 Flash | Low latency, low cost |
| Image + text understanding | 1.5 Pro / 2.0 Flash | Multimodal accuracy |
| On-device AI assistant | Nano | Offline operation |
| Research / highest accuracy | Ultra | Top benchmark scores |
| Real-time translation | Flash | Speed-focused |

### 2.3 Detailed Model Selection Framework

```
┌──────────────────────────────────────────────────────────┐
│         Gemini Model Selection Flowchart                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  START                                                   │
│    │                                                     │
│    ├─ Offline operation required?                        │
│    │   YES → Gemini Nano                                 │
│    │                                                     │
│    NO ↓                                                  │
│    ├─ Context larger than 128K required?                 │
│    │   YES ─┬─ 2M needed? → 1.5 Pro                     │
│    │        └─ 1M sufficient → 1.5 Flash (cost focus)   │
│    │                        → 1.5 Pro (accuracy focus)  │
│    │                                                     │
│    NO ↓                                                  │
│    ├─ Minimum latency required?                          │
│    │   YES → 2.0 Flash                                   │
│    │                                                     │
│    NO ↓                                                  │
│    ├─ Cost minimization is top priority?                 │
│    │   YES → 1.5 Flash ($0.075/1M)                       │
│    │                                                     │
│    NO ↓                                                  │
│    └─ Highest quality needed → 1.5 Pro / Ultra          │
└──────────────────────────────────────────────────────────┘
```

### 2.4 Pricing Details and Optimization

```python
# Gemini の料金体系の詳細
gemini_pricing = {
    "gemini-1.5-pro": {
        "input_128k_below": 1.25,   # $/1M tokens (128K以下)
        "input_128k_above": 2.50,   # $/1M tokens (128K超)
        "output_128k_below": 5.00,
        "output_128k_above": 10.00,
        "context_caching_storage": 4.50,  # $/1M tokens/hour
        "context_caching_input": 0.3125,  # 75% 割引
    },
    "gemini-1.5-flash": {
        "input_128k_below": 0.075,
        "input_128k_above": 0.15,
        "output_128k_below": 0.30,
        "output_128k_above": 0.60,
        "context_caching_storage": 1.00,
        "context_caching_input": 0.01875,
    },
    "gemini-2.0-flash": {
        "input": 0.10,
        "output": 0.40,
    },
}


def calculate_gemini_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    use_caching: bool = False,
    cached_tokens: int = 0,
    cache_duration_hours: float = 1.0,
) -> dict:
    """Calculate Gemini costs in detail"""
    pricing = gemini_pricing[model]

    if model == "gemini-2.0-flash":
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return {
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total": input_cost + output_cost,
        }

    # Rate switch at the 128K boundary
    threshold = 128_000
    if input_tokens <= threshold:
        input_rate = pricing["input_128k_below"]
    else:
        input_rate = pricing["input_128k_above"]

    output_rate = pricing["output_128k_below"] if input_tokens <= threshold \
        else pricing["output_128k_above"]

    if use_caching and cached_tokens > 0:
        # Discounted rate when using cache
        cache_input_cost = (cached_tokens / 1_000_000) * pricing["context_caching_input"]
        regular_input_cost = ((input_tokens - cached_tokens) / 1_000_000) * input_rate
        cache_storage_cost = (cached_tokens / 1_000_000) * pricing["context_caching_storage"] * cache_duration_hours
        input_cost = cache_input_cost + regular_input_cost + cache_storage_cost
    else:
        input_cost = (input_tokens / 1_000_000) * input_rate

    output_cost = (output_tokens / 1_000_000) * output_rate

    return {
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total": input_cost + output_cost,
    }


# Usage example: Processing 1M token document
result = calculate_gemini_cost(
    model="gemini-1.5-pro",
    input_tokens=1_000_000,
    output_tokens=2_000,
)
print(f"1M tokens処理コスト: ${result['total']:.2f}")

# With caching (multiple queries against the same document)
result_cached = calculate_gemini_cost(
    model="gemini-1.5-pro",
    input_tokens=1_000_000,
    output_tokens=2_000,
    use_caching=True,
    cached_tokens=950_000,
    cache_duration_hours=1.0,
)
print(f"キャッシュ利用時コスト: ${result_cached['total']:.2f}")
```

---

## 3. Gemini API in Practice

### 3.1 Google AI Studio (Python SDK)

```python
import google.generativeai as genai

# API キー設定
genai.configure(api_key="YOUR_API_KEY")

# モデル初期化
model = genai.GenerativeModel("gemini-1.5-pro")

# テキスト生成
response = model.generate_content("量子コンピュータを小学生に説明して")
print(response.text)
```

### 3.2 Multimodal Input (Image + Text)

```python
import google.generativeai as genai
from pathlib import Path

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-1.5-pro")

# 画像読み込み
image = genai.upload_file(Path("architecture_diagram.png"))

# 画像 + テキストのプロンプト
response = model.generate_content([
    image,
    "この図のアーキテクチャを解説し、改善点を3つ提案してください。"
])
print(response.text)
```

### 3.3 Streaming Responses

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-1.5-flash")

# ストリーミングで生成
response = model.generate_content(
    "Pythonの非同期処理について詳しく解説してください。",
    stream=True
)

for chunk in response:
    print(chunk.text, end="", flush=True)
```

### 3.4 Via Vertex AI (Enterprise)

```python
import vertexai
from vertexai.generative_models import GenerativeModel

# Vertex AI 初期化
vertexai.init(project="my-project", location="us-central1")

model = GenerativeModel("gemini-1.5-pro")

response = model.generate_content(
    "当社の売上データを分析し、来期の予測を作成してください。",
    generation_config={
        "temperature": 0.2,
        "top_p": 0.8,
        "top_k": 40,
        "max_output_tokens": 8192,
    }
)
print(response.text)
```

### 3.5 System Instructions and Safety Settings

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

model = genai.GenerativeModel(
    model_name="gemini-1.5-pro",
    system_instruction="あなたは金融の専門家です。正確で慎重な回答を心がけてください。",
    safety_settings={
        "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
        "HARM_CATEGORY_HATE_SPEECH": "BLOCK_MEDIUM_AND_ABOVE",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_MEDIUM_AND_ABOVE",
        "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_MEDIUM_AND_ABOVE",
    }
)

# チャット形式
chat = model.start_chat()
response = chat.send_message("日経平均の今後の見通しについて教えてください")
print(response.text)

# 会話履歴の参照
for message in chat.history:
    print(f"{message.role}: {message.parts[0].text[:50]}...")
```

### 3.6 Function Calling (Tool Use)

```python
import google.generativeai as genai
import json

genai.configure(api_key="YOUR_API_KEY")

# ツール定義
get_weather = genai.protos.Tool(
    function_declarations=[
        genai.protos.FunctionDeclaration(
            name="get_weather",
            description="指定された都市の現在の天気を取得する",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "city": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="都市名 (例: 東京, 大阪)",
                    ),
                    "unit": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        enum=["celsius", "fahrenheit"],
                        description="温度の単位",
                    ),
                },
                required=["city"],
            ),
        ),
    ]
)

model = genai.GenerativeModel(
    "gemini-1.5-pro",
    tools=[get_weather],
)

chat = model.start_chat()
response = chat.send_message("東京の天気を教えてください")

# Function Call の処理
for part in response.parts:
    if fn := part.function_call:
        print(f"関数呼び出し: {fn.name}")
        print(f"引数: {dict(fn.args)}")

        # 実際の関数を呼び出し (ここではモック)
        weather_data = {"temperature": 22, "condition": "晴れ", "humidity": 55}

        # 結果をモデルに返す
        response = chat.send_message(
            genai.protos.Content(
                parts=[genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=fn.name,
                        response={"result": weather_data},
                    )
                )]
            )
        )
        print(response.text)
```

### 3.7 Context Caching

```python
import google.generativeai as genai
from google.generativeai import caching
import datetime

genai.configure(api_key="YOUR_API_KEY")

# 大きなドキュメントをキャッシュに格納
with open("large_document.txt", "r") as f:
    document_content = f.read()

# キャッシュの作成 (最低 32,768 トークン以上が必要)
cache = caching.CachedContent.create(
    model="models/gemini-1.5-pro-002",
    display_name="my-document-cache",
    system_instruction="あなたは文書分析の専門家です。",
    contents=[document_content],
    ttl=datetime.timedelta(hours=2),  # 2時間有効
)

print(f"Cache ID: {cache.name}")
print(f"Token Count: {cache.usage_metadata.total_token_count}")

# キャッシュを使ったモデル生成 (75% 割引の入力トークン料金)
model = genai.GenerativeModel.from_cached_content(cache)

# Run multiple queries against the same document cost-efficiently
questions = [
    "この文書の主要な論点を3つ挙げてください",
    "著者の結論は何ですか？",
    "第3章の要約を作成してください",
    "この文書の矛盾点や弱点を指摘してください",
]

for q in questions:
    response = model.generate_content(q)
    print(f"\nQ: {q}")
    print(f"A: {response.text[:200]}...")

# キャッシュの削除
cache.delete()
```

### 3.8 Grounding (Search Integration)

```python
import vertexai
from vertexai.generative_models import GenerativeModel, Tool
from vertexai.preview.generative_models import grounding

vertexai.init(project="my-project", location="us-central1")

model = GenerativeModel("gemini-1.5-pro")

# Answering with Google Search Grounding
tool = Tool.from_google_search_retrieval(
    grounding.GoogleSearchRetrieval()
)

response = model.generate_content(
    "2025年のAI規制に関する最新の動向を教えてください",
    tools=[tool],
    generation_config={"temperature": 0.1},
)

print(response.text)

# Grounding metadata (source information)
if hasattr(response, 'candidates'):
    for candidate in response.candidates:
        if hasattr(candidate, 'grounding_metadata'):
            metadata = candidate.grounding_metadata
            print("\nSearch Sources:")
            for chunk in metadata.grounding_chunks:
                print(f"  - {chunk.web.title}: {chunk.web.uri}")
```

### 3.9 Video Analysis in Practice

```python
import google.generativeai as genai
import time

genai.configure(api_key="YOUR_API_KEY")

# Upload video
video_file = genai.upload_file("meeting_recording.mp4")

# Wait for processing to complete
while video_file.state.name == "PROCESSING":
    print("Processing video...")
    time.sleep(10)
    video_file = genai.get_file(video_file.name)

if video_file.state.name == "FAILED":
    raise ValueError("Video upload failed")

print(f"Video ready: {video_file.uri}")

model = genai.GenerativeModel("gemini-1.5-pro")

# Summary with timestamps
response = model.generate_content([
    video_file,
    """この会議動画を分析してください:
    1. 参加者の一覧と発言頻度
    2. 議題ごとのタイムスタンプ (MM:SS - トピック)
    3. 各議題の結論と次のアクション
    4. 未解決の課題
    日本語で回答してください。"""
])
print(response.text)

# Questions about a specific time range
response = model.generate_content([
    video_file,
    "動画の5:00-10:00の区間で議論された技術的な課題を詳しく説明してください。"
])
print(response.text)
```

### 3.10 Batch Processing and Parallel Execution

```python
import google.generativeai as genai
import asyncio
from typing import Optional

genai.configure(api_key="YOUR_API_KEY")


async def batch_generate(
    prompts: list[str],
    model_name: str = "gemini-1.5-flash",
    max_concurrent: int = 5,
    temperature: float = 0.7,
) -> list[dict]:
    """Run batch processing with the Gemini API"""
    model = genai.GenerativeModel(model_name)
    semaphore = asyncio.Semaphore(max_concurrent)
    results = []

    async def process_single(prompt: str, index: int) -> dict:
        async with semaphore:
            try:
                response = await model.generate_content_async(
                    prompt,
                    generation_config={"temperature": temperature},
                )
                return {
                    "index": index,
                    "prompt": prompt[:100],
                    "response": response.text,
                    "status": "success",
                }
            except Exception as e:
                return {
                    "index": index,
                    "prompt": prompt[:100],
                    "error": str(e),
                    "status": "error",
                }

    tasks = [process_single(p, i) for i, p in enumerate(prompts)]
    results = await asyncio.gather(*tasks)
    return sorted(results, key=lambda x: x["index"])


# Usage example
prompts = [
    f"質問{i}: AIの応用分野{i}について100字で説明してください"
    for i in range(20)
]

results = asyncio.run(batch_generate(prompts, max_concurrent=10))
for r in results:
    if r["status"] == "success":
        print(f"[{r['index']}] {r['response'][:80]}...")
    else:
        print(f"[{r['index']}] ERROR: {r['error']}")
```

---

## 4. Gemini's Technical Differentiators

```
┌──────────────────────────────────────────────────────┐
│           Gemini's Key Technical Differentiators      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. Ultra-Long Context                               │
│     └─ 2 million tokens → Can process an entire book │
│                                                      │
│  2. Native Multimodal                                │
│     └─ Unified understanding of text/image/audio/video│
│                                                      │
│  3. Google Ecosystem Integration                     │
│     └─ Search Grounding: Augments answers with       │
│          Google Search results                       │
│     └─ Workspace integration: Gmail, Docs, Sheets    │
│                                                      │
│  4. Nano Model (On-Device)                           │
│     └─ Runs directly on Pixel / Android devices     │
│     └─ Privacy protection + offline operation       │
│                                                      │
│  5. Code Generation Specialization                   │
│     └─ Integrates insights from AlphaCode 2         │
│     └─ Reasoning ability at competitive programming  │
│          level                                       │
└──────────────────────────────────────────────────────┘
```

### 4.1 Google Ecosystem Integration Details

```
┌──────────────────────────────────────────────────────────┐
│         Integration Points with the Google Ecosystem      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │ Google Search │     │  Google Maps  │                  │
│  │  Grounding   │     │  Places API   │                  │
│  └──────┬───────┘     └──────┬───────┘                  │
│         │                     │                          │
│         ▼                     ▼                          │
│  ┌────────────────────────────────────┐                  │
│  │           Gemini Model             │                  │
│  └────────────────────────────────────┘                  │
│         ▲                     ▲                          │
│         │                     │                          │
│  ┌──────┴───────┐     ┌──────┴───────┐                  │
│  │  Workspace    │     │  Firebase    │                  │
│  │  (Docs/Sheets │     │  (Firestore  │                  │
│  │   /Gmail)     │     │   /Auth)     │                  │
│  └──────────────┘     └──────────────┘                  │
│                                                          │
│  Use Cases:                                              │
│  1. Automatic summarization and draft replies in Gmail   │
│  2. Auto proofreading and translation in Google Docs     │
│  3. Data analysis and chart generation in Google Sheets  │
│  4. Answers grounded in Google Search for latest info    │
│  5. Location-aware services via Google Maps              │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Gemini Nano: On-Device AI

```python
# Gemini Nano は Android の AICore API 経由で利用
# (Java/Kotlin の例)

"""
// Android での Gemini Nano 利用 (Kotlin)
import com.google.ai.client.generativeai.GenerativeModel

val generativeModel = GenerativeModel(
    modelName = "gemini-nano",
    // APIキー不要 - デバイス上で直接実行
)

// テキスト生成 (デバイス上で完結)
val response = generativeModel.generateContent("こんにちは")
println(response.text)

// Gemini Nano の利点:
// - ネットワーク不要 (飛行機モードでも動作)
// - データがデバイス外に出ない (完全なプライバシー)
// - レイテンシが極めて低い (ネットワーク遅延なし)
// - API 料金が発生しない

// 対応機能:
// - テキスト要約
// - スマートリプライ
// - 文法チェック
// - テキスト分類
"""

# Python からの Gemini Nano 利用 (Chrome の組み込み AI)
# Web 版の Gemini Nano は Chrome Canary で実験的に利用可能
"""
// JavaScript (Chrome Built-in AI)
const session = await ai.languageModel.create({
  systemPrompt: "あなたは親切なアシスタントです。"
});

const result = await session.prompt("明日の予定をリマインドして");
console.log(result);

// ストリーミング
const stream = session.promptStreaming("長い文章を生成してください");
for await (const chunk of stream) {
  console.log(chunk);
}
"""
```

---

## 5. New Features in Gemini 2.0

### 5.1 Improvements in Gemini 2.0 Flash

```
┌──────────────────────────────────────────────────────────┐
│        New Features in Gemini 2.0 Flash                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Native Image Generation                              │
│     └─ Text-to-image generation completed within model  │
│     └─ Mixed output of images and text is possible      │
│                                                          │
│  2. Native Audio Generation (TTS)                        │
│     └─ Direct text-to-speech generation                 │
│     └─ Multilingual and multi-style support             │
│                                                          │
│  3. Enhanced Tool Use                                    │
│     └─ Google Search Grounding                          │
│     └─ Code execution (server-side)                     │
│     └─ Improved Function Calling accuracy               │
│                                                          │
│  4. Thinking Mode                                        │
│     └─ Step-by-step reasoning (Chain-of-Thought)        │
│     └─ Greatly improved accuracy for math and coding    │
│                                                          │
│  5. Performance Improvements                             │
│     └─ Better accuracy + lower latency vs 1.5 Flash     │
│     └─ Further improvements in cost efficiency          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Implementing Thinking Mode

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

# High-accuracy reasoning with Thinking Mode
model = genai.GenerativeModel("gemini-2.0-flash-thinking-exp")

response = model.generate_content(
    """
    以下の数学問題を段階的に解いてください:

    ある工場で、製品Aと製品Bを生産しています。
    - 製品Aは1個あたり3時間の加工と2時間の検査が必要
    - 製品Bは1個あたり2時間の加工と4時間の検査が必要
    - 1日の加工可能時間は18時間、検査可能時間は20時間
    - 製品Aの利益は500円、製品Bの利益は400円

    利益を最大化するための最適な生産量を求めてください。
    """
)

# In Thinking Mode, the reasoning process and final answer are separated
for part in response.parts:
    print(part.text)
```

---

## 6. Troubleshooting

### 6.1 Common Errors and Solutions

```python
import google.generativeai as genai
from google.api_core import exceptions

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-1.5-pro")


# Error 1: Rate limiting
def handle_rate_limit(prompt: str, max_retries: int = 5):
    """Handle rate limiting with exponential backoff"""
    import time
    import random

    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            return response.text
        except exceptions.ResourceExhausted as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"レート制限。{wait_time:.1f}秒待機... (試行 {attempt+1}/{max_retries})")
                time.sleep(wait_time)
            else:
                raise


# Error 2: Safety filter block
def handle_safety_block(prompt: str):
    """Diagnose and handle safety filter blocks"""
    try:
        response = model.generate_content(prompt)

        # Check safety ratings
        if response.prompt_feedback.block_reason:
            print(f"Block reason: {response.prompt_feedback.block_reason}")
            for rating in response.prompt_feedback.safety_ratings:
                print(f"  {rating.category}: {rating.probability}")
            return None

        # Check candidate safety
        for candidate in response.candidates:
            if candidate.finish_reason.name == "SAFETY":
                print("Response was blocked by safety filter")
                for rating in candidate.safety_ratings:
                    print(f"  {rating.category}: {rating.probability}")
                return None

        return response.text

    except exceptions.InvalidArgument as e:
        print(f"Invalid request: {e}")
        return None


# Error 3: Token count exceeded
def check_token_count(content: str, model_name: str = "gemini-1.5-pro"):
    """Check token count in advance"""
    model = genai.GenerativeModel(model_name)

    token_count = model.count_tokens(content)
    print(f"Token count: {token_count.total_tokens}")

    limits = {
        "gemini-1.5-pro": 2_000_000,
        "gemini-1.5-flash": 1_000_000,
        "gemini-2.0-flash": 1_000_000,
    }

    limit = limits.get(model_name, 128_000)
    if token_count.total_tokens > limit:
        print(f"Warning: Token count exceeds limit ({limit:,})")
        return False
    else:
        remaining = limit - token_count.total_tokens
        print(f"Remaining tokens: {remaining:,}")
        return True


# Error 4: File upload failure
def safe_upload_file(file_path: str, max_retries: int = 3):
    """Robust file upload implementation"""
    import os
    import time

    # File size check (max 2GB)
    file_size = os.path.getsize(file_path)
    if file_size > 2 * 1024 * 1024 * 1024:
        raise ValueError(f"File size exceeds limit: {file_size / (1024**3):.1f}GB")

    for attempt in range(max_retries):
        try:
            uploaded = genai.upload_file(file_path)

            # For video, wait for processing to complete
            while uploaded.state.name == "PROCESSING":
                print(f"Processing... (attempt {attempt+1})")
                time.sleep(10)
                uploaded = genai.get_file(uploaded.name)

            if uploaded.state.name == "ACTIVE":
                return uploaded
            else:
                print(f"Upload failed: state={uploaded.state.name}")

        except Exception as e:
            print(f"Upload error (attempt {attempt+1}): {e}")
            time.sleep(5)

    raise RuntimeError(f"File upload failed after {max_retries} attempts")
```

### 6.2 Debugging and Monitoring

```python
import google.generativeai as genai
import json
import time
from datetime import datetime

genai.configure(api_key="YOUR_API_KEY")


class GeminiMonitor:
    """Gemini API usage monitoring"""

    def __init__(self, model_name: str = "gemini-1.5-pro"):
        self.model = genai.GenerativeModel(model_name)
        self.model_name = model_name
        self.call_log = []

    def generate(self, prompt: str, **kwargs) -> str:
        """Generation with monitoring"""
        start_time = time.time()

        try:
            # Pre-check token count
            token_count = self.model.count_tokens(prompt)
            input_tokens = token_count.total_tokens

            response = self.model.generate_content(prompt, **kwargs)
            latency = time.time() - start_time

            # Get output token count
            output_tokens = self.model.count_tokens(response.text).total_tokens

            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "model": self.model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "latency_seconds": round(latency, 3),
                "status": "success",
                "finish_reason": response.candidates[0].finish_reason.name,
            }
            self.call_log.append(log_entry)

            return response.text

        except Exception as e:
            latency = time.time() - start_time
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "model": self.model_name,
                "latency_seconds": round(latency, 3),
                "status": "error",
                "error": str(e),
            }
            self.call_log.append(log_entry)
            raise

    def get_statistics(self) -> dict:
        """Get usage statistics"""
        if not self.call_log:
            return {"message": "No calls recorded"}

        successful = [l for l in self.call_log if l["status"] == "success"]
        failed = [l for l in self.call_log if l["status"] == "error"]

        total_input = sum(l.get("input_tokens", 0) for l in successful)
        total_output = sum(l.get("output_tokens", 0) for l in successful)
        avg_latency = sum(l["latency_seconds"] for l in successful) / len(successful) if successful else 0

        return {
            "total_calls": len(self.call_log),
            "successful": len(successful),
            "failed": len(failed),
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "avg_latency_seconds": round(avg_latency, 3),
            "error_rate": round(len(failed) / len(self.call_log) * 100, 1),
        }


# Usage example
monitor = GeminiMonitor("gemini-1.5-flash")

prompts = [
    "AIの未来について100字で述べてください",
    "Pythonのデコレータを説明してください",
    "クイックソートのアルゴリズムを説明してください",
]

for p in prompts:
    result = monitor.generate(p)
    print(f"Response: {result[:80]}...\n")

stats = monitor.get_statistics()
print(f"\n=== Statistics ===")
print(json.dumps(stats, indent=2, ensure_ascii=False))
```

---

## 7. Performance Optimization

### 7.1 Latency Optimization

```python
import google.generativeai as genai
import time

genai.configure(api_key="YOUR_API_KEY")


# Optimization 1: Minimize TTFB with streaming
def optimized_streaming(prompt: str):
    """Latency optimization through streaming"""
    model = genai.GenerativeModel("gemini-1.5-flash")

    start = time.time()
    first_token_time = None

    response = model.generate_content(prompt, stream=True)
    for chunk in response:
        if first_token_time is None:
            first_token_time = time.time()
            ttfb = first_token_time - start
            print(f"TTFB: {ttfb:.3f}s")
        print(chunk.text, end="", flush=True)

    total_time = time.time() - start
    print(f"\nTotal time: {total_time:.3f}s")


# Optimization 2: Select the right model
# Flash is 3-5x faster than Pro
performance_comparison = {
    "gemini-1.5-pro": {
        "avg_ttfb": "1.5-3.0s",
        "tokens_per_second": "30-50",
        "best_for": "High-accuracy tasks",
    },
    "gemini-1.5-flash": {
        "avg_ttfb": "0.3-0.8s",
        "tokens_per_second": "80-150",
        "best_for": "Real-time responses",
    },
    "gemini-2.0-flash": {
        "avg_ttfb": "0.2-0.6s",
        "tokens_per_second": "100-200",
        "best_for": "Latest, fastest",
    },
}


# Optimization 3: Prompt optimization
def optimize_prompt(prompt: str) -> str:
    """Reduce token count to improve cost and speed"""
    # Remove unnecessary whitespace
    import re
    prompt = re.sub(r'\n{3,}', '\n\n', prompt)
    prompt = re.sub(r' {2,}', ' ', prompt)

    # Remove redundant expressions
    replacements = {
        "できるだけ詳しく説明してください": "詳しく説明してください",
        "以下の内容について": "",
        "よろしくお願いします": "",
    }
    for old, new in replacements.items():
        prompt = prompt.replace(old, new)

    return prompt.strip()


# Optimization 4: Reduce repeated costs with Context Caching
# (See Section 3.7 above)
```

### 7.2 Cost Optimization Strategies

```
┌──────────────────────────────────────────────────────────┐
│         5 Strategies for Gemini Cost Optimization         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Model Routing                                        │
│     Simple tasks → Flash ($0.075/1M)                     │
│     Complex tasks → Pro ($1.25/1M)                       │
│     → Reduces average cost by 60-80%                    │
│                                                          │
│  2. Context Caching                                      │
│     Multiple queries against the same doc → 75% discount │
│     Condition: Cache target must be 32K+ tokens          │
│                                                          │
│  3. Limit Output Tokens                                  │
│     Set max_output_tokens appropriately                  │
│     Output is 4x the cost of input → reducing output    │
│     is most effective                                    │
│                                                          │
│  4. Batch Processing                                     │
│     No real-time requirement → Up to 50% off with        │
│     batch API                                            │
│                                                          │
│  5. Prompt Optimization                                  │
│     Keep prompts concise, not verbose                    │
│     Minimize few-shot examples                           │
│     Store system instructions in Context Cache           │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Wasting Context Window

```python
# NG: Feeding all documents without limit just because you have 2M tokens
all_docs = load_all_company_documents()  # 300万トークン分
response = model.generate_content(all_docs + [query])
# → Context overflow error or accuracy degradation ("Lost in the Middle" problem)

# OK: Extract only relevant documents first
relevant_docs = retrieve_relevant(query, all_docs, top_k=20)
response = model.generate_content(relevant_docs + [query])
# → Improved accuracy by focusing on necessary info + cost savings
```

### Anti-Pattern 2: Cost Explosion from Wrong Model Selection

```python
# NG: Using the highest-performance model for a simple classification task
model = genai.GenerativeModel("gemini-ultra")
for item in million_items:  # Processing 1 million items
    result = model.generate_content(f"カテゴリ分類: {item}")
# → Enormous cost incurred

# OK: Model selection based on task difficulty
model = genai.GenerativeModel("gemini-1.5-flash")  # Flash is sufficient for classification
# Furthermore: Use batch API to cut costs
```

### Anti-Pattern 3: Excessive Relaxation of Safety Filters

```python
# NG: Disabling all safety settings
safety = {cat: "BLOCK_NONE" for cat in all_categories}
# → Risk of harmful content generation, potential terms of service violation

# OK: Appropriate settings for the use case
safety = {
    "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
    "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_ONLY_HIGH",  # Relax as needed for medical use, etc.
}
```

### Anti-Pattern 4: Lack of Error Handling

```python
# NG: Running in production without error handling
response = model.generate_content(prompt)
result = response.text  # Crashes if None

# OK: Robust error handling
try:
    response = model.generate_content(prompt)

    # Check for safety block
    if not response.candidates:
        print("No response generated (Safety filter)")
        result = fallback_response()
    elif response.candidates[0].finish_reason.name != "STOP":
        print(f"Abnormal termination: {response.candidates[0].finish_reason.name}")
        result = fallback_response()
    else:
        result = response.text

except exceptions.ResourceExhausted:
    # Rate limit → Retry
    result = retry_with_backoff(prompt)
except exceptions.InvalidArgument as e:
    # Invalid request → Log
    log_error(e, prompt)
    result = fallback_response()
except Exception as e:
    # Other errors
    log_error(e, prompt)
    result = fallback_response()
```

### Anti-Pattern 5: Misuse of Context Caching

```python
# NG: Caching small content (minimum 32K tokens required)
cache = caching.CachedContent.create(
    model="models/gemini-1.5-pro-002",
    contents=["短いテキスト"],  # Only 100 tokens
    ttl=datetime.timedelta(hours=24),
)
# → Error: Insufficient token count

# NG: Setting TTL too long (storage costs accrue)
cache = caching.CachedContent.create(
    model="models/gemini-1.5-pro-002",
    contents=[huge_document],
    ttl=datetime.timedelta(days=30),  # 30 days → Enormous storage costs
)

# OK: Appropriate size and TTL settings
cache = caching.CachedContent.create(
    model="models/gemini-1.5-pro-002",
    contents=[document_over_32k_tokens],
    ttl=datetime.timedelta(hours=2),  # Only as long as needed
)
# Explicitly delete after queries are complete
cache.delete()
```

---

## 9. Comparison with Other Models

### 9.1 Gemini vs GPT-4o vs Claude 3.5 Comparison

```
┌──────────────────────────────────────────────────────────┐
│         Strength Mapping of the Three Major Models        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              GPT-4o                                       │
│           ┌──────────┐                                   │
│           │ Multi-   │                                   │
│           │ modal    │                                   │
│           │ (image   │                                   │
│           │ generation)│                                 │
│     ┌─────┤         ├──────┐                             │
│     │     │ Function│      │                             │
│     │     │ Calling │      │                             │
│     │     └────┬────┘      │                             │
│  Gemini       │        Claude 3.5                        │
│  ┌──────────┐ │ ┌──────────┐                             │
│  │ Long     │ │ │ Code     │                             │
│  │ Context  │ │ │ Quality  │                             │
│  │ (2M)     │ │ │ (SWE-   │                             │
│  │ Video    │ │ │ bench)   │                             │
│  │ Input    │ │ │ Safety   │                             │
│  │ Search   │ │ │ 200K ctx │                             │
│  │ Grounding│ │ │ Instruction│                           │
│  │ Low Cost │ │ │ Following │                            │
│  └──────────┘ │ └──────────┘                             │
│               │                                          │
│          Shared Strengths:                               │
│          Text generation, reasoning, JSON output         │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Specific Recommendations by Use Case

| Use Case | Recommended | Reason |
|----------|-------------|--------|
| Legal document analysis over 100 pages | Gemini 1.5 Pro | 2M context |
| Video summarization and analysis | Gemini 1.5 Pro | Only native video support |
| Code review and generation | Claude 3.5 Sonnet | Top SWE-bench score |
| Large-scale email auto-classification | Gemini 1.5 Flash | Lowest cost + sufficient quality |
| Report generation with images | GPT-4o | Image generation + text integration |
| Internal data processing | Gemini (Vertex AI) | Google Cloud integration |
| Real-time chat | Gemini 2.0 Flash | Lowest latency |
| Mathematical reasoning | DeepSeek-R1 / o1 | Reasoning-specialized |

---

## 10. FAQ

### Q1: How should I choose between Gemini and GPT-4o?

For processing large documents (collections of papers, entire codebases, etc.), Gemini's 2 million token context is overwhelmingly advantageous. On the other hand, GPT-4o has an edge in integration maturity with existing toolchains and the Function Calling ecosystem. Both perform well on multimodal tasks, but Gemini leads in video input.

### Q2: Which devices support Gemini Nano?

It is available on compatible Android devices such as Google Pixel 8 and later, and Samsung Galaxy S24 and later. It is accessed through the AICore API. It operates offline, and data never leaves the device. It cannot be used directly on iOS, but Chrome browser's built-in Gemini Nano (on-device AI) has partial support.

### Q3: How does the Gemini API pricing work?

Google AI Studio's free tier allows 15 requests per minute (1.5 Flash) / 2 requests per minute (1.5 Pro). Paid plans use per-token pricing for input and output tokens, varying by model. Note the two-tier pricing where the per-token rate changes above and below 128K tokens.

### Q4: What is Search Grounding?

It is a feature where Gemini references Google Search results in real time and uses them as the basis for its answers. It is effective at reducing hallucinations and particularly useful for questions involving the latest information. Available in Vertex AI.

### Q5: When should Context Caching be used?

It is effective when sending multiple queries against the same large document (32K+ tokens). For example, when issuing multiple instructions like "summarize," "generate FAQ," and "extract key points" for a single technical document, using caching can reduce input costs by 75%. Set the TTL to the minimum necessary and be mindful of storage costs.

### Q6: How should I choose between Vertex AI and Google AI Studio?

For personal development and prototyping, use Google AI Studio (easy to use with just an API key). For enterprise use (SLA, data processing agreements, IAM integration, VPC Service Controls), use Vertex AI. Vertex AI provides Google Cloud's security and governance features and is required for HIPAA/SOC2 compliance.

### Q7: Which should I use, Gemini 2.0 or 1.5?

2.0 Flash has the best balance of speed, cost, and quality and is recommended for new projects. However, if 2M context is needed, 1.5 Pro is currently the only option. Version 2.0 has features not found in 1.5, such as native image generation and improved tool use accuracy. For production environments where stability is critical, verify that a GA (generally available) version is being used.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Rather than theory alone, understanding deepens by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Details |
|------|---------|
| Developer | Google DeepMind |
| Architecture | Transformer (MoE) + multimodal-native |
| Maximum Context | 2 million tokens (1.5 Pro) |
| Modalities | Text, image, audio, video, code |
| Model Line | Ultra / Pro / Flash / Nano |
| API Access | Google AI Studio (free tier available), Vertex AI |
| Differentiators | Ultra-long context, Google integration, on-device |
| Main Competitors | GPT-4o (OpenAI), Claude (Anthropic) |
| Cost Optimization | Context Caching, Flash models, prompt optimization |
| Troubleshooting | Rate limit retry, safety diagnosis, token check |

---

## What to Read Next

- [03-open-source.md](./03-open-source.md) — Comparison with open-source LLMs
- [04-model-comparison.md](./04-model-comparison.md) — Cross-model comparison
- [../02-applications/04-multimodal.md](../02-applications/04-multimodal.md) — Practical multimodal usage

---

## References

1. Google DeepMind, "Gemini: A Family of Highly Capable Multimodal Models," arXiv:2312.11805, 2023
2. Google, "Gemini API Documentation," https://ai.google.dev/docs
3. Google Cloud, "Vertex AI Gemini API," https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini
4. Reid et al., "Gemini 1.5: Unlocking multimodal understanding across millions of tokens of context," arXiv:2403.05530, 2024
5. Shazeer et al., "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer," ICLR 2017
6. Google, "Context Caching Guide," https://ai.google.dev/gemini-api/docs/caching
7. Google, "Grounding with Google Search," https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview
