# Workflow Agents

> DAGs, conditional branching, and parallel execution — designing and implementing workflow agents that follow predefined flows while dynamically selecting paths through LLM decisions.

## What You Will Learn

1. The difference between workflow agents and free-form agents, and when to use each
2. DAG (Directed Acyclic Graph)-based flow design and conditional branching implementation
3. Patterns for building stateful workflows with LangGraph
4. Practical techniques for parallel execution, subworkflows, and dynamic flow generation
5. Error handling, checkpointing, and retry strategies
6. Monitoring, cost optimization, and testing approaches for production use


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Multi-Agent](./01-multi-agent.md)

---

## 1. What Are Workflow Agents?

### 1.1 Free-Form vs. Workflow

```
Free-Form Agent:
  Goal → [LLM decides freely] → ... → Result
  · LLM decides what to do at each step
  · Flexible but unpredictable

Workflow Agent:
  Goal → [Node 1] → [Condition] → [Node 2a or 2b] → [Node 3] → Result
  · Follows a predefined flow
  · LLM executes processing at each node
  · Predictable and easy to control
```

### 1.2 Positioning

```
Control Spectrum

 Fully Manual                              Fully Autonomous
 +--------+-----------+-------------+--------+
 | Fixed  | Workflow  | Single      | Auton- |
 | pipe-  | Agent     | Agent       | omous  |
 | line   |           | (ReAct)     | Agent  |
 +--------+-----------+-------------+--------+
           ^^^^^^^^^^^^
           Scope of this chapter

 Flow: designed by the developer
 In-node processing: executed by LLM
```

### 1.3 Decision Flowchart for Workflow Agents

```
Should you use a workflow agent?

Q1: Can the task steps be defined in advance?
├─ YES → Go to Q2
└─ NO  → Consider a free-form agent (ReAct / autonomous)

Q2: Does each step require LLM judgment?
├─ YES → Go to Q3
└─ NO  → A fixed pipeline (no LLM needed) is sufficient

Q3: Are the execution path branches predictable?
├─ YES → A workflow agent is the best fit
└─ NO  → Consider a hybrid (workflow + autonomous nodes)

Q4: Are there steps that can be parallelized for speed?
├─ YES → Adopt a parallel workflow pattern
└─ NO  → A sequential workflow is sufficient

Q5: Is reproducibility or auditability of processing required?
├─ YES → Workflow + checkpoints are essential
└─ NO  → Start with a simple workflow
```

### 1.4 Typical Use Cases

```
Workflow Suitability by Use Case

High suitability:
  · Customer support inquiry processing
  · Content generation pipeline (write → review → publish)
  · Document processing (parse → classify → summarize → store)
  · Automated code review (analyze → detect issues → suggest fixes → apply)
  · Data ETL pipeline (extract → transform → quality check → load)

Moderate:
  · Research assistant (gather info → analyze → report)
  · Automated email/message replies
  · Automated report generation

Low suitability:
  · Free-form conversational chatbot
  · Exploratory data analysis
  · Creative brainstorming
```

---

## 2. DAG-Based Flow Design

### 2.1 What Is a DAG?

```
DAG (Directed Acyclic Graph) Example: Document Processing Pipeline

  [Intake] ──→ [Detect Language] ──→ [Translate?] ──→ [Summarize] ──→ [Output]
                     |                    ^
                     |  Japanese           | English
                     +──(skip) ──→────────+
                     |
                     v Other language
                  [Run Translation] ─────→──+

※ No cycles (loops) = guaranteed termination
```

### 2.2 Basic Workflow Implementation

```python
# DAG-based workflow engine
from dataclasses import dataclass, field
from typing import Callable, Any
from enum import Enum
import time
import logging

logger = logging.getLogger(__name__)

class NodeType(Enum):
    LLM = "llm"           # LLM processing node
    TOOL = "tool"          # Tool execution node
    CONDITION = "condition" # Conditional branch node
    PARALLEL = "parallel"   # Parallel execution node
    SUBWORKFLOW = "subworkflow"  # Subworkflow node

class NodeStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class NodeExecution:
    """Record of node execution"""
    node_name: str
    status: NodeStatus
    start_time: float
    end_time: float = 0.0
    result: Any = None
    error: str = None

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time

@dataclass
class WorkflowNode:
    name: str
    type: NodeType
    handler: Callable
    next_nodes: list[str] = field(default_factory=list)
    condition: Callable = None  # For conditional branching
    retry_count: int = 0       # Number of retries
    timeout: float = 30.0      # Timeout in seconds
    description: str = ""      # Node description

class WorkflowEngine:
    def __init__(self, name: str = "default"):
        self.name = name
        self.nodes: dict[str, WorkflowNode] = {}
        self.state: dict[str, Any] = {}
        self.execution_log: list[NodeExecution] = []
        self.hooks: dict[str, list[Callable]] = {
            "before_node": [],
            "after_node": [],
            "on_error": [],
        }

    def add_node(self, node: WorkflowNode):
        self.nodes[node.name] = node

    def add_hook(self, event: str, callback: Callable):
        """Add a hook"""
        if event in self.hooks:
            self.hooks[event].append(callback)

    def _execute_hooks(self, event: str, **kwargs):
        for hook in self.hooks.get(event, []):
            hook(**kwargs)

    def _execute_node(self, node: WorkflowNode) -> Any:
        """Execute a node (with retry)"""
        last_error = None
        for attempt in range(node.retry_count + 1):
            try:
                self._execute_hooks("before_node", node=node, state=self.state)
                result = node.handler(self.state)
                self._execute_hooks("after_node", node=node, state=self.state, result=result)
                return result
            except Exception as e:
                last_error = e
                logger.warning(f"Node {node.name} failed (attempt {attempt + 1}): {e}")
                if attempt < node.retry_count:
                    time.sleep(2 ** attempt)  # Exponential backoff

        self._execute_hooks("on_error", node=node, error=last_error)
        raise last_error

    def run(self, start_node: str, initial_state: dict) -> dict:
        self.state = initial_state
        self.execution_log = []
        current = start_node

        while current:
            node = self.nodes[current]
            execution = NodeExecution(
                node_name=node.name,
                status=NodeStatus.RUNNING,
                start_time=time.time()
            )
            logger.info(f"Running: {node.name} ({node.type.value})")

            try:
                if node.type == NodeType.CONDITION:
                    branch = node.condition(self.state)
                    current = branch
                    execution.status = NodeStatus.COMPLETED
                    execution.result = f"Branch: {branch}"
                elif node.type == NodeType.PARALLEL:
                    results = self._run_parallel(node.next_nodes)
                    self.state["parallel_results"] = results
                    current = node.next_nodes[-1] if node.next_nodes else None
                    execution.status = NodeStatus.COMPLETED
                else:
                    result = self._execute_node(node)
                    self.state[f"{node.name}_result"] = result
                    current = node.next_nodes[0] if node.next_nodes else None
                    execution.status = NodeStatus.COMPLETED
                    execution.result = result
            except Exception as e:
                execution.status = NodeStatus.FAILED
                execution.error = str(e)
                logger.error(f"Fatal error in node {node.name}: {e}")
                raise
            finally:
                execution.end_time = time.time()
                self.execution_log.append(execution)

        return self.state

    def get_execution_summary(self) -> str:
        """Get execution summary"""
        lines = [f"Workflow '{self.name}' execution result:"]
        total_duration = 0
        for ex in self.execution_log:
            status_icon = "✓" if ex.status == NodeStatus.COMPLETED else "✗"
            lines.append(
                f"  {status_icon} {ex.node_name}: {ex.duration:.2f}s "
                f"({ex.status.value})"
            )
            total_duration += ex.duration
        lines.append(f"  Total time: {total_duration:.2f}s")
        return "\n".join(lines)
```

### 2.3 Implementing Conditional Branching

