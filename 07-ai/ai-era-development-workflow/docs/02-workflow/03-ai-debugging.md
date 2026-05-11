# AI Debugging -- Error Analysis, Log Analysis, and Auto-Fix

> Accelerate bug identification using AI, systematizing the entire debugging process from error log analysis to stack trace interpretation, root cause estimation, and fix suggestions, reducing investigation time from hours to minutes

## What You Will Learn

1. **Basic AI Debugging Approaches** -- Bug cause estimation through error message analysis, stack trace interpretation, and context understanding
2. **Log Analysis and Anomaly Detection** -- Automated pipelines for pattern extraction from large volumes of logs, anomaly detection, and root cause analysis (RCA)
3. **Practical Debugging Workflows** -- Strategies for leveraging AI debugging with IDE integration, CI/CD integration, team sharing mechanisms, and an understanding of AI debugging limitations


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [AI Documentation Generation -- Automating READMEs, API Specs, and Technical Documents](./02-ai-documentation.md)

---

## 1. Overview of AI Debugging

### 1.1 The Role of AI in the Debugging Process

```
Traditional Debugging vs AI-Assisted Debugging

  Traditional (Manual)
  +----------+     +----------+     +----------+     +----------+
  | Error     | --> | Check    | --> | Form     | --> | Fix      |
  | Occurs    |     | Logs     |     | Hypothesis|    | Code     |
  |           |     |(Manual)  |     |(Experience|    |          |
  +----------+     +----------+     | Dependent)|    +----------+
                                    +----------+
      Time required: 30 min to several hours (highly dependent on experience)

  AI-Assisted
  +----------+     +----------+     +----------+     +----------+
  | Error     | --> | AI       | --> | AI        | --> | AI      |
  | Occurs    |     | Analyzes |     | Estimates |     | Suggests|
  |           |     | Logs     |     | Cause     |     | Fix     |
  +----------+     +----------+     +----------+     +----------+
      Time required: 1-10 min (dependent on AI's context understanding)

  Areas where AI excels:
  +-- Explaining the meaning of error messages
  +-- Interpreting stack traces
  +-- Pattern matching against similar bugs
  +-- Extracting anomalous patterns from large volumes of logs
  +-- Suggesting fix code

  Areas requiring human judgment:
  +-- Determining correctness of business logic
  +-- Identifying reproduction steps
  +-- Understanding environment-specific issues
  +-- Evaluating security impact
  +-- Making final decisions on fixes
```

### 1.2 Technology Stack

```
AI Debugging Technology Map

  AI Models / Assistants
  +-- Claude Code         --- Terminal-integrated debugging support
  +-- GitHub Copilot Chat --- IDE-integrated debugging support
  +-- ChatGPT             --- General-purpose error analysis
  +-- Cursor AI           --- Editor-integrated

  Log Analysis
  +-- Datadog AI          --- Log pattern analysis, anomaly detection
  +-- Elastic Observability --- ML-based anomaly detection
  +-- Sentry              --- Automatic error grouping, AI summaries
  +-- PagerDuty AIOps     --- Incident correlation analysis

  Static Analysis (Bug Prevention)
  +-- SonarQube           --- Code quality and bug pattern detection
  +-- Semgrep             --- Custom rule static analysis
  +-- CodeQL              --- Security vulnerability detection
  +-- Ruff / ESLint       --- Linters

  Dynamic Analysis
  +-- Sentry              --- Error tracking
  +-- OpenTelemetry       --- Distributed tracing
  +-- pdb / debugpy       --- Python debuggers
```

### 1.3 AI Debugging Flow

```
  [Error Occurs]
       |
       v
  [Information Gathering]
  +-- Error message
  +-- Stack trace
  +-- Related logs (100 lines before and after)
  +-- Related code
  +-- Environment info (OS, runtime, dependencies)
       |
       v
  [Query AI] <-- Prompt design is critical
       |
       v
  [AI Response]
  +-- Estimated causes (multiple candidates)
  +-- Probability and rationale for each candidate
  +-- Points to verify
  +-- Suggested fix code
       |
       v
  [Human Verification]
  +-- Confirm the validity of the fix
  +-- Verify no regressions with tests
  +-- Deepen understanding of the root cause
```

---

## 2. Error Message Analysis

### 2.1 Structured Error Reporting

