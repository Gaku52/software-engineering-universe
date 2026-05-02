# Factory Method / Abstract Factory Pattern

> A creational pattern that **delegates** object creation to subclasses or dedicated factories, separating creation logic from the consuming code.

---

## What You Will Learn in This Chapter

1. The structural differences between Factory Method, Abstract Factory, and Simple Factory, and when to use each (WHY)
2. How abstracting creation logic provides flexibility, testability, and OCP compliance
3. Practical application scenarios — including combining Registry pattern with DI — and criteria for avoiding over-engineering
4. Concrete implementations in each language (TypeScript / Python / Java / Go)
5. Tradeoffs and anti-pattern avoidance associated with the Factory pattern

---

## Prerequisites

It is recommended to acquire the following knowledge before working through this guide.

| Topic | Required Level | Reference |
|---------|-----------|-----------|
| OOP fundamentals (inheritance, polymorphism, interfaces) | Required | OOP Basics |
| SOLID principles (especially OCP, DIP) | Recommended | [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) |
| Singleton pattern | Recommended | [Singleton](./00-singleton.md) |
| Generics / type parameters | Nice to have | TypeScript / Java Generics |
| DI (Dependency Injection) concept | Nice to have | [DIP](../../../clean-code-principles/docs/00-principles/01-solid.md) |

---

## 1. The Essence of the Factory Pattern -- Why Separate Creation?

### 1.1 The Problem It Solves

One of the most common problems in software development is that the **consuming code knows too much about which class to instantiate**.

```typescript
// Problematic code: the consumer directly knows about concrete classes
class OrderService {
  processPayment(order: Order): void {
    let processor;

    // The consumer decides "which class to instantiate"
    if (order.paymentMethod === "credit") {
      processor = new CreditCardProcessor(order.cardNumber, order.cvv);
    } else if (order.paymentMethod === "paypal") {
      processor = new PayPalProcessor(order.email);
    } else if (order.paymentMethod === "bank") {
      processor = new BankTransferProcessor(order.bankAccount);
    }
    // Every time a new payment method is added, this must change → OCP violation

    processor.charge(order.amount);
  }
}
```

**WHY -- Why is this a problem?**

```
1. OCP (Open/Closed Principle) violation
   Adding a new payment method → requires changing OrderService
   → Tests must be re-run, code must be reviewed, and redeployed

2. SRP (Single Responsibility Principle) violation
   OrderService has two responsibilities: "order processing" and "payment processor selection"

3. Difficult to test
   To mock a specific payment processor,
   you must be aware of the conditional branching inside OrderService

4. Duplicate code
   The same conditional branching may appear in other services
```

The Factory pattern resolves this by **delegating the responsibility of creation to a dedicated object**.

### 1.2 Three Variations of the Factory Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                Factory Pattern Taxonomy                       │
├─────────────┬───────────────────────────────────────────────┤
│             │                                               │
│  Simple     │  Creates objects via conditional branching    │
│  Factory    │  in a function or class method                │
│             │  Not a GoF pattern, but the most widely used  │
│             │  e.g., createNotification("email")            │
│             │                                               │
├─────────────┼───────────────────────────────────────────────┤
│             │                                               │
│  Factory    │  Subclass decides the type of product created │
│  Method     │  GoF pattern; the creational version of       │
│             │  Template Method                              │
│             │  e.g., abstract createNotification(): Notification│
│             │                                               │
├─────────────┼───────────────────────────────────────────────┤
│             │                                               │
│  Abstract   │  Creates a family of related products together│
│  Factory    │  GoF pattern; theme/platform switching        │
│             │  e.g., createButton() + createInput()         │
│             │                                               │
└─────────────┴───────────────────────────────────────────────┘
```

---

## 2. Structure of Factory Method

### 2.1 UML Class Diagram

```
+-------------------+           +-------------------+
|    Creator        |           |    Product        |
|   (abstract)      |           |   (interface)     |
+-------------------+           +-------------------+
| + factoryMethod() |---------->| + use()           |
|   : Product       |  creates  +-------------------+
| + operation()     |                   ^
+-------------------+                   |
        ^                               |
        |                               |
+-------------------+           +-------------------+
| ConcreteCreatorA  |           | ConcreteProductA  |
+-------------------+           +-------------------+
| + factoryMethod() |---------->| + use()           |
|   : ProductA      |  creates  +-------------------+
+-------------------+
        ^
        |
+-------------------+           +-------------------+
| ConcreteCreatorB  |           | ConcreteProductB  |
+-------------------+           +-------------------+
| + factoryMethod() |---------->| + use()           |
|   : ProductB      |  creates  +-------------------+
+-------------------+
```

### 2.2 Sequence Diagram

```
Client         ConcreteCreator         Product
  |                  |                     |
  |  operation()     |                     |
  |----------------->|                     |
  |                  |                     |
  |                  | factoryMethod()     |
  |                  |--+                  |
  |                  |  | creates          |
  |                  |  v                  |
  |                  | new ConcreteProduct |
  |                  |-------------------->|
  |                  |                     |
  |                  | product.use()       |
  |                  |-------------------->|
  |                  |                     |
  |  <--- result ----|                     |
  |                  |                     |
```

### 2.3 Internal Mechanics of Factory Method

```
The core of Factory Method:
The child class decides "what to create",
while the parent class decides "when and how to use it."

Creator (parent class):
┌──────────────────────────────────┐
│ operation() {                    │
│   const product = this.factory() │ ← "What" is delegated to the child class
│   product.prepare()              │ ← "How to use it" is defined here
│   product.use()                  │
│   return product.result()        │
│ }                                │
│                                  │
│ abstract factoryMethod(): Product│ ← abstract method
└──────────────────────────────────┘
         ^                ^
         |                |
┌────────────────┐ ┌────────────────┐
│ CreatorA       │ │ CreatorB       │
│ factoryMethod()│ │ factoryMethod()│
│ → ProductA     │ │ → ProductB     │
└────────────────┘ └────────────────┘
```

---

## 3. Structure of Abstract Factory

### 3.1 UML Class Diagram

```
+---------------------------+       +-------------+  +-------------+
| AbstractFactory           |       | ProductA    |  | ProductB    |
|---------------------------|       | (interface) |  | (interface) |
| + createProductA(): ProdA |       +-------------+  +-------------+
| + createProductB(): ProdB |             ^                ^
+---------------------------+             |                |
        ^           ^              +-------------+  +-------------+
        |           |              |ConcreteA1   |  |ConcreteB1   |
