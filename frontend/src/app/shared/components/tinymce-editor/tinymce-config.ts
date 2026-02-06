export const TINYMCE_BASE_CONFIG = {
  // ⚠️ CRITICAL: HTML Preservation Settings
  // These settings prevent TinyMCE from normalizing or reformatting HTML
  verify_html: false,                    // Don't validate/fix HTML structure
  convert_urls: false,                   // Don't convert URLs
  remove_trailing_brs: false,            // Keep trailing <br> tags
  entity_encoding: 'raw',               // Don't encode entities

  // Allow ALL elements and attributes
  valid_elements: '*[*]',                // Allow all elements with all attributes
  valid_children: '+body[style]',        // Allow <style> in body
  valid_classes: '*',                    // Allow all classes

  // Explicitly allow inline styles (MUST be object format, not string!)
  // Reference: https://www.tiny.cloud/docs/tinymce/latest/content-filtering/
  valid_styles: {
    '*': 'font-size,font-family,font-weight,color,text-align,background,background-color,text-decoration,border,border-top,border-bottom,border-left,border-right,border-radius,padding,margin,margin-left,margin-right,margin-top,margin-bottom,width,height,display,float,line-height,letter-spacing,text-transform,vertical-align,white-space,list-style,list-style-type'
  },

  // Whitespace preservation
  allow_html_in_named_anchor: true,

  // Content formatting
  indent: false,                         // Don't auto-indent
  element_format: 'html',                // Use HTML format (not XHTML)

  // Protect custom elements from modification
  // Note: Non-greedy regex can't handle nested <div>s perfectly.
  // stats-grid protection is partial but sufficient — valid_elements: '*[*]' prevents element stripping.
  protect: [
    /<div class="callout">[\s\S]*?<\/div>/g,
    /<div class="note-box">[\s\S]*?<\/div>/g,
    /<div class="stats-grid">[\s\S]*?<\/div>/g,
  ],

  // Override built-in formats to use inline styles instead of CSS classes
  // Reference: https://www.tiny.cloud/docs/tinymce/latest/content-formatting/
  formats: {
    // Text alignment - use inline styles (TinyMCE default uses CSS classes)
    // Note: Images require display:block + margin for centering (text-align doesn't work on <img>)
    alignleft: [
      { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table', styles: { textAlign: 'left' } },
      { selector: 'img', styles: { display: 'block', marginLeft: '0', marginRight: 'auto' } }
    ],
    aligncenter: [
      { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table', styles: { textAlign: 'center' } },
      { selector: 'img', styles: { display: 'block', marginLeft: 'auto', marginRight: 'auto' } }
    ],
    alignright: [
      { selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table', styles: { textAlign: 'right' } },
      { selector: 'img', styles: { display: 'block', marginLeft: 'auto', marginRight: '0' } }
    ],
    alignjustify: {
      selector: 'p,h1,h2,h3,h4,h5,h6,td,th,div,ul,ol,li,table',
      styles: { textAlign: 'justify' }
    },

    // Font size - ensure it uses inline styles (default should already do this)
    fontsize: { inline: 'span', styles: { fontSize: '%value' } },

    // Font family - ensure it uses inline styles
    fontfamily: { inline: 'span', styles: { fontFamily: '%value' } },

    // Colors - ensure inline styles
    forecolor: { inline: 'span', styles: { color: '%value' } },
    backcolor: { inline: 'span', styles: { backgroundColor: '%value' } }
  },

  // TinyMCE Configuration
  base_url: '/tinymce',                  // Self-hosted TinyMCE
  suffix: '.min',
  plugins: 'link image lists code table',  // Core plugins (textpattern removed - handled manually)
  menubar: false,                        // Disable menu bar
  statusbar: false,                      // Disable status bar
  branding: false,                       // Remove "Powered by Tiny" branding

  // Font family options (curated set for wiki documentation)
  font_family_formats: [
    // Sans-serif (modern docs)
    'Outfit=Outfit,sans-serif',
    'Roboto=Roboto,sans-serif',
    'Lato=Lato,sans-serif',
    'Poppins=Poppins,sans-serif',
    // Serif (classic wiki/book style)
    'Merriweather=Merriweather,serif',
    'Crimson Text=Crimson Text,serif',
    'Source Serif=Source Serif 4,serif',
    'Georgia=georgia,serif',
    // Fallbacks
    'System Font=-apple-system,BlinkMacSystemFont,sans-serif',
    'Monospace=monospace'
  ].join('; '),

  // Font size options (aligned with MOBIUS heading hierarchy)
  font_size_formats: '14px 16px 18px 20px 24px 28px 32px 36px',

  // Toolbar configuration
  toolbar: [
    'heading1 heading2 heading3',        // Heading buttons (for TOC navigation)
    'formatselect',                      // Normal, H1, H2, H3
    'fontfamily fontsize',               // Font family and size dropdowns
    'bold italic underline strikethrough',
    'forecolor backcolor',
    'bullist numlist outdent indent',
    'alignleft aligncenter alignright',
    'link removeformat',
    'undo redo',
    'insertmenu',                        // Custom menu for element templates
    'sourcecode'                         // HTML source toggle button
  ].join(' | '),

  // Format dropdown options
  block_formats: 'Normal=p;Heading 1=h1;Heading 2=h2;Heading 3=h3',

  // Image plugin configuration
  image_advtab: false,                   // Disable advanced tab
  image_uploadtab: true,                 // Enable upload tab
  image_dimensions: true,                // Show width/height
  resize_img_proportional: true,         // Maintain aspect ratio
  object_resizing: 'img',                // Enable resize handles on images

  // Markdown + AsciiDoc text patterns for live formatting
  // Patterns trigger on Space key after matching text at start of line (block patterns)
  // or when surrounding text with delimiters (inline patterns)
  text_patterns: [
    // Headings - Markdown style (# + Space)
    { start: '#', format: 'h1' },
    { start: '##', format: 'h2' },
    { start: '###', format: 'h3' },
    { start: '####', format: 'h4' },

    // Headings - AsciiDoc style (= + Space)
    { start: '=', format: 'h1' },
    { start: '==', format: 'h2' },
    { start: '===', format: 'h3' },
    { start: '====', format: 'h4' },

    // Lists - bullet (- or * + Space)
    { start: '-', cmd: 'InsertUnorderedList' },
    { start: '*', cmd: 'InsertUnorderedList' },

    // Lists - numbered (1. or . + Space)
    { start: '1.', cmd: 'InsertOrderedList' },
    { start: '.', cmd: 'InsertOrderedList' },

    // Blockquote (> + Space)
    { start: '>', format: 'blockquote' },

    // Inline - Bold (Markdown double asterisk)
    { start: '**', end: '**', format: 'bold' },

    // Inline - Italic (Markdown single asterisk OR AsciiDoc underscore)
    { start: '*', end: '*', format: 'italic' },
    { start: '_', end: '_', format: 'italic' },

    // Inline - Code (backticks - both Markdown and AsciiDoc)
    { start: '`', end: '`', format: 'code' },
  ],

  // Content styling (loaded inside editor iframe)
  // Note: Google Fonts are injected via JS in onEditorInit for reliability
  content_style: `
    /* Typography */
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }

    h1 {
      font-size: 36px;
      font-weight: 400;
      color: var(--mobius-dark-slate, #2d3e50);
      margin-bottom: 32px;
      line-height: 1.2;
    }

    h2 {
      font-size: 28px;
      font-weight: 400;
      color: var(--mobius-dark-slate, #2d3e50);
      margin-top: 48px;
      margin-bottom: 20px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--mobius-teal, #0097A7);
      line-height: 1.3;
    }

    h3 {
      font-size: 20px;
      font-weight: 600;
      color: var(--mobius-dark-slate, #2d3e50);
      margin-top: 32px;
      margin-bottom: 16px;
      line-height: 1.4;
    }

    h4 {
      font-size: 16px;
      font-weight: 600;
      color: var(--mobius-dark-slate, #2d3e50);
      margin-top: 24px;
      margin-bottom: 12px;
      line-height: 1.5;
    }

    p {
      margin-bottom: 16px;
      line-height: 1.7;
      color: #555;
    }

    ul, ol {
      margin-bottom: 20px;
      padding-left: 1.5em;
    }

    li {
      margin-bottom: 8px;
      line-height: 1.7;
      color: #555;
    }

    /* Image styling */
    img {
      cursor: pointer;
      transition: box-shadow 0.2s;
    }

    img:hover {
      box-shadow: 0 0 0 2px #0097A7;
    }

    /* Custom Elements */
    .callout {
      border-left: 4px solid #0097A7;
      background: #E0F7FA;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
      line-height: 1.6;
    }

    .callout p {
      margin: 0;
    }

    .note-box {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 14px;
      line-height: 1.6;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 32px 0;
    }

    .stat-card {
      display: block;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-top: 3px solid #0097A7;
      padding: 24px;
      text-align: center;
      height: 100%;
      box-sizing: border-box;
    }

    .stat-number {
      display: block;
      font-size: 36px;
      font-weight: 300;
      color: #0097A7;
      margin-bottom: 8px;
      line-height: 1;
    }

    .stat-label {
      display: block;
      font-size: 13px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .timeline-table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }

    .timeline-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      border: 1px solid #dee2e6;
      font-weight: 600;
      color: #2d3e50;
    }

    .timeline-table td {
      padding: 12px;
      border: 1px solid #dee2e6;
    }

    .timeline-table tr:hover {
      background: #f8f9fa;
    }
  `,

  // Height configuration - SIMPLE FIXED HEIGHT
  min_height: 500,
  max_height: 800,
  resize: true,

};

// Element templates (reused from Quill)
export const ELEMENT_TEMPLATES: {[key: string]: string} = {
  callout: `<div class="callout">Enter your callout text here. This is used for important highlights.</div>`,
  note: `<div class="note-box"><strong>Note:</strong> Enter your note text here. This is used for additional information.</div>`,
  stats: `<div class="stats-grid">
    <div class="stat-card"><div class="stat-number">72</div><div class="stat-label">Member Libraries</div></div>
    <div class="stat-card"><div class="stat-number">30M+</div><div class="stat-label">Items in Catalog</div></div>
    <div class="stat-card"><div class="stat-number">176+</div><div class="stat-label">Physical Branches</div></div>
</div>`,
  h1: `<h1>New Page Title</h1>`,
  h2: `<h2>New Section Heading</h2>`,
  h3: `<h3>New Subsection Heading</h3>`,
  paragraph: `<p>Enter your paragraph text here. This is standard body text with comfortable line height and spacing.</p>`,
  ul: `<ul>
    <li><strong>Item one</strong> – Description of the first item</li>
    <li><strong>Item two</strong> – Description of the second item</li>
    <li><strong>Item three</strong> – Description of the third item</li>
</ul>`,
  ol: `<ol>
    <li><strong>First step</strong> – Description of step one</li>
    <li><strong>Second step</strong> – Description of step two</li>
    <li><strong>Third step</strong> – Description of step three</li>
</ol>`,
  divider: `<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 32px 0;">`
};

// HTML beautify options (for source mode)
export const HTML_BEAUTIFY_OPTIONS = {
  indent_size: 2,
  wrap_line_length: 100,
  max_preserve_newlines: 2,
  preserve_newlines: true,
  indent_inner_html: true,
  end_with_newline: false,
};