```python
# Workflow with conditional branching
import anthropic

client = anthropic.Anthropic()

def classify_inquiry(message: str) -> str:
    """Classify an inquiry using LLM"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": f"""Classify the following inquiry.
Categories: billing, technical, general
Answer in one word: {message}"""
        }]
    )
    return response.content[0].text.strip().lower()

def handle_billing_inquiry(state: dict) -> str:
    """Handle billing-related inquiries"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system="You are a billing support agent. Respond politely and accurately.",
        messages=[{
            "role": "user",
            "content": state["user_message"]
        }]
    )
    return response.content[0].text

def handle_technical_inquiry(state: dict) -> str:
    """Handle technical inquiries"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system="You are a technical support agent. Resolve technical issues.",
        messages=[{
            "role": "user",
            "content": state["user_message"]
        }]
    )
    return response.content[0].text

def handle_general_inquiry(state: dict) -> str:
    """Handle general inquiries"""
    response = client.messages.create(
        model="claude-haiku-3-20240307",
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": state["user_message"]
        }]
    )
    return response.content[0].text

def generate_response(state: dict) -> str:
    """Format the final answer"""
    # Get the result corresponding to the classification
    classification = state.get("classify_result", "general")
    handler_key = f"handle_{classification}_result"
    raw_response = state.get(handler_key, "Unable to generate a response")

    return f"""
[Category] {classification}
[Response]
{raw_response}

Please feel free to contact us if you have any further questions.
"""

def build_support_workflow():
    engine = WorkflowEngine(name="Customer Support")

    # Node 1: Classify inquiry
    engine.add_node(WorkflowNode(
        name="classify",
        type=NodeType.LLM,
        handler=lambda state: classify_inquiry(state["user_message"]),
        next_nodes=["route"],
        description="Classify inquiry content using LLM"
    ))

    # Node 2: Routing (conditional branch)
    engine.add_node(WorkflowNode(
        name="route",
        type=NodeType.CONDITION,
        handler=None,
        condition=lambda state: {
            "billing": "handle_billing",
            "technical": "handle_technical",
            "general": "handle_general"
        }.get(state["classify_result"], "handle_general"),
        description="Route based on classification result"
    ))

    # Node 3a: Billing support
    engine.add_node(WorkflowNode(
        name="handle_billing",
        type=NodeType.LLM,
        handler=lambda state: handle_billing_inquiry(state),
        next_nodes=["respond"],
        retry_count=2,
        description="Respond to billing-related inquiries"
    ))

    # Node 3b: Technical support
    engine.add_node(WorkflowNode(
        name="handle_technical",
        type=NodeType.LLM,
        handler=lambda state: handle_technical_inquiry(state),
        next_nodes=["respond"],
        retry_count=2,
        description="Respond to technical inquiries"
    ))

    # Node 3c: General support
    engine.add_node(WorkflowNode(
        name="handle_general",
        type=NodeType.LLM,
        handler=lambda state: handle_general_inquiry(state),
        next_nodes=["respond"],
        retry_count=1,
        description="Respond to general inquiries"
    ))

    # Node 4: Generate response
    engine.add_node(WorkflowNode(
        name="respond",
        type=NodeType.LLM,
        handler=lambda state: generate_response(state),
        next_nodes=[],
        description="Format and return the final response"
    ))

    return engine

# Execution
workflow = build_support_workflow()
result = workflow.run("classify", {
    "user_message": "Last month's invoice amount is incorrect"
})
print(workflow.get_execution_summary())
```

### 2.4 Dynamic Flow Generation

```python
# Pattern where LLM generates the workflow itself
import json

class DynamicWorkflowBuilder:
    """Dynamically builds a workflow based on LLM decisions"""

    def __init__(self, client: anthropic.Anthropic):
        self.client = client
        self.available_handlers = {}

    def register_handler(self, name: str, handler: Callable, description: str):
        """Register an available handler"""
        self.available_handlers[name] = {
            "handler": handler,
            "description": description
        }

    def build_workflow(self, task_description: str) -> WorkflowEngine:
        """Auto-generate a workflow from a task description"""
        handler_descriptions = "\n".join(
            f"- {name}: {info['description']}"
            for name, info in self.available_handlers.items()
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"""Design a workflow in JSON format to process the following task.

Task: {task_description}

Available handlers:
{handler_descriptions}

Output format:
{{
    "nodes": [
        {{
            "name": "node name",
            "handler": "handler name",
            "next": ["next node name"],
            "type": "llm|condition|parallel"
        }}
    ],
    "start_node": "first node name"
}}"""
            }]
        )

        # Parse JSON and build workflow
        workflow_spec = json.loads(response.content[0].text)
        engine = WorkflowEngine(name=f"dynamic_{task_description[:20]}")

        for node_spec in workflow_spec["nodes"]:
            handler_name = node_spec["handler"]
            handler = self.available_handlers.get(handler_name, {}).get("handler")

            if handler:
                engine.add_node(WorkflowNode(
                    name=node_spec["name"],
                    type=NodeType(node_spec.get("type", "llm")),
                    handler=handler,
                    next_nodes=node_spec.get("next", [])
                ))

        return engine, workflow_spec["start_node"]

# Usage example
builder = DynamicWorkflowBuilder(client)
builder.register_handler(
    "extract_text", extract_text_from_pdf,
    "Extract text from a PDF"
)
builder.register_handler(
    "translate", translate_text,
    "Translate text"
)
builder.register_handler(
    "summarize", summarize_text,
    "Summarize text"
)

workflow, start = builder.build_workflow(
    "Read an English PDF, translate it to Japanese, and summarize it"
)
result = workflow.run(start, {"pdf_path": "document.pdf"})
```

---

## 3. Workflows with LangGraph

### 3.1 LangGraph State Graph

```
LangGraph State Graph Model

+--------+     +--------+     +----------+     +--------+
| START  |---->| Node A |---->| Condition|---->| Node B |
+--------+     +--------+     +-----+----+     +--------+
                                     |               |
                                     v               v
                               +--------+       +--------+
                               | Node C |------>|  END   |
                               +--------+       +--------+

Each node receives State and returns an updated State
Conditional edges determine the next node based on State content
```

### 3.2 LangGraph Implementation Example

```python
# Workflow agent using LangGraph
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal, Annotated
from operator import add

# State type definition
class AgentState(TypedDict):
    messages: list
    current_step: str
    classification: str
    draft: str
    review_result: str
    review_count: Annotated[int, "Number of reviews"]
    final_output: str
    token_usage: Annotated[list[dict], add]

# Node functions
def classify_request(state: AgentState) -> AgentState:
    """Classify the request"""
    messages = state["messages"]
    result = llm.invoke(
        f"Classify the following request as 'simple' or 'complex':\n{messages[-1]}"
    )
    return {
        "classification": result.content.strip(),
        "token_usage": [{"node": "classify", "tokens": result.usage_metadata}]
    }

def handle_simple(state: AgentState) -> AgentState:
    """Handle a simple request"""
    draft = llm.invoke(f"Answer concisely: {state['messages'][-1]}")
    return {
        "draft": draft.content,
        "token_usage": [{"node": "handle_simple", "tokens": draft.usage_metadata}]
    }

def handle_complex(state: AgentState) -> AgentState:
    """Handle a complex request"""
    context = ""
    if state.get("review_result") and "FAIL" in state["review_result"]:
        context = f"\n\nPrevious feedback: {state['review_result']}"

    draft = llm.invoke(
        f"Answer in detail: {state['messages'][-1]}{context}"
    )
    return {
        "draft": draft.content,
        "token_usage": [{"node": "handle_complex", "tokens": draft.usage_metadata}]
    }

def review(state: AgentState) -> AgentState:
    """Review the answer"""
    result = llm.invoke(
        f"Evaluate the quality of this answer. PASS/FAIL (include reason if FAIL):\n{state['draft']}"
    )
    return {
        "review_result": result.content.strip(),
        "review_count": state.get("review_count", 0) + 1,
        "token_usage": [{"node": "review", "tokens": result.usage_metadata}]
    }

def finalize(state: AgentState) -> AgentState:
    """Generate final output"""
    return {"final_output": state["draft"]}

# Conditional routing functions
def route_by_classification(state: AgentState) -> Literal["simple", "complex"]:
    return "simple" if "simple" in state["classification"] else "complex"

def route_by_review(state: AgentState) -> Literal["revise", "finalize"]:
    # Stop after 3 reviews at most
    if state.get("review_count", 0) >= 3:
        return "finalize"
    return "finalize" if "PASS" in state["review_result"] else "revise"

# Build graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("classify", classify_request)
workflow.add_node("handle_simple", handle_simple)
workflow.add_node("handle_complex", handle_complex)
workflow.add_node("review", review)
workflow.add_node("finalize", finalize)

# Add edges
workflow.set_entry_point("classify")
workflow.add_conditional_edges("classify", route_by_classification, {
    "simple": "handle_simple",
    "complex": "handle_complex"
})
workflow.add_edge("handle_simple", "review")
workflow.add_edge("handle_complex", "review")
workflow.add_conditional_edges("review", route_by_review, {
    "finalize": "finalize",
    "revise": "handle_complex"  # Redo
})
workflow.add_edge("finalize", END)

# Compile and run
app = workflow.compile()
result = app.invoke({
    "messages": ["What are the best practices for microservices?"],
    "current_step": "", "classification": "", "draft": "",
    "review_result": "", "review_count": 0,
    "final_output": "", "token_usage": []
})
```

