# Command Pattern

> A behavioral pattern that encapsulates operations as objects, enabling Undo/Redo, queuing, macro recording, and transaction control

---

## What You Will Learn in This Chapter

1. **Basic structure and GoF intent of the Command pattern** -- encapsulating operations as command objects, mechanisms for deferred execution, recording, and replay
2. **Designing and implementing Undo/Redo** -- design techniques for managing command history to enable operation reversal and redo, and how they work internally
3. **Macros, queuing, and transactions** -- composing multiple commands, asynchronous execution queues, and transactional execution with rollback
4. **Command in real products** -- practical applications such as text editors, Redux, CQRS/Event Sourcing, and game replays
5. **Integration with functional approaches** -- closure-based Commands, type-safe Command buses in TypeScript

---

## Prerequisites

| Topic | Required Understanding | Reference Link |
|---------|-----------|-----------|
| TypeScript interfaces and classes | Defining and implementing interfaces, basics of generics | 02-programming |
| SOLID principles (especially SRP and OCP) | Understanding single responsibility and open/closed principles | clean-code-principles |
| Observer pattern | Basic concepts of event-driven design | [00-observer.md](./00-observer.md) |
| Strategy pattern | Switching algorithms | [01-strategy.md](./01-strategy.md) |
| Promise / async-await | Basics of asynchronous processing | 02-programming |

---

## Why the Command Pattern Is Needed

### Problems with Direct Invocation

Consider a UI where clicking a button triggers a "save" operation.

```
Problems with direct invocation:

  ┌──────────┐     ┌──────────────┐
  │ Button   │────►│ Document     │
  │ onClick()│     │ save()       │
  └──────────┘     └──────────────┘

  Problem 1: Button directly knows about Document (tight coupling)
  Problem 2: Want the same operation triggered by keyboard shortcuts too
  Problem 3: Want to Undo, but how?
  Problem 4: Want to record and replay operations, but no mechanism exists
```

### Solution with the Command Pattern

```
Command pattern solution:

  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │ Button   │────►│  SaveCommand │────►│  Document    │
  │(Invoker) │     │  execute()   │     │  (Receiver)  │
  └──────────┘     │  undo()      │     └──────────────┘
                   │  describe()  │
  ┌──────────┐     └──────────────┘
  │Shortcut  │────►│ (same Command) │
  │ Ctrl+S   │
  └──────────┘

  Benefits:
  ✓ Invoker only knows about Command (loose coupling)
  ✓ The same Command can be used from multiple Invokers
  ✓ undo() allows reversing operations
  ✓ Command history maintains an operation log
  ✓ Commands can be serialized and persisted
```

GoF definition:

> "Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations."
>
> -- Design Patterns: Elements of Reusable Object-Oriented Software (1994)

The essence of the Command pattern is **"making operations first-class objects"**. When operations become objects, they can be assigned to variables, stored in arrays, passed as arguments, serialized and saved, and sent over a network. This resonates with the concept of "functions as first-class citizens" in functional programming.

---

## 1. Structure of the Command Pattern

```
Command pattern components (GoF):

  ┌──────────────┐
  │    Client    │  Creates commands and sets the Receiver
  └──────┬───────┘
         │ creates
         ▼
  ┌──────────────┐     ┌──────────────────────┐
  │   Invoker    │────►│   Command (interface) │
  │              │     │                       │
  │ + setCommand │     │ + execute(): void     │
  │ + invoke()   │     │ + undo(): void        │
  │              │     │ + describe(): string  │
  └──────────────┘     └───────────┬───────────┘
         │                         │
         │                    ┌────┴─────┐
         │              ┌─────┴────┐ ┌───┴──────────┐
         │              │ConcreteA │ │ ConcreteB    │
         │              │Command   │ │ Command      │
         │              │          │ │              │
         │              │-receiver │ │ -receiver    │
         │              │+execute()│ │ +execute()   │
         │              │+undo()   │ │ +undo()      │
         │              └────┬─────┘ └──────┬───────┘
         │                   │              │
         │                   ▼              ▼
         │              ┌──────────────────────┐
         │              │     Receiver         │
         │              │ (actual business logic) │
         │              │                      │
         │              │ + action1()          │
         │              │ + action2()          │
         └─────────────►│                      │
           not called directly └──────────────────────┘

  ┌──────────────┐
  │   History    │  Manages command history
  │              │  Undo/Redo stacks
  │ + push(cmd)  │
  │ + undo()     │
  │ + redo()     │
  └──────────────┘

Roles:
  Client   : Creates ConcreteCommand and injects Receiver
  Invoker  : Calls execute() on Command (does not know what it does)
  Command  : Defines the execute/undo interface
  Receiver : Holds the actual business logic
  History  : Maintains history of executed commands (for Undo/Redo)
```

---

## 2. Basic Implementation -- Text Editor

### Code Example 1: Complete Text Editor Command

