# LangChain Agent

> Chains, prompt templates, and tool integration — practical implementation patterns and best practices for building agents with LangChain.

## What You Will Learn

1. Understanding LangChain's core concepts (chains, prompts, tools)
2. Building a Tool Calling Agent and leveraging AgentExecutor
3. Implementation patterns for custom tools and advanced prompt design
4. Building flexible pipelines with LCEL (LangChain Expression Language)
5. Strategies for memory management and context control
6. Error handling and observability for production use
7. Practical techniques for cost optimization and performance tuning


## Prerequisites

Before reading this guide, familiarity with the following will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. LangChain Core Components

```
LangChain Component Architecture

+---------------------------------------------------+
|                  Application Layer                  |
+---------------------------------------------------+
|  +------------+  +-------------+  +-------------+ |
|  | Agent      |  | Chain       |  | Retriever   | |
|  | Executor   |  | (LCEL)      |  | (RAG)       | |
|  +-----+------+  +------+------+  +------+------+ |
|        |                |                |          |
+--------v----------------v----------------v----------+
|                  Core Components                     |
|  +--------+  +--------+  +--------+  +---------+   |
|  | LLM    |  | Prompt |  | Tools  |  | Memory  |   |
|  |        |  | Templ. |  |        |  |         |   |
|  +--------+  +--------+  +--------+  +---------+   |
+-----------------------------------------------------+
|                  Integrations                        |
|  [Anthropic] [OpenAI] [Chroma] [Pinecone] [...]    |
+-----------------------------------------------------+
```

### 1.1 Relationships Between Components

LangChain's design philosophy is "composability." Each component functions independently while being combinable through a unified interface.

```python
# Understanding component hierarchy
from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import BasePromptTemplate
from langchain_core.output_parsers import BaseOutputParser
from langchain_core.tools import BaseTool
from langchain_core.runnables import Runnable

# All components implement the Runnable protocol
# invoke(), ainvoke(), stream(), astream(), batch(), abatch()
# This unified interface allows arbitrary combinations

# Example: Using each component as a Runnable
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm: Runnable = ChatAnthropic(model="claude-sonnet-4-20250514")
prompt: Runnable = ChatPromptTemplate.from_template("質問: {question}")
parser: Runnable = StrOutputParser()

# Runnables are connected with the pipe operator
chain: Runnable = prompt | llm | parser

# All Runnable methods are available
result = chain.invoke({"question": "LangChainとは？"})
results = chain.batch([{"question": "Q1"}, {"question": "Q2"}])
```

### 1.2 Understanding the Package Structure

```
langchain package ecosystem

langchain-core       ... Core interfaces and abstract classes (most stable)
langchain            ... Chain and agent implementations
langchain-community  ... Third-party integrations (unofficial)
langchain-anthropic  ... Official Anthropic integration
langchain-openai     ... Official OpenAI integration
langchain-chroma     ... Official Chroma integration
langgraph            ... Stateful graph-based workflows
langsmith            ... Testing, debugging, and monitoring
```

```python
# Recommended package configuration (pyproject.toml)
# [project]
# dependencies = [
#     "langchain-core>=0.3.0,<0.4",
#     "langchain>=0.3.0,<0.4",
#     "langchain-anthropic>=0.3.0,<0.4",
#     "langgraph>=0.2.0,<0.3",
# ]

# Check versions
import langchain_core
import langchain
import langchain_anthropic
print(f"langchain-core: {langchain_core.__version__}")
print(f"langchain: {langchain.__version__}")
print(f"langchain-anthropic: {langchain_anthropic.__version__}")
```

---

## 2. LCEL (LangChain Expression Language)

### 2.1 Basic Chain

```python
# Building a chain with LCEL
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Define components
llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)

prompt = ChatPromptTemplate.from_messages([
    ("system", "あなたは{role}です。{style}で回答してください。"),
    ("human", "{input}")
])

output_parser = StrOutputParser()

# Connect with pipeline
chain = prompt | llm | output_parser

# Execute
result = chain.invoke({
    "role": "Python専門家",
    "style": "簡潔",
    "input": "リスト内包表記の使い方を教えて"
})
print(result)
```

### 2.2 Branching Chain

```python
# Chain with conditional branching
from langchain_core.runnables import RunnableBranch, RunnablePassthrough

# Classifier
classifier = (
    ChatPromptTemplate.from_template(
        "以下の質問を 'technical' / 'general' に分類: {input}"
    )
    | llm
    | StrOutputParser()
)

# Branch
branch = RunnableBranch(
    (
        lambda x: "technical" in x["classification"],
        ChatPromptTemplate.from_template(
            "技術専門家として回答: {input}"
        ) | llm | StrOutputParser()
    ),
    # Default (general answer)
    ChatPromptTemplate.from_template(
        "一般的な知識で回答: {input}"
    ) | llm | StrOutputParser()
)

# Full chain
full_chain = (
    RunnablePassthrough.assign(
        classification=lambda x: classifier.invoke(x)
    )
    | branch
)
```

### 2.3 Parallel Chain (RunnableParallel)

```python
from langchain_core.runnables import RunnableParallel

# Execute multiple processes in parallel
parallel_chain = RunnableParallel(
    summary=ChatPromptTemplate.from_template(
        "以下のテキストを3行で要約: {text}"
    ) | llm | StrOutputParser(),

    keywords=ChatPromptTemplate.from_template(
        "以下のテキストからキーワードを5つ抽出（カンマ区切り）: {text}"
    ) | llm | StrOutputParser(),

    sentiment=ChatPromptTemplate.from_template(
        "以下のテキストの感情をpositive/neutral/negativeで判定: {text}"
    ) | llm | StrOutputParser(),
)

# Get 3 results with a single call
result = parallel_chain.invoke({
    "text": "LangChainは素晴らしいフレームワークです。"
})
print(result["summary"])
print(result["keywords"])
print(result["sentiment"])
```

### 2.4 RunnableLambda and Transformation

```python
from langchain_core.runnables import RunnableLambda

# Custom transformation step
def format_results(data: dict) -> str:
    """Format results from parallel execution"""
    return f"""
## 分析結果
**要約**: {data['summary']}
**キーワード**: {data['keywords']}
**感情**: {data['sentiment']}
    """.strip()

# Integrate into chain
analysis_pipeline = (
    parallel_chain
    | RunnableLambda(format_results)
)

# Error handling with RunnableLambda
def safe_parse(text: str) -> dict:
    """Return default value on parse failure"""
    import json
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"error": "パース失敗", "raw": text}

safe_parser = RunnableLambda(safe_parse)
```

### 2.5 Fallback Chain

```python
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI

# Primary model
primary_llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    temperature=0,
    max_retries=2
)

# Fallback model
fallback_llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0
)

# LLM with fallback
resilient_llm = primary_llm.with_fallbacks([fallback_llm])

# Integrate into chain
resilient_chain = prompt | resilient_llm | output_parser

# Fallback only for specific exceptions
from anthropic import RateLimitError
resilient_llm_selective = primary_llm.with_fallbacks(
    [fallback_llm],
    exceptions_to_handle=(RateLimitError,)
)
```

