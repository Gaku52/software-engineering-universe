# Dependency Security

> A guide to managing third-party dependency risks, covering vulnerability detection with SCA (Software Composition Analysis), automated updates with Dependabot, and visibility through SBOM. Includes the internal mechanics of supply chain attacks, deep analysis of transitive dependencies, and regulatory compliance.

## What You Will Learn

1. **Threat Model for Supply Chain Attacks** — Techniques and defenses against typosquatting, dependency confusion attacks, and account takeovers
2. **SCA Tools and CI/CD Integration** — Automated vulnerability detection, remediation, and gating with Dependabot, Snyk, and Trivy
3. **SBOM (Software Bill of Materials)** — Generating, managing, and complying with software bill of materials requirements
4. **Dependency Locking, Pinning, and Auditing** — Ensuring reproducible builds and license compliance

## Prerequisites

| Topic | Reference |
|---------|--------|
| Secure coding fundamentals | [Secure Coding](./00-secure-coding.md) |
| Package manager basics | npm, pip, Go modules fundamentals |
| CI/CD pipeline concepts | [Container Security](./02-container-security.md) |
| Cryptography and hashing basics | [Cryptography Fundamentals](../02-cryptography/) |

---

## 1. Dependency Risks

### WHY: Why Dependency Security Matters

Modern software is composed of 80–90% open-source dependencies on average. Even if you wrote only 10% of the code, vulnerabilities in the remaining 90% of third-party code can put your entire application at risk. Log4Shell (CVE-2021-44228) affected virtually every Java application and demonstrated to the world how devastating poor dependency management can be.

### Supply Chain Attack Techniques and Internal Mechanisms

```
┌──────────────────────────────────────────────────────────────┐
│              Supply Chain Attack Vectors                       │
│──────────────────────────────────────────────────────────────│
│                                                              │
│  [Direct Attacks]                                             │
│  +-- Dependency package takeover (account compromise)         │
│  │   → Compromise maintainer npm/PyPI accounts               │
│  │   → Inject malicious code into legitimate packages         │
│  │   → Example: ua-parser-js (2021) — 8M weekly downloads    │
│  │                                                            │
│  +-- Typosquatting (lodash → lodahs, reqeusts)               │
│  │   → Publish similarly named packages to lure misinstalls   │
│  │   → PyPI discovers 100+ malicious packages per month avg  │
│  │                                                            │
│  +-- Dependency Confusion Attack                              │
│      → Publish a public package with same name as internal    │
│        package but at a higher version number                 │
│      → Package manager installs the public version first      │
│      → Example: Alex Birsan demonstrated on Apple/MS/PayPal  │
│                                                              │
│  [Indirect Attacks]                                           │
│  +-- Transitive dependency vulnerabilities (A→B→C, vuln in C)│
│  +-- Build system compromise (CI/CD pipeline)                 │
│  +-- Malicious pre/post-install scripts                       │
│  +-- Social engineering to gain maintainer access             │
│                                                              │
│  [Notable Incidents]                                          │
│  +-- event-stream (2018): cryptocurrency theft code injected  │
│  +-- ua-parser-js (2021): miner & password theft              │
│  +-- Log4Shell (2021): Log4j remote code execution            │
│  +-- colors/faker (2022): intentional sabotage by maintainer  │
│  +-- xz-utils (2024): 2-year backdoor insertion               │
└──────────────────────────────────────────────────────────────┘
```

### The Problem of Dependency Depth

```
Your Application
  ├── express (direct dependency: 1)
  │   ├── body-parser
  │   │   ├── bytes
  │   │   ├── content-type
  │   │   ├── raw-body
  │   │   │   └── bytes, iconv-lite, unpipe
  │   │   └── ...
  │   ├── cookie
  │   ├── debug
  │   │   └── ms
  │   ├── ...
  │   └── (transitive dependencies: 30+ packages)
  │
  1 direct dependency → 30+ transitive dependencies
  Typical Node.js app: 20 direct → 1000+ transitive
  Typical Java app:    50 direct → 500+ transitive
```

### How Dependency Confusion Attacks Work (In Detail)

```python
# ========================================
# Dependency Confusion Attack Scenario
# ========================================

# 1. Company uses "mycompany-utils" package from internal registry
# requirements.txt:
#   mycompany-utils==1.0.0

# 2. Attacker publishes "mycompany-utils" on PyPI at version 99.0.0
#    → Embeds malicious install script in setup.py

# 3. pip installs higher public PyPI version (99.0.0) preferentially
# pip install mycompany-utils
# → Installs PyPI's 99.0.0 (not the internal registry's 1.0.0)

# ========================================
# Defenses
# ========================================

# Option 1: Reference only internal registry via pip.conf
# [global]
# index-url = https://internal.pypi.mycompany.com/simple/
# extra-index-url = (not set → public PyPI not referenced)

# Option 2: Specify registry per scope in .npmrc (npm)
# @mycompany:registry=https://npm.mycompany.com/
# registry=https://registry.npmjs.org/

# Option 3: Publish a placeholder package to PyPI
#   → Publish an empty package under the same name as the internal one

# Option 4: Hash verification to detect unexpected package changes
# pip install --require-hashes -r requirements.txt
# requirements.txt:
#   mycompany-utils==1.0.0 \
#     --hash=sha256:abc123def456...
```

