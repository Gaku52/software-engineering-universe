# Browser Architecture

> Modern browsers operate with a multi-process architecture. Understanding the roles of the browser process, renderer process, GPU process, and how per-tab isolation benefits security and performance is essential. This guide systematically explains browser internals — from the Chromium source code structure and IPC mechanisms to Site Isolation and rendering pipeline optimization techniques.

## What You Will Learn

- [ ] Understand the browser's multi-process architecture
- [ ] Grasp the role and interaction of each process
- [ ] Learn the major components of the browser engine
- [ ] Understand the Chromium source code structure and build system
- [ ] Understand IPC (Inter-Process Communication) and Mojo
- [ ] Understand the Site Isolation security model
- [ ] Learn each stage of the rendering pipeline in detail
- [ ] Acquire design principles for performance optimization

## Prerequisites

- HTTP protocol fundamentals → Reference: HTTP Basics
- Basic understanding of HTML/CSS structure
- Concepts of processes and threads → Reference: OS Fundamentals

---

## 1. Overview of the Multi-Process Architecture

### 1.1 Why Multi-Process?

Browsers in the 1990s ran as a single process. In Internet Explorer 6, if one tab crashed the entire browser went down — a fatal problem. When Google Chrome launched in 2008, its biggest innovation was the adoption of a multi-process architecture.

Three benefits of going multi-process:

1. **Stability**: If one tab crashes, other tabs are not affected
2. **Security**: Sandboxing restricts each tab's access
3. **Performance**: Multi-core CPUs can be leveraged to process tasks in parallel

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Single-Process Model (legacy browsers)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Process                                                   │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────────────┐│  │
│  │  │ Tab 1  │ │ Tab 2  │ │ Tab 3  │ │ Browser UI          ││  │
│  │  │        │ │        │ │        │ │                     ││  │
│  │  │ HTML   │ │ HTML   │ │ HTML   │ │ Address Bar         ││  │
│  │  │ CSS    │ │ CSS    │ │ CSS    │ │ Bookmarks           ││  │
│  │  │ JS     │ │ JS     │ │ JS     │ │ Menu                ││  │
│  │  └────────┘ └────────┘ └────────┘ └─────────────────────┘│  │
│  │                                                            │  │
│  │  Problem: Tab 2 crashes → entire process terminates        │  │
│  │           Tab 1, Tab 3, and Browser UI are all lost        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Multi-Process Model (Chrome / Chromium)                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Browser Process                                          │    │
│  │  UI / Network / Storage / Device Management              │    │
│  └──────┬──────────────┬──────────────┬─────────────────────┘    │
│         │              │              │                          │
│  ┌──────▼──────┐ ┌─────▼──────┐ ┌────▼───────┐                 │
│  │ Renderer    │ │ Renderer   │ │ Renderer   │                 │
│  │ Process     │ │ Process    │ │ Process    │                 │
│  │ (Tab 1)     │ │ (Tab 2)    │ │ (Tab 3)    │                 │
│  │ Sandbox     │ │ Sandbox    │ │ Sandbox    │                 │
│  └─────────────┘ └────────────┘ └────────────┘                 │
│         │              │              │                          │
│  ┌──────▼──────────────▼──────────────▼─────────────────────┐   │
│  │  GPU Process                                              │   │
│  │  Screen rendering / Hardware acceleration                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Benefit: Tab 2 crashes → only Tab 2's process terminates        │
│           Tab 1 and Tab 3 are unaffected                         │
│           Browser UI continues to work normally                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Types and Roles of Processes

In Chromium, the following processes work together.

```
Chromium Process Configuration (detailed):

  ┌─────────────────────────────────────────────────────────────┐
  │              Browser Process                                 │
  │                                                             │
  │  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐   │
  │  │ UI Thread   │ │ IO Thread    │ │ Storage Thread    │   │
  │  │             │ │              │ │                   │   │
  │  │ ・Tab mgmt  │ │ ・IPC proc.  │ │ ・File I/O        │   │
  │  │ ・Navigation│ │ ・Network    │ │ ・DB operations   │   │
  │  │ ・Window    │ │  dispatch    │ │ ・Cache           │   │
  │  └─────────────┘ └──────────────┘ └───────────────────┘   │
  └────────────────────────┬────────────────────────────────────┘
                           │ Mojo IPC
         ┌─────────────────┼─────────────────┐
         │                 │                 │
  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
  │ Renderer    │  │ GPU         │  │ Utility     │
  │ Process     │  │ Process     │  │ Process     │
  │             │  │             │  │             │
  │ ・Blink     │  │ ・Skia      │  │ ・Network   │
  │ ・V8        │  │ ・GL/Vulkan │  │  service    │
  │ ・CC (comp.)│  │ ・Video     │  │ ・Audio     │
  │             │  │  decode     │  │  service    │
  │ Runs inside │  │             │  │ ・Data dec. │
  │ sandbox     │  │             │  │             │
  └─────────────┘  └─────────────┘  └──────────────┘

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Extension    │  │ Plugin       │  │ Crashpad     │
  │ Process      │  │ Process      │  │ Handler      │
  │              │  │ (legacy)     │  │              │
  │ Isolated per │  │ PPAPI, etc.  │  │ Crash        │
  │ extension    │  │              │  │ reporting    │
  └──────────────┘  └──────────────┘  └──────────────┘
```

Detailed roles for each process:

| Process | Role | Sandbox | Estimated Memory Usage |
|---------|------|---------|----------------------|
| Browser Process | UI control, navigation, overall management | None (privileged process) | 100–200 MB |
| Renderer Process | HTML/CSS/JS processing, DOM construction | Yes (strictest) | 50–300 MB/tab |
| GPU Process | Screen rendering, video decoding | Yes | 100–500 MB |
| Network Service | HTTP/HTTPS communication | Yes | 20–50 MB |
| Storage Service | IndexedDB, Cache API | Yes | 10–30 MB |
| Audio Service | Audio input/output | Yes | 10–20 MB |
| Extension Process | Chrome extension execution | Partial | 20–100 MB/extension |

### 1.3 Process Model Selection Strategy

Chromium dynamically switches process models based on memory availability.

```
Process Model Strategies:

  ① Process-per-Site-Instance (default)
     → Groups the same instance of the same site into one process
     → Tab A and Tab B on example.com → same process
     → example.com and other.com → separate processes

  ② Process-per-Site
     → Groups all tabs of the same site into one process
     → Memory-saving mode (for low-memory devices)

  ③ Process-per-Tab
     → One process per tab (highest isolation)
     → Enable with --process-per-tab flag

  ④ Single Process
     → Runs everything in one process (for debugging only)
     → Enable with --single-process flag

  Behavior under memory constraints:
  ┌────────────────────────────────────────────────────────┐
  │ Memory Available │ Behavior                            │
  ├──────────────────┼─────────────────────────────────────┤
  │ Sufficient       │ Process-per-Site-Instance (normal)  │
  │ Slightly low     │ Aggressively reuse existing processes│
  │ Low              │ Release background tab processes     │
  │ Critical         │ Tab Discarding                       │
  └────────────────────────────────────────────────────────┘
```

### 1.4 Code Example: Inspecting Chrome Processes

**Code Example 1: Retrieving Process Information via chrome.processes API**