+-------------+ +-------------+   +-------------+  +-------------+
| Factory1    | | Factory2    |         ^                ^
|createA→ A1  | |createA→ A2  |         |                |
|createB→ B1  | |createB→ B2  |   +-------------+  +-------------+
+-------------+ +-------------+   |ConcreteA2   |  |ConcreteB2   |
                                  +-------------+  +-------------+
```

### 3.2 Relationship Between Abstract Factory and Factory Method

```
Abstract Factory can be viewed as a collection of multiple Factory Methods:

AbstractFactory
├── createProductA()  ← Factory Method 1
├── createProductB()  ← Factory Method 2
└── createProductC()  ← Factory Method 3

Each method is responsible for creating one product,
and the factory as a whole ensures consistency across the related product family.

Example: Material Design factory
├── createButton()  → MaterialButton
├── createInput()   → MaterialInput
└── createDialog()  → MaterialDialog
  ↑ All are unified under the Material Design style
```

---

## 4. Code Examples

### Code Example 1: Factory Method (TypeScript)

```typescript
// Product interface
interface Notification {
  send(message: string): void;
  getType(): string;
}

// Concrete Products
class EmailNotification implements Notification {
  constructor(private recipient: string) {}

  send(message: string): void {
    console.log(`[Email → ${this.recipient}] ${message}`);
  }

  getType(): string {
    return "email";
  }
}

class SlackNotification implements Notification {
  constructor(private channel: string) {}

  send(message: string): void {
    console.log(`[Slack #${this.channel}] ${message}`);
  }

  getType(): string {
    return "slack";
  }
}

class SmsNotification implements Notification {
  constructor(private phoneNumber: string) {}

  send(message: string): void {
    console.log(`[SMS → ${this.phoneNumber}] ${message}`);
  }

  getType(): string {
    return "sms";
  }
}

// Creator (abstract class)
abstract class NotificationService {
  // Factory Method: subclass determines the concrete Notification
  abstract createNotification(): Notification;

  // Template Method: the notification sending flow
  notify(message: string): void {
    const notification = this.createNotification();
    console.log(`Sending via ${notification.getType()}...`);
    notification.send(message);
    console.log("Notification sent successfully.");
  }
}

// Concrete Creators
class EmailService extends NotificationService {
  constructor(private recipient: string) {
    super();
  }

  createNotification(): Notification {
    return new EmailNotification(this.recipient);
  }
}

class SlackService extends NotificationService {
  constructor(private channel: string) {
    super();
  }

  createNotification(): Notification {
    return new SlackNotification(this.channel);
  }
}

// Usage: handled via the Creator type, so there is no dependency on the concrete notification method
function sendDeployNotification(service: NotificationService): void {
  service.notify("Deploy complete: v2.1.0");
}

sendDeployNotification(new SlackService("deployments"));
// Sending via slack...
// [Slack #deployments] Deploy complete: v2.1.0
// Notification sent successfully.

sendDeployNotification(new EmailService("admin@example.com"));
// Sending via email...
// [Email → admin@example.com] Deploy complete: v2.1.0
// Notification sent successfully.
```

### Code Example 2: Simple Factory (Function-Based)

In practice, Simple Factory is used far more often than the GoF Factory Method.

```typescript
type NotificationType = "email" | "slack" | "sms";

interface NotificationConfig {
  type: NotificationType;
  recipient?: string;
  channel?: string;
  phoneNumber?: string;
}

// Simple Factory function
function createNotification(config: NotificationConfig): Notification {
  switch (config.type) {
    case "email":
      if (!config.recipient) throw new Error("Email requires recipient");
      return new EmailNotification(config.recipient);
    case "slack":
      if (!config.channel) throw new Error("Slack requires channel");
      return new SlackNotification(config.channel);
    case "sms":
      if (!config.phoneNumber) throw new Error("SMS requires phoneNumber");
      return new SmsNotification(config.phoneNumber);
    default:
      // TypeScript exhaustive check
      const _exhaustive: never = config.type;
      throw new Error(`Unknown notification type: ${_exhaustive}`);
  }
}

// Usage
const emailNotif = createNotification({
  type: "email",
  recipient: "user@example.com"
});
emailNotif.send("Hello!");

const slackNotif = createNotification({
  type: "slack",
  channel: "general"
});
slackNotif.send("Hello team!");
```

**WHY -- When to use Simple Factory vs Factory Method:**

```
Use Simple Factory when:
- The conditional branching is simple (just switching on a type name)
- Template Method pattern is not needed
- You want to consolidate creation logic in one place
- A functional approach is preferred

Use Factory Method when:
- You want to customize not just the product created, but also how it is used
- Combining with Template Method is effective
- You are designing a framework and want to provide extension points
- Incremental feature additions via subclassing are required
```

### Code Example 3: Abstract Factory (TypeScript)

```typescript
// Abstract products
interface Button {
  render(): string;
  onClick(handler: () => void): void;
}

interface Input {
  render(): string;
  getValue(): string;
  setValue(value: string): void;
}

interface Dialog {
  render(): string;
  show(): void;
  close(): void;
}

// Abstract factory
interface UIFactory {
  createButton(label: string): Button;
  createInput(placeholder: string): Input;
  createDialog(title: string): Dialog;
}

// Concrete: Material Design
class MaterialButton implements Button {
  constructor(private label: string) {}
  render() { return `<md-button>${this.label}</md-button>`; }
  onClick(handler: () => void) { /* Material ripple effect + handler */ }
}

class MaterialInput implements Input {
  private value = "";
  constructor(private placeholder: string) {}
  render() { return `<md-input placeholder="${this.placeholder}" />`; }
  getValue() { return this.value; }
  setValue(v: string) { this.value = v; }
}

class MaterialDialog implements Dialog {
  constructor(private title: string) {}
  render() { return `<md-dialog><h2>${this.title}</h2></md-dialog>`; }
  show() { console.log(`Material Dialog opened: ${this.title}`); }
  close() { console.log(`Material Dialog closed: ${this.title}`); }
}

