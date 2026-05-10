# SAST/DAST

> A guide to understanding the characteristics of static analysis (SAST) and dynamic analysis (DAST), and integrating security testing into CI/CD pipelines using SonarQube and OWASP ZAP

## What You Will Learn

1. **SAST Principles and Practice** — Early vulnerability detection through static analysis of source code
2. **DAST Principles and Practice** — Dynamic security testing against running applications
3. **CI/CD Integration** — How to naturally embed security testing into the development flow
4. **IAST and Hybrid Approaches** — Next-generation approaches that complement SAST and DAST
5. **Secret Scanning** — Detecting sensitive information embedded in source code
6. **Operational Best Practices** — Triage, tuning, and organizational adoption strategies


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Container Security](./02-container-security.md)

---

## 1. Overview of SAST and DAST

### Classification of Testing Methods

```
+----------------------------------------------------------+
|            Application Security Testing                   |
|----------------------------------------------------------|
|                                                          |
|  SAST (Static Application Security Testing)              |
|  +-- Analyzes source code                                |
|  +-- Can be run before build                             |
|  +-- Identifies issues at line-number level              |
|  +-- Tends to produce more false positives               |
|                                                          |
|  DAST (Dynamic Application Security Testing)             |
|  +-- Tests running app from the outside                  |
|  +-- Runs after deployment                               |
|  +-- Discovers actually exploitable vulnerabilities      |
|  +-- No source code required (black-box)                 |
|                                                          |
|  IAST (Interactive Application Security Testing)         |
|  +-- Embeds agent inside the application                 |
|  +-- Detects in real time                                |
|  +-- Hybrid of SAST + DAST                               |
|                                                          |
|  SCA (Software Composition Analysis)                     |
|  +-- Detects vulnerabilities in dependency libraries     |
|  +-- → Covered in detail in the "Dependency Security"    |
|          chapter                                         |
|                                                          |
|  RASP (Runtime Application Self-Protection)              |
|  +-- Real-time defense in production environment         |
|  +-- Automatically blocks when attack is detected        |
|  +-- Achieves layered defense in combination with WAF    |
+----------------------------------------------------------+
```

### Lifecycle Placement of Security Testing Methods

```
  Code writing   Commit      Build       Test      Staging       Production
      |            |          |           |            |              |
  IDE Plugin   pre-commit   SAST       Unit test     DAST           RASP
  Real-time    Semgrep    SonarQube   Security      OWASP ZAP     Monitoring
  lint         gitleaks   CodeQL      testing       Nuclei         WAF
      |            |          |           |            |              |
      v            v          v           v            v              v
  [Instant]   [Seconds]  [Minutes]  [Minutes]   [Tens of min]   [Always]
```

As this diagram shows, the further left (Shift Left) in the development lifecycle that security testing is placed, the lower the cost of remediation. SAST is positioned furthest to the left, while DAST is positioned after deployment. Combining both maximizes coverage.

### SAST vs DAST Comparison

| Item | SAST | DAST |
|------|------|------|
| Analysis target | Source code / bytecode | Running application |
| Execution timing | During development / at commit | After deployment / staging |
| Detectable vulnerabilities | Injection, hardcoded secrets, unsafe functions | XSS, auth failures, misconfigurations |
| False positives | High (30-70%) | Low (5-20%) |
| False negatives | Misses business logic vulnerabilities | Misses internal code issues |
| Language dependency | Yes (language-specific parsers) | No (protocol-based) |
| Ease of remediation | Easy with line number identification | Root cause can be hard to identify |
| Speed | Moderate (minutes to hours) | Slow (hours) |
| Required environment | Source code only | Execution environment required |
| Authentication testing | Weak | Strong |
| Misconfiguration detection | Limited | Strong |
| Scalability | High (easy to parallelize) | Moderate (execution environment needed) |

### Detection Coverage Differences Between SAST and DAST

```
        SAST excels at              Detectable by both          DAST excels at
+-------------------------+  +-------------------+  +-----------------------+
| Hardcoded secrets       |  | SQL Injection     |  | Auth/authz failures   |
| Buffer overflows        |  | XSS               |  | CSRF                  |
| Insecure random numbers |  | Path traversal    |  | Session management    |
| Dead code               |  | Command injection |  | HTTP header misconfig |
| Unused variables        |  | SSRF              |  | CORS misconfig        |
| Type safety issues      |  | XXE               |  | Missing rate limiting |
| NULL pointer dereference|  |                   |  | Info leak (error resp)|
| Resource leaks          |  |                   |  | TLS/SSL misconfig     |
+-------------------------+  +-------------------+  +-----------------------+
```

---

## 2. SAST in Practice

### 2.1 How SAST Works

SAST tools analyze source code through the following steps.

```
Source code → Lexical analysis → Syntax analysis (AST generation) → Semantic analysis → Data flow analysis → Pattern matching → Results
     |              |                  |                    |                |               |                |
  .py, .js      Tokenization      Abstract             Type inference    Taint            Rule matching   Vulnerability
  .go, .java    splitting         Syntax Tree          scope             tracking         (OWASP etc.)    report
                                  construction         resolution        (taint
                                                                        analysis)
```

**Data Flow Analysis (Taint Analysis)** is the core technology of SAST. It tracks the flow of data from user input (source) to dangerous operations (sink), and reports a vulnerability if no sanitization occurs in between.

```python
# Taint Analysis example
def handler(request):
    user_input = request.GET.get('query')   # Source: user input
    #                    |
    #              data flows
    #                    |
    #                    v
    result = db.execute(                     # Sink: SQL execution
        f"SELECT * FROM users WHERE name = '{user_input}'"  # Vulnerability detected!
    )
    return result

# Judged safe if sanitized
def safe_handler(request):
    user_input = request.GET.get('query')   # Source: user input
    #                    |
    #            sanitization
    #                    |
    #                    v
    sanitized = escape(user_input)           # Sanitizer
    result = db.execute(                     # Sink: SQL execution
        "SELECT * FROM users WHERE name = %s", [sanitized]   # Judged safe
    )
    return result
```

### 2.2 Code Analysis with SonarQube

#### SonarQube Architecture

```
+-------------------+       +-------------------+       +-------------------+
|  SonarQube Server |       |   Elasticsearch   |       |    PostgreSQL     |
|  (Web UI +        |<----->|  (Search engine)  |       |  (Data storage)   |
|   Compute Engine) |       +-------------------+       +-------------------+
+-------------------+                                          ^
        ^                                                      |
        |  Result submission                                   |
        |                                                      |
+-------------------+                                          |
|  SonarScanner     |------------------------------------------+
|  (Run analysis)   |  Save analysis results to DB
+-------------------+
        ^
        |  Read source code
        |
+-------------------+
|  Project          |
|  source code      |
+-------------------+
```

#### Basic Configuration

