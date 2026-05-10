# Multi-Agent Systems

> Collaboration, delegation, debate — design patterns for multi-agent systems where multiple AI agents work as a team to accomplish complex tasks that are difficult to solve with a single agent.

## What You Will Learn

1. When to use each of the three major multi-agent patterns (collaborative, delegation, debate)
2. How to design inter-agent communication and task distribution
3. Techniques for debugging and optimizing multi-agent systems
4. Fault tolerance, cost management, and scaling strategies for production
5. Multi-agent configuration examples for real-world scenarios


## Prerequisites

Having the following knowledge before reading this guide will help you understand the material more deeply:

- Basic programming knowledge
- Understanding of relevant foundational concepts
- Familiarity with [Single Agent](./00-single-agent.md) content

---

## 1. Why Multi-Agent Systems Are Needed

```
Limitations of Single Agents

Problem: "Design, implement, test, and deploy a web application"

Single Agent:
  One LLM handles everything → lack of specialization, context overflow

Multi-Agent:
  [Architect] → Design
  [Coder]     → Implementation
  [Tester]    → Testing
  [DevOps]    → Deployment
  Each agent has specialized expertise and collaborates to complete the task
```

### 1.1 Benefits and Challenges of Multi-Agent Systems

```
Benefits                          Challenges
┌─────────────────────┐      ┌─────────────────────┐
│ Separation of        │      │ Communication        │
│ expertise            │      │ overhead             │
│ → Each agent focuses │      │ → Cost of message    │
│   on its specialty   │      │   exchange between   │
│                      │      │   agents             │
├─────────────────────┤      ├─────────────────────┤
│ Context management   │      │ Error propagation    │
│ → Each agent         │      │ → Risk that one      │
│   maintains its own  │      │   failure cascades   │
│   context            │      │   to the whole system│
├─────────────────────┤      ├─────────────────────┤
│ Parallel processing  │      │ Debugging complexity │
│ → Simultaneous       │      │ → Tracking           │
│   execution of       │      │   interactions among │
│   independent tasks  │      │   multiple agents    │
│   increases          │      │                      │
│   throughput         │      │                      │
├─────────────────────┤      ├─────────────────────┤
│ Scalability          │      │ Increased cost       │
│ → Easy to extend     │      │ → Number of API      │
│   functionality by   │      │   calls multiplies   │
│   adding agents      │      │   with agent count   │
└─────────────────────┘      └─────────────────────┘
```

### 1.2 Deciding When to Move from Single to Multi-Agent

```python
# Checker for determining whether to adopt multi-agent
from dataclasses import dataclass

@dataclass
class TaskComplexityAssessment:
    """Evaluate task complexity to determine whether multi-agent is needed"""
    task_description: str
    num_distinct_skills: int        # Number of distinct skill domains required
    num_steps: int                  # Estimated number of steps
    requires_parallel: bool         # Whether parallel processing is needed
    requires_debate: bool           # Whether multi-perspective review is needed
    context_window_risk: bool       # Risk of context overflow
    quality_critical: bool          # Whether quality is especially important

    @property
    def recommendation(self) -> str:
        score = 0
        if self.num_distinct_skills >= 3:
            score += 2
        elif self.num_distinct_skills >= 2:
            score += 1

        if self.num_steps > 20:
            score += 2
        elif self.num_steps > 10:
            score += 1

        if self.requires_parallel:
            score += 2
        if self.requires_debate:
            score += 1
        if self.context_window_risk:
            score += 2
        if self.quality_critical:
            score += 1

        if score >= 5:
            return "Multi-agent recommended"
        elif score >= 3:
            return "Consider multi-agent"
        else:
            return "Single agent is sufficient"

# Usage example
assessment = TaskComplexityAssessment(
    task_description="Full-stack web application development",
    num_distinct_skills=4,     # Design, frontend, backend, testing
    num_steps=30,
    requires_parallel=True,
    requires_debate=False,
    context_window_risk=True,
    quality_critical=True
)
print(assessment.recommendation)
# → "Multi-agent recommended"
```

---

## 2. The Three Major Multi-Agent Patterns

### 2.1 Overview of All Patterns

```
Multi-Agent Patterns

1. Collaborative
   [A] ←→ [B] ←→ [C]     Peers working together as equals

2. Delegation
   [Manager]                Superiors distribute tasks to subordinates
   ├── [Worker A]
   ├── [Worker B]
   └── [Worker C]

3. Debate
   [Proposer] → Proposal
   [Critic]   → Criticism   Different perspectives improve quality
   [Judge]    → Verdict
```

### 2.2 Collaborative Pattern

```python
# Collaborative pattern: agents process tasks in sequence
import anthropic
import json
import time
import logging
from typing import Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

@dataclass
class AgentMessage:
    """Message between agents"""
    sender: str
    receiver: str
    content: Any
    message_type: str = "task_result"
    timestamp: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)


class CollaborativeSystem:
    """Collaborative pattern: peer agents cooperate in a pipeline"""

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.agents: dict[str, dict] = {}
        self.pipeline: list[str] = []
        self.message_log: list[AgentMessage] = []
        self._total_tokens = 0

    def add_agent(self, name: str, role: str,
                  system_prompt: str = "",
                  model: str = "claude-sonnet-4-20250514",
                  tools: list = None):
        """Add an agent"""
        self.agents[name] = {
            "role": role,
            "system_prompt": system_prompt or f"You are a {role}.",
            "model": model,
            "tools": tools or []
        }

    def set_pipeline(self, pipeline: list[str]):
        """Set the processing pipeline order"""
        for name in pipeline:
            if name not in self.agents:
                raise ValueError(f"Agent '{name}' is not registered")
        self.pipeline = pipeline

    def run(self, task: str) -> dict:
        """Execute the pipeline"""
        result = task
        context = {
            "original_task": task,
            "intermediate_results": [],
            "start_time": time.time()
        }

        for i, agent_name in enumerate(self.pipeline):
            agent_info = self.agents[agent_name]
            logger.info(f"[{i+1}/{len(self.pipeline)}] Processing {agent_name}...")

            prompt = f"""
Your role: {agent_info['role']}

Original task: {context['original_task']}

{'Previous results:' if context['intermediate_results'] else ''}
{self._format_previous_results(context['intermediate_results'])}

Output from previous step:
{result}

Execute your assigned portion.
Output the result in a structured format that the next agent can understand.
"""
            response = self.client.messages.create(
                model=agent_info["model"],
                max_tokens=4096,
                system=agent_info["system_prompt"],
                messages=[{"role": "user", "content": prompt}]
            )

            result = response.content[0].text
            self._total_tokens += response.usage.input_tokens + response.usage.output_tokens

            # Record in message log
            msg = AgentMessage(
                sender=agent_name,
                receiver=self.pipeline[i + 1] if i + 1 < len(self.pipeline) else "output",
                content=result[:500],
                metadata={
                    "step": i + 1,
                    "tokens": response.usage.input_tokens + response.usage.output_tokens
                }
            )
            self.message_log.append(msg)

            context["intermediate_results"].append({
                "agent": agent_name,
                "role": agent_info["role"],
                "output": result[:1000]
            })

        elapsed = time.time() - context["start_time"]
        return {
            "result": result,
            "steps": len(self.pipeline),
            "total_tokens": self._total_tokens,
            "elapsed_seconds": round(elapsed, 2),
            "message_log": self.message_log
        }

    def _format_previous_results(self, results: list) -> str:
        if not results:
            return ""
        formatted = []
        for r in results[-3:]:  # Only the most recent 3
            formatted.append(f"[{r['agent']}({r['role']})]: {r['output'][:300]}")
        return "\n".join(formatted)


# Usage example
system = CollaborativeSystem()
system.add_agent(
    "researcher",
    role="Information Researcher",
    system_prompt="You are a skilled researcher. Collect facts from reliable sources and present them in a structured format."
)
system.add_agent(
    "analyst",
    role="Data Analyst",
    system_prompt="You are a data analyst. Discover patterns and trends from collected data and derive insights based on numbers."
)
system.add_agent(
    "writer",
    role="Report Writer",
    system_prompt="You are a business writer. Summarize analysis results into a readable report. Include an executive summary."
)
system.set_pipeline(["researcher", "analyst", "writer"])
report = system.run("Create a 2025 trend report for the AI market")
```

