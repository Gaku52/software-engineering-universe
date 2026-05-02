# Adapter Pattern

> A structural pattern that wraps a class with an incompatible interface in a **wrapper**, converting it to the interface the client expects.

---

## Prerequisites

| Topic | Required Level | Reference |
|---------|-----------|--------|
| Object-Oriented Programming | Basic | OOP Basics |
| Interfaces and Abstract Classes | Basic | Interface Design |
| Delegation and Inheritance | Understanding | Composition Over Inheritance |
| SOLID Principles (especially DIP, ISP) | Basic | SOLID |
| TypeScript / Python Type System | Basic | Language Guides |

---

## What You Will Learn

1. The **purpose** of the Adapter pattern and why interface conversion is necessary
2. The two forms — **Object Adapter (delegation)** and **Class Adapter (inheritance)** — and criteria for choosing between them
3. Practical use of adapters for integrating existing libraries, legacy code, and external APIs
4. Lightweight interface conversion using **function adapters (higher-order functions)**
5. Differences between Adapter and Facade, Decorator, and Proxy — and how to avoid over-application

---

## Why the Adapter Pattern Is Necessary (WHY)

### Problem: Interface Mismatch

In real-world software development, you frequently encounter situations where "there is a class or library you want to use, but it doesn't match the interface your code expects."

```
[Problem 1: Integrating an external library]
  Your app uses the DataParser interface
  But the XML parser library you want to adopt has completely different method names and arguments
  → You cannot modify the library's source code

[Problem 2: Coexisting with legacy code]
  The new system is designed to use NewOrderService
  But the legacy LegacyOrderService has different method names and arguments
  → There is no time to fully rewrite the old system

[Problem 3: Switching third-party providers]
  You were using Stripe for payment processing, but want to add PayPal as well
  Each SDK has a completely different interface
  → You don't want business logic to depend on the payment SDK

[Problem 4: Easing testing]
  You want to test code that depends on an external service
  You want to swap in a mock, but the external SDK's interface is too complex
  → You want to convert it to a testable interface
```

### Solution: Interface Conversion via Adapter

```
Before (direct dependency — fragile to change):
┌──────────┐         ┌───────────────┐
│  Client  │────────>│ LegacyXmlParser│
│          │  direct │ .parseXml()   │
└──────────┘         └───────────────┘
  ↑ Client depends on the concrete interface of LegacyXmlParser
  ↑ Changing the library also requires changing the Client

After (Adapter as intermediary — resilient to change):
┌──────────┐   uses    ┌──────────────┐  delegates  ┌───────────────┐
│  Client  │──────────>│  Adapter     │────────────>│ LegacyXmlParser│
│          │           │ .parse()     │             │ .parseXml()   │
└──────────┘           └──────────────┘             └───────────────┘
       │                      △
       │ depends on           │ implements
       ▼                      │
┌──────────────┐              │
│  DataParser  │──────────────┘
│  (interface) │
│  .parse()    │
└──────────────┘
  ↑ Client depends only on the DataParser interface
  ↑ Even if the library changes, only the Adapter needs to be updated
```

This pattern allows you to:
- Integrate incompatible components **without modifying existing code**
- Keep the client from **depending on concrete classes** (Dependency Inversion Principle: DIP)
- Easily **swap out third-party libraries**
- Easily substitute mocks during testing

---

## 1. Adapter Structure

### Object Adapter (Delegation-based) — Recommended

```
+----------------+
|    Target      |
|  (interface)   |
+----------------+
| + request()    |
+----------------+
        △
        |  implements
+----------------+         delegates        +----------------+
|    Adapter     |─────────────────────────>|    Adaptee     |
+----------------+         has-a            +----------------+
| - adaptee:     |                          | + legacyOp()   |
|   Adaptee      |                          +----------------+
| + request() {  |
|   adaptee      |
|   .legacyOp() }|
+----------------+

Client ──uses──> Target(interface)
                    △
                    |
                 Adapter ──delegates──> Adaptee
```

### Class Adapter (Inheritance-based) — Not Recommended

```
+----------------+         +----------------+
|    Target      |         |    Adaptee     |
|  (interface)   |         +----------------+
+----------------+         | + legacyOp()   |
| + request()    |         +----------------+
+----------------+                △
        △                        |  extends
        |  implements             |
        +────────────+────────────+
                     |
              +----------------+
              |    Adapter     |
              +----------------+
              | + request() {  |
              |   legacyOp()  }|  ← calls own inherited method
              +----------------+

Problem: Requires multiple inheritance (not possible in Java/TS), tight coupling
```

### Sequence Diagram

```
Client          Adapter              Adaptee
  |                |                    |
  |--request()---->|                    |
  |                |--legacyOp()------->|
  |                |                    |
  |                |<--result-----------|
  |                |                    |
  |                |  [data conversion] |
  |                |  convertResult()   |
  |                |                    |
  |<--converted----|                    |
  |    result      |                    |
```

---

## 2. Object Adapter vs Class Adapter

### Detailed Comparison

| Aspect | Object Adapter | Class Adapter |
|------|:---:|:---:|
| Implementation | **Delegation (has-a)** | Inheritance (is-a) |
| Multiple Adaptees | **Yes** (injected via constructor) | No (single inheritance) |
| Overriding Adaptee methods | No (private access) | Yes (can access protected) |
| Language restrictions | **None** | Requires multiple inheritance (not possible in Java/TS) |
| Coupling | **Low** | High |
| Testability | **High** (mock injection possible) | Low |
| Recommendation | **High** | Low |
| SOLID compliance | **DIP, ISP compliant** | Risk of OCP violation |

**Conclusion**: You should use object adapters in almost all cases. Class adapters should only be considered when you need access to protected methods of the Adaptee.

---

## 3. Code Examples

### Code Example 1: External Library Adapter (Basic Form)

