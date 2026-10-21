import {
	type CatalogueRecord,
	type Grants,
	type IndexMapping,
	type RecordKeyRegistration,
	UNMARKED_CATEGORY,
} from './categoryChecker.js';

/**
 * A synthetic catalogue under Usher's category model, for suites that index it into an engine and hold the answers
 * against the category checker. Two listed studies share three global categories, on a keyword, a date and, through
 * study-b's own category, a number; study-a has two categories of its own and study-b one. No category reads the
 * resource field. Every record id is distinct, and each record's name says what it exercises.
 */

/** The field identifying a record, unique across the fixture. */
export const CATEGORY_ID_FIELD = 'record_id';

/** The first listed study. */
export const STUDY_A = 'study-a';

/** The second listed study. */
export const STUDY_B = 'study-b';

/** A study the registration does not list, though `everything` is granted on it. */
export const STUDY_UNLISTED = 'study-unlisted';

/** A second unlisted study, granted to `everything` with the same set as the first. */
export const STUDY_UNLISTED_OTHER = 'study-unlisted-other';

/** The index's field properties, typing every field the records hold. */
export const CATEGORY_INDEX_MAPPING = {
	access_tier: { type: 'keyword' },
	file_count: { type: 'integer' },
	labels: { type: 'keyword' },
	record_id: { type: 'keyword' },
	release_date: { type: 'date' },
	study_id: { type: 'keyword' },
} as const satisfies IndexMapping;

/**
 * The registration. `global.unreleased` excludes the whole day of its bound, 2024-03-15, while study-a's
 * `resource.pilot` covers both of its bounds' days whole; study-a's `resource.embargoed` holds a `not`, study-b's
 * `resource.bulk` an `or` whose number bound, 100, is included, and study-b's `resource.launch-day` an `in` on a date,
 * covering the whole of 2024-02-29.
 */
export const CATEGORY_REGISTRATION: RecordKeyRegistration = {
	categories: {
		global: {
			'global.community': { content: { fieldName: 'access_tier', value: ['community'] }, op: 'in' },
			'global.controlled': { content: { fieldName: 'access_tier', value: ['controlled'] }, op: 'in' },
			'global.unreleased': { content: { fieldName: 'release_date', value: '2024-03-15' }, op: 'gt' },
		},
		resource: {
			[STUDY_A]: {
				'resource.embargoed': {
					content: [
						{ content: { fieldName: 'labels', value: ['embargoed'] }, op: 'in' },
						{ content: [{ content: { fieldName: 'labels', value: ['reviewed'] }, op: 'in' }], op: 'not' },
					],
					op: 'and',
				},
				'resource.pilot': {
					content: { fieldName: 'release_date', value: ['2023-01-01', '2023-06-30'] },
					op: 'between',
				},
			},
			[STUDY_B]: {
				'resource.bulk': {
					content: [
						{ content: { fieldName: 'file_count', value: 100 }, op: 'gte' },
						{ content: { fieldName: 'labels', value: ['bulk'] }, op: 'in' },
					],
					op: 'or',
				},
				'resource.launch-day': { content: { fieldName: 'release_date', value: ['2024-02-29'] }, op: 'in' },
			},
		},
	},
	kind: 'record',
	resourceFieldName: 'study_id',
	resources: [STUDY_A, STUDY_B],
};

/** Fields placing a record of either study in no category. */
const PLAIN_FIELDS = { access_tier: 'open', file_count: 10, labels: ['reviewed'], release_date: '2024-01-10' } as const;

/**
 * The records: study-a's, some timed inside a date bound's day; study-b's; three holding both listed studies; three
 * holding an unlisted study, alone, beside another unlisted one, or beside study-a; and four missing the resource
 * field, one for each way a field can be missing.
 */
