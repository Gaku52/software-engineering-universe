# Animation Performance

> A systematic guide to achieving smooth 60fps animations. Gain a deep understanding of CSS Transitions/Animations, requestAnimationFrame, Web Animations API, the FLIP technique, and View Transitions API, and get a comprehensive picture of performance measurement and optimization.

## Prerequisites

- Understanding of paint and compositing → See: [Paint and Compositing](./02-paint-and-compositing.md)
- Basic syntax of CSS animations/transitions
- Concept of requestAnimationFrame

## What You Will Learn

- [ ] Understand the principles of 60fps animation and the frame budget
- [ ] Master the internal behavior and optimization techniques of CSS Transitions/Animations
- [ ] Grasp the correct usage and timing model of requestAnimationFrame
- [ ] Learn the principles and application patterns of the FLIP technique
- [ ] Understand the unified animation control provided by the Web Animations API
- [ ] Learn page transition animations with the View Transitions API
- [ ] Acquire performance measurement tools and debugging techniques
- [ ] Master animation design that accounts for accessibility

---

## 1. The 60fps Principle and Frame Budget

### 1.1 Why 60fps?

The human visual system perceives a sequence of images as "motion" at roughly 10fps or above. However, at least 24fps (the standard frame rate for film) is required to perceive smooth motion, and interactive UIs demand even higher frame rates.

Most displays have a refresh rate of 60Hz, meaning the screen is updated 60 times per second. If the browser cannot render frames in sync with this refresh rate, users will perceive "jank."

```
Frame rate vs. user experience:

  fps    Frame interval   User experience
  ─────────────────────────────────────────────────
  10fps    100.0ms      Slideshow-like impression
  24fps     41.7ms      Cinematic. Motion is perceivable but not ideal for UI
  30fps     33.3ms      Somewhat smooth. Lower bound for mobile games
  60fps     16.7ms      Sufficiently smooth. Standard target for web animations
  90fps     11.1ms      Very smooth. Minimum requirement for VR/AR
  120fps     8.3ms      Extremely smooth. ProMotion display support

  * Humans perceive jank when approximately 3 or more frames are dropped
```

### 1.2 Breakdown of 1 Frame at 16.67ms

The pipeline the browser executes to render one frame is as follows.

```
┌─────────────────────────────────────────────────────────────┐
│                   1 frame = 16.67ms                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Input        rAF         Style        Layout     Paint     │
│  Events    Callbacks    Recalc       (Reflow)   (Repaint)   │
│  ┌────┐    ┌────┐      ┌────┐       ┌────┐     ┌────┐     │
│  │ 1  │ →  │ 2  │  →   │ 3  │  →    │ 4  │  →  │ 5  │     │
│  │ ms │    │ ms │      │ ms │       │ ms │     │ ms │     │
│  └────┘    └────┘      └────┘       └────┘     └────┘     │
│                                                              │
│  → Composite (GPU) → Display                                │
│    ┌────┐                                                    │
│    │ 6  │  Merge compositing layers                          │
│    └────┘                                                    │
│                                                              │
│  Ideal: all steps complete within 16.67ms                    │
│  Practical: keep JS processing within 10ms for safety        │
└──────────────────────────────────────────────────────────────┘

Details of each step:
  1. Input Events     : Process touch, click, scroll, and other events
  2. rAF Callbacks    : Callbacks registered with requestAnimationFrame
  3. Style Recalc     : Recalculate CSS rules (selector matching, etc.)
  4. Layout (Reflow)  : Recalculate element positions and sizes
  5. Paint (Repaint)  : Generate pixel drawing commands
  6. Composite        : Merge and display GPU layers
```

### 1.3 Rendering Path and Property Relationships

Changes to CSS properties have very different performance impacts depending on which stage of the rendering pipeline they trigger.

```
Animated properties and rendering cost:

  Property           Layout  Paint  Composite  Cost
  ──────────────────────────────────────────────────
  transform            -       -       ✓        Lowest ★★★
  opacity              -       -       ✓        Lowest ★★★
  filter               -       ✓       ✓        Low    ★★☆
  background-color     -       ✓       ✓        Low    ★★☆
  box-shadow           -       ✓       ✓        Low    ★★☆
  color                -       ✓       ✓        Low    ★★☆
  border-radius        -       ✓       ✓        Low    ★★☆
  width / height       ✓       ✓       ✓        High   ★☆☆
  top / left           ✓       ✓       ✓        High   ★☆☆
  margin / padding     ✓       ✓       ✓        High   ★☆☆
  font-size            ✓       ✓       ✓        High   ★☆☆
  display              ✓       ✓       ✓        High   ★☆☆
  border-width         ✓       ✓       ✓        High   ★☆☆

  ★★★ = Composite only → Completed by GPU, no main thread required
  ★★☆ = Paint + Composite → Drawing commands generated on main thread
  ★☆☆ = Layout + Paint + Composite → Recalculation of all elements occurs
```

### 1.4 Layer Promotion with will-change

The `will-change` property lets you hint to the browser which properties will be animated. This allows the browser to promote elements to GPU layers in advance and prepare for compositing.

```css
/* Appropriate usage: apply just before animation */
.card:hover {
  will-change: transform;
}

.card.animating {
  will-change: transform, opacity;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}

/* Remove after animation completes */
.card.animating {
  /* Remove will-change via the transitionend event */
}
```

```javascript
// Example of properly managing will-change with JavaScript
const card = document.querySelector('.card');

card.addEventListener('mouseenter', () => {
  // Reserve layer promotion on hover
  card.style.willChange = 'transform, opacity';
});

card.addEventListener('transitionend', () => {
  // Release resources after animation completes
  card.style.willChange = 'auto';
});
```

```
Memory impact when using will-change:

  # Elements   Without will-change   With will-change   Memory increase
  ──────────────────────────────────────────────────────────
  10            baseline              +2-5MB             Minor
  100           baseline              +20-50MB           Caution
  1000          baseline              +200-500MB         Dangerous ⚠

  Important: apply will-change only when needed, only to the elements that need it.
  Persistent application consumes large amounts of GPU memory and is counterproductive.
```

---

## 2. Deep Understanding of CSS Transitions

### 2.1 Transition Internal Model

CSS Transitions automatically generate interpolated animations when a property value change is detected. The browser processes this internally with the following steps.

```
CSS Transition processing flow:

  1. Detect property value change
     ┌──────────────────────────────┐
     │ .box { left: 0; }           │
     │ .box:hover { left: 100px; } │  ← Value changed!
     └──────────────────────────────┘
                    │
                    ▼
  2. Check the transition declaration
     ┌──────────────────────────────────────────┐
     │ transition: left 300ms ease-out 0ms;      │
     │             ^^^^  ^^^^  ^^^^^^^^  ^^^     │
     │           property duration timing delay  │
     └──────────────────────────────────────────┘
                    │
                    ▼
  3. Calculate interpolated values and render frame by frame
     ┌─────────────────────────────────────┐
     │  t=0ms:    left: 0px               │
     │  t=50ms:   left: 28px  (ease-out)  │
     │  t=100ms:  left: 52px              │
     │  t=150ms:  left: 72px              │
     │  t=200ms:  left: 88px              │
     │  t=250ms:  left: 96px              │
     │  t=300ms:  left: 100px (complete)  │
     └─────────────────────────────────────┘
```

### 2.2 Detailed Syntax of the transition Property

```css
/* Specify individual properties */
.element {
  transition-property: transform, opacity, background-color;
  transition-duration: 300ms, 200ms, 150ms;
  transition-timing-function: ease-out, ease, linear;
  transition-delay: 0ms, 50ms, 100ms;
}

/* Shorthand */
.element {
  transition:
    transform 300ms ease-out 0ms,
    opacity 200ms ease 50ms,
    background-color 150ms linear 100ms;
}

/* Apply to all properties at once (use with caution) */
.element {
  transition: all 300ms ease-out;
  /* Unintended properties may also be animated */
  /* e.g., changes to font-size will also be animated */
}
```

### 2.3 Using Transition Events

```javascript
const element = document.querySelector('.animated');

// Fired when a transition starts (fires per property)
element.addEventListener('transitionstart', (e) => {
  console.log(`Started: ${e.propertyName}, time: ${e.elapsedTime}s`);
});

// Fired during the transition (once per iteration; usually once for transitions)
element.addEventListener('transitionrun', (e) => {
  console.log(`Running: ${e.propertyName}`);
});

// Fired when a transition completes
element.addEventListener('transitionend', (e) => {
  console.log(`Completed: ${e.propertyName}, time: ${e.elapsedTime}s`);
  // Cleanup after completion
  element.classList.remove('animating');
  element.style.willChange = 'auto';
});

// Fired when a transition is cancelled (if the value changes mid-transition)
element.addEventListener('transitioncancel', (e) => {
  console.log(`Cancelled: ${e.propertyName}`);
});
```

### 2.4 Staging Animation with Multiple Properties

```css
/* Card entry animation: display elements in stages */
.card {
  opacity: 0;
  transform: translateY(30px);
}

.card.visible {
  opacity: 1;
  transform: translateY(0);
  /* opacity completes first, then transform completes */
  transition:
    opacity 200ms ease-out 0ms,
    transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1) 50ms;
}

/* Chained animation for list items */
.list-item {
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

.list-item.visible {
  opacity: 1;
  transform: translateX(0);
}

/* Stagger delay using CSS custom properties */
.list-item:nth-child(1) { transition-delay: calc(0 * 50ms); }
.list-item:nth-child(2) { transition-delay: calc(1 * 50ms); }
.list-item:nth-child(3) { transition-delay: calc(2 * 50ms); }
.list-item:nth-child(4) { transition-delay: calc(3 * 50ms); }
.list-item:nth-child(5) { transition-delay: calc(4 * 50ms); }

/* Or set inline with a CSS custom property */
.list-item {
  transition-delay: calc(var(--index) * 50ms);
}
```