```typescript
// command.ts -- Basic structure of the Command pattern

// ============================
// Command interface
// ============================
interface Command {
  execute(): void;
  undo(): void;
  describe(): string;
  /** Flag indicating whether this operation can be undone */
  readonly isUndoable: boolean;
}

// ============================
// Receiver: Text editor
// ============================
class TextEditor {
  private content: string = '';
  private cursorPosition: number = 0;
  private selectionStart: number = -1;
  private selectionEnd: number = -1;

  getContent(): string {
    return this.content;
  }

  getCursorPosition(): number {
    return this.cursorPosition;
  }

  setCursorPosition(pos: number): void {
    this.cursorPosition = Math.max(0, Math.min(pos, this.content.length));
  }

  setSelection(start: number, end: number): void {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  getSelection(): { start: number; end: number } | null {
    if (this.selectionStart < 0) return null;
    return { start: this.selectionStart, end: this.selectionEnd };
  }

  clearSelection(): void {
    this.selectionStart = -1;
    this.selectionEnd = -1;
  }

  insertAt(position: number, text: string): void {
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position);
    this.cursorPosition = position + text.length;
  }

  deleteRange(start: number, end: number): string {
    const deleted = this.content.slice(start, end);
    this.content = this.content.slice(0, start) + this.content.slice(end);
    this.cursorPosition = start;
    return deleted;
  }

  replaceRange(start: number, end: number, newText: string): string {
    const deleted = this.content.slice(start, end);
    this.content =
      this.content.slice(0, start) + newText + this.content.slice(end);
    this.cursorPosition = start + newText.length;
    return deleted;
  }

  getLength(): number {
    return this.content.length;
  }
}

// ============================
// Concrete Command: Insert text
// ============================
class InsertTextCommand implements Command {
  readonly isUndoable = true;

  constructor(
    private editor: TextEditor,
    private position: number,
    private text: string
  ) {}

  execute(): void {
    this.editor.insertAt(this.position, this.text);
  }

  undo(): void {
    this.editor.deleteRange(this.position, this.position + this.text.length);
  }

  describe(): string {
    return `Insert "${this.text}" at position ${this.position}`;
  }
}

// ============================
// Concrete Command: Delete text
// ============================
class DeleteTextCommand implements Command {
  readonly isUndoable = true;
  private deletedText: string = '';

  constructor(
    private editor: TextEditor,
    private start: number,
    private end: number
  ) {}

  execute(): void {
    this.deletedText = this.editor.deleteRange(this.start, this.end);
  }

  undo(): void {
    this.editor.insertAt(this.start, this.deletedText);
  }

  describe(): string {
    return `Delete "${this.deletedText}" from ${this.start} to ${this.end}`;
  }
}

// ============================
// Concrete Command: Replace text
// ============================
class ReplaceTextCommand implements Command {
  readonly isUndoable = true;
  private originalText: string = '';

  constructor(
    private editor: TextEditor,
    private start: number,
    private end: number,
    private newText: string
  ) {}

  execute(): void {
    this.originalText = this.editor.replaceRange(
      this.start, this.end, this.newText
    );
  }

  undo(): void {
    this.editor.replaceRange(
      this.start, this.start + this.newText.length, this.originalText
    );
  }

  describe(): string {
    return `Replace "${this.originalText}" with "${this.newText}"`;
  }
}

// ============================
// Usage example
// ============================
const editor = new TextEditor();

const cmd1 = new InsertTextCommand(editor, 0, 'Hello');
cmd1.execute();
console.log(editor.getContent()); // "Hello"

const cmd2 = new InsertTextCommand(editor, 5, ' World');
cmd2.execute();
console.log(editor.getContent()); // "Hello World"

const cmd3 = new ReplaceTextCommand(editor, 0, 5, 'Hi');
cmd3.execute();
console.log(editor.getContent()); // "Hi World"

cmd3.undo();
console.log(editor.getContent()); // "Hello World"

cmd2.undo();
console.log(editor.getContent()); // "Hello"
```

---

## 3. Undo/Redo Manager

### Code Example 2: Full-Featured Undo/Redo Manager

```typescript
// undo-redo-manager.ts -- Managing Undo/Redo

// ============================
// UndoRedoManager with event notifications
// ============================
type HistoryEvent =
  | { type: 'execute'; command: Command }
  | { type: 'undo'; command: Command }
  | { type: 'redo'; command: Command }
  | { type: 'clear' };

type HistoryListener = (event: HistoryEvent) => void;

class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxHistory: number;
  private listeners: HistoryListener[] = [];
  private batchLevel: number = 0;
  private batchCommands: Command[] = [];

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory;
  }

  /** Execute a command and add it to the Undo stack */
  execute(command: Command): void {
    command.execute();

    if (this.batchLevel > 0) {
      // Accumulate in batch during batch mode
      this.batchCommands.push(command);
      return;
    }

    this.undoStack.push(command);

    // Clear the Redo stack when a new command is executed
    // (branched history is discarded)
    this.redoStack = [];

    // Remove oldest entry if history exceeds the limit
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notify({ type: 'execute', command });
  }

  /** Undo the most recent command */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    this.notify({ type: 'undo', command });
    return true;
  }

  /** Redo an undone command */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    this.notify({ type: 'redo', command });
    return true;
  }

  /** Begin a batch operation (group multiple operations as one Undo unit) */
  beginBatch(): void {
    this.batchLevel++;
    if (this.batchLevel === 1) {
      this.batchCommands = [];
    }
  }

  /** End a batch operation */
  endBatch(description?: string): void {
    this.batchLevel--;
    if (this.batchLevel === 0 && this.batchCommands.length > 0) {
      const macro = new MacroCommand(this.batchCommands, description);
      this.undoStack.push(macro);
      this.redoStack = [];

      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.notify({ type: 'execute', command: macro });
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getHistory(): string[] {
    return this.undoStack.map(cmd => cmd.describe());
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  /** Clear all history */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify({ type: 'clear' });
  }

  /** Add a listener for history changes */
  subscribe(listener: HistoryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(event: HistoryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

// ============================
// Usage example
// ============================
const editor2 = new TextEditor();
const manager = new UndoRedoManager();

// Monitor events
manager.subscribe(event => {
  console.log(`[History] ${event.type}: ${
    event.type !== 'clear' ? event.command.describe() : 'all'
  }`);
});

manager.execute(new InsertTextCommand(editor2, 0, 'Hello'));
// [History] execute: Insert "Hello" at position 0
console.log(editor2.getContent()); // "Hello"

manager.execute(new InsertTextCommand(editor2, 5, ' World'));
// [History] execute: Insert " World" at position 5
console.log(editor2.getContent()); // "Hello World"

manager.undo();
// [History] undo: Insert " World" at position 5
console.log(editor2.getContent()); // "Hello"

manager.redo();
// [History] redo: Insert " World" at position 5
console.log(editor2.getContent()); // "Hello World"

// Batch operation: combine "Find and Replace" into one Undo unit
manager.beginBatch();
manager.execute(new DeleteTextCommand(editor2, 0, 5));
manager.execute(new InsertTextCommand(editor2, 0, 'Hi'));
manager.endBatch('Replace "Hello" with "Hi"');

console.log(editor2.getContent()); // "Hi World"
manager.undo(); // The entire batch is undone with one Undo
console.log(editor2.getContent()); // "Hello World"
```

```
Detailed Undo/Redo stack operations:

  execute("Hello")  execute(" World")   undo()           redo()
  ┌─────────┐      ┌─────────┐       ┌─────────┐      ┌─────────┐
  │ Undo    │      │ Undo    │       │ Undo    │      │ Undo    │
  │┌───────┐│      │┌───────┐│       │┌───────┐│      │┌───────┐│
  ││"Hello"││      ││"World"││       ││"Hello"││      ││"World"││
  │└───────┘│      │┌───────┐│       │└───────┘│      │┌───────┐│
  │         │      ││"Hello"││       │         │      ││"Hello"││
  │         │      │└───────┘│       │         │      │└───────┘│
  ├─────────┤      ├─────────┤       ├─────────┤      ├─────────┤
  │ Redo    │      │ Redo    │       │ Redo    │      │ Redo    │
  │ (empty) │      │ (empty) │       │┌───────┐│      │ (empty) │
  │         │      │         │       ││"World"││      │         │
  │         │      │         │       │└───────┘│      │         │
  └─────────┘      └─────────┘       └─────────┘      └─────────┘

  ★ Important: If a new execute() is called after undo(),
    the Redo stack is completely cleared (branched history is lost)

  When branching occurs:
  execute(A) → execute(B) → undo() → execute(C)
                                      ↑ At this point B can no longer be redone

  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
  │Undo: │    │Undo: │    │Undo: │    │Undo: │
  │  [A] │    │[A,B] │    │  [A] │    │[A,C] │
  │      │    │      │    │      │    │      │
  │Redo: │    │Redo: │    │Redo: │    │Redo: │
  │  []  │    │  []  │    │  [B] │    │  []  │ ← B is gone
  └──────┘    └──────┘    └──────┘    └──────┘
```

