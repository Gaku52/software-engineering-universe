# Function Calling — Tool Use, Schema Definition, and Error Handling

> Function Calling is a mechanism that enables LLMs to invoke external tools (APIs, databases, calculators, etc.) in a structured format. It is the core technology that evolves an LLM from an entity that merely "thinks" into an agent capable of "acting."

## What You Will Learn in This Chapter

1. **How Function Calling Works and Its Design Principles** — How an LLM decides to call a function and generates arguments
2. **Best Practices for Schema Definition** — Defining functions with JSON Schema, parameter design, and writing descriptions
3. **Practical Error Handling and Security** — Fallbacks on failure, input validation, and permission management
4. **Multi-Tool Orchestration** — Tool chains, parallel execution, and dynamic tool selection
5. **Production Operation Patterns** — Monitoring, cost optimization, and testing strategies


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [RAG — Retrieval-Augmented Generation, Chunking, and Reranking](./01-rag.md)

---

## 1. How Function Calling Works

```
┌──────────────────────────────────────────────────────────┐
│           Function Calling Execution Flow                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. User: "Tell me tomorrow's weather in Tokyo"          │
│     │                                                    │
│     ▼                                                    │
│  2. LLM: Determines a function call is needed            │
│     → get_weather(city="Tokyo", date="2025-03-15")       │
│     │                                                    │
│     ▼                                                    │
│  3. App: Executes the function and retrieves the result  │
│     → {"temp": 18, "condition": "Sunny", ...}            │
│     │                                                    │
│     ▼                                                    │
│  4. LLM: Responds in natural language                    │
│     → "Tomorrow in Tokyo will be sunny with a high       │
│        of 18 degrees."                                   │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  Important: The LLM does NOT execute         │        │
│  │  functions directly. It only outputs JSON    │        │
│  │  specifying "which function with what args." │        │
│  │  Execution is the application's responsibility.│       │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

### 1.1 The Internal Mechanism of Function Calling

```
┌─────────────────────────────────────────────────────────────────┐
│       The LLM's Internal Function Calling Decision Process        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input + Tool Definitions (embedded in the system prompt)  │
│       │                                                        │
│       ▼                                                        │
│  ┌──────────────────────┐                                      │
│  │  Intent Analysis      │                                      │
│  │  - Determine if a    │                                      │
│  │    tool call is      │                                      │
│  │    needed            │                                      │
│  │  - Which tool fits   │                                      │
│  └──────┬───────────────┘                                      │
│         │                                                      │
│    ┌────┴────┐                                                 │
│    ▼         ▼                                                 │
│  [Direct    [Tool Call]                                        │
│  Response]   │                                                 │
│              ▼                                                 │
│  ┌──────────────────────┐                                      │
│  │  Argument Generation  │                                      │
│  │  - Structured output │                                      │
│  │    per JSON Schema   │                                      │
│  │  - Validates required│                                      │
│  │  - Checks enum       │                                      │
│  │    constraints       │                                      │
│  └──────────────────────┘                                      │
│                                                                 │
│  Key Points:                                                    │
│  - The tool's description is the primary cue for selection      │
│  - Parameter descriptions directly impact argument accuracy     │
│  - Selection accuracy degrades as tool count grows (max 20 rec.)│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Function Calling vs. Other Approaches

| Approach | Mechanism | Accuracy | Flexibility | Setup Cost |
|-----------|--------|------|--------|----------|
| Function Calling (Native) | Built-in LLM API feature | High | Medium | Low |
| ReAct Prompting | Instructs tool use via prompt | Medium | High | Low |
| Code Interpreter | LLM generates and executes code | High | Highest | Medium |
| Plugin System | Provides LLM with a list of plugins | Medium–High | High | High |
| MCP (Model Context Protocol) | Standardized tool connection | High | Highest | Medium |

---

## 2. Provider-Specific Implementations

### 2.1 OpenAI Function Calling

```python
from openai import OpenAI
import json

client = OpenAI()

# Tool definition
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "指定された都市の天気予報を取得します",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "都市名 (例: 'Tokyo', 'Osaka')",
                    },
                    "date": {
                        "type": "string",
                        "description": "日付 (YYYY-MM-DD形式)",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度の単位",
                    },
                },
                "required": ["city"],
            },
        },
    }
]

# LLM call
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "東京の明日の天気は？"}],
    tools=tools,
    tool_choice="auto",  # auto / required / none / {"type":"function","function":{"name":"..."}}
)

# Processing the Function Call
message = response.choices[0].message
if message.tool_calls:
    for tool_call in message.tool_calls:
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)
        print(f"関数: {function_name}, 引数: {arguments}")

        # Execute the actual function
        result = execute_function(function_name, arguments)

        # Return the result to the LLM
        follow_up = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": "東京の明日の天気は？"},
                message,  # LLMの関数呼び出し要求
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                },
            ],
        )
        print(follow_up.choices[0].message.content)
```

### 2.2 OpenAI Structured Output + Function Calling

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

# Define schema with a Pydantic model (Structured Output)
class FlightSearch(BaseModel):
    origin: str
    destination: str
    date: str
    passengers: int = 1
    cabin_class: str = "economy"

class FlightSearchResult(BaseModel):
    flights: list[dict]
    total_count: int
    cheapest_price: float

# Tool definition using Structured Output
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_flights",
            "description": "フライトを検索します",
            "parameters": FlightSearch.model_json_schema(),
            "strict": True,  # Structured Output mode
        },
    }
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "来週の月曜に東京から大阪へのフライトを探して"}],
    tools=tools,
)

# With strict: True, arguments are guaranteed to fully conform to the schema
if response.choices[0].message.tool_calls:
    args = json.loads(response.choices[0].message.tool_calls[0].function.arguments)
    validated = FlightSearch(**args)  # Additional validation with Pydantic
    print(validated)
```

### 2.3 Anthropic Tool Use

```python
from anthropic import Anthropic

client = Anthropic()

# Tool definition
tools = [
    {
        "name": "get_weather",
        "description": "指定された都市の天気予報を取得します",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "都市名",
                },
                "date": {
                    "type": "string",
                    "description": "日付 (YYYY-MM-DD)",
                },
            },
            "required": ["city"],
        },
    }
]

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "東京の天気を教えて"}],
)

# Process tool_use blocks
for block in response.content:
    if block.type == "tool_use":
        print(f"ツール: {block.name}, 入力: {block.input}")

        # Return the result
        result = execute_function(block.name, block.input)

        follow_up = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            tools=tools,
            messages=[
                {"role": "user", "content": "東京の天気を教えて"},
                {"role": "assistant", "content": response.content},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        }
                    ],
                },
            ],
        )
```

### 2.4 Anthropic Tool Use with Streaming

```python
from anthropic import Anthropic
import json

client = Anthropic()

