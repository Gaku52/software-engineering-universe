# Composite Pattern

> A structural pattern that organizes objects into a **tree structure**, enabling individual objects (Leaf) and their collections (Composite) to be handled through a unified interface. Clients can uniformly operate on an entire recursive tree structure without needing to distinguish between individual elements and collections.

---

## What You Will Learn in This Chapter

1. Deeply understand the structure of the Composite pattern, the mechanism of recursive composition, and the GoF design intent
2. Master practical application scenarios such as file systems, UI trees, organizational charts, menu structures, and expression trees
3. Be able to make informed design decisions around the transparency-vs-safety tradeoff, circular reference prevention, and performance optimization

---

## Prerequisites

Before reading this guide, it is recommended to understand the following concepts.

| Prerequisite | Description | Reference |
|---------|------|-----------|
| Interfaces and Polymorphism | The concept of treating different types uniformly through a common interface | [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) |
| Recursion | The concept of a function or data structure referencing itself | CS Fundamentals |
| Tree Data Structures | A hierarchical data structure composed of nodes and edges | Data Structures |
| Composition vs Inheritance | The difference between approaches to assembling objects | [Composition Over Inheritance](../../../clean-code-principles/docs/03-practices-advanced/01-composition-over-inheritance.md) |

---

## 1. What Is the Composite Pattern?

### 1.1 The Problem It Solves

Software development frequently involves dealing with "part-whole" relationships. For example:

- Files and folders (folders contain files and subfolders)
- UI primitives and containers (containers hold buttons, text, and sub-containers)
- Organizational employees and departments (departments contain employees and sub-departments)

What all of these have in common is the requirement to **treat individual elements and groups of elements in the same way**. Without the Composite pattern, client code must constantly check "is this a Leaf or a Composite?", leading to increased complexity.

### 1.2 Intent of the Pattern

GoF definition:

> Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects uniformly.

### 1.3 WHY: Why Is the Composite Pattern Needed?

The fundamental reason is to **align the level of abstraction**.

1. **Simplification of client code**: Eliminates branches like `if (isLeaf)`, allowing recursive uniform operations to be applied
2. **Adherence to the Open/Closed Principle**: Adding new Leaf or Composite types does not require changing existing client code
3. **Natural expression of recursive structures**: Tree structures can be represented directly in the language's type system, and operations can be defined recursively in a natural way

---

## 2. Structure of Composite

### 2.1 Class Diagram

```
+------------------+
|   Component      |
|   (interface)    |
+------------------+
| + operation()    |
| + add(c)         |
| + remove(c)      |
| + getChild(i)    |
+------------------+
     ^          ^
     |          |
+--------+ +------------+
|  Leaf  | | Composite  |
+--------+ +------------+
|+operation| | -children[]|
+--------+ | +operation()|  -- delegates to children recursively
           | +add(c)     |
           | +remove(c)  |
           +------------+
```

### 2.2 Roles of Each Component

| Component | Role | Example (File System) |
|---------|------|---------------------|
| Component | Unified interface | FileSystemNode |
| Leaf | Terminal node with no children | File |
| Composite | Node with children; delegates operations to children | Directory |
| Client | Operates through Component | Application |

### 2.3 Illustration of Tree Structure

```
        Composite (root)
        /       \
   Composite    Leaf C
   /      \
Leaf A   Leaf B

Calling operation():
root.operation()
  +-- composite.operation()
  |     +-- leafA.operation()
  |     +-- leafB.operation()
  +-- leafC.operation()
```

### 2.4 Detailed Recursive Processing Flow

```
Call stack for getSize():

root.getSize()
  |
  +- components.getSize()
  |     +- Button.getSize() -> 3
  |     +- Modal.getSize()  -> 5
  |     return 3 + 5 = 8
  |
  +- index.getSize() -> 1
  |
  return 8 + 1 = 9

[Call stack depth]
depth 0: root.getSize()
depth 1: components.getSize(), index.getSize()
depth 2: Button.getSize(), Modal.getSize()

Time complexity:  O(N) — visits each node exactly once
Space complexity: O(D) — D is the maximum depth of the tree (recursion stack)
```

---

## 3. Code Examples

### Code Example 1: File System (TypeScript)

```typescript
// file-system.ts — Classic example of the Composite pattern
interface FileSystemNode {
  getName(): string;
  getSize(): number;
  print(indent?: string): void;
  find(predicate: (node: FileSystemNode) => boolean): FileSystemNode[];
}

class File implements FileSystemNode {
  constructor(
    private name: string,
    private size: number,
    private extension: string = ''
  ) {}

  getName(): string { return this.name; }
  getSize(): number { return this.size; }

  print(indent = ""): void {
    console.log(`${indent}${this.name} (${this.size}KB)`);
  }

  find(predicate: (node: FileSystemNode) => boolean): FileSystemNode[] {
    return predicate(this) ? [this] : [];
  }
}

class Directory implements FileSystemNode {
  private children: FileSystemNode[] = [];

  constructor(private name: string) {}

  add(node: FileSystemNode): this {
    this.children.push(node);
    return this;
  }

  remove(node: FileSystemNode): void {
    this.children = this.children.filter(c => c !== node);
  }

  getChildren(): readonly FileSystemNode[] {
    return this.children;
  }

  getName(): string { return this.name; }

  getSize(): number {
    return this.children.reduce((sum, c) => sum + c.getSize(), 0);
  }

  print(indent = ""): void {
    console.log(`${indent}${this.name}/`);
    this.children.forEach(c => c.print(indent + "  "));
  }

  find(predicate: (node: FileSystemNode) => boolean): FileSystemNode[] {
    const results: FileSystemNode[] = [];
    if (predicate(this)) results.push(this);
    for (const child of this.children) {
      results.push(...child.find(predicate));
    }
    return results;
  }
}

// --- Usage example ---
const root = new Directory("src");
const components = new Directory("components");
components.add(new File("Button.tsx", 3, "tsx"));
components.add(new File("Modal.tsx", 5, "tsx"));
const utils = new Directory("utils");
utils.add(new File("format.ts", 2, "ts"));
root.add(components);
root.add(utils);
root.add(new File("index.ts", 1, "ts"));

root.print();
// Output:
// src/
//   components/
//     Button.tsx (3KB)
//     Modal.tsx (5KB)
//   utils/
//     format.ts (2KB)
//   index.ts (1KB)

console.log(`Total size: ${root.getSize()}KB`); // 11

// Search for nodes matching a condition using find
const largeFiles = root.find(node => node.getSize() > 3);
console.log(largeFiles.map(f => f.getName()));
// ["components", "Modal.tsx"] — Directory is evaluated by its total size
```