---

## 2. SCA (Software Composition Analysis)

### SCA Tool Comparison

| Tool | Languages | Free Tier | Features | Vulnerability DB | Auto Fix PR |
|--------|---------|--------|------|---------|--------------|
| Dependabot | Multi-language | Free on GitHub | Native GitHub integration | GitHub Advisory DB | Yes |
| Snyk | Multi-language | Free for OSS | Prioritized fix suggestions | Snyk DB | Yes |
| Trivy | Multi-language + containers | Completely free | Container image support | NVD + proprietary | No |
| OWASP Dep-Check | Mainly Java, .NET | Completely free | NVD database integration | NVD | No |
| npm audit | JavaScript | Free | Built-in npm feature | GitHub Advisory DB | `npm audit fix` |
| pip-audit | Python | Free | OSV database integration | OSV | No |
| Renovate | Multi-language | Completely free | Highly customizable | Multiple | Yes |

### Dependabot Configuration (Detailed)

```yaml
# .github/dependabot.yml
version: 2
updates:
  # ========================================
  # npm dependencies
  # ========================================
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Tokyo"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    # Security updates immediately, version updates grouped
    groups:
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"
      dev-dependencies:
        dependency-type: "development"
    ignore:
      # Major version upgrades handled manually
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
    # Security advisory responses are exceptions (auto PR even for major)
    # → Handled automatically by GitHub Security Advisories

  # ========================================
  # Python dependencies
  # ========================================
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      python-deps:
        patterns: ["*"]
        update-types: ["minor", "patch"]

  # ========================================
  # Docker images
  # ========================================
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    # Always track base image updates
    ignore: []

  # ========================================
  # GitHub Actions version management
  # ========================================
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    # Pinning Actions versions is especially important (supply chain attack defense)
```

### Automated Security Scan Pipeline with GitHub Security Advisories

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 0 * * *'  # Daily at 0:00 UTC

permissions:
  contents: read
  security-events: write

jobs:
  # ========================================
  # npm audit
  # ========================================
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: npm audit (high/critical only)
        run: npm audit --audit-level=high

  # ========================================
  # Trivy filesystem scan
  # ========================================
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'  # Fail build on vulnerability found
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results to Security tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  # ========================================
  # pip-audit (Python)
  # ========================================
  pip-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install pip-audit
        run: pip install pip-audit

      - name: Run pip-audit
        run: pip-audit -r requirements.txt --desc --fix --dry-run
```

### Trivy Scanning (In Detail)

```bash
# ========================================
# Basic scan commands
# ========================================

# Filesystem scan (entire project)
trivy fs --severity HIGH,CRITICAL .

# Container image scan
trivy image --severity HIGH,CRITICAL myapp:latest

# Ignore unfixed vulnerabilities (when justified)
trivy fs --severity HIGH,CRITICAL --ignore-unfixed .

# Output as JSON (for CI/CD pipelines)
trivy fs --format json --output results.json .

# Scan with SBOM output
trivy fs --format cyclonedx --output sbom.json .

# ========================================
# Example output
# ========================================
# myapp (npm)
# ============
# Total: 5 (HIGH: 3, CRITICAL: 2)
#
# ┌──────────────┬───────────────────┬──────────┬────────────┬────────────┐
# │   Library    │   Vulnerability   │ Severity │ Installed  │   Fixed    │
# ├──────────────┼───────────────────┼──────────┼────────────┼────────────┤
# │ lodash       │ CVE-2021-23337    │ HIGH     │ 4.17.20    │ 4.17.21    │
# │ express      │ CVE-2024-XXXX     │ CRITICAL │ 4.17.1     │ 4.18.2     │
# │ jsonwebtoken │ CVE-2022-23529    │ HIGH     │ 8.5.1      │ 9.0.0      │
# │ axios        │ CVE-2023-45857    │ HIGH     │ 1.5.0      │ 1.6.0      │
# │ node-forge   │ CVE-2022-24771    │ CRITICAL │ 1.2.1      │ 1.3.0      │
# └──────────────┴───────────────────┴──────────┴────────────┴────────────┘

# ========================================
# .trivyignore — vulnerabilities to ignore with justification
# ========================================
# CVE-2021-23337  # lodash: this code path is not used in this application
# CVE-2023-XXXXX  # test-only dependency with no production impact
```

### Integrated Scanning with Snyk

```bash
# Install and use Snyk CLI
npm install -g snyk

# Scan a project
snyk test

# Monitor mode (continuous detection of new vulnerabilities)
snyk monitor

# Auto-fix fixable vulnerabilities
snyk fix

# Scan a container image
snyk container test myapp:latest

# Scan IaC
snyk iac test terraform/
```

```python
# Auto-generate vulnerability reports using the Snyk API
import requests
import json
from datetime import datetime

