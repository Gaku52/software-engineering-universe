# DOM API

> The DOM is the API for manipulating HTML with JavaScript. This chapter provides comprehensive coverage from understanding the structure of the DOM tree, efficient node manipulation, the event model, MutationObserver, and Shadow DOM, to a comparison with Virtual DOM — building toward robust, performance-conscious implementations.

## What You Will Learn

- [ ] Accurately understand the structure of the DOM tree and the types of nodes
- [ ] Efficiently retrieve, create, insert, and delete elements
- [ ] Master batch-processing patterns to avoid Layout Thrashing
- [ ] Use the event model (capture / bubbling / delegation) appropriately
- [ ] Understand the design for asynchronously monitoring DOM changes with MutationObserver
- [ ] Experience style and DOM isolation via Shadow DOM
- [ ] Compare the design philosophy of Virtual DOM and choose the right approach

## Prerequisites

Before studying this chapter, it is recommended that you have acquired the following knowledge.

- **Browser HTML/CSS Parsing**: Understanding how the browser parses HTML and CSS to build the DOM tree and CSSOM tree helps you grasp how DOM API operations affect rendering. See [../00-browser-engine/02-parsing-html-css.md](../00-browser-engine/02-parsing-html-css.md) for details.

- **Basic JavaScript Syntax**: Beyond variables, functions, objects, and arrays, familiarity with ES2015+ features such as `const`/`let` scoping, arrow functions, and template literals is assumed.

- **Concepts of Event-Driven Programming**: The DOM uses an event-driven model, executing code in response to user interactions (clicks, key input, etc.) and browser state changes (DOM load complete, resize, etc.). Understanding callback functions and the basics of asynchronous processing makes implementing event listeners much smoother.

---

## 1. Fundamental Structure of the DOM Tree

### 1.1 What is the DOM?

The DOM (Document Object Model) is the standard interface for programmatically manipulating HTML and XML documents. When a browser receives HTML, the parser tokenizes and parses it, then builds the result as a tree-structured object model in memory. This tree is the DOM tree, and JavaScript reads and writes the document's structure, style, and content through the DOM tree's API.

The DOM specification is continuously updated as the DOM Living Standard, managed by WHATWG. Historically it started with DOM Level 1 (1998) and expanded through Level 2 and Level 3, but the "level" distinction is now abolished and it operates as a single Living Standard.

### 1.2 Node Types and Tree Structure

The DOM tree is composed of various types of nodes. The major node types are shown below.

```
Node (nodeType)
├── Document (9)         ... Root of the entire document
├── DocumentType (10)    ... <!DOCTYPE html>
├── Element (1)          ... <div>, <p>, <span>, etc.
├── Attr (2)             ... Attribute node (direct access now discouraged)
├── Text (3)             ... Text content
├── Comment (8)          ... <!-- comment -->
├── DocumentFragment (11)... Virtual container in memory
└── ProcessingInstruction (7) ... <?xml ... ?> (XML only)
```

The DOM tree of a typical HTML document in ASCII form:

```
                        Document
                           |
                      DocumentType
                       <!DOCTYPE html>
                           |
                     Element <html>
                    /                \
            Element <head>       Element <body>
               |                    |
          Element <title>      Element <div#app>
               |                /        \
          Text "My Page"   Element <h1>   Element <ul>
                               |          /    |    \
                          Text "Title" <li>  <li>  <li>
                                        |     |     |
                                     Text   Text   Text
                                     "A"    "B"    "C"
```

### 1.3 Navigating Between Nodes

Each node holds references to its parent, children, and siblings, allowing free traversal of the tree. Note that there are properties for all nodes and properties exclusive to Elements.

| Relationship | All Nodes | Elements Only |
|------|-----------|------------|
| Parent | `parentNode` | `parentElement` |
| Child (first) | `firstChild` | `firstElementChild` |
| Child (last) | `lastChild` | `lastElementChild` |
| Previous sibling | `previousSibling` | `previousElementSibling` |
| Next sibling | `nextSibling` | `nextElementSibling` |
| Child list | `childNodes` (NodeList) | `children` (HTMLCollection) |

All-node properties include text nodes and comment nodes. For example, text nodes corresponding to line breaks and indentation in HTML are also included in `childNodes`. Use Element-only properties when you want to traverse only Elements.

```javascript
// Difference between all-node traversal vs Element traversal
const body = document.body;

// childNodes includes text nodes (newlines/whitespace)
console.log(body.childNodes.length);    // e.g. 7 (3 text + 3 elements + 1 text)

// children contains only Elements
console.log(body.children.length);      // e.g. 3 (elements only)

// Recursive tree traversal
function walkDOM(node, callback, depth = 0) {
  callback(node, depth);
  let child = node.firstChild;
  while (child) {
    walkDOM(child, callback, depth + 1);
    child = child.nextSibling;
  }
}

walkDOM(document.body, (node, depth) => {
  const indent = '  '.repeat(depth);
  const info = node.nodeType === 1
    ? `Element <${node.tagName.toLowerCase()}>`
    : node.nodeType === 3
      ? `Text "${node.textContent.trim() || '(whitespace)'}"`
      : `Node type=${node.nodeType}`;
  console.log(`${indent}${info}`);
});
```

---

## 2. Retrieving Elements

### 2.1 Overview and Characteristics of Retrieval Methods

There are two main families of element retrieval methods: the `querySelector` family (static snapshots) and the `getElementsBy` family (live collections).

```javascript
// ---- querySelector family (static NodeList) ----
const el  = document.querySelector('#app');          // First match
const els = document.querySelectorAll('.card');       // All matches

// ---- getElementsBy family (live HTMLCollection) ----
const byId    = document.getElementById('app');               // Single element
const byClass = document.getElementsByClassName('card');       // Live
const byTag   = document.getElementsByTagName('div');          // Live
const byName  = document.getElementsByName('email');           // Live NodeList

// ---- Special retrieval ----
const closest = element.closest('.container');  // Nearest ancestor matching selector
const matches = element.matches('.active');     // Check if element matches selector
```

### 2.2 Static NodeList vs Live HTMLCollection

This difference is a common source of bugs in practice. The table below summarizes the comparison.

| Property | `querySelectorAll` | `getElementsByClassName` |
|------|-------------------|------------------------|
| Return type | Static `NodeList` | Live `HTMLCollection` |
| Reflects DOM changes | No (snapshot at time of retrieval) | Reflected in real time |
| `forEach` support | Yes | No (requires `Array.from()`) |
| Selector flexibility | Full CSS selectors | Class name only |
| Performance | Slightly slower (selector parsing) | Fast (simple index reference) |
| Add/remove during loop | Safe (because it is a snapshot) | Dangerous (collection changes) |

```javascript
// Pitfall of live collections
const items = document.getElementsByClassName('item');
console.log(items.length);  // 3

// Removing a class during the loop causes index shifting
for (let i = 0; i < items.length; i++) {
  items[i].classList.remove('item');  // Removed instantly from items
  // At i=0, remove → items.length becomes 2 → i=1 is the original 3rd element
}
// Result: only every other element is processed

// Safe approach 1: querySelectorAll (static)
document.querySelectorAll('.item').forEach(el => {
  el.classList.remove('item');  // Safe
});

// Safe approach 2: reverse loop
for (let i = items.length - 1; i >= 0; i--) {
  items[i].classList.remove('item');  // Processing from the back prevents index corruption
}
```