```typescript
// === Adaptee: Existing external library (cannot be modified) ===
interface XmlDocument {
  root: string;
  format: string;
}

class LegacyXmlParser {
  parseXml(xmlString: string): XmlDocument {
    // Parse XML and return in a proprietary format
    return { root: xmlString, format: "xml" };
  }

  validateXml(xmlString: string): boolean {
    return xmlString.startsWith("<");
  }
}

// === Target: Interface expected by the client ===
interface DataParser {
  parse(input: string): Record<string, unknown>;
  validate(input: string): boolean;
}

// === Adapter: Converts the interface ===
class XmlParserAdapter implements DataParser {
  private legacyParser: LegacyXmlParser;

  constructor(legacyParser?: LegacyXmlParser) {
    this.legacyParser = legacyParser ?? new LegacyXmlParser();
  }

  parse(input: string): Record<string, unknown> {
    // Call the Adaptee's method and convert the result
    const xmlDoc = this.legacyParser.parseXml(input);
    return this.convertToRecord(xmlDoc);
  }

  validate(input: string): boolean {
    return this.legacyParser.validateXml(input);
  }

  private convertToRecord(doc: XmlDocument): Record<string, unknown> {
    return {
      data: doc.root,
      format: doc.format,
      parsedAt: new Date().toISOString()
    };
  }
}

// === Client: Only knows the DataParser interface ===
function processData(parser: DataParser, input: string): void {
  if (parser.validate(input)) {
    const result = parser.parse(input);
    console.log("Parsed:", result);
  } else {
    console.log("Invalid input");
  }
}

// Usage: Client receives the Adapter as a DataParser
const adapter = new XmlParserAdapter();
processData(adapter, "<user>Taro</user>");
// Parsed: { data: "<user>Taro</user>", format: "xml", parsedAt: "..." }
```

**Key point**: The Client depends only on the `DataParser` interface and has no knowledge of `LegacyXmlParser`. Even if you switch to a JSON parser in the future, the Client code requires no changes.

---

### Code Example 2: Unified Logger Adapter

```typescript
// === Target: Unified logging interface used within the app ===
interface AppLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

// === Adaptee 1: Winston ===
interface WinstonLogger {
  log(level: string, message: string, meta?: object): void;
}

class WinstonAdapter implements AppLogger {
  constructor(private winston: WinstonLogger) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.winston.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.winston.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.winston.log("warn", message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.winston.log("error", message, { ...context, error: error?.stack });
  }
}

// === Adaptee 2: Pino ===
interface PinoLogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(obj: object, msg: string): void;
}

class PinoAdapter implements AppLogger {
  constructor(private pino: PinoLogger) {}

  debug(message: string, _context?: Record<string, unknown>): void {
    this.pino.debug(message);
  }

  info(message: string, _context?: Record<string, unknown>): void {
    this.pino.info(message);
  }

  warn(message: string, _context?: Record<string, unknown>): void {
    this.pino.warn(message);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.pino.error({ err: error, ...context }, message);
  }
}

// === Adaptee 3: Console (for development) ===
class ConsoleAdapter implements AppLogger {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, context ?? "");
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, context ?? "");
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ?? "");
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, error, context ?? "");
  }
}

// === Select the appropriate Adapter via Factory ===
function createLogger(env: string): AppLogger {
  switch (env) {
    case "production":
      // return new WinstonAdapter(createWinston());
    case "staging":
      // return new PinoAdapter(createPino());
    default:
      return new ConsoleAdapter();
  }
}

// Usage: Application code depends only on AppLogger
const logger: AppLogger = createLogger(process.env.NODE_ENV ?? "development");
logger.info("Application started", { port: 3000 });
logger.error("Database connection failed", new Error("ECONNREFUSED"), { host: "localhost" });
```

---

### Code Example 3: Python — Payment Gateway Adapter

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum


class PaymentStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"


@dataclass
class PaymentResult:
    """Unified payment result"""
    status: PaymentStatus
    transaction_id: str
    amount: float
    currency: str


class PaymentGateway(ABC):
    """Target: Unified payment interface"""
    @abstractmethod
    def charge(self, amount: float, currency: str, token: str) -> PaymentResult: ...

    @abstractmethod
    def refund(self, transaction_id: str, amount: float) -> PaymentResult: ...


# === Adaptee 1: Stripe SDK (cannot be modified) ===
class StripeSDK:
    def create_charge(self, amount_cents: int, cur: str, source: str) -> dict:
        return {"id": "ch_123", "status": "succeeded", "amount": amount_cents}

    def create_refund(self, charge_id: str, amount_cents: int) -> dict:
        return {"id": "re_456", "status": "succeeded", "amount": amount_cents}


class StripeAdapter(PaymentGateway):
    """Converts Stripe SDK to the unified interface"""

    def __init__(self, sdk: StripeSDK):
        self._sdk = sdk

    def charge(self, amount: float, currency: str, token: str) -> PaymentResult:
        cents = int(amount * 100)  # Convert dollars to cents
        result = self._sdk.create_charge(cents, currency, token)
        return PaymentResult(
            status=self._convert_status(result["status"]),
            transaction_id=result["id"],
            amount=amount,
            currency=currency,
        )

    def refund(self, transaction_id: str, amount: float) -> PaymentResult:
        cents = int(amount * 100)
        result = self._sdk.create_refund(transaction_id, cents)
        return PaymentResult(
            status=self._convert_status(result["status"]),
            transaction_id=result["id"],
            amount=amount,
            currency="",
        )

    @staticmethod
    def _convert_status(stripe_status: str) -> PaymentStatus:
        mapping = {
            "succeeded": PaymentStatus.SUCCESS,
            "failed": PaymentStatus.FAILED,
            "pending": PaymentStatus.PENDING,
        }
        return mapping.get(stripe_status, PaymentStatus.FAILED)


# === Adaptee 2: PayPal SDK (cannot be modified) ===
class PayPalSDK:
    def execute_payment(self, payment_data: dict) -> dict:
        return {"payment_id": "PAY-789", "state": "approved"}

    def execute_refund(self, sale_id: str, refund_data: dict) -> dict:
        return {"refund_id": "REF-012", "state": "completed"}


class PayPalAdapter(PaymentGateway):
    """Converts PayPal SDK to the unified interface"""

    def __init__(self, sdk: PayPalSDK):
        self._sdk = sdk

    def charge(self, amount: float, currency: str, token: str) -> PaymentResult:
        result = self._sdk.execute_payment({
            "intent": "sale",
            "payer": {"payment_method": token},
            "transactions": [{"amount": {"total": str(amount), "currency": currency}}],
        })
        return PaymentResult(
            status=self._convert_status(result["state"]),
            transaction_id=result["payment_id"],
            amount=amount,
            currency=currency,
        )

    def refund(self, transaction_id: str, amount: float) -> PaymentResult:
        result = self._sdk.execute_refund(transaction_id, {
            "amount": {"total": str(amount)},
        })
        return PaymentResult(
            status=self._convert_status(result["state"]),
            transaction_id=result["refund_id"],
            amount=amount,
            currency="",
        )

    @staticmethod
    def _convert_status(paypal_state: str) -> PaymentStatus:
        mapping = {
            "approved": PaymentStatus.SUCCESS,
            "completed": PaymentStatus.SUCCESS,
            "failed": PaymentStatus.FAILED,
            "pending": PaymentStatus.PENDING,
        }
        return mapping.get(paypal_state, PaymentStatus.FAILED)


