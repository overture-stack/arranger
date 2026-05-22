import assert from 'node:assert';
import { after, afterEach, before, beforeEach, mock, suite, test } from 'node:test';

const ENV_KEYS = [
	'ARRANGER_BASE_URL',
	'ARRANGER_CATALOGUES',
	'ARRANGER_REQUEST_TIMEOUT_MS',
	'MCP_HOST',
	'MCP_PORT',
	'MCP_PATH',
	'LOG_LEVEL',
] as const;

// Redefining ArrangerMcpConfig type to avoid importing from config.ts before the logger module is mocked
type ArrangerMcpConfig = {
	arrangerBaseUrl: string;
	catalogues: string[];
	requestTimeoutMs: number;
	mcp: {
		host: string;
		port: number;
		path: string;
	};
};

const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

/**
 * Sets env vars for tests, ensuring that any keys already defined in `ENV_KEYS` are cleared before applying overrides.
 * @param overrides - Object containing env var values to set for the test. Keys should be from `ENV_KEYS`.
 * @remark Use `undefined` to explicitly unset a variable.
 * @remark This function does not restore original env vars after the test.
 */
const setEnv = (overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) => {
	for (const key of ENV_KEYS) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete process.env[key];
	}
	for (const [key, value] of Object.entries(overrides)) {
		if (value !== undefined) {
			process.env[key] = value;
		}
	}
};

suite('createArrangerMcpConfig', () => {
	const errorLogs: string[] = [];
	let loggerMock: ReturnType<typeof mock.module>;
	let exitMock: ReturnType<typeof mock.method>;
	let createArrangerMcpConfig: () => ArrangerMcpConfig;
	let exitCode = 0;

	before(async () => {
		// Mock the logger module **before** importing createArrangerMcpConfig
		loggerMock = mock.module('#utils/logger.js', {
			namedExports: {
				createLogger: () => ({
					error: (msg: string) => {
						errorLogs.push(msg);
					},
					info: mock.fn(),
				}),
			},
		});

		// Prevent the real process.exit from killing the test runner
		exitMock = mock.method(process, 'exit', (code?: number) => {
			exitCode = code ?? 0;
			throw new Error('__process_exit__');
		});

		// Dynamic import **after** the logger mock is registered, so that createArrangerMcpConfig uses the mocked logger
		({ createArrangerMcpConfig } = await import('#utils/config.js'));
	});

	beforeEach(() => {
		// Capture original env vars before each test so they can be restored in afterEach
		for (const key of ENV_KEYS) {
			originalEnv[key] = process.env[key];
		}
		// Reset captured logs and exit code before each test
		errorLogs.length = 0;
		exitCode = 0;
	});

	after(() => {
		loggerMock.restore();
		exitMock.mock.restore();
	});

	afterEach(() => {
		// Restore original env vars after each test to avoid side effects
		for (const key of ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
	});

	suite('successful configuration', () => {
		test('builds config from process.env when all variables provided and valid', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com/',
				ARRANGER_CATALOGUES: 'catalog-a, catalog-b ,catalog-c',
				ARRANGER_REQUEST_TIMEOUT_MS: '5_000',
				MCP_HOST: '127.0.0.1',
				MCP_PORT: '4200',
				MCP_PATH: '/custom-mcp',
				LOG_LEVEL: 'debug',
			});

			const config = createArrangerMcpConfig();

			assert.deepStrictEqual(config, {
				arrangerBaseUrl: 'https://arranger.example.com',
				catalogues: ['catalog-a', 'catalog-b', 'catalog-c'],
				requestTimeoutMs: 5000,
				mcp: {
					host: '127.0.0.1',
					port: 4200,
					path: '/custom-mcp',
				},
			});
		});

		test('builds config with defaults for optional variables when only required variables are provided', () => {
			setEnv({
				ARRANGER_BASE_URL: 'http://localhost:5050',
				ARRANGER_CATALOGUES: 'catalog-a',
			});

			const config = createArrangerMcpConfig();

			assert.deepStrictEqual(config, {
				arrangerBaseUrl: 'http://localhost:5050',
				catalogues: ['catalog-a'],
				requestTimeoutMs: 10_000,
				mcp: {
					host: '0.0.0.0',
					port: 3100,
					path: '/mcp',
				},
			});
		});

		test('trims a single trailing slash from ARRANGER_BASE_URL', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com/',
				ARRANGER_CATALOGUES: 'catalog-a',
			});

			const config = createArrangerMcpConfig();

			assert.strictEqual(config.arrangerBaseUrl, 'https://arranger.example.com');
		});

		test('filters empty entries from ARRANGER_CATALOGUES', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalog-a,, catalog-b, ,catalog-c,',
			});

			const config = createArrangerMcpConfig();

			assert.deepStrictEqual(config.catalogues, ['catalog-a', 'catalog-b', 'catalog-c']);
		});
	});

	suite('missing required environment variables', () => {
		test('exits when ARRANGER_BASE_URL is missing', () => {
			setEnv({
				ARRANGER_CATALOGUES: 'catalog-a',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_BASE_URL is required and must be a valid URL/);
		});

		test('exits when ARRANGER_CATALOGUES is missing', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(
				errorLogs.join(''),
				/ARRANGER_CATALOGUES is required and must be a comma-separated list of catalogue names/,
			);
		});

		test('exits when both required variables are missing', () => {
			setEnv({});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			const combined = errorLogs.join('');
			assert.match(combined, /ARRANGER_BASE_URL/);
			assert.match(combined, /ARRANGER_CATALOGUES/);
		});
	});

	suite('invalid environment variables', () => {
		test('exits when ARRANGER_BASE_URL is not a valid URL', () => {
			setEnv({
				ARRANGER_BASE_URL: 'not-a-url',
				ARRANGER_CATALOGUES: 'catalog-a',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_BASE_URL must be a valid URL/);
		});

		test('exits when ARRANGER_CATALOGUES is an empty string', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: '',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_CATALOGUES is required and cannot be empty/);
		});

		test('exits when ARRANGER_REQUEST_TIMEOUT_MS is not a number', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalog-a',
				ARRANGER_REQUEST_TIMEOUT_MS: 'not-a-number',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_REQUEST_TIMEOUT_MS must be a valid number/);
		});

		test('exits when ARRANGER_REQUEST_TIMEOUT_MS is not an integer', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalog-a',
				ARRANGER_REQUEST_TIMEOUT_MS: '1.5',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_REQUEST_TIMEOUT_MS must be an integer/);
		});

		test('exits when ARRANGER_REQUEST_TIMEOUT_MS is not positive', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalog-a',
				ARRANGER_REQUEST_TIMEOUT_MS: '-100',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_REQUEST_TIMEOUT_MS must be a positive number/);
		});

		test('exits when MCP_PORT exceeds 65535', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalog-a',
				MCP_PORT: '70000',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /MCP_PORT cannot exceed 65535/);
		});

		test('exits when LOG_LEVEL is not one of the allowed values', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalog-a',
				LOG_LEVEL: 'verbose',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal/);
		});
	});
});
