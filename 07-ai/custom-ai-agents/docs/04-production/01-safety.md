# AI Agent Safety -- Guardrails, Human Oversight, and Restrictions

> A systematic study of technical guardrails, human oversight, and permission restrictions designed to ensure that autonomously acting AI agents operate safely and in a controllable manner without going out of control.

---

## What You Will Learn

1. **Guardrail Design** -- Implementing multi-layered defense through input validation, output filtering, and action restrictions
2. **Human-in-the-Loop** -- Designing approval workflows, escalation, and intervention mechanisms
3. **Permission Restrictions and Sandboxing** -- Least privilege principle, resource limits, and execution environment isolation
4. **Prompt Injection Countermeasures** -- Understanding attack patterns and implementing defensive techniques
5. **Auditing and Compliance** -- Recording all operations, ensuring traceability, and meeting regulatory requirements


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [Deployment](./00-deployment.md)

---

## 1. Overview of Agent Safety

### 1.1 Defense-in-Depth Model for Safety

```
+------------------------------------------------------------------+
|                    Defense-in-Depth Architecture                   |
+------------------------------------------------------------------+
|                                                                    |
|  Layer 1: Input Guard                                              |
|  +------------------------------------------------------------+  |
|  | Prompt Injection Detection | Input Validation | Rate Limiting|  |
|  +------------------------------------------------------------+  |
|                              |                                     |
|  Layer 2: Agent Core                                               |
|  +------------------------------------------------------------+  |
|  | System Prompt | Tool Permission Control | Context Limits   |  |
|  +------------------------------------------------------------+  |
|                              |                                     |
|  Layer 3: Action Guard                                             |
|  +------------------------------------------------------------+  |
|  | Tool Call Validation | Destructive Op Approval | Pre-confirm |  |
|  +------------------------------------------------------------+  |
|                              |                                     |
|  Layer 4: Output Guard                                             |
|  +------------------------------------------------------------+  |
|  | Toxicity Check | PII Detection | Quality Validation | Consistency|
|  +------------------------------------------------------------+  |
|                              |                                     |
|  Layer 5: Execution Environment                                    |
|  +------------------------------------------------------------+  |
|  | Sandbox | Resource Limits | Network Restrictions | Timeout  |  |
|  +------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

### 1.2 Agent Risk Matrix

```
Impact
 High |  Monitoring Required  Approval Required  Prohibited
      |  (Email sending)      (Billing ops)      (Data deletion)
      |
  Med |  Log Recording        Monitoring Required  Approval Required
      |  (Search)             (File creation)      (External API)
      |
  Low |  Unrestricted         Log Recording        Monitoring Required
      |  (Computation)        (Read operations)    (Config changes)
      +----------------------------------------
         Low                  Med                  High
                         Irreversibility (Non-reversibility)
```

### 1.3 Safety Design Framework

```
4 Principles of Safety Design

1. Defense in Depth
   - Do not rely on a single defensive measure
   - Each layer functions independently
   - Other layers defend even if one layer is breached

2. Least Privilege
   - Grant only the minimum necessary permissions
   - Dynamically adjust permissions per session
   - Default to deny (deny by default)

3. Fail Safe
   - Choose the safe option when in doubt
   - Stop the agent when system failures occur
   - Reject unknown inputs

4. Auditability
   - Log all operations
   - Make decision rationale traceable
   - Record at granularity sufficient for post-hoc analysis
```

---

## 2. Guardrail Design

### 2.1 Tool Call Validation System

```python
# Code Example 1: Implementing guardrails for tool calls
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Any
import re

class ActionLevel(Enum):
    ALLOW = "allow"          # Auto-allow
    LOG = "log"              # Log and allow
    CONFIRM = "confirm"      # Requires human confirmation
    DENY = "deny"            # Deny

@dataclass
class ToolPolicy:
    """Security policy for each tool"""
    tool_name: str
    default_level: ActionLevel
    max_calls_per_session: int
    allowed_parameters: dict | None  # Allowed parameter values
    validators: list[Callable]       # Custom validators

class ToolGuardrail:
    """Guardrail for tool calls"""

    def __init__(self, policies: list[ToolPolicy]):
        self.policies = {p.tool_name: p for p in policies}
        self.call_counts: dict[str, int] = {}

    async def check(self, tool_name: str, parameters: dict,
                     context: dict) -> tuple[ActionLevel, str]:
        """Validate a tool call and return the action level"""

        policy = self.policies.get(tool_name)
        if policy is None:
            return ActionLevel.DENY, f"Unregistered tool: {tool_name}"

        # 1. Call count check
        count = self.call_counts.get(tool_name, 0)
        if count >= policy.max_calls_per_session:
            return ActionLevel.DENY, (
                f"Session limit exceeded: {tool_name} "
                f"({count}/{policy.max_calls_per_session})"
            )

        # 2. Parameter validation
        if policy.allowed_parameters:
            for param, allowed in policy.allowed_parameters.items():
                value = parameters.get(param)
                if value is not None and value not in allowed:
                    return ActionLevel.DENY, (
                        f"Value '{value}' for parameter '{param}' "
                        f"is not permitted"
                    )

        # 3. Custom validators
        for validator in policy.validators:
            result = await validator(parameters, context)
            if not result["ok"]:
                return ActionLevel.DENY, result["reason"]

        # 4. Update call count
        self.call_counts[tool_name] = count + 1

        return policy.default_level, "OK"


