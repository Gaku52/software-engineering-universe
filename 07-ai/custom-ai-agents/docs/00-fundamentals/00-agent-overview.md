# AI Agent Overview

> A software system that uses an LLM as its brain and tools as its hands and feet, autonomously executing tasks — this guide provides a systematic explanation of AI agent definitions, types, and architectures.

## What You Will Learn

1. The definition of AI agents and their fundamental differences from traditional chatbots
2. The five major architectural patterns for agents and how to choose among them
3. The internal structure and implementation principles of the agent loop (Perceive-Think-Act)


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. What Is an AI Agent?

### 1.1 Definition

An AI agent is **a system that, when given a goal, observes its environment, reasons, and takes actions using tools**. While a traditional chatbot completes a single turn of "question → answer," an agent has a loop that **autonomously plans, executes, and evaluates multiple steps**.

```
Traditional chatbot:
  User → [LLM] → Answer (single turn)

AI Agent:
  User → [Plan] → [Tool execution] → [Observe result] → [Re-plan] → ... → Final answer
```

### 1.2 The Three Elements of an Agent

```
+---------------------------------------------------+
|                    AI Agent                        |
|                                                     |
|  +-------------+  +-----------+  +---------------+  |
|  |   Brain     |  |  Memory   |  |    Tools      |  |
|  |  (LLM)      |  | (Memory)  |  |  (Tools)      |  |
|  |             |  |           |  |               |  |
|  | - Reasoning |  | - Short   |  | - Web search  |  |
|  | - Planning  |  |   term    |  | - Code exec   |  |
|  | - Judgment  |  | - Long    |  | - API calls   |  |
|  |             |  |   term    |  |               |  |
|  |             |  | - Ext DB  |  |               |  |
|  +-------------+  +-----------+  +---------------+  |
+---------------------------------------------------+
```

### 1.3 History and Evolution of Agents

The concept of AI agents dates back to cybernetics in the 1950s, but LLM-based agents became practical only after 2023.

```
AI Agent Development Timeline

1950s  Cybernetics (feedback loops)
1980s  Expert systems (rule-based reasoning)
1990s  BDI architecture (Belief-Desire-Intention model)
2000s  Multi-agent systems research
2017   Transformer introduced (Attention Is All You Need)
2022   ChatGPT launched → LLMs go mainstream
2023   AutoGPT/BabyAGI → LLM agent boom
       ReAct paper → reasoning + acting pattern established
       LangChain/LangGraph → framework maturation
2024   Claude Code, Devin → production-level coding agents
       MCP (Model Context Protocol) → tool standardization
       Multi-agent framework maturation
2025   Claude Agent SDK → official agent building toolkit
       Enterprise adoption accelerates
```

### 1.4 Detailed Agent Components

```python
# Detailed definition of agent components
from dataclasses import dataclass, field
from typing import Callable, Any, Protocol
from enum import Enum

class AgentCapability(Enum):
    """Agent capability classifications"""
    REASONING = "reasoning"       # Reasoning ability
    PLANNING = "planning"         # Planning ability
    TOOL_USE = "tool_use"         # Tool use ability
    MEMORY = "memory"             # Memory ability
    LEARNING = "learning"         # Learning ability (metacognition)
    COMMUNICATION = "communication"  # Communication ability (for multi-agent)

class ToolCategory(Enum):
    """Tool classifications"""
    INFORMATION = "information"   # Information retrieval (search, read)
    COMPUTATION = "computation"   # Computation (numerical, code execution)
    COMMUNICATION = "communication"  # Communication (send email, API calls)
    MANIPULATION = "manipulation"    # Manipulation (file ops, DB ops)

@dataclass
class ToolDefinition:
    """Tool definition"""
    name: str
    description: str
    category: ToolCategory
    parameters: dict
    function: Callable
    is_destructive: bool = False  # Whether the operation is destructive
    requires_approval: bool = False  # Whether human approval is required
    rate_limit: int = 0  # Max calls per minute (0=unlimited)

@dataclass
class AgentProfile:
    """Agent profile"""
    name: str
    role: str
    capabilities: list[AgentCapability]
    tools: list[ToolDefinition]
    model: str = "claude-sonnet-4-20250514"
    max_steps: int = 20
    temperature: float = 0.0
    system_prompt: str = ""

    def has_capability(self, cap: AgentCapability) -> bool:
        return cap in self.capabilities

    def get_tools_by_category(self, category: ToolCategory) -> list[ToolDefinition]:
        return [t for t in self.tools if t.category == category]

    def get_safe_tools(self) -> list[ToolDefinition]:
        """Retrieve only non-destructive tools"""
        return [t for t in self.tools if not t.is_destructive]
```

---

## 2. Chatbot vs. Agent

