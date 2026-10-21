import { startupRefusal } from './enableAccessControl.js';

/** The Usher bridge's configuration as the environment sets it, its logger aside. */
export type UsherBridgeEnv = Readonly<{
	audience: string;
	controllerUrl: string;
	eventSource: string;
	/** The most clauses a filter the bridge renders may hold, the bridge's own default when unset. */
	filterClauseLimit?: number;
	issuer: string;
	key: string;
	payloadVersions: [number, ...number[]];
}>;

/** The required variables, in the order a refusal lists them. */
const REQUIRED_VARIABLES = [
	'USHER_APPLICATION_KEY',
	'USHER_AUDIENCE',
	'USHER_CONTROLLER_URL',
	'USHER_EVENT_SOURCE',
	'USHER_ISSUER',
] as const;

const DEFAULT_PAYLOAD_VERSIONS: [number, ...number[]] = [1];

/** USHER_PAYLOAD_VERSIONS read as a comma list of positive integers, the default when unset, or undefined when malformed. */
const payloadVersionsFrom = (rawValue: string | undefined): [number, ...number[]] | undefined => {
	if (rawValue === undefined || rawValue.trim() === '') {
		return DEFAULT_PAYLOAD_VERSIONS;
	}

	const parts = rawValue.split(',').map((part) => part.trim());
	const [first, ...rest] = parts.map(Number);

	return first !== undefined && parts.every((part) => /^[1-9][0-9]*$/.test(part)) ? [first, ...rest] : undefined;
};

/** A clause limit as ACCESS_CONTROL_FILTER_CLAUSE_LIMIT sets it: a positive integer, none when unset, or malformed. */
type ClauseLimitReading = Readonly<{ kind: 'malformed' }> | Readonly<{ kind: 'read'; value?: number }>;

/** ACCESS_CONTROL_FILTER_CLAUSE_LIMIT read as a positive integer, none when unset or blank. */
const filterClauseLimitFrom = (rawValue: string | undefined): ClauseLimitReading => {
	const trimmed = rawValue?.trim() ?? '';

	if (trimmed === '') {
		return { kind: 'read' };
	}

	const value = Number(trimmed);

	return /^[1-9][0-9]*$/.test(trimmed) && Number.isSafeInteger(value)
		? { kind: 'read', value }
		: { kind: 'malformed' };
};

/**
 * Reads the Usher bridge's configuration from the environment, which the image does only while
 * ENABLE_ACCESS_CONTROL is true. USHER_PAYLOAD_VERSIONS and ACCESS_CONTROL_FILTER_CLAUSE_LIMIT are optional;
 * every other variable is required. The clause limit is raised only with the search engine's own
 * `max_clause_count` and never above it, so a filter too large is denied by the bridge before the engine fails it.
 * A refusal names each variable missing or malformed and never a value, since USHER_APPLICATION_KEY
 * is a secret.
 *
 * @param env the environment to read, the process's own by default.
 * @throws {Error} logged as `access_control.startup_refused`, when a variable is missing or malformed.
 */
export const readUsherBridgeEnv = (env: NodeJS.ProcessEnv = process.env): UsherBridgeEnv => {
	const valueOf = (name: string): string => env[name]?.trim() ?? '';
	const missing = REQUIRED_VARIABLES.filter((name) => valueOf(name) === '');
	const payloadVersions = payloadVersionsFrom(env.USHER_PAYLOAD_VERSIONS);
	const filterClauseLimit = filterClauseLimitFrom(env.ACCESS_CONTROL_FILTER_CLAUSE_LIMIT);

	if (missing.length > 0 || payloadVersions === undefined || filterClauseLimit.kind === 'malformed') {
		const problems = [
			...(missing.length > 0 ? [`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} unset`] : []),
			...(payloadVersions === undefined
				? ['USHER_PAYLOAD_VERSIONS is not a comma list of positive integers']
				: []),
			...(filterClauseLimit.kind === 'malformed'
				? ['ACCESS_CONTROL_FILTER_CLAUSE_LIMIT is not a positive integer']
				: []),
		];

		throw startupRefusal(
			`ENABLE_ACCESS_CONTROL is true, which needs the Usher bridge's configuration, and ${problems.join(', and ')}.`,
		);
	}

	return {
		audience: valueOf('USHER_AUDIENCE'),
		controllerUrl: valueOf('USHER_CONTROLLER_URL'),
		eventSource: valueOf('USHER_EVENT_SOURCE'),
		...(filterClauseLimit.value === undefined ? {} : { filterClauseLimit: filterClauseLimit.value }),
		issuer: valueOf('USHER_ISSUER'),
		key: valueOf('USHER_APPLICATION_KEY'),
		payloadVersions,
	};
};