# Example policy definitions
policies = [
    ToolPolicy(
        tool_name="web_search",
        default_level=ActionLevel.ALLOW,
        max_calls_per_session=50,
        allowed_parameters=None,
        validators=[],
    ),
    ToolPolicy(
        tool_name="send_email",
        default_level=ActionLevel.CONFIRM,
        max_calls_per_session=5,
        allowed_parameters={
            "to_domain": ["@company.com", "@partner.com"],
        },
        validators=[check_email_content_safety],
    ),
    ToolPolicy(
        tool_name="execute_code",
        default_level=ActionLevel.LOG,
        max_calls_per_session=20,
        allowed_parameters=None,
        validators=[check_code_safety, check_no_network_access],
    ),
    ToolPolicy(
        tool_name="delete_file",
        default_level=ActionLevel.CONFIRM,
        max_calls_per_session=3,
        allowed_parameters=None,
        validators=[check_not_system_file, check_backup_exists],
    ),
]
```

### 2.2 Output Filtering

```python
# Code Example 2: Safety filtering for agent output
class OutputGuardrail:
    """Filters agent output"""

    # PII patterns
    PII_PATTERNS = {
        "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "phone_jp": r"0\d{1,4}-?\d{1,4}-?\d{3,4}",
        "credit_card": r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",
        "my_number": r"\b\d{4}\s?\d{4}\s?\d{4}\b",  # My Number (Japan)
    }

    async def filter_output(self, output: str, context: dict) -> dict:
        """Validate output and filter as necessary"""
        issues = []

        # 1. PII detection
        pii_found = self._detect_pii(output)
        if pii_found:
            output = self._mask_pii(output, pii_found)
            issues.append({
                "type": "pii_detected",
                "count": len(pii_found),
                "action": "masked"
            })

        # 2. Toxicity check
        toxicity = await self._check_toxicity(output)
        if toxicity["score"] > 0.8:
            issues.append({
                "type": "toxic_content",
                "score": toxicity["score"],
                "action": "blocked"
            })
            return {
                "output": "[Output blocked by safety filter]",
                "issues": issues,
                "blocked": True
            }

        # 3. Confidential information leak check
        if self._contains_system_prompt(output, context):
            issues.append({
                "type": "system_prompt_leak",
                "action": "blocked"
            })
            return {
                "output": "[System information leak detected and blocked]",
                "issues": issues,
                "blocked": True
            }

        return {
            "output": output,
            "issues": issues,
            "blocked": False
        }

    def _detect_pii(self, text: str) -> list[dict]:
        findings = []
        for pii_type, pattern in self.PII_PATTERNS.items():
            matches = re.findall(pattern, text)
            for match in matches:
                findings.append({"type": pii_type, "value": match})
        return findings

    def _mask_pii(self, text: str, findings: list[dict]) -> str:
        for finding in findings:
            text = text.replace(
                finding["value"],
                f"[{finding['type'].upper()}_MASKED]"
            )
        return text