---

## 4. Macro Command (Composite Command)

### Code Example 3: Recording and Replaying Macros

```typescript
// macro-command.ts -- Composing multiple commands (combination with Composite pattern)

// ============================
// MacroCommand: Combines multiple commands into one
// ============================
class MacroCommand implements Command {
  readonly isUndoable = true;
  private commands: Command[];
  private label: string;

  constructor(commands: Command[] = [], label?: string) {
    this.commands = [...commands];
    this.label = label ?? 'Macro';
  }

  add(command: Command): this {
    this.commands.push(command);
    return this;
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  undo(): void {
    // Undo in reverse order (LIFO: revert from the last executed)
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  describe(): string {
    if (this.label !== 'Macro') return this.label;
    return `Macro [${this.commands.map(c => c.describe()).join(', ')}]`;
  }
}

// ============================
// MacroRecorder: Record and replay user operations
// ============================
class MacroRecorder {
  private recording: boolean = false;
  private commands: Command[] = [];
  private macros: Map<string, MacroCommand> = new Map();

  startRecording(): void {
    this.recording = true;
    this.commands = [];
    console.log('Recording started...');
  }

  stopRecording(name: string): MacroCommand {
    this.recording = false;
    const macro = new MacroCommand([...this.commands], name);
    this.macros.set(name, macro);
    console.log(`Macro "${name}" saved (${this.commands.length} commands)`);
    return macro;
  }

  recordCommand(command: Command): void {
    if (this.recording) {
      this.commands.push(command);
    }
  }

  isRecording(): boolean {
    return this.recording;
  }

  getMacro(name: string): MacroCommand | undefined {
    return this.macros.get(name);
  }

  listMacros(): string[] {
    return [...this.macros.keys()];
  }
}

// ============================
// Usage example: Text formatting macro
// ============================
const editorMacro = new TextEditor();
const managerMacro = new UndoRedoManager();
const recorder = new MacroRecorder();

// Start recording the macro
recorder.startRecording();

// Execute operations while recording them
const m1 = new InsertTextCommand(editorMacro, 0, '# ');
recorder.recordCommand(m1);
managerMacro.execute(m1);

const m2 = new InsertTextCommand(
  editorMacro, editorMacro.getLength(), '\n---\n'
);
recorder.recordCommand(m2);
managerMacro.execute(m2);

// Save macro with a name
const formatMacro = recorder.stopRecording('heading-format');

console.log(editorMacro.getContent());
// "# \n---\n"

// Re-apply the macro to another text
// Note: commands need to be recreated for a new editor
```

---

## 5. Asynchronous Command Queue

### Code Example 4: Async Queue with Retry and Rollback

```typescript
// command-queue.ts -- Sequential execution of async commands

// ============================
// AsyncCommand interface
// ============================
interface AsyncCommand {
  execute(): Promise<void>;
  undo(): Promise<void>;
  describe(): string;
  /** Whether the command can be retried */
  canRetry(): boolean;
  /** Maximum number of retries */
  maxRetries: number;
}

// ============================
// CommandQueue: Sequential execution queue
// ============================
type QueueEvent =
  | { type: 'enqueue'; command: AsyncCommand }
  | { type: 'execute'; command: AsyncCommand }
  | { type: 'retry'; command: AsyncCommand; attempt: number }
  | { type: 'fail'; command: AsyncCommand; error: Error }
  | { type: 'rollback'; command: AsyncCommand }
  | { type: 'complete' };

class CommandQueue {
  private queue: Array<{ command: AsyncCommand; retries: number }> = [];
  private processing: boolean = false;
  private executed: AsyncCommand[] = [];
  private listeners: Array<(event: QueueEvent) => void> = [];

  enqueue(command: AsyncCommand): void {
    this.queue.push({ command, retries: 0 });
    this.notify({ type: 'enqueue', command });
    this.processNext();
  }

  enqueueAll(commands: AsyncCommand[]): void {
    for (const command of commands) {
      this.queue.push({ command, retries: 0 });
      this.notify({ type: 'enqueue', command });
    }
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const entry = this.queue.shift()!;

    try {
      await entry.command.execute();
      this.executed.push(entry.command);
      this.notify({ type: 'execute', command: entry.command });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notify({ type: 'fail', command: entry.command, error: err });

      if (entry.command.canRetry() && entry.retries < entry.command.maxRetries) {
        // Retry: put back at the front of the queue
        entry.retries++;
        this.notify({
          type: 'retry',
          command: entry.command,
          attempt: entry.retries,
        });
        this.queue.unshift(entry);
      } else {
        // Rollback on failure
        await this.rollback();
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        this.processNext();
      } else {
        this.notify({ type: 'complete' });
      }
    }
  }

  private async rollback(): Promise<void> {
    console.log('Rolling back executed commands...');
    while (this.executed.length > 0) {
      const cmd = this.executed.pop()!;
      try {
        await cmd.undo();
        this.notify({ type: 'rollback', command: cmd });
      } catch (err) {
        console.error(`Rollback failed for: ${cmd.describe()}`, err);
        // A rollback failure in a compensating transaction
        // requires human intervention → alert
      }
    }
    // Clear the entire queue after rollback
    this.queue = [];
  }

  subscribe(listener: (event: QueueEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(event: QueueEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

// ============================
// Usage example: API call transaction
// ============================
class CreateUserCommand implements AsyncCommand {
  maxRetries = 2;
  private userId: string | null = null;

  constructor(private userData: { name: string; email: string }) {}

  async execute(): Promise<void> {
    // API call (simulation)
    console.log(`Creating user: ${this.userData.name}`);
    this.userId = `user_${Date.now()}`;
  }

  async undo(): Promise<void> {
    if (this.userId) {
      console.log(`Deleting user: ${this.userId}`);
      this.userId = null;
    }
  }

  canRetry(): boolean { return true; }
  describe(): string { return `CreateUser(${this.userData.name})`; }
}

class SendWelcomeEmailCommand implements AsyncCommand {
  maxRetries = 3;

  constructor(private email: string) {}

  async execute(): Promise<void> {
    console.log(`Sending welcome email to: ${this.email}`);
    // Simulate network error
    if (Math.random() < 0.3) {
      throw new Error('SMTP connection timeout');
    }
  }

  async undo(): Promise<void> {
    console.log(`Email to ${this.email} cannot be unsent (no-op)`);
  }

  canRetry(): boolean { return true; }
  describe(): string { return `SendEmail(${this.email})`; }
}

// Using the queue
const queue = new CommandQueue();

queue.subscribe(event => {
  switch (event.type) {
    case 'execute':
      console.log(`Executed: ${event.command.describe()}`);
      break;
    case 'retry':
      console.log(`Retrying: ${event.command.describe()} (attempt ${event.attempt})`);
      break;
    case 'rollback':
      console.log(`Rolled back: ${event.command.describe()}`);
      break;
  }
});

queue.enqueueAll([
  new CreateUserCommand({ name: 'Alice', email: 'alice@example.com' }),
  new SendWelcomeEmailCommand('alice@example.com'),
]);
```

