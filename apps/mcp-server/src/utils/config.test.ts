import assert from 'node:assert';
import { after, afterEach, before, beforeEach, mock, suite, test } from 'node:test';

const ENV_KEYS = [
	'ARRANGER_BASE_URL',
	'ARRANGER_CATALOGUES',
	'ARRANGER_REQUEST_TIMEOUT_MS',
	'MCP_HOST',
	'MCP_PORT',
	'MCP_PATH',
	'MCP_ALLOWED_HOSTS',
	'MCP_ALLOWED_ORIGINS',
	'MCP_MAX_BODY_BYTES',
	'LOG_LEVEL',
] as const;

/** What an unset allowlist resolves to on a loopback bind, matching the SDK's own localhost guards. */
const LOCALHOST_ALLOWED = ['localhost', '127.0.0.1', '[::1]'];

// Redefining ArrangerMcpConfig type to avoid importing from config.ts before the logger module is mocked
type ArrangerMcpConfig = {
	arrangerBaseUrl: string;
	catalogues: string[];
	requestTimeoutMs: number;
	mcp: {
		host: string;
		port: number;
		path: string;
		allowedHosts: 'any' | string[];
		allowedOrigins: string[];
		maxBodyBytes: number;
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
				ARRANGER_CATALOGUES: 'catalogue-a, catalogue-b ,catalogue-c',
				ARRANGER_REQUEST_TIMEOUT_MS: '5_000',
				MCP_HOST: '127.0.0.1',
				MCP_PORT: '4200',
				MCP_PATH: '/custom-mcp',
				MCP_ALLOWED_HOSTS: 'mcp.example.com, arranger-mcp',
				MCP_ALLOWED_ORIGINS: 'portal.example.com',
				MCP_MAX_BODY_BYTES: '2_097_152',
				LOG_LEVEL: 'debug',
			});

			const config = createArrangerMcpConfig();

			assert.deepStrictEqual(config, {
				arrangerBaseUrl: 'https://arranger.example.com',
				catalogues: ['catalogue-a', 'catalogue-b', 'catalogue-c'],
				requestTimeoutMs: 5000,
				mcp: {
					host: '127.0.0.1',
					port: 4200,
					path: '/custom-mcp',
					allowedHosts: ['mcp.example.com', 'arranger-mcp'],
					allowedOrigins: ['portal.example.com'],
					maxBodyBytes: 2_097_152,
				},
			});
		});

		test('builds config with defaults for optional variables on a loopback bind', () => {
			setEnv({
				ARRANGER_BASE_URL: 'http://localhost:5050',
				ARRANGER_CATALOGUES: 'catalogue-a',
				MCP_HOST: '127.0.0.1',
			});

			const config = createArrangerMcpConfig();

			assert.deepStrictEqual(config, {
				arrangerBaseUrl: 'http://localhost:5050',
				catalogues: ['catalogue-a'],
				requestTimeoutMs: 10_000,
				mcp: {
					host: '127.0.0.1',
					port: 3100,
					path: '/mcp',
					allowedHosts: LOCALHOST_ALLOWED,
					allowedOrigins: LOCALHOST_ALLOWED,
					maxBodyBytes: 102_400,
				},
			});
		});

		test('trims a single trailing slash from ARRANGER_BASE_URL', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com/',
				ARRANGER_CATALOGUES: 'catalogue-a',
				MCP_HOST: '127.0.0.1',
			});

			const config = createArrangerMcpConfig();

			assert.strictEqual(config.arrangerBaseUrl, 'https://arranger.example.com');
		});

		test('filters empty entries from ARRANGER_CATALOGUES', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a,, catalogue-b, ,catalogue-c,',
				MCP_HOST: '127.0.0.1',
			});

			const config = createArrangerMcpConfig();

			assert.deepStrictEqual(config.catalogues, ['catalogue-a', 'catalogue-b', 'catalogue-c']);
		});
	});

	suite('missing required environment variables', () => {
		test('exits when ARRANGER_BASE_URL is missing', () => {
			setEnv({
				ARRANGER_CATALOGUES: 'catalogue-a',
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
				ARRANGER_CATALOGUES: 'catalogue-a',
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
				ARRANGER_CATALOGUES: 'catalogue-a',
				ARRANGER_REQUEST_TIMEOUT_MS: 'not-a-number',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_REQUEST_TIMEOUT_MS must be a valid number/);
		});

		test('exits when ARRANGER_REQUEST_TIMEOUT_MS is not an integer', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a',
				ARRANGER_REQUEST_TIMEOUT_MS: '1.5',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_REQUEST_TIMEOUT_MS must be an integer/);
		});

		test('exits when ARRANGER_REQUEST_TIMEOUT_MS is not positive', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a',
				ARRANGER_REQUEST_TIMEOUT_MS: '-100',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /ARRANGER_REQUEST_TIMEOUT_MS must be a positive number/);
		});

		test('exits when MCP_PORT exceeds 65535', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a',
				MCP_PORT: '70000',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /MCP_PORT cannot exceed 65535/);
		});

		test('exits when LOG_LEVEL is not one of the allowed values', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a',
				LOG_LEVEL: 'verbose',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /LOG_LEVEL must be one of: trace, debug, info, warn, error, fatal/);
		});

		test('exits when MCP_MAX_BODY_BYTES is not a number', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a',
				MCP_HOST: '127.0.0.1',
				MCP_MAX_BODY_BYTES: 'not-a-number',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /MCP_MAX_BODY_BYTES must be a valid number/);
		});

		test('exits when MCP_MAX_BODY_BYTES is not positive', () => {
			setEnv({
				ARRANGER_BASE_URL: 'https://arranger.example.com',
				ARRANGER_CATALOGUES: 'catalogue-a',
				MCP_HOST: '127.0.0.1',
				MCP_MAX_BODY_BYTES: '0',
			});

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /MCP_MAX_BODY_BYTES must be a positive number/);
		});
	});

	// The server binds every interface by default, and the SDK only warns about that. A warning is
	// the wrong volume for a DNS rebinding exposure that appears exactly when someone moves from a
	// laptop to a container, so configuration refuses to resolve instead.
	suite('Host allowlist safety', () => {
		const requiredEnv = {
			ARRANGER_BASE_URL: 'https://arranger.example.com',
			ARRANGER_CATALOGUES: 'catalogue-a',
		};

		test('exits when the default bind is used without MCP_ALLOWED_HOSTS', () => {
			setEnv(requiredEnv);

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /MCP_HOST is "0\.0\.0\.0".*MCP_ALLOWED_HOSTS is not set/);
		});

		test('exits when a routable bind is used without MCP_ALLOWED_HOSTS', () => {
			setEnv({ ...requiredEnv, MCP_HOST: '10.1.2.3' });

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.strictEqual(exitCode, 1);
			assert.match(errorLogs.join(''), /MCP_HOST is "10\.1\.2\.3"/);
		});

		test('names the escape hatch in the failure message', () => {
			setEnv(requiredEnv);

			assert.throws(() => createArrangerMcpConfig(), /__process_exit__/);
			assert.match(errorLogs.join(''), /MCP_ALLOWED_HOSTS=\*/);
		});

		for (const host of ['127.0.0.1', 'localhost', '::1']) {
			test(`resolves the localhost allowlists for a ${host} bind with no allowlist set`, () => {
				setEnv({ ...requiredEnv, MCP_HOST: host });

				const { mcp } = createArrangerMcpConfig();

				assert.deepStrictEqual(mcp.allowedHosts, LOCALHOST_ALLOWED);
				assert.deepStrictEqual(mcp.allowedOrigins, LOCALHOST_ALLOWED);
			});
		}

		test('accepts a routable bind once MCP_ALLOWED_HOSTS names the hostnames', () => {
			setEnv({ ...requiredEnv, MCP_HOST: '0.0.0.0', MCP_ALLOWED_HOSTS: 'arranger-mcp, mcp.example.org' });

			const { mcp } = createArrangerMcpConfig();

			assert.deepStrictEqual(mcp.allowedHosts, ['arranger-mcp', 'mcp.example.org']);
		});

		test('treats MCP_ALLOWED_HOSTS=* as delegating Host validation to a gateway', () => {
			setEnv({ ...requiredEnv, MCP_HOST: '0.0.0.0', MCP_ALLOWED_HOSTS: '*' });

			const { mcp } = createArrangerMcpConfig();

			assert.strictEqual(mcp.allowedHosts, 'any');
		});

		// An unset value is an empty allowlist rather than a disabled check: the Origin guard passes
		// requests carrying no `Origin`, which is every non-browser MCP client, and rejects the rest.
		test('leaves MCP_ALLOWED_ORIGINS empty on a routable bind when it is not set', () => {
			setEnv({ ...requiredEnv, MCP_HOST: '0.0.0.0', MCP_ALLOWED_HOSTS: 'arranger-mcp' });

			const { mcp } = createArrangerMcpConfig();

			assert.deepStrictEqual(mcp.allowedOrigins, []);
		});
	});
});
