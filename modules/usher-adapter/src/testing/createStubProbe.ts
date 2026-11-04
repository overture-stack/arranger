import type { IndexProbe } from '@overture-stack/arranger-graphql-router';

import type { ProbeCall, StubProbe } from './types.js';

/**
 * Creates an `IndexProbe` answering without an engine: by default every condition is valid and matches
 * one record, and no record holds several resource values. `answers` replaces any of the three checks.
 *
 * @param answers the checks answered otherwise than by default.
 */
export const createStubProbe = (answers: Partial<IndexProbe> = {}): StubProbe => {
	const calls: ProbeCall[] = [];
	const {
		countMatching = async () => 1,
		countRecordsAndValues = async () => ({ records: 1, values: 1 }),
		validate = async () => ({ valid: true as const }),
	} = answers;

	return {
		calls,
		probe: {
			countMatching: async (condition) => {
				calls.push({ argument: structuredClone(condition), check: 'countMatching' });
				return countMatching(condition);
			},
			countRecordsAndValues: async (fieldName) => {
				calls.push({ argument: fieldName, check: 'countRecordsAndValues' });
				return countRecordsAndValues(fieldName);
			},
			validate: async (condition) => {
				calls.push({ argument: structuredClone(condition), check: 'validate' });
				return validate(condition);
			},
		},
	};
};