---

## 3. Creating, Inserting, and Removing Elements

### 3.1 Basic CRUD Operations

```javascript
// ---- Create ----
const div = document.createElement('div');
div.className = 'card';
div.id = 'card-1';
div.setAttribute('data-category', 'tech');
div.textContent = 'Hello, DOM!';

// Create from template (suitable for complex structures)
const template = document.getElementById('card-template');
const clone = template.content.cloneNode(true);  // deep clone

// ---- Insert ----
parent.appendChild(child);                 // Append to end
parent.insertBefore(newChild, refChild);   // Insert before refChild
parent.replaceChild(newChild, oldChild);   // Replace

// Modern API (no IE support needed today)
parent.append(child1, child2, 'text');     // Append multiple (text also allowed)
parent.prepend(child);                     // Insert at beginning
refChild.before(newChild);                 // Insert before refChild
refChild.after(newChild);                  // Insert after refChild
oldChild.replaceWith(newChild);            // Replace self

// ---- Delete ----
parent.removeChild(child);                 // Traditional approach
child.remove();                            // Modern API

// ---- Read / Update ----
element.getAttribute('href');
element.setAttribute('href', '/new-path');
element.removeAttribute('disabled');
element.hasAttribute('hidden');
element.toggleAttribute('hidden');         // Remove if present, add if absent
```

### 3.2 Batch Insertion with DocumentFragment

Adding elements to the DOM one at a time may trigger layout recalculation with each addition. Using `DocumentFragment`, you can build the tree virtually in memory and apply it to the DOM in a single operation at the end.

```javascript
// Efficient bulk insertion with DocumentFragment
function createList(items) {
  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.dataset.index = index;

    const span = document.createElement('span');
    span.textContent = item.name;
    li.appendChild(span);

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item.count;
    li.appendChild(badge);

    fragment.appendChild(li);
  });

  return fragment;
}

// Bulk insert 1,000 items
const data = Array.from({ length: 1000 }, (_, i) => ({
  name: `Item ${i}`,
  count: Math.floor(Math.random() * 100),
}));

const ul = document.querySelector('#list');
ul.appendChild(createList(data));  // DOM operation happens only once
```

### 3.3 insertAdjacentHTML / insertAdjacentElement

`innerHTML` destroys and rebuilds all descendants of the target element, but `insertAdjacentHTML` inserts HTML at a specified position while preserving the existing DOM.

```
The four positions of insertAdjacentHTML:

  <!-- 'beforebegin' -->
  <div id="target">
    <!-- 'afterbegin' -->
    <p>Existing content</p>
    <!-- 'beforeend' -->
  </div>
  <!-- 'afterend' -->
```

```javascript
const target = document.getElementById('target');

// Append to end (without destroying existing content)
target.insertAdjacentHTML('beforeend', '<p class="new">Added content</p>');

// Insert before the element
target.insertAdjacentHTML('beforebegin', '<h2>Heading</h2>');

// insertAdjacentElement: insert an Element object
const newEl = document.createElement('div');
newEl.textContent = 'New element';
target.insertAdjacentElement('afterend', newEl);

// insertAdjacentText: insert a text node
target.insertAdjacentText('afterbegin', 'Text prepended: ');
```

---

## 4. DOM Manipulation and the Rendering Pipeline

### 4.1 Browser Rendering Flow

To understand why DOM operations affect performance, you need to know the browser's rendering pipeline.

```
┌─────────┐   ┌──────────┐   ┌────────┐   ┌─────────┐   ┌──────────┐
│  Parse  │──▶│  Style   │──▶│ Layout │──▶│  Paint  │──▶│Composite │
│ HTML/CSS│   │ Compute  │   │(Reflow)│   │(Repaint)│   │ (Layers) │
└─────────┘   └──────────┘   └────────┘   └─────────┘   └──────────┘
     DOM          CSSOM       Position/   Pixel drawing   GPU compositing
   tree build  style compute  size calc
```

Cost of each stage:

| Stage | Triggering Operations | Cost |
|------|-------------------|--------|
| Style | Adding/removing classes, changing styles | Medium |
| Layout (Reflow) | Changing width/height, adding/removing elements, reading `offsetHeight` | High |
| Paint (Repaint) | Changing background color/shadow, changing `visibility` | Medium–High |
| Composite | Changing `transform`, `opacity` | Low |

### 4.2 Layout Thrashing

Layout Thrashing is a phenomenon where interleaving reads and writes of layout information causes multiple layout recalculations per frame.

```javascript
// ---- Anti-pattern: Layout Thrashing ----
// Each read of offsetHeight triggers a forced synchronous layout
function badResize(elements) {
  elements.forEach(el => {
    const height = el.offsetHeight;          // Read → forced layout
    el.style.height = (height * 2) + 'px';   // Write → invalidates layout
    // Next iteration reads offsetHeight again → forced layout again ...
  });
}

// ---- Recommended pattern: Separate reads and writes ----
function goodResize(elements) {
  // Phase 1: Batch all reads
  const heights = elements.map(el => el.offsetHeight);

  // Phase 2: Batch all writes
  elements.forEach((el, i) => {
    el.style.height = (heights[i] * 2) + 'px';
  });
}

// ---- Recommended pattern: Defer writes with requestAnimationFrame ----
function rafResize(elements) {
  const heights = elements.map(el => el.offsetHeight);  // Read

  requestAnimationFrame(() => {
    elements.forEach((el, i) => {
      el.style.height = (heights[i] * 2) + 'px';       // Write
    });
  });
}
```

Representative properties and methods that force layout:

- `offsetTop`, `offsetLeft`, `offsetWidth`, `offsetHeight`
- `scrollTop`, `scrollLeft`, `scrollWidth`, `scrollHeight`
- `clientTop`, `clientLeft`, `clientWidth`, `clientHeight`
- `getComputedStyle()`
- `getBoundingClientRect()`

### 4.3 Best Practices for Efficient DOM Manipulation

```javascript
// 1. Manipulate classes with the classList API (safer than direct className manipulation)
element.classList.add('active', 'highlight');
element.classList.remove('active');
element.classList.toggle('visible');
element.classList.contains('active');    // boolean
element.classList.replace('old', 'new');

// 2. Manipulate custom data attributes with the dataset API
// HTML: <div data-user-id="42" data-is-admin="true">
element.dataset.userId;      // "42" (converted to camelCase)
element.dataset.isAdmin;     // "true" (note: always a string)
delete element.dataset.userId;

// 3. Batch style property setting
// Bad: multiple style writes
element.style.width = '100px';
element.style.height = '200px';
element.style.background = 'red';

// Good: set all at once with cssText
element.style.cssText = 'width: 100px; height: 200px; background: red;';

// Even better: swap classes (styles defined in CSS)
element.classList.add('card--expanded');

// 4. Temporarily detach from DOM with display: none, then restore after operations
element.style.display = 'none';  // Removed from layout tree
// ... multiple DOM operations ...
element.style.display = '';       // Restore (only one Reflow)
```

---

## 5. The Event Model

### 5.1 The Three Phases of Event Propagation

DOM events propagate in three stages: the "capture phase" descending from root to target, the "target phase" at the target, and the "bubbling phase" ascending from target to root.

