# LangGraph

> State graphs, cycles, and checkpoints — designing and implementing stateful agent workflows with LangGraph.

## What You Will Learn

1. LangGraph's state graph model and how it differs from LangChain AgentExecutor
2. Designing graphs with cycles (loops) and implementing conditional branching
3. Persistence via checkpoints and integrating human-in-the-loop
4. Modular design with subgraphs and reuse patterns
5. Building multi-agent coordination graphs
6. Streaming and real-time UI integration
7. Production deployment and leveraging LangGraph Cloud


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [LangChain Agents](./00-langchain-agent.md)

---

## 1. What Is LangGraph?

### 1.1 LangChain AgentExecutor vs LangGraph

```
AgentExecutor: a black-box loop
+-------------------------------------------+
|  [LLM] → [Tool] → [LLM] → ... → [Answer] |
|  No control over the internal flow         |
+-------------------------------------------+

LangGraph: an explicit state graph
+-------------------------------------------+
|  [Node A] ──→ [Condition] ──→ [Node B]    |
|       ^              |                     |
|       |              v                     |
|       +────── [Node C] ──→ [END]          |
|  Each node and edge is defined and         |
|  controlled individually                   |
+-------------------------------------------+
```

### 1.2 Core Concepts

```
Three core concepts of LangGraph

1. State
   - Data shared across the entire graph
   - Type-defined with TypedDict or Pydantic
   - Read and written by each node

2. Nodes
   - Functions that receive state and return updates
   - LLM calls, tool execution, data transformation

3. Edges
   - Connections between nodes
   - Normal edges: unconditionally move to the next node
   - Conditional edges: branch based on state
```

### 1.3 Architecture Overview

```
LangGraph Architecture

+--------------------------------------------------+
|                  Application                       |
|  +----------------------------------------------+ |
|  |          Compiled Graph (CompiledGraph)       | |
|  |  +--------+  +--------+  +--------+         | |
|  |  | Node A |→ | Node B |→ | Node C |         | |
|  |  +--------+  +--------+  +--------+         | |
|  |       ↑          |            |              | |
|  |       +──────────+            |              | |
|  |      (conditional edge)       |              | |
|  +----------------------------------------------+ |
|                    |                               |
|  +----------------v---------+  +-----------+      |
|  |      State Manager       |  |  Channels |      |
|  |  (controls state reads   |  | (comm.)   |      |
|  |   and writes)            |  |           |      |
|  +---------------------------+  +-----------+      |
|                    |                               |
|  +----------------v---------+                      |
|  |      Checkpointer        |                      |
|  |  (Memory/SQLite/Postgres)|                      |
|  +---------------------------+                      |
+--------------------------------------------------+
```

---

## 2. Building a Basic Graph

### 2.1 Simple Chatbot

```python
# LangGraph の基本構造
from langgraph.graph import StateGraph, END, START
from typing import TypedDict, Annotated
from langchain_anthropic import ChatAnthropic
import operator

# 状態の定義
class ChatState(TypedDict):
    messages: Annotated[list, operator.add]  # メッセージは累積
    response_count: int

# LLM
llm = ChatAnthropic(model="claude-sonnet-4-20250514")

# ノード関数
def chatbot(state: ChatState) -> dict:
    """LLMを呼び出してメッセージを追加"""
    response = llm.invoke(state["messages"])
    return {
        "messages": [response],
        "response_count": state["response_count"] + 1
    }

# グラフ構築
graph = StateGraph(ChatState)
graph.add_node("chatbot", chatbot)
graph.add_edge(START, "chatbot")
graph.add_edge("chatbot", END)

# コンパイル
app = graph.compile()

# 実行
result = app.invoke({
    "messages": [("human", "LangGraphについて教えて")],
    "response_count": 0
})
```

### 2.2 Agent with Tool Use

```python
# ツール使用付きの完全なエージェント
from langgraph.graph import StateGraph, END, START
from langgraph.prebuilt import ToolNode
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain.tools import tool
from typing import TypedDict, Annotated, Literal
import operator

# 状態
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]

# ツール
@tool
def get_weather(city: str) -> str:
    """都市の天気を取得する"""
    weather_data = {"東京": "晴れ 22°C", "大阪": "曇り 20°C"}
    return weather_data.get(city, f"{city}のデータなし")

@tool
def calculate(expression: str) -> str:
    """数式を計算する"""
    return str(eval(expression))

tools = [get_weather, calculate]
llm_with_tools = ChatAnthropic(model="claude-sonnet-4-20250514").bind_tools(tools)

# ノード
def agent_node(state: AgentState) -> dict:
    """LLMがツール使用を判断"""
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

tool_node = ToolNode(tools)

# ルーティング
def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """ツール呼び出しが必要かを判定"""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"

# グラフ構築
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", tool_node)

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue, {
    "tools": "tools",
    "end": END
})
workflow.add_edge("tools", "agent")  # ツール結果→LLMに戻る（サイクル）

app = workflow.compile()

# 実行
result = app.invoke({
    "messages": [HumanMessage(content="東京の天気と、25 * 4 の計算結果を教えて")]
})
```

### 2.3 State Design Patterns

```python
from typing import TypedDict, Annotated, Optional
from pydantic import BaseModel, Field
import operator

# パターン1: TypedDict + Annotated（基本パターン）
class BasicState(TypedDict):
    messages: Annotated[list, operator.add]  # 累積（追加のみ）
    current_step: str                         # 上書き
    iteration_count: int                      # 上書き

# パターン2: Pydantic BaseModel（バリデーション付き）
class ValidatedState(BaseModel):
    messages: Annotated[list, operator.add]
    task: str = Field(description="実行するタスク")
    status: str = Field(
        default="pending",
        pattern="^(pending|running|completed|failed)$"
    )
    max_iterations: int = Field(default=5, ge=1, le=20)
    results: list[dict] = Field(default_factory=list)

# パターン3: カスタムReducer（高度な状態マージ）
def merge_results(existing: list[dict], new: list[dict]) -> list[dict]:
    """重複を排除しつつ結果をマージ"""
    seen_ids = {r["id"] for r in existing}
    merged = existing.copy()
    for r in new:
        if r["id"] not in seen_ids:
            merged.append(r)
            seen_ids.add(r["id"])
    return merged

class SearchState(TypedDict):
    query: str
    results: Annotated[list[dict], merge_results]  # カスタムマージ
    search_count: int

# パターン4: ネストされた状態
class PlanStep(TypedDict):
    step_id: str
    description: str
    status: str
    output: Optional[str]

class PlannerState(TypedDict):
    messages: Annotated[list, operator.add]
    plan: list[PlanStep]
    current_step_index: int
    final_output: str
```

