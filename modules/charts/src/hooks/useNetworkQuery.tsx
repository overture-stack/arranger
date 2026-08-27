import { logger } from '#logger';
import type { APIFetcherFn, SQONType } from '@overture-stack/arranger-components';
import { useEffect, useState } from 'react';
import type { ChartsGQLResult } from '../components/Provider/chartsContextTypes';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Builds the args `apiFetcher` is called with. `url: apiUrl` matters: without it, the request
 * falls back to the fetcher's own unscoped default, ignoring `catalogue` scoping entirely, the
 * same bug already found and fixed in `arranger-components`' `AggsQuery`/`QuickSearchQuery`. */
export const buildNetworkQueryFetchArgs = ({
	apiUrl,
	networkNodesFilter,
	query,
	sqon,
}: {
	apiUrl?: string;
	networkNodesFilter?: string[];
	query: string;
	sqon: SQONType;
}) => ({
	body: {
		query,
		variables: { filters: sqon, nodesFilter: networkNodesFilter ?? [] },
	},
	url: apiUrl,
});

/**
 * Hook for Arranger Charts to access arranger data, including network aggregation data.
 * You need to provide the specific query that will be resolved, this hook will provide
 * the filters from the Arranger Provider state for the query and handle the GQL fetch
 * response safely.
 *
 * @param apiUrl - the catalogue-scoped base URL from `DataProvider`'s context; forwarded to
 *                 `apiFetcher` so this request respects `catalogue` scoping like everything else.
 * @param query - a graphql query. Two variables will be made available to this query:
 *                - filters: SQON for filtering the request
 *                - networkNodesFilter: array of nodeIds to filter network request
 *  */
export const useNetworkQuery = ({
	apiUrl,
	query,
	apiFetcher,
	sqon,
	loadingDelay,
	networkNodesFilter,
}: {
	apiFetcher: APIFetcherFn;
	apiUrl?: string;
	query: string;
	loadingDelay: number;
	networkNodesFilter?: string[];
	sqon: SQONType;
}) => {
	const [apiState, setApiState] = useState<ChartsGQLResult>({
		state: 'LOADING',
	});

	useEffect(() => {
		if (!query) return;

		const fetchData = async () => {
			logger.debug('Fetching data for Arranger charts...');
			try {
				setApiState({ state: 'LOADING' });

				// gives time for loader comp to show, better visual
				loadingDelay && (await delay(loadingDelay));
				const data = await apiFetcher(buildNetworkQueryFetchArgs({ apiUrl, networkNodesFilter, query, sqon }));
				setApiState({ state: 'SUCCESS', data });
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: `Unexpected error occurred while fetching Arranger data: ${error}`;
				logger.debug(message);
				setApiState({ state: 'ERROR', error: message });
			}
		};

		fetchData();
	}, [apiUrl, sqon, apiFetcher, query, networkNodesFilter]);

	return {
		...apiState,
	};
};
