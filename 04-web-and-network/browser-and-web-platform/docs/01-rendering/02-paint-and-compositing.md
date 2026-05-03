# Paint and Compositing

> Paint converts layout information into pixels, and Compositing uses the GPU to blend layers together to produce the final image. Understanding layer promotion, will-change, GPU acceleration, and compositing strategies is essential for achieving smooth UIs. This guide systematically explains the Paint and Compositing phases that form the latter half of the browser rendering pipeline — from their internal workings to practical performance optimization techniques.

## Prerequisites

To get the most out of this guide, it is recommended to have prior knowledge of the following topics.

- **Overview of the Rendering Pipeline** — A prerequisite understanding of the overall flow by which a browser parses HTML/CSS and displays it on screen. A basic knowledge of DOM construction, CSSOM construction, style calculation, and layout calculation will make the role of Paint and Compositing clearer. Reference: [Rendering Pipeline](./00-rendering-pipeline.md)

- **How the CSS Layout Engine Works** — It is useful to understand the basic operation of the layout engine in order to see how element position and size information calculated during the Layout phase is used in the Paint phase. In particular, the concept of Stacking Context is directly linked to understanding layer promotion. Reference: [CSS Layout Engine](./01-css-layout-engine.md)

- **Basic Concepts of GPU Acceleration** — A basic knowledge of how a GPU (Graphics Processing Unit) differs from a CPU and what kinds of tasks it excels at, as well as the difference between GPU memory (VRAM) and CPU memory, makes it easier to understand the cost and benefits of layer promotion.

## What You Will Learn in This Chapter

- [ ] Explain the difference in roles between Paint and Composite
- [ ] Understand the position of Paint/Composite within the overall browser rendering pipeline
- [ ] Grasp the conditions, benefits, and costs of layer promotion
- [ ] Understand the mechanism and scope of GPU acceleration
- [ ] Learn the correct way to use the `will-change` property
- [ ] Practice optimization using `contain` / `content-visibility`
- [ ] Profile paint and compositing using DevTools
- [ ] Recognize and avoid anti-patterns

---

## 1. Position in the Rendering Pipeline

Paint and Compositing are located in the latter half of the browser's rendering pipeline. While the first half (DOM construction, CSSOM construction, style calculation, layout) determines "what to place where," the latter half — Paint and Compositing — is responsible for "how to convert to pixels and display on screen."

```
Overview of the Rendering Pipeline
===========================================================================

 ┌──────────────┐   ┌──────────┐   ┌────────────┐   ┌──────────┐
 │     DOM      │──▶│  CSSOM   │──▶│   Style    │──▶│  Layout  │
 │ Construction │   │ Construc-│   │ Calculation│   │ (Reflow) │
 └──────────────┘   └──────────┘   └────────────┘   └────┬─────┘
                                                          │
                                                          ▼
 ┌───────────────────────────────────────────────────────────────┐
 │                 Paint Phase                                    │
 │  ┌─────────────────┐   ┌──────────────────────┐              │
 │  │ Paint Records   │──▶│ Rasterization        │              │
 │  │ (draw cmd list) │   │ (pixel conversion)   │              │
 │  └─────────────────┘   └──────────┬───────────┘              │
 └───────────────────────────────────┼───────────────────────────┘
                                     │
                                     ▼
 ┌───────────────────────────────────────────────────────────────┐
 │              Compositing Phase                                 │
 │  ┌─────────────────┐   ┌──────────────────────┐              │
 │  │ Layer Composit- │──▶│ GPU Texture          │              │
 │  │ ing (Draw Quads)│   │ Screen Display       │              │
 │  └─────────────────┘   └──────────────────────┘              │
 └───────────────────────────────────────────────────────────────┘

===========================================================================
```

### 1.1 Cost Incurred by Each Phase

The range of rendering processing triggered by a CSS property change varies greatly depending on which property is changed. The following shows the relationship between property changes and the phases they trigger.

| Changed Property | Layout | Paint | Composite | Example |
|:---|:---:|:---:|:---:|:---|
| `width`, `height`, `margin`, `padding` | Yes | Yes | Yes | Changing box size |
| `top`, `left` (positioned) | Yes | Yes | Yes | Changing position |
| `color`, `background-color` | No | Yes | Yes | Changing color |
| `box-shadow`, `border-radius` | No | Yes | Yes | Changing decorations |
| `transform` | No | No | Yes | Move, rotate, scale |
| `opacity` | No | No | Yes | Changing transparency |
| `filter` (GPU-supported) | No | No | Yes | Blur, color adjustment |

As this table makes clear, changes to `transform` and `opacity` skip both Layout and Paint and complete in Composite alone. This is called "Compositor-only properties" and is why they form the foundation of high-performance animations.

---

## 2. Paint Details

### 2.1 Generating Paint Records

The first step of the Paint phase is to traverse the layout tree and generate Paint Records (a list of drawing commands). Paint Records hold the information needed to draw each element as an ordered list.

```
Paint Records Structure (Conceptual Diagram)
===========================================================================

  PaintRecord {
    type: "drawRect"
    rect: { x: 0, y: 0, width: 300, height: 200 }
    color: "#ffffff"
    zOrder: 0
  }

  PaintRecord {
    type: "drawText"
    text: "Hello, World!"
    position: { x: 16, y: 32 }
    font: { family: "Arial", size: "16px", weight: "normal" }
    color: "#333333"
    zOrder: 1
  }

  PaintRecord {
    type: "drawBorder"
    rect: { x: 0, y: 0, width: 300, height: 200 }
    border: { width: "1px", style: "solid", color: "#cccccc" }
    zOrder: 2
  }

  PaintRecord {
    type: "drawImage"
    src: "photo.jpg"
    rect: { x: 0, y: 200, width: 300, height: 200 }
    zOrder: 3
  }

===========================================================================

  Drawing order (follows Stacking Context):
  1. Background and border of the root element
  2. Child elements with negative z-index
  3. In-flow block-level elements
  4. Float elements
  5. In-flow inline elements
  6. Positioned elements with z-index: 0
  7. Child elements with positive z-index
```

### 2.2 Rasterization

Once Paint Records are generated, rasterization occurs next. Rasterization is the process of converting vector-based drawing commands into actual pixel data (bitmaps).