class MaterialFactory implements UIFactory {
  createButton(label: string) { return new MaterialButton(label); }
  createInput(placeholder: string) { return new MaterialInput(placeholder); }
  createDialog(title: string) { return new MaterialDialog(title); }
}

// Concrete: iOS Style
class IOSButton implements Button {
  constructor(private label: string) {}
  render() { return `<ios-button>${this.label}</ios-button>`; }
  onClick(handler: () => void) { /* iOS haptic feedback + handler */ }
}

class IOSInput implements Input {
  private value = "";
  constructor(private placeholder: string) {}
  render() { return `<ios-input placeholder="${this.placeholder}" />`; }
  getValue() { return this.value; }
  setValue(v: string) { this.value = v; }
}

class IOSDialog implements Dialog {
  constructor(private title: string) {}
  render() { return `<ios-dialog><h2>${this.title}</h2></ios-dialog>`; }
  show() { console.log(`iOS Dialog opened: ${this.title}`); }
  close() { console.log(`iOS Dialog closed: ${this.title}`); }
}

class IOSFactory implements UIFactory {
  createButton(label: string) { return new IOSButton(label); }
  createInput(placeholder: string) { return new IOSInput(placeholder); }
  createDialog(title: string) { return new IOSDialog(title); }
}

// Usage: swapping the factory changes the entire UI theme
function buildLoginForm(factory: UIFactory): string {
  const emailInput = factory.createInput("Email address");
  const passwordInput = factory.createInput("Password");
  const submitButton = factory.createButton("Login");

  return [
    emailInput.render(),
    passwordInput.render(),
    submitButton.render(),
  ].join("\n");
}

console.log("--- Material Design ---");
console.log(buildLoginForm(new MaterialFactory()));
// <md-input placeholder="Email address" />
// <md-input placeholder="Password" />
// <md-button>Login</md-button>

console.log("--- iOS Style ---");
console.log(buildLoginForm(new IOSFactory()));
// <ios-input placeholder="Email address" />
// <ios-input placeholder="Password" />
// <ios-button>Login</ios-button>
```

### Code Example 4: Registry Pattern (Extensible Factory)

A Factory that fully satisfies OCP (Open/Closed Principle). New types can be added without modifying existing code.

```typescript
type Creator<T> = (...args: any[]) => T;

class NotificationRegistry {
  private static registry = new Map<string, Creator<Notification>>();

  // Register a type (each module registers itself)
  static register(type: string, creator: Creator<Notification>): void {
    if (this.registry.has(type)) {
      console.warn(`Overwriting existing creator for: ${type}`);
    }
    this.registry.set(type, creator);
  }

  // Create an instance from a type name
  static create(type: string, ...args: any[]): Notification {
    const creator = this.registry.get(type);
    if (!creator) {
      const available = Array.from(this.registry.keys()).join(", ");
      throw new Error(
        `Unknown notification type: "${type}". Available: [${available}]`
      );
    }
    return creator(...args);
  }

  // List of registered types
  static getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}

// Each module registers its own product
// email-notification.ts
NotificationRegistry.register("email",
  (recipient: string) => new EmailNotification(recipient)
);

// slack-notification.ts
NotificationRegistry.register("slack",
  (channel: string) => new SlackNotification(channel)
);

// sms-notification.ts
NotificationRegistry.register("sms",
  (phone: string) => new SmsNotification(phone)
);

// Adding a new type: no changes to existing code required (OCP compliant)
// teams-notification.ts
class TeamsNotification implements Notification {
  constructor(private webhook: string) {}
  send(message: string) { console.log(`[Teams] ${message}`); }
  getType() { return "teams"; }
}
NotificationRegistry.register("teams",
  (webhook: string) => new TeamsNotification(webhook)
);

// Usage
const notification = NotificationRegistry.create("teams", "https://webhook.url");
notification.send("Teams notification!");
console.log(NotificationRegistry.getRegisteredTypes());
// ["email", "slack", "sms", "teams"]
```

### Code Example 5: Python -- Factory Method + ABC

```python
from abc import ABC, abstractmethod
from typing import Any
import json
import xml.etree.ElementTree as ET

class Serializer(ABC):
    """Abstract base class for serialization"""

    @abstractmethod
    def serialize(self, data: dict) -> str:
        """Convert data to a string"""
        ...

    @abstractmethod
    def deserialize(self, raw: str) -> dict:
        """Restore data from a string"""
        ...

    @abstractmethod
    def content_type(self) -> str:
        """Return the MIME type"""
        ...

class JsonSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        return json.dumps(data, ensure_ascii=False, indent=2)

    def deserialize(self, raw: str) -> dict:
        return json.loads(raw)

    def content_type(self) -> str:
        return "application/json"

class XmlSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        root = ET.Element("data")
        for key, value in data.items():
            child = ET.SubElement(root, key)
            child.text = str(value)
        return ET.tostring(root, encoding="unicode")

    def deserialize(self, raw: str) -> dict:
        root = ET.fromstring(raw)
        return {child.tag: child.text for child in root}

    def content_type(self) -> str:
        return "application/xml"

class CsvSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        headers = ",".join(data.keys())
        values = ",".join(str(v) for v in data.values())
        return f"{headers}\n{values}"

    def deserialize(self, raw: str) -> dict:
        lines = raw.strip().split("\n")
        headers = lines[0].split(",")
        values = lines[1].split(",")
        return dict(zip(headers, values))

    def content_type(self) -> str:
        return "text/csv"

# Simple Factory
def get_serializer(fmt: str) -> Serializer:
    """Factory that returns the appropriate Serializer based on format name"""
    factories: dict[str, type[Serializer]] = {
        "json": JsonSerializer,
        "xml": XmlSerializer,
        "csv": CsvSerializer,
    }
    cls = factories.get(fmt)
    if cls is None:
        available = ", ".join(factories.keys())
        raise ValueError(f"Unknown format: '{fmt}'. Available: [{available}]")
    return cls()

# Usage
data = {"name": "Taro", "age": "30", "city": "Tokyo"}

for fmt in ["json", "xml", "csv"]:
    s = get_serializer(fmt)
    serialized = s.serialize(data)
    print(f"\n--- {fmt} ({s.content_type()}) ---")
    print(serialized)
    restored = s.deserialize(serialized)
    print(f"Restored: {restored}")
```

### Code Example 6: Java -- Parameterized Factory Method

```java
public interface Shape {
    double area();
    String description();
}

