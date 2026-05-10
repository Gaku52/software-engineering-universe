# Agent Frameworks

> LangChain, CrewAI, AutoGen, LangGraph — compare the design philosophy, features, and tradeoffs of major AI agent frameworks to find the best fit for your project.

## What You Will Learn

1. The design philosophy and strengths of each of the four major frameworks
2. Implementation patterns and code examples for each framework
3. Framework selection criteria based on project requirements
4. Strategies for framework migration and avoiding vendor lock-in
5. Performance characteristics and scalability of each framework


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [AI Agent Overview](./00-agent-overview.md)

---

## 1. Framework Landscape

```
AI Agent Framework Ecosystem (2025)
+---------------------------------------------------------------+
|                        High Level                              |
|  +----------+  +----------+  +----------+  +-----------+       |
|  | CrewAI   |  | AutoGen  |  | Claude   |  | OpenAI    |       |
|  | (Role)   |  | (Conv.)  |  | Agent SDK|  | Assistants|       |
|  +----+-----+  +----+-----+  +----+-----+  +-----+-----+      |
|       |              |             |              |              |
|  +----v--------------v-------------v--------------v-----+       |
|  |              LangChain / LangGraph                    |       |
|  |              (Foundation + Orchestration)             |       |
|  +----+----------------------------------------------+--+       |
|       |                                              |           |
|  +----v-----+  +----------+  +----------+  +--------v--+       |
|  | LLM APIs |  | Vector   |  | Tool     |  | Memory    |       |
|  | (Claude, |  | Stores   |  | Servers  |  | Stores    |       |
|  |  GPT)    |  | (Pinecone|  | (MCP)    |  | (Redis)   |       |
|  +----------+  +----------+  +----------+  +-----------+       |
|                        Low Level                               |
+---------------------------------------------------------------+
```

### 1.1 History of Framework Evolution

AI agent frameworks have evolved rapidly since 2023.

```
Framework Evolution Timeline
2022 Q4  ├── LangChain initial release (chain-focused)
2023 Q1  ├── LangChain AgentExecutor added
2023 Q2  ├── AutoGen (Microsoft) released
2023 Q3  ├── CrewAI initial release
2023 Q4  ├── LangGraph released (graph-based orchestration)
2024 Q1  ├── Claude Tool Use GA / OpenAI Assistants API v2
2024 Q2  ├── MCP (Model Context Protocol) announced
2024 Q3  ├── LangGraph Studio / CrewAI 2.0
2024 Q4  ├── AutoGen 0.4 (major re-architecture)
2025 Q1  ├── Claude Agent SDK / OpenAI Agents SDK
2025 Q2  ├── Maturation of all major frameworks
```

### 1.2 Why Framework Selection Matters

Framework selection is not merely a technical decision — it is a strategic choice that directly affects project success.

```
Scope of Framework Selection Impact

+------------------+     +--------------------+     +------------------+
| Development Speed|     | Operational Cost   |     | Team Learning    |
| - Prototype speed|     | - LLM API costs    |     | - Time to learn  |
| - Feature velocity     | - Infrastructure   |     | - Doc quality    |
| - Debug efficiency     | - Maintenance work |     | - Community size |
+--------+---------+     +--------+-----------+     +--------+---------+
         |                         |                          |
         +------------+------------+-----------+--------------+
                      |                        |
              +-------v--------+      +--------v-------+
              | Project Success|      | Technical Debt |
              +----------------+      +----------------+
```

---

## 2. LangChain

### 2.1 Design Philosophy

LangChain is built around the concept of **composable building blocks**. It provides LLM calls, prompt templates, tools, and memory as individual components that can be freely combined.

Core design principles of LangChain:
- **LCEL (LangChain Expression Language)**: Chain construction using the pipe operator (`|`)
- **Runnable Protocol**: Every component has `invoke`, `stream`, and `batch` methods
- **Component separation**: LLM, prompt, tools, and memory are independent
- **Provider-agnostic**: Switch between Claude, GPT, and Gemini with the same code

### 2.2 Basic Implementation

```python
# Building an agent with LangChain
from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools import tool
from langchain_core.prompts import ChatPromptTemplate

# 1. Tool definitions
@tool
def calculate(expression: str) -> str:
    """Calculates a math expression and returns the result. Example: '2 + 3 * 4'"""
    try:
        return str(eval(expression))
    except Exception as e:
        return f"Calculation error: {e}"

@tool
def search_web(query: str) -> str:
    """Searches the web and returns results"""
    # In practice, use SerpAPI or similar
    return f"Search results for '{query}': ..."

# 2. LLM configuration
llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)

# 3. Prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a capable assistant. Use tools to answer accurately."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}")
])

# 4. Build the agent
tools = [calculate, search_web]
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# 5. Execute
result = executor.invoke({"input": "What is the population of Japan? What percentage of the world population?"})
print(result["output"])
```

### 2.3 LangChain Architecture

```
LangChain Architecture
+------------------------------------------+
|            AgentExecutor                  |
|  +--------------------------------------+|
|  |  Agent (Reasoning Engine)             ||
|  |  +-----------+  +------------------+ ||
|  |  | LLM       |  | Prompt Template  | ||
|  |  +-----------+  +------------------+ ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  |  Tools                                ||
|  |  [Search] [Calculate] [Code] [DB]    ||
|  +--------------------------------------+|
|  +--------------------------------------+|
|  |  Memory                               ||
|  |  [ConversationBuffer] [Summary]      ||
|  +--------------------------------------+|
+------------------------------------------+
```

### 2.4 LCEL (LangChain Expression Language) in Detail

LCEL is the recommended pattern since LangChain v0.2, enabling declarative chain construction.