export const CATEGORY_RECORDS: readonly CatalogueRecord[] = [
	{ ...PLAIN_FIELDS, record_id: 'a-unmarked', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, access_tier: 'controlled', record_id: 'a-controlled', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, access_tier: 'community', record_id: 'a-community', study_id: STUDY_A },
	{
		...PLAIN_FIELDS,
		access_tier: ['controlled', 'community'],
		record_id: 'a-controlled-community',
		study_id: STUDY_A,
	},
	{
		...PLAIN_FIELDS,
		access_tier: 'community',
		labels: ['embargoed'],
		record_id: 'a-community-embargoed',
		study_id: STUDY_A,
	},
	{ ...PLAIN_FIELDS, labels: ['embargoed', 'reviewed'], record_id: 'a-embargoed-reviewed', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, access_tier: 'Controlled', record_id: 'a-tier-capitalized', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, record_id: 'a-release-on-bound', release_date: '2024-03-15', study_id: STUDY_A },
	{
		...PLAIN_FIELDS,
		record_id: 'a-release-midday-on-bound',
		release_date: '2024-03-15T12:00:00Z',
		study_id: STUDY_A,
	},
	{
		...PLAIN_FIELDS,
		record_id: 'a-release-last-instant-on-bound',
		release_date: '2024-03-15T23:59:59.999Z',
		study_id: STUDY_A,
	},
	{ ...PLAIN_FIELDS, record_id: 'a-release-after-bound', release_date: '2024-03-16', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, record_id: 'a-release-no-offset', release_date: '2024-03-15T00:00:00', study_id: STUDY_A },
	{
		...PLAIN_FIELDS,
		record_id: 'a-release-west-of-utc',
		release_date: '2024-03-15T23:30:00-05:00',
		study_id: STUDY_A,
	},
	{ ...PLAIN_FIELDS, record_id: 'a-pilot-start', release_date: '2023-01-01', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, record_id: 'a-pilot-end', release_date: '2023-06-30', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, record_id: 'a-pilot-end-evening', release_date: '2023-06-30T18:00:00Z', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, record_id: 'a-before-pilot', release_date: '2022-12-31', study_id: STUDY_A },
	{
		...PLAIN_FIELDS,
		record_id: 'a-before-pilot-last-instant',
		release_date: '2022-12-31T23:59:59.999Z',
		study_id: STUDY_A,
	},
	{ ...PLAIN_FIELDS, record_id: 'a-after-pilot', release_date: '2023-07-01', study_id: STUDY_A },
	{ file_count: 10, labels: ['reviewed'], record_id: 'a-tier-absent', release_date: '2024-01-10', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, access_tier: null, record_id: 'a-tier-null', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, access_tier: [null, 'controlled'], record_id: 'a-tier-null-beside-value', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, labels: [], record_id: 'a-labels-empty', study_id: STUDY_A },
	{ ...PLAIN_FIELDS, record_id: 'a-release-only-nulls', release_date: [null], study_id: STUDY_A },
	{
		access_tier: 'open',
		labels: ['reviewed'],
		record_id: 'a-file-count-absent',
		release_date: '2024-01-10',
		study_id: STUDY_A,
	},
	{ ...PLAIN_FIELDS, file_count: 99, record_id: 'b-unmarked', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, file_count: 100, record_id: 'b-bulk-on-bound', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, file_count: 3, labels: ['bulk', 'reviewed'], record_id: 'b-bulk-labelled', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, file_count: [2, 120], record_id: 'b-file-counts-one-bulk', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, labels: ['embargoed'], record_id: 'b-embargoed-label', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, record_id: 'b-pilot-date', release_date: '2023-03-01', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, access_tier: 'controlled', record_id: 'b-controlled', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, access_tier: 'community', file_count: 250, record_id: 'b-community-bulk', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, file_count: [null, null], record_id: 'b-file-count-only-nulls', study_id: STUDY_B },
	{
		access_tier: 'open',
		file_count: 10,
		record_id: 'b-labels-absent',
		release_date: '2024-01-10',
		study_id: STUDY_B,
	},
	{
		...PLAIN_FIELDS,
		record_id: 'b-launch-day-afternoon',
		release_date: '2024-02-29T15:30:00Z',
		study_id: STUDY_B,
	},
	{ ...PLAIN_FIELDS, record_id: 'b-day-after-launch', release_date: '2024-03-01T00:00:00Z', study_id: STUDY_B },
	{ ...PLAIN_FIELDS, record_id: 'ab-unmarked', study_id: [STUDY_A, STUDY_B] },
	{ ...PLAIN_FIELDS, file_count: 150, record_id: 'ab-bulk', study_id: [STUDY_A, STUDY_B] },
	{ ...PLAIN_FIELDS, access_tier: 'controlled', record_id: 'ab-controlled', study_id: [STUDY_A, STUDY_B] },
	{ ...PLAIN_FIELDS, record_id: 'unlisted-only', study_id: STUDY_UNLISTED },
	{ ...PLAIN_FIELDS, record_id: 'unlisted-pair', study_id: [STUDY_UNLISTED, STUDY_UNLISTED_OTHER] },
	// The filter serves this record by study-a alone, since it cannot exclude a value it was never given. The guard for
	// this case is the contract of one value per resource field, held by a startup refusal of any catalogue whose
	// records hold several, not the filter.
	{ ...PLAIN_FIELDS, record_id: 'a-and-unlisted', study_id: [STUDY_A, STUDY_UNLISTED] },
	{ ...PLAIN_FIELDS, record_id: 'no-study-absent' },
	{ ...PLAIN_FIELDS, record_id: 'no-study-null', study_id: null },
	{ ...PLAIN_FIELDS, record_id: 'no-study-empty', study_id: [] },
	{ ...PLAIN_FIELDS, record_id: 'no-study-only-nulls', study_id: [null] },
];