```

### 2.3 Input Validation and Injection Countermeasures

```python
class InputGuardrail:
    """Validates input to the agent and prevents attacks"""

    # Injection detection patterns
    INJECTION_PATTERNS = [
        r"ignore\s+(previous|above|all)\s+(instructions?|prompts?)",
        r"you\s+are\s+now\s+a",
        r"pretend\s+(to\s+be|you\s+are)",
        r"system\s*:\s*",
        r"<\|?(system|assistant|user)\|?>",
        r"forget\s+(everything|all|your)",
        r"new\s+instructions?\s*:",
        r"override\s+(previous|system|all)",
        r"jailbreak",
        r"DAN\s+(mode|prompt)",
    ]

    def __init__(self):
        self._compiled_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.INJECTION_PATTERNS
        ]

    async def validate_input(self, user_input: str,
                             context: dict) -> dict:
        """Validate input and assess its safety"""
        issues = []

        # 1. Basic length check
        if len(user_input) > 100_000:
            return {
                "valid": False,
                "reason": "Input is too long (100,000 characters or more)",
                "issues": [{"type": "input_too_long"}]
            }

        # 2. Pattern-based injection detection
        for pattern in self._compiled_patterns:
            if pattern.search(user_input):
                issues.append({
                    "type": "injection_pattern_detected",
                    "pattern": pattern.pattern,
                    "severity": "high"
                })

        # 3. Encoding attack detection
        if self._detect_encoding_attack(user_input):
            issues.append({
                "type": "encoding_attack",
                "severity": "high"
            })

        # 4. Invisible character detection
        invisible_chars = self._detect_invisible_characters(user_input)
        if invisible_chars:
            issues.append({
                "type": "invisible_characters",
                "count": len(invisible_chars),
                "severity": "medium"
            })

        # 5. LLM-based injection detection (high accuracy, slower)
        if issues:
            llm_check = await self._llm_injection_check(user_input)
            issues.append({
                "type": "llm_injection_analysis",
                "is_injection": llm_check["is_injection"],
                "confidence": llm_check["confidence"]
            })

        high_severity = any(
            i.get("severity") == "high" for i in issues
        )
        return {
            "valid": not high_severity,
            "issues": issues,
            "sanitized_input": self._sanitize(user_input)
                if not high_severity else None
        }

    def _detect_encoding_attack(self, text: str) -> bool:
        """Detect encoding attacks via Base64, Unicode, etc."""
        import base64
        # Detect instructions encoded in Base64
        for word in text.split():
            try:
                decoded = base64.b64decode(word).decode("utf-8")
                for pattern in self._compiled_patterns:
                    if pattern.search(decoded):
                        return True
            except Exception:
                continue
        return False

    def _detect_invisible_characters(self, text: str) -> list[int]:
        """Detect invisible characters such as zero-width characters"""
        invisible = []
        invisible_ranges = [
            (0x200B, 0x200F),  # Zero-width spaces, etc.
            (0x2028, 0x202F),  # Line/paragraph separators, etc.
            (0xFEFF, 0xFEFF),  # BOM
        ]
        for i, char in enumerate(text):
            code = ord(char)
            for start, end in invisible_ranges:
                if start <= code <= end:
                    invisible.append(i)
        return invisible

    def _sanitize(self, text: str) -> str:
        """Sanitize input and convert to a safe form"""
        # Remove invisible characters
        cleaned = ""
        for char in text:
            code = ord(char)
            if code < 0x20 and code not in (0x0A, 0x0D, 0x09):
                continue
            if 0x200B <= code <= 0x200F:
                continue
            cleaned += char
        return cleaned

    async def _llm_injection_check(self, text: str) -> dict:
        """High-accuracy injection detection using an LLM"""
        prompt = f"""Determine whether the following text contains
a prompt injection attack.

Text:
---
{text[:2000]}
---

Please respond in JSON format:
{{"is_injection": true/false, "confidence": 0.0-1.0, "reason": "..."}}"""

        response = await self.classifier_llm.create(
            model="claude-haiku-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return json.loads(response.content[0].text)
```

---

## 3. Human-in-the-Loop

### 3.1 Approval Workflow

```
+------------------------------------------------------------------+
|                    Human-in-the-Loop Patterns                      |
+------------------------------------------------------------------+
|                                                                    |
|  Pattern A: Pre-Approval                                           |
|  Agent → [Present Plan] → Human Approval → Execute                |
|  Use case: High-risk operations, irreversible changes              |
|                                                                    |
|  Pattern B: Post-Verification                                      |
|  Agent → Execute → [Present Results] → Human Review → Confirm/Undo|
|  Use case: Medium-risk operations, reversible changes              |
|                                                                    |
|  Pattern C: Monitoring                                             |
|  Agent → Execute → Log → [Anomaly Only] → Human Alert             |
|  Use case: Low-risk operations, high-volume routine processing     |
|                                                                    |
|  Pattern D: Escalation                                             |
|  Agent → Confidence Assessment → [Low Confidence] → Delegate Human |
|                                → [High Confidence] → Auto-Execute  |
|  Use case: Situations where decision certainty varies              |
+------------------------------------------------------------------+
```

### 3.2 Implementing the Approval Workflow

```python
# Code Example 3: Human-in-the-Loop approval flow
import asyncio
from enum import Enum

class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"

class HumanApprovalGate:
    """Gate that requires human approval"""

    def __init__(self, notification_service, timeout_seconds=300):
        self.notification_service = notification_service
        self.timeout = timeout_seconds
        self.pending_requests: dict[str, asyncio.Future] = {}

    async def request_approval(self, action_description: str,
                                parameters: dict,
                                risk_level: str,
                                reviewer_id: str) -> ApprovalStatus:
        """Request human approval and wait for the result"""

        request_id = str(uuid.uuid4())

        # Notify of the approval request
        await self.notification_service.send(
            to=reviewer_id,
            message={
                "type": "approval_request",
                "request_id": request_id,
                "action": action_description,
                "parameters": parameters,
                "risk_level": risk_level,
                "expires_at": time.time() + self.timeout,
            }
        )

        # Create a Future to await approval
        future = asyncio.get_event_loop().create_future()
        self.pending_requests[request_id] = future

        try:
            # Wait for approval with a timeout
            result = await asyncio.wait_for(future, timeout=self.timeout)
            return result
        except asyncio.TimeoutError:
            return ApprovalStatus.TIMEOUT
        finally:
            self.pending_requests.pop(request_id, None)

    async def submit_decision(self, request_id: str,
                               status: ApprovalStatus,
                               comment: str = ""):
        """Reviewer submits an approval or rejection"""
        future = self.pending_requests.get(request_id)
        if future and not future.done():
            future.set_result(status)


class SafeAgent:
    """Safe agent execution framework"""

    def __init__(self, llm, tools, guardrail, approval_gate):
        self.llm = llm
        self.tools = tools
        self.guardrail = guardrail
        self.approval_gate = approval_gate

    async def execute_action(self, tool_name: str,
                              parameters: dict, context: dict):
        """Execute an action with guardrails"""

        # Step 1: Guardrail check
        level, reason = await self.guardrail.check(
            tool_name, parameters, context
        )

        if level == ActionLevel.DENY:
            return {"status": "denied", "reason": reason}

        if level == ActionLevel.CONFIRM:
            # Step 2: Request human approval
            status = await self.approval_gate.request_approval(
                action_description=f"{tool_name}({parameters})",
                parameters=parameters,
                risk_level="high",
                reviewer_id=context["owner_id"],
            )

            if status != ApprovalStatus.APPROVED:
                return {"status": "rejected", "approval": status.value}

        # Step 3: Execute
        try:
            result = await self.tools[tool_name].execute(parameters)
            return {"status": "success", "result": result}
        except Exception as e:
            return {"status": "error", "error": str(e)}
```

### 3.3 Confidence-Based Escalation

```python
class ConfidenceBasedEscalation:
    """Escalation decision-making based on agent confidence"""

    def __init__(
        self,
        auto_threshold: float = 0.9,
        confirm_threshold: float = 0.6,
        escalate_threshold: float = 0.3
    ):
        self.auto_threshold = auto_threshold
        self.confirm_threshold = confirm_threshold
        self.escalate_threshold = escalate_threshold

    async def evaluate_and_route(
        self,
        agent_response: dict,
        context: dict
    ) -> dict:
        """Evaluate response confidence and determine routing"""

        confidence = await self._assess_confidence(agent_response)

        if confidence >= self.auto_threshold:
            # High confidence: auto-execute
            return {
                "action": "auto_execute",
                "confidence": confidence,
                "response": agent_response
            }

        elif confidence >= self.confirm_threshold:
            # Medium confidence: quick confirmation
            return {
                "action": "quick_confirm",
                "confidence": confidence,
                "response": agent_response,
                "message": "Please review the agent's response"
            }

        elif confidence >= self.escalate_threshold:
            # Low confidence: detailed review
            return {
                "action": "detailed_review",
                "confidence": confidence,
                "response": agent_response,
                "alternatives": await self._generate_alternatives(
                    agent_response, context
                ),
                "message": "Please select the most appropriate option from multiple alternatives"
            }

        else:
            # Very low confidence: full delegation to human
            return {
                "action": "full_escalation",
                "confidence": confidence,
                "context_summary": self._summarize_context(context),
                "message": "The agent cannot handle this appropriately. "
                          "Human intervention is required."
            }

    async def _assess_confidence(self, response: dict) -> float:
        """Assess the confidence of a response"""
        factors = []

        # 1. LLM self-assessment
        if "confidence" in response:
            factors.append(response["confidence"])

        # 2. Consistency across multiple responses
        if "alternatives" in response:
            consistency = self._measure_consistency(
                response["primary"], response["alternatives"]
            )
            factors.append(consistency)

        # 3. Reliability of tool call results
        if "tool_results" in response:
            tool_reliability = self._assess_tool_results(
                response["tool_results"]
            )
            factors.append(tool_reliability)

        return sum(factors) / len(factors) if factors else 0.5
```

---

## 4. Permission Restrictions and Sandboxing

### 4.1 Least Privilege Design

```python
# Code Example 4: Role-based agent permission management
from dataclasses import dataclass, field

@dataclass
class AgentPermissions:
    """Agent permission definitions"""

    # Filesystem
    allowed_read_paths: list[str] = field(default_factory=list)
    allowed_write_paths: list[str] = field(default_factory=list)
    max_file_size_mb: int = 10

    # Network
    allowed_domains: list[str] = field(default_factory=list)
    blocked_domains: list[str] = field(
        default_factory=lambda: ["*.internal", "localhost"]
    )
    max_requests_per_minute: int = 30

    # Code execution
    allow_code_execution: bool = False
    allowed_languages: list[str] = field(default_factory=list)
    max_execution_time_seconds: int = 30
    max_memory_mb: int = 256

    # External services
    allowed_tools: list[str] = field(default_factory=list)
    denied_tools: list[str] = field(default_factory=list)

    # Resource limits
    max_tokens_per_session: int = 100_000
    max_tool_calls_per_session: int = 50
    session_timeout_minutes: int = 60


# Role-based presets
ROLE_PRESETS = {
    "researcher": AgentPermissions(
        allowed_read_paths=["/data/public/", "/data/research/"],
        allowed_write_paths=["/output/research/"],
        allowed_domains=["*.arxiv.org", "*.wikipedia.org", "*.github.com"],
        allow_code_execution=True,
        allowed_languages=["python"],
        allowed_tools=["web_search", "read_file", "write_file",
                       "execute_python"],
        max_tool_calls_per_session=100,
    ),
    "customer_support": AgentPermissions(
        allowed_read_paths=["/data/faq/", "/data/products/"],
        allowed_write_paths=[],
        allowed_domains=["api.company.com"],
        allow_code_execution=False,
        allowed_tools=["search_faq", "lookup_order", "create_ticket"],
        max_tool_calls_per_session=30,
    ),
    "admin": AgentPermissions(
        allowed_read_paths=["/"],
        allowed_write_paths=["/data/", "/config/"],
        allowed_domains=["*"],
        allow_code_execution=True,
        allowed_languages=["python", "bash"],
        allowed_tools=["*"],
        max_tool_calls_per_session=200,
    ),
}
```

### 4.2 Sandbox Execution Environment

```python
# Code Example 5: Safely execute agent code in a Docker-based sandbox
import docker
import tempfile
import os

class CodeSandbox:
    """Safely execute agent code inside a Docker container"""

    def __init__(self, permissions: AgentPermissions):
        self.client = docker.from_env()
        self.permissions = permissions

    async def execute(self, code: str, language: str = "python") -> dict:
        """Execute code inside the sandbox"""

        if language not in self.permissions.allowed_languages:
            return {"error": f"Language '{language}' is not permitted"}

        # Write code to a temporary file
        with tempfile.NamedTemporaryFile(
            mode='w', suffix='.py', delete=False
        ) as f:
            f.write(code)
            code_path = f.name

        try:
            container = self.client.containers.run(
                image="python:3.11-slim",
                command=f"python /code/script.py",
                volumes={
                    code_path: {"bind": "/code/script.py", "mode": "ro"}
                },
                # Security restrictions
                mem_limit=f"{self.permissions.max_memory_mb}m",
                cpu_period=100000,
                cpu_quota=50000,     # 50% CPU limit
                network_disabled=True,  # Network disabled
                read_only=True,      # Filesystem read-only
                security_opt=["no-new-privileges"],
                # Timeout
                detach=True,
            )

            # Wait for execution to complete (with timeout)
            result = container.wait(
                timeout=self.permissions.max_execution_time_seconds
            )

            logs = container.logs().decode("utf-8")
            exit_code = result["StatusCode"]

            return {
                "stdout": logs,
                "exit_code": exit_code,
                "success": exit_code == 0,
            }

        except docker.errors.ContainerError as e:
            return {"error": f"Execution error: {e}"}
        except Exception as e:
            return {"error": f"Sandbox error: {e}"}
        finally:
            os.unlink(code_path)
            try:
                container.remove(force=True)
            except:
                pass
```

### 4.3 Dynamic Permission Control

```python
class DynamicPermissionManager:
    """Dynamically adjust agent permissions during a session"""

    def __init__(self, base_permissions: AgentPermissions):
        self.base = base_permissions
        self.current = AgentPermissions(**vars(base_permissions))
        self.escalation_history: list[dict] = []
        self.violation_count: int = 0

    def request_elevated_permission(
        self,
        resource_type: str,
        resource_name: str,
        justification: str
    ) -> dict:
        """Request a permission elevation"""
        request = {
            "type": resource_type,
            "resource": resource_name,
            "justification": justification,
            "timestamp": time.time(),
            "status": "pending"
        }
        self.escalation_history.append(request)
        return request

    def grant_temporary_permission(
        self,
        resource_type: str,
        resource_name: str,
        duration_minutes: int = 10
    ):
        """Grant a temporary permission"""
        if resource_type == "tool":
            if resource_name not in self.current.allowed_tools:
                self.current.allowed_tools.append(resource_name)
        elif resource_type == "read_path":
            if resource_name not in self.current.allowed_read_paths:
                self.current.allowed_read_paths.append(resource_name)
        elif resource_type == "write_path":
            if resource_name not in self.current.allowed_write_paths:
                self.current.allowed_write_paths.append(resource_name)

        # Automatically revoke the permission after a set time
        asyncio.get_event_loop().call_later(
            duration_minutes * 60,
            self._revoke_permission,
            resource_type,
            resource_name
        )

    def record_violation(self, violation_type: str, details: str):
        """Record a permission violation and reduce permissions if necessary"""
        self.violation_count += 1

        if self.violation_count >= 3:
            # Reduce permissions after 3 or more violations
            self._reduce_permissions()

        if self.violation_count >= 5:
            # Terminate session after 5 or more violations
            raise SecurityViolationError(
                f"Permission violations have reached {self.violation_count}. "
                "Terminating session."
            )

    def _reduce_permissions(self):
        """Progressively reduce permissions"""
        self.current.max_tool_calls_per_session = max(
            10,
            self.current.max_tool_calls_per_session // 2
        )
        self.current.allow_code_execution = False
        self.current.allowed_write_paths = []

    def _revoke_permission(self, resource_type: str, resource_name: str):
        """Revoke a temporary permission"""
        if resource_type == "tool":
            if (resource_name in self.current.allowed_tools
                    and resource_name not in self.base.allowed_tools):
                self.current.allowed_tools.remove(resource_name)
```

---

## 5. Auditing and Compliance

### 5.1 Implementing Audit Logs

```python
import json
from datetime import datetime
from enum import Enum

class AuditEventType(Enum):
    AGENT_START = "agent_start"
    AGENT_END = "agent_end"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_DENIED = "approval_denied"
    GUARDRAIL_TRIGGERED = "guardrail_triggered"
    PERMISSION_VIOLATION = "permission_violation"
    OUTPUT_FILTERED = "output_filtered"
    ESCALATION = "escalation"

class AuditLogger:
    """Records audit logs for all agent operations"""

    def __init__(self, storage_backend):
        self.storage = storage_backend

    async def log_event(
        self,
        event_type: AuditEventType,
        session_id: str,
        user_id: str,
        agent_id: str,
        details: dict,
        metadata: dict | None = None
    ):
        """Record an audit event"""
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type.value,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "user_id": user_id,
            "agent_id": agent_id,
            "details": details,
            "metadata": metadata or {},
        }

        # Use a hash chain to prevent tampering
        event["hash"] = self._compute_hash(event)
        event["previous_hash"] = await self._get_last_hash(session_id)

        await self.storage.append(
            key=f"audit:{session_id}",
            value=json.dumps(event)
        )

        # Immediately notify for critical events
        if event_type in (
            AuditEventType.PERMISSION_VIOLATION,
            AuditEventType.GUARDRAIL_TRIGGERED,
        ):
            await self._notify_security_team(event)

    def _compute_hash(self, event: dict) -> str:
        """Compute the hash of an event"""
        import hashlib
        content = json.dumps(
            {k: v for k, v in event.items() if k != "hash"},
            sort_keys=True
        )
        return hashlib.sha256(content.encode()).hexdigest()

    async def _get_last_hash(self, session_id: str) -> str:
        """Retrieve the hash of the previous event"""
        last_event = await self.storage.get_last(f"audit:{session_id}")
        if last_event:
            return json.loads(last_event)["hash"]
        return "genesis"

    async def generate_audit_report(
        self,
        session_id: str
    ) -> dict:
        """Generate an audit report for a session"""
        events = await self.storage.get_all(f"audit:{session_id}")
        parsed = [json.loads(e) for e in events]

        report = {
            "session_id": session_id,
            "total_events": len(parsed),
            "start_time": parsed[0]["timestamp"] if parsed else None,
            "end_time": parsed[-1]["timestamp"] if parsed else None,
            "tool_calls": [
                e for e in parsed
                if e["event_type"] == "tool_call"
            ],
            "guardrail_triggers": [
                e for e in parsed
                if e["event_type"] == "guardrail_triggered"
            ],
            "violations": [
                e for e in parsed
                if e["event_type"] == "permission_violation"
            ],
            "approvals": {
                "requested": len([
                    e for e in parsed
                    if e["event_type"] == "approval_requested"
                ]),
                "granted": len([
                    e for e in parsed
                    if e["event_type"] == "approval_granted"
                ]),
                "denied": len([
                    e for e in parsed
                    if e["event_type"] == "approval_denied"
                ]),
            },
            "integrity_valid": self._verify_hash_chain(parsed),
        }

        return report

    def _verify_hash_chain(self, events: list[dict]) -> bool:
        """Verify the integrity of the hash chain"""
        for i, event in enumerate(events):
            expected_hash = self._compute_hash(event)
            if event["hash"] != expected_hash:
                return False
            if i > 0 and event["previous_hash"] != events[i-1]["hash"]:
                return False
        return True
