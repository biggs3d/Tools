# CSS Styling Guide

This document outlines the best practices and conventions for writing CSS within this project. Adhering to these guidelines will help maintain a consistent, scalable, and maintainable codebase.

It is assumed that global styles, including base styling resets and CSS Custom Property definitions (variables) for colors (like `--neutral*` and `--accent*` series from a Radix-like system) and potentially common spacing/typography, are already established. If you need examples or clarification on available global variables, please ask.

## 1. File Organization and Naming

* **Component-Specific Styles**:
    * Every component MUST have a companion CSS file with matching name (camelCase). For example, if you have a component `topToolbar.tsx`, its corresponding CSS file should be `topToolbar.css`.
    * Co-locate CSS files with their respective components in the same directory. This makes it easier to find and manage styles related to a specific part of the UI.
    * Import the CSS file directly in the component file using `import './componentName.css';`
  ```
  /lib/
      /toolbar/
          topToolbar.tsx
          topToolbar.css      <-- Styles for topToolbar
      /rails/
          rail.tsx
          rail.css            <-- Styles for rail
          railGroup.tsx
          railGroup.css       <-- Styles for railGroup
  ```

## 2. Selectors and Specificity

* **Scope to Component**: Always scope your styles by prefixing selectors with the main class of the component you are styling. This avoids unintended side effects on other components.
    * Example: If `TeamSettingsModalView.tsx` has a root element with `className="team-settings-modal-view"`, all selectors in `teamSettingsModal.css` should generally start with `.team-settings-modal-view ...`.
  ```css
  /* Good: Scoped to the component */
  .team-settings-modal-view .title-team-name {
      cursor: pointer;
  }

  /* Avoid: Too generic, could affect other buttons */
  /* .button { color: red; } */
  ```
* **Prefer Class Selectors**: Use class selectors for styling. Avoid using ID selectors (`#my-id`) for styling as they have high specificity and are not reusable. Type selectors (e.g., `input`, `button`) should be used sparingly for very generic base styles, typically handled in global stylesheets.
* **Keep Specificity Low**: Aim for the lowest reasonable specificity to make overrides easier and reduce complexity. Avoid overly nested selectors (e.g., `.class1 .class2 .class3 .class4 span`).
* **BEM-like Naming (Optional but Recommended)**: Consider a BEM-like (Block, Element, Modifier) naming convention for classes within a component to create a clear structure.
    * Block: `.team-settings-modal-view`
    * Element: `.team-settings-modal-view__title`
    * Modifier: `.team-settings-modal-view__button--primary`, `.team-settings-modal-view--is-open`

## 3. CSS Custom Properties (Variables) / Design Tokens

* **Leverage Global Variables**: Extensively use the globally defined CSS Custom Properties (variables) for all reusable values, especially colors (e.g., `--neutral4`, `--accent9`), font sizes, spacing units, and common layout values (like `--left-column-width` observed in `teamSettingsModal.css`).
  ```css
  /* Assuming --background-color-default, --primary-text-color, etc., are globally defined */
  .my-component {
      background-color: var(--background-color-default); /* Uses global variable */
      color: var(--primary-text-color); /* Uses global variable */
      padding: var(--spacing-m); /* Uses global spacing variable */
      border-radius: var(--border-radius-medium); /* Uses global radius variable */
  }
  ```
* **Component-Specific Variables (If Necessary)**: If a component has unique, non-reusable values that are used multiple times *within that component's CSS only*, you can define local CSS custom properties scoped to that component.
  ```css
  .my-specific-component {
      --internal-highlight-color: var(--accent5); /* Based on a global accent */
      --internal-padding: 0.75rem;
  }
  .my-specific-component .header {
      background-color: var(--internal-highlight-color);
      padding: var(--internal-padding);
  }
  ```

## 4. Colors

* **Use Predefined Color Variables**: Always use the globally defined color variables (e.g., `--neutral*` and `--accent*` series, `--app-red11`). Do not use hardcoded hex values or color names directly in component styles.
* **Radix Color System (or Similar)**:
    * Our global color system is based on a Radix-like scale (e.g., `--neutral1` through `--neutral12`, `--accent1` through `--accent12`).
    * Understand and use the appropriate shades for their intended purpose:
        * Low numbers (e.g., `--neutral1`, `--neutral2`) for main app backgrounds.
        * Mid numbers (e.g., `--neutral3` to `--neutral5`) for component backgrounds, borders.
        * Higher numbers (e.g., `--neutral6` to `--neutral8`) for hovered component states.
        * 9-10 (e.g., `--accent9`, `--accent10`) for UI element active states, solid backgrounds, primary actions.
        * 11 (e.g., `--neutral11`, `--accent11`) for interactive element text, icons.
        * 12 (e.g., `--neutral12`) for primary text.
    * If you need a color not available or a specific shade for a unique case, consult about potentially adding it to the global theme variables.

