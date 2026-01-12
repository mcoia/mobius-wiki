export const TINYMCE_BASE_CONFIG = {
  // ⚠️ CRITICAL: HTML Preservation Settings
  // These settings prevent TinyMCE from normalizing or reformatting HTML
  verify_html: false,                    // Don't validate/fix HTML structure
  cleanup: false,                        // Don't clean up markup
  convert_urls: false,                   // Don't convert URLs
  remove_trailing_brs: false,            // Keep trailing <br> tags
  entity_encoding: 'raw',                // Don't encode entities

  // Allow ALL elements and attributes
  valid_elements: '*[*]',                // Allow all elements with all attributes
  valid_children: '+body[style]',        // Allow <style> in body
  extended_valid_elements: '*[style|class|id|data-*|href|src|alt|title|width|height|align]',  // Explicit whitelist for security
  valid_classes: '*',                    // Allow all classes
  valid_styles: '*',                     // Allow all inline styles

  // Whitespace preservation
  allow_html_in_named_anchor: true,
  remove_linebreaks: false,
  apply_source_formatting: false,        // Don't reformat on save

  // Content formatting
  indent: false,                         // Don't auto-indent
  element_format: 'html',                // Use HTML format (not XHTML)

  // Additional preservation settings
  custom_elements: '~*',                 // Allow custom elements anywhere
  fix_list_elements: false,              // Don't fix list structure

  // Protect custom elements from modification
  protect: [
    /<div class="callout">[\s\S]*?<\/div>/g,
    /<div class="note-box">[\s\S]*?<\/div>/g,
    /<div class="stats-grid">[\s\S]*?<\/div>/g,
  ],

  // TinyMCE Configuration
  base_url: '/tinymce',                  // Self-hosted TinyMCE
  suffix: '.min',
  plugins: 'link image lists code',      // Core plugins
  menubar: false,                        // Disable menu bar
  statusbar: false,                      // Disable status bar
  branding: false,                       // Remove "Powered by Tiny" branding

  // Toolbar configuration
  toolbar: [
    'formatselect',                      // Normal, H1, H2, H3
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
  image_uploadtab: false,                // Disable upload tab (for now)
  image_dimensions: true,                // Show width/height
  resize_img_proportional: true,         // Maintain aspect ratio
  object_resizing: 'img',                // Enable resize handles on images

  // Content styling (loaded inside editor iframe)
  // REMOVED: content_css: '/styles/mobius-ui.css',  // Causes MIME type error
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

    /* Image alignment */
    img.ql-align-left {
      display: block;
      margin-left: 0;
      margin-right: auto;
    }

    img.ql-align-center {
      display: block;
      margin-left: auto;
      margin-right: auto;
    }

    img.ql-align-right {
      display: block;
      margin-left: auto;
      margin-right: 0;
    }

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

  // Paste settings (preserve formatting)
  paste_as_text: false,
  paste_data_images: true,
  paste_merge_formats: true,
  smart_paste: false,
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
