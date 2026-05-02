# Facade Pattern

> A structural pattern that provides a **unified, simplified interface** to a set of complex subsystems, reducing the burden on clients.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Classes and Interfaces | Basic | OOP in TypeScript / Java / Python |
| Dependency Injection (DI) | Basic | [DI Pattern](../../../system-design-guide/docs/02-architecture/01-clean-architecture.md) |
| Single Responsibility Principle (SRP) | Basic | SOLID Principles |
| Module Design | Basic | ES Modules / Python packages |
| async/await | Basic | Asynchronous processing in JavaScript / Python |

---

## What You Will Learn in This Chapter

1. The "subsystem coupling explosion" problem that the Facade pattern solves, and its root cause
2. The structure of a Facade and 4 levels of application (module / service / application / infrastructure)
3. Clear distinctions between Facade, Adapter, Mediator, and Controller
4. Implementation patterns in 5 languages (TypeScript, Python, Java, Go, Kotlin)
5. The 3 major anti-patterns — God Facade / Leaky Facade / Rigid Facade — and how to avoid them

---

## 1. Why Facade Is Necessary (WHY)

### 1.1 A World Without Facade

In complex systems, clients must directly manipulate multiple subsystems.

```
┌──────────────────────────────────────────────────────────┐
│  Without Facade: Client directly operates subsystems     │
│                                                          │
│   Client A ──┬──▶ SubSystem1.init()                     │
│              ├──▶ SubSystem2.configure()                 │
│              ├──▶ SubSystem3.connect()                   │
│              ├──▶ SubSystem1.validate()                  │
│              └──▶ SubSystem2.execute()                   │
│                                                          │
│   Client B ──┬──▶ SubSystem1.init()       ← same steps  │
│              ├──▶ SubSystem2.configure()    repeated     │
│              ├──▶ SubSystem3.connect()                   │
│              ├──▶ SubSystem1.validate()                  │
│              └──▶ SubSystem2.execute()                   │
│                                                          │
│   Problems:                                              │
│   - Clients must know the internal structure of          │
│     each subsystem                                       │
│   - Duplicated operation sequences (DRY violation)       │
│   - All clients must be updated when a subsystem changes │
│   - Too many mock targets in tests                       │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Real-World Analogy

Consider a **hotel concierge**. Instead of a guest making a restaurant reservation, booking a taxi, and purchasing sightseeing tickets themselves, they can simply tell the concierge "please arrange dinner tonight and tomorrow's sightseeing," and the concierge handles everything.

- Concierge = **Facade**
- Restaurant, taxi company, ticket office = **Subsystems**
- Guest = **Client**

The guest does not need to know how the restaurant's reservation system works. However, they can still call the restaurant directly if they wish (the Facade does not block access).

### 1.3 A World With Facade

```
┌──────────────────────────────────────────────────────────┐
│  With Facade: Clients only need to know the Facade       │
│                                                          │
│   Client A ──▶ Facade.doOperation()                     │
│                    │                                     │
│   Client B ──▶ Facade.doOperation()                     │
│                    │                                     │
│                    ├──▶ SubSystem1.init()                │
│                    ├──▶ SubSystem2.configure()           │
│                    ├──▶ SubSystem3.connect()             │
│                    ├──▶ SubSystem1.validate()            │
│                    └──▶ SubSystem2.execute()             │
│                                                          │
│   Benefits:                                              │
│   - Clients do not need to know internal details         │
│   - Centralized management of steps (DRY)                │
│   - Impact of subsystem changes localized to the Facade  │
│   - Only the Facade needs to be mocked in tests          │
└──────────────────────────────────────────────────────────┘
```

### 1.4 The Essence of the Facade Pattern

The essence of a Facade is **information hiding** and **encapsulation of procedures**.

1. **Information hiding**: Clients do not even need to know that subsystems exist
2. **Encapsulation of procedures**: Aggregates routine operation sequences into a single method
3. **Loose coupling**: Reduces the degree of coupling between clients and subsystems
4. **Shortcut**: Provides a convenient entry point but does not prohibit direct access

> **Important**: A Facade is a "gate," not a "wall." Direct access to subsystems should be permitted for advanced use cases.

---

## 2. Facade Structure

### 2.1 Class Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      UML Class Diagram                   │
│                                                         │
│  ┌──────────┐         ┌──────────────────┐              │
│  │  Client  │────────▶│     Facade       │              │
│  └──────────┘         │                  │              │
│                       │ - subA: SubA     │              │
│                       │ - subB: SubB     │              │
│                       │ - subC: SubC     │              │
│                       │                  │              │
│                       │ + operation()    │              │
│                       │ + anotherOp()    │              │
│                       └────────┬─────────┘              │
│                                │ delegates              │
│                    ┌───────────┼───────────┐            │
│                    ▼           ▼           ▼            │
│              ┌──────────┐┌──────────┐┌──────────┐      │
│              │  SubA    ││  SubB    ││  SubC    │      │
│              │          ││          ││          │      │
│              │ + a1()   ││ + b1()   ││ + c1()   │      │
│              │ + a2()   ││ + b2()   ││ + c2()   │      │
│              └──────────┘└──────────┘└──────────┘      │
│                                                         │
│  Key points:                                            │
│  - Client depends only on the Facade                    │
│  - Facade aggregates subsystems (has-a)                 │
│  - Subsystems are unaware of the Facade's existence     │
│  - Direct access to subsystems is also possible         │
│    (optional)                                           │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Sequence Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Sequence Diagram                      │
│                                                         │
│  Client        Facade         SubA    SubB    SubC      │
│    │              │             │       │       │        │
│    │ operation()  │             │       │       │        │
│    │─────────────▶│             │       │       │        │
│    │              │ a1()        │       │       │        │
│    │              │────────────▶│       │       │        │
│    │              │  result_a   │       │       │        │
│    │              │◀────────────│       │       │        │
│    │              │ b1(result_a)│       │       │        │
│    │              │─────────────────────▶       │        │
│    │              │  result_b   │       │       │        │
│    │              │◀─────────────────────       │        │
│    │              │ c1(result_a, result_b)      │        │
│    │              │────────────────────────────▶│        │
│    │              │  result_c   │       │       │        │
│    │              │◀────────────────────────────│        │
│    │  final_result│             │       │       │        │
│    │◀─────────────│             │       │       │        │
│    │              │             │       │       │        │
│                                                         │
│  Key point: The Facade is responsible for orchestration │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Facade Application Decision Flow

```
┌─────────────────────────────────────────────────────────┐
│              Facade Application Decision Flow            │
│                                                         │
│  Are there multiple subsystems?                         │
│       │                                                 │
│       ├── No ──▶ Not needed (call directly if only      │
│       │          one subsystem)                         │
│       │                                                 │
│       └── Yes                                           │
│            │                                            │
│  Is the client directly operating multiple              │
│  subsystems?                                            │
│       │                                                 │
│       ├── No ──▶ Not needed (low coupling)              │
│       │                                                 │
│       └── Yes                                           │
│            │                                            │
│  Are the operation steps routine/standard?              │
│       │                  │                              │
│       ├── Yes            └── No                         │
│       │                      │                          │
│       ▼                      ▼                          │
│   Introduce Facade       Expose subsystems              │
│   (aggregate steps)      directly (prioritize           │
│                          flexibility)                   │
│       │                                                 │
│  Does it fit within                                     │
│  one Facade?                                            │
│       │                  │                              │
│       ├── Yes            └── No                         │
│       │                      │                          │
│       ▼                      ▼                          │
│   Single Facade          Split Facade                   │
│                          by domain                      │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Code Examples

### Code Example 1: Home Theater Facade (TypeScript)

```typescript
// === Subsystems ===

class Projector {
  on(): void { console.log("Projector: ON"); }
  off(): void { console.log("Projector: OFF"); }
  setInput(src: string): void { console.log(`Projector: Input set to ${src}`); }
  setResolution(res: string): void { console.log(`Projector: Resolution ${res}`); }
}

class AudioSystem {
  on(): void { console.log("Audio: ON"); }
  off(): void { console.log("Audio: OFF"); }
  setVolume(v: number): void { console.log(`Audio: Volume ${v}`); }
  setSurround(): void { console.log("Audio: Surround mode enabled"); }
  setStereo(): void { console.log("Audio: Stereo mode enabled"); }
}

class StreamingPlayer {
  on(): void { console.log("Player: ON"); }
  off(): void { console.log("Player: OFF"); }
  play(movie: string): void { console.log(`Player: Playing "${movie}"`); }
  pause(): void { console.log("Player: Paused"); }
  stop(): void { console.log("Player: Stopped"); }
}

class Lights {
  on(): void { console.log("Lights: ON (100%)"); }
  off(): void { console.log("Lights: OFF"); }
  dim(level: number): void { console.log(`Lights: Dimmed to ${level}%`); }
}

class Screen {
  down(): void { console.log("Screen: Lowered"); }
  up(): void { console.log("Screen: Raised"); }
}

// === Facade ===

class HomeTheaterFacade {
  constructor(
    private projector: Projector,
    private audio: AudioSystem,
    private player: StreamingPlayer,
    private lights: Lights,
    private screen: Screen,
  ) {}

  /** Movie mode: operates 6 subsystems in the correct order */
  watchMovie(movie: string): void {
    console.log("=== Setting up movie mode ===");
    this.lights.dim(10);
    this.screen.down();
    this.projector.on();
    this.projector.setInput("HDMI1");
    this.projector.setResolution("4K");
    this.audio.on();
    this.audio.setSurround();
    this.audio.setVolume(50);
    this.player.on();
    this.player.play(movie);
    console.log("=== Enjoy your movie! ===");
  }

  /** End movie: shuts down all subsystems in the correct order */
  endMovie(): void {
    console.log("=== Shutting down ===");
    this.player.stop();
    this.player.off();
    this.audio.off();
    this.projector.off();
    this.screen.up();
    this.lights.on();
    console.log("=== Done ===");
  }

  /** Music mode: no video needed, stereo audio */
  listenToMusic(): void {
    console.log("=== Setting up music mode ===");
    this.lights.dim(40);
    this.audio.on();
    this.audio.setStereo();
    this.audio.setVolume(30);
  }
}

// === Usage ===

const theater = new HomeTheaterFacade(
  new Projector(),
  new AudioSystem(),
  new StreamingPlayer(),
  new Lights(),
  new Screen(),
);

// Client only needs to call 1 method
theater.watchMovie("Inception");
// Output:
// === Setting up movie mode ===
// Lights: Dimmed to 10%
// Screen: Lowered
// Projector: ON
// Projector: Input set to HDMI1
// Projector: Resolution 4K
// Audio: ON
// Audio: Surround mode enabled
// Audio: Volume 50
// Player: ON
// Player: Playing "Inception"
// === Enjoy your movie! ===

theater.endMovie();
```

