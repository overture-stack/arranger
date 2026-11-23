import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { includeEverything } from '@overture-stack/arranger-graphql-router';
import { anonymousAccess, openTierAccess, signedInAccess } from '@overture-stack/usher-bridge--express/testing';
import { attachAccess, type Enforcement } from '@overture-stack/usher-types';

import { ACCESS_CONTROL_EVENTS } from './accessControlEvents.js';
import {
	createRecordingLogger,
	createRegisterRecorder,
	createStubProbe,
	DENY_REASONS,
	type DenyReason,
	INDEX_MAPPING,
	RECORDS_REGISTRATION,
	ROWS,
	UNAVAILABLE_ERROR_NAME,
} from './testing/index.js';

import { createUsherAccessControl, type UsherFilterCallback } from './index.js';

const PRESENTED_CREDENTIAL = 'credential-ana';

/** The denial kind the router is to throw for each deny reason of an artifact-create result. */
const ARTIFACT_DENIAL_KINDS: Readonly<Record<DenyReason, string>> = {
	'filter-limit': 'access-too-broad',
	'no-grants': 'no-artifact-create',
	'rendering-mismatch': 'misconfigured',
	'unknown-resource': 'misconfigured',
	'unmapped-category': 'misconfigured',
};

const ALLOW: Enforcement = { kind: 'allow' };

/** The artifact-create callback for the `records` catalogue, verified, with the logger its events are written to. */
const verifiedArtifactCallback = async () => {
	const { bridge } = createRegisterRecorder();
	const { lines, logger } = createRecordingLogger();
	const accessControl = createUsherAccessControl({
		bridge,
		catalogues: { records: RECORDS_REGISTRATION },
		logger,
	});
	await accessControl.verify({ records: { mapping: INDEX_MAPPING, probe: createStubProbe().probe } });
	return {
		callback: accessControl.artifactCreateFilterFor('records'),
		lines,
		viewCallback: accessControl.filterFor('records'),
	};
};

/** A request's store holding an anonymous principal's access, with `artifactCreate` for `records` and the view result. */
const anonymousLocals = (artifactCreate: Enforcement, view: Enforcement = ROWS.anonymousBaselineOn.result) => {
	const locals = {};
	attachAccess(
		locals,
		anonymousAccess({ artifactCreate: { records: artifactCreate }, results: { records: view } }).access,
	);
	return locals;
};

/** A request's store holding a suspended principal's open-tier access, with `artifactCreate` for `records`. */
const suspendedLocals = (artifactCreate: Enforcement) => {
	const locals = {};
	attachAccess(
		locals,
		openTierAccess(PRESENTED_CREDENTIAL, {
			artifactCreate: { records: artifactCreate },
			results: { records: ROWS.anonymousBaselineOn.result },
		}).access,
	);
	return locals;
};

/** Asserts `run` throws the GraphQL router's denial of the `records` catalogue, of `kind`. */
const assertDenied = (run: () => unknown, kind: string): void => {
	assert.throws(run, (error: unknown) => {
		assert.ok(error instanceof Error);
		assert.equal(error.name, 'AccessControlDeniedError');
		assert.deepEqual(
			{ catalogue: (error as { catalogue?: unknown }).catalogue, kind: (error as { kind?: unknown }).kind },
			{ catalogue: 'records', kind },
		);
		return true;
	});
};

