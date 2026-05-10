# Claude Agent SDK

> Anthropic's official agent-building toolkit — explaining how to build tool-using agents with minimal code and integrate natively with MCP servers.

## What You Will Learn in This Chapter

1. Agent loop construction patterns using the Claude Messages API
2. Implementing tool definitions, parallel tool calls, and streaming
3. MCP integration and production-ready design patterns
4. Implementing multi-agent orchestration
5. Designing error handling, retries, and guardrails
6. Optimizing context management and conversation memory
7. Performance tuning and monitoring in production environments


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [MCP Agents](./02-mcp-agents.md)

---

## 1. Positioning of the Claude Agent SDK

```
Agent-Building Options

 Abstraction High  +---------+
                   | CrewAI  |  High-level framework
                   +---------+
                   | LangChain|  General-purpose framework
                   +---------+
                   | Claude   |  Official SDK (direct API)
                   | Agent SDK|
                   +---------+  ← Scope of this chapter
 Abstraction Low   | Raw HTTP |  Raw API calls
                   +---------+

Advantages of Claude Agent SDK:
- Minimal dependencies (only the anthropic package)
- Direct access to all API features
- Native integration with MCP
- No "magic" from abstraction layers
```

### 1.1 SDK Installation and Initial Setup

```bash
# Basic installation
pip install anthropic

# With streaming and async support
pip install "anthropic[bedrock,vertex]"

# Recommended setup for development environments
pip install anthropic python-dotenv pydantic
```

```python
# Environment variable configuration
import os
from dotenv import load_dotenv

load_dotenv()

# Method 1: Auto-load from environment variables (recommended)
# Set ANTHROPIC_API_KEY as an environment variable
import anthropic
client = anthropic.Anthropic()  # Automatically references ANTHROPIC_API_KEY

# Method 2: Explicitly specify API key
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Method 3: Via AWS Bedrock
bedrock_client = anthropic.AnthropicBedrock(
    aws_region="us-east-1",
    aws_access_key=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

# Method 4: Via Google Vertex AI
vertex_client = anthropic.AnthropicVertex(
    project_id="my-project",
    region="us-east5",
)
```

### 1.2 Detailed Comparison with Other Frameworks

```
Claude Agent SDK vs Other Frameworks — Feature Comparison

+------------------+------------+-----------+----------+----------+
|                  | Claude SDK | LangChain | CrewAI   | AutoGen  |
+------------------+------------+-----------+----------+----------+
| Dependency count |    1       |   50+     |   30+    |   20+    |
| Learning cost    |    Low     |   High    |   Medium |   Medium |
| Type safety      |    High    |   Low     |   Medium |   Medium |
| Debug ease       |    High    |   Low     |   Medium |   Medium |
| Customizability  |    Best    |   High    |   Medium |   High   |
| MCP integration  |   Native   |  Plugin   |   None   |   None   |
| Multi-model      |   Claude   |   Any     |   Any    |   Any    |
| Production-ready |    High    |   Medium  |   Low    |   Medium |
| Community size   |   Medium   |   Largest |   Medium |   Medium |
+------------------+------------+-----------+----------+----------+
```

### 1.3 API Versioning and Model ID Management

```python
# Model ID management pattern
from enum import Enum

class ClaudeModel(str, Enum):
    """List of available Claude models"""
    HAIKU = "claude-haiku-4-20250514"
    SONNET = "claude-sonnet-4-20250514"
    OPUS = "claude-opus-4-20250514"

    @property
    def cost_per_1k_input(self) -> float:
        """Cost per 1K input tokens (USD)"""
        costs = {
            self.HAIKU: 0.00025,
            self.SONNET: 0.003,
            self.OPUS: 0.015,
        }
        return costs[self]

    @property
    def cost_per_1k_output(self) -> float:
        """Cost per 1K output tokens (USD)"""
        costs = {
            self.HAIKU: 0.00125,
            self.SONNET: 0.015,
            self.OPUS: 0.075,
        }
        return costs[self]

    @property
    def max_context_window(self) -> int:
        """Maximum context window size"""
        return 200_000  # Common across all models

# Usage example
model = ClaudeModel.SONNET
print(f"Model: {model.value}")
print(f"Input cost: ${model.cost_per_1k_input}/1K tokens")
print(f"Context: {model.max_context_window:,} tokens")
```

---

## 2. Basic Agent Loop

### 2.1 Minimal Configuration

```python
# Claude Agent SDK: minimal agent configuration
import anthropic

client = anthropic.Anthropic()

def simple_agent(user_message: str) -> str:
    """The simplest possible agent"""
    messages = [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=messages
    )

    return response.content[0].text
```

### 2.2 Tool-Using Agent

```python
# Complete agent loop with tool use
import anthropic
import json
from typing import Any

client = anthropic.Anthropic()

# Tool definitions
TOOLS = [
    {
        "name": "read_file",
        "description": "Read and return the contents of the specified file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path of the file to read"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to the specified file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path"},
                "content": {"type": "string", "description": "Content to write"}
            },
            "required": ["path", "content"]
        }
    },
    {
        "name": "run_command",
        "description": "Execute a shell command and return the result",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Command to execute"}
            },
            "required": ["command"]
        }
    }
]

# Tool execution handler
def execute_tool(name: str, input_data: dict) -> str:
    try:
        if name == "read_file":
            with open(input_data["path"]) as f:
                return f.read()
        elif name == "write_file":
            with open(input_data["path"], "w") as f:
                f.write(input_data["content"])
            return f"File write complete: {input_data['path']}"
        elif name == "run_command":
            import subprocess
            result = subprocess.run(
                input_data["command"],
                shell=True, capture_output=True, text=True, timeout=30
            )
            return result.stdout + result.stderr
        else:
            return f"Unknown tool: {name}"
    except Exception as e:
        return f"Error: {type(e).__name__}: {e}"

# Agent loop
def agent_loop(
    user_message: str,
    system_prompt: str = "",
    max_steps: int = 20
) -> str:
    messages = [{"role": "user", "content": user_message}]

    for step in range(max_steps):
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            tools=TOOLS,
            messages=messages
        )

        # Final answer case
        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return ""

        # Tool call case
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  [{step}] Tool: {block.name}({json.dumps(block.input, ensure_ascii=False)[:80]})")
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result[:10000]  # Limit in case result is too large
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})

    return "Maximum number of steps reached."

# Execution
result = agent_loop(
    "Read setup.py, run the tests, and report the results",
    system_prompt="You are a Python development assistant."
)
print(result)
```

### 2.3 Detailed Response Analysis

```python
# Understanding the structure of the response object
from anthropic.types import Message, ContentBlock, TextBlock, ToolUseBlock

def analyze_response(response: Message) -> dict:
    """Analyze and log response details"""
    analysis = {
        "id": response.id,
        "model": response.model,
        "stop_reason": response.stop_reason,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "content_blocks": [],
    }

    for block in response.content:
        if isinstance(block, TextBlock):
            analysis["content_blocks"].append({
                "type": "text",
                "length": len(block.text),
                "preview": block.text[:100],
            })
        elif isinstance(block, ToolUseBlock):
            analysis["content_blocks"].append({
                "type": "tool_use",
                "name": block.name,
                "id": block.id,
                "input_keys": list(block.input.keys()),
            })

    # Cost calculation
    model = response.model
    input_cost = response.usage.input_tokens * 0.003 / 1000  # Assuming Sonnet
    output_cost = response.usage.output_tokens * 0.015 / 1000
    analysis["estimated_cost_usd"] = round(input_cost + output_cost, 6)

    return analysis

# Usage example
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)
info = analyze_response(response)
print(json.dumps(info, indent=2, ensure_ascii=False))
```

### 2.4 Complete Guide to stop_reason

```python
# Types of stop_reason and how to handle them
STOP_REASON_HANDLERS = {
    "end_turn": "Model naturally finished the response. Retrieve the final text.",
    "tool_use": "Tool call required. Execute the tool and return the result.",
    "max_tokens": "Output token limit reached. Increase max_tokens or split the processing.",
    "stop_sequence": "Matched specified stop_sequence. Custom termination condition.",
}

def handle_stop_reason(response) -> str:
    """Execute appropriate handling based on stop_reason"""
    reason = response.stop_reason

    if reason == "end_turn":
        return extract_text(response)

    elif reason == "tool_use":
        # Tool call handling (continue in agent loop)
        return "CONTINUE_LOOP"

    elif reason == "max_tokens":
        # Handling when output is cut off midway
        partial_text = extract_text(response)
        # Request continuation
        return partial_text + "\n[Output was cut off. Generating continuation...]"

    elif reason == "stop_sequence":
        # Custom termination condition
        return extract_text(response)

    else:
        raise ValueError(f"Unknown stop_reason: {reason}")
```

---

## 3. Advanced Features

### 3.1 Streaming

```python
# Real-time output with streaming
def streaming_agent(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    while True:
        tool_use_blocks = []
        current_text = ""

        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=TOOLS,
            messages=messages
        ) as stream:
            for event in stream:
                if event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        print(event.delta.text, end="", flush=True)
                        current_text += event.delta.text

            response = stream.get_final_message()

        if response.stop_reason == "end_turn":
            return current_text

        # Tool call handling
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

### 3.2 Advanced Streaming Event Handling

```python
# Handler for processing all types of streaming events
from dataclasses import dataclass, field
from typing import Optional
import json

@dataclass
class StreamState:
    """State management during streaming"""
    current_block_type: Optional[str] = None
    current_tool_name: Optional[str] = None
    current_tool_id: Optional[str] = None
    accumulated_text: str = ""
    accumulated_json: str = ""
    tool_calls: list = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0

