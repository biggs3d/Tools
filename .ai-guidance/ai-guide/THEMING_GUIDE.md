# Theming Guide

This document provides a comprehensive guide to the Phoenix framework's theming system, explaining how to use, customize, and extend the theme for building consistent components.

## Table of Contents

1. [Core Concepts & Architecture](#core-concepts--architecture)
2. [Color System](#color-system)
3. [Component Styling](#component-styling)
4. [Theming Patterns](#theming-patterns)
5. [Extending the Theme](#extending-the-theme)
6. [Best Practices](#best-practices)

## Core Concepts & Architecture

The Phoenix theming system is built on **CSS Custom Properties** (variables) and follows the **Radix UI Colors** philosophy, providing predictable and semantic color usage.

### Key Characteristics

- **CSS Custom Properties**: The entire system uses variables like `var(--accentBg)` for dynamic theming
- **Light & Dark Mode Support**: Seamless switching by applying `.light` or `.dark` class to `<body>`
- **Layered Abstraction**: Multiple layers separate semantic meaning from actual color values
- **TypeScript Integration**: Color palettes defined in TypeScript as single source of truth

### File Structure

```
/assets/stylesheets/
├── index.css           # Main entry point
├── theme.css          # Semantic color aliases (theme-agnostic)
├── theme.ts           # TypeScript source of truth for colors
├── colors/
│   ├── dark.css       # Dark theme color values
│   └── light.css      # Light theme color values (placeholder)
└── disabledUtils.css  # Disabled state utilities
```

### Abstraction Flow

The theming system works through multiple layers:

```css
/* 1. Component (what you write) */
.my-component {
    background-color: var(--accentBg);
    color: var(--accentText);
}

/* 2. theme.css (semantic alias -> palette mapping) */
body {
    --accentBg: var(--app-cyan3);
    --accentText: var(--app-cyan11);
}

/* 3. dark.css (palette variable -> hex value) */
body.dark {
    --app-cyan3: #00333c;
    --app-cyan11: #99f7ff;
}
```

```typescript
// 4. theme.ts (source of truth)
import { cyanDark } from "@tektonux/sdk-client";
export const accentDark = {
    accent3: cyanDark.cyan3,   // '#00333c'
    accent11: cyanDark.cyan11, // '#99f7ff'
}
```

## Color System

### Semantic Color Groups

Always use semantic variables in components to ensure proper theme adaptation:

| Group | Base Color | Description |
|-------|------------|-------------|
| `accent` | Cyan | Primary accent color for interactive elements and branding |
| `neutral` | Gray | Pure, balanced gray for UI elements and text |
| `natural` | Slate | Cooler, blue-tinted gray for backgrounds |
| `primary` | White | Alpha-blended white for overlays |
| `secondary` | Black | Alpha-blended black for overlays and shadows |
| `warning` | Red | Destructive actions, errors, and critical alerts |
| `caution` | Yellow | Warnings requiring attention |
| `advisory` | Blue | Tips, suggestions, and non-critical status |
| `success` | Green | Successful operations and positive feedback |
| `info` | Cyan | General informational messages (aliases `accent`) |

### 12-Step Scale System

Each color group follows Radix UI's 12-step scale for consistent usage:

| Step | Semantic Suffix | Primitive Suffix | Use Case |
|------|----------------|------------------|----------|
| 1 | `Base` | `1` | App background |
| 2 | `BgSubtle` | `2` | Subtle background for grouped content |
| 3 | `Bg` | `3` | UI element background |
| 4 | `BgHover` | `4` | Hovered UI element background |
| 5 | `BgActive` | `5` | Active/selected UI element background |
| 6 | `Line` | `6` | Subtle borders and separators |
| 7 | `Border` | `7` | UI element border and focus rings |
| 8 | `BorderHover` | `8` | Hovered UI element border |
| 9 | `Solid` | `9` | Solid backgrounds (buttons) |
| 10 | `SolidHover` | `10` | Hovered solid backgrounds |
| 11 | `Text` | `11` | Low-contrast text |
| 12 | `TextContrast` | `12` | High-contrast text |

### Color Usage Examples

```css
/* Semantic naming (preferred) */
.accent-button {
    background-color: var(--accentSolid);      /* Step 9 */
    color: var(--accentTextContrast);          /* Step 12 */
    border: 1px solid var(--accentBorder);     /* Step 7 */
}

.accent-button:hover {
    background-color: var(--accentSolidHover); /* Step 10 */
}

/* Primitive naming (use sparingly) */
.custom-component {
    background-color: var(--accent3);
    color: var(--accent11);
}
```

## Component Styling

### Basic Component Pattern

```css
.my-component {
    /* Use semantic variables */
    background-color: var(--neutralBg);
    color: var(--neutralText);
    border: 1px solid var(--neutralBorder);
    
    /* Standard properties */
    padding: 8px 16px;
    border-radius: 4px;
    font-family: var(--primary-font-family);
}

.my-component:hover {
    background-color: var(--neutralBgHover);
    border-color: var(--neutralBorderHover);
}

.my-component:focus {
    outline: 2px solid var(--accentBorder);
    outline-offset: 2px;
}

.my-component:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Interactive States

```css
/* Button states using accent colors */
.interactive-button {
    background-color: var(--accentSolid);
    color: var(--accentTextContrast);
    border: 1px solid var(--accentBorder);
    transition: all 0.2s ease;
}

.interactive-button:hover:not(:disabled) {
    background-color: var(--accentSolidHover);
    border-color: var(--accentBorderHover);
}

.interactive-button:active {
    background-color: var(--accentBgActive);
}

.interactive-button:focus-visible {
    outline: 2px solid var(--accentBorder);
    outline-offset: 2px;
}
```

### Form Elements

```css
.form-input {
    background-color: var(--neutralBase);
    color: var(--neutralText);
    border: 1px solid var(--neutralBorder);
    padding: 8px 12px;
    border-radius: 4px;
    font-family: var(--primary-font-family);
}

.form-input:hover {
    border-color: var(--neutralBorderHover);
}

.form-input:focus {
    border-color: var(--accentBorder);
    outline: 2px solid var(--accentBorder);
    outline-offset: -1px;
}

.form-input[data-error="true"] {
    border-color: var(--warningBorder);
}

.form-input:disabled {
    background-color: var(--neutralBgSubtle);
    color: var(--neutralText);
    opacity: 0.6;
}
```

## Theming Patterns

### Theme Switching

```typescript
// Theme switching utility
export const ThemeManager = {
    setTheme(theme: 'light' | 'dark') {
        document.body.className = theme;
    },
    
    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },
    
    getTheme(): 'light' | 'dark' {
        return document.body.classList.contains('dark') ? 'dark' : 'light';
    }
};

// Usage in React component
const ThemeToggle = () => {
    const [theme, setTheme] = useState(ThemeManager.getTheme());
    
    const toggleTheme = () => {
        ThemeManager.toggleTheme();
        setTheme(ThemeManager.getTheme());
    };
    
    return (
        <button onClick={toggleTheme}>
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
        </button>
    );
};
```

### Component Variants

```css
/* Status-based variants */
.status-indicator {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.status-indicator[data-status="success"] {
    background-color: var(--successBg);
    color: var(--successText);
    border: 1px solid var(--successBorder);
}

.status-indicator[data-status="warning"] {
    background-color: var(--warningBg);
    color: var(--warningText);
    border: 1px solid var(--warningBorder);
}

.status-indicator[data-status="error"] {
    background-color: var(--warningBg);
    color: var(--warningTextContrast);
}

.status-indicator[data-status="info"] {
    background-color: var(--infoBg);
    color: var(--infoText);
    border: 1px solid var(--infoBorder);
}
```

### Typography System

```css
/* Typography utilities using theme variables */
.text-primary {
    font-family: var(--primary-font-family); /* Montserrat */
    color: var(--neutralText);
}

.text-mono {
    font-family: var(--mono-font-family); /* B612 Mono */
    color: var(--neutralText);
}

.text-contrast {
    color: var(--neutralTextContrast);
}

.text-subtle {
    color: var(--neutralText);
    opacity: 0.7;
}

/* Heading styles */
.heading-1 {
    font-family: var(--primary-font-family);
    color: var(--neutralTextContrast);
    font-size: 2rem;
    font-weight: 600;
}

.heading-2 {
    font-family: var(--primary-font-family);
    color: var(--neutralTextContrast);
    font-size: 1.5rem;
    font-weight: 600;
}
```

## Extending the Theme

### Adding New Color Groups

1. **Define in `theme.ts`**:
```typescript
// Add new color group
import { purpleDark } from "@tektonux/sdk-client";

export const brandDark = {
    brand1: purpleDark.purple1,
    brand2: purpleDark.purple2,
    // ... all 12 steps
    brand12: purpleDark.purple12,
};
```

2. **Add semantic aliases in `theme.css`**:
```css
body {
    /* Brand color semantic aliases */
    --brandBase: var(--app-purple1);
    --brandBgSubtle: var(--app-purple2);
    --brandBg: var(--app-purple3);
    --brandBgHover: var(--app-purple4);
    --brandBgActive: var(--app-purple5);
    --brandLine: var(--app-purple6);
    --brandBorder: var(--app-purple7);
    --brandBorderHover: var(--app-purple8);
    --brandSolid: var(--app-purple9);
    --brandSolidHover: var(--app-purple10);
    --brandText: var(--app-purple11);
    --brandTextContrast: var(--app-purple12);
}
```

3. **Update build process** to generate `--app-purple*` variables in CSS files.

### Adding Light Theme Support

```typescript
// In theme.ts
import { cyan, gray, slate } from "@tektonux/sdk-client";

export const accentLight = {
    accent1: cyan.cyan1,
    accent2: cyan.cyan2,
    // ... all 12 steps
};

export const neutralLight = {
    neutral1: gray.gray1,
    neutral2: gray.gray2,
    // ... all 12 steps
};
```

### Custom CSS Properties

```css
/* Add custom properties to theme.css */
body {
    /* Spacing scale */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;
    
    /* Border radius scale */
    --radius-1: 2px;
    --radius-2: 4px;
    --radius-3: 8px;
    --radius-4: 12px;
    
    /* Shadow system */
    --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.1);
    --shadow-2: 0 4px 8px rgba(0, 0, 0, 0.12);
    --shadow-3: 0 8px 16px rgba(0, 0, 0, 0.15);
}
```

## Best Practices

### ✅ Do

1. **Use semantic variables** instead of primitive ones:
   ```css
   /* ✅ Good */
   background-color: var(--accentSolid);
   
   /* ❌ Avoid */
   background-color: var(--accent9);
   ```

2. **Respect the scale purpose**:
   ```css
   /* ✅ Good - using appropriate steps */
   .button {
       background-color: var(--accentSolid);    /* Step 9 for solid backgrounds */
       color: var(--accentTextContrast);        /* Step 12 for text on solid */
   }
   ```

3. **Handle interactive states**:
   ```css
   /* ✅ Good - proper state handling */
   .interactive:hover {
       background-color: var(--accentSolidHover);
   }
   ```

4. **Use transitions for smooth interactions**:
   ```css
   /* ✅ Good */
   .component {
       transition: background-color 0.2s ease, border-color 0.2s ease;
   }
   ```

### ❌ Don't

1. **Don't use hard-coded colors**:
   ```css
   /* ❌ Bad */
   background-color: #3b82f6;
   
   /* ✅ Good */
   background-color: var(--accentSolid);
   ```

2. **Don't mix semantic levels incorrectly**:
   ```css
   /* ❌ Bad - using text color for background */
   background-color: var(--neutralText);
   
   /* ✅ Good */
   background-color: var(--neutralBg);
   ```

3. **Don't forget accessibility**:
   ```css
   /* ❌ Bad - poor contrast */
   .low-contrast {
       background-color: var(--neutralBg);
       color: var(--neutralBgHover);
   }
   
   /* ✅ Good */
   .high-contrast {
       background-color: var(--neutralBg);
       color: var(--neutralText);
   }
   ```

### Component Development Checklist

When creating new components:

- [ ] Use semantic color variables (`--accentSolid`, not `--accent9`)
- [ ] Implement hover, focus, and disabled states
- [ ] Test in both light and dark themes (when available)
- [ ] Ensure proper contrast ratios for accessibility
- [ ] Use appropriate color steps for their intended purpose
- [ ] Add smooth transitions for interactive elements
- [ ] Follow the component's design token system
- [ ] Document any custom theming requirements

The Phoenix theming system provides a robust foundation for building consistent, accessible, and maintainable user interfaces. By following these guidelines, you'll create components that integrate seamlessly with the overall design system.