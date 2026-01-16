#!/usr/bin/env node
/**
 * component-tree.js - Angular component analyzer for MOBIUS Wiki
 *
 * Scans the Angular project and displays component information,
 * including their imports, selectors, and file locations.
 *
 * Usage:
 *   node scripts/component-tree.js              # List all components
 *   node scripts/component-tree.js --tree       # Show as hierarchy
 *   node scripts/component-tree.js --json       # Output as JSON
 *   node scripts/component-tree.js <pattern>    # Filter by pattern
 *   node scripts/component-tree.js --services   # List services instead
 *
 * Examples:
 *   npm run components
 *   npm run components -- --tree
 *   npm run components header
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src', 'app');

const args = process.argv.slice(2);
let showTree = false;
let showJson = false;
let showServices = false;
let filterPattern = null;

for (const arg of args) {
  if (arg === '--tree') showTree = true;
  else if (arg === '--json') showJson = true;
  else if (arg === '--services') showServices = true;
  else if (!arg.startsWith('-')) filterPattern = arg.toLowerCase();
}

function main() {
  if (showServices) {
    const services = findServices(SRC_DIR);
    outputServices(services);
  } else {
    const components = findComponents(SRC_DIR);
    outputComponents(components);
  }
}

function findComponents(dir, components = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findComponents(fullPath, components);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check if it's a component
      if (content.includes('@Component')) {
        const component = parseComponent(content, fullPath);
        if (component) {
          // Apply filter if specified
          if (!filterPattern ||
              component.name.toLowerCase().includes(filterPattern) ||
              component.selector.toLowerCase().includes(filterPattern)) {
            components.push(component);
          }
        }
      }
    }
  }

  return components;
}

function parseComponent(content, filePath) {
  // Extract component class name
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (!classMatch) return null;

  const name = classMatch[1];

  // Extract selector
  const selectorMatch = content.match(/selector:\s*['"`]([^'"`]+)['"`]/);
  const selector = selectorMatch ? selectorMatch[1] : 'unknown';

  // Extract imports (other components used)
  const importsMatch = content.match(/imports:\s*\[([^\]]*)\]/s);
  const imports = importsMatch
    ? importsMatch[1].split(',').map(i => i.trim()).filter(i => i && !i.startsWith('//'))
    : [];

  // Check for standalone
  const standalone = content.includes('standalone: true') || !content.includes('standalone: false');

  // Check template type
  const hasTemplateUrl = content.includes('templateUrl:');
  const hasInlineTemplate = content.includes('template:') && content.includes('`');

  // Get relative path
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);

  return {
    name,
    selector,
    imports: imports.filter(i => !['CommonModule', 'RouterModule', 'RouterLink', 'RouterOutlet', 'FormsModule', 'ReactiveFormsModule', 'AsyncPipe', 'DatePipe', 'JsonPipe'].includes(i)),
    allImports: imports,
    standalone,
    templateType: hasTemplateUrl ? 'external' : (hasInlineTemplate ? 'inline' : 'none'),
    path: relativePath,
    directory: path.dirname(relativePath).replace('src/app/', '')
  };
}

function findServices(dir, services = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findServices(fullPath, services);
    } else if (entry.name.endsWith('.service.ts') || entry.name.endsWith('.guard.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const service = parseService(content, fullPath, entry.name);
      if (service) {
        if (!filterPattern || service.name.toLowerCase().includes(filterPattern)) {
          services.push(service);
        }
      }
    }
  }

  return services;
}

function parseService(content, filePath, fileName) {
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (!classMatch) return null;

  const name = classMatch[1];
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);

  // Count methods
  const methodMatches = content.match(/^\s+(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/gm) || [];
  const methodCount = methodMatches.length;

  // Check if injectable
  const injectable = content.includes('@Injectable');

  // Check providedIn
  const providedInMatch = content.match(/providedIn:\s*['"`](\w+)['"`]/);
  const providedIn = providedInMatch ? providedInMatch[1] : (injectable ? 'module' : 'none');

  return {
    name,
    type: fileName.includes('.guard.') ? 'guard' : 'service',
    methods: methodCount,
    providedIn,
    path: relativePath
  };
}

function outputComponents(components) {
  if (components.length === 0) {
    console.log('No components found matching criteria.');
    return;
  }

  if (showJson) {
    console.log(JSON.stringify(components, null, 2));
    return;
  }

  if (showTree) {
    outputAsTree(components);
    return;
  }

  // Default table output
  const tableData = components.map(c => ({
    name: c.name,
    selector: c.selector,
    imports: c.imports.length > 0 ? c.imports.slice(0, 3).join(', ') + (c.imports.length > 3 ? '...' : '') : '-',
    directory: c.directory || '(root)'
  }));

  console.log('\nAngular Components:\n');
  console.table(tableData);
  console.log(`\nTotal: ${components.length} components`);
}

function outputAsTree(components) {
  console.log('\nComponent Tree:\n');

  // Group by directory
  const groups = {};
  for (const comp of components) {
    const group = comp.directory || '(root)';
    if (!groups[group]) groups[group] = [];
    groups[group].push(comp);
  }

  const sortedGroups = Object.keys(groups).sort();

  for (const group of sortedGroups) {
    console.log(`📁 ${group}/`);
    const groupComps = groups[group];

    for (let i = 0; i < groupComps.length; i++) {
      const comp = groupComps[i];
      const isLast = i === groupComps.length - 1;
      const prefix = isLast ? '   └── ' : '   ├── ';

      console.log(`${prefix}🧩 ${comp.name}`);
      console.log(`${isLast ? '   ' : '   │'}       selector: <${comp.selector}>`);

      if (comp.imports.length > 0) {
        console.log(`${isLast ? '   ' : '   │'}       uses: ${comp.imports.join(', ')}`);
      }
    }
    console.log();
  }
}

function outputServices(services) {
  if (services.length === 0) {
    console.log('No services found matching criteria.');
    return;
  }

  if (showJson) {
    console.log(JSON.stringify(services, null, 2));
    return;
  }

  const tableData = services.map(s => ({
    name: s.name,
    type: s.type,
    methods: s.methods,
    providedIn: s.providedIn,
    path: s.path.replace('src/app/', '')
  }));

  console.log('\nAngular Services & Guards:\n');
  console.table(tableData);
  console.log(`\nTotal: ${services.length} services/guards`);
}

main();