def stream_with_tools(user_message: str, tools: list):
    """Tool use with streaming support"""

    messages = [{"role": "user", "content": user_message}]

    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        tools=tools,
        messages=messages,
    ) as stream:
        tool_use_blocks = []
        text_content = ""

        for event in stream:
            if event.type == "content_block_start":
                if event.content_block.type == "tool_use":
                    tool_use_blocks.append({
                        "id": event.content_block.id,
                        "name": event.content_block.name,
                        "input_json": "",
                    })
            elif event.type == "content_block_delta":
                if hasattr(event.delta, "partial_json"):
                    tool_use_blocks[-1]["input_json"] += event.delta.partial_json
                elif hasattr(event.delta, "text"):
                    text_content += event.delta.text
                    print(event.delta.text, end="", flush=True)

        # Execute tool calls if present
        for tool_block in tool_use_blocks:
            input_data = json.loads(tool_block["input_json"])
            result = execute_function(tool_block["name"], input_data)
            print(f"\n[ツール実行] {tool_block['name']}: {result}")
```

### 2.5 Gemini Function Calling

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")

# Function declaration
get_weather = genai.protos.FunctionDeclaration(
    name="get_weather",
    description="指定された都市の天気予報を取得します",
    parameters=genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties={
            "city": genai.protos.Schema(type=genai.protos.Type.STRING),
            "date": genai.protos.Schema(type=genai.protos.Type.STRING),
        },
        required=["city"],
    ),
)

tool = genai.protos.Tool(function_declarations=[get_weather])
model = genai.GenerativeModel("gemini-1.5-pro", tools=[tool])

response = model.generate_content("東京の明日の天気は？")

# Process function_call
for part in response.parts:
    if fn := part.function_call:
        print(f"関数: {fn.name}, 引数: {dict(fn.args)}")
```

### 2.6 Gemini Automatic Function Execution Mode

```python
import google.generativeai as genai

def get_weather_impl(city: str, date: str = None) -> dict:
    """Actual weather retrieval function"""
    # API call implementation, etc.
    return {"city": city, "temp": 22, "condition": "晴れ"}

# Automatic function execution mode: executes automatically when LLM outputs a function call
model = genai.GenerativeModel(
    "gemini-1.5-pro",
    tools=[get_weather_impl],  # Pass Python function directly
)

# Automatic execution enabled with enable_automatic_function_calling
chat = model.start_chat(enable_automatic_function_calling=True)
response = chat.send_message("東京の明日の天気は？")

# → Function is executed automatically and the final answer is returned directly
print(response.text)
# "東京の明日の天気は晴れで、気温は22度の予想です。"
```

---

## 3. Best Practices for Schema Design

### 3.1 Writing Good Schemas

```python
# Good: Schema with detailed descriptions and constraints
good_schema = {
    "name": "search_products",
    "description": (
        "ECサイトの商品を検索します。"
        "キーワード、カテゴリ、価格帯で絞り込みが可能です。"
        "結果は関連度順で最大20件返されます。"
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "検索キーワード (例: 'ワイヤレスイヤホン ノイキャン')",
            },
            "category": {
                "type": "string",
                "enum": ["electronics", "fashion", "books", "food", "sports"],
                "description": "商品カテゴリ。省略時は全カテゴリを検索",
            },
            "price_min": {
                "type": "integer",
                "minimum": 0,
                "description": "最低価格 (円)。省略時は下限なし",
            },
            "price_max": {
                "type": "integer",
                "minimum": 0,
                "description": "最高価格 (円)。省略時は上限なし",
            },
            "sort_by": {
                "type": "string",
                "enum": ["relevance", "price_asc", "price_desc", "rating", "newest"],
                "description": "ソート順。デフォルトは relevance",
            },
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 20,
                "description": "取得件数。デフォルトは10",
            },
        },
        "required": ["query"],
    },
}
```

### 3.2 Schema Design Checklist

```python
def validate_tool_schema(schema: dict) -> list[str]:
    """Quality check for tool schemas"""

    warnings = []

    # 1. Check function name
    name = schema.get("name", "")
    if not name:
        warnings.append("ERROR: name が未定義")
    elif "_" not in name and len(name) > 15:
        warnings.append("WARNING: 関数名が長すぎます。snake_case で簡潔に")

    # 2. Check description
    desc = schema.get("description", "")
    if len(desc) < 20:
        warnings.append("WARNING: description が短すぎます (20文字以上推奨)")
    if "例" not in desc and "example" not in desc.lower():
        warnings.append("HINT: description に使用例を含めると精度向上")

    # 3. Check parameters
    params = schema.get("parameters", {}).get("properties", {})
    for param_name, param_def in params.items():
        param_desc = param_def.get("description", "")
        if not param_desc:
            warnings.append(f"WARNING: パラメータ '{param_name}' に description がありません")
        if param_def.get("type") == "string" and "enum" not in param_def:
            if "format" not in param_def:
                warnings.append(
                    f"HINT: パラメータ '{param_name}' に enum または format を追加すると精度向上"
                )

    # 4. Check required
    required = schema.get("parameters", {}).get("required", [])
    if not required:
        warnings.append("HINT: required パラメータを明示すると LLM の判断が改善")

    return warnings


# Usage example
schema = {
    "name": "query_db",
    "description": "DBを検索",
    "parameters": {
        "type": "object",
        "properties": {
            "q": {"type": "string"},
        },
    },
}

issues = validate_tool_schema(schema)
for issue in issues:
    print(issue)
# WARNING: description が短すぎます (20文字以上推奨)
# HINT: description に使用例を含めると精度向上
# WARNING: パラメータ 'q' に description がありません
# HINT: パラメータ 'q' に enum または format を追加すると精度向上
# HINT: required パラメータを明示すると LLM の判断が改善
```

### 3.3 Patterns for Complex Schemas