```javascript
// Example of retrieving process information in a Chrome extension (Manifest V3)
// Requires "permissions": ["processes"] in manifest.json

// Get list of all processes
chrome.processes.getProcessInfo(
  [], // empty array = all processes
  true, // include memory info
  (processes) => {
    for (const [pid, info] of Object.entries(processes)) {
      console.log(`PID: ${pid}`);
      console.log(`  Type: ${info.type}`);
      // type: "browser", "renderer", "gpu", "utility", "extension", etc.
      console.log(`  CPU Usage: ${info.cpu.toFixed(2)}%`);
      console.log(`  Private Memory: ${(info.privateMemory / 1024 / 1024).toFixed(1)}MB`);

      // For processes associated with a tab
      if (info.tasks) {
        info.tasks.forEach(task => {
          console.log(`  Task: ${task.title} (Tab ID: ${task.tabId})`);
        });
      }
    }
  }
);

// Monitor specific processes (e.g., detect memory leaks)
function monitorRendererProcesses(intervalMs = 5000) {
  const history = new Map();

  setInterval(() => {
    chrome.processes.getProcessInfo([], true, (processes) => {
      for (const [pid, info] of Object.entries(processes)) {
        if (info.type !== 'renderer') continue;

        if (!history.has(pid)) {
          history.set(pid, []);
        }
        const memoryMB = info.privateMemory / 1024 / 1024;
        history.get(pid).push({
          timestamp: Date.now(),
          memory: memoryMB
        });

        // Warn if memory increased by more than 50MB over the last 10 samples
        const records = history.get(pid);
        if (records.length >= 10) {
          const oldest = records[records.length - 10].memory;
          const newest = records[records.length - 1].memory;
          if (newest - oldest > 50) {
            console.warn(
              `[Memory Leak?] PID ${pid}: ` +
              `${oldest.toFixed(1)}MB → ${newest.toFixed(1)}MB ` +
              `(+${(newest - oldest).toFixed(1)}MB)`
            );
          }
        }
      }
    });
  }, intervalMs);
}
```

**Code Example 2: Monitoring the Main Thread with the Performance API**

```javascript
// Monitor the performance of the main thread inside a renderer process

// Detect Long Tasks (tasks lasting 50ms or more)
const longTaskObserver = new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    console.log(`[Long Task Detected]`);
    console.log(`  Duration: ${entry.duration.toFixed(2)}ms`);
    console.log(`  Start: ${entry.startTime.toFixed(2)}ms`);
    console.log(`  Name: ${entry.name}`);

    // Tasks over 100ms are a serious cause of UI jank
    if (entry.duration > 100) {
      console.error(
        `CRITICAL: Task took ${entry.duration.toFixed(0)}ms. ` +
        `This blocks rendering and causes jank.`
      );
    }

    // Tasks between 50–100ms have room for improvement
    if (entry.duration > 50 && entry.duration <= 100) {
      console.warn(
        `WARNING: Task took ${entry.duration.toFixed(0)}ms. ` +
        `Consider breaking this into smaller chunks.`
      );
    }
  }
});

longTaskObserver.observe({ type: 'longtask', buffered: true });

// Monitor frame rate
function monitorFrameRate() {
  let lastTime = performance.now();
  let frameCount = 0;
  const fpsHistory = [];

  function tick(currentTime) {
    frameCount++;
    const elapsed = currentTime - lastTime;

    if (elapsed >= 1000) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      fpsHistory.push(fps);

      if (fps < 30) {
        console.error(`[Frame Drop] FPS: ${fps} - Severe jank detected`);
      } else if (fps < 55) {
        console.warn(`[Frame Drop] FPS: ${fps} - Minor jank`);
      }

      frameCount = 0;
      lastTime = currentTime;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    getAverageFPS: () => {
      if (fpsHistory.length === 0) return 0;
      return Math.round(
        fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length
      );
    },
    getHistory: () => [...fpsHistory]
  };
}

const fpsMonitor = monitorFrameRate();
```

---

## 2. Internal Structure of the Renderer Process

### 2.1 All Stages of the Rendering Pipeline

Inside the renderer process, HTML goes through multiple stages before it becomes pixels. This sequence is called the rendering pipeline.

```
Rendering Pipeline:

  HTML / CSS / JS
       │
       ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Parse                                                │
  │    HTML → DOM tree                                      │
  │    CSS  → CSSOM (CSS Object Model)                      │
  │                                                         │
  │    ・HTML parser works incrementally                    │
  │    ・Parsing halts when <script> is encountered         │
  │    ・defer / async attributes avoid blocking            │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 2. Style (Style Calculation)                            │
  │    DOM + CSSOM → Computed Style                         │
  │                                                         │
  │    ・Apply cascading rules                              │
  │    ・Resolve inherited properties                       │
  │    ・Convert relative values (em, %, vh) to absolute    │
  │    ・Each DOM node is assigned its final style          │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 3. Layout                                               │
  │    Computed Style → Layout Tree (position and size)     │
  │                                                         │
  │    ・Elements with display:none are not in Layout Tree  │
  │    ・::before, ::after pseudo-elements are added        │
  │    ・Flexbox and grid calculations                      │
  │    ・Determine text line-break positions                │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 4. Pre-Paint / Paint (Generating Paint Instructions)    │
  │    Layout Tree → Paint Records (list of draw commands)  │
  │                                                         │
  │    ・Determine paint order (z-index, stacking contexts) │
  │    ・Background → border → text → child elements        │
  │    ・Generate Paint Records per layer                   │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 5. Layerize                                             │
  │    Paint Records → Compositing Layers                   │
  │                                                         │
  │    ・will-change, transform, opacity promote to layer   │
  │    ・overflow:scroll elements get dedicated layers      │
  │    ・<video>, <canvas> get dedicated layers             │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 6. Commit → Compositor Thread                           │
  │    Hand off from main thread to compositor thread       │
  │                                                         │
  │    ※ From this point on, the main thread is not blocked │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 7. Tiling & Raster                                      │
  │    Split layers into tiles → convert to pixels          │
  │                                                         │
  │    ・Multiple raster threads work in parallel           │
  │    ・GPU rasterization (OOP-R) is used                  │
  │    ・Tiles near the viewport are prioritized            │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ 8. Draw / Display                                       │
  │    Send compositor frame to the GPU process             │
  │    → Final compositing and display on screen            │
  └─────────────────────────────────────────────────────────┘
```

### 2.2 Separation of the Main Thread and Compositor Thread

Within the renderer process, separating the main thread and compositor thread is a critically important design decision.

```
Thread configuration inside a renderer process:

  ┌───────────────────────────────────────────────────────────────┐
  │                   Renderer Process                            │
  │                                                               │
  │  ┌───────────────────────────────────────────────────────┐   │
  │  │ Main Thread                                            │   │
  │  │                                                       │   │
  │  │  ┌─────┐ ┌──────┐ ┌────┐ ┌────────┐ ┌──────┐       │   │
  │  │  │Parse│→│Style │→│Layout│→│Pre-Paint│→│Paint │       │   │
  │  │  └─────┘ └──────┘ └────┘ └────────┘ └──┬───┘       │   │
  │  │                                         │            │   │
  │  │  ┌──────────────────────────────────┐   │            │   │
  │  │  │ JavaScript Engine (V8)           │   │            │   │
  │  │  │ ・Script execution               │   │            │   │
  │  │  │ ・Event handlers                 │   │            │   │
  │  │  │ ・requestAnimationFrame          │   │            │   │
  │  │  │ ・GC (Garbage Collection)        │   │            │   │
  │  │  └──────────────────────────────────┘   │            │   │
  │  └─────────────────────────────────────────┼────────────┘   │
  │                                     Commit │                 │
  │  ┌─────────────────────────────────────────▼────────────┐   │
  │  │ Compositor Thread                                     │   │
  │  │                                                       │   │
  │  │  ・Initial handling of input events                   │   │
  │  │  ・Scroll handling (when no JS handlers)              │   │
  │  │  ・CSS animation / transition processing              │   │
  │  │  ・Layer compositing                                  │   │
  │  │  ・Tile management                                    │   │
  │  └──────────────────────────┬────────────────────────────┘   │
  │                             │                               │
  │  ┌──────────────────────────▼────────────────────────────┐   │
  │  │ Raster Threads (multiple)                             │   │
  │  │                                                       │   │
  │  │  ・Rasterize tiles to pixels                          │   │
  │  │  ・GPU rasterization                                  │   │
  │  └───────────────────────────────────────────────────────┘   │
  │                                                               │
  │  ┌───────────────────────────────────────────────────────┐   │
  │  │ Worker Threads (optional)                             │   │
  │  │                                                       │   │
  │  │  ・Web Worker                                         │   │
  │  │  ・Service Worker                                     │   │
  │  │  ・Worklets (Paint Worklet, Audio Worklet, etc.)      │   │
  │  └───────────────────────────────────────────────────────┘   │
  └───────────────────────────────────────────────────────────────┘

  Benefits of the compositor thread:
  ・Main thread is busy with JS → scrolling remains smooth
  ・transform / opacity animations → no main thread needed
  ・Easier to maintain 60 fps
```

