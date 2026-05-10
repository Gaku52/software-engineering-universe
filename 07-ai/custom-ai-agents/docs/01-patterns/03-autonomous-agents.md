# Autonomous Agents

> Plan, execute, reflect — design patterns for agents that autonomously carry out long-running tasks. Covers goal decomposition, self-evaluation, and adaptive replanning.

## What You Will Learn

1. Designing the plan-execute-reflect cycle for autonomous agents
2. Implementation patterns for goal decomposition and sub-goal management
3. Levels of autonomy and how to integrate human-in-the-loop checkpoints
4. Designing a memory system (working, episodic, and semantic memory)
5. Implementing safety guardrails and wandering detection
6. Monitoring, cost management, and testing techniques for production use


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Workflow Agents](./02-workflow-agents.md)

---

## 1. What Is an Autonomous Agent?

```
Characteristics of Autonomous Agents

Ordinary agent:
  User: "Look up X"
  → search → answer (completes in a few steps)

Autonomous agent:
  User: "Create a competitive analysis report"
  → create plan
  → gather information (multiple sources)
  → analyze data
  → draft report
  → self-review
  → revise
  → final report
  (tens to hundreds of steps, minutes to hours)
```

### 1.1 Levels of Autonomy

```
Five Levels of Autonomy

Level 0: Manual        User directs every step
Level 1: Assisted      LLM executes one step
Level 2: Semi-autonomous  Executes multiple steps, confirms at key points
Level 3: Conditional   Nearly autonomous, human approves critical decisions only
Level 4: Fully autonomous  Runs to completion from goal alone
                        (e.g., Devin, Claude Code)
```

### 1.2 Should You Use an Autonomous Agent?

```
Decision Flowchart

Q1: Is the task clearly defined with a fixed procedure?
├─ YES → Workflow agent (02-workflow-agents.md)
└─ NO  → Go to Q2

Q2: Does the task require more than 10 steps to complete?
├─ YES → Go to Q3
└─ NO  → Single agent (00-single-agent.md)

Q3: Does execution require adaptive decision-making based on context?
├─ YES → Autonomous agent (this chapter)
└─ NO  → Workflow agent

Q4: Is self-correction required on failure?
├─ YES → Autonomous agent + Reflexion pattern
└─ NO  → Multi-agent delegation pattern

Q5: What is the acceptable operation scope from a security standpoint?
├─ Restricted → Level 2-3 (human-in-the-loop required)
└─ Unrestricted → Level 4 (full guardrails required)
```

### 1.3 Typical Use Cases

| Use Case | Autonomy Level | Steps | Duration |
|----------|---------------|-------|----------|
| Code generation + testing | L3 | 20-50 | 5-15 min |
| Competitive analysis report | L3 | 30-100 | 10-30 min |
| Bug investigation + fix | L3-L4 | 10-40 | 3-20 min |
| Initial project scaffolding | L3 | 50-200 | 15-60 min |
| Data analysis + visualization | L2-L3 | 15-40 | 5-20 min |
| Document translation + localization | L2 | 10-30 | 3-10 min |
| Infrastructure setup + deployment | L3 (with approval) | 30-80 | 10-40 min |

---

## 2. The Plan-Execute-Reflect Cycle

### 2.1 Core Architecture

```
Core Loop of an Autonomous Agent

      +--------+
      |  Goal  |
      +---+----+
          |
          v
  +-------+-------+
  |   Plan        |←────────────+
  +-------+-------+              |
          |                      |
          v                      |
  +-------+-------+      +------+------+
  |    Act        |----->|   Reflect   |
  +-------+-------+      +------+------+
          |                      |
          v                      |
     Success? ── YES ──→ Done   |
          |                      |
          NO ──→ Replan ─────────+
```

### 2.2 Complete Implementation