public class Circle implements Shape {
    private final double radius;

    public Circle(double radius) {
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }

    @Override
    public String description() {
        return String.format("Circle(radius=%.2f, area=%.2f)", radius, area());
    }
}

public class Rectangle implements Shape {
    private final double width, height;

    public Rectangle(double width, double height) {
        this.width = width;
        this.height = height;
    }

    @Override
    public double area() {
        return width * height;
    }

    @Override
    public String description() {
        return String.format("Rectangle(%.2f x %.2f, area=%.2f)", width, height, area());
    }
}

// Parameterized Factory Method with enum
public enum ShapeType {
    CIRCLE, RECTANGLE, TRIANGLE
}

public class ShapeFactory {
    public static Shape create(ShapeType type, double... params) {
        return switch (type) {
            case CIRCLE -> new Circle(params[0]);
            case RECTANGLE -> new Rectangle(params[0], params[1]);
            case TRIANGLE -> new Triangle(params[0], params[1]);
        };
    }
}

// Usage
Shape circle = ShapeFactory.create(ShapeType.CIRCLE, 5.0);
Shape rect = ShapeFactory.create(ShapeType.RECTANGLE, 3.0, 4.0);
System.out.println(circle.description()); // Circle(radius=5.00, area=78.54)
System.out.println(rect.description());   // Rectangle(3.00 x 4.00, area=12.00)
```

### Code Example 7: Go -- Interface-Based Factory

```go
package main

import "fmt"

// Product interface
type Logger interface {
    Log(message string)
    Level() string
}

// Concrete Products
type ConsoleLogger struct{}

func (l *ConsoleLogger) Log(message string) {
    fmt.Printf("[CONSOLE] %s\n", message)
}
func (l *ConsoleLogger) Level() string { return "console" }

type FileLogger struct {
    filename string
}

func (l *FileLogger) Log(message string) {
    fmt.Printf("[FILE:%s] %s\n", l.filename, message)
}
func (l *FileLogger) Level() string { return "file" }

type CloudLogger struct {
    endpoint string
}

func (l *CloudLogger) Log(message string) {
    fmt.Printf("[CLOUD:%s] %s\n", l.endpoint, message)
}
func (l *CloudLogger) Level() string { return "cloud" }

// Factory function (Go leverages first-class functions)
type LoggerFactory func() Logger

// Registry
var loggerFactories = map[string]LoggerFactory{
    "console": func() Logger { return &ConsoleLogger{} },
    "file":    func() Logger { return &FileLogger{filename: "app.log"} },
    "cloud":   func() Logger { return &CloudLogger{endpoint: "https://log.example.com"} },
}

func CreateLogger(loggerType string) (Logger, error) {
    factory, exists := loggerFactories[loggerType]
    if !exists {
        return nil, fmt.Errorf("unknown logger type: %s", loggerType)
    }
    return factory(), nil
}

// Register a new type
func RegisterLogger(name string, factory LoggerFactory) {
    loggerFactories[name] = factory
}

func main() {
    logger, _ := CreateLogger("console")
    logger.Log("Application started")

    logger2, _ := CreateLogger("cloud")
    logger2.Log("Cloud logging active")
}
```

### Code Example 8: TypeScript -- Async Factory

In practice, a Factory may need to load configuration from a database or API.

```typescript
// Async Factory pattern
interface DataSource {
  connect(): Promise<void>;
  query(sql: string): Promise<any[]>;
  disconnect(): Promise<void>;
}

class PostgresDataSource implements DataSource {
  private pool: any;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    console.log(`Connecting to PostgreSQL: ${this.connectionString}`);
    // this.pool = await createPool(this.connectionString);
  }

  async query(sql: string): Promise<any[]> {
    console.log(`[PG] ${sql}`);
    return [];
  }

  async disconnect(): Promise<void> {
    // await this.pool.end();
  }
}

class MySQLDataSource implements DataSource {
  constructor(private config: { host: string; port: number; database: string }) {}

  async connect(): Promise<void> {
    console.log(`Connecting to MySQL: ${this.config.host}:${this.config.port}`);
  }

  async query(sql: string): Promise<any[]> {
    console.log(`[MySQL] ${sql}`);
    return [];
  }

  async disconnect(): Promise<void> {}
}

// Async Factory: creation and initialization in a single step
async function createDataSource(
  type: "postgres" | "mysql",
  config: Record<string, any>
): Promise<DataSource> {
  let ds: DataSource;

  switch (type) {
    case "postgres":
      ds = new PostgresDataSource(config.connectionString);
      break;
    case "mysql":
      ds = new MySQLDataSource({
        host: config.host,
        port: config.port,
        database: config.database,
      });
      break;
    default:
      throw new Error(`Unknown data source type: ${type}`);
  }

  // The Factory guarantees initialization as well
  await ds.connect();
  return ds;
}

// Usage
async function main() {
  const ds = await createDataSource("postgres", {
    connectionString: "postgresql://localhost:5432/mydb"
  });
  const users = await ds.query("SELECT * FROM users");
  await ds.disconnect();
}
```

### Code Example 9: Combining Factory with Strategy

```typescript
// Generating validation strategies with a Factory
interface ValidationStrategy {
  validate(value: string): { valid: boolean; error?: string };
}

class EmailValidator implements ValidationStrategy {
  validate(value: string) {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return { valid, error: valid ? undefined : "Invalid email format" };
  }
}

class PhoneValidator implements ValidationStrategy {
  validate(value: string) {
    const valid = /^\d{10,11}$/.test(value.replace(/-/g, ""));
    return { valid, error: valid ? undefined : "Invalid phone number" };
  }
}

class UrlValidator implements ValidationStrategy {
  validate(value: string) {
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: "Invalid URL" };
    }
  }
}

// Factory
const validatorFactory = new Map<string, () => ValidationStrategy>([
  ["email", () => new EmailValidator()],
  ["phone", () => new PhoneValidator()],
  ["url", () => new UrlValidator()],
]);

function createValidator(type: string): ValidationStrategy {
  const factory = validatorFactory.get(type);
  if (!factory) throw new Error(`Unknown validator: ${type}`);
  return factory();
}