### Code Example 2: UI Component Tree (TypeScript)

```typescript
// ui-component.ts — UI rendering tree
interface UIComponent {
  render(): string;
  getBoundingBox(): { width: number; height: number };
  findById(id: string): UIComponent | null;
}

class TextElement implements UIComponent {
  constructor(
    private id: string,
    private text: string,
    private fontSize: number = 16
  ) {}

  render(): string {
    return `<span id="${this.id}" style="font-size:${this.fontSize}px">${this.text}</span>`;
  }

  getBoundingBox() {
    return { width: this.text.length * (this.fontSize * 0.6), height: this.fontSize };
  }

  findById(id: string): UIComponent | null {
    return this.id === id ? this : null;
  }
}

class ImageElement implements UIComponent {
  constructor(
    private id: string,
    private src: string,
    private width: number,
    private height: number
  ) {}

  render(): string {
    return `<img id="${this.id}" src="${this.src}" width="${this.width}" height="${this.height}" />`;
  }

  getBoundingBox() {
    return { width: this.width, height: this.height };
  }

  findById(id: string): UIComponent | null {
    return this.id === id ? this : null;
  }
}

class Container implements UIComponent {
  private children: UIComponent[] = [];

  constructor(
    private id: string,
    private tag: string,
    private layout: 'vertical' | 'horizontal' = 'vertical'
  ) {}

  add(child: UIComponent): this {
    this.children.push(child);
    return this;
  }

  render(): string {
    const inner = this.children.map(c => c.render()).join("\n");
    return `<${this.tag} id="${this.id}">\n${inner}\n</${this.tag}>`;
  }

  getBoundingBox() {
    if (this.layout === 'horizontal') {
      const width = this.children.reduce((w, c) => w + c.getBoundingBox().width, 0);
      const height = Math.max(0, ...this.children.map(c => c.getBoundingBox().height));
      return { width, height };
    } else {
      const width = Math.max(0, ...this.children.map(c => c.getBoundingBox().width));
      const height = this.children.reduce((h, c) => h + c.getBoundingBox().height, 0);
      return { width, height };
    }
  }

  findById(id: string): UIComponent | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }
}

// --- Usage example ---
const page = new Container("page", "div")
  .add(new Container("header", "header", "horizontal")
    .add(new ImageElement("logo", "/logo.png", 100, 50))
    .add(new TextElement("title", "My App", 24))
  )
  .add(new Container("main", "main")
    .add(new TextElement("content", "Welcome to my application", 16))
    .add(new ImageElement("hero", "/hero.jpg", 800, 400))
  );

console.log(page.render());
console.log(page.getBoundingBox());

const logo = page.findById("logo");
console.log(logo !== null); // true
```

### Code Example 3: Price Calculation — Products and Bundles (TypeScript)

```typescript
// pricing.ts — Price calculation for bundled products in an e-commerce site
interface PriceItem {
  getPrice(): number;
  getDescription(): string;
  getItemCount(): number;
  toJSON(): object;
}

class Product implements PriceItem {
  constructor(
    private name: string,
    private price: number,
    private quantity: number = 1
  ) {}

  getPrice(): number { return this.price * this.quantity; }
  getDescription(): string { return `${this.name} x${this.quantity}`; }
  getItemCount(): number { return this.quantity; }

  toJSON(): object {
    return { type: 'product', name: this.name, price: this.price, quantity: this.quantity };
  }
}

class Bundle implements PriceItem {
  private items: PriceItem[] = [];

  constructor(
    private name: string,
    private discount: number = 0  // 0.0 ~ 1.0
  ) {}

  add(item: PriceItem): this {
    this.items.push(item);
    return this;
  }

  getPrice(): number {
    const total = this.items.reduce((s, i) => s + i.getPrice(), 0);
    return Math.round(total * (1 - this.discount));
  }

  getDescription(): string {
    const details = this.items.map(i => i.getDescription()).join(", ");
    const discountLabel = this.discount > 0 ? ` (${this.discount * 100}%OFF)` : '';
    return `${this.name}${discountLabel} [${details}]`;
  }

  getItemCount(): number {
    return this.items.reduce((count, i) => count + i.getItemCount(), 0);
  }

  toJSON(): object {
    return {
      type: 'bundle',
      name: this.name,
      discount: this.discount,
      items: this.items.map(i => i.toJSON()),
      totalPrice: this.getPrice()
    };
  }
}

// --- Usage example ---
const starterPack = new Bundle("Starter Pack", 0.1)
  .add(new Product("Mouse", 3000))
  .add(new Product("Keyboard", 8000))
  .add(new Bundle("Cable Set", 0)
    .add(new Product("USB-C Cable", 500))
    .add(new Product("HDMI Cable", 800)));

console.log(starterPack.getDescription());
// "Starter Pack (10%OFF) [Mouse x1, Keyboard x1, Cable Set [USB-C Cable x1, HDMI Cable x1]]"

console.log(starterPack.getPrice());
// (3000 + 8000 + 500 + 800) * 0.9 = 11070

console.log(starterPack.getItemCount()); // 4

console.log(JSON.stringify(starterPack.toJSON(), null, 2));
```

### Code Example 4: Python — Organizational Chart

