import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { suite, test } from 'node:test';

import { ARRANGER_LOCALS_KEY, keepRequestContextView, REQUEST_STATE_MIGRATION_URL, requestStateOf } from './context.js';

type FakeRequest = { context?: unknown };
type FakeResponse = { locals: Record<string, unknown> };

const RECORD = Symbol('record');

/** Runs the view's middleware over a request and response shaped as Express gives them. */
const viewOver = (req: FakeRequest = {}, res: FakeResponse = { locals: {} }) => {
	keepRequestContextView(req as never, res as never, () => undefined);

	return { req, res };
};

suite('req.context as a view of res.locals.arranger', () => {
	test("reading req.context returns the request's Arranger namespace itself", () => {
		const { req, res } = viewOver();

		assert.equal(req.context, res.locals[ARRANGER_LOCALS_KEY]);
	});

	test('a plain req.context an application set before the router is folded into the namespace, symbol keys included', () => {
		// Given an application that wrote its own keys to req.context, a symbol among them
		const { res } = viewOver({ context: { [RECORD]: 'recorded', user: 'an application key' } });

		// When the view is installed, Then the namespace holds every one of them
		assert.deepEqual(res.locals[ARRANGER_LOCALS_KEY], { [RECORD]: 'recorded', user: 'an application key' });
	});

	test("assigning an object to req.context merges its keys into the namespace, as addContext's pattern does", () => {
		const { req, res } = viewOver({ context: { kept: true } });

		req.context = { ...(req.context as object), added: true };

		assert.deepEqual(res.locals[ARRANGER_LOCALS_KEY], { added: true, kept: true });
	});

	test('a second router on the same request keeps the first namespace', () => {
		const { req, res } = viewOver({ context: { kept: true } });
		const namespace = res.locals[ARRANGER_LOCALS_KEY];

		viewOver(req, res);

		assert.equal(res.locals[ARRANGER_LOCALS_KEY], namespace);
		assert.equal(req.context, namespace);
	});
});

suite('requestStateOf', () => {
	test("merges an application's res.locals keys beneath Arranger's own", () => {
		const state = requestStateOf({
			[ARRANGER_LOCALS_KEY]: { configs: 'router', usher: 'router' },
			usher: 'application',
		});

		assert.deepEqual(state, { configs: 'router', usher: 'router' });
	});

	test("keeps an application's own key when Arranger's namespace does not hold it", () => {
		const state = requestStateOf({ [ARRANGER_LOCALS_KEY]: { configs: 'router' }, usher: 'application' });

		assert.deepEqual(state, { configs: 'router', usher: 'application' });
	});

	test("keeps symbol keys from both stores, such as the router's access-control record, through repeated passes", () => {
		// Given res.locals holding a symbol key of the application's and one in Arranger's namespace
		const APPLICATION_KEY = Symbol('application');
		const locals = { [ARRANGER_LOCALS_KEY]: { [RECORD]: 'router' }, [APPLICATION_KEY]: 'application' };

		// When it passes through requestStateOf once, and again, as an export's route, dataStream and getAllData pass it on
		const once = requestStateOf(locals);
		const twice = requestStateOf(once);

		// Then both symbol keys hold their values after each pass
		[once, twice].forEach((state) => {
			assert.equal(state[RECORD], 'router');
			assert.equal(state[APPLICATION_KEY], 'application');
		});
	});

	test('returns a context with no Arranger namespace as it is, and an absent one as empty', () => {
		const context = { configs: 'built some other way' };

		assert.equal(requestStateOf(context), context);
		assert.deepEqual(requestStateOf(undefined), {});
	});
});

suite('the req.context deprecation warning', () => {
	const contextModule = fileURLToPath(new URL('./context.ts', import.meta.url));

	/** Runs `body` in a fresh process with the module loaded as `context`, returning what it wrote to stderr, after checking it ran cleanly. */
	const warningsFrom = (body: string): string => {
		const { status, stderr } = spawnSync(
			process.execPath,
			[
				'--import',
				'tsx',
				'--input-type=module',
				'-e',
				`const context = await import(${JSON.stringify(contextModule)});\n${body}`,
			],
			{ encoding: 'utf8' },
		);
		assert.equal(status, 0, stderr);

		return stderr;
	};

	test('is emitted once per process, naming res.locals and linking the migration guide', () => {
		// Given two requests whose application code reads and writes req.context
		const stderr = warningsFrom(`
			for (const run of [1, 2]) {
				const req = {};
				const res = { locals: {} };
				context.keepRequestContextView(req, res, () => undefined);
				req.context.user = run;
				void req.context;
			}
		`);

		// Then one warning was emitted, under its code, with the replacement and the guide
		assert.equal(stderr.match(/\[ARRANGER_REQ_CONTEXT\] DeprecationWarning/g)?.length, 1, stderr);
		assert.match(stderr, /res\.locals/);
		assert.ok(stderr.includes(REQUEST_STATE_MIGRATION_URL), stderr);
	});

	test("is not emitted when only the router's own code runs", () => {
		const stderr = warningsFrom(`
			const req = {};
			const res = { locals: {} };
			context.keepRequestContextView(req, res, () => undefined);
			context.addArrangerLocals({ configs: 'router' })(req, res, () => undefined);
			context.requestStateOf(res.locals);
		`);

		assert.doesNotMatch(stderr, /ARRANGER_REQ_CONTEXT/);
	});
});
