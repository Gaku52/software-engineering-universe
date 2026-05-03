# Rendering Pipeline

> This guide walks through the entire process — from receiving HTML/CSS to painting pixels on screen — step by step, from DOM construction to Composite. Understand the role, cost, and optimization strategy of each stage to aim for a frontend engineer who can consistently maintain 60fps.

---

## What You Will Learn

- [ ] Explain the roles and interrelationships of all 6 rendering pipeline stages (DOM → CSSOM → Render Tree → Layout → Paint → Composite)
- [ ] Identify bottlenecks at each stage using DevTools
- [ ] Detect and fix Layout Thrashing
- [ ] Design animations that only involve the Composite stage
- [ ] Use will-change / contain / content-visibility appropriately
- [ ] Understand the differences between major browser engines (Blink, Gecko, WebKit)

---

## Prerequisites

| Topic | Recommended Level |
|-------|-------------------|
| HTML/CSS basics | Understand selector specificity and the box model |
| JavaScript basics | Understand DOM manipulation and the event loop concept |
| Browser DevTools | Able to use the Elements panel and Performance panel basics |

---

## 1. Pipeline Overview

### 1.1 Overview of the 6 Stages

The process from when the browser receives HTML over the network to when it paints pixels on screen can be divided into six major stages.

```
Rendering pipeline overview:

  Receive HTML/CSS/JS from the network
       │
       ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  ① DOM Construction                                         │
  │  HTML bytes → string → tokens → nodes → DOM tree            │
  └─────────────────────┬───────────────────────────────────────┘
                        │
  ┌─────────────────────▼───────────────────────────────────────┐
  │  ② CSSOM Construction                                        │
  │  CSS bytes → string → tokens → nodes → CSSOM tree           │
  └─────────────────────┬───────────────────────────────────────┘
                        │
                        │  DOM + CSSOM
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  ③ Render Tree Construction                                  │
  │  Combine DOM nodes and style info for visible elements only  │
  │  display:none → excluded / visibility:hidden → included      │
  └─────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  ④ Layout (Reflow)                                           │
  │  Calculate exact position (x,y) and size (width,height)     │
  │  Resolve viewport-relative positions, box model             │
  └─────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  ⑤ Paint (Repaint)                                           │
  │  Generate pixel-level drawing commands based on layout       │
  │  Text rendering, colors, shadows, borders, image fill        │
  └─────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  ⑥ Composite                                                 │
  │  Combine multiple paint layers on the GPU to produce the     │
  │  final image; transform / opacity can be handled here only   │
  └─────────────────────────────────────────────────────────────┘
       │
       ▼
    Display (synchronized with display refresh)
```

### 1.2 Cost Comparison by Stage

| Stage | Processing | Typical Cost | Thread | Scope of Impact |
|-------|-----------|-------------|--------|-----------------|
| DOM Construction | HTML parse → tree build | Medium | Main thread | - |
| CSSOM Construction | CSS parse → tree build | Low–Medium | Main thread | - |
| Render Tree | DOM + CSSOM merge | Low | Main thread | - |
| Layout | Coordinate/size calculation | **High** | Main thread | Cascades to descendants |
| Paint | Pixel drawing command generation | Medium | Main thread | Per layer |
| Composite | GPU layer compositing | **Low** | Compositor thread/GPU | Per layer |

### 1.3 CSS Property Changes and Pipeline Stage Mapping

Which CSS property you change determines which pipeline stage must be re-executed.

```
Pipeline re-execution map for CSS property changes:

  ┌─────────────────────┬────────┬────────┬───────┬───────────┐
  │ CSS Property        │ Style  │ Layout │ Paint │ Composite │
  ├─────────────────────┼────────┼────────┼───────┼───────────┤
  │ width / height      │   ✓    │   ✓    │   ✓   │     ✓     │
  │ margin / padding    │   ✓    │   ✓    │   ✓   │     ✓     │
  │ top / left / right  │   ✓    │   ✓    │   ✓   │     ✓     │
  │ font-size           │   ✓    │   ✓    │   ✓   │     ✓     │
  │ display             │   ✓    │   ✓    │   ✓   │     ✓     │
  │ float / position    │   ✓    │   ✓    │   ✓   │     ✓     │
  ├─────────────────────┼────────┼────────┼───────┼───────────┤
  │ color               │   ✓    │        │   ✓   │     ✓     │
  │ background-color    │   ✓    │        │   ✓   │     ✓     │
  │ background-image    │   ✓    │        │   ✓   │     ✓     │
  │ box-shadow          │   ✓    │        │   ✓   │     ✓     │
  │ border-radius       │   ✓    │        │   ✓   │     ✓     │
  │ outline             │   ✓    │        │   ✓   │     ✓     │
  │ visibility          │   ✓    │        │   ✓   │     ✓     │
  ├─────────────────────┼────────┼────────┼───────┼───────────┤
  │ transform           │   ✓    │        │       │  ✓ ← fastest│
  │ opacity             │   ✓    │        │       │  ✓ ← fastest│
  │ filter (GPU)        │   ✓    │        │       │  ✓ ← fastest│
  └─────────────────────┴────────┴────────┴───────┴───────────┘

  Legend: ✓ = that stage is re-executed
  → transform / opacity / filter skip Layout and Paint
  → Handled by GPU only, making them the fastest properties for animation
```

---

## 2. DOM Construction

### 2.1 HTML Parse Flow

The browser's HTML parser incrementally processes the byte stream received from the network and builds the DOM tree.

```
HTML parse processing flow:

  Bytes           Characters    Tokens          Nodes           DOM Tree

  3C 68 74   →    "<html>"  →   StartTag:html → HTMLElement →      html
  6D 6C 3E                                                        /    \
  3C 68 65   →    "<head>"  →   StartTag:head → HTMLElement →  head    body
  61 64 3E                                                       |       |
  ...        →    "<title>" →   StartTag:title→ HTMLElement → title    div
             →    "Hello"   →   Character     → TextNode   →  "Hello"  ...

  Important: Parsing is done incrementally (streaming)
  → Partially builds the DOM each time data is received from the network
  → Does not wait for the entire HTML to be received
```

### 2.2 Parser Blocking

When the parser encounters a `<script>` tag, the HTML parser pauses. This is because scripts may manipulate the DOM.

