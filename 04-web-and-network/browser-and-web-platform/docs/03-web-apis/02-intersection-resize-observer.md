# Observer API

> IntersectionObserver, ResizeObserver, MutationObserver, and PerformanceObserver are a set of browser-native APIs for efficiently monitoring element visibility, size changes, DOM mutations, and performance events. Compared to traditional scroll events or setInterval-based polling, these APIs offer significantly better performance and are indispensable in a wide range of practical scenarios including lazy loading, infinite scroll, responsive components, and Web Vitals measurement.

## Prerequisites

It is recommended to have the following knowledge before studying this chapter.

- **DOM API** ([./00-dom-api.md](./00-dom-api.md)): Since the Observer API observes DOM elements, a foundational understanding of DOM manipulation (querySelector, event listeners, element reference management, etc.) is assumed.
- **Rendering Pipeline** ([../01-rendering/00-rendering-pipeline.md](../01-rendering/00-rendering-pipeline.md)): To understand why IntersectionObserver and ResizeObserver are performant, you need to be familiar with the browser's rendering process (the Layout, Paint, and Composite phases) and the concept of forced reflow.
- **Scroll Event Basics**: Knowing how traditional scroll events and getBoundingClientRect() work for visibility detection makes the advantages and use cases of the Observer API clearer. In particular, understanding the throttle/debounce pattern for events and its performance drawbacks is helpful.

Having this foundational knowledge allows for a deeper understanding of the Observer API's design philosophy and how to use it effectively in practice.

---

## What You Will Learn in This Chapter

- [ ] Understand how IntersectionObserver works and the patterns for using it
- [ ] Learn how to use ResizeObserver and how it compares to container queries
- [ ] Learn how to efficiently monitor DOM changes with MutationObserver
- [ ] Be able to implement Web Vitals measurement with PerformanceObserver
- [ ] Understand the performance benefits and best practices of each Observer
- [ ] Learn how to create custom hook patterns for React and other frameworks

---

## 1. IntersectionObserver

### 1.1 Core Concepts and API

IntersectionObserver is an API that asynchronously monitors the intersection state of a target element with a root element (the viewport by default). Unlike the traditional approach of using scroll events with getBoundingClientRect(), it leverages browser-internal optimizations to minimize load on the main thread.

```javascript
// Basic structure of IntersectionObserver
const observer = new IntersectionObserver(
  (entries, observer) => {
    // entries: array of IntersectionObserverEntry[]
    // observer: the IntersectionObserver instance itself
    entries.forEach(entry => {
      // Properties of entry
      console.log('target:', entry.target);           // The observed DOM element
      console.log('isIntersecting:', entry.isIntersecting); // Whether it is intersecting
      console.log('intersectionRatio:', entry.intersectionRatio); // Intersection ratio (0.0-1.0)
      console.log('intersectionRect:', entry.intersectionRect); // The intersection rectangle
      console.log('boundingClientRect:', entry.boundingClientRect); // The target's bounding rect
      console.log('rootBounds:', entry.rootBounds);   // The root element's bounding rect
      console.log('time:', entry.time);               // Timestamp when the intersection was recorded
    });
  },
  {
    root: null,             // Root element for observation (null = viewport)
    rootMargin: '0px',      // Margin around the root element (CSS format: "10px 20px 30px 40px")
    threshold: [0, 0.5, 1], // Intersection ratio thresholds that trigger the callback
  }
);

// Start observing an element
const targetElement = document.getElementById('target');
observer.observe(targetElement);

// Stop observing a specific element
observer.unobserve(targetElement);

// Stop all observation
observer.disconnect();

// Get currently pending entries (including asynchronously buffered ones)
const pendingEntries = observer.takeRecords();
```

### 1.2 threshold in Detail

```javascript
// threshold: single value
const observer1 = new IntersectionObserver(callback, {
  threshold: 0,    // Callback fires when even 1px is intersecting
});

const observer2 = new IntersectionObserver(callback, {
  threshold: 1.0,  // Callback fires when the element is fully visible
});

// threshold: array (multiple thresholds)
const observer3 = new IntersectionObserver(callback, {
  threshold: [0, 0.25, 0.5, 0.75, 1.0],
  // Callback fires at 0%, 25%, 50%, 75%, and 100% intersection ratios
});

// Fine-grained thresholds (for scroll-linked animations)
const thresholds = Array.from({ length: 100 }, (_, i) => i / 100);
// [0, 0.01, 0.02, ..., 0.99]
const smoothObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    // Reflect intersectionRatio to a CSS custom property
    entry.target.style.setProperty(
      '--visibility',
      String(entry.intersectionRatio)
    );
  });
}, { threshold: thresholds });

// Usage in CSS
// .fade-in {
//   opacity: var(--visibility, 0);
//   transform: translateY(calc((1 - var(--visibility)) * 20px));
//   transition: opacity 0.1s, transform 0.1s;
// }
```

### 1.3 Using rootMargin

```javascript
// Expand or shrink the observation area with rootMargin
// Detect 200px before the viewport (ideal for preloading)
const preloadObserver = new IntersectionObserver(callback, {
  rootMargin: '200px 0px', // 200px top/bottom, 0px left/right
});

// Detect when element enters the inner 50% of the viewport
const innerObserver = new IntersectionObserver(callback, {
  rootMargin: '-50% 0px', // Shrink top/bottom by 50%
});

// Asymmetric margin (larger margin on the top)
const asymmetricObserver = new IntersectionObserver(callback, {
  rootMargin: '300px 0px 0px 0px', // top 300px, right 0px, bottom 0px, left 0px
});

// ★ rootMargin values use the same format as CSS margin shorthand
// "10px"          → all sides 10px
// "10px 20px"     → top/bottom 10px, left/right 20px
// "10px 20px 30px"    → top 10px, left/right 20px, bottom 30px
// "10px 20px 30px 40px" → top 10px, right 20px, bottom 30px, left 40px

// Percentages are also supported (relative to the root element)
const percentObserver = new IntersectionObserver(callback, {
  rootMargin: '-25%', // Shrink the root element by 25% for observation
});
```

### 1.4 Custom Root Element

```javascript
// Specify a scroll container as the root
const scrollContainer = document.getElementById('scroll-container');

const containerObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        console.log('Element is visible within the scroll container');
      }
    });
  },
  {
    root: scrollContainer, // Use this container as the reference instead of the viewport
    rootMargin: '50px',
    threshold: 0,
  }
);

// Observe all items within the scroll container
scrollContainer.querySelectorAll('.list-item').forEach(item => {
  containerObserver.observe(item);
});

// ★ Note: root must be an ancestor of the target element
// ★ root: null means the viewport (implicit root)
```

---

## 2. Practical Patterns for IntersectionObserver

### 2.1 Lazy Loading Images