```python
# Building chains with LCEL
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser
from langchain_anthropic import ChatAnthropic
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

# Basic LCEL chain
prompt = ChatPromptTemplate.from_template(
    "Explain the following topic in 3 sentences: {topic}"
)
llm = ChatAnthropic(model="claude-sonnet-4-20250514")
parser = StrOutputParser()

# Build chain with pipe operator
chain = prompt | llm | parser
result = chain.invoke({"topic": "machine learning"})

# Complex chain: parallel execution + merging
from langchain_core.runnables import RunnableParallel

analysis_chain = RunnableParallel(
    summary=prompt_summary | llm | parser,
    keywords=prompt_keywords | llm | JsonOutputParser(),
    sentiment=prompt_sentiment | llm | parser
)

# Run 3 analyses in parallel with a single call
result = analysis_chain.invoke({"text": "Text to analyze..."})
# result = {"summary": "...", "keywords": [...], "sentiment": "positive"}
```

```python
# Embedding custom logic in LCEL
from langchain_core.runnables import RunnableLambda

def preprocess(input_data: dict) -> dict:
    """Pre-processing: clean input text"""
    text = input_data["text"]
    text = text.strip().lower()
    return {"cleaned_text": text, "original": input_data["text"]}

def postprocess(output: str) -> dict:
    """Post-processing: format the output"""
    return {
        "result": output,
        "word_count": len(output.split()),
        "char_count": len(output)
    }

# Embed custom functions into the chain
pipeline = (
    RunnableLambda(preprocess)
    | prompt
    | llm
    | parser
    | RunnableLambda(postprocess)
)
```

### 2.5 LangChain Streaming Support

```python
# Streaming-capable agent
import asyncio
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate

llm = ChatAnthropic(model="claude-sonnet-4-20250514", streaming=True)

# Synchronous streaming
for chunk in chain.stream({"topic": "quantum computers"}):
    print(chunk, end="", flush=True)

# Asynchronous streaming
async def stream_response():
    async for chunk in chain.astream({"topic": "quantum computers"}):
        print(chunk, end="", flush=True)

asyncio.run(stream_response())

# Event streaming (including tool execution)
async def stream_agent_events():
    async for event in executor.astream_events(
        {"input": "Check the weather in Tokyo"},
        version="v2"
    ):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            # Token from LLM
            content = event["data"]["chunk"].content
            if content:
                print(content, end="", flush=True)
        elif kind == "on_tool_start":
            print(f"\n[Tool started: {event['name']}]")
        elif kind == "on_tool_end":
            print(f"\n[Tool completed: {event['name']}]")
```

### 2.6 LangChain Memory Integration

```python
# Memory integration pattern in LangChain
from langchain.memory import ConversationBufferWindowMemory
from langchain_core.prompts import MessagesPlaceholder

# Prompt with memory
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a capable assistant."),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}")
])

# Window memory (retains last 5 exchanges)
memory = ConversationBufferWindowMemory(
    k=5,
    memory_key="chat_history",
    return_messages=True
)

# Agent with memory
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=True
)

# Continuous conversation
executor.invoke({"input": "My name is Tanaka"})
executor.invoke({"input": "Do you remember my name?"})
# → "Yes, your name is Tanaka"
```

### 2.7 LangChain Debugging and Tracing

```python
# Tracing with LangSmith
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls_..."
os.environ["LANGCHAIN_PROJECT"] = "my-agent-project"

# All LLM calls and tool executions are automatically tracked
result = executor.invoke({"input": "Perform data analysis"})

# Debugging with custom callbacks
from langchain_core.callbacks import BaseCallbackHandler

class DebugCallback(BaseCallbackHandler):
    def on_llm_start(self, serialized, prompts, **kwargs):
        print(f"[LLM start] Estimated tokens: {sum(len(p) // 4 for p in prompts)}")

    def on_tool_start(self, serialized, input_str, **kwargs):
        print(f"[Tool start] {serialized.get('name', 'unknown')}: {input_str[:100]}")

    def on_tool_end(self, output, **kwargs):
        print(f"[Tool end] Result length: {len(str(output))} chars")

    def on_llm_error(self, error, **kwargs):
        print(f"[LLM error] {type(error).__name__}: {error}")

    def on_chain_end(self, outputs, **kwargs):
        print(f"[Chain end] Output keys: {list(outputs.keys())}")

# Execute with callback
result = executor.invoke(
    {"input": "Analyze this"},
    config={"callbacks": [DebugCallback()]}
)
```

---

## 3. CrewAI

### 3.1 Design Philosophy

CrewAI is a **role-based multi-agent** framework. Using real-world team structures as a metaphor, each agent is given a "role," "goal," and "backstory" to collaboratively execute tasks.

Core design principles of CrewAI:
- **Role-Playing**: Assigning "personas" to agents to improve output quality
- **Task Delegation**: Naturally describing task handoffs between agents
- **Sequential/Hierarchical Process**: Execution flow adapted to the team structure
- **Memory Integration**: Knowledge sharing mechanism between agents

### 3.2 Basic Implementation

```python
# Building a multi-agent system with CrewAI
from crewai import Agent, Task, Crew, Process

# 1. Agent definitions (role-based)
researcher = Agent(
    role="Senior Researcher",
    goal="Investigate the latest trends in AI agents",
    backstory="An AI researcher with 10 years of experience, well-versed in both academic papers and industrial applications.",
    tools=[search_tool, scrape_tool],
    llm="claude-sonnet-4-20250514",
    verbose=True
)

writer = Agent(
    role="Technical Writer",
    goal="Compile research findings into clear technical articles",
    backstory="A technical blog editor with 5 years of experience, skilled at explaining complex concepts in plain language.",
    llm="claude-sonnet-4-20250514",
    verbose=True
)

# 2. Task definitions
research_task = Task(
    description="Identify 5 key AI agent trends in 2025 and summarize each",
    expected_output="A list of 5 trends (each with approximately 200 characters of explanation)",
    agent=researcher
)

writing_task = Task(
    description="Write a technical article of approximately 2000 characters based on the research findings",
    expected_output="A technical article in Markdown format",
    agent=writer,
    context=[research_task]  # Reference research results
)

# 3. Build and run the crew
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    process=Process.sequential,  # Sequential execution
    verbose=True
)

result = crew.kickoff()
```