```javascript
// Code Example 1: Parse impact based on script tag placement

// Bad example: synchronous script in <head>
// → DOM construction is completely blocked
`<head>
  <script src="heavy-library.js"></script>  <!-- Parser stops here -->
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- DOM is not built until heavy-library.js finishes loading and executing -->
  <div id="app">...</div>
</body>`

// Good example: use async/defer
`<head>
  <script src="analytics.js" async></script>   <!-- Parallel with DOM parse -->
  <script src="app.js" defer></script>          <!-- Execute after DOM is built -->
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">...</div>  <!-- DOM built immediately -->
</body>`
```

**Difference between async and defer:**

| Attribute | Download | Execution Timing | Execution Order | Use Case |
|-----------|---------|-----------------|----------------|---------|
| (none) | Parse stops → download | Right after download | Source order | Legacy support |
| `async` | Parallel with parse | Right after download | Unspecified | Independent scripts (Analytics, etc.) |
| `defer` | Parallel with parse | Just before DOMContentLoaded | Source order | DOM-dependent scripts |

### 2.3 Speculative Parsing

While the main parser is waiting for a script to execute, modern browsers use a Preload Scanner to detect subsequent resource references and begin downloading them in advance.

```javascript
// Code Example 2: Resources detected by the Preload Scanner

`<head>
  <script src="app.js"></script>        <!-- Main parser stops here -->
  <!-- ↓ Preload Scanner scans ahead and pre-downloads the following -->
  <link rel="stylesheet" href="main.css">
  <script src="utils.js" defer></script>
  <link rel="preload" href="hero.webp" as="image">
</head>
<body>
  <img src="logo.png" alt="Logo">      <!-- Also a pre-download target -->
</body>`

// Anti-pattern that disables the Preload Scanner:
// → Dynamically inserting <script> or <link> via JS
//   prevents the Preload Scanner from detecting them

// Bad example: dynamic insertion
const script = document.createElement('script');
script.src = 'critical-module.js';      // Not visible to Preload Scanner
document.head.appendChild(script);

// Improvement: write <link rel="preload"> directly in HTML
`<link rel="preload" href="critical-module.js" as="script">`
```

---

## 3. CSSOM Construction

### 3.1 CSS Parse and Tree Construction

CSS files are also parsed from bytes — just like HTML — and converted into a tree structure (CSSOM: CSS Object Model).

```
CSSOM tree construction concept:

  CSS source:
  ┌────────────────────────────────┐
  │ body { font-size: 16px; }      │
  │ .container { width: 80%; }     │
  │ .container p { color: #333; }  │
  │ .container p .highlight {      │
  │   background: yellow;          │
  │ }                              │
  └────────────────────────────────┘

            ↓ Parse & cascade processing

  CSSOM tree:
                    [StyleSheet]
                         │
                     [body]
                  font-size: 16px
                         │
                   [.container]
                    width: 80%
                   (inherits font-size: 16px)
                         │
                      [p]
                   color: #333
                  (inherits font-size: 16px)
                         │
                  [.highlight]
                background: yellow
                (inherits color: #333)
                (inherits font-size: 16px)

  Characteristics:
  → CSS is a render-blocking resource
  → The Render Tree cannot be built until the CSSOM is complete
  → Includes cascade (priority resolution), inheritance, and default value application
```

### 3.2 Why CSS is Render-Blocking

CSS is treated as a render-blocking resource. If rendering proceeded with an incomplete CSSOM, unstyled content would be displayed momentarily (FOUC: Flash of Unstyled Content).

