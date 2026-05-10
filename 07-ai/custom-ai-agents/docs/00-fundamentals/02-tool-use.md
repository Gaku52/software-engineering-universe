# Tool Use

> Function Calling, MCP, tool definitions — understand the mechanisms that give LLMs "hands and feet," and implement safe, effective tool integrations.

## What You Will Learn

1. How Function Calling works and the principles by which an LLM selects tools
2. Building and connecting tool servers with MCP (Model Context Protocol)
3. Best practices for tool definitions and how to ensure safety
4. Advanced tool integration patterns and practical troubleshooting
5. Tool operations and monitoring in production environments


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Agent Frameworks](./01-agent-frameworks.md)

---

## 1. Overview of Tool Use

### 1.1 Why Are Tools Necessary?

An LLM on its own cannot:
- **Retrieve up-to-date information** (training data cutoff)
- **Perform accurate calculations** (uncertainty in floating-point arithmetic)
- **Integrate with external systems** (DB operations, API calls)
- **Perform file operations** (read, write, create, delete)

Tool use breaks through these constraints and extends the LLM from **"knowing"** to **"doing"**.

```
Tool Use Flow
+--------+   Question    +---------+  Tool Call    +--------+
|  User  |-------------> |   LLM   |--------------->|  Tool  |
|        |               |         |<---------------|        |
|        |    Answer     |         |  Execution     |        |
|        |<--------------|         |  Result        |        |
+--------+               +---------+                +--------+
                              |
                         Whether to use
                         a tool is decided
                         by the LLM
```

### 1.2 Historical Background of Tool Use

```
Evolution of Tool Use
Before 2022: LLM = text generation only
     ↓
Early 2023: ChatGPT Plugins / Function Calling introduced
     ↓
Mid 2023: Anthropic Tool Use / Google Function Calling
     ↓
2024: Emergence of MCP (Model Context Protocol)
     ↓
2025: Progress in standardization, maturation of tool ecosystem
     ↓
2026: Advancement of agentic tool use
         - Optimization of parallel tool execution
         - Autonomous tool discovery and registration
         - Standardization of security frameworks
```

### 1.3 Tool Category Classification

```
Tool Classification System

+-------------------+-------------------+-------------------+
|   Information     |   Action          |   Generation      |
|   Retrieval       |   Execution       |                   |
+-------------------+-------------------+-------------------+
| - Web search      | - File operations | - Image generation|
| - DB search       | - API calls       | - Code generation |
| - Document search | - Email sending   | - Doc generation  |
| - Data fetching   | - Deployment      | - Chart generation|
+-------------------+-------------------+-------------------+
| Risk: Low         | Risk: Med-High    | Risk: Low-Med     |
| Side effects: None| Side effects: Yes | Side effects:     |
|                   |                   | Resource usage    |
+-------------------+-------------------+-------------------+
```

---

## 2. Function Calling

### 2.1 How It Works

```
Function Calling Lifecycle
+------------------------------------------------------------------+
| 1. Pass tool definitions to the LLM                              |
|    tools: [{name, description, parameters}]                       |
|                                                                    |
| 2. Send user message                                              |
|    "Tell me the weather in Tokyo"                                 |
|                                                                    |
| 3. LLM generates a tool call (returned as JSON)                  |
|    {tool: "get_weather", input: {city: "Tokyo"}}                  |
|                                                                    |
| 4. Application executes the tool                                  |
|    result = get_weather("Tokyo")                                   |
|                                                                    |
| 5. Return result to LLM                                           |
|    tool_result: "Tokyo: Sunny, 22°C"                              |
|                                                                    |
| 6. LLM generates final answer                                     |
|    "Tokyo is currently sunny with a temperature of 22°C"          |
+------------------------------------------------------------------+
```

### 2.2 Function Calling with the Anthropic API

```python
import anthropic
import json

client = anthropic.Anthropic()

# Tool definitions
tools = [
    {
        "name": "get_weather",
        "description": "指定された都市の現在の天気情報を取得する",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "天気を取得する都市名（例: 東京、大阪）"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "温度の単位（デフォルト: celsius）"
                }
            },
            "required": ["city"]
        }
    },
    {
        "name": "search_restaurant",
        "description": "指定された条件でレストランを検索する",
        "input_schema": {
            "type": "object",
            "properties": {
                "area": {"type": "string", "description": "エリア名"},
                "cuisine": {"type": "string", "description": "料理ジャンル"},
                "budget": {"type": "integer", "description": "予算上限（円）"}
            },
            "required": ["area"]
        }
    }
]

# Tool execution function
def execute_tool(name: str, input_data: dict) -> str:
    if name == "get_weather":
        # In practice, call a Weather API
        return json.dumps({
            "city": input_data["city"],
            "weather": "晴れ",
            "temperature": 22,
            "humidity": 45
        })
    elif name == "search_restaurant":
        return json.dumps({
            "results": [
                {"name": "寿司太郎", "rating": 4.5, "budget": 5000},
                {"name": "天ぷら花", "rating": 4.2, "budget": 3000}
            ]
        })
    return "ツールが見つかりません"

# Agent loop
def agent_chat(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=tools,
            messages=messages
        )

        # Final answer case
        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text

        # Tool call case
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  ツール実行: {block.name}({block.input})")
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

# Usage example
answer = agent_chat("渋谷で予算5000円以内のおすすめレストランと、今の天気を教えて")
print(answer)
```

### 2.3 Function Calling with the OpenAI API

```python
from openai import OpenAI

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "都市の天気を取得する",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"}
                },
                "required": ["city"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "東京の天気は？"}],
    tools=tools,
    tool_choice="auto"  # LLM decides automatically
)

# tool_choice options
# "auto"     : LLM decides (default)
# "required" : always use a tool
# "none"     : do not use tools
# {"type": "function", "function": {"name": "get_weather"}} : force a specific tool
```

### 2.4 Function Calling with the Google Gemini API

```python
import google.generativeai as genai

# Tool definition (Gemini format)
weather_tool = genai.protos.Tool(
    function_declarations=[
        genai.protos.FunctionDeclaration(
            name="get_weather",
            description="指定された都市の天気情報を取得する",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "city": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="都市名"
                    )
                },
                required=["city"]
            )
        )
    ]
)

model = genai.GenerativeModel(
    "gemini-2.0-flash",
    tools=[weather_tool]
)

chat = model.start_chat()
response = chat.send_message("東京の天気を教えて")

# Handle Function Calls
for part in response.parts:
    if fn := part.function_call:
        print(f"関数呼び出し: {fn.name}({dict(fn.args)})")
        # Return result
        result = get_weather(dict(fn.args))
        response = chat.send_message(
            genai.protos.Content(
                parts=[genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=fn.name,
                        response={"result": result}
                    )
                )]
            )
        )
```