```javascript
// Lazy loading images with vanilla JS
class LazyImageLoader {
  constructor(options = {}) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: options.rootMargin || '200px 0px',
        threshold: 0,
      }
    );
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const element = entry.target;

      if (element.tagName === 'IMG') {
        this.loadImage(element);
      } else if (element.tagName === 'VIDEO') {
        this.loadVideo(element);
      } else {
        // Lazy loading background images
        this.loadBackground(element);
      }

      this.observer.unobserve(element);
    });
  }

  loadImage(img) {
    // Handle srcset
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
    }
    // Handle sizes
    if (img.dataset.sizes) {
      img.sizes = img.dataset.sizes;
    }
    // Handle src
    if (img.dataset.src) {
      img.src = img.dataset.src;
    }

    img.classList.add('loaded');
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
    img.removeAttribute('data-sizes');
  }

  loadVideo(video) {
    // Process data-src on source elements
    video.querySelectorAll('source').forEach(source => {
      if (source.dataset.src) {
        source.src = source.dataset.src;
      }
    });
    video.load();
    video.classList.add('loaded');
  }

  loadBackground(element) {
    if (element.dataset.bg) {
      element.style.backgroundImage = `url('${element.dataset.bg}')`;
      element.classList.add('loaded');
    }
  }

  observe(element) {
    this.observer.observe(element);
  }

  observeAll(selector) {
    document.querySelectorAll(selector).forEach(el => this.observe(el));
  }

  destroy() {
    this.observer.disconnect();
  }
}

// Usage
const lazyLoader = new LazyImageLoader({ rootMargin: '300px 0px' });
lazyLoader.observeAll('[data-src], [data-bg]');

// HTML side
// <img data-src="large-image.jpg"
//      data-srcset="small.jpg 480w, medium.jpg 800w, large.jpg 1200w"
//      data-sizes="(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px"
//      src="placeholder.svg"
//      alt="Description"
//      class="lazy" />

// ★ The loading="lazy" attribute is now recommended (browser-native)
// <img src="image.jpg" loading="lazy" alt="Description" />
// However, use IntersectionObserver when fine-grained control is needed
```

### 2.2 Infinite Scroll

```javascript
// Feature-rich infinite scroll implementation
class InfiniteScroll {
  constructor(options) {
    this.container = options.container;
    this.loadMore = options.loadMore;
    this.threshold = options.threshold || 1;
    this.loading = false;
    this.hasMore = true;

    // Create a sentinel element
    this.sentinel = document.createElement('div');
    this.sentinel.className = 'infinite-scroll-sentinel';
    this.sentinel.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.sentinel);

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        root: options.root || null,
        rootMargin: options.rootMargin || '400px 0px',
        threshold: 0,
      }
    );

    this.observer.observe(this.sentinel);
  }

  async handleIntersection(entries) {
    const entry = entries[0];

    if (!entry.isIntersecting || this.loading || !this.hasMore) return;

    this.loading = true;
    this.showLoadingIndicator();

    try {
      const result = await this.loadMore();

      if (result.items.length === 0 || !result.hasMore) {
        this.hasMore = false;
        this.observer.disconnect();
        this.showEndMessage();
      } else {
        this.appendItems(result.items);
      }
    } catch (error) {
      console.error('Failed to load more items:', error);
      this.showError(error);
    } finally {
      this.loading = false;
      this.hideLoadingIndicator();
    }
  }

  appendItems(items) {
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const element = this.createItemElement(item);
      fragment.appendChild(element);
    });

    // Insert before the sentinel element
    this.container.insertBefore(fragment, this.sentinel);
  }

  createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'scroll-item';
    div.innerHTML = `<h3>${item.title}</h3><p>${item.description}</p>`;
    return div;
  }

  showLoadingIndicator() {
    this.sentinel.textContent = 'Loading...';
    this.sentinel.classList.add('loading');
  }

  hideLoadingIndicator() {
    this.sentinel.textContent = '';
    this.sentinel.classList.remove('loading');
  }

  showEndMessage() {
    this.sentinel.textContent = 'All items loaded.';
    this.sentinel.classList.add('end');
  }

  showError(error) {
    this.sentinel.textContent = 'Error loading items. Click to retry.';
    this.sentinel.classList.add('error');
    this.sentinel.onclick = () => {
      this.sentinel.classList.remove('error');
      this.hasMore = true;
      this.observer.observe(this.sentinel);
    };
  }

  destroy() {
    this.observer.disconnect();
    this.sentinel.remove();
  }
}

// Usage
let page = 0;
const infiniteScroll = new InfiniteScroll({
  container: document.getElementById('items-container'),
  loadMore: async () => {
    page++;
    const response = await fetch(`/api/items?page=${page}&limit=20`);
    const data = await response.json();
    return {
      items: data.items,
      hasMore: data.hasMore,
    };
  },
});
```

### 2.3 Scroll-Linked Animation

```javascript
// Fade-in animation
class ScrollAnimator {
  constructor(options = {}) {
    this.animations = new Map();

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: options.rootMargin || '0px 0px -10% 0px',
        threshold: options.threshold || [0, 0.1, 0.2, 0.3, 0.4, 0.5],
      }
    );
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      const animationType = this.animations.get(entry.target);

      if (entry.isIntersecting) {
        this.applyAnimation(entry.target, animationType, entry.intersectionRatio);
      }
    });
  }

  applyAnimation(element, type, ratio) {
    switch (type) {
      case 'fade-in':
        element.style.opacity = Math.min(ratio * 2, 1);
        element.style.transform = `translateY(${(1 - Math.min(ratio * 2, 1)) * 30}px)`;
        break;

      case 'slide-left':
        element.style.opacity = Math.min(ratio * 2, 1);
        element.style.transform = `translateX(${(1 - Math.min(ratio * 2, 1)) * -50}px)`;
        break;

      case 'slide-right':
        element.style.opacity = Math.min(ratio * 2, 1);
        element.style.transform = `translateX(${(1 - Math.min(ratio * 2, 1)) * 50}px)`;
        break;

      case 'scale-up':
        const scale = 0.8 + Math.min(ratio * 2, 1) * 0.2;
        element.style.opacity = Math.min(ratio * 2, 1);
        element.style.transform = `scale(${scale})`;
        break;

      case 'reveal':
        if (ratio > 0.1) {
          element.classList.add('revealed');
          this.observer.unobserve(element);
        }
        break;
    }
  }

  register(element, animationType = 'fade-in') {
    this.animations.set(element, animationType);
    // Set initial state
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    this.observer.observe(element);
  }

  registerAll(selector, animationType = 'fade-in') {
    document.querySelectorAll(selector).forEach(el => {
      this.register(el, animationType);
    });
  }

  destroy() {
    this.observer.disconnect();
    this.animations.clear();
  }
}

// Usage
const animator = new ScrollAnimator();
animator.registerAll('.section-title', 'fade-in');
animator.registerAll('.card-left', 'slide-left');
animator.registerAll('.card-right', 'slide-right');
animator.registerAll('.feature-icon', 'scale-up');

// CSS
// .revealed {
//   animation: reveal 0.8s ease forwards;
// }
// @keyframes reveal {
//   from { opacity: 0; transform: translateY(20px); }
//   to { opacity: 1; transform: translateY(0); }
// }
```

### 2.4 Viewability Measurement and Analytics

