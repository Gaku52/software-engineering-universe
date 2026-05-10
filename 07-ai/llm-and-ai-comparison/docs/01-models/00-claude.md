# Claude — Anthropic's AI Assistant

> An overview of the Claude model family built on Constitutional AI, covering API usage, and key differentiators from other models.

## What You Will Learn

1. Characteristics and use cases for each **Claude family** model (Haiku / Sonnet / Opus)
2. The principles of **Constitutional AI** and Claude's safety design
3. Practical usage and best practices for the **Claude API**
4. High-accuracy reasoning with **Extended Thinking**
5. **Claude Code** and agentic workflows
6. Tool integration via **MCP (Model Context Protocol)**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Overview of the Claude Family

### ASCII Diagram 1: Claude Model Family

```
Claude Model Family (2024-2025)
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Claude 3.5 / 4 Family                                     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Haiku     │  │   Sonnet    │  │    Opus     │     │
│  │              │  │              │  │              │     │
│  │ Ultra-fast   │  │ Balanced     │  │ Best         │     │
│  │ Lowest cost  │  │ Best value   │  │ performance  │     │
│  │ Classification│  │ General      │  │ Complex      │     │
│  │ Real-time    │  │ Coding       │  │ Research     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
│  Performance: Haiku ←───── Sonnet ────── Opus ──→ High     │
│  Speed:       Haiku ──→ Fast  Sonnet ──── Opus ←─── Slow   │
│  Cost:        Haiku ←── Low   Sonnet ──── Opus ──→ High    │
│                                                            │
│  Common: 200K context, multimodal support, tool use        │
│                                                            │
│  Claude 4 Opus additional features:                        │
│  ├── Extended Thinking mode                                │
│  ├── Accurate understanding and generation of long text    │
│  ├── Advanced code comprehension and debugging             │
│  └── Multi-step complex reasoning                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 1.1 Criteria for Choosing a Model

```
┌────────────────────────────────────────────────────────────┐
│              Claude Model Selection Guide                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  When to choose Haiku:                                     │
│  ├── Bulk text classification (sentiment, category)        │
│  ├── Simple data extraction (names, dates, amounts)        │
│  ├── Templated response generation (FAQ, form filling)     │
│  ├── Real-time responses required (chatbots)               │
│  ├── High-volume processing with tight cost constraints    │
│  └── Pre-processing / filtering (before routing)          │
│                                                            │
│  When to choose Sonnet:                                    │
│  ├── Code generation and review                            │
│  ├── Document writing and translation                      │
│  ├── Moderate analysis and summarization                   │
│  ├── Tasks involving tool use                              │
│  ├── Answer generation in RAG pipelines                    │
│  └── When balance between cost and quality matters         │
│                                                            │
│  When to choose Opus:                                      │
│  ├── Complex multi-step reasoning (math, logic puzzles)    │
│  ├── Understanding and refactoring large codebases         │
│  ├── Deep analysis and critique of research papers         │
│  ├── Long-form creative writing and editing                │
│  ├── When subtle nuance comprehension is required          │
│  └── Complex problems where Extended Thinking helps        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Code Example 1: Basic Claude API Usage

```python
import anthropic

client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 環境変数を使用

# 基本的なメッセージ送信
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system="あなたは日本語で回答する技術アシスタントです。",
    messages=[
        {"role": "user", "content": "Pythonのデコレータを説明してください"}
    ]
)

print(response.content[0].text)
print(f"入力トークン: {response.usage.input_tokens}")
print(f"出力トークン: {response.usage.output_tokens}")
print(f"モデル: {response.model}")
print(f"停止理由: {response.stop_reason}")
```

### Code Example 2: Streaming Responses

```python
import anthropic

client = anthropic.Anthropic()

# ストリーミングで応答を受け取る（体感レイテンシの大幅改善）
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=2048,
    system="あなたは技術文書の専門家です。",
    messages=[
        {"role": "user", "content": "マイクロサービスアーキテクチャの利点と課題を説明してください"}
    ]
) as stream:
    full_response = ""
    for text in stream.text_stream:
        print(text, end="", flush=True)
        full_response += text

    print()

    # ストリーム完了後のメタデータ
    final_message = stream.get_final_message()
    print(f"\n入力トークン: {final_message.usage.input_tokens}")
    print(f"出力トークン: {final_message.usage.output_tokens}")
```

### Code Example 3: Multi-turn Conversation