# === Usage example ===
def process_order(gateway: PaymentGateway, amount: float) -> None:
    """Business logic depends only on the PaymentGateway interface"""
    result = gateway.charge(amount, "USD", "tok_test")
    if result.status == PaymentStatus.SUCCESS:
        print(f"Payment successful: {result.transaction_id}")
    else:
        print(f"Payment failed: {result.status}")


# Using Stripe
stripe_gateway = StripeAdapter(StripeSDK())
process_order(stripe_gateway, 29.99)

# Switching to PayPal — no changes needed in business logic
paypal_gateway = PayPalAdapter(PayPalSDK())
process_order(paypal_gateway, 29.99)
```

---

### Code Example 4: Bridging DOM Events and a Custom Event System

```typescript
// === Target: Unified event system used within the app ===
interface AppEventEmitter {
  on<T = unknown>(event: string, handler: (data: T) => void): () => void; // returns unsubscribe function
  emit<T = unknown>(event: string, data: T): void;
  off(event: string, handler: Function): void;
}

// === Adapter 1: DOM events → AppEventEmitter ===
class DOMEventAdapter implements AppEventEmitter {
  private handlers = new Map<Function, EventListener>();

  constructor(private element: HTMLElement) {}

  on<T = unknown>(event: string, handler: (data: T) => void): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent).detail as T);
    };
    this.handlers.set(handler, listener);
    this.element.addEventListener(event, listener);

    // Return cleanup function
    return () => this.off(event, handler);
  }

  emit<T = unknown>(event: string, data: T): void {
    this.element.dispatchEvent(
      new CustomEvent(event, { detail: data, bubbles: true })
    );
  }

  off(event: string, handler: Function): void {
    const listener = this.handlers.get(handler);
    if (listener) {
      this.element.removeEventListener(event, listener);
      this.handlers.delete(handler);
    }
  }
}

// === Adapter 2: Node.js EventEmitter → AppEventEmitter ===
// import { EventEmitter } from "events";

class NodeEventAdapter implements AppEventEmitter {
  constructor(private emitter: any /* EventEmitter */) {}

  on<T = unknown>(event: string, handler: (data: T) => void): () => void {
    this.emitter.on(event, handler);
    return () => this.off(event, handler);
  }

  emit<T = unknown>(event: string, data: T): void {
    this.emitter.emit(event, data);
  }

  off(event: string, handler: Function): void {
    this.emitter.removeListener(event, handler);
  }
}

// === Adapter 3: WebSocket → AppEventEmitter ===
class WebSocketEventAdapter implements AppEventEmitter {
  private handlers = new Map<string, Set<Function>>();

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        const set = this.handlers.get(type);
        if (set) {
          set.forEach(handler => handler(data));
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    });
  }

  on<T = unknown>(event: string, handler: (data: T) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  emit<T = unknown>(event: string, data: T): void {
    this.ws.send(JSON.stringify({ type: event, data }));
  }

  off(event: string, handler: Function): void {
    this.handlers.get(event)?.delete(handler);
  }
}

// Usage: Client code depends only on AppEventEmitter
function setupNotifications(emitter: AppEventEmitter): void {
  const unsubscribe = emitter.on<{ message: string }>("notification", (data) => {
    console.log("Notification:", data.message);
  });

  // Clean up later
  // unsubscribe();
}
```

---

### Code Example 5: Function Adapter (Higher-Order Functions)

```typescript
// === Adapter: callback style → Promise style ===
type NodeCallback<T> = (err: Error | null, result: T) => void;
type CallbackFn<T> = (callback: NodeCallback<T>) => void;