```javascript
// Set stagger delay with JavaScript
const items = document.querySelectorAll('.list-item');
items.forEach((item, index) => {
  item.style.setProperty('--index', index);
});

// Animate when entering the viewport using IntersectionObserver
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 }
);

items.forEach((item) => observer.observe(item));
```

---

## 3. Advanced Use of CSS Animations

### 3.1 @keyframes Interpolation Model

CSS Animations generate animations by interpolating between keyframes defined in `@keyframes` rules. Unlike Transitions which transition between two states, Animations can define any number of intermediate states.

```css
/* Basic keyframe definition */
@keyframes slideInFromLeft {
  0% {
    transform: translateX(-100%);
    opacity: 0;
  }
  60% {
    transform: translateX(10%);
    opacity: 1;
  }
  80% {
    transform: translateX(-5%);
  }
  100% {
    transform: translateX(0);
  }
}

.panel {
  animation: slideInFromLeft 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

/* Combining multiple animations */
@keyframes scaleUp {
  from { transform: scale(0.8); }
  to { transform: scale(1); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  animation:
    scaleUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
    fadeIn 200ms ease-out forwards;
}
```

### 3.2 Behavior of animation-fill-mode

```
Comparison of animation-fill-mode behavior:

  ──────── Delay period ──── Animation period ──── After completion ────

  none:
  [ Initial value      ][ 0% → → → → → 100% ][ Initial value      ]
                          ^^^^^^^^^^^^^^^^^^
                          Changes only during animation

  forwards:
  [ Initial value      ][ 0% → → → → → 100% ][ Retains 100% value  ]
                                              ^^^^^^^^^^^^^^^^^
                                              Locked at final frame

  backwards:
  [ 0% value applied   ][ 0% → → → → → 100% ][ Initial value      ]
   ^^^^^^^^^^^^^^^^^
   Start frame is applied during delay

  both:
  [ 0% value applied   ][ 0% → → → → → 100% ][ Retains 100% value  ]
   ^^^^^^^^^^^^^^^^^                          ^^^^^^^^^^^^^^^^^
   Applied during delay and after completion
```

```css
/* Practical example: modal show/hide */
@keyframes modalOpen {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes modalClose {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
}

.modal.opening {
  animation: modalOpen 300ms ease-out forwards;
}

.modal.closing {
  animation: modalClose 200ms ease-in forwards;
}
```

### 3.3 animation-composition: Accumulation and Compositing

```css
/* animation-composition allows animation effects to accumulate */
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

@keyframes wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

.icon {
  /* replace: later animations replace earlier ones (default) */
  animation-composition: replace;

  /* add: transforms are added */
  animation-composition: add;

  /* accumulate: values are accumulated */
  animation-composition: accumulate;
}
```

### 3.4 Scroll-driven Animations

CSS Scroll-driven Animations is a new CSS spec that uses the scroll position as an animation timeline.

```css
/* Scroll progress indicator */
@keyframes progressBar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: #3b82f6;
  transform-origin: left;
  animation: progressBar linear;
  animation-timeline: scroll(root block);
}

/* Animation when element enters the viewport */
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal-on-scroll {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

/* Parallax effect */
@keyframes parallax {
  from { transform: translateY(100px); }
  to { transform: translateY(-100px); }
}

.parallax-layer {
  animation: parallax linear;
  animation-timeline: scroll(root);
}
```

```
Differences between Scroll Timeline and View Timeline:

  scroll()                          view()
  ──────────────────────────────    ──────────────────────────────
  Linked to the scroll position     Linked to the progress of an
  of the entire scroll container    element crossing the viewport

  ┌──────────────────┐              ┌──────────────────┐
  │   scroll: 0%     │              │                  │
  │   ┌────────────┐ │              │  ← entry 0%     │
  │   │ Content    │ │              │  ┌────────────┐ │
  │   │            │ │              │  │ Element    │ │ entry 100%
  │   │            │ │              │  │            │ │
  │   └────────────┘ │              │  │            │ │ exit 0%
  │   scroll: 100%   │              │  └────────────┘ │
  └──────────────────┘              │  ← exit 100%   │
                                    └──────────────────┘

  animation-range values:
    entry 0%   : leading edge of element reaches bottom of viewport
    entry 100% : trailing edge of element passes bottom of viewport
    exit 0%    : leading edge of element reaches top of viewport
    exit 100%  : trailing edge of element passes top of viewport
```

---

## 4. Thorough Understanding of requestAnimationFrame

### 4.1 rAF Timing Model

`requestAnimationFrame` (rAF) is a mechanism that executes callbacks in sync with the browser's rendering cycle. Unlike `setInterval` or `setTimeout`, it is called at an optimal timing aligned with the display's refresh rate.

```
rAF timing (for 60Hz display):

  Time axis (ms)
  0        16.67     33.33     50.00     66.67
  │         │         │         │         │
  ▼         ▼         ▼         ▼         ▼
  ┌─────────┬─────────┬─────────┬─────────┐
  │ Frame 1 │ Frame 2 │ Frame 3 │ Frame 4 │
  │ rAF(cb) │ rAF(cb) │ rAF(cb) │ rAF(cb) │
  └─────────┴─────────┴─────────┴─────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
    cb(0)     cb(16.67)  cb(33.33)  cb(50.00)
              timestamp  timestamp  timestamp

  Comparison with setInterval(fn, 16):
  ┌─────────┬─────────┬─────────┬─────────┐
  │         │   ↑ drift │     ↑ drift      │
  │ Frame 1 │ Frame 2 │ Frame 3 │ Frame 4 │
  │ fn()    │   fn()  │ fn() fn │ fn()    │
  └─────────┴─────────┴─────────┴─────────┘
  * setInterval drifts from frames and may fire twice in one frame
    or be skipped entirely
```

### 4.2 Basic rAF Animation Patterns

```javascript
// Pattern 1: Basic animation loop
function basicAnimation() {
  let x = 0;
  const element = document.querySelector('.box');

  function animate() {
    x += 2;
    element.style.transform = `translateX(${x}px)`;

    if (x < 300) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

// Pattern 2: Timestamp-based (recommended)
function timestampAnimation() {
  const element = document.querySelector('.box');
  const duration = 1000; // 1 second
  const distance = 300;  // Move 300px
  let startTime = null;

  function animate(timestamp) {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Apply easing function
    const eased = easeOutCubic(progress);
    element.style.transform = `translateX(${eased * distance}px)`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

// Pattern 3: Cancellable animation
function cancellableAnimation() {
  const element = document.querySelector('.box');
  let animationId = null;
  let startTime = null;
  const duration = 2000;

  function animate(timestamp) {
    if (startTime === null) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);

    element.style.transform = `translateX(${progress * 300}px)`;

    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    }
  }

  // Start
  animationId = requestAnimationFrame(animate);

  // Stop (can be called at any time)
  function stop() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  return { stop };
}
```

### 4.3 Easing Function Library

```javascript
// Collection of basic easing functions
const Easing = {
  // Linear
  linear: (t) => t,

  // Quad (quadratic curve)
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic (cubic curve)
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  // Elastic
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 :
      Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  // Bounce
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },

  // Back (pullback)
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  // Spring
  spring: (t) => {
    return 1 - (Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6));
  }
};

// Usage example
function springAnimation(element, fromX, toX, duration) {
  let startTime = null;

  function animate(timestamp) {
    if (startTime === null) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = Easing.spring(progress);
    const x = fromX + (toX - fromX) * eased;

    element.style.transform = `translateX(${x}px)`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}
```

### 4.4 rAF Batch Processing and Scheduling

```javascript
// Scheduler that efficiently batch-processes multiple animations
class AnimationScheduler {
  constructor() {
    this.animations = new Map();
    this.isRunning = false;
    this.frameId = null;
  }

  add(id, updateFn) {
    this.animations.set(id, updateFn);
    if (!this.isRunning) {
      this.start();
    }
  }

  remove(id) {
    this.animations.delete(id);
    if (this.animations.size === 0) {
      this.stop();
    }
  }

  start() {
    this.isRunning = true;
    const tick = (timestamp) => {
      // Batch-process all animations within one frame
      for (const [id, updateFn] of this.animations) {
        const shouldContinue = updateFn(timestamp);
        if (!shouldContinue) {
          this.animations.delete(id);
        }
      }

      if (this.animations.size > 0) {
        this.frameId = requestAnimationFrame(tick);
      } else {
        this.isRunning = false;
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.isRunning = false;
    this.animations.clear();
  }
}

// Usage example
const scheduler = new AnimationScheduler();

// Register animations for multiple elements
document.querySelectorAll('.particle').forEach((el, i) => {
  let startTime = null;
  scheduler.add(`particle-${i}`, (timestamp) => {
    if (startTime === null) startTime = timestamp;
    const progress = (timestamp - startTime) / 2000;
    if (progress >= 1) return false; // Animation complete

    const x = Math.sin(progress * Math.PI * 2 + i) * 100;
    const y = Math.cos(progress * Math.PI * 2 + i) * 100;
    el.style.transform = `translate(${x}px, ${y}px)`;
    return true; // Continue
  });
});
```

---

## 5. Principles and Applications of the FLIP Technique

### 5.1 The FLIP Concept

FLIP stands for "First, Last, Invert, Play" — a technique proposed by Paul Lewis. It converts layout-changing animations (element movement, resizing, etc.) into performant `transform` animations.

```
The 4 steps of the FLIP technique:

  Step 1: First (record)
  ┌────────────────────────┐
  │  ┌──┐                  │  Record current position and size
  │  │A │  x=10, y=20      │  using getBoundingClientRect()
  │  └──┘  w=100, h=50     │
  └────────────────────────┘

  Step 2: Last (apply change)
  ┌────────────────────────┐
  │            ┌──────┐    │  Apply DOM change and
  │            │  A   │    │  get final position
  │            └──────┘    │  x=200, y=100
  └────────────────────────┘  w=150, h=75

  Step 3: Invert (reverse transform)
  ┌────────────────────────┐
  │  ┌──┐                  │  Use transform to move back to original position
  │  │A │  ← transform to  │  deltaX = 10 - 200 = -190
  │  └──┘    original pos  │  deltaY = 20 - 100 = -80
  └────────────────────────┘  scaleX = 100/150, scaleY = 50/75

  Step 4: Play
  ┌────────────────────────┐
  │  ┌──┐  →  →  ┌──────┐ │  Remove transform and
  │  │A │  →  →  │  A   │ │  animate naturally with
  │  └──┘  →  →  └──────┘ │  CSS Transition
  └────────────────────────┘
```