def advanced_streaming_agent(user_message: str):
    """Advanced streaming agent that processes all events"""
    messages = [{"role": "user", "content": user_message}]

    while True:
        state = StreamState()

        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=TOOLS,
            messages=messages
        ) as stream:
            for event in stream:
                # Message start
                if event.type == "message_start":
                    state.input_tokens = event.message.usage.input_tokens
                    print(f"\n[Input tokens: {state.input_tokens}]")

                # Content block start
                elif event.type == "content_block_start":
                    if event.content_block.type == "text":
                        state.current_block_type = "text"
                    elif event.content_block.type == "tool_use":
                        state.current_block_type = "tool_use"
                        state.current_tool_name = event.content_block.name
                        state.current_tool_id = event.content_block.id
                        state.accumulated_json = ""
                        print(f"\n[Tool call: {event.content_block.name}]")

                # Delta (differential data)
                elif event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        print(event.delta.text, end="", flush=True)
                        state.accumulated_text += event.delta.text
                    elif hasattr(event.delta, "partial_json"):
                        state.accumulated_json += event.delta.partial_json

                # Content block end
                elif event.type == "content_block_stop":
                    if state.current_block_type == "tool_use":
                        try:
                            tool_input = json.loads(state.accumulated_json)
                        except json.JSONDecodeError:
                            tool_input = {}
                        state.tool_calls.append({
                            "name": state.current_tool_name,
                            "id": state.current_tool_id,
                            "input": tool_input,
                        })
                    state.current_block_type = None

                # Message delta (usage information)
                elif event.type == "message_delta":
                    state.output_tokens = event.usage.output_tokens

            response = stream.get_final_message()

        print(f"\n[Output tokens: {state.output_tokens}]")

        if response.stop_reason == "end_turn":
            return state.accumulated_text

        # Tool call handling
        tool_results = []
        for call in state.tool_calls:
            result = execute_tool(call["name"], call["input"])
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call["id"],
                "content": result[:10000],
            })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

### 3.3 Parallel Tool Calls

```python
# Claude can call multiple tools simultaneously in a single response
# Example: "Tell me the weather in Tokyo and Osaka" → two get_weather calls simultaneously

def handle_parallel_tool_calls(response) -> list:
    """Handle parallel tool calls"""
    tool_results = []

    for block in response.content:
        if block.type == "tool_use":
            # Process each tool call
            result = execute_tool(block.name, block.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result
            })

    return tool_results

# Async version (true parallel execution)
async def handle_parallel_tool_calls_async(response) -> list:
    import asyncio

    async def execute_single(block):
        result = await async_execute_tool(block.name, block.input)
        return {
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": result
        }

    tool_blocks = [b for b in response.content if b.type == "tool_use"]
    results = await asyncio.gather(*[execute_single(b) for b in tool_blocks])
    return list(results)
```

### 3.4 Practical Patterns for Parallel Tool Calls

```python
# Practical parallel tool call example: simultaneous multi-API calls
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor

class ParallelToolExecutor:
    """Executor for running tool calls in parallel"""

    def __init__(self, max_workers: int = 5, timeout: float = 30.0):
        self.max_workers = max_workers
        self.timeout = timeout
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def execute_parallel(self, tool_calls: list) -> list:
        """Execute multiple tool calls in parallel"""
        tasks = []
        for call in tool_calls:
            task = asyncio.create_task(
                self._execute_with_timeout(call)
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        tool_results = []
        for call, result in zip(tool_calls, results):
            if isinstance(result, Exception):
                content = f"Error: {type(result).__name__}: {result}"
                is_error = True
            else:
                content = str(result)
                is_error = False

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call["id"],
                "content": content,
                "is_error": is_error,
            })

        return tool_results

    async def _execute_with_timeout(self, call: dict):
        """Execute a tool with timeout"""
        return await asyncio.wait_for(
            self._execute_tool_async(call["name"], call["input"]),
            timeout=self.timeout,
        )

    async def _execute_tool_async(self, name: str, input_data: dict):
        """Async tool execution"""
        if name == "fetch_url":
            async with aiohttp.ClientSession() as session:
                async with session.get(input_data["url"]) as resp:
                    return await resp.text()
        elif name == "query_database":
            # Run synchronous DB connection in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                self.executor,
                lambda: self._sync_db_query(input_data["query"])
            )
        else:
            raise ValueError(f"Unknown tool: {name}")

    def _sync_db_query(self, query: str) -> str:
        """Synchronous DB query"""
        import sqlite3
        conn = sqlite3.connect("app.db")
        cursor = conn.execute(query)
        rows = cursor.fetchall()
        conn.close()
        return json.dumps(rows, ensure_ascii=False)

# Usage example
executor = ParallelToolExecutor(max_workers=10, timeout=15.0)

async def agent_with_parallel_tools(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            return extract_text(response)

        # Parallel execution
        tool_calls = [
            {"name": b.name, "id": b.id, "input": b.input}
            for b in response.content if b.type == "tool_use"
        ]
        tool_results = await executor.execute_parallel(tool_calls)

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

### 3.5 System Prompt Design

```python
# System prompt for agents
CODING_AGENT_PROMPT = """You are a coding agent acting as a senior software engineer.

## Code of Conduct
1. Always read and understand existing code before making changes
2. Write tests before implementation (TDD)
3. Keep changes to a minimum
4. When an error occurs, identify the cause before fixing it

## Tool Usage Guidelines
- read_file: Use first to understand code structure
- write_file: Use in order of test → implementation
- run_command: Use for running tests, lint, and type checking

## Output Format
- Briefly explain what you are doing before executing
- Provide a summary of changes after completion
"""
```

### 3.6 Advanced System Prompt Design Patterns

```python
# Role-based dynamic system prompt generation
from string import Template
from datetime import datetime

class SystemPromptBuilder:
    """Dynamically build structured system prompts"""

    def __init__(self):
        self.sections: dict[str, str] = {}

    def set_role(self, role: str) -> "SystemPromptBuilder":
        self.sections["role"] = f"## Role\n{role}"
        return self

    def set_rules(self, rules: list[str]) -> "SystemPromptBuilder":
        rules_text = "\n".join(f"{i+1}. {r}" for i, r in enumerate(rules))
        self.sections["rules"] = f"## Code of Conduct\n{rules_text}"
        return self

    def set_tool_guidelines(self, guidelines: dict[str, str]) -> "SystemPromptBuilder":
        lines = [f"- {tool}: {desc}" for tool, desc in guidelines.items()]
        self.sections["tools"] = f"## Tool Usage Guidelines\n" + "\n".join(lines)
        return self

    def set_output_format(self, format_desc: str) -> "SystemPromptBuilder":
        self.sections["output"] = f"## Output Format\n{format_desc}"
        return self

    def set_constraints(self, constraints: list[str]) -> "SystemPromptBuilder":
        lines = [f"- {c}" for c in constraints]
        self.sections["constraints"] = f"## Constraints\n" + "\n".join(lines)
        return self

    def add_context(self, key: str, value: str) -> "SystemPromptBuilder":
        self.sections[f"context_{key}"] = f"## {key}\n{value}"
        return self

    def build(self) -> str:
        parts = []
        # Guarantee order
        order = ["role", "rules", "tools", "output", "constraints"]
        for key in order:
            if key in self.sections:
                parts.append(self.sections[key])

        # Other sections
        for key, value in self.sections.items():
            if key not in order:
                parts.append(value)

        # Meta information
        parts.append(f"\n## Meta\n- Current datetime: {datetime.now().isoformat()}")

        return "\n\n".join(parts)

# Usage example: code review agent
review_prompt = (
    SystemPromptBuilder()
    .set_role("You perform code reviews as a senior software engineer.")
    .set_rules([
        "Prioritize security issues above all else",
        "Evaluate the impact on performance",
        "Check test coverage",
        "Verify compliance with coding standards",
        "Strive to provide constructive feedback",
    ])
    .set_tool_guidelines({
        "read_file": "Load the file to be reviewed",
        "run_command": "Use for test execution and static analysis",
        "search_code": "Use for searching related code",
    })
    .set_output_format(
        "Output review results in Markdown format. "
        "Assign severity (Critical/Warning/Info)."
    )
    .set_constraints([
        "Humans make the final approval/rejection decision",
        "Auto-fixes are suggestions only, not executed",
        "Never make personal attack comments",
    ])
    .build()
)
```

### 3.7 Using Extended Thinking

```python
# Agent using Extended Thinking
def agent_with_thinking(user_message: str, budget_tokens: int = 8000):
    """Agent that leverages extended thinking"""
    messages = [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16000,
        thinking={
            "type": "enabled",
            "budget_tokens": budget_tokens,  # Number of tokens to use for thinking
        },
        messages=messages,
    )

    # Separate thinking process from response
    thinking_text = ""
    response_text = ""

    for block in response.content:
        if block.type == "thinking":
            thinking_text = block.thinking
        elif block.type == "text":
            response_text = block.text

    return {
        "thinking": thinking_text,  # Keep thinking process for debugging
        "response": response_text,
    }

