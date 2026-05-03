# CSS Layout Engine

> The CSS layout engine is a core component inside the browser that determines the position, dimensions, and arrangement order of HTML elements. By deeply understanding the Box Model, Normal Flow, Flexbox, Grid, Positioning, and the internal workings of layout calculation algorithms, you can build layouts that behave exactly as intended — efficiently and with excellent performance. This guide covers everything from rigorous explanations based on W3C specifications, to a collection of immediately applicable patterns for real-world projects, and includes edge cases and anti-patterns.

---

## Table of Contents

1. [Box Model in Detail](#1-box-model-in-detail)
2. [Normal Flow and Formatting Contexts](#2-normal-flow-and-formatting-contexts)
3. [Flexbox Internal Algorithm](#3-flexbox-internal-algorithm)
4. [CSS Grid Internal Algorithm](#4-css-grid-internal-algorithm)
5. [Positioning and Stacking Context](#5-positioning-and-stacking-context)
6. [Layout Calculation Algorithm Overview](#6-layout-calculation-algorithm-overview)
7. [Performance and Layout Thrashing](#7-performance-and-layout-thrashing)
8. [Flexbox vs Grid — In-Depth Comparison](#8-flexbox-vs-grid--in-depth-comparison)
9. [Practical Code Examples](#9-practical-code-examples)
10. [Anti-Pattern Collection](#10-anti-pattern-collection)
11. [Edge Case Analysis](#11-edge-case-analysis)
12. [Exercises (3 Levels)](#12-exercises-3-levels)
13. [FAQ](#13-faq)
14. [Glossary](#14-glossary)
15. [References](#15-references)

---

## What You Will Learn in This Chapter

- [ ] Accurately understand the calculation differences between the two Box Model modes (content-box / border-box)
- [ ] Grasp the placement rules for block-level and inline-level elements in Normal Flow
- [ ] Understand the conditions that generate a BFC (Block Formatting Context) and its effects
- [ ] Trace Flexbox's 6-stage layout algorithm all the way through internally
- [ ] Understand the CSS Grid track sizing algorithm
- [ ] Know where layout calculation sits in the browser's rendering pipeline
- [ ] Be able to design layouts with performance in mind

---

## Prerequisites

- Overview of the rendering pipeline → See: [Rendering Pipeline](./00-rendering-pipeline.md)
- CSS box model and layout modes (Flexbox, Grid)
- DOM/CSSOM tree construction → See: [HTML/CSS Parsing](../00-browser-engine/02-parsing-html-css.md)

---

## 1. Box Model in Detail

### 1.1 CSS Box Model Structure

Every HTML element is rendered as a "box." Each box is composed of four regions.

```
Complete structure of the CSS Box Model:

  ┌─────────────────────────────────────────────────────┐
  │                    margin-top                       │
  │  ┌──────────────────────────────────────────────┐   │
  │  │               border-top                     │   │
  │  │  ┌───────────────────────────────────────┐   │   │
  │  │  │            padding-top                │   │   │
  │  │  │  ┌─────────────────────────────────┐  │   │   │
  │  │  │  │                                 │  │   │   │
  │m │b │p │        content area             │p │b  │ m │
  │a │o │a │     (width x height)            │a │o  │ a │
  │r │r │d │                                 │d │r  │ r │
  │g │d │d │                                 │d │d  │ g │
  │i │e │i │                                 │i │e  │ i │
  │n │r │n │                                 │n │r  │ n │
  │  │  │g │                                 │g │   │   │
  │l │l │  │                                 │  │r  │ r │
  │e │e │l │                                 │r │i  │ i │
  │f │f │e │                                 │i │g  │ g │
  │t │t │f │                                 │g │h  │ h │
  │  │  │t │                                 │h │t  │ t │
  │  │  │  │                                 │t │   │   │
  │  │  │  └─────────────────────────────────┘  │   │   │
  │  │  │           padding-bottom              │   │   │
  │  │  └───────────────────────────────────────┘   │   │
  │  │              border-bottom                   │   │
  │  └──────────────────────────────────────────────┘   │
  │                   margin-bottom                     │
  └─────────────────────────────────────────────────────┘
```

Role of each region:

| Region | Description | Negative Values | Background Applied |
|--------|-------------|-----------------|-------------------|
| content | Area where text and child elements are placed | N/A | Yes |
| padding | Space between content and border | Not allowed | Yes |
| border | The boundary line of the box | N/A | Border itself |
| margin | Outer spacing from other elements | Allowed | No (transparent) |

### 1.2 The box-sizing Property in Detail

`box-sizing` controls what `width` and `height` refer to.

```css
/* content-box (default) */
.element-content-box {
  box-sizing: content-box;
  width: 300px;
  padding: 20px;
  border: 5px solid #333;
  /* Rendered width = 300 + 20*2 + 5*2 = 350px */
  /* You need to pre-calculate the rendered width */
}

/* border-box (recommended) */
.element-border-box {
  box-sizing: border-box;
  width: 300px;
  padding: 20px;
  border: 5px solid #333;
  /* Rendered width = 300px (exactly as specified) */
  /* Content width = 300 - 20*2 - 5*2 = 250px */
}
```

Calculation comparison table:

| Property | content-box | border-box |
|----------|-------------|------------|
| Specified width | 300px | 300px |
| padding | 20px x 2 = 40px | 20px x 2 = 40px |
| border | 5px x 2 = 10px | 5px x 2 = 10px |
| Content width | 300px | 250px |
| Rendered width | 350px | 300px |
| Total occupied width (including margin) | 350px + margin | 300px + margin |

Reset to apply border-box to all elements:

```css
/*
 * Universal box-sizing reset
 * Using inheritance makes it easy to revert
 * back to content-box for specific components
 */
html {
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
}

/* Revert back to content-box for specific components */
.legacy-component {
  box-sizing: content-box;
}
```

### 1.3 Margin Collapsing

The vertical margins of adjacent block-level elements "collapse." This is an important CSS characteristic that confuses many beginners.

```
Basics of margin collapsing:

  Case 1: Adjacent margins of sibling elements
  ┌──────────────┐
  │  Element A   │  margin-bottom: 30px
  └──────────────┘
         ↕ 30px (the larger value wins)
  ┌──────────────┐
  │  Element B   │  margin-top: 20px
  └──────────────┘

  Result: Gap is 30px (NOT 30 + 20 = 50px)

  Case 2: Margin between parent and first child
  ┌──────────────────────┐  ← parent's margin-top and
  │ ┌──────────────────┐ │     child's margin-top collapse
  │ │  child element   │ │
  │ └──────────────────┘ │
  └──────────────────────┘

  Case 3: Empty block element
  ┌──────────────┐
  │  Element A   │
  └──────────────┘
                       ← The margin-top and margin-bottom
  (empty <div>)          of an empty element also collapse
                       ←
  ┌──────────────┐
  │  Element B   │
  └──────────────┘
```

Conditions under which margin collapsing does NOT occur:

```css
/* Margins do not collapse if any of the following conditions apply */

/* 1. Children of Flexbox / Grid */
.flex-container { display: flex; flex-direction: column; }
.flex-container > * { /* margins do not collapse */ }

/* 2. Elements that generate a BFC */
.bfc { overflow: hidden; }         /* blocked at the BFC boundary */
.bfc { display: flow-root; }       /* more explicit BFC generation */

/* 3. Parent elements with padding or border */
.parent { padding-top: 1px; }      /* prevents parent-child collapse */
.parent { border-top: 1px solid transparent; }

/* 4. Floated elements */
.floated { float: left; }

/* 5. position: absolute / fixed */
.positioned { position: absolute; }

/* 6. When an inline element exists in between */
/* If a text node or inline element exists between sibling margins */
```

### 1.4 Negative Margins

Margins can be set to negative values. This is a characteristic unique to margins — not available for other box regions (padding, border).

```css
/* Effect of negative margins */
.pull-up {
  margin-top: -20px;
  /* Pulls the element 20px upward */
  /* Subsequent elements are pulled up along with it */
}

.pull-left {
  margin-left: -20px;
  /* Pulls the element 20px to the left */
}

/* Practical use: making a card image bleed beyond its container */
.card-image {
  margin-left: -16px;
  margin-right: -16px;
  margin-top: -16px;
  /* Expands in the opposite direction by the amount of the card's padding */
}
```

---

## 2. Normal Flow and Formatting Contexts

### 2.1 Basic Rules of Normal Flow

Normal Flow is CSS's default layout mode. All elements follow Normal Flow unless special properties (float, position, display: flex / grid, etc.) are applied.

```
The 2 levels of Normal Flow:

  Block-level elements (display: block / list-item / table, etc.):
  ─────────────────────────────────────────
  ┌───────────────────────────────────────┐
  │ <div>  width is 100% of parent       │
  └───────────────────────────────────────┘
  ┌───────────────────────────────────────┐
  │ <p>    starts on a new line          │
  └───────────────────────────────────────┘
  ┌───────────────────────────────────────┐
  │ <h2>   stacks vertically             │
  └───────────────────────────────────────┘

  Inline-level elements (display: inline / inline-block, etc.):
  ─────────────────────────────────────────
  Here │<span>│ and │<a href>│ and │<strong>│
  are placed horizontally │<em>│ and wrap at line end.
```

### 2.2 Overview of the display Property

In the CSS Display Level 3 specification, the `display` property is composed of two values: "outer display type" and "inner display type."

| Shorthand | Outer Display Type | Inner Display Type | Description |
|-----------|-------------------|--------------------|-------------|
| `block` | block | flow | Block container |
| `inline` | inline | flow | Inline box |
| `inline-block` | inline | flow-root | Inline-level BFC |
| `flex` | block | flex | Block-level Flex container |
| `inline-flex` | inline | flex | Inline-level Flex container |
| `grid` | block | grid | Block-level Grid container |
| `inline-grid` | inline | grid | Inline-level Grid container |
| `flow-root` | block | flow-root | Block container that generates a BFC |
| `none` | - | - | Excluded from the layout tree |

### 2.3 BFC (Block Formatting Context)

A BFC is an independent layout area for block-level elements. The layout inside a BFC does not affect the outside, and external layout does not affect the inside of a BFC.

Conditions that generate a BFC (major ones):

```css
/* 1. The root element of the document */
/* The <html> element always generates a BFC */

/* 2. Floated elements */
.bfc-float { float: left; }  /* either left or right */

/* 3. position: absolute / fixed */
.bfc-positioned { position: absolute; }

/* 4. display: inline-block */
.bfc-inline-block { display: inline-block; }

/* 5. display: flow-root (the most explicit method) */
.bfc-flow-root { display: flow-root; }

/* 6. display: flex / grid containers */
.bfc-flex { display: flex; }

/* 7. overflow other than visible */
.bfc-overflow { overflow: hidden; }  /* auto / scroll also work */

/* 8. contain property */
.bfc-contain { contain: layout; }  /* content / strict also work */
```

The 3 main effects of a BFC:

```
Effect 1: Float containment
  ─────────────────────────────────────
  Without BFC:             With BFC:
  ┌────────────────┐       ┌────────────────────┐
  │ parent          │       │ parent (BFC)        │
  │ ┌──────┐       │       │ ┌──────┐            │
  │ │float │       │       │ │float │ text       │
  │ └──────┘       │       │ └──────┘            │
  └────────────────┘       │                     │
  text spills out here     └────────────────────┘

Effect 2: Blocking margin collapsing
  ─────────────────────────────────────
  Margins across a BFC boundary do not collapse

Effect 3: Preventing overlap with floats
  ─────────────────────────────────────
  A BFC element does not overlap with adjacent floats
```

### 2.4 Inline Formatting Context (IFC)

An IFC is the layout context for inline-level elements. Text placement and `line-height` calculation all happen inside an IFC.

```css
/* Important concepts in an IFC */

/* line box: the area for one line containing inline elements */
.text-container {
  font-size: 16px;
  line-height: 1.5;
  /* line box height = 16 * 1.5 = 24px */
}

/* vertical-align: vertical placement within a line box */
.icon {
  vertical-align: middle;
  /* baseline, top, bottom, text-top, text-bottom are also available */
}

/* inline-block characteristics */
.inline-block-element {
  display: inline-block;
  width: 100px;
  height: 50px;
  vertical-align: top;
  /* Participates in inline flow while being able to have width and height */
}
```

---

## 3. Flexbox Internal Algorithm

### 3.1 Flexbox Layout Conceptual Model

Flexbox is a one-dimensional layout system that positions elements along two axes: the main axis and the cross axis.

```
Axes for flex-direction: row (default):

  main-start                                    main-end
      │                                            │
      ▼                                            ▼
  ┌──────────────────────────────────────────────────┐ ← cross-start
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
  │  │ item 1  │  │ item 2  │  │ item 3  │         │
  │  │         │  │         │  │         │         │
  │  └─────────┘  └─────────┘  └─────────┘         │
  │                                                  │
  │  ──────── main axis ──────────────→              │
  │                                                  │
  └──────────────────────────────────────────────────┘ ← cross-end
                                                  │
                                           cross axis ↓

When flex-direction: column:
  The main axis runs vertically and the cross axis runs horizontally.
```

### 3.2 Flex Container Properties in Detail

```css
.flex-container {
  display: flex;           /* generates a flex container */

  /* --- Main axis direction --- */
  flex-direction: row;           /* left→right (default) */
  flex-direction: row-reverse;   /* right→left */
  flex-direction: column;        /* top→bottom */
  flex-direction: column-reverse;/* bottom→top */

  /* --- Wrapping --- */
  flex-wrap: nowrap;    /* no wrapping (default) */
  flex-wrap: wrap;      /* wrap to next line */
  flex-wrap: wrap-reverse; /* wrap in reverse direction */

  /* --- Shorthand --- */
  flex-flow: row wrap;  /* flex-direction + flex-wrap */

  /* --- Alignment along the main axis --- */
  justify-content: flex-start;    /* align to start (default) */
  justify-content: flex-end;      /* align to end */
  justify-content: center;        /* center */
  justify-content: space-between; /* space between items, flush to edges */
  justify-content: space-around;  /* equal space around each item */
  justify-content: space-evenly;  /* fully equal spacing */

  /* --- Alignment along the cross axis --- */
  align-items: stretch;     /* stretch to fill (default) */
  align-items: flex-start;  /* start of cross axis */
  align-items: flex-end;    /* end of cross axis */
  align-items: center;      /* center of cross axis */
  align-items: baseline;    /* align text baselines */

  /* --- Multi-line alignment --- */
  align-content: flex-start;    /* pack lines to start when wrapping */
  align-content: center;        /* center lines when wrapping */
  align-content: space-between; /* equal spacing between lines when wrapping */

  /* --- Gaps --- */
  gap: 16px;         /* both row and column */
  row-gap: 16px;     /* row only */
  column-gap: 24px;  /* column only */
}
```

### 3.3 Flex Item Properties in Detail

```css
.flex-item {
  /* --- Controlling growth and shrinkage --- */
  flex-grow: 0;     /* ratio for distributing free space (default: 0 = don't grow) */
  flex-shrink: 1;   /* ratio for shrinking (default: 1 = shrink) */
  flex-basis: auto; /* base size (default: auto = depends on content) */

  /* --- flex shorthand --- */
  flex: initial;   /* = 0 1 auto → shrink only */
  flex: auto;      /* = 1 1 auto → grow and shrink */
  flex: none;      /* = 0 0 auto → fixed size */
  flex: 1;         /* = 1 1 0%   → equal distribution */
  flex: 2;         /* = 2 1 0%   → distributed at 2x the ratio */

  /* --- Individual cross-axis alignment --- */
  align-self: auto;       /* follows the container's align-items */
  align-self: flex-start; /* only this item aligns to start */
  align-self: center;     /* only this item centers */

  /* --- Display order --- */
  order: 0;   /* default; lower numbers appear first */
  order: -1;  /* move to the beginning */
  order: 1;   /* move to the end */
}
```

### 3.4 Flexbox Layout Calculation Algorithm (6 Stages)

A step-by-step explanation of how the browser's layout engine calculates Flexbox — its internal algorithm.

```
6 stages of Flexbox layout calculation:

  ┌─────────────────────────────────────────────┐
  │ Stage 1: Determine available space          │
  │  Container width (or height) minus          │
  │  padding and border                         │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Stage 2: Determine tentative size per item  │
  │  Priority: flex-basis → width/height →      │
  │  content size                               │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Stage 3: Calculate free space (+ or -)      │
  │  Available space - sum of tentative sizes   │
  │  Positive = free space, Negative = overflow │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Stage 4: Apply flex-grow / flex-shrink      │
  │  Positive free space → distribute by        │
  │  flex-grow ratio                            │
  │  Negative free space → shrink by            │
  │  flex-shrink ratio                          │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Stage 5: Apply min/max constraints          │
  │  Clamp to the range of min-width/max-width  │
  │  If constraints are violated, re-run        │
  │  Stage 4                                    │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Stage 6: Determine placement                │
  │  justify-content → main axis placement      │
  │  align-items     → cross axis placement     │
  │  align-content   → multi-line placement     │
  └─────────────────────────────────────────────┘
```

#### Calculation Example: flex-grow Distribution

```css
.container {
  display: flex;
  width: 600px;  /* available space: 600px */
}

.item-a { flex: 2 1 100px; }  /* basis: 100px, grow: 2 */
.item-b { flex: 1 1 150px; }  /* basis: 150px, grow: 1 */
.item-c { flex: 1 1 100px; }  /* basis: 100px, grow: 1 */
```

```
Calculation process:

  Step 1: Sum of tentative sizes = 100 + 150 + 100 = 350px
  Step 2: Free space = 600 - 350 = 250px (positive free space)
  Step 3: Total grow = 2 + 1 + 1 = 4
  Step 4: Distribution per item
    item-a: 100 + (250 * 2/4) = 100 + 125 = 225px
    item-b: 150 + (250 * 1/4) = 150 + 62.5 = 212.5px
    item-c: 100 + (250 * 1/4) = 100 + 62.5 = 162.5px

  Verification: 225 + 212.5 + 162.5 = 600px ✓

  ┌────────────────────────────────────────────────────┐
  │ ┌──────────────┐ ┌─────────────┐ ┌──────────┐     │
  │ │   item-a     │ │   item-b    │ │  item-c  │     │
  │ │   225px      │ │   212.5px   │ │  162.5px │     │
  │ └──────────────┘ └─────────────┘ └──────────┘     │
  └────────────────────────────────────────────────────┘
                        600px
```

#### Calculation Example: flex-shrink Shrinkage

The calculation for flex-shrink is more complex than for flex-grow. The amount of shrinkage is also proportional to the item's flex-basis.

```css
.container {
  display: flex;
  width: 400px;  /* available space: 400px */
}

.item-a { flex: 0 2 200px; }  /* basis: 200px, shrink: 2 */
.item-b { flex: 0 1 300px; }  /* basis: 300px, shrink: 1 */
```

```
Calculation process:

  Step 1: Sum of tentative sizes = 200 + 300 = 500px
  Step 2: Deficit = 400 - 500 = -100px (negative free space)
  Step 3: Calculate weighted shrink factor
    item-a weight = shrink * basis = 2 * 200 = 400
    item-b weight = shrink * basis = 1 * 300 = 300
    Total weight = 400 + 300 = 700
  Step 4: Shrinkage per item
    item-a: 200 - (100 * 400/700) = 200 - 57.14 ≈ 142.86px
    item-b: 300 - (100 * 300/700) = 300 - 42.86 ≈ 257.14px

  Verification: 142.86 + 257.14 = 400px ✓

  Note: With flex-shrink, an item with a larger basis shrinks more
        even at the same shrink value — this is the weighted approach.
```

### 3.5 flex-basis vs width

It is important to precisely understand the priority order between `flex-basis` and `width` (or `height`).

```
Resolution priority of flex-basis:

  1. If flex-basis is not auto → use flex-basis
  2. If flex-basis is auto and width is specified → use width
  3. If flex-basis is auto and no width → use content size
  4. flex-basis: 0 → ignore content size and start from 0

  Note: flex-basis: 0 and flex-basis: 0% can differ
        When the container has no explicit size, % cannot
        be resolved as a percentage calculation
```

```css
/* Common confusion: how flex: 1 works internally */
.item {
  flex: 1;
  /* This expands to flex: 1 1 0% */
  /* flex-basis: 0% → ignores content size, */
  /* distributes available space fully equally by grow ratio */
}

.item-auto {
  flex: 1 1 auto;
  /* flex-basis: auto → first reserves content size, */
  /* then distributes remaining space by grow ratio */
  /* Items with more content become larger */
}
```

---

## 4. CSS Grid Internal Algorithm

### 4.1 CSS Grid Layout Conceptual Model

CSS Grid is a two-dimensional layout system that can control both rows and columns simultaneously. While Flexbox "stretches and shrinks to fit content," Grid takes the approach of "placing content onto a grid structure."

```
Basic structure of CSS Grid:

  grid-template-columns: 200px 1fr 1fr;
  grid-template-rows: 80px 1fr 60px;
  gap: 12px;

       col 1      col 2       col 3
       200px       1fr         1fr
  ┌──────────┬───────────┬───────────┐
  │          │           │           │ row 1
  │  Cell    │  Cell     │  Cell     │ 80px
  │  (1,1)   │  (1,2)    │  (1,3)    │
  ├──────────┼───────────┼───────────┤ ← 12px gap
  │          │           │           │ row 2
  │  Cell    │  Cell     │  Cell     │ 1fr
  │  (2,1)   │  (2,2)    │  (2,3)    │
  │          │           │           │
  ├──────────┼───────────┼───────────┤ ← 12px gap
  │          │           │           │ row 3
  │  Cell    │  Cell     │  Cell     │ 60px
  │  (3,1)   │  (3,2)    │  (3,3)    │
  └──────────┴───────────┴───────────┘
       ↕          ↕
     12px gap   12px gap

  Grid Lines:
  │1       │2          │3          │4  ← column grid lines
  ─1─────────────────────────────────  ← row grid lines
  ─2─────────────────────────────────
  ─3─────────────────────────────────
  ─4─────────────────────────────────
```

### 4.2 Grid Container Properties in Detail

```css
.grid-container {
  display: grid;

  /* --- Define tracks --- */
  grid-template-columns: 200px 1fr 1fr;
  grid-template-rows: auto 1fr auto;

  /* repeat() function */
  grid-template-columns: repeat(3, 1fr);          /* divide into 3 equal parts */
  grid-template-columns: repeat(4, 100px 200px);  /* repeat a pattern */
  grid-template-columns: 200px repeat(3, 1fr);    /* mixed */

  /* minmax() function */
  grid-template-columns: minmax(200px, 1fr) 2fr;
  /* minimum 200px, maximum 1fr equivalent */

  /* auto-fill / auto-fit */
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));

  /* --- Area template --- */
  grid-template-areas:
    "header  header  header"
    "sidebar content content"
    "footer  footer  footer";

  /* --- Gaps --- */
  gap: 16px;
  row-gap: 16px;
  column-gap: 24px;

  /* --- Implicit tracks --- */
  grid-auto-rows: minmax(100px, auto);
  grid-auto-columns: 1fr;
  grid-auto-flow: row;     /* row | column | dense */

  /* --- Alignment --- */
  justify-items: stretch;   /* horizontal alignment within cells */
  align-items: stretch;     /* vertical alignment within cells */
  justify-content: start;   /* horizontal alignment of entire grid */
  align-content: start;     /* vertical alignment of entire grid */
}
```

### 4.3 Grid Item Properties in Detail

```css
.grid-item {
  /* --- Placement (by line number) --- */
  grid-column-start: 1;
  grid-column-end: 3;       /* from column 1 to column 3 (spans 2 columns) */
  grid-row-start: 1;
  grid-row-end: 2;

  /* --- Shorthand --- */
  grid-column: 1 / 3;       /* start / end */
  grid-row: 1 / 2;
  grid-area: 1 / 1 / 2 / 3; /* row-start / col-start / row-end / col-end */

  /* --- span keyword --- */
  grid-column: 1 / span 2;  /* from column 1, span 2 columns */
  grid-column: span 2;      /* auto-placed, span 2 columns */

  /* --- Named area --- */
  grid-area: header;         /* name defined in grid-template-areas */

  /* --- Individual alignment --- */
  justify-self: center;     /* horizontal alignment within cell (individual) */
  align-self: end;           /* vertical alignment within cell (individual) */
}
```

### 4.4 Grid Track Sizing Algorithm

Grid track sizing is one of the most complex algorithms in the CSS specification. Here is an overview.

```
Overview of the Grid track sizing algorithm:

  ┌─────────────────────────────────────────────┐
  │ Phase 1: Resolve fixed-size tracks          │
  │  Fixed units like px, em → determined as-is │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Phase 2: Resolve content-based tracks       │
  │  auto, min-content, max-content,            │
  │  fit-content() → measure content to decide  │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Phase 3: Resolve fr-unit tracks             │
  │  Distribute remaining available space       │
  │  by fr ratio                                │
  │  Note: for minmax(auto, 1fr),               │
  │    the minimum value is content size        │
  └─────────────┬───────────────────────────────┘
                │
  ┌─────────────▼───────────────────────────────┐
  │ Phase 4: Adjust spanning items              │
  │  Distribute the size requirements of items  │
  │  spanning multiple tracks across tracks     │
  └─────────────────────────────────────────────┘
```

### 4.5 Detailed Calculation of the fr Unit

```css
.container {
  display: grid;
  width: 900px;
  grid-template-columns: 200px 1fr 2fr;
  gap: 20px;
}
```

```
fr unit calculation process:

  Step 1: Calculate available space
    Container width: 900px
    Total gaps: 20px * 2 = 40px (2 gaps between 3 columns)
    Fixed tracks: 200px
    Space available for fr = 900 - 40 - 200 = 660px

  Step 2: Total fr
    1fr + 2fr = 3fr

  Step 3: Value of 1fr
    660px / 3 = 220px

  Step 4: Width of each track
    Column 1: 200px (fixed)
    Column 2: 1fr = 220px
    Column 3: 2fr = 440px

  Verification: 200 + 220 + 440 + 40(gap) = 900px ✓

  ┌──────────┬────────────────┬──────────────────────────────┐
  │  200px   │     220px      │           440px              │
  │  fixed   │     1fr        │           2fr                │
  └──────────┴────────────────┴──────────────────────────────┘
       ↕ 20px gap     ↕ 20px gap
```

### 4.6 Difference Between auto-fill and auto-fit

```css
/* auto-fill: retains empty tracks */
.grid-auto-fill {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

/* auto-fit: collapses empty tracks */
.grid-auto-fit {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
```

```
Container width: 600px, items: 2, minmax(150px, 1fr):

  auto-fill:
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │ item1  │ │ item2  │ │ (empty)│ │ (empty)│
  │ 150px  │ │ 150px  │ │ 150px  │ │ 150px  │
  └────────┘ └────────┘ └────────┘ └────────┘
  → 4 tracks created, empty tracks also hold 150px

  auto-fit:
  ┌──────────────────┐ ┌──────────────────┐
  │     item1        │ │     item2        │
  │     300px        │ │     300px        │
  └──────────────────┘ └──────────────────┘
  → Empty tracks collapse to 0px,
    existing items share remaining space via 1fr
```

### 4.7 Named Layout with grid-template-areas

```css
/* Example: dashboard layout */
.dashboard {
  display: grid;
  grid-template-columns: 250px 1fr 1fr;
  grid-template-rows: 60px 1fr 1fr 40px;
  grid-template-areas:
    "nav     header  header"
    "nav     main    aside"
    "nav     main    aside"
    "nav     footer  footer";
  gap: 8px;
  height: 100vh;
}

.nav    { grid-area: nav; }
.header { grid-area: header; }
.main   { grid-area: main; }
.aside  { grid-area: aside; }
.footer { grid-area: footer; }

/* "." can be used to leave an area empty */
.layout-with-gap {
  grid-template-areas:
    "header header header"
    "sidebar . content"
    "footer footer footer";
}
```

---

## 5. Positioning and Stacking Context

### 5.1 All Modes of the position Property

```css
/* static (default) */
.static {
  position: static;
  /* Follows Normal Flow */
  /* top / left / right / bottom have no effect */
}

/* relative: moves relative to original position */
.relative {
  position: relative;
  top: 10px;
  left: 20px;
  /* Moves from the original position in Normal Flow */
  /* The original position is preserved (still occupies space) */
}

/* absolute: placed relative to the nearest positioned ancestor */
.absolute {
  position: absolute;
  top: 0;
  right: 0;
  /* Completely removed from Normal Flow */
  /* Reference: the nearest ancestor with position other than static */
  /* If all ancestors are static, the initial containing block (viewport) is used */
}

/* fixed: placed relative to the viewport */
.fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  /* Position does not change on scroll */
  /* Note: if an ancestor has transform, filter, or perspective,
     that ancestor becomes the containing block (important edge case) */
}

/* sticky: switches between relative and fixed based on scroll position */
.sticky {
  position: sticky;
  top: 0;
  /* Before scrolling, behaves like relative */
  /* When scroll reaches top: 0, behaves like fixed */
  /* Note: operates within the nearest scrollable ancestor */
}
```

### 5.2 Stacking Context

```
Paint order within a Stacking Context:

  Back                                          Front
  ─────────────────────────────────────────────────→

  1. Background  2. Negative  3. Block-    4. Float  5. Inline-  6. z-index:0  7. Positive
     and border    z-index     level        elements  level       / auto        z-index
                               elements               elements

  ┌──────────────────────────────────────────────────┐
  │ ┌─────────┐                                      │
  │ │z-index  │ ← frontmost (7)                     │
  │ │  : 10   │                                      │
  │ └─────────┘                                      │
  │          ┌─────────┐                             │
  │          │z-index  │ ← (6)                       │
  │          │  : 0    │                              │
  │          └─────────┘                             │
  │ ┌─────────────────────┐                          │
  │ │ inline text         │ ← (5)                    │
  │ └─────────────────────┘                          │
  │    ┌─────────┐                                   │
  │    │ float   │ ← (4)                             │
  │    └─────────┘                                   │
  │ ┌────────────────────────────────────┐           │
  │ │ block-level child element          │ ← (3)     │
  │ └────────────────────────────────────┘           │
  │  ┌──────────┐                                    │
  │  │z-index   │ ← (2)                             │
  │  │ : -1     │                                    │
  │  └──────────┘                                    │
  │ ████████████████████████████████████ ← (1) background │
  └──────────────────────────────────────────────────┘
```

Conditions that generate a Stacking Context:

```css
/* Main conditions that generate a Stacking Context */

/* 1. Root element (<html>) */

/* 2. position + z-index */
.sc-1 { position: relative; z-index: 1; }
.sc-2 { position: absolute; z-index: 0; }

/* 3. position: fixed / sticky always generates one */
.sc-3 { position: fixed; }
.sc-4 { position: sticky; top: 0; }

/* 4. opacity less than 1 */
.sc-5 { opacity: 0.99; }

/* 5. transform other than none */
.sc-6 { transform: translateZ(0); }

/* 6. filter other than none */
.sc-7 { filter: blur(0); }

/* 7. will-change with specific properties */
.sc-8 { will-change: transform; }

/* 8. isolation: isolate */
.sc-9 { isolation: isolate; }

/* 9. mix-blend-mode other than normal */
.sc-10 { mix-blend-mode: multiply; }

/* 10. contain: layout / paint / strict / content */
.sc-11 { contain: paint; }
```

### 5.3 Containing Block

The containing block is the reference rectangle for an element's size calculations and percentage values.

```
Rules for determining the containing block:

  position: static / relative
  → Content area of the nearest block container ancestor

  position: absolute
  → Padding edge of the nearest ancestor with
     position other than static

  position: fixed
  → Viewport (normally)
  → Note: if an ancestor has transform/filter/perspective,
     it becomes that ancestor's padding edge

  position: sticky
  → Content area of the nearest scrollable ancestor
```

---

## 6. Layout Calculation Algorithm Overview

### 6.1 Position in the Browser Rendering Pipeline

```
Full rendering pipeline diagram:

  HTML/CSS
    │
    ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │  Parse   │──→│   DOM    │──→│  CSSOM   │
  │          │   │  Tree    │   │  Tree    │
  └──────────┘   └──────────┘   └──────────┘
                       │              │
                       ▼              │
                 ┌──────────┐        │
                 │  Render  │←───────┘
                 │  Tree    │
                 └────┬─────┘
                      │
                      ▼
                ┌───────────┐
                │  Layout   │ ← ★ This is layout calculation
                │ (Reflow)  │    Determines positions and sizes
                └─────┬─────┘
                      │
                      ▼
                ┌───────────┐
                │  Paint    │
                │ (generate │
                │  draw     │
                │  commands)│
                └─────┬─────┘
                      │
                      ▼
                ┌───────────┐
                │ Composite │
                └───────────┘
                      │
                      ▼
                  Display
```

### 6.2 Detailed Layout Calculation Flow

```
Internal flow of Layout calculation:

  ┌──────────────────────────────────────────────┐
  │ 1. Start from the root element               │
  │    Initial containing block = viewport size  │
  └─────────────┬────────────────────────────────┘
                │
  ┌─────────────▼────────────────────────────────┐
  │ 2. Evaluate display / position per element   │
  │    → Determine layout mode                   │
  │    Normal Flow / Flex / Grid / Float / Abs   │
  └─────────────┬────────────────────────────────┘
                │
  ┌─────────────▼────────────────────────────────┐
  │ 3. Traverse tree in depth-first order        │
  │    Parent passes "available space" to child  │
  │    Child returns "required size" to parent   │
  └─────────────┬────────────────────────────────┘
                │
  ┌─────────────▼────────────────────────────────┐
  │ 4. Resolve constraints                       │
  │    width / height / min / max / %            │
  │    Determined from available space and       │
  │    the element's intrinsic size              │
  └─────────────┬────────────────────────────────┘
                │
  ┌─────────────▼────────────────────────────────┐
  │ 5. Execute the algorithm specific to each    │
  │    layout mode                               │
  │    Block: vertical stacking + margin collapse│
  │    Inline: line box creation + wrapping      │
  │    Flex: 6-stage algorithm                   │
  │    Grid: track sizing                        │
  └─────────────┬────────────────────────────────┘
                │
  ┌─────────────▼────────────────────────────────┐
  │ 6. Finalize coordinates                      │
  │    Determine (x, y, width, height) per elem  │
  │    Write to layout tree                      │
  └──────────────────────────────────────────────┘
```

### 6.3 Resolving Percentage Values

Percentage values are calculated relative to the containing block. However, the reference differs depending on the property.

| Property | Percentage Reference |
|----------|---------------------|
| width | Width of containing block |
| height | Height of containing block (*) |
| padding-top / padding-bottom | **Width** of containing block (not height) |
| margin-top / margin-bottom | **Width** of containing block (not height) |
| top / bottom | Height of containing block |
| left / right | Width of containing block |
| font-size | Parent element's font-size |
| line-height | The element's own font-size |

```css
/*
 * Important: % for vertical padding and margin is
 * based on the "width" of the containing block.
 *
 * This spec is counterintuitive but is designed
 * to prevent circular references.
 */
.aspect-ratio-hack {
  width: 100%;
  padding-top: 56.25%;  /* 16:9 aspect ratio */
  /* padding-top % is relative to width, so
     56.25% of the width = 9/16 height */
  height: 0;
}

/* Modern way to specify aspect ratio */
.modern-aspect-ratio {
  aspect-ratio: 16 / 9;
  width: 100%;
  /* Can be specified directly with the aspect-ratio property */
}
```

---

## 7. Performance and Layout Thrashing

### 7.1 Layout Thrashing

Layout Thrashing is the problem of forcing the browser to synchronously recalculate layout by alternating between reading and writing to the DOM in JavaScript.

```javascript
// --- Anti-pattern: Layout Thrashing ---
// A layout recalculation occurs on each loop iteration (O(n) layout calculations)
const elements = document.querySelectorAll('.item');
for (const el of elements) {
  const height = el.offsetHeight;       // read → triggers synchronous layout
  el.style.width = height * 2 + 'px';  // write → invalidates layout
}

// --- Improved pattern: Separate reads and writes ---
const elements = document.querySelectorAll('.item');

// Phase 1: Batch all reads
const heights = Array.from(elements).map(el => el.offsetHeight);

// Phase 2: Batch all writes
elements.forEach((el, i) => {
  el.style.width = heights[i] * 2 + 'px';
});
```

### 7.2 Properties That Trigger Layout

The following properties and APIs trigger layout calculation. Care is needed in performance-sensitive contexts.

```
Operations that trigger (cause) layout:

  Reading DOM properties:
  ├── offsetTop, offsetLeft, offsetWidth, offsetHeight
  ├── scrollTop, scrollLeft, scrollWidth, scrollHeight
  ├── clientTop, clientLeft, clientWidth, clientHeight
  └── some properties of getComputedStyle()

  Layout only (no Paint):
  ├── width, height, min-*, max-*
  ├── padding, margin, border
  ├── display, position, float
  ├── top, left, right, bottom
  └── font-size, line-height, text-align

  Up to Paint:
  ├── color, background, box-shadow
  ├── border-radius, border-style
  └── visibility

  Composite only (lightest):
  ├── transform
  ├── opacity
  └── will-change
```

### 7.3 Layout Optimization with the contain Property

```css
/* contain: limits the scope of layout impact */
.card {
  contain: layout;
  /* Layout changes inside this element do not affect the outside */
  /* The browser only needs to recalculate this element */
}

.widget {
  contain: strict;
  /* Contains layout + paint + size + style — all of them */
  /* Most powerful, but size cannot depend on content */
}

.article {
  contain: content;
  /* Contains layout + paint + style */
  /* Does not contain size, so size changes with content are still possible */
}

/* content-visibility: skips rendering of off-screen elements */
.long-list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px;
  /* When off-screen, laid out with a placeholder size of 200px,
     and internal rendering is completely skipped */
}
```

---

## 8. Flexbox vs Grid — In-Depth Comparison

### 8.1 Difference in Design Philosophy

| Aspect | Flexbox | CSS Grid |
|--------|---------|----------|
| Dimensions | 1D (row **or** column) | 2D (controls rows **and** columns simultaneously) |
| Design approach | Content-driven (content-out) | Layout-driven (layout-in) |
| Size determination | Stretches/shrinks based on content | Placed according to track definition |
| Wrapping | Extension of 1D via flex-wrap | Inherently 2D structure |
| Item placement | Tends to depend on source order | Freely placeable with grid-area |
| Overlap | Not standard | Possible by overlapping grid-area |
| Gap support | Yes | Yes |
| Subgrid | No | Nested alignment possible with subgrid |
| Browser support | IE11 partial (-ms-) | IE11 not supported (old spec only) |
| Appropriate uses | Navbars, card interiors, toolbars | Page layouts, dashboards |

### 8.2 Recommendations by Use Case

```
Recommended layout mode by use case:

  ┌────────────────────────────┬──────────┬──────────┐
  │ Use Case                   │ Flexbox  │  Grid    │
  ├────────────────────────────┼──────────┼──────────┤
  │ Navigation bar             │  ★Best  │  △OK    │
  │ Card interior layout       │  ★Best  │  △OK    │
  │ Toolbar button placement   │  ★Best  │  ○OK    │
  │ Form input + button        │  ★Best  │  ○OK    │
  │ Centering an element       │  ★Best  │  ★Best  │
  │ Equal-width card grid      │  ○OK    │  ★Best  │
  │ Full page layout           │  △OK    │  ★Best  │
  │ Dashboard                  │  ×Avoid │  ★Best  │
  │ Holy Grail layout          │  △OK    │  ★Best  │
  │ Magazine-style layout      │  ×Avoid │  ★Best  │
  │ Overlapping elements       │  ×Avoid │  ★Best  │
  │ Responsive card list       │  ○OK    │  ★Best  │
  └────────────────────────────┴──────────┴──────────┘

  ★Best: Optimal choice
  ○OK:  Usable but not optimal
  △OK:  Somewhat forced
  ×Avoid: Inappropriate
```

### 8.3 Combining Flexbox and Grid

In actual projects, combining Flexbox and Grid where each shines is the most effective approach.

```css
/* Entire page: Grid */
.page-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  grid-template-rows: 60px 1fr 40px;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  min-height: 100vh;
}

/* Header interior: Flexbox */
.header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

/* Navigation: Flexbox */
.header-nav {
  display: flex;
  gap: 16px;
  align-items: center;
}

/* Card grid inside main content: Grid */
.main-content {
  grid-area: main;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
}

/* Each card interior: Flexbox */
.card {
  display: flex;
  flex-direction: column;
}

.card-body {
  flex: 1;  /* cards align to the same height */
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;  /* pin footer to the bottom */
}
```

---

## 9. Practical Code Examples

### 9.1 Perfect Centering (5 Methods)

```css
/* Method 1: Flexbox (most versatile) */
.center-flex {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

/* Method 2: Grid (most concise) */
.center-grid {
  display: grid;
  place-items: center;
  min-height: 100vh;
}

/* Method 3: Grid + margin: auto */
.center-grid-margin {
  display: grid;
  min-height: 100vh;
}
.center-grid-margin > .child {
  margin: auto;
}

/* Method 4: position + transform */
.center-position {
  position: relative;
  min-height: 100vh;
}
.center-position > .child {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Method 5: position + inset + margin (modern) */
.center-inset {
  position: relative;
  min-height: 100vh;
}
.center-inset > .child {
  position: absolute;
  inset: 0;
  margin: auto;
  width: fit-content;
  height: fit-content;
}
```

### 9.2 Holy Grail Layout

```css
/* Holy Grail layout with CSS Grid */
.holy-grail {
  display: grid;
  grid-template:
    "header header header" 60px
    "nav    main   aside"  1fr
    "footer footer footer" 40px
    / 200px 1fr    200px;
  min-height: 100vh;
  gap: 0;
}

.header { grid-area: header; background: #2d3748; color: white; }
.nav    { grid-area: nav;    background: #edf2f7; }
.main   { grid-area: main;   padding: 24px; }
.aside  { grid-area: aside;  background: #edf2f7; }
.footer { grid-area: footer; background: #2d3748; color: white; }

/* Responsive */
@media (max-width: 768px) {
  .holy-grail {
    grid-template:
      "header" 60px
      "nav"    auto
      "main"   1fr
      "aside"  auto
      "footer" 40px
      / 1fr;
  }
}
```

### 9.3 Sticky Footer

```css
/* Method 1: Sticky footer with Flexbox */
.page-flex {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-flex > main {
  flex: 1;
  /* Even if there is little main content,
     the footer is placed at the bottom of the viewport */
}

/* Method 2: Sticky footer with Grid */
.page-grid {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

/* Method 3: Grid + min-height (most concise) */
body {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;  /* dvh: dynamic viewport height */
}
```

### 9.4 Responsive Card Grid

```css
/* Auto-wrapping card grid (no media queries needed) */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 24px;
  padding: 24px;
}

/*
 * Why use min(100%, 300px):
 * - If the viewport is smaller than 300px, minmax(300px, 1fr)
 *   causes the card to overflow the container
 * - With min(100%, 300px), if the container width is less than 300px,
 *   100% is applied, preventing overflow
 */

/* Equal height cards */
.card {
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.card-image {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  width: 100%;
}

.card-content {
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.card-description {
  flex: 1;
  color: #4a5568;
}

.card-action {
  margin-top: auto;
  padding-top: 16px;
}
```

### 9.5 Sidebar + Main Variable Layout

```css
/* Sidebar always at a fixed width, main takes the remainder */
.sidebar-layout {
  display: flex;
  gap: 24px;
}

.sidebar {
  flex: 0 0 280px;  /* fixed width 280px */
  /* flex-shrink: 0 prevents shrinking */
}

.main-content {
  flex: 1;
  min-width: 0;
  /* Without min-width: 0, text overflow occurs */
  /* Default min-width of a flex item is auto (content width) */
}

/* Responsive: stack vertically on small screens */
@media (max-width: 768px) {
  .sidebar-layout {
    flex-direction: column;
  }

  .sidebar {
    flex: none;  /* release fixed width */
    order: -1;   /* move sidebar to top if needed */
  }
}
```

---

## 10. Anti-Pattern Collection

### 10.1 Anti-Pattern: Flex Item Overflow Due to Missing min-width: 0

```css
/* --- Problematic code --- */
.container {
  display: flex;
}

.long-text-item {
  flex: 1;
  /* Long text or URLs overflow the container */
  /* The default min-width of a flex item is auto, which means
     "don't shrink below the minimum content width" */
}

/* --- Fixed code --- */
.container {
  display: flex;
}

.long-text-item {
  flex: 1;
  min-width: 0;
  /* min-width: 0 allows shrinking below the content width */
  /* text-overflow: ellipsis and similar also work correctly now */
}

.long-text-item p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

```
Illustration of the problem:

  With min-width: auto (default):
  ┌──────────────────────────────────────────────────────┐
  │ ┌────────┐ ┌─────────────────────────────────────────┼──────┐
  │ │sidebar │ │ This long text overflows the container  │oflow │
  │ └────────┘ └─────────────────────────────────────────┼──────┘
  └──────────────────────────────────────────────────────┘

  With min-width: 0 added:
  ┌──────────────────────────────────────────────────────┐
  │ ┌────────┐ ┌────────────────────────────────────────┐│
  │ │sidebar │ │ This long text stays within the con... ││
  │ └────────┘ └────────────────────────────────────────┘│
  └──────────────────────────────────────────────────────┘
```

### 10.2 Anti-Pattern: Forgetting the height: 100% Chain

```css
/* --- Problematic code --- */
.child {
  height: 100%;
  /* Without an explicit height on the parent,
     height: 100% is ignored.
     The browser cannot resolve "100% of what?" */
}

/* --- Fixed code --- */

/* Method 1: Ensure the height chain */
html, body {
  height: 100%;  /* first establish height at the root */
}
.parent {
  height: 100%;  /* parent also needs explicit height */
}
.child {
  height: 100%;  /* now works correctly */
}

/* Method 2: Use min-height + flex (recommended) */
html {
  height: 100%;
}
body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}
.child {
  flex: 1;  /* takes up remaining space */
}

/* Method 3: Use dvh unit (latest approach) */
.full-height {
  min-height: 100dvh;
  /* dvh = dynamic viewport height */
  /* Accurate even when the mobile address bar appears/disappears */
}
```

### 10.3 Anti-Pattern: z-index Inflation

```css
/* --- Problematic code --- */
.modal     { z-index: 99999; }
.tooltip   { z-index: 999999; }
.dropdown  { z-index: 9999; }
/* z-index values grow chaotically and become unmanageable */

/* --- Improvement: define a z-index scale --- */
:root {
  --z-dropdown:  100;
  --z-sticky:    200;
  --z-overlay:   300;
  --z-modal:     400;
  --z-popover:   500;
  --z-tooltip:   600;
  --z-toast:     700;
}

.dropdown { z-index: var(--z-dropdown); }
.modal    { z-index: var(--z-modal); }
.tooltip  { z-index: var(--z-tooltip); }

/*
 * Additionally, use isolation: isolate to explicitly
 * separate Stacking Contexts so that z-index within
 * each component does not leak to the outside.
 */
.component {
  isolation: isolate;
  /* z-index inside this component is independent of the outside */
}
```

---

## 11. Edge Case Analysis

### 11.1 Edge Case: Interaction Between position: fixed and transform

A `position: fixed` element is normally placed relative to the viewport. However, if any ancestor has `transform`, `filter`, or `perspective` set, that ancestor becomes the new containing block, and the fixed placement no longer works as intended.

```css
/* Case where the problem occurs */
.animated-parent {
  transform: translateX(0);
  /* This transform creates a new containing block */
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  /* Expected: covers the entire viewport */
  /* Reality: restricted to the area of .animated-parent */
}
```

```
Illustration of the problem:

  Normal fixed placement:
  ┌── viewport ────────────────────────────┐
  │ ┌── fixed overlay ──────────────────┐  │
  │ │                                   │  │
  │ │  covers the entire viewport       │  │
  │ │                                   │  │
  │ └───────────────────────────────────┘  │
  └────────────────────────────────────────┘

  When an ancestor has transform:
  ┌── viewport ────────────────────────────┐
  │                                        │
  │  ┌── transform parent ──────┐          │
  │  │ ┌── fixed overlay ────┐  │          │
  │  │ │ trapped inside      │  │          │
  │  │ │ the parent          │  │          │
  │  │ └────────────────────┘  │          │
  │  └──────────────────────────┘          │
  │                                        │
  └────────────────────────────────────────┘
```

Workarounds:

```css
/* Workaround 1: Place the modal at the top level in the DOM */
/* Use React's createPortal or Vue's Teleport */

/* Workaround 2: Use will-change instead of transform (case-dependent) */
/* Note: will-change: transform causes the same issue */

/* Workaround 3: Apply transform conditionally on the ancestor */
.parent {
  /* Apply transform only during animation */
  /* Maintain transform: none in idle state */
}

/* Workaround 4: Conditional transform using CSS @layer or :has() */
.parent:not(:has(.modal-open)) {
  transform: translateX(var(--offset));
}
```

### 11.2 Edge Case: min-height on a Flex Item and Percentage Children

If `min-height` is set on a flex item and a child of that item has `height: 100%`, it may not work as expected in some browsers.

```css
/* Case where the problem occurs */
.flex-container {
  display: flex;
  min-height: 500px;
}

.flex-item {
  /* The flex item is stretched to 500px inside the min-height: 500px
     container (due to align-items: stretch) */
}

.inner-child {
  height: 100%;
  /* Some browsers (older Chrome, etc.) may not recognize
     the "stretched height" of a flex item as the
     reference for percentage-based height */
}

/* Workaround */
.flex-item-fixed {
  display: flex;
  flex-direction: column;
  /* By making the flex item itself a flex container,
     flex: 1 can be used on children to distribute height */
}

.inner-child-fixed {
  flex: 1;
  /* Use flex: 1 instead of height: 100% */
}
```

### 11.3 Edge Case: Relationship Between Grid 1fr and min-content

```css
/* 1fr is shorthand for "minmax(auto, 1fr)" */
/* Since auto = min-content, tracks may not be equal
   when content is large */

.grid-unequal {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  /* If content amount differs between columns,
     the column with more content may become larger */
}

/* Workaround: use minmax(0, 1fr) to set minimum to 0 */
.grid-equal {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  /* With a minimum of 0, space is distributed equally
     regardless of content
     Note: content overflow may occur */
}
```

---

## 12. Exercises (3 Levels)

### 12.1 Beginner Level

**Exercise B-1: Box Model Calculation**

For the element with the following CSS applied, state the actual rendered width and height on screen.

```css
/* Problem 1 */
.box-a {
  box-sizing: content-box;
  width: 200px;
  height: 150px;
  padding: 15px;
  border: 3px solid black;
  margin: 20px;
}

/* Problem 2 */
.box-b {
  box-sizing: border-box;
  width: 200px;
  height: 150px;
  padding: 15px;
  border: 3px solid black;
  margin: 20px;
}
```

<details>
<summary>Answer</summary>

Problem 1 (content-box):
- Rendered width = 200 + 15*2 + 3*2 = 236px
- Rendered height = 150 + 15*2 + 3*2 = 186px
- Total occupied width (including margin) = 236 + 20*2 = 276px
- Total occupied height (including margin) = 186 + 20*2 = 226px

Problem 2 (border-box):
- Rendered width = 200px (exactly as specified)
- Rendered height = 150px (exactly as specified)
- Content width = 200 - 15*2 - 3*2 = 164px
- Content height = 150 - 15*2 - 3*2 = 114px
- Total occupied width (including margin) = 200 + 20*2 = 240px
- Total occupied height (including margin) = 150 + 20*2 = 190px

</details>

**Exercise B-2: Margin Collapsing**

What is the actual gap between element A and element B in the following markup?

```html
<div class="a" style="margin-bottom: 40px;">A</div>
<div class="b" style="margin-top: 25px;">B</div>
```

<details>
<summary>Answer</summary>

Due to margin collapsing, the larger value wins. Therefore the gap is **40px** (NOT 40px + 25px = 65px).

</details>

### 12.2 Intermediate Level

**Exercise I-1: Flexbox Calculation**

Calculate the final width of each item in the following layout.

```css
.container {
  display: flex;
  width: 800px;
}

.item-a { flex: 3 1 100px; }
.item-b { flex: 2 1 200px; }
.item-c { flex: 1 1 150px; }
```

<details>
<summary>Answer</summary>

Step 1: Sum of tentative sizes = 100 + 200 + 150 = 450px
Step 2: Free space = 800 - 450 = 350px (positive → apply flex-grow)
Step 3: Total grow = 3 + 2 + 1 = 6
Step 4: Distribution
- item-a: 100 + (350 * 3/6) = 100 + 175 = **275px**
- item-b: 200 + (350 * 2/6) = 200 + 116.67 ≈ **316.67px**
- item-c: 150 + (350 * 1/6) = 150 + 58.33 ≈ **208.33px**

Verification: 275 + 316.67 + 208.33 = 800px

</details>

**Exercise I-2: Grid Track Sizing**

Calculate the width of each column in the following Grid container.

```css
.container {
  display: grid;
  width: 1200px;
  grid-template-columns: 300px 2fr 1fr;
  gap: 24px;
}
```

<details>
<summary>Answer</summary>

Step 1: Total gaps = 24px * 2 = 48px
Step 2: Space available for fr = 1200 - 300 - 48 = 852px
Step 3: Total fr = 2 + 1 = 3
Step 4: 1fr = 852 / 3 = 284px
Step 5: Width per column
- Column 1: **300px** (fixed)
- Column 2: 2fr = **568px**
- Column 3: 1fr = **284px**

Verification: 300 + 568 + 284 + 48(gap) = 1200px

</details>

### 12.3 Advanced Level

**Exercise A-1: Weighted flex-shrink Calculation**

Calculate the final width of each item when the container width is 300px. Ignore min-width constraints.

```css
.container {
  display: flex;
  width: 300px;
}

.item-a { flex: 0 3 200px; }  /* shrink: 3, basis: 200px */
.item-b { flex: 0 2 150px; }  /* shrink: 2, basis: 150px */
.item-c { flex: 0 1 100px; }  /* shrink: 1, basis: 100px */
```

<details>
<summary>Answer</summary>

Step 1: Sum of tentative sizes = 200 + 150 + 100 = 450px
Step 2: Deficit = 300 - 450 = -150px (negative → apply flex-shrink)
Step 3: Calculate weighted shrink factor
- item-a: shrink * basis = 3 * 200 = 600
- item-b: shrink * basis = 2 * 150 = 300
- item-c: shrink * basis = 1 * 100 = 100
- Total weight = 600 + 300 + 100 = 1000

Step 4: Shrinkage per item
- item-a: 200 - (150 * 600/1000) = 200 - 90 = **110px**
- item-b: 150 - (150 * 300/1000) = 150 - 45 = **105px**
- item-c: 100 - (150 * 100/1000) = 100 - 15 = **85px**

Verification: 110 + 105 + 85 = 300px

Key point: With flex-shrink, an item with a larger basis shrinks more (weighted approach). This differs from flex-grow (simple ratio distribution).

</details>

**Exercise A-2: Comprehensive Problem — Stacking Context and Layout**

Identify the reason why `.modal` does not cover the entire viewport in the code below, and propose two fixes.

```html
<div class="app" style="transform: scale(1);">
  <div class="content">
    <div class="modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5);">
      Modal
    </div>
  </div>
</div>
```

<details>
<summary>Answer</summary>

Cause: `.app` has `transform: scale(1)` set, so `.app` becomes the new containing block for `.modal` (position: fixed). As a result, the fixed placement is relative to `.app` rather than the viewport.

Fix 1: Move the modal outside of `.app` (change the DOM structure).
```html
<div class="app" style="transform: scale(1);">
  <div class="content">...</div>
</div>
<div class="modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5);">
  Modal
</div>
```

Fix 2: Use React Portal or Vue Teleport to render the modal directly under `<body>`.
```javascript
// React example
createPortal(<Modal />, document.body);
```

</details>

---

## 13. FAQ

### Q1: How do I align the heights of children in Flexbox?

**A:** Flexbox's default `align-items: stretch` automatically stretches flex items in the same row to the height of the tallest item. No special configuration is needed.

```css
.card-row {
  display: flex;
  gap: 16px;
}

.card {
  flex: 1;
  /* align-items: stretch is the default, so
     card heights align automatically */

  /* To pin a button to the bottom: */
  display: flex;
  flex-direction: column;
}

.card-body { flex: 1; }
.card-button { margin-top: auto; }
```

However, when using `flex-wrap: wrap`, items in different rows do not align to each other's height. If you need uniform height across rows, consider using CSS Grid.

```css
/* Grid aligns column widths across rows */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
```

### Q2: When should I use auto-fill vs auto-fit in Grid?

**A:** Choose based on the following criteria.

- **auto-fill**: When you want to maintain the number of columns even if there are few items. Suitable for designs where empty cells are visible (grids with background colors or borders).
- **auto-fit**: When you want existing items to stretch and fill all available space when there are few items. Suitable for most cases like card lists and galleries.

In most cases, `auto-fit` behaves intuitively and is recommended.

### Q3: Why is the percentage for padding-top based on width?

**A:** In the CSS specification, percentage values for padding and margin are always calculated relative to the "width" of the containing block — even for vertical directions.

The reason for this design is that using height as the reference would create circular references. For example, if an element's height depends on its content amount (auto), and its padding-top is 10% of that height, you get height → padding → height → ... ad infinitum. Width is determined conclusively from the containing block for block elements, so no circular reference occurs.

```css
/* Using this spec to maintain aspect ratios */
.aspect-16-9 {
  width: 100%;
  padding-top: 56.25%; /* 9 / 16 * 100 = 56.25% */
  height: 0;
  position: relative;
}

.aspect-16-9 > * {
  position: absolute;
  inset: 0;
}

/* The aspect-ratio property is now preferred */
.modern-aspect {
  aspect-ratio: 16 / 9;
}
```

### Q4: What are the common causes when position: sticky doesn't work?

**A:** The main causes of `position: sticky` not working are:

1. **An ancestor has overflow: hidden / auto / scroll set**: A sticky element operates within the nearest scrollable ancestor. When overflow is set, that element becomes the scroll container and the sticky behavior is restricted to within it.

2. **The sticky element's parent has no height**: A sticky element is only "fixed" within the range of its parent element. If the parent's height is the same as the sticky element, it appears not to move on scroll.

3. **No top / bottom / left / right threshold specified**: sticky always requires specifying a threshold in the scroll direction.

```css
/* Correct sticky header implementation */
.sticky-header {
  position: sticky;
  top: 0;        /* required: specify the threshold */
  z-index: 10;   /* recommended: display above other elements */
  background: white; /* recommended: set a background color */
}

/* Check ancestors for overflow */
/* The following ancestor causes sticky to not work */
.problematic-ancestor {
  overflow: hidden; /* this is often the cause */
}
```

### Q5: What is CSS Grid subgrid?

**A:** `subgrid` is a feature that allows a Grid item to inherit track definitions from the parent grid. It enables nested grid content to be aligned precisely to the parent grid lines.

```css
.parent-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 16px;
}

.child-spanning {
  grid-column: 1 / -1;  /* spans all columns */
  display: grid;
  grid-template-columns: subgrid;
  /* Inherits the parent's 3-column track definition directly */
  /* Child columns are aligned precisely with parent columns */
}
```

Without subgrid, nested grids could not reference the parent's track definitions, requiring workarounds like matching pixel values or sharing custom properties. Subgrid enables expressions like aligning card headers or body text positions precisely across rows.

### Q6: What is the criterion for choosing between Flexbox and Grid?

**A:** The choice between Flexbox and Grid depends on the dimensionality of the layout and the flexibility requirements.

**When to choose Flexbox:**
- **1D layout**: Placing items along a single row or column (navigation bars, toolbars, card interior layouts)
- **Content-driven sizing**: When item size should auto-adjust based on content amount
- **Dynamic arrangement**: When the number of items changes dynamically and you want automatic wrapping (tag lists, button groups)

**When to choose Grid:**
- **2D layout**: When you need to control both rows and columns simultaneously (full-page layout, complex card grids)
- **Precise placement**: When items need to be placed on specific grid lines
- **Cross-row alignment**: When elements in different rows need to align precisely in the column direction

**When to combine both:**
In most practical layouts, the most effective approach is to define the overall structure with Grid and use Flexbox inside each grid cell.

```css
/* Grid defines the overall page structure */
.page-layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 250px 1fr;
  gap: 20px;
}

/* Flexbox arranges navigation inside the header */
.header-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
```

### Q7: How do I detect and address Layout Thrashing?

**A:** Layout Thrashing is the phenomenon where JavaScript reads from and writes to the DOM alternately, forcing the browser to redo layout calculations multiple times.

**Detection methods:**

1. **Chrome DevTools Performance tab**: Frequent purple "Recalculate Style" and "Layout" blocks appear
2. **Warning message**: "Forced reflow is a likely performance bottleneck" appears in the Console
3. **Performance measurement**: The same operation is abnormally slow compared to other browsers or devices

**Typical anti-pattern:**

```javascript
// Layout Thrashing trigger
for (let i = 0; i < elements.length; i++) {
  const height = elements[i].offsetHeight; // read → Layout occurs
  elements[i].style.marginTop = height + 10 + 'px'; // write → recalculation on next read
}
```

**Countermeasures:**

1. **Separate reads and writes:**

```javascript
// Batch all reads
const heights = elements.map(el => el.offsetHeight);

// Batch all writes
elements.forEach((el, i) => {
  el.style.marginTop = heights[i] + 10 + 'px';
});
```

2. **Use requestAnimationFrame:**

```javascript
// Separate reads and writes by frame
requestAnimationFrame(() => {
  const height = element.offsetHeight;
  requestAnimationFrame(() => {
    element.style.marginTop = height + 10 + 'px';
  });
});
```

3. **Use libraries like FastDOM:**

```javascript
// FastDOM automates batching
fastdom.measure(() => {
  const height = element.offsetHeight;
  fastdom.mutate(() => {
    element.style.marginTop = height + 10 + 'px';
  });
});
```

4. **Prefer CSS solutions when possible:**

```css
/* Solve with CSS without JavaScript */
.element {
  margin-top: calc(var(--element-height) + 10px);
}
```

### Q8: What are the effects and usage of CSS Containment (the contain property)?

**A:** CSS Containment is a feature that limits the influence an element has on the rest of the document, allowing the browser to optimize layout calculations and paint operations.

**Values for the contain property:**

```css
/* Limit the scope of layout impact */
.container {
  contain: layout;
  /* Layout changes inside this element do not affect the outside */
  /* The browser can skip recalculation of the outside */
}

/* Limit the scope of paint impact */
.container {
  contain: paint;
  /* Child elements are not painted outside the parent's box */
  /* Similar to overflow: hidden, but more efficient */
}

/* Make size calculation independent */
.container {
  contain: size;
  /* Child element sizes do not affect the parent's size */
  /* Explicit width/height is required */
}

/* Limit style calculation (counters, etc.) */
.container {
  contain: style;
  /* CSS counters do not affect the outside */
}

/* Apply all containment */
.container {
  contain: strict; /* equivalent to size layout paint style */
}

/* Apply all except size (most practical) */
.container {
  contain: content; /* equivalent to layout paint style */
}
```

**Practical usage examples:**

```css
/* 1. Large card lists (virtual scrolling) */
.card-item {
  contain: content;
  /* Changes in each card do not affect other cards */
  /* Scroll performance improves significantly */
}

/* 2. Independent widgets */
.widget {
  contain: layout style paint;
  /* Changes inside the widget do not affect the outside */
}

/* 3. Optimizing off-screen rendering */
.offscreen-content {
  content-visibility: auto;
  contain-intrinsic-size: 500px; /* estimated size */
  /* Off-screen content is not rendered */
}
```

**Effects:**

- **Reduced layout calculation**: The scope of changes is limited, so the browser can skip unnecessary recalculations
- **Optimized paint processing**: Rendering regions become clear, making layer splitting more efficient
- **Reduced memory usage**: Off-screen content can be skipped (when combined with content-visibility)

**Notes:**

- When using `contain: size`, explicit dimension specification is required
- Overuse can be counterproductive. Measure performance to confirm the effect
- Combining with `content-visibility: auto` achieves even greater results

---

## 14. Glossary

| Term | Description |
|------|-------------|
| Box Model | A model that treats every HTML element as a box composed of four regions: content, padding, border, and margin |
| BFC | Block Formatting Context. An independent layout context for block elements |
| IFC | Inline Formatting Context. The layout context for inline elements |
| Flex Container | An element with `display: flex` set. Its children become Flex Items |
| Flex Item | A direct child element of a Flex Container |
| Main Axis | The primary axis of Flexbox. Its direction is determined by flex-direction |
| Cross Axis | The cross axis of Flexbox. The direction perpendicular to the main axis |
| Grid Track | One row or column of a Grid |
| Grid Line | The boundary line between Grid tracks. Can be referenced by number |
| Grid Area | A rectangular region within a Grid. Can be referenced by name |
| fr unit | A unit that distributes available space in a Grid by fractional ratio |
| Stacking Context | An independent evaluation context for z-index-based layering |
| Containing Block | The rectangular region that serves as the reference for percentage values and absolute positioning |
| Layout Thrashing | Performance degradation caused by alternating DOM reads and writes |
| Reflow | Redo of layout calculation. Triggered by DOM changes |
| subgrid | A feature that allows a Grid item to inherit track definitions from the parent grid |
| Normal Flow | CSS's default layout mode. Block elements stack vertically, inline elements flow horizontally |
| content-visibility | A property that defers rendering of off-screen elements |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just from theory but from actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in everyday development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Concept | Core Point | Notes |
|---------|-----------|-------|
| Box Model | Apply border-box to all elements | Margins collapse. % for padding/margin is relative to width |
| Normal Flow | Block elements stack vertically, inline elements flow horizontally | Understand the conditions for margin collapsing precisely |
| BFC | display: flow-root is the most explicit way to generate one | Effective for containing floats and blocking margin collapsing |
| Flexbox | 1D layout; flex: 1 for equal distribution | Forgetting min-width: 0 causes overflow |
| Grid | 2D layout; flexible distribution with fr units | 1fr is shorthand for minmax(auto, 1fr) |
| Positioning | fixed is affected by transform on ancestors | sticky may not work in ancestors with overflow |
| Performance | Limit scope with contain; thoroughly separate reads and writes | Layout Thrashing is a serious performance issue |

---

## Next Guides to Read

- [Paint and Compositing](./02-paint-and-compositing.md) -- Understand the Paint and Compositing pipeline and learn the latter stages of rendering
- CSS Animations and Transitions -- Learn performance optimization for animations and transitions

---

## 15. References

1. W3C. "CSS Box Model Module Level 3." W3C Working Draft. https://www.w3.org/TR/css-box-3/
2. W3C. "CSS Flexible Box Layout Module Level 1." W3C Candidate Recommendation. https://www.w3.org/TR/css-flexbox-1/
3. W3C. "CSS Grid Layout Module Level 2." W3C Candidate Recommendation. https://www.w3.org/TR/css-grid-2/
4. W3C. "CSS Containment Module Level 2." W3C Working Draft. https://www.w3.org/TR/css-contain-2/
5. W3C. "CSS Positioned Layout Module Level 3." W3C Working Draft. https://www.w3.org/TR/css-position-3/
6. MDN Web Docs. "CSS Layout." Mozilla Developer Network. https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout
7. Chromium Blog. "The Chromium Chronicle: Layout Performance." Google Chromium Team. https://developer.chrome.com/blog/
8. web.dev. "Avoid Large, Complex Layouts and Layout Thrashing." Google Chrome Developers. https://web.dev/avoid-large-complex-layouts-and-layout-thrashing/
9. Jen Simmons. "Designing Intrinsic Layouts." 2018. https://www.youtube.com/watch?v=AMPKmh98XLY
10. Rachel Andrew. "The New CSS Layout." A Book Apart, 2017.
11. Paul Irish. "What Forces Layout / Reflow." GitHub Gist. https://gist.github.com/paulirish/5d52fb081b3570c81e3a
12. web.dev. "content-visibility: the new CSS property that boosts your rendering performance." Google Chrome Developers. https://web.dev/content-visibility/
8. Google Developers. "Rendering Performance." Web Fundamentals. https://web.dev/rendering-performance/

### Additional FAQ

### Q4: Is it OK to use Flexbox and Grid together inside the same component?
Yes, combining Flexbox and Grid is a common pattern. For example, it is typical to use Grid for the overall page layout (header, sidebar, main, footer) and Flexbox for navigation bars or the interior of cards. Since Grid excels at 2D placement and Flexbox at 1D placement, using each where it shines is recommended. Nesting them causes almost no performance issues.

### Q5: What are the common causes when position: sticky doesn't work?
The most common cause is when an ancestor of the sticky element has `overflow: hidden`, `overflow: auto`, or `overflow: scroll` set. Since sticky operates relative to its scroll container, it does not function correctly if an unintended ancestor becomes the scroll container. It also won't work if no threshold (`top`, `bottom`, `left`, or `right`) is specified on the sticky element. Use the DevTools Computed panel to confirm `position` is `sticky`, and check the `overflow` values of ancestor elements.

### Q6: When is CSS Grid subgrid useful?
Subgrid is a feature that allows a child grid to inherit the track definitions (row/column widths and heights) from the parent grid. It is especially useful when you want to align the header, body, and footer heights of each card in a card list across all cards. Without subgrid, you had to specify fixed heights or synchronize heights with JavaScript, but subgrid makes it achievable with pure CSS. As of 2024, it is supported in all major browsers (Chrome, Firefox, Safari).

### Additional References

13. Ahmad Shadeed. "Debugging CSS Grid and Flexbox Layouts." 2023. https://ishadeed.com/article/css-grid-debugging/
14. web.dev. "CSS subgrid." Google Chrome Developers. https://web.dev/articles/css-subgrid
15. W3C. "CSS Display Module Level 3." W3C Candidate Recommendation. https://www.w3.org/TR/css-display-3/

---

## References

- [MDN Web Docs](https://developer.mozilla.org/) - Web technology reference
- [Wikipedia](https://en.wikipedia.org/) - Overview of technical concepts