### 2.4 Edge Definition Patterns

```python
from langgraph.graph import StateGraph, END, START
from typing import Literal

# 1. 通常エッジ（無条件遷移）
graph.add_edge("node_a", "node_b")
graph.add_edge("node_b", END)

# 2. 条件エッジ（条件分岐）
def decide_next(state: dict) -> Literal["analyze", "report", "end"]:
    """状態に基づいて次のノードを決定"""
    if state.get("needs_analysis"):
        return "analyze"
    elif state.get("has_results"):
        return "report"
    return "end"

graph.add_conditional_edges(
    "router",
    decide_next,
    {
        "analyze": "analysis_node",
        "report": "report_node",
        "end": END
    }
)

# 3. 複数ソースからの条件エッジ
# 同じルーティング関数を複数のノードで再利用
for node_name in ["agent_1", "agent_2", "agent_3"]:
    graph.add_conditional_edges(
        node_name,
        should_continue,
        {"tools": "tools", "end": END}
    )

# 4. 動的エッジ（ノードが次の遷移先を返す）
def dynamic_node(state: dict) -> dict:
    """ノード内でルーティングを決定"""
    # 処理...
    if some_condition:
        return {"next_node": "node_a", "data": result}
    return {"next_node": "node_b", "data": result}

def route_dynamic(state: dict) -> str:
    return state["next_node"]

graph.add_conditional_edges("dynamic", route_dynamic, {
    "node_a": "node_a",
    "node_b": "node_b"
})
```

---

## 3. Designing Cycles (Loops)

### 3.1 Review Cycle

```
Review cycle graph

  START → [Generate] → [Review] → (Approved?) → YES → END
                           ^            |
                           |           NO
                           +←──[Revise]←──+
```

```python
# レビュー付きの改善サイクル
class ReviewState(TypedDict):
    task: str
    draft: str
    review: str
    revision_count: int
    is_approved: bool

def generate(state: ReviewState) -> dict:
    """初稿を生成"""
    response = llm.invoke(f"以下のタスクに取り組んでください: {state['task']}")
    return {"draft": response.content, "revision_count": 0}

def review(state: ReviewState) -> dict:
    """ドラフトをレビュー"""
    response = llm.invoke(
        f"以下の文書をレビューしてください。品質が十分なら'APPROVED'、"
        f"改善が必要なら具体的な改善点を指摘:\n\n{state['draft']}"
    )
    is_approved = "APPROVED" in response.content
    return {"review": response.content, "is_approved": is_approved}

def revise(state: ReviewState) -> dict:
    """レビューに基づいて修正"""
    response = llm.invoke(
        f"原文:\n{state['draft']}\n\n"
        f"レビュー:\n{state['review']}\n\n"
        f"レビューの指摘に基づいて修正してください。"
    )
    return {
        "draft": response.content,
        "revision_count": state["revision_count"] + 1
    }

def route_review(state: ReviewState) -> Literal["revise", "end"]:
    if state["is_approved"] or state["revision_count"] >= 3:
        return "end"
    return "revise"

# グラフ
graph = StateGraph(ReviewState)
graph.add_node("generate", generate)
graph.add_node("review", review)
graph.add_node("revise", revise)

graph.add_edge(START, "generate")
graph.add_edge("generate", "review")
graph.add_conditional_edges("review", route_review, {
    "revise": "revise",
    "end": END
})
graph.add_edge("revise", "review")  # サイクル

app = graph.compile()
```

### 3.2 Self-Correcting Code Generation Cycle

