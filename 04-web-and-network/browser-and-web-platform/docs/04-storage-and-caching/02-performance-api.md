# Performance API

> The Performance API is the foundation for measuring browser performance. By using Navigation Timing, Resource Timing, User Timing, and PerformanceObserver to measure and analyze performance metrics including Core Web Vitals, and integrating with Lighthouse and RUM (Real User Monitoring), you can establish a continuous performance improvement cycle.

---

## Table of Contents

1. [Overview of the Performance API](#1-overview-of-the-performance-api)
2. [Navigation Timing API](#2-navigation-timing-api)
3. [Resource Timing API](#3-resource-timing-api)
4. [User Timing API](#4-user-timing-api)
5. [Using PerformanceObserver](#5-using-performanceobserver)
6. [Measuring Core Web Vitals](#6-measuring-core-web-vitals)
7. [Lighthouse and Performance Auditing](#7-lighthouse-and-performance-auditing)
8. [Sending Performance Data and Building an Analytics Foundation](#8-sending-performance-data-and-building-an-analytics-foundation)
9. [Performance Budgets and CI Integration](#9-performance-budgets-and-ci-integration)
10. [Anti-patterns and Workarounds](#10-anti-patterns-and-workarounds)
11. [Edge Case Analysis](#11-edge-case-analysis)
12. [Tiered Exercises](#12-tiered-exercises)
13. [FAQ](#13-faq)
14. [Comparison Tables](#14-comparison-tables)
15. [References](#15-references)

---

## Prerequisites

To get the most out of this chapter, it is recommended that you have the following background knowledge.

- **Understanding Service Workers and caching**: Many of the performance metrics measured with the Performance API are affected by caching strategies implemented via Service Workers. To understand how Cache First and Stale-While-Revalidate affect resource timing and Core Web Vitals (especially LCP), it is advisable to review [Service Workers and Caching Strategies](./01-service-worker-cache.md) beforehand.
- **Rendering pipeline basics**: Metrics such as Largest Contentful Paint (LCP) and Cumulative Layout Shift (CLS) are closely tied to the browser's rendering process. Understanding the flow from parsing through layout, paint, and compositing makes the mechanisms behind performance metrics clearer. For details, refer to [Rendering Pipeline](../01-rendering/00-rendering-pipeline.md).
- **Core Web Vitals concepts**: The three metrics defined by Google — LCP (Largest Contentful Paint), INP (Interaction to Next Paint), and CLS (Cumulative Layout Shift) — are standard metrics for quantifying user experience. Familiarity with these basic concepts allows you to apply the measurement and improvement techniques in this chapter more practically.

Even without this background knowledge you can still work through this chapter, but reviewing the guides listed above first will deepen your understanding.

---

## What You Will Learn

- [ ] Understand how to use Navigation Timing and Resource Timing
- [ ] Know how to perform custom measurements with User Timing
- [ ] Learn how real-time monitoring works with PerformanceObserver
- [ ] Master measurement and improvement techniques for Core Web Vitals (LCP, INP, CLS)
- [ ] Understand Lighthouse's scoring algorithm and how to use automated audits
- [ ] Practice designing performance budgets and integrating them into CI/CD pipelines
- [ ] Learn how to build a pipeline for collecting, sending, and analyzing RUM data

---

## 1. Overview of the Performance API

### 1.1 Architecture Overview

The Performance API is a set of specifications developed by the W3C that provides a standard foundation for measuring browser performance. The ASCII diagram below shows the major specifications that make up the Performance API and their relationships.

```
+-------------------------------------------------------------------+
|                    Performance Timeline                            |
|  (performance.getEntries / performance.getEntriesByType)          |
+-------------------------------------------------------------------+
        |              |              |              |
        v              v              v              v
+-------------+ +-------------+ +-------------+ +-------------+
| Navigation  | | Resource    | | User        | | Paint       |
| Timing      | | Timing      | | Timing      | | Timing      |
| (navigate,  | | (script,    | | (mark,      | | (first-paint|
|  reload,    | |  css, img,  | |  measure)   | |  first-     |
|  back_fwd)  | |  fetch ...) | |             | |  contentful)|
+-------------+ +-------------+ +-------------+ +-------------+
        |              |              |              |
        v              v              v              v
+-------------------------------------------------------------------+
|                   PerformanceObserver                              |
|  (real-time entry notifications / buffered option)                 |
+-------------------------------------------------------------------+
        |
        v
+-------------------------------------------------------------------+
|  Analytics / RUM Foundation                                        |
|  (Beacon API / fetch keepalive / third-party SDKs)                |
+-------------------------------------------------------------------+
```

### 1.2 Basic Concepts of the Performance Timeline

The Performance Timeline is a mechanism for handling all performance entries in a unified way. Each entry inherits the `PerformanceEntry` interface and has common properties.

| Property         | Type     | Description                                          |
|------------------|----------|------------------------------------------------------|
| `name`           | string   | Identifying name of the entry (URL or mark name)     |
| `entryType`      | string   | Type of the entry                                    |
| `startTime`      | double   | Measurement start time (milliseconds, relative to timeOrigin) |
| `duration`       | double   | Measurement duration (milliseconds)                  |

```javascript
// Basic operations on the Performance Timeline
// Retrieve all entries
const allEntries = performance.getEntries();

// Filter by type
const navEntries = performance.getEntriesByType('navigation');
const resEntries = performance.getEntriesByType('resource');
const markEntries = performance.getEntriesByType('mark');
const measureEntries = performance.getEntriesByType('measure');

// Search by name
const specificEntry = performance.getEntriesByName('my-custom-mark');

// Check the time origin
console.log('Time origin:', performance.timeOrigin);
// => Milliseconds elapsed since the Unix epoch (high-resolution timestamp)

// Current high-resolution timestamp
console.log('Now:', performance.now());
// => Milliseconds elapsed since timeOrigin
```

### 1.3 High-Resolution Timestamps and Spectre Mitigations

`performance.now()` returns a timestamp with microsecond precision, but browsers intentionally reduce this precision as a countermeasure against side-channel attacks such as Spectre.

```
┌─────────────────────────────────────────────────────┐
│  Timestamp Precision Before and After Spectre        │
│  Mitigations                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Before mitigation:                                 │
│           performance.now() => 1234.567890123       │
│                                 ^^^^^^^^^^^^^^^^    │
│                                 microsecond precision│
│                                                     │
│  After mitigation:                                  │
│           performance.now() => 1234.500             │
│           (without Cross-Origin-Isolated)           │
│                                 ^^^^^^^             │
│                                 rounded to 100μs    │
│                                                     │
│  With COOP+COEP configured:                         │
│           performance.now() => 1234.567             │
│                                 ^^^^^^^^^           │
│                                 restored to 5μs     │
│                                                     │
│  * The same configuration is required when using    │
│    SharedArrayBuffer                                │
└─────────────────────────────────────────────────────┘
```

To enable a Cross-Origin-Isolated environment, set the following HTTP headers.

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

## 2. Navigation Timing API

### 2.1 Page Load Lifecycle

The Navigation Timing API measures each stage of the process by which the browser loads a page. The diagram below shows all stages of a page load in chronological order.

```
 navigationStart
       |
       v
 +-----------+    +-----------+    +----------+    +----------+
 | Redirect  |--->|   DNS     |--->|   TCP    |--->|   TLS    |
 | (0-N times)|   |  Lookup   |    | Connect  |    | Handshake|
 +-----------+    +-----------+    +----------+    +----------+
       |                                                 |
       v                                                 v
 +-------------+    +-----------+    +-----------+    +----------+
 | Request     |--->| Response  |--->|  DOM      |--->|  Load    |
 | Send        |    | Receive   |    | Processing|    | Event    |
 | (TTFB calc) |    | (download)|    | (parse +  |    | (onload) |
 +-------------+    +-----------+    |  scripts) |    +----------+
                                     +-----------+
                                          |
                                          v
                                  DOMContentLoaded
```

### 2.2 Detailed Measurement Implementation

```javascript
// Function to systematically measure each stage of page load
function collectNavigationMetrics() {
  const entry = performance.getEntriesByType('navigation')[0];

  if (!entry) {
    console.warn('Navigation Timing entry could not be retrieved');
    return null;
  }

  const metrics = {
    // ========== Network phase ==========
    // Redirect processing time (HTTP 301/302, etc.)
    redirect: {
      duration: entry.redirectEnd - entry.redirectStart,
      count: entry.redirectCount,
      note: 'Many redirects delay initial rendering',
    },

    // DNS resolution time
    dns: {
      duration: entry.domainLookupEnd - entry.domainLookupStart,
      note: 'Can be shortened with DNS prefetch',
    },

    // TCP connection establishment time
    tcp: {
      duration: entry.connectEnd - entry.connectStart,
      note: 'HTTP/2 multiplexing allows connection reuse',
    },

    // TLS handshake time
    tls: {
      duration: entry.secureConnectionStart > 0
        ? entry.connectEnd - entry.secureConnectionStart
        : 0,
      isSecure: entry.secureConnectionStart > 0,
      note: 'TLS 1.3 can reduce this to 1-RTT',
    },

    // ========== Server response phase ==========
    // TTFB (Time to First Byte)
    ttfb: {
      duration: entry.responseStart - entry.requestStart,
      threshold: 800, // ms - recommended upper limit
      note: 'An important metric that includes server processing time',
    },

    // Content download time
    download: {
      duration: entry.responseEnd - entry.responseStart,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      compressionRatio: entry.encodedBodySize > 0
        ? (1 - entry.encodedBodySize / entry.decodedBodySize).toFixed(2)
        : 'N/A',
    },

    // ========== Rendering phase ==========
    // DOM processing time
    domProcessing: {
      duration: entry.domContentLoadedEventEnd - entry.responseEnd,
      interactive: entry.domInteractive - entry.startTime,
      contentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
    },

    // Overall load completion time
    total: {
      loadComplete: entry.loadEventEnd - entry.startTime,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
    },

    // ========== Meta information ==========
    meta: {
      type: entry.type,          // 'navigate', 'reload', 'back_forward', 'prerender'
      protocol: entry.nextHopProtocol, // 'h2', 'h3', 'http/1.1'
      redirectCount: entry.redirectCount,
    },
  };

  return metrics;
}

// Usage: execute after page load completes
window.addEventListener('load', () => {
  // Wait for loadEventEnd to be recorded
  setTimeout(() => {
    const metrics = collectNavigationMetrics();
    if (metrics) {
      console.table({
        'Redirect': `${metrics.redirect.duration.toFixed(0)}ms (${metrics.redirect.count} times)`,
        'DNS Resolution': `${metrics.dns.duration.toFixed(0)}ms`,
        'TCP Connection': `${metrics.tcp.duration.toFixed(0)}ms`,
        'TLS Handshake': `${metrics.tls.duration.toFixed(0)}ms`,
        'TTFB': `${metrics.ttfb.duration.toFixed(0)}ms`,
        'Download': `${metrics.download.duration.toFixed(0)}ms`,
        'DOM Processing': `${metrics.domProcessing.duration.toFixed(0)}ms`,
        'Total': `${metrics.total.loadComplete.toFixed(0)}ms`,
        'Protocol': metrics.meta.protocol,
        'Navigation Type': metrics.meta.type,
      });
    }
  }, 0);
});
```

### 2.3 Identifying and Using Navigation Types

The `PerformanceNavigationTiming.type` property indicates the type of page navigation. This allows analysis by navigation type.

| type value     | Meaning                          | Typical scenario                         |
|----------------|----------------------------------|------------------------------------------|
| `navigate`     | Normal navigation                | Link click, address bar input            |
| `reload`       | Page reload                      | F5, Ctrl+R                               |
| `back_forward` | History navigation               | Browser Back/Forward buttons             |
| `prerender`    | Prerendering                     | Speculative load via Speculation Rules API |

```javascript
// Classify and send metrics by navigation type
function categorizeByNavigationType(metrics) {
  const entry = performance.getEntriesByType('navigation')[0];
  const navType = entry?.type || 'unknown';

  return {
    navigationType: navType,
    metrics,
    // Check the effect of bfcache on back/forward navigation
    bfcacheUsed: navType === 'back_forward' && metrics.total.loadComplete < 50,
    // Near-instant display if prerendered
    prerendered: navType === 'prerender',
  };
}
```

---

## 3. Resource Timing API

### 3.1 Detailed Measurement of Resource Loading

The Resource Timing API measures the loading performance of individual resources other than the HTML document (scripts, stylesheets, images, fonts, API requests, etc.).

```javascript
// Measure load times for individual resources in detail
function analyzeResources() {
  const resources = performance.getEntriesByType('resource');

  // Detailed analysis per resource
  const analysis = resources.map(entry => ({
    // Basic information
    url: entry.name,
    type: entry.initiatorType,
    // script, css, img, link, fetch, xmlhttprequest, beacon, video, audio

    // Timing details
    timing: {
      redirect: entry.redirectEnd - entry.redirectStart,
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      tcp: entry.connectEnd - entry.connectStart,
      tls: entry.secureConnectionStart > 0
        ? entry.connectEnd - entry.secureConnectionStart : 0,
      ttfb: entry.responseStart - entry.requestStart,
      download: entry.responseEnd - entry.responseStart,
      total: entry.duration,
    },

    // Size information
    size: {
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    },

    // Cache determination
    cache: {
      fromCache: entry.transferSize === 0 && entry.decodedBodySize > 0,
      fromServiceWorker: entry.workerStart > 0,
      // Detecting 304 Not Modified
      conditionalRequest: entry.transferSize > 0
        && entry.transferSize < entry.encodedBodySize,
    },

    // Detecting HTTP/2 Server Push
    serverPush: entry.transferSize > 0
      && entry.requestStart === entry.responseStart,

    // Render-blocking determination
    renderBlocking: entry.renderBlockingStatus || 'unknown',
  }));

  return analysis;
}

// Detecting and reporting slow resources
function detectSlowResources(thresholdMs = 1000) {
  const resources = performance.getEntriesByType('resource');

  const slowResources = resources
    .filter(r => r.duration > thresholdMs)
    .sort((a, b) => b.duration - a.duration)
    .map(r => ({
      url: new URL(r.name).pathname,  // Show only the path
      duration: `${r.duration.toFixed(0)}ms`,
      type: r.initiatorType,
      size: `${(r.transferSize / 1024).toFixed(1)}KB`,
      bottleneck: identifyBottleneck(r),
    }));

  return slowResources;
}

// Automatic bottleneck identification
function identifyBottleneck(entry) {
  const timing = {
    dns: entry.domainLookupEnd - entry.domainLookupStart,
    tcp: entry.connectEnd - entry.connectStart,
    ttfb: entry.responseStart - entry.requestStart,
    download: entry.responseEnd - entry.responseStart,
  };

  const max = Object.entries(timing)
    .reduce((a, b) => a[1] > b[1] ? a : b);

  return { phase: max[0], duration: `${max[1].toFixed(0)}ms` };
}
```

### 3.2 Aggregated Dashboard by Resource Type

```javascript
// Aggregate by resource type to understand the overall performance picture
function createResourceDashboard() {
  const resources = performance.getEntriesByType('resource');

  const dashboard = {};

  resources.forEach(r => {
    const type = r.initiatorType || 'other';

    if (!dashboard[type]) {
      dashboard[type] = {
        count: 0,
        totalSize: 0,
        totalDuration: 0,
        maxDuration: 0,
        cachedCount: 0,
        entries: [],
      };
    }

    const group = dashboard[type];
    group.count++;
    group.totalSize += r.transferSize;
    group.totalDuration += r.duration;
    group.maxDuration = Math.max(group.maxDuration, r.duration);

    if (r.transferSize === 0 && r.decodedBodySize > 0) {
      group.cachedCount++;
    }

    group.entries.push(r);
  });

  // Format aggregation results
  const summary = Object.entries(dashboard).map(([type, data]) => ({
    type,
    count: data.count,
    totalSize: `${(data.totalSize / 1024).toFixed(1)}KB`,
    avgDuration: `${(data.totalDuration / data.count).toFixed(0)}ms`,
    maxDuration: `${data.maxDuration.toFixed(0)}ms`,
    cacheHitRate: `${((data.cachedCount / data.count) * 100).toFixed(0)}%`,
  }));

  console.table(summary);
  return summary;
}
```

### 3.3 Timing-Allow-Origin and Cross-Origin Restrictions

Measuring cross-origin resources requires the server to set the `Timing-Allow-Origin` header. Without this header, many timing values are restricted to zero.

```
Cross-origin resource timing information restrictions:

┌──────────────────────────────────────────────────────────────┐
│  Without Timing-Allow-Origin header (default)                │
│                                                              │
│  Available:                                                  │
│    - startTime, duration                                     │
│    - transferSize = 0 (hidden)                               │
│    - encodedBodySize = 0 (hidden)                            │
│    - decodedBodySize = 0 (hidden)                            │
│                                                              │
│  Restricted to zero:                                         │
│    - redirectStart / redirectEnd                             │
│    - domainLookupStart / domainLookupEnd                     │
│    - connectStart / connectEnd                               │
│    - secureConnectionStart                                   │
│    - requestStart / responseStart                            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Timing-Allow-Origin: * (or specific origin)                 │
│                                                              │
│  All timing values are available                             │
│  Size information is also reported accurately                │
└──────────────────────────────────────────────────────────────┘
```

```javascript
// Check Timing-Allow-Origin and detect its impact
function checkTimingAccess() {
  const resources = performance.getEntriesByType('resource');
  const crossOrigin = resources.filter(r => {
    try {
      return new URL(r.name).origin !== location.origin;
    } catch {
      return false;
    }
  });

  const restricted = crossOrigin.filter(r =>
    r.requestStart === 0 && r.responseStart === 0
  );

  console.log(`Cross-origin resources: ${crossOrigin.length}`);
  console.log(`Timing-restricted: ${restricted.length}`);
  console.log('Restricted resource list:');
  restricted.forEach(r => {
    console.log(`  - ${new URL(r.name).hostname}${new URL(r.name).pathname}`);
  });
}
```

---

## 4. User Timing API

### 4.1 Basics of mark and measure

The User Timing API provides a mechanism for developers to define application-specific performance measurement points. Use `performance.mark()` to record timestamps and `performance.measure()` to calculate the elapsed time between two points.

```javascript
// ==================================================
// Basic operations and practical patterns of the User Timing API
// ==================================================

// (1) Basic mark and measure
performance.mark('app-init-start');

// Application initialization processing
initializeApp();
loadConfiguration();
setupEventHandlers();

performance.mark('app-init-end');

// Measure the time between two marks
performance.measure('app-initialization', 'app-init-start', 'app-init-end');

const initMeasure = performance.getEntriesByName('app-initialization')[0];
console.log(`App initialization: ${initMeasure.duration.toFixed(2)}ms`);


// (2) Attaching metadata to a mark (Performance API Level 3)
performance.mark('data-fetch-complete', {
  detail: {
    endpoint: '/api/users',
    recordCount: 150,
    cacheHit: false,
  },
});

// Retrieving metadata
const fetchMark = performance.getEntriesByName('data-fetch-complete')[0];
console.log('Record count:', fetchMark.detail.recordCount);


// (3) Metadata can also be attached to measures
performance.measure('api-call', {
  start: 'api-call-start',
  end: 'api-call-end',
  detail: {
    url: '/api/products',
    method: 'GET',
    status: 200,
  },
});


// (4) Measure elapsed time from navigationStart
performance.measure('time-to-interactive', {
  start: 0,  // Use navigationStart as the reference point
  end: performance.now(),
});


// (5) Cleaning up entries
performance.clearMarks('app-init-start');
performance.clearMarks('app-init-end');
performance.clearMeasures('app-initialization');

// Clear all entries
performance.clearMarks();     // Delete all marks
performance.clearMeasures();  // Delete all measures
```

### 4.2 Collection of Practical Measurement Patterns

```javascript
// ==================================================
// Pattern 1: Async function measurement wrapper
// ==================================================
async function measureAsync(name, asyncFn) {
  const markStart = `${name}-start`;
  const markEnd = `${name}-end`;

  performance.mark(markStart);

  try {
    const result = await asyncFn();

    performance.mark(markEnd);
    performance.measure(name, markStart, markEnd);

    const entry = performance.getEntriesByName(name).pop();
    console.log(`[Perf] ${name}: ${entry.duration.toFixed(1)}ms`);

    return result;
  } catch (error) {
    performance.mark(markEnd);
    performance.measure(`${name}-failed`, markStart, markEnd);

    const entry = performance.getEntriesByName(`${name}-failed`).pop();
    console.error(`[Perf] ${name} FAILED: ${entry.duration.toFixed(1)}ms`);

    throw error;
  }
}

// Usage example
const users = await measureAsync('fetch-users', () =>
  fetch('/api/users').then(r => r.json())
);


// ==================================================
// Pattern 2: React component lifecycle measurement
// ==================================================
function usePerformanceMark(componentName) {
  const markPrefix = `component-${componentName}`;

  useEffect(() => {
    performance.mark(`${markPrefix}-mount`);

    return () => {
      performance.mark(`${markPrefix}-unmount`);
      performance.measure(
        `${markPrefix}-lifetime`,
        `${markPrefix}-mount`,
        `${markPrefix}-unmount`
      );

      const entry = performance.getEntriesByName(
        `${markPrefix}-lifetime`
      ).pop();
      console.log(
        `${componentName} lifetime: ${entry.duration.toFixed(0)}ms`
      );
    };
  }, []);
}

// Usage example
function ProductList() {
  usePerformanceMark('ProductList');

  return (
    <ul>
      {products.map(p => <ProductItem key={p.id} product={p} />)}
    </ul>
  );
}


// ==================================================
// Pattern 3: Route transition measurement
// ==================================================
class RoutePerformanceTracker {
  constructor() {
    this.currentRoute = null;
    this.transitionCount = 0;
  }

  startTransition(fromRoute, toRoute) {
    this.transitionCount++;
    const id = `route-transition-${this.transitionCount}`;

    performance.mark(`${id}-start`, {
      detail: { from: fromRoute, to: toRoute },
    });

    this.currentRoute = { id, from: fromRoute, to: toRoute };
  }

  endTransition() {
    if (!this.currentRoute) return;

    const { id } = this.currentRoute;

    performance.mark(`${id}-end`);
    performance.measure(id, `${id}-start`, `${id}-end`);

    const entry = performance.getEntriesByName(id).pop();
    console.log(
      `Route ${this.currentRoute.from} -> ${this.currentRoute.to}: ` +
      `${entry.duration.toFixed(0)}ms`
    );

    this.currentRoute = null;
    return entry;
  }
}
```

---

## 5. Using PerformanceObserver

### 5.1 Basic Usage

PerformanceObserver is an implementation of the Observer pattern that invokes a callback each time a performance entry is recorded. Because it retrieves entries in an event-driven manner rather than polling, it enables efficient, real-time measurement.

```javascript
// ==================================================
// Basic operations of PerformanceObserver
// ==================================================

// (1) Observe a specific entryType
const resourceObserver = new PerformanceObserver((list, observer) => {
  const entries = list.getEntries();

  entries.forEach(entry => {
    console.log(`[Resource] ${entry.name}: ${entry.duration.toFixed(0)}ms`);
  });
});

// Start observing
resourceObserver.observe({
  type: 'resource',
  buffered: true,  // Also include past entries
});


// (2) Observe multiple entryTypes simultaneously
const multiObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    switch (entry.entryType) {
      case 'resource':
        handleResourceEntry(entry);
        break;
      case 'mark':
        handleMarkEntry(entry);
        break;
      case 'measure':
        handleMeasureEntry(entry);
        break;
    }
  }
});

// Pass an array using entryTypes (plural)
multiObserver.observe({
  entryTypes: ['resource', 'mark', 'measure'],
});


// (3) Stop observing
resourceObserver.disconnect();


// (4) Retrieve the list of observable entryTypes
const supportedTypes = PerformanceObserver.supportedEntryTypes;
console.log('Supported entryTypes:', supportedTypes);
// Typical output:
// ['element', 'event', 'first-input', 'largest-contentful-paint',
//  'layout-shift', 'longtask', 'mark', 'measure', 'navigation',
//  'paint', 'resource', 'visibility-state']
```

### 5.2 Importance of the buffered Option

`buffered: true` is an option that also retrieves entries recorded before the Observer was registered. In cases where a script executes after page load completion (scripts loaded with `defer` or `async`), without this option, initial entries will be missed.

```javascript
// Effect of the buffered option
//
// Script execution time: T = 3000ms
// Page load start: T = 0ms
//
// With buffered: false:
//   Entries that occurred from T=0 to T=3000 cannot be retrieved
//
// With buffered: true:
//   Entries that occurred from T=0 to T=3000 are also included

// Typical usage (safely used in deferred-load scripts)
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Past entries are also processed
    processEntry(entry);
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

### 5.3 Detecting Long Tasks

Tasks on the main thread that exceed 50ms are defined as "Long Tasks" and cause delayed responses to user input. You can use PerformanceObserver to detect these and identify the causes of degraded interaction quality.

```javascript
// Monitoring and analyzing Long Tasks
const longTasks = [];

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    longTasks.push({
      startTime: entry.startTime,
      duration: entry.duration,
      // Use attribution to identify the script responsible
      attribution: entry.attribution?.map(attr => ({
        name: attr.name,
        containerType: attr.containerType,
        containerSrc: attr.containerSrc,
        containerId: attr.containerId,
        containerName: attr.containerName,
      })),
    });

    if (entry.duration > 100) {
      console.warn(
        `[Long Task] ${entry.duration.toFixed(0)}ms at ` +
        `T+${entry.startTime.toFixed(0)}ms`
      );
    }
  }
}).observe({ type: 'longtask', buffered: true });

// Output a summary at a fixed interval
setInterval(() => {
  if (longTasks.length === 0) return;

  const total = longTasks.reduce((sum, t) => sum + t.duration, 0);
  const avg = total / longTasks.length;
  const max = Math.max(...longTasks.map(t => t.duration));

  console.log(`Long Tasks summary:
    Count: ${longTasks.length}
    Total: ${total.toFixed(0)}ms
    Average: ${avg.toFixed(0)}ms
    Max: ${max.toFixed(0)}ms
  `);
}, 10000);
```

---

## 6. Measuring Core Web Vitals

### 6.1 Overview of Core Web Vitals

Core Web Vitals are three key metrics defined by Google for evaluating the quality of user experience. Since 2024, INP (Interaction to Next Paint) has officially replaced FID (First Input Delay).

```
┌─────────────────────────────────────────────────────────────────┐
│                    Core Web Vitals (2024~)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LCP (Largest Contentful Paint)                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Time until the page's main content is displayed        │   │
│  │                                                         │   │
│  │  Good        Needs Improvement     Poor                 │   │
│  │  |<--- 2.5s --->|<--- 4.0s --->|<--- ... --->|         │   │
│  │  [ Green: Good ] [ Yellow: Improve ] [ Red: Poor ]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  INP (Interaction to Next Paint)                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Response time from user interaction to screen update   │   │
│  │                                                         │   │
│  │  Good        Needs Improvement     Poor                 │   │
│  │  |<--- 200ms --->|<--- 500ms --->|<--- ... --->|       │   │
│  │  [ Green: Good ]  [ Yellow: Improve ] [ Red: Poor ]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CLS (Cumulative Layout Shift)                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Visual stability (cumulative value of layout shifts)   │   │
│  │                                                         │   │
│  │  Good        Needs Improvement     Poor                 │   │
│  │  |<--- 0.1 --->|<--- 0.25 --->|<--- ... --->|         │   │
│  │  [ Green: Good ] [ Yellow: Improve ] [ Red: Poor ]     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Measurement Using the web-vitals Library

The `web-vitals` library officially provided by Google is the recommended tool for measuring Core Web Vitals in a standardized way.

```javascript
// ==================================================
// Comprehensive measurement using the web-vitals library
// ==================================================
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

// (1) Basic usage
onLCP((metric) => {
  console.log('LCP:', metric.value, 'ms');
  console.log('  Rating:', metric.rating);       // 'good' | 'needs-improvement' | 'poor'
  console.log('  Element:', metric.entries);       // LCP target element
  console.log('  delta:', metric.delta, 'ms');    // Change since last report
  console.log('  ID:', metric.id);                // Unique identifier
  console.log('  navigationType:', metric.navigationType);
  sendToAnalytics({ name: 'LCP', ...metric });
});

onINP((metric) => {
  console.log('INP:', metric.value, 'ms');
  console.log('  Rating:', metric.rating);
  // INP entries contain the slowest interaction
  const worstEntry = metric.entries[0];
  if (worstEntry) {
    console.log('  Event type:', worstEntry.name);
    console.log('  Processing time:', worstEntry.processingEnd - worstEntry.processingStart, 'ms');
    console.log('  Input delay:', worstEntry.processingStart - worstEntry.startTime, 'ms');
    console.log('  Presentation delay:', worstEntry.startTime + worstEntry.duration - worstEntry.processingEnd, 'ms');
  }
  sendToAnalytics({ name: 'INP', ...metric });
});

onCLS((metric) => {
  console.log('CLS:', metric.value);
  console.log('  Rating:', metric.rating);
  // CLS entries contain details of each layout shift
  metric.entries.forEach(entry => {
    console.log('  Shift value:', entry.value);
    console.log('  Had recent input:', entry.hadRecentInput);
    // Identify the shifted element
    entry.sources?.forEach(source => {
      console.log('  Element:', source.node);
      console.log('  Previous rect:', source.previousRect);
      console.log('  Current rect:', source.currentRect);
    });
  });
  sendToAnalytics({ name: 'CLS', ...metric });
});

// (2) Measuring supplementary metrics
onFCP((metric) => {
  console.log('FCP:', metric.value, 'ms');
  sendToAnalytics({ name: 'FCP', ...metric });
});

onTTFB((metric) => {
  console.log('TTFB:', metric.value, 'ms');
  sendToAnalytics({ name: 'TTFB', ...metric });
});

// (3) Analytics data sending function
function sendToAnalytics(data) {
  const payload = JSON.stringify({
    name: data.name,
    value: data.value,
    rating: data.rating,
    delta: data.delta,
    id: data.id,
    navigationType: data.navigationType,
    url: location.href,
    timestamp: Date.now(),
    // Device information
    connection: navigator.connection?.effectiveType,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });

  // Send reliably via the Beacon API
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/web-vitals', payload);
  } else {
    fetch('/api/web-vitals', {
      method: 'POST',
      body: payload,
      keepalive: true,
    });
  }
}
```

### 6.3 Manual Core Web Vitals Measurement

It is also important to understand how to measure directly with PerformanceObserver without using the web-vitals library. Understanding the library's internal behavior makes troubleshooting easier.

```javascript
// ==================================================
// Manual measurement with PerformanceObserver
// ==================================================

// --- Manual LCP measurement ---
// LCP is reported multiple times (the last value is the final LCP)
let lcpValue = 0;
let lcpElement = null;

new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];

  lcpValue = lastEntry.startTime;
  lcpElement = lastEntry.element;  // LCP target DOM element

  console.log('LCP candidate:', {
    value: lcpValue.toFixed(0) + 'ms',
    element: lcpElement?.tagName,
    url: lastEntry.url,           // URL in the case of an image
    size: lastEntry.size,         // Element area (pixels)
    loadTime: lastEntry.loadTime, // Resource load completion time
    renderTime: lastEntry.renderTime, // Rendering time
  });
}).observe({ type: 'largest-contentful-paint', buffered: true });


// --- Manual CLS measurement ---
// CLS is calculated using the Session Window method
let clsValue = 0;
let clsEntries = [];
let sessionValue = 0;
let sessionEntries = [];
let previousSessionEnd = 0;

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Exclude shifts caused by user input
    if (entry.hadRecentInput) continue;

    // Session Window rules:
    // - A gap of 1 second or more starts a new session
    // - A session is at most 5 seconds long
    if (
      sessionEntries.length > 0 &&
      (entry.startTime - previousSessionEnd > 1000 ||
       entry.startTime - sessionEntries[0].startTime > 5000)
    ) {
      // Start a new session
      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = [...sessionEntries];
      }
      sessionValue = 0;
      sessionEntries = [];
    }

    sessionValue += entry.value;
    sessionEntries.push(entry);
    previousSessionEnd = entry.startTime + entry.duration;
  }

  // Also update if the current session is the largest
  if (sessionValue > clsValue) {
    clsValue = sessionValue;
    clsEntries = [...sessionEntries];
  }

  console.log('CLS:', clsValue.toFixed(4));
}).observe({ type: 'layout-shift', buffered: true });


// --- Manual INP measurement ---
// INP is based on the slowest response among all interactions
// (uses the 98th percentile)
const interactions = [];

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Only entries with an interactionId are interactions
    if (!entry.interactionId) continue;

    const existing = interactions.find(
      i => i.interactionId === entry.interactionId
    );

    if (existing) {
      // For multiple events of the same interaction, use the maximum value
      existing.duration = Math.max(existing.duration, entry.duration);
    } else {
      interactions.push({
        interactionId: entry.interactionId,
        duration: entry.duration,
        name: entry.name,
        startTime: entry.startTime,
        processingStart: entry.processingStart,
        processingEnd: entry.processingEnd,
        target: entry.target,
      });
    }
  }

  // Calculate INP (98th percentile)
  if (interactions.length > 0) {
    const sorted = [...interactions].sort(
      (a, b) => b.duration - a.duration
    );
    // Use 98th percentile when there are 50 or more interactions
    const index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length / 50)
    );
    const inp = sorted[index].duration;
    console.log('INP:', inp, 'ms');
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 16 });
```

### 6.4 INP Internal Structure and Optimization Points

INP measures the total time from a user interaction (click, tap, key press) to the next paint update. This time can be broken down into three phases.

```
INP Breakdown (Interaction to Next Paint)

User action         Paint update
    |                    |
    v                    v
    +----+----+----+----+
    | ID | PT | PD | ?? |
    +----+----+----+----+

    ID = Input Delay
         Time that the event handler's execution start is delayed
         because the main thread is busy
         Cause: Long Tasks, heavy JavaScript execution

    PT = Processing Time
         Event handler execution time
         Cause: Heavy computation, synchronous DOM operations

    PD = Presentation Delay
         Time from event handler completion until the screen
         is actually updated
         Cause: Style recalculation, layout, paint, composite

    ┌──────────────────────────────────────────────────────────┐
    │  INP = ID + PT + PD                                     │
    │                                                         │
    │  Optimization priority:                                 │
    │  1. Input Delay   -> yield to main thread               │
    │  2. Processing    -> split / defer / optimize work      │
    │  3. Presentation  -> minimize DOM operations            │
    └──────────────────────────────────────────────────────────┘
```

```javascript
// Analyze each phase of INP separately
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.interactionId) continue;

    const inputDelay = entry.processingStart - entry.startTime;
    const processingTime = entry.processingEnd - entry.processingStart;
    const presentationDelay = entry.startTime + entry.duration
      - entry.processingEnd;

    if (entry.duration > 200) {
      console.warn(`[INP Warning] ${entry.name} on ${entry.target?.tagName}`, {
        total: `${entry.duration}ms`,
        inputDelay: `${inputDelay.toFixed(0)}ms`,
        processingTime: `${processingTime.toFixed(0)}ms`,
        presentationDelay: `${presentationDelay.toFixed(0)}ms`,
        bottleneck: inputDelay > processingTime
          ? (inputDelay > presentationDelay ? 'Input Delay' : 'Presentation')
          : (processingTime > presentationDelay ? 'Processing' : 'Presentation'),
      });
    }
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 16 });
```

---

## 7. Lighthouse and Performance Auditing

### 7.1 Lighthouse Scoring Model

Lighthouse evaluates performance on a scale of 100. The score is calculated as a weighted average of multiple metrics, and each metric is mapped to a scoring curve based on a log-normal distribution.

| Metric                         | Weight | Good threshold | Poor threshold |
|-------------------------------|--------|----------------|----------------|
| FCP (First Contentful Paint)  | 10%    | 1.8s           | 3.0s           |
| SI (Speed Index)              | 10%    | 3.4s           | 5.8s           |
| LCP (Largest Contentful Paint)| 25%    | 2.5s           | 4.0s           |
| TBT (Total Blocking Time)     | 30%    | 200ms          | 600ms          |
| CLS (Cumulative Layout Shift) | 25%    | 0.1            | 0.25           |

* TBT is used as a lab proxy metric for INP. Because INP can only be measured from field (real user) data, TBT serves as its substitute in Lighthouse.

### 7.2 Automating Lighthouse CI

```javascript
// lighthouserc.js - Lighthouse CI configuration file
module.exports = {
  ci: {
    collect: {
      // List of URLs to measure
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/checkout',
      ],
      // Number of runs (odd number recommended to use the median)
      numberOfRuns: 5,
      // Chrome launch options
      settings: {
        chromeFlags: '--no-sandbox --headless',
        // Throttling settings (equivalent to mobile 4G)
        throttling: {
          cpuSlowdownMultiplier: 4,
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
          rttMs: 150,
        },
        // Form factor
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 823,
          deviceScaleFactor: 1.75,
        },
      },
    },
    assert: {
      // Performance budget
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        // Individual metric thresholds
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],
        // Resource size limits
        'resource-summary:script:size': [
          'error', { maxNumericValue: 300 * 1024 },  // 300KB
        ],
        'resource-summary:total:size': [
          'warn', { maxNumericValue: 1500 * 1024 },   // 1.5MB
        ],
      },
    },
    upload: {
      // Upload to Lighthouse CI Server
      target: 'lhci',
      serverBaseUrl: 'https://lhci.example.com',
      token: process.env.LHCI_TOKEN,
    },
  },
};
```

### 7.3 Integrating Lighthouse CI with GitHub Actions

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start server
        run: npm run preview &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_TOKEN: ${{ secrets.LHCI_TOKEN }}
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Upload Lighthouse results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: lighthouse-results
          path: .lighthouseci/
```

### 7.4 Programmatic Lighthouse Execution

```javascript
// Run Lighthouse programmatically in Node.js
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

async function runLighthouse(url, options = {}) {
  // Launch Chrome
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox'],
  });

  const defaultOptions = {
    logLevel: 'info',
    output: 'json',
    port: chrome.port,
    onlyCategories: ['performance'],
    // Custom throttling settings
    throttling: {
      cpuSlowdownMultiplier: 4,
      downloadThroughputKbps: 1600,
      uploadThroughputKbps: 750,
      rttMs: 150,
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const result = await lighthouse(url, mergedOptions);

    // Retrieve scores and individual metrics
    const { lhr } = result;
    const perfScore = lhr.categories.performance.score * 100;

    const metrics = {
      score: perfScore,
      fcp: lhr.audits['first-contentful-paint'].numericValue,
      lcp: lhr.audits['largest-contentful-paint'].numericValue,
      tbt: lhr.audits['total-blocking-time'].numericValue,
      cls: lhr.audits['cumulative-layout-shift'].numericValue,
      si: lhr.audits['speed-index'].numericValue,
      tti: lhr.audits['interactive'].numericValue,
    };

    console.log(`Performance Score: ${perfScore}/100`);
    console.table(metrics);

    // Retrieve improvement suggestions
    const opportunities = Object.values(lhr.audits)
      .filter(audit => audit.details?.type === 'opportunity')
      .filter(audit => audit.details?.overallSavingsMs > 0)
      .sort((a, b) =>
        b.details.overallSavingsMs - a.details.overallSavingsMs
      )
      .map(audit => ({
        title: audit.title,
        savings: `${audit.details.overallSavingsMs.toFixed(0)}ms`,
        description: audit.description,
      }));

    console.log('Improvement suggestions:');
    opportunities.forEach((opp, i) => {
      console.log(`  ${i + 1}. ${opp.title} (saves ${opp.savings})`);
    });

    return { metrics, opportunities, fullReport: lhr };
  } finally {
    await chrome.kill();
  }
}

// Usage example
const result = await runLighthouse('https://example.com');
```

---

## 8. Sending Performance Data and Building an Analytics Foundation

### 8.1 Beacon API and fetch keepalive

The most important aspect of sending performance data is that data is not lost even when the user navigates away from the page. The Beacon API and the `keepalive` option for `fetch` are designed to meet this requirement.

```javascript
// ==================================================
// Implementation patterns for sending performance data
// ==================================================

class PerformanceReporter {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.buffer = [];
    this.flushInterval = 10000; // Flush buffer every 10 seconds
    this.maxBufferSize = 50;    // Maximum number of items in the buffer

    this._setupAutoFlush();
    this._setupUnloadHandler();
  }

  // Add a metric to the buffer
  record(metric) {
    this.buffer.push({
      ...metric,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      connection: navigator.connection?.effectiveType || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
    });

    // Flush immediately if the buffer reaches its limit
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  // Send the buffer contents
  flush() {
    if (this.buffer.length === 0) return;

    const payload = JSON.stringify(this.buffer);
    this.buffer = [];

    // Prefer using the Beacon API
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon(this.endpoint, blob);

      if (!success) {
        // Fallback if the Beacon API fails
        this._fetchFallback(payload);
      }
      return;
    }

    this._fetchFallback(payload);
  }

  _fetchFallback(payload) {
    fetch(this.endpoint, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,  // Continue sending even after the page is unloaded
    }).catch(err => {
      console.warn('Failed to send performance data:', err);
    });
  }

  _setupAutoFlush() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  _setupUnloadHandler() {
    // visibilitychange is more reliable than unload/beforeunload
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}

// Usage example
const reporter = new PerformanceReporter('/api/performance');

// Integrate with web-vitals
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(metric => reporter.record({ name: 'LCP', value: metric.value, rating: metric.rating }));
onINP(metric => reporter.record({ name: 'INP', value: metric.value, rating: metric.rating }));
onCLS(metric => reporter.record({ name: 'CLS', value: metric.value, rating: metric.rating }));
```

### 8.2 Building RUM (Real User Monitoring)

RUM is a mechanism for collecting and analyzing performance data from actual user environments. It allows you to understand performance across diverse device and network environments that cannot be reproduced by synthetic monitoring (such as Lighthouse).

```javascript
// ==================================================
// Comprehensive implementation of RUM data collection
// ==================================================
class RUMCollector {
  constructor(config) {
    this.config = {
      endpoint: config.endpoint,
      sampleRate: config.sampleRate || 1.0,  // 1.0 = 100%
      appVersion: config.appVersion || 'unknown',
      environment: config.environment || 'production',
    };

    // Sampling decision
    this.shouldCollect = Math.random() < this.config.sampleRate;

    if (this.shouldCollect) {
      this._initCollectors();
    }
  }

  _initCollectors() {
    this._collectNavigationTiming();
    this._collectWebVitals();
    this._collectResourceTiming();
    this._collectErrors();
    this._collectLongTasks();
  }

  _collectNavigationTiming() {
    // Measure after page load completes
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return;

        this._send('navigation', {
          dns: nav.domainLookupEnd - nav.domainLookupStart,
          tcp: nav.connectEnd - nav.connectStart,
          ttfb: nav.responseStart - nav.requestStart,
          download: nav.responseEnd - nav.responseStart,
          domProcessing: nav.domContentLoadedEventEnd - nav.responseEnd,
          loadComplete: nav.loadEventEnd - nav.startTime,
          transferSize: nav.transferSize,
          protocol: nav.nextHopProtocol,
          type: nav.type,
        });
      }, 0);
    });
  }

  _collectWebVitals() {
    // Load web-vitals via dynamic import
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      onLCP(m => this._send('vital', { name: 'LCP', value: m.value, rating: m.rating }));
      onINP(m => this._send('vital', { name: 'INP', value: m.value, rating: m.rating }));
      onCLS(m => this._send('vital', { name: 'CLS', value: m.value, rating: m.rating }));
      onFCP(m => this._send('vital', { name: 'FCP', value: m.value, rating: m.rating }));
      onTTFB(m => this._send('vital', { name: 'TTFB', value: m.value, rating: m.rating }));
    });
  }

  _collectResourceTiming() {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Report only slow resources (threshold: 2 seconds)
        if (entry.duration > 2000) {
          this._send('slow-resource', {
            url: entry.name,
            type: entry.initiatorType,
            duration: entry.duration,
            size: entry.transferSize,
            cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
          });
        }
      }
    }).observe({ type: 'resource', buffered: true });
  }

  _collectErrors() {
    window.addEventListener('error', (event) => {
      this._send('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'uncaught',
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this._send('error', {
        message: event.reason?.message || String(event.reason),
        type: 'unhandled-rejection',
      });
    });
  }

  _collectLongTasks() {
    if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      return;
    }

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
          this._send('long-task', {
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      }
    }).observe({ type: 'longtask' });
  }

  _send(type, data) {
    const payload = {
      type,
      data,
      context: {
        url: location.href,
        referrer: document.referrer,
        appVersion: this.config.appVersion,
        environment: this.config.environment,
        timestamp: Date.now(),
        sessionId: this._getSessionId(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        connection: {
          effectiveType: navigator.connection?.effectiveType,
          downlink: navigator.connection?.downlink,
          rtt: navigator.connection?.rtt,
          saveData: navigator.connection?.saveData,
        },
      },
    };

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.config.endpoint, body);
    } else {
      fetch(this.config.endpoint, {
        method: 'POST',
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  _getSessionId() {
    let sessionId = sessionStorage.getItem('rum-session-id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('rum-session-id', sessionId);
    }
    return sessionId;
  }
}

// Initialization
const rum = new RUMCollector({
  endpoint: '/api/rum',
  sampleRate: 0.1,  // Collect data from 10% of users
  appVersion: '2.3.1',
  environment: 'production',
});
```

---

## 9. Performance Budgets and CI Integration

### 9.1 Designing a Performance Budget

A performance budget is a quantitative definition of the performance goals that a web application should achieve. By sharing it across the team and automatically validating it in a CI/CD pipeline, you can prevent performance regressions.

```
┌───────────────────────────────────────────────────────────────┐
│           Performance Budget Design Flow                      │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Competitive Analysis                                      │
│     ├── Research Core Web Vitals of competing sites          │
│     ├── Reference CrUX (Chrome UX Report) data               │
│     └── Compare against industry averages                    │
│                                                               │
│  2. Goal Setting                                              │
│     ├── Core Web Vitals thresholds                           │
│     ├── Resource size limits                                  │
│     ├── Request count limits                                  │
│     └── Time to Interactive target values                     │
│                                                               │
│  3. Automated Validation                                      │
│     ├── Bundle monitoring with bundlesize / size-limit        │
│     ├── Score monitoring with Lighthouse CI                   │
│     └── Diff reports as PR comments                          │
│                                                               │
│  4. Continuous Improvement                                    │
│     ├── Weekly performance reviews                            │
│     ├── Alerts when budgets are exceeded                      │
│     └── Prioritization of improvement initiatives             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 9.2 Bundle Size Monitoring with size-limit

```javascript
// Add size-limit configuration to package.json
// package.json (excerpt)
{
  "size-limit": [
    {
      "name": "Main bundle",
      "path": "dist/assets/index-*.js",
      "limit": "150 kB",
      "gzip": true
    },
    {
      "name": "CSS",
      "path": "dist/assets/index-*.css",
      "limit": "30 kB",
      "gzip": true
    },
    {
      "name": "Vendor bundle",
      "path": "dist/assets/vendor-*.js",
      "limit": "200 kB",
      "gzip": true
    },
    {
      "name": "Initial load total",
      "path": [
        "dist/assets/index-*.js",
        "dist/assets/index-*.css",
        "dist/assets/vendor-*.js"
      ],
      "limit": "350 kB",
      "gzip": true
    }
  ],
  "scripts": {
    "size": "size-limit",
    "size:check": "size-limit --json"
  }
}
```

### 9.3 Custom Performance Budget Checker

```javascript
// ==================================================
// Performance budget definition and validation
// ==================================================

const PERFORMANCE_BUDGETS = {
  // Core Web Vitals budget
  vitals: {
    LCP: { good: 2500, poor: 4000, unit: 'ms' },
    INP: { good: 200, poor: 500, unit: 'ms' },
    CLS: { good: 0.1, poor: 0.25, unit: '' },
    FCP: { good: 1800, poor: 3000, unit: 'ms' },
    TTFB: { good: 800, poor: 1800, unit: 'ms' },
  },

  // Resource budget
  resources: {
    totalTransferSize: 1500 * 1024,   // 1.5MB
    totalRequests: 80,
    scriptSize: 300 * 1024,           // 300KB
    imageSize: 500 * 1024,            // 500KB
    fontSize: 100 * 1024,             // 100KB
    thirdPartySize: 200 * 1024,       // 200KB
  },

  // Timing budget
  timing: {
    domContentLoaded: 3000,  // ms
    loadComplete: 5000,      // ms
    domInteractive: 2000,    // ms
  },
};

function checkBudgets(collectedData) {
  const violations = [];

  // Check Core Web Vitals
  for (const [name, budget] of Object.entries(PERFORMANCE_BUDGETS.vitals)) {
    const value = collectedData.vitals?.[name];
    if (value === undefined) continue;

    if (value > budget.poor) {
      violations.push({
        severity: 'error',
        metric: name,
        value: `${value}${budget.unit}`,
        budget: `${budget.poor}${budget.unit}`,
        message: `${name} exceeds the poor threshold (${budget.poor}${budget.unit})`,
      });
    } else if (value > budget.good) {
      violations.push({
        severity: 'warning',
        metric: name,
        value: `${value}${budget.unit}`,
        budget: `${budget.good}${budget.unit}`,
        message: `${name} exceeds the good threshold (${budget.good}${budget.unit})`,
      });
    }
  }

  // Check resource budget
  const resources = performance.getEntriesByType('resource');
  const totalSize = resources.reduce((sum, r) => sum + r.transferSize, 0);
  const totalRequests = resources.length;

  if (totalSize > PERFORMANCE_BUDGETS.resources.totalTransferSize) {
    violations.push({
      severity: 'error',
      metric: 'Total Transfer Size',
      value: `${(totalSize / 1024).toFixed(0)}KB`,
      budget: `${(PERFORMANCE_BUDGETS.resources.totalTransferSize / 1024).toFixed(0)}KB`,
      message: 'Total transfer size exceeds the budget',
    });
  }

  if (totalRequests > PERFORMANCE_BUDGETS.resources.totalRequests) {
    violations.push({
      severity: 'warning',
      metric: 'Total Requests',
      value: totalRequests,
      budget: PERFORMANCE_BUDGETS.resources.totalRequests,
      message: 'Request count exceeds the budget',
    });
  }

  return violations;
}
```

---

## 10. Anti-patterns and Workarounds

### 10.1 Anti-pattern 1: Polling performance.getEntries()

**Problem**: A pattern of periodically calling `performance.getEntries()` with `setInterval` to collect performance data. This places unnecessary load on the main thread and causes duplicate processing of entries and missed timing data.

```javascript
// ============================================================
// Anti-pattern: Collecting entries by polling
// ============================================================

// --- Bad example ---
// Poll using setInterval
setInterval(() => {
  const entries = performance.getEntries();
  entries.forEach(entry => {
    // Problem 1: Retrieves all entries each time, so already-processed entries are re-processed
    // Problem 2: The cost of getEntries() grows proportionally to the number of entries
    // Problem 3: Entries that occur between polling intervals may be missed
    // Problem 4: When the buffer is full, old entries disappear without being detected
    processEntry(entry);
  });
}, 5000);


// --- Good example ---
// Use PerformanceObserver
const observer = new PerformanceObserver((list) => {
  // Only new entries are passed to the callback (no duplicates)
  for (const entry of list.getEntries()) {
    processEntry(entry);
  }
});

observer.observe({
  type: 'resource',
  buffered: true,  // Also retrieve past entries on first call
});

// Benefits:
// - Event-driven and efficient (no polling needed)
// - Only new entries are notified (no duplicate processing)
// - buffered: true prevents missing past entries
// - Buffer overflow can be detected (droppedEntriesCount)
```

### 10.2 Anti-pattern 2: Misinterpreting Core Web Vitals

**Problem**: Judging performance solely by the Lighthouse score without understanding the difference between lab data (Lighthouse) and field data (RUM/CrUX).

```javascript
// ============================================================
// Anti-pattern: Relying only on the Lighthouse score
// ============================================================

// --- Bad example ---
// Optimize to achieve 100 in Lighthouse and consider it complete
//
// Problem 1: Lighthouse measures in a fixed environment (specific throttling settings)
//             and does not reflect the diverse environments of real users
// Problem 2: TBT is a lab metric and differs from field INP
// Problem 3: Lighthouse only measures initial load; it does not measure SPA page transitions
// Problem 4: It does not reflect variation in server response times or network quality

// --- Good example ---
// Use both lab data and field data

// 1. Lighthouse (lab): Use for detecting regressions during development
//    - Run automatically in CI to detect score drops
//    - Convert improvement suggestions (Opportunities) to development tasks

// 2. CrUX (field): Understand performance for real users
async function fetchCrUXData(origin) {
  const response = await fetch(
    `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${API_KEY}`,
    {
      method: 'POST',
      body: JSON.stringify({
        origin: origin,
        metrics: [
          'largest_contentful_paint',
          'interaction_to_next_paint',
          'cumulative_layout_shift',
        ],
      }),
    }
  );

  const data = await response.json();
  return data.record?.metrics;
}

// 3. Your own RUM: Collect fine-grained field data
//    - Metrics by page and route
//    - Analysis by user segment
//    - Correlation analysis between performance and business metrics
```

### 10.3 Anti-pattern 3: Exhausting the Performance Buffer

**Problem**: A pattern where entries are lost in applications that load a large number of resources without considering `performance.setResourceTimingBufferSize()`.

```javascript
// ============================================================
// Anti-pattern: Unmanaged buffer size
// ============================================================

// --- Bad example ---
// Operating with the default buffer size (typically 250),
// entries disappear in SPAs that load many resources

// --- Good example ---
// Manage the buffer size
performance.setResourceTimingBufferSize(500);

// Monitor the buffer-full event
performance.addEventListener('resourcetimingbufferfull', () => {
  // Save the current entries
  const entries = performance.getEntriesByType('resource');
  archiveResourceEntries(entries);

  // Clear the buffer to accept new entries
  performance.clearResourceTimings();

  console.warn(
    `Resource Timing buffer is full. ` +
    `Archived ${entries.length} entries.`
  );
});

// Also use droppedEntriesCount from PerformanceObserver
new PerformanceObserver((list, observer) => {
  const entries = list.getEntries();

  // Check the number of dropped entries
  if (observer.droppedEntriesCount && observer.droppedEntriesCount > 0) {
    console.warn(
      `${observer.droppedEntriesCount} entries were dropped`
    );
  }

  entries.forEach(processEntry);
}).observe({ type: 'resource', buffered: true });
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case 1: bfcache (Back/Forward Cache) and Performance Measurement

bfcache is a mechanism that keeps the page state in memory as-is during browser back/forward navigation. Pages restored from bfcache do not fire the normal page load events (`load`, `DOMContentLoaded`), so performance measurement requires special consideration.

```javascript
// ==================================================
// Performance measurement compatible with bfcache
// ==================================================

// Detect restoration from bfcache
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // Restored from bfcache
    console.log('Restored from bfcache');

    // Navigation Timing will not record a new entry
    // -> Manually record only the restoration time
    performance.mark('bfcache-restore', {
      detail: { timestamp: event.timeStamp },
    });

    // The web-vitals library automatically handles measurement
    // after bfcache restoration, but custom measurements need re-initialization
    reinitializeCustomMetrics();
  }
});

