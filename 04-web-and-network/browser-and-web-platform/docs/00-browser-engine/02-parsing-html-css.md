# HTML/CSS Parsing

> HTML and CSS parsing are the starting point of rendering. This guide provides a deep dive into DOM construction via the HTML parser, CSSOM construction via the CSS parser, and the render tree generation process. The entire pipeline — from the moment the browser receives raw bytes to producing a data structure ready to paint — is explained at the specification level.

## What You Will Learn

- [ ] Understand HTML parser tokenization and tree construction at the specification level
- [ ] Grasp the lexical analysis and parsing algorithms used for CSS
- [ ] Learn the CSSOM construction process and the full picture of style resolution
- [ ] Deeply understand DOM and CSSOM integration (the render tree)
- [ ] Discover browser-specific optimizations such as error recovery and speculative parsing
- [ ] Identify anti-patterns that negatively impact performance

## Prerequisites

- Browser navigation and loading → see: [Navigation](./01-navigation-and-loading.md)
- Basic knowledge of HTML/CSS syntax and structure
- Familiarity with the concept of a DOM tree

---

## 1. Overview of Parsing

From the moment a browser receives an HTML document to reaching a state ready for painting, multiple parsing stages operate in series and in parallel. Let's start with a high-level view.

### 1.1 Processing Flow from Bytes to Render Tree

```
Receive bytes from the network
       │
       ▼
  ┌──────────────────────────────────────────────────────┐
  │  1. Character Encoding Detection                      │
  │     HTTP Content-Type header                          │
  │     BOM (Byte Order Mark)                             │
  │     <meta charset="UTF-8">                            │
  │     → Convert byte sequence to Unicode string         │
  └──────────────┬───────────────────────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────────────────────┐
  │  2. HTML Tokenizer (Lexical Analysis)                 │
  │     String → Token sequence                          │
  │     DOCTYPE, StartTag, EndTag, Comment, Character,   │
  │     EndOfFile                                        │
  └──────────────┬───────────────────────────────────────┘
                 │ Emit tokens one by one
                 ▼
  ┌──────────────────────────────────────────────────────┐
  │  3. HTML Tree Builder (Tree Construction / Parsing)   │
  │     Token sequence → DOM tree                        │
  │     State transitions via Insertion Mode             │
  │     Error recovery and implicit element completion   │
  └──────────────┬───────────────────────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────────────────────┐
  │  4. DOM (Document Object Model)                       │
  │     In-memory object tree                            │
  │     Accessible from JavaScript                       │
  └──────────────┬───────────────────────────────────────┘
                 │                    ┌───────────────────────────────────┐
                 │                    │  5. CSS Parser                    │
                 │                    │     CSS string → Token sequence   │
                 │                    │     Token sequence → CSS rules    │
                 │                    │     → Build CSSOM                 │
                 │                    └──────────┬────────────────────────┘
                 │                               │
                 ▼                               ▼
  ┌──────────────────────────────────────────────────────┐
  │  6. Style Resolution                                  │
  │     Match every DOM node against all CSSOM rules     │
  │     → Determine Computed Style                       │
  └──────────────┬───────────────────────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────────────────────┐
  │  7. Render Tree (Render Tree / Layout Tree)           │
  │     Visible elements + finalized styles              │
  │     Elements with display: none are excluded         │
  └──────────────────────────────────────────────────────┘
```

In this processing flow, HTML parsing and CSS parsing progress partially in parallel. When the HTML parser encounters a `<link rel="stylesheet">` or `<style>` tag, the CSS parser starts and begins building the CSSOM. Crucially, HTML parsing itself continues without waiting for CSS loading to complete.

### 1.2 Character Encoding Detection in Detail

Before the browser can interpret a byte sequence as a string, it must determine the character encoding. The HTML Living Standard defines the following priority order for encoding determination.

```
Encoding determination priority:

  1. BOM (Byte Order Mark)
     UTF-8:    EF BB BF
     UTF-16 BE: FE FF
     UTF-16 LE: FF FE
     → If BOM exists, it takes top priority

  2. HTTP Content-Type header
     Content-Type: text/html; charset=UTF-8
     → Explicitly specified by the server

  3. <meta> tag declaration
     <meta charset="UTF-8">
     <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
     → Must be detected within the first 1024 bytes of HTML

  4. Prescan algorithm
     → The parser scans the beginning of the HTML
       looking for the charset attribute of a meta tag
     → Scans only up to 1024 bytes

  5. Parent document encoding
     → For iframes, the parent's encoding is used as a reference

  6. Browser default
     → Fallback based on regional settings
     → Most modern browsers default to UTF-8
```

**Code Example 1: Best Practice for Specifying Encoding**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Place the charset declaration as the first element inside <head> -->
  <!-- This guarantees it is within the first 1024 bytes -->
  <meta charset="UTF-8">
  <title>Encoding Declaration Example</title>
</head>
<body>
  <p>For pages containing non-ASCII characters, explicitly declare UTF-8</p>
</body>
</html>
```

It is ideal to also specify the encoding in the server-side HTTP header.

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
```

If a different encoding is specified in the HTTP header versus the `<meta>` tag, the HTTP header takes precedence (unless a BOM is present).

---

## 2. HTML Tokenizer (Lexical Analysis)

### 2.1 Tokenizer State Machine

The HTML tokenizer is implemented as a **Finite State Machine (FSM)**. The HTML Living Standard defines more than 80 states; the tokenizer transitions between states based on the input character and emits tokens as it goes.

```
Key state transition diagram of the HTML tokenizer:

  ┌─────────────┐    '<'     ┌──────────────┐
  │  Data State │──────────→│  Tag Open    │
  │  (initial)  │           │  State       │
  └──────┬──────┘           └──────┬───────┘
         │                         │
  char   │ emit token               │ branch on character type
         ▼                         │
  ┌─────────────┐           ┌──────┴───────┐
  │ Character   │           │ Letter       │
  │ Token emit  │           │  → Tag Name  │
  └─────────────┘           │    State     │
                            │              │
                            │ '/'          │
                            │  → End Tag   │
                            │    Open      │
                            │              │
                            │ '!'          │
                            │  → Markup    │
                            │    Decl.     │
                            │    Open      │
                            │              │
                            │ '?'          │
                            │  → Bogus     │
                            │    Comment   │
                            └──────────────┘

  Transitions in Tag Name State:
  ┌──────────────┐   space   ┌───────────────────┐
  │  Tag Name    │──────────→│ Before Attribute  │
  │  State       │           │ Name State        │
  └──────┬───────┘           └─────────┬─────────┘
         │                             │
    '>'  │ emit token          letter  │
         ▼                             ▼
  ┌─────────────┐           ┌───────────────────┐
  │ Data State  │           │ Attribute Name    │
  │ return      │           │ State             │
  └─────────────┘           └─────────┬─────────┘
                                      │
                                 '='  │
                                      ▼
                            ┌───────────────────┐
                            │ Before Attr Value │
                            │ State             │
                            └─────────┬─────────┘
                                      │
                              '"' or '│' or char
                                      ▼
                            ┌───────────────────┐
                            │ Attribute Value   │
                            │ State             │
                            └───────────────────┘
```

### 2.2 Token Types and Structure

The HTML tokenizer produces the following six types of tokens.

```
┌────────────────┬─────────────────────────────────────────────────┐
│ Token type     │ Description and example                         │
├────────────────┼─────────────────────────────────────────────────┤
│ DOCTYPE        │ <!DOCTYPE html>                                 │
│                │ Fields: name, publicId, systemId, forceQuirks   │
├────────────────┼─────────────────────────────────────────────────┤
│ StartTag       │ <div class="main" id="content">                 │
│                │ Fields: tagName, attributes[], selfClosing       │
├────────────────┼─────────────────────────────────────────────────┤
│ EndTag         │ </div>                                          │
│                │ Fields: tagName                                 │
├────────────────┼─────────────────────────────────────────────────┤
│ Comment        │ <!-- comment text -->                           │
│                │ Fields: data                                    │
├────────────────┼─────────────────────────────────────────────────┤
│ Character      │ Characters for text nodes                       │
│                │ Fields: data (one character at a time or        │
│                │ buffered)                                       │
├────────────────┼─────────────────────────────────────────────────┤
│ EndOfFile      │ Special token indicating end of input           │
│                │ Signals that parsing is complete                │
└────────────────┴─────────────────────────────────────────────────┘
```

**Code Example 2: Tracing the Tokenization Process**

Let's trace how the following HTML fragment is tokenized.

```html
<p class="intro">Hello, <em>world</em>!</p>
```