### 3.3 LangGraph Checkpoints

```python
# Workflow with checkpoint functionality
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver
import sqlite3

# SQLite checkpoint (for development)
def create_workflow_with_checkpoint():
    """Workflow with checkpoint functionality"""
    conn = sqlite3.connect("workflow_checkpoints.db")
    memory = SqliteSaver(conn)

    workflow = StateGraph(AgentState)
    # ... add nodes and edges ...

    # Compile with checkpointer
    app = workflow.compile(checkpointer=memory)

    # Manage execution state by thread ID
    config = {"configurable": {"thread_id": "support-001"}}

    # Execute (can be resumed even if it fails midway)
    try:
        result = app.invoke(initial_state, config)
    except Exception as e:
        print(f"Error occurred: {e}")
        # Retrieve state from the last checkpoint
        state = app.get_state(config)
        print(f"Last successful node: {state.values}")

        # Fix state and resume
        app.update_state(config, {"draft": "Revised draft"})
        result = app.invoke(None, config)  # None resumes from previous state

    return result

# PostgreSQL checkpoint (for production)
def create_production_workflow():
    """Checkpoint for production environment"""
    from psycopg_pool import ConnectionPool

    pool = ConnectionPool(
        "postgresql://user:pass@localhost/workflows",
        max_size=20
    )
    memory = PostgresSaver(pool)
    memory.setup()  # Create tables

    workflow = StateGraph(AgentState)
    # ... add nodes ...
    app = workflow.compile(checkpointer=memory)

    return app
```

### 3.4 LangGraph Streaming

```python
# Streaming execution
async def stream_workflow():
    """Retrieve workflow progress in real time"""
    app = create_workflow()

    # Stream output per node
    async for event in app.astream(
        initial_state,
        config={"configurable": {"thread_id": "stream-001"}}
    ):
        for node_name, output in event.items():
            print(f"[{node_name}] Completed:")
            print(f"  Output: {json.dumps(output, ensure_ascii=False, indent=2)}")

    # Token-level streaming
    async for event in app.astream_events(
        initial_state,
        config={"configurable": {"thread_id": "stream-002"}},
        version="v2"
    ):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            print(chunk.content, end="", flush=True)
        elif event["event"] == "on_chain_end":
            print(f"\n--- {event['name']} completed ---")
```

---

## 4. Parallel Execution Patterns

### 4.1 Basic Parallel Execution

```python
# Parallel node implementation
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import NamedTuple

class ParallelResult(NamedTuple):
    node_name: str
    result: Any
    duration: float
    success: bool
    error: str = ""

class ParallelWorkflow:
    def __init__(self, max_workers: int = 5):
        self.max_workers = max_workers

    async def run_parallel_nodes(
        self,
        nodes: list[WorkflowNode],
        state: dict,
        timeout: float = 60.0
    ) -> list[ParallelResult]:
        """Run multiple nodes in parallel (with timeout)"""

        async def execute_with_tracking(node: WorkflowNode) -> ParallelResult:
            start = time.time()
            try:
                result = await asyncio.wait_for(
                    asyncio.to_thread(node.handler, state.copy()),
                    timeout=node.timeout
                )
                return ParallelResult(
                    node_name=node.name,
                    result=result,
                    duration=time.time() - start,
                    success=True
                )
            except asyncio.TimeoutError:
                return ParallelResult(
                    node_name=node.name,
                    result=None,
                    duration=time.time() - start,
                    success=False,
                    error=f"Timeout ({node.timeout}s)"
                )
            except Exception as e:
                return ParallelResult(
                    node_name=node.name,
                    result=None,
                    duration=time.time() - start,
                    success=False,
                    error=str(e)
                )

        tasks = [execute_with_tracking(node) for node in nodes]
        results = await asyncio.gather(*tasks)

        # Merge results into state
        for pr in results:
            if pr.success:
                state[f"{pr.node_name}_result"] = pr.result
            else:
                state[f"{pr.node_name}_error"] = pr.error

        return list(results)

# Usage example: parallel collection from multiple sources
async def parallel_research(state: dict) -> dict:
    """Collect data in parallel from multiple sources"""
    query = state["query"]

    async def search_academic(q: str) -> list[dict]:
        # Semantic Scholar API etc.
        await asyncio.sleep(1)  # Simulation
        return [{"title": "Paper A", "source": "academic"}]

    async def search_news(q: str) -> list[dict]:
        await asyncio.sleep(0.5)
        return [{"title": "News B", "source": "news"}]

    async def search_github(q: str) -> list[dict]:
        await asyncio.sleep(0.8)
        return [{"title": "Repo C", "source": "github"}]

    papers, news, repos = await asyncio.gather(
        search_academic(query),
        search_news(query),
        search_github(query)
    )

    return {
        "papers": papers,
        "news": news,
        "repos": repos,
        "total_sources": len(papers) + len(news) + len(repos)
    }
```

### 4.2 Fan-Out / Fan-In Pattern

```python
# Fan-Out / Fan-In: split input, process in parallel, aggregate results
class FanOutFanInWorkflow:
    """Workflow that splits large datasets for parallel processing"""

    def __init__(self, client: anthropic.Anthropic, max_concurrent: int = 5):
        self.client = client
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def fan_out(self, items: list, chunk_size: int = 10) -> list[list]:
        """Split input into chunks"""
        return [items[i:i+chunk_size] for i in range(0, len(items), chunk_size)]

    async def process_chunk(self, chunk: list, prompt_template: str) -> list[dict]:
        """Process one chunk with LLM"""
        async with self.semaphore:
            items_text = "\n".join(str(item) for item in chunk)
            response = self.client.messages.create(
                model="claude-haiku-3-20240307",
                max_tokens=1000,
                messages=[{
                    "role": "user",
                    "content": prompt_template.format(items=items_text)
                }]
            )
            return {"chunk_result": response.content[0].text}

    async def fan_in(self, results: list[dict]) -> dict:
        """Aggregate results from parallel processing"""
        all_results = []
        for r in results:
            all_results.append(r["chunk_result"])

        # Combine aggregated results with LLM
        combined = "\n---\n".join(all_results)
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"Integrate the following analysis results into a comprehensive report:\n{combined}"
            }]
        )
        return {"summary": response.content[0].text}

    async def run(self, items: list, prompt_template: str) -> dict:
        """Complete flow: Fan-Out → parallel processing → Fan-In"""
        # Fan-Out
        chunks = await self.fan_out(items)
        print(f"  Split into {len(chunks)} chunks")

        # Parallel processing
        tasks = [self.process_chunk(chunk, prompt_template) for chunk in chunks]
        results = await asyncio.gather(*tasks)
        print(f"  {len(results)} chunks processed")

        # Fan-In
        summary = await self.fan_in(list(results))
        return summary

# Usage example: parallel analysis of 1000 reviews
async def analyze_reviews():
    workflow = FanOutFanInWorkflow(client, max_concurrent=10)

    reviews = load_reviews()  # 1000 reviews
    result = await workflow.run(
        items=reviews,
        prompt_template="Perform sentiment analysis (positive/negative/neutral) on the following reviews:\n{items}"
    )
    print(result["summary"])
```

### 4.3 Map-Reduce Workflow

```python
# Map-Reduce implementation with LangGraph
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from operator import add

class MapReduceState(TypedDict):
    documents: list[str]
    summaries: Annotated[list[str], add]  # merge results with add
    final_summary: str

def map_summarize(state: MapReduceState) -> MapReduceState:
    """Summarize each document individually (Map phase)"""
    summaries = []
    for doc in state["documents"]:
        response = llm.invoke(f"Summarize the following in 100 words:\n{doc}")
        summaries.append(response.content)
    return {"summaries": summaries}

def reduce_combine(state: MapReduceState) -> MapReduceState:
    """Consolidate summaries (Reduce phase)"""
    all_summaries = "\n".join(
        f"{i+1}. {s}" for i, s in enumerate(state["summaries"])
    )
    response = llm.invoke(
        f"Integrate the following summaries into a comprehensive overview:\n{all_summaries}"
    )
    return {"final_summary": response.content}

# Build graph
map_reduce = StateGraph(MapReduceState)
map_reduce.add_node("map", map_summarize)
map_reduce.add_node("reduce", reduce_combine)
map_reduce.set_entry_point("map")
map_reduce.add_edge("map", "reduce")
map_reduce.add_edge("reduce", END)

app = map_reduce.compile()
```

---

## 5. Workflow Pattern Comparison

### 5.1 Comparison by Flow Shape