function promisify<T>(fn: CallbackFn<T>): () => Promise<T>;
function promisify<T, A>(fn: (arg: A, cb: NodeCallback<T>) => void): (arg: A) => Promise<T>;
function promisify(fn: Function): (...args: any[]) => Promise<any> {
  return (...args: any[]) =>
    new Promise((resolve, reject) => {
      fn(...args, (err: Error | null, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
}

// === Adapter: iterator → array ===
function iteratorToArray<T>(iterator: Iterator<T>): T[] {
  const result: T[] = [];
  let next = iterator.next();
  while (!next.done) {
    result.push(next.value);
    next = iterator.next();
  }
  return result;
}

// === Adapter: Observable → Promise ===
function observableToPromise<T>(observable: { subscribe: Function }): Promise<T> {
  return new Promise((resolve, reject) => {
    let lastValue: T;
    observable.subscribe({
      next: (value: T) => { lastValue = value; },
      error: reject,
      complete: () => resolve(lastValue),
    });
  });
}

// === Adapter: reverses argument order ===
function flip<A, B, R>(fn: (a: A, b: B) => R): (b: B, a: A) => R {
  return (b, a) => fn(a, b);
}

// === Adapter: multiple arguments → single object argument ===
type ParamsOf<F> = F extends (...args: infer P) => any ? P : never;

function objectify<F extends (...args: any[]) => any>(
  fn: F,
  paramNames: string[]
): (params: Record<string, any>) => ReturnType<F> {
  return (params) => {
    const args = paramNames.map(name => params[name]);
    return fn(...args);
  };
}

// Usage example
function createUser(name: string, age: number, email: string): { name: string; age: number; email: string } {
  return { name, age, email };
}

const createUserFromObject = objectify(createUser, ["name", "age", "email"]);
const user = createUserFromObject({ name: "Taro", age: 25, email: "taro@example.com" });
```

**Benefits of function adapters**:
- No need to define a class (lightweight)
- Works well with functional programming
- Simple conversions can be done in a single line

---

### Code Example 6: Java — ORM and DTO Adapter

```java
// === Target: Application layer DTO ===
public record UserDTO(
    String id,
    String fullName,
    String email,
    LocalDateTime createdAt
) {}

// === Adaptee 1: JPA Entity (database layer) ===
@Entity
public class UserEntity {
    @Id private Long id;
    private String firstName;
    private String lastName;
    private String emailAddress;
    private Timestamp createdTimestamp;

    // getters/setters...
    public Long getId() { return id; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmailAddress() { return emailAddress; }
    public Timestamp getCreatedTimestamp() { return createdTimestamp; }
}

// === Adaptee 2: External API response ===
public class ExternalUserResponse {
    private String user_id;
    private String display_name;
    private String contact_email;
    private String registered_at; // ISO 8601 string

    // getters...
    public String getUserId() { return user_id; }
    public String getDisplayName() { return display_name; }
    public String getContactEmail() { return contact_email; }
    public String getRegisteredAt() { return registered_at; }
}

// === Adapter interface ===
public interface UserAdapter<T> {
    UserDTO toDTO(T source);
    T fromDTO(UserDTO dto);
}

// === Adapter 1: JPA Entity → DTO ===
public class JpaUserAdapter implements UserAdapter<UserEntity> {
    @Override
    public UserDTO toDTO(UserEntity entity) {
        return new UserDTO(
            String.valueOf(entity.getId()),
            entity.getFirstName() + " " + entity.getLastName(),
            entity.getEmailAddress(),
            entity.getCreatedTimestamp().toLocalDateTime()
        );
    }

    @Override
    public UserEntity fromDTO(UserDTO dto) {
        UserEntity entity = new UserEntity();
        String[] names = dto.fullName().split(" ", 2);
        entity.setFirstName(names[0]);
        entity.setLastName(names.length > 1 ? names[1] : "");
        entity.setEmailAddress(dto.email());
        return entity;
    }
}

// === Adapter 2: External API response → DTO ===
public class ExternalUserAdapter implements UserAdapter<ExternalUserResponse> {
    @Override
    public UserDTO toDTO(ExternalUserResponse response) {
        return new UserDTO(
            response.getUserId(),
            response.getDisplayName(),
            response.getContactEmail(),
            LocalDateTime.parse(response.getRegisteredAt(), DateTimeFormatter.ISO_DATE_TIME)
        );
    }

    @Override
    public ExternalUserResponse fromDTO(UserDTO dto) {
        // Implement reverse conversion as needed
        throw new UnsupportedOperationException("One-way adapter");
    }
}
```

---

### Code Example 7: Go — Interface-based Adapter

```go
package main

import (
    "fmt"
    "strings"
)

// === Target: Interface used by the application ===
type MessageSender interface {
    Send(to string, subject string, body string) error
}

// === Adaptee 1: SMTP library (legacy) ===
type LegacySMTP struct{}

func (s *LegacySMTP) SendMail(recipient string, headers map[string]string, content string) error {
    fmt.Printf("SMTP: To=%s, Subject=%s\n", recipient, headers["Subject"])
    return nil
}

// === Adapter 1: LegacySMTP → MessageSender ===
type SMTPAdapter struct {
    smtp *LegacySMTP
}

func NewSMTPAdapter(smtp *LegacySMTP) *SMTPAdapter {
    return &SMTPAdapter{smtp: smtp}
}

func (a *SMTPAdapter) Send(to string, subject string, body string) error {
    headers := map[string]string{
        "Subject":      subject,
        "Content-Type": "text/plain",
    }
    return a.smtp.SendMail(to, headers, body)
}

// === Adaptee 2: Slack Webhook ===
type SlackWebhook struct {
    WebhookURL string
}

func (s *SlackWebhook) PostMessage(channel string, text string) error {
    fmt.Printf("Slack: Channel=%s, Text=%s\n", channel, text)
    return nil
}

// === Adapter 2: SlackWebhook → MessageSender ===
type SlackAdapter struct {
    slack *SlackWebhook
}

func NewSlackAdapter(slack *SlackWebhook) *SlackAdapter {
    return &SlackAdapter{slack: slack}
}

func (a *SlackAdapter) Send(to string, subject string, body string) error {
    text := fmt.Sprintf("*%s*\n%s", subject, body)
    return a.slack.PostMessage(to, text)
}

// === Usage example ===
func notifyUser(sender MessageSender, to string) error {
    return sender.Send(to, "Welcome", "Hello, welcome to our service!")
}

func main() {
    // Send via SMTP
    smtpSender := NewSMTPAdapter(&LegacySMTP{})
    notifyUser(smtpSender, "user@example.com")

    // Send via Slack (no code changes needed)
    slackSender := NewSlackAdapter(&SlackWebhook{WebhookURL: "https://hooks.slack.com/xxx"})
    notifyUser(slackSender, "#general")
}
```

---

### Code Example 8: Kotlin — Lightweight Adapter Using Extension Functions

```kotlin
// === Adaptee: Third-party weather API ===
data class WeatherApiResponse(
    val temp_c: Double,
    val humidity_pct: Int,
    val wind_kph: Double,
    val condition_code: Int
)

// === Target: Application domain model ===
data class WeatherInfo(
    val temperatureCelsius: Double,
    val temperatureFahrenheit: Double,
    val humidityPercent: Int,
    val windSpeedKmh: Double,
    val condition: String
)

// === Adapter: Conversion via extension function ===
fun WeatherApiResponse.toWeatherInfo(): WeatherInfo {
    return WeatherInfo(
        temperatureCelsius = this.temp_c,
        temperatureFahrenheit = this.temp_c * 9.0 / 5.0 + 32.0,
        humidityPercent = this.humidity_pct,
        windSpeedKmh = this.wind_kph,
        condition = mapCondition(this.condition_code)
    )
}

private fun mapCondition(code: Int): String = when (code) {
    1 -> "Clear"
    2 -> "Partly Cloudy"
    3 -> "Cloudy"
    4 -> "Rain"
    5 -> "Snow"
    else -> "Unknown"
}

// === Usage example ===
fun displayWeather(info: WeatherInfo) {
    println("${info.temperatureCelsius}°C (${info.temperatureFahrenheit}°F)")
    println("Humidity: ${info.humidityPercent}%")
    println("Condition: ${info.condition}")
}

fun main() {
    // Fetch API response
    val apiResponse = WeatherApiResponse(
        temp_c = 22.5,
        humidity_pct = 65,
        wind_kph = 15.0,
        condition_code = 2
    )

    // Convert using extension function (Adapter)
    val weatherInfo = apiResponse.toWeatherInfo()
    displayWeather(weatherInfo)
}
```

---

### Code Example 9: Combining Adapter + Strategy Patterns

```typescript
// Multiple notification channels are unified via Adapter,
// and the Strategy pattern is used to switch channels dynamically

// === Target ===
interface NotificationChannel {
  send(userId: string, message: string): Promise<boolean>;
  getName(): string;
}

// === Adapter 1: Email ===
class EmailAdapter implements NotificationChannel {
  constructor(private smtpClient: any) {}

  async send(userId: string, message: string): Promise<boolean> {
    const email = await this.resolveEmail(userId);
    await this.smtpClient.sendMail({
      to: email,
      subject: "Notification",
      text: message,
    });
    return true;
  }

  getName(): string { return "email"; }

  private async resolveEmail(userId: string): Promise<string> {
    return `${userId}@example.com`; // In practice, look up from DB
  }
}

// === Adapter 2: SMS ===
class SMSAdapter implements NotificationChannel {
  constructor(private twilioClient: any) {}

  async send(userId: string, message: string): Promise<boolean> {
    const phone = await this.resolvePhone(userId);
    await this.twilioClient.messages.create({
      to: phone,
      body: message,
    });
    return true;
  }

  getName(): string { return "sms"; }

  private async resolvePhone(userId: string): Promise<string> {
    return "+8190XXXXXXXX"; // In practice, look up from DB
  }
}

// === Adapter 3: Push Notification ===
class PushNotificationAdapter implements NotificationChannel {
  constructor(private fcmClient: any) {}

  async send(userId: string, message: string): Promise<boolean> {
    const token = await this.resolveToken(userId);
    await this.fcmClient.send({
      token,
      notification: { title: "Notification", body: message },
    });
    return true;
  }

  getName(): string { return "push"; }

  private async resolveToken(userId: string): Promise<string> {
    return "fcm-token-xxx"; // In practice, look up from DB
  }
}

// === Strategy: Dynamically select notification channel ===
class NotificationService {
  private channels = new Map<string, NotificationChannel>();

  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.getName(), channel);
  }

  async notify(
    userId: string,
    message: string,
    channelName: string
  ): Promise<boolean> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new Error(`Unknown channel: ${channelName}`);
    }
    return channel.send(userId, message);
  }

  async notifyAll(userId: string, message: string): Promise<boolean[]> {
    const promises = [...this.channels.values()].map(ch =>
      ch.send(userId, message)
    );
    return Promise.all(promises);
  }
}

// Usage example
const service = new NotificationService();
service.registerChannel(new EmailAdapter(smtpClient));
service.registerChannel(new SMSAdapter(twilioClient));
service.registerChannel(new PushNotificationAdapter(fcmClient));

// Select channel based on user preferences
await service.notify("user-123", "Your order has shipped!", "email");
await service.notifyAll("user-456", "System maintenance in 1 hour");
```

---

### Code Example 10: Two-Way Adapter (Bidirectional Adapter)

```typescript
// A bidirectional adapter that converts data between two different systems

// === System A: REST API format ===
interface RestApiUser {
  id: string;
  first_name: string;
  last_name: string;
  email_address: string;
  created_at: string; // ISO 8601
}

// === System B: GraphQL format ===
interface GraphQLUser {
  userId: string;
  fullName: string;
  contactInfo: {
    email: string;
  };
  metadata: {
    registrationDate: number; // Unix timestamp
  };
}

// === Two-Way Adapter ===
class UserFormatAdapter {
  // REST → GraphQL
  restToGraphQL(rest: RestApiUser): GraphQLUser {
    return {
      userId: rest.id,
      fullName: `${rest.first_name} ${rest.last_name}`,
      contactInfo: {
        email: rest.email_address,
      },
      metadata: {
        registrationDate: new Date(rest.created_at).getTime(),
      },
    };
  }

  // GraphQL → REST
  graphQLToRest(gql: GraphQLUser): RestApiUser {
    const [firstName, ...lastNameParts] = gql.fullName.split(" ");
    return {
      id: gql.userId,
      first_name: firstName,
      last_name: lastNameParts.join(" "),
      email_address: gql.contactInfo.email,
      created_at: new Date(gql.metadata.registrationDate).toISOString(),
    };
  }

  // Batch conversion
  restListToGraphQL(users: RestApiUser[]): GraphQLUser[] {
    return users.map(u => this.restToGraphQL(u));
  }

  graphQLListToRest(users: GraphQLUser[]): RestApiUser[] {
    return users.map(u => this.graphQLToRest(u));
  }
}

// Usage example: Data synchronization between microservices
const adapter = new UserFormatAdapter();

const restUser: RestApiUser = {
  id: "usr-001",
  first_name: "Taro",
  last_name: "Yamada",
  email_address: "taro@example.com",
  created_at: "2024-01-15T09:00:00Z",
};

const graphqlUser = adapter.restToGraphQL(restUser);
console.log(graphqlUser.fullName);           // "Taro Yamada"
console.log(graphqlUser.contactInfo.email);  // "taro@example.com"

const backToRest = adapter.graphQLToRest(graphqlUser);
console.log(backToRest.first_name);  // "Taro"
console.log(backToRest.last_name);   // "Yamada"
```

---

## 4. Comparison Tables

### Comparison Table 1: Adapter vs Facade vs Decorator vs Proxy

| Aspect | Adapter | Facade | Decorator | Proxy |
|------|---------|--------|-----------|-------|
| **Purpose** | Interface **conversion** | **Hiding** complexity | **Adding** functionality | **Controlling** access |
| **Target** | One class/API | Multiple classes | One object | One object |
| **Interface** | **Converts** it | **Simplifies** it | **Stays the same** | **Stays the same** |
| **Existing code** | Cannot be changed | No need to change | No need to change | No need to change |
| **Use case** | Library integration | Exposing subsystems | Adding logging/caching | Lazy loading/authorization/caching |
| **GoF category** | Structural | Structural | Structural | Structural |

```
Visual differences:

Adapter:   Client ──> [A→B conversion] ──> Adaptee
Facade:    Client ──> [simplified interface] ──> SubSystem1 + SubSystem2 + SubSystem3
Decorator: Client ──> [added behavior] ──> [added behavior] ──> Original
Proxy:     Client ──> [access control] ──> RealSubject
```

### Comparison Table 2: Object Adapter vs Class Adapter (Detailed)

| Aspect | Object Adapter | Class Adapter |
|------|:---:|:---:|
| Implementation | **Delegation (has-a)** | Inheritance (is-a) |
| Multiple Adaptees | **Yes** | No |
| Overriding Adaptee methods | No | Yes |
| Language restrictions | **None** | Requires multiple inheritance |
| Coupling | **Low** | High |
| Testability | **High** | Low |
| DI support | **Yes** | No |
| Recommendation | **High** | Low |
| SOLID compliance | **DIP/ISP compliant** | Risk of LSP/OCP violation |

### Comparison Table 3: Adapter Implementation Approach Comparison

| Approach | Use case | Complexity | Type safety | Reusability |
|-----------|---------|:---:|:---:|:---:|
| Class adapter | Large-scale conversion, stateful | Medium | **High** | **High** |
| Function adapter | Simple conversion, stateless | **Low** | Medium | Medium |
| Extension function (Kotlin) | Data conversion, DTO mapping | **Low** | **High** | Medium |
| Generic adapter | Abstracting common patterns | High | **High** | **Highest** |

---

## 5. Anti-patterns

### Anti-pattern 1: Overly Thin Adapter (Unnecessary Indirection Layer)

```typescript
// Bad: Only renaming a method — the interface is essentially the same
interface Logger {
  log(message: string): void;
}

class ConsoleLogger {
  log(message: string): void {
    console.log(message);
  }
}

// ← This adapter is unnecessary! ConsoleLogger can directly implement Logger
class UselessAdapter implements Logger {
  constructor(private logger: ConsoleLogger) {}
  log(message: string): void {
    this.logger.log(message);  // Signature is completely identical
  }
}
```

```typescript
// Good: Implement the interface directly on ConsoleLogger
class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(message);
  }
}