```python
# Pattern 1: Nested objects
nested_schema = {
    "name": "create_order",
    "description": "注文を作成します",
    "parameters": {
        "type": "object",
        "properties": {
            "customer": {
                "type": "object",
                "description": "顧客情報",
                "properties": {
                    "name": {"type": "string", "description": "顧客名"},
                    "email": {"type": "string", "format": "email", "description": "メールアドレス"},
                    "phone": {"type": "string", "description": "電話番号 (ハイフン付き)"},
                },
                "required": ["name", "email"],
            },
            "items": {
                "type": "array",
                "description": "注文商品リスト",
                "items": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string", "description": "商品ID"},
                        "quantity": {"type": "integer", "minimum": 1, "description": "数量"},
                    },
                    "required": ["product_id", "quantity"],
                },
                "minItems": 1,
            },
            "shipping_address": {
                "type": "object",
                "description": "配送先住所",
                "properties": {
                    "postal_code": {"type": "string", "pattern": "^\\d{3}-\\d{4}$"},
                    "prefecture": {"type": "string"},
                    "city": {"type": "string"},
                    "street": {"type": "string"},
                },
                "required": ["postal_code", "prefecture", "city", "street"],
            },
        },
        "required": ["customer", "items", "shipping_address"],
    },
}

# Pattern 2: Schema with conditional branching (oneOf)
conditional_schema = {
    "name": "process_payment",
    "description": "支払いを処理します。クレジットカードまたは銀行振込を選択",
    "parameters": {
        "type": "object",
        "properties": {
            "amount": {"type": "number", "description": "金額 (円)"},
            "method": {
                "type": "string",
                "enum": ["credit_card", "bank_transfer"],
                "description": "支払い方法",
            },
            "credit_card": {
                "type": "object",
                "description": "クレジットカード情報 (method=credit_card の場合必須)",
                "properties": {
                    "number": {"type": "string", "description": "カード番号 (16桁)"},
                    "expiry": {"type": "string", "description": "有効期限 (MM/YY)"},
                    "cvv": {"type": "string", "description": "セキュリティコード (3桁)"},
                },
            },
            "bank_account": {
                "type": "object",
                "description": "銀行口座情報 (method=bank_transfer の場合必須)",
                "properties": {
                    "bank_name": {"type": "string"},
                    "account_number": {"type": "string"},
                },
            },
        },
        "required": ["amount", "method"],
    },
}
```

### 3.4 Schema Formats by Provider

```
┌──────────────────────────────────────────────────────────┐
│     Function Calling Specification Comparison by Provider  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  OpenAI                                                  │
│  ├── tools[].function.parameters (JSON Schema)           │
│  ├── tool_choice: auto / required / none / specific      │
│  ├── parallel_tool_calls: true/false                     │
│  └── Can be combined with Structured Output              │
│      (response_format)                                   │
│                                                          │
│  Anthropic                                               │
│  ├── tools[].input_schema (JSON Schema)                  │
│  ├── tool_choice: auto / any / tool (specific)           │
│  ├── Supports parallel tool calls                        │
│  └── Can display reasoning via <thinking> tags           │
│                                                          │
│  Google Gemini                                           │
│  ├── FunctionDeclaration (protobuf format)               │
│  ├── function_calling_config: AUTO / ANY / NONE          │
│  ├── Can restrict with allowed_function_names            │
│  └── Automatic function execution mode                   │
│      (automatic_function_calling)                        │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Multi-Tool Orchestration

### 4.1 Tool Chains

```python
import json
from openai import OpenAI

client = OpenAI()

# Multiple tool definitions
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_flights",
            "description": "フライトを検索します",
            "parameters": {
                "type": "object",
                "properties": {
                    "origin": {"type": "string", "description": "出発地 (空港コード)"},
                    "destination": {"type": "string", "description": "目的地 (空港コード)"},
                    "date": {"type": "string", "description": "出発日 (YYYY-MM-DD)"},
                },
                "required": ["origin", "destination", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_flight",
            "description": "フライトを予約します",
            "parameters": {
                "type": "object",
                "properties": {
                    "flight_id": {"type": "string"},
                    "passenger_name": {"type": "string"},
                },
                "required": ["flight_id", "passenger_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_hotels",
            "description": "ホテルを検索します",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"},
                    "check_in": {"type": "string"},
                    "check_out": {"type": "string"},
                },
                "required": ["city", "check_in", "check_out"],
            },
        },
    },
]

def agent_loop(user_message: str):
    """Agent loop supporting multiple tools"""
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
        )

        message = response.choices[0].message
        messages.append(message)

        if not message.tool_calls:
            return message.content  # Final answer

        # Process all tool calls
        for tool_call in message.tool_calls:
            result = execute_function(
                tool_call.function.name,
                json.loads(tool_call.function.arguments),
            )
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

# Usage example: Multiple tools are called in a chain
answer = agent_loop("来週の月曜日に東京から大阪への出張を手配して。ホテルも1泊必要です。")
```

### 4.2 Parallel Tool Execution

```python
import asyncio
import json
from openai import OpenAI

client = OpenAI()

async def execute_tools_parallel(tool_calls: list) -> list[dict]:
    """Execute multiple tool calls in parallel"""

    async def execute_one(tool_call):
        name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)

        # Execute each tool asynchronously
        result = await asyncio.to_thread(execute_function, name, args)
        return {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result, ensure_ascii=False),
        }

    # Execute all tools in parallel
    results = await asyncio.gather(
        *[execute_one(tc) for tc in tool_calls],
        return_exceptions=True,
    )

    # Error handling
    tool_results = []
    for result, tool_call in zip(results, tool_calls):
        if isinstance(result, Exception):
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps({"error": str(result)}),
            })
        else:
            tool_results.append(result)

    return tool_results


async def agent_loop_async(user_message: str, max_iterations: int = 10):
    """Asynchronous agent loop with parallel tool execution support"""
    messages = [{"role": "user", "content": user_message}]

    for _ in range(max_iterations):
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
            parallel_tool_calls=True,  # Enable parallel calls
        )

        message = response.choices[0].message
        messages.append(message)

        if not message.tool_calls:
            return message.content

        # Parallel execution
        tool_results = await execute_tools_parallel(message.tool_calls)
        messages.extend(tool_results)

    return "Processing reached the maximum limit."
```

### 4.3 Dynamic Tool Selection (Tool Routing)

```python
from openai import OpenAI

client = OpenAI()

# All tool definitions (when there are many)
ALL_TOOLS = {
    "weather": [weather_tool_1, weather_tool_2],
    "travel": [flight_tool, hotel_tool, car_tool],
    "finance": [stock_tool, exchange_tool, portfolio_tool],
    "hr": [employee_tool, leave_tool, payroll_tool],
    "it": [ticket_tool, deploy_tool, monitor_tool],
}

def select_relevant_tools(user_message: str, max_tools: int = 10) -> list:
    """Dynamically select tools based on the user's message"""

    # 1. Determine category using LLM
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""以下のユーザーメッセージに関連するツールカテゴリを選択してください。
カテゴリ: {list(ALL_TOOLS.keys())}
カンマ区切りで返してください。