#### Tile-Based Rasterization

Modern browsers do not rasterize the entire page at once; instead, they divide the screen into tiles (typically 256x256 pixels) and rasterize them.

```
Priority Order of Tile-Based Rasterization
===========================================================================

  Viewport (the area visible on screen)
  ┌─────────────────────────────────────────┐
  │                                         │
  │  ┌──────┬──────┬──────┬──────┐         │
  │  │ P:1  │ P:1  │ P:1  │ P:1  │  ← Rasterized with highest priority
  │  ├──────┼──────┼──────┼──────┤         │
  │  │ P:1  │ P:1  │ P:1  │ P:1  │  ← Rasterized with highest priority
  │  ├──────┼──────┼──────┼──────┤         │
  │  │ P:1  │ P:1  │ P:1  │ P:1  │  ← Rasterized with highest priority
  │  └──────┴──────┴──────┴──────┘         │
  │                                         │
  └─────────────────────────────────────────┘
  ┌──────┬──────┬──────┬──────┐
  │ P:2  │ P:2  │ P:2  │ P:2  │  ← Near viewport (next priority)
  ├──────┼──────┼──────┼──────┤
  │ P:3  │ P:3  │ P:3  │ P:3  │  ← Area slightly further away
  ├──────┼──────┼──────┼──────┤
  │ P:4  │ P:4  │ P:4  │ P:4  │  ← Even further away
  ├──────┼──────┼──────┼──────┤
  │ P:5  │ P:5  │ P:5  │ P:5  │  ← Rasterized last
  └──────┴──────┴──────┴──────┘

  P:N = Priority. The smaller N is, the higher the priority.
  → Pre-rasterization is also performed by predicting the user's scroll direction.

===========================================================================
```

#### Parallel Processing by Raster Threads

Rasterization runs on raster threads independent from the main thread. In Chromium, multiple raster threads process tiles in parallel.

```javascript
// Code conceptually illustrating the behavior of raster threads
// (pseudo-code for the actual browser internals)
// ※ This is an educational pseudo-implementation and differs from the actual browser implementation

class RasterThread {
  constructor(id, gpuContext) {
    this.id = id;
    this.gpuContext = gpuContext;
    this.taskQueue = [];
  }

  processTile(tile) {
    // Get Paint Records within the tile
    const records = tile.getPaintRecords();

    // GPU rasterization: use the GPU context
    if (this.gpuContext) {
      const texture = this.gpuContext.createTexture(
        tile.width,
        tile.height
      );
      for (const record of records) {
        this.gpuContext.drawToTexture(texture, record);
      }
      return texture;
    }

    // Software rasterization: generate bitmap on CPU
    const bitmap = new Bitmap(tile.width, tile.height);
    for (const record of records) {
      bitmap.draw(record);
    }
    return bitmap;
  }
}

// In Chromium, typically 4 raster threads run in parallel.
// On mobile devices, this is often limited to 2.
```

### 2.3 GPU Rasterization vs. Software Rasterization

There are two methods of rasterization.

| Item | Software Rasterization | GPU Rasterization |
|:---|:---|:---|
| Execution Location | CPU (raster threads) | GPU |
| Bitmap Generation | CPU generates pixel data | GPU shader generates texture |
| VRAM Transfer | Copy from CPU → GPU required | Generated directly on GPU (no transfer needed) |
| Suited For | Simple pages, non-GPU-capable devices | Complex rendering, high-DPI displays |
| Chromium Default | Previously the default | Current default (Android / Desktop) |
| Text Rendering Quality | High quality (uses CPU font renderer) | Slightly inferior in some cases (improving) |

In Chromium, you can check the current rasterization method at the `chrome://gpu` page. If it shows `Rasterization: Hardware accelerated`, GPU rasterization is enabled.

### 2.4 Conditions That Trigger Repaint

The following operations trigger a Repaint. A Repaint does not involve a layout recalculation, but it does require pixel regeneration, incurring a performance cost.

```css
/* Examples of properties that trigger Repaint */
.element {
  /* Color-related */
  color: red;              /* Changing text color */
  background-color: blue;  /* Changing background color */
  border-color: green;     /* Changing border color */

  /* Visual effects */
  box-shadow: 0 2px 8px rgba(0,0,0,0.2); /* Changing shadow */
  text-decoration: underline;             /* Changing text decoration */
  outline: 2px solid red;                 /* Changing outline */
  background-image: url("new.jpg");       /* Changing background image */

  /* Changing visibility (unlike display:none, does not affect layout) */
  visibility: hidden;
}
```

---

## 3. Compositing Details

### 3.1 Basic Concept of Compositing

Compositing is the process of overlaying multiple layers (composited layers) on the GPU to generate the final screen display. Each layer is held as an independent texture in GPU memory (VRAM) and is blended in z-order during compositing.

```
Overlaying Composited Layers (Conceptual Diagram)
===========================================================================

  Layers in GPU memory:

  Layer 3 (z-index: 100) --- Popup menu
  ┌──────────┐
  │ Menu     │
  │ Item 1   │
  │ Item 2   │
  └──────────┘
                    ↓ Composite
  Layer 2 (z-index: 10) --- Header (position: fixed)
  ┌──────────────────────────────────────┐
  │ Header    [Logo]    [Nav]    [User]  │
  └──────────────────────────────────────┘
                    ↓ Composite
  Layer 1 (z-index: 1) --- Content (during transform animation)
  ┌──────────────────────────────────────┐
  │ Main Content Area                    │
  │                                      │
  │  ┌─────────┐  ┌─────────┐          │
  │  │ Card 1  │  │ Card 2  │          │
  │  └─────────┘  └─────────┘          │
  └──────────────────────────────────────┘
                    ↓ Composite
  Layer 0 (root) --- Root layer
  ┌──────────────────────────────────────┐
  │ body background (#f5f5f5)            │
  │                                      │
  └──────────────────────────────────────┘

  Final screen = GPU composites Layer 0 + Layer 1 + Layer 2 + Layer 3
  → Overlays each layer's texture using alpha blending

===========================================================================
```

### 3.2 Role of the Compositor Thread

Compositing runs on a Compositor Thread separate from the main thread. This is a critically important design decision that provides the following benefits.

