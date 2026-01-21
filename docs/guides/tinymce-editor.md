# TinyMCE Editor Guide

The MOBIUS Wiki uses TinyMCE as its WYSIWYG editor, configured for wiki documentation with custom fonts, templates, and HTML preservation.

## Overview

| Feature | Description |
|---------|-------------|
| Editor | TinyMCE 7.x (self-hosted) |
| Location | `frontend/src/app/shared/components/tinymce-editor/` |
| Selector | `<app-quill-editor>` (legacy name for compatibility) |
| Fonts | 10 curated Google Fonts |

## File Structure

```
frontend/src/app/shared/components/tinymce-editor/
├── tinymce-editor.component.ts    # Main component logic
├── tinymce-editor.component.html  # Template (visual + source modes)
├── tinymce-editor.component.css   # Toolbar and UI styling
└── tinymce-config.ts              # Configuration, templates, formats
```

## Toolbar Layout

The toolbar is organized into logical groups separated by `|`:

```
H1 H2 H3 | Format | Font Family Font Size | B I U S | Colors | Lists | Alignment | Link Clear | Undo Redo | Insert | Source
```

| Group | Buttons | Purpose |
|-------|---------|---------|
| Headings | H1, H2, H3 | Quick heading insertion for TOC |
| Format | Dropdown | Normal, H1, H2, H3 paragraph formats |
| Typography | Font family, size | Font selection and sizing |
| Text | Bold, Italic, Underline, Strike | Text formatting |
| Colors | Forecolor, Backcolor | Text and highlight colors |
| Lists | Bullet, Numbered, Indent | List formatting |
| Alignment | Left, Center, Right | Text alignment |
| Links | Link, Remove format | Hyperlinks and clearing |
| History | Undo, Redo | Edit history |
| Custom | Insert menu | Templates (callout, note, stats) |
| Source | Code icon | Toggle HTML source view |

## Fonts

### Available Fonts (10 total)

**Sans-serif (Modern Documentation)**
| Font | CSS Value | Use Case |
|------|-----------|----------|
| Outfit | `Outfit, sans-serif` | Brand font (header) |
| Roboto | `Roboto, sans-serif` | Clean, readable body text |
| Lato | `Lato, sans-serif` | Friendly, professional |
| Poppins | `Poppins, sans-serif` | Modern headings |

**Serif (Classic Wiki/Book Style)**
| Font | CSS Value | Use Case |
|------|-----------|----------|
| Merriweather | `Merriweather, serif` | Traditional documentation |
| Crimson Text | `Crimson Text, serif` | Classic book typography |
| Source Serif | `Source Serif 4, serif` | Professional docs |
| Georgia | `georgia, serif` | System fallback |

**Fallbacks**
| Font | CSS Value | Use Case |
|------|-----------|----------|
| System Font | `-apple-system, BlinkMacSystemFont, sans-serif` | Native OS font |
| Monospace | `monospace` | Code snippets |

### How Fonts Work

Fonts are loaded in two places to ensure they work everywhere:

1. **Main page** (`index.html`): For rendered content outside the editor
2. **TinyMCE iframe** (via JavaScript injection in `onEditorInit`): For real-time preview while editing

```typescript
// In tinymce-editor.component.ts
onEditorInit(event: any): void {
  const iframeDoc = this.editorInstance.getDoc();
  if (iframeDoc) {
    const link = iframeDoc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=...';
    iframeDoc.head.appendChild(link);
  }
}
```

### Adding New Fonts

1. Add to Google Fonts URL in `tinymce-editor.component.ts` (line ~152)
2. Add to Google Fonts URL in `index.html`
3. Add to `font_family_formats` in `tinymce-config.ts`

**Important**: Use single-word font names when possible. Multi-word names (like "Open Sans") may not preview correctly in the editor iframe.

## Insert Menu

The "Insert" button provides quick access to pre-styled templates:

### Badge-Style Callouts

These are the primary callout types with colored badges:

| Type | Background | Badge Color | Use Case |
|------|------------|-------------|----------|
| Note | `#E0F7FA` (light teal) | `#0097A7` (teal) | General information |
| Warning | `#FEF3C7` (light amber) | `#e67e22` (orange) | Important cautions |
| Error | `#FEE2E2` (light red) | `#dc3545` (red) | Critical issues |
| Tip | `#D1FAE5` (light green) | `#28a745` (green) | Helpful suggestions |
| Info | `#DBEAFE` (light blue) | `#17a2b8` (blue) | Additional details |

