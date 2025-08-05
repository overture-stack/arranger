import { useEffect, useState } from 'react';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useNetworkQuery = ({ query, apiFetcher, sqon }: { query: string; apiFetcher: any; sqon: {} }) => {
	const [apiState, setApiState] = useState({ data: null, loading: true, error: false });

	useEffect(() => {
		if (!query) return;

		const fetchData = async () => {
			console.log('fetching data for Arranger charts..');
			try {
				setApiState((previous) => ({ ...previous, loading: true }));

				// gives time for loader comp to show, better visual
				await delay(1800);
				const data = await apiFetcher({
					body: {
						query,
						variables: { filters: sqon },
					},
				});
				setApiState((previous) => ({ ...previous, data }));
			} catch (err) {
				console.error(err);
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