```python
# Structuring error information for AI consumption

import traceback
import sys
import platform
import json

class ErrorReporter:
    """Collects and structures information needed for debugging"""

    def capture_error(self, exception: Exception, context: dict = None) -> dict:
        """Structure error information for AI debugging"""
        tb = traceback.extract_tb(exception.__traceback__)

        report = {
            "error": {
                "type": type(exception).__name__,
                "message": str(exception),
                "traceback": self._format_traceback(tb),
            },
            "environment": {
                "python_version": sys.version,
                "platform": platform.platform(),
                "packages": self._get_relevant_packages(tb),
            },
            "context": context or {},
            "source_code": self._extract_source_context(tb),
            "recent_changes": self._get_recent_git_changes(),
        }
        return report

    def _format_traceback(self, tb) -> list[dict]:
        """Structure the stack trace"""
        frames = []
        for frame in tb:
            frames.append({
                "file": frame.filename,
                "line": frame.lineno,
                "function": frame.name,
                "code": frame.line,
            })
        return frames

    def _extract_source_context(self, tb, context_lines=10) -> list[dict]:
        """Extract source code surrounding the error location"""
        contexts = []
        for frame in tb[-3:]:  # Last 3 frames
            try:
                with open(frame.filename) as f:
                    lines = f.readlines()
                start = max(0, frame.lineno - context_lines - 1)
                end = min(len(lines), frame.lineno + context_lines)
                contexts.append({
                    "file": frame.filename,
                    "error_line": frame.lineno,
                    "code": "".join(lines[start:end]),
                    "start_line": start + 1,
                })
            except (FileNotFoundError, PermissionError):
                pass
        return contexts

    def _get_recent_git_changes(self) -> str:
        """Retrieve recent Git changes"""
        import subprocess
        try:
            result = subprocess.run(
                ["git", "log", "--oneline", "-5"],
                capture_output=True, text=True, timeout=5,
            )
            return result.stdout.strip()
        except Exception:
            return "Failed to retrieve Git information"

    def _get_relevant_packages(self, tb) -> dict:
        """Retrieve versions of packages related to the stack trace"""
        import importlib.metadata
        packages = {}
        for frame in tb:
            parts = frame.filename.split("/")
            for part in parts:
                if part.endswith(".egg-info") or part == "site-packages":
                    continue
                try:
                    version = importlib.metadata.version(part)
                    packages[part] = version
                except importlib.metadata.PackageNotFoundError:
                    pass
        return packages


# Usage example
reporter = ErrorReporter()

try:
    # Buggy code
    result = process_data(None)
except Exception as e:
    error_report = reporter.capture_error(
        e, context={"input": None, "user_id": 123}
    )
    print(json.dumps(error_report, indent=2, ensure_ascii=False))
```

### 2.2 Designing Debug Prompts for AI

```python
# Effective debug prompt templates

DEBUG_PROMPT_TEMPLATE = """
Please identify the cause of the following error and suggest a fix.

## Error Information
Error type: {error_type}
Message: {error_message}

## Stack Trace
{traceback}

## Related Code
{source_code}

## Environment
{environment}

## Context
{context}

## Recent Changes
{recent_changes}

Please respond in the following format:
1. **Estimated causes** (up to 3, ordered by probability)
2. **Rationale for each cause**
3. **Points to verify** (additional investigation to narrow down the cause)
4. **Fix code** (fix for the most likely cause)
5. **Prevention measures** (adding tests, strengthening validation, etc.)
"""

def build_debug_prompt(error_report: dict) -> str:
    """Build a debug prompt from an error report"""
    return DEBUG_PROMPT_TEMPLATE.format(
        error_type=error_report["error"]["type"],
        error_message=error_report["error"]["message"],
        traceback=format_traceback_text(error_report["error"]["traceback"]),
        source_code=format_source_contexts(error_report["source_code"]),
        environment=json.dumps(error_report["environment"], indent=2),
        context=json.dumps(error_report["context"], indent=2),
        recent_changes=error_report.get("recent_changes", "N/A"),
    )
```

### 2.3 Knowledge Base of Common Error Patterns

```python
# Team-shared error pattern database

ERROR_PATTERNS = {
    "TypeError: Cannot read properties of undefined": {
        "category": "null_reference",
        "common_causes": [
            "API response format change (field is undefined)",
            "Accessing data before async operation completes",
            "Missing optional chaining (?.)",
        ],
        "fix_patterns": [
            "Optional Chaining: obj?.prop?.nested",
            "Nullish Coalescing: value ?? defaultValue",
            "Guard Clause: if (!obj) return;",
        ],
        "prevention": [
            "Enable TypeScript strict mode",
            "Runtime validation with Zod / Valibot",
            "Type definitions and validation for API responses",
        ],
    },
    "ECONNREFUSED": {
        "category": "connection",
        "common_causes": [
            "Target service is not running",
            "Incorrect port number configuration",
            "Docker network configuration issues",
            "Firewall / security group restrictions",
        ],
        "diagnosis_steps": [
            "Test connection with curl / telnet",
            "Check container status with docker ps",
            "Check port usage with netstat / lsof",
            "Verify environment variables (DATABASE_URL, etc.)",
        ],
    },
    "OOMKilled": {
        "category": "resource",
        "common_causes": [
            "Memory leak (unremoved event listeners)",
            "Bulk loading of large data",
            "Insufficient container memory limit",
            "Mass object creation due to N+1 queries",
        ],
        "fix_patterns": [
            "Switch to streaming processing",
            "Pagination / batch processing",
            "Memory profiling (heapdump)",
            "Review container resource limits",
        ],
    },
}
```

