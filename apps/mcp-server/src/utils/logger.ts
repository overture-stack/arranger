import pino, { type Logger, type LoggerOptions } from 'pino';
import pretty from 'pino-pretty';

/**
 * Create a pretty stream for pino that outputs colourized logs with timestamps in UTC ISO format, and excludes pid and
 * hostname from the log output. Logs are sent to stderr to keep stdout clean for potential MCP STDIO Transport.
 */
const createStream = () =>
	pretty({
		colorize: true,
		translateTime: 'UTC:yyyy-mm-dd"T"HH:MM:ss.l"Z"', // UTC time with ISO format, e.g., 2024-06-01T12:00:00.000Z
		ignore: 'pid,hostname',
		destination: 2, // stderr
	});

/**
 * Base logger options for all logger instances. The logger name is set to 'mcp-server' and the log level is determined
 * by the LOG_LEVEL environment variable, defaulting to 'info' if not set.
 */
const baseOptions: LoggerOptions = {
	name: 'mcp-server',
	level: process.env.LOG_LEVEL ?? 'info',
};

/**
 * Creates a pino logger instance with optional module name prefix. If a module name is provided, it will be included
 * as a prefix in all log messages from that logger instance.
 *
 * @param moduleName - Optional name of the module to include as a prefix in log messages.
 * @remarks If no module name is provided, the logger will not include any prefix in log messages.
 *
 * @returns A pino logger instance, optionally with a module name prefix in log messages.
 *
 * @example
 * ```ts
 * const logger = createLogger('MyModule');
 * logger.info('This is an info message'); // Output: [MyModule] This is an info message
 * ```
 */
export const createLogger = (moduleName?: string): Logger => {
	const logger = pino(baseOptions, createStream());

	if (!moduleName) {
		return logger;
	}

	return logger.child(
		{},
		{
			msgPrefix: `[${moduleName}] `,
		},
	);
};

/**
 * Default logger instance without a module name prefix for general use across the application.
 */
const logger = createLogger();

export default logger;