### 2.3 Properties Handled Entirely by the Compositor

In performance optimization, using CSS properties that can be handled solely by the compositor is critically important.

| CSS Property | Layout Recalc | Repaint | Composite Only |
|-------------|--------------|---------|----------------|
| `width`, `height` | Required | Required | --- |
| `margin`, `padding` | Required | Required | --- |
| `top`, `left` (position) | Required | Required | --- |
| `color`, `background-color` | --- | Required | --- |
| `box-shadow` | --- | Required | --- |
| `border-radius` | --- | Required | --- |
| `transform` | --- | --- | Composite only |
| `opacity` | --- | --- | Composite only |
| `filter` | --- | --- | Composite only |
| `will-change` | --- | --- | Hint for layer promotion |

**Code Example 3: Compositor-Friendly Animations**

```css
/* Anti-pattern: animating with left
   → triggers layout recalculation every frame */
.slide-bad {
  position: absolute;
  left: 0;
  transition: left 0.3s ease;
}
.slide-bad.active {
  left: 200px;  /* All stages — layout → paint → composite — are executed */
}

/* Recommended: animating with transform
   → handled entirely by the compositor thread */
.slide-good {
  transform: translateX(0);
  transition: transform 0.3s ease;
  will-change: transform;  /* Hint for layer promotion */
}
.slide-good.active {
  transform: translateX(200px);  /* Composite only → fast */
}

/* Anti-pattern: animating background-color
   → triggers repaint every frame */
.fade-bad {
  background-color: #ffffff;
  transition: background-color 0.3s ease;
}
.fade-bad:hover {
  background-color: #f0f0f0;  /* Paint → composite runs every frame */
}

/* Recommended: fading with opacity
   → handled entirely by the compositor thread */
.fade-good {
  opacity: 1;
  transition: opacity 0.3s ease;
}
.fade-good:hover {
  opacity: 0.8;  /* Composite only → fast */
}
```

```javascript
// Write compositor-friendly animations in JavaScript too

// Anti-pattern: direct manipulation via style.left
function animateBad(element, targetX) {
  let current = 0;
  const step = 2;

  function frame() {
    current += step;
    element.style.left = current + 'px'; // layout thrashing
    if (current < targetX) {
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);
}

// Recommended: Web Animations API + transform
function animateGood(element, targetX) {
  element.animate(
    [
      { transform: 'translateX(0)' },
      { transform: `translateX(${targetX}px)` }
    ],
    {
      duration: 300,
      easing: 'ease-out',
      fill: 'forwards',
      // composite: 'accumulate' // compose with existing transform
    }
  );
}

// Recommended: CSS Custom Properties + transition
function animateWithCustomProps(element, targetX) {
  element.style.setProperty('--translate-x', `${targetX}px`);
  // In CSS: transform: translateX(var(--translate-x));
  //         transition: transform 0.3s ease;
}
```

---

## 3. Browser Engine Comparison and History

### 3.1 Engine Genealogy

```
Browser Engine Genealogy (1998–2025):

  1998  KHTML (KDE Project)
        │
        ├──── 2001  KHTML → WebKit fork (Apple)
        │            │
        │            ├──── 2003  Safari 1.0 (WebKit)
        │            │
        │            ├──── 2008  Chrome 1.0 (WebKit + V8)
        │            │     │
        │            │     └──── 2013  Blink fork (Google)
        │            │            │
        │            │            ├── Chrome (2013~)
        │            │            ├── Opera (2013~)
        │            │            ├── Edge (2020~)
        │            │            ├── Brave (2016~)
        │            │            ├── Vivaldi (2016~)
        │            │            └── Samsung Internet
        │            │
        │            └──── WebKit (continued by Apple)
        │                  ├── Safari (macOS / iOS)
        │                  ├── GNOME Web (Epiphany)
        │                  └── All browsers on iOS
        │
  1998  Gecko (Netscape → Mozilla)
        ├── Firefox (2004~)
        ├── Thunderbird
        └── Servo (experimental parallel engine, 2012~)

  1997  Trident (Microsoft)
        ├── Internet Explorer (1997–2022)
        └── EdgeHTML (2015–2020)
             └── Discontinued → migrated to Chromium-based
```

### 3.2 Detailed Engine Comparison

| Feature | Blink (Chromium) | WebKit (Safari) | Gecko (Firefox) |
|---------|-----------------|----------------|-----------------|
| Developed by | Google-led | Apple-led | Mozilla Foundation |
| Initial release | 2013 | 2003 | 1998 |
| Rendering language | C++ | C++ | C++ / Rust (Stylo) |
| JS engine | V8 (C++) | JavaScriptCore (C++) | SpiderMonkey (C++ / Rust) |
| Process model | Multi-process | Multi-process (limited) | Multi-process (Fission) |
| CSS Grid | Full support | Full support | Full support |
| Web Components | Full support | Full support | Full support |
| WASM | Full support | Full support | Full support |
| Market share (2024) | ~65–70% | ~18–20% | ~3–4% |
| Mobile share | ~65% | ~25% (iOS) | ~1% |
| Notable technology | OilPan GC, LayoutNG | Intelligent Tracking Prevention | Stylo (Rust CSS), Fission |

### 3.3 JavaScript Engine Comparison

| Feature | V8 (Chrome) | JavaScriptCore (Safari) | SpiderMonkey (Firefox) |
|---------|------------|------------------------|----------------------|
| JIT tiers | Sparkplug → Maglev → Turbofan | LLInt → Baseline → DFG → FTL | Baseline → IC → Warp |
| GC approach | Generational + Incremental + Concurrent | Generational + Concurrent | Generational + Incremental + Concurrent |
| WASM implementation | Liftoff (baseline) + TurboFan (optimizing) | BBQ (baseline) + OMG (optimizing) | Baseline + Ion (optimizing) |
| Embedded use | Node.js, Deno, Bun | React Native (Hermes) | --- |
| Optimization techniques | Hidden Classes, Inline Caches | Structure Chain | Shape + IC |

---

## 4. Chromium Source Code Structure

### 4.1 Directory Layout

The Chromium source code is a massive codebase exceeding about 35 million lines. Understanding the major directory structure is important for deepening your understanding of browser architecture.

```
chromium/src/
├── chrome/              # Chrome browser-specific code
│   ├── browser/         #   Browser process UI/logic
│   ├── renderer/        #   Chrome-specific renderer process code
│   ├── common/          #   Code shared between processes
│   └── test/            #   Chrome-specific tests
│
├── content/             # Core browser content processing
│   ├── browser/         #   Content layer browser process side
│   ├── renderer/        #   Content layer renderer process side
│   ├── gpu/             #   GPU process implementation
│   ├── common/          #   Shared between processes
│   └── public/          #   Public API (for embedders)
│
├── third_party/
│   └── blink/           # Blink rendering engine
│       ├── renderer/
│       │   ├── core/    #     DOM, CSS, Layout, Paint
│       │   ├── modules/ #     Web APIs (Fetch, WebGL, etc.)
│       │   ├── platform/#     Platform abstraction layer
│       │   └── bindings/#     V8 bindings
│       └── web/         #   Blink public interface
│
├── v8/                  # V8 JavaScript engine
│   ├── src/
│   │   ├── compiler/    #   JIT compiler
│   │   ├── heap/        #   Garbage collector
│   │   ├── interpreter/ #   Ignition interpreter
│   │   └── wasm/        #   WebAssembly implementation
│   └── test/
│
├── gpu/                 # GPU command buffer
├── cc/                  # Chromium Compositor
├── viz/                 # Viz (display service)
├── ui/                  # UI framework
├── net/                 # Network stack
├── mojo/                # Mojo IPC framework
├── ipc/                 # Legacy IPC
├── base/                # Base libraries (threads, files, etc.)
├── services/            # Servicified components
│   ├── network/         #   Network service
│   ├── device/          #   Device service
│   └── data_decoder/    #   Data decoder service
├── components/          # Reusable components
└── build/               # Build system (GN + Ninja)
```