```

### 5.2 Compliance Checker

```python
class ComplianceChecker:
    """Compliance checks based on regulatory requirements"""

    def __init__(self, regulations: list[str]):
        self.regulations = regulations
        self.rules = self._load_rules(regulations)

    def _load_rules(self, regulations: list[str]) -> dict:
        """Load rules for each regulation"""
        all_rules = {
            "GDPR": {
                "data_retention_days": 30,
                "requires_consent": True,
                "right_to_erasure": True,
                "data_portability": True,
                "pii_categories": [
                    "name", "email", "phone", "address",
                    "ip_address", "location"
                ],
            },
            "HIPAA": {
                "phi_categories": [
                    "medical_record", "diagnosis", "treatment",
                    "insurance_info", "patient_id"
                ],
                "requires_encryption": True,
                "audit_trail_required": True,
                "minimum_access_controls": True,
            },
            "SOC2": {
                "requires_access_logs": True,
                "requires_encryption_at_rest": True,
                "requires_encryption_in_transit": True,
                "change_management_required": True,
            },
            "APPI": {  # Act on Protection of Personal Information (Japan)
                "requires_purpose_specification": True,
                "requires_consent_for_third_party": True,
                "data_breach_notification_required": True,
                "cross_border_transfer_restrictions": True,
            },
        }
        return {r: all_rules[r] for r in regulations if r in all_rules}

    async def check_action(
        self,
        action: str,
        data_categories: list[str],
        context: dict
    ) -> dict:
        """Verify that an action meets compliance requirements"""
        violations = []

        for reg_name, rules in self.rules.items():
            # PII/PHI category check
            sensitive_cats = rules.get(
                "pii_categories",
                rules.get("phi_categories", [])
            )
            overlap = set(data_categories) & set(sensitive_cats)
            if overlap:
                if rules.get("requires_consent") and not context.get("has_consent"):
                    violations.append({
                        "regulation": reg_name,
                        "violation": "consent_missing",
                        "categories": list(overlap),
                        "severity": "high"
                    })

            # Encryption check
            if rules.get("requires_encryption"):
                if not context.get("encryption_enabled"):
                    violations.append({
                        "regulation": reg_name,
                        "violation": "encryption_missing",
                        "severity": "high"
                    })

        return {
            "compliant": len(violations) == 0,
            "violations": violations,
            "regulations_checked": list(self.rules.keys())
        }
