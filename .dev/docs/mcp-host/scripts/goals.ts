/**
 * Research goals against the synthetic catalogue, each with the reference calls a correct run makes.
 *
 * The first five are ordinary requests. The `hard` ones are added for S4: they push `build_sqon` into
 * many clauses, mixed combinators and negation, where malformed calls are most likely.
 */
import { BUILT_SQON, type Goal } from './conversation.ts';

const discover = [
	{ name: 'list_catalogues', arguments: {} },
	{ name: 'get_catalogue_fields', arguments: { catalogueId: 'participants' } },
];

export const GOALS: Goal[] = [
	{
		id: 'female-over-60',
		prompt: 'How many female participants were diagnosed after the age of 60?',
		expectedFields: ['donor.biological_sex', 'donor.age_at_diagnosis'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [
						{ fieldName: 'donor.biological_sex', operator: 'in', value: ['Female'] },
						{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 60 },
					],
				},
			},
			{ name: 'execute_query', arguments: { catalogueId: 'participants', sqon: BUILT_SQON, first: 0 } },
		],
	},
	{
		id: 'lung-breast-smokers',
		prompt: 'List participants with lung or breast cancer who are smokers. Show their study and cancer type.',
		expectedFields: ['diagnosis.cancer_type', 'donor.is_smoker'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [
						{ fieldName: 'diagnosis.cancer_type', operator: 'in', value: ['Lung', 'Breast'] },
						{ fieldName: 'donor.is_smoker', operator: 'in', value: [true] },
					],
				},
			},
			{
				name: 'execute_query',
				arguments: {
					catalogueId: 'participants',
					sqon: BUILT_SQON,
					fields: ['study_id', 'diagnosis.cancer_type'],
				},
			},
		],
	},
	{
		id: 'deceased-no-chemo',
		prompt: 'Find deceased participants who never received chemotherapy.',
		expectedFields: ['donor.vital_status', 'treatment.treatment_type'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [
						{ fieldName: 'donor.vital_status', operator: 'in', value: ['Deceased'] },
						{ fieldName: 'treatment.treatment_type', operator: 'not-in', value: ['Chemotherapy'] },
					],
				},
			},
			{ name: 'execute_query', arguments: { catalogueId: 'participants', sqon: BUILT_SQON } },
		],
	},
	{
		id: 'diagnosed-2015-2020-under-40',
		prompt: 'Which participants were diagnosed between 2015 and 2020 while under 40 years old?',
		expectedFields: ['diagnosis.date_of_diagnosis', 'donor.age_at_diagnosis'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [
						{ fieldName: 'diagnosis.date_of_diagnosis', operator: 'gte', value: '2015-01-01' },
						{ fieldName: 'diagnosis.date_of_diagnosis', operator: 'lte', value: '2020-12-31' },
						{ fieldName: 'donor.age_at_diagnosis', operator: 'lt', value: 40 },
					],
				},
			},
			{ name: 'execute_query', arguments: { catalogueId: 'participants', sqon: BUILT_SQON } },
		],
	},
	{
		id: 'male-primary-sites',
		prompt: 'Give me a breakdown of primary sites among male participants.',
		expectedFields: ['donor.biological_sex'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [{ fieldName: 'donor.biological_sex', operator: 'in', value: ['Male'] }],
				},
			},
			{
				name: 'execute_query',
				arguments: {
					catalogueId: 'participants',
					sqon: BUILT_SQON,
					queryType: 'aggregations',
					aggregationFields: ['diagnosis.primary_site'],
				},
			},
		],
	},
	{
		id: 'hard-many-clauses',
		hard: true,
		prompt: 'Find female smokers with lung cancer, diagnosed between ages 40 and 65, alive, treated with both surgery and radiation, from study LUNG-01 or LUNG-02, diagnosed on or after 2018-06-01.',
		expectedFields: [
			'donor.biological_sex',
			'donor.is_smoker',
			'diagnosis.cancer_type',
			'donor.age_at_diagnosis',
			'donor.vital_status',
			'treatment.treatment_type',
			'study_id',
			'diagnosis.date_of_diagnosis',
		],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [
						{ fieldName: 'donor.biological_sex', operator: 'in', value: ['Female'] },
						{ fieldName: 'donor.is_smoker', operator: 'in', value: [true] },
						{ fieldName: 'diagnosis.cancer_type', operator: 'in', value: ['Lung'] },
						{ fieldName: 'donor.age_at_diagnosis', operator: 'gte', value: 40 },
						{ fieldName: 'donor.age_at_diagnosis', operator: 'lte', value: 65 },
						{ fieldName: 'donor.vital_status', operator: 'in', value: ['Alive'] },
						{ fieldName: 'treatment.treatment_type', operator: 'all', value: ['Surgery', 'Radiation'] },
						{ fieldName: 'study_id', operator: 'in', value: ['LUNG-01', 'LUNG-02'] },
						{ fieldName: 'diagnosis.date_of_diagnosis', operator: 'gte', value: '2018-06-01' },
					],
				},
			},
		],
	},
	{
		id: 'hard-or-of-ranges',
		hard: true,
		prompt: 'Find participants who were either older than 75 or younger than 18 at diagnosis, excluding anyone whose vital status is unknown.',
		// The first of two calls: the OR of ranges, before an AND with existingSqon adds the exclusion.
		expectedFields: ['donor.age_at_diagnosis'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'or',
					clauses: [
						{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 75 },
						{ fieldName: 'donor.age_at_diagnosis', operator: 'lt', value: 18 },
					],
				},
			},
		],
	},
	{
		id: 'hard-negated-range',
		hard: true,
		prompt: 'Show male participants who are NOT aged 30 to 50 at diagnosis and who have no recorded treatment of type "Immunotherapy" or "Hormone therapy".',
		expectedFields: ['donor.biological_sex', 'donor.age_at_diagnosis', 'treatment.treatment_type'],
		steps: [
			...discover,
			{
				name: 'build_sqon',
				arguments: {
					catalogueId: 'participants',
					combination: 'and',
					clauses: [
						{ fieldName: 'donor.biological_sex', operator: 'in', value: ['Male'] },
						{ fieldName: 'donor.age_at_diagnosis', operator: 'between', value: [30, 50], negate: true },
						{
							fieldName: 'treatment.treatment_type',
							operator: 'not-in',
							value: ['Immunotherapy', 'Hormone therapy'],
						},
					],
				},
			},
		],
	},
];