### 3.3 CrewAI Hierarchical Process

```python
# Hierarchical process: manager delegates tasks
from crewai import Agent, Task, Crew, Process

# Manager (added automatically)
manager = Agent(
    role="Project Manager",
    goal="Manage the team efficiently and produce high-quality deliverables",
    backstory="10 years of PM experience with deep expertise in AI development team management",
    llm="claude-sonnet-4-20250514",
    allow_delegation=True  # Allow delegation to other agents
)

# Team members
analyst = Agent(
    role="Data Analyst",
    goal="Analyze data and derive insights",
    backstory="Holds a master's degree in statistics, proficient in Python and SQL",
    tools=[query_db, create_chart],
    llm="claude-sonnet-4-20250514"
)

developer = Agent(
    role="Backend Developer",
    goal="Implement analysis results as an API",
    backstory="5 years of development experience with FastAPI and Python",
    tools=[read_file, write_file, run_tests],
    llm="claude-sonnet-4-20250514"
)

# Run with hierarchical process
crew = Crew(
    agents=[analyst, developer],
    tasks=[analysis_task, development_task, review_task],
    process=Process.hierarchical,  # Manager makes decisions
    manager_agent=manager,
    verbose=True
)

result = crew.kickoff()
```

### 3.4 CrewAI Custom Tool Definitions

```python
# Custom tools for CrewAI
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import Type

class SearchInput(BaseModel):
    query: str = Field(description="Search query")
    max_results: int = Field(default=5, description="Maximum number of results")

class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = "Search the web and retrieve the latest information"
    args_schema: Type[BaseModel] = SearchInput

    def _run(self, query: str, max_results: int = 5) -> str:
        # Actual web search implementation
        import requests
        results = []
        # Use SerpAPI or similar
        response = requests.get(
            "https://serpapi.com/search",
            params={"q": query, "num": max_results, "api_key": "..."}
        )
        for item in response.json().get("organic_results", [])[:max_results]:
            results.append(f"- {item['title']}: {item['snippet']}")
        return "\n".join(results) if results else "No results found"

# Compatibility with LangChain tools
from langchain.tools import tool as langchain_tool

@langchain_tool
def database_query(sql: str) -> str:
    """Executes an SQL query and retrieves results from the database"""
    # CrewAI can use LangChain tools directly
    import sqlite3
    conn = sqlite3.connect("data.db")
    result = conn.execute(sql).fetchall()
    conn.close()
    return str(result)
```

### 3.5 CrewAI Memory System

```python
# CrewAI memory configuration
from crewai import Crew

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    process=Process.sequential,
    memory=True,  # Enable memory
    # Memory types:
    # - Short-term: conversational memory during task execution
    # - Long-term: memory of past task results
    # - Entity: memory of entities (names, organizations, etc.)
    embedder={
        "provider": "openai",
        "config": {
            "model": "text-embedding-3-small"
        }
    },
    verbose=True
)

# From the second run onward, past results are used as long-term memory
result1 = crew.kickoff(inputs={"topic": "AI agents"})
result2 = crew.kickoff(inputs={"topic": "Applications of AI agents"})
# In result2, the result of result1 is referenced as long-term memory
```

---

## 4. AutoGen

### 4.1 Design Philosophy

AutoGen (Microsoft) is a **conversation-based multi-agent** framework. Agents exchange chat messages to accomplish tasks. The "ConversableAgent" is the fundamental unit.

Key design changes in AutoGen v0.4:
- **Actor Model**: Agents as actors with asynchronous message passing
- **Runtime**: A runtime that manages agent lifecycles
- **Handoff**: Control transfer pattern between agents
- **Team**: Organizing agents into teams

### 4.2 Basic Implementation

```python
# Multi-agent conversation with AutoGen
from autogen import ConversableAgent

# 1. Agent definitions
coder = ConversableAgent(
    name="Coder",
    system_message="""You are a Python expert.
    Write code based on the given requirements.
    Provide code in a directly executable format.""",
    llm_config={"model": "claude-sonnet-4-20250514"}
)

reviewer = ConversableAgent(
    name="Reviewer",
    system_message="""You are an expert code reviewer.
    Evaluate the code for quality, security, and performance.
    If there are issues, provide specific suggestions for improvement.""",
    llm_config={"model": "claude-sonnet-4-20250514"}
)

# 2. Conversation (automatically exchanges messages)
result = coder.initiate_chat(
    reviewer,
    message="Write a Python script that reads a file and converts it to CSV",
    max_turns=4  # Maximum 4 exchanges
)
```

### 4.3 AutoGen v0.4 Architecture

```python
# New API in AutoGen v0.4 (Actor Model based)
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination
from autogen_ext.models.anthropic import AnthropicChatCompletionClient

# Model client configuration
model_client = AnthropicChatCompletionClient(
    model="claude-sonnet-4-20250514"
)

# Agent definitions (v0.4 style)
planner = AssistantAgent(
    name="planner",
    model_client=model_client,
    system_message="""You are a project planner.
    Analyze requirements and formulate an implementation plan.
    When the plan is complete, say 'HANDOFF_TO_CODER'."""
)

coder = AssistantAgent(
    name="coder",
    model_client=model_client,
    system_message="""You are a Python developer.
    Implement the code based on the planner's plan.
    When implementation is complete, say 'HANDOFF_TO_REVIEWER'."""
)

reviewer_agent = AssistantAgent(
    name="reviewer",
    model_client=model_client,
    system_message="""You are a code reviewer.
    Evaluate the code quality.
    If there are no issues, say 'APPROVE'."""
)

# Team configuration
termination = TextMentionTermination("APPROVE")

team = RoundRobinGroupChat(
    participants=[planner, coder, reviewer_agent],
    termination_condition=termination,
    max_turns=10
)

# Execute
import asyncio

async def main():
    result = await team.run(
        task="Create a script that reads a CSV file and analyzes the data"
    )
    print(result)

asyncio.run(main())
```