### 2.4 Language-Specific Debug Pattern Collection

```python
# Language and framework-specific debug patterns

LANGUAGE_DEBUG_PATTERNS = {
    "python": {
        "ImportError / ModuleNotFoundError": {
            "diagnosis": """
            1. Check if the package is installed:
               pip list | grep <package_name>
            2. Verify the virtual environment is properly activated:
               which python
            3. Confirm the module directory is in PYTHONPATH
            4. Cases where package name differs from import name:
               e.g., pip install Pillow -> import PIL
            """,
            "ai_prompt": """
            Please resolve the following ImportError.
            Error: {error_message}
            Python version: {python_version}
            Installed packages: {pip_list}
            Virtual environment: {venv_info}
            """,
        },
        "asyncio.TimeoutError": {
            "diagnosis": """
            1. Check if the timeout value is appropriate
            2. Measure the response time of the target service
            3. Check for network latency
            4. Check for connection pool exhaustion
            5. Verify correct usage of async/await
            """,
            "common_fixes": [
                "Adjust timeout values",
                "Add retry logic",
                "Increase connection pool size",
                "Introduce the Circuit Breaker pattern",
            ],
        },
        "SQLAlchemy DetachedInstanceError": {
            "diagnosis": """
            1. Check session scope (per-request?)
            2. Verify lazy loading is not occurring outside the session
            3. Check the expire_on_commit=False setting
            4. Switch to eager loading with joinedload / selectinload
            """,
            "ai_prompt": """
            A SQLAlchemy DetachedInstanceError is occurring.
            Model definition: {model_code}
            Query code: {query_code}
            Session configuration: {session_config}
            Relation being accessed: {relation_name}
            """,
        },
    },
    "javascript": {
        "Unhandled Promise Rejection": {
            "diagnosis": """
            1. Check if try-catch is properly used in async functions
            2. Check if .catch() is attached to Promise chains
            3. Promise.allSettled vs Promise.all usage
            4. Behavioral differences across Node.js versions
            """,
            "ai_prompt": """
            An Unhandled Promise Rejection is occurring.
            Error: {error_message}
            Code: {code}
            Node.js version: {node_version}
            Please trace where this Promise was rejected.
            """,
        },
        "CORS Error": {
            "diagnosis": """
            1. Check the Access-Control-Allow-Origin header on the server side
            2. Check the response to preflight requests (OPTIONS)
            3. withCredentials setting when sending credentials (cookies)
            4. Proxy settings (vite.config.ts / next.config.js for development)
            """,
            "common_fixes": [
                "Add cors middleware configuration",
                "Set up development proxy",
                "Configure CORS on API Gateway",
                "credentials: 'include' with corresponding server configuration",
            ],
        },
    },
    "go": {
        "panic: runtime error: invalid memory address": {
            "diagnosis": """
            1. Check for nil pointer dereference
            2. Uninitialized map (var m map[string]int -> needs make)
            3. Missing nil check on interfaces
            4. Data races between goroutines
            """,
            "ai_prompt": """
            A Go nil pointer dereference panic is occurring.
            Stack trace: {stacktrace}
            Related code: {code}
            Goroutine usage: {uses_goroutines}
            Please identify the cause of this panic and suggest a safe fix.
            """,
        },
    },
}
```

### 2.5 Frontend-Specific Debugging Techniques

```typescript
// Browser environment debug information collection

interface BrowserDebugInfo {
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };
  networkErrors: NetworkError[];
  consoleErrors: ConsoleError[];
  performanceMetrics: PerformanceMetrics;
  reactComponentTree?: ComponentInfo[];
}

class FrontendDebugCollector {
  /**
   * Comprehensively collect browser environment debug information
   * Structured in a format optimal for AI debugging
   */

  collectDebugInfo(): BrowserDebugInfo {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      networkErrors: this.getNetworkErrors(),
      consoleErrors: this.getConsoleErrors(),
      performanceMetrics: this.getPerformanceMetrics(),
      reactComponentTree: this.getReactTree(),
    };
  }

  private getNetworkErrors(): NetworkError[] {
    // Extract network errors from Performance API
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return entries
      .filter((entry) => entry.responseStatus >= 400 || entry.responseStatus === 0)
      .map((entry) => ({
        url: entry.name,
        status: entry.responseStatus,
        duration: entry.duration,
        initiatorType: entry.initiatorType,
        timestamp: entry.startTime,
      }));
  }

  private getConsoleErrors(): ConsoleError[] {
    // Retrieve logs from previously overridden console.error
    return (window as any).__debugConsoleErrors || [];
  }

  private getPerformanceMetrics(): PerformanceMetrics {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType("paint");

    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.startTime,
      loadComplete: navigation?.loadEventEnd - navigation?.startTime,
      firstPaint: paint.find((p) => p.name === "first-paint")?.startTime,
      firstContentfulPaint: paint.find((p) => p.name === "first-contentful-paint")?.startTime,
      jsHeapSize: (performance as any).memory?.usedJSHeapSize,
      jsHeapLimit: (performance as any).memory?.jsHeapSizeLimit,
    };
  }

  /**
   * Convert collected information into a prompt for AI debugging
   */
  buildAIPrompt(info: BrowserDebugInfo, userDescription: string): string {
    return `