### 5.2 General-Purpose FLIP Helper Function

```javascript
/**
 * General-purpose FLIP animation function
 * @param {HTMLElement} element - Target element to animate
 * @param {Function} changeFn - Function that performs the DOM change
 * @param {Object} options - Animation options
 */
function flipAnimate(element, changeFn, options = {}) {
  const {
    duration = 300,
    easing = 'cubic-bezier(0.2, 0, 0.2, 1)',
    onComplete = null,
    scaleCorrection = true
  } = options;

  // First: record current position and size
  const first = element.getBoundingClientRect();

  // Last: apply DOM change and get final position
  changeFn();
  const last = element.getBoundingClientRect();

  // Calculate deltas
  const deltaX = first.left - last.left;
  const deltaY = first.top - last.top;
  const scaleX = first.width / last.width;
  const scaleY = first.height / last.height;

  // Skip if there is no change
  if (deltaX === 0 && deltaY === 0 && scaleX === 1 && scaleY === 1) {
    if (onComplete) onComplete();
    return;
  }

  // Invert: use transform to move back to the original position
  const transform = scaleCorrection
    ? `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
    : `translate(${deltaX}px, ${deltaY}px)`;

  element.style.transform = transform;
  element.style.transformOrigin = 'top left';

  // Force the browser to recognize the Invert state
  // Reading getComputedStyle().transform forces recalculation
  void element.offsetHeight;

  // Play: remove transform and animate
  element.style.transition = `transform ${duration}ms ${easing}`;
  element.style.transform = '';

  // Cleanup after completion
  function handleTransitionEnd(e) {
    if (e.propertyName !== 'transform') return;
    element.removeEventListener('transitionend', handleTransitionEnd);
    element.style.transition = '';
    element.style.transformOrigin = '';
    if (onComplete) onComplete();
  }

  element.addEventListener('transitionend', handleTransitionEnd);
}

// Usage example: sort animation for a list
function sortListWithFlip(container, compareFn) {
  const items = Array.from(container.children);

  // First: record the position of every element
  const firstRects = new Map();
  items.forEach(item => {
    firstRects.set(item, item.getBoundingClientRect());
  });

  // Last: apply sort
  items.sort(compareFn);
  items.forEach(item => container.appendChild(item));

  // Apply FLIP to each element
  items.forEach(item => {
    const first = firstRects.get(item);
    const last = item.getBoundingClientRect();

    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;

    if (deltaX === 0 && deltaY === 0) return;

    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    requestAnimationFrame(() => {
      item.style.transition = 'transform 300ms ease-out';
      item.style.transform = '';

      item.addEventListener('transitionend', () => {
        item.style.transition = '';
      }, { once: true });
    });
  });
}
```

### 5.3 Adding and Removing List Items with FLIP

```javascript
// Add list item animation
function addItemWithFlip(container, newElement, referenceNode = null) {
  // First: record positions of existing elements
  const existingItems = Array.from(container.children);
  const firstRects = new Map();
  existingItems.forEach(item => {
    firstRects.set(item, item.getBoundingClientRect());
  });

  // Last: insert new element
  if (referenceNode) {
    container.insertBefore(newElement, referenceNode);
  } else {
    container.appendChild(newElement);
  }

  // Animation for the new element
  newElement.style.opacity = '0';
  newElement.style.transform = 'scale(0.8)';

  requestAnimationFrame(() => {
    newElement.style.transition = 'opacity 200ms ease-out, transform 200ms ease-out';
    newElement.style.opacity = '1';
    newElement.style.transform = 'scale(1)';
  });

  // FLIP animation for existing elements
  existingItems.forEach(item => {
    const first = firstRects.get(item);
    const last = item.getBoundingClientRect();
    const deltaY = first.top - last.top;

    if (deltaY === 0) return;

    item.style.transform = `translateY(${deltaY}px)`;

    requestAnimationFrame(() => {
      item.style.transition = 'transform 300ms ease-out';
      item.style.transform = '';
      item.addEventListener('transitionend', () => {
        item.style.transition = '';
      }, { once: true });
    });
  });
}

// Remove list item animation
function removeItemWithFlip(container, targetElement) {
  // First: record positions of all elements
  const items = Array.from(container.children);
  const firstRects = new Map();
  items.forEach(item => {
    firstRects.set(item, item.getBoundingClientRect());
  });

  // Fade out the element to remove
  targetElement.style.transition = 'opacity 150ms ease-in, transform 150ms ease-in';
  targetElement.style.opacity = '0';
  targetElement.style.transform = 'scale(0.8)';

  targetElement.addEventListener('transitionend', () => {
    // Remove the element
    container.removeChild(targetElement);

    // Apply FLIP to the remaining elements
    items.filter(item => item !== targetElement).forEach(item => {
      const first = firstRects.get(item);
      const last = item.getBoundingClientRect();
      const deltaY = first.top - last.top;

      if (deltaY === 0) return;

      item.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        item.style.transition = 'transform 300ms ease-out';
        item.style.transform = '';
        item.addEventListener('transitionend', () => {
          item.style.transition = '';
        }, { once: true });
      });
    });
  }, { once: true });
}
```

---

## 6. Web Animations API (WAAPI)

### 6.1 Overview and Advantages of WAAPI

The Web Animations API lets you directly manipulate the animation model that underlies CSS Animations and CSS Transitions from JavaScript. It maintains the performance characteristics of CSS-based animations while enabling dynamic control from JavaScript.

```
CSS Animation vs rAF vs WAAPI comparison:

  Feature               CSS Animation    rAF          WAAPI
  ──────────────────────────────────────────────────────────
  Declarative            ✓               -            -
  Programmatic control   △               ✓            ✓
  Performance            High (GPU)       Medium (CPU) High (GPU)
  Pause/resume           △               Manual       ✓ (built-in)
  Reverse playback       -               Manual       ✓ (built-in)
  Completion Promise     -               Manual       ✓ (built-in)
  Playback rate change   -               Manual       ✓ (built-in)
  Timeline sync          ✓ (CSS)          -            ✓ (JS)
  Multi-element sync     △               Manual       ✓ (GroupEffect)
  Dynamic keyframe change -              ✓            ✓
  Browser compatibility  Wide             Wide         Wide (2024+)
```

### 6.2 Basic WAAPI Usage

```javascript
// Basic animation with Element.animate()
const element = document.querySelector('.box');

const animation = element.animate(
  // Keyframe array
  [
    { transform: 'translateX(0)', opacity: 1 },
    { transform: 'translateX(300px)', opacity: 0.5 },
    { transform: 'translateX(300px) rotate(180deg)', opacity: 1 }
  ],
  // Timing options
  {
    duration: 1000,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    iterations: 1,
    fill: 'forwards',
    delay: 0
  }
);

// Controlling the animation
animation.pause();           // Pause
animation.play();            // Play
animation.reverse();         // Reverse
animation.cancel();          // Cancel
animation.finish();          // Jump to end immediately

// Change playback rate
animation.playbackRate = 2;  // 2x speed
animation.playbackRate = 0.5; // Half speed
animation.playbackRate = -1;  // Reverse

// Get/set current progress
console.log(animation.currentTime);  // Elapsed time in ms
animation.currentTime = 500;         // Seek to 500ms

// Promise for completion
animation.finished.then(() => {
  console.log('Animation complete');
  element.classList.add('final-state');
});

// async/await pattern
async function animateSequence() {
  const el = document.querySelector('.box');

  await el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }],
    { duration: 200, fill: 'forwards' }
  ).finished;

  await el.animate(
    [{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
    { duration: 150, fill: 'forwards' }
  ).finished;

  console.log('All animations complete');
}
```

### 6.3 Staged Animation with WAAPI

```javascript
// Chained animation for multiple elements
function staggeredReveal(elements, options = {}) {
  const {
    duration = 400,
    stagger = 50,
    easing = 'cubic-bezier(0.22, 1, 0.36, 1)',
    distance = 30
  } = options;

  const animations = Array.from(elements).map((el, index) => {
    return el.animate(
      [
        {
          opacity: 0,
          transform: `translateY(${distance}px)`
        },
        {
          opacity: 1,
          transform: 'translateY(0)'
        }
      ],
      {
        duration,
        easing,
        delay: index * stagger,
        fill: 'both'
      }
    );
  });

  // Wait for all animations to complete
  return Promise.all(animations.map(a => a.finished));
}

// Usage example
const cards = document.querySelectorAll('.card');
staggeredReveal(cards, { stagger: 80, distance: 40 }).then(() => {
  console.log('All card reveal animations complete');
});
```

### 6.4 WAAPI Keyframe Notation

```javascript
// Notation 1: Array form (each frame as a separate object)
element.animate([
  { transform: 'rotate(0deg)', offset: 0 },
  { transform: 'rotate(360deg)', offset: 0.7 },
  { transform: 'rotate(360deg) scale(1.2)', offset: 0.85 },
  { transform: 'rotate(360deg) scale(1)', offset: 1 }
], { duration: 800 });

// Notation 2: Object form (array of values per property)
element.animate({
  transform: [
    'translateX(0)',
    'translateX(200px)',
    'translateX(200px) rotate(90deg)',
    'translateX(0) rotate(0deg)'
  ],
  opacity: [1, 0.8, 0.6, 1],
  offset: [0, 0.3, 0.7, 1],
  easing: ['ease-in', 'ease-out', 'ease-in-out']
}, { duration: 1200, iterations: Infinity });

// Compositing animations with the composite option
const baseAnimation = element.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(200px)' }],
  { duration: 2000, iterations: Infinity, composite: 'replace' }
);