def generate_vulnerability_report(org_id: str, api_token: str) -> dict:
    """Generate an organization-wide vulnerability report from the Snyk API"""
    headers = {
        'Authorization': f'token {api_token}',
        'Content-Type': 'application/json',
    }

    # Fetch vulnerabilities across all projects
    response = requests.get(
        f'https://api.snyk.io/rest/orgs/{org_id}/issues',
        headers=headers,
        params={'version': '2024-01-01', 'limit': 100},
    )
    response.raise_for_status()
    issues = response.json()

    # Aggregate by severity
    severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    for issue in issues.get('data', []):
        severity = issue['attributes']['effective_severity_level']
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

    return {
        'timestamp': datetime.utcnow().isoformat(),
        'total_issues': len(issues.get('data', [])),
        'severity_breakdown': severity_counts,
        'org_id': org_id,
    }
```

---

## 3. SBOM (Software Bill of Materials)

### WHY: Why a Bill of Materials Is Necessary

An SBOM is the "ingredient list" for software. Just as food products are required to list ingredients, software is increasingly expected to provide transparency about what it is made of. During Log4Shell, many organizations could not identify which of their systems used Log4j, causing remediation to take weeks. With an SBOM, the blast radius can be identified instantly the moment a vulnerability is disclosed.

```
┌──────────────────────────────────────────────────────────────┐
│                      SBOM (Bill of Materials)                  │
│──────────────────────────────────────────────────────────────│
│  Application: MyApp v2.1.0                                    │
│  Build date:  2024-03-15T10:30:00Z                            │
│  Build env:   Node.js 20.11.0 / npm 10.2.4                    │
│                                                              │
│  Component list:                                              │
│  ┌───────────────────────┬─────────┬──────┬────────────────┐ │
│  │ Package name          │ Version │License│ Type           │ │
│  ├───────────────────────┼─────────┼──────┼────────────────┤ │
│  │ express               │ 4.18.2  │ MIT  │ Direct dep     │ │
│  │ lodash                │ 4.17.21 │ MIT  │ Direct dep     │ │
│  │ body-parser           │ 1.20.2  │ MIT  │ Transitive dep │ │
│  │ debug                 │ 4.3.4   │ MIT  │ Transitive dep │ │
│  │ ...                   │ ...     │ ...  │ ...            │ │
│  └───────────────────────┴─────────┴──────┴────────────────┘ │
│                                                              │
│  Information included per component:                          │
│  - Package name and version                                   │
│  - License (SPDX identifier)                                  │
│  - Supplier                                                   │
│  - Known vulnerabilities (CVE)                                │
│  - Cryptographic hash (tamper detection)                      │
│  - Parent-child dependency tree                               │
└──────────────────────────────────────────────────────────────┘
```

### SBOM Format Comparison

| Item | SPDX | CycloneDX |
|------|------|-----------|
| Maintained by | Linux Foundation | OWASP |
| ISO standard | ISO/IEC 5962:2021 | ECMA-424 |
| Formats | JSON, RDF, Tag-Value, YAML | JSON, XML, Protobuf |
| Focus | License compliance | Security |
| Vulnerability info | External references | VEX (Vulnerability Exploitability eXchange) integrated |
| Service description | Limited | Supports API/service descriptions |
| Generation tools | syft, trivy, spdx-tools | cdxgen, trivy, syft |
| Recommended use | License auditing, legal | Security operations, vulnerability management |

### Generating and Using SBOMs

```bash
# ========================================
# SBOM generation tools
# ========================================

# Generate CycloneDX SBOM with syft
syft dir:. -o cyclonedx-json > sbom.cyclonedx.json

# Generate SPDX SBOM with syft
syft dir:. -o spdx-json > sbom.spdx.json

# Generate SBOM with Trivy
trivy fs --format cyclonedx --output sbom.json .

# Generate SBOM from container image
syft myapp:latest -o cyclonedx-json > image-sbom.json

# Generate SBOM with npm (npm 10+)
npm sbom --sbom-format cyclonedx

# Generate SBOM with cdxgen (multi-language support)
npx @cyclonedx/cdxgen -o sbom.json

# ========================================
# Vulnerability scanning from SBOM
# ========================================

# Scan SBOM for vulnerabilities with grype
grype sbom:sbom.cyclonedx.json

# Scan SBOM with Trivy
trivy sbom sbom.cyclonedx.json

# ========================================
# SBOM validation
# ========================================

# Validate CycloneDX format
cyclonedx validate --input-file sbom.json --input-format json
```

```python
# Script for managing SBOM in CI/CD
import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