```
Event propagation flow (click event example):

  Window
    │  ↓ Capture          ↑ Bubbling
  Document
    │  ↓                    ↑
  <html>
    │  ↓                    ↑
  <body>
    │  ↓                    ↑
  <div#container>
    │  ↓                    ↑
  <button#target>  ← Target phase (event fires here)
```

```javascript
const container = document.getElementById('container');
const button = document.getElementById('target');

// Handle in capture phase (third argument true or { capture: true })
container.addEventListener('click', (e) => {
  console.log('1. container capture');
}, true);

// Handle in bubbling phase (default)
container.addEventListener('click', (e) => {
  console.log('3. container bubbling');
});

button.addEventListener('click', (e) => {
  console.log('2. button target');
});

// Output order when button is clicked:
// 1. container capture
// 2. button target
// 3. container bubbling
```

### 5.2 Event Control Methods

```javascript
element.addEventListener('click', (e) => {
  // Stop propagation (subsequent listeners on ancestors still run)
  e.stopPropagation();

  // Stop all listeners including those on the same element
  e.stopImmediatePropagation();

  // Cancel the default action (link navigation, form submission, etc.)
  e.preventDefault();

  // Check whether the default action can be cancelled
  console.log(e.cancelable);   // true or false

  // Information about the event source
  console.log(e.target);       // The element actually clicked
  console.log(e.currentTarget); // The element on which the listener was registered
  console.log(e.eventPhase);   // 1=capture, 2=target, 3=bubbling
});
```

### 5.3 Event Delegation

The pattern of registering a single listener on a common parent element rather than individual listeners on each child element, and using `event.target` to identify the source, is called event delegation. Because it also handles dynamically added elements, it is frequently used in SPAs.

```javascript
// ---- Event delegation example ----

// Registering individual listeners on 1,000 list items is inefficient.
// Register just one on the parent <ul>.

const todoList = document.getElementById('todo-list');

todoList.addEventListener('click', (e) => {
  // Use closest to find the nearest li (handles clicks on span or icon inside li)
  const item = e.target.closest('li.todo-item');
  if (!item) return;  // Ignore clicks outside li

  // Branch on data-action
  const action = e.target.closest('[data-action]')?.dataset.action;

  switch (action) {
    case 'toggle':
      item.classList.toggle('completed');
      break;
    case 'delete':
      item.remove();
      break;
    case 'edit':
      startEditing(item);
      break;
  }
});

// HTML structure:
// <ul id="todo-list">
//   <li class="todo-item">
//     <span data-action="toggle">Buy milk</span>
//     <button data-action="edit">Edit</button>
//     <button data-action="delete">Delete</button>
//   </li>
//   ... dynamically added items are automatically handled ...
// </ul>
```

### 5.4 addEventListener Options

```javascript
element.addEventListener('scroll', handler, {
  capture: false,    // Fire in capture phase (default: false)
  once: true,        // Execute once, then auto-remove (default: false)
  passive: true,     // Declare that preventDefault() will not be called
  signal: controller.signal,  // Remove listener with AbortSignal
});

// Benefit of passive: true
// Specifying passive: true for scroll/touchmove events guarantees
// to the browser that there is no preventDefault, so scrolling
// starts immediately, achieving smooth scrolling.

// Removing listeners with AbortController
const controller = new AbortController();

element.addEventListener('click', handler, { signal: controller.signal });
element.addEventListener('keyup', handler2, { signal: controller.signal });
element.addEventListener('scroll', handler3, { signal: controller.signal });

// Remove all three listeners at once
controller.abort();
```

### 5.5 Custom Events

```javascript
// Fire a custom event with CustomEvent
const event = new CustomEvent('user:login', {
  detail: { userId: 42, username: 'alice' },
  bubbles: true,      // Whether to bubble
  cancelable: true,    // Whether preventDefault is allowed
  composed: true,      // Whether to cross Shadow DOM boundaries
});

element.dispatchEvent(event);

// Receiving side
document.addEventListener('user:login', (e) => {
  console.log(e.detail.username);  // "alice"
});
```

---

## 6. MutationObserver

### 6.1 Overview and Use Cases

`MutationObserver` is an API that asynchronously notifies DOM changes in batches. The legacy `Mutation Events` (DOMNodeInserted, etc.) fired synchronously on each event, causing extreme performance degradation, so MutationObserver was designed as their replacement.

Main use cases:

- Detecting and handling DOM changes made by third-party scripts
- Detecting load completion of dynamic content (ads, embedded widgets, etc.)
- Tracking content changes in WYSIWYG editors
- Monitoring dynamic content in accessibility tools
- Detecting page changes in browser extensions

### 6.2 Basic Usage

```javascript
// Basic MutationObserver pattern

// 1. Define the callback function
const callback = (mutationList, observer) => {
  for (const mutation of mutationList) {
    switch (mutation.type) {
      case 'childList':
        // Node added
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            console.log('Added element:', node.tagName, node.className);
          }
        });
        // Node removed
        mutation.removedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            console.log('Removed element:', node.tagName);
          }
        });
        break;

      case 'attributes':
        console.log(
          `Attribute changed: ${mutation.attributeName}`,
          `Old value: ${mutation.oldValue}`,
          `New value: ${mutation.target.getAttribute(mutation.attributeName)}`
        );
        break;

      case 'characterData':
        console.log(
          'Text changed:',
          `Old value: ${mutation.oldValue}`,
          `New value: ${mutation.target.textContent}`
        );
        break;
    }
  }
};

// 2. Create the observer
const observer = new MutationObserver(callback);

// 3. Start observing (narrow the target with options)
observer.observe(document.getElementById('app'), {
  childList: true,           // Monitor addition/removal of child elements
  attributes: true,          // Monitor attribute changes
  characterData: true,       // Monitor text content changes
  subtree: true,             // Include descendant elements
  attributeOldValue: true,   // Record old attribute value before change
  characterDataOldValue: true, // Record old text before change
  attributeFilter: ['class', 'style', 'data-state'], // Limit monitored attributes
});

// 4. Get pending changes immediately
const pendingMutations = observer.takeRecords();

// 5. Stop observing
observer.disconnect();
```

### 6.3 Practical Example: Utility to Wait for an Element

```javascript
/**
 * Wait until an element matching the given selector is added to the DOM
 * @param {string} selector - CSS selector
 * @param {Element} root - Root element to observe
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element>}
 */
function waitForElement(selector, root = document.body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if it already exists
    const existing = root.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
    }, timeout);

    const observer = new MutationObserver((mutations) => {
      const element = root.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });
  });
}

// Usage
try {
  const modal = await waitForElement('.modal-dialog');
  console.log('Modal appeared:', modal);
} catch (e) {
  console.error('Modal did not appear:', e.message);
}
```

### 6.4 Performance Considerations for MutationObserver

MutationObserver is processed as a microtask, so it is notified in batch after all synchronous DOM changes have completed. This significantly improves performance over Mutation Events, but note the following:

- Monitoring a wide range with `subtree: true` can generate a large number of Mutation records
- Modifying the DOM inside the callback may trigger recursive notifications
- Use `attributeFilter` to narrow monitored attributes and reduce unnecessary notifications
- Always call `disconnect()` when no longer needed (to prevent memory leaks)

---

## 7. Shadow DOM

### 7.1 Concept of Shadow DOM

Shadow DOM is a mechanism for encapsulating a subtree of the DOM. Styles and DOM structure inside the Shadow DOM are isolated from the outside, and external styles do not affect the inside either. This greatly improves component reusability and robustness.