**Key point**: The client does not need to know the operation order of 6 subsystems (dim lights → screen → projector → audio → player).

---

### Code Example 2: Deployment Pipeline Facade (TypeScript)

```typescript
// === Subsystems ===

interface DeployResult {
  version: string;
  url: string;
  timestamp: Date;
}

class GitService {
  pull(branch: string): void {
    console.log(`Git: Pulling ${branch}`);
  }
  tag(version: string): void {
    console.log(`Git: Tagged ${version}`);
  }
  getLatestCommit(): string {
    return "abc1234";
  }
}

class BuildService {
  install(): void {
    console.log("Build: Installing dependencies");
  }
  lint(): void {
    console.log("Build: Linting code");
  }
  test(): void {
    console.log("Build: Running tests");
  }
  build(): string {
    console.log("Build: Creating production build");
    return "dist/app.tar.gz";
  }
}

class DeployService {
  upload(artifact: string, env: string): string {
    console.log(`Deploy: Uploading ${artifact} to ${env}`);
    return `https://${env}.example.com`;
  }
  activate(version: string): void {
    console.log(`Deploy: Activating version ${version}`);
  }
  healthCheck(url: string): boolean {
    console.log(`Deploy: Health check on ${url}`);
    return true;
  }
  rollback(version: string): void {
    console.log(`Deploy: Rolling back to ${version}`);
  }
}

class NotifyService {
  sendSlack(channel: string, msg: string): void {
    console.log(`Slack [${channel}]: ${msg}`);
  }
  sendEmail(to: string, subject: string): void {
    console.log(`Email to ${to}: ${subject}`);
  }
}

// === Facade ===

class DeployFacade {
  constructor(
    private git: GitService,
    private build: BuildService,
    private deploy: DeployService,
    private notify: NotifyService,
  ) {}

  /** Production release: automatically executes all steps */
  async release(version: string): Promise<DeployResult> {
    try {
      // 1. Fetch source code
      this.git.pull("main");

      // 2. Build pipeline
      this.build.install();
      this.build.lint();
      this.build.test();
      const artifact = this.build.build();

      // 3. Deploy
      const url = this.deploy.upload(artifact, "production");
      this.deploy.activate(version);

      // 4. Health check
      const healthy = this.deploy.healthCheck(url);
      if (!healthy) {
        this.deploy.rollback(version);
        throw new Error(`Health check failed for ${version}`);
      }

      // 5. Completion handling
      this.git.tag(version);
      this.notify.sendSlack("#deploys", `v${version} deployed to ${url}`);
      this.notify.sendEmail("team@example.com", `Release v${version} complete`);

      return { version, url, timestamp: new Date() };
    } catch (error) {
      this.notify.sendSlack("#alerts", `Deploy v${version} FAILED: ${error}`);
      throw error;
    }
  }

  /** Deploy to staging environment (no tests or notifications) */
  async deployToStaging(branch: string): Promise<string> {
    this.git.pull(branch);
    this.build.install();
    const artifact = this.build.build();
    return this.deploy.upload(artifact, "staging");
  }
}

// === Usage ===

const pipeline = new DeployFacade(
  new GitService(),
  new BuildService(),
  new DeployService(),
  new NotifyService(),
);

await pipeline.release("1.2.0");
```

**Key point**: The entire orchestration including error handling is consolidated in the Facade. A simplified method for staging is also provided for flexible use depending on purpose.

---

### Code Example 3: Python -- Data Analysis Pipeline Facade

```python
from dataclasses import dataclass
from typing import Any
import json
import csv
import io


# === Subsystems ===

class DataLoader:
    """Loads data in various formats"""
    def load_csv(self, path: str) -> list[dict]:
        print(f"DataLoader: Loading CSV from {path}")
        # Use csv.DictReader in actual implementation
        return [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]

    def load_json(self, path: str) -> list[dict]:
        print(f"DataLoader: Loading JSON from {path}")
        return [{"name": "Charlie", "score": 85}]

    def load_database(self, query: str) -> list[dict]:
        print(f"DataLoader: Executing query: {query}")
        return [{"id": 1, "value": 100}]


class DataCleaner:
    """Data cleansing and normalization"""
    def remove_nulls(self, data: list[dict]) -> list[dict]:
        print(f"DataCleaner: Removing nulls from {len(data)} records")
        return [row for row in data if all(v is not None for v in row.values())]

    def normalize(self, data: list[dict], columns: list[str]) -> list[dict]:
        print(f"DataCleaner: Normalizing columns {columns}")
        return data  # Actual normalization processing here

    def deduplicate(self, data: list[dict], key: str) -> list[dict]:
        print(f"DataCleaner: Deduplicating by {key}")
        seen = set()
        result = []
        for row in data:
            if row[key] not in seen:
                seen.add(row[key])
                result.append(row)
        return result


class DataAnalyzer:
    """Statistical analysis and aggregation"""
    def aggregate(self, data: list[dict], column: str) -> dict:
        print(f"DataAnalyzer: Aggregating column '{column}'")
        values = [row.get(column, 0) for row in data]
        return {
            "count": len(values),
            "sum": sum(values),
            "avg": sum(values) / max(len(values), 1),
            "min": min(values, default=0),
            "max": max(values, default=0),
        }

    def group_by(self, data: list[dict], key: str) -> dict[str, list[dict]]:
        print(f"DataAnalyzer: Grouping by '{key}'")
        groups: dict[str, list[dict]] = {}
        for row in data:
            k = str(row.get(key, "unknown"))
            groups.setdefault(k, []).append(row)
        return groups


class ReportGenerator:
    """Report generation"""
    def generate_summary(self, stats: dict) -> str:
        print("ReportGenerator: Generating summary report")
        return json.dumps(stats, indent=2)

    def generate_csv(self, data: list[dict]) -> str:
        print("ReportGenerator: Generating CSV report")
        if not data:
            return ""
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
        return output.getvalue()


# === Facade ===

@dataclass
class AnalysisResult:
    raw_count: int
    clean_count: int
    stats: dict
    report: str


class DataPipelineFacade:
    """Unified interface for the data analysis pipeline"""

    def __init__(
        self,
        loader: DataLoader,
        cleaner: DataCleaner,
        analyzer: DataAnalyzer,
        reporter: ReportGenerator,
    ):
        self._loader = loader
        self._cleaner = cleaner
        self._analyzer = analyzer
        self._reporter = reporter

    def analyze_csv(
        self,
        path: str,
        target_column: str,
        dedup_key: str | None = None,
    ) -> AnalysisResult:
        """Loads a CSV file and executes cleansing, analysis, and report generation in one call"""
        # 1. Load data
        data = self._loader.load_csv(path)
        raw_count = len(data)

        # 2. Cleansing
        data = self._cleaner.remove_nulls(data)
        if dedup_key:
            data = self._cleaner.deduplicate(data, dedup_key)
        clean_count = len(data)

        # 3. Analysis
        stats = self._analyzer.aggregate(data, target_column)

        # 4. Report generation
        report = self._reporter.generate_summary(stats)

        return AnalysisResult(
            raw_count=raw_count,
            clean_count=clean_count,
            stats=stats,
            report=report,
        )

    def quick_summary(self, path: str, column: str) -> dict:
        """Simple aggregation without cleansing"""
        data = self._loader.load_csv(path)
        return self._analyzer.aggregate(data, column)


# === Usage ===

pipeline = DataPipelineFacade(
    loader=DataLoader(),
    cleaner=DataCleaner(),
    analyzer=DataAnalyzer(),
    reporter=ReportGenerator(),
)

result = pipeline.analyze_csv("sales.csv", target_column="age", dedup_key="name")
print(f"Raw: {result.raw_count}, Clean: {result.clean_count}")
print(result.report)
# Output:
# DataLoader: Loading CSV from sales.csv
# DataCleaner: Removing nulls from 2 records
# DataCleaner: Deduplicating by name
# DataAnalyzer: Aggregating column 'age'
# ReportGenerator: Generating summary report
# Raw: 2, Clean: 2
# {
#   "count": 2,
#   "sum": 55,
#   "avg": 27.5,
#   "min": 25,
#   "max": 30
# }
```

**Key point**: The operation steps for 4 subsystems (Loader, Cleaner, Analyzer, Reporter) are consolidated in `analyze_csv`. A simplified `quick_summary` is also provided to balance flexibility and convenience.

---

### Code Example 4: Java -- Email Sending Facade

```java
// === Subsystems ===

