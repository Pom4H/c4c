# Styling System

This Next.js workflow visualization application uses a modern CSS theming system with OKLCH colors and Tailwind CSS v4.

## Features

### 🎨 OKLCH Color System
- Modern perceptually-uniform color space
- Better color consistency across themes
- Smoother gradients and transitions
- Variables defined in `globals.css`

### 🌓 Dark Mode Support
- Complete dark/light theme system
- CSS custom properties for easy theme switching
- Add `dark` class to `<html>` element to enable dark mode

### 🎯 Workflow-Specific Colors

#### Custom Variables
```css
--workflow-graph: Workflow graph visualization color
--workflow-gantt: Gantt chart color
--workflow-trace: Trace viewer color
--workflow-success: Success state color
--workflow-error: Error state color
--workflow-pending: Pending state color
```

#### Span Type Colors
```css
--span-procedure: Green for procedure nodes
--span-condition: Yellow for condition nodes
--span-parallel: Purple for parallel nodes
--span-sequential: Blue for sequential nodes
```

### 🧩 Component Classes

Pre-built utility classes for consistent styling:

- **`.workflow-card`** - Card container with border and shadow
- **`.workflow-button-primary`** - Primary action button
- **`.workflow-button-secondary`** - Secondary action button
- **`.workflow-input`** - Form input styling
- **`.workflow-tab`** - Tab button styling
- **`.workflow-tab-active`** - Active tab state
- **`.gradient-workflow`** - Main background gradient
- **`.scrollbar-thin`** - Custom scrollbar styling

### ✨ Animations

Powered by `tw-animate-css`:

- **`.animate-slide-in`** - Smooth slide-in entrance
- **`.animate-pulse-subtle`** - Subtle pulsing effect
- Built-in Tailwind animations (spin, bounce, etc.)

## Usage Examples

### Basic Card
```tsx
<div className="workflow-card p-6">
  <h2 className="text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</div>
```

### Primary Button
```tsx
<button className="workflow-button-primary">
  Execute Workflow
</button>
```

### Status Indicator
```tsx
<div className="status-success px-3 py-1 rounded">
  Success
</div>
```

### Tabs
```tsx
<button 
  className={`workflow-tab ${active ? 'workflow-tab-active' : ''}`}
>
  Tab Label
</button>
```

## Color Tokens

Use semantic color tokens for consistent theming:

- **`text-foreground`** - Primary text
- **`text-muted-foreground`** - Secondary text
- **`bg-background`** - Page background
- **`bg-card`** - Card background
- **`bg-primary`** - Primary action color
- **`bg-destructive`** - Error/destructive actions
- **`border-border`** - Standard borders
- **`ring-ring`** - Focus rings

## Customization

To customize colors, edit the CSS variables in `src/app/globals.css`:

```css
:root {
  --primary: oklch(0.45 0.15 265); /* Indigo */
  --accent: oklch(0.55 0.2 220);   /* Blue */
  /* ... more colors */
}
```

## Dependencies

- **Tailwind CSS v4** - Utility-first CSS framework
- **tw-animate-css** - Additional animation utilities
- **PostCSS** - CSS processing

## Dark Mode Implementation

To implement dark mode toggle:

```tsx
// Add to your component
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};

<button onClick={toggleDarkMode}>
  Toggle Theme
</button>
```

## Browser Support

- Modern browsers with OKLCH color support
- Fallbacks for older browsers included in Tailwind v4
- Progressive enhancement approach
