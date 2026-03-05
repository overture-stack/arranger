import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(currentDir, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };

export const SQON_SCHEMA_VERSION = packageJson.version || '0.0.0';