```properties
# sonar-project.properties
sonar.projectKey=myapp
sonar.projectName=My Application
sonar.projectVersion=1.0
sonar.sources=src
sonar.tests=tests
sonar.language=js
sonar.javascript.lcov.reportPaths=coverage/lcov.info

# Focus security rule settings
sonar.issue.ignore.multicriteria=e1
sonar.issue.ignore.multicriteria.e1.ruleKey=javascript:S1234
sonar.issue.ignore.multicriteria.e1.resourceKey=**/test/**

# Encoding settings
sonar.sourceEncoding=UTF-8

# Exclusion patterns
sonar.exclusions=**/node_modules/**,**/vendor/**,**/dist/**
sonar.test.exclusions=**/test/**,**/*.test.js
```

#### Quality Gate Configuration

```json
// SonarQube Quality Gate configuration example (via API)
// POST /api/qualitygates/create
{
  "name": "Security-Focused Gate",
  "conditions": [
    {
      "metric": "new_security_hotspots_reviewed",
      "op": "LT",
      "error": "100"
    },
    {
      "metric": "new_vulnerabilities",
      "op": "GT",
      "error": "0"
    },
    {
      "metric": "new_security_rating",
      "op": "GT",
      "error": "1"
    },
    {
      "metric": "new_coverage",
      "op": "LT",
      "error": "80"
    }
  ]
}
```

#### Explanation of Quality Gate Metrics

| Metric | Description | Recommended Threshold |
|--------|-------------|----------------------|
| `new_vulnerabilities` | Number of new vulnerabilities | 0 (block if even one exists) |
| `new_security_hotspots_reviewed` | Review rate for security hotspots | 100% |
| `new_security_rating` | Security rating (A-E) | Pass only with A (1) |
| `new_coverage` | Test coverage for new code | 80% or above |
| `new_duplicated_lines_density` | Duplication rate in new code | 3% or below |

#### SonarQube Integration with GitHub Actions

```yaml
# SonarQube integration with GitHub Actions
name: Code Quality
on: [push, pull_request]

jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for differential analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm test -- --coverage

      - name: SonarQube Scan
        uses: sonarsource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

      - name: Quality Gate Check
        uses: sonarsource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      - name: Post results to PR
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'SonarQube Quality Gate failed. Please check the SonarQube dashboard for details.'
            })
```

### 2.3 Semgrep (Lightweight SAST)

#### Semgrep Features and Working Principles

Semgrep is a lightweight SAST tool designed as "grep for code." Rather than using regular expressions, it performs pattern matching at the AST (Abstract Syntax Tree) level, making it unaffected by differences in code formatting or style.

```
Regular grep:                       Semgrep:
  Text-level matching                 AST-level matching

  Search for "eval("                  pattern: eval($X)
    → Matches "eval("                   → Matches eval(user_input)
    → Also matches "// eval(" (FP)      → Ignores comments (no FP)
    → Misses across line breaks (FN)    → Matches across line breaks
```

#### Creating Custom Rules

```yaml
# .semgrep.yml - custom rules
rules:
  - id: hardcoded-secret
    patterns:
      - pattern: |
          $KEY = "..."
      - metavariable-regex:
          metavariable: $KEY
          regex: '(?i)(password|secret|api_key|token)'
    message: "Hardcoded secret detected"
    severity: ERROR
    languages: [python, javascript, go]
    metadata:
      cwe: "CWE-798: Use of Hard-coded Credentials"
      owasp: "A07:2021 - Identification and Authentication Failures"

  - id: sql-injection
    patterns:
      - pattern: |
          cursor.execute(f"... {$VAR} ...")
    message: "Possible SQL Injection: use parameterized queries"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-89: SQL Injection"
      owasp: "A03:2021 - Injection"
    fix: |
      cursor.execute("... %s ...", ($VAR,))

  - id: unsafe-deserialization
    pattern: pickle.loads(...)
    message: "Unsafe deserialization: do not use pickle with untrusted data"
    severity: WARNING
    languages: [python]
    metadata:
      cwe: "CWE-502: Deserialization of Untrusted Data"

  - id: open-redirect
    patterns:
      - pattern: redirect($URL)
      - pattern-not: redirect("/...")
    message: "Possible open redirect: validate redirects to external URLs"
    severity: WARNING
    languages: [python]

  - id: missing-csrf-protection
    patterns:
      - pattern: |
          @app.route("...", methods=["POST"])
          def $FUNC(...):
              ...
      - pattern-not-inside: |
          @csrf_protect
          ...
    message: "POST endpoint has no CSRF protection"
    severity: WARNING
    languages: [python]

  - id: insecure-random
    patterns:
      - pattern-either:
          - pattern: random.random()
          - pattern: random.randint(...)
          - pattern: Math.random()
    message: "Use a cryptographically secure random number generator for security purposes"
    severity: WARNING
    languages: [python, javascript]
    fix-regex:
      regex: "random\\.random\\(\\)"
      replacement: "secrets.token_hex(32)"
```

#### Advanced Semgrep Patterns

```yaml
# Advanced pattern matching examples
rules:
  # taint mode: track contamination from source to sink
  - id: tainted-sql-query
    mode: taint
    pattern-sources:
      - pattern: request.args.get(...)
      - pattern: request.form.get(...)
      - pattern: request.json[...]
    pattern-sinks:
      - pattern: db.execute($QUERY, ...)
      - pattern: cursor.execute($QUERY, ...)
    pattern-sanitizers:
      - pattern: sanitize(...)
      - pattern: escape(...)
    message: "User input is used directly in a SQL query"
    severity: ERROR
    languages: [python]

  # join mode: combination of multiple conditions
  - id: jwt-without-verification
    patterns:
      - pattern: jwt.decode($TOKEN, ...)
      - pattern-not: jwt.decode($TOKEN, ..., verify=True, ...)
      - pattern-not: jwt.decode($TOKEN, ..., algorithms=[...], ...)
    message: "JWT signature verification may be disabled"
    severity: ERROR
    languages: [python]
```

#### Semgrep Execution Commands

```bash
# Basic Semgrep execution
semgrep --config auto .                    # Auto rule selection
semgrep --config .semgrep.yml .            # Custom rules
semgrep --config p/owasp-top-ten .         # OWASP Top 10 rules
semgrep --config p/javascript .            # JavaScript-specific rules
semgrep --config p/python .               # Python-specific rules
semgrep --config p/golang .               # Go-specific rules

# Specify output format
semgrep --config auto --json -o results.json .     # JSON format
semgrep --config auto --sarif -o results.sarif .   # SARIF format (for GitHub integration)
semgrep --config auto --emacs .                    # Emacs format

# CI/CD gate (fail build if errors exist)
semgrep --config auto --error .

# Scan only specific files
semgrep --config auto --include="*.py" .
semgrep --config auto --exclude="tests/*" .

# Scan only diff (speed up)
semgrep --config auto --baseline-commit HEAD~1 .

# Semgrep CI (Semgrep App integration)
SEMGREP_APP_TOKEN=xxx semgrep ci
```

### 2.4 Advanced Analysis with CodeQL

CodeQL is a SAST tool developed by GitHub that builds code as a database and allows searching for patterns using a SQL-like query language.