```javascript
// Viewability tracking for ads and content
class ViewabilityTracker {
  constructor(options = {}) {
    this.minVisibleRatio = options.minVisibleRatio || 0.5;
    this.minVisibleTime = options.minVisibleTime || 1000; // 1 second
    this.timers = new Map();
    this.tracked = new Set();
    this.onViewable = options.onViewable || (() => {});

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        threshold: [0, this.minVisibleRatio],
      }
    );
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      const target = entry.target;
      const id = target.dataset.trackId;

      if (this.tracked.has(id)) return;

      if (entry.intersectionRatio >= this.minVisibleRatio) {
        // Became visible: set a timer
        if (!this.timers.has(id)) {
          const timer = setTimeout(() => {
            this.tracked.add(id);
            this.timers.delete(id);
            this.onViewable({
              id,
              element: target,
              timestamp: Date.now(),
              ratio: entry.intersectionRatio,
            });
            this.observer.unobserve(target);
          }, this.minVisibleTime);

          this.timers.set(id, timer);
        }
      } else {
        // Became hidden: clear the timer
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }
      }
    });
  }

  track(element) {
    if (!element.dataset.trackId) {
      element.dataset.trackId = `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    this.observer.observe(element);
  }

  destroy() {
    this.observer.disconnect();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

// Usage
const tracker = new ViewabilityTracker({
  minVisibleRatio: 0.5,
  minVisibleTime: 2000, // Viewable when 50%+ visible for 2+ seconds
  onViewable({ id, element }) {
    console.log(`Element ${id} is viewable`);
    // Send to analytics
    fetch('/api/analytics/viewability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elementId: id,
        contentType: element.dataset.contentType,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  },
});

document.querySelectorAll('[data-track]').forEach(el => tracker.track(el));
```

### 2.5 Section Navigation (Active Section Detection)

```javascript
// Update navigation active state based on scroll position
class SectionNavigator {
  constructor(options = {}) {
    this.sections = new Map();
    this.activeSection = null;
    this.onSectionChange = options.onSectionChange || (() => {});

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: '-20% 0px -70% 0px', // Detect in the top 20-30% of the viewport
        threshold: 0,
      }
    );
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      const sectionId = entry.target.id;

      if (entry.isIntersecting) {
        if (this.activeSection !== sectionId) {
          this.activeSection = sectionId;
          this.updateNavigation(sectionId);
          this.onSectionChange(sectionId);
        }
      }
    });
  }

  updateNavigation(activeSectionId) {
    // Update the active state of navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
      const isActive = link.getAttribute('href') === `#${activeSectionId}`;
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  register(section) {
    this.sections.set(section.id, section);
    this.observer.observe(section);
  }

  registerAll(selector) {
    document.querySelectorAll(selector).forEach(section => {
      if (section.id) {
        this.register(section);
      }
    });
  }

  destroy() {
    this.observer.disconnect();
    this.sections.clear();
  }
}

// Usage
const sectionNav = new SectionNavigator({
  onSectionChange(sectionId) {
    // Update the URL hash (without adding to history with pushState)
    history.replaceState(null, '', `#${sectionId}`);
  },
});
sectionNav.registerAll('section[id]');
```

---

## 3. ResizeObserver

### 3.1 Core Concepts and API

ResizeObserver is an API for efficiently monitoring size changes of elements. It can detect size changes caused by any source — not just window resizing, but also CSS animations, DOM manipulation, flexbox/grid layout changes, and more.

```javascript
// Basic structure of ResizeObserver
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    // contentRect: size of the content area (excluding padding)
    const { width, height, top, left } = entry.contentRect;
    console.log(`Content size: ${width}x${height}`);
    console.log(`Content position: (${left}, ${top})`);

    // contentBoxSize: size of the content box (newer API)
    if (entry.contentBoxSize) {
      // Returned as an array (for future fragmentation support)
      const contentBox = entry.contentBoxSize[0];
      console.log(`Content box: ${contentBox.inlineSize}x${contentBox.blockSize}`);
    }

    // borderBoxSize: size of the border box (includes padding + border)
    if (entry.borderBoxSize) {
      const borderBox = entry.borderBoxSize[0];
      console.log(`Border box: ${borderBox.inlineSize}x${borderBox.blockSize}`);
    }

    // devicePixelContentBoxSize: size in device pixels
    if (entry.devicePixelContentBoxSize) {
      const devicePixelBox = entry.devicePixelContentBoxSize[0];
      console.log(`Device pixel: ${devicePixelBox.inlineSize}x${devicePixelBox.blockSize}`);
    }

    console.log('Target element:', entry.target);
  }
});

// Observe an element
observer.observe(element);

// Observe with a specific box model
observer.observe(element, { box: 'border-box' });   // border box
observer.observe(element, { box: 'content-box' });   // content box (default)
observer.observe(element, { box: 'device-pixel-content-box' }); // device pixels

// Stop observing
observer.unobserve(element);
observer.disconnect();
```

### 3.2 About inlineSize / blockSize

```javascript
// ★ inlineSize and blockSize are logical sizes
// For horizontal writing (writing-mode: horizontal-tb):
//   inlineSize = width (horizontal direction)
//   blockSize = height (vertical direction)
//
// For vertical writing (writing-mode: vertical-rl):
//   inlineSize = height (vertical direction)
//   blockSize = width (horizontal direction)

// Layout processing for multilingual support
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { inlineSize, blockSize } = entry.contentBoxSize[0];

    // Adjust layout based on logical size
    // Works correctly regardless of writing-mode
    if (inlineSize < 400) {
      entry.target.classList.add('compact-layout');
    } else {
      entry.target.classList.remove('compact-layout');
    }
  }
});
```

### 3.3 Container Query Alternative

```javascript
// Implementing container queries with ResizeObserver
class ContainerQuery {
  constructor() {
    this.queries = new Map();
    this.observer = new ResizeObserver(this.handleResize.bind(this));
  }

  handleResize(entries) {
    for (const entry of entries) {
      const { inlineSize: width } = entry.contentBoxSize[0];
      const queries = this.queries.get(entry.target) || [];

      for (const query of queries) {
        const matches = this.evaluateQuery(width, query.condition);
        entry.target.classList.toggle(query.className, matches);
      }
    }
  }

  evaluateQuery(width, condition) {
    if (condition.minWidth !== undefined && width < condition.minWidth) return false;
    if (condition.maxWidth !== undefined && width > condition.maxWidth) return false;
    return true;
  }

  register(element, queries) {
    this.queries.set(element, queries);
    this.observer.observe(element);
  }

  destroy() {
    this.observer.disconnect();
    this.queries.clear();
  }
}

// Usage
const cq = new ContainerQuery();
cq.register(document.querySelector('.card-container'), [
  { className: 'cq-small', condition: { maxWidth: 400 } },
  { className: 'cq-medium', condition: { minWidth: 401, maxWidth: 800 } },
  { className: 'cq-large', condition: { minWidth: 801 } },
]);