### 2.5 Parallel Tool Calls

```python
# Handling parallel calls to multiple tools
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ParallelToolExecutor:
    """Executes multiple tool calls in parallel"""

    def __init__(self, tool_handlers: dict, max_workers: int = 5):
        self.handlers = tool_handlers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def execute_parallel(self, tool_calls: list) -> list:
        """Execute multiple tool calls in parallel"""
        loop = asyncio.get_event_loop()
        tasks = []

        for call in tool_calls:
            handler = self.handlers.get(call["name"])
            if handler:
                task = loop.run_in_executor(
                    self.executor,
                    lambda h=handler, a=call["input"]: h(**a)
                )
                tasks.append((call["id"], task))

        results = []
        for call_id, task in tasks:
            try:
                result = await task
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call_id,
                    "content": str(result)
                })
            except Exception as e:
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call_id,
                    "content": f"エラー: {e}",
                    "is_error": True
                })

        return results

# Usage example
executor = ParallelToolExecutor({
    "get_weather": get_weather,
    "search_restaurant": search_restaurant,
    "get_exchange_rate": get_exchange_rate
})

# When the LLM calls multiple tools simultaneously
parallel_calls = [
    {"id": "call_1", "name": "get_weather", "input": {"city": "東京"}},
    {"id": "call_2", "name": "search_restaurant", "input": {"area": "渋谷"}},
    {"id": "call_3", "name": "get_exchange_rate", "input": {"from": "USD", "to": "JPY"}}
]

results = asyncio.run(executor.execute_parallel(parallel_calls))
```

### 2.6 Tool Use with Streaming

```python
# Handling tool calls in streaming responses
import anthropic

client = anthropic.Anthropic()

def stream_with_tools(user_message: str, tools: list):
    """Process tool calls with streaming"""
    messages = [{"role": "user", "content": user_message}]

    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        tools=tools,
        messages=messages
    ) as stream:
        current_tool = None
        tool_input_json = ""

        for event in stream:
            if event.type == "content_block_start":
                if hasattr(event.content_block, "type"):
                    if event.content_block.type == "tool_use":
                        current_tool = {
                            "id": event.content_block.id,
                            "name": event.content_block.name
                        }
                        tool_input_json = ""
                    elif event.content_block.type == "text":
                        current_tool = None

            elif event.type == "content_block_delta":
                if hasattr(event.delta, "text"):
                    # Output text response in real time
                    print(event.delta.text, end="", flush=True)
                elif hasattr(event.delta, "partial_json"):
                    # Accumulate JSON fragments for tool input
                    tool_input_json += event.delta.partial_json

            elif event.type == "content_block_stop":
                if current_tool:
                    # Tool call complete
                    tool_input = json.loads(tool_input_json)
                    print(f"\n[Tool execution: {current_tool['name']}]")
                    result = execute_tool(current_tool["name"], tool_input)
                    # Return result to LLM and continue...
```

---

## 3. MCP (Model Context Protocol)

### 3.1 What Is MCP?

```
MCP Architecture
+------------------+     stdio/SSE     +------------------+
|   MCP Client     |<=================>|   MCP Server     |
|  (Claude Code,   |                   |  (Tool Server)   |
|   Cursor, etc.)  |   JSON-RPC 2.0   |                   |
+------------------+                   +------------------+
                                       |  +-----------+   |
                                       |  | Tools     |   |
                                       |  +-----------+   |
                                       |  | Resources |   |
                                       |  +-----------+   |
                                       |  | Prompts   |   |
                                       |  +-----------+   |
                                       +------------------+
```

MCP is a **standard protocol between AI applications and tools**. Proposed by Anthropic, it provides three capabilities:

| Feature | Description | Examples |
|---------|-------------|---------|
| Tools | Functions called by the LLM | File operations, DB search |
| Resources | Data provided as context | File contents, API responses |
| Prompts | Reusable prompt templates | Code review prompts |

### 3.2 Implementing an MCP Server

```python
# MCP server implementation example (Python SDK)
from mcp.server import Server
from mcp.types import Tool, TextContent
import json

app = Server("my-tools")

# Define the list of tools
@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="read_database",
            description="SQLiteデータベースを検索して結果を返す",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "SQL SELECT文"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="send_email",
            description="指定されたアドレスにメールを送信する",
            inputSchema={
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"}
                },
                "required": ["to", "subject", "body"]
            }
        )
    ]

# Tool execution
@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "read_database":
        results = execute_sql(arguments["query"])
        return [TextContent(type="text", text=json.dumps(results))]

    elif name == "send_email":
        send_email(
            to=arguments["to"],
            subject=arguments["subject"],
            body=arguments["body"]
        )
        return [TextContent(type="text", text="メール送信完了")]

# Start the server
if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server

    async def main():
        async with stdio_server() as (read, write):
            await app.run(read, write)

    asyncio.run(main())
```

### 3.3 MCP Configuration (Claude Code)

```json
// .claude/settings.json
{
  "mcpServers": {
    "my-tools": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"],
      "env": {
        "DATABASE_PATH": "/path/to/db.sqlite"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem", "/allowed/path"]
    }
  }
}
```

### 3.4 Implementing MCP Resources

```python
# MCP resources: providing context data
from mcp.server import Server
from mcp.types import Resource, TextContent
import json

app = Server("resource-server")

@app.list_resources()
async def list_resources():
    return [
        Resource(
            uri="project://config",
            name="Project Configuration",
            description="Configuration information for the current project",
            mimeType="application/json"
        ),
        Resource(
            uri="project://readme",
            name="README",
            description="Project README file",
            mimeType="text/markdown"
        ),
        Resource(
            uri="metrics://daily",
            name="Daily Metrics",
            description="Today's application metrics",
            mimeType="application/json"
        )
    ]

@app.read_resource()
async def read_resource(uri: str):
    if uri == "project://config":
        config = load_project_config()
        return TextContent(
            type="text",
            text=json.dumps(config, indent=2, ensure_ascii=False)
        )
    elif uri == "project://readme":
        with open("README.md", "r") as f:
            return TextContent(type="text", text=f.read())
    elif uri == "metrics://daily":
        metrics = fetch_daily_metrics()
        return TextContent(
            type="text",
            text=json.dumps(metrics, indent=2)
        )
    raise ValueError(f"Unknown resource: {uri}")
```

