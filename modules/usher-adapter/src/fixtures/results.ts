import {
	canonicalNarrowing,
	type Enforcement,
	type NarrowingClause,
	type UsherPrincipal,
	type UsherRequestAccess,
} from '@overture-stack/usher-types';

import { CATEGORY_FIELD, CONFIGURED_RESOURCES, EVERY_RECORD, MAPPED_CATEGORIES, RESOURCE_FIELD } from './catalogue.js';

/**
 * The fixtures are enforcement results, not payloads, since the adapter never receives a payload. Each
 * row is what the bridge would hand the adapter for one case of Usher's case table and this catalogue's
 * mapping, and the same rows become the bridge's expected outputs in its own step. The narrow filters
 * are built in the canonical form `@overture-stack/usher-types` defines, so a row and the bridge's
 * rendering of its case are compared by the records each returns, never by structure.
 */

type Resource = (typeof CONFIGURED_RESOURCES)[number];

const MAPPED_VALUES: readonly string[] = Object.values(MAPPED_CATEGORIES).toSorted();

const narrowing = (clauses: [NarrowingClause, ...NarrowingClause[]], mappedValues = MAPPED_VALUES): Enforcement => ({
	kind: 'narrow',
	sqon: canonicalNarrowing({
		categoryFieldName: CATEGORY_FIELD,
		clauses: clauses.map((clause) =>
			clause.kind === 'unmarked' ? { ...clause, mappedCategoryValues: mappedValues } : clause,
		) as [NarrowingClause, ...NarrowingClause[]],
		resourceFieldName: RESOURCE_FIELD,
	}),
});

const category = (categoryValue: string, resources: [Resource, ...Resource[]]): NarrowingClause => ({
	categoryValue,
	kind: 'category',
	resources,
});

const unmarked = (resources: [Resource, ...Resource[]]): NarrowingClause => ({
	kind: 'unmarked',
	mappedCategoryValues: MAPPED_VALUES,
	resources,
});

const EVERY_CONFIGURED: [Resource, ...Resource[]] = [...CONFIGURED_RESOURCES];

/** One row of the plan's fixture table: the case it traces to, the result, and the records it reveals. */
export type ResultRow = Readonly<{
	case: string;
	description: string;
	result: Enforcement;
	visible: readonly string[];
}>;

const row = (description: string, caseName: string, result: Enforcement, visible: readonly string[]): ResultRow =>
	Object.freeze({ case: caseName, description, result, visible });

const NO_GRANTS: Enforcement = { kind: 'deny', reason: 'no-grants' };

/** The rows for the catalogue registered as `records`, which maps both concrete categories. */
export const ROWS = {
	anonymousBaselineOff: row('anonymous, baseline off', '1', NO_GRANTS, []),
	anonymousBaselineOn: row('anonymous, baseline on', '2', narrowing([unmarked(EVERY_CONFIGURED)]), [
		'h2',
		'l1',
		'r3',
	]),
	everyGrant: row(
		'every grant',
		'parity',
		narrowing([
			category('community-governed', ['REEF_ARCHIVE']),
			category('controlled', ['HEART_STUDY', 'REEF_ARCHIVE']),
			unmarked(EVERY_CONFIGURED),
		]),
		EVERY_RECORD.filter((name) => name !== 'x1'),
	),
	heartControlledGrant: row(
		"a grant on HEART_STUDY's controlled",
		'5',
		narrowing([category('controlled', ['HEART_STUDY']), unmarked(EVERY_CONFIGURED)]),
		['h1', 'h2', 'l1', 'r3'],
	),
	heartUnmarkedUnheld: row(
		"HEART_STUDY's unmarked by grant, unheld",
		'19',
		narrowing([unmarked(['LUNG_COHORT', 'REEF_ARCHIVE'])]),
		['l1', 'r3'],
	),
	open: row('a catalogue open by configuration', 'none', { kind: 'allow' }, EVERY_RECORD),
	otherCataloguesOnly: row(
		'grants only in another catalogue, this one having registered its resource list',
		'bridge',
		NO_GRANTS,
		[],
	),
	predicatesFallAway: row('a narrowing whose predicates fall away', 'bridge', NO_GRANTS, []),
	reefControlledAlone: row(
		'controlled alone on REEF_ARCHIVE',
		'9',
		narrowing([category('controlled', ['REEF_ARCHIVE']), unmarked(EVERY_CONFIGURED)]),
		['r1', 'h2', 'l1', 'r3'],
	),
	unknownResource: row(
		'a catalogue registering an empty resource list',
		'config',
		{ kind: 'deny', reason: 'unknown-resource' },
		[],
	),
	unmappedCategoryOnly: row('every grant on a category unmapped here', 'bridge', NO_GRANTS, []),
} as const;

/**
 * The anonymous row for the catalogue registered again as `controlledOnly`, mapping `controlled` alone:
 * REEF_ARCHIVE offers `community-governed`, mapped nowhere there, so it is withheld whole, r3 included.
 */
export const CONTROLLED_ONLY_ANONYMOUS: ResultRow = row(
	'anonymous, baseline on, in a catalogue mapping controlled alone',
	'bridge',
	narrowing([unmarked(['HEART_STUDY', 'LUNG_COHORT'])], ['controlled']),
	['h2', 'l1'],
);

/**
 * The row for the catalogue registered again as `absentCategories`, which declares every concrete
 * category absent and names no category field. Its unmarked clause is then a bare test on the resource
 * field inside the narrowing's `or`, and every record of the held resources is visible.
 */
export const ABSENT_CATEGORIES_UNMARKED: ResultRow = row(
	'unmarked over HEART_STUDY and LUNG_COHORT, in a catalogue declaring every category absent',
	'config',
	{
		kind: 'narrow',
		sqon: canonicalNarrowing({
			clauses: [{ kind: 'unmarked', mappedCategoryValues: [], resources: ['HEART_STUDY', 'LUNG_COHORT'] }],
			resourceFieldName: RESOURCE_FIELD,
		}),
	},
	['h1', 'h2', 'l1'],
);

/** The principal as the bridge presents an anonymous request: no subject, the open tier only. */
export const ANONYMOUS: UsherPrincipal = { openTierOnly: true, subject: null, suspended: false };

/** A signed-in principal whose credential the bridge confirmed. */
export const signedIn = (subject: string): UsherPrincipal => ({ openTierOnly: false, subject, suspended: false });

/** A signed-in principal the bridge could not confirm: suspended, its subject null, the open tier only. */
export const SUSPENDED: UsherPrincipal = { openTierOnly: true, subject: null, suspended: true };

/**
 * One request's access as the bridge attaches it.
 *
 * @param principal who the request is served as.
 * @param results each catalogue's result, keyed by catalogue.
 */
export const accessOf = (
	principal: UsherPrincipal,
	results: Readonly<Record<string, Enforcement>>,
): UsherRequestAccess => ({
	principal,
	results,
	version: 1,
});