メッセージ: {user_message}""",
        }],
    )

    categories = [c.strip() for c in response.choices[0].message.content.split(",")]

    # 2. Aggregate tools from matched categories
    selected = []
    for cat in categories:
        if cat in ALL_TOOLS:
            selected.extend(ALL_TOOLS[cat])

    # 3. Limit the number of tools if too many
    return selected[:max_tools]


def agent_with_dynamic_tools(user_message: str):
    """Agent with dynamic tool selection"""
    # Step 1: Select relevant tools
    relevant_tools = select_relevant_tools(user_message)

    # Step 2: Run agent loop with selected tools
    return agent_loop(user_message, tools=relevant_tools)
```

### 4.4 Compressing Tool Results

```python
def compress_tool_result(result: dict, max_length: int = 2000) -> str:
    """Compress tool execution results to an LLM-friendly size"""

    result_str = json.dumps(result, ensure_ascii=False)

    if len(result_str) <= max_length:
        return result_str

    # Method 1: Truncate by key priority
    if isinstance(result, dict):
        priority_keys = ["summary", "title", "name", "status", "error", "count"]
        compressed = {}
        remaining_budget = max_length

        # Add priority keys first
        for key in priority_keys:
            if key in result:
                value = result[key]
                entry = json.dumps({key: value}, ensure_ascii=False)
                if len(entry) < remaining_budget:
                    compressed[key] = value
                    remaining_budget -= len(entry)

        # Add remaining keys
        for key, value in result.items():
            if key not in compressed:
                entry = json.dumps({key: value}, ensure_ascii=False)
                if len(entry) < remaining_budget:
                    compressed[key] = value
                    remaining_budget -= len(entry)

        return json.dumps(compressed, ensure_ascii=False)

    # Method 2: Limit list results by count
    if isinstance(result, list):
        truncated = result[:10]  # First 10 items only
        return json.dumps({
            "items": truncated,
            "total_count": len(result),
            "truncated": len(result) > 10,
        }, ensure_ascii=False)

    # Method 3: Truncate string
    return result_str[:max_length] + "... (truncated)"
```

---

## 5. Error Handling

### 5.1 Robust Error Handling

```python
import json
from typing import Any
from enum import Enum

class FunctionCallStatus(Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    UNAUTHORIZED = "unauthorized"
    RATE_LIMITED = "rate_limited"

class FunctionCallError(Exception):
    pass

def safe_execute_function(name: str, arguments: dict) -> dict[str, Any]:
    """Safe function execution wrapper"""

    # 1. Verify function exists
    registry = {
        "get_weather": get_weather,
        "search_products": search_products,
        "create_order": create_order,
    }

    if name not in registry:
        return {
            "error": f"Unknown function: {name}",
            "status": FunctionCallStatus.ERROR.value,
            "suggestion": f"Available functions: {list(registry.keys())}",
        }

    # 2. Validate arguments
    try:
        validated_args = validate_arguments(name, arguments)
    except ValueError as e:
        return {
            "error": f"Invalid arguments: {e}",
            "status": FunctionCallStatus.ERROR.value,
        }

    # 3. Permission check
    if not check_permission(name, current_user):
        return {
            "error": f"Permission denied for function: {name}",
            "status": FunctionCallStatus.UNAUTHORIZED.value,
        }

    # 4. Execute with timeout
    try:
        import asyncio
        result = asyncio.wait_for(
            registryname,
            timeout=10.0,  # 10-second timeout
        )
        return {"result": result, "status": FunctionCallStatus.SUCCESS.value}
    except asyncio.TimeoutError:
        return {
            "error": "Function execution timed out (10s limit)",
            "status": FunctionCallStatus.TIMEOUT.value,
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": FunctionCallStatus.ERROR.value,
            "traceback": traceback.format_exc() if DEBUG else None,
        }

def validate_arguments(function_name: str, args: dict) -> dict:
    """Validate and sanitize arguments"""
    # Prevent SQL injection, etc.
    for key, value in args.items():
        if isinstance(value, str):
            if any(dangerous in value.lower() for dangerous in
                   ["drop table", "delete from", "; --", "' or '1'='1"]):
                raise ValueError(f"Potentially dangerous input in {key}")

            # XSS countermeasure
            if "<script" in value.lower():
                raise ValueError(f"Script tags not allowed in {key}")

    return args
```

### 5.2 Retry and Fallback

```python
import time
from functools import wraps

class RetryConfig:
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    exponential_base: float = 2.0

def with_retry(config: RetryConfig = RetryConfig()):
    """Retry decorator"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(config.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < config.max_retries:
                        delay = min(
                            config.base_delay * (config.exponential_base ** attempt),
                            config.max_delay,
                        )
                        await asyncio.sleep(delay)
            raise last_error
        return wrapper
    return decorator


class ToolExecutor:
    """Tool executor with fallback support"""

    def __init__(self):
        self.fallbacks: dict[str, list[callable]] = {}

    def register_fallback(self, tool_name: str, fallback_fn: callable):
        """Register a fallback function for a tool"""
        if tool_name not in self.fallbacks:
            self.fallbacks[tool_name] = []
        self.fallbacks[tool_name].append(fallback_fn)

    async def execute(self, name: str, args: dict) -> dict:
        """Execute with fallback chain"""

        # Primary execution
        result = await safe_execute_function(name, args)
        if result["status"] == "success":
            return result

        # Fallback execution
        if name in self.fallbacks:
            for fallback_fn in self.fallbacks[name]:
                try:
                    fb_result = await fallback_fn(**args)
                    return {
                        "result": fb_result,
                        "status": "success",
                        "fallback_used": True,
                    }
                except Exception:
                    continue

        return result  # When all fallbacks fail


# Usage example
executor = ToolExecutor()

# Primary: OpenWeather API
# Fallback 1: WeatherAPI
# Fallback 2: Return from cache
executor.register_fallback("get_weather", get_weather_from_backup_api)
executor.register_fallback("get_weather", get_weather_from_cache)
```

### 5.3 Reporting Errors to the LLM Appropriately

```python
def format_error_for_llm(error_result: dict) -> str:
    """Format errors in a way the LLM can understand"""

    status = error_result.get("status", "error")
    error_msg = error_result.get("error", "Unknown error")

    if status == "timeout":
        return json.dumps({
            "error": True,
            "message": "この操作はタイムアウトしました。",
            "suggestion": "条件を絞り込むか、時間をおいて再試行してください。",
        }, ensure_ascii=False)

    elif status == "unauthorized":
        return json.dumps({
            "error": True,
            "message": "この操作を実行する権限がありません。",
            "suggestion": "ユーザーに権限が必要であることを伝えてください。",
        }, ensure_ascii=False)

    elif status == "rate_limited":
        return json.dumps({
            "error": True,
            "message": "API のレート制限に達しました。",
            "suggestion": "しばらく待ってから再試行するか、別の方法を提案してください。",
        }, ensure_ascii=False)

    else:
        return json.dumps({
            "error": True,
            "message": f"エラーが発生しました: {error_msg}",
            "suggestion": "ユーザーにエラーが発生したことを伝え、代替手段を提案してください。",
        }, ensure_ascii=False)
```

---

## 6. Security

### 6.1 Permission Management Framework

```python
from enum import Enum
from dataclasses import dataclass