// Or, since TypeScript uses structural subtyping,
// ConsoleLogger can be used directly if it is compatible with Logger
```

**Decision criterion**: If the interfaces are already the same, an Adapter is unnecessary. An Adapter should only be used "when conversion is needed."

---

### Anti-pattern 2: Adding Business Logic to the Adapter

```typescript
// Bad: Adapter takes on more responsibility than just conversion
class OrderAdapter implements NewOrderService {
  constructor(private legacyService: LegacyOrderService) {}

  createOrder(data: NewOrderData): Order {
    const legacyData = this.convertData(data);
    const order = this.legacyService.createLegacyOrder(legacyData);

    // Business logic — not the Adapter's responsibility!
    order.applyTax(this.calculateTax(order));
    order.validateInventory();
    this.sendNotification(order);
    this.updateAnalytics(order);

    return this.convertOrder(order);
  }
}
```

```typescript
// Good: Adapter handles conversion only. Business logic belongs in the service layer
class OrderAdapter implements NewOrderService {
  constructor(private legacyService: LegacyOrderService) {}

  createOrder(data: NewOrderData): LegacyOrder {
    // Conversion only
    const legacyData = this.convertToLegacyFormat(data);
    const result = this.legacyService.createLegacyOrder(legacyData);
    return this.convertToNewFormat(result);
  }
}