const additiveAnimation = element.animate(
  [{ transform: 'translateY(0)' }, { transform: 'translateY(50px)' }],
  { duration: 1000, iterations: Infinity, composite: 'add' }
);
// Result: X-direction and Y-direction movements are composited
```

---

## 7. View Transitions API

### 7.1 View Transitions within the Same Document

The View Transitions API automatically captures snapshots of the DOM before and after a change, enabling transition animations such as cross-fades and slides. It provides a browser-native equivalent of the FLIP concept.

```javascript
// Basic View Transition
async function updateContent(newContent) {
  // startViewTransition accepts a DOM change as its argument
  const transition = document.startViewTransition(() => {
    document.querySelector('.content').innerHTML = newContent;
  });

  // Optionally wait for the transition to complete
  await transition.finished;
  console.log('View Transition complete');
}

// View Transition lifecycle
const transition = document.startViewTransition(async () => {
  // Perform DOM changes inside this function
  await fetchAndUpdateDOM();
});

// Promises for each phase
transition.ready.then(() => {
  // Pseudo-element tree is built, just before animation starts
  console.log('Animation ready');
});

transition.updateCallbackDone.then(() => {
  // DOM update callback has completed
  console.log('DOM update complete');
});

transition.finished.then(() => {
  // All animations have completed
  console.log('View Transition complete');
});
```

### 7.2 CSS Control of View Transitions

```css
/* Customize the default cross-fade */
::view-transition-old(root) {
  animation-duration: 250ms;
  animation-timing-function: ease-in;
}

::view-transition-new(root) {
  animation-duration: 250ms;
  animation-timing-function: ease-out;
}

/* Name specific elements for individual control */
.hero-image {
  view-transition-name: hero;
}

.page-title {
  view-transition-name: title;
}

/* Customize animations for named elements */
::view-transition-old(hero) {
  animation: slideOutLeft 300ms ease-in forwards;
}

::view-transition-new(hero) {
  animation: slideInRight 300ms ease-out forwards;
}