### 3.5 Implementing MCP Prompts

```python
# MCP prompts: reusable prompt templates
from mcp.types import Prompt, PromptArgument, PromptMessage, TextContent

@app.list_prompts()
async def list_prompts():
    return [
        Prompt(
            name="code_review",
            description="Prompt for code review",
            arguments=[
                PromptArgument(
                    name="code",
                    description="Code to be reviewed",
                    required=True
                ),
                PromptArgument(
                    name="language",
                    description="Programming language",
                    required=False
                )
            ]
        ),
        Prompt(
            name="bug_report",
            description="Prompt for creating a bug report",
            arguments=[
                PromptArgument(
                    name="error_message",
                    description="Error message",
                    required=True
                ),
                PromptArgument(
                    name="context",
                    description="Context in which the error occurred",
                    required=False
                )
            ]
        )
    ]

@app.get_prompt()
async def get_prompt(name: str, arguments: dict):
    if name == "code_review":
        language = arguments.get("language", "不明")
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=f"""以下の{language}コードをレビューしてください。

確認項目:
1. バグや論理エラー
2. セキュリティ上の問題
3. パフォーマンスの改善点
4. コードの可読性
5. ベストプラクティスへの準拠

コード:
```
{arguments['code']}
```"""
                )
            )
        ]
```

### 3.6 MCP Server with SSE Transport

```python
# MCP server using HTTP SSE transport
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route, Mount
import uvicorn

app = Server("sse-tools")

# Tool definitions (omitted)

# SSE transport configuration
sse = SseServerTransport("/messages/")

async def handle_sse(request):
    """Handle SSE connections"""
    async with sse.connect_sse(
        request.scope,
        request.receive,
        request._send
    ) as streams:
        await app.run(
            streams[0],
            streams[1],
            app.create_initialization_options()
        )

# Starlette application
starlette_app = Starlette(
    routes=[
        Route("/sse", endpoint=handle_sse),
        Mount("/messages/", app=sse.handle_post_message),
    ]
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=8000)
```

### 3.7 Implementing an MCP Client

```python
# MCP client: connect to a server and use tools
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def use_mcp_tools():
    server_params = StdioServerParameters(
        command="python",
        args=["mcp_server.py"],
        env={"DATABASE_PATH": "/path/to/db.sqlite"}
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize
            await session.initialize()

            # Get list of available tools
            tools = await session.list_tools()
            print("Available tools:")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")

            # Execute a tool
            result = await session.call_tool(
                "read_database",
                arguments={"query": "SELECT * FROM users LIMIT 5"}
            )
            print(f"Result: {result.content[0].text}")

            # Retrieve resources
            resources = await session.list_resources()
            for resource in resources.resources:
                content = await session.read_resource(resource.uri)
                print(f"Resource [{resource.name}]: {content}")
```

---

## 4. Best Practices for Tool Definitions

### 4.1 Good vs. Bad Tool Definitions

```
Tool Definition Quality Pyramid

        /\
       /  \    Name: verb_noun format
      / Name\   e.g.: search_web, read_file
     /--------\
    /          \   Description: what it does + when to use it
   /Description\   + input/output format
  /------------\
 /              \   Parameters: type + constraints + defaults
/  Parameters   \   + concrete examples
/----------------\
```

### 4.2 Tool Design Patterns

```python
# Pattern 1: Search/retrieval tool (read-only)
search_tool = {
    "name": "search_documents",
    "description": (
        "Full-text search of internal documents. "
        "Accepts keyword or natural language queries. "
        "Returns up to 20 results sorted by relevance. "
        "Each result includes title, snippet, and URL."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query (e.g. 'remote work policy')"
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of results (1-50, default: 10)",
                "default": 10,
                "minimum": 1,
                "maximum": 50
            },
            "department": {
                "type": "string",
                "enum": ["engineering", "sales", "hr", "all"],
                "description": "Department to search (default: all)",
                "default": "all"
            }
        },
        "required": ["query"]
    }
}

# Pattern 2: Write tool (has side effects)
write_tool = {
    "name": "create_ticket",
    "description": (
        "Creates a ticket in JIRA. Has side effects: a ticket is actually created. "
        "Returns the created ticket ID and URL."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Ticket title (max 100 characters)"},
            "description": {"type": "string", "description": "Detailed description (Markdown supported)"},
            "priority": {
                "type": "string",
                "enum": ["critical", "high", "medium", "low"],
                "description": "Priority"
            },
            "assignee": {"type": "string", "description": "Assignee email address"}
        },
        "required": ["title", "description", "priority"]
    }
}
```

### 4.3 Advanced Tool Definition Techniques

```python
# Technique 1: Conditional parameters
conditional_tool = {
    "name": "send_notification",
    "description": (
        "Send a notification. If channel is email, email_address is required. "
        "If channel is slack, slack_channel is required."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "channel": {
                "type": "string",
                "enum": ["email", "slack", "sms"],
                "description": "Notification channel"
            },
            "message": {"type": "string", "description": "Notification message"},
            "email_address": {
                "type": "string",
                "description": "Email address (required when channel=email)"
            },
            "slack_channel": {
                "type": "string",
                "description": "Slack channel name (required when channel=slack)"
            },
            "phone_number": {
                "type": "string",
                "description": "Phone number (required when channel=sms)"
            }
        },
        "required": ["channel", "message"]
    }
}

# Technique 2: Nested objects
nested_tool = {
    "name": "create_order",
    "description": "Create an order",
    "input_schema": {
        "type": "object",
        "properties": {
            "customer": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"}
                },
                "required": ["name", "email"]
            },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "quantity": {"type": "integer", "minimum": 1}
                    },
                    "required": ["product_id", "quantity"]
                },
                "minItems": 1,
                "description": "List of ordered items (at least 1 required)"
            },
            "shipping_address": {
                "type": "object",
                "properties": {
                    "zip": {"type": "string"},
                    "prefecture": {"type": "string"},
                    "city": {"type": "string"},
                    "address": {"type": "string"}
                },
                "required": ["zip", "prefecture", "city", "address"]
            }
        },
        "required": ["customer", "items", "shipping_address"]
    }
}

# Technique 3: Include usage examples in the tool description
example_tool = {
    "name": "query_analytics",
    "description": (
        "Query analytics data in natural language.\n\n"
        "Examples:\n"
        "- 'yesterday page views' → returns yesterday's page view count\n"
        "- 'top 10 pages this week' → returns the top 10 pages this week\n"
        "- 'conversion rate last 30 days' → returns the conversion rate for the last 30 days\n\n"
        "Note: Maximum retrieval period is 90 days. Beyond that, use batch export."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Natural language query"},
            "format": {
                "type": "string",
                "enum": ["table", "chart", "raw"],
                "default": "table",
                "description": "Output format"
            }
        },
        "required": ["query"]
    }
}
```