| Property | Chatbot | AI Agent |
|----------|---------|----------|
| Turns | 1 turn (Q&A) | Multiple turns (loop) |
| Tool use | None or limited | Autonomously selects multiple tools |
| Planning | None | Task decomposition and prioritization |
| State management | Conversation history only | Short-term/long-term memory |
| Autonomy | User-driven | Goal-driven autonomous action |
| Error recovery | Not possible | Retry and select alternatives |
| Typical use | FAQ handling | Coding, research |

### 2.1 Concrete Comparison Scenario

```
Scenario: "Prepare for my business trip next week"

Chatbot:
  → "Here are recommendations for preparing for a business trip:
     1. Book flights
     2. Book a hotel
     3. Create a packing list
     ..."
  (information provision only)

AI Agent:
  Step 1: Check calendar → identify trip dates
  Step 2: Confirm destination and purpose (ask user)
  Step 3: Search and compare flights → suggest best options
  Step 4: Get user approval and make reservation
  Step 5: Search and book hotel at destination
  Step 6: Look up route and weather, create packing list
  Step 7: Submit travel request in internal system
  Step 8: Report completion
  (actually takes action)
```

### 2.2 Conditions Where Agents Outperform

```
Checklist of conditions where agents are effective:

[✓] Multiple steps are required
[✓] Decisions needed along the way (branching logic)
[✓] External data retrieval is needed
[✓] Trial and error may occur
[✓] Tool/API usage is required
[✓] The next action depends on intermediate results

Conditions where agents are unnecessary:
[✗] Simple Q&A
[✗] Template-based processing
[✗] Immediate response required (latency constraints)
[✗] 100% accuracy required (without human review)
```

---

## 3. Types of Agents

### 3.1 Classification System

```
AI Agent Classifications
├── Reactive
│   └── Input → immediate response. No internal state
├── Deliberative
│   └── Plan → execute → evaluate loop
├── Hybrid
│   └── Combination of reactive and deliberative
├── Multi-agent
│   └── Coordination among multiple agents
└── Autonomous
    └── Long-running autonomous execution
```

### 3.2 Type Comparison Table

| Type | Planning | Tools | Memory | Complexity | Examples |
|------|----------|-------|--------|------------|---------|
| Reactive | None | Limited | None | Low | Simple chat |
| Deliberative | Yes | Multiple | Short-term | Medium | ReAct agent |
| Hybrid | Yes | Multiple | Short+Long term | Medium-High | LangChain Agent |
| Multi | Yes | Distributed | Shared | High | CrewAI |
| Autonomous | Advanced | Broad | Persistent | Highest | Devin, Claude Code |

### 3.3 Detailed Characteristics of Each Type

```python
# Example implementation of a reactive agent
class ReactiveAgent:
    """The simplest agent that immediately responds to input"""

    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools

    def respond(self, user_input: str) -> str:
        """Responds immediately without maintaining state"""
        # Determine if a tool is needed
        tool_needed = self.llm.classify(user_input,
            categories=["direct_answer", "tool_needed"])

        if tool_needed == "direct_answer":
            return self.llm.generate(user_input)

        # Select and execute the single most appropriate tool
        tool = self.llm.select_tool(user_input, self.tools)
        result = tool.execute(user_input)
        return self.llm.synthesize(user_input, result)

# Example implementation of a deliberative agent
class DeliberativeAgent:
    """An agent with a plan-execute-evaluate cycle"""

    def __init__(self, llm, tools, max_iterations=10):
        self.llm = llm
        self.tools = tools
        self.max_iterations = max_iterations
        self.scratchpad = []  # Record of thoughts

    def run(self, goal: str) -> str:
        # Phase 1: Planning
        plan = self._plan(goal)

        for i in range(self.max_iterations):
            # Phase 2: Decide next action
            action = self._decide_next_action(plan, self.scratchpad)

            if action.is_final:
                return action.content

            # Phase 3: Execute action
            result = self._execute(action)
            self.scratchpad.append({
                "thought": action.thought,
                "action": action.name,
                "result": result
            })

            # Phase 4: Revise the plan
            if self._needs_replan(plan, self.scratchpad):
                plan = self._replan(goal, self.scratchpad)

        return self._summarize_progress()

# Example implementation of a hybrid agent
class HybridAgent:
    """An agent combining reactive and deliberative approaches"""

    def __init__(self, reactive: ReactiveAgent, deliberative: DeliberativeAgent):
        self.reactive = reactive
        self.deliberative = deliberative

    def handle(self, user_input: str) -> str:
        # Assess the complexity of the input
        complexity = self._assess_complexity(user_input)

        if complexity == "simple":
            # Simple question → immediate response via reactive
            return self.reactive.respond(user_input)
        else:
            # Complex task → deliberative planned execution
            return self.deliberative.run(user_input)

    def _assess_complexity(self, user_input: str) -> str:
        """Assess the complexity of the input"""
        # Judge based on number of steps, tool requirements, ambiguity, etc.
        indicators = {
            "multiple_steps": any(w in user_input for w in ["そして", "その後", "次に"]),
            "tool_needed": any(w in user_input for w in ["検索", "計算", "作成", "実行"]),
            "ambiguous": len(user_input) > 200 or "?" in user_input
        }
        complex_count = sum(indicators.values())
        return "complex" if complex_count >= 2 else "simple"
```