class SmtpClient {
    public void connect(String host, int port) {
        System.out.println("SMTP: Connected to " + host + ":" + port);
    }
    public void authenticate(String user, String pass) {
        System.out.println("SMTP: Authenticated as " + user);
    }
    public void send(String from, String to, String raw) {
        System.out.println("SMTP: Sent from " + from + " to " + to);
    }
    public void disconnect() {
        System.out.println("SMTP: Disconnected");
    }
}

class MimeBuilder {
    private String subject = "";
    private String textBody = "";
    private String htmlBody = "";
    private final List<String> attachments = new ArrayList<>();

    public void setSubject(String subject) { this.subject = subject; }
    public void setTextBody(String body) { this.textBody = body; }
    public void setHtmlBody(String html) { this.htmlBody = html; }
    public void addAttachment(String path) { attachments.add(path); }

    public String build() {
        System.out.println("MIME: Building message (subject=" + subject
            + ", attachments=" + attachments.size() + ")");
        return "MIME-Version: 1.0\nSubject: " + subject + "\n\n" + textBody;
    }
}

class TemplateEngine {
    public String render(String templateName, Map<String, Object> vars) {
        System.out.println("Template: Rendering " + templateName);
        // In actual implementation, load template file and embed variables
        return "<html><body>Hello " + vars.getOrDefault("name", "User") + "</body></html>";
    }
}

class AddressValidator {
    public boolean validate(String email) {
        boolean valid = email != null && email.contains("@");
        System.out.println("Validator: " + email + " -> " + (valid ? "OK" : "INVALID"));
        return valid;
    }
}

// === Facade ===

class EmailFacade {
    private final SmtpClient smtp;
    private final MimeBuilder mime;
    private final TemplateEngine templates;
    private final AddressValidator validator;
    private final String smtpHost;
    private final int smtpPort;
    private final String smtpUser;
    private final String smtpPass;

    public EmailFacade(String host, int port, String user, String pass) {
        this.smtp = new SmtpClient();
        this.mime = new MimeBuilder();
        this.templates = new TemplateEngine();
        this.validator = new AddressValidator();
        this.smtpHost = host;
        this.smtpPort = port;
        this.smtpUser = user;
        this.smtpPass = pass;
    }

    /** Send email using a template (most common use case) */
    public void sendTemplated(
        String from, String to,
        String templateName, Map<String, Object> vars
    ) {
        if (!validator.validate(to)) {
            throw new IllegalArgumentException("Invalid email: " + to);
        }

        String html = templates.render(templateName, vars);

        mime.setSubject((String) vars.getOrDefault("subject", "No Subject"));
        mime.setHtmlBody(html);
        String raw = mime.build();

        smtp.connect(smtpHost, smtpPort);
        try {
            smtp.authenticate(smtpUser, smtpPass);
            smtp.send(from, to, raw);
        } finally {
            smtp.disconnect();
        }
    }

    /** Simple plain text email sending */
    public void sendPlain(String from, String to, String subject, String body) {
        if (!validator.validate(to)) {
            throw new IllegalArgumentException("Invalid email: " + to);
        }

        mime.setSubject(subject);
        mime.setTextBody(body);
        String raw = mime.build();

        smtp.connect(smtpHost, smtpPort);
        try {
            smtp.authenticate(smtpUser, smtpPass);
            smtp.send(from, to, raw);
        } finally {
            smtp.disconnect();
        }
    }
}

// === Usage ===

EmailFacade email = new EmailFacade("smtp.example.com", 587, "user", "pass");

email.sendTemplated(
    "noreply@example.com",
    "user@example.com",
    "welcome",
    Map.of("name", "Taro", "subject", "Welcome!")
);
// Output:
// Validator: user@example.com -> OK
// Template: Rendering welcome
// MIME: Building message (subject=Welcome!, attachments=0)
// SMTP: Connected to smtp.example.com:587
// SMTP: Authenticated as user
// SMTP: Sent from noreply@example.com to user@example.com
// SMTP: Disconnected
```

**Key point**: The 4 complex subsystems — SMTP connection, MIME building, template rendering, and address validation — are consolidated into 2 methods: `sendTemplated` and `sendPlain`.

---

### Code Example 5: Go -- HTTP Server Facade

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "time"
)

// === Subsystems ===

type Router struct {
    routes map[string]http.HandlerFunc
}

func NewRouter() *Router {
    return &Router{routes: make(map[string]http.HandlerFunc)}
}

func (r *Router) AddRoute(path string, handler http.HandlerFunc) {
    r.routes[path] = handler
    fmt.Printf("Router: Added route %s\n", path)
}

func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
    if handler, ok := r.routes[req.URL.Path]; ok {
        handler(w, req)
    } else {
        http.NotFound(w, req)
    }
}

type Middleware struct {
    handlers []func(http.Handler) http.Handler
}

func NewMiddleware() *Middleware {
    return &Middleware{}
}

func (m *Middleware) Use(mw func(http.Handler) http.Handler) {
    m.handlers = append(m.handlers, mw)
    fmt.Println("Middleware: Added middleware")
}

func (m *Middleware) Apply(handler http.Handler) http.Handler {
    for i := len(m.handlers) - 1; i >= 0; i-- {
        handler = m.handlersi
    }
    return handler
}

type CORSConfig struct {
    AllowOrigins []string
    AllowMethods []string
}

func (c *CORSConfig) Apply(next http.Handler) http.Handler {
    fmt.Println("CORS: Configured")
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        next.ServeHTTP(w, r)
    })
}

type GracefulShutdown struct {
    server *http.Server
}

func NewGracefulShutdown(addr string, handler http.Handler) *GracefulShutdown {
    return &GracefulShutdown{
        server: &http.Server{
            Addr:         addr,
            Handler:      handler,
            ReadTimeout:  10 * time.Second,
            WriteTimeout: 10 * time.Second,
        },
    }
}

func (g *GracefulShutdown) Start() error {
    fmt.Printf("Server: Listening on %s\n", g.server.Addr)
    return g.server.ListenAndServe()
}

// === Facade ===

type ServerFacade struct {
    router     *Router
    middleware *Middleware
    cors       *CORSConfig
    addr       string
}

func NewServerFacade(addr string) *ServerFacade {
    return &ServerFacade{
        router:     NewRouter(),
        middleware: NewMiddleware(),
        cors:       &CORSConfig{},
        addr:       addr,
    }
}

// Add a GET route
func (s *ServerFacade) GET(path string, handler http.HandlerFunc) {
    s.router.AddRoute(path, handler)
}

// Add middleware
func (s *ServerFacade) Use(mw func(http.Handler) http.Handler) {
    s.middleware.Use(mw)
}

// Start the server (automatically configures CORS, middleware, and graceful shutdown)
func (s *ServerFacade) Start() error {
    var handler http.Handler = s.router
    handler = s.cors.Apply(handler)
    handler = s.middleware.Apply(handler)

    gs := NewGracefulShutdown(s.addr, handler)
    return gs.Start()
}

// === Usage ===

func main() {
    app := NewServerFacade(":8080")

    // Logging middleware
    app.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            log.Printf("%s %s", r.Method, r.URL.Path)
            next.ServeHTTP(w, r)
        })
    })

    app.GET("/health", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("OK"))
    })

    // Start without being aware of Router, Middleware, CORS, or GracefulShutdown
    app.Start()
}
```

**Key point**: `ServerFacade` integrates 4 subsystems — Router, Middleware, CORS, and GracefulShutdown. The server is up with just `app.GET()` and `app.Start()`. This is the same design philosophy as Express.js.

---

### Code Example 6: React -- Custom Hook as Facade (TypeScript)