```
Tokenization process:

Input string: <p class="intro">Hello, <em>world</em>!</p>

Position 0:  '<'    → Data → Tag Open State
Position 1:  'p'    → Tag Open → Tag Name State (tagName = "p")
Position 2:  ' '    → Tag Name → Before Attribute Name State
                       StartTag token construction begins {tagName: "p"}
Position 3:  'c'    → Attribute Name State (attrName = "c")
Position 4:  'l'    → attrName = "cl"
Position 5:  'a'    → attrName = "cla"
Position 6:  's'    → attrName = "clas"
Position 7:  's'    → attrName = "class"
Position 8:  '='    → Before Attribute Value State
Position 9:  '"'    → Attribute Value (Double-Quoted) State
Position 10: 'i'    → attrValue = "i"
...
Position 14: 'o'    → attrValue = "intro"
Position 15: '"'    → After Attribute Value (Quoted) State
Position 16: '>'    → Data State
                       ★ StartTag token emitted: {tagName: "p", attrs: [{name:"class", value:"intro"}]}

Position 17: 'H'    → Character token accumulation
...
Position 23: ' '    → Character token accumulation
                       ★ Character token emitted: "Hello, "

Position 24: '<'    → Data → Tag Open State
Position 25: 'e'    → Tag Name State (tagName = "e")
Position 26: 'm'    → tagName = "em"
Position 27: '>'    → Data State
                       ★ StartTag token emitted: {tagName: "em", attrs: []}

Position 28: 'w'    → Character token accumulation
...
Position 32: 'd'    → Character token accumulation
                       ★ Character token emitted: "world"

Position 33: '<'    → Tag Open State
Position 34: '/'    → End Tag Open State
Position 35: 'e'    → Tag Name State (tagName = "e")
Position 36: 'm'    → tagName = "em"
Position 37: '>'    → Data State
                       ★ EndTag token emitted: {tagName: "em"}

Position 38: '!'    → Character token emitted: "!"

Position 39: '<'    → Tag Open State
Position 40: '/'    → End Tag Open State
Position 41: 'p'    → Tag Name State (tagName = "p")
Position 42: '>'    → Data State
                       ★ EndTag token emitted: {tagName: "p"}

Emitted token sequence:
  [StartTag: p (class="intro")]
  [Character: "Hello, "]
  [StartTag: em]
  [Character: "world"]
  [EndTag: em]
  [Character: "!"]
  [EndTag: p]
```

### 2.3 Character Reference Processing

The tokenizer also handles character references (HTML entities).

```
Types of character references:

  1. Named character references
     &amp;   → &
     &lt;    → <
     &gt;    → >
     &quot;  → "
     &apos;  → '
     &nbsp;  → U+00A0 (Non-Breaking Space)

  2. Decimal numeric references
     &#65;   → A  (ASCII code 65)
     &#8364; → €  (Unicode code point)

  3. Hexadecimal numeric references
     &#x41;  → A
     &#x20AC; → €

Processing flow:
  Detect '&' in Data State
    → Transition to Character Reference State
    → '#' → numeric reference
    → Letter → named reference
    → Search name table for a match
    → Emit resolved character as a Character token
```

### 2.4 Tokenization Inside Script Tags

Different tokenization rules apply inside `<script>` tags compared to regular HTML.

```
Special handling of <script> tags:

  Normal Data State:
    Detect '<' → Tag Open State → process as a tag

  Script Data State:
    Detect '<' → Script Data Less-Than Sign State
    → Check whether '</script>' matches
    → If no match, treat everything as text

  This allows the following code to be processed correctly:

  <script>
    var html = "<div>This is a JS string, not HTML</div>";
    if (a < b && c > d) { /* < and > are not tags */ }
  </script>

  Note: </script> signals the end of the script
  → Writing the string literal "</script>" directly inside
    a script will cause an unintended early termination

  Workarounds:
  <script>
    // BAD: var s = "</script>";
    // OK:  var s = "<\/script>";
    // OK:  var s = "<" + "/script>";
  </script>
```

---

## 3. HTML Tree Builder (Parsing and DOM Construction)

### 3.1 State Management via Insertion Mode

The HTML tree builder converts tokens received from the tokenizer into the DOM tree. The tree builder is also implemented as a state machine, maintaining a state called the "Insertion Mode."

The HTML Living Standard defines the following insertion modes.

```
List of key insertion modes:

  ┌─ Initial state ────────────────────────────────────┐
  │  initial                                            │
  │    → Process DOCTYPE token                          │
  │    → Transition to before html                      │
  ├─────────────────────────────────────────────────────┤
  │  before html                                        │
  │    → Process <html> StartTag                        │
  │    → Transition to before head                      │
  ├─────────────────────────────────────────────────────┤
  │  before head                                        │
  │    → Process <head> StartTag                        │
  │    → Transition to in head                          │
  ├─────────────────────────────────────────────────────┤
  │  in head                                            │
  │    → Process <meta>, <title>, <link>, <style>,      │
  │      <script>, etc.                                 │
  │    → </head> transitions to after head              │
  ├─────────────────────────────────────────────────────┤
  │  in head noscript                                   │
  │    → Processing inside <noscript>                   │
  ├─────────────────────────────────────────────────────┤
  │  after head                                         │
  │    → Process <body> StartTag                        │
  │    → Transition to in body                          │
  ├─────────────────────────────────────────────────────┤
  │  in body                                            │
  │    → Processes all elements in the document body    │
  │    → The most complex mode                          │
  ├─────────────────────────────────────────────────────┤
  │  in table                                           │
  │    → Processing inside <table>                      │
  │    → The mode where foster parenting occurs         │
  ├─────────────────────────────────────────────────────┤
  │  in row / in cell / in caption                      │
  │    → Processing each part within a table            │
  ├─────────────────────────────────────────────────────┤
  │  in select                                          │
  │    → Processing inside <select>                     │
  ├─────────────────────────────────────────────────────┤
  │  after body                                         │
  │    → Processing after </body>                       │
  │    → Transitions to after after body                │
  ├─────────────────────────────────────────────────────┤
  │  in frameset / after frameset                       │
  │    → Processing framesets (legacy)                  │
  ├─────────────────────────────────────────────────────┤
  │  after after body                                   │
  │    → Processing after </html>                       │
  │    → Completes on EOF                               │
  └─────────────────────────────────────────────────────┘
```

### 3.2 Stack of Open Elements

The tree builder maintains a "stack of open elements." This stack is a data structure for tracking nested element structure.

**Code Example 3: Tracing Changes to the Stack of Open Elements**

```html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <div>
    <p>Hello <strong>World</strong></p>
  </div>
</body>
</html>
```

```
Changes to the stack of open elements:

  Token                    Stack state             Insertion mode
  ─────────────────────────────────────────────────────────────
  DOCTYPE html             []                      initial
                           []                      before html
  <html>                   [html]                  before head
  <head>                   [html, head]             in head
  <title>                  [html, head, title]      text
  "Test"                   [html, head, title]      text
  </title>                 [html, head]             in head
  </head>                  [html]                   after head
  <body>                   [html, body]             in body
  <div>                    [html, body, div]        in body
  <p>                      [html, body, div, p]     in body
  "Hello "                 [html, body, div, p]     in body
  <strong>                 [html, body, div, p,     in body
                            strong]
  "World"                  [html, body, div, p,     in body
                            strong]
  </strong>                [html, body, div, p]     in body
  </p>                     [html, body, div]        in body
  </div>                   [html, body]             in body
  </body>                  [html]                   after body
  </html>                  []                       after after body
  EOF                      (complete)

  Generated DOM tree:
  Document
  ├── DOCTYPE: html
  └── html
      ├── head
      │   └── title
      │       └── "Test"
      └── body
          └── div
              └── p
                  ├── "Hello "
                  └── strong
                      └── "World"
```

### 3.3 Error Recovery and Implicit Element Completion

The hallmark of the HTML parser is that it **recovers from malformed HTML without throwing an error**. This is specified in detail in the HTML Living Standard.

**Code Example 4: Error Recovery in Action**

```html
<!-- Input (malformed HTML) -->
<p>First
<p>Second
<div><span></div>
<table><td>Cell</table>
```

```
Error recovery by the parser:

  Input: <p>First<p>Second
  ──────────────────────
  1. Process <p>First: create p element, append "First" text
  2. Encounter second <p>:
     → The current p is still open
     → Spec: when receiving a <p> StartTag in "in body" mode
       while a p is on the stack, implicitly close it
     → Insert an implicit </p>
     → Create a new p element
  3. Result:
     <p>First</p>        ← implicit end tag
     <p>Second</p>       ← implicit end tag

  Input: <div><span></div>
  ──────────────────────
  1. Create <div>, push onto stack
  2. Create <span>, push onto stack: [html, body, div, span]
  3. Receive </div>:
     → span on the stack has not been closed
     → Spec: </div> unwinds the stack back to div
     → Implicitly close span
  4. Result:
     <div><span></span></div>

  Input: <table><td>Cell</table>
  ──────────────────────────────
  1. Create <table>, switch insertion mode to "in table"
  2. Receive <td>:
     → <td> should be inside <tr>
     → Spec: implicitly generate <tbody> and <tr>
  3. Result:
     <table>
       <tbody>          ← implicitly generated
         <tr>           ← implicitly generated
           <td>Cell</td>
         </tr>
       </tbody>
     </table>
```

### 3.4 Foster Parenting

When invalid elements or text appear inside table elements, the browser performs a special process called "foster parenting."

