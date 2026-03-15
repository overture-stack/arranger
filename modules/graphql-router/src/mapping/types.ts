import type { ES_TYPES } from './esToAggTypeMap.js';

export type FieldFromMapping = {
	fieldName: string;
	type: ES_TYPES;
};