// Usage: dynamically select a validator driven by configuration
const formFields = [
  { name: "email", type: "email", value: "user@example.com" },
  { name: "phone", type: "phone", value: "090-1234-5678" },
  { name: "website", type: "url", value: "https://example.com" },
];

for (const field of formFields) {
  const validator = createValidator(field.type);
  const result = validator.validate(field.value);
  console.log(`${field.name}: ${result.valid ? "OK" : result.error}`);
}
// email: OK
// phone: OK
// website: OK
```

### Code Example 10: Integrating Factory with DI

```typescript
// Practical pattern: managing Factory with a DI container
interface IPaymentProcessor {
  charge(amount: number): Promise<{ success: boolean; transactionId: string }>;
  refund(transactionId: string): Promise<boolean>;
}

interface IPaymentFactory {
  create(method: string): IPaymentProcessor;
  getSupportedMethods(): string[];
}

class PaymentFactory implements IPaymentFactory {
  private processors = new Map<string, () => IPaymentProcessor>();

  register(method: string, factory: () => IPaymentProcessor): void {
    this.processors.set(method, factory);
  }

  create(method: string): IPaymentProcessor {
    const factory = this.processors.get(method);
    if (!factory) {
      throw new Error(`Unsupported payment method: ${method}`);
    }
    return factory();
  }

  getSupportedMethods(): string[] {
    return Array.from(this.processors.keys());
  }
}

// Integration with the DI container
// container.ts
const container = new Container();

// Register the Factory itself in Singleton scope
container.bind<IPaymentFactory>(TYPES.PaymentFactory)
  .toDynamicValue(() => {
    const factory = new PaymentFactory();
    factory.register("credit", () => new CreditCardProcessor());
    factory.register("paypal", () => new PayPalProcessor());
    factory.register("bank", () => new BankTransferProcessor());
    return factory;
  })
  .inSingletonScope();

// Consumer: has the Factory injected
class OrderService {
  constructor(
    @inject(TYPES.PaymentFactory) private paymentFactory: IPaymentFactory
  ) {}

  async processOrder(order: Order): Promise<void> {
    const processor = this.paymentFactory.create(order.paymentMethod);
    const result = await processor.charge(order.amount);
    if (!result.success) {
      throw new Error("Payment failed");
    }
  }
}
```

---

## 5. Factory Selection Flowchart

```
Do you want to separate the creation logic?
│
├── No → new directly is sufficient. Factory is over-engineering
│
└── Yes
    │
    ├── Is there only one type of product to create?
    │   │
    │   ├── Yes
    │   │   │
    │   │   ├── Just branching on a type name?
    │   │   │   ├── Yes → Simple Factory (function / static method)
    │   │   │   └── No  → Factory Method (override in subclass)
    │   │   │
    │   │   └── Do you need to add types dynamically at runtime?
    │   │       ├── Yes → Registry pattern
    │   │       └── No  → Simple Factory is sufficient
    │   │
    │   └── No (there is a family of related products)
    │       │
    │       └── Is consistency across the product family important?
    │           ├── Yes → Abstract Factory
    │           └── No  → Individual Factory Methods are sufficient
    │
    └── Do you need to swap products during testing?
        ├── Yes → DI + Factory interface
        └── No  → Simple Factory is sufficient
```

---

## 6. Comparison Tables

### Comparison Table 1: Factory Method vs Abstract Factory vs Simple Factory

| Perspective | Simple Factory | Factory Method | Abstract Factory |
|------|:---:|:---:|:---:|
| GoF Pattern | No | Yes | Yes |
| Intent | Consolidate creation via branching | Delegate creation to subclass | Create a family of related products |
| Number of Classes | Minimal | Medium | Many |
| Extension Method | Add to switch statement | Add Creator subclass | Add Factory + Product family |
| OCP Compliance | No (requires switch change) | Yes | Yes |
| Use Case | Simple branching | Combined with Template Method | Theme/Platform switching |
| Complexity | Low | Medium | High |
| Testability | Medium | High | High |

### Comparison Table 2: Factory vs Other Creational Patterns

| Pattern | Purpose | Creation Flexibility | Complexity | Usage Frequency |
|---------|------|:---:|:---:|:---:|
| Simple Factory | Create via branching | Low | Low | Very High |
| Factory Method | Delegate to subclass | Medium | Medium | High |
| Abstract Factory | Create a family | High | High | Medium |
| Builder | Stepwise construction | High | Medium | High |
| Prototype | Create via cloning | Medium | Low | Low |
| Singleton | Single instance | N/A | Low | High |

### Comparison Table 3: Registry Pattern vs DI Container

| Perspective | Registry Pattern | DI Container |
|------|:---:|:---:|
| Registration Method | Manual register() | Configuration / annotations |
| Lifetime Management | None (created each time) | Singleton / Transient, etc. |
| Dependency Resolution | Manual | Automatic |
| Testability | Medium | High |
| Learning Cost | Low | Medium~High |
| Adoption Cost | Low | Medium |
| Recommended Use Case | Plugin registration | App-wide dependency management |

---

## 7. Edge Cases and Caveats

### 7.1 Ensuring Type Safety

```typescript
// Problem: string-based Factory is not type-safe
const notif = createNotification("emal");  // typo! Runtime error

// Solution 1: Restrict with union type
type NotificationType = "email" | "slack" | "sms";
function createNotification(type: NotificationType): Notification { ... }

// Solution 2: Enum (Java/TypeScript)
enum NotificationType {
  Email = "email",
  Slack = "slack",
  Sms = "sms",
}

// Solution 3: Discriminated Union (TypeScript)
type NotificationRequest =
  | { type: "email"; recipient: string }
  | { type: "slack"; channel: string }
  | { type: "sms"; phoneNumber: string };

function createNotification(req: NotificationRequest): Notification {
  switch (req.type) {
    case "email":
      return new EmailNotification(req.recipient);  // type-safe access
    case "slack":
      return new SlackNotification(req.channel);     // type-safe access
    case "sms":
      return new SmsNotification(req.phoneNumber);   // type-safe access
  }
}
```

### 7.2 Avoiding Circular Dependencies

```
// Problem: Factory and Product are mutually dependent
ProductA → Factory (used for creation)
Factory → ProductA (creates it)

// Solution: Introduce an interface as an intermediary layer
ProductA → IFactory (depends on interface)
Factory → IProduct (depends on interface)
ConcreteFactory → ConcreteProduct (concrete references concrete)