### 4.4 Optimizing Tool Result Formatting

```python
# Structured patterns for tool results

class ToolResultFormatter:
    """Formats tool results into a form that is easy for the LLM to understand"""

    @staticmethod
    def format_search_results(results: list, query: str) -> str:
        """Format search results"""
        if not results:
            return f"No results found for '{query}'."

        formatted = f"Search results for '{query}' ({len(results)} items):\n\n"
        for i, r in enumerate(results, 1):
            formatted += f"{i}. **{r['title']}**\n"
            formatted += f"   URL: {r['url']}\n"
            formatted += f"   Excerpt: {r['snippet'][:200]}...\n"
            formatted += f"   Relevance: {r['score']:.2f}\n\n"
        return formatted

    @staticmethod
    def format_error(error: Exception, context: dict = None) -> str:
        """Format errors (so the LLM can retry)"""
        result = {
            "status": "error",
            "error_type": type(error).__name__,
            "message": str(error),
            "suggestions": []
        }

        if isinstance(error, TimeoutError):
            result["suggestions"] = [
                "A timeout occurred",
                "Try simplifying the query or reducing the number of results and retry"
            ]
        elif isinstance(error, PermissionError):
            result["suggestions"] = [
                "Insufficient access permissions",
                "Use a different resource or contact your administrator"
            ]
        elif isinstance(error, ValueError):
            result["suggestions"] = [
                "Invalid input value",
                f"Details: {error}",
                "Check the parameters and retry"
            ]

        if context:
            result["context"] = context

        return json.dumps(result, ensure_ascii=False, indent=2)

    @staticmethod
    def format_large_result(data: dict, max_items: int = 10) -> str:
        """Summarize large result sets"""
        total = len(data.get("items", []))
        truncated = data["items"][:max_items] if total > max_items else data["items"]

        return json.dumps({
            "total_count": total,
            "showing": len(truncated),
            "items": truncated,
            "note": f"Showing {len(truncated)} of {total} items. Retrieve the rest using the 'offset' parameter."
        }, ensure_ascii=False, indent=2)
```

---

## 5. Tool Use Comparison

### 5.1 Function Calling vs. MCP

| Perspective | Function Calling | MCP |
|-------------|-----------------|-----|
| Standardization | Vendor-specific spec | Open standard |
| Communication | Embedded in HTTP API | stdio / SSE |
| Server management | Runs inside the app | Independent process |
| Tool sharing | App-specific | Shareable across multiple clients |
| Ecosystem | Per-vendor SDK | Common MCP servers |
| Use case | Single app | Shared across multiple AI products |
| Security | App level | Process isolation |

### 5.2 Function Calling Comparison by Provider

| Item | Anthropic (Claude) | OpenAI (GPT) | Google (Gemini) |
|------|-------------------|--------------|-----------------|
| Call format | tool_use block | function_call | functionCall |
| Parallel calls | Supported | Supported | Supported |
| Streaming | Supported | Supported | Supported |
| tool_choice | auto/any/specify tool | auto/required/none/specify | auto/any/none |
| Return result | tool_result | tool message | functionResponse |

### 5.3 MCP Server Ecosystem

```
Available MCP Servers (2025-2026)

Official servers:
├── @anthropic/mcp-filesystem    - File operations
├── @anthropic/mcp-git           - Git operations
├── @anthropic/mcp-github        - GitHub API
├── @anthropic/mcp-postgres      - PostgreSQL
├── @anthropic/mcp-sqlite        - SQLite
├── @anthropic/mcp-puppeteer     - Web browsing
└── @anthropic/mcp-memory        - Knowledge graph memory

Community servers:
├── mcp-server-slack             - Slack integration
├── mcp-server-notion            - Notion integration
├── mcp-server-jira              - JIRA integration
├── mcp-server-kubernetes        - K8s management
├── mcp-server-aws               - AWS operations
├── mcp-server-gcp               - GCP operations
├── mcp-server-docker            - Docker management
├── mcp-server-redis             - Redis operations
├── mcp-server-elasticsearch     - Elasticsearch search
└── mcp-server-stripe            - Stripe payments
```

---

## 6. Advanced Tool Use Patterns

### 6.1 Tool Chaining

```python
# Pattern for using multiple tools in sequence
class ToolChain:
    """Pipes the output of one tool as input to the next"""

    def __init__(self, tools: dict):
        self.tools = tools

    def chain(self, steps: list[dict]) -> dict:
        """
        steps = [
            {"tool": "search", "input": {"query": "..."}, "output_key": "results"},
            {"tool": "summarize", "input_from": "results", "output_key": "summary"},
            {"tool": "translate", "input_from": "summary", "output_key": "translation"}
        ]
        """
        context = {}

        for step in steps:
            tool_name = step["tool"]

            # Use the previous step's output as input
            if "input_from" in step:
                tool_input = {"text": context[step["input_from"]]}
            else:
                tool_input = step["input"]

            # Execute tool
            result = self.toolstool_name
            context[step["output_key"]] = result

        return context

# Usage example: search → summarize → translate chain
chain = ToolChain(tools={
    "search": search_web,
    "summarize": summarize_text,
    "translate": translate_text
})

result = chain.chain([
    {"tool": "search", "input": {"query": "quantum computing 2025"}, "output_key": "results"},
    {"tool": "summarize", "input_from": "results", "output_key": "summary"},
    {"tool": "translate", "input_from": "summary", "output_key": "japanese"}
])
print(result["japanese"])
```

### 6.2 Tool Fallback

```python
# Fallback when the primary tool fails
class ToolWithFallback:
    """Tries tools in primary → secondary order"""

    def __init__(self):
        self.fallback_chains = {}

    def register(self, name: str, primary, *fallbacks):
        self.fallback_chains[name] = [primary] + list(fallbacks)

    def execute(self, name: str, **kwargs) -> dict:
        chain = self.fallback_chains.get(name, [])
        errors = []

        for i, tool in enumerate(chain):
            try:
                result = tool(**kwargs)
                return {
                    "status": "success",
                    "data": result,
                    "tool_index": i,
                    "fallback_used": i > 0
                }
            except Exception as e:
                errors.append(f"Tool {i}: {type(e).__name__}: {e}")
                continue

        return {
            "status": "all_failed",
            "errors": errors
        }

# Usage example
tools = ToolWithFallback()
tools.register(
    "search",
    google_search,      # Primary: Google Search
    bing_search,         # Fallback 1: Bing Search
    duckduckgo_search    # Fallback 2: DuckDuckGo Search
)

result = tools.execute("search", query="AI agents 2025")
```