```python
import anthropic
from typing import List, Dict

class ClaudeConversation:
    """Claude とのマルチターン会話管理"""

    def __init__(
        self,
        model: str = "claude-sonnet-4-20250514",
        system: str = "",
        max_tokens: int = 2048,
    ):
        self.client = anthropic.Anthropic()
        self.model = model
        self.system = system
        self.max_tokens = max_tokens
        self.messages: List[Dict] = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    def chat(self, user_message: str) -> str:
        """メッセージを送信して応答を取得"""
        self.messages.append({"role": "user", "content": user_message})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=self.system,
            messages=self.messages,
        )

        assistant_message = response.content[0].text
        self.messages.append({"role": "assistant", "content": assistant_message})

        self.total_input_tokens += response.usage.input_tokens
        self.total_output_tokens += response.usage.output_tokens

        return assistant_message

    def reset(self):
        """会話をリセット"""
        self.messages = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0

    def get_stats(self) -> Dict:
        """会話の統計情報"""
        return {
            "turns": len(self.messages) // 2,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
        }

# 使用例
conv = ClaudeConversation(
    system="あなたは親切なプログラミング講師です。段階的に教えてください。"
)

print(conv.chat("Pythonのリスト内包表記を教えてください"))
print(conv.chat("条件付きのリスト内包表記はどう書きますか？"))
print(conv.chat("ネストされた場合はどうなりますか？"))
print(f"\n統計: {conv.get_stats()}")
```

### Code Example 4: Vision (Image Understanding)

```python
import anthropic
import base64
import httpx

client = anthropic.Anthropic()

# パターン1: ローカルファイルから
def analyze_local_image(image_path: str, prompt: str) -> str:
    """ローカル画像を分析"""
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    # 拡張子からメディアタイプを判定
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    ext = "." + image_path.rsplit(".", 1)[-1].lower()
    media_type = media_types.get(ext, "image/png")

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_data,
                    },
                },
                {"type": "text", "text": prompt}
            ],
        }]
    )
    return response.content[0].text

# パターン2: URLから
def analyze_url_image(image_url: str, prompt: str) -> str:
    """URL画像を分析"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": image_url,
                    },
                },
                {"type": "text", "text": prompt}
            ],
        }]
    )
    return response.content[0].text

# パターン3: 複数画像の比較
def compare_images(image_paths: list, prompt: str) -> str:
    """複数画像を比較分析"""
    content = []
    for path in image_paths:
        with open(path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": data},
        })
    content.append({"type": "text", "text": prompt})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": content}]
    )
    return response.content[0].text

# 使用例
result = analyze_local_image(
    "architecture_diagram.png",
    "このアーキテクチャ図を分析し、以下を教えてください:\n"
    "1. 全体構成の概要\n"
    "2. 潜在的なボトルネック\n"
    "3. 改善提案"
)
print(result)
```

---

## 2. Constitutional AI

### ASCII Diagram 2: How Constitutional AI Works

```
Constitutional AI (CAI) のプロセス:

Phase 1: 自己批評 (Supervised Learning)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 有害な        │ →  │ モデルが応答  │ →  │ 憲法原則に   │
│ プロンプトを  │    │ を生成       │    │ 基づき自己   │
│ 収集          │    │ (Red Team)   │    │ 批評を実行   │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │ 改善版の応答  │
                                        │ を自己生成    │
                                        │ (Revision)   │
                                        └──────────────┘

Phase 2: RLAIF (RL from AI Feedback)
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 応答ペア      │ →  │ AI が憲法原則│ →  │ 報酬モデルを │
│ (元 vs 改善)  │    │ に基づき好み │    │ 学習し       │
└──────────────┘    │ を判定       │    │ PPO で最適化 │
                    │ (人間の代わり)│    └──────────────┘
                    └──────────────┘

「憲法」（Constitution）の例:
┌──────────────────────────────────────────────────────┐
│ 1. 有用性: ユーザーの意図を正確に理解し助けること      │
│ 2. 正直さ: 不確実な場合は正直にそう述べること          │
│ 3. 無害性: 危害を助長する情報を提供しないこと          │
│ 4. 公正性: 偏見や差別的な応答を避けること              │
│ 5. プライバシー: 個人情報を保護すること                │
│ 6. 透明性: AIであることを隠さないこと                  │
└──────────────────────────────────────────────────────┘

従来の RLHF との違い:
  RLHF:  人間のアノテーターが好みを判定 → 高コスト、スケールしにくい
  RLAIF: AI が原則に基づいて判定 → 低コスト、一貫性が高い、スケール可能
```

### 2.1 Practical Impact of Claude's Safety Properties