class PermissionLevel(Enum):
    PUBLIC = "public"           # Anyone can use
    AUTHENTICATED = "authenticated"  # Logged-in users only
    ADMIN = "admin"             # Administrators only
    SYSTEM = "system"           # Internal system use only

@dataclass
class ToolPermission:
    tool_name: str
    required_level: PermissionLevel
    allowed_roles: list[str] | None = None
    rate_limit: int | None = None  # Maximum calls per minute
    requires_confirmation: bool = False  # User confirmation required

# Tool permission settings
TOOL_PERMISSIONS = {
    "search_products": ToolPermission("search_products", PermissionLevel.PUBLIC),
    "get_user_profile": ToolPermission("get_user_profile", PermissionLevel.AUTHENTICATED),
    "create_order": ToolPermission(
        "create_order",
        PermissionLevel.AUTHENTICATED,
        requires_confirmation=True,  # Confirm before placing order
    ),
    "delete_user": ToolPermission(
        "delete_user",
        PermissionLevel.ADMIN,
        allowed_roles=["super_admin"],
        requires_confirmation=True,
    ),
    "execute_sql": ToolPermission(
        "execute_sql",
        PermissionLevel.SYSTEM,  # Cannot be called via API
    ),
}

class PermissionChecker:
    def check(self, tool_name: str, user: dict) -> tuple[bool, str]:
        """Check permission to use a tool"""
        perm = TOOL_PERMISSIONS.get(tool_name)
        if not perm:
            return False, f"Unknown tool: {tool_name}"

        user_level = user.get("permission_level", "public")
        user_roles = user.get("roles", [])

        # Level check
        level_order = [e.value for e in PermissionLevel]
        if level_order.index(user_level) < level_order.index(perm.required_level.value):
            return False, f"Insufficient permission level: requires {perm.required_level.value}"

        # Role check
        if perm.allowed_roles:
            if not any(role in perm.allowed_roles for role in user_roles):
                return False, f"Required roles: {perm.allowed_roles}"

        # Rate limit check
        if perm.rate_limit:
            current_count = get_rate_limit_count(tool_name, user["id"])
            if current_count >= perm.rate_limit:
                return False, "Rate limit exceeded"

        return True, "OK"
```

### 6.2 Input Sanitization

```python
import re
from typing import Any

class InputSanitizer:
    """Sanitization of arguments generated by the LLM"""

    DANGEROUS_PATTERNS = [
        r";\s*--",               # SQL comment
        r"'\s*OR\s*'1'\s*=\s*'1", # SQL injection
        r"DROP\s+TABLE",          # SQL destructive command
        r"<script[^>]*>",        # XSS
        r"\{\{.*\}\}",           # Template injection
        r"\$\{.*\}",             # Template literal
        r"__import__",           # Python code injection
        r"eval\s*\(",            # eval execution
        r"exec\s*\(",            # exec execution
    ]

    @classmethod
    def sanitize(cls, args: dict, schema: dict) -> dict:
        """Sanitize arguments based on the schema"""

        sanitized = {}
        properties = schema.get("parameters", {}).get("properties", {})

        for key, value in args.items():
            if key not in properties:
                continue  # Remove parameters not defined in schema

            prop_def = properties[key]

            # Type check
            expected_type = prop_def.get("type")
            value = cls._coerce_type(value, expected_type)

            # Sanitize strings
            if isinstance(value, str):
                value = cls._sanitize_string(value, prop_def)

            # Clamp numbers to range
            if isinstance(value, (int, float)):
                value = cls._clamp_number(value, prop_def)

            sanitized[key] = value

        return sanitized

    @classmethod
    def _sanitize_string(cls, value: str, prop_def: dict) -> str:
        """Sanitize a string value"""
        # Check for dangerous patterns
        for pattern in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise ValueError(f"Dangerous input detected: matches pattern {pattern}")

        # Enum check
        if "enum" in prop_def and value not in prop_def["enum"]:
            raise ValueError(f"Value '{value}' not in allowed enum: {prop_def['enum']}")

        # Max length check
        max_length = prop_def.get("maxLength", 10000)
        if len(value) > max_length:
            value = value[:max_length]

        return value

    @classmethod
    def _clamp_number(cls, value: float, prop_def: dict) -> float:
        """Clamp a number to its defined range"""
        if "minimum" in prop_def:
            value = max(value, prop_def["minimum"])
        if "maximum" in prop_def:
            value = min(value, prop_def["maximum"])
        return value

    @classmethod
    def _coerce_type(cls, value: Any, expected_type: str) -> Any:
        """Convert value to the expected type"""
        try:
            if expected_type == "integer":
                return int(value)
            elif expected_type == "number":
                return float(value)
            elif expected_type == "boolean":
                return bool(value)
            elif expected_type == "string":
                return str(value)
        except (ValueError, TypeError):
            raise ValueError(f"Cannot convert {value} to {expected_type}")
        return value
```

### 6.3 Confirmation Flow

```python
class ConfirmationManager:
    """Confirmation flow for destructive operations"""

    DESTRUCTIVE_ACTIONS = {
        "delete_user": "ユーザー '{name}' を完全に削除します。この操作は取り消せません。",
        "cancel_order": "注文 #{order_id} をキャンセルします。返金処理が開始されます。",
        "create_order": "以下の注文を確定します:\n{items}\n合計: {total}円",
        "deploy_service": "サービス '{service}' を {environment} にデプロイします。",
    }

    def needs_confirmation(self, tool_name: str) -> bool:
        """Determine if confirmation is required"""
        return tool_name in self.DESTRUCTIVE_ACTIONS

    def generate_confirmation_message(self, tool_name: str, args: dict) -> str:
        """Generate a confirmation message"""
        template = self.DESTRUCTIVE_ACTIONS.get(tool_name, "この操作を実行しますか？")
        try:
            return template.format(**args)
        except KeyError:
            return template

    def create_pending_action(self, tool_name: str, args: dict) -> dict:
        """Create a pending action"""
        import uuid
        action_id = str(uuid.uuid4())
        return {
            "action_id": action_id,
            "tool_name": tool_name,
            "args": args,
            "confirmation_message": self.generate_confirmation_message(tool_name, args),
            "status": "pending_confirmation",
            "requires_user_approval": True,
        }