### 4.2 Blink Internal Structure

Blink is the heart of the rendering engine, responsible for converting DOM to pixels.

**Code Example 4: Blink DOM Node Implementation (simplified)**

```cpp
// third_party/blink/renderer/core/dom/node.h (simplified)
// Basic structure of a DOM node in Blink

namespace blink {

class Node : public EventTarget {
 public:
  enum NodeType {
    kElementNode = 1,
    kAttributeNode = 2,
    kTextNode = 3,
    kCommentNode = 8,
    kDocumentNode = 9,
    kDocumentFragmentNode = 11,
  };

  // Tree traversal
  Node* parentNode() const { return parent_; }
  Node* firstChild() const { return first_child_; }
  Node* lastChild() const { return last_child_; }
  Node* nextSibling() const { return next_; }
  Node* previousSibling() const { return previous_; }

  // DOM manipulation
  Node* appendChild(Node* new_child);
  Node* removeChild(Node* old_child);
  Node* insertBefore(Node* new_child, Node* ref_child);
  Node* replaceChild(Node* new_child, Node* old_child);

  // Layout-related
  LayoutObject* GetLayoutObject() const { return layout_object_; }
  void SetLayoutObject(LayoutObject*);

  // Style-related
  const ComputedStyle* GetComputedStyle() const;
  void SetNeedsStyleRecalc(StyleChangeType);

  // Garbage collection (Oilpan)
  void Trace(Visitor*) const override;

 private:
  Member<Node> parent_;
  Member<Node> first_child_;
  Member<Node> last_child_;
  Member<Node> next_;
  Member<Node> previous_;
  Member<LayoutObject> layout_object_;
  NodeFlags node_flags_;
};

// Memory management via Oilpan GC
// Blink uses its own GC (Oilpan)
// It runs separately from V8's GC and manages the lifecycle of DOM objects
// Member<T> is a managed pointer used by the GC for tracing

}  // namespace blink
```

---

## 5. Inter-Process Communication (IPC) and Mojo

### 5.1 Mojo IPC Framework

Inter-process communication in Chromium is implemented through a framework called Mojo. Mojo is a type-safe message-passing system that abstracts communication between processes.

```
Mojo IPC Configuration:

  ┌─────────────────────────────────────────────────────────────┐
  │                    Mojom IDL File                            │
  │                                                             │
  │  // example.mojom                                           │
  │  interface PageHandler {                                    │
  │    GetTitle() => (string title);                            │
  │    SetTitle(string new_title);                              │
  │  };                                                         │
  └────────────────────────┬────────────────────────────────────┘
                           │ Code generation
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ C++ Bindings │ │ Java Bindings│ │ JS Bindings  │
  │              │ │ (Android)    │ │              │
  │ Remote<T>   │ │              │ │              │
  │ Receiver<T> │ │              │ │              │
  └──────┬───────┘ └──────────────┘ └──────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              Mojo Message Pipe                               │
  │                                                             │
  │  Process A                     Process B                    │
  │  ┌──────────┐    Pipe          ┌──────────┐                │
  │  │ Remote   │ ═══════════════  │ Receiver │                │
  │  │ (sender) │  message →       │ (receiver│                │
  │  └──────────┘                 └──────────┘                │
  │                                                             │
  │  Characteristics:                                           │
  │  ・Asynchronous message passing                             │
  │  ・Type-safe (auto-generated from Mojom IDL)               │
  │  ・Works both within and between processes                  │
  │  ・Handles can be passed                                    │
  └─────────────────────────────────────────────────────────────┘
```

### 5.2 IPC in Practice: URL Navigation

Let's look in detail at the inter-process communication flow from when the user types a URL in the address bar until the page is displayed.

```
IPC Flow for URL Navigation:

  User Input    Browser Process    Network          Renderer       GPU
  (input)       (Browser)          Service          Process        Process
     │              │                │               │              │
     │ URL input    │                │               │              │
     ├─────────────→│                │               │              │
     │              │                │               │              │
     │              │ BeginNavigation│               │              │
     │              │───────────────→│               │              │
     │              │                │               │              │
     │              │                │ DNS resolve    │              │
     │              │                │ TCP connect    │              │
     │              │                │ TLS handshake │              │
     │              │                │ HTTP request   │              │
     │              │                │               │              │
     │              │                │ Response       │              │
     │              │ Header recv.   │ Headers        │              │
     │              │←───────────────│               │              │
     │              │                │               │              │
     │              │ Determine Content-Type          │              │
     │              │ (text/html → launch renderer)  │              │
     │              │                │               │              │
     │              │ CommitNavigation│               │              │
     │              │────────────────────────────────→│              │
     │              │                │               │              │
     │              │                │  Body transfer │              │
     │              │                │──────────────→│              │
     │              │                │               │              │
     │              │                │               │ HTML Parse   │
     │              │                │               │ DOM build    │
     │              │                │               │ Style calc.  │
     │              │                │               │ Layout       │
     │              │                │               │ Paint        │
     │              │                │               │              │
     │              │                │               │ Draw cmds    │
     │              │                │               │─────────────→│
     │              │                │               │              │
     │              │                │               │         Display
     │              │                │               │              │
     │              │ DidFinishLoad  │               │              │
     │              │←───────────────────────────────│              │
     │              │                │               │              │
     │  Page shown  │                │               │              │
     │←─────────────│                │               │              │
```

**Code Example 5: Mojo Interface Definition and Usage**

```cpp
// --- Mojom IDL Definition ---
// services/network/public/mojom/url_loader.mojom (simplified)

module network.mojom;

// URL loader interface
interface URLLoader {
  // Track redirects
  FollowRedirect(
    array<string> removed_headers,
    map<string, string> modified_headers
  );

  // Change priority
  SetPriority(RequestPriority priority, int32 intra_priority_value);
};

// URL loader client interface
interface URLLoaderClient {
  // Receive response
  OnReceiveResponse(URLResponseHead head,
                    handle<data_pipe_consumer>? body);

  // Notify of redirect
  OnReceiveRedirect(URLRequestRedirectInfo redirect_info,
                    URLResponseHead head);

  // Notify of completion
  OnComplete(URLLoaderCompletionStatus status);
};

// --- C++ Usage Example ---
// content/browser/loader/navigation_url_loader.cc (simplified)

#include "services/network/public/mojom/url_loader.mojom.h"

class NavigationURLLoader {
 public:
  void Start(const GURL& url) {
    // Connect to the network service
    mojo::Remote<network::mojom::URLLoaderFactory> factory;
    GetNetworkService()->CreateURLLoaderFactory(
        factory.BindNewPipeAndPassReceiver());

    // Create URLLoader and send request
    mojo::Remote<network::mojom::URLLoader> loader;
    mojo::PendingRemote<network::mojom::URLLoaderClient> client;
    auto client_receiver = client.InitWithNewPipeAndPassReceiver();

    auto request = network::ResourceRequest::New();
    request->url = url;
    request->method = "GET";

    factory->CreateLoaderAndStart(
        loader.BindNewPipeAndPassReceiver(),
        /*request_id=*/0,
        /*options=*/0,
        std::move(request),
        std::move(client),
        /*traffic_annotation=*/net::MutableNetworkTrafficAnnotationTag()
    );
  }
};
```