### 4.4 AutoGen Code Execution Feature

```python
# Sandboxed code execution in AutoGen
from autogen_ext.code_executors.docker import DockerCommandLineCodeExecutor
from autogen_agentchat.agents import CodeExecutorAgent

# Docker-based code execution environment
code_executor = DockerCommandLineCodeExecutor(
    image="python:3.11-slim",
    timeout=60,
    work_dir="/workspace"
)

# Code executor agent
executor_agent = CodeExecutorAgent(
    name="executor",
    code_executor=code_executor
)

# Automatically executes code written by the coder
team = RoundRobinGroupChat(
    participants=[coder, executor_agent, reviewer_agent],
    max_turns=8
)
```

### 4.5 AutoGen Human-in-the-Loop

```python
# Human intervention pattern in AutoGen
from autogen_agentchat.agents import UserProxyAgent

# Human proxy agent
human_proxy = UserProxyAgent(
    name="human",
    # Whether to approve automatically
    human_input_mode="ALWAYS",  # Always require human input
    # "NEVER": no human input
    # "TERMINATE": only at termination
)

# Human participates in the conversation
result = coder.initiate_chat(
    human_proxy,
    message="Please tell me your requirements",
    max_turns=10
)
```

---

## 5. Claude Agent SDK

### 5.1 Design Philosophy

The official SDK from Anthropic. It enables building a **simple agent loop** with minimal code, with native MCP tool integration as a key feature.

Core design principles of the Claude Agent SDK:
- **Minimal Abstraction**: Keep the level of framework abstraction to a minimum
- **Native Tool Use**: Directly leverage Claude API's tool_use
- **MCP First**: Native integration with the MCP protocol
- **Full Control**: Every step of the agent loop is controllable by the developer

```python
# Building an agent with the Claude Agent SDK
import anthropic

client = anthropic.Anthropic()

# Tool definitions
tools = [
    {
        "name": "read_file",
        "description": "Reads the contents of a specified file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path"}
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Writes content to a specified file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"}
            },
            "required": ["path", "content"]
        }
    }
]

def run_agent(user_message: str):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system="You are a file operations agent.",
            tools=tools,
            messages=messages
        )

        if response.stop_reason == "end_turn":
            return extract_text(response)

        # Process tool calls
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

### 5.2 Advanced Implementation Patterns for the Claude Agent SDK

```python
# Advanced agent loop (with error handling, retries, and cost tracking)
import anthropic
import time
import json
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class AgentMetrics:
    """Metrics for agent execution"""
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    tool_calls: int = 0
    llm_calls: int = 0
    errors: int = 0
    start_time: float = field(default_factory=time.time)

    @property
    def elapsed_seconds(self) -> float:
        return time.time() - self.start_time

    @property
    def estimated_cost_usd(self) -> float:
        # Approximate pricing for Claude Sonnet
        input_cost = self.total_input_tokens * 3.0 / 1_000_000
        output_cost = self.total_output_tokens * 15.0 / 1_000_000
        return input_cost + output_cost

class ClaudeAgent:
    def __init__(
        self,
        system_prompt: str,
        tools: list[dict],
        model: str = "claude-sonnet-4-20250514",
        max_turns: int = 20,
        max_retries: int = 3
    ):
        self.client = anthropic.Anthropic()
        self.system_prompt = system_prompt
        self.tools = tools
        self.model = model
        self.max_turns = max_turns
        self.max_retries = max_retries
        self.tool_handlers = {}
        self.metrics = AgentMetrics()

    def register_tool(self, name: str, handler):
        """Register a tool handler"""
        self.tool_handlers[name] = handler

    def _execute_tool(self, name: str, input_data: dict) -> str:
        """Execute a tool safely"""
        handler = self.tool_handlers.get(name)
        if not handler:
            return json.dumps({"error": f"Tool '{name}' is not registered"})
        try:
            result = handler(**input_data)
            self.metrics.tool_calls += 1
            return json.dumps(result) if not isinstance(result, str) else result
        except Exception as e:
            self.metrics.errors += 1
            return json.dumps({
                "error": f"{type(e).__name__}: {str(e)}",
                "tool": name,
                "input": input_data
            })

    def run(self, user_message: str) -> dict:
        """Run the agent"""
        messages = [{"role": "user", "content": user_message}]
        self.metrics = AgentMetrics()  # Reset metrics

        for turn in range(self.max_turns):
            # LLM call with retry
            response = self._call_llm_with_retry(messages)
            if response is None:
                return {"error": "LLM call failed", "metrics": self.metrics}

            self.metrics.llm_calls += 1
            self.metrics.total_input_tokens += response.usage.input_tokens
            self.metrics.total_output_tokens += response.usage.output_tokens

            # Final answer
            if response.stop_reason == "end_turn":
                text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        text += block.text
                return {
                    "output": text,
                    "metrics": self.metrics
                }

            # Process tool calls
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self._execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        return {"error": "Maximum number of turns reached", "metrics": self.metrics}

    def _call_llm_with_retry(self, messages: list) -> Optional[object]:
        """LLM call with retry"""
        for attempt in range(self.max_retries):
            try:
                return self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=self.system_prompt,
                    tools=self.tools,
                    messages=messages
                )
            except anthropic.RateLimitError:
                wait = 2 ** attempt * 10
                print(f"Rate limited. Waiting {wait} seconds...")
                time.sleep(wait)
            except anthropic.APIError as e:
                print(f"API error (attempt {attempt + 1}): {e}")
                if attempt == self.max_retries - 1:
                    return None
                time.sleep(2 ** attempt)
        return None