// Page unload handling compatible with bfcache
// Note: 'unload' event handlers disable bfcache
// Use 'pagehide' or 'visibilitychange' instead

// --- Bad example (blocks bfcache) ---
window.addEventListener('unload', () => {
  sendFinalMetrics();  // This processing prevents bfcache from being used
});

// --- Good example (bfcache-compatible) ---
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sendFinalMetrics();
  }
});

// Check bfcache eligibility (Chrome DevTools API)
// Verify in DevTools > Application > Back/forward cache

// Detect bfcache blockers programmatically
function checkBfcacheBlockers() {
  const issues = [];

  // Detecting unload event listeners
  // (No direct detection API; manage these yourself)

  // Cache-Control: no-store blocks bfcache
  // -> Use Cache-Control: no-cache instead

  // Active WebSocket connections prevent bfcache
  // -> Close on pagehide and reconnect on pageshow

  return issues;
}
```

### 11.2 Edge Case 2: Measuring Resources via Service Worker

When a Service Worker intercepts resource requests, the Resource Timing values include the Service Worker's processing time. This makes it necessary to distinguish between network time and Service Worker processing time in analysis.

```javascript
// ==================================================
// Measuring resources via Service Worker
// ==================================================

function analyzeServiceWorkerImpact() {
  const resources = performance.getEntriesByType('resource');

  resources.forEach(entry => {
    const swProcessing = entry.workerStart > 0
      ? entry.fetchStart - entry.workerStart
      : 0;

    const isFromSW = entry.workerStart > 0;
    const isFromCache = entry.transferSize === 0
      && entry.decodedBodySize > 0;

    if (isFromSW) {
      console.log(`[SW] ${new URL(entry.name).pathname}`, {
        // Service Worker startup time
        swStartup: entry.workerStart > 0
          ? `${(entry.fetchStart - entry.workerStart).toFixed(0)}ms`
          : 'N/A',
        // Processing time inside the Service Worker
        swProcessing: `${swProcessing.toFixed(0)}ms`,
        // Network request time (when SW falls back to the network)
        networkTime: isFromCache
          ? '0ms (cached)'
          : `${(entry.responseEnd - entry.fetchStart).toFixed(0)}ms`,
        // Total time
        total: `${entry.duration.toFixed(0)}ms`,
        // Estimated cache state
        cacheStrategy: isFromCache ? 'cache-first' : 'network-first',
      });
    }
  });
}