```python
# コード生成→テスト→修正のサイクル
class CodeGenState(TypedDict):
    task: str
    code: str
    test_result: str
    error_message: str
    iteration: int
    is_passing: bool

def generate_code(state: CodeGenState) -> dict:
    """タスクからコードを生成"""
    prompt = f"""以下のタスクを実現するPythonコードを生成してください。
タスク: {state['task']}
"""
    if state.get("error_message"):
        prompt += f"""
前回のコード:
```python
{state['code']}
```
エラー: {state['error_message']}
このエラーを修正してください。
"""
    response = llm.invoke(prompt)
    # コードブロックを抽出
    code = extract_code_block(response.content)
    return {"code": code, "iteration": state.get("iteration", 0) + 1}

def run_tests(state: CodeGenState) -> dict:
    """生成されたコードをテスト実行"""
    import subprocess
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False
    ) as f:
        f.write(state["code"])
        f.flush()
        try:
            result = subprocess.run(
                ["python", f.name],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return {
                    "test_result": result.stdout,
                    "is_passing": True,
                    "error_message": ""
                }
            return {
                "test_result": "",
                "is_passing": False,
                "error_message": result.stderr[:500]
            }
        except subprocess.TimeoutExpired:
            return {
                "test_result": "",
                "is_passing": False,
                "error_message": "タイムアウト: 10秒以内に完了しませんでした"
            }
        finally:
            os.unlink(f.name)

def extract_code_block(text: str) -> str:
    """Markdownコードブロックからコードを抽出"""
    import re
    match = re.search(r"```python\n(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text.strip()

def route_test_result(state: CodeGenState) -> Literal["fix", "end"]:
    if state["is_passing"]:
        return "end"
    if state["iteration"] >= 5:
        return "end"  # 最大5回で打ち切り
    return "fix"

# グラフ構築
graph = StateGraph(CodeGenState)
graph.add_node("generate", generate_code)
graph.add_node("test", run_tests)

graph.add_edge(START, "generate")
graph.add_edge("generate", "test")
graph.add_conditional_edges("test", route_test_result, {
    "fix": "generate",  # テスト失敗→再生成
    "end": END
})

app = graph.compile()

# 使用例
result = app.invoke({
    "task": "フィボナッチ数列の最初の10項を出力する関数",
    "code": "",
    "test_result": "",
    "error_message": "",
    "iteration": 0,
    "is_passing": False
})
```

### 3.3 Research Agent Cycle

```python
# 検索→分析→追加検索のサイクル
class ResearchState(TypedDict):
    query: str
    sources: Annotated[list[dict], operator.add]
    analysis: str
    is_sufficient: bool
    search_count: int
    final_report: str

def search(state: ResearchState) -> dict:
    """情報を検索"""
    search_query = state["query"]
    if state.get("analysis"):
        # 前回の分析で不足している情報を追加検索
        refinement = llm.invoke(
            f"以下の分析で不足している情報の検索クエリを1つ生成:\n{state['analysis']}"
        )
        search_query = refinement.content

    # Web検索（実際にはSearch APIを使用）
    results = [{"title": f"Result for {search_query}", "content": "..."}]
    return {
        "sources": results,
        "search_count": state["search_count"] + 1
    }

def analyze(state: ResearchState) -> dict:
    """収集した情報を分析"""
    sources_text = "\n".join(
        f"- {s['title']}: {s['content']}" for s in state["sources"]
    )
    response = llm.invoke(
        f"クエリ: {state['query']}\n\n"
        f"収集した情報:\n{sources_text}\n\n"
        f"これらの情報を分析してください。情報が十分かどうかも判断してください。"
        f"十分であれば'SUFFICIENT'と明記してください。"
    )
    is_sufficient = "SUFFICIENT" in response.content
    return {"analysis": response.content, "is_sufficient": is_sufficient}

def write_report(state: ResearchState) -> dict:
    """最終レポートを作成"""
    response = llm.invoke(
        f"以下の分析結果をもとに、構造化されたレポートを作成:\n\n{state['analysis']}"
    )
    return {"final_report": response.content}

def route_analysis(state: ResearchState) -> Literal["search_more", "report"]:
    if state["is_sufficient"] or state["search_count"] >= 5:
        return "report"
    return "search_more"

graph = StateGraph(ResearchState)
graph.add_node("search", search)
graph.add_node("analyze", analyze)
graph.add_node("report", write_report)

graph.add_edge(START, "search")
graph.add_edge("search", "analyze")
graph.add_conditional_edges("analyze", route_analysis, {
    "search_more": "search",
    "report": "report"
})
graph.add_edge("report", END)

app = graph.compile()
```

---

## 4. Checkpoints and Persistence

### 4.1 In-Memory Checkpoint

```python
# チェックポイントによる状態の永続化
from langgraph.checkpoint.memory import MemorySaver

# チェックポインタ設定
checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)

# スレッドIDで会話を管理
config = {"configurable": {"thread_id": "user-123"}}

# 1回目の実行
result1 = app.invoke(
    {"messages": [HumanMessage(content="私の名前は田中です")]},
    config=config
)

# 2回目の実行（前回の状態を保持）
result2 = app.invoke(
    {"messages": [HumanMessage(content="私の名前は何ですか？")]},
    config=config  # 同じthread_id → 状態が継続
)
```

### 4.2 SQLite Checkpoint (Persistent)

```python
# SQLiteによる永続チェックポイント
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
app = workflow.compile(checkpointer=checkpointer)

# サーバー再起動後も状態が復元される
```

### 4.3 PostgreSQL Checkpoint (Production)

```python
# PostgreSQLによる本番向けチェックポイント
from langgraph.checkpoint.postgres import PostgresSaver

# 接続設定
checkpointer = PostgresSaver.from_conn_string(
    "postgresql://user:password@localhost:5432/langgraph_db"
)

# テーブルの初期化（初回のみ）
checkpointer.setup()

app = workflow.compile(checkpointer=checkpointer)

# 高可用性: 複数のアプリインスタンスで同じDBを共有
# スレッドIDにより各ユーザーの状態が分離される
config_user_a = {"configurable": {"thread_id": "user-a-session-1"}}
config_user_b = {"configurable": {"thread_id": "user-b-session-1"}}
```

### 4.4 Checkpoint State Operations

```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)
config = {"configurable": {"thread_id": "debug-session"}}

# 実行
result = app.invoke(
    {"messages": [HumanMessage(content="テスト")]},
    config=config
)

# 現在の状態を取得
current_state = app.get_state(config)
print(f"状態: {current_state.values}")
print(f"次のノード: {current_state.next}")

# 状態の履歴を取得
for state in app.get_state_history(config):
    print(f"Step: {state.metadata.get('step', '?')}")
    print(f"  Node: {state.metadata.get('source', '?')}")
    print(f"  Messages: {len(state.values.get('messages', []))}")

# 状態を手動で更新
app.update_state(
    config,
    {"messages": [HumanMessage(content="割り込みメッセージ")]},
    as_node="agent"  # どのノードからの更新として扱うか
)

# 特定のチェックポイントにロールバック
history = list(app.get_state_history(config))
target_checkpoint = history[2]  # 2ステップ前の状態
app.update_state(
    config,
    target_checkpoint.values
)
```

---

## 5. Human-in-the-Loop

### 5.1 Basic Approval Flow

```python
# 人間の承認を挟むパターン
from langgraph.graph import StateGraph, END, START

class ApprovalState(TypedDict):
    task: str
    plan: str
    approved: bool
    result: str

def create_plan(state: ApprovalState) -> dict:
    plan = llm.invoke(f"タスク: {state['task']}\n実行計画を作成:")
    return {"plan": plan.content}

def execute_plan(state: ApprovalState) -> dict:
    result = llm.invoke(f"計画に従って実行:\n{state['plan']}")
    return {"result": result.content}

def check_approval(state: ApprovalState) -> Literal["execute", "end"]:
    if state.get("approved"):
        return "execute"
    return "end"

graph = StateGraph(ApprovalState)
graph.add_node("plan", create_plan)
graph.add_node("execute", execute_plan)

graph.add_edge(START, "plan")
# interrupt_before で人間の介入ポイントを設定
graph.add_conditional_edges("plan", check_approval, {
    "execute": "execute",
    "end": END
})
graph.add_edge("execute", END)

app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["execute"]  # execute の前で中断
)

# 実行（planで中断）
config = {"configurable": {"thread_id": "approval-1"}}
result = app.invoke({"task": "本番環境にデプロイ"}, config=config)