```ql
// CodeQL query example: SQL injection detection
import javascript
import DataFlow::PathGraph

class SqlInjectionConfig extends TaintTracking::Configuration {
  SqlInjectionConfig() { this = "SqlInjectionConfig" }

  override predicate isSource(DataFlow::Node source) {
    exists(Express::RequestExpr req |
      source.asExpr() = req.getAPropertyRead("query").getAPropertyRead(_)
    )
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(DatabaseAccess db |
      sink.asExpr() = db.getAQueryArgument()
    )
  }
}

from SqlInjectionConfig cfg, DataFlow::PathNode source, DataFlow::PathNode sink
where cfg.hasFlowPath(source, sink)
select sink, source, sink,
  "This SQL query contains user input from $@.",
  source.getNode(), "user input"
```

```yaml
# CodeQL integration with GitHub Actions
name: CodeQL Analysis
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6:00 UTC

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [javascript, python]
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          queries: +security-extended,security-and-quality

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"
```

### 2.5 SAST Tool Selection Guide by Language

#### SAST Tool Comparison

| Tool | Supported Languages | Speed | Custom Rules | Cost | Features |
|------|---------------------|-------|--------------|------|----------|
| SonarQube | 30+ | Moderate | Yes | CE: Free | Integrated quality management dashboard |
| Semgrep | 30+ | Fast | YAML-based | OSS: Free | Lightweight, easy custom rules |
| CodeQL | 10+ | Slow | QL language | Free on GitHub | High-precision data flow analysis |
| Bandit | Python | Fast | Plugins | Free | Python-specific, easy to introduce |
| ESLint Security | JavaScript | Fast | Rule-based | Free | eslint-plugin-security |
| gosec | Go | Fast | AST-based | Free | Go-specific |
| Brakeman | Ruby | Fast | - | Free | Rails-specific |
| SpotBugs | Java | Moderate | Plugins | Free | Find Security Bugs plugin |
| PHPStan | PHP | Fast | Rule extension | Free | Type analysis-based |

#### Recommended Configuration by Language

```
Python projects:
  Required: Semgrep + Bandit
  Recommended: + SonarQube (quality management)
  Optional: + CodeQL (when using GitHub)

JavaScript/TypeScript projects:
  Required: Semgrep + ESLint Security
  Recommended: + SonarQube (quality management)
  Optional: + CodeQL (when using GitHub)

Go projects:
  Required: Semgrep + gosec
  Recommended: + SonarQube (quality management)
  Optional: + staticcheck (additional lint)

Java projects:
  Required: SonarQube + SpotBugs (Find Security Bugs)
  Recommended: + Semgrep
  Optional: + CodeQL (when using GitHub)

Ruby/Rails projects:
  Required: Brakeman + Semgrep
  Recommended: + SonarQube (quality management)
```

### 2.6 Using Bandit (Python-specific SAST)

```bash
# Install and run Bandit
pip install bandit

# Basic run
bandit -r ./src/

# Filter by severity
bandit -r ./src/ -ll  # Medium and above only

# Run only specific tests
bandit -r ./src/ -t B601,B602,B603  # Shell injection tests

# JSON output
bandit -r ./src/ -f json -o bandit-results.json

# Exclusion settings
bandit -r ./src/ --exclude tests/,docs/
```

```ini
# .bandit - Bandit configuration file
[bandit]
exclude = tests,docs,venv
tests = B101,B102,B103,B104,B105,B106,B107,B108,B110
# B301-B303: pickle related
# B601-B603: shell injection
# B608: SQL injection

skips = B101  # Use of assert (needed in tests)

[bandit.plugins.hardcoded_password_string]
word_list = password,pass,passwd,pwd,secret,token,api_key,apikey
```

```python
# Typical vulnerabilities detected by Bandit

# B602: subprocess with shell=True (high risk)
import subprocess
user_input = input("Command: ")
subprocess.call(user_input, shell=True)  # Detected!

# B608: SQL injection
query = "SELECT * FROM users WHERE id = '%s'" % user_id  # Detected!

# B105: Hardcoded password
password = "super_secret_123"  # Detected!

# B301: Pickle usage
import pickle
data = pickle.loads(untrusted_data)  # Detected!

# B104: Binding to all interfaces
from flask import Flask
app = Flask(__name__)
app.run(host='0.0.0.0')  # Detected!
```

---

## 3. DAST in Practice

### 3.1 How DAST Works

DAST tools send test requests to a running application from the attacker's perspective.

```
DAST tool                       Target application
+------------------+          +------------------+
|                  |   HTTP   |                  |
|  1. Crawler      |--------->|  Web server      |
|    Build site    |<---------|  (Nginx, etc.)   |
|    map           |  Response|                  |
|                  |          |  Application     |
|  2. Passive      |--------->|  server          |
|    Scanner       |<---------|  (Django, etc.)  |
|    Monitor comms |          |                  |
|                  |          |  Database        |
|  3. Active       |--------->|                  |
|    Scanner       |<---------|                  |
|    Send attacks  |          |                  |
|                  |          +------------------+
|  4. Generate     |
|    report        |
|                  |
+------------------+

Example attack requests:
  Normal: GET /users?id=123
  XSS:    GET /users?id=<script>alert(1)</script>
  SQLi:   GET /users?id=123' OR '1'='1
  Path:   GET /users/../../../etc/passwd
```

### 3.2 Dynamic Testing with OWASP ZAP

#### ZAP Test Flow

```
ZAP test flow:

  +-- Spider (crawl) -----+
  |  Build site map        |
  |  Ajax Spider available |
  +-----------------------+
            |
            v
  +-- Passive Scan -------+
  |  Detect by observing  |
  |  (fast, low risk)     |
  |  e.g.: missing headers|
  |      Cookie attributes|
  +-----------------------+
            |
            v
  +-- Active Scan ---------+
  |  Send attack requests  |
  |  (slow, server load)   |
  |  e.g.: SQL Injection   |
  |      XSS               |
  |      Path Traversal    |
  +------------------------+
            |
            v
  +-- Report generation --+
  |  HTML / JSON / XML    |
  |  SARIF (GitHub integ) |
  +------------------------+
```

#### ZAP Scan Policy Configuration

```xml
<!-- ZAP scan policy configuration example -->
<configuration>
  <scanner>
    <!-- SQL Injection test -->
    <plugin id="40018" enabled="true" strength="HIGH" threshold="MEDIUM"/>
    <!-- XSS test -->
    <plugin id="40012" enabled="true" strength="HIGH" threshold="LOW"/>
    <!-- Path Traversal test -->
    <plugin id="6" enabled="true" strength="MEDIUM" threshold="MEDIUM"/>
    <!-- Remote Code Execution -->
    <plugin id="40014" enabled="true" strength="HIGH" threshold="HIGH"/>
    <!-- CSRF test -->
    <plugin id="40003" enabled="true" strength="MEDIUM" threshold="LOW"/>
  </scanner>
  <spider>
    <maxDuration>10</maxDuration>
    <maxDepth>5</maxDepth>
    <threadCount>5</threadCount>
  </spider>
</configuration>
```