# Combining Extended Thinking with tool use
def planning_agent(user_message: str):
    """Use Extended Thinking for the planning phase, normal mode for the execution phase"""

    # Phase 1: Planning (Extended Thinking enabled)
    plan_response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        thinking={"type": "enabled", "budget_tokens": 5000},
        messages=[{
            "role": "user",
            "content": f"Please create an execution plan for the following task:\n{user_message}"
        }],
    )

    plan_text = ""
    for block in plan_response.content:
        if block.type == "text":
            plan_text = block.text

    # Phase 2: Execution (normal mode + tool use)
    result = agent_loop(
        f"Please execute according to the following plan:\n\n{plan_text}",
        system_prompt="Follow the plan faithfully and execute each step."
    )

    return {
        "plan": plan_text,
        "result": result,
    }
```

---

## 4. Structuring the Agent

### 4.1 Class-Based Agent Design

```python
# Class-based agent design
from dataclasses import dataclass, field
from typing import Callable
import time

@dataclass
class AgentConfig:
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096
    max_steps: int = 20
    temperature: float = 0.0
    system_prompt: str = ""
    timeout: float = 300.0  # seconds

class ClaudeAgent:
    def __init__(self, config: AgentConfig, tools: list, handlers: dict):
        self.config = config
        self.tools = tools
        self.handlers = handlers  # {tool_name: handler_function}
        self.client = anthropic.Anthropic()
        self.conversation_history = []

    def run(self, user_message: str) -> str:
        self.conversation_history.append({
            "role": "user", "content": user_message
        })
        start_time = time.time()

        for step in range(self.config.max_steps):
            if time.time() - start_time > self.config.timeout:
                return "Timed out"

            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                system=self.config.system_prompt,
                tools=self.tools,
                messages=self.conversation_history
            )

            if response.stop_reason == "end_turn":
                text = self._extract_text(response)
                self.conversation_history.append({
                    "role": "assistant", "content": response.content
                })
                return text

            # Tool processing
            tool_results = self._process_tools(response)
            self.conversation_history.append({
                "role": "assistant", "content": response.content
            })
            self.conversation_history.append({
                "role": "user", "content": tool_results
            })

        return "Maximum number of steps reached"

    def _process_tools(self, response) -> list:
        results = []
        for block in response.content:
            if block.type == "tool_use":
                handler = self.handlers.get(block.name)
                if handler:
                    try:
                        result = handler(**block.input)
                    except Exception as e:
                        result = f"Error: {e}"
                else:
                    result = f"No handler registered: {block.name}"
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result)
                })
        return results

    def _extract_text(self, response) -> str:
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""

    def reset(self):
        self.conversation_history = []
```

### 4.2 Plugin-Style Tool System

```python
# Decorator-based tool registration system
from typing import Callable, Any, get_type_hints
import inspect
import json

class ToolRegistry:
    """Registry for integrated tool registration, management, and execution"""

    def __init__(self):
        self._tools: dict[str, dict] = {}
        self._handlers: dict[str, Callable] = {}

    def tool(self, description: str = ""):
        """Register a tool with a decorator"""
        def decorator(func: Callable) -> Callable:
            name = func.__name__
            schema = self._generate_schema(func, description)
            self._tools[name] = schema
            self._handlers[name] = func
            return func
        return decorator

    def _generate_schema(self, func: Callable, description: str) -> dict:
        """Auto-generate JSON schema from function signature"""
        hints = get_type_hints(func)
        sig = inspect.signature(func)
        doc = description or func.__doc__ or f"Execute {func.__name__}"

        properties = {}
        required = []

        for param_name, param in sig.parameters.items():
            if param_name == "self":
                continue

            param_type = hints.get(param_name, str)
            json_type = self._python_type_to_json(param_type)

            properties[param_name] = {
                "type": json_type,
                "description": f"{param_name} parameter",
            }

            if param.default is inspect.Parameter.empty:
                required.append(param_name)

        return {
            "name": func.__name__,
            "description": doc,
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required,
            }
        }

    def _python_type_to_json(self, python_type) -> str:
        """Convert Python type to JSON schema type"""
        type_map = {
            str: "string",
            int: "integer",
            float: "number",
            bool: "boolean",
            list: "array",
            dict: "object",
        }
        return type_map.get(python_type, "string")

    def get_tool_definitions(self) -> list[dict]:
        """Get the list of tool definitions to pass to the API"""
        return list(self._tools.values())

    def execute(self, name: str, input_data: dict) -> str:
        """Execute a tool by name"""
        handler = self._handlers.get(name)
        if not handler:
            return f"Error: Unregistered tool '{name}'"
        try:
            result = handler(**input_data)
            return str(result)
        except Exception as e:
            return f"Error: {type(e).__name__}: {e}"

# Usage example
registry = ToolRegistry()

@registry.tool("Read file contents")
def read_file(path: str, encoding: str = "utf-8") -> str:
    with open(path, encoding=encoding) as f:
        return f.read()

@registry.tool("Get a list of files in the specified directory")
def list_files(directory: str, pattern: str = "*") -> str:
    import glob
    files = glob.glob(f"{directory}/{pattern}")
    return json.dumps(files, ensure_ascii=False)

@registry.tool("Execute an HTTP request")
def http_request(url: str, method: str = "GET") -> str:
    import urllib.request
    req = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode()

# Use in agent
agent = ClaudeAgent(
    config=AgentConfig(system_prompt="Development assistant"),
    tools=registry.get_tool_definitions(),
    handlers=registry._handlers,
)
```

### 4.3 Middleware Pattern

```python
# Middleware that hooks before and after tool calls
from typing import Callable, Optional
import time
import logging

logger = logging.getLogger(__name__)

class ToolMiddleware:
    """Middleware chain for tool execution"""

    def __init__(self):
        self._before_hooks: list[Callable] = []
        self._after_hooks: list[Callable] = []
        self._error_hooks: list[Callable] = []

    def before(self, hook: Callable) -> "ToolMiddleware":
        """Pre-execution hook"""
        self._before_hooks.append(hook)
        return self

    def after(self, hook: Callable) -> "ToolMiddleware":
        """Post-execution hook"""
        self._after_hooks.append(hook)
        return self

    def on_error(self, hook: Callable) -> "ToolMiddleware":
        """Error hook"""
        self._error_hooks.append(hook)
        return self

    def wrap(self, handler: Callable) -> Callable:
        """Wrap a handler with middleware"""
        before_hooks = self._before_hooks
        after_hooks = self._after_hooks
        error_hooks = self._error_hooks

        def wrapped(**kwargs):
            context = {"name": handler.__name__, "input": kwargs, "start": time.time()}

            # Before hooks
            for hook in before_hooks:
                hook(context)

            try:
                result = handler(**kwargs)
                context["result"] = result
                context["duration"] = time.time() - context["start"]

                # After hooks
                for hook in after_hooks:
                    hook(context)

                return result

            except Exception as e:
                context["error"] = e
                context["duration"] = time.time() - context["start"]

                for hook in error_hooks:
                    hook(context)

                raise

        return wrapped

# Practical middleware examples
def logging_hook(context: dict):
    """Log tool calls"""
    if "result" in context:
        logger.info(
            f"Tool {context['name']} completed in {context['duration']:.2f}s"
        )
    elif "error" in context:
        logger.error(
            f"Tool {context['name']} failed: {context['error']}"
        )
    else:
        logger.info(f"Tool {context['name']} starting with {list(context['input'].keys())}")

def rate_limit_hook(context: dict):
    """Rate limit check"""
    # Prevent too many tools from being called in a short time
    time.sleep(0.1)

def sanitize_hook(context: dict):
    """Sanitize input"""
    for key, value in context["input"].items():
        if isinstance(value, str) and any(
            dangerous in value for dangerous in ["rm -rf", "DROP TABLE", "eval("]
        ):
            raise ValueError(f"Dangerous input detected: {key}")

# Apply middleware
middleware = (
    ToolMiddleware()
    .before(sanitize_hook)
    .before(logging_hook)
    .after(logging_hook)
    .on_error(logging_hook)
)

# Wrap handler
safe_read_file = middleware.wrap(read_file)
```

---

## 5. MCP (Model Context Protocol) Integration

### 5.1 MCP Client Basics

```python
# Basic MCP integration pattern
import subprocess
import json
from typing import Optional

class MCPClient:
    """Client for managing communication with MCP servers"""

    def __init__(self, server_command: list[str]):
        self.process = subprocess.Popen(
            server_command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._request_id = 0

    def _send_request(self, method: str, params: dict = None) -> dict:
        """Send a JSON-RPC request"""
        self._request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params or {},
        }
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()

        response_line = self.process.stdout.readline()
        return json.loads(response_line)

    def initialize(self) -> dict:
        """Initialize the MCP server"""
        return self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "claude-agent", "version": "1.0"},
        })

    def list_tools(self) -> list[dict]:
        """Get a list of available tools"""
        response = self._send_request("tools/list")
        return response.get("result", {}).get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        """Call a tool"""
        response = self._send_request("tools/call", {
            "name": name,
            "arguments": arguments,
        })
        result = response.get("result", {})
        content = result.get("content", [])
        return "\n".join(
            item.get("text", "") for item in content if item.get("type") == "text"
        )

    def close(self):
        """Terminate the MCP server"""
        self.process.terminate()
        self.process.wait()