---

## 6. Site Isolation

### 6.1 Background and Purpose of Site Isolation

The Spectre/Meltdown vulnerabilities discovered in 2018 demonstrated that it is theoretically possible to read data across process memory boundaries. In response, Chromium fully adopted Site Isolation.

Site Isolation is a mechanism that ensures content from different sites (grouped by site, not origin) always runs in separate processes. This means that even if a Spectre attack succeeds, the attacker's process only contains data from their own site, making it impossible to read data from other sites.

```
How Site Isolation Works:

  ┌──────────────────────────────────────────────────────────────┐
  │ Without Site Isolation (legacy model)                        │
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Renderer Process (single process)                     │   │
  │  │                                                      │   │
  │  │  ┌──────────────┐  ┌──────────────────────────────┐ │   │
  │  │  │ example.com  │  │ <iframe src="evil.com">      │ │   │
  │  │  │              │  │                              │ │   │
  │  │  │ User's       │  │ Spectre attack can           │ │   │
  │  │  │ personal     │  │ read example.com's memory!   │ │   │
  │  │  │ data, Cookies│  │                              │ │   │
  │  │  └──────────────┘  └──────────────────────────────┘ │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                                                              │
  │ With Site Isolation (current model)                          │
  │                                                              │
  │  ┌────────────────────┐  ┌────────────────────────────┐    │
  │  │ Renderer Process A │  │ Renderer Process B         │    │
  │  │                    │  │                            │    │
  │  │  ┌──────────────┐ │  │  ┌──────────────────────┐ │    │
  │  │  │ example.com  │ │  │  │ evil.com (iframe)    │ │    │
  │  │  │              │ │  │  │                      │ │    │
  │  │  │ User's       │ │  │  │ Separate process →   │ │    │
  │  │  │ personal data│ │  │  │ cannot read with     │ │    │
  │  │  │ Cookies      │ │  │  │ Spectre either       │ │    │
  │  │  └──────────────┘ │  │  └──────────────────────┘ │    │
  │  └────────────────────┘  └────────────────────────────┘    │
  │                                                              │
  │  Process boundary = security boundary                        │
  └──────────────────────────────────────────────────────────────┘

  Difference between Site and Origin:
  ┌───────────────────────────────────────────────────────┐
  │ URL                         │ Site         │ Origin  │
  ├────────────────────────────┼──────────────┼─────────┤
  │ https://a.example.com:443  │ example.com  │ a.example.com:443 │
  │ https://b.example.com:443  │ example.com  │ b.example.com:443 │
  │ https://example.com:8080   │ example.com  │ example.com:8080  │
  │ https://other.com          │ other.com    │ other.com:443     │
  └───────────────────────────────────────────────────────┘

  → a.example.com and b.example.com share the same Site → same process allowed
  → example.com and other.com are different Sites → always separate processes
```

### 6.2 Memory Cost of Site Isolation

Site Isolation greatly improves security but increases memory consumption due to more processes.

| Scenario | Without Site Isolation | With Site Isolation | Increase |
|----------|----------------------|---------------------|----------|
| 5 tabs (all same site) | 1 process | 1 process | No increase |
| 5 tabs (all different sites) | 1–5 processes | 5 processes | 0–400% |
| 1 page with 3 iframes from different sites | 1 process | 4 processes | 300% |
| Typical web browsing | --- | --- | ~10–15% increase |

### 6.3 Cross-Origin Read Blocking (CORB) and CORP

CORB and CORP are security mechanisms that complement Site Isolation.

```javascript
// CORB (Cross-Origin Read Blocking)
// The browser automatically protects sensitive cross-origin data

// Example: attacker tries to read JSON data via an <img> tag
// <img src="https://bank.example/api/account"> ← CORB blocks this

// Content-Types blocked by CORB:
// - text/html
// - application/json
// - text/xml / application/xml

// CORP (Cross-Origin-Resource-Policy)
// A server-side header that restricts who can load a resource

// Server-side configuration examples
// Only loadable from the same origin
// Cross-Origin-Resource-Policy: same-origin

// Only loadable from the same site
// Cross-Origin-Resource-Policy: same-site

// Loadable from any origin
// Cross-Origin-Resource-Policy: cross-origin

// --- Related: COOP and COEP ---

// COOP (Cross-Origin-Opener-Policy)
// Cuts off window.opener references across origins
// Cross-Origin-Opener-Policy: same-origin

// COEP (Cross-Origin-Embedder-Policy)
// Requires explicit permission for cross-origin resource loading
// Cross-Origin-Embedder-Policy: require-corp

// Setting both COOP + COEP enables SharedArrayBuffer
// (disabled by default as a Spectre mitigation)

// How to check
if (crossOriginIsolated) {
  // SharedArrayBuffer is available
  const sab = new SharedArrayBuffer(1024);
  console.log('Cross-origin isolated:', crossOriginIsolated);
} else {
  console.log('SharedArrayBuffer is not available');
  console.log('Please set COOP and COEP headers');
}
```

---

## 7. Sandbox and Security Model

### 7.1 Renderer Sandbox

The renderer process sandbox is the foundation of Chromium's security. Even if the renderer process is compromised by malicious code, the sandbox restricts OS-level operations.

```
Sandbox Restrictions (per OS):

  ┌───────────────────────────────────────────────────────────┐
  │ Renderer Sandbox Restrictions                             │
  │                                                           │
  │ ┌─────────────────────────────────────────────────┐      │
  │ │ Prohibited Operations                            │      │
  │ │                                                   │      │
  │ │ - Direct access to the file system               │      │
  │ │ - Direct creation of network sockets             │      │
  │ │ - Direct access to other processes               │      │
  │ │ - Direct access to devices (camera, microphone)  │      │
  │ │ - Direct access to clipboard                     │      │
  │ │ - Direct connection to display server            │      │
  │ └─────────────────────────────────────────────────┘      │
  │                                                           │
  │ ┌─────────────────────────────────────────────────┐      │
  │ │ Permitted Operations (indirectly via IPC)        │      │
  │ │                                                   │      │
  │ │ + Send IPC messages to the browser process       │      │
  │ │ + Send draw commands to the GPU process          │      │
  │ │ + Read/write shared memory (limited)             │      │
  │ │ + CPU computation (including V8 JIT compilation) │      │
  │ └─────────────────────────────────────────────────┘      │
  │                                                           │
  │ OS-specific implementations:                              │
  │                                                           │
  │ Windows: Restricted Token + Job Object + Desktop Isolation│
  │ macOS:   Seatbelt (sandbox-exec) profile                  │
  │ Linux:   seccomp-bpf + Namespaces + AppArmor              │
  │ Android: SELinux + seccomp-bpf (isolatedProcess)          │
  │ ChromeOS: Minijail + seccomp-bpf + Namespaces            │
  └───────────────────────────────────────────────────────────┘
```

### 7.2 Security Checks in the Browser Process

The browser process acts as the "trusted process" and validates requests from renderer processes.

