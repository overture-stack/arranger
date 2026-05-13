import type { ES_TYPES } from '@overture-stack/arranger-types/elastic';

export type FieldFromMapping = {
	fieldName: string;
	type: ES_TYPES | 'nested'; // TODO: Cleanup types from Search Mappings
};