// Compare performance by Service Worker cache strategy
function compareSwCacheStrategies() {
  const resources = performance.getEntriesByType('resource');

  const categories = {
    cacheFirst: [],    // transferSize === 0 && workerStart > 0
    networkFirst: [],  // transferSize > 0 && workerStart > 0
    noSw: [],          // workerStart === 0
  };

  resources.forEach(entry => {
    if (entry.workerStart === 0) {
      categories.noSw.push(entry);
    } else if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
      categories.cacheFirst.push(entry);
    } else {
      categories.networkFirst.push(entry);
    }
  });

  const summarize = (entries) => ({
    count: entries.length,
    avgDuration: entries.length > 0
      ? `${(entries.reduce((s, e) => s + e.duration, 0) / entries.length).toFixed(0)}ms`
      : 'N/A',
    p95Duration: entries.length > 0
      ? `${entries.sort((a, b) => a.duration - b.duration)[Math.floor(entries.length * 0.95)]?.duration.toFixed(0)}ms`
      : 'N/A',
  });

  console.table({
    'Cache First (SW)': summarize(categories.cacheFirst),
    'Network First (SW)': summarize(categories.networkFirst),
    'No Service Worker': summarize(categories.noSw),
  });
}
```

### 11.3 Edge Case 3: Measuring Route Transitions in SPAs (Single Page Applications)

Because SPAs do not perform a full page reload, Navigation Timing is only valid for the initial load. Client-side routing page transitions must be measured manually using User Timing.

```javascript
// ==================================================
// Performance measurement for SPA route transitions
// ==================================================

