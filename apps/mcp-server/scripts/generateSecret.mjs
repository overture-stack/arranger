#!/usr/bin/env node
/**
 * Generates the HMAC key `MCP_REQUEST_STATE_SECRET` and writes it into this app's `.env`.
 *
 * Usage, from `apps/mcp-server`:
 *   npm run generate-secret             write a fresh key into .env, printing nothing
 *   npm run generate-secret:print       print a key to stdout and write nothing
 *   npm run generate-secret -- --force  overwrite a key .env already has
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Matches the codec's minimum once base64-encoded: 32 bytes becomes 44 ASCII characters. */
const KEY_BYTES = 32;

const VARIABLE = 'MCP_REQUEST_STATE_SECRET';

const envPath = join(dirname(dirname(fileURLToPath(import.meta.url))), '.env');
const args = new Set(process.argv.slice(2));
const key = randomBytes(KEY_BYTES).toString('base64');

// Printed only when asked, so a key written for local development does not linger in terminal
// scrollback or a CI log. `--print` is for producing one to paste into a secrets manager.
if (args.has('--print')) {
	process.stdout.write(`${key}\n`);
	process.exit(0);
}

let contents;
try {
	contents = readFileSync(envPath, 'utf8');
} catch {
	console.error(`No .env found at ${envPath}.\nCreate one first:  cp .env.schema .env`);
	process.exit(1);
}

// Anchored per line so a commented-out entry is left alone rather than rewritten.
const assignment = new RegExp(`^${VARIABLE}=(.*)$`, 'm');
const existing = assignment.exec(contents);

if (existing && existing[1].trim() !== '' && !args.has('--force')) {
	console.error(`${VARIABLE} already has a value in .env. Re-run with --force to replace it.`);
	process.exit(1);
}

writeFileSync(
	envPath,
	existing
		? contents.replace(assignment, `${VARIABLE}=${key}`)
		: `${contents.replace(/\n*$/, '\n')}${VARIABLE}=${key}\n`,
);

console.log(`Wrote a new ${VARIABLE} to .env.`);