// Business logic belongs in the service layer
class OrderService {
  constructor(
    private orderAdapter: NewOrderService,
    private taxService: TaxService,
    private notificationService: NotificationService
  ) {}

  async processOrder(data: NewOrderData): Promise<Order> {
    const order = this.orderAdapter.createOrder(data);
    order.tax = this.taxService.calculate(order);
    await this.notificationService.send(order);
    return order;
  }
}
```

---

### Anti-pattern 3: God Adapter (All-in-one Adapter)

```typescript
// Bad: A single adapter handles multiple different systems
class UniversalPaymentAdapter {
  constructor(
    private stripe: StripeSDK,
    private paypal: PayPalSDK,
    private square: SquareSDK
  ) {}

  charge(provider: string, amount: number): void {
    switch (provider) {
      case "stripe":
        this.stripe.createCharge(amount * 100, "usd");
        break;
      case "paypal":
        this.paypal.executePayment({ amount });
        break;
      case "square":
        this.square.createPayment({ amount_money: { amount, currency: "USD" } });
        break;
    }
  }
  // OCP violation: the switch must be modified every time a new provider is added
}
```

```typescript
// Good: Create individual Adapters per provider
interface PaymentGateway {
  charge(amount: number, currency: string): Promise<PaymentResult>;
}

class StripeAdapter implements PaymentGateway { /* ... */ }
class PayPalAdapter implements PaymentGateway { /* ... */ }
class SquareAdapter implements PaymentGateway { /* ... */ }

// Select via Factory
class PaymentGatewayFactory {
  private adapters = new Map<string, PaymentGateway>();

  register(name: string, adapter: PaymentGateway): void {
    this.adapters.set(name, adapter);
  }

  get(name: string): PaymentGateway {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new Error(`Unknown provider: ${name}`);
    return adapter;
  }
}
```

---

## 6. Edge Cases and Considerations

### Edge Case 1: Data Loss in Bidirectional Conversion

```typescript
// Information may be lost when converting REST → GraphQL
interface DetailedRestUser {
  id: string;
  first_name: string;
  middle_name: string;      // This field does not exist on the GraphQL side
  last_name: string;
  email: string;
  internal_notes: string;   // No corresponding field in the conversion target
}

// Mitigation 1: Output a warning log during conversion
// Mitigation 2: Prepare an extension field (extras: Map)
// Mitigation 3: Verify roundtrip in tests for bidirectional conversion
```

### Edge Case 2: Error Handling in Async Adapters

```typescript
class AsyncAdapter implements DataParser {
  constructor(private asyncParser: AsyncLegacyParser) {}

  async parse(input: string): Promise<Record<string, unknown>> {
    try {
      const result = await this.asyncParser.parseAsync(input);
      return this.convert(result);
    } catch (error) {
      // Convert Adaptee-specific errors to a unified error type
      if (error instanceof LegacyParseError) {
        throw new ParseError(error.message, error.line, error.column);
      }
      throw new ParseError(`Unknown error: ${error}`);
    }
  }
}
```

### Edge Case 3: Adapter Lifecycle Management

```typescript
// When the Adaptee holds resources, cleanup is required
class DatabaseAdapter implements DataStore {
  constructor(private connection: LegacyDBConnection) {}

  async get(key: string): Promise<string> { /* ... */ }
  async set(key: string, value: string): Promise<void> { /* ... */ }

  // The Adapter must also implement the Dispose pattern
  async close(): Promise<void> {
    await this.connection.disconnect();
  }
}

// Automatic cleanup using the using statement (TC39 Stage 3)
// await using adapter = new DatabaseAdapter(connection);
```

---

## 7. Trade-off Analysis

### When to Use the Adapter Pattern

```
[When to use] ✅
┌─────────────────────────────────────────────────────────┐
│ 1. Integrating external libraries                        │
│    Connecting to third-party code you cannot change      │
│                                                          │
│ 2. Gradual migration of legacy systems                   │
│    Bridging old and new APIs (use with Strangler Fig)    │
│                                                          │
│ 3. Easing testing                                        │
│    Convert external dependencies to a unified interface  │
│    to enable mocking                                     │
│                                                          │
│ 4. Unifying multiple providers                           │
│    Supporting multiple vendors for payments, notifications│
│    storage, etc.                                         │
│                                                          │
│ 5. Data format conversion                                │
│    Mapping between REST/GraphQL/gRPC, DTO/Entity, etc.  │
└─────────────────────────────────────────────────────────┘