```

### 5.2 Integrating MCP Tools with Claude Tools

```python
# Integrate MCP server tools with Claude tool_use
class MCPIntegratedAgent:
    """Agent that integrates MCP servers with native tools"""

    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = anthropic.Anthropic()
        self.mcp_clients: dict[str, MCPClient] = {}
        self.native_tools: dict[str, dict] = {}
        self.native_handlers: dict[str, Callable] = {}

    def add_mcp_server(self, name: str, command: list[str]):
        """Add an MCP server"""
        mcp = MCPClient(command)
        mcp.initialize()
        self.mcp_clients[name] = mcp

    def add_native_tool(self, tool_def: dict, handler: Callable):
        """Add a native tool"""
        self.native_tools[tool_def["name"]] = tool_def
        self.native_handlers[tool_def["name"]] = handler

    def get_all_tools(self) -> list[dict]:
        """Get all tool definitions (MCP + native)"""
        tools = list(self.native_tools.values())

        for server_name, mcp in self.mcp_clients.items():
            mcp_tools = mcp.list_tools()
            for tool in mcp_tools:
                # Convert MCP tool definition to Claude API format
                tools.append({
                    "name": f"{server_name}__{tool['name']}",
                    "description": tool.get("description", ""),
                    "input_schema": tool.get("inputSchema", {
                        "type": "object", "properties": {}
                    }),
                })

        return tools

    def execute_tool(self, name: str, input_data: dict) -> str:
        """Route to the appropriate handler based on tool name"""
        # Native tools
        if name in self.native_handlers:
            try:
                return str(self.native_handlersname)
            except Exception as e:
                return f"Error: {e}"

        # MCP tools (server_name__tool_name format)
        if "__" in name:
            server_name, tool_name = name.split("__", 1)
            mcp = self.mcp_clients.get(server_name)
            if mcp:
                return mcp.call_tool(tool_name, input_data)

        return f"Unknown tool: {name}"

    def run(self, user_message: str) -> str:
        """Execute the agent loop"""
        messages = [{"role": "user", "content": user_message}]
        tools = self.get_all_tools()

        for step in range(self.config.max_steps):
            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                system=self.config.system_prompt,
                tools=tools,
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self.execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result[:10000],
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return "Maximum number of steps reached"

    def close(self):
        """Terminate all MCP servers"""
        for mcp in self.mcp_clients.values():
            mcp.close()

# Usage example
agent = MCPIntegratedAgent(AgentConfig(
    system_prompt="An assistant that can manipulate the filesystem and database."
))

# Add MCP servers
agent.add_mcp_server("filesystem", ["npx", "@modelcontextprotocol/server-filesystem", "/tmp"])
agent.add_mcp_server("sqlite", ["npx", "@modelcontextprotocol/server-sqlite", "app.db"])

# Add native tools
agent.add_native_tool(
    {"name": "calculate", "description": "Perform a calculation", "input_schema": {
        "type": "object",
        "properties": {"expression": {"type": "string"}},
        "required": ["expression"]
    }},
    handler=lambda expression: eval(expression)  # Use safe_eval in production
)

result = agent.run("Get the number of users from the database and write it to /tmp/report.txt")
print(result)
agent.close()
```

---

## 6. Multi-Agent Orchestration

### 6.1 Orchestrator/Worker Pattern

```python
# Multi-agent: Orchestrator + Workers
from enum import Enum
from typing import Optional
import json

class AgentRole(str, Enum):
    ORCHESTRATOR = "orchestrator"
    CODER = "coder"
    REVIEWER = "reviewer"
    TESTER = "tester"

class MultiAgentSystem:
    """System for coordinating multiple Claude agents"""

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.agents: dict[AgentRole, AgentConfig] = {}
        self.shared_context: dict = {}

    def register_agent(self, role: AgentRole, config: AgentConfig):
        self.agents[role] = config

    def run_agent(self, role: AgentRole, message: str, tools: list = None) -> str:
        """Execute an agent for a specific role"""
        config = self.agents[role]
        messages = [{"role": "user", "content": message}]

        response = self.client.messages.create(
            model=config.model,
            max_tokens=config.max_tokens,
            system=config.system_prompt,
            tools=tools or [],
            messages=messages,
        )

        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""

    def orchestrate(self, task: str) -> dict:
        """Decompose a task and assign it to each agent"""

        # Step 1: Orchestrator decomposes the task
        plan = self.run_agent(
            AgentRole.ORCHESTRATOR,
            f"""Please decompose the following task.
Assign a role of coder/reviewer/tester to each subtask.
Output in JSON format: [{{"role": "coder", "task": "..."}}]

Task: {task}"""
        )

        try:
            subtasks = json.loads(plan)
        except json.JSONDecodeError:
            return {"error": "Task decomposition failed", "raw": plan}

        # Step 2: Execute each subtask
        results = []
        for subtask in subtasks:
            role = AgentRole(subtask["role"])
            result = self.run_agent(role, subtask["task"])
            results.append({
                "role": subtask["role"],
                "task": subtask["task"],
                "result": result,
            })

        # Step 3: Integrate results
        summary = self.run_agent(
            AgentRole.ORCHESTRATOR,
            f"Integrate the following work results and create a report:\n{json.dumps(results, ensure_ascii=False)}"
        )

        return {"subtasks": results, "summary": summary}

# Build the system
system = MultiAgentSystem()

system.register_agent(AgentRole.ORCHESTRATOR, AgentConfig(
    model="claude-sonnet-4-20250514",
    system_prompt="A project manager who decomposes tasks and assigns them to appropriate personnel."
))

system.register_agent(AgentRole.CODER, AgentConfig(
    model="claude-sonnet-4-20250514",
    system_prompt="A senior engineer who writes high-quality code. Focuses on testable design."
))

system.register_agent(AgentRole.REVIEWER, AgentConfig(
    model="claude-sonnet-4-20250514",
    system_prompt="A reviewer who evaluates code quality, security, and performance."
))

system.register_agent(AgentRole.TESTER, AgentConfig(
    model="claude-sonnet-4-20250514",
    system_prompt="A QA engineer who designs and implements test cases."
))

result = system.orchestrate("Implement a user authentication API with FastAPI")
```

### 6.2 Pipeline Pattern

```python
# Pipeline-style multi-agent: output of one agent becomes input of the next
from dataclasses import dataclass
from typing import Callable, Optional

@dataclass
class PipelineStage:
    """Each stage in the pipeline"""
    name: str
    model: str
    system_prompt: str
    transform_output: Optional[Callable[[str], str]] = None

class AgentPipeline:
    """Pipeline that connects agents in series"""

    def __init__(self, stages: list[PipelineStage]):
        self.stages = stages
        self.client = anthropic.Anthropic()
        self.stage_results: list[dict] = []

    def run(self, initial_input: str) -> dict:
        """Execute the pipeline"""
        current_input = initial_input
        self.stage_results = []

        for i, stage in enumerate(self.stages):
            print(f"[Stage {i+1}/{len(self.stages)}] {stage.name}")

            response = self.client.messages.create(
                model=stage.model,
                max_tokens=4096,
                system=stage.system_prompt,
                messages=[{"role": "user", "content": current_input}],
            )

            output = ""
            for block in response.content:
                if hasattr(block, "text"):
                    output = block.text

            if stage.transform_output:
                output = stage.transform_output(output)

            self.stage_results.append({
                "stage": stage.name,
                "input_preview": current_input[:200],
                "output_preview": output[:200],
                "tokens": {
                    "input": response.usage.input_tokens,
                    "output": response.usage.output_tokens,
                },
            })

            current_input = output

        return {
            "final_output": current_input,
            "stages": self.stage_results,
        }

# Usage example: technical document generation pipeline
pipeline = AgentPipeline([
    PipelineStage(
        name="Requirements Analysis",
        model="claude-sonnet-4-20250514",
        system_prompt="Analyze the requirements for a technical document and output a structural plan in JSON format.",
    ),
    PipelineStage(
        name="Draft Creation",
        model="claude-sonnet-4-20250514",
        system_prompt="Create a draft technical document based on the given structural plan.",
    ),
    PipelineStage(
        name="Review and Improvement",
        model="claude-sonnet-4-20250514",
        system_prompt="Review the technical document and output an improved version. Evaluate accuracy, clarity, and completeness.",
    ),
])

result = pipeline.run("Create a guide for deploying microservices on Kubernetes")
print(result["final_output"])
```

---

## 7. Error Handling and Guardrails

### 7.1 Comprehensive Error Handling

```python
# Robust error handling
from anthropic import (
    APIError,
    APIConnectionError,
    RateLimitError,
    APIStatusError,
    AuthenticationError,
    BadRequestError,
)
import time
import logging

logger = logging.getLogger(__name__)

class RobustAgent:
    """Agent with production-quality error handling"""

    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = anthropic.Anthropic()
        self.retry_config = {
            "max_retries": 3,
            "base_delay": 1.0,
            "max_delay": 60.0,
            "backoff_factor": 2.0,
        }

    def _call_api_with_retry(self, **kwargs) -> "Message":
        """API call with retry"""
        last_error = None

        for attempt in range(self.retry_config["max_retries"]):
            try:
                return self.client.messages.create(**kwargs)

            except RateLimitError as e:
                delay = min(
                    self.retry_config["base_delay"] * (
                        self.retry_config["backoff_factor"] ** attempt
                    ),
                    self.retry_config["max_delay"],
                )
                # Use Retry-After header if available
                retry_after = getattr(e, "response", None)
                if retry_after:
                    headers = getattr(retry_after, "headers", {})
                    if "retry-after" in headers:
                        delay = float(headers["retry-after"])

                logger.warning(
                    f"Rate limit (attempt {attempt+1}): "
                    f"retrying in {delay:.1f}s"
                )
                time.sleep(delay)
                last_error = e

            except APIConnectionError as e:
                delay = self.retry_config["base_delay"] * (
                    self.retry_config["backoff_factor"] ** attempt
                )
                logger.warning(f"Connection error (attempt {attempt+1}): {e}")
                time.sleep(delay)
                last_error = e

            except AuthenticationError as e:
                logger.error(f"Authentication error: {e}")
                raise  # Do not retry

            except BadRequestError as e:
                logger.error(f"Request error: {e}")
                raise  # Do not retry

            except APIStatusError as e:
                if e.status_code >= 500:
                    delay = self.retry_config["base_delay"] * (
                        self.retry_config["backoff_factor"] ** attempt
                    )
                    logger.warning(f"Server error {e.status_code} (attempt {attempt+1})")
                    time.sleep(delay)
                    last_error = e
                else:
                    raise  # Do not retry 4xx errors

        raise last_error

    def _safe_execute_tool(self, name: str, input_data: dict) -> dict:
        """Safe tool execution (with timeout and sandbox)"""
        import signal

        def timeout_handler(signum, frame):
            raise TimeoutError("Tool execution timed out")

        # Set timeout
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(30)  # 30-second timeout

        try:
            result = execute_tool(name, input_data)
            return {"content": result[:10000], "is_error": False}
        except TimeoutError:
            return {"content": "Tool execution timed out (30s)", "is_error": True}
        except Exception as e:
            return {"content": f"Error: {type(e).__name__}: {e}", "is_error": True}
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
```

### 7.2 Input Validation and Sandbox

```python
# Tool input validation
from pydantic import BaseModel, Field, validator
from pathlib import Path
import re