class SPANavigationTracker {
  constructor() {
    this.navigations = [];
    this.currentNavigation = null;
    this._setupHistoryInterception();
  }

  _setupHistoryInterception() {
    // Intercept history.pushState / replaceState
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      this._onNavigationStart(args[2]);
      originalPushState(...args);
    };

    history.replaceState = (...args) => {
      originalReplaceState(...args);
    };

    // popstate (browser back/forward)
    window.addEventListener('popstate', () => {
      this._onNavigationStart(location.pathname);
    });
  }

  _onNavigationStart(toUrl) {
    const navId = `spa-nav-${Date.now()}`;
    const fromUrl = location.pathname;

    performance.mark(`${navId}-start`, {
      detail: { from: fromUrl, to: toUrl },
    });

    this.currentNavigation = {
      id: navId,
      from: fromUrl,
      to: toUrl,
      startTime: performance.now(),
    };

    // Wait for the next frame to render and treat it as complete
    // (estimate paint completion with 2 requestAnimationFrame calls)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._onNavigationEnd();
      });
    });
  }

  _onNavigationEnd() {
    if (!this.currentNavigation) return;

    const nav = this.currentNavigation;
    performance.mark(`${nav.id}-end`);
    performance.measure(nav.id, `${nav.id}-start`, `${nav.id}-end`);

    const entry = performance.getEntriesByName(nav.id).pop();
    const result = {
      ...nav,
      duration: entry.duration,
      timestamp: Date.now(),
    };

    this.navigations.push(result);
    this.currentNavigation = null;

    console.log(
      `[SPA Nav] ${result.from} -> ${result.to}: ` +
      `${result.duration.toFixed(0)}ms`
    );

    return result;
  }

  // Retrieve statistics
  getStats() {
    if (this.navigations.length === 0) return null;

    const durations = this.navigations.map(n => n.duration).sort((a, b) => a - b);
    return {
      count: durations.length,
      avg: `${(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(0)}ms`,
      median: `${durations[Math.floor(durations.length / 2)].toFixed(0)}ms`,
      p95: `${durations[Math.floor(durations.length * 0.95)].toFixed(0)}ms`,
      max: `${durations[durations.length - 1].toFixed(0)}ms`,
    };
  }
}

const spaTracker = new SPANavigationTracker();
```

---

## 12. Tiered Exercises

### 12.1 Exercise 1: Beginner - Creating a Page Load Report

**Goal**: Use the Navigation Timing API to output the load performance of the current page in tabular form to the console.

**Requirements**:
1. Measure the time for each phase: DNS resolution, TCP connection, TTFB, download, and DOM processing
2. Display the results in a readable format using `console.table()`
3. Display a warning if TTFB exceeds 800ms

```javascript
// ==================================================
// Exercise 1: Sample solution
// ==================================================

function generateLoadingReport() {
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav) {
    console.error('Navigation Timing data could not be retrieved');
    return;
  }

  const report = {
    'DNS Resolution': { value: nav.domainLookupEnd - nav.domainLookupStart, unit: 'ms' },
    'TCP Connection': { value: nav.connectEnd - nav.connectStart, unit: 'ms' },
    'TLS Handshake': {
      value: nav.secureConnectionStart > 0
        ? nav.connectEnd - nav.secureConnectionStart : 0,
      unit: 'ms',
    },
    'TTFB': { value: nav.responseStart - nav.requestStart, unit: 'ms' },
    'Download': { value: nav.responseEnd - nav.responseStart, unit: 'ms' },
    'DOM Processing': { value: nav.domContentLoadedEventEnd - nav.responseEnd, unit: 'ms' },
    'Total Load Time': { value: nav.loadEventEnd - nav.startTime, unit: 'ms' },
    'Protocol': { value: nav.nextHopProtocol, unit: '' },
    'Transfer Size': { value: (nav.transferSize / 1024).toFixed(1), unit: 'KB' },
  };

  // Format for the table
  const tableData = {};
  for (const [key, data] of Object.entries(report)) {
    tableData[key] = typeof data.value === 'number'
      ? `${data.value.toFixed(1)}${data.unit}`
      : `${data.value}${data.unit}`;
  }

  console.table(tableData);

  // TTFB warning
  const ttfb = nav.responseStart - nav.requestStart;
  if (ttfb > 800) {
    console.warn(
      `TTFB exceeds 800ms: ${ttfb.toFixed(0)}ms\n` +
      'Suggestions: optimize server processing, introduce a CDN, review caching strategy'
    );
  }

  return report;
}

