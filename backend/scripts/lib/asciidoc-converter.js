/**
 * asciidoc-converter.js
 *
 * Converts AsciiDoc content to HTML using Asciidoctor.
 * Handles image path rewriting and wiki-specific formatting.
 */

const Asciidoctor = require('asciidoctor');

// Create singleton asciidoctor instance
const asciidoctor = Asciidoctor();

/**
 * Pre-process AsciiDoc content to remove Antora-specific directives
 * @param {string} content - Raw AsciiDoc content
 * @returns {string}
 */
function preprocessAsciidoc(content) {
  // Remove include directives for _attributes.adoc files (Antora-specific)
  // These set paths that we handle differently in the wiki
  let processed = content.replace(/^include::.*_attributes\.adoc\[\].*$/gm, '');

  // Remove :moduledir: definitions (Antora-specific)
  processed = processed.replace(/^:moduledir:.*$/gm, '');

  // Remove ifndef/endif blocks for env-site (Antora conditionals)
  processed = processed.replace(/^ifndef::env-site\[\][\s\S]*?^endif::\[\]$/gm, '');

  // Remove other Antora-specific attributes we don't need
  processed = processed.replace(/^:(attachmentsdir|examplesdir|partialsdir):.*$/gm, '');

  return processed;
}

/**
 * Convert AsciiDoc content to HTML
 * @param {string} asciidocContent - Raw AsciiDoc content
 * @param {Object} options - Conversion options
 * @param {string} [options.pageName] - Page name for image path context
 * @param {string} [options.moduleName] - Module name for image path context
 * @returns {{ html: string, title: string, imagePaths: string[] }}
 */
function convertToHtml(asciidocContent, options = {}) {
  const { pageName = '', moduleName = '' } = options;

  // Track image paths found during conversion
  const imagePaths = [];

  // Pre-process to remove Antora-specific directives
  const processedContent = preprocessAsciidoc(asciidocContent);

  // Convert to HTML
  const doc = asciidoctor.load(processedContent, {
    safe: 'safe',
    standalone: false,
    attributes: {
      'showtitle': true,
      'toc': false,
      'icons': 'font',
      'source-highlighter': 'highlight.js',
      'imagesdir': '', // Empty - we handle paths with placeholders
      // Suppress include errors
      'allow-uri-read': false,
    }
  });

  // Get the title from the document
  const title = doc.getDocumentTitle() || pageName || 'Untitled';

  // Convert to HTML
  let html = doc.convert();

  // Extract and transform image paths
  // AsciiDoc image formats:
  // - image::path/to/image.png[alt text]
  // - image:path/to/image.png[alt text] (inline)
  // HTML output: <img src="path/to/image.png" alt="alt text">

  html = html.replace(
    /<img\s+src="([^"]+)"/gi,
    (match, imagePath) => {
      // Skip external URLs
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return match;
      }

      // Track the image path
      imagePaths.push(imagePath);

      // Create a placeholder that will be resolved later
      // Format: {{IMAGE:moduleName/pageName/imagePath}}
      const fullPath = `${moduleName}/${pageName}/${imagePath}`.replace(/\/+/g, '/');
      return `<img src="{{IMAGE:${fullPath}}}"`;
    }
  );

  // Also handle background images in style attributes
  html = html.replace(
    /url\(['"]?([^'")]+\.(png|jpg|jpeg|gif|svg))['"]?\)/gi,
    (match, imagePath) => {
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return match;
      }
      imagePaths.push(imagePath);
      const fullPath = `${moduleName}/${pageName}/${imagePath}`.replace(/\/+/g, '/');
      return `url("{{IMAGE:${fullPath}}}")`;
    }
  );

  return { html, title, imagePaths };
}

/**
 * Extract the title from AsciiDoc content without full conversion
 * @param {string} asciidocContent - Raw AsciiDoc content
 * @returns {string}
 */
function extractTitle(asciidocContent) {
  // Try to find the document title (= Title)
  const titleMatch = asciidocContent.match(/^=\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Try to find a level 1 header (== Header)
  const headerMatch = asciidocContent.match(/^==\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  return 'Untitled';
}

/**
 * Resolve image placeholders in HTML content
 * @param {string} html - HTML content with {{IMAGE:path}} placeholders
 * @param {Object<string, number>} imageMap - Map of image paths to file IDs
 * @param {string} baseUrl - Base URL for file downloads (e.g., '/api/v1/files')
 * @returns {string}
 */
function resolveImagePlaceholders(html, imageMap, baseUrl = '/api/v1/files') {
  return html.replace(
    /\{\{IMAGE:([^}]+)\}\}/g,
    (match, imagePath) => {
      // Try exact match first
      if (imageMap[imagePath]) {
        return `${baseUrl}/${imageMap[imagePath]}/download`;
      }

      // Try just the filename
      const filename = imagePath.split('/').pop();
      for (const [path, fileId] of Object.entries(imageMap)) {
        if (path.endsWith(filename)) {
          return `${baseUrl}/${fileId}/download`;
        }
      }

      // Keep placeholder if not found (will show broken image)
      console.warn(`Image not found in map: ${imagePath}`);
      return match;
    }
  );
}

/**
 * Generate a URL-friendly slug from a title or filename
 * @param {string} text - Text to convert to slug
 * @returns {string}
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

/**
 * Clean up HTML content for storage
 * - Remove extra whitespace
 * - Ensure consistent formatting
 * @param {string} html - HTML content
 * @returns {string}
 */
function cleanHtml(html) {
  return html
    .replace(/\n{3,}/g, '\n\n')  // Collapse multiple newlines
    .replace(/>\s+</g, '>\n<')    // Clean up tag spacing
    .trim();
}

/**
 * Check if content appears to be valid AsciiDoc
 * @param {string} content - Content to check
 * @returns {boolean}
 */
function isValidAsciidoc(content) {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check for common AsciiDoc patterns
  const patterns = [
    /^=\s+/m,           // Document title
    /^==+\s+/m,         // Section headers
    /^\*\s+/m,          // Unordered list
    /^\.\s+/m,          // Ordered list item
    /\[\[.+\]\]/,       // Anchors
    /<<.+>>/,           // Cross-references
    /image::/,          // Images
    /include::/,        // Includes
    /\[source/,         // Code blocks
  ];

  return patterns.some(pattern => pattern.test(content));
}

module.exports = {
  convertToHtml,
  extractTitle,
  resolveImagePlaceholders,
  generateSlug,
  cleanHtml,
  isValidAsciidoc,
};