# 人間が計画を確認 → 承認
app.update_state(config, {"approved": True})

# 再開
result = app.invoke(None, config=config)
```

### 5.2 Advanced HITL Patterns

```python
# 複数の介入ポイントを持つワークフロー
class HumanReviewState(TypedDict):
    messages: Annotated[list, operator.add]
    draft_email: str
    recipient: str
    human_feedback: str
    send_approved: bool
    edit_requested: bool

def draft_email(state: HumanReviewState) -> dict:
    """メールの下書きを作成"""
    response = llm.invoke(
        f"以下の内容でビジネスメールを作成:\n"
        f"宛先: {state['recipient']}\n"
        f"要件: {state['messages'][-1].content}"
    )
    return {"draft_email": response.content}

def apply_feedback(state: HumanReviewState) -> dict:
    """人間のフィードバックを反映"""
    response = llm.invoke(
        f"以下のメール下書きを修正してください:\n\n"
        f"原文:\n{state['draft_email']}\n\n"
        f"修正指示:\n{state['human_feedback']}"
    )
    return {"draft_email": response.content, "edit_requested": False}

def send_email(state: HumanReviewState) -> dict:
    """メールを送信"""
    # 実際のメール送信処理
    return {"messages": [AIMessage(content=f"メールを送信しました: {state['recipient']}")]}

def route_after_review(state: HumanReviewState) -> Literal["edit", "send", "cancel"]:
    if state.get("edit_requested"):
        return "edit"
    if state.get("send_approved"):
        return "send"
    return "cancel"

graph = StateGraph(HumanReviewState)
graph.add_node("draft", draft_email)
graph.add_node("edit", apply_feedback)
graph.add_node("send", send_email)

graph.add_edge(START, "draft")
graph.add_conditional_edges("draft", route_after_review, {
    "edit": "edit",
    "send": "send",
    "cancel": END
})
graph.add_conditional_edges("edit", route_after_review, {
    "edit": "edit",
    "send": "send",
    "cancel": END
})
graph.add_edge("send", END)

app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_after=["draft", "edit"]  # 下書き作成後と編集後に中断
)

# 使用フロー
config = {"configurable": {"thread_id": "email-1"}}

# 1. 下書き作成（中断）
result = app.invoke({
    "messages": [HumanMessage(content="来週の会議の日程変更をお知らせする")],
    "recipient": "team@example.com",
    "draft_email": "",
    "human_feedback": "",
    "send_approved": False,
    "edit_requested": False
}, config=config)

# 2. 人間がレビュー → 修正を要求
state = app.get_state(config)
print(f"下書き: {state.values['draft_email']}")

# 修正を依頼
app.update_state(config, {
    "edit_requested": True,
    "human_feedback": "もう少しカジュアルな文体にしてください"
})
result = app.invoke(None, config=config)

# 3. 修正後にレビュー → 承認して送信
app.update_state(config, {
    "send_approved": True,
    "edit_requested": False
})
result = app.invoke(None, config=config)
```

---

## 6. Subgraphs and Modular Design

### 6.1 Creating Subgraphs

```python
# 再利用可能なサブグラフ
from langgraph.graph import StateGraph, END, START

# サブグラフ: 検索+要約パイプライン
class SearchSubState(TypedDict):
    query: str
    results: list[str]
    summary: str

def search_web(state: SearchSubState) -> dict:
    """Web検索を実行"""
    # 検索API呼び出し
    results = [f"Result for: {state['query']}"]
    return {"results": results}

def summarize_results(state: SearchSubState) -> dict:
    """検索結果を要約"""
    results_text = "\n".join(state["results"])
    response = llm.invoke(f"以下の検索結果を要約:\n{results_text}")
    return {"summary": response.content}

# サブグラフのビルド
search_graph = StateGraph(SearchSubState)
search_graph.add_node("search", search_web)
search_graph.add_node("summarize", summarize_results)
search_graph.add_edge(START, "search")
search_graph.add_edge("search", "summarize")
search_graph.add_edge("summarize", END)

search_subgraph = search_graph.compile()

# メイングラフにサブグラフを組み込む
class MainState(TypedDict):
    messages: Annotated[list, operator.add]
    query: str
    results: list[str]
    summary: str
    final_answer: str

def prepare_query(state: MainState) -> dict:
    """ユーザーの質問から検索クエリを生成"""
    last_message = state["messages"][-1].content
    response = llm.invoke(f"以下の質問に最適な検索クエリを生成:\n{last_message}")
    return {"query": response.content}

def generate_answer(state: MainState) -> dict:
    """検索結果から最終回答を生成"""
    response = llm.invoke(
        f"質問: {state['messages'][-1].content}\n"
        f"検索結果の要約: {state['summary']}\n"
        f"この情報をもとに回答してください。"
    )
    return {"final_answer": response.content}

main_graph = StateGraph(MainState)
main_graph.add_node("prepare", prepare_query)
main_graph.add_node("search_pipeline", search_subgraph)  # サブグラフをノードとして追加
main_graph.add_node("answer", generate_answer)

main_graph.add_edge(START, "prepare")
main_graph.add_edge("prepare", "search_pipeline")
main_graph.add_edge("search_pipeline", "answer")
main_graph.add_edge("answer", END)

main_app = main_graph.compile()
```

### 6.2 Parallel Subgraphs

```python
# 並列実行可能なサブグラフパターン
from langgraph.graph import StateGraph, END, START
from typing import TypedDict, Annotated
import operator

class ParallelState(TypedDict):
    query: str
    web_results: str
    db_results: str
    combined_answer: str

def search_web_node(state: ParallelState) -> dict:
    """Web検索"""
    response = llm.invoke(f"Web検索シミュレーション: {state['query']}")
    return {"web_results": response.content}

def search_db_node(state: ParallelState) -> dict:
    """データベース検索"""
    response = llm.invoke(f"DB検索シミュレーション: {state['query']}")
    return {"db_results": response.content}

def combine_results(state: ParallelState) -> dict:
    """結果を統合"""
    response = llm.invoke(
        f"以下の2つの検索結果を統合して回答:\n"
        f"Web: {state['web_results']}\n"
        f"DB: {state['db_results']}"
    )
    return {"combined_answer": response.content}