// Execute after page load completes
window.addEventListener('load', () => {
  setTimeout(generateLoadingReport, 0);
});
```

### 12.2 Exercise 2: Intermediate - Resource Optimization Dashboard

**Goal**: Use the Resource Timing API to build a dashboard that analyzes resource load performance.

**Requirements**:
1. Aggregate by resource type (script, css, img, fetch, etc.)
2. Calculate total size, average load time, and cache hit rate for each type
3. Report the worst 5 resources that took more than 1 second
4. Detect and list third-party resources

```javascript
// ==================================================
// Exercise 2: Sample solution
// ==================================================

function buildResourceDashboard() {
  const resources = performance.getEntriesByType('resource');
  const currentOrigin = location.origin;

  // --- 1. Aggregate by type ---
  const byType = {};
  resources.forEach(r => {
    const type = r.initiatorType || 'other';
    if (!byType[type]) {
      byType[type] = { count: 0, totalSize: 0, totalDuration: 0, cachedCount: 0 };
    }
    byType[type].count++;
    byType[type].totalSize += r.transferSize;
    byType[type].totalDuration += r.duration;
    if (r.transferSize === 0 && r.decodedBodySize > 0) {
      byType[type].cachedCount++;
    }
  });

  console.log('=== Aggregation by Resource Type ===');
  const typeTable = {};
  for (const [type, data] of Object.entries(byType)) {
    typeTable[type] = {
      Count: data.count,
      'Total Size': `${(data.totalSize / 1024).toFixed(1)}KB`,
      'Avg Time': `${(data.totalDuration / data.count).toFixed(0)}ms`,
      'Cache Rate': `${((data.cachedCount / data.count) * 100).toFixed(0)}%`,
    };
  }
  console.table(typeTable);

  // --- 2. Worst 5 ---
  console.log('\n=== Worst 5 Slowest Resources ===');
  const worst5 = resources
    .filter(r => r.duration > 1000)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  worst5.forEach((r, i) => {
    console.log(`  ${i + 1}. ${new URL(r.name).pathname}`);
    console.log(`     Type: ${r.initiatorType}`);
    console.log(`     Time: ${r.duration.toFixed(0)}ms`);
    console.log(`     Size: ${(r.transferSize / 1024).toFixed(1)}KB`);
  });

  // --- 3. Third-party resources ---
  console.log('\n=== Third-party Resources ===');
  const thirdParty = resources.filter(r => {
    try { return new URL(r.name).origin !== currentOrigin; }
    catch { return false; }
  });

  const byDomain = {};
  thirdParty.forEach(r => {
    const domain = new URL(r.name).hostname;
    if (!byDomain[domain]) {
      byDomain[domain] = { count: 0, totalSize: 0, totalDuration: 0 };
    }
    byDomain[domain].count++;
    byDomain[domain].totalSize += r.transferSize;
    byDomain[domain].totalDuration += r.duration;
  });

  const domainTable = {};
  for (const [domain, data] of Object.entries(byDomain)) {
    domainTable[domain] = {
      Requests: data.count,
      'Total Size': `${(data.totalSize / 1024).toFixed(1)}KB`,
      'Total Time': `${data.totalDuration.toFixed(0)}ms`,
    };
  }
  console.table(domainTable);

  return { byType: typeTable, worst5, thirdPartyDomains: domainTable };
}