::view-transition-group(title) {
  animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes slideOutLeft {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

```
View Transition pseudo-element tree:

  ::view-transition
  ├── ::view-transition-group(root)
  │   ├── ::view-transition-image-pair(root)
  │   │   ├── ::view-transition-old(root)    ← Snapshot before change
  │   │   └── ::view-transition-new(root)    ← Snapshot after change
  │   │
  ├── ::view-transition-group(hero)
  │   ├── ::view-transition-image-pair(hero)
  │   │   ├── ::view-transition-old(hero)
  │   │   └── ::view-transition-new(hero)
  │   │
  └── ::view-transition-group(title)
      ├── ::view-transition-image-pair(title)
      │   ├── ::view-transition-old(title)
      │   └── ::view-transition-new(title)

  Each group can be animated independently
  By default, all elements cross-fade
  Use view-transition-name for individual control
```

### 7.3 View Transitions in MPA (Multi-Page Application)

```html
<!-- View Transitions for page-to-page navigation -->
<!-- Add to the head of Page A -->
<meta name="view-transition" content="same-origin" />

<!-- Add to the head of Page B as well -->
<meta name="view-transition" content="same-origin" />
```

```css
/* Give the same name to shared elements across pages */
/* Page A */
.product-image-123 {
  view-transition-name: product-123;
}

/* Page B */
.product-detail-image {
  view-transition-name: product-123;
}

/* Animation based on navigation direction */
@view-transition {
  navigation: auto;
}

/* Forward navigation animation */
::view-transition-old(root) {
  animation: slide-out-to-left 300ms ease-in;
}
::view-transition-new(root) {
  animation: slide-in-from-right 300ms ease-out;
}

/* Detect backward direction using Navigation API */
@keyframes slide-out-to-left {
  to { transform: translateX(-30%); opacity: 0; }
}

@keyframes slide-in-from-right {
  from { transform: translateX(30%); opacity: 0; }
}
```

---

## 8. Performance Measurement and Debugging

### 8.1 Animation Analysis with Chrome DevTools

```
Reading the DevTools Performance panel:

  ┌────────────────────────────────────────────────────────┐
  │ FPS graph                                               │
  │ ████████████████████████ ██ ███████████████████████████ │
  │ 60fps                   ↑ drop                         │
  │                         Jank occurs here               │
  ├────────────────────────────────────────────────────────┤
  │ Main thread                                             │
  │ ┌──────┐ ┌──┐ ┌────────────────────┐ ┌──────┐        │
  │ │ Task │ │rAF│ │   Long Task        │ │ Task │        │
  │ │ 3ms  │ │2ms│ │   52ms (> 50ms)   │ │ 4ms  │        │
  │ └──────┘ └──┘ └────────────────────┘ └──────┘        │
  │                 ↑ This is the cause of jank            │
  ├────────────────────────────────────────────────────────┤
  │ GPU thread                                              │
  │ ┌─────┐     ┌─────┐     ┌─────┐     ┌─────┐          │
  │ │Comp │     │Comp │     │Comp │     │Comp │          │
  │ │ 2ms │     │ 2ms │     │ 8ms │     │ 2ms │          │
  │ └─────┘     └─────┘     └─────┘     └─────┘          │
  └────────────────────────────────────────────────────────┘

  Key points to check:
  1. Red triangle markers → Location of Long Tasks (50ms or more)
  2. Valleys in the FPS graph → Location of frame drops
  3. Layout / Paint occurrences → Unnecessary reflow/repaint
  4. Forced Reflow warning → Suspected layout thrashing
```

### 8.2 Programmatic Measurement with the Performance API

```javascript
// Frame rate measurement
class FPSMonitor {
  constructor() {
    this.frames = [];
    this.isRunning = false;
  }

  start() {
    this.isRunning = true;
    this.frames = [];
    this.lastTime = performance.now();
    this.tick();
  }

  tick() {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.frames.push({
      timestamp: now,
      frameDuration: delta,
      fps: 1000 / delta
    });

    // Keep only the most recent 60 frames
    if (this.frames.length > 60) {
      this.frames.shift();
    }

    requestAnimationFrame(() => this.tick());
  }

  stop() {
    this.isRunning = false;
  }

  getAverageFPS() {
    if (this.frames.length === 0) return 0;
    const totalFPS = this.frames.reduce((sum, f) => sum + f.fps, 0);
    return totalFPS / this.frames.length;
  }

  getDroppedFrames() {
    // Frames over 16.67ms * 1.5 = 25ms are considered dropped
    return this.frames.filter(f => f.frameDuration > 25).length;
  }

  getReport() {
    const durations = this.frames.map(f => f.frameDuration);
    return {
      averageFPS: this.getAverageFPS().toFixed(1),
      droppedFrames: this.getDroppedFrames(),
      totalFrames: this.frames.length,
      maxFrameDuration: Math.max(...durations).toFixed(1),
      minFrameDuration: Math.min(...durations).toFixed(1),
      p95FrameDuration: this.percentile(durations, 95).toFixed(1)
    };
  }

  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p / 100) - 1;
    return sorted[index];
  }
}

// Usage example
const monitor = new FPSMonitor();
monitor.start();

// Run animation...

setTimeout(() => {
  monitor.stop();
  console.table(monitor.getReport());
}, 3000);
```

### 8.3 Detecting Long Tasks with PerformanceObserver

```javascript
// Detect and log Long Tasks
const longTaskObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.warn(
      `Long Task detected: ${entry.duration.toFixed(1)}ms`,
      `Name: ${entry.name}`,
      `Start: ${entry.startTime.toFixed(1)}ms`
    );

    // Tasks over 50ms may affect animations
    if (entry.duration > 100) {
      console.error(
        `Critical Long Task: ${entry.duration.toFixed(1)}ms - ` +
        `approximately ${Math.floor(entry.duration / 16.67)} frames of jank`
      );
    }
  }
});

longTaskObserver.observe({ type: 'longtask', buffered: true });

// Detect Layout Shift
const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      console.warn(`Layout Shift: ${entry.value.toFixed(4)}`, entry.sources);
    }
  }
});

clsObserver.observe({ type: 'layout-shift', buffered: true });
```

### 8.4 Visualizing Frame Timing

```javascript
// Display an overlay of animation frame timing
class FrameTimingOverlay {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 200;
    this.canvas.height = 80;
    this.canvas.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 99999;
      background: rgba(0,0,0,0.7); border-radius: 4px;
      pointer-events: none;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.frameTimes = [];
    this.lastTime = 0;
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 100) this.frameTimes.shift();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // FPS text
    const fps = this.frameTimes.length > 0
      ? (1000 / (this.frameTimes.reduce((a, b) => a + b) / this.frameTimes.length))
      : 0;
    ctx.fillStyle = fps >= 55 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#ef4444';
    ctx.font = '14px monospace';
    ctx.fillText(`${fps.toFixed(0)} FPS`, 10, 18);

    // Bar graph
    const barWidth = (canvas.width - 20) / this.frameTimes.length;
    this.frameTimes.forEach((dt, i) => {
      const height = Math.min(dt / 33.33 * 40, 50);
      const x = 10 + i * barWidth;
      const y = canvas.height - 10 - height;

      ctx.fillStyle = dt <= 16.67 ? '#4ade80' :
                      dt <= 25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(x, y, Math.max(barWidth - 1, 1), height);
    });

    // 16.67ms line
    const lineY = canvas.height - 10 - (16.67 / 33.33 * 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(10, lineY);
    ctx.lineTo(canvas.width - 10, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  stop() {
    this.running = false;
    this.canvas.remove();
  }
}
```

---

## 9. prefers-reduced-motion and Accessibility

### 9.1 Motion Sickness and Accessibility

Users with vestibular disorders may experience headaches, dizziness, and nausea from motion on screen. The `prefers-reduced-motion` media query allows you to reduce animations for these users.

```css
/* Approach 1: Remove motion entirely */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Approach 2: Selectively control types of motion (recommended) */
@media (prefers-reduced-motion: reduce) {
  /* Remove movement, rotation, and scaling */
  .animated-element {
    transform: none !important;
    transition: opacity 200ms ease-out;
  }

  /* Keep fade effects (less problematic since they aren't motion) */
  .fade-in {
    transition: opacity 200ms ease-out;
  }

  /* Remove scroll-driven animations */
  .scroll-animation {
    animation: none !important;
  }
}

/* Approach 3: Opt-in rather than motion-first */
/* Base: no animation */
.card {
  /* Static styles only */
}

/* Apply animation only for users who permit motion */
@media (prefers-reduced-motion: no-preference) {
  .card {
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }

  .card:hover {
    transform: translateY(-4px);
  }
}
```

### 9.2 Detecting prefers-reduced-motion with JavaScript

```javascript
// Detect the state of the media query
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
);

// Get the initial value
if (prefersReducedMotion.matches) {
  console.log('User has requested reduced motion');
}

// Watch for changes to the setting
prefersReducedMotion.addEventListener('change', (event) => {
  if (event.matches) {
    // Switched to reduced motion → stop animations
    stopAllAnimations();
  } else {
    // Reduced motion was turned off → enable animations
    enableAnimations();
  }
});

// Build reduced motion awareness into your animation function
function animateElement(element, keyframes, options) {
  if (prefersReducedMotion.matches) {
    // With reduced motion: apply the final state immediately
    const lastKeyframe = keyframes[keyframes.length - 1];
    Object.assign(element.style, lastKeyframe);
    return { finished: Promise.resolve() };
  }

  return element.animate(keyframes, options);
}

// Example custom hook for frameworks (React-style pseudocode)
function useReducedMotion() {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  let matches = query.matches;

  query.addEventListener('change', (e) => {
    matches = e.matches;
    // Trigger state update
  });

  return matches;
}
```

---

## 10. Animation Design Patterns

### 10.1 Micro-interactions

```css
/* Button press feedback */
.button {
  transform: scale(1);
  transition: transform 100ms ease-out;
}

.button:active {
  transform: scale(0.96);
  transition-duration: 50ms;
}

/* Toggle switch */
.toggle-track {
  width: 48px;
  height: 24px;
  border-radius: 12px;
  background: #d1d5db;
  transition: background-color 200ms ease;
  position: relative;
}

.toggle-track.active {
  background: #3b82f6;
}

.toggle-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-track.active .toggle-thumb {
  transform: translateX(24px);
}

/* Skeleton screen shimmer effect */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

/* Loading spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

### 10.2 Page Transition Patterns

```javascript
// Slide transition (for SPA)
async function slideTransition(direction, updateFn) {
  if (!document.startViewTransition) {
    // Fallback for browsers without View Transitions API
    updateFn();
    return;
  }

  // Set CSS class based on direction
  document.documentElement.dataset.transition = direction;

  const transition = document.startViewTransition(async () => {
    await updateFn();
  });

  await transition.finished;
  delete document.documentElement.dataset.transition;
}
```

```css
/* Control slide direction */
[data-transition="forward"] ::view-transition-old(root) {
  animation: slide-out-left 300ms ease-in forwards;
}

[data-transition="forward"] ::view-transition-new(root) {
  animation: slide-in-right 300ms ease-out forwards;
}

[data-transition="back"] ::view-transition-old(root) {
  animation: slide-out-right 300ms ease-in forwards;
}

[data-transition="back"] ::view-transition-new(root) {
  animation: slide-in-left 300ms ease-out forwards;
}

@keyframes slide-out-left {
  to { transform: translateX(-30%); opacity: 0; }
}
@keyframes slide-in-right {
  from { transform: translateX(30%); opacity: 0; }
}
@keyframes slide-out-right {
  to { transform: translateX(30%); opacity: 0; }
}
@keyframes slide-in-left {
  from { transform: translateX(-30%); opacity: 0; }
}
```

---

## 11. Anti-patterns and Mitigations

### 11.1 Anti-pattern 1: Layout Thrashing

Layout thrashing occurs when DOM reads and DOM writes are alternated, forcing the browser to recalculate layout after every write. This is one of the most common causes of significantly exceeding the frame budget during animations.

```javascript
// ---- Bad example: layout thrashing ----
function badResizeItems(items) {
  items.forEach((item) => {
    // Read → forces layout!
    const height = item.offsetHeight;
    // Write → invalidates layout
    item.style.height = (height * 1.2) + 'px';
    // Next iteration's read forces layout again...
  });
  // N elements means N forced layout calculations
}

// ---- Good example: separate reads and writes ----
function goodResizeItems(items) {
  // Phase 1: batch all reads together
  const heights = items.map((item) => item.offsetHeight);

  // Phase 2: batch all writes together (layout recalculated only once)
  items.forEach((item, i) => {
    item.style.height = (heights[i] * 1.2) + 'px';
  });
}
```

```
Impact of layout thrashing:

  Bad example (alternating reads and writes):
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
  │Read││Write│Read││Write│Read││Write│Read││Write│
  │    ││+   ││    ││+   ││    ││+   ││    ││+   │
  │    ││Lay ││    ││Lay ││    ││Lay ││    ││Lay │
  └────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘
  Total: 4 layout calculations (forced after each Write)

  Good example (batch reads):
  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────────┐
  │Read││Read││Read││Read││Write│Write│Write│Write│+Layout│
  └────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└──────┘
  Total: 1 layout calculation (only once at frame render time)
```

```javascript
// Pattern similar to fastdom library to separate reads and writes
class DOMBatcher {
  constructor() {
    this.reads = [];
    this.writes = [];
    this.scheduled = false;
  }

  read(fn) {
    this.reads.push(fn);
    this.schedule();
  }

  write(fn) {
    this.writes.push(fn);
    this.schedule();
  }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;

    requestAnimationFrame(() => {
      // Execute all reads first
      const readResults = this.reads.map((fn) => fn());
      this.reads = [];

      // Then execute all writes
      this.writes.forEach((fn) => fn());
      this.writes = [];

      this.scheduled = false;
    });
  }
}

const batcher = new DOMBatcher();

// Usage example: safely separate reads and writes
function animateCards(cards) {
  cards.forEach((card) => {
    batcher.read(() => {
      const rect = card.getBoundingClientRect();
      batcher.write(() => {
        card.style.transform = `translateY(${rect.top * 0.1}px)`;
      });
    });
  });
}
```

### 11.2 Anti-pattern 2: will-change Overuse

Applying `will-change` permanently to all elements consumes large amounts of GPU memory and can actually degrade performance.

```css
/* ---- Bad example: apply will-change to all elements always ---- */
* {
  will-change: transform, opacity;
  /* Every element is promoted to a GPU layer → memory exhaustion */
}

.every-list-item {
  will-change: transform;
  /* 1000 list items each become a layer */
}

/* ---- Good example: apply only to the elements that need it, only when needed ---- */
.card {
  /* No will-change under normal conditions */
}

.card:hover {
  will-change: transform;
  /* Promoted only on hover */
}

/* Even better: control dynamically with JavaScript */
```

```javascript
// Properly manage the will-change lifecycle
class WillChangeManager {
  constructor(element, properties) {
    this.element = element;
    this.properties = properties;
    this.isActive = false;
  }

  // Prepare a little before the animation starts
  prepare() {
    if (this.isActive) return;
    this.element.style.willChange = this.properties;
    this.isActive = true;
  }

  // Release after the animation completes
  cleanup() {
    if (!this.isActive) return;
    this.element.style.willChange = 'auto';
    this.isActive = false;
  }

  // Automatic management tied to transitionend
  autoManage() {
    this.element.addEventListener('mouseenter', () => this.prepare());
    this.element.addEventListener('transitionend', () => this.cleanup());
    this.element.addEventListener('mouseleave', () => {
      // Cleanup after mouse leaves and transition ends
      requestAnimationFrame(() => {
        if (!this.element.matches(':hover')) {
          this.cleanup();
        }
      });
    });
  }
}
```

### 11.3 Anti-pattern 3: Animating with setInterval

```javascript
// ---- Bad example: animate with setInterval ----
let x = 0;
const intervalId = setInterval(() => {
  x += 2;
  element.style.left = x + 'px'; // Triggers Layout every time
  if (x >= 300) clearInterval(intervalId);
}, 16); // 16ms drifts out of sync with frames

// Problems:
// 1. setInterval timing does not sync with frames
// 2. Continues to run even in inactive tabs
// 3. If processing is delayed, callbacks pile up
// 4. The left property triggers Layout every frame

// ---- Good example: rAF + transform ----
let startTime = null;
const duration = 2500;

function animate(timestamp) {
  if (startTime === null) startTime = timestamp;
  const progress = Math.min((timestamp - startTime) / duration, 1);
  const eased = Easing.easeOutCubic(progress);

  element.style.transform = `translateX(${eased * 300}px)`;

  if (progress < 1) {
    requestAnimationFrame(animate);
  }
}

requestAnimationFrame(animate);
```

---

## 12. Edge Case Analysis

### 12.1 Edge Case 1: High Refresh Rate Displays

At 120Hz or 144Hz, the time per frame is reduced to 8.3ms or 6.9ms respectively. Fixed-value animations (moving a set amount per frame) will exhibit unexpected speed changes on these displays.

```javascript
// ---- Bad example: fixed-value movement per frame ----
function badAnimate() {
  x += 5; // 300px/s at 60Hz, but 600px/s at 120Hz
  element.style.transform = `translateX(${x}px)`;
  if (x < 300) requestAnimationFrame(badAnimate);
}

// ---- Good example: elapsed-time-based movement (delta time) ----
function goodAnimate(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const deltaTime = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  // Speed: 300px/second (independent of display refresh rate)
  const speed = 300; // px per second
  x += speed * (deltaTime / 1000);

  element.style.transform = `translateX(${Math.min(x, 300)}px)`;
  if (x < 300) requestAnimationFrame(goodAnimate);
}

// ---- Best example: duration-based normalization ----
function bestAnimate(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = timestamp - startTime;
  const progress = Math.min(elapsed / 1000, 1); // Complete in 1 second
  const eased = Easing.easeOutCubic(progress);

  element.style.transform = `translateX(${eased * 300}px)`;
  if (progress < 1) requestAnimationFrame(bestAnimate);
}
// This approach moves 300px in the same 1 second at 60Hz, 120Hz, or 144Hz
```

```
Frame budget comparison by refresh rate:

  Refresh    Frame interval   JS budget   Frames/s
  Rate                        (approx.)
  ───────────────────────────────────────────────
  60Hz         16.67ms       10ms        60
  90Hz         11.11ms       7ms         90
  120Hz         8.33ms       5ms        120
  144Hz         6.94ms       4ms        144
  240Hz         4.17ms       2ms        240

  Important: at higher refresh rates the allowable JS processing time
  narrows significantly. Consider offloading complex calculations to a Worker.
```

### 12.2 Edge Case 2: Animations in Inactive Tabs

Browsers heavily throttle `requestAnimationFrame` callbacks in inactive tabs (often to 1fps or less) to optimize performance and battery usage. This can cause animations to jump abruptly when the user switches back to the tab.

```javascript
// Animation management for tab switching
class VisibilityAwareAnimation {
  constructor(animateFn) {
    this.animateFn = animateFn;
    this.isRunning = false;
    this.lastTimestamp = null;
    this.pausedAt = null;
    this.totalPausedDuration = 0;

    // Monitor with Page Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onHidden();
      } else {
        this.onVisible();
      }
    });
  }

  start() {
    this.isRunning = true;
    this.lastTimestamp = null;
    this.totalPausedDuration = 0;
    this.tick();
  }

  tick() {
    if (!this.isRunning) return;

    requestAnimationFrame((timestamp) => {
      if (this.lastTimestamp === null) {
        this.lastTimestamp = timestamp;
      }

      // Calculate net elapsed time excluding the inactive period
      const adjustedTime = timestamp - this.totalPausedDuration;
      const shouldContinue = this.animateFn(adjustedTime);

      if (shouldContinue && this.isRunning) {
        this.lastTimestamp = timestamp;
        this.tick();
      }
    });
  }

  onHidden() {
    // Record the time the tab became inactive
    this.pausedAt = performance.now();
  }

  onVisible() {
    // When the tab becomes active again, add the inactive duration
    if (this.pausedAt !== null) {
      this.totalPausedDuration += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  stop() {
    this.isRunning = false;
  }
}

// Usage example
const anim = new VisibilityAwareAnimation((adjustedTime) => {
  const progress = Math.min(adjustedTime / 3000, 1);
  element.style.transform = `translateX(${progress * 300}px)`;
  return progress < 1;
});
anim.start();
```

### 12.3 Edge Case 3: Side Effects of transform on Child Elements

The `transform` property creates a new stacking context and containing block, which changes the reference point for `position: fixed` on child elements, among other side effects.

```css
/* Problem: fixed positioning does not work as expected inside a parent with transform */
.parent {
  transform: translateX(0); /* This alone changes the reference for fixed */
}

.parent .fixed-child {
  position: fixed; /* Uses .parent as reference, not the viewport */
  top: 0;
  left: 0;
}

/* Solution 1: Move the fixed element outside the transformed element */
/* Solution 2: Mount it in a different location in the DOM using the portal pattern */
/* Solution 3: Use sticky instead of fixed (depending on the use case) */
```

```
Contexts created by transform:

  Without transform:
  ┌─ viewport ──────────────────────────┐
  │  ┌─ parent ──────────┐              │
  │  │  ┌─ child ──────┐ │              │
  │  │  │ fixed: top 0  │ │   ← viewport reference │
  │  │  └──────────────┘ │              │
  │  └───────────────────┘              │
  └─────────────────────────────────────┘
  child is displayed at viewport top:0

  With transform:
  ┌─ viewport ──────────────────────────┐
  │  ┌─ parent (transform) ──────────┐  │
  │  │  ┌─ child ──────┐            │  │
  │  │  │ fixed: top 0  │ ← parent reference │  │
  │  │  └──────────────┘            │  │
  │  └──────────────────────────────┘  │
  └─────────────────────────────────────┘
  child is displayed at parent top:0 (may differ from intention)
```

---

## 13. Comparison Tables

### 13.1 Overall Comparison of Animation Techniques

| Feature | CSS Transition | CSS Animation | rAF | WAAPI | FLIP | View Transitions |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Declarative syntax | ✓ | ✓ | - | - | - | ✓ (CSS side) |
| GPU acceleration | ✓ | ✓ | △ | ✓ | ✓ | ✓ |
| Dynamic keyframes | - | - | ✓ | ✓ | - | - |
| Pause/resume | - | ✓ (play-state) | Manual | ✓ | - | - |
| Completion detection | Event | Event | Manual | Promise | Event | Promise |
| Reverse playback | △ | ✓ (direction) | Manual | ✓ | - | - |
| Complex sequences | △ (delay) | ✓ | ✓ | ✓ | - | △ |
| DOM change linkage | - | - | ✓ | ✓ | ✓ | ✓ |
| Scroll linkage | - | ✓ (scroll-timeline) | ✓ | ✓ | - | - |
| Main thread load | Low | Low | High | Low | Medium | Low |
| Learning cost | Low | Low | Medium | Medium | High | Medium |
| Browser support | All browsers | All browsers | All browsers | Wide | All browsers | Chrome/Edge primarily |

### 13.2 Recommended Uses for Easing Functions

| Use case | Recommended easing | Recommended duration | cubic-bezier approximation |
|------|:---:|:---:|:---:|
| Button hover | ease-out | 100-150ms | (0, 0, 0.2, 1) |
| Button press | ease-out | 50-100ms | (0, 0, 0.2, 1) |
| Element entrance | ease-out (decelerate) | 200-350ms | (0.22, 1, 0.36, 1) |
| Element exit | ease-in (accelerate) | 150-250ms | (0.4, 0, 1, 1) |
| Movement (enter/exit) | ease-in-out | 250-400ms | (0.4, 0, 0.2, 1) |
| Overshoot | back (ease-out) | 300-500ms | (0.34, 1.56, 0.64, 1) |
| Bounce | bounce | 500-800ms | JS implementation recommended |
| Spring | spring | 400-700ms | JS implementation recommended |
| Scroll linkage | linear | - | (0, 0, 1, 1) |
| Loading spinner | linear | 600-1000ms | (0, 0, 1, 1) |
| Modal open | decelerate + overshoot | 250-350ms | (0.34, 1.56, 0.64, 1) |
| Modal close | accelerate | 150-200ms | (0.4, 0, 1, 1) |

---

## 14. Exercises

### 14.1 Exercise 1: Basic - Card Hover Effect with CSS Transition

Implement an animation for a card component that meets the following requirements.

**Requirements:**
- On hover, the card moves up 4px and its shadow deepens
- Animate both transform and box-shadow
- Transition over 200ms with ease-out easing
- Disable the animation when `prefers-reduced-motion: reduce` is set
- Return to the original state slightly slower (250ms) when hover ends

```css
/* Solution */
.card {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition:
    transform 250ms ease-out,
    box-shadow 250ms ease-out;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  transition-duration: 200ms;
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
  .card:hover {
    transform: none;
    /* Keep the shadow change (non-motion change) */
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
```

**Verification points:**
- Enable "Paint flashing" in the Chrome DevTools Rendering tab and confirm that on hover, only the shadow area, not the entire card, is repainted.
- Record in the Performance tab and confirm that no Layout events occur.

### 14.2 Exercise 2: Intermediate - FLIP List Reorder Animation

Implement a sortable list that meets the following requirements.

**Requirements:**
- Toggle between name order and numeric order on button click
- Use the FLIP technique so each item smoothly moves from its current position to its new position
- Animation duration: 300ms, ease-out easing
- If a new sort is requested while an animation is running, cancel the previous animation and start the new sort

```javascript
// Solution
class AnimatedSortableList {
  constructor(container) {
    this.container = container;
    this.isAnimating = false;
    this.pendingSort = null;
  }

  async sort(compareFn) {
    if (this.isAnimating) {
      // If an animation is in progress, apply the new sort after it finishes
      this.pendingSort = compareFn;
      return;
    }

    this.isAnimating = true;
    const items = Array.from(this.container.children);

    // First: record current positions of all elements
    const firstPositions = new Map();
    items.forEach(item => {
      firstPositions.set(item, item.getBoundingClientRect());
    });

    // Last: apply sort
    const sorted = [...items].sort(compareFn);
    sorted.forEach(item => this.container.appendChild(item));

    // Invert + Play
    const animations = sorted.map(item => {
      const first = firstPositions.get(item);
      const last = item.getBoundingClientRect();
      const deltaX = first.left - last.left;
      const deltaY = first.top - last.top;

      if (deltaX === 0 && deltaY === 0) return null;

      return item.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' }
        ],
        {
          duration: 300,
          easing: 'cubic-bezier(0.2, 0, 0.2, 1)'
        }
      );
    }).filter(Boolean);

    // Wait for all animations to complete
    await Promise.all(animations.map(a => a.finished));
    this.isAnimating = false;

    // If there is a pending sort, run it
    if (this.pendingSort) {
      const nextSort = this.pendingSort;
      this.pendingSort = null;
      this.sort(nextSort);
    }
  }
}

// Usage example
const list = new AnimatedSortableList(document.querySelector('.list'));

document.querySelector('#sort-name').addEventListener('click', () => {
  list.sort((a, b) => a.textContent.localeCompare(b.textContent));
});

document.querySelector('#sort-value').addEventListener('click', () => {
  list.sort((a, b) => {
    return parseInt(a.dataset.value) - parseInt(b.dataset.value);
  });
});
```

### 14.3 Exercise 3: Advanced - Image Gallery with Web Animations API + View Transitions

Implement an image gallery transition system that meets the following requirements.

**Requirements:**
- Clicking a thumbnail transitions to the full-size image
- Use the View Transitions API to achieve a smooth transition from thumbnail to full size
- Provide a WAAPI fallback for browsers that don't support View Transitions
- Show a skeleton screen before the image loads
- Respect `prefers-reduced-motion`

```javascript
// Solution
class GalleryTransition {
  constructor() {
    this.prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );
  }

  async openFullSize(thumbnail, fullSizeUrl) {
    // Show skeleton
    const skeleton = this.createSkeleton(thumbnail);
    document.body.appendChild(skeleton);

    // Preload the image
    const img = new Image();
    const imageLoaded = new Promise((resolve) => {
      img.onload = resolve;
      img.src = fullSizeUrl;
    });

    if (document.startViewTransition && !this.prefersReducedMotion.matches) {
      // Use View Transitions API if available
      return this.openWithViewTransition(thumbnail, img, imageLoaded, skeleton);
    } else {
      // Fallback: use WAAPI
      return this.openWithWAAPI(thumbnail, img, imageLoaded, skeleton);
    }
  }

  async openWithViewTransition(thumbnail, img, imageLoaded, skeleton) {
    // Set view-transition-name on the thumbnail
    thumbnail.style.viewTransitionName = 'gallery-image';

    await imageLoaded;

    const transition = document.startViewTransition(() => {
      skeleton.remove();
      thumbnail.style.viewTransitionName = '';

      const fullView = this.createFullView(img);
      fullView.style.viewTransitionName = 'gallery-image';
      document.body.appendChild(fullView);
    });

    await transition.finished;
  }

  async openWithWAAPI(thumbnail, img, imageLoaded, skeleton) {
    const thumbnailRect = thumbnail.getBoundingClientRect();

    await imageLoaded;
    skeleton.remove();

    const fullView = this.createFullView(img);
    document.body.appendChild(fullView);
    const fullRect = fullView.getBoundingClientRect();

    // Calculate scale difference
    const scaleX = thumbnailRect.width / fullRect.width;
    const scaleY = thumbnailRect.height / fullRect.height;
    const translateX = thumbnailRect.left - fullRect.left +
      (thumbnailRect.width - fullRect.width) / 2;
    const translateY = thumbnailRect.top - fullRect.top +
      (thumbnailRect.height - fullRect.height) / 2;

    if (this.prefersReducedMotion.matches) {
      fullView.style.opacity = '1';
      return;
    }

    await fullView.animate(
      [
        {
          transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
          opacity: 0.8
        },
        {
          transform: 'translate(0, 0) scale(1, 1)',
          opacity: 1
        }
      ],
      {
        duration: 350,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards'
      }
    ).finished;
  }

  createSkeleton(thumbnail) {
    const rect = thumbnail.getBoundingClientRect();
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton gallery-skeleton';
    skeleton.style.cssText = `
      position: fixed;
      top: ${rect.top}px; left: ${rect.left}px;
      width: ${rect.width}px; height: ${rect.height}px;
    `;
    return skeleton;
  }

  createFullView(img) {
    const container = document.createElement('div');
    container.className = 'gallery-full-view';
    container.appendChild(img);
    return container;
  }
}
```

---

## 15. FAQ

### Q1: How should CSS Transition and CSS Animation be used differently?

**Answer:** The basic principle is "use Transition for transitions between 2 states, use Animation for anything more complex."

- **When to use Transition:** Hover effects, button state changes, menu open/close, tooltip show/hide, and other cases where there is a clear start state and end state. Optimal as an automatic response to a trigger (`:hover`, class addition, etc.).
- **When to use Animation:** Loading spinners, pulse effects, entrance animations that pass through multiple intermediate states, infinite loop animations, and other cases where you need to define multiple states with `@keyframes`.

There is no significant performance difference between the two. When the target properties are `transform` / `opacity`, both are processed on the Compositor thread. Choose based on code readability and maintainability.

### Q2: Which should I use: requestAnimationFrame or Web Animations API?

**Answer:** Using WAAPI is recommended whenever possible.

WAAPI delegates processing directly to the browser's animation engine, so it does not block the main thread. In contrast, DOM operations performed inside a rAF callback execute on the main thread and may compete with other JavaScript processing.

However, rAF is appropriate in the following cases:
- Physics simulations (collision detection, spring physics, etc., where dynamic calculations are needed each frame)
- Canvas / WebGL rendering
- Real-time updates based on external data (mouse coordinates, sensor data, etc.)
- Animation logic involving complex conditional branching

### Q3: Why does performance degrade when scrolling occurs during an animation?

**Answer:** Scrolling and animation processing execute on the same main thread, so they compete for the frame budget. The problem is particularly noticeable in the following situations:

1. **DOM manipulation inside scroll event listeners:** The `scroll` event fires frequently, and changing the layout inside its handler causes many forced reflows.
2. **Non-passive scroll listeners:** Scroll listeners with `passive: false` prevent the browser from delegating scrolling to the Compositor, forcing it to wait for main-thread processing.
3. **Repaint of fixed-position elements:** Elements with `position: fixed` may cause repaints on every scroll.

As a countermeasure, consider using CSS Scroll-driven Animations for scroll-linked animations. These run on the Compositor thread and impose no load on the main thread.

### Q4: How do I prevent text distortion in child elements when using scale with the FLIP technique?

**Answer:** When using `scale()` with the FLIP technique, child elements are also scaled, which can make text and icons look distorted. To prevent this, use the "Counter-Scale" pattern, which applies an inverse scale to child elements.

```javascript
// Counter-Scale pattern
function flipWithCounterScale(parent, changeFn) {
  const first = parent.getBoundingClientRect();
  changeFn();
  const last = parent.getBoundingClientRect();

  const scaleX = first.width / last.width;
  const scaleY = first.height / last.height;

  parent.style.transform = `scale(${scaleX}, ${scaleY})`;

  // Apply inverse scale to child elements
  const children = parent.querySelectorAll('.preserve-scale');
  children.forEach(child => {
    child.style.transform = `scale(${1/scaleX}, ${1/scaleY})`;
  });

  requestAnimationFrame(() => {
    parent.style.transition = 'transform 300ms ease-out';
    parent.style.transform = '';

    children.forEach(child => {
      child.style.transition = 'transform 300ms ease-out';
      child.style.transform = '';
    });
  });
}
```

### Q5: What should I do if animations are not smooth on mobile devices?

**Answer:** Mobile devices have more limited GPU and CPU performance than desktops. Apply the following measures step by step.

1. **Use only transform / opacity:** Avoid properties that trigger Layout or Paint.
2. **Reduce the number of elements:** Minimize the number of elements animated simultaneously (ideally 10 or fewer).
3. **Consider display resolution:** High-resolution devices have more pixels to paint, increasing rendering load. Avoid large animation areas.
4. **Avoid box-shadow / filter:** These are paint-heavy operations and increase repaints during animation.
5. **Use will-change sparingly:** GPU memory is limited on mobile, so apply it only to the necessary elements.

---

## 16. Summary

### 60fps Animation Achievement Checklist

| Checklist item | Judgment criteria |
|------|------|
| Use only transform / opacity | Is Layout/Paint not being triggered? |
| Use rAF or WAAPI | Are setInterval/setTimeout not being used? |
| Timestamp-based calculations | Is per-frame fixed-value movement not being used? |
| Appropriate will-change management | Is it only applied when needed, to only the necessary elements? |
| Avoid layout thrashing | Are reads and writes separated? |
| prefers-reduced-motion support | Is the reduced motion preference being respected? |
| Handle inactive tabs | Is Page Visibility API being used for control? |
| Eliminate long tasks | Is the main thread not occupied for more than 50ms? |
| Verify with DevTools | Has the Performance panel been used to confirm no jank? |

### Technology Selection Flowchart

```
Choosing an animation technique:

  Start
   │
   ├── Simple transition between 2 states?
   │    └── Yes → CSS Transition
   │
   ├── Keyframes needed?
   │    └── Yes → CSS Animation
   │         └── Scroll-linked? → animation-timeline: scroll()/view()
   │
   ├── Position change linked to a DOM change?
   │    ├── Browser supports View Transitions API?
   │    │    └── Yes → View Transitions API
   │    └── No → FLIP technique
   │
   ├── JS control needed? (pause, reverse, dynamic keyframes)
   │    └── Yes → Web Animations API
   │
   ├── Physics simulation / Canvas?
   │    └── Yes → requestAnimationFrame
   │
   └── None of the above apply
        └── CSS Transition (prefer simplicity)