```
┌────────────────────────────────────────────────────────────┐
│    Impact of Claude's Safety Characteristics on Products    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Advantages:                                               │
│  ├── Built-in guardrails → lighter additional safety work  │
│  ├── Fewer inappropriate outputs → reduced brand risk      │
│  ├── Uncertainty disclosure → self-reported hallucinations │
│  ├── High-quality refusals → refusals that don't hurt UX   │
│  └── Multilingual safety → safety maintained in Japanese   │
│                                                            │
│  Caveats:                                                  │
│  ├── Over-safety → occasional over-refusal of valid requests│
│  ├── Medical/legal disclaimers → always appends "consult   │
│  │   a professional"                                       │
│  ├── Creative limits → restrictions on violent/sexual content│
│  └── Knowledge cutoff → training data has an expiry date  │
│                                                            │
│  Mitigations:                                              │
│  ├── Explicitly state allowed scope in the system prompt   │
│  ├── Provide sufficient context to prevent misunderstanding │
│  └── Consult Anthropic for custom handling if needed       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Code Example 5: Leveraging Safety Properties via System Prompts

```python
import anthropic

client = anthropic.Anthropic()

# Claude の安全性特性を活用したシステム設計
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=2048,
    system="""あなたは企業の法務アシスタントです。

以下の原則に従ってください:
1. 法的助言ではなく一般的な情報提供であることを明記する
2. 不確実な場合は「確認が必要」と述べる
3. 個人情報の取り扱いには特に注意する
4. 専門家への相談を適切に推奨する
5. 関連する法律や条文を参照する際は正確を期す
6. 回答の最後に免責事項を記載する

Claude の Constitutional AI による安全性に加え、
上記のアプリケーション固有のガードレールを設定しています。""",
    messages=[{
        "role": "user",
        "content": "退職時の有給休暇の扱いについて教えてください"
    }]
)

print(response.content[0].text)
```

---

## 3. Advanced Claude API Features

### 3.1 Extended Thinking

```python
import anthropic

client = anthropic.Anthropic()

# Extended Thinking を有効にした推論
response = client.messages.create(
    model="claude-opus-4-20250514",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000,  # 思考に使えるトークン数
    },
    messages=[{
        "role": "user",
        "content": """以下の複雑なシステム設計問題を分析してください。

大規模ECサイトで以下の要件を満たすアーキテクチャを設計:
1. 秒間10,000リクエストの処理
2. 99.99%の可用性
3. 在庫の整合性保証（二重販売の防止）
4. グローバル展開（日本、米国、欧州）
5. リアルタイムの価格更新
6. 不正検知の組み込み

トレードオフを含めて詳細に分析してください。"""
    }]
)

# 思考過程と最終回答を分離して表示
for block in response.content:
    if block.type == "thinking":
        print("=== 思考過程 ===")
        print(block.thinking[:500] + "...")  # 長いので一部のみ
    elif block.type == "text":
        print("\n=== 最終回答 ===")
        print(block.text)

