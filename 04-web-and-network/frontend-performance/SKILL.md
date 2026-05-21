# Frontend Performance — Complete Guide

> Dramatically reduce JavaScript bundle size, improve Core Web Vitals, and deliver fast rendering through a systematic performance optimization approach covering bundle analysis, rendering strategies, and real-world measurement data.

## Target Audience

- Frontend engineers looking to improve page load speed and user experience
- Developers working on Next.js or Vite-based projects
- Engineers who need to improve Lighthouse scores and Core Web Vitals

## Prerequisites

- React basics (components, hooks)
- Basic understanding of bundlers (webpack, Vite)
- Familiarity with Next.js is helpful but not required

## Guide Index

### 01-bundle-optimization (Bundle Optimization)

| File | Topic | Overview |
|------|-------|----------|
| [bundle-optimization-complete.md](docs/01-bundle-optimization/bundle-optimization-complete.md) | Bundle Optimization | Code splitting, tree shaking, dependency optimization, webpack/Vite configuration |

### 02-core-web-vitals (Core Web Vitals)

| File | Topic | Overview |
|------|-------|----------|
| [core-web-vitals-complete.md](docs/02-core-web-vitals/core-web-vitals-complete.md) | Core Web Vitals | LCP, INP, CLS optimization with measurement data and monitoring strategies |

### 03-rendering-optimization (Rendering Optimization)

| File | Topic | Overview |
|------|-------|----------|
| [rendering-optimization-complete.md](docs/03-rendering-optimization/rendering-optimization-complete.md) | Rendering Optimization | SSR/SSG/ISR strategies, React optimization patterns, virtualization |

## Learning Path

```
Bundle size analysis:    01-bundle-optimization
User experience metrics: 02-core-web-vitals
Rendering strategy:      03-rendering-optimization
```

## FAQ

### Q1: Which should I optimize first — bundle size or Core Web Vitals?

Start with bundle size analysis. Reducing the initial bundle is the most impactful change because it directly improves LCP, INP, and TTFB simultaneously. Use the Next.js Bundle Analyzer or rollup-plugin-visualizer to identify the largest dependencies, then apply code splitting and tree shaking before tuning individual Web Vitals.

### Q2: When should I use SSG vs SSR vs ISR?

Choose based on update frequency: static content updated less than once a month suits SSG; content updated hourly to daily suits ISR with an appropriate revalidate interval; real-time or user-specific data requires SSR. In Next.js App Router you can mix strategies per route, so use the most aggressive caching that still serves correct data.

### Q3: Is React.memo worth using everywhere?

No. React.memo has its own comparison overhead. Apply it only to components that are computationally expensive to render and receive the same props frequently — typically components with heavy calculations or long lists. For lightweight components the memo overhead outweighs the benefit. Profile with React DevTools Profiler before adding memo.

## Summary

This skill covers:

- Analyzing and reducing JavaScript bundle size with code splitting, tree shaking, and lighter dependency alternatives
- Measuring and improving Core Web Vitals (LCP, INP, CLS, TTFB) with real measurement data
- Selecting the right rendering strategy (SSR, SSG, ISR, CSR) and optimizing React re-renders
- Virtualizing large lists with react-window to maintain 60 FPS scrolling
- Setting up performance budgets and continuous monitoring with Lighthouse CI

## References

1. Google. "Core Web Vitals." web.dev/vitals, 2024.
2. Next.js. "Optimizing." nextjs.org/docs/app/building-your-application/optimizing, 2024.
3. Vite. "Build Optimizations." vitejs.dev/guide/build, 2024.
4. React. "Performance." react.dev/reference/react/memo, 2024.
5. Brian LeRoux. "The Cost of JavaScript." v8.dev/blog, 2019.

## Related Skills

- [Web Application Development](../web-application-development/) — Architecture, state management, routing
- [Web Development](../web-development/) — Framework selection and project structure
- [Browser and Web Platform](../browser-and-web-platform/) — Browser internals and rendering pipeline