def generate_and_analyze_sbom(
    project_dir: str,
    output_dir: str,
    severity_threshold: str = "HIGH",
) -> dict:
    """Generate SBOM and run vulnerability analysis"""

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%S')

    # Step 1: Generate CycloneDX SBOM
    sbom_file = output_path / f"sbom-{timestamp}.json"
    result = subprocess.run(
        ["syft", f"dir:{project_dir}", "-o", "cyclonedx-json"],
        capture_output=True, text=True, check=True,
    )
    sbom = json.loads(result.stdout)
    sbom_file.write_text(json.dumps(sbom, indent=2))

    # Step 2: Vulnerability scan
    vuln_file = output_path / f"vulnerabilities-{timestamp}.json"
    vuln_result = subprocess.run(
        ["grype", f"sbom:{sbom_file}", "-o", "json"],
        capture_output=True, text=True,
    )
    vulnerabilities = json.loads(vuln_result.stdout)
    vuln_file.write_text(json.dumps(vulnerabilities, indent=2))

    # Step 3: Aggregate analysis results
    matches = vulnerabilities.get("matches", [])
    severity_counts = {}
    for match in matches:
        sev = match.get("vulnerability", {}).get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    # Step 4: License analysis
    components = sbom.get("components", [])
    license_counts = {}
    for comp in components:
        for lic in comp.get("licenses", []):
            lic_id = lic.get("license", {}).get("id", "unknown")
            license_counts[lic_id] = license_counts.get(lic_id, 0) + 1

    return {
        "sbom_path": str(sbom_file),
        "vulnerability_path": str(vuln_file),
        "component_count": len(components),
        "vulnerability_count": len(matches),
        "severity_breakdown": severity_counts,
        "license_breakdown": license_counts,
        "timestamp": timestamp,
    }
```

### VEX (Vulnerability Exploitability eXchange)

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "vulnerabilities": [
    {
      "id": "CVE-2021-23337",
      "source": { "name": "NVD" },
      "analysis": {
        "state": "not_affected",
        "justification": "code_not_reachable",
        "detail": "lodash.template() is not used in this application and is therefore not affected. Confirmed via code path analysis.",
        "response": ["will_not_fix"]
      },
      "affects": [
        {
          "ref": "pkg:npm/lodash@4.17.20"
        }
      ]
    }
  ]
}
```

---

## 4. Dependency Locking and Pinning

### WHY: Why Lock Files Matter

```
┌──────────────────────────────────────────────────────────────┐
│  Without lock file:                                           │
│  package.json: "lodash": "^4.17.0"                           │
│  → Dev environment:  4.17.20 (installed at some point)        │
│  → CI environment:   4.17.21 (latest patch)                  │
│  → Production:       4.17.19 (installed from cache)          │
│  → Different versions across environments, no reproducibility │
│  → Risk of missing vulnerabilities that only appear in prod   │
│                                                              │
│  With lock file:                                              │
│  package-lock.json: "lodash": "4.17.21"                      │
│  → All environments use 4.17.21 (fully reproducible)         │
│  → Transitive dependency versions are also pinned            │
│  → Hash values detect tampering                               │
└──────────────────────────────────────────────────────────────┘
```

### Lock Files and Best Practices by Language

```bash
# ========================================
# JavaScript / Node.js
# ========================================
# Use npm ci in CI (strict adherence to lock file)
npm ci  # Use ci instead of install

# Always commit lock file to Git
git add package-lock.json
git commit -m "Update lock file"

# ========================================
# Python
# ========================================
# Generate requirements.txt with hashes using pip-compile
pip-compile --generate-hashes requirements.in > requirements.txt

# Install with hash verification
pip install --require-hashes -r requirements.txt

# ========================================
# Go
# ========================================
# go.sum is auto-generated (checksum verification)
go mod verify

# Clean up dependencies
go mod tidy

# ========================================
# Rust
# ========================================
# Always commit Cargo.lock
cargo build  # Cargo.lock auto-generated

# Audit dependencies
cargo audit
```

### Forcing Specific Versions on Transitive Dependencies

```json
// package.json — npm overrides
{
  "overrides": {
    "lodash": "4.17.21",
    "minimist": ">=1.2.6",
    "json5": ">=2.2.2"
  }
}
```

```json
// package.json — yarn resolutions
{
  "resolutions": {
    "lodash": "4.17.21",
    "**/minimist": ">=1.2.6"
  }
}
```

```
# pip — constraints.txt
# pip install -c constraints.txt -r requirements.txt
cryptography>=41.0.0
urllib3>=2.0.7
certifi>=2023.7.22
```

---

## 5. License Compliance

### WHY: Why License Checks Are Necessary

Open-source licenses vary widely — some restrict commercial use or require disclosure of source code. Including code under the GPL license in a commercial product may require publishing the entire product's source code. There have been legal issues caused by transitive dependencies included without awareness.

### License Risk Classification

| Risk Level | License | Terms | Commercial Use |
|-------------|----------|------|---------|
| Low risk | MIT, BSD-2, ISC | Copyright notice only | Unrestricted |
| Low risk | Apache-2.0 | Copyright + patent clause | Unrestricted |
| Medium risk | LGPL-2.1/3.0 | OK if dynamically linked | Conditional |
| High risk | GPL-2.0/3.0 | Derivatives must also be GPL | Restricted |
| High risk | AGPL-3.0 | Disclosure required even for network use | Strictly restricted |
| Unknown | No license | Cannot use under copyright law | Prohibited |