```

---

## FAQ

### Q1: How should CSS Animations and Web Animations API be used differently?

**A:** The key criteria are "the need for dynamic control" and "complexity."

```
Selection flowchart:

  Animation requirements
   │
   ├─ Static hover effects or entrance/exit animations
   │   └→ CSS Animations/Transitions
   │      Reason: declarative and simple, automatic optimization via will-change
   │
   ├─ Need to change speed, pause, or reverse mid-animation
   │   └→ Web Animations API
   │      Reason: .playbackRate, .pause(), .reverse() are available
   │
   ├─ Want to control progress of the entire timeline from outside
   │   └→ Web Animations API
   │      Reason: can seek directly with .currentTime
   │
   └─ Complex logic like physics calculation or collision detection
       └→ requestAnimationFrame + custom calculations
          Reason: full control over each frame is possible
```

**Specific examples:**

| Use case | Recommended technique | Reason |
|---|---|---|
| Color change on button hover | CSS Transition | Simplest, performance-optimal |
| Loading spinner | CSS Animation | Loop animation, declarative |
| Modal open/close | WAAPI | Dynamic control of open/close state needed |
| Scroll-linked parallax | Scroll-driven Animations | Dedicated API, optimized |
| Game character movement | rAF + Canvas | Physics simulation needed |

**Combined usage pattern:**
```javascript
// Define CSS Animations and control with WAAPI
const elem = document.querySelector('.box');
const animation = elem.getAnimations()[0]; // Get CSS animation