graph = StateGraph(ParallelState)
graph.add_node("web_search", search_web_node)
graph.add_node("db_search", search_db_node)
graph.add_node("combine", combine_results)

# 並列実行: STARTから2つのノードへ同時に分岐
graph.add_edge(START, "web_search")
graph.add_edge(START, "db_search")

# 両方の結果が揃ったら統合
graph.add_edge("web_search", "combine")
graph.add_edge("db_search", "combine")
graph.add_edge("combine", END)

app = graph.compile()
```

---

## 7. Multi-Agent Graphs

### 7.1 Basic Multi-Agent Setup

```python
# LangGraph でのマルチエージェント
class MultiAgentState(TypedDict):
    messages: Annotated[list, operator.add]
    current_agent: str
    task_status: str

# エージェントノード
def researcher(state: MultiAgentState) -> dict:
    """リサーチエージェント"""
    response = research_llm.invoke(state["messages"])
    return {"messages": [response], "current_agent": "researcher"}

def coder(state: MultiAgentState) -> dict:
    """コーディングエージェント"""
    response = coding_llm.invoke(state["messages"])
    return {"messages": [response], "current_agent": "coder"}

def reviewer(state: MultiAgentState) -> dict:
    """レビューエージェント"""
    response = review_llm.invoke(state["messages"])
    return {"messages": [response], "current_agent": "reviewer"}

# ルーター
def route_to_agent(state: MultiAgentState) -> str:
    last = state["messages"][-1].content
    if "調査が必要" in last:
        return "researcher"
    elif "コードを書いて" in last:
        return "coder"
    elif "レビューして" in last:
        return "reviewer"
    return "end"
```

```
Multi-agent graph

         +──────────→ [Researcher]──+
         |                          |
START → [Router] ──→ [Coder] ──────+──→ [Aggregator] → END
         |                          |
         +──────────→ [Reviewer]───+
```

### 7.2 Supervisor Pattern

```python
# スーパーバイザーが各エージェントを指揮するパターン
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

class SupervisorState(TypedDict):
    messages: Annotated[list, operator.add]
    next_agent: str
    iteration: int
    completed_tasks: list[str]

def supervisor(state: SupervisorState) -> dict:
    """スーパーバイザーが次のアクションを決定"""
    system_message = SystemMessage(content="""
あなたはプロジェクトマネージャーです。
チームメンバー: researcher, coder, tester
タスクの進行状況を見て、次に誰が作業すべきか決めてください。
全てのタスクが完了したら 'DONE' と返してください。
""")

    response = llm.invoke(
        [system_message] + state["messages"]
    )

    # 次のエージェントを決定
    content = response.content.lower()
    if "done" in content:
        next_agent = "end"
    elif "researcher" in content:
        next_agent = "researcher"
    elif "coder" in content:
        next_agent = "coder"
    elif "tester" in content:
        next_agent = "tester"
    else:
        next_agent = "end"

    return {
        "messages": [response],
        "next_agent": next_agent,
        "iteration": state["iteration"] + 1
    }

def researcher_agent(state: SupervisorState) -> dict:
    """リサーチャーの実行"""
    researcher_llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    response = researcher_llm.invoke(
        [SystemMessage(content="あなたはリサーチャーです。")] + state["messages"]
    )
    return {
        "messages": [response],
        "completed_tasks": ["research"]
    }

def coder_agent(state: SupervisorState) -> dict:
    """コーダーの実行"""
    coder_llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    response = coder_llm.invoke(
        [SystemMessage(content="あなたはプログラマーです。")] + state["messages"]
    )
    return {
        "messages": [response],
        "completed_tasks": ["coding"]
    }

def tester_agent(state: SupervisorState) -> dict:
    """テスターの実行"""
    tester_llm = ChatAnthropic(model="claude-sonnet-4-20250514")
    response = tester_llm.invoke(
        [SystemMessage(content="あなたはテストエンジニアです。")] + state["messages"]
    )
    return {
        "messages": [response],
        "completed_tasks": ["testing"]
    }

def route_supervisor(state: SupervisorState) -> str:
    if state["iteration"] >= 10:
        return "end"
    return state.get("next_agent", "end")

graph = StateGraph(SupervisorState)
graph.add_node("supervisor", supervisor)
graph.add_node("researcher", researcher_agent)
graph.add_node("coder", coder_agent)
graph.add_node("tester", tester_agent)

graph.add_edge(START, "supervisor")
graph.add_conditional_edges("supervisor", route_supervisor, {
    "researcher": "researcher",
    "coder": "coder",
    "tester": "tester",
    "end": END
})

# 各エージェントの完了後はスーパーバイザーに戻る
graph.add_edge("researcher", "supervisor")
graph.add_edge("coder", "supervisor")
graph.add_edge("tester", "supervisor")

app = graph.compile()
```

### 7.3 Agent Handoff Pattern

```python
# エージェント間で直接制御を移譲するパターン
class HandoffState(TypedDict):
    messages: Annotated[list, operator.add]
    current_agent: str
    handoff_to: str
    handoff_reason: str

def create_agent_node(name: str, system_prompt: str, available_handoffs: list[str]):
    """エージェントノードを動的に生成"""
    agent_llm = ChatAnthropic(model="claude-sonnet-4-20250514")

    handoff_instructions = "\n".join(
        f"- HANDOFF:{h} - {h}エージェントに引き継ぐ場合" for h in available_handoffs
    )

    def agent_fn(state: HandoffState) -> dict:
        response = agent_llm.invoke([
            SystemMessage(content=f"""{system_prompt}

他のエージェントに引き継ぐ必要がある場合は以下のフォーマットで指示:
{handoff_instructions}
- HANDOFF:end - タスク完了
"""),
            *state["messages"]
        ])

        content = response.content
        handoff_to = "end"
        for h in available_handoffs + ["end"]:
            if f"HANDOFF:{h}" in content:
                handoff_to = h
                break

        return {
            "messages": [response],
            "current_agent": name,
            "handoff_to": handoff_to
        }

    return agent_fn

# エージェントの定義
support_agent = create_agent_node(
    "support",
    "あなたはカスタマーサポートです。技術的な問題はtechエージェントに引き継ぎます。",
    ["tech", "billing"]
)