```
How foster parenting works:

  Input:
  <table>
    <tr>
      <td>Valid position</td>
    </tr>
    Text outside the table
    <div>Element outside the table</div>
  </table>

  Problem:
  → Text and <div> cannot be direct children of <table>
  → Inside <table>, only <thead>, <tbody>, <tfoot>,
    <tr>, <caption>, <colgroup>, and <col> are allowed

  Foster parenting result:
  Invalid elements are moved to the position "before" the table

  Result in the DOM:
  Text outside the table           ← moved before table
  <div>Element outside the table</div>  ← moved before table
  <table>
    <tbody>
      <tr>
        <td>Valid position</td>
      </tr>
    </tbody>
  </table>

  → Inspecting in DevTools shows the text and div
    have been moved before the table tag
```

### 3.5 Active Formatting Elements List

The HTML parser applies special "reconstruction" processing to formatting elements such as `<b>`, `<i>`, `<em>`, `<strong>`, `<a>`, and `<font>`.

```
Adoption Agency Algorithm:

  Input: <p>Normal <b>Bold <i>Both</b> Italic?</i></p>

  Problem:
  → <b> and <i> are interleaved (crossed nesting)
  → Must be converted to a valid tree structure

  Result of Adoption Agency Algorithm:
  <p>
    Normal
    <b>Bold <i>Both</i></b>
    <i> Italic?</i>
  </p>

  → When </b> is encountered, <i> is temporarily closed,
    then after </b>, <i> is reopened
  → Consistent behavior across browsers (defined in the spec)
```

---

## 4. DOM Structure and Internal Representation

### 4.1 DOM Node Types

The DOM (Document Object Model) is a programming interface that represents an HTML document as a tree of objects.

```
DOM node hierarchy:

  Node (abstract base class)
  ├── Document           nodeType = 9   Root node
  ├── DocumentType       nodeType = 10  <!DOCTYPE html>
  ├── DocumentFragment   nodeType = 11  Virtual container
  ├── Element            nodeType = 1   HTML element
  │   ├── HTMLElement
  │   │   ├── HTMLDivElement
  │   │   ├── HTMLParagraphElement
  │   │   ├── HTMLInputElement
  │   │   ├── HTMLAnchorElement
  │   │   └── ... (class for each HTML element)
  │   └── SVGElement
  │       ├── SVGSVGElement
  │       └── ...
  ├── Attr               nodeType = 2   Attribute node
  ├── Text               nodeType = 3   Text node
  ├── Comment            nodeType = 8   Comment node
  └── CDATASection       nodeType = 4   CDATA (XML only)
```

### 4.2 Key Properties and Methods of DOM Nodes

```
Navigating between nodes:

  parentNode                  ← Parent node
  childNodes                  ← List of child nodes (NodeList)
  firstChild / lastChild      ← First/last child
  previousSibling / nextSibling  ← Previous/next sibling
  children                    ← Child elements only (HTMLCollection)
  firstElementChild           ← First child element
  parentElement               ← Parent element

  ┌────────────────────────────────────────────────────┐
  │  Property            │ All nodes   │ Elements only  │
  ├──────────────────────┼─────────────┼────────────────┤
  │  Child node list     │ childNodes  │ children       │
  │  First child         │ firstChild  │ firstElem.     │
  │  Last child          │ lastChild   │ lastElem.      │
  │  Next sibling        │ nextSibling │ nextElem.      │
  │  Previous sibling    │ prevSibling │ prevElem.      │
  └──────────────────────┴─────────────┴────────────────┘

  * childNodes includes text nodes and comments
  * children includes only Element nodes
```

### 4.3 Internal DOM Representation in the Browser Engine

Internally in the browser engine, the DOM is implemented as C++ objects. JavaScript DOM access goes through a binding layer.

```
Internal DOM representation in Blink (Chrome):

  C++ side:
  ┌──────────────────────────────────┐
  │  blink::Node                     │
  │  ├── parent_: Node*              │
  │  ├── previous_: Node*            │
  │  ├── next_: Node*                │
  │  ├── first_child_: Node*         │
  │  ├── tree_scope_: TreeScope*     │
  │  └── node_flags_: unsigned       │
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │  blink::Element : Node           │
  │  ├── tag_name_: AtomicString     │
  │  ├── attributes_: AttributeMap   │
  │  ├── computed_style_: ComputedStyle* │
  │  └── class_list_: DOMTokenList*  │
  └──────────────────────────────────┘

  JavaScript side (V8 binding):
  ┌──────────────────────────────────┐
  │  v8::Object (JS object)          │
  │  └── internal_field_ ──→ blink::Node* │
  └──────────────────────────────────┘

  Cost of accessing the DOM from JS:
  1. Dereference the V8 JS object
  2. Retrieve the C++ pointer from internal field
  3. Call the method on the C++ object
  4. Convert the return value to a V8 JS value
  → This round-trip cost is the overhead of DOM operations
```

---

## 5. CSS Parsing and CSSOM Construction

### 5.1 CSS Lexical Analysis (Tokenization)

Unlike the HTML parser, the CSS parser operates on a **context-free grammar (CFG)**. The tokenization algorithm defined in CSS Syntax Module Level 3 converts CSS text into a token sequence.

```
CSS token types:

  ┌────────────────────┬──────────────────────────────────────┐
  │ Token type         │ Example                              │
  ├────────────────────┼──────────────────────────────────────┤
  │ <ident-token>      │ color, margin, div, .class           │
  │ <function-token>   │ rgb(, calc(, var(                    │
  │ <at-keyword-token> │ @media, @import, @keyframes          │
  │ <hash-token>       │ #id, #ff0000                         │
  │ <string-token>     │ "hello", 'world'                     │
  │ <number-token>     │ 42, 3.14, -1                         │
  │ <percentage-token> │ 50%, 100%                            │
  │ <dimension-token>  │ 16px, 2em, 100vh, 300ms              │
  │ <url-token>        │ url(image.png)                       │
  │ <delim-token>      │ ., >, +, ~, *, |                     │
  │ <colon-token>      │ :                                    │
  │ <semicolon-token>  │ ;                                    │
  │ <comma-token>      │ ,                                    │
  │ <{-token>          │ {                                    │
  │ <}-token>          │ }                                    │
  │ <(-token>          │ (                                    │
  │ <)-token>          │ )                                    │
  │ <[-token>          │ [                                    │
  │ <]-token>          │ ]                                    │
  │ <whitespace-token> │ space, tab, newline                  │
  │ <CDC-token>        │ -->                                  │
  │ <CDO-token>        │ <!--                                 │
  │ <EOF-token>        │ End of input                         │
  └────────────────────┴──────────────────────────────────────┘
```

**Code Example 5: CSS Tokenization Example**

```css
.container > .item {
  color: rgba(255, 0, 0, 0.5);
  font-size: calc(16px + 2vw);
  --custom-prop: #333;
}
```

```
Tokenization result:

  <delim-token: .>
  <ident-token: container>
  <whitespace-token>
  <delim-token: >>
  <whitespace-token>
  <delim-token: .>
  <ident-token: item>
  <whitespace-token>
  <{-token>
  <whitespace-token>
  <ident-token: color>
  <colon-token>
  <whitespace-token>
  <function-token: rgba>
  <number-token: 255>
  <comma-token>
  <whitespace-token>
  <number-token: 0>
  <comma-token>
  <whitespace-token>
  <number-token: 0>
  <comma-token>
  <whitespace-token>
  <number-token: 0.5>
  <)-token>
  <semicolon-token>
  <whitespace-token>
  <ident-token: font-size>
  <colon-token>
  <whitespace-token>
  <function-token: calc>
  <dimension-token: 16px>
  <whitespace-token>
  <delim-token: +>
  <whitespace-token>
  <dimension-token: 2vw>
  <)-token>
  <semicolon-token>
  <whitespace-token>
  <ident-token: --custom-prop>
  <colon-token>
  <whitespace-token>
  <hash-token: 333>
  <semicolon-token>
  <whitespace-token>
  <}-token>
  <EOF-token>
```

### 5.2 CSS Parsing

The token sequence is converted by the CSS parser into a structured set of rules. The CSS grammar is defined with the following structure.

```
CSS grammar structure (BNF-style notation):

  stylesheet  ::= rule*
  rule        ::= at-rule | qualified-rule
  at-rule     ::= '@' IDENT component-value* ('{' rule* '}' | ';')
  qualified-rule ::= component-value* '{' declaration-list '}'
  declaration-list ::= declaration (';' declaration)* ';'?
  declaration ::= IDENT ':' component-value+ ('!' 'important')?

Selector grammar:
  selector-list    ::= complex-selector (',' complex-selector)*
  complex-selector ::= compound-selector (combinator compound-selector)*
  compound-selector ::= type-selector? (class-selector | id-selector |
                         attr-selector | pseudo-class)* pseudo-element?
  combinator       ::= '>' | '+' | '~' | ' ' (descendant)

  Example: div.container > ul.menu li.active a:hover::before
  Decomposition:
  ├── compound: div.container
  ├── combinator: > (child)
  ├── compound: ul.menu
  ├── combinator: ' ' (descendant)
  ├── compound: li.active
  ├── combinator: ' ' (descendant)
  └── compound: a:hover::before
```

