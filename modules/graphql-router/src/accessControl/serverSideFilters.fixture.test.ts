import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import compileFilter from '#mapping/utils/compileFilter.js';
import buildQuery from '#middleware/buildQuery/index.js';

import {
	allowAllFilter,
	denyAllFilter,
	provenanceCeilingFilter,
	restrictingFilter,
} from './serverSideFilters.fixture.js';

/**
 * The Elasticsearch body a client and server-side filter compile to together. Asserted here rather
 * than on the intermediate SQON because the known escape routes all built a correct SQON and then
 * failed to carry it into the query.
 */
const emittedQuery = ({
	clientSideFilter,
	nestedFieldNames = [],
	serverSideFilter,
}: {
	clientSideFilter?: any;
	nestedFieldNames?: string[];
	serverSideFilter: any;
}) =>
	buildQuery({
		nestedFieldNames,
		nestingPrefix: undefined,
		filters: compileFilter({ clientSideFilter, serverSideFilter }),
	});

type Clause = { fieldName: string; values: unknown; polarity: 'required' | 'negated' | 'optional'; depth: number };

/**
 * Every `terms` clause in an emitted query, with the boolean context it sits in.
 *
 * Polarity rather than presence is the property worth asserting: a restricting clause under
 * `must_not` is present and permits exactly what it was meant to exclude. An odd number of
 * `must_not` wrappers negates, `should` makes a clause optional, and `depth` counts `nested`
 * wrappers, since a clause at the wrong depth filters the wrong scope.
 */
const clausesIn = (node: any, polarity: Clause['polarity'] = 'required', depth = 0): Clause[] => {
	const flip = (p: Clause['polarity']): Clause['polarity'] => (p === 'required' ? 'negated' : 'required');

	if (node?.terms) {
		const [fieldName, values] = Object.entries(node.terms).find(([key]) => key !== 'boost') ?? [];
		return fieldName === undefined ? [] : [{ fieldName, values, polarity, depth }];
	}

	if (node?.nested?.query) {
		return clausesIn(node.nested.query, polarity, depth + 1);
	}

	if (node?.bool) {
		return [
			...(node.bool.must ?? []).flatMap((child: any) => clausesIn(child, polarity, depth)),
			...(node.bool.filter ?? []).flatMap((child: any) => clausesIn(child, polarity, depth)),
			...(node.bool.must_not ?? []).flatMap((child: any) => clausesIn(child, flip(polarity), depth)),
			...(node.bool.should ?? []).flatMap((child: any) => clausesIn(child, 'optional', depth)),
		];
	}

	return [];
};

/** The clause naming `fieldName`, or `undefined` when the query carries none. */
const clauseOn = (query: unknown, fieldName: string): Clause | undefined =>
	clausesIn(query).find((clause) => clause.fieldName === fieldName);

const callerFilter = { op: 'in', content: { fieldName: 'donor', value: ['DO1'] } };

const restrictToStudyA = restrictingFilter({ fieldName: 'study', values: ['STUDY-A'] });

