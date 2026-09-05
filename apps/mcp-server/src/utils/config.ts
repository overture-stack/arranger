import { z as zod } from 'zod';

import { createLogger } from '#utils/logger.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Ceiling on a request body, preserving the `100kb` that `express.json()` applied before this app
 * served MCP on plain `node:http` (which does not automatically enforce a limit on its own).
 */
const DEFAULT_MAX_BODY_BYTES = 102_400;

/** Bind addresses that are only reachable from this host, so a Host allowlist is not required. */
const LOCALHOST_HOSTNAMES = ['127.0.0.1', 'localhost', '::1'];

/**
 * Hostnames the SDK's own localhost guards allow. `[::1]` is bracketed because both guards compare
 * against `new URL(...).hostname`, which brackets IPv6 literals.
 */
const LOCALHOST_ALLOWED_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

/** `MCP_ALLOWED_HOSTS` value meaning "an upstream gateway validates the Host header, do not". */
const ALLOW_ANY_HOST = '*';

/**
 * Shortest `MCP_REQUEST_STATE_SECRET` the HMAC codec accepts, below which it throws a `RangeError`.
 * Counted in UTF-8 bytes because that is what the codec counts, and that is not the same as
 * characters once the value leaves ASCII: an accented letter is two bytes, an emoji four.
 */
const MIN_REQUEST_STATE_SECRET_BYTES = 32;

const logger = createLogger('Config');

/**
 * Utility function to trim trailing slashes from a URL string.
 * @param value - The URL string to trim.
 * @returns The input string with any trailing slashes removed.
 * @example
 * ```ts
 * trimTrailingSlash('https://example.com/') // returns 'https://example.com'
 * trimTrailingSlash('https://example.com/path/') // returns 'https://example.com/path'
 * ```
 */
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * Convert a comma-separated string into an array of trimmed strings, filtering out any empty values.
 * @param value - A comma-separated string.
 * @returns An array of trimmed entries.
 * @example
 * ```ts
 * parseCommaSeparatedList('a,b,c') // returns ['a', 'b', 'c']
 * parseCommaSeparatedList('a,, b, ,c,') // returns ['a', 'b', 'c']
 * ```
 */
const parseCommaSeparatedList = (value: string): string[] => {
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
};

/**
 * Strips underscores from a numeric environment variable so large values can be written in a
 * human-friendly form (`102_400`), leaving non-string input untouched for Zod to coerce.
 */
const stripNumericSeparators = (value: unknown): unknown =>
	typeof value === 'string' ? value.replace(/_/g, '') : value;

/**
 * Zod schema for validating and parsing environment variables for the Arranger MCP server configuration.
 * This schema ensures that all required values are present and correctly formatted, and provides default values
 * where appropriate (i.e. for optional environment variables).
 */
const envSchema = zod.object({
	// A function error keeps the two messages `zod.string().url()` produced separately: unset, and
	// set but not a URL.
	ARRANGER_BASE_URL: zod
		.url({
			error: (issue) =>
				issue.input === undefined
					? 'ARRANGER_BASE_URL is required and must be a valid URL'
					: 'ARRANGER_BASE_URL must be a valid URL',
		})
		.transform(trimTrailingSlash),
	ARRANGER_CATALOGUES: zod
		.string({
			error: 'ARRANGER_CATALOGUES is required and must be a comma-separated list of catalogue names',
		})
		.min(1, 'ARRANGER_CATALOGUES is required and cannot be empty')
		.transform(parseCommaSeparatedList),
	ARRANGER_REQUEST_TIMEOUT_MS: zod.preprocess(
		stripNumericSeparators,
		zod.coerce
			.number({
				error: 'ARRANGER_REQUEST_TIMEOUT_MS must be a valid number',
			})
			.int('ARRANGER_REQUEST_TIMEOUT_MS must be an integer')
			.positive('ARRANGER_REQUEST_TIMEOUT_MS must be a positive number')
			.optional()
			.default(DEFAULT_REQUEST_TIMEOUT_MS),
	),
	MCP_HOST: zod.string().optional().default('0.0.0.0'),
	MCP_PORT: zod.coerce.number().int().positive().max(65535, 'MCP_PORT cannot exceed 65535').optional().default(3100),
	MCP_PATH: zod.string().optional().default('/mcp'),
	MCP_ALLOWED_HOSTS: zod.string().optional().default(''),
	MCP_ALLOWED_ORIGINS: zod.string().optional().default(''),
	// An empty value reads as unset rather than as a too-short key: `.env.schema` lists the variable
	// blank, and blank is the supported single-replica default.
	MCP_REQUEST_STATE_SECRET: zod.preprocess(
		(value) => (value === '' ? undefined : value),
		zod
			.string()
			.refine(
				(value) => Buffer.byteLength(value, 'utf8') >= MIN_REQUEST_STATE_SECRET_BYTES,
				`MCP_REQUEST_STATE_SECRET must be at least ${MIN_REQUEST_STATE_SECRET_BYTES} bytes`,
			)
			.optional(),
	),
	MCP_MAX_BODY_BYTES: zod.preprocess(
		stripNumericSeparators,
		zod.coerce
			.number({ error: 'MCP_MAX_BODY_BYTES must be a valid number' })
			.int('MCP_MAX_BODY_BYTES must be an integer')
			.positive('MCP_MAX_BODY_BYTES must be a positive number')
			.optional()
			.default(DEFAULT_MAX_BODY_BYTES),
	),
	LOG_LEVEL: zod
		.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'], {
			error: 'LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal',
		})
		.optional()
		.default('info'),
});