```

---

## 7. Comparison Tables

### 7.1 Function Calling Feature Comparison by Provider

| Feature | OpenAI | Anthropic | Google Gemini |
|------|--------|-----------|--------------|
| Parallel calls | Supported | Supported | Supported |
| Streaming | Supported | Supported | Supported |
| Forced call | tool_choice | tool_choice | function_calling_config |
| Max tools | 128 | No limit (rec. 20) | No limit |
| Nested JSON | Supported | Supported | Supported |
| Structured Output | Supported | JSON Mode | Supported |
| Auto execution | No | No | Yes (opt-in) |
| MCP support | Supported | Supported (native) | Supported |

### 7.2 Tool Design by Use Case

| Use Case | Number of Tools | Design Pattern | Notes |
|-------------|---------|------------|--------|
| Weather Bot | 1–2 | Single tool | Keep it simple |
| E-commerce Assistant | 5–10 | Tool chain | State management is critical |
| Internal Business Bot | 10–20 | Router pattern | Permission management required |
| Autonomous Agent | 20+ | ReAct pattern | Set iteration limits |
| Multimodal | 5–15 | Pipeline | Ensure input/output type consistency |

---

## 8. Integration with MCP (Model Context Protocol)

### 8.1 MCP Overview

```
┌─────────────────────────────────────────────────────────────────┐
│           MCP (Model Context Protocol) Architecture              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐     │
│  │  LLM     │      │  MCP     │      │  MCP Server      │     │
│  │  Client  │◀────▶│  Host    │◀────▶│  (Tool Provider) │     │
│  │  (Claude │      │  (App)   │      │  - DB Search     │     │
│  │   GPT等)  │      │          │      │  - API Calls     │     │
│  └──────────┘      └──────────┘      │  - File Ops      │     │
│                                       └──────────────────┘     │
│                                                                 │
│  Benefits:                                                      │
│  - Standardized tool definitions (common across providers)      │
│  - Improved tool reusability                                    │
│  - Centralized security management                              │
│  - Dynamic tool discovery and registration                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Implementing an MCP Server

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("weather-server")

@server.tool("get_weather")
async def get_weather(city: str, date: str = None) -> list[TextContent]:
    """Retrieves the weather forecast for the specified city"""

    # Actual API call
    weather_data = await fetch_weather_api(city, date)

    return [TextContent(
        type="text",
        text=json.dumps({
            "city": city,
            "temperature": weather_data["temp"],
            "condition": weather_data["condition"],
            "humidity": weather_data["humidity"],
        }, ensure_ascii=False),
    )]


@server.tool("get_forecast")
async def get_forecast(city: str, days: int = 7) -> list[TextContent]:
    """Retrieves the weekly weather forecast for the specified city"""

    forecast_data = await fetch_forecast_api(city, days)

    return [TextContent(
        type="text",
        text=json.dumps(forecast_data, ensure_ascii=False),
    )]


# Start the server
if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server

    asyncio.run(stdio_server(server))
```

---

## 9. Real-World Use Cases

### 9.1 Customer Support Bot

```python
# Tool definitions for customer support
support_tools = [
    {
        "type": "function",
        "function": {
            "name": "lookup_order",
            "description": (
                "注文番号で注文情報を検索します。"
                "注文状況、配送状況、商品詳細が確認できます。"
                "注文番号は 'ORD-' で始まる文字列です。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "pattern": "^ORD-\\d{8}$",
                        "description": "注文番号 (例: ORD-20250315)",
                    },
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_return_eligibility",
            "description": (
                "商品の返品可否を確認します。"
                "購入日から30日以内かつ未使用の場合のみ返品可能です。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "item_id": {"type": "string"},
                    "reason": {
                        "type": "string",
                        "enum": ["defective", "wrong_item", "not_as_described", "change_of_mind", "other"],
                        "description": "返品理由",
                    },
                },
                "required": ["order_id", "item_id", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_support_ticket",
            "description": (
                "サポートチケットを作成します。"
                "エスカレーションが必要な場合や、自動対応できない問題の場合に使用。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string", "description": "チケットの件名"},
                    "description": {"type": "string", "description": "問題の詳細"},
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "urgent"],
                    },
                    "category": {
                        "type": "string",
                        "enum": ["order", "payment", "shipping", "product", "account", "other"],
                    },
                },
                "required": ["subject", "description", "priority", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_faq",
            "description": (
                "よくある質問 (FAQ) データベースを検索します。"
                "一般的な質問にはまずこの関数で回答を検索してください。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "検索クエリ"},
                },
                "required": ["query"],
            },
        },
    },
]


class CustomerSupportAgent:
    """Customer support agent"""

    def __init__(self, client: OpenAI):
        self.client = client
        self.system_prompt = """You are a friendly and polite customer support assistant.

Rules:
1. First search the FAQ and use its answers for common questions
2. For order-related questions, always confirm the order number
3. For return requests, verify return eligibility before guiding the process
4. If automatic resolution is not possible, create a support ticket
5. Never request personal information such as credit card numbers
6. Always respond politely"""

    async def handle(self, user_message: str, conversation_history: list) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt},
            *conversation_history,
            {"role": "user", "content": user_message},
        ]

        return await agent_loop_async(messages, tools=support_tools, max_iterations=5)
```

### 9.2 Data Analysis Assistant

```python
analysis_tools = [
    {
        "type": "function",
        "function": {
            "name": "query_database",
            "description": (
                "SQLクエリを実行してデータを取得します。"
                "SELECT文のみ実行可能です (INSERT/UPDATE/DELETE は不可)。"
                "テーブル: users, orders, products, sessions"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "実行する SELECT SQL クエリ",
                    },
                    "limit": {
                        "type": "integer",
                        "maximum": 1000,
                        "description": "最大取得行数 (デフォルト: 100)",
                    },
                },
                "required": ["sql"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_chart",
            "description": "Generate a chart from data",
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_type": {
                        "type": "string",
                        "enum": ["bar", "line", "pie", "scatter", "heatmap"],
                    },
                    "title": {"type": "string"},
                    "data": {
                        "type": "object",
                        "description": "x: label array, y: value array",
                        "properties": {
                            "x": {"type": "array", "items": {"type": "string"}},
                            "y": {"type": "array", "items": {"type": "number"}},
                        },
                    },
                },
                "required": ["chart_type", "title", "data"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_statistics",
            "description": "Calculate statistics for a numeric array (mean, median, standard deviation, etc.)",
            "parameters": {
                "type": "object",
                "properties": {
                    "values": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Array of numbers",
                    },
                    "metrics": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["mean", "median", "std", "min", "max", "percentiles"],
                        },
                        "description": "Statistics to calculate",
                    },
                },
                "required": ["values"],
            },
        },
    },
]
```

### 9.3 DevOps Automation Agent

```python
devops_tools = [
    {
        "type": "function",
        "function": {
            "name": "get_service_status",
            "description": "Check the operational status of a service",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {
                        "type": "string",
                        "enum": ["api-gateway", "user-service", "order-service", "payment-service"],
                    },
                    "environment": {
                        "type": "string",
                        "enum": ["production", "staging", "development"],
                    },
                },
                "required": ["service_name", "environment"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_metrics",
            "description": "Retrieve service metrics (CPU, memory, response time, etc.)",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {"type": "string"},
                    "metric_type": {
                        "type": "string",
                        "enum": ["cpu", "memory", "latency", "error_rate", "throughput"],
                    },
                    "time_range": {
                        "type": "string",
                        "enum": ["1h", "6h", "24h", "7d", "30d"],
                        "description": "Aggregation period",
                    },
                },
                "required": ["service_name", "metric_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "scale_service",
            "description": "Scale the number of replicas for a service. Production environments require confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {"type": "string"},
                    "environment": {"type": "string"},
                    "replicas": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 50,
                    },
                },
                "required": ["service_name", "environment", "replicas"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_logs",
            "description": "Retrieve logs for a service",
            "parameters": {
                "type": "object",
                "properties": {
                    "service_name": {"type": "string"},
                    "environment": {"type": "string"},
                    "level": {
                        "type": "string",
                        "enum": ["error", "warn", "info", "debug"],
                    },
                    "time_range": {"type": "string"},
                    "search_query": {"type": "string", "description": "Keyword to search within logs"},
                },
                "required": ["service_name", "environment"],
            },
        },
    },
]
```

---

## 10. Testing Strategy

### 10.1 Testing Tool Schemas

```python
import pytest
import json
from jsonschema import validate, ValidationError