```

---

## 6. Monitoring and Alerts

### 6.1 Agent Behavior Monitoring Dashboard

```
+------------------------------------------------------------------+
|                Agent Monitoring Dashboard                          |
+------------------------------------------------------------------+
|                                                                    |
|  Real-time Metrics:                                                |
|  +------------------+  +------------------+  +------------------+ |
|  | Active           |  | Tool Calls       |  | Error Rate       | |
|  | Sessions: 142    |  | QPS: 2,340       |  | 0.3%             | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                    |
|  +------------------+  +------------------+  +------------------+ |
|  | Pending          |  | Rejected         |  | Avg Session      | |
|  | Approvals: 7     |  | Actions: 23      |  | Duration: 4.2min | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                    |
|  Alert Conditions:                                                 |
|  [!] Consecutive calls to same tool > 10/min                       |
|  [!] Error rate > 5%                                               |
|  [!] Session duration > 30 minutes                                 |
|  [!] Rejected action rate > 10%                                    |
|  [!] Token consumption > 80% of limit                              |
+------------------------------------------------------------------+
```

### 6.2 Anomaly Detection Patterns

```python
class AnomalyDetector:
    """Detects anomalous agent behavior"""

    def __init__(self):
        self.baselines: dict[str, dict] = {}
        self.alerts: list[dict] = []

    async def check_for_anomalies(
        self,
        session_id: str,
        metrics: dict
    ) -> list[dict]:
        """Detect anomalies in session metrics"""
        anomalies = []

        # 1. Loop detection: consecutive calls to the same tool
        if metrics.get("consecutive_same_tool", 0) > 5:
            anomalies.append({
                "type": "tool_loop_detected",
                "tool": metrics["last_tool"],
                "count": metrics["consecutive_same_tool"],
                "severity": "high",
                "action": "pause_agent"
            })

        # 2. Abnormal token consumption
        avg_tokens = self.baselines.get(
            "avg_tokens_per_step", 500
        )
        if metrics.get("tokens_this_step", 0) > avg_tokens * 5:
            anomalies.append({
                "type": "token_spike",
                "current": metrics["tokens_this_step"],
                "expected": avg_tokens,
                "severity": "medium",
                "action": "log_and_continue"
            })

        # 3. Sudden spike in failure rate
        if metrics.get("recent_error_rate", 0) > 0.5:
            anomalies.append({
                "type": "high_error_rate",
                "rate": metrics["recent_error_rate"],
                "severity": "high",
                "action": "escalate_to_human"
            })

        # 4. Attempted access to unauthorized resources
        if metrics.get("permission_denied_count", 0) > 3:
            anomalies.append({
                "type": "repeated_permission_violation",
                "count": metrics["permission_denied_count"],
                "severity": "critical",
                "action": "terminate_session"
            })

        # 5. Abnormal response time
        if metrics.get("step_duration_seconds", 0) > 120:
            anomalies.append({
                "type": "long_running_step",
                "duration": metrics["step_duration_seconds"],
                "severity": "medium",
                "action": "check_for_hang"
            })

        return anomalies