```python
# Complete implementation of an autonomous agent
import anthropic
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"

@dataclass
class SubTask:
    id: int
    description: str
    status: TaskStatus = TaskStatus.PENDING
    result: str = ""
    attempts: int = 0
    max_attempts: int = 3
    dependencies: list[int] = field(default_factory=list)
    priority: int = 0  # 0 = highest

    @property
    def can_execute(self) -> bool:
        return self.status == TaskStatus.PENDING and self.attempts < self.max_attempts

@dataclass
class ExecutionTrace:
    """Record of an execution trace"""
    step: int
    task_id: int
    task_description: str
    action: str
    result: str
    reflection: dict
    tokens_used: int
    duration: float
    timestamp: float

class AutonomousAgent:
    def __init__(
        self,
        tools: list,
        max_steps: int = 50,
        max_cost: float = 5.0,
        timeout: float = 3600,
        model: str = "claude-sonnet-4-20250514"
    ):
        self.client = anthropic.Anthropic()
        self.tools = tools
        self.max_steps = max_steps
        self.max_cost = max_cost
        self.timeout = timeout
        self.model = model
        self.plan: list[SubTask] = []
        self.completed_work: list[dict] = []
        self.reflections: list[dict] = []
        self.traces: list[ExecutionTrace] = []
        self.total_tokens = 0
        self.total_cost = 0.0
        self.start_time = 0.0
        self.agent_id = str(uuid.uuid4())[:8]

    def run(self, goal: str) -> str:
        """Receive a goal and autonomously execute until completion"""
        self.start_time = time.time()
        logger.info(f"[{self.agent_id}] Goal: {goal}")

        # Phase 1: Planning
        self.plan = self._create_plan(goal)
        logger.info(f"[{self.agent_id}] Plan: {len(self.plan)} subtasks")

        for step in range(self.max_steps):
            # Guardrail check
            if self._should_stop():
                logger.warning(f"[{self.agent_id}] Stopped by guardrail")
                break

            # Phase 2: Select and execute the next subtask
            next_task = self._select_next_task()
            if next_task is None:
                break  # All tasks complete

            logger.info(f"[{self.agent_id}] Step {step}: {next_task.description}")
            step_start = time.time()
            result = self._execute_task(next_task)

            # Phase 3: Reflect
            reflection = self._reflect(goal, next_task, result)
            self.reflections.append(reflection)

            # Record trace
            self.traces.append(ExecutionTrace(
                step=step,
                task_id=next_task.id,
                task_description=next_task.description,
                action="execute",
                result=result[:500],
                reflection=reflection,
                tokens_used=self.total_tokens,
                duration=time.time() - step_start,
                timestamp=time.time()
            ))

            # Replan if necessary
            if reflection.get("needs_replan"):
                logger.info(f"[{self.agent_id}] Replanning: {reflection['reason']}")
                self.plan = self._replan(goal, reflection["reason"])

        # Final synthesis
        return self._synthesize(goal)

    def _should_stop(self) -> bool:
        """Guardrail check"""
        # Timeout
        if time.time() - self.start_time > self.timeout:
            logger.warning("Timeout")
            return True

        # Cost limit
        if self.total_cost > self.max_cost:
            logger.warning(f"Cost limit exceeded: ${self.total_cost:.2f}")
            return True

        # Wandering detection
        if self._detect_wandering():
            logger.warning("Wandering detected")
            return True

        return False

    def _detect_wandering(self) -> bool:
        """Detect agent wandering"""
        if len(self.traces) < 5:
            return False

        recent = self.traces[-5:]

        # Consecutive failures on the same task
        task_ids = [t.task_id for t in recent]
        if len(set(task_ids)) == 1:
            task = next((t for t in self.plan if t.id == task_ids[0]), None)
            if task and task.status != TaskStatus.COMPLETED:
                return True

        # All recent reflections are rated poor
        all_poor = all(
            t.reflection.get("quality") == "poor"
            for t in recent
        )
        if all_poor:
            return True

        return False

    def _create_plan(self, goal: str) -> list[SubTask]:
        """Decompose a goal into subtasks"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Output a JSON array of subtasks to accomplish this goal.
Each subtask should be independently executable; express dependencies via ordering.

Format:
[
  {{"id": 1, "description": "...", "dependencies": [], "priority": 0}},
  {{"id": 2, "description": "...", "dependencies": [1], "priority": 1}}
]

Output JSON only.
"""}]
        )
        self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
        self._update_cost(response.usage)

        tasks_data = json.loads(response.content[0].text)
        return [
            SubTask(
                id=t["id"],
                description=t["description"],
                dependencies=t.get("dependencies", []),
                priority=t.get("priority", 0)
            )
            for t in tasks_data
        ]

    def _select_next_task(self) -> Optional[SubTask]:
        """Select the next subtask to execute (respecting dependencies)"""
        completed_ids = {
            t.id for t in self.plan if t.status == TaskStatus.COMPLETED
        }

        candidates = [
            t for t in self.plan
            if t.can_execute
            and all(dep in completed_ids for dep in t.dependencies)
        ]

        if not candidates:
            return None

        # Sort by priority
        candidates.sort(key=lambda t: t.priority)
        selected = candidates[0]
        selected.status = TaskStatus.IN_PROGRESS
        selected.attempts += 1
        return selected

    def _execute_task(self, task: SubTask) -> str:
        """Execute a subtask (with tool use)"""
        context = ""
        if self.completed_work:
            recent_work = self.completed_work[-3:]
            context = f"\nWork completed so far:\n{json.dumps(recent_work, ensure_ascii=False, indent=2)}"

        messages = [{"role": "user", "content": f"""
Subtask: {task.description}
{context}

Please complete this subtask.
"""}]

        # Agent loop (up to 10 steps)
        for _ in range(10):
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                tools=self.tools,
                messages=messages
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
            self._update_cost(response.usage)

            if response.stop_reason == "end_turn":
                result = response.content[0].text
                task.status = TaskStatus.COMPLETED
                task.result = result
                self.completed_work.append({
                    "task_id": task.id,
                    "task": task.description,
                    "result": result
                })
                return result

            # Handle tool calls
            tool_results = self._handle_tool_calls(response)
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        task.status = TaskStatus.FAILED
        return "Task could not be completed within the maximum number of steps"

    def _handle_tool_calls(self, response) -> list[dict]:
        """Process tool calls"""
        results = []
        for block in response.content:
            if block.type == "tool_use":
                tool_result = self._run_tool(block.name, block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(tool_result)
                })
        return results

    def _run_tool(self, name: str, input_data: dict) -> Any:
        """Execute a tool"""
        for tool in self.tools:
            if tool.get("name") == name:
                # Actual tool execution logic
                logger.info(f"Tool call: {name}({json.dumps(input_data, ensure_ascii=False)[:100]})")
                return f"Result of tool {name}"
        return f"Unknown tool: {name}"

    def _reflect(self, goal: str, task: SubTask, result: str) -> dict:
        """Reflect on and evaluate the execution result"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": f"""
Overall goal: {goal}
Completed task: {task.description}
Result: {result[:1000]}
Remaining tasks: {[t.description for t in self.plan if t.status == TaskStatus.PENDING]}
Previous reflections: {json.dumps(self.reflections[-3:], ensure_ascii=False) if self.reflections else "none"}

Evaluate the following in JSON format:
{{
  "quality": "good" / "acceptable" / "poor",
  "needs_replan": true/false,
  "reason": "reason replanning is needed (null if not needed)",
  "learning": "what was learned from this experience",
  "confidence": 0.0-1.0
}}

Output JSON only.
"""}]
        )
        self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
        self._update_cost(response.usage)

        try:
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return {
                "quality": "acceptable",
                "needs_replan": False,
                "reason": None,
                "learning": "Failed to parse reflection",
                "confidence": 0.5
            }

    def _replan(self, goal: str, reason: str) -> list[SubTask]:
        """Recreate the plan taking the failure reason into account"""
        completed = [t for t in self.plan if t.status == TaskStatus.COMPLETED]
        failed = [t for t in self.plan if t.status == TaskStatus.FAILED]

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Current state:
- Completed: {[t.description for t in completed]}
- Failed: {[t.description for t in failed]}
- Reason for replanning: {reason}
- Lessons learned so far: {[r.get('learning', '') for r in self.reflections[-5:]]}

Keep the completed tasks as-is and replan the remaining tasks.
Avoid the previous approach and consider alternatives.

Output as a JSON array (do not include completed tasks):
[{{"id": N, "description": "...", "dependencies": [], "priority": 0}}]
"""}]
        )
        self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
        self._update_cost(response.usage)

        # Preserve completed tasks
        new_tasks_data = json.loads(response.content[0].text)
        new_tasks = [
            SubTask(
                id=t["id"],
                description=t["description"],
                dependencies=t.get("dependencies", []),
                priority=t.get("priority", 0)
            )
            for t in new_tasks_data
        ]

        return completed + new_tasks

    def _synthesize(self, goal: str) -> str:
        """Integrate completed task results and generate the final output"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Completed tasks and their results:
{json.dumps(self.completed_work, ensure_ascii=False, indent=2)}

Lessons from reflections:
{json.dumps([r.get('learning', '') for r in self.reflections], ensure_ascii=False)}

Integrate the above results and produce the final deliverable for the goal.
"""}]
        )
        return response.content[0].text

    def _update_cost(self, usage):
        """Update cost (Sonnet pricing)"""
        self.total_cost += (
            usage.input_tokens * 3.0 / 1_000_000
            + usage.output_tokens * 15.0 / 1_000_000
        )

    def get_execution_summary(self) -> dict:
        """Get execution summary"""
        completed = sum(1 for t in self.plan if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in self.plan if t.status == TaskStatus.FAILED)
        total_time = time.time() - self.start_time

        return {
            "agent_id": self.agent_id,
            "total_tasks": len(self.plan),
            "completed": completed,
            "failed": failed,
            "total_steps": len(self.traces),
            "total_tokens": self.total_tokens,
            "total_cost": f"${self.total_cost:.4f}",
            "total_time": f"{total_time:.1f}s",
            "success_rate": f"{completed / max(len(self.plan), 1) * 100:.1f}%"
        }
```

---

## 3. Goal Decomposition Patterns

### 3.1 Hierarchical Goal Decomposition

```
Hierarchical Goal Decomposition

[Top-level goal]
├── [Sub-goal 1]
│   ├── [Task 1.1]
│   ├── [Task 1.2]
│   └── [Task 1.3]
├── [Sub-goal 2]
│   ├── [Task 2.1]
│   └── [Task 2.2]
└── [Sub-goal 3]
    ├── [Task 3.1]
    ├── [Task 3.2]
    └── [Task 3.3]

Example: "Build an e-commerce site"
├── "Design the database"
│   ├── Create ER diagram
│   ├── Define tables
│   └── Run migrations
├── "Implement the API"
│   ├── Auth API
│   └── Product API
└── "Build the frontend"
    ├── Product listing page
    ├── Cart page
    └── Checkout page
```

### 3.2 HTA (Hierarchical Task Analysis) Decomposition