#### ZAP Authentication Configuration

Most web applications require authentication. The following shows how to perform authenticated scans with ZAP.

```python
from zapv2 import ZAPv2
import time

zap = ZAPv2(apikey='your-api-key', proxies={
    'http': 'http://localhost:8080',
    'https': 'http://localhost:8080',
})

target = 'https://staging.example.com'

# Authentication configuration
context_id = zap.context.new_context('authenticated-context')

# Include URL pattern of login page
zap.context.include_in_context(context_id, f'{target}.*')

# Form-based authentication configuration
auth_method_config = (
    f'loginUrl={target}/login&'
    f'loginRequestData=username={{%username%}}&password={{%password%}}'
)
zap.authentication.set_authentication_method(
    context_id, 'formBasedAuthentication', auth_method_config
)

# Login state verification pattern
zap.authentication.set_logged_in_indicator(context_id, '\\QWelcome\\E')
zap.authentication.set_logged_out_indicator(context_id, '\\QLogin\\E')

# Add user
user_id = zap.users.new_user(context_id, 'test-user')
zap.users.set_authentication_credentials(
    context_id, user_id,
    f'username=testuser&password=TestPass123!'
)
zap.users.set_user_enabled(context_id, user_id, True)

# Run authenticated scan
zap.forcedUser.set_forced_user(context_id, user_id)
zap.forcedUser.set_forced_user_mode_enabled(True)
```

### 3.3 Automated Testing Using the ZAP API

```python
from zapv2 import ZAPv2
import time
import json
import sys

# Connect to ZAP
zap = ZAPv2(apikey='your-api-key', proxies={
    'http': 'http://localhost:8080',
    'https': 'http://localhost:8080',
})

target = 'https://staging.example.com'

def run_zap_scan(target_url, scan_type='full'):
    """Automated security scan with ZAP

    Args:
        target_url: URL to scan
        scan_type: 'baseline' (passive only) or 'full' (including active)

    Returns:
        tuple: (high_alerts, medium_alerts, low_alerts)
    """

    print(f"[*] Target: {target_url}")
    print(f"[*] Scan type: {scan_type}")

    # Step 1: Spider (crawl)
    print("[*] Phase 1: Spidering target...")
    scan_id = zap.spider.scan(target_url)
    while int(zap.spider.status(scan_id)) < 100:
        progress = zap.spider.status(scan_id)
        print(f"    Spider progress: {progress}%")
        time.sleep(2)

    urls_found = len(zap.spider.results(scan_id))
    print(f"[+] Spider found {urls_found} URLs")

    # Ajax Spider (SPA support)
    print("[*] Phase 1.5: Ajax Spidering...")
    zap.ajaxSpider.scan(target_url)
    timeout = 120  # 2-minute timeout
    while zap.ajaxSpider.status == 'running' and timeout > 0:
        time.sleep(5)
        timeout -= 5
    zap.ajaxSpider.stop()
    print(f"[+] Ajax Spider found additional URLs")

    # Step 2: Wait for passive scan to complete
    print("[*] Phase 2: Waiting for passive scan...")
    while int(zap.pscan.records_to_scan) > 0:
        remaining = zap.pscan.records_to_scan
        print(f"    Records remaining: {remaining}")
        time.sleep(1)
    print("[+] Passive scan completed")

    # Step 3: Active Scan (if not baseline)
    if scan_type == 'full':
        print("[*] Phase 3: Active scanning...")
        scan_id = zap.ascan.scan(target_url)
        while int(zap.ascan.status(scan_id)) < 100:
            progress = zap.ascan.status(scan_id)
            print(f"    Active scan progress: {progress}%")
            time.sleep(5)
        print("[+] Active scan completed")
    else:
        print("[*] Phase 3: Skipped (baseline scan)")

    # Step 4: Retrieve and classify results
    alerts = zap.core.alerts(baseurl=target_url)
    high_alerts = [a for a in alerts if a['risk'] == 'High']
    medium_alerts = [a for a in alerts if a['risk'] == 'Medium']
    low_alerts = [a for a in alerts if a['risk'] == 'Low']
    info_alerts = [a for a in alerts if a['risk'] == 'Informational']

    print(f"\n[=] Results Summary:")
    print(f"    High:          {len(high_alerts)}")
    print(f"    Medium:        {len(medium_alerts)}")
    print(f"    Low:           {len(low_alerts)}")
    print(f"    Informational: {len(info_alerts)}")

    # List of deduplicated vulnerability types
    unique_alerts = set()
    for alert in high_alerts + medium_alerts:
        unique_alerts.add(f"[{alert['risk']}] {alert['alert']}")
    if unique_alerts:
        print(f"\n[!] Unique vulnerability types found:")
        for ua in sorted(unique_alerts):
            print(f"    - {ua}")

    # HTML report output
    with open('zap-report.html', 'w') as f:
        f.write(zap.core.htmlreport())
    print(f"\n[+] HTML report saved to zap-report.html")

    # JSON report output
    with open('zap-report.json', 'w') as f:
        json.dump(alerts, f, indent=2)
    print(f"[+] JSON report saved to zap-report.json")

    return high_alerts, medium_alerts, low_alerts

# Execute
high, medium, low = run_zap_scan(target, scan_type='full')

# CI/CD gate decision
if high:
    print("\n[FAIL] CRITICAL: High-risk vulnerabilities found!")
    for alert in high:
        print(f"  - {alert['alert']}: {alert['url']}")
    sys.exit(1)
elif medium:
    print("\n[WARN] Medium-risk vulnerabilities found (not blocking)")
    sys.exit(0)
else:
    print("\n[PASS] No high/medium-risk vulnerabilities found")
    sys.exit(0)
```

### 3.4 ZAP CI/CD Integration

```yaml
# ZAP scan with GitHub Actions
name: DAST Scan
on:
  deployment_status:

jobs:
  zap-baseline:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: ${{ github.event.deployment.payload.url }}
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
          issue_title: 'ZAP Baseline Scan Report'
          fail_action: true

      - name: Upload ZAP Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-baseline-report
          path: report_html.html

  zap-full:
    needs: zap-baseline
    if: contains(github.event.deployment.environment, 'staging')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: ZAP Full Scan
        uses: zaproxy/action-full-scan@v0.10.0
        with:
          target: ${{ github.event.deployment.payload.url }}
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a -j'

      - name: Upload Full Scan Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-full-report
          path: report_html.html
```

#### ZAP Rules File Configuration

```tsv
# .zap/rules.tsv
# Rule ID	Action	Description
10010	IGNORE	Cookie No HttpOnly Flag (low risk, handled elsewhere)
10011	IGNORE	Cookie Without Secure Flag (development environment)
10015	WARN	Incomplete or No Cache-control Header Set
10017	FAIL	Cross-Domain JavaScript Source File Inclusion
10020	FAIL	X-Frame-Options Header Not Set
10021	FAIL	X-Content-Type-Options Header Missing
10038	FAIL	Content Security Policy (CSP) Header Not Set
40012	FAIL	Cross Site Scripting (Reflected)
40014	FAIL	Cross Site Scripting (Persistent)
40018	FAIL	SQL Injection
90022	FAIL	Application Error Disclosure
```