### 2.3 Delegation Pattern

```python
# Delegation pattern: manager distributes tasks to workers
import asyncio
from concurrent.futures import ThreadPoolExecutor

class DelegationSystem:
    """Delegation pattern: manager plans, workers execute"""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic()
        self.model = model
        self.workers: dict[str, dict] = {}
        self.manager_system_prompt = """
You are a project manager.
To achieve the given goal:
1. Break down tasks into appropriate granularity
2. Assign tasks considering each worker's expertise
3. Identify dependencies and determine execution order
4. Integrate worker results to create the final deliverable
"""

    def add_worker(self, name: str, skills: list[str],
                   system_prompt: str = "",
                   model: str = "claude-sonnet-4-20250514"):
        """Add a worker agent"""
        self.workers[name] = {
            "skills": skills,
            "system_prompt": system_prompt or f"You are a specialist in {', '.join(skills)}.",
            "model": model
        }

    def run(self, goal: str) -> dict:
        """Manager plans, workers execute"""
        start_time = time.time()

        # Step 1: Manager breaks down and assigns tasks
        plan = self._create_plan(goal)
        logger.info(f"Plan: {len(plan.get('assignments', []))} tasks")

        # Step 2: Execute tasks based on dependencies
        results = self._execute_plan(plan)

        # Step 3: Manager integrates results
        final = self._integrate_results(goal, results)

        elapsed = time.time() - start_time
        return {
            "result": final,
            "plan": plan,
            "worker_results": results,
            "elapsed_seconds": round(elapsed, 2)
        }

    def _create_plan(self, goal: str) -> dict:
        """Manager breaks down tasks and creates a plan"""
        worker_descriptions = "\n".join(
            f"- {name}: skills={w['skills']}"
            for name, w in self.workers.items()
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=self.manager_system_prompt,
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Available workers:
{worker_descriptions}

Output a plan to achieve this goal in JSON format.
Format:
{{
  "assignments": [
    {{
      "worker": "worker name",
      "task": "specific task content",
      "priority": 1,
      "depends_on": []
    }}
  ]
}}

Notes:
- depends_on is a list of indices (0-based) of tasks this depends on
- priority is 1 (high) to 3 (low)
- Tasks that can run in parallel should have an empty depends_on
"""}]
        )

        text = response.content[0].text
        # Extract JSON
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Fallback: assign evenly to each worker
            return {
                "assignments": [
                    {"worker": name, "task": goal, "priority": 1, "depends_on": []}
                    for name in self.workers
                ]
            }

    def _execute_plan(self, plan: dict) -> dict:
        """Execute tasks respecting dependencies"""
        assignments = plan.get("assignments", [])
        results = {}
        completed = set()

        # Sort by dependency order
        remaining = list(range(len(assignments)))

        while remaining:
            # Execute tasks whose dependencies are resolved
            executable = [
                i for i in remaining
                if all(d in completed for d in assignments[i].get("depends_on", []))
            ]

            if not executable:
                logger.error("Dependency deadlock detected")
                break

            # Execute all parallelizable tasks together
            for i in executable:
                assignment = assignments[i]
                worker_name = assignment["worker"]
                task = assignment["task"]

                if worker_name not in self.workers:
                    results[i] = {"error": f"Worker '{worker_name}' not found"}
                    completed.add(i)
                    remaining.remove(i)
                    continue

                worker = self.workers[worker_name]

                # Provide dependent task results as context
                dep_context = ""
                for dep_idx in assignment.get("depends_on", []):
                    if dep_idx in results:
                        dep_result = results[dep_idx]
                        dep_task = assignments[dep_idx]["task"]
                        dep_context += f"\n[Prerequisite task] {dep_task}\nResult: {str(dep_result)[:500]}\n"

                response = self.client.messages.create(
                    model=worker["model"],
                    max_tokens=4096,
                    system=worker["system_prompt"],
                    messages=[{"role": "user", "content": f"""
Task: {task}
{dep_context}
Execute the above task and output the result.
"""}]
                )

                results[i] = {
                    "worker": worker_name,
                    "task": task,
                    "result": response.content[0].text
                }
                completed.add(i)
                remaining.remove(i)

        return results

    def _integrate_results(self, goal: str, results: dict) -> str:
        """Manager integrates worker results"""
        results_text = ""
        for i, result in sorted(results.items()):
            if isinstance(result, dict):
                results_text += f"""
[{result.get('worker', 'unknown')}] Task: {result.get('task', 'N/A')}
Result:
{str(result.get('result', 'N/A'))[:1000]}
---
"""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=self.manager_system_prompt,
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Results from each worker:
{results_text}

Integrate the above results to create a comprehensive final deliverable for the goal.
If there are contradictions, point them out and perform the best integration.
"""}]
        )
        return response.content[0].text


# Usage example
delegation = DelegationSystem()
delegation.add_worker(
    "frontend_dev",
    skills=["React", "TypeScript", "CSS", "UI/UX"],
    system_prompt="You are a frontend engineer. You implement using React/TypeScript."
)
delegation.add_worker(
    "backend_dev",
    skills=["Python", "FastAPI", "PostgreSQL", "Redis"],
    system_prompt="You are a backend engineer. You implement using Python/FastAPI."
)
delegation.add_worker(
    "qa_engineer",
    skills=["Test design", "Pytest", "Playwright", "Load testing"],
    system_prompt="You are a QA engineer. You design tests and implement automated tests."
)

result = delegation.run("Implement user authentication (registration, login, password reset)")
```