```bash
# ========================================
# Automating license checks
# ========================================

# JavaScript: license-checker
npx license-checker --summary
npx license-checker --failOn "GPL-3.0;AGPL-3.0;SSPL-1.0"
npx license-checker --production --json > licenses.json

# Python: pip-licenses
pip install pip-licenses
pip-licenses --format=table
pip-licenses --fail-on="GNU General Public License v3 (GPLv3)"
pip-licenses --format=json > licenses.json

# Go: go-licenses
go install github.com/google/go-licenses@latest
go-licenses check ./...
go-licenses csv ./... > licenses.csv

# Multi-language: FOSSA
# fossa analyze
# fossa test  # Fail build on policy violation
```

---

## 6. Anti-Patterns

### Anti-Pattern 1: Not Committing Lock Files to Git

```bash
# BAD: Adding lock file to .gitignore
echo "package-lock.json" >> .gitignore
echo "yarn.lock" >> .gitignore

# GOOD: Always commit lock files
git add package-lock.json
git commit -m "Update lock file"

# Use npm ci in CI (strict install based on lock file)
# npm install should not be used in CI as it can update the lock file
```

**Impact**: Different versions may be used across builds, introducing known vulnerabilities. Reproducibility is lost, making debugging difficult.

### Anti-Pattern 2: Ignoring Vulnerability Alerts

```
BAD: Continuously ignoring Dependabot alerts
  → 93 Critical/High vulnerabilities left unresolved
  → Attacker exploits using known CVEs
  → Research shows attacks begin an average of 15 days after CVE publication

GOOD: Establish SLAs for response
  Critical: Resolve within 24 hours
  High:     Resolve within 1 week
  Medium:   Resolve within 1 month
  Low:      Address in the next sprint

  Prioritization order:
  1. Exploit code is publicly available (Exploit Available)
  2. Exploitable over the network (Network Attack Vector)
  3. Dependency used in production
  4. CVSS score
```

### Anti-Pattern 3: Habitually Using `npm install --ignore-scripts`

```bash
# BAD: Always skipping postinstall scripts to avoid issues
npm install --ignore-scripts

# → Native modules are not built, causing production failures
# → Does not actually serve as a security measure (scripts may still be run manually)

# GOOD: Use only trusted packages + verify with npm audit
npm ci
npm audit --audit-level=high
```

---

## 7. Exercises

### Exercise 1: Scanning and Fixing Vulnerabilities in an npm Project (Beginner)

**Task**: For a project with the following package.json, scan for vulnerabilities and create a remediation plan.
```json
{
  "dependencies": {
    "express": "4.17.1",
    "lodash": "4.17.19",
    "jsonwebtoken": "8.5.1"
  }
}
```

<details>
<summary>Model Answer</summary>

```bash
# Step 1: Vulnerability scan
npm audit
# → express: multiple DoS vulnerabilities (Medium-High)
# → lodash: prototype pollution (High)
# → jsonwebtoken: algorithm confusion attack (Critical)

# Step 2: Auto-fix fixable vulnerabilities
npm audit fix

# Step 3: If a major version upgrade is required
npm audit fix --force  # Warning: may introduce breaking changes

# Step 4: Create a manual remediation plan
# 1. lodash 4.17.19 → 4.17.21 (patch, no compatibility issues)
# 2. express 4.17.1 → 4.19.2 (minor, testing required)
# 3. jsonwebtoken 8.5.1 → 9.0.0 (major, API changes present)
#    → Review API changes: also consider migrating to the jose library

# Step 5: Re-scan after remediation
npm audit
# → 0 vulnerabilities found

# Step 6: Commit lock file
git add package.json package-lock.json
git commit -m "fix: update dependencies to address security vulnerabilities"
```

</details>

### Exercise 2: Generating an SBOM and Performing Vulnerability Analysis (Intermediate)

**Task**: For your own project (or any suitable OSS project), perform the following:
1. Generate a SBOM in CycloneDX format
2. Scan the SBOM for vulnerabilities
3. Classify detected vulnerabilities by severity
4. Create a remediation plan (update to a fixed version or declare no impact via VEX)

<details>
<summary>Model Answer</summary>

```bash
# Step 1: Generate SBOM
syft dir:. -o cyclonedx-json > sbom.json

# Step 2: Vulnerability scan
grype sbom:sbom.json -o table

# Step 3: Analyze results
grype sbom:sbom.json -o json | python3 -c "
import json, sys
data = json.load(sys.stdin)
matches = data.get('matches', [])
severity_map = {}
for m in matches:
    sev = m['vulnerability']['severity']
    severity_map[sev] = severity_map.get(sev, 0) + 1
    pkg = m['artifact']['name']
    ver = m['artifact']['version']
    cve = m['vulnerability']['id']
    fixed = m['vulnerability'].get('fix', {}).get('versions', ['N/A'])
    print(f'{sev:10s} {cve:20s} {pkg}@{ver} → fix: {fixed}')
print()
print('Summary:', severity_map)
"

# Step 4: Create remediation plan
# Critical: Update version immediately
# High: Address within this week
# Medium: Add to backlog
# Not affected: Create VEX document recording justification
```

</details>

### Exercise 3: Simulating and Defending Against Dependency Confusion Attacks (Advanced)

