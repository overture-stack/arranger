import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import includeEverything from '#accessControl/includeEverything.js';
import { setsMapping } from '#schema/index.js';

import {
	attributionOf,
	catalogueScopeFilterFor,
	mayReadStoredFilterOf,
	mayUseSetById,
	narrowsSetRecords,
	ownerFilterFor,
	type SetsScope,
	setsVisibleFilterFor,
	refuseUnusableSetFields,
	requesterOf,
	savedAttributionFor,
	setIdsNamedBy,
	usableSetFieldsOf,
	withheldSetFieldsFor,
} from './setsAccess.js';

const SET_X = 'a3a1c0de-0000-4000-8000-000000000001';
const SET_Y = 'a3a1c0de-0000-4000-8000-000000000002';

const setIdIn = (value: unknown[]) => ({ content: { fieldName: 'setId', value }, op: 'in' });

suite('narrowsSetRecords', () => {
	test("narrows a set's records for a router given a filter callback of its own", () => {
		assert.equal(
			narrowsSetRecords(() => includeEverything(undefined)),
			true,
		);
	});

	test('leaves set records whole for a router applying includeEverything itself, given no callback or that one', () => {
		assert.equal(narrowsSetRecords(includeEverything), false);
	});
});

suite('requesterOf', () => {
	const answering = (answer: unknown) => () => answer as never;

	test('reads a principal, with the id the host gives', () => {
		const getRequester = (context: unknown) => ({
			id: (context as { locals: { subject: string } }).locals.subject,
			kind: 'principal' as const,
		});

		assert.deepEqual(requesterOf({ context: { locals: { subject: 'subject-r1' } }, getRequester }), {
			id: 'subject-r1',
			kind: 'principal',
		});
	});

	test('reads an anonymous request the host states as anonymous', () => {
		assert.deepEqual(requesterOf({ context: {}, getRequester: answering({ kind: 'anonymous' }) }), {
			kind: 'anonymous',
		});
	});

	test('reads a suspended principal with the wait the host gives, its id, where given, kept from ownership', () => {
		assert.deepEqual(
			requesterOf({
				context: {},
				getRequester: answering({ id: 'subject-r1', kind: 'suspended', retryAfterSeconds: 9 }),
			}),
			{ kind: 'suspended', retryAfterSeconds: 9 },
		);
	});

	test('reads a suspended principal the host gives no usable wait as waiting five seconds', () => {
		assert.deepEqual(requesterOf({ context: {}, getRequester: answering({ kind: 'suspended' }) }), {
			kind: 'suspended',
			retryAfterSeconds: 5,
		});
	});

	for (const [description, answer] of [
		['undefined', undefined],
		['null', null],
		['a bare id', 'subject-r1'],
		['a principal with no id', { kind: 'principal' }],
		['a principal with an empty id', { id: '', kind: 'principal' }],
		['an unknown kind', { kind: 'guest' }],
		['an object naming no kind', { id: 'subject-r1' }],
	] as const) {
		test(`refuses the request as an access-control failure where the host callback answers ${description}`, () => {
			assert.throws(
				() => requesterOf({ context: {}, getRequester: answering(answer) }),
				(error: unknown) => error instanceof Error && error.name === 'AccessControlError',
			);
		});
	}

	test("refuses the request as an access-control failure where the host callback throws, carrying the host's error", () => {
		// Given a host callback that throws
		const failure = new Error('the session store is unreachable');

		// When the requester is asked, Then the request is refused as a configuration failure
		assert.throws(
			() =>
				requesterOf({
					context: {},
					getRequester: () => {
						throw failure;
					},
				}),
			(error: unknown) =>
				error instanceof Error && error.name === 'AccessControlError' && error.cause === failure,
		);
	});
});

suite('attributionOf', () => {
	for (const attribution of ['anonymous', 'principal', 'unattributed'] as const) {
		test(`reads a set marked ${attribution} as ${attribution}`, () => {
			assert.equal(attributionOf({ attribution }), attribution);
		});
	}

	test('reads a set carrying no mark, saved before marks were recorded, as unattributed', () => {
		assert.equal(attributionOf({ userId: 'subject-r1' }), 'unattributed');
	});
});