The structure of Shadow DOM in ASCII:

```
<my-card>                          ← Host Element
  ├── #shadow-root (open)          ← Shadow Root
  │     ├── <style>                ← Scoped styles (do not affect outside)
  │     │     .title { color: blue; }
  │     ├── <div class="title">
  │     │     └── <slot name="title">  ← Named slot
  │     │           └── (fallback: "Default Title")
  │     └── <div class="content">
  │           └── <slot>           ← Default slot
  │                 └── (fallback: none)
  │
  └── Light DOM (child elements)
        ├── <span slot="title">Custom Title</span>  → goes to name="title" slot
        └── <p>Card body</p>                         → goes to default slot
```

### 7.2 Implementing a Web Component with Shadow DOM

```javascript
// ---- Complete Web Component example ----

class AccordionItem extends HTMLElement {
  // Declare observed attributes
  static get observedAttributes() {
    return ['open', 'disabled'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._shadow.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        :host([disabled]) {
          opacity: 0.5;
          pointer-events: none;
        }

        :host(:not([open])) .panel {
          display: none;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          cursor: pointer;
          background: #f7fafc;
          user-select: none;
        }

        .header:hover {
          background: #edf2f7;
        }

        .arrow {
          transition: transform 0.2s;
        }

        :host([open]) .arrow {
          transform: rotate(90deg);
        }

        .panel {
          padding: 16px;
          border-top: 1px solid #e2e8f0;
        }
      </style>

      <div class="header" part="header">
        <slot name="title">Untitled</slot>
        <span class="arrow" part="arrow">&#9654;</span>
      </div>
      <div class="panel" part="panel">
        <slot></slot>
      </div>
    `;

    // Bind events
    this._shadow.querySelector('.header').addEventListener('click', () => {
      if (!this.hasAttribute('disabled')) {
        this.toggleAttribute('open');
      }
    });
  }

  // Lifecycle callbacks
  connectedCallback() {
    // Called when added to the DOM
    this.setAttribute('role', 'region');
  }

  disconnectedCallback() {
    // Called when removed from the DOM (cleanup)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Called when a monitored attribute changes
    if (name === 'open') {
      this.dispatchEvent(new CustomEvent('toggle', {
        detail: { open: this.hasAttribute('open') },
        bubbles: true,
      }));
    }
  }
}

customElements.define('accordion-item', AccordionItem);

// Usage in HTML:
// <accordion-item open>
//   <span slot="title">Section 1</span>
//   <p>Content...</p>
// </accordion-item>
```

### 7.3 Style Boundaries of Shadow DOM

Rules about style isolation in Shadow DOM:

| Style direction | Behavior | Workaround |
|---------------|------|--------|
| External CSS → Inside Shadow DOM | Not applied | Expose with `::part()` pseudo-element |
| Shadow DOM CSS → Outside | Does not leak | Intended behavior |
| Inherited properties (color, font, etc.) | Inherited across Shadow DOM boundary | Can reset with `all: initial` |
| CSS custom properties (variables) | Cross Shadow DOM boundary | Useful for theming |

```javascript
// Theming via CSS custom properties
// External CSS:
//   accordion-item {
//     --accordion-bg: #f0f0f0;
//     --accordion-color: #333;
//   }

// Shadow DOM CSS:
//   .header {
//     background: var(--accordion-bg, #f7fafc);
//     color: var(--accordion-color, inherit);
//   }

// Styling from outside with ::part()
// External CSS:
//   accordion-item::part(header) {
//     background: navy;
//     color: white;
//   }
```

### 7.4 open vs closed Mode

```javascript
// open mode: shadowRoot property allows external access
const openEl = document.createElement('div');
const openShadow = openEl.attachShadow({ mode: 'open' });
console.log(openEl.shadowRoot === openShadow);  // true

// closed mode: shadowRoot returns null
const closedEl = document.createElement('div');
const closedShadow = closedEl.attachShadow({ mode: 'closed' });
console.log(closedEl.shadowRoot);  // null
// If you hold a reference to closedShadow, you can still operate on it.
// Note: this is not a complete security boundary.
```

In practice, `open` mode is recommended for the following reasons:

- Easier debugging in DevTools
- Accessible from test frameworks
- `closed` does not provide a complete security boundary (can be bypassed with WeakMap, etc.)
- Internal browser components (e.g., `<input type="date">`) use `closed`

---

## 8. Comparison with Virtual DOM

### 8.1 What is Virtual DOM?

Virtual DOM is a concept popularized by React. It keeps a JavaScript object representation of the real DOM tree in memory, and when state changes, it compares the old and new virtual trees (diff detection = Reconciliation / Diffing) and applies only the minimal real DOM updates necessary.

Virtual DOM is based on the premise that "DOM operations are slow." Since JavaScript object operations are orders of magnitude faster than DOM operations, the strategy is to perform diff calculations on the JavaScript side and minimize writes to the real DOM.

### 8.2 How Virtual DOM Works

```
Virtual DOM update cycle:

  ┌──────────────┐    State change     ┌──────────────┐
  │  Old Virtual │ ──────────────────▶ │  New Virtual │
  │     DOM      │                     │     DOM      │
  │   (v-node)   │                     │   (v-node)   │
  └──────┬───────┘                     └──────┬───────┘
         │                                    │
         └────────────┬───────────────────────┘
                      │
                   Diffing
                   (diff detection)
                      │
                      ▼
              ┌───────────────┐
              │  Minimal      │
              │  DOM patch    │
              │  (real DOM    │
              │   update)     │
              └───────────────┘
```

```javascript
// Conceptual structure of a Virtual DOM node (React example)
// JSX: <div className="card"><h1>Title</h1><p>Body</p></div>
// ↓ After transpilation
const vnode = {
  type: 'div',
  props: { className: 'card' },
  children: [
    {
      type: 'h1',
      props: {},
      children: ['Title'],
    },
    {
      type: 'p',
      props: {},
      children: ['Body'],
    },
  ],
};

// A state change produces a new vnode
const newVnode = {
  type: 'div',
  props: { className: 'card active' },  // className changed
  children: [
    {
      type: 'h1',
      props: {},
      children: ['New Title'],            // text changed
    },
    {
      type: 'p',
      props: {},
      children: ['Body'],                 // no change
    },
  ],
};

// Diff result:
// 1. Change div's className from 'card' to 'card active'
// 2. Change h1's text from 'Title' to 'New Title'
// 3. p is unchanged → do nothing
```

### 8.3 Virtual DOM vs Direct DOM Manipulation vs Shadow DOM

| Comparison | Virtual DOM (React, etc.) | Direct DOM Manipulation | Shadow DOM |
|---------|----------------------|--------------|------------|
| Purpose | Declarative UI with efficient updates | Direct control of DOM | DOM/CSS isolation |
| Abstraction level | High (JSX → vnode → DOM) | Low (DOM API directly) | Middle (native API) |
| Performance | Medium (diff cost) | Highest (depending on optimization) | High (native) |
| Memory usage | High (virtual tree held in memory) | Low | Moderate |
| Learning cost | Medium–High (framework dependent) | Low–Medium | Medium |
| CSS isolation | None (handled separately with CSS Modules, etc.) | None | Yes (native) |
| Componentization | Provided by framework | Requires custom implementation | Web Components |
| SSR support | Framework handles it | N/A | Limited |
| Browser compatibility | Framework dependent | Highest | Modern browsers only |
| Application scenario | SPAs with complex state management | Simple interactions | Reusable UI parts |

### 8.4 Guidelines for Choosing an Approach

```
                 Approach selection flowchart:

                    UI complexity?
                   /            \
              Simple             Complex
              /                    \
     Frequent updates?         State management needed?
      /         \              /          \
    Yes          No          Yes           No
    /             \           /              \
 Direct DOM    Direct DOM  Virtual DOM     Shadow DOM +
 (batch)       (simple)   (React/Vue etc) Web Components
```

- **Direct DOM manipulation**: Form validation, simple animations, jQuery-style operations
- **Virtual DOM**: SPAs with complex state management, UIs requiring frequent re-renders
- **Shadow DOM**: Design systems, embedded widgets, micro-frontends

### 8.5 Incremental DOM and the Svelte Approach

Two alternative approaches to Virtual DOM are noteworthy.

**Incremental DOM (Angular Ivy)**: Does not hold a virtual tree; instead incrementally traverses and updates the real DOM directly. Memory-efficient.

**Svelte's compile-time approach**: At build time, components are compiled into efficient imperative DOM operation code. Because there is no virtual DOM diff engine at runtime, bundle sizes are small and runtime performance is high.

```javascript
// Conceptual image of Svelte's compiled output
// Input (.svelte file):
//   <script>
//     let count = 0;
//     function increment() { count += 1; }
//   </script>
//   <button on:click={increment}>{count}</button>

// Compiled output (conceptual):
function create_fragment(ctx) {
  let button;
  let t;

  return {
    c() {  // create
      button = document.createElement('button');
      t = document.createTextNode(ctx[0]);  // count
      button.appendChild(t);
    },
    m(target) {  // mount
      target.appendChild(button);
      button.addEventListener('click', ctx[1]);  // increment
    },
    p(ctx) {  // update (only diffs)
      t.data = ctx[0];  // directly update text node (no diff needed)
    },
    d(detaching) {  // destroy
      if (detaching) button.remove();
    },
  };
}
```

---

## 9. Advanced DOM Manipulation Patterns

### 9.1 Text Manipulation with the Range API

The `Range` API represents an arbitrary range within the DOM tree and is essential for implementing text selection and rich-text editors.

```javascript
// Basic Range operations
const range = document.createRange();

// Select the entire contents of an element
range.selectNodeContents(element);

// Select a portion of a text node
const textNode = element.firstChild;  // text node
range.setStart(textNode, 5);   // from the 5th character
range.setEnd(textNode, 10);    // up to the 10th character

// Get information about the selected range
console.log(range.toString());           // The selected text
console.log(range.getBoundingClientRect()); // Coordinates of the selection

// Manipulate the selection
range.deleteContents();                   // Delete selected range
range.insertNode(document.createElement('mark')); // Insert node

// Get the user's current selection
const selection = window.getSelection();
if (selection.rangeCount > 0) {
  const userRange = selection.getRangeAt(0);
  console.log('Selected text:', userRange.toString());

  // Wrap selection in a highlight marker
  const mark = document.createElement('mark');
  mark.style.backgroundColor = '#ffeb3b';
  userRange.surroundContents(mark);
}
```

### 9.2 Tree Traversal with TreeWalker

`TreeWalker` is an iterator for efficiently traversing the DOM tree. It has filtering capabilities and can traverse only specific node types.

```javascript
// Traverse only text nodes
const walker = document.createTreeWalker(
  document.body,          // Root
  NodeFilter.SHOW_TEXT,   // Text nodes only
  {
    acceptNode(node) {
      // Exclude whitespace-only text nodes
      return node.textContent.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  }
);

const textNodes = [];
let current;
while ((current = walker.nextNode())) {
  textNodes.push(current);
}

// Text search and replace
function findAndHighlight(root, searchText) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );

  const matches = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.includes(searchText)) {
      matches.push(node);
    }
  }

  matches.forEach(textNode => {
    const parts = textNode.textContent.split(searchText);
    const fragment = document.createDocumentFragment();

    parts.forEach((part, i) => {
      fragment.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        const mark = document.createElement('mark');
        mark.textContent = searchText;
        fragment.appendChild(mark);
      }
    });

    textNode.parentNode.replaceChild(fragment, textNode);
  });
}
```

### 9.3 Integration with IntersectionObserver

`IntersectionObserver` monitors when elements enter and leave the viewport, and can be combined with DOM manipulation for lazy loading and animation control.

```javascript
// Combination of lazy loading + DOM manipulation
function setupLazyLoading() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;

        // Set the actual src
        img.src = src;
        img.removeAttribute('data-src');
        img.classList.add('loaded');

        // Stop observing
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '200px 0px',  // Start loading 200px before the viewport
    threshold: 0.01,
  });

  // Observe all images with a data-src attribute
  document.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });
}

// Implementing infinite scroll
function setupInfiniteScroll(container, loadMore) {
  const sentinel = document.createElement('div');
  sentinel.className = 'scroll-sentinel';
  sentinel.style.height = '1px';
  container.appendChild(sentinel);

  let isLoading = false;

  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting && !isLoading) {
      isLoading = true;

      const newItems = await loadMore();

      const fragment = document.createDocumentFragment();
      newItems.forEach(item => {
        const el = createItemElement(item);
        fragment.appendChild(el);
      });

      // Insert before the sentinel (sentinel always stays at the end)
      container.insertBefore(fragment, sentinel);
      isLoading = false;
    }
  }, { threshold: 0.1 });

  observer.observe(sentinel);
  return () => observer.disconnect();
}
```

### 9.4 ResizeObserver and DOM Layout Changes

```javascript
// Detect element size changes and adjust layout
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;

    // Responsive layout based on container width (alternative to CSS Container Queries)
    const container = entry.target;
    container.classList.toggle('compact', width < 400);
    container.classList.toggle('medium', width >= 400 && width < 800);
    container.classList.toggle('wide', width >= 800);

    // Dynamically adjust grid column count
    const columns = Math.max(1, Math.floor(width / 250));
    container.style.setProperty('--columns', columns);
  }
});

resizeObserver.observe(document.querySelector('.grid-container'));
```

---

## 10. The `<template>` Element and Declarative Shadow DOM

### 10.1 The `<template>` Element

The `<template>` element defines an HTML template that is not rendered but can be cloned from JavaScript. Compared to string parsing via `innerHTML`, templates provide a pre-parsed DOM fragment and are more efficient.

```javascript
// HTML:
// <template id="card-template">
//   <div class="card">
//     <h3 class="card-title"></h3>
//     <p class="card-body"></p>
//     <button class="card-action">Details</button>
//   </div>
// </template>

function createCard(title, body) {
  const template = document.getElementById('card-template');
  const clone = template.content.cloneNode(true);  // DocumentFragment

  clone.querySelector('.card-title').textContent = title;
  clone.querySelector('.card-body').textContent = body;
  clone.querySelector('.card-action').addEventListener('click', () => {
    console.log(`Show details for ${title}`);
  });

  return clone;
}

// Mass generation using templates
const container = document.getElementById('card-list');
const fragment = document.createDocumentFragment();

for (const item of dataList) {
  fragment.appendChild(createCard(item.title, item.body));
}
container.appendChild(fragment);
```

### 10.2 Declarative Shadow DOM (DSD)

Declarative Shadow DOM is a feature that allows declaring Shadow DOM directly in HTML. It builds Shadow DOM without JavaScript and improves compatibility with server-side rendering (SSR).

```html
<!-- Declarative Shadow DOM -->
<my-card>
  <template shadowrootmode="open">
    <style>
      :host { display: block; border: 1px solid #ccc; padding: 16px; }
      .title { font-weight: bold; font-size: 1.2em; }
    </style>
    <div class="title">
      <slot name="title">Default Title</slot>
    </div>
    <div class="content">
      <slot></slot>
    </div>
  </template>
  <span slot="title">Declarative Shadow DOM</span>
  <p>Shadow DOM is constructed without JavaScript</p>
</my-card>
```

Benefits of DSD:

- Shadow DOM can be included in SSR-rendered HTML
- Component structure and styles are applied before JavaScript loads
- Prevents FOUC (Flash of Unstyled Content)
- Works well with streaming SSR

---

## 11. Anti-Patterns and Countermeasures

### 11.1 Anti-Pattern 1: XSS Vulnerability via innerHTML

Directly assigning user input to `innerHTML` is a classic cause of cross-site scripting (XSS).

```javascript
// ---- Dangerous: assign user input directly to innerHTML ----
const userInput = '<img src=x onerror="alert(document.cookie)">';
element.innerHTML = userInput;  // XSS! Script executes

// ---- Safe approach 1: use textContent ----
element.textContent = userInput;  // Displayed as text (not interpreted as HTML)

// ---- Safe approach 2: sanitize with DOMPurify ----
// import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);

// ---- Safe approach 3: Sanitizer API (browser-native, Chrome 105+) ----
const sanitizer = new Sanitizer({
  allowElements: ['b', 'i', 'em', 'strong', 'a'],
  allowAttributes: { 'href': ['a'] },
  blockElements: ['script', 'style'],
});
element.setHTML(userInput, { sanitizer });

// ---- Safe approach 4: build elements with DOM API ----
function safeRender(data) {
  const div = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = data.title;  // always treated as text
  div.appendChild(heading);

  const link = document.createElement('a');
  link.textContent = data.linkText;
  link.href = data.url;

  // Validate href (guard against javascript: protocol)
  if (!/^https?:\/\//i.test(data.url)) {
    link.href = '#';  // Invalidate malformed URL
  }

  div.appendChild(link);
  return div;
}
```

### 11.2 Anti-Pattern 2: Memory Leaks from DOM Manipulation

Forgetting to remove event listeners and circular references can cause serious memory leaks in long-running SPAs.

```javascript
// ---- Dangerous: forgotten listener removal ----
class BadComponent {
  constructor(element) {
    this.element = element;
    this.data = new Array(10000).fill('large data');

    // Register global listeners but forget to remove them
    window.addEventListener('resize', this.onResize.bind(this));
    document.addEventListener('scroll', this.onScroll.bind(this));
  }

  onResize() { /* ... */ }
  onScroll() { /* ... */ }

  destroy() {
    this.element.remove();
    // Listeners remain → reference to this is kept → not GC'd
    // Memory for the 10,000-element this.data leaks
  }
}

// ---- Safe: manage listeners together with AbortController ----
class GoodComponent {
  constructor(element) {
    this.element = element;
    this.data = new Array(10000).fill('large data');
    this.controller = new AbortController();
    const { signal } = this.controller;

    window.addEventListener('resize', this.onResize.bind(this), { signal });
    document.addEventListener('scroll', this.onScroll.bind(this), { signal });
    element.addEventListener('click', this.onClick.bind(this), { signal });
  }

  onResize() { /* ... */ }
  onScroll() { /* ... */ }
  onClick() { /* ... */ }

  destroy() {
    this.controller.abort();  // Remove all listeners at once
    this.element.remove();
    this.data = null;         // Explicitly release reference to large data
  }
}

// ---- Reference management with WeakRef / FinalizationRegistry ----
const cache = new Map();
const registry = new FinalizationRegistry((key) => {
  // Remove from cache when the element is GC'd
  cache.delete(key);
  console.log(`Element with key "${key}" was garbage collected`);
});

function cacheElement(key, element) {
  const weakRef = new WeakRef(element);
  cache.set(key, weakRef);
  registry.register(element, key);
}

function getCachedElement(key) {
  const weakRef = cache.get(key);
  if (!weakRef) return null;

  const element = weakRef.deref();
  if (!element) {
    cache.delete(key);
    return null;
  }
  return element;
}
```

### 11.3 Anti-Pattern 3: Synchronous Bulk DOM Updates

Adding a large amount of data to the DOM all at once blocks the main thread and causes frame drops.

```javascript
// ---- Dangerous: add 10,000 items to the DOM at once ----
function badRender(items) {
  const container = document.getElementById('list');
  container.innerHTML = '';  // Delete all (also leaks internal event listeners)

  items.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item.name;
    container.appendChild(div);  // 10,000 DOM operations
  });
}

// ---- Safe approach 1: chunk processing with DocumentFragment + requestAnimationFrame ----
function chunkedRender(items, chunkSize = 100) {
  const container = document.getElementById('list');
  let index = 0;

  function renderChunk() {
    const fragment = document.createDocumentFragment();
    const end = Math.min(index + chunkSize, items.length);

    for (; index < end; index++) {
      const div = document.createElement('div');
      div.textContent = items[index].name;
      fragment.appendChild(div);
    }

    container.appendChild(fragment);

    if (index < items.length) {
      requestAnimationFrame(renderChunk);
    }
  }

  requestAnimationFrame(renderChunk);
}

// ---- Safe approach 2: process during idle time with requestIdleCallback ----
function idleRender(items) {
  const container = document.getElementById('list');
  let index = 0;

  function renderBatch(deadline) {
    const fragment = document.createDocumentFragment();

    while (index < items.length && deadline.timeRemaining() > 2) {
      const div = document.createElement('div');
      div.textContent = items[index].name;
      fragment.appendChild(div);
      index++;
    }

    container.appendChild(fragment);

    if (index < items.length) {
      requestIdleCallback(renderBatch);
    }
  }

  requestIdleCallback(renderBatch);
}
```

---

## 12. Edge Case Analysis

### 12.1 Edge Case 1: Operations on Disconnected Elements

Operations on elements removed from the DOM (disconnected elements) do not throw errors, but can produce unintended results.

```javascript
// ---- Edge case: operations on a removed element ----

const div = document.createElement('div');
div.textContent = 'Hello';
document.body.appendChild(div);

// Remove from DOM while keeping the reference
div.remove();

// The following operations do not throw errors, but are not visible on screen
div.textContent = 'Updated';           // Succeeds but not visible
div.classList.add('active');           // Succeeds but has no effect
div.style.backgroundColor = 'red';   // Succeeds but has no effect

// Layout properties like offsetHeight return 0
console.log(div.offsetHeight);  // 0 (not part of the DOM tree)
console.log(div.offsetWidth);   // 0

// Can be checked with the isConnected property
console.log(div.isConnected);  // false

// ---- Safe implementation pattern ----
function updateElement(el, updates) {
  if (!el.isConnected) {
    console.warn('Element is not connected to the DOM');
    return false;
  }

  if (updates.text !== undefined) {
    el.textContent = updates.text;
  }
  if (updates.className !== undefined) {
    el.className = updates.className;
  }
  return true;
}

