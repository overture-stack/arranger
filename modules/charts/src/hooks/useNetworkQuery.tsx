import { logger } from '#logger';
import type { SQONType } from '@overture-stack/arranger-components';
import { useEffect, useState } from 'react';
import type { ChartsGQLResult } from '../components/Provider/chartsContextTypes';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Hook for Arranger Charts to access arranger data, including network aggregation data.
 * You need to provide the specific query that will be resolved, this hook will provide
 * the filters from the Arranger Provider state for the query and handle the GQL fetch
 * response safely.
 *
 * @param query - a graphql query. Two variables will be made available to this query:
 *                - filters: SQON for filtering the request
 *                - networkNodesFilter: array of nodeIds to filter network request
 *  */
export const useNetworkQuery = ({
	query,
	apiFetcher,
	sqon,
	loadingDelay,
	networkNodesFilter,
}: {
	apiFetcher: any;
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
				const data = await apiFetcher({
					body: {
						query,
						variables: { filters: sqon, nodesFilter: networkNodesFilter ?? [] },
					},
				});
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
	}, [sqon, apiFetcher, query, networkNodesFilter]);

	return {
		...apiState,
	};
};