suite('the artifact-create callback, as a pure function of the request store', () => {
	test("returns a narrow artifact-create result's filter unchanged", async () => {
		// Given a request whose artifact creation is narrowed to a set of records
		const { callback } = await verifiedArtifactCallback();
		const narrowed = ROWS.heartControlledGrant.result;

		// When the callback runs for a saved set
		const filter = callback({ locals: anonymousLocals(narrowed) }, { readPath: 'sets' });

		// Then it returns that narrowing's filter as it is
		assert.equal(narrowed.kind, 'narrow');
		assert.deepEqual(filter, narrowed.kind === 'narrow' ? narrowed.sqon : null);
	});

	test('returns the router allow-all filter for an artifact-create allow', async () => {
		// Given a request allowed to create an artifact from every record
		const { callback } = await verifiedArtifactCallback();
		const context = { locals: anonymousLocals(ALLOW) };

		// When the callback runs for a saved set
		const filter = callback(context, { readPath: 'sets' });

		// Then it returns the router's include-everything filter for that context
		assert.deepEqual(filter, includeEverything(context));
	});

	test('reads the artifact-create result alone, so a view result that allows nothing does not deny a creation', async () => {
		// Given a view result that denies the catalogue, and an artifact-create result that allows it
		const { callback } = await verifiedArtifactCallback();
		const context = { locals: anonymousLocals(ALLOW, { kind: 'deny', reason: 'no-grants' }) };

		// When the callback runs for a saved set
		const filter = callback(context, { readPath: 'sets' });

		// Then the allow is served
		assert.deepEqual(filter, includeEverything(context));
	});

	for (const [reason, description] of Object.entries(DENY_REASONS) as [DenyReason, string][]) {
		test(`throws the router's denial for an artifact-create deny for ${description}, of the kind that reason maps to`, async () => {
			// Given a request whose artifact creation is denied for this reason
			const { callback } = await verifiedArtifactCallback();

			// When the callback runs for a saved set, Then it throws the denial, so nothing is saved
			assertDenied(
				() => callback({ locals: anonymousLocals({ kind: 'deny', reason }) }, { readPath: 'sets' }),
				ARTIFACT_DENIAL_KINDS[reason],
			);
		});
	}

	test('throws a misconfigured denial when the request holds no artifact-create result for the catalogue', async () => {
		// Given a request whose access holds results for another catalogue only
		const { callback } = await verifiedArtifactCallback();
		const locals = {};
		attachAccess(locals, anonymousAccess({ artifactCreate: { other: ALLOW }, results: { other: ALLOW } }).access);

		// When the callback runs for a saved set, Then it is refused as a problem on the server
		assertDenied(() => callback({ locals }, { readPath: 'sets' }), 'misconfigured');
	});

	test('answers a suspended principal with the unavailable refusal, whatever the artifact-create result', async () => {
		// Given a suspended principal whose artifact creation is allowed
		const { callback } = await verifiedArtifactCallback();

		// When the callback runs for a saved set, Then it is answered as temporarily unavailable
		assert.throws(
			() => callback({ locals: suspendedLocals(ALLOW) }, { readPath: 'sets' }),
			(error: unknown) => error instanceof Error && error.name === UNAVAILABLE_ERROR_NAME,
		);
	});

	test('refuses to serve a catalogue that was never verified, rather than returning a filter', async () => {
		// Given an adapter that was never verified
		const { bridge } = createRegisterRecorder();
		const { logger } = createRecordingLogger();
		const accessControl = createUsherAccessControl({
			bridge,
			catalogues: { records: RECORDS_REGISTRATION },
			logger,
		});
		const callback = accessControl.artifactCreateFilterFor('records');

		// When the callback runs for a saved set, Then it throws, rather than returning a filter
		assert.throws(
			() => callback({ locals: anonymousLocals(ALLOW) }, { readPath: 'sets' }),
			/never verified against its index mapping/,
		);
	});

	test('logs each decision as an artifact-create event, told apart from a view decision by its capability', async () => {
		// Given a verified adapter, and a request allowed to create an artifact
		const { callback, lines } = await verifiedArtifactCallback();

		// When the callback runs for a saved set
		callback({ locals: anonymousLocals(ALLOW) }, { readPath: 'sets' });

		// Then the permitted event names the artifact-create capability
		const permitted = lines.filter((line) => line.message === ACCESS_CONTROL_EVENTS.permitted);
		assert.equal(permitted.at(-1)?.fields.capability, 'artifact.create');
	});

	test('logs a view decision under the record-view capability, not the artifact-create one', async () => {
		// Given a verified adapter, and a request allowed to view the catalogue
		const { lines, viewCallback } = await verifiedArtifactCallback();

		// When the view callback runs for a search
		viewCallback({ locals: anonymousLocals(ALLOW) }, { readPath: 'hits' });

		// Then the permitted event names the record-view capability
		const permitted = lines.filter((line) => line.message === ACCESS_CONTROL_EVENTS.permitted);
		assert.equal(permitted.at(-1)?.fields.capability, 'record.view');
	});
});