```python
# Goal decomposition based on Hierarchical Task Analysis
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class HTANode:
    """Node in an HTA tree"""
    id: str
    description: str
    children: list["HTANode"] = field(default_factory=list)
    plan: str = ""  # Execution plan for this node
    is_leaf: bool = False  # Whether this is a leaf task

    @property
    def depth(self) -> int:
        if not self.children:
            return 0
        return 1 + max(c.depth for c in self.children)

    def flatten(self) -> list["HTANode"]:
        """Flatten leaf tasks"""
        if self.is_leaf or not self.children:
            return [self]
        result = []
        for child in self.children:
            result.extend(child.flatten())
        return result

class HTAPlanner:
    """Plan generation via Hierarchical Task Analysis"""

    def __init__(self, client: anthropic.Anthropic):
        self.client = client

    def decompose(self, goal: str, max_depth: int = 3) -> HTANode:
        """Hierarchically decompose a goal"""
        root = HTANode(id="0", description=goal)
        self._decompose_recursive(root, depth=0, max_depth=max_depth)
        return root

    def _decompose_recursive(
        self, node: HTANode, depth: int, max_depth: int
    ):
        """Recursively decompose"""
        if depth >= max_depth:
            node.is_leaf = True
            return

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": f"""
Task: {node.description}

Decompose this task into 2-5 subtasks.
Each subtask should be concrete and actionable.

Output as a JSON array:
[
  {{"id": "1", "description": "...", "is_leaf": true/false}},
  ...
]

is_leaf=true: A concrete action that requires no further decomposition
is_leaf=false: An abstract task that can be decomposed further
"""}]
        )

        children_data = json.loads(response.content[0].text)
        for child_data in children_data:
            child = HTANode(
                id=f"{node.id}.{child_data['id']}",
                description=child_data["description"],
                is_leaf=child_data.get("is_leaf", False)
            )
            node.children.append(child)

            if not child.is_leaf:
                self._decompose_recursive(child, depth + 1, max_depth)

    def to_subtasks(self, root: HTANode) -> list[SubTask]:
        """Convert an HTA tree to a SubTask list"""
        leaves = root.flatten()
        return [
            SubTask(
                id=i + 1,
                description=leaf.description,
                priority=i
            )
            for i, leaf in enumerate(leaves)
        ]

# Usage example
planner = HTAPlanner(anthropic.Anthropic())
tree = planner.decompose("Implement the checkout feature for an e-commerce site", max_depth=2)
tasks = planner.to_subtasks(tree)
```

### 3.3 Adaptive Replanning

```python
# Adaptive replanning implementation
class AdaptivePlanner:
    """Adaptively updates the plan from failures and learnings"""

    def __init__(self, client: anthropic.Anthropic):
        self.client = client
        self.plan_history: list[list[SubTask]] = []
        self.failure_patterns: list[dict] = []

    def replan(
        self,
        goal: str,
        current_state: dict,
        failure_reason: str
    ) -> list[SubTask]:
        """Recreate the plan taking the failure reason into account"""
        # Record failure pattern
        self.failure_patterns.append({
            "reason": failure_reason,
            "failed_tasks": current_state.get("failed", []),
            "timestamp": time.time()
        })

        # Learn from past failure patterns
        failure_summary = "\n".join(
            f"- {p['reason']}" for p in self.failure_patterns[-5:]
        )

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Current state:
- Completed: {current_state['completed']}
- Failed: {current_state['failed']}
- Failure reason: {failure_reason}

Past failure patterns:
{failure_summary}

Lessons from reflections:
{current_state.get('reflections', [])}

Replan following these principles:
1. Avoid approaches that have failed before
2. Actively consider alternatives
3. Make each task smaller and more concrete
4. Add a pre-check step before high-risk tasks

Output as a JSON array:
[{{"id": N, "description": "...", "dependencies": [], "priority": 0}}]
"""}]
        )

        tasks_data = json.loads(response.content[0].text)
        new_plan = [
            SubTask(
                id=t["id"],
                description=t["description"],
                dependencies=t.get("dependencies", []),
                priority=t.get("priority", 0)
            )
            for t in tasks_data
        ]

        self.plan_history.append(new_plan)
        return new_plan

    def get_plan_evolution(self) -> str:
        """Get the history of plan revisions"""
        lines = []
        for i, plan in enumerate(self.plan_history):
            lines.append(f"=== Plan v{i+1} ({len(plan)} tasks) ===")
            for t in plan:
                lines.append(f"  [{t.id}] {t.description}")
        return "\n".join(lines)
```

---

## 4. Memory System

### 4.1 Three-Layer Memory Architecture

```
Memory Architecture of an Autonomous Agent

┌────────────────────────────────────────────┐
│           Working Memory (short-term)       │
│  · Context for the current task             │
│  · Recent conversation history              │
│  · Within the LLM's context window          │
│  · Capacity: thousands to tens of thousands │
│    of tokens                                │
├────────────────────────────────────────────┤
│           Episodic Memory (mid-term)        │
│  · Records of past successes/failures       │
│  · List of lessons learned                  │
│  · Information carried over between tasks   │
│  · Capacity: JSON/text files                │
├────────────────────────────────────────────┤
│           Semantic Memory (long-term)       │
│  · Stored in a vector DB                   │
│  · Used to retrieve similar experiences     │
│  · Accumulated domain knowledge             │
│  · Capacity: thousands to millions of      │
│    entries                                  │
└────────────────────────────────────────────┘
```

### 4.2 Memory System Implementation

```python
# Three-layer memory system
from dataclasses import dataclass, field
from typing import Optional
import json
import time
import hashlib

@dataclass
class MemoryEntry:
    """A memory entry"""
    content: str
    type: str  # "success", "failure", "learning", "fact"
    tags: list[str] = field(default_factory=list)
    importance: float = 0.5  # 0.0-1.0
    timestamp: float = field(default_factory=time.time)
    access_count: int = 0

class WorkingMemory:
    """Working memory (short-term)"""

    def __init__(self, max_items: int = 20):
        self.items: list[dict] = []
        self.max_items = max_items

    def add(self, content: str, type: str = "observation"):
        self.items.append({
            "content": content,
            "type": type,
            "timestamp": time.time()
        })
        # Remove oldest items when capacity is exceeded
        if len(self.items) > self.max_items:
            self.items = self.items[-self.max_items:]

    def get_context(self, max_tokens: int = 2000) -> str:
        """Generate context to pass to the LLM"""
        context_parts = []
        total_chars = 0
        for item in reversed(self.items):
            text = f"[{item['type']}] {item['content']}"
            if total_chars + len(text) > max_tokens * 4:
                break
            context_parts.insert(0, text)
            total_chars += len(text)
        return "\n".join(context_parts)

    def clear(self):
        self.items = []

class EpisodicMemory:
    """Episodic memory (mid-term)"""

    def __init__(self, filepath: str = "episodic_memory.json"):
        self.filepath = filepath
        self.episodes: list[MemoryEntry] = []
        self._load()

    def _load(self):
        try:
            with open(self.filepath, "r") as f:
                data = json.load(f)
                self.episodes = [
                    MemoryEntry(**ep) for ep in data
                ]
        except FileNotFoundError:
            self.episodes = []

    def _save(self):
        with open(self.filepath, "w") as f:
            json.dump(
                [
                    {
                        "content": ep.content,
                        "type": ep.type,
                        "tags": ep.tags,
                        "importance": ep.importance,
                        "timestamp": ep.timestamp,
                        "access_count": ep.access_count
                    }
                    for ep in self.episodes
                ],
                f, ensure_ascii=False, indent=2
            )

    def record(self, content: str, type: str,
               tags: list[str] = None, importance: float = 0.5):
        """Record an episode"""
        entry = MemoryEntry(
            content=content,
            type=type,
            tags=tags or [],
            importance=importance
        )
        self.episodes.append(entry)
        self._save()

    def recall(self, query: str, top_k: int = 5) -> list[MemoryEntry]:
        """Search for relevant episodes"""
        # Simple keyword matching
        query_words = set(query.lower().split())
        scored = []
        for ep in self.episodes:
            content_words = set(ep.content.lower().split())
            tag_words = set(w.lower() for w in ep.tags)
            overlap = len(query_words & (content_words | tag_words))
            score = overlap * ep.importance * (1 + ep.access_count * 0.1)
            scored.append((score, ep))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = [ep for _, ep in scored[:top_k] if _ > 0]

        # Update access count
        for ep in results:
            ep.access_count += 1
        self._save()

        return results

    def get_learnings(self) -> list[str]:
        """Get the list of learnings"""
        return [
            ep.content for ep in self.episodes
            if ep.type == "learning"
        ]

class SemanticMemory:
    """Semantic memory (long-term) — vector DB integration"""

    def __init__(self, collection_name: str = "agent_memory"):
        # Use a vector DB such as ChromaDB
        try:
            import chromadb
            self.client = chromadb.PersistentClient(path="./chroma_db")
            self.collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        except ImportError:
            logger.warning("chromadb not installed: semantic memory is disabled")
            self.collection = None

    def store(self, content: str, metadata: dict = None):
        """Store knowledge"""
        if not self.collection:
            return

        doc_id = hashlib.md5(content.encode()).hexdigest()
        self.collection.upsert(
            documents=[content],
            metadatas=[metadata or {}],
            ids=[doc_id]
        )

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Search for similar knowledge"""
        if not self.collection:
            return []

        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )

        return [
            {
                "content": doc,
                "metadata": meta,
                "distance": dist
            }
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            )
        ]

class AgentMemorySystem:
    """Integrated memory system"""

    def __init__(self):
        self.working = WorkingMemory()
        self.episodic = EpisodicMemory()
        self.semantic = SemanticMemory()

    def remember(self, content: str, type: str, importance: float = 0.5):
        """Store a memory uniformly across all layers"""
        self.working.add(content, type)
        self.episodic.record(content, type, importance=importance)

        if importance > 0.7:
            self.semantic.store(content, {"type": type})

    def recall_relevant(self, query: str) -> dict:
        """Retrieve relevant memories from all layers"""
        return {
            "working": self.working.get_context(),
            "episodic": [
                ep.content for ep in self.episodic.recall(query)
            ],
            "semantic": [
                r["content"] for r in self.semantic.search(query)
            ]
        }
```