| Pattern | Shape | Characteristics | Use Cases | Implementation Difficulty |
|---------|-------|-----------------|-----------|--------------------------|
| Sequential | A→B→C | Simplest | Pipeline processing | Low |
| Conditional branch | A→B or C | Path based on input | Routing | Low |
| Parallel | A→[B,C]→D | Simultaneous execution of independent tasks | Data collection | Medium |
| Loop | A→B→A (conditional) | Repeat until quality criteria met | Review/improvement | Medium |
| Fan-Out/In | A→[B1..Bn]→C | Distributed processing of large datasets | Batch analysis | High |
| Subworkflow | A→[Sub]→B | Reusable child flows | Componentizing common processing | Medium |
| Dynamic generation | LLM designs flow | Flexible but unpredictable | General-purpose tasks | High |

### 5.2 Workflow vs. Autonomous Agent

| Perspective | Workflow | Autonomous Agent |
|-------------|----------|-----------------|
| Controllability | High (predictable) | Low (non-deterministic) |
| Flexibility | Medium (within designed paths) | High (arbitrary actions possible) |
| Debugging | Easy (each node individually) | Difficult (free actions) |
| Cost | Predictable | Unpredictable |
| Design cost | High (requires upfront design) | Low (prompt only) |
| Reliability | High | Medium |
| Latency | Optimizable (parallelization) | Hard to optimize |
| Auditability | High (clear execution log) | Low (actions are indeterminate) |
| Use cases | Business process automation | Exploratory tasks |

### 5.3 Pattern Selection Decision Matrix

```
Pattern Selection Guide

                    Task Complexity
                    Low           High
Flow         Fixed │ Sequential   │ Subworkflow      │
Predictab-         │ Pipeline     │ Hierarchical     │
ility       ───────┼──────────────┼──────────────────┤
            Varies │ Conditional  │ Dynamic          │
                   │ Workflow     │ + Hybrid         │

Data volume  Small │ Sequential/Conditional │
             Large │ Fan-Out/In   │ Map-Reduce       │

Real-time
  Required  │ Streaming + Parallel Execution          │
  Not needed│ Batch Processing + Checkpoints          │
```

---

## 6. State Management

### 6.1 Overview of State Management Patterns

```
State Management Patterns

1. Pass-through approach
   [Node A] --state--> [Node B] --state--> [Node C]
   Each node receives state, updates it, and passes it to the next

2. Centralized approach
   [Node A] --update-->                <--read-- [Node B]
                        [State Store]
   [Node C] --update-->                <--read-- [Node D]

3. Event-based approach
   [Node A] --event--> [Event Bus] --notify--> [Node B]
                                   --notify--> [Node C]
```

### 6.2 Type-Safe State Management

```python
# Type-safe state management using Pydantic
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from enum import Enum

class WorkflowPhase(Enum):
    INTAKE = "intake"
    PROCESSING = "processing"
    REVIEW = "review"
    OUTPUT = "output"
    COMPLETED = "completed"
    FAILED = "failed"

class WorkflowState(BaseModel):
    """Workflow state (type-safe)"""
    # Basic information
    workflow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_input: str
    step: int = 0
    phase: WorkflowPhase = WorkflowPhase.INTAKE

    # Processing results
    classification: Optional[str] = None
    intermediate_results: list[str] = Field(default_factory=list)
    final_output: Optional[str] = None

    # Error management
    errors: list[str] = Field(default_factory=list)
    retry_counts: dict[str, int] = Field(default_factory=dict)

    # Metadata
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # Token usage tracking
    total_input_tokens: int = 0
    total_output_tokens: int = 0

    @validator("step")
    def step_must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError("step must be non-negative")
        return v

    def advance(self) -> "WorkflowState":
        """Advance to the next step"""
        return self.model_copy(update={
            "step": self.step + 1,
            "updated_at": datetime.now()
        })

    def add_result(self, result: str) -> "WorkflowState":
        """Add an intermediate result"""
        new_results = self.intermediate_results + [result]
        return self.model_copy(update={
            "intermediate_results": new_results,
            "updated_at": datetime.now()
        })

    def add_error(self, error: str, node_name: str = "") -> "WorkflowState":
        """Record an error"""
        new_errors = self.errors + [f"[{node_name}] {error}"]
        retry = self.retry_counts.copy()
        if node_name:
            retry[node_name] = retry.get(node_name, 0) + 1
        return self.model_copy(update={
            "errors": new_errors,
            "retry_counts": retry,
            "updated_at": datetime.now()
        })

    def track_tokens(self, input_tokens: int, output_tokens: int) -> "WorkflowState":
        """Track token usage"""
        return self.model_copy(update={
            "total_input_tokens": self.total_input_tokens + input_tokens,
            "total_output_tokens": self.total_output_tokens + output_tokens,
        })

    def transition_to(self, phase: WorkflowPhase) -> "WorkflowState":
        """Transition to a new phase"""
        return self.model_copy(update={
            "phase": phase,
            "updated_at": datetime.now()
        })

    @property
    def estimated_cost(self) -> float:
        """Estimated cost (USD) - based on Claude Sonnet"""
        input_cost = self.total_input_tokens * 3.0 / 1_000_000
        output_cost = self.total_output_tokens * 15.0 / 1_000_000
        return input_cost + output_cost
```

### 6.3 Persistable State Store

```python
# State store with Redis/SQLite backend
import json
import sqlite3
from abc import ABC, abstractmethod

class StateStore(ABC):
    """Abstract base class for state stores"""

    @abstractmethod
    def save(self, workflow_id: str, state: WorkflowState) -> None:
        pass

    @abstractmethod
    def load(self, workflow_id: str) -> Optional[WorkflowState]:
        pass

    @abstractmethod
    def list_workflows(self, status: Optional[str] = None) -> list[str]:
        pass

class SQLiteStateStore(StateStore):
    """SQLite-based state store"""

    def __init__(self, db_path: str = "workflow_states.db"):
        self.conn = sqlite3.connect(db_path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS workflow_states (
                workflow_id TEXT PRIMARY KEY,
                state_json TEXT NOT NULL,
                phase TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        self.conn.commit()

    def save(self, workflow_id: str, state: WorkflowState) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO workflow_states
               (workflow_id, state_json, phase, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)""",
            (
                workflow_id,
                state.model_dump_json(),
                state.phase.value,
                state.created_at.isoformat(),
                state.updated_at.isoformat()
            )
        )
        self.conn.commit()

    def load(self, workflow_id: str) -> Optional[WorkflowState]:
        row = self.conn.execute(
            "SELECT state_json FROM workflow_states WHERE workflow_id = ?",
            (workflow_id,)
        ).fetchone()
        if row:
            return WorkflowState.model_validate_json(row[0])
        return None

    def list_workflows(self, status: Optional[str] = None) -> list[str]:
        if status:
            rows = self.conn.execute(
                "SELECT workflow_id FROM workflow_states WHERE phase = ?",
                (status,)
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT workflow_id FROM workflow_states"
            ).fetchall()
        return [row[0] for row in rows]

class RedisStateStore(StateStore):
    """Redis-based state store (high-speed access)"""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        import redis
        self.redis = redis.from_url(redis_url)
        self.prefix = "workflow:"

    def save(self, workflow_id: str, state: WorkflowState) -> None:
        key = f"{self.prefix}{workflow_id}"
        self.redis.set(key, state.model_dump_json())
        self.redis.sadd(f"{self.prefix}index:{state.phase.value}", workflow_id)
        # TTL: 30 days
        self.redis.expire(key, 30 * 24 * 3600)

    def load(self, workflow_id: str) -> Optional[WorkflowState]:
        data = self.redis.get(f"{self.prefix}{workflow_id}")
        if data:
            return WorkflowState.model_validate_json(data)
        return None

    def list_workflows(self, status: Optional[str] = None) -> list[str]:
        if status:
            return [
                m.decode()
                for m in self.redis.smembers(f"{self.prefix}index:{status}")
            ]
        # Retrieve all
        keys = self.redis.keys(f"{self.prefix}*")
        return [
            k.decode().replace(self.prefix, "")
            for k in keys
            if b"index:" not in k
        ]
```

---

## 7. Error Handling and Retries

### 7.1 Node-Level Error Handling