### 5.3 CSSOM Structure

The CSSOM (CSS Object Model) is an object model for programmatic manipulation of CSS.

```
CSSOM tree structure:

  document.styleSheets (StyleSheetList)
  ├── StyleSheet[0] (CSSStyleSheet)
  │   │  href: null (inline <style>)
  │   │  media: MediaList
  │   │  ownerNode: <style> element
  │   │  disabled: false
  │   │
  │   └── cssRules (CSSRuleList)
  │       ├── CSSStyleRule[0]
  │       │   │  selectorText: "body"
  │       │   │  style.cssText: "margin: 0; font-family: sans-serif;"
  │       │   └── style (CSSStyleDeclaration)
  │       │       ├── margin: "0"
  │       │       └── fontFamily: "sans-serif"
  │       │
  │       ├── CSSStyleRule[1]
  │       │   │  selectorText: ".container"
  │       │   └── style (CSSStyleDeclaration)
  │       │       ├── maxWidth: "1200px"
  │       │       └── margin: "0 auto"
  │       │
  │       └── CSSMediaRule[2]
  │           │  conditionText: "(max-width: 768px)"
  │           │  media: MediaList ["(max-width: 768px)"]
  │           └── cssRules (CSSRuleList)
  │               └── CSSStyleRule[0]
  │                   │  selectorText: ".container"
  │                   └── style
  │                       └── maxWidth: "100%"
  │
  └── StyleSheet[1] (CSSStyleSheet)
      │  href: "styles.css" (external)
      │  ownerNode: <link> element
      └── cssRules (CSSRuleList)
          └── ...

CSSRule types:
  ┌──────────────────────────┬──────┬───────────────────────┐
  │ Rule type                │ type │ Description            │
  ├──────────────────────────┼──────┼───────────────────────┤
  │ CSSStyleRule             │ 1    │ Normal style rule      │
  │ CSSImportRule            │ 3    │ @import                │
  │ CSSMediaRule             │ 4    │ @media                 │
  │ CSSFontFaceRule          │ 5    │ @font-face             │
  │ CSSKeyframesRule         │ 7    │ @keyframes             │
  │ CSSSupportsRule          │ 12   │ @supports              │
  │ CSSLayerBlockRule        │ --   │ @layer                 │
  │ CSSContainerRule         │ --   │ @container             │
  └──────────────────────────┴──────┴───────────────────────┘
```

### 5.4 Style Resolution

After the DOM tree and CSSOM are built, the browser calculates the final style (Computed Style) for each DOM element. This process proceeds through the following steps.

```
Overall style resolution flow:

  Step 1: Collect style sources
  ┌─────────────────────────────────────────────────┐
  │  User Agent Stylesheet (browser defaults)        │
  │  ↓                                              │
  │  User Stylesheet (user preferences)             │
  │  ↓                                              │
  │  Author Stylesheet (developer CSS)              │
  │    - External CSS (<link>)                       │
  │    - Internal CSS (<style>)                      │
  │    - Inline CSS (style="...")                    │
  │  ↓                                              │
  │  CSS Animations / Transitions                    │
  └─────────────────────────────────────────────────┘

  Step 2: Selector matching
  → Evaluate selectors of all CSS rules against each DOM element
  → Collect declarations from matching rules

  Step 3: Cascade
  → Sort matched declarations in priority order

  Cascade order (lowest to highest priority):
  ┌─────────────────────────────────────────────────┐
  │  1. Normal User Agent declarations               │
  │  2. Normal User declarations                     │
  │  3. Normal Author declarations                   │
  │  4. CSS Animations                               │
  │  5. !important Author declarations               │
  │  6. !important User declarations                 │
  │  7. !important User Agent declarations           │
  │  8. CSS Transitions                              │
  └─────────────────────────────────────────────────┘

  * When CSS Cascade Layers (@layer) are added,
    finer-grained priority control within the same origin is possible

  Step 4: Specificity calculation
  → Used when declarations at the same cascade level conflict

  Specificity formula: (A, B, C)
  ┌──────────────────────────────┬──────────┬──────┐
  │ Selector                     │ (A,B,C)  │ Value│
  ├──────────────────────────────┼──────────┼──────┤
  │ *                            │ (0,0,0)  │ 0    │
  │ li                           │ (0,0,1)  │ 1    │
  │ ul li                        │ (0,0,2)  │ 2    │
  │ .active                      │ (0,1,0)  │ 10   │
  │ li.active                    │ (0,1,1)  │ 11   │
  │ #nav                         │ (1,0,0)  │ 100  │
  │ #nav .active                 │ (1,1,0)  │ 110  │
  │ #nav ul li.active a          │ (1,1,3)  │ 113  │
  │ :is(#nav) .item              │ (1,1,0)  │ 110  │
  │ :where(#nav) .item           │ (0,1,0)  │ 10   │
  │ style="" (inline)            │ highest  │ --   │
  └──────────────────────────────┴──────────┴──────┘

  Note: :is() uses the maximum specificity of its arguments
        :where() always has specificity 0
        :not() uses the specificity of its arguments

  Step 5: Declared value determination
  → Determine the final declared value using cascade + specificity + source order

  Step 6: Specified value determination
  → If no declared value: inherit or initial value
  → Resolve inherit, initial, unset, revert

  Inherited vs. non-inherited properties:
  ┌───────────────────────┬────────────────────────┐
  │ Inherited             │ Not inherited           │
  ├───────────────────────┼────────────────────────┤
  │ color                 │ margin                 │
  │ font-family           │ padding                │
  │ font-size             │ border                 │
  │ line-height           │ width / height         │
  │ text-align            │ display                │
  │ visibility            │ position               │
  │ cursor                │ background             │
  │ list-style            │ overflow               │
  │ letter-spacing        │ flex / grid properties │
  └───────────────────────┴────────────────────────┘

  Step 7: Computed value calculation
  → Convert relative values to absolute values
  → em, rem → px
  → percentage → px (with some exceptions)
  → currentColor → actual color value
  → inherit → parent's computed value

  Step 8: Used value calculation
  → Final value needed for layout calculation
  → auto → actual px value
  → percentage (width, etc.) → actual px value

  Step 9: Actual value calculation
  → Final adjustments to fit device constraints
  → Sub-pixel rounding
  → Font fallback for unavailable fonts
```

### 5.5 Selector Matching Optimization

Browsers use multiple optimization techniques to efficiently match all DOM elements against all CSS rules.

```
Right-to-left selector evaluation:

  Selector: #main .content p a.link

  Naive approach (left-to-right):
  1. Find #main
  2. Find .content among its descendants → traverse many descendants
  3. Find p among those descendants → traverse further
  4. Find a.link among those descendants → traverse even further
  → Candidates can "fan out" at each step
  → Failing paths cannot be detected until the end

  Actual browsers (right-to-left):
  1. Find all a.link (the key selector) → relatively few on the page
  2. Check whether each a.link has p as an ancestor
  3. Check whether that ancestor has .content
  4. Check whether that ancestor has #main
  → The key selector greatly narrows down candidates
  → Traversing the ancestor chain is a single path, so it is low cost
  → Failure can be determined at an early stage

Bloom Filter acceleration:
  → Record id, class, and tag name found in the ancestor chain
    of a DOM element in a Bloom Filter
  → If an ancestor required by a selector is absent from the Bloom Filter,
    it definitely does not match (fast negative determination)
  → False positives are possible, but false negatives are not

Style sharing:
  → When sibling elements share the same class and attributes,
    share the Computed Style to reduce calculation cost
  → Conditions: same tag name, same class, same attributes,
    matching same selectors from the same parent element's style
```

### 5.6 CSS Parser Error Handling

The CSS parser is also tolerant of errors; it skips unrecognized properties or values and continues processing.

```
CSS error recovery example:

  /* Unknown property → skip */
  .box {
    color: red;         /* OK: applied */
    colr: blue;         /* NG: skipped (typo) */
    font-size: 16px;    /* OK: applied */
  }

  /* Invalid value → skip only that declaration */
  .box {
    width: 100px;       /* OK: applied */
    width: abc;         /* NG: skipped */
    height: 50px;       /* OK: applied */
  }

  /* Invalid selector → skip entire rule */
  .valid { color: red; }           /* OK: applied */
  .invalid[[ { color: blue; }      /* NG: entire rule skipped */
  .also-valid { color: green; }    /* OK: applied */

  /* Mismatched braces → attempt recovery */
  .box { color: red;
    /* Missing '}' → skip forward to the next '}' */
  .next { color: blue; }

This "forward compatibility" is a core CSS design philosophy,
allowing older browsers to process stylesheets containing new CSS syntax
by skipping the unknown parts.
```

---

## 6. Render Tree Construction

### 6.1 DOM and CSSOM Integration

The render tree (also called the Layout Tree) is built by integrating the DOM tree with the CSSOM. Each visible element is annotated with its finalized style information.

