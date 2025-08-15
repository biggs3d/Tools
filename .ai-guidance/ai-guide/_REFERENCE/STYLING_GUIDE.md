# Styling Guide

This guide covers CSS patterns, theming, and component styling. Follow these patterns for consistent, maintainable styles.

## Quick Reference Example

Follow this pattern for all component styling:

```typescript
// =====================================================
// File: components/dataCard/DataCardView.tsx
// =====================================================
import { observer } from 'mobx-react';
import './dataCard.css';  // Co-located CSS file

export const DataCardView = observer(({ viewModel }) => {
    return (
        <div className="data-card">
            <div className="data-card__header">
                <h3 className="data-card__title">{viewModel.title}</h3>
                <span className="data-card__status">{viewModel.status}</span>
            </div>
            <div className="data-card__content">
                {/* Content */}
            </div>
        </div>
    );
});

// =====================================================
// File: components/dataCard/dataCard.css
// =====================================================
/* Scoped to component */
.data-card {
    background-color: var(--neutral3);  /* Component background */
    border: 1px solid var(--neutral5);  /* Subtle border */
    border-radius: var(--border-radius-medium);
    padding: var(--spacing-m);
}

.data-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-s);
    gap: var(--spacing-s);  /* Use gap instead of margins */
}

.data-card__title {
    color: var(--neutral12);  /* Primary text */
    font-size: var(--font-size-large);
    font-weight: 600;
}

.data-card__status {
    color: var(--neutral11);  /* Secondary text */
    font-size: var(--font-size-small);
}

/* Hover state */
.data-card:hover {
    background-color: var(--neutral4);
    border-color: var(--neutral6);
}

/* Active/selected state */
.data-card.selected {
    background-color: var(--accent3);
    border-color: var(--accent7);
}

.data-card.selected .data-card__title {
    color: var(--accent12);
}
```

## Color System

### Radix Color Scale (1-12)

```css
/* Backgrounds */
var(--neutral1)   /* App background */
var(--neutral2)   /* Subtle background */
var(--neutral3)   /* Component background */

/* Borders & UI Elements */
var(--neutral4)   /* UI element background */
var(--neutral5)   /* Subtle borders */
var(--neutral6)   /* Hover states */
var(--neutral7)   /* Active element borders */
var(--neutral8)   /* Strong borders */

/* Solid Colors */
var(--accent9)    /* Solid backgrounds, primary buttons */
var(--accent10)   /* Hovered solid backgrounds */

/* Text */
var(--neutral11)  /* Secondary text, icons */
var(--neutral12)  /* Primary text */
var(--accent11)   /* Interactive text */
var(--accent12)   /* Interactive text on solid backgrounds */

/* Semantic Colors */
var(--app-red11)  /* Errors, warnings */
var(--app-green11) /* Success states */
var(--app-orange11) /* Warnings, highlights */
```

### Usage Patterns

```css
/* Standard component */
.component {
    /* Backgrounds */
    background-color: var(--neutral3);
    
    /* Borders */
    border: 1px solid var(--neutral5);
    
    /* Text */
    color: var(--neutral12);
}

/* Interactive element */
.button {
    background-color: var(--accent9);
    color: white;
}

.button:hover {
    background-color: var(--accent10);
}

/* Status indicators */
.error { color: var(--app-red11); }
.success { color: var(--app-green11); }
.warning { color: var(--app-orange11); }
```

## CSS Organization Rules

### 1. File Structure
```
/components/
    /myComponent/
        MyComponentView.tsx
        myComponent.css      ← Same name, camelCase
        MyComponentViewModel.ts
```

### 2. Scoping Pattern
```css
/* Always scope to component root class */
.my-component { }
.my-component__element { }
.my-component--modifier { }

/* AVOID generic selectors */
/* ❌ .button { } */
/* ✅ .my-component__button { } */
```

### 3. Property Order
```css
.element {
    /* 1. Layout */
    display: flex;
    position: relative;
    
    /* 2. Box Model */
    width: 100%;
    padding: var(--spacing-m);
    margin: 0;
    
    /* 3. Visual */
    background-color: var(--neutral3);
    border: 1px solid var(--neutral5);
    border-radius: var(--border-radius-medium);
    
    /* 4. Typography */
    color: var(--neutral12);
    font-size: var(--font-size-medium);
    
    /* 5. Animation */
    transition: background-color 0.2s;
}
```

## Layout Patterns

### Flexbox (Preferred)
```css
.container {
    display: flex;
    gap: var(--spacing-m);  /* Use gap instead of margins */
    justify-content: space-between;
    align-items: center;
}

.container--column {
    flex-direction: column;
}
```

### Grid (Complex Layouts)
```css
.data-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--spacing-m);
}
```

## Common Variables

```css
/* Spacing */
--spacing-xs: 0.25rem;
--spacing-s: 0.5rem;
--spacing-m: 1rem;
--spacing-l: 1.5rem;
--spacing-xl: 2rem;

/* Border Radius */
--border-radius-small: 0.25rem;
--border-radius-medium: 0.5rem;
--border-radius-large: 1rem;

/* Font Sizes */
--font-size-small: 0.875rem;
--font-size-medium: 1rem;
--font-size-large: 1.25rem;
--font-size-xl: 1.5rem;

/* Transitions */
--transition-fast: 0.15s ease-in-out;
--transition-medium: 0.3s ease-in-out;
```

## Component States

```css
/* Base state */
.card {
    background-color: var(--neutral3);
    border: 1px solid var(--neutral5);
    transition: all var(--transition-fast);
}

/* Hover */
.card:hover {
    background-color: var(--neutral4);
    border-color: var(--neutral6);
}

/* Active/Selected */
.card.selected {
    background-color: var(--accent3);
    border-color: var(--accent7);
}

/* Disabled */
.card.disabled {
    opacity: 0.5;
    pointer-events: none;
}

/* Loading */
.card.loading {
    position: relative;
    overflow: hidden;
}

.card.loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent,
        var(--neutral6),
        transparent
    );
    animation: shimmer 2s infinite;
}
```

## Responsive Design

```css
/* Mobile-first approach */
.container {
    padding: var(--spacing-s);
}

/* Tablet and up */
@media (min-width: 768px) {
    .container {
        padding: var(--spacing-m);
    }
}

/* Desktop */
@media (min-width: 1024px) {
    .container {
        padding: var(--spacing-l);
        max-width: 1200px;
        margin: 0 auto;
    }
}
```

## Key Rules

1. **Always use color variables** - Never hardcode hex values
2. **Scope styles to components** - Use component class prefix
3. **Co-locate CSS with components** - Same folder, matching name
4. **Use semantic color names** - `var(--neutral12)` not `var(--gray12)`
5. **Prefer gap over margins** - For flex/grid spacing
6. **Use rem for scalability** - Except for 1px borders (use 0.1rem)
7. **Follow existing patterns** - Look at similar components first

## Finding Examples

When styling new components:
1. Look for similar existing components in the codebase
2. Check `client/libs/alpha/alpha.components/src/lib/` for local component examples
3. Use `grep -r "className" --include="*.tsx"` to find styled components
4. Ask for specific examples if unsure about patterns

Remember: **Copy existing component styles and modify** rather than starting from scratch. The codebase has established patterns - follow them for consistency.