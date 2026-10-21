import type { IndexProbe } from '@overture-stack/arranger-graphql-router';

/** One question put to a stub probe: which check, and what it was asked about. */
export type ProbeCall = Readonly<{ argument: unknown; check: keyof IndexProbe }>;

/** A stub probe, with every question put to it in the order asked. */
export type StubProbe = Readonly<{ calls: readonly ProbeCall[]; probe: IndexProbe }>;

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
		countRecordsHoldingSeveralValues = async () => 0,
		validate = async () => ({ valid: true as const }),
	} = answers;

	return {
		calls,
		probe: {
			countMatching: async (condition) => {
				calls.push({ argument: structuredClone(condition), check: 'countMatching' });
				return countMatching(condition);
			},
			countRecordsHoldingSeveralValues: async (fieldName) => {
				calls.push({ argument: fieldName, check: 'countRecordsHoldingSeveralValues' });
				return countRecordsHoldingSeveralValues(fieldName);
			},
			validate: async (condition) => {
				calls.push({ argument: structuredClone(condition), check: 'validate' });
				return validate(condition);
			},
		},
	};
};