```python
# Workflow with robust error handling
from dataclasses import dataclass
from typing import Optional
import traceback

@dataclass
class NodeError:
    node_name: str
    error_type: str
    message: str
    traceback: str
    retry_attempt: int
    timestamp: float

class ResilientWorkflowEngine(WorkflowEngine):
    """Fault-tolerant workflow engine"""

    def __init__(self, name: str, state_store: Optional[StateStore] = None):
        super().__init__(name)
        self.state_store = state_store
        self.error_handlers: dict[str, Callable] = {}
        self.fallback_handlers: dict[str, Callable] = {}
        self.errors: list[NodeError] = []

    def set_error_handler(self, node_name: str, handler: Callable):
        """Set a node-specific error handler"""
        self.error_handlers[node_name] = handler

    def set_fallback(self, node_name: str, fallback: Callable):
        """Set fallback processing"""
        self.fallback_handlers[node_name] = fallback

    def _execute_node_resilient(self, node: WorkflowNode) -> Any:
        """Fault-tolerant node execution"""
        for attempt in range(node.retry_count + 1):
            try:
                return node.handler(self.state)
            except Exception as e:
                error = NodeError(
                    node_name=node.name,
                    error_type=type(e).__name__,
                    message=str(e),
                    traceback=traceback.format_exc(),
                    retry_attempt=attempt,
                    timestamp=time.time()
                )
                self.errors.append(error)

                # Node-specific error handler
                if node.name in self.error_handlers:
                    should_retry = self.error_handlersnode.name
                    if not should_retry:
                        break

                if attempt < node.retry_count:
                    wait = min(2 ** attempt * 1.0, 30.0)  # max 30 seconds
                    logger.warning(
                        f"Retry {attempt+1}/{node.retry_count}: "
                        f"{node.name} (waiting {wait:.1f}s)"
                    )
                    time.sleep(wait)

        # All retries failed → fallback
        if node.name in self.fallback_handlers:
            logger.info(f"Running fallback: {node.name}")
            return self.fallback_handlersnode.name

        raise RuntimeError(
            f"Node '{node.name}' failed after {node.retry_count + 1} attempts"
        )

    def run(self, start_node: str, initial_state: dict) -> dict:
        """Execute with checkpointing"""
        self.state = initial_state
        workflow_id = self.state.get("workflow_id", str(time.time()))
        current = start_node

        while current:
            node = self.nodes[current]

            # Save checkpoint
            if self.state_store:
                ws = WorkflowState(
                    workflow_id=workflow_id,
                    user_input=str(initial_state),
                    step=len(self.execution_log),
                    phase=WorkflowPhase.PROCESSING
                )
                self.state_store.save(workflow_id, ws)

            try:
                if node.type == NodeType.CONDITION:
                    branch = node.condition(self.state)
                    current = branch
                else:
                    result = self._execute_node_resilient(node)
                    self.state[f"{node.name}_result"] = result
                    current = node.next_nodes[0] if node.next_nodes else None
            except Exception as e:
                self.state["workflow_error"] = str(e)
                self.state["failed_node"] = node.name
                logger.error(f"Workflow stopped: {node.name} - {e}")
                break

        return self.state

# Usage example
engine = ResilientWorkflowEngine("resilient_support", SQLiteStateStore())

# Set error handler
def handle_llm_error(error: NodeError, state: dict) -> bool:
    """Handle LLM errors"""
    if "rate_limit" in error.message.lower():
        time.sleep(60)  # Wait 60 seconds on rate limit
        return True  # Retry
    if "overloaded" in error.message.lower():
        return True  # Retry
    return False  # Do not retry

engine.set_error_handler("handle_technical", handle_llm_error)

# Set fallback
engine.set_fallback(
    "handle_technical",
    lambda state: "We apologize. Your inquiry is being transferred to the technical team."
)
```

### 7.2 Circuit Breaker Pattern

```python
# Circuit breaker for workflow nodes
from enum import Enum
import threading

class CircuitState(Enum):
    CLOSED = "closed"      # Normal
    OPEN = "open"          # Tripped
    HALF_OPEN = "half_open"  # Probing

class CircuitBreaker:
    """Circuit breaker for workflow nodes"""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        self.lock = threading.Lock()

    def can_execute(self) -> bool:
        with self.lock:
            if self.state == CircuitState.CLOSED:
                return True
            elif self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    return True
                return False
            else:  # HALF_OPEN
                return True

    def record_success(self):
        with self.lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.success_threshold:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
            self.failure_count = 0

    def record_failure(self):
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker OPEN: "
                    f"{self.failure_count} consecutive failures"
                )

def with_circuit_breaker(breaker: CircuitBreaker):
    """Circuit breaker decorator"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            if not breaker.can_execute():
                raise RuntimeError("Circuit breaker is open")
            try:
                result = func(*args, **kwargs)
                breaker.record_success()
                return result
            except Exception as e:
                breaker.record_failure()
                raise
        return wrapper
    return decorator

# Usage example
llm_breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=120)

@with_circuit_breaker(llm_breaker)
def call_llm_with_breaker(state: dict) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{"role": "user", "content": state["prompt"]}]
    )
    return response.content[0].text
```

---

## 8. Subworkflows

### 8.1 Subworkflow Design

```python
# Reusable subworkflows
class SubWorkflow:
    """Subworkflow that can be independently tested and reused"""

    def __init__(self, name: str):
        self.name = name
        self.engine = WorkflowEngine(name=name)
        self.input_schema: dict = {}
        self.output_schema: dict = {}

    def define_interface(self, input_keys: list[str], output_keys: list[str]):
        """Define the input/output interface"""
        self.input_schema = {k: True for k in input_keys}
        self.output_schema = {k: True for k in output_keys}

    def validate_input(self, state: dict) -> bool:
        """Validate input"""
        missing = [k for k in self.input_schema if k not in state]
        if missing:
            raise ValueError(f"Missing required inputs: {missing}")
        return True

    def execute(self, input_state: dict, start_node: str) -> dict:
        """Execute the subworkflow"""
        self.validate_input(input_state)
        result = self.engine.run(start_node, input_state)

        # Return only the output
        output = {k: result.get(k) for k in self.output_schema}
        return output

# Subworkflow: text quality check
def build_quality_check_subworkflow() -> SubWorkflow:
    """Subworkflow for text quality checking"""
    sub = SubWorkflow("quality_check")
    sub.define_interface(
        input_keys=["text", "criteria"],
        output_keys=["quality_score", "issues", "improved_text"]
    )

    # Grammar check node
    sub.engine.add_node(WorkflowNode(
        name="grammar_check",
        type=NodeType.LLM,
        handler=lambda s: check_grammar(s["text"]),
        next_nodes=["style_check"]
    ))

    # Style check node
    sub.engine.add_node(WorkflowNode(
        name="style_check",
        type=NodeType.LLM,
        handler=lambda s: check_style(s["text"], s["criteria"]),
        next_nodes=["score"]
    ))

    # Scoring node
    sub.engine.add_node(WorkflowNode(
        name="score",
        type=NodeType.LLM,
        handler=lambda s: calculate_score(s),
        next_nodes=[]
    ))

    return sub

# Call subworkflow from main workflow
quality_checker = build_quality_check_subworkflow()

def content_pipeline():
    engine = WorkflowEngine("content_pipeline")

    # Article generation node
    engine.add_node(WorkflowNode(
        name="generate",
        type=NodeType.LLM,
        handler=generate_article,
        next_nodes=["quality_check"]
    ))

    # Subworkflow invocation node
    engine.add_node(WorkflowNode(
        name="quality_check",
        type=NodeType.SUBWORKFLOW,
        handler=lambda state: quality_checker.execute(
            {"text": state["generate_result"], "criteria": "blog"},
            start_node="grammar_check"
        ),
        next_nodes=["publish"]
    ))

    # Publish node
    engine.add_node(WorkflowNode(
        name="publish",
        type=NodeType.TOOL,
        handler=publish_article,
        next_nodes=[]
    ))

    return engine
```

---

## 9. Practical Workflow Examples

### 9.1 Code Review Workflow