**Example: Note Box**
```html
<div class="callout-box note" style="background-color: #E0F7FA; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
  <span class="badge" style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; background-color: #0097A7; color: white;">Note</span>
  <p style="margin: 0; color: #555;">Enter your note text here.</p>
</div>
```

### Table of Contents

```html
<div class="toc" style="background-color: #fafafa; border-left: 3px solid #0097A7; padding: 20px 24px; margin-bottom: 32px; border-radius: 0 4px 4px 0;">
  <div class="toc-title" style="font-weight: 600; color: #555; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Table of Contents</div>
  <ul style="list-style-type: none; margin: 0; padding-left: 0;">
    <li style="margin-bottom: 6px;"><a href="#section-1" style="color: #666; text-decoration: none; font-size: 14px;">Section 1</a></li>
  </ul>
</div>
```

### Legacy Templates

| Item | Template | Description |
|------|----------|-------------|
| Callout Box | `.callout` | Teal-bordered highlight box |
| Note Box | `.note-box` | Gray info box |
| Stats Grid | `.stats-grid` | 3-column statistics cards |
| Heading 1-3 | `<h1>` - `<h3>` | Pre-styled headings |
| Paragraph | `<p>` | Standard body text |
| Unordered List | `<ul>` | Bullet list with template items |
| Ordered List | `<ol>` | Numbered list with template items |
| Divider | `<hr>` | Horizontal separator |

### Legacy Template Examples

**Callout Box**
```html
<div class="callout">
  Enter your callout text here. This is used for important highlights.
</div>
```

**Note Box**
```html
<div class="note-box">
  <strong>Note:</strong> Enter your note text here.
</div>
```

**Stats Grid**
```html
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-number">72</div>
    <div class="stat-label">Member Libraries</div>
  </div>
  <!-- More stat-cards... -->
</div>
```

## Source Mode

Click the `</>` button to toggle between visual and HTML source editing.

**Features:**
- HTML is automatically beautified (formatted) when entering source mode
- Changes sync back to visual mode when switching
- Uses `js-beautify` for consistent formatting

**Beautify Settings:**
```typescript
{
  indent_size: 2,
  wrap_line_length: 100,
  max_preserve_newlines: 2,
  preserve_newlines: true,
  indent_inner_html: true
}
```

## Image Handling

### Image Alignment Overlay

When you click on an image in the editor, a floating toolbar appears with:
- **Left align** - Image floats left
- **Center** - Image centered with auto margins
- **Right align** - Image floats right
- **Dimensions** - Shows current width × height

Alignment uses inline styles for portability:
```html
<!-- Centered image -->
<img src="..." style="display: block; margin-left: auto; margin-right: auto;">
```

### Image Configuration

```typescript
image_advtab: false,           // No advanced tab
image_uploadtab: false,        // Upload disabled (for now)
image_dimensions: true,        // Show width/height fields
resize_img_proportional: true, // Maintain aspect ratio
object_resizing: 'img',        // Enable resize handles
```

## HTML Preservation

TinyMCE is configured to preserve HTML exactly as authored:

```typescript
verify_html: false,            // Don't validate/fix HTML
cleanup: false,                // Don't clean up markup
convert_urls: false,           // Don't convert URLs
remove_trailing_brs: false,    // Keep trailing <br> tags
entity_encoding: 'raw',        // Don't encode entities
valid_elements: '*[*]',        // Allow ALL elements/attributes
```

### Protected Elements

These custom elements are protected from modification:
- `.callout` divs
- `.note-box` divs
- `.stats-grid` divs

## Inline Styles

All formatting uses inline styles (not CSS classes) for portability:

| Format | Applied Style |
|--------|---------------|
| Font family | `style="font-family: ..."` |
| Font size | `style="font-size: ..."` |
| Text color | `style="color: ..."` |
| Background | `style="background-color: ..."` |
| Alignment | `style="text-align: ..."` |

### CRITICAL: The `valid_styles` Whitelist

TinyMCE **silently strips** any inline style not explicitly whitelisted. This is configured in `tinymce-config.ts`:

```typescript
valid_styles: {
  '*': 'font-size,font-family,color,text-align,background,background-color,text-decoration,border,border-top,border-left,border-radius,padding,margin,margin-left,margin-right,margin-top,margin-bottom,width,height,display,float,line-height,letter-spacing,text-transform,vertical-align,white-space,list-style,list-style-type'
},
```

**If you add new templates with inline styles, you MUST:**
1. Check that ALL style properties are in the whitelist
2. Add any missing properties to the whitelist
3. Use `background-color` instead of `background` shorthand for reliability

**Example of silent stripping:**
```html
<!-- Template has this -->
<div style="background: #E0F7FA; border-radius: 4px;">

<!-- If background and border-radius weren't whitelisted, TinyMCE would output -->
<div>
```

No error, no warning - the styles just disappear.

### Styling in Editor vs View Mode

Callout templates use **both** inline styles AND CSS classes:

1. **Inline styles** - Applied directly in templates, ensure immediate rendering in editor
2. **CSS classes** - Defined in `frontend/src/styles/mobius-ui.css`, provide styling in view mode

This dual approach ensures styles work:
- In the TinyMCE editor iframe (inline styles)
- When viewing saved pages (CSS classes as fallback)

The CSS for callout boxes is defined in:
- `tinymce-config.ts` → `content_style` (for editor preview)
- `frontend/src/styles/mobius-ui.css` (for page viewing)

## Height & Resizing

The editor automatically calculates available height:

```typescript
const availableHeight = viewportHeight - headerHeight - breadcrumbHeight - padding;
const editorHeight = Math.max(400, availableHeight);
```

- Minimum height: 400px
- Maximum height: 800px
- User can resize manually

## Component API

### Inputs

| Input | Type | Description |
|-------|------|-------------|
| `content` | `string` | Initial HTML content |
| `placeholder` | `string` | Placeholder text |

### Outputs

| Output | Type | Description |
|--------|------|-------------|
| `contentChange` | `EventEmitter<string>` | Emits on content change |

### Methods

| Method | Description |
|--------|-------------|
| `getValue()` | Returns current HTML content |
| `undo()` | Undo last action |
| `redo()` | Redo last action |
| `toggleSourceMode()` | Switch between visual/source |

## Usage Example

```html
<app-quill-editor
  [content]="pageContent"
  (contentChange)="onContentChange($event)"
  placeholder="Start writing...">
</app-quill-editor>
```

```typescript
pageContent = '<h1>Welcome</h1><p>Start editing...</p>';

onContentChange(html: string): void {
  this.pageContent = html;
  this.hasChanges = true;
}
```

## Troubleshooting

### Fonts not previewing in editor

**Cause**: Google Fonts not loaded in TinyMCE iframe.

**Solution**: Fonts are injected via JavaScript in `onEditorInit`. Check that the Google Fonts URL is correct and the injection code runs.

### Content formatting lost on save

**Cause**: HTML preservation settings may have been changed.

**Solution**: Verify these settings in `tinymce-config.ts`:
```typescript
verify_html: false,
cleanup: false,
valid_elements: '*[*]',
```

### Custom elements (callout, note-box) being modified

**Cause**: TinyMCE is processing protected elements.

**Solution**: Check the `protect` array in config includes your elements.

### Images not aligning correctly

**Cause**: Alignment uses inline styles that may conflict with external CSS.

**Solution**: Image alignment uses `display: block` + `margin-left/right: auto`. Ensure no CSS overrides these properties.

### Insert menu elements appear unstyled

**Cause**: TinyMCE's `valid_styles` whitelist is stripping inline styles from templates.

**Symptoms**:
- Callout boxes have no background color
- Badges have no styling
- TOC has no border or background

**Solution**: Check that ALL inline style properties used in templates are in the `valid_styles` whitelist in `tinymce-config.ts`. Common missing styles:
- `border-radius`
- `border-top`
- `border-left`
- `text-transform`
- `list-style-type`

Also ensure:
1. Templates use `background-color` (not `background` shorthand)
2. CSS classes exist in `frontend/src/styles/mobius-ui.css` for view mode

## Configuration Reference

See `tinymce-config.ts` for the complete configuration. Key exports:

| Export | Description |
|--------|-------------|
| `TINYMCE_BASE_CONFIG` | Main TinyMCE configuration object |
| `ELEMENT_TEMPLATES` | HTML templates for Insert menu |
| `HTML_BEAUTIFY_OPTIONS` | Source mode formatting options |