/**
 * Resolves `MCP_ALLOWED_HOSTS` into the list the Host guard is built from.
 *
 * An unset value on a loopback bind resolves to the localhost hostnames rather than to an empty
 * list, matching what the SDK's own adapters do for a localhost bind. On a routable bind it
 * resolves to an empty list, which the refinement below then refuses, so an empty list never
 * reaches the Host guard.
 * @returns `'any'` when Host validation is delegated to an upstream gateway, otherwise the allowed
 * hostnames.
 */
const resolveAllowedHosts = (rawValue: string, host: string): 'any' | string[] => {
	const allowedHosts = parseCommaSeparatedList(rawValue);
	if (allowedHosts.includes(ALLOW_ANY_HOST)) {
		return 'any';
	}
	if (allowedHosts.length > 0) {
		return allowedHosts;
	}
	return LOCALHOST_HOSTNAMES.includes(host) ? LOCALHOST_ALLOWED_HOSTNAMES : [];
};

/**
 * Resolves `MCP_ALLOWED_ORIGINS` into the list the Origin guard is built from.
 *
 * An empty list is a live check rather than a disabled one: the guard passes requests carrying no
 * `Origin` (which is every non-browser MCP client) and rejects any browser origin. As with hosts, an
 * unset value on a loopback bind resolves to the localhost origins so browser-based tooling works
 * against a local server.
 */
const resolveAllowedOrigins = (rawValue: string, host: string): string[] => {
	const allowedOrigins = parseCommaSeparatedList(rawValue);
	if (allowedOrigins.length > 0) {
		return allowedOrigins;
	}
	return LOCALHOST_HOSTNAMES.includes(host) ? LOCALHOST_ALLOWED_HOSTNAMES : [];
};

/**
 * Zod schema for the Arranger MCP server configuration, derived from `envSchema`.
 * Transforms the validated env vars into a structured config object.
 */
const ArrangerMcpConfig = envSchema
	.transform((data) => ({
		arrangerBaseUrl: data.ARRANGER_BASE_URL,
		catalogues: data.ARRANGER_CATALOGUES,
		requestTimeoutMs: data.ARRANGER_REQUEST_TIMEOUT_MS,
		mcp: {
			host: data.MCP_HOST,
			port: data.MCP_PORT,
			path: data.MCP_PATH,
			allowedHosts: resolveAllowedHosts(data.MCP_ALLOWED_HOSTS, data.MCP_HOST),
			allowedOrigins: resolveAllowedOrigins(data.MCP_ALLOWED_ORIGINS, data.MCP_HOST),
			requestStateSecret: data.MCP_REQUEST_STATE_SECRET,
			maxBodyBytes: data.MCP_MAX_BODY_BYTES,
		},
	}))
	// Refuse to start rather than warn. Binding a routable interface with no Host allowlist leaves
	// the server open to DNS rebinding, and it is exactly the configuration an operator reaches for
	// when moving from a laptop into a container, so a warning would be read as noise.
	.superRefine(({ mcp }, ctx) => {
		if (mcp.allowedHosts === 'any' || mcp.allowedHosts.length > 0 || LOCALHOST_HOSTNAMES.includes(mcp.host)) {
			return;
		}
		ctx.addIssue(
			`MCP_HOST is "${mcp.host}", which is reachable from outside this machine, but MCP_ALLOWED_HOSTS is not set. ` +
				'Set MCP_ALLOWED_HOSTS to the hostname(s) clients use to reach this server ' +
				'(for example "arranger-mcp,mcp.example.org"), or set MCP_ALLOWED_HOSTS=* if an upstream gateway ' +
				'validates the Host header. Binding a routable interface without either is a DNS rebinding risk.',
		);
	});
export type ArrangerMcpConfig = zod.infer<typeof ArrangerMcpConfig>;

/**
 * Validates and parses environment variables to create the Arranger MCP server configuration object.
 * If validation fails, logs detailed error messages and exits the process.
 * @returns - A validated and structured ArrangerMcpConfig object derived from env vars.
 * @remarks - This function will terminate the process if any required environment variables are missing or invalid.
 */
export const createArrangerMcpConfig = (): ArrangerMcpConfig => {
	const result = ArrangerMcpConfig.safeParse(process.env);
	if (!result.success) {
		const errorMessages = result.error.issues.map((issue) => issue.message).join('; ');
		logger.error(`Arranger configuration validation failed: ${errorMessages}`);
		logger.info('Exiting.');
		process.exit(1);
	}
	return result.data;
};
