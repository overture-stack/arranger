import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { includeEverything } from '@overture-stack/arranger-graphql-router';
import { ANSWERS, RETRY_AFTER_SECONDS } from '@overture-stack/usher-express-bridge';
import { attachAccess, type Enforcement, UsherContractError } from '@overture-stack/usher-types';

import {
	accessOf,
	ANONYMOUS,
	createFakeBridge,
	createRecordingLogger,
	createStubProbe,
	DENIAL_KINDS,
	DENIED_ERROR_NAME,
	DENY_REASONS,
	type DenyReason,
	INDEX_MAPPING,
	isConfigurationRefusal,
	RECORDS_REGISTRATION,
	ROWS,
	signedIn,
	SUSPENDED,
	UNAVAILABLE_ERROR_NAME,
} from './testing/index.js';

import { createUsherAccessControl, UNAVAILABLE_ANSWER, type UsherFilterCallback } from './index.js';

/** The callback for the `records` catalogue, verified, as the host hands it to that catalogue's router. */
const verifiedCallback = async (): Promise<UsherFilterCallback> => {
	const bridge = createFakeBridge({ anonymous: { records: ROWS.anonymousBaselineOn.result }, principals: {} });
	const { logger } = createRecordingLogger();
	const accessControl = createUsherAccessControl({
		bridge: bridge.core,
		catalogues: { records: RECORDS_REGISTRATION },
		logger,
	});
	await accessControl.verify({ records: { mapping: INDEX_MAPPING, probe: createStubProbe().probe } });
	return accessControl.filterFor('records');
};

/** A request's store holding the access the bridge's layer attaches, with these results. */
const localsHolding = (results: Readonly<Record<string, Enforcement>>): Record<string, unknown> => {
	const locals = {};
	attachAccess(locals, accessOf(ANONYMOUS, results));
	return locals;
};

/** Asserts `run` throws the GraphQL router's denial of the `records` catalogue, of `kind`. */
const assertDenied = (run: () => unknown, kind: string): void => {
	assert.throws(run, (error: unknown) => {
		assert.ok(error instanceof Error);
		assert.equal(error.name, DENIED_ERROR_NAME);
		assert.deepEqual(
			{ catalogue: (error as { catalogue?: unknown }).catalogue, kind: (error as { kind?: unknown }).kind },
			{ catalogue: 'records', kind },
		);
		return true;
	});
};