### 3.5 Fast DAST with Nuclei

Nuclei is a fast vulnerability scanner based on YAML templates.

```yaml
# Nuclei template example: custom vulnerability check
id: custom-admin-panel-check
info:
  name: Admin Panel Detection
  author: security-team
  severity: medium
  description: Detect publicly exposed admin panels
  tags: admin,panel,exposure

requests:
  - method: GET
    path:
      - "{{BaseURL}}/admin"
      - "{{BaseURL}}/admin/login"
      - "{{BaseURL}}/wp-admin"
      - "{{BaseURL}}/administrator"
      - "{{BaseURL}}/manage"
    matchers-condition: or
    matchers:
      - type: status
        status:
          - 200
      - type: word
        words:
          - "admin"
          - "login"
          - "dashboard"
        condition: or
```

```bash
# Run Nuclei
nuclei -u https://staging.example.com -t nuclei-templates/    # Specify templates
nuclei -u https://staging.example.com -tags cve               # CVE templates
nuclei -u https://staging.example.com -severity critical,high  # Severity filter
nuclei -l urls.txt -t nuclei-templates/ -o results.json -json  # Batch execution
```

---

## 4. IAST (Interactive Application Security Testing)

### 4.1 How IAST Works

IAST embeds an agent (instrumentation) inside the application and detects vulnerabilities in real time during execution. It is a hybrid approach that combines the advantages of both SAST and DAST.

```
DAST (External testing)          IAST Agent (Internal monitoring)
+------------------+            +----------------------------------+
|  Send test       |  ------->  |  Web application                 |
|  requests        |            |  +----------------------------+  |
|                  |            |  | IAST Agent                 |  |
|                  |            |  | +-- HTTP request analysis  |  |
|  Receive         |  <-------  |  | +-- Data flow tracking     |  |
|  responses       |            |  | +-- SQL query monitoring   |  |
|                  |            |  | +-- File access monitoring |  |
+------------------+            |  | +-- External call monit.   |  |
                                |  +----------------------------+  |
                                +----------------------------------+
                                           |
                                           v
                                +----------------------------+
                                | Vulnerability report        |
                                | - Source code line numbers  |
                                | - Full data flow path       |
                                | - Whether actually exploitable|
                                +----------------------------+
```

### 4.2 IAST vs SAST vs DAST

| Characteristic | SAST | DAST | IAST |
|----------------|------|------|------|
| False positive rate | High (30-70%) | Low (5-20%) | Very low (<5%) |
| False negative rate | Moderate | Moderate | Low |
| Code line identification | Yes | No | Yes |
| Execution environment needed | No | Yes | Yes |
| Performance impact | None | External load | 2-5% overhead |
| Business logic detection | Difficult | Partial | Possible |
| Deployment cost | Low | Low | High |
| Representative tools | Semgrep, SonarQube | ZAP, Nuclei | Contrast, Hdiv |

### 4.3 IAST Agent Deployment Example (Java)

```java
// Deploying IAST agent in a Java application
// Add to JVM startup options
// java -javaagent:/path/to/contrast.jar -jar myapp.jar

// Or configure in Dockerfile
// FROM eclipse-temurin:21-jre
// COPY contrast.jar /opt/contrast/
// ENV JAVA_TOOL_OPTIONS="-javaagent:/opt/contrast/contrast.jar"
// COPY myapp.jar /app/
// CMD ["java", "-jar", "/app/myapp.jar"]
```

```yaml
# contrast_security.yaml - IAST agent configuration
api:
  url: https://app.contrastsecurity.com/Contrast
  api_key: ${CONTRAST_API_KEY}
  service_key: ${CONTRAST_SERVICE_KEY}

agent:
  java:
    enable_assess: true        # Enable IAST functionality
    enable_protect: false      # RASP functionality (for production)
    assess:
      enable_sampling: true
      sampling_window: 180
      sampling_request_frequency: 5
    rules:
      disabled_rules:
        - cookie-flags-missing  # Ignore in test environment
```

---

## 5. Integration into CI/CD Pipeline

### 5.1 Placement of Security Testing

```
Developer PC    →    CI/CD Pipeline    →    Staging    →    Production
    |                    |                      |                |
 [pre-commit]      [At build]           [After deploy]     [Continuous]
    |                    |                      |                |
  Semgrep          SonarQube              OWASP ZAP         Runtime
  (instant)        Semgrep                Nuclei             monitoring
                   SCA (Trivy)            (DAST)             (IAST/RASP)
                   Secret scan                                WAF
                   (SAST + SCA)

Remediation cost:  $1          $10                   $100             $1000
  (The further left (Shift Left), the lower the remediation cost)
```

### 5.2 Complete Integrated Pipeline

```yaml
# .github/workflows/security-pipeline.yml
name: Security Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ====================================
  # Stage 1: Static analysis (parallel)
  # ====================================
  sast-semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Semgrep Scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/owasp-top-ten
            p/r2c-security-audit
            .semgrep.yml
          generateSarif: true

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif

  sast-sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: SonarQube Scan
        uses: sonarsource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

      - name: Quality Gate
        uses: sonarsource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # ====================================
  # Stage 1b: SCA + Secret scan (parallel)
  # ====================================
  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'
          format: 'sarif'
          output: 'trivy-fs-results.sarif'

      - name: Upload Trivy SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-fs-results.sarif

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Scan full history

      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ====================================
  # Stage 2: Container scan
  # ====================================
  container-scan:
    needs: [sast-semgrep, sast-sonarqube, sca, secret-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build container image
        run: docker build -t ${{ env.IMAGE_NAME }}:${{ github.sha }} .

      - name: Trivy image scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ env.IMAGE_NAME }}:${{ github.sha }}'
          severity: 'CRITICAL'
          exit-code: '1'
          format: 'sarif'
          output: 'trivy-image-results.sarif'

      - name: Upload Trivy Image SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-image-results.sarif

  # ====================================
  # Stage 3: DAST (staging environment)
  # ====================================
  dast:
    needs: container-scan
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        id: deploy
        run: |
          # Deploy to staging environment
          echo "staging_url=https://staging.example.com" >> $GITHUB_OUTPUT

      - name: Wait for deployment
        run: |
          for i in $(seq 1 30); do
            if curl -sf "${{ steps.deploy.outputs.staging_url }}/health"; then
              echo "Deployment is healthy"
              exit 0
            fi
            sleep 10
          done
          echo "Deployment health check failed"
          exit 1

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: ${{ steps.deploy.outputs.staging_url }}
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'
          fail_action: true

      - name: ZAP Full Scan (weekly)
        if: github.event.schedule != ''
        uses: zaproxy/action-full-scan@v0.10.0
        with:
          target: ${{ steps.deploy.outputs.staging_url }}

  # ====================================
  # Stage 4: Security report aggregation
  # ====================================
  security-summary:
    needs: [sast-semgrep, sast-sonarqube, sca, secret-scan, container-scan]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Security Summary
        run: |
          echo "## Security Scan Summary" >> $GITHUB_STEP_SUMMARY
          echo "| Check | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| SAST (Semgrep) | ${{ needs.sast-semgrep.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| SAST (SonarQube) | ${{ needs.sast-sonarqube.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| SCA (Trivy) | ${{ needs.sca.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Secrets (Gitleaks) | ${{ needs.secret-scan.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Container Scan | ${{ needs.container-scan.result }} |" >> $GITHUB_STEP_SUMMARY
```