```
Division of Roles Between Threads
===========================================================================

  Main Thread                       Compositor Thread
  ┌──────────────────────┐         ┌──────────────────────┐
  │ · JavaScript exec    │         │ · Layer compositing   │
  │ · DOM manipulation   │         │ · Tile management     │
  │ · Style calculation  │         │ · Scroll processing   │
  │ · Layout calculation │         │ · transform animation │
  │ · Paint Records gen. │         │ · opacity animation   │
  │ · Event handlers     │         │ · Draw Quads gen.     │
  └──────────┬───────────┘         └──────────┬───────────┘
             │                                 │
             │    Commit (synchronization pt.)  │
             │ ────────────────────────────▶   │
             │                                 │
             │                                 ▼
             │                     ┌──────────────────────┐
             │                     │ Raster Threads       │
             │                     │ (pixel-ize tiles)    │
             │                     └──────────┬───────────┘
             │                                 │
             │                                 ▼
             │                     ┌──────────────────────┐
             │                     │ GPU Process          │
             │                     │ (texture compositing)│
             │                     │ (screen display)     │
             │                     └──────────────────────┘

===========================================================================

  Even when the main thread is busy:
  → Scrolling is handled by the Compositor Thread (outside non-fast scrollable regions)
  → transform/opacity animations continue on the Compositor Thread
  → Users are less likely to experience "jank"
```

### 3.3 Draw Quads and the Display Compositor

When the Compositor Thread composites layers, it generates Draw Quads. Draw Quads are the final drawing commands to the GPU, specifying where and at what size each tile's texture should be rendered.

```javascript
// Conceptual structure of a Draw Quad (educational pseudo-code)
const drawQuad = {
  type: "TileDrawQuad",
  // Tile texture (bitmap in GPU memory)
  texture: gpuTextureHandle,
  // Destination rectangle (in screen coordinates)
  destRect: { x: 0, y: 0, width: 256, height: 256 },
  // Reference area within the texture (UV coordinates)
  texCoordRect: { u0: 0.0, v0: 0.0, u1: 1.0, v1: 1.0 },
  // Transform matrix (applying transform)
  transformMatrix: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    100, 50, 0, 1  // translateX(100px) translateY(50px)
  ],
  // Transparency
  opacity: 0.9,
  // Blend mode
  blendMode: "normal"
};
```

---

## 4. Layer Promotion Details

### 4.1 Explicit Layer Promotion

Applying specific CSS properties promotes an element to an independent composited layer. This is called explicit layer promotion.

```css
/* Method 1: will-change property (recommended) */
.promoted-element {
  will-change: transform;
}

/* Method 2: 3D transform (legacy hack) */
.promoted-element-legacy {
  transform: translateZ(0);
  /* or */
  transform: translate3d(0, 0, 0);
}

/* Method 3: Elements being CSS animated (automatic) */
.animated-element {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}

/* Method 4: position: fixed (auto-promoted in most browsers) */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
}

/* Method 5: Specific HTML elements (auto-promoted) */
/* <video>, <canvas>, <iframe> are automatically promoted to layers */
```

### 4.2 Implicit Layer Promotion (Implicit Compositing)

Implicit layer promotion is an unintentional layer promotion that often causes performance issues.

```
Mechanism of Implicit Layer Promotion
===========================================================================

  Case: Element A is already promoted, Element B overlaps A

  Normal drawing order:
  ┌──────────────────────────┐
  │ Layer 0 (root)           │
  │  ┌────────────────────┐  │
  │  │ Element A (z:1)    │  │ ← Already promoted (own layer)
  │  │ transform: ...     │  │
  │  └────────────────────┘  │
  │       ┌──────────────┐   │
  │       │ Element B    │   │ ← Overlapping A
  │       │ (z:2)        │   │
  │       └──────────────┘   │
  └──────────────────────────┘

  Problem:
  → A is held as a GPU texture in its own layer
  → B needs to be drawn on top of A
  → If B stays in the root layer, it cannot be drawn correctly on top of A's texture
  → Therefore B also needs to be promoted to its own layer (implicit promotion)

  Result:
  Layer 0 (root)  ← Root layer
  Layer 1 (A)     ← Explicitly promoted
  Layer 2 (B)     ← Implicitly promoted (increases memory consumption)

===========================================================================
```

### 4.3 Layer Explosion

When implicit layer promotions cascade, a layer explosion occurs. This is a serious problem where a large number of layers are created and GPU memory is exhausted.

```html
<!-- Anti-pattern: code that causes a layer explosion -->
<style>
  .base {
    position: relative;
    z-index: 1;
    /* When this element is promoted, all elements overlapping it are implicitly promoted */
    will-change: transform;
  }

  .item {
    position: relative;
    z-index: 2; /* Higher than base → subject to implicit promotion */
    width: 200px;
    height: 100px;
    margin: 4px;
  }
</style>

<!-- All 1000 .items are implicitly promoted -->
<!-- Each 200x100x4 = 80KB → total ~80MB GPU memory consumption -->
<div class="base">Base Element</div>
<div class="item">Item 1</div>
<div class="item">Item 2</div>
<!-- ... 998 more ... -->
<div class="item">Item 1000</div>
```

```css
/* Fix: set z-index appropriately to prevent layer explosion */
.base {
  position: relative;
  z-index: 2;         /* Set higher than item */
  will-change: transform;
}

.item {
  position: relative;
  z-index: 1;         /* Lower than base → no implicit promotion */
  width: 200px;
  height: 100px;
  margin: 4px;
}
```

### 4.4 Cost of Layer Promotion

Layer promotion comes with a memory cost. Because each layer is held as a texture in GPU memory, the more layers there are and the larger they are, the more memory is consumed.