```
DOM + CSSOM → Render Tree in detail:

  DOM tree:                      CSSOM rules:
  Document                       body { font: 16px/1.5 sans-serif; }
  └── html                       h1 { font-size: 2em; color: #333; }
      ├── head                    p { margin: 1em 0; }
      │   ├── title               .hidden { display: none; }
      │   ├── style               .invisible { visibility: hidden; }
      │   └── link                img { max-width: 100%; }
      └── body                    ::before { content: "★"; }
          ├── h1
          ├── p
          ├── div.hidden
          ├── div.invisible
          ├── img
          └── script

  Render tree (construction result):
  RenderView (viewport)
  └── RenderBody
      │  font: 16px/1.5 sans-serif
      ├── RenderBlock (h1)
      │   │  font-size: 32px; color: #333
      │   ├── RenderInline (::before pseudo)
      │   │   └── "★"
      │   └── RenderText: heading text
      ├── RenderBlock (p)
      │   │  margin: 16px 0
      │   └── RenderText: paragraph text
      ├── RenderBlock (div.invisible)    ← visibility:hidden is included
      │   │  visibility: hidden
      │   └── (child elements...)
      ├── RenderImage (img)
      │   └── max-width: 100%
      │
      │  * head element not included (UA style sets display: none)
      │  * div.hidden not included (display: none)
      │  * script element not included (UA style sets display: none)
      └── (end)

  Elements excluded from the render tree:
  ┌────────────────────────┬──────────────────────────────┐
  │ Element                │ Reason                        │
  ├────────────────────────┼──────────────────────────────┤
  │ <head> and children    │ UA style: display: none       │
  │ <script>               │ UA style: display: none       │
  │ display: none elements │ Explicitly hidden             │
  │ <meta>, <link>         │ UA style: display: none       │
  └────────────────────────┴──────────────────────────────┘

  Elements included in the render tree but not visible:
  ┌────────────────────────┬──────────────────────────────┐
  │ Element                │ Reason                        │
  ├────────────────────────┼──────────────────────────────┤
  │ visibility: hidden     │ Takes up space but transparent│
  │ opacity: 0             │ Fully transparent, takes space│
  │ position: absolute +   │ Positioned off-screen         │
  │   left: -9999px        │                               │
  │ clip-path: inset(100%) │ Completely clipped            │
  └────────────────────────┴──────────────────────────────┘
```

### 6.2 Inserting Pseudo-Elements into the Render Tree

`::before` and `::after` pseudo-elements do not exist in the DOM, but they are included in the render tree.

```
Handling of pseudo-elements:

  CSS:
  .quote::before {
    content: "\u300C";
    color: gray;
  }
  .quote::after {
    content: "\u300D";
    color: gray;
  }

  DOM:
  <p class="quote">Important words</p>

  DOM tree (pseudo-elements are not included):
  p.quote
  └── "Important words"

  Render tree (pseudo-elements are included):
  RenderBlock (p.quote)
  ├── RenderInline (::before)
  │   └── RenderText: "\u300C"
  ├── RenderText: "Important words"
  └── RenderInline (::after)
      └── RenderText: "\u300D"

  → Pseudo-elements cannot be accessed via the DOM API
  → querySelectorAll('::before') does not work
  → getComputedStyle(el, '::before') can retrieve only styles
```

### 6.3 Anonymous Box Generation

In the render tree, "anonymous boxes" may be automatically generated in accordance with the CSS visual formatting model.

```
Anonymous box example:

  DOM:
  <div>
    Text 1
    <p>Paragraph</p>
    Text 2
  </div>

  CSS:
  div { display: block; }
  p { display: block; }

  Render tree:
  RenderBlock (div)
  ├── RenderBlock (anonymous)    ← anonymous block box
  │   └── RenderText: "Text 1"
  ├── RenderBlock (p)
  │   └── RenderText: "Paragraph"
  └── RenderBlock (anonymous)    ← anonymous block box
      └── RenderText: "Text 2"

  Reason:
  → When a block element (div) has a mix of text and block elements
    as direct children, text is wrapped in an anonymous block box
  → CSS rule: a block container should have only block-level children
    or only inline-level children
  → When both are mixed, anonymous boxes wrap them to unify the type
```

---

## 7. Incremental Parsing and Speculative Parsing

### 7.1 Streaming Parse (Incremental Parsing)

The HTML parser parses received chunks incrementally without waiting for the entire network data.

```
Incremental parsing in action:

  Network reception:
  ──────────────────────────────────────────────────→ time
  │chunk1│      │chunk2│      │chunk3│      │chunk4│
  │<html>│      │<body>│      │<div> │      │</div>│
  │<head>│      │  <h1>│      │  <p> │      │</body│
  │...   │      │  ... │      │  ... │      │</html│

  Parser behavior:
  ──────────────────────────────────────────────────→ time
  │parse1│      │parse2│      │parse3│      │parse4│
  │build │      │add   │      │add   │      │done  │
  │ DOM  │      │ DOM  │      │ DOM  │      │      │
        ↓             ↓             ↓
      DOM subtree grows continuously before DOMContentLoaded

  Benefits:
  → First Contentful Paint happens earlier
  → Users can see content before the entire HTML download completes
  → Responsiveness improves regardless of total HTML size

  Constraints:
  → The parser cannot predict the structure of unreceived portions
  → Parsing may be blocked by <script> tags
```

### 7.2 Parser Blocking and How to Avoid It

Synchronous `<script>` tags block the HTML parser. This is because scripts may modify the parser's input stream via `document.write()`.

```
Types of parser blocking:

  1. Synchronous scripts (parser-blocking)
  ──────────────────────────────────────────────────
  <script src="app.js"></script>

  Parser: [parse]→[stop......DL......execute]→[resume]
                  ↑                           ↑
             script found              resume after execution

  2. async scripts (non-parser-blocking)
  ──────────────────────────────────────────────────
  <script src="app.js" async></script>

  Parser: [parse]→[continue parsing]→[continue]→[done]
  Script:         [DL.............]→[execute]
                   ↑ Downloads in parallel; executes as soon as DL completes

  3. defer scripts (non-parser-blocking)
  ──────────────────────────────────────────────────
  <script src="app.js" defer></script>

  Parser: [parse]→[continue parsing]→[done]→[execute]
  Script:         [DL.................]      ↑
                                       executes in source order
                                       before DOMContentLoaded

  4. module scripts (equivalent to defer)
  ──────────────────────────────────────────────────
  <script type="module" src="app.mjs"></script>

  → Behaves like defer by default
  → Adding async attribute changes it to async behavior

  Comparison table:
  ┌──────────┬────────────┬──────────────────┬─────────────┐
  │ Attribute│ Parser     │ Execution timing  │ Order       │
  │          │ blocking   │                  │             │
  ├──────────┼────────────┼──────────────────┼─────────────┤
  │ none     │ yes        │ right after DL   │ source order│
  │ async    │ no         │ right after DL   │ unspecified │
  │ defer    │ no         │ after DOM built  │ source order│
  │ module   │ no         │ after DOM built  │ source order│
  │ module   │ no         │ right after DL   │ unspecified │
  │ +async   │            │                  │             │
  └──────────┴────────────┴──────────────────┴─────────────┘
```

### 7.3 Speculative Parsing (Preload Scanner)

While the main parser is blocked by script execution, the browser runs a lightweight parser called the "Preload Scanner" in parallel.

```
How speculative parsing works:

  Main parser:
  [parse]→[blocked (script DL+execute)]→[resume]→[parse]
                  ↓ simultaneously
  Preload Scanner:
           [ahead scanning.......................]
           Found: <link rel="stylesheet" href="styles.css">
           Found: <script src="other.js">
           Found: <img src="hero.jpg">
                  ↓
  Network:
           [styles.css DL start]
           [other.js DL start]
           [hero.jpg DL start]

  Resources detected by the Preload Scanner:
  → <link rel="stylesheet" href="...">
  → <script src="...">
  → <img src="...">
  → <video src="..."> / <source src="...">
  → <link rel="preload" href="...">

  What the Preload Scanner does NOT do:
  → Build the DOM tree
  → Parse CSS
  → Execute JavaScript
  → Calculate layout
  → Only discovers resource URLs and initiates network requests

  Performance impact:
  → Conditions where the Preload Scanner is effective:
    When many resource references follow a synchronous <script>
  → Conditions where it has no effect:
    When all resources are declared before <script> tags in <head>
```

---

## 8. Render-Blocking Effect of CSS

### 8.1 CSS Render Blocking

CSS is not parser-blocking, but it is **render-blocking**. This means the browser will not start painting until CSS has finished loading.

```
CSS render-blocking behavior:

  HTML parser:
  [start parsing]→[find <link>]→[continue parsing]→[DOM done]
                      ↓
  CSS download:
               [DL.................]→[build CSSOM]
                                              ↓
  Rendering:                          [waiting......]→[build render tree]→[paint]
                                      ↑
                               Rendering does not start
                               until CSSOM construction completes

  Reason:
  → Rendering without CSSOM causes FOUC (Flash of Unstyled Content)
  → A momentary flash of unstyled content severely harms user experience
  → Therefore the browser waits for CSSOM construction to complete

  Case where CSS also blocks JavaScript:
  → When a <script> follows <link rel="stylesheet">
  → Script execution is also delayed until CSS finishes loading
  → This is because the script may reference the Computed Style
  <link rel="stylesheet" href="styles.css">
  <script>
    // Not executed until styles.css finishes loading
    // Guarantees that getComputedStyle() returns correct values
    const style = getComputedStyle(document.body);
  </script>
```