tech_agent = create_agent_node(
    "tech",
    "あなたは技術サポートです。請求に関する問題はbillingエージェントに引き継ぎます。",
    ["support", "billing"]
)

billing_agent = create_agent_node(
    "billing",
    "あなたは請求担当です。",
    ["support", "tech"]
)

def route_handoff(state: HandoffState) -> str:
    return state.get("handoff_to", "end")

graph = StateGraph(HandoffState)
graph.add_node("support", support_agent)
graph.add_node("tech", tech_agent)
graph.add_node("billing", billing_agent)

graph.add_edge(START, "support")

for agent_name in ["support", "tech", "billing"]:
    graph.add_conditional_edges(agent_name, route_handoff, {
        "support": "support",
        "tech": "tech",
        "billing": "billing",
        "end": END
    })

app = graph.compile(checkpointer=MemorySaver())
```

---

## 8. Streaming

### 8.1 Node-Level Streaming

```python
# ストリーミングでグラフの実行過程を追跡
config = {"configurable": {"thread_id": "stream-test"}}

# stream() でノードの完了を逐次取得
for event in app.stream(
    {"messages": [HumanMessage(content="AIエージェントについて調べて")]},
    config=config,
    stream_mode="updates"  # ノードの更新のみ
):
    for node_name, output in event.items():
        print(f"=== {node_name} ===")
        if "messages" in output:
            print(f"  Messages: {len(output['messages'])}")
        print()
```

### 8.2 Token-Level Streaming

```python
# LLMのトークンをリアルタイムでストリーミング
async def stream_tokens():
    config = {"configurable": {"thread_id": "token-stream"}}

    async for event in app.astream_events(
        {"messages": [HumanMessage(content="詳細な説明をお願いします")]},
        config=config,
        version="v2"
    ):
        kind = event["event"]

        if kind == "on_chat_model_stream":
            # トークンの出力
            content = event["data"]["chunk"].content
            if content:
                print(content, end="", flush=True)

        elif kind == "on_chain_start":
            # ノードの開始
            if event.get("name"):
                print(f"\n--- {event['name']} 開始 ---")

        elif kind == "on_chain_end":
            # ノードの完了
            if event.get("name"):
                print(f"\n--- {event['name']} 完了 ---")

        elif kind == "on_tool_start":
            print(f"\n[Tool: {event['name']}]")

# FastAPI + SSE でフロントエンドにストリーミング
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import json

fastapi_app = FastAPI()

@fastapi_app.post("/agent/stream")
async def stream_agent(request: dict):
    async def event_generator():
        config = {"configurable": {"thread_id": request.get("thread_id", "default")}}

        async for event in app.astream_events(
            {"messages": [HumanMessage(content=request["message"])]},
            config=config,
            version="v2"
        ):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    yield f"data: {json.dumps({'type': 'token', 'content': content}, ensure_ascii=False)}\n\n"
            elif kind == "on_chain_start" and event.get("name"):
                yield f"data: {json.dumps({'type': 'node_start', 'node': event['name']}, ensure_ascii=False)}\n\n"
            elif kind == "on_chain_end" and event.get("name"):
                yield f"data: {json.dumps({'type': 'node_end', 'node': event['name']}, ensure_ascii=False)}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## 9. Testing and Debugging

### 9.1 Node-Level Testing

```python
import pytest
from unittest.mock import MagicMock, patch
from langchain_core.messages import HumanMessage, AIMessage

class TestReviewCycle:
    """Review cycle tests"""

    def test_generate_node(self):
        """Generate node returns a draft"""
        state = {"task": "テスト文書を作成", "draft": "", "review": "",
                 "revision_count": 0, "is_approved": False}
        result = generate(state)
        assert "draft" in result
        assert len(result["draft"]) > 0

    def test_review_approved(self):
        """Review results in approval"""
        state = {"task": "テスト", "draft": "完璧な文書",
                 "review": "", "revision_count": 0, "is_approved": False}

        with patch("__main__.llm") as mock_llm:
            mock_llm.invoke.return_value = MagicMock(content="APPROVED: 素晴らしい内容です")
            result = review(state)
            assert result["is_approved"] is True

    def test_review_rejected(self):
        """Review results in revision request"""
        state = {"task": "テスト", "draft": "不十分な文書",
                 "review": "", "revision_count": 0, "is_approved": False}

        with patch("__main__.llm") as mock_llm:
            mock_llm.invoke.return_value = MagicMock(content="要改善: 具体例が不足")
            result = review(state)
            assert result["is_approved"] is False

    def test_route_review_approved(self):
        """Routing when approved"""
        state = {"is_approved": True, "revision_count": 1}
        assert route_review(state) == "end"

    def test_route_review_max_revisions(self):
        """Routing when max revisions reached"""
        state = {"is_approved": False, "revision_count": 3}
        assert route_review(state) == "end"

    def test_route_review_needs_revision(self):
        """Routing when revision is needed"""
        state = {"is_approved": False, "revision_count": 1}
        assert route_review(state) == "revise"
```

### 9.2 Full Graph Integration Tests

```python
class TestFullGraph:
    """Full graph integration tests"""

    @pytest.fixture
    def compiled_app(self):
        """Compiled graph for testing"""
        return graph.compile()

    def test_full_execution(self, compiled_app):
        """Full graph completes successfully"""
        result = compiled_app.invoke({
            "task": "Pythonの基礎についての短い段落を書いてください",
            "draft": "",
            "review": "",
            "revision_count": 0,
            "is_approved": False
        })
        assert result["draft"] != ""
        assert result["revision_count"] >= 0

    def test_stream_execution(self, compiled_app):
        """All nodes are executed during streaming"""
        visited_nodes = []

        for event in compiled_app.stream({
            "task": "テストタスク",
            "draft": "",
            "review": "",
            "revision_count": 0,
            "is_approved": False
        }):
            for node_name in event:
                visited_nodes.append(node_name)

        assert "generate" in visited_nodes
        assert "review" in visited_nodes

    def test_checkpointed_execution(self):
        """Checkpointed execution"""
        checkpointer = MemorySaver()
        app = graph.compile(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": "test-thread"}}

        result = app.invoke({
            "task": "テスト",
            "draft": "",
            "review": "",
            "revision_count": 0,
            "is_approved": False
        }, config=config)

        # Verify that state has been saved
        state = app.get_state(config)
        assert state.values["draft"] != ""
```