### 6.3 Dynamic Tool Registration and Discovery

```python
# Tool registry: dynamically add/remove tools at runtime
class ToolRegistry:
    """Dynamic tool registration and discovery system"""

    def __init__(self):
        self.tools = {}
        self.metadata = {}

    def register(self, name: str, handler, schema: dict,
                 tags: list[str] = None, version: str = "1.0"):
        """Register a tool"""
        self.tools[name] = handler
        self.metadata[name] = {
            "schema": schema,
            "tags": tags or [],
            "version": version,
            "registered_at": time.time()
        }

    def unregister(self, name: str):
        """Remove a tool"""
        self.tools.pop(name, None)
        self.metadata.pop(name, None)

    def discover(self, tags: list[str] = None,
                 query: str = None) -> list[dict]:
        """Discover tools matching the given conditions"""
        results = []
        for name, meta in self.metadata.items():
            if tags and not set(tags).intersection(set(meta["tags"])):
                continue
            if query and query.lower() not in meta["schema"]["description"].lower():
                continue
            results.append({
                "name": name,
                "description": meta["schema"]["description"],
                "tags": meta["tags"],
                "version": meta["version"]
            })
        return results

    def get_tools_for_llm(self, tags: list[str] = None) -> list[dict]:
        """Generate tool definitions to pass to the LLM"""
        discovered = self.discover(tags=tags)
        return [
            self.metadata[t["name"]]["schema"]
            for t in discovered
        ]

# Usage example
registry = ToolRegistry()

registry.register("search_web", search_web, {
    "name": "search_web",
    "description": "Search the web",
    "input_schema": {...}
}, tags=["search", "web"])

registry.register("query_db", query_db, {
    "name": "query_db",
    "description": "Search the database",
    "input_schema": {...}
}, tags=["search", "database"])

# Get only search-related tools
search_tools = registry.get_tools_for_llm(tags=["search"])
```

### 6.4 Tool Use Audit Logging

```python
# Audit log for all tool calls
import logging
from datetime import datetime
from functools import wraps

class ToolAuditLogger:
    """Records audit logs of tool usage"""

    def __init__(self, log_file: str = "tool_audit.log"):
        self.logger = logging.getLogger("tool_audit")
        handler = logging.FileHandler(log_file)
        handler.setFormatter(logging.Formatter(
            '%(asctime)s | %(message)s'
        ))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def wrap(self, tool_name: str, handler):
        """Wrap a tool handler to add audit logging"""
        @wraps(handler)
        def wrapped(**kwargs):
            start_time = datetime.now()
            request_id = str(uuid.uuid4())[:8]

            # Input log
            self.logger.info(
                f"CALL | {request_id} | {tool_name} | "
                f"input={json.dumps(kwargs, ensure_ascii=False, default=str)}"
            )

            try:
                result = handler(**kwargs)
                duration = (datetime.now() - start_time).total_seconds()

                # Success log
                result_preview = str(result)[:500]
                self.logger.info(
                    f"OK   | {request_id} | {tool_name} | "
                    f"duration={duration:.3f}s | result_preview={result_preview}"
                )
                return result

            except Exception as e:
                duration = (datetime.now() - start_time).total_seconds()

                # Error log
                self.logger.error(
                    f"FAIL | {request_id} | {tool_name} | "
                    f"duration={duration:.3f}s | error={type(e).__name__}: {e}"
                )
                raise

        return wrapped

# Usage example
audit = ToolAuditLogger()
search_web = audit.wrap("search_web", search_web)
query_db = audit.wrap("query_db", query_db)
```

---

## 7. Security

### 7.1 Tool Security Model

```
Layers of Tool Security

+-----------------------------------------------+
| Layer 4: Human Approval                         |
|   Require user confirmation before              |
|   destructive operations                        |
+-----------------------------------------------+
| Layer 3: Audit Logging                          |
|   Record and detect all tool calls             |
+-----------------------------------------------+
| Layer 2: Input Validation                       |
|   Prevent SQL injection, path traversal        |
+-----------------------------------------------+
| Layer 1: Least Privilege                        |
|   Grant tools only the minimum required access |
+-----------------------------------------------+
```

### 7.2 Implementing Input Validation

```python
# Security validation for tool inputs
import re
from pathlib import Path

class ToolInputValidator:
    """Security validation for tool inputs"""

    @staticmethod
    def validate_sql(query: str) -> tuple[bool, str]:
        """Validate an SQL query"""
        # Allow only SELECT
        query_upper = query.strip().upper()
        if not query_upper.startswith("SELECT"):
            return False, "Only SELECT statements are allowed"

        # Detect dangerous keywords
        dangerous = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER",
                     "CREATE", "TRUNCATE", "EXEC", "EXECUTE", "UNION"]
        for keyword in dangerous:
            if re.search(rf'\b{keyword}\b', query_upper):
                return False, f"'{keyword}' cannot be used"

        # Detect comments (injection prevention)
        if "--" in query or "/*" in query:
            return False, "SQL comments cannot be used"

        return True, "OK"

    @staticmethod
    def validate_file_path(path: str, allowed_dirs: list[str]) -> tuple[bool, str]:
        """Validate a file path"""
        resolved = Path(path).resolve()

        # Detect path traversal
        if ".." in str(resolved):
            return False, "Path traversal detected"

        # Check if within allowed directories
        for allowed in allowed_dirs:
            if str(resolved).startswith(str(Path(allowed).resolve())):
                return True, "OK"

        return False, f"Path '{path}' is outside the allowed directories"

    @staticmethod
    def validate_url(url: str) -> tuple[bool, str]:
        """Validate a URL"""
        from urllib.parse import urlparse

        parsed = urlparse(url)

        if parsed.scheme not in ("http", "https"):
            return False, "Only HTTP or HTTPS is allowed"

        # Prevent access to internal networks
        internal_patterns = [
            r"localhost", r"127\.0\.0\.1", r"0\.0\.0\.0",
            r"10\.\d+\.\d+\.\d+", r"172\.(1[6-9]|2\d|3[01])\.\d+\.\d+",
            r"192\.168\.\d+\.\d+", r"169\.254\.\d+\.\d+"
        ]
        for pattern in internal_patterns:
            if re.search(pattern, parsed.hostname or ""):
                return False, "Access to internal networks is prohibited"

        return True, "OK"

# Embed validation into tools
validator = ToolInputValidator()

def safe_query_db(query: str) -> str:
    valid, message = validator.validate_sql(query)
    if not valid:
        return json.dumps({"error": message})
    return execute_sql(query)
```

