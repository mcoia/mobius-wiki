# MOBIUS Wiki UI Kit

A complete UI component library extracted from MOBIUS documentation mockups. Built with vanilla HTML, CSS, and JavaScript for maximum compatibility and ease of use.

## Version

1.0.0

## What's Included

```
ui-kit/
├── mobius-ui.css              # Complete stylesheet (~1200 lines)
├── mobius-ui.js               # Interactive features (~100 lines)
├── ui-components.html         # Living style guide/documentation
├── README.md                  # This file
├── templates/
│   ├── page-base.html         # Base page template
│   ├── header.html            # Header component
│   ├── left-nav.html          # Navigation sidebar
│   ├── right-toc.html         # Table of contents sidebar
│   └── snippets.html          # Copy-paste component snippets
└── examples/
    └── home.html              # Complete homepage example
```

## Quick Start

### 1. Link the Stylesheet

Add to your HTML `<head>`:

```html
<link rel="stylesheet" href="path/to/mobius-ui.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

### 2. Add JavaScript (Optional)

Add before closing `</body>`:

```html
<script src="path/to/mobius-ui.js"></script>
```

For diagram support, also include:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
```

### 3. Use the Base Template

Start with `templates/page-base.html` or copy the structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Page Title</title>
    <link rel="stylesheet" href="mobius-ui.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
<header class="top-header">
    <div class="logo">MOBIUS<sup>®</sup></div>
    <div class="top-nav">
        <!-- Your navigation links -->
    </div>
</header>

<div class="container">
    <nav class="left-sidebar">
        <!-- Navigation menu -->
    </nav>

    <main class="main-content">
        <!-- Your content here -->
    </main>

    <aside class="right-sidebar">
        <!-- Table of contents -->
    </aside>
</div>

<script src="mobius-ui.js"></script>
</body>
</html>
```

## Components

All components are documented with live examples in `ui-components.html`. Open that file in your browser for the full component library.

### Available Components

- **Layout System** - Three-column responsive layout
- **Header** - Top navigation bar with logo and search
- **Sidebars** - Left navigation and right TOC
- **Breadcrumb** - Navigational breadcrumb trail
- **Callout Boxes** - Highlighted information boxes
- **Note Boxes** - Styled notes (default, warning, success, danger)
- **Stats Cards** - Grid of statistics or feature cards
- **Tables** - Styled tables with hover effects
- **Code Blocks** - Inline and block code formatting
- **Flow Steps** - Numbered step indicators
- **Typography** - Consistent heading and text styles
- **Utility Classes** - Margin, padding, and alignment helpers

## Customization

### CSS Variables

The UI kit uses CSS custom properties for easy theming. Override these in your own stylesheet:

```css
:root {
    /* Brand Colors */
    --mobius-navy: #003057;
    --mobius-teal: #0097A7;
    --mobius-dark-slate: #2d3e50;

    /* Spacing */
    --space-sm: 12px;
    --space-md: 16px;
    --space-lg: 24px;

    /* Layout */
    --sidebar-left-width: 260px;
    --sidebar-right-width: 280px;
}
```

### Responsive Breakpoints

- **1200px** - Right sidebar hides
- **768px** - Columns stack vertically, reduced padding
- **480px** - Header stacks, full-width search

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Uses modern CSS (Grid, Flexbox, Custom Properties). No IE11 support.

## Dependencies

### Required

- **Font Awesome 6.4.0** - For icons (search box)
  - CDN: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`

### Optional

- **Mermaid 10** - For diagrams (if using `.mermaid` components)
  - CDN: `https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js`

## File Size

- **mobius-ui.css**: ~40KB (unminified)
- **mobius-ui.js**: ~4KB (unminified)

## Features

### Included in mobius-ui.js:

- ✅ Smooth anchor link scrolling
- ✅ Mermaid diagram initialization
- ✅ Search box event handling (placeholder)
- ✅ Active navigation highlighting

## Example Usage

### Creating a Page

1. **Copy** `templates/page-base.html`
2. **Customize** navigation in left sidebar
3. **Add** your content to `.main-content`
4. **Update** table of contents in right sidebar
5. **Done!**

### Using Components

See `templates/snippets.html` for copy-paste ready HTML for each component.

Example - Adding a callout box:

```html
<div class="callout">
    <p><strong>Important:</strong> Your message here.</p>
</div>
```

Example - Adding stats cards:

```html
<div class="stats-grid">
    <div class="stat-card center">
        <div class="stat-number">72</div>
        <div class="stat-label">Member Libraries</div>
    </div>
    <div class="stat-card center">
        <div class="stat-number">30M+</div>
        <div class="stat-label">Items in Catalog</div>
    </div>
</div>
```

## Tips

### Navigation Data

The left sidebar navigation is static HTML. Update the menu structure directly in your HTML files. For dynamic navigation, consider:

- Server-side rendering with your template engine
- Client-side JavaScript to generate menus from data
- Static site generator (Jekyll, Hugo, 11ty)

### Table of Contents

The right sidebar TOC is manual HTML. For auto-generated TOCs:

- Use the existing mobius-ui.js as a base
- Add a function to scan headings and build TOC
- Or use a static site generator with TOC support

### Grid Columns

Stats cards default to 2 columns. For 3 columns, add:

```css
.stats-grid {
    grid-template-columns: repeat(3, 1fr);
}
```

## Resources

- **Component Documentation**: Open `ui-components.html` in your browser
- **Example Page**: See `examples/home.html`
- **Component Snippets**: See `templates/snippets.html`

## License

Extracted from MOBIUS consortium documentation mockups.

## Support

For issues, questions, or contributions, contact the MOBIUS development team.

---

**Built for the MOBIUS Library Consortium**
Version 1.0.0 | December 2025