[When not to use] ❌
┌─────────────────────────────────────────────────────────┐
│ 1. Interfaces already match                              │
│    → Unnecessary indirection reduces code readability    │
│                                                          │
│ 2. When you can modify the Adaptee directly              │
│    → Directly modifying the interface is simpler         │
│                                                          │
│ 3. When large amounts of business logic are needed       │
│    beyond just conversion                                │
│    → Create a dedicated service layer instead            │
│                                                          │
│ 4. When performance is the top priority                  │
│    → The overhead of the indirection layer can be an     │
│       issue                                              │
└─────────────────────────────────────────────────────────┘
```

### Cost Analysis

| Item | With Adapter | Without Adapter |
|------|:---:|:---:|
| Initial implementation cost | Medium (create Adapter class) | **Low** |
| Cost when changing libraries | **Low** (modify Adapter only) | High (modify all call sites) |
| Testability | **High** | Low |
| Code complexity | Slightly increased | **Simple** |
| Long-term maintenance cost | **Low** | High |

---

## 8. Exercises

### Exercise 1 (Basic): File System Adapter

Implement an Adapter for the following interface and existing class.

**Requirements**:
- `Storage` interface: `read(key)`, `write(key, value)`, `delete(key)`, `exists(key)`
- `LegacyFileSystem` class: `loadFile(path)`, `saveFile(path, content)`, `removeFile(path)`, `fileExists(path)`
- Create an Adapter that bridges the differences in method names and parameter names

```typescript
// Test
const adapter: Storage = new FileSystemAdapter(new LegacyFileSystem("/data"));
await adapter.write("config", '{"debug": true}');
console.log(await adapter.exists("config"));   // true
console.log(await adapter.read("config"));     // '{"debug": true}'
await adapter.delete("config");
console.log(await adapter.exists("config"));   // false
```

**Expected output**:
```
true
{"debug": true}
false
```

<details>
<summary>Sample answer</summary>

```typescript
interface Storage {
  read(key: string): Promise<string>;
  write(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LegacyFileSystem {
  private files = new Map<string, string>();

  constructor(private basePath: string) {}

  loadFile(path: string): string {
    const content = this.files.get(path);
    if (!content) throw new Error(`File not found: ${path}`);
    return content;
  }

  saveFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  removeFile(path: string): void {
    this.files.delete(path);
  }

  fileExists(path: string): boolean {
    return this.files.has(path);
  }
}

class FileSystemAdapter implements Storage {
  constructor(private fs: LegacyFileSystem) {}

  private toPath(key: string): string {
    return key; // Apply path conversion as needed
  }

  async read(key: string): Promise<string> {
    return this.fs.loadFile(this.toPath(key));
  }

  async write(key: string, value: string): Promise<void> {
    this.fs.saveFile(this.toPath(key), value);
  }

  async delete(key: string): Promise<void> {
    this.fs.removeFile(this.toPath(key));
  }

  async exists(key: string): Promise<boolean> {
    return this.fs.fileExists(this.toPath(key));
  }
}

// Test
const adapter: Storage = new FileSystemAdapter(new LegacyFileSystem("/data"));
await adapter.write("config", '{"debug": true}');
console.log(await adapter.exists("config"));   // true
console.log(await adapter.read("config"));     // '{"debug": true}'
await adapter.delete("config");
console.log(await adapter.exists("config"));   // false
```
</details>

---

### Exercise 2 (Applied): Multi-provider Adapter + Factory

Implement Adapters and a Factory that support multiple cloud storage providers.

**Requirements**:
- `CloudStorage` interface: `upload(key, data)`, `download(key)`, `delete(key)`, `list(prefix)`
- Three Adapters for AWS S3, Google Cloud Storage, and Azure Blob Storage
- `CloudStorageFactory` selects an Adapter based on provider name

```typescript
// Test
const factory = new CloudStorageFactory();
factory.register("s3", new S3Adapter(s3Client));
factory.register("gcs", new GCSAdapter(gcsClient));

const storage = factory.get("s3");
await storage.upload("reports/2024.pdf", pdfData);
const files = await storage.list("reports/");
console.log(files); // ["reports/2024.pdf"]
```

<details>
<summary>Sample answer</summary>

```typescript
interface CloudStorage {
  upload(key: string, data: Buffer): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// === S3 Adapter ===
class S3Adapter implements CloudStorage {
  private storage = new Map<string, Buffer>();

  constructor(private client: any /* S3Client */) {}

  async upload(key: string, data: Buffer): Promise<string> {
    this.storage.set(key, data);
    return `s3://bucket/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) throw new Error(`Not found: ${key}`);
    return data;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.storage.keys()].filter(k => k.startsWith(prefix));
  }
}

// === GCS Adapter ===
class GCSAdapter implements CloudStorage {
  private storage = new Map<string, Buffer>();

  constructor(private client: any /* GCSClient */) {}

  async upload(key: string, data: Buffer): Promise<string> {
    this.storage.set(key, data);
    return `gs://bucket/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) throw new Error(`Not found: ${key}`);
    return data;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.storage.keys()].filter(k => k.startsWith(prefix));
  }
}

// === Factory ===
class CloudStorageFactory {
  private adapters = new Map<string, CloudStorage>();

  register(name: string, adapter: CloudStorage): void {
    this.adapters.set(name, adapter);
  }

  get(name: string): CloudStorage {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new Error(`Unknown provider: ${name}`);
    return adapter;
  }

  listProviders(): string[] {
    return [...this.adapters.keys()];
  }
}
```
</details>

---

### Exercise 3 (Advanced): Type-safe Generic Adapter Framework

Implement a generic Adapter framework that allows you to define type-safe mappings between any two interfaces.

**Requirements**:
- Declaratively define field mappings
- Allow specifying a conversion function per field
- Support bidirectional conversion
- TypeScript type inference guarantees the type of conversion results

```typescript
// Test
const userMapper = createMapper<RestUser, DomainUser>({
  id: (src) => src.user_id,
  name: (src) => `${src.first_name} ${src.last_name}`,
  email: (src) => src.email_address,
  createdAt: (src) => new Date(src.created_at),
});

const restUser = {
  user_id: "123",
  first_name: "Taro",
  last_name: "Yamada",
  email_address: "taro@example.com",
  created_at: "2024-01-15T09:00:00Z",
};

const domainUser = userMapper.map(restUser);
console.log(domainUser.name);      // "Taro Yamada"
console.log(domainUser.email);     // "taro@example.com"
console.log(domainUser.createdAt instanceof Date); // true
```

**Expected output**:
```
Taro Yamada
taro@example.com
true
```

<details>
<summary>Sample answer</summary>

```typescript
// Type for mapping definition
type MappingConfig<Source, Target> = {
  [K in keyof Target]: (source: Source) => Target[K];
};

// Type for reverse mapping
type ReverseMappingConfig<Source, Target> = {
  [K in keyof Source]: (target: Target) => Source[K];
};

// Mapper interface
interface Mapper<Source, Target> {
  map(source: Source): Target;
  mapMany(sources: Source[]): Target[];
}

// Bidirectional Mapper
interface BiMapper<A, B> {
  mapAtoB(a: A): B;
  mapBtoA(b: B): A;
  mapManyAtoB(as: A[]): B[];
  mapManyBtoA(bs: B[]): A[];
}

// Mapper factory function
function createMapper<Source, Target>(
  config: MappingConfig<Source, Target>
): Mapper<Source, Target> {
  return {
    map(source: Source): Target {
      const result = {} as Target;
      for (const key of Object.keys(config) as Array<keyof Target>) {
        result[key] = configkey;
      }
      return result;
    },
    mapMany(sources: Source[]): Target[] {
      return sources.map(s => this.map(s));
    },
  };
}

// Bidirectional Mapper factory function
function createBiMapper<A, B>(
  aToB: MappingConfig<A, B>,
  bToA: MappingConfig<B, A>
): BiMapper<A, B> {
  const forwardMapper = createMapper(aToB);
  const reverseMapper = createMapper(bToA);

  return {
    mapAtoB: (a) => forwardMapper.map(a),
    mapBtoA: (b) => reverseMapper.map(b),
    mapManyAtoB: (as) => forwardMapper.mapMany(as),
    mapManyBtoA: (bs) => reverseMapper.mapMany(bs),
  };
}

// === Usage example ===

interface RestUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email_address: string;
  created_at: string;
}

interface DomainUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const userMapper = createMapper<RestUser, DomainUser>({
  id: (src) => src.user_id,
  name: (src) => `${src.first_name} ${src.last_name}`,
  email: (src) => src.email_address,
  createdAt: (src) => new Date(src.created_at),
});

const restUser: RestUser = {
  user_id: "123",
  first_name: "Taro",
  last_name: "Yamada",
  email_address: "taro@example.com",
  created_at: "2024-01-15T09:00:00Z",
};

const domainUser = userMapper.map(restUser);
console.log(domainUser.name);      // "Taro Yamada"
console.log(domainUser.email);     // "taro@example.com"
console.log(domainUser.createdAt instanceof Date); // true
```
</details>

---

## 9. FAQ

### Q1: Is the Adapter pattern used outside of legacy code?

Yes. The Adapter is frequently used in the following situations:
- **External APIs**: Unifying clients for REST/GraphQL/gRPC APIs
- **Third-party libraries**: Unifying vendors for logging, payments, notifications, storage, etc.
- **Module integration across different teams**: Resolving interface mismatches in internal APIs
- **Testing**: Converting external dependencies to mockable interfaces
- **Data transformation**: Mapping between DTO/Entity/ViewModel

### Q2: When writing an adapter in TypeScript, which is better — a class or a function?

| Condition | Recommendation |
|------|------|
| No state management needed | **Function** (higher-order function, wrapper) |
| Converting multiple methods | **Class** |
| Lifecycle management required | **Class** |
| Managed by DI container | **Class** |
| Simple type conversion | **Function** (`toXxx()` function) |

### Q3: How do you manage a large number of Adapters?

1. **Directory structure**: Consolidate in an `adapters/` directory
2. **Naming conventions**: Use `XxxAdapter` consistently
3. **Factory pattern**: Automatically select the appropriate Adapter
4. **DI container**: Register Adapters against their interfaces
5. **Testing**: Verify each Adapter's conversion with unit tests

```
src/
  adapters/
    payment/
      stripe-adapter.ts
      paypal-adapter.ts
      square-adapter.ts
    notification/
      email-adapter.ts
      slack-adapter.ts
      sms-adapter.ts
    storage/
      s3-adapter.ts
      gcs-adapter.ts
```

### Q4: What is the relationship between the Adapter pattern and the Dependency Inversion Principle (DIP)?

The Adapter pattern is DIP in practice.

```
Without DIP (high-level module depends on low-level module):
OrderService ──direct dependency──> StripeSDK

With DIP (both depend on abstraction):
OrderService ──depends on──> PaymentGateway(interface)
                                 △
                                 |  implements
                           StripeAdapter ──delegates──> StripeSDK
```

The high-level module (OrderService) depends only on the abstraction (PaymentGateway) and has no knowledge of the concrete implementation details (StripeSDK).

### Q5: What is the difference between Adapter and Bridge pattern?

| | Adapter | Bridge |
|--|--|--|
| Purpose | **Retroactively** converts an existing interface | **Proactively** separates abstraction from implementation |
| Timing | Applied to existing code | Applied at the design stage |
| Change target | Does not change the Adaptee | Implementation side can be freely changed |
| Relationship | 1:1 (one Adapter per Adaptee) | 1:N (one abstraction, multiple implementations) |

### Q6: How is the Adapter used in inter-microservice communication?

In microservices, each service often has its own data format, and the Adapter functions as an Anti-Corruption Layer (ACL):

```
Service A                    ACL                    Service B
┌──────────┐    REST     ┌──────────────┐    gRPC   ┌──────────┐
│          │ ──────────> │  Adapter     │ ────────> │          │
│ Order    │             │ (format      │           │ Inventory│
│ Service  │ <────────── │  conversion) │ <──────── │ Service  │
└──────────┘             │ (protocol    │           └──────────┘
  JSON format            │  conversion) │           Protobuf format
                         └──────────────┘
                           conversion layer
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in professional practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| **Purpose** | Convert and integrate incompatible interfaces |
| **Object Adapter** | Delegation-based (has-a), **recommended** |
| **Class Adapter** | Inheritance-based (is-a), not recommended |
| **Use cases** | External libraries, legacy integration, multi-provider, testing |
| **Responsibility** | **Conversion only** — do not include business logic |
| **Related patterns** | Factory (Adapter selection), Strategy (dynamic switching), DIP (dependency inversion) |
| **Caution** | Avoid unnecessary indirection; always test conversions thoroughly |

---

## Guides to Read Next

- [Decorator Pattern](./01-decorator.md) — Dynamic feature addition (similar structure to Adapter, but different purpose)
- [Facade Pattern](./02-facade.md) — Simplifying complex subsystems
- [Proxy Pattern](./03-proxy.md) — Access control (similar structure to Adapter)
- [Strategy Pattern](../02-behavioral/01-strategy.md) — Algorithm replacement (used in combination with Adapter)
- [Factory Pattern](../00-creational/01-factory.md) — Used to select the appropriate Adapter
- Bridge Pattern — Separation of abstraction and implementation (different purpose from Adapter)

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley.
2. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media.
3. Martin, R. C. (2017). *Clean Architecture*. Prentice Hall. — Anti-Corruption Layer
4. Refactoring.Guru — Adapter. https://refactoring.guru/design-patterns/adapter
5. Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley. — Data Mapper
6. Microsoft — Strangler Fig Pattern. https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig
