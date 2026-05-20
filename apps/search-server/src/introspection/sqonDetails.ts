import {
	getSqonFieldOperatorDetails,
	getVersionedSqonJsonSchema,
	SQON_COMBINATION_OPS,
	SQON_OP_ALIASES,
} from '@overture-stack/sqon';

import type { SqonIntrospectionResponse } from '#introspection/types.js';

const buildSqonDetails = (): SqonIntrospectionResponse => ({
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	title: 'Serialized Query Object Notation',
	description: 'JSON Schema and operator metadata for building valid SQON filters.',
	version: getVersionedSqonJsonSchema().version,
	aliases: SQON_OP_ALIASES,
	operators: {
		combination: [...SQON_COMBINATION_OPS],
		field: getSqonFieldOperatorDetails(),
	},
	schema: getVersionedSqonJsonSchema(),
});

export default buildSqonDetails;