### 8.2 Critical CSS and Resource Hints

This section explains techniques to minimize the impact of render blocking.

**Code Example 6: Inlining Critical CSS**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <!-- Critical CSS: inline the minimum styles needed for above-the-fold content -->
  <style>
    /* Only styles required for the first viewport */
    body { margin: 0; font-family: sans-serif; }
    .header { background: #333; color: white; padding: 1rem; }
    .hero { padding: 2rem; text-align: center; }
    .hero h1 { font-size: 2.5rem; margin: 0; }
  </style>

  <!-- Load non-critical CSS asynchronously -->
  <link rel="preload" href="styles.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="styles.css"></noscript>

  <!-- Resource hints -->
  <link rel="dns-prefetch" href="//fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" href="hero-image.webp" as="image">
</head>
<body>
  <header class="header">Site Name</header>
  <section class="hero">
    <h1>Welcome</h1>
  </section>
  <!-- Content below will have styles applied after async CSS finishes loading -->
</body>
</html>
```

```
Resource hint types and effects:

  ┌────────────────────┬───────────────────────────────────┐
  │ Hint               │ Effect                            │
  ├────────────────────┼───────────────────────────────────┤
  │ dns-prefetch       │ Pre-resolve DNS only              │
  │ preconnect         │ Pre-execute DNS + TCP + TLS       │
  │ preload            │ Pre-fetch resource at high priority│
  │ prefetch           │ Pre-fetch resource needed for     │
  │                    │ the next navigation at low priority│
  │ modulepreload      │ Pre-fetch and parse ES Module     │
  └────────────────────┴───────────────────────────────────┘
```

---

## 9. Anti-Patterns and Remedies

### 9.1 Anti-Pattern 1: Using document.write()

`document.write()` is an API that inserts text directly into the parser's input stream, causing many problems.

```
document.write() anti-pattern:

  Problematic code:
  <script>
    document.write('<link rel="stylesheet" href="dynamic.css">');
    document.write('<script src="analytics.js"><\/script>');
  </script>

  Problems:
  1. Parser blocking
     → Scripts inside document.write() also block the parser
     → Nested blocking occurs

  2. Disabling the Speculative Parser
     → document.write() changes the parser's input
     → Resources discovered by the Preload Scanner may be invalidated
     → Browser optimizations stop working

  3. Automatic blocking on slow connections
     → Chrome blocks external script loading via document.write()
       on 2G connections (Intervention)

  4. Destroying the document when called from async scripts
     → Calling document.write() after DOMContentLoaded replaces
       the entire document

  Alternatives:
  // BAD: document.write()
  document.write('<script src="analytics.js"><\/script>');

  // OK: use the DOM API
  const script = document.createElement('script');
  script.src = 'analytics.js';
  script.async = true;
  document.head.appendChild(script);

  // OK: use insertAdjacentHTML
  document.body.insertAdjacentHTML('beforeend',
    '<div class="dynamic-content">Dynamic content</div>');
```

### 9.2 Anti-Pattern 2: Excessively Deep Selector Nesting

```
Excessively deep selector anti-pattern:

  BAD: deeply nested selectors (poor performance)
  ────────────────────────────────────────────
  #app > .main-content > .sidebar > .widget-area >
  .widget > .widget-header > h3 > span.icon {
    color: blue;
  }

  Problems:
  1. Increased selector matching cost
     → Evaluated right-to-left: first find all span.icon
     → For each candidate, traverse 7 levels of the ancestor chain
     → Matching cost grows proportionally to DOM depth

  2. Excessively high specificity
     → High specificity of (1, 1, 4)
     → Overriding requires !important, creating a vicious cycle

  3. Strong dependency on HTML structure
     → Changing HTML structure breaks styles
     → Maintainability degrades significantly

  OK: Flat selectors with BEM naming
  ────────────────────────────────────────────
  .widget__header-icon {
    color: blue;
  }

  → Specificity (0, 1, 0)
  → No dependency on DOM structure
  → Minimum matching cost
  → Easy to override

  OK: CSS Custom Properties + component design
  ────────────────────────────────────────────
  .widget {
    --icon-color: blue;
  }
  .widget .icon {
    color: var(--icon-color);
  }

  → Only two levels of nesting needed
  → Theming with custom properties is also easy
```

### 9.3 Anti-Pattern 3: Chained CSS Loading with @import

```
@import chain anti-pattern:

  styles.css:
    @import url('reset.css');
    @import url('layout.css');
    @import url('components.css');

  components.css:
    @import url('buttons.css');
    @import url('forms.css');

  Problems:
  → @import causes sequential downloading
  → After styles.css DL completes → reset.css, layout.css, components.css start
  → After components.css DL completes → buttons.css, forms.css start
  → A waterfall request chain occurs

  ┌──────────────────────────────────────────────────┐
  │ <link>                     │ @import              │
  ├────────────────────────────┼──────────────────────┤
  │ Parallel download           │ Sequential download  │
  │ Detectable by Preload Scanner│ Discovered after   │
  │                             │  CSS parse          │
  │ Fast                        │ Slow                │
  └────────────────────────────┴──────────────────────┘

  Solution:
  <!-- BAD: @import chain -->
  <link rel="stylesheet" href="styles.css">

  <!-- OK: load everything in parallel with <link> -->
  <link rel="stylesheet" href="reset.css">
  <link rel="stylesheet" href="layout.css">
  <link rel="stylesheet" href="buttons.css">
  <link rel="stylesheet" href="forms.css">

  <!-- Even better: bundle into one file with a build tool -->
  <link rel="stylesheet" href="bundle.css">
```

---

## 10. Edge Case Analysis

### 10.1 Edge Case 1: Encoding Misdetection and Parse Failure

```
Encoding misdetection scenario:

  Situation:
  → Server returns Content-Type: text/html (no charset)
  → HTML has no <meta charset>
  → HTML contains multi-byte character content
  → Browser determines encoding as UTF-8

  Problems that occur:
  1. In the middle of a multi-byte character, a byte equivalent to
     the tag delimiter '<' may appear
  2. Inside an attribute value, a byte equivalent to a quote '"' may appear
  3. Parser detects unintended tags or comments

  Example:
  "Omote" (表) in Shift_JIS = 0x95 0x5C
  → 0x5C is ASCII '\' (backslash)
  → Interpreted as UTF-8, it becomes an invalid byte sequence
  → Not only garbled characters result, but
    the DOM structure itself may be corrupted

  "So" (ソ) in Shift_JIS = 0x83 0x5C
  → Also contains 0x5C
  → In CSS url(), it may be misidentified as a path separator

  Remedies:
  → Always use UTF-8 and declare it in both the HTTP header and meta tag
  → Content-Type: text/html; charset=UTF-8
  → <meta charset="UTF-8"> (placed as the first element in head)
  → Adding a BOM is not recommended but is valid as a last resort
```

### 10.2 Edge Case 2: Huge DOM and Performance Degradation

```
Performance impact of a huge DOM:

  Conditions that cause the problem:
  → Pages where DOM node count reaches tens of thousands to hundreds of thousands
  → Example: appending all data to the DOM continuously with infinite scroll
  → Example: a table with huge numbers of rows (10,000+ <tr> elements)

  Affected processes:
  ┌──────────────────────────┬──────────────────────────────┐
  │ Process                  │ Impact                        │
  ├──────────────────────────┼──────────────────────────────┤
  │ Initial parse            │ Linear increase in DOM build  │
  │ Style calculation        │ All elements × all rules:     │
  │                          │ O(n * m) cost growth          │
  │ Layout                   │ Increased box model calculation│
  │ Memory usage             │ Each node exists as a C++     │
  │                          │ object → memory grows         │
  │ querySelector            │ Traverses the entire subtree  │
  │ DOM operations           │ Expanded reflow scope         │
  │ Garbage collection       │ Management cost of many       │
  │                          │ objects                       │
  └──────────────────────────┴──────────────────────────────┘

  Recommended DOM node count guidelines:
  → Total node count: ideally 1,500 or fewer
  → Maximum depth: 32 levels or fewer
  → Children per parent node: 60 or fewer
  → Lighthouse warns when nodes exceed 1,400

  Remedies:
  → Introduce virtual scrolling
    → Only place visible elements in the DOM
    → Dynamically swap DOM elements as user scrolls
  → Lazy loading of content
  → Use content-visibility: auto
    → Skip rendering of off-screen elements
    → Elements exist in the DOM but style calculation and layout are skipped
```

### 10.3 Edge Case 3: Parsing of Template Tags and Shadow DOM

```
Special parse processing of <template> tags:

  <template id="card-template">
    <div class="card">
      <h2 class="card-title"></h2>
      <p class="card-body"></p>
    </div>
  </template>

  Parser behavior:
  1. Detect <template> StartTag
  2. Save insertion mode and switch to "in template" mode
  3. Template content is built in a separate DocumentFragment
     → Not connected to the main DOM tree
  4. Restore saved mode on </template>

  Result:
  DOM:
  template#card-template
  └── #document-fragment (template.content)
      └── div.card
          ├── h2.card-title
          └── p.card-body

  → template.content is a DocumentFragment
  → template element's own childNodes is empty
  → Not included in the render tree (not displayed)

Shadow DOM parsing:
  → Created using attachShadow() in JavaScript
  → The HTML parser does not directly build Shadow DOM
  → However, Declarative Shadow DOM (<template shadowrootmode="open">)
    is processed by the HTML parser

  <div id="host">
    <template shadowrootmode="open">
      <style>:host { display: block; border: 1px solid; }</style>
      <slot></slot>
    </template>
    <span>Light DOM content</span>
  </div>

  → Parser detects <template shadowrootmode="open">
  → Creates a Shadow Root and places template content in the Shadow Tree
  → Light DOM child elements are placed via <slot>
```

---

## 11. Exercises

### Exercise 1: Basic Level — Tracing Tokenization and DOM Construction

Manually tokenize the following HTML and draw the generated DOM tree.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Exercise</title>
</head>
<body>
  <main>
    <article>
      <h1 class="title" id="top">Heading</h1>
      <p>Body text <a href="#">Link</a> continued</p>
    </article>
  </main>
</body>
</html>
```

```
Answer guide:

  Step 1: Enumerate the token sequence
  → DOCTYPE token (name: "html")
  → StartTag: html (lang="en")
  → Character: newline + whitespace
  → StartTag: head
  → Character: newline + whitespace
  → StartTag: meta (charset="UTF-8") [self-closing]
  → Character: newline + whitespace
  → StartTag: title
  → Character: "Exercise"
  → EndTag: title
  → ... (omitted below; enumerate all tokens)

  Step 2: Build the DOM tree
  Document
  ├── DOCTYPE: html
  └── html [lang="en"]
      ├── head
      │   ├── meta [charset="UTF-8"]
      │   └── title
      │       └── "Exercise"
      └── body
          └── main
              └── article
                  ├── h1 [class="title", id="top"]
                  │   └── "Heading"
                  └── p
                      ├── "Body text "
                      ├── a [href="#"]
                      │   └── "Link"
                      └── " continued"

  Step 3: Record the changes to the stack of open elements
  → Track the stack state and insertion mode at each token reception
```

### Exercise 2: Intermediate Level — Predicting Error Recovery

Predict how the following malformed HTML will be parsed by the browser. Verify the result in the DevTools Elements panel and compare with your prediction.

```html
<div>
  <p>Paragraph 1
  <p>Paragraph 2
  <table>
    <tr>
      <td>Cell
      Invalid text
    </tr>
  </table>
  <b><i>Crossed tags</b></i>
  <ul>
    <li>Item 1
    <li>Item 2
  </ul>
  <form>
    <form>Nested form</form>
  </form>
</div>
```

```
Key points for the answer:

  1. Implicit closing of <p> tags
     → When a second <p> follows <p>Paragraph 1, an implicit </p> is inserted
     → Result: <p>Paragraph 1</p><p>Paragraph 2</p>

  2. Invalid text inside <table>
     → "Invalid text" is moved before the table by foster parenting

  3. Crossed <b><i> tags
     → Adoption Agency Algorithm reconstructs as:
       <b><i>Crossed tags</i></b><i></i>

  4. Implicit closing of <li>
     → When a second <li> follows <li>Item 1, an implicit </li> is inserted

  5. Nested <form>
     → The HTML spec prohibits nesting <form>
     → The inner <form> tag is ignored
     → Result: <form>Nested form</form>
```

### Exercise 3: Advanced Level — Designing a Resource Loading Strategy

Design a resource loading strategy for an HTML document that satisfies the following requirements.

```
Requirements:
  → Three CSS files needed for the first viewport
     - reset.css (2KB)
     - layout.css (5KB)
     - hero.css (3KB)
  → CSS needed after scrolling
     - components.css (15KB)
     - animations.css (8KB)
  → JavaScript
     - app.js (50KB) - main application
     - analytics.js (10KB) - analytics (can be async)
     - widget.js (20KB) - widget at the bottom of the page
  → Images
     - hero.webp (100KB) - hero image for first viewport
     - icon-sprite.svg (5KB) - icon set
  → Fonts
     - custom-font.woff2 (30KB)

Design guidelines:
  1. Consider inlining Critical CSS
     → reset.css + layout.css + hero.css = total 10KB
     → Inlining avoids waiting for external CSS downloads
     → Trade-off: HTML size increases

  2. Deferred loading of non-critical CSS
     → components.css, animations.css can be made async
       using media="print" + onload
     → Or use rel="preload" + as="style" to pre-fetch

  3. JavaScript loading strategy
     → app.js: defer (execute in source order after DOM is built)
     → analytics.js: async (execute as soon as downloaded, order doesn't matter)
     → widget.js: defer + place near bottom of page

  4. Use resource hints
     → preload: hero.webp, custom-font.woff2
     → preconnect: font delivery server
     → dns-prefetch: analytics server

  5. Write out the final <head> configuration
```

**Code Example 7: Optimized Resource Loading**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- Resource hints: pre-connect -->
  <link rel="preconnect" href="https://fonts.example.com" crossorigin>
  <link rel="dns-prefetch" href="//analytics.example.com">

  <!-- Pre-fetch critical resources -->
  <link rel="preload" href="hero.webp" as="image" type="image/webp">
  <link rel="preload" href="custom-font.woff2" as="font"
        type="font/woff2" crossorigin>

  <!-- Inline Critical CSS -->
  <style>
    /* Contents of reset.css + layout.css + hero.css (about 10KB total) */
    *, *::before, *::after { box-sizing: border-box; margin: 0; }
    body { font-family: 'CustomFont', sans-serif; line-height: 1.6; }
    .header { /* ... */ }
    .hero { /* ... */ }
    @font-face {
      font-family: 'CustomFont';
      src: url('custom-font.woff2') format('woff2');
      font-display: swap;
    }
  </style>

  <!-- Non-critical CSS loaded asynchronously -->
  <link rel="preload" href="components.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <link rel="preload" href="animations.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript>
    <link rel="stylesheet" href="components.css">
    <link rel="stylesheet" href="animations.css">
  </noscript>

  <!-- JavaScript: use defer to avoid parser blocking -->
  <script src="app.js" defer></script>
  <script src="widget.js" defer></script>
  <!-- Analytics: run independently with async -->
  <script src="analytics.js" async></script>

  <title>Optimized Page</title>
</head>
<body>
  <header class="header">
    <img src="icon-sprite.svg" alt="" width="24" height="24"
         loading="eager">
  </header>
  <section class="hero">
    <img src="hero.webp" alt="Hero image"
         width="1200" height="600"
         fetchpriority="high">
  </section>
  <!-- Below is subject to lazy loading -->
</body>
</html>
```

---

## 12. HTML Parser vs. CSS Parser Comparison

```
┌────────────────────┬──────────────────────┬──────────────────────┐
│ Aspect             │ HTML Parser           │ CSS Parser           │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Grammar type       │ Context-dependent    │ Context-free         │
│                    │ (non-regular, non-CFG)│ (CFG)               │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Error handling     │ Detailed recovery    │ Skip invalid         │
│                    │ procedure in spec    │ declarations         │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Output             │ DOM tree             │ CSSOM                │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Incremental parse  │ Supported            │ Usually parses       │
│                    │ (streaming)          │ all at once          │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Interaction with   │ Blocked by           │ Stylesheet loading   │
│ scripts            │ (synchronous scripts)│ blocks JS execution  │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Specification      │ HTML Living Standard │ CSS Syntax Module    │
│ location           │ "Parsing" section    │ Level 3              │
├────────────────────┼──────────────────────┼──────────────────────┤
│ State count        │ 80+ states           │ Tokenizer states are │
│                    │ (tokenizer only)     │ relatively fewer     │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Tool representation│ State machine +      │ Recursive descent    │
│                    │ stack-based parsing  │ parser (many impls.) │
├────────────────────┼──────────────────────┼──────────────────────┤
│ Forward            │ Unknown tags are     │ Unknown properties   │
│ compatibility      │ processed as         │ are skipped          │
│                    │ HTMLUnknownElement   │                      │
└────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 13. Performance Measurement and Debugging Techniques

### 13.1 Checking Parse Status with DevTools

```
Performance analysis with Chrome DevTools:

  Performance panel:
  1. Click "Record" and record the page load
  2. Check parsing activity in the "Main" section

  Events you can observe:
  ┌──────────────────────────┬──────────────────────────┐
  │ Event name               │ Meaning                  │
  ├──────────────────────────┼──────────────────────────┤
  │ Parse HTML               │ HTML parse duration       │
  │ Parse Stylesheet         │ CSS parse duration        │
  │ Recalculate Style        │ Style recalculation       │
  │ Layout                   │ Layout calculation        │
  │ Evaluate Script          │ JS execution              │
  │ DOMContentLoaded         │ DOM construction complete │
  │ First Paint              │ First paint               │
  │ First Contentful Paint   │ First contentful paint    │
  │ Largest Contentful Paint │ Largest contentful paint  │
  └──────────────────────────┴──────────────────────────┘

  Network panel:
  → Check the waterfall chart for CSS files to see
    load order and blocking
  → Check "Disable cache" to see actual load time
    without cache

  Coverage panel:
  → Shows the percentage of unused CSS/JS
  → Red areas indicate unused code
  → Useful for identifying Critical CSS

  Elements panel:
  → Check the final Computed Style in the Computed tab
  → Trace which rule each property came from
  → Check rule priority in the Styles panel
```

### 13.2 Measuring with PerformanceObserver

**Code Example 8: Collecting Parse-Related Performance Metrics**

```javascript
// Measure LCP with PerformanceObserver
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime, 'ms');
  console.log('LCP element:', lastEntry.element);
});
lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// Measure CSS file load time with Resource Timing
const resourceObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.initiatorType === 'link' || entry.initiatorType === 'css') {
      console.log(`CSS: ${entry.name}`);
      console.log(`  DNS: ${entry.domainLookupEnd - entry.domainLookupStart}ms`);
      console.log(`  TCP: ${entry.connectEnd - entry.connectStart}ms`);
      console.log(`  DL:  ${entry.responseEnd - entry.responseStart}ms`);
      console.log(`  Total: ${entry.duration}ms`);
    }
  }
});
resourceObserver.observe({ type: 'resource', buffered: true });

// Get DOM parse completion time with Navigation Timing
window.addEventListener('load', () => {
  const nav = performance.getEntriesByType('navigation')[0];
  console.log('DOM Interactive:', nav.domInteractive, 'ms');
  console.log('DOM Content Loaded:', nav.domContentLoadedEventEnd, 'ms');
  console.log('DOM Complete:', nav.domComplete, 'ms');
});
```

---

## FAQ

### Q1: Which is better for performance, innerHTML or the DOM API?

```
innerHTML vs DOM API:

  Using innerHTML:
  element.innerHTML = '<div class="card"><h2>Title</h2><p>Body</p></div>';

  → The HTML parser is invoked inside the browser
  → String → tokenize → tree construction → DOM node generation
  → All existing child nodes are destroyed (eligible for GC)

  Using the DOM API:
  const card = document.createElement('div');
  card.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = 'Title';
  const p = document.createElement('p');
  p.textContent = 'Body';
  card.appendChild(h2);
  card.appendChild(p);
  element.appendChild(card);

  → Direct DOM manipulation without going through the parser
  → Each operation is an individual DOM mutation

  General trends:
  → Few elements: DOM API is faster (no parser overhead)
  → Many elements: innerHTML is faster (string concatenation is lighter)
  → Optimal: DocumentFragment + DOM API,
    or batched with requestAnimationFrame

  Security perspective:
  → innerHTML can introduce XSS vulnerabilities
  → Use textContent when input contains user data
  → Sanitize untrusted HTML with DOMPurify or similar tools
```

### Q2: Why are CSS selectors evaluated right-to-left?

```
Why right-to-left evaluation is efficient:

  Selector: .sidebar .widget h3

  Left-to-right approach:
  1. Find .sidebar → a few found
  2. Find .widget among descendants of each .sidebar → traverse many
  3. Find h3 among descendants of each .widget → traverse even more
  → Candidates can "fan out" at each stage
  → Failing paths cannot be detected until the end

  Right-to-left approach:
  1. Find all h3 → relatively few h3 elements on the page
  2. Check if each h3 has .widget as an ancestor → traverse ancestor chain
  3. Check if .widget has .sidebar as an ancestor → traverse further
  → Candidates are significantly narrowed at the first step
  → The ancestor chain is a single path, so traversal cost is low
  → Failure can be determined at an early stage

  Quantitative comparison:
  → With N DOM nodes, selector depth D, and M matches:
  → Left-to-right: O(N * D) average case
  → Right-to-left: O(M * D) average case
  → Since typically M << N, right-to-left is more efficient
```

### Q3: What is the difference between display: none and visibility: hidden in terms of parsing and rendering?

```
display: none vs visibility: hidden:

  ┌──────────────────┬──────────────────┬──────────────────┐
  │ Aspect            │ display: none    │ visibility:hidden│
  ├──────────────────┼──────────────────┼──────────────────┤
  │ Exists in DOM     │ Yes              │ Yes              │
  │ Included in       │ No               │ Yes              │
  │ render tree       │                  │                  │
  │ Layout calculated │ No               │ Yes              │
  │ Occupies space    │ No               │ Yes              │
  │ Effect on children│ All children     │ Children can     │
  │                   │ also hidden      │ be set to visible│
  │                   │ (cannot undo)    │                  │
  │ Cost to show again│ Render tree      │ Repaint only     │
  │                   │ must be rebuilt  │ (no reflow)      │
  │ Accessibility     │ Not read aloud   │ Not read aloud   │
  │ Event reception   │ Does not receive │ Does not receive │
  │ Transitions       │ Not applicable   │ Applicable       │
  └──────────────────┴──────────────────┴──────────────────┘

  Difference with content-visibility: auto:
  → content-visibility: auto exists in both DOM and render tree
  → However, for off-screen elements, rendering of children is skipped
  → Provide a size hint with contain-intrinsic-size to prevent layout shift
```

### Q4: Why can't the HTML parser be defined with a context-free grammar?

```
Reasons why HTML cannot be defined with a context-free grammar:

  1. Error recovery is context-dependent
     → The same token requires different handling depending on
       the current state of the stack of open elements
     → Example: when a <p> appears inside <p>, insert an implicit </p>;
       when a <p> appears inside <div>, process it as a normal start tag

  2. Parser state changes by scripts
     → When document.write() is called inside <script>,
       the parser's input stream is changed
     → This cannot be expressed in a normal grammar definition

  3. Context-dependent processing via insertion modes (23 types)
     → The same tag behaves completely differently depending on the insertion mode
     → <td> in "in table" mode differs from <td> in "in body" mode

  4. Foster Parenting
     → The process of moving invalid elements inside a table to another position
     → Cannot be expressed by grammar rules alone

  In contrast, CSS:
  → Can be fully defined with a context-free grammar
  → Invalid input is simply skipped (simple recovery procedure)
  → Parsing one rule's output does not affect other rules
```

### Q5: Are Web Workers used in browser parsing?

```
Relationship between Web Workers and parsing:

  HTML parser:
  → Runs on the main thread (DOM is main-thread only)
  → Web Workers cannot access the DOM
  → Therefore HTML parsing cannot be parallelized

  CSS parser:
  → Some browsers parallelize parts of style calculation
  → However, parsing itself usually runs on the main thread

  Off-main-thread efforts:
  → Chrome is researching "Off-Main-Thread CSS"
  → Attempting to delegate parts of CSS parsing and style matching
    to worker threads
  → Servo (Rust-based engine) parallelizes style calculation

  Patterns developers can use:
  → DOMParser cannot be used inside a Web Worker
  → However, HTML can be processed as a string in a Worker,
    and the resulting structured data can be sent to the main thread
  → Example: parse Markdown in a Worker and set the generated
    HTML string as innerHTML on the main thread
```

---

## Summary

| Concept | Key Point |
|---------|-----------|
| Character encoding detection | Priority: BOM > HTTP header > meta charset |
| HTML tokenizer | State machine with 80+ states, generates 6 token types |
| HTML tree builder | Builds DOM using insertion modes + stack of open elements |
| Error recovery | Implicit element completion, foster parenting, Adoption Agency |
| DOM | C++ object tree, accessed via JS bindings |
| CSS tokenizer | Generates 20+ token types, context-free grammar |
| CSSOM | Hierarchy of StyleSheetList > CSSStyleSheet > CSSRuleList |
| Style resolution | Cascade → specificity → inheritance → value resolution (9 steps) |
| Selector matching | Right-to-left evaluation, Bloom Filter, style sharing for optimization |
| Render tree | Integration of DOM + CSSOM; display:none excluded |
| Incremental parsing | Streaming processing, optimized by Preload Scanner |
| CSS blocking | Render-blocking (not parser-blocking) |

---

## Next Guide to Read
→ [Browser Security Model](./03-browser-security-model.md)

---

## References
1. WHATWG. "HTML Living Standard - Parsing HTML documents." https://html.spec.whatwg.org/multipage/parsing.html
2. W3C. "CSS Syntax Module Level 3." https://www.w3.org/TR/css-syntax-3/
3. Garsiel, T. and Irish, P. "How Browsers Work: Behind the scenes of modern web browsers." web.dev, 2011. https://web.dev/articles/howbrowserswork
4. W3C. "CSS Cascading and Inheritance Level 5." https://www.w3.org/TR/css-cascade-5/
5. Google. "Render-tree Construction, Layout, and Paint." web.dev. https://web.dev/articles/critical-rendering-path/render-tree-construction
6. Mozilla. "How CSS is structured." MDN Web Docs. https://developer.mozilla.org/en-US/docs/Learn/CSS/First_steps/How_CSS_is_structured