### 2.4 Debate Pattern

```python
# Debate pattern: improve quality through multiple perspectives
class DebateSystem:
    """Improve answer quality through dialectical debate"""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.Anthropic()
        self.model = model
        self.max_rounds = 3
        self.debate_log: list[dict] = []

    def run(self, question: str) -> dict:
        """Improve quality through propose → critique → improve cycles"""
        proposal = None
        criticism = None

        for round_num in range(self.max_rounds):
            logger.info(f"Debate round {round_num + 1}/{self.max_rounds}")

            # Proposer presents answer/improvement
            if proposal is None:
                proposal = self._generate_proposal(question)
            else:
                proposal = self._improve_proposal(question, proposal, criticism)

            # Critic evaluates
            criticism = self._generate_criticism(question, proposal)

            # Record log
            self.debate_log.append({
                "round": round_num + 1,
                "proposal": proposal[:500],
                "criticism": criticism[:500]
            })

            # Judge determines if it is sufficient
            judgment = self._judge(question, proposal, criticism)

            if judgment["is_satisfactory"]:
                logger.info(f"Agreement reached in round {round_num + 1}")
                return {
                    "result": proposal,
                    "rounds": round_num + 1,
                    "confidence": judgment["confidence"],
                    "debate_log": self.debate_log
                }

        return {
            "result": proposal,
            "rounds": self.max_rounds,
            "confidence": "Max rounds reached",
            "debate_log": self.debate_log
        }

    def _generate_proposal(self, question: str) -> str:
        """Generate initial proposal"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system="You are an expert in problem solving. Present a logical and comprehensive answer. Clearly state your reasoning and include concrete examples.",
            messages=[{"role": "user", "content": f"Question: {question}\n\nPresent your best answer."}]
        )
        return response.content[0].text

    def _improve_proposal(self, question: str, proposal: str, criticism: str) -> str:
        """Improve the proposal based on criticism"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system="You are an expert in problem solving. Take criticism seriously and make concrete improvements.",
            messages=[{"role": "user", "content": f"""
Question: {question}

Previous proposal:
{proposal}

Criticism received:
{criticism}

Improve the proposal based on the criticism.
Clearly indicate the improvements and specifically show how you addressed the criticism.
"""}]
        )
        return response.content[0].text

    def _generate_criticism(self, question: str, proposal: str) -> str:
        """Generate criticism"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system="""You are an expert in critical thinking. Point out weaknesses in the proposal constructively.
Evaluate from the following perspectives:
1. Logical consistency
2. Factual accuracy
3. Overlooked perspectives
4. Feasibility
5. Risks and side effects""",
            messages=[{"role": "user", "content": f"""
Question: {question}
Proposal: {proposal}

Point out problems, logical flaws, and areas for improvement in this proposal.
Be constructive in your criticism.
"""}]
        )
        return response.content[0].text

    def _judge(self, question: str, proposal: str, criticism: str) -> dict:
        """Judge evaluates the quality"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=256,
            system="You are a fair judge. Evaluate the proposal and criticism objectively.",
            messages=[{"role": "user", "content": f"""
Question: {question}
Proposal: {proposal[:1000]}
Criticism: {criticism[:1000]}

Evaluate in the following format:
Verdict: [PASS/FAIL]
Confidence: [High/Medium/Low]
Reason: [in one line]
"""}]
        )

        text = response.content[0].text
        is_pass = "PASS" in text.upper()
        confidence = "High" if "High" in text else ("Medium" if "Medium" in text else "Low")

        return {
            "is_satisfactory": is_pass,
            "confidence": confidence,
            "raw_judgment": text
        }
```

### 2.5 Hybrid Pattern

```python
# Hybrid of delegation + debate
class HybridSystem:
    """Incorporates the debate pattern into each stage of the delegation pattern"""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.delegation = DelegationSystem(model)
        self.debate = DebateSystem(model)
        self.client = anthropic.Anthropic()
        self.model = model

    def run(self, goal: str, critical_steps: list[int] = None) -> dict:
        """Distribute with delegation, ensure quality on critical steps with debate"""
        # Step 1: Plan formulation (scrutinize plan with debate)
        plan_proposal = self.delegation._create_plan(goal)

        # Validate the plan itself through debate
        plan_question = f"Is the following plan appropriate for achieving the goal '{goal}'?\nPlan: {json.dumps(plan_proposal, ensure_ascii=False)}"
        plan_review = self.debate.run(plan_question)

        # Step 2: Execute each task
        results = self.delegation._execute_plan(plan_proposal)

        # Step 3: Scrutinize results of critical steps with debate
        if critical_steps:
            for step_idx in critical_steps:
                if step_idx in results:
                    step_result = results[step_idx]
                    review_question = (
                        f"Is the quality of the following task result sufficient?\n"
                        f"Task: {step_result.get('task', 'N/A')}\n"
                        f"Result: {str(step_result.get('result', ''))[:2000]}"
                    )
                    review = self.debate.run(review_question)
                    results[step_idx]["quality_review"] = review

        # Step 4: Integrate results
        final = self.delegation._integrate_results(goal, results)

        return {
            "result": final,
            "plan": plan_proposal,
            "plan_review": plan_review,
            "worker_results": results
        }
```

---

## 3. Inter-Agent Communication

### 3.1 Communication Patterns

```
Communication Patterns

1. Direct
   [A] ──message──> [B]

2. Broadcast
   [A] ──message──> [B]
       ──message──> [C]
       ──message──> [D]

3. Blackboard
   [A] ──write──> +----------+ <──read── [B]
                  | Shared    |
   [C] ──write──> | Memory   | <──read── [D]
                  +----------+

4. Message Queue
   [A] ──push──> [Queue] ──pop──> [B]

5. Publish/Subscribe (Pub/Sub)
   [A] ──publish "topic.x"──> [Bus] ──> [B] (subscribed: topic.x)
                                    ──> [C] (subscribed: topic.*)
```

### 3.2 Shared Memory Pattern