### 9.3 Graph Visualization and Debugging

```python
# グラフの構造を可視化
app = graph.compile()

# ASCII表示
print(app.get_graph().draw_ascii())

# Mermaid形式で出力（ドキュメントやREADMEに埋め込み可能）
mermaid = app.get_graph().draw_mermaid()
print(mermaid)
# 出力例:
# graph TD
#     __start__ --> generate
#     generate --> review
#     review -- revise --> revise
#     review -- end --> __end__
#     revise --> review

# PNG画像として保存
app.get_graph().draw_mermaid_png(
    output_file_path="graph_visualization.png"
)

# デバッグ: 各ステップの状態を詳細に出力
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("langgraph")

# ステップ実行でデバッグ
for step_output in app.stream(
    {"task": "テスト", "draft": "", "review": "",
     "revision_count": 0, "is_approved": False},
    stream_mode="debug"
):
    print(f"Step: {step_output}")
```

---

## 10. Production Operation Patterns

### 10.1 Deploying to LangGraph Cloud

```python
# langgraph.json の設定
# {
#     "dependencies": ["."],
#     "graphs": {
#         "agent": "./agent.py:app"
#     },
#     "env": ".env"
# }

# LangGraph Studio でローカルテスト
# $ pip install langgraph-cli
# $ langgraph dev

# LangGraph Cloud へのデプロイ
# $ langgraph deploy --app agent
```

### 10.2 Error Handling and Recovery

```python
from langgraph.graph import StateGraph, END, START

class RobustState(TypedDict):
    messages: Annotated[list, operator.add]
    error: str
    retry_count: int
    max_retries: int

def robust_node(state: RobustState) -> dict:
    """Node with error handling"""
    try:
        response = llm.invoke(state["messages"])
        return {"messages": [response], "error": ""}
    except Exception as e:
        return {
            "error": str(e),
            "retry_count": state.get("retry_count", 0) + 1
        }

def error_handler(state: RobustState) -> dict:
    """Error handling node"""
    error_msg = f"エラーが発生しました（{state['retry_count']}回目）: {state['error']}"
    return {
        "messages": [AIMessage(content=error_msg)]
    }

def route_after_execution(state: RobustState) -> Literal["retry", "error", "end"]:
    if state.get("error"):
        if state.get("retry_count", 0) < state.get("max_retries", 3):
            return "retry"
        return "error"
    return "end"

graph = StateGraph(RobustState)
graph.add_node("execute", robust_node)
graph.add_node("error_handler", error_handler)

graph.add_edge(START, "execute")
graph.add_conditional_edges("execute", route_after_execution, {
    "retry": "execute",
    "error": "error_handler",
    "end": END
})
graph.add_edge("error_handler", END)

app = graph.compile()
```

### 10.3 Rate Limiting and Queue Management

```python
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta

class RateLimitedGraphExecutor:
    """Graph executor with rate limiting"""

    def __init__(
        self,
        app,
        max_concurrent: int = 10,
        requests_per_minute: int = 60
    ):
        self.app = app
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.request_times: list[datetime] = []
        self.rpm_limit = requests_per_minute

    async def _wait_for_rate_limit(self):
        """Check rate limit and wait if necessary"""
        now = datetime.now()
        # Remove requests older than 1 minute
        self.request_times = [
            t for t in self.request_times
            if now - t < timedelta(minutes=1)
        ]

        if len(self.request_times) >= self.rpm_limit:
            oldest = self.request_times[0]
            wait_time = 60 - (now - oldest).total_seconds()
            if wait_time > 0:
                await asyncio.sleep(wait_time)

        self.request_times.append(datetime.now())

    async def invoke(self, input_data: dict, config: dict) -> dict:
        """Execute with rate limiting"""
        await self._wait_for_rate_limit()
        async with self.semaphore:
            return await self.app.ainvoke(input_data, config=config)

# 使用例
executor = RateLimitedGraphExecutor(
    app=app,
    max_concurrent=5,
    requests_per_minute=30
)

result = await executor.invoke(
    {"messages": [HumanMessage(content="テスト")]},
    config={"configurable": {"thread_id": "rate-limited-1"}}
)
```

---

## 11. Comparison Tables

### 11.1 LangGraph vs Other Workflow Tools

| Feature | LangGraph | Apache Airflow | Temporal | Prefect |
|---------|-----------|---------------|----------|---------|
| Target use case | LLM agents | Data pipelines | Microservices | Data workflows |
| Cycles | Native | Not supported | Supported | Not supported |
| LLM integration | Native | Plugin | Manual | Plugin |
| Checkpoints | Built-in | Built-in | Built-in | Built-in |
| HITL | Built-in | External | External | External |
| Learning curve | Medium | High | High | Medium |

### 11.2 Graph Structure Patterns

| Pattern | Use Case | Cycles | Complexity |
|---------|----------|--------|------------|
| Sequential graph | Pipeline | None | Low |
| Branching graph | Routing | None | Medium |
| Cyclic graph | Improvement loop | Yes | Medium |
| Subgraph | Reusable component | Yes/No | Medium–High |
| Multi-agent | Coordination | Yes | High |

### 11.3 Checkpoint Method Comparison

| Method | Persistence | Speed | Scalability | Recommended Environment |
|--------|-------------|-------|-------------|------------------------|
| MemorySaver | No | Fastest | Single process | Development/Testing |
| SqliteSaver | Yes | Fast | Single machine | Small-scale production |
| PostgresSaver | Yes | Medium | Distributed | Production |
| Custom | Configurable | Configurable | Configurable | Special requirements |

### 11.4 Multi-Agent Pattern Comparison

| Pattern | Control Model | Flexibility | Complexity | Recommended Case |
|---------|--------------|-------------|------------|-----------------|
| Supervisor | Centralized | High | Medium | Clear role separation |
| Handoff | Distributed | Highest | High | Dynamic task assignment |
| Pipeline | Sequential | Low | Low | Fixed workflows |
| Voting/Consensus | Consensus | Medium | Medium | Quality-focused decisions |