```python
# Automated code review workflow
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal

class CodeReviewState(TypedDict):
    code: str
    language: str
    diff: str
    static_analysis: dict
    security_issues: list[dict]
    performance_issues: list[dict]
    style_issues: list[dict]
    review_summary: str
    approval_status: str  # "approved", "changes_requested", "blocked"

def detect_language(state: CodeReviewState) -> CodeReviewState:
    """Detect the programming language"""
    response = client.messages.create(
        model="claude-haiku-3-20240307",
        max_tokens=20,
        messages=[{
            "role": "user",
            "content": f"Name the language of this code in one word: {state['code'][:500]}"
        }]
    )
    return {"language": response.content[0].text.strip().lower()}

def run_static_analysis(state: CodeReviewState) -> CodeReviewState:
    """Run static analysis"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Perform static analysis on the following {state['language']} code.
Return the result in JSON format:
{{"complexity": "low/medium/high", "issues": [...], "metrics": {{}}}}

Code:
{state['code']}"""
        }]
    )
    return {"static_analysis": json.loads(response.content[0].text)}

def check_security(state: CodeReviewState) -> CodeReviewState:
    """Security check"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system="Analyze vulnerabilities as a security-expert code reviewer.",
        messages=[{
            "role": "user",
            "content": f"""Detect security vulnerabilities in the following code:
- SQL injection
- XSS
- Authentication/authorization flaws
- Hardcoded sensitive information

Return as a JSON array.
Code:
{state['code']}"""
        }]
    )
    return {"security_issues": json.loads(response.content[0].text)}

def check_performance(state: CodeReviewState) -> CodeReviewState:
    """Performance check"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": f"""Code review from a performance perspective:
- N+1 queries
- Memory leaks
- Unnecessary loops
- Missing caching

As a JSON array: {state['code']}"""
        }]
    )
    return {"performance_issues": json.loads(response.content[0].text)}

def generate_review_summary(state: CodeReviewState) -> CodeReviewState:
    """Generate a review summary"""
    total_issues = (
        len(state.get("security_issues", []))
        + len(state.get("performance_issues", []))
        + len(state.get("style_issues", []))
    )

    has_critical = any(
        issue.get("severity") == "critical"
        for issue in state.get("security_issues", [])
    )

    if has_critical:
        status = "blocked"
    elif total_issues > 5:
        status = "changes_requested"
    else:
        status = "approved"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": f"""Summarize the following review results:
Security: {json.dumps(state.get('security_issues', []), ensure_ascii=False)}
Performance: {json.dumps(state.get('performance_issues', []), ensure_ascii=False)}
Status: {status}

Create a review summary in Markdown format:"""
        }]
    )

    return {
        "review_summary": response.content[0].text,
        "approval_status": status
    }

# Build graph
review_flow = StateGraph(CodeReviewState)

review_flow.add_node("detect_lang", detect_language)
review_flow.add_node("static_analysis", run_static_analysis)
review_flow.add_node("security_check", check_security)
review_flow.add_node("performance_check", check_performance)
review_flow.add_node("summarize", generate_review_summary)

review_flow.set_entry_point("detect_lang")
review_flow.add_edge("detect_lang", "static_analysis")
# After static analysis, run security and performance checks in parallel
review_flow.add_edge("static_analysis", "security_check")
review_flow.add_edge("static_analysis", "performance_check")
review_flow.add_edge("security_check", "summarize")
review_flow.add_edge("performance_check", "summarize")
review_flow.add_edge("summarize", END)

code_reviewer = review_flow.compile()
```

### 9.2 Content Generation Pipeline

```python
# Blog post auto-generation workflow
class ContentState(TypedDict):
    topic: str
    target_audience: str
    outline: str
    draft: str
    seo_keywords: list[str]
    review_feedback: str
    review_pass: bool
    final_article: str
    metadata: dict

def research_topic(state: ContentState) -> ContentState:
    """Research the topic"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Research the following topic and create an article outline.

Topic: {state['topic']}
Target audience: {state['target_audience']}

Outline format:
1. Introduction
2. Body (3-5 sections)
3. Conclusion
Use bullet points for the key points to include in each section."""
        }]
    )
    return {"outline": response.content[0].text}

def extract_seo_keywords(state: ContentState) -> ContentState:
    """Extract SEO keywords"""
    response = client.messages.create(
        model="claude-haiku-3-20240307",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": f"Give me 10 SEO keywords for the topic \"{state['topic']}\" as a JSON array:"
        }]
    )
    return {"seo_keywords": json.loads(response.content[0].text)}

def write_draft(state: ContentState) -> ContentState:
    """Write the article draft"""
    feedback_context = ""
    if state.get("review_feedback"):
        feedback_context = f"\n\nPrevious feedback:\n{state['review_feedback']}"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""Write an article following the outline below.

Outline:
{state['outline']}

SEO keywords (incorporate naturally):
{', '.join(state.get('seo_keywords', []))}
{feedback_context}

Write an article of approximately 2000-3000 words in Markdown format."""
        }]
    )
    return {"draft": response.content[0].text}

def review_article(state: ContentState) -> ContentState:
    """Review the article"""
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": f"""Review the following article as an editor.

Article:
{state['draft']}

Evaluation criteria:
1. Accuracy
2. Readability
3. SEO optimization
4. Appropriateness for the target audience

Write PASS or FAIL on the first line.
If FAIL, list specific improvements."""
        }]
    )
    result = response.content[0].text
    is_pass = result.strip().startswith("PASS")
    return {
        "review_feedback": result,
        "review_pass": is_pass
    }

def finalize_article(state: ContentState) -> ContentState:
    """Finalize the article"""
    return {
        "final_article": state["draft"],
        "metadata": {
            "topic": state["topic"],
            "keywords": state.get("seo_keywords", []),
            "word_count": len(state["draft"]),
        }
    }

def route_review(state: ContentState) -> Literal["revise", "finalize"]:
    return "finalize" if state.get("review_pass", False) else "revise"

# Build graph
content_flow = StateGraph(ContentState)
content_flow.add_node("research", research_topic)
content_flow.add_node("seo", extract_seo_keywords)
content_flow.add_node("write", write_draft)
content_flow.add_node("review", review_article)
content_flow.add_node("finalize", finalize_article)

content_flow.set_entry_point("research")
content_flow.add_edge("research", "seo")
content_flow.add_edge("seo", "write")
content_flow.add_edge("write", "review")
content_flow.add_conditional_edges("review", route_review, {
    "revise": "write",
    "finalize": "finalize"
})
content_flow.add_edge("finalize", END)

content_pipeline = content_flow.compile()
```

---

## 10. Monitoring and Observability

### 10.1 Workflow Metrics

```python
# Metrics collection for workflow execution
from dataclasses import dataclass, field
from collections import defaultdict
import statistics

@dataclass
class WorkflowMetrics:
    """Collection and analysis of workflow execution metrics"""

    executions: list[dict] = field(default_factory=list)
    node_durations: dict[str, list[float]] = field(
        default_factory=lambda: defaultdict(list)
    )
    node_failures: dict[str, int] = field(
        default_factory=lambda: defaultdict(int)
    )
    total_tokens: dict[str, int] = field(
        default_factory=lambda: defaultdict(int)
    )

    def record_execution(self, execution_log: list[NodeExecution]):
        """Record metrics from an execution log"""
        execution_data = {
            "timestamp": time.time(),
            "nodes": [],
            "total_duration": 0,
            "success": True
        }

        for ex in execution_log:
            self.node_durations[ex.node_name].append(ex.duration)
            if ex.status == NodeStatus.FAILED:
                self.node_failures[ex.node_name] += 1
                execution_data["success"] = False

            execution_data["nodes"].append({
                "name": ex.node_name,
                "duration": ex.duration,
                "status": ex.status.value
            })
            execution_data["total_duration"] += ex.duration

        self.executions.append(execution_data)

    def get_bottleneck_nodes(self, top_n: int = 3) -> list[dict]:
        """Identify bottleneck nodes"""
        bottlenecks = []
        for node_name, durations in self.node_durations.items():
            if len(durations) >= 3:
                bottlenecks.append({
                    "node": node_name,
                    "avg_duration": statistics.mean(durations),
                    "p95_duration": sorted(durations)[int(len(durations) * 0.95)],
                    "max_duration": max(durations),
                    "failure_rate": (
                        self.node_failures[node_name] / len(durations)
                    )
                })

        return sorted(
            bottlenecks,
            key=lambda x: x["avg_duration"],
            reverse=True
        )[:top_n]

    def generate_report(self) -> str:
        """Generate a metrics report"""
        total = len(self.executions)
        success = sum(1 for e in self.executions if e["success"])

        report = [
            f"=== Workflow Metrics Report ===",
            f"Total executions: {total}",
            f"Success rate: {success/total*100:.1f}%",
            f"",
            f"--- Per-Node Performance ---"
        ]

        for b in self.get_bottleneck_nodes(10):
            report.append(
                f"  {b['node']}: "
                f"avg {b['avg_duration']:.2f}s, "
                f"P95 {b['p95_duration']:.2f}s, "
                f"failure rate {b['failure_rate']*100:.1f}%"
            )

        return "\n".join(report)
```

### 10.2 Visualization Dashboard

