import type { OpenKeyRegistration, RecordKeyRegistration } from '@overture-stack/usher-express-bridge';

/**
 * The synthetic catalogue the adapter's suites run on, configured as Usher's case table configures it:
 * HEART_STUDY carries `controlled`, LUNG_COHORT carries no concrete category, and REEF_ARCHIVE carries
 * `controlled` and `community-governed`. Its resource and category fields are flat keywords. The other
 * fields carry no access meaning; they give the shared spread of client queries what it needs.
 */

export const RESOURCE_FIELD = 'study_id';
export const CATEGORY_FIELD = 'data_category';

/** The resources the catalogue is configured to hold. x1's resource is configured nowhere. */
export const CONFIGURED_RESOURCES = ['HEART_STUDY', 'LUNG_COHORT', 'REEF_ARCHIVE'] as const;

/** Each concrete category the catalogue maps, against the value its records hold. */
export const MAPPED_CATEGORIES = {
	'global.community-governed': 'community-governed',
	'global.controlled': 'controlled',
} as const;

/** The index's field properties, as the GraphQL router fetches them and hands its mapping hook. */
export const INDEX_MAPPING = {
	data_category: { type: 'keyword' },
	files: { properties: { file_type: { type: 'keyword' } }, type: 'nested' },
	name: { type: 'keyword' },
	sample_type: { type: 'keyword' },
	study_id: { type: 'keyword' },
} as const;

/** One record of the synthetic catalogue, named by `name` so a suite can say which it expects. */
export type CatalogueRecord = Readonly<{
	data_category?: string;
	files: readonly Readonly<{ file_type: string }>[];
	name: string;
	sample_type?: string;
	study_id: string;
}>;

/**
 * The records, one per row of the plan's fixture table. Beyond access, `sample_type` is a keyword
 * missing on r2, and l1 holds two files, each meeting one of the pivot's two conditions and neither
 * meeting both, which is the case a lost pivot would let through.
 */
export const RECORDS: readonly CatalogueRecord[] = [
	{
		data_category: 'controlled',
		files: [{ file_type: 'bam' }],
		name: 'h1',
		sample_type: 'blood',
		study_id: 'HEART_STUDY',
	},
	{ files: [{ file_type: 'vcf' }], name: 'h2', sample_type: 'saliva', study_id: 'HEART_STUDY' },
	{
		files: [{ file_type: 'bam' }, { file_type: 'cram' }],
		name: 'l1',
		sample_type: 'tissue',
		study_id: 'LUNG_COHORT',
	},
	{ data_category: 'controlled', files: [], name: 'r1', sample_type: 'blood', study_id: 'REEF_ARCHIVE' },
	{ data_category: 'community-governed', files: [{ file_type: 'vcf' }], name: 'r2', study_id: 'REEF_ARCHIVE' },
	{ files: [{ file_type: 'cram' }], name: 'r3', sample_type: 'saliva', study_id: 'REEF_ARCHIVE' },
	{ files: [{ file_type: 'bam' }], name: 'x1', sample_type: 'tissue', study_id: 'TIDE_POOL' },
];

/** Every record's name, x1 included. */
export const EVERY_RECORD: readonly string[] = RECORDS.map(({ name }) => name);

/** The catalogue as the adapter's configuration names it, mapping both concrete categories. */
export const RECORDS_REGISTRATION: RecordKeyRegistration = {
	categoryFieldName: CATEGORY_FIELD,
	categoryValues: MAPPED_CATEGORIES,
	kind: 'record',
	resourceFieldName: RESOURCE_FIELD,
	resources: [...CONFIGURED_RESOURCES],
};

/** The same catalogue registered again under a second key, mapping `controlled` alone. */
export const CONTROLLED_ONLY_REGISTRATION: RecordKeyRegistration = {
	categoryFieldName: CATEGORY_FIELD,
	categoryValues: { 'global.controlled': 'controlled' },
	kind: 'record',
	resourceFieldName: RESOURCE_FIELD,
	resources: [...CONFIGURED_RESOURCES],
};

/** A catalogue with no category field, declaring both concrete categories absent. */
export const ABSENT_CATEGORIES_REGISTRATION: RecordKeyRegistration = {
	absentCategories: ['global.community-governed', 'global.controlled'],
	categoryValues: {},
	kind: 'record',
	resourceFieldName: RESOURCE_FIELD,
	resources: [...CONFIGURED_RESOURCES],
};

/** A catalogue registering an empty resource list, which denies every request with `unknown-resource`. */
export const EMPTY_LIST_REGISTRATION: RecordKeyRegistration = { ...RECORDS_REGISTRATION, resources: [] };

/** A catalogue open by configuration. */
export const OPEN_REGISTRATION: OpenKeyRegistration = { kind: 'open' };