class FileReadInput(BaseModel):
    """Input validation for file reading"""
    path: str = Field(..., description="File path")

    @validator("path")
    def validate_path(cls, v):
        # Prevent path traversal attacks
        resolved = Path(v).resolve()
        allowed_dirs = [Path("/workspace"), Path("/tmp")]
        if not any(str(resolved).startswith(str(d)) for d in allowed_dirs):
            raise ValueError(f"Access denied: {resolved}")
        return str(resolved)

class CommandInput(BaseModel):
    """Input validation for command execution"""
    command: str = Field(..., description="Command to execute")

    @validator("command")
    def validate_command(cls, v):
        # Block dangerous commands
        dangerous_patterns = [
            r"rm\s+-rf\s+/",
            r"mkfs\.",
            r"dd\s+if=",
            r":()\{",  # fork bomb
            r">\s*/dev/sd",
            r"curl.*\|\s*bash",
            r"wget.*\|\s*sh",
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, v):
                raise ValueError(f"Dangerous command pattern detected: {pattern}")
        return v

# Tool execution with validation
def validated_execute_tool(name: str, input_data: dict) -> str:
    """Tool execution with input validation"""
    validators = {
        "read_file": FileReadInput,
        "run_command": CommandInput,
    }

    validator_cls = validators.get(name)
    if validator_cls:
        try:
            validated = validator_cls(**input_data)
            input_data = validated.dict()
        except Exception as e:
            return f"Validation error: {e}"

    return execute_tool(name, input_data)
```

### 7.3 Implementing Guardrails

```python
# Content guardrails
class ContentGuardrail:
    """Guardrails for checking agent output"""

    def __init__(self):
        self.checks: list[Callable[[str], Optional[str]]] = []

    def add_check(self, check: Callable[[str], Optional[str]]):
        """Add a check function. Returns an error message if a problem is found."""
        self.checks.append(check)

    def validate(self, content: str) -> tuple[bool, list[str]]:
        """Validate content"""
        errors = []
        for check in self.checks:
            error = check(content)
            if error:
                errors.append(error)
        return len(errors) == 0, errors

# Guardrail definitions
guardrail = ContentGuardrail()

def check_no_secrets(content: str) -> Optional[str]:
    """Check for secret information leakage"""
    patterns = [
        (r"(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}", "AWS access key"),
        (r"sk-[a-zA-Z0-9]{20,}", "API key"),
        (r"ghp_[a-zA-Z0-9]{36}", "GitHub token"),
        (r"-----BEGIN (?:RSA )?PRIVATE KEY-----", "Private key"),
    ]
    for pattern, name in patterns:
        if re.search(pattern, content):
            return f"Secret information leakage detected: {name}"
    return None

def check_no_pii(content: str) -> Optional[str]:
    """Check for personally identifiable information"""
    patterns = [
        (r"\b\d{3}-\d{4}-\d{4}\b", "Phone number"),
        (r"\b\d{3}-\d{2}-\d{4}\b", "SSN"),
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "Email address"),
    ]
    for pattern, name in patterns:
        if re.search(pattern, content):
            return f"PII detected: {name}"
    return None

def check_max_length(content: str) -> Optional[str]:
    """Output length check"""
    if len(content) > 50000:
        return f"Output is too long: {len(content)} characters"
    return None

guardrail.add_check(check_no_secrets)
guardrail.add_check(check_no_pii)
guardrail.add_check(check_max_length)

# Check agent output
def guarded_agent(user_message: str) -> str:
    result = agent_loop(user_message)

    is_valid, errors = guardrail.validate(result)
    if not is_valid:
        logger.warning(f"Guardrail violation: {errors}")
        return "We're sorry, but a security issue was detected in the response."

    return result
```

---

## 8. Context Management and Conversation Memory

### 8.1 Token Counting and Budget Management

```python
# Tracking token usage and managing budgets
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class TokenBudget:
    """Budget management for token usage"""
    max_input_tokens: int = 150_000  # Limit to 75% of 200K
    max_output_tokens_per_turn: int = 4096
    max_total_cost_usd: float = 1.0  # Cost limit for the entire session

    # Cumulative values
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    api_calls: int = 0

    def record_usage(self, input_tokens: int, output_tokens: int, model: str):
        """Record usage"""
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.api_calls += 1

        # Cost calculation (unit price per model)
        cost_map = {
            "claude-haiku-4-20250514": (0.00025, 0.00125),
            "claude-sonnet-4-20250514": (0.003, 0.015),
            "claude-opus-4-20250514": (0.015, 0.075),
        }
        input_rate, output_rate = cost_map.get(model, (0.003, 0.015))
        cost = (input_tokens * input_rate + output_tokens * output_rate) / 1000
        self.total_cost_usd += cost

    def check_budget(self) -> tuple[bool, str]:
        """Budget check"""
        if self.total_cost_usd >= self.max_total_cost_usd:
            return False, f"Cost limit exceeded: ${self.total_cost_usd:.4f} >= ${self.max_total_cost_usd}"
        return True, "OK"

    def get_report(self) -> dict:
        """Usage report"""
        return {
            "api_calls": self.api_calls,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "budget_remaining_usd": round(self.max_total_cost_usd - self.total_cost_usd, 6),
        }
```

### 8.2 Compressing Conversation History

```python
# Conversation history compression strategies
class ConversationManager:
    """Manager for efficiently managing conversation history"""

    def __init__(self, max_messages: int = 50, summarize_threshold: int = 30):
        self.messages: list[dict] = []
        self.max_messages = max_messages
        self.summarize_threshold = summarize_threshold
        self.client = anthropic.Anthropic()
        self.summaries: list[str] = []

    def add_message(self, role: str, content):
        """Add a message"""
        self.messages.append({"role": role, "content": content})

        # Compress when threshold is exceeded
        if len(self.messages) >= self.summarize_threshold:
            self._compress()

    def _compress(self):
        """Summarize and compress old conversations"""
        # Summarize the first half
        half = len(self.messages) // 2
        old_messages = self.messages[:half]

        # Generate summary
        summary_text = self._summarize(old_messages)
        self.summaries.append(summary_text)

        # Replace with summary
        summary_message = {
            "role": "user",
            "content": f"[Summary of conversation so far]\n{summary_text}"
        }
        self.messages = [summary_message] + self.messages[half:]

    def _summarize(self, messages: list[dict]) -> str:
        """Summarize a list of messages"""
        # Convert messages to text
        text_parts = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if isinstance(content, str):
                text_parts.append(f"{role}: {content[:500]}")
            elif isinstance(content, list):
                # Tool results etc.
                text_parts.append(f"{role}: [tool operation]")

        conversation_text = "\n".join(text_parts)

        response = self.client.messages.create(
            model="claude-haiku-4-20250514",  # Use inexpensive model for summaries
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"Summarize the following conversation in 200 words or less:\n{conversation_text}"
            }]
        )

        return response.content[0].text

    def get_messages(self) -> list[dict]:
        """Return the current message list"""
        return self.messages.copy()
```

### 8.3 Sliding Window Strategy

```python
# Context management with a sliding window
class SlidingWindowManager:
    """Manage messages with a fixed-size window"""

    def __init__(self, window_size: int = 20, keep_system: bool = True):
        self.window_size = window_size
        self.keep_system = keep_system
        self.all_messages: list[dict] = []
        self.pinned_messages: list[dict] = []  # Messages to always retain

    def add(self, message: dict):
        self.all_messages.append(message)

    def pin(self, message: dict):
        """Add a message to always retain"""
        self.pinned_messages.append(message)

    def get_window(self) -> list[dict]:
        """Get messages within the current window"""
        # Pinned messages + latest N items
        recent = self.all_messages[-self.window_size:]

        # Adjust so that assistant/user pairs are not broken
        if recent and recent[0]["role"] == "assistant":
            recent = recent[1:]  # Remove if starting with assistant

        return self.pinned_messages + recent

    def estimate_tokens(self) -> int:
        """Estimate the token count of the current window"""
        total_chars = sum(
            len(str(m.get("content", ""))) for m in self.get_window()
        )
        return total_chars // 4  # Rough estimate (approx. 4 chars per token)
```

---

## 9. Async Agent

### 9.1 Fully Async Implementation

```python
# Fully async agent implementation
import anthropic
import asyncio
from typing import AsyncIterator