suite('savedAttributionFor', () => {
	test("records a principal's set as the principal's, by its id, whatever userId the client sends", () => {
		assert.deepEqual(
			savedAttributionFor({ clientUserId: 'someone-else', requester: { id: 'subject-r1', kind: 'principal' } }),
			{ attribution: 'principal', userId: 'subject-r1' },
		);
	});

	test("records an anonymous request's set as anonymous, with no userId, whatever the client sends", () => {
		assert.deepEqual(savedAttributionFor({ clientUserId: 'someone-else', requester: { kind: 'anonymous' } }), {
			attribution: 'anonymous',
			userId: null,
		});
	});

	test("records a set saved with no getRequester as unattributed, keeping the client's userId as data", () => {
		assert.deepEqual(savedAttributionFor({ clientUserId: 'client-named', requester: undefined }), {
			attribution: 'unattributed',
			userId: 'client-named',
		});
	});
});

suite('mayReadStoredFilterOf', () => {
	const PRINCIPAL = { id: 'subject-r1', kind: 'principal' } as const;

	test("gives a principal's set's stored filter to that principal alone", () => {
		const node = { attribution: 'principal', userId: 'subject-r1' };

		assert.equal(mayReadStoredFilterOf({ node, requester: PRINCIPAL }), true);
		assert.equal(mayReadStoredFilterOf({ node, requester: { id: 'subject-r2', kind: 'principal' } }), false);
		assert.equal(mayReadStoredFilterOf({ node, requester: { kind: 'anonymous' } }), false);
		assert.equal(mayReadStoredFilterOf({ node, requester: { kind: 'suspended', retryAfterSeconds: 5 } }), false);
	});

	for (const [description, node] of [
		['an anonymous set', { attribution: 'anonymous', userId: null }],
		['an unattributed set', { attribution: 'unattributed', userId: 'client-named' }],
		['an unmarked set', { userId: 'client-named' }],
	] as const) {
		test(`gives ${description}'s stored filter to every reader`, () => {
			assert.equal(mayReadStoredFilterOf({ node, requester: { kind: 'anonymous' } }), true);
			assert.equal(mayReadStoredFilterOf({ node, requester: PRINCIPAL }), true);
		});
	}
});

suite('withheldSetFieldsFor', () => {
	for (const [description, regime, withheld] of [
		['a router with neither', { narrowed: false, owned: false }, ['userId']],
		['a filter callback', { narrowed: true, owned: false }, ['ids', 'size', 'userId']],
		['getRequester', { narrowed: false, owned: true }, ['sqon', 'userId']],
		['both', { narrowed: true, owned: true }, ['ids', 'size', 'sqon', 'userId']],
	] as const) {
		test(`withholds ${withheld.join(', ')} as filter and sort keys for ${description}`, () => {
			assert.deepEqual([...withheldSetFieldsFor(regime)].sort(), withheld);
		});
	}
});

suite('usableSetFieldsOf', () => {
	test('gives a client every field of the built-in sets mapping that the search engine indexes and the reader is given as stored', () => {
		// Given the sets mapping the router creates, and userId withheld
		const usable = usableSetFieldsOf({ mapping: setsMapping, withheld: ['userId'] });

		// Then every indexed field but userId is usable, and sqon, stored and never indexed, is not
		assert.deepEqual([...usable].sort(), [
			'attribution',
			'catalogue',
			'createdAt',
			'ids',
			'path',
			'setId',
			'size',
			'type',
		]);
	});

	test('leaves out any field its mapping stores and never indexes, whatever readers are given', () => {
		// Given a mapping with a further stored-only field, and nothing withheld
		const mapping = { notes: { enabled: false, type: 'object' }, setId: { type: 'keyword' } };

		// Then only the indexed field is usable
		assert.deepEqual(usableSetFieldsOf({ mapping, withheld: [] }), ['setId']);
	});
});