**Task**: Understand the dependency confusion attack scenario and implement defenses in .npmrc and pip.conf.
- Internal package names: `@mycompany/auth-utils` (npm), `mycompany-auth-utils` (pip)
- Internal registry: `https://npm.mycompany.com/`, `https://pypi.mycompany.com/simple/`
- Assume a scenario where an attacker publishes a package with the same name to a public registry

<details>
<summary>Model Answer</summary>

```ini
# .npmrc — npm defense against dependency confusion attacks
# Scoped packages reference the internal registry
@mycompany:registry=https://npm.mycompany.com/

# Public packages use the official npm registry
registry=https://registry.npmjs.org/

# Enable package integrity verification
package-lock=true
```

```ini
# pip.conf — Python defense against dependency confusion attacks
[global]
# If using only internal packages:
index-url = https://pypi.mycompany.com/simple/
# If external packages are also needed:
extra-index-url = https://pypi.org/simple/
# Note: extra-index-url is vulnerable to confusion attacks

# Safer approach: proxy all packages through an internal PyPI server
# (using DevPI or Artifactory)
# index-url = https://devpi.mycompany.com/root/pypi+simple/
```

```python
# Additional defense: script to register placeholder package on public registry
# setup.py for placeholder package
from setuptools import setup

setup(
    name="mycompany-auth-utils",
    version="0.0.1",
    description="This is a placeholder package. "
                "Do not install. "
                "See https://internal.mycompany.com/docs",
    author="MyCompany Security Team",
    url="https://mycompany.com",
    python_requires=">=99",  # Makes it uninstallable
    classifiers=[
        "Development Status :: 7 - Inactive",
    ],
)
```

```yaml
# Validate dependency sources in CI/CD
# .github/workflows/dependency-check.yml
name: Dependency Source Check
on: [pull_request]
jobs:
  check-sources:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify no unexpected registries
        run: |
          # Check package-lock.json for unexpected registry URLs
          if grep -v "registry.npmjs.org\|npm.mycompany.com" package-lock.json | grep -q "resolved.*http"; then
            echo "ERROR: Unexpected registry found in package-lock.json"
            exit 1
          fi
```

</details>


---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured config file | Verify config file path and format |
| Timeout | Network latency / resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Verify running user permissions, review settings |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, manage transactions |

### Debugging Steps

1. **Read the error message**: Read the stack trace and identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to validate hypotheses
5. **Fix and regression test**: After fixing, run tests on related areas as well

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator to log function inputs and outputs"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
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
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Examine disk and network I/O status
4. **Check concurrent connection count**: Monitor connection pool state

| Problem Type | Diagnostic Tool | Solution |
|-----------|-----------|------|
| High CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB slowness | EXPLAIN, slow query log | Indexing, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | When to prioritize | When acceptable to compromise |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin interfaces, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith              │
│    └─ Large (10+ people) → Go to 2              │
│                                                 │
│  2. What is the deployment frequency?            │
│    ├─ Weekly or less → Monolith + modularization │
│    └─ Daily / multiple times → Go to 3          │
│                                                 │
│  3. How much team independence is needed?        │
│    ├─ High → Microservices                       │
│    └─ Moderate → Modular monolith                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs. long-term cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering incurs high short-term costs and can delay projects

**2. Consistency vs. flexibility**
- A unified technology stack has a lower learning curve
- Adopting diverse technologies allows fitting the right tool for the job, but increases operational costs

**3. Level of abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is more intuitive but tends to result in code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision made"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Context\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum viable feature set
- Automated tests only for critical paths
- Introduce monitoring early

**Lessons learned:**
- Don't over-optimize (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Incrementally renewing a system that has been running for over 10 years

**Approach:**
- Use the Strangler Fig pattern for incremental migration
- Create Characterization Tests first when existing tests are absent
- Use an API gateway to coexist old and new systems
- Migrate data incrementally

| Phase | Work | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Migration start | Migrate peripheral features incrementally | 3-6 months | Medium |
| 4. Core migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Use domain-driven design to clarify boundaries
- Assign ownership per team
- Manage shared libraries using Inner Source model
- Design API-first to minimize cross-team dependencies

```python
# Defining API contracts between teams
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class APIContract:
    """API contract between teams"""
    endpoint: str
    method: str
    owner_team: str
    consumers: List[str]
    sla_ms: int  # Response time SLA
    priority: Priority

    def validate_sla(self, actual_ms: int) -> bool:
        """Verify SLA compliance"""
        return actual_ms <= self.sla_ms

    def to_openapi(self) -> dict:
        """Output in OpenAPI format"""
        return {
            'path': self.endpoint,
            'method': self.method,
            'x-owner': self.owner_team,
            'x-consumers': self.consumers,
            'x-sla-ms': self.sla_ms
        }

# Usage example
contracts = [
    APIContract(
        endpoint="/api/v1/users",
        method="GET",
        owner_team="user-team",
        consumers=["order-team", "notification-team"],
        sla_ms=200,
        priority=Priority.HIGH
    ),
    APIContract(
        endpoint="/api/v1/orders",
        method="POST",
        owner_team="order-team",
        consumers=["payment-team", "inventory-team"],
        sla_ms=500,
        priority=Priority.CRITICAL
    )
]
```