class AsyncClaudeAgent:
    """Async version of the Claude agent"""

    def __init__(self, config: AgentConfig, tools: list, handlers: dict):
        self.config = config
        self.tools = tools
        self.handlers = handlers
        self.client = anthropic.AsyncAnthropic()

    async def run(self, user_message: str) -> str:
        """Execute the agent loop asynchronously"""
        messages = [{"role": "user", "content": user_message}]

        for step in range(self.config.max_steps):
            response = await self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                system=self.config.system_prompt,
                tools=self.tools,
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                return self._extract_text(response)

            tool_results = await self._process_tools_async(response)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return "Maximum number of steps reached"

    async def run_streaming(self, user_message: str) -> AsyncIterator[str]:
        """Async execution with streaming"""
        messages = [{"role": "user", "content": user_message}]

        while True:
            async with self.client.messages.stream(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                system=self.config.system_prompt,
                tools=self.tools,
                messages=messages,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            yield event.delta.text

                response = await stream.get_final_message()

            if response.stop_reason == "end_turn":
                return

            tool_results = await self._process_tools_async(response)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

    async def _process_tools_async(self, response) -> list:
        """Async tool processing"""
        tasks = []
        for block in response.content:
            if block.type == "tool_use":
                tasks.append(self._execute_tool_async(block))

        results = await asyncio.gather(*tasks)
        return list(results)

    async def _execute_tool_async(self, block) -> dict:
        """Async execution of a single tool"""
        handler = self.handlers.get(block.name)
        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**block.input)
            else:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: handler(**block.input))
        except Exception as e:
            result = f"Error: {e}"

        return {
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": str(result)[:10000],
        }

    def _extract_text(self, response) -> str:
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""

# Usage example
async def main():
    agent = AsyncClaudeAgent(
        config=AgentConfig(system_prompt="Async development assistant"),
        tools=TOOLS,
        handlers={"read_file": read_file, "run_command": run_command},
    )

    # Normal async execution
    result = await agent.run("Tell me about the project structure")
    print(result)

    # Streaming execution
    async for chunk in agent.run_streaming("Run the tests"):
        print(chunk, end="", flush=True)

asyncio.run(main())
```

---

## 10. Monitoring and Observability

### 10.1 Structured Logging and Metrics

```python
# Agent monitoring
import time
import json
import logging
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

@dataclass
class AgentMetrics:
    """Metrics for agent execution"""
    session_id: str = ""
    start_time: float = 0.0
    end_time: float = 0.0
    total_steps: int = 0
    api_calls: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    tool_calls: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    total_cost_usd: float = 0.0

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "duration_seconds": round(self.end_time - self.start_time, 2),
            "total_steps": self.total_steps,
            "api_calls": self.api_calls,
            "tokens": {
                "input": self.total_input_tokens,
                "output": self.total_output_tokens,
                "total": self.total_input_tokens + self.total_output_tokens,
            },
            "tool_calls": self.tool_calls,
            "errors": self.errors,
            "cost_usd": round(self.total_cost_usd, 6),
        }

class MonitoredAgent:
    """Agent with metrics collection"""

    def __init__(self, config: AgentConfig, tools: list, handlers: dict):
        self.config = config
        self.tools = tools
        self.handlers = handlers
        self.client = anthropic.Anthropic()
        self.logger = logging.getLogger("agent")
        self.metrics: Optional[AgentMetrics] = None

    def run(self, user_message: str) -> tuple[str, AgentMetrics]:
        """Execute with metrics"""
        import uuid
        self.metrics = AgentMetrics(
            session_id=str(uuid.uuid4())[:8],
            start_time=time.time(),
        )

        messages = [{"role": "user", "content": user_message}]

        try:
            result = self._agent_loop(messages)
        except Exception as e:
            self.metrics.errors.append({
                "type": type(e).__name__,
                "message": str(e),
                "step": self.metrics.total_steps,
            })
            result = f"Aborted due to error: {e}"
        finally:
            self.metrics.end_time = time.time()

        self.logger.info(
            "Agent completed",
            extra={"metrics": self.metrics.to_dict()}
        )

        return result, self.metrics

    def _agent_loop(self, messages: list) -> str:
        for step in range(self.config.max_steps):
            self.metrics.total_steps = step + 1

            step_start = time.time()
            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                system=self.config.system_prompt,
                tools=self.tools,
                messages=messages,
            )
            api_latency = time.time() - step_start

            # Record metrics
            self.metrics.api_calls += 1
            self.metrics.total_input_tokens += response.usage.input_tokens
            self.metrics.total_output_tokens += response.usage.output_tokens

            self.logger.debug(
                f"Step {step}: stop_reason={response.stop_reason}, "
                f"tokens={response.usage.input_tokens}+{response.usage.output_tokens}, "
                f"latency={api_latency:.2f}s"
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            # Tool processing
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    tool_start = time.time()
                    result = execute_tool(block.name, block.input)
                    tool_duration = time.time() - tool_start

                    self.metrics.tool_calls.append({
                        "name": block.name,
                        "duration_seconds": round(tool_duration, 3),
                        "result_length": len(result),
                        "step": step,
                    })

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result[:10000],
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return "Maximum number of steps reached"

# Usage example
agent = MonitoredAgent(
    config=AgentConfig(system_prompt="Development assistant"),
    tools=TOOLS,
    handlers={"read_file": read_file},
)
result, metrics = agent.run("Read setup.py and explain its contents")
print(json.dumps(metrics.to_dict(), indent=2, ensure_ascii=False))
```

### 10.2 Integration with OpenTelemetry

```python
# Tracing with OpenTelemetry
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter
from opentelemetry.trace import StatusCode

# Tracer configuration
provider = TracerProvider()
processor = SimpleSpanProcessor(ConsoleSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("claude-agent")

class TracedAgent:
    """Agent with OpenTelemetry tracing"""

    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = anthropic.Anthropic()

    def run(self, user_message: str) -> str:
        with tracer.start_as_current_span("agent.run") as span:
            span.set_attribute("agent.model", self.config.model)
            span.set_attribute("agent.max_steps", self.config.max_steps)
            span.set_attribute("input.length", len(user_message))

            messages = [{"role": "user", "content": user_message}]

            for step in range(self.config.max_steps):
                with tracer.start_as_current_span(f"agent.step.{step}") as step_span:
                    # API call
                    with tracer.start_as_current_span("api.messages.create") as api_span:
                        response = self.client.messages.create(
                            model=self.config.model,
                            max_tokens=self.config.max_tokens,
                            system=self.config.system_prompt,
                            tools=TOOLS,
                            messages=messages,
                        )
                        api_span.set_attribute("tokens.input", response.usage.input_tokens)
                        api_span.set_attribute("tokens.output", response.usage.output_tokens)
                        api_span.set_attribute("stop_reason", response.stop_reason)

                    if response.stop_reason == "end_turn":
                        result = self._extract_text(response)
                        span.set_attribute("output.length", len(result))
                        span.set_attribute("total_steps", step + 1)
                        return result

                    # Tool processing
                    tool_results = []
                    for block in response.content:
                        if block.type == "tool_use":
                            with tracer.start_as_current_span(
                                f"tool.{block.name}"
                            ) as tool_span:
                                tool_span.set_attribute("tool.input", json.dumps(block.input)[:200])
                                try:
                                    result = execute_tool(block.name, block.input)
                                    tool_span.set_attribute("tool.result_length", len(result))
                                except Exception as e:
                                    tool_span.set_status(StatusCode.ERROR)
                                    tool_span.record_exception(e)
                                    result = f"Error: {e}"

                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": result[:10000],
                                })

                    messages.append({"role": "assistant", "content": response.content})
                    messages.append({"role": "user", "content": tool_results})

            span.set_status(StatusCode.ERROR, "Maximum steps exceeded")
            return "Maximum number of steps reached"

    def _extract_text(self, response) -> str:
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""
```

---

## 11. Architecture Diagrams

```
Claude Agent SDK-Based Agent Configuration

+------------------------------------------------------+
|                    Application                        |
|                                                        |
|  +--------------------------------------------------+|
|  |            ClaudeAgent                            ||
|  |                                                    ||
|  |  +--------+  +----------+  +---------+           ||
|  |  | Config |  | History  |  | Metrics |           ||
|  |  +--------+  +----------+  +---------+           ||
|  |       |                                           ||
|  |  +----v----+                                      ||
|  |  | Agent   |  messages.create()                   ||
|  |  | Loop    |<--------------------> Anthropic API  ||
|  |  +----+----+                                      ||
|  |       |                                           ||
|  |  +----v-----------+                               ||
|  |  | Tool Dispatcher |                              ||
|  |  +----+-----------+                               ||
|  |       |     |     |                               ||
|  |  +----v+ +--v--+ +v------+                        ||
|  |  |File | |Shell| |MCP    |                        ||
|  |  |Ops  | |Exec | |Client |                        ||
|  |  +-----+ +-----+ +---+---+                        ||
|  |                       |                            ||
|  +--------------------------------------------------+||
|                          |                             |
+------------------------------------------------------+
                           v
                    +------+------+
                    | MCP Servers |
                    +-------------+
```

```
Multi-Agent Orchestration Configuration

+----------------------------------------------------------+
|                    Orchestrator Agent                      |
|  (Task decomposition, assignment, result integration)      |
+----+-------------------+-------------------+--------------+
     |                   |                   |
     v                   v                   v