```typescript
import { useState, useEffect, useCallback, useMemo } from "react";

// === Subsystems (individual Hooks) ===

function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  return { items, addItem, removeItem, clear, total };
}

function usePayment() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charge = useCallback(async (amount: number, method: string) => {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/payment", {
        method: "POST",
        body: JSON.stringify({ amount, method }),
      });
      if (!res.ok) throw new Error("Payment failed");
      return await res.json();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setProcessing(false);
    }
  }, []);

  return { charge, processing, error };
}

function useShipping() {
  const [address, setAddress] = useState<Address | null>(null);
  const [cost, setCost] = useState(0);

  const calculate = useCallback(async (items: CartItem[], addr: Address) => {
    const res = await fetch("/api/shipping/calculate", {
      method: "POST",
      body: JSON.stringify({ items, address: addr }),
    });
    const data = await res.json();
    setCost(data.cost);
    return data.cost;
  }, []);

  return { address, setAddress, cost, calculate };
}

function useCoupon() {
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(0);

  const apply = useCallback(async (couponCode: string) => {
    const res = await fetch(`/api/coupons/${couponCode}`);
    if (!res.ok) throw new Error("Invalid coupon");
    const data = await res.json();
    setCode(couponCode);
    setDiscount(data.discount);
    return data.discount;
  }, []);

  return { code, discount, apply, setCode };
}

// === Facade Hook ===

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Address {
  zip: string;
  city: string;
  line1: string;
}

interface CheckoutState {
  // Cart
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  // Amounts
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  // Actions
  applyCoupon: (code: string) => Promise<void>;
  setShippingAddress: (addr: Address) => Promise<void>;
  checkout: (paymentMethod: string) => Promise<void>;
  // State
  isProcessing: boolean;
  error: string | null;
  step: "cart" | "shipping" | "payment" | "complete";
}

function useCheckout(): CheckoutState {
  const cart = useCart();
  const payment = usePayment();
  const shipping = useShipping();
  const coupon = useCoupon();
  const [step, setStep] = useState<CheckoutState["step"]>("cart");

  const total = useMemo(
    () => Math.max(0, cart.total + shipping.cost - coupon.discount),
    [cart.total, shipping.cost, coupon.discount],
  );

  const applyCoupon = useCallback(async (code: string) => {
    await coupon.apply(code);
  }, [coupon]);

  const setShippingAddress = useCallback(async (addr: Address) => {
    shipping.setAddress(addr);
    await shipping.calculate(cart.items, addr);
    setStep("shipping");
  }, [cart.items, shipping]);

  const checkout = useCallback(async (paymentMethod: string) => {
    setStep("payment");
    await payment.charge(total, paymentMethod);
    cart.clear();
    setStep("complete");
  }, [total, payment, cart]);

  return {
    items: cart.items,
    addItem: cart.addItem,
    removeItem: cart.removeItem,
    subtotal: cart.total,
    shippingCost: shipping.cost,
    discount: coupon.discount,
    total,
    applyCoupon,
    setShippingAddress,
    checkout,
    isProcessing: payment.processing,
    error: payment.error,
    step,
  };
}

// === Components remain simple ===

function CheckoutPage() {
  const {
    items, subtotal, shippingCost, discount, total,
    checkout, isProcessing, error, step,
  } = useCheckout();

  if (step === "complete") return <div>Thank you!</div>;

  return (
    <div>
      <h2>Checkout ({items.length} items)</h2>
      <p>Subtotal: ${subtotal}</p>
      <p>Shipping: ${shippingCost}</p>
      <p>Discount: -${discount}</p>
      <p>Total: ${total}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={() => checkout("credit_card")} disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Pay Now"}
      </button>
    </div>
  );
}
```

**Key point**: `useCheckout` integrates 4 Hooks — Cart, Payment, Shipping, and Coupon — and provides a unified API to the component. The component does not need to know the "internal structure of the payment process."

---

### Code Example 7: Kotlin -- Android Network Facade

```kotlin
// === Subsystems ===

class HttpClient {
    fun get(url: String, headers: Map<String, String> = emptyMap()): String {
        println("HTTP: GET $url")
        return """{"status": "ok"}"""
    }

    fun post(url: String, body: String, headers: Map<String, String> = emptyMap()): String {
        println("HTTP: POST $url body=$body")
        return """{"id": 1}"""
    }
}

class JsonParser {
    fun <T> parse(json: String, clazz: Class<T>): T {
        println("JSON: Parsing ${json.take(50)}...")
        @Suppress("UNCHECKED_CAST")
        return mapOf("status" to "ok") as T
    }

    fun toJson(obj: Any): String {
        println("JSON: Serializing $obj")
        return """{"serialized": true}"""
    }
}

class TokenManager {
    private var token: String? = null

    fun getToken(): String {
        return token ?: throw IllegalStateException("Not authenticated")
    }

    fun setToken(newToken: String) {
        token = newToken
        println("Token: Stored new token")
    }

    fun isAuthenticated(): Boolean = token != null

    fun clearToken() {
        token = null
        println("Token: Cleared")
    }
}

class CacheManager {
    private val cache = mutableMapOf<String, Pair<String, Long>>()
    private val ttl = 60_000L // 1 minute

    fun get(key: String): String? {
        val entry = cache[key] ?: return null
        if (System.currentTimeMillis() - entry.second > ttl) {
            cache.remove(key)
            return null
        }
        println("Cache: HIT for $key")
        return entry.first
    }

    fun put(key: String, value: String) {
        cache[key] = value to System.currentTimeMillis()
        println("Cache: Stored $key")
    }
}

// === Facade ===

class ApiClient(
    private val http: HttpClient = HttpClient(),
    private val json: JsonParser = JsonParser(),
    private val auth: TokenManager = TokenManager(),
    private val cache: CacheManager = CacheManager(),
    private val baseUrl: String = "https://api.example.com",
) {
    /** GET with auth header (with cache) */
    fun <T> get(path: String, clazz: Class<T>, useCache: Boolean = true): T {
        val url = "$baseUrl$path"

        if (useCache) {
            cache.get(url)?.let { return json.parse(it, clazz) }
        }

        val headers = mapOf("Authorization" to "Bearer ${auth.getToken()}")
        val response = http.get(url, headers)

        if (useCache) cache.put(url, response)
        return json.parse(response, clazz)
    }

    /** POST with auth header */
    fun <T> post(path: String, body: Any, clazz: Class<T>): T {
        val url = "$baseUrl$path"
        val headers = mapOf("Authorization" to "Bearer ${auth.getToken()}")
        val jsonBody = json.toJson(body)
        val response = http.post(url, jsonBody, headers)
        return json.parse(response, clazz)
    }

    /** Login (fetch and store token) */
    fun login(username: String, password: String) {
        val body = json.toJson(mapOf("username" to username, "password" to password))
        val response = http.post("$baseUrl/auth/login", body)
        val result = json.parse(response, Map::class.java)
        auth.setToken(result["token"] as? String ?: "dummy-token")
    }

    /** Logout */
    fun logout() {
        auth.clearToken()
    }
}

// === Usage ===

fun main() {
    val api = ApiClient()
    api.login("user", "pass")
    val result = api.get("/users/me", Map::class.java)
    println("Result: $result")
}
```

**Key point**: `ApiClient` integrates 4 subsystems — HTTP communication, JSON parsing, auth token management, and caching. The Retrofit library for Android is a further development of this design philosophy.

---

### Code Example 8: Module Public API as Facade (TypeScript)

```typescript
// === Internal modules ===
// internal/parser.ts
class Parser {
  parse(source: string): ASTNode {
    console.log("Parser: Parsing source code");
    return { type: "program", body: [] };
  }
}

// internal/validator.ts
class Validator {
  validate(ast: ASTNode): ValidationResult {
    console.log("Validator: Validating AST");
    return { valid: true, errors: [] };
  }
}

// internal/optimizer.ts
class Optimizer {
  optimize(ast: ASTNode): ASTNode {
    console.log("Optimizer: Optimizing AST");
    return ast;
  }
}

// internal/transformer.ts
class Transformer {
  transform(ast: ASTNode): IRNode {
    console.log("Transformer: Transforming to IR");
    return { type: "module", instructions: [] };
  }
}

// internal/emitter.ts
class Emitter {
  emit(ir: IRNode): string {
    console.log("Emitter: Generating output");
    return "compiled output";
  }
}

// === Type definitions ===
interface ASTNode {
  type: string;
  body: ASTNode[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface IRNode {
  type: string;
  instructions: unknown[];
}

interface CompileOptions {
  optimize?: boolean;
  validate?: boolean;
  sourceMaps?: boolean;
}

interface CompileResult {
  code: string;
  ast?: ASTNode;
  errors: string[];
}

// === Facade (index.ts) ===

/**
 * The compiler's public API.
 * Hides the internal Parser, Validator, Optimizer, Transformer, and Emitter.
 */
export function compile(
  source: string,
  options: CompileOptions = {},
): CompileResult {
  const { optimize = true, validate = true } = options;

  // 1. Parse
  const parser = new Parser();
  const ast = parser.parse(source);

  // 2. Validation (optional)
  if (validate) {
    const validator = new Validator();
    const result = validator.validate(ast);
    if (!result.valid) {
      return { code: "", errors: result.errors };
    }
  }

  // 3. Optimization (optional)
  let optimizedAst = ast;
  if (optimize) {
    const optimizer = new Optimizer();
    optimizedAst = optimizer.optimize(ast);
  }

  // 4. Transform
  const transformer = new Transformer();
  const ir = transformer.transform(optimizedAst);

  // 5. Emit output
  const emitter = new Emitter();
  const code = emitter.emit(ir);

  return { code, ast, errors: [] };
}

// === Usage ===
// Consumers do not need to know the internals
// import { compile } from "my-compiler";

const result = compile("const x = 1 + 2;");
console.log(result.code);

const resultNoOptimize = compile("const x = 1 + 2;", { optimize: false });
```

**Key point**: The `index.ts` of an npm package is a typical Facade. The internal 5 classes are consolidated into a single `compile` function. The TypeScript compiler (`tsc`), Babel, and webpack follow the same design.

---

### Code Example 9: Python -- Django/Flask-style ORM Facade