### 4.3 Memory-Augmented Agent

```python
# Autonomous agent with memory
class MemoryAugmentedAgent(AutonomousAgent):
    """Autonomous agent integrated with the memory system"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.memory = AgentMemorySystem()

    def _execute_task(self, task: SubTask) -> str:
        # Search for relevant memories
        memories = self.memory.recall_relevant(task.description)

        # Add memories to context
        memory_context = ""
        if memories["episodic"]:
            memory_context += "\nRelated past experiences:\n"
            memory_context += "\n".join(f"- {m}" for m in memories["episodic"][:3])
        if memories["semantic"]:
            memory_context += "\nRelated knowledge:\n"
            memory_context += "\n".join(f"- {m}" for m in memories["semantic"][:3])

        messages = [{"role": "user", "content": f"""
Subtask: {task.description}
{memory_context}

Work completed so far:
{json.dumps(self.completed_work[-3:], ensure_ascii=False)}

Please complete this subtask.
"""}]

        # Execute (same logic as parent class)
        result = self._execute_with_messages(messages)

        # Record result in memory
        self.memory.remember(
            f"Executed task '{task.description}'. Result: {result[:200]}",
            type="success" if task.status == TaskStatus.COMPLETED else "failure",
            importance=0.6
        )

        return result

    def _reflect(self, goal: str, task: SubTask, result: str) -> dict:
        reflection = super()._reflect(goal, task, result)

        # Record learning in memory
        if reflection.get("learning"):
            self.memory.remember(
                reflection["learning"],
                type="learning",
                importance=0.8
            )

        return reflection
```

---

## 5. Self-Evaluation Mechanisms

### 5.1 Multi-Perspective Self-Evaluation

```python
# Multi-perspective self-evaluation
class SelfEvaluator:
    """Evaluates agent output from multiple perspectives"""

    def __init__(self, client: anthropic.Anthropic):
        self.client = client

    def evaluate(self, goal: str, output: str) -> dict:
        """Evaluate output from multiple perspectives"""

        # Perspective 1: Goal completion
        completeness_resp = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[{"role": "user", "content": f"""
Goal: {goal}
Output: {output[:2000]}

Reply with a single number from 0-100 for the degree of goal completion:"""}]
        )
        completeness = int(completeness_resp.content[0].text.strip())

        # Perspective 2: Quality
        quality_resp = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[{"role": "user", "content": f"""
Output: {output[:2000]}
Reply with a single number from 0-100 for quality (accuracy, completeness, clarity):"""}]
        )
        quality = int(quality_resp.content[0].text.strip())

        # Perspective 3: Room for improvement
        improvements_resp = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": f"""
Output: {output[:2000]}
List three areas that can be improved as bullet points:"""}]
        )
        improvements = improvements_resp.content[0].text

        return {
            "completeness": completeness,
            "quality": quality,
            "improvements": improvements,
            "should_improve": completeness < 80 or quality < 70,
            "overall_score": (completeness + quality) / 2
        }

    def evaluate_with_rubric(self, output: str, rubric: dict) -> dict:
        """Evaluate against a rubric"""
        results = {}
        for criterion, description in rubric.items():
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=200,
                messages=[{"role": "user", "content": f"""
Output:
{output[:1500]}

Evaluation criterion "{criterion}": {description}

Provide a score (0-10) and rationale for this criterion in the following format:
Score: N
Rationale: ...
"""}]
            )
            text = response.content[0].text
            score_line = text.split("\n")[0]
            score = int(score_line.split(":")[-1].strip())
            results[criterion] = {
                "score": score,
                "feedback": text
            }

        return results
```

### 5.2 Self-Evaluation Flow

```
Self-Evaluation Flow

  [Output] → [Completeness check] → <80% → [Re-execute]
                |
                v ≥80%
           [Quality check] → <70 pts → [Improvement loop]
                |
                v ≥70 pts
           [Final review] → Approved → [Done]
```

### 5.3 Reflexion Pattern Implementation

```python
# Reflexion: verbal self-reinforcement learning
class ReflexionAgent(AutonomousAgent):
    """Autonomous agent with the Reflexion pattern"""

    def __init__(self, *args, max_reflexion_rounds: int = 3, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_reflexion_rounds = max_reflexion_rounds
        self.reflexion_memory: list[str] = []  # Verbal experience memory

    def run(self, goal: str) -> str:
        """Execute with the Reflexion loop"""
        best_result = None
        best_score = 0

        for round_num in range(self.max_reflexion_rounds):
            logger.info(f"Reflexion Round {round_num + 1}")

            # Execute
            result = self._execute_round(goal, round_num)

            # Evaluate
            evaluator = SelfEvaluator(self.client)
            evaluation = evaluator.evaluate(goal, result)
            score = evaluation["overall_score"]

            logger.info(
                f"  Score: {score:.1f} "
                f"(completeness: {evaluation['completeness']}, "
                f"quality: {evaluation['quality']})"
            )

            if score > best_score:
                best_score = score
                best_result = result

            # Stop if the quality threshold is met
            if not evaluation["should_improve"]:
                logger.info("  Quality threshold reached")
                break

            # Reflect (Reflexion)
            reflexion = self._generate_reflexion(
                goal, result, evaluation
            )
            self.reflexion_memory.append(reflexion)
            logger.info(f"  Reflexion: {reflexion[:100]}...")

            # Reset plan and retry
            self.plan = []
            self.completed_work = []

        return best_result

    def _execute_round(self, goal: str, round_num: int) -> str:
        """Execute one round"""
        # Include past Reflexions in context
        reflexion_context = ""
        if self.reflexion_memory:
            reflexion_context = "\nPast reflections (avoid repeating the same mistakes):\n"
            for i, r in enumerate(self.reflexion_memory):
                reflexion_context += f"Round {i+1}: {r}\n"

        augmented_goal = f"{goal}\n{reflexion_context}"

        self.plan = self._create_plan(augmented_goal)

        for step in range(self.max_steps):
            if self._should_stop():
                break

            next_task = self._select_next_task()
            if next_task is None:
                break

            self._execute_task(next_task)

        return self._synthesize(goal)

    def _generate_reflexion(
        self, goal: str, result: str, evaluation: dict
    ) -> str:
        """Generate a reflection from failure"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": f"""
Goal: {goal}
Execution result: {result[:1000]}

Evaluation:
- Completeness: {evaluation['completeness']}%
- Quality: {evaluation['quality']} pts
- Improvements: {evaluation['improvements']}

In 2-3 concrete, actionable sentences, explain why this result was insufficient
and how it can be improved next time:
"""}]
        )
        return response.content[0].text
```