suite('refuseUnusableSetFields', () => {
	const USABLE = ['attribution', 'createdAt', 'path', 'setId', 'type'];
	const fieldIn = (fieldName: unknown) => ({ content: { fieldName, value: ['p1'] }, op: 'in' });
	const isRefusalNaming = (use: string) => (error: unknown) =>
		error instanceof Error &&
		error.name === 'InvalidFilterError' &&
		error.message === `The sets connection can be ${use} only by attribution, createdAt, path, setId or type.`;

	test('lets a filter and a sort name usable fields, and paths within them', () => {
		assert.doesNotThrow(() =>
			refuseUnusableSetFields({
				filters: {
					content: [fieldIn('setId'), { content: [fieldIn('type'), fieldIn('path.raw')], op: 'or' }],
					op: 'and',
				},
				sort: [{ fieldName: 'createdAt', order: 'desc' }],
				usable: USABLE,
			}),
		);
	});

	test('lets a request name no filter and no sort', () => {
		assert.doesNotThrow(() => refuseUnusableSetFields({ filters: undefined, sort: undefined, usable: USABLE }));
	});

	for (const [description, filters] of [
		['at the top', fieldIn('userId')],
		[
			'deep inside a combination',
			{ content: [{ content: [{ content: [fieldIn('ids')], op: 'not' }], op: 'or' }], op: 'and' },
		],
		[
			'among the fields a text search names',
			{ content: { fieldNames: ['setId', 'size'], value: 'p1' }, op: 'filter' },
		],
		['as a pattern', { content: { fieldNames: ['*'], value: 'p1' }, op: 'filter' }],
		['as a pattern a usable field begins', fieldIn('setId*')],
		['as a path joined some other way', fieldIn('sqon__content')],
		['as a value that is not a field name', fieldIn(['setId'])],
	] as const) {
		test(`refuses a filter naming an unusable field ${description}, naming the fields it may use`, () => {
			assert.throws(
				() => refuseUnusableSetFields({ filters, sort: undefined, usable: USABLE }),
				isRefusalNaming('filtered'),
			);
		});
	}

	test('refuses a sort on an unusable field, naming the fields it may use', () => {
		assert.throws(
			() =>
				refuseUnusableSetFields({
					filters: undefined,
					sort: [{ fieldName: 'createdAt' }, { fieldName: 'size', order: 'asc' }],
					usable: USABLE,
				}),
			isRefusalNaming('sorted'),
		);
	});

	test('walks a filter deeper than a recursive walk could', () => {
		// Given a filter nested 100,000 combinations deep, an unusable field at the bottom
		const deep = Array.from({ length: 100_000 }).reduce<unknown>(
			(inner) => ({ content: [inner], op: 'and' }),
			fieldIn('userId'),
		);

		// Then it is refused as naming that field, not as a stack overflow
		assert.throws(
			() => refuseUnusableSetFields({ filters: deep, sort: undefined, usable: USABLE }),
			isRefusalNaming('filtered'),
		);
	});
});

suite('setIdsNamedBy', () => {
	test('reads the set ids an `in` on setId names at the top of the filter', () => {
		assert.deepEqual(setIdsNamedBy(setIdIn([SET_X, SET_Y])), [SET_X, SET_Y]);
	});

	test('reads the set ids each `in` on setId names directly inside a top-level `and`', () => {
		assert.deepEqual(
			setIdsNamedBy({
				content: [
					setIdIn([SET_X]),
					{ content: { fieldName: 'type', value: ['record'] }, op: 'in' },
					setIdIn([SET_Y]),
				],
				op: 'and',
			}),
			[SET_X, SET_Y],
		);
	});

	for (const [description, filter] of [
		['an `or`', { content: [setIdIn([SET_X])], op: 'or' }],
		['a `not`', { content: [setIdIn([SET_X])], op: 'not' }],
		['an `and` inside an `and`', { content: [{ content: [setIdIn([SET_X])], op: 'and' }], op: 'and' }],
		['an `in` on another field', { content: { fieldName: 'type', value: [SET_X] }, op: 'in' }],
		['an exclusion on setId', { content: { fieldName: 'setId', value: [SET_X] }, op: 'not-in' }],
		['no filter', undefined],
		['a filter that is not a SQON', 'setId'],
	] as const) {
		test(`names no set through ${description}`, () => {
			assert.deepEqual(setIdsNamedBy(filter), []);
		});
	}

	test('reads only the set ids that are strings', () => {
		assert.deepEqual(setIdsNamedBy(setIdIn([SET_X, 7, null, { setId: SET_Y }])), [SET_X]);
	});
});