### 2.6 Retry and Rate Limiting

```python
from langchain_core.runnables import RunnableConfig

# Chain with retry configuration
chain_with_retry = chain.with_retry(
    stop_after_attempt=3,
    wait_exponential_jitter=True
)

# Execution with rate limiting
from langchain_core.rate_limiters import InMemoryRateLimiter

rate_limiter = InMemoryRateLimiter(
    requests_per_second=1.0,
    check_every_n_seconds=0.1,
    max_bucket_size=10
)

llm_with_rate_limit = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    rate_limiter=rate_limiter
)
```

---

## 3. Tool Definition and Integration

### 3.1 Creating Custom Tools

```python
# Method 1: @tool decorator
from langchain.tools import tool
from typing import Optional

@tool
def search_database(
    query: str,
    table: str = "products",
    limit: int = 10
) -> str:
    """SQLiteデータベースを検索する。

    Args:
        query: 検索キーワード
        table: 検索対象テーブル（products, users, orders）
        limit: 最大結果数
    """
    # Actual DB search process
    import sqlite3
    conn = sqlite3.connect("app.db")
    cursor = conn.execute(
        f"SELECT * FROM {table} WHERE name LIKE ? LIMIT ?",
        (f"%{query}%", limit)
    )
    results = cursor.fetchall()
    conn.close()
    return str(results)

# Method 2: StructuredTool (more detailed control)
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

class EmailInput(BaseModel):
    to: str = Field(description="送信先メールアドレス")
    subject: str = Field(description="件名")
    body: str = Field(description="本文")

def send_email(to: str, subject: str, body: str) -> str:
    # Email sending process
    return f"メール送信完了: {to}"

email_tool = StructuredTool.from_function(
    func=send_email,
    name="send_email",
    description="メールを送信する。重要な通知や報告に使用。",
    args_schema=EmailInput,
    return_direct=False
)

# Method 3: Inheriting BaseTool (most flexible)
from langchain.tools import BaseTool

class WebScraperTool(BaseTool):
    name: str = "web_scraper"
    description: str = "指定URLのWebページ内容を取得する"

    def _run(self, url: str) -> str:
        import requests
        from bs4 import BeautifulSoup
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        return soup.get_text()[:2000]

    async def _arun(self, url: str) -> str:
        # Async version
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                text = await response.text()
                return text[:2000]
```

### 3.2 Advanced Tool Definition Patterns

```python
# Tool with error handling
@tool(handle_tool_error=True)
def risky_operation(query: str) -> str:
    """外部APIに問い合わせる（エラー時は自動リカバリ）。

    Args:
        query: 問い合わせ内容
    """
    import requests
    try:
        response = requests.get(
            f"https://api.example.com/search?q={query}",
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise ToolException(f"API呼び出し失敗: {e}")

# Custom error handler
from langchain_core.tools import ToolException

def handle_error(error: ToolException) -> str:
    return f"エラーが発生しました。別の方法を試してください: {str(error)}"

@tool(handle_tool_error=handle_error)
def external_api_call(endpoint: str) -> str:
    """外部APIを呼び出す。

    Args:
        endpoint: APIエンドポイントのパス
    """
    pass

# Async-only tool
from langchain_core.tools import StructuredTool
import asyncio

async def async_web_search(query: str, max_results: int = 5) -> str:
    """非同期でWeb検索を実行する"""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://api.search.example.com/search",
            params={"q": query, "limit": max_results}
        ) as response:
            data = await response.json()
            return str(data["results"])

async_search_tool = StructuredTool.from_function(
    coroutine=async_web_search,
    name="async_web_search",
    description="非同期でWeb検索を実行する"
)

# Dynamic tool generation
def create_database_tool(db_path: str, table_name: str) -> BaseTool:
    """Dynamically generate a tool for each database table"""
    @tool(name=f"query_{table_name}")
    def query_table(condition: str) -> str:
        f"""{table_name}テーブルを検索する。

        Args:
            condition: WHERE句の条件式
        """
        import sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.execute(
            f"SELECT * FROM {table_name} WHERE {condition} LIMIT 20"
        )
        results = cursor.fetchall()
        conn.close()
        return str(results)
    return query_table

# Auto-generate tools for each table
tables = ["users", "products", "orders", "reviews"]
db_tools = [create_database_tool("app.db", t) for t in tables]
```

### 3.3 Tool Composition Patterns

```
Tool Composition Patterns

1. Flat composition (all tools provided directly)
   Agent ── [Tool A, Tool B, Tool C, Tool D]

2. Toolkit composition (grouped by category)
   Agent ── [DB Toolkit]  ── [query, insert, update]
        ── [Web Toolkit] ── [search, scrape, download]

3. Dynamic composition (selected based on task)
   Agent ── TaskClassifier ── coding: [read, write, run]
                           ── research: [search, scrape, summarize]
```

### 3.4 Implementing Toolkits

```python
# Creating a custom toolkit
from langchain_core.tools import BaseToolkit

class DataAnalysisToolkit(BaseToolkit):
    """Data analysis toolkit"""
    db_path: str

    def get_tools(self) -> list[BaseTool]:
        return [
            self._create_query_tool(),
            self._create_stats_tool(),
            self._create_plot_tool(),
        ]

    def _create_query_tool(self) -> BaseTool:
        db_path = self.db_path

        @tool
        def run_sql_query(query: str) -> str:
            """SQLクエリを実行してデータを取得する。

            Args:
                query: 実行するSQLクエリ（SELECT文のみ許可）
            """
            if not query.strip().upper().startswith("SELECT"):
                return "エラー: SELECT文のみ実行できます"
            import sqlite3
            conn = sqlite3.connect(db_path)
            try:
                cursor = conn.execute(query)
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return f"列: {columns}\nデータ: {rows[:50]}"
            except Exception as e:
                return f"クエリエラー: {e}"
            finally:
                conn.close()
        return run_sql_query

    def _create_stats_tool(self) -> BaseTool:
        @tool
        def calculate_statistics(data: str) -> str:
            """数値データの基本統計量を計算する。

            Args:
                data: カンマ区切りの数値データ
            """
            import statistics
            nums = [float(x.strip()) for x in data.split(",")]
            return f"""
平均: {statistics.mean(nums):.2f}
中央値: {statistics.median(nums):.2f}
標準偏差: {statistics.stdev(nums):.2f}
最小値: {min(nums)}
最大値: {max(nums)}
"""
        return calculate_statistics

    def _create_plot_tool(self) -> BaseTool:
        @tool
        def create_chart(
            chart_type: str,
            x_data: str,
            y_data: str,
            title: str = "Chart"
        ) -> str:
            """グラフを作成してファイルに保存する。

            Args:
                chart_type: グラフの種類（bar, line, scatter, pie）
                x_data: X軸データ（カンマ区切り）
                y_data: Y軸データ（カンマ区切り）
                title: グラフのタイトル
            """
            import matplotlib.pyplot as plt
            x = x_data.split(",")
            y = [float(v) for v in y_data.split(",")]

            fig, ax = plt.subplots()
            if chart_type == "bar":
                ax.bar(x, y)
            elif chart_type == "line":
                ax.plot(x, y, marker="o")
            elif chart_type == "scatter":
                ax.scatter(range(len(y)), y)
            elif chart_type == "pie":
                ax.pie(y, labels=x, autopct='%1.1f%%')
            ax.set_title(title)

            filepath = f"/tmp/{title.replace(' ', '_')}.png"
            plt.savefig(filepath, dpi=150, bbox_inches="tight")
            plt.close()
            return f"グラフを保存: {filepath}"
        return create_chart

# Using the toolkit
toolkit = DataAnalysisToolkit(db_path="analytics.db")
tools = toolkit.get_tools()
```