---

## 6. Command Pattern in Python

### Code Example 5: Protocol-Based Command in Python

```python
# command_python.py -- Command pattern implementation in Python
from __future__ import annotations
from typing import Protocol, runtime_checkable
from dataclasses import dataclass, field
from datetime import datetime


# ============================
# Command protocol
# ============================
@runtime_checkable
class Command(Protocol):
    def execute(self) -> None: ...
    def undo(self) -> None: ...
    def describe(self) -> str: ...


# ============================
# Receiver: Spreadsheet
# ============================
class Spreadsheet:
    def __init__(self, rows: int = 100, cols: int = 26):
        self._cells: dict[tuple[int, int], str | float] = {}
        self._rows = rows
        self._cols = cols

    def get_cell(self, row: int, col: int) -> str | float | None:
        return self._cells.get((row, col))

    def set_cell(self, row: int, col: int, value: str | float) -> None:
        self._cells[(row, col)] = value

    def delete_cell(self, row: int, col: int) -> str | float | None:
        return self._cells.pop((row, col), None)

    def get_range(
        self, r1: int, c1: int, r2: int, c2: int
    ) -> dict[tuple[int, int], str | float]:
        return {
            (r, c): v
            for (r, c), v in self._cells.items()
            if r1 <= r <= r2 and c1 <= c <= c2
        }


# ============================
# Concrete Command: Set cell value
# ============================
@dataclass
class SetCellCommand:
    sheet: Spreadsheet
    row: int
    col: int
    new_value: str | float
    _old_value: str | float | None = field(default=None, init=False)

    def execute(self) -> None:
        self._old_value = self.sheet.get_cell(self.row, self.col)
        self.sheet.set_cell(self.row, self.col, self.new_value)

    def undo(self) -> None:
        if self._old_value is None:
            self.sheet.delete_cell(self.row, self.col)
        else:
            self.sheet.set_cell(self.row, self.col, self._old_value)

    def describe(self) -> str:
        col_letter = chr(ord("A") + self.col)
        return f"Set {col_letter}{self.row + 1} = {self.new_value}"


# ============================
# Concrete Command: Clear a range in bulk
# ============================
@dataclass
class ClearRangeCommand:
    sheet: Spreadsheet
    r1: int
    c1: int
    r2: int
    c2: int
    _saved: dict[tuple[int, int], str | float] = field(
        default_factory=dict, init=False
    )

    def execute(self) -> None:
        self._saved = self.sheet.get_range(self.r1, self.c1, self.r2, self.c2)
        for (r, c) in self._saved:
            self.sheet.delete_cell(r, c)

    def undo(self) -> None:
        for (r, c), v in self._saved.items():
            self.sheet.set_cell(r, c, v)

    def describe(self) -> str:
        c1_letter = chr(ord("A") + self.c1)
        c2_letter = chr(ord("A") + self.c2)
        return f"Clear {c1_letter}{self.r1 + 1}:{c2_letter}{self.r2 + 1}"


# ============================
# UndoRedoManager (Python version)
# ============================
@dataclass
class UndoRedoManager:
    max_history: int = 100
    _undo_stack: list[Command] = field(default_factory=list, init=False)
    _redo_stack: list[Command] = field(default_factory=list, init=False)

    def execute(self, command: Command) -> None:
        command.execute()
        self._undo_stack.append(command)
        self._redo_stack.clear()
        if len(self._undo_stack) > self.max_history:
            self._undo_stack.pop(0)

    def undo(self) -> bool:
        if not self._undo_stack:
            return False
        cmd = self._undo_stack.pop()
        cmd.undo()
        self._redo_stack.append(cmd)
        return True

    def redo(self) -> bool:
        if not self._redo_stack:
            return False
        cmd = self._redo_stack.pop()
        cmd.execute()
        self._undo_stack.append(cmd)
        return True

    def history(self) -> list[str]:
        return [cmd.describe() for cmd in self._undo_stack]


# ============================
# Usage example
# ============================
if __name__ == "__main__":
    sheet = Spreadsheet()
    mgr = UndoRedoManager()

    mgr.execute(SetCellCommand(sheet, 0, 0, "Name"))
    mgr.execute(SetCellCommand(sheet, 0, 1, "Age"))
    mgr.execute(SetCellCommand(sheet, 1, 0, "Alice"))
    mgr.execute(SetCellCommand(sheet, 1, 1, 30))

    print(f"A1={sheet.get_cell(0, 0)}, B1={sheet.get_cell(0, 1)}")
    # A1=Name, B1=Age
    print(f"A2={sheet.get_cell(1, 0)}, B2={sheet.get_cell(1, 1)}")
    # A2=Alice, B2=30

    mgr.undo()  # Undo B2 = 30
    print(f"B2 after undo: {sheet.get_cell(1, 1)}")
    # B2 after undo: None

    mgr.redo()  # Restore B2 = 30
    print(f"B2 after redo: {sheet.get_cell(1, 1)}")
    # B2 after redo: 30

    print("History:", mgr.history())
    # History: ['Set A1 = Name', 'Set B1 = Age', 'Set A2 = Alice', 'Set B2 = 30']
```

---

## 7. Functional Command -- Closure-Based

### Code Example 6: Command Using Closures and Higher-Order Functions

