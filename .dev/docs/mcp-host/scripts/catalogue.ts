/**
 * A made-up two-catalogue Arranger instance for the model-facing spikes (S1, S4).
 *
 * Synthetic on purpose: tool results produced from it hold no dataset records, so transcripts can be
 * committed. Shapes follow Arranger's introspection responses, and each type's operators come from
 * the same rules as `getValidFieldOperators` in
 * `modules/graphql-router/src/introspection/buildCatalogueIntrospection.ts`.
 */
import { readFile } from 'node:fs/promises';

const RANGE = ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'];
const ENUM_LIKE = ['in', 'not-in', 'some-not-in', 'all', 'filter'];

const operatorsFor = (fields: Record<string, { type: string }>) =>
	Object.fromEntries(
		[...new Set(Object.values(fields).map((field) => field.type))].map((type) => [
			type,
			['date', 'double', 'float', 'integer', 'long', 'number'].includes(type) ? RANGE : ENUM_LIKE,
		]),
	);

const participantFields = {
	'donor.biological_sex': { displayName: 'Biological Sex', isArray: false, type: 'keyword' },
	'donor.vital_status': { displayName: 'Vital Status', isArray: false, type: 'keyword' },
	'donor.age_at_diagnosis': { displayName: 'Age at Diagnosis', isArray: false, type: 'long', unit: 'years' },
	'donor.is_smoker': { displayName: 'Smoker', isArray: false, type: 'boolean' },
	'diagnosis.cancer_type': { displayName: 'Cancer Type', isArray: true, type: 'keyword' },
	'diagnosis.primary_site': { displayName: 'Primary Site', isArray: true, type: 'keyword' },
	'diagnosis.date_of_diagnosis': { displayName: 'Date of Diagnosis', isArray: true, type: 'date' },
	'treatment.treatment_type': { displayName: 'Treatment Type', isArray: true, type: 'keyword' },
	'follow_up.days_to_death': { displayName: 'Days to Death', isArray: false, type: 'integer', unit: 'days' },
	study_id: { displayName: 'Study', isArray: false, type: 'keyword' },
};

const fileFields = {
	'file.data_type': { displayName: 'Data Type', isArray: false, type: 'keyword' },
	'file.file_format': { displayName: 'File Format', isArray: false, type: 'keyword' },
	'file.size': { displayName: 'File Size', isArray: false, type: 'long', unit: 'bytes' },
	'analysis.experimental_strategy': { displayName: 'Experimental Strategy', isArray: false, type: 'keyword' },
	'donor.donor_id': { displayName: 'Donor ID', isArray: false, type: 'keyword' },
	study_id: { displayName: 'Study', isArray: false, type: 'keyword' },
};

export const serverIntrospection = {
	catalogCount: 2,
	catalogs: {
		participants: {
			description: 'One document per study participant, with diagnoses and treatments.',
			documentType: 'participant',
			paths: {
				fields: '/participants/fields',
				graphql: '/participants/graphql',
				introspection: '/introspection/participants',
			},
		},
		files: {
			description: 'One document per data file, with its analysis and donor.',
			documentType: 'file',
			paths: { fields: '/files/fields', graphql: '/files/graphql', introspection: '/introspection/files' },
		},
	},
	mode: 'multiple',
	sqonSchemaPath: '/introspection/sqon',
};

export const catalogueIntrospections: Record<string, unknown> = {
	participants: {
		catalogId: 'participants',
		documentType: 'participant',
		generatedAt: '2026-01-01T00:00:00.000Z',
		meta: { authFiltered: false },
		operators: operatorsFor(participantFields),
		fields: participantFields,
	},
	files: {
		catalogId: 'files',
		documentType: 'file',
		generatedAt: '2026-01-01T00:00:00.000Z',
		meta: { authFiltered: false },
		operators: operatorsFor(fileFields),
		fields: fileFields,
	},
};

/** `GET /introspection/sqon` as pinned by the search-server's committed fixtures. */
export const loadSqonIntrospection = async () => {
	const dir = new URL('../../../../apps/search-server/src/introspection/', import.meta.url);
	const read = async (name: string) =>
		JSON.parse((await readFile(new URL(name, dir), 'utf8')).replaceAll('__SQON_SCHEMA_VERSION__', '1.0.0'));
	return { ...(await read('introspectionSqon.metadata.json')), schema: await read('introspectionSqon.schema.json') };
};