// Note when inside a MutationObserver callback
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Elements in removedNodes are already disconnected
    mutation.removedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Cleanup processing (remove listeners, stop timers, etc.)
        cleanupElement(node);
      }
    });
  }
});
```

### 12.2 Edge Case 2: Modifying Live Collections During Iteration

Going deeper into the live HTMLCollection problem mentioned earlier. Not just removal, but addition is also dangerous.

```javascript
// ---- Edge case: adding elements to a live collection ----

const container = document.getElementById('container');
const children = container.getElementsByTagName('div');

// Adding a new div during iteration causes an infinite loop.
// The following is shown intentionally as dangerous code (do not execute):
/*
for (let i = 0; i < children.length; i++) {
  const newDiv = document.createElement('div');
  newDiv.textContent = 'clone';
  container.appendChild(newDiv);
  // children.length keeps increasing → infinite loop
}
*/

// ---- Safe approach: convert to a static array with spread syntax ----
const staticChildren = [...container.getElementsByTagName('div')];
staticChildren.forEach(child => {
  const clone = child.cloneNode(true);
  container.appendChild(clone);  // Safe: staticChildren does not change
});

// ---- Safe approach: querySelectorAll (static NodeList) ----
container.querySelectorAll('div').forEach(child => {
  const clone = child.cloneNode(true);
  container.appendChild(clone);  // Safe
});

// ---- Edge case: forEach availability of NodeList ----
// NodeList from querySelectorAll → forEach available
// NodeList from childNodes → forEach available (modern browsers)
// HTMLCollection from getElementsBy → forEach NOT available
// Using Array.from() is safest
Array.from(document.getElementsByClassName('item')).forEach(el => {
  // Safe processing
});
```

### 12.3 Edge Case 3: Event Retargeting at Shadow DOM Boundaries

Events crossing Shadow DOM boundaries have their `event.target` retargeted.

```javascript
// When a button inside Shadow DOM is clicked
class MyWidget extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button id="inner-btn">Click me</button>';
  }
}
customElements.define('my-widget', MyWidget);

// Register a listener from outside
document.addEventListener('click', (e) => {
  // Even when the button inside Shadow DOM is clicked,
  // event.target becomes the <my-widget> host element (retargeted)
  console.log(e.target);       // <my-widget> (not the inner button)
  console.log(e.composedPath()); // [button#inner-btn, #shadow-root, my-widget, body, html, document, Window]
});

// Events with composed: false do not cross Shadow DOM boundaries
// Events with composed: true (click, focus, input, etc.) cross the boundary

// composedPath() lets you see the actual event path
document.addEventListener('click', (e) => {
  const path = e.composedPath();
  // path[0] is the element actually clicked (including inside Shadow DOM)
  console.log('Actual target:', path[0]);
});
```

---

## 13. Exercises

### Exercise 1 (Beginner): Implement a TODO List with CRUD

Implement a TODO list meeting the following specifications using only the raw DOM API without any framework.

**Requirements:**
- There is a text input field and an "Add" button
- Can also add by pressing Enter
- Each TODO has a "Complete" toggle button and a "Delete" button
- Completed TODOs show strikethrough
- Empty TODOs cannot be added (validation)
- Use event delegation to register only one listener on `<ul>`

```javascript
// ---- Sample solution for Exercise 1 ----

function createTodoApp(rootSelector) {
  const root = document.querySelector(rootSelector);

  // Build DOM structure
  root.innerHTML = '';
  const form = document.createElement('form');
  form.innerHTML = `
    <input type="text" class="todo-input" placeholder="Enter a TODO..." />
    <button type="submit">Add</button>
  `;

  const list = document.createElement('ul');
  list.className = 'todo-list';

  const stats = document.createElement('div');
  stats.className = 'todo-stats';

  root.append(form, list, stats);

  // State management
  let todos = [];
  let nextId = 1;

  function updateStats() {
    const total = todos.length;
    const completed = todos.filter(t => t.done).length;
    stats.textContent = `Total: ${total} / Completed: ${completed} / Remaining: ${total - completed}`;
  }

  function renderTodo(todo) {
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    li.className = todo.done ? 'todo-item completed' : 'todo-item';

    li.innerHTML = `
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button data-action="toggle">${todo.done ? 'Undo' : 'Complete'}</button>
      <button data-action="delete">Delete</button>
    `;

    return li;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('.todo-input');
    const text = input.value.trim();

    if (!text) {
      input.classList.add('error');
      return;
    }

    input.classList.remove('error');
    const todo = { id: nextId++, text, done: false };
    todos.push(todo);

    list.appendChild(renderTodo(todo));
    updateStats();
    input.value = '';
    input.focus();
  });

  // Handle TODO operations with event delegation
  list.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const li = actionBtn.closest('li[data-id]');
    if (!li) return;

    const id = Number(li.dataset.id);
    const action = actionBtn.dataset.action;

    if (action === 'toggle') {
      const todo = todos.find(t => t.id === id);
      if (todo) {
        todo.done = !todo.done;
        li.classList.toggle('completed');
        li.querySelector('.todo-text').style.textDecoration =
          todo.done ? 'line-through' : 'none';
        actionBtn.textContent = todo.done ? 'Undo' : 'Complete';
        updateStats();
      }
    }

    if (action === 'delete') {
      todos = todos.filter(t => t.id !== id);
      li.remove();
      updateStats();
    }
  });

  updateStats();
}

// Usage: createTodoApp('#app');
```

### Exercise 2 (Intermediate): DOM Change Log with MutationObserver

Simulate a scenario where an external script modifies the DOM, and implement a mechanism to record and display the change history with MutationObserver.

**Requirements:**
- There is a monitored element and a change log display area
- Detect addition/removal of child elements, attribute changes, and text changes
- Display the type, timestamp, and details of each change in the log
- There is a toggle button for "Start monitoring" / "Stop monitoring"
- There is a log clear button

```javascript
// ---- Sample solution for Exercise 2 ----

