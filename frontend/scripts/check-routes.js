#!/usr/bin/env node
/**
 * check-routes.js - Angular route inspector for MOBIUS Wiki
 *
 * Parses the Angular routes configuration and displays all routes
 * with their associated components, guards, and other metadata.
 *
 * Usage:
 *   node scripts/check-routes.js              # List all routes
 *   node scripts/check-routes.js --tree       # Show as tree
 *   node scripts/check-routes.js --json       # Output as JSON
 *   node scripts/check-routes.js <pattern>    # Filter by pattern
 *
 * Examples:
 *   npm run routes
 *   npm run routes -- --tree
 *   npm run routes wiki
 */

const fs = require('fs');
const path = require('path');

const ROUTES_FILE = path.join(__dirname, '..', 'src', 'app', 'app.routes.ts');

const args = process.argv.slice(2);
let showTree = false;
let showJson = false;
let filterPattern = null;

for (const arg of args) {
  if (arg === '--tree') showTree = true;
  else if (arg === '--json') showJson = true;
  else if (!arg.startsWith('-')) filterPattern = arg.toLowerCase();
}

function main() {
  if (!fs.existsSync(ROUTES_FILE)) {
    console.error(`Routes file not found: ${ROUTES_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(ROUTES_FILE, 'utf8');
  const routes = parseRoutes(content);

  if (filterPattern) {
    const filtered = routes.filter(r =>
      r.path.toLowerCase().includes(filterPattern) ||
      (r.component && r.component.toLowerCase().includes(filterPattern))
    );
    outputRoutes(filtered);
  } else {
    outputRoutes(routes);
  }
}

function parseRoutes(content) {
  const routes = [];

  // Match route objects - this is a simplified parser
  // It handles the common patterns used in Angular routes
  const routeRegex = /{\s*path:\s*['"`]([^'"`]*)['"`]([^}]*?)}/gs;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    const routePath = match[1];
    const routeBody = match[2];

    const route = {
      path: '/' + routePath,
      component: extractComponent(routeBody),
      guards: extractGuards(routeBody),
      redirectTo: extractRedirect(routeBody),
      children: extractChildren(routeBody),
      canActivate: routeBody.includes('canActivate'),
      loadComponent: routeBody.includes('loadComponent'),
    };

    // Skip empty wildcard routes in children
    if (route.path === '/' && !route.component && !route.redirectTo) continue;

    routes.push(route);
  }

  return routes;
}

function extractComponent(body) {
  // Match: component: SomeComponent
  const match = body.match(/component:\s*(\w+)/);
  if (match) return match[1];

  // Match: loadComponent: () => import(...).then(m => m.SomeComponent)
  const lazyMatch = body.match(/then\s*\(\s*m\s*=>\s*m\.(\w+)\s*\)/);
  if (lazyMatch) return lazyMatch[1] + ' (lazy)';

  return null;
}

function extractGuards(body) {
  const guards = [];
  const match = body.match(/canActivate:\s*\[([^\]]*)\]/);
  if (match) {
    const guardList = match[1].split(',').map(g => g.trim()).filter(Boolean);
    guards.push(...guardList);
  }
  return guards;
}

function extractRedirect(body) {
  const match = body.match(/redirectTo:\s*['"`]([^'"`]*)['"`]/);
  return match ? match[1] : null;
}

function extractChildren(body) {
  return body.includes('children:');
}

function outputRoutes(routes) {
  if (routes.length === 0) {
    console.log('No routes found matching criteria.');
    return;
  }

  if (showJson) {
    console.log(JSON.stringify(routes, null, 2));
    return;
  }

  if (showTree) {
    outputAsTree(routes);
    return;
  }

  // Default table output
  const tableData = routes.map(r => ({
    path: r.path,
    component: r.component || (r.redirectTo ? `→ ${r.redirectTo}` : '-'),
    guards: r.guards.length > 0 ? r.guards.join(', ') : '-',
    lazy: r.loadComponent ? '✓' : '-'
  }));

  console.log('\nAngular Routes:\n');
  console.table(tableData);
  console.log(`\nTotal: ${routes.length} routes`);
}

function outputAsTree(routes) {
  console.log('\nRoute Tree:\n');

  // Group by first path segment
  const groups = {};
  for (const route of routes) {
    const segments = route.path.split('/').filter(Boolean);
    const group = segments[0] || '(root)';
    if (!groups[group]) groups[group] = [];
    groups[group].push(route);
  }

  for (const [group, groupRoutes] of Object.entries(groups)) {
    console.log(`├── ${group}/`);
    for (let i = 0; i < groupRoutes.length; i++) {
      const route = groupRoutes[i];
      const isLast = i === groupRoutes.length - 1;
      const prefix = isLast ? '│   └── ' : '│   ├── ';
      const pathDisplay = route.path === `/${group}` ? '(index)' : route.path.replace(`/${group}/`, '');

      let info = '';
      if (route.component) info = ` → ${route.component}`;
      else if (route.redirectTo) info = ` → redirect to ${route.redirectTo}`;

      if (route.guards.length > 0) info += ` [${route.guards.join(', ')}]`;

      console.log(`${prefix}${pathDisplay}${info}`);
    }
  }
}

main();