```typescript
// functional-command.ts -- Functional approach to the Command pattern

// ============================
// Type definition for functional Command
// ============================
interface FunctionalCommand {
  execute: () => void;
  undo: () => void;
  describe: () => string;
}

// ============================
// Command factories
// ============================
function createInsertCommand(
  editor: TextEditor,
  position: number,
  text: string
): FunctionalCommand {
  return {
    execute: () => editor.insertAt(position, text),
    undo: () => editor.deleteRange(position, position + text.length),
    describe: () => `Insert "${text}" at ${position}`,
  };
}

function createDeleteCommand(
  editor: TextEditor,
  start: number,
  end: number
): FunctionalCommand {
  let deleted = '';
  return {
    execute: () => { deleted = editor.deleteRange(start, end); },
    undo: () => editor.insertAt(start, deleted),
    describe: () => `Delete [${start}:${end}]`,
  };
}

// ============================
// Generic Command factory (converts any operation into a command)
// ============================
function makeCommand(
  doFn: () => void,
  undoFn: () => void,
  description: string
): FunctionalCommand {
  return {
    execute: doFn,
    undo: undoFn,
    describe: () => description,
  };
}

// ============================
// Functional UndoRedoManager
// ============================
function createUndoRedoManager() {
  const undoStack: FunctionalCommand[] = [];
  const redoStack: FunctionalCommand[] = [];

  return {
    execute(cmd: FunctionalCommand): void {
      cmd.execute();
      undoStack.push(cmd);
      redoStack.length = 0;
    },
    undo(): boolean {
      const cmd = undoStack.pop();
      if (!cmd) return false;
      cmd.undo();
      redoStack.push(cmd);
      return true;
    },
    redo(): boolean {
      const cmd = redoStack.pop();
      if (!cmd) return false;
      cmd.execute();
      undoStack.push(cmd);
      return true;
    },
    history(): string[] {
      return undoStack.map(c => c.describe());
    },
  };
}

// ============================
// Usage example: lightweight Command without classes
// ============================
const ed = new TextEditor();
const mgr = createUndoRedoManager();

mgr.execute(createInsertCommand(ed, 0, 'Hello'));
mgr.execute(createInsertCommand(ed, 5, ' World'));
console.log(ed.getContent()); // "Hello World"

mgr.undo();
console.log(ed.getContent()); // "Hello"

// Any operation can be converted into a command
let logBuffer: string[] = [];
mgr.execute(makeCommand(
  () => logBuffer.push('entry'),
  () => logBuffer.pop(),
  'Add log entry'
));
```

---

## 8. Type-Safe Command Bus

### Code Example 7: Command Bus Using TypeScript Generics

```typescript
// command-bus.ts -- Type-safe Command dispatching

// ============================
// Type definitions for Command and Handler
// ============================
interface TypedCommand<TName extends string, TPayload, TResult> {
  readonly type: TName;
  readonly payload: TPayload;
  // TResult is type-level information only (not used at runtime)
  readonly __result?: TResult;
}

type CommandHandler<C extends TypedCommand<string, unknown, unknown>> =
  (command: C) => C extends TypedCommand<string, unknown, infer R> ? R : never;

// ============================
// Command bus
// ============================
class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  private middleware: Array<(
    command: TypedCommand<string, unknown, unknown>,
    next: () => unknown
  ) => unknown> = [];

  /** Register a handler */
  register<C extends TypedCommand<string, unknown, unknown>>(
    type: C['type'],
    handler: CommandHandler<C>
  ): void {
    this.handlers.set(type, handler);
  }

  /** Add middleware (logging, authentication, etc.) */
  use(
    middleware: (
      command: TypedCommand<string, unknown, unknown>,
      next: () => unknown
    ) => unknown
  ): void {
    this.middleware.push(middleware);
  }

  /** Dispatch a command */
  dispatch<C extends TypedCommand<string, unknown, unknown>>(
    command: C
  ): C extends TypedCommand<string, unknown, infer R> ? R : never {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler registered for command: ${command.type}`);
    }

    // Build the middleware chain
    const chain = this.middleware.reduceRight(
      (next, mw) => () => mw(command, next),
      () => handler(command)
    );

    return chain() as any;
  }
}

// ============================
// Concrete command definitions
// ============================
type CreateOrderCommand = TypedCommand<
  'CreateOrder',
  { userId: string; items: Array<{ sku: string; qty: number }> },
  { orderId: string }
>;

type CancelOrderCommand = TypedCommand<
  'CancelOrder',
  { orderId: string; reason: string },
  { refundAmount: number }
>;

// ============================
// Usage example
// ============================
const bus = new CommandBus();

// Logging middleware
bus.use((command, next) => {
  console.log(`[CommandBus] Dispatching: ${command.type}`, command.payload);
  const start = performance.now();
  const result = next();
  const elapsed = performance.now() - start;
  console.log(`[CommandBus] Completed: ${command.type} (${elapsed.toFixed(2)}ms)`);
  return result;
});

// Register handlers
bus.register<CreateOrderCommand>('CreateOrder', (cmd) => {
  console.log(`Creating order for user: ${cmd.payload.userId}`);
  return { orderId: `ORD-${Date.now()}` };
});

bus.register<CancelOrderCommand>('CancelOrder', (cmd) => {
  console.log(`Cancelling order: ${cmd.payload.orderId}`);
  return { refundAmount: 1500 };
});

// Dispatch (type-safe: return type is inferred automatically)
const result = bus.dispatch<CreateOrderCommand>({
  type: 'CreateOrder',
  payload: { userId: 'u1', items: [{ sku: 'SKU-001', qty: 2 }] },
});
console.log(result.orderId); // Type-safe: string
```

---

## 9. Deep Dive: Internal Design Decisions of the Command Pattern

### Comparison of 3 Undo Implementation Approaches

```
Approach 1: Command History (Command Pattern)
  Each command holds an undo() that executes the inverse operation
  ┌─────┐  ┌─────┐  ┌─────┐
  │ C1  │→│ C2  │→│ C3  │  ← Undo stack
  │undo │  │undo │  │undo │
  └─────┘  └─────┘  └─────┘
  Memory: Only diffs are stored (memory-efficient)
  Speed:  O(1) per undo

Approach 2: Memento (Snapshot)
  Saves the entire state before each operation
  ┌───────┐  ┌───────┐  ┌───────┐
  │State 0│  │State 1│  │State 2│  ← Snapshots
  │(full) │  │(full) │  │(full) │
  └───────┘  └───────┘  └───────┘
  Memory: State size × history count (heavy consumption)
  Speed:  O(1) per undo (just swap)