---

## 6. Human-in-the-Loop

### 6.1 Designing Intervention Points

```
Human-in-the-Loop Intervention Points

[Plan] ──confirm──> [Human approval] ──→ [Execute] ──→ [Reflect]
                                              |
                                        Critical decision ──confirm──> [Human judgment]
                                              |
                                        Destructive operation ──confirm──> [Human approval]
```

### 6.2 Implementation Pattern

```python
# Human-in-the-loop implementation
from enum import Enum

class ApprovalLevel(Enum):
    NONE = "none"          # No approval needed
    INFO = "info"          # Notification only
    OPTIONAL = "optional"  # Optional approval (auto-approved on timeout)
    REQUIRED = "required"  # Approval required
    BLOCKING = "blocking"  # Blocking approval (human judgment absolutely required)

class HumanInTheLoopAgent(AutonomousAgent):
    """Autonomous agent with human-in-the-loop"""

    def __init__(
        self,
        *args,
        approval_rules: dict[str, ApprovalLevel] = None,
        approval_timeout: float = 300,  # 5 minutes
        notification_callback=None,
        **kwargs
    ):
        super().__init__(*args, **kwargs)
        self.approval_rules = approval_rules or {
            "delete": ApprovalLevel.REQUIRED,
            "deploy": ApprovalLevel.BLOCKING,
            "send": ApprovalLevel.REQUIRED,
            "purchase": ApprovalLevel.BLOCKING,
            "modify_production": ApprovalLevel.BLOCKING,
            "install": ApprovalLevel.OPTIONAL,
            "create": ApprovalLevel.INFO,
        }
        self.approval_timeout = approval_timeout
        self.notification_callback = notification_callback
        self.approval_log: list[dict] = []

    def _get_approval_level(self, task: SubTask) -> ApprovalLevel:
        """Determine the approval level for a task"""
        for keyword, level in self.approval_rules.items():
            if keyword in task.description.lower():
                return level
        return ApprovalLevel.NONE

    def _request_approval(
        self, task: SubTask, level: ApprovalLevel
    ) -> tuple[bool, str]:
        """Request human approval"""
        log_entry = {
            "task": task.description,
            "level": level.value,
            "timestamp": time.time(),
            "decision": None
        }

        if level == ApprovalLevel.INFO:
            # Notification only
            if self.notification_callback:
                self.notification_callback(
                    f"[INFO] Task in progress: {task.description}"
                )
            log_entry["decision"] = "auto_approved"
            self.approval_log.append(log_entry)
            return True, ""

        if level == ApprovalLevel.OPTIONAL:
            # Approval with timeout
            print(f"\n[Approval request (optional)] Task: {task.description}")
            print(f"  Will be auto-approved if no input within {self.approval_timeout} seconds")
            # In a real UI, use WebSocket/Slack etc. for notification
            try:
                import signal
                signal.alarm(int(self.approval_timeout))
                approval = input("Approve? (yes/no): ").strip().lower()
                signal.alarm(0)
            except Exception:
                approval = "yes"  # Timeout → auto-approve

            approved = approval != "no"
            log_entry["decision"] = "approved" if approved else "rejected"
            self.approval_log.append(log_entry)
            return approved, ""

        # REQUIRED / BLOCKING
        print(f"\n{'='*50}")
        print(f"[Approval required] Task: {task.description}")
        print(f"Approval level: {level.value}")
        print(f"{'='*50}")
        approval = input("Approve? (yes/no/modify): ").strip().lower()

        if approval == "no":
            log_entry["decision"] = "rejected"
            self.approval_log.append(log_entry)
            return False, "Rejected by user"
        elif approval == "modify":
            new_desc = input("Updated task description: ")
            task.description = new_desc
            log_entry["decision"] = "modified"
            log_entry["modified_to"] = new_desc
            self.approval_log.append(log_entry)
            return True, ""
        else:
            log_entry["decision"] = "approved"
            self.approval_log.append(log_entry)
            return True, ""

    def _execute_task(self, task: SubTask) -> str:
        level = self._get_approval_level(task)

        if level != ApprovalLevel.NONE:
            approved, message = self._request_approval(task, level)
            if not approved:
                task.status = TaskStatus.BLOCKED
                return message

        return super()._execute_task(task)
```

### 6.3 Async Approval (Slack/Web Integration)

```python
# Approval flow via Slack
import asyncio
from typing import Callable, Awaitable

class AsyncApprovalSystem:
    """Asynchronous approval system"""

    def __init__(self):
        self.pending_approvals: dict[str, asyncio.Future] = {}

    async def request_approval(
        self,
        approval_id: str,
        task_description: str,
        timeout: float = 300
    ) -> bool:
        """Request approval asynchronously"""
        future = asyncio.get_event_loop().create_future()
        self.pending_approvals[approval_id] = future

        # Send Slack notification
        await self._send_slack_notification(
            f"Approval request: {task_description}\n"
            f"Approve: `/approve {approval_id}`\n"
            f"Reject: `/reject {approval_id}`"
        )

        try:
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            logger.warning(f"Approval timeout: {approval_id}")
            return False
        finally:
            self.pending_approvals.pop(approval_id, None)

    def handle_approval_response(self, approval_id: str, approved: bool):
        """Process an approval response (called from a Slack command)"""
        future = self.pending_approvals.get(approval_id)
        if future and not future.done():
            future.set_result(approved)

    async def _send_slack_notification(self, message: str):
        """Send a Slack notification"""
        # Slack API integration implementation
        logger.info(f"Slack notification: {message}")
```

---

## 7. Safety Guardrails

### 7.1 Defense in Depth

