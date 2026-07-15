import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SQON_SCHEMA_VERSION = '0.0.0';

const readPackageVersion = (): string => {
	try {
		const metaUrl = import.meta.url;
		if (!metaUrl) return DEFAULT_SQON_SCHEMA_VERSION;
		const currentDir = path.dirname(fileURLToPath(metaUrl));
		const json = JSON.parse(readFileSync(path.resolve(currentDir, '../../package.json'), 'utf8')) as {
			version?: string;
		};
		return json.version ?? DEFAULT_SQON_SCHEMA_VERSION;
	} catch {
		return DEFAULT_SQON_SCHEMA_VERSION;
	}
};

const SQON_SCHEMA_VERSION = readPackageVersion();

export default SQON_SCHEMA_VERSION;