```
Layer Memory Consumption Calculation
===========================================================================

  Basic formula:
  Memory = width(px) x height(px) x 4(bytes/pixel, RGBA) x devicePixelRatio^2

  Example 1: Standard card element (regular display)
  Width: 300px, Height: 200px, DPR: 1
  Memory = 300 x 200 x 4 x 1 = 240,000 bytes ≈ 234 KB

  Example 2: Same card element (Retina display, DPR: 2)
  Memory = 300 x 200 x 4 x 4 = 960,000 bytes ≈ 937 KB
  → 4x memory on DPR 2 devices

  Example 3: Full-screen layer (1920x1080, DPR: 1)
  Memory = 1920 x 1080 x 4 = 8,294,400 bytes ≈ 7.9 MB

  Example 4: Full-screen layer (1920x1080, DPR: 2)
  Memory = 3840 x 2160 x 4 = 33,177,600 bytes ≈ 31.6 MB

  GPU memory limits on mobile devices (reference values):
  Low-end:    128~256 MB
  Mid-range:  512 MB~1 GB
  High-end:   2~4 GB

===========================================================================
```

---

## 5. How GPU Acceleration Works

### 5.1 What the GPU Excels At

A GPU (Graphics Processing Unit) is a processor specialized for large-scale parallel computation. The following processes can be executed quickly on a GPU.

- **Texture Compositing**: Overlaying multiple bitmaps
- **Matrix Transformation**: Applying transforms (move, rotate, scale, skew)
- **Transparency Processing**: Changing opacity and alpha blending
- **Filter Processing**: CSS filters such as blur, brightness, and contrast
- **3D Transformations**: 3D transforms such as perspective, rotateX/Y/Z

### 5.2 Compositor-Only Properties

The following properties can be handled entirely by the Compositor Thread and GPU without going back to the main thread. These are called "Compositor-Only properties."

```css
/* Compositor-Only properties (for high-performance animations) */

/* 1. transform - all transformations */
.move    { transform: translateX(100px); }
.rotate  { transform: rotate(45deg); }
.scale   { transform: scale(1.5); }
.skew    { transform: skewX(10deg); }
.matrix  { transform: matrix(1, 0, 0, 1, 100, 50); }
.combine { transform: translate(100px, 50px) rotate(45deg) scale(1.2); }

/* 2. opacity - transparency */
.fade    { opacity: 0.5; }

/* 3. filter - some filters (GPU-capable browsers) */
.blur    { filter: blur(4px); }

/* 4. backdrop-filter - background filter (GPU-capable browsers) */
.glass   { backdrop-filter: blur(10px); }
```

```javascript
// Comparison code showing performance differences

// --- Bad example: left/top animation (Layout + Paint + Composite) ---
function animateBad(element) {
  let position = 0;
  function frame() {
    position += 2;
    element.style.left = position + "px"; // Triggers Layout
    if (position < 300) {
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);
}

// --- Good example: transform animation (Composite only) ---
function animateGood(element) {
  let position = 0;
  function frame() {
    position += 2;
    element.style.transform = `translateX(${position}px)`; // Composite only
    if (position < 300) {
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);
}

// --- Best example: CSS Animation / Web Animations API ---
function animateBest(element) {
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(300px)" }
    ],
    {
      duration: 500,
      easing: "ease-out",
      fill: "forwards"
    }
  );
  // Web Animations API is easier for the browser to optimize
  // Runs completely off the main thread on the Compositor Thread
}
```

### 5.3 Verifying GPU Acceleration is Active

```javascript
// How to check using the Chrome DevTools Console

// 1. Check GPU info
// Visit chrome://gpu and confirm:
// - Canvas: Hardware accelerated
// - Compositing: Hardware accelerated
// - Rasterization: Hardware accelerated
// - Video Decode: Hardware accelerated

// 2. Check element layer information (DevTools Layers panel)
// DevTools > More tools > Layers
// → Check promotion reason, memory size, and draw count for each layer

// 3. Frame analysis with Performance panel
// DevTools > Performance > Record
// → Check Composite time for each frame
// → Confirm it stays within 16.67ms (60fps)
```

---

## 6. Deep Dive into the will-change Property

### 6.1 Purpose and Mechanism of will-change

`will-change` is a property to notify the browser in advance that "this property on this element will change in the near future." When the browser receives this hint, it prepares optimizations in advance (layer promotion, securing GPU textures, etc.).

```css
/* Basic syntax of will-change */
.element {
  will-change: auto;          /* Default value. No hint. */
  will-change: transform;     /* Announces transform changes */
  will-change: opacity;       /* Announces opacity changes */
  will-change: transform, opacity; /* Announces multiple properties */
  will-change: scroll-position;    /* Announces scroll position changes */
  will-change: contents;      /* Announces changes to element content */
}
```

### 6.2 Internal Operations Triggered by will-change

When `will-change: transform` is set, the following processes are immediately executed inside the browser.

```
Browser Internal Behavior When will-change Is Set
===========================================================================

  The moment will-change: transform is set:

  1. A new Stacking Context is created
     → A new stacking context is created even with z-index: auto
     → The reference point for child element z-index values changes

  2. A new Containing Block is created (for fixed-position children)
     → Children with position: fixed may use the will-change element
       as their reference instead of the viewport

  3. A composited layer is created
     → GPU texture is reserved
     → VRAM is consumed

  4. A new Offset Parent is created
     → offsetParent may change

  Notable side effects:
  ┌────────────────────────────────────────────────────┐
  │ Setting will-change: transform on a parent...      │
  │                                                    │
  │ .parent { will-change: transform; }                │
  │                                                    │
  │   .child {                                         │
  │     position: fixed;                               │
  │     top: 0;                                        │
  │     /* Positioned relative to .parent, not         │
  │        the viewport! */                            │
  │   }                                                │
  └────────────────────────────────────────────────────┘

===========================================================================
```

### 6.3 Best Practices for will-change

```javascript
// Pattern 1: Dynamically set and unset based on events (recommended)
// Prepare animation on hover
const card = document.querySelector(".card");

card.addEventListener("mouseenter", () => {
  // Prepare for promotion when the mouse enters
  card.style.willChange = "transform, box-shadow";
});

card.addEventListener("mouseleave", () => {
  // Do not unset yet when the mouse leaves
  // (Unset after transition completes)
});

card.addEventListener("transitionend", () => {
  // Unset after the transition completes
  card.style.willChange = "auto";
});
```

```javascript
// Pattern 2: For scroll-linked animations
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Prepare for promotion just before entering the viewport
        entry.target.style.willChange = "transform, opacity";
      } else {
        // Unset after leaving the viewport
        entry.target.style.willChange = "auto";
      }
    });
  },
  {
    // Detect 200px before the viewport's top and bottom edges
    rootMargin: "200px 0px"
  }
);

document.querySelectorAll(".animate-on-scroll").forEach((el) => {
  observer.observe(el);
});
```