```python
# organization.py — Composite pattern for organizational structure
from abc import ABC, abstractmethod
from typing import Iterator


class OrganizationUnit(ABC):
    """A unit of organization (Component)"""

    @abstractmethod
    def get_salary_cost(self) -> float:
        """Returns the total personnel cost"""
        ...

    @abstractmethod
    def get_headcount(self) -> int:
        """Returns the number of members"""
        ...

    @abstractmethod
    def print_structure(self, indent: int = 0) -> None:
        """Displays the organizational structure"""
        ...

    @abstractmethod
    def find_by_name(self, name: str) -> list["OrganizationUnit"]:
        """Searches by name"""
        ...


class Employee(OrganizationUnit):
    """Individual person (Leaf)"""

    def __init__(self, name: str, role: str, salary: float):
        self.name = name
        self.role = role
        self.salary = salary

    def get_salary_cost(self) -> float:
        return self.salary

    def get_headcount(self) -> int:
        return 1

    def print_structure(self, indent: int = 0) -> None:
        prefix = " " * indent
        print(f"{prefix}- {self.name} ({self.role}, {self.salary:,.0f})")

    def find_by_name(self, name: str) -> list["OrganizationUnit"]:
        return [self] if name.lower() in self.name.lower() else []


class Department(OrganizationUnit):
    """Department (Composite)"""

    def __init__(self, name: str):
        self.name = name
        self._members: list[OrganizationUnit] = []

    def add(self, unit: OrganizationUnit) -> "Department":
        self._members.append(unit)
        return self

    def remove(self, unit: OrganizationUnit) -> None:
        self._members.remove(unit)

    def get_salary_cost(self) -> float:
        return sum(m.get_salary_cost() for m in self._members)

    def get_headcount(self) -> int:
        return sum(m.get_headcount() for m in self._members)

    def print_structure(self, indent: int = 0) -> None:
        prefix = " " * indent
        cost = self.get_salary_cost()
        count = self.get_headcount()
        print(f"{prefix}[{self.name}] ({count} members, personnel cost: {cost:,.0f})")
        for m in self._members:
            m.print_structure(indent + 2)

    def find_by_name(self, name: str) -> list["OrganizationUnit"]:
        results: list[OrganizationUnit] = []
        if name.lower() in self.name.lower():
            results.append(self)
        for m in self._members:
            results.extend(m.find_by_name(name))
        return results

    def __iter__(self) -> Iterator[OrganizationUnit]:
        return iter(self._members)


# --- Usage example ---
eng = Department("Engineering")
eng.add(Employee("Alice", "Tech Lead", 800_000))
eng.add(Employee("Bob", "Senior Engineer", 700_000))
eng.add(Employee("Charlie", "Engineer", 550_000))

design = Department("Design")
design.add(Employee("Diana", "Design Lead", 750_000))
design.add(Employee("Eve", "Designer", 600_000))

product = Department("Product")
product.add(eng)
product.add(design)
product.add(Employee("Frank", "Product Manager", 850_000))

company = Department("Acme Corp")
company.add(product)
company.add(Employee("Grace", "CEO", 1_200_000))

company.print_structure()
# [Acme Corp] (7 members, personnel cost: 5,450,000)
#   [Product] (6 members, personnel cost: 4,250,000)
#     [Engineering] (3 members, personnel cost: 2,050,000)
#       - Alice (Tech Lead, 800,000)
#       - Bob (Senior Engineer, 700,000)
#       - Charlie (Engineer, 550,000)
#     [Design] (2 members, personnel cost: 1,350,000)
#       - Diana (Design Lead, 750,000)
#       - Eve (Designer, 600,000)
#     - Frank (Product Manager, 850,000)
#   - Grace (CEO, 1,200,000)

print(f"Total cost: {company.get_salary_cost():,.0f}")
# Total cost: 5,450,000

results = company.find_by_name("engineer")
for r in results:
    print(r.name if hasattr(r, 'name') else r.name)
# Engineering, Bob, Charlie
```

### Code Example 5: Conditional Expression Tree (Specification Pattern)

```typescript
// specification.ts — Composite + Specification pattern
interface Specification<T> {
  isSatisfiedBy(item: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
  toString(): string;
}

abstract class BaseSpec<T> implements Specification<T> {
  abstract isSatisfiedBy(item: T): boolean;
  abstract toString(): string;

  and(other: Specification<T>): Specification<T> {
    return new AndSpec([this, other]);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpec([this, other]);
  }

  not(): Specification<T> {
    return new NotSpec(this);
  }
}

class AndSpec<T> extends BaseSpec<T> {
  constructor(private specs: Specification<T>[]) { super(); }

  isSatisfiedBy(item: T): boolean {
    return this.specs.every(s => s.isSatisfiedBy(item));
  }

  toString(): string {
    return `(${this.specs.map(s => s.toString()).join(' AND ')})`;
  }
}

class OrSpec<T> extends BaseSpec<T> {
  constructor(private specs: Specification<T>[]) { super(); }

  isSatisfiedBy(item: T): boolean {
    return this.specs.some(s => s.isSatisfiedBy(item));
  }

  toString(): string {
    return `(${this.specs.map(s => s.toString()).join(' OR ')})`;
  }
}

class NotSpec<T> extends BaseSpec<T> {
  constructor(private spec: Specification<T>) { super(); }

  isSatisfiedBy(item: T): boolean {
    return !this.spec.isSatisfiedBy(item);
  }

  toString(): string {
    return `NOT(${this.spec.toString()})`;
  }
}

// --- Example Leaf Specifications ---
interface Product {
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  isNew: boolean;
}

class PriceBelow extends BaseSpec<Product> {
  constructor(private max: number) { super(); }
  isSatisfiedBy(item: Product): boolean { return item.price < this.max; }
  toString(): string { return `price < ${this.max}`; }
}

class InCategory extends BaseSpec<Product> {
  constructor(private category: string) { super(); }
  isSatisfiedBy(item: Product): boolean { return item.category === this.category; }
  toString(): string { return `category = "${this.category}"`; }
}

class InStock extends BaseSpec<Product> {
  isSatisfiedBy(item: Product): boolean { return item.inStock; }
  toString(): string { return `inStock`; }
}

class IsNew extends BaseSpec<Product> {
  isSatisfiedBy(item: Product): boolean { return item.isNew; }
  toString(): string { return `isNew`; }
}

// --- Usage example ---
// "affordable AND in stock" OR "new product"
const spec = new PriceBelow(1000)
  .and(new InStock())
  .or(new IsNew());

console.log(spec.toString());
// "((price < 1000 AND inStock) OR isNew)"

const products: Product[] = [
  { name: "A", price: 500, category: "food", inStock: true, isNew: false },
  { name: "B", price: 1500, category: "food", inStock: true, isNew: true },
  { name: "C", price: 800, category: "drink", inStock: false, isNew: false },
  { name: "D", price: 200, category: "drink", inStock: true, isNew: false },
];

const matching = products.filter(p => spec.isSatisfiedBy(p));
console.log(matching.map(p => p.name));
// ["A", "B", "D"]
// A: 500 < 1000 and in stock -> true
// B: new product -> true
// C: 800 < 1000 but not in stock, and not a new product -> false
// D: 200 < 1000 and in stock -> true
```