---

## 4. AgentExecutor

### 4.1 Standard Agent Construction

```python
# Building a Tool Calling Agent
from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# LLM
llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    temperature=0,
    max_tokens=4096
)

# Prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", """あなたは有能なリサーチアシスタントです。
ユーザーの質問に対して、必要に応じてツールを使い、正確な情報を提供してください。
情報源がある場合は必ず引用してください。"""),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

# Tools
tools = [search_database, email_tool, WebScraperTool()]

# Create agent
agent = create_tool_calling_agent(llm, tools, prompt)

# AgentExecutor (execution engine)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,          # Display execution process
    max_iterations=15,     # Maximum iterations
    max_execution_time=120, # Timeout (seconds)
    handle_parsing_errors=True,  # Auto-handle parse errors
    return_intermediate_steps=True  # Also return intermediate steps
)

# Execute
result = executor.invoke({
    "input": "最新のAIエージェントフレームワークを調べて比較表を作って",
    "chat_history": []
})

print(result["output"])
for step in result["intermediate_steps"]:
    print(f"  Tool: {step[0].tool}, Result: {step[1][:100]}...")
```

### 4.2 Streaming Execution

```python
# Display the agent's thinking process in real time via streaming
async def stream_agent():
    async for event in executor.astream_events(
        {"input": "Pythonの非同期処理について解説して"},
        version="v2"
    ):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            # LLM token output
            print(event["data"]["chunk"].content, end="", flush=True)
        elif kind == "on_tool_start":
            # Tool execution started
            print(f"\n[ツール開始: {event['name']}]")
        elif kind == "on_tool_end":
            # Tool execution completed
            print(f"[ツール完了: {event['name']}]")
```

### 4.3 Implementing a Custom Agent

```python
# Implementing a fully custom Agent
from langchain_core.agents import AgentAction, AgentFinish
from langchain_core.runnables import RunnableSerializable
from typing import Union

class CustomReasoningAgent(RunnableSerializable):
    """Agent with custom reasoning logic"""
    llm: ChatAnthropic
    tools: list[BaseTool]
    system_prompt: str
    max_reasoning_steps: int = 5

    def invoke(
        self,
        input: dict,
        config: RunnableConfig | None = None
    ) -> Union[AgentAction, AgentFinish]:
        messages = self._build_messages(input)
        response = self.llm.invoke(messages, config=config)
        return self._parse_response(response, input)

    def _build_messages(self, input: dict) -> list:
        from langchain_core.messages import SystemMessage, HumanMessage

        messages = [SystemMessage(content=self.system_prompt)]

        # Conversation history
        if "chat_history" in input:
            messages.extend(input["chat_history"])

        messages.append(HumanMessage(content=input["input"]))

        # Intermediate steps
        if "intermediate_steps" in input:
            for action, result in input["intermediate_steps"]:
                messages.append(HumanMessage(
                    content=f"ツール'{action.tool}'の結果: {result}"
                ))

        return messages

    def _parse_response(self, response, input: dict) -> Union[AgentAction, AgentFinish]:
        content = response.content

        # Detect tool calls
        if response.tool_calls:
            tool_call = response.tool_calls[0]
            return AgentAction(
                tool=tool_call["name"],
                tool_input=tool_call["args"],
                log=f"ツール呼び出し: {tool_call['name']}"
            )

        # Final answer
        return AgentFinish(
            return_values={"output": content},
            log="最終回答を生成"
        )
```

### 4.4 Multi-Tool Execution Pattern

```python
# Call multiple tools in a single step (Parallel Tool Calling)
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    temperature=0
)

# Claude can return multiple tool_calls in a single response
# AgentExecutor executes these in parallel

@tool
def get_weather(city: str) -> str:
    """指定都市の天気を取得する。

    Args:
        city: 都市名
    """
    # Weather API call
    return f"{city}: 晴れ 25°C"

@tool
def get_exchange_rate(currency_pair: str) -> str:
    """為替レートを取得する。

    Args:
        currency_pair: 通貨ペア（例: USD/JPY）
    """
    rates = {"USD/JPY": "150.5", "EUR/JPY": "163.2", "GBP/JPY": "190.1"}
    return f"{currency_pair}: {rates.get(currency_pair, '不明')}"

@tool
def get_stock_price(symbol: str) -> str:
    """株価を取得する。

    Args:
        symbol: 銘柄コード
    """
    return f"{symbol}: ¥3,450 (+2.1%)"

tools = [get_weather, get_exchange_rate, get_stock_price]

# For this input, Claude will call all 3 tools simultaneously
# "東京の天気、USD/JPYの為替、7203の株価を教えて"
```

---

## 5. Memory Integration

### 5.1 Basic Memory Configuration

```python
# Agent with conversation memory
from langchain.memory import ConversationBufferWindowMemory

memory = ConversationBufferWindowMemory(
    memory_key="chat_history",
    return_messages=True,
    k=10  # Keep the last 10 conversations
)

executor_with_memory = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=True
)

# Continuous conversation
executor_with_memory.invoke({"input": "PythonのFastAPIについて教えて"})
executor_with_memory.invoke({"input": "それとFlaskの違いは？"})  # Maintains context
```

### 5.2 Memory Strategy Comparison and Implementation

```python
# 1. ConversationBufferMemory: Retains all conversations (watch memory usage)
from langchain.memory import ConversationBufferMemory
buffer_memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

# 2. ConversationBufferWindowMemory: Retains only the last N conversations
from langchain.memory import ConversationBufferWindowMemory
window_memory = ConversationBufferWindowMemory(
    memory_key="chat_history",
    return_messages=True,
    k=20  # Last 20 turns
)

# 3. ConversationSummaryMemory: Retains via summarization (for long conversations)
from langchain.memory import ConversationSummaryMemory
summary_memory = ConversationSummaryMemory(
    llm=ChatAnthropic(model="claude-haiku-4-20250514"),
    memory_key="chat_history",
    return_messages=True
)

# 4. ConversationSummaryBufferMemory: Summary + recent buffer
from langchain.memory import ConversationSummaryBufferMemory
summary_buffer_memory = ConversationSummaryBufferMemory(
    llm=ChatAnthropic(model="claude-haiku-4-20250514"),
    memory_key="chat_history",
    return_messages=True,
    max_token_limit=2000  # Summarizes when this token count is exceeded
)

# 5. Persistent memory (using Redis)
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import RedisChatMessageHistory

redis_history = RedisChatMessageHistory(
    session_id="user-123-session-456",
    url="redis://localhost:6379",
    ttl=3600  # Expires after 1 hour
)

persistent_memory = ConversationBufferWindowMemory(
    memory_key="chat_history",
    chat_memory=redis_history,
    return_messages=True,
    k=50
)
```

