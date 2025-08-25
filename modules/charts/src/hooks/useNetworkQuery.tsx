import { logger } from '#logger';
import { useEffect, useState } from 'react';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useNetworkQuery = ({
	query,
	apiFetcher,
	sqon,
	loadingDelay,
}: {
	query: string;
	apiFetcher: any;
	sqon: {};
	loadingDelay: number;
}) => {
	const [apiState, setApiState] = useState({ data: null, loading: false, error: false });

	useEffect(() => {
		if (!query) return;

		const fetchData = async () => {
			logger.debug('fetching data for Arranger charts..');
			try {
				setApiState((previous) => ({ ...previous, loading: true }));

				// gives time for loader comp to show, better visual
				loadingDelay && (await delay(loadingDelay));
				const data = await apiFetcher({
					body: {
						query,
						variables: { filters: sqon },
					},
				});
				setApiState((previous) => ({ ...previous, data }));
			} catch (err) {
				logger.debug(err);
				setApiState((previous) => ({ ...previous, error: true }));
			} finally {
				setApiState((previous) => ({ ...previous, loading: false }));
			}
		};

		fetchData();
	}, [sqon, apiFetcher, query]);

	return {
		apiState,
	};
};