class TestToolSchemas:
    """Validation tests for tool schemas"""

    def test_schema_is_valid_json_schema(self):
        """Each tool's schema should be a valid JSON Schema"""
        for tool in tools:
            schema = tool["function"]["parameters"]
            # Conforms to JSON Schema Draft 7?
            assert schema["type"] == "object"
            assert "properties" in schema

    def test_required_fields_exist_in_properties(self):
        """Fields listed in required should exist in properties"""
        for tool in tools:
            schema = tool["function"]["parameters"]
            required = schema.get("required", [])
            properties = schema.get("properties", {})
            for field in required:
                assert field in properties, f"Required field '{field}' not in properties"

    def test_enum_values_are_valid(self):
        """Enum values should not be empty"""
        for tool in tools:
            for prop_name, prop_def in tool["function"]["parameters"].get("properties", {}).items():
                if "enum" in prop_def:
                    assert len(prop_def["enum"]) > 0, f"Empty enum in {prop_name}"

    def test_all_tools_have_description(self):
        """All tools should have a description"""
        for tool in tools:
            assert tool["function"].get("description"), f"Missing description for {tool['function']['name']}"

    def test_all_parameters_have_description(self):
        """All parameters should have a description"""
        for tool in tools:
            for prop_name, prop_def in tool["function"]["parameters"].get("properties", {}).items():
                assert prop_def.get("description"), f"Missing description for {prop_name}"


class TestToolExecution:
    """Tests for tool execution"""

    @pytest.mark.asyncio
    async def test_valid_arguments_succeed(self):
        """Should complete successfully with valid arguments"""
        result = await safe_execute_function(
            "get_weather",
            {"city": "Tokyo", "date": "2025-03-15"},
        )
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_invalid_arguments_return_error(self):
        """Should return an error with invalid arguments"""
        result = await safe_execute_function(
            "get_weather",
            {"city": "'; DROP TABLE users; --"},
        )
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_unknown_function_returns_error(self):
        """Should return an error for a non-existent function"""
        result = await safe_execute_function(
            "nonexistent_function",
            {},
        )
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Timeout should be handled correctly"""
        result = await safe_execute_function(
            "slow_function",
            {"delay": 30},  # 30-second sleep
        )
        assert result["status"] == "timeout"
```

### 10.2 Integration Testing with the LLM

```python
class TestLLMFunctionCalling:
    """Tests for the LLM's function calling decisions"""

    @pytest.mark.asyncio
    async def test_correct_function_selection(self):
        """The appropriate function should be selected"""
        test_cases = [
            {
                "input": "東京の天気を教えて",
                "expected_function": "get_weather",
                "expected_args": {"city": "Tokyo"},
            },
            {
                "input": "注文 ORD-20250315 の状況を確認したい",
                "expected_function": "lookup_order",
                "expected_args": {"order_id": "ORD-20250315"},
            },
        ]

        for case in test_cases:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": case["input"]}],
                tools=tools,
            )

            if response.choices[0].message.tool_calls:
                actual_fn = response.choices[0].message.tool_calls[0].function.name
                assert actual_fn == case["expected_function"], \
                    f"Expected {case['expected_function']}, got {actual_fn}"

    @pytest.mark.asyncio
    async def test_no_function_call_when_unnecessary(self):
        """Should respond directly when no function call is needed"""
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "こんにちは、元気ですか？"}],
            tools=tools,
        )

        assert not response.choices[0].message.tool_calls, \
            "Should not call any function for a greeting"
```

---

## 11. Monitoring and Cost Optimization

### 11.1 Function Calling Metrics

```python
import time
from dataclasses import dataclass, field

@dataclass
class FunctionCallMetrics:
    """Metrics for Function Calling"""
    function_name: str
    arguments: dict
    execution_time_ms: float = 0
    status: str = ""
    error: str | None = None
    llm_model: str = ""
    token_usage: dict = field(default_factory=dict)
    retry_count: int = 0

class FunctionCallMonitor:
    """Monitoring for Function Calling"""

    def __init__(self, metrics_backend):
        self.backend = metrics_backend

    def track(self, metrics: FunctionCallMetrics):
        """Record metrics"""
        self.backend.histogram(
            "function_call.execution_time",
            metrics.execution_time_ms,
            tags={"function": metrics.function_name},
        )

        self.backend.counter(
            "function_call.total",
            1,
            tags={
                "function": metrics.function_name,
                "status": metrics.status,
            },
        )

        if metrics.error:
            self.backend.counter(
                "function_call.errors",
                1,
                tags={
                    "function": metrics.function_name,
                    "error_type": type(metrics.error).__name__,
                },
            )

        # Token usage
        if metrics.token_usage:
            self.backend.histogram(
                "function_call.tokens",
                metrics.token_usage.get("total_tokens", 0),
                tags={"model": metrics.llm_model},
            )
```

### 11.2 Cost Optimization

```python
class CostOptimizer:
    """Cost optimization for Function Calling"""

    def __init__(self):
        self.tool_usage_stats: dict[str, int] = {}

    def optimize_tool_set(self, tools: list, user_context: dict) -> list:
        """Optimize the tool set based on user context"""

        # 1. Exclude infrequently used tools
        min_usage = 10  # Exclude tools used fewer than 10 times in the past 30 days
        frequently_used = [
            t for t in tools
            if self.tool_usage_stats.get(t["function"]["name"], 0) >= min_usage
        ]

        # 2. Filter based on user permissions
        authorized = [
            t for t in frequently_used
            if check_permission(t["function"]["name"], user_context)
        ]

        # 3. Limit the number of tools (reduce token cost)
        max_tools = 15
        if len(authorized) > max_tools:
            # Sort by frequency and take the top ones
            authorized.sort(
                key=lambda t: self.tool_usage_stats.get(t["function"]["name"], 0),
                reverse=True,
            )
            authorized = authorized[:max_tools]

        return authorized

    def estimate_cost(self, tools: list, model: str = "gpt-4o") -> dict:
        """Estimate the token cost of tool definitions"""
        tools_json = json.dumps(tools, ensure_ascii=False)
        estimated_tokens = len(tools_json) // 4  # Rough estimate

        cost_per_1k_tokens = {
            "gpt-4o": 0.005,
            "gpt-4o-mini": 0.00015,
            "claude-3-5-sonnet": 0.003,
        }

        rate = cost_per_1k_tokens.get(model, 0.005)

        return {
            "estimated_tokens": estimated_tokens,
            "cost_per_request": estimated_tokens / 1000 * rate,
            "cost_per_1000_requests": estimated_tokens * rate,
        }