### 5.3 Semantic Memory

```python
# Semantic search memory using a vector DB
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import Chroma
from langchain_anthropic import ChatAnthropic

# Vector store configuration
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-base"
)

vectorstore = Chroma(
    collection_name="conversation_memory",
    embedding_function=embeddings,
    persist_directory="./memory_db"
)

retriever = vectorstore.as_retriever(
    search_kwargs={"k": 5}  # Retrieve top 5 by relevance
)

semantic_memory = VectorStoreRetrieverMemory(
    retriever=retriever,
    memory_key="relevant_history"
)

# Automatically searches and provides relevant content from past conversations
```

---

## 6. Output Parsers

### 6.1 Structured Output

```python
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import Optional

# Define output schema
class TaskAnalysis(BaseModel):
    task_name: str = Field(description="タスクの名前")
    priority: str = Field(description="優先度（high/medium/low）")
    estimated_hours: float = Field(description="推定所要時間")
    dependencies: list[str] = Field(description="依存タスクのリスト")
    risks: Optional[list[str]] = Field(description="リスク要因", default=None)

# JSON output parser
parser = JsonOutputParser(pydantic_object=TaskAnalysis)

prompt = ChatPromptTemplate.from_messages([
    ("system", "タスクを分析して以下のフォーマットで回答してください。\n{format_instructions}"),
    ("human", "タスク: {task_description}")
])

chain = prompt | llm | parser

result = chain.invoke({
    "task_description": "ECサイトの決済機能のリファクタリング",
    "format_instructions": parser.get_format_instructions()
})

print(f"タスク: {result['task_name']}")
print(f"優先度: {result['priority']}")
print(f"推定時間: {result['estimated_hours']}時間")
```

### 6.2 Streaming-Compatible Parser

```python
from langchain_core.output_parsers import JsonOutputParser

# Parse partial JSON during streaming
async def stream_structured_output():
    parser = JsonOutputParser()

    chain = prompt | llm | parser

    async for partial_result in chain.astream({
        "task_description": "API設計のレビュー"
    }):
        # Partial results are built up incrementally
        print(f"Current state: {partial_result}")
```

### 6.3 Custom Output Parser

```python
from langchain_core.output_parsers import BaseOutputParser
import re

class MarkdownTableParser(BaseOutputParser[list[dict]]):
    """Custom parser for Markdown tables"""

    def parse(self, text: str) -> list[dict]:
        lines = text.strip().split("\n")

        # Find header row
        header_line = None
        data_start = 0
        for i, line in enumerate(lines):
            if "|" in line and "---" not in line:
                if header_line is None:
                    header_line = line
                    data_start = i + 2  # Skip separator row
                    break

        if header_line is None:
            return []

        headers = [h.strip() for h in header_line.split("|") if h.strip()]

        results = []
        for line in lines[data_start:]:
            if "|" not in line:
                continue
            values = [v.strip() for v in line.split("|") if v.strip()]
            if len(values) == len(headers):
                results.append(dict(zip(headers, values)))

        return results

    @property
    def _type(self) -> str:
        return "markdown_table"

# Usage example
table_parser = MarkdownTableParser()
comparison_chain = (
    ChatPromptTemplate.from_template(
        "以下の項目をMarkdownテーブルで比較してください: {items}"
    )
    | llm
    | table_parser
)

result = comparison_chain.invoke({"items": "React, Vue, Angular"})
for row in result:
    print(row)
```

---

## 7. Callbacks and Observability

### 7.1 Custom Callbacks

```python
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.agents import AgentAction, AgentFinish
from datetime import datetime
import json
import logging

logger = logging.getLogger("langchain_agent")

class ProductionCallbackHandler(BaseCallbackHandler):
    """Callback handler for production environments"""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.start_time = None
        self.tool_calls = []
        self.token_usage = {"input": 0, "output": 0}
        self.errors = []

    def on_chain_start(self, serialized, inputs, **kwargs):
        self.start_time = datetime.now()
        logger.info(f"[{self.session_id}] Chain started")

    def on_chain_end(self, outputs, **kwargs):
        elapsed = (datetime.now() - self.start_time).total_seconds()
        logger.info(
            f"[{self.session_id}] Chain completed in {elapsed:.2f}s | "
            f"Tool calls: {len(self.tool_calls)} | "
            f"Tokens: {self.token_usage}"
        )

    def on_agent_action(self, action: AgentAction, **kwargs):
        self.tool_calls.append({
            "tool": action.tool,
            "input": str(action.tool_input)[:200],
            "timestamp": datetime.now().isoformat()
        })
        logger.info(
            f"[{self.session_id}] Tool call: {action.tool}"
        )

    def on_tool_error(self, error: Exception, **kwargs):
        self.errors.append({
            "error": str(error),
            "timestamp": datetime.now().isoformat()
        })
        logger.error(
            f"[{self.session_id}] Tool error: {error}"
        )

    def on_llm_end(self, response, **kwargs):
        if hasattr(response, "llm_output") and response.llm_output:
            usage = response.llm_output.get("token_usage", {})
            self.token_usage["input"] += usage.get("input_tokens", 0)
            self.token_usage["output"] += usage.get("output_tokens", 0)

    def get_metrics(self) -> dict:
        """Get metrics"""
        return {
            "session_id": self.session_id,
            "duration": (datetime.now() - self.start_time).total_seconds() if self.start_time else 0,
            "tool_calls": len(self.tool_calls),
            "errors": len(self.errors),
            "token_usage": self.token_usage,
            "tool_details": self.tool_calls
        }

# Usage
callback = ProductionCallbackHandler(session_id="sess-abc123")
result = executor.invoke(
    {"input": "売上データを分析して"},
    config={"callbacks": [callback]}
)
metrics = callback.get_metrics()
print(json.dumps(metrics, indent=2, ensure_ascii=False))
```

### 7.2 LangSmith Integration

```python
# Tracing with LangSmith
import os

# Configure via environment variables
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls__..."
os.environ["LANGCHAIN_PROJECT"] = "my-agent-project"

# Configure programmatically
from langsmith import Client

client = Client()

# Trace annotation
from langchain_core.tracers import LangChainTracer

tracer = LangChainTracer(
    project_name="production-agent",
    client=client
)

# Pass the tracer at execution time
result = executor.invoke(
    {"input": "月次レポートを作成して"},
    config={"callbacks": [tracer]}
)

# Adding custom metadata
from langchain_core.runnables import RunnableConfig

config = RunnableConfig(
    metadata={
        "user_id": "user-123",
        "request_type": "report_generation",
        "environment": "production"
    },
    tags=["production", "report", "monthly"]
)

result = executor.invoke(
    {"input": "月次レポートを作成して"},
    config=config
)
```

