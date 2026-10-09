import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { attachAccess, canonicalNarrowing, type Enforcement, type UsherPrincipal } from '@overture-stack/usher-types';

import { EVENTS, isConfigurationRefusal } from './fixtures/arrangerNames.js';
import { CATEGORY_FIELD, INDEX_MAPPING, RECORDS_REGISTRATION, RESOURCE_FIELD } from './fixtures/catalogue.js';
import { createFakeBridge } from './fixtures/fakeBridge.js';
import { createRecordingLogger } from './fixtures/recordingLogger.js';
import { accessOf, ANONYMOUS, ROWS, signedIn, SUSPENDED } from './fixtures/results.js';
import { createUsherAccessControl } from './index.js';

/**
 * The log events: written now and reviewed with the rest, then committed only with the logging that
 * makes them pass, so no branch carries them failing. The callback emits them, since only it knows a
 * result was applied, once per application. Field names follow Usher's provisional audit set, camelCase;
 * the request identifier is the one the image assigns per request in `res.locals.requestId`.
 */

const REQUEST_ID = 'request-7f3a';

/** The verified callback for `records`, and the lines its logger records. */
const loggingCallback = () => {
	const bridge = createFakeBridge({ anonymous: { records: ROWS.anonymousBaselineOn.result }, principals: {} });
	const { lines, logger } = createRecordingLogger();
	const accessControl = createUsherAccessControl({
		bridge: bridge.core,
		catalogues: { records: RECORDS_REGISTRATION },
		logger,
	});
	accessControl.verify({ records: INDEX_MAPPING });
	return { callback: accessControl.filterFor('records'), lines };
};

const localsFor = (principal: UsherPrincipal, result: Enforcement): Record<string, unknown> => {
	const locals: Record<string, unknown> = { requestId: REQUEST_ID };
	attachAccess(locals, accessOf(principal, { records: result }));
	return locals;
};

suite('the log events', () => {
	for (const [description, principal, result, userId, suspended] of [
		[
			'a narrow result, for a signed-in principal',
			signedIn('subject-ana'),
			ROWS.heartControlledGrant.result,
			'subject-ana',
			false,
		],
		['an allow result, for an anonymous principal', ANONYMOUS, ROWS.open.result, null, false],
		['a narrow result, for a suspended principal', SUSPENDED, ROWS.anonymousBaselineOn.result, null, true],
	] as const) {
		test(`logs one access-permitted event per application of ${description}`, () => {
			// Given the callback, and a request holding that result
			const { callback, lines } = loggingCallback();

			// When the result is applied once
			callback({ locals: localsFor(principal, result) }, { readPath: 'hits' });

			// Then one permitted event names the subject, whether it is suspended, the arm, the read path and the request
			assert.deepEqual(lines, [
				{
					fields: {
						catalogue: 'records',
						enforcement: result.kind,
						readPath: 'hits',
						requestId: REQUEST_ID,
						suspended,
						userId,
					},
					level: 'info',
					message: EVENTS.permitted,
				},
			]);
		});
	}

	for (const [description, result] of [
		['holding no grants', ROWS.anonymousBaselineOff.result],
		['naming an unknown resource', ROWS.unknownResource.result],
	] as const) {
		test(`logs one access-denied event per application of a deny ${description}`, () => {
			// Given the callback, and a request denied this catalogue
			const { callback, lines } = loggingCallback();

			// When the deny is applied on the aggregations path
			callback({ locals: localsFor(ANONYMOUS, result) }, { readPath: 'aggregations' });

			// Then one denied event names the subject, whether it is suspended, the reason and the request
			assert.deepEqual(lines, [
				{
					fields: {
						catalogue: 'records',
						readPath: 'aggregations',
						reason: result.kind === 'deny' ? result.reason : null,
						requestId: REQUEST_ID,
						suspended: false,
						userId: null,
					},
					level: 'info',
					message: EVENTS.denied,
				},
			]);
		});
	}

	for (const readPath of ['export', 'sets', 'a-read-path-added-later'] as const) {
		test(`logs one unavailable event, never evaluation_failed, when a suspended principal meets the ${readPath} path`, () => {
			// Given the callback, and a suspended principal's request
			const { callback, lines } = loggingCallback();

			// When the request reaches a path the open tier cannot settle, and is refused
			assert.throws(() =>
				callback({ locals: localsFor(SUSPENDED, ROWS.anonymousBaselineOn.result) }, { readPath }),
			);

			// Then one event names the null subject, the suspension, the read path and the request, and
			// none is the alert a real misconfiguration raises
			assert.deepEqual(lines, [
				{
					fields: {
						catalogue: 'records',
						readPath,
						requestId: REQUEST_ID,
						suspended: true,
						userId: null,
					},
					level: 'warn',
					message: EVENTS.unavailable,
				},
			]);
		});
	}

	test('logs two events carrying the same request identifier when one request applies a result on two read paths', () => {
		// Given one request's store
		const { callback, lines } = loggingCallback();
		const locals = localsFor(signedIn('subject-ana'), ROWS.heartControlledGrant.result);

		// When its result is applied for hits and for aggregations
		callback({ locals }, { readPath: 'hits' });
		callback({ locals }, { readPath: 'aggregations' });

		// Then each application logs once, under the same request identifier
		assert.deepEqual(
			lines.map(({ fields }) => [fields['readPath'], fields['requestId']]),
			[
				['hits', REQUEST_ID],
				['aggregations', REQUEST_ID],
			],
		);
	});

	test('logs no token, no payload, no bearer token and no record identifier in any event', () => {
		// Given a request whose context carries a bearer token in its headers, and whose result names
		// a distinctive resource, as a payload logged whole would
		const { callback, lines } = loggingCallback();
		const sentinelResult: Enforcement = {
			kind: 'narrow',
			sqon: canonicalNarrowing({
				categoryFieldName: CATEGORY_FIELD,
				clauses: [{ categoryValue: 'controlled', kind: 'category', resources: ['LEAK_SENTINEL_RESOURCE'] }],
				resourceFieldName: RESOURCE_FIELD,
			}),
		};
		const context = {
			locals: localsFor(signedIn('subject-ana'), sentinelResult),
			request: { headers: new Headers({ authorization: 'Bearer LEAK_SENTINEL_TOKEN' }) },
		};

		// When the result is applied on every read path that serves one, and network search refuses it
		for (const readPath of ['hits', 'aggregations', 'sets', 'export'] as const) {
			callback(context, { readPath });
		}
		assert.throws(() => callback(context, { readPath: 'network' }), isConfigurationRefusal);

		// Then no line carries any of them
		const logged = JSON.stringify(lines);
		assert.equal(lines.filter(({ message }) => message === EVENTS.permitted).length, 4);
		assert.equal(logged.includes('LEAK_SENTINEL'), false, logged);
		assert.equal(logged.includes('Bearer'), false, logged);
	});
});