## 5. Layout

* **Flexbox and Grid**: Prefer modern CSS layout techniques like Flexbox and CSS Grid for structuring components and pages. `teamSettingsModal.css` demonstrates good use of Flexbox (`d-flex`, `flex-column`, `justify-content-between`, `align-items-center`).
* **Gap Property**: Use the `gap`, `row-gap`, and `column-gap` properties for spacing between flex or grid items, as it's often cleaner than margins on individual items.
  ```css
  .button-container {
      display: flex;
      gap: var(--spacing-s); /* Using a global spacing variable */
  }
  ```

## 6. Spacing and Sizing

* **Consistent Units**: Use consistent units for spacing and sizing, aka `rem` for scalability with font size (NOTE: use 0.1rem in place of `1px` where appropriate).
* **Spacing Variables**: Utilize globally defined spacing variables (e.g., `--spacing-xs`, `--spacing-s`, `--spacing-m`).
* **Box Sizing**: `box-sizing: border-box;` is assumed to be applied globally (via a reset).

## 7. Typography

* **Font Variables**: Use globally defined CSS variables for font families, sizes, weights, and line heights.
  ```css
  .my-text-element {
      font-family: var(--font-family-base);
      font-size: var(--font-size-large); /* Example of using a specific size variable */
      line-height: var(--line-height-base);
      font-weight: var(--font-weight-bold);
  }
  ```
* **Readability**: Ensure sufficient contrast between text color and background color, leveraging the color system.

## 8. States

* **Style Common States**: Provide clear visual feedback for common UI element states using the established color variables:
    * `:hover`
    * `:focus` (and/or `:focus-visible` for keyboard users)
    * `:active`
    * `.selected` (custom class for selected items, as seen in `teamSettingsModal.css`)
    * `.disabled` or `[disabled]` attribute selector
  ```css
  .team-settings-modal-view .discovery-nav-item:hover:not(.selected) {
      background-color: var(--neutral-hover-background); /* Assuming such a variable exists */
  }
  .team-settings-modal-view .discovery-nav-item.selected {
      background-color: var(--accent-selected-background); /* Assuming such a variable exists */
  }
  .my-button:disabled {
      opacity: 0.5; /* Use specific disabled colors from the theme */
      cursor: not-allowed;
  }
  ```

## 9. Utility Classes

* **Use Framework Utilities**: If your project uses a utility-class system (like Bootstrap-inspired classes for `d-flex`, `p-3`, `m-2`, `w-100`, etc., as seen in `teamSettingsModal.css`), leverage these for common layout and spacing tasks.
* **Avoid Overuse**: Balance the use of utility classes with semantic component classes. Too many utility classes can make HTML less readable.
* **Consistency**: If using utilities, ensure they are applied consistently.

## 10. Component Debugging

* **ID Attributes**: All components should have `id` attributes for debugging in browser dev tools. Use descriptive IDs that match the component hierarchy.
  ```tsx
  // Good: Descriptive IDs
  <div id="entry-view">
    <div id="top-toolbar">...</div>
    <div id="left-rail">
      <div id="left-rail-group-1">...</div>
      <div id="left-rail-group-2">...</div>
    </div>
  </div>
  ```
* **Pass ID as Props**: For reusable components, accept an optional `id` prop:
  ```tsx
  interface RailProps {
    id?: string;
    side: 'left' | 'right';
  }
  ```

## 11. Things to Avoid

* **`!important`**: Avoid using `!important` unless it's an absolute last resort for overriding third-party styles or very specific, justified cases. It makes debugging and future overrides difficult.
* **ID Selectors for Styling**: As mentioned, prefer classes.
* **Overly Nested Selectors**: Keep selector depth to a minimum (2-3 levels is usually sufficient).
* **Inline Styles in TSX/HTML**: Prefer classes in CSS files over inline `style` attributes in your components, except for dynamic styles that truly depend on calculations at runtime and cannot be achieved with classes or CSS variables.
* **Magic Numbers / Hardcoded Values**: Avoid arbitrary pixel values or hex codes. Always use predefined CSS variables for colors, spacing, sizing, etc.

By following these guidelines, we can create a CSS codebase that is robust, easy to understand, and efficient to work with, leveraging our established global theme.