## Frontend Bug Report

### User Report
${userDescription}

### Environment Information
- URL: ${info.url}
- Browser: ${info.userAgent}
- Viewport: ${info.viewport.width}x${info.viewport.height}

### Network Errors
${JSON.stringify(info.networkErrors, null, 2)}

### Console Errors
${JSON.stringify(info.consoleErrors, null, 2)}

### Performance Metrics
${JSON.stringify(info.performanceMetrics, null, 2)}

### Analysis Request
1. Please estimate the root cause of the error
2. Analyze the relationship between network errors and console errors
3. If there are performance issues, point out their causes
4. Show the fix with specific code
`;
  }
}
```

---

## 3. Log Analysis and Anomaly Detection

### 3.1 Structured Log Design

```python
# Designing structured logs suitable for AI analysis
import structlog
import logging
from datetime import datetime

# structlog configuration
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
)

logger = structlog.get_logger()

# Structured log output example
def process_order(order_id: str, user_id: str):
    log = logger.bind(order_id=order_id, user_id=user_id)

    log.info("order_processing_started", step="validation")

    try:
        # Validation
        order = validate_order(order_id)
        log.info("order_validated", items_count=len(order.items))

        # Payment processing
        payment = process_payment(order)
        log.info("payment_processed",
                 amount=payment.amount,
                 method=payment.method,
                 duration_ms=payment.duration_ms)

        # Inventory check
        inventory = check_inventory(order)
        log.info("inventory_checked",
                 all_available=inventory.all_available,
                 unavailable_items=inventory.unavailable_items)

    except PaymentError as e:
        log.error("payment_failed",
                  error_code=e.code,
                  error_message=str(e),
                  retry_possible=e.retryable)
        raise

    except Exception as e:
        log.error("order_processing_failed",
                  error_type=type(e).__name__,
                  error_message=str(e),
                  exc_info=True)
        raise
```

### 3.2 AI-Powered Log Pattern Analysis

```python
# Extracting anomalous patterns from large volumes of logs using AI

class LogAnalyzer:
    """Log analysis engine powered by AI"""

    def analyze_error_patterns(self, logs: list[dict],
                                time_window_minutes: int = 60) -> dict:
        """Analyze error log patterns"""

        # 1. Error aggregation
        error_groups = {}
        for log in logs:
            if log.get("level") in ("error", "critical"):
                key = f"{log.get('error_type', 'unknown')}:{log.get('error_message', '')[:100]}"
                error_groups.setdefault(key, []).append(log)

        # 2. Time-series analysis of errors
        timeline = self._build_error_timeline(logs, time_window_minutes)

        # 3. Correlation analysis
        correlations = self._find_correlations(logs)

        return {
            "error_summary": {
                key: {
                    "count": len(entries),
                    "first_seen": entries[0].get("timestamp"),
                    "last_seen": entries[-1].get("timestamp"),
                    "sample": entries[0],
                }
                for key, entries in sorted(
                    error_groups.items(), key=lambda x: -len(x[1])
                )[:10]
            },
            "timeline": timeline,
            "correlations": correlations,
            "ai_analysis_prompt": self._build_analysis_prompt(
                error_groups, timeline, correlations
            ),
        }

    def _find_correlations(self, logs: list[dict]) -> list[dict]:
        """Detect correlations between errors"""
        correlations = []

        # Error chains within the same request
        request_logs = {}
        for log in logs:
            req_id = log.get("request_id")
            if req_id:
                request_logs.setdefault(req_id, []).append(log)

        for req_id, req_log_list in request_logs.items():
            errors = [l for l in req_log_list if l.get("level") == "error"]
            if len(errors) >= 2:
                correlations.append({
                    "type": "error_chain",
                    "request_id": req_id,
                    "errors": [e.get("error_message", "")[:100] for e in errors],
                    "root_cause_candidate": errors[0].get("error_message", ""),
                })

        return correlations

    def _build_analysis_prompt(self, error_groups, timeline, correlations) -> str:
        """Build a log analysis prompt for AI"""
        return f"""
Please analyze the following log analysis results and suggest root causes and countermeasures.

## Error Summary (by frequency)
{json.dumps(list(error_groups.keys())[:10], ensure_ascii=False, indent=2)}

## Time-Series Patterns
{json.dumps(timeline, ensure_ascii=False, indent=2)}

## Error Correlations
{json.dumps(correlations[:5], ensure_ascii=False, indent=2)}

Please respond in the following format:
1. Estimated root causes (in order of likelihood)
2. Impact assessment
3. Immediate countermeasures
4. Medium to long-term improvements
"""
```

