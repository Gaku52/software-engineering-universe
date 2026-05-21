# Web Accessibility — Complete Guide

> Build web applications that are usable by everyone, including people with disabilities. A systematic guide covering WCAG 2.1 compliance, ARIA patterns for accessible components, and automated testing integration.

## Target Audience

- Frontend engineers building accessible web applications
- Teams required to meet legal accessibility standards (Section 508, EU Accessibility Act)
- Developers wanting to improve Lighthouse Accessibility scores
- QA engineers implementing accessibility testing pipelines

## Prerequisites

- HTML/CSS/JavaScript basics
- React basics (components, hooks, event handling)
- Basic understanding of semantic HTML

## Guide Index

### 01-wcag (WCAG Compliance)

| File | Topic | Overview |
|------|-------|----------|
| [wcag-compliance-complete.md](docs/01-wcag/wcag-compliance-complete.md) | WCAG 2.1 Compliance | POUR principles, Level A/AA/AAA criteria with React implementation examples |

### 02-aria (ARIA Patterns)

| File | Topic | Overview |
|------|-------|----------|
| [aria-patterns-complete.md](docs/02-aria/aria-patterns-complete.md) | ARIA Patterns | 20 accessible component patterns including modal, tabs, dropdown, combobox |

### 03-testing (Accessibility Testing)

| File | Topic | Overview |
|------|-------|----------|
| [accessibility-testing-complete.md](docs/03-testing/accessibility-testing-complete.md) | Accessibility Testing | Automated testing with axe-core, Lighthouse CI, Playwright, and manual screen reader testing |

## Learning Path

```
Foundations:    01-wcag (understand requirements)
Implementation: 02-aria (build accessible components)
Verification:   03-testing (test and monitor)
```

## FAQ

### Q1: Do I need to reach WCAG AAA compliance?

For most products, Level AA is the target and the legal standard in the US (Section 508), EU, and many other jurisdictions. Level AAA is aspirational — it is very difficult to achieve for all content and is required only for specific high-sensitivity public services. Focus on AA; AAA improvements like 7:1 contrast ratios and link-only purpose labels are valuable quality enhancements but should not block shipping.

### Q2: Can I use ARIA attributes instead of semantic HTML?

Prefer semantic HTML whenever possible — this is the first rule of ARIA. Native elements like `<button>`, `<input>`, `<nav>`, and `<main>` come with built-in accessibility semantics, keyboard support, and browser compatibility. Use ARIA only when a custom interactive widget (tabs, combobox, tree view) cannot be expressed with native elements alone.

### Q3: Which screen reader should I test with first?

On Windows, use NVDA with Chrome — it is free and covers the majority of Windows screen reader users. On macOS, use VoiceOver with Safari (built-in, no install needed). These two combinations cover the most common user scenarios. Add JAWS testing for enterprise or government projects where JAWS market share is higher.

## Summary

This skill covers:

- WCAG 2.1 Level A and AA requirements with concrete React and Next.js implementation examples
- 20 accessible ARIA component patterns with keyboard navigation and screen reader test results
- Automated accessibility testing with axe-core (unit), Playwright (E2E), Lighthouse CI (continuous), and pa11y
- Manual testing procedures for keyboard navigation, screen readers, color contrast, and zoom
- CI/CD pipeline integration to catch regressions before they reach production

## References

1. W3C. "Web Content Accessibility Guidelines (WCAG) 2.1." w3.org/TR/WCAG21, 2018.
2. W3C. "WAI-ARIA Authoring Practices Guide." w3.org/WAI/ARIA/apg, 2024.
3. Deque Systems. "axe-core." github.com/dequelabs/axe-core, 2024.
4. Google. "Lighthouse Accessibility Audit." developer.chrome.com/docs/lighthouse, 2024.
5. WebAIM. "Screen Reader User Survey." webaim.org/projects/screenreadersurvey, 2024.

## Related Skills

- [Web Development](../web-development/) — Framework selection and project architecture
- [Frontend Performance](../frontend-performance/) — Core Web Vitals and rendering optimization
- [Web Application Development](../web-application-development/) — Full application development guide