```css
/* Pattern 3: Elements that animate continuously (CSS only) */
/* Limit to elements that are always animating, such as loading spinners */
.spinner {
  will-change: transform;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Pattern 4: In-page navigation (hint on parent element) */
/* When child elements animate on hover, prepare on parent hover */
.card-grid:hover .card {
  will-change: transform;
}
```

### 6.4 will-change Anti-Patterns

```css
/* ===== Anti-pattern 1: Applying to all elements ===== */
/* Consumes large amounts of GPU memory and actually degrades performance */
* {
  will-change: transform;  /* Never do this */
}

/* What happens:
   → All elements are promoted to composited layers
   → GPU memory is exhausted (fatal, especially on mobile)
   → Overhead of layer compositing increases
   → Performance actually degrades
*/

/* ===== Anti-pattern 2: Unnecessary persistent setting ===== */
.button {
  will-change: transform, opacity, color, background-color, box-shadow;
  /* Problem: lists properties that may never be used
     → Wastes resources */
}

/* Fix */
.button {
  transition: transform 0.2s, opacity 0.2s;
  /* Set and unset will-change dynamically with JavaScript */
}

/* ===== Anti-pattern 3: Casual use in CSS ===== */
.modal {
  will-change: transform;
  /* Modal only animates when opening/closing
     → Always-on setting wastes resources */
}

/* Fix: Set dynamically just before the modal opens */
.modal.is-opening {
  will-change: transform, opacity;
}
```

---

## 7. Optimization with the CSS contain Property

### 7.1 Overview of contain

The CSS `contain` property gives the browser a hint about the rendering independence of an element. This allows the browser to guarantee that changes inside the element do not affect the outside, creating more optimization opportunities.

```css
/* contain values and their effects */

/* layout: Contain layout calculations within the element */
.widget {
  contain: layout;
  /* Effects:
     → Layout changes inside this element do not propagate to parent or sibling elements
     → Float and clear effects do not leak to the outside
     → The browser can skip layout recalculations outside the element */
}

/* paint: Contain drawing within the element's boundary */
.sidebar {
  contain: paint;
  /* Effects:
     → Descendants of this element are not drawn outside the element boundary
     → Similar effect to overflow: hidden, but functions as a browser optimization hint
     → If the element is outside the viewport, Paint of descendants can be skipped */
}

/* size: Prevent the element's size from depending on child content */
.fixed-size-container {
  contain: size;
  width: 300px;
  height: 200px;
  /* Effects:
     → Changes in child elements do not affect this element's size
     → Note: An explicit size must be specified */
}

/* style: Limit the scope of counters and quotes */
.isolated {
  contain: style;
  /* Effects:
     → CSS counter values do not leak to the outside
     → The state of quotes does not affect the outside */
}

/* content: Shorthand for layout + paint */
.card {
  contain: content;
}

/* strict: Shorthand for size + layout + paint (most powerful) */
.tile {
  contain: strict;
  width: 200px;
  height: 150px;
}
```

### 7.2 When to Use contain

```html
<!-- Practical example: Using contain in a card layout -->
<style>
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    padding: 16px;
  }

  .card {
    contain: content;
    /* Guarantees that changes inside the card do not affect other cards
       → Skips re-layout of other cards when DOM changes inside a card */
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .card__image {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .card__body {
    padding: 16px;
  }

  .card__title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .card__description {
    font-size: 0.875rem;
    color: #666;
    line-height: 1.5;
  }
</style>

<div class="card-grid">
  <article class="card">
    <img class="card__image" src="photo1.jpg" alt="Card 1" />
    <div class="card__body">
      <h3 class="card__title">Card Title 1</h3>
      <p class="card__description">Description text...</p>
    </div>
  </article>
  <!-- Dozens to hundreds of cards -->
</div>
```

### 7.3 Combining contain and will-change

```css
/* Optimization combining contain and will-change */
.animated-widget {
  contain: layout paint;     /* Contain layout and paint */
  /* Set will-change dynamically with JavaScript */
}

/* Optimization pattern combined with Intersection Observer */
.lazy-section {
  contain: content;
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* Specify estimated size */
}
```

---

## 8. Deferred Rendering with content-visibility

### 8.1 Overview of content-visibility

`content-visibility` is a property that can dramatically improve initial page load performance by deferring rendering of elements outside the viewport.

```css
/* The 3 values of content-visibility */

/* visible: Default value. Renders normally. */
.normal {
  content-visibility: visible;
}

/* hidden: Completely hides the element's content (similar to display: none)*/
/* However, the element's own box is maintained */
.hidden-content {
  content-visibility: hidden;
  /* Use case: inactive tab panels, etc.
     → Unlike display: none, re-display rendering cost is lower
     → Because the rendering state is cached */
}

/* auto: Skips rendering when outside the viewport */
.lazy-render {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
  /* For elements outside the viewport:
     → Skips all of Style, Layout, and Paint
     → Rendering starts automatically as the user scrolls near
     → Specify estimated size with contain-intrinsic-size for scrollbar stability */
}
```

### 8.2 Measuring the Effect of content-visibility: auto

```
Before/After Comparison of content-visibility: auto (for long pages)
===========================================================================

  Page structure: 50 sections, multiple elements per section

  ┌─ Viewport ──────────────────────┐
  │  Section 1  ← Normal rendering  │
  │  Section 2  ← Normal rendering  │
  │  Section 3  ← Normal rendering  │
  └────────────────────────────────┘
     Section 4  ← Skipped with content-visibility: auto
     Section 5  ← Skipped with content-visibility: auto
     ...
     Section 50 ← Skipped with content-visibility: auto

  Performance effects (reference values):
  ┌────────────────────┬───────────┬──────────────┐
  │ Metric             │ Before    │ After        │
  ├────────────────────┼───────────┼──────────────┤
  │ Initial rendering  │ 800ms     │ 120ms        │
  │ DOM nodes processed│ 5000      │ 300          │
  │ Layout calculation │ 200ms     │ 30ms         │
  │ Paint processing   │ 150ms     │ 25ms         │
  │ Memory consumption │ 50MB      │ 15MB         │
  └────────────────────┴───────────┴──────────────┘

  ※ Values vary greatly depending on page structure and device.

===========================================================================
```