---

## 4. Agent Architecture

### 4.1 Basic Loop: Perceive-Think-Act

```python
# Basic agent loop (conceptual code)
class SimpleAgent:
    def __init__(self, llm, tools, memory):
        self.llm = llm
        self.tools = tools
        self.memory = memory

    def run(self, goal: str) -> str:
        """Receives a goal and executes autonomously until completion"""
        self.memory.add("goal", goal)

        while not self.is_done():
            # 1. Perceive: observe current state
            context = self.memory.get_context()

            # 2. Think: reason about the next action
            action = self.llm.decide(context, self.tools)

            # 3. Act: execute tool
            if action.type == "tool_call":
                result = self.tools.execute(action)
                self.memory.add("observation", result)
            elif action.type == "final_answer":
                return action.content

        return self.memory.get_summary()
```

### 4.2 ReAct Pattern

```python
# ReAct (Reasoning + Acting) pattern
REACT_PROMPT = """
以下の形式で思考と行動を繰り返してください：

Thought: 現状の分析と次にすべきことの推論
Action: 使用するツール名[引数]
Observation: ツールの実行結果
... (繰り返し)
Thought: 最終的な結論
Final Answer: ユーザーへの回答
"""

class ReActAgent:
    def step(self, messages):
        response = self.llm.generate(
            system=REACT_PROMPT,
            messages=messages
        )

        if "Final Answer:" in response:
            return {"type": "answer", "content": response}

        # Parse Action and execute tool
        tool_name, args = self.parse_action(response)
        result = self.toolstool_name

        return {"type": "observation", "content": result}
```

### 4.3 Function Calling Pattern

```python
# OpenAI / Anthropic style Function Calling
import anthropic

client = anthropic.Anthropic()

tools = [
    {
        "name": "web_search",
        "description": "Webを検索して情報を取得する",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "検索クエリ"}
            },
            "required": ["query"]
        }
    }
]

def agent_loop(user_message):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            tools=tools,
            messages=messages
        )

        if response.stop_reason == "end_turn":
            return response.content[0].text

        # Process tool calls
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": [{"type": "tool_result",
                                 "tool_use_id": block.id,
                                 "content": result}]
                })
```

### 4.4 Plan-and-Execute Pattern

```python
# Complete implementation of the Plan-and-Execute pattern
class PlanAndExecuteAgent:
    """A pattern that creates a full plan upfront then executes steps sequentially"""

    def __init__(self, planner_llm, executor_llm, tools):
        self.planner = planner_llm
        self.executor = executor_llm
        self.tools = tools

    def run(self, goal: str) -> str:
        # Phase 1: Create plan
        plan = self._create_plan(goal)

        # Phase 2: Sequential execution
        results = []
        for i, step in enumerate(plan):
            print(f"Step {i+1}/{len(plan)}: {step}")
            result = self._execute_step(step, results)
            results.append({"step": step, "result": result})

            # Check whether the plan needs revision
            if self._needs_replan(goal, plan, results):
                remaining_plan = self._replan(goal, results, plan[i+1:])
                plan = plan[:i+1] + remaining_plan

        # Phase 3: Synthesize results
        return self._synthesize(goal, results)

    def _create_plan(self, goal: str) -> list[str]:
        """Decompose the goal into concrete steps"""
        response = self.planner.generate(f"""
目標: {goal}

利用可能なツール:
{self._format_tools()}

この目標を達成するための具体的なステップを列挙してください。
各ステップは1つのツール呼び出しまたは1つの思考で完結すること。

出力形式:
1. [ステップの説明]
2. [ステップの説明]
...
""")
        return self._parse_steps(response)

    def _execute_step(self, step: str, previous_results: list) -> str:
        """Execute an individual step"""
        context = "\n".join([
            f"- {r['step']}: {r['result'][:200]}"
            for r in previous_results[-3:]  # Only the last 3 results
        ])

        response = self.executor.generate(f"""
実行するステップ: {step}

これまでの結果:
{context}

利用可能なツール:
{self._format_tools()}

このステップを実行してください。
""")
        return response
```

### 4.5 Full Architecture Diagram