```python
# Blackboard (shared memory) pattern
from threading import Lock
from typing import Any

class Blackboard:
    """Shared memory between agents"""

    def __init__(self):
        self._data: dict[str, Any] = {}
        self._lock = Lock()
        self._history: list[dict] = []
        self._subscribers: dict[str, list[callable]] = {}

    def write(self, agent_name: str, key: str, value: Any):
        """Write data and notify subscribers"""
        with self._lock:
            self._data[key] = value
            self._history.append({
                "agent": agent_name,
                "action": "write",
                "key": key,
                "timestamp": time.time()
            })

        # Notify subscribers
        for pattern, callbacks in self._subscribers.items():
            if self._match_pattern(pattern, key):
                for callback in callbacks:
                    callback(agent_name, key, value)

    def read(self, key: str) -> Any:
        with self._lock:
            return self._data.get(key)

    def read_many(self, keys: list[str]) -> dict:
        """Read multiple keys at once"""
        with self._lock:
            return {k: self._data.get(k) for k in keys}

    def get_all(self) -> dict:
        with self._lock:
            return self._data.copy()

    def subscribe(self, key_pattern: str, callback: callable):
        """Subscription for a key pattern"""
        if key_pattern not in self._subscribers:
            self._subscribers[key_pattern] = []
        self._subscribers[key_pattern].append(callback)

    def get_updates_since(self, timestamp: float) -> list:
        """Get updates since the specified time"""
        return [h for h in self._history if h["timestamp"] > timestamp]

    def get_agent_contributions(self, agent_name: str) -> list:
        """Write history for a specific agent"""
        return [h for h in self._history if h["agent"] == agent_name]

    def _match_pattern(self, pattern: str, key: str) -> bool:
        """Simple pattern matching (* is wildcard)"""
        if pattern == "*":
            return True
        if pattern.endswith("*"):
            return key.startswith(pattern[:-1])
        return pattern == key

    def summary(self) -> dict:
        """Status summary of the blackboard"""
        return {
            "total_entries": len(self._data),
            "total_writes": len(self._history),
            "agents_involved": list(set(h["agent"] for h in self._history)),
            "keys": list(self._data.keys())
        }


# Multi-agent system using a blackboard
class BlackboardMultiAgent:
    """Blackboard-based multi-agent system"""

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.board = Blackboard()
        self.agents: dict[str, dict] = {}

    def add_agent(self, name: str, role: str,
                  watches: list[str] = None,
                  produces: list[str] = None):
        """Add an agent"""
        self.agents[name] = {
            "role": role,
            "watches": watches or [],
            "produces": produces or []
        }

    def run(self, goal: str, max_iterations: int = 10) -> dict:
        """Agents collaborate through the blackboard"""
        self.board.write("system", "goal", goal)
        self.board.write("system", "status", "running")

        for iteration in range(max_iterations):
            any_progress = False

            for name, agent_info in self.agents.items():
                # Get the values of keys the agent is watching
                watched_data = {}
                for key in agent_info["watches"]:
                    value = self.board.read(key)
                    if value is not None:
                        watched_data[key] = value

                # Skip if required data is not available
                if not watched_data:
                    continue

                # Check if the agent has already produced its results
                already_done = all(
                    self.board.read(k) is not None
                    for k in agent_info["produces"]
                )
                if already_done:
                    continue

                # Execute the agent
                result = self._run_agent(name, agent_info, watched_data, goal)

                # Write results to the blackboard
                for key in agent_info["produces"]:
                    if key in result:
                        self.board.write(name, key, result[key])
                        any_progress = True

            if not any_progress:
                break

        self.board.write("system", "status", "completed")
        return {
            "result": self.board.get_all(),
            "iterations": iteration + 1,
            "board_summary": self.board.summary()
        }

    def _run_agent(self, name: str, agent_info: dict,
                   watched_data: dict, goal: str) -> dict:
        """Execute an individual agent"""
        context = json.dumps(watched_data, ensure_ascii=False, default=str)[:3000]

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=f"You are a {agent_info['role']}.",
            messages=[{"role": "user", "content": f"""
Goal: {goal}

Available data:
{context}

Your output keys: {agent_info['produces']}

Output your deliverables in JSON format.
Use the output keys listed above.
"""}]
        )

        text = response.content[0].text
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            return json.loads(text)
        except json.JSONDecodeError:
            return {agent_info["produces"][0]: text if agent_info["produces"] else "result"}
```

### 3.3 Message Queue Pattern

```python
from collections import deque
from threading import Lock, Event
from typing import Optional

class MessageQueue:
    """Priority message queue"""

    def __init__(self, max_size: int = 1000):
        self._queue: deque[AgentMessage] = deque(maxlen=max_size)
        self._lock = Lock()
        self._not_empty = Event()
        self._processed: list[AgentMessage] = []

    def push(self, message: AgentMessage, priority: int = 0):
        """Add a message (priority: 0=normal, 1=high, 2=urgent)"""
        with self._lock:
            if priority >= 2:
                self._queue.appendleft(message)  # Insert at front
            else:
                self._queue.append(message)
            self._not_empty.set()

    def pop(self, receiver: Optional[str] = None,
            timeout: float = None) -> Optional[AgentMessage]:
        """Retrieve a message (can filter by receiver)"""
        with self._lock:
            if receiver:
                # Search for messages for a specific receiver
                for i, msg in enumerate(self._queue):
                    if msg.receiver == receiver:
                        del self._queue[i]
                        self._processed.append(msg)
                        return msg
                return None
            elif self._queue:
                msg = self._queue.popleft()
                self._processed.append(msg)
                return msg
            return None

    def pending_count(self, receiver: Optional[str] = None) -> int:
        """Number of unprocessed messages"""
        with self._lock:
            if receiver:
                return sum(1 for m in self._queue if m.receiver == receiver)
            return len(self._queue)

    def stats(self) -> dict:
        """Queue statistics"""
        return {
            "pending": len(self._queue),
            "processed": len(self._processed),
            "senders": list(set(m.sender for m in self._processed)),
            "receivers": list(set(m.receiver for m in self._processed))
        }


class QueueBasedMultiAgent:
    """Message queue-based multi-agent system"""

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.queue = MessageQueue()
        self.agents: dict[str, dict] = {}
        self.results: dict[str, list] = {}

    def add_agent(self, name: str, role: str, handles: list[str]):
        """Add an agent
        handles: list of message types to process
        """
        self.agents[name] = {
            "role": role,
            "handles": handles
        }
        self.results[name] = []

    def send_message(self, sender: str, receiver: str,
                     content: Any, message_type: str = "task"):
        """Send a message"""
        msg = AgentMessage(
            sender=sender,
            receiver=receiver,
            content=content,
            message_type=message_type
        )
        self.queue.push(msg)

    def process_messages(self, max_cycles: int = 20) -> dict:
        """Process all messages"""
        for cycle in range(max_cycles):
            if self.queue.pending_count() == 0:
                break

            for name, agent_info in self.agents.items():
                msg = self.queue.pop(receiver=name)
                if msg and msg.message_type in agent_info["handles"]:
                    result = self._process_message(name, agent_info, msg)
                    self.results[name].append({
                        "message": msg,
                        "result": result
                    })

        return {
            "results": self.results,
            "queue_stats": self.queue.stats(),
            "cycles": cycle + 1
        }

    def _process_message(self, agent_name: str, agent_info: dict,
                         message: AgentMessage) -> str:
        """Agent processes a message"""
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=f"You are a {agent_info['role']}.",
            messages=[{"role": "user", "content": f"""
Sender: {message.sender}
Message type: {message.message_type}
Content: {message.content}

Process this message appropriately based on your role.
"""}]
        )
        return response.content[0].text
```