suite('the callback, as a pure function of the request store', () => {
	test("returns a narrow result's filter unchanged", async () => {
		// Given a request whose access narrows this catalogue
		const callback = await verifiedCallback();
		const locals = localsHolding({ records: ROWS.heartControlledGrant.result });

		// When the callback runs
		const filter = callback({ locals }, { readPath: 'hits' });

		// Then it returns the result's filter as it is
		assert.equal(ROWS.heartControlledGrant.result.kind, 'narrow');
		assert.deepEqual(
			filter,
			ROWS.heartControlledGrant.result.kind === 'narrow' ? ROWS.heartControlledGrant.result.sqon : null,
		);
	});

	for (const [reason, description] of Object.entries(DENY_REASONS) as [DenyReason, string][]) {
		test(`throws the GraphQL router's denial of the catalogue, of the kind its reason maps to, for a deny for ${description}`, async () => {
			// Given a request denied this catalogue for this reason
			const callback = await verifiedCallback();
			const result: Enforcement = { kind: 'deny', reason };

			// When the callback runs, Then it throws the denial in place of a filter, so nothing is searched
			assertDenied(
				() => callback({ locals: localsHolding({ records: result }) }, { readPath: 'hits' }),
				DENIAL_KINDS[reason],
			);
		});
	}

	test("returns the GraphQL router's allow-all value for an allow result", async () => {
		// Given a request allowed this catalogue
		const callback = await verifiedCallback();

		// When the callback runs, Then it returns the router's own allow-all value
		assert.deepEqual(
			callback({ locals: localsHolding({ records: ROWS.open.result }) }, { readPath: 'hits' }),
			includeEverything(undefined),
		);
	});

	test("throws the GraphQL router's misconfigured denial when the results name only other catalogues, since a missing result is the system's fault", async () => {
		// Given a request whose results hold another catalogue's result alone
		const callback = await verifiedCallback();

		// When the callback runs, Then this catalogue is denied as misconfigured
		assertDenied(
			() => callback({ locals: localsHolding({ other: ROWS.everyGrant.result }) }, { readPath: 'hits' }),
			'misconfigured',
		);
	});

	test('returns the narrow filter deeply frozen, so composing it cannot write to it', async () => {
		// Given a request whose access narrows this catalogue
		const callback = await verifiedCallback();
		const filter = callback({ locals: localsHolding({ records: ROWS.everyGrant.result }) }, { readPath: 'hits' });

		// Then every level of the filter is frozen
		const unfrozen: string[] = [];
		const walk = (value: unknown, path: string): void => {
			if (typeof value === 'object' && value !== null) {
				if (!Object.isFrozen(value)) {
					unfrozen.push(path);
				}
				Object.entries(value).forEach(([key, inner]) => walk(inner, `${path}.${key}`));
			}
		};
		walk(filter, 'filter');
		assert.deepEqual(unfrozen, []);
	});

	suite('a suspended principal, answered by what the open tier can settle', () => {
		const suspendedLocals = (): Record<string, unknown> => {
			const locals = {};
			attachAccess(locals, accessOf(SUSPENDED, { records: ROWS.anonymousBaselineOn.result }));
			return locals;
		};

		for (const readPath of ['hits', 'aggregations'] as const) {
			test(`serves the open tier's filter on the ${readPath} path`, async () => {
				// Given a suspended principal, whose results the bridge narrowed to the open tier
				const callback = await verifiedCallback();

				// When a search reaches the callback, Then it is served that filter
				assert.deepEqual(
					callback({ locals: suspendedLocals() }, { readPath }),
					ROWS.anonymousBaselineOn.result.kind === 'narrow' ? ROWS.anonymousBaselineOn.result.sqon : null,
				);
			});
		}

		for (const [readPath, operation] of [
			['export', 'an export, since a file holding only open records would read as complete'],
			['sets', 'saving a set, since a set holding only open records would later read as complete'],
			[
				'a-read-path-added-later',
				'a read path the callback does not recognize, so a path added later cannot serve the open tier as complete',
			],
		] as const) {
			test(`refuses ${operation}, with the GraphQL router's temporary refusal`, async () => {
				// Given a suspended principal
				const callback = await verifiedCallback();

				// When the request reaches this path, Then the refusal is the temporary one, carrying the
				// bridge's own unavailable text and Retry-After for the GraphQL router to answer with, never
				// the configuration failure
				assert.throws(
					() => callback({ locals: suspendedLocals() }, { readPath }),
					(error: unknown) =>
						error instanceof Error &&
						error.name === UNAVAILABLE_ERROR_NAME &&
						error.message === ANSWERS.unavailable &&
						(error as { retryAfterSeconds?: unknown }).retryAfterSeconds === RETRY_AFTER_SECONDS,
				);
			});
		}

		test("serves an anonymous principal's export, since nothing is reduced for it", async () => {
			// Given an anonymous principal, marked open-tier only but never suspended
			const callback = await verifiedCallback();

			// When its export reaches the callback, Then it is served its filter
			assert.deepEqual(
				callback(
					{ locals: localsHolding({ records: ROWS.anonymousBaselineOn.result }) },
					{ readPath: 'export' },
				),
				ROWS.anonymousBaselineOn.result.kind === 'narrow' ? ROWS.anonymousBaselineOn.result.sqon : null,
			);
		});

		test("carries the bridge's own unavailable answer, so a client meets one whichever layer answered", () => {
			assert.deepEqual(UNAVAILABLE_ANSWER, { retryAfterSeconds: RETRY_AFTER_SECONDS, text: ANSWERS.unavailable });
		});
	});

	for (const [description, principal] of [
		['an anonymous principal', ANONYMOUS],
		['a signed-in principal', signedIn('subject-ana')],
		['a suspended principal', SUSPENDED],
	] as const) {
		test(`refuses network search as a configuration failure for ${description}`, async () => {
			// Given a request holding a result the callback would otherwise apply
			const callback = await verifiedCallback();
			const locals = {};
			attachAccess(locals, accessOf(principal, { records: ROWS.everyGrant.result }));

			// When it reaches the network search read path, Then it is refused as a misconfiguration, since a
			// narrowing forwarded to a remote cannot be verified there: never a deny that would read as an empty
			// federation, nor a refusal inviting retries that cannot succeed
			assert.throws(() => callback({ locals }, { readPath: 'network' }), isConfigurationRefusal);
		});
	}

	suite('a store the bridge did not leave', () => {
		test('throws when the store holds no request access, because the middleware never ran', async () => {
			// Given a store the bridge's layer never reached
			const callback = await verifiedCallback();

			// When the callback runs, Then it throws through readAccess
			assert.throws(() => callback({ locals: {} }, { readPath: 'hits' }), UsherContractError);
		});

		for (const [description, value, shape] of [
			[
				'of another version',
				{ ...accessOf(ANONYMOUS, { records: ROWS.everyGrant.result }), version: 2 },
				'hidden',
			],
			[
				'holding an unknown kind of result',
				accessOf(ANONYMOUS, { records: { kind: 'grant-everything' } as unknown as Enforcement }),
				'hidden',
			],
			[
				'not shaped as attachAccess leaves it',
				accessOf(ANONYMOUS, { records: ROWS.everyGrant.result }),
				'enumerable',
			],
		] as const) {
			test(`throws for an usher member ${description}, before any result is read`, async () => {
				// Given a member defined directly, since attachAccess refuses each of these
				const callback = await verifiedCallback();
				const locals = {};
				Object.defineProperty(locals, 'usher', {
					configurable: false,
					enumerable: shape === 'enumerable',
					value: Object.freeze(value),
					writable: false,
				});

				// When the callback runs, Then readAccess refuses it
				assert.throws(() => callback({ locals }, { readPath: 'hits' }), UsherContractError);
			});
		}
	});
});
