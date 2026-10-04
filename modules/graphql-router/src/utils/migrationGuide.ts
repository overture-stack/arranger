import { createRequire } from 'node:module';

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

// The same path from src/utils and from the built dist/utils: both sit two levels below the package root.
const packageJson: unknown = createRequire(import.meta.url)('../../package.json');
const packageVersion = isRecord(packageJson) && typeof packageJson.version === 'string' ? packageJson.version : '';

/**
 * The 3.1 migration guide, pinned to this release's tag so a link printed by this version keeps
 * describing it. A development build, which has no tag, links to the main branch.
 */
export const MIGRATION_GUIDE_URL = `https://github.com/overture-stack/arranger/blob/${
	packageVersion && packageVersion !== '0.0.0-dev' ? `graphql-router-v${packageVersion}` : 'main'
}/docs/reference/08-Migration/v3.1.md`;