```javascript
// Validation logic for IPC messages from renderer processes (conceptual code)

// Validation logic on the browser process side
class SecurityChecker {

  // Validate file access requests
  validateFileAccess(rendererProcessId, filePath) {
    // 1. Normalize the file path requested by the renderer
    const normalizedPath = this.normalizePath(filePath);

    // 2. Detect path traversal attacks
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      this.killRenderer(rendererProcessId, 'PATH_TRAVERSAL_ATTEMPT');
      return false;
    }

    // 3. Deny access outside the download directory
    if (!normalizedPath.startsWith(this.allowedBasePath)) {
      this.killRenderer(rendererProcessId, 'UNAUTHORIZED_FILE_ACCESS');
      return false;
    }

    // 4. Deny access to sensitive files
    const sensitivePatterns = ['/etc/passwd', '/etc/shadow', '.ssh/'];
    for (const pattern of sensitivePatterns) {
      if (normalizedPath.includes(pattern)) {
        this.killRenderer(rendererProcessId, 'SENSITIVE_FILE_ACCESS');
        return false;
      }
    }

    return true;
  }

  // Validate navigation requests
  validateNavigation(rendererProcessId, sourceOrigin, targetURL) {
    // Verify the renderer is not spoofing its own origin
    const expectedOrigin = this.getOriginForProcess(rendererProcessId);
    if (sourceOrigin !== expectedOrigin) {
      this.killRenderer(rendererProcessId, 'ORIGIN_SPOOFING');
      return false;
    }

    // Deny unauthorized navigation to chrome:// or file://
    const scheme = new URL(targetURL).protocol;
    if (['chrome:', 'file:', 'chrome-extension:'].includes(scheme)) {
      if (!this.isSchemeAllowed(rendererProcessId, scheme)) {
        return false;
      }
    }

    return true;
  }

  // Force-terminate a bad renderer
  killRenderer(processId, reason) {
    console.error(`Killing renderer ${processId}: ${reason}`);
    // Visible at chrome://kills
    process.kill(processId);
    this.reportBadMessage(processId, reason);
  }
}
```

---

## 8. GPU Process and Hardware Acceleration

### 8.1 Role of the GPU Process

The GPU process receives draw commands from all renderer processes and uses GPU hardware to render the screen.

```
GPU Process Configuration:

  Renderer Processes                     GPU Process
  ┌──────────────┐                    ┌──────────────────────────┐
  │ Renderer A   │                    │                          │
  │ ┌──────────┐ │   Command buffer    │  ┌────────────────────┐│
  │ │Compositor│─│────────────────────│──│ Command Decoder    ││
  │ └──────────┘ │                    │  └────────┬───────────┘│
  └──────────────┘                    │           │            │
                                      │           ▼            │
  ┌──────────────┐                    │  ┌────────────────────┐│
  │ Renderer B   │                    │  │ Skia (GPU Backend) ││
  │ ┌──────────┐ │   Command buffer    │  │                    ││
  │ │Compositor│─│────────────────────│──│ ┌───────┐ ┌──────┐││
  │ └──────────┘ │                    │  │ │OpenGL │ │Vulkan│││
  └──────────────┘                    │  │ └───────┘ └──────┘││
                                      │  │ ┌───────┐ ┌──────┐││
  ┌──────────────┐                    │  │ │Metal  │ │D3D12 │││
  │ Renderer C   │                    │  │ │(macOS)│ │(Win) │││
  │ ┌──────────┐ │   Command buffer    │  │ └───────┘ └──────┘││
  │ │Compositor│─│────────────────────│──│                    ││
  │ └──────────┘ │                    │  └────────┬───────────┘│
  └──────────────┘                    │           │            │
                                      │           ▼            │
                                      │  ┌────────────────────┐│
                                      │  │ Display Output     ││
                                      │  │ (VSync sync)       ││
                                      │  └────────────────────┘│
                                      └──────────────────────────┘

  Reasons for isolating the GPU process:
  (1) A GPU driver crash does not affect the entire browser
  (2) Centralized management of GPU resources (efficient VRAM use)
  (3) Acts as a sandbox boundary
  (4) GPU drivers require privileged operations close to the OS kernel
```

### 8.2 Hardware Acceleration Targets

```
Hardware Acceleration Targets and How to Check:

  ┌───────────────────────────────────────────────────────────┐
  │ Feature                    │ GPU Use │ Where to Check      │
  ├────────────────────────────┼─────────┼────────────────────┤
  │ Page compositing           │ Yes     │ chrome://gpu        │
  │ CSS 3D Transform           │ Yes     │ chrome://gpu        │
  │ CSS Animation              │ Yes     │ DevTools > Layers   │
  │ WebGL / WebGL2             │ Yes     │ chrome://gpu        │
  │ WebGPU                     │ Yes     │ chrome://flags      │
  │ Video decoding             │ Yes     │ chrome://media-internals │
  │ Video encoding             │ Yes     │ chrome://gpu        │
  │ Canvas 2D                  │ Partial │ chrome://flags      │
  │ SVG rendering              │ Partial │ ---                 │
  │ Text rendering             │ No      │ Handled by CPU      │
  │ JavaScript execution       │ No      │ Handled by CPU      │
  │ DOM manipulation           │ No      │ Handled by CPU      │
  └───────────────────────────────────────────────────────────┘

  Information available at chrome://gpu:
  ・Graphics Feature Status (enabled/disabled state of each feature)
  ・Driver Information (GPU driver details)
  ・Compositor Information (compositor settings)
  ・GpuMemoryBuffers Status (GPU memory buffer state)
```

---

## 9. Process and Performance Analysis with DevTools

### 9.1 Using the Chrome Task Manager

```
Launching and Reading the Chrome Task Manager:

  How to launch:
  ・Windows / Linux: Shift + Esc
  ・macOS: Window menu → Task Manager
  ・All OS: More tools → Task Manager

  ┌────────────────────────────────────────────────────────────┐
  │ Chrome Task Manager                                        │
  ├─────────────────────┬────────┬───────┬────────┬───────────┤
  │ Task                │ Memory │ CPU   │ Network│ Process ID│
  ├─────────────────────┼────────┼───────┼────────┼───────────┤
  │ Browser             │ 180MB  │ 3.2%  │ 0      │ 12345     │
  │ GPU Process         │ 250MB  │ 8.5%  │ 0      │ 12346     │
  │ Network Service     │ 35MB   │ 0.5%  │ 45KB/s │ 12347     │
  │ Audio Service       │ 15MB   │ 0.1%  │ 0      │ 12348     │
  │ Tab: google.com     │ 95MB   │ 1.2%  │ 2KB/s  │ 12350     │
  │ Tab: youtube.com    │ 320MB  │ 22.3% │ 500KB/s│ 12351     │
  │ Tab: docs.google.com│ 150MB  │ 5.1%  │ 1KB/s  │ 12352     │
  │ Subframe: ads.com   │ 45MB   │ 3.0%  │ 10KB/s │ 12353     │
  │ Extension: uBlock   │ 28MB   │ 0.3%  │ 0      │ 12354     │
  │ Service Worker: PWA │ 22MB   │ 0.0%  │ 0      │ 12355     │
  └─────────────────────┴────────┴───────┴────────┴───────────┘

  Key points:
  ・"Subframe: ads.com" → an iframe isolated to a separate process by Site Isolation
  ・YouTube's high CPU usage → video decoding + JS processing
  ・A tab with abnormally high Memory → possible memory leak
  ・Right-click to add columns: JavaScript Memory, Image Cache, etc.
```

### 9.2 Using the Performance Panel

**Code Example 6: Identifying Bottlenecks with the Performance API**

