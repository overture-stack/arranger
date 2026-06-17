#!/usr/bin/env node
/**
 * Rewrites file: sibling-package deps to their actual npm version range before publishing.
 * Run from the monorepo root; restore with `git checkout <pkg>/package.json` after publish.
 *
 * Interim measure until pnpm workspace: protocol is adopted (CI/CD roadmap Phase 3.3),
 * which replaces this automatically. When pnpm lands:
 *   - Replace all internal `file:../x` deps with `workspace:*`
 *   - Delete this script and the git checkout restore in the Jenkins publish stage
 *
 * Usage: node scripts/fix-workspace-deps.mjs <package-path>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packagePath = process.argv[2];

if (!packagePath) {
	console.error('Usage: node scripts/fix-workspace-deps.mjs <package-path>');
	process.exit(1);
}

const pkgFile = resolve(rootDir, packagePath, 'package.json');
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
let changed = false;

for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
	if (!pkg[section]) continue;
	for (const [name, spec] of Object.entries(pkg[section])) {
		if (!spec.startsWith('file:')) continue;
		const siblingDir = resolve(dirname(pkgFile), spec.slice('file:'.length));
		const siblingVersion = JSON.parse(readFileSync(resolve(siblingDir, 'package.json'), 'utf8')).version;
		const replacement = `^${siblingVersion}`;
		console.log(`  ${name}: "${spec}" -> "${replacement}"`);
		pkg[section][name] = replacement;
		changed = true;
	}
}

if (changed) {
	writeFileSync(pkgFile, JSON.stringify(pkg, null, '\t') + '\n');
}