/** Every category name the registration defines, and `global.unmarked`. */
const EVERY_CATEGORY = [
	'global.community',
	'global.controlled',
	'global.unmarked',
	'global.unreleased',
	'resource.bulk',
	'resource.embargoed',
	'resource.launch-day',
	'resource.pilot',
] as const;

/**
 * The principals' grants. `everything` and `unmarkedOnly` hold the same set on both listed studies, and `everything`
 * holds it on both unlisted studies too, which still serves none of their own records. `controlledOnStudyA`,
 * `controlledWithoutUnmarked` and `unmarkedWithBulkOnStudyB` hold different sets on the listed studies:
 * `controlledOnStudyA` holds `global.controlled` on study-a alone, while the other two differ only in study-b's own
 * category. `communityOnStudyA` cannot reach study-b at all.
 */
export const CATEGORY_PRINCIPALS = {
	communityOnStudyA: { [STUDY_A]: ['global.community', UNMARKED_CATEGORY] },
	controlledOnStudyA: { [STUDY_A]: ['global.controlled', UNMARKED_CATEGORY], [STUDY_B]: [UNMARKED_CATEGORY] },
	controlledWithoutUnmarked: { [STUDY_A]: ['global.controlled'], [STUDY_B]: ['global.controlled', 'resource.bulk'] },
	everything: {
		[STUDY_A]: EVERY_CATEGORY,
		[STUDY_B]: EVERY_CATEGORY,
		[STUDY_UNLISTED]: EVERY_CATEGORY,
		[STUDY_UNLISTED_OTHER]: EVERY_CATEGORY,
	},
	nobody: {},
	unmarkedOnly: { [STUDY_A]: [UNMARKED_CATEGORY], [STUDY_B]: [UNMARKED_CATEGORY] },
	unmarkedWithBulkOnStudyB: { [STUDY_A]: [UNMARKED_CATEGORY], [STUDY_B]: ['resource.bulk', UNMARKED_CATEGORY] },
} as const satisfies Readonly<Record<string, Grants>>;