```python
# Guardrails for autonomous agents
from dataclasses import dataclass
from typing import Callable

@dataclass
class GuardRail:
    """Guardrail definition"""
    name: str
    check: Callable[[dict], bool]  # True=safe, False=unsafe
    action: str  # "block", "warn", "require_approval"
    description: str

class GuardedAutonomousAgent(AutonomousAgent):
    """Autonomous agent with guardrails"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.guardrails: list[GuardRail] = self._default_guardrails()
        self.violations: list[dict] = []

    def _default_guardrails(self) -> list[GuardRail]:
        return [
            GuardRail(
                name="step_limit",
                check=lambda ctx: ctx["step"] < self.max_steps,
                action="block",
                description="Maximum step count limit"
            ),
            GuardRail(
                name="cost_limit",
                check=lambda ctx: ctx["cost"] < self.max_cost,
                action="block",
                description="Cost ceiling limit"
            ),
            GuardRail(
                name="timeout",
                check=lambda ctx: ctx["elapsed"] < self.timeout,
                action="block",
                description="Execution time limit"
            ),
            GuardRail(
                name="forbidden_commands",
                check=lambda ctx: not any(
                    cmd in ctx.get("action", "").lower()
                    for cmd in ["rm -rf", "drop table", "format", "shutdown"]
                ),
                action="block",
                description="Prohibition of dangerous commands"
            ),
            GuardRail(
                name="pii_filter",
                check=lambda ctx: not self._contains_pii(ctx.get("output", "")),
                action="warn",
                description="Prevention of PII in output"
            ),
            GuardRail(
                name="loop_detection",
                check=lambda ctx: not self._detect_wandering(),
                action="require_approval",
                description="Infinite loop detection"
            ),
            GuardRail(
                name="scope_check",
                check=lambda ctx: self._is_within_scope(
                    ctx.get("action", ""), ctx.get("goal", "")
                ),
                action="warn",
                description="Check whether action is within goal scope"
            ),
        ]

    def _contains_pii(self, text: str) -> bool:
        """Check whether text contains PII"""
        import re
        patterns = [
            r'\b\d{3}-\d{4}-\d{4}\b',  # Phone number
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email
            r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
            r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',  # Credit card
        ]
        return any(re.search(p, text) for p in patterns)

    def _is_within_scope(self, action: str, goal: str) -> bool:
        """Check whether the action is within the scope of the goal"""
        # Simple scope check
        # In production, LLM-based judgment is recommended
        return True

    def check_guardrails(self, context: dict) -> list[dict]:
        """Check all guardrails"""
        violations = []
        for rail in self.guardrails:
            try:
                if not rail.check(context):
                    violation = {
                        "guardrail": rail.name,
                        "action": rail.action,
                        "description": rail.description,
                        "timestamp": time.time()
                    }
                    violations.append(violation)
                    self.violations.append(violation)
                    logger.warning(
                        f"Guardrail violation: {rail.name} - {rail.description}"
                    )
            except Exception as e:
                logger.error(f"Guardrail check error: {rail.name} - {e}")

        return violations

    def _execute_task(self, task: SubTask) -> str:
        context = {
            "step": len(self.traces),
            "cost": self.total_cost,
            "elapsed": time.time() - self.start_time,
            "action": task.description,
            "goal": "",
        }

        violations = self.check_guardrails(context)

        for v in violations:
            if v["action"] == "block":
                task.status = TaskStatus.BLOCKED
                return f"Stopped by guardrail: {v['description']}"
            elif v["action"] == "require_approval":
                print(f"\n[Guardrail warning] {v['description']}")
                approval = input("Continue? (yes/no): ")
                if approval != "yes":
                    task.status = TaskStatus.BLOCKED
                    return "Stopped by user"

        return super()._execute_task(task)
```

### 7.2 Detailed Wandering Detection Implementation

```python
# Advanced wandering detection
class WanderingDetector:
    """System for detecting agent wandering"""

    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        self.action_history: list[dict] = []

    def record_action(self, action: str, result: str, success: bool):
        self.action_history.append({
            "action": action,
            "result_hash": hashlib.md5(result.encode()).hexdigest()[:8],
            "success": success,
            "timestamp": time.time()
        })

    def is_wandering(self) -> tuple[bool, str]:
        """Detect wandering and return the reason"""
        if len(self.action_history) < self.window_size:
            return False, ""

        recent = self.action_history[-self.window_size:]

        # Pattern 1: Repeated identical action
        actions = [a["action"] for a in recent]
        most_common = max(set(actions), key=actions.count)
        if actions.count(most_common) > self.window_size * 0.7:
            return True, f"Repeated identical action: {most_common}"

        # Pattern 2: Repeated identical result
        results = [a["result_hash"] for a in recent]
        if len(set(results)) < 3:
            return True, "Repeated identical result"

        # Pattern 3: Consecutive failures
        failures = sum(1 for a in recent if not a["success"])
        if failures > self.window_size * 0.8:
            return True, f"Consecutive failures: {failures}/{self.window_size}"

        # Pattern 4: Repeated create → delete cycles
        create_delete_pairs = 0
        for i in range(len(recent) - 1):
            if ("create" in recent[i]["action"].lower() and
                "delete" in recent[i+1]["action"].lower()):
                create_delete_pairs += 1
        if create_delete_pairs >= 3:
            return True, "Repeated create → delete cycles (contradictory actions)"

        return False, ""
```

---

## 8. Autonomy Level Comparison

| Level | Description | Human Involvement | Use Case | Risk |
|-------|-------------|------------------|----------|------|
| L0 Manual | Fully manual | 100% | — | Lowest |
| L1 Assisted | Executes one step | 80% | IDE autocomplete | Low |
| L2 Semi-autonomous | Executes multiple steps | 50% | Chatbots | Low–medium |
| L3 Conditional | Human approves critical decisions only | 10-20% | Coding agents | Medium |
| L4 Fully autonomous | Goal only | 0-5% | Auto-deploy | High |

### Autonomy Levels of Representative Products

| Product | Level | Characteristics |
|---------|-------|-----------------|
| GitHub Copilot | L1 | Line-by-line completion |
| ChatGPT | L1-L2 | Interactive with tools |
| Claude Code | L3 | Coding + file operations |
| Devin | L3-L4 | Autonomous software development |
| AutoGPT | L4 | Fully autonomous (practicality is a challenge) |

---

## 9. Monitoring and Cost Management

### 9.1 Execution Monitoring

```python
# Monitoring for autonomous agents
from dataclasses import dataclass, field
from collections import defaultdict
import statistics

@dataclass
class AgentMonitor:
    """Monitoring system for autonomous agents"""

    metrics: dict[str, list[float]] = field(
        default_factory=lambda: defaultdict(list)
    )
    alerts: list[dict] = field(default_factory=list)
    alert_thresholds: dict[str, float] = field(default_factory=lambda: {
        "step_duration_p95": 30.0,  # seconds
        "cost_per_step": 0.05,     # USD
        "failure_rate": 0.3,       # 30%
        "wandering_score": 0.7,    # wandering score
    })

    def record_step(
        self,
        step: int,
        duration: float,
        cost: float,
        success: bool,
        tokens: int
    ):
        """Record metrics for a step"""
        self.metrics["duration"].append(duration)
        self.metrics["cost"].append(cost)
        self.metrics["success"].append(1.0 if success else 0.0)
        self.metrics["tokens"].append(tokens)

        # Check alerts
        self._check_alerts(step)

    def _check_alerts(self, step: int):
        """Check alert conditions"""
        durations = self.metrics["duration"]
        if len(durations) >= 5:
            p95 = sorted(durations)[int(len(durations) * 0.95)]
            if p95 > self.alert_thresholds["step_duration_p95"]:
                self._add_alert("High latency", f"P95={p95:.1f}s", step)

        costs = self.metrics["cost"]
        if costs and costs[-1] > self.alert_thresholds["cost_per_step"]:
            self._add_alert(
                "High-cost step",
                f"${costs[-1]:.4f}",
                step
            )

        successes = self.metrics["success"]
        if len(successes) >= 5:
            recent_rate = statistics.mean(successes[-5:])
            if recent_rate < (1 - self.alert_thresholds["failure_rate"]):
                self._add_alert(
                    "High failure rate",
                    f"Last 5 steps success rate={recent_rate*100:.0f}%",
                    step
                )

    def _add_alert(self, type: str, detail: str, step: int):
        alert = {
            "type": type,
            "detail": detail,
            "step": step,
            "timestamp": time.time()
        }
        self.alerts.append(alert)
        logger.warning(f"ALERT [{type}]: {detail} (step {step})")

    def get_report(self) -> str:
        """Generate a monitoring report"""
        if not self.metrics["duration"]:
            return "No data"

        lines = [
            "=== Autonomous Agent Execution Report ===",
            f"Total steps: {len(self.metrics['duration'])}",
            f"Total execution time: {sum(self.metrics['duration']):.1f}s",
            f"Total cost: ${sum(self.metrics['cost']):.4f}",
            f"Total tokens: {sum(self.metrics['tokens']):,}",
            f"Success rate: {statistics.mean(self.metrics['success'])*100:.1f}%",
            f"",
            f"--- Per-step statistics ---",
            f"Duration: avg={statistics.mean(self.metrics['duration']):.2f}s, "
            f"max={max(self.metrics['duration']):.2f}s",
            f"Cost: avg=${statistics.mean(self.metrics['cost']):.4f}, "
            f"max=${max(self.metrics['cost']):.4f}",
        ]

        if self.alerts:
            lines.append(f"\n--- Alerts ({len(self.alerts)}) ---")
            for a in self.alerts[-10:]:
                lines.append(f"  [{a['type']}] {a['detail']} (step {a['step']})")

        return "\n".join(lines)
```