// Execute
window.addEventListener('load', () => {
  setTimeout(buildResourceDashboard, 1000);
});
```

### 12.3 Exercise 3: Advanced - Comprehensive Performance Monitoring System

**Goal**: Build a comprehensive performance monitoring system combining PerformanceObserver, User Timing, and web-vitals.

**Requirements**:
1. Measure Core Web Vitals (LCP, INP, CLS) in real time
2. Detect Long Tasks and analyze their causes
3. Measure custom metrics (API response time, rendering time)
4. Integrate all data to generate a report and send it via the Beacon API
5. Include a comparison against performance budgets

```javascript
// ==================================================
// Exercise 3: Sample solution (comprehensive monitoring system)
// ==================================================

class PerformanceMonitor {
  constructor(config) {
    this.config = {
      endpoint: config.endpoint || '/api/perf',
      budgets: config.budgets || {},
      sampleRate: config.sampleRate || 1.0,
      debug: config.debug || false,
    };

    this.data = {
      vitals: {},
      longTasks: [],
      customMetrics: [],
      violations: [],
    };

    if (Math.random() > this.config.sampleRate) return;

    this._initVitals();
    this._initLongTaskMonitor();
    this._setupReporting();
  }

  // Measure Core Web Vitals
  _initVitals() {
    import('web-vitals').then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      const recordVital = (metric) => {
        this.data.vitals[metric.name] = {
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
        };

        // Budget check
        const budget = this.config.budgets[metric.name];
        if (budget && metric.value > budget) {
          this.data.violations.push({
            metric: metric.name,
            value: metric.value,
            budget: budget,
            exceeded: metric.value - budget,
          });

          if (this.config.debug) {
            console.warn(
              `[Budget Violation] ${metric.name}: ` +
              `${metric.value} > ${budget} (exceeded by: ${(metric.value - budget).toFixed(1)})`
            );
          }
        }
      };

      onLCP(recordVital);
      onINP(recordVital);
      onCLS(recordVital);
      onFCP(recordVital);
      onTTFB(recordVital);
    });
  }

  // Monitor Long Tasks
  _initLongTaskMonitor() {
    if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) return;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.data.longTasks.push({
          duration: entry.duration,
          startTime: entry.startTime,
          timestamp: Date.now(),
        });
      }
    }).observe({ type: 'longtask' });
  }

  // Record custom metrics
  measure(name, fn) {
    const start = performance.now();
    const result = fn();

    if (result instanceof Promise) {
      return result.then(value => {
        this._recordCustomMetric(name, performance.now() - start);
        return value;
      }).catch(error => {
        this._recordCustomMetric(`${name}-error`, performance.now() - start);
        throw error;
      });
    }

    this._recordCustomMetric(name, performance.now() - start);
    return result;
  }

  _recordCustomMetric(name, duration) {
    this.data.customMetrics.push({
      name,
      duration,
      timestamp: Date.now(),
    });

    if (this.config.debug) {
      console.log(`[Custom Metric] ${name}: ${duration.toFixed(1)}ms`);
    }
  }

  // Configure report sending
  _setupReporting() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this._sendReport();
      }
    });
  }

  _sendReport() {
    const report = {
      url: location.href,
      timestamp: Date.now(),
      vitals: this.data.vitals,
      longTasks: {
        count: this.data.longTasks.length,
        totalDuration: this.data.longTasks.reduce((s, t) => s + t.duration, 0),
        maxDuration: this.data.longTasks.length > 0
          ? Math.max(...this.data.longTasks.map(t => t.duration))
          : 0,
      },
      customMetrics: this.data.customMetrics,
      violations: this.data.violations,
      context: {
        connection: navigator.connection?.effectiveType,
        deviceMemory: navigator.deviceMemory,
        viewport: `${innerWidth}x${innerHeight}`,
      },
    };

    const body = JSON.stringify(report);

    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.config.endpoint, body);
    } else {
      fetch(this.config.endpoint, {
        method: 'POST',
        body,
        keepalive: true,
      }).catch(() => {});
    }

    if (this.config.debug) {
      console.log('[Performance Report]', report);
    }
  }

  // Get the current state
  getReport() {
    return { ...this.data };
  }
}

// Initialization and usage example
const monitor = new PerformanceMonitor({
  endpoint: '/api/performance',
  sampleRate: 1.0,
  debug: true,
  budgets: {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1800,
    TTFB: 800,
  },
});

// Usage example for custom metrics
const data = await monitor.measure('fetch-products', () =>
  fetch('/api/products').then(r => r.json())
);
```

---

## 13. FAQ

### Q1: Why does the Lighthouse score differ between DevTools and the CLI?

**A**: Lighthouse scores vary depending on the execution environment. The main causes of the difference are as follows.

1. **Difference in throttling method**: DevTools uses Simulated Throttling by default, while the CLI also supports Applied Throttling (actual network/CPU restrictions). The simulation method algorithmically estimates network and CPU restrictions, so results tend to differ from the real environment.

2. **Impact of background processes**: In a local environment, other tabs and applications consume CPU and memory, introducing noise into measurement results. CI environments similarly have competing jobs consuming resources.

3. **Variation in network conditions**: Even with the same throttling settings, actual network latency and server response times vary.

**Recommended countermeasures**:
- Run multiple times (3-5 runs) and use the median
- Use consistent settings in the CI environment
- Focus on changes (differences) rather than absolute score values

### Q2: What are common causes of unexpectedly high CLS?

**A**: The following shows typical causes of high CLS and countermeasures.

| Cause | Details | Countermeasure |
|-------|---------|----------------|
| Images/videos without dimensions specified | When loading completes and element size is determined, surrounding content is pushed out | Always specify `width`/`height` attributes. The `aspect-ratio` CSS property is also effective |
| Web font FOIT/FOUT | Text is hidden (FOIT) or shown in fallback font (FOUT) during font loading, causing a shift when switching | Use `font-display: swap` and `size-adjust`. Preload fonts with `<link rel="preload">` |
| Dynamic content insertion | Ads, banners, cookie consent dialogs, etc. are inserted above existing content | Reserve space for insertion in advance. Set `min-height` |
| Lazy-loaded content | Size changes when switching from skeleton display to content while waiting for API response | Match skeleton dimensions to content. Use `contain: layout` |

### Q3: What is the difference between INP and FID? Why was FID deprecated?

**A**: FID (First Input Delay) measured only the input delay of the first interaction. INP, on the other hand, covers all interactions across the entire page lifecycle and reports the slowest response (98th percentile).

The main reasons FID was deprecated are as follows.

1. **Narrow measurement scope**: Since FID measured only the "first" interaction, it could not evaluate interaction quality after page load. For long-lived pages like SPAs, the feel of operations during the page session is what matters.

2. **Only measuring input delay**: FID measured only the delay until event handler execution begins (Input Delay) and did not include processing time (Processing Time) or presentation delay. Heavy processing inside handlers was not reflected in FID.

3. **Optimistic evaluation**: Even when many sites showed good FID (< 100ms), users often perceived the response as slow. INP more accurately reflects the actual state.

### Q4: How much does performance measurement vary on mobile devices?

**A**: Performance characteristics differ significantly between mobile and desktop. The main differences are summarized below.

| Factor | Desktop | Mobile | Impact |
|--------|---------|--------|--------|
| CPU performance | Fast multi-core | Low to medium speed, frequency throttled by heat | JavaScript execution time increases 2-5x |
| Memory | 8-32GB | 2-8GB | Risk of memory shortage with large bundles |
| Network | Wired / Wi-Fi | 4G/5G (variable) | TTFB and download time are unstable |
| Screen size | Large screen | Small screen | LCP target element may change |
| Touch input | Mouse + keyboard | Touch | INP target events differ |

Lighthouse's default settings simulate a mobile environment by slowing the CPU by 4x and throttling the network to 4G equivalent. However, real mobile devices have variable factors such as battery level, thermal management, and OS background processing that simulations cannot reproduce. Combining with field data (RUM) is essential.

### Q5: What is the difference between type and entryTypes in PerformanceObserver.observe?

**A**: The `observe()` method has two specification methods.

- **`type` (singular)**: Specifies one entryType. The `buffered` option can be used. Newer APIs (such as `droppedEntriesCount`) can be accessed. Recommended method introduced in Performance Timeline Level 2.

- **`entryTypes` (plural)**: Can specify multiple entryTypes as an array. The `buffered` option cannot be used. Older API-compatible method.

```javascript
// Recommended: type (singular) + buffered
new PerformanceObserver(callback).observe({
  type: 'resource',
  buffered: true,
});