### 8.3 Implementation Example of content-visibility

```html
<!-- Implementation example: Long document page -->
<style>
  .doc-section {
    content-visibility: auto;
    contain-intrinsic-size: auto 500px;
    /* With the auto keyword, the browser remembers the actual size
       after it has been rendered once */
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  /* Tab switching using content-visibility: hidden */
  .tab-panel {
    content-visibility: hidden;
    /* Since the rendering state is cached,
       re-rendering on tab switch is fast */
  }

  .tab-panel.is-active {
    content-visibility: visible;
  }
</style>

<article>
  <section class="doc-section">
    <h2>Section 1: Introduction</h2>
    <p>This section is visible in the viewport...</p>
  </section>

  <section class="doc-section">
    <h2>Section 2: Getting Started</h2>
    <p>This section may be below the fold...</p>
  </section>

  <!-- Many more sections follow -->
</article>
```

```javascript
// Linking content-visibility with IntersectionObserver
// For cases where finer control is needed

class LazyRenderController {
  constructor(selector, options = {}) {
    this.elements = document.querySelectorAll(selector);
    this.rendered = new WeakSet();

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        rootMargin: options.rootMargin || "200px 0px",
        threshold: options.threshold || 0
      }
    );

    this.init();
  }

  init() {
    this.elements.forEach((el) => {
      // Initially use content-visibility: auto
      el.style.contentVisibility = "auto";
      el.style.containIntrinsicSize = "auto 300px";
      this.observer.observe(el);
    });
  }

  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !this.rendered.has(entry.target)) {
        // Switch to normal rendering once displayed
        this.rendered.add(entry.target);
        // Trigger loading of dynamic content, etc.
        this.loadContent(entry.target);
      }
    });
  }

  loadContent(element) {
    const lazyContent = element.dataset.lazySrc;
    if (lazyContent) {
      // Dynamically load content
      fetch(lazyContent)
        .then((res) => res.text())
        .then((html) => {
          element.innerHTML = html;
        });
    }
  }

  destroy() {
    this.observer.disconnect();
  }
}

// Usage example
const controller = new LazyRenderController(".doc-section", {
  rootMargin: "300px 0px"
});
```

---

## 9. Analyzing Paint and Compositing with DevTools

### 9.1 Chrome DevTools: Layers Panel

The Layers panel is a tool that visualizes all composited layers on the page in a 3D view.

```
How to Use the Chrome DevTools Layers Panel
===========================================================================

  How to access:
  1. Open DevTools (F12 or Cmd+Option+I)
  2. Top right "⋮" → "More tools" → "Layers"

  Information displayed:
  ┌─────────────────────────────────────────────────────┐
  │ Layers Panel                                        │
  │                                                     │
  │ ┌─────────────────────┐ ┌───────────────────────┐  │
  │ │                     │ │ Details               │  │
  │ │   3D View           │ │                       │  │
  │ │                     │ │ Size: 1920 x 1080     │  │
  │ │   ┌─────┐          │ │ Memory: 7.9 MB        │  │
  │ │   │ L3  │          │ │                       │  │
  │ │   └─────┘          │ │ Compositing Reasons:  │  │
  │ │  ┌──────────────┐  │ │ - Has a will-change:  │  │
  │ │  │ Layer 2      │  │ │   transform property  │  │
  │ │  └──────────────┘  │ │                       │  │
  │ │ ┌────────────────┐ │ │ Paint Count: 3        │  │
  │ │ │ Layer 1        │ │ │                       │  │
  │ │ └────────────────┘ │ │ Slow scroll regions:  │  │
  │ │ ┌────────────────┐ │ │ none                  │  │
  │ │ │ Root Layer     │ │ │                       │  │
  │ │ └────────────────┘ │ └───────────────────────┘  │
  │ └─────────────────────┘                            │
  └─────────────────────────────────────────────────────┘

  Points to check:
  ① Is the number of layers reasonable (ideally dozens or fewer)?
  ② Is the memory consumption of each layer appropriate?
  ③ Are there any unnecessary implicit promotions (check Compositing Reasons)?
  ④ Is Paint Count abnormally high?

===========================================================================
```

### 9.2 Chrome DevTools: Rendering Tab

```
Features in the Rendering Tab
===========================================================================

  How to access:
  DevTools > "⋮" > More tools > Rendering

  ┌─────────────────────────────────────────────────────┐
  │ Rendering                                           │
  │                                                     │
  │ [x] Paint flashing                                  │
  │     → Highlights repainted areas in green           │
  │     → Useful for finding unnecessary repaints       │
  │                                                     │
  │ [x] Layout shift regions                            │
  │     → Displays layout-shifted areas in blue         │
  │     → Useful for identifying CLS causes             │
  │                                                     │
  │ [x] Layer borders                                   │
  │     → Displays layer boundaries in orange lines     │
  │     → Displays tile boundaries in light-blue lines  │
  │     → Intuitively check layer structure             │
  │                                                     │
  │ [x] Frame Rendering Stats                           │
  │     → Displays FPS meter and GPU memory usage       │
  │     → Real-time frame rate monitoring               │
  │                                                     │
  │ [ ] Scrolling performance issues                    │
  │     → Displays areas affecting scroll performance   │
  │     → Visualize impact of touch/wheel event listeners│
  │                                                     │
  │ [ ] Core Web Vitals                                 │
  │     → Displays LCP, FID, CLS in real time           │
  └─────────────────────────────────────────────────────┘

===========================================================================
```

### 9.3 Frame Analysis in the Performance Panel