### Code Example 6: Expression Tree (AST)

```typescript
// expression.ts — Build an abstract syntax tree (AST) for mathematical expressions using Composite
interface Expression {
  evaluate(): number;
  toString(): string;
  simplify(): Expression;
}

// Leaf: literal value
class NumberLiteral implements Expression {
  constructor(private value: number) {}

  evaluate(): number { return this.value; }
  toString(): string { return String(this.value); }
  simplify(): Expression { return this; }
}

// Leaf: variable reference
class Variable implements Expression {
  constructor(
    private name: string,
    private env: Map<string, number>
  ) {}

  evaluate(): number {
    const val = this.env.get(this.name);
    if (val === undefined) throw new Error(`Undefined variable: ${this.name}`);
    return val;
  }

  toString(): string { return this.name; }
  simplify(): Expression { return this; }
}

// Composite: binary operation
class BinaryOp implements Expression {
  constructor(
    private op: '+' | '-' | '*' | '/',
    private left: Expression,
    private right: Expression
  ) {}

  evaluate(): number {
    const l = this.left.evaluate();
    const r = this.right.evaluate();
    switch (this.op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/':
        if (r === 0) throw new Error('Division by zero');
        return l / r;
    }
  }

  toString(): string {
    return `(${this.left.toString()} ${this.op} ${this.right.toString()})`;
  }

  simplify(): Expression {
    const left = this.left.simplify();
    const right = this.right.simplify();

    // Constant folding: if both sides are literals, replace with the computed result
    if (left instanceof NumberLiteral && right instanceof NumberLiteral) {
      return new NumberLiteral(
        new BinaryOp(this.op, left, right).evaluate()
      );
    }

    // Simplifications such as x + 0 = x, x * 1 = x
    if (this.op === '+' && right instanceof NumberLiteral && right.evaluate() === 0) {
      return left;
    }
    if (this.op === '*' && right instanceof NumberLiteral && right.evaluate() === 1) {
      return left;
    }
    if (this.op === '*' && right instanceof NumberLiteral && right.evaluate() === 0) {
      return new NumberLiteral(0);
    }

    return new BinaryOp(this.op, left, right);
  }
}

// Composite: function call
class FunctionCall implements Expression {
  constructor(
    private fnName: string,
    private args: Expression[]
  ) {}

  evaluate(): number {
    const argValues = this.args.map(a => a.evaluate());
    switch (this.fnName) {
      case 'max': return Math.max(...argValues);
      case 'min': return Math.min(...argValues);
      case 'abs': return Math.abs(argValues[0]);
      case 'sqrt': return Math.sqrt(argValues[0]);
      default: throw new Error(`Unknown function: ${this.fnName}`);
    }
  }

  toString(): string {
    return `${this.fnName}(${this.args.map(a => a.toString()).join(', ')})`;
  }

  simplify(): Expression {
    const simplified = this.args.map(a => a.simplify());
    return new FunctionCall(this.fnName, simplified);
  }
}

// --- Usage example: (x + 3) * max(y, 5) ---
const env = new Map<string, number>([["x", 7], ["y", 2]]);

const expr = new BinaryOp('*',
  new BinaryOp('+', new Variable('x', env), new NumberLiteral(3)),
  new FunctionCall('max', [new Variable('y', env), new NumberLiteral(5)])
);

console.log(expr.toString());
// "((x + 3) * max(y, 5))"

console.log(expr.evaluate());
// (7 + 3) * max(2, 5) = 10 * 5 = 50

// Test simplification
const simpleExpr = new BinaryOp('+',
  new BinaryOp('*', new NumberLiteral(2), new NumberLiteral(3)),
  new NumberLiteral(0)
);
console.log(simpleExpr.simplify().toString());
// "6" — constant folding + removal of + 0
```

### Code Example 7: Menu Structure

```typescript
// menu.ts — Restaurant menu (Composite pattern)
interface MenuItem {
  getName(): string;
  getPrice(): number | null; // categories have no price
  isVegetarian(): boolean;
  print(indent?: string): void;
}

class Dish implements MenuItem {
  constructor(
    private name: string,
    private price: number,
    private vegetarian: boolean,
    private description: string
  ) {}

  getName(): string { return this.name; }
  getPrice(): number { return this.price; }
  isVegetarian(): boolean { return this.vegetarian; }

  print(indent = ""): void {
    const veg = this.vegetarian ? " [V]" : "";
    console.log(`${indent}${this.name}${veg} - $${this.price}`);
    console.log(`${indent}  ${this.description}`);
  }
}

class MenuCategory implements MenuItem {
  private items: MenuItem[] = [];

  constructor(private name: string, private description: string = "") {}

  add(item: MenuItem): this {
    this.items.push(item);
    return this;
  }

  getName(): string { return this.name; }

  getPrice(): null {
    return null; // the category itself has no price
  }

  isVegetarian(): boolean {
    return this.items.every(item => item.isVegetarian());
  }

  getVegetarianItems(): MenuItem[] {
    return this.items.filter(item => item.isVegetarian());
  }

  print(indent = ""): void {
    console.log(`${indent}=== ${this.name} ===`);
    if (this.description) {
      console.log(`${indent}${this.description}`);
    }
    this.items.forEach(item => item.print(indent + "  "));
  }
}

// --- Usage example ---
const menu = new MenuCategory("Grand Menu")
  .add(new MenuCategory("Appetizers")
    .add(new Dish("Caesar Salad", 850, true, "Romaine lettuce, Parmesan"))
    .add(new Dish("Bruschetta", 600, true, "Tomato, basil, olive oil"))
    .add(new Dish("Carpaccio", 1200, false, "Thinly sliced beef tenderloin"))
  )
  .add(new MenuCategory("Main Courses")
    .add(new Dish("Margherita Pizza", 1400, true, "Mozzarella, basil"))
    .add(new Dish("Grilled Salmon", 1800, false, "Norwegian salmon"))
  );

menu.print();
// === Grand Menu ===
//   === Appetizers ===
//     Caesar Salad [V] - $850
//       Romaine lettuce, Parmesan
//     Bruschetta [V] - $600
//       Tomato, basil, olive oil
//     Carpaccio - $1200
//       Thinly sliced beef tenderloin
//   === Main Courses ===
//     Margherita Pizza [V] - $1400
//       Mozzarella, basil
//     Grilled Salmon - $1800
//       Norwegian salmon
```