### 7.3 Human Approval Flow

```python
# Human-in-the-Loop: confirmation before dangerous operations
class HumanApprovalGate:
    """Request human approval before destructive operations"""

    # Categories of operations that require approval
    REQUIRES_APPROVAL = {
        "destructive": ["delete_file", "drop_table", "remove_user"],
        "external": ["send_email", "post_to_slack", "deploy"],
        "financial": ["create_payment", "refund", "update_pricing"],
        "sensitive": ["access_pii", "export_data", "change_permissions"]
    }

    def __init__(self, approval_callback=None):
        self.callback = approval_callback or self._cli_approval

    def check(self, tool_name: str, args: dict) -> bool:
        """Check whether the operation requires approval, and if so, request it"""
        for category, tools in self.REQUIRES_APPROVAL.items():
            if tool_name in tools:
                return self.callback(
                    tool_name=tool_name,
                    category=category,
                    args=args
                )
        return True  # No approval needed

    def _cli_approval(self, tool_name: str, category: str, args: dict) -> bool:
        """Request approval on the CLI"""
        print(f"\n{'='*60}")
        print(f"[Approval Required] Operation in category: {category}")
        print(f"Tool: {tool_name}")
        print(f"Arguments: {json.dumps(args, ensure_ascii=False, indent=2)}")
        print(f"{'='*60}")

        response = input("Allow execution? (yes/no): ").strip().lower()
        return response == "yes"

# Integrate into the agent
gate = HumanApprovalGate()

def guarded_tool_execution(tool_name: str, args: dict):
    if not gate.check(tool_name, args):
        return {"status": "rejected", "message": "User rejected the operation"}
    return execute_tool(tool_name, args)
```

### 7.4 Rate Limiting and Quota Management

```python
# Rate limiting for tool usage
import time
from collections import defaultdict

class ToolRateLimiter:
    """Rate limiting for tool calls"""

    def __init__(self):
        self.limits = {}
        self.call_history = defaultdict(list)

    def set_limit(self, tool_name: str, max_calls: int,
                  window_seconds: int = 60):
        """Set a rate limit"""
        self.limits[tool_name] = {
            "max_calls": max_calls,
            "window": window_seconds
        }

    def check(self, tool_name: str) -> tuple[bool, str]:
        """Check the rate limit"""
        if tool_name not in self.limits:
            return True, "OK"

        limit = self.limits[tool_name]
        now = time.time()
        window_start = now - limit["window"]

        # Count calls within the window
        recent = [t for t in self.call_history[tool_name] if t > window_start]
        self.call_history[tool_name] = recent  # Cleanup

        if len(recent) >= limit["max_calls"]:
            wait_time = recent[0] - window_start
            return False, (
                f"Rate limit exceeded: {tool_name} allows {limit['max_calls']} calls "
                f"per {limit['window']} seconds. Retry in {wait_time:.1f} seconds."
            )

        self.call_history[tool_name].append(now)
        return True, "OK"

# Usage example
limiter = ToolRateLimiter()
limiter.set_limit("search_web", max_calls=10, window_seconds=60)
limiter.set_limit("send_email", max_calls=5, window_seconds=300)
limiter.set_limit("query_db", max_calls=30, window_seconds=60)
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Providing Too Many Tools

```python
# Bad: passing 50 tools at once
tools = [tool1, tool2, ..., tool50]
# The LLM struggles to choose, reducing accuracy

# Good: provide only tools relevant to the task (5-10 is ideal)
def select_tools(task_type: str) -> list:
    tool_sets = {
        "research": [search_web, read_page, summarize],
        "coding": [read_file, write_file, run_code],
        "data": [query_db, create_chart, export_csv]
    }
    return tool_sets.get(task_type, [])
```

### Anti-Pattern 2: Missing Error Handling

```python
# Bad: return tool execution result as-is
def call_tool(name, args):
    return toolsname  # Crashes on exception

# Good: structured error response
def call_tool(name, args):
    try:
        result = toolsname
        return {"status": "success", "data": result}
    except KeyError:
        return {"status": "error", "message": f"Tool '{name}' does not exist"}
    except ValidationError as e:
        return {"status": "error", "message": f"Argument error: {e}"}
    except TimeoutError:
        return {"status": "error", "message": "Timeout. Please retry"}
    except Exception as e:
        return {"status": "error", "message": f"Unexpected error: {type(e).__name__}"}
```

### Anti-Pattern 3: Returning Raw Tool Results

```python
# Bad: pass raw API response directly to the LLM
def search_tool(query):
    response = requests.get(f"https://api.example.com/search?q={query}")
    return response.text  # Contains HTML, huge JSON, unnecessary metadata

# Good: format into a shape that is easy for the LLM to process
def search_tool(query):
    response = requests.get(f"https://api.example.com/search?q={query}")
    data = response.json()

    # Extract only the necessary information
    results = []
    for item in data["results"][:10]:
        results.append({
            "title": item["title"],
            "snippet": item["snippet"][:300],
            "url": item["url"]
        })

    return json.dumps({
        "query": query,
        "total_results": data["total"],
        "showing": len(results),
        "results": results
    }, ensure_ascii=False)
```

### Anti-Pattern 4: Vague Tool Descriptions

```python
# Bad: vague description
bad_tool = {
    "name": "process",  # Unclear what it processes
    "description": "Processes data",  # No specifics
    "input_schema": {
        "type": "object",
        "properties": {
            "input": {"type": "string"}  # Unclear what input is
        }
    }
}

# Good: specific description
good_tool = {
    "name": "analyze_sentiment",
    "description": (
        "Performs sentiment analysis on text and returns a positive/negative/neutral label "
        "along with a confidence score (0.0-1.0). Supports Japanese and English. "
        "Maximum 5000 characters. If longer, split and send in parts."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "text": {
                "type": "string",
                "description": "Text to analyze (max 5000 characters)",
                "maxLength": 5000
            },
            "language": {
                "type": "string",
                "enum": ["ja", "en", "auto"],
                "description": "Language of the text (auto for automatic detection)",
                "default": "auto"
            }
        },
        "required": ["text"]
    }
}
```

---

## 9. Monitoring and Optimization of Tool Use

### 9.1 Tool Use Metrics

```python
# Collecting metrics for tool usage
from dataclasses import dataclass, field
from collections import defaultdict

