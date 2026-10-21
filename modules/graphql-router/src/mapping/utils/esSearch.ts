import { AccessControlQueryTooLargeError, type ReadPath } from '#accessControl/AccessControlError.js';
import { isIncludeEverythingFilter } from '#accessControl/includeEverything.js';
import { InvalidFilterError } from '#middleware/buildQuery/InvalidFilterError.js';
import { CLAUSE_LIMIT_RULE, findClauseLimitRefusal } from '#searchClient/clauseLimit.js';
import type { SearchClient, SearchClientSearchParams, SearchClientSearchResponse } from '#searchClient/types.js';

/** Searches with `esClient` as given, for a read outside every catalogue's access control, such as its extended fields. */
export default (esClient: SearchClient) =>
	async (params: SearchClientSearchParams): Promise<SearchClientSearchResponse> => {
		return await esClient.search(params);
	};

/**
 * Searches a catalogue's index for one read, under the server-side filter that read applies. Where that
 * filter restricts any record, a shard refusing the search fails the whole search, and the engine's refusal
 * of a query past its clause limit is thrown as an `AccessControlQueryTooLargeError` naming the catalogue.
 * Where it restricts none, that refusal is thrown as an `InvalidFilterError` stating the rule the request's
 * filter broke. Every other failure is thrown as the engine raised it.
 *
 * @param catalogue the catalogue's label, as its error and its log name it.
 * @param esClient the catalogue's search client.
 * @param readPath the read the search serves.
 * @param serverSideFilter the filter the read's callback returned, as composed into the search's query.
 */
export const catalogueSearch =
	({
		catalogue,
		esClient,
		readPath,
		serverSideFilter,
	}: {
		catalogue: string;
		esClient: SearchClient;
		readPath: ReadPath;
		serverSideFilter: unknown;
	}) =>
	async (params: SearchClientSearchParams): Promise<SearchClientSearchResponse> => {
		const serverSideFilterApplies = !isIncludeEverythingFilter(serverSideFilter);

		try {
			return await esClient.search(
				serverSideFilterApplies ? { ...params, allow_partial_search_results: false } : params,
			);
		} catch (error) {
			const refusal = findClauseLimitRefusal(error);

			if (refusal) {
				throw serverSideFilterApplies
					? new AccessControlQueryTooLargeError({
							catalogue,
							cause: error,
							clauseLimit: refusal.clauseLimit,
							readPath,
						})
					: new InvalidFilterError(CLAUSE_LIMIT_RULE, { cause: error });
			}

			throw error;
		}
	};
