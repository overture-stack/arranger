import { DataContextInterface } from '@overture-stack/arranger-components';
import { useEffect, useState } from 'react';

type UseNetworkQueryProps = Pick<DataContextInterface, 'apiFetcher' | 'sqon' | 'query'>;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useNetworkQuery = ({ query, apiFetcher, sqon }: UseNetworkQueryProps) => {
	const [apiState, setApiState] = useState({ data: null, loading: true, error: false });

	useEffect(() => {
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
		if (!query) return;
		fetchData();
	}, [sqon, apiFetcher, query]);

	return {
		apiState,
	};
};