### 3.3 Integration with Distributed Tracing

```python
# Integrating OpenTelemetry + AI analysis

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

tracer = trace.get_tracer("debug-service")

class DistributedDebugger:
    """Debugging combining distributed tracing and AI"""

    def analyze_slow_request(self, trace_id: str) -> dict:
        """Analyze slow request traces with AI"""
        spans = self._get_trace_spans(trace_id)

        # Analyze span durations
        bottlenecks = []
        for span in spans:
            duration_ms = (span["end_time"] - span["start_time"]) / 1_000_000
            if duration_ms > 100:  # Spans over 100ms
                bottlenecks.append({
                    "service": span["service_name"],
                    "operation": span["operation_name"],
                    "duration_ms": duration_ms,
                    "attributes": span.get("attributes", {}),
                })

        # Request AI analysis
        analysis_prompt = f"""
Please analyze the following distributed trace and identify performance bottlenecks.

Trace ID: {trace_id}
Total duration: {self._get_total_duration(spans)} ms

Bottleneck candidates (spans over 100ms):
{json.dumps(bottlenecks, indent=2, ensure_ascii=False)}

Number of spans: {len(spans)}
Number of services: {len(set(s['service_name'] for s in spans))}
"""
        return {
            "bottlenecks": bottlenecks,
            "analysis_prompt": analysis_prompt,
        }
```

### 3.4 Metrics-Based Anomaly Detection

```python
# Detecting and analyzing application metric anomalies with AI

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import mean, stdev
from typing import Optional

@dataclass
class MetricPoint:
    """Metrics data point"""
    timestamp: datetime
    value: float
    labels: dict = field(default_factory=dict)

@dataclass
class AnomalyReport:
    """Anomaly detection report"""
    metric_name: str
    anomaly_type: str  # "spike", "drop", "trend_change", "pattern_break"
    severity: str      # "critical", "warning", "info"
    detected_at: datetime
    current_value: float
    expected_range: tuple[float, float]
    context: dict = field(default_factory=dict)

class MetricsAnomalyDetector:
    """System for detecting metric anomalies with AI"""

    def __init__(self, lookback_window: int = 60):
        """
        Args:
            lookback_window: Number of past minutes to use as baseline for anomaly detection
        """
        self.lookback_window = lookback_window
        self.metrics_history: dict[str, list[MetricPoint]] = {}

    def detect_anomalies(self, current_metrics: dict[str, float]) -> list[AnomalyReport]:
        """Detect anomalies from current metrics"""
        anomalies = []

        for metric_name, current_value in current_metrics.items():
            history = self.metrics_history.get(metric_name, [])
            if len(history) < 10:
                continue  # Insufficient data

            historical_values = [p.value for p in history]
            avg = mean(historical_values)
            std = stdev(historical_values) if len(historical_values) > 1 else 0

            # Z-score based anomaly detection
            z_score = (current_value - avg) / std if std > 0 else 0

            if abs(z_score) > 3:
                anomaly_type = "spike" if z_score > 0 else "drop"
                severity = "critical" if abs(z_score) > 5 else "warning"

                anomalies.append(AnomalyReport(
                    metric_name=metric_name,
                    anomaly_type=anomaly_type,
                    severity=severity,
                    detected_at=datetime.now(),
                    current_value=current_value,
                    expected_range=(avg - 2 * std, avg + 2 * std),
                    context={
                        "z_score": z_score,
                        "historical_avg": avg,
                        "historical_std": std,
                        "data_points": len(historical_values),
                    },
                ))

        return anomalies

    def build_ai_analysis_prompt(self, anomalies: list[AnomalyReport]) -> str:
        """Convert anomaly detection results into an AI analysis prompt"""
        if not anomalies:
            return "No anomalies were detected."

        anomaly_details = []
        for a in anomalies:
            anomaly_details.append(f"""
- Metric: {a.metric_name}
  Type: {a.anomaly_type} ({a.severity})
  Current value: {a.current_value:.2f}
  Expected range: {a.expected_range[0]:.2f} - {a.expected_range[1]:.2f}
  Z-score: {a.context['z_score']:.2f}
""")

        return f"""
Please analyze the following metric anomalies and suggest causes and countermeasures.

## Detected Anomalies ({len(anomalies)} items)
{''.join(anomaly_details)}

## Analysis Request
1. Correlations between anomalies (possibility that multiple anomalies stem from the same cause)
2. Estimated root causes (in order of likelihood)
3. Items to verify immediately
4. Mitigation measures and permanent fixes
"""
```

---

## 4. Auto-Fix and Suggestions

### 4.1 AI-Powered Bug Fix Suggestions