```
+------------------------------------------------------------+
|                    Agent Runtime                            |
|                                                              |
|  +-----------+     +------------------+     +-----------+   |
|  |  Input    |---->|  Orchestrator    |---->|  Output   |   |
|  | Handler   |     |                  |     | Handler   |   |
|  +-----------+     |  +------------+  |     +-----------+   |
|                    |  | Planner    |  |                      |
|                    |  +-----+------+  |                      |
|                    |        |         |                      |
|                    |  +-----v------+  |     +-----------+   |
|                    |  | Executor   |------->| Tool      |   |
|                    |  +-----+------+  |     | Registry  |   |
|                    |        |         |     +-----------+   |
|                    |  +-----v------+  |                      |
|                    |  | Evaluator  |  |     +-----------+   |
|                    |  +------------+  |     | Memory    |   |
|                    |                  |<--->| Store     |   |
|                    +------------------+     +-----------+   |
+------------------------------------------------------------+
```

### 4.6 Architecture Pattern Comparison Table

| Pattern | Planning | Flexibility | Implementation Difficulty | Use Cases |
|---------|----------|-------------|--------------------------|-----------|
| ReAct | Low (sequential) | High | Low | General tasks |
| Function Calling | Low (sequential) | High | Low | API integrations |
| Plan-and-Execute | High (upfront plan) | Medium | Medium | Structured tasks |
| Tree of Thoughts | Highest (exploratory) | Highest | High | Complex reasoning |
| Reflexion | Medium (reflective) | High | Medium | Quality-focused tasks |

---

## 5. Agent Components

### 5.1 Component Details

```python
# Example implementation of the main agent components
from dataclasses import dataclass, field
from typing import Callable

@dataclass
class Tool:
    """Tool used by an agent"""
    name: str
    description: str
    function: Callable
    parameters: dict

@dataclass
class Memory:
    """Agent memory"""
    short_term: list = field(default_factory=list)   # Context for current task
    long_term: dict = field(default_factory=dict)     # Persistent knowledge
    working: dict = field(default_factory=dict)       # Temporary working area

@dataclass
class AgentConfig:
    """Agent configuration"""
    model: str = "claude-sonnet-4-20250514"
    max_steps: int = 20           # Maximum number of steps
    temperature: float = 0.0      # Deterministic output
    max_tokens: int = 4096
    tools: list = field(default_factory=list)
    system_prompt: str = ""
```

### 5.2 Prompt Engineering Principles

An agent's system prompt differs from ordinary chat and must clearly define behavioral guidelines.

```python
# Design patterns for agent system prompts
class AgentPromptBuilder:
    """Constructs system prompts for agents in a structured way"""

    @staticmethod
    def build(role: str, tools: list, constraints: list,
              examples: list = None) -> str:
        prompt_parts = []

        # 1. Role definition
        prompt_parts.append(f"## 役割\nあなたは{role}です。")

        # 2. Available tools
        tool_descriptions = "\n".join([
            f"- **{t.name}**: {t.description}" for t in tools
        ])
        prompt_parts.append(f"## 利用可能なツール\n{tool_descriptions}")

        # 3. Behavioral guidelines
        constraint_list = "\n".join([f"- {c}" for c in constraints])
        prompt_parts.append(f"## 行動規範\n{constraint_list}")

        # 4. Thought process
        prompt_parts.append("""## 思考プロセス
1. まず目標を明確化する
2. 必要な情報を特定する
3. 最も効率的なツールを選択する
4. 実行結果を評価する
5. 目標が達成されたか判断する
6. 未達成なら次のアクションを計画する""")

        # 5. Output format
        prompt_parts.append("""## 出力形式
- 作業の意図を簡潔に説明してからツールを使用する
- 結果を分析して次のステップを判断する
- 最終回答は構造化して提供する""")

        # 6. Examples (Few-shot)
        if examples:
            example_text = "\n\n".join([
                f"### 例 {i+1}\n入力: {e['input']}\n出力: {e['output']}"
                for i, e in enumerate(examples)
            ])
            prompt_parts.append(f"## 例\n{example_text}")

        return "\n\n".join(prompt_parts)

# Usage example
system_prompt = AgentPromptBuilder.build(
    role="シニアソフトウェアエンジニア",
    tools=[read_file_tool, write_file_tool, run_tests_tool],
    constraints=[
        "コードを変更する前に必ず既存のコードを読んで理解する",
        "テストを書いてから実装する（TDD）",
        "破壊的な変更の前にユーザーの確認を求める",
        "エラーが発生したら原因を特定してから修正する"
    ]
)
```

### 5.3 Tool Design Best Practices

```python
# Tool design guidelines
class ToolDesignGuidelines:
    """
    Principles of good tool design:

    1. Single responsibility: 1 tool = 1 function
    2. Clear naming: verb_noun format (search_web, read_file)
    3. Detailed description: what it does + when to use it + inputs/outputs
    4. Appropriate granularity: not too coarse, not too fine
    5. Error handling: provide rich information on failure
    6. Idempotency: same input → same output whenever possible
    """

    @staticmethod
    def validate_tool_definition(tool: dict) -> list[str]:
        """Check the quality of a tool definition"""
        issues = []

        # Check name
        if not tool.get("name"):
            issues.append("Name is undefined")
        elif "_" not in tool["name"]:
            issues.append("Name should follow verb_noun format (e.g., search_web)")

        # Check description
        desc = tool.get("description", "")
        if len(desc) < 20:
            issues.append("Description is too short (minimum 20 characters)")
        if "使用" not in desc and "use" not in desc.lower():
            issues.append("A description of when to use the tool is recommended")

        # Check parameters
        schema = tool.get("input_schema", {})
        props = schema.get("properties", {})
        for param_name, param_def in props.items():
            if "description" not in param_def:
                issues.append(f"Parameter '{param_name}' has no description")

        return issues
```