print(f"\n思考トークン: {response.usage.cache_creation_input_tokens}")
print(f"出力トークン: {response.usage.output_tokens}")
```

### ASCII Diagram 3: How Extended Thinking Works

```
┌────────────────────────────────────────────────────────────┐
│              How Extended Thinking Works                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Standard mode:                                            │
│  Input ──→ [Claude's reasoning] ──→ Output                 │
│             (internal, not visible)                        │
│                                                            │
│  Extended Thinking mode:                                   │
│  Input ──→ [<thinking>...</thinking>] ──→ Output           │
│             Reasoning process is made explicit             │
│             ├── Problem decomposition                      │
│             ├── Evaluation of multiple approaches          │
│             ├── Trade-off analysis                         │
│             ├── Self-verification and correction           │
│             └── Conclusion derivation                      │
│                                                            │
│  Effects:                                                  │
│  ├── Math / logic problems: accuracy +20-40%               │
│  ├── Code generation: bug rate -30%                        │
│  ├── Complex analysis: transparent reasoning               │
│  └── Token cost: additional thinking tokens (budget-capped)│
│                                                            │
│  When to use:                                              │
│  ✓ Complex multi-step reasoning                            │
│  ✓ Analysis requiring high accuracy                        │
│  ✓ Mathematical / logical problems                         │
│  ✗ Simple response generation                              │
│  ✗ When real-time response is critical                     │
│  ✗ When cost optimization is the priority                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Tool Use (Function Calling)

```python
import anthropic
import json

client = anthropic.Anthropic()

# 複数ツールの定義
tools = [
    {
        "name": "get_weather",
        "description": "指定された都市の現在の天気を取得する",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "都市名（例: 東京、大阪、ニューヨーク）"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "温度の単位",
                    "default": "celsius"
                }
            },
            "required": ["city"]
        }
    },
    {
        "name": "search_database",
        "description": "社内データベースから情報を検索する",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "検索クエリ"
                },
                "table": {
                    "type": "string",
                    "enum": ["customers", "orders", "products"],
                    "description": "検索対象テーブル"
                },
                "limit": {
                    "type": "integer",
                    "description": "最大件数",
                    "default": 10
                }
            },
            "required": ["query", "table"]
        }
    },
    {
        "name": "send_email",
        "description": "メールを送信する",
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "宛先メールアドレス"},
                "subject": {"type": "string", "description": "件名"},
                "body": {"type": "string", "description": "本文"},
            },
            "required": ["to", "subject", "body"]
        }
    }
]

def execute_tool(name: str, input_data: dict) -> str:
    """ツールを実行する（実際のアプリケーションでは外部APIを呼び出す）"""
    if name == "get_weather":
        return json.dumps({
            "city": input_data["city"],
            "temperature": 22,
            "condition": "晴れ",
            "humidity": 45,
        }, ensure_ascii=False)
    elif name == "search_database":
        return json.dumps({
            "results": [{"id": 1, "name": "テストデータ"}],
            "total": 1,
        }, ensure_ascii=False)
    elif name == "send_email":
        return json.dumps({"status": "sent", "message_id": "msg_123"})
    return json.dumps({"error": "Unknown tool"})

def chat_with_tools(user_message: str) -> str:
    """ツール使用を含むチャット"""
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            tools=tools,
            messages=messages,
        )

        # ツール呼び出しがない場合は最終回答
        if response.stop_reason == "end_turn":
            return response.content[0].text

        # ツール呼び出しの処理
        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "user", "content": tool_results})

# 使用例
print(chat_with_tools("東京の天気を調べて、それに基づいた服装アドバイスをください"))
```

### 3.3 Prompt Caching

```python
import anthropic

client = anthropic.Anthropic()

# 大量のコンテキスト（ドキュメント、コードベース等）をキャッシュ
large_context = """
（ここに大量のドキュメント、API仕様書、コードベースなど）
... 数千〜数万トークンのコンテンツ ...
"""

# 1回目: キャッシュを作成
response1 = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "あなたは以下のドキュメントに基づいて質問に答えるアシスタントです。"
        },
        {
            "type": "text",
            "text": large_context,
            "cache_control": {"type": "ephemeral"}  # キャッシュ対象
        }
    ],
    messages=[{"role": "user", "content": "このドキュメントの概要を教えてください"}],
)

print(f"1回目 - キャッシュ作成トークン: {response1.usage.cache_creation_input_tokens}")
print(f"1回目 - キャッシュ読み取り: {response1.usage.cache_read_input_tokens}")

# 2回目以降: キャッシュから読み取り（90%コスト削減）
response2 = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": "あなたは以下のドキュメントに基づいて質問に答えるアシスタントです。"
        },
        {
            "type": "text",
            "text": large_context,
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[{"role": "user", "content": "セキュリティに関する部分を説明してください"}],
)

print(f"2回目 - キャッシュ作成トークン: {response2.usage.cache_creation_input_tokens}")
print(f"2回目 - キャッシュ読み取り: {response2.usage.cache_read_input_tokens}")
# → キャッシュヒットにより大幅なコスト削減
```

### 3.4 Batch API

```python
import anthropic
import json

client = anthropic.Anthropic()

# 大量のリクエストをバッチで処理（50%コスト削減、24時間以内に完了）
batch_requests = []
for i in range(100):
    batch_requests.append({
        "custom_id": f"request_{i}",
        "params": {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "messages": [
                {"role": "user", "content": f"製品レビュー #{i} を分析してください: ..."}
            ]
        }
    })

# バッチの作成
batch = client.batches.create(requests=batch_requests)
print(f"バッチID: {batch.id}")
print(f"ステータス: {batch.processing_status}")

# バッチのステータス確認
batch_status = client.batches.retrieve(batch.id)
print(f"処理済み: {batch_status.request_counts.succeeded}")
print(f"失敗: {batch_status.request_counts.errored}")

# 結果の取得（完了後）
if batch_status.processing_status == "ended":
    for result in client.batches.results(batch.id):
        print(f"ID: {result.custom_id}")
        if result.result.type == "succeeded":
            print(f"回答: {result.result.message.content[0].text[:100]}...")
```

---

## 4. Claude Code and Agentic Workflows

### ASCII Diagram 4: Claude Code Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Claude Code                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   User   │ →  │ Claude Code  │ →  │ Claude API   │     │
│  │ (terminal)│    │ CLI          │    │ (Opus/Sonnet)│     │
│  └──────────┘    └──────┬───────┘    └──────────────┘     │
│                         │                                  │
│                    Available Tools                         │
│                    ┌─────────────────┐                     │
│                    │ Read    - File reading                 │
│                    │ Write   - File writing                 │
│                    │ Edit    - File editing                 │
│                    │ Bash    - Command execution            │
│                    │ Glob    - File search                  │
│                    │ Grep    - Text search                  │
│                    │ Task    - Subtask delegation           │
│                    │ MCP     - External tool integration    │
│                    └─────────────────┘                     │
│                                                            │
│  Workflow:                                                 │
│  1. User gives instructions in natural language            │
│  2. Claude decomposes the task                             │
│  3. Selects and executes the necessary tools               │
│  4. Reviews results and iterates with corrections          │
│  5. Reports the final outcome                              │
│                                                            │
│  Features:                                                 │
│  ├── Autonomous agentic execution                          │
│  ├── Direct filesystem manipulation                        │
│  ├── Git operations (commit, diff, etc.)                   │
│  ├── Test execution and fix loop                           │
│  ├── Tool extension via MCP                                │
│  └── Memory management with /compact                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Code Example 6: MCP Server Implementation

```python
"""
MCP (Model Context Protocol) サーバーの実装例
Claude Code や他の MCP クライアントから呼び出し可能なツールを提供
"""
from mcp.server import Server
from mcp.types import Tool, TextContent
import json
import sqlite3

# MCP サーバーの初期化
server = Server("my-tools")

@server.tool()
async def query_database(query: str, database: str = "main.db") -> str:
    """SQLiteデータベースに対してSELECTクエリを実行する

    Args:
        query: 実行するSELECTクエリ
        database: データベースファイルパス

    Returns:
        クエリ結果のJSON文字列
    """
    # セキュリティチェック: SELECT のみ許可
    if not query.strip().upper().startswith("SELECT"):
        return json.dumps({"error": "SELECT クエリのみ許可されています"})

    try:
        conn = sqlite3.connect(database)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(query)
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return json.dumps({"results": rows, "count": len(rows)}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

@server.tool()
async def analyze_logs(
    log_path: str,
    level: str = "ERROR",
    last_n: int = 100,
) -> str:
    """ログファイルを分析して指定レベル以上のログを抽出する

    Args:
        log_path: ログファイルのパス
        level: フィルタするログレベル (DEBUG, INFO, WARN, ERROR)
        last_n: 最後のN行を対象にする

    Returns:
        フィルタされたログエントリのJSON
    """
    level_order = {"DEBUG": 0, "INFO": 1, "WARN": 2, "ERROR": 3}
    min_level = level_order.get(level, 0)

    try:
        with open(log_path, "r") as f:
            lines = f.readlines()[-last_n:]

        filtered = []
        for line in lines:
            for lvl, order in level_order.items():
                if lvl in line and order >= min_level:
                    filtered.append(line.strip())
                    break

        return json.dumps({
            "total_lines": len(lines),
            "filtered_count": len(filtered),
            "entries": filtered[:50],  # 最大50件
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

# Claude Code の設定ファイル (.claude/mcp.json)
mcp_config = {
    "mcpServers": {
        "my-tools": {
            "command": "python",
            "args": ["mcp_server.py"],
            "env": {
                "DATABASE_PATH": "/path/to/db"
            }
        }
    }
}
```

---

## 5. Practical Use Cases

### 5.1 Code Review Assistant

```python
import anthropic
from pathlib import Path

class CodeReviewAssistant:
    """Claude を使ったコードレビューアシスタント"""

    def __init__(self):
        self.client = anthropic.Anthropic()

    def review_file(self, file_path: str) -> str:
        """ファイルのコードレビュー"""
        code = Path(file_path).read_text()
        ext = Path(file_path).suffix

        language_map = {
            ".py": "Python",
            ".ts": "TypeScript",
            ".js": "JavaScript",
            ".go": "Go",
            ".rs": "Rust",
            ".java": "Java",
        }
        language = language_map.get(ext, "Unknown")

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=f"""あなたはシニアソフトウェアエンジニアです。
{language}のコードレビューを行います。

レビュー観点:
1. バグ・ロジックエラー
2. セキュリティ脆弱性
3. パフォーマンス問題
4. 可読性・保守性
5. テスタビリティ
6. エラーハンドリング

各問題には以下の情報を含めてください:
- 行番号（概算）
- 深刻度: Critical / High / Medium / Low
- 問題の説明
- 修正案（コード付き）""",
            messages=[{
                "role": "user",
                "content": f"以下の {language} コードをレビューしてください:\n\n```{ext[1:]}\n{code}\n```"
            }]
        )
        return response.content[0].text

    def review_diff(self, diff: str) -> str:
        """Git diff のレビュー"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system="""あなたはコードレビュアーです。
Git diff を分析し、以下を確認してください:
1. 変更の目的は明確か
2. 意図しない変更がないか
3. テストの追加・更新が必要か
4. パフォーマンスへの影響
5. 後方互換性の問題""",
            messages=[{
                "role": "user",
                "content": f"以下の diff をレビューしてください:\n\n```diff\n{diff}\n```"
            }]
        )
        return response.content[0].text

# 使用例
reviewer = CodeReviewAssistant()
review = reviewer.review_file("src/api/handlers.py")
print(review)
```

### 5.2 Document Analysis Pipeline

```python
import anthropic
from typing import List, Dict
import json

class DocumentAnalyzer:
    """長文ドキュメントの分析パイプライン"""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic()
        self.model = model

    def analyze(self, document: str, analysis_type: str = "comprehensive") -> Dict:
        """ドキュメントの包括的分析"""
        analyses = {
            "comprehensive": self._comprehensive_analysis,
            "summary": self._summary,
            "key_points": self._extract_key_points,
            "risks": self._risk_analysis,
            "action_items": self._extract_action_items,
        }

        analyzer = analyses.get(analysis_type, self._comprehensive_analysis)
        return analyzer(document)

    def _comprehensive_analysis(self, document: str) -> Dict:
        """包括的な分析"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system="ドキュメントアナリストとして分析してください。",
            messages=[{
                "role": "user",
                "content": f"""以下のドキュメントを包括的に分析し、JSON形式で出力してください。

<document>
{document}
</document>

出力形式:
{{
    "title": "ドキュメントのタイトル/主題",
    "summary": "200字以内の要約",
    "key_points": ["要点1", "要点2", ...],
    "risks": ["リスク1", "リスク2", ...],
    "action_items": ["アクション1", "アクション2", ...],
    "sentiment": "positive/neutral/negative",
    "confidence": 0.0-1.0,
    "topics": ["トピック1", "トピック2", ...],
    "questions": ["追加調査が必要な点1", ...]
}}"""
            }]
        )

        try:
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return {"raw_analysis": response.content[0].text}

    def compare_documents(self, doc1: str, doc2: str) -> Dict:
        """2つのドキュメントの比較分析"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""以下の2つのドキュメントを比較分析してください。

<document_1>
{doc1}
</document_1>

<document_2>
{doc2}
</document_2>

比較観点:
1. 共通点
2. 相違点
3. 矛盾する内容
4. 一方にのみ含まれる情報
5. 推奨事項"""
            }]
        )
        return {"comparison": response.content[0].text}
```

---

## 6. Cost Optimization

### Comparison Table 1: Detailed Claude Model Comparison

| Item | Haiku | Sonnet | Opus |
|------|-------|--------|------|
| Best for | Classification, extraction, lightweight tasks | General use, coding, analysis | Complex reasoning, research, creative work |
| Input price (/1M tokens) | $0.80 | $3.00 | $15.00 |
| Output price (/1M tokens) | $4.00 | $15.00 | $75.00 |
| Cache read | $0.08 | $0.30 | $1.50 |
| Batch input | $0.40 | $1.50 | $7.50 |
| Batch output | $2.00 | $7.50 | $37.50 |
| Context length | 200K | 200K | 200K |
| Speed (tokens/sec) | Very fast | Fast | Moderate |
| Extended Thinking | No | No | Yes |
| Coding capability | Good | Excellent | Best |
| Reasoning capability | Good | Excellent | Best |
| Vision support | Yes | Yes | Yes |

### Cost Optimization Strategies

```python
from dataclasses import dataclass
from typing import List

@dataclass
class CostEstimate:
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float

class ClaudeCostOptimizer:
    """Claude の利用コストを最適化する"""

    PRICING = {
        "haiku": {"input": 0.80, "output": 4.00, "cache_read": 0.08},
        "sonnet": {"input": 3.00, "output": 15.00, "cache_read": 0.30},
        "opus": {"input": 15.00, "output": 75.00, "cache_read": 1.50},
    }

    @classmethod
    def estimate_cost(
        cls,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
        batch: bool = False,
    ) -> CostEstimate:
        """コスト概算"""
        pricing = cls.PRICING[model]
        batch_discount = 0.5 if batch else 1.0

        input_cost = (input_tokens / 1_000_000) * pricing["input"] * batch_discount
        output_cost = (output_tokens / 1_000_000) * pricing["output"] * batch_discount
        cache_cost = (cache_read_tokens / 1_000_000) * pricing["cache_read"]

        total = input_cost + output_cost + cache_cost

        return CostEstimate(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=total,
        )

    @classmethod
    def compare_models(
        cls,
        input_tokens: int,
        output_tokens: int,
        requests_per_day: int = 1000,
    ) -> List[CostEstimate]:
        """モデル間のコスト比較"""
        results = []
        for model in ["haiku", "sonnet", "opus"]:
            estimate = cls.estimate_cost(model, input_tokens, output_tokens)
            daily_cost = estimate.cost_usd * requests_per_day
            monthly_cost = daily_cost * 30
            results.append({
                "model": model,
                "per_request": f"${estimate.cost_usd:.4f}",
                "daily": f"${daily_cost:.2f}",
                "monthly": f"${monthly_cost:.2f}",
            })
            print(f"{model:>8}: ${estimate.cost_usd:.4f}/req, "
                  f"${daily_cost:.2f}/day, ${monthly_cost:.2f}/month")
        return results

# コスト比較
print("=== 1000入力/500出力トークンのコスト比較 ===")
print(f"(1日1000リクエスト想定)")
ClaudeCostOptimizer.compare_models(1000, 500, 1000)

print("\n=== プロンプトキャッシュの効果 ===")
# キャッシュなし
no_cache = ClaudeCostOptimizer.estimate_cost("sonnet", 50000, 500)
# キャッシュあり（90%がキャッシュヒット）
with_cache = ClaudeCostOptimizer.estimate_cost(
    "sonnet", 5000, 500, cache_read_tokens=45000
)
print(f"キャッシュなし: ${no_cache.cost_usd:.4f}")
print(f"キャッシュあり: ${with_cache.cost_usd:.4f}")
print(f"節約率: {(1 - with_cache.cost_usd/no_cache.cost_usd)*100:.1f}%")
```

### Comparison Table 2: Claude vs Other Models

| Feature | Claude 4 | GPT-4o | Gemini 2.0 Pro | DeepSeek V3 |
|---------|----------|--------|----------------|-------------|
| Safety approach | Constitutional AI | RLHF | Undisclosed | RLHF |
| Context length | 200K | 128K | 1M+ | 128K |
| Extended Thinking | Yes (Opus) | o1-pro separate model | Flash Thinking | R1 separate model |
| Japanese capability | Excellent | Excellent | Good | Good |
| Code generation | Best-in-class | Excellent | Good | Excellent |
| Long-text comprehension | Very strong | Good | Best | Good |
| Tool use | Excellent | Excellent | Good | Limited |
| Batch API | Yes (50% off) | Yes (50% off) | Yes | No |
| Prompt caching | Yes (90% off) | Yes | Context caching | No |
| Pricing tier | Moderate | Moderate | Moderate | Low |
| Open source | No | No | No | Yes |

---

## Anti-patterns

### Anti-pattern 1: Always Using the Same Model

```
Wrong: Use Opus for all tasks
  → Unnecessarily high cost and increased latency

Right: Choose the model based on the task
  Haiku: Classification, sentiment analysis, simple Q&A, pre-processing
  Sonnet: Code generation, document writing, general analysis, RAG answers
  Opus: Complex reasoning, research-level analysis, long-form creative writing, Extended Thinking

  Cost example (10,000 requests/day, avg 1K input / 500 output tokens):
  - All Opus:   $285/day = $8,550/month
  - All Sonnet: $57/day  = $1,710/month
  - Mixed (Haiku 70% + Sonnet 25% + Opus 5%): $22/day = $660/month
```

### Anti-pattern 2: Not Using Prompt Caching

```
Wrong: Send the same system prompt or shared context in full every time
  → High token consumption, increased latency

Right: Use Claude's prompt caching
  - Mark shared sections of 1024+ tokens with cache_control
  - 90% cost reduction from the second request onwards
  - TTL is 5 minutes (from the last access)

  Example impact:
  Querying a 50K-token document 10 times:
  - Without cache: $1.50  (50K × 10 × $3/1M)
  - With cache:    $0.285 (50K × $3/1M + 50K × 9 × $0.30/1M)
  → 81% cost reduction
```

### Anti-pattern 3: Not Using Streaming

```
Wrong: Always wait for the full response in blocking mode
  → Users stare at a blank screen for a long time

Right: Use streaming to improve perceived latency
  - Time to First Token (TTFT) is what matters most
  - Sonnet's TTFT is typically 200-500ms
  - No need to wait for the full 500-3000ms response
```

### Anti-pattern 4: Missing Error Handling

```python
# NG: エラーハンドリングなし
response = client.messages.create(...)

# OK: 適切なリトライとフォールバック
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=lambda e: isinstance(e, (
        anthropic.RateLimitError,
        anthropic.InternalServerError,
        anthropic.APIConnectionError,
    ))
)
def safe_call(messages, model="claude-sonnet-4-20250514"):
    try:
        return client.messages.create(
            model=model,
            max_tokens=2048,
            messages=messages,
        )
    except anthropic.BadRequestError as e:
        # トークン制限超過等 → フォールバック
        print(f"BadRequest: {e}")
        return None
```


---

## Practice Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

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
- Measure effectiveness with benchmarks
---

## FAQ

### Q1: What is Claude's greatest strength?

**A:** Claude has multiple strengths, but the following stand out in particular:
1. **Long-context comprehension**: Can practically leverage a 200K-token context window, making it well-suited for analyzing large codebases and lengthy documents
2. **Safety**: Built-in safety via Constitutional AI reduces risk in production use
3. **Coding capability**: Especially combined with Claude Code, it enables agentic coding assistance
4. **Japanese language quality**: Produces high-quality, natural responses in Japanese

### Q2: How does Claude API rate limiting work?

**A:** It is managed in tiers:
- **Tier 1**: ~50 RPM, ~40K TPM/day
- **Tier 2**: ~1000 RPM, ~80K TPM/day
- **Tier 3**: ~2000 RPM, ~160K TPM/day
- **Tier 4**: ~4000 RPM, ~400K TPM/day

Using the Batch API significantly reduces the impact of rate limits. Tiers are automatically upgraded based on usage spend.

### Q3: What is Claude Code?

**A:** Claude Code is Anthropic's official CLI tool that lets you interact with Claude from the terminal while coding. It can perform file reads and writes, Git operations, and test execution in an agentic manner, and integrates with external tools via MCP (Model Context Protocol). It is also available as a VS Code extension.

### Q4: When should I use Extended Thinking?

**A:** It is particularly effective in the following situations:
- Solving mathematical or logical problems
- Debugging complex code
- Situations requiring multi-faceted analysis
- When high accuracy is required but latency is acceptable

You can control the amount of thinking with `budget_tokens` to balance cost and quality.

### Q5: What is the best way to use prompt caching?

**A:** The following patterns are effective:
- **RAG pipelines**: Cache retrieved documents and handle multiple queries against the same document
- **Code review**: Cache the codebase and review from different perspectives
- **Long system prompts**: Cache detailed instructions
- Minimum block size is 1024 tokens; TTL is 5 minutes

### Q6: How can I prevent hallucinations with Claude?

**A:** Combine multiple approaches:
1. **Use RAG**: Inject external knowledge when factual answers are required
2. **Request citations**: "Please provide the basis for your answer" / "Please cite your sources"
3. **Encourage uncertainty disclosure**: "If you are not confident, please say so"
4. **Set temperature to 0**: Use deterministic output for fact verification
5. **Add a verification step**: Have the model self-verify its answer after responding

---

## Summary

| Item | Key Point |
|------|-----------|
| Claude family | Three tiers: Haiku (speed) / Sonnet (balance) / Opus (performance) |
| Constitutional AI | Alignment through self-critique based on constitutional principles |
| API features | Messages, streaming, tool use, vision support |
| Extended Thinking | Extended reasoning mode available on Opus |
| Context | Long-context window of 200K tokens |
| Prompt caching | Reduces repeated context costs by 90% |
| Batch API | Processes large volumes of requests at 50% cost reduction |
| Claude Code | CLI-based AI coding assistant |
| MCP | Tool integration via Model Context Protocol |

---

## Further Reading

- [01-gpt.md](./01-gpt.md) -- Comparison with the GPT family
- [04-model-comparison.md](./04-model-comparison.md) -- Cross-model comparison
- [../02-applications/02-function-calling.md](../02-applications/02-function-calling.md) -- Function Calling in depth

---

## References

1. Anthropic. (2023). "Claude's Constitution." https://www.anthropic.com/index/claudes-constitution
2. Bai, Y. et al. (2022). "Constitutional AI: Harmlessness from AI Feedback." *arXiv:2212.08073*. https://arxiv.org/abs/2212.08073
3. Anthropic. "Claude API Documentation." https://docs.anthropic.com/
4. Anthropic. "Model Context Protocol (MCP)." https://modelcontextprotocol.io/
5. Anthropic. "Claude Code Documentation." https://docs.anthropic.com/claude-code/
6. Anthropic. "Prompt Caching." https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