// ★ Native CSS container queries are now recommended
// @container (min-width: 400px) {
//   .card { grid-template-columns: 1fr 1fr; }
// }
// However, use ResizeObserver when JavaScript integration is needed
```

### 3.4 Auto-Resizing Charts

```javascript
// Integration with chart libraries such as D3.js / Chart.js / ECharts
class ResponsiveChart {
  constructor(container, chartLib) {
    this.container = container;
    this.chart = null;
    this.chartLib = chartLib;
    this.resizeTimeout = null;

    this.observer = new ResizeObserver((entries) => {
      // Debounce to suppress frequent resizes
      if (this.resizeTimeout) {
        cancelAnimationFrame(this.resizeTimeout);
      }

      this.resizeTimeout = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;

          if (width > 0 && height > 0) {
            this.resize(width, height);
          }
        }
      });
    });

    this.observer.observe(container);
  }

  resize(width, height) {
    if (this.chart) {
      // For Chart.js
      this.chart.resize(width, height);

      // For ECharts
      // this.chart.resize({ width, height });

      // For D3.js
      // d3.select(this.container).select('svg')
      //   .attr('width', width)
      //   .attr('height', height);
    }
  }

  destroy() {
    this.observer.disconnect();
    if (this.resizeTimeout) {
      cancelAnimationFrame(this.resizeTimeout);
    }
  }
}

// Pixel-perfect Canvas resizing with device pixel ratio support
class ResponsiveCanvas {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);

    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use devicePixelContentBoxSize for pixel-perfect resizing
        if (entry.devicePixelContentBoxSize) {
          const { inlineSize, blockSize } = entry.devicePixelContentBoxSize[0];
          this.canvas.width = inlineSize;
          this.canvas.height = blockSize;
        } else {
          const dpr = window.devicePixelRatio || 1;
          const { width, height } = entry.contentRect;
          this.canvas.width = Math.round(width * dpr);
          this.canvas.height = Math.round(height * dpr);
        }

        this.render();
      }
    });

    this.observer.observe(container, { box: 'device-pixel-content-box' });
  }

  render() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    // Drawing logic...
  }

  destroy() {
    this.observer.disconnect();
    this.canvas.remove();
  }
}
```

### 3.5 Auto-Shrink Text (FitText)

```javascript
// Automatically shrink text to fit the element width
class AutoFitText {
  constructor(options = {}) {
    this.minFontSize = options.minFontSize || 10;
    this.maxFontSize = options.maxFontSize || 100;
    this.elements = new Map();

    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.fitText(entry.target);
      }
    });
  }

  fitText(element) {
    const config = this.elements.get(element);
    if (!config) return;

    const containerWidth = element.parentElement.clientWidth;
    let fontSize = config.maxFontSize || this.maxFontSize;
    const minSize = config.minFontSize || this.minFontSize;

    // Find the optimal font size with binary search
    let low = minSize;
    let high = fontSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      element.style.fontSize = `${mid}px`;

      if (element.scrollWidth <= containerWidth) {
        low = mid + 1;
        fontSize = mid;
      } else {
        high = mid - 1;
      }
    }

    element.style.fontSize = `${fontSize}px`;
  }

  observe(element, config = {}) {
    this.elements.set(element, config);
    this.observer.observe(element.parentElement);
    this.fitText(element);
  }

  unobserve(element) {
    this.elements.delete(element);
    if (element.parentElement) {
      this.observer.unobserve(element.parentElement);
    }
  }

  destroy() {
    this.observer.disconnect();
    this.elements.clear();
  }
}

// Usage
const autoFit = new AutoFitText({ minFontSize: 12, maxFontSize: 48 });
autoFit.observe(document.querySelector('.headline'), {
  maxFontSize: 64,
});
```

### 3.6 Integration with Virtual Scroll

```javascript
// Virtual scroll with dynamic item heights using ResizeObserver
class VirtualList {
  constructor(container, options) {
    this.container = container;
    this.items = options.items || [];
    this.renderItem = options.renderItem;
    this.itemHeights = new Map();
    this.defaultHeight = options.estimatedItemHeight || 50;
    this.overscan = options.overscan || 5;

    // Set up the scroll container
    this.viewport = document.createElement('div');
    this.viewport.style.cssText = 'overflow-y: auto; height: 100%;';
    this.spacer = document.createElement('div');
    this.content = document.createElement('div');
    this.viewport.appendChild(this.spacer);
    this.viewport.appendChild(this.content);
    container.appendChild(this.viewport);

    // Measure item heights
    this.heightObserver = new ResizeObserver((entries) => {
      let heightChanged = false;

      for (const entry of entries) {
        const index = parseInt(entry.target.dataset.virtualIndex, 10);
        const newHeight = entry.borderBoxSize[0].blockSize;

        if (this.itemHeights.get(index) !== newHeight) {
          this.itemHeights.set(index, newHeight);
          heightChanged = true;
        }
      }

      if (heightChanged) {
        this.updateSpacerHeight();
        this.render();
      }
    });

    // Monitor viewport resize
    this.viewportObserver = new ResizeObserver(() => {
      this.render();
    });
    this.viewportObserver.observe(this.viewport);

    this.viewport.addEventListener('scroll', () => this.render());
    this.render();
  }

  getItemHeight(index) {
    return this.itemHeights.get(index) || this.defaultHeight;
  }

  getItemTop(index) {
    let top = 0;
    for (let i = 0; i < index; i++) {
      top += this.getItemHeight(i);
    }
    return top;
  }

  getTotalHeight() {
    let total = 0;
    for (let i = 0; i < this.items.length; i++) {
      total += this.getItemHeight(i);
    }
    return total;
  }

  updateSpacerHeight() {
    this.spacer.style.height = `${this.getTotalHeight()}px`;
  }

  render() {
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;

    // Calculate which items are in the visible range
    let startIndex = 0;
    let accumulatedHeight = 0;

    while (startIndex < this.items.length) {
      accumulatedHeight += this.getItemHeight(startIndex);
      if (accumulatedHeight > scrollTop) break;
      startIndex++;
    }

    startIndex = Math.max(0, startIndex - this.overscan);

    let endIndex = startIndex;
    accumulatedHeight = this.getItemTop(endIndex);

    while (endIndex < this.items.length && accumulatedHeight < scrollTop + viewportHeight) {
      accumulatedHeight += this.getItemHeight(endIndex);
      endIndex++;
    }

    endIndex = Math.min(this.items.length - 1, endIndex + this.overscan);

    // Update the DOM
    this.content.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i <= endIndex; i++) {
      const element = this.renderItem(this.items[i], i);
      element.dataset.virtualIndex = String(i);
      element.style.position = 'absolute';
      element.style.top = `${this.getItemTop(i)}px`;
      element.style.width = '100%';

      this.heightObserver.observe(element);
      fragment.appendChild(element);
    }

    this.content.style.position = 'relative';
    this.content.appendChild(fragment);
  }

  destroy() {
    this.heightObserver.disconnect();
    this.viewportObserver.disconnect();
    this.container.innerHTML = '';
  }
}
```

---

## 4. MutationObserver

### 4.1 Core Concepts and API

MutationObserver is an API for monitoring changes to the DOM tree. It can detect attribute changes, additions and removals of child nodes, and text content changes.

```javascript
// Basic structure of MutationObserver
const observer = new MutationObserver((mutations, observer) => {
  for (const mutation of mutations) {
    switch (mutation.type) {
      case 'childList':
        // Child node additions and removals
        console.log('Added nodes:', mutation.addedNodes);
        console.log('Removed nodes:', mutation.removedNodes);
        break;

      case 'attributes':
        // Attribute changes
        console.log('Attribute changed:', mutation.attributeName);
        console.log('Old value:', mutation.oldValue);
        console.log('New value:', mutation.target.getAttribute(mutation.attributeName));
        break;

      case 'characterData':
        // Text node changes
        console.log('Text changed:', mutation.target.textContent);
        console.log('Old value:', mutation.oldValue);
        break;
    }
  }
});