---

## 6. Detailed Implementation Patterns

### 6.1 Event-Driven Agent

```python
# Event-driven agent implementation
from typing import Protocol
from dataclasses import dataclass
import asyncio

class EventHandler(Protocol):
    async def handle(self, event: dict) -> dict: ...

@dataclass
class AgentEvent:
    type: str  # "user_input", "tool_result", "error", "timeout"
    data: dict
    timestamp: float

class EventDrivenAgent:
    """Event-driven agent"""

    def __init__(self, llm, tools):
        self.llm = llm
        self.tools = tools
        self.event_queue = asyncio.Queue()
        self.handlers: dict[str, EventHandler] = {}
        self.state = {"status": "idle", "history": []}

    def register_handler(self, event_type: str, handler: EventHandler):
        self.handlers[event_type] = handler

    async def run(self):
        """Event loop"""
        while True:
            event = await self.event_queue.get()
            handler = self.handlers.get(event.type)

            if handler:
                try:
                    result = await handler.handle(event.data)
                    self.state["history"].append({
                        "event": event.type,
                        "result": result
                    })
                except Exception as e:
                    await self.event_queue.put(AgentEvent(
                        type="error",
                        data={"error": str(e), "original_event": event},
                        timestamp=time.time()
                    ))

    async def submit(self, event_type: str, data: dict):
        """Submit an event"""
        await self.event_queue.put(AgentEvent(
            type=event_type,
            data=data,
            timestamp=time.time()
        ))
```

### 6.2 Streaming Agent

```python
# Streaming-capable agent
import anthropic
from typing import AsyncGenerator

class StreamingAgent:
    """An agent that streams tokens in real time"""

    def __init__(self):
        self.client = anthropic.Anthropic()

    async def run_streaming(self, user_message: str,
                            tools: list) -> AsyncGenerator[dict, None]:
        """Returns agent output via streaming"""
        messages = [{"role": "user", "content": user_message}]

        while True:
            with self.client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                tools=tools,
                messages=messages
            ) as stream:
                current_text = ""
                for event in stream:
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            current_text += event.delta.text
                            yield {
                                "type": "text_delta",
                                "text": event.delta.text
                            }

                response = stream.get_final_message()

            if response.stop_reason == "end_turn":
                yield {"type": "complete", "text": current_text}
                return

            # Process tool calls
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    yield {
                        "type": "tool_call",
                        "tool": block.name,
                        "input": block.input
                    }
                    result = self._execute_tool(block.name, block.input)
                    yield {
                        "type": "tool_result",
                        "tool": block.name,
                        "result": str(result)[:200]
                    }
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
```

### 6.3 Context Management Pattern

```python
# Efficient context management
class ContextManager:
    """Efficiently manages an agent's context window"""

    def __init__(self, max_tokens: int = 100000):
        self.max_tokens = max_tokens
        self.messages: list[dict] = []
        self.system_prompt: str = ""
        self.pinned_context: list[str] = []  # Context always included

    def estimate_tokens(self, text: str) -> int:
        """Rough token count estimate (approx 1.5 tokens per character for Japanese)"""
        return int(len(text) * 1.5)

    def get_current_tokens(self) -> int:
        total = self.estimate_tokens(self.system_prompt)
        total += sum(self.estimate_tokens(str(m)) for m in self.messages)
        total += sum(self.estimate_tokens(c) for c in self.pinned_context)
        return total

    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        self._trim_if_needed()

    def _trim_if_needed(self):
        """Summarize old messages when context exceeds the limit"""
        while self.get_current_tokens() > self.max_tokens * 0.8:
            if len(self.messages) <= 4:
                break  # Keep the minimum number of messages

            # Summarize and compress older messages
            old_messages = self.messages[:len(self.messages)//2]
            summary = self._summarize(old_messages)

            self.messages = [
                {"role": "system", "content": f"これまでの会話の要約: {summary}"}
            ] + self.messages[len(self.messages)//2:]

    def _summarize(self, messages: list) -> str:
        """Summarize a group of messages"""
        content = "\n".join([f"{m['role']}: {str(m['content'])[:200]}" for m in messages])
        return f"[要約] {content[:500]}"

    def pin_context(self, context: str):
        """Add context that is always included"""
        self.pinned_context.append(context)

    def get_messages_for_api(self) -> list:
        """Get the message list for API calls"""
        result = []
        if self.pinned_context:
            result.append({
                "role": "user",
                "content": "参考情報:\n" + "\n".join(self.pinned_context)
            })
        result.extend(self.messages)
        return result
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Infinite Loop Agent

```python
# NG: Agent with no stopping condition
class BadAgent:
    def run(self, goal):
        while True:  # May never terminate
            action = self.think(goal)
            self.execute(action)

