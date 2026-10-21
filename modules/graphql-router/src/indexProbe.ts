import type { SqonNode } from '@overture-stack/sqon';

import { buildQuery } from '#middleware/index.js';
import { applyNestingPrefix } from '#middleware/utils/nestingPrefix.js';
import type {
	SearchClient,
	SearchClientIndicesValidateQueryResponseBody,
	SearchClientSearchBody,
} from '#searchClient/types.js';

/** Whether the engine accepts a condition's query, and when it does not, the engine's or the compiler's reason. */
export type ConditionValidation = { explanation: string; valid: false } | { valid: true };

/**
 * Questions about one catalogue's index that its mapping alone cannot answer, put to the engine
 * itself. A condition is compiled exactly as the router compiles this catalogue's server-side filter,
 * so an answer holds for the queries the router will send. The probe stays usable after the hook
 * that received it returns.
 */
export type IndexProbe = {
	/** Resolves to how many records `condition` matches; rejects when it will not compile or the engine fails. */
	countMatching: (condition: SqonNode) => Promise<number>;
	/**
	 * Resolves to how many records hold more than one value in the field `fieldName` names, read from
	 * the field's doc values. Rejects, rather than resolving to 0, when the engine refuses the script (a
	 * field without doc values, inline scripts disabled) or cannot count every shard, and for a field
	 * inside a nested field, whose values its nested objects hold rather than the record.
	 */
	countRecordsHoldingSeveralValues: (fieldName: string) => Promise<number>;
	/**
	 * Resolves to whether the engine accepts `condition`'s query, with the engine's explanation when not.
	 * A condition that will not compile resolves as not valid, with the compiler's message; an engine
	 * that fails to answer rejects.
	 */
	validate: (condition: SqonNode) => Promise<ConditionValidation>;
};

const SEVERAL_VALUES_SCRIPT = 'doc[params.fieldName].size() > 1';

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The nested field `fieldName` lies at or inside, if any. */
const nestedFieldHolding = (fieldName: string, nestedFieldNames: string[]): string | undefined =>
	nestedFieldNames.find(
		(nestedFieldName) => fieldName === nestedFieldName || fieldName.startsWith(`${nestedFieldName}.`),
	);

/** How many records a search matched, when every shard answered in time and the engine counted them exactly. */
const exactTotalOf = ({ _shards, hits, timed_out }: SearchClientSearchBody): number | undefined => {
	const total = hits?.total;

	if (_shards.failed === 0 && timed_out === false) {
		if (typeof total === 'number') {
			return total;
		}

		if (total?.relation === 'eq') {
			return total.value;
		}
	}

	return undefined;
};

const engineExplanationOf = ({ error, explanations = [] }: SearchClientIndicesValidateQueryResponseBody): string => {
	const reasons = [error, ...explanations.map((explanation) => explanation.error)].filter(
		(reason): reason is string => typeof reason === 'string' && reason.length > 0,
	);

	return [...new Set(reasons)].join('; ') || 'The search engine refused the query without giving a reason.';
};

/**
 * Probes one catalogue's index through the router's own search client. Built by the router once its
 * mapping is fetched, so a missing client or index means construction has already gone wrong.
 *
 * @param nestedFieldNames the catalogue's nested fields, unprefixed, as the router's resolvers hand them to `buildQuery`.
 */
export const createIndexProbe = ({
	index,
	nestedFieldNames,
	nestingPrefix,
	searchClient,
}: {
	index?: string;
	nestedFieldNames: string[];
	nestingPrefix?: string;
	searchClient?: SearchClient;
}): IndexProbe => {
	if (index && searchClient) {
		const compile = (condition: SqonNode): object =>
			buildQuery({ caller: 'indexProbe', filters: condition, nestedFieldNames, nestingPrefix });

		const compileForValidation = (condition: SqonNode): { explanation: string } | { query: object } => {
			try {
				return { query: compile(condition) };
			} catch (error) {
				return { explanation: messageOf(error) };
			}
		};

		// The query is sent even when it compiled empty, as the router sends it: left out, the engine
		// would count every record.
		const countRecords = async ({
			failureMessage,
			query,
		}: {
			failureMessage: string;
			query: object;
		}): Promise<number> => {
			const { body } = await searchClient
				.search({ body: { query, track_total_hits: true }, index, size: 0 })
				.catch((cause: unknown) => {
					throw new Error(failureMessage, { cause });
				});
			const total = exactTotalOf(body);

			if (typeof total === 'number') {
				return total;
			}

			throw new Error(failureMessage, {
				cause: new Error('Some shards failed or the search timed out, so the count would be incomplete.', {
					cause: { _shards: body._shards, timed_out: body.timed_out },
				}),
			});
		};

		// Every shard is asked: one holding none of a field's values may accept a bound it never parses.
		const validateQuery = async (query: object): Promise<ConditionValidation> => {
			const { body } = await searchClient.indices
				.validateQuery({ all_shards: true, body: { query }, explain: true, index })
				.catch((cause: unknown) => {
					throw new Error('The search engine could not validate a condition.', { cause });
				});

			return body.valid === true ? { valid: true } : { explanation: engineExplanationOf(body), valid: false };
		};

		return {
			countMatching: async (condition) =>
				countRecords({
					failureMessage: 'The search engine could not count the records matching a condition.',
					query: compile(condition),
				}),
			countRecordsHoldingSeveralValues: async (fieldName) => {
				const nestedFieldName = nestedFieldHolding(fieldName, nestedFieldNames);

				if (nestedFieldName === undefined) {
					return countRecords({
						failureMessage: `The search engine could not count the records holding several values in "${fieldName}".`,
						query: {
							script: {
								script: {
									lang: 'painless',
									params: { fieldName: applyNestingPrefix(fieldName, nestingPrefix) ?? fieldName },
									source: SEVERAL_VALUES_SCRIPT,
								},
							},
						},
					});
				}

				throw new Error(
					`Cannot count the records holding several values in "${fieldName}": it lies inside the nested field "${nestedFieldName}", whose objects hold its values rather than the record.`,
				);
			},
			validate: async (condition) => {
				const compiled = compileForValidation(condition);

				return 'query' in compiled
					? validateQuery(compiled.query)
					: { explanation: compiled.explanation, valid: false };
			},
		};
	}

	throw new Error("An index probe needs the catalogue's search client and index.");
};