// Control dynamically from JavaScript
animation.playbackRate = 2.0; // 2x speed
animation.currentTime = 500;  // Seek to 500ms
```

---

### Q2: What is a concrete checklist for achieving 60fps?

**A:** Check the following 7 steps in order.

```
┌─────────────────────────────────────────────────────────────┐
│          7-step checklist for achieving 60fps               │
├─────────────────────────────────────────────────────────────┤
│ ✅ Step 1: Verify animated properties                        │
│    → Are only transform / opacity being used?               │
│    → Are width/height/top/left not being animated?          │
│                                                              │
│ ✅ Step 2: Appropriate will-change configuration             │
│    → Has will-change been set before the animation?         │
│    → Has will-change been removed after the animation ends? │
│                                                              │
│ ✅ Step 3: Verify layering                                   │
│    → Is it on an independent layer in DevTools > Layers?    │
│    → Are unnecessary layers not being created in bulk?      │
│                                                              │
│ ✅ Step 4: JavaScript processing time                        │
│    → Is processing inside rAF callbacks within 10ms?        │
│    → Is Forced Synchronous Layout (FSL) not being caused?   │
│                                                              │
│ ✅ Step 5: Minimize paint area                               │
│    → Check with DevTools > Rendering > Paint flashing       │
│    → Is it not repainting a wider area than necessary?      │
│                                                              │
│ ✅ Step 6: Avoid garbage collection                          │
│    → Are objects not being created during animation?        │
│    → Are array push/splice not being repeated?              │
│                                                              │
│ ✅ Step 7: Performance measurement                           │
│    → Check for frame drops with DevTools > Performance      │
│    → Monitor actual values with FPS Meter                   │
└─────────────────────────────────────────────────────────────┘
```

**Debugging workflow:**

```javascript
// 1. Measure with Performance API
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16.67) {
      console.warn(`Long frame: ${entry.duration.toFixed(2)}ms`);
      console.log('Start time:', entry.startTime);
      console.log('Entry type:', entry.entryType);
    }
  }
});
observer.observe({ entryTypes: ['measure', 'longtask'] });