# Usage example
agent = ClaudeAgent(
    system_prompt="You are a data analysis agent.",
    tools=[
        {
            "name": "query_database",
            "description": "Executes an SQL query to retrieve data",
            "input_schema": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "SQL SELECT statement"}
                },
                "required": ["sql"]
            }
        }
    ]
)

agent.register_tool("query_database", lambda sql: execute_sql(sql))
result = agent.run("Analyze the monthly trend of sales data")
print(f"Result: {result['output']}")
print(f"Cost: ${result['metrics'].estimated_cost_usd:.4f}")
print(f"Tool calls: {result['metrics'].tool_calls}")
```

### 5.3 Claude Agent SDK + MCP Integration

```python
# Integration of Claude Agent SDK with MCP
import anthropic
import subprocess
import json

class MCPClient:
    """stdio communication client for MCP servers"""

    def __init__(self, command: list[str]):
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        self._request_id = 0

    def _send_request(self, method: str, params: dict = None) -> dict:
        self._request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params or {}
        }
        self.process.stdin.write(json.dumps(request) + "\n")
        self.process.stdin.flush()
        response_line = self.process.stdout.readline()
        return json.loads(response_line)

    def list_tools(self) -> list[dict]:
        """Retrieve the list of tools from the MCP server"""
        response = self._send_request("tools/list")
        return response.get("result", {}).get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> str:
        """Execute a tool on the MCP server"""
        response = self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        result = response.get("result", {})
        contents = result.get("content", [])
        return "\n".join(c.get("text", "") for c in contents)

    def close(self):
        self.process.terminate()

# MCP-integrated agent
def run_mcp_agent(user_message: str, mcp_servers: dict[str, list[str]]):
    """An agent that uses multiple MCP servers"""
    client = anthropic.Anthropic()

    # Start MCP clients
    mcp_clients = {}
    all_tools = []
    tool_to_server = {}

    for name, command in mcp_servers.items():
        mcp = MCPClient(command)
        mcp_clients[name] = mcp

        # Retrieve tool list and convert to Claude format
        for tool in mcp.list_tools():
            claude_tool = {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "input_schema": tool.get("inputSchema", {})
            }
            all_tools.append(claude_tool)
            tool_to_server[tool["name"]] = name

    try:
        messages = [{"role": "user", "content": user_message}]

        while True:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system="You are an agent that leverages MCP tools.",
                tools=all_tools,
                messages=messages
            )

            if response.stop_reason == "end_turn":
                return extract_text(response)

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    server_name = tool_to_server[block.name]
                    result = mcp_clients[server_name].call_tool(
                        block.name, block.input
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
    finally:
        for mcp in mcp_clients.values():
            mcp.close()

# Usage example
result = run_mcp_agent(
    "Read and analyze the project files",
    mcp_servers={
        "filesystem": ["npx", "-y", "@anthropic/mcp-filesystem", "/project"],
        "database": ["python", "db_mcp_server.py"]
    }
)
```

---

## 6. Framework Comparison

### 6.1 Feature Comparison Table

| Feature | LangChain | CrewAI | AutoGen | Claude SDK |
|---------|-----------|--------|---------|------------|
| Multi-agent | Via LangGraph | Native | Native | Manual implementation |
| Tool integration | Rich | LangChain-compatible | Custom | MCP/Native |
| Memory management | Multiple types | Basic | Conversation history | Manual implementation |
| Learning curve | Medium | Low | Low-Medium | Low |
| Customizability | High | Medium | Medium | Highest |
| Production track record | High | Medium | Medium | High |
| Documentation | Extensive | Good | Good | Extensive |
| Community | Largest | Growing | Growing | Growing |

### 6.2 Performance Comparison

```
Overhead by Framework (approximate)

Task: Single tool execution
+-------------------+--------+----------+---------+
| Framework         | Added  | Memory   | Dep.    |
|                   | Latency| Usage    | Packages|
+-------------------+--------+----------+---------+
| Claude SDK (direct)| ~5ms  | ~20MB    | 1       |
| LangChain         | ~50ms  | ~100MB   | 20+     |
| CrewAI            | ~80ms  | ~150MB   | 30+     |
| AutoGen           | ~60ms  | ~120MB   | 15+     |
+-------------------+--------+----------+---------+

Task: 3-agent collaboration (5 turns)
+-------------------+--------+----------+---------+
| Framework         | Added  | Memory   | LLM     |
|                   | Latency| Peak     | Calls   |
+-------------------+--------+----------+---------+
| Claude SDK (manual)| ~20ms | ~50MB    | Minimal |
| LangGraph         | ~100ms | ~200MB   | Optimizable|
| CrewAI            | ~200ms | ~300MB   | Fixed   |
| AutoGen           | ~150ms | ~250MB   | Fixed   |
+-------------------+--------+----------+---------+
```

### 6.3 Selection Flowchart

```
Which framework is best for your project?

Q1: Do you need coordination between multiple agents?
├── YES → Q2: Role-based or message-based?
│   ├── Role-based → CrewAI
│   └── Message-based → AutoGen
└── NO → Q3: Do you need advanced customization?
    ├── YES → Q4: Do you need a rich set of existing tools?
    │   ├── YES → LangChain + LangGraph
    │   └── NO → Claude Agent SDK
    └── NO → LangChain (basic Agent)
```

### 6.4 Detailed Selection Matrix

| Use Case | Recommended Framework | Reason |
|----------|-----------------------|--------|
| Prototype / PoC | Claude SDK | Minimal code, fastest startup |
| RAG + Chatbot | LangChain | Rich RAG components |
| Multi-expert collaboration | CrewAI | Intuitive role definitions |
| Code review automation | AutoGen | Interactive review flow |
| Complex workflows | LangGraph | State management + conditional branching |
| High-customization API | Claude SDK | Full control |
| Existing LangChain project | LangGraph | Seamless migration |
| Human-in-the-Loop | AutoGen / LangGraph | Built-in approval flows |

### 6.5 Cost Comparison (Monthly Estimate)

```
Estimated cost for processing 10,000 requests per month

                    Claude SDK   LangChain   CrewAI   AutoGen
                    ──────────   ─────────   ──────   ───────
LLM API cost        $500        $500        $800     $700
(Baseline is the same, but framework overhead adds extra tokens)
                                (internal    (agent-to-agent
                                 prompts)     communication)

Infrastructure cost $50         $100        $100     $100
(Differences in dependencies, memory usage)

Development/maintenance 40h     30h         25h      30h
(Labor savings from framework features)

Initial setup effort 20h        10h         8h       12h
(Framework learning + setup)
```

---

## 7. Migration Strategy Between Frameworks

### 7.1 Framework-Agnostic Design with an Abstraction Layer

```python
# Framework-agnostic agent interface
from abc import ABC, abstractmethod
from typing import Any
from dataclasses import dataclass

@dataclass
class AgentResult:
    """Framework-agnostic agent result"""
    output: str
    tool_calls: list[dict]
    metadata: dict

class AgentInterface(ABC):
    """Framework-agnostic agent interface"""

    @abstractmethod
    def run(self, goal: str, context: dict = None) -> AgentResult:
        """Execute a task and return the result"""
        ...

    @abstractmethod
    def add_tool(self, name: str, description: str, handler: callable):
        """Add a tool"""
        ...

    @abstractmethod
    def set_memory(self, memory_store: Any):
        """Set a memory store"""
        ...

class ToolDefinition:
    """Framework-agnostic tool definition"""
    def __init__(self, name: str, description: str,
                 parameters: dict, handler: callable):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler

    def to_langchain(self):
        """Convert to LangChain format"""
        from langchain.tools import StructuredTool
        return StructuredTool.from_function(
            func=self.handler,
            name=self.name,
            description=self.description
        )

    def to_anthropic(self) -> dict:
        """Convert to Anthropic API format"""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters
        }

    def to_openai(self) -> dict:
        """Convert to OpenAI API format"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        }
```

### 7.2 Concrete Migration Implementation

```python
# LangChain implementation
class LangChainAgent(AgentInterface):
    def __init__(self, model_name: str = "claude-sonnet-4-20250514"):
        from langchain_anthropic import ChatAnthropic
        from langchain.agents import AgentExecutor, create_tool_calling_agent
        from langchain_core.prompts import ChatPromptTemplate

        self.llm = ChatAnthropic(model=model_name)
        self.tools = []
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "You are a capable assistant."),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}")
        ])

    def add_tool(self, name, description, handler):
        from langchain.tools import StructuredTool
        tool = StructuredTool.from_function(
            func=handler, name=name, description=description
        )
        self.tools.append(tool)

    def run(self, goal, context=None):
        from langchain.agents import AgentExecutor, create_tool_calling_agent
        agent = create_tool_calling_agent(self.llm, self.tools, self.prompt)
        executor = AgentExecutor(agent=agent, tools=self.tools)
        result = executor.invoke({"input": goal})
        return AgentResult(output=result["output"], tool_calls=[], metadata={})

    def set_memory(self, memory_store):
        pass  # Set LangChain Memory

# Claude SDK implementation
class ClaudeSDKAgent(AgentInterface):
    def __init__(self, model_name: str = "claude-sonnet-4-20250514"):
        import anthropic
        self.client = anthropic.Anthropic()
        self.model = model_name
        self.tools = []
        self.tool_handlers = {}

    def add_tool(self, name, description, handler):
        # Create tool definition in Anthropic API format
        import inspect
        sig = inspect.signature(handler)
        properties = {}
        required = []
        for param_name, param in sig.parameters.items():
            properties[param_name] = {"type": "string", "description": param_name}
            if param.default is inspect.Parameter.empty:
                required.append(param_name)

        self.tools.append({
            "name": name,
            "description": description,
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        })
        self.tool_handlers[name] = handler

    def run(self, goal, context=None):
        messages = [{"role": "user", "content": goal}]
        all_tool_calls = []

        while True:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                tools=self.tools,
                messages=messages
            )

            if response.stop_reason == "end_turn":
                text = "".join(
                    b.text for b in response.content if hasattr(b, "text")
                )
                return AgentResult(
                    output=text,
                    tool_calls=all_tool_calls,
                    metadata={"usage": response.usage}
                )

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = self.tool_handlersblock.name
                    all_tool_calls.append({
                        "name": block.name,
                        "input": block.input,
                        "result": str(result)
                    })
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

    def set_memory(self, memory_store):
        pass

# Factory pattern to switch frameworks
class AgentFactory:
    @staticmethod
    def create(framework: str, **kwargs) -> AgentInterface:
        if framework == "langchain":
            return LangChainAgent(**kwargs)
        elif framework == "claude_sdk":
            return ClaudeSDKAgent(**kwargs)
        else:
            raise ValueError(f"Unknown framework: {framework}")

# Usage: switch framework via configuration
import os
framework = os.environ.get("AGENT_FRAMEWORK", "claude_sdk")
agent = AgentFactory.create(framework)
agent.add_tool("search", "Search the web", lambda query: f"Search results: {query}")
result = agent.run("Tell me the latest AI news")
```

---

## 8. Production Patterns for Each Framework

### 8.1 LangChain Production Configuration

```python
# Production configuration with LangChain + LangSmith + LangServe
from langserve import add_routes
from fastapi import FastAPI
from langchain_anthropic import ChatAnthropic
from langchain_core.runnables import RunnableWithFallbacks

# LLM with fallback
primary_llm = ChatAnthropic(model="claude-sonnet-4-20250514")
fallback_llm = ChatAnthropic(model="claude-haiku-4-20250514")

llm_with_fallback = primary_llm.with_fallbacks([fallback_llm])

# Deploy agent with FastAPI
app = FastAPI(title="Agent API")

add_routes(
    app,
    chain,  # Deploy LCEL chain directly
    path="/agent",
    enable_feedback_endpoint=True,  # Collect feedback
    enable_public_trace_link_endpoint=True  # Share traces
)

# Health check
@app.get("/health")
async def health():
    return {"status": "healthy", "model": "claude-sonnet-4-20250514"}
```

### 8.2 CrewAI Production Configuration

```python
# CrewAI production configuration
from crewai import Crew
import logging

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# Monitoring with callbacks
class ProductionCallbacks:
    @staticmethod
    def on_task_start(task):
        logging.info(f"Task started: {task.description[:50]}...")

    @staticmethod
    def on_task_end(task, output):
        logging.info(f"Task completed: {task.description[:50]}... Output length: {len(str(output))}")

    @staticmethod
    def on_agent_action(agent, action):
        logging.info(f"Agent '{agent.role}' action: {action}")

# Save task output to file
from crewai import Task

report_task = Task(
    description="Create an analysis report",
    expected_output="A structured report",
    agent=analyst,
    output_file="output/report.md"  # Output file
)
```

### 8.3 Error Handling Pattern Comparison

```python
# Error handling in each framework

# --- LangChain ---
from langchain.agents import AgentExecutor

executor = AgentExecutor(
    agent=agent,
    tools=tools,
    handle_parsing_errors=True,  # Auto-recover from parse errors
    max_iterations=10,           # Maximum iterations
    early_stopping_method="generate",  # Ask LLM to summarize when limit is reached
    return_intermediate_steps=True     # Return intermediate steps
)

# --- CrewAI ---
from crewai import Crew

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    max_rpm=10,  # Maximum requests per minute (rate limit protection)
    share_crew=False,
    step_callback=lambda step: print(f"Step: {step}"),
    task_callback=lambda task: print(f"Task completed: {task}")
)

# --- AutoGen ---
# v0.4: control at the team level
team = RoundRobinGroupChat(
    participants=[planner, coder, reviewer_agent],
    termination_condition=termination,
    max_turns=10  # Prevent infinite loops
)

# --- Claude SDK ---
# Fully manual control
MAX_TURNS = 20
MAX_TOOL_ERRORS = 3
tool_error_count = 0

for turn in range(MAX_TURNS):
    response = client.messages.create(...)
    if response.stop_reason == "end_turn":
        break
    # Count and control tool errors
    for block in response.content:
        if block.type == "tool_use":
            try:
                result = execute_tool(block.name, block.input)
            except Exception:
                tool_error_count += 1
                if tool_error_count >= MAX_TOOL_ERRORS:
                    # Abort if too many errors
                    break
```

---

## 9. Emerging Framework Trends

### 9.1 Notable Emerging Frameworks

```
Frameworks to Watch in 2025

+------------------+------------------+-----------------------+
| Framework        | Features         | Use Cases             |
+------------------+------------------+-----------------------+
| DSPy             | Auto prompt opt. | RAG/pipeline opt.     |
| Semantic Kernel  | Enterprise-grade | C#/.NET environments  |
| Haystack         | Document-focused | Search/RAG pipelines  |
| LlamaIndex       | Data connection  | Structured/unstructured data|
| Pydantic AI      | Type-safe agents | Python type system    |
| Mastra           | TypeScript-first | Node.js ecosystem     |
+------------------+------------------+-----------------------+
```

### 9.2 Pydantic AI Example

```python
# Pydantic AI: type-safe agent construction
from pydantic_ai import Agent
from pydantic import BaseModel

class WeatherResult(BaseModel):
    """Type definition for weather information"""
    city: str
    temperature: float
    condition: str
    humidity: int

# Typed agent
weather_agent = Agent(
    model="anthropic:claude-sonnet-4-20250514",
    result_type=WeatherResult,  # Specify return type
    system_prompt="You are an agent that provides weather information."
)

# Execution result is type-safe
result = weather_agent.run_sync("Tell me the weather in Tokyo")
print(result.data.city)         # Guaranteed to be str
print(result.data.temperature)  # Guaranteed to be float
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Framework Overuse

```python
# BAD: Introducing a framework for a simple task
from crewai import Agent, Task, Crew
# Creating 5 Agents for a task that a single LLM call would handle...

# GOOD: Choose based on task complexity
# Simple Q&A → Direct LLM call
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": "What is a Python list comprehension?"}]
)
```

**Why it's bad**: Frameworks add debugging complexity, dependency management overhead, and performance overhead in exchange for a higher level of abstraction. Simple tasks are sufficiently handled with a direct API call.

### Anti-Pattern 2: Framework Lock-in

```python
# BAD: Over-relying on framework-specific features
class MyAgent(LangChainSpecificBaseClass):
    # Deeply coupled to LangChain's internal API
    pass

# GOOD: Add an abstraction layer to make it interchangeable
class AgentInterface(ABC):
    @abstractmethod
    def run(self, goal: str) -> str: ...

class LangChainAgent(AgentInterface):
    def run(self, goal): ...

class ClaudeSDKAgent(AgentInterface):
    def run(self, goal): ...
```

**Why it's bad**: Framework APIs change frequently (LangChain v0.1→v0.2 breaking changes are a prominent example). Adding an abstraction layer minimizes the impact when switching frameworks.

### Anti-Pattern 3: Re-implementing Framework Features

```python
# BAD: Manually re-implementing features already provided by the framework
class MyCustomMemory:
    # Reinventing LangChain's memory functionality from scratch
    pass

class MyCustomToolExecutor:
    # Reinventing the framework's tool execution from scratch
    pass

# GOOD: Use framework features and only extend what needs customization
from langchain.memory import ConversationBufferWindowMemory

class EnhancedMemory(ConversationBufferWindowMemory):
    """Extend existing memory class"""
    def save_context(self, inputs, outputs):
        super().save_context(inputs, outputs)
        # Custom logic: also save important information to long-term memory
        self._save_to_long_term(inputs, outputs)
```

### Anti-Pattern 4: Excessive Multi-Agent Design

```python
# BAD: Trying to solve everything with multi-agents
researcher = Agent(role="Researcher", ...)
validator = Agent(role="Validator", ...)
formatter = Agent(role="Formatter", ...)
reviewer = Agent(role="Reviewer", ...)
editor = Agent(role="Editor", ...)
# 5 agents = 5 LLM calls → 5x cost

# GOOD: Use the minimum number of agents necessary
# A single agent handling "research → validation → formatting" end-to-end is more efficient
agent = Agent(
    role="Researcher and Writer",
    goal="Handle everything from research to article creation",
    tools=[search_tool, format_tool],
    ...
)
```

---

## 11. Troubleshooting

### 11.1 Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| LangChain version mismatch | Version gap between langchain-core and langchain-community | Unify with `pip install -U langchain langchain-core langchain-community` |
| CrewAI agent infinite loop | Unclear task completion condition | Set `max_iter` parameter, make expected_output more specific |
| AutoGen messages too long | Conversation history bloat | Limit `max_turns`, enable summarization |
| Claude SDK rate limiting | API call frequency exceeded | Implement exponential backoff + queuing |
| Low tool call accuracy | Insufficient tool description | Add specific usage examples, input/output examples to descriptions |

### 11.2 Debug Checklist

```
Debugging procedure for framework issues

[ ] 1. Check versions
    pip list | grep langchain  (or crewai, autogen)

[ ] 2. Create a minimal reproduction case
    Verify whether the issue reproduces with direct API calls (without the framework)

[ ] 3. Raise log level
    Set verbose=True, logging.DEBUG

[ ] 4. Check token usage
    If input tokens are higher than expected,
    the framework's internal prompts may be the cause

[ ] 5. Validate tool definitions
    Verify that tool descriptions are not ambiguous

[ ] 6. Check memory state
    Verify that memory is being updated as expected

[ ] 7. Check network/API
    Verify API key validity and rate limit status
```

---

## 12. Exercises

### Exercise 1 (Basic): Framework Evaluation

Select the best framework for each of the following requirements and explain your reasoning:

1. In-house FAQ chatbot (RAG + single agent)
2. Code review automation (from the perspective of 3 reviewers)
3. Data pipeline monitoring and auto-repair
4. Automated customer support escalation

### Exercise 2 (Applied): Abstraction Layer Design

Extend `AgentInterface` and write code that adds the following features:
- Streaming support
- Metrics collection
- Dynamic tool addition and removal

### Exercise 3 (Advanced): Framework Migration

Migrate an agent implemented with LangChain AgentExecutor to a Claude Agent SDK base. The following requirements must be met:
- Convert existing tool definitions
- Port memory functionality
- Maintain test compatibility

---

## 13. FAQ

### Q1: Which framework is recommended for beginners?

**Claude Agent SDK** or **CrewAI** is recommended. The Claude Agent SDK lets you build agents with minimal code, and your understanding of the API carries over directly. CrewAI has an intuitive "role" and "task" concept that makes design straightforward, with a gentle learning curve.

### Q2: What is the difference between LangChain and LangGraph?

LangChain is suited for building **linear chains**, while LangGraph is suited for building **stateful graphs (with cycles)**. LangGraph is needed for loop structures like agents. LangChain's AgentExecutor internally implements a loop, but LangGraph should be used for complex workflows.

### Q3: Is it okay to combine multiple frameworks?

It is possible, but caution is needed. For example, a configuration where each CrewAI agent uses LangChain tools is officially supported. However, dependencies increase, so debugging complexity and maintenance costs go up. Unless there is a clear reason, it is recommended to stick with one framework.

### Q4: How should I handle framework version upgrades?

- **Pin dependency versions**: Explicitly specify versions in `requirements.txt`
- **Use abstraction layers**: Minimize direct dependencies on framework-specific APIs
- **Thorough testing**: Detect regressions early when the framework is updated
- **Monitor changelogs**: Be aware of breaking changes in advance

### Q5: Which framework is appropriate for enterprise environments?

LangChain (+ LangSmith) is the most mature. Reasons:
- Monitoring and tracing tools (LangSmith) are well-developed
- Deployment tools (LangServe) are available
- Community and documentation are the largest
- Enterprise support is available

However, if centering around Anthropic's Claude, Claude Agent SDK + MCP is the most efficient.

### Q6: When is it sufficient to go without a framework?

A framework is unnecessary when **all** of the following conditions are met:
- Single agent (no multi-agent needed)
- 5 or fewer tools
- Simple memory requirements (conversation history only)
- Team has experience with direct API usage
- Advanced customization is needed

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Rather than just theory, actually writing code and verifying behavior deepens your understanding.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Description |
|------|-------------|
| LangChain | Composable building blocks. Largest ecosystem |
| CrewAI | Role-based multi-agent. Intuitive design |
| AutoGen | Conversation-based multi-agent. Natural dialogue flow |
| Claude SDK | Build agents with minimal code. MCP integration |
| Selection criteria | Task complexity, need for multi-agent, customizability |
| Principle | Choose the minimum level of abstraction appropriate for the task |

## Recommended Next Reads

- [02-tool-use.md](./02-tool-use.md) -- Tool use and Function Calling in detail
- [../01-patterns/00-single-agent.md](../01-patterns/00-single-agent.md) -- Single agent pattern
- [../02-implementation/00-langchain-agent.md](../02-implementation/00-langchain-agent.md) -- LangChain implementation in detail

## References

1. LangChain Documentation -- https://python.langchain.com/docs/
2. CrewAI Documentation -- https://docs.crewai.com/
3. AutoGen Documentation -- https://microsoft.github.io/autogen/
4. Anthropic, "Claude API Reference" -- https://docs.anthropic.com/en/api/
5. Pydantic AI Documentation -- https://ai.pydantic.dev/
6. LangGraph Documentation -- https://langchain-ai.github.io/langgraph/
7. Model Context Protocol -- https://modelcontextprotocol.io/