### 7.3 Implementing Structured Logging

```python
import structlog
from langchain_core.callbacks import BaseCallbackHandler

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(ensure_ascii=False)
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)

log = structlog.get_logger()

class StructuredLoggingCallback(BaseCallbackHandler):
    """Callback that outputs structured logs"""

    def __init__(self, request_id: str):
        self.request_id = request_id
        self.step_count = 0

    def on_agent_action(self, action, **kwargs):
        self.step_count += 1
        log.info(
            "agent_action",
            request_id=self.request_id,
            step=self.step_count,
            tool=action.tool,
            tool_input=str(action.tool_input)[:100]
        )

    def on_agent_finish(self, finish, **kwargs):
        log.info(
            "agent_finish",
            request_id=self.request_id,
            total_steps=self.step_count,
            output_length=len(finish.return_values.get("output", ""))
        )

    def on_tool_error(self, error, **kwargs):
        log.error(
            "tool_error",
            request_id=self.request_id,
            step=self.step_count,
            error=str(error)
        )
```

---

## 8. Production Patterns

### 8.1 FastAPI Integration

```python
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import uuid

app = FastAPI()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    stream: bool = False

class ChatResponse(BaseModel):
    session_id: str
    response: str
    tool_calls: list[dict]
    token_usage: dict

# Session management
sessions: dict[str, ConversationBufferWindowMemory] = {}

def get_or_create_session(session_id: str | None) -> tuple[str, ConversationBufferWindowMemory]:
    if session_id and session_id in sessions:
        return session_id, sessions[session_id]

    new_id = session_id or str(uuid.uuid4())
    memory = ConversationBufferWindowMemory(
        memory_key="chat_history",
        return_messages=True,
        k=20
    )
    sessions[new_id] = memory
    return new_id, memory

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    session_id, memory = get_or_create_session(request.session_id)
    callback = ProductionCallbackHandler(session_id=session_id)

    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        max_iterations=10,
        max_execution_time=60,
        handle_parsing_errors=True,
        return_intermediate_steps=True
    )

    try:
        result = await executor.ainvoke(
            {"input": request.message},
            config={"callbacks": [callback]}
        )

        metrics = callback.get_metrics()

        return ChatResponse(
            session_id=session_id,
            response=result["output"],
            tool_calls=metrics["tool_details"],
            token_usage=metrics["token_usage"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming response via SSE (Server-Sent Events)"""
    session_id, memory = get_or_create_session(request.session_id)

    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        memory=memory,
        max_iterations=10,
        handle_parsing_errors=True
    )

    async def event_generator():
        async for event in executor.astream_events(
            {"input": request.message},
            version="v2"
        ):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
            elif kind == "on_tool_start":
                yield f"data: {json.dumps({'type': 'tool_start', 'tool': event['name']}, ensure_ascii=False)}\n\n"
            elif kind == "on_tool_end":
                yield f"data: {json.dumps({'type': 'tool_end', 'tool': event['name']}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "deleted"}
```

### 8.2 Error Handling Strategy

```python
from langchain_core.runnables import RunnableConfig
from tenacity import retry, stop_after_attempt, wait_exponential
import traceback

class RobustAgentExecutor:
    """Robust agent execution class"""

    def __init__(
        self,
        agent,
        tools: list,
        max_iterations: int = 10,
        max_execution_time: int = 120,
        fallback_response: str = "申し訳ございません。現在処理できません。"
    ):
        self.executor = AgentExecutor(
            agent=agent,
            tools=tools,
            max_iterations=max_iterations,
            max_execution_time=max_execution_time,
            handle_parsing_errors=True,
            return_intermediate_steps=True
        )
        self.fallback_response = fallback_response

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30)
    )
    async def _execute_with_retry(
        self,
        input_data: dict,
        config: RunnableConfig
    ) -> dict:
        return await self.executor.ainvoke(input_data, config=config)

    async def run(
        self,
        message: str,
        session_id: str = "default",
        metadata: dict = None
    ) -> dict:
        config = RunnableConfig(
            metadata=metadata or {},
            tags=[session_id]
        )

        try:
            result = await self._execute_with_retry(
                {"input": message},
                config=config
            )
            return {
                "success": True,
                "output": result["output"],
                "steps": len(result.get("intermediate_steps", [])),
            }
        except Exception as e:
            logger.error(
                "agent_execution_failed",
                session_id=session_id,
                error=str(e),
                traceback=traceback.format_exc()
            )
            return {
                "success": False,
                "output": self.fallback_response,
                "error": str(e)
            }
```

### 8.3 Security Measures

```python
# Sandboxing tool execution
import subprocess
import tempfile
import os

@tool
def safe_code_execution(code: str, language: str = "python") -> str:
    """コードを安全に実行する（サンドボックス環境）。

    Args:
        code: 実行するコード
        language: プログラミング言語（python, javascript）
    """
    # Check for dangerous patterns
    dangerous_patterns = [
        "import os", "import subprocess", "import shutil",
        "__import__", "eval(", "exec(", "open(",
        "rm -rf", "sudo", "chmod"
    ]

    for pattern in dangerous_patterns:
        if pattern in code:
            return f"セキュリティエラー: '{pattern}' は許可されていません"

    # Write to a temp file and execute
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=f".{language[:2]}", delete=False
    ) as f:
        f.write(code)
        f.flush()

        try:
            result = subprocess.run(
                ["python", f.name] if language == "python" else ["node", f.name],
                capture_output=True,
                text=True,
                timeout=10,  # 10-second timeout
                cwd="/tmp",
                env={
                    "PATH": "/usr/bin:/usr/local/bin",
                    "HOME": "/tmp"
                }  # Minimal environment variables
            )

            if result.returncode != 0:
                return f"実行エラー:\n{result.stderr[:500]}"
            return result.stdout[:2000]
        except subprocess.TimeoutExpired:
            return "タイムアウト: 実行時間が10秒を超えました"
        finally:
            os.unlink(f.name)

# Input validation
from pydantic import BaseModel, Field, validator

class SafeQueryInput(BaseModel):
    query: str = Field(max_length=1000, description="検索クエリ")

    @validator("query")
    def validate_query(cls, v):
        # SQL injection countermeasures
        injection_patterns = [
            "DROP", "DELETE", "INSERT", "UPDATE",
            "--", ";", "UNION", "OR 1=1"
        ]
        upper_v = v.upper()
        for pattern in injection_patterns:
            if pattern in upper_v:
                raise ValueError(f"不正な入力パターン: {pattern}")
        return v
```

---

## 9. Caching and Performance Optimization

### 9.1 LLM Cache