---

## 4. Pattern Comparison

### 4.1 Comparison of the Three Major Patterns

| Aspect | Collaborative | Delegation | Debate |
|--------|--------------|------------|--------|
| Structure | Flat (peer) | Hierarchical (top-down) | Adversarial (dialectical) |
| Communication | Pipeline / shared | Top → bottom → top | Cyclic |
| Use case | Clear process stages | Decomposable tasks | Quality improvement is important |
| Scalability | Medium | High | Low |
| Cost | Medium | Medium-High | High |
| Debuggability | High | Medium | Low |
| Fault tolerance | Low (serial) | Medium (parallelizable) | Medium |
| Quality assurance | Verified at each stage | Verified at integration | Improved through iteration |
| Representative framework | LangGraph | CrewAI | AutoGen |

### 4.2 Recommended Patterns by Task Type

| Task | Recommended Pattern | Reason |
|------|--------------------|----|
| Software development | Delegation | Division of design → implementation → testing |
| Research report | Collaborative | Pipeline of research → analysis → writing |
| Code review | Debate | Quality check from multiple perspectives |
| Data analysis | Delegation | Parallel distribution of analysis tasks |
| Decision support | Debate | Consideration of both sides of arguments |
| Customer support | Delegation | Routing + specialized handling |
| Security audit | Hybrid | Delegation for distribution, debate for scrutiny |
| Content creation | Collaborative | Serial flow of planning → production → proofreading |
| Translation quality assurance | Debate | Comparative review by multiple translators |

### 4.3 Communication Pattern Comparison

| Communication method | Latency | Scalability | Implementation complexity | Use case |
|---------------------|---------|-------------|--------------------------|---------|
| Direct | Lowest | Low | Lowest | 2–3 agents |
| Blackboard | Low | Medium | Medium | Shared state required |
| Message queue | Medium | High | Medium | Asynchronous processing |
| Pub/Sub | Medium | Highest | High | Event-driven |
| Broadcast | High | Low | Low | Notification to all |

---

## 5. Framework Implementations

### 5.1 Multi-Agent with CrewAI

```python
# Full-featured multi-agent system using CrewAI
from crewai import Agent, Task, Crew, Process

# Agent definitions
product_manager = Agent(
    role="Product Manager",
    goal="Define feature specifications based on user needs",
    backstory="PM with 7 years of experience at SaaS companies. Expert in user research and data-driven decision making.",
    llm="claude-sonnet-4-20250514"
)

architect = Agent(
    role="Software Architect",
    goal="Design scalable and maintainable systems",
    backstory="10 years designing large-scale distributed systems. Expert in microservices and cloud-native architectures.",
    llm="claude-sonnet-4-20250514"
)

developer = Agent(
    role="Senior Developer",
    goal="Implement high-quality code based on the design",
    backstory="Full-stack engineer. Proficient in Python/TypeScript/Go. TDD practitioner.",
    llm="claude-sonnet-4-20250514",
    tools=[code_tool, test_tool]
)

# Task definitions
spec_task = Task(
    description="Define requirements for the user authentication feature",
    expected_output="Feature specification (use cases, screen transitions, API specs)",
    agent=product_manager
)

design_task = Task(
    description="Design the system for the authentication feature",
    expected_output="Design document (architecture diagram, DB design, API design)",
    agent=architect,
    context=[spec_task]
)

impl_task = Task(
    description="Implement the authentication API based on the design",
    expected_output="Implementation code (including tests)",
    agent=developer,
    context=[design_task]
)

# Execution
crew = Crew(
    agents=[product_manager, architect, developer],
    tasks=[spec_task, design_task, impl_task],
    process=Process.sequential,
    verbose=True
)

result = crew.kickoff()
```

### 5.2 Multi-Agent with LangGraph

```python
# Graph-based multi-agent system using LangGraph
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class TeamState(TypedDict):
    """Shared state for the entire team"""
    task: str
    plan: list[str]
    research: str
    draft: str
    review: str
    final: str
    messages: Annotated[list[str], operator.add]  # Accumulating
    current_agent: str
    iteration: int

def planner_node(state: TeamState) -> dict:
    """Planner node: decompose the task"""
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system="You are a project planner.",
        messages=[{"role": "user", "content": f"""
Task: {state['task']}
Break this task down into 3–5 steps.
Output as a numbered list:
"""}]
    )
    plan_text = response.content[0].text
    steps = [line.strip() for line in plan_text.split("\n")
             if line.strip() and line.strip()[0].isdigit()]
    return {
        "plan": steps,
        "messages": [f"[Planner] Created a plan with {len(steps)} steps"],
        "current_agent": "researcher"
    }

def researcher_node(state: TeamState) -> dict:
    """Researcher node: gather information"""
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system="You are a researcher. Collect fact-based information.",
        messages=[{"role": "user", "content": f"""
Task: {state['task']}
Plan: {state['plan']}

Research the necessary information based on the above plan.
"""}]
    )
    return {
        "research": response.content[0].text,
        "messages": [f"[Researcher] Research complete"],
        "current_agent": "writer"
    }

def writer_node(state: TeamState) -> dict:
    """Writer node: create draft"""
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system="You are a professional writer.",
        messages=[{"role": "user", "content": f"""
Task: {state['task']}
Research results: {state['research'][:2000]}
{'Review comments: ' + state['review'] if state.get('review') else ''}

Create a draft based on the above.
"""}]
    )
    return {
        "draft": response.content[0].text,
        "messages": [f"[Writer] Draft creation complete"],
        "current_agent": "reviewer"
    }

def reviewer_node(state: TeamState) -> dict:
    """Reviewer node: quality check"""
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system="You are a quality reviewer. Provide constructive feedback.",
        messages=[{"role": "user", "content": f"""
Task: {state['task']}
Draft: {state['draft'][:2000]}

Evaluate the quality and respond in the following format:
Quality: [Pass/Needs improvement]
Feedback: [specific improvements]
"""}]
    )
    review = response.content[0].text
    return {
        "review": review,
        "messages": [f"[Reviewer] Review complete"],
        "iteration": state.get("iteration", 0) + 1
    }

def should_continue(state: TeamState) -> str:
    """Determine flow based on review result"""
    if state.get("iteration", 0) >= 3:
        return "finalize"
    if state.get("review") and "Pass" in state["review"]:
        return "finalize"
    return "revise"

def finalize_node(state: TeamState) -> dict:
    """Finalization node"""
    return {
        "final": state.get("draft", ""),
        "messages": [f"[System] Finalization complete ({state.get('iteration', 0)} iterations)"]
    }

# Build graph
workflow = StateGraph(TeamState)

workflow.add_node("planner", planner_node)
workflow.add_node("researcher", researcher_node)
workflow.add_node("writer", writer_node)
workflow.add_node("reviewer", reviewer_node)
workflow.add_node("finalizer", finalize_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "researcher")
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer", "reviewer")
workflow.add_conditional_edges(
    "reviewer",
    should_continue,
    {"revise": "writer", "finalize": "finalizer"}
)
workflow.add_edge("finalizer", END)

# Compile and run
app = workflow.compile()
result = app.invoke({
    "task": "Create a report on the future of AI agents",
    "plan": [],
    "research": "",
    "draft": "",
    "review": "",
    "final": "",
    "messages": [],
    "current_agent": "planner",
    "iteration": 0
})
```