---

## 4. Transparent Design vs. Safe Design: A Deep Dive

The most important tradeoff in designing the Composite pattern is the choice between "Transparency" and "Safety".

### 4.1 Transparent Design (Proposed in the Original GoF Book)

```typescript
// Transparent design: add/remove defined on Component
interface Component {
  operation(): void;
  add(child: Component): void;    // also exists on Leaf
  remove(child: Component): void; // also exists on Leaf
  getChild(index: number): Component | null;
}

class Leaf implements Component {
  operation(): void { /* ... */ }

  // Throws an exception on Leaf
  add(child: Component): void {
    throw new Error("Leaf cannot have children");
  }

  remove(child: Component): void {
    throw new Error("Leaf cannot have children");
  }

  getChild(index: number): Component | null {
    return null;
  }
}
```

**Advantage**: The client only needs to work with the Component type. No need to determine whether something is a Leaf or Composite.
**Disadvantage**: Calling add() on a Leaf causes a runtime error. Type safety is low.

### 4.2 Safe Design (Modern Recommendation)

```typescript
// Safe design: add/remove defined only on Composite
interface Component {
  operation(): void;
}

// Utility to check whether a Component is a Composite
function isComposite(c: Component): c is Composite {
  return 'add' in c && typeof (c as any).add === 'function';
}

class Leaf implements Component {
  operation(): void { /* ... */ }
  // add/remove do not exist
}

class Composite implements Component {
  private children: Component[] = [];

  operation(): void {
    this.children.forEach(c => c.operation());
  }

  add(child: Component): void {
    this.children.push(child);
  }

  remove(child: Component): void {
    this.children = this.children.filter(c => c !== child);
  }
}
```

**Advantage**: Type safe. Calling add() on a Leaf is detected at compile time.
**Disadvantage**: A downcast or type guard is required to use Composite-specific operations.

### 4.3 Comparison Table

```
Decision flow for Transparent Design vs. Safe Design:

             Does the client frequently use add/remove?
                    /              \
                  Yes               No
                  /                   \
         Consider transparent design    Adopt safe design
                |
    Is type safety important?
          /        \
        Yes         No
        /             \
   Adopt safe design   Adopt transparent design
```

| Approach | add/remove on Leaf | Type Safety | Transparency | Compile-time Detection |
|------|:---:|:---:|:---:|:---:|
| Transparent Design | Yes (throws exception) | Low | High | Not possible |
| Safe Design | No (Composite only) | High | Low | Possible |
| Recommended | - | **Safe Design** | - | - |

---

## 5. Implementing Circular Reference Prevention

The most dangerous problem with the Composite pattern is circular references. Below is an implementation of robust circular reference checking.

```typescript
// safe-composite.ts — Composite with circular reference prevention
interface SafeComponent {
  getName(): string;
  getSize(): number;
  isAncestorOf(node: SafeComponent): boolean;
}

class SafeComposite implements SafeComponent {
  private children: SafeComponent[] = [];
  private parent: SafeComposite | null = null;

  constructor(private name: string) {}

  getName(): string { return this.name; }

  getSize(): number {
    return this.children.reduce((sum, c) => sum + c.getSize(), 0);
  }

  add(child: SafeComponent): this {
    // Circular reference check
    if (child === this) {
      throw new Error(`Cannot add "${this.name}" to itself`);
    }

    if (child instanceof SafeComposite) {
      if (child.isAncestorOf(this)) {
        throw new Error(
          `Cannot add "${child.name}": it is an ancestor of "${this.name}"`
        );
      }
      // Detach from existing parent
      if (child.parent) {
        child.parent.remove(child);
      }
      child.parent = this;
    }

    this.children.push(child);
    return this;
  }

  remove(child: SafeComponent): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      if (child instanceof SafeComposite) {
        child.parent = null;
      }
    }
  }

  isAncestorOf(node: SafeComponent): boolean {
    for (const child of this.children) {
      if (child === node) return true;
      if (child instanceof SafeComposite && child.isAncestorOf(node)) {
        return true;
      }
    }
    return false;
  }

  getPath(): string[] {
    const path: string[] = [];
    let current: SafeComposite | null = this;
    while (current) {
      path.unshift(current.name);
      current = current.parent;
    }
    return path;
  }
}

// --- Usage example: detecting circular references ---
const a = new SafeComposite("A");
const b = new SafeComposite("B");
const c = new SafeComposite("C");

a.add(b);
b.add(c);

try {
  c.add(a); // Error: Cannot add "A": it is an ancestor of "C"
} catch (e) {
  console.log((e as Error).message);
}

try {
  a.add(a); // Error: Cannot add "A" to itself
} catch (e) {
  console.log((e as Error).message);
}

console.log(c.getPath()); // ["A", "B", "C"]
```

---

## 6. Performance Optimization: Caching Strategy

When aggregation operations (getSize(), getCount(), etc.) are called frequently on deep tree structures, computing them recursively each time can become a performance bottleneck. Below is a method for optimizing with caching.