# OK: Set a maximum step count and timeout
class GoodAgent:
    def run(self, goal, max_steps=20, timeout=300):
        for step in range(max_steps):
            if time.time() - start > timeout:
                return self.summarize_progress()
            action = self.think(goal)
            if action.is_final:
                return action.result
            self.execute(action)
        return self.summarize_progress()  # Return intermediate progress
```

### Anti-Pattern 2: Ambiguous Tool Definitions

```python
# NG: Vague tool description
bad_tool = {
    "name": "search",
    "description": "検索する"  # What? How?
}

# OK: Specific and clear tool description
good_tool = {
    "name": "web_search",
    "description": "指定されたクエリでGoogle検索を実行し、上位10件の結果（タイトル、URL、スニペット）を返す。事実確認や最新情報の取得に使用する。",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "検索クエリ（日本語 or 英語）"
            },
            "num_results": {
                "type": "integer",
                "description": "取得件数（デフォルト: 10）",
                "default": 10
            }
        },
        "required": ["query"]
    }
}
```

### Anti-Pattern 3: Context Explosion

```python
# NG: Accumulating all tool results causes context explosion
class ContextExplosionAgent:
    def run(self, goal):
        messages = [{"role": "user", "content": goal}]
        for _ in range(100):
            response = llm.generate(messages=messages)
            tool_result = execute(response)
            # Huge results accumulate as-is
            messages.append({"role": "assistant", "content": response})
            messages.append({"role": "user", "content": tool_result})
        # → Grows to tens of thousands of tokens, cost explosion

# OK: Manage with a context manager
class ManagedAgent:
    def __init__(self):
        self.context_manager = ContextManager(max_tokens=50000)

    def run(self, goal):
        self.context_manager.add_message("user", goal)
        for _ in range(20):
            messages = self.context_manager.get_messages_for_api()
            response = llm.generate(messages=messages)

            # Summarize results before adding
            result = execute(response)
            summarized = summarize_if_large(result, max_chars=2000)
            self.context_manager.add_message("assistant", str(response))
            self.context_manager.add_message("user", summarized)
```

### Anti-Pattern 4: Missing Error Handling

```python
# NG: Crashes on error
class FragileAgent:
    def run(self, goal):
        result = self.tools"search"  # Tool missing → KeyError
        return result  # Network error → unhandled exception

# OK: Multi-layer error handling
class RobustAgent:
    def run(self, goal):
        try:
            for step in range(self.max_steps):
                action = self.decide_action(goal)

                if action.tool not in self.tools:
                    self.report_error(f"Tool '{action.tool}' is not available")
                    continue

                try:
                    result = self.toolsaction.tool
                except TimeoutError:
                    result = "Timed out. Please retry."
                except Exception as e:
                    result = f"Error: {type(e).__name__}: {e}"

                self.memory.add(action, result)

        except Exception as e:
            return f"An error occurred in the agent: {e}\nPartial results: {self.get_partial_results()}"
```

---

## 7. Performance Optimization

### 7.1 Latency Optimization

```
Agent latency breakdown

Typical single step:
  [LLM inference]    1-5 sec   ████████████████████
  [Tool execution]   0.1-2 sec ████
  [Result handling]  0.01 sec  █

5-step task:
  Total: 5-35 sec

Optimization levers:
1. Model selection: Haiku (fast) vs Sonnet (balanced) vs Opus (high quality)
2. Parallel tool calls: run independent tools simultaneously
3. Streaming: return partial results immediately
4. Caching: cache results for identical inputs
5. Prompt optimization: reduce unnecessary context
```

```python
# Performance optimization implementation example
import asyncio
import hashlib
from functools import lru_cache