Apply DIP (Dependency Inversion Principle):
  High-level module (consumer) → Interface ← Low-level module (implementation)
```

### 7.3 Memory Leaks in Factories

```typescript
// Problem: objects registered in a Registry are never GC'd
class HeavyRegistry {
  private static cache = new Map<string, LargeObject>();

  static getOrCreate(key: string): LargeObject {
    if (!this.cache.has(key)) {
      this.cache.set(key, new LargeObject(key)); // accumulates indefinitely
    }
    return this.cache.get(key)!;
  }
}

// Solution: use WeakMap or an LRU cache
class SafeRegistry {
  private static cache = new LRUCache<string, LargeObject>({ max: 100 });

  static getOrCreate(key: string): LargeObject {
    let obj = this.cache.get(key);
    if (!obj) {
      obj = new LargeObject(key);
      this.cache.set(key, obj);
    }
    return obj;
  }
}
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: God Factory

```typescript
// BAD: handling every type in a single Factory
class UniversalFactory {
  create(type: string): any {  // any is a red flag
    if (type === "user") return new User();
    if (type === "order") return new Order();
    if (type === "product") return new Product();
    if (type === "payment") return new Payment();
    if (type === "notification") return new Notification();
    if (type === "report") return new Report();
    // ... 50 lines of if-else
    throw new Error(`Unknown type: ${type}`);
  }
}
```

**Problems**:
- OCP violation: this class must be changed every time a new type is added
- SRP violation: object creation for unrelated domains is consolidated in one class
- No type safety: return type is any

```typescript
// GOOD: split Factory by domain
class UserFactory {
  static create(type: UserType): User { ... }
}

class OrderFactory {
  static create(items: CartItem[]): Order { ... }
}

class NotificationFactory {
  static create(type: NotificationType): Notification { ... }
}
```

### Anti-Pattern 2: Unnecessary Abstract Factory

```typescript
// BAD: using Abstract Factory when there is only one type of product
interface ShapeFactory {
  createShape(): Shape;  // only 1 method → Abstract Factory is overkill
}

class CircleFactory implements ShapeFactory {
  createShape(): Shape { return new Circle(); }
}

class RectangleFactory implements ShapeFactory {
  createShape(): Shape { return new Rectangle(); }
}
```

**Problem**: Introduces excessive abstraction in a situation where Factory Method would suffice.

```typescript
// GOOD: use Simple Factory or Factory Method
function createShape(type: "circle" | "rectangle"): Shape {
  switch (type) {
    case "circle": return new Circle();
    case "rectangle": return new Rectangle();
  }
}
```

**YAGNI Principle**: Do not promote to Abstract Factory until multiple products are actually needed.

### Anti-Pattern 3: Business Logic Inside a Factory

```typescript
// BAD: Factory holds responsibilities beyond creation
class OrderFactory {
  static create(items: CartItem[], coupon?: string): Order {
    const order = new Order(items);

    // Business logic (not the Factory's responsibility)
    if (coupon) {
      const discount = this.validateCoupon(coupon);  // coupon validation
      order.applyDiscount(discount);                 // apply discount
    }

    order.calculateTax();      // tax calculation
    order.calculateShipping(); // shipping calculation
    this.sendAnalytics(order); // send analytics data

    return order;
  }
}
```

```typescript
// GOOD: Factory only creates. Business logic is delegated to the domain service
class OrderFactory {
  static create(items: CartItem[]): Order {
    return new Order(items);  // creation only
  }
}

class OrderService {
  constructor(
    private couponService: CouponService,
    private taxService: TaxService,
    private analytics: AnalyticsService,
  ) {}

  async processOrder(items: CartItem[], coupon?: string): Promise<Order> {
    const order = OrderFactory.create(items);

    if (coupon) {
      const discount = await this.couponService.validate(coupon);
      order.applyDiscount(discount);
    }

    order.tax = this.taxService.calculate(order);
    await this.analytics.track("order_created", order);

    return order;
  }
}
```

---

## 9. Tradeoff Analysis

### 9.1 Benefits and Drawbacks of Introducing a Factory

```
Benefits                          Drawbacks
+------------------------------+  +------------------------------+
| Centralized creation logic   |  | Increased number of classes  |
| OCP compliant (easy to extend)|  | Added complexity from indirection |
| Easy mock swapping in tests  |  | Risk of over-engineering      |
| No dependency on concrete    |  | YAGNI in simple cases        |
|   classes in consuming code  |  | More difficult to trace when |
| Improved code reusability    |  |   debugging                  |
+------------------------------+  +------------------------------+
```

### 9.2 Guidelines for Deciding Whether to Introduce

```
When to introduce a Factory:
- new calls are scattered across 3 or more places
- Creation logic contains conditional branching
- Mock swapping is needed in tests
- Building a plugin system
- Dynamically selecting objects based on configuration

When NOT to introduce a Factory:
- new is only called in 1-2 places
- The type to be created is not expected to change
- There is no conditional branching in creation
- Creating simple data objects (DTOs)
```

---

## 10. Practice Exercises

### Exercise 1: Basics -- Implementing a Simple Factory

**Task**: Implement a Simple Factory for a log formatter.

**Requirements**:
- Define an `ILogFormatter` interface (with a `format(level, message, timestamp)` method)
- Implement three concrete formatters: JSON, Text, and CSV
- Create a `createFormatter(type)` Factory function
- Throw an exception with an appropriate error message for unknown types

```typescript
// === Write your implementation here ===
```

**Expected Output**:

```
const jsonFmt = createFormatter("json");
console.log(jsonFmt.format("info", "Server started", new Date()));
// {"level":"info","message":"Server started","timestamp":"2026-01-15T10:30:00.000Z"}

const textFmt = createFormatter("text");
console.log(textFmt.format("error", "Connection failed", new Date()));
// [2026-01-15T10:30:00.000Z] [ERROR] Connection failed

const csvFmt = createFormatter("csv");
console.log(csvFmt.format("warn", "Memory high", new Date()));
// 2026-01-15T10:30:00.000Z,WARN,Memory high
```

<details>
<summary>Reference Answer (click to expand)</summary>