```typescript
// cached-composite.ts — Composite with caching
interface CachedComponent {
  getName(): string;
  getSize(): number;
  invalidateCache(): void;
}

class CachedDirectory implements CachedComponent {
  private children: CachedComponent[] = [];
  private sizeCache: number | null = null;

  constructor(private name: string) {}

  getName(): string { return this.name; }

  add(child: CachedComponent): this {
    this.children.push(child);
    this.invalidateCache(); // Invalidate cache
    return this;
  }

  remove(child: CachedComponent): void {
    this.children = this.children.filter(c => c !== child);
    this.invalidateCache();
  }

  getSize(): number {
    if (this.sizeCache === null) {
      this.sizeCache = this.children.reduce((sum, c) => sum + c.getSize(), 0);
    }
    return this.sizeCache;
  }

  invalidateCache(): void {
    this.sizeCache = null;
    // The parent's cache also needs to be invalidated
    // (when a reference to the parent is held)
  }
}

// --- Performance comparison ---
// Without cache: calling getSize() N times costs O(N * M) — M is the number of nodes
// With cache: O(M) on first call, O(1) thereafter, O(D) on change — D is the depth
```

```
Cache invalidation propagation:

  Changed node       propagates to parent    propagates to root
       [D]  --------> [B]  -------> [root]
       cache=null      cache=null     cache=null

  When root.getSize() is called next:
  root -> recomputes B -> recomputes D
  root -> C has not changed, so it is returned from cache as-is (incremental update)
```

---

## 7. Combining Composite Pattern with Visitor Pattern

Using Composite to represent structure and Visitor to add operations is a powerful combination also recommended by GoF.

```typescript
// visitor.ts — Composite + Visitor pattern
interface FileSystemVisitor {
  visitFile(file: VisitableFile): void;
  visitDirectory(dir: VisitableDirectory): void;
}

interface VisitableNode {
  accept(visitor: FileSystemVisitor): void;
}

class VisitableFile implements VisitableNode {
  constructor(
    public readonly name: string,
    public readonly size: number,
    public readonly extension: string
  ) {}

  accept(visitor: FileSystemVisitor): void {
    visitor.visitFile(this);
  }
}

class VisitableDirectory implements VisitableNode {
  public readonly children: VisitableNode[] = [];

  constructor(public readonly name: string) {}

  add(child: VisitableNode): this {
    this.children.push(child);
    return this;
  }

  accept(visitor: FileSystemVisitor): void {
    visitor.visitDirectory(this);
    this.children.forEach(c => c.accept(visitor));
  }
}

// --- Operation 1: Aggregate file sizes ---
class SizeCalculator implements FileSystemVisitor {
  totalSize = 0;

  visitFile(file: VisitableFile): void {
    this.totalSize += file.size;
  }

  visitDirectory(_dir: VisitableDirectory): void {
    // The directory itself has no size
  }
}

// --- Operation 2: List files grouped by extension ---
class ExtensionGrouper implements FileSystemVisitor {
  groups = new Map<string, string[]>();

  visitFile(file: VisitableFile): void {
    if (!this.groups.has(file.extension)) {
      this.groups.set(file.extension, []);
    }
    this.groups.get(file.extension)!.push(file.name);
  }

  visitDirectory(_dir: VisitableDirectory): void {}
}

// --- Operation 3: Detect large files ---
class LargeFileFinder implements FileSystemVisitor {
  largeFiles: { name: string; size: number }[] = [];

  constructor(private threshold: number) {}

  visitFile(file: VisitableFile): void {
    if (file.size > this.threshold) {
      this.largeFiles.push({ name: file.name, size: file.size });
    }
  }

  visitDirectory(_dir: VisitableDirectory): void {}
}

// --- Usage example ---
const root = new VisitableDirectory("project")
  .add(new VisitableDirectory("src")
    .add(new VisitableFile("app.ts", 10, "ts"))
    .add(new VisitableFile("style.css", 50, "css")))
  .add(new VisitableFile("README.md", 3, "md"));

// Operation 1: Aggregate sizes
const calc = new SizeCalculator();
root.accept(calc);
console.log(`Total: ${calc.totalSize}KB`); // 63

// Operation 2: Group by extension
const grouper = new ExtensionGrouper();
root.accept(grouper);
console.log(grouper.groups);
// Map { 'ts' => ['app.ts'], 'css' => ['style.css'], 'md' => ['README.md'] }

// Operation 3: Find large files
const finder = new LargeFileFinder(5);
root.accept(finder);
console.log(finder.largeFiles);
// [{ name: 'app.ts', size: 10 }, { name: 'style.css', size: 50 }]
```

**Benefits of combining with Visitor**:
- New operations can be added without modifying the tree structure classes
- Satisfies the Single Responsibility Principle (separation of structure and operations)
- Multiple operations can be independently defined for the same tree

---

## 8. Composite Pattern in the Real World

### 8.1 React's Virtual DOM

React's component tree is a classic example of the Composite pattern.

```
ReactElement tree:
  <App>                    ← Composite
    <Header>               ← Composite
      <Logo />             ← Leaf
      <Nav>                ← Composite
        <NavItem />        ← Leaf
        <NavItem />        ← Leaf
      </Nav>
    </Header>
    <Main>                 ← Composite
      <Article />          ← Leaf
    </Main>
  </App>

Recursive calls to render():
  App.render()
    -> Header.render()
      -> Logo.render()
      -> Nav.render()
        -> NavItem.render()
        -> NavItem.render()
    -> Main.render()
      -> Article.render()
```

### 8.2 DOM API

The browser's DOM itself is the Composite pattern.

```
Node (Component)
  +-- Text (Leaf)
  +-- Comment (Leaf)
  +-- Element (Composite)
       +-- children: Node[]
       +-- appendChild()
       +-- removeChild()
       +-- textContent    ← retrieved recursively
       +-- innerHTML      ← retrieved recursively
```

### 8.3 JSON Parser

JSON values have a Composite structure.

```
JsonValue (Component)
  +-- JsonString (Leaf)     "hello"
  +-- JsonNumber (Leaf)     42
  +-- JsonBoolean (Leaf)    true
  +-- JsonNull (Leaf)       null
  +-- JsonArray (Composite) [1, "a", [2]]
  +-- JsonObject (Composite) {"key": "value"}
```

