#!/usr/bin/env node
/**
 * Pre-release sanity check: reports any local-only dep specs (file: or workspace:) in
 * publishable modules' dependencies. These must not appear in a published tarball.
 * Run before cutting a release: `npm run release:check`
 *
 * Checks both prefixes so it remains valid after the pnpm migration (Phase 3.3), when
 * file: deps become workspace: deps — same problem, different prefix.
 *
 * Exits non-zero if anything is found so it can be used as a CI gate.
 * Does not modify files — use scripts/fix-workspace-deps.mjs for the fix (npm),
 * or verify pnpm/Changesets handled the replacement correctly (pnpm).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(import.meta.url), '../..');
const modulesDir = resolve(rootDir, 'modules');
const sections = ['dependencies', 'devDependencies', 'peerDependencies'];

let found = false;

for (const entry of readdirSync(modulesDir)) {
	const pkgFile = resolve(modulesDir, entry, 'package.json');
	try {
		statSync(pkgFile);
	} catch {
		continue;
	}

	const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
	if (pkg.private) continue;

	const issues = [];
	for (const section of sections) {
		if (!pkg[section]) continue;
		for (const [name, spec] of Object.entries(pkg[section])) {
			if (spec.startsWith('file:') || spec.startsWith('workspace:')) {
				issues.push(`  ${section}.${name}: "${spec}"`);
			}
		}
	}

	if (issues.length > 0) {
		console.error(`FAIL  modules/${entry}/package.json`);
		issues.forEach((line) => console.error(line));
		found = true;
	} else {
		console.log(`ok    modules/${entry}`);
	}
}

if (found) {
	console.error('\nlocal-only deps (file: or workspace:) found in publishable packages.');
	process.exit(1);
} else {
	console.log('\nAll publishable modules are clean.');
}