```javascript
// Code Example 3: Mitigating render blocking by inlining Critical CSS

// Step 1: Inline above-the-fold CSS (Critical CSS)
`<head>
  <!-- Critical CSS: minimum styles needed for first viewport -->
  <style>
    body { margin: 0; font-family: sans-serif; }
    .hero { height: 100vh; display: flex; align-items: center; }
    .hero h1 { font-size: 3rem; color: #1a1a1a; }
    .nav { position: fixed; top: 0; width: 100%; background: #fff; }
  </style>

  <!-- Load the rest of the CSS asynchronously -->
  <link rel="preload" href="full-styles.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript>
    <link rel="stylesheet" href="full-styles.css">
  </noscript>
</head>`

// Step 2: Automate Critical CSS extraction
// - critical (npm package)
// - critters (webpack plugin)
// - PurgeCSS + manual selection
```

### 3.3 Selector Matching Direction

Browser selector matching is evaluated **right-to-left** for performance reasons.

```
Understanding selector matching direction:

  CSS: .sidebar .menu li a { color: blue; }

  Matching order (right-to-left):
  1. First collect all <a> tags
  2. Filter those with a <li> parent
  3. Further filter those with a .menu ancestor
  4. Further filter those with a .sidebar ancestor

  Why right-to-left:
  → Left-to-right would require traversing all descendants of .sidebar, which is inefficient
  → Right-to-left narrows down candidates early

  Selector efficiency comparison:
  ┌────────────────────────────────┬──────────────┐
  │ Selector                       │ Efficiency    │
  ├────────────────────────────────┼──────────────┤
  │ #main-title                    │ Fastest (ID)  │
  │ .btn-primary                   │ Fast (Class)  │
  │ button                         │ Normal (Tag)  │
  │ div.wrapper > ul > li > a      │ Slow (deep)   │
  │ div * a                        │ Very slow     │
  │ [data-active="true"]           │ Slow (attr)   │
  └────────────────────────────────┴──────────────┘

  Note:
  → Modern browsers highly optimize selector matching
  → Noticeable difference only at thousands of elements
  → BEM notation .block__element--modifier is efficient
```

---

## 4. Render Tree Construction

### 4.1 Combining DOM + CSSOM

The Render Tree is generated by combining the DOM and CSSOM. It contains only elements displayed on screen.

```
Render Tree construction process:

  DOM tree:                    CSSOM tree:
  html                         body { font: 16px; }
  ├── head                     .visible { color: blue; }
  │   ├── meta                 .hidden { display: none; }
  │   └── title                .invisible { visibility: hidden; }
  └── body
      ├── div.visible
      │   └── "Hello"
      ├── div.hidden
      │   └── "Secret"
      ├── div.invisible
      │   └── "Ghost"
      └── script

                 ↓ Attachment (combine)

  Render Tree:
  [RenderView] ─── viewport
  └── [RenderBody] ─── font: 16px
      ├── [RenderBlock: div.visible] ─── color: blue
      │   └── [RenderText: "Hello"]
      └── [RenderBlock: div.invisible] ─── visibility: hidden
          └── [RenderText: "Ghost"]

  Excluded:
  ✗ <head> and children (meta, title, script) → non-display elements
  ✗ div.hidden → display: none is not included in the Render Tree
  ✗ <script> → not a display element

  Key differences:
  → display: none → completely excluded from Render Tree (no layout space)
  → visibility: hidden → included in Render Tree (has layout space)
  → opacity: 0 → included in Render Tree (has layout space, receives events)
```

### 4.2 Mismatches Between Render Tree and DOM

The Render Tree does not always have a one-to-one correspondence with the DOM.

```
Render Tree vs DOM mismatch patterns:

  1. display: none
     DOM: <div style="display:none">text</div>
     Render Tree: (does not exist)

  2. ::before / ::after pseudo-elements
     DOM: <p class="note">Body</p>
     CSS: .note::before { content: "Note: "; }
     Render Tree:
       [RenderBlock: p.note]
       ├── [RenderInline: ::before] → "Note: "
       └── [RenderText: "Body"]
     → Does not exist in DOM but exists in Render Tree

  3. Anonymous Box
     DOM: <div>Text <span>element</span> text</div>
     Render Tree:
       [RenderBlock: div]
       ├── [RenderText: "Text "]          ← anonymous inline box
       ├── [RenderInline: span]
       │   └── [RenderText: "element"]
       └── [RenderText: " text"]          ← anonymous inline box

  4. float / position: absolute
     → Removed from normal flow but exists in the Render Tree
     → However, handled separately in layout calculations
```

---

## 5. Layout (Reflow)

### 5.1 Layout Calculation Details

In the Layout stage, exact geometric information (position and size) is calculated for each Render Tree node. This process is also called "Reflow."

```
Information determined in Layout calculation:

  For each Render Object:
  ┌──────────────────────────────────────────┐
  │  x coordinate: distance from left of viewport  │
  │  y coordinate: distance from top of viewport   │
  │  width:   content width + padding + border      │
  │  height:  content height + padding + border     │
  │  margin:  outer spacing                         │
  │  scrollWidth:  scrollable width                 │
  │  scrollHeight: scrollable height                │
  └──────────────────────────────────────────┘

  Box model:
  ┌────────────────────────────────────────┐
  │              margin-top                │
  │  ┌──────────────────────────────────┐  │
  │  │          border-top              │  │
  │  │  ┌──────────────────────────┐    │  │
  │  │  │      padding-top         │    │  │
  │  │  │  ┌──────────────────┐    │    │  │
  │  │  │  │                  │    │    │  │
  │  │  │  │    content       │    │    │  │
  │  │  │  │  (width x height)│    │    │  │
  │  │  │  │                  │    │    │  │
  │  │  │  └──────────────────┘    │    │  │
  │  │  │      padding-bottom      │    │  │
  │  │  └──────────────────────────┘    │  │
  │  │          border-bottom           │  │
  │  └──────────────────────────────────┘  │
  │              margin-bottom             │
  └────────────────────────────────────────┘

  Difference due to box-sizing:
  → content-box (default): width = content width only
  → border-box: width = content + padding + border
```

### 5.2 Global Layout and Incremental Layout

Layout has two modes.

```
Layout modes:

  1. Global Layout
     → Recalculate the entire viewport
     → Triggers:
        · Initial render
        · Window resize
        · Font-size change (at html/body level)
        · Crossing a media query breakpoint
     → Cost: high (recalculates all elements)

  2. Incremental Layout
     → Recalculate only changed elements and their scope of impact
     → Triggers:
        · Size/position change of a specific element
        · Addition/deletion of DOM nodes
        · Text content change
     → Cost: depends on the scope of change

  Impact propagation pattern:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │   [parent]  ← width changed                       │
  │   ├── [child-1] ← recalculate if % width          │
  │   │   └── [grandchild] ← cascades similarly       │
  │   ├── [child-2] ← similar                         │
  │   └── [child-3] ← similar                         │
  │                                                  │
  │   → Parent changes propagate to descendants       │
  │   → Child changes can also affect parent size     │
  │     (e.g., when height is auto)                   │
  └──────────────────────────────────────────────────┘
```

### 5.3 Layout Thrashing

Layout Thrashing is a phenomenon where JavaScript alternately reads layout information and modifies the DOM, causing the browser to perform a Forced Synchronous Layout each time.

```javascript
// Code Example 4: Detecting and fixing Layout Thrashing

// --- Anti-pattern 1: Alternating reads and writes (Layout Thrashing) ---
function resizeAllBad(elements) {
  for (const el of elements) {
    // Reading offsetWidth → browser calculates the latest layout (forced sync layout)
    const currentWidth = el.offsetWidth;
    // Writing width → invalidates layout
    el.style.width = (currentWidth * 1.1) + 'px';
    // Next loop reads offsetWidth again → forced sync layout again
    // → Layout runs N times for N elements
  }
}

// --- Fix: batch reads, then batch writes ---
function resizeAllGood(elements) {
  // Phase 1: read all widths at once (Layout runs only once)
  const widths = [];
  for (const el of elements) {
    widths.push(el.offsetWidth);
  }

  // Phase 2: write all widths at once (Layout deferred to next frame)
  for (let i = 0; i < elements.length; i++) {
    elements[i].style.width = (widths[i] * 1.1) + 'px';
  }
}

// --- Fix (advanced): use requestAnimationFrame ---
function resizeAllRAF(elements) {
  const widths = elements.map(el => el.offsetWidth);

  requestAnimationFrame(() => {
    elements.forEach((el, i) => {
      el.style.width = (widths[i] * 1.1) + 'px';
    });
  });
}

// --- Fix (library): use fastdom ---
// fastdom automatically batches DOM reads and writes
// npm install fastdom
import fastdom from 'fastdom';

function resizeAllFastdom(elements) {
  elements.forEach(el => {
    fastdom.measure(() => {
      const width = el.offsetWidth;
      fastdom.mutate(() => {
        el.style.width = (width * 1.1) + 'px';
      });
    });
  });
}
```

### 5.4 APIs That Trigger Forced Synchronous Layout

Calling the following JavaScript APIs causes the browser to synchronously recalculate the layout to return up-to-date information.

| Category | Property / Method |
|----------|-------------------|
| Element dimensions | `offsetWidth`, `offsetHeight`, `offsetTop`, `offsetLeft` |
| Client area | `clientWidth`, `clientHeight`, `clientTop`, `clientLeft` |
| Scroll | `scrollWidth`, `scrollHeight`, `scrollTop`, `scrollLeft` |
| Rect info | `getBoundingClientRect()`, `getClientRects()` |
| Window | `window.getComputedStyle()`, `window.scrollX`, `window.scrollY` |
| Focus | `element.focus()` (some browsers) |
| Other | `window.innerHeight`, `window.innerWidth` |

---

## 6. Paint

### 6.1 What Paint Does

In the Paint stage, pixel-level drawing commands (Paint Records) are generated based on the geometric information calculated in Layout.

```
Drawing targets in the Paint stage:

  Drawing order (follows Stacking Order):
  ┌─────────────────────────────────────────────┐
  │  1. Element background-color                 │
  │  2. Element background-image                 │
  │  3. Element border                           │
  │  4. Child elements (same order recursively)  │
  │  5. Element outline                          │
  └─────────────────────────────────────────────┘

  Stacking Context:
  → Positioned elements with z-index
  → Elements with opacity < 1
  → Elements with transform
  → Elements with filter
  → Elements with will-change
  → Elements with isolation: isolate

  Scope of Paint impact:
  → The entire layer containing the changed element is repainted
  → If layers are separated, other layers do not need repainting
```

### 6.2 Operations That Trigger Repaint

```
Cases where only Repaint occurs (no Layout needed):

  → color change
  → background-color / background-image change
  → Toggling visibility: visible ↔ hidden
  → box-shadow change
  → border-color change
  → border-radius change
  → outline change
  → text-decoration change

  Key points:
  → Visual changes that don't alter geometric properties (position/size)
  → Lighter than Layout, but repainting a large area is still costly
  → Complex box-shadow or gradients in particular have high Paint cost
```

### 6.3 Paint Optimization: CSS contain Property

The `contain` property explicitly tells the browser the scope of Paint (and Layout) impact for an element.

```css
/* Code Example 5: Paint optimization with the contain property */

/* layout: internal layout changes of this element do not affect the outside */
.card {
  contain: layout;
}

/* paint: internal Paint of this element does not extend beyond the element's boundary */
.widget {
  contain: paint;
}

/* size: size of this element does not depend on children (must be explicitly specified) */
.fixed-box {
  contain: size;
  width: 300px;
  height: 200px;
}

/* strict: includes all of layout + paint + size (strongest containment) */
.isolated-component {
  contain: strict;
  width: 400px;
  height: 300px;
}

/* content: layout + paint (excludes size, more practical) */
.article-card {
  contain: content;
}

/* content-visibility: completely skip rendering of off-screen elements */
.long-list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px; /* estimated size for layout */
}
```

```
Summary of contain property effects:

  ┌──────────────┬─────────────────────────────────────────────┐
  │  Value       │  Effect                                      │
  ├──────────────┼─────────────────────────────────────────────┤
  │  layout      │  Internal layout changes do not ripple out   │
  │  paint       │  Internal drawing is clipped to element bounds│
  │  size        │  Element size is independent of children     │
  │              │  (requires explicit width/height)            │
  │  style       │  CSS counters etc. do not leak outside       │
  │  content     │  layout + paint (recommended: versatile)     │
  │  strict      │  layout + paint + size (maximum containment) │
  └──────────────┴─────────────────────────────────────────────┘

  Effect of content-visibility: auto:
  → Off-screen elements skip all of Layout / Paint / Composite
  → Rendering starts when the element scrolls into view
  → Dramatically improves initial render speed for long lists and feed UIs
  → contain-intrinsic-size stabilizes the scrollbar height
```

---

## 7. Composite

### 7.1 The Layer Concept

In the Composite stage, paint results are managed as "layers" and composited on the GPU to produce the final screen.

```
Layer compositing concept:

  Final result displayed on screen:
  ┌─────────────────────────────────────┐
  │                                     │
  │   ┌───────────────────────┐         │
  │   │  Layer 3: Modal       │←── z: 3 │
  │   │  (with transform)     │         │
  │   └───────────────────────┘         │
  │                                     │
  │   ┌─────────────────────────────┐   │
  │   │  Layer 2: Header            │←── z: 2 (position: fixed)
  │   └─────────────────────────────┘   │
  │                                     │
  │   ┌─────────────────────────────┐   │
  │   │  Layer 1: Main content      │←── z: 1 │
  │   │                             │   │
  │   │  Text, images, cards...     │   │
  │   │                             │   │
  │   └─────────────────────────────┘   │
  │                                     │
  │   Layer 0: Background               │←── z: 0 │
  └─────────────────────────────────────┘

  GPU compositing flow:
  1. Rasterize (pixelate) each layer individually
  2. Upload layers as textures to the GPU
  3. Composite layers in z-order
  4. Output final image to frame buffer
  5. Display on screen
```

### 7.2 Conditions for Layer Promotion

Elements that meet certain conditions are automatically promoted to an independent composite layer.

```
Conditions that trigger layer promotion:

  Explicit promotion:
  ┌────────────────────────────────────────────────────┐
  │ will-change: transform                              │
  │ will-change: opacity                                │
  │ will-change: filter                                 │
  │ transform: translate3d(...) / translateZ(...)        │
  │ backface-visibility: hidden                         │
  └────────────────────────────────────────────────────┘

  Implicit promotion:
  ┌────────────────────────────────────────────────────┐
  │ Elements with position: fixed                       │
  │ <video> / <canvas> / <iframe> elements              │
  │ CSS animation / transition (transform/opacity)      │
  │ Overlapping with a higher z-index layer (implicit)  │
  │ Elements with filter property                       │
  │ Elements with mix-blend-mode                        │
  │ Elements with isolation: isolate                    │
  │ Elements with clip-path / mask                      │
  │ Elements with backdrop-filter                       │
  └────────────────────────────────────────────────────┘

  Implicit promotion (related to Layer Squashing):
  → Elements overlapping with a layer are automatically promoted
  → This is called "implicit compositing"
  → The browser uses Layer Squashing to consolidate unnecessary layers
```

### 7.3 Correct Usage of will-change

```javascript
// Code Example 6: Best practices for will-change

// --- Correct: apply just before animation, remove after it ends ---
const card = document.querySelector('.card');

card.addEventListener('mouseenter', () => {
  // Prepare the layer just before hovering
  card.style.willChange = 'transform';
});

card.addEventListener('transitionend', () => {
  // Release the layer after the transition completes
  card.style.willChange = 'auto';
});

// --- Always-on in CSS (only for frequently animated elements) ---
/*
.frequently-animated {
  will-change: transform, opacity;
}
*/

// --- Anti-pattern: applying will-change to all elements ---
/*
  Never do this:
  * {
    will-change: transform;
  }

  Reasons:
  → All elements get layer promotion → massive GPU memory consumption
  → Can cause crashes due to out-of-memory on mobile devices
  → Interferes with browser optimizations
*/

// --- Recommended pattern for applying will-change in CSS ---
/*
.card {
  transition: transform 0.3s ease;
}
.card:hover {
  will-change: transform;
}
.card:active {
  transform: scale(1.05);
}
*/
```

### 7.4 Role of the Compositor Thread

Composite processing runs on the Compositor Thread, which is independent from the main thread.

```
Understanding the thread model:

  Main thread:
  ┌──────────────────────────────────────────────┐
  │  JavaScript → Style → Layout → Paint          │
  │  (heavy processing causes frame drops)        │
  └──────────────┬───────────────────────────────┘
                 │ Paint Records + Layer info
                 ▼
  Compositor thread:
  ┌──────────────────────────────────────────────┐
  │  Composite (GPU compositing)                  │
  │  → Unaffected by main thread load             │
  │  → transform / opacity changes handled here  │
  │  → Scroll handling also possible here         │
  └──────────────────────────────────────────────┘

  What this means:
  → Even when heavy JS is running on the main thread,
    transform / opacity animations run smoothly
  → Scrolling is handled on the compositor thread, so
    JS execution rarely blocks scroll
    (except when scroll event handlers are present)

  Note: scroll event handlers and the passive option
  document.addEventListener('scroll', handler, { passive: true });
  → Specifying passive: true tells the browser that preventDefault()
    won't be called inside the handler → scroll is not blocked
```

---

## 8. Rules for Achieving 60fps

### 8.1 Frame Budget

```
Time allocation per frame (at 60fps):

  1 second / 60 frames = 16.67ms / frame

  Ideal time allocation:
  ┌────────────────────────────────────────────────────────┐
  │                    16.67ms                              │
  ├──────────┬────────┬────────┬───────┬──────────┬────────┤
  │ Input    │  JS    │ Style  │Layout │  Paint   │Composite│
  │ handling │(<10ms) │        │       │          │        │
  │  (~1ms)  │        │(~1ms)  │(~2ms) │ (~2ms)   │(~1ms)  │
  ├──────────┴────────┴────────┴───────┴──────────┴────────┤
  │ Total: ~17ms → barely makes it                          │
  │ If JS exceeds 10ms → frame drop (jank)                  │
  └────────────────────────────────────────────────────────┘

  For 120Hz displays:
  → 1 frame = 8.33ms → even tighter budget
  → JS must be kept under 5ms

  Visual impact of frame drops:
  ┌──────────────────────────────────────────┐
  │ 60fps: ●●●●●●●●●●●● smooth               │
  │ 30fps: ●─●─●─●─●─●─ starts to feel choppy│
  │ 15fps: ●───●───●───● obviously choppy    │
  │  5fps: ●─────────●── slideshow-like       │
  └──────────────────────────────────────────┘
```

### 8.2 Animation Optimization Comparison

```javascript
// Code Example 7: Comparison of animation techniques

// --- Method 1: Animating with left/top (not recommended) ---
// Pipeline: Style → Layout → Paint → Composite (all stages)
function animateWithPosition(element) {
  let pos = 0;
  function frame() {
    pos += 2;
    element.style.left = pos + 'px';  // Layout + Paint + Composite
    if (pos < 300) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// --- Method 2: Animating with transform (recommended) ---
// Pipeline: Style → Composite (skips Layout and Paint)
function animateWithTransform(element) {
  let pos = 0;
  function frame() {
    pos += 2;
    element.style.transform = `translateX(${pos}px)`;  // Composite only
    if (pos < 300) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// --- Method 3: CSS Animation (most recommended) ---
// Easiest for the browser to optimize
/*
@keyframes slideRight {
  from { transform: translateX(0); }
  to   { transform: translateX(300px); }
}

.animated-element {
  animation: slideRight 0.5s ease-out forwards;
}
*/

// --- Method 4: Web Animations API (programmatic control) ---
function animateWithWAAPI(element) {
  const animation = element.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(300px)' }
  ], {
    duration: 500,
    easing: 'ease-out',
    fill: 'forwards'
  });

  animation.onfinish = () => {
    console.log('Animation completed');
  };

  return animation;  // pause(), cancel(), reverse() are possible
}
```

### 8.3 Animation Technique Comparison

| Method | Pipeline Stages | Smoothness | Behavior During JS | Control | Recommendation |
|--------|----------------|------------|-------------------|---------|----------------|
| `left`/`top` change | Style→Layout→Paint→Comp | Low | Choppy | High | Not recommended |
| `transform` (JS) | Style→Comp | High | Smooth | High | Recommended |
| CSS Animation | Style→Comp | Highest | Smooth | Low | Most recommended |
| Web Animations API | Style→Comp | Highest | Smooth | High | Most recommended |
| `setTimeout`/`setInterval` | All stages | Lowest | Stops | High | Not recommended |

### 8.4 Splitting Heavy JS Tasks

```javascript
// Code Example 8: Techniques for splitting long-running tasks

// --- Anti-pattern 2: Blocking the main thread for a long time ---
function processLargeArrayBad(items) {
  // Processing 100,000 items at once → main thread blocked for hundreds of ms
  // → Animations stop, input becomes unresponsive
  for (const item of items) {
    heavyComputation(item);
  }
}

// --- Fix: chunk splitting + requestIdleCallback ---
function processLargeArrayGood(items) {
  const CHUNK_SIZE = 100;
  let index = 0;

  function processChunk(deadline) {
    // Check remaining frame time with deadline.timeRemaining()
    while (index < items.length && deadline.timeRemaining() > 1) {
      const end = Math.min(index + CHUNK_SIZE, items.length);
      for (let i = index; i < end; i++) {
        heavyComputation(items[i]);
      }
      index = end;
    }

    if (index < items.length) {
      requestIdleCallback(processChunk);
    }
  }

  requestIdleCallback(processChunk);
}

// --- Fix: offload to Web Worker ---
// main.js
const worker = new Worker('compute-worker.js');

worker.postMessage({ items: largeArray });
worker.onmessage = (event) => {
  const results = event.data;
  updateUI(results);  // Reflect results in the UI
};

// compute-worker.js
self.onmessage = (event) => {
  const { items } = event.data;
  const results = items.map(item => heavyComputation(item));
  self.postMessage(results);
};

// --- Fix: scheduler.yield() (new API) ---
async function processWithYield(items) {
  for (let i = 0; i < items.length; i++) {
    heavyComputation(items[i]);

    // Periodically yield control back to the main thread
    if (i % 100 === 0 && 'scheduler' in globalThis) {
      await scheduler.yield();
    }
  }
}
```

---

## 9. Differences Between Browser Engines

### 9.1 Comparison of Major Engines

| Feature | Blink (Chrome/Edge) | Gecko (Firefox) | WebKit (Safari) |
|---------|-------------------|-----------------|-----------------|
| Layout engine | LayoutNG | Gecko Layout | WebCore Layout |
| Paint method | Skia (GPU accelerated) | WebRender (GPU) | CoreGraphics |
| Compositor | cc (Chromium Compositor) | WebRender | CA (Core Animation) |
| Thread model | Multi-process, multi-thread | Multi-process | Multi-process (limited) |
| Layer management | Has implicit promotion | More manual management | Depends on Core Animation |
| will-change support | Full | Full | Partial (past bugs) |
| content-visibility | Supported | Supported | Partial support |
| contain property | Full | Full | Full |

### 9.2 Pipeline Analysis with Chrome DevTools

```
Steps for rendering pipeline analysis with Chrome DevTools:

  1. Performance panel:
     → F12 → Performance tab → Record
     → Perform the action → Stop
     → Check each frame's tasks in the Main section
     → Yellow = JS / Purple = Layout / Green = Paint

  2. Rendering panel (detailed settings):
     → F12 → Ctrl+Shift+P → "Show Rendering"
     → Paint flashing: highlight repaint areas in green
     → Layout Shift Regions: visualize where CLS occurs
     → Layer borders: show composite layer boundaries
     → FPS meter: real-time FPS display

  3. Layers panel:
     → F12 → Ctrl+Shift+P → "Show Layers"
     → View layer overlapping in 3D view
     → Check memory usage per layer
     → Check reason for layer promotion (Compositing Reasons)

  4. Performance Monitor:
     → F12 → Ctrl+Shift+P → "Show Performance Monitor"
     → Monitor in real time:
        · CPU usage
        · JS heap size
        · DOM Nodes count
        · Layouts / sec
        · Style recalcs / sec
```

---

## 10. Practical Optimization Techniques

### 10.1 Using CSS contain and content-visibility

```css
/* Code Example 9: Virtual-list-style optimization */

/* Apply content-visibility to each item in a long list */
.feed-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 120px;  /* Specify estimated height */
}

/* Card component containment */
.card {
  contain: content;  /* layout + paint */
  /* → Changes inside the card do not ripple outside */
}

/* Sidebar widget */
.sidebar-widget {
  contain: strict;
  width: 300px;
  height: 250px;
  /* → Completely independent rendering context */
}

/* Hidden tab content */
.tab-panel[hidden] {
  content-visibility: hidden;
  /* Unlike display:none, preserves state while skipping rendering */
  /* → Lower re-render cost when switching tabs */
}
```

### 10.2 Batching DOM Operations

```javascript
// Code Example 10: Batched DOM operations with DocumentFragment

// --- Bad example: adding elements one by one ---
function addItemsBad(container, items) {
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name;
    li.className = 'list-item';
    container.appendChild(li);
    // → Layout may be recalculated every time
  });
}

// --- Good example: add all at once with DocumentFragment ---
function addItemsGood(container, items) {
  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name;
    li.className = 'list-item';
    fragment.appendChild(li);  // Off-screen, so no Layout
  });

  container.appendChild(fragment);  // Single DOM operation adds everything
}

// --- Good example: use innerHTML (fastest for large numbers of elements) ---
function addItemsFastest(container, items) {
  const html = items.map(item =>
    `<li class="list-item">${escapeHtml(item.name)}</li>`
  ).join('');

  container.insertAdjacentHTML('beforeend', html);
}

// HTML escape function (XSS prevention)
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
```

---

## FAQ

### Q1. How do I identify bottlenecks in the rendering pipeline?

**A.** Use the Chrome DevTools Performance panel.

```
Steps:
1. F12 → Performance tab → Record (or Ctrl+E)
2. Perform page actions (scroll, animation, interactions)
3. Stop → check frames in the Main section

How to read it:
→ Long yellow (JavaScript) → heavy JS processing (consider chunk splitting / Web Worker)
→ Long purple (Layout) → frequent Reflow (possible Layout Thrashing)
→ Long green (Paint) → complex drawing (box-shadow, gradient, large areas)
→ Red triangle markers → frame drop (exceeds 16.67ms)

Specific diagnostics:
· Layout over 5ms → use contain property for containment
· Repeated Paint → convert to will-change / transform animation
· Script over 50ms → offload to requestIdleCallback / Web Worker
· Frequent Recalculate Style → reduce CSS selector depth

Auxiliary tools:
· Rendering panel → visualize repaint areas with Paint flashing
· Layers panel → check layer configuration and memory usage
· Performance Monitor → monitor Layouts/sec in real time
```

### Q2. What is the relationship between Virtual DOM (React/Vue) and the rendering pipeline?

**A.** Virtual DOM is a "DOM operation optimization layer" and is a separate layer from the browser's rendering pipeline.

```
How they relate:

  [React/Vue Component] ← Application layer
       ↓ state change
  [Virtual DOM diff] ← Virtual DOM layer
       ↓ diff detection
  [Minimal DOM operations] ← DOM API calls
       ↓
  [Rendering pipeline] ← Browser layer
   Style → Layout → Paint → Composite

What Virtual DOM solves:
→ Prevents developers from writing wasteful DOM operations
→ Combines many state changes into a single batch update
→ React 18 Concurrent Mode also enables priority control

What Virtual DOM does NOT solve:
→ Layout Thrashing (separating reads and writes is the developer's responsibility)
→ Heavy Paint (choosing CSS properties is the developer's responsibility)
→ Unnecessary layer promotion (misusing will-change)

Key to performance:
→ Virtual DOM reduces the number of DOM operations, but not the cost of each
→ If Layout / Paint costs are high, Virtual DOM alone is insufficient
→ Conclusion: Virtual DOM + contain + transform/opacity animations is ideal
```

### Q3. What is the single most important optimization for maintaining 60fps?

**A.** **Implement all animations using only transform / opacity.**

```
Reasons:
→ transform / opacity are handled only in the Composite stage
→ Skipping Layout and Paint saves enormous amounts of the 16.67ms frame budget
→ Handled on the Compositor Thread, so animations stay smooth even during heavy JS

Specific rules:
┌──────────────────────────────────────────────────────────┐
│ DO (recommended)                                          │
├──────────────────────────────────────────────────────────┤
│ ✓ transform: translateX/Y/Z, scale, rotate, skew         │
│ ✓ opacity                                                 │
│ ✓ filter (some GPU-accelerated ones: blur, brightness, etc.) │
│ ✓ will-change: transform, opacity (apply just before)    │
│ ✓ CSS Animation / Transition                             │
│ ✓ Web Animations API                                     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ DON'T (not recommended)                                   │
├──────────────────────────────────────────────────────────┤
│ ✗ left / top / right / bottom                            │
│ ✗ width / height (when animating)                        │
│ ✗ margin / padding (when animating)                      │
│ ✗ setTimeout / setInterval                               │
│ ✗ jQuery.animate() (internally uses left/top)            │
└──────────────────────────────────────────────────────────┘

Example: moving an element 300px to the right
  Bad:  element.style.left = '300px'; → Layout + Paint + Composite
  Good: element.style.transform = 'translateX(300px)'; → Composite only

Additional optimizations:
→ Skip off-screen elements with content-visibility: auto
→ Use contain: content to limit scope of internal changes
→ Offload heavy processing to Web Worker
→ Handle low-priority tasks with requestIdleCallback
```

---

## Summary

### Key Points of the Rendering Pipeline

| Stage | Role | When It Occurs | Cost | Optimization |
|-------|------|----------------|------|-------------|
| **DOM Construction** | HTML parse | When HTML is received | Medium | Use async/defer, leverage Preload Scanner |
| **CSSOM Construction** | CSS parse | When CSS is received | Low–Medium | Inline Critical CSS, use media queries |
| **Render Tree** | DOM+CSSOM merge | When both are complete | Low | Use display:none to exclude unnecessary elements |
| **Layout** | Coordinate/size calculation | Geometric changes | **High** | Use contain for containment, separate reads/writes |
| **Paint** | Pixel drawing commands | Visual changes | Medium | Layer separation, reduce box-shadow |
| **Composite** | GPU layer compositing | Always | **Low** | transform/opacity animations |

### Three Most Important Principles

1. **Implement all animations using only transform / opacity**
   - Skip Layout and Paint; handle only with Composite
   - Unaffected by main thread load; can always maintain 60fps
   - Apply will-change just before to prepare layer promotion

2. **Never allow Layout Thrashing**
   - Separate DOM reads (offsetWidth, etc.) from writes (style changes)
   - Use the fastdom library to batch automatically
   - Use requestAnimationFrame to control write timing

3. **Limit scope with contain / content-visibility**
   - Apply `contain: content` per component
   - Use `content-visibility: auto` to skip off-screen elements in long lists
   - Helps browser optimizations; smooth even with thousands of elements

---

## Performance Optimization in Practice

### Practice 1: Optimizing the Critical Rendering Path

The Critical Rendering Path is the shortest path the browser needs to paint the first pixels on screen. Optimizing this path can dramatically improve First Contentful Paint (FCP) and Largest Contentful Paint (LCP).

**Inlining Critical CSS:**

Inline only the CSS needed for the first viewport in a `<style>` tag within the HTML, and load the remaining CSS asynchronously. This allows rendering to begin without waiting for external CSS file downloads.

```html
<head>
  <!-- Inline CSS needed for the first viewport -->
  <style>
    /* Critical CSS: header, hero, navigation */
    .header { display: flex; align-items: center; height: 64px; }
    .hero { min-height: 400px; background: #f0f0f0; }
    .nav { display: flex; gap: 16px; }
  </style>

  <!-- Load remaining CSS asynchronously -->
  <link rel="preload" href="/styles/main.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles/main.css"></noscript>
</head>
```

**Using resource hints:**

```html
<!-- Pre-resolve DNS -->
<link rel="dns-prefetch" href="https://api.example.com">

<!-- Pre-establish TCP connection -->
<link rel="preconnect" href="https://cdn.example.com" crossorigin>

<!-- Pre-load critical resources -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/images/hero.webp" as="image">

<!-- Pre-fetch the next page -->
<link rel="prefetch" href="/about.html">
```

### Practice 2: Preventing Layout Shifts

Cumulative Layout Shift (CLS) is a metric that greatly harms user experience and is closely related to the Layout stage of the rendering pipeline. The most effective way to prevent layout shifts is to reserve element sizes in advance.

```html
<!-- Images: reserve aspect-ratio with width/height attributes -->
<img src="photo.jpg" width="800" height="600" alt="Description"
     style="max-width: 100%; height: auto;">

<!-- Dynamic content: reserve space with min-height -->
<div class="ad-slot" style="min-height: 250px;">
  <!-- Space reserved until the ad loads -->
</div>

<!-- Web fonts: use size-adjust to reduce size difference with fallback font -->
<style>
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
  size-adjust: 105%;
  ascent-override: 90%;
  descent-override: 20%;
}
</style>
```

**Debugging layout shifts:**

```javascript
// Detect layout shifts with PerformanceObserver
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      console.log('Layout shift detected:', {
        value: entry.value,
        sources: entry.sources?.map(s => ({
          node: s.node,
          previousRect: s.previousRect,
          currentRect: s.currentRect,
        })),
      });
    }
  }
});
observer.observe({ type: 'layout-shift', buffered: true });
```

### Practice 3: Rendering Optimization for Large Numbers of Elements

When rendering lists with thousands or tens of thousands of elements (tables, feeds, chat logs, etc.), rendering all elements simultaneously causes Layout and Paint costs to explode. Use the following three techniques as appropriate.

**Technique 1: Deferred rendering with content-visibility**

```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 80px; /* Specify estimated height */
}
```

`content-visibility: auto` completely skips rendering (Style/Layout/Paint) for off-screen elements and only begins rendering when an element approaches the viewport. Specifying `contain-intrinsic-size` makes scrollbar position calculation accurate. Cases have been reported where initial rendering is up to 7x faster for a list of 10,000 items.

**Technique 2: Virtual Scrolling**

Virtual scrolling is a technique that keeps only elements visible in the viewport in the DOM. DOM elements are dynamically created and destroyed as the scroll position changes, keeping the DOM node count to a few dozen even for hundreds of thousands of data items.

```javascript
class VirtualList {
  constructor(container, items, itemHeight) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;

    // Set total scroll area height
    this.spacer = document.createElement('div');
    this.spacer.style.height = `${items.length * itemHeight}px`;
    container.appendChild(this.spacer);

    container.addEventListener('scroll', () => this.render(), { passive: true });
    this.render();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleCount, this.items.length);

    // Clear existing items and redraw
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const el = document.createElement('div');
      el.className = 'virtual-item';
      el.style.position = 'absolute';
      el.style.top = `${i * this.itemHeight}px`;
      el.style.height = `${this.itemHeight}px`;
      el.textContent = this.items[i];
      fragment.appendChild(el);
    }

    // Batch update
    requestAnimationFrame(() => {
      this.spacer.querySelectorAll('.virtual-item').forEach(el => el.remove());
      this.spacer.appendChild(fragment);
    });
  }
}
```

**Technique 3: Lazy initialization with Intersection Observer**

Render off-screen elements as lightweight placeholders, and initialize the actual content when they enter the viewport.

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      // Initialize the heavy component
      initializeComponent(el);
      observer.unobserve(el);
    }
  });
}, {
  rootMargin: '200px', // Start initializing 200px ahead
});