---

## 6. Fault Tolerance Design

### 6.1 Handling Agent Failures

```python
class ResilientMultiAgent:
    """Multi-agent system with fault tolerance"""

    def __init__(self):
        self.client = anthropic.Anthropic()
        self.agents: dict[str, dict] = {}
        self.fallback_agents: dict[str, str] = {}  # agent → fallback_agent

    def add_agent(self, name: str, role: str,
                  fallback: Optional[str] = None,
                  max_retries: int = 3):
        """Add an agent with a fallback"""
        self.agents[name] = {
            "role": role,
            "max_retries": max_retries
        }
        if fallback:
            self.fallback_agents[name] = fallback

    def execute_agent(self, name: str, task: str,
                      context: dict = None) -> dict:
        """Execute an agent with fault tolerance"""
        agent = self.agents.get(name)
        if not agent:
            return {"error": f"Agent '{name}' not found"}

        # Retry logic
        for attempt in range(agent["max_retries"]):
            try:
                result = self._call_agent(name, agent, task, context)
                if result and "error" not in result:
                    return result
            except Exception as e:
                logger.warning(
                    f"{name} failed ({attempt + 1}/{agent['max_retries']}): {e}"
                )
                if attempt < agent["max_retries"] - 1:
                    time.sleep(2 ** attempt)

        # Try fallback agent
        fallback_name = self.fallback_agents.get(name)
        if fallback_name and fallback_name in self.agents:
            logger.info(f"Falling back from {name} to {fallback_name}")
            return self.execute_agent(fallback_name, task, context)

        return {
            "error": f"{name} failed after {agent['max_retries']} attempts",
            "partial_result": "No fallback available"
        }

    def _call_agent(self, name: str, agent: dict,
                    task: str, context: dict = None) -> dict:
        """Call an agent"""
        context_text = json.dumps(context or {}, ensure_ascii=False, default=str)[:2000]

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=f"You are a {agent['role']}.",
            messages=[{"role": "user", "content": f"""
Task: {task}
Context: {context_text}

Execute the task and output the result.
"""}]
        )
        return {
            "agent": name,
            "result": response.content[0].text
        }
```

### 6.2 Timeouts and Circuit Breakers

```python
from enum import Enum
from collections import deque

class CircuitState(Enum):
    CLOSED = "closed"       # Normal
    OPEN = "open"           # Failing (requests blocked)
    HALF_OPEN = "half_open" # Recovery testing

class CircuitBreaker:
    """Circuit breaker: blocks requests when consecutive failures occur"""

    def __init__(self, failure_threshold: int = 5,
                 recovery_timeout: float = 60.0,
                 half_open_max: int = 3):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max = half_open_max
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0
        self._half_open_successes = 0

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure_time > self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_successes = 0
        return self._state

    def allow_request(self) -> bool:
        """Whether to allow a request"""
        state = self.state
        if state == CircuitState.CLOSED:
            return True
        elif state == CircuitState.HALF_OPEN:
            return True
        else:  # OPEN
            return False

    def record_success(self):
        """Record a success"""
        if self._state == CircuitState.HALF_OPEN:
            self._half_open_successes += 1
            if self._half_open_successes >= self.half_open_max:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
        else:
            self._failure_count = 0

    def record_failure(self):
        """Record a failure"""
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
            logger.warning(f"Circuit breaker OPEN: {self._failure_count} consecutive failures")


class ProtectedAgent:
    """Agent with circuit breaker"""

    def __init__(self, name: str, role: str):
        self.client = anthropic.Anthropic()
        self.name = name
        self.role = role
        self.circuit = CircuitBreaker()

    def execute(self, task: str) -> dict:
        """Execute with circuit breaker"""
        if not self.circuit.allow_request():
            return {
                "error": f"{self.name} is temporarily suspended by circuit breaker",
                "circuit_state": self.circuit.state.value,
                "retry_after": self.circuit.recovery_timeout
            }

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=f"You are a {self.role}.",
                messages=[{"role": "user", "content": task}]
            )
            self.circuit.record_success()
            return {"agent": self.name, "result": response.content[0].text}
        except Exception as e:
            self.circuit.record_failure()
            return {"error": str(e), "circuit_state": self.circuit.state.value}
```

---

## 7. Cost Management and Monitoring

### 7.1 Cost Tracking for Multi-Agent Systems