---

## 12. Anti-Patterns

### Anti-Pattern 1: State Bloat

```python
# NG: 全データを状態に保持
class BadState(TypedDict):
    messages: list           # 全会話履歴
    all_search_results: list # 全検索結果（巨大）
    all_documents: list      # 全ドキュメント内容（巨大）

# OK: 必要最小限の状態 + 外部ストア参照
class GoodState(TypedDict):
    messages: list
    current_context: str     # 現在のステップに必要な情報のみ
    document_ids: list[str]  # IDのみ保持、内容は外部から取得
```

### Anti-Pattern 2: Excessively Deep Cycles

```python
# NG: 無制限のサイクル
def route(state):
    if not state["is_perfect"]:
        return "revise"  # 完璧になるまで無限ループ

# OK: 最大回数を制限
def route(state):
    if not state["is_approved"] and state["revision_count"] < 3:
        return "revise"
    return "end"  # 3回で打ち切り
```

### Anti-Pattern 3: Overly Complex Graphs

```python
# NG: 1つの巨大グラフに全てを詰め込む
# 50ノード以上のモノリシックなグラフは理解・デバッグ困難

# OK: サブグラフで分割
# メイングラフ: 5-10ノード
# サブグラフ: それぞれ3-7ノード

# 分割の基準:
# 1. 独立してテスト可能な機能単位
# 2. 再利用可能なパイプライン
# 3. 異なる開発者が担当する領域
```

### Anti-Pattern 4: Overuse of Checkpoints

```python
# NG: 全てのグラフにチェックポイントを設定
# 短命なワンショット処理にチェックポイントは不要
one_shot_app = simple_graph.compile(
    checkpointer=PostgresSaver(...)  # オーバーヘッドのみ
)

# OK: チェックポイントが必要な場面を見極める
# - 長時間実行するワークフロー
# - ヒューマン・イン・ザ・ループが必要
# - エラー時にリトライしたい
# - 会話の継続性が必要
```

### Anti-Pattern 5: Side Effects in Routing Functions

```python
# NG: ルーティング関数内で状態を変更
def bad_router(state: dict) -> str:
    state["visited_count"] += 1  # 副作用！ルーターで状態変更してはいけない
    if state["visited_count"] > 3:
        return "end"
    return "process"

# OK: ルーティングは純粋に状態の参照のみ
def good_router(state: dict) -> str:
    if state.get("visited_count", 0) > 3:
        return "end"
    return "process"

# 状態の変更はノード関数で行う
def process_node(state: dict) -> dict:
    return {"visited_count": state.get("visited_count", 0) + 1}
```

---

## 13. FAQ

### Q1: How do I debug LangGraph?

- **LangSmith** integration for visualizing execution traces
- **Verbose output**: log the input/output of each node
- **Step execution**: inspect one step at a time with `app.stream()`
- **State snapshots**: use checkpoints to inspect state at any point in time
- **Graph visualization**: verify structure with `app.get_graph().draw_mermaid()`

### Q2: How do I test a graph?

Test in order: node-level → edge-level → full integration:
```python
def test_review_node():
    state = {"draft": "テスト文書", "review": "", "is_approved": False}
    result = review(state)
    assert "review" in result
```

### Q3: What is LangGraph Cloud?

A managed production deployment service for LangGraph. It exposes graphs as APIs and provides checkpointing, scaling, and monitoring as managed services. It integrates with LangSmith.

### Q4: How does LangGraph differ from CrewAI/AutoGen?

- **LangGraph**: low-level graph primitives with maximum flexibility; you design the graph yourself
- **CrewAI**: high-level multi-agent framework with role-based declarative definitions
- **AutoGen**: from Microsoft; conversation-based multi-agent with asynchronous message passing

**How to choose**: if you need customizability, use LangGraph; if you want to build multi-agent systems quickly, use CrewAI.

### Q5: How do I optimize performance for large graphs?

- **Parallel node execution**: independent nodes are executed in parallel
- **Minimize state**: store large data in external stores and keep only IDs in state
- **Subgraph decomposition**: split large graphs into smaller subgraphs
- **Appropriate checkpoints**: MemorySaver (development) → PostgresSaver (production)
- **Minimize LLM calls**: avoid unnecessary LLM calls; make routing as deterministic as possible

### Q6: How do I write async code in LangGraph?

```python
# 非同期ノード関数
async def async_node(state: AgentState) -> dict:
    response = await llm.ainvoke(state["messages"])
    return {"messages": [response]}

# 非同期実行
result = await app.ainvoke(
    {"messages": [HumanMessage(content="テスト")]},
    config={"configurable": {"thread_id": "async-1"}}
)

# 非同期ストリーミング
async for event in app.astream_events(
    {"messages": [HumanMessage(content="テスト")]},
    version="v2"
):
    print(event)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work, particularly during code reviews and architecture design.

---

## Summary

| Item | Details |
|------|---------|
| State graph | An explicit graph of nodes + edges + state |
| Cycles | Native support for loops (improvement cycles) |
| Checkpoints | State persistence with pause and resume |
| HITL | Human intervention via interrupt_before/after |
| Subgraphs | Modular design and improved reusability |
| Multi-agent | Supervisor / handoff / pipeline patterns |
| Streaming | Supports both node-level and token-level streaming |
| Principles | Keep state minimal; set upper limits on cycles |

## What to Read Next

- [02-mcp-agents.md](./02-mcp-agents.md) -- Implementing MCP agents
- [03-claude-agent-sdk.md](./03-claude-agent-sdk.md) -- Claude Agent SDK in depth
- [../01-patterns/02-workflow-agents.md](../01-patterns/02-workflow-agents.md) -- Workflow design patterns

## References

1. LangGraph Documentation -- https://langchain-ai.github.io/langgraph/
2. LangGraph GitHub -- https://github.com/langchain-ai/langgraph
3. LangChain Blog, "LangGraph: Multi-Agent Workflows" -- https://blog.langchain.dev/langgraph-multi-agent-workflows/
4. LangGraph Cloud Documentation -- https://langchain-ai.github.io/langgraph/cloud/
5. LangGraph Tutorials -- https://langchain-ai.github.io/langgraph/tutorials/
