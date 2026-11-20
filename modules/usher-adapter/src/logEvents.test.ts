import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { anonymousAccess, openTierAccess, signedInAccess } from '@overture-stack/usher-bridge--express/testing';
import {
	attachAccess,
	canonicalRecordNarrowing,
	type Enforcement,
	type UsherRequestAccess,
} from '@overture-stack/usher-types';

import {
	CATEGORY_CONDITIONS,
	createRecordingLogger,
	createRegisterRecorder,
	createStubProbe,
	DENY_REASONS,
	type DenyReason,
	EVENTS,
	INDEX_MAPPING,
	isConfigurationRefusal,
	type LoggedLine,
	RECORDS_REGISTRATION,
	RESOURCE_FIELD,
	ROWS,
} from './testing/index.js';

import { createUsherAccessControl, type UsherFilterCallback } from './index.js';

/**
 * The filter callback logs one event per application of a result, since only it knows a result was
 * applied. Field names are camelCase, as Usher's audit fields are, and the request identifier is the one
 * in `res.locals.requestId`.
 */

const REQUEST_ID = 'request-7f3a';

/** The verified callback for `records`, and the lines its logger records from then on. */
const loggingCallback = async (): Promise<{ callback: UsherFilterCallback; lines: readonly LoggedLine[] }> => {
	const { bridge } = createRegisterRecorder();
	const { lines, logger } = createRecordingLogger();
	const accessControl = createUsherAccessControl({
		bridge,
		catalogues: { records: RECORDS_REGISTRATION },
		logger,
	});
	await accessControl.verify({ records: { mapping: INDEX_MAPPING, probe: createStubProbe().probe } });
	return { callback: accessControl.filterFor('records'), lines };
};

/** Builds the outcome the Bridge gives one principal, from the results it is served. */
type AccessFor = (results: Readonly<Record<string, Enforcement>>) => Readonly<{ access: UsherRequestAccess }>;

const PRESENTED_CREDENTIAL = 'credential-ana';
const signedInAna: AccessFor = (results) => signedInAccess('subject-ana', results);
const unconfirmedSuspended: AccessFor = (results) => openTierAccess(PRESENTED_CREDENTIAL, results);
const attributionOnlyAna: AccessFor = (results) =>
	openTierAccess(PRESENTED_CREDENTIAL, results, { attributionOnlySubject: 'subject-ana' });

const localsFor = (accessFor: AccessFor, result: Enforcement): Record<string, unknown> => {
	const locals: Record<string, unknown> = { requestId: REQUEST_ID };
	attachAccess(locals, accessFor({ records: result }).access);
	return locals;
};

suite('the log events', () => {
	for (const [description, accessFor, result, userId, suspended, credential] of [
		[
			'a narrow result, for a signed-in principal',
			signedInAna,
			ROWS.heartControlledGrant.result,
			'subject-ana',
			false,
			'confirmed',
		],
		['an allow result, for an anonymous principal', anonymousAccess, ROWS.open.result, null, false, 'none'],
		[
			'a narrow result, for a suspended principal whose credential is unconfirmed',
			unconfirmedSuspended,
			ROWS.anonymousBaselineOn.result,
			null,
			true,
			'unconfirmed',
		],
		[
			'a narrow result, for a suspended principal whose credential was confirmed, naming its subject',
			attributionOnlyAna,
			ROWS.anonymousBaselineOn.result,
			'subject-ana',
			true,
			'confirmed',
		],
	] as const) {
		test(`logs one access-permitted event per application of ${description}`, async () => {
			// Given the callback, and a request holding that result
			const { callback, lines } = await loggingCallback();

			// When the result is applied once
			callback({ locals: localsFor(accessFor, result) }, { readPath: 'hits' });

			// Then one permitted event names the subject and its credential, whether it is suspended, the arm, the read
			// path and the request
			assert.deepEqual(lines, [
				{
					fields: {
						catalogue: 'records',
						credential,
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

	for (const [reason, description] of Object.entries(DENY_REASONS) as [DenyReason, string][]) {
		test(`logs one access-denied event per application of a deny for ${description}, naming its reason`, async () => {
			// Given the callback, and a request denied this catalogue
			const { callback, lines } = await loggingCallback();

			// When the deny is applied on the aggregations path, which it refuses
			assert.throws(() =>
				callback(
					{ locals: localsFor(anonymousAccess, { kind: 'deny', reason }) },
					{ readPath: 'aggregations' },
				),
			);

			// Then one denied event names the subject, whether it is suspended, the reason and the request
			assert.deepEqual(lines, [
				{
					fields: {
						catalogue: 'records',
						credential: 'none',
						readPath: 'aggregations',
						reason,
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
		test(`logs one unavailable event, never evaluation_failed, when a suspended principal meets the ${readPath} path`, async () => {
			// Given the callback, and a suspended principal's request
			const { callback, lines } = await loggingCallback();

			// When the request reaches a path the open tier cannot settle, and is refused
			assert.throws(() =>
				callback({ locals: localsFor(unconfirmedSuspended, ROWS.anonymousBaselineOn.result) }, { readPath }),
			);

			// Then one event names the null subject, the suspension, the read path and the request, and
			// none is the alert a real misconfiguration raises
			assert.deepEqual(lines, [
				{
					fields: {
						catalogue: 'records',
						credential: 'unconfirmed',
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

	test('logs two events carrying the same request identifier when one request applies a result on two read paths', async () => {
		// Given one request's store
		const { callback, lines } = await loggingCallback();
		const locals = localsFor(signedInAna, ROWS.heartControlledGrant.result);

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

	test('logs no token, no payload, no bearer token and no record identifier in any event', async () => {
		// Given a request whose context carries a bearer token in its headers, and whose result names
		// a distinctive resource, as a payload logged whole would
		const { callback, lines } = await loggingCallback();
		const sentinelResult: Enforcement = {
			kind: 'narrow',
			sqon: canonicalRecordNarrowing({
				globalCategories: CATEGORY_CONDITIONS,
				heldResources: [
					{
						heldCategories: ['global.controlled'],
						resource: 'LEAK_SENTINEL_RESOURCE',
						resourceCategories: {},
						unmarkedHeld: false,
					},
				],
				knownResources: ['LEAK_SENTINEL_RESOURCE'],
				resourceFieldName: RESOURCE_FIELD,
			}),
		};
		const context = {
			locals: localsFor(signedInAna, sentinelResult),
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