### 5.3 SAST Integration with pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  # Semgrep (SAST)
  - repo: https://github.com/returntocorp/semgrep
    rev: v1.50.0
    hooks:
      - id: semgrep
        args: ['--config', 'auto', '--error']

  # Gitleaks (secret scanning)
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  # Bandit (Python SAST)
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.7
    hooks:
      - id: bandit
        args: ['-ll', '-ii']

  # ESLint Security (JavaScript SAST)
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.56.0
    hooks:
      - id: eslint
        additional_dependencies:
          - eslint-plugin-security@2.1.0

  # Hadolint (Dockerfile lint)
  - repo: https://github.com/hadolint/hadolint
    rev: v2.12.0
    hooks:
      - id: hadolint
```

```bash
# Set up pre-commit
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg

# Run on all files (initial run)
pre-commit run --all-files

# Run only specific hooks
pre-commit run semgrep --all-files
pre-commit run gitleaks --all-files
```

---

## 6. Secret Scanning

### 6.1 Importance of Secret Scanning

Sensitive information embedded in source code (API keys, passwords, certificates, etc.) is one of the most commonly exploited vulnerabilities. According to GitGuardian's research, 12.8 million secrets were detected in public repositories in 2023.

```
Typical flow of a secret leak:

  Developer embeds API key        Committed to Git         Pushed to GitHub
  in source code             →   and left in history  →   and made public
        |                              |                         |
        v                              v                         v
  Left as "just a              Remains in history even    Bots detect and
  temporary test"              after git rm               exploit within minutes
```

### 6.2 Using gitleaks

```bash
# Install and run gitleaks
# macOS
brew install gitleaks

# Scan current repository
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# Scan entire Git history
gitleaks detect --source . --report-format json --report-path gitleaks-report.json --log-opts="--all"

# Scan only a specific commit range
gitleaks detect --source . --log-opts="HEAD~10..HEAD"

# Scan only diff (for CI/CD, fast)
gitleaks protect --staged  # Staged files only
```

```toml
# .gitleaks.toml - custom rule configuration
title = "Custom Gitleaks Configuration"

[allowlist]
description = "Global allowlist"
paths = [
    '''test/.*''',
    '''.*_test\.go''',
    '''.*\.test\.js''',
    '''fixtures/.*''',
    '''__mocks__/.*''',
]
regexTarget = "match"

# AWS Access Key
id = "aws-access-key"
description = "AWS Access Key ID"
regex = '''AKIA[0-9A-Z]{16}'''
tags = ["aws", "credentials"]
entropy = 3.5

# AWS Secret Key
id = "aws-secret-key"
description = "AWS Secret Access Key"
regex = '''(?i)aws_secret_access_key\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?'''
tags = ["aws", "credentials"]

# Generic API Key
id = "generic-api-key"
description = "Generic API Key"
regex = '''(?i)(api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]'''
tags = ["api", "generic"]

# GitHub Token
id = "github-token"
description = "GitHub Personal Access Token"
regex = '''ghp_[a-zA-Z0-9]{36}'''
tags = ["github", "token"]

# Slack Webhook
id = "slack-webhook"
description = "Slack Webhook URL"
regex = '''https://hooks\.slack\.com/services/T[a-zA-Z0-9]{8}/B[a-zA-Z0-9]{8}/[a-zA-Z0-9]{24}'''
tags = ["slack", "webhook"]

# Private Key
id = "private-key"
description = "Private Key"
regex = '''-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'''
tags = ["key", "private"]

# JWT
id = "jwt-token"
description = "JSON Web Token"
regex = '''eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+'''
tags = ["jwt", "token"]

# Rule-specific allowlist
id = "generic-password"
description = "Generic Password"
regex = '''(?i)(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]'''
tags = ["password"]
[rules.allowlist]
regexes = [
    '''(?i)password\s*[:=]\s*'"['"]''',
]
```

### 6.3 Response Procedure When a Secret Is Leaked

```
Response flow when a secret leak is discovered:

  1. Immediately revoke the secret
     +-- API key: revoke from dashboard
     +-- Password: change immediately
     +-- Certificate: add to revocation list
     |
  2. Investigate the scope of impact
     +-- Review access logs that used the secret
     +-- Investigate traces of unauthorized use
     +-- Identify affected systems
     |
  3. Remove from Git history (optional)
     +-- Use git filter-branch or BFG Repo-Cleaner
     +-- However, account for the possibility that it has already been cloned
     |
  4. Issue new secret
     +-- Manage with more secure methods (Vault, AWS Secrets Manager, etc.)
     +-- Inject into application via environment variables
     |
  5. Prevention measures
     +-- Add gitleaks to pre-commit hooks
     +-- Integrate secret scanning into CI/CD pipeline
     +-- Team education
```

```bash
# Removing secrets with BFG Repo-Cleaner
# * Use as a last resort. Affects the entire team.

# 1. Create a bare clone
git clone --mirror https://github.com/user/repo.git

# 2. Remove files containing secrets with BFG
java -jar bfg.jar --replace-text passwords.txt repo.git

# 3. Clean up
cd repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Push (force push required)
git push
```

---

## 7. Triage and Management of Results

### 7.1 Triage Process

```
Scan results
    |
    v
+-- Severity classification --+
|                              |
|  Critical     | → Fix immediately (within 24h) → Block build
|  High         | → Fix immediately (within 48h) → Block build
|  Medium       | → Address in next sprint → Warning only
|  Low          | → Add to backlog → Informational
|  Info         | → Log only → Ignore
|                              |
+-- False positive assessment --+
|                              |
|  Confirm false positive | → Add to suppression rules
|  Document reason        | → Share with team
|                              |
+------------------------------+
```

### 7.2 Managing False Positives

```yaml
# Semgrep false positive suppression

# Inline suppression (always include the reason)
def get_system_info():
    # nosemgrep: hardcoded-secret  # System constant, not a secret
    DEFAULT_REGION = "us-east-1"
    return DEFAULT_REGION