```python
from typing import Any, TypeVar, Generic
from dataclasses import dataclass, field
from datetime import datetime


# === Subsystems ===

class ConnectionPool:
    """Database connection pool"""
    _instance = None

    def __init__(self, dsn: str, pool_size: int = 5):
        self.dsn = dsn
        self.pool_size = pool_size
        print(f"ConnectionPool: Created (dsn={dsn}, size={pool_size})")

    def acquire(self) -> "Connection":
        print("ConnectionPool: Connection acquired")
        return Connection()

    def release(self, conn: "Connection") -> None:
        print("ConnectionPool: Connection released")


class Connection:
    """Database connection"""
    def execute(self, sql: str, params: tuple = ()) -> list[dict]:
        print(f"Connection: {sql} params={params}")
        return [{"id": 1}]  # Dummy result

    def begin(self) -> None:
        print("Connection: BEGIN")

    def commit(self) -> None:
        print("Connection: COMMIT")

    def rollback(self) -> None:
        print("Connection: ROLLBACK")


class QueryBuilder:
    """SQL query builder"""
    def __init__(self, table: str):
        self._table = table
        self._conditions: list[str] = []
        self._params: list[Any] = []
        self._order: str | None = None
        self._limit: int | None = None

    def where(self, condition: str, *params: Any) -> "QueryBuilder":
        self._conditions.append(condition)
        self._params.extend(params)
        return self

    def order_by(self, column: str, desc: bool = False) -> "QueryBuilder":
        direction = "DESC" if desc else "ASC"
        self._order = f"{column} {direction}"
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit = n
        return self

    def build_select(self) -> tuple[str, tuple]:
        sql = f"SELECT * FROM {self._table}"
        if self._conditions:
            sql += " WHERE " + " AND ".join(self._conditions)
        if self._order:
            sql += f" ORDER BY {self._order}"
        if self._limit:
            sql += f" LIMIT {self._limit}"
        return sql, tuple(self._params)

    def build_insert(self, data: dict) -> tuple[str, tuple]:
        cols = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        sql = f"INSERT INTO {self._table} ({cols}) VALUES ({placeholders})"
        return sql, tuple(data.values())

    def build_delete(self) -> tuple[str, tuple]:
        sql = f"DELETE FROM {self._table}"
        if self._conditions:
            sql += " WHERE " + " AND ".join(self._conditions)
        return sql, tuple(self._params)


class Migrator:
    """Schema migration"""
    def create_table(self, name: str, columns: dict[str, str]) -> str:
        cols = ", ".join(f"{k} {v}" for k, v in columns.items())
        return f"CREATE TABLE IF NOT EXISTS {name} ({cols})"


# === Facade ===

T = TypeVar("T")


class DatabaseFacade:
    """Unified interface for database operations"""

    def __init__(self, dsn: str):
        self._pool = ConnectionPool(dsn)
        self._migrator = Migrator()

    def find(
        self,
        table: str,
        conditions: dict[str, Any] | None = None,
        order_by: str | None = None,
        limit: int | None = None,
    ) -> list[dict]:
        """Conditional search (SELECT)"""
        qb = QueryBuilder(table)
        if conditions:
            for col, val in conditions.items():
                qb.where(f"{col} = ?", val)
        if order_by:
            desc = order_by.startswith("-")
            col = order_by.lstrip("-")
            qb.order_by(col, desc=desc)
        if limit:
            qb.limit(limit)

        sql, params = qb.build_select()
        conn = self._pool.acquire()
        try:
            return conn.execute(sql, params)
        finally:
            self._pool.release(conn)

    def insert(self, table: str, data: dict) -> dict:
        """Insert record (INSERT)"""
        qb = QueryBuilder(table)
        sql, params = qb.build_insert(data)
        conn = self._pool.acquire()
        try:
            conn.begin()
            result = conn.execute(sql, params)
            conn.commit()
            return result[0] if result else {}
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.release(conn)

    def delete(self, table: str, conditions: dict[str, Any]) -> None:
        """Delete record (DELETE)"""
        qb = QueryBuilder(table)
        for col, val in conditions.items():
            qb.where(f"{col} = ?", val)
        sql, params = qb.build_delete()
        conn = self._pool.acquire()
        try:
            conn.begin()
            conn.execute(sql, params)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.release(conn)

    def migrate(self, table: str, columns: dict[str, str]) -> None:
        """Create table (migration)"""
        sql = self._migrator.create_table(table, columns)
        conn = self._pool.acquire()
        try:
            conn.execute(sql)
        finally:
            self._pool.release(conn)


# === Usage ===

db = DatabaseFacade("postgresql://localhost:5432/mydb")

# Create table
db.migrate("users", {
    "id": "SERIAL PRIMARY KEY",
    "name": "VARCHAR(100)",
    "email": "VARCHAR(255)",
    "created_at": "TIMESTAMP DEFAULT NOW()",
})

# Insert record
db.insert("users", {"name": "Alice", "email": "alice@example.com"})

# Search
users = db.find("users", conditions={"name": "Alice"}, order_by="-created_at", limit=10)

# Delete
db.delete("users", conditions={"id": 1})
```

**Key point**: `DatabaseFacade` integrates 4 subsystems — ConnectionPool, QueryBuilder, Connection, and Migrator. Django ORM and SQLAlchemy's `Session` follow this design.

---

### Code Example 10: Facade + Strategy Combination (TypeScript)

```typescript
// === Strategy interface ===

interface NotificationChannel {
  send(to: string, message: string): Promise<boolean>;
}

class EmailChannel implements NotificationChannel {
  async send(to: string, message: string): Promise<boolean> {
    console.log(`Email to ${to}: ${message}`);
    return true;
  }
}

class SmsChannel implements NotificationChannel {
  async send(to: string, message: string): Promise<boolean> {
    console.log(`SMS to ${to}: ${message}`);
    return true;
  }
}

class PushChannel implements NotificationChannel {
  async send(to: string, message: string): Promise<boolean> {
    console.log(`Push to ${to}: ${message}`);
    return true;
  }
}

class SlackChannel implements NotificationChannel {
  async send(to: string, message: string): Promise<boolean> {
    console.log(`Slack to ${to}: ${message}`);
    return true;
  }
}

// === Subsystems ===

class TemplateRenderer {
  render(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(`{{${key}}}`, value);
    }
    return result;
  }
}

class UserPreferences {
  getPreferredChannels(userId: string): string[] {
    // In practice, fetch from DB
    return ["email", "push"];
  }

  getContactInfo(userId: string): Record<string, string> {
    return {
      email: "user@example.com",
      phone: "+81-90-1234-5678",
      deviceToken: "abc123",
      slackId: "U12345",
    };
  }
}

class NotificationLog {
  async log(
    userId: string,
    channel: string,
    message: string,
    success: boolean,
  ): Promise<void> {
    console.log(
      `Log: user=${userId} channel=${channel} success=${success}`
    );
  }
}

// === Facade ===

interface NotifyOptions {
  template: string;
  vars: Record<string, string>;
  userId: string;
  channels?: string[];  // Uses user preferences if not specified
}

class NotificationFacade {
  private channelMap: Map<string, NotificationChannel>;

  constructor(
    private renderer: TemplateRenderer,
    private preferences: UserPreferences,
    private logger: NotificationLog,
    channels: Record<string, NotificationChannel>,
  ) {
    this.channelMap = new Map(Object.entries(channels));
  }

  /** Send notification: template expansion → channel selection → send → log */
  async notify(options: NotifyOptions): Promise<void> {
    const { template, vars, userId } = options;

    // 1. Expand template
    const message = this.renderer.render(template, vars);

    // 2. Determine channels (explicit or user preferences)
    const channelNames = options.channels
      ?? this.preferences.getPreferredChannels(userId);

    // 3. Fetch contact info
    const contacts = this.preferences.getContactInfo(userId);

    // 4. Send to all channels (in parallel)
    const results = await Promise.allSettled(
      channelNames.map(async (name) => {
        const channel = this.channelMap.get(name);
        if (!channel) {
          console.warn(`Unknown channel: ${name}`);
          return;
        }

        const to = contacts[name] ?? contacts.email;
        const success = await channel.send(to, message);
        await this.logger.log(userId, name, message, success);
      }),
    );

    const failures = results.filter(r => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`${failures.length} notification(s) failed`);
    }
  }

  /** Emergency notification: send to all channels */
  async emergency(userId: string, message: string): Promise<void> {
    const allChannels = Array.from(this.channelMap.keys());
    await this.notify({
      template: "[URGENT] {{message}}",
      vars: { message },
      userId,
      channels: allChannels,
    });
  }
}

// === Usage ===

const notifier = new NotificationFacade(
  new TemplateRenderer(),
  new UserPreferences(),
  new NotificationLog(),
  {
    email: new EmailChannel(),
    sms: new SmsChannel(),
    push: new PushChannel(),
    slack: new SlackChannel(),
  },
);

// Notify based on user preferences (email + push)
await notifier.notify({
  template: "Hello {{name}}, your order #{{orderId}} has shipped!",
  vars: { name: "Taro", orderId: "12345" },
  userId: "user-1",
});

// Emergency notification: all channels
await notifier.emergency("user-1", "System maintenance in 30 minutes");
```

**Key point**: The Facade (NotificationFacade) is combined with Strategy (NotificationChannel). The Facade handles orchestration of the subsystems, while Strategy handles switching between individual notification channels.

---

## 4. Comparison Tables

### Comparison Table 1: Facade vs Adapter vs Mediator vs Controller

| Aspect | Facade | Adapter | Mediator | Controller |
|------|--------|---------|----------|------------|
| **Purpose** | Hide complexity | Interface conversion | Mediate between objects | Route requests |
| **Target count** | Many subsystems | 1 | Many components | Many services |
| **Direction** | One-way (Client -> Sub) | One-way | Bidirectional | One-way |
| **Creates new IF** | Creates simplified IF | Converts existing IF | Creates communication IF | Creates endpoint IF |
| **Subsystem awareness** | Unaware | Unaware | Know each other | Unaware |
| **State management** | None (stateless) | None | Yes (component state) | Yes (request state) |
| **Example** | `compile(source)` | XMLParser -> JSON | ChatRoom | Express Router |