```

---

## 7. Pattern Comparison

### 7.1 Comparison of Safety Patterns

| Pattern | Safety | User Experience | Implementation Cost | Use Case |
|---------|--------|-----------------|---------------------|----------|
| Pre-approval for all operations | Very High | Low (high latency) | Low | Finance, Healthcare |
| Risk-based approval | High | Medium | Medium | General business |
| Post-monitoring + undo | Medium | High | Medium | Internal tools |
| Confidence-based escalation | Medium-High | High | High | Customer support |
| Sandbox + logging | Medium | High | High | Development, Research |

### 7.2 Comparison of Agent Permission Models

| Model | Granularity | Flexibility | Management Cost | Use Case |
|-------|-------------|-------------|-----------------|----------|
| Whitelist | Per-tool | Low | Low | Simple agents |
| RBAC | Per-role | Medium | Medium | Organizational agents |
| ABAC | Attribute-based | High | High | Complex permission requirements |
| Capability-based | Capability tokens | High | High | Multi-agent |

### 7.3 Comparison of Injection Countermeasure Techniques

| Technique | Detection Accuracy | Latency | Cost | False Positive Rate |
|-----------|-------------------|---------|------|---------------------|
| Pattern matching | Medium | Very Low | None | Medium |
| LLM-based classification | High | Medium | API cost | Low |
| Input sanitization | Low | Very Low | None | None |
| Prompt separation | High | None | None | None |
| Output validation | Medium | Low | None | Low |
| Multi-layer combination | Highest | Medium | Medium | Lowest |

---

## 8. Anti-Patterns

### Anti-Pattern 1: "General-Purpose Agent with Full Permissions"

```
[Wrong] Granting the agent access to all tools and all resources

  "An AI assistant that can do anything"
  → File deletion, email sending, and API calls are all executed automatically
  → A prompt injection attack exploits all permissions