```javascript
// Utility class for performance measurement
class BrowserPerformanceAnalyzer {

  constructor() {
    this.marks = new Map();
    this.measures = [];
  }

  // Measure each stage of the rendering pipeline
  measureRenderingPipeline() {
    // Measure style recalculation cost
    performance.mark('style-start');
    // ... DOM manipulation or class changes ...
    requestAnimationFrame(() => {
      performance.mark('style-end');
      performance.measure('Style Recalculation', 'style-start', 'style-end');
    });
  }

  // Detect Layout Thrashing
  detectLayoutThrashing() {
    const originalGetComputedStyle = window.getComputedStyle;
    let readCount = 0;
    let writeCount = 0;
    let thrashingDetected = false;

    // Monitor calls to getComputedStyle
    window.getComputedStyle = function(...args) {
      readCount++;
      if (writeCount > 0 && readCount > 1) {
        thrashingDetected = true;
        console.warn(
          `[Layout Thrashing] Read-Write-Read pattern detected. ` +
          `Reads: ${readCount}, Writes: ${writeCount}`
        );
      }
      return originalGetComputedStyle.apply(this, args);
    };

    // Reset after a period of time
    requestAnimationFrame(() => {
      window.getComputedStyle = originalGetComputedStyle;
      readCount = 0;
      writeCount = 0;
    });

    return { isThrashing: () => thrashingDetected };
  }

  // Detailed analysis of Navigation Timing
  analyzeNavigationTiming() {
    const timing = performance.getEntriesByType('navigation')[0];
    if (!timing) return null;

    return {
      // DNS lookup
      dns: {
        duration: timing.domainLookupEnd - timing.domainLookupStart,
        label: 'DNS Lookup'
      },
      // TCP connection (including TLS)
      connection: {
        duration: timing.connectEnd - timing.connectStart,
        label: 'TCP + TLS'
      },
      // TTFB (Time to First Byte)
      ttfb: {
        duration: timing.responseStart - timing.requestStart,
        label: 'TTFB'
      },
      // Response download
      download: {
        duration: timing.responseEnd - timing.responseStart,
        label: 'Download'
      },
      // DOM parsing
      domParse: {
        duration: timing.domInteractive - timing.responseEnd,
        label: 'DOM Parse'
      },
      // DOMContentLoaded
      domContentLoaded: {
        duration: timing.domContentLoadedEventEnd
          - timing.domContentLoadedEventStart,
        label: 'DOMContentLoaded handlers'
      },
      // Total load time
      totalLoad: {
        duration: timing.loadEventEnd - timing.navigationStart,
        label: 'Total Load'
      }
    };
  }

  // Analyze Resource Timing
  analyzeResourceTiming() {
    const resources = performance.getEntriesByType('resource');

    const byType = {};
    for (const resource of resources) {
      const type = resource.initiatorType || 'other';
      if (!byType[type]) {
        byType[type] = { count: 0, totalSize: 0, totalDuration: 0 };
      }
      byType[type].count++;
      byType[type].totalSize += resource.transferSize || 0;
      byType[type].totalDuration += resource.duration;
    }

    return {
      totalResources: resources.length,
      byType,
      slowest: resources
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(r => ({
          name: r.name.split('/').pop(),
          duration: Math.round(r.duration),
          size: r.transferSize
        }))
    };
  }
}

// Usage example
const analyzer = new BrowserPerformanceAnalyzer();

// Run analysis after page load
window.addEventListener('load', () => {
  setTimeout(() => {
    const navTiming = analyzer.analyzeNavigationTiming();
    const resTiming = analyzer.analyzeResourceTiming();

    console.table(
      Object.entries(navTiming).map(([key, val]) => ({
        Phase: val.label,
        Duration: `${val.duration.toFixed(1)}ms`
      }))
    );

    console.log('Resource Summary:', resTiming);
  }, 100);
});
```

### 9.3 Using chrome://tracing

```
Using chrome://tracing (Perfetto UI):

  1. Navigate to chrome://tracing
  2. Click the "Record" button
  3. Select categories:
     ・blink    → rendering engine internals
     ・cc       → compositor
     ・gpu      → GPU commands
     ・v8       → JavaScript engine
     ・netlog   → network
     ・loading  → resource loading

  4. Perform actions, then click "Stop" to end recording
  5. Inspect behavior of each process/thread on the timeline

  Alternative: Perfetto UI (https://ui.perfetto.dev/)
  → More powerful analysis tool
  → Supports SQL queries for data analysis
  → Can import chrome://tracing data

  Key trace events:
  ┌──────────────────────┬──────────────────────────────────┐
  │ Event Name            │ Meaning                          │
  ├──────────────────────┼──────────────────────────────────┤
  │ ParseHTML            │ HTML parsing                      │
  │ UpdateLayoutTree     │ Style calculation                 │
  │ Layout               │ Layout calculation                │
  │ PrePaint             │ Pre-paint preparation             │
  │ Paint                │ Paint command generation          │
  │ CompositeLayers      │ Layer compositing                 │
  │ V8.Execute           │ JavaScript execution              │
  │ V8.GCScavenge        │ Minor GC                          │
  │ V8.GCMarkCompact     │ Major GC                          │
  │ ResourceReceivedData │ Network data received             │
  │ DecodeImage          │ Image decoding                    │
  │ Rasterize            │ Rasterization                     │
  └──────────────────────┴──────────────────────────────────┘
```

---

## 10. Anti-Patterns and How to Avoid Them

### 10.1 Anti-Pattern 1: Layout Thrashing

Layout Thrashing is a phenomenon where JavaScript alternates between reading and writing styles, forcing the browser to recalculate layout repeatedly every time. This significantly degrades performance.

```javascript
// ===== Anti-pattern: Layout Thrashing =====

// Bad: alternating reads and writes
function resizeAllBoxesBad(boxes) {
  for (const box of boxes) {
    // Read → forces layout recalculation
    const width = box.offsetWidth;

    // Write → invalidates the layout
    box.style.width = (width * 1.1) + 'px';

    // Next iteration reads again → forces layout again!
    // N boxes → N layout calculations → O(N) layouts
  }
  // With 100 boxes → ~100 layout recalculations
  // → Blocking for tens to hundreds of milliseconds
}

// ===== Recommended: Batch reads + batch writes =====

// Good: batch all reads first, then batch all writes
function resizeAllBoxesGood(boxes) {
  // Phase 1: batch all reads (layout is calculated only once)
  const widths = boxes.map(box => box.offsetWidth);

  // Phase 2: batch all writes
  boxes.forEach((box, i) => {
    box.style.width = (widths[i] * 1.1) + 'px';
  });
  // Layout: 1 calculation on first read + 1 after writes = 2 total
}

// Even better: use requestAnimationFrame
function resizeAllBoxesBest(boxes) {
  // Reads happen in the current frame
  const widths = boxes.map(box => box.offsetWidth);

  // Writes happen in the next frame
  requestAnimationFrame(() => {
    boxes.forEach((box, i) => {
      box.style.width = (widths[i] * 1.1) + 'px';
    });
  });
}

// Properties that trigger Forced Synchronous Layout:
// offsetTop, offsetLeft, offsetWidth, offsetHeight
// scrollTop, scrollLeft, scrollWidth, scrollHeight
// clientTop, clientLeft, clientWidth, clientHeight
// getComputedStyle()
// getBoundingClientRect()
// innerText
```

### 10.2 Anti-Pattern 2: Excessive Layer Promotion

```css
/* ===== Anti-pattern: applying will-change to every element ===== */

/* Bad: promoting every element to its own layer */
* {
  will-change: transform;
  /* Every element becomes an independent layer
     → Consumes massive amounts of GPU memory
     → Increases layer management overhead
     → Actually degrades performance */
}

/* Bad: will-change on many list items */
.list-item {
  will-change: transform, opacity;
  /* 1000 list items → 1000 layers
     → GPU memory exhaustion → software fallback */
}
```

```css
/* ===== Recommended: apply only to elements that need it, only when needed ===== */

/* Good: enable will-change only on hover */
.card {
  transition: transform 0.3s ease;
}
.card:hover {
  will-change: transform;
}
.card.animating {
  transform: scale(1.05);
}

/* Good: manage dynamically with JavaScript */
/*
  element.addEventListener('mouseenter', () => {
    element.style.willChange = 'transform';
  });
  element.addEventListener('transitionend', () => {
    element.style.willChange = 'auto';
  });
*/

/* Good: apply only to the few elements being animated */
.modal-overlay {
  will-change: opacity;
}
.slide-panel {
  will-change: transform;
}
/* Do not set will-change on other elements */
```

### 10.3 Anti-Pattern 3: Overloading the Main Thread

