import { DataContextInterface } from '@overture-stack/arranger-components';
import { useEffect, useState } from 'react';

const AggregationsQuery = (fieldName) => `
  ${fieldName}
  {
    bucket_count
    buckets {
      doc_count
      key
    }
  }
`;

const NumericAggregationsQuery = (field) => ``;

// TODO: improve loose coupling of query + variables
const createQueryResolver =
	({ documentType }: { documentType: string }) =>
	({ fields }: { fields: string[] }) => {
		const fullQuery = `
    query ChartsQuery($filters: JSON) {
      ${documentType} {
        aggregations(
          filters: $filters
          include_missing: true
          aggregations_filter_themselves: true
        ) {
          ${fields.map((fieldName) => AggregationsQuery(fieldName))}
        }
      }
    }`;

		return fullQuery;
	};

type UseNetworkQueryProps = Pick<DataContextInterface, 'documentType' | 'apiFetcher' | 'sqon'>;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useNetworkQuery = ({ documentType, apiFetcher, sqon }: UseNetworkQueryProps) => {
	const [fields, setFields] = useState(new Set());
	const [apiState, setApiState] = useState({ data: null, loading: false, error: false });

	// TODO: useCallback
	const queryResolver = createQueryResolver({ documentType });

	const fetchData = async () => {
		if (fields.size === 0) {
			console.log('no fields to fetch ie. no charts');
			return;
		}
		try {
			setApiState((previous) => ({ ...previous, loading: true }));
			const query = queryResolver({ fields: Array.from(fields) });
			console.log('charts fetching data', apiState);

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

	useEffect(() => {
		fetchData();
	}, [fields, sqon, apiFetcher]);

	return {
		apiState,
		addToQuery: ({ fieldName }: { fieldName: string }) => {
			setFields((previous) => {
				const newSet = new Set(previous);
				newSet.add(fieldName);
				return newSet;
			});
		},
		removeFromQuery: ({ fieldName }: { fieldName: string }) => {
			setFields((previous) => {
				const newSet = new Set(previous);
				newSet.delete(fieldName);
				return newSet;
			});
		},
	};
};