Approach 3: Event Sourcing
  Records all events and rebuilds state by replaying them
  ┌─────┐  ┌─────┐  ┌─────┐
  │ E1  │→│ E2  │→│ E3  │  ← Event log
  │(append)│  │(append)│  │(append)│
  └─────┘  └─────┘  └─────┘
  Memory: Event size × count
  Speed:  O(N) per undo (replay from the beginning)
  ※ Can be optimized with snapshots
```

| Comparison | Command History | Memento | Event Sourcing |
|---------|-------------|---------|----------------|
| Memory usage | Low (diffs only) | High (full state x N) | Medium (event sequence) |
| Implementation complexity | Medium | Low | High |
| Partial Undo | Difficult | Not possible | Possible |
| Persistence | Easy | Easy | Easy |
| Audit trail | Usable as operation log | Not suitable | Optimal |
| Debuggability | Medium | High (direct state inspection) | High (replayable) |
| Use cases | Editors, operation recording | Game saves | Domain event recording |

### Designing Command Granularity

Command granularity (the scope of operations a single command covers) is an important design decision that directly affects user experience.

```
When granularity is too fine:
  One command per character → Undo reverts one character at a time (poor UX)
  "Hello" = 5 Commands → requires 5 Undos to erase

When granularity is too coarse:
  One command per entire page → Undoing a small change erases a large amount

Ideal granularity:
  ┌────────────────────────────────────────────┐
  │ Units corresponding to the user's "intent" │
  │                                            │
  │ Example: Text editor                       │
  │   - Typing a word → 1 Command              │
  │   - Deleting a word with Backspace → 1 Command │
  │   - Find and replace → 1 Command (MacroCommand) │
  │   - Formatting change → 1 Command          │
  │                                            │
  │ Example: Graphics editor                   │
  │   - Moving a shape → 1 Command             │
  │   - Multi-select and move → 1 Command      │
  │   - Color change → 1 Command               │
  └────────────────────────────────────────────┘

Granularity control through buffering:
  Start typing → start timer
  While typing → accumulate in buffer
  500ms of no input or Enter → finalize Command

  "H" "e" "l" "l" "o" [500ms] → InsertCommand("Hello")
```

---

## 10. Command Pattern in the Real World

### Redux / Flux Architecture

```
Redux is a variation of the Command pattern:

  Action     = Command (describes an operation with type + payload)
  Reducer    = execute() (updates state)
  Store      = Invoker + History
  Middleware = hooks before/after Command

  dispatch({ type: 'ADD_TODO', payload: { text: '...' } })
  ↓
  [Middleware] → [Reducer] → [New State]

  Redux DevTools = Undo/Redo manager
    - Maintains history of all Actions
    - Time-travel debugging (go back to any point)
    - Action replay
```

### Git's Operation Model

```
Git is a concrete example of the Command pattern:

  git commit      = execute()     Records a new snapshot
  git revert      = undo()        Negates changes with a compensating commit
  git cherry-pick = re-applying a command
  git reflog      = Command history

  ※ git reset --hard uses the "Memento approach" (directly restores state)
  ※ git revert uses the "Command approach" (adds the inverse operation)
```

### Game Replay Systems

```
Game replay = Serializing and replaying Commands:

  Recording phase:
  Frame 1: [MoveCommand(player, {x:1, y:0})]
  Frame 2: [AttackCommand(player, target)]
  Frame 3: [MoveCommand(player, {x:0, y:1}), UseItemCommand(player, potion)]
  ...

  Replay phase:
  Same initial state + same Command sequence → same result (deterministic execution)

  Compression: merge consecutive commands of the same type
  Frame 1-10: MoveCommand(player, {x:10, y:0})  ← 10 frames combined
```

---

## 11. Comparison Tables

### Command vs Other Patterns

| Characteristic | Command | Strategy | Observer | Memento |
|------|---------|----------|----------|---------|
| Purpose | Encapsulate operations | Switch algorithms | Notify state changes | Save/restore state |
| Undo/Redo | Supported (inverse operation) | Not supported | Not supported | Supported (snapshot) |
| History management | Possible | Not needed | Not needed | Possible |
| Deferred execution | Possible | Executes immediately | Event-driven | Saves immediately |
| Queuing | Possible | Not needed | Not needed | Not needed |
| Serialization | Easy | Difficult | Not needed | Easy |
| Memory efficiency | High (diffs) | -- | -- | Low (full state) |

### Comparison of Command Implementation Approaches

| Approach | Class-based | Functional (closure) | Object literal |
|-----------|-------------|-------------------|-------------------|
| Undo | execute/undo methods | do/undo closures | execute/undo properties |
| Type safety | Strong with interface | Requires type definitions | Requires type definitions |
| Serialization | Easy (class name + params) | Difficult (closures cannot be serialized) | Difficult |
| Testability | Easy to mock | Easy to swap functions | Same as left |
| Boilerplate | More | Less | Less |
| Use cases | Large-scale, requires serialization | Lightweight, temporary | Medium-scale |

### Decision Criteria for Introducing the Command Pattern

| Criterion | Command pattern is effective | Direct function call is sufficient |
|---------|---------------------|---------------------|
| Undo/Redo | Required | Not needed |
| Operation logging | Required (audit, debugging) | Not needed |
| Deferred execution / Queuing | Required | Not needed |
| Macro recording | Required | Not needed |
| Serialization / Network transmission | Required | Not needed |
| Number of operation types | Many or expected to grow | Few and fixed |

---

## 12. Anti-Patterns

### Anti-Pattern 1: Inappropriate Command Granularity

```typescript
// ============================
// [NG] Creating a command for each character
// ============================
// Undo reverts one character at a time, also wastes memory
manager.execute(new InsertTextCommand(editor, 0, 'H'));
manager.execute(new InsertTextCommand(editor, 1, 'e'));
manager.execute(new InsertTextCommand(editor, 2, 'l'));
manager.execute(new InsertTextCommand(editor, 3, 'l'));
manager.execute(new InsertTextCommand(editor, 4, 'o'));
// Undo 5 times: "Hello" → "Hell" → "Hel" → "He" → "H" → ""
// User expectation: 1 Undo removes "Hello"