// Observation options
observer.observe(targetNode, {
  childList: true,         // Monitor child node additions and removals
  attributes: true,        // Monitor attribute changes
  characterData: true,     // Monitor text node changes
  subtree: true,           // Also monitor descendant nodes
  attributeOldValue: true, // Record the previous attribute value before changes
  characterDataOldValue: true, // Record the previous text content before changes
  attributeFilter: ['class', 'style', 'data-state'], // Limit which attributes to watch
});

// Get pending changes and stop observing
const pendingMutations = observer.takeRecords();
observer.disconnect();
```

### 4.2 DOM Change Monitoring Patterns

```javascript
// Pattern 1: Monitoring DOM changes from third-party scripts
// Monitor for unintended DOM changes made by external scripts
class DOMGuard {
  constructor(protectedElement) {
    this.element = protectedElement;
    this.originalHTML = protectedElement.innerHTML;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Detect injection of suspicious script tags
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') {
              console.warn('Suspicious element injected:', node);
              node.remove(); // Remove the unauthorized element
            }
          }
        }

        // Detect changes to important attributes
        if (mutation.type === 'attributes') {
          if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
            console.warn(
              `Attribute "${mutation.attributeName}" changed on`,
              mutation.target
            );
          }
        }
      }
    });

    this.observer.observe(protectedElement, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'href', 'src'],
    });
  }

  destroy() {
    this.observer.disconnect();
  }
}

// Pattern 2: Auto-initialization of dynamic content
// Auto-detect elements dynamically added by SPAs or third-party widgets
class AutoInitializer {
  constructor(config) {
    this.config = config; // { selector: string, init: (element) => void }[]

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.initElement(node);
            // Also check child elements of the added node
            node.querySelectorAll?.('*').forEach(child => {
              this.initElement(child);
            });
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also initialize existing elements
    this.config.forEach(({ selector, init }) => {
      document.querySelectorAll(selector).forEach(init);
    });
  }

  initElement(element) {
    for (const { selector, init } of this.config) {
      if (element.matches?.(selector) && !element.dataset.initialized) {
        element.dataset.initialized = 'true';
        init(element);
      }
    }
  }

  destroy() {
    this.observer.disconnect();
  }
}

// Usage
const autoInit = new AutoInitializer([
  {
    selector: '[data-tooltip]',
    init: (el) => new Tooltip(el, { content: el.dataset.tooltip }),
  },
  {
    selector: '[data-datepicker]',
    init: (el) => new DatePicker(el),
  },
  {
    selector: 'pre code',
    init: (el) => hljs.highlightElement(el),
  },
]);

// Pattern 3: Form change detection
class FormChangeDetector {
  constructor(form) {
    this.form = form;
    this.isDirty = false;
    this.initialValues = this.captureValues();

    // Monitor attribute changes (value attribute is a property and cannot be observed directly)
    this.observer = new MutationObserver((mutations) => {
      this.checkDirty();
    });

    this.observer.observe(form, {
      attributes: true,
      subtree: true,
      attributeFilter: ['value', 'checked', 'selected'],
    });

    // Also listen to input events (value property changes cannot be detected by MutationObserver)
    form.addEventListener('input', () => this.checkDirty());
    form.addEventListener('change', () => this.checkDirty());
  }

  captureValues() {
    const values = {};
    new FormData(this.form).forEach((value, key) => {
      values[key] = value;
    });
    return values;
  }

  checkDirty() {
    const currentValues = this.captureValues();
    this.isDirty = JSON.stringify(currentValues) !== JSON.stringify(this.initialValues);

    this.form.dispatchEvent(new CustomEvent('dirtychange', {
      detail: { isDirty: this.isDirty },
    }));
  }

  reset() {
    this.initialValues = this.captureValues();
    this.isDirty = false;
  }

  destroy() {
    this.observer.disconnect();
  }
}
```

### 4.3 Caveats for MutationObserver

```javascript
// ★ Note 1: The callback is called after all synchronous DOM changes have completed
// (executed as a microtask)
element.setAttribute('class', 'foo');
element.setAttribute('class', 'bar');
element.setAttribute('class', 'baz');
// → The callback is called only once, containing all 3 mutations

// ★ Note 2: Watch out for infinite loops
// Modifying the DOM inside the callback will trigger the callback again
const observer = new MutationObserver((mutations) => {
  // Dangerous: can cause an infinite loop
  // mutations[0].target.textContent = 'updated';

  // Safe: temporarily disconnect before making changes
  observer.disconnect();
  mutations[0].target.textContent = 'updated';
  observer.observe(targetNode, options);
});

// ★ Note 3: Performance impact
// Monitoring a large area with subtree: true can be costly
// Use the minimum necessary scope and attribute filters

// ★ Note 4: CSS property changes cannot be detected by MutationObserver
// Changes to the style attribute can be detected, but style changes
// caused by CSS class application cannot
// → Use ResizeObserver or getComputedStyle instead
```

---

## 5. PerformanceObserver

### 5.1 Core Concepts and API

PerformanceObserver is an API that asynchronously monitors browser performance entries. It is part of the Performance Timeline and allows real-time collection of various performance metrics.

```javascript
// Basic structure of PerformanceObserver
const observer = new PerformanceObserver((list, observer) => {
  const entries = list.getEntries();
  for (const entry of entries) {
    console.log(entry.name, entry.entryType, entry.startTime, entry.duration);
  }
});

// Specify entry types to observe
observer.observe({
  type: 'resource',     // Single type
  buffered: true,       // Include past entries
});

// Observe multiple types simultaneously
observer.observe({
  entryTypes: ['navigation', 'resource', 'paint'],
  // ★ entryTypes and type cannot be used together
  // ★ The buffered option is not available with entryTypes
});

// Stop observing
observer.disconnect();

// Check supported entry types
const supportedTypes = PerformanceObserver.supportedEntryTypes;
console.log(supportedTypes);
// ['element', 'event', 'first-input', 'largest-contentful-paint',
//  'layout-shift', 'longtask', 'mark', 'measure', 'navigation',
//  'paint', 'resource', 'visibility-state']
```

### 5.2 Measuring Core Web Vitals

```javascript
// LCP (Largest Contentful Paint): time for the largest content to be painted
function observeLCP(callback) {
  let lcpValue = 0;

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    lcpValue = lastEntry.startTime;
  });

  observer.observe({ type: 'largest-contentful-paint', buffered: true });

  // Finalize LCP on user interaction
  // (LCP continues to be updated until user interaction)
  const reportLCP = () => {
    observer.disconnect();
    callback(lcpValue);
  };

  // Finalize on various events
  ['keydown', 'click', 'scroll'].forEach(type => {
    addEventListener(type, reportLCP, { once: true });
  });

  // Also report on page navigation
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      reportLCP();
    }
  }, { once: true });
}