// 2. Measure processing time inside rAF
function animate() {
  const start = performance.now();

  // Animation processing
  updatePositions();

  const duration = performance.now() - start;
  if (duration > 10) {
    console.warn(`JS processing too long: ${duration.toFixed(2)}ms`);
  }

  requestAnimationFrame(animate);
}

// 3. Chrome DevTools timeline analysis
// Performance > Record > Run animation > Stop
// Red frame bar = frame drop occurred
// Use Summary to identify which processing is heavy
```

**Common pitfalls:**

| Problem | Symptom | Solution |
|---|---|---|
| Forced synchronous layout | Reading offsetWidth immediately before style change | Batch processing (reads → writes) |
| Memory leak | Jank gets worse over long sessions | Use removeEventListener, WeakMap |
| Excessive layering | Increased memory usage | Keep will-change to the minimum necessary |
| Wide paint area | Full-screen repaint | Use contain: layout paint |

---

### Q3: How should I choose a JavaScript animation library?

**A:** Decide based on use case and bundle size trade-offs.

```
Library selection matrix:

                     Complexity
                       ↑
                       │
  GSAP (TweenMax)      │  Mo.js
  ~30KB (gzip)         │  ~20KB
  ┌──────────────┐     │  ┌──────────────┐
  │ Full-featured │     │  │ Motion       │
  │ Timeline      │     │  │ graphics     │
  └──────────────┘     │  └──────────────┘
                       │
  ─────────────────────┼─────────────────────→
                       │              Bundle size
  Anime.js             │  Popmotion
  ~9KB                 │  ~5KB (tree-shakable)
  ┌──────────────┐     │  ┌──────────────┐
  │ Light balance │     │  │ Lightest     │
  │              │     │  │ Functional   │
  └──────────────┘     │  └──────────────┘
                       │
                       ↓
                    Simple
```

**Selection flowchart:**

```
  Check requirements
   │
   ├─ SVG morphing or path drawing needed
   │   └→ GSAP (DrawSVG, MorphSVG) or Mo.js
   │
   ├─ Complex timeline control and sequencing
   │   └→ GSAP (Timeline API is best-in-class)
   │
   ├─ Natural physics-based movement (inertia, spring)
   │   └→ Popmotion (spring, inertia)
   │
   ├─ Lightweight, modern API with TypeScript support
   │   └→ Motion One (~5KB, WAAPI wrapper)
   │
   └─ Minimize bundle size
       └→ CSS Animations + WAAPI (no library needed)
```

**Benchmark comparison (as of 2024):**

| Library | Bundle size | Performance | Learning cost | Recommended cases |
|---|---|---|---|---|
| **GSAP** | ~30KB (gzip) | ★★★★★ | Medium | Enterprise, complex animations |
| **Anime.js** | ~9KB | ★★★★☆ | Low | General purpose, balanced |
| **Popmotion** | ~5KB | ★★★★★ | Medium | Physics simulation, interactive UI |
| **Motion One** | ~5KB | ★★★★★ | Low | New projects, leveraging WAAPI |
| **Velocity.js** | ~15KB | ★★★☆☆ | Low | Migrating from jQuery (not recommended) |
| **Framer Motion** | ~60KB | ★★★★☆ | Medium | React-only, declarative API |

**Implementation comparison:**

```javascript
// 1. GSAP (most intuitive, feature-rich)
gsap.to('.box', {
  x: 100,
  rotation: 360,
  duration: 1,
  ease: 'elastic.out(1, 0.3)',
  onComplete: () => console.log('done')
});

// 2. Anime.js (simple, lightweight)
anime({
  targets: '.box',
  translateX: 100,
  rotate: 360,
  duration: 1000,
  easing: 'easeOutElastic(1, .3)',
  complete: () => console.log('done')
});

// 3. Popmotion (physics-focused)
import { animate, spring } from 'popmotion';
animate({
  from: 0,
  to: 100,
  type: spring({ stiffness: 100, damping: 10 }),
  onUpdate: (x) => {
    box.style.transform = `translateX(${x}px)`;
  }
});

// 4. Motion One (WAAPI wrapper, lightest)
import { animate } from 'motion';
animate('.box',
  { x: 100, rotate: 360 },
  { duration: 1, easing: 'ease-out' }
);

// 5. Web Animations API (no library needed)
document.querySelector('.box').animate(
  [
    { transform: 'translateX(0) rotate(0deg)' },
    { transform: 'translateX(100px) rotate(360deg)' }
  ],
  { duration: 1000, easing: 'ease-out' }
);
```

**2026 recommendations:**
- **New projects**: Motion One or direct WAAPI usage (minimal bundle size)
- **Complex animations**: GSAP (track record and ecosystem)
- **React**: Framer Motion (declarative API)
- **Vue**: @vueuse/motion (Composition API support)

---

## Summary

### Overall Picture of Animation Performance Optimization

| Category | Key points | Recommended approach |
|---|---|---|
| **Core principles** | 60fps = 16.67ms/frame, keep JS processing within 10ms | Animate only transform/opacity |
| **CSS techniques** | Transitions/Animations/Scroll-driven | Use CSS declaratively for static animations |
| **JavaScript techniques** | rAF/WAAPI/FLIP technique | Use JS only when dynamic control is needed |
| **Layer optimization** | will-change, contain, compositing layers | Pre-layer promotion to avoid paint |
| **Measurement and debugging** | DevTools Performance/Rendering, FPS Meter | Early detection of frame drops |
| **Accessibility** | prefers-reduced-motion, alternative UI | Consideration for visually sensitive users |
| **Latest APIs** | View Transitions, Scroll-driven | High performance with native features |

### Key Points

1. **Prioritize transform and opacity**
   - Completed by GPU compositing alone, skipping Layout/Paint
   - Pre-layering with will-change also optimizes the first frame
   - Avoid width/height/top/left; use scaleX/scaleY/translate instead

2. **Absorb layout changes with the FLIP technique**
   - The 4 steps — First/Last/Invert/Play — convert expensive layout changes into cheap transform animations
   - Effective for animations involving structural DOM changes such as adding, removing, or reordering elements
   - After the View Transitions API arrived, prefer it (simpler implementation)

3. **Don't optimize without measuring; identify the bottleneck before improving**
   - Visualize "which processing is heavy" with DevTools Performance
   - Monitor actual values with FPS Meter
   - Detect processing exceeding 16.67ms with the Long Tasks API
   - Performance is highly environment-dependent, so always measure on the target device

---

## Next Guides to Read

- [V8 Engine Internals](../02-javascript-runtime/00-v8-engine.md)
- Compositing Layers and GPU Acceleration
- Layout and Reflow Optimization

---

## References

1. Paul Lewis. "FLIP Your Animations." aerotwist.com, 2015. The original source by the proposer of the FLIP technique. Explains the method for converting animation performance to transform-based approaches.
2. Google Developers. "Rendering Performance." web.dev, 2023. Official guide that systematically covers each stage of the rendering pipeline and optimization techniques for achieving 60fps.
3. Jake Archibald. "View Transitions API." Chrome for Developers, 2023. Detailed explanation by the engineer involved in drafting the View Transitions API spec. Covers use cases for both SPA and MPA.
4. MDN Web Docs. "Web Animations API." Mozilla, 2024. Complete reference for WAAPI specs, methods, and properties. Includes browser compatibility information.
5. CSS Working Group. "CSS Scroll-driven Animations." W3C, 2024. Spec for scroll() and view() timelines. Includes detailed definitions of animation-range.
6. Steve Souders. "High Performance Web Sites." O'Reilly Media, 2007. Classic text on web performance optimization. Established the foundational principles of frontend performance.