### Comparison Table 2: Facade Design by Level

| Level | Example | Granularity | Scope |
|--------|-----|------|---------|
| **Function** | `compile(source)` | Finest | Within 1 file |
| **Module** | `index.ts` re-export | Fine | 1 package |
| **Class** | `UserFacade` | Medium | 1 domain |
| **Service** | API Gateway | Coarse | Multiple microservices |
| **Infrastructure** | CDK/Terraform wrapper | Coarsest | Cloud resources |

### Comparison Table 3: Facade Pattern Implementation Methods

| Method | Language/Framework | Characteristics | When to Use |
|------|---------------------|------|---------|
| **Class Facade** | Java, TypeScript, Kotlin | DI-capable, easy to test | Service layer |
| **Function Facade** | TypeScript, Python, Go | Simple, stateless | Utilities |
| **Module Facade** | `index.ts`, `__init__.py` | Public API control via re-export | Package publishing |
| **Custom Hook** | React | Hook composition | UI state management |
| **Gateway** | API Gateway, BFF | Network boundary | Microservices |
| **CLI Wrapper** | Makefile, npm scripts | Command aggregation | Development workflow |

---

## 5. Anti-Patterns

### Anti-Pattern 1: God Facade (Bloated Facade)

```typescript
// BAD: Packing operations from every domain into a single Facade
class AppFacade {
  // User management
  createUser(name: string): void { /* ... */ }
  deleteUser(id: string): void { /* ... */ }
  updateUserProfile(id: string, data: unknown): void { /* ... */ }

  // Order management
  createOrder(userId: string, items: unknown[]): void { /* ... */ }
  cancelOrder(orderId: string): void { /* ... */ }
  refundOrder(orderId: string): void { /* ... */ }

  // Payment
  processPayment(orderId: string, method: string): void { /* ... */ }
  verifyPayment(txId: string): void { /* ... */ }

  // Reports
  generateDailyReport(): void { /* ... */ }
  generateMonthlyReport(): void { /* ... */ }

  // Email
  sendWelcomeEmail(userId: string): void { /* ... */ }
  sendOrderConfirmation(orderId: string): void { /* ... */ }

  // ... 50+ methods
}

// Problems:
// 1. SRP violation: 5+ domain responsibilities in 1 class
// 2. Scope of change impact is too wide
// 3. Difficult to test (too many mock targets)
// 4. The Facade itself becomes a "complex subsystem"
```

```typescript
// GOOD: Split Facade by domain

class UserFacade {
  constructor(
    private repo: UserRepository,
    private email: EmailService,
    private audit: AuditService,
  ) {}

  register(name: string, emailAddr: string): User { /* ... */ }
  deactivate(id: string): void { /* ... */ }
}

class OrderFacade {
  constructor(
    private repo: OrderRepository,
    private payment: PaymentService,
    private inventory: InventoryService,
  ) {}

  place(userId: string, items: OrderItem[]): Order { /* ... */ }
  cancel(orderId: string): void { /* ... */ }
}

class ReportFacade {
  constructor(
    private analytics: AnalyticsService,
    private exporter: ExportService,
  ) {}

  daily(): Report { /* ... */ }
  monthly(): Report { /* ... */ }
}

// Each Facade has 3-5 methods and clear responsibility boundaries
```

**Decision criteria**: Consider splitting when a single Facade has **7 or more methods**.

---

### Anti-Pattern 2: Leaky Facade

```typescript
// BAD: Facade exposes internal details of subsystems
class LeakyFacade {
  private db: Database;
  private cache: Redis;

  // Subsystem type is directly exposed
  getDbConnection(): DatabaseConnection {
    return this.db.getConnection();
  }

  // Internal cache key rules are leaking
  getCachedUser(userId: string): string | null {
    return this.cache.get(`user:v2:${userId}`);  // Key format leaks
  }

  // SQL is directly exposed
  queryUsers(sql: string): User[] {
    return this.db.query(sql);
  }
}

// Problems:
// 1. Clients need to know internals of subsystems
// 2. Changes to cache key format affect all clients
// 3. Risk of SQL injection
```

```typescript
// GOOD: Completely hide internal details

class CleanFacade {
  constructor(
    private db: Database,
    private cache: Redis,
  ) {}

  // Hide subsystem types and return domain types
  async findUser(userId: string): Promise<User | null> {
    // Cache strategy is managed internally
    const cached = this.cache.get(`user:v2:${userId}`);
    if (cached) return JSON.parse(cached);

    // SQL is managed internally
    const user = await this.db.query(
      "SELECT * FROM users WHERE id = ?", [userId]
    );
    if (user) {
      this.cache.set(`user:v2:${userId}`, JSON.stringify(user), 300);
    }
    return user;
  }
}
```

**Decision criteria**: If subsystem-specific types or rules appear in the Facade's method signatures, the abstraction is insufficient.

---

### Anti-Pattern 3: Rigid Facade

```typescript
// BAD: Completely blocking direct access to subsystems
class RigidFacade {
  // All subsystems hidden as private
  private emailService: EmailService;
  private smsService: SmsService;
  private pushService: PushService;

  // Only provides standard operations
  notifyUser(userId: string, msg: string): void {
    // Always sends email + push (not changeable)
    this.emailService.send(userId, msg);
    this.pushService.send(userId, msg);
  }

  // No way to send only SMS
  // No way to combine custom channels
}

// Problems:
// 1. Cannot handle advanced use cases
// 2. Every new requirement requires adding a method to the Facade
// 3. Eventually leads to hacks that bypass the Facade
```

```typescript
// GOOD: Facade as a convenient shortcut, direct access also allowed

class FlexibleFacade {
  // Expose subsystems (for advanced use cases)
  readonly email: EmailService;
  readonly sms: SmsService;
  readonly push: PushService;

  constructor(
    email: EmailService,
    sms: SmsService,
    push: PushService,
  ) {
    this.email = email;
    this.sms = sms;
    this.push = push;
  }

  // Shortcut for standard operations
  notifyUser(userId: string, msg: string): void {
    this.email.send(userId, msg);
    this.push.send(userId, msg);
  }

  // Advanced use cases access subsystems directly
  // facade.sms.send(userId, urgentMsg);
}
```

**Decision criteria**: A Facade is a "gate," not a "wall." It should cover 80% of use cases and allow direct subsystem access for the remaining 20%.

---

## 6. Edge Cases and Considerations

### 6.1 Facade Lifecycle Management

```typescript
// When a Facade manages resources of subsystems,
// proper cleanup is necessary

class ManagedFacade implements Disposable {
  private pool: ConnectionPool;
  private cache: CacheService;

  constructor() {
    this.pool = new ConnectionPool(10);
    this.cache = new CacheService();
  }

  // ES2024+ Disposable pattern
  [Symbol.dispose](): void {
    this.pool.close();
    this.cache.flush();
    console.log("ManagedFacade: Resources cleaned up");
  }
}

// Automatic cleanup with using
{
  using facade = new ManagedFacade();
  // ... use
} // Automatically disposed
```

### 6.2 Error Handling in Async Facades

```typescript
class AsyncFacade {
  async complexOperation(): Promise<Result> {
    // Execute multiple async operations sequentially
    // Compensation handling on failure is important
    const step1 = await this.serviceA.doSomething();

    try {
      const step2 = await this.serviceB.doSomething(step1);
    } catch (error) {
      // Undo step1 (compensating transaction)
      await this.serviceA.undo(step1);
      throw error;
    }
  }
}
```

### 6.3 Facade Versioning

```typescript
// When the API evolves, keep the old Facade and add a new one

/** @deprecated Use CheckoutFacadeV2 */
class CheckoutFacade {
  checkout(cartId: string): void { /* old implementation */ }
}

class CheckoutFacadeV2 {
  checkout(cartId: string, options: CheckoutOptions): Promise<Receipt> {
    /* new implementation */
  }
}
```

### 6.4 Testing Strategy

```typescript
// Testing a Facade: integration test with mocked subsystems

describe("DeployFacade", () => {
  it("should execute full deployment pipeline", async () => {
    const git = { pull: jest.fn(), tag: jest.fn() };
    const build = {
      install: jest.fn(),
      lint: jest.fn(),
      test: jest.fn(),
      build: jest.fn().mockReturnValue("artifact.tar.gz"),
    };
    const deploy = {
      upload: jest.fn().mockReturnValue("https://prod.example.com"),
      activate: jest.fn(),
      healthCheck: jest.fn().mockReturnValue(true),
    };
    const notify = { sendSlack: jest.fn(), sendEmail: jest.fn() };

    const facade = new DeployFacade(git, build, deploy, notify);
    const result = await facade.release("1.0.0");

    // Verify each subsystem was called in the correct order
    expect(git.pull).toHaveBeenCalledWith("main");
    expect(build.build).toHaveBeenCalledAfter(build.test);
    expect(deploy.healthCheck).toHaveBeenCalled();
    expect(git.tag).toHaveBeenCalledWith("1.0.0");
    expect(notify.sendSlack).toHaveBeenCalled();
  });

  it("should rollback on health check failure", async () => {
    const deploy = {
      upload: jest.fn().mockReturnValue("url"),
      activate: jest.fn(),
      healthCheck: jest.fn().mockReturnValue(false),  // Failure
      rollback: jest.fn(),
    };
    // ... verify that rollback is called
  });
});
```