```

---

## 12. Anti-Patterns

### Anti-Pattern 1: Unbounded Tool Execution Loop

```python
# Bad: No limit on the number of tool calls
while True:
    response = call_llm(messages, tools)
    if not response.tool_calls:
        break
    # → The LLM may keep calling tools indefinitely

# Good: Explicit iteration limit
MAX_ITERATIONS = 10
for i in range(MAX_ITERATIONS):
    response = call_llm(messages, tools)
    if not response.tool_calls:
        break
    # Execute tools...
else:
    return "The task is too complex; the iteration limit has been reached. Please break your question into smaller parts."
```

### Anti-Pattern 2: Insufficient Function Description

```python
# Bad: Insufficient description
bad_tool = {
    "name": "query_db",
    "description": "DBを検索",  # Which DB? What does it search?
    "parameters": {
        "type": "object",
        "properties": {
            "q": {"type": "string"},  # What goes here?
        },
    },
}

# Good: Specific and clear description
good_tool = {
    "name": "search_employee_database",
    "description": (
        "Searches the internal employee database. "
        "You can search by name, department, or skill. "
        "Results include full name, department, title, and email address. "
        "This contains personal information; use only for legitimate business purposes."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "従業員の氏名 (部分一致検索)。例: '田中'",
            },
            "department": {
                "type": "string",
                "enum": ["engineering", "sales", "hr", "finance"],
                "description": "部署コード",
            },
        },
        "required": [],
    },
}
```

### Anti-Pattern 3: Bloated Tool Results

```python
# Bad: Returning a massive result as-is
result = database.query("SELECT * FROM products")  # 10,000 rows
return json.dumps(result)  # Several MB of JSON → wastes context

# Good: Return only necessary information
result = database.query("SELECT id, name, price FROM products LIMIT 20")
return json.dumps({
    "items": result,
    "total_count": total_count,
    "showing": "1-20",
    "has_more": total_count > 20,
}, ensure_ascii=False)
```

### Anti-Pattern 4: Missing Permission Checks

```python
# Bad: Executing LLM instructions as-is
def execute_sql(query: str):
    return db.execute(query)  # DELETE and DROP can also be executed

# Good: Permission checks and query restrictions
def execute_sql(query: str):
    # Allow SELECT only
    if not query.strip().upper().startswith("SELECT"):
        return {"error": "Only SELECT queries are allowed"}

    # Table whitelist
    allowed_tables = {"products", "orders", "categories"}
    # ... Check table names

    # Enforce LIMIT
    if "LIMIT" not in query.upper():
        query += " LIMIT 100"

    return db.execute(query)
```

---

## 13. FAQ

### Q1: What is the difference between Function Calling and Structured Output?

Function Calling is a mechanism that lets the LLM express its intent to invoke an external tool. The actual execution happens on the application side.
Structured Output is a mechanism that forces the LLM's output to strictly conform to a JSON Schema. It controls the output format rather than invoking a tool.
The two can be combined — for example, "format the tool call result as structured JSON and return it."

### Q2: What should I do if the LLM selects the wrong function or arguments?

The most effective approach is to improve the `description` in the schema.
Add enum values to make options explicit, include examples, and add negative instructions (e.g., "Do not use this function for XX").
If the problem persists, handle it on the application side with validation and retry requests to the LLM.

### Q3: What is the cost impact of Function Calling?

Tool definitions are counted as tokens, as part of the system prompt.
It is common to add approximately 500–1,000 tokens for 10 tool definitions.
When the number of tools is large, you can reduce costs by dynamically filtering the tool set passed to the model based on the user's intent.

### Q4: How do I control parallel tool calls?

OpenAI: Control with `parallel_tool_calls=True/False`. Anthropic: Supports parallel calls by default; the LLM automatically determines dependencies between tools. When ordering is required, explicitly state it in the tool's `description`, e.g., "Execute this function after receiving results from search_flights."

### Q5: Can streaming and Function Calling be used together?

All major providers support this. With OpenAI, `tool_calls` chunks are sent incrementally during streaming, so you need to accumulate `function.arguments` before JSON-parsing. With Anthropic, `partial_json` is received via `content_block_delta` events and parsed upon completion.

### Q6: How do I choose between MCP and traditional Function Calling?

MCP is a protocol that standardizes the tool-provider side. It is beneficial when you want to use the same tools across multiple LLM providers, or when you want to isolate tools as microservices. For small-scale projects or single-provider usage, traditional Function Calling is sufficient.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the core concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in professional settings?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architectural design.

---

## Summary

| Item | Details |
|------|------|
| Essence | The LLM produces structured output specifying "which function with what arguments" |
| Execution Responsibility | The application side (the LLM does not execute) |
| Schema | Defined with JSON Schema; descriptions directly affect accuracy |
| Error Countermeasures | Timeouts, iteration limits, input validation, permission checks |
| Parallel Calls | Supported by all major providers |
| Security | Input sanitization, permission management, confirmation flows |
| Testing | Schema validation, integration tests, LLM decision tests |
| Advanced Forms | AI Agents (ReAct, Plan-and-Execute), MCP |

---

## Further Reading

- [03-embeddings.md](./03-embeddings.md) — Using Function Calling results as vectors
- [01-rag.md](./01-rag.md) — Integrating Function Calling in RAG pipelines
- [../03-infrastructure/00-api-integration.md](../03-infrastructure/00-api-integration.md) — Practical API integration

---

## References

1. OpenAI, "Function Calling Guide," https://platform.openai.com/docs/guides/function-calling
2. Anthropic, "Tool Use Documentation," https://docs.anthropic.com/claude/docs/tool-use
3. Google, "Gemini Function Calling," https://ai.google.dev/docs/function_calling
4. Schick et al., "Toolformer: Language Models Can Teach Themselves to Use Tools," NeurIPS 2023
5. Anthropic, "Model Context Protocol," https://modelcontextprotocol.io/
6. Qin et al., "ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs," ICLR 2024