```python
from langchain_core.globals import set_llm_cache
from langchain_community.cache import SQLiteCache, RedisCache

# SQLite cache (for development environments)
set_llm_cache(SQLiteCache(database_path=".langchain_cache.db"))

# Redis cache (for production environments)
import redis
redis_client = redis.Redis(host="localhost", port=6379)
set_llm_cache(RedisCache(redis_=redis_client, ttl=3600))

# Semantic cache (cache for similar queries)
from langchain_community.cache import RedisSemanticCache
from langchain_community.embeddings import HuggingFaceEmbeddings

set_llm_cache(RedisSemanticCache(
    redis_url="redis://localhost:6379",
    embedding=HuggingFaceEmbeddings(
        model_name="intfloat/multilingual-e5-base"
    ),
    score_threshold=0.95  # Cache hit at 95%+ similarity
))

# Disable cache for specific chains
from langchain_core.runnables import RunnableConfig

result = chain.invoke(
    {"input": "最新ニュースを教えて"},
    config=RunnableConfig(
        metadata={"cache": False}  # Do not use cache
    )
)
```

### 9.2 Batch Processing and Parallel Execution

```python
import asyncio
from langchain_core.runnables import RunnableConfig

# Batch processing
inputs = [
    {"input": f"質問{i}: {q}"}
    for i, q in enumerate([
        "Pythonのデコレータとは？",
        "asyncioの使い方は？",
        "型ヒントのベストプラクティスは？",
        "テストの書き方は？",
    ])
]

# Synchronous batch (executed in parallel internally)
results = chain.batch(
    inputs,
    config=RunnableConfig(max_concurrency=3)  # Limit concurrent executions
)

# Async batch
async def process_batch():
    results = await chain.abatch(
        inputs,
        config=RunnableConfig(max_concurrency=5)
    )
    return results

# Streaming batch
async def stream_batch():
    """Get results for each input via streaming"""
    tasks = [
        chain.astream(input_data)
        for input_data in inputs
    ]

    for i, stream in enumerate(asyncio.as_completed(tasks)):
        result = await stream
        print(f"Input {i} completed")
```

### 9.3 Model Routing

```python
from langchain_core.runnables import RunnableLambda, RunnableBranch

# Switch models based on task complexity
cheap_llm = ChatAnthropic(model="claude-haiku-4-20250514", temperature=0)
expensive_llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)

def estimate_complexity(input_data: dict) -> dict:
    """Estimate task complexity"""
    text = input_data.get("input", "")
    word_count = len(text.split())

    # Simple heuristics
    complex_keywords = ["分析", "比較", "設計", "アーキテクチャ", "最適化"]
    has_complex_keyword = any(kw in text for kw in complex_keywords)

    input_data["complexity"] = "high" if (
        word_count > 50 or has_complex_keyword
    ) else "low"
    return input_data

# Model routing chain
routed_chain = (
    RunnableLambda(estimate_complexity)
    | RunnableBranch(
        (
            lambda x: x["complexity"] == "high",
            ChatPromptTemplate.from_template("{input}") | expensive_llm | StrOutputParser()
        ),
        ChatPromptTemplate.from_template("{input}") | cheap_llm | StrOutputParser()
    )
)

# Cost reduction: Haiku for simple queries, Sonnet for complex ones
```

---

## 10. Testing and Debugging

### 10.1 Unit Testing

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from langchain_core.messages import AIMessage

# Tool tests
class TestSearchDatabaseTool:
    def test_basic_search(self, tmp_path):
        """Basic search works correctly"""
        import sqlite3
        db_path = tmp_path / "test.db"
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE products (id INT, name TEXT)")
        conn.execute("INSERT INTO products VALUES (1, 'Widget')")
        conn.commit()
        conn.close()

        result = search_database.invoke({
            "query": "Widget",
            "table": "products",
            "limit": 5
        })
        assert "Widget" in result

    def test_empty_results(self, tmp_path):
        """When results are empty"""
        import sqlite3
        db_path = tmp_path / "test.db"
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE products (id INT, name TEXT)")
        conn.commit()
        conn.close()

        result = search_database.invoke({
            "query": "nonexistent",
            "table": "products"
        })
        assert result == "[]"

# Agent tests (mock LLM)
class TestAgent:
    @pytest.fixture
    def mock_llm(self):
        mock = MagicMock()
        mock.invoke.return_value = AIMessage(content="テスト回答")
        return mock

    def test_agent_responds(self, mock_llm):
        """Agent returns a response"""
        chain = (
            ChatPromptTemplate.from_template("{input}")
            | mock_llm
            | StrOutputParser()
        )
        result = chain.invoke({"input": "テスト質問"})
        assert result is not None

# Integration tests for chains
class TestChain:
    @pytest.mark.integration
    def test_full_chain_execution(self):
        """Full chain operates correctly"""
        llm = ChatAnthropic(
            model="claude-haiku-4-20250514",
            temperature=0
        )
        chain = (
            ChatPromptTemplate.from_template(
                "「{word}」を使った短い文を1つ作って"
            )
            | llm
            | StrOutputParser()
        )

        result = chain.invoke({"word": "テスト"})
        assert len(result) > 0
        assert "テスト" in result
```

### 10.2 Test Automation with LangSmith

```python
from langsmith import Client
from langsmith.evaluation import evaluate

client = Client()

# Create test dataset
dataset = client.create_dataset(
    "agent-evaluation",
    description="エージェントの品質評価用データセット"
)

# Add test cases
examples = [
    {
        "input": "東京の天気は？",
        "expected_output": "天気情報を返す",
        "expected_tools": ["get_weather"]
    },
    {
        "input": "1+1は？",
        "expected_output": "2",
        "expected_tools": []  # No tools needed
    },
]

for example in examples:
    client.create_example(
        inputs={"input": example["input"]},
        outputs={
            "output": example["expected_output"],
            "tools": example["expected_tools"]
        },
        dataset_id=dataset.id
    )

# Evaluation function
def correct_tool_usage(run, example) -> dict:
    """Evaluate whether the correct tools were used"""
    expected_tools = example.outputs.get("tools", [])

    # Extract tool calls from intermediate steps
    actual_tools = []
    if run.outputs and "intermediate_steps" in run.outputs:
        actual_tools = [
            step[0].tool
            for step in run.outputs["intermediate_steps"]
        ]

    return {
        "key": "correct_tools",
        "score": 1.0 if set(expected_tools) == set(actual_tools) else 0.0
    }

# Run evaluation
results = evaluate(
    lambda input: executor.invoke(input),
    data=dataset.name,
    evaluators=[correct_tool_usage],
    experiment_prefix="agent-v1"
)
```

### 10.3 Debugging Techniques

```python
# 1. Enable detailed logging
import langchain
langchain.debug = True  # Detailed logs for all steps

# 2. Debug specific steps
from langchain_core.tracers import ConsoleCallbackHandler

# Output all steps to console
result = chain.invoke(
    {"input": "テスト"},
    config={"callbacks": [ConsoleCallbackHandler()]}
)

# 3. Chain visualization
chain.get_graph().print_ascii()
# Example output:
#     +--------+
#     | Prompt |
#     +---+----+
#         |
#     +---v---+
#     |  LLM  |
#     +---+---+
#         |
#     +---v----+
#     | Parser |
#     +--------+

# 4. Inspecting intermediate results
from langchain_core.runnables import RunnableLambda