+----------+      +----------+        +----------+
| Coder    |      | Reviewer |        | Tester   |
| Agent    |      | Agent    |        | Agent    |
+----+-----+      +----+-----+        +----+-----+
     |                  |                   |
     v                  v                   v
+----------+      +----------+        +----------+
| File Ops |      | Code     |        | Test     |
| Shell    |      | Analysis |        | Runner   |
| MCP      |      | Tools    |        | Tools    |
+----------+      +----------+        +----------+
```

---

## 12. Comparison Tables

### 12.1 Claude SDK Usage Patterns

| Pattern | Code Volume | Flexibility | Complexity | Use Case |
|---------|-------------|-------------|------------|----------|
| Direct API call | Minimal | Highest | Low | Simple tool use |
| Class-based | Medium | High | Medium | Reusable agents |
| MCP integration | Medium-High | High | Medium-High | Tool sharing |
| Multi-agent | High | High | High | Complex tasks |
| Pipeline | Medium | Medium | Low-Medium | Staged processing |
| Async | Medium | High | Medium | High-throughput needs |

### 12.2 Model Selection Guide

| Model | Cost | Speed | Reasoning | Use Case |
|-------|------|-------|-----------|----------|
| Claude Haiku | Lowest | Fastest | Basic | Classification, routing, summarization |
| Claude Sonnet | Medium | Fast | High | General agents, coding |
| Claude Opus | High | Slow | Highest | Complex reasoning, design, critical decisions |

### 12.3 Error Handling Strategies

| Error Type | Retry | Approach | Notes |
|------------|-------|----------|-------|
| RateLimitError | Yes | Exponential backoff | Check Retry-After header |
| APIConnectionError | Yes | Exponential backoff | Temporary network failure |
| AuthenticationError | No | Check API key | Return error immediately |
| BadRequestError | No | Fix input | Message format issue |
| 5xx Server Error | Yes | Exponential backoff | Server-side issue |
| ToolTimeoutError | Conditional | Extend timeout or skip | Tool-dependent |

---

## 13. Production Deployment Patterns

### 13.1 Integration with FastAPI

```python
# Expose agent as API with FastAPI
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import uuid

app = FastAPI(title="Claude Agent API")

class AgentRequest(BaseModel):
    message: str
    system_prompt: str = "You are a capable AI assistant."
    max_steps: int = 10
    model: str = "claude-sonnet-4-20250514"

class AgentResponse(BaseModel):
    session_id: str
    result: str
    metrics: dict

# Session management
sessions: dict[str, dict] = {}