# File-level suppression (.semgrepignore)
# .semgrepignore
tests/
fixtures/
**/testdata/**
vendor/
```

```properties
# SonarQube false positive suppression

# Suppress inline
String query = buildQuery(param); // NOSONAR - parameter has been validated

# Can also suppress from SonarQube UI:
# Issues → Mark as Won't Fix / False Positive
# Record the reason as a comment
```

### 7.3 Metrics and Dashboard

```
Recommended metrics:

  +-- Security metrics -----------+
  |                               |
  |  Vulnerability density        |  Vulnerabilities / 1000 lines of code
  |  Mean Time to Remediate (MTTR)|  Average days from detection to fix
  |  False positive rate          |  False positives / total detections
  |  Scan coverage               |  Scanned repos / total repos
  |  Quality Gate pass rate      |  Passing builds / total builds
  |  Critical vulnerability backlog| Unresolved Critical/High count
  |                               |
  +-------------------------------+

  Example target values:
  - Vulnerability density: < 1.0 (per 1000 lines)
  - MTTR (Critical): < 24 hours
  - MTTR (High): < 1 week
  - False positive rate: < 20%
  - Scan coverage: > 95%
  - Quality Gate pass rate: > 90%
```

---

## 8. Anti-Patterns and Best Practices

### Anti-Pattern 1: Ignoring Security Scan Results

```
Bad: Scan produces 200 warnings but all are ignored
  → False positives and real vulnerabilities mix, everything is left unaddressed
  → "Alert fatigue" sets in and the tool itself gets ignored

Good: Set up a triage process
  1. Critical/High → Fix immediately (block build)
  2. Medium → Address in next sprint
  3. Low/Info → Add to backlog
  4. False positives → Add to suppression rules and document
```

### Anti-Pattern 2: Being Satisfied with SAST Alone

```
Bad: Only perform SAST and declare "security testing complete"
  → SAST cannot detect failures in authentication flows or authorization logic
  → Business logic vulnerabilities are missed

Good: Combination of SAST + DAST + SCA
  SAST → Detect vulnerability patterns in code
  DAST → Actual attack simulation
  SCA  → Detect known vulnerabilities in dependencies
  Manual penetration testing → Validate business logic
```

### Anti-Pattern 3: Starting with All Rules Enabled

```
Bad: Enable all rules on day one of SAST tool introduction
  → Thousands of warnings overwhelm the team
  → The tool gets dismissed as "unusable" and is left alone

Good: Gradual introduction
  Week 1: Enable Critical rules only (10-20 detections)
  Week 2: Add High rules
  Week 4: Add Medium rules
  Month 2: Begin adding custom rules
  Month 3: Gradually tighten Quality Gate
```

### Anti-Pattern 4: Dumping Scan Results on Developers

```
Bad: Send scan results to developers with "please fix everything"
  → Without security knowledge, they don't know how to fix issues
  → Priority is unclear and issues are left unaddressed

Good: Security Champion program
  1. Place a Security Champion in each team
  2. Determine priorities in triage meetings
  3. Include fix guidance in vulnerability reports
  4. Conduct regular security training
```

### Anti-Pattern 5: Running DAST Against Production

```
Bad: Run Active Scan against production environment
  → Risk of data corruption
  → Risk of service disruption
  → Detected as an attack, triggering alerts

Good: Use environments appropriately
  Production: Baseline Scan (passive scan) only
  Staging: Full Scan (including active scan)
  Development: Manual testing by developers
```

---

## 9. Practice Exercises

### Exercise 1: Creating Semgrep Custom Rules

Create Semgrep rules to detect the vulnerabilities in the following code.

```python
# vulnerable_app.py
from flask import Flask, request, render_template_string
import subprocess
import os

app = Flask(__name__)

@app.route('/search')
def search():
    query = request.args.get('q', '')
    # Vulnerability 1: Template injection
    return render_template_string(f'<h1>Results for: {query}</h1>')

@app.route('/ping')
def ping():
    host = request.args.get('host', '')
    # Vulnerability 2: Command injection
    result = subprocess.run(f'ping -c 1 {host}', shell=True, capture_output=True)
    return result.stdout.decode()

@app.route('/file')
def read_file():
    filename = request.args.get('name', '')
    # Vulnerability 3: Path traversal
    filepath = os.path.join('/var/data', filename)
    with open(filepath) as f:
        return f.read()
```

<details>
<summary>Example Answer</summary>

```yaml
rules:
  - id: ssti-flask
    patterns:
      - pattern: render_template_string(f"...", ...)
      - pattern-not: render_template_string("...", ...)
    message: "Flask template injection (SSTI): do not use f-strings with render_template_string"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-1336: Server-Side Template Injection"

  - id: command-injection-subprocess
    patterns:
      - pattern: subprocess.run(f"...", shell=True, ...)
      - pattern: subprocess.call(f"...", shell=True, ...)
      - pattern: subprocess.Popen(f"...", shell=True, ...)
    message: "Command injection: combining f-strings with shell=True is dangerous"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-78: OS Command Injection"

  - id: path-traversal-open
    patterns:
      - pattern: |
          $PATH = os.path.join(..., $INPUT)
          ...
          open($PATH, ...)
      - pattern-not-inside: |
          if os.path.realpath($PATH).startswith(...):
              ...
    message: "Path traversal: validate the file path"
    severity: ERROR
    languages: [python]
    metadata:
      cwe: "CWE-22: Path Traversal"
```
</details>

### Exercise 2: Designing a CI/CD Pipeline

Design a GitHub Actions workflow that meets the following requirements.

- Full-stack application with Python + React (TypeScript)
- On PR: SAST (Semgrep + Bandit) + SCA (Trivy) + secret scanning
- On main merge: the above + container scan + DAST (ZAP Baseline)
- Weekly: Full DAST scan
- Results integrated into GitHub Security tab in SARIF format

<details>
<summary>Example Answer (skeleton)</summary>

```yaml
name: Full Security Pipeline
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 02:00 UTC

jobs:
  # PR + main: SAST
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep
        run: semgrep --config auto --sarif -o semgrep.sarif .
      - name: Bandit
        run: bandit -r backend/ -f sarif -o bandit.sarif
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: semgrep.sarif

  # PR + main: SCA
  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          format: sarif
          output: trivy.sarif

  # PR + main: Secret Scan
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2

  # main only: Container Scan
  container:
    if: github.event_name == 'push'
    needs: [sast, sca, secrets]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t app:test .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: app:test
          severity: CRITICAL,HIGH

  # main only: DAST Baseline
  dast-baseline:
    if: github.event_name == 'push'
    needs: container
    runs-on: ubuntu-latest
    steps:
      - uses: zaproxy/action-baseline@v0.12.0
        with:
          target: https://staging.example.com

  # Weekly: Full DAST
  dast-full:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: zaproxy/action-full-scan@v0.10.0
        with:
          target: https://staging.example.com
```
</details>

### Exercise 3: Triage in Practice

Classify the following SAST/DAST scan results by severity and response priority, and indicate the response policy for each item.

| # | Tool | Finding | File |
|---|------|---------|------|
| 1 | Semgrep | SQL Injection in user query | src/db/users.py:42 |
| 2 | SonarQube | Hardcoded password in config | src/config.py:15 |
| 3 | ZAP | Missing X-Content-Type-Options header | / |
| 4 | Trivy | CVE-2024-1234 (CVSS 9.8) in log4j | pom.xml |
| 5 | Bandit | Use of assert in production code | src/auth/verify.py:88 |
| 6 | ZAP | Server version disclosed in header | / |
| 7 | Semgrep | eval() with user input | src/api/dynamic.py:23 |
| 8 | gitleaks | AWS Access Key in commit history | - |

<details>
<summary>Example Answer</summary>

| # | Severity | Priority | Response Policy |
|---|----------|----------|----------------|
| 1 | Critical | Immediate (24h) | Rewrite with parameterized queries. Block build |
| 2 | High | Immediate (48h) | Migrate to environment variables or Secrets Manager |
| 3 | Low | Backlog | Add X-Content-Type-Options: nosniff in web server config |
| 4 | Critical | Immediate (24h) | Update log4j to fixed version |
| 5 | Low | Backlog | Replace assert with proper exception handling (impact is limited) |
| 6 | Info | Log only | Consider removing Server header |
| 7 | Critical | Immediate (24h) | Replace eval with a safe alternative |
| 8 | Critical | Immediate | Revoke AWS key immediately and issue a new one. Remove from history with BFG |
</details>

---

## 10. FAQ

### Q1. What to do when there are too many SAST false positives?

First, narrow rules to HIGH/CRITICAL severity to reduce noise. Then suppress false positives with inline comments (`// NOSONAR`, `// nosemgrep`) and document the reasons. It is important to establish team-wide triage rules and regularly review rule configurations.

A gradual introduction approach is also effective: start with only Critical rules enabled, and gradually add rules as the team becomes accustomed. If the false positive rate exceeds 30%, the rules need to be reviewed.

### Q2. In which environment should DAST be run?

Running DAST against production is high-risk (data corruption and service impact). The standard approach is to prepare a staging environment with equivalent configuration to production and run DAST there. Baseline Scan (passive only) can be run against production relatively safely.

Recommended scan types by environment:
- **Development environment**: Manual testing by developers, ZAP proxy mode
- **Staging environment**: Full Scan (including Active Scan)
- **Production environment**: Baseline Scan only (passive scan)

### Q3. Which should be chosen, SonarQube or Semgrep?

SonarQube can integrate overall code quality management (bugs, code smells, coverage) and has a rich dashboard. Semgrep is specialized for security, makes custom rule creation easy, and has fast execution speed. The two are complementary, and using them together is ideal.

- **Small teams / startups**: Starting with Semgrep alone is sufficient
- **Medium to large organizations**: SonarQube (quality management) + Semgrep (security-specific)
- **GitHub-centric workflows**: CodeQL + Semgrep

### Q4. What to do when there is organizational resistance to adopting SAST/DAST?

Gradual introduction is important.

1. **Awareness phase**: Share examples of security incidents to raise awareness of the need
2. **Pilot phase**: Introduce in one project and demonstrate effectiveness
3. **Rollout phase**: Expand to other projects based on success stories
4. **Start in "information mode"**: Output reports only without blocking builds
5. **Gate after stabilization**: Enable build blocking once false positives are sufficiently managed

### Q5. Should IAST be adopted?

IAST is an excellent technology that complements the weaknesses of SAST and DAST, but it has high adoption costs (many commercial tools) and performance overhead in production environments needs to be considered.

- **Recommended when**: Security requirements are strict (finance, healthcare), suffering from false positives with SAST/DAST
- **Not recommended when**: Budget is limited, sufficient coverage is already achieved with SAST + DAST

### Q6. What to do when scan time slows down the CI/CD pipeline?

Consider the following optimizations:

1. **Differential scan**: Scan only changed files (`semgrep --baseline-commit`)
2. **Parallel execution**: Run SAST/SCA/secret scans in parallel
3. **Cache utilization**: Enable SonarQube incremental analysis
4. **Separate scans**: SAST only on PR, Full Scan on merge
5. **Weekly scans**: Run Full DAST on a weekly schedule

### Q7. What is the SAST/DAST strategy in a microservices architecture?

In a microservices environment, run SAST per service and run DAST in the integration testing environment. Both testing through the API Gateway and testing of inter-service communication are needed.

```
API Gateway → DAST (external-facing APIs)
    |
    +-- Service A → SAST (individual)
    +-- Service B → SAST (individual)
    +-- Service C → SAST (individual)
    |
Inter-API communication → Contract Testing + DAST
```

### Q8. Is SAST/DAST mandatory for compliance requirements (PCI DSS, SOC2, etc.)?

Security testing requirements in major compliance frameworks:

| Framework | SAST | DAST | Penetration Testing |
|-----------|------|------|---------------------|
| PCI DSS v4.0 | Recommended | Recommended | Required (annual) |
| SOC 2 Type II | Recommended | Recommended | Recommended |
| HIPAA | Recommended | Recommended | Recommended |
| ISO 27001 | Recommended | Recommended | Recommended |
| NIST SP 800-53 | Required (SA-11) | Required (SA-11) | Required (CA-8) |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving on to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| SAST | Early detection of vulnerability patterns in code (Semgrep, SonarQube, CodeQL) |
| DAST | Attack simulation against running application (OWASP ZAP, Nuclei) |
| IAST | Hybrid of SAST + DAST, low false positive rate (Contrast, Hdiv) |
| SCA | Detect known vulnerabilities in dependency libraries (Trivy) |
| Secret scanning | Detect secrets embedded in code (gitleaks) |
| CI/CD integration | Staged pipeline: SAST → container scan → DAST |
| Triage | Set response SLAs by severity and manage false positives |
| Shift Left | Place testing early in the development lifecycle to reduce remediation costs |
| Gradual adoption | Start with Critical rules, gradually tighten rules and gates |

---

## Guides to Read Next

- [Secure Coding](./00-secure-coding.md) — Fundamental remediation for vulnerabilities detected by SAST
- [Dependency Security](./01-dependency-security.md) — Details on SCA
- [Container Security](./02-container-security.md) — Scanning container images

---

## References

1. **OWASP Testing Guide** — https://owasp.org/www-project-web-security-testing-guide/
2. **OWASP ZAP Documentation** — https://www.zaproxy.org/docs/
3. **Semgrep Documentation** — https://semgrep.dev/docs/
4. **NIST SP 800-218 — Secure Software Development Framework** — https://csrc.nist.gov/publications/detail/sp/800-218/final
5. **SonarQube Documentation** — https://docs.sonarqube.org/latest/
6. **CodeQL Documentation** — https://codeql.github.com/docs/
7. **Gitleaks Documentation** — https://github.com/gitleaks/gitleaks
8. **OWASP SAST Tools** — https://owasp.org/www-community/Source_Code_Analysis_Tools
9. **OWASP DAST Tools** — https://owasp.org/www-community/Vulnerability_Scanning_Tools
10. **NIST SP 800-53 Rev.5 — Security and Privacy Controls** — https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