```javascript
// How to read the Performance panel (conceptual explanation)

/*
  Structure of a Performance Recording:

  ┌──────────────────────────────────────────────────────┐
  │ Timeline                                             │
  │ ├── Frames (timing of each frame)                    │
  │ ├── Main (activity on the main thread)               │
  │ │   ├── JavaScript execution                         │
  │ │   ├── Recalculate Style                           │
  │ │   ├── Layout                                       │
  │ │   ├── Update Layer Tree                           │
  │ │   ├── Paint                                        │
  │ │   └── Composite Layers                            │
  │ ├── Compositor (compositor thread)                   │
  │ ├── Raster (raster threads)                          │
  │ └── GPU (GPU process)                               │
  └──────────────────────────────────────────────────────┘

  Steps for frame analysis:
  1. Press "Record" and perform actions
  2. Check the length of each frame in the Frames section
     → Look for frames exceeding 16.67ms
  3. Select a long frame and check the Main section
     → Identify what is consuming time
  4. Check the time for Paint and Composite Layers

  Ideal frame composition:
  16.67ms (60fps target) breakdown:
  ┌────────────────────────────────────────────┐
  │ JS     │ Style  │ Layout │ Paint │ Comp.  │
  │ 4ms    │ 1ms    │ 2ms    │ 1ms   │ 0.5ms  │
  │ ────── │ ────── │ ────── │ ───── │ ────── │
  │ Remaining 8.17ms is idle time              │
  └────────────────────────────────────────────┘
*/
```

---

## 10. Design Patterns for Compositing Strategies

### 10.1 Optimizing Scroll-Linked Animations

```javascript
// Optimized implementation of scroll-linked parallax
class OptimizedParallax {
  constructor(container) {
    this.container = container;
    this.layers = container.querySelectorAll("[data-parallax-speed]");
    this.ticking = false;

    this.init();
  }

  init() {
    // Pre-set will-change on each layer (since they always scroll-link)
    this.layers.forEach((layer) => {
      layer.style.willChange = "transform";
    });

    // Register scroll event with passive: true
    // → Does not block scroll processing on the Compositor Thread
    window.addEventListener("scroll", () => this.onScroll(), {
      passive: true
    });
  }

  onScroll() {
    if (!this.ticking) {
      // Batch process in the next frame using requestAnimationFrame
      requestAnimationFrame(() => {
        this.updatePositions();
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  updatePositions() {
    const scrollY = window.scrollY;

    this.layers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.parallaxSpeed);
      // Use transform only (Compositor-Only)
      const offset = scrollY * speed;
      layer.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
  }

  destroy() {
    // Cleanup: unset will-change
    this.layers.forEach((layer) => {
      layer.style.willChange = "auto";
    });
  }
}

// Usage example
// <div class="parallax-container">
//   <div data-parallax-speed="0.5">Slow layer</div>
//   <div data-parallax-speed="0.8">Medium layer</div>
//   <div data-parallax-speed="1.2">Fast layer</div>
// </div>
const parallax = new OptimizedParallax(
  document.querySelector(".parallax-container")
);
```

### 10.2 List Virtualization and Layer Strategy

When displaying large numbers of list items, it is important to combine virtualization (windowing) with a composited layer strategy.

```javascript
// Composited layer optimization for a virtualized scroll list
class VirtualizedList {
  constructor(container, options) {
    this.container = container;
    this.itemHeight = options.itemHeight;
    this.totalItems = options.totalItems;
    this.overscan = options.overscan || 5; // Number of buffer rows
    this.renderItem = options.renderItem;

    // Configure the scroll container
    this.container.style.overflow = "auto";
    this.container.style.position = "relative";
    // Limit the layout impact area with contain
    this.container.style.contain = "strict";

    // Spacer that holds the total height
    this.spacer = document.createElement("div");
    this.spacer.style.height = `${this.totalItems * this.itemHeight}px`;
    this.spacer.style.position = "relative";
    this.container.appendChild(this.spacer);

    // Container holding visible items
    this.viewport = document.createElement("div");
    // Offset position using transform (Compositor-Only)
    this.viewport.style.willChange = "transform";
    this.viewport.style.position = "absolute";
    this.viewport.style.top = "0";
    this.viewport.style.left = "0";
    this.viewport.style.right = "0";
    this.spacer.appendChild(this.viewport);

    this.container.addEventListener("scroll", () => this.onScroll(), {
      passive: true
    });

    this.render();
  }

  onScroll() {
    requestAnimationFrame(() => this.render());
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / this.itemHeight) - this.overscan
    );
    const endIndex = Math.min(
      this.totalItems - 1,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight)
        + this.overscan
    );

    // Offset with transform (avoids Layout)
    const offsetY = startIndex * this.itemHeight;
    this.viewport.style.transform = `translateY(${offsetY}px)`;

    // Only keep needed items in the DOM
    this.viewport.innerHTML = "";
    for (let i = startIndex; i <= endIndex; i++) {
      const item = this.renderItem(i);
      item.style.height = `${this.itemHeight}px`;
      // Apply contain: content to each item
      item.style.contain = "content";
      this.viewport.appendChild(item);
    }
  }
}

// Usage example
const list = new VirtualizedList(
  document.querySelector("#list-container"),
  {
    itemHeight: 60,
    totalItems: 10000,
    renderItem: (index) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.textContent = `Item ${index + 1}`;
      return div;
    }
  }
);
```

---

## FAQ

### Q1. What problems arise when there are too many composite layers?

When composite layers are created in excess, the following serious performance issues occur.

**GPU Memory Exhaustion**: Because each layer is held as a texture in GPU memory, VRAM consumption increases as the number of layers grows. Mobile devices in particular have limited GPU memory, and when layers reach the hundreds, GPU memory is exhausted and the browser undergoes "thrashing," discarding and recreating textures. This causes animations that should be smooth to jank, and in the worst case, the page crashes.

**Increased Compositing Overhead**: The Compositor Thread must generate Draw Quads for all layers every frame and send them to the GPU. The more layers there are, the higher this processing cost becomes, and the Composite process itself becomes a bottleneck. Especially on pages with complex z-index structures, the cost of calculating layer stacking order also increases.

**Delay in Initial Rendering**: When a large number of layers are promoted during page load, the time to transfer each layer's texture to GPU memory increases, delaying the initial display. Especially on slow networks or devices, the time users see a blank screen grows longer, severely harming UX.

**Countermeasures**: Regularly check the number of layers and memory consumption using the DevTools Layers panel, and eliminate unnecessary `will-change` and implicit layer promotions. The ideal number of layers is within a few dozen, and if it exceeds 100, the design should be reconsidered.

### Q2. What is the correct way to use the will-change property? Should it always be set?

`will-change` is a hint to notify the browser in advance of "a property that will change in the near future," and **should not be set permanently**. Setting it persistently wastes memory and can actually degrade performance.