@dataclass
class ToolMetrics:
    """Collects and analyzes metrics for tool usage"""
    call_counts: dict = field(default_factory=lambda: defaultdict(int))
    error_counts: dict = field(default_factory=lambda: defaultdict(int))
    latencies: dict = field(default_factory=lambda: defaultdict(list))
    token_costs: dict = field(default_factory=lambda: defaultdict(int))

    def record_call(self, tool_name: str, duration: float,
                    success: bool, tokens_used: int = 0):
        self.call_counts[tool_name] += 1
        self.latencies[tool_name].append(duration)
        self.token_costs[tool_name] += tokens_used
        if not success:
            self.error_counts[tool_name] += 1

    def get_summary(self) -> dict:
        summary = {}
        for name in self.call_counts:
            lats = self.latencies[name]
            summary[name] = {
                "total_calls": self.call_counts[name],
                "error_rate": (
                    self.error_counts[name] / self.call_counts[name] * 100
                    if self.call_counts[name] > 0 else 0
                ),
                "avg_latency_ms": sum(lats) / len(lats) * 1000 if lats else 0,
                "p95_latency_ms": sorted(lats)[int(len(lats) * 0.95)] * 1000 if lats else 0,
                "total_tokens": self.token_costs[name]
            }
        return summary

    def get_recommendations(self) -> list[str]:
        """Generate optimization recommendations"""
        recommendations = []
        summary = self.get_summary()

        for name, stats in summary.items():
            if stats["error_rate"] > 20:
                recommendations.append(
                    f"[{name}] Error rate is high at {stats['error_rate']:.1f}%. "
                    f"Consider strengthening input validation."
                )
            if stats["avg_latency_ms"] > 5000:
                recommendations.append(
                    f"[{name}] Average latency is high at {stats['avg_latency_ms']:.0f}ms. "
                    f"Consider introducing caching."
                )
            if stats["total_calls"] > 100 and stats["total_calls"] > sum(
                s["total_calls"] for s in summary.values()
            ) * 0.5:
                recommendations.append(
                    f"[{name}] Accounts for more than 50% of all calls. "
                    f"Consider introducing batch processing."
                )

        return recommendations
```

### 9.2 Tool Caching

```python
# Cache tool results
import hashlib
from functools import lru_cache

class ToolCache:
    """Cache tool results to reduce duplicate calls"""

    def __init__(self, ttl_seconds: int = 300):
        self.cache = {}
        self.ttl = ttl_seconds

    def _make_key(self, tool_name: str, args: dict) -> str:
        args_str = json.dumps(args, sort_keys=True)
        return hashlib.sha256(f"{tool_name}:{args_str}".encode()).hexdigest()

    def get(self, tool_name: str, args: dict):
        key = self._make_key(tool_name, args)
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry["timestamp"] < self.ttl:
                return entry["result"]
            del self.cache[key]
        return None

    def set(self, tool_name: str, args: dict, result):
        key = self._make_key(tool_name, args)
        self.cache[key] = {
            "result": result,
            "timestamp": time.time()
        }

    def wrap(self, tool_name: str, handler, cacheable: bool = True):
        """Add caching to a tool handler"""
        if not cacheable:
            return handler

        def cached_handler(**kwargs):
            # Check cache hit
            cached = self.get(tool_name, kwargs)
            if cached is not None:
                return cached

            # Execute tool and cache result
            result = handler(**kwargs)
            self.set(tool_name, kwargs, result)
            return result

        return cached_handler

# Usage example
cache = ToolCache(ttl_seconds=600)

# Apply caching to read-only tools
search_web = cache.wrap("search_web", search_web, cacheable=True)
# Do not apply caching to write tools
send_email = cache.wrap("send_email", send_email, cacheable=False)
```

---

## 10. Troubleshooting

### 10.1 Common Problems and Solutions

| Problem | Cause | Solution |
|---------|-------|----------|
| Tool is never called | Unclear description | Improve description to be more specific |
| Wrong tool is called | Insufficient differentiation between similar tools | Differentiate tool names and descriptions |
| Invalid parameters | Insufficient schema constraints | Add enum, min/max, default values |
| Infinite loop | Repeatedly calls the same tool | Add loop detection and max step limit |
| Slow responses | High tool execution latency | Caching, parallel execution, timeout settings |
| Token overflow | Tool result is too large | Summarize results, use pagination |
| Permission error | Improper access control | Apply the principle of least privilege |

### 10.2 Debugging Techniques

```python
# Debug support for tool usage
class ToolDebugger:
    """A class to assist with debugging tool usage"""

    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.trace = []

    def log_tool_selection(self, available_tools: list,
                           selected_tool: str, reasoning: str):
        """Record the tool selection process"""
        entry = {
            "event": "tool_selection",
            "available": [t["name"] for t in available_tools],
            "selected": selected_tool,
            "reasoning": reasoning,
            "timestamp": time.time()
        }
        self.trace.append(entry)
        if self.verbose:
            print(f"[DEBUG] Tool selected: {selected_tool}")
            print(f"  Reason: {reasoning}")
            print(f"  Candidates: {entry['available']}")

    def log_tool_call(self, tool_name: str, input_data: dict,
                      result, duration: float):
        """Record the details of a tool call"""
        entry = {
            "event": "tool_call",
            "tool": tool_name,
            "input": input_data,
            "result_preview": str(result)[:200],
            "duration_ms": duration * 1000,
            "timestamp": time.time()
        }
        self.trace.append(entry)
        if self.verbose:
            print(f"[DEBUG] {tool_name} completed ({duration*1000:.1f}ms)")
            print(f"  Input: {json.dumps(input_data, ensure_ascii=False)[:200]}")
            print(f"  Result: {str(result)[:200]}")

    def export_trace(self, filepath: str):
        """Export the trace to a file"""
        with open(filepath, "w") as f:
            json.dump(self.trace, f, ensure_ascii=False, indent=2, default=str)

    def analyze_trace(self) -> dict:
        """Analyze the trace to detect bottlenecks"""
        tool_calls = [e for e in self.trace if e["event"] == "tool_call"]

        analysis = {
            "total_calls": len(tool_calls),
            "total_duration_ms": sum(e["duration_ms"] for e in tool_calls),
            "slowest_call": max(tool_calls, key=lambda e: e["duration_ms"]) if tool_calls else None,
            "tool_frequency": defaultdict(int)
        }

        for call in tool_calls:
            analysis["tool_frequency"][call["tool"]] += 1

        # Detect duplicate calls
        seen_inputs = {}
        duplicates = []
        for call in tool_calls:
            key = f"{call['tool']}:{json.dumps(call['input'], sort_keys=True)}"
            if key in seen_inputs:
                duplicates.append(call["tool"])
            seen_inputs[key] = True

        analysis["duplicate_calls"] = duplicates
        return analysis