[Correct] Apply the principle of least privilege
  1. Allow only the tools necessary for the task
  2. Restrict accessible files/directories
  3. Manage network access with a whitelist
  4. Grant permissions dynamically per session
```

### Anti-Pattern 2: "Ignoring Agent Loops"

```
[Wrong] No mechanism to detect and stop the agent when it enters
        an infinite loop or performs repetitive, meaningless operations

Real problems that have occurred:
  - Called the same API thousands of times, hitting rate limits
  - Repeatedly read and wrote files, filling up disk space
  - Consumed large amounts of tokens, causing costs to explode

[Correct] Implement loop detection and resource limits
  - Detect consecutive calls to the same tool (stop after > N calls)
  - Per-session token limit
  - Limit on number of tool calls
  - Timeout settings
  - Cost limit settings ($ XX/session)
```

### Anti-Pattern 3: "Trusting Output Without Validation"

```
[Wrong] Presenting agent output to users without filtering

Problems:
  - Leakage of PII (personally identifiable information)
  - Leakage of the system prompt
  - Output of harmful content
  - Presenting hallucinations as facts

[Correct] Always implement output guardrails
  - PII detection + masking
  - Toxicity scoring
  - System prompt leak check
  - Fact verification (when possible)
```

### Anti-Pattern 4: "Operating Without Audit Logs"

```
[Wrong] Not recording agent actions, making post-hoc analysis impossible

Problems:
  - Cannot identify the cause when an incident occurs
  - Cannot respond to compliance audits
  - No data accumulation for improvement

[Correct] Record audit logs for all operations
  - Tool calls: name, parameters, results
  - Decision-making: confidence, reason for choice
  - Guardrails: trigger count, blocked content
  - User interactions: history of approvals/rejections
```

---

## 9. Implementation Checklist

### 9.1 Safety Implementation Checklist

```
Must Have:
[ ] Input validation (length, format)
[ ] Prompt injection detection (pattern-based)
[ ] Tool call permission control (whitelist)
[ ] Output filtering (PII detection)
[ ] Session timeout
[ ] Token usage limit
[ ] Tool call count limit
[ ] Audit logs for all operations
[ ] Error handling and fallback