```python
class MultiAgentCostTracker:
    """Cost tracking for multi-agent systems"""

    PRICING = {
        "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
        "claude-haiku-4-20250514": {"input": 0.25, "output": 1.25},
    }

    def __init__(self, budget_usd: float = 10.0):
        self.budget = budget_usd
        self.agent_costs: dict[str, float] = {}
        self._records: list[dict] = []

    def record(self, agent_name: str, model: str,
               input_tokens: int, output_tokens: int):
        """Record an API call"""
        pricing = self.PRICING.get(model, {"input": 0, "output": 0})
        cost = (input_tokens * pricing["input"] +
                output_tokens * pricing["output"]) / 1_000_000

        self.agent_costs[agent_name] = \
            self.agent_costs.get(agent_name, 0) + cost

        self._records.append({
            "agent": agent_name,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": cost,
            "timestamp": time.time()
        })

    @property
    def total_cost(self) -> float:
        return sum(self.agent_costs.values())

    @property
    def remaining_budget(self) -> float:
        return self.budget - self.total_cost

    def is_within_budget(self) -> bool:
        return self.total_cost < self.budget

    def cost_report(self) -> dict:
        """Cost report"""
        return {
            "total_cost_usd": round(self.total_cost, 4),
            "budget_usd": self.budget,
            "remaining_usd": round(self.remaining_budget, 4),
            "utilization": f"{self.total_cost / self.budget:.1%}",
            "agent_breakdown": {
                name: {
                    "cost_usd": round(cost, 4),
                    "share": f"{cost / self.total_cost:.1%}" if self.total_cost > 0 else "0%"
                }
                for name, cost in sorted(
                    self.agent_costs.items(),
                    key=lambda x: x[1],
                    reverse=True
                )
            },
            "total_api_calls": len(self._records)
        }

    def cost_optimization_suggestions(self) -> list[str]:
        """Cost optimization suggestions"""
        suggestions = []

        # Identify the most costly agent
        if self.agent_costs:
            max_agent = max(self.agent_costs, key=self.agent_costs.get)
            max_cost = self.agent_costs[max_agent]
            if max_cost > self.total_cost * 0.5:
                suggestions.append(
                    f"{max_agent} accounts for {max_cost/self.total_cost:.0%} of total cost. "
                    f"Consider switching to the Haiku model."
                )

        # High Sonnet usage rate
        sonnet_calls = sum(1 for r in self._records if "sonnet" in r["model"])
        if sonnet_calls > len(self._records) * 0.8:
            suggestions.append(
                "More than 80% of API calls use Sonnet. "
                "Switching simple tasks (classification, summarization) to Haiku "
                "can reduce costs by more than 10x."
            )

        # Encourage caching
        suggestions.append(
            "Introducing caching for API calls with the same input pattern "
            "can reduce duplicate costs."
        )

        return suggestions
```

### 7.2 Execution Monitoring

```python
class MultiAgentMonitor:
    """Monitoring for multi-agent systems"""

    def __init__(self):
        self._events: list[dict] = []
        self._agent_metrics: dict[str, dict] = {}

    def record_event(self, agent_name: str, event_type: str,
                     details: dict = None):
        """Record an event"""
        event = {
            "agent": agent_name,
            "type": event_type,
            "timestamp": time.time(),
            "details": details or {}
        }
        self._events.append(event)

        # Update agent metrics
        if agent_name not in self._agent_metrics:
            self._agent_metrics[agent_name] = {
                "total_calls": 0,
                "successes": 0,
                "failures": 0,
                "total_time_ms": 0
            }
        metrics = self._agent_metrics[agent_name]
        metrics["total_calls"] += 1
        if event_type == "success":
            metrics["successes"] += 1
        elif event_type == "failure":
            metrics["failures"] += 1
        if "elapsed_ms" in (details or {}):
            metrics["total_time_ms"] += details["elapsed_ms"]

    def dashboard(self) -> dict:
        """Dashboard data"""
        return {
            "total_events": len(self._events),
            "agents": {
                name: {
                    **metrics,
                    "success_rate": f"{metrics['successes'] / metrics['total_calls']:.1%}"
                                    if metrics['total_calls'] > 0 else "N/A",
                    "avg_time_ms": round(
                        metrics['total_time_ms'] / metrics['total_calls'], 1
                    ) if metrics['total_calls'] > 0 else 0
                }
                for name, metrics in self._agent_metrics.items()
            },
            "recent_events": self._events[-10:]
        }

    def bottleneck_analysis(self) -> dict:
        """Bottleneck analysis"""
        if not self._agent_metrics:
            return {"message": "No data"}

        # Slowest agent
        slowest = max(
            self._agent_metrics.items(),
            key=lambda x: x[1]["total_time_ms"] / max(x[1]["total_calls"], 1)
        )

        # Agent with the most failures
        most_failures = max(
            self._agent_metrics.items(),
            key=lambda x: x[1]["failures"]
        )

        return {
            "slowest_agent": {
                "name": slowest[0],
                "avg_time_ms": round(
                    slowest[1]["total_time_ms"] / max(slowest[1]["total_calls"], 1), 1
                )
            },
            "most_failing_agent": {
                "name": most_failures[0],
                "failure_count": most_failures[1]["failures"]
            }
        }
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Agent Count Explosion

```python
# Bad: Creating more agents than necessary
crew = Crew(agents=[
    Agent(role="Researcher", ...),
    Agent(role="Data collector", ...),       # Overlaps with Researcher
    Agent(role="Information analyst", ...),  # Overlaps with Researcher
    Agent(role="Writer", ...),
    Agent(role="Editor", ...),               # Overlaps with Writer
    Agent(role="Proofreader", ...),          # Overlaps with Editor
    Agent(role="Designer", ...),
    Agent(role="Reviewer", ...),
])  # 8 agents = high cost + increased coordination overhead

# Good: Minimum necessary agents
crew = Crew(agents=[
    Agent(role="Researcher", ...),           # Research + data collection
    Agent(role="Writer/Editor", ...),        # Writing + proofreading
    Agent(role="Reviewer", ...),             # Quality check
])  # 3 agents = appropriate granularity
```

### Anti-Pattern 2: Infinite Debate Loops

```python
# Bad: Debate with no termination condition
while True:
    proposal = proposer.generate(...)
    criticism = critic.generate(...)
    # Could continue forever

# Good: Maximum rounds + consensus judgment
for round in range(max_rounds := 3):
    proposal = proposer.generate(...)
    criticism = critic.generate(...)
    if judge.is_satisfactory(proposal, criticism):
        break
```

### Anti-Pattern 3: Implicit Dependencies Between Agents

```python
# Bad: Implicit communication via global variables
global_state = {}

def agent_a():
    global_state["result_a"] = "..."  # Unclear where this is referenced

def agent_b():
    data = global_state["result_a"]  # Assumes agent_a ran first

# Good: Explicitly define dependencies
class ExplicitDependency:
    def run(self):
        result_a = self.agent_a.execute(task)
        result_b = self.agent_b.execute(task, depends_on={"a": result_a})
        return self.integrate(result_a, result_b)
```

### Anti-Pattern 4: Insufficient Error Propagation

```python
# Bad: Swallow errors and pass to the next agent
def pipeline(task):
    result_a = agent_a.run(task)  # Might be an error
    result_b = agent_b.run(result_a)  # Cascading failure from invalid input
    return result_b