**Correct Usage**:
- **Dynamically set and unset based on events**: Set `will-change` just before user interactions such as hover or focus, and unset it with `will-change: auto` after animation completes (the `transitionend` event).
- **Link with Intersection Observer**: Set `will-change` when an element approaches the viewport, and unset it after it leaves.
- **Only set in CSS for elements that always animate**: Only set in CSS when the timing of setting and unsetting is not clear, such as loading spinners or elements that are always moving.

**Patterns to Avoid**:
- Applying to the `*` selector or all elements
- Always setting on dozens or more elements
- Listing properties that won't be used (e.g., `will-change: transform, opacity, color, background-color`)

For specific code examples, refer to the "6.3 Best Practices for will-change" section.

### Q3. How do you measure paint and composite performance?

To accurately measure browser performance, use a combination of multiple tools in Chrome DevTools.

**Profiling with the Performance Panel**:
1. Open DevTools > Performance tab
2. Press the "Record" button (⚫︎) and perform animations or scrolling
3. Stop recording with "Stop"
4. Check the length of each frame in the Frames section (look for frames exceeding 16.67ms)
5. Check the processing time for Paint and Composite Layers in the Main section
6. Check the parallelism of rasterization in the Raster section

**Real-Time Visualization with the Rendering Tab**:
- Open DevTools > More tools > Rendering
- Enable "Paint flashing" → Repainted areas are highlighted in green
- Enable "Layer borders" → Layer boundaries are displayed in orange lines
- Enable "Frame Rendering Stats" → FPS meter and GPU memory usage are displayed in real time

**Layer Analysis with the Layers Panel**:
- Open DevTools > More tools > Layers
- Visualize all layers in 3D view
- Check the "Compositing Reasons" for each layer to see the promotion reason
- Check memory size and Paint Count

**Measuring Web Vitals**:
Use Lighthouse (DevTools > Lighthouse tab) to measure CLS (Cumulative Layout Shift) and FID (First Input Delay), and quantitatively evaluate the impact of rendering performance on UX.

For detailed instructions, refer to the "9. Analyzing Paint and Compositing with DevTools" section.

---

## Summary

This guide provided a detailed explanation of the Paint and Compositing phases that form the latter half of the browser rendering pipeline. The following table summarizes the key characteristics of each phase.

| Phase | Main Processing | Thread | GPU Use | Performance Impact |
|:---|:---|:---|:---:|:---|
| **Paint** | Convert Layout info to Paint Records → Rasterize to pixels | Main thread (Paint Records gen.)<br>Raster threads (rasterization) | GPU or CPU | Moderate. Repaint occurs on changes to color or background-color. Lighter than Layout changes, but frequent repaints should be avoided. |
| **Compositing** | Overlay multiple composited layers on the GPU to generate the final screen | Compositor Thread | GPU (required) | Low. Changes to transform or opacity complete in Composite only and are very fast. However, excessive layer count increases compositing overhead. |

### Key Points of This Guide

1. **Leverage Compositor-Only Properties**: `transform` and `opacity` are processed by the Compositor Thread and GPU alone, bypassing the main thread. This allows smooth animations even when JavaScript is blocking the main thread. When implementing 60fps animations, always use `transform` and `opacity`, and avoid changing `left`/`top` or `width`/`height`.

2. **Manage Layer Promotion Appropriately**: Layer promotion consumes GPU memory, so unplanned promotion degrades performance. Set and unset `will-change` dynamically based on events and avoid persistent settings. Regularly check the number of layers and memory consumption with the DevTools Layers panel, and prevent layer explosions caused by implicit layer promotions.

3. **Make Profiling with DevTools a Habit**: Performance issues should be measured quantitatively using the Performance panel and the Rendering tab, not by subjective feel. In particular, "Paint flashing" and "Layer borders" are powerful tools for instantly finding unnecessary repaint and layer structure problems. Develop the habit of always enabling these tools during development to find problems early.

---

## Guides to Read Next

After understanding how Paint and Compositing work, it is recommended to learn about performance optimization techniques in practical animation implementations.

- **[Animation Performance](./03-animation-performance.md)** — Explains how to apply the knowledge of Compositor-Only properties, layer promotion, and GPU acceleration learned in this guide to practical animation implementations. Systematically learn technologies that are immediately useful in practice, including how to choose between CSS Animations, CSS Transitions, and the Web Animations API, the optimal use of requestAnimationFrame, the FLIP technique, and improving the performance of scroll-linked animations.

---

## References

The following materials were referenced in writing this guide. If you want a deeper understanding, it is recommended to refer directly to these materials.

- **Chromium Design Documents: GPU Accelerated Compositing** — The official design document for the Chromium project. Explains the internal operation of the Compositor Thread, the detailed mechanism of layer promotion, and the communication method with the GPU process. Must-read if you want to gain knowledge at the browser engine implementation level. [https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome)

- **Inside look at modern web browser (part 3) - What happens in a renderer process?** — A detailed explanatory article about the inside of the renderer process by Google Chrome Developers. The Paint Records generation, rasterization, and Compositing phases are explained with illustrations in an easy-to-understand manner. Tile-based rasterization in particular can be visually understood. [https://developer.chrome.com/blog/inside-browser-part3](https://developer.chrome.com/blog/inside-browser-part3)

- **Stick to Compositor-Only Properties and Manage Layer Count** — A guide on high-performance animations from Web Fundamentals (now web.dev). Practically explains the criteria for selecting Compositor-Only properties, methods for managing layer count, and measurement techniques using DevTools. [https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)

- **CSS Containment Module Level 2 (W3C Specification)** — The official specification of the `contain` property. The precise behavioral definitions of each value (layout, paint, size, style) and their impact on browser optimization are detailed. Should be referenced when a strict understanding at the specification level is needed. [https://www.w3.org/TR/css-contain-2/](https://www.w3.org/TR/css-contain-2/)

- **content-visibility: the new CSS property that boosts your rendering performance** — Practical usage and performance measurement case studies for the `content-visibility` property. The dramatic improvement in initial rendering time for long pages in particular is shown with actual data. [https://web.dev/articles/content-visibility](https://web.dev/articles/content-visibility)