```python
# Automatically analyze and suggest fixes for failed tests in CI

class AutoFixSuggester:
    """Automatic fix suggestions on test failures"""

    def analyze_test_failure(self, test_output: str, source_files: dict) -> dict:
        """Analyze test failure causes and suggest fixes"""

        prompt = f"""
Please analyze the following test failure and suggest a fix.

## Test Output
```
{test_output}
```

## Related Source Code
"""
        for filename, content in source_files.items():
            prompt += f"\n### {filename}\n```python\n{content}\n```\n"

        prompt += """
Please respond in the following format:
1. Cause of failure
2. File and line number that need fixing
3. Fixed code (in diff format)
4. Rationale for why the fix does not affect other tests
"""
        return {"prompt": prompt}

    def suggest_fix_from_sentry(self, sentry_event: dict) -> dict:
        """Suggest fixes from Sentry error events"""
        prompt = f"""
The following error is occurring in production. Please suggest a fix.

Error: {sentry_event['title']}
Occurrences: {sentry_event['count']}
Affected users: {sentry_event['userCount']}
First seen: {sentry_event['firstSeen']}

Stack trace:
{sentry_event['stacktrace']}

Recent release:
{sentry_event.get('release', 'N/A')}
"""
        return {"prompt": prompt, "severity": self._assess_severity(sentry_event)}

    def _assess_severity(self, event: dict) -> str:
        """Assess the severity of an error"""
        if event.get("userCount", 0) > 100:
            return "critical"
        elif event.get("count", 0) > 50:
            return "high"
        elif event.get("count", 0) > 10:
            return "medium"
        return "low"
```

### 4.2 Recording and Sharing Debug Sessions

```python
# Building a knowledge base from debug sessions

class DebugSessionRecorder:
    """Record debug sessions for team sharing"""

    def record_session(self, session: dict) -> dict:
        """Structure and record a debug session"""
        record = {
            "id": generate_session_id(),
            "timestamp": datetime.now().isoformat(),
            "error": {
                "type": session["error_type"],
                "message": session["error_message"],
                "stacktrace": session["stacktrace"],
            },
            "investigation": {
                "hypotheses": session["hypotheses"],
                "steps_taken": session["investigation_steps"],
                "ai_suggestions": session["ai_suggestions"],
                "time_spent_minutes": session["time_spent"],
            },
            "resolution": {
                "root_cause": session["root_cause"],
                "fix_description": session["fix_description"],
                "fix_commit": session["commit_hash"],
                "tests_added": session["tests_added"],
            },
            "lessons": {
                "what_helped": session.get("what_helped", []),
                "what_hindered": session.get("what_hindered", []),
                "prevention_measures": session.get("prevention", []),
            },
            "tags": session.get("tags", []),
        }
        return record

    def search_similar_issues(self, error_message: str,
                               knowledge_base: list[dict]) -> list[dict]:
        """Search for similar debug records"""
        # Search based on text similarity
        results = []
        for record in knowledge_base:
            similarity = compute_text_similarity(
                error_message,
                record["error"]["message"]
            )
            if similarity > 0.6:
                results.append({
                    "record": record,
                    "similarity": similarity,
                    "resolution_summary": record["resolution"]["root_cause"],
                })
        return sorted(results, key=lambda x: -x["similarity"])[:5]
```

### 4.3 Integration with CI/CD Pipelines

```python
# GitHub Actions + AI debugging integration example

class CIDebugIntegration:
    """Automated AI debugging in CI/CD pipelines"""

    def analyze_ci_failure(self, workflow_run: dict) -> dict:
        """Automatically analyze CI failures and comment on PRs"""

        # Collect information about failed jobs
        failed_jobs = [
            job for job in workflow_run["jobs"]
            if job["conclusion"] == "failure"
        ]

        analysis_results = []
        for job in failed_jobs:
            # Fetch and parse logs
            log_content = self._fetch_job_logs(job["id"])
            error_sections = self._extract_error_sections(log_content)

            # Correlate with changed files
            changed_files = self._get_pr_changed_files(workflow_run["pr_number"])
            related_changes = self._correlate_errors_with_changes(
                error_sections, changed_files
            )

            analysis_results.append({
                "job_name": job["name"],
                "errors": error_sections,
                "related_changes": related_changes,
                "ai_prompt": self._build_ci_debug_prompt(
                    job, error_sections, related_changes
                ),
            })

        return {
            "workflow_run_id": workflow_run["id"],
            "analyses": analysis_results,
            "pr_comment": self._format_pr_comment(analysis_results),
        }

    def _build_ci_debug_prompt(self, job: dict, errors: list,
                                changes: list) -> str:
        """Build an AI analysis prompt for CI failures"""
        return f"""
Please analyze the following CI job failure.

## Job Information
- Name: {job['name']}
- Step: {job.get('failed_step', 'N/A')}

## Error Details
{chr(10).join(errors[:5])}

## Files Changed in PR
{chr(10).join(f'- {c["filename"]} (+{c["additions"]} -{c["deletions"]})' for c in changes[:10])}

## Analysis Request
1. Cause of failure (relation to changes)
2. How to fix
3. Steps to reproduce locally
"""

    def _format_pr_comment(self, analyses: list) -> str:
        """Format for PR comments"""
        comment = "## AI Debug Analysis Results\n\n"
        for analysis in analyses:
            comment += f"### {analysis['job_name']}\n"
            comment += f"**Detected errors**: {len(analysis['errors'])} items\n"
            if analysis['related_changes']:
                comment += f"**Related changed files**: "
                comment += ", ".join(
                    f"`{c['filename']}`" for c in analysis['related_changes'][:3]
                )
                comment += "\n"
            comment += "\n"
        return comment
```