document.querySelectorAll('.lazy-component').forEach(el => {
  observer.observe(el);
});
```

### Practice 4: Performance Analysis Workflow with DevTools

The recommended workflow for analyzing rendering performance in actual development:

1. **Prepare the measurement environment**: Open an incognito window to exclude extension effects, and enable CPU throttling (4x slowdown) to simulate a low-spec device.

2. **Record with the Performance panel**: Record a profile while performing the problematic operations (scrolling, animation, screen transitions).

3. **Analyze the flame chart**: Identify frames that exceed 16.67ms (red bars) and check the breakdown of Layout/Paint/Composite within them.

4. **Identify the bottleneck**: If Layout dominates, suspect Layout Thrashing. If Paint dominates, check for excessive use of box-shadow or filter.

5. **Fix and remeasure**: Profile the same operations after fixing, and quantitatively verify the improvement in frame time.

```javascript
// Performance measurement from code
performance.mark('animation-start');

// Animation processing
requestAnimationFrame(() => {
  // DOM update processing
  updateAnimatedElements();

  performance.mark('animation-end');
  performance.measure('animation-duration', 'animation-start', 'animation-end');

  const measure = performance.getEntriesByName('animation-duration')[0];
  if (measure.duration > 16.67) {
    console.warn(`Frame budget exceeded: ${measure.duration.toFixed(2)}ms`);
  }
});
```

---

## Next Guides to Read

→ [CSS Layout Engine](./01-css-layout-engine.md) — Details of layout calculation

→ [Paint and Compositing](./02-paint-and-compositing.md) — Details of the drawing process

---

## References

### Official Documentation and Specifications

- [HTML Standard - 8.2 Parsing HTML documents](https://html.spec.whatwg.org/multipage/parsing.html)
  HTML parser behavior specification

- [CSS Containment Module Level 2](https://www.w3.org/TR/css-contain-2/)
  Specification for contain property and content-visibility

- [Chromium Design Docs - How Blink Works](https://docs.google.com/document/d/1aitSOucL0VHZa9Z2vbRJSyAIsAz24kX8LFByQ5xQnUg/edit)
  Internal design of the Blink rendering engine

### Performance Optimization Guides

- [Chrome Developers - Rendering Performance](https://developer.chrome.com/docs/lighthouse/performance/rendering/)
  Comprehensive guide to rendering performance

- [web.dev - Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls)
  How to detect and fix Layout Shift

- [web.dev - content-visibility: the new CSS property](https://web.dev/articles/content-visibility)
  Practical use of content-visibility

### DevTools Resources

- [Chrome DevTools - Performance features reference](https://developer.chrome.com/docs/devtools/performance/reference/)
  Detailed usage of the Performance panel

- [Firefox Developer Tools - Performance](https://firefox-source-docs.mozilla.org/devtools-user/performance/)
  Performance analysis with Firefox DevTools

- [Chromium Blog - Inside look at modern web browser (part 3)](https://developer.chrome.com/blog/inside-browser-part3/)
  Detailed explanation of the rendering pipeline (with diagrams)

### Other Important Resources

- [Paul Irish - What Forces Layout / Reflow](https://gist.github.com/paulirish/5d52fb081b3570c81e3a)
  Complete list of properties that trigger forced synchronous layout

- [CSS Triggers](https://csstriggers.com/)
  Table showing which pipeline stage each CSS property affects

- [Compositor Thread Architecture](https://blog.chromium.org/2014/05/a-faster-smoother-web.html)
  Chromium compositor thread architecture