// Compatible: entryTypes (plural)
new PerformanceObserver(callback).observe({
  entryTypes: ['resource', 'mark', 'measure'],
  // buffered cannot be used
});
```

If you want to monitor multiple entryTypes and also use `buffered`, create separate Observers for each entryType.

### Q6: What are the most effective ways to improve Core Web Vitals (LCP/FID/CLS)?

**A**: The most effective improvement techniques for each metric are summarized below.

**Improving LCP (Largest Contentful Paint)**:
1. **Image optimization**: Convert to WebP/AVIF format, deliver at appropriate sizes, implement responsive images with `<img srcset>`
2. **Priority loading of critical resources**: Use `<link rel="preload">` to preload the LCP element (hero images and main content)
3. **Reducing server response time (TTFB)**: Introduce a CDN, server-side caching, database query optimization
4. **Reducing render-blocking resources**: Inline CSS, `defer`/`async` attributes for JavaScript, remove unused CSS

**Improving INP (Interaction to Next Paint)**:
1. **Split Long Tasks**: Use `scheduler.yield()` or `setTimeout(fn, 0)` to split processing into small chunks, periodically freeing the main thread
2. **Reduce JavaScript bundle size**: Code splitting, tree shaking, lazy loading via dynamic import
3. **Optimize event handlers**: Debounce/throttle, event delegation, use of passive listeners
4. **Leverage Web Workers**: Delegate heavy computation to a background thread

**Improving CLS (Cumulative Layout Shift)**:
1. **Specify image/video dimensions**: Always set `width`/`height` attributes or `aspect-ratio` CSS property
2. **Web font optimization**: Use `font-display: swap` and `size-adjust`, preload fonts
3. **Reserve space for dynamic content**: Set `min-height` for ads and banners, match skeleton screen dimensions
4. **Use the CSS `contain` property**: Use `contain: layout` to limit the scope of layout impact

### Q7: How should I choose between the Performance API and Lighthouse? Which should take priority?

**A**: The Performance API (RUM) and Lighthouse (lab testing) are complementary, and using both is recommended.

| Aspect | Performance API (RUM) | Lighthouse (lab testing) |
|--------|----------------------|--------------------------|
| Data source | Actual user environment | Fixed developer-controlled environment |
| Result consistency | Low (environment diversity) | High (reproducible with same settings) |
| Problem discovery | Detects real-environment issues | Detects potential bottlenecks |
| Debugging | Difficult (hard to reproduce environment) | Easy (detailed analysis with trace) |
| Improvement suggestions | None | Provides specific suggestions |
| Cost | Requires backend infrastructure | Free (CI integration also possible) |

**Recommended division of use**:
1. **Development phase**: Use Lighthouse to discover problems early and optimize based on suggestions
2. **CI/CD pipeline**: Set performance budgets with Lighthouse CI to automatically detect regressions
3. **Production environment**: Collect RUM data with the Performance API to monitor real user experience
4. **Problem investigation**: Use Lighthouse's trace feature for detailed bottleneck analysis
5. **Validating improvements**: Use RUM data to quantitatively measure the effect of improvements

Combining both allows you to bridge the gap between "the ideal in the lab" and "the reality in the field."

### Q8: What are the steps and considerations for introducing Real User Monitoring (RUM)?

**A**: Introducing RUM involves the following steps and considerations.

**Introduction steps**:

1. **Determine what to measure**:
   - Core Web Vitals (LCP/INP/CLS) are mandatory
   - Navigation Timing (TTFB, DOMContentLoaded, Load)
   - Resource Timing (narrow to important resources only)
   - User Timing (important app-specific events)

2. **Select a library**:
   - Google's `web-vitals` library (lightweight, official)
   - Third-party APM (New Relic, Datadog, Sentry, etc.)
   - Custom implementation (PerformanceObserver-based)

3. **Implement data sending**:
   - Use Beacon API or `fetch` with `keepalive: true`
   - Set a sampling rate (10-50% of all users, etc.)
   - Batch sending to reduce the number of requests

4. **Build the backend**:
   - Implement an endpoint (receive POST requests, save to database)
   - Aggregation processing (percentile calculation, time series data generation)
   - Build a dashboard (graphing, alert configuration)

**Considerations**:

| Item | Details |
|------|---------|
| Privacy protection | Do not include personally identifiable information. Obtain consent beforehand in compliance with GDPR/CCPA |
| Performance impact | Use asynchronous processing and lightweight code so that the measurement processing itself does not affect performance |
| Sampling | There is no need to measure all users. 10-50% sampling provides sufficient statistical significance |
| Bot exclusion | Exclude crawlers and automation tools via user-agent analysis or captcha |
| Data retention period | Considering storage costs, keep raw data for 30-90 days and aggregated data for long-term storage |
| Alert configuration | Notify the team when metrics exceed thresholds (Slack, PagerDuty, etc.) |

**Code example (lightweight RUM implementation)**:

```javascript
import { onCLS, onINP, onLCP } from 'web-vitals';

function sendToAnalytics(metric) {
  // Sampling (50%)
  if (Math.random() > 0.5) return;

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    url: location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  // Send via Beacon API
  navigator.sendBeacon('/api/metrics', body);
}

// Monitor Core Web Vitals
onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
```

---

### Q4: Can PerformanceObserver callbacks impact performance?

**A**: PerformanceObserver callbacks run as microtasks, so performing heavy operations inside the callback (large amounts of logging, DOM manipulation, synchronous network requests, etc.) will block the main thread and may affect the performance of what you are measuring. It is recommended to perform only minimal data extraction and buffering inside the callback, and to send data at idle time or on page unload using `requestIdleCallback` or the Beacon API (`navigator.sendBeacon`).

### Q5: Should you collect performance data from all users in production?

**A**: Collecting data from all users increases server load and network costs, so sampling is typically applied. Generally, sampling 1-10% of all users provides a statistically significant amount of data. Control the sampling rate with something like `Math.random() < 0.05` (5%) and fix it at the session level so that navigation across pages by the same user is tracked consistently. Setting a higher sampling rate for important pages (landing pages, checkout) is also effective.

### Q6: Can anything be improved on the frontend if TTFB is slow?

**A**: TTFB (Time to First Byte) depends heavily on server-side processing time, but there is also room for improvement on the frontend side. Using `<link rel="preconnect">` to pre-establish connections to CDNs and API servers, having the Service Worker return an immediate response on cache hits (Stale-While-Revalidate strategy), and continuously measuring TTFB with the Navigation Timing API to share data with the server team are all effective measures.

---

## Additional References

- [Google Developers - Optimize Time to First Byte](https://web.dev/articles/optimize-ttfb) - Comprehensive guide to TTFB optimization
- [W3C - Performance Timeline Level 2](https://www.w3.org/TR/performance-timeline/) - Official specification for PerformanceObserver
- [Mozilla - PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver) - PerformanceObserver implementation guide

---

## 14. Comparison Tables

### 14.1 Performance Measurement Tool Comparison

| Characteristic | Performance API (RUM) | Lighthouse (lab) | WebPageTest (lab) | CrUX (field) |
|----------------|-----------------------|------------------|-------------------|--------------|
| Data source | Real users | Simulation | Real network | Real users (Chrome) |
| Environment diversity | High (all devices) | Low (fixed settings) | Medium (selectable) | High (Chrome only) |
| Measurement timing | Real-time | On-demand / CI | On-demand | 28-day aggregate |
| INP support | Supported | Replaced by TBT | Partial support | Supported |
| Custom metrics | Supported | Via custom audits | Custom scripts | Not supported |
| Cost | Implementation cost | Free | Free / paid plans | Free (API) |
| Result consistency | Low (environment-dependent) | Medium (some variation) | Medium to high | High (large dataset) |
| Improvement suggestions | None | Detailed suggestions | Detailed suggestions | None |
| SPA support | Manual implementation required | Initial load only | Initial load only | Limited |

### 14.2 Data Sending Method Comparison

| Characteristic | Beacon API | fetch (keepalive) | XMLHttpRequest | Image Pixel |
|----------------|-----------|-------------------|----------------|-------------|
| Sending on page unload | Reliable | Reliable | Unreliable | Unreliable |
| Payload size limit | 64KB | 64KB (with keepalive) | No limit | URL length limit |
| Retrieve response | Not possible | Possible | Possible | Not possible |
| HTTP method | POST only | Any | Any | GET only |
| Content-Type setting | Limited | Free | Free | N/A |
| CORS preflight | Conditional | Conditional | Conditional | Not required |
| Browser support | Broad | Broad | Broad | All browsers |
| Cancellable | Not possible | AbortController | abort() | N/A |
| Recommended use | Performance data / analytics | Large payloads | Legacy support | Minimal tracking |

### 14.3 Core Web Vitals Improvement Technique Comparison

| Technique | Target metric | Effect size | Implementation difficulty | Description |
|-----------|--------------|-------------|--------------------------|-------------|
| Image lazy loading | LCP, CLS | Large | Low | `loading="lazy"` + dimension specification |
| Critical CSS inlining | FCP, LCP | Large | Medium | Inline above-the-fold CSS |
| JavaScript code splitting | TBT, INP | Large | Medium | dynamic import + React.lazy |
| Font optimization | CLS, FCP | Medium | Low | `font-display: swap` + preload |
| Service Worker caching | LCP, TTFB | Large | High | Cache-first strategy for offline support |
| CDN introduction | TTFB, LCP | Large | Low | Delivery from edge servers |
| HTTP/2 Server Push | LCP | Medium | Medium | Pre-sending critical resources (being deprecated) |
| `scheduler.yield()` | INP | Large | Medium | Split Long Tasks to free the main thread |
| `content-visibility: auto` | LCP, INP | Medium | Low | Defer rendering of off-viewport content |
| Speculation Rules API | LCP, FCP | Large | Medium | Speculative prerendering of link destinations |

---

## 15. References

1. W3C. "Performance Timeline Level 2." W3C Recommendation, 2024. https://www.w3.org/TR/performance-timeline/
2. W3C. "Navigation Timing Level 2." W3C Recommendation, 2023. https://www.w3.org/TR/navigation-timing-2/
3. W3C. "Resource Timing Level 2." W3C Recommendation, 2023. https://www.w3.org/TR/resource-timing-2/
4. W3C. "User Timing Level 3." W3C Working Draft, 2024. https://www.w3.org/TR/user-timing/
5. W3C. "Long Tasks API." W3C Working Draft, 2024. https://www.w3.org/TR/longtasks-1/
6. Google. "Web Vitals." web.dev, 2024. https://web.dev/articles/vitals
7. Google. "Interaction to Next Paint (INP)." web.dev, 2024. https://web.dev/articles/inp
8. Google. "Optimize Cumulative Layout Shift." web.dev, 2024. https://web.dev/articles/optimize-cls
9. Google. "Optimize Largest Contentful Paint." web.dev, 2024. https://web.dev/articles/optimize-lcp
10. Google Chrome. "web-vitals." GitHub, 2024. https://github.com/GoogleChrome/web-vitals
11. Google. "Lighthouse." GitHub, 2024. https://github.com/GoogleChrome/lighthouse
12. Google. "Chrome UX Report (CrUX)." 2024. https://developer.chrome.com/docs/crux
13. Philip Walton. "Are long JavaScript tasks delaying your Time to Interactive?" web.dev, 2023. https://web.dev/articles/long-tasks-devtools

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not only through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in daily development work. It is especially important during code reviews and architecture design.

---

## Summary

The Performance API is an essential foundational technology for browser performance measurement. The content covered in this chapter is summarized below.

| Category | Key APIs / Tools | Use |
|---------|------------------|-----|
| Page load measurement | Navigation Timing | Phase-by-phase measurement of redirect, DNS, TCP, TTFB, etc. |
| Resource measurement | Resource Timing | Load performance analysis of individual resources |
| Custom measurement | User Timing (mark/measure) | Define application-specific performance measurement points |
| Real-time monitoring | PerformanceObserver | Event-driven performance entry notifications |
| User experience metrics | Core Web Vitals (LCP/INP/CLS) | Google's three major user experience metrics |
| Automated auditing | Lighthouse / Lighthouse CI | Performance scoring and improvement suggestions |
| Data sending | Beacon API / fetch keepalive | Reliable data sending even on page unload |
| Field data | RUM / CrUX | Understanding performance in real user environments |
| Quality assurance | Performance budgets | Preventing performance regressions via automated CI/CD validation |

Performance improvement is not a one-time effort; it is important to continuously cycle through measurement, analysis, improvement, and validation. By combining lab data (Lighthouse) and field data (RUM/CrUX) and introducing automated validation through performance budgets, you can build a system that allows the entire team to maintain and improve performance quality.

---

## What to Read Next

After mastering the basics of measurement and performance improvement with the Performance API, it is recommended to move on to the following guides.

**Dive deeper into browsers and the web platform**:
- **Network fundamentals**: Understanding the mechanisms of the network layer — TCP/IP, HTTP/2, HTTP/3 (QUIC), TLS — allows for a deeper understanding of TTFB improvements and CDN effectiveness. In particular, HTTP/2 multiplexing, Server Push, and HTTP/3's 0-RTT connection are important knowledge for performance optimization.

**Application to web development as a whole**:
- **Web application development**: Learn how to integrate performance measurement and optimization in practical development using frameworks such as React and Vue. Topics covered include the combination of Performance API with techniques such as code splitting, lazy loading, Server-Side Rendering (SSR), and Static Site Generation (SSG).

---

## References

- [MDN Web Docs](https://developer.mozilla.org/) - Web technology reference
- [Wikipedia](https://en.wikipedia.org/) - Overview of technical concepts