// ============================
// [OK] Create commands at meaningful units
// ============================
// Buffer input and finalize the command after a period of inactivity
class BufferedTextInput {
  private buffer: string = '';
  private bufferStart: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private editor: TextEditor,
    private manager: UndoRedoManager,
    private debounceMs: number = 500
  ) {}

  /** Called on each character input */
  type(char: string): void {
    if (this.buffer === '') {
      this.bufferStart = this.editor.getCursorPosition();
    }
    // Insert directly into editor (not through a Command)
    this.editor.insertAt(this.editor.getCursorPosition(), char);
    this.buffer += char;

    // Debounce: finalize Command after a period of no input
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  /** Also called on Enter key or when switching operations */
  flush(): void {
    if (this.buffer) {
      // ★ Already applied to editor,
      //    so just create a Command to record the inverse for undo
      const text = this.buffer;
      const start = this.bufferStart;
      const cmd: Command = {
        isUndoable: true,
        execute: () => { /* already applied */ },
        undo: () => this.editor.deleteRange(start, start + text.length),
        describe: () => `Type "${text}"`,
      };
      // Do not call execute(); only add to history
      this.manager['undoStack'].push(cmd);
      this.buffer = '';
    }
  }
}
```

### Anti-Pattern 2: Leaving Non-Undoable Commands Without Proper Declaration

```typescript
// ============================
// [NG] undo() is not implemented (empty method)
// ============================
class SendEmailCommand implements Command {
  readonly isUndoable = true; // False declaration!

  execute(): void {
    emailService.send(this.email);
  }

  undo(): void {
    // Does nothing...?? A sent email cannot be unsent,
    // but isUndoable = true makes the user expect undo to work
  }

  describe(): string { return `Send email to ${this.email}`; }
}

// ============================
// [OK Option 1] Define a compensating action
// ============================
class SendEmailCommandV2 implements Command {
  readonly isUndoable = true;
  private sentId: string | null = null;

  constructor(private email: string) {}

  execute(): void {
    // Do not send immediately; schedule for sending (actual send after 5 minutes)
    this.sentId = emailService.schedule(this.email, { delayMinutes: 5 });
  }

  undo(): void {
    if (this.sentId) {
      // Cancel the scheduled send if within 5 minutes
      const cancelled = emailService.cancelScheduled(this.sentId);
      if (!cancelled) {
        // If already sent, send a cancellation email
        emailService.sendCancellation(this.sentId);
      }
    }
  }

  describe(): string { return `Schedule email to ${this.email}`; }
}

// ============================
// [OK Option 2] Explicitly declare that Undo is not possible
// ============================
class IrreversibleSendEmailCommand implements Command {
  readonly isUndoable = false; // Honest declaration

  constructor(private email: string) {}

  execute(): void {
    emailService.send(this.email);
  }

  undo(): void {
    throw new Error('Email sending cannot be undone');
  }

  describe(): string { return `Send email to ${this.email} (irreversible)`; }
}

// Handle on the UndoRedoManager side as well
class SafeUndoRedoManager extends UndoRedoManager {
  override undo(): boolean {
    const lastCmd = this['undoStack'][this['undoStack'].length - 1];
    if (lastCmd && !lastCmd.isUndoable) {
      console.warn(`Cannot undo: ${lastCmd.describe()} is irreversible`);
      return false;
    }
    return super.undo();
  }
}
```

### Anti-Pattern 3: God Command (Oversized Command)

```typescript
// ============================
// [NG] Cramming multiple responsibilities into one command
// ============================
class ProcessOrderCommand implements Command {
  readonly isUndoable = true;

  execute(): void {
    // All business logic crammed into one Command...
    this.validateOrder();
    this.calculateTax();
    this.applyDiscount();
    this.chargePayment();
    this.updateInventory();
    this.sendConfirmation();
    this.notifyWarehouse();
  }

  undo(): void {
    // 7 inverse operations in the correct order...
    // Untestable, a breeding ground for bugs
  }
  // ...
}

// ============================
// [OK] Split into small single-responsibility Commands and compose with MacroCommand
// ============================
const processOrder = new MacroCommand([
  new ValidateOrderCommand(order),
  new CalculateTaxCommand(order),
  new ApplyDiscountCommand(order),
  new ChargePaymentCommand(order),
  new UpdateInventoryCommand(order),
  new SendConfirmationCommand(order),
  new NotifyWarehouseCommand(order),
], 'Process Order');

// Benefits:
// - Each Command can be tested independently
// - If a step fails, only the executed Commands are undone
// - Adding or removing steps is easy
// - Each Command can be reused
```

---

## 13. Exercises

### Exercise 1 (Basic): Implementing Commands for a DrawingCanvas

Implement Commands for a drawing canvas that satisfy the following specification.

**Specification:**
- `DrawCircleCommand`: Draw a circle (x, y, radius, color)
- `DrawRectCommand`: Draw a rectangle (x, y, width, height, color)
- `ClearCanvasCommand`: Clear the entire canvas
- Combine with `UndoRedoManager` to enable Undo/Redo

```typescript
// Hint: Definition of Canvas (Receiver)
interface Shape {
  type: 'circle' | 'rect';
  id: string;
  // ...shape-specific properties
}

class DrawingCanvas {
  private shapes: Shape[] = [];

  addShape(shape: Shape): void { /* ... */ }
  removeShape(id: string): Shape | undefined { /* ... */ }
  clear(): Shape[] { /* ... */ }
  getShapes(): Shape[] { /* ... */ }
}
```

**Expected output:**
```
canvas.getShapes() → []
execute(DrawCircleCommand(50, 50, 20, 'red'))
canvas.getShapes() → [{ type: 'circle', id: '...', x: 50, y: 50, radius: 20, color: 'red' }]
execute(DrawRectCommand(10, 10, 100, 50, 'blue'))
canvas.getShapes().length → 2
undo()
canvas.getShapes().length → 1
undo()
canvas.getShapes().length → 0
redo()
canvas.getShapes().length → 1
```

---

### Exercise 2 (Applied): API Command Queue with Transactions

Implement a transaction execution engine that satisfies the following specification.

**Specification:**
- Execute multiple async Commands sequentially
- If a failure occurs midway, undo all executed Commands in reverse order (rollback)
- Retry functionality (up to 3 times)
- Progress event notifications (onProgress callback)

```typescript
// Hint: Interface
interface TransactionEngine {
  execute(commands: AsyncCommand[]): Promise<TransactionResult>;
}

interface TransactionResult {
  success: boolean;
  executedCount: number;
  failedCommand?: string;
  rolledBackCount?: number;
}
```

**Expected output:**
```
Happy path:
  execute([CmdA, CmdB, CmdC])
  → { success: true, executedCount: 3 }

Error case (CmdC fails, retries also fail):
  execute([CmdA, CmdB, CmdC])
  → Retrying CmdC (attempt 1/3)
  → Retrying CmdC (attempt 2/3)
  → Retrying CmdC (attempt 3/3)
  → Rolling back CmdB
  → Rolling back CmdA
  → { success: false, executedCount: 2, failedCommand: 'CmdC', rolledBackCount: 2 }
