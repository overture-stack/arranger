import {
	canonicalRecordNarrowing,
	type CategoryName,
	type Enforcement,
	type HeldResource,
	type RecordNarrowingDescription,
	type UsherPrincipal,
	type UsherRequestAccess,
} from '@overture-stack/usher-types';

import { CATEGORY_CONDITIONS, CONFIGURED_RESOURCES, EVERY_RECORD, RESOURCE_FIELD } from './catalogue.js';

/**
 * The fixtures are enforcement results, not payloads, since the adapter never receives a payload. Each
 * row is what the bridge would hand the adapter for one case of Usher's case table and this catalogue's
 * category conditions, and the same rows become the bridge's expected outputs in its own step. The
 * narrow filters are rendered in the canonical form `@overture-stack/usher-types` defines, so a row and
 * the bridge's rendering of its case are compared by the records each returns, never by structure.
 */

type Resource = (typeof CONFIGURED_RESOURCES)[number];

/** A resource held with record view: the global categories held on it, and whether its unmarked records are. */
const held = (resource: Resource, heldCategories: readonly CategoryName[], unmarkedHeld: boolean): HeldResource => ({
	heldCategories,
	resource,
	resourceCategories: {},
	unmarkedHeld,
});

const narrowing = (
	heldResources: [HeldResource, ...HeldResource[]],
	globalCategories: RecordNarrowingDescription['globalCategories'] = CATEGORY_CONDITIONS,
): Enforcement => ({
	kind: 'narrow',
	sqon: canonicalRecordNarrowing({
		globalCategories,
		heldResources,
		knownResources: [...CONFIGURED_RESOURCES],
		resourceFieldName: RESOURCE_FIELD,
	}),
});

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

/** Why the bridge denies a catalogue. */
export type DenyReason = Extract<Enforcement, { kind: 'deny' }>['reason'];

/**
 * Every reason the bridge denies a catalogue with, each described, so a reason the bridge adds fails to
 * compile here until a suite covers it.
 */
export const DENY_REASONS: Readonly<Record<DenyReason, string>> = {
	'filter-limit': "grants beyond what the catalogue's filter can express",
	'no-grants': 'no grants',
	'rendering-mismatch': 'a filter saying other than the payload it was rendered from',
	'unknown-resource': 'a catalogue registering no resources',
	'unmapped-category': 'a global category the catalogue neither defines nor declares absent',
};

/** The rows for the catalogue registered as `records`, which defines both concrete categories. */
export const ROWS = {
	anonymousBaselineOff: row('anonymous, baseline off', '1', NO_GRANTS, []),
	anonymousBaselineOn: row(
		'anonymous, baseline on',
		'2',
		narrowing([held('HEART_STUDY', [], true), held('LUNG_COHORT', [], true), held('REEF_ARCHIVE', [], true)]),
		['h2', 'l1', 'r3'],
	),
	everyGrant: row(
		'every grant',
		'parity',
		narrowing([
			held('HEART_STUDY', ['global.controlled'], true),
			held('LUNG_COHORT', [], true),
			held('REEF_ARCHIVE', ['global.community-governed', 'global.controlled'], true),
		]),
		EVERY_RECORD.filter((name) => name !== 'x1'),
	),
	heartControlledGrant: row(
		"a grant on HEART_STUDY's controlled",
		'5',
		narrowing([
			held('HEART_STUDY', ['global.controlled'], true),
			held('LUNG_COHORT', [], true),
			held('REEF_ARCHIVE', [], true),
		]),
		['h1', 'h2', 'l1', 'r3'],
	),
	heartUnmarkedUnheld: row(
		"HEART_STUDY's unmarked by grant, unheld",
		'19',
		narrowing([held('LUNG_COHORT', [], true), held('REEF_ARCHIVE', [], true)]),
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
		narrowing([
			held('HEART_STUDY', [], true),
			held('LUNG_COHORT', [], true),
			held('REEF_ARCHIVE', ['global.controlled'], true),
		]),
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
 * The anonymous row for the catalogue registered again as `controlledOnly`, defining `controlled` alone,
 * where the unmarked records of HEART_STUDY and LUNG_COHORT are open and REEF_ARCHIVE is withheld whole.
 */
export const CONTROLLED_ONLY_ANONYMOUS: ResultRow = row(
	'anonymous, baseline on, in a catalogue defining controlled alone',
	'bridge',
	narrowing([held('HEART_STUDY', [], true), held('LUNG_COHORT', [], true)], {
		'global.controlled': CATEGORY_CONDITIONS['global.controlled'],
	}),
	['h2', 'l1'],
);

/**
 * The row for the catalogue registered again as `absentCategories`, which defines no category and
 * declares every concrete one absent. Its narrowing is then a test on the resource field alone, and
 * every record of the held resources is visible.
 */
export const ABSENT_CATEGORIES_UNMARKED: ResultRow = row(
	'unmarked over HEART_STUDY and LUNG_COHORT, in a catalogue declaring every category absent',
	'config',
	narrowing([held('HEART_STUDY', [], true), held('LUNG_COHORT', [], true)], {}),
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