// FID (First Input Delay): delay of the first interaction
function observeFID(callback) {
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const firstInput = entries[0];

    // processingStart - startTime is the input delay
    const delay = firstInput.processingStart - firstInput.startTime;
    callback(delay);
    observer.disconnect();
  });

  observer.observe({ type: 'first-input', buffered: true });
}

// INP (Interaction to Next Paint): responsiveness from interaction
function observeINP(callback) {
  const interactions = new Map();
  let longestDuration = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Group events belonging to the same interaction
      const interactionId = entry.interactionId;
      if (!interactionId) continue;

      const existingDuration = interactions.get(interactionId) || 0;
      const newDuration = Math.max(existingDuration, entry.duration);
      interactions.set(interactionId, newDuration);

      if (newDuration > longestDuration) {
        longestDuration = newDuration;
      }
    }
  });

  observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });

  // Report when the page is hidden
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Calculate the 98th percentile
      const sortedDurations = [...interactions.values()].sort((a, b) => a - b);
      const p98Index = Math.floor(sortedDurations.length * 0.98) - 1;
      const inp = sortedDurations[Math.max(p98Index, 0)] || 0;
      callback(inp);
      observer.disconnect();
    }
  }, { once: true });
}

// CLS (Cumulative Layout Shift): cumulative layout shift score
function observeCLS(callback) {
  let clsValue = 0;
  let sessionValue = 0;
  let sessionEntries = [];
  let clsEntries = [];

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Exclude shifts caused by user input
      if (entry.hadRecentInput) continue;

      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // Session window conditions:
      // 1. Within 1 second of the previous entry
      // 2. Entire session is within 5 seconds
      if (
        sessionEntries.length > 0 &&
        entry.startTime - lastSessionEntry.startTime < 1000 &&
        entry.startTime - firstSessionEntry.startTime < 5000
      ) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        // Start a new session
        sessionValue = entry.value;
        sessionEntries = [entry];
      }

      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = [...sessionEntries];
      }
    }
  });

  observer.observe({ type: 'layout-shift', buffered: true });

  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      callback({
        value: clsValue,
        entries: clsEntries,
      });
      observer.disconnect();
    }
  }, { once: true });
}

// Integrated Web Vitals collection
class WebVitalsCollector {
  constructor(reportCallback) {
    this.report = reportCallback;
    this.metrics = {};

    observeLCP((value) => {
      this.metrics.lcp = value;
      this.report({ name: 'LCP', value, rating: this.rateLCP(value) });
    });

    observeFID((value) => {
      this.metrics.fid = value;
      this.report({ name: 'FID', value, rating: this.rateFID(value) });
    });

    observeINP((value) => {
      this.metrics.inp = value;
      this.report({ name: 'INP', value, rating: this.rateINP(value) });
    });

    observeCLS((result) => {
      this.metrics.cls = result.value;
      this.report({ name: 'CLS', value: result.value, rating: this.rateCLS(result.value) });
    });
  }

  rateLCP(value) {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  rateFID(value) {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  rateINP(value) {
    if (value <= 200) return 'good';
    if (value <= 500) return 'needs-improvement';
    return 'poor';
  }

  rateCLS(value) {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }
}

// Usage
const vitals = new WebVitalsCollector((metric) => {
  console.log(`${metric.name}: ${metric.value} (${metric.rating})`);

  // Send to analytics
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...metric,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      connectionType: navigator.connection?.effectiveType,
    }),
    keepalive: true,
  });
});
```

### 5.3 Monitoring Long Tasks

```javascript
// Detect tasks longer than 50ms
class LongTaskMonitor {
  constructor(options = {}) {
    this.threshold = options.threshold || 50;
    this.tasks = [];
    this.onLongTask = options.onLongTask || (() => {});

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const taskInfo = {
          duration: entry.duration,
          startTime: entry.startTime,
          name: entry.name,
          // Use attribution to identify the cause
          attribution: entry.attribution?.map(attr => ({
            containerType: attr.containerType,
            containerName: attr.containerName,
            containerSrc: attr.containerSrc,
          })),
        };

        this.tasks.push(taskInfo);
        this.onLongTask(taskInfo);

        if (entry.duration > 200) {
          console.warn(`Very long task detected: ${entry.duration}ms`, taskInfo);
        }
      }
    });

    this.observer.observe({ type: 'longtask', buffered: true });
  }

  getReport() {
    const totalBlockingTime = this.tasks.reduce(
      (sum, task) => sum + Math.max(0, task.duration - 50),
      0
    );

    return {
      totalTasks: this.tasks.length,
      totalBlockingTime,
      averageDuration: this.tasks.length
        ? this.tasks.reduce((sum, t) => sum + t.duration, 0) / this.tasks.length
        : 0,
      maxDuration: Math.max(0, ...this.tasks.map(t => t.duration)),
      tasks: this.tasks,
    };
  }

  destroy() {
    this.observer.disconnect();
  }
}

// Usage
const longTaskMonitor = new LongTaskMonitor({
  onLongTask(task) {
    if (task.duration > 100) {
      console.warn(`Long task: ${task.duration.toFixed(0)}ms`);
    }
  },
});

// Send a report when the page is unloaded
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    const report = longTaskMonitor.getReport();
    navigator.sendBeacon('/api/analytics/long-tasks', JSON.stringify(report));
  }
});
```

### 5.4 Resource Monitoring

```javascript
// Monitor resource loading performance
class ResourceMonitor {
  constructor() {
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const timing = {
          name: entry.name,
          type: entry.initiatorType, // 'fetch', 'xmlhttprequest', 'img', 'script', etc.
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,

          // Timing breakdown
          dns: entry.domainLookupEnd - entry.domainLookupStart,
          tcp: entry.connectEnd - entry.connectStart,
          tls: entry.secureConnectionStart > 0
            ? entry.connectEnd - entry.secureConnectionStart : 0,
          ttfb: entry.responseStart - entry.requestStart,
          download: entry.responseEnd - entry.responseStart,
          total: entry.duration,

          // Cache detection
          cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
        };

        // Warning for slow resources
        if (timing.total > 3000) {
          console.warn(`Slow resource: ${timing.name} (${timing.total.toFixed(0)}ms)`);
        }

        // Warning for large resources
        if (timing.decodedBodySize > 1024 * 1024) {
          console.warn(`Large resource: ${timing.name} (${(timing.decodedBodySize / 1024 / 1024).toFixed(1)}MB)`);
        }
      }
    });

    this.observer.observe({ type: 'resource', buffered: true });
  }

  destroy() {
    this.observer.disconnect();
  }
}
```

---

## 6. Observer Hooks in React

### 6.1 useIntersectionObserver

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const {
    threshold = 0,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = false,
  } = options;

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [node, setNode] = useState<Element | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const frozen = entry?.isIntersecting && freezeOnceVisible;

  // ref callback pattern (manage the DOM element as state)
  const ref = useCallback((node: Element | null) => {
    setNode(node);
  }, []);

  useEffect(() => {
    if (!node || frozen) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => setEntry(entry),
      { threshold, root, rootMargin }
    );

    observerRef.current.observe(node);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [node, threshold, root, rootMargin, frozen]);

  return {
    ref,
    entry,
    isIntersecting: entry?.isIntersecting ?? false,
    intersectionRatio: entry?.intersectionRatio ?? 0,
  };
}

// Usage: lazy loading images
function LazyImage({ src, alt, ...props }) {
  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '200px',
    freezeOnceVisible: true,
  });

  return (
    <div ref={ref}>
      {isIntersecting ? (
        <img src={src} alt={alt} {...props} />
      ) : (
        <div className="placeholder" style={{ aspectRatio: '16/9' }} />
      )}
    </div>
  );
}

// Usage: scroll-linked fade-in
function FadeInSection({ children }) {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  return (
    <section
      ref={ref}
      className={`fade-section ${isIntersecting ? 'visible' : ''}`}
    >
      {children}
    </section>
  );
}

// Usage: infinite scroll
function InfiniteList({ fetchItems }) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: '300px',
  });

  useEffect(() => {
    if (!isIntersecting || !hasMore) return;

    fetchItems(page + 1).then(result => {
      setItems(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage(prev => prev + 1);
    });
  }, [isIntersecting, hasMore, page, fetchItems]);

  return (
    <div>
      {items.map(item => (
        <ItemCard key={item.id} item={item} />
      ))}
      {hasMore && <div ref={ref} className="loading-sentinel" />}
    </div>
  );
}
```