```

---

### Exercise 3 (Advanced): Build a Replay System with Serializable Commands

Implement a replay (record and replay operations) system that satisfies the following specification.

**Specification:**
- Serialize/deserialize Commands to/from JSON
- Record operations with timestamps
- Replay recorded operations against a different Receiver
- Control replay speed (1x, 2x, 0.5x)

```typescript
// Hint: Serialization format
interface SerializedCommand {
  type: string;
  params: Record<string, unknown>;
  timestamp: number;
}

interface ReplayEngine {
  record(command: Command): void;
  serialize(): string;
  deserialize(json: string): void;
  replay(receiver: TextEditor, speed?: number): Promise<void>;
}
```

**Expected output:**
```
Recording:
  record(InsertCommand(0, "Hello"))     // t=0ms
  record(InsertCommand(5, " World"))    // t=500ms
  record(DeleteCommand(5, 11))          // t=1200ms
  serialize() → '[{"type":"insert","params":{"pos":0,"text":"Hello"},"timestamp":0},...]'

Replay (speed=2x):
  t=0ms:   Insert "Hello"     → "Hello"
  t=250ms: Insert " World"    → "Hello World"
  t=600ms: Delete [5:11]      → "Hello"
```

---

## 14. FAQ

### Q1: In what situations should the Command pattern be used?

It is effective primarily in the following five situations.

1. **Undo/Redo**: Text editors, graphic tools, spreadsheets. Any situation where users need to reverse operations.
2. **Operation queuing**: Job queues, batch processing, offline queues for unstable network conditions.
3. **Operation logging**: Audit trails (who did what and when), debug logs, compliance requirements.
4. **Macro recording**: Recording and replaying user operations, test automation.
5. **Transactions**: Atomic execution of multiple operations (all succeed or all rollback).

In situations where a single simple function call suffices, it becomes over-engineering. Use the criteria "Do I need to be able to cancel this operation later?" and "Do I need to keep a history of operations?" as your guide.

### Q2: What is the difference between the Command pattern and closures in functional programming?

Closures also "encapsulate operations," but they differ from the Command pattern in the following ways.

| Comparison | Command pattern | Closure |
|---------|----------------|-----------|
| Undo | Explicit undo() method | Inverse operation must be provided separately |
| Serialization | Possible (class name + parameters) | Not possible (closures cannot be serialized) |
| Inspectability | Content can be checked with describe() | Cannot see the internals from outside |
| Testing | Can be tested independently | Harder to test |

In TypeScript, a hybrid of class-based and functional (closure) approaches is practical. Use closures for lightweight scenarios where serialization is not needed, and use class-based approaches when persistence or network transmission is required.

### Q3: How do you manage memory consumption from a large command history?

There are four strategies.

1. **History limit**: Cap at 100–1000 entries and discard the oldest. Most editors use this approach.
2. **Command coalescing**: Merge consecutive commands of the same type. For example, combine consecutive character inputs into a single InsertCommand.
3. **Checkpoints**: Periodically take a snapshot of the full state and discard Command history before that point. Undo can only go back to the checkpoint, but memory stays constant.
4. **Lazy loading**: Archive old history to disk and load only when needed. Store in IndexedDB or SQLite.

### Q4: What is the relationship between the Command pattern and Event Sourcing?

The Command pattern and Event Sourcing are closely related but have different purposes.

- **Command**: Represents the "intent of an operation." It exists before execution and can be rejected.
- **Event**: Represents "what happened." It exists after execution and is immutable.

In Event Sourcing, a Command is received, validated, and then an Event is generated. By replaying Events, the state at any point in time can be restored. A common design is for `execute()` in the Command pattern to emit an Event, and `undo()` to emit a compensating Event.

### Q5: How do you use the Command pattern in React / frontend frameworks?

In React, the following pattern is common.

```typescript
// useUndoRedo custom hook
function useUndoRedo<T>(initialState: T) {
  const [state, setState] = useState(initialState);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const execute = useCallback((newState: T) => {
    undoStack.current.push(state);
    redoStack.current = [];
    setState(newState);
  }, [state]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev !== undefined) {
      redoStack.current.push(state);
      setState(prev);
    }
  }, [state]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (next !== undefined) {
      undoStack.current.push(state);
      setState(next);
    }
  }, [state]);

  return { state, execute, undo, redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
```

Redux's `dispatch(action)` is itself the Command pattern. Actions are Commands, Reducers are execute, and Redux DevTools corresponds to UndoRedoManager.

---


## FAQ

### Q1: What is the most important point to understand about this topic?

Gaining practical experience is the most important thing. Understanding deepens not only through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional development?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|------|
| Essence of the Command pattern | Encapsulate operations as objects and make them first-class citizens |
| Four components | Client, Invoker, Command (interface), Receiver |
| Undo/Redo | Manage bidirectional operation history with Undo and Redo stacks |
| MacroCommand | Combination with Composite pattern. Groups multiple commands as one Undo unit |
| Async queue | Sequential command execution, retry, and rollback |
| Granularity design | Divide commands into units that correspond to the user's "intent" |
| Functional approach | Lightweight Command using closures. Effective when serialization is not needed |
| Command bus | Type-safe dispatching of Commands in CQRS |
| Decision criteria | Consider adopting when Undo / logging / queuing / macro recording is needed |

---

## Guides to Read Next

- [03-state.md](./03-state.md) -- State pattern and state transitions (Command + State for stateful operation management)
- [04-iterator.md](./04-iterator.md) -- Iterator pattern and generators (applied to traversing Command history)
- [00-observer.md](./00-observer.md) -- Observer pattern (notifying Command execution as events)
- [../03-functional/00-monad.md](../03-functional/00-monad.md) -- Monad pattern (type-safe success/failure of Commands with Either)
- Event Sourcing / CQRS -- Evolving the Command pattern into large-scale architecture

---

## References

1. **Design Patterns: Elements of Reusable Object-Oriented Software** -- Gamma, Helm, Johnson, Vlissides (GoF, 1994) -- The original source for the Command pattern. Chapter 5, pp.233-242
2. **Head First Design Patterns** -- Eric Freeman, Elisabeth Robson (O'Reilly, 2nd Edition, 2020) -- Accessible explanation and practical examples of the Command pattern
3. **Refactoring.Guru - Command** -- https://refactoring.guru/design-patterns/command -- Diagrams and multi-language implementation examples
4. **Martin Fowler - Command Query Responsibility Segregation (CQRS)** -- https://martinfowler.com/bliki/CQRS.html -- Evolution of the Command pattern to the architectural level
5. **Redux Documentation** -- https://redux.js.org/ -- Practical large-scale application of the Command pattern (Action = Command)