```python
# Streamlit-based workflow monitoring dashboard
import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta

def workflow_dashboard(metrics: WorkflowMetrics):
    """Workflow monitoring dashboard"""
    st.title("Workflow Monitoring")

    # KPI cards
    col1, col2, col3, col4 = st.columns(4)
    total = len(metrics.executions)
    success = sum(1 for e in metrics.executions if e["success"])

    col1.metric("Total Executions", total)
    col2.metric("Success Rate", f"{success/max(total,1)*100:.1f}%")
    col3.metric(
        "Avg Execution Time",
        f"{statistics.mean([e['total_duration'] for e in metrics.executions]):.1f}s"
    )
    col4.metric(
        "Active Executions",
        sum(1 for e in metrics.executions
            if time.time() - e["timestamp"] < 60)
    )

    # Per-node execution time heatmap
    st.subheader("Per-Node Performance")
    bottlenecks = metrics.get_bottleneck_nodes(10)
    if bottlenecks:
        fig = px.bar(
            bottlenecks,
            x="node",
            y="avg_duration",
            color="failure_rate",
            color_continuous_scale="RdYlGn_r",
            title="Average Execution Time and Failure Rate per Node"
        )
        st.plotly_chart(fig)

    # Execution time trend
    st.subheader("Execution Time Trend")
    if metrics.executions:
        times = [e["timestamp"] for e in metrics.executions]
        durations = [e["total_duration"] for e in metrics.executions]
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=[datetime.fromtimestamp(t) for t in times],
            y=durations,
            mode="lines+markers",
            name="Execution Time"
        ))
        st.plotly_chart(fig)

# Run as Streamlit app: streamlit run dashboard.py
```

---

## 11. Cost Optimization

### 11.1 Per-Node Model Selection

```python
# Model selection strategy for maximum cost efficiency
class ModelSelector:
    """Select a model based on node characteristics"""

    MODELS = {
        "fast": {
            "name": "claude-haiku-3-20240307",
            "input_cost": 0.25,   # per 1M tokens
            "output_cost": 1.25,
            "speed": "fast",
            "quality": "good"
        },
        "balanced": {
            "name": "claude-sonnet-4-20250514",
            "input_cost": 3.0,
            "output_cost": 15.0,
            "speed": "medium",
            "quality": "excellent"
        },
        "best": {
            "name": "claude-opus-4-20250514",
            "input_cost": 15.0,
            "output_cost": 75.0,
            "speed": "slow",
            "quality": "best"
        }
    }

    @staticmethod
    def select_for_node(node_type: str, complexity: str = "medium") -> dict:
        """Select a model based on node type and complexity"""
        selection_matrix = {
            # (node_type, complexity) → model_tier
            ("classify", "low"): "fast",
            ("classify", "medium"): "fast",
            ("classify", "high"): "balanced",
            ("generate", "low"): "fast",
            ("generate", "medium"): "balanced",
            ("generate", "high"): "best",
            ("review", "low"): "fast",
            ("review", "medium"): "balanced",
            ("review", "high"): "best",
            ("summarize", "low"): "fast",
            ("summarize", "medium"): "fast",
            ("summarize", "high"): "balanced",
        }

        tier = selection_matrix.get(
            (node_type, complexity), "balanced"
        )
        return ModelSelector.MODELS[tier]

# Workflow with cost tracking
class CostTracker:
    """Track total cost across the workflow"""

    def __init__(self, budget_limit: float = 1.0):
        self.budget_limit = budget_limit  # USD
        self.node_costs: dict[str, float] = {}
        self.total_cost = 0.0

    def track(self, node_name: str, input_tokens: int,
              output_tokens: int, model: str) -> float:
        """Record cost"""
        model_info = next(
            (m for m in ModelSelector.MODELS.values() if m["name"] == model),
            ModelSelector.MODELS["balanced"]
        )

        cost = (
            input_tokens * model_info["input_cost"] / 1_000_000
            + output_tokens * model_info["output_cost"] / 1_000_000
        )

        self.node_costs[node_name] = self.node_costs.get(node_name, 0) + cost
        self.total_cost += cost

        if self.total_cost > self.budget_limit * 0.8:
            logger.warning(
                f"Cost warning: ${self.total_cost:.4f} / ${self.budget_limit}"
            )

        return cost

    def get_summary(self) -> str:
        """Cost summary"""
        lines = [f"Total cost: ${self.total_cost:.4f}"]
        for node, cost in sorted(
            self.node_costs.items(), key=lambda x: x[1], reverse=True
        ):
            pct = cost / max(self.total_cost, 0.0001) * 100
            lines.append(f"  {node}: ${cost:.4f} ({pct:.1f}%)")
        return "\n".join(lines)
```

### 11.2 Caching Strategy

```python
# Cache for workflow nodes
import hashlib
from functools import lru_cache

class WorkflowCache:
    """Cache for workflow node results"""

    def __init__(self, backend: str = "memory", ttl: int = 3600):
        self.ttl = ttl
        self.cache: dict[str, dict] = {}

    def _make_key(self, node_name: str, input_data: str) -> str:
        """Generate a cache key"""
        content = f"{node_name}:{input_data}"
        return hashlib.sha256(content.encode()).hexdigest()

    def get(self, node_name: str, input_data: str) -> Optional[Any]:
        """Retrieve from cache"""
        key = self._make_key(node_name, input_data)
        entry = self.cache.get(key)
        if entry and time.time() - entry["timestamp"] < self.ttl:
            logger.info(f"Cache hit: {node_name}")
            return entry["result"]
        return None

    def set(self, node_name: str, input_data: str, result: Any):
        """Save to cache"""
        key = self._make_key(node_name, input_data)
        self.cache[key] = {
            "result": result,
            "timestamp": time.time(),
            "node": node_name
        }

    def get_stats(self) -> dict:
        """Cache statistics"""
        valid = sum(
            1 for e in self.cache.values()
            if time.time() - e["timestamp"] < self.ttl
        )
        return {
            "total_entries": len(self.cache),
            "valid_entries": valid,
            "expired_entries": len(self.cache) - valid
        }

# Node execution with caching
cache = WorkflowCache(ttl=1800)  # 30 minutes

def cached_node_handler(node_name: str, handler: Callable) -> Callable:
    """Generate a cached node handler"""
    def wrapper(state: dict) -> Any:
        # Use a hash of the input as the key
        input_key = json.dumps(
            {k: v for k, v in state.items() if not k.endswith("_result")},
            sort_keys=True, default=str
        )

        cached = cache.get(node_name, input_key)
        if cached is not None:
            return cached

        result = handler(state)
        cache.set(node_name, input_key, result)
        return result

    return wrapper
```

---

## 12. Testing

### 12.1 Node Unit Tests

```python
# Testing workflow nodes
import pytest
from unittest.mock import patch, MagicMock

class TestWorkflowNodes:
    """Node unit tests"""

    def test_classify_billing(self):
        """Test billing classification"""
        with patch("anthropic.Anthropic") as mock_client:
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text="billing")]
            mock_client.return_value.messages.create.return_value = mock_response

            result = classify_inquiry("The invoice amount is incorrect")
            assert result == "billing"

    def test_classify_technical(self):
        """Test technical classification"""
        with patch("anthropic.Anthropic") as mock_client:
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text="technical")]
            mock_client.return_value.messages.create.return_value = mock_response

            result = classify_inquiry("The API is returning an error")
            assert result == "technical"

    def test_routing_condition(self):
        """Test routing condition"""
        state = {"classify_result": "billing"}
        route_fn = lambda s: {
            "billing": "handle_billing",
            "technical": "handle_technical",
            "general": "handle_general"
        }.get(s["classify_result"], "handle_general")

        assert route_fn(state) == "handle_billing"

        state["classify_result"] = "unknown"
        assert route_fn(state) == "handle_general"

class TestWorkflowEngine:
    """Workflow engine tests"""

    def test_linear_workflow(self):
        """Test sequential workflow"""
        engine = WorkflowEngine("test")

        engine.add_node(WorkflowNode(
            name="step1",
            type=NodeType.LLM,
            handler=lambda s: "result1",
            next_nodes=["step2"]
        ))
        engine.add_node(WorkflowNode(
            name="step2",
            type=NodeType.LLM,
            handler=lambda s: f"result2_{s['step1_result']}",
            next_nodes=[]
        ))

        result = engine.run("step1", {})
        assert result["step1_result"] == "result1"
        assert result["step2_result"] == "result2_result1"

    def test_conditional_workflow(self):
        """Test conditional branch workflow"""
        engine = WorkflowEngine("test_conditional")

        engine.add_node(WorkflowNode(
            name="classify",
            type=NodeType.LLM,
            handler=lambda s: "A",
            next_nodes=["route"]
        ))
        engine.add_node(WorkflowNode(
            name="route",
            type=NodeType.CONDITION,
            handler=None,
            condition=lambda s: (
                "handle_a" if s["classify_result"] == "A" else "handle_b"
            )
        ))
        engine.add_node(WorkflowNode(
            name="handle_a",
            type=NodeType.LLM,
            handler=lambda s: "handled_A",
            next_nodes=[]
        ))
        engine.add_node(WorkflowNode(
            name="handle_b",
            type=NodeType.LLM,
            handler=lambda s: "handled_B",
            next_nodes=[]
        ))

        result = engine.run("classify", {})
        assert result["handle_a_result"] == "handled_A"
        assert "handle_b_result" not in result

    def test_retry_on_failure(self):
        """Test retry behavior"""
        call_count = 0

        def flaky_handler(state):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("Temporary error")
            return "success"

        engine = WorkflowEngine("test_retry")
        engine.add_node(WorkflowNode(
            name="flaky",
            type=NodeType.LLM,
            handler=flaky_handler,
            next_nodes=[],
            retry_count=3
        ))

        result = engine.run("flaky", {})
        assert result["flaky_result"] == "success"
        assert call_count == 3

class TestWorkflowState:
    """State management tests"""

    def test_state_advance(self):
        state = WorkflowState(user_input="test")
        new_state = state.advance()
        assert new_state.step == 1
        assert state.step == 0  # Original state is immutable

    def test_state_add_result(self):
        state = WorkflowState(user_input="test")
        new_state = state.add_result("result1")
        assert len(new_state.intermediate_results) == 1
        assert new_state.intermediate_results[0] == "result1"

    def test_state_error_tracking(self):
        state = WorkflowState(user_input="test")
        new_state = state.add_error("connection timeout", "api_call")
        assert len(new_state.errors) == 1
        assert new_state.retry_counts["api_call"] == 1

    def test_cost_estimation(self):
        state = WorkflowState(user_input="test")
        state = state.track_tokens(1000, 500)
        assert state.estimated_cost > 0
```