### Scenario 4: Performance-Critical Systems

**Situation:** Systems requiring millisecond-level response times

**Optimization points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy operations |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound operations |

---

## Team Development Applications

### Code Review Checklist

Key points to verify in code reviews related to this topic:

- [ ] Naming conventions are consistent
- [ ] Error handling is appropriate
- [ ] Test coverage is sufficient
- [ ] No performance impact
- [ ] No security issues
- [ ] Documentation is updated

### Knowledge Sharing Best Practices

| Method | Frequency | Audience | Effect |
|------|------|------|------|
| Pair programming | As needed | Complex tasks | Immediate feedback |
| Tech talk | Weekly | Entire team | Horizontal knowledge transfer |
| ADR (design records) | As needed | Future members | Decision transparency |
| Retrospective | Every 2 weeks | Entire team | Continuous improvement |
| Mob programming | Monthly | Critical designs | Consensus building |

### Managing Technical Debt

```
Priority Matrix:

        High Impact
          │
    ┌─────┼─────┐
    │Plan │Act  │
    │ned  │imme │
    │resp │diat │
    │onse │ely  │
    ├─────┼─────┤
    │ Log │Next │
    │only │Sprint│
    │     │     │
    └─────┼─────┘
          │
        Low Impact
    Low Freq     High Freq
```

---

## Security Considerations

### Common Vulnerabilities and Mitigations

| Vulnerability | Risk Level | Mitigation | Detection Method |
|--------|------------|------|---------|
| Injection attacks | High | Input validation, parameterized queries | SAST/DAST |
| Authentication flaws | High | Multi-factor auth, session management | Penetration testing |
| Sensitive data exposure | High | Encryption, access control | Security audit |
| Security misconfiguration | Medium | Security headers, least privilege | Configuration scanning |
| Insufficient logging | Medium | Structured logging, audit trail | Log analysis |

### Secure Coding Best Practices

```python
# Secure coding example
import hashlib
import secrets
import hmac
from typing import Optional

class SecurityUtils:
    """Security utilities"""

    @staticmethod
    def generate_token(length: int = 32) -> str:
        """Generate a cryptographically secure token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_password(password: str, salt: Optional[str] = None) -> tuple:
        """Hash a password"""
        if salt is None:
            salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return hashed.hex(), salt

    @staticmethod
    def verify_password(password: str, hashed: str, salt: str) -> bool:
        """Verify a password"""
        new_hash, _ = SecurityUtils.hash_password(password, salt)
        return hmac.compare_digest(new_hash, hashed)

    @staticmethod
    def sanitize_input(value: str) -> str:
        """Sanitize input values"""
        dangerous_chars = ['<', '>', '"', "'", '&', '\\']
        result = value
        for char in dangerous_chars:
            result = result.replace(char, '')
        return result.strip()

# Usage example
token = SecurityUtils.generate_token()
hashed, salt = SecurityUtils.hash_password("my_password")
is_valid = SecurityUtils.verify_password("my_password", hashed, salt)
```

### Security Checklist

- [ ] All input values are validated
- [ ] Sensitive information is not written to logs
- [ ] HTTPS is enforced
- [ ] CORS policy is configured appropriately
- [ ] Vulnerability scanning of dependency packages is performed
- [ ] Error messages do not expose internal information

---

## Migration Guide

### Notes on Version Upgrades

| Version | Key Changes | Migration Work | Scope |
|-----------|-----------|---------|---------|
| v1.x → v2.x | API redesign | Endpoint changes | All clients |
| v2.x → v3.x | Auth method change | Token format update | Auth-related |
| v3.x → v4.x | Data model change | Run migration scripts | DB-related |

### Incremental Migration Procedure

```python
# Migration script template
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Callable

logger = logging.getLogger(__name__)

class MigrationRunner:
    """Incremental migration execution engine"""

    def __init__(self, migration_dir: str):
        self.migration_dir = Path(migration_dir)
        self.migrations: List[Dict] = []
        self.completed: List[str] = []

    def register(self, version: str, description: str,
                 up: Callable, down: Callable):
        """Register a migration"""
        self.migrations.append({
            'version': version,
            'description': description,
            'up': up,
            'down': down,
            'registered_at': datetime.now().isoformat()
        })

    def run_up(self, target_version: str = None):
        """Execute migrations (upgrade)"""
        for migration in self.migrations:
            if migration['version'] in self.completed:
                continue
            logger.info(f"Running: {migration['version']} - "
                       f"{migration['description']}")
            try:
                migration['up']()
                self.completed.append(migration['version'])
                logger.info(f"Completed: {migration['version']}")
            except Exception as e:
                logger.error(f"Failed: {migration['version']}: {e}")
                raise
            if target_version and migration['version'] == target_version:
                break

    def run_down(self, target_version: str):
        """Rollback migrations"""
        for migration in reversed(self.migrations):
            if migration['version'] not in self.completed:
                continue
            if migration['version'] == target_version:
                break
            logger.info(f"Rolling back: {migration['version']}")
            migration['down']()
            self.completed.remove(migration['version'])

    def status(self) -> Dict:
        """Check migration status"""
        return {
            'total': len(self.migrations),
            'completed': len(self.completed),
            'pending': len(self.migrations) - len(self.completed),
            'versions': {
                m['version']: 'completed'
                if m['version'] in self.completed else 'pending'
                for m in self.migrations
            }
        }
```