---

## 9. Comparison Tables

### Comparison Table 1: Composite vs. Ordinary Collections

| Aspect | Composite | Array/List |
|------|:---:|:---:|
| Nesting | Recursive (tree) | Flat |
| Unified interface | Yes | No |
| Operation delegation | Automatic (recursion) | Manual loop |
| Type safety | High | Requires casting |
| Use case | Hierarchical structures | Uniform collections |
| Flexibility | High (arbitrary depth) | Fixed (1 level) |
| Implementation cost | Medium | Low |

### Comparison Table 2: Transparent Design vs. Safe Design

| Approach | add/remove on Leaf | Type Safety | Transparency | Runtime Error Risk |
|------|:---:|:---:|:---:|:---:|
| Transparent Design | Yes (throws exception) | Low | High | High |
| Safe Design | No (Composite only) | High | Low | Low |
| Hybrid | Optional methods | Medium | Medium | Medium |
| Recommended | - | **Safe Design** | - | - |

### Comparison Table 3: Comparison with Related Patterns

| Pattern | Purpose | Structure | Recursive | Typical Example |
|---------|------|------|:---:|-------|
| **Composite** | Uniform operations on part-whole | Tree | Yes | File system |
| **Decorator** | Dynamic feature addition | Chain | Possible | Streams |
| **Chain of Responsibility** | Chain of processing delegation | List | No | Middleware |
| **Iterator** | Abstraction of traversal | - | No | Collections |
| **Visitor** | Separation of structure and operations | - | Yes | AST processing |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Allowing Circular References

```typescript
// NG: no circular reference prevention
class BadComposite {
  private children: BadComposite[] = [];

  add(child: BadComposite): void {
    this.children.push(child); // can add itself as a child!
  }

  getSize(): number {
    let size = 1;
    for (const child of this.children) {
      size += child.getSize(); // stack overflow if circular reference exists
    }
    return size;
  }
}

const a = new BadComposite();
const b = new BadComposite();
a.add(b);
b.add(a); // circular reference!
// a.getSize() -> b.getSize() -> a.getSize() -> ... stack overflow

// OK: with circular reference check
class GoodComposite {
  private children: GoodComposite[] = [];
  private parent: GoodComposite | null = null;

  add(child: GoodComposite): void {
    // Check for self-reference
    if (child === this) {
      throw new Error("Cannot add self as child");
    }

    // Ancestor check (ensure child is not an ancestor of this node)
    let current: GoodComposite | null = this;
    while (current !== null) {
      if (current === child) {
        throw new Error("Circular reference detected");
      }
      current = current.parent;
    }

    // Detach from existing parent
    if (child.parent) {
      child.parent.children = child.parent.children.filter(c => c !== child);
    }

    child.parent = this;
    this.children.push(child);
  }

  getSize(): number {
    let size = 1;
    for (const child of this.children) {
      size += child.getSize();
    }
    return size;
  }
}
```

### Anti-Pattern 2: Composite Depending on Leaf-Specific Logic

```typescript
// NG: Composite knows about the concrete types of its children
class BadDirectory {
  private children: FileSystemNode[] = [];

  getSize(): number {
    return this.children.reduce((sum, c) => {
      if (c instanceof File) {        // type check!
        return sum + c.getRawSize();   // calling a Leaf-specific method
      }
      if (c instanceof Directory) {
        return sum + c.getSize();
      }
      return sum; // will miss new types
    }, 0);
  }
}

// OK: unified through the Component interface's getSize()
class GoodDirectory {
  private children: FileSystemNode[] = [];

  getSize(): number {
    // no type checks, delegating to the interface
    return this.children.reduce((sum, c) => sum + c.getSize(), 0);
  }
}
```

### Anti-Pattern 3: Applying Composite Pattern Unnecessarily

```typescript
// NG: applying Composite to a flat list (over-engineering)
interface Task {
  getName(): string;
  getDuration(): number;
}

class SimpleTask implements Task {
  constructor(private name: string, private duration: number) {}
  getName(): string { return this.name; }
  getDuration(): number { return this.duration; }
}

class TaskGroup implements Task {
  private tasks: Task[] = [];
  constructor(private name: string) {}
  add(task: Task): void { this.tasks.push(task); }
  getName(): string { return this.name; }
  getDuration(): number {
    return this.tasks.reduce((sum, t) => sum + t.getDuration(), 0);
  }
}

// If nesting is not needed, a simple array is sufficient:
// const tasks: SimpleTask[] = [...];
// const total = tasks.reduce((sum, t) => sum + t.getDuration(), 0);

// OK: use Composite only when a tree structure is actually needed
// Decision criterion: can the nesting depth be 2 or more?
```

---

## 11. Practice Exercises

### Exercise 1: Basic — Implementing a File System

**Task**: Implement a file system that satisfies the following requirements using the Composite pattern.

1. Define `getName()`, `getSize()`, and `print()` methods on the `FileSystemNode` interface
2. `File` class (Leaf): holds name, size, and extension
3. `Directory` class (Composite): holds child nodes, calculates size recursively
4. Add a `toString()` method that returns a string representation of the tree

**Test case**:

```typescript
const root = new Directory("project");
const src = new Directory("src");
src.add(new File("main.ts", 15, "ts"));
src.add(new File("utils.ts", 8, "ts"));
const tests = new Directory("tests");
tests.add(new File("main.test.ts", 10, "ts"));
root.add(src);
root.add(tests);
root.add(new File("package.json", 2, "json"));

console.log(root.getSize()); // 35
root.print();
```

**Expected output**:

```
project/
  src/
    main.ts (15KB)
    utils.ts (8KB)
  tests/
    main.test.ts (10KB)
  package.json (2KB)
```

---

### Exercise 2: Applied — Permission Management Tree

**Task**: Implement an organizational permission management system using the Composite pattern.