def inspect(state):
    """Log intermediate state"""
    print(f"=== Inspect ===")
    print(f"Type: {type(state)}")
    if isinstance(state, dict):
        for k, v in state.items():
            print(f"  {k}: {str(v)[:100]}")
    else:
        print(f"  Value: {str(state)[:200]}")
    print(f"================")
    return state

debug_chain = (
    prompt
    | RunnableLambda(inspect)  # After prompt
    | llm
    | RunnableLambda(inspect)  # After LLM output
    | output_parser
)
```

---

## 11. Comparison Tables

### 11.1 Comparison of Agent Creation Methods

| Method | Code Volume | Flexibility | Tool Approach | Recommended For |
|--------|-------------|-------------|---------------|-----------------|
| create_tool_calling_agent | Small | Medium | Function Calling | General use |
| create_react_agent | Small | Medium | Text-based | Legacy models |
| Custom Agent | Large | High | Any | Special requirements |
| LangGraph | Medium | Highest | Any | Complex flows |

### 11.2 Comparison of Tool Definition Methods

| Method | Ease of Use | Type Safety | Async | Validation |
|--------|-------------|-------------|-------|------------|
| @tool decorator | Highest | Medium | Yes | Basic |
| StructuredTool | Medium | High | Yes | Pydantic |
| BaseTool inheritance | Low | High | Yes | Full control |
| Tool.from_function | High | Low | No | None |

### 11.3 Comparison of Memory Strategies

| Strategy | Memory Usage | Long-Term Dialog | Accuracy | Cost | Recommended For |
|----------|--------------|------------------|----------|------|-----------------|
| ConversationBufferMemory | High | Not suitable | Highest | High | Short conversations |
| ConversationBufferWindowMemory | Medium | Possible | High | Medium | General dialog |
| ConversationSummaryMemory | Low | Optimal | Medium | LLM call needed | Long sessions |
| ConversationSummaryBufferMemory | Medium | Optimal | High | LLM call needed | Balanced use |
| VectorStoreRetrieverMemory | Low | Optimal | Search-dependent | Embedding cost | Knowledge base |

### 11.4 Comparison of Cache Strategies

| Strategy | Speed | Persistence | Scalability | Semantic | Recommended For |
|----------|-------|-------------|-------------|----------|-----------------|
| InMemoryCache | Fastest | None | Single process | No | Development |
| SQLiteCache | Fast | Yes | Single machine | No | Small-scale production |
| RedisCache | Fast | Yes | Distributed | No | Production |
| RedisSemanticCache | Medium | Yes | Distributed | Yes | High traffic |

---

## 12. Practical Project: Customer Support Agent

```python
"""
Complete implementation example of a customer support agent
- FAQ database search
- Order status check
- Escalation feature
- Conversation log recording
"""
from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import tool
from langchain.memory import ConversationSummaryBufferMemory
from pydantic import BaseModel, Field
from datetime import datetime
import json

# --- Tool definitions ---

@tool
def search_faq(query: str, category: str = "all") -> str:
    """FAQデータベースを検索する。

    Args:
        query: 検索キーワード
        category: カテゴリ（shipping, payment, returns, account, all）
    """
    # Simple FAQ database (use a vector DB in practice)
    faqs = {
        "shipping": [
            {"q": "配送日数は？", "a": "通常2-3営業日です。離島は5-7営業日。"},
            {"q": "送料は？", "a": "5,000円以上のご注文で送料無料。それ以下は一律550円。"},
            {"q": "配送状況の確認", "a": "注文詳細ページから追跡番号でご確認いただけます。"},
        ],
        "payment": [
            {"q": "支払い方法", "a": "クレジットカード、銀行振込、コンビニ決済に対応。"},
            {"q": "分割払い", "a": "3回・6回・12回の分割払いが可能（手数料あり）。"},
        ],
        "returns": [
            {"q": "返品ポリシー", "a": "商品到着後14日以内であれば返品可能。未使用品に限ります。"},
            {"q": "返金", "a": "返品確認後、5営業日以内にご返金いたします。"},
        ],
    }

    results = []
    search_categories = [category] if category != "all" else faqs.keys()

    for cat in search_categories:
        if cat in faqs:
            for faq in faqs[cat]:
                if query.lower() in faq["q"].lower() or query.lower() in faq["a"].lower():
                    results.append(f"[{cat}] Q: {faq['q']} A: {faq['a']}")

    return "\n".join(results) if results else "該当するFAQが見つかりませんでした。"

@tool
def check_order_status(order_id: str) -> str:
    """注文のステータスを確認する。

    Args:
        order_id: 注文番号（例: ORD-2024-001）
    """
    # Mock data
    orders = {
        "ORD-2024-001": {
            "status": "配送中",
            "items": "ワイヤレスヘッドフォン x1",
            "tracking": "JP123456789",
            "estimated_delivery": "2024-12-20"
        },
        "ORD-2024-002": {
            "status": "処理中",
            "items": "USBケーブル x3",
            "tracking": None,
            "estimated_delivery": "2024-12-22"
        }
    }

    if order_id in orders:
        order = orders[order_id]
        return json.dumps(order, ensure_ascii=False, indent=2)
    return f"注文番号 {order_id} が見つかりません。正しい注文番号をご確認ください。"

@tool
def escalate_to_human(
    reason: str,
    priority: str = "normal",
    customer_summary: str = ""
) -> str:
    """問題をヒューマンオペレーターにエスカレーションする。

    Args:
        reason: エスカレーションの理由
        priority: 優先度（low, normal, high, urgent）
        customer_summary: お客様の状況の要約
    """
    ticket_id = f"TICKET-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return (
        f"エスカレーションチケット作成: {ticket_id}\n"
        f"優先度: {priority}\n"
        f"理由: {reason}\n"
        f"オペレーターに引き継ぎます。しばらくお待ちください。"
    )

# --- Agent construction ---

llm = ChatAnthropic(
    model="claude-sonnet-4-20250514",
    temperature=0,
    max_tokens=2048
)