### 6.2 useResizeObserver

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface Size {
  width: number;
  height: number;
  inlineSize: number;
  blockSize: number;
}

function useResizeObserver<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  size: Size | null;
} {
  const [size, setSize] = useState<Size | null>(null);
  const [node, setNode] = useState<T | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    setNode(node);
  }, []);

  useEffect(() => {
    if (!node) return;

    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry.contentBoxSize) {
        const contentBox = entry.contentBoxSize[0];
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
          inlineSize: contentBox.inlineSize,
          blockSize: contentBox.blockSize,
        });
      } else {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
          inlineSize: entry.contentRect.width,
          blockSize: entry.contentRect.height,
        });
      }
    });

    observerRef.current.observe(node);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [node]);

  return { ref, size };
}

// Usage: responsive component
function ResponsiveCard({ title, content }) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  const layout = size
    ? size.width < 400 ? 'compact' : size.width < 800 ? 'regular' : 'wide'
    : 'regular';

  return (
    <div ref={ref} className={`card card--${layout}`}>
      <h2>{title}</h2>
      <p>{content}</p>
      {size && (
        <span className="debug-size">
          {Math.round(size.width)}x{Math.round(size.height)}
        </span>
      )}
    </div>
  );
}

// Usage: chart resizing
function ResponsiveChartWrapper({ data }) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  return (
    <div ref={ref} style={{ width: '100%', height: '400px' }}>
      {size && (
        <Chart
          data={data}
          width={size.width}
          height={size.height}
        />
      )}
    </div>
  );
}
```

### 6.3 useMutationObserver

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseMutationObserverOptions extends MutationObserverInit {
  callback: MutationCallback;
}

function useMutationObserver<T extends HTMLElement>(
  options: UseMutationObserverOptions
) {
  const [node, setNode] = useState<T | null>(null);
  const callbackRef = useRef(options.callback);
  callbackRef.current = options.callback;

  const ref = useCallback((node: T | null) => {
    setNode(node);
  }, []);

  useEffect(() => {
    if (!node) return;

    const observer = new MutationObserver((...args) => {
      callbackRef.current(...args);
    });

    const { callback, ...observerOptions } = options;
    observer.observe(node, observerOptions);

    return () => observer.disconnect();
  }, [node, options.childList, options.attributes, options.characterData, options.subtree]);

  return ref;
}

// Usage: debugging DOM changes
function DebugContainer({ children }) {
  const ref = useMutationObserver({
    callback: (mutations) => {
      mutations.forEach(mutation => {
        console.log(`[DOM Change] ${mutation.type}`, mutation);
      });
    },
    childList: true,
    subtree: true,
    attributes: true,
  });

  return <div ref={ref}>{children}</div>;
}
```

---

## 7. scroll vs IntersectionObserver

### 7.1 Performance Comparison

```
Traditional scroll monitoring:
  window.addEventListener('scroll', () => {
    elements.forEach(el => {
      const rect = el.getBoundingClientRect(); // ★ Forces layout (Forced Reflow)
      if (rect.top < window.innerHeight) {
        // processing
      }
    });
  });

  Problems:
  → The scroll event fires at high frequency (60+ times per second)
  → getBoundingClientRect() forces layout recalculation (Layout Thrashing)
  → throttle/debounce is required but difficult to time correctly
  → Continues to fire even on inactive tabs
  → Performance degrades as element count grows (O(n))

IntersectionObserver:
  const observer = new IntersectionObserver(callback, options);
  elements.forEach(el => observer.observe(el));

  Advantages:
  ✓ Browser-native optimization (does not block the main thread)
  ✓ No Layout Thrashing
  ✓ No throttle/debounce needed (browser notifies at optimal timing)
  ✓ Automatically pauses on inactive tabs
  ✓ Performance does not degrade with element count
  ✓ Easy prefetching with rootMargin

  Limitations:
  △ Cannot retrieve pixel-level scroll position
  △ Scroll direction detection requires a separate mechanism
  △ Not suitable for continuous animations (parallax)
```

### 7.2 Usage Guidelines

```javascript
// When IntersectionObserver is appropriate:
// - Detecting element visibility / invisibility
// - Lazy loading (images, components)
// - Infinite scroll
// - Viewability measurement
// - Section detection for scroll-snap

// When scroll events are appropriate:
// - Parallax effects (require continuous scroll position)
// - Header shrink/expand (based on scroll amount)
// - Scroll progress bars
// - Scroll direction detection

// Best practices when using scroll events
let ticking = false;

function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      // Perform scroll-position-based processing here
      updateParallax(window.scrollY);
      ticking = false;
    });
    ticking = true;
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
// passive: true prevents blocking of scrolling
```

---

## 8. Best Practices and Performance Optimization

### 8.1 Sharing Observer Instances

```javascript
// ★ Share a single Observer for the same configuration
// Bad example: creating a new Observer per element
document.querySelectorAll('.lazy-image').forEach(img => {
  const observer = new IntersectionObserver(/* ... */); // 100 observers!
  observer.observe(img);
});

// Good example: monitor multiple elements with one Observer
const observer = new IntersectionObserver(/* ... */); // just one
document.querySelectorAll('.lazy-image').forEach(img => {
  observer.observe(img); // add to the same Observer
});

// ★ Call unobserve/disconnect when no longer needed
// Always stop unnecessary observation to prevent memory leaks
observer.unobserve(element); // stop individual element
observer.disconnect();       // stop all
```

### 8.2 Keep Callback Logic Lightweight