suite('ownerFilterFor', () => {
	const PRINCIPAL = { id: 'subject-r1', kind: 'principal' } as const;
	const ownSets = {
		content: [
			{ content: { fieldName: 'attribution', value: ['principal'] }, op: 'in' },
			{ content: { fieldName: 'userId', value: ['subject-r1'] }, op: 'in' },
		],
		op: 'and',
	};
	const unattributedSets = { content: { fieldName: 'attribution', value: ['unattributed'] }, op: 'in' };
	const unmarkedSets = { content: { fieldName: 'attribution', value: ['__missing__'] }, op: 'in' };
	const anonymousSets = { content: { fieldName: 'attribution', value: ['anonymous'] }, op: 'in' };

	test("keeps a principal's own sets, unattributed and unmarked sets, and an anonymous set the client names by id", () => {
		assert.deepEqual(ownerFilterFor({ clientFilter: setIdIn([SET_X]), requester: PRINCIPAL }), {
			content: [
				ownSets,
				unattributedSets,
				unmarkedSets,
				{ content: [anonymousSets, setIdIn([SET_X])], op: 'and' },
			],
			op: 'or',
		});
	});

	test("keeps a principal's own sets, and unattributed and unmarked sets, where the client names none", () => {
		assert.deepEqual(ownerFilterFor({ clientFilter: undefined, requester: PRINCIPAL }), {
			content: [ownSets, unattributedSets, unmarkedSets],
			op: 'or',
		});
	});

	for (const [description, requester] of [
		['an anonymous request', { kind: 'anonymous' }],
		['a suspended principal', { kind: 'suspended', retryAfterSeconds: 5 }],
	] as const) {
		test(`keeps unattributed and unmarked sets and an anonymous set the client names by id for ${description}`, () => {
			assert.deepEqual(ownerFilterFor({ clientFilter: setIdIn([SET_Y]), requester }), {
				content: [unattributedSets, unmarkedSets, { content: [anonymousSets, setIdIn([SET_Y])], op: 'and' }],
				op: 'or',
			});
		});
	}
});

suite('mayUseSetById', () => {
	const PRINCIPAL = { id: 'subject-r1', kind: 'principal' } as const;
	const OTHER = { id: 'subject-r2', kind: 'principal' } as const;
	const ownedBy = (userId: string) => ({ attribution: 'principal', setId: SET_X, userId });
	// The catalogue's own index, with no peers, so a document recording no catalogue belongs to it.
	const OWN_SCOPE: SetsScope = { catalogue: 'catalogue-a', documentType: 'donor', ownIndex: true };

	test('usable by its principal, and not by another principal, the document answering as a missing id does', () => {
		assert.equal(
			mayUseSetById({ document: ownedBy('subject-r1'), requester: PRINCIPAL, setId: SET_X, scope: OWN_SCOPE }),
			true,
		);
		assert.equal(
			mayUseSetById({ document: ownedBy('subject-r1'), requester: OTHER, setId: SET_X, scope: OWN_SCOPE }),
			false,
		);
	});

	test('usable by an anonymous reader only where the set is anonymous', () => {
		assert.equal(
			mayUseSetById({
				document: { attribution: 'anonymous', setId: SET_X },
				requester: OTHER,
				scope: OWN_SCOPE,
				setId: SET_X,
			}),
			true,
		);
		assert.equal(
			mayUseSetById({ document: ownedBy('subject-r1'), requester: OTHER, setId: SET_X, scope: OWN_SCOPE }),
			false,
		);
	});

	test('usable by any reader when the set is unattributed or carries no attribution', () => {
		for (const document of [{ attribution: 'unattributed', setId: SET_X }, { setId: SET_X }]) {
			assert.equal(mayUseSetById({ document, requester: OTHER, setId: SET_X, scope: OWN_SCOPE }), true);
			assert.equal(
				mayUseSetById({ document, requester: { kind: 'anonymous' }, setId: SET_X, scope: OWN_SCOPE }),
				true,
			);
		}
	});

	test('usable only under the id it is stored as, so a document naming another id is not usable', () => {
		assert.equal(
			mayUseSetById({
				document: { attribution: 'anonymous', setId: SET_Y },
				requester: OTHER,
				scope: OWN_SCOPE,
				setId: SET_X,
			}),
			false,
		);
	});
});