---

## 7. Trade-off Analysis

### When to Introduce

| Situation | Reason |
|------|------|
| Routine operations combining 3+ subsystems | Eliminate duplicated steps |
| Public API of a library/framework | Hide internals and provide a stable API |
| Wrapping a legacy system | Hide old implementation with a new API |
| BFF in microservices | Aggregate multiple services |
| Improving testability | Consolidate mock targets to the Facade |

### When Not to Introduce

| Situation | Reason |
|------|------|
| Only one subsystem | No added value from a Facade |
| Client needs flexible combinations of subsystems | Facade becomes a constraint |
| Facade is likely to have 10+ methods | Risk of God Facade |
| Performance-critical path | Additional indirection layer becomes overhead |

### Cost of a Facade

```
┌──────────────────────────────────────────────────────────┐
│                 Facade Cost Analysis                      │
│                                                         │
│  Benefits                    Drawbacks                  │
│  ┌──────────────────────┐    ┌──────────────────────┐   │
│  │ + Simplified client  │    │ - Additional layer   │   │
│  │ + DRY (centralized   │    │ - Risk of God Facade │   │
│  │   steps)             │    │ - Reduced flexibility│   │
│  │ + Loose coupling     │    │   (standard ops only)│   │
│  │ + Testability        │    │ - May need to        │   │
│  │ + Localized changes  │    │   re-expose all      │   │
│  │ + Lower learning     │    │   features           │   │
│  │   cost               │    │                      │   │
│  └──────────────────────┘    └──────────────────────┘   │
│                                                         │
│  Judgment: If there are 3+ subsystems and 80%+ of       │
│  use cases are routine, introducing a Facade is          │
│  reasonable.                                             │
└──────────────────────────────────────────────────────────┘
```

---

## 8. Exercises

### Exercise 1: Basic -- File Conversion Facade (Difficulty: ★☆☆)

Implement `FileConverterFacade` using the following subsystems.

```typescript
// Given subsystems
class FileReader {
  read(path: string): string {
    console.log(`Reading ${path}`);
    return "file content";
  }
}

class CsvParser {
  parse(content: string): Record<string, string>[] {
    console.log("Parsing CSV");
    return [{ name: "Alice", age: "30" }];
  }
}

class JsonFormatter {
  format(data: unknown): string {
    console.log("Formatting to JSON");
    return JSON.stringify(data, null, 2);
  }
}

class FileWriter {
  write(path: string, content: string): void {
    console.log(`Writing to ${path}`);
  }
}

// TODO: Implement FileConverterFacade
// - Provide a convertCsvToJson(inputPath, outputPath) method
// - Use the 4 subsystems in the correct order
```

**Expected output**:

```
Reading data.csv
Parsing CSV
Formatting to JSON
Writing to data.json
```

<details>
<summary>Answer (click to expand)</summary>

```typescript
class FileConverterFacade {
  constructor(
    private reader: FileReader,
    private parser: CsvParser,
    private formatter: JsonFormatter,
    private writer: FileWriter,
  ) {}

  convertCsvToJson(inputPath: string, outputPath: string): void {
    // 1. Read file
    const content = this.reader.read(inputPath);

    // 2. Parse CSV
    const data = this.parser.parse(content);

    // 3. Format to JSON
    const json = this.formatter.format(data);

    // 4. Write file
    this.writer.write(outputPath, json);
  }
}

const converter = new FileConverterFacade(
  new FileReader(),
  new CsvParser(),
  new JsonFormatter(),
  new FileWriter(),
);

converter.convertCsvToJson("data.csv", "data.json");
// Output:
// Reading data.csv
// Parsing CSV
// Formatting to JSON
// Writing to data.json
```

</details>

---

### Exercise 2: Applied -- Payment Processing Facade (Difficulty: ★★☆)

Design and implement a `PaymentFacade` that meets the following requirements.

**Requirements**:
1. Provide a `processPayment(orderId, amount, method)` method
2. Execute the following steps: stock check → payment processing → stock deduction → receipt generation → email notification
3. On payment failure, restore the stock (compensating transaction)
4. Define each subsystem with an interface and inject via DI

```typescript
// Subsystem interfaces
interface InventoryService {
  check(orderId: string): boolean;
  reserve(orderId: string): void;
  release(orderId: string): void;  // For compensation
}

interface PaymentGateway {
  charge(amount: number, method: string): Promise<string>; // returns txId
}

interface ReceiptService {
  generate(orderId: string, txId: string, amount: number): string;
}

interface EmailService {
  send(to: string, subject: string, body: string): void;
}
```

**Expected output (happy path)**:

```
Inventory: Checking order-123
Inventory: Reserved order-123
Payment: Charging 5000 via credit_card
Receipt: Generated for order-123 (tx: TX-abc)
Email: Sent to customer
Payment complete: TX-abc
```

**Expected output (payment failure)**:

```
Inventory: Checking order-123
Inventory: Reserved order-123
Payment: Charging 5000 via credit_card
Payment failed: insufficient funds
Inventory: Released order-123 (compensation)
Error: Payment failed
```

<details>
<summary>Answer (click to expand)</summary>

```typescript
class PaymentFacade {
  constructor(
    private inventory: InventoryService,
    private payment: PaymentGateway,
    private receipt: ReceiptService,
    private email: EmailService,
  ) {}

  async processPayment(
    orderId: string,
    amount: number,
    method: string,
    customerEmail: string = "customer@example.com",
  ): Promise<string> {
    // 1. Stock check
    if (!this.inventory.check(orderId)) {
      throw new Error("Out of stock");
    }

    // 2. Reserve stock
    this.inventory.reserve(orderId);

    // 3. Payment (restore stock on failure)
    let txId: string;
    try {
      txId = await this.payment.charge(amount, method);
    } catch (error) {
      // Compensating transaction: restore stock
      this.inventory.release(orderId);
      throw error;
    }

    // 4. Generate receipt
    const receiptText = this.receipt.generate(orderId, txId, amount);

    // 5. Send email
    this.email.send(
      customerEmail,
      `Order ${orderId} confirmed`,
      receiptText,
    );

    return txId;
  }
}

// === Test implementations ===

class MockInventory implements InventoryService {
  check(orderId: string): boolean {
    console.log(`Inventory: Checking ${orderId}`);
    return true;
  }
  reserve(orderId: string): void {
    console.log(`Inventory: Reserved ${orderId}`);
  }
  release(orderId: string): void {
    console.log(`Inventory: Released ${orderId} (compensation)`);
  }
}

class MockPaymentGateway implements PaymentGateway {
  constructor(private shouldFail: boolean = false) {}
  async charge(amount: number, method: string): Promise<string> {
    console.log(`Payment: Charging ${amount} via ${method}`);
    if (this.shouldFail) {
      console.log("Payment failed: insufficient funds");
      throw new Error("Payment failed");
    }
    return "TX-abc";
  }
}

class MockReceiptService implements ReceiptService {
  generate(orderId: string, txId: string, amount: number): string {
    console.log(`Receipt: Generated for ${orderId} (tx: ${txId})`);
    return `Receipt: ${orderId} - ${txId} - $${amount}`;
  }
}

class MockEmailService implements EmailService {
  send(to: string, subject: string, body: string): void {
    console.log("Email: Sent to customer");
  }
}

// Happy path
const facade = new PaymentFacade(
  new MockInventory(),
  new MockPaymentGateway(false),
  new MockReceiptService(),
  new MockEmailService(),
);
const txId = await facade.processPayment("order-123", 5000, "credit_card");
console.log(`Payment complete: ${txId}`);

// Error path
const facadeFail = new PaymentFacade(
  new MockInventory(),
  new MockPaymentGateway(true),  // Payment failure
  new MockReceiptService(),
  new MockEmailService(),
);
try {
  await facadeFail.processPayment("order-123", 5000, "credit_card");
} catch (e) {
  console.log(`Error: ${(e as Error).message}`);
}
```

</details>

---

### Exercise 3: Advanced -- Facade Refactoring (Difficulty: ★★★)

Refactor the following God Facade by splitting it appropriately.

**Requirements**:
1. Split the God Facade into 3 or more Facades
2. Each Facade must follow SRP (responsible for only 1 domain)
3. If subsystems are shared between Facades, share them via DI
4. The original client code should work with minimal changes

```typescript
// Current God Facade (target for refactoring)
class ECommerceFacade {
  // User-related
  registerUser(name: string, email: string): User { /* ... */ }
  loginUser(email: string, password: string): string { /* ... */ }
  updateProfile(userId: string, data: Partial<User>): void { /* ... */ }
  deleteUser(userId: string): void { /* ... */ }

  // Product-related
  listProducts(category?: string): Product[] { /* ... */ }
  searchProducts(query: string): Product[] { /* ... */ }
  getProductDetail(productId: string): Product { /* ... */ }
  addProductReview(productId: string, review: Review): void { /* ... */ }

  // Order-related
  createOrder(userId: string, items: CartItem[]): Order { /* ... */ }
  cancelOrder(orderId: string): void { /* ... */ }
  trackOrder(orderId: string): OrderStatus { /* ... */ }
  returnOrder(orderId: string, reason: string): void { /* ... */ }
  processPayment(orderId: string, method: string): void { /* ... */ }
  generateInvoice(orderId: string): string { /* ... */ }

  // Notification-related
  sendEmail(to: string, template: string, vars: object): void { /* ... */ }
  sendSms(to: string, message: string): void { /* ... */ }
  sendPushNotification(deviceId: string, message: string): void { /* ... */ }
}
```

