/**
 * The rule a request breaks when its own filter, with no server-side filter restricting it, compiles to more
 * clauses than the search engine accepts.
 */
export const CLAUSE_LIMIT_RULE = 'The filter must compile to no more clauses than the search engine accepts.';

/** The search engine's refusal of a query holding more clauses than it accepts. */
export type ClauseLimitRefusal = {
	/** The limit the engine named, or undefined where its reason names none. */
	clauseLimit: number | undefined;
};

const CLAUSE_LIMIT_TYPES: ReadonlySet<unknown> = new Set(['too_many_clauses', 'too_many_nested_clauses']);

const CLAUSE_LIMIT_REASON = /maxClauseCount is set to (\d+)/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** `entry` followed by each entry its `caused_by` chain holds. */
const causeChainOf = (entry: unknown): Record<string, unknown>[] =>
	isRecord(entry) ? [entry, ...causeChainOf(entry.caused_by)] : [];

/** Every entry of an engine's report: the error and its causes, each root cause, and each failed shard's reason and its causes. */
const reportEntriesOf = (report: unknown): Record<string, unknown>[] =>
	isRecord(report)
		? [
				...causeChainOf(report),
				...listOf(report.root_cause).flatMap(causeChainOf),
				...listOf(report.failed_shards).flatMap((failedShard) =>
					isRecord(failedShard) ? causeChainOf(failedShard.reason) : [],
				),
			]
		: [];

/** The report a search client's ResponseError carries, as both supported clients hold it under `meta.body`. */
const engineReportOf = (error: unknown): unknown =>
	isRecord(error) && isRecord(error.meta) && isRecord(error.meta.body) ? error.meta.body.error : undefined;

const clauseLimitIn = (reason: unknown): number | undefined => {
	const named = typeof reason === 'string' ? CLAUSE_LIMIT_REASON.exec(reason) : null;

	return named?.[1] ? Number(named[1]) : undefined;
};

/**
 * The search engine's refusal of a query past its clause limit, recognized by the error types
 * `too_many_clauses` and `too_many_nested_clauses` wherever the engine's report holds them, or undefined for
 * any other failure. The limit is read from the reason of an entry of either type.
 *
 * @param error what a search rejected with.
 */
export const findClauseLimitRefusal = (error: unknown): ClauseLimitRefusal | undefined => {
	const refusals = reportEntriesOf(engineReportOf(error)).filter((entry) => CLAUSE_LIMIT_TYPES.has(entry.type));

	return refusals.length > 0
		? { clauseLimit: refusals.map((entry) => clauseLimitIn(entry.reason)).find(Number.isInteger) }
		: undefined;
};