### 12.2 Integration Tests

```python
# Workflow integration tests
class TestSupportWorkflowIntegration:
    """Integration tests for the support workflow"""

    @pytest.fixture
    def mock_llm(self):
        """Mock LLM"""
        with patch("anthropic.Anthropic") as mock:
            def create_response(text):
                resp = MagicMock()
                resp.content = [MagicMock(text=text)]
                return resp

            mock.return_value.messages.create.side_effect = [
                create_response("billing"),             # classify
                create_response("Billing confirmation"),  # handle_billing
                create_response("Final response")         # respond
            ]
            yield mock

    def test_billing_flow(self, mock_llm):
        """Integration test for billing flow"""
        workflow = build_support_workflow()
        result = workflow.run("classify", {
            "user_message": "Last month's invoice amount is incorrect"
        })

        assert result["classify_result"] == "billing"
        assert "handle_billing_result" in result
        assert "respond_result" in result

    def test_execution_log(self, mock_llm):
        """Verify execution log"""
        workflow = build_support_workflow()
        workflow.run("classify", {
            "user_message": "Test inquiry"
        })

        log = workflow.execution_log
        assert len(log) >= 3  # classify, route, handle_*, respond
        assert all(ex.status == NodeStatus.COMPLETED for ex in log)
        assert all(ex.duration >= 0 for ex in log)
```

---

## 13. Anti-Patterns

### Anti-Pattern 1: Overly Complex DAG

```
# BAD: Monolithic DAG with 20+ nodes
[A]→[B]→[C]→[D]→[E]→[F]→[G]→[H]→[I]→[J]→...
 ↓   ↓   ↓   ↓   ↓   ↓   ↓
[K] [L] [M] [N] [O] [P] [Q]
 Incomprehensible, unmaintainable

# GOOD: Split into subworkflows
[Main Flow]
  [Intake] → [Subflow: Analysis] → [Subflow: Processing] → [Output]

Each subflow has 5 nodes or fewer and can be tested independently
```

### Anti-Pattern 2: Implicit State Dependencies

```python
# BAD: Sharing state via global variables
global_state = {}  # No way to track which node wrote what

def node_a(state):
    global_state["temp"] = "value"  # Side effect!

# GOOD: Explicit state passing
def node_a(state: WorkflowState) -> WorkflowState:
    return state.model_copy(update={"classification": "technical"})
```

### Anti-Pattern 3: Unbounded Loops

```python
# BAD: No loop iteration limit
def route_review(state):
    if state["review_result"] == "FAIL":
        return "revise"  # May loop forever
    return "finalize"

# GOOD: Limit maximum iterations
def route_review(state):
    if state.get("review_count", 0) >= 3:
        return "finalize"  # Force exit after 3 iterations
    if state["review_result"] == "FAIL":
        return "revise"
    return "finalize"
```

### Anti-Pattern 4: Missing Error Handling

```python
# BAD: Swallowing errors silently
def node_handler(state):
    try:
        return call_llm(state)
    except:
        return ""  # Return empty string and continue

# GOOD: Proper error handling
def node_handler(state):
    try:
        return call_llm(state)
    except anthropic.RateLimitError:
        time.sleep(60)
        return call_llm(state)  # Retry
    except anthropic.APIError as e:
        logger.error(f"API error: {e}")
        raise  # Propagate to workflow engine
```

### Anti-Pattern 5: Using the Same Model for All Nodes

```python
# BAD: Using the highest-performance model for all nodes (cost explosion)
def classify(state):
    return client.messages.create(
        model="claude-opus-4-20250514",  # A powerful model is unnecessary for classification
        max_tokens=10,
        messages=[...]
    )

# GOOD: Choose models suited to each node's characteristics
def classify(state):
    return client.messages.create(
        model="claude-haiku-3-20240307",  # Fast and cheap is sufficient for classification
        max_tokens=10,
        messages=[...]
    )

def generate_detailed_report(state):
    return client.messages.create(
        model="claude-sonnet-4-20250514",  # High-quality model for generation
        max_tokens=4000,
        messages=[...]
    )
```

---

## 14. FAQ

### Q1: Can a workflow include cycles (loops)?

Yes. However, since a "DAG" by definition contains no cycles, a graph with cycles is called a "state graph." LangGraph explicitly supports cycles. The important thing is to always set a **maximum iteration limit**.

### Q2: Can different LLMs be used for each workflow node?

This is recommended. For example:
- **Classification nodes**: Fast, inexpensive model (Claude Haiku)
- **Generation nodes**: High-quality model (Claude Sonnet)
- **Review nodes**: Top-quality model (Claude Opus)

The ability to optimize cost and quality at each node is one of the advantages of workflows.

### Q3: How should a failed node be re-executed?

The **checkpoint approach** is recommended. Persist the state when each node completes, and resume from that point on failure. LangGraph has checkpointing built in.

### Q4: What should be done when workflow execution takes too long?

1. **Parallelize**: Run independent nodes in parallel
2. **Model optimization**: Use Haiku for lightweight tasks
3. **Caching**: Cache results for identical inputs
4. **Timeouts**: Set a timeout for each node
5. **Async execution**: Run time-consuming nodes in the background

### Q5: How should workflow versioning be managed?

Manage workflow definitions as code and assign version numbers. Running workflows are guaranteed to operate on the version they were created with. Migrate to new versions gradually in a rollback-safe manner.

### Q6: What is the relationship between workflow agents and microservices?

Each node in a workflow can be implemented as an independent microservice. However, best practice is to design nodes that include LLM calls as stateless, managing state in an external store (Redis/PostgreSQL). On Kubernetes, combining with Argo Workflows is also effective.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Description |
|------|-------------|
| Workflow | An agent that follows a predefined flow |
| DAG | A directed acyclic graph of nodes and edges |
| Conditional branching | LLM-driven path selection |
| Parallel execution | Simultaneous processing of independent nodes (Fan-Out/In, Map-Reduce) |
| State management | Passing type-safe state objects between nodes |
| Error handling | Retry, circuit breaker, and fallback |
| Checkpoints | Guaranteed resumability from mid-flow failures |
| Cost optimization | Per-node model selection and caching |
| Monitoring | Execution metrics collection and bottleneck analysis |
| Principle | Balance controllability with flexibility |

## What to Read Next

- [03-autonomous-agents.md](./03-autonomous-agents.md) — Designing autonomous agents
- [../02-implementation/01-langgraph.md](../02-implementation/01-langgraph.md) — Detailed LangGraph implementation
- [../03-applications/02-customer-support.md](../03-applications/02-customer-support.md) — Real-world support workflow examples

## References

1. LangGraph Documentation — https://langchain-ai.github.io/langgraph/
2. Anthropic, "Building effective agents - Workflows" (2024) — https://docs.anthropic.com/en/docs/build-with-claude/agentic
3. AWS, "Step Functions" — https://docs.aws.amazon.com/step-functions/
4. Temporal.io — Workflow orchestration — https://temporal.io/
5. Prefect — Data workflow management — https://www.prefect.io/