**Expected split structure**:

```
Before: 1 God Facade (16 methods)
After:  4 Domain Facades (3-5 methods each)
        - UserFacade
        - ProductFacade
        - OrderFacade
        - NotificationFacade
```

<details>
<summary>Answer (click to expand)</summary>

```typescript
// === Shared subsystems ===

interface EventBus {
  emit(event: string, data: unknown): void;
}

interface AuditLogger {
  log(action: string, userId: string, detail: string): void;
}

// === Split Facades ===

class UserFacade {
  constructor(
    private repo: UserRepository,
    private auth: AuthService,
    private events: EventBus,
    private audit: AuditLogger,
  ) {}

  register(name: string, email: string): User {
    const user = this.repo.create({ name, email });
    this.events.emit("user.registered", user);
    this.audit.log("REGISTER", user.id, `User ${name} registered`);
    return user;
  }

  login(email: string, password: string): string {
    return this.auth.authenticate(email, password);
  }

  updateProfile(userId: string, data: Partial<User>): void {
    this.repo.update(userId, data);
    this.audit.log("UPDATE_PROFILE", userId, JSON.stringify(data));
  }

  delete(userId: string): void {
    this.repo.delete(userId);
    this.events.emit("user.deleted", { userId });
    this.audit.log("DELETE", userId, "User deleted");
  }
}

class ProductFacade {
  constructor(
    private catalog: CatalogService,
    private search: SearchService,
    private reviews: ReviewService,
  ) {}

  list(category?: string): Product[] {
    return this.catalog.list(category);
  }

  search(query: string): Product[] {
    return this.search.search(query);
  }

  getDetail(productId: string): Product {
    return this.catalog.getById(productId);
  }

  addReview(productId: string, review: Review): void {
    this.reviews.add(productId, review);
  }
}

class OrderFacade {
  constructor(
    private orders: OrderRepository,
    private payment: PaymentGateway,
    private inventory: InventoryService,
    private invoicing: InvoiceService,
    private events: EventBus,        // Shared with UserFacade
    private audit: AuditLogger,      // Shared with UserFacade
  ) {}

  create(userId: string, items: CartItem[]): Order {
    this.inventory.reserve(items);
    const order = this.orders.create(userId, items);
    this.events.emit("order.created", order);
    return order;
  }

  cancel(orderId: string): void {
    const order = this.orders.get(orderId);
    this.inventory.release(order.items);
    this.orders.updateStatus(orderId, "cancelled");
    this.audit.log("CANCEL_ORDER", order.userId, orderId);
  }

  track(orderId: string): OrderStatus {
    return this.orders.getStatus(orderId);
  }

  processPayment(orderId: string, method: string): void {
    const order = this.orders.get(orderId);
    this.payment.charge(order.total, method);
    this.orders.updateStatus(orderId, "paid");
    this.events.emit("order.paid", { orderId });
  }

  return_(orderId: string, reason: string): void {
    this.orders.updateStatus(orderId, "returned");
    this.audit.log("RETURN_ORDER", "", `${orderId}: ${reason}`);
  }

  generateInvoice(orderId: string): string {
    const order = this.orders.get(orderId);
    return this.invoicing.generate(order);
  }
}

class NotificationFacade {
  constructor(
    private email: EmailService,
    private sms: SmsService,
    private push: PushService,
    private templates: TemplateEngine,
  ) {}

  sendEmail(to: string, template: string, vars: object): void {
    const body = this.templates.render(template, vars);
    this.email.send(to, body);
  }

  sendSms(to: string, message: string): void {
    this.sms.send(to, message);
  }

  sendPush(deviceId: string, message: string): void {
    this.push.send(deviceId, message);
  }
}

// === Configuration in DI container ===

function createFacades(container: DIContainer) {
  // Shared subsystems
  const events = container.get(EventBus);
  const audit = container.get(AuditLogger);

  return {
    users: new UserFacade(
      container.get(UserRepository),
      container.get(AuthService),
      events,  // shared
      audit,   // shared
    ),
    products: new ProductFacade(
      container.get(CatalogService),
      container.get(SearchService),
      container.get(ReviewService),
    ),
    orders: new OrderFacade(
      container.get(OrderRepository),
      container.get(PaymentGateway),
      container.get(InventoryService),
      container.get(InvoiceService),
      events,  // shared
      audit,   // shared
    ),
    notifications: new NotificationFacade(
      container.get(EmailService),
      container.get(SmsService),
      container.get(PushService),
      container.get(TemplateEngine),
    ),
  };
}

// === Adapter for backward compatibility ===

/** @deprecated Please use the individual Facades */
class LegacyECommerceFacade {
  constructor(
    private users: UserFacade,
    private products: ProductFacade,
    private orders: OrderFacade,
    private notifications: NotificationFacade,
  ) {}

  // Delegate old API to new Facades
  registerUser(name: string, email: string): User {
    return this.users.register(name, email);
  }
  createOrder(userId: string, items: CartItem[]): Order {
    return this.orders.create(userId, items);
  }
  // ... delegate other methods similarly
}
```

</details>

---

## 9. FAQ

### Q1: Is a Facade the same as an API Gateway?

Conceptually, yes. An API Gateway can be described as a large-scale application of the Facade pattern operating at the network boundary. The differences are as follows:

| Aspect | Facade (in code) | API Gateway |
|------|---------------------|-------------|
| Scope | Within the application | Network boundary |
| Protocol | Method calls | HTTP/gRPC |
| Additional responsibilities | None | Authentication, rate limiting, load balancing |
| Example | `UserFacade` class | Kong, AWS API Gateway |

### Q2: Does using a Facade make testing harder?

No, it actually makes it easier. If subsystems are injected via DI, mocks can be injected during testing. Without a Facade, clients must mock all subsystems they directly operate, making tests more complex.

### Q3: Is a React custom hook a Facade?

Yes. In that it hides multiple Hooks (useState, useEffect, useReducer, etc.) and API calls internally and provides a simple API to the component, it is a form of the Facade pattern. The React official documentation also recommends the design of "hiding complexity with custom hooks."

### Q4: What is the difference between a Facade and a Service Layer?

A Facade is a structural pattern that provides an "entry point that simplifies existing subsystems." A Service Layer is an architectural pattern that defines "the execution layer for business logic." In practice, the service layer often also serves as a Facade.

| Aspect | Facade | Service Layer |
|------|--------|---------------|
| Purpose | Hide complexity | Aggregate business logic |
| Logic | Minimal (delegation only) | Contains business rules |
| Transactions | Typically none | Transaction boundaries |
| Reuse | From the presentation layer | From multiple presentations |

### Q5: Is it acceptable to put business logic inside a Facade?

In principle, no. A Facade should be a "thin orchestration layer." Business logic should be placed in the subsystems (domain services), and the Facade should focus on managing the order in which they are called.

```typescript
// BAD: Business logic in Facade
class BadFacade {
  placeOrder(items: Item[]) {
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    if (total > 10000) {
      const discount = total * 0.1;  // ← business logic
      // ...
    }
  }
}

// GOOD: Business logic in subsystems
class GoodFacade {
  placeOrder(items: Item[]) {
    const total = this.pricing.calculate(items);  // ← delegate to subsystem
    const order = this.orders.create(items, total);
    this.notify.send(order);
  }
}
```

### Q6: How is the Facade pattern used in microservices?

In microservice architecture, the **BFF (Backend for Frontend)** is a typical example of the Facade pattern. A mobile BFF aggregates multiple microservices (User, Product, Order, Payment) and returns all the data the client needs from a single API endpoint.

```
Mobile App
    │
    ▼
┌─────────────────┐
│  Mobile BFF     │  ← Facade
│  (API Gateway)  │
└────────┬────────┘
    ┌────┼────┬────┐
    ▼    ▼    ▼    ▼
  User Product Order Payment
  Service Service Service Service
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend solidly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is it used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| **Purpose** | Provide a unified, simplified interface to a set of complex subsystems |
| **Essence** | Information hiding + encapsulation of procedures + shortcut |
| **Benefits** | Simplified client, loose coupling, DRY, testability |
| **Application levels** | Function / module / class / service / infrastructure |
| **Anti-patterns** | God Facade / Leaky Facade / Rigid Facade |
| **Note** | A Facade is a "gate," not a "wall." Direct access should also be permitted |
| **Testing** | Inject subsystems via DI and test with mocks |
| **Combinations** | Can be used together with Strategy, Observer, Template Method |

---

## Recommended Next Guides

- [Proxy Pattern](./03-proxy.md) -- Proxy object for access control
- [Adapter Pattern](./00-adapter.md) -- Interface conversion
- [Decorator Pattern](./01-decorator.md) -- Dynamic feature addition
- [Composite Pattern](./04-composite.md) -- Unified operations on tree structures
- [Mediator Pattern](../02-behavioral/00-observer.md) -- Mediation between objects
- [Clean Architecture](../../../system-design-guide/docs/02-architecture/01-clean-architecture.md) -- Layered structure design

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
2. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media.
3. Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley.
4. Martin, R. C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.
5. Richardson, C. (2018). *Microservices Patterns*. Manning Publications.
6. Refactoring.Guru -- Facade. https://refactoring.guru/design-patterns/facade