```typescript
interface ILogFormatter {
  format(level: string, message: string, timestamp: Date): string;
}

class JsonLogFormatter implements ILogFormatter {
  format(level: string, message: string, timestamp: Date): string {
    return JSON.stringify({
      level,
      message,
      timestamp: timestamp.toISOString(),
    });
  }
}

class TextLogFormatter implements ILogFormatter {
  format(level: string, message: string, timestamp: Date): string {
    return `[${timestamp.toISOString()}] [${level.toUpperCase()}] ${message}`;
  }
}

class CsvLogFormatter implements ILogFormatter {
  format(level: string, message: string, timestamp: Date): string {
    return `${timestamp.toISOString()},${level.toUpperCase()},${message}`;
  }
}

type FormatterType = "json" | "text" | "csv";

function createFormatter(type: FormatterType): ILogFormatter {
  const factories: Record<FormatterType, () => ILogFormatter> = {
    json: () => new JsonLogFormatter(),
    text: () => new TextLogFormatter(),
    csv: () => new CsvLogFormatter(),
  };

  const factory = factories[type];
  if (!factory) {
    throw new Error(`Unknown formatter type: "${type}". Available: ${Object.keys(factories).join(", ")}`);
  }
  return factory();
}
```

</details>

### Exercise 2: Applied -- Extending the Registry Pattern

**Task**: Implement a Registry pattern Factory that functions as a plugin system.

**Requirements**:
- Implement a `PluginRegistry` class
- Support plugin registration (register), creation (create), listing (list), and deregistration (unregister)
- Emit a warning on duplicate registration
- Ensure type safety (use generics)
- Allow a validation function to be specified at registration time

```typescript
// === Write your implementation here ===
```

**Expected Output**:

```
const registry = new PluginRegistry<IPlugin>();
registry.register("analytics", () => new AnalyticsPlugin());
registry.register("auth", () => new AuthPlugin());

const plugin = registry.create("analytics");
plugin.initialize();

console.log(registry.list()); // ["analytics", "auth"]

registry.unregister("auth");
console.log(registry.list()); // ["analytics"]
```

<details>
<summary>Reference Answer (click to expand)</summary>

```typescript
interface IPlugin {
  name: string;
  initialize(): void;
  destroy(): void;
}

type PluginFactory<T> = () => T;
type PluginValidator<T> = (plugin: T) => boolean;

class PluginRegistry<T extends IPlugin> {
  private factories = new Map<string, PluginFactory<T>>();
  private validators = new Map<string, PluginValidator<T>>();

  register(
    name: string,
    factory: PluginFactory<T>,
    validator?: PluginValidator<T>
  ): void {
    if (this.factories.has(name)) {
      console.warn(`Warning: Overwriting existing plugin: "${name}"`);
    }
    this.factories.set(name, factory);
    if (validator) {
      this.validators.set(name, validator);
    }
  }

  create(name: string): T {
    const factory = this.factories.get(name);
    if (!factory) {
      const available = this.list().join(", ");
      throw new Error(
        `Plugin "${name}" not found. Available: [${available}]`
      );
    }

    const plugin = factory();

    // Run validation
    const validator = this.validators.get(name);
    if (validator && !validator(plugin)) {
      throw new Error(`Plugin "${name}" failed validation`);
    }

    return plugin;
  }

  list(): string[] {
    return Array.from(this.factories.keys()).sort();
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  unregister(name: string): boolean {
    this.validators.delete(name);
    return this.factories.delete(name);
  }

  clear(): void {
    this.factories.clear();
    this.validators.clear();
  }
}
```

</details>

### Exercise 3: Advanced -- Cross-Platform UI with Abstract Factory

**Task**: Design an Abstract Factory that supports three platforms: Web, Mobile, and Desktop.

**Requirements**:
- Generate three UI components — Button, TextField, and Checkbox — for each platform
- Each component has a `render(): string` method
- Platform switching is done solely by swapping the Factory
- Also create a MockFactory for testing
- Manage factory creation itself with another Factory (Factory of Factories)

```typescript
// === Write your implementation here ===
```

**Expected Output**:

```
// Web Platform
const webUI = buildForm(new WebUIFactory());
console.log(webUI);
// <input type="text" class="web-input" placeholder="Name" />
// <input type="checkbox" class="web-checkbox" />
// <button class="web-btn">Submit</button>

// Mobile Platform
const mobileUI = buildForm(new MobileUIFactory());
console.log(mobileUI);
// <TextInput style="mobile" placeholder="Name" />
// <Switch style="mobile" />
// <TouchableOpacity style="mobile">Submit</TouchableOpacity>

// Platform auto-detection
const factory = UIFactoryProvider.getFactory("web");
const autoUI = buildForm(factory);
```

<details>
<summary>Reference Answer (click to expand)</summary>