```

### 10.3 Tool Definition Validation

```python
# Validation for tool definitions
class ToolDefinitionValidator:
    """Automatically checks the quality of tool definitions"""

    def validate(self, tool_def: dict) -> list[str]:
        warnings = []

        # Check name
        name = tool_def.get("name", "")
        if not re.match(r'^[a-z][a-z0-9_]*$', name):
            warnings.append(f"Name '{name}' should use snake_case format")

        # Check description
        desc = tool_def.get("description", "")
        if len(desc) < 20:
            warnings.append("Description is too short (20+ characters recommended)")
        if len(desc) > 500:
            warnings.append("Description is too long (500 characters or fewer recommended)")
        if "。" not in desc and "." not in desc:
            warnings.append("Description does not contain a sentence ending")

        # Check schema
        schema = tool_def.get("input_schema", {})
        props = schema.get("properties", {})
        required = schema.get("required", [])

        for prop_name, prop_def in props.items():
            if "description" not in prop_def:
                warnings.append(f"Parameter '{prop_name}' is missing a description")
            if prop_def.get("type") == "string" and "enum" not in prop_def:
                if prop_name not in required:
                    if "default" not in prop_def:
                        warnings.append(
                            f"Optional parameter '{prop_name}' has no default value"
                        )

        return warnings

# Usage example
validator = ToolDefinitionValidator()
for tool in tools:
    warnings = validator.validate(tool)
    if warnings:
        print(f"\nIssues with [{tool['name']}]:")
        for w in warnings:
            print(f"  - {w}")
```

---

## 11. FAQ

### Q1: What is the performance impact when there are many tools?

All tool definitions are counted as prompt tokens. More tools means:
- **Higher costs** (more input tokens)
- **Lower selection accuracy** (confusion between similar tools)
- **Increased latency**

The recommendation is **5-15 tools per request**. For more, categorize them and select dynamically.

### Q2: What should I do when tool results are too large?

Since large results consume the LLM's context window, take the following measures:
- **Return a summary** (top N items only)
- **Pagination** (offset/limit parameters)
- **Filtering** (only necessary fields)

### Q3: What about security for tools that handle sensitive data?

- **Principle of least privilege**: grant tools only the minimum required permissions
- **Input validation**: prevent SQL injection and similar attacks
- **Audit logging**: record all tool calls
- **Human approval**: require confirmation before destructive operations (delete, send)

### Q4: What are the criteria for choosing an MCP server?

| Criterion | stdio | SSE (HTTP) |
|-----------|-------|------------|
| Deployment | Local process | Remote server |
| Security | Process isolation | Network isolation |
| Scalability | Single machine | Horizontally scalable |
| Latency | Very low | Network latency present |
| Use case | Local tools | Shared services |

Use **stdio** for local development tools and **SSE** for team-shared services.

### Q5: What can I do when tool response times are slow?

1. **Set timeouts**: configure an appropriate timeout for each tool (default 30 seconds)
2. **Caching**: cache results of read-only tools (TTL: 5-10 minutes)
3. **Parallel execution**: parallelize independent tool calls
4. **Async processing**: make long-running tools asynchronous and return progress
5. **Split results**: return large results via streaming or pagination

### Q6: What can I do when the LLM misuses tools?

```python
# System prompt to explicitly constrain tool usage
system_prompt = """
Rules for tool use:
1. Use delete_file only after confirmation (first verify the file's contents)
2. Use send_email only after drafting and getting user confirmation
3. query_db may only use SELECT statements
4. If the same tool fails 3 times in a row, consider an alternative approach
5. File operations are limited to /workspace/ and its subdirectories
"""
```

### Q7: How do I test a custom MCP server?

```python
# Unit testing for an MCP server
import pytest
from mcp.test import create_test_client

@pytest.fixture
async def mcp_client():
    """Create a test MCP client"""
    client = await create_test_client("python", ["mcp_server.py"])
    yield client
    await client.close()

@pytest.mark.asyncio
async def test_list_tools(mcp_client):
    """Test the list of tools"""
    tools = await mcp_client.list_tools()
    assert len(tools.tools) > 0
    tool_names = [t.name for t in tools.tools]
    assert "read_database" in tool_names

@pytest.mark.asyncio
async def test_read_database(mcp_client):
    """Test the DB search tool"""
    result = await mcp_client.call_tool(
        "read_database",
        {"query": "SELECT 1 AS test"}
    )
    assert result.content[0].text is not None
    data = json.loads(result.content[0].text)
    assert data[0]["test"] == 1

@pytest.mark.asyncio
async def test_invalid_sql(mcp_client):
    """Test rejection of invalid SQL"""
    result = await mcp_client.call_tool(
        "read_database",
        {"query": "DROP TABLE users"}
    )
    data = json.loads(result.content[0].text)
    assert "error" in data
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| Function Calling | The mechanism by which an LLM generates tool calls in JSON format |
| MCP | Standard protocol between AI and tools (proposed by Anthropic) |
| Tool definitions | Name + description + parameters. Description quality determines accuracy |
| Best practices | 5-15 tools, clear descriptions, error handling |
| Security | Least privilege, input validation, audit logging, human approval |
| Advanced patterns | Chaining, fallback, dynamic registration, caching |
| Monitoring | Metrics collection, trace analysis, bottleneck detection |

## Guides to Read Next

- [03-memory-systems.md](./03-memory-systems.md) — Memory system design
- [../02-implementation/02-mcp-agents.md](../02-implementation/02-mcp-agents.md) — MCP agent implementation
- [../02-implementation/03-claude-agent-sdk.md](../02-implementation/03-claude-agent-sdk.md) — Claude Agent SDK in depth

## References

1. Anthropic, "Tool use (function calling)" — https://docs.anthropic.com/en/docs/build-with-claude/tool-use
2. Anthropic, "Model Context Protocol" — https://modelcontextprotocol.io/
3. OpenAI, "Function calling" — https://platform.openai.com/docs/guides/function-calling
4. Schick, T. et al., "Toolformer: Language Models Can Teach Themselves to Use Tools" (2023) — https://arxiv.org/abs/2302.04761
5. Google, "Function calling with Gemini" — https://ai.google.dev/docs/function_calling
6. Qin, Y. et al., "Tool Learning with Foundation Models" (2023) — https://arxiv.org/abs/2304.08354
