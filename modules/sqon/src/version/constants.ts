import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SQON_SCHEMA_VERSION = '0.0.0';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(currentDir, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };

const SQON_SCHEMA_VERSION = packageJson.version || DEFAULT_SQON_SCHEMA_VERSION;

export default SQON_SCHEMA_VERSION;