suite('mayUseSetById under a catalogue scope', () => {
	const ANONYMOUS = { kind: 'anonymous' } as const;

	/** A set the reader may use as far as its owner goes, so only the catalogue scope decides. */
	const listedSet = (fields: Record<string, unknown>) => ({ attribution: 'unattributed', setId: SET_X, ...fields });

	test('usable where it records the scope catalogue, and not where it records another', () => {
		const scope = { catalogue: 'catalogue-a', documentType: 'donor', ownIndex: false, peerDocumentTypes: [] };

		assert.equal(
			mayUseSetById({
				document: listedSet({ catalogue: 'catalogue-a' }),
				requester: ANONYMOUS,
				scope,
				setId: SET_X,
			}),
			true,
		);
		assert.equal(
			mayUseSetById({
				document: listedSet({ catalogue: 'catalogue-b' }),
				requester: ANONYMOUS,
				scope,
				setId: SET_X,
			}),
			false,
		);
	});

	test('an uncatalogued set belongs to a default-index catalogue with no peers, whatever its type', () => {
		const scope = { catalogue: 'catalogue-a', documentType: 'donor', ownIndex: true };

		assert.equal(
			mayUseSetById({ document: listedSet({ type: 'protein' }), requester: ANONYMOUS, scope, setId: SET_X }),
			true,
		);
	});

	test('an uncatalogued set answers as missing for a non-default index given no peer information', () => {
		const scope = { catalogue: 'catalogue-a', documentType: 'donor', ownIndex: false };

		assert.equal(
			mayUseSetById({ document: listedSet({ type: 'donor' }), requester: ANONYMOUS, scope, setId: SET_X }),
			false,
		);
	});

	test('an uncatalogued set belongs to a catalogue whose documentType no peer shares, and no other', () => {
		const scope = {
			catalogue: 'catalogue-a',
			documentType: 'donor',
			ownIndex: false,
			peerDocumentTypes: ['protein'],
		};

		assert.equal(
			mayUseSetById({ document: listedSet({ type: 'donor' }), requester: ANONYMOUS, scope, setId: SET_X }),
			true,
		);
		assert.equal(
			mayUseSetById({ document: listedSet({ type: 'protein' }), requester: ANONYMOUS, scope, setId: SET_X }),
			false,
		);
	});

	test('an uncatalogued set answers as missing where a peer shares its documentType', () => {
		const scope = {
			catalogue: 'catalogue-a',
			documentType: 'records',
			ownIndex: false,
			peerDocumentTypes: ['records', 'protein'],
		};

		assert.equal(
			mayUseSetById({ document: listedSet({ type: 'records' }), requester: ANONYMOUS, scope, setId: SET_X }),
			false,
		);
	});
});

suite('setsVisibleFilterFor', () => {
	test('composes the owner filter with the catalogue scope, under one and clause', () => {
		const scope = { catalogue: 'catalogue-a', documentType: 'donor', ownIndex: true };
		const filter = setsVisibleFilterFor({
			clientFilter: undefined,
			requester: { kind: 'anonymous' },
			scope,
		});

		assert.equal(filter.op, 'and');
		assert.deepEqual(filter.content?.[1], catalogueScopeFilterFor(scope));
	});
});