### Rollback Plan

Always prepare a rollback plan for migration work:

1. **Back up data**: Take a full backup before migration
2. **Validate in a test environment**: Test in an environment equivalent to production
3. **Gradual rollout**: Deploy incrementally with a canary release
4. **Increase monitoring**: Shorten metrics monitoring intervals during migration
5. **Define rollback criteria**: Establish clear criteria for deciding to rollback in advance
---

## 8. FAQ

### Q1. How do you handle vulnerabilities in transitive dependencies?

In many cases, upgrading the version of a direct dependency will also update the transitive dependency. If that is not possible, you can force a specific version using npm's `overrides`, yarn's `resolutions`, or pip's constraints. Be sure to test thoroughly, as compatibility issues may arise. As a last resort, look for an alternative to the package that relies on the vulnerable dependency, or create a patched fork.

### Q2. Is providing an SBOM mandatory?

Under U.S. Executive Order 14028 (2021), SBOM provision is required for software sold to the federal government. The EU's Cyber Resilience Act (CRA) also mandates SBOMs. In Japan, the Ministry of Economy, Trade and Industry published an "SBOM Introduction Guide" in 2023, promoting adoption in critical infrastructure sectors. Demands from business partners in the private sector are also increasing, making early adoption advisable.

### Q3. How do you protect internal package scopes?

In npm, reserve the `@myorg/` scope by registering it with your organization. To prevent dependency confusion attacks, you can register placeholder packages on the public registry under the same name as internal packages. Properly configure registry scope settings in .npmrc, and validate the resolved URLs in package-lock.json in CI/CD to detect installs from unknown registries.

### Q4. Should I use Dependabot or Renovate?

Dependabot is natively integrated with GitHub, easy to configure, and requires no additional cost. Renovate offers finer customization and excels at grouping, auto-merge conditions, and unified management of multiple package managers. Renovate is better suited for large projects or complex dependency management. Both can be used together, but watch out for duplicate PRs.

### Q5. What is the emergency response procedure when a zero-day vulnerability is discovered?

1. Use the SBOM to immediately identify affected systems. 2. Temporarily block attacks with WAF rules or virtual patching. 3. Once a patched version is released, deploy via CI/CD with automated testing. 4. If no fix exists, consider disabling the affected code path or switching to an alternative library. 5. Conduct an incident review afterward and measure the time from detection to resolution in order to improve the process.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in practice?

Knowledge of this topic is frequently applied in day-to-day development work — particularly during code reviews and architecture design.

---

## Summary

| Item | Key Points | Recommended Tools |
|------|------|-----------|
| Supply chain risk | Watch out for transitive dependencies, typosquatting, and account takeovers | - |
| SCA tools | Auto-detect vulnerabilities and gate them in CI/CD | Dependabot + Trivy |
| SBOM | Generate bill of materials in CycloneDX/SPDX and track vulnerabilities | syft + grype |
| Lock files | Always commit to Git and use strict installs in CI | npm ci, pip --require-hashes |
| Vulnerability SLA | Set response criteria: Critical 24h, High 1 week | - |
| Licenses | Automatically check for restrictions like GPL/AGPL | license-checker, pip-licenses |
| Confusion attack defense | Scope protection, registry config, placeholder registration | .npmrc, pip.conf |
| VEX | Document non-impacting vulnerabilities to manage false positives | CycloneDX VEX |

---

## What to Read Next

- [Container Security](./02-container-security.md) — Scanning and minimizing container image dependencies
- [SAST/DAST](./03-sast-dast.md) — Code-level vulnerability scanning and combining with SCA
- [Secure Coding](./00-secure-coding.md) — Preventing vulnerabilities at the code level
- [IaC Security](../05-cloud-security/02-infrastructure-as-code-security.md) — Dependency management in infrastructure code
- [Cryptography Fundamentals](../02-cryptography/) — Theory of signature verification and hashing
- SQL and Query Fundamentals — ORM/SQL security

---

## References

1. **OWASP Dependency-Check** — https://owasp.org/www-project-dependency-check/
2. **NIST SP 800-218 — Secure Software Development Framework (SSDF)** — https://csrc.nist.gov/publications/detail/sp/800-218/final
3. **CycloneDX Specification** — https://cyclonedx.org/specification/overview/
4. **GitHub Dependabot Documentation** — https://docs.github.com/en/code-security/dependabot
5. **NTIA SBOM Minimum Elements** — https://www.ntia.doc.gov/report/2021/minimum-elements-software-bill-materials-sbom
6. **Alex Birsan — Dependency Confusion** — https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610
