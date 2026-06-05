import { z as zod } from 'zod';

import { createLogger } from '#utils/logger.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

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
 * Convert a comma-separated string of catalogue names into an array of trimmed strings, filtering out any empty values.
 * @param cataloguesString - A comma-separated string of catalogue names.
 * @returns An array of trimmed catalogue names.
 * @example
 * ```ts
 * parseCatalogueList('catalogue1,catalogue2,catalogue3') // returns ['catalogue1', 'catalogue2', 'catalogue3']
 * parseCatalogueList('catalogue1,, catalogue2, ,catalogue3,') // returns ['catalogue1', 'catalogue2', 'catalogue3']
 * ```
 */
const parseCatalogueList = (cataloguesString: string): string[] => {
	return cataloguesString
		.split(',')
		.map((catalogue) => catalogue.trim())
		.filter(Boolean);
};

/**
 * Zod schema for validating and parsing environment variables for the Arranger MCP server configuration.
 * This schema ensures that all required values are present and correctly formatted, and provides default values
 * where appropriate (i.e. for optional environment variables).
 */
const envSchema = zod.object({
	ARRANGER_BASE_URL: zod
		.string({
			message: 'ARRANGER_BASE_URL is required and must be a valid URL',
		})
		.url('ARRANGER_BASE_URL must be a valid URL')
		.transform(trimTrailingSlash),
	ARRANGER_CATALOGUES: zod
		.string({
			message: 'ARRANGER_CATALOGUES is required and must be a comma-separated list of catalogue names',
		})
		.min(1, 'ARRANGER_CATALOGUES is required and cannot be empty')
		.transform(parseCatalogueList),
	ARRANGER_REQUEST_TIMEOUT_MS: zod.preprocess(
		(value) => {
			if (typeof value === 'string') {
				// Remove underscores to allow for more human-friendly large numbers (e.g., "10_000" instead of "10000")
				return value.replace(/_/g, '');
			}
			return value;
		},
		zod.coerce
			.number({
				message: 'ARRANGER_REQUEST_TIMEOUT_MS must be a valid number',
			})
			.int('ARRANGER_REQUEST_TIMEOUT_MS must be an integer')
			.positive('ARRANGER_REQUEST_TIMEOUT_MS must be a positive number')
			.optional()
			.default(DEFAULT_REQUEST_TIMEOUT_MS),
	),
	MCP_HOST: zod.string().optional().default('0.0.0.0'),
	MCP_PORT: zod.coerce.number().int().positive().max(65535, 'MCP_PORT cannot exceed 65535').optional().default(3100),
	MCP_PATH: zod.string().optional().default('/mcp'),
	LOG_LEVEL: zod
		.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'], {
			message: 'LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal',
		})
		.optional()
		.default('info'),
});

/**
 * Zod schema for the Arranger MCP server configuration, derived from `envSchema`.
 * Transforms the validated env vars into a structured config object.
 */
const ArrangerMcpConfig = envSchema.transform((data) => ({
	arrangerBaseUrl: data.ARRANGER_BASE_URL,
	catalogues: data.ARRANGER_CATALOGUES,
	requestTimeoutMs: data.ARRANGER_REQUEST_TIMEOUT_MS,
	mcp: {
		host: data.MCP_HOST,
		port: data.MCP_PORT,
		path: data.MCP_PATH,
	},
}));
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
		const errorMessages = result.error.errors.map((err) => err.message).join('; ');
		logger.error(`Arranger configuration validation failed: ${errorMessages}`);
		logger.info('Exiting.');
		process.exit(1);
	}
	return result.data;
};