---

## 5. Comparison Tables

| AI Debugging Tool | Target | Integration | Real-time | Cost |
|-------------------|:------:|:-----------:|:---------:|:----:|
| Claude Code | General | Terminal | Interactive | API usage-based |
| GitHub Copilot Chat | General | VS Code, JetBrains | Interactive | $10-39/mo |
| Cursor AI | General | Cursor Editor | Interactive | $20/mo |
| Sentry AI | Production errors | Sentry Dashboard | Automatic | From $26/mo |
| Datadog AI | Logs / APM | Datadog | Automatic | From $15/host |

| Debugging Approach | Speed | Accuracy | Context Understanding | Scope |
|--------------------|:-----:|:--------:|:---------------------:|:-----:|
| Paste error into AI | High | Medium | Low | General |
| AI + source code provided | Medium | High | High | General |
| AI + logs + traces | Low | Highest | Highest | Production issues |
| AI + debug record search | High | High | High | Known issues |
| Manual debugging only | Low | Highest | Highest | All |

---

## 6. Anti-Patterns

### Anti-Pattern 1: Blindly Trusting AI Responses

```
BAD:
  Paste error message into AI -> Apply the suggested fix as-is
  -> AI suggests a misguided fix (misdiagnosis due to insufficient context)
  -> Introduces new bugs, root cause remains unresolved

GOOD:
  1. Provide sufficient context to AI
     - Not just error messages, but related code, logs, and environment info
  2. Treat AI responses as "hypotheses"
     - Verify the proposed cause yourself
  3. Confirm with tests before applying fixes
     - Ensure existing tests pass + add new tests
  4. Understand the root cause before fixing
     - Be able to explain "why that bug occurred"
```

### Anti-Pattern 2: Questions with Insufficient Context

```
BAD:
  "I'm getting TypeError: Cannot read properties of undefined"
  -> AI can only give generic answers
  -> Suggested countermeasures are unrelated to the actual cause

GOOD:
  Provide information following the error report template:

  1. Error message + complete stack trace
  2. Code where the error occurs (20 lines before and after)
  3. Expected behavior vs actual behavior
  4. Reproduction steps
  5. Environment information (runtime version, OS, dependencies)
  6. Recent changes (git log --oneline -5)
  7. What has already been tried
```

### Anti-Pattern 3: Keeping Debug Knowledge Siloed

```
BAD:
  Only veteran engineers know how to fix specific bugs
  -> Knowledge silos, uneven debugging speed across the team
  -> Same bugs recur and the same investigation is repeated

GOOD:
  - Record debug sessions (cause, investigation process, fix method)
  - Build a team error pattern knowledge base
  - Write postmortems and share root causes and prevention measures
  - Share useful AI chat exchanges with the team
  - Use debug case studies for new member onboarding
```

### Anti-Pattern 4: Careless Sharing of Sensitive Information

```
BAD:
  Send production logs directly to external AI services
  -> API keys, user personal information, database connection strings leak
  -> Compliance violations, security incidents

GOOD:
  1. Mask sensitive information before sending
     - API keys: sk-****** -> [REDACTED_API_KEY]
     - Email addresses: user@example.com -> [EMAIL]
     - IP addresses: 192.168.1.1 -> [IP_ADDRESS]
  2. Use internally hosted LLMs (AWS Bedrock, etc.)
  3. Verify data processing agreements (GDPR, privacy laws)
  4. Record audit logs of content sent to AI
```

---

## 7. Practical Scenario: Using AI in Incident Response

### 7.1 Production Incident Response Timeline

```
Time    Event                                       AI Utilization
------------------------------------------------------------------------
00:00   Alert triggered (error rate spike)           -> AI: Summarize alert
00:02   On-call engineer begins investigation        -> AI: Search similar incidents
00:05   Log investigation begins                     -> AI: Analyze error log patterns
00:08   Hypothesis formation                         -> AI: Suggest verification points
00:12   Cause identified (DB connection pool exhaustion) -> AI: Generate mitigation code
00:15   Mitigation applied (connection limit increase) -> AI: Assess impact scope
00:20   Health check                                 -> AI: List metrics to verify
00:30   Postmortem writing begins                    -> AI: Organize timeline
01:00   Postmortem complete, permanent fix planned    -> AI: Suggest prevention measures
```

### 7.2 AI-Assisted Postmortem Template