suite('accessControl/serverSideFilters fixture', () => {
	suite('restrictingFilter', () => {
		test('emits a required clause naming only the permitted values', () => {
			const clause = clauseOn(emittedQuery({ serverSideFilter: restrictToStudyA({}) }), 'study');

			assert.deepEqual(clause?.values, ['STUDY-A']);
			assert.equal(clause?.polarity, 'required');
		});

		test("reaches the query alongside the caller's own filter rather than replacing it", () => {
			const query = emittedQuery({ clientSideFilter: callerFilter, serverSideFilter: restrictToStudyA({}) });

			assert.equal(clauseOn(query, 'study')?.polarity, 'required');
			assert.equal(clauseOn(query, 'donor')?.polarity, 'required');
		});

		test('restricts when the caller supplies no filter', () => {
			assert.ok(clauseOn(emittedQuery({ serverSideFilter: restrictToStudyA({}) }), 'study'));
		});

		test('produces a different query from allow-all', () => {
			const restricted = emittedQuery({ clientSideFilter: callerFilter, serverSideFilter: restrictToStudyA({}) });
			const unrestricted = emittedQuery({ clientSideFilter: callerFilter, serverSideFilter: allowAllFilter({}) });

			assert.notDeepEqual(restricted, unrestricted);
		});

		test('survives a caller filter naming the same field, rather than merging with it', () => {
			const query = emittedQuery({
				clientSideFilter: { op: 'in', content: { fieldName: 'study', value: ['STUDY-Z'] } },
				serverSideFilter: restrictToStudyA({}),
			});
			const onStudy = clausesIn(query).filter((clause) => clause.fieldName === 'study');

			assert.equal(onStudy.length, 2);
			assert.deepEqual(
				onStudy.map((clause) => clause.polarity),
				['required', 'required'],
			);
		});
	});

	suite('provenanceCeilingFilter', () => {
		const ceiling = provenanceCeilingFilter({
			permitted: ['STUDY-A'],
			provenanceField: 'requiredResources',
			resourceField: 'study',
			withheld: ['STUDY-B'],
		});

		test('emits the resource clause as required and the ceiling clause as negated', () => {
			const query = emittedQuery({ serverSideFilter: ceiling({}) });

			assert.equal(clauseOn(query, 'study')?.polarity, 'required');
			assert.equal(clauseOn(query, 'requiredResources')?.polarity, 'negated');
		});

		test('carries both clauses through composition with a caller filter', () => {
			const query = emittedQuery({ clientSideFilter: callerFilter, serverSideFilter: ceiling({}) });

			assert.equal(clauseOn(query, 'study')?.polarity, 'required');
			assert.equal(clauseOn(query, 'requiredResources')?.polarity, 'negated');
			assert.equal(clauseOn(query, 'donor')?.polarity, 'required');
		});

		test('excludes the withheld resources rather than selecting them', () => {
			const clause = clauseOn(emittedQuery({ serverSideFilter: ceiling({}) }), 'requiredResources');

			assert.deepEqual(clause?.values, ['STUDY-B']);
			assert.notEqual(clause?.polarity, 'required');
		});
	});

	suite('nested fields', () => {
		/**
		 * The record path composes sibling nested clauses as `must`. Asserted rather than assumed,
		 * because the known `should`-for-`must` defect is on the aggregation path
		 * (`injectNestedFiltersToAggs`), and OR where AND was intended is an over-disclosure for an
		 * access predicate. This pins the record path as correct so a later reconciliation of the two
		 * mechanisms cannot quietly bring the aggregation behaviour across.
		 */
		const nestedAcl = {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'participants.study.acl', value: ['ACL-A'] } },
				{ op: 'in', content: { fieldName: 'participants.study.tier', value: ['open'] } },
			],
		};

		test('composes sibling clauses as required rather than optional', () => {
			const query = emittedQuery({
				nestedFieldNames: ['participants', 'participants.study'],
				serverSideFilter: nestedAcl,
			});

			assert.deepEqual(
				clausesIn(query)
					.map((clause) => clause.polarity)
					.sort(),
				['required', 'required'],
			);
		});

		test('places both clauses at the depth of their nested path', () => {
			const query = emittedQuery({
				nestedFieldNames: ['participants', 'participants.study'],
				serverSideFilter: nestedAcl,
			});

			assert.deepEqual(
				clausesIn(query).map((clause) => clause.depth),
				[2, 2],
			);
		});
	});

	suite('denyAllFilter', () => {
		test('emits an empty value list', () => {
			const clause = clauseOn(emittedQuery({ serverSideFilter: denyAllFilter('study')({}) }), 'study');

			assert.deepEqual(clause?.values, []);
			assert.equal(clause?.polarity, 'required');
		});

		test('composes with a caller filter rather than being dropped', () => {
			const query = emittedQuery({
				clientSideFilter: callerFilter,
				serverSideFilter: denyAllFilter('study')({}),
			});

			assert.deepEqual(clauseOn(query, 'study')?.values, []);
		});

		test('denies whatever field it names, including one no document carries', () => {
			const namedField = clauseOn(emittedQuery({ serverSideFilter: denyAllFilter('study')({}) }), 'study');
			const absentField = clauseOn(
				emittedQuery({ serverSideFilter: denyAllFilter('fieldAbsentFromEveryMapping')({}) }),
				'fieldAbsentFromEveryMapping',
			);

			assert.deepEqual(namedField?.values, []);
			assert.deepEqual(absentField?.values, []);
			assert.equal(absentField?.polarity, 'required');
		});
	});

	suite('allowAllFilter', () => {
		test("leaves the caller's filter as the only required restriction", () => {
			const query = emittedQuery({ clientSideFilter: callerFilter, serverSideFilter: allowAllFilter({}) });
			const required = clausesIn(query).filter((clause) => clause.polarity === 'required');

			assert.deepEqual(
				required.map((clause) => clause.fieldName),
				['donor'],
			);
		});

		test('contributes only a negated empty clause, which restricts nothing', () => {
			const query = emittedQuery({ clientSideFilter: callerFilter, serverSideFilter: allowAllFilter({}) });
			const contributed = clausesIn(query).filter((clause) => clause.fieldName !== 'donor');

			assert.deepEqual(
				contributed.map(({ polarity, values }) => ({ polarity, values })),
				[{ polarity: 'negated', values: [] }],
			);
		});
	});
});