```javascript
// ===== Anti-pattern: heavy computation on the main thread =====

// Bad: sorting a large dataset on the main thread
function sortLargeDatasetBad(data) {
  // Sorting 1 million records → blocks the main thread for seconds
  // → no scrolling, no click response, animations stop
  return data.sort((a, b) => {
    // complex comparison logic
    return complexComparison(a, b);
  });
}

// ===== Recommended: offload to a Web Worker =====

// worker.js
// self.addEventListener('message', (e) => {
//   const { data, sortKey } = e.data;
//   const sorted = data.sort((a, b) => a[sortKey] - b[sortKey]);
//   self.postMessage({ sorted });
// });

// Main thread side
function sortLargeDatasetGood(data, sortKey) {
  return new Promise((resolve) => {
    const worker = new Worker('worker.js');
    worker.postMessage({ data, sortKey });
    worker.addEventListener('message', (e) => {
      resolve(e.data.sorted);
      worker.terminate();
    });
  });
}

// ===== Recommended: Task splitting (Time Slicing) =====

// Process in chunks, yielding to the main thread between each
async function processInChunks(items, processFn, chunkSize = 100) {
  const results = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = chunk.map(processFn);
    results.push(...chunkResults);

    // Return control to the main thread after each chunk
    // → rendering and event handling can interleave
    if (i + chunkSize < items.length) {
      await new Promise(resolve => {
        // Use scheduler.yield() if available
        if ('scheduler' in globalThis && 'yield' in scheduler) {
          scheduler.yield().then(resolve);
        } else {
          setTimeout(resolve, 0);
        }
      });
    }
  }

  return results;
}

// Usage example
// const processed = await processInChunks(largeArray, item => {
//   return expensiveTransform(item);
// }, 50);
```

---

## FAQ

### Q1: What are the benefits of a multi-process architecture?

**A:** The multi-process architecture has three main benefits.

1. **Stability**: If one tab or plugin crashes, other tabs and the browser itself are unaffected. Even if a renderer process terminates abnormally, the browser process remains alive and can show "Tab crashed" with an option to reload.

2. **Security**: Each renderer process runs inside a sandbox, preventing malicious websites from directly accessing the file system or network. Privileged operations must go through the browser process, where permission checks are enforced.

3. **Performance**: Multi-core CPUs can be leveraged to process multiple tabs in parallel. Also, by isolating each tab in its own process, closing a tab frees all of that process's memory, even if it had a memory leak.

However, more processes also means more memory overhead, so Chrome also performs optimizations to merge processes when appropriate (see the process model section).

### Q2: What are the differences between Chrome and Firefox architectures?

**A:** The main differences are as follows.

**Chrome (Chromium)**:
- **Renderer process per tab** multi-process model (same-site tabs may be merged)
- **Site Isolation**: cross-site iframes also run in separate processes for stronger security (Spectre mitigation)
- **GPU process**: single GPU process shared by all tabs
- **Blink rendering engine** + **V8 JavaScript engine**

**Firefox**:
- **Quantum (Electrolysis/e10s)**: isolates a content process per tab (similar to Chrome)
- **Fission**: Site Isolation equivalent (iframe isolation) being introduced gradually
- **GPU process**: single GPU process, same as Chrome
- **Gecko rendering engine** + **SpiderMonkey JavaScript engine**

The fundamental architecture philosophy is converging, but engine implementations and optimization strategies differ. For example, Firefox uses a new GPU-driven rendering engine called "WebRender," which pursues performance through a different approach than Chrome.

### Q3: How does Site Isolation work?

**A:** Site Isolation is a security feature that protects users from cross-site attacks, especially Spectre.

**Basic principle**:
- Content from different origins (scheme + domain + port) runs in **separate renderer processes**
- Example: the main frame of `https://example.com` and an iframe from `https://ad.example.net` run in separate processes

**Why it is necessary**:
- Spectre attacks are vulnerabilities that read memory within the same process
- Site Isolation prevents a malicious iframe from reading the parent frame's memory (passwords, tokens, etc.)

**Implementation details**:
1. **OOPIF (Out-of-Process iframes)**: cross-site iframes are rendered in a separate renderer process and communicate with the main frame via IPC
2. **CORB (Cross-Origin Read Blocking)**: blocks renderer processes from loading unauthorized cross-origin resources (HTML/JSON/XML)
3. **Memory overhead**: more processes increase memory usage by 10–20%, but the security benefits are judged to outweigh this cost

**Activation status**:
- Enabled by default on desktop Chrome since version 67
- On Android, enabled only on some high-end devices (due to memory constraints)

See the [Site Isolation Design Document](https://www.chromium.org/Home/chromium-security/site-isolation/) for details.

---

## Summary

| Topic | Details |
|-------|---------|
| **Multi-process architecture** | Separated into browser process, renderer process, GPU process, etc. Improves stability, security, and performance |
| **Key processes** | Browser (UI, network, storage management), Renderer (HTML/CSS/JS rendering, sandboxed), GPU (rendering acceleration) |
| **IPC (Inter-Process Communication)** | Mojo framework for inter-process messaging. Achieves type-safe, asynchronous communication |
| **Site Isolation** | Runs cross-site iframes in separate processes, protecting against Spectre attacks. Enhanced security with OOPIF and CORB |
| **Rendering pipeline** | 7 stages: HTML → DOM, CSS → CSSOM → Render Tree → Layout → Paint → Composite (GPU-driven) |
| **Optimization strategies** | Minimize layers, use will-change appropriately, offload to Web Workers, reduce main thread load with Time Slicing |

**Key points**:

1. **Process isolation is the key to security**: Sandboxing and Site Isolation prevent malicious content from affecting the system or other tabs
2. **Understanding the rendering pipeline is the first step to optimization**: Design with awareness of the Layout, Paint, and Composite stages to avoid unnecessary recalculations
3. **Modern browsers are GPU-driven**: Leveraging compositing layers and processing transform/opacity animations on the GPU makes 60 fps achievable

---

## Guides to Read Next

Once you understand the overall browser architecture, dive deeper into the actual web page loading process.

- **[Navigation and Loading](./01-navigation-and-loading.md)**: Detailed flow from URL entry to page display
  - DNS resolution, TCP/TLS connection, HTTP request/response
  - Navigation Timing API
  - Critical Rendering Path optimization techniques

Other related guides:
- **Rendering Engine Deep Dive**: Internal implementation of Blink/Gecko and rendering optimization
- **JavaScript Engine**: How V8/SpiderMonkey work and performance tuning

---

## References

1. **[Inside look at modern web browser (Google Developers)](https://developers.google.com/web/updates/2018/09/inside-browser-part1)**
   Official explanation of browser architecture by the Google Chrome team. A 4-part series covering the multi-process model through the rendering pipeline in detail.

2. **[The Chromium Projects - Multi-process Architecture](https://www.chromium.org/developers/design-documents/multi-process-architecture/)**
   Chromium design document. Describes the design philosophy and implementation details of the process model.

3. **[Life of a Pixel (Chromium)](https://docs.google.com/presentation/d/1boPxbgNrTU0ddsc144rcXayGA_WF53k96imRH8Mp34Y/edit)**
   Internal Chromium team presentation. Detailed explanation of how pixels are rendered to the screen.

4. **[Site Isolation Design Document](https://www.chromium.org/Home/chromium-security/site-isolation/)**
   Design document for Site Isolation. Details on OOPIF, CORB, and the security model.

5. **[Mojo Documentation (Chromium)](https://chromium.googlesource.com/chromium/src/+/master/mojo/README.md)**
   Mojo framework README. IPC (inter-process communication) implementation and API.

6. **[MDN Web Docs - How browsers work](https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work)**
   Mozilla Developer Network explanation of how browsers work. Easy to understand even for beginners.

7. **[Rendering Performance (Web Fundamentals)](https://developers.google.com/web/fundamentals/performance/rendering/)**
   Google Developers performance guide. Practical techniques for achieving 60 fps.