```javascript
// ★ Avoid heavy processing inside Observer callbacks
// Bad example
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    // Execute heavy redraw logic directly
    renderComplexChart(entry.contentRect.width, entry.contentRect.height);
  }
});

// Good example: batch with requestAnimationFrame
let rafId = null;

const observer = new ResizeObserver((entries) => {
  if (rafId) cancelAnimationFrame(rafId);

  rafId = requestAnimationFrame(() => {
    for (const entry of entries) {
      renderComplexChart(entry.contentRect.width, entry.contentRect.height);
    }
    rafId = null;
  });
});

// Good example: combine with debounce
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const debouncedResize = debounce((width, height) => {
  renderComplexChart(width, height);
}, 150);

const observer = new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  debouncedResize(width, height);
});
```

### 8.3 Browser Support and Polyfills

```javascript
// Browser support for Observer APIs
// IntersectionObserver: Chrome 51+, Firefox 55+, Safari 12.1+, Edge 15+
// ResizeObserver: Chrome 64+, Firefox 69+, Safari 13.1+, Edge 79+
// MutationObserver: Chrome 26+, Firefox 14+, Safari 7+, Edge 12+
// PerformanceObserver: Chrome 52+, Firefox 57+, Safari 11+, Edge 79+

// Feature detection
if ('IntersectionObserver' in window) {
  // Use IntersectionObserver
} else {
  // Fallback: scroll event + getBoundingClientRect
}

if ('ResizeObserver' in window) {
  // Use ResizeObserver
} else {
  // Fallback: window.onresize
}

// Loading polyfills (only when needed)
// npm install intersection-observer
// npm install resize-observer-polyfill
```

---

## FAQ

### Q1: What should I watch out for when implementing infinite scroll with IntersectionObserver?

When implementing infinite scroll with IntersectionObserver, keep the following points in mind.

1. **Sentinel element placement**: Place an empty div element at the end of the scroll container and observe it. When this element becomes visible, load the next batch of data.
2. **Loading flag management**: Use a `loading` flag to prevent the callback from triggering again while data is already loading. It is important to suppress new requests until the async operation completes.
3. **Prefetching with rootMargin**: Setting `rootMargin: '200px 0px'` allows data to be prefetched before the user scrolls to the bottom, providing a smooth UX.
4. **End-of-data detection**: When the server returns empty data or the hasMore flag is false, call `observer.disconnect()` to stop observation.
5. **Error handling**: Provide a UI that allows retry on network errors. Making the sentinel element clickable so users can manually retry is a good approach.

```javascript
const { ref, isIntersecting } = useIntersectionObserver({
  rootMargin: '300px', // Start loading 300px before the bottom
});

useEffect(() => {
  if (!isIntersecting || !hasMore || loading) return;

  setLoading(true);
  fetchItems(page + 1)
    .then(result => {
      setItems(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage(p => p + 1);
    })
    .catch(handleError)
    .finally(() => setLoading(false));
}, [isIntersecting, hasMore, loading]);
```

### Q2: What is the difference between ResizeObserver and the window.resize event, and when should I use each?

ResizeObserver and the window.resize event serve different purposes.

**window.resize event**:
- Detects only browser window size changes
- Fires at high frequency, so throttle/debounce is essential
- Suitable for global layout adjustments (unfixing the header, toggling mobile menus, etc.)

**ResizeObserver**:
- Detects size changes of specific DOM elements (including changes caused by CSS animations, flexbox, and grid layouts)
- The browser notifies at optimal timing (no throttling needed)
- Suitable for internal adjustments within individual components (chart resizing, auto-shrinking text, virtual scroll recalculation, etc.)

Usage guidelines:
- **Processing that depends on the overall viewport size** → window.resize + matchMedia()
- **Processing that depends on a specific element's content size** → ResizeObserver
- **Behavior similar to container queries** → ResizeObserver (or native `@container`)

ResizeObserver operates independently per element, making it well-suited for component-oriented design. On the other hand, window.resize is best used for application-wide breakpoint management.

### Q3: How much does using the Observer API actually improve performance?

The greatest benefit of the Observer API is **avoiding Layout Thrashing**.

**Traditional scroll event + getBoundingClientRect()**:
```javascript
window.addEventListener('scroll', () => {
  elements.forEach(el => {
    const rect = el.getBoundingClientRect(); // Forces reflow
    if (rect.top < window.innerHeight) {
      el.classList.add('visible');
    }
  });
});
```
- The scroll event can fire 60+ times per second
- getBoundingClientRect() forces the current layout to be computed (Forced Reflow)
- With 100 elements, up to 6,000 layout calculations may occur per second

**IntersectionObserver**:
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
});
elements.forEach(el => observer.observe(el));
```
- The browser notifies at internally optimized timing
- Layout computation does not block the main thread
- Automatically pauses on inactive tabs

Measured results (Chrome DevTools Performance profiling):
- scroll event version: 30-50ms of Scripting time per scroll (jank occurs)
- IntersectionObserver version: 1-3ms of Scripting time per scroll (smooth)

The difference is especially noticeable with large numbers of elements or on mobile devices. It also directly contributes to improving the INP (Interaction to Next Paint) metric of Core Web Vitals.

---

## Summary

| Observer | What It Monitors | Primary Use Cases | Performance |
|----------|-----------------|-------------------|-------------|
| IntersectionObserver | Intersection with the viewport | Lazy loading, infinite scroll, viewability | Does not block the main thread |
| ResizeObserver | Element size changes | Responsive layouts, chart resizing, virtual scroll | No forced layout |
| MutationObserver | DOM changes | Third-party monitoring, auto-initialization, change detection | Executed as microtask |
| PerformanceObserver | Performance events | Web Vitals measurement, resource monitoring, Long Task detection | Asynchronous buffering |

### Selection Guidelines

1. **Need to know if an element is visible** → IntersectionObserver
2. **Need to react to element size changes** → ResizeObserver
3. **Need to detect DOM changes** → MutationObserver
4. **Need to collect performance metrics** → PerformanceObserver
5. **Need continuous scroll position** → scroll event + requestAnimationFrame
6. **Only need window size changes** → matchMedia() or CSS container queries

---

## Further Reading

- [Web Storage (localStorage, sessionStorage, IndexedDB)](../04-storage-and-caching/00-web-storage.md)
- [Performance API Deep Dive](../04-storage-and-caching/02-performance-api.md)
- [Fetch and Streams API](./01-fetch-and-streams.md)

---

## References

1. MDN Web Docs. "Intersection Observer API." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
2. MDN Web Docs. "Resize Observer API." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/Resize_Observer_API
3. MDN Web Docs. "MutationObserver." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
4. MDN Web Docs. "PerformanceObserver." Mozilla, 2024. https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver
5. Web.dev. "Lazy loading images with IntersectionObserver." Google, 2024.
6. Web.dev. "Web Vitals." Google, 2024. https://web.dev/vitals/
7. Philip Walton. "Monitoring Cumulative Layout Shift." web.dev, 2023.
8. Web Incubator CG. "Container Queries." W3C, 2024.
9. W3C. "Intersection Observer Specification." W3C, 2024. https://www.w3.org/TR/intersection-observer/
10. W3C. "Resize Observer Specification." W3C, 2024. https://www.w3.org/TR/resize-observer/