### 9.2 Cost Optimization

```python
# Cost optimization strategies
class CostOptimizer:
    """Cost optimization for autonomous agents"""

    MODEL_TIERS = {
        "fast": {
            "model": "claude-haiku-3-20240307",
            "input_cost": 0.25,
            "output_cost": 1.25,
        },
        "balanced": {
            "model": "claude-sonnet-4-20250514",
            "input_cost": 3.0,
            "output_cost": 15.0,
        },
        "best": {
            "model": "claude-opus-4-20250514",
            "input_cost": 15.0,
            "output_cost": 75.0,
        }
    }

    @staticmethod
    def select_model_for_phase(phase: str) -> str:
        """Select the model appropriate for a phase"""
        phase_model_map = {
            "planning": "balanced",     # Medium quality is sufficient for planning
            "execution": "balanced",    # Medium quality for execution
            "reflection": "fast",       # Fast model is sufficient for reflection
            "evaluation": "balanced",   # Medium quality for evaluation
            "synthesis": "best",        # High quality for final synthesis
            "classification": "fast",   # Fast model is sufficient for classification
        }
        tier = phase_model_map.get(phase, "balanced")
        return CostOptimizer.MODEL_TIERS[tier]["model"]

    @staticmethod
    def estimate_cost(
        plan: list[SubTask],
        avg_tokens_per_task: int = 2000
    ) -> dict:
        """Estimate cost before execution"""
        # Estimated cost for each phase
        planning_cost = avg_tokens_per_task * 2 * 3.0 / 1_000_000  # planning
        execution_cost = (
            len(plan) * avg_tokens_per_task * 2 * 3.0 / 1_000_000
        )
        reflection_cost = (
            len(plan) * avg_tokens_per_task * 0.25 / 1_000_000  # Haiku
        )
        synthesis_cost = avg_tokens_per_task * 3 * 15.0 / 1_000_000  # Opus

        total = planning_cost + execution_cost + reflection_cost + synthesis_cost

        return {
            "planning": f"${planning_cost:.4f}",
            "execution": f"${execution_cost:.4f}",
            "reflection": f"${reflection_cost:.4f}",
            "synthesis": f"${synthesis_cost:.4f}",
            "total_estimate": f"${total:.4f}",
            "total_with_buffer": f"${total * 1.5:.4f}",  # 50% buffer
        }
```

---

## 10. Testing

### 10.1 Unit Tests

```python
# Tests for autonomous agents
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

class TestAutonomousAgent:
    """Unit tests for the autonomous agent"""

    @pytest.fixture
    def mock_client(self):
        with patch("anthropic.Anthropic") as mock:
            yield mock.return_value

    @pytest.fixture
    def agent(self, mock_client):
        return AutonomousAgent(
            tools=[],
            max_steps=10,
            max_cost=1.0,
            timeout=60
        )

    def test_create_plan(self, agent, mock_client):
        """Test plan generation"""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(
            text='[{"id": 1, "description": "Task 1"}, '
                 '{"id": 2, "description": "Task 2"}]'
        )]
        mock_response.usage = MagicMock(input_tokens=100, output_tokens=50)
        mock_client.messages.create.return_value = mock_response

        plan = agent._create_plan("Test goal")
        assert len(plan) == 2
        assert plan[0].description == "Task 1"

    def test_select_next_task_respects_dependencies(self, agent):
        """Task selection respects dependencies"""
        agent.plan = [
            SubTask(id=1, description="Task 1", status=TaskStatus.COMPLETED),
            SubTask(id=2, description="Task 2", dependencies=[1]),
            SubTask(id=3, description="Task 3", dependencies=[2]),
        ]

        next_task = agent._select_next_task()
        assert next_task.id == 2  # Task 2 whose dependency is complete

    def test_select_next_task_blocks_unmet_deps(self, agent):
        """Skip tasks with unmet dependencies"""
        agent.plan = [
            SubTask(id=1, description="Task 1", status=TaskStatus.PENDING),
            SubTask(id=2, description="Task 2", dependencies=[1]),
        ]

        next_task = agent._select_next_task()
        assert next_task.id == 1  # Only Task 1 (no dependencies) can be selected

    def test_should_stop_cost_limit(self, agent):
        """Stop when cost limit is exceeded"""
        agent.total_cost = 2.0  # Exceeds max_cost=1.0
        agent.start_time = time.time()
        assert agent._should_stop() is True

    def test_should_stop_timeout(self, agent):
        """Stop on timeout"""
        agent.start_time = time.time() - 120  # Exceeds timeout=60
        assert agent._should_stop() is True

class TestWanderingDetector:
    """Tests for wandering detection"""

    def test_detect_repeated_action(self):
        detector = WanderingDetector(window_size=5)
        for _ in range(5):
            detector.record_action("search", "result1", True)

        is_wandering, reason = detector.is_wandering()
        assert is_wandering
        assert "Repeated identical action" in reason

    def test_detect_consecutive_failures(self):
        detector = WanderingDetector(window_size=5)
        for _ in range(5):
            detector.record_action("different_action", f"result_{_}", False)

        is_wandering, reason = detector.is_wandering()
        assert is_wandering
        assert "Consecutive failures" in reason

    def test_no_wandering_normal_operation(self):
        detector = WanderingDetector(window_size=5)
        for i in range(5):
            detector.record_action(f"action_{i}", f"result_{i}", True)

        is_wandering, _ = detector.is_wandering()
        assert not is_wandering

class TestSelfEvaluator:
    """Tests for self-evaluation"""

    @pytest.fixture
    def mock_client(self):
        with patch("anthropic.Anthropic") as mock:
            yield mock.return_value

    def test_evaluate_high_quality(self, mock_client):
        evaluator = SelfEvaluator(mock_client)

        # Mock high-score responses
        responses = [
            MagicMock(content=[MagicMock(text="90")]),   # completeness
            MagicMock(content=[MagicMock(text="85")]),   # quality
            MagicMock(content=[MagicMock(text="Improvement 1\nImprovement 2\nImprovement 3")]),
        ]
        mock_client.messages.create.side_effect = responses

        result = evaluator.evaluate("Goal", "Output text")
        assert result["completeness"] == 90
        assert result["quality"] == 85
        assert not result["should_improve"]

    def test_evaluate_low_quality(self, mock_client):
        evaluator = SelfEvaluator(mock_client)

        responses = [
            MagicMock(content=[MagicMock(text="50")]),
            MagicMock(content=[MagicMock(text="40")]),
            MagicMock(content=[MagicMock(text="Needs improvement")]),
        ]
        mock_client.messages.create.side_effect = responses

        result = evaluator.evaluate("Goal", "Output text")
        assert result["should_improve"]

class TestGuardrails:
    """Tests for guardrails"""

    def test_pii_detection(self):
        agent = GuardedAutonomousAgent(tools=[], max_steps=10)

        # Phone number
        assert agent._contains_pii("080-1234-5678") is True
        # Email address
        assert agent._contains_pii("user@example.com") is True
        # Normal text
        assert agent._contains_pii("Safe text") is False

    def test_forbidden_commands(self):
        agent = GuardedAutonomousAgent(tools=[], max_steps=10)
        context = {
            "step": 0,
            "cost": 0,
            "elapsed": 0,
            "action": "rm -rf /important",
        }

        violations = agent.check_guardrails(context)
        blocked = [v for v in violations if v["action"] == "block"]
        assert len(blocked) > 0
```

### 10.2 Integration Tests