# Good: Error checking and fallback
def pipeline_safe(task):
    result_a = agent_a.run(task)
    if result_a.get("error"):
        logger.error(f"Agent A failed: {result_a['error']}")
        result_a = fallback_agent.run(task)  # Fallback

    result_b = agent_b.run(result_a["result"])
    if result_b.get("error"):
        return {
            "error": "Pipeline failed",
            "failed_at": "agent_b",
            "partial_result": result_a
        }
    return result_b
```

---

## 9. Testing Strategy

### 9.1 Test Pyramid for Multi-Agent Systems

```
Test Pyramid

          /\
         /  \
        / E2E \          Full pipeline tests (few)
       /------\
      / Integration \    2–3 agent collaboration tests (moderate)
     /----------\
    / Unit tests  \      Individual agent tests (many)
   /--------------\
```

```python
import pytest
from unittest.mock import MagicMock, patch

class TestCollaborativeSystem:
    """Tests for the collaborative pattern"""

    def test_pipeline_order(self):
        """Verify that the pipeline executes in the correct order"""
        system = CollaborativeSystem()
        execution_order = []

        # Add mock agents
        for name in ["a", "b", "c"]:
            system.add_agent(name, role=f"Agent {name}")
        system.set_pipeline(["a", "b", "c"])

        with patch.object(system.client.messages, 'create') as mock:
            mock.return_value = MagicMock(
                content=[MagicMock(text="result")],
                usage=MagicMock(input_tokens=100, output_tokens=50)
            )
            result = system.run("test task")

        assert len(system.message_log) == 3
        assert system.message_log[0].sender == "a"
        assert system.message_log[1].sender == "b"
        assert system.message_log[2].sender == "c"

    def test_context_propagation(self):
        """Verify that context is correctly propagated"""
        system = CollaborativeSystem()
        system.add_agent("first", role="First")
        system.add_agent("second", role="Second")
        system.set_pipeline(["first", "second"])

        call_args = []

        def capture_call(*args, **kwargs):
            call_args.append(kwargs)
            return MagicMock(
                content=[MagicMock(text="first_result")],
                usage=MagicMock(input_tokens=100, output_tokens=50)
            )

        with patch.object(system.client.messages, 'create', side_effect=capture_call):
            system.run("test task")

        # Check that the second agent received the first agent's result
        second_prompt = call_args[1]["messages"][0]["content"]
        assert "first_result" in second_prompt

class TestDebateSystem:
    """Tests for the debate pattern"""

    def test_max_rounds(self):
        """Verify that it stops at the maximum number of rounds"""
        system = DebateSystem()
        system.max_rounds = 2

        with patch.object(system.client.messages, 'create') as mock:
            # Always return a FAIL verdict
            mock.return_value = MagicMock(
                content=[MagicMock(text="Verdict: FAIL\nConfidence: Low\nReason: Insufficient")]
            )
            result = system.run("test question")

        assert result["rounds"] == 2

    def test_early_termination(self):
        """Verify that it terminates early when consensus is reached"""
        system = DebateSystem()
        system.max_rounds = 5

        call_count = 0
        def mock_response(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if "fair judge" in kwargs.get("system", ""):
                return MagicMock(
                    content=[MagicMock(text="Verdict: PASS\nConfidence: High\nReason: Sufficient")]
                )
            return MagicMock(
                content=[MagicMock(text="Test answer")]
            )

        with patch.object(system.client.messages, 'create', side_effect=mock_response):
            result = system.run("test question")

        assert result["rounds"] == 1  # Consensus in 1 round
```

---

## 10. FAQ

### Q1: How much does a multi-agent system cost?

Cost increases as: number of agents x number of steps x tokens per call. For example, if 3 agents each execute 5 steps, it costs roughly **3x** more in API costs compared to a single agent running 5 steps. Inter-agent communication overhead is added on top.

Cost reduction approaches:
- Use the Haiku model for simple routing and classification
- Leverage result caching
- Minimize unnecessary inter-agent communication
- Batch tasks that can be processed together

### Q2: How do you resolve contradictions between agents?

There are three approaches:
1. **Majority vote**: Determine results by voting among multiple agents
2. **Judge agent**: A dedicated judge decides which side is correct
3. **Human intervention**: Delegate important decisions to humans (Human-in-the-Loop)

### Q3: How do you test multi-agent systems?

- **Unit tests**: Test each agent individually (specific input → expected output)
- **Integration tests**: Test collaboration between 2–3 agents
- **E2E tests**: Execute the full pipeline (using a golden dataset)
- **Fault injection tests**: Verify fallback behavior when one agent fails

### Q4: What is the optimal number of agents?

As a rule of thumb:
- **2–3 agents**: Appropriate for most tasks
- **4–5 agents**: Large-scale projects (software development, etc.)
- **6+ agents**: Rarely needed (complex simulations, etc.)

Enriching each agent's toolset is often more effective than increasing the number of agents.

### Q5: Should I choose asynchronous or synchronous execution?

| Condition | Recommendation |
|-----------|---------------|
| Tasks have dependencies | Synchronous (sequential execution) |
| Multiple independent tasks | Asynchronous (parallel execution) |
| Strict latency requirements | Asynchronous |
| Debugging is important | Synchronous |
| Resource constraints | Synchronous |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Description |
|------|-------------|
| Collaborative pattern | Peer agents process in a pipeline |
| Delegation pattern | Manager distributes tasks to workers |
| Debate pattern | Dialectical improvement via proposal → criticism → verdict |
| Hybrid | Combines delegation + debate for both quality and efficiency |
| Communication methods | Direct / Blackboard / Message queue / Pub/Sub |
| Fault tolerance | Retry / Fallback / Circuit breaker |
| Cost management | Per-agent cost tracking + model selection |
| Design principle | Maximum effect with the minimum number of agents |

## What to Read Next

- [02-workflow-agents.md](./02-workflow-agents.md) -- Designing workflow agents
- [03-autonomous-agents.md](./03-autonomous-agents.md) -- Planning and execution for autonomous agents
- [../02-implementation/01-langgraph.md](../02-implementation/01-langgraph.md) -- Implementation with LangGraph

## References

1. Wu, Q. et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023) -- https://arxiv.org/abs/2308.08155
2. CrewAI Documentation -- https://docs.crewai.com/
3. Hong, S. et al., "MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework" (2023) -- https://arxiv.org/abs/2308.00352
4. LangGraph Documentation -- https://langchain-ai.github.io/langgraph/
5. Talebirad, Y. et al., "Multi-Agent Collaboration: Harnessing the Power of Intelligent LLM Agents" (2023) -- https://arxiv.org/abs/2306.03314