Should Have:
[ ] LLM-based injection detection
[ ] Risk-based approval workflow
[ ] Sandbox execution environment
[ ] Loop detection and automatic stop
[ ] Cost limits and budget management
[ ] Anomaly detection alerts
[ ] Role-based permission management

Nice to Have:
[ ] Confidence-based escalation
[ ] Dynamic permission control
[ ] Compliance checker
[ ] Hash chain log tamper prevention
[ ] Safety evaluation with A/B testing
[ ] Multi-language PII detection
```

---

## 10. FAQ

### Q1: How much autonomy should I give to an agent?

**A:** Determine this incrementally based on a balance between risk and operational efficiency.

- **Level 1 (Recommendation)**: The agent suggests, and humans execute everything
- **Level 2 (Approval-gated execution)**: The agent draws up an execution plan, and humans execute it after approval
- **Level 3 (Supervised autonomy)**: The agent executes autonomously, and humans only monitor. Intervene on anomalies
- **Level 4 (Full autonomy)**: The agent executes completely autonomously. Only periodic post-hoc review

In production environments, it is recommended to start at Level 2-3 and raise the level only after reliability has been demonstrated.

### Q2: How do you design safety in a multi-agent environment?

**A:** Apply the following principles.

1. **Permission separation between agents**: Each agent has its own set of permissions and does not inherit the permissions of other agents
2. **Restricting communication channels**: Communication between agents is limited to defined protocols to prevent direct prompt injection
3. **Orchestrator monitoring**: A central orchestrator monitors the actions of all agents and detects anomalous coordinated behavior
4. **Centralizing final decision authority**: Critical decisions are centralized in a single agent (or the orchestrator)

### Q3: How can I prevent cost explosions?

**A:** Establish multi-layered cost limits.

- **Per session**: Set maximum token count and maximum tool call count per session
- **Per user**: Set a daily/monthly usage limit
- **Per organization**: Set a monthly budget cap, with alerts at thresholds (80%, 90%, 95%)
- **Real-time monitoring**: Detect abnormal consumption patterns with a cost monitoring dashboard
- **Auto-stop**: Automatically stop all agents when 100% of the budget is reached

### Q4: What is the priority order for prompt injection countermeasures?

**A:** Implementation is recommended in the following order.

1. **System prompt separation**: Clearly separate user input from system instructions (zero cost, high effect)
2. **Pattern matching**: Detect known injection patterns (low cost, immediately implementable)
3. **Input sanitization**: Remove invisible characters and encoding attacks
4. **Output validation**: Check for system prompt leaks and PII leaks
5. **LLM-based classification**: High accuracy but costly, so apply only to suspicious inputs

### Q5: What is the response procedure when a security incident occurs?

**A:** Follow this flow.

1. **Immediate response**: Immediately stop the relevant session and freeze agent operations
2. **Identify scope of impact**: Use audit logs to identify affected users and data
3. **Evidence preservation**: Preserve related logs, metrics, and snapshots
4. **Notification**: Notify affected users and stakeholders (as required by regulations)
5. **Root cause analysis**: Identify the cause of the incident and formulate preventive measures
6. **Implement improvements**: Update guardrails, permission settings, and detection logic

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but from actually writing code and verifying behavior.

### Q2: What mistakes do beginners often make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 11. Summary

| Safety Measure | Implementation Method | Purpose | Priority |
|----------------|-----------------------|---------|----------|
| Tool permission control | Whitelist + policies | Prevent unauthorized operations | Required |
| Input guardrails | Pattern + ML detection | Prevent injection | Required |
| Output filtering | PII detection + toxicity check | Prevent information leaks and harmful output | Required |
| Human approval gate | Async workflow | Control high-risk operations | Recommended |
| Sandbox | Docker + resource limits | Isolate execution environment | Recommended |
| Loop detection | Call pattern monitoring | Prevent resource waste | Recommended |
| Audit logs | Record all operations + hash chain | Ensure traceability | Required |
| Cost limits | Multi-layered budget control | Prevent cost explosions | Recommended |
| Compliance | Automated regulatory rule checks | Adherence to laws and regulations | Industry-dependent |
| Dynamic permissions | In-session permission adjustment | Fine-grained control | Advanced |

---

## Further Reading

- [AI Safety](../../../llm-and-ai-comparison/docs/04-ethics/00-ai-safety.md) -- Technical methods for alignment and red-teaming
- [AI Governance](../../../llm-and-ai-comparison/docs/04-ethics/01-ai-governance.md) -- Trends in regulations and policy
- [Responsible AI](../../../ai-analysis-guide/docs/03-applied/03-responsible-ai.md) -- Implementing fairness, explainability, and privacy

---

## References

1. Wunderwuzzi. (2024). "Prompt Injection and AI Agents: Threats, Defenses, and Real-world Scenarios." *Embracethered*. https://embracethered.com/blog/
2. Yao, S. et al. (2023). "ReAct: Synergizing Reasoning and Acting in Language Models." *ICLR 2023*. https://arxiv.org/abs/2210.03629
3. OWASP. (2025). "OWASP Top 10 for Large Language Model Applications." *OWASP Foundation*. https://owasp.org/www-project-top-10-for-large-language-model-applications/
4. Greshake, K. et al. (2023). "Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection." *arXiv*. https://arxiv.org/abs/2302.12173
5. NIST. (2024). "AI Risk Management Framework." *NIST*. https://www.nist.gov/artificial-intelligence