class OptimizedAgent:
    def __init__(self):
        self.cache = {}
        self.metrics = {"total_time": 0, "cache_hits": 0, "api_calls": 0}

    async def run_optimized(self, goal: str) -> str:
        """Optimized agent loop"""
        start = time.time()
        messages = [{"role": "user", "content": goal}]

        for step in range(self.max_steps):
            # Cache check
            cache_key = self._make_cache_key(messages)
            if cache_key in self.cache:
                self.metrics["cache_hits"] += 1
                response = self.cache[cache_key]
            else:
                self.metrics["api_calls"] += 1
                response = await self._call_llm_async(messages)
                self.cache[cache_key] = response

            if response.stop_reason == "end_turn":
                self.metrics["total_time"] = time.time() - start
                return self._extract_text(response)

            # Parallel tool execution
            tool_calls = [b for b in response.content if b.type == "tool_use"]
            if len(tool_calls) > 1:
                results = await self._execute_tools_parallel(tool_calls)
            else:
                results = [await self._execute_tool_async(tool_calls[0])]

            # Update messages
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": results})

        self.metrics["total_time"] = time.time() - start
        return "Maximum steps reached"

    async def _execute_tools_parallel(self, tool_calls):
        """Execute multiple tool calls in parallel"""
        tasks = [
            self._execute_tool_async(tc) for tc in tool_calls
        ]
        return await asyncio.gather(*tasks)

    def _make_cache_key(self, messages: list) -> str:
        content = str(messages[-3:])  # Generate key from last 3 messages
        return hashlib.md5(content.encode()).hexdigest()

    def get_performance_report(self) -> str:
        return (
            f"Total execution time: {self.metrics['total_time']:.1f}s\n"
            f"API calls: {self.metrics['api_calls']}\n"
            f"Cache hits: {self.metrics['cache_hits']}\n"
            f"Cache rate: {self.metrics['cache_hits']/(self.metrics['api_calls']+self.metrics['cache_hits'])*100:.0f}%"
        )
```

### 7.2 Cost Optimization

```python
# Model routing for cost optimization
class CostOptimizedAgent:
    """Uses different models depending on task complexity"""

    MODELS = {
        "fast": "claude-haiku-4-20250514",     # For classification and routing
        "balanced": "claude-sonnet-4-20250514", # General tasks
        "powerful": "claude-opus-4-20250514",   # Complex reasoning
    }

    def select_model(self, task_type: str, complexity: str) -> str:
        """Select a model based on task type and complexity"""
        model_map = {
            ("classification", "any"): "fast",
            ("routing", "any"): "fast",
            ("generation", "low"): "balanced",
            ("generation", "high"): "powerful",
            ("reasoning", "low"): "balanced",
            ("reasoning", "high"): "powerful",
            ("coding", "any"): "balanced",
        }

        # Tasks independent of complexity
        key = (task_type, "any")
        if key in model_map:
            return self.MODELS[model_map[key]]

        # Tasks that consider complexity
        key = (task_type, complexity)
        tier = model_map.get(key, "balanced")
        return self.MODELS[tier]
```

---

## 8. Troubleshooting Guide

### 8.1 Common Issues and Solutions

| Symptom | Cause | Solution |
|---------|-------|---------|
| Same tool called repeatedly | No loop detection | Monitor call patterns over last N steps |
| Stops midway | Context overflow | Implement message compression and summarization |
| Wrong tool selected | Unclear tool description | Improve description, add usage examples |
| Cost too high | Too many unnecessary steps | Adjust max_steps, implement model routing |
| Poor quality final answer | Context contamination | Filter to include only relevant information |
| Timeout | Slow tool execution | Set timeouts, use async execution |

### 8.2 Debugging Techniques

```python
# Agent debugging tool
class AgentDebugger:
    """Debug tool for tracing and analyzing agent execution"""

    def __init__(self):
        self.trace = []

    def log_step(self, step_num: int, thought: str, action: str,
                 result: str, tokens_used: int):
        self.trace.append({
            "step": step_num,
            "thought": thought[:200],
            "action": action,
            "result": result[:200],
            "tokens": tokens_used,
            "timestamp": time.time()
        })

    def print_trace(self):
        """Visualize the execution trace"""
        print("=" * 60)
        print("Agent Execution Trace")
        print("=" * 60)

        total_tokens = 0
        for entry in self.trace:
            print(f"\n--- Step {entry['step']} ---")
            print(f"  Thought: {entry['thought']}")
            print(f"  Action:  {entry['action']}")
            print(f"  Result:  {entry['result']}")
            print(f"  Tokens:  {entry['tokens']:,}")
            total_tokens += entry['tokens']

        print(f"\n{'=' * 60}")
        print(f"Total steps:  {len(self.trace)}")
        print(f"Total tokens: {total_tokens:,}")
        print(f"Estimated cost: ${total_tokens * 3 / 1_000_000:.4f}")

    def detect_loops(self) -> list[str]:
        """Detect loop patterns"""
        issues = []
        actions = [t["action"] for t in self.trace]

        # Consecutive identical actions
        for i in range(len(actions) - 2):
            if actions[i] == actions[i+1] == actions[i+2]:
                issues.append(
                    f"Step {i}-{i+2}: '{actions[i]}' called 3 times in a row"
                )

        # Total call counts
        from collections import Counter
        counts = Counter(actions)
        for action, count in counts.most_common(3):
            if count > 5:
                issues.append(
                    f"'{action}' called {count} times (possibly excessive)"
                )

        return issues
```

---

## 9. Design Checklist

Items to verify when designing an agent:

```
[ ] Goal clarification
    [ ] Task scope is defined
    [ ] Success criteria are clear
    [ ] Expected step count is estimated