function createDOMMutationLogger(targetSelector, logSelector) {
  const target = document.querySelector(targetSelector);
  const logContainer = document.querySelector(logSelector);
  let observer = null;
  let isObserving = false;
  let logEntries = [];

  function formatTime() {
    return new Date().toISOString().split('T')[1].split('.')[0];
  }

  function addLogEntry(type, detail) {
    const entry = { time: formatTime(), type, detail };
    logEntries.push(entry);

    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.innerHTML = `
      <span class="log-time">[${entry.time}]</span>
      <span class="log-type">${type}</span>
      <span class="log-detail">${escapeHtml(detail)}</span>
    `;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  function escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function startObserving() {
    if (isObserving) return;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        switch (mutation.type) {
          case 'childList':
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                addLogEntry('childList',
                  `Added: <${node.tagName.toLowerCase()}> → ${getPath(mutation.target)}`);
              }
            });
            mutation.removedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                addLogEntry('childList',
                  `Removed: <${node.tagName.toLowerCase()}> from ${getPath(mutation.target)}`);
              }
            });
            break;
          case 'attributes':
            addLogEntry('attributes',
              `Attribute changed: ${mutation.attributeName} on ${getPath(mutation.target)}`);
            break;
          case 'characterData':
            addLogEntry('characterData',
              `Text changed: "${mutation.oldValue?.substring(0, 30)}..." → "${mutation.target.textContent.substring(0, 30)}..."`);
            break;
        }
      }
    });

    observer.observe(target, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true,
    });

    isObserving = true;
    addLogEntry('system', 'Monitoring started');
  }

  function stopObserving() {
    if (!isObserving || !observer) return;
    observer.disconnect();
    isObserving = false;
    addLogEntry('system', 'Monitoring stopped');
  }

  function getPath(el) {
    const parts = [];
    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) selector += `#${el.id}`;
      parts.unshift(selector);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function clearLog() {
    logEntries = [];
    logContainer.innerHTML = '';
  }

  return { startObserving, stopObserving, clearLog };
}
```

### Exercise 3 (Advanced): Reusable Modal Component with Shadow DOM

Using Web Components and Shadow DOM, implement a modal dialog meeting the following specifications.

**Requirements:**
- Register as a `<modal-dialog>` custom element
- Control show/hide with the `open` attribute
- Inject content via `title` slot and `default` slot
- Place action buttons in the `footer` slot
- Close with ESC key, close by clicking background
- Focus trap (Tab key cannot leave the modal)
- Theme customization with CSS custom properties
- Fire `open` / `close` custom events

```javascript
// ---- Sample solution for Exercise 3 ----

class ModalDialog extends HTMLElement {
  static get observedAttributes() {
    return ['open'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._shadow.innerHTML = `
      <style>
        :host {
          display: none;
          position: fixed;
          inset: 0;
          z-index: var(--modal-z-index, 1000);
        }

        :host([open]) {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .backdrop {
          position: fixed;
          inset: 0;
          background: var(--modal-backdrop-color, rgba(0, 0, 0, 0.5));
          backdrop-filter: blur(var(--modal-backdrop-blur, 2px));
        }

        .dialog {
          position: relative;
          background: var(--modal-bg, #ffffff);
          border-radius: var(--modal-radius, 12px);
          box-shadow: var(--modal-shadow, 0 20px 60px rgba(0, 0, 0, 0.3));
          max-width: var(--modal-max-width, 500px);
          width: 90%;
          max-height: 85vh;
          overflow: auto;
          animation: modal-enter 0.2s ease-out;
        }

        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--modal-border-color, #e2e8f0);
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5em;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          color: var(--modal-close-color, #718096);
        }

        .close-btn:hover {
          background: var(--modal-close-hover-bg, #f7fafc);
        }

        .body {
          padding: 20px;
        }

        .footer {
          padding: 12px 20px;
          border-top: 1px solid var(--modal-border-color, #e2e8f0);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .footer:empty {
          display: none;
        }
      </style>

      <div class="backdrop" part="backdrop"></div>
      <div class="dialog" role="dialog" aria-modal="true" part="dialog">
        <div class="header" part="header">
          <slot name="title"><span>Dialog</span></slot>
          <button class="close-btn" aria-label="Close" part="close-btn">&times;</button>
        </div>
        <div class="body" part="body">
          <slot></slot>
        </div>
        <div class="footer" part="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;

    // Bind events
    this._shadow.querySelector('.backdrop').addEventListener('click', () => {
      this.close();
    });

    this._shadow.querySelector('.close-btn').addEventListener('click', () => {
      this.close();
    });

    this._onKeyDown = this._handleKeyDown.bind(this);
  }

  connectedCallback() {
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'open') {
      if (newValue !== null) {
        this._onOpen();
      } else {
        this._onClose();
      }
    }
  }

  open() {
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
  }

  _onOpen() {
    // Move focus inside the dialog
    const dialog = this._shadow.querySelector('.dialog');
    const firstFocusable = dialog.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      requestAnimationFrame(() => firstFocusable.focus());
    }

    this.dispatchEvent(new CustomEvent('modal-open', { bubbles: true, composed: true }));
  }

  _onClose() {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  _handleKeyDown(e) {
    if (!this.hasAttribute('open')) return;

    if (e.key === 'Escape') {
      this.close();
      return;
    }

    // Focus trap
    if (e.key === 'Tab') {
      const dialog = this._shadow.querySelector('.dialog');
      const focusables = [
        ...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ...this.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ];

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

customElements.define('modal-dialog', ModalDialog);

// Usage in HTML:
// <modal-dialog id="my-modal">
//   <h2 slot="title">Confirmation</h2>
//   <p>Do you want to execute this operation?</p>
//   <div slot="footer">
//     <button onclick="document.getElementById('my-modal').close()">Cancel</button>
//     <button onclick="confirm()">OK</button>
//   </div>
// </modal-dialog>
```

---

## 14. Cross-Browser Differences and Polyfills for DOM API

### 14.1 Browser Support Status of Modern APIs

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| `element.remove()` | 23+ | 23+ | 7+ | 12+ |
| `element.closest()` | 41+ | 35+ | 6+ | 15+ |
| `element.matches()` | 33+ | 34+ | 7+ | 15+ |
| `element.toggleAttribute()` | 69+ | 63+ | 12+ | 79+ |
| `element.append()/prepend()` | 54+ | 49+ | 10+ | 17+ |
| `MutationObserver` | 26+ | 14+ | 7+ | 12+ |
| `IntersectionObserver` | 51+ | 55+ | 12.1+ | 15+ |
| `ResizeObserver` | 64+ | 69+ | 13.1+ | 79+ |
| Shadow DOM v1 | 53+ | 63+ | 10+ | 79+ |
| Declarative Shadow DOM | 111+ | 123+ | 16.4+ | 111+ |
| `element.isConnected` | 51+ | 49+ | 10+ | 79+ |

### 14.2 Safari-Specific Considerations

Safari can lag behind other browsers in implementing some DOM APIs. Particular attention is needed for the following:

- `adoptedStyleSheets` support was delayed (supported in Safari 16.4+)
- Support for form-associated custom elements is slow
- Declarative Shadow DOM's `shadowrootmode` supported in Safari 16.4+
- The `:focus-visible` pseudo-class may behave slightly differently

---

## 15. Performance Measurement

### 15.1 Techniques for Measuring DOM Operation Performance

```javascript
// Measure DOM operation duration with Performance API
function measureDOMOperation(label, operation) {
  performance.mark(`${label}-start`);

  operation();

  performance.mark(`${label}-end`);
  performance.measure(label, `${label}-start`, `${label}-end`);

  const measure = performance.getEntriesByName(label)[0];
  console.log(`${label}: ${measure.duration.toFixed(2)}ms`);

  // Cleanup
  performance.clearMarks(`${label}-start`);
  performance.clearMarks(`${label}-end`);
  performance.clearMeasures(label);

  return measure.duration;
}

// Usage: compare innerHTML vs DocumentFragment
const container = document.getElementById('test');
const items = Array.from({ length: 5000 }, (_, i) => `Item ${i}`);

// innerHTML
measureDOMOperation('innerHTML', () => {
  container.innerHTML = items.map(item => `<div class="item">${item}</div>`).join('');
});

// DocumentFragment
measureDOMOperation('DocumentFragment', () => {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.textContent = item;
    fragment.appendChild(div);
  });
  container.appendChild(fragment);
});

// Monitor layout shifts with PerformanceObserver
const layoutShiftObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
      console.warn('Layout shift detected:', entry.value, entry.sources);
    }
  }
});
layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
```

---