```python
# Integration tests
class TestAutonomousAgentIntegration:
    """Integration tests for the autonomous agent"""

    @pytest.fixture
    def mock_llm_sequence(self):
        """Mock a sequence of LLM calls"""
        def create_response(text, stop="end_turn"):
            resp = MagicMock()
            resp.content = [MagicMock(text=text, type="text")]
            resp.stop_reason = stop
            resp.usage = MagicMock(input_tokens=100, output_tokens=50)
            return resp

        return create_response

    def test_full_execution_flow(self, mock_llm_sequence):
        """Test the complete execution flow"""
        with patch("anthropic.Anthropic") as mock_cls:
            client = mock_cls.return_value

            # Plan → Execute x 2 → Reflect x 2 → Synthesize
            client.messages.create.side_effect = [
                # Planning
                mock_llm_sequence(
                    '[{"id":1,"description":"Analyze"},{"id":2,"description":"Report"}]'
                ),
                # Task 1 execution
                mock_llm_sequence("Analysis result"),
                # Task 1 reflection
                mock_llm_sequence(
                    '{"quality":"good","needs_replan":false,"reason":null,'
                    '"learning":"Analysis complete","confidence":0.9}'
                ),
                # Task 2 execution
                mock_llm_sequence("Report complete"),
                # Task 2 reflection
                mock_llm_sequence(
                    '{"quality":"good","needs_replan":false,"reason":null,'
                    '"learning":"Report complete","confidence":0.95}'
                ),
                # Synthesis
                mock_llm_sequence("Final report"),
            ]

            agent = AutonomousAgent(tools=[], max_steps=10)
            result = agent.run("Run test analysis")

            assert result == "Final report"
            summary = agent.get_execution_summary()
            assert summary["completed"] == 2
            assert summary["failed"] == 0
```

---

## 11. Anti-Patterns

### Anti-Pattern 1: Charging Ahead Without Reflection

```python
# NG: Proceeding without evaluating the result
for task in plan:
    result = execute(task)
    # Continue regardless of how bad the result is...

# OK: Reflect at each step and replan as needed
for task in plan:
    result = execute(task)
    evaluation = reflect(result)
    if evaluation["quality"] == "poor":
        plan = replan(goal, evaluation["reason"])
```

### Anti-Pattern 2: Excessive Autonomy (No Guardrails)

```python
# NG: Autonomous execution without restrictions
agent.run("Optimize server performance")
# → Autonomously changes production config, service goes down

# OK: Appropriate guardrails
agent = GuardedAutonomousAgent(
    tools=available_tools,
    max_steps=30,                    # Step limit
    max_cost=5.0,                    # Cost limit (USD)
    timeout=600,                     # Timeout (seconds)
)
```

### Anti-Pattern 3: Not Using Memory

```python
# NG: Planning from scratch every time (not leveraging past experience)
agent = AutonomousAgent(tools=tools)
result = agent.run("Fix the bug")
# → Repeats the same mistakes over and over

# OK: Leverage memory
agent = MemoryAugmentedAgent(tools=tools)
# Automatically leverages past success/failure patterns
result = agent.run("Fix the bug")
```

### Anti-Pattern 4: Relying on a Single Model

```python
# NG: Highest-performance model for every phase (cost explosion)
agent = AutonomousAgent(model="claude-opus-4-20250514")

# OK: Per-phase model optimization
class CostAwareAgent(AutonomousAgent):
    def _create_plan(self, goal):
        # Use balanced model for planning
        self.current_model = CostOptimizer.select_model_for_phase("planning")
        return super()._create_plan(goal)

    def _reflect(self, goal, task, result):
        # Use fast model for reflection
        self.current_model = CostOptimizer.select_model_for_phase("reflection")
        return super()._reflect(goal, task, result)

    def _synthesize(self, goal):
        # Use best model for final synthesis
        self.current_model = CostOptimizer.select_model_for_phase("synthesis")
        return super()._synthesize(goal)
```

---

## 12. FAQ

### Q1: What is the expected execution time for an autonomous agent?

This depends on task complexity; current rough estimates are:
- **Simple tasks** (file operations, search): 30 seconds – 2 minutes
- **Medium** (coding, analysis): 2 – 10 minutes
- **Complex** (design + implementation + testing): 10 minutes – 1 hour
- **Large-scale** (entire project): 1 hour or more

Long-running tasks require **checkpoints** and **progress notifications**.

### Q2: How do I detect when an autonomous agent has started "wandering"?

- **Repeated identical tool calls**: the same tool called with the same arguments 3 or more times
- **Rapid cost increase**: exceeds twice the expected cost
- **Stalled progress**: more than 5 steps since the last successful task
- **Contradictory actions**: creating something and immediately deleting it

When detected, **automatically pause and ask the user for a decision** — this is the safe approach.

### Q3: What is the Reflexion pattern?

Reflexion is a pattern that explicitly models the "execute → fail → reflect → retry" cycle. Unlike ordinary retry logic, its key feature is that it **verbalizes the cause of failure, stores it in memory, and avoids making the same mistake in the next attempt**. It works well with feedback loops similar to test-driven development's "red → green" cycle.

### Q4: How detailed should the initial plan for an autonomous agent be?

It is recommended to create the initial plan at a **coarse granularity** and **refine** it just before each sub-goal is executed. Reasons:
- You can grasp the overall picture early
- You can adjust the detailed plan based on information obtained during execution
- Overly detailed plans are expensive to change

### Q5: How much of a memory system is necessary?

This varies by autonomy level:
- **L2 (semi-autonomous)**: Working memory alone is sufficient
- **L3 (conditional autonomy)**: Working memory + episodic memory
- **L4 (fully autonomous)**: All three layers (working + episodic + semantic)

### Q6: How do you coordinate multiple autonomous agents?

Combine with the multi-agent pattern (01-multi-agent.md). A typical configuration:
- **Orchestrator (L3)**: Overall planning and progress management
- **Worker agents (L2-L3)**: Execution of individual tasks
- **Review agent (L2)**: Checking deliverables

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work — especially during code reviews and architecture design.

---

## Summary

| Item | Content |
|------|---------|
| Core loop | Plan → Execute → Reflect → (Replan) |
| Goal decomposition | Hierarchically decompose into sub-goals/tasks (HTA) |
| Self-evaluation | Multi-perspective evaluation of completeness, quality, and room for improvement |
| Reflexion | Verbalize failures and apply them to the next attempt |
| Memory | Short-term (working), mid-term (episodic), long-term (semantic) |
| Replanning | Reflect learnings from failures in the next plan |
| HITL | Insert human approval at critical decision points |
| Guardrails | Step/cost/time limits + forbidden operations + PII detection |
| Wandering detection | Pattern detection for repetition/consecutive failures/contradictory actions |
| Cost optimization | Per-phase model selection + pre-execution cost estimation |

## Next Guides to Read

- [../02-implementation/03-claude-agent-sdk.md](../02-implementation/03-claude-agent-sdk.md) — Building autonomous agents with the Claude Agent SDK
- [../02-implementation/04-evaluation.md](../02-implementation/04-evaluation.md) — Agent evaluation techniques
- [../04-production/01-safety.md](../04-production/01-safety.md) — Safety and guardrails

## References

1. Shinn, N. et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (2023) — https://arxiv.org/abs/2303.11366
2. Yao, S. et al., "Tree of Thoughts: Deliberate Problem Solving with Large Language Models" (2023) — https://arxiv.org/abs/2305.10601
3. Wang, G. et al., "Voyager: An Open-Ended Embodied Agent with Large Language Models" (2023) — https://arxiv.org/abs/2305.16291
4. Park, J.S. et al., "Generative Agents: Interactive Simulacra of Human Behavior" (2023) — https://arxiv.org/abs/2304.03442
5. Anthropic, "Building effective agents" (2024) — https://docs.anthropic.com/en/docs/build-with-claude/agentic