[ ] Tool design
    [ ] Each tool's description is specific and clear
    [ ] Input parameters have constraints
    [ ] Error responses are structured
    [ ] Destructive operations have guardrails

[ ] Memory design
    [ ] Short-term memory has a capacity limit
    [ ] A context compression mechanism exists
    [ ] Long-term memory is used when appropriate

[ ] Safety
    [ ] Maximum step count is set
    [ ] Timeout is set
    [ ] Cost limit is set
    [ ] Confirmation is requested before destructive operations

[ ] Error handling
    [ ] Retry logic exists for tool execution
    [ ] Fallback alternatives exist
    [ ] A mechanism to return partial results exists

[ ] Monitoring
    [ ] Logs are recorded for each step
    [ ] Token usage is tracked
    [ ] Abnormal patterns are detected
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement appropriate error handling
- Also write test code

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise in basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise in advanced patterns"""

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
        """Delete by key"""
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
    print("応用テスト全合格!")

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
    """Efficient search using a hash map"""
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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key points:**
- Be mindful of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## 10. FAQ

### Q1: What is the difference between an AI agent and RAG?

RAG (Retrieval-Augmented Generation) is a mechanism of **information retrieval + generation** and is often used as one component of an agent. An agent has capabilities beyond RAG, including tool execution, planning, and state management. A helpful way to think about it: RAG is "knowledge expansion," while agents are "action autonomy."

### Q2: What tasks are unsuitable for agents?

Agents are overkill for the following tasks:
- **Simple Q&A**: questions with answers that fit in a single turn
- **Template-based processing**: tasks with fixed input → output
- **Real-time required**: cases where latency is not acceptable (agents are slower because they require multiple steps)

Conversely, agents are effective for tasks requiring trial and error, such as **research, coding, and data analysis**.

### Q3: Which LLM is best for agents?

As of 2025, the leading options are:
- **Claude 3.5 Sonnet / Claude 4 series**: stable tool use, strong coding ability
- **GPT-4o / GPT-4 Turbo**: stable Function Calling
- **Gemini 1.5 Pro**: long context (1 million tokens)

Evaluation criteria are three axes: "stability of tool calls," "instruction-following ability," and "cost."

### Q4: What are the typical execution costs for agents?

Depending on task complexity and model, rough estimates are as follows:

| Task Type | Steps | Estimated Cost (Claude Sonnet) |
|-----------|-------|-------------------------------|
| Simple search + answer | 2-3 | $0.01-0.05 |
| File operations | 5-10 | $0.05-0.20 |
| Coding | 10-20 | $0.20-1.00 |
| Complex research | 20-50 | $1.00-5.00 |
| Entire project | 50-200 | $5.00-50.00 |

### Q5: How do you ensure agent quality?

Quality is ensured at three layers:

1. **Design time**: tool definition quality checks, prompt testing
2. **Runtime**: guardrails, loop detection, cost limits
3. **Post-evaluation**: measuring success rates, LLM-as-Judge, human review

### Q6: What is a multimodal agent?

An agent that can handle images, audio, and video as input and output, not just text. Examples:
- A UI operation agent that looks at screenshots and performs actions
- An agent that reads diagrams and conducts design reviews
- A hands-free agent that receives instructions via voice and performs work

Claude 3.5 and later support multimodal input, enabling the construction of agents that include image input.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| Definition | An LLM system that autonomously plans and executes in a goal-driven manner |
| 3 elements | Brain (LLM), Memory, Tools |
| Basic loop | Perceive → Think → Act, repeated |
| Key patterns | ReAct, Function Calling, Plan-and-Execute |
| Types | Reactive, Deliberative, Hybrid, Multi-agent, Autonomous |
| Keys to success | Clear tool definitions, stopping conditions, error handling |

## Guides to Read Next

- [01-agent-frameworks.md](./01-agent-frameworks.md) — Detailed comparison of major frameworks
- [02-tool-use.md](./02-tool-use.md) — Tool use implementation patterns
- [03-memory-systems.md](./03-memory-systems.md) — Memory system design

## References

1. Anthropic, "Building effective agents" (2024) — https://docs.anthropic.com/en/docs/build-with-claude/agentic
2. Yao, S. et al., "ReAct: Synergizing Reasoning and Acting in Language Models" (2023) — https://arxiv.org/abs/2210.03629
3. Wang, L. et al., "A Survey on Large Language Model based Autonomous Agents" (2023) — https://arxiv.org/abs/2308.11432
4. LangChain Documentation, "Agents" — https://python.langchain.com/docs/concepts/agents/
5. Shinn, N. et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (2023) — https://arxiv.org/abs/2303.11366
6. Wei, J. et al., "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (2022) — https://arxiv.org/abs/2201.11903
7. Yao, S. et al., "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" (2023) — https://arxiv.org/abs/2305.10601
