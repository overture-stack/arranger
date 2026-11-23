import type { Enforcement } from '@overture-stack/usher-types';

type Results = Readonly<Record<string, Enforcement>>;

const ALLOW: Enforcement = { kind: 'allow' };

/**
 * The two maps an access outcome takes, for a principal whose artifact creation is allowed in every catalogue
 * the given results name. The Bridge requires both maps to hold exactly the same keys.
 *
 * @param results each catalogue's view result, keyed by catalogue.
 */
export const withArtifactCreateAllowed = (results: Results) => ({
	artifactCreate: Object.fromEntries(Object.keys(results).map((catalogue) => [catalogue, ALLOW])),
	results,
});