@app.post("/agent/run", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    """Execute agent synchronously"""
    session_id = str(uuid.uuid4())[:8]

    config = AgentConfig(
        model=request.model,
        max_steps=request.max_steps,
        system_prompt=request.system_prompt,
    )

    agent = MonitoredAgent(config=config, tools=TOOLS, handlers={
        "read_file": read_file,
        "write_file": write_file,
        "run_command": run_command,
    })

    result, metrics = agent.run(request.message)

    sessions[session_id] = {
        "result": result,
        "metrics": metrics.to_dict(),
    }

    return AgentResponse(
        session_id=session_id,
        result=result,
        metrics=metrics.to_dict(),
    )

@app.post("/agent/stream")
async def stream_agent(request: AgentRequest):
    """Execute agent with streaming"""
    async_agent = AsyncClaudeAgent(
        config=AgentConfig(
            model=request.model,
            max_steps=request.max_steps,
            system_prompt=request.system_prompt,
        ),
        tools=TOOLS,
        handlers={"read_file": read_file},
    )

    async def generate():
        async for chunk in async_agent.run_streaming(request.message):
            yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session information"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]
```

### 13.2 Queuing and Background Processing

```python
# Background agent execution with Celery
from celery import Celery
import redis

celery_app = Celery("agent_tasks", broker="redis://localhost:6379/0")
redis_client = redis.Redis(host="localhost", port=6379, db=1)

@celery_app.task(bind=True, max_retries=2)
def run_agent_task(self, task_id: str, message: str, config_dict: dict):
    """Execute an agent task in the background"""
    try:
        # Notify progress
        redis_client.hset(f"task:{task_id}", "status", "running")

        config = AgentConfig(**config_dict)
        agent = MonitoredAgent(config=config, tools=TOOLS, handlers={
            "read_file": read_file,
            "write_file": write_file,
            "run_command": run_command,
        })

        result, metrics = agent.run(message)

        # Save results
        redis_client.hset(f"task:{task_id}", mapping={
            "status": "completed",
            "result": result,
            "metrics": json.dumps(metrics.to_dict(), ensure_ascii=False),
        })
        redis_client.expire(f"task:{task_id}", 3600)  # Keep for 1 hour

        return {"task_id": task_id, "status": "completed"}

    except Exception as e:
        redis_client.hset(f"task:{task_id}", mapping={
            "status": "failed",
            "error": str(e),
        })
        raise self.retry(exc=e, countdown=5)

# Submit task and check status
def submit_agent_task(message: str) -> str:
    task_id = str(uuid.uuid4())[:8]
    redis_client.hset(f"task:{task_id}", "status", "queued")

    run_agent_task.delay(
        task_id=task_id,
        message=message,
        config_dict={"model": "claude-sonnet-4-20250514", "max_steps": 20},
    )
    return task_id

def check_task_status(task_id: str) -> dict:
    data = redis_client.hgetall(f"task:{task_id}")
    return {k.decode(): v.decode() for k, v in data.items()}
```

---

## 14. Anti-Patterns

### Anti-Pattern 1: Unbounded Accumulation of Conversation History

```python
# BAD: History grows indefinitely, causing context overflow
messages = []
while True:
    messages.append(...)  # Keeps growing

# GOOD: Manage history (summarization or sliding window)
MAX_HISTORY = 50

def manage_history(messages: list) -> list:
    if len(messages) > MAX_HISTORY:
        summary = summarize(messages[:MAX_HISTORY//2])
        return [
            {"role": "user", "content": f"Summary so far: {summary}"},
            *messages[MAX_HISTORY//2:]
        ]
    return messages
```

### Anti-Pattern 2: Unlimited Tool Result Size

```python
# BAD: Return huge file contents as-is
def read_file(path):
    with open(path) as f:
        return f.read()  # Could be a 100MB file

# GOOD: Size limits and summarization
def read_file(path, max_chars=10000):
    with open(path) as f:
        content = f.read()
    if len(content) > max_chars:
        return content[:max_chars] + f"\n... ({len(content)-max_chars} characters omitted)"
    return content
```

### Anti-Pattern 3: Ignoring Errors in Tool Execution

```python
# BAD: Swallow errors silently
def execute_tool(name, input_data):
    try:
        return do_something(name, input_data)
    except:
        return ""  # Return empty string as if nothing happened

# GOOD: Return errors explicitly
def execute_tool(name, input_data):
    try:
        return do_something(name, input_data)
    except Exception as e:
        return json.dumps({
            "error": True,
            "type": type(e).__name__,
            "message": str(e),
            "tool": name,
        }, ensure_ascii=False)
```

### Anti-Pattern 4: Unlimited Step Count

```python
# BAD: Possibility of infinite loop
def agent_loop(message):
    while True:  # May run forever
        response = call_api(message)
        if response.stop_reason == "end_turn":
            return response

# GOOD: Step limit + timeout
def agent_loop(message, max_steps=20, timeout=300):
    start = time.time()
    for step in range(max_steps):
        if time.time() - start > timeout:
            return "Timed out"
        response = call_api(message)
        if response.stop_reason == "end_turn":
            return response
    return "Maximum steps exceeded"
```

### Anti-Pattern 5: Processing Everything with a Single Model

```python
# BAD: Use expensive model for all tasks
def process_all(tasks):
    for task in tasks:
        result = client.messages.create(
            model="claude-opus-4-20250514",  # All Opus is high cost
            ...
        )

# GOOD: Select model based on task
MODEL_ROUTING = {
    "classify": "claude-haiku-4-20250514",     # Classification with cheap model
    "summarize": "claude-haiku-4-20250514",    # Summarization also cheap
    "generate": "claude-sonnet-4-20250514",    # Generation at medium level
    "reason": "claude-opus-4-20250514",        # Complex reasoning only at high quality
}

def smart_process(task_type, content):
    model = MODEL_ROUTING.get(task_type, "claude-sonnet-4-20250514")
    return client.messages.create(model=model, ...)
```

---

## 15. Testing Patterns

### 15.1 Unit Testing the Agent

```python
# Agent tests
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import json

class TestClaudeAgent:
    """Unit tests for ClaudeAgent"""

    def setup_method(self):
        self.config = AgentConfig(
            model="claude-sonnet-4-20250514",
            max_steps=5,
            system_prompt="Test prompt",
        )

    @patch("anthropic.Anthropic")
    def test_simple_response(self, mock_anthropic_cls):
        """Simple response without tool use"""
        # Set up mock
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        mock_response = MagicMock()
        mock_response.stop_reason = "end_turn"
        mock_response.content = [MagicMock(text="Test answer", type="text")]
        mock_response.content[0].text = "Test answer"
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50

        mock_client.messages.create.return_value = mock_response

        agent = ClaudeAgent(self.config, tools=[], handlers={})
        result = agent.run("Test question")

        assert result == "Test answer"
        mock_client.messages.create.assert_called_once()

    @patch("anthropic.Anthropic")
    def test_tool_use_and_response(self, mock_anthropic_cls):
        """Return response after tool use"""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        # First call: tool call
        tool_response = MagicMock()
        tool_response.stop_reason = "tool_use"
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.name = "read_file"
        tool_block.id = "tool_123"
        tool_block.input = {"path": "test.py"}
        tool_response.content = [tool_block]
        tool_response.usage.input_tokens = 100
        tool_response.usage.output_tokens = 50

        # Second call: final answer
        final_response = MagicMock()
        final_response.stop_reason = "end_turn"
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "File contents: hello"
        final_response.content = [text_block]
        final_response.usage.input_tokens = 200
        final_response.usage.output_tokens = 80

        mock_client.messages.create.side_effect = [tool_response, final_response]

        # Handler
        handlers = {"read_file": lambda path: "hello"}

        agent = ClaudeAgent(self.config, tools=TOOLS, handlers=handlers)
        result = agent.run("Read test.py")

        assert "hello" in result
        assert mock_client.messages.create.call_count == 2

    @patch("anthropic.Anthropic")
    def test_max_steps_exceeded(self, mock_anthropic_cls):
        """Maximum steps exceeded"""
        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client

        # Always return a tool call (infinite loop)
        tool_response = MagicMock()
        tool_response.stop_reason = "tool_use"
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.name = "read_file"
        tool_block.id = "tool_123"
        tool_block.input = {"path": "test.py"}
        tool_response.content = [tool_block]
        tool_response.usage.input_tokens = 100
        tool_response.usage.output_tokens = 50

        mock_client.messages.create.return_value = tool_response

        config = AgentConfig(max_steps=3)
        agent = ClaudeAgent(config, tools=TOOLS, handlers={
            "read_file": lambda path: "content"
        })
        result = agent.run("Test")

        assert "Maximum" in result
        assert mock_client.messages.create.call_count == 3

class TestToolRegistry:
    """Tests for ToolRegistry"""

    def test_tool_registration(self):
        """Test tool registration"""
        registry = ToolRegistry()

        @registry.tool("Test tool")
        def my_tool(name: str, count: int = 1) -> str:
            return f"{name} x {count}"

        tools = registry.get_tool_definitions()
        assert len(tools) == 1
        assert tools[0]["name"] == "my_tool"
        assert "name" in tools[0]["input_schema"]["properties"]
        assert "name" in tools[0]["input_schema"]["required"]
        assert "count" not in tools[0]["input_schema"]["required"]

    def test_tool_execution(self):
        """Test tool execution"""
        registry = ToolRegistry()

        @registry.tool()
        def add(a: int, b: int) -> int:
            return a + b

        result = registry.execute("add", {"a": 3, "b": 5})
        assert result == "8"

    def test_unknown_tool(self):
        """Execution of unregistered tool"""
        registry = ToolRegistry()
        result = registry.execute("unknown", {})
        assert "Unregistered" in result
```

### 15.2 Integration Tests

```python
# Integration tests for agents
import pytest
import tempfile
import os

class TestAgentIntegration:
    """Integration tests using the actual API"""

    @pytest.fixture
    def agent(self):
        config = AgentConfig(
            model="claude-haiku-4-20250514",  # Use inexpensive model for tests
            max_steps=5,
            system_prompt="Test assistant. Please respond concisely.",
        )
        return ClaudeAgent(config, tools=TOOLS, handlers={
            "read_file": lambda path: open(path).read(),
            "write_file": lambda path, content: open(path, "w").write(content) or "OK",
        })

    @pytest.mark.integration
    def test_file_read_agent(self, agent):
        """E2E test for file reading agent"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("Test data: 42")
            temp_path = f.name

        try:
            result = agent.run(f"Read {temp_path} and tell me its contents")
            assert "42" in result or "Test data" in result
        finally:
            os.unlink(temp_path)

    @pytest.mark.integration
    def test_agent_timeout(self, agent):
        """Timeout test"""
        agent.config.timeout = 0.001  # Extremely short timeout
        result = agent.run("Do a complex calculation")
        assert "Timed out" in result or len(result) > 0
```

---

## 16. FAQ

### Q1: Should I use extended thinking in agents?

Extended thinking is effective for complex reasoning tasks, but caution is needed in agents:
- **Advantages**: Improved quality for planning, complex bug fixing
- **Caveats**: Increased latency, constraints on combining with tool use
- **Recommendation**: Enable extended thinking only for the planning phase, disable for the tool execution phase

### Q2: How do I handle rate limits?

```python
import time
from anthropic import RateLimitError

def call_with_retry(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError:
            wait = 2 ** attempt
            time.sleep(wait)
    raise Exception("Rate limit exceeded")
```

### Q3: How do I switch between multiple Claude models within an agent?

```python
# Use inexpensive model for routing, high-quality model for generation
ROUTING_MODEL = "claude-haiku-4-20250514"
GENERATION_MODEL = "claude-sonnet-4-20250514"

def smart_agent(query):
    # Step 1: Classify with fast model
    category = client.messages.create(
        model=ROUTING_MODEL, ...
    )
    # Step 2: Answer with high-quality model
    answer = client.messages.create(
        model=GENERATION_MODEL, ...
    )
```

### Q4: How do I use the context window efficiently?

```python
# Three strategies for context optimization

# 1. Truncate tool results
def truncate_result(result: str, max_chars: int = 5000) -> str:
    if len(result) <= max_chars:
        return result
    # Keep beginning and end
    head = result[:max_chars // 2]
    tail = result[-(max_chars // 2):]
    return f"{head}\n\n... ({len(result) - max_chars} characters omitted) ...\n\n{tail}"

# 2. Remove unnecessary intermediate results
def clean_history(messages: list) -> list:
    """Compress old tool results"""
    cleaned = []
    for msg in messages:
        if msg["role"] == "user" and isinstance(msg["content"], list):
            # Shorten tool results
            shortened = []
            for item in msg["content"]:
                if item.get("type") == "tool_result":
                    content = item.get("content", "")
                    if len(content) > 500:
                        item = {**item, "content": content[:500] + "...(omitted)"}
                shortened.append(item)
            cleaned.append({"role": "user", "content": shortened})
        else:
            cleaned.append(msg)
    return cleaned

# 3. Semantic cache
class SemanticCache:
    """Cache for similar queries"""
    def __init__(self):
        self.cache: dict[str, str] = {}

    def get(self, query: str) -> str | None:
        # Simple key matching (use embeddings in production)
        normalized = query.lower().strip()
        return self.cache.get(normalized)

    def set(self, query: str, response: str):
        normalized = query.lower().strip()
        self.cache[normalized] = response
```

### Q5: How do I debug an agent?

```python
# Debug mode agent
import sys

class DebugAgent(ClaudeAgent):
    """Agent that outputs debug information"""

    def __init__(self, *args, verbose: bool = True, **kwargs):
        super().__init__(*args, **kwargs)
        self.verbose = verbose

    def run(self, user_message: str) -> str:
        if self.verbose:
            print(f"=== Agent Start ===", file=sys.stderr)
            print(f"Model: {self.config.model}", file=sys.stderr)
            print(f"Message: {user_message[:100]}...", file=sys.stderr)
            print(f"Tools: {[t['name'] for t in self.tools]}", file=sys.stderr)

        result = super().run(user_message)

        if self.verbose:
            print(f"=== Agent End ===", file=sys.stderr)
            print(f"Steps: {len(self.conversation_history) // 2}", file=sys.stderr)
            print(f"Result length: {len(result)}", file=sys.stderr)

        return result
```

### Q6: How do I efficiently process large volumes of requests with the Batch API?

```python
# Batch processing with the Batch API
import anthropic
import json

def create_batch_requests(tasks: list[dict]) -> list[dict]:
    """Create batch requests"""
    requests = []
    for i, task in enumerate(tasks):
        requests.append({
            "custom_id": f"task-{i}",
            "params": {
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": task["prompt"]}],
            }
        })
    return requests

def submit_batch(requests: list[dict]) -> str:
    """Submit a batch"""
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=requests)
    return batch.id

def check_batch_status(batch_id: str) -> dict:
    """Check batch status"""
    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(batch_id)
    return {
        "id": batch.id,
        "status": batch.processing_status,
        "created_at": str(batch.created_at),
        "request_counts": {
            "processing": batch.request_counts.processing,
            "succeeded": batch.request_counts.succeeded,
            "errored": batch.request_counts.errored,
        },
    }
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Content |
|------|---------|
| Basic loop | messages.create → check stop_reason → execute tools → repeat |
| Streaming | Real-time output with messages.stream |
| Parallel tools | Multiple tool_use blocks in a single response |
| MCP integration | Use MCP server tools directly |
| Multi-agent | Orchestrator + workers / pipeline |
| Error handling | Exponential backoff + validation + guardrails |
| Monitoring | Structured logging + metrics + OpenTelemetry |
| Context management | Sliding window + history compression |
| Testing | Unit tests (mocks) + integration tests |
| Design principles | Minimal code, explicit control, safe defaults |

## What to Read Next

- [04-evaluation.md](./04-evaluation.md) -- Agent evaluation methods
- [02-mcp-agents.md](./02-mcp-agents.md) -- MCP integration details
- [../04-production/00-deployment.md](../04-production/00-deployment.md) -- Deployment and scaling

## References

1. Anthropic, "Claude API Reference" -- https://docs.anthropic.com/en/api/
2. Anthropic, "Building effective agents" -- https://docs.anthropic.com/en/docs/build-with-claude/agentic
3. anthropic-sdk-python GitHub -- https://github.com/anthropics/anthropic-sdk-python
4. Anthropic, "Tool use (function calling)" -- https://docs.anthropic.com/en/docs/build-with-claude/tool-use
5. Anthropic, "Extended thinking" -- https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