```python
# AI-assisted postmortem creation after incidents

POSTMORTEM_AI_PROMPT = """
Please create a postmortem draft based on the following incident information.

## Incident Summary
- Start time: {incident_start}
- Recovery time: {incident_end}
- Impact scope: {impact}
- Severity: {severity}

## Timeline
{timeline}

## Detection Method
{detection}

## Root Cause
{root_cause}

## Actions Taken
{actions_taken}

## Template
Please output the postmortem in the following format:

### 1. Summary (3 lines or fewer)
### 2. Impact (quantitative)
### 3. Timeline (chronological)
### 4. Root Cause Analysis (5 Whys)
### 5. Fix Details
### 6. Prevention Measures (short-term / medium-term / long-term)
### 7. Lessons Learned (Good / Bad / Lucky)
"""
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main data processing logic"""
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
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

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
        """Remove by key"""
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
    print("All advanced tests passed!")

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

    print(f"Inefficient version: {slow_time:.4f} sec")
    print(f"Efficient version:   {fast_time:.6f} sec")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Verify configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Data volume growth | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify step by step**: Use log output and debuggers to verify hypotheses
5. **Fix and regression test**: After fixing, run tests on related areas as well

```python
# Debugging utilities
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Check disk and network I/O conditions
4. **Check concurrent connections**: Check connection pool status

| Issue Type | Diagnostic Tools | Countermeasures |
|-----------|-----------------|-----------------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexing, query optimization |
---

## 8. FAQ

### Q1. In what situations is AI debugging most effective?

**A.** (1) **Interpreting error messages**: Instantly understanding the meaning of unfamiliar library errors or cryptic messages. (2) **Dependency version incompatibilities**: AI identifies package compatibility issues from past cases. (3) **Pattern extraction from large volumes of logs**: Extracting anomalous patterns from massive logs that are difficult to inspect visually. (4) **Searching for similar bugs**: AI concretely matches the vague memory of "I've seen a similar error before." Conversely, business logic bugs and environment-specific issues are areas where AI struggles.

### Q2. How can AI be used safely for debugging production environments?

**A.** (1) **Mask sensitive information**: Mask passwords, API keys, and personal information before passing logs and code to AI. (2) **Use internally hosted LLMs**: Process highly confidential code with internally hosted LLMs (AWS Bedrock, Azure OpenAI, etc.). (3) **Separation of privileges**: Do not build mechanisms where AI directly accesses production environments. Have humans verify AI suggestions before applying them. (4) **Audit logs**: Keep logs of information sent to AI and suggestions received.

### Q3. How can a team improve its AI debugging capabilities?

**A.** (1) **Standardize prompt templates**: Create team-wide debug prompt templates to ensure all necessary information is provided without omissions. (2) **Build a knowledge base**: Record past debug sessions (causes, investigation processes, fix methods) and enable AI-powered similarity search. (3) **Pair debugging**: Conduct AI interactions through screen sharing in pairs to share effective prompt writing techniques. (4) **Regular retrospectives**: Measure debugging efficiency metrics (MTTR: Mean Time to Recovery) monthly and discuss improvements.

### Q4. What are tips for improving AI debugging accuracy?

**A.** (1) **Provide information incrementally**: Start with the error message and stack trace for initial analysis, then provide related code and configuration based on the results. (2) **Have AI generate multiple hypotheses**: Instruct "List 3 possible causes with probability and rationale for each." (3) **Provide negative information**: Convey causes that can be ruled out, such as "The DB is functioning normally" or "There are no network issues." (4) **Include reproduction code**: AI accuracy improves significantly when minimal reproduction code is provided.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently utilized in daily development work. It becomes particularly important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Error Analysis | Structure error messages + stack traces + related code + environment info and pass to AI |
| Prompt Design | Context volume determines accuracy. Use templates to prevent information gaps |
| Log Analysis | Structured logs + AI pattern analysis to detect anomalies from large volumes of logs |
| Distributed Tracing | Analyze OpenTelemetry trace data with AI to identify bottlenecks |
| Auto-Fix | AI suggestions are "hypotheses." Verify with tests before applying |
| Knowledge Sharing | Record debug sessions and build a team knowledge base |
| Incident Response | AI assists from timeline organization to postmortem creation |
| Security | Mask sensitive information, use internally hosted LLMs, maintain audit logs |

---

## Recommended Next Reads

- [AI Documentation Generation](./02-ai-documentation.md) -- Automated documentation of error reports
- AI Coding -- Code generation and bug prevention with AI
- [AI Ethics and Development](../03-team/03-ai-ethics-development.md) -- Ethical considerations in AI utilization

---

## References

1. **Debugging: The 9 Indispensable Rules** -- David J. Agans (AMACOM, 2002) -- Fundamental principles of debugging
2. **Sentry Documentation** -- https://docs.sentry.io/ -- Error tracking platform
3. **OpenTelemetry Documentation** -- https://opentelemetry.io/docs/ -- Distributed tracing standard
4. **Structured Logging with structlog** -- https://www.structlog.org/ -- Python structured logging library