Requirements:
1. `Permission` interface: `hasPermission(action: string): boolean`
2. `Role` class (Leaf): holds a specific set of permissions
3. `RoleGroup` class (Composite): hierarchically combines multiple roles
4. Returns `true` if any child has the permission (OR combination)
5. `getAllPermissions(): string[]` method to retrieve a list of all permissions

**Test case**:

```typescript
const reader = new Role("reader", ["read", "list"]);
const writer = new Role("writer", ["write", "update"]);
const admin = new Role("admin", ["delete", "manage"]);

const editor = new RoleGroup("editor");
editor.add(reader);
editor.add(writer);

const superAdmin = new RoleGroup("superAdmin");
superAdmin.add(editor);
superAdmin.add(admin);

console.log(editor.hasPermission("read"));     // true
console.log(editor.hasPermission("delete"));   // false
console.log(superAdmin.hasPermission("delete")); // true
console.log(superAdmin.getAllPermissions());
// ["read", "list", "write", "update", "delete", "manage"]
```

**Expected output**: As shown in the comments above.

---

### Exercise 3: Advanced — Expression Evaluator with Visitor

**Task**: Combine the Composite pattern with the Visitor pattern to build an abstract syntax tree (AST) for mathematical expressions and implement an evaluator that can apply multiple operations.

Requirements:
1. `Expression` interface (Component): `accept(visitor)` method
2. `NumberLiteral`, `Variable` (Leaf)
3. `BinaryOp`, `UnaryOp` (Composite)
4. Visitor 1: `Evaluator` — evaluates the expression and returns a number
5. Visitor 2: `PrettyPrinter` — formats the expression as a string
6. Visitor 3: `Simplifier` — simplifies the expression (removes addition of 0, multiplication by 1, etc.)

**Test case**:

```typescript
// Expression: (x + 0) * (1 * y)  →  after simplification: x * y
const env = new Map([["x", 3], ["y", 7]]);

const expr = new BinaryOp('*',
  new BinaryOp('+', new Variable('x'), new NumberLiteral(0)),
  new BinaryOp('*', new NumberLiteral(1), new Variable('y'))
);

const evaluator = new Evaluator(env);
expr.accept(evaluator);
console.log(evaluator.getResult()); // 21

const printer = new PrettyPrinter();
expr.accept(printer);
console.log(printer.getResult()); // "((x + 0) * (1 * y))"

const simplifier = new Simplifier();
expr.accept(simplifier);
const simplified = simplifier.getResult();
const printer2 = new PrettyPrinter();
simplified.accept(printer2);
console.log(printer2.getResult()); // "(x * y)"
```

**Expected output**: As shown in the comments above.

---

## 12. FAQ

### Q1: Is React's virtual DOM the Composite pattern?

Yes. React's component tree is a classic example of the Composite pattern. Each component has a `render()` method and recursively delegates processing to child components. The JSX syntax `<Parent><Child /></Parent>` is equivalent to Composite's add(). React 18's Suspense and Server Components are also built on top of this tree structure.

### Q2: Can the Visitor pattern be combined with Composite?

Yes. Using Composite to represent the tree structure and Visitor to add operations is a combination recommended by GoF. It eliminates the need to modify tree classes when adding new operations. However, if node types in the tree are frequently added, the Visitor's `visit` methods also need to be added, so consider the direction of change when making your choice.

### Q3: Can deep nesting cause performance problems?

When the recursion depth exceeds several hundred levels, there is a risk of stack overflow. Countermeasures include:
1. **Iterative traversal**: Convert recursion to a loop using an explicit stack
2. **Tail call optimization**: When the language supports it (e.g., Scala's `@tailrec`)
3. **Lazy evaluation**: Expand only the necessary nodes
4. **Caching**: Cache aggregation results to avoid recomputation

### Q4: Should the order of child nodes be guaranteed in the Composite pattern?

It depends on the use case. For file systems, sorting by name is common. For UI trees, layout order (rendering order) is important. For expression ASTs, left and right operands of operators carry meaning. In general, choose between a sorted collection (`SortedSet`) or an ordered list (`ArrayList`) according to the use case.

### Q5: What is the difference between Composite and Decorator?

Although the structures are similar, the intent differs. Composite uses a tree structure to represent "part-whole" relationships and delegates operations to a collection of children. Decorator uses a chain structure to dynamically add functionality to a single object. Composite is a "one-to-many" relationship, while Decorator is "one-to-one".

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not only through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in real-world development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Point |
|------|---------|
| Purpose | Operate on tree structures through a unified interface |
| Components | Component (unified IF), Leaf (terminal), Composite (collection) |
| Recursion | Composite delegates operations to children and aggregates results |
| Typical Examples | File system, UI tree, org chart, expression AST |
| Transparent vs. Safe | Modern practice recommends safe design (add/remove on Composite only) |
| Circular References | Prevented via parent reference and ancestor checks |
| Performance | Cache recursive aggregations for optimization |
| With Visitor | Powerful combination for adding operations without changing structure |

---

## Further Reading

- [Iterator Pattern](../02-behavioral/04-iterator.md) -- Abstracting tree traversal
- [Decorator Pattern](./01-decorator.md) -- Dynamic feature addition
- [Visitor Pattern](../02-behavioral/) -- Combining with Composite
- [Composition Over Inheritance](../../../clean-code-principles/docs/03-practices-advanced/01-composition-over-inheritance.md) -- Why to prefer composition over inheritance
- [SOLID Principles](../../../clean-code-principles/docs/00-principles/01-solid.md) -- Open/Closed Principle

---

## References

1. Gamma, E., Helm, R., Johnson, R., Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. -- The original source of the Composite pattern. Provides detailed coverage of the tradeoff between transparent and safe design.
2. Freeman, E., Robson, E. (2020). *Head First Design Patterns* (2nd Edition). O'Reilly Media. -- Learn the Composite pattern visually.
3. Refactoring.Guru -- Composite. https://refactoring.guru/design-patterns/composite -- Diagrams and implementation examples in multiple languages.
4. Martin, R.C. (2008). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall. -- The relationship between SOLID principles and Composite.
5. React Documentation -- Composition vs Inheritance. https://react.dev/learn/thinking-in-react -- The concept of component composition in React.