```typescript
// Abstract products
interface IButton {
  render(): string;
}
interface ITextField {
  render(): string;
}
interface ICheckbox {
  render(): string;
}

// Abstract factory
interface IUIFactory {
  createButton(label: string): IButton;
  createTextField(placeholder: string): ITextField;
  createCheckbox(label: string): ICheckbox;
}

// Web implementation
class WebButton implements IButton {
  constructor(private label: string) {}
  render() { return `<button class="web-btn">${this.label}</button>`; }
}
class WebTextField implements ITextField {
  constructor(private placeholder: string) {}
  render() { return `<input type="text" class="web-input" placeholder="${this.placeholder}" />`; }
}
class WebCheckbox implements ICheckbox {
  constructor(private label: string) {}
  render() { return `<input type="checkbox" class="web-checkbox" /> ${this.label}`; }
}
class WebUIFactory implements IUIFactory {
  createButton(label: string) { return new WebButton(label); }
  createTextField(ph: string) { return new WebTextField(ph); }
  createCheckbox(label: string) { return new WebCheckbox(label); }
}

// Mobile implementation
class MobileButton implements IButton {
  constructor(private label: string) {}
  render() { return `<TouchableOpacity style="mobile">${this.label}</TouchableOpacity>`; }
}
class MobileTextField implements ITextField {
  constructor(private placeholder: string) {}
  render() { return `<TextInput style="mobile" placeholder="${this.placeholder}" />`; }
}
class MobileCheckbox implements ICheckbox {
  constructor(private label: string) {}
  render() { return `<Switch style="mobile" /> ${this.label}`; }
}
class MobileUIFactory implements IUIFactory {
  createButton(label: string) { return new MobileButton(label); }
  createTextField(ph: string) { return new MobileTextField(ph); }
  createCheckbox(label: string) { return new MobileCheckbox(label); }
}

// Desktop implementation
class DesktopButton implements IButton {
  constructor(private label: string) {}
  render() { return `<QButton text="${this.label}" />`; }
}
class DesktopTextField implements ITextField {
  constructor(private placeholder: string) {}
  render() { return `<QLineEdit placeholder="${this.placeholder}" />`; }
}
class DesktopCheckbox implements ICheckbox {
  constructor(private label: string) {}
  render() { return `<QCheckBox text="${this.label}" />`; }
}
class DesktopUIFactory implements IUIFactory {
  createButton(label: string) { return new DesktopButton(label); }
  createTextField(ph: string) { return new DesktopTextField(ph); }
  createCheckbox(label: string) { return new DesktopCheckbox(label); }
}

// Factory of Factories
type Platform = "web" | "mobile" | "desktop";

class UIFactoryProvider {
  private static factories: Record<Platform, () => IUIFactory> = {
    web: () => new WebUIFactory(),
    mobile: () => new MobileUIFactory(),
    desktop: () => new DesktopUIFactory(),
  };

  static getFactory(platform: Platform): IUIFactory {
    const factory = this.factories[platform];
    if (!factory) throw new Error(`Unknown platform: ${platform}`);
    return factory();
  }
}

// Consumer code (platform-agnostic)
function buildForm(factory: IUIFactory): string {
  const nameField = factory.createTextField("Name");
  const agreeBox = factory.createCheckbox("I agree");
  const submitBtn = factory.createButton("Submit");

  return [nameField.render(), agreeBox.render(), submitBtn.render()].join("\n");
}
```

</details>

---

## 11. FAQ

### Q1: What is the difference between Simple Factory and Factory Method?

Simple Factory creates objects via conditional branching in a plain function or class method. Factory Method is a GoF pattern where creation is overridden through subclassing. In most real-world cases, Simple Factory is sufficient.

| Perspective | Simple Factory | Factory Method |
|------|:---:|:---:|
| Pattern Category | Idiom | GoF Pattern |
| Extension Method | Modify switch statement | Add subclass |
| OCP Compliance | No | Yes |
| Use Case | Simple branching | Framework extension |

### Q2: What criteria should I use to decide whether to use a Factory?

Consider introducing a Factory if any of the following three conditions apply:

1. **`new` calls are scattered across 3 or more places**: Changes to creation logic affect multiple locations
2. **Creation logic contains conditional branching**: A decision is needed about which type to instantiate
3. **Mock swapping is needed in tests**: Direct dependency on concrete classes needs to be removed

Conversely, if `new` is only used in 1-2 places, there is no conditional branching, and mocking is not needed, a Factory is over-engineering.

### Q3: If I have a DI container, do I still need a Factory?

A DI container resolves dependencies at **startup time**, but a Factory is still needed when you need to dynamically switch types at **runtime**. The two are complementary.

```
DI container: resolved at startup (configuration-based)
  container.bind<Logger>().to(ConsoleLogger)
  → resolved once when the application starts

Factory: resolved at runtime (data-driven)
  factory.create(user.preferredNotificationType)
  → a different type is created per request

Best practice: manage the Factory itself with the DI container
  container.bind<INotificationFactory>()
    .to(NotificationFactory)
    .inSingletonScope();
```

### Q4: How should I choose between Factory Method and Strategy pattern?

```
Factory Method:
- The concern is "what to create"
- The subclass decides the type of product
- The created object is used inside a Template Method

Strategy:
- The concern is "how to behave"
- An algorithm is switched at runtime
- Achieved through composition (delegation)

Combined use:
- It is common to use a Factory to generate Strategy objects
- When a Strategy is needed, design the Strategy first,
  then use a Factory for its creation
```

### Q5: What is the impact of adding a product to an Abstract Factory?

Adding a new product (createNewProduct()) to an Abstract Factory affects all concrete factories (it changes the interface). This is the biggest weakness of Abstract Factory.

```
Solutions:
1. Apply the Interface Segregation Principle (ISP) and split the Factory
2. Use an abstract class with a default implementation
3. Generic Factory method: create<T>(type: Class<T>): T
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## 12. Summary

| Item | Key Point |
|------|---------|
| Factory Method | Delegates creation of one product to a subclass. Works well with Template Method |
| Abstract Factory | Creates a family of related products together. Ideal for theme/platform switching |
| Simple Factory | The most lightweight option. Realized with a single function. Most common in practice |
| Registry | OCP-compliant extensible Factory. Ideal for plugin systems |
| Decision Criteria | Consider introducing when: new calls are scattered / conditional branching exists / mocking is needed |
| Avoiding Over-Engineering | YAGNI principle: choose the minimal Factory that fits the current requirements |
| Relationship with DI | DI container and Factory are complementary. Best practice is to manage the Factory with DI |
| Key Caution | Do not put business logic inside a Factory |

---

## What to Read Next

- [Builder Pattern](./02-builder.md) -- Stepwise construction of complex objects. Factory handles "what", Builder handles "how"
- [Prototype Pattern](./03-prototype.md) -- Creation via cloning. An alternative approach to Factory
- [Singleton Pattern](./00-singleton.md) -- Singleton management of the Factory Registry
- [Strategy Pattern](../02-behavioral/01-strategy.md) -- Swapping algorithms. Combining Factory + Strategy
- [Adapter Pattern](../01-structural/00-adapter.md) -- Adapting existing classes. Using Factory to create Adapters
- [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) -- Details of OCP and DIP

---

## References

1. Gamma, E. et al. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. -- The original source for Factory Method / Abstract Factory
2. Freeman, E. et al. (2004). *Head First Design Patterns*. O'Reilly Media. Chapter 4: The Factory Pattern.
3. Martin, R.C. (2017). *Clean Architecture*. Prentice Hall. -- The relationship between SOLID principles and Factory
4. Refactoring.Guru -- Factory Method. https://refactoring.guru/design-patterns/factory-method
5. Refactoring.Guru -- Abstract Factory. https://refactoring.guru/design-patterns/abstract-factory
6. Fowler, M. -- Plugin Pattern. https://martinfowler.com/eaaCatalog/plugin.html