system_prompt = """あなたは「テックストア」のカスタマーサポートAIアシスタントです。

## 対応方針
- 丁寧で親切な対応を心がける
- 不明な点は推測せず、FAQを検索するか確認する
- 注文に関する問い合わせは必ず注文番号を確認する
- 解決できない問題は速やかにヒューマンオペレーターにエスカレーションする

## エスカレーション基準
以下の場合はヒューマンオペレーターに引き継ぐ:
- お客様が明示的に人間との対話を希望した場合
- 返金・交換の具体的な処理が必要な場合
- クレームや苦情の対応
- システムに情報がない場合

## 禁止事項
- 存在しない情報を作り上げない
- 個人情報を尋ねすぎない
- 他社製品の批判をしない
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad")
])

tools = [search_faq, check_order_status, escalate_to_human]

agent = create_tool_calling_agent(llm, tools, prompt)

memory = ConversationSummaryBufferMemory(
    llm=ChatAnthropic(model="claude-haiku-4-20250514"),
    memory_key="chat_history",
    return_messages=True,
    max_token_limit=2000
)

support_agent = AgentExecutor(
    agent=agent,
    tools=tools,
    memory=memory,
    verbose=False,
    max_iterations=8,
    max_execution_time=60,
    handle_parsing_errors=True
)

# Usage example
# result = support_agent.invoke({"input": "注文ORD-2024-001の配送状況を教えてください"})
```

---

## 13. Anti-Patterns

### Anti-Pattern 1: Excessive Chain Chaining

```python
# BAD: An overly long chain that is hard to read
chain = (
    prompt1 | llm | parser1 | transform1 |
    prompt2 | llm | parser2 | transform2 |
    prompt3 | llm | parser3 | transform3 |
    prompt4 | llm | parser4
)  # Difficult to debug

# GOOD: Split into meaningful units
research_chain = prompt1 | llm | parser1
analysis_chain = prompt2 | llm | parser2
report_chain = prompt3 | llm | parser3

# Combine
full_chain = research_chain | analysis_chain | report_chain
```

### Anti-Pattern 2: Using verbose=True in Production

```python
# BAD: verbose output in production (security risk + performance degradation)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# GOOD: Environment-specific configuration
import os
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=os.getenv("ENV") == "development",
    callbacks=[production_logger] if os.getenv("ENV") == "production" else []
)
```

### Anti-Pattern 3: Insufficient Tool Descriptions

```python
# BAD: Insufficient description prevents LLM from selecting tools correctly
@tool
def search(q: str) -> str:
    """Search"""  # What is searched? What input is expected?
    pass

# GOOD: Specific and clear description
@tool
def search_product_catalog(
    query: str,
    category: str = "all",
    price_range: str = "any"
) -> str:
    """商品カタログから製品を検索する。商品名、ブランド名、カテゴリで検索可能。

    Args:
        query: 検索キーワード（商品名やブランド名）
        category: 商品カテゴリ（electronics, clothing, books, all）
        price_range: 価格帯（budget: ~5000円, mid: 5000-20000円, premium: 20000円~, any）

    Returns:
        マッチした商品のリスト（名前、価格、在庫状況を含む）
    """
    pass
```

### Anti-Pattern 4: Ignoring Memory Leaks

```python
# BAD: Long-running session without memory management
memory = ConversationBufferMemory()  # Conversation keeps growing
executor = AgentExecutor(agent=agent, tools=tools, memory=memory)
# Risk of OOM after hundreds of turns

# GOOD: Window or summary memory + cleanup
memory = ConversationSummaryBufferMemory(
    llm=ChatAnthropic(model="claude-haiku-4-20250514"),
    max_token_limit=2000,
    return_messages=True,
    memory_key="chat_history"
)

# Periodic cleanup
def cleanup_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
    # For Redis, automatic expiry via TTL
```

### Anti-Pattern 5: Blocking Synchronous Processing

```python
# BAD: Running a synchronous agent in FastAPI (blocks requests)
@app.post("/chat")
def chat_sync(request: ChatRequest):
    result = executor.invoke({"input": request.message})
    return result

# GOOD: Execute asynchronously
@app.post("/chat")
async def chat_async(request: ChatRequest):
    result = await executor.ainvoke({"input": request.message})
    return result
```

---

## 14. FAQ

### Q1: Managing LangChain versions is difficult — what should I do?

LangChain's API changes frequently. Countermeasures:
- **Pin langchain-core** (most stable)
- **Explicitly pin versions** in requirements.txt
- **Automate tests** with LangSmith
- Check the `langchain` CHANGELOG for breaking changes
- Align the major versions of langchain-core and langchain (e.g., the 0.3.x series)

### Q2: Should I use AgentExecutor or LangGraph?

- **AgentExecutor**: Simple tool-using agents (5 or fewer tools, linear processing)
- **LangGraph**: When conditional branching, loops, state management, or multi-agent setups are needed

The LangChain team officially recommends LangGraph for complex cases.

### Q3: How can I optimize LangChain costs?

- **Caching**: Cache LLM responses with `langchain.cache`
- **Model switching**: Optimize per node, e.g., Haiku for classification, Sonnet for generation
- **Early termination**: Set `max_iterations` appropriately
- **Batch processing**: Run in parallel with `chain.batch([input1, input2, ...])`

### Q4: Does accuracy drop when there are too many tools?

LLM tool selection accuracy degrades as tool count grows. Countermeasures:
- Aim for **10 tools or fewer** as a guideline
- Write clear, differentiated tool descriptions
- Group related tools into toolkits
- Implement dynamic tool selection (switch toolsets based on task)
- Migrate to LangGraph and provide different toolsets per node

### Q5: When should I use LangChain vs. LlamaIndex?

- **LangChain**: General-purpose agents, tool integration, workflow construction
- **LlamaIndex**: Specialized for RAG (Retrieval-Augmented Generation), document indexing
- **Combined use**: It is common to integrate LlamaIndex Retrievers as LangChain tools

```python
# LlamaIndex + LangChain integration example
from llama_index.core import VectorStoreIndex
from langchain.tools import Tool

# Convert a LlamaIndex index into a LangChain tool
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

llama_tool = Tool(
    name="document_search",
    func=query_engine.query,
    description="社内ドキュメントを検索する"
)

# Add to LangChain agent's tool list
tools = [llama_tool, search_database, email_tool]
```

### Q6: How do I handle deadlocks in async processing?

```python
# Problem: Attempting to call an async function inside synchronous code causes a deadlock
# BAD:
import asyncio
result = asyncio.run(executor.ainvoke({"input": "test"}))  # Risk of deadlock

# GOOD: Use nest_asyncio (e.g., in Jupyter environments)
import nest_asyncio
nest_asyncio.apply()

# GOOD: Run in a dedicated event loop
import asyncio
from concurrent.futures import ThreadPoolExecutor

def run_async_in_thread(coro):
    """Run an async function in a separate thread"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

with ThreadPoolExecutor() as pool:
    future = pool.submit(
        run_async_in_thread,
        executor.ainvoke({"input": "test"})
    )
    result = future.result(timeout=60)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| LCEL | Connect components with a pipeline |
| Tools | Three methods: @tool / StructuredTool / BaseTool |
| AgentExecutor | Execution engine for agents |
| Memory | Maintain conversation with ConversationBuffer variants |
| Streaming | Real-time output via astream_events |
| Cache | Three strategies: SQLite / Redis / Semantic |
| Testing | Unit tests + LangSmith evaluation |
| Production | FastAPI integration, error handling, security |
| Principle | Start simple, migrate to LangGraph as needed |

## Next Guides to Read

- [01-langgraph.md](./01-langgraph.md) -- Advanced workflows with LangGraph
- [02-mcp-agents.md](./02-mcp-agents.md) -- Implementing MCP agents
- [04-evaluation.md](./04-evaluation.md) -- Agent evaluation methods

## References

1. LangChain Documentation -- https://python.langchain.com/docs/
2. LangChain GitHub -- https://github.com/langchain-ai/langchain
3. Harrison Chase, "LangChain Expression Language (LCEL)" -- https://python.langchain.com/docs/concepts/lcel/
4. LangSmith Documentation -- https://docs.smith.langchain.com/
5. LangChain Cookbook -- https://github.com/langchain-ai/langchain/tree/master/cookbook
